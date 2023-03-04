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
  event Reward(address _from, uint playerId, uint128 queueId, uint16 itemTokenId, uint amount);
  event Consume(address _from, uint playerId, uint128 queueId, uint16 itemTokenId, uint amount);

  error NoItemBalance(uint16 itemTokenId);

  function uri(
    bytes32 name,
    mapping(Skill => uint32) storage skillPoints,
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
        '"}, {"trait_type":"Magic","value":"',
        skillPoints[Skill.MAGIC],
        '"}, {"trait_type":"Defence","value":"',
        skillPoints[Skill.DEFENCE],
        '"}, {"trait_type":"Health","value":"',
        skillPoints[Skill.HEALTH],
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
    ItemNFT _itemNFT
  ) public view returns (CombatStats memory stats) {
    stats = _stats;
    uint attireLength;
    uint16[] memory itemTokenIds = new uint16[](6);
    if (_attire.helmet != NONE) {
      itemTokenIds[attireLength] = _attire.helmet;
      ++attireLength;
    }
    if (_attire.amulet != NONE) {
      itemTokenIds[attireLength] = _attire.amulet;
      ++attireLength;
    }
    if (_attire.armor != NONE) {
      itemTokenIds[attireLength] = _attire.armor;
      ++attireLength;
    }
    if (_attire.gauntlets != NONE) {
      itemTokenIds[attireLength] = _attire.gauntlets;
      ++attireLength;
    }
    if (_attire.tassets != NONE) {
      itemTokenIds[attireLength] = _attire.tassets;
      ++attireLength;
    }
    if (_attire.boots != NONE) {
      itemTokenIds[attireLength] = _attire.boots;
      ++attireLength;
    }

    assembly ("memory-safe") {
      mstore(itemTokenIds, attireLength)
    }

    if (attireLength > 0) {
      Item[] memory items = _itemNFT.getItems(itemTokenIds);
      uint[] memory balances = _itemNFT.balanceOfs(_from, itemTokenIds);
      for (uint i; i < items.length; ++i) {
        if (balances[i] > 0) {
          _updateCombatStats(stats, items[i]);
        }
      }
    }

    // TODO: This isn't correct, should be handled in the calculations elsewhere with a better formula
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

  function _updateCombatStats(CombatStats memory _stats, Item memory _item) private pure {
    if (_item.attack != 0) {
      _stats.attack += _item.attack;
    }
    if (_item.magic != 0) {
      _stats.magic += _item.magic;
    }
    if (_item.range != 0) {
      _stats.range += _item.range;
    }
    if (_item.meleeDefence != 0) {
      _stats.meleeDefence += _item.meleeDefence;
    }
    if (_item.magicDefence != 0) {
      _stats.magicDefence += _item.magicDefence;
    }
    if (_item.rangeDefence != 0) {
      _stats.rangeDefence += _item.rangeDefence;
    }
    if (_item.health != 0) {
      _stats.health += _item.health;
    }
  }

  function _processConsumable(
    address _from,
    uint _playerId,
    ItemNFT _itemNFT,
    uint16 _itemTokenId,
    uint16 _numConsumed,
    uint128 _queueId
  ) private {
    if (_itemTokenId == 0) {
      return;
    }
    // Balance should be checked beforehand
    emit Consume(_from, _playerId, _queueId, _itemTokenId, _numConsumed);
    _itemNFT.burn(_from, _itemTokenId, _numConsumed);
  }

  function foodConsumedView(
    address _from,
    QueuedAction storage queuedAction,
    uint _combatElapsedTime, // uint _battleTime,
    ItemNFT _itemNFT,
    CombatStats memory _combatStats,
    CombatStats memory _enemyCombatStats
  ) public view returns (uint16 foodConsumed, bool died) {
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
    (foodConsumed, died) = foodConsumedView(
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
    uint128 _queueId
  ) private {
    _processConsumable(
      _from,
      _playerId,
      _itemNFT,
      _actionChoice.inputTokenId1,
      _numConsumed * _actionChoice.num1,
      _queueId
    );
    _processConsumable(
      _from,
      _playerId,
      _itemNFT,
      _actionChoice.inputTokenId2,
      _numConsumed * _actionChoice.num2,
      _queueId
    );
    _processConsumable(
      _from,
      _playerId,
      _itemNFT,
      _actionChoice.inputTokenId3,
      _numConsumed * _actionChoice.num3,
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

  function _isCombat(CombatStyle _combatStyle) private pure returns (bool) {
    return _combatStyle != CombatStyle.NONE;
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

  function checkAttire(address _from, Attire memory _attire, ItemNFT _itemNFT) external view {
    // Check the user has these items
    //    uint raw = _getEquipmentRawVal(_attire);
    //    if (raw > 0) {
    if (_attire.helmet != NONE && _itemNFT.balanceOf(_from, _attire.helmet) == 0) {
      revert NoItemBalance(_attire.helmet);
    }
    if (_attire.amulet != NONE && _itemNFT.balanceOf(_from, _attire.amulet) == 0) {
      revert NoItemBalance(_attire.amulet);
    }
    if (_attire.armor != NONE && _itemNFT.balanceOf(_from, _attire.armor) == 0) {
      revert NoItemBalance(_attire.armor);
    }
    if (_attire.gauntlets != NONE && _itemNFT.balanceOf(_from, _attire.gauntlets) == 0) {
      revert NoItemBalance(_attire.gauntlets);
    }
    if (_attire.tassets != NONE && _itemNFT.balanceOf(_from, _attire.tassets) == 0) {
      revert NoItemBalance(_attire.tassets);
    }
    if (_attire.boots != NONE && _itemNFT.balanceOf(_from, _attire.boots) == 0) {
      revert NoItemBalance(_attire.boots);
    }
    //    }
  }

  function checkActionConsumables(
    address _from,
    QueuedAction memory _queuedAction,
    ItemNFT _itemNFT,
    World _world
  ) external view {
    // Check they have this to equip. Indexer can check actionChoices
    if (_queuedAction.regenerateId != NONE && _itemNFT.balanceOf(_from, _queuedAction.regenerateId) == 0) {
      revert NoItemBalance(_queuedAction.regenerateId);
    }

    if (_queuedAction.choiceId != NONE) {
      // Get all items for this
      ActionChoice memory actionChoice = _world.getActionChoice(
        _isCombat(_queuedAction.combatStyle) ? NONE : _queuedAction.actionId,
        _queuedAction.choiceId
      );

      // TODO: Can be balance of batch
      if (actionChoice.inputTokenId1 != NONE && _itemNFT.balanceOf(_from, actionChoice.inputTokenId1) == 0) {
        revert NoItemBalance(actionChoice.inputTokenId1);
      }
      if (actionChoice.inputTokenId2 != NONE && _itemNFT.balanceOf(_from, actionChoice.inputTokenId2) == 0) {
        revert NoItemBalance(actionChoice.inputTokenId2);
      }
      if (actionChoice.inputTokenId3 != NONE && _itemNFT.balanceOf(_from, actionChoice.inputTokenId3) == 0) {
        revert NoItemBalance(actionChoice.inputTokenId3);
      }
    }
    //     if (_queuedAction.choiceId1 != NONE) {
    //     if (_queuedAction.choiceId2 != NONE) {
  }

  function average(uint256 a, uint256 b) private pure returns (uint256) {
    // (a + b) / 2 can overflow.
    return (a & b) + (a ^ b) / 2;
  }

  function getXP(uint256 _index) private pure returns (uint24) {
    uint256 index = _index * 3;
    return uint24(arr[index] | (bytes3(arr[index + 1]) >> 8) | (bytes3(arr[index + 2]) >> 16));
  }

  function getSkillFromStyle(
    CombatStyle _combatStyle,
    uint16 _actionId,
    World _world
  ) external view returns (Skill skill) {
    if (_combatStyle == CombatStyle.ATTACK) {
      skill = Skill.ATTACK;
    } else if (_combatStyle == CombatStyle.MAGIC) {
      skill = Skill.MAGIC;
    }
    /* else if (_combatStyle == Skill.RANGED) {
            skill = Skill.RANGED;
          } */
    else if (
      _combatStyle == CombatStyle.MELEE_DEFENCE ||
      _combatStyle == CombatStyle.RANGED_DEFENCE ||
      _combatStyle == CombatStyle.MAGIC_DEFENCE
    ) {
      skill = Skill.DEFENCE;
    } else {
      // Not a combat style, get the skill from the action
      skill = _world.getSkill(_actionId);
    }
  }

  function cacheCombatStats(
    Player storage _player,
    uint32 _healthSkillPoints,
    Skill _skill,
    uint32 _skillPoints
  ) external {
    {
      int16 level = int16(findLevel(_healthSkillPoints));
      _player.combatStats.health = level;
    }

    int16 level = int16(findLevel(_skillPoints));
    if (_skill == Skill.ATTACK) {
      _player.combatStats.attack = level;
    } else if (_skill == Skill.MAGIC) {
      _player.combatStats.magic = level;
    }
    /* else if (_skill == Skill.RANGED) {
            _player.combatStats.attack = level;
          } */
    else if (_skill == Skill.DEFENCE) {
      _player.combatStats.defence = level;
    }
  }

  // Index not level, add one after (check for > max)
  function findLevel(uint256 xp) private pure returns (uint16) {
    uint256 low = 0;
    uint256 high = 100;

    while (low < high) {
      uint256 mid = average(low, high);

      // Note that mid will always be strictly less than high (i.e. it will be a valid array index)
      // Math.average rounds down (it does integer division with truncation).
      if (getXP(mid) > xp) {
        high = mid;
      } else {
        low = mid + 1;
      }
    }

    if (low > 0) {
      return uint16(low);
    } else {
      return 1;
    }
  }
}
