// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {UnsafeMath, U256} from "@0xdoublesharp/unsafe-math/contracts/UnsafeMath.sol";
import {PlayersUpgradeableImplDummyBase, PlayersBase} from "./PlayersImplBase.sol";
import {PlayersLibrary} from "./PlayersLibrary.sol";

/* solhint-disable no-global-import */
import "../globals/players.sol";
import "../globals/items.sol";
import "../globals/actions.sol";
import "../globals/rewards.sol";

/* solhint-enable no-global-import */

contract PlayersImplRewards is PlayersUpgradeableImplDummyBase, PlayersBase, IPlayersRewardsDelegateView {
  using UnsafeMath for U256;
  using UnsafeMath for uint256;
  using UnsafeMath for uint40;

  constructor() {
    _checkStartSlot();
  }

  // Action rewards
  function getRewards(
    uint _playerId,
    uint40 _skillStartTime,
    uint _elapsedTime,
    uint16 _actionId
  ) public view returns (uint[] memory ids, uint[] memory amounts) {
    (ActionRewards memory actionRewards, Skill actionSkill, uint numSpawnedPerHour) = world.getRewardsHelper(_actionId);
    bool isCombat = actionSkill == Skill.COMBAT;

    ids = new uint[](MAX_REWARDS_PER_ACTION);
    amounts = new uint[](MAX_REWARDS_PER_ACTION);

    uint16 monstersKilled = uint16((numSpawnedPerHour * _elapsedTime) / 3600);
    uint8 successPercent = _getSuccessPercent(_playerId, _actionId, actionSkill, isCombat);

    uint length = _appendGuaranteedRewards(
      ids,
      amounts,
      _elapsedTime,
      actionRewards,
      monstersKilled,
      isCombat,
      successPercent
    );

    bool processedAny;
    (length, processedAny) = _appendRandomRewards(
      _playerId,
      _skillStartTime,
      _elapsedTime,
      isCombat ? monstersKilled : _elapsedTime / 3600,
      ids,
      amounts,
      length,
      actionRewards,
      successPercent
    );

    // Check for any boosts
    PlayerBoostInfo storage activeBoost = activeBoosts_[_playerId];
    uint boostedTime = PlayersLibrary.getBoostedTime(_skillStartTime, _elapsedTime, activeBoost);
    if (boostedTime != 0 && activeBoost.boostType == BoostType.GATHERING) {
      U256 bounds = length.asU256();
      for (U256 iter; iter < bounds; iter = iter.inc()) {
        uint i = iter.asUint256();
        amounts[i] += uint32((boostedTime * amounts[i] * activeBoost.val) / (3600 * 100));
      }
    }

    assembly ("memory-safe") {
      mstore(ids, length)
      mstore(amounts, length)
    }
  }

  function _getSuccessPercent(
    uint _playerId,
    uint16 _actionId,
    Skill _actionSkill,
    bool _isCombat
  ) private view returns (uint8 successPercent) {
    successPercent = 100;
    (uint8 actionSuccessPercent, uint32 minXP) = world.getActionSuccessPercentAndMinXP(_actionId);
    if (actionSuccessPercent != 100) {
      if (_isCombat) {
        revert InvalidAction();
      }

      uint minLevel = PlayersLibrary.getLevel(minXP);
      uint skillLevel = PlayersLibrary.getLevel(xp_[_playerId][_actionSkill]);
      uint extraBoost = skillLevel - minLevel;

      successPercent = uint8(PlayersLibrary.min(MAX_SUCCESS_PERCENT_CHANCE_, actionSuccessPercent + extraBoost));
    }
  }

  function _claimableRandomRewards(
    uint _playerId
  )
    private
    view
    returns (uint[] memory ids, uint[] memory amounts, uint[] memory actionIds, uint[] memory queueIds, uint numRemoved)
  {
    PendingRandomReward[] storage _pendingRandomRewards = pendingRandomRewards[_playerId];
    U256 pendingRandomRewardsLength = _pendingRandomRewards.length.asU256();
    ids = new uint[](pendingRandomRewardsLength.asUint256() * MAX_RANDOM_REWARDS_PER_ACTION);
    amounts = new uint[](pendingRandomRewardsLength.asUint256() * MAX_RANDOM_REWARDS_PER_ACTION);
    actionIds = new uint[](pendingRandomRewardsLength.asUint256() * MAX_RANDOM_REWARDS_PER_ACTION);
    queueIds = new uint[](pendingRandomRewardsLength.asUint256() * MAX_RANDOM_REWARDS_PER_ACTION);

    uint length;
    for (U256 iter; iter < pendingRandomRewardsLength; iter = iter.inc()) {
      uint i = iter.asUint256();
      PendingRandomReward storage pendingRandomReward = _pendingRandomRewards[i];
      (ActionRewards memory actionRewards, Skill actionSkill, uint numSpawnedPerHour) = world.getRewardsHelper(
        _pendingRandomRewards[i].actionId
      );
      bool isCombat = actionSkill == Skill.COMBAT;
      uint16 monstersKilled = uint16((numSpawnedPerHour * pendingRandomReward.elapsedTime) / 3600);
      uint8 successPercent = _getSuccessPercent(_playerId, pendingRandomReward.actionId, actionSkill, isCombat);
      uint oldLength = length;
      bool processedAny;
      (length, processedAny) = _appendRandomRewards(
        _playerId,
        pendingRandomReward.startTime,
        pendingRandomReward.elapsedTime,
        isCombat ? monstersKilled : pendingRandomReward.elapsedTime / 3600,
        ids,
        amounts,
        oldLength,
        actionRewards,
        successPercent
      );

      if (processedAny) {
        numRemoved = numRemoved.inc();
      }

      if (oldLength != length) {
        // Check for any boosts
        PlayerBoostInfo storage activeBoost = activeBoosts_[_playerId];
        uint boostedTime = PlayersLibrary.getBoostedTime(
          _pendingRandomRewards[i].startTime,
          _pendingRandomRewards[i].elapsedTime,
          activeBoost
        );
        U256 bounds = length.asU256();
        if (boostedTime != 0 && activeBoost.boostType == BoostType.GATHERING) {
          for (U256 jter; jter < bounds; jter = jter.inc()) {
            uint j = jter.asUint256();
            amounts[j] = uint32((boostedTime * amounts[j] * activeBoost.val) / (3600 * 100));
          }
        }
        for (U256 kter; kter < bounds; kter = kter.inc()) {
          uint k = kter.asUint256();
          queueIds[k] = pendingRandomReward.queueId;
          actionIds[k] = pendingRandomReward.actionId;
        }
      }
    }

    assembly ("memory-safe") {
      mstore(ids, length)
      mstore(amounts, length)
      mstore(actionIds, length)
      mstore(queueIds, length)
    }
  }

  function claimRandomRewards(uint _playerId) external {
    address from = msg.sender;
    (
      uint[] memory ids,
      uint[] memory amounts,
      uint[] memory actionIds,
      uint[] memory queueIds,
      uint numRemoved
    ) = _claimableRandomRewards(_playerId);
    if (numRemoved != 0) {
      // Shift the remaining rewards to the front of the array
      U256 bounds = pendingRandomRewards[_playerId].length.asU256().sub(numRemoved);
      for (U256 iter; iter < bounds; iter = iter.inc()) {
        uint i = iter.asUint256();
        pendingRandomRewards[_playerId][i] = pendingRandomRewards[_playerId][i + numRemoved];
      }
      for (U256 iter = numRemoved.asU256(); iter.neq(0); iter = iter.dec()) {
        pendingRandomRewards[_playerId].pop();
      }

      itemNFT.mintBatch(from, ids, amounts);
      emit PendingRandomRewardsClaimed(from, _playerId, numRemoved, ids, amounts, queueIds);
    }
  }

  // Get any changes that are pending and not commited to the blockchain yet.
  // Such as items consumed/produced, xp gained, whether the player died, pending random reward rolls & quest rewards.
  function pendingQueuedActionStateImpl(
    address _owner,
    uint _playerId
  ) external view returns (PendingQueuedActionState memory pendingQueuedActionState) {
    Player storage player = players_[_playerId];
    QueuedAction[] storage actionQueue = player.actionQueue;
    pendingQueuedActionState.equipmentStates = new PendingQueuedActionEquipmentState[](actionQueue.length);
    pendingQueuedActionState.actionMetadatas = new PendingQueuedActionMetadata[](actionQueue.length);

    pendingQueuedActionState.remainingSkills = new QueuedAction[](actionQueue.length);
    uint remainingSkillsLength;

    uint[] memory choiceIds = new uint[](actionQueue.length);
    uint[] memory choiceIdAmounts = new uint[](actionQueue.length);
    uint choiceIdsLength;
    uint choiceIdAmountsLength;

    address from = _owner;
    if (playerNFT.balanceOf(_owner, _playerId) == 0) {
      revert NotOwnerOfPlayer();
    }
    uint previousTotalXP = player.totalXP;
    uint totalXPGained;
    U256 bounds = actionQueue.length.asU256();
    uint pendingQueuedActionStateLength;
    uint startTime = players_[_playerId].queuedActionStartTime;
    for (U256 iter; iter < bounds; iter = iter.inc()) {
      uint i = iter.asUint256();
      PendingQueuedActionEquipmentState memory pendingQueuedActionEquipmentState = pendingQueuedActionState
        .equipmentStates[i];
      PendingQueuedActionMetadata memory pendingQueuedActionMetadata = pendingQueuedActionState.actionMetadatas[i];
      pendingQueuedActionEquipmentState.producedItemTokenIds = new uint[](
        MAX_REWARDS_PER_ACTION + MAX_RANDOM_REWARDS_PER_ACTION
      );
      pendingQueuedActionEquipmentState.producedAmounts = new uint[](
        MAX_REWARDS_PER_ACTION + MAX_RANDOM_REWARDS_PER_ACTION
      );
      uint producedLength;
      pendingQueuedActionEquipmentState.consumedItemTokenIds = new uint[](MAX_CONSUMED_PER_ACTION);
      pendingQueuedActionEquipmentState.consumedAmounts = new uint[](MAX_CONSUMED_PER_ACTION);
      uint consumedLength;

      QueuedAction storage queuedAction = actionQueue[i];
      CombatStats memory combatStats;
      bool isCombat = _isCombatStyle(queuedAction.combatStyle);
      if (isCombat) {
        // This will only ones that they have a balance for at this time. This will check balances
        combatStats = _getCachedCombatStats(player);
        _updateCombatStats(
          from,
          combatStats,
          attire_[_playerId][queuedAction.queueId],
          pendingQueuedActionState.equipmentStates
        );
      }

      bool missingRequiredHandEquipment = _updateStatsFromHandEquipment(
        from,
        [queuedAction.rightHandEquipmentTokenId, queuedAction.leftHandEquipmentTokenId],
        combatStats,
        isCombat,
        pendingQueuedActionState.equipmentStates
      );
      if (missingRequiredHandEquipment) {
        continue;
      }

      uint32 pointsAccrued;
      uint endTime = startTime + queuedAction.timespan;

      uint elapsedTime = _getElapsedTime(startTime, endTime);
      if (elapsedTime == 0) {
        _addRemainingSkill(
          pendingQueuedActionState.remainingSkills,
          queuedAction,
          queuedAction.timespan,
          remainingSkillsLength
        );
        remainingSkillsLength = remainingSkillsLength.inc();
        continue;
      }
      ++pendingQueuedActionStateLength;

      pendingQueuedActionMetadata.elapsedTime = uint24(elapsedTime);
      pendingQueuedActionMetadata.actionId = queuedAction.actionId;
      pendingQueuedActionMetadata.queueId = queuedAction.queueId;

      // Create some items if necessary (smithing ores to bars for instance)
      bool fullyFinished = elapsedTime >= queuedAction.timespan;
      bool died;
      (ActionRewards memory actionRewards, Skill actionSkill, uint numSpawnedPerHour) = world.getRewardsHelper(
        queuedAction.actionId
      );
      bool actionHasRandomRewards = actionRewards.randomRewardTokenId1 != NONE;
      ActionChoice memory actionChoice;
      uint xpElapsedTime = elapsedTime;
      uint refundTime;
      if (queuedAction.choiceId != 0) {
        actionChoice = world.getActionChoice(isCombat ? 0 : queuedAction.actionId, queuedAction.choiceId);

        Equipment[] memory consumedEquipment;
        Equipment memory outputEquipment;
        uint24 baseNumConsumed;
        uint24 numProduced;
        (
          consumedEquipment,
          outputEquipment,
          xpElapsedTime,
          refundTime,
          died,
          baseNumConsumed,
          numProduced
        ) = _processConsumablesView(
          from,
          _playerId,
          queuedAction,
          startTime,
          elapsedTime,
          combatStats,
          actionChoice,
          pendingQueuedActionState.equipmentStates
        );

        choiceIds[choiceIdsLength] = queuedAction.choiceId;
        choiceIdsLength = choiceIdsLength.inc();
        if (actionSkill == Skill.COOKING) {
          choiceIdAmounts[choiceIdAmountsLength] = numProduced; // Assume we want amount cooked
        } else {
          choiceIdAmounts[choiceIdAmountsLength] = baseNumConsumed;
        }
        choiceIdAmountsLength = choiceIdAmountsLength.inc();

        if (outputEquipment.itemTokenId != NONE) {
          pendingQueuedActionEquipmentState.producedItemTokenIds[producedLength] = outputEquipment.itemTokenId;
          pendingQueuedActionEquipmentState.producedAmounts[producedLength] = outputEquipment.amount;
          producedLength = producedLength.inc();
        }
        U256 consumedEquipmentLength = consumedEquipment.length.asU256();
        for (U256 jter; jter < consumedEquipmentLength; jter = jter.inc()) {
          uint j = jter.asUint256();
          pendingQueuedActionEquipmentState.consumedItemTokenIds[consumedLength] = consumedEquipment[j].itemTokenId;
          pendingQueuedActionEquipmentState.consumedAmounts[consumedLength] = consumedEquipment[j].amount;
          consumedLength = consumedLength.inc();
        }

        if (died) {
          pendingQueuedActionMetadata.died = true;
        }
      } else {
        bool hasGuaranteedRewards = actionRewards.guaranteedRewardTokenId1 != NONE;
        if (hasGuaranteedRewards) {
          uint numProduced = (elapsedTime * actionRewards.guaranteedRewardRate1) / (3600 * 10);
          refundTime = elapsedTime - (numProduced * (3600 * 10)) / actionRewards.guaranteedRewardRate1;
        }

        if (actionHasRandomRewards) {
          uint tempRefundTime = elapsedTime % 3600;
          if (tempRefundTime > refundTime) {
            refundTime = tempRefundTime;
          }
        }
        xpElapsedTime = xpElapsedTime > refundTime ? xpElapsedTime.sub(refundTime) : 0;
      }
      pendingQueuedActionMetadata.elapsedTime -= uint24(refundTime);
      pendingQueuedActionMetadata.xpElapsedTime = uint24(xpElapsedTime);

      uint pointsAccruedExclBaseBoost;
      Skill skill = _getSkillFromChoiceOrStyle(actionChoice, queuedAction.combatStyle, queuedAction.actionId);
      if (!died) {
        (pointsAccrued, pointsAccruedExclBaseBoost) = _getPointsAccrued(
          from,
          _playerId,
          queuedAction,
          startTime,
          skill,
          xpElapsedTime,
          pendingQueuedActionState.equipmentStates
        );
      }
      uint32 xpGained = pointsAccrued;

      bool hasCombatXP = pointsAccruedExclBaseBoost != 0 && _isCombatStyle(queuedAction.combatStyle);

      if (pointsAccrued != 0) {
        uint skillXPLength = hasCombatXP ? 2 : 1;
        pendingQueuedActionMetadata.skills = new Skill[](skillXPLength);
        pendingQueuedActionMetadata.xpGainedSkills = new uint32[](skillXPLength);
        if (pendingQueuedActionMetadata.skills.length > 0) {
          pendingQueuedActionMetadata.skills[0] = skill;
          pendingQueuedActionMetadata.xpGainedSkills[0] = pointsAccrued;
        }
        if (hasCombatXP) {
          pendingQueuedActionMetadata.skills[1] = Skill.HEALTH;
          pendingQueuedActionMetadata.xpGainedSkills[1] = _getHealthPointsFromCombat(
            _playerId,
            pointsAccruedExclBaseBoost
          );
        }
      }

      if (hasCombatXP) {
        xpGained += _getHealthPointsFromCombat(_playerId, pointsAccruedExclBaseBoost);
      }

      if (!fullyFinished) {
        // Add the remainder if this action is not fully consumed
        uint remainingTimespan = queuedAction.timespan - elapsedTime + refundTime;
        _addRemainingSkill(
          pendingQueuedActionState.remainingSkills,
          queuedAction,
          remainingTimespan,
          remainingSkillsLength
        );
        remainingSkillsLength = remainingSkillsLength.inc();
      }

      // Include loot
      (uint[] memory newIds, uint[] memory newAmounts) = getRewards(
        _playerId,
        uint40(startTime),
        xpElapsedTime,
        queuedAction.actionId
      );

      U256 newIdsLength = newIds.length.asU256();
      for (U256 jter; jter < newIdsLength; jter = jter.inc()) {
        uint j = jter.asUint256();
        pendingQueuedActionEquipmentState.producedItemTokenIds[producedLength] = newIds[j];
        pendingQueuedActionEquipmentState.producedAmounts[producedLength] = newAmounts[j];
        producedLength = producedLength.inc();
      }
      // Total XP gained
      pendingQueuedActionMetadata.xpGained = xpGained;
      totalXPGained += xpGained;

      // Number of pending reward rolls
      if (actionHasRandomRewards) {
        bool hasRandomWord = world.hasRandomWord(startTime + elapsedTime - refundTime);
        if (!hasRandomWord) {
          if (isCombat) {
            uint16 monstersKilled = uint16((numSpawnedPerHour * xpElapsedTime) / 3600);
            pendingQueuedActionMetadata.rolls = uint32(monstersKilled);
          } else {
            pendingQueuedActionMetadata.rolls = uint32(xpElapsedTime / 3600);
          }
        }
      }

      // Compact to fit the arrays
      assembly ("memory-safe") {
        mstore(mload(pendingQueuedActionEquipmentState), consumedLength)
        mstore(mload(add(pendingQueuedActionEquipmentState, 32)), consumedLength)
        mstore(mload(add(pendingQueuedActionEquipmentState, 64)), producedLength)
        mstore(mload(add(pendingQueuedActionEquipmentState, 96)), producedLength)
      }
      startTime += queuedAction.timespan;
    } // end of loop

    // XPRewards
    if (totalXPGained != 0) {
      (
        pendingQueuedActionState.xpRewardItemTokenIds,
        pendingQueuedActionState.xpRewardAmounts
      ) = _claimableXPThresholdRewards(previousTotalXP, previousTotalXP + totalXPGained);
    }

    // Past Random Rewards
    (
      uint[] memory ids,
      uint[] memory amounts,
      uint[] memory actionIds,
      uint[] memory queueIds,
      uint numRemoved
    ) = _claimableRandomRewards(_playerId);
    U256 idsLength = ids.length.asU256();
    pendingQueuedActionState.producedPastRandomRewards = new PastRandomRewardInfo[](ids.length);
    for (U256 iter; iter < idsLength; iter = iter.inc()) {
      uint i = iter.asUint256();
      pendingQueuedActionState.producedPastRandomRewards[i] = PastRandomRewardInfo(
        uint16(actionIds[i]),
        uint64(queueIds[i]),
        uint16(ids[i]),
        uint24(amounts[i]),
        numRemoved
      );
    }

    assembly ("memory-safe") {
      mstore(choiceIds, choiceIdsLength)
      mstore(choiceIdAmounts, choiceIdAmountsLength)
    }

    // Quest Rewards
    QuestState memory questState = pendingQueuedActionState.quests;
    (
      questState.rewardItemTokenIds,
      questState.rewardAmounts,
      questState.consumedItemTokenIds,
      questState.consumedAmounts,
      questState.skills,
      questState.xpGainedSkills,
      questState.questsCompleted,
      questState.activeQuestInfo
    ) = quests.processQuestsView(_playerId, choiceIds, choiceIdAmounts);

    questState.choiceIds = choiceIds;
    questState.choiceIdAmounts = choiceIdAmounts;

    // Daily rewards
    (
      pendingQueuedActionState.dailyRewardItemTokenIds,
      pendingQueuedActionState.dailyRewardAmounts,
      pendingQueuedActionState.dailyRewardMask
    ) = dailyRewardsView(_playerId);

    // Compact to fit the array
    assembly ("memory-safe") {
      mstore(mload(pendingQueuedActionState), pendingQueuedActionStateLength)
      mstore(mload(add(pendingQueuedActionState, 32)), pendingQueuedActionStateLength)
      mstore(mload(add(pendingQueuedActionState, 64)), remainingSkillsLength)
    }
  }

  function _addRemainingSkill(
    QueuedAction[] memory _remainingSkills,
    QueuedAction storage _queuedAction,
    uint _timespan,
    uint _length
  ) private pure {
    QueuedAction memory remainingAction = _queuedAction;
    remainingAction.timespan = uint24(_timespan);
    // Build a list of the skills queued that remain
    _remainingSkills[_length] = remainingAction;
  }

  function _appendGuaranteedReward(
    uint[] memory _ids,
    uint[] memory _amounts,
    uint _elapsedTime,
    uint16 _rewardTokenId,
    uint24 _rewardRate,
    uint _oldLength,
    uint16 _monstersKilled,
    bool _isCombat,
    uint8 _successPercent
  ) private pure returns (uint length) {
    length = _oldLength;
    if (_rewardTokenId != NONE) {
      uint numRewards;
      if (_isCombat) {
        numRewards = (_monstersKilled * _rewardRate) / 10; // rate is per kill
      } else {
        numRewards = (_elapsedTime.mul(_rewardRate).mul(_successPercent)).div(3600 * 10 * 100);
      }

      if (numRewards != 0) {
        _ids[length] = _rewardTokenId;
        _amounts[length] = numRewards;
        length = length.inc();
      }
    }
  }

  function _appendGuaranteedRewards(
    uint[] memory _ids,
    uint[] memory _amounts,
    uint _elapsedTime,
    ActionRewards memory _actionRewards,
    uint16 _monstersKilled,
    bool _isCombat,
    uint8 _successPercent
  ) private pure returns (uint length) {
    length = _appendGuaranteedReward(
      _ids,
      _amounts,
      _elapsedTime,
      _actionRewards.guaranteedRewardTokenId1,
      _actionRewards.guaranteedRewardRate1,
      length,
      _monstersKilled,
      _isCombat,
      _successPercent
    );
    length = _appendGuaranteedReward(
      _ids,
      _amounts,
      _elapsedTime,
      _actionRewards.guaranteedRewardTokenId2,
      _actionRewards.guaranteedRewardRate2,
      length,
      _monstersKilled,
      _isCombat,
      _successPercent
    );
    length = _appendGuaranteedReward(
      _ids,
      _amounts,
      _elapsedTime,
      _actionRewards.guaranteedRewardTokenId3,
      _actionRewards.guaranteedRewardRate3,
      length,
      _monstersKilled,
      _isCombat,
      _successPercent
    );
  }

  function _setupRandomRewards(
    ActionRewards memory _rewards
  ) private pure returns (RandomReward[] memory randomRewards) {
    randomRewards = new RandomReward[](4);
    uint randomRewardLength;
    if (_rewards.randomRewardTokenId1 != 0) {
      randomRewards[randomRewardLength] = RandomReward(
        _rewards.randomRewardTokenId1,
        _rewards.randomRewardChance1,
        _rewards.randomRewardAmount1
      );
      randomRewardLength = randomRewardLength.inc();
    }
    if (_rewards.randomRewardTokenId2 != 0) {
      randomRewards[randomRewardLength] = RandomReward(
        _rewards.randomRewardTokenId2,
        _rewards.randomRewardChance2,
        _rewards.randomRewardAmount2
      );
      randomRewardLength = randomRewardLength.inc();
    }
    if (_rewards.randomRewardTokenId3 != 0) {
      randomRewards[randomRewardLength] = RandomReward(
        _rewards.randomRewardTokenId3,
        _rewards.randomRewardChance3,
        _rewards.randomRewardAmount3
      );
      randomRewardLength = randomRewardLength.inc();
    }
    if (_rewards.randomRewardTokenId4 != 0) {
      randomRewards[randomRewardLength] = RandomReward(
        _rewards.randomRewardTokenId4,
        _rewards.randomRewardChance4,
        _rewards.randomRewardAmount4
      );
      randomRewardLength = randomRewardLength.inc();
    }

    assembly ("memory-safe") {
      mstore(randomRewards, randomRewardLength)
    }
  }

  function _getSlice(bytes memory _b, uint _index) private pure returns (uint16) {
    uint256 index = _index.mul(2);
    return uint16(_b[index] | (bytes2(_b[index.inc()]) >> 8));
  }

  // hasRandomWord means there was pending reward we tried to get a reward from
  function _appendRandomRewards(
    uint _playerId,
    uint40 _skillStartTime,
    uint _elapsedTime,
    uint _numTickets,
    uint[] memory _ids, // in-out
    uint[] memory _amounts, // in-out
    uint _oldLength,
    ActionRewards memory _actionRewards,
    uint8 _successPercent
  ) private view returns (uint length, bool hasRandomWord) {
    length = _oldLength;

    RandomReward[] memory _randomRewards = _setupRandomRewards(_actionRewards);

    if (_randomRewards.length != 0) {
      uint skillEndTime = _skillStartTime.add(_elapsedTime);
      hasRandomWord = world.hasRandomWord(skillEndTime);
      if (hasRandomWord) {
        uint numIterations = PlayersLibrary.min(MAX_UNIQUE_TICKETS_, _numTickets);

        bytes memory b = world.getRandomBytes(numIterations, skillEndTime, _playerId);
        uint startLootLength = length;
        for (U256 iter; iter.lt(numIterations); iter = iter.inc()) {
          uint i = iter.asUint256();
          uint mintMultiplier = 1;
          // If there is above 240 tickets we need to mint more if a ticket is hit
          if (_numTickets > MAX_UNIQUE_TICKETS_) {
            mintMultiplier = _numTickets / MAX_UNIQUE_TICKETS_;
            uint remainder = _numTickets % MAX_UNIQUE_TICKETS_;
            if (i < remainder) {
              mintMultiplier = mintMultiplier.inc();
            }
          }

          // The random component is out of 65535, so we can take 2 bytes at a time from the total bytes array
          uint operation = (uint(_getSlice(b, i)) * 100) / _successPercent;
          uint16 rand = uint16(PlayersLibrary.min(type(uint16).max, operation));

          U256 randomRewardsLength = _randomRewards.length.asU256();
          for (U256 iterJ; iterJ < randomRewardsLength; iterJ = iterJ.inc()) {
            uint j = iterJ.asUint256();

            RandomReward memory potentialReward = _randomRewards[j];
            if (rand <= potentialReward.chance) {
              // This random reward's chance was hit, so add it
              bool found;
              U256 idsLength = _ids.length.asU256();
              // Add this random item
              for (U256 iterK = startLootLength.asU256(); iterK < idsLength; iterK = iterK.inc()) {
                uint k = iterK.asUint256();
                if (k != 0 && potentialReward.itemTokenId == _ids[k.dec()]) {
                  // This item exists so accumulate it with the existing value
                  _amounts[k.dec()] += potentialReward.amount * mintMultiplier;
                  found = true;
                  break;
                }
              }

              if (!found) {
                // New item
                _ids[length] = potentialReward.itemTokenId;
                _amounts[length] = potentialReward.amount * mintMultiplier;
                length = length.inc();
              }
            } else {
              // A common one isn't found so a rarer one won't be.
              break;
            }
          }
        }
      }
    }
  }
}
