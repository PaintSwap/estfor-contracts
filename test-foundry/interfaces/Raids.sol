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

interface Raids {
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
    function UPGRADE_INTERFACE_VERSION() external view returns (string memory);
    function addBaseRaids(uint256[] calldata baseRaidIds, Raids.BaseRaid[] calldata baseRaids) external;
    function assignCombatants(
        uint256 clanId,
        uint64[] calldata playerIds,
        uint256 combatantCooldownTimestamp,
        uint256 leaderPlayerId
    ) external;
    function clanMemberLeft(uint256 clanId, uint256 playerId) external;
    function editBaseRaids(uint256[] calldata baseRaidIds, Raids.BaseRaid[] calldata baseRaids) external;
    function getAttackCost() external view returns (uint256);
    function getRaidInfo(uint256 raidId) external view returns (Raids.RaidInfo memory);
    function initialize(
        address players,
        address itemNFT,
        address clans,
        address paintswapVRFConsumer,
        uint24 spawnRaidCooldown,
        address brush,
        address worldActions,
        address randomnessBeacon,
        uint8 maxClanCombatants,
        uint16[] calldata combatActionIds,
        bool isBeta
    ) external;
    function initializeAddresses(address combatantsHelper, address bankFactory) external;
    function initializeV3(address paintswapVRFConsumer) external;
    function isCombatant(uint256 clanId, uint256 playerId) external view returns (bool);
    function owner() external view returns (address);
    function proxiableUUID() external view returns (bytes32);
    function rawFulfillRandomWords(uint256 requestId, uint256[] calldata randomWords) external;
    function renounceOwnership() external;
    function requestFightRaid(uint64 playerId, uint40 clanId, uint40 raidId, uint16 regenerateId) external payable;
    function requestSpawnRaid(uint64 playerId) external payable;
    function setCombatActions(uint16[] calldata combatActionIds) external;
    function setExpectedGasLimitFulfill(uint24 expectedGasLimitFulfill) external;
    function setMaxClanCombatants(uint8 maxClanCombatants) external;
    function setPreventRaids(bool preventRaids) external;
    function setSpawnRaidCooldown(uint24 spawnRaidCooldown) external;
    function transferOwnership(address newOwner) external;
    function upgradeToAndCall(address newImplementation, bytes calldata data) external payable;
    event AddBaseRaids(uint256[] baseRaidIds, Raids.BaseRaid[] baseRaids);
    event AssignCombatants(
        uint256 clanId, uint64[] playerIds, address from_, uint256 leaderPlayerId, uint256 cooldownTimestamp
    );
    event EditBaseRaids(uint256[] baseRaidIds, Raids.BaseRaid[] baseRaids);
    event Initialized(uint64 version);
    event NewRaidsSpawned(uint40 startRaidId, Raids.RaidInfo[] raidInfos, uint256 requestId);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
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
    event RemoveCombatant(uint256 playerId, uint256 clanId);
    event RequestFightRaid(uint256 playerId, uint56 clanId, uint256 raidId, uint256 requestId);
    event RequestSpawnRaid(uint256 playerId, uint256 requestId);
    event SetCombatActions(uint16[] combatActionIds);
    event SetExpectedGasLimitFulfill(uint256 expectedGasLimitFulfill);
    event SetMaxClanCombatants(uint256 maxClanCombatants);
    event SetPreventRaids(bool preventRaids);
    event SetSpawnRaidCooldown(uint256 spawnRaidCooldown);
    event Upgraded(address indexed implementation);
    event VRFCoordinatorSet(address indexed coordinator);
    error AddressEmptyCode(address target);
    error CallerNotSamWitchVRF();
    error ClanCombatantsChangeCooldown();
    error ERC1967InvalidImplementation(address implementation);
    error ERC1967NonPayable();
    error FailedCall();
    error InvalidInitialization();
    error LengthMismatch();
    error NoCombatants();
    error NotInRange();
    error NotInitializing();
    error NotOwnerOfPlayerAndActive();
    error OnlyClans();
    error OnlyCombatantsHelper();
    error OnlyVRFCoordinator(address sender, address coordinator);
    error OwnableInvalidOwner(address owner);
    error OwnableUnauthorizedAccount(address account);
    error PreviousRaidNotSpawnedYet();
    error RaidAlreadyExists();
    error RaidDoesNotExist();
    error RaidInProgress();
    error RaidsPrevented();
    error RankNotHighEnough();
    error RequestDoesNotExist();
    error TooManyCombatants();
    error UUPSUnauthorizedCallContext();
    error UUPSUnsupportedProxiableUUID(bytes32 slot);
    error ZeroAddress();
}
