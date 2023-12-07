// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ITerritories {
  function addUnclaimedEmissions(uint amount) external;

  function isCombatant(uint clanId, uint playerId) external view returns (bool);
}
