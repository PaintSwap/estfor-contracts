// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {PlayersImplBase} from "./PlayersImplBase.sol";
import {PlayersBase} from "./PlayersBase.sol";
import {PlayersLibrary} from "./PlayersLibrary.sol";
import {IPlayersRewardsDelegateView, IPlayersRewardsDelegate, IPlayersMiscDelegate} from "../interfaces/IPlayersDelegates.sol";
import {CombatStyleLibrary} from "../libraries/CombatStyleLibrary.sol";

// solhint-disable-next-line no-global-import
import "../globals/all.sol";

contract PlayersImplProcessActions is PlayersImplBase, PlayersBase {
  using CombatStyleLibrary for bytes1;
  using CombatStyleLibrary for CombatStyle;

  constructor() {
    _checkStartSlot();
  }

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

      ActionRewards memory actionRewards = _world.getActionRewards(actionMetadata.actionId);

      ActionChoice memory actionChoice;
      QueuedAction storage queuedAction = _players[playerId].actionQueue[i];
      CombatStyle combatStyle = queuedAction.packed._asCombatStyle();
      bool isCombat = queuedAction.packed._isCombatStyle();
      if (queuedAction.choiceId != 0) {
        // Includes combat
        actionChoice = _world.getActionChoice(isCombat ? NONE : queuedAction.actionId, queuedAction.choiceId);
      }

      Skill skill = _getSkillFromChoiceOrStyle(actionChoice, combatStyle, queuedAction.actionId);

      bool hasRandomRewards = actionRewards.randomRewardTokenId1 != NONE; // A precheck as an optimization
      if (actionMetadata.xpElapsedTime != 0 && hasRandomRewards) {
        uint24 sentinelElapsedTime = actionMetadata.elapsedTime;
        bool hasRandomWord = _world.hasRandomWord(startTime + sentinelElapsedTime);
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
        {
          uint256 previousTotalXP = player.totalXP;
          uint256 newTotalXP = previousTotalXP + actionMetadata.xpGained;
          player.totalXP = uint56(newTotalXP);
        }

        // Keep reading until the xp expected is reached
        uint256 xpGained;
        for (uint256 j = skillIndex; j < pendingQueuedActionProcessed.skills.length; ++j) {
          xpGained += pendingQueuedActionProcessed.xpGainedSkills[j];
          if (xpGained <= actionMetadata.xpGained) {
            // Map this to the current action
            _updateXP(
              from,
              playerId,
              pendingQueuedActionProcessed.skills[j],
              pendingQueuedActionProcessed.xpGainedSkills[j]
            );
            skillIndex = j + 1;
          } else {
            break;
          }
        }
      }
      bool fullyFinished = actionMetadata.elapsedTime >= queuedAction.timespan;
      if (fullyFinished) {
        emit ActionFinished(from, playerId, actionMetadata.queueId);
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
    for (uint256 j; j < questState.skills.length; ++j) {
      _updateXP(from, playerId, questState.skills[j], questState.xpGainedSkills[j]);
      questXpGained += questState.xpGainedSkills[j];
    }
    if (questXpGained != 0) {
      player.totalXP = uint56(player.totalXP + questXpGained);
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

      if (pendingQueuedActionState.dailyRewardItemTokenIds.length == 2) {
        emit WeeklyReward(
          from,
          playerId,
          pendingQueuedActionState.dailyRewardItemTokenIds[1],
          pendingQueuedActionState.dailyRewardAmounts[1]
        );
      }

      if (uint256(pendingQueuedActionState.dailyRewardMask) != 0) {
        _dailyRewardMasks[playerId] = pendingQueuedActionState.dailyRewardMask;
      }
    }

    _handleLotteryWinnings(from, playerId, pendingQueuedActionState.lotteryWinner);

    _clearPlayerBoostsIfExpired(playerId);

    bytes1 packedData = player.packedData;
    // Clear first 6 bits which holds the worldLocation
    packedData &= bytes1(uint8(0xC0));
    packedData |= bytes1(pendingQueuedActionState.worldLocation);
    player.packedData = packedData;
  }

  function _clearPlayerBoostsIfExpired(uint256 playerId) private {
    PlayerBoostInfo storage playerBoost = _activeBoosts[playerId];
    if (playerBoost.itemTokenId != NONE && playerBoost.startTime + playerBoost.duration <= block.timestamp) {
      _clearPlayerMainBoost(playerId);
    }

    if (
      playerBoost.extraOrLastItemTokenId != NONE &&
      playerBoost.extraOrLastStartTime + playerBoost.extraOrLastDuration <= block.timestamp
    ) {
      delete playerBoost.extraOrLastValue;
      delete playerBoost.extraOrLastStartTime;
      delete playerBoost.extraOrLastDuration;
      delete playerBoost.extraOrLastValue;
      delete playerBoost.extraOrLastItemTokenId;
      delete playerBoost.extraOrLastBoostType;
      emit ExtraBoostFinished(playerId);
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

  // Is there a current boost ongoing when this one will be overriden? If so set extraOrLast* up to the current time so that it can be used
  // to give the player the remaining boost time for any queued actions on-going at this time.
  function _setLastBoostIfAppropriate(PlayerBoostInfo storage boost) private {
    if (block.timestamp < boost.startTime + boost.duration) {
      boost.extraOrLastStartTime = boost.startTime;
      boost.extraOrLastDuration = uint24(block.timestamp - boost.startTime); // duration from start to current time
      boost.extraOrLastValue = boost.value;
      boost.extraOrLastBoostType = boost.boostType;
      boost.extraOrLastItemTokenId = boost.itemTokenId;
    }
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
      PlayerBoostInfo storage playerBoost = _activeBoosts[playerId];
      playerBoost.extraOrLastStartTime = startTime;
      playerBoost.extraOrLastDuration = item.boostDuration;
      playerBoost.extraOrLastValue = item.boostValue;
      playerBoost.extraOrLastBoostType = item.boostType;
      playerBoost.extraOrLastItemTokenId = itemTokenId;
      emit ConsumeExtraBoostVial(from, playerId, boostInfo);
    } else if (item.equipPosition == EquipPosition.GLOBAL_BOOST_VIAL) {
      _setLastBoostIfAppropriate(_globalBoost); // Must be set before making any changes
      _globalBoost.startTime = startTime;
      _globalBoost.duration = item.boostDuration;
      _globalBoost.value = item.boostValue;
      _globalBoost.boostType = item.boostType;
      _globalBoost.itemTokenId = itemTokenId;
      emit ConsumeGlobalBoostVial(from, playerId, boostInfo);
    } else {
      PlayerBoostInfo storage clanBoost = _clanBoosts[clanId];
      _setLastBoostIfAppropriate(clanBoost); // Must be set before making any changes
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
    _clearPlayerBoostsIfExpired(playerId);
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
    PlayerBoostInfo storage activeBoost = _activeBoosts[playerId];
    BoostType boostType;
    uint40 boostStartTime;
    uint16 boostItemTokenId;
    if (activeBoost.boostType == BoostType.GATHERING) {
      uint24 boostedTime = PlayersLibrary.getBoostedTime(
        skillStartTime,
        xpElapsedTime,
        activeBoost.startTime,
        activeBoost.duration
      );
      if (boostedTime != 0) {
        boostType = activeBoost.boostType;
        boostItemTokenId = activeBoost.itemTokenId;
        boostStartTime = activeBoost.startTime;
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
    _pendingRandomRewards[playerId].push(
      PendingRandomReward({
        actionId: actionId,
        queueId: queueId,
        startTime: skillStartTime,
        xpElapsedTime: uint24(xpElapsedTime),
        elapsedTime: elapsedTime,
        sentinelElapsedTime: sentinelElapsedTime,
        boostItemTokenId: boostItemTokenId,
        boostStartTime: boostStartTime,
        fullAttireBonusRewardsPercent: fullAttireBonusRewardsPercent
      })
    );

    emit AddPendingRandomReward(from, playerId, queueId, skillStartTime, xpElapsedTime, rolls);
  }

  function _claimTotalXPThresholdRewards(
    address from,
    uint256 playerId,
    uint256 oldTotalXP,
    uint256 newTotalXP
  ) private {
    (uint256[] memory itemTokenIds, uint256[] memory amounts) = _claimableXPThresholdRewards(oldTotalXP, newTotalXP);
    if (itemTokenIds.length != 0) {
      _itemNFT.mintBatch(from, itemTokenIds, amounts);
      emit ClaimedXPThresholdRewards(from, playerId, itemTokenIds, amounts);
    }
  }

  function modifyXP(address from, uint256 playerId, Skill skill, uint56 xp) external {
    // Make sure it isn't less XP
    uint256 oldXP = PlayersLibrary.readXP(skill, _playerXP[playerId]);
    require(xp >= oldXP, TestInvalidXP());
    require(_playerNFT.balanceOf(from, playerId) != 0, NotOwnerOfPlayer());
    uint56 gainedXP = uint56(xp - oldXP);
    _updateXP(from, playerId, skill, gainedXP);
    uint56 newTotalXP = uint56(_players[playerId].totalXP + gainedXP);
    _claimTotalXPThresholdRewards(from, playerId, _players[playerId].totalXP, newTotalXP);
    _players[playerId].totalXP = newTotalXP;

    // Update any in-progress actions. If things like passive actions give XP we want to make sure not to take it into account for any in-progress actions
    if (gainedXP > type(uint24).max) {
      Player storage player = _players[playerId];
      if (player.currentActionProcessedSkill1 == skill) {
        player.currentActionProcessedXPGained1 += uint24(gainedXP);
      } else if (player.currentActionProcessedSkill2 == skill) {
        player.currentActionProcessedXPGained2 += uint24(gainedXP);
      } else if (player.currentActionProcessedSkill3 == skill) {
        player.currentActionProcessedXPGained3 += uint24(gainedXP);
      }
    }
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
