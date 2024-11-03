// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface ISolidlyFactory {
  function getPair(address tokenA, address tokenB, bool stable) external view returns (address);
}
