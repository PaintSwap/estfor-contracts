// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

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

  error InvalidXPSkill();
  error InvalidAction();

  // Show all the player stats, return metadata json
  function uri(
    string calldata _playerName,
    PackedXP storage _packedXP,
    string calldata _avatarName,
    string calldata _avatarDescription,
    string calldata _imageURI,
    bool _isAlpha,
    uint _playerId,
    string calldata _clanName
  ) external view returns (string memory) {
    uint overallLevel = getLevel(readXP(Skill.MELEE, _packedXP)) +
      getLevel(readXP(Skill.MAGIC, _packedXP)) +
      getLevel(readXP(Skill.DEFENCE, _packedXP)) +
      getLevel(readXP(Skill.HEALTH, _packedXP)) +
      getLevel(readXP(Skill.MINING, _packedXP)) +
      getLevel(readXP(Skill.WOODCUTTING, _packedXP)) +
      getLevel(readXP(Skill.FISHING, _packedXP)) +
      getLevel(readXP(Skill.SMITHING, _packedXP)) +
      getLevel(readXP(Skill.THIEVING, _packedXP)) +
      getLevel(readXP(Skill.CRAFTING, _packedXP)) +
      getLevel(readXP(Skill.COOKING, _packedXP)) +
      getLevel(readXP(Skill.FIREMAKING, _packedXP));

    string memory attributes = string(
      abi.encodePacked(
        _getTraitStringJSON("Avatar", _avatarName),
        ",",
        _getTraitStringJSON("Clan", _clanName),
        ",",
        _getTraitNumberJSON("Melee level", getLevel(readXP(Skill.MELEE, _packedXP))),
        ",",
        _getTraitNumberJSON("Magic level", getLevel(readXP(Skill.MAGIC, _packedXP))),
        ",",
        _getTraitNumberJSON("Defence level", getLevel(readXP(Skill.DEFENCE, _packedXP))),
        ",",
        _getTraitNumberJSON("Health level", getLevel(readXP(Skill.HEALTH, _packedXP))),
        ",",
        _getTraitNumberJSON("Mining level", getLevel(readXP(Skill.MINING, _packedXP))),
        ",",
        _getTraitNumberJSON("Woodcutting level", getLevel(readXP(Skill.WOODCUTTING, _packedXP))),
        ",",
        _getTraitNumberJSON("Fishing level", getLevel(readXP(Skill.FISHING, _packedXP))),
        ",",
        _getTraitNumberJSON("Smithing level", getLevel(readXP(Skill.SMITHING, _packedXP))),
        ",",
        _getTraitNumberJSON("Thieving level", getLevel(readXP(Skill.THIEVING, _packedXP))),
        ",",
        _getTraitNumberJSON("Crafting level", getLevel(readXP(Skill.CRAFTING, _packedXP))),
        ",",
        _getTraitNumberJSON("Cooking level", getLevel(readXP(Skill.COOKING, _packedXP))),
        ",",
        _getTraitNumberJSON("Firemaking level", getLevel(readXP(Skill.FIREMAKING, _packedXP))),
        ",",
        _getTraitNumberJSON("Total level", uint16(overallLevel))
      )
    );

    bytes memory fullName = abi.encodePacked(_playerName, " (", overallLevel.toString(), ")");
    bytes memory externalURL = abi.encodePacked(
      "https://",
      _isAlpha ? "alpha." : "",
      "estfor.com/game/journal/",
      _playerId.toString()
    );

    string memory json = Base64.encode(
      abi.encodePacked(
        '{"name":"',
        fullName,
        '","description":"',
        _avatarDescription,
        '","attributes":[',
        attributes,
        '],"image":"',
        _imageURI,
        '", "external_url":"',
        externalURL,
        '"}'
      )
    );

    return string(abi.encodePacked("data:application/json;base64,", json));
  }

  function _getTraitStringJSON(string memory _traitType, string memory _value) private pure returns (bytes memory) {
    return abi.encodePacked(_getTraitTypeJSON(_traitType), '"', _value, '"}');
  }

  function _getTraitNumberJSON(string memory _traitType, uint32 _value) private pure returns (bytes memory) {
    return abi.encodePacked(_getTraitTypeJSON(_traitType), _value.toString(), "}");
  }

  function _getTraitTypeJSON(string memory _traitType) private pure returns (bytes memory) {
    return abi.encodePacked('{"trait_type":"', _traitType, '","value":');
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
    PendingQueuedActionEquipmentState[] calldata _pendingQueuedActionEquipmentStates
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
    PendingQueuedActionEquipmentState[] calldata _pendingQueuedActionEquipmentStates
  ) public view returns (uint balance) {
    balance = _getRealBalance(_itemNFT.balanceOf(_from, _itemId), _itemId, _pendingQueuedActionEquipmentStates);
  }

  function getRealBalances(
    address _from,
    uint16[] memory _itemIds,
    ItemNFT _itemNFT,
    PendingQueuedActionEquipmentState[] calldata _pendingQueuedActionEquipmentStates
  ) public view returns (uint[] memory balances) {
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
    CombatStats calldata _combatStats,
    CombatStats calldata _enemyCombatStats,
    uint8 _alphaCombat,
    uint8 _betaCombat,
    PendingQueuedActionEquipmentState[] calldata _pendingQueuedActionEquipmentStates
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
      foodConsumed = uint24(Math.ceilDiv(uint32(totalHealthLost), healthRestored));
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
    PendingQueuedActionEquipmentState[] calldata _pendingQueuedActionEquipmentStates
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
    PendingQueuedActionEquipmentState[] calldata _pendingQueuedActionEquipmentStates
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
  ) private pure returns (uint) {
    // Formula is max(1, a(atk) + b(2 * atk - def))
    // Always do at least 1 damage per minute
    uint dmgPerMinute = uint(_max(1, int128(attack) * int8(_alphaCombat) + (attack * 2 - defence) * int8(_betaCombat)));
    return Math.ceilDiv(uint(uint16(_enemyHealth)) * 60, dmgPerMinute);
  }

  function _getTimeToKill(
    ActionChoice memory _actionChoice,
    CombatStats memory _combatStats,
    CombatStats memory _enemyCombatStats,
    uint8 _alphaCombat,
    uint8 _betaCombat,
    int16 _enemyHealth
  ) private pure returns (uint timeToKill) {
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
    }
  }

  function _getDmg(
    ActionChoice calldata _actionChoice,
    CombatStats memory _combatStats,
    CombatStats calldata _enemyCombatStats,
    uint8 _alphaCombat,
    uint8 _betaCombat,
    uint _elapsedTime
  ) private pure returns (uint32 dmgDealt) {
    if (_actionChoice.skill == Skill.MELEE) {
      dmgDealt = _dmg(_combatStats.melee, _enemyCombatStats.meleeDefence, _alphaCombat, _betaCombat, _elapsedTime);
    } else if (_actionChoice.skill == Skill.MAGIC) {
      _combatStats.magic += int16(_actionChoice.diff); // Extra magic damage
      dmgDealt = _dmg(_combatStats.magic, _enemyCombatStats.magicDefence, _alphaCombat, _betaCombat, _elapsedTime);
    }
  }

  function getCombatAdjustedElapsedTimes(
    address _from,
    ItemNFT _itemNFT,
    World _world,
    uint _elapsedTime,
    ActionChoice calldata _actionChoice,
    bool _checkBalance,
    QueuedAction calldata _queuedAction,
    CombatStats memory _combatStats,
    CombatStats calldata _enemyCombatStats,
    uint8 _alphaCombat,
    uint8 _betaCombat,
    PendingQueuedActionEquipmentState[] calldata _pendingQueuedActionEquipmentStates
  ) external view returns (uint xpElapsedTime, uint combatElapsedTime, uint16 numConsumed) {
    uint numSpawnedPerHour = _world.getNumSpawn(_queuedAction.actionId);
    uint respawnTime = (3600 * SPAWN_MUL) / numSpawnedPerHour;
    uint32 dmgDealt = _getDmg(_actionChoice, _combatStats, _enemyCombatStats, _alphaCombat, _betaCombat, respawnTime);

    uint numKilled;
    if (dmgDealt > uint16(_enemyCombatStats.health)) {
      // Are able to kill them all, but how many can we kill in the time that has elapsed?
      numKilled = (_elapsedTime * numSpawnedPerHour) / (3600 * SPAWN_MUL);
      uint combatTimePerEnemy = Math.ceilDiv(uint16(_enemyCombatStats.health) * respawnTime, dmgDealt);
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
      combatElapsedTime = _elapsedTime; // How much time was spent in combat
    }

    xpElapsedTime = respawnTime * numKilled;

    // Check how many to consume, and also adjust xpElapsedTime if they don't have enough consumables
    numConsumed = uint16(Math.ceilDiv(combatElapsedTime * _actionChoice.rate, 3600 * RATE_MUL));
    if (_actionChoice.rate != 0) {
      numConsumed = uint16(Math.max(numKilled, numConsumed));
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
    ActionChoice calldata _actionChoice,
    bool _checkBalance,
    PendingQueuedActionEquipmentState[] calldata _pendingQueuedActionEquipmentStates
  ) external view returns (uint xpElapsedTime, uint24 numConsumed) {
    // Check the max that can be used
    numConsumed = uint24((_elapsedTime * _actionChoice.rate) / (3600 * RATE_MUL));

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
    xpElapsedTime = (uint(numConsumed) * 3600 * RATE_MUL) / _actionChoice.rate;
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

  function _extraXPFromBoost(
    bool _isCombatSkill,
    uint _actionStartTime,
    uint _elapsedTime,
    uint24 _xpPerHour,
    PlayerBoostInfo storage activeBoost
  ) private view returns (uint32 boostPointsAccrued) {
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
    uint16[5] calldata expectedItemTokenIds
  ) public pure returns (bool matches) {
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

  function readXP(Skill _skill, PackedXP storage _packedXP) internal view returns (uint) {
    if (_skill == Skill.COMBAT) {
      revert InvalidXPSkill();
    }
    if (_skill == Skill.NONE) {
      return 0;
    }
    uint offset = 2; // Accounts for NONE & COMBAT skills
    uint val = uint8(_skill) - offset;
    uint slotNum = val / 6;
    uint relativePos = val % 6;

    uint slotVal;
    assembly ("memory-safe") {
      slotVal := sload(add(_packedXP.slot, slotNum))
    }

    return uint40(slotVal >> (relativePos * 40));
  }

  function getCombatStats(
    PendingQueuedActionXPGained calldata _pendingQueuedActionXPGained,
    PackedXP storage _packedXP,
    address _from,
    ItemNFT _itemNFT,
    Attire storage _attire,
    PendingQueuedActionEquipmentState[] calldata _pendingQueuedActionEquipmentStates
  ) external view returns (CombatStats memory combatStats) {
    combatStats.melee = int16(getLevel(getAbsoluteActionStartXP(Skill.MELEE, _pendingQueuedActionXPGained, _packedXP)));
    combatStats.magic = int16(getLevel(getAbsoluteActionStartXP(Skill.MAGIC, _pendingQueuedActionXPGained, _packedXP)));
    combatStats.health = int16(
      getLevel(getAbsoluteActionStartXP(Skill.HEALTH, _pendingQueuedActionXPGained, _packedXP))
    );
    uint16 defenceLevel = getLevel(getAbsoluteActionStartXP(Skill.DEFENCE, _pendingQueuedActionXPGained, _packedXP));
    combatStats.meleeDefence = int16(defenceLevel);
    combatStats.magicDefence = int16(defenceLevel);

    bool skipNeck;
    (uint16[] memory itemTokenIds, uint[] memory balances) = getAttireWithBalance(
      _from,
      _attire,
      _itemNFT,
      skipNeck,
      _pendingQueuedActionEquipmentStates
    );
    if (itemTokenIds.length != 0) {
      Item[] memory items = _itemNFT.getItems(itemTokenIds);
      U256 iter = items.length.asU256();
      while (iter.neq(0)) {
        iter = iter.dec();
        uint i = iter.asUint256();
        if (balances[i] != 0) {
          _updateCombatStatsFromItem(combatStats, items[i]);
        }
      }
    }
  }

  function getAttireWithBalance(
    address _from,
    Attire storage _attire,
    ItemNFT _itemNFT,
    bool _skipNeck,
    PendingQueuedActionEquipmentState[] calldata _pendingQueuedActionEquipmentStates
  ) public view returns (uint16[] memory itemTokenIds, uint[] memory balances) {
    uint attireLength;
    itemTokenIds = new uint16[](6);
    if (_attire.head != NONE) {
      itemTokenIds[attireLength++] = _attire.head;
    }
    if (_attire.neck != NONE && !_skipNeck) {
      itemTokenIds[attireLength++] = _attire.neck;
    }
    if (_attire.body != NONE) {
      itemTokenIds[attireLength++] = _attire.body;
    }
    if (_attire.arms != NONE) {
      itemTokenIds[attireLength++] = _attire.arms;
    }
    if (_attire.legs != NONE) {
      itemTokenIds[attireLength++] = _attire.legs;
    }
    if (_attire.feet != NONE) {
      itemTokenIds[attireLength++] = _attire.feet;
    }

    assembly ("memory-safe") {
      mstore(itemTokenIds, attireLength)
    }

    if (attireLength != 0) {
      balances = getRealBalances(_from, itemTokenIds, _itemNFT, _pendingQueuedActionEquipmentStates);
    }
  }

  // Subtract any existing xp gained from the first in-progress actions and add the new xp gained
  function getAbsoluteActionStartXP(
    Skill _skill,
    PendingQueuedActionXPGained calldata _pendingQueuedActionXPGained,
    PackedXP storage packedXP
  ) public view returns (uint) {
    uint xp = readXP(_skill, packedXP);
    if (_pendingQueuedActionXPGained.prevProcessedSkill == _skill) {
      xp -= _pendingQueuedActionXPGained.prevProcessedXPGained;
    } else if (_pendingQueuedActionXPGained.prevProcessedSkill1 == _skill) {
      xp -= _pendingQueuedActionXPGained.prevProcessedXPGained1;
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

  function updateStatsFromHandEquipment(
    address _from,
    ItemNFT _itemNFT,
    uint16[2] calldata _handEquipmentTokenIds,
    CombatStats calldata _combatStats,
    bool _isCombat,
    PendingQueuedActionEquipmentState[] calldata _pendingQueuedActionEquipmentStates
  ) external view returns (bool missingRequiredHandEquipment, CombatStats memory combatStats) {
    U256 iter = _handEquipmentTokenIds.length.asU256();
    combatStats = _combatStats;
    while (iter.neq(0)) {
      iter = iter.dec();
      uint16 i = iter.asUint16();
      uint16 handEquipmentTokenId = _handEquipmentTokenIds[i];
      if (handEquipmentTokenId != NONE) {
        uint256 balance = getRealBalance(_from, handEquipmentTokenId, _itemNFT, _pendingQueuedActionEquipmentStates);
        if (balance == 0) {
          // Assume that if the player doesn't have the non-combat item that this action cannot be done
          if (!_isCombat) {
            missingRequiredHandEquipment = true;
          }
        } else if (_isCombat) {
          // Update the combat stats
          Item memory item = _itemNFT.getItem(handEquipmentTokenId);
          _updateCombatStatsFromItem(combatStats, item);
        }
      }
    }
  }

  function _updateCombatStatsFromItem(CombatStats memory _combatStats, Item memory _item) private pure {
    if (_item.melee != 0) {
      _combatStats.melee += _item.melee;
    }
    if (_item.magic != 0) {
      _combatStats.magic += _item.magic;
    }
    if (_item.meleeDefence != 0) {
      _combatStats.meleeDefence += _item.meleeDefence;
    }
    if (_item.magicDefence != 0) {
      _combatStats.magicDefence += _item.magicDefence;
    }
    if (_item.health != 0) {
      _combatStats.health += _item.health;
    }
  }

  function getBonusAvatarXPPercent(Player storage _player, Skill _skill) public view returns (uint8 bonusPercent) {
    bool hasBonusSkill = _player.skillBoosted1 == _skill || _player.skillBoosted2 == _skill;
    if (!hasBonusSkill) {
      return 0;
    }
    bool bothSet = _player.skillBoosted1 != Skill.NONE && _player.skillBoosted2 != Skill.NONE;
    bonusPercent = bothSet ? 5 : 10;
  }

  function _extraFromAvatar(
    Player storage _player,
    Skill _skill,
    uint _elapsedTime,
    uint24 _xpPerHour
  ) internal view returns (uint32 extraPointsAccrued) {
    uint8 bonusPercent = getBonusAvatarXPPercent(_player, _skill);
    extraPointsAccrued = uint32((_elapsedTime * _xpPerHour * bonusPercent) / (3600 * 100));
  }

  function getPointsAccrued(
    address _from,
    Player storage _player,
    QueuedAction storage _queuedAction,
    uint _startTime,
    Skill _skill,
    uint _xpElapsedTime,
    Attire storage _attire,
    PlayerBoostInfo storage _activeBoost,
    ItemNFT _itemNFT,
    World _world,
    uint8 _bonusAttirePercent,
    uint16[5] calldata _expectedItemTokenIds,
    PendingQueuedActionEquipmentState[] calldata _pendingQueuedActionEquipmentStates
  ) external view returns (uint32 pointsAccrued, uint32 pointsAccruedExclBaseBoost) {
    bool _isCombatSkill = _queuedAction.combatStyle != CombatStyle.NONE;
    uint24 xpPerHour = _world.getXPPerHour(_queuedAction.actionId, _isCombatSkill ? NONE : _queuedAction.choiceId);
    pointsAccrued = uint32((_xpElapsedTime * xpPerHour) / 3600);
    pointsAccrued += _extraXPFromBoost(_isCombatSkill, _startTime, _xpElapsedTime, xpPerHour, _activeBoost);
    pointsAccrued += _extraXPFromFullAttire(
      _from,
      _attire,
      _xpElapsedTime,
      xpPerHour,
      _itemNFT,
      _bonusAttirePercent,
      _expectedItemTokenIds,
      _pendingQueuedActionEquipmentStates
    );
    pointsAccruedExclBaseBoost = pointsAccrued;
    pointsAccrued += _extraFromAvatar(_player, _skill, _xpElapsedTime, xpPerHour);
  }

  function _extraXPFromFullAttire(
    address _from,
    Attire storage _attire,
    uint _elapsedTime,
    uint24 _xpPerHour,
    ItemNFT _itemNFT,
    uint8 _bonusPercent,
    uint16[5] calldata _expectedItemTokenIds,
    PendingQueuedActionEquipmentState[] calldata _pendingQueuedActionEquipmentStates
  ) internal view returns (uint32 extraPointsAccrued) {
    if (_bonusPercent == 0) {
      return 0;
    }

    // Check if they have the full equipment set, if so they can get some bonus
    bool skipNeck = true;
    (uint16[] memory itemTokenIds, uint[] memory balances) = getAttireWithBalance(
      _from,
      _attire,
      _itemNFT,
      skipNeck,
      _pendingQueuedActionEquipmentStates
    );
    bool hasFullAttire = extraBoostFromFullAttire(itemTokenIds, balances, _expectedItemTokenIds);
    if (hasFullAttire) {
      extraPointsAccrued = uint32((_elapsedTime * _xpPerHour * _bonusPercent) / (3600 * 100));
    }
  }

  function getSuccessPercent(
    uint16 _actionId,
    Skill _actionSkill,
    bool _isCombat,
    PendingQueuedActionXPGained calldata _pendingQueuedActionXPGained,
    World _world,
    uint _maxSuccessPercentChange,
    PackedXP storage _packedXP
  ) external view returns (uint8 successPercent) {
    successPercent = 100;
    (uint8 actionSuccessPercent, uint32 minXP) = _world.getActionSuccessPercentAndMinXP(_actionId);
    if (actionSuccessPercent != 100) {
      if (_isCombat) {
        revert InvalidAction();
      }

      uint minLevel = getLevel(minXP);
      uint skillLevel = getLevel(getAbsoluteActionStartXP(_actionSkill, _pendingQueuedActionXPGained, _packedXP));
      uint extraBoost = skillLevel - minLevel;

      successPercent = uint8(Math.min(_maxSuccessPercentChange, actionSuccessPercent + extraBoost));
    }
  }
}
