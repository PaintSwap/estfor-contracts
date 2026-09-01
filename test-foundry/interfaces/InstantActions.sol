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

interface InstantActions {
    enum InstantActionType {
        NONE,
        FORGING_COMBINE,
        GENERIC
    }

    struct InstantActionInput {
        uint16 actionId;
        uint8[] minSkills;
        uint32[] minXPs;
        uint16[] inputTokenIds;
        uint24[] inputAmounts;
        uint16 outputTokenId;
        uint16 outputAmount;
        uint16 questPrerequisiteId;
        bool isFullModeOnly;
        bool isAvailable;
        InstantActions.InstantActionType actionType;
    }

    struct InstantAction {
        uint8 minSkill1;
        uint32 minXP1;
        uint8 minSkill2;
        uint32 minXP2;
        uint8 minSkill3;
        uint32 minXP3;
        uint16 inputTokenId1;
        uint24 inputAmount1;
        uint16 inputTokenId2;
        uint24 inputAmount2;
        uint16 inputTokenId3;
        uint24 inputAmount3;
        bytes1 packedData;
        bytes1 reserved;
        uint16 questPrerequisiteId;
        uint16 outputTokenId;
        uint24 outputAmount;
    }

    struct InstantActionState {
        uint256[] consumedTokenIds;
        uint256[] consumedAmounts;
        uint256[] producedTokenIds;
        uint256[] producedAmounts;
    }
    function UPGRADE_INTERFACE_VERSION() external view returns (string memory);
    function addActions(InstantActions.InstantActionInput[] calldata instantActionInputs) external;
    function doInstantActions(
        uint256 playerId,
        uint16[] calldata actionIds,
        uint256[] calldata amounts,
        InstantActions.InstantActionType actionType
    ) external;
    function editActions(InstantActions.InstantActionInput[] calldata instantActionInputs) external;
    function getAction(InstantActions.InstantActionType actionType, uint16 actionId)
        external
        view
        returns (InstantActions.InstantAction memory);
    function getInstantActionState(
        uint256 playerId,
        uint16[] calldata actionIds,
        uint256[] calldata amounts,
        InstantActions.InstantActionType actionType
    ) external view returns (InstantActions.InstantActionState memory instantActionState);
    function initialize(address players, address itemNFT, address quests, address activityPoints) external;
    function owner() external view returns (address);
    function proxiableUUID() external view returns (bytes32);
    function removeActions(InstantActions.InstantActionType[] calldata actionTypes, uint16[] calldata instantActionIds)
        external;
    function renounceOwnership() external;
    function setActivityPoints(address activityPoints) external;
    function transferOwnership(address newOwner) external;
    function upgradeToAndCall(address newImplementation, bytes calldata data) external payable;
    event AddInstantActions(InstantActions.InstantActionInput[] instantActionInputs);
    event DoInstantActions(
        uint256 playerId,
        address from_,
        uint16[] actionIds,
        uint256[] amounts,
        uint256[] consumedItemTokenIds,
        uint256[] consumedAmounts,
        uint256[] producedItemTokenIds,
        uint256[] producedAmounts,
        InstantActions.InstantActionType actionType
    );
    event EditInstantActions(InstantActions.InstantActionInput[] instantActionInputs);
    event Initialized(uint64 version);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event RemoveInstantActions(InstantActions.InstantActionType[] actionTypes, uint16[] actionIds);
    event Upgraded(address indexed implementation);
    error ActionAlreadyExists();
    error ActionDoesNotExist();
    error ActionIdZeroNotAllowed();
    error ActionMustBeAvailable();
    error AddressEmptyCode(address target);
    error DependentQuestNotCompleted();
    error ERC1967InvalidImplementation(address implementation);
    error ERC1967NonPayable();
    error FailedCall();
    error IncorrectInputAmounts();
    error InputItemNoDuplicates();
    error InputSpecifiedWithoutAmount();
    error InvalidActionId();
    error InvalidInitialization();
    error InvalidInputTokenId();
    error InvalidOutputTokenId();
    error InvalidSkill();
    error InvalidSkillId(uint8 skill);
    error LengthMismatch();
    error MinimumSkillsNoDuplicates();
    error MinimumXPNotReached(Skill minSkill, uint256 minXP);
    error NotInitializing();
    error NotOwnerOfPlayerAndActive();
    error OutputAmountCannotBeZero();
    error OutputTokenIdCannotBeEmpty();
    error OwnableInvalidOwner(address owner);
    error OwnableUnauthorizedAccount(address account);
    error PlayerNotUpgraded();
    error TooManyInputItems();
    error TooManyMinSkills();
    error UUPSUnauthorizedCallContext();
    error UUPSUnsupportedProxiableUUID(bytes32 slot);
    error UnsupportedActionType();
}
