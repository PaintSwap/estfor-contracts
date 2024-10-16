//SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {MockBrushToken} from "./MockBrushToken.sol";

contract MockRouter {
  function swapExactETHForTokens(
    uint256 /*amountOutMin*/,
    address[] calldata path,
    address to,
    uint256 /*deadline*/
  ) external payable returns (uint256[] memory amounts) {
    amounts = new uint256[](2);
    amounts[0] = msg.value;
    amounts[1] = msg.value / 10; // Return 10% of what is passed in
    MockBrushToken(path[1]).mint(to, amounts[1]);
  }
}
