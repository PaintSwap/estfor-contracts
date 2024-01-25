// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ICombatants {
  function isCombatant(uint clanId, uint playerId) external view returns (bool);

  function assignCombatants(
    uint clanId,
    uint48[] calldata playerIds,
    uint combatantCooldownTimestamp,
    uint leaderPlayerId
  ) external;
}
