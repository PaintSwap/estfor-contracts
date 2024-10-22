// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

import {UnsafeMath, U256} from "@0xdoublesharp/unsafe-math/contracts/UnsafeMath.sol";
import {IItemNFT} from "../interfaces/IItemNFT.sol";
import {World} from "../World.sol";

import {CombatStyleLibrary} from "../libraries/CombatStyleLibrary.sol";
import {SkillLibrary} from "../libraries/SkillLibrary.sol";

// solhint-disable-next-line no-global-import
import "../globals/all.sol";

// This file contains methods for interacting with the player that is used to decrease implementation deployment bytecode code.
library PlayersLibrary {
  using UnsafeMath for U256;
  using UnsafeMath for uint256;
  using CombatStyleLibrary for uint8;
  using SkillLibrary for uint8;
  using SkillLibrary for Skill;

  error InvalidXPSkill();
  error InvalidAction();
  error SkillForPetNotHandledYet();

  // This is to prevent some precision loss in the healing calculations
  uint256 constant HEALING_SCALE = 1_000_000;

  function _getLevel(uint256 xp) internal pure returns (uint16) {
    U256 low;
    U256 high = XP_BYTES.length.asU256().div(4);

    while (low < high) {
      U256 mid = (low + high).div(2);

      // Note that mid will always be strictly less than high (i.e. it will be a valid array index)
      if (_getXP(mid.asUint256()) > xp) {
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

  function getLevel(uint256 xp) external pure returns (uint16) {
    return _getLevel(xp);
  }

  function _getXP(uint256 index) private pure returns (uint32) {
    uint256 key = index * 4;
    return
      uint32(
        XP_BYTES[key] |
          (bytes4(XP_BYTES[key + 1]) >> 8) |
          (bytes4(XP_BYTES[key + 2]) >> 16) |
          (bytes4(XP_BYTES[key + 3]) >> 24)
      );
  }

  function _getRealBalance(
    uint256 originalBalance,
    uint256 itemId,
    PendingQueuedActionEquipmentState[] calldata pendingQueuedActionEquipmentStates
  ) private pure returns (uint256 balance) {
    balance = originalBalance;
    U256 bounds = pendingQueuedActionEquipmentStates.length.asU256();
    for (U256 iter; iter < bounds; iter = iter.inc()) {
      uint256 i = iter.asUint256();
      PendingQueuedActionEquipmentState memory pendingQueuedActionEquipmentState = pendingQueuedActionEquipmentStates[
        i
      ];
      U256 jBounds = pendingQueuedActionEquipmentState.producedItemTokenIds.length.asU256();
      for (U256 jIter; jIter < jBounds; jIter = jIter.inc()) {
        uint256 j = jIter.asUint256();
        if (pendingQueuedActionEquipmentState.producedItemTokenIds[j] == itemId) {
          balance += pendingQueuedActionEquipmentState.producedAmounts[j];
        }
      }
      jBounds = pendingQueuedActionEquipmentState.consumedItemTokenIds.length.asU256();
      for (U256 jIter; jIter < jBounds; jIter = jIter.inc()) {
        uint256 j = jIter.asUint256();
        if (pendingQueuedActionEquipmentState.consumedItemTokenIds[j] == itemId) {
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
    address from,
    uint256 itemId,
    address itemNFTAddress,
    PendingQueuedActionEquipmentState[] calldata pendingQueuedActionEquipmentStates
  ) public view returns (uint256 balance) {
    balance = _getRealBalance(
      IItemNFT(itemNFTAddress).balanceOf(from, itemId),
      itemId,
      pendingQueuedActionEquipmentStates
    );
  }

  function getRealBalances(
    address from,
    uint16[] memory itemIds,
    address itemNFTAddress,
    PendingQueuedActionEquipmentState[] calldata pendingQueuedActionEquipmentStates
  ) public view returns (uint256[] memory balances) {
    balances = IItemNFT(itemNFTAddress).balanceOfs(from, itemIds);

    U256 bounds = balances.length.asU256();
    for (U256 iter; iter < bounds; iter = iter.inc()) {
      uint256 i = iter.asUint256();
      balances[i] = _getRealBalance(balances[i], itemIds[i], pendingQueuedActionEquipmentStates);
    }
  }

  function _getMaxRequiredRatio(
    address from,
    ActionChoice memory actionChoice,
    uint16 baseInputItemsConsumedNum,
    IItemNFT itemNFT,
    PendingQueuedActionEquipmentState[] calldata pendingQueuedActionEquipmentStates
  ) private view returns (uint256 maxRequiredRatio) {
    maxRequiredRatio = baseInputItemsConsumedNum;

    bool useSecondInputTokens = uint8(
      actionChoice.packedData >> ACTION_CHOICE_USE_ALTERNATE_INPUTS_SECOND_STORAGE_SLOT
    ) &
      1 ==
      1;

    if (baseInputItemsConsumedNum != 0) {
      if (actionChoice.inputTokenId1 != 0) {
        maxRequiredRatio = _getMaxRequiredRatioPartial(
          from,
          actionChoice.inputTokenId1,
          useSecondInputTokens ? actionChoice.newInputAmount1 : actionChoice.inputAmount1,
          maxRequiredRatio,
          itemNFT,
          pendingQueuedActionEquipmentStates
        );
      }
      if (actionChoice.inputTokenId2 != 0) {
        maxRequiredRatio = _getMaxRequiredRatioPartial(
          from,
          actionChoice.inputTokenId2,
          useSecondInputTokens ? actionChoice.newInputAmount2 : actionChoice.inputAmount2,
          maxRequiredRatio,
          itemNFT,
          pendingQueuedActionEquipmentStates
        );
      }
      if (actionChoice.inputTokenId3 != 0) {
        maxRequiredRatio = _getMaxRequiredRatioPartial(
          from,
          actionChoice.inputTokenId3,
          useSecondInputTokens ? actionChoice.newInputAmount3 : actionChoice.inputAmount3,
          maxRequiredRatio,
          itemNFT,
          pendingQueuedActionEquipmentStates
        );
      }
    }
  }

  function _getMaxRequiredRatioPartial(
    address from,
    uint16 inputTokenId,
    uint256 inputAmount,
    uint256 prevConsumeMaxRatio,
    IItemNFT itemNFT,
    PendingQueuedActionEquipmentState[] calldata pendingQueuedActionEquipmentStates
  ) private view returns (uint256 maxRequiredRatio) {
    uint256 balance = getRealBalance(from, inputTokenId, address(itemNFT), pendingQueuedActionEquipmentStates);
    uint256 tempMaxRequiredRatio = balance / inputAmount;
    if (tempMaxRequiredRatio < prevConsumeMaxRatio) {
      maxRequiredRatio = tempMaxRequiredRatio;
    } else {
      maxRequiredRatio = prevConsumeMaxRatio;
    }
  }

  function _max(int a, int b) private pure returns (int) {
    return a > b ? a : b;
  }

  function _dmgPerMinute(int attack, int defence, uint8 alphaCombat, uint8 betaCombat) private pure returns (uint256) {
    if (attack == 0) {
      return 0;
    }
    // Negative defence is capped at the negative of the attack value.
    // So an attack of 10 and defence of -15 is the same as attack -10.
    defence = _max(-attack, defence);
    return uint256(_max(1, int128(attack) * int8(alphaCombat) + (attack * 2 - defence) * int8(betaCombat)));
  }

  function dmg(
    int attack,
    int defence,
    uint8 alphaCombat,
    uint8 betaCombat,
    uint256 elapsedTime
  ) public pure returns (uint32) {
    return uint32((_dmgPerMinute(attack, defence, alphaCombat, betaCombat) * elapsedTime) / 60);
  }

  function _fullDmg(
    CombatStats calldata combatStats,
    CombatStats memory enemyCombatStats,
    uint8 alphaCombat,
    uint8 betaCombat,
    uint256 elapsedTime
  ) private pure returns (uint32 fullDmg) {
    fullDmg = dmg(combatStats.melee, enemyCombatStats.meleeDefence, alphaCombat, betaCombat, elapsedTime);
    fullDmg += dmg(combatStats.ranged, enemyCombatStats.rangedDefence, alphaCombat, betaCombat, elapsedTime);
    fullDmg += dmg(combatStats.magic, enemyCombatStats.magicDefence, alphaCombat, betaCombat, elapsedTime);
  }

  function _timeToKill(
    int attack,
    int defence,
    uint8 alphaCombat,
    uint8 betaCombat,
    int16 enemyHealth
  ) private pure returns (uint256) {
    // Formula is max(1, a(atk) + b(2 * atk - def))
    // Always do at least 1 damage per minute
    uint256 dmgPerMinute = _dmgPerMinute(attack, defence, alphaCombat, betaCombat);
    return Math.ceilDiv(uint256(uint16(enemyHealth)) * 60, dmgPerMinute);
  }

  function _timeToKillPlayer(
    CombatStats memory combatStats,
    CombatStats memory enemyCombatStats,
    uint8 alphaCombat,
    uint8 betaCombat,
    int health
  ) private pure returns (uint256) {
    uint256 dmgPerMinute = _dmgPerMinute(enemyCombatStats.melee, combatStats.meleeDefence, alphaCombat, betaCombat);
    dmgPerMinute += _dmgPerMinute(enemyCombatStats.ranged, combatStats.rangedDefence, alphaCombat, betaCombat);
    dmgPerMinute += _dmgPerMinute(enemyCombatStats.magic, combatStats.magicDefence, alphaCombat, betaCombat);
    return Math.ceilDiv(uint256(health) * 60, dmgPerMinute);
  }

  function _getTimeToKill(
    Skill skill,
    CombatStats memory combatStats,
    CombatStats memory enemyCombatStats,
    uint8 alphaCombat,
    uint8 betaCombat,
    int16 enemyHealth
  ) private pure returns (uint256 timeToKill) {
    int16 attack;
    int16 defence;
    if (skill == Skill.MELEE) {
      attack = combatStats.melee;
      defence = enemyCombatStats.meleeDefence;
    } else if (skill == Skill.RANGED) {
      attack = combatStats.ranged;
      defence = enemyCombatStats.rangedDefence;
    } else if (skill == Skill.MAGIC || skill == Skill.DEFENCE || skill == Skill.HEALTH) {
      attack = combatStats.magic;
      defence = enemyCombatStats.magicDefence;
    } else {
      assert(false);
    }

    timeToKill = _timeToKill(attack, defence, alphaCombat, betaCombat, enemyHealth);
  }

  function _getDmgDealtByPlayer(
    ActionChoice calldata actionChoice,
    CombatStats memory combatStats,
    CombatStats calldata enemyCombatStats,
    uint8 alphaCombat,
    uint8 betaCombat,
    uint256 elapsedTime
  ) private pure returns (uint32 dmgDealt) {
    Skill skill = actionChoice.skill.asSkill();
    if (skill == Skill.MELEE) {
      dmgDealt = dmg(combatStats.melee, enemyCombatStats.meleeDefence, alphaCombat, betaCombat, elapsedTime);
    } else if (skill == Skill.RANGED) {
      dmgDealt = dmg(combatStats.ranged, enemyCombatStats.rangedDefence, alphaCombat, betaCombat, elapsedTime);
    } else if (skill == Skill.MAGIC || skill == Skill.DEFENCE || skill == Skill.HEALTH) {
      // Assumes this is a magic action
      dmgDealt = dmg(combatStats.magic, enemyCombatStats.magicDefence, alphaCombat, betaCombat, elapsedTime);
    } else {
      assert(false);
    }
  }

  function getCombatAdjustedElapsedTimes(
    address from,
    address itemNFTAddress,
    address worldAddress,
    uint256 elapsedTime,
    ActionChoice calldata actionChoice,
    uint16 regenerateId,
    QueuedAction calldata queuedAction,
    CombatStats memory combatStats,
    CombatStats calldata enemyCombatStats,
    uint8 alphaCombat,
    uint8 betaCombat,
    uint8 alphaCombatHealing,
    PendingQueuedActionEquipmentState[] calldata pendingQueuedActionEquipmentStates
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
        from,
        itemNFTAddress,
        worldAddress,
        elapsedTime,
        actionChoice,
        regenerateId,
        queuedAction,
        combatStats,
        enemyCombatStats,
        alphaCombat,
        betaCombat,
        alphaCombatHealing,
        pendingQueuedActionEquipmentStates
      );
  }

  function _getCombatAdjustedElapsedTimes(
    address from,
    address itemNFTAddress,
    address worldAddress,
    uint256 elapsedTime,
    ActionChoice calldata actionChoice,
    uint16 regenerateId,
    QueuedAction calldata queuedAction,
    CombatStats memory combatStats,
    CombatStats calldata enemyCombatStats,
    uint8 alphaCombat,
    uint8 betaCombat,
    uint8 alphaCombatHealing,
    PendingQueuedActionEquipmentState[] calldata pendingQueuedActionEquipmentStates
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
    World _world = World(worldAddress);
    uint256 numSpawnedPerHour = _world.getNumSpawn(queuedAction.actionId);
    uint256 respawnTime = (3600 * SPAWN_MUL) / numSpawnedPerHour;
    uint32 dmgDealt = _getDmgDealtByPlayer(
      actionChoice,
      combatStats,
      enemyCombatStats,
      alphaCombat,
      betaCombat,
      respawnTime
    );

    uint256 combatTimePerKill = _getTimeToKill(
      actionChoice.skill.asSkill(),
      combatStats,
      enemyCombatStats,
      alphaCombat,
      betaCombat,
      enemyCombatStats.health
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
    bool canKillAll = dmgDealt > uint16(enemyCombatStats.health);
    if (canKillAll) {
      // But how many can we kill in the time that has elapsed?
      numKilled = (elapsedTime * numSpawnedPerHour) / (3600 * SPAWN_MUL);
      uint256 combatTimePerEnemy = Math.ceilDiv(uint16(enemyCombatStats.health) * respawnTime, dmgDealt);
      combatElapsedTime = combatTimePerEnemy * numKilled;
      combatElapsedTimeKilling = combatElapsedTime;
      // Add remainder combat time to current monster you are fighting
      combatElapsedTime += Math.min(combatTimePerEnemy, elapsedTime - respawnTime * numKilled);
    } else {
      numKilled = elapsedTime / combatTimePerKill;
      combatElapsedTimeKilling = combatTimePerKill * numKilled;
      combatElapsedTime = elapsedTime;
    }

    xpElapsedTime = respawnTime * numKilled;

    // Step 2 - Work out how many consumables are used
    // Check how many to consume, and also adjust xpElapsedTime if they don't have enough consumables
    baseInputItemsConsumedNum = uint16(Math.ceilDiv(combatElapsedTime * actionChoice.rate, 3600 * RATE_MUL));
    if (actionChoice.rate != 0) {
      baseInputItemsConsumedNum = uint16(Math.max(numKilled, baseInputItemsConsumedNum));
    }
    uint256 maxRequiredBaseInputItemsConsumedRatio = baseInputItemsConsumedNum;
    if (baseInputItemsConsumedNum != 0) {
      // This checks the balances
      maxRequiredBaseInputItemsConsumedRatio = _getMaxRequiredRatio(
        from,
        actionChoice,
        baseInputItemsConsumedNum,
        IItemNFT(itemNFTAddress),
        pendingQueuedActionEquipmentStates
      );

      if (baseInputItemsConsumedNum > maxRequiredBaseInputItemsConsumedRatio) {
        // How many can we kill with the consumables we do have
        numKilled = (numKilled * maxRequiredBaseInputItemsConsumedRatio) / baseInputItemsConsumedNum;
        xpElapsedTime = respawnTime * numKilled;

        if (canKillAll) {
          uint256 combatTimePerEnemy = Math.ceilDiv(uint16(enemyCombatStats.health) * respawnTime, dmgDealt);
          combatElapsedTime = combatTimePerEnemy * numKilled;
          combatElapsedTimeKilling = combatElapsedTime;
          combatElapsedTime += elapsedTime - (respawnTime * numKilled); // Plus fighting the one you haven't killed
        } else {
          // In combat the entire time
          combatElapsedTime = elapsedTime;
          combatElapsedTimeKilling = combatTimePerKill * numKilled;
        }
        baseInputItemsConsumedNum = uint16(maxRequiredBaseInputItemsConsumedRatio);
      }
    } else if (actionChoice.rate != 0) {
      // Requires input items but we don't have any. In combat the entire time getting rekt
      xpElapsedTime = 0;
      combatElapsedTime = elapsedTime;
    }

    // Step 3 - Work out how much food is needed. If you die then work out how many consumables you actually used as in combat you died before you could cast more.
    uint32 totalHealthLost = _fullDmg(enemyCombatStats, combatStats, alphaCombat, betaCombat, combatElapsedTime);

    uint32 playerHealth = uint16(int16(_max(0, combatStats.health)));
    if (int32(totalHealthLost) > combatStats.health) {
      // Take away our health points from the total dealt
      totalHealthLost -= playerHealth;
    } else {
      totalHealthLost = 0;
    }

    uint32 totalHealthLostOnlyKilled = _fullDmg(
      enemyCombatStats,
      combatStats,
      alphaCombat,
      betaCombat,
      combatElapsedTimeKilling
    );

    if (int32(totalHealthLostOnlyKilled) > combatStats.health) {
      // Take away our health points from the total dealt
      totalHealthLostOnlyKilled -= playerHealth;
    } else {
      totalHealthLostOnlyKilled = 0;
    }

    uint256 totalFoodRequiredKilling;
    (foodConsumed, totalFoodRequiredKilling, died) = _getFoodConsumed(
      from,
      regenerateId,
      totalHealthLost,
      totalHealthLostOnlyKilled,
      playerHealth,
      alphaCombatHealing,
      itemNFTAddress,
      pendingQueuedActionEquipmentStates
    );

    // Didn't have enough food to survive the best case combat scenario
    if (died) {
      uint256 healthRestored;
      if (regenerateId != NONE) {
        Item memory item = IItemNFT(itemNFTAddress).getItem(regenerateId);
        healthRestored = item.healthRestored;
      }

      uint256 totalHealth = uint16(combatStats.health) + foodConsumed * healthRestored;
      // How much combat time is required to kill the player
      uint256 killPlayerTime = _timeToKillPlayer(
        combatStats,
        enemyCombatStats,
        alphaCombat,
        betaCombat,
        int(totalHealth)
      );

      combatElapsedTime = Math.min(combatElapsedTime, killPlayerTime); // Needed?
      if (healthRestored == 0 || totalHealthLost <= 0) {
        // No food attached or didn't lose any health

        if (canKillAll) {
          uint256 combatTimePerEnemy = Math.ceilDiv(uint16(enemyCombatStats.health) * respawnTime, dmgDealt);
          numKilled = combatElapsedTime / combatTimePerEnemy;
        } else {
          // In combat the entire time
          numKilled = combatElapsedTime / combatTimePerKill;
        }
      } else {
        // How many can we kill with the food we did consume
        if (totalFoodRequiredKilling != 0) {
          if (foodConsumed < totalFoodRequiredKilling) {
            numKilled = (numKilled * foodConsumed) / totalFoodRequiredKilling;
          }
        } else {
          numKilled = 0;
        }
      }
      xpElapsedTime = respawnTime * numKilled;

      // Step 3.5 - Wasn't enough food, so work out how many consumables we actually used.
      if (actionChoice.rate != 0) {
        baseInputItemsConsumedNum = uint16(Math.ceilDiv(combatElapsedTime * actionChoice.rate, 3600 * RATE_MUL));
        // Make sure we use at least 1 per kill
        baseInputItemsConsumedNum = uint16(Math.max(numKilled, baseInputItemsConsumedNum));

        // Make sure we don't go above the maximum amount of consumables (scrolls/arrows) that we actually have
        if (baseInputItemsConsumedNum > maxRequiredBaseInputItemsConsumedRatio) {
          uint256 newMaxRequiredBaseInputItemsConsumedRatio = _getMaxRequiredRatio(
            from,
            actionChoice,
            baseInputItemsConsumedNum,
            IItemNFT(itemNFTAddress),
            pendingQueuedActionEquipmentStates
          );

          baseInputItemsConsumedNum = uint16(
            Math.min(baseInputItemsConsumedNum, newMaxRequiredBaseInputItemsConsumedRatio)
          );
        }
      }
    }
  }

  function _calculateHealingDoneFromHealth(
    uint256 health,
    uint256 alphaCombatHealing
  ) private pure returns (uint256 healingDoneFromHealth) {
    // healing fraction = 1 + (alphaCombatHealing * health / 100)
    uint256 scaledHealth = ((HEALING_SCALE * alphaCombatHealing) / 100) * health;
    uint256 divisor = 100;
    healingDoneFromHealth = HEALING_SCALE + scaledHealth / divisor;
  }

  function _calculateTotalFoodRequired(
    uint256 _totalHealthLost,
    uint256 _healthRestoredFromItem,
    uint256 _healingDoneFromHealth
  ) private pure returns (uint256 totalFoodRequired) {
    uint256 numerator = _totalHealthLost * HEALING_SCALE;
    uint256 denominator = _healthRestoredFromItem * _healingDoneFromHealth;
    totalFoodRequired = Math.ceilDiv(numerator, denominator);
  }

  function _getFoodConsumed(
    address from,
    uint16 regenerateId,
    uint32 _totalHealthLost,
    uint32 _totalHealthLostKilling,
    uint32 _totalHealthPlayer,
    uint256 alphaCombatHealing,
    address itemNFTAddress,
    PendingQueuedActionEquipmentState[] calldata pendingQueuedActionEquipmentStates
  ) private view returns (uint16 foodConsumed, uint256 totalFoodRequiredKilling, bool died) {
    uint256 healthRestoredFromItem;
    if (regenerateId != NONE) {
      Item memory item = IItemNFT(itemNFTAddress).getItem(regenerateId);
      healthRestoredFromItem = item.healthRestored;
    }

    if (healthRestoredFromItem == 0 || _totalHealthLost <= 0) {
      // No food attached or didn't lose any health
      died = _totalHealthLost != 0;
    } else {
      // Equation used is totalFoodRequired = totalHealthLost / (healthRestoredFromItem * healingDoneFromHealth)
      uint256 healingDoneFromHealth = _calculateHealingDoneFromHealth(_totalHealthPlayer, alphaCombatHealing);
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

      uint256 balance = getRealBalance(from, regenerateId, itemNFTAddress, pendingQueuedActionEquipmentStates);

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
    address from,
    address itemNFTAddress,
    uint256 elapsedTime,
    ActionChoice calldata actionChoice,
    PendingQueuedActionEquipmentState[] calldata pendingQueuedActionEquipmentStates
  ) external view returns (uint256 xpElapsedTime, uint16 baseInputItemsConsumedNum) {
    // Check the max that can be used
    baseInputItemsConsumedNum = uint16((elapsedTime * actionChoice.rate) / (3600 * RATE_MUL));

    if (baseInputItemsConsumedNum != 0) {
      // This checks the balances
      uint256 maxRequiredRatio = _getMaxRequiredRatio(
        from,
        actionChoice,
        baseInputItemsConsumedNum,
        IItemNFT(itemNFTAddress),
        pendingQueuedActionEquipmentStates
      );
      bool hadEnoughConsumables = baseInputItemsConsumedNum <= maxRequiredRatio;
      if (!hadEnoughConsumables) {
        baseInputItemsConsumedNum = uint16(maxRequiredRatio);
      }
    }
    // Work out what the actual elapsedTime should be had all those been made
    xpElapsedTime = (uint256(baseInputItemsConsumedNum) * 3600 * RATE_MUL) / actionChoice.rate;
  }

  function _isCombat(CombatStyle _combatStyle) private pure returns (bool) {
    return _combatStyle != CombatStyle.NONE;
  }

  function getBoostedTime(
    uint256 _actionStartTime,
    uint256 elapsedTime,
    uint40 boostStartTime,
    uint24 _boostDuration
  ) public pure returns (uint24 boostedTime) {
    uint256 actionEndTime = _actionStartTime + elapsedTime;
    uint256 boostEndTime = boostStartTime + _boostDuration;
    bool boostFinishedBeforeOrOnActionStarted = _actionStartTime >= boostEndTime;
    bool boostStartedAfterOrOnActionFinished = actionEndTime <= boostStartTime;
    uint24 actionDuration = uint24(actionEndTime - _actionStartTime);
    if (boostFinishedBeforeOrOnActionStarted || boostStartedAfterOrOnActionFinished || elapsedTime == 0) {
      // Boost was not active at all during this queued action
      boostedTime = 0;
    } else if (boostStartTime <= _actionStartTime && boostEndTime >= actionEndTime) {
      boostedTime = actionDuration;
    } else if (boostStartTime < _actionStartTime && boostEndTime < actionEndTime) {
      boostedTime = uint24(boostEndTime - _actionStartTime);
    } else if (boostStartTime > _actionStartTime && boostEndTime > actionEndTime) {
      boostedTime = uint24(actionEndTime - boostStartTime);
    } else if (boostStartTime > _actionStartTime && boostEndTime <= actionEndTime) {
      boostedTime = _boostDuration;
    } else if (boostStartTime == _actionStartTime && boostEndTime <= actionEndTime) {
      boostedTime = _boostDuration;
    } else {
      assert(false); // Should never happen
    }
  }

  function _getXPFromBoostImpl(
    bool isCombatSkill,
    uint256 _actionStartTime,
    uint256 xpElapsedTime,
    uint24 xpPerHour,
    BoostType boostType,
    uint40 boostStartTime,
    uint24 _boostDuration,
    uint16 _boostValue
  ) private pure returns (uint32 boostPointsAccrued) {
    if (
      boostType == BoostType.ANY_XP ||
      (isCombatSkill && boostType == BoostType.COMBAT_XP) ||
      (!isCombatSkill && boostType == BoostType.NON_COMBAT_XP)
    ) {
      uint256 boostedTime = getBoostedTime(_actionStartTime, xpElapsedTime, boostStartTime, _boostDuration);
      boostPointsAccrued = uint32((boostedTime * xpPerHour * _boostValue) / (3600 * 100));
    }
  }

  function _getXPFromBoost(
    bool isCombatSkill,
    uint256 _actionStartTime,
    uint256 xpElapsedTime,
    uint24 xpPerHour,
    PlayerBoostInfo storage _boostInfo
  ) private view returns (uint32 boostPointsAccrued) {
    if (_boostInfo.itemTokenId != NONE && _boostInfo.startTime < block.timestamp && xpElapsedTime != 0) {
      // A boost is active
      return
        _getXPFromBoostImpl(
          isCombatSkill,
          _actionStartTime,
          xpElapsedTime,
          xpPerHour,
          _boostInfo.boostType,
          _boostInfo.startTime,
          _boostInfo.duration,
          _boostInfo.value
        );
    }
  }

  function _getXPFromExtraOrLastBoost(
    bool isCombatSkill,
    uint256 _actionStartTime,
    uint256 xpElapsedTime,
    uint24 xpPerHour,
    PlayerBoostInfo storage _boostInfo
  ) private view returns (uint32 boostPointsAccrued) {
    if (
      _boostInfo.extraOrLastItemTokenId != NONE &&
      _boostInfo.extraOrLastStartTime < block.timestamp &&
      xpElapsedTime != 0
    ) {
      // An extra boost is active or an overriden one was active at this time
      return
        _getXPFromBoostImpl(
          isCombatSkill,
          _actionStartTime,
          xpElapsedTime,
          xpPerHour,
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

  function readXP(Skill skill, PackedXP storage packedXP) internal view returns (uint256) {
    require(!skill.isCombat() && skill != Skill.TRAVELING, InvalidXPSkill());
    if (skill == Skill.NONE) {
      return 0;
    }
    uint256 offset = 2; // Accounts for NONE & COMBAT skills
    uint256 val = uint8(skill) - offset;
    uint256 slotNum = val / 6;
    uint256 relativePos = val % 6;

    uint256 slotVal;
    assembly ("memory-safe") {
      slotVal := sload(add(packedXP.slot, slotNum))
    }

    return uint40(slotVal >> (relativePos * 40));
  }

  function getCombatStatsFromHero(
    PendingQueuedActionProcessed calldata pendingQueuedActionProcessed,
    PackedXP storage packedXP
  ) external view returns (CombatStats memory combatStats) {
    combatStats.melee = int16(
      _getLevel(_getAbsoluteActionStartXP(Skill.MELEE, pendingQueuedActionProcessed, packedXP))
    );
    combatStats.ranged = int16(
      _getLevel(_getAbsoluteActionStartXP(Skill.RANGED, pendingQueuedActionProcessed, packedXP))
    );
    combatStats.magic = int16(
      _getLevel(_getAbsoluteActionStartXP(Skill.MAGIC, pendingQueuedActionProcessed, packedXP))
    );
    combatStats.health = int16(
      _getLevel(_getAbsoluteActionStartXP(Skill.HEALTH, pendingQueuedActionProcessed, packedXP))
    );
    uint16 defenceLevel = _getLevel(_getAbsoluteActionStartXP(Skill.DEFENCE, pendingQueuedActionProcessed, packedXP));
    combatStats.meleeDefence = int16(defenceLevel);
    combatStats.rangedDefence = int16(defenceLevel);
    combatStats.magicDefence = int16(defenceLevel);
  }

  function updateCombatStatsFromSkill(
    CombatStats memory combatStats,
    uint8 skillId,
    int16 skillDiff
  ) external pure returns (CombatStats memory statsOut) {
    return _updateCombatStatsFromSkill(combatStats, skillId.asSkill(), skillDiff);
  }

  function _updateCombatStatsFromSkill(
    CombatStats memory combatStats,
    Skill skill,
    int16 skillDiff
  ) internal pure returns (CombatStats memory statsOut) {
    statsOut = combatStats;
    if (skill == Skill.MELEE) {} else if (skill == Skill.RANGED) {
      statsOut.ranged += skillDiff; // Extra/Reduced ranged damage
    } else if (skill == Skill.MAGIC) {
      statsOut.magic += skillDiff; // Extra/Reduced magic damage
    } else if (skill == Skill.DEFENCE) {
      statsOut.meleeDefence += skillDiff;
      statsOut.rangedDefence += skillDiff;
      statsOut.magicDefence += skillDiff;
    } else if (skill == Skill.HEALTH) {
      statsOut.health += skillDiff;
    } else {
      assert(false);
    }
  }

  function updateCombatStatsFromAttire(
    CombatStats memory combatStats,
    address from,
    address itemNFTAddress,
    Attire storage attire,
    PendingQueuedActionEquipmentState[] calldata pendingQueuedActionEquipmentStates
  ) external view returns (CombatStats memory statsOut) {
    statsOut = combatStats;
    bool skipNonFullAttire;
    (uint16[] memory itemTokenIds, uint256[] memory balances) = getAttireWithBalance(
      from,
      attire,
      itemNFTAddress,
      skipNonFullAttire,
      pendingQueuedActionEquipmentStates
    );
    if (itemTokenIds.length != 0) {
      Item[] memory items = IItemNFT(itemNFTAddress).getItems(itemTokenIds);
      U256 iter = items.length.asU256();
      while (iter.neq(0)) {
        iter = iter.dec();
        uint256 i = iter.asUint256();
        if (balances[i] != 0) {
          _updateCombatStatsFromItem(statsOut, items[i]);
        }
      }
    }
  }

  // none of the combat stats is allowed to be negative at this point
  function updateCombatStatsFromPet(
    CombatStats memory combatStats2,
    uint8 skillEnhancement1,
    uint8 skillFixedEnhancement1,
    uint8 skillPercentageEnhancement1,
    uint8 skillEnhancement2,
    uint8 skillFixedEnhancement2,
    uint8 skillPercentageEnhancement2
  ) external pure returns (CombatStats memory statsOut) {
    statsOut = combatStats2;
    Skill skill1 = skillEnhancement1.asSkill();
    if (skill1 == Skill.HEALTH) {
      statsOut.health += int16(skillFixedEnhancement1 + (uint16(statsOut.health) * skillPercentageEnhancement1) / 100);
    } else if (skill1 == Skill.MELEE) {
      statsOut.melee += int16(skillFixedEnhancement1 + (uint16(statsOut.melee) * skillPercentageEnhancement1) / 100);
    } else if (skill1 == Skill.RANGED) {
      statsOut.ranged += int16(skillFixedEnhancement1 + (uint16(statsOut.ranged) * skillPercentageEnhancement1) / 100);
    } else if (skill1 == Skill.MAGIC) {
      statsOut.magic += int16(skillFixedEnhancement1 + (uint16(statsOut.magic) * skillPercentageEnhancement1) / 100);
    } else if (skill1 == Skill.DEFENCE) {
      statsOut.meleeDefence += int16(
        skillFixedEnhancement1 + (uint16(statsOut.meleeDefence) * skillPercentageEnhancement1) / 100
      );
      statsOut.rangedDefence += int16(
        skillFixedEnhancement1 + (uint16(statsOut.rangedDefence) * skillPercentageEnhancement1) / 100
      );
      statsOut.magicDefence += int16(
        skillFixedEnhancement1 + (uint16(statsOut.magicDefence) * skillPercentageEnhancement1) / 100
      );
    } else {
      revert SkillForPetNotHandledYet();
    }

    Skill skill2 = skillEnhancement2.asSkill();
    if (skill2 != Skill.NONE) {
      if (skill2 == Skill.DEFENCE) {
        statsOut.meleeDefence += int16(
          skillFixedEnhancement2 + (uint16(statsOut.meleeDefence) * skillPercentageEnhancement2) / 100
        );
        statsOut.rangedDefence += int16(
          skillFixedEnhancement2 + (uint16(statsOut.rangedDefence) * skillPercentageEnhancement2) / 100
        );
        statsOut.magicDefence += int16(
          skillFixedEnhancement2 + (uint16(statsOut.magicDefence) * skillPercentageEnhancement2) / 100
        );
      } else {
        revert SkillForPetNotHandledYet();
      }
    }
  }

  // 2 versions of getAttireWithBalance exist, 1 has storage attire and the other has calldata attire. This is to
  // allow more versions of versions to accept storage attire.
  function getAttireWithBalance(
    address from,
    Attire calldata attire,
    address itemNFTAddress,
    bool skipNonFullAttire,
    PendingQueuedActionEquipmentState[] calldata pendingQueuedActionEquipmentStates
  ) public view returns (uint16[] memory itemTokenIds, uint256[] memory balances) {
    uint256 attireLength;
    itemTokenIds = new uint16[](7);
    if (attire.head != NONE) {
      itemTokenIds[attireLength++] = attire.head;
    }
    if (attire.neck != NONE && !skipNonFullAttire) {
      itemTokenIds[attireLength++] = attire.neck;
    }
    if (attire.body != NONE) {
      itemTokenIds[attireLength++] = attire.body;
    }
    if (attire.arms != NONE) {
      itemTokenIds[attireLength++] = attire.arms;
    }
    if (attire.legs != NONE) {
      itemTokenIds[attireLength++] = attire.legs;
    }
    if (attire.feet != NONE) {
      itemTokenIds[attireLength++] = attire.feet;
    }
    if (attire.ring != NONE && !skipNonFullAttire) {
      itemTokenIds[attireLength++] = attire.ring;
    }

    assembly ("memory-safe") {
      mstore(itemTokenIds, attireLength)
    }

    if (attireLength != 0) {
      balances = getRealBalances(from, itemTokenIds, itemNFTAddress, pendingQueuedActionEquipmentStates);
    }
  }

  function getAttireWithBalance(
    address from,
    Attire storage attire,
    address itemNFTAddress,
    bool skipNonFullAttire,
    PendingQueuedActionEquipmentState[] calldata pendingQueuedActionEquipmentStates
  ) public view returns (uint16[] memory itemTokenIds, uint256[] memory balances) {
    uint256 attireLength;
    itemTokenIds = new uint16[](7);
    if (attire.head != NONE) {
      itemTokenIds[attireLength++] = attire.head;
    }
    if (attire.neck != NONE && !skipNonFullAttire) {
      itemTokenIds[attireLength++] = attire.neck;
    }
    if (attire.body != NONE) {
      itemTokenIds[attireLength++] = attire.body;
    }
    if (attire.arms != NONE) {
      itemTokenIds[attireLength++] = attire.arms;
    }
    if (attire.legs != NONE) {
      itemTokenIds[attireLength++] = attire.legs;
    }
    if (attire.feet != NONE) {
      itemTokenIds[attireLength++] = attire.feet;
    }
    if (attire.ring != NONE && !skipNonFullAttire) {
      itemTokenIds[attireLength++] = attire.ring;
    }

    assembly ("memory-safe") {
      mstore(itemTokenIds, attireLength)
    }

    if (attireLength != 0) {
      balances = getRealBalances(from, itemTokenIds, itemNFTAddress, pendingQueuedActionEquipmentStates);
    }
  }

  // Subtract any existing xp gained from the first in-progress actions and add the new xp gained
  function getAbsoluteActionStartXP(
    uint8 skillId,
    PendingQueuedActionProcessed calldata pendingQueuedActionProcessed,
    PackedXP storage packedXP
  ) public view returns (uint256) {
    return _getAbsoluteActionStartXP(skillId.asSkill(), pendingQueuedActionProcessed, packedXP);
  }

  // Subtract any existing xp gained from the first in-progress actions and add the new xp gained
  function _getAbsoluteActionStartXP(
    Skill skill,
    PendingQueuedActionProcessed calldata pendingQueuedActionProcessed,
    PackedXP storage packedXP
  ) internal view returns (uint256) {
    uint256 xp = readXP(skill, packedXP);
    if (pendingQueuedActionProcessed.currentAction.skill1 == skill) {
      xp -= pendingQueuedActionProcessed.currentAction.xpGained1;
    } else if (pendingQueuedActionProcessed.currentAction.skill2 == skill) {
      xp -= pendingQueuedActionProcessed.currentAction.xpGained2;
    } else if (pendingQueuedActionProcessed.currentAction.skill3 == skill) {
      xp -= pendingQueuedActionProcessed.currentAction.xpGained3;
    }

    // Add any new xp gained from previous actions now completed that haven't been pushed to the blockchain yet. For instance
    // battling monsters may increase your level so you are stronger for a later queued action.
    for (uint256 i; i < pendingQueuedActionProcessed.skills.length; ++i) {
      if (pendingQueuedActionProcessed.skills[i] == skill) {
        xp += pendingQueuedActionProcessed.xpGainedSkills[i];
      }
    }

    return xp;
  }

  function updateStatsFromHandEquipment(
    address from,
    address itemNFTAddress,
    uint16[2] calldata handEquipmentTokenIds,
    CombatStats calldata combatStats,
    bool isCombat,
    PendingQueuedActionEquipmentState[] calldata pendingQueuedActionEquipmentStates,
    ActionChoice calldata actionChoice
  ) external view returns (bool missingRequiredHandEquipment, CombatStats memory statsOut) {
    U256 iter = handEquipmentTokenIds.length.asU256();
    statsOut = combatStats;
    while (iter.neq(0)) {
      iter = iter.dec();
      uint16 i = iter.asUint16();
      uint16 handEquipmentTokenId = handEquipmentTokenIds[i];
      if (handEquipmentTokenId != NONE) {
        uint256 balance = getRealBalance(
          from,
          handEquipmentTokenId,
          itemNFTAddress,
          pendingQueuedActionEquipmentStates
        );
        if (balance == 0) {
          // Assume that if the player doesn't have the non-combat item that this action cannot be done or if the action choice required it (e.g range bows)
          if (!isCombat || actionChoice.handItemTokenIdRangeMin != NONE) {
            missingRequiredHandEquipment = true;
          }
        } else if (isCombat) {
          // Update the combat stats
          Item memory item = IItemNFT(itemNFTAddress).getItem(handEquipmentTokenId);
          _updateCombatStatsFromItem(statsOut, item);
        }
      }
    }
  }

  function _updateCombatStatsFromItem(CombatStats memory combatStats, Item memory item) private pure {
    combatStats.melee += item.melee;
    combatStats.ranged += item.ranged;
    combatStats.magic += item.magic;
    combatStats.meleeDefence += item.meleeDefence;
    combatStats.rangedDefence += item.rangedDefence;
    combatStats.magicDefence += item.magicDefence;
    combatStats.health += item.health;
  }

  function getBonusAvatarXPPercent(Player storage player, uint8 skillId) public view returns (uint8 bonusPercent) {
    return _getBonusAvatarXPPercent(player, skillId.asSkill());
  }

  function _getBonusAvatarXPPercent(Player storage player, Skill skill) internal view returns (uint8 bonusPercent) {
    bool hasBonusSkill = player.skillBoosted1 == skill || player.skillBoosted2 == skill;
    if (!hasBonusSkill) {
      return 0;
    }
    bool bothSet = player.skillBoosted1 != Skill.NONE && player.skillBoosted2 != Skill.NONE;
    bonusPercent = bothSet ? 5 : 10;
    // Upgraded characters get double base bonus stats
    bool isUpgraded = uint8(player.packedData >> IS_FULL_MODE_BIT) & 1 == 1;
    bonusPercent = isUpgraded ? bonusPercent * 2 : bonusPercent;
  }

  function _extraFromAvatar(
    Player storage player,
    Skill skill,
    uint256 elapsedTime,
    uint24 xpPerHour
  ) internal view returns (uint32 extraPointsAccrued) {
    uint8 bonusPercent = _getBonusAvatarXPPercent(player, skill);
    extraPointsAccrued = uint32((elapsedTime * xpPerHour * bonusPercent) / (3600 * 100));
  }

  function getPointsAccrued(
    address from,
    Player storage player,
    QueuedAction storage queuedAction,
    uint256 startTime,
    uint8 skillId,
    uint256 xpElapsedTime,
    Attire storage attire,
    PlayerBoostInfo storage activeBoost,
    PlayerBoostInfo storage globalBoost,
    PlayerBoostInfo storage clanBoost,
    address itemNFTAddress,
    address worldAddress,
    uint8 bonusAttirePercent,
    uint16[5] calldata expectedItemTokenIds,
    PendingQueuedActionEquipmentState[] calldata pendingQueuedActionEquipmentStates
  ) external view returns (uint32 pointsAccrued, uint32 pointsAccruedExclBaseBoost) {
    bool isCombatSkill = queuedAction.combatStyle.isNotCombatStyle(CombatStyle.NONE);
    uint24 xpPerHour = World(worldAddress).getXPPerHour(
      queuedAction.actionId,
      isCombatSkill ? NONE : queuedAction.choiceId
    );
    pointsAccrued = uint32((xpElapsedTime * xpPerHour) / 3600);
    // Normal Player specific boosts
    pointsAccrued += _getXPFromBoost(isCombatSkill, startTime, xpElapsedTime, xpPerHour, activeBoost);
    pointsAccrued += _getXPFromExtraOrLastBoost(isCombatSkill, startTime, xpElapsedTime, xpPerHour, activeBoost);
    // Global boost
    pointsAccrued += _getXPFromBoost(isCombatSkill, startTime, xpElapsedTime, xpPerHour, globalBoost);
    pointsAccrued += _getXPFromExtraOrLastBoost(isCombatSkill, startTime, xpElapsedTime, xpPerHour, globalBoost);
    // Clan boost
    pointsAccrued += _getXPFromBoost(isCombatSkill, startTime, xpElapsedTime, xpPerHour, clanBoost);
    pointsAccrued += _getXPFromExtraOrLastBoost(isCombatSkill, startTime, xpElapsedTime, xpPerHour, clanBoost);
    pointsAccrued += _extraXPFromFullAttire(
      from,
      attire,
      xpElapsedTime,
      xpPerHour,
      itemNFTAddress,
      bonusAttirePercent,
      expectedItemTokenIds,
      pendingQueuedActionEquipmentStates
    );
    pointsAccruedExclBaseBoost = pointsAccrued;
    pointsAccrued += _extraFromAvatar(player, skillId.asSkill(), xpElapsedTime, xpPerHour);
  }

  function _extraXPFromFullAttire(
    address from,
    Attire storage attire,
    uint256 elapsedTime,
    uint24 xpPerHour,
    address itemNFTAddress,
    uint8 bonusPercent,
    uint16[5] calldata expectedItemTokenIds,
    PendingQueuedActionEquipmentState[] calldata pendingQueuedActionEquipmentStates
  ) internal view returns (uint32 extraPointsAccrued) {
    if (bonusPercent == 0) {
      return 0;
    }
    // Check if they have the full equipment set, if so they can get some bonus
    bool skipNonFullAttire = true;
    (uint16[] memory itemTokenIds, uint256[] memory balances) = getAttireWithBalance(
      from,
      attire,
      itemNFTAddress,
      skipNonFullAttire,
      pendingQueuedActionEquipmentStates
    );
    bool hasFullAttire = _extraBoostFromFullAttire(itemTokenIds, balances, expectedItemTokenIds);
    if (hasFullAttire) {
      extraPointsAccrued = uint32((elapsedTime * xpPerHour * bonusPercent) / (3600 * 100));
    }
  }

  function getSuccessPercent(
    uint16 actionId,
    uint8 actionSkillId,
    bool isCombat,
    PendingQueuedActionProcessed calldata pendingQueuedActionProcessed,
    address worldAddress,
    uint256 maxSuccessPercentChange,
    PackedXP storage packedXP
  ) external view returns (uint8 successPercent) {
    successPercent = 100;
    (uint8 actionSuccessPercent, uint32 minXP) = World(worldAddress).getActionSuccessPercentAndMinXP(actionId);
    if (actionSuccessPercent != 100) {
      require(!isCombat, InvalidAction());

      uint256 minLevel = _getLevel(minXP);
      uint256 skillLevel = _getLevel(
        _getAbsoluteActionStartXP(actionSkillId.asSkill(), pendingQueuedActionProcessed, packedXP)
      );
      uint256 extraBoost = skillLevel - minLevel;

      successPercent = uint8(Math.min(maxSuccessPercentChange, actionSuccessPercent + extraBoost));
    }
  }

  function getFullAttireBonusRewardsPercent(
    address from,
    Attire storage attire,
    address itemNFTAddress,
    PendingQueuedActionEquipmentState[] calldata pendingQueuedActionEquipmentStates,
    uint8 bonusRewardsPercent,
    uint16[5] calldata fullAttireBonusItemTokenIds
  ) external view returns (uint8 fullAttireBonusRewardsPercent) {
    if (bonusRewardsPercent == 0) {
      return 0;
    }

    // Check if they have the full equipment set, if so they can get some bonus
    bool skipNonFullAttire = true;
    (uint16[] memory itemTokenIds, uint256[] memory balances) = getAttireWithBalance(
      from,
      attire,
      itemNFTAddress,
      skipNonFullAttire,
      pendingQueuedActionEquipmentStates
    );
    bool hasFullAttire = _extraBoostFromFullAttire(itemTokenIds, balances, fullAttireBonusItemTokenIds);

    if (hasFullAttire) {
      fullAttireBonusRewardsPercent = bonusRewardsPercent;
    }
  }
}
