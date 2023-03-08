//SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "./MockBrushToken.sol";

contract MockRouter {
  function swapExactETHForTokens(
    uint amountOutMin,
    address[] calldata path,
    address to,
    uint deadline
  ) external payable returns (uint[] memory amounts) {
    amounts = new uint[](2);
    amounts[0] = msg.value;
    amounts[1] = msg.value / 10; // Return 10% of what is passed in
    MockBrushToken(path[1]).mint(to, amounts[1]);
  }
}
