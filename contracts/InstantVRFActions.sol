// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {UUPSUpgradeable} from "./ozUpgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "./ozUpgradeable/access/OwnableUpgradeable.sol";

import {ISamWitchVRF} from "./interfaces/ISamWitchVRF.sol";
import {IInstantVRFActionStrategy} from "./InstantVRFActionStrategies/IInstantVRFActionStrategy.sol";
import {ItemNFT} from "./ItemNFT.sol";
import {PetNFT} from "./PetNFT.sol";
import {Players} from "./Players/Players.sol";
import {VRFRequestInfo} from "./VRFRequestInfo.sol";

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
  event SetAvailableActions(uint256[] actionIds, bool isAvailable); // TODO: Combine this with InstantVRFActionsInput later

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
  error NotEnoughFTM();
  error TransferFailed();
  error NotDoingAnyActions();
  error InvalidStrategy();
  error StrategyAlreadyExists();

  struct PlayerActionInfo {
    uint16[10] actionIdAmountPairs; // actionId, amount
  }

  struct InstantVRFAction {
    // Storage slot 1
    uint16 inputTokenId1;
    uint8 inputAmount1;
    uint16 inputTokenId2;
    uint8 inputAmount2;
    uint16 inputTokenId3;
    uint24 inputAmount3;
    bytes1 packedData; // worldLocation first bit, second bit isAvailable, last bit isFullModeOnly
    address strategy;
    // No free slots
  }

  struct Player {
    address owner;
    uint64 playerId;
  }

  ItemNFT private itemNFT;
  Players private players;
  mapping(uint256 playerId => PlayerActionInfo) private playerActionInfos;
  mapping(uint256 actionId => InstantVRFAction action) public actions;
  mapping(bytes32 requestId => Player player) private requestIdToPlayer;
  mapping(InstantVRFActionType actionType => address strategy) public strategies;

  VRFRequestInfo private vrfRequestInfo;
  uint64 public gasCostPerUnit;

  address private oracle;
  ISamWitchVRF private samWitchVRF;
  PetNFT private petNFT;

  uint256 public constant MAX_ACTION_AMOUNT = 64;
  uint256 private constant CALLBACK_GAS_LIMIT_PER_ACTION = 120_000;
  uint256 private constant MAX_INPUTS_PER_ACTION = 3; // This needs to be the max across all strategies

  modifier isOwnerOfPlayerAndActive(uint256 _playerId) {
    if (!players.isOwnerOfPlayerAndActive(msg.sender, _playerId)) {
      revert NotOwnerOfPlayerAndActive();
    }
    _;
  }

  /// @dev Reverts if the caller is not the SamWitchVRF contract.
  modifier onlySamWitchVRF() {
    if (msg.sender != address(samWitchVRF)) {
      revert CallerNotSamWitchVRF();
    }
    _;
  }

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(
    Players _players,
    ItemNFT _itemNFT,
    PetNFT _petNFT,
    address _oracle,
    ISamWitchVRF _samWitchVRF,
    VRFRequestInfo _vrfRequestInfo
  ) external initializer {
    __UUPSUpgradeable_init();
    __Ownable_init();
    players = _players;
    itemNFT = _itemNFT;
    petNFT = _petNFT;
    oracle = _oracle;
    samWitchVRF = _samWitchVRF;
    vrfRequestInfo = _vrfRequestInfo;
    setGasCostPerUnit(15_000);
  }

  function doInstantVRFActions(
    uint256 _playerId,
    uint16[] calldata _actionIds,
    uint256[] calldata _actionAmounts
  ) external payable isOwnerOfPlayerAndActive(_playerId) {
    if (_actionIds.length != _actionAmounts.length) {
      revert LengthMismatch();
    }

    if (_actionIds.length > 5) {
      revert TooManyInputItems();
    }

    if (playerActionInfos[_playerId].actionIdAmountPairs[0] != 0) {
      revert AlreadyProcessing();
    }

    if (_actionIds.length == 0) {
      revert NotDoingAnyActions();
    }

    bool isPlayerUpgraded = players.isPlayerUpgraded(_playerId);
    uint256 totalAmount;
    uint256 numRandomWords;
    for (uint256 i; i < _actionIds.length; ++i) {
      uint16 actionId = _actionIds[i];
      if (!_actionExists(actionId)) {
        revert ActionDoesNotExist();
      }
      if (!_isActionAvailable(actionId)) {
        revert ActionNotAvailable();
      }
      if (!isPlayerUpgraded && _isActionFullMode(actionId)) {
        revert PlayerNotUpgraded();
      }
      playerActionInfos[_playerId].actionIdAmountPairs[i * 2] = actionId;
      playerActionInfos[_playerId].actionIdAmountPairs[i * 2 + 1] = uint16(_actionAmounts[i]);
      totalAmount += _actionAmounts[i];
      numRandomWords += _actionAmounts[i] / 16 + ((_actionAmounts[i] % 16) == 0 ? 0 : 1);
    }

    // Mainly to keep response gas costs down
    if (totalAmount > MAX_ACTION_AMOUNT) {
      revert TooManyActionAmounts();
    }

    // Check they are paying enough
    if (msg.value < requestCost(totalAmount)) {
      revert NotEnoughFTM();
    }

    (bool success, ) = oracle.call{value: msg.value}("");
    if (!success) {
      revert TransferFailed();
    }

    bytes32 requestId = _requestRandomWords(numRandomWords, totalAmount);
    requestIdToPlayer[requestId] = Player({owner: msg.sender, playerId: uint64(_playerId)});

    // Get the tokenIds to burn
    uint256[] memory consumedItemTokenIds = new uint256[](_actionIds.length * MAX_INPUTS_PER_ACTION);
    uint256[] memory consumedAmounts = new uint256[](_actionIds.length * MAX_INPUTS_PER_ACTION);
    uint256 actualLength;
    for (uint256 i = 0; i < _actionIds.length; ++i) {
      InstantVRFAction storage instantVRFAction = actions[_actionIds[i]];
      if (instantVRFAction.inputTokenId1 != NONE) {
        consumedItemTokenIds[actualLength] = instantVRFAction.inputTokenId1;
        consumedAmounts[actualLength] = instantVRFAction.inputAmount1 * _actionAmounts[i];
        ++actualLength;
      }
      if (instantVRFAction.inputTokenId2 != NONE) {
        consumedItemTokenIds[actualLength] = instantVRFAction.inputTokenId2;
        consumedAmounts[actualLength] = instantVRFAction.inputAmount2 * _actionAmounts[i];
        ++actualLength;
      }
      if (instantVRFAction.inputTokenId3 != NONE) {
        consumedItemTokenIds[actualLength] = instantVRFAction.inputTokenId3;
        consumedAmounts[actualLength] = instantVRFAction.inputAmount3 * _actionAmounts[i];
        ++actualLength;
      }
    }

    assembly ("memory-safe") {
      mstore(consumedItemTokenIds, actualLength)
      mstore(consumedAmounts, actualLength)
    }

    itemNFT.burnBatch(msg.sender, consumedItemTokenIds, consumedAmounts);
    emit DoInstantVRFActions(
      msg.sender,
      _playerId,
      uint256(requestId),
      _actionIds,
      _actionAmounts,
      consumedItemTokenIds,
      consumedAmounts
    );
  }

  function fulfillRandomWords(bytes32 _requestId, uint256[] calldata _randomWords) external onlySamWitchVRF {
    uint256 playerId = requestIdToPlayer[_requestId].playerId;
    address from = requestIdToPlayer[_requestId].owner; // Might not be actual owner due to async nature so don't rely on that

    if (from == address(0)) {
      revert RequestDoesNotExist();
    }

    (
      uint256[] memory itemTokenIds,
      uint256[] memory itemAmounts,
      uint256[] memory petBaseIds,
      uint256[] memory randomWords
    ) = _getRewards(playerId, _randomWords);

    vrfRequestInfo.updateAverageGasPrice();

    delete playerActionInfos[playerId]; // Allows another request to be made
    delete requestIdToPlayer[_requestId]; // Not strictly necessary

    if (itemTokenIds.length != 0) {
      try itemNFT.mintBatch(from, itemTokenIds, itemAmounts) {} catch {
        // If it fails, then it means it was sent to a contract which can not handle erc1155 or is malicious
        assembly ("memory-safe") {
          mstore(itemTokenIds, 0)
          mstore(itemAmounts, 0)
        }
      }
    }

    uint256[] memory petTokenIds;
    if (petBaseIds.length != 0) {
      try petNFT.mintBatch(from, petBaseIds, randomWords) returns (uint256[] memory newPetTokenIds) {
        petTokenIds = newPetTokenIds;
      } catch {
        // If it fails, then it means it was sent to a contract which can not handle erc1155 or is malicious
      }
    }

    emit CompletedInstantVRFActions(from, playerId, uint256(_requestId), itemTokenIds, itemAmounts, petTokenIds);
  }

  function _getRewards(
    uint256 _playerId,
    uint256[] calldata _randomWords
  )
    private
    view
    returns (
      uint256[] memory itemTokenIds,
      uint256[] memory itemAmounts,
      uint256[] memory petBaseIds,
      uint256[] memory petRandomWords
    )
  {
    uint16[10] storage _playerActionInfos = playerActionInfos[_playerId].actionIdAmountPairs;
    uint256 playerActionInfoLength = _playerActionInfos.length;
    itemTokenIds = new uint256[](MAX_ACTION_AMOUNT);
    itemAmounts = new uint256[](MAX_ACTION_AMOUNT);
    petBaseIds = new uint256[](MAX_ACTION_AMOUNT);
    petRandomWords = new uint256[](MAX_ACTION_AMOUNT);

    uint256 actualItemLength;
    uint256 actualPetLength;
    uint256 randomWordStartIndex;
    for (uint256 i; i < playerActionInfoLength / 2; ++i) {
      // Need to handle async nature if this action no longer exists by the time it is called
      uint256 actionId = _playerActionInfos[i * 2];
      uint256 actionAmount = _playerActionInfos[i * 2 + 1];
      if (actionId == 0 || !_actionExists(actionId)) {
        continue;
      }
      (
        uint256[] memory producedItemTokenIds,
        uint256[] memory producedItemsAmounts,
        uint256[] memory producedPetBaseIds,
        uint256[] memory producedPetRandomWords
      ) = IInstantVRFActionStrategy(actions[actionId].strategy).getRandomRewards(
          actionId,
          actionAmount,
          _randomWords,
          randomWordStartIndex
        );

      // Copy into main arrays
      for (uint256 j; j < producedItemTokenIds.length; ++j) {
        itemTokenIds[actualItemLength] = producedItemTokenIds[j];
        itemAmounts[actualItemLength++] = producedItemsAmounts[j];
      }
      for (uint256 j; j < producedPetBaseIds.length; ++j) {
        petBaseIds[actualPetLength] = producedPetBaseIds[j];
        petRandomWords[actualPetLength++] = producedPetRandomWords[j];
      }

      randomWordStartIndex += actionAmount / 16 + (actionAmount % 16) == 0 ? 0 : 1;
    }

    assembly ("memory-safe") {
      mstore(itemTokenIds, actualItemLength)
      mstore(itemAmounts, actualItemLength)
      mstore(petBaseIds, actualPetLength)
      mstore(petRandomWords, actualPetLength)
    }
  }

  // Assumes that it has at least 1 input
  function _actionExists(uint256 _actionId) private view returns (bool) {
    return actions[_actionId].inputTokenId1 != NONE;
  }

  function _setAction(InstantVRFActionInput calldata _instantVRFActionInput) private {
    if (_instantVRFActionInput.actionId == 0) {
      revert ActionIdZeroNotAllowed();
    }
    _checkInputs(_instantVRFActionInput);
    actions[_instantVRFActionInput.actionId] = _packAction(_instantVRFActionInput);

    IInstantVRFActionStrategy(strategies[_instantVRFActionInput.actionType]).setAction(_instantVRFActionInput);
  }

  function _requestRandomWords(uint256 numRandomWords, uint256 numActions) private returns (bytes32 requestId) {
    uint256 callbackGasLimit = CALLBACK_GAS_LIMIT_PER_ACTION * numActions;
    // Have both a minimum and maximum gas limit
    if (callbackGasLimit < 200_000) {
      callbackGasLimit = 200_000;
    } else if (callbackGasLimit > 5_000_000) {
      callbackGasLimit = 5_000_000;
    }

    requestId = samWitchVRF.requestRandomWords(numRandomWords, callbackGasLimit);
  }

  function _isActionFullMode(uint256 _actionId) private view returns (bool) {
    return uint8(actions[_actionId].packedData >> IS_FULL_MODE_BIT) & 1 == 1;
  }

  function _isActionAvailable(uint16 _actionId) private view returns (bool) {
    return uint8(actions[_actionId].packedData >> IS_AVAILABLE_BIT) & 1 == 1;
  }

  function _packAction(
    InstantVRFActionInput calldata _actionInput
  ) private view returns (InstantVRFAction memory instantVRFAction) {
    bytes1 packedData = bytes1(uint8(_actionInput.isFullModeOnly ? 1 << IS_FULL_MODE_BIT : 0));
    packedData |= bytes1(uint8(1 << IS_AVAILABLE_BIT));
    instantVRFAction = InstantVRFAction({
      inputTokenId1: _actionInput.inputTokenIds.length > 0 ? _actionInput.inputTokenIds[0] : NONE,
      inputAmount1: _actionInput.inputAmounts.length > 0 ? uint8(_actionInput.inputAmounts[0]) : 0,
      inputTokenId2: _actionInput.inputTokenIds.length > 1 ? _actionInput.inputTokenIds[1] : NONE,
      inputAmount2: _actionInput.inputAmounts.length > 1 ? uint8(_actionInput.inputAmounts[1]) : 0,
      inputTokenId3: _actionInput.inputTokenIds.length > 2 ? _actionInput.inputTokenIds[2] : NONE,
      inputAmount3: _actionInput.inputAmounts.length > 2 ? _actionInput.inputAmounts[2] : 0,
      packedData: packedData,
      strategy: strategies[_actionInput.actionType]
    });
  }

  // Assumes that it has at least 1 input
  function _actionExists(InstantVRFActionInput calldata _actionInput) private view returns (bool) {
    return actions[_actionInput.actionId].inputTokenId1 != NONE;
  }

  function _checkInputs(InstantVRFActionInput calldata _actionInput) private view {
    uint16[] calldata inputTokenIds = _actionInput.inputTokenIds;
    uint24[] calldata amounts = _actionInput.inputAmounts;

    if (inputTokenIds.length > 3) {
      revert TooManyInputItems();
    }
    if (inputTokenIds.length != amounts.length) {
      revert LengthMismatch();
    }

    // Need at least 1 input
    if (inputTokenIds.length == 0) {
      revert IncorrectInputAmounts();
    }

    for (uint256 i; i < inputTokenIds.length; ++i) {
      if (inputTokenIds[i] == 0) {
        revert InvalidInputTokenId();
      }
      if (amounts[i] == 0) {
        revert InputSpecifiedWithoutAmount();
      }

      if (i != inputTokenIds.length - 1) {
        if (amounts[i] > amounts[i + 1]) {
          revert InputAmountsMustBeInOrder();
        }
        for (uint256 j; j < inputTokenIds.length; ++j) {
          if (j != i && inputTokenIds[i] == inputTokenIds[j]) {
            revert InputItemNoDuplicates();
          }
        }
      }
    }

    if (strategies[_actionInput.actionType] == address(0)) {
      revert InvalidStrategy();
    }
  }

  function requestCost(uint256 _actionAmounts) public view returns (uint256) {
    (uint64 movingAverageGasPrice, uint88 baseRequestCost) = vrfRequestInfo.get();
    return baseRequestCost + (movingAverageGasPrice * _actionAmounts * gasCostPerUnit);
  }

  function addStrategies(
    InstantVRFActionType[] calldata _instantVRFActionTypes,
    address[] calldata _strategies
  ) public onlyOwner {
    if (_instantVRFActionTypes.length != _strategies.length) {
      revert LengthMismatch();
    }
    for (uint256 i; i < _instantVRFActionTypes.length; ++i) {
      if (_instantVRFActionTypes[i] == InstantVRFActionType.NONE || _strategies[i] == address(0)) {
        revert InvalidStrategy();
      }

      if (strategies[_instantVRFActionTypes[i]] != address(0)) {
        revert StrategyAlreadyExists();
      }

      strategies[_instantVRFActionTypes[i]] = _strategies[i];
    }
    emit AddStrategies(_instantVRFActionTypes, _strategies);
  }

  function addActions(InstantVRFActionInput[] calldata _instantVRFActionInputs) external onlyOwner {
    for (uint256 i; i < _instantVRFActionInputs.length; ++i) {
      InstantVRFActionInput calldata instantVRFActionInput = _instantVRFActionInputs[i];
      if (_actionExists(instantVRFActionInput)) {
        revert ActionAlreadyExists();
      }
      _setAction(instantVRFActionInput);
    }
    emit AddInstantVRFActions(_instantVRFActionInputs);
  }

  function editActions(InstantVRFActionInput[] calldata _instantVRFActionInputs) external onlyOwner {
    for (uint256 i = 0; i < _instantVRFActionInputs.length; ++i) {
      InstantVRFActionInput calldata instantVRFActionInput = _instantVRFActionInputs[i];
      if (!_actionExists(instantVRFActionInput)) {
        revert ActionDoesNotExist();
      }
      _setAction(instantVRFActionInput);
    }
    emit EditInstantVRFActions(_instantVRFActionInputs);
  }

  function removeActions(uint16[] calldata _instantVRFActionIds) external onlyOwner {
    for (uint256 i = 0; i < _instantVRFActionIds.length; ++i) {
      if (actions[_instantVRFActionIds[i]].inputTokenId1 == NONE) {
        revert ActionDoesNotExist();
      }
      delete actions[_instantVRFActionIds[i]];
    }
    emit RemoveInstantVRFActions(_instantVRFActionIds);
  }

  function setGasCostPerUnit(uint256 _gasCostPerUnit) public onlyOwner {
    gasCostPerUnit = uint64(_gasCostPerUnit);
    emit SetGasCostPerUnit(_gasCostPerUnit);
  }

  function setPetNFT(PetNFT _petNFT) external onlyOwner {
    petNFT = _petNFT;
  }

  function setAvailable(uint256[] calldata _actionIds, bool _isAvailable) external onlyOwner {
    for (uint16 i; i < _actionIds.length; ++i) {
      bytes1 packedData = actions[_actionIds[i]].packedData;
      bytes1 mask = bytes1(uint8(1 << IS_AVAILABLE_BIT));
      if (_isAvailable) {
        packedData |= mask;
      } else {
        packedData &= ~mask;
      }

      actions[_actionIds[i]].packedData = packedData;
    }
    emit SetAvailableActions(_actionIds, _isAvailable);
  }

  // solhint-disable-next-line no-empty-blocks
  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
