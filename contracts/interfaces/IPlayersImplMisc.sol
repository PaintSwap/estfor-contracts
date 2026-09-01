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

import {IPlayersBase} from "./IPlayersBase.sol";

interface IPlayersImplMisc is IPlayersBase {
    function addXPThresholdRewards(XPThresholdReward[] calldata xpThresholdRewards) external;
    function buyBrushQuest(address to, uint256 playerId, uint256 questId, bool useExactETH) external payable;
    function claimableXPThresholdRewardsImpl(uint256 oldTotalXP, uint256 newTotalXP)
        external
        view
        returns (uint256[] memory itemTokenIds, uint256[] memory amounts);
    function dailyClaimedRewardsImpl(uint256 playerId) external view returns (bool[7] memory claimed);
    function dailyRewardsViewImpl(address from_, uint256 playerId)
        external
        view
        returns (uint256[] memory itemTokenIds, uint256[] memory amounts, bytes32 dailyRewardMask);
    function editXPThresholdRewards(XPThresholdReward[] calldata xpThresholdRewards) external;
    function getRandomRewardChanceMultiplierCutoff() external pure returns (uint256);
    function getRandomRewards(uint256 playerId, uint40 startTimestamp, uint40 skillSentinelTime, uint256 numTickets, ActionRewards calldata actionRewards, uint8 successPercent, uint8 fullAttireBonusRewardsPercent) external view returns (uint256[] memory ids, uint256[] memory amounts, bool hasRandomWord);
    function handleDailyRewards(address from_, uint256 playerId) external;
    function mintedPlayer(address from_, uint256 playerId, Skill[2] calldata startSkills, uint256[] calldata startingItemTokenIds, uint256[] calldata startingAmounts) external;
    function modifyXP(address from_, uint256 playerId, Skill skill, uint56 xp, bool skipEffects) external;
    function processConsumablesView(address from_, uint256 playerId, QueuedAction calldata queuedAction, ActionChoice calldata actionChoice, CombatStats calldata combatStats, uint256 elapsedTime, uint256 startTime, uint256 numSpawnedPerHour, PendingQueuedActionEquipmentState[] calldata pendingQueuedActionEquipmentStates, PendingQueuedActionProcessed calldata pendingQueuedActionProcessed) external view returns (Equipment[] memory consumedEquipments, Equipment memory producedEquipment, uint256 xpElapsedTime, bool died, uint16 foodConsumed, uint16 baseInputItemsConsumedNum);
    error InvalidCombatStyleId(uint8 combatStyle);
}
