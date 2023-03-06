// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "./PlayersImplBase.sol";

import {PlayerLibrary} from "./PlayerLibrary.sol";

contract PlayersImplRewards is PlayersUpgradeableImplDummyBase, PlayersBase {
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
      _elapsedTime,
      ids,
      amounts,
      length,
      actionRewards,
      monstersKilled,
      isCombat
    );

    assembly ("memory-safe") {
      mstore(ids, length)
      mstore(amounts, length)
    }
  }

  function _claimableRandomRewards(
    uint _playerId
  ) private view returns (uint[] memory ids, uint[] memory amounts, uint numRemoved) {
    PendingRandomReward[] storage pendingRandomRewards = pendingRandomRewards[_playerId];
    ids = new uint[](pendingRandomRewards.length);
    amounts = new uint[](pendingRandomRewards.length);

    uint length;
    for (uint i; i < pendingRandomRewards.length; ++i) {
      bool isCombat = world.getSkill(pendingRandomRewards[i].actionId) == Skill.COMBAT;
      uint numSpawnedPerHour = world.getNumSpawn(pendingRandomRewards[i].actionId);
      uint16 monstersKilled = uint16((numSpawnedPerHour * pendingRandomRewards[i].elapsedTime) / 3600);

      ActionRewards memory actionRewards = world.getActionRewards(pendingRandomRewards[i].actionId);
      uint oldLength = length;
      bool noLuck;
      (length, noLuck) = _appendRandomRewards(
        pendingRandomRewards[i].timestamp,
        pendingRandomRewards[i].elapsedTime,
        ids,
        amounts,
        oldLength,
        actionRewards,
        monstersKilled,
        isCombat
      );

      if (length - oldLength > 0 || noLuck) {
        ++numRemoved;
      }
    }

    assembly ("memory-safe") {
      mstore(ids, length)
      mstore(amounts, length)
    }
  }

  function claimRandomRewards(uint _playerId) public isOwnerOfPlayerAndActive(_playerId) {
    address from = msg.sender;
    (uint[] memory ids, uint[] memory amounts, uint numRemoved) = _claimableRandomRewards(_playerId);

    if (numRemoved > 0) {
      // Shift the remaining rewards to the front of the array
      for (uint i; i < pendingRandomRewards[_playerId].length - numRemoved; ++i) {
        pendingRandomRewards[_playerId][i] = pendingRandomRewards[_playerId][i + numRemoved];
      }

      for (uint i; i < numRemoved; ++i) {
        pendingRandomRewards[_playerId].pop();
      }

      itemNFT.mintBatch(from, ids, amounts);
      //      emit Rewards(from, _playerId, _queueId, ids, amounts);
    }
  }

  function claimableXPThresholdRewards(
    uint _oldTotalSkillPoints,
    uint _newTotalSkillPoints
  ) public view returns (uint[] memory itemTokenIds, uint[] memory amounts) {
    uint16 prevIndex = _findBaseXPThreshold(_oldTotalSkillPoints);
    uint16 nextIndex = _findBaseXPThreshold(_newTotalSkillPoints);
    if (prevIndex != nextIndex) {
      uint32 xpThreshold = _getXPReward(nextIndex);
      Equipment[] memory items = xpRewardThresholds[xpThreshold];
      if (items.length > 0) {
        itemTokenIds = new uint[](items.length);
        amounts = new uint[](items.length);
        for (uint i = 0; i < items.length; ++i) {
          itemTokenIds[i] = items[i].itemTokenId;
          amounts[i] = items[i].amount;
        }
      }
    }
  }

  // Get any changes that are pending and not on the blockchain yet.
  function pendingRewards(
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
    address from = msg.sender;
    uint previousSkillPoints = player.totalSkillPoints;
    uint32 allPointsAccrued;
    for (uint i; i < actionQueue.length; ++i) {
      QueuedAction storage queuedAction = actionQueue[i];

      CombatStats memory combatStats = _getCachedCombatStats(player);

      // This will only ones that they have a balance for at this time. This will check balances
      _updateCombatStats(from, combatStats, queuedAction.attire);

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
      bool isCombat = _isCombat(queuedAction.combatStyle);
      uint xpElapsedTime = elapsedTime;
      if (queuedAction.choiceId != 0) {
        actionChoice = world.getActionChoice(isCombat ? 0 : queuedAction.actionId, queuedAction.choiceId);

        Equipment[] memory consumedEquipment;
        Equipment memory output;

        (consumedEquipment, output, elapsedTime, xpElapsedTime, died) = _processConsumablesView(
          from,
          queuedAction,
          elapsedTime,
          combatStats,
          actionChoice
        );

        if (output.itemTokenId != NONE) {
          pendingOutput.produced[producedLength] = output;
          ++producedLength;
        }

        for (uint j; j < consumedEquipment.length; ++j) {
          pendingOutput.consumed[consumedLength] = consumedEquipment[j];
          ++consumedLength;
        }

        if (died) {
          pendingOutput.died = true;
        }
      }

      if (!died) {
        bool _isCombatSkill = _isCombat(queuedAction.combatStyle);
        uint16 xpPerHour = world.getXPPerHour(queuedAction.actionId, _isCombatSkill ? NONE : queuedAction.choiceId);
        pointsAccrued = uint32((xpElapsedTime * xpPerHour) / 3600);
        pointsAccrued += _extraXPFromBoost(_playerId, _isCombatSkill, queuedAction.startTime, xpElapsedTime, xpPerHour);
      }

      if (_flags.includeLoot && pointsAccrued > 0) {
        (uint[] memory newIds, uint[] memory newAmounts) = getRewards(
          uint40(queuedAction.startTime + elapsedTime),
          xpElapsedTime,
          queuedAction.actionId
        );

        for (uint i; i < newIds.length; ++i) {
          pendingOutput.produced[producedLength] = Equipment(uint16(newIds[i]), uint24(newAmounts[i]));
          ++producedLength;
        }

        // This loot might be needed for a future task so mint now rather than later
        // But this could be improved
        allPointsAccrued += pointsAccrued;
      }
    } // end of loop

    if (_flags.includeXPRewards && allPointsAccrued > 0) {
      (uint[] memory ids, uint[] memory amounts) = claimableXPThresholdRewards(
        previousSkillPoints,
        previousSkillPoints + allPointsAccrued
      );

      for (uint i; i < ids.length; ++i) {
        pendingOutput.producedXPRewards[producedXPRewardsLength] = Equipment(uint16(ids[i]), uint24(amounts[i]));
        ++producedXPRewardsLength;
      }
    }

    if (_flags.includePastRandomRewards) {
      // Loop through any pending random rewards and add them to the output
      (uint[] memory ids, uint[] memory amounts, uint numRemoved) = _claimableRandomRewards(_playerId);

      for (uint i; i < ids.length; ++i) {
        pendingOutput.producedPastRandomRewards[producedPastRandomRewardsLength] = Equipment(
          uint16(ids[i]),
          uint24(amounts[i])
        );
        ++producedPastRandomRewardsLength;
      }
    }

    assembly ("memory-safe") {
      mstore(mload(pendingOutput), consumedLength)
      mstore(mload(add(pendingOutput, 32)), producedLength)
      mstore(mload(add(pendingOutput, 64)), producedPastRandomRewardsLength)
      mstore(mload(add(pendingOutput, 96)), producedXPRewardsLength)
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

    if (numRewards > 0) {
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
    uint elapsedTime,
    uint[] memory _ids,
    uint[] memory _amounts,
    uint _oldLength,
    ActionRewards memory _actionRewards,
    uint16 _monstersKilled,
    bool _isCombat
  ) private view returns (uint length, bool noLuck) {
    length = _oldLength;

    // Easier to make it an array, but TODO update later
    ActionReward[] memory _randomRewards = new ActionReward[](4);
    uint randomRewardLength;
    if (_actionRewards.randomRewardTokenId1 != 0) {
      _randomRewards[0] = ActionReward(_actionRewards.randomRewardTokenId1, _actionRewards.randomRewardChance1);
      ++randomRewardLength;
    }
    if (_actionRewards.randomRewardTokenId2 != 0) {
      _randomRewards[1] = ActionReward(_actionRewards.randomRewardTokenId2, _actionRewards.randomRewardChance2);
      ++randomRewardLength;
    }
    if (_actionRewards.randomRewardTokenId3 != 0) {
      _randomRewards[2] = ActionReward(_actionRewards.randomRewardTokenId3, _actionRewards.randomRewardChance3);
      ++randomRewardLength;
    }
    if (_actionRewards.randomRewardTokenId4 != 0) {
      _randomRewards[3] = ActionReward(_actionRewards.randomRewardTokenId4, _actionRewards.randomRewardChance4);
      ++randomRewardLength;
    }

    assembly ("memory-safe") {
      mstore(_randomRewards, randomRewardLength)
    }

    if (_randomRewards.length > 0) {
      bool hasSeed = world.hasSeed(skillEndTime);
      if (hasSeed) {
        uint seed = world.getSeed(skillEndTime);

        // If combat use monsters killed, otherwise use elapsed time to see how many chances they get
        uint numTickets;
        if (_isCombat) {
          numTickets = _monstersKilled;
        } else {
          // (1 per hour spent)
          numTickets = elapsedTime / 3600;
        }
        bytes32 randomComponent = bytes32(seed) ^
          (bytes32(uint256(skillEndTime)) |
            (bytes32(uint256(skillEndTime)) << 64) |
            (bytes32(uint256(skillEndTime)) << 128) |
            (bytes32(uint256(skillEndTime)) << 192));
        uint startLootLength = length;
        for (uint i; i < numTickets; ++i) {
          // The random component is out of 65535, so we can take 2 bytes at a time
          uint16 rand = uint16(uint256(randomComponent >> (i * 16)));

          // Take each byte and check
          for (uint j; j < _randomRewards.length; ++j) {
            ActionReward memory potentialReward = _randomRewards[j];
            if (rand < potentialReward.rate) {
              // Get the lowest chance one

              // Compare with previous and append amounts if an entry already exists
              bool found;
              for (uint k = startLootLength; k < _ids.length; ++k) {
                if (potentialReward.itemTokenId == _ids[k]) {
                  // exists
                  _amounts[k] += 1;
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
    returns (
      Equipment[] memory consumedEquipment,
      Equipment memory output,
      uint actualElapsedTime,
      uint xpElapsedTime,
      bool died
    )
  {
    // Fetch the requirements for it
    (bool isCombat, CombatStats memory enemyCombatStats) = world.getCombatStats(_queuedAction.actionId);

    consumedEquipment = new Equipment[](4);
    uint consumedEquipmentLength;

    // Figure out how much food should be consumed.
    // This is based on the damage done from battling
    uint16 numConsumed;
    uint combatElapsedTime;
    if (isCombat) {
      (xpElapsedTime, combatElapsedTime, numConsumed) = PlayerLibrary.getAdjustedElapsedTimes(
        _from,
        itemNFT,
        world,
        _elapsedTime,
        _actionChoice,
        _queuedAction,
        _combatStats,
        enemyCombatStats
      );

      uint16 foodConsumed;
      (foodConsumed, died) = PlayerLibrary.foodConsumedView(
        _from,
        _queuedAction,
        combatElapsedTime,
        itemNFT,
        _combatStats,
        enemyCombatStats
      );

      if (_actionChoice.inputTokenId1 != NONE) {
        consumedEquipment[consumedEquipmentLength] = Equipment(_queuedAction.regenerateId, foodConsumed);
        ++consumedEquipmentLength;
      }
    } else {
      actualElapsedTime = _elapsedTime;
    }

    if (numConsumed > 0) {
      if (_actionChoice.inputTokenId1 != NONE) {
        consumedEquipment[consumedEquipmentLength] = Equipment(
          _actionChoice.inputTokenId1,
          numConsumed * _actionChoice.num1
        );
        ++consumedEquipmentLength;
      }
      if (_actionChoice.inputTokenId2 != NONE) {
        consumedEquipment[consumedEquipmentLength] = Equipment(
          _actionChoice.inputTokenId2,
          numConsumed * _actionChoice.num2
        );
        ++consumedEquipmentLength;
      }
      if (_actionChoice.inputTokenId3 != NONE) {
        consumedEquipment[consumedEquipmentLength] = Equipment(
          _actionChoice.inputTokenId3,
          numConsumed * _actionChoice.num3
        );
        ++consumedEquipmentLength;
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
