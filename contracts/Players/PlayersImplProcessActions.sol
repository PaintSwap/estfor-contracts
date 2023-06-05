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

  function processActions(
    address _from,
    uint _playerId
  )
    external
    returns (QueuedAction[] memory remainingQueuedActions, PendingQueuedActionData memory currentActionProcessed)
  {
    Player storage player = players_[_playerId];
    if (player.actionQueue.length == 0) {
      // No actions remaining
      PendingQueuedActionProcessed memory emptyPendingQueuedActionProcessed;
      _processActionsFinished(_from, _playerId, emptyPendingQueuedActionProcessed); // TODO: Could still use pendingQueuedActionState
      return (remainingQueuedActions, emptyPendingQueuedActionProcessed.currentAction);
    }
    PendingQueuedActionState memory pendingQueuedActionState = _pendingQueuedActionState(_from, _playerId);
    remainingQueuedActions = pendingQueuedActionState.remainingQueuedActions;
    PendingQueuedActionProcessed memory pendingQueuedActionProcessed = pendingQueuedActionState.processedData;
    currentActionProcessed = pendingQueuedActionProcessed.currentAction;
    // total xp is updated later
    for (uint i; i < pendingQueuedActionProcessed.skills.length; ++i) {
      _updateXP(
        _from,
        _playerId,
        pendingQueuedActionProcessed.skills[i],
        pendingQueuedActionProcessed.xpGainedSkills[i]
      );
    }

    uint startTime = players_[_playerId].currentActionStartTime;
    for (uint i = 0; i < pendingQueuedActionState.equipmentStates.length; ++i) {
      PendingQueuedActionEquipmentState memory equipmentState = pendingQueuedActionState.equipmentStates[i];
      PendingQueuedActionMetadata memory actionMetadata = pendingQueuedActionState.actionMetadatas[i];

      if (equipmentState.consumedItemTokenIds.length > 0) {
        itemNFT.burnBatch(_from, equipmentState.consumedItemTokenIds, equipmentState.consumedAmounts);
        emit Consumes(
          _from,
          _playerId,
          actionMetadata.queueId,
          equipmentState.consumedItemTokenIds,
          equipmentState.consumedAmounts
        );
      }
      if (equipmentState.producedItemTokenIds.length > 0) {
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

      _addPendingRandomReward(
        _from,
        _playerId,
        actionRewards,
        actionMetadata.actionId,
        actionMetadata.queueId,
        uint40(startTime),
        actionMetadata.elapsedTime,
        actionMetadata.xpElapsedTime,
        attire_[_playerId][actionMetadata.queueId],
        skill,
        pendingQueuedActionState.equipmentStates
      );

      if (actionMetadata.died) {
        emit Died(_from, _playerId, actionMetadata.queueId);
      }
      // XP gained
      if (actionMetadata.xpGained != 0) {
        uint previousTotalXP = player.totalXP;
        uint newTotalXP = previousTotalXP.add(actionMetadata.xpGained);
        if (pendingQueuedActionState.xpRewardItemTokenIds.length > 0) {
          itemNFT.mintBatch(
            _from,
            pendingQueuedActionState.xpRewardItemTokenIds,
            pendingQueuedActionState.xpRewardAmounts
          );
          emit ClaimedXPThresholdRewards(
            _from,
            _playerId,
            pendingQueuedActionState.xpRewardItemTokenIds,
            pendingQueuedActionState.xpRewardAmounts
          );
        }
        player.totalXP = uint56(newTotalXP);
      }
      bool fullyFinished = actionMetadata.elapsedTime >= queuedAction.timespan;
      if (fullyFinished) {
        emit ActionFinished(_from, _playerId, actionMetadata.queueId);
      } else {
        emit ActionPartiallyFinished(_from, _playerId, actionMetadata.queueId, actionMetadata.elapsedTime);
      }
      startTime += actionMetadata.elapsedTime;
    }

    // Oracle loot from past random rewards
    if (pendingQueuedActionState.producedPastRandomRewards.length > 0) {
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
    if (questState.consumedItemTokenIds.length > 0 || questState.rewardItemTokenIds.length > 0) {
      if (questState.consumedItemTokenIds.length > 0) {
        itemNFT.burnBatch(_from, questState.consumedItemTokenIds, questState.consumedAmounts);
      }
      if (questState.rewardItemTokenIds.length > 0) {
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
    if (pendingQueuedActionState.dailyRewardItemTokenIds.length > 0) {
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

    // Clear boost if it has expired
    PlayerBoostInfo storage playerBoost = activeBoosts_[_playerId];
    if (playerBoost.itemTokenId != NONE && playerBoost.startTime.add(playerBoost.duration) <= block.timestamp) {
      delete activeBoosts_[_playerId];
      emit BoostFinished(_playerId);
    }
  }

  function _processActionsFinished(
    address _from,
    uint _playerId,
    PendingQueuedActionProcessed memory _pendingQueuedActionProcessed
  ) private {
    _claimRandomRewards(_playerId, _pendingQueuedActionProcessed);
    _handleDailyRewards(_from, _playerId);

    // Clear boost if it has expired
    PlayerBoostInfo storage playerBoost = activeBoosts_[_playerId];
    if (playerBoost.itemTokenId != NONE && playerBoost.startTime.add(playerBoost.duration) <= block.timestamp) {
      delete activeBoosts_[_playerId];
      emit BoostFinished(_playerId);
    }
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
    uint24 _xpElapsedTime,
    Attire storage _attire,
    Skill _skill,
    PendingQueuedActionEquipmentState[] memory _pendingQueuedActionEquipmentStates
  ) private {
    bool hasRandomRewards = _actionRewards.randomRewardTokenId1 != NONE; // A precheck as an optimization
    if (_xpElapsedTime != 0 && hasRandomRewards) {
      bool hasRandomWord = world.hasRandomWord(_skillStartTime.add(_elapsedTime));
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
            boostType: boostType,
            boostItemTokenId: boostItemTokenId,
            boostStartTime: boostStartTime,
            fullAttireBonusRewardsPercent: fullAttireBonusRewardsPercent
          })
        );
        emit AddPendingRandomReward(_from, _playerId, _queueId, _skillStartTime, _xpElapsedTime);
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
    uint oldPoints = PlayersLibrary.readXP(_skill, xp_[_playerId]);
    if (_xp < oldPoints) {
      revert TestInvalidXP();
    }
    if (playerNFT.balanceOf(_from, _playerId) == 0) {
      revert NotOwnerOfPlayer();
    }
    uint56 updatedPoints = uint56(_xp.sub(oldPoints));
    _updateXP(_from, _playerId, _skill, updatedPoints);
    uint56 newPoints = uint56(players_[_playerId].totalXP.add(updatedPoints));
    _claimTotalXPThresholdRewards(_from, _playerId, oldPoints, newPoints);
    players_[_playerId].totalXP = newPoints;
  }

  function _handleDailyRewards(address _from, uint _playerId) private {
    _delegatecall(implMisc, abi.encodeWithSelector(IPlayersMiscDelegate.handleDailyRewards.selector, _from, _playerId));
  }

  // Staticcall into ourselves and hit the fallback. This is done so that pendingQueuedActionState/dailyClaimedRewards can be exposed on the json abi.
  function _pendingQueuedActionState(
    address _owner,
    uint _playerId
  ) private view returns (PendingQueuedActionState memory) {
    bytes memory data = _staticcall(
      address(this),
      abi.encodeWithSelector(IPlayersRewardsDelegateView.pendingQueuedActionStateImpl.selector, _owner, _playerId)
    );
    return abi.decode(data, (PendingQueuedActionState));
  }
}
