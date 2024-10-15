// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

// solhint-disable-next-line no-global-import
import "./globals/players.sol";

// This file contains methods for interacting with the item NFT, used to decrease implementation deployment bytecode code.
library ItemNFTLibrary {
  function setItem(ItemInput calldata _inputItem, Item storage _item) external {
    bool hasCombat;
    CombatStats calldata _combatStats = _inputItem.combatStats;
    assembly ("memory-safe") {
      hasCombat := not(iszero(_combatStats))
    }
    _item.equipPosition = _inputItem.equipPosition;
    _item.isTransferable = _inputItem.isTransferable;

    bytes1 packedData = bytes1(uint8(0x1)); // Exists
    packedData = packedData | bytes1(uint8(_inputItem.isFullModeOnly ? 1 << IS_FULL_MODE_BIT : 0));
    _item.packedData = packedData;

    if (hasCombat) {
      // Combat stats
      _item.melee = _inputItem.combatStats.melee;
      _item.ranged = _inputItem.combatStats.ranged;
      _item.magic = _inputItem.combatStats.magic;
      _item.meleeDefence = _inputItem.combatStats.meleeDefence;
      _item.rangedDefence = _inputItem.combatStats.rangedDefence;
      _item.magicDefence = _inputItem.combatStats.magicDefence;
      _item.health = _inputItem.combatStats.health;
    }

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
