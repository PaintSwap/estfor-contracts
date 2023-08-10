// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {UnsafeMath, U256} from "@0xdoublesharp/unsafe-math/contracts/UnsafeMath.sol";

import {PlayersImplBase} from "./PlayersImplBase.sol";
import {PlayersBase} from "./PlayersBase.sol";
import {PlayersLibrary} from "./PlayersLibrary.sol";
import {IPlayersRewardsDelegateView, IPlayersRewardsDelegate, IPlayersMiscDelegate} from "../interfaces/IPlayersDelegates.sol";

// solhint-disable-next-line no-global-import
import "../globals/all.sol";

contract PlayersImplProcessActions is PlayersImplBase, PlayersBase {
  using UnsafeMath for U256;
  using UnsafeMath for uint8;
  using UnsafeMath for uint16;
  using UnsafeMath for uint24;
  using UnsafeMath for uint32;
  using UnsafeMath for uint40;
  using UnsafeMath for uint56;
  using UnsafeMath for uint128;
  using UnsafeMath for uint256;

  constructor() {
    _checkStartSlot();
  }

  function processActionsAndSetState(uint _playerId) external {
    (
      QueuedAction[] memory remainingQueuedActions,
      PendingQueuedActionData memory currentActionProcessed
    ) = processActions(msg.sender, _playerId);

    Player storage player = players_[_playerId];
    if (remainingQueuedActions.length != 0) {
      player.currentActionStartTime = uint40(block.timestamp);
    } else {
      player.currentActionStartTime = 0;
    }
    _setPrevPlayerState(player, currentActionProcessed);

    Attire[] memory remainingAttire = new Attire[](remainingQueuedActions.length);
    for (uint i = 0; i < remainingQueuedActions.length; ++i) {
      remainingAttire[i] = attire_[_playerId][remainingQueuedActions[i].queueId];
    }

    _setActionQueue(msg.sender, _playerId, remainingQueuedActions, remainingAttire, block.timestamp);
  }

  function processActions(
    address _from,
    uint _playerId
  )
    public
    returns (QueuedAction[] memory remainingQueuedActions, PendingQueuedActionData memory currentActionProcessed)
  {
    Player storage player = players_[_playerId];
    PendingQueuedActionState memory pendingQueuedActionState = _pendingQueuedActionState(_from, _playerId);
    if (player.actionQueue.length == 0) {
      // No actions remaining
      PendingQueuedActionProcessed memory emptyPendingQueuedActionProcessed;
      _processActionsFinished(
        _from,
        _playerId,
        emptyPendingQueuedActionProcessed,
        pendingQueuedActionState.lotteryWinner
      ); // TODO: Could still use pendingQueuedActionState
      return (remainingQueuedActions, emptyPendingQueuedActionProcessed.currentAction);
    }

    remainingQueuedActions = pendingQueuedActionState.remainingQueuedActions;
    PendingQueuedActionProcessed memory pendingQueuedActionProcessed = pendingQueuedActionState.processedData;
    currentActionProcessed = pendingQueuedActionProcessed.currentAction;
    uint skillIndex;
    uint startTime = players_[_playerId].currentActionStartTime;
    for (uint i = 0; i < pendingQueuedActionState.equipmentStates.length; ++i) {
      PendingQueuedActionEquipmentState memory equipmentState = pendingQueuedActionState.equipmentStates[i];
      PendingQueuedActionMetadata memory actionMetadata = pendingQueuedActionState.actionMetadatas[i];

      if (equipmentState.consumedItemTokenIds.length != 0) {
        itemNFT.burnBatch(_from, equipmentState.consumedItemTokenIds, equipmentState.consumedAmounts);
        emit Consumes(
          _from,
          _playerId,
          actionMetadata.queueId,
          equipmentState.consumedItemTokenIds,
          equipmentState.consumedAmounts
        );
      }
      if (equipmentState.producedItemTokenIds.length != 0) {
        itemNFT.mintBatch(_from, equipmentState.producedItemTokenIds, equipmentState.producedAmounts);
        emit Rewards(
          _from,
          _playerId,
          actionMetadata.queueId,
          equipmentState.producedItemTokenIds,
          equipmentState.producedAmounts
        );
      }

      ActionRewards memory actionRewards = world.getActionRewards(actionMetadata.actionId);

      ActionChoice memory actionChoice;
      QueuedAction storage queuedAction = players_[_playerId].actionQueue[i];
      bool isCombat = _isCombatStyle(queuedAction.combatStyle);
      if (queuedAction.choiceId != 0) {
        // Includes combat
        actionChoice = world.getActionChoice(isCombat ? NONE : queuedAction.actionId, queuedAction.choiceId);
      }

      Skill skill = _getSkillFromChoiceOrStyle(actionChoice, queuedAction.combatStyle, queuedAction.actionId);

      uint24 _sentinelElapsedTime = skill == Skill.THIEVING
        ? actionMetadata.elapsedTime
        : uint24((block.timestamp - startTime) >= type(uint24).max ? type(uint24).max : block.timestamp - startTime);

      _addPendingRandomReward(
        _from,
        _playerId,
        actionRewards,
        actionMetadata.actionId,
        actionMetadata.queueId,
        uint40(startTime),
        actionMetadata.elapsedTime,
        _sentinelElapsedTime,
        actionMetadata.xpElapsedTime,
        attire_[_playerId][actionMetadata.queueId],
        skill,
        actionMetadata.rolls,
        pendingQueuedActionState.equipmentStates
      );

      if (actionMetadata.died) {
        emit Died(_from, _playerId, actionMetadata.queueId);
      }
      // XP gained
      if (actionMetadata.xpGained != 0) {
        {
          uint previousTotalXP = player.totalXP;
          uint newTotalXP = previousTotalXP.add(actionMetadata.xpGained);
          player.totalXP = uint56(newTotalXP);
        }

        // Keep reading until the xp expected is reached
        uint xpGained;
        for (uint j = skillIndex; j < pendingQueuedActionProcessed.skills.length; ++j) {
          xpGained += pendingQueuedActionProcessed.xpGainedSkills[j];
          if (xpGained <= actionMetadata.xpGained) {
            // Map this to the current action
            _updateXP(
              _from,
              _playerId,
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
        emit ActionFinished(_from, _playerId, actionMetadata.queueId);
      } else {
        emit ActionPartiallyFinished(_from, _playerId, actionMetadata.queueId, actionMetadata.elapsedTime);
      }
      startTime += actionMetadata.elapsedTime;
    }

    // XP rewards
    if (pendingQueuedActionState.xpRewardItemTokenIds.length != 0) {
      itemNFT.mintBatch(_from, pendingQueuedActionState.xpRewardItemTokenIds, pendingQueuedActionState.xpRewardAmounts);
      emit ClaimedXPThresholdRewards(
        _from,
        _playerId,
        pendingQueuedActionState.xpRewardItemTokenIds,
        pendingQueuedActionState.xpRewardAmounts
      );
    }

    // Oracle loot from past random rewards
    if (pendingQueuedActionState.producedPastRandomRewards.length != 0) {
      PastRandomRewardInfo[] memory producedPastRandomRewards = pendingQueuedActionState.producedPastRandomRewards;

      uint[] memory itemTokenIds = new uint[](producedPastRandomRewards.length);
      uint[] memory amounts = new uint[](producedPastRandomRewards.length);
      uint[] memory queueIds = new uint[](producedPastRandomRewards.length);
      for (uint j = 0; j < producedPastRandomRewards.length; ++j) {
        itemTokenIds[j] = producedPastRandomRewards[j].itemTokenId;
        amounts[j] = producedPastRandomRewards[j].amount;
        queueIds[j] = producedPastRandomRewards[j].queueId;
      }
      _processClaimableRewards(
        _from,
        _playerId,
        itemTokenIds,
        amounts,
        queueIds,
        pendingQueuedActionState.numPastRandomRewardInstancesToRemove
      );
    }

    // Quests
    QuestState memory questState = pendingQueuedActionState.quests;
    quests.processQuests(_from, _playerId, questState.activeQuestInfo, questState.questsCompleted);
    if (questState.consumedItemTokenIds.length != 0 || questState.rewardItemTokenIds.length != 0) {
      if (questState.consumedItemTokenIds.length != 0) {
        itemNFT.burnBatch(_from, questState.consumedItemTokenIds, questState.consumedAmounts);
      }
      if (questState.rewardItemTokenIds.length != 0) {
        itemNFT.mintBatch(_from, questState.rewardItemTokenIds, questState.rewardAmounts);
      }
      emit QuestRewardConsumes(
        _from,
        _playerId,
        questState.rewardItemTokenIds,
        questState.rewardAmounts,
        questState.consumedItemTokenIds,
        questState.consumedAmounts
      );
    }

    // Any quest XP gains
    uint questXpGained;
    for (uint j; j < questState.skills.length; ++j) {
      _updateXP(_from, _playerId, questState.skills[j], questState.xpGainedSkills[j]);
      questXpGained += questState.xpGainedSkills[j];
    }
    if (questXpGained != 0) {
      player.totalXP = uint56(player.totalXP.add(questXpGained));
    }

    // Daily/weekly rewards
    if (pendingQueuedActionState.dailyRewardItemTokenIds.length != 0) {
      itemNFT.mintBatch(
        _from,
        pendingQueuedActionState.dailyRewardItemTokenIds,
        pendingQueuedActionState.dailyRewardAmounts
      );
      emit DailyReward(
        _from,
        _playerId,
        uint16(pendingQueuedActionState.dailyRewardItemTokenIds[0]),
        pendingQueuedActionState.dailyRewardAmounts[0]
      );

      if (pendingQueuedActionState.dailyRewardItemTokenIds.length == 2) {
        emit WeeklyReward(
          _from,
          _playerId,
          uint16(pendingQueuedActionState.dailyRewardItemTokenIds[1]),
          pendingQueuedActionState.dailyRewardAmounts[1]
        );
      }

      if (uint(pendingQueuedActionState.dailyRewardMask) != 0) {
        dailyRewardMasks[_playerId] = pendingQueuedActionState.dailyRewardMask;
      }
    }

    _handleLotteryWinnings(_from, _playerId, pendingQueuedActionState.lotteryWinner);

    _clearPlayerBoostsIfExpired(_playerId);

    bytes1 packedData = player.packedData;
    // Clear bottom half which holds the worldLocation
    packedData &= bytes1(uint8(0x0F));
    packedData |= bytes1(pendingQueuedActionState.worldLocation);
    player.packedData = packedData;
  }

  function _clearPlayerBoostsIfExpired(uint _playerId) private {
    PlayerBoostInfo storage playerBoost = activeBoosts_[_playerId];
    if (playerBoost.itemTokenId != NONE && playerBoost.startTime.add(playerBoost.duration) <= block.timestamp) {
      delete playerBoost.value;
      delete playerBoost.startTime;
      delete playerBoost.duration;
      delete playerBoost.value;
      delete playerBoost.itemTokenId;
      delete playerBoost.boostType;
      emit BoostFinished(_playerId);
    }

    if (
      playerBoost.extraOrLastItemTokenId != NONE &&
      playerBoost.extraOrLastStartTime.add(playerBoost.extraOrLastDuration) <= block.timestamp
    ) {
      delete playerBoost.extraOrLastValue;
      delete playerBoost.extraOrLastStartTime;
      delete playerBoost.extraOrLastDuration;
      delete playerBoost.extraOrLastValue;
      delete playerBoost.extraOrLastItemTokenId;
      delete playerBoost.extraOrLastBoostType;
      emit ExtraBoostFinished(_playerId);
    }
  }

  function donate(address _from, uint _playerId, uint _amount) external {
    (uint16 extraItemTokenId, uint16 globalItemTokenId, uint clanId, uint16 clanItemTokenId) = wishingWell.donate(
      _from,
      _playerId,
      _amount
    );
    if (extraItemTokenId != NONE) {
      _instantConsumeSpecialBoost(_from, _playerId, extraItemTokenId, uint40(block.timestamp), clanId);
    }
    if (clanItemTokenId != NONE) {
      _instantConsumeSpecialBoost(_from, _playerId, clanItemTokenId, uint40(block.timestamp), clanId);
    }
    if (globalItemTokenId != NONE) {
      _instantConsumeSpecialBoost(_from, _playerId, globalItemTokenId, uint40(block.timestamp), clanId);
    }
  }

  // Is there a current boost ongoing when this one will be overriden? If so set extraOrLast* up to the current time so that it can be used
  // to give the player the remaining boost time for any queued actions on-going at this time.
  function _setLastBoostIfAppropriate(PlayerBoostInfo storage _boost) private {
    if (block.timestamp < _boost.startTime + _boost.duration) {
      _boost.extraOrLastStartTime = _boost.startTime;
      _boost.extraOrLastDuration = uint24(block.timestamp - _boost.startTime); // duration from start to current time
      _boost.extraOrLastValue = _boost.value;
      _boost.extraOrLastBoostType = _boost.boostType;
      _boost.extraOrLastItemTokenId = _boost.itemTokenId;
    }
  }

  // There is no need to burn anything because it is implicitly minted/burned in the same transaction
  function _instantConsumeSpecialBoost(
    address _from,
    uint _playerId,
    uint16 _itemTokenId,
    uint40 _startTime,
    uint _clanId
  ) private {
    Item memory item = itemNFT.getItem(_itemTokenId);
    if (
      item.equipPosition != EquipPosition.EXTRA_BOOST_VIAL &&
      item.equipPosition != EquipPosition.GLOBAL_BOOST_VIAL &&
      item.equipPosition != EquipPosition.CLAN_BOOST_VIAL
    ) {
      revert NotABoostVial();
    }
    if (_startTime < block.timestamp) {
      _startTime = uint40(block.timestamp);
    }

    BoostInfo memory boostInfo = BoostInfo({
      startTime: _startTime,
      duration: item.boostDuration,
      value: item.boostValue,
      boostType: item.boostType,
      itemTokenId: _itemTokenId
    });

    if (item.equipPosition == EquipPosition.EXTRA_BOOST_VIAL) {
      PlayerBoostInfo storage playerBoost = activeBoosts_[_playerId];
      playerBoost.extraOrLastStartTime = _startTime;
      playerBoost.extraOrLastDuration = item.boostDuration;
      playerBoost.extraOrLastValue = item.boostValue;
      playerBoost.extraOrLastBoostType = item.boostType;
      playerBoost.extraOrLastItemTokenId = _itemTokenId;
      emit ConsumeExtraBoostVial(_from, _playerId, boostInfo);
    } else if (item.equipPosition == EquipPosition.GLOBAL_BOOST_VIAL) {
      _setLastBoostIfAppropriate(globalBoost_); // Must be set before making any changes
      globalBoost_.startTime = _startTime;
      globalBoost_.duration = item.boostDuration;
      globalBoost_.value = item.boostValue;
      globalBoost_.boostType = item.boostType;
      globalBoost_.itemTokenId = _itemTokenId;
      emit ConsumeGlobalBoostVial(_from, _playerId, boostInfo);
    } else {
      PlayerBoostInfo storage clanBoost = clanBoosts_[_clanId];
      _setLastBoostIfAppropriate(clanBoost); // Must be set before making any changes
      clanBoost.startTime = _startTime;
      clanBoost.duration = item.boostDuration;
      clanBoost.value = item.boostValue;
      clanBoost.boostType = item.boostType;
      clanBoost.itemTokenId = _itemTokenId;
      emit ConsumeClanBoostVial(_from, _playerId, _clanId, boostInfo);
    }
  }

  function _processActionsFinished(
    address _from,
    uint _playerId,
    PendingQueuedActionProcessed memory _pendingQueuedActionProcessed,
    LotteryWinnerInfo memory _lotteryWinner
  ) private {
    _claimRandomRewards(_playerId, _pendingQueuedActionProcessed);
    _handleDailyRewards(_from, _playerId);
    _handleLotteryWinnings(_from, _playerId, _lotteryWinner);
    _clearPlayerBoostsIfExpired(_playerId);
  }

  function _claimRandomRewards(
    uint _playerId,
    PendingQueuedActionProcessed memory _pendingQueuedActionProcessed
  ) private {
    _delegatecall(
      implRewards,
      abi.encodeWithSelector(
        IPlayersRewardsDelegate.claimRandomRewards.selector,
        _playerId,
        _pendingQueuedActionProcessed
      )
    );
  }

  function _addPendingRandomReward(
    address _from,
    uint _playerId,
    ActionRewards memory _actionRewards,
    uint16 _actionId,
    uint64 _queueId,
    uint40 _skillStartTime,
    uint24 _elapsedTime,
    uint24 _sentinelElapsedTime,
    uint24 _xpElapsedTime,
    Attire storage _attire,
    Skill _skill,
    uint _rolls,
    PendingQueuedActionEquipmentState[] memory _pendingQueuedActionEquipmentStates
  ) private {
    bool hasRandomRewards = _actionRewards.randomRewardTokenId1 != NONE; // A precheck as an optimization
    if (_xpElapsedTime != 0 && hasRandomRewards) {
      bool hasRandomWord = world.hasRandomWord(_skillStartTime.add(_sentinelElapsedTime));
      if (!hasRandomWord) {
        PlayerBoostInfo storage activeBoost = activeBoosts_[_playerId];
        BoostType boostType;
        uint40 boostStartTime;
        uint16 boostItemTokenId;
        if (activeBoost.boostType == BoostType.GATHERING) {
          uint24 boostedTime = PlayersLibrary.getBoostedTime(
            _skillStartTime,
            _xpElapsedTime,
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
        uint8 bonusRewardsPercent = fullAttireBonus[_skill].bonusRewardsPercent;
        uint8 fullAttireBonusRewardsPercent = PlayersLibrary.getFullAttireBonusRewardsPercent(
          _from,
          _attire,
          itemNFT,
          _pendingQueuedActionEquipmentStates,
          bonusRewardsPercent,
          fullAttireBonus[_skill].itemTokenIds
        );

        // There's no random word for this yet, so add it to the loot queue. (TODO: They can force add it later)
        pendingRandomRewards[_playerId].push(
          PendingRandomReward({
            actionId: _actionId,
            queueId: _queueId,
            startTime: _skillStartTime,
            xpElapsedTime: uint24(_xpElapsedTime),
            elapsedTime: _elapsedTime,
            sentinelElapsedTime: _sentinelElapsedTime,
            boostItemTokenId: boostItemTokenId,
            boostStartTime: boostStartTime,
            fullAttireBonusRewardsPercent: fullAttireBonusRewardsPercent
          })
        );
        emit AddPendingRandomRewardV2(_from, _playerId, _queueId, _skillStartTime, _xpElapsedTime, _rolls);
      }
    }
  }

  function _claimTotalXPThresholdRewards(address _from, uint _playerId, uint _oldTotalXP, uint _newTotalXP) private {
    (uint[] memory itemTokenIds, uint[] memory amounts) = _claimableXPThresholdRewards(_oldTotalXP, _newTotalXP);
    if (itemTokenIds.length != 0) {
      itemNFT.mintBatch(_from, itemTokenIds, amounts);
      emit ClaimedXPThresholdRewards(_from, _playerId, itemTokenIds, amounts);
    }
  }

  function testModifyXP(address _from, uint _playerId, Skill _skill, uint56 _xp, bool _force) external {
    if (!_force && players_[_playerId].actionQueue.length != 0) {
      revert HasQueuedActions();
    }

    // Make sure it isn't less XP
    uint oldXP = PlayersLibrary.readXP(_skill, xp_[_playerId]);
    if (_xp < oldXP) {
      revert TestInvalidXP();
    }
    if (playerNFT.balanceOf(_from, _playerId) == 0) {
      revert NotOwnerOfPlayer();
    }
    uint56 gainedXP = uint56(_xp.sub(oldXP));
    _updateXP(_from, _playerId, _skill, gainedXP);
    uint56 newTotalXP = uint56(players_[_playerId].totalXP.add(gainedXP));
    _claimTotalXPThresholdRewards(_from, _playerId, players_[_playerId].totalXP, newTotalXP);
    players_[_playerId].totalXP = newTotalXP;
  }

  function _handleDailyRewards(address _from, uint _playerId) private {
    _delegatecall(implMisc, abi.encodeWithSelector(IPlayersMiscDelegate.handleDailyRewards.selector, _from, _playerId));
  }

  function _handleLotteryWinnings(address _from, uint _playerId, LotteryWinnerInfo memory _lotteryWinner) private {
    // Check for lottery winners, TODO: currently just uses instant extra boost consumptions
    if (_lotteryWinner.itemTokenId != 0) {
      wishingWell.claimedLotteryWinnings(_lotteryWinner.lotteryId);
      _instantConsumeSpecialBoost(_from, _playerId, _lotteryWinner.itemTokenId, uint40(block.timestamp), 0);
    }
  }
}
