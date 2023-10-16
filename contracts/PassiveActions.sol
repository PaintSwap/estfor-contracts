// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC1155Holder} from "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {UUPSUpgradeable} from "./ozUpgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "./ozUpgradeable/access/OwnableUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "./ozUpgradeable/security/ReentrancyGuardUpgradeable.sol";

import {IPlayers} from "./interfaces/IPlayers.sol";
import {ItemNFT} from "./ItemNFT.sol";
import {World} from "./World.sol";

import {WorldLibrary} from "./WorldLibrary.sol";

// solhint-disable-next-line no-global-import
import "./globals/all.sol";

// Stake some items which get burnt and get something else in return for waiting a certain time. All or nothing.
// Supports skipping a day based on random chance & random items in Passive Actions
contract PassiveActions is UUPSUpgradeable, OwnableUpgradeable, ReentrancyGuardUpgradeable, ERC1155Holder {
  using Math for uint256;

  event AddPassiveActions(PassiveActionInput[] passiveActionInputs);
  event EditPassiveActions(PassiveActionInput[] passiveActionInputs);
  event StartPassiveAction(uint playerId, address from, uint actionId, uint queueId, uint16 boostItemTokenId);
  event EarlyEndPassiveAction(uint playerId, address from, uint queueId);
  event ClaimPassiveAction(
    uint playerId,
    address from,
    uint queueId,
    uint[] itemTokenIds,
    uint[] amounts,
    bool startingAnother
  );

  error NotOwnerOfPlayerAndActive();
  error NotPassiveVial();
  error InvalidActionId();
  error ActionAlreadyExists(uint16 actionId);
  error ActionDoesNotExist();
  error ActionIdZeroNotAllowed();
  error DurationCannotBeZero();
  error DurationTooLong();
  error PlayerNotUpgraded();
  error MinimumXPNotReached(Skill minSkill, uint minXP);
  error InputSpecifiedWithoutAmount();
  error InputAmountsMustBeInOrder();
  error PreviousInputTokenIdMustBeSpecified();
  error PreviousMinSkillMustBeSpecified();
  error MinXPsMustBeInOrder();
  error ActionAlreadyFinished();
  error NoActivePassiveAction();
  error PassiveActionNotReadyToBeClaimed();
  error PreviousActionNotFinished();

  struct PassiveActionInput {
    uint16 actionId;
    PassiveActionInfoInput info;
    GuaranteedReward[] guaranteedRewards;
    RandomReward[] randomRewards;
  }

  struct PassiveActionInfoInput {
    uint8 durationDays;
    uint16 inputTokenId1;
    uint16 inputAmount1;
    uint16 inputTokenId2;
    uint16 inputAmount2;
    uint16 inputTokenId3;
    uint16 inputAmount3;
    Skill minSkill1;
    uint32 minXP1;
    Skill minSkill2;
    uint32 minXP2;
    Skill minSkill3;
    uint32 minXP3;
    uint8 skipSuccessPercent; // 0-100 (% chance of skipping a day)
    uint8 worldLocation; // 0 is the main starting world
    bool isFullModeOnly;
  }

  struct PassiveAction {
    uint8 durationDays; // Up to 64 days
    uint16 inputTokenId1;
    uint16 inputAmount1;
    uint16 inputTokenId2;
    uint16 inputAmount2;
    uint16 inputTokenId3;
    uint16 inputAmount3;
    Skill minSkill1;
    uint32 minXP1;
    Skill minSkill2;
    uint32 minXP2;
    Skill minSkill3;
    uint32 minXP3;
    uint8 skipSuccessPercent;
    bytes1 packedData; // worldLocation first bit, last bit isFullModeOnly
  }

  struct PendingPassiveActionState {
    uint[] producedItemTokenIds;
    uint[] producedAmounts;
    uint[] producedRandomRewardItemTokenIds; // Oracle loot
    uint[] producedRandomRewardAmounts;
    uint numDaysSkipped;
    bool skippedToday;
    bool isReady;
  }

  struct ActivePassiveInfo {
    uint16 actionId;
    uint96 queueId;
    uint40 startTime;
    uint16 boostItemTokenId;
  }

  IPlayers public players;
  ItemNFT public itemNFT;
  World public world;
  uint80 lastQueueId;
  mapping(uint actionId => PassiveAction action) public actions;
  mapping(uint actionId => ActionRewards) private actionRewards;
  mapping(uint playerId => ActivePassiveInfo activePassiveInfo) private activePassiveActions;

  uint constant IS_FULL_MODE_BIT = 7;

  modifier isOwnerOfPlayerAndActive(uint _playerId) {
    if (!players.isOwnerOfPlayerAndActive(msg.sender, _playerId)) {
      revert NotOwnerOfPlayerAndActive();
    }
    _;
  }

  function initialize(IPlayers _players, ItemNFT _itemNFT, World _world) external initializer {
    __UUPSUpgradeable_init();
    __Ownable_init();
    __ReentrancyGuard_init();
    players = _players;
    itemNFT = _itemNFT;
    world = _world;
    lastQueueId = 1;
  }

  function startAction(
    uint _playerId,
    uint16 _actionId,
    uint16 _boostItemTokenId
  ) external isOwnerOfPlayerAndActive(_playerId) {
    // Has one already started?
    if (activePassiveActions[_playerId].actionId != NONE) {
      (bool finished, , , ) = finishedInfo(_playerId);
      if (finished) {
        _claim(_playerId, activePassiveActions[_playerId].queueId, true);
      } else {
        revert PreviousActionNotFinished();
      }
    }

    PassiveAction storage action = actions[_actionId];
    if (action.durationDays == 0) {
      revert InvalidActionId();
    }

    _checkMinXPRequirements(_playerId, _actionId);

    if (_isActionFullMode(_actionId) && !players.isPlayerUpgraded(_playerId)) {
      revert PlayerNotUpgraded();
    }

    if (_boostItemTokenId != NONE) {
      Item memory item = itemNFT.getItem(_boostItemTokenId);
      if (item.equipPosition != EquipPosition.PASSIVE_BOOST_VIAL) {
        revert NotPassiveVial();
      }
    }

    uint96 queueId = lastQueueId++;
    activePassiveActions[_playerId] = ActivePassiveInfo({
      actionId: _actionId,
      queueId: queueId,
      startTime: uint40(block.timestamp),
      boostItemTokenId: _boostItemTokenId
    });

    _burnInputs(action, _boostItemTokenId);

    emit StartPassiveAction(_playerId, msg.sender, _actionId, queueId, _boostItemTokenId);
  }

  function claim(uint _playerId) external isOwnerOfPlayerAndActive(_playerId) nonReentrant {
    uint queueId = activePassiveActions[_playerId].queueId;
    if (queueId == NONE) {
      revert NoActivePassiveAction();
    }
    (bool finished, bool oracleReady, , ) = finishedInfo(_playerId);
    if (!finished || !oracleReady) {
      revert PassiveActionNotReadyToBeClaimed();
    }

    _claim(_playerId, queueId, false);
    delete activePassiveActions[_playerId];
  }

  function endEarly(uint _playerId) external isOwnerOfPlayerAndActive(_playerId) {
    uint queueId = activePassiveActions[_playerId].queueId;
    if (queueId == NONE) {
      revert NoActivePassiveAction();
    }

    (bool finished, , , ) = finishedInfo(_playerId);
    if (finished) {
      revert ActionAlreadyFinished();
    }

    delete activePassiveActions[_playerId];
    emit EarlyEndPassiveAction(_playerId, msg.sender, queueId);
  }

  // Get current state of the passive action
  function pendingPassiveActionState(
    uint _playerId
  ) public view returns (PendingPassiveActionState memory _pendingPassiveActionState) {
    // If it's not finished then you get nothing
    (bool finished, bool oracleCalled, uint numWinners, bool skippedToday) = finishedInfo(_playerId);
    _pendingPassiveActionState.isReady = finished && oracleCalled;
    _pendingPassiveActionState.numDaysSkipped = numWinners;
    _pendingPassiveActionState.skippedToday = skippedToday;
    if (!finished) {
      return _pendingPassiveActionState;
    }

    ActivePassiveInfo storage passiveAction = activePassiveActions[_playerId];
    PassiveAction memory action = actions[passiveAction.actionId];

    uint numIterations = action.durationDays;
    ActionRewards storage _actionRewards = actionRewards[passiveAction.actionId];

    // Add guaranteed rewards
    uint guaranteedRewardLength = _actionRewards.guaranteedRewardTokenId3 != NONE
      ? 3
      : _actionRewards.guaranteedRewardTokenId2 != NONE
      ? 2
      : _actionRewards.guaranteedRewardTokenId1 != NONE
      ? 1
      : 0;

    _pendingPassiveActionState.producedItemTokenIds = new uint[](guaranteedRewardLength);
    _pendingPassiveActionState.producedAmounts = new uint[](guaranteedRewardLength);
    if (_actionRewards.guaranteedRewardTokenId1 != NONE) {
      _pendingPassiveActionState.producedItemTokenIds[0] = _actionRewards.guaranteedRewardTokenId1;
      _pendingPassiveActionState.producedAmounts[0] = _actionRewards.guaranteedRewardRate1;
    }
    if (_actionRewards.guaranteedRewardTokenId2 != NONE) {
      _pendingPassiveActionState.producedItemTokenIds[1] = _actionRewards.guaranteedRewardTokenId2;
      _pendingPassiveActionState.producedAmounts[1] = _actionRewards.guaranteedRewardRate2;
    }
    if (_actionRewards.guaranteedRewardTokenId3 != NONE) {
      _pendingPassiveActionState.producedItemTokenIds[2] = _actionRewards.guaranteedRewardTokenId3;
      _pendingPassiveActionState.producedAmounts[2] = _actionRewards.guaranteedRewardRate3;
    }

    // Add random rewards
    if (oracleCalled) {
      RandomReward[] memory randomRewards = _setupRandomRewards(_actionRewards);
      uint endTime = passiveAction.startTime + (action.durationDays - numWinners) * 1 days - 1 days;
      bytes memory randomBytes = world.getRandomBytes(numIterations, endTime, _playerId);

      _pendingPassiveActionState.producedRandomRewardItemTokenIds = new uint[](randomRewards.length);
      _pendingPassiveActionState.producedRandomRewardAmounts = new uint[](randomRewards.length);

      uint length;
      for (uint i; i < numIterations; ++i) {
        uint operation = uint(_getSlice(randomBytes, i));
        uint16 rand = uint16(Math.min(type(uint16).max, operation));
        for (uint j; j < randomRewards.length; ++j) {
          RandomReward memory randomReward = randomRewards[j];
          if (rand <= randomReward.chance) {
            // This random reward's chance was hit, so add it to the hits
            _pendingPassiveActionState.producedRandomRewardItemTokenIds[j] = randomReward.itemTokenId;
            _pendingPassiveActionState.producedRandomRewardAmounts[j] += randomReward.amount;
            length = Math.max(length, j + 1);
          } else {
            // A common one isn't found so a rarer one won't be.
            break;
          }
        }
      }

      uint[] memory ids = _pendingPassiveActionState.producedRandomRewardItemTokenIds;
      uint[] memory amounts = _pendingPassiveActionState.producedRandomRewardAmounts;
      assembly ("memory-safe") {
        mstore(ids, length)
        mstore(amounts, length)
      }
    }
  }

  function _checkMinXPRequirements(uint _playerId, uint _actionId) private view {
    PassiveAction storage action = actions[_actionId];
    if (action.minSkill1 != Skill.NONE && players.xp(_playerId, action.minSkill1) < action.minXP1) {
      revert MinimumXPNotReached(action.minSkill1, action.minXP1);
    }

    if (action.minSkill2 != Skill.NONE && players.xp(_playerId, action.minSkill2) < action.minXP2) {
      revert MinimumXPNotReached(action.minSkill2, action.minXP2);
    }

    if (action.minSkill3 != Skill.NONE && players.xp(_playerId, action.minSkill3) < action.minXP3) {
      revert MinimumXPNotReached(action.minSkill3, action.minXP3);
    }
  }

  // Action must be finished as a precondition
  function _claim(uint _playerId, uint _queueId, bool _startingAnother) private {
    PendingPassiveActionState memory _pendingPassiveActionState = pendingPassiveActionState(_playerId);
    uint numItemsToMint = _pendingPassiveActionState.producedItemTokenIds.length +
      _pendingPassiveActionState.producedRandomRewardItemTokenIds.length;
    uint[] memory itemTokenIds = new uint[](numItemsToMint);
    uint[] memory amounts = new uint[](numItemsToMint);
    for (uint i; i < _pendingPassiveActionState.producedItemTokenIds.length; ++i) {
      itemTokenIds[i] = _pendingPassiveActionState.producedItemTokenIds[i];
      amounts[i] = _pendingPassiveActionState.producedAmounts[i];
    }

    for (uint i; i < _pendingPassiveActionState.producedRandomRewardItemTokenIds.length; ++i) {
      itemTokenIds[i + _pendingPassiveActionState.producedItemTokenIds.length] = _pendingPassiveActionState
        .producedRandomRewardItemTokenIds[i];
      amounts[i + _pendingPassiveActionState.producedItemTokenIds.length] = _pendingPassiveActionState
        .producedRandomRewardAmounts[i];
    }
    if (numItemsToMint > 0) {
      itemNFT.mintBatch(msg.sender, itemTokenIds, amounts);
    }
    emit ClaimPassiveAction(_playerId, msg.sender, _queueId, itemTokenIds, amounts, _startingAnother);
  }

  function _getSlice(bytes memory _b, uint _index) private pure returns (uint16) {
    uint256 index = _index * 2;
    return uint16(_b[index] | (bytes2(_b[index + 1]) >> 8));
  }

  function _isWinner(
    uint _playerId,
    uint _timestamp,
    uint16 _boostIncrease,
    uint8 _skipSuccessPercent
  ) private view returns (bool winner) {
    bytes memory randomBytes = world.getRandomBytes(1, _timestamp, _playerId);
    uint16 word = _getSlice(randomBytes, 0);
    return word < ((type(uint16).max * (uint(_skipSuccessPercent) + _boostIncrease)) / 100);
  }

  /// @param _playerId The player id
  /// @return finished If the action has finished
  /// @return oracleCalled If the oracle has been called for the previous day of the finished passive action
  /// @return numWinners The number of winners
  function finishedInfo(
    uint _playerId
  ) public view returns (bool finished, bool oracleCalled, uint numWinners, bool skippedToday) {
    // Check random reward results which may lower the time remaining (e.g. oracle speed boost)
    ActivePassiveInfo storage passiveAction = activePassiveActions[_playerId];
    if (passiveAction.actionId == NONE) {
      return (false, false, 0, false);
    }

    PassiveAction storage action = actions[passiveAction.actionId];
    uint duration = action.durationDays * 1 days;

    uint startTime = activePassiveActions[_playerId].startTime;
    uint timespan = Math.min(duration, (block.timestamp - startTime));
    uint numDays = timespan / 1 days;

    for (uint timestamp = startTime; timestamp < startTime + numDays * 1 days; timestamp += 1 days) {
      uint16 boostIncrease;
      if (passiveAction.boostItemTokenId != NONE) {
        boostIncrease = itemNFT.getItem(passiveAction.boostItemTokenId).boostValue;
      }

      oracleCalled = world.hasRandomWord(timestamp);

      if (oracleCalled && _isWinner(_playerId, timestamp, boostIncrease, action.skipSuccessPercent)) {
        ++numWinners;

        // Is this yesterday's oracle?
        if (timestamp / 1 days == (block.timestamp / 1 days - 1)) {
          // This is the last day, so we can return
          skippedToday = true;
        }
      }
      if ((startTime + duration - numWinners * 1 days <= block.timestamp)) {
        finished = true;
        // Actually check if it has the random word
        if (timestamp != startTime + duration - numWinners * 1 days - 1 days) {
          oracleCalled = world.hasRandomWord(startTime + duration - numWinners * 1 days - 1 days);
        }
        break;
      }
    }
  }

  function _burnInputs(PassiveAction storage action, uint16 _boostItemTokenId) private {
    if (action.inputTokenId1 == NONE && _boostItemTokenId == NONE) {
      // There is nothing to burn
      return;
    }

    uint inputTokenLength = action.inputTokenId2 == NONE ? 1 : (action.inputTokenId3 == NONE ? 2 : 3);
    uint arrLength = inputTokenLength;
    if (_boostItemTokenId != NONE) {
      ++arrLength;
    }
    uint[] memory itemTokenIds = new uint[](arrLength);
    uint[] memory amounts = new uint[](arrLength);

    itemTokenIds[0] = action.inputTokenId1;
    amounts[0] = action.inputAmount1;
    if (inputTokenLength > 1) {
      itemTokenIds[1] = action.inputTokenId2;
      amounts[1] = action.inputAmount2;
    }
    if (inputTokenLength > 2) {
      itemTokenIds[2] = action.inputTokenId3;
      amounts[2] = action.inputAmount3;
    }

    if (_boostItemTokenId != NONE) {
      itemTokenIds[arrLength - 1] = _boostItemTokenId;
      amounts[arrLength - 1] = 1;
    }

    // Burn it all
    itemNFT.burnBatch(msg.sender, itemTokenIds, amounts);
  }

  function _setupRandomRewards(
    ActionRewards memory _rewards
  ) private pure returns (RandomReward[] memory randomRewards) {
    randomRewards = new RandomReward[](4);
    uint randomRewardLength;
    if (_rewards.randomRewardTokenId1 != 0) {
      randomRewards[randomRewardLength++] = RandomReward(
        _rewards.randomRewardTokenId1,
        _rewards.randomRewardChance1,
        _rewards.randomRewardAmount1
      );
    }
    if (_rewards.randomRewardTokenId2 != 0) {
      randomRewards[randomRewardLength++] = RandomReward(
        _rewards.randomRewardTokenId2,
        _rewards.randomRewardChance2,
        _rewards.randomRewardAmount2
      );
    }
    if (_rewards.randomRewardTokenId3 != 0) {
      randomRewards[randomRewardLength++] = RandomReward(
        _rewards.randomRewardTokenId3,
        _rewards.randomRewardChance3,
        _rewards.randomRewardAmount3
      );
    }
    if (_rewards.randomRewardTokenId4 != 0) {
      randomRewards[randomRewardLength++] = RandomReward(
        _rewards.randomRewardTokenId4,
        _rewards.randomRewardChance4,
        _rewards.randomRewardAmount4
      );
    }

    assembly ("memory-safe") {
      mstore(randomRewards, randomRewardLength)
    }
  }

  function _isActionFullMode(uint16 _actionId) private view returns (bool) {
    return uint8(actions[_actionId].packedData >> IS_FULL_MODE_BIT) == 1;
  }

  function _packAction(
    PassiveActionInfoInput calldata _actionInfo
  ) private pure returns (PassiveAction memory passiveAction) {
    bytes1 packedData = bytes1(uint8(_actionInfo.isFullModeOnly ? 1 << IS_FULL_MODE_BIT : 0));
    passiveAction = PassiveAction({
      durationDays: _actionInfo.durationDays,
      inputTokenId1: _actionInfo.inputTokenId1,
      inputAmount1: _actionInfo.inputAmount1,
      inputTokenId2: _actionInfo.inputTokenId2,
      inputAmount2: _actionInfo.inputAmount2,
      inputTokenId3: _actionInfo.inputTokenId3,
      inputAmount3: _actionInfo.inputAmount3,
      minSkill1: _actionInfo.minSkill1,
      minXP1: _actionInfo.minXP1,
      minSkill2: _actionInfo.minSkill2,
      minXP2: _actionInfo.minXP2,
      minSkill3: _actionInfo.minSkill3,
      minXP3: _actionInfo.minXP3,
      skipSuccessPercent: _actionInfo.skipSuccessPercent,
      packedData: packedData
    });
  }

  function _setAction(PassiveActionInput calldata _passiveActionInput) private {
    if (_passiveActionInput.actionId == 0) {
      revert ActionIdZeroNotAllowed();
    }
    PassiveActionInfoInput calldata actionInfo = _passiveActionInput.info;
    if (_passiveActionInput.info.durationDays == 0) {
      revert DurationCannotBeZero();
    }
    if (_passiveActionInput.info.durationDays > MAX_UNIQUE_TICKETS_) {
      revert DurationTooLong();
    }

    _checkInfo(actionInfo);
    actions[_passiveActionInput.actionId] = _packAction(_passiveActionInput.info);

    // Set the rewards
    ActionRewards storage actionReward = actionRewards[_passiveActionInput.actionId];
    delete actionRewards[_passiveActionInput.actionId];
    WorldLibrary.setActionGuaranteedRewards(_passiveActionInput.guaranteedRewards, actionReward);
    WorldLibrary.setActionRandomRewards(_passiveActionInput.randomRewards, actionReward);
  }

  function _checkInfo(PassiveActionInfoInput calldata _actionInfo) private pure {
    // Check inputs are correct
    if (_actionInfo.inputTokenId1 != NONE && _actionInfo.inputAmount1 == 0) {
      revert InputSpecifiedWithoutAmount();
    }
    if (_actionInfo.inputTokenId2 != NONE) {
      if (_actionInfo.inputAmount2 == 0) {
        revert InputSpecifiedWithoutAmount();
      }
      if (_actionInfo.inputTokenId1 == NONE) {
        revert PreviousInputTokenIdMustBeSpecified();
      }
      if (_actionInfo.inputAmount2 < _actionInfo.inputAmount1) {
        revert InputAmountsMustBeInOrder();
      }
    }
    if (_actionInfo.inputTokenId3 != NONE) {
      if (_actionInfo.inputAmount3 == 0) {
        revert InputSpecifiedWithoutAmount();
      }
      if (_actionInfo.inputTokenId2 == NONE) {
        revert PreviousInputTokenIdMustBeSpecified();
      }
      if (_actionInfo.inputAmount3 < _actionInfo.inputAmount2) {
        revert InputAmountsMustBeInOrder();
      }
    }

    // Check min xp is correct
    if (_actionInfo.minSkill1 != Skill.NONE && _actionInfo.minXP1 == 0) {
      revert InputSpecifiedWithoutAmount();
    }
    if (_actionInfo.minSkill2 != Skill.NONE) {
      if (_actionInfo.minXP2 == 0) {
        revert InputSpecifiedWithoutAmount();
      }
      if (_actionInfo.minSkill1 == Skill.NONE) {
        revert PreviousMinSkillMustBeSpecified();
      }
      if (_actionInfo.minXP2 > _actionInfo.minXP1) {
        revert MinXPsMustBeInOrder();
      }
    }
    if (_actionInfo.minSkill3 != Skill.NONE) {
      if (_actionInfo.minXP3 == 0) {
        revert InputSpecifiedWithoutAmount();
      }
      if (_actionInfo.minSkill2 == Skill.NONE) {
        revert PreviousMinSkillMustBeSpecified();
      }
      if (_actionInfo.minXP3 > _actionInfo.minXP2) {
        revert MinXPsMustBeInOrder();
      }
    }
  }

  function addActions(PassiveActionInput[] calldata _passiveActionInputs) external onlyOwner {
    for (uint i; i < _passiveActionInputs.length; ++i) {
      if (actions[_passiveActionInputs[i].actionId].durationDays != 0) {
        revert ActionAlreadyExists(_passiveActionInputs[i].actionId);
      }
      _setAction(_passiveActionInputs[i]);
    }
    emit AddPassiveActions(_passiveActionInputs);
  }

  function editActions(PassiveActionInput[] calldata _passiveActionInputs) external onlyOwner {
    for (uint i = 0; i < _passiveActionInputs.length; ++i) {
      if (actions[_passiveActionInputs[i].actionId].durationDays == 0) {
        revert ActionDoesNotExist();
      }
      _setAction(_passiveActionInputs[i]);
    }
    emit EditPassiveActions(_passiveActionInputs);
  }

  // solhint-disable-next-line no-empty-blocks
  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
