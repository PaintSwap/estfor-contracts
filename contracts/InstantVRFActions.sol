// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import {ISamWitchVRF} from "./interfaces/ISamWitchVRF.sol";
import {IInstantVRFActionStrategy} from "./InstantVRFActionStrategies/interfaces/IInstantVRFActionStrategy.sol";
import {ItemNFT} from "./ItemNFT.sol";
import {PetNFT} from "./PetNFT.sol";
import {Players} from "./Players/Players.sol";
import {VRFRequestInfo} from "./VRFRequestInfo.sol";
import {Quests} from "./Quests.sol";

import {Skill, EquipPosition, IS_FULL_MODE_BIT, IS_AVAILABLE_BIT} from "./globals/players.sol";
import {InstantVRFActionInput, InstantVRFActionType} from "./globals/rewards.sol";
import {NONE} from "./globals/items.sol";

contract InstantVRFActions is UUPSUpgradeable, OwnableUpgradeable {
  event AddInstantVRFActions(InstantVRFActionInput[] instantVRFActionInputs);
  event EditInstantVRFActions(InstantVRFActionInput[] instantVRFActionInputs);
  event RemoveInstantVRFActions(uint16[] actionIds);
  event SetGasCostPerUnit(uint256 gasCostPerUnit);
  event DoInstantVRFActions(
    address from,
    uint256 playerId,
    uint256 requestId,
    uint16[] actionIds,
    uint256[] amounts,
    uint256[] consumedItemTokenIds,
    uint256[] consumedAmounts
  );
  event CompletedInstantVRFActions(
    address from,
    uint256 playerId,
    uint256 requestId,
    uint256[] producedItemTokenIds,
    uint256[] producedItemAmounts,
    uint256[] producedPetTokenIds
  );
  event AddStrategies(InstantVRFActionType[] actionTypes, address[] strategies);
  event SetMaxActionAmount(uint8 maxActionAmount);

  error ActionIdZeroNotAllowed();
  error ActionDoesNotExist();
  error ActionAlreadyExists();
  error ActionNotAvailable();
  error IncorrectInputAmounts();
  error InputSpecifiedWithoutAmount();
  error InputAmountsMustBeInOrder();
  error InvalidInputTokenId();
  error InputItemNoDuplicates();
  error TooManyInputItems();
  error AlreadyProcessing();
  error CallerNotSamWitchVRF();
  error LengthMismatch();
  error NotOwnerOfPlayerAndActive();
  error PlayerNotUpgraded();
  error TooManyActionAmounts();
  error RequestDoesNotExist();
  error InsufficientCost();
  error TransferFailed();
  error NotDoingAnyActions();
  error InvalidStrategy();
  error StrategyAlreadyExists();
  error DependentQuestNotCompleted();

  struct PlayerActionInfo {
    uint16[10] actionIdAmountPairs; // actionId, amount
  }

  struct InstantVRFAction {
    // Storage slot 1
    uint16 inputTokenId1;
    uint24 inputAmount1;
    uint16 inputTokenId2;
    uint24 inputAmount2;
    uint16 inputTokenId3;
    uint24 inputAmount3;
    uint16 questPrerequisiteId;
    InstantVRFActionType actionType;
    bytes1 packedData; // worldLocation first bit, second bit isAvailable, last bit isFullModeOnly
  }

  struct Player {
    address owner;
    uint64 playerId;
  }

  uint256 private constant CALLBACK_GAS_LIMIT_PER_ACTION = 135_000;
  uint256 private constant MAX_INPUTS_PER_ACTION = 3; // This needs to be the max across all strategies

  ItemNFT private _itemNFT;
  Players private _players;
  Quests private _quests;
  VRFRequestInfo private _vrfRequestInfo;
  uint64 private _gasCostPerUnit;
  uint8 private _maxActionAmount;

  address private _oracle;
  ISamWitchVRF private _samWitchVRF;
  PetNFT private _petNFT;

  mapping(uint256 playerId => PlayerActionInfo) private _playerActionInfos;
  mapping(uint256 actionId => InstantVRFAction action) private _actions;
  mapping(bytes32 requestId => Player player) private _requestIdToPlayer;
  mapping(InstantVRFActionType actionType => IInstantVRFActionStrategy strategy) private _strategies;

  modifier isOwnerOfPlayerAndActive(uint256 playerId) {
    require(_players.isOwnerOfPlayerAndActive(_msgSender(), playerId), NotOwnerOfPlayerAndActive());
    _;
  }

  /// @dev Reverts if the caller is not the SamWitchVRF contract.
  modifier onlySamWitchVRF() {
    require(_msgSender() == address(_samWitchVRF), CallerNotSamWitchVRF());
    _;
  }

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(
    Players players,
    ItemNFT itemNFT,
    PetNFT petNFT,
    Quests quests,
    address oracle,
    ISamWitchVRF samWitchVRF,
    VRFRequestInfo vrfRequestInfo,
    uint8 maxActionAmount
  ) external initializer {
    __UUPSUpgradeable_init();
    __Ownable_init(_msgSender());

    _players = players;
    _itemNFT = itemNFT;
    _petNFT = petNFT;
    _quests = quests;
    _oracle = oracle;
    _samWitchVRF = samWitchVRF;
    _vrfRequestInfo = vrfRequestInfo;
    setGasCostPerUnit(15_000);
    setMaxActionAmount(maxActionAmount);
  }

  function doInstantVRFActions(
    uint256 playerId,
    uint16[] calldata actionIds,
    uint256[] calldata actionAmounts
  ) external payable isOwnerOfPlayerAndActive(playerId) {
    require(actionIds.length == actionAmounts.length, LengthMismatch());
    require(actionIds.length <= 5, TooManyInputItems());
    require(_playerActionInfos[playerId].actionIdAmountPairs[0] == 0, AlreadyProcessing());
    require(actionIds.length != 0, NotDoingAnyActions());

    bool isPlayerEvolved = _players.isPlayerEvolved(playerId);
    uint256 totalAmount;
    uint256 numRandomWords;
    for (uint256 i; i < actionIds.length; ++i) {
      uint16 actionId = actionIds[i];
      require(_actionExists(actionId), ActionDoesNotExist());
      require(_isActionAvailable(actionId), ActionNotAvailable());
      require(isPlayerEvolved || !_isActionFullMode(actionId), PlayerNotUpgraded());

      uint16 questPrerequisiteId = _actions[actionId].questPrerequisiteId;
      if (questPrerequisiteId != 0) {
        require(_quests.isQuestCompleted(playerId, questPrerequisiteId), DependentQuestNotCompleted());
      }

      _playerActionInfos[playerId].actionIdAmountPairs[i * 2] = actionId;
      _playerActionInfos[playerId].actionIdAmountPairs[i * 2 + 1] = uint16(actionAmounts[i]);
      totalAmount += actionAmounts[i];
      numRandomWords += actionAmounts[i] / 16 + ((actionAmounts[i] % 16) == 0 ? 0 : 1);
    }

    // Mainly to keep response gas within block gas limits
    require(totalAmount <= _maxActionAmount, TooManyActionAmounts());
    // // Check they are paying enough
    require(msg.value >= requestCost(totalAmount), InsufficientCost());

    (bool success, ) = _oracle.call{value: msg.value}("");
    require(success, TransferFailed());

    bytes32 requestId = _requestRandomWords(numRandomWords, totalAmount);
    _requestIdToPlayer[requestId] = Player({owner: _msgSender(), playerId: uint64(playerId)});

    // Get the tokenIds to burn
    uint256[] memory consumedItemTokenIds = new uint256[](actionIds.length * MAX_INPUTS_PER_ACTION);
    uint256[] memory consumedAmounts = new uint256[](actionIds.length * MAX_INPUTS_PER_ACTION);
    uint256 actualLength;
    for (uint256 i = 0; i < actionIds.length; ++i) {
      InstantVRFAction storage instantVRFAction = _actions[actionIds[i]];
      if (instantVRFAction.inputTokenId1 != NONE) {
        consumedItemTokenIds[actualLength] = instantVRFAction.inputTokenId1;
        consumedAmounts[actualLength] = instantVRFAction.inputAmount1 * actionAmounts[i];
        ++actualLength;
      }
      if (instantVRFAction.inputTokenId2 != NONE) {
        consumedItemTokenIds[actualLength] = instantVRFAction.inputTokenId2;
        consumedAmounts[actualLength] = instantVRFAction.inputAmount2 * actionAmounts[i];
        ++actualLength;
      }
      if (instantVRFAction.inputTokenId3 != NONE) {
        consumedItemTokenIds[actualLength] = instantVRFAction.inputTokenId3;
        consumedAmounts[actualLength] = instantVRFAction.inputAmount3 * actionAmounts[i];
        ++actualLength;
      }
    }

    assembly ("memory-safe") {
      mstore(consumedItemTokenIds, actualLength)
      mstore(consumedAmounts, actualLength)
    }

    _itemNFT.burnBatch(_msgSender(), consumedItemTokenIds, consumedAmounts);

    emit DoInstantVRFActions(
      _msgSender(),
      playerId,
      uint256(requestId),
      actionIds,
      actionAmounts,
      consumedItemTokenIds,
      consumedAmounts
    );
  }

  function fulfillRandomWords(bytes32 requestId, uint256[] calldata randomWords) external onlySamWitchVRF {
    uint256 playerId = _requestIdToPlayer[requestId].playerId;
    address from = _requestIdToPlayer[requestId].owner; // Might not be actual owner due to async nature so don't rely on that
    require(from != address(0), RequestDoesNotExist());

    (uint256[] memory itemTokenIds, uint256[] memory itemAmounts, uint256[] memory petBaseIds) = _getRewards(
      playerId,
      randomWords
    );

    _vrfRequestInfo.updateAverageGasPrice();

    delete _playerActionInfos[playerId]; // Allows another request to be made
    delete _requestIdToPlayer[requestId];

    if (itemTokenIds.length != 0) {
      try _itemNFT.mintBatch(from, itemTokenIds, itemAmounts) {} catch {
        // If it fails, then it means it was sent to a contract which can not handle erc1155 or is malicious
        assembly ("memory-safe") {
          mstore(itemTokenIds, 0)
          mstore(itemAmounts, 0)
        }
      }
    }

    uint256[] memory petTokenIds;
    if (petBaseIds.length != 0) {
      try _petNFT.mintBatch(from, petBaseIds, randomWords[0]) returns (uint256[] memory newPetTokenIds) {
        petTokenIds = newPetTokenIds;
      } catch {
        // If it fails, then it means it was sent to a contract which can not handle erc1155 or is malicious
      }
    }

    emit CompletedInstantVRFActions(from, playerId, uint256(requestId), itemTokenIds, itemAmounts, petTokenIds);
  }

  function getAction(uint16 actionId) external view returns (InstantVRFAction memory) {
    return _actions[actionId];
  }

  function getStrategy(InstantVRFActionType actionType) public view returns (IInstantVRFActionStrategy) {
    return _strategies[actionType];
  }

  function _getRewards(
    uint256 playerId,
    uint256[] calldata randomWords
  ) private view returns (uint256[] memory itemTokenIds, uint256[] memory itemAmounts, uint256[] memory petBaseIds) {
    uint16[10] storage playerActionInfos = _playerActionInfos[playerId].actionIdAmountPairs;
    uint256 playerActionInfoLength = playerActionInfos.length;
    uint8 maxActionAmount = _maxActionAmount;
    itemTokenIds = new uint256[](maxActionAmount);
    itemAmounts = new uint256[](maxActionAmount);
    petBaseIds = new uint256[](maxActionAmount);

    uint256 actualItemLength;
    uint256 actualPetLength;
    uint256 randomWordStartIndex;
    for (uint256 i; i < playerActionInfoLength / 2; ++i) {
      // Need to handle async nature if this action no longer exists by the time it is called
      uint256 actionId = playerActionInfos[i * 2];
      uint256 actionAmount = playerActionInfos[i * 2 + 1];
      if (actionId == 0 || !_actionExists(actionId)) {
        continue;
      }

      IInstantVRFActionStrategy strategy = getStrategy(_actions[actionId].actionType);
      (
        uint256[] memory producedItemTokenIds,
        uint256[] memory producedItemsAmounts,
        uint256[] memory producedPetBaseIds
      ) = IInstantVRFActionStrategy(strategy).getRandomRewards(
          actionId,
          actionAmount,
          randomWords,
          randomWordStartIndex
        );

      // Copy into main arrays
      for (uint256 j; j < producedItemTokenIds.length; ++j) {
        itemTokenIds[actualItemLength] = producedItemTokenIds[j];
        itemAmounts[actualItemLength++] = producedItemsAmounts[j];
      }
      for (uint256 j; j < producedPetBaseIds.length; ++j) {
        petBaseIds[actualPetLength++] = producedPetBaseIds[j];
      }

      randomWordStartIndex += actionAmount / 16 + (actionAmount % 16) == 0 ? 0 : 1;
    }

    assembly ("memory-safe") {
      mstore(itemTokenIds, actualItemLength)
      mstore(itemAmounts, actualItemLength)
      mstore(petBaseIds, actualPetLength)
    }
  }

  // Assumes that it has at least 1 input
  function _actionExists(uint256 actionId) private view returns (bool) {
    return _actions[actionId].inputTokenId1 != NONE;
  }

  function _setAction(InstantVRFActionInput calldata instantVRFActionInput) private {
    require(instantVRFActionInput.actionId != 0, ActionIdZeroNotAllowed());
    _checkInputs(instantVRFActionInput);
    _actions[instantVRFActionInput.actionId] = _packAction(instantVRFActionInput);

    _strategies[instantVRFActionInput.actionType].setAction(instantVRFActionInput);
  }

  function _requestRandomWords(uint256 numRandomWords, uint256 numActions) private returns (bytes32 requestId) {
    uint256 callbackGasLimit = CALLBACK_GAS_LIMIT_PER_ACTION * numActions;
    // Have both a minimum and maximum gas limit
    if (callbackGasLimit < 200_000) {
      callbackGasLimit = 200_000;
    } else if (callbackGasLimit > 5_000_000) {
      callbackGasLimit = 5_000_000;
    }

    requestId = _samWitchVRF.requestRandomWords(numRandomWords, callbackGasLimit);
  }

  function _isActionFullMode(uint256 actionId) private view returns (bool) {
    return uint8(_actions[actionId].packedData >> IS_FULL_MODE_BIT) & 1 == 1;
  }

  function _isActionAvailable(uint16 actionId) private view returns (bool) {
    return uint8(_actions[actionId].packedData >> IS_AVAILABLE_BIT) & 1 == 1;
  }

  function _packAction(
    InstantVRFActionInput calldata actionInput
  ) private pure returns (InstantVRFAction memory instantVRFAction) {
    bytes1 packedData = bytes1(uint8(actionInput.isFullModeOnly ? 1 << IS_FULL_MODE_BIT : 0));
    if (actionInput.isAvailable) {
      packedData |= bytes1(uint8(1 << IS_AVAILABLE_BIT));
    }
    instantVRFAction = InstantVRFAction({
      inputTokenId1: actionInput.inputTokenIds.length != 0 ? actionInput.inputTokenIds[0] : NONE,
      inputAmount1: actionInput.inputAmounts.length != 0 ? actionInput.inputAmounts[0] : 0,
      inputTokenId2: actionInput.inputTokenIds.length > 1 ? actionInput.inputTokenIds[1] : NONE,
      inputAmount2: actionInput.inputAmounts.length > 1 ? actionInput.inputAmounts[1] : 0,
      inputTokenId3: actionInput.inputTokenIds.length > 2 ? actionInput.inputTokenIds[2] : NONE,
      inputAmount3: actionInput.inputAmounts.length > 2 ? actionInput.inputAmounts[2] : 0,
      packedData: packedData,
      actionType: actionInput.actionType,
      questPrerequisiteId: actionInput.questPrerequisiteId
    });
  }

  // Assumes that it has at least 1 input
  function _actionExists(InstantVRFActionInput calldata actionInput) private view returns (bool) {
    return _actions[actionInput.actionId].inputTokenId1 != NONE;
  }

  function _checkInputs(InstantVRFActionInput calldata actionInput) private view {
    uint16[] calldata inputTokenIds = actionInput.inputTokenIds;
    uint24[] calldata amounts = actionInput.inputAmounts;

    require(inputTokenIds.length <= 3, TooManyInputItems());
    require(inputTokenIds.length == amounts.length, LengthMismatch());

    // Need at least 1 input
    require(inputTokenIds.length != 0, IncorrectInputAmounts());

    for (uint256 i; i < inputTokenIds.length; ++i) {
      require(inputTokenIds[i] != 0, InvalidInputTokenId());
      require(amounts[i] != 0, InputSpecifiedWithoutAmount());

      if (i != inputTokenIds.length - 1) {
        require(amounts[i] <= amounts[i + 1], InputAmountsMustBeInOrder());
        for (uint256 j; j < inputTokenIds.length; ++j) {
          require(j == i || inputTokenIds[i] != inputTokenIds[j], InputItemNoDuplicates());
        }
      }
    }

    require(address(_strategies[actionInput.actionType]) != address(0), InvalidStrategy());
  }

  function requestCost(uint256 actionAmounts) public view returns (uint256) {
    (uint64 movingAverageGasPrice, uint88 baseRequestCost) = _vrfRequestInfo.get();
    return baseRequestCost + (movingAverageGasPrice * actionAmounts * _gasCostPerUnit);
  }

  function addStrategies(
    InstantVRFActionType[] calldata instantVRFActionTypes,
    address[] calldata strategies
  ) public onlyOwner {
    require(instantVRFActionTypes.length == strategies.length, LengthMismatch());
    for (uint256 i; i < instantVRFActionTypes.length; ++i) {
      require(instantVRFActionTypes[i] != InstantVRFActionType.NONE && strategies[i] != address(0), InvalidStrategy());
      require(address(_strategies[instantVRFActionTypes[i]]) == address(0), StrategyAlreadyExists());

      _strategies[instantVRFActionTypes[i]] = IInstantVRFActionStrategy(strategies[i]);
    }
    emit AddStrategies(instantVRFActionTypes, strategies);
  }

  function addActions(InstantVRFActionInput[] calldata instantVRFActionInputs) external onlyOwner {
    for (uint256 i; i < instantVRFActionInputs.length; ++i) {
      InstantVRFActionInput calldata instantVRFActionInput = instantVRFActionInputs[i];
      require(!_actionExists(instantVRFActionInput), ActionAlreadyExists());
      _setAction(instantVRFActionInput);
    }
    emit AddInstantVRFActions(instantVRFActionInputs);
  }

  function editActions(InstantVRFActionInput[] calldata instantVRFActionInputs) external onlyOwner {
    for (uint256 i = 0; i < instantVRFActionInputs.length; ++i) {
      InstantVRFActionInput calldata instantVRFActionInput = instantVRFActionInputs[i];
      require(_actionExists(instantVRFActionInput), ActionDoesNotExist());
      _setAction(instantVRFActionInput);
    }
    emit EditInstantVRFActions(instantVRFActionInputs);
  }

  function removeActions(uint16[] calldata instantVRFActionIds) external onlyOwner {
    for (uint256 i = 0; i < instantVRFActionIds.length; ++i) {
      require(_actions[instantVRFActionIds[i]].inputTokenId1 != NONE, ActionDoesNotExist());
      delete _actions[instantVRFActionIds[i]];
    }
    emit RemoveInstantVRFActions(instantVRFActionIds);
  }

  function setGasCostPerUnit(uint64 gasCostPerUnit) public onlyOwner {
    _gasCostPerUnit = uint64(gasCostPerUnit);
    emit SetGasCostPerUnit(gasCostPerUnit);
  }

  function setPetNFT(PetNFT petNFT) external onlyOwner {
    _petNFT = petNFT;
  }

  function setMaxActionAmount(uint8 maxActionAmount) public onlyOwner {
    _maxActionAmount = maxActionAmount;
    emit SetMaxActionAmount(maxActionAmount);
  }

  // solhint-disable-next-line no-empty-blocks
  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
