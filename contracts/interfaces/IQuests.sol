// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "../globals/actions.sol";
import "../globals/clans.sol";
import "../globals/items.sol";
import "../globals/misc.sol";
import "../globals/pets.sol";
import "../globals/players.sol";
import "../globals/promotions.sol";
import "../globals/quests.sol";
import "../globals/rewards.sol";
import {IPlayers} from "./IPlayers.sol";
import {ISolidlyRouter} from "./external/ISolidlyRouter.sol";
import {IActivityPoints, IActivityPointsCaller} from "../ActivityPoints/interfaces/IActivityPoints.sol";

interface IQuests is IActivityPointsCaller {
    struct MinimumRequirement {
        Skill skill;
        uint64 xp;
    }
    function activateQuest(address from_, uint256 playerId, uint256 questId) external;
    function activeQuests(uint256 playerId) external view returns (PlayerQuest memory);
    function addQuests(QuestInput[] calldata quests, IQuests.MinimumRequirement[3][] calldata minimumRequirements)
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
    function editQuests(QuestInput[] calldata quests, IQuests.MinimumRequirement[3][] calldata minimumRequirements)
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
        ISolidlyRouter router,
        address[2] calldata path,
        IActivityPoints activityPoints
    ) external;
    function isQuestCompleted(uint256 playerId, uint256 questId) external view returns (bool);
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
    function removeQuest(uint256 questId) external;
    function sellBrush(address to, uint256 brushAmount, uint256 minFTM, bool useExactETH) external;
    function setActivityPoints(address activityPoints) external;
    function setPlayers(IPlayers players) external;
    event ActivateQuest(address from_, uint256 playerId, uint256 questId);
    event AddQuests(QuestInput[] quests, IQuests.MinimumRequirement[3][] minimumRequirements);
    event DeactivateQuest(uint256 playerId, uint256 questId);
    event EditQuests(QuestInput[] quests, IQuests.MinimumRequirement[3][] minimumRequirements);
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
    error ActivatingQuestAlreadyActivated();
    error CannotChangeBackToFullMode();
    error CannotStartFullModeQuest();
    error DependentQuestNotCompleted(uint16 dependentQuestId);
    error InvalidActionChoiceNum();
    error InvalidActionNum();
    error InvalidActiveQuest();
    error InvalidBrushAmount();
    error InvalidBurnAmount();
    error InvalidFTMAmount();
    error InvalidMinimumRequirement();
    error InvalidQuestId();
    error InvalidRewardAmount();
    error InvalidSkillXPGained();
    error LengthMismatch(uint256 questsLength, uint256 minimumRequirementsLength);
    error NoActiveQuest();
    error NotBridge();
    error NotOwnerOfPlayerAndActive();
    error NotPlayers();
    error NotSupported();
    error NotWorld();
    error QuestCompletedAlready();
    error QuestDoesntExist();
    error QuestWithIdAlreadyExists();
    error RefundFailed();
}
