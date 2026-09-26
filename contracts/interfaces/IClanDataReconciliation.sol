// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Skill} from "../globals/misc.sol";
import {ITerritories} from "./ITerritories.sol";

// Neutral reconciliation ABIs. Implementations and archives do not inherit these interfaces.
interface IClansReconciliation {
  error TierInactive();
  event SetTierActive(uint256 indexed tierId, bool active);

  function setTierActive(uint8 tierId, bool active) external;
  function isTierActive(uint256 tierId) external view returns (bool);
}

interface IRaidsReconciliation {
  error InvalidStateReadRange();
  error InvalidBaseRaidSpawnPool();
  error BaseRaidStillInSpawnPool();
  event SetBaseRaidActive(uint256 indexed baseRaidId, bool active);
  event SetBaseRaidSpawnIds(uint16[] baseRaidIds);
  event TrackBaseRaid(uint256 indexed baseRaidId);

  function setBaseRaidActive(uint256 baseRaidId, bool active) external;
  function isBaseRaidActive(uint256 baseRaidId) external view returns (bool);
  function setBaseRaidSpawnIds(uint16[] calldata baseRaidIds) external;
  function getBaseRaidSpawnIds() external view returns (uint16[] memory ids, bool configured);
  function registerBaseRaidIds(uint256[] calldata baseRaidIds) external;
  function getBaseRaidDiscoveryState() external view returns (uint256 count, bool complete);
  function getTrackedBaseRaidIds(uint256 start, uint256 end) external view returns (uint256[] memory ids);
}

interface IClanBattleSkillsReconciliation {
  function replaceComparableSkills(Skill[] calldata skills) external;
  function getComparableSkills() external view returns (Skill[] memory);
}

interface IPVPBattleSkillsReconciliation {
  function replaceComparableSkills(Skill[] calldata skills, uint8 numSkillsToCompare) external;
  function getComparableSkills() external view returns (Skill[] memory);
  function getNumSkillsToCompare() external view returns (uint8);
}

interface ITerritoriesReconciliation {
  function restoreTerritories(ITerritories.TerritoryInput[] calldata territories) external;
}
