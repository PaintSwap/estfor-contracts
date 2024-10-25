// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {CombatStyle} from "../globals/misc.sol";

library CombatStyleLibrary {
  error InvalidCombatStyleId(uint8 combatStyleId);
  function _asCombatStyle(uint8 combatStyleId) internal pure returns (CombatStyle) {
    require(
      combatStyleId >= uint8(type(CombatStyle).min) && combatStyleId <= uint8(type(CombatStyle).max),
      InvalidCombatStyleId(combatStyleId)
    );
    return CombatStyle(combatStyleId);
  }

  function _isCombatStyle(uint8 combatStyleId) internal pure returns (bool) {
    return _isCombatStyle(_asCombatStyle(combatStyleId));
  }

  function _isCombatStyle(uint8 combatStyleId, CombatStyle check) internal pure returns (bool) {
    return _isCombatStyle(_asCombatStyle(combatStyleId), check);
  }

  function _isCombatStyle(CombatStyle combatStyle) internal pure returns (bool) {
    return combatStyle != CombatStyle.NONE;
  }

  function _isCombatStyle(CombatStyle combatStyle, CombatStyle check) internal pure returns (bool) {
    return combatStyle == check;
  }
}
