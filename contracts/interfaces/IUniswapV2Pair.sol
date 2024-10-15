// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

interface IUniswapV2Pair {
  function balanceOf(address owner) external view returns (uint);

  function mint(address to) external returns (uint liquidity);
}
