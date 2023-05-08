// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {UnsafeMath, U256} from "@0xdoublesharp/unsafe-math/contracts/UnsafeMath.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {PlayersUpgradeableImplDummyBase, PlayersBase} from "./PlayersImplBase.sol";
import {PlayersLibrary} from "./PlayersLibrary.sol";
import "../interfaces/IPlayers.sol";

// solhint-disable-next-line no-global-import
import "../globals/all.sol";

contract PlayersImplRewards is PlayersUpgradeableImplDummyBase, PlayersBase, IPlayersRewardsDelegateView {
  using UnsafeMath for U256;
  using UnsafeMath for uint256;
  using UnsafeMath for uint40;
  using UnsafeMath for uint24;
  using UnsafeMath for uint16;

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

    PendingQueuedActionProcessed memory pendingQueuedActionProcessed = pendingQueuedActionState.processedData;
    pendingQueuedActionProcessed.skills = new Skill[](actionQueue.length * 2); // combat can have 2 skills (combat + health)
    pendingQueuedActionProcessed.xpGainedSkills = new uint32[](actionQueue.length * 2);
    uint pendingQueuedActionProcessedLength;

    // This is used so that we can start the full XP calculation using the same stats as before
    PendingQueuedActionData memory currentActionProcessed = pendingQueuedActionProcessed.currentAction;
    currentActionProcessed.skill1 = player.currentActionProcessedSkill1;
    currentActionProcessed.xpGained1 = player.currentActionProcessedXPGained1;
    currentActionProcessed.skill2 = player.currentActionProcessedSkill2;
    currentActionProcessed.xpGained2 = player.currentActionProcessedXPGained2;
    currentActionProcessed.foodConsumed = player.currentActionProcessedFoodConsumed;
    currentActionProcessed.baseInputItemsConsumedNum = player.currentActionProcessedBaseInputItemsConsumedNum;

    pendingQueuedActionState.remainingQueuedActions = new QueuedAction[](actionQueue.length);
    uint remainingQueuedActionsLength;

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
    uint startTime = players_[_playerId].currentActionStartTime;
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
          pendingQueuedActionProcessed,
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
          pendingQueuedActionState.remainingQueuedActions,
          queuedAction,
          queuedAction.timespan,
          0,
          0,
          remainingQueuedActionsLength
        );
        remainingQueuedActionsLength = remainingQueuedActionsLength.inc();
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
      uint prevXPElapsedTime = queuedAction.prevProcessedXPTime;
      uint16 foodConsumed;
      uint16 baseInputItemsConsumedNum;
      if (queuedAction.choiceId != 0) {
        actionChoice = world.getActionChoice(isCombat ? 0 : queuedAction.actionId, queuedAction.choiceId);

        Equipment[] memory consumedEquipments;
        Equipment memory producedEquipment;
        (
          consumedEquipments,
          producedEquipment,
          xpElapsedTime,
          died,
          foodConsumed,
          baseInputItemsConsumedNum
        ) = _completeProcessConsumablesView(
          from,
          _playerId,
          queuedAction,
          actionChoice,
          combatStats,
          elapsedTime,
          startTime,
          pendingQueuedActionState.equipmentStates,
          pendingQueuedActionState.processedData
        );

        uint numChoicesCompleted;
        if (actionSkill == Skill.COOKING) {
          numChoicesCompleted = producedEquipment.amount; // Assume we want amount cooked
        } else {
          numChoicesCompleted = baseInputItemsConsumedNum;
        }
        if (numChoicesCompleted != 0) {
          choiceIds[choiceIdsLength] = queuedAction.choiceId;
          choiceAmounts[choiceIdsLength] = numChoicesCompleted;
          choiceIdsLength = choiceIdsLength.inc();
        }

        uint numActionsCompleted;
        if (actionSkill == Skill.COMBAT) {
          // Want monsters killed
          uint prevActionsCompleted = uint16((numSpawnedPerHour * prevXPElapsedTime) / (3600 * SPAWN_MUL));
          numActionsCompleted =
            uint16((numSpawnedPerHour * (xpElapsedTime + prevXPElapsedTime)) / (3600 * SPAWN_MUL)) -
            prevActionsCompleted;
        } else {
          // Not currently used
        }

        if (numActionsCompleted != 0) {
          actionIds[actionIdsLength] = queuedAction.actionId;
          actionAmounts[actionIdsLength] = numActionsCompleted;
          actionIdsLength = actionIdsLength.inc();
        }

        if (producedEquipment.itemTokenId != NONE) {
          pendingQueuedActionEquipmentState.producedItemTokenIds[producedLength] = producedEquipment.itemTokenId;
          pendingQueuedActionEquipmentState.producedAmounts[producedLength] = producedEquipment.amount;
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
        if (queuedAction.prevProcessedTime != 0) {
          // PrevXP
          bool hasGuaranteedRewards = actionRewards.guaranteedRewardTokenId1 != NONE;
          uint previouslyRefundedTime;
          uint refundTime;
          if (hasGuaranteedRewards) {
            uint numProduced = (uint(queuedAction.prevProcessedTime) * actionRewards.guaranteedRewardRate1) /
              (3600 * GUAR_MUL);
            previouslyRefundedTime =
              queuedAction.prevProcessedTime -
              (numProduced * (3600 * GUAR_MUL)) /
              actionRewards.guaranteedRewardRate1;

            // Get remainder for current too
            uint numProduced1 = ((elapsedTime + queuedAction.prevProcessedTime) * actionRewards.guaranteedRewardRate1) /
              (3600 * GUAR_MUL);
            refundTime =
              (elapsedTime + queuedAction.prevProcessedTime) -
              (numProduced1 * (3600 * GUAR_MUL)) /
              actionRewards.guaranteedRewardRate1;
          }

          if (actionHasRandomRewards) {
            uint tempRefundTime = queuedAction.prevProcessedTime % 3600;
            if (tempRefundTime > refundTime) {
              previouslyRefundedTime = tempRefundTime;
            }

            tempRefundTime = (elapsedTime + previouslyRefundedTime) % 3600;
            if (tempRefundTime > refundTime) {
              refundTime = tempRefundTime;
            }
          }

          xpElapsedTime = elapsedTime + queuedAction.prevProcessedTime - refundTime - prevXPElapsedTime;
        } else {
          bool hasGuaranteedRewards = actionRewards.guaranteedRewardTokenId1 != NONE;
          uint refundTime;
          if (hasGuaranteedRewards) {
            uint numProduced = (elapsedTime * actionRewards.guaranteedRewardRate1) / (3600 * GUAR_MUL);
            refundTime = elapsedTime - (numProduced * (3600 * GUAR_MUL)) / actionRewards.guaranteedRewardRate1;
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
          uint prevNumActionsCompleted = prevXPElapsedTime / 3600;
          numActionsCompleted = ((xpElapsedTime + prevXPElapsedTime) / 3600) - prevNumActionsCompleted;
        } else {
          // Output produced
          uint prevNumActionsCompleted = (uint(prevXPElapsedTime) * actionRewards.guaranteedRewardRate1) /
            (3600 * GUAR_MUL);
          numActionsCompleted =
            (uint(prevXPElapsedTime + xpElapsedTime) * actionRewards.guaranteedRewardRate1) /
            (3600 * GUAR_MUL) -
            prevNumActionsCompleted;
        }
        if (numActionsCompleted != 0) {
          actionIds[actionIdsLength] = queuedAction.actionId;
          actionAmounts[actionIdsLength] = numActionsCompleted;
          actionIdsLength = actionIdsLength.inc();
        }
      }

      uint pointsAccruedExclBaseBoost;
      uint prevProcessedTime = queuedAction.prevProcessedTime;
      uint veryStartTime = startTime.sub(prevProcessedTime);
      uint prevPointsAccrued;
      uint prevPointsAccruedExclBaseBoost;
      Skill skill = _getSkillFromChoiceOrStyle(actionChoice, queuedAction.combatStyle, queuedAction.actionId);
      (pointsAccrued, pointsAccruedExclBaseBoost) = _getPointsAccrued(
        from,
        _playerId,
        queuedAction,
        veryStartTime,
        skill,
        xpElapsedTime + prevXPElapsedTime,
        pendingQueuedActionState.equipmentStates
      );

      if (prevProcessedTime > 0) {
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
        pendingQueuedActionProcessed.skills[pendingQueuedActionProcessedLength] = skill;
        pendingQueuedActionProcessed.xpGainedSkills[pendingQueuedActionProcessedLength++] = pointsAccrued;
        if (hasCombatXP) {
          pendingQueuedActionProcessed.skills[pendingQueuedActionProcessedLength] = Skill.HEALTH;
          pendingQueuedActionProcessed.xpGainedSkills[pendingQueuedActionProcessedLength++] = healthPointsGained;
        }
      }

      if (!fullyFinished) {
        // Add the remainder if this action is not fully consumed
        uint remainingTimespan = queuedAction.timespan - elapsedTime;
        _addRemainingSkill(
          pendingQueuedActionState.remainingQueuedActions,
          queuedAction,
          remainingTimespan,
          elapsedTime,
          xpElapsedTime,
          remainingQueuedActionsLength
        );
        remainingQueuedActionsLength = remainingQueuedActionsLength.inc();

        if (i == 0) {
          // Append it (or set it absolutely if unset)
          currentActionProcessed.skill1 = skill;
          currentActionProcessed.xpGained1 += uint24(pointsAccrued);
          if (hasCombatXP) {
            currentActionProcessed.skill2 = Skill.HEALTH;
            currentActionProcessed.xpGained2 += uint24(healthPointsGained);
          }

          currentActionProcessed.foodConsumed += foodConsumed;
          currentActionProcessed.baseInputItemsConsumedNum += baseInputItemsConsumedNum;
        } else {
          // Set it absolutely, this is a fresh "first action"
          currentActionProcessed.skill1 = skill;
          currentActionProcessed.xpGained1 = uint24(pointsAccrued);
          if (hasCombatXP) {
            currentActionProcessed.skill2 = Skill.HEALTH;
            currentActionProcessed.xpGained2 = uint24(healthPointsGained);
          } else {
            currentActionProcessed.skill2 = Skill.NONE;
            currentActionProcessed.xpGained2 = 0;
          }
          currentActionProcessed.foodConsumed = foodConsumed;
          currentActionProcessed.baseInputItemsConsumedNum = baseInputItemsConsumedNum;
        }
      } else {
        // Clear it
        currentActionProcessed.skill1 = Skill.NONE;
        currentActionProcessed.xpGained1 = 0;
        currentActionProcessed.skill2 = Skill.NONE;
        currentActionProcessed.xpGained2 = 0;
        currentActionProcessed.foodConsumed = 0;
        currentActionProcessed.baseInputItemsConsumedNum = 0;
      }
      // Include loot
      {
        uint8 bonusRewardsPercent = fullAttireBonus[skill].bonusRewardsPercent;
        uint8 fullAttireBonusRewardsPercent = PlayersLibrary.getFullAttireBonusRewardsPercent(
          from,
          attire_[_playerId][queuedAction.queueId],
          itemNFT,
          pendingQueuedActionState.equipmentStates,
          bonusRewardsPercent,
          fullAttireBonus[skill].itemTokenIds
        );

        // Full
        if (xpElapsedTime != 0) {
          (uint[] memory newIds, uint[] memory newAmounts) = _getRewards(
            _playerId,
            uint40(veryStartTime),
            xpElapsedTime + prevXPElapsedTime,
            queuedAction.actionId,
            pendingQueuedActionProcessed,
            fullAttireBonusRewardsPercent
          );

          if (prevXPElapsedTime > 0) {
            (uint[] memory prevNewIds, uint[] memory prevNewAmounts) = _getRewards(
              _playerId,
              uint40(veryStartTime),
              prevXPElapsedTime,
              queuedAction.actionId,
              pendingQueuedActionProcessed,
              fullAttireBonusRewardsPercent
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
      }

      // Total XP gained
      pendingQueuedActionMetadata.xpGained = xpGained;
      totalXPGained += xpGained;

      // Number of pending reward rolls
      if (actionHasRandomRewards) {
        bool hasRandomWord = world.hasRandomWord(startTime + elapsedTime);
        if (!hasRandomWord) {
          if (isCombat) {
            uint prevMonstersKilled = (numSpawnedPerHour * prevXPElapsedTime) / (SPAWN_MUL * 3600);
            uint16 monstersKilled = uint16(
              (numSpawnedPerHour * (xpElapsedTime + prevXPElapsedTime)) / (SPAWN_MUL * 3600) - prevMonstersKilled
            );
            pendingQueuedActionMetadata.rolls = uint32(monstersKilled);
          } else {
            uint prevRolls = prevXPElapsedTime / 3600;
            pendingQueuedActionMetadata.rolls = uint32((xpElapsedTime + prevXPElapsedTime) / 3600 - prevRolls);
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
    PendingQueuedActionProcessed memory emptyPendingQueuedActionProcessed;
    (uint[] memory ids, uint[] memory amounts, uint[] memory queueIds, uint numRemoved) = _claimableRandomRewards(
      _playerId,
      emptyPendingQueuedActionProcessed
    );
    U256 idsLength = ids.length.asU256();
    pendingQueuedActionState.producedPastRandomRewards = new PastRandomRewardInfo[](ids.length);
    for (U256 iter; iter < idsLength; iter = iter.inc()) {
      uint i = iter.asUint256();
      pendingQueuedActionState.producedPastRandomRewards[i] = PastRandomRewardInfo(
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
      mstore(mload(add(pendingQueuedActionState, 64)), remainingQueuedActionsLength)
    }

    assembly ("memory-safe") {
      mstore(mload(pendingQueuedActionProcessed), pendingQueuedActionProcessedLength)
      mstore(mload(add(pendingQueuedActionProcessed, 32)), pendingQueuedActionProcessedLength)
    }
  }

  function claimRandomRewards(
    uint _playerId,
    PendingQueuedActionProcessed memory _pendingQueuedActionProcessed
  ) external {
    address from = msg.sender;
    (uint[] memory ids, uint[] memory amounts, uint[] memory queueIds, uint numRemoved) = _claimableRandomRewards(
      _playerId,
      _pendingQueuedActionProcessed
    );
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
    uint _xpElapsedTime,
    uint16 _actionId,
    PendingQueuedActionProcessed memory _pendingQueuedActionProcessed,
    uint8 fullAttireBonusRewardsPercent
  ) private view returns (uint[] memory ids, uint[] memory amounts) {
    (ActionRewards memory actionRewards, Skill actionSkill, uint numSpawnedPerHour) = world.getRewardsHelper(_actionId);
    bool isCombat = actionSkill == Skill.COMBAT;

    ids = new uint[](MAX_REWARDS_PER_ACTION);
    amounts = new uint[](MAX_REWARDS_PER_ACTION);

    uint16 monstersKilled = uint16((numSpawnedPerHour * _xpElapsedTime) / (SPAWN_MUL * 3600));
    uint8 successPercent = _getSuccessPercent(
      _playerId,
      _actionId,
      actionSkill,
      isCombat,
      _pendingQueuedActionProcessed
    );

    uint length = _appendGuaranteedRewards(
      ids,
      amounts,
      _xpElapsedTime,
      actionRewards,
      monstersKilled,
      isCombat,
      successPercent
    );

    bool processedAny;
    (length, processedAny) = _appendRandomRewards(
      _playerId,
      _skillStartTime,
      _xpElapsedTime,
      isCombat ? monstersKilled : _xpElapsedTime / 3600,
      ids,
      amounts,
      length,
      actionRewards,
      successPercent,
      fullAttireBonusRewardsPercent
    );

    // Check for any boosts
    PlayerBoostInfo storage activeBoost = activeBoosts_[_playerId];
    if (activeBoost.boostType == BoostType.GATHERING) {
      uint boostedTime = PlayersLibrary.getBoostedTime(
        _skillStartTime,
        _xpElapsedTime,
        activeBoost.startTime,
        activeBoost.duration
      );
      U256 bounds = length.asU256();
      for (U256 iter; iter < bounds; iter = iter.inc()) {
        uint i = iter.asUint256();
        // amounts[i] takes into account the whole elapsed time so additional boosted amount is a fraction of that.
        amounts[i] += uint32((boostedTime * amounts[i] * activeBoost.val) / (_xpElapsedTime * 100));
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
    PendingQueuedActionProcessed memory _pendingQueuedActionProcessed
  ) private view returns (uint8 successPercent) {
    return
      PlayersLibrary.getSuccessPercent(
        _actionId,
        _actionSkill,
        _isCombat,
        _pendingQueuedActionProcessed,
        world,
        MAX_SUCCESS_PERCENT_CHANCE_,
        xp_[_playerId]
      );
  }

  function _claimableRandomRewards(
    uint _playerId,
    PendingQueuedActionProcessed memory _pendingQueuedActionProcessed
  ) private view returns (uint[] memory ids, uint[] memory amounts, uint[] memory queueIds, uint numRemoved) {
    PendingRandomReward[] storage _pendingRandomRewards = pendingRandomRewards[_playerId];
    U256 pendingRandomRewardsLength = _pendingRandomRewards.length.asU256();
    ids = new uint[](pendingRandomRewardsLength.asUint256() * MAX_RANDOM_REWARDS_PER_ACTION);
    amounts = new uint[](pendingRandomRewardsLength.asUint256() * MAX_RANDOM_REWARDS_PER_ACTION);
    queueIds = new uint[](pendingRandomRewardsLength.asUint256() * MAX_RANDOM_REWARDS_PER_ACTION);

    uint length;
    for (U256 iter; iter < pendingRandomRewardsLength; iter = iter.inc()) {
      uint i = iter.asUint256();
      PendingRandomReward storage pendingRandomReward = _pendingRandomRewards[i];
      (ActionRewards memory actionRewards, Skill actionSkill, uint numSpawnedPerHour) = world.getRewardsHelper(
        pendingRandomReward.actionId
      );
      bool isCombat = actionSkill == Skill.COMBAT;
      uint16 monstersKilled = uint16(uint(numSpawnedPerHour * pendingRandomReward.xpElapsedTime) / (SPAWN_MUL * 3600));
      uint8 successPercent = _getSuccessPercent(
        _playerId,
        pendingRandomReward.actionId,
        actionSkill,
        isCombat,
        _pendingQueuedActionProcessed
      );
      uint oldLength = length;
      bool processedAny;
      uint numTickets = isCombat ? monstersKilled : pendingRandomReward.xpElapsedTime / 3600;
      (length, processedAny) = _appendRandomRewards(
        _playerId,
        pendingRandomReward.startTime,
        pendingRandomReward.xpElapsedTime,
        numTickets,
        ids,
        amounts,
        oldLength,
        actionRewards,
        successPercent,
        pendingRandomReward.fullAttireBonusRewardsPercent
      );

      if (processedAny) {
        numRemoved = numRemoved.inc();
      }

      if (oldLength != length) {
        uint boostedTime = PlayersLibrary.getBoostedTime(
          pendingRandomReward.startTime,
          pendingRandomReward.xpElapsedTime,
          pendingRandomReward.boostStartTime,
          pendingRandomReward.boostDuration
        );
        U256 bounds = length.asU256();
        if (boostedTime != 0 && pendingRandomReward.boostType == BoostType.GATHERING) {
          // TODO: Should probably accumulate these to get a higher precision boosted amount
          // if there are multiple pending random rewards per action
          for (U256 jter; jter < bounds; jter = jter.inc()) {
            uint j = jter.asUint256();
            amounts[j] += uint32(
              (boostedTime * amounts[j] * pendingRandomReward.boostValue) / (pendingRandomReward.xpElapsedTime * 100)
            );
          }
        }
        for (U256 kter; kter < bounds; kter = kter.inc()) {
          uint k = kter.asUint256();
          queueIds[k] = pendingRandomReward.queueId;
        }
      }
    }

    assembly ("memory-safe") {
      mstore(ids, length)
      mstore(amounts, length)
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
    QueuedAction[] memory _remainingQueuedActions,
    QueuedAction storage _queuedAction,
    uint _timespan,
    uint _elapsedTime,
    uint _xpElapsedTime,
    uint _length
  ) private pure {
    QueuedAction memory remainingAction = _queuedAction;
    remainingAction.timespan = uint24(_timespan);
    remainingAction.prevProcessedTime += uint24(_elapsedTime);
    remainingAction.prevProcessedXPTime += uint24(_xpElapsedTime);
    // Build a list of the skills queued that remain
    _remainingQueuedActions[_length] = remainingAction;
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
        numRewards = (_monstersKilled * _rewardRate) / GUAR_MUL; // rate is per kill
      } else {
        numRewards = (_elapsedTime.mul(_rewardRate).mul(_successPercent)).div(3600 * GUAR_MUL * 100);
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
    uint8 _successPercent,
    uint8 fullAttireBonusRewardsPercent
  ) private view returns (uint length, bool hasRandomWord) {
    length = _oldLength;

    RandomReward[] memory _randomRewards = _setupRandomRewards(_actionRewards);

    if (_randomRewards.length != 0) {
      uint skillEndTime = _skillStartTime.add(_elapsedTime);
      hasRandomWord = world.hasRandomWord(skillEndTime);
      if (hasRandomWord) {
        uint numIterations = Math.min(MAX_UNIQUE_TICKETS_, _numTickets);

        bytes memory randomBytes = world.getRandomBytes(numIterations, skillEndTime, _playerId);
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
          uint operation = (uint(_getSlice(randomBytes, i)) * 100) / _successPercent;
          uint extraChance = (operation * fullAttireBonusRewardsPercent) / 100;
          if (operation > extraChance) {
            operation -= extraChance;
          } else {
            operation = 1;
          }
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
    PendingQueuedActionProcessed memory _pendingQueuedActionProcessed
  )
    private
    view
    returns (
      Equipment[] memory consumedEquipment,
      Equipment memory producedEquipment,
      uint xpElapsedTime,
      bool died,
      uint16 foodConsumed,
      uint16 baseInputItemsConsumedNum
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
        _pendingQueuedActionProcessed
      )
    );
    return abi.decode(data, (Equipment[], Equipment, uint, bool, uint16, uint16));
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
