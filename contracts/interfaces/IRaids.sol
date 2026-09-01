// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IClanMemberLeftCB} from "./IClanMemberLeftCB.sol";
import {ICombatants} from "./ICombatants.sol";
import {IPlayers} from "./IPlayers.sol";
import {IClans} from "./IClans.sol";
import {IBankFactory} from "./IBankFactory.sol";
import {IBrushToken} from "./external/IBrushToken.sol";
import {ItemNFT} from "../ItemNFT.sol";
import {IWorldActions} from "./IWorldActions.sol";
import {RandomnessBeacon} from "../RandomnessBeacon.sol";

interface IRaids is ICombatants, IClanMemberLeftCB {
  struct BaseRaid {
    uint8 tier;
    int16 minHealth;
    int16 maxHealth;
    int16 minMeleeAttack;
    int16 maxMeleeAttack;
    int16 minMagicAttack;
    int16 maxMagicAttack;
    int16 minRangedAttack;
    int16 maxRangedAttack;
    int16 minMeleeDefence;
    int16 maxMeleeDefence;
    int16 minMagicDefence;
    int16 maxMagicDefence;
    int16 minRangedDefence;
    int16 maxRangedDefence;
    uint16[16] randomLootTokenIds;
    uint32[16] randomLootTokenAmounts;
    uint16[16] randomChances;
  }

  struct RaidInfo {
    uint16 baseRaidId;
    int16 health;
    int16 meleeAttack;
    int16 magicAttack;
    int16 rangedAttack;
    int16 meleeDefence;
    int16 magicDefence;
    int16 rangedDefence;
    uint8 tier;
    uint16[5] combatActionIds;
  }

  function initialize(
    IPlayers players,
    ItemNFT itemNFT,
    IClans clans,
    address paintswapVRFConsumer,
    uint24 spawnRaidCooldown,
    IBrushToken brush,
    IWorldActions worldActions,
    RandomnessBeacon randomnessBeacon,
    uint8 maxClanCombatants,
    uint16[] calldata combatActionIds,
    bool isBeta
  ) external;
  function initializeV3(address paintswapVRFConsumer) external;
  function requestSpawnRaid(uint64 playerId) external payable;
  function requestFightRaid(uint64 playerId, uint40 clanId, uint40 raidId, uint16 regenerateId) external payable;
  function getRaidInfo(uint256 raidId) external view returns (RaidInfo memory);
  function getAttackCost() external view returns (uint256);
  function setExpectedGasLimitFulfill(uint24 expectedGasLimitFulfill) external;
  function addBaseRaids(uint256[] calldata baseRaidIds, BaseRaid[] calldata baseRaids) external;
  function editBaseRaids(uint256[] calldata baseRaidIds, BaseRaid[] calldata baseRaids) external;
  function setSpawnRaidCooldown(uint24 spawnRaidCooldown) external;
  function setMaxClanCombatants(uint8 maxClanCombatants) external;
  function setPreventRaids(bool preventRaids) external;
  function setCombatActions(uint16[] calldata combatActionIds) external;
  function initializeAddresses(address combatantsHelper, IBankFactory bankFactory) external;

  event AssignCombatants(
    uint256 clanId,
    uint64[] playerIds,
    address from,
    uint256 leaderPlayerId,
    uint256 cooldownTimestamp
  );
  event RequestFightRaid(uint256 playerId, uint56 clanId, uint256 raidId, uint256 requestId);
  event SetExpectedGasLimitFulfill(uint256 expectedGasLimitFulfill);
  event SetSpawnRaidCooldown(uint256 spawnRaidCooldown);
  event RequestSpawnRaid(uint256 playerId, uint256 requestId);
  event AddBaseRaids(uint256[] baseRaidIds, BaseRaid[] baseRaids);
  event EditBaseRaids(uint256[] baseRaidIds, BaseRaid[] baseRaids);
  event RemoveCombatant(uint256 playerId, uint256 clanId);
  event NewRaidsSpawned(uint40 startRaidId, RaidInfo[] raidInfos, uint256 requestId);
  event RaidBattleOutcome(
    uint256 clanId,
    uint256 raidId,
    uint256 requestId,
    uint256 regenerateId,
    uint256 regenerateAmountUsed,
    uint16[] choiceIds,
    uint256 bossChoiceId,
    bool defeatedRaid,
    uint256[] lootTokenIds,
    uint256[] lootTokenAmounts
  );
  event SetPreventRaids(bool preventRaids);
  event SetMaxClanCombatants(uint256 maxClanCombatants);
  event SetCombatActions(uint16[] combatActionIds);

  error NotOwnerOfPlayerAndActive();
  error RequestDoesNotExist();
  error CallerNotSamWitchVRF();
  error RankNotHighEnough();
  error RaidInProgress();
  error LengthMismatch();
  error OnlyCombatantsHelper();
  error OnlyClans();
  error PreviousRaidNotSpawnedYet();
  error TooManyCombatants();
  error ClanCombatantsChangeCooldown();
  error RaidAlreadyExists();
  error RaidDoesNotExist();
  error NotInRange();
  error RaidsPrevented();
  error NoCombatants();
}
