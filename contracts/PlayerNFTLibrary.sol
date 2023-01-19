// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/utils/Base64.sol";
import "./enums.sol";
import "./interfaces/ItemStat.sol";
import "./World.sol";

// Show all the player stats, return metadata json
library PlayerNFTLibrary {
  function uri(
    bytes32 name,
    mapping(Skill => uint32) storage skillPoints,
    Stats calldata totalStats,
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

  function updatePlayerStats(Stats storage _totalStats, Stats memory _stats, bool _add) external {
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
}
