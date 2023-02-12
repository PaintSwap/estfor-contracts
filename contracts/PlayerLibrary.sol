// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/utils/Base64.sol";
import "./types.sol";
import "./World.sol";
import "./ItemNFT.sol";
import "./Users.sol";

// Show all the player stats, return metadata json
library PlayerLibrary {
  // Same as in Player
  event Unequip(uint tokenId, uint16 itemTokenId, uint amount);

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

  function updatePlayerStats(CombatStats storage _totalStats, CombatStats memory _stats, bool _add) external {
    if (_stats.attack != 0) {
      _totalStats.attack += _add ? _stats.attack : -_stats.attack;
    }
    if (_stats.magic != 0) {
      _totalStats.magic += _add ? _stats.magic : -_stats.magic;
    }
    if (_stats.range != 0) {
      _totalStats.range += _add ? _stats.range : -_stats.range;
    }
    if (_stats.meleeDefence != 0) {
      _totalStats.meleeDefence += _add ? _stats.meleeDefence : -_stats.meleeDefence;
    }
    if (_stats.magicDefence != 0) {
      _totalStats.magicDefence += _add ? _stats.magicDefence : -_stats.magicDefence;
    }
    if (_stats.rangeDefence != 0) {
      _totalStats.rangeDefence += _add ? _stats.rangeDefence : -_stats.rangeDefence;
    }
    if (_stats.health != 0) {
      _totalStats.health += _add ? _stats.health : -_stats.health;
    }
  }

  function _addGuarenteedRewards(
    uint[] memory _ids,
    uint[] memory _amounts,
    uint _elapsedTime,
    ActionReward[] memory _guaranteedRewards
  ) private pure returns (uint lootLength) {
    for (uint i; i < _guaranteedRewards.length; ++i) {
      uint numRewards = (_elapsedTime * _guaranteedRewards[i].rate) / 3600;
      if (numRewards > 0) {
        _ids[lootLength] = _guaranteedRewards[i].itemTokenId;
        _amounts[lootLength] = numRewards;
        ++lootLength;
      }
    }
  }

  function _addRandomRewards(
    address _from,
    uint actionId,
    uint40 skillEndTime,
    uint elapsedTime,
    World world,
    PendingLoot[] storage pendingLoot,
    uint[] memory _ids,
    uint[] memory _amounts,
    uint _lootLength,
    ActionReward[] memory _randomRewards
  ) private returns (uint lootLength) {
    lootLength = _lootLength;
    // Random chance loot
    if (_randomRewards.length > 0) {
      bool hasSeed = world.hasSeed(skillEndTime);
      if (!hasSeed) {
        // There's no seed for this yet, so add it to the loot queue. (TODO: They can force add it later)
        // TODO: Some won't have loot (add it to action?)
        pendingLoot.push(PendingLoot({actionId: actionId, timestamp: skillEndTime, elapsedTime: uint16(elapsedTime)}));
      } else {
        uint seed = world.getSeed(skillEndTime);

        // Figure out how many chances they get (1 per hour spent)
        uint numTickets = elapsedTime / 3600;

        bytes32 randomComponent = bytes32(seed) ^ bytes20(_from);
        uint startLootLength = lootLength;
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
                _ids[lootLength] = potentialLoot.itemTokenId;
                _amounts[lootLength] = 1;
                ++lootLength;
              }
              break;
            }
          }
        }
      }
    }
  }

  function getLootAndAddPending(
    address _from,
    uint _actionId,
    uint40 _skillEndTime,
    uint _elapsedTime,
    World _world,
    PendingLoot[] storage _pendingLoot
  ) external returns (uint[] memory ids, uint[] memory amounts) {
    (ActionReward[] memory guaranteedRewards, ActionReward[] memory randomRewards) = _world.getDropAndLoot(_actionId);

    ids = new uint[](guaranteedRewards.length + randomRewards.length);
    amounts = new uint[](guaranteedRewards.length + randomRewards.length);

    uint lootLength = _addGuarenteedRewards(ids, amounts, _elapsedTime, guaranteedRewards);
    lootLength = _addRandomRewards(
      _from,
      _actionId,
      _skillEndTime,
      _elapsedTime,
      _world,
      _pendingLoot,
      ids,
      amounts,
      lootLength,
      randomRewards
    );

    assembly ("memory-safe") {
      mstore(ids, lootLength)
      mstore(amounts, lootLength)
    }
  }

  function _processConsumable(
    address _from,
    uint _tokenId,
    ItemNFT itemNFT,
    uint16 itemTokenId,
    uint16 numProduced,
    uint16 baseNum,
    uint16 totalEquipped,
    Users users,
    bool _useAll
  ) private {
    if (itemTokenId == 0) {
      return;
    }
    uint16 numBurn = numProduced * baseNum;
    uint16 numUnequip = _useAll ? totalEquipped : numBurn;
    users.minorUnequip(_from, itemTokenId, numUnequip); // Should be the num attached if fully consumed
    emit Unequip(_tokenId, itemTokenId, numUnequip);
    itemNFT.burn(_from, itemTokenId, numBurn);
  }

  function processConsumablesView(
    QueuedAction storage queuedAction,
    uint elapsedTime,
    World world
  ) external view returns (uint16 numProduced, uint16 foodConsumed, bool died) {
    // Fetch the requirements for it
    (bool isCombat, CombatStats memory combatStats) = world.getCombatStats(queuedAction.actionId);

    ActionChoice memory actionChoice = world.getActionChoice(
      isCombat ? 0 : queuedAction.actionId,
      queuedAction.choiceId
    );

    numProduced = uint16((elapsedTime * actionChoice.rate) / 3600);

    if (isCombat) {
      /* combatStats.attack, */
      /* playerStats.meleeDefence */
      foodConsumed = uint16(elapsedTime / 3600) + (elapsedTime % 3600 == 0 ? 0 : 1);
      died = foodConsumed > queuedAction.numRegenerate;
    }
  }

  function _processCombatConsumables(
    address _from,
    uint _tokenId,
    QueuedAction storage queuedAction,
    uint _elapsedTime,
    ItemNFT _itemNFT,
    Users _users,
    CombatStats storage _playerStats,
    bool _useAll
  ) private returns (uint16 foodConsumed, bool died) {
    /* combatStats.attack, */
    /* playerStats.meleeDefence */
    uint _foodConsumed = _elapsedTime / 3600 + (_elapsedTime % 3600 == 0 ? 0 : 1); // TODO: Should be based on damage done
    if (_foodConsumed > 9999) {
      foodConsumed = 9999;
    } else {
      foodConsumed = uint16(_foodConsumed);
    }
    uint balance = _itemNFT.balanceOf(_from, queuedAction.regenerateId);
    uint16 maxFood = foodConsumed > balance ? uint16(balance) : queuedAction.numRegenerate;

    died = foodConsumed > maxFood;
    if (died) {
      foodConsumed = maxFood;
    }

    // Figure out how much food should be used
    _processConsumable(
      _from,
      _tokenId,
      _itemNFT,
      queuedAction.regenerateId,
      foodConsumed,
      1,
      queuedAction.numRegenerate,
      _users,
      _useAll
    );
    // TODO use playerStats.health
  }

  function _getMaxRequiredRatio(
    address _from,
    ActionChoice memory _actionChoice,
    uint16 _numConsumed,
    uint _numEquippedBase,
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
          _numEquippedBase,
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
          _numEquippedBase,
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
          _numEquippedBase,
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
    uint _numEquippedBase,
    uint _maxRequiredRatio,
    ItemNFT _itemNFT
  ) private view returns (uint maxRequiredRatio) {
    uint balance = _itemNFT.balanceOf(_from, _inputTokenId);
    uint tempMaxRequiredRatio = _maxRequiredRatio;
    if (_numConsumed > balance / _num) {
      tempMaxRequiredRatio = balance / _num;
    }
    if (tempMaxRequiredRatio > _numEquippedBase) {
      tempMaxRequiredRatio = _numEquippedBase;
    }

    // Could be the first time
    if (tempMaxRequiredRatio < _maxRequiredRatio || _maxRequiredRatio == _numConsumed) {
      maxRequiredRatio = tempMaxRequiredRatio;
    }
  }

  function _processInputConsumables(
    address _from,
    uint _tokenId,
    ActionChoice memory _actionChoice,
    uint16 _numConsumed,
    uint16 _numEquippedBase,
    ItemNFT _itemNFT,
    Users _users,
    bool _useAll
  ) private {
    _processConsumable(
      _from,
      _tokenId,
      _itemNFT,
      _actionChoice.inputTokenId1,
      _numConsumed,
      _actionChoice.num1,
      _numEquippedBase * _actionChoice.num1,
      _users,
      _useAll
    );
    _processConsumable(
      _from,
      _tokenId,
      _itemNFT,
      _actionChoice.inputTokenId2,
      _numConsumed,
      _actionChoice.num2,
      _numEquippedBase * _actionChoice.num2,
      _users,
      _useAll
    );
    _processConsumable(
      _from,
      _tokenId,
      _itemNFT,
      _actionChoice.inputTokenId3,
      _numConsumed,
      _actionChoice.num3,
      _numEquippedBase * _actionChoice.num3,
      _users,
      _useAll
    );
  }

  function processConsumables(
    address _from,
    uint _tokenId,
    QueuedAction storage _queuedAction,
    uint _elapsedTime,
    World _world,
    ItemNFT _itemNFT,
    Users _users,
    CombatStats storage _playerStats,
    bool _useAll
  ) external returns (uint16 foodConsumed, uint16 numConsumed, uint actualElapsedTime, bool died) {
    // Fetch the requirements for it
    (bool isCombat, CombatStats memory combatStats) = _world.getCombatStats(_queuedAction.actionId);

    actualElapsedTime = _elapsedTime; // Can be updated

    ActionChoice memory actionChoice = _world.getActionChoice(
      isCombat ? 0 : _queuedAction.actionId,
      _queuedAction.choiceId
    );

    // Figure out how much food should be consumed.
    // This is based on the damage done from battling
    // TODO Should probably move this out?
    if (isCombat) {
      (foodConsumed, died) = _processCombatConsumables(
        _from,
        _tokenId,
        _queuedAction,
        _elapsedTime,
        _itemNFT,
        _users,
        _playerStats,
        _useAll
      );
    }

    // Check the max that can be used. To prevent overflow for sped up actions.
    numConsumed = uint16((_elapsedTime * actionChoice.rate) / 3600);
    uint maxRequiredRatio = _getMaxRequiredRatio(_from, actionChoice, numConsumed, _queuedAction.num, _itemNFT);

    // Check the balances of all the items
    if (numConsumed > maxRequiredRatio) {
      numConsumed = uint16(maxRequiredRatio);
    }
    if (numConsumed > 0) {
      _processInputConsumables(
        _from,
        _tokenId,
        actionChoice,
        numConsumed,
        _queuedAction.num,
        _itemNFT,
        _users,
        _useAll
      );
    }

    if (_useAll && _queuedAction.potionId != 0) {
      // Consume the potion
      _users.minorUnequip(_from, _queuedAction.potionId, 1);
      emit Unequip(_tokenId, _queuedAction.potionId, 1);
      _itemNFT.burn(_from, _queuedAction.potionId, 1);
    }

    if (actionChoice.outputTokenId != 0) {
      _itemNFT.mint(_from, actionChoice.outputTokenId, numConsumed);
    }
  }
}
