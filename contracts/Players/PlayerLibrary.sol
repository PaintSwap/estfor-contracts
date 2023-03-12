// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

import {Unsafe256, U256} from "../lib/Unsafe256.sol";
import {ItemNFT} from "../ItemNFT.sol";
import {World} from "../World.sol";

// solhint-disable-next-line no-global-import
import "../globals/players.sol";
// solhint-disable-next-line no-global-import
import "../globals/actions.sol";
// solhint-disable-next-line no-global-import
import "../globals/items.sol";

library PlayerLibrary {
  using Strings for uint32;
  using Strings for bytes32;
  using Unsafe256 for U256;

  // Show all the player stats, return metadata json
  function uri(
    bytes32 name,
    mapping(Skill skill => uint32 skillPoint) storage skillPoints,
    bytes32 avatarName,
    string calldata avatarDescription,
    string calldata imageURI
  ) external view returns (string memory) {
    string memory attributes = string(
      abi.encodePacked(
        _getTraitStringJSON("Avatar", avatarName),
        ",",
        _getTraitNumberJSON("Attack", getLevel(skillPoints[Skill.ATTACK])),
        ",",
        _getTraitNumberJSON("Magic", getLevel(skillPoints[Skill.MAGIC])),
        ",",
        _getTraitNumberJSON("Defence", getLevel(skillPoints[Skill.DEFENCE])),
        ",",
        _getTraitNumberJSON("Health", getLevel(skillPoints[Skill.HEALTH])),
        ",",
        _getTraitNumberJSON("Mining", getLevel(skillPoints[Skill.MINING])),
        ",",
        _getTraitNumberJSON("WoodCutting", getLevel(skillPoints[Skill.WOODCUTTING])),
        ",",
        _getTraitNumberJSON("Fishing", getLevel(skillPoints[Skill.FISHING])),
        ",",
        _getTraitNumberJSON("Smithing", getLevel(skillPoints[Skill.SMITHING])),
        ",",
        _getTraitNumberJSON("Thieving", getLevel(skillPoints[Skill.THIEVING])),
        ",",
        _getTraitNumberJSON("Crafting", getLevel(skillPoints[Skill.CRAFTING])),
        ",",
        _getTraitNumberJSON("Cooking", getLevel(skillPoints[Skill.COOKING])),
        ",",
        _getTraitNumberJSON("FireMaking", getLevel(skillPoints[Skill.FIREMAKING]))
      )
    );

    string memory json = Base64.encode(
      abi.encodePacked(
        '{"name":"',
        _trimBytes32(name),
        '","description":"',
        avatarDescription,
        '","attributes":[',
        attributes,
        '],"image":"',
        imageURI,
        '"}'
      )
    );

    return string(abi.encodePacked("data:application/json;base64,", json));
  }

  function _trimBytes32(bytes32 _bytes32) private pure returns (bytes memory _bytes) {
    U256 _len;
    while (_len.lt(32)) {
      if (_bytes32[_len.asUint256()] == 0) {
        break;
      }
      _len = _len.inc();
    }
    _bytes = abi.encodePacked(_bytes32);
    assembly ("memory-safe") {
      mstore(_bytes, _len)
    }
  }

  function _getTraitStringJSON(string memory traitType, bytes32 value) private pure returns (bytes memory) {
    return abi.encodePacked(_getTraitTypeJSON(traitType), '"', _trimBytes32(value), '"}');
  }

  function _getTraitNumberJSON(string memory traitType, uint32 value) private pure returns (bytes memory) {
    return abi.encodePacked(_getTraitTypeJSON(traitType), value.toString(), "}");
  }

  function _getTraitTypeJSON(string memory traitType) private pure returns (bytes memory) {
    return abi.encodePacked('{"trait_type":"', traitType, '","value":');
  }

  // Index not level, add one after (check for > max)
  function getLevel(uint256 _xp) public pure returns (uint16) {
    U256 low;
    U256 high = U256.wrap(XP_BYTES.length).div(3);

    while (low < high) {
      U256 mid = (low + high).div(2);

      // Note that mid will always be strictly less than high (i.e. it will be a valid array index)
      if (_getXP(mid.asUint256()) > _xp) {
        high = mid;
      } else {
        low = mid.inc();
      }
    }

    if (low.neq(0)) {
      return low.asUint16();
    } else {
      return 1;
    }
  }

  function _getXP(uint256 _index) private pure returns (uint24) {
    uint256 index = _index * 3;
    return uint24(XP_BYTES[index] | (bytes3(XP_BYTES[index + 1]) >> 8) | (bytes3(XP_BYTES[index + 2]) >> 16));
  }

  function foodConsumedView(
    address _from,
    QueuedAction storage queuedAction,
    uint _combatElapsedTime,
    ItemNFT _itemNFT,
    CombatStats memory _combatStats,
    CombatStats memory _enemyCombatStats,
    uint128 _alphaCombat,
    uint128 _betaCombat
  ) external view returns (uint24 foodConsumed, bool died) {
    uint32 totalHealthLost = uint32(
      int32(_dmg(_enemyCombatStats.melee, _combatStats.meleeDefence, _alphaCombat, _betaCombat, _combatElapsedTime)) -
        _combatStats.health
    );
    totalHealthLost += _dmg(
      _enemyCombatStats.magic,
      _combatStats.magicDefence,
      _alphaCombat,
      _betaCombat,
      _combatElapsedTime
    );
    //    totalHealthLost +=  _dmg(_enemyCombatStats.range, _combatStats.rangeDefence, _alphaCombat, _betaCombat, _combatElapsedTime);

    uint healthRestored;
    if (queuedAction.regenerateId != NONE) {
      Item memory item = _itemNFT.getItem(queuedAction.regenerateId);
      healthRestored = item.healthRestored;
    }

    if (healthRestored == 0 || totalHealthLost <= 0) {
      // No food attached or didn't lose any health
      died = totalHealthLost != 0;
    } else {
      // Round up
      foodConsumed = uint24(
        uint32(totalHealthLost) / healthRestored + (uint32(totalHealthLost) % healthRestored == 0 ? 0 : 1)
      );
      uint balance = _itemNFT.balanceOf(_from, queuedAction.regenerateId);

      died = foodConsumed > balance;
      if (died) {
        foodConsumed = uint16(balance);
      }
    }
  }

  function _getMaxRequiredRatio(
    address _from,
    ActionChoice memory _actionChoice,
    uint24 _numConsumed,
    ItemNFT _itemNFT
  ) private view returns (uint maxRequiredRatio) {
    maxRequiredRatio = _numConsumed;
    if (_numConsumed != 0) {
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
    uint24 _numConsumed,
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

  function _max(int256 a, int256 b) private pure returns (int256) {
    return a > b ? a : b;
  }

  function _dmg(
    int16 attack,
    int16 defence,
    uint128 _alphaCombat,
    uint128 _betaCombat,
    uint _elapsedTime
  ) private pure returns (uint32) {
    return
      uint32(
        int32(
          (_max(0, attack * int128(_alphaCombat) + (attack - defence) * int128(_betaCombat)) *
            int32(int(_elapsedTime))) / 60
        )
      );
  }

  function getCombatAdjustedElapsedTimes(
    address _from,
    ItemNFT _itemNFT,
    World _world,
    uint _elapsedTime,
    ActionChoice memory _actionChoice,
    QueuedAction memory _queuedAction,
    CombatStats memory _combatStats,
    CombatStats memory _enemyCombatStats,
    uint128 _alphaCombat,
    uint128 _betaCombat
  ) external view returns (uint xpElapsedTime, uint combatElapsedTime, uint16 numConsumed) {
    // Update these as necessary
    xpElapsedTime = _elapsedTime;
    combatElapsedTime = _elapsedTime;

    // Figure out how much food should be consumed.
    // This is based on the damage done from battling
    uint numSpawnedPerHour = _world.getNumSpawn(_queuedAction.actionId);
    uint maxHealthEnemy = (numSpawnedPerHour * _elapsedTime * uint16(_enemyCombatStats.health)) / 3600;
    if (maxHealthEnemy != 0) {
      uint32 totalHealthDealt;
      if (_actionChoice.skill == Skill.ATTACK) {
        totalHealthDealt = _dmg(
          _combatStats.melee,
          _enemyCombatStats.meleeDefence,
          _alphaCombat,
          _betaCombat,
          _elapsedTime
        );
      } else if (_actionChoice.skill == Skill.MAGIC) {
        _combatStats.magic += int16(int32(_actionChoice.diff)); // Extra magic damage
        totalHealthDealt = _dmg(
          _combatStats.magic,
          _enemyCombatStats.magicDefence,
          _alphaCombat,
          _betaCombat,
          _elapsedTime
        );
      } else if (_actionChoice.skill == Skill.RANGE) {
        // Add later
        //        _combatStats.range += int16(int32(_actionChoice.diff)); // Extra magic damage
        //        totalHealthDealt = _dmg(_combatStats.range, _enemyCombatStats.rangeDefence, _alphaCombat, _betaCombat, _elapsedTime);
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

          if (numConsumed > 0) {
            // Work out what the actual elapsedTime should really be because they didn't have enough equipped to gain all the XP
            xpElapsedTime = (combatElapsedTime * maxRequiredRatio) / numConsumed;
          } else {
            xpElapsedTime = 0;
          }
        }
      }
    } else {
      xpElapsedTime = 0;
    }
  }

  function getNonCombatAdjustedElapsedTime(
    address _from,
    ItemNFT _itemNFT,
    uint _elapsedTime,
    ActionChoice memory _actionChoice
  ) external view returns (uint xpElapsedTime, uint24 numConsumed) {
    // Update these as necessary
    xpElapsedTime = _elapsedTime;

    // Check the max that can be used
    numConsumed = uint24((_elapsedTime * _actionChoice.rate) / (3600 * 100));
    // This checks the balances
    uint maxRequiredRatio = _getMaxRequiredRatio(_from, _actionChoice, numConsumed, _itemNFT);
    if (numConsumed > maxRequiredRatio) {
      numConsumed = uint24(maxRequiredRatio);
      if (numConsumed > 0) {
        // Work out what the actual elapsedTime should really be because they didn't have enough equipped to gain all the XP
        xpElapsedTime = (_elapsedTime * maxRequiredRatio) / numConsumed;
      } else {
        xpElapsedTime = 0;
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

  function extraBoostFromFullEquipment(
    Skill _skill,
    uint16[] memory itemTokenIds,
    uint[] memory balances
  ) external pure returns (uint extraBoost) {
    if (itemTokenIds.length == 5) {
      if (_skill == Skill.THIEVING) {
        if (
          itemTokenIds[0] == NATUOW_HOOD &&
          balances[0] != 0 && // head
          itemTokenIds[1] == NATUOW_BODY &&
          balances[1] != 0 && // body
          itemTokenIds[2] == NATUOW_BRACERS &&
          balances[2] != 0 && // arms
          itemTokenIds[3] == NATUOW_TASSETS &&
          balances[3] != 0 && // legs
          itemTokenIds[4] == NATUOW_BOOTS &&
          balances[4] != 0 // boots
        ) {
          extraBoost = 3; // %
        }
      } else if (_skill == Skill.WOODCUTTING) {
        if (
          itemTokenIds[0] == NATURE_MASK &&
          balances[0] != 0 && // head
          itemTokenIds[1] == NATURE_BODY &&
          balances[1] != 0 && // body
          itemTokenIds[2] == NATURE_BRACERS &&
          balances[2] != 0 && // arms
          itemTokenIds[3] == NATURE_TROUSERS &&
          balances[3] != 0 && // legs
          itemTokenIds[4] == NATURE_BOOTS &&
          balances[4] != 0 // boots
        ) {
          extraBoost = 3; // %
        }
      } else if (_skill == Skill.CRAFTING) {
        if (
          itemTokenIds[0] == BAT_WING_HAT &&
          balances[0] != 0 && // head
          itemTokenIds[1] == BAT_WING_BODY &&
          balances[1] != 0 && // body
          itemTokenIds[2] == BAT_WING_BRACERS &&
          balances[2] != 0 && // arms
          itemTokenIds[3] == BAT_WING_TROUSERS &&
          balances[3] != 0 && // legs
          itemTokenIds[4] == BAT_WING_BOOTS &&
          balances[4] != 0 // boots
        ) {
          extraBoost = 3; // %
        }
      }
    }
  }
}
