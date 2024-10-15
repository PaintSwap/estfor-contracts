// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {CombatStyle} from "./globals/misc.sol";

library CombatStyleLibrary {
  function asCombatStyle(uint8 _combatStyle) internal pure returns (CombatStyle) {
    return CombatStyle(_combatStyle);
  }

  function isCombatStyle(uint8 _combatStyle, CombatStyle _check) internal pure returns (bool) {
    return CombatStyle(_combatStyle) == _check;
  }

  function isNotCombatStyle(uint8 _combatStyle, CombatStyle _check) internal pure returns (bool) {
    return CombatStyle(_combatStyle) != _check;
  }
}
