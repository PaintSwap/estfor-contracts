// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface ICombatantsHelper {
 
  function setPlayerLeftCombatantCooldownTimestampPenalty(uint24 cooldownTimestampPenalty) external;

  function applyPlayerCombatantCooldownPenalty(uint256 playerId) external;
}
