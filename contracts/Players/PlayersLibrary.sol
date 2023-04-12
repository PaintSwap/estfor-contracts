// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

import {UnsafeMath, U256} from "@0xdoublesharp/unsafe-math/contracts/UnsafeMath.sol";
import {ItemNFT} from "../ItemNFT.sol";
import {World} from "../World.sol";

/* solhint-disable no-global-import */
import "../globals/players.sol";
import "../globals/actions.sol";
import "../globals/items.sol";

/* solhint-enable no-global-import */

// This file contains methods for interacting with the player that is used to decrease implementation deployment bytecode code.
library PlayersLibrary {
  using Strings for uint32;
  using Strings for uint256;
  using Strings for bytes32;
  using UnsafeMath for U256;

  // Show all the player stats, return metadata json
  function uri(
    bytes32 name,
    mapping(Skill skill => uint128 xp) storage xp,
    uint overallXP,
    bytes32 avatarName,
    string calldata avatarDescription,
    string calldata imageURI,
    bool isAlpha,
    uint playerId,
    string calldata clanName
  ) external view returns (string memory) {
    uint overallLevel = getLevel(overallXP);
    string memory attributes = string(
      abi.encodePacked(
        _getTraitStringJSON("Avatar", avatarName),
        ",",
        _getTraitStringJSON("Clan", clanName),
        ",",
        _getTraitNumberJSON("Melee level", getLevel(xp[Skill.MELEE])),
        ",",
        _getTraitNumberJSON("Magic level", getLevel(xp[Skill.MAGIC])),
        ",",
        _getTraitNumberJSON("Defence level", getLevel(xp[Skill.DEFENCE])),
        ",",
        _getTraitNumberJSON("Health level", getLevel(xp[Skill.HEALTH])),
        ",",
        _getTraitNumberJSON("Mining level", getLevel(xp[Skill.MINING])),
        ",",
        _getTraitNumberJSON("Woodcutting level", getLevel(xp[Skill.WOODCUTTING])),
        ",",
        _getTraitNumberJSON("Fishing level", getLevel(xp[Skill.FISHING])),
        ",",
        _getTraitNumberJSON("Smithing level", getLevel(xp[Skill.SMITHING])),
        ",",
        _getTraitNumberJSON("Thieving level", getLevel(xp[Skill.THIEVING])),
        ",",
        _getTraitNumberJSON("Crafting level", getLevel(xp[Skill.CRAFTING])),
        ",",
        _getTraitNumberJSON("Cooking level", getLevel(xp[Skill.COOKING])),
        ",",
        _getTraitNumberJSON("Firemaking level", getLevel(xp[Skill.FIREMAKING])),
        ",",
        _getTraitNumberJSON("Total level", uint16(overallLevel))
      )
    );

    bytes memory fullName = abi.encodePacked(_trimBytes32(name), " (", overallLevel.toString(), ")");
    bytes memory externalURL = abi.encodePacked(
      "https://",
      isAlpha ? "alpha." : "",
      "estfor.com/game/journal/",
      playerId.toString()
    );

    string memory json = Base64.encode(
      abi.encodePacked(
        '{"name":"',
        fullName,
        '","description":"',
        avatarDescription,
        '","attributes":[',
        attributes,
        '],"image":"',
        imageURI,
        '", "external_url":"',
        externalURL,
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

  function _getTraitStringJSON(string memory traitType, string memory value) private pure returns (bytes memory) {
    return abi.encodePacked(_getTraitTypeJSON(traitType), '"', value, '"}');
  }

  function _getTraitNumberJSON(string memory traitType, uint32 value) private pure returns (bytes memory) {
    return abi.encodePacked(_getTraitTypeJSON(traitType), value.toString(), "}");
  }

  function _getTraitTypeJSON(string memory traitType) private pure returns (bytes memory) {
    return abi.encodePacked('{"trait_type":"', traitType, '","value":');
  }

  // Index not level, add one after (check for > max)
  function getLevel(uint _xp) public pure returns (uint16) {
    U256 low;
    U256 high = U256.wrap(XP_BYTES.length).div(4);

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

  function _getXP(uint256 _index) private pure returns (uint32) {
    uint256 index = _index * 4;
    return
      uint32(
        XP_BYTES[index] |
          (bytes4(XP_BYTES[index + 1]) >> 8) |
          (bytes4(XP_BYTES[index + 2]) >> 16) |
          (bytes4(XP_BYTES[index + 3]) >> 24)
      );
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
    uint32 totalHealthLost = _dmg(
      _enemyCombatStats.melee,
      _combatStats.meleeDefence,
      _alphaCombat,
      _betaCombat,
      _combatElapsedTime
    );
    totalHealthLost += _dmg(
      _enemyCombatStats.magic,
      _combatStats.magicDefence,
      _alphaCombat,
      _betaCombat,
      _combatElapsedTime
    );

    if (int32(totalHealthLost) > _combatStats.health) {
      // Take away our health points from the total dealt
      totalHealthLost -= uint16(int16(_max(0, _combatStats.health)));
    } else {
      totalHealthLost = 0;
    }

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
      // Can only consume a maximum of 65535 food
      if (foodConsumed > type(uint16).max) {
        foodConsumed = type(uint16).max;
        died = true;
      } else {
        uint balance = _itemNFT.balanceOf(_from, queuedAction.regenerateId);
        died = foodConsumed > balance;
        if (died) {
          foodConsumed = uint16(balance);
        }
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
    if (_numConsumed > type(uint16).max && _numConsumed < balance / _num) {
      // Have enough balance but numConsumed exceeds 65535, too much so limit it.
      balance = type(uint16).max * _num;
    }

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

  function min(uint256 a, uint256 b) internal pure returns (uint256) {
    return a < b ? a : b;
  }

  function _dmg(
    int16 attack,
    int16 defence,
    uint128 _alphaCombat,
    uint128 _betaCombat,
    uint _elapsedTime
  ) private pure returns (uint32) {
    return
      // Formula is max(1, a(atk) + b(2 * atk - def))
      // Always do at least 1 damage per minute
      uint32(
        int32(
          (_max(1, attack * int128(_alphaCombat) + (attack * 2 - defence) * int128(_betaCombat)) *
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
      if (_actionChoice.skill == Skill.MELEE) {
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
      numConsumed = uint16((combatElapsedTime * _actionChoice.rate) / (3600 * 10));
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
    numConsumed = uint24((_elapsedTime * _actionChoice.rate) / (3600 * 10));
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

  function getBoostedTime(
    uint _actionStartTime,
    uint _elapsedTime,
    PlayerBoostInfo storage _activeBoost
  ) public view returns (uint24 boostedTime) {
    uint actionEndTime = _actionStartTime + _elapsedTime;
    uint boostEndTime = _activeBoost.startTime + _activeBoost.duration;
    bool boostFinishedBeforeActionStarted = _actionStartTime > boostEndTime;
    bool boostStartedAfterActionFinished = actionEndTime < _activeBoost.startTime;
    if (boostFinishedBeforeActionStarted || boostStartedAfterActionFinished) {
      // Boost was not active at all during this queued action
      boostedTime = 0;
    } else if (_actionStartTime >= _activeBoost.startTime && actionEndTime >= boostEndTime) {
      boostedTime = uint24(boostEndTime - _actionStartTime);
    } else if (actionEndTime > _activeBoost.startTime && boostEndTime >= actionEndTime) {
      boostedTime = uint24(actionEndTime - _activeBoost.startTime);
    } else if (_activeBoost.startTime > _actionStartTime && boostEndTime < actionEndTime) {
      boostedTime = _activeBoost.duration;
    } else {
      assert(false); // Should never happen
    }
  }

  function extraXPFromBoost(
    bool _isCombatSkill,
    uint _actionStartTime,
    uint _elapsedTime,
    uint24 _xpPerHour,
    PlayerBoostInfo storage activeBoost
  ) public view returns (uint32 boostPointsAccrued) {
    if (activeBoost.itemTokenId != NONE && activeBoost.startTime < block.timestamp) {
      // A boost is active
      BoostType boostType = activeBoost.boostType;
      if (
        boostType == BoostType.ANY_XP ||
        (_isCombatSkill && activeBoost.boostType == BoostType.COMBAT_XP) ||
        (!_isCombatSkill && activeBoost.boostType == BoostType.NON_COMBAT_XP)
      ) {
        uint boostedTime = getBoostedTime(_actionStartTime, _elapsedTime, activeBoost);
        boostPointsAccrued = uint32((boostedTime * _xpPerHour * activeBoost.val) / (3600 * 100));
      }
    }
  }

  function extraBoostFromFullAttire(
    uint16[] memory itemTokenIds,
    uint[] memory balances,
    uint16[5] memory expectedItemTokenIds
  ) external pure returns (bool matches) {
    // Check if they have the full equipment required
    if (itemTokenIds.length == 5) {
      for (uint i = 0; i < 5; ++i) {
        if (itemTokenIds[i] != expectedItemTokenIds[i] || balances[i] == 0) {
          return false;
        }
      }
      return true;
    }
  }

  // Move to world?
  function _getRandomComponent(bytes32 _word, uint _skillEndTime, uint _playerId) private pure returns (bytes32) {
    return keccak256(abi.encodePacked(_word, _skillEndTime, _playerId));
  }

  function getRandomBytes(
    uint _numTickets,
    uint _skillEndTime,
    uint _playerId,
    World _world
  ) external view returns (bytes memory b) {
    if (_numTickets <= 16) {
      // 32 bytes
      bytes32 word = bytes32(_world.getRandomWord(_skillEndTime));
      b = abi.encodePacked(_getRandomComponent(word, _skillEndTime, _playerId));
    } else if (_numTickets <= 48) {
      uint[3] memory fullWords = _world.getFullRandomWords(_skillEndTime);
      // 3 * 32 bytes
      for (uint i = 0; i < 3; ++i) {
        fullWords[i] = uint(_getRandomComponent(bytes32(fullWords[i]), _skillEndTime, _playerId));
      }
      b = abi.encodePacked(fullWords);
    } else {
      // 5 * 3 * 32 bytes
      uint[3][5] memory multipleFullWords = _world.getMultipleFullRandomWords(_skillEndTime);
      for (uint i = 0; i < 5; ++i) {
        for (uint j = 0; j < 3; ++j) {
          multipleFullWords[i][j] = uint(
            _getRandomComponent(bytes32(multipleFullWords[i][j]), _skillEndTime, _playerId)
          );
          // XOR all the full words with the first fresh random number to give more randomness to the existing random words
          if (i > 0) {
            multipleFullWords[i][j] = multipleFullWords[i][j] ^ multipleFullWords[0][j];
          }
        }
      }

      b = abi.encodePacked(multipleFullWords);
    }
  }
}
