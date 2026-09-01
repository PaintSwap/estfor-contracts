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

interface PVPBattleground {
    struct PendingAttack {
        uint64 playerId;
        uint64 defendingPlayerId;
        bool attackInProgress;
    }

    struct PlayerInfo {
        uint40 attackingCooldownTimestamp;
        bool currentlyAttacking;
        uint40 blockAttacksTimestamp;
        uint8 blockAttacksCooldownHours;
    }
    function UPGRADE_INTERFACE_VERSION() external view returns (string memory);
    function attackPlayer(uint256 playerId, uint256 defendingPlayerId) external payable;
    function clearCooldowns(uint256 playerId) external;
    function determineBattleOutcome(
        uint64 playerId,
        uint64 defendingPlayerId,
        Skill[] calldata skills,
        uint256[] calldata randomWords,
        uint256 extraRollsA,
        uint256 extraRollsB
    )
        external
        view
        returns (
            BattleResultEnum[] memory battleResults,
            uint256[] memory rollsA,
            uint256[] memory rollsB,
            bool didAWin
        );
    function getAttackCost() external view returns (uint256);
    function getExpectedGasLimitFulfill() external view returns (uint88 expectedGasLimitFulfill);
    function getPendingAttack(uint256 pendingAttackId)
        external
        view
        returns (PVPBattleground.PendingAttack memory pendingAttack);
    function getPlayerInfo(uint256 playerId) external view returns (PVPBattleground.PlayerInfo memory);
    function initialize(
        address players,
        address playerNFT,
        address brush,
        address itemNFT,
        address paintswapVRFConsumer,
        Skill[] calldata comparableSkills,
        uint24 pvpAttackingCooldown,
        address adminAccess,
        bool isBeta
    ) external;
    function initializeV3(address paintswapVRFConsumer) external;
    function owner() external view returns (address);
    function proxiableUUID() external view returns (bytes32);
    function rawFulfillRandomWords(uint256 requestId, uint256[] calldata randomWords) external;
    function renounceOwnership() external;
    function setAttackCooldown(uint24 attackCooldown) external;
    function setAttackInProgress(uint256 requestId) external;
    function setComparableSkills(Skill[] calldata skills, uint8 numSkillsToCompare) external;
    function setExpectedGasLimitFulfill(uint24 expectedGasLimitFulfill) external;
    function setPreventAttacks(bool preventAttacks) external;
    function transferOwnership(address newOwner) external;
    function upgradeToAndCall(address newImplementation, bytes calldata data) external payable;
    event AttackPlayer(
        address from_,
        uint256 playerId,
        uint256 defendingPlayerId,
        uint256 requestId,
        uint256 pendingAttackId,
        uint256 attackingCooldownTimestamp
    );
    event BattleResult(
        uint256 requestId,
        uint256 attackingPlayerId,
        uint256 defendingPlayerId,
        uint256[] attackingRolls,
        uint256[] defendingRolls,
        BattleResultEnum[] battleResults,
        Skill[] randomSkills,
        bool didAttackersWin,
        uint256[] randomWords
    );
    event Initialized(uint64 version);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event SetAttackCooldown(uint256 attackCooldown);
    event SetComparableSkills(Skill[] skills, uint256 numSkillsToCompare);
    event SetExpectedGasLimitFulfill(uint256 expectedGasLimitFulfill);
    event SetPreventAttacks(bool preventAttacks);
    event Upgraded(address indexed implementation);
    event VRFCoordinatorSet(address indexed coordinator);
    error AddressEmptyCode(address target);
    error AmountTooLow();
    error AttacksPrevented();
    error BlockAttacksCooldown();
    error CannotAttackSelf();
    error CannotAttackWhileStillAttacking();
    error DefendingPlayerDoesntExist();
    error ERC1967InvalidImplementation(address implementation);
    error ERC1967NonPayable();
    error FailedCall();
    error InvalidInitialization();
    error InvalidSkill(Skill skill);
    error LengthMismatch();
    error NotAdminAndBeta();
    error NotEnoughRandomWords();
    error NotInitializing();
    error NotOwnerOfPlayerAndActive();
    error OnlyVRFCoordinator(address sender, address coordinator);
    error OwnableInvalidOwner(address owner);
    error OwnableUnauthorizedAccount(address account);
    error PlayerAttackingCooldown();
    error PlayerIsBlockingAttacks();
    error RequestIdNotKnown();
    error SafeCastOverflowedUintDowncast(uint8 bits, uint256 value);
    error TooManySkillsToCompare();
    error TransferFailed();
    error UUPSUnauthorizedCallContext();
    error UUPSUnsupportedProxiableUUID(bytes32 slot);
    error ZeroAddress();
}
