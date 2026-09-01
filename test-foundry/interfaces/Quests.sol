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

interface Quests {
    struct MinimumRequirement {
        Skill skill;
        uint64 xp;
    }
    function UPGRADE_INTERFACE_VERSION() external view returns (string memory);
    function activateQuest(address from_, uint256 playerId, uint256 questId) external;
    function activeQuests(uint256 playerId) external view returns (PlayerQuest memory);
    function addQuests(QuestInput[] calldata quests, Quests.MinimumRequirement[3][] calldata minimumRequirements)
        external;
    function allFixedQuests(uint256 questId) external view returns (Quest memory);
    function buyBrush(address to, uint256 minimumBrushExpected, bool useExactETH)
        external
        payable
        returns (uint256[] memory amounts);
    function buyBrushQuest(address from_, address to, uint256 playerId, uint256 minimumBrushBack, bool useExactETH)
        external
        payable
        returns (bool success);
    function deactivateQuest(uint256 playerId) external;
    function editQuests(QuestInput[] calldata quests, Quests.MinimumRequirement[3][] calldata minimumRequirements)
        external;
    function getActiveQuestBurnedItemTokenId(uint256 playerId) external view returns (uint256);
    function getActiveQuestId(uint256 playerId) external view returns (uint256);
    function getQuestCompletedRewards(uint256 questId)
        external
        view
        returns (uint256[] memory itemTokenIds, uint256[] memory amounts, Skill skillGained, uint32 xpGained);
    function initialize(
        address randomnessBeacon,
        address bridge,
        address router,
        address[2] calldata path,
        address activityPoints
    ) external;
    function isQuestCompleted(uint256 playerId, uint256 questId) external view returns (bool);
    function owner() external view returns (address);
    function processQuests(
        address from_,
        uint256 playerId,
        PlayerQuest[] calldata activeQuestInfo,
        uint256[] calldata questsCompleted
    ) external;
    function processQuestsBridge(
        address from_,
        uint256 playerId,
        uint256[] calldata questsCompleted,
        uint256[] calldata questIds,
        uint256[] calldata questActionCompletedNum1s,
        uint256[] calldata questActionCompletedNum2s,
        uint256[] calldata questActionChoiceCompletedNums,
        uint256[] calldata questBurnCompletedAmounts
    ) external;
    function processQuestsView(
        uint256 playerId,
        uint256[] calldata actionIds,
        uint256[] calldata actionAmounts,
        uint256[] calldata choiceIds,
        uint256[] calldata choiceAmounts,
        uint256 burnedAmountOwned
    )
        external
        view
        returns (
            uint256[] memory itemTokenIds,
            uint256[] memory amounts,
            uint256[] memory itemTokenIdsBurned,
            uint256[] memory amountsBurned,
            Skill[] memory skillsGained,
            uint32[] memory xpGained,
            uint256[] memory questsCompleted,
            PlayerQuest[] memory activeQuestsCompletionInfo
        );
    function proxiableUUID() external view returns (bytes32);
    function removeQuest(uint256 questId) external;
    function renounceOwnership() external;
    function sellBrush(address to, uint256 brushAmount, uint256 minFTM, bool useExactETH) external;
    function setActivityPoints(address activityPoints) external;
    function setPlayers(address players) external;
    function transferOwnership(address newOwner) external;
    function upgradeToAndCall(address newImplementation, bytes calldata data) external payable;
    event ActivateQuest(address from_, uint256 playerId, uint256 questId);
    event AddQuests(QuestInput[] quests, Quests.MinimumRequirement[3][] minimumRequirements);
    event DeactivateQuest(uint256 playerId, uint256 questId);
    event EditQuests(QuestInput[] quests, Quests.MinimumRequirement[3][] minimumRequirements);
    event Initialized(uint64 version);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event QuestCompleted(address from_, uint256 playerId, uint256 questId);
    event QuestCompletedFromBridge(
        address from_,
        uint256 playerId,
        uint256 questId,
        uint256[] extraItemTokenIds,
        uint256[] extraItemAMounts,
        Skill[] extraSkills,
        uint256[] extraSkillXPs
    );
    event RemoveQuest(uint256 questId);
    event UpdateQuestProgress(uint256 playerId, PlayerQuest playerQuest);
    event Upgraded(address indexed implementation);
    error ActivatingQuestAlreadyActivated();
    error AddressEmptyCode(address target);
    error CannotChangeBackToFullMode();
    error CannotStartFullModeQuest();
    error DependentQuestNotCompleted(uint16 dependentQuestId);
    error ERC1967InvalidImplementation(address implementation);
    error ERC1967NonPayable();
    error FailedCall();
    error InvalidActionChoiceNum();
    error InvalidActionNum();
    error InvalidActiveQuest();
    error InvalidBrushAmount();
    error InvalidBurnAmount();
    error InvalidFTMAmount();
    error InvalidInitialization();
    error InvalidMinimumRequirement();
    error InvalidQuestId();
    error InvalidRewardAmount();
    error InvalidSkillXPGained();
    error LengthMismatch(uint256 questsLength, uint256 minimumRequirementsLength);
    error NoActiveQuest();
    error NotBridge();
    error NotInitializing();
    error NotOwnerOfPlayerAndActive();
    error NotPlayers();
    error NotSupported();
    error NotWorld();
    error OwnableInvalidOwner(address owner);
    error OwnableUnauthorizedAccount(address account);
    error QuestCompletedAlready();
    error QuestDoesntExist();
    error QuestWithIdAlreadyExists();
    error RefundFailed();
    error UUPSUnauthorizedCallContext();
    error UUPSUnsupportedProxiableUUID(bytes32 slot);
}
