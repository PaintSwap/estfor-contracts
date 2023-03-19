// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {UnsafeMath, UnsafeU256, U256} from "@0xdoublesharp/unsafe-math/contracts/UnsafeU256.sol";
import {PlayersUpgradeableImplDummyBase, PlayersBase} from "./PlayersImplBase.sol";
import {PlayerLibrary} from "./PlayerLibrary.sol";

// solhint-disable-next-line no-global-import
import "../globals/players.sol";
// solhint-disable-next-line no-global-import
import "../globals/items.sol";
// solhint-disable-next-line no-global-import
import "../globals/actions.sol";
// solhint-disable-next-line no-global-import
import "../globals/rewards.sol";

contract PlayersImplRewards is PlayersUpgradeableImplDummyBase, PlayersBase, IPlayersDelegateView {
  using UnsafeU256 for U256;
  using UnsafeMath for uint256;

  constructor() {
    _checkStartSlot();
  }

  function getRewards(
    uint40 _skillEndTime,
    uint _elapsedTime,
    uint16 _actionId
  ) public view returns (uint[] memory ids, uint[] memory amounts) {
    ActionRewards memory actionRewards = world.getActionRewards(_actionId);
    bool isCombat = world.getSkill(_actionId) == Skill.COMBAT;

    ids = new uint[](MAX_REWARDS_PER_ACTION);
    amounts = new uint[](MAX_REWARDS_PER_ACTION);

    uint numSpawnedPerHour = world.getNumSpawn(_actionId);
    uint16 monstersKilled = uint16((numSpawnedPerHour * _elapsedTime) / 3600);

    uint length = _appendGuaranteedRewards(ids, amounts, _elapsedTime, actionRewards, monstersKilled, isCombat);
    bool noLuck;
    (length, noLuck) = _appendRandomRewards(
      _skillEndTime,
      isCombat ? monstersKilled : _elapsedTime / 3600,
      ids,
      amounts,
      length,
      actionRewards
    );

    assembly ("memory-safe") {
      mstore(ids, length)
      mstore(amounts, length)
    }
  }

  function _claimableRandomRewards(
    uint _playerId
  ) private view returns (uint[] memory ids, uint[] memory amounts, uint numRemoved) {
    PendingRandomReward[] storage _pendingRandomRewards = pendingRandomRewards[_playerId];
    U256 pendingRandomRewardsLength = U256.wrap(_pendingRandomRewards.length);
    ids = new uint[](pendingRandomRewardsLength.asUint256());
    amounts = new uint[](pendingRandomRewardsLength.asUint256());

    uint length;
    for (U256 iter; iter < pendingRandomRewardsLength; iter = iter.inc()) {
      uint i = iter.asUint256();
      bool isCombat = world.getSkill(_pendingRandomRewards[i].actionId) == Skill.COMBAT;
      uint numSpawnedPerHour = world.getNumSpawn(_pendingRandomRewards[i].actionId);
      uint16 monstersKilled = uint16((numSpawnedPerHour * _pendingRandomRewards[i].elapsedTime) / 3600);

      ActionRewards memory actionRewards = world.getActionRewards(_pendingRandomRewards[i].actionId);
      uint oldLength = length;
      bool noLuck;
      (length, noLuck) = _appendRandomRewards(
        _pendingRandomRewards[i].timestamp,
        isCombat ? monstersKilled : _pendingRandomRewards[i].elapsedTime / 3600,
        ids,
        amounts,
        oldLength,
        actionRewards
      );

      if (length - oldLength != 0 || noLuck) {
        numRemoved = numRemoved.inc();
      }
    }

    assembly ("memory-safe") {
      mstore(ids, length)
      mstore(amounts, length)
    }
  }

  function claimRandomRewards(uint _playerId) external isOwnerOfPlayerAndActive(_playerId) {
    address from = msg.sender;
    (uint[] memory ids, uint[] memory amounts, uint numRemoved) = _claimableRandomRewards(_playerId);
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

      emit PendingRandomRewardsClaimed(from, _playerId, numRemoved);

      itemNFT.mintBatch(from, ids, amounts);
      emit Rewards(from, _playerId, 0, ids, amounts);
    }
  }

  function claimableXPThresholdRewards(
    uint _oldTotalXP,
    uint _newTotalXP
  ) public view returns (uint[] memory itemTokenIds, uint[] memory amounts) {
    uint16 prevIndex = _findBaseXPThreshold(_oldTotalXP);
    uint16 nextIndex = _findBaseXPThreshold(_newTotalXP);
    if (prevIndex != nextIndex) {
      uint32 xpThreshold = _getXPReward(nextIndex);
      Equipment[] memory items = xpRewardThresholds[xpThreshold];
      if (items.length != 0) {
        U256 iter = U256.wrap(items.length);
        itemTokenIds = new uint[](iter.asUint256());
        amounts = new uint[](iter.asUint256());

        while (iter.neq(0)) {
          iter = iter.dec();
          uint i = iter.asUint256();
          itemTokenIds[i] = items[i].itemTokenId;
          amounts[i] = items[i].amount;
        }
      }
    }
  }

  // Get any changes that are pending and not on the blockchain yet.
  function pendingRewardsImpl(
    address _owner,
    uint _playerId,
    PendingFlags memory _flags
  ) external view returns (PendingOutput memory pendingOutput) {
    Player storage player = players[_playerId];
    QueuedAction[] storage actionQueue = player.actionQueue;
    uint _speedMultiplier = speedMultiplier[_playerId];
    PendingRandomReward[] storage _pendingRandomRewards = pendingRandomRewards[_playerId];

    pendingOutput.consumed = new Equipment[](actionQueue.length * MAX_CONSUMED_PER_ACTION);
    pendingOutput.produced = new Equipment[](
      actionQueue.length * MAX_REWARDS_PER_ACTION + (_pendingRandomRewards.length * MAX_RANDOM_REWARDS_PER_ACTION)
    );
    pendingOutput.producedPastRandomRewards = new Equipment[](20);
    pendingOutput.producedXPRewards = new Equipment[](20);

    uint consumedLength;
    uint producedLength;
    uint producedPastRandomRewardsLength;
    uint producedXPRewardsLength;
    address from = _owner;
    uint previousTotalXP = player.totalXP;
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
        Equipment memory output;

        (consumedEquipment, output, xpElapsedTime, died) = _processConsumablesView(
          from,
          queuedAction,
          elapsedTime,
          combatStats,
          actionChoice
        );

        if (output.itemTokenId != NONE) {
          pendingOutput.produced[producedLength++] = output;
        }
        U256 consumedEquipmentLength = U256.wrap(consumedEquipment.length);
        for (U256 iter; iter < consumedEquipmentLength; iter = iter.inc()) {
          pendingOutput.consumed[consumedLength++] = consumedEquipment[iter.asUint256()];
        }

        pendingOutput.died = died;
      }

      if (!died) {
        Skill skill = world.getSkill(queuedAction.actionId);
        pointsAccrued = _getPointsAccrued(from, _playerId, queuedAction, skill, xpElapsedTime);
      }

      if (_flags.includeLoot && pointsAccrued != 0) {
        (uint[] memory newIds, uint[] memory newAmounts) = getRewards(
          uint40(queuedAction.startTime + xpElapsedTime),
          xpElapsedTime,
          queuedAction.actionId
        );

        U256 newIdsLength = U256.wrap(newIds.length);
        for (U256 iter; iter < newIdsLength; iter = iter.inc()) {
          uint j = iter.asUint256();
          pendingOutput.produced[producedLength++] = Equipment(uint16(newIds[j]), uint24(newAmounts[j]));
        }

        // This loot might be needed for a future task so mint now rather than later
        // But this could be improved
        pendingOutput.xpGained += pointsAccrued;
      }
    } // end of loop

    if (_flags.includeXPRewards && pendingOutput.xpGained != 0) {
      (uint[] memory ids, uint[] memory amounts) = claimableXPThresholdRewards(
        previousTotalXP,
        previousTotalXP + pendingOutput.xpGained
      );
      U256 idsLength = U256.wrap(ids.length);
      for (U256 iter; iter < idsLength; iter = iter.inc()) {
        uint i = iter.asUint256();
        pendingOutput.producedXPRewards[producedXPRewardsLength++] = Equipment(uint16(ids[i]), uint24(amounts[i]));
      }
    }

    if (_flags.includePastRandomRewards) {
      // Loop through any pending random rewards and add them to the output
      (uint[] memory ids, uint[] memory amounts, uint numRemoved) = _claimableRandomRewards(_playerId);
      U256 idsLength = U256.wrap(ids.length);
      for (U256 iter; iter < idsLength; iter = iter.inc()) {
        uint i = iter.asUint256();
        pendingOutput.producedPastRandomRewards[producedPastRandomRewardsLength++] = Equipment(
          uint16(ids[i]),
          uint24(amounts[i])
        );
      }
    }

    // Compact to fit the arrays
    assembly ("memory-safe") {
      mstore(mload(pendingOutput), consumedLength)
      mstore(mload(add(pendingOutput, 32)), producedLength)
      mstore(mload(add(pendingOutput, 64)), producedPastRandomRewardsLength)
      mstore(mload(add(pendingOutput, 96)), producedXPRewardsLength)
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
    bool _isCombat
  ) private pure returns (uint length) {
    length = _oldLength;

    uint numRewards;
    if (_isCombat) {
      numRewards = _monstersKilled;
    } else {
      numRewards = (_elapsedTime * _rewardRate) / (3600 * 100);
    }

    if (numRewards != 0) {
      _ids[length] = _rewardTokenId;
      _amounts[length] = numRewards;
      ++length;
    }
  }

  function _appendGuaranteedRewards(
    uint[] memory _ids,
    uint[] memory _amounts,
    uint _elapsedTime,
    ActionRewards memory _actionRewards,
    uint16 _monstersKilled,
    bool _isCombat
  ) private pure returns (uint length) {
    length = _appendGuaranteedReward(
      _ids,
      _amounts,
      _elapsedTime,
      _actionRewards.guaranteedRewardTokenId1,
      _actionRewards.guaranteedRewardRate1,
      length,
      _monstersKilled,
      _isCombat
    );
    length = _appendGuaranteedReward(
      _ids,
      _amounts,
      _elapsedTime,
      _actionRewards.guaranteedRewardTokenId2,
      _actionRewards.guaranteedRewardRate3,
      length,
      _monstersKilled,
      _isCombat
    );
    length = _appendGuaranteedReward(
      _ids,
      _amounts,
      _elapsedTime,
      _actionRewards.guaranteedRewardTokenId3,
      _actionRewards.guaranteedRewardRate2,
      length,
      _monstersKilled,
      _isCombat
    );
  }

  function _appendRandomRewards(
    uint40 skillEndTime,
    uint _numTickets,
    uint[] memory _ids,
    uint[] memory _amounts,
    uint _oldLength,
    ActionRewards memory _actionRewards
  ) private view returns (uint length, bool noLuck) {
    length = _oldLength;

    ActionReward[] memory _randomRewards = new ActionReward[](4);
    uint randomRewardLength;
    if (_actionRewards.randomRewardTokenId1 != 0) {
      _randomRewards[randomRewardLength++] = ActionReward(
        _actionRewards.randomRewardTokenId1,
        _actionRewards.randomRewardChance1
      );
    }
    if (_actionRewards.randomRewardTokenId2 != 0) {
      _randomRewards[randomRewardLength++] = ActionReward(
        _actionRewards.randomRewardTokenId2,
        _actionRewards.randomRewardChance2
      );
    }
    if (_actionRewards.randomRewardTokenId3 != 0) {
      _randomRewards[randomRewardLength++] = ActionReward(
        _actionRewards.randomRewardTokenId3,
        _actionRewards.randomRewardChance3
      );
    }
    if (_actionRewards.randomRewardTokenId4 != 0) {
      _randomRewards[randomRewardLength++] = ActionReward(
        _actionRewards.randomRewardTokenId4,
        _actionRewards.randomRewardChance4
      );
    }

    assembly ("memory-safe") {
      mstore(_randomRewards, randomRewardLength)
    }

    if (_randomRewards.length != 0) {
      bool hasSeed = world.hasSeed(skillEndTime);
      if (hasSeed) {
        uint seed = world.getSeed(skillEndTime);
        bytes32 randomComponent = bytes32(seed) ^
          (bytes32(uint256(skillEndTime)) |
            (bytes32(uint256(skillEndTime)) << 64) |
            (bytes32(uint256(skillEndTime)) << 128) |
            (bytes32(uint256(skillEndTime)) << 192));
        uint startLootLength = length;
        for (U256 iter; iter.lt(_numTickets); iter = iter.inc()) {
          uint i = iter.asUint256();
          // The random component is out of 65535, so we can take 2 bytes at a time
          uint16 rand = uint16(uint256(randomComponent >> (i * 16)));

          // Take each byte and check
          U256 randomRewardsLength = U256.wrap(_randomRewards.length);
          for (U256 iterJ; iterJ < randomRewardsLength; iterJ = iterJ.inc()) {
            uint j = iterJ.asUint256();

            ActionReward memory potentialReward = _randomRewards[j];
            if (rand < potentialReward.rate) {
              // Get the lowest chance one

              // Compare with previous and append amounts if an entry already exists
              bool found;

              U256 idsLength = U256.wrap(_ids.length);
              for (U256 iterK = U256.wrap(startLootLength); iterK < idsLength; iterK = iterK.inc()) {
                uint k = iterK.asUint256();
                if (potentialReward.itemTokenId == _ids[k]) {
                  // exists
                  ++_amounts[k];
                  found = true;
                  break;
                }
              }

              if (!found) {
                // New item
                _ids[length] = potentialReward.itemTokenId;
                _amounts[length] = 1;
                ++length;
              }
              break;
            }
          }
        }

        if (length == 0) {
          noLuck = true;
        }
      }
    }
  }

  function _processConsumablesView(
    address _from,
    QueuedAction storage _queuedAction,
    uint _elapsedTime,
    CombatStats memory _combatStats,
    ActionChoice memory _actionChoice
  )
    private
    view
    returns (Equipment[] memory consumedEquipment, Equipment memory output, uint xpElapsedTime, bool died)
  {
    consumedEquipment = new Equipment[](4);
    uint consumedEquipmentLength;

    // Figure out how much food should be consumed.
    // This is based on the damage done from battling
    uint24 numConsumed;
    bool isCombat = _isCombatStyle(_queuedAction.combatStyle);
    if (isCombat) {
      // Fetch the requirements for it
      CombatStats memory enemyCombatStats = world.getCombatStats(_queuedAction.actionId);

      uint combatElapsedTime;
      (xpElapsedTime, combatElapsedTime, numConsumed) = PlayerLibrary.getCombatAdjustedElapsedTimes(
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
      (foodConsumed, died) = PlayerLibrary.foodConsumedView(
        _from,
        _queuedAction,
        combatElapsedTime,
        itemNFT,
        _combatStats,
        enemyCombatStats,
        alphaCombat,
        betaCombat
      );

      if (_actionChoice.inputTokenId1 != NONE) {
        consumedEquipment[consumedEquipmentLength++] = Equipment(_queuedAction.regenerateId, foodConsumed);
      }
    } else {
      (xpElapsedTime, numConsumed) = PlayerLibrary.getNonCombatAdjustedElapsedTime(
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
      output = Equipment(_actionChoice.outputTokenId, numConsumed);
    }

    assembly ("memory-safe") {
      mstore(consumedEquipment, consumedEquipmentLength)
    }
  }
}
