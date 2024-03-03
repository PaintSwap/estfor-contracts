// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {UUPSUpgradeable} from "./ozUpgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "./ozUpgradeable/access/OwnableUpgradeable.sol";

import {ISamWitchVRF} from "./interfaces/ISamWitchVRF.sol";

import {ItemNFT} from "./ItemNFT.sol";
import {Players} from "./Players/Players.sol";
import {VRFRequestInfo} from "./VRFRequestInfo.sol";

import {EquipPosition, IS_FULL_MODE_BIT} from "./globals/players.sol";
import {NONE} from "./globals/items.sol";

import "./debug/console.sol";

contract InstantVRFActions is UUPSUpgradeable, OwnableUpgradeable {
  event AddInstantVRFActions(InstantVRFActionInput[] instantVRFActionInputs);
  event EditInstantVRFActions(InstantVRFActionInput[] instantVRFActionInputs);
  event RemoveInstantVRFActions(uint16[] actionIds);
  event SetGasCostPerUnit(uint gasCostPerUnit);
  event DoInstantVRFActions(
    address from,
    uint playerId,
    uint requestId,
    uint16[] actionIds,
    uint[] amounts,
    uint[] consumedItemTokenIds,
    uint[] consumedAmounts
  );
  event CompletedInstantVRFActions(
    address from,
    uint playerId,
    uint requestId,
    uint[] producedItemTokenIds,
    uint[] producedAmounts
  );

  error ActionIdZeroNotAllowed();
  error ActionDoesNotExist();
  error ActionAlreadyExists();
  error IncorrectInputAmounts();
  error InputSpecifiedWithoutAmount();
  error InputAmountsMustBeInOrder();
  error InvalidInputTokenId();
  error InputItemNoDuplicates();
  error TooManyInputItems();
  error TooManyRandomRewards();
  error RandomRewardSpecifiedWithoutTokenId();
  error RandomRewardSpecifiedWithoutChance();
  error RandomRewardSpecifiedWithoutAmount();
  error RandomRewardChanceMustBeInOrder();
  error RandomRewardItemNoDuplicates();
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

  struct PlayerActionInfo {
    uint16[10] actionIdAmountPairs; // actionId, amount
  }

  struct RandomReward {
    uint16 itemTokenId;
    uint16 chance; // out of 65535
    uint16 amount; // out of 65535
  }

  struct InstantVRFActionInput {
    uint16 actionId;
    uint16[] inputTokenIds;
    uint16[] inputAmounts;
    RandomReward[] randomRewards;
    bool isFullModeOnly;
  }

  struct InstantVRFAction {
    // Storage slot 1
    uint16 inputTokenId1;
    uint16 inputAmount1;
    uint16 inputTokenId2;
    uint16 inputAmount2;
    uint16 inputTokenId3;
    uint16 inputAmount3;
    bytes1 packedData; // last bit is full mode only
    uint152 reserved;
    // Storage slot 2
    uint16[15] randomRewardInfo; // Can have up to 5 different random reward tokens. Order is tokenId, chance, amount etc
  }

  struct Player {
    address owner;
    uint64 playerId;
  }

  ItemNFT private itemNFT;
  Players private players;
  mapping(uint playerId => PlayerActionInfo) private playerActionInfos;
  mapping(uint actionId => InstantVRFAction hashAction) public actions;
  mapping(bytes32 requestId => Player player) private requestIdToPlayer;

  VRFRequestInfo private vrfRequestInfo;
  uint64 public gasCostPerUnit;

  address private oracle;
  ISamWitchVRF private samWitchVRF;

  uint private constant MAX_RANDOM_REWARDS_PER_ACTION = 1;
  uint public constant MAX_ACTION_AMOUNT = 96;
  uint private constant CALLBACK_GAS_LIMIT = 2_000_000;
  uint private constant MAX_INPUTS_PER_ACTION = 3;

  modifier isOwnerOfPlayerAndActive(uint _playerId) {
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
    address _oracle,
    ISamWitchVRF _samWitchVRF,
    VRFRequestInfo _vrfRequestInfo
  ) external initializer {
    __UUPSUpgradeable_init();
    __Ownable_init();
    players = _players;
    itemNFT = _itemNFT;
    oracle = _oracle;
    samWitchVRF = _samWitchVRF;
    vrfRequestInfo = _vrfRequestInfo;
    setGasCostPerUnit(25_000);
  }

  function doInstantVRFActions(
    uint _playerId,
    uint16[] calldata _actionIds,
    uint[] calldata _actionAmounts
  ) external payable isOwnerOfPlayerAndActive(_playerId) {
    console.log("sdfdfs");

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
    uint totalAmount;
    uint numRandomWords;
    for (uint i; i < _actionIds.length; ++i) {
      if (!_actionExists(_actionIds[i])) {
        revert ActionDoesNotExist();
      }
      if (!isPlayerUpgraded && _isActionFullMode(_actionIds[i])) {
        revert PlayerNotUpgraded();
      }
      playerActionInfos[_playerId].actionIdAmountPairs[i * 2] = _actionIds[i];
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

    bytes32 requestId = _requestRandomWords(numRandomWords);
    requestIdToPlayer[requestId] = Player({owner: msg.sender, playerId: uint64(_playerId)});

    // Get the tokenIds to burn
    uint[] memory consumedItemTokenIds = new uint[](_actionIds.length * MAX_INPUTS_PER_ACTION);
    uint[] memory consumedAmounts = new uint[](_actionIds.length * MAX_INPUTS_PER_ACTION);
    uint actualLength;
    for (uint i = 0; i < _actionIds.length; ++i) {
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
      uint(requestId),
      _actionIds,
      _actionAmounts,
      consumedItemTokenIds,
      consumedAmounts
    );
  }

  function fulfillRandomWords(bytes32 _requestId, uint[] calldata _randomWords) external onlySamWitchVRF {
    uint playerId = requestIdToPlayer[_requestId].playerId;
    address from = requestIdToPlayer[_requestId].owner; // Might not be actual owner due to async nature so don't rely on that

    if (from == address(0)) {
      revert RequestDoesNotExist();
    }

    (uint[] memory producedItemTokenIds, uint[] memory producedAmounts) = _getRewards(playerId, _randomWords);

    vrfRequestInfo.updateAverageGasPrice();

    delete playerActionInfos[playerId]; // Allows another request to be made
    delete requestIdToPlayer[_requestId]; // Not strictly necessary

    if (producedItemTokenIds.length != 0) {
      itemNFT.mintBatch(from, producedItemTokenIds, producedAmounts);
    }

    emit CompletedInstantVRFActions(from, playerId, uint(_requestId), producedItemTokenIds, producedAmounts);
  }

  function _getRewards(
    uint _playerId,
    uint[] calldata _randomWords
  ) private view returns (uint[] memory tokenIds, uint[] memory amounts) {
    uint16[10] storage _playerActionInfos = playerActionInfos[_playerId].actionIdAmountPairs;
    uint playerActionInfoLength = _playerActionInfos.length;
    tokenIds = new uint[](MAX_ACTION_AMOUNT * MAX_RANDOM_REWARDS_PER_ACTION); // Assumes only 1 reward per action
    amounts = new uint[](MAX_ACTION_AMOUNT * MAX_RANDOM_REWARDS_PER_ACTION);

    uint actualLength;
    uint randomWordStartIndex;
    for (uint i; i < playerActionInfoLength / 2; ++i) {
      // Need to handle async nature if this action no longer exists by the time it is called
      uint actionId = _playerActionInfos[i * 2];
      uint actionAmount = _playerActionInfos[i * 2 + 1];
      if (actionId == 0 || !_actionExists(actionId)) {
        continue;
      }

      uint[] memory randomIds;
      uint[] memory randomAmounts;
      (randomIds, randomAmounts) = _getRandomRewards(actionId, actionAmount, _randomWords, randomWordStartIndex);

      if (randomIds.length != 0) {
        // Copy into main arrays
        for (uint j = 0; j < randomIds.length; ++j) {
          tokenIds[actualLength] = randomIds[j];
          amounts[actualLength] = randomAmounts[j];
          ++actualLength;
        }
      }

      randomWordStartIndex += actionAmount / 16 + (actionAmount % 16) == 0 ? 0 : 1;
    }

    assembly ("memory-safe") {
      mstore(tokenIds, actualLength)
      mstore(amounts, actualLength)
    }
  }

  function _getRandomRewards(
    uint _actionId,
    uint _actionAmount,
    uint[] calldata _randomWords,
    uint _randomWordStartIndex
  ) private view returns (uint[] memory ids, uint[] memory amounts) {
    ids = new uint[](MAX_RANDOM_REWARDS_PER_ACTION * _actionAmount);
    amounts = new uint[](MAX_RANDOM_REWARDS_PER_ACTION * _actionAmount);
    uint actualLength;
    RandomReward[] memory randomRewards = _setupRandomRewards(_actionId);
    if (randomRewards.length != 0) {
      bytes memory randomBytes = abi.encodePacked(_randomWords[_randomWordStartIndex:]);
      // The first set has an increased mint multiplier as the tickets spill over
      for (uint i; i < _actionAmount; ++i) {
        uint16 rand = _getSlice(randomBytes, i);

        RandomReward memory randomReward;
        for (uint j; j < randomRewards.length; ++j) {
          if (rand > randomRewards[j].chance) {
            break;
          }
          randomReward = randomRewards[j];
        }

        // This random reward's chance was hit, so add it to the hits
        ids[actualLength] = randomReward.itemTokenId;
        amounts[actualLength] = randomReward.amount;
        ++actualLength;
      }
    }
    assembly ("memory-safe") {
      mstore(ids, actualLength)
      mstore(amounts, actualLength)
    }
  }

  function _setupRandomRewards(uint _actionId) private view returns (RandomReward[] memory randomRewards) {
    InstantVRFAction storage action = actions[_actionId];

    randomRewards = new RandomReward[](action.randomRewardInfo.length / 3);
    uint randomRewardLength;
    for (uint i; i < action.randomRewardInfo.length / 3; ++i) {
      if (action.randomRewardInfo[i * 3] == 0) {
        break;
      }
      randomRewards[randomRewardLength] = RandomReward(
        action.randomRewardInfo[i * 3],
        action.randomRewardInfo[i * 3 + 1],
        action.randomRewardInfo[i * 3 + 2]
      );
      ++randomRewardLength;
    }

    assembly ("memory-safe") {
      mstore(randomRewards, randomRewardLength)
    }
  }

  function _getSlice(bytes memory _b, uint _index) private pure returns (uint16) {
    uint256 index = _index * 2;
    return uint16(_b[index] | (bytes2(_b[index + 1]) >> 8));
  }

  // Assumes that it has at least 1 input
  function _actionExists(uint _actionId) private view returns (bool) {
    return actions[_actionId].inputTokenId1 != NONE;
  }

  function _setAction(InstantVRFActionInput calldata _instantVRFActionInput) private {
    if (_instantVRFActionInput.actionId == 0) {
      revert ActionIdZeroNotAllowed();
    }
    _checkInputs(_instantVRFActionInput);
    actions[_instantVRFActionInput.actionId] = _packAction(_instantVRFActionInput);
  }

  function _requestRandomWords(uint numRandomWords) private returns (bytes32 requestId) {
    requestId = samWitchVRF.requestRandomWords(numRandomWords, CALLBACK_GAS_LIMIT);
  }

  function _isActionFullMode(uint _actionId) private view returns (bool) {
    return uint8(actions[_actionId].packedData >> IS_FULL_MODE_BIT) == 1;
  }

  function _packAction(
    InstantVRFActionInput calldata _actionInput
  ) private pure returns (InstantVRFAction memory instantVRFAction) {
    bytes1 packedData = bytes1(uint8(_actionInput.isFullModeOnly ? 1 << IS_FULL_MODE_BIT : 0));
    instantVRFAction = InstantVRFAction({
      inputTokenId1: _actionInput.inputTokenIds.length > 0 ? _actionInput.inputTokenIds[0] : NONE,
      inputAmount1: _actionInput.inputAmounts.length > 0 ? _actionInput.inputAmounts[0] : 0,
      inputTokenId2: _actionInput.inputTokenIds.length > 1 ? _actionInput.inputTokenIds[1] : NONE,
      inputAmount2: _actionInput.inputAmounts.length > 1 ? _actionInput.inputAmounts[1] : 0,
      inputTokenId3: _actionInput.inputTokenIds.length > 2 ? _actionInput.inputTokenIds[2] : NONE,
      inputAmount3: _actionInput.inputAmounts.length > 2 ? _actionInput.inputAmounts[2] : 0,
      packedData: packedData,
      reserved: 0,
      randomRewardInfo: [
        _actionInput.randomRewards.length > 0 ? _actionInput.randomRewards[0].itemTokenId : NONE,
        _actionInput.randomRewards.length > 0 ? _actionInput.randomRewards[0].chance : 0,
        _actionInput.randomRewards.length > 0 ? _actionInput.randomRewards[0].amount : 0,
        _actionInput.randomRewards.length > 1 ? _actionInput.randomRewards[1].itemTokenId : NONE,
        _actionInput.randomRewards.length > 1 ? _actionInput.randomRewards[1].chance : 0,
        _actionInput.randomRewards.length > 1 ? _actionInput.randomRewards[1].amount : 0,
        _actionInput.randomRewards.length > 2 ? _actionInput.randomRewards[2].itemTokenId : NONE,
        _actionInput.randomRewards.length > 2 ? _actionInput.randomRewards[2].chance : 0,
        _actionInput.randomRewards.length > 2 ? _actionInput.randomRewards[2].amount : 0,
        _actionInput.randomRewards.length > 3 ? _actionInput.randomRewards[3].itemTokenId : NONE,
        _actionInput.randomRewards.length > 3 ? _actionInput.randomRewards[3].chance : 0,
        _actionInput.randomRewards.length > 3 ? _actionInput.randomRewards[3].amount : 0,
        _actionInput.randomRewards.length > 4 ? _actionInput.randomRewards[4].itemTokenId : NONE,
        _actionInput.randomRewards.length > 4 ? _actionInput.randomRewards[4].chance : 0,
        _actionInput.randomRewards.length > 4 ? _actionInput.randomRewards[4].amount : 0
      ]
    });
  }

  // Assumes that it has at least 1 input
  function _actionExists(InstantVRFActionInput calldata _actionInput) private view returns (bool) {
    return actions[_actionInput.actionId].inputTokenId1 != NONE;
  }

  function _checkInputs(InstantVRFActionInput calldata _actionInput) private pure {
    uint16[] calldata inputTokenIds = _actionInput.inputTokenIds;
    uint16[] calldata amounts = _actionInput.inputAmounts;

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

    for (uint i; i < inputTokenIds.length; ++i) {
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
        for (uint j; j < inputTokenIds.length; ++j) {
          if (j != i && inputTokenIds[i] == inputTokenIds[j]) {
            revert InputItemNoDuplicates();
          }
        }
      }
    }
    // Check random rewards are correct
    if (_actionInput.randomRewards.length > 5) {
      revert TooManyRandomRewards();
    }

    for (uint i; i < _actionInput.randomRewards.length; ++i) {
      if (_actionInput.randomRewards[i].itemTokenId == 0) {
        revert RandomRewardSpecifiedWithoutTokenId();
      }
      if (_actionInput.randomRewards[i].chance == 0) {
        revert RandomRewardSpecifiedWithoutChance();
      }
      if (_actionInput.randomRewards[i].amount == 0) {
        revert RandomRewardSpecifiedWithoutAmount();
      }

      if (i != _actionInput.randomRewards.length - 1) {
        if (_actionInput.randomRewards[i].chance <= _actionInput.randomRewards[i + 1].chance) {
          revert RandomRewardChanceMustBeInOrder();
        }
        for (uint j; j < _actionInput.randomRewards.length; ++j) {
          if (j != i && _actionInput.randomRewards[i].itemTokenId == _actionInput.randomRewards[j].itemTokenId) {
            revert RandomRewardItemNoDuplicates();
          }
        }
      }
    }
  }

  function requestCost(uint _actionAmounts) public view returns (uint) {
    (uint64 movingAverageGasPrice, uint88 baseRequestCost) = vrfRequestInfo.get();
    return baseRequestCost + (movingAverageGasPrice * _actionAmounts * gasCostPerUnit);
  }

  function addActions(InstantVRFActionInput[] calldata _instantVRFActionInputs) external onlyOwner {
    for (uint i; i < _instantVRFActionInputs.length; ++i) {
      InstantVRFActionInput calldata instantVRFActionInput = _instantVRFActionInputs[i];
      if (_actionExists(instantVRFActionInput)) {
        revert ActionAlreadyExists();
      }
      _setAction(instantVRFActionInput);
    }
    emit AddInstantVRFActions(_instantVRFActionInputs);
  }

  function editActions(InstantVRFActionInput[] calldata _instantVRFActionInputs) external onlyOwner {
    for (uint i = 0; i < _instantVRFActionInputs.length; ++i) {
      InstantVRFActionInput calldata instantVRFActionInput = _instantVRFActionInputs[i];
      if (!_actionExists(instantVRFActionInput)) {
        revert ActionDoesNotExist();
      }
      _setAction(instantVRFActionInput);
    }
    emit EditInstantVRFActions(_instantVRFActionInputs);
  }

  function removeActions(uint16[] calldata _instantVRFActionIds) external onlyOwner {
    for (uint i = 0; i < _instantVRFActionIds.length; ++i) {
      if (actions[_instantVRFActionIds[i]].inputTokenId1 == NONE) {
        revert ActionDoesNotExist();
      }
      delete actions[_instantVRFActionIds[i]];
    }
    emit RemoveInstantVRFActions(_instantVRFActionIds);
  }

  function setGasCostPerUnit(uint _gasCostPerUnit) public onlyOwner {
    gasCostPerUnit = uint64(_gasCostPerUnit);
    emit SetGasCostPerUnit(_gasCostPerUnit);
  }

  // solhint-disable-next-line no-empty-blocks
  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
