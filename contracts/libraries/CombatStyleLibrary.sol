// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {CombatStyle} from "../globals/misc.sol";

library CombatStyleLibrary {
  function asCombatStyle(uint8 combatStyle) internal pure returns (CombatStyle) {
    return CombatStyle(combatStyle);
  }

  function isCombatStyle(uint8 combatStyle, CombatStyle _check) internal pure returns (bool) {
    return isCombatStyle(CombatStyle(combatStyle), _check);
  }

  function isNotCombatStyle(uint8 combatStyle, CombatStyle _check) internal pure returns (bool) {
    return isNotCombatStyle(CombatStyle(combatStyle), _check);
  }

  function isCombatStyle(CombatStyle combatStyle, CombatStyle _check) internal pure returns (bool) {
    return combatStyle == _check;
  }

  function isNotCombatStyle(CombatStyle combatStyle, CombatStyle _check) internal pure returns (bool) {
    return combatStyle != _check;
  }

  function isCombat(CombatStyle combatStyle) internal pure returns (bool) {
    return isNotCombatStyle(combatStyle, CombatStyle.NONE);
  }
}
