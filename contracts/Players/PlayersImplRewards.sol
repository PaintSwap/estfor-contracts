// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {UnsafeMath, U256} from "@0xdoublesharp/unsafe-math/contracts/UnsafeMath.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {PlayersImplBase} from "./PlayersImplBase.sol";
import {PlayersBase} from "./PlayersBase.sol";
import {PlayersLibrary} from "./PlayersLibrary.sol";
import {IPlayersRewardsDelegateView, IPlayersMiscDelegateView} from "../interfaces/IPlayersDelegates.sol";

// solhint-disable-next-line no-global-import
import "../globals/all.sol";

contract PlayersImplRewards is PlayersImplBase, PlayersBase, IPlayersRewardsDelegateView {
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
    pendingQueuedActionState.worldLocation = uint8(player.packedData & bytes1(uint8(0x0F)));
    pendingQueuedActionState.equipmentStates = new PendingQueuedActionEquipmentState[](actionQueue.length + 1); // reserve +1 for handling the previously processed in current action
    pendingQueuedActionState.actionMetadatas = new PendingQueuedActionMetadata[](actionQueue.length + 1);

    PendingQueuedActionProcessed memory pendingQueuedActionProcessed = pendingQueuedActionState.processedData;
    pendingQueuedActionProcessed.skills = new Skill[](actionQueue.length * 2); // combat can have xp rewarded in 2 skills (combat + health)
    pendingQueuedActionProcessed.xpGainedSkills = new uint32[](actionQueue.length * 2);
    uint pendingQueuedActionProcessedLength;

    // This is done so that we can start the full XP calculation using the same stats as when the action was originally started
    PendingQueuedActionData memory currentActionProcessed = pendingQueuedActionProcessed.currentAction;
    currentActionProcessed.skill1 = player.currentActionProcessedSkill1;
    currentActionProcessed.xpGained1 = player.currentActionProcessedXPGained1;
    currentActionProcessed.skill2 = player.currentActionProcessedSkill2;
    currentActionProcessed.xpGained2 = player.currentActionProcessedXPGained2;
    currentActionProcessed.skill3 = player.currentActionProcessedSkill3;
    currentActionProcessed.xpGained3 = player.currentActionProcessedXPGained3;
    currentActionProcessed.foodConsumed = player.currentActionProcessedFoodConsumed;
    currentActionProcessed.baseInputItemsConsumedNum = player.currentActionProcessedBaseInputItemsConsumedNum;

    pendingQueuedActionState.remainingQueuedActions = new QueuedAction[](actionQueue.length);
    uint remainingQueuedActionsLength;

    // Past Random Rewards
    PendingQueuedActionProcessed memory emptyPendingQueuedActionProcessed;
    (
      uint[] memory ids,
      uint[] memory amounts,
      uint[] memory queueIds,
      uint numPastRandomRewardInstancesToRemove
    ) = _claimableRandomRewards(_playerId, emptyPendingQueuedActionProcessed);
    U256 idsLength = ids.length.asU256();

    pendingQueuedActionState.producedPastRandomRewards = new PastRandomRewardInfo[](
      actionQueue.length * MAX_RANDOM_REWARDS_PER_ACTION + ids.length
    );
    uint producedPastRandomRewardsLength;

    for (U256 iter; iter < idsLength; iter = iter.inc()) {
      uint i = iter.asUint256();
      pendingQueuedActionState.producedPastRandomRewards[producedPastRandomRewardsLength++] = PastRandomRewardInfo(
        uint64(queueIds[i]),
        uint16(ids[i]),
        uint24(amounts[i])
      );
    }

    pendingQueuedActionState.numPastRandomRewardInstancesToRemove = numPastRandomRewardInstancesToRemove;

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
    Skill firstRemainingActionSkill; // Can be Skill.COMBAT or Skill.TRAVELING
    for (U256 iter; iter < bounds; iter = iter.inc()) {
      uint i = iter.asUint256();
      PendingQueuedActionEquipmentState memory pendingQueuedActionEquipmentState = pendingQueuedActionState
        .equipmentStates[i];
      PendingQueuedActionMetadata memory pendingQueuedActionMetadata = pendingQueuedActionState.actionMetadatas[i];
      pendingQueuedActionEquipmentState.producedItemTokenIds = new uint[](MAX_GUARANTEED_REWARDS_PER_ACTION);
      pendingQueuedActionEquipmentState.producedAmounts = new uint[](MAX_GUARANTEED_REWARDS_PER_ACTION);
      uint producedLength;
      pendingQueuedActionEquipmentState.consumedItemTokenIds = new uint[](MAX_CONSUMED_PER_ACTION);
      pendingQueuedActionEquipmentState.consumedAmounts = new uint[](MAX_CONSUMED_PER_ACTION);
      uint consumedLength;

      QueuedAction storage queuedAction = actionQueue[i];
      uint32 pointsAccrued;
      uint endTime = startTime + queuedAction.timespan;

      (ActionRewards memory actionRewards, Skill actionSkill, uint numSpawnedPerHour, uint8 worldLocation) = world
        .getRewardsHelper(queuedAction.actionId);

      uint elapsedTime = _getElapsedTime(startTime, endTime);
      bool correctWorldLocation = worldLocation == pendingQueuedActionState.worldLocation;
      if (elapsedTime == 0 || !correctWorldLocation) {
        _addRemainingQueuedAction(
          pendingQueuedActionState.remainingQueuedActions,
          queuedAction,
          queuedAction.timespan,
          0,
          0,
          remainingQueuedActionsLength
        );
        remainingQueuedActionsLength = remainingQueuedActionsLength.inc();
        startTime += queuedAction.timespan;
        continue;
      }

      // Also need to check the starting location is valid
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

      ActionChoice memory actionChoice;
      if (queuedAction.choiceId != 0) {
        actionChoice = world.getActionChoice(isCombat ? 0 : queuedAction.actionId, queuedAction.choiceId);
      }

      bool missingRequiredHandEquipment;
      (missingRequiredHandEquipment, combatStats) = PlayersLibrary.updateStatsFromHandEquipment(
        from,
        itemNFT,
        [queuedAction.rightHandEquipmentTokenId, queuedAction.leftHandEquipmentTokenId],
        combatStats,
        isCombat,
        pendingQueuedActionState.equipmentStates,
        actionChoice
      );

      if (missingRequiredHandEquipment) {
        if (i == 0) {
          // Clear the state and make sure the next queued action can finish
          clearActionProcessed(currentActionProcessed);
        }
        startTime += queuedAction.timespan;
        continue;
      }
      ++pendingQueuedActionStateLength;

      pendingQueuedActionMetadata.elapsedTime = uint24(elapsedTime);
      pendingQueuedActionMetadata.actionId = queuedAction.actionId;
      pendingQueuedActionMetadata.queueId = queuedAction.queueId;

      // Create some items if necessary (smithing ores to bars for instance)
      bool fullyFinished = elapsedTime >= queuedAction.timespan;
      bool died;
      firstRemainingActionSkill = actionSkill;
      bool actionHasRandomRewards = actionRewards.randomRewardTokenId1 != NONE;
      uint xpElapsedTime = elapsedTime;
      uint prevXPElapsedTime = queuedAction.prevProcessedXPTime;
      uint16 foodConsumed;
      uint16 baseInputItemsConsumedNum;
      if (queuedAction.choiceId != 0) {
        Equipment[] memory consumedEquipments;
        Equipment memory producedEquipment;
        (
          consumedEquipments,
          producedEquipment,
          xpElapsedTime,
          died,
          foodConsumed,
          baseInputItemsConsumedNum
        ) = _processConsumablesView(
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

        if (fullyFinished && actionSkill == Skill.TRAVELING) {
          // Get the new world location
          pendingQueuedActionState.worldLocation = uint8(actionChoice.outputAmount);
        }
      } else {
        // No action choice
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

      if (prevProcessedTime != 0) {
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
          (
            uint[] memory newIds,
            uint[] memory newAmounts,
            uint[] memory newRandomIds,
            uint[] memory newRandomAmounts
          ) = _getRewards(
              _playerId,
              uint40(startTime),
              prevXPElapsedTime,
              xpElapsedTime,
              elapsedTime,
              prevProcessedTime,
              queuedAction.actionId,
              pendingQueuedActionProcessed,
              fullAttireBonusRewardsPercent
            );

          // Guaranteed rewards
          U256 newIdsLength = newIds.length.asU256();
          for (U256 jter; jter < newIdsLength; jter = jter.inc()) {
            uint j = jter.asUint256();
            pendingQueuedActionEquipmentState.producedItemTokenIds[producedLength] = newIds[j];
            pendingQueuedActionEquipmentState.producedAmounts[producedLength] = newAmounts[j];
            producedLength = producedLength.inc();
          }

          // Random rewards that can be claimed already from actions which ended in the previous 00:00
          // and processing is done afterwards and the oracle is called, so no pending dice rolls are needed
          U256 newRandomIdsLength = newRandomIds.length.asU256();
          for (U256 jter; jter < newRandomIdsLength; jter = jter.inc()) {
            uint j = jter.asUint256();
            pendingQueuedActionState.producedPastRandomRewards[
              producedPastRandomRewardsLength++
            ] = PastRandomRewardInfo(
              uint64(queuedAction.queueId),
              uint16(newRandomIds[j]),
              uint24(newRandomAmounts[j])
            );
          }
        }
      }

      if (!fullyFinished) {
        // Add the remainder if this action is not fully consumed
        uint remainingTimespan = queuedAction.timespan - elapsedTime;
        _addRemainingQueuedAction(
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
          if (pointsAccrued > 0) {
            currentActionProcessed.skill1 = skill;
            currentActionProcessed.xpGained1 += uint24(pointsAccrued);
            if (hasCombatXP) {
              currentActionProcessed.skill2 = Skill.HEALTH;
              currentActionProcessed.xpGained2 += uint24(healthPointsGained);
            }
          }

          currentActionProcessed.foodConsumed += foodConsumed;
          currentActionProcessed.baseInputItemsConsumedNum += baseInputItemsConsumedNum;
        } else {
          // Set it absolutely, this is a fresh "first action"
          if (pointsAccrued > 0) {
            currentActionProcessed.skill1 = skill;
            currentActionProcessed.xpGained1 = uint24(pointsAccrued);
            if (hasCombatXP) {
              currentActionProcessed.skill2 = Skill.HEALTH;
              currentActionProcessed.xpGained2 = uint24(healthPointsGained);
            } else {
              currentActionProcessed.skill2 = Skill.NONE;
              currentActionProcessed.xpGained2 = 0;
            }
          }
          currentActionProcessed.foodConsumed = foodConsumed;
          currentActionProcessed.baseInputItemsConsumedNum = baseInputItemsConsumedNum;
        }
      } else {
        clearActionProcessed(currentActionProcessed);
      }

      // Total XP gained
      pendingQueuedActionMetadata.xpGained = xpGained;
      totalXPGained += xpGained;

      uint24 _sentinelElapsedTime = skill == Skill.THIEVING
        ? uint24(elapsedTime)
        : uint24((block.timestamp - startTime) >= type(uint24).max ? type(uint24).max : block.timestamp - startTime);

      // Number of pending reward rolls
      if (actionHasRandomRewards) {
        bool hasRandomWord = world.hasRandomWord(startTime + _sentinelElapsedTime);
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

    for (uint i = 0; i < questState.xpGainedSkills.length; ++i) {
      totalXPGained += questState.xpGainedSkills[i];

      if (remainingQueuedActionsLength != 0) {
        Skill questSkill = questState.skills[i];
        uint24 xpGainedSkill = uint24(questState.xpGainedSkills[i]);
        if (currentActionProcessed.skill1 == questSkill) {
          currentActionProcessed.xpGained1 += xpGainedSkill;
        } else if (currentActionProcessed.skill2 == questSkill) {
          currentActionProcessed.xpGained2 += xpGainedSkill;
        } else if (firstRemainingActionSkill == Skill.COMBAT && questSkill == Skill.DEFENCE) {
          // Special case for combat where you are training attack
          currentActionProcessed.skill3 = questSkill;
          currentActionProcessed.xpGained3 += xpGainedSkill;
        }
      }
    }

    // XPRewards
    if (totalXPGained != 0) {
      (
        pendingQueuedActionState.xpRewardItemTokenIds,
        pendingQueuedActionState.xpRewardAmounts
      ) = _claimableXPThresholdRewards(previousTotalXP, previousTotalXP + totalXPGained);
    }

    assembly ("memory-safe") {
      mstore(actionIds, actionIdsLength)
      mstore(actionAmounts, actionIdsLength)

      mstore(choiceIds, choiceIdsLength)
      mstore(choiceAmounts, choiceIdsLength)
    }

    // Daily rewards
    (
      pendingQueuedActionState.dailyRewardItemTokenIds,
      pendingQueuedActionState.dailyRewardAmounts,
      pendingQueuedActionState.dailyRewardMask
    ) = _dailyRewardsView(_playerId);

    // Any Lottery winnings
    pendingQueuedActionState.lotteryWinner = wishingWell.getUnclaimedLotteryWinnings(_playerId);

    // Compact to fit the arrays
    assembly ("memory-safe") {
      mstore(mload(pendingQueuedActionState), pendingQueuedActionStateLength)
      mstore(mload(add(pendingQueuedActionState, 32)), pendingQueuedActionStateLength)
      mstore(mload(add(pendingQueuedActionState, 64)), remainingQueuedActionsLength)
      mstore(mload(add(pendingQueuedActionState, 96)), producedPastRandomRewardsLength)

      mstore(mload(pendingQueuedActionProcessed), pendingQueuedActionProcessedLength)
      mstore(mload(add(pendingQueuedActionProcessed, 32)), pendingQueuedActionProcessedLength)
    }
  }

  function claimRandomRewards(
    uint _playerId,
    PendingQueuedActionProcessed memory _pendingQueuedActionProcessed
  ) external {
    address from = msg.sender;
    (
      uint[] memory ids,
      uint[] memory amounts,
      uint[] memory queueIds,
      uint numPastRandomRewardInstancesToRemove
    ) = _claimableRandomRewards(_playerId, _pendingQueuedActionProcessed);
    _processClaimableRewards(from, _playerId, ids, amounts, queueIds, numPastRandomRewardInstancesToRemove);
  }

  function _getRewards(
    uint _playerId,
    uint40 _startTime,
    uint _prevXPElapsedTime,
    uint _xpElapsedTime,
    uint _elapsedTime,
    uint _prevProcessedTime,
    uint16 _actionId,
    PendingQueuedActionProcessed memory _pendingQueuedActionProcessed,
    uint8 _fullAttireBonusRewardsPercent
  )
    private
    view
    returns (uint[] memory ids, uint[] memory amounts, uint[] memory randomIds, uint[] memory randomAmounts)
  {
    (ActionRewards memory actionRewards, Skill actionSkill, uint numSpawnedPerHour, ) = world.getRewardsHelper(
      _actionId
    );
    bool isCombat = actionSkill == Skill.COMBAT;

    uint16 monstersKilledFull = uint16(
      (numSpawnedPerHour * (_prevXPElapsedTime + _xpElapsedTime)) / (SPAWN_MUL * 3600)
    );
    uint8 successPercent = _getSuccessPercent(
      _playerId,
      _actionId,
      actionSkill,
      isCombat,
      _pendingQueuedActionProcessed
    );

    uint veryStartTime = _startTime.sub(_prevProcessedTime);
    // Full
    uint length;
    (ids, amounts, length) = _getGuaranteedRewards(
      _playerId,
      uint40(veryStartTime),
      _prevXPElapsedTime + _xpElapsedTime,
      actionRewards,
      monstersKilledFull,
      isCombat,
      successPercent
    );
    // Previously accumulated
    uint[] memory prevNewIds;
    uint[] memory prevNewAmounts;
    if (_prevXPElapsedTime != 0) {
      uint prevLength;
      uint16 monstersKilled = uint16((numSpawnedPerHour * _prevXPElapsedTime) / (SPAWN_MUL * 3600));

      (prevNewIds, prevNewAmounts, prevLength) = _getGuaranteedRewards(
        _playerId,
        uint40(veryStartTime),
        _prevXPElapsedTime,
        actionRewards,
        monstersKilled,
        isCombat,
        successPercent
      );
    }

    // Subtract any rewards that were already claimed
    if (prevNewIds.length != 0) {
      (ids, amounts) = PlayersLibrary.subtractMatchingRewards(ids, amounts, prevNewIds, prevNewAmounts);
    }

    // Any random rewards unlocked. Only thieving because it doesn't have any dynamic components
    if (actionSkill == Skill.THIEVING) {
      (randomIds, randomAmounts, ) = _getRandomRewards(
        _playerId,
        _startTime + uint24(_elapsedTime),
        _xpElapsedTime / 3600,
        actionRewards,
        successPercent,
        _fullAttireBonusRewardsPercent
      );
    }

    // Check for any boosts for random rewards (guaranteed rewards already have boosts applied)
    PlayerBoostInfo storage activeBoost = activeBoosts_[_playerId];
    if (activeBoost.boostType == BoostType.GATHERING) {
      uint boostedTime = PlayersLibrary.getBoostedTime(
        _startTime,
        _xpElapsedTime,
        activeBoost.startTime,
        activeBoost.duration
      );
      _addGatheringBoostedAmounts(boostedTime, randomAmounts, activeBoost.value, _elapsedTime);
    }
  }

  function _addGatheringBoostedAmounts(
    uint _boostedTime,
    uint[] memory _amounts,
    uint _boostedVal,
    uint _xpElapsedTime
  ) private pure {
    if (_xpElapsedTime != 0) {
      U256 bounds = _amounts.length.asU256();
      for (U256 iter; iter < bounds; iter = iter.inc()) {
        uint i = iter.asUint256();
        // amounts[i] takes into account the whole elapsed time so additional boosted amount is a fraction of that.
        _amounts[i] += uint32((_boostedTime * _amounts[i] * _boostedVal) / (_xpElapsedTime * 100));
      }
    }
  }

  function _getGuaranteedRewards(
    uint _playerId,
    uint40 _skillStartTime,
    uint _xpElapsedTime,
    ActionRewards memory _actionRewards,
    uint16 _monstersKilled,
    bool _isCombat,
    uint8 _successPercent
  ) private view returns (uint[] memory ids, uint[] memory amounts, uint length) {
    ids = new uint[](MAX_GUARANTEED_REWARDS_PER_ACTION);
    amounts = new uint[](MAX_GUARANTEED_REWARDS_PER_ACTION);

    length = _appendGuaranteedRewards(
      ids,
      amounts,
      _xpElapsedTime,
      _actionRewards,
      _monstersKilled,
      _isCombat,
      _successPercent
    );

    assembly ("memory-safe") {
      mstore(ids, length)
      mstore(amounts, length)
    }

    // Check for any boosts
    PlayerBoostInfo storage activeBoost = activeBoosts_[_playerId];
    if (activeBoost.boostType == BoostType.GATHERING) {
      uint boostedTime = PlayersLibrary.getBoostedTime(
        _skillStartTime,
        _xpElapsedTime,
        activeBoost.startTime,
        activeBoost.duration
      );
      _addGatheringBoostedAmounts(boostedTime, amounts, activeBoost.value, _xpElapsedTime);
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
  )
    private
    view
    returns (
      uint[] memory ids,
      uint[] memory amounts,
      uint[] memory queueIds,
      uint numPastRandomRewardInstancesToRemove
    )
  {
    PendingRandomReward[] storage _pendingRandomRewards = pendingRandomRewards[_playerId];
    U256 pendingRandomRewardsLength = _pendingRandomRewards.length.asU256();
    ids = new uint[](pendingRandomRewardsLength.asUint256() * MAX_RANDOM_REWARDS_PER_ACTION);
    amounts = new uint[](pendingRandomRewardsLength.asUint256() * MAX_RANDOM_REWARDS_PER_ACTION);
    queueIds = new uint[](pendingRandomRewardsLength.asUint256() * MAX_RANDOM_REWARDS_PER_ACTION);

    uint length;
    for (U256 iter; iter < pendingRandomRewardsLength; iter = iter.inc()) {
      uint i = iter.asUint256();
      PendingRandomReward storage pendingRandomReward = _pendingRandomRewards[i];
      (ActionRewards memory actionRewards, Skill actionSkill, uint numSpawnedPerHour, ) = world.getRewardsHelper(
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
      bool processedAny;

      // TODO: Remove everything related to this later
      // boostType was removed and shifted everything up in the PendingRandomReward struct
      bool isLegacyWithBoostPendingRandomReward = pendingRandomReward.boostItemTokenId != 0 &&
        pendingRandomReward.boostItemTokenId < 10;
      uint numTickets = isCombat ? monstersKilled : pendingRandomReward.xpElapsedTime / 3600;

      uint[] memory randomIds;
      uint[] memory randomAmounts;
      (randomIds, randomAmounts, processedAny) = _getRandomRewards(
        _playerId,
        pendingRandomReward.startTime + pendingRandomReward.sentinelElapsedTime,
        numTickets,
        actionRewards,
        successPercent,
        pendingRandomReward.fullAttireBonusRewardsPercent
      );

      if (processedAny) {
        numPastRandomRewardInstancesToRemove = numPastRandomRewardInstancesToRemove.inc();
      }

      if (randomIds.length != 0) {
        if (!isLegacyWithBoostPendingRandomReward && pendingRandomReward.boostItemTokenId != NONE) {
          // Check for boosts
          (BoostType boostType, uint16 boostValue, uint24 boostDuration) = itemNFT.getBoostInfo(
            pendingRandomReward.boostItemTokenId
          );
          if (boostType == BoostType.GATHERING) {
            uint elapsedTime = pendingRandomReward.elapsedTime;

            uint boostedTime = PlayersLibrary.getBoostedTime(
              pendingRandomReward.startTime,
              elapsedTime,
              pendingRandomReward.boostStartTime,
              boostDuration
            );

            _addGatheringBoostedAmounts(boostedTime, randomAmounts, boostValue, elapsedTime);
          }
        }

        // Copy into main arrays
        uint oldLength = length;
        for (uint j = 0; j < randomIds.length; ++j) {
          ids[j + oldLength] = randomIds[j];
          amounts[j + oldLength] = randomAmounts[j];
          queueIds[j + oldLength] = pendingRandomReward.queueId;
          ++length;
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
      globalBoost_,
      clanBoosts_[clans.getClanId(_playerId)],
      itemNFT,
      world,
      fullAttireBonus[_skill].bonusXPPercent,
      fullAttireBonus[_skill].itemTokenIds,
      _pendingQueuedActionEquipmentStates
    );
  }

  function _addRemainingQueuedAction(
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

  function _getRandomRewards(
    uint _playerId,
    uint40 _sentinelTimestamp,
    uint _numTickets,
    ActionRewards memory _actionRewards,
    uint8 _successPercent,
    uint8 fullAttireBonusRewardsPercent
  ) private view returns (uint[] memory ids, uint[] memory amounts, bool hasRandomWord) {
    bytes memory data = _staticcall(
      address(this),
      abi.encodeWithSelector(
        IPlayersMiscDelegateView.getRandomRewards.selector,
        _playerId,
        _sentinelTimestamp,
        _numTickets,
        _actionRewards,
        _successPercent,
        fullAttireBonusRewardsPercent
      )
    );
    return abi.decode(data, (uint[], uint[], bool));
  }

  function _processConsumablesView(
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
        IPlayersMiscDelegateView.processConsumablesView.selector,
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

  function clearActionProcessed(PendingQueuedActionData memory currentActionProcessed) private pure {
    // Clear it
    currentActionProcessed.skill1 = Skill.NONE;
    currentActionProcessed.xpGained1 = 0;
    currentActionProcessed.skill2 = Skill.NONE;
    currentActionProcessed.xpGained2 = 0;
    currentActionProcessed.skill3 = Skill.NONE;
    currentActionProcessed.xpGained3 = 0;
    currentActionProcessed.foodConsumed = 0;
    currentActionProcessed.baseInputItemsConsumedNum = 0;
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
