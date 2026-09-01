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

interface PlayersLibrary {
    function determineBattleOutcome(
        address from_,
        address itemNFT,
        uint256 elapsedTime,
        ActionChoice calldata actionChoice,
        uint16 regenerateId,
        uint256 numSpawnedPerHour,
        CombatStats calldata combatStats,
        CombatStats calldata enemyCombatStats,
        uint8 alphaCombat,
        uint8 betaCombat,
        uint8 alphaCombatHealing,
        PendingQueuedActionEquipmentState[] calldata pendingQueuedActionEquipmentStates
    )
        external
        view
        returns (
            uint256 xpElapsedTime,
            uint256 combatElapsedTime,
            uint16 baseInputItemsConsumedNum,
            uint16 foodConsumed,
            bool died
        );
    function dmg(int256 attack, int256 defence, uint8 alphaCombat, uint8 betaCombat, uint256 elapsedTime)
        external
        pure
        returns (uint32);
    function getAttireTokenIds(Attire calldata attire, bool skipNonFullAttire)
        external
        pure
        returns (uint16[] memory itemTokenIds);
    function getAttireWithBalance(
        Attire calldata attire,
        bool skipNonFullAttire,
        PendingQueuedActionEquipmentState[] calldata pendingQueuedActionEquipmentStates,
        CheckpointEquipments calldata checkpointEquipments
    ) external pure returns (uint16[] memory itemTokenIds, uint256[] memory balances);
    function getAttireWithCurrentBalance(address from_, Attire calldata attire, address itemNFT, bool skipNonFullAttire)
        external
        view
        returns (uint16[] memory itemTokenIds, uint256[] memory balances);
    function getBalanceUsingCurrentBalance(
        address from_,
        uint256 itemId,
        address itemNFT,
        PendingQueuedActionEquipmentState[] calldata pendingQueuedActionEquipmentStates
    ) external view returns (uint256 balance);
    function getBalanceUsingCurrentBalances(
        address from_,
        uint16[] calldata itemIds,
        address itemNFT,
        PendingQueuedActionEquipmentState[] calldata pendingQueuedActionEquipmentStates
    ) external view returns (uint256[] memory balances);
    function getBoostedTime(uint256 actionStartTime, uint256 elapsedTime, uint40 boostStartTime, uint24 boostDuration)
        external
        pure
        returns (uint24);
    function getLevel(uint256 xp) external pure returns (uint16);
    function getNonCombatAdjustedElapsedTime(
        address from_,
        address itemNFT,
        uint256 elapsedTime,
        ActionChoice calldata actionChoice,
        PendingQueuedActionEquipmentState[] calldata pendingQueuedActionEquipmentStates
    ) external view returns (uint256 xpElapsedTime, uint16 baseInputItemsConsumedNum);
    function subtractMatchingRewards(
        uint256[] calldata newIds,
        uint256[] calldata newAmounts,
        uint256[] calldata prevNewIds,
        uint256[] calldata prevNewAmounts
    ) external pure returns (uint256[] memory ids, uint256[] memory amounts);
    function updateCombatStatsFromPet(
        CombatStats calldata combatStats,
        uint8 skillEnhancement1,
        uint8 skillFixedEnhancement1,
        uint8 skillPercentageEnhancement1,
        uint8 skillEnhancement2,
        uint8 skillFixedEnhancement2,
        uint8 skillPercentageEnhancement2
    ) external pure returns (CombatStats memory statsOut);
    function updateStatsFromHandEquipment(
        address itemNFT,
        uint16[2] calldata handEquipmentTokenIds,
        CombatStats calldata combatStats,
        bool isCombat,
        PendingQueuedActionEquipmentState[] calldata pendingQueuedActionEquipmentStates,
        uint16 handItemTokenIdRangeMin,
        CheckpointEquipments calldata checkpointEquipments
    ) external view returns (bool missingRequiredHandEquipment, CombatStats memory statsOut);
    error InvalidAction();
    error InvalidCombatStyleId(uint8 combatStyle);
    error InvalidSkillId(uint8 skill);
    error InvalidXPSkill();
    error SkillForPetNotHandledYet();
}
