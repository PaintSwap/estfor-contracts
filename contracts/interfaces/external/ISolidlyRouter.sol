// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

struct Route {
  address from;
  address to;
  bool stable;
}

interface ISolidlyRouter {
  function swapExactETHForTokens(
    uint amountOutMin,
    Route[] calldata routes,
    address to,
    uint deadline
  ) external payable returns (uint[] memory amounts);

  function swapETHForExactTokens(
    uint amountOut,
    Route[] calldata routes,
    address to,
    uint deadline
  ) external payable returns (uint[] memory amounts);

  function swapExactTokensForETH(
    uint256 amountIn,
    uint256 amountOutMin,
    Route[] calldata routes,
    address to,
    uint256 deadline
  ) external returns (uint256[] memory amounts);

  function swapTokensForExactETH(
    uint amountOut,
    uint amountInMax,
    Route[] calldata routes,
    address to,
    uint deadline
  ) external returns (uint[] memory amounts);
}