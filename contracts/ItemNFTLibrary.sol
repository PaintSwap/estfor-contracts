// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/* solhint-disable no-global-import */
import "./globals/players.sol";

/* solhint-enable no-global-import */

// This file contains methods for interacting with the item NFT, used to decrease implementation deployment bytecode code.
library ItemNFTLibrary {
  function setItem(InputItem calldata _inputItem, Item storage _item) public {
    bool hasCombat;
    CombatStats calldata _combatStats = _inputItem.combatStats;
    assembly ("memory-safe") {
      hasCombat := not(iszero(_combatStats))
    }
    _item.equipPosition = _inputItem.equipPosition;
    _item.isTransferable = _inputItem.isTransferable;
    _item.exists = true;

    if (hasCombat) {
      // Combat stats
      _item.melee = _inputItem.combatStats.melee;
      _item.magic = _inputItem.combatStats.magic;
      _item.range = _inputItem.combatStats.range;
      _item.meleeDefence = _inputItem.combatStats.meleeDefence;
      _item.magicDefence = _inputItem.combatStats.magicDefence;
      _item.rangeDefence = _inputItem.combatStats.rangeDefence;
      _item.health = _inputItem.combatStats.health;
    }
    _item.skill1 = _inputItem.nonCombatStats.skill;
    _item.skillDiff1 = _inputItem.nonCombatStats.diff;

    if (_inputItem.healthRestored != 0) {
      _item.healthRestored = _inputItem.healthRestored;
    }

    if (_inputItem.boostType != BoostType.NONE) {
      _item.boostType = _inputItem.boostType;
      _item.boostValue = _inputItem.boostValue;
      _item.boostDuration = _inputItem.boostDuration;
    }

    _item.minXP = _inputItem.minXP;
    _item.skill = _inputItem.skill;
  }
}
