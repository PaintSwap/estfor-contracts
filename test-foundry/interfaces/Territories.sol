// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "../../contracts/globals/actions.sol";
import "../../contracts/globals/clans.sol";
import "../../contracts/globals/items.sol";
import "../../contracts/globals/misc.sol";
import "../../contracts/globals/pets.sol";
import "../../contracts/globals/players.sol";
import "../../contracts/globals/promotions.sol";
import "../../contracts/globals/quests.sol";
import "../../contracts/globals/rewards.sol";

interface Territories {
    struct TerritoryInput {
        uint16 territoryId;
        uint16 percentageEmissions;
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
        address from_;
        uint16 territoryId;
        uint32 clanId;
        bool attackInProgress;
        uint40 leaderPlayerId;
    }

    struct Territory {
        uint16 territoryId;
        uint16 percentageEmissions;
        uint40 clanIdOccupier;
        uint88 unclaimedEmissions;
        uint40 lastClaimTimestamp;
        uint16 minimumMMR;
    }
    function HARVESTING_COOLDOWN() external view returns (uint256);
    function MAX_DAILY_EMISSIONS() external view returns (uint256);
    function PERCENTAGE_EMISSION_MUL() external view returns (uint256);
    function TERRITORY_ATTACKED_COOLDOWN_PLAYER() external view returns (uint256);
    function UPGRADE_INTERFACE_VERSION() external view returns (string memory);
    function addTerritories(Territories.TerritoryInput[] calldata territories) external;
    function addUnclaimedEmissions(uint256 amount) external;
    function assignCombatants(
        uint256 clanId,
        uint64[] calldata playerIds,
        uint256 combatantCooldownTimestamp,
        uint256 leaderPlayerId
    ) external;
    function attackTerritory(uint256 clanId, uint256 territoryId, uint256 leaderPlayerId) external payable;
    function blockAttacks(uint256 clanId, uint16 itemTokenId, uint256 playerId) external;
    function clanMemberLeft(uint256 clanId, uint256 playerId) external;
    function clearCooldowns(uint256 clanId) external;
    function editTerritories(Territories.TerritoryInput[] calldata territories) external;
    function getAttackCost() external view returns (uint256);
    function getClanInfo(uint256 clanId) external view returns (Territories.ClanInfo memory clanInfo);
    function getExpectedGasLimitFulfill() external view returns (uint88 expectedGasLimitFulfill);
    function getPendingAttack(uint256 pendingAttackId)
        external
        view
        returns (Territories.PendingAttack memory pendingAttack);
    function getTerritory(uint256 territoryId) external view returns (Territories.Territory memory territory);
    function getTerrorities() external view returns (Territories.Territory[] memory);
    function getTotalEmissionPercentage() external view returns (uint16 totalEmissionPercentage);
    function harvest(uint256 territoryId, uint256 playerId) external;
    function initialize(
        Territories.TerritoryInput[] calldata territories,
        address players,
        address clans,
        address brush,
        address lockedBankVaults,
        address itemNFT,
        address paintswapVRFConsumer,
        Skill[] calldata comparableSkills,
        uint8 maxClanCombatants,
        uint24 attackingCooldown,
        address adminAccess,
        address activityPoints,
        bool isBeta
    ) external;
    function initializeV3(address paintswapVRFConsumer) external;
    function isCombatant(uint256 clanId, uint256 playerId) external view returns (bool combatant);
    function owner() external view returns (address);
    function proxiableUUID() external view returns (bytes32);
    function rawFulfillRandomWords(uint256 requestId, uint256[] calldata randomWords) external;
    function removeTerritories(uint256[] calldata territoryIds) external;
    function renounceOwnership() external;
    function setActivityPoints(address activityPoints) external;
    function setAttackCooldown(uint24 attackCooldown) external;
    function setAttackInProgress(uint256 requestId) external;
    function setCombatantsHelper(address combatantsHelper) external;
    function setComparableSkills(Skill[] calldata skills) external;
    function setExpectedGasLimitFulfill(uint24 expectedGasLimitFulfill) external;
    function setMaxClanCombatants(uint8 maxClanCombatants) external;
    function setMinimumMMRs(uint256[] calldata territoryIds, uint16[] calldata minimumMMRs) external;
    function transferOwnership(address newOwner) external;
    function upgradeToAndCall(address newImplementation, bytes calldata data) external payable;
    event AddTerritories(Territories.TerritoryInput[] territories);
    event AssignCombatants(
        uint256 clanId, uint64[] playerIds, address from_, uint256 leaderPlayerId, uint256 cooldownTimestamp
    );
    event AttackTerritory(
        uint256 clanId,
        uint256 territoryId,
        address from_,
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
    event BlockingAttacks(
        uint256 clanId,
        uint256 itemTokenId,
        address from_,
        uint256 leaderPlayerId,
        uint256 blockAttacksTimestamp,
        uint256 blockAttacksCooldownTimestamp
    );
    event ClaimUnoccupiedTerritory(
        uint256 territoryId, uint256 clanId, address from_, uint256 leaderPlayerId, uint256 requestId
    );
    event Deposit(uint256 amount);
    event EditTerritories(Territories.TerritoryInput[] territories);
    event Harvest(uint256 territoryId, address from_, uint256 playerId, uint256 cooldownTimestamp, uint256 amount);
    event Initialized(uint64 version);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event RemoveCombatant(uint256 playerId, uint256 clanId);
    event RemoveTerritories(uint256[] territoryIds);
    event SetAttackCooldown(uint256 attackCooldown);
    event SetComparableSkills(Skill[] skills);
    event SetExpectedGasLimitFulfill(uint256 expectedGasLimitFulfill);
    event SetMaxClanCombatants(uint256 maxClanCombatants);
    event SetMinimumMMRs(uint256[] territoryIds, uint16[] minimumMMRs);
    event Upgraded(address indexed implementation);
    event VRFCoordinatorSet(address indexed coordinator);
    error AddressEmptyCode(address target);
    error AmountTooLow();
    error BlockAttacksCooldown();
    error CallerNotSamWitchVRF();
    error CannotAttackSelf();
    error CannotAttackWhileStillAttacking();
    error CannotChangeCombatantsDuringAttack();
    error ClanAttackingCooldown();
    error ClanCombatantsChangeCooldown();
    error ClanIsBlockingAttacks();
    error ERC1967InvalidImplementation(address implementation);
    error ERC1967NonPayable();
    error FailedCall();
    error HarvestingTooSoon();
    error InvalidEmissionPercentage();
    error InvalidInitialization();
    error InvalidSkill(Skill skill);
    error InvalidTerritory();
    error InvalidTerritoryId();
    error LengthMismatch();
    error NoCombatants();
    error NoEmissionsToHarvest();
    error NotATerritoryDefenceItem();
    error NotAdminAndBeta();
    error NotEnoughMMR(uint256 minimumMMR);
    error NotEnoughRandomWords();
    error NotInitializing();
    error NotMemberOfClan();
    error NotOwnerOfPlayerAndActive();
    error OnlyClans();
    error OnlyCombatantsHelper();
    error OnlyVRFCoordinator(address sender, address coordinator);
    error OwnableInvalidOwner(address owner);
    error OwnableUnauthorizedAccount(address account);
    error PlayerDefendingLockedVaults();
    error RankNotHighEnough();
    error RequestIdNotKnown();
    error SafeCastOverflowedUintDowncast(uint8 bits, uint256 value);
    error TooManyAttackers();
    error TooManyCombatants();
    error TooManyDefenders();
    error TransferFailed();
    error UUPSUnauthorizedCallContext();
    error UUPSUnsupportedProxiableUUID(bytes32 slot);
    error ZeroAddress();
}
