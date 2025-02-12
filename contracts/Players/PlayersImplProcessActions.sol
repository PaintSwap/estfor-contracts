// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {PlayersBase} from "./PlayersBase.sol";
import {PlayersLibrary} from "./PlayersLibrary.sol";
import {IPlayersRewardsDelegateView, IPlayersRewardsDelegate, IPlayersMiscDelegate} from "../interfaces/IPlayersDelegates.sol";
import {CombatStyleLibrary} from "../libraries/CombatStyleLibrary.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

import {ActivityType} from "../ActivityPoints/interfaces/IActivityPoints.sol";

// solhint-disable-next-line no-global-import
import "../globals/all.sol";

contract PlayersImplProcessActions is PlayersBase {
  using CombatStyleLibrary for uint8;
  using CombatStyleLibrary for CombatStyle;

  function processActionsAndSetState(
    uint256 playerId
  ) external returns (QueuedAction[] memory remainingQueuedActions, Attire[] memory remainingAttire) {
    PendingQueuedActionData memory currentActionProcessed;
    (remainingQueuedActions, currentActionProcessed) = processActions(msg.sender, playerId);

    Player storage player = _players[playerId];
    if (remainingQueuedActions.length != 0) {
      player.currentActionStartTimestamp = uint40(block.timestamp);
    } else {
      player.currentActionStartTimestamp = 0;
    }
    _setPrevPlayerState(player, currentActionProcessed);

    remainingAttire = new Attire[](remainingQueuedActions.length);
    for (uint256 i = 0; i < remainingQueuedActions.length; ++i) {
      remainingAttire[i] = _attire[playerId][remainingQueuedActions[i].queueId];
    }
    _setActionQueue(msg.sender, playerId, remainingQueuedActions, remainingAttire, block.timestamp);
  }

  function processActions(
    address from,
    uint256 playerId
  )
    public
    returns (QueuedAction[] memory remainingQueuedActions, PendingQueuedActionData memory currentActionProcessed)
  {
    Player storage player = _players[playerId];
    PendingQueuedActionState memory pendingQueuedActionState = _pendingQueuedActionState(from, playerId);
    if (player.actionQueue.length == 0) {
      // No actions remaining
      PendingQueuedActionProcessed memory emptyPendingQueuedActionProcessed;
      _processActionsFinished(
        from,
        playerId,
        emptyPendingQueuedActionProcessed,
        pendingQueuedActionState.lotteryWinner
      ); // TODO: Could still use pendingQueuedActionState
      return (remainingQueuedActions, emptyPendingQueuedActionProcessed.currentAction);
    }

    bool isEvolved = _isEvolved(playerId);

    remainingQueuedActions = pendingQueuedActionState.remainingQueuedActions;
    PendingQueuedActionProcessed memory pendingQueuedActionProcessed = pendingQueuedActionState.processedData;
    currentActionProcessed = pendingQueuedActionProcessed.currentAction;
    uint256 skillIndex;
    uint256 startTime = _players[playerId].currentActionStartTimestamp;
    for (uint256 i = 0; i < pendingQueuedActionState.equipmentStates.length; ++i) {
      PendingQueuedActionEquipmentState memory equipmentState = pendingQueuedActionState.equipmentStates[i];
      PendingQueuedActionMetadata memory actionMetadata = pendingQueuedActionState.actionMetadatas[i];

      if (equipmentState.consumedItemTokenIds.length != 0) {
        _itemNFT.burnBatch(from, equipmentState.consumedItemTokenIds, equipmentState.consumedAmounts);
        emit Consumes(
          from,
          playerId,
          actionMetadata.queueId,
          equipmentState.consumedItemTokenIds,
          equipmentState.consumedAmounts
        );
      }
      if (equipmentState.producedItemTokenIds.length != 0) {
        _itemNFT.mintBatch(from, equipmentState.producedItemTokenIds, equipmentState.producedAmounts);
        emit Rewards(
          from,
          playerId,
          actionMetadata.queueId,
          equipmentState.producedItemTokenIds,
          equipmentState.producedAmounts
        );
      }

      ActionRewards memory actionRewards = _worldActions.getActionRewards(actionMetadata.actionId);

      ActionChoice memory actionChoice;
      QueuedAction storage queuedAction = _players[playerId].actionQueue[i];
      CombatStyle combatStyle = queuedAction.combatStyle._asCombatStyle();
      bool isCombat = queuedAction.combatStyle._isCombatStyle();
      if (queuedAction.choiceId != 0) {
        // Includes combat
        actionChoice = _worldActions.getActionChoice(isCombat ? NONE : queuedAction.actionId, queuedAction.choiceId);
      }

      Skill skill = _getSkillFromChoiceOrStyle(actionChoice, combatStyle, queuedAction.actionId);

      bool hasRandomRewards = actionRewards.randomRewardTokenId1 != NONE; // A precheck as an optimization
      if (actionMetadata.xpElapsedTime != 0 && hasRandomRewards) {
        uint24 sentinelElapsedTime = actionMetadata.elapsedTime;
        bool hasRandomWord = _randomnessBeacon.hasRandomWord(startTime + sentinelElapsedTime);
        if (hasRandomWord && isCombat) {
          // The elapsed time needs to be updated if the random words are known as other dynamic things
          // like changing food/scroll consumption can be used to modify the random reward outputs.
          sentinelElapsedTime = uint24(
            (block.timestamp - startTime) >= type(uint24).max ? type(uint24).max : block.timestamp - startTime
          );
          hasRandomWord = false;
        }

        if (!hasRandomWord) {
          _addPendingRandomReward(
            from,
            playerId,
            actionMetadata.actionId,
            actionMetadata.queueId,
            uint40(startTime),
            actionMetadata.elapsedTime,
            sentinelElapsedTime,
            actionMetadata.xpElapsedTime,
            _attire[playerId][actionMetadata.queueId],
            skill,
            actionMetadata.rolls,
            pendingQueuedActionState.equipmentStates,
            _checkpointEquipments[playerId][actionMetadata.checkpoint]
          );
        }
      }

      if (actionMetadata.died) {
        emit Died(from, playerId, actionMetadata.queueId);
      }

      // XP gained
      if (actionMetadata.xpGained != 0) {
        // Keep reading until the xp expected is reached
        uint256 xpGained;
        uint256 levelsGained;
        for (uint256 j = skillIndex; j < pendingQueuedActionProcessed.skills.length; ++j) {
          xpGained += pendingQueuedActionProcessed.xpGainedSkills[j];
          if (xpGained <= actionMetadata.xpGained) {
            // Map this to the current action
            uint256 newLevels = _updateXP(
              from,
              playerId,
              pendingQueuedActionProcessed.skills[j],
              pendingQueuedActionProcessed.xpGainedSkills[j]
            );

            levelsGained += newLevels;
            skillIndex = j + 1;
          } else {
            break;
          }
        }

        player.totalXP += actionMetadata.xpGained;
        player.totalLevel += uint16(levelsGained);
      }

      bool fullyFinished = actionMetadata.elapsedTime >= queuedAction.timespan;
      if (fullyFinished) {
        emit ActionFinished(from, playerId, actionMetadata.queueId);
        _activityPoints.rewardBlueTickets(ActivityType.players_evt_actionfinished, from, isEvolved, 1);
      } else {
        emit ActionPartiallyFinished(from, playerId, actionMetadata.queueId, actionMetadata.elapsedTime);
      }
      startTime += actionMetadata.elapsedTime;
    }

    // XP rewards
    if (pendingQueuedActionState.xpRewardItemTokenIds.length != 0) {
      _itemNFT.mintBatch(from, pendingQueuedActionState.xpRewardItemTokenIds, pendingQueuedActionState.xpRewardAmounts);
      emit ClaimedXPThresholdRewards(
        from,
        playerId,
        pendingQueuedActionState.xpRewardItemTokenIds,
        pendingQueuedActionState.xpRewardAmounts
      );
      _activityPoints.rewardBlueTickets(ActivityType.players_evt_claimedxpthresholdrewards, from, isEvolved, 1);
    }

    // Oracle loot from past random rewards
    PastRandomRewardInfo[] memory producedPastRandomRewards = pendingQueuedActionState.producedPastRandomRewards;

    uint256[] memory itemTokenIds = new uint256[](producedPastRandomRewards.length);
    uint256[] memory amounts = new uint256[](producedPastRandomRewards.length);
    uint256[] memory queueIds = new uint256[](producedPastRandomRewards.length);
    for (uint256 j = 0; j < producedPastRandomRewards.length; ++j) {
      itemTokenIds[j] = producedPastRandomRewards[j].itemTokenId;
      amounts[j] = producedPastRandomRewards[j].amount;
      queueIds[j] = producedPastRandomRewards[j].queueId;
    }
    _processClaimableRewards(
      from,
      playerId,
      itemTokenIds,
      amounts,
      queueIds,
      pendingQueuedActionState.numPastRandomRewardInstancesToRemove
    );

    // Quests
    QuestState memory questState = pendingQueuedActionState.quests;
    _quests.processQuests(from, playerId, questState.activeQuestInfo, questState.questsCompleted);
    if (questState.consumedItemTokenIds.length != 0 || questState.rewardItemTokenIds.length != 0) {
      if (questState.consumedItemTokenIds.length != 0) {
        _itemNFT.burnBatch(from, questState.consumedItemTokenIds, questState.consumedAmounts);
      }
      if (questState.rewardItemTokenIds.length != 0) {
        _itemNFT.mintBatch(from, questState.rewardItemTokenIds, questState.rewardAmounts);
      }
      emit QuestRewardConsumes(
        from,
        playerId,
        questState.rewardItemTokenIds,
        questState.rewardAmounts,
        questState.consumedItemTokenIds,
        questState.consumedAmounts
      );
    }

    // Any quest XP gains
    uint256 questXpGained;
    uint256 questLevelsGained;
    for (uint256 j; j < questState.skills.length; ++j) {
      questLevelsGained += _updateXP(from, playerId, questState.skills[j], questState.xpGainedSkills[j]);
      questXpGained += questState.xpGainedSkills[j];
    }
    if (questXpGained != 0) {
      player.totalXP = uint48(player.totalXP + questXpGained);
      player.totalLevel += uint16(questLevelsGained);
    }

    // Daily/weekly rewards
    if (pendingQueuedActionState.dailyRewardItemTokenIds.length != 0) {
      _itemNFT.mintBatch(
        from,
        pendingQueuedActionState.dailyRewardItemTokenIds,
        pendingQueuedActionState.dailyRewardAmounts
      );

      emit DailyReward(
        from,
        playerId,
        pendingQueuedActionState.dailyRewardItemTokenIds[0],
        pendingQueuedActionState.dailyRewardAmounts[0]
      );

      _activityPoints.rewardBlueTickets(
        ActivityType.players_evt_dailyreward,
        from,
        isEvolved,
        pendingQueuedActionState.dailyRewardAmounts[0]
      );

      _activityPoints.rewardGreenTickets(ActivityType.players_dailyreward, from);

      if (pendingQueuedActionState.dailyRewardItemTokenIds.length == 2) {
        emit WeeklyReward(
          from,
          playerId,
          pendingQueuedActionState.dailyRewardItemTokenIds[1],
          pendingQueuedActionState.dailyRewardAmounts[1]
        );

        _activityPoints.rewardBlueTickets(
          ActivityType.players_evt_weeklyreward,
          from,
          isEvolved,
          pendingQueuedActionState.dailyRewardAmounts[1]
        );
      }

      if (uint256(pendingQueuedActionState.dailyRewardMask) != 0) {
        _dailyRewardMasks[playerId] = pendingQueuedActionState.dailyRewardMask;
      }
    }

    _handleLotteryWinnings(from, playerId, pendingQueuedActionState.lotteryWinner);

    _clearPlayerBoostsIfExpired(from, playerId);

    bytes1 packedData = player.packedData;
    // Clear first 6 bits which holds the worldLocation
    packedData &= bytes1(uint8(0xC0));
    packedData |= bytes1(pendingQueuedActionState.worldLocation);
    player.packedData = packedData;
  }

  function _clearPlayerBoostsIfExpired(address from, uint256 playerId) private {
    ExtendedBoostInfo storage playerBoost = _activeBoosts[playerId];
    if (playerBoost.itemTokenId != NONE && playerBoost.startTime + playerBoost.duration <= block.timestamp) {
      _clearPlayerMainBoost(from, playerId);
    }

    if (
      playerBoost.lastItemTokenId != NONE && playerBoost.lastStartTime + playerBoost.lastDuration <= block.timestamp
    ) {
      _clearPlayerLastBoost(playerId);
    }

    if (
      playerBoost.extraItemTokenId != NONE && playerBoost.extraStartTime + playerBoost.extraDuration <= block.timestamp
    ) {
      _clearPlayerExtraBoost(playerId);
    }

    if (
      playerBoost.lastExtraItemTokenId != NONE &&
      playerBoost.lastExtraStartTime + playerBoost.lastExtraDuration <= block.timestamp
    ) {
      _clearPlayerLastExtraBoost(playerId);
    }
  }

  function donate(address from, uint256 playerId, uint256 amount) external {
    (uint16 extraItemTokenId, uint16 globalItemTokenId, uint256 clanId, uint16 clanItemTokenId) = _wishingWell.donate(
      from,
      playerId,
      amount
    );
    if (extraItemTokenId != NONE) {
      _instantConsumeSpecialBoost(from, playerId, extraItemTokenId, uint40(block.timestamp), clanId);
    }
    if (clanItemTokenId != NONE) {
      _instantConsumeSpecialBoost(from, playerId, clanItemTokenId, uint40(block.timestamp), clanId);
    }
    if (globalItemTokenId != NONE) {
      _instantConsumeSpecialBoost(from, playerId, globalItemTokenId, uint40(block.timestamp), clanId);
    }
  }

  // Is there a current boost ongoing when this one will be overriden? If so set last* up to the current time so that it can be used
  // to give the player the remaining boost time for any queued actions on-going at this time.
  function _setLastBoost(StandardBoostInfo storage boost, uint24 lastDuration) private {
    boost.lastStartTime = boost.startTime;
    boost.lastDuration = lastDuration;
    boost.lastValue = boost.value;
    boost.lastBoostType = boost.boostType;
    boost.lastItemTokenId = boost.itemTokenId;
  }

  // Is there a current boost ongoing when this one will be overriden? If so set lastExtra up to the current time so that it can be used
  // to give the player the remaining boost time for any queued actions on-going at this time.
  function _setLastExtraBoost(uint256 playerId, ExtendedBoostInfo storage boost, uint24 lastExtraDuration) private {
    boost.lastExtraStartTime = boost.extraStartTime;
    boost.lastExtraDuration = lastExtraDuration;
    boost.lastExtraValue = boost.extraValue;
    boost.lastExtraBoostType = boost.extraBoostType;
    boost.lastExtraItemTokenId = boost.extraItemTokenId;

    emit UpdateLastExtraBoost(
      playerId,
      BoostInfo({
        startTime: boost.lastExtraStartTime,
        duration: boost.lastExtraDuration,
        value: boost.lastExtraValue,
        boostType: boost.lastExtraBoostType,
        itemTokenId: boost.lastExtraItemTokenId
      })
    );
  }

  // There is no need to burn anything because it is implicitly minted/burned in the same transaction
  function _instantConsumeSpecialBoost(
    address from,
    uint256 playerId,
    uint16 itemTokenId,
    uint40 startTime,
    uint256 clanId
  ) private {
    Item memory item = _itemNFT.getItem(itemTokenId);
    require(
      item.equipPosition == EquipPosition.EXTRA_BOOST_VIAL ||
        item.equipPosition == EquipPosition.GLOBAL_BOOST_VIAL ||
        item.equipPosition == EquipPosition.CLAN_BOOST_VIAL,
      NotABoostVial()
    );
    if (startTime < block.timestamp) {
      startTime = uint40(block.timestamp);
    }

    BoostInfo memory boostInfo = BoostInfo({
      startTime: startTime,
      duration: item.boostDuration,
      value: item.boostValue,
      boostType: item.boostType,
      itemTokenId: itemTokenId
    });

    if (item.equipPosition == EquipPosition.EXTRA_BOOST_VIAL) {
      ExtendedBoostInfo storage playerBoost = _activeBoosts[playerId];
      uint24 lastExtraDuration = uint24(
        Math.min(block.timestamp - playerBoost.extraStartTime, playerBoost.extraStartTime + playerBoost.extraDuration)
      );
      _setLastExtraBoost(playerId, playerBoost, lastExtraDuration); // Must be set before making any changes
      playerBoost.extraStartTime = startTime;
      playerBoost.extraDuration = item.boostDuration;
      playerBoost.extraValue = item.boostValue;
      playerBoost.extraBoostType = item.boostType;
      playerBoost.extraItemTokenId = itemTokenId;

      bytes1 packedData = bytes1(uint8(0x1 | (1 << HAS_EXTRA_BOOST_BIT))); // set the version bit and also bit for needed extraStartTime
      playerBoost.packedData |= packedData; // Set the version bit
      emit ConsumeExtraBoostVial(from, playerId, boostInfo);
    } else if (item.equipPosition == EquipPosition.GLOBAL_BOOST_VIAL) {
      uint24 lastDuration = uint24(
        Math.min(block.timestamp - _globalBoost.startTime, _globalBoost.startTime + _globalBoost.duration)
      );
      _setLastBoost(_globalBoost, lastDuration); // Must be set before making any changes
      _globalBoost.startTime = startTime;
      _globalBoost.duration = item.boostDuration;
      _globalBoost.value = item.boostValue;
      _globalBoost.boostType = item.boostType;
      _globalBoost.itemTokenId = itemTokenId;
      emit ConsumeGlobalBoostVial(from, playerId, boostInfo);
    } else {
      StandardBoostInfo storage clanBoost = _clanBoosts[clanId];
      uint24 lastDuration = uint24(
        Math.min(block.timestamp - clanBoost.startTime, clanBoost.startTime + clanBoost.duration)
      );
      _setLastBoost(clanBoost, lastDuration); // Must be set before making any changes
      clanBoost.startTime = startTime;
      clanBoost.duration = item.boostDuration;
      clanBoost.value = item.boostValue;
      clanBoost.boostType = item.boostType;
      clanBoost.itemTokenId = itemTokenId;
      emit ConsumeClanBoostVial(from, playerId, clanId, boostInfo);
    }
  }

  function _processActionsFinished(
    address from,
    uint256 playerId,
    PendingQueuedActionProcessed memory _pendingQueuedActionProcessed,
    LotteryWinnerInfo memory lotteryWinner
  ) private {
    _claimRandomRewards(from, playerId, _pendingQueuedActionProcessed);
    _handleDailyRewards(from, playerId);
    _handleLotteryWinnings(from, playerId, lotteryWinner);
    _clearPlayerBoostsIfExpired(from, playerId);
  }

  function _claimRandomRewards(
    address from,
    uint256 playerId,
    PendingQueuedActionProcessed memory pendingQueuedActionProcessed
  ) private {
    _delegatecall(
      _implRewards,
      abi.encodeWithSelector(
        IPlayersRewardsDelegate.claimRandomRewards.selector,
        from,
        playerId,
        pendingQueuedActionProcessed
      )
    );
  }

  function _addPendingRandomReward(
    address from,
    uint256 playerId,
    uint16 actionId,
    uint64 queueId,
    uint40 skillStartTime,
    uint24 elapsedTime,
    uint24 sentinelElapsedTime,
    uint24 xpElapsedTime,
    Attire storage attire,
    Skill skill,
    uint256 rolls,
    PendingQueuedActionEquipmentState[] memory pendingQueuedActionEquipmentStates,
    CheckpointEquipments storage checkpointEquipments
  ) private {
    ExtendedBoostInfo storage playerBoost = _activeBoosts[playerId];
    BoostType boostType;
    uint40 boostStartTime;
    uint16 boostItemTokenId;
    if (playerBoost.boostType == BoostType.GATHERING || playerBoost.lastBoostType == BoostType.GATHERING) {
      uint24 boostedTime = PlayersLibrary.getBoostedTime(
        skillStartTime,
        xpElapsedTime,
        playerBoost.startTime,
        playerBoost.duration
      );
      uint24 lastBoostedTime = PlayersLibrary.getBoostedTime(
        skillStartTime,
        xpElapsedTime,
        playerBoost.lastStartTime,
        playerBoost.lastDuration
      );

      bool isCurrentBoostActive = playerBoost.boostType == BoostType.GATHERING && boostedTime != 0;
      bool isLastBoostActive = playerBoost.lastBoostType == BoostType.GATHERING && lastBoostedTime != 0;

      if (isCurrentBoostActive && isLastBoostActive && playerBoost.lastItemTokenId == playerBoost.itemTokenId) {
        boostType = playerBoost.boostType;
        boostItemTokenId = playerBoost.itemTokenId;
        boostStartTime = playerBoost.lastStartTime < playerBoost.startTime
          ? playerBoost.lastStartTime
          : playerBoost.startTime;
      } else if (isCurrentBoostActive) {
        boostType = playerBoost.boostType;
        boostItemTokenId = playerBoost.itemTokenId;
        boostStartTime = playerBoost.startTime;
      } else if (isLastBoostActive) {
        boostType = playerBoost.lastBoostType;
        boostItemTokenId = playerBoost.lastItemTokenId;
        boostStartTime = playerBoost.lastStartTime;
      }
    }

    // Special case where thieving gives you a bonus if wearing full equipment
    uint8 bonusRewardsPercent = _fullAttireBonus[skill].bonusRewardsPercent;
    uint8 fullAttireBonusRewardsPercent = PlayersLibrary.getFullAttireBonusRewardsPercent(
      attire,
      pendingQueuedActionEquipmentStates,
      bonusRewardsPercent,
      _fullAttireBonus[skill].itemTokenIds,
      checkpointEquipments
    );

    // There's no random word for this yet, so add it to the loot queue. (TODO: They can force add it later)
    PendingRandomReward storage pendingRandomReward = _pendingRandomRewards[playerId].push();
    pendingRandomReward.actionId = actionId;
    pendingRandomReward.queueId = queueId;
    pendingRandomReward.startTime = skillStartTime;
    pendingRandomReward.xpElapsedTime = xpElapsedTime;
    pendingRandomReward.elapsedTime = elapsedTime;
    pendingRandomReward.sentinelElapsedTime = sentinelElapsedTime;
    pendingRandomReward.boostItemTokenId = boostItemTokenId;
    pendingRandomReward.boostStartTime = boostStartTime;
    pendingRandomReward.fullAttireBonusRewardsPercent = fullAttireBonusRewardsPercent;

    emit AddPendingRandomReward(from, playerId, queueId, skillStartTime, xpElapsedTime, rolls);
  }

  function _handleDailyRewards(address from, uint256 playerId) private {
    _delegatecall(_implMisc, abi.encodeWithSelector(IPlayersMiscDelegate.handleDailyRewards.selector, from, playerId));
  }

  function _handleLotteryWinnings(address from, uint256 playerId, LotteryWinnerInfo memory lotteryWinner) private {
    // Check for lottery winners, TODO: currently just uses instant extra boost consumptions
    if (lotteryWinner.itemTokenId != 0) {
      _wishingWell.claimedLotteryWinnings(lotteryWinner.lotteryId);
      _instantConsumeSpecialBoost(from, playerId, lotteryWinner.itemTokenId, uint40(block.timestamp), 0);
    }
  }
}
