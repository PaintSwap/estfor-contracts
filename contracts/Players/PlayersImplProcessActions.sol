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

contract PlayersImplProcessActions is PlayersUpgradeableImplDummyBase, PlayersBase {
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
        pendingRandomRewards[_playerId],
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
      bool fullyFinished = actionMetadata.elapsedTime >= players_[_playerId].actionQueue[i].timespan;
      if (fullyFinished) {
        emit ActionFinished(_from, _playerId, actionMetadata.queueId);
      } else {
        emit ActionPartiallyFinished(_from, _playerId, actionMetadata.queueId, actionMetadata.elapsedTime);
      }
      startTime += actionMetadata.elapsedTime;
    }

    // Oracle loot from past random rewards
    if (pendingQueuedActionState.producedPastRandomRewards.length > 0) {
      PastRandomRewardInfo[] memory pastRandomRewardInfo = pendingQueuedActionState.producedPastRandomRewards;

      uint[] memory itemTokenIds = new uint[](pastRandomRewardInfo.length);
      uint[] memory amounts = new uint[](pastRandomRewardInfo.length);
      uint[] memory queueIds = new uint[](pastRandomRewardInfo.length);
      for (uint j = 0; j < pastRandomRewardInfo.length; ++j) {
        itemTokenIds[j] = pastRandomRewardInfo[j].itemTokenId;
        amounts[j] = pastRandomRewardInfo[j].amount;
        queueIds[j] = pastRandomRewardInfo[j].queueId;

        if (pastRandomRewardInfo[j].numRemoved != 0) {
          // Shift the remaining rewards to the front of the array
          U256 bounds = pendingRandomRewards[_playerId].length.asU256().sub(pastRandomRewardInfo[j].numRemoved);
          for (U256 iter; iter < bounds; iter = iter.inc()) {
            uint k = iter.asUint256();
            pendingRandomRewards[_playerId][k] = pendingRandomRewards[_playerId][
              k + pastRandomRewardInfo[j].numRemoved
            ];
          }
          for (U256 iter = pastRandomRewardInfo[j].numRemoved.asU256(); iter.neq(0); iter = iter.dec()) {
            pendingRandomRewards[_playerId].pop();
          }

          itemNFT.mintBatch(_from, itemTokenIds, amounts);
          emit PendingRandomRewardsClaimed(
            _from,
            _playerId,
            pastRandomRewardInfo[j].numRemoved,
            itemTokenIds,
            amounts,
            queueIds
          );
        }
      }
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
    PendingRandomReward[] storage _pendingRandomRewards,
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
    if (hasRandomRewards) {
      bool hasRandomWord = world.hasRandomWord(_skillStartTime.add(_elapsedTime));
      if (!hasRandomWord) {
        PlayerBoostInfo storage activeBoost = activeBoosts_[_playerId];
        BoostType boostType;
        uint16 boostValue;
        uint24 boostedTime;
        if (activeBoost.boostType == BoostType.GATHERING) {
          boostedTime = PlayersLibrary.getBoostedTime(_skillStartTime, _xpElapsedTime, activeBoost);
          if (boostedTime != 0) {
            boostType = activeBoost.boostType;
            boostValue = activeBoost.val;
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
        _pendingRandomRewards.push(
          PendingRandomReward({
            actionId: _actionId,
            queueId: _queueId,
            startTime: uint40(_skillStartTime),
            xpElapsedTime: uint24(_xpElapsedTime),
            boostType: boostType,
            boostValue: boostValue,
            boostedTime: boostedTime,
            fullAttireBonusRewardsPercent: fullAttireBonusRewardsPercent
          })
        );
        emit AddPendingRandomReward(_from, _playerId, _queueId, _skillStartTime, _xpElapsedTime);
      }
    }
  }

  function completeProcessConsumablesView(
    address from,
    uint _playerId,
    QueuedAction memory queuedAction,
    ActionChoice memory actionChoice,
    CombatStats memory combatStats,
    uint elapsedTime,
    uint startTime,
    PendingQueuedActionEquipmentState[] memory pendingQueuedActionEquipmentStates,
    PendingQueuedActionProcessed memory _pendingQueuedActionProcessed
  )
    external
    view
    returns (
      Equipment[] memory consumedEquipments,
      Equipment memory producedEquipment,
      uint xpElapsedTime,
      bool died,
      uint16 foodConsumed,
      uint16 baseInputItemsConsumedNum
    )
  {
    // Processed
    uint prevProcessedTime = queuedAction.prevProcessedTime;
    uint veryStartTime = startTime.sub(prevProcessedTime);

    // Total used
    if (prevProcessedTime > 0) {
      uint16 currentActionProcessedFoodConsumed = players_[_playerId].currentActionProcessedFoodConsumed;
      uint16 currentActionProcessedBaseInputItemsConsumedNum = players_[_playerId]
        .currentActionProcessedBaseInputItemsConsumedNum;

      (
        Equipment[] memory prevConsumedEquipments,
        Equipment memory prevProducedEquipment
      ) = _processConsumablesViewStateTrans(
          _playerId,
          veryStartTime,
          prevProcessedTime,
          actionChoice,
          queuedAction.regenerateId,
          currentActionProcessedFoodConsumed,
          _pendingQueuedActionProcessed,
          currentActionProcessedBaseInputItemsConsumedNum
        );

      uint prevXPElapsedTime = queuedAction.prevProcessedXPTime;

      // Copy existing pending
      PendingQueuedActionEquipmentState
        memory extendedPendingQueuedActionEquipmentState = pendingQueuedActionEquipmentStates[
          pendingQueuedActionEquipmentStates.length - 1
        ];

      if (prevConsumedEquipments.length > 0) {
        // Add to produced
        extendedPendingQueuedActionEquipmentState.producedItemTokenIds = new uint[](prevConsumedEquipments.length);
        extendedPendingQueuedActionEquipmentState.producedAmounts = new uint[](prevConsumedEquipments.length);
        for (uint j = 0; j < prevConsumedEquipments.length; ++j) {
          extendedPendingQueuedActionEquipmentState.producedItemTokenIds[j] = prevConsumedEquipments[j].itemTokenId;
          extendedPendingQueuedActionEquipmentState.producedAmounts[j] = prevConsumedEquipments[j].amount;
        }
      }
      if (prevProducedEquipment.itemTokenId != NONE) {
        // Add to consumed
        extendedPendingQueuedActionEquipmentState.consumedItemTokenIds = new uint[](1);
        extendedPendingQueuedActionEquipmentState.consumedAmounts = new uint[](1);
        extendedPendingQueuedActionEquipmentState.consumedItemTokenIds[0] = prevProducedEquipment.itemTokenId;
        extendedPendingQueuedActionEquipmentState.consumedAmounts[0] = prevProducedEquipment.amount;
      }

      Equipment[] memory __consumedEquipments;
      (
        __consumedEquipments,
        producedEquipment,
        xpElapsedTime,
        died,
        foodConsumed,
        baseInputItemsConsumedNum
      ) = _processConsumablesView(
        from,
        _playerId,
        queuedAction,
        veryStartTime,
        elapsedTime + prevProcessedTime,
        combatStats,
        actionChoice,
        pendingQueuedActionEquipmentStates,
        _pendingQueuedActionProcessed
      );
      delete extendedPendingQueuedActionEquipmentState;

      // Get the difference
      consumedEquipments = new Equipment[](__consumedEquipments.length); // This should be greater than _consumedEquipments
      uint consumedEquipmentsLength;
      for (uint j = 0; j < __consumedEquipments.length; ++j) {
        // Check if it exists in _consumedEquipments and if so, subtract the amount
        bool nonZero = true;
        for (uint k = 0; k < prevConsumedEquipments.length; ++k) {
          if (__consumedEquipments[j].itemTokenId == prevConsumedEquipments[k].itemTokenId) {
            __consumedEquipments[j].amount = uint24(
              __consumedEquipments[j].amount.sub(prevConsumedEquipments[k].amount)
            );
            nonZero = __consumedEquipments[j].amount != 0;
            break;
          }
        }
        if (nonZero) {
          consumedEquipments[consumedEquipmentsLength++] = __consumedEquipments[j];
        }
      }

      assembly ("memory-safe") {
        mstore(consumedEquipments, consumedEquipmentsLength)
      }

      // Do the same for outputEquipment, check if it exists and subtract amount
      producedEquipment.amount = uint24(producedEquipment.amount.sub(prevProducedEquipment.amount));
      if (producedEquipment.amount == 0) {
        producedEquipment.itemTokenId = NONE;
      }

      if (xpElapsedTime >= prevXPElapsedTime) {
        // Maybe died
        xpElapsedTime = xpElapsedTime.sub(prevXPElapsedTime);
      }
      // This is scrolls, doesn't affect melee actually
      if (baseInputItemsConsumedNum >= currentActionProcessedBaseInputItemsConsumedNum) {
        baseInputItemsConsumedNum = uint16(
          baseInputItemsConsumedNum.sub(currentActionProcessedBaseInputItemsConsumedNum)
        );
      }

      if (foodConsumed >= currentActionProcessedFoodConsumed) {
        foodConsumed = uint16(foodConsumed.sub(currentActionProcessedFoodConsumed));
      }
    } else {
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
        veryStartTime,
        elapsedTime + prevProcessedTime,
        combatStats,
        actionChoice,
        pendingQueuedActionEquipmentStates,
        _pendingQueuedActionProcessed
      );
    }
  }

  function _processConsumablesView(
    address _from,
    uint _playerId,
    QueuedAction memory _queuedAction,
    uint _currentActionStartTime,
    uint _elapsedTime,
    CombatStats memory _combatStats,
    ActionChoice memory _actionChoice,
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
        IPlayersMiscDelegateView.processConsumablesViewImpl.selector,
        _from,
        _playerId,
        _queuedAction,
        _currentActionStartTime,
        _elapsedTime,
        _combatStats,
        _actionChoice,
        _pendingQueuedActionEquipmentStates,
        _pendingQueuedActionProcessed
      )
    );
    return abi.decode(data, (Equipment[], Equipment, uint, bool, uint16, uint16));
  }

  function _claimTotalXPThresholdRewards(address _from, uint _playerId, uint _oldTotalXP, uint _newTotalXP) private {
    (uint[] memory itemTokenIds, uint[] memory amounts) = _claimableXPThresholdRewards(_oldTotalXP, _newTotalXP);
    if (itemTokenIds.length != 0) {
      itemNFT.mintBatch(_from, itemTokenIds, amounts);
      emit ClaimedXPThresholdRewards(_from, _playerId, itemTokenIds, amounts);
    }
  }

  function testModifyXP(address _from, uint _playerId, Skill _skill, uint56 _xp) external {
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

  function _processConsumablesViewStateTrans(
    uint _playerId,
    uint _currentActionStartTime,
    uint _elapsedTime,
    ActionChoice memory _actionChoice,
    uint16 _regenerateId,
    uint16 _foodConsumed,
    PendingQueuedActionProcessed memory _pendingQueuedActionProcessed,
    uint16 _baseInputItemsConsumedNum
  ) private view returns (Equipment[] memory consumedEquipment, Equipment memory producedEquipment) {
    bytes memory data = _staticcall(
      address(this),
      abi.encodeWithSelector(
        IPlayersMiscDelegateView.processConsumablesViewStateTrans.selector,
        _playerId,
        _currentActionStartTime,
        _elapsedTime,
        _actionChoice,
        _regenerateId,
        _foodConsumed,
        _pendingQueuedActionProcessed,
        _baseInputItemsConsumedNum
      )
    );
    return abi.decode(data, (Equipment[], Equipment));
  }
}
