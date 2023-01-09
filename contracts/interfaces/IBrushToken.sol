// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

interface IBrushToken {
  function burn(uint256 _amount) external;

  function transferFrom(
    address sender,
    address recipient,
    uint256 amount
  ) external returns (bool);
}
