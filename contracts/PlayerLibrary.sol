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
  event ActionUnequip(uint playerId, uint queueId, uint16 itemTokenId, uint amount);

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

  function updatePlayerStats(CombatStats memory _totalStats, Item memory _item, bool _add) external pure {
    if (_item.attack != 0) {
      _totalStats.attack += _add ? _item.attack : -_item.attack;
    }
    if (_item.magic != 0) {
      _totalStats.magic += _add ? _item.magic : -_item.magic;
    }
    if (_item.range != 0) {
      _totalStats.range += _add ? _item.range : -_item.range;
    }
    if (_item.meleeDefence != 0) {
      _totalStats.meleeDefence += _add ? _item.meleeDefence : -_item.meleeDefence;
    }
    if (_item.magicDefence != 0) {
      _totalStats.magicDefence += _add ? _item.magicDefence : -_item.magicDefence;
    }
    if (_item.rangeDefence != 0) {
      _totalStats.rangeDefence += _add ? _item.rangeDefence : -_item.rangeDefence;
    }
    if (_item.health != 0) {
      _totalStats.health += _add ? _item.health : -_item.health;
    }
  }

  function _addGuarenteedRewards(
    uint[] memory _ids,
    uint[] memory _amounts,
    uint _elapsedTime,
    ActionReward[] memory _guaranteedRewards
  ) private pure returns (uint lootLength) {
    for (uint i; i < _guaranteedRewards.length; ++i) {
      uint numRewards = (_elapsedTime * _guaranteedRewards[i].rate) / (3600 * 100);
      if (numRewards > 0) {
        _ids[lootLength] = _guaranteedRewards[i].itemTokenId;
        _amounts[lootLength] = numRewards;
        ++lootLength;
      }
    }
  }

  function _addRandomRewards(
    address _from,
    uint40 skillEndTime,
    uint elapsedTime,
    World world,
    uint[] memory _ids,
    uint[] memory _amounts,
    uint _lootLength,
    ActionReward[] memory _randomRewards
  ) private view returns (uint lootLength) {
    lootLength = _lootLength;
    // Random chance loot
    if (_randomRewards.length > 0) {
      bool hasSeed = world.hasSeed(skillEndTime);
      if (hasSeed) {
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

  function getRewards(
    address _from,
    uint40 _skillEndTime,
    uint _elapsedTime,
    World _world,
    ActionReward[] memory _guaranteedRewards,
    ActionReward[] memory _randomRewards
  ) external view returns (uint[] memory ids, uint[] memory amounts) {
    ids = new uint[](_guaranteedRewards.length + _randomRewards.length);
    amounts = new uint[](_guaranteedRewards.length + _randomRewards.length);

    uint lootLength = _addGuarenteedRewards(ids, amounts, _elapsedTime, _guaranteedRewards);
    lootLength = _addRandomRewards(
      _from,
      _skillEndTime,
      _elapsedTime,
      _world,
      ids,
      amounts,
      lootLength,
      _randomRewards
    );

    assembly ("memory-safe") {
      mstore(ids, lootLength)
      mstore(amounts, lootLength)
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
    uint16 numUnequip = numBurn;

    // TODO: Check balance

    emit ActionUnequip(_playerId, _queueId, _itemTokenId, numUnequip);
    _itemNFT.burn(_from, _itemTokenId, numBurn);
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

    numProduced = uint16((elapsedTime * actionChoice.rate) / (3600 * 100));

    if (isCombat) {
      /* combatStats.attack, */
      /* playerStats.meleeDefence */
      foodConsumed = uint16(elapsedTime / 3600) + (elapsedTime % 3600 == 0 ? 0 : 1);
      //      died = foodConsumed > itemNFT.balanceOf(queuedAction.regenerateId);
    }
  }

  function _processCombatConsumables(
    address _from,
    uint _playerId,
    QueuedAction storage queuedAction,
    uint _elapsedTime,
    ItemNFT _itemNFT,
    CombatStats storage _playerStats
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

    died = foodConsumed > balance;
    if (died) {
      foodConsumed = uint16(balance);
    }

    // Figure out how much food should be used
    _processConsumable(
      _from,
      _playerId,
      _itemNFT,
      queuedAction.regenerateId,
      foodConsumed,
      1,
      queuedAction.attire.queueId
    );
    // TODO use playerStats.health
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

  function processConsumables(
    address _from,
    uint _playerId,
    QueuedAction storage _queuedAction,
    uint _elapsedTime,
    World _world,
    ItemNFT _itemNFT,
    CombatStats storage _playerStats,
    ActionChoice memory actionChoice
  ) external returns (uint16 foodConsumed, uint16 numConsumed, uint actualElapsedTime, bool died) {
    // Fetch the requirements for it
    (bool isCombat, CombatStats memory combatStats) = _world.getCombatStats(_queuedAction.actionId);

    actualElapsedTime = _elapsedTime; // Can be updated

    // Figure out how much food should be consumed.
    // This is based on the damage done from battling
    // TODO Should probably move this out?
    if (isCombat) {
      (foodConsumed, died) = _processCombatConsumables(
        _from,
        _playerId,
        _queuedAction,
        _elapsedTime,
        _itemNFT,
        _playerStats
      );
    }

    // Check the max that can be used. To prevent overflow for sped up actions.
    numConsumed = uint16((_elapsedTime * actionChoice.rate) / (3600 * 100));
    // This checks the balances
    uint maxRequiredRatio = _getMaxRequiredRatio(_from, actionChoice, numConsumed, _itemNFT);

    if (numConsumed > maxRequiredRatio) {
      numConsumed = uint16(maxRequiredRatio);
    }

    // TODO: This will affect how much combat can be done
    if (numConsumed > 0) {
      _processInputConsumables(_from, _playerId, actionChoice, numConsumed, _itemNFT, _queuedAction.attire.queueId);
    }

    if (actionChoice.outputTokenId != 0) {
      _itemNFT.mint(_from, actionChoice.outputTokenId, numConsumed);
    }
  }
}
