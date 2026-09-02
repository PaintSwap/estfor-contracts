// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IPlayers} from "./IPlayers.sol";
import {IClans} from "./IClans.sol";
import {ICombatants} from "./ICombatants.sol";
import {AdminAccess} from "../AdminAccess.sol";

import "../globals/clans.sol";

interface ICombatantsHelper {
  function applyPlayerCombatantCooldownPenalty(uint256 playerId) external;
  function assignCombatants(
    uint256 clanId,
    bool setTerritoryCombatants,
    uint64[] calldata territoryPlayerIds,
    bool setLockedVaultCombatants,
    uint64[] calldata lockedVaultPlayerIds,
    bool setRaidCombatants,
    uint64[] calldata raidPlayerIds,
    uint256 leaderPlayerId
  ) external;
  function clearCooldowns(uint64[] calldata playerIds) external;
  function initialize(
    IPlayers players,
    IClans clans,
    ICombatants territories,
    ICombatants lockedVaults,
    ICombatants raids,
    AdminAccess adminAccess,
    bool isBeta
  ) external;
  function initializeV4() external;
  function setPlayerLeftCombatantCooldownTimestampPenalty(uint24 cooldownTimestampPenalty) external;
  event EditMemberLeftCombatantCooldownTimestampPenalty(uint256 newCooldownTimestampPenalty);
  error NotAdminAndBeta();
  error NotClans();
  error NotMemberOfClan();
  error NotOwnerOfPlayerAndActive();
  error NotSettingCombatants();
  error PlayerAlreadyExistingCombatant();
  error PlayerCannotBeInAssignedMoreThanOnce();
  error PlayerCombatantCooldownTimestamp();
  error PlayerIdsNotSortedOrDuplicates();
  error PlayerNotUpgraded(uint256 playerId);
  error RankNotHighEnough();
  error SetCombatantsIncorrectly();
}
