// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface ICombatants {
  function isCombatant(uint256 clanId, uint256 playerId) external view returns (bool);

  function assignCombatants(
    uint256 clanId,
    uint64[] calldata playerIds,
    uint256 combatantCooldownTimestamp,
    uint256 leaderPlayerId
  ) external;
}
