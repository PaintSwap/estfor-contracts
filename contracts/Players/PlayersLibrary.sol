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
  using UnsafeMath for uint256;

  // Show all the player stats, return metadata json
  function uri(
    string calldata playerName,
    mapping(Skill skill => uint128 xp) storage xp,
    string calldata avatarName,
    string calldata avatarDescription,
    string calldata imageURI,
    bool isAlpha,
    uint playerId,
    string calldata clanName
  ) external view returns (string memory) {
    uint overallLevel = getLevel(xp[Skill.MELEE]) +
      getLevel(xp[Skill.MAGIC]) +
      getLevel(xp[Skill.DEFENCE]) +
      getLevel(xp[Skill.HEALTH]) +
      getLevel(xp[Skill.MINING]) +
      getLevel(xp[Skill.WOODCUTTING]) +
      getLevel(xp[Skill.FISHING]) +
      getLevel(xp[Skill.SMITHING]) +
      getLevel(xp[Skill.THIEVING]) +
      getLevel(xp[Skill.CRAFTING]) +
      getLevel(xp[Skill.COOKING]) +
      getLevel(xp[Skill.FIREMAKING]);

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

    bytes memory fullName = abi.encodePacked(playerName, " (", overallLevel.toString(), ")");
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
    U256 high = XP_BYTES.length.asU256().div(4);

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

  function _getRealBalance(
    uint _originalBalance,
    uint _itemId,
    PendingQueuedActionEquipmentState[] memory _pendingQueuedActionEquipmentStates
  ) private pure returns (uint balance) {
    balance = _originalBalance;
    U256 bounds = _pendingQueuedActionEquipmentStates.length.asU256();
    for (U256 iter; iter < bounds; iter = iter.inc()) {
      uint i = iter.asUint256();
      PendingQueuedActionEquipmentState memory pendingQueuedActionEquipmentState = _pendingQueuedActionEquipmentStates[
        i
      ];
      U256 jBounds = pendingQueuedActionEquipmentState.producedItemTokenIds.length.asU256();
      for (U256 jIter; jIter < jBounds; jIter = jIter.inc()) {
        uint j = jIter.asUint256();
        if (pendingQueuedActionEquipmentState.producedItemTokenIds[j] == _itemId) {
          balance += pendingQueuedActionEquipmentState.producedAmounts[j];
        }
      }
      jBounds = pendingQueuedActionEquipmentState.consumedItemTokenIds.length.asU256();
      for (U256 jIter; jIter < jBounds; jIter = jIter.inc()) {
        uint j = jIter.asUint256();
        if (pendingQueuedActionEquipmentState.consumedItemTokenIds[j] == _itemId) {
          balance -= pendingQueuedActionEquipmentState.consumedAmounts[j];
        }
      }
    }
  }

  // This takes into account any intermediate changes from previous actions from view functions
  // as those cannot affect the blockchain state with balanceOf
  function getRealBalance(
    address _from,
    uint _itemId,
    ItemNFT _itemNFT,
    PendingQueuedActionEquipmentState[] memory _pendingQueuedActionEquipmentStates
  ) public view returns (uint balance) {
    balance = _getRealBalance(_itemNFT.balanceOf(_from, _itemId), _itemId, _pendingQueuedActionEquipmentStates);
  }

  function getRealBalances(
    address _from,
    uint16[] memory _itemIds,
    ItemNFT _itemNFT,
    PendingQueuedActionEquipmentState[] memory _pendingQueuedActionEquipmentStates
  ) external view returns (uint[] memory balances) {
    balances = _itemNFT.balanceOfs(_from, _itemIds);

    U256 bounds = balances.length.asU256();
    for (U256 iter; iter < bounds; iter = iter.inc()) {
      uint i = iter.asUint256();
      balances[i] = _getRealBalance(balances[i], _itemIds[i], _pendingQueuedActionEquipmentStates);
    }
  }

  function foodConsumedView(
    address _from,
    uint16 _regenerateId,
    uint _combatElapsedTime,
    ItemNFT _itemNFT,
    CombatStats memory _combatStats,
    CombatStats memory _enemyCombatStats,
    uint8 _alphaCombat,
    uint8 _betaCombat,
    PendingQueuedActionEquipmentState[] memory _pendingQueuedActionEquipmentStates
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
    //    totalHealthLost +=  _dmg(_enemyCombatStats.range, _combatStats.rangeDefence, _alphaCombat, _betaCombat, _combatElapsedTime);

    if (int32(totalHealthLost) > _combatStats.health) {
      // Take away our health points from the total dealt
      totalHealthLost -= uint16(int16(_max(0, _combatStats.health)));
    } else {
      totalHealthLost = 0;
    }

    uint healthRestored;
    if (_regenerateId != NONE) {
      Item memory item = _itemNFT.getItem(_regenerateId);
      healthRestored = item.healthRestored;
    }

    if (healthRestored == 0 || totalHealthLost <= 0) {
      // No food attached or didn't lose any health
      died = totalHealthLost != 0;
    } else {
      // Round up
      foodConsumed = uint24(ceilDiv(uint32(totalHealthLost), healthRestored));
      // Can only consume a maximum of 65535 food
      if (foodConsumed > type(uint16).max) {
        foodConsumed = type(uint16).max;
        died = true;
      } else {
        uint balance = getRealBalance(_from, _regenerateId, _itemNFT, _pendingQueuedActionEquipmentStates);
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
    ItemNFT _itemNFT,
    PendingQueuedActionEquipmentState[] memory _pendingQueuedActionEquipmentStates
  ) private view returns (uint maxRequiredRatio) {
    maxRequiredRatio = _numConsumed;
    if (_numConsumed != 0) {
      if (_actionChoice.inputTokenId1 != 0) {
        maxRequiredRatio = _getMaxRequiredRatioPartial(
          _from,
          _actionChoice.inputTokenId1,
          _actionChoice.inputAmount1,
          _numConsumed,
          maxRequiredRatio,
          _itemNFT,
          _pendingQueuedActionEquipmentStates
        );
      }
      if (_actionChoice.inputTokenId2 != 0) {
        maxRequiredRatio = _getMaxRequiredRatioPartial(
          _from,
          _actionChoice.inputTokenId2,
          _actionChoice.inputAmount2,
          _numConsumed,
          maxRequiredRatio,
          _itemNFT,
          _pendingQueuedActionEquipmentStates
        );
      }
      if (_actionChoice.inputTokenId3 != 0) {
        maxRequiredRatio = _getMaxRequiredRatioPartial(
          _from,
          _actionChoice.inputTokenId3,
          _actionChoice.inputAmount3,
          _numConsumed,
          maxRequiredRatio,
          _itemNFT,
          _pendingQueuedActionEquipmentStates
        );
      }
    }
  }

  function _getMaxRequiredRatioPartial(
    address _from,
    uint16 _inputTokenId,
    uint16 _inputAmount,
    uint24 _numConsumed,
    uint _prevConsumeMaxRatio,
    ItemNFT _itemNFT,
    PendingQueuedActionEquipmentState[] memory _pendingQueuedActionEquipmentStates
  ) private view returns (uint maxRequiredRatio) {
    uint balance = getRealBalance(_from, _inputTokenId, _itemNFT, _pendingQueuedActionEquipmentStates);
    if ((_numConsumed > type(uint16).max) && (balance >= type(uint16).max * _inputAmount)) {
      // Have enough balance but numConsumed exceeds 65535, too much so limit it.
      balance = type(uint16).max * _inputAmount;
    }

    uint tempMaxRequiredRatio = balance / _inputAmount;
    if (tempMaxRequiredRatio < _prevConsumeMaxRatio) {
      maxRequiredRatio = tempMaxRequiredRatio;
    } else {
      maxRequiredRatio = _prevConsumeMaxRatio;
    }
  }

  function _max(int a, int b) private pure returns (int) {
    return a > b ? a : b;
  }

  function _max(uint a, uint b) private pure returns (uint) {
    return a > b ? a : b;
  }

  function min(uint a, uint b) internal pure returns (uint) {
    return a < b ? a : b;
  }

  function ceilDiv(uint a, uint b) internal pure returns (uint) {
    return a == 0 ? 0 : (a - 1) / b + 1;
  }

  function _dmg(
    int attack,
    int defence,
    uint8 _alphaCombat,
    uint8 _betaCombat,
    uint _elapsedTime
  ) private pure returns (uint32) {
    return
      // Formula is max(1, a(atk) + b(2 * atk - def))
      // Always do at least 1 damage per minute
      uint32(
        int32(
          (_max(1, int128(attack) * int8(_alphaCombat) + (attack * 2 - defence) * int8(_betaCombat)) *
            int(_elapsedTime)) / 60
        )
      );
  }

  function _timeToKill(
    int attack,
    int defence,
    uint8 _alphaCombat,
    uint8 _betaCombat,
    int16 _enemyHealth
  ) private view returns (uint) {
    // Formula is max(1, a(atk) + b(2 * atk - def))
    // Always do at least 1 damage per minute
    uint dmgPerMinute = uint(_max(1, int128(attack) * int8(_alphaCombat) + (attack * 2 - defence) * int8(_betaCombat)));
    return ceilDiv(uint(uint16(_enemyHealth)) * 60, dmgPerMinute);
  }

  function _getTimeToKill(
    ActionChoice memory _actionChoice,
    CombatStats memory _combatStats,
    CombatStats memory _enemyCombatStats,
    uint8 _alphaCombat,
    uint8 _betaCombat,
    int16 _enemyHealth
  ) private view returns (uint timeToKill) {
    if (_actionChoice.skill == Skill.MELEE) {
      timeToKill = _timeToKill(
        _combatStats.melee,
        _enemyCombatStats.meleeDefence,
        _alphaCombat,
        _betaCombat,
        _enemyHealth
      );
    } else if (_actionChoice.skill == Skill.MAGIC) {
      timeToKill = _timeToKill(
        _combatStats.magic,
        _enemyCombatStats.magicDefence,
        _alphaCombat,
        _betaCombat,
        _enemyHealth
      );
    } else if (_actionChoice.skill == Skill.RANGE) {
      // Add later
      //        timeToKill = _timeToKill(_combatStats.range, _enemyCombatStats.rangeDefence, _alphaCombat, _betaCombat, _enemyHealth);
    }
  }

  function _getDmg(
    ActionChoice memory _actionChoice,
    CombatStats memory _combatStats,
    CombatStats memory _enemyCombatStats,
    uint8 _alphaCombat,
    uint8 _betaCombat,
    uint _elapsedTime
  ) private pure returns (uint32 dmgDealt) {
    if (_actionChoice.skill == Skill.MELEE) {
      dmgDealt = _dmg(_combatStats.melee, _enemyCombatStats.meleeDefence, _alphaCombat, _betaCombat, _elapsedTime);
    } else if (_actionChoice.skill == Skill.MAGIC) {
      _combatStats.magic += int16(_actionChoice.diff); // Extra magic damage
      dmgDealt = _dmg(_combatStats.magic, _enemyCombatStats.magicDefence, _alphaCombat, _betaCombat, _elapsedTime);
    } else if (_actionChoice.skill == Skill.RANGE) {
      // Add later
      //        _combatStats.range += int16(int32(_actionChoice.diff)); // Extra magic damage
      //        totalHealthDealt = _dmg(_combatStats.range, _enemyCombatStats.rangeDefence, _alphaCombat, _betaCombat, _elapsedTime);
    }
  }

  function getCombatAdjustedElapsedTimes(
    address _from,
    ItemNFT _itemNFT,
    World _world,
    uint _elapsedTime,
    ActionChoice memory _actionChoice,
    bool _checkBalance,
    QueuedAction memory _queuedAction,
    CombatStats memory _combatStats,
    CombatStats memory _enemyCombatStats,
    uint8 _alphaCombat,
    uint8 _betaCombat,
    PendingQueuedActionEquipmentState[] memory _pendingQueuedActionEquipmentStates
  ) external view returns (uint xpElapsedTime, uint combatElapsedTime, uint16 numConsumed) {
    uint numSpawnedPerHour = _world.getNumSpawn(_queuedAction.actionId);
    uint respawnTime = 3600 / numSpawnedPerHour;
    uint32 dmgDealt = _getDmg(_actionChoice, _combatStats, _enemyCombatStats, _alphaCombat, _betaCombat, respawnTime);

    uint numKilled;
    if (dmgDealt > uint16(_enemyCombatStats.health)) {
      // Are able to kill them all, but how many can we kill in the time that has elapsed?
      numKilled = (_elapsedTime * numSpawnedPerHour) / 3600;
      uint combatTimePerEnemy = ceilDiv(uint16(_enemyCombatStats.health) * respawnTime, dmgDealt);
      combatElapsedTime = combatTimePerEnemy * numKilled;
    } else {
      uint combatTimePerKill = _getTimeToKill(
        _actionChoice,
        _combatStats,
        _enemyCombatStats,
        _alphaCombat,
        _betaCombat,
        _enemyCombatStats.health
      );
      numKilled = _elapsedTime / combatTimePerKill;
      combatElapsedTime = _elapsedTime; // How time was spent in combat
    }

    xpElapsedTime = respawnTime * numKilled;

    // Check how many to consume, and also adjust xpElapsedTime if they don't have enough consumables
    numConsumed = uint16(ceilDiv(combatElapsedTime * _actionChoice.rate, 3600 * 10));
    if (_actionChoice.rate != 0) {
      numConsumed = uint16(_max(numKilled, numConsumed));
    }

    if (_checkBalance) {
      if (numConsumed != 0) {
        // This checks the balances
        uint maxRequiredRatio = _getMaxRequiredRatio(
          _from,
          _actionChoice,
          numConsumed,
          _itemNFT,
          _pendingQueuedActionEquipmentStates
        );

        if (numConsumed > maxRequiredRatio) {
          xpElapsedTime = 0;
          combatElapsedTime = _elapsedTime;
          numConsumed = uint16(maxRequiredRatio);
        }
      } else if (_actionChoice.rate != 0) {
        xpElapsedTime = 0;
        combatElapsedTime = _elapsedTime;
      }
    }
  }

  function getNonCombatAdjustedElapsedTime(
    address _from,
    ItemNFT _itemNFT,
    uint _elapsedTime,
    ActionChoice memory _actionChoice,
    bool _checkBalance,
    PendingQueuedActionEquipmentState[] memory _pendingQueuedActionEquipmentStates
  ) external view returns (uint xpElapsedTime, uint24 numConsumed) {
    // Check the max that can be used
    numConsumed = uint24((_elapsedTime * _actionChoice.rate) / (3600 * 10));

    if (_checkBalance && numConsumed != 0) {
      // This checks the balances
      uint maxRequiredRatio = _getMaxRequiredRatio(
        _from,
        _actionChoice,
        numConsumed,
        _itemNFT,
        _pendingQueuedActionEquipmentStates
      );
      bool hadEnoughConsumables = numConsumed <= maxRequiredRatio;
      if (!hadEnoughConsumables) {
        numConsumed = uint24(maxRequiredRatio);
      }
    }
    // Work out what the actual elapsedTime should be had all those been made
    xpElapsedTime = (uint(numConsumed) * 3600 * 10) / _actionChoice.rate;
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
      for (U256 iter; iter.lt(5); iter = iter.inc()) {
        uint i = iter.asUint256();
        if (itemTokenIds[i] != expectedItemTokenIds[i] || balances[i] == 0) {
          return false;
        }
      }
      return true;
    }
  }

  function normalizeRewards(
    uint[] calldata newIds,
    uint[] calldata newAmounts,
    uint[] calldata prevNewIds,
    uint[] calldata prevNewAmounts
  ) external pure returns (uint[] memory ids, uint[] memory amounts) {
    // Subtract previous rewards. If amount is zero after, replace with end
    ids = newIds; // new uint[](newIds.length);
    amounts = newAmounts; // uint[](newAmounts.length);
    U256 prevNewIdsLength = prevNewIds.length.asU256();
    for (U256 jter; jter < prevNewIdsLength; jter = jter.inc()) {
      uint j = jter.asUint256();
      uint16 prevNewId = uint16(prevNewIds[j]);
      uint24 prevNewAmount = uint24(prevNewAmounts[j]);
      uint length = ids.length;
      for (uint k = 0; k < length; ++k) {
        if (ids[k] == prevNewId) {
          amounts[k] -= prevNewAmount;
          if (amounts[k] == 0) {
            ids[k] = ids[ids.length - 1];
            amounts[k] = amounts[amounts.length - 1];

            assembly ("memory-safe") {
              mstore(ids, length)
              mstore(amounts, length)
            }
            --length;
          }
          break;
        }
      }
    }
  }

  function getCombatStats(
    uint _playerId,
    PendingQueuedActionXPGained memory _pendingQueuedActionXPGained,
    mapping(uint playerId => mapping(Skill skill => uint128 xp)) storage xp_
  ) external view returns (CombatStats memory combatStats) {
    combatStats.melee = int16(
      getLevel(getAbsoluteActionStartXP(_playerId, Skill.MELEE, _pendingQueuedActionXPGained, xp_))
    );
    combatStats.magic = int16(
      getLevel(getAbsoluteActionStartXP(_playerId, Skill.MAGIC, _pendingQueuedActionXPGained, xp_))
    );
    combatStats.health = int16(
      getLevel(getAbsoluteActionStartXP(_playerId, Skill.HEALTH, _pendingQueuedActionXPGained, xp_))
    );
    uint16 defenceLevel = getLevel(
      getAbsoluteActionStartXP(_playerId, Skill.DEFENCE, _pendingQueuedActionXPGained, xp_)
    );
    combatStats.meleeDefence = int16(defenceLevel);
    combatStats.magicDefence = int16(defenceLevel);
  }

  // Subtract any existing xp gained from the first in-progress actions and add the new xp gained
  function getAbsoluteActionStartXP(
    uint _playerId,
    Skill _skill,
    PendingQueuedActionXPGained memory _pendingQueuedActionXPGained,
    mapping(uint playerId => mapping(Skill skill => uint128 xp)) storage xp_
  ) public view returns (uint) {
    uint xp = xp_[_playerId][_skill];
    if (_pendingQueuedActionXPGained.alreadyProcessedSkill == _skill) {
      xp -= _pendingQueuedActionXPGained.alreadyProcessedXPGained;
    } else if (_pendingQueuedActionXPGained.alreadyProcessedSkill1 == _skill) {
      xp -= _pendingQueuedActionXPGained.alreadyProcessedXPGained1;
    }

    // Add any new xp gained from previous actions completed in the queue. For instance
    // battling monsters may increase your level so you are stronger for a later queued action.
    for (uint i; i < _pendingQueuedActionXPGained.skills.length; ++i) {
      if (_pendingQueuedActionXPGained.skills[i] == _skill) {
        xp += _pendingQueuedActionXPGained.xpGainedSkills[i];
      }
    }

    return xp;
  }
}
