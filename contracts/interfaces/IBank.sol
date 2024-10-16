// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IBank {
  function initialize(uint256 clanId, address bankRegistry) external;

  function depositToken(address from, uint256 playerId, address token, uint256 amount) external;
}
