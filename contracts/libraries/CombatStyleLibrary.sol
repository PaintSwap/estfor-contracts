// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {CombatStyle} from "../globals/misc.sol";

library CombatStyleLibrary {
  error InvalidCombatStyleId(uint8 combatStyle);

  function _asCombatStyle(uint8 combatStyle) internal pure returns (CombatStyle) {
    require(
      combatStyle >= uint8(type(CombatStyle).min) && combatStyle <= uint8(type(CombatStyle).max),
      InvalidCombatStyleId(combatStyle)
    );
    return CombatStyle(combatStyle);
  }

  function _isCombatStyle(CombatStyle combatStyle) internal pure returns (bool) {
    return combatStyle != CombatStyle.NONE;
  }

  function _isCombatStyle(uint8 combatStyle) internal pure returns (bool) {
    return _isCombatStyle(_asCombatStyle(combatStyle));
  }
}
