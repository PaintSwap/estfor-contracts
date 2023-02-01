// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/utils/Base64.sol";
import "./enums.sol";
import "./World.sol";
import "./ItemNFT.sol";
import "./Users.sol";

// Show all the player stats, return metadata json
library PlayerNFTLibrary {
  // Same as in PlayerNFT
  event Unequip(uint tokenId, uint16 itemTokenId, uint amount);

  function uri(
    bytes32 name,
    mapping(Skill => uint32) storage skillPoints,
    CombatStats calldata totalStats,
    bytes32 avatarName,
    string calldata avatarDescription,
    bytes calldata imageURI
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

  function getInitialStartingItems() external pure returns (uint[] memory itemNFTs, uint[] memory quantities) {
    itemNFTs = new uint[](5);
    itemNFTs[0] = BRONZE_SWORD;
    itemNFTs[1] = BRONZE_AXE;
    itemNFTs[2] = FIRE_LIGHTER;
    itemNFTs[3] = SMALL_NET;
    itemNFTs[4] = BRONZE_PICKAXE;

    quantities = new uint[](5);
    quantities[0] = 1;
    quantities[1] = 1;
    quantities[2] = 1;
    quantities[3] = 1;
    quantities[4] = 1;
  }

  function getLoot(
    address _from,
    uint actionId,
    uint40 skillEndTime,
    uint16 elapsedTime,
    World world,
    PendingLoot[] storage pendingLoot
  ) external returns (uint[] memory ids, uint[] memory amounts) {
    (ActionReward[] memory dropRewards, ActionLoot[] memory lootChances) = world.getDropAndLoot(actionId);

    ids = new uint[](dropRewards.length + lootChances.length);
    amounts = new uint[](dropRewards.length + lootChances.length);
    uint lootLength;

    // Guarenteed drops
    for (uint i; i < dropRewards.length; ++i) {
      uint num = (uint(elapsedTime) * dropRewards[i].rate) / (3600 * 100);
      if (num > 0) {
        ids[lootLength] = dropRewards[i].itemTokenId;
        amounts[lootLength] = num;
        ++lootLength;
      }
    }

    // Random chance loot
    if (lootChances.length > 0) {
      bool hasSeed = world.hasSeed(skillEndTime);
      if (!hasSeed) {
        // There's no seed for this yet, so add it to the loot queue. (TODO: They can force add it later)
        // TODO: Some won't have loot (add it to action?)
        pendingLoot.push(PendingLoot({actionId: actionId, timestamp: skillEndTime, elapsedTime: elapsedTime}));
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
          for (uint j; j < lootChances.length; ++j) {
            ActionLoot memory potentialLoot = lootChances[j];
            if (rand < potentialLoot.chance) {
              // Get the lowest chance one

              // Compare with previous and append amounts if an entry already exists
              bool found;
              for (uint k = startLootLength; k < ids.length; ++k) {
                if (potentialLoot.itemTokenId == ids[k]) {
                  // exists
                  amounts[k] += 1;
                  found = true;
                  break;
                }
              }

              if (!found) {
                // New item
                ids[lootLength] = potentialLoot.itemTokenId;
                amounts[lootLength] = 1;
                ++lootLength;
              }
              break;
            }
          }
        }
      }
    }

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
    uint8 baseNum,
    uint8 totalEquipped,
    Users users,
    bool _useAll
  ) private {
    if (itemTokenId == NONE) {
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
    uint16 elapsedTime,
    World world
  ) external view returns (uint16 numProduced, uint16 foodConsumed, bool died) {
    // Fetch the requirements for it
    (bool isCombat, CombatStats memory combatStats) = world.getCombatStats(queuedAction.actionId);

    ActionChoice memory actionChoice = world.getActionChoice(
      isCombat ? NONE : queuedAction.actionId,
      queuedAction.choiceId
    );

    numProduced = uint16((uint(elapsedTime) * actionChoice.rate) / (3600 * 100));

    if (isCombat) {
      /* combatStats.attack, */
      /* playerStats.meleeDefence */
      foodConsumed = uint16((uint(elapsedTime) * 100) / (3600 * 100));
      died = foodConsumed > queuedAction.numRegenerate;
    }
  }

  function processConsumables(
    address _from,
    uint _tokenId,
    QueuedAction storage queuedAction,
    uint16 elapsedTime,
    World world,
    ItemNFT itemNFT,
    Users users,
    CombatStats storage playerStats,
    bool _useAll
  ) external returns (uint16 foodConsumed, uint16 numConsumed, bool died) {
    // Fetch the requirements for it
    (bool isCombat, CombatStats memory combatStats) = world.getCombatStats(queuedAction.actionId);

    ActionChoice memory actionChoice = world.getActionChoice(
      isCombat ? NONE : queuedAction.actionId,
      queuedAction.choiceId
    );

    // Figure out how much food should be consumed.
    // This is based on the damage done from battling
    // TODO Should probably move this out?
    if (isCombat) {
      /* combatStats.attack, */
      /* playerStats.meleeDefence */
      foodConsumed = uint16((uint(elapsedTime) * 100) / (3600 * 100));

      died = foodConsumed > queuedAction.numRegenerate;

      // Figure out how much food should be used
      _processConsumable(
        _from,
        _tokenId,
        itemNFT,
        queuedAction.regenerateId,
        !died ? foodConsumed : queuedAction.numRegenerate,
        1,
        queuedAction.numRegenerate,
        users,
        _useAll
      );
      // TODO use playerStats.health
    }

    uint16 numProduced = uint16((uint(elapsedTime) * actionChoice.rate) / (3600 * 100));
    numConsumed = numProduced;
    if (numConsumed > 0) {
      _processConsumable(
        _from,
        _tokenId,
        itemNFT,
        actionChoice.inputTokenId1,
        numProduced,
        actionChoice.num1,
        queuedAction.num * actionChoice.num1,
        users,
        _useAll
      );
      _processConsumable(
        _from,
        _tokenId,
        itemNFT,
        actionChoice.inputTokenId2,
        numProduced,
        actionChoice.num2,
        queuedAction.num * actionChoice.num2,
        users,
        _useAll
      );
      _processConsumable(
        _from,
        _tokenId,
        itemNFT,
        actionChoice.inputTokenId3,
        numProduced,
        actionChoice.num3,
        queuedAction.num * actionChoice.num3,
        users,
        _useAll
      );
    }

    if (_useAll && queuedAction.potionId != NONE) {
      // Consume the potion
      users.minorUnequip(_from, queuedAction.potionId, 1);
      emit Unequip(_tokenId, queuedAction.potionId, 1);
      itemNFT.burn(_from, queuedAction.potionId, 1);
    }

    if (actionChoice.outputTokenId != NONE) {
      itemNFT.mint(_from, actionChoice.outputTokenId, numProduced);
    }
  }
}
