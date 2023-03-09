// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

// solhint-disable func-name-mixedcase

library UnsafeMath {
  function unsafe_add(uint256 a, uint256 b) internal pure returns (uint256) {
    unchecked {
      return a + b;
    }
  }

  function unsafe_sub(uint256 a, uint256 b) internal pure returns (uint256) {
    unchecked {
      return a - b;
    }
  }

  function unsafe_div(uint256 a, uint256 b) internal pure returns (uint256) {
    unchecked {
      uint256 result;
      // solhint-disable-next-line no-inline-assembly
      assembly ("memory-safe") {
        result := div(a, b)
      }
      return result;
    }
  }

  function unsafe_mul(uint256 a, uint256 b) internal pure returns (uint256) {
    unchecked {
      return a * b;
    }
  }

  function unsafe_increment(uint256 a) internal pure returns (uint256) {
    unchecked {
      return ++a;
    }
  }

  function unsafe_decrement(uint256 a) internal pure returns (uint256) {
    unchecked {
      return --a;
    }
  }
}
