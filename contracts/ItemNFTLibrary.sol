// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

// solhint-disable-next-line no-global-import
import "./globals/players.sol";

// This file contains methods for interacting with the item NFT, used to decrease implementation deployment bytecode code.
library ItemNFTLibrary {
  function setItem(ItemInput calldata inputItem, Item storage item) external {
    bool hasCombat;
    CombatStats calldata combatStats = inputItem.combatStats;
    assembly ("memory-safe") {
      hasCombat := not(iszero(combatStats))
    }
    item.equipPosition = inputItem.equipPosition;
    item.isTransferable = inputItem.isTransferable;

    bytes1 packedData = bytes1(uint8(0x1)); // Exists
    packedData = packedData | bytes1(uint8(inputItem.isFullModeOnly ? 1 << IS_FULL_MODE_BIT : 0));
    item.packedData = packedData;
    item.isAvailable = inputItem.isAvailable; // TODO pack

    item.questPrerequisiteId = inputItem.questPrerequisiteId;

    if (hasCombat) {
      // Combat stats
      item.melee = inputItem.combatStats.melee;
      item.ranged = inputItem.combatStats.ranged;
      item.magic = inputItem.combatStats.magic;
      item.meleeDefence = inputItem.combatStats.meleeDefence;
      item.rangedDefence = inputItem.combatStats.rangedDefence;
      item.magicDefence = inputItem.combatStats.magicDefence;
      item.health = inputItem.combatStats.health;
    }

    if (inputItem.healthRestored != 0) {
      item.healthRestored = inputItem.healthRestored;
    }

    if (inputItem.boostType != BoostType.NONE) {
      item.boostType = inputItem.boostType;
      item.boostValue = inputItem.boostValue;
      item.boostDuration = inputItem.boostDuration;
    }

    item.minXP = inputItem.minXP;
    item.skill = inputItem.skill;
  }
}
