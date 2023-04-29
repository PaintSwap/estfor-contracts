// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {UnsafeMath, U256} from "@0xdoublesharp/unsafe-math/contracts/UnsafeMath.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
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
  using UnsafeMath for uint24;

  constructor() {
    _checkStartSlot();
  }

  // Get any changes that are pending and not commited to the blockchain yet.
  // Such as items consumed/produced, xp gained, whether the player died, pending random reward rolls & quest rewards.
  function pendingQueuedActionStateImpl(
    address _owner,
    uint _playerId
  ) external view returns (PendingQueuedActionState memory pendingQueuedActionState) {
    Player storage player = players_[_playerId];
    QueuedAction[] storage actionQueue = player.actionQueue;
    pendingQueuedActionState.equipmentStates = new PendingQueuedActionEquipmentState[](actionQueue.length + 1);
    pendingQueuedActionState.actionMetadatas = new PendingQueuedActionMetadata[](actionQueue.length + 1);

    PendingQueuedActionXPGained memory pendingQueuedActionXPGained = pendingQueuedActionState.xpGained;
    pendingQueuedActionXPGained.skills = new Skill[](actionQueue.length * 2); // combat can have 2 skills (combat + health)
    pendingQueuedActionXPGained.xpGainedSkills = new uint32[](actionQueue.length * 2);
    uint pendingQueuedActionXPGainedLength;

    // This is used so that we can start the full XP calculation using the same stats as before
    pendingQueuedActionXPGained.alreadyProcessedSkill = player.queuedActionAlreadyProcessedSkill;
    pendingQueuedActionXPGained.alreadyProcessedXPGained = player.queuedActionAlreadyProcessedXPGained;
    pendingQueuedActionXPGained.alreadyProcessedSkill1 = player.queuedActionAlreadyProcessedSkill1;
    pendingQueuedActionXPGained.alreadyProcessedXPGained1 = player.queuedActionAlreadyProcessedXPGained1;

    pendingQueuedActionState.remainingSkills = new QueuedAction[](actionQueue.length);
    uint remainingSkillsLength;

    uint[] memory actionIds = new uint[](actionQueue.length);
    uint[] memory actionAmounts = new uint[](actionQueue.length);
    uint[] memory choiceIds = new uint[](actionQueue.length);
    uint[] memory choiceAmounts = new uint[](actionQueue.length);
    uint actionIdsLength;
    uint choiceIdsLength;

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
        combatStats = PlayersLibrary.getCombatStats(
          pendingQueuedActionXPGained,
          xp_[_playerId],
          from,
          itemNFT,
          attire_[_playerId][queuedAction.queueId],
          pendingQueuedActionState.equipmentStates
        );
      }

      bool missingRequiredHandEquipment;
      (missingRequiredHandEquipment, combatStats) = PlayersLibrary.updateStatsFromHandEquipment(
        from,
        itemNFT,
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
          0,
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
      uint prevXPElapsedTime;
      if (queuedAction.choiceId != 0) {
        actionChoice = world.getActionChoice(isCombat ? 0 : queuedAction.actionId, queuedAction.choiceId);

        Equipment[] memory consumedEquipments;
        Equipment memory outputEquipment;
        uint24 numConsumed;
        uint24 numProduced;
        (
          consumedEquipments,
          outputEquipment,
          xpElapsedTime,
          prevXPElapsedTime,
          died,
          numConsumed,
          numProduced
        ) = _completeProcessConsumablesView(
          from,
          _playerId,
          queuedAction,
          actionChoice,
          combatStats,
          elapsedTime,
          startTime,
          pendingQueuedActionState.equipmentStates,
          pendingQueuedActionState.xpGained
        );

        uint numChoicesCompleted;
        if (actionSkill == Skill.COOKING) {
          numChoicesCompleted = numProduced; // Assume we want amount cooked
        } else {
          numChoicesCompleted = numConsumed;
        }
        if (numChoicesCompleted != 0) {
          choiceIds[choiceIdsLength] = queuedAction.choiceId;
          choiceAmounts[choiceIdsLength] = numChoicesCompleted;
          choiceIdsLength = choiceIdsLength.inc();
        }

        uint numActionsCompleted;
        if (actionSkill == Skill.COMBAT) {
          // Want monsters killed
          numActionsCompleted = uint16((numSpawnedPerHour * xpElapsedTime) / 3600);
        } else {
          // Not currently used
        }

        if (numActionsCompleted != 0) {
          actionIds[actionIdsLength] = queuedAction.actionId;
          actionAmounts[actionIdsLength] = numActionsCompleted;
          actionIdsLength = actionIdsLength.inc();
        }

        if (outputEquipment.itemTokenId != NONE) {
          pendingQueuedActionEquipmentState.producedItemTokenIds[producedLength] = outputEquipment.itemTokenId;
          pendingQueuedActionEquipmentState.producedAmounts[producedLength] = outputEquipment.amount;
          producedLength = producedLength.inc();
        }
        U256 consumedEquipmentLength = consumedEquipments.length.asU256();
        for (U256 jter; jter < consumedEquipmentLength; jter = jter.inc()) {
          uint j = jter.asUint256();
          pendingQueuedActionEquipmentState.consumedItemTokenIds[consumedLength] = consumedEquipments[j].itemTokenId;
          pendingQueuedActionEquipmentState.consumedAmounts[consumedLength] = consumedEquipments[j].amount;
          consumedLength = consumedLength.inc();
        }

        if (died) {
          pendingQueuedActionMetadata.died = true;
        }
      } else {
        // Elapsed time is the time that we actually spent doing the action, not the time that has passed
        if (queuedAction.processedTime != 0) {
          // PrevXP
          bool hasGuaranteedRewards = actionRewards.guaranteedRewardTokenId1 != NONE;
          uint previouslyRefundedTime;
          uint refundTime;
          if (hasGuaranteedRewards) {
            uint numProduced = (queuedAction.processedTime * actionRewards.guaranteedRewardRate1) / (3600 * 10);
            previouslyRefundedTime =
              queuedAction.processedTime -
              (numProduced * (3600 * 10)) /
              actionRewards.guaranteedRewardRate1;

            // Get remainder for current too
            uint numProduced1 = ((elapsedTime + queuedAction.processedTime) * actionRewards.guaranteedRewardRate1) /
              (3600 * 10);
            refundTime =
              (elapsedTime + queuedAction.processedTime) -
              (numProduced1 * (3600 * 10)) /
              actionRewards.guaranteedRewardRate1;
          }

          if (actionHasRandomRewards) {
            uint tempRefundTime = queuedAction.processedTime % 3600;
            if (tempRefundTime > refundTime) {
              previouslyRefundedTime = tempRefundTime;
            }

            tempRefundTime = (elapsedTime + previouslyRefundedTime) % 3600;
            if (tempRefundTime > refundTime) {
              refundTime = tempRefundTime;
            }
          }

          prevXPElapsedTime = queuedAction.processedTime > previouslyRefundedTime
            ? queuedAction.processedTime.sub(previouslyRefundedTime)
            : 0;
          xpElapsedTime = elapsedTime + queuedAction.processedTime - refundTime - prevXPElapsedTime;
        } else {
          bool hasGuaranteedRewards = actionRewards.guaranteedRewardTokenId1 != NONE;
          uint refundTime;
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

        uint numActionsCompleted;
        if (actionSkill == Skill.THIEVING) {
          // Hours thieving
          numActionsCompleted = xpElapsedTime / 3600;
        } else {
          // Output produced
          numActionsCompleted = (xpElapsedTime * actionRewards.guaranteedRewardRate1) / (3600 * 10);
        }
        if (numActionsCompleted != 0) {
          actionIds[actionIdsLength] = queuedAction.actionId;
          actionAmounts[actionIdsLength] = numActionsCompleted;
          actionIdsLength = actionIdsLength.inc();
        }
      }

      uint pointsAccruedExclBaseBoost;
      uint processedTime = queuedAction.processedTime;
      uint veryStartTime = startTime.sub(processedTime);
      uint prevPointsAccrued;
      uint prevPointsAccruedExclBaseBoost;
      Skill skill = _getSkillFromChoiceOrStyle(actionChoice, queuedAction.combatStyle, queuedAction.actionId);
      if (!died) {
        (pointsAccrued, pointsAccruedExclBaseBoost) = _getPointsAccrued(
          from,
          _playerId,
          queuedAction,
          veryStartTime,
          skill,
          xpElapsedTime + prevXPElapsedTime,
          pendingQueuedActionState.equipmentStates
        );

        if (processedTime > 0) {
          (prevPointsAccrued, prevPointsAccruedExclBaseBoost) = _getPointsAccrued(
            from,
            _playerId,
            queuedAction,
            veryStartTime,
            skill,
            prevXPElapsedTime,
            pendingQueuedActionState.equipmentStates
          );

          pointsAccrued -= uint32(prevPointsAccrued);
          pointsAccruedExclBaseBoost -= uint32(prevPointsAccruedExclBaseBoost);
        }
      }

      pendingQueuedActionMetadata.xpElapsedTime = uint24(xpElapsedTime);
      uint32 xpGained = pointsAccrued;
      uint32 healthPointsGained;
      if (pointsAccruedExclBaseBoost != 0 && _isCombatStyle(queuedAction.combatStyle)) {
        healthPointsGained = _getHealthPointsFromCombat(
          _playerId,
          pointsAccruedExclBaseBoost + prevPointsAccruedExclBaseBoost
        );
        if (prevPointsAccrued != 0) {
          // Remove old
          healthPointsGained -= _getHealthPointsFromCombat(_playerId, prevPointsAccruedExclBaseBoost);
        }
        xpGained += healthPointsGained;
      }

      bool hasCombatXP = pointsAccruedExclBaseBoost != 0 && _isCombatStyle(queuedAction.combatStyle);

      if (pointsAccrued != 0) {
        pendingQueuedActionXPGained.skills[pendingQueuedActionXPGainedLength] = skill;
        pendingQueuedActionXPGained.xpGainedSkills[pendingQueuedActionXPGainedLength++] = pointsAccrued;
        if (hasCombatXP) {
          pendingQueuedActionXPGained.skills[pendingQueuedActionXPGainedLength] = Skill.HEALTH;
          pendingQueuedActionXPGained.xpGainedSkills[pendingQueuedActionXPGainedLength++] = healthPointsGained;
        }
      }

      if (!fullyFinished) {
        // Add the remainder if this action is not fully consumed
        uint remainingTimespan = queuedAction.timespan - elapsedTime;
        _addRemainingSkill(
          pendingQueuedActionState.remainingSkills,
          queuedAction,
          remainingTimespan,
          elapsedTime,
          remainingSkillsLength
        );
        remainingSkillsLength = remainingSkillsLength.inc();

        if (i == 0 && pendingQueuedActionXPGained.alreadyProcessedSkill == skill) {
          // Append it
          pendingQueuedActionXPGained.alreadyProcessedXPGained += uint24(pointsAccrued);
          if (hasCombatXP) {
            pendingQueuedActionXPGained.alreadyProcessedSkill1 = Skill.HEALTH;
            pendingQueuedActionXPGained.alreadyProcessedXPGained1 += uint24(healthPointsGained);
          }
        } else {
          // Set it absolutely, this is a fresh "first action"
          pendingQueuedActionXPGained.alreadyProcessedSkill = skill;
          pendingQueuedActionXPGained.alreadyProcessedXPGained = uint24(pointsAccrued);
          if (hasCombatXP) {
            pendingQueuedActionXPGained.alreadyProcessedSkill1 = Skill.HEALTH;
            pendingQueuedActionXPGained.alreadyProcessedXPGained1 = uint24(healthPointsGained);
          } else {
            pendingQueuedActionXPGained.alreadyProcessedSkill1 = Skill.NONE;
            pendingQueuedActionXPGained.alreadyProcessedXPGained1 = 0;
          }
        }
      } else {
        // Clear it
        pendingQueuedActionXPGained.alreadyProcessedSkill = Skill.NONE;
        pendingQueuedActionXPGained.alreadyProcessedXPGained = 0;
        pendingQueuedActionXPGained.alreadyProcessedSkill1 = Skill.NONE;
        pendingQueuedActionXPGained.alreadyProcessedXPGained1 = 0;
      }
      // Include loot
      {
        // Full
        (uint[] memory newIds, uint[] memory newAmounts) = _getRewards(
          _playerId,
          uint40(veryStartTime),
          xpElapsedTime + prevXPElapsedTime,
          queuedAction.actionId,
          pendingQueuedActionXPGained
        );

        if (prevXPElapsedTime > 0) {
          (uint[] memory prevNewIds, uint[] memory prevNewAmounts) = _getRewards(
            _playerId,
            uint40(veryStartTime),
            prevXPElapsedTime,
            queuedAction.actionId,
            pendingQueuedActionXPGained
          );

          (newIds, newAmounts) = PlayersLibrary.normalizeRewards(newIds, newAmounts, prevNewIds, prevNewAmounts);
        }

        U256 newIdsLength = newIds.length.asU256();
        for (U256 jter; jter < newIdsLength; jter = jter.inc()) {
          uint j = jter.asUint256();
          pendingQueuedActionEquipmentState.producedItemTokenIds[producedLength] = newIds[j];
          pendingQueuedActionEquipmentState.producedAmounts[producedLength] = newAmounts[j];
          producedLength = producedLength.inc();
        }
      }
      // Total XP gained
      pendingQueuedActionMetadata.xpGained = xpGained;
      totalXPGained += xpGained;

      // Number of pending reward rolls
      if (actionHasRandomRewards) {
        bool hasRandomWord = world.hasRandomWord(startTime + elapsedTime);
        if (!hasRandomWord) {
          if (isCombat) {
            uint16 monstersKilled = uint16(
              (numSpawnedPerHour * (xpElapsedTime + prevXPElapsedTime)) /
                3600 -
                (numSpawnedPerHour * (prevXPElapsedTime)) /
                3600
            );
            pendingQueuedActionMetadata.rolls = uint32(monstersKilled);
          } else {
            pendingQueuedActionMetadata.rolls = uint32(
              (xpElapsedTime + prevXPElapsedTime) / 3600 - prevXPElapsedTime / 3600
            );
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

    // Quest Rewards
    QuestState memory questState = pendingQueuedActionState.quests;
    // Anything burnt happens after the actions are processed, so do not affect anything else.
    uint burnedAmountOwned;
    uint activeQuestBurnedItemTokenId = quests.getActiveQuestBurnedItemTokenId(_playerId);
    if (activeQuestBurnedItemTokenId != NONE) {
      burnedAmountOwned = PlayersLibrary.getRealBalance(
        from,
        activeQuestBurnedItemTokenId,
        itemNFT,
        pendingQueuedActionState.equipmentStates
      );
    }

    (
      questState.rewardItemTokenIds,
      questState.rewardAmounts,
      questState.consumedItemTokenIds,
      questState.consumedAmounts,
      questState.skills,
      questState.xpGainedSkills,
      questState.questsCompleted,
      questState.activeQuestInfo
    ) = quests.processQuestsView(_playerId, actionIds, actionAmounts, choiceIds, choiceAmounts, burnedAmountOwned);

    questState.actionIds = actionIds;
    questState.actionAmounts = actionAmounts;
    questState.choiceIds = choiceIds;
    questState.choiceAmounts = choiceAmounts;

    // Total XP gained
    for (uint i = 0; i < questState.xpGainedSkills.length; ++i) {
      totalXPGained += questState.xpGainedSkills[i];
    }

    // XPRewards
    if (totalXPGained != 0) {
      (
        pendingQueuedActionState.xpRewardItemTokenIds,
        pendingQueuedActionState.xpRewardAmounts
      ) = _claimableXPThresholdRewards(previousTotalXP, previousTotalXP + totalXPGained);
    }

    // Past Random Rewards
    // We don't want to add any extra levels gained during this processing for past rewards.
    PendingQueuedActionXPGained memory emptyPendingQueuedActionXPGained;
    (
      uint[] memory ids,
      uint[] memory amounts,
      uint[] memory pastActionIds,
      uint[] memory queueIds,
      uint numRemoved
    ) = _claimableRandomRewards(_playerId, emptyPendingQueuedActionXPGained);
    U256 idsLength = ids.length.asU256();
    pendingQueuedActionState.producedPastRandomRewards = new PastRandomRewardInfo[](ids.length);
    for (U256 iter; iter < idsLength; iter = iter.inc()) {
      uint i = iter.asUint256();
      pendingQueuedActionState.producedPastRandomRewards[i] = PastRandomRewardInfo(
        uint16(pastActionIds[i]),
        uint64(queueIds[i]),
        uint16(ids[i]),
        uint24(amounts[i]),
        numRemoved
      );
    }

    assembly ("memory-safe") {
      mstore(actionIds, actionIdsLength)
      mstore(actionAmounts, actionIdsLength)
    }

    assembly ("memory-safe") {
      mstore(choiceIds, choiceIdsLength)
      mstore(choiceAmounts, choiceIdsLength)
    }

    // Daily rewards
    (
      pendingQueuedActionState.dailyRewardItemTokenIds,
      pendingQueuedActionState.dailyRewardAmounts,
      pendingQueuedActionState.dailyRewardMask
    ) = _dailyRewardsView(_playerId);

    // Compact to fit the array
    assembly ("memory-safe") {
      mstore(mload(pendingQueuedActionState), pendingQueuedActionStateLength)
      mstore(mload(add(pendingQueuedActionState, 32)), pendingQueuedActionStateLength)
      mstore(mload(add(pendingQueuedActionState, 64)), remainingSkillsLength)
    }

    assembly ("memory-safe") {
      mstore(mload(pendingQueuedActionXPGained), pendingQueuedActionXPGainedLength)
      mstore(mload(add(pendingQueuedActionXPGained, 32)), pendingQueuedActionXPGainedLength)
    }
  }

  function claimRandomRewards(
    uint _playerId,
    PendingQueuedActionXPGained memory _pendingQueuedActionXPGained
  ) external {
    address from = msg.sender;
    (
      uint[] memory ids,
      uint[] memory amounts,
      uint[] memory actionIds,
      uint[] memory queueIds,
      uint numRemoved
    ) = _claimableRandomRewards(_playerId, _pendingQueuedActionXPGained);
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

  function _getRewards(
    uint _playerId,
    uint40 _skillStartTime,
    uint _elapsedTime,
    uint16 _actionId,
    PendingQueuedActionXPGained memory _pendingQueuedActionXPGained
  ) private view returns (uint[] memory ids, uint[] memory amounts) {
    (ActionRewards memory actionRewards, Skill actionSkill, uint numSpawnedPerHour) = world.getRewardsHelper(_actionId);
    bool isCombat = actionSkill == Skill.COMBAT;

    ids = new uint[](MAX_REWARDS_PER_ACTION);
    amounts = new uint[](MAX_REWARDS_PER_ACTION);

    uint16 monstersKilled = uint16((numSpawnedPerHour * _elapsedTime) / 3600);
    uint8 successPercent = _getSuccessPercent(
      _playerId,
      _actionId,
      actionSkill,
      isCombat,
      _pendingQueuedActionXPGained
    );

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
    bool _isCombat,
    PendingQueuedActionXPGained memory _pendingQueuedActionXPGained
  ) private view returns (uint8 successPercent) {
    return
      PlayersLibrary.getSuccessPercent(
        _actionId,
        _actionSkill,
        _isCombat,
        _pendingQueuedActionXPGained,
        world,
        MAX_SUCCESS_PERCENT_CHANCE_,
        xp_[_playerId]
      );
  }

  function _claimableRandomRewards(
    uint _playerId,
    PendingQueuedActionXPGained memory _pendingQueuedActionXPGained
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
      uint8 successPercent = _getSuccessPercent(
        _playerId,
        pendingRandomReward.actionId,
        actionSkill,
        isCombat,
        _pendingQueuedActionXPGained
      );
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

  function _getPointsAccrued(
    address _from,
    uint _playerId,
    QueuedAction storage _queuedAction,
    uint _startTime,
    Skill _skill,
    uint _xpElapsedTime,
    PendingQueuedActionEquipmentState[] memory _pendingQueuedActionEquipmentStates
  ) internal view returns (uint32 pointsAccrued, uint32 pointsAccruedExclBaseBoost) {
    (pointsAccrued, pointsAccruedExclBaseBoost) = PlayersLibrary.getPointsAccrued(
      _from,
      players_[_playerId],
      _queuedAction,
      _startTime,
      _skill,
      _xpElapsedTime,
      attire_[_playerId][_queuedAction.queueId],
      activeBoosts_[_playerId],
      itemNFT,
      world,
      fullAttireBonus[_skill].bonusXPPercent,
      fullAttireBonus[_skill].itemTokenIds,
      _pendingQueuedActionEquipmentStates
    );
  }

  function _addRemainingSkill(
    QueuedAction[] memory _remainingSkills,
    QueuedAction storage _queuedAction,
    uint _timespan,
    uint _processedTime,
    uint _length
  ) private pure {
    QueuedAction memory remainingAction = _queuedAction;
    remainingAction.timespan = uint24(_timespan);
    remainingAction.processedTime += uint24(_processedTime);
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
        uint numIterations = Math.min(MAX_UNIQUE_TICKETS_, _numTickets);

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
          uint16 rand = uint16(Math.min(type(uint16).max, operation));

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

  function _completeProcessConsumablesView(
    address _from,
    uint _playerId,
    QueuedAction memory _queuedAction,
    ActionChoice memory _actionChoice,
    CombatStats memory _combatStats,
    uint _elapsedTime,
    uint _startTime,
    PendingQueuedActionEquipmentState[] memory _pendingQueuedActionEquipmentStates,
    PendingQueuedActionXPGained memory _pendingQueuedActionXPGained
  )
    private
    view
    returns (
      Equipment[] memory consumedEquipment,
      Equipment memory outputEquipment,
      uint xpElapsedTime,
      uint prevXPElapsedTime,
      bool died,
      uint24 numConsumed,
      uint24 numProduced
    )
  {
    bytes memory data = _staticcall(
      address(this),
      abi.encodeWithSelector(
        IPlayersProcessActionsDelegateView.completeProcessConsumablesView.selector,
        _from,
        _playerId,
        _queuedAction,
        _actionChoice,
        _combatStats,
        _elapsedTime,
        _startTime,
        _pendingQueuedActionEquipmentStates,
        _pendingQueuedActionXPGained
      )
    );
    return abi.decode(data, (Equipment[], Equipment, uint, uint, bool, uint24, uint24));
  }

  function _getHealthPointsFromCombat(
    uint _playerId,
    uint _combatPoints
  ) internal view returns (uint32 healthPointsAccured) {
    // Get 1/3 of the combat points as health
    healthPointsAccured = uint32(_combatPoints / 3);
    // Get bonus health points from avatar starting skills
    uint bonusPercent = PlayersLibrary.getBonusAvatarXPPercent(players_[_playerId], Skill.HEALTH);
    healthPointsAccured += uint32((_combatPoints * bonusPercent) / (3600 * 100));
  }

  function _dailyRewardsView(
    uint _playerId
  ) internal view returns (uint[] memory itemTokenIds, uint[] memory amounts, bytes32 dailyRewardMask) {
    bytes memory data = _staticcall(
      address(this),
      abi.encodeWithSelector(IPlayersMiscDelegateView.dailyRewardsViewImpl.selector, _playerId)
    );
    return abi.decode(data, (uint[], uint[], bytes32));
  }
}
