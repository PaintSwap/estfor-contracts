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

interface PassiveActions {
    struct PassiveActionInput {
        uint16 actionId;
        PassiveActions.PassiveActionInfoInput info;
        GuaranteedReward[] guaranteedRewards;
        RandomReward[] randomRewards;
    }

    struct PassiveActionInfoInput {
        uint8 durationDays;
        uint16[] inputTokenIds;
        uint24[] inputAmounts;
        Skill[] minSkills;
        uint8[] minLevels;
        uint8 skipSuccessPercent;
        uint8 worldLocation;
        bool isFullModeOnly;
        bool isAvailable;
        uint16 questPrerequisiteId;
    }

    struct PassiveAction {
        uint8 durationDays;
        uint16 inputTokenId1;
        uint24 inputAmount1;
        uint16 inputTokenId2;
        uint24 inputAmount2;
        uint16 inputTokenId3;
        uint24 inputAmount3;
        Skill minSkill1;
        uint8 minLevel1;
        Skill minSkill2;
        uint8 minLevel2;
        Skill minSkill3;
        uint8 minLevel3;
        uint8 skipSuccessPercent;
        bytes1 packedData;
        uint16 questPrerequisiteId;
    }

    struct PendingPassiveActionState {
        uint256[] producedItemTokenIds;
        uint256[] producedAmounts;
        uint256[] producedRandomRewardItemTokenIds;
        uint256[] producedRandomRewardAmounts;
        uint256 numDaysSkipped;
        bool skippedToday;
        bool isReady;
    }
    function UPGRADE_INTERFACE_VERSION() external view returns (string memory);
    function addActions(PassiveActions.PassiveActionInput[] calldata passiveActionInputs) external;
    function addPassiveActionBridge(uint256 playerId, uint256 actionId, uint256 startTime) external;
    function claim(uint256 playerId) external;
    function editActions(PassiveActions.PassiveActionInput[] calldata passiveActionInputs) external;
    function endEarly(uint256 playerId) external;
    function finishedInfo(uint256 playerId)
        external
        view
        returns (bool finished, bool oracleCalled, bool hasRandomRewards, uint256 numWinners, bool skippedToday);
    function getAction(uint16 actionId) external view returns (PassiveActions.PassiveAction memory);
    function initialize(
        address players,
        address itemNFT,
        address randomnessBeacon,
        address bridge,
        address activityPoints
    ) external;
    function onERC1155BatchReceived(
        address arg0,
        address arg1,
        uint256[] calldata arg2,
        uint256[] calldata arg3,
        bytes calldata arg4
    ) external returns (bytes4);
    function onERC1155Received(address arg0, address arg1, uint256 arg2, uint256 arg3, bytes calldata arg4)
        external
        returns (bytes4);
    function owner() external view returns (address);
    function pendingPassiveActionState(uint256 playerId)
        external
        view
        returns (PassiveActions.PendingPassiveActionState memory _pendingPassiveActionState);
    function proxiableUUID() external view returns (bytes32);
    function renounceOwnership() external;
    function setActivityPoints(address activityPoints) external;
    function startAction(uint256 playerId, uint16 actionId, uint16 boostItemTokenId) external;
    function supportsInterface(bytes4 interfaceId) external view returns (bool);
    function transferOwnership(address newOwner) external;
    function upgradeToAndCall(address newImplementation, bytes calldata data) external payable;
    event AddPassiveActions(PassiveActions.PassiveActionInput[] passiveActionInputs);
    event ClaimPassiveAction(
        uint256 playerId,
        address from_,
        uint256 queueId,
        uint256[] itemTokenIds,
        uint256[] amounts,
        bool startingAnother
    );
    event EarlyEndPassiveAction(uint256 playerId, address from_, uint256 queueId);
    event EditPassiveActions(PassiveActions.PassiveActionInput[] passiveActionInputs);
    event Initialized(uint64 version);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event StartPassiveAction(
        uint256 playerId,
        address from_,
        uint256 actionId,
        uint256 queueId,
        uint256 boostItemTokenId,
        uint256 startTimestamp
    );
    event Upgraded(address indexed implementation);
    error ActionAlreadyExists(uint16 actionId);
    error ActionAlreadyFinished();
    error ActionDoesNotExist();
    error ActionIdZeroNotAllowed();
    error ActionNotAvailable();
    error AddressEmptyCode(address target);
    error DurationTooLong();
    error ERC1967InvalidImplementation(address implementation);
    error ERC1967NonPayable();
    error FailedCall();
    error GuaranteedRewardsNoDuplicates();
    error InputAmountsMustBeInOrder();
    error InputItemNoDuplicates();
    error InputSpecifiedWithoutAmount();
    error InvalidActionId();
    error InvalidInitialization();
    error InvalidInputTokenId();
    error InvalidSkill();
    error LengthMismatch();
    error MinimumLevelNotReached(Skill minSkill, uint256 minLevel);
    error MinimumSkillsNoDuplicates();
    error NoActivePassiveAction();
    error NoInputItemsSpecified();
    error NotBridge();
    error NotInitializing();
    error NotOwnerOfPlayerAndActive();
    error NotPassiveVial();
    error OwnableInvalidOwner(address owner);
    error OwnableUnauthorizedAccount(address account);
    error PassiveActionNotReadyToBeClaimed();
    error PlayerNotUpgraded();
    error PreviousActionNotFinished();
    error PreviousInputTokenIdMustBeSpecified();
    error RandomRewardNoDuplicates();
    error RandomRewardsMustBeInOrder(uint16 chance1, uint16 chance2);
    error ReentrancyGuardReentrantCall();
    error TooManyGuaranteedRewards();
    error TooManyInputItems();
    error TooManyMinSkills();
    error TooManyRandomRewards();
    error UUPSUnauthorizedCallContext();
    error UUPSUnsupportedProxiableUUID(bytes32 slot);
}
