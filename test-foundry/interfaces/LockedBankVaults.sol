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

interface LockedBankVaults {
    function UPGRADE_INTERFACE_VERSION() external view returns (string memory);
    function assignCombatants(
        uint256 clanId,
        uint64[] calldata playerIds,
        uint256 combatantCooldownTimestamp,
        uint256 leaderPlayerId
    ) external;
    function attackVaults(uint256 clanId, uint256 defendingClanId, uint16 itemTokenId, uint256 leaderPlayerId)
        external
        payable;
    function blockAttacks(uint256 clanId, uint16 itemTokenId, uint256 playerId) external;
    function claimFunds(uint256 clanId, uint256 playerId) external;
    function clanMemberLeft(uint256 clanId, uint256 playerId) external;
    function clearCooldowns(uint256 clanId, uint256[] calldata otherClanIds) external;
    function forceMMRUpdate(uint256[] calldata clanIds) external;
    function getAttackCost() external view returns (uint256);
    function getClanInfo(uint256 clanId) external view returns (VaultClanInfo memory);
    function getIdleClans() external view returns (uint256[] memory clanIds);
    function getLastClanBattles(uint256 clanId, uint256 otherClanId) external view returns (ClanBattleInfo memory);
    function getSortedClanIdsByMMR() external view returns (uint32[] memory);
    function getSortedMMR() external view returns (uint16[] memory);
    function initialize(
        address players,
        address clans,
        address brush,
        address bankRelay,
        address itemNFT,
        address treasury,
        address dev,
        address paintswapVRFConsumer,
        Skill[] calldata comparableSkills,
        uint16 mmrAttackDistance,
        uint24 lockFundsPeriod,
        uint8 maxClanCombatants,
        uint8 maxLockedVaults,
        address adminAccess,
        address activityPoints,
        bool isBeta
    ) external;
    function initializeAddresses(address territories, address combatantsHelper, address bankFactory) external;
    function initializeMMR(uint256[] calldata clanIds, uint16[] calldata mmrs, bool clear) external;
    function initializeV3(address paintswapVRFConsumer) external;
    function isCombatant(uint256 clanId, uint256 playerId) external view returns (bool);
    function lockFunds(uint256 clanId, address from_, uint256 playerId, uint256 amount) external;
    function owner() external view returns (address);
    function proxiableUUID() external view returns (bytes32);
    function rawFulfillRandomWords(uint256 requestId, uint256[] calldata randomWords) external;
    function renounceOwnership() external;
    function setActivityPoints(address activityPoints) external;
    function setAttackInProgress(uint256 requestId) external;
    function setBrushDistributionPercentages(
        uint8 brushBurntPercentage,
        uint8 brushTreasuryPercentage,
        uint8 brushDevPercentage
    ) external;
    function setComparableSkills(Skill[] calldata skills) external;
    function setDevAddress(address dev) external;
    function setExpectedGasLimitFulfill(uint24 expectedGasLimitFulfill) external;
    function setKValues(uint8 kA, uint8 kD) external;
    function setMMRAttackDistance(uint16 mmrAttackDistance) external;
    function setMaxClanCombatants(uint8 maxClanCombatants) external;
    function setMaxLockedVaults(uint8 maxLockedVaults) external;
    function setPreventAttacks(bool preventAttacks) external;
    function transferOwnership(address newOwner) external;
    function upgradeToAndCall(address newImplementation, bytes calldata data) external payable;
    event AssignCombatants(
        uint256 clanId, uint64[] playerIds, address from_, uint256 leaderPlayerId, uint256 cooldownTimestamp
    );
    event AttackVaults(
        uint256 clanId,
        uint256 defendingClanId,
        address from_,
        uint256 leaderPlayerId,
        uint256 requestId,
        uint256 pendingAttackId,
        uint256 attackingCooldownTimestamp,
        uint256 reattackingCooldownTimestamp,
        uint256 itemTokenId
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
        uint256 percentageToTake,
        uint256 brushLost,
        int256 attackingMMRDiff,
        int256 defendingMMRDiff,
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
    event ClaimFunds(uint256 clanId, address from_, uint256 playerId, uint256 amount, uint256 numLocksClaimed);
    event ForceMMRUpdate(uint256[] clanIdsToDelete);
    event Initialized(uint64 version);
    event LockFunds(uint256 clanId, address from_, uint256 playerId, uint256 amount, uint256 lockingTimestamp);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event RemoveCombatant(uint256 playerId, uint256 clanId);
    event SetBrushDistributionPercentages(
        uint256 brushBurntPercentage, uint256 brushTreasuryPercentage, uint256 brushDevPercentage
    );
    event SetComparableSkills(Skill[] skills);
    event SetExpectedGasLimitFulfill(uint256 expectedGasLimitFulfill);
    event SetKValues(uint256 Ka, uint256 Kd);
    event SetMMRAttackDistance(uint256 mmrAttackDistance);
    event SetMMRs(uint256[] clanIds, uint16[] mmrs);
    event SetMaxClanCombatants(uint256 maxClanCombatants);
    event SetMaxLockedVaults(uint256 maxLockedVaults);
    event SetPreventAttacks(bool preventAttacks);
    event SuperAttackCooldown(uint256 clanId, uint256 cooldownTimestamp);
    event Upgraded(address indexed implementation);
    event VRFCoordinatorSet(address indexed coordinator);
    error AddressEmptyCode(address target);
    error AttacksPrevented();
    error CallerNotSamWitchVRF();
    error CannotChangeCombatantsDuringAttack();
    error ERC1967InvalidImplementation(address implementation);
    error ERC1967NonPayable();
    error FailedCall();
    error InvalidInitialization();
    error InvalidSkill(Skill skill);
    error LengthMismatch();
    error NotAdminAndBeta();
    error NotInitializing();
    error NotMemberOfClan();
    error NotOwnerOfPlayerAndActive();
    error OnlyClans();
    error OnlyCombatantsHelper();
    error OnlyTerritories();
    error OnlyVRFCoordinator(address sender, address coordinator);
    error OwnableInvalidOwner(address owner);
    error OwnableUnauthorizedAccount(address account);
    error PercentNotTotal100();
    error PlayerOnTerritory();
    error RankNotHighEnough();
    error RequestIdNotKnown();
    error TooManyCombatants();
    error TransferFailed();
    error UUPSUnauthorizedCallContext();
    error UUPSUnsupportedProxiableUUID(bytes32 slot);
    error ZeroAddress();
}
