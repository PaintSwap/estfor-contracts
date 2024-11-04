//SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {MockBrushToken} from "./MockBrushToken.sol";
import {ISolidlyRouter, Route} from "../../interfaces/external/ISolidlyRouter.sol";

contract MockRouter is ISolidlyRouter {
  function swapExactETHForTokens(
    uint256 /*amountOutMin*/,
    Route[] calldata routes,
    address to,
    uint256 /*deadline */
  ) external payable override returns (uint256[] memory amounts) {
    amounts = new uint256[](2);
    amounts[0] = msg.value;
    amounts[1] = msg.value / 10; // Return 10% of what is passed in
    MockBrushToken(routes[0].to).mint(to, amounts[1]);
  }

  function swapETHForExactTokens(
    uint256 amountOut,
    Route[] calldata routes,
    address to,
    uint256 /* deadline */
  ) external payable returns (uint[] memory amounts) {
    amounts = new uint256[](2);
    amounts[0] = msg.value;
    amounts[1] = amountOut;
    MockBrushToken(routes[0].to).mint(to, amounts[1]);
  }

  function swapExactTokensForETH(
    uint256 amountIn,
    uint256 /*amountOutMin*/,
    Route[] calldata routes,
    address to,
    uint256 /*deadline*/
  ) external override returns (uint256[] memory amounts) {
    MockBrushToken(routes[0].from).transferFrom(msg.sender, address(this), amountIn);
    MockBrushToken(routes[0].from).burn(amountIn);
    amounts = new uint256[](2);
    amounts[0] = amountIn;
    amounts[1] = amountIn / 10; // Return 10% of what is passed in
    payable(to).call{value: amounts[1]}("");
  }

  function swapTokensForExactETH(
    uint256 amountOut,
    uint256 amountInMax,
    Route[] calldata routes,
    address to,
    uint256 /* deadline */
  ) external returns (uint[] memory amounts) {
    MockBrushToken(routes[0].from).transferFrom(msg.sender, address(this), amountInMax);
    MockBrushToken(routes[0].from).burn(amountInMax);
    amounts = new uint256[](2);
    amounts[0] = amountInMax;
    amounts[1] = amountOut;
    payable(to).call{value: amounts[1]}("");
  }
}
