// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {CombatStyle} from "../globals/misc.sol";

library CombatStyleLibrary {
  error InvalidCombatStyle();
  function asCombatStyle(uint8 combatStyle) internal pure returns (CombatStyle) {
    require(
      combatStyle >= uint8(type(CombatStyle).min) && combatStyle <= uint8(type(CombatStyle).max),
      InvalidCombatStyle()
    );
    return CombatStyle(combatStyle);
  }

  function isCombatStyle(uint8 combatStyle, CombatStyle check) internal pure returns (bool) {
    return isCombatStyle(asCombatStyle(combatStyle), check);
  }

  function isNotCombatStyle(uint8 combatStyle, CombatStyle check) internal pure returns (bool) {
    return isNotCombatStyle(asCombatStyle(combatStyle), check);
  }

  function isCombatStyle(CombatStyle combatStyle, CombatStyle check) internal pure returns (bool) {
    return combatStyle == check;
  }

  function isNotCombatStyle(CombatStyle combatStyle, CombatStyle check) internal pure returns (bool) {
    return combatStyle != check;
  }

  function isCombat(CombatStyle combatStyle) internal pure returns (bool) {
    return isNotCombatStyle(combatStyle, CombatStyle.NONE);
  }
}
