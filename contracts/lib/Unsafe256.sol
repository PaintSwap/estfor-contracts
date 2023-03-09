// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {UnsafeMath} from "./UnsafeMath.sol";
import {U256} from "./types/U256.sol";

library Unsafe256 {
  using UnsafeMath for uint256;

  function asUint256(U256 _u256) internal pure returns (uint256) {
    return U256.unwrap(_u256);
  }

  function asUint128(U256 _u256) internal pure returns (uint128) {
    return uint128(U256.unwrap(_u256));
  }

  function asUint64(U256 _u256) internal pure returns (uint64) {
    return uint64(U256.unwrap(_u256));
  }

  function asUint32(U256 _u256) internal pure returns (uint32) {
    return uint32(U256.unwrap(_u256));
  }

  function asUint16(U256 _u256) internal pure returns (uint16) {
    return uint16(U256.unwrap(_u256));
  }

  function asUint8(U256 _u256) internal pure returns (uint8) {
    return uint8(U256.unwrap(_u256));
  }

  function inc(U256 _u256) internal pure returns (U256) {
    return U256.wrap(U256.unwrap(_u256).unsafe_increment());
  }

  function dec(U256 _u256) internal pure returns (U256) {
    return U256.wrap(U256.unwrap(_u256).unsafe_decrement());
  }

  function add(U256 _u256, uint256 _value) internal pure returns (U256) {
    return U256.wrap(U256.unwrap(_u256).unsafe_add(_value));
  }

  function sub(U256 _u256, uint256 _value) internal pure returns (U256) {
    return U256.wrap(U256.unwrap(_u256).unsafe_sub(_value));
  }

  function mul(U256 _u256, uint256 _value) internal pure returns (U256) {
    return U256.wrap(U256.unwrap(_u256).unsafe_mul(_value));
  }

  function div(U256 _u256, uint256 _value) internal pure returns (U256) {
    return U256.wrap(U256.unwrap(_u256).unsafe_div(_value));
  }

  function neq(U256 _u256, uint256 _value) internal pure returns (bool) {
    return U256.unwrap(_u256) != _value;
  }

  function eq(U256 _u256, uint256 _value) internal pure returns (bool) {
    return U256.unwrap(_u256) == _value;
  }

  function gt(U256 _u256, uint256 _value) internal pure returns (bool) {
    return U256.unwrap(_u256) > _value;
  }

  function gte(U256 _u256, uint256 _value) internal pure returns (bool) {
    return U256.unwrap(_u256) >= _value;
  }

  function lt(U256 _u256, uint256 _value) internal pure returns (bool) {
    return U256.unwrap(_u256) < _value;
  }

  function lte(U256 _u256, uint256 _value) internal pure returns (bool) {
    return U256.unwrap(_u256) <= _value;
  }
}
