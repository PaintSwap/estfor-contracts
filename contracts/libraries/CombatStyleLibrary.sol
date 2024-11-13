// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {CombatStyle} from "../globals/misc.sol";

library CombatStyleLibrary {
  error InvalidCombatStyleId(uint8 combatStyle);

  function _asCombatStyle(bytes1 packed) internal pure returns (CombatStyle) {
    uint8 combatStyle = uint8(packed) & 0x3; // first 2 bits

    require(
      combatStyle >= uint8(type(CombatStyle).min) && combatStyle <= uint8(type(CombatStyle).max),
      InvalidCombatStyleId(combatStyle)
    );
    return CombatStyle(combatStyle);
  }

  function _isCombatStyle(uint8 packed) internal pure returns (bool) {
    return _isCombatStyle(_asCombatStyle(bytes1(packed)));
  }

  function _isCombatStyle(uint8 packed, CombatStyle check) internal pure returns (bool) {
    return _isCombatStyle(_asCombatStyle(bytes1(packed)), check);
  }

  function _isCombatStyle(bytes1 packed) internal pure returns (bool) {
    return _isCombatStyle(_asCombatStyle(packed));
  }

  function _isCombatStyle(bytes1 packed, CombatStyle check) internal pure returns (bool) {
    return _isCombatStyle(_asCombatStyle(packed), check);
  }

  function _isCombatStyle(CombatStyle combatStyle) internal pure returns (bool) {
    return combatStyle != CombatStyle.NONE;
  }

  function _isCombatStyle(CombatStyle combatStyle, CombatStyle check) internal pure returns (bool) {
    return combatStyle == check;
  }
}
