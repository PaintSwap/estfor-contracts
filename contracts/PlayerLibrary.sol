// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/utils/Base64.sol";
import "./types.sol";
import "./World.sol";
import "./ItemNFT.sol";
import "./Players.sol"; // Might not even be needed

// Show all the player stats, return metadata json
library PlayerLibrary {
  // Should match the event in Players
  event Reward(address _from, uint playerId, uint queueId, uint itemTokenId, uint amount);
  event Consume(address _from, uint playerId, uint queueId, uint itemTokenId, uint amount);

  function uri(
    bytes32 name,
    mapping(Skill => uint32) storage skillPoints,
    CombatStats calldata totalStats,
    bytes32 avatarName,
    string calldata avatarDescription,
    string calldata imageURI
  ) external view returns (string memory) {
    string memory attributes = string(
      abi.encodePacked(
        '{"trait_type":"Player name","value":"',
        name,
        '{"trait_type":"Attack","value":"',
        skillPoints[Skill.ATTACK],
        '"}, {"trait_type":"Defence","value":"',
        skillPoints[Skill.DEFENCE],
        '"}, {"trait_type":"Mining","value":"',
        skillPoints[Skill.MINING],
        '{"trait_type":"WoodCutting","value":"',
        skillPoints[Skill.WOODCUTTING],
        '"}, {"trait_type":"Fishing","value":"',
        skillPoints[Skill.FISHING],
        '{"trait_type":"Smithing","value":"',
        skillPoints[Skill.SMITHING],
        '"}, {"trait_type":"Thieving","value":"',
        skillPoints[Skill.THIEVING],
        '{"trait_type":"Crafting","value":"',
        skillPoints[Skill.CRAFTING],
        '"}, {"trait_type":"Cooking","value":"',
        skillPoints[Skill.COOKING],
        '{"trait_type":"FireMaking","value":"',
        skillPoints[Skill.FIREMAKING],
        '"}, {"trait_type":"Max health","value":"',
        totalStats.health,
        '"}'
      )
    );

    string memory json = Base64.encode(
      bytes(
        string(
          abi.encodePacked(
            '{"name": "',
            avatarName,
            '", "description": "',
            avatarDescription,
            '", attributes":[',
            attributes,
            ', "image": "',
            imageURI,
            '"}'
          )
        )
      )
    );

    // Base64
    string memory output = string(abi.encodePacked("data:application/json;base64,", json));

    // If both are set, concatenate the baseURI and tokenURI (via abi.encodePacked).
    return output;
  }

  function updateCombatStats(
    address _from,
    CombatStats memory _stats,
    Attire memory _attire,
    ItemNFT _itemNFT,
    bool _add
  ) public view returns (CombatStats memory stats) {
    stats = _stats;
    // TODO: Balance of Batch would be better
    // TODO: Checkpoints for start time.
    if (_attire.helmet != NONE && _itemNFT.balanceOf(_from, _attire.helmet) > 0) {
      _updateCombatStats(stats, _itemNFT.getItem(_attire.helmet), _add);
    }
    if (_attire.amulet != NONE && _itemNFT.balanceOf(_from, _attire.amulet) > 0) {
      _updateCombatStats(stats, _itemNFT.getItem(_attire.amulet), _add);
    }
    if (_attire.armor != NONE && _itemNFT.balanceOf(_from, _attire.armor) > 0) {
      _updateCombatStats(stats, _itemNFT.getItem(_attire.armor), _add);
    }
    if (_attire.gauntlets != NONE && _itemNFT.balanceOf(_from, _attire.gauntlets) > 0) {
      _updateCombatStats(stats, _itemNFT.getItem(_attire.gauntlets), _add);
    }
    if (_attire.tassets != NONE && _itemNFT.balanceOf(_from, _attire.tassets) > 0) {
      _updateCombatStats(stats, _itemNFT.getItem(_attire.tassets), _add);
    }
    if (_attire.boots != NONE && _itemNFT.balanceOf(_from, _attire.boots) > 0) {
      _updateCombatStats(stats, _itemNFT.getItem(_attire.boots), _add);
    }
    // TODO: This isn't correct, should be hanlded in the calculations elsewhere with a better formula
    if (stats.attack <= 0) {
      stats.attack = 1;
    }
    if (stats.meleeDefence <= 0) {
      stats.meleeDefence = 1;
    }
    if (stats.magic <= 0) {
      stats.magic = 1;
    }
    if (stats.magicDefence <= 0) {
      stats.magicDefence = 1;
    }
    if (stats.range <= 0) {
      stats.range = 1;
    }
    if (stats.rangeDefence <= 0) {
      stats.rangeDefence = 1;
    }
    if (stats.health <= 0) {
      stats.health = 1;
    }
  }

  function _updateCombatStats(CombatStats memory _stats, Item memory _item, bool _add) private pure {
    if (_item.attack != 0) {
      _stats.attack += _add ? _item.attack : -_item.attack;
    }
    if (_item.magic != 0) {
      _stats.magic += _add ? _item.magic : -_item.magic;
    }
    if (_item.range != 0) {
      _stats.range += _add ? _item.range : -_item.range;
    }
    if (_item.meleeDefence != 0) {
      _stats.meleeDefence += _add ? _item.meleeDefence : -_item.meleeDefence;
    }
    if (_item.magicDefence != 0) {
      _stats.magicDefence += _add ? _item.magicDefence : -_item.magicDefence;
    }
    if (_item.rangeDefence != 0) {
      _stats.rangeDefence += _add ? _item.rangeDefence : -_item.rangeDefence;
    }
    if (_item.health != 0) {
      _stats.health += _add ? _item.health : -_item.health;
    }
  }

  function _addGuarenteedReward(
    uint[] memory _ids,
    uint[] memory _amounts,
    uint _elapsedTime,
    uint16 _rewardTokenId,
    uint24 _rewardRate,
    ActionRewards memory _actionRewards,
    uint oldLength
  ) private pure returns (uint length) {
    length = oldLength;
    uint numRewards = (_elapsedTime * _rewardRate) / (3600 * 100);
    if (numRewards > 0) {
      _ids[length] = _rewardTokenId;
      _amounts[length] = numRewards;
      ++length;
    }
  }

  function _addGuarenteedRewards(
    uint[] memory _ids,
    uint[] memory _amounts,
    uint _elapsedTime,
    ActionRewards memory _actionRewards
  ) private pure returns (uint length) {
    length = _addGuarenteedReward(
      _ids,
      _amounts,
      _elapsedTime,
      _actionRewards.guaranteedRewardTokenId1,
      _actionRewards.guaranteedRewardRate1,
      _actionRewards,
      length
    );
    length = _addGuarenteedReward(
      _ids,
      _amounts,
      _elapsedTime,
      _actionRewards.guaranteedRewardTokenId2,
      _actionRewards.guaranteedRewardRate3,
      _actionRewards,
      length
    );
    length = _addGuarenteedReward(
      _ids,
      _amounts,
      _elapsedTime,
      _actionRewards.guaranteedRewardTokenId3,
      _actionRewards.guaranteedRewardRate2,
      _actionRewards,
      length
    );
  }

  function _addRandomRewards(
    address _from,
    uint40 skillEndTime,
    uint elapsedTime,
    World world,
    uint[] memory _ids,
    uint[] memory _amounts,
    uint _oldLength,
    ActionRewards memory _actionRewards
  ) private view returns (uint length) {
    length = _oldLength;

    // Easier to make it an array, but TODO update later
    ActionReward[] memory _randomRewards = new ActionReward[](4);
    uint randomRewardLength;
    if (_actionRewards.randomRandomTokenId1 != 0) {
      _randomRewards[0] = ActionReward(_actionRewards.randomRandomTokenId1, _actionRewards.randomRewardChance1);
      ++randomRewardLength;
    }
    if (_actionRewards.randomRandomTokenId2 != 0) {
      _randomRewards[1] = ActionReward(_actionRewards.randomRandomTokenId2, _actionRewards.randomRewardChance2);
      ++randomRewardLength;
    }
    if (_actionRewards.randomRandomTokenId3 != 0) {
      _randomRewards[2] = ActionReward(_actionRewards.randomRandomTokenId3, _actionRewards.randomRewardChance3);
      ++randomRewardLength;
    }
    if (_actionRewards.randomReward4 != 0) {
      _randomRewards[3] = ActionReward(_actionRewards.randomReward4, _actionRewards.randomRewardChance4);
      ++randomRewardLength;
    }

    assembly ("memory-safe") {
      mstore(_randomRewards, randomRewardLength)
    }

    if (_randomRewards.length > 0) {
      bool hasSeed = world.hasSeed(skillEndTime);
      if (hasSeed) {
        uint seed = world.getSeed(skillEndTime);

        // Figure out how many chances they get (1 per hour spent)
        uint numTickets = elapsedTime / 3600;

        bytes32 randomComponent = bytes32(seed) ^ bytes20(_from);
        uint startLootLength = length;
        for (uint i; i < numTickets; ++i) {
          // Percentage out of 256
          uint8 rand = uint8(uint256(randomComponent >> (i * 8)));

          // Take each byte and check
          for (uint j; j < _randomRewards.length; ++j) {
            ActionReward memory potentialLoot = _randomRewards[j];
            if (rand < potentialLoot.rate) {
              // Get the lowest chance one

              // Compare with previous and append amounts if an entry already exists
              bool found;
              for (uint k = startLootLength; k < _ids.length; ++k) {
                if (potentialLoot.itemTokenId == _ids[k]) {
                  // exists
                  _amounts[k] += 1;
                  found = true;
                  break;
                }
              }

              if (!found) {
                // New item
                _ids[length] = potentialLoot.itemTokenId;
                _amounts[length] = 1;
                ++length;
              }
              break;
            }
          }
        }
      }
    }
  }

  function getRewards(
    address _from,
    uint40 _skillEndTime,
    uint _elapsedTime,
    World _world,
    ActionRewards memory _actionRewards
  ) public view returns (uint[] memory ids, uint[] memory amounts) {
    ids = new uint[](7);
    amounts = new uint[](7);

    uint length = _addGuarenteedRewards(ids, amounts, _elapsedTime, _actionRewards);
    length = _addRandomRewards(_from, _skillEndTime, _elapsedTime, _world, ids, amounts, length, _actionRewards);

    assembly ("memory-safe") {
      mstore(ids, length)
      mstore(amounts, length)
    }
  }

  function _processConsumable(
    address _from,
    uint _playerId,
    ItemNFT _itemNFT,
    uint16 _itemTokenId,
    uint16 _numProduced,
    uint16 _baseNum,
    uint64 _queueId
  ) private {
    if (_itemTokenId == 0) {
      return;
    }
    uint16 numBurn = _numProduced * _baseNum;
    // Balance should be checked beforehand
    emit Consume(_from, _playerId, _queueId, _itemTokenId, numBurn);
    _itemNFT.burn(_from, _itemTokenId, numBurn);
  }

  function processConsumablesView(
    address _from,
    uint _playerId,
    QueuedAction storage _queuedAction,
    uint _elapsedTime,
    World _world,
    ItemNFT _itemNFT,
    CombatStats memory _combatStats,
    ActionChoice memory _actionChoice
  )
    public
    view
    returns (
      Equipment[] memory consumedEquipment,
      ActionReward memory output,
      uint actualElapsedTime,
      uint xpElapsedTime,
      bool died
    )
  {
    // Fetch the requirements for it
    (bool isCombat, CombatStats memory enemyCombatStats) = _world.getCombatStats(_queuedAction.actionId);

    consumedEquipment = new Equipment[](4);
    uint consumedEquipmentLength;

    // Figure out how much food should be consumed.
    // This is based on the damage done from battling
    // TODO Should probably move this out?
    uint16 numConsumed;
    uint combatElapsedTime;
    if (isCombat) {
      (xpElapsedTime, combatElapsedTime, numConsumed) = getAdjustedElapsedTimes(
        _from,
        _itemNFT,
        _world,
        _elapsedTime,
        _actionChoice,
        _queuedAction,
        _combatStats,
        enemyCombatStats
      );

      uint16 foodConsumed;
      (foodConsumed, died) = _foodConsumedView(
        _from,
        _queuedAction,
        combatElapsedTime,
        _itemNFT,
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
      output = ActionReward(_actionChoice.outputTokenId, numConsumed);
    }

    assembly ("memory-safe") {
      mstore(consumedEquipment, consumedEquipmentLength)
    }
  }

  function _foodConsumedView(
    address _from,
    QueuedAction storage queuedAction,
    uint _combatElapsedTime, // uint _battleTime,
    ItemNFT _itemNFT,
    CombatStats memory _combatStats,
    CombatStats memory _enemyCombatStats
  ) private view returns (uint16 foodConsumed, bool died) {
    int32 totalHealthLost = int32(
      (_enemyCombatStats.attack * _enemyCombatStats.attack * int32(int(_combatElapsedTime))) /
        (_combatStats.meleeDefence * 60)
    ) - _combatStats.health;
    totalHealthLost += int32(
      (_enemyCombatStats.magic * _enemyCombatStats.magic * int32(int(_combatElapsedTime))) /
        (_combatStats.magicDefence * 60)
    );

    Item memory item = _itemNFT.getItem(queuedAction.regenerateId);

    if (item.healthRestored == 0 || totalHealthLost <= 0) {
      // No food attached or didn't lose any health
      died = totalHealthLost > 0;
    } else {
      foodConsumed = uint16(
        uint32(totalHealthLost) / item.healthRestored + (uint32(totalHealthLost) % item.healthRestored == 0 ? 0 : 1)
      );
      uint balance = _itemNFT.balanceOf(_from, queuedAction.regenerateId);

      died = foodConsumed > balance;
      if (died) {
        foodConsumed = uint16(balance);
      }
    }
  }

  function _processFoodConsumed(
    address _from,
    uint _playerId,
    QueuedAction storage _queuedAction,
    uint _combatElapsedTime,
    ItemNFT _itemNFT,
    CombatStats calldata _combatStats,
    CombatStats memory _enemyCombatStats
  ) private returns (bool died) {
    uint16 foodConsumed;
    // Figure out how much food should be used
    (foodConsumed, died) = _foodConsumedView(
      _from,
      _queuedAction,
      _combatElapsedTime,
      _itemNFT,
      _combatStats,
      _enemyCombatStats
    );

    _processConsumable(
      _from,
      _playerId,
      _itemNFT,
      _queuedAction.regenerateId,
      foodConsumed,
      1,
      _queuedAction.attire.queueId
    );
  }

  function _getMaxRequiredRatio(
    address _from,
    ActionChoice memory _actionChoice,
    uint16 _numConsumed,
    ItemNFT _itemNFT
  ) private view returns (uint maxRequiredRatio) {
    maxRequiredRatio = _numConsumed;
    if (_numConsumed > 0) {
      if (_actionChoice.inputTokenId1 != 0) {
        maxRequiredRatio = _getMaxRequiredRatioPartial(
          _from,
          _actionChoice.inputTokenId1,
          _actionChoice.num1,
          _numConsumed,
          maxRequiredRatio,
          _itemNFT
        );
      }
      if (_actionChoice.inputTokenId2 != 0) {
        maxRequiredRatio = _getMaxRequiredRatioPartial(
          _from,
          _actionChoice.inputTokenId2,
          _actionChoice.num2,
          _numConsumed,
          maxRequiredRatio,
          _itemNFT
        );
      }
      if (_actionChoice.inputTokenId3 != 0) {
        maxRequiredRatio = _getMaxRequiredRatioPartial(
          _from,
          _actionChoice.inputTokenId3,
          _actionChoice.num3,
          _numConsumed,
          maxRequiredRatio,
          _itemNFT
        );
      }
    }
  }

  function _getMaxRequiredRatioPartial(
    address _from,
    uint16 _inputTokenId,
    uint16 _num,
    uint16 _numConsumed,
    uint _maxRequiredRatio,
    ItemNFT _itemNFT
  ) private view returns (uint maxRequiredRatio) {
    uint balance = _itemNFT.balanceOf(_from, _inputTokenId);
    uint tempMaxRequiredRatio = _maxRequiredRatio;
    if (_numConsumed > balance / _num) {
      tempMaxRequiredRatio = balance / _num;
    }

    // Could be the first time
    if (tempMaxRequiredRatio < _maxRequiredRatio || _maxRequiredRatio == _numConsumed) {
      maxRequiredRatio = tempMaxRequiredRatio;
    }
  }

  function _processInputConsumables(
    address _from,
    uint _playerId,
    ActionChoice memory _actionChoice,
    uint16 _numConsumed,
    ItemNFT _itemNFT,
    uint64 _queueId
  ) private {
    _processConsumable(
      _from,
      _playerId,
      _itemNFT,
      _actionChoice.inputTokenId1,
      _numConsumed,
      _actionChoice.num1,
      _queueId
    );
    _processConsumable(
      _from,
      _playerId,
      _itemNFT,
      _actionChoice.inputTokenId2,
      _numConsumed,
      _actionChoice.num2,
      _queueId
    );
    _processConsumable(
      _from,
      _playerId,
      _itemNFT,
      _actionChoice.inputTokenId3,
      _numConsumed,
      _actionChoice.num3,
      _queueId
    );
  }

  function getAdjustedElapsedTimes(
    address _from,
    ItemNFT _itemNFT,
    World _world,
    uint _elapsedTime,
    ActionChoice memory _actionChoice,
    QueuedAction memory _queuedAction,
    CombatStats memory _combatStats,
    CombatStats memory _enemyCombatStats
  ) public view returns (uint xpElapsedTime, uint combatElapsedTime, uint16 numConsumed) {
    // Update these as necessary
    xpElapsedTime = _elapsedTime;
    combatElapsedTime = _elapsedTime;

    // Figure out how much food should be consumed.
    // This is based on the damage done from battling
    // TODO Should probably move this out?
    (bool isCombat, CombatStats memory enemyCombatStats) = _world.getCombatStats(_queuedAction.actionId);
    if (isCombat) {
      uint numSpawned = _world.getNumSpawn(_queuedAction.actionId); // Per hour
      uint maxHealthEnemy = numSpawned * uint16(enemyCombatStats.health);

      int32 totalHealthDealt;
      if (_actionChoice.skill == Skill.ATTACK) {
        totalHealthDealt =
          ((_combatStats.attack * _combatStats.attack * int32(int(_elapsedTime))) /
            _enemyCombatStats.meleeDefence +
            40) *
          60;
      } else if (_actionChoice.skill == Skill.MAGIC) {
        _combatStats.magic += int16(int32(_actionChoice.diff)); // Extra magic damage

        totalHealthDealt =
          ((_combatStats.magic * _combatStats.magic * int32(int(_elapsedTime))) / _enemyCombatStats.magicDefence) *
          60;
      } else if (_actionChoice.skill == Skill.RANGED) {
        // Add later
        //        totalHealthDealt = (_combatStats.range * _combatStats.range * int32(int(_elapsedTime))) /
        //        _enemyCombatStats.rangeDefence;
      }

      // Work out the ratio of health dealt to the max health they have
      if (uint32(totalHealthDealt) > maxHealthEnemy) {
        // We killed them all, but figure out how long it took
        combatElapsedTime = (_elapsedTime * uint32(totalHealthDealt)) / maxHealthEnemy; // Use this to work out how much food, arrows & spells to consume
        if (combatElapsedTime > _elapsedTime) {
          combatElapsedTime = _elapsedTime;
        }
      } else if (uint32(totalHealthDealt) < maxHealthEnemy) {
        // We didn't kill them all so they don't get the full rewards/xp
        // This correct?
        xpElapsedTime = (_elapsedTime * uint32(totalHealthDealt)) / maxHealthEnemy;
      }

      // Check the max that can be used
      numConsumed = uint16((combatElapsedTime * _actionChoice.rate) / (3600 * 100));
      if (numConsumed != 0) {
        // This checks the balances
        uint maxRequiredRatio = _getMaxRequiredRatio(_from, _actionChoice, numConsumed, _itemNFT);

        if (numConsumed > maxRequiredRatio) {
          numConsumed = uint16(maxRequiredRatio);

          // Work out what the actual elapsedTime should really be because they didn't have enough equipped to gain all the XP
          xpElapsedTime = (combatElapsedTime * maxRequiredRatio) / numConsumed;
        }
      }
    } else {
      // Non-combat, check the max that can be used
      numConsumed = uint16((_elapsedTime * _actionChoice.rate) / (3600 * 100));
      // This checks the balances
      uint maxRequiredRatio = _getMaxRequiredRatio(_from, _actionChoice, numConsumed, _itemNFT);
      if (numConsumed > maxRequiredRatio) {
        numConsumed = uint16(maxRequiredRatio);

        // Work out what the actual elapsedTime should really be because they didn't have enough equipped to gain all the XP
        xpElapsedTime = (combatElapsedTime * maxRequiredRatio) / numConsumed;
      }
    }
  }

  function processConsumables(
    address _from,
    uint _playerId,
    QueuedAction storage _queuedAction,
    uint _elapsedTime,
    World _world,
    ItemNFT _itemNFT,
    CombatStats calldata _combatStats,
    ActionChoice memory _actionChoice
  ) external returns (uint xpElapsedTime, uint combatElapsedTime, bool died) {
    // This is based on the damage done from battling
    (bool isCombat, CombatStats memory enemyCombatStats) = _world.getCombatStats(_queuedAction.actionId);
    uint16 numConsumed;
    (xpElapsedTime, combatElapsedTime, numConsumed) = getAdjustedElapsedTimes(
      _from,
      _itemNFT,
      _world,
      _elapsedTime,
      _actionChoice,
      _queuedAction,
      _combatStats,
      enemyCombatStats
    );
    if (isCombat) {
      (died) = _processFoodConsumed(
        _from,
        _playerId,
        _queuedAction,
        combatElapsedTime,
        _itemNFT,
        _combatStats,
        enemyCombatStats
      );
    }

    if (numConsumed > 0) {
      _processInputConsumables(_from, _playerId, _actionChoice, numConsumed, _itemNFT, _queuedAction.attire.queueId);
    }

    if (_actionChoice.outputTokenId != 0) {
      _itemNFT.mint(_from, _actionChoice.outputTokenId, numConsumed);
      emit Reward(_from, _playerId, _queuedAction.attire.queueId, _actionChoice.outputTokenId, numConsumed);
    }
  }

  function getElapsedTime(
    uint _skillEndTime,
    QueuedAction storage _queuedAction,
    uint _speedMultiplier
  ) public view returns (uint elapsedTime) {
    bool consumeAll = _skillEndTime <= block.timestamp;

    if (consumeAll) {
      // Fully consume this skill
      elapsedTime = _queuedAction.timespan;
    } else if (block.timestamp > _queuedAction.startTime) {
      // partially consume
      elapsedTime = block.timestamp - _queuedAction.startTime;
      uint modifiedElapsedTime = _speedMultiplier > 1 ? uint(elapsedTime) * _speedMultiplier : elapsedTime;
      // Up to timespan
      if (modifiedElapsedTime > _queuedAction.timespan) {
        elapsedTime = _queuedAction.timespan;
      }
    }
  }

  function _isCombat(Skill _skill) private pure returns (bool) {
    return _skill == Skill.ATTACK || _skill == Skill.DEFENCE || _skill == Skill.MAGIC || _skill == Skill.RANGED;
  }

  function extraXPFromBoost(
    bool _isCombatSkill,
    uint _actionStartTime,
    uint _elapsedTime,
    uint16 _xpPerHour,
    PlayerBoostInfo storage activeBoost
  ) public view returns (uint32 boostPointsAccrued) {
    if (activeBoost.itemTokenId != NONE && activeBoost.startTime < block.timestamp) {
      // A boost is active
      if (
        (_isCombatSkill && activeBoost.boostType == BoostType.COMBAT_XP) ||
        (!_isCombatSkill && activeBoost.boostType == BoostType.NON_COMBAT_XP)
      ) {
        uint boostedTime;
        // Correct skill for the boost
        if (_actionStartTime + _elapsedTime < activeBoost.startTime + activeBoost.duration) {
          // Consume it all
          boostedTime = _elapsedTime;
        } else {
          boostedTime = activeBoost.duration;
        }
        boostPointsAccrued = uint32((boostedTime * _xpPerHour * activeBoost.val) / (3600 * 100));
      }
    }
  }

  function pending(
    uint _playerId,
    QueuedAction[] storage actionQueue,
    Player storage player,
    ItemNFT _itemNFT,
    World _world,
    uint _speedMultiplier,
    PlayerBoostInfo storage activeBoost
  ) external view returns (PendingOutput memory pendingOutput) {
    pendingOutput.consumed = new Equipment[](actionQueue.length * MAX_LOOT_PER_ACTION + 1);
    pendingOutput.produced = new ActionReward[](actionQueue.length * MAX_LOOT_PER_ACTION * 2);

    uint consumedLength;
    uint producedLength;
    address from = msg.sender;
    uint previousSkillPoints = player.totalSkillPoints;
    uint32 allpointsAccrued;
    for (uint i; i < actionQueue.length; ++i) {
      QueuedAction storage queuedAction = actionQueue[i];

      CombatStats memory combatStats = player.totalStats;

      // This will only ones that they have a balance for at this time. This will check balances
      updateCombatStats(from, combatStats, queuedAction.attire, _itemNFT, true);

      uint32 pointsAccrued;
      uint skillEndTime = queuedAction.startTime +
        (_speedMultiplier > 1 ? uint(queuedAction.timespan) / _speedMultiplier : queuedAction.timespan);

      uint elapsedTime = getElapsedTime(skillEndTime, queuedAction, _speedMultiplier);
      if (elapsedTime == 0) {
        break;
      }

      // Create some items if necessary (smithing ores to bars for instance)
      bool died;

      ActionChoice memory actionChoice;
      bool isCombat = _isCombat(queuedAction.skill);
      uint xpElapsedTime = elapsedTime;
      if (queuedAction.choiceId != 0) {
        // || isCombat) {
        actionChoice = _world.getActionChoice(isCombat ? 0 : queuedAction.actionId, queuedAction.choiceId);

        Equipment[] memory consumedEquipment;
        ActionReward memory output;

        (consumedEquipment, output, elapsedTime, xpElapsedTime, died) = processConsumablesView(
          from,
          _playerId,
          queuedAction,
          elapsedTime,
          _world,
          _itemNFT,
          combatStats,
          actionChoice
        );

        if (output.itemTokenId != NONE) {
          pendingOutput.produced[producedLength] = output;
          ++producedLength;
        }

        for (uint i; i < consumedEquipment.length; ++i) {
          pendingOutput.consumed[consumedLength] = consumedEquipment[i];
          ++consumedLength;
        }

        if (died) {
          pendingOutput.died = true;
        }
      }

      if (!died) {
        bool _isCombatSkill = _isCombat(queuedAction.skill);
        uint16 xpPerHour = _world.getXPPerHour(queuedAction.actionId, _isCombatSkill ? NONE : queuedAction.choiceId);
        pointsAccrued = uint32((xpElapsedTime * xpPerHour) / 3600);
        pointsAccrued += extraXPFromBoost(
          _isCombatSkill,
          queuedAction.startTime,
          xpElapsedTime,
          xpPerHour,
          activeBoost
        );
      }

      if (pointsAccrued > 0) {
        //        _updateSkillPoints(_playerId, queuedAction.skill, pointsAccrued);

        ActionRewards memory actionRewards = _world.getActionRewards(queuedAction.actionId);
        (uint[] memory newIds, uint[] memory newAmounts) = getRewards(
          from,
          uint40(queuedAction.startTime + elapsedTime),
          xpElapsedTime,
          _world,
          actionRewards
        );

        for (uint i; i < newIds.length; ++i) {
          pendingOutput.produced[producedLength] = ActionReward(uint16(newIds[i]), uint24(newAmounts[i]));
          ++producedLength;
        }

        // This loot might be needed for a future task so mint now rather than later
        // But this could be improved
        allpointsAccrued += pointsAccrued;
      }
    } // end of loop

    if (allpointsAccrued > 0) {
      // Check if they have levelled up
      //      _handleLevelUpRewards(from, _playerId, previousSkillPoints, previousSkillPoints + allpointsAccrued);
    }

    // TODO Will also need guaranteedRewards, find a way to re-factor all this stuff so it can be re-used in the actual queue consumption

    assembly ("memory-safe") {
      mstore(mload(pendingOutput), consumedLength)
      mstore(mload(add(pendingOutput, 32)), producedLength)
    }
  }

  function consumeBoost(
    uint16 _itemTokenId,
    ItemNFT itemNFT,
    uint40 _startTime,
    PlayerBoostInfo storage playerBoost
  ) external {
    Item memory item = itemNFT.getItem(_itemTokenId);
    require(item.boostType != BoostType.NONE); // , "Not a boost vial");
    require(_startTime < block.timestamp + 7 days); // , "Start time too far in the future");
    if (_startTime < block.timestamp) {
      _startTime = uint40(block.timestamp);
    }

    // Burn it
    address from = msg.sender;
    itemNFT.burn(from, _itemTokenId, 1);

    // If there's an active potion which hasn't been consumed yet, then we can mint it back
    if (playerBoost.itemTokenId != NONE) {
      itemNFT.mint(from, playerBoost.itemTokenId, 1);
    }

    playerBoost.startTime = _startTime;
    playerBoost.duration = item.boostDuration;
    playerBoost.val = item.boostValue;
    playerBoost.boostType = item.boostType;
    playerBoost.itemTokenId = _itemTokenId;
  }
}
