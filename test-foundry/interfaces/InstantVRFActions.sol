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

interface InstantVRFActions {
    struct InstantVRFAction {
        uint16 inputTokenId1;
        uint24 inputAmount1;
        uint16 inputTokenId2;
        uint24 inputAmount2;
        uint16 inputTokenId3;
        uint24 inputAmount3;
        uint16 questPrerequisiteId;
        InstantVRFActionType actionType;
        bytes1 packedData;
    }
    function UPGRADE_INTERFACE_VERSION() external view returns (string memory);
    function addActions(InstantVRFActionInput[] calldata instantVRFActionInputs) external;
    function addStrategies(InstantVRFActionType[] calldata instantVRFActionTypes, address[] calldata strategies)
        external;
    function doInstantVRFActions(uint256 playerId, uint16[] calldata actionIds, uint256[] calldata actionAmounts)
        external
        payable;
    function editActions(InstantVRFActionInput[] calldata instantVRFActionInputs) external;
    function getAction(uint16 actionId) external view returns (InstantVRFActions.InstantVRFAction memory);
    function getStrategy(InstantVRFActionType actionType) external view returns (address);
    function initialize(
        address players,
        address itemNFT,
        address petNFT,
        address quests,
        address paintswapVRFConsumer,
        uint8 maxActionAmount,
        address activityPoints
    ) external;
    function initializeV3(address paintswapVRFConsumer) external;
    function owner() external view returns (address);
    function proxiableUUID() external view returns (bytes32);
    function rawFulfillRandomWords(uint256 requestId, uint256[] calldata randomWords) external;
    function removeActions(uint16[] calldata instantVRFActionIds) external;
    function renounceOwnership() external;
    function requestCost(uint256 numActions) external view returns (uint256);
    function setActivityPoints(address activityPoints) external;
    function setGasCostPerUnit(uint64 gasCostPerUnit) external;
    function setMaxActionAmount(uint8 maxActionAmount) external;
    function setPetNFT(address petNFT) external;
    function transferOwnership(address newOwner) external;
    function upgradeToAndCall(address newImplementation, bytes calldata data) external payable;
    event AddInstantVRFActions(InstantVRFActionInput[] instantVRFActionInputs);
    event AddStrategies(InstantVRFActionType[] actionTypes, address[] strategies);
    event CompletedInstantVRFActions(
        address from_,
        uint256 playerId,
        uint256 requestId,
        uint256[] producedItemTokenIds,
        uint256[] producedItemAmounts,
        uint256[] producedPetTokenIds
    );
    event DoInstantVRFActions(
        address from_,
        uint256 playerId,
        uint256 requestId,
        uint16[] actionIds,
        uint256[] amounts,
        uint256[] consumedItemTokenIds,
        uint256[] consumedAmounts
    );
    event EditInstantVRFActions(InstantVRFActionInput[] instantVRFActionInputs);
    event Initialized(uint64 version);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event RemoveInstantVRFActions(uint16[] actionIds);
    event SetGasCostPerUnit(uint256 gasCostPerUnit);
    event SetMaxActionAmount(uint8 maxActionAmount);
    event Upgraded(address indexed implementation);
    event VRFCoordinatorSet(address indexed coordinator);
    error ActionAlreadyExists();
    error ActionDoesNotExist();
    error ActionIdZeroNotAllowed();
    error ActionNotAvailable();
    error AddressEmptyCode(address target);
    error AlreadyProcessing();
    error DependentQuestNotCompleted();
    error ERC1967InvalidImplementation(address implementation);
    error ERC1967NonPayable();
    error FailedCall();
    error IncorrectInputAmounts();
    error InputAmountsMustBeInOrder();
    error InputItemNoDuplicates();
    error InputSpecifiedWithoutAmount();
    error InvalidInitialization();
    error InvalidInputTokenId();
    error InvalidStrategy();
    error LengthMismatch();
    error NotDoingAnyActions();
    error NotInitializing();
    error NotOwnerOfPlayerAndActive();
    error OnlyVRFCoordinator(address sender, address coordinator);
    error OwnableInvalidOwner(address owner);
    error OwnableUnauthorizedAccount(address account);
    error PlayerNotUpgraded();
    error RequestDoesNotExist();
    error StrategyAlreadyExists();
    error TooManyActionAmounts();
    error TooManyInputItems();
    error TransferFailed();
    error UUPSUnauthorizedCallContext();
    error UUPSUnsupportedProxiableUUID(bytes32 slot);
    error ZeroAddress();
}
