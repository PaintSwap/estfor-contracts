// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {UnsafeMath, U256} from "@0xdoublesharp/unsafe-math/contracts/UnsafeMath.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {PlayersImplBase} from "./PlayersImplBase.sol";
import {PlayersBase} from "./PlayersBase.sol";
import {PlayersLibrary} from "./PlayersLibrary.sol";
import {IPlayersRewardsDelegateView, IPlayersMiscDelegateView} from "../interfaces/IPlayersDelegates.sol";

import {CombatStyleLibrary} from "../libraries/CombatStyleLibrary.sol";
import {SkillLibrary} from "../libraries/SkillLibrary.sol";

// solhint-disable-next-line no-global-import
import "../globals/all.sol";

contract PlayersImplRewards is PlayersImplBase, PlayersBase, IPlayersRewardsDelegateView {
  using UnsafeMath for U256;
  using UnsafeMath for uint256;
  using UnsafeMath for uint40;
  using UnsafeMath for uint24;
  using UnsafeMath for uint16;
  using CombatStyleLibrary for uint8;
  using CombatStyleLibrary for CombatStyle;
  using SkillLibrary for Skill;

  constructor() {
    _checkStartSlot();
  }

  // Get any changes that are pending and not commited to the blockchain yet.
  // Such as items consumed/produced, xp gained, whether the player died, pending random reward rolls & quest rewards.
  function pendingQueuedActionStateImpl(
    address owner,
    uint256 playerId
  ) external view returns (PendingQueuedActionState memory pendingQueuedActionState) {
    Player storage player = _players[playerId];
    QueuedAction[] storage actionQueue = player.actionQueue;
    pendingQueuedActionState.worldLocation = uint8(player.packedData & bytes1(uint8(0x0F)));
    pendingQueuedActionState.equipmentStates = new PendingQueuedActionEquipmentState[](actionQueue.length + 1); // reserve +1 for handling the previously processed in current action
    pendingQueuedActionState.actionMetadatas = new PendingQueuedActionMetadata[](actionQueue.length + 1);

    PendingQueuedActionProcessed memory pendingQueuedActionProcessed = pendingQueuedActionState.processedData;
    pendingQueuedActionProcessed.skills = new Skill[](actionQueue.length * 2); // combat can have xp rewarded in 2 skills (combat + health)
    pendingQueuedActionProcessed.xpGainedSkills = new uint32[](actionQueue.length * 2);
    uint256 pendingQueuedActionProcessedLength;

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
    uint256 remainingQueuedActionsLength;

    // Past Random Rewards
    PendingQueuedActionProcessed memory emptyPendingQueuedActionProcessed;
    (
      uint256[] memory ids,
      uint256[] memory amounts,
      uint256[] memory queueIds,
      uint256 numPastRandomRewardInstancesToRemove
    ) = _claimableRandomRewards(playerId, emptyPendingQueuedActionProcessed);
    U256 idsLength = ids.length.asU256();

    pendingQueuedActionState.producedPastRandomRewards = new PastRandomRewardInfo[](
      actionQueue.length * MAX_RANDOM_REWARDS_PER_ACTION + ids.length
    );
    uint256 producedPastRandomRewardsLength;

    for (U256 iter; iter < idsLength; iter = iter.inc()) {
      uint256 i = iter.asUint256();
      pendingQueuedActionState.producedPastRandomRewards[producedPastRandomRewardsLength++] = PastRandomRewardInfo(
        uint64(queueIds[i]),
        uint16(ids[i]),
        uint24(amounts[i])
      );
    }

    pendingQueuedActionState.numPastRandomRewardInstancesToRemove = numPastRandomRewardInstancesToRemove;

    uint256[] memory actionIds = new uint256[](actionQueue.length);
    uint256[] memory actionAmounts = new uint256[](actionQueue.length);
    uint256[] memory choiceIds = new uint256[](actionQueue.length);
    uint256[] memory choiceAmounts = new uint256[](actionQueue.length);
    uint256 actionIdsLength;
    uint256 choiceIdsLength;

    address from = owner;
    if (playerNFT.balanceOf(owner, playerId) == 0) {
      revert NotOwnerOfPlayer();
    }
    uint256 previousTotalXP = player.totalXP;
    uint256 totalXPGained;
    U256 bounds = actionQueue.length.asU256();
    uint256 pendingQueuedActionStateLength;
    uint256 startTime = _players[playerId].currentActionStartTime;
    Skill firstRemainingActionSkill; // Might also be the non-actual skills Skill.COMBAT or Skill.TRAVELING
    uint256 numActionsSkipped;
    for (U256 iter; iter < bounds; iter = iter.inc()) {
      uint256 i = iter.asUint256();
      QueuedAction storage queuedAction = actionQueue[i];

      i -= numActionsSkipped;
      PendingQueuedActionEquipmentState memory pendingQueuedActionEquipmentState = pendingQueuedActionState
        .equipmentStates[i];
      PendingQueuedActionMetadata memory pendingQueuedActionMetadata = pendingQueuedActionState.actionMetadatas[i];
      pendingQueuedActionEquipmentState.producedItemTokenIds = new uint256[](MAX_GUARANTEED_REWARDS_PER_ACTION);
      pendingQueuedActionEquipmentState.producedAmounts = new uint256[](MAX_GUARANTEED_REWARDS_PER_ACTION);
      uint256 producedLength;
      pendingQueuedActionEquipmentState.consumedItemTokenIds = new uint256[](MAX_CONSUMED_PER_ACTION);
      pendingQueuedActionEquipmentState.consumedAmounts = new uint256[](MAX_CONSUMED_PER_ACTION);
      uint256 consumedLength;

      uint32 pointsAccrued;
      uint256 endTime = startTime + queuedAction.timespan;

      (ActionRewards memory actionRewards, Skill actionSkill, uint256 numSpawnedPerHour, uint8 worldLocation) = world
        .getRewardsHelper(queuedAction.actionId);

      uint256 elapsedTime = _getElapsedTime(startTime, endTime);
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
        ++numActionsSkipped;
        startTime += queuedAction.timespan;
        continue;
      }

      uint256 prevProcessedTime = queuedAction.prevProcessedTime;
      uint256 veryStartTime = startTime.sub(prevProcessedTime);

      bool isCombat = queuedAction.combatStyle.asCombatStyle().isCombat();
      ActionChoice memory actionChoice;
      if (queuedAction.choiceId != 0) {
        actionChoice = world.getActionChoice(isCombat ? 0 : queuedAction.actionId, queuedAction.choiceId);
      }

      CombatStats memory combatStats;
      if (isCombat) {
        combatStats = PlayersLibrary.getCombatStatsFromHero(pendingQueuedActionProcessed, _playerXP[playerId]);
        if (queuedAction.choiceId != 0) {
          combatStats = PlayersLibrary.updateCombatStatsFromSkill(
            combatStats,
            uint8(actionChoice.skill),
            actionChoice.skillDiff
          );
        }

        // Update combat stats from the pet if it is still valid.
        // The pet enhancements only take into account base hero stats, not any bonuses from equipment.
        if (_hasPet(queuedAction.packed)) {
          Pet memory pet = petNFT.getPet(_queuedActionsExtra[queuedAction.queueId].petId);
          if (pet.owner == from && pet.lastAssignmentTimestamp <= veryStartTime) {
            combatStats = PlayersLibrary.updateCombatStatsFromPet(
              combatStats,
              uint8(pet.skillEnhancement1),
              pet.skillFixedEnhancement1,
              pet.skillPercentageEnhancement1,
              uint8(pet.skillEnhancement2),
              pet.skillFixedEnhancement2,
              pet.skillPercentageEnhancement2
            );
          }
        }

        combatStats = PlayersLibrary.updateCombatStatsFromAttire(
          combatStats,
          from,
          address(itemNFT),
          _attire[playerId][queuedAction.queueId],
          pendingQueuedActionState.equipmentStates
        );
      }

      bool missingRequiredHandEquipment;
      (missingRequiredHandEquipment, combatStats) = PlayersLibrary.updateStatsFromHandEquipment(
        from,
        address(itemNFT),
        [queuedAction.rightHandEquipmentTokenId, queuedAction.leftHandEquipmentTokenId],
        combatStats,
        isCombat,
        pendingQueuedActionState.equipmentStates,
        actionChoice
      );

      if (missingRequiredHandEquipment) {
        if (i == 0) {
          // Clear the state and make sure the next queued action can finish
          _clearActionProcessed(currentActionProcessed);
        }
        ++numActionsSkipped;
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
      uint256 xpElapsedTime = elapsedTime;
      uint256 prevXPElapsedTime = queuedAction.prevProcessedXPTime;
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
          playerId,
          queuedAction,
          actionChoice,
          combatStats,
          elapsedTime,
          startTime,
          pendingQueuedActionState.equipmentStates,
          pendingQueuedActionState.processedData
        );
        uint256 numChoicesCompleted;
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

        uint256 numActionsCompleted;
        if (actionSkill.isCombat()) {
          // Want monsters killed
          uint256 prevActionsCompleted = uint16((numSpawnedPerHour * prevXPElapsedTime) / (3600 * SPAWN_MUL));
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
          uint256 j = jter.asUint256();
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
          uint256 previouslyRefundedTime;
          uint256 refundTime;
          if (hasGuaranteedRewards) {
            uint256 numProduced = (uint256(queuedAction.prevProcessedTime) * actionRewards.guaranteedRewardRate1) /
              (3600 * GUAR_MUL);
            previouslyRefundedTime =
              queuedAction.prevProcessedTime -
              (numProduced * (3600 * GUAR_MUL)) /
              actionRewards.guaranteedRewardRate1;

            // Get remainder for current too
            uint256 numProduced1 = ((elapsedTime + queuedAction.prevProcessedTime) *
              actionRewards.guaranteedRewardRate1) / (3600 * GUAR_MUL);
            refundTime =
              (elapsedTime + queuedAction.prevProcessedTime) -
              (numProduced1 * (3600 * GUAR_MUL)) /
              actionRewards.guaranteedRewardRate1;
          }

          if (actionHasRandomRewards) {
            uint256 tempRefundTime = queuedAction.prevProcessedTime % 3600;
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
          uint256 refundTime;
          if (hasGuaranteedRewards) {
            uint256 numProduced = (elapsedTime * actionRewards.guaranteedRewardRate1) / (3600 * GUAR_MUL);
            refundTime = elapsedTime - (numProduced * (3600 * GUAR_MUL)) / actionRewards.guaranteedRewardRate1;
          }

          if (actionHasRandomRewards) {
            uint256 tempRefundTime = elapsedTime % 3600;
            if (tempRefundTime > refundTime) {
              refundTime = tempRefundTime;
            }
          }
          xpElapsedTime = xpElapsedTime > refundTime ? xpElapsedTime.sub(refundTime) : 0;
        }

        uint256 numActionsCompleted;
        if (actionSkill == Skill.THIEVING) {
          // Hours thieving (there are no guaranteed rewards for thieving)
          uint256 prevNumActionsCompleted = prevXPElapsedTime / 3600;
          numActionsCompleted = ((xpElapsedTime + prevXPElapsedTime) / 3600) - prevNumActionsCompleted;
        } else {
          // Output produced
          uint256 prevNumActionsCompleted = (uint256(prevXPElapsedTime) * actionRewards.guaranteedRewardRate1) /
            (3600 * GUAR_MUL);
          numActionsCompleted =
            (uint256(prevXPElapsedTime + xpElapsedTime) * actionRewards.guaranteedRewardRate1) /
            (3600 * GUAR_MUL) -
            prevNumActionsCompleted;
        }
        if (numActionsCompleted != 0) {
          actionIds[actionIdsLength] = queuedAction.actionId;
          actionAmounts[actionIdsLength] = numActionsCompleted;
          actionIdsLength = actionIdsLength.inc();
        }
      }

      uint256 pointsAccruedExclBaseBoost;
      uint256 prevPointsAccrued;
      uint256 prevPointsAccruedExclBaseBoost;
      CombatStyle combatStyle = queuedAction.combatStyle.asCombatStyle();
      Skill skill = _getSkillFromChoiceOrStyle(actionChoice, combatStyle, queuedAction.actionId);
      (pointsAccrued, pointsAccruedExclBaseBoost) = _getPointsAccrued(
        from,
        playerId,
        queuedAction,
        veryStartTime,
        skill,
        xpElapsedTime + prevXPElapsedTime,
        pendingQueuedActionState.equipmentStates
      );

      if (prevProcessedTime != 0) {
        (prevPointsAccrued, prevPointsAccruedExclBaseBoost) = _getPointsAccrued(
          from,
          playerId,
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
      if (pointsAccruedExclBaseBoost != 0 && combatStyle.isCombat()) {
        healthPointsGained = _getHealthPointsFromCombat(
          playerId,
          pointsAccruedExclBaseBoost + prevPointsAccruedExclBaseBoost
        );
        if (prevPointsAccrued != 0) {
          // Remove old
          healthPointsGained -= _getHealthPointsFromCombat(playerId, prevPointsAccruedExclBaseBoost);
        }
        xpGained += healthPointsGained;
      }

      bool hasCombatXP = pointsAccruedExclBaseBoost != 0 && combatStyle.isCombat();

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
        uint8 bonusRewardsPercent = _fullAttireBonus[skill].bonusRewardsPercent;
        uint8 fullAttireBonusRewardsPercent = PlayersLibrary.getFullAttireBonusRewardsPercent(
          from,
          _attire[playerId][queuedAction.queueId],
          address(itemNFT),
          pendingQueuedActionState.equipmentStates,
          bonusRewardsPercent,
          _fullAttireBonus[skill].itemTokenIds
        );

        // Full
        if (xpElapsedTime != 0) {
          (
            uint256[] memory newIds,
            uint256[] memory newAmounts,
            uint256[] memory newRandomIds,
            uint256[] memory newRandomAmounts
          ) = _getRewards(
              playerId,
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
            uint256 j = jter.asUint256();
            pendingQueuedActionEquipmentState.producedItemTokenIds[producedLength] = newIds[j];
            pendingQueuedActionEquipmentState.producedAmounts[producedLength] = newAmounts[j];
            producedLength = producedLength.inc();
          }

          // Random rewards that can be claimed already from actions which ended in the previous 00:00
          // and processing is done afterwards and the oracle is called, so no pending dice rolls are needed
          U256 newRandomIdsLength = newRandomIds.length.asU256();
          for (U256 jter; jter < newRandomIdsLength; jter = jter.inc()) {
            uint256 j = jter.asUint256();
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
        uint256 remainingTimespan = queuedAction.timespan - elapsedTime;
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
          if (pointsAccrued != 0) {
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
          if (pointsAccrued != 0) {
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
        _clearActionProcessed(currentActionProcessed);
      }

      // Total XP gained
      pendingQueuedActionMetadata.xpGained = xpGained;
      totalXPGained += xpGained;
      if (actionHasRandomRewards) {
        if (isCombat) {
          // Always add dice rolls for combat
          uint256 prevMonstersKilled = (numSpawnedPerHour * prevXPElapsedTime) / (SPAWN_MUL * 3600);
          uint16 monstersKilled = uint16(
            (numSpawnedPerHour * (xpElapsedTime + prevXPElapsedTime)) / (SPAWN_MUL * 3600) - prevMonstersKilled
          );
          pendingQueuedActionMetadata.rolls = uint32(monstersKilled);
        } else {
          bool hasRandomWord = world.hasRandomWord(startTime + elapsedTime);
          if (!hasRandomWord) {
            uint256 prevRolls = prevXPElapsedTime / 3600;
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
    uint256 burnedAmountOwned;
    uint256 activeQuestBurnedItemTokenId = quests.getActiveQuestBurnedItemTokenId(playerId);
    if (activeQuestBurnedItemTokenId != NONE) {
      burnedAmountOwned = PlayersLibrary.getRealBalance(
        from,
        activeQuestBurnedItemTokenId,
        address(itemNFT),
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
    ) = quests.processQuestsView(playerId, actionIds, actionAmounts, choiceIds, choiceAmounts, burnedAmountOwned);

    for (uint256 i = 0; i < questState.xpGainedSkills.length; ++i) {
      totalXPGained += questState.xpGainedSkills[i];

      if (remainingQueuedActionsLength != 0) {
        Skill questSkill = questState.skills[i];
        uint24 xpGainedSkill = uint24(questState.xpGainedSkills[i]);
        if (currentActionProcessed.skill1 == questSkill) {
          currentActionProcessed.xpGained1 += xpGainedSkill;
        } else if (currentActionProcessed.skill2 == questSkill) {
          currentActionProcessed.xpGained2 += xpGainedSkill;
        } else if (firstRemainingActionSkill.isCombat() && questSkill == Skill.DEFENCE) {
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
    ) = _dailyRewardsView(from, playerId);

    // Any Lottery winnings
    pendingQueuedActionState.lotteryWinner = wishingWell.getUnclaimedLotteryWinnings(playerId);

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
    address from,
    uint256 playerId,
    PendingQueuedActionProcessed memory pendingQueuedActionProcessed
  ) external {
    (
      uint256[] memory ids,
      uint256[] memory amounts,
      uint256[] memory queueIds,
      uint256 numPastRandomRewardInstancesToRemove
    ) = _claimableRandomRewards(playerId, pendingQueuedActionProcessed);
    _processClaimableRewards(from, playerId, ids, amounts, queueIds, numPastRandomRewardInstancesToRemove);
  }

  function _getRewards(
    uint256 playerId,
    uint40 startTime,
    uint256 prevXPElapsedTime,
    uint256 xpElapsedTime,
    uint256 elapsedTime,
    uint256 prevProcessedTime,
    uint16 actionId,
    PendingQueuedActionProcessed memory pendingQueuedActionProcessed,
    uint8 fullAttireBonusRewardsPercent
  )
    private
    view
    returns (uint256[] memory ids, uint256[] memory amounts, uint256[] memory randomIds, uint256[] memory randomAmounts)
  {
    (ActionRewards memory actionRewards, Skill actionSkill, uint256 numSpawnedPerHour, ) = world.getRewardsHelper(
      actionId
    );
    bool isCombat = actionSkill.isCombat();

    uint16 monstersKilledFull = uint16((numSpawnedPerHour * (prevXPElapsedTime + xpElapsedTime)) / (SPAWN_MUL * 3600));
    uint8 successPercent = _getSuccessPercent(playerId, actionId, actionSkill, isCombat, pendingQueuedActionProcessed);

    uint256 veryStartTime = startTime.sub(prevProcessedTime);
    // Full
    uint256 length;
    (ids, amounts, length) = _getGuaranteedRewards(
      playerId,
      uint40(veryStartTime),
      prevXPElapsedTime + xpElapsedTime,
      actionRewards,
      monstersKilledFull,
      isCombat,
      successPercent
    );
    // Previously accumulated
    uint256[] memory prevNewIds;
    uint256[] memory prevNewAmounts;
    if (prevXPElapsedTime != 0) {
      uint256 prevLength;
      uint16 monstersKilled = uint16((numSpawnedPerHour * prevXPElapsedTime) / (SPAWN_MUL * 3600));

      (prevNewIds, prevNewAmounts, prevLength) = _getGuaranteedRewards(
        playerId,
        uint40(veryStartTime),
        prevXPElapsedTime,
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

    // Any random rewards unlocked. Exclude any that have dynamic components (combat and crafting etc)
    if (!actionSkill.isCombat() && actionRewards.randomRewardTokenId1 != NONE) {
      (randomIds, randomAmounts, ) = _getRandomRewards(
        playerId,
        startTime,
        startTime + uint24(elapsedTime),
        xpElapsedTime / 3600,
        actionRewards,
        successPercent,
        fullAttireBonusRewardsPercent
      );
    }

    // Check for any boosts for random rewards (guaranteed rewards already have boosts applied)
    PlayerBoostInfo storage activeBoost = _activeBoosts[playerId];
    if (activeBoost.boostType == BoostType.GATHERING) {
      uint256 boostedTime = PlayersLibrary.getBoostedTime(
        startTime,
        xpElapsedTime,
        activeBoost.startTime,
        activeBoost.duration
      );
      _addGatheringBoostedAmounts(boostedTime, randomAmounts, activeBoost.value, elapsedTime);
    }
  }

  function _addGatheringBoostedAmounts(
    uint256 boostedTime,
    uint256[] memory amounts,
    uint256 boostedVal,
    uint256 xpElapsedTime
  ) private pure {
    if (xpElapsedTime != 0) {
      U256 bounds = amounts.length.asU256();
      for (U256 iter; iter < bounds; iter = iter.inc()) {
        uint256 i = iter.asUint256();
        // amounts[i] takes into account the whole elapsed time so additional boosted amount is a fraction of that.
        amounts[i] += uint32((boostedTime * amounts[i] * boostedVal) / (xpElapsedTime * 100));
      }
    }
  }

  function _getGuaranteedRewards(
    uint256 playerId,
    uint40 skillStartTime,
    uint256 xpElapsedTime,
    ActionRewards memory actionRewards,
    uint16 monstersKilled,
    bool isCombat,
    uint8 successPercent
  ) private view returns (uint256[] memory ids, uint256[] memory amounts, uint256 length) {
    ids = new uint256[](MAX_GUARANTEED_REWARDS_PER_ACTION);
    amounts = new uint256[](MAX_GUARANTEED_REWARDS_PER_ACTION);

    length = _appendGuaranteedRewards(
      ids,
      amounts,
      xpElapsedTime,
      actionRewards,
      monstersKilled,
      isCombat,
      successPercent
    );

    assembly ("memory-safe") {
      mstore(ids, length)
      mstore(amounts, length)
    }

    // Check for any boosts
    PlayerBoostInfo storage activeBoost = _activeBoosts[playerId];
    if (activeBoost.boostType == BoostType.GATHERING) {
      uint256 boostedTime = PlayersLibrary.getBoostedTime(
        skillStartTime,
        xpElapsedTime,
        activeBoost.startTime,
        activeBoost.duration
      );
      _addGatheringBoostedAmounts(boostedTime, amounts, activeBoost.value, xpElapsedTime);
    }
  }

  function _getSuccessPercent(
    uint256 playerId,
    uint16 actionId,
    Skill actionSkill,
    bool isCombat,
    PendingQueuedActionProcessed memory pendingQueuedActionProcessed
  ) private view returns (uint8 successPercent) {
    return
      PlayersLibrary.getSuccessPercent(
        actionId,
        uint8(actionSkill),
        isCombat,
        pendingQueuedActionProcessed,
        address(world),
        MAX_SUCCESS_PERCENT_CHANCE_,
        _playerXP[playerId]
      );
  }

  function _claimableRandomRewards(
    uint256 playerId,
    PendingQueuedActionProcessed memory pendingQueuedActionProcessed
  )
    private
    view
    returns (
      uint256[] memory ids,
      uint256[] memory amounts,
      uint256[] memory queueIds,
      uint256 numPastRandomRewardInstancesToRemove
    )
  {
    PendingRandomReward[] storage pendingRandomRewards = _pendingRandomRewards[playerId];
    U256 pendingRandomRewardsLength = pendingRandomRewards.length.asU256();
    ids = new uint256[](pendingRandomRewardsLength.asUint256() * MAX_RANDOM_REWARDS_PER_ACTION);
    amounts = new uint256[](pendingRandomRewardsLength.asUint256() * MAX_RANDOM_REWARDS_PER_ACTION);
    queueIds = new uint256[](pendingRandomRewardsLength.asUint256() * MAX_RANDOM_REWARDS_PER_ACTION);

    uint256 length;
    for (U256 iter; iter < pendingRandomRewardsLength; iter = iter.inc()) {
      uint256 i = iter.asUint256();
      PendingRandomReward storage pendingRandomReward = pendingRandomRewards[i];
      (ActionRewards memory actionRewards, Skill actionSkill, uint256 numSpawnedPerHour, ) = world.getRewardsHelper(
        pendingRandomReward.actionId
      );
      bool isCombat = actionSkill.isCombat();
      uint16 monstersKilled = uint16(
        uint256(numSpawnedPerHour * pendingRandomReward.xpElapsedTime) / (SPAWN_MUL * 3600)
      );
      uint8 successPercent = _getSuccessPercent(
        playerId,
        pendingRandomReward.actionId,
        actionSkill,
        isCombat,
        pendingQueuedActionProcessed
      );
      bool processedAny;

      // TODO: Remove everything related to this later
      // boostType was removed and shifted everything up in the PendingRandomReward struct
      bool isLegacyWithBoostPendingRandomReward = pendingRandomReward.boostItemTokenId != 0 &&
        pendingRandomReward.boostItemTokenId < 10;
      uint256 numTickets = isCombat ? monstersKilled : pendingRandomReward.xpElapsedTime / 3600;

      uint256[] memory randomIds;
      uint256[] memory randomAmounts;
      (randomIds, randomAmounts, processedAny) = _getRandomRewards(
        playerId,
        pendingRandomReward.startTime,
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
            uint256 elapsedTime = pendingRandomReward.elapsedTime;

            uint256 boostedTime = PlayersLibrary.getBoostedTime(
              pendingRandomReward.startTime,
              elapsedTime,
              pendingRandomReward.boostStartTime,
              boostDuration
            );

            _addGatheringBoostedAmounts(boostedTime, randomAmounts, boostValue, elapsedTime);
          }
        }

        // Copy into main arrays
        uint256 oldLength = length;
        for (uint256 j = 0; j < randomIds.length; ++j) {
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
    address from,
    uint256 playerId,
    QueuedAction storage queuedAction,
    uint256 startTime,
    Skill skill,
    uint256 xpElapsedTime,
    PendingQueuedActionEquipmentState[] memory pendingQueuedActionEquipmentStates
  ) private view returns (uint32 pointsAccrued, uint32 pointsAccruedExclBaseBoost) {
    (pointsAccrued, pointsAccruedExclBaseBoost) = PlayersLibrary.getPointsAccrued(
      from,
      _players[playerId],
      queuedAction,
      startTime,
      uint8(skill),
      xpElapsedTime,
      _attire[playerId][queuedAction.queueId],
      _activeBoosts[playerId],
      _globalBoost,
      _clanBoosts[clans.getClanId(playerId)],
      address(itemNFT),
      address(world),
      _fullAttireBonus[skill].bonusXPPercent,
      _fullAttireBonus[skill].itemTokenIds,
      pendingQueuedActionEquipmentStates
    );
  }

  function _addRemainingQueuedAction(
    QueuedAction[] memory remainingQueuedActions,
    QueuedAction storage queuedAction,
    uint256 timespan,
    uint256 elapsedTime,
    uint256 xpElapsedTime,
    uint256 length
  ) private pure {
    QueuedAction memory remainingAction = queuedAction;
    remainingAction.timespan = uint24(timespan);
    remainingAction.prevProcessedTime += uint24(elapsedTime);
    remainingAction.prevProcessedXPTime += uint24(xpElapsedTime);
    // Build a list of the skills queued that remain
    remainingQueuedActions[length] = remainingAction;
  }

  function _appendGuaranteedReward(
    uint256[] memory ids,
    uint256[] memory amounts,
    uint256 elapsedTime,
    uint16 rewardTokenId,
    uint24 rewardRate,
    uint256 oldLength,
    uint16 monstersKilled,
    bool isCombat,
    uint8 successPercent
  ) private pure returns (uint256 length) {
    length = oldLength;
    if (rewardTokenId != NONE) {
      uint256 numRewards;
      if (isCombat) {
        numRewards = (monstersKilled * rewardRate) / GUAR_MUL; // rate is per kill
      } else {
        numRewards = (elapsedTime.mul(rewardRate).mul(successPercent)).div(3600 * GUAR_MUL * 100);
      }

      if (numRewards != 0) {
        ids[length] = rewardTokenId;
        amounts[length] = numRewards;
        length = length.inc();
      }
    }
  }

  function _appendGuaranteedRewards(
    uint256[] memory ids,
    uint256[] memory amounts,
    uint256 elapsedTime,
    ActionRewards memory actionRewards,
    uint16 monstersKilled,
    bool isCombat,
    uint8 successPercent
  ) private pure returns (uint256 length) {
    length = _appendGuaranteedReward(
      ids,
      amounts,
      elapsedTime,
      actionRewards.guaranteedRewardTokenId1,
      actionRewards.guaranteedRewardRate1,
      length,
      monstersKilled,
      isCombat,
      successPercent
    );
    length = _appendGuaranteedReward(
      ids,
      amounts,
      elapsedTime,
      actionRewards.guaranteedRewardTokenId2,
      actionRewards.guaranteedRewardRate2,
      length,
      monstersKilled,
      isCombat,
      successPercent
    );
    length = _appendGuaranteedReward(
      ids,
      amounts,
      elapsedTime,
      actionRewards.guaranteedRewardTokenId3,
      actionRewards.guaranteedRewardRate3,
      length,
      monstersKilled,
      isCombat,
      successPercent
    );
  }

  function _getRandomRewards(
    uint256 playerId,
    uint40 startTime,
    uint40 sentinelTimestamp,
    uint256 numTickets,
    ActionRewards memory actionRewards,
    uint8 successPercent,
    uint8 fullAttireBonusRewardsPercent
  ) private view returns (uint256[] memory ids, uint256[] memory amounts, bool hasRandomWord) {
    bytes memory data = _staticcall(
      address(this),
      abi.encodeWithSelector(
        IPlayersMiscDelegateView.getRandomRewards.selector,
        playerId,
        startTime,
        sentinelTimestamp,
        numTickets,
        actionRewards,
        successPercent,
        fullAttireBonusRewardsPercent
      )
    );
    return abi.decode(data, (uint256[], uint256[], bool));
  }

  function _processConsumablesView(
    address from,
    uint256 playerId,
    QueuedAction memory queuedAction,
    ActionChoice memory actionChoice,
    CombatStats memory combatStats,
    uint256 elapsedTime,
    uint256 startTime,
    PendingQueuedActionEquipmentState[] memory pendingQueuedActionEquipmentStates,
    PendingQueuedActionProcessed memory pendingQueuedActionProcessed
  )
    private
    view
    returns (
      Equipment[] memory consumedEquipment,
      Equipment memory producedEquipment,
      uint256 xpElapsedTime,
      bool died,
      uint16 foodConsumed,
      uint16 baseInputItemsConsumedNum
    )
  {
    bytes memory data = _staticcall(
      address(this),
      abi.encodeWithSelector(
        IPlayersMiscDelegateView.processConsumablesView.selector,
        from,
        playerId,
        queuedAction,
        actionChoice,
        combatStats,
        elapsedTime,
        startTime,
        pendingQueuedActionEquipmentStates,
        pendingQueuedActionProcessed
      )
    );
    return abi.decode(data, (Equipment[], Equipment, uint256, bool, uint16, uint16));
  }

  function _getHealthPointsFromCombat(
    uint256 playerId,
    uint256 combatPoints
  ) private view returns (uint32 healthPointsAccured) {
    // Get 1/3 of the combat points as health
    healthPointsAccured = uint32(combatPoints / 3);
    // Get bonus health points from avatar starting skills
    uint256 bonusPercent = PlayersLibrary.getBonusAvatarXPPercent(_players[playerId], uint8(Skill.HEALTH));
    healthPointsAccured += uint32((combatPoints * bonusPercent) / (3600 * 100));
  }

  function _clearActionProcessed(PendingQueuedActionData memory currentActionProcessed) private pure {
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
    address from,
    uint256 playerId
  ) private view returns (uint256[] memory itemTokenIds, uint256[] memory amounts, bytes32 dailyRewardMask) {
    bytes memory data = _staticcall(
      address(this),
      abi.encodeWithSelector(IPlayersMiscDelegateView.dailyRewardsViewImpl.selector, from, playerId)
    );
    return abi.decode(data, (uint256[], uint256[], bytes32));
  }
}
