// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ICombatants} from "./ICombatants.sol";
import {IClanMemberLeftCB} from "./IClanMemberLeftCB.sol";
import {IClans} from "./IClans.sol";
import {ILockedBankVaults} from "./ILockedBankVaults.sol";
import {IBrushToken} from "./external/IBrushToken.sol";
import {AdminAccess} from "../AdminAccess.sol";
import {ItemNFT} from "../ItemNFT.sol";
import {IActivityPoints} from "../ActivityPoints/interfaces/IActivityPoints.sol";
import {Skill} from "../globals/misc.sol";

interface ITerritories is ICombatants, IClanMemberLeftCB {
  struct TerritoryInput {
    uint16 territoryId;
    uint16 percentageEmissions;
  }

  struct Territory {
    uint16 territoryId;
    uint16 percentageEmissions;
    uint40 clanIdOccupier;
    uint88 unclaimedEmissions;
    uint40 lastClaimTimestamp;
    uint16 minimumMMR;
  }

  struct ClanInfo {
    uint16 ownsTerritoryId;
    uint40 attackingCooldownTimestamp;
    uint40 assignCombatantsCooldownTimestamp;
    bool currentlyAttacking;
    uint40 blockAttacksTimestamp;
    uint8 blockAttacksCooldownHours;
    uint64[] playerIds;
  }

  struct PendingAttack {
    address from;
    uint16 territoryId;
    uint32 clanId;
    bool attackInProgress;
    uint40 leaderPlayerId;
  }

  event AddTerritories(TerritoryInput[] territories);
  event EditTerritories(TerritoryInput[] territories);
  event RemoveTerritories(uint256[] territoryIds);
  event SetMinimumMMRs(uint256[] territoryIds, uint16[] minimumMMRs);
  event AttackTerritory(
    uint256 clanId,
    uint256 territoryId,
    address from,
    uint256 leaderPlayerId,
    uint256 requestId,
    uint256 pendingAttackId,
    uint256 attackingCooldownTimestamp
  );
  event BattleResult(
    uint256 requestId,
    uint64[] attackingPlayerIds,
    uint64[] defendingPlayerIds,
    uint256[] attackingRolls,
    uint256[] defendingRolls,
    uint8[] battleResults,
    uint8[] randomSkills,
    bool didAttackersWin,
    uint256 attackingClanId,
    uint256 defendingClanId,
    uint256[] randomWords,
    uint256 territoryId,
    uint256 clanXPGainedWinner
  );
  event Deposit(uint256 amount);
  event SetComparableSkills(Skill[] skills);
  event ClaimUnoccupiedTerritory(
    uint256 territoryId,
    uint256 clanId,
    address from,
    uint256 leaderPlayerId,
    uint256 requestId
  );
  event AssignCombatants(
    uint256 clanId,
    uint64[] playerIds,
    address from,
    uint256 leaderPlayerId,
    uint256 cooldownTimestamp
  );
  event RemoveCombatant(uint256 playerId, uint256 clanId);
  event Harvest(uint256 territoryId, address from, uint256 playerId, uint256 cooldownTimestamp, uint256 amount);
  event SetExpectedGasLimitFulfill(uint256 expectedGasLimitFulfill);
  event SetMaxClanCombatants(uint256 maxClanCombatants);
  event BlockingAttacks(
    uint256 clanId,
    uint256 itemTokenId,
    address from,
    uint256 leaderPlayerId,
    uint256 blockAttacksTimestamp,
    uint256 blockAttacksCooldownTimestamp
  );
  event SetAttackCooldown(uint256 attackCooldown);

  error InvalidTerritory();
  error InvalidTerritoryId();
  error InvalidEmissionPercentage();
  error TransferFailed();
  error RankNotHighEnough();
  error ClanAttackingCooldown();
  error NotMemberOfClan();
  error InvalidSkill(Skill skill);
  error LengthMismatch();
  error OnlyClans();
  error OnlyCombatantsHelper();
  error NotOwnerOfPlayerAndActive();
  error HarvestingTooSoon();
  error NotAdminAndBeta();
  error NoCombatants();
  error TooManyCombatants();
  error PlayerDefendingLockedVaults();
  error CannotChangeCombatantsDuringAttack();
  error NoEmissionsToHarvest();
  error CannotAttackWhileStillAttacking();
  error AmountTooLow();
  error ClanCombatantsChangeCooldown();
  error RequestIdNotKnown();
  error ClanIsBlockingAttacks();
  error NotATerritoryDefenceItem();
  error BlockAttacksCooldown();
  error CannotAttackSelf();
  error CallerNotSamWitchVRF();
  error NotEnoughMMR(uint256 minimumMMR);

  function HARVESTING_COOLDOWN() external view returns (uint256);
  function MAX_DAILY_EMISSIONS() external view returns (uint256);
  function PERCENTAGE_EMISSION_MUL() external view returns (uint256);
  function TERRITORY_ATTACKED_COOLDOWN_PLAYER() external view returns (uint256);
  function initialize(
    TerritoryInput[] calldata territories,
    address players,
    IClans clans,
    IBrushToken brush,
    ILockedBankVaults lockedBankVaults,
    ItemNFT itemNFT,
    address paintswapVRFConsumer,
    Skill[] calldata comparableSkills,
    uint8 maxClanCombatants,
    uint24 attackingCooldown,
    AdminAccess adminAccess,
    IActivityPoints activityPoints,
    bool isBeta
  ) external;
  function setActivityPoints(address activityPoints) external;
  function initializeV3(address paintswapVRFConsumer) external;
  function attackTerritory(uint256 clanId, uint256 territoryId, uint256 leaderPlayerId) external payable;
  function harvest(uint256 territoryId, uint256 playerId) external;
  function addUnclaimedEmissions(uint256 amount) external;
  function blockAttacks(uint256 clanId, uint16 itemTokenId, uint256 playerId) external;
  function getAttackCost() external view returns (uint256);
  function getTerrorities() external view returns (Territory[] memory);
  function getClanInfo(uint256 clanId) external view returns (ClanInfo memory);
  function getPendingAttack(uint256 pendingAttackId) external view returns (PendingAttack memory);
  function getTerritory(uint256 territoryId) external view returns (Territory memory);
  function getExpectedGasLimitFulfill() external view returns (uint88);
  function getTotalEmissionPercentage() external view returns (uint16);
  function addTerritories(TerritoryInput[] calldata territories) external;
  function editTerritories(TerritoryInput[] calldata territories) external;
  function removeTerritories(uint256[] calldata territoryIds) external;
  function setMinimumMMRs(uint256[] calldata territoryIds, uint16[] calldata minimumMMRs) external;
  function setComparableSkills(Skill[] calldata skills) external;
  function setCombatantsHelper(address combatantsHelper) external;
  function setExpectedGasLimitFulfill(uint24 expectedGasLimitFulfill) external;
  function setMaxClanCombatants(uint8 maxClanCombatants) external;
  function setAttackCooldown(uint24 attackCooldown) external;
  function clearCooldowns(uint256 clanId) external;
  function setAttackInProgress(uint256 requestId) external;
}
