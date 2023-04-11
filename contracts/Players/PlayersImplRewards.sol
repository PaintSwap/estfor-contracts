// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {UnsafeMath, UnsafeU256, U256} from "@0xdoublesharp/unsafe-math/contracts/UnsafeU256.sol";
import {PlayersUpgradeableImplDummyBase, PlayersBase} from "./PlayersImplBase.sol";
import {PlayersLibrary} from "./PlayersLibrary.sol";

/* solhint-disable no-global-import */
import "../globals/players.sol";
import "../globals/items.sol";
import "../globals/actions.sol";
import "../globals/rewards.sol";

/* solhint-enable no-global-import */

contract PlayersImplRewards is PlayersUpgradeableImplDummyBase, PlayersBase, IPlayersRewardsDelegateView {
  using UnsafeU256 for U256;
  using UnsafeMath for uint256;

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
    if (boostedTime > 0 && activeBoost.boostType == BoostType.GATHERING) {
      for (uint i = 0; i < length; ++i) {
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
    U256 pendingRandomRewardsLength = U256.wrap(_pendingRandomRewards.length);
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
        if (boostedTime > 0 && activeBoost.boostType == BoostType.GATHERING) {
          for (uint j = oldLength; j < length; ++j) {
            amounts[j] = uint32((boostedTime * amounts[j] * activeBoost.val) / (3600 * 100));
          }
        }
        for (uint j = oldLength; j < length; ++j) {
          queueIds[j] = pendingRandomReward.queueId;
          actionIds[j] = pendingRandomReward.actionId;
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
      U256 bounds = U256.wrap(pendingRandomRewards[_playerId].length).sub(numRemoved);
      for (U256 iter; iter < bounds; iter = iter.inc()) {
        uint i = iter.asUint256();
        pendingRandomRewards[_playerId][i] = pendingRandomRewards[_playerId][i + numRemoved];
      }
      for (U256 iter = U256.wrap(numRemoved); iter.neq(0); iter = iter.dec()) {
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
    uint _speedMultiplier = speedMultiplier[_playerId];
    pendingQueuedActionState.consumed = new EquipmentInfo[](actionQueue.length * MAX_CONSUMED_PER_ACTION);
    pendingQueuedActionState.produced = new EquipmentInfo[](
      actionQueue.length * MAX_REWARDS_PER_ACTION + (actionQueue.length * MAX_RANDOM_REWARDS_PER_ACTION)
    );
    pendingQueuedActionState.died = new DiedInfo[](actionQueue.length);
    pendingQueuedActionState.rolls = new RollInfo[](actionQueue.length);
    pendingQueuedActionState.xpGained = new XPInfo[](actionQueue.length);

    uint consumedLength;
    uint producedLength;
    uint diedLength;
    uint rollsLength;
    uint xpGainedLength;

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
    for (uint i; i < actionQueue.length; ++i) {
      QueuedAction storage queuedAction = actionQueue[i];
      CombatStats memory combatStats;
      bool isCombat = _isCombatStyle(queuedAction.combatStyle);
      if (isCombat) {
        // This will only ones that they have a balance for at this time. This will check balances
        combatStats = _getCachedCombatStats(player);
        _updateCombatStats(from, combatStats, queuedAction.attire);
      }
      bool missingRequiredHandEquipment = _updateStatsFromHandEquipment(
        from,
        [queuedAction.rightHandEquipmentTokenId, queuedAction.leftHandEquipmentTokenId],
        combatStats,
        isCombat
      );
      if (missingRequiredHandEquipment) {
        continue;
      }

      uint32 pointsAccrued;
      uint skillEndTime = queuedAction.startTime +
        (_speedMultiplier > 1 ? uint(queuedAction.timespan) / _speedMultiplier : queuedAction.timespan);

      uint elapsedTime = _getElapsedTime(_playerId, skillEndTime, queuedAction);
      if (elapsedTime == 0) {
        break;
      }

      // Create some items if necessary (smithing ores to bars for instance)
      bool died;

      ActionChoice memory actionChoice;
      uint xpElapsedTime = elapsedTime;
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
          died,
          baseNumConsumed,
          numProduced
        ) = _processConsumablesView(from, _playerId, queuedAction, elapsedTime, combatStats, actionChoice);

        choiceIds[choiceIdsLength++] = queuedAction.choiceId;
        Skill skill = _getSkillFromChoiceOrStyle(actionChoice, queuedAction.combatStyle, queuedAction.actionId);
        if (skill == Skill.COOKING) {
          choiceIdAmounts[choiceIdAmountsLength++] = numProduced; // Assume we want amount cooked
        } else {
          choiceIdAmounts[choiceIdAmountsLength++] = baseNumConsumed;
        }

        if (outputEquipment.itemTokenId != NONE) {
          pendingQueuedActionState.produced[producedLength++] = EquipmentInfo(
            queuedAction.actionId,
            queuedAction.queueId,
            uint24(elapsedTime),
            outputEquipment.itemTokenId,
            outputEquipment.amount
          );
        }
        U256 consumedEquipmentLength = U256.wrap(consumedEquipment.length);
        for (U256 iter; iter < consumedEquipmentLength; iter = iter.inc()) {
          pendingQueuedActionState.consumed[consumedLength++] = EquipmentInfo(
            queuedAction.actionId,
            queuedAction.queueId,
            uint24(elapsedTime),
            consumedEquipment[iter.asUint256()].itemTokenId,
            consumedEquipment[iter.asUint256()].amount
          );
        }

        if (died) {
          pendingQueuedActionState.died[diedLength++] = (
            DiedInfo(queuedAction.actionId, queuedAction.queueId, uint24(elapsedTime))
          );
        }
      }

      uint pointsAccruedExclBaseBoost;
      if (!died) {
        Skill skill = _getSkillFromChoiceOrStyle(actionChoice, queuedAction.combatStyle, queuedAction.actionId);
        (pointsAccrued, pointsAccruedExclBaseBoost) = _getPointsAccrued(
          from,
          _playerId,
          queuedAction,
          skill,
          xpElapsedTime
        );
      }
      uint32 xpGained = pointsAccrued;
      if (pointsAccruedExclBaseBoost != 0 && _isCombatStyle(queuedAction.combatStyle)) {
        xpGained += _getHealthPointsFromCombat(_playerId, pointsAccruedExclBaseBoost);
      }

      // Include loot
      (uint[] memory newIds, uint[] memory newAmounts) = getRewards(
        _playerId,
        queuedAction.startTime,
        xpElapsedTime,
        queuedAction.actionId
      );

      U256 newIdsLength = U256.wrap(newIds.length);
      for (U256 iter; iter < newIdsLength; iter = iter.inc()) {
        uint j = iter.asUint256();
        pendingQueuedActionState.produced[producedLength++] = EquipmentInfo(
          queuedAction.actionId,
          queuedAction.queueId,
          uint24(elapsedTime),
          uint16(newIds[j]),
          uint24(newAmounts[j])
        );
      }
      // Total XP gained
      pendingQueuedActionState.xpGained[xpGainedLength++] = XPInfo(
        queuedAction.actionId,
        queuedAction.queueId,
        uint24(elapsedTime),
        xpGained
      );

      totalXPGained += xpGained;

      // Number of pending reward rolls
      (ActionRewards memory actionRewards, Skill actionSkill, uint numSpawnedPerHour) = world.getRewardsHelper(
        queuedAction.actionId
      );
      bool hasRandomRewards = actionRewards.randomRewardTokenId1 != NONE; // A precheck as an optimization
      if (hasRandomRewards) {
        bool hasRandomWord = world.hasRandomWord(queuedAction.startTime + xpElapsedTime);
        if (!hasRandomWord) {
          uint16 monstersKilled = uint16((numSpawnedPerHour * xpElapsedTime) / 3600);
          pendingQueuedActionState.rolls[rollsLength++] = RollInfo(
            queuedAction.actionId,
            queuedAction.queueId,
            uint24(elapsedTime),
            uint32(isCombat ? monstersKilled : xpElapsedTime / 3600)
          );
        }
      }
    } // end of loop

    // XPRewards
    if (totalXPGained != 0) {
      (uint[] memory ids, uint[] memory amounts) = _claimableXPThresholdRewards(
        previousTotalXP,
        previousTotalXP + totalXPGained
      );
      U256 idsLength = U256.wrap(ids.length);
      if (ids.length != 0) {
        pendingQueuedActionState.producedXPRewards = new Equipment[](ids.length);
        for (U256 iter; iter < idsLength; iter = iter.inc()) {
          uint i = iter.asUint256();
          pendingQueuedActionState.producedXPRewards[i] = Equipment(uint16(ids[i]), uint24(amounts[i]));
        }
      }
    }

    // Past Random Rewards
    (
      uint[] memory ids,
      uint[] memory amounts,
      uint[] memory actionIds,
      uint[] memory queueIds,
      uint numRemoved
    ) = _claimableRandomRewards(_playerId);
    U256 idsLength = U256.wrap(ids.length);
    pendingQueuedActionState.producedPastRandomRewards = new PastRandomRewardInfo[](ids.length);
    for (U256 iter; iter < idsLength; iter = iter.inc()) {
      uint i = iter.asUint256();
      pendingQueuedActionState.producedPastRandomRewards[i] = PastRandomRewardInfo(
        uint16(actionIds[i]),
        uint64(queueIds[i]),
        uint16(ids[i]),
        uint24(amounts[i])
      );
    }

    assembly ("memory-safe") {
      mstore(choiceIds, choiceIdsLength)
      mstore(choiceIdAmounts, choiceIdAmountsLength)
    }

    // Quest Rewards
    (
      uint[] memory questRewards,
      uint[] memory questRewardAmounts,
      uint[] memory itemTokenIdsBurned,
      uint[] memory amountsBurned,
      Skill[] memory skillsGained,
      uint32[] memory xp,
      uint[] memory _questsCompleted,
      PlayerQuest[] memory activeQuestsCompletionInfo
    ) = quests.processQuestsView(_playerId, choiceIds, choiceIdAmounts);
    if (questRewards.length > 0) {
      pendingQueuedActionState.questRewards = new Equipment[](questRewards.length);
      for (uint j = 0; j < questRewards.length; ++j) {
        pendingQueuedActionState.questRewards[j] = Equipment(uint16(questRewards[j]), uint24(questRewardAmounts[j]));
      }
      pendingQueuedActionState.questConsumed = new Equipment[](itemTokenIdsBurned.length);
      for (uint j = 0; j < itemTokenIdsBurned.length; ++j) {
        pendingQueuedActionState.questConsumed[j] = Equipment(uint16(itemTokenIdsBurned[j]), uint24(amountsBurned[j]));
      }
    }

    pendingQueuedActionState.activeQuestInfo = activeQuestsCompletionInfo;

    // Compact to fit the arrays
    assembly ("memory-safe") {
      mstore(mload(pendingQueuedActionState), consumedLength)
      mstore(mload(add(pendingQueuedActionState, 32)), producedLength)
      mstore(mload(add(pendingQueuedActionState, 224)), diedLength)
      mstore(mload(add(pendingQueuedActionState, 256)), rollsLength)
      mstore(mload(add(pendingQueuedActionState, 288)), xpGainedLength)
    }
  }

  function dailyClaimedRewardsImpl(uint _playerId) external view returns (bool[7] memory claimed) {
    uint streakStart = ((block.timestamp - 4 days) / 1 weeks) * 1 weeks + 4 days;
    uint streakStartIndex = streakStart / 1 weeks;
    bytes32 mask = dailyRewardMasks[_playerId];
    uint16 lastRewardStartIndex = uint16(uint256(mask));
    if (lastRewardStartIndex < streakStartIndex) {
      mask = bytes32(streakStartIndex);
    }

    for (uint i = 0; i < 7; ++i) {
      claimed[i] = mask[i] != 0;
    }
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
        numRewards = _monstersKilled;
      } else {
        numRewards = (_elapsedTime * _rewardRate * _successPercent) / (3600 * 10 * 100);
      }

      if (numRewards != 0) {
        _ids[length] = _rewardTokenId;
        _amounts[length++] = numRewards;
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
      randomRewards[randomRewardLength++] = RandomReward(
        _rewards.randomRewardTokenId1,
        _rewards.randomRewardChance1,
        _rewards.randomRewardAmount1
      );
    }
    if (_rewards.randomRewardTokenId2 != 0) {
      randomRewards[randomRewardLength++] = RandomReward(
        _rewards.randomRewardTokenId2,
        _rewards.randomRewardChance2,
        _rewards.randomRewardAmount2
      );
    }
    if (_rewards.randomRewardTokenId3 != 0) {
      randomRewards[randomRewardLength++] = RandomReward(
        _rewards.randomRewardTokenId3,
        _rewards.randomRewardChance3,
        _rewards.randomRewardAmount3
      );
    }
    if (_rewards.randomRewardTokenId4 != 0) {
      randomRewards[randomRewardLength++] = RandomReward(
        _rewards.randomRewardTokenId4,
        _rewards.randomRewardChance4,
        _rewards.randomRewardAmount4
      );
    }

    assembly ("memory-safe") {
      mstore(randomRewards, randomRewardLength)
    }
  }

  function _getSlice(bytes memory _b, uint _index) private pure returns (uint16) {
    uint256 index = _index * 2;
    return uint16(_b[index] | (bytes2(_b[index + 1]) >> 8));
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
      // Was the boost active for this?
      uint skillEndTime = _skillStartTime + _elapsedTime;
      hasRandomWord = world.hasRandomWord(skillEndTime);
      if (hasRandomWord) {
        uint numIterations = PlayersLibrary.min(MAX_UNIQUE_TICKETS_, _numTickets);

        bytes memory b = PlayersLibrary.getRandomBytes(numIterations, skillEndTime, _playerId, world);
        uint startLootLength = length;
        for (U256 iter; iter.lt(numIterations); iter = iter.inc()) {
          uint i = iter.asUint256();
          uint mintMultiplier = 1;
          // If there is above 240 tickets we need to mint more if a ticket is hit
          if (_numTickets > MAX_UNIQUE_TICKETS_) {
            mintMultiplier = _numTickets / MAX_UNIQUE_TICKETS_;
            uint remainder = _numTickets % MAX_UNIQUE_TICKETS_;
            if (i < remainder) {
              ++mintMultiplier;
            }
          }

          // The random component is out of 65535, so we can take 2 bytes at a time from the total bytes array
          uint operation = (uint(_getSlice(b, i)) * 100) / _successPercent;
          uint16 rand = uint16(PlayersLibrary.min(type(uint16).max, operation));

          U256 randomRewardsLength = U256.wrap(_randomRewards.length);
          for (U256 iterJ; iterJ < randomRewardsLength; iterJ = iterJ.inc()) {
            uint j = iterJ.asUint256();

            RandomReward memory potentialReward = _randomRewards[j];
            if (rand <= potentialReward.chance) {
              // This random reward's chance was hit, so add it
              bool found;
              U256 idsLength = U256.wrap(_ids.length);
              // Add this random item
              for (U256 iterK = U256.wrap(startLootLength); iterK < idsLength; iterK = iterK.inc()) {
                uint k = iterK.asUint256();
                if (k > 0 && potentialReward.itemTokenId == _ids[k - 1]) {
                  // This item exists so accumulate it with the existing value
                  _amounts[k - 1] += potentialReward.amount * mintMultiplier;
                  found = true;
                  break;
                }
              }

              if (!found) {
                // New item
                _ids[length] = potentialReward.itemTokenId;
                _amounts[length++] = potentialReward.amount * mintMultiplier;
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

  function _processConsumablesView(
    address _from,
    uint _playerId,
    QueuedAction storage _queuedAction,
    uint _elapsedTime,
    CombatStats memory _combatStats,
    ActionChoice memory _actionChoice
  )
    private
    view
    returns (
      Equipment[] memory consumedEquipment,
      Equipment memory outputEquipment,
      uint xpElapsedTime,
      bool died,
      uint24 numConsumed,
      uint24 numProduced
    )
  {
    consumedEquipment = new Equipment[](4);
    uint consumedEquipmentLength;

    // Figure out how much food should be consumed.
    // This is based on the damage done from battling
    bool isCombat = _isCombatStyle(_queuedAction.combatStyle);
    if (isCombat) {
      // Fetch the requirements for it
      CombatStats memory enemyCombatStats = world.getCombatStats(_queuedAction.actionId);

      uint combatElapsedTime;
      (xpElapsedTime, combatElapsedTime, numConsumed) = PlayersLibrary.getCombatAdjustedElapsedTimes(
        _from,
        itemNFT,
        world,
        _elapsedTime,
        _actionChoice,
        _queuedAction,
        _combatStats,
        enemyCombatStats,
        alphaCombat,
        betaCombat
      );

      uint24 foodConsumed;
      (foodConsumed, died) = PlayersLibrary.foodConsumedView(
        _from,
        _queuedAction,
        combatElapsedTime,
        itemNFT,
        _combatStats,
        enemyCombatStats,
        alphaCombat,
        betaCombat
      );

      if (_queuedAction.regenerateId != NONE && foodConsumed != 0) {
        consumedEquipment[consumedEquipmentLength++] = Equipment(_queuedAction.regenerateId, foodConsumed);
      }
    } else {
      (xpElapsedTime, numConsumed) = PlayersLibrary.getNonCombatAdjustedElapsedTime(
        _from,
        itemNFT,
        _elapsedTime,
        _actionChoice
      );
    }

    if (numConsumed != 0) {
      if (_actionChoice.inputTokenId1 != NONE) {
        consumedEquipment[consumedEquipmentLength++] = Equipment(
          _actionChoice.inputTokenId1,
          numConsumed * _actionChoice.num1
        );
      }
      if (_actionChoice.inputTokenId2 != NONE) {
        consumedEquipment[consumedEquipmentLength++] = Equipment(
          _actionChoice.inputTokenId2,
          numConsumed * _actionChoice.num2
        );
      }
      if (_actionChoice.inputTokenId3 != NONE) {
        consumedEquipment[consumedEquipmentLength++] = Equipment(
          _actionChoice.inputTokenId3,
          numConsumed * _actionChoice.num3
        );
      }
    }

    if (_actionChoice.outputTokenId != 0) {
      uint8 successPercent = 100;
      if (_actionChoice.successPercent != 100) {
        uint minLevel = PlayersLibrary.getLevel(_actionChoice.minXP);
        uint skillLevel = PlayersLibrary.getLevel(xp_[_playerId][_actionChoice.skill]);
        uint extraBoost = skillLevel - minLevel;

        successPercent = uint8(
          PlayersLibrary.min(MAX_SUCCESS_PERCENT_CHANCE_, _actionChoice.successPercent + extraBoost)
        );
      }

      numProduced = uint24((numConsumed * _actionChoice.outputNum * successPercent) / 100);

      // Check for any gathering boosts
      PlayerBoostInfo storage activeBoost = activeBoosts_[_playerId];
      uint boostedTime = PlayersLibrary.getBoostedTime(_queuedAction.startTime, _elapsedTime, activeBoost);
      if (boostedTime > 0 && activeBoost.boostType == BoostType.GATHERING) {
        numProduced += uint24((boostedTime * numProduced * activeBoost.val) / (3600 * 100));
      }

      if (numProduced != 0) {
        outputEquipment = Equipment(_actionChoice.outputTokenId, numProduced);
      }
    }

    assembly ("memory-safe") {
      mstore(consumedEquipment, consumedEquipmentLength)
    }
  }
}
