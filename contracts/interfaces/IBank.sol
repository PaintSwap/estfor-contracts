// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IBank {
  function initialize(uint clanId, address bankRegistry) external;

  function depositToken(address from, uint playerId, address token, uint amount) external;
}
