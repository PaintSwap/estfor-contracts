// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/utils/Base64.sol";
import "./enums.sol";
import "./interfaces/ItemStat.sol";

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
        '{"trait_type":"Strength","value":"',
        skillPoints[Skill.STRENGTH],
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
}
