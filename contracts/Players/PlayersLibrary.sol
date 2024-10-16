// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

import {UnsafeMath, U256} from "@0xdoublesharp/unsafe-math/contracts/UnsafeMath.sol";
import {IItemNFT} from "../interfaces/IItemNFT.sol";
import {World} from "../World.sol";

import {CombatStyleLibrary} from "../CombatStyleLibrary.sol";
import {SkillLibrary} from "../SkillLibrary.sol";

// solhint-disable-next-line no-global-import
import "../globals/all.sol";

// This file contains methods for interacting with the player that is used to decrease implementation deployment bytecode code.
library PlayersLibrary {
  using UnsafeMath for U256;
  using UnsafeMath for uint256;
  using CombatStyleLibrary for uint8;
  using SkillLibrary for uint8;

  error InvalidXPSkill();
  error InvalidAction();
  error SkillForPetNotHandledYet();

  // This is to prevent some precision loss in the healing calculations
  uint256 constant HEALING_SCALE = 1_000_000;

  function _getLevel(uint256 _xp) internal pure returns (uint16) {
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

  function getLevel(uint256 _xp) external pure returns (uint16) {
    return _getLevel(_xp);
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
    uint256 _originalBalance,
    uint256 _itemId,
    PendingQueuedActionEquipmentState[] calldata _pendingQueuedActionEquipmentStates
  ) private pure returns (uint256 balance) {
    balance = _originalBalance;
    U256 bounds = _pendingQueuedActionEquipmentStates.length.asU256();
    for (U256 iter; iter < bounds; iter = iter.inc()) {
      uint256 i = iter.asUint256();
      PendingQueuedActionEquipmentState memory pendingQueuedActionEquipmentState = _pendingQueuedActionEquipmentStates[
        i
      ];
      U256 jBounds = pendingQueuedActionEquipmentState.producedItemTokenIds.length.asU256();
      for (U256 jIter; jIter < jBounds; jIter = jIter.inc()) {
        uint256 j = jIter.asUint256();
        if (pendingQueuedActionEquipmentState.producedItemTokenIds[j] == _itemId) {
          balance += pendingQueuedActionEquipmentState.producedAmounts[j];
        }
      }
      jBounds = pendingQueuedActionEquipmentState.consumedItemTokenIds.length.asU256();
      for (U256 jIter; jIter < jBounds; jIter = jIter.inc()) {
        uint256 j = jIter.asUint256();
        if (pendingQueuedActionEquipmentState.consumedItemTokenIds[j] == _itemId) {
          if (balance >= pendingQueuedActionEquipmentState.consumedAmounts[j]) {
            balance -= pendingQueuedActionEquipmentState.consumedAmounts[j];
          } else {
            balance = 0;
          }
        }
      }
    }
  }

  // This takes into account any intermediate changes from previous actions from view functions
  // as those cannot affect the blockchain state with balanceOf
  function getRealBalance(
    address _from,
    uint256 _itemId,
    address _itemNFTAddress,
    PendingQueuedActionEquipmentState[] calldata _pendingQueuedActionEquipmentStates
  ) public view returns (uint256 balance) {
    balance = _getRealBalance(
      IItemNFT(_itemNFTAddress).balanceOf(_from, _itemId),
      _itemId,
      _pendingQueuedActionEquipmentStates
    );
  }

  function getRealBalances(
    address _from,
    uint16[] memory _itemIds,
    address _itemNFTAddress,
    PendingQueuedActionEquipmentState[] calldata _pendingQueuedActionEquipmentStates
  ) public view returns (uint256[] memory balances) {
    balances = IItemNFT(_itemNFTAddress).balanceOfs(_from, _itemIds);

    U256 bounds = balances.length.asU256();
    for (U256 iter; iter < bounds; iter = iter.inc()) {
      uint256 i = iter.asUint256();
      balances[i] = _getRealBalance(balances[i], _itemIds[i], _pendingQueuedActionEquipmentStates);
    }
  }

  function _getMaxRequiredRatio(
    address _from,
    ActionChoice memory _actionChoice,
    uint16 _baseInputItemsConsumedNum,
    IItemNFT _itemNFT,
    PendingQueuedActionEquipmentState[] calldata _pendingQueuedActionEquipmentStates
  ) private view returns (uint256 maxRequiredRatio) {
    maxRequiredRatio = _baseInputItemsConsumedNum;

    bool useSecondInputTokens = uint8(
      _actionChoice.packedData >> ACTION_CHOICE_USE_ALTERNATE_INPUTS_SECOND_STORAGE_SLOT
    ) &
      1 ==
      1;

    if (_baseInputItemsConsumedNum != 0) {
      if (_actionChoice.inputTokenId1 != 0) {
        maxRequiredRatio = _getMaxRequiredRatioPartial(
          _from,
          _actionChoice.inputTokenId1,
          useSecondInputTokens ? _actionChoice.newInputAmount1 : _actionChoice.inputAmount1,
          maxRequiredRatio,
          _itemNFT,
          _pendingQueuedActionEquipmentStates
        );
      }
      if (_actionChoice.inputTokenId2 != 0) {
        maxRequiredRatio = _getMaxRequiredRatioPartial(
          _from,
          _actionChoice.inputTokenId2,
          useSecondInputTokens ? _actionChoice.newInputAmount2 : _actionChoice.inputAmount2,
          maxRequiredRatio,
          _itemNFT,
          _pendingQueuedActionEquipmentStates
        );
      }
      if (_actionChoice.inputTokenId3 != 0) {
        maxRequiredRatio = _getMaxRequiredRatioPartial(
          _from,
          _actionChoice.inputTokenId3,
          useSecondInputTokens ? _actionChoice.newInputAmount3 : _actionChoice.inputAmount3,
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
    uint256 _inputAmount,
    uint256 _prevConsumeMaxRatio,
    IItemNFT _itemNFT,
    PendingQueuedActionEquipmentState[] calldata _pendingQueuedActionEquipmentStates
  ) private view returns (uint256 maxRequiredRatio) {
    uint256 balance = getRealBalance(_from, _inputTokenId, address(_itemNFT), _pendingQueuedActionEquipmentStates);
    uint256 tempMaxRequiredRatio = balance / _inputAmount;
    if (tempMaxRequiredRatio < _prevConsumeMaxRatio) {
      maxRequiredRatio = tempMaxRequiredRatio;
    } else {
      maxRequiredRatio = _prevConsumeMaxRatio;
    }
  }

  function _max(int a, int b) private pure returns (int) {
    return a > b ? a : b;
  }

  function _dmgPerMinute(
    int _attack,
    int _defence,
    uint8 _alphaCombat,
    uint8 _betaCombat
  ) private pure returns (uint256) {
    if (_attack == 0) {
      return 0;
    }
    // Negative defence is capped at the negative of the attack value.
    // So an attack of 10 and defence of -15 is the same as attack -10.
    _defence = _max(-_attack, _defence);
    return uint256(_max(1, int128(_attack) * int8(_alphaCombat) + (_attack * 2 - _defence) * int8(_betaCombat)));
  }

  function dmg(
    int _attack,
    int _defence,
    uint8 _alphaCombat,
    uint8 _betaCombat,
    uint256 _elapsedTime
  ) public pure returns (uint32) {
    return uint32((_dmgPerMinute(_attack, _defence, _alphaCombat, _betaCombat) * _elapsedTime) / 60);
  }

  function _fullDmg(
    CombatStats calldata _combatStats,
    CombatStats memory _enemyCombatStats,
    uint8 _alphaCombat,
    uint8 _betaCombat,
    uint256 _elapsedTime
  ) private pure returns (uint32 fullDmg) {
    fullDmg = dmg(_combatStats.melee, _enemyCombatStats.meleeDefence, _alphaCombat, _betaCombat, _elapsedTime);
    fullDmg += dmg(_combatStats.ranged, _enemyCombatStats.rangedDefence, _alphaCombat, _betaCombat, _elapsedTime);
    fullDmg += dmg(_combatStats.magic, _enemyCombatStats.magicDefence, _alphaCombat, _betaCombat, _elapsedTime);
  }

  function _timeToKill(
    int _attack,
    int _defence,
    uint8 _alphaCombat,
    uint8 _betaCombat,
    int16 _enemyHealth
  ) private pure returns (uint256) {
    // Formula is max(1, a(atk) + b(2 * atk - def))
    // Always do at least 1 damage per minute
    uint256 dmgPerMinute = _dmgPerMinute(_attack, _defence, _alphaCombat, _betaCombat);
    return Math.ceilDiv(uint256(uint16(_enemyHealth)) * 60, dmgPerMinute);
  }

  function _timeToKillPlayer(
    CombatStats memory _combatStats,
    CombatStats memory _enemyCombatStats,
    uint8 _alphaCombat,
    uint8 _betaCombat,
    int _health
  ) private pure returns (uint256) {
    uint256 dmgPerMinute = _dmgPerMinute(_enemyCombatStats.melee, _combatStats.meleeDefence, _alphaCombat, _betaCombat);
    dmgPerMinute += _dmgPerMinute(_enemyCombatStats.ranged, _combatStats.rangedDefence, _alphaCombat, _betaCombat);
    dmgPerMinute += _dmgPerMinute(_enemyCombatStats.magic, _combatStats.magicDefence, _alphaCombat, _betaCombat);
    return Math.ceilDiv(uint256(_health) * 60, dmgPerMinute);
  }

  function _getTimeToKill(
    Skill _skill,
    CombatStats memory _combatStats,
    CombatStats memory _enemyCombatStats,
    uint8 _alphaCombat,
    uint8 _betaCombat,
    int16 _enemyHealth
  ) private pure returns (uint256 timeToKill) {
    int16 attack;
    int16 defence;
    if (_skill == Skill.MELEE) {
      attack = _combatStats.melee;
      defence = _enemyCombatStats.meleeDefence;
    } else if (_skill == Skill.RANGED) {
      attack = _combatStats.ranged;
      defence = _enemyCombatStats.rangedDefence;
    } else if (_skill == Skill.MAGIC || _skill == Skill.DEFENCE || _skill == Skill.HEALTH) {
      attack = _combatStats.magic;
      defence = _enemyCombatStats.magicDefence;
    } else {
      assert(false);
    }

    timeToKill = _timeToKill(attack, defence, _alphaCombat, _betaCombat, _enemyHealth);
  }

  function _getDmgDealtByPlayer(
    ActionChoice calldata _actionChoice,
    CombatStats memory _combatStats,
    CombatStats calldata _enemyCombatStats,
    uint8 _alphaCombat,
    uint8 _betaCombat,
    uint256 _elapsedTime
  ) private pure returns (uint32 dmgDealt) {
    Skill skill = Skill(_actionChoice.skill);
    if (skill == Skill.MELEE) {
      dmgDealt = dmg(_combatStats.melee, _enemyCombatStats.meleeDefence, _alphaCombat, _betaCombat, _elapsedTime);
    } else if (skill == Skill.RANGED) {
      dmgDealt = dmg(_combatStats.ranged, _enemyCombatStats.rangedDefence, _alphaCombat, _betaCombat, _elapsedTime);
    } else if (skill == Skill.MAGIC || skill == Skill.DEFENCE || skill == Skill.HEALTH) {
      // Assumes this is a magic action
      dmgDealt = dmg(_combatStats.magic, _enemyCombatStats.magicDefence, _alphaCombat, _betaCombat, _elapsedTime);
    } else {
      assert(false);
    }
  }

  function getCombatAdjustedElapsedTimes(
    address _from,
    address _itemNFTAddress,
    address _worldAddress,
    uint256 _elapsedTime,
    ActionChoice calldata _actionChoice,
    uint16 _regenerateId,
    QueuedAction calldata _queuedAction,
    CombatStats memory _combatStats,
    CombatStats calldata _enemyCombatStats,
    uint8 _alphaCombat,
    uint8 _betaCombat,
    uint8 _alphaCombatHealing,
    PendingQueuedActionEquipmentState[] calldata _pendingQueuedActionEquipmentStates
  )
    external
    view
    returns (
      uint256 xpElapsedTime,
      uint256 combatElapsedTime,
      uint16 baseInputItemsConsumedNum,
      uint16 foodConsumed,
      bool died
    )
  {
    return
      _getCombatAdjustedElapsedTimes(
        _from,
        _itemNFTAddress,
        _worldAddress,
        _elapsedTime,
        _actionChoice,
        _regenerateId,
        _queuedAction,
        _combatStats,
        _enemyCombatStats,
        _alphaCombat,
        _betaCombat,
        _alphaCombatHealing,
        _pendingQueuedActionEquipmentStates
      );
  }

  function _getCombatAdjustedElapsedTimes(
    address _from,
    address _itemNFTAddress,
    address _worldAddress,
    uint256 _elapsedTime,
    ActionChoice calldata _actionChoice,
    uint16 _regenerateId,
    QueuedAction calldata _queuedAction,
    CombatStats memory _combatStats,
    CombatStats calldata _enemyCombatStats,
    uint8 _alphaCombat,
    uint8 _betaCombat,
    uint8 _alphaCombatHealing,
    PendingQueuedActionEquipmentState[] calldata _pendingQueuedActionEquipmentStates
  )
    private
    view
    returns (
      uint256 xpElapsedTime,
      uint256 combatElapsedTime,
      uint16 baseInputItemsConsumedNum,
      uint16 foodConsumed,
      bool died
    )
  {
    World _world = World(_worldAddress);
    uint256 numSpawnedPerHour = _world.getNumSpawn(_queuedAction.actionId);
    uint256 respawnTime = (3600 * SPAWN_MUL) / numSpawnedPerHour;
    uint32 dmgDealt = _getDmgDealtByPlayer(
      _actionChoice,
      _combatStats,
      _enemyCombatStats,
      _alphaCombat,
      _betaCombat,
      respawnTime
    );

    uint256 combatTimePerKill = _getTimeToKill(
      _actionChoice.skill.asSkill(),
      _combatStats,
      _enemyCombatStats,
      _alphaCombat,
      _betaCombat,
      _enemyCombatStats.health
    );

    // Steps for this:
    // 1 - Work out best case scenario for how many we can kill in the elapsed time assuming we have enough food and consumables
    // 2 - Now work out how many we can kill in the combat time based on how many consumables we actually have
    // 3 - Now work out how many we can kill in the elapsed time based on how much food we actually have and adjust combat time
    // 3.5 - If not enough food (i.e died) then backtrack the scrolls.

    // Time spent in comabt with the enemies that were killed, needed in case foodConsumed gets maxed out
    uint256 combatElapsedTimeKilling;
    // Step 1 - Best case scenario how many we can kill
    uint256 numKilled;
    bool canKillAll = dmgDealt > uint16(_enemyCombatStats.health);
    if (canKillAll) {
      // But how many can we kill in the time that has elapsed?
      numKilled = (_elapsedTime * numSpawnedPerHour) / (3600 * SPAWN_MUL);
      uint256 combatTimePerEnemy = Math.ceilDiv(uint16(_enemyCombatStats.health) * respawnTime, dmgDealt);
      combatElapsedTime = combatTimePerEnemy * numKilled;
      combatElapsedTimeKilling = combatElapsedTime;
      // Add remainder combat time to current monster you are fighting
      combatElapsedTime += Math.min(combatTimePerEnemy, _elapsedTime - respawnTime * numKilled);
    } else {
      numKilled = _elapsedTime / combatTimePerKill;
      combatElapsedTimeKilling = combatTimePerKill * numKilled;
      combatElapsedTime = _elapsedTime;
    }

    xpElapsedTime = respawnTime * numKilled;

    // Step 2 - Work out how many consumables are used
    // Check how many to consume, and also adjust xpElapsedTime if they don't have enough consumables
    baseInputItemsConsumedNum = uint16(Math.ceilDiv(combatElapsedTime * _actionChoice.rate, 3600 * RATE_MUL));
    if (_actionChoice.rate != 0) {
      baseInputItemsConsumedNum = uint16(Math.max(numKilled, baseInputItemsConsumedNum));
    }
    uint256 maxRequiredBaseInputItemsConsumedRatio = baseInputItemsConsumedNum;
    if (baseInputItemsConsumedNum != 0) {
      // This checks the balances
      maxRequiredBaseInputItemsConsumedRatio = _getMaxRequiredRatio(
        _from,
        _actionChoice,
        baseInputItemsConsumedNum,
        IItemNFT(_itemNFTAddress),
        _pendingQueuedActionEquipmentStates
      );

      if (baseInputItemsConsumedNum > maxRequiredBaseInputItemsConsumedRatio) {
        // How many can we kill with the consumables we do have
        numKilled = (numKilled * maxRequiredBaseInputItemsConsumedRatio) / baseInputItemsConsumedNum;
        xpElapsedTime = respawnTime * numKilled;

        if (canKillAll) {
          uint256 combatTimePerEnemy = Math.ceilDiv(uint16(_enemyCombatStats.health) * respawnTime, dmgDealt);
          combatElapsedTime = combatTimePerEnemy * numKilled;
          combatElapsedTimeKilling = combatElapsedTime;
          combatElapsedTime += _elapsedTime - (respawnTime * numKilled); // Plus fighting the one you haven't killed
        } else {
          // In combat the entire time
          combatElapsedTime = _elapsedTime;
          combatElapsedTimeKilling = combatTimePerKill * numKilled;
        }
        baseInputItemsConsumedNum = uint16(maxRequiredBaseInputItemsConsumedRatio);
      }
    } else if (_actionChoice.rate != 0) {
      // Requires input items but we don't have any. In combat the entire time getting rekt
      xpElapsedTime = 0;
      combatElapsedTime = _elapsedTime;
    }

    // Step 3 - Work out how much food is needed. If you die then work out how many consumables you actually used as in combat you died before you could cast more.
    uint32 totalHealthLost = _fullDmg(_enemyCombatStats, _combatStats, _alphaCombat, _betaCombat, combatElapsedTime);

    uint32 playerHealth = uint16(int16(_max(0, _combatStats.health)));
    if (int32(totalHealthLost) > _combatStats.health) {
      // Take away our health points from the total dealt
      totalHealthLost -= playerHealth;
    } else {
      totalHealthLost = 0;
    }

    uint32 totalHealthLostOnlyKilled = _fullDmg(
      _enemyCombatStats,
      _combatStats,
      _alphaCombat,
      _betaCombat,
      combatElapsedTimeKilling
    );

    if (int32(totalHealthLostOnlyKilled) > _combatStats.health) {
      // Take away our health points from the total dealt
      totalHealthLostOnlyKilled -= playerHealth;
    } else {
      totalHealthLostOnlyKilled = 0;
    }

    uint256 totalFoodRequiredKilling;
    (foodConsumed, totalFoodRequiredKilling, died) = _getFoodConsumed(
      _from,
      _regenerateId,
      totalHealthLost,
      totalHealthLostOnlyKilled,
      playerHealth,
      _alphaCombatHealing,
      _itemNFTAddress,
      _pendingQueuedActionEquipmentStates
    );

    // Didn't have enough food to survive the best case combat scenario
    if (died) {
      uint256 healthRestored;
      if (_regenerateId != NONE) {
        Item memory item = IItemNFT(_itemNFTAddress).getItem(_regenerateId);
        healthRestored = item.healthRestored;
      }

      uint256 totalHealth = uint16(_combatStats.health) + foodConsumed * healthRestored;
      // How much combat time is required to kill the player
      uint256 killPlayerTime = _timeToKillPlayer(
        _combatStats,
        _enemyCombatStats,
        _alphaCombat,
        _betaCombat,
        int(totalHealth)
      );

      combatElapsedTime = Math.min(combatElapsedTime, killPlayerTime); // Needed?
      if (healthRestored == 0 || totalHealthLost <= 0) {
        // No food attached or didn't lose any health

        if (canKillAll) {
          uint256 combatTimePerEnemy = Math.ceilDiv(uint16(_enemyCombatStats.health) * respawnTime, dmgDealt);
          numKilled = combatElapsedTime / combatTimePerEnemy;
        } else {
          // In combat the entire time
          numKilled = combatElapsedTime / combatTimePerKill;
        }
      } else {
        // How many can we kill with the food we did consume
        if (totalFoodRequiredKilling > 0) {
          if (foodConsumed < totalFoodRequiredKilling) {
            numKilled = (numKilled * foodConsumed) / totalFoodRequiredKilling;
          }
        } else {
          numKilled = 0;
        }
      }
      xpElapsedTime = respawnTime * numKilled;

      // Step 3.5 - Wasn't enough food, so work out how many consumables we actually used.
      if (_actionChoice.rate != 0) {
        baseInputItemsConsumedNum = uint16(Math.ceilDiv(combatElapsedTime * _actionChoice.rate, 3600 * RATE_MUL));
        // Make sure we use at least 1 per kill
        baseInputItemsConsumedNum = uint16(Math.max(numKilled, baseInputItemsConsumedNum));

        // Make sure we don't go above the maximum amount of consumables (scrolls/arrows) that we actually have
        if (baseInputItemsConsumedNum > maxRequiredBaseInputItemsConsumedRatio) {
          uint256 newMaxRequiredBaseInputItemsConsumedRatio = _getMaxRequiredRatio(
            _from,
            _actionChoice,
            baseInputItemsConsumedNum,
            IItemNFT(_itemNFTAddress),
            _pendingQueuedActionEquipmentStates
          );

          baseInputItemsConsumedNum = uint16(
            Math.min(baseInputItemsConsumedNum, newMaxRequiredBaseInputItemsConsumedRatio)
          );
        }
      }
    }
  }

  function _calculateHealingDoneFromHealth(
    uint256 _health,
    uint256 _alphaCombatHealing
  ) private pure returns (uint256 healingDoneFromHealth) {
    // healing fraction = 1 + (alphaCombatHealing * health / 100)
    uint256 scaledHealth = ((HEALING_SCALE * _alphaCombatHealing) / 100) * _health;
    uint256 divisor = 100;
    healingDoneFromHealth = HEALING_SCALE + scaledHealth / divisor;
  }

  function _calculateTotalFoodRequired(
    uint256 _totalHealthLost,
    uint256 _healthRestoredFromItem,
    uint256 _healingDoneFromHealth
  ) private pure returns (uint256 totalFoodRequired) {
    // totalFoodRequired = (totalHealthLost * HEALING_SCALE) / (healthRestoredFromItem * healingDoneFromHealth)
    uint256 numerator = _totalHealthLost * HEALING_SCALE;
    uint256 denominator = _healthRestoredFromItem * _healingDoneFromHealth;
    totalFoodRequired = Math.ceilDiv(numerator, denominator);
  }

  function _getFoodConsumed(
    address _from,
    uint16 _regenerateId,
    uint32 _totalHealthLost,
    uint32 _totalHealthLostKilling,
    uint32 _totalHealthPlayer,
    uint256 _alphaCombatHealing,
    address _itemNFTAddress,
    PendingQueuedActionEquipmentState[] calldata _pendingQueuedActionEquipmentStates
  ) private view returns (uint16 foodConsumed, uint256 totalFoodRequiredKilling, bool died) {
    uint256 healthRestoredFromItem;
    if (_regenerateId != NONE) {
      Item memory item = IItemNFT(_itemNFTAddress).getItem(_regenerateId);
      healthRestoredFromItem = item.healthRestored;
    }

    if (healthRestoredFromItem == 0 || _totalHealthLost <= 0) {
      // No food attached or didn't lose any health
      died = _totalHealthLost > 0;
    } else {
      // Equation used is totalFoodRequired = totalHealthLost / (healthRestoredFromItem * healingDoneFromHealth)
      uint256 healingDoneFromHealth = _calculateHealingDoneFromHealth(_totalHealthPlayer, _alphaCombatHealing);
      uint256 totalFoodRequired = _calculateTotalFoodRequired(
        _totalHealthLost,
        healthRestoredFromItem,
        healingDoneFromHealth
      );
      totalFoodRequiredKilling = _calculateTotalFoodRequired(
        _totalHealthLostKilling,
        healthRestoredFromItem,
        healingDoneFromHealth
      );

      uint256 balance = getRealBalance(_from, _regenerateId, _itemNFTAddress, _pendingQueuedActionEquipmentStates);

      // Can only consume a maximum of 65535 food
      if (totalFoodRequired > type(uint16).max) {
        died = true;
      } else {
        died = totalFoodRequired > balance;
      }

      if (died) {
        foodConsumed = uint16(balance > type(uint16).max ? type(uint16).max : balance);
      } else {
        foodConsumed = uint16(totalFoodRequired);
      }
    }
  }

  function getNonCombatAdjustedElapsedTime(
    address _from,
    address _itemNFTAddress,
    uint256 _elapsedTime,
    ActionChoice calldata _actionChoice,
    PendingQueuedActionEquipmentState[] calldata _pendingQueuedActionEquipmentStates
  ) external view returns (uint256 xpElapsedTime, uint16 baseInputItemsConsumedNum) {
    // Check the max that can be used
    baseInputItemsConsumedNum = uint16((_elapsedTime * _actionChoice.rate) / (3600 * RATE_MUL));

    if (baseInputItemsConsumedNum != 0) {
      // This checks the balances
      uint256 maxRequiredRatio = _getMaxRequiredRatio(
        _from,
        _actionChoice,
        baseInputItemsConsumedNum,
        IItemNFT(_itemNFTAddress),
        _pendingQueuedActionEquipmentStates
      );
      bool hadEnoughConsumables = baseInputItemsConsumedNum <= maxRequiredRatio;
      if (!hadEnoughConsumables) {
        baseInputItemsConsumedNum = uint16(maxRequiredRatio);
      }
    }
    // Work out what the actual elapsedTime should be had all those been made
    xpElapsedTime = (uint256(baseInputItemsConsumedNum) * 3600 * RATE_MUL) / _actionChoice.rate;
  }

  function _isCombat(CombatStyle _combatStyle) private pure returns (bool) {
    return _combatStyle != CombatStyle.NONE;
  }

  function getBoostedTime(
    uint256 _actionStartTime,
    uint256 _elapsedTime,
    uint40 _boostStartTime,
    uint24 _boostDuration
  ) public pure returns (uint24 boostedTime) {
    uint256 actionEndTime = _actionStartTime + _elapsedTime;
    uint256 boostEndTime = _boostStartTime + _boostDuration;
    bool boostFinishedBeforeOrOnActionStarted = _actionStartTime >= boostEndTime;
    bool boostStartedAfterOrOnActionFinished = actionEndTime <= _boostStartTime;
    uint24 actionDuration = uint24(actionEndTime - _actionStartTime);
    if (boostFinishedBeforeOrOnActionStarted || boostStartedAfterOrOnActionFinished || _elapsedTime == 0) {
      // Boost was not active at all during this queued action
      boostedTime = 0;
    } else if (_boostStartTime <= _actionStartTime && boostEndTime >= actionEndTime) {
      boostedTime = actionDuration;
    } else if (_boostStartTime < _actionStartTime && boostEndTime < actionEndTime) {
      boostedTime = uint24(boostEndTime - _actionStartTime);
    } else if (_boostStartTime > _actionStartTime && boostEndTime > actionEndTime) {
      boostedTime = uint24(actionEndTime - _boostStartTime);
    } else if (_boostStartTime > _actionStartTime && boostEndTime <= actionEndTime) {
      boostedTime = _boostDuration;
    } else if (_boostStartTime == _actionStartTime && boostEndTime <= actionEndTime) {
      boostedTime = _boostDuration;
    } else {
      assert(false); // Should never happen
    }
  }

  function _getXPFromBoostImpl(
    bool _isCombatSkill,
    uint256 _actionStartTime,
    uint256 _xpElapsedTime,
    uint24 _xpPerHour,
    BoostType boostType,
    uint40 _boostStartTime,
    uint24 _boostDuration,
    uint16 _boostValue
  ) private pure returns (uint32 boostPointsAccrued) {
    if (
      boostType == BoostType.ANY_XP ||
      (_isCombatSkill && boostType == BoostType.COMBAT_XP) ||
      (!_isCombatSkill && boostType == BoostType.NON_COMBAT_XP)
    ) {
      uint256 boostedTime = getBoostedTime(_actionStartTime, _xpElapsedTime, _boostStartTime, _boostDuration);
      boostPointsAccrued = uint32((boostedTime * _xpPerHour * _boostValue) / (3600 * 100));
    }
  }

  function _getXPFromBoost(
    bool _isCombatSkill,
    uint256 _actionStartTime,
    uint256 _xpElapsedTime,
    uint24 _xpPerHour,
    PlayerBoostInfo storage _boostInfo
  ) private view returns (uint32 boostPointsAccrued) {
    if (_boostInfo.itemTokenId != NONE && _boostInfo.startTime < block.timestamp && _xpElapsedTime != 0) {
      // A boost is active
      return
        _getXPFromBoostImpl(
          _isCombatSkill,
          _actionStartTime,
          _xpElapsedTime,
          _xpPerHour,
          _boostInfo.boostType,
          _boostInfo.startTime,
          _boostInfo.duration,
          _boostInfo.value
        );
    }
  }

  function _getXPFromExtraOrLastBoost(
    bool _isCombatSkill,
    uint256 _actionStartTime,
    uint256 _xpElapsedTime,
    uint24 _xpPerHour,
    PlayerBoostInfo storage _boostInfo
  ) private view returns (uint32 boostPointsAccrued) {
    if (
      _boostInfo.extraOrLastItemTokenId != NONE &&
      _boostInfo.extraOrLastStartTime < block.timestamp &&
      _xpElapsedTime != 0
    ) {
      // An extra boost is active or an overriden one was active at this time
      return
        _getXPFromBoostImpl(
          _isCombatSkill,
          _actionStartTime,
          _xpElapsedTime,
          _xpPerHour,
          _boostInfo.extraOrLastBoostType,
          _boostInfo.extraOrLastStartTime,
          _boostInfo.extraOrLastDuration,
          _boostInfo.extraOrLastValue
        );
    }
  }

  function _extraBoostFromFullAttire(
    uint16[] memory itemTokenIds,
    uint256[] memory balances,
    uint16[5] calldata expectedItemTokenIds
  ) private pure returns (bool matches) {
    // Check if they have the full equipment required
    if (itemTokenIds.length == 5) {
      for (U256 iter; iter.lt(5); iter = iter.inc()) {
        uint256 i = iter.asUint256();
        if (itemTokenIds[i] != expectedItemTokenIds[i] || balances[i] == 0) {
          return false;
        }
      }
      return true;
    }
  }

  function subtractMatchingRewards(
    uint256[] calldata newIds,
    uint256[] calldata newAmounts,
    uint256[] calldata prevNewIds,
    uint256[] calldata prevNewAmounts
  ) external pure returns (uint256[] memory ids, uint256[] memory amounts) {
    // Subtract previous rewards. If amount is zero after, replace with end and reduce the array size
    ids = newIds;
    amounts = newAmounts;
    U256 prevNewIdsLength = prevNewIds.length.asU256();
    for (U256 jter; jter < prevNewIdsLength; jter = jter.inc()) {
      uint256 j = jter.asUint256();
      uint16 prevNewId = uint16(prevNewIds[j]);
      uint24 prevNewAmount = uint24(prevNewAmounts[j]);
      uint256 length = ids.length;
      for (uint256 k = 0; k < length; ++k) {
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

  function readXP(Skill _skill, PackedXP storage _packedXP) internal view returns (uint256) {
    if (_skill == Skill.COMBAT || _skill == Skill.TRAVELING) {
      revert InvalidXPSkill();
    }
    if (_skill == Skill.NONE) {
      return 0;
    }
    uint256 offset = 2; // Accounts for NONE & COMBAT skills
    uint256 val = uint8(_skill) - offset;
    uint256 slotNum = val / 6;
    uint256 relativePos = val % 6;

    uint256 slotVal;
    assembly ("memory-safe") {
      slotVal := sload(add(_packedXP.slot, slotNum))
    }

    return uint40(slotVal >> (relativePos * 40));
  }

  function getCombatStatsFromHero(
    PendingQueuedActionProcessed calldata _pendingQueuedActionProcessed,
    PackedXP storage _packedXP
  ) external view returns (CombatStats memory combatStats) {
    combatStats.melee = int16(
      _getLevel(_getAbsoluteActionStartXP(Skill.MELEE, _pendingQueuedActionProcessed, _packedXP))
    );
    combatStats.ranged = int16(
      _getLevel(_getAbsoluteActionStartXP(Skill.RANGED, _pendingQueuedActionProcessed, _packedXP))
    );
    combatStats.magic = int16(
      _getLevel(_getAbsoluteActionStartXP(Skill.MAGIC, _pendingQueuedActionProcessed, _packedXP))
    );
    combatStats.health = int16(
      _getLevel(_getAbsoluteActionStartXP(Skill.HEALTH, _pendingQueuedActionProcessed, _packedXP))
    );
    uint16 defenceLevel = _getLevel(_getAbsoluteActionStartXP(Skill.DEFENCE, _pendingQueuedActionProcessed, _packedXP));
    combatStats.meleeDefence = int16(defenceLevel);
    combatStats.rangedDefence = int16(defenceLevel);
    combatStats.magicDefence = int16(defenceLevel);
  }

  function updateCombatStatsFromSkill(
    CombatStats memory _combatStats,
    uint8 _skillId,
    int16 _skillDiff
  ) external pure returns (CombatStats memory combatStats) {
    return _updateCombatStatsFromSkill(_combatStats, Skill(_skillId), _skillDiff);
  }

  function _updateCombatStatsFromSkill(
    CombatStats memory _combatStats,
    Skill _skill,
    int16 _skillDiff
  ) internal pure returns (CombatStats memory combatStats) {
    combatStats = _combatStats;
    if (_skill == Skill.MELEE) {} else if (_skill == Skill.RANGED) {
      combatStats.ranged += _skillDiff; // Extra/Reduced ranged damage
    } else if (_skill == Skill.MAGIC) {
      combatStats.magic += _skillDiff; // Extra/Reduced magic damage
    } else if (_skill == Skill.DEFENCE) {
      combatStats.meleeDefence += _skillDiff;
      combatStats.rangedDefence += _skillDiff;
      combatStats.magicDefence += _skillDiff;
    } else if (_skill == Skill.HEALTH) {
      combatStats.health += _skillDiff;
    } else {
      assert(false);
    }
  }

  function updateCombatStatsFromAttire(
    CombatStats memory _combatStats,
    address _from,
    address _itemNFTAddress,
    Attire storage _attire,
    PendingQueuedActionEquipmentState[] calldata _pendingQueuedActionEquipmentStates
  ) external view returns (CombatStats memory combatStats) {
    combatStats = _combatStats;
    bool skipNonFullAttire;
    (uint16[] memory itemTokenIds, uint256[] memory balances) = getAttireWithBalance(
      _from,
      _attire,
      _itemNFTAddress,
      skipNonFullAttire,
      _pendingQueuedActionEquipmentStates
    );
    if (itemTokenIds.length != 0) {
      Item[] memory items = IItemNFT(_itemNFTAddress).getItems(itemTokenIds);
      U256 iter = items.length.asU256();
      while (iter.neq(0)) {
        iter = iter.dec();
        uint256 i = iter.asUint256();
        if (balances[i] != 0) {
          _updateCombatStatsFromItem(_combatStats, items[i]);
        }
      }
    }
  }

  // none of the combat stats is allowed to be negative at this point
  function updateCombatStatsFromPet(
    CombatStats memory _combatStats,
    uint8 _skillEnhancement1,
    uint8 _skillFixedEnhancement1,
    uint8 _skillPercentageEnhancement1,
    uint8 _skillEnhancement2,
    uint8 _skillFixedEnhancement2,
    uint8 _skillPercentageEnhancement2
  ) external pure returns (CombatStats memory combatStats) {
    combatStats = _combatStats;
    Skill skill1 = _skillEnhancement1.asSkill();
    if (skill1 == Skill.HEALTH) {
      _combatStats.health += int16(
        _skillFixedEnhancement1 + (uint16(_combatStats.health) * _skillPercentageEnhancement1) / 100
      );
    } else if (skill1 == Skill.MELEE) {
      _combatStats.melee += int16(
        _skillFixedEnhancement1 + (uint16(_combatStats.melee) * _skillPercentageEnhancement1) / 100
      );
    } else if (skill1 == Skill.RANGED) {
      _combatStats.ranged += int16(
        _skillFixedEnhancement1 + (uint16(_combatStats.ranged) * _skillPercentageEnhancement1) / 100
      );
    } else if (skill1 == Skill.MAGIC) {
      _combatStats.magic += int16(
        _skillFixedEnhancement1 + (uint16(_combatStats.magic) * _skillPercentageEnhancement1) / 100
      );
    } else if (skill1 == Skill.DEFENCE) {
      _combatStats.meleeDefence += int16(
        _skillFixedEnhancement1 + (uint16(_combatStats.meleeDefence) * _skillPercentageEnhancement1) / 100
      );
      _combatStats.rangedDefence += int16(
        _skillFixedEnhancement1 + (uint16(_combatStats.rangedDefence) * _skillPercentageEnhancement1) / 100
      );
      _combatStats.magicDefence += int16(
        _skillFixedEnhancement1 + (uint16(_combatStats.magicDefence) * _skillPercentageEnhancement1) / 100
      );
    } else {
      revert SkillForPetNotHandledYet();
    }

    Skill skill2 = _skillEnhancement2.asSkill();
    if (skill2 != Skill.NONE) {
      if (skill2 == Skill.DEFENCE) {
        _combatStats.meleeDefence += int16(
          _skillFixedEnhancement2 + (uint16(_combatStats.meleeDefence) * _skillPercentageEnhancement2) / 100
        );
        _combatStats.rangedDefence += int16(
          _skillFixedEnhancement2 + (uint16(_combatStats.rangedDefence) * _skillPercentageEnhancement2) / 100
        );
        _combatStats.magicDefence += int16(
          _skillFixedEnhancement2 + (uint16(_combatStats.magicDefence) * _skillPercentageEnhancement2) / 100
        );
      } else {
        revert SkillForPetNotHandledYet();
      }
    }
  }

  // 2 versions of getAttireWithBalance exist, 1 has storage attire and the other has calldata attire. This is to
  // allow more versions of versions to accept storage attire.
  function getAttireWithBalance(
    address _from,
    Attire calldata _attire,
    address _itemNFTAddress,
    bool _skipNonFullAttire,
    PendingQueuedActionEquipmentState[] calldata _pendingQueuedActionEquipmentStates
  ) public view returns (uint16[] memory itemTokenIds, uint256[] memory balances) {
    uint256 attireLength;
    itemTokenIds = new uint16[](7);
    if (_attire.head != NONE) {
      itemTokenIds[attireLength++] = _attire.head;
    }
    if (_attire.neck != NONE && !_skipNonFullAttire) {
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
    if (_attire.ring != NONE && !_skipNonFullAttire) {
      itemTokenIds[attireLength++] = _attire.ring;
    }

    assembly ("memory-safe") {
      mstore(itemTokenIds, attireLength)
    }

    if (attireLength != 0) {
      balances = getRealBalances(_from, itemTokenIds, _itemNFTAddress, _pendingQueuedActionEquipmentStates);
    }
  }

  function getAttireWithBalance(
    address _from,
    Attire storage _attire,
    address _itemNFTAddress,
    bool _skipNonFullAttire,
    PendingQueuedActionEquipmentState[] calldata _pendingQueuedActionEquipmentStates
  ) public view returns (uint16[] memory itemTokenIds, uint256[] memory balances) {
    uint256 attireLength;
    itemTokenIds = new uint16[](7);
    if (_attire.head != NONE) {
      itemTokenIds[attireLength++] = _attire.head;
    }
    if (_attire.neck != NONE && !_skipNonFullAttire) {
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
    if (_attire.ring != NONE && !_skipNonFullAttire) {
      itemTokenIds[attireLength++] = _attire.ring;
    }

    assembly ("memory-safe") {
      mstore(itemTokenIds, attireLength)
    }

    if (attireLength != 0) {
      balances = getRealBalances(_from, itemTokenIds, _itemNFTAddress, _pendingQueuedActionEquipmentStates);
    }
  }

  // Subtract any existing xp gained from the first in-progress actions and add the new xp gained
  function getAbsoluteActionStartXP(
    uint8 _skillId,
    PendingQueuedActionProcessed calldata _pendingQueuedActionProcessed,
    PackedXP storage packedXP
  ) public view returns (uint256) {
    return _getAbsoluteActionStartXP(Skill(_skillId), _pendingQueuedActionProcessed, packedXP);
  }

  // Subtract any existing xp gained from the first in-progress actions and add the new xp gained
  function _getAbsoluteActionStartXP(
    Skill _skill,
    PendingQueuedActionProcessed calldata _pendingQueuedActionProcessed,
    PackedXP storage packedXP
  ) internal view returns (uint256) {
    uint256 xp = readXP(_skill, packedXP);
    if (_pendingQueuedActionProcessed.currentAction.skill1 == _skill) {
      xp -= _pendingQueuedActionProcessed.currentAction.xpGained1;
    } else if (_pendingQueuedActionProcessed.currentAction.skill2 == _skill) {
      xp -= _pendingQueuedActionProcessed.currentAction.xpGained2;
    } else if (_pendingQueuedActionProcessed.currentAction.skill3 == _skill) {
      xp -= _pendingQueuedActionProcessed.currentAction.xpGained3;
    }

    // Add any new xp gained from previous actions now completed that haven't been pushed to the blockchain yet. For instance
    // battling monsters may increase your level so you are stronger for a later queued action.
    for (uint256 i; i < _pendingQueuedActionProcessed.skills.length; ++i) {
      if (_pendingQueuedActionProcessed.skills[i] == _skill) {
        xp += _pendingQueuedActionProcessed.xpGainedSkills[i];
      }
    }

    return xp;
  }

  function updateStatsFromHandEquipment(
    address _from,
    address _itemNFTAddress,
    uint16[2] calldata _handEquipmentTokenIds,
    CombatStats calldata _combatStats,
    bool isCombat,
    PendingQueuedActionEquipmentState[] calldata _pendingQueuedActionEquipmentStates,
    ActionChoice calldata _actionChoice
  ) external view returns (bool missingRequiredHandEquipment, CombatStats memory combatStats) {
    U256 iter = _handEquipmentTokenIds.length.asU256();
    combatStats = _combatStats;
    while (iter.neq(0)) {
      iter = iter.dec();
      uint16 i = iter.asUint16();
      uint16 handEquipmentTokenId = _handEquipmentTokenIds[i];
      if (handEquipmentTokenId != NONE) {
        uint256 balance = getRealBalance(
          _from,
          handEquipmentTokenId,
          _itemNFTAddress,
          _pendingQueuedActionEquipmentStates
        );
        if (balance == 0) {
          // Assume that if the player doesn't have the non-combat item that this action cannot be done or if the action choice required it (e.g range bows)
          if (!isCombat || _actionChoice.handItemTokenIdRangeMin != NONE) {
            missingRequiredHandEquipment = true;
          }
        } else if (isCombat) {
          // Update the combat stats
          Item memory item = IItemNFT(_itemNFTAddress).getItem(handEquipmentTokenId);
          _updateCombatStatsFromItem(combatStats, item);
        }
      }
    }
  }

  function _updateCombatStatsFromItem(CombatStats memory _combatStats, Item memory _item) private pure {
    _combatStats.melee += _item.melee;
    _combatStats.ranged += _item.ranged;
    _combatStats.magic += _item.magic;
    _combatStats.meleeDefence += _item.meleeDefence;
    _combatStats.rangedDefence += _item.rangedDefence;
    _combatStats.magicDefence += _item.magicDefence;
    _combatStats.health += _item.health;
  }

  function getBonusAvatarXPPercent(Player storage _player, uint8 _skillId) public view returns (uint8 bonusPercent) {
    return _getBonusAvatarXPPercent(_player, Skill(_skillId));
  }

  function _getBonusAvatarXPPercent(Player storage _player, Skill _skill) internal view returns (uint8 bonusPercent) {
    bool hasBonusSkill = _player.skillBoosted1 == _skill || _player.skillBoosted2 == _skill;
    if (!hasBonusSkill) {
      return 0;
    }
    bool bothSet = _player.skillBoosted1 != Skill.NONE && _player.skillBoosted2 != Skill.NONE;
    bonusPercent = bothSet ? 5 : 10;
    // Upgraded characters get double base bonus stats
    bool isUpgraded = uint8(_player.packedData >> IS_FULL_MODE_BIT) & 1 == 1;
    bonusPercent = isUpgraded ? bonusPercent * 2 : bonusPercent;
  }

  function _extraFromAvatar(
    Player storage _player,
    Skill _skill,
    uint256 _elapsedTime,
    uint24 _xpPerHour
  ) internal view returns (uint32 extraPointsAccrued) {
    uint8 bonusPercent = _getBonusAvatarXPPercent(_player, _skill);
    extraPointsAccrued = uint32((_elapsedTime * _xpPerHour * bonusPercent) / (3600 * 100));
  }

  function getPointsAccrued(
    address _from,
    Player storage _player,
    QueuedAction storage _queuedAction,
    uint256 _startTime,
    uint8 _skillId,
    uint256 _xpElapsedTime,
    Attire storage _attire,
    PlayerBoostInfo storage _activeBoost,
    PlayerBoostInfo storage _globalBoost,
    PlayerBoostInfo storage _clanBoost,
    address _itemNFTAddress,
    address _worldAddress,
    uint8 _bonusAttirePercent,
    uint16[5] calldata _expectedItemTokenIds,
    PendingQueuedActionEquipmentState[] calldata _pendingQueuedActionEquipmentStates
  ) external view returns (uint32 pointsAccrued, uint32 pointsAccruedExclBaseBoost) {
    bool _isCombatSkill = _queuedAction.combatStyle.isNotCombatStyle(CombatStyle.NONE);
    uint24 xpPerHour = World(_worldAddress).getXPPerHour(
      _queuedAction.actionId,
      _isCombatSkill ? NONE : _queuedAction.choiceId
    );
    pointsAccrued = uint32((_xpElapsedTime * xpPerHour) / 3600);
    // Normal Player specific boosts
    pointsAccrued += _getXPFromBoost(_isCombatSkill, _startTime, _xpElapsedTime, xpPerHour, _activeBoost);
    pointsAccrued += _getXPFromExtraOrLastBoost(_isCombatSkill, _startTime, _xpElapsedTime, xpPerHour, _activeBoost);
    // Global boost
    pointsAccrued += _getXPFromBoost(_isCombatSkill, _startTime, _xpElapsedTime, xpPerHour, _globalBoost);
    pointsAccrued += _getXPFromExtraOrLastBoost(_isCombatSkill, _startTime, _xpElapsedTime, xpPerHour, _globalBoost);
    // Clan boost
    pointsAccrued += _getXPFromBoost(_isCombatSkill, _startTime, _xpElapsedTime, xpPerHour, _clanBoost);
    pointsAccrued += _getXPFromExtraOrLastBoost(_isCombatSkill, _startTime, _xpElapsedTime, xpPerHour, _clanBoost);
    pointsAccrued += _extraXPFromFullAttire(
      _from,
      _attire,
      _xpElapsedTime,
      xpPerHour,
      _itemNFTAddress,
      _bonusAttirePercent,
      _expectedItemTokenIds,
      _pendingQueuedActionEquipmentStates
    );
    pointsAccruedExclBaseBoost = pointsAccrued;
    pointsAccrued += _extraFromAvatar(_player, Skill(_skillId), _xpElapsedTime, xpPerHour);
  }

  function _extraXPFromFullAttire(
    address _from,
    Attire storage _attire,
    uint256 _elapsedTime,
    uint24 _xpPerHour,
    address _itemNFTAddress,
    uint8 _bonusPercent,
    uint16[5] calldata _expectedItemTokenIds,
    PendingQueuedActionEquipmentState[] calldata _pendingQueuedActionEquipmentStates
  ) internal view returns (uint32 extraPointsAccrued) {
    if (_bonusPercent == 0) {
      return 0;
    }
    // Check if they have the full equipment set, if so they can get some bonus
    bool skipNonFullAttire = true;
    (uint16[] memory itemTokenIds, uint256[] memory balances) = getAttireWithBalance(
      _from,
      _attire,
      _itemNFTAddress,
      skipNonFullAttire,
      _pendingQueuedActionEquipmentStates
    );
    bool hasFullAttire = _extraBoostFromFullAttire(itemTokenIds, balances, _expectedItemTokenIds);
    if (hasFullAttire) {
      extraPointsAccrued = uint32((_elapsedTime * _xpPerHour * _bonusPercent) / (3600 * 100));
    }
  }

  function getSuccessPercent(
    uint16 _actionId,
    uint8 _actionSkillId,
    bool isCombat,
    PendingQueuedActionProcessed calldata _pendingQueuedActionProcessed,
    address _worldAddress,
    uint256 _maxSuccessPercentChange,
    PackedXP storage _packedXP
  ) external view returns (uint8 successPercent) {
    successPercent = 100;
    (uint8 actionSuccessPercent, uint32 minXP) = World(_worldAddress).getActionSuccessPercentAndMinXP(_actionId);
    if (actionSuccessPercent != 100) {
      if (isCombat) {
        revert InvalidAction();
      }

      uint256 minLevel = _getLevel(minXP);
      uint256 skillLevel = _getLevel(
        _getAbsoluteActionStartXP(Skill(_actionSkillId), _pendingQueuedActionProcessed, _packedXP)
      );
      uint256 extraBoost = skillLevel - minLevel;

      successPercent = uint8(Math.min(_maxSuccessPercentChange, actionSuccessPercent + extraBoost));
    }
  }

  function getFullAttireBonusRewardsPercent(
    address _from,
    Attire storage _attire,
    address _itemNFTAddress,
    PendingQueuedActionEquipmentState[] calldata _pendingQueuedActionEquipmentStates,
    uint8 _bonusRewardsPercent,
    uint16[5] calldata fullAttireBonusItemTokenIds
  ) external view returns (uint8 fullAttireBonusRewardsPercent) {
    if (_bonusRewardsPercent == 0) {
      return 0;
    }

    // Check if they have the full equipment set, if so they can get some bonus
    bool skipNonFullAttire = true;
    (uint16[] memory itemTokenIds, uint256[] memory balances) = getAttireWithBalance(
      _from,
      _attire,
      _itemNFTAddress,
      skipNonFullAttire,
      _pendingQueuedActionEquipmentStates
    );
    bool hasFullAttire = _extraBoostFromFullAttire(itemTokenIds, balances, fullAttireBonusItemTokenIds);

    if (hasFullAttire) {
      fullAttireBonusRewardsPercent = _bonusRewardsPercent;
    }
  }
}
