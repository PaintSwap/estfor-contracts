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

interface CombatantsHelper {
    function UPGRADE_INTERFACE_VERSION() external view returns (string memory);
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
        address players,
        address clans,
        address territories,
        address lockedVaults,
        address raids,
        address adminAccess,
        bool isBeta
    ) external;
    function initializeV4() external;
    function owner() external view returns (address);
    function proxiableUUID() external view returns (bytes32);
    function renounceOwnership() external;
    function setPlayerLeftCombatantCooldownTimestampPenalty(uint24 cooldownTimestampPenalty) external;
    function transferOwnership(address newOwner) external;
    function upgradeToAndCall(address newImplementation, bytes calldata data) external payable;
    event EditMemberLeftCombatantCooldownTimestampPenalty(uint256 newCooldownTimestampPenalty);
    event Initialized(uint64 version);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event Upgraded(address indexed implementation);
    error AddressEmptyCode(address target);
    error ERC1967InvalidImplementation(address implementation);
    error ERC1967NonPayable();
    error FailedCall();
    error InvalidInitialization();
    error NotAdminAndBeta();
    error NotClans();
    error NotInitializing();
    error NotMemberOfClan();
    error NotOwnerOfPlayerAndActive();
    error NotSettingCombatants();
    error OwnableInvalidOwner(address owner);
    error OwnableUnauthorizedAccount(address account);
    error PlayerAlreadyExistingCombatant();
    error PlayerCannotBeInAssignedMoreThanOnce();
    error PlayerCombatantCooldownTimestamp();
    error PlayerIdsNotSortedOrDuplicates();
    error PlayerNotUpgraded(uint256 playerId);
    error RankNotHighEnough();
    error SetCombatantsIncorrectly();
    error UUPSUnauthorizedCallContext();
    error UUPSUnsupportedProxiableUUID(bytes32 slot);
}
