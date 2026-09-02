// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
import "../globals/all.sol";
interface IPlayersLibrary {
  function determineBattleOutcome(
    address from,
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
    PendingQueuedActionEquipmentState[] calldata states
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
  function dmg(
    int256 attack,
    int256 defence,
    uint8 alphaCombat,
    uint8 betaCombat,
    uint256 elapsedTime
  ) external pure returns (uint32);
  function getAttireTokenIds(Attire calldata attire, bool skipNonFullAttire) external pure returns (uint16[] memory);
  function getAttireWithBalance(
    Attire calldata attire,
    bool skipNonFullAttire,
    PendingQueuedActionEquipmentState[] calldata states,
    CheckpointEquipments calldata checkpoint
  ) external pure returns (uint16[] memory, uint256[] memory);
  function getAttireWithCurrentBalance(
    address from,
    Attire calldata attire,
    address itemNFT,
    bool skipNonFullAttire
  ) external view returns (uint16[] memory, uint256[] memory);
  function getBalanceUsingCurrentBalance(
    address from,
    uint256 itemId,
    address itemNFT,
    PendingQueuedActionEquipmentState[] calldata states
  ) external view returns (uint256);
  function getBalanceUsingCurrentBalances(
    address from,
    uint16[] calldata itemIds,
    address itemNFT,
    PendingQueuedActionEquipmentState[] calldata states
  ) external view returns (uint256[] memory);
  function getBoostedTime(
    uint256 actionStartTime,
    uint256 elapsedTime,
    uint40 boostStartTime,
    uint24 boostDuration
  ) external pure returns (uint24);
  function getLevel(uint256 xp) external pure returns (uint16);
  function getNonCombatAdjustedElapsedTime(
    address from,
    address itemNFT,
    uint256 elapsedTime,
    ActionChoice calldata actionChoice,
    PendingQueuedActionEquipmentState[] calldata states
  ) external view returns (uint256, uint16);
  function subtractMatchingRewards(
    uint256[] calldata newIds,
    uint256[] calldata newAmounts,
    uint256[] calldata prevIds,
    uint256[] calldata prevAmounts
  ) external pure returns (uint256[] memory, uint256[] memory);
  function updateCombatStatsFromPet(
    CombatStats calldata stats,
    uint8 a,
    uint8 b,
    uint8 c,
    uint8 d,
    uint8 e,
    uint8 f
  ) external pure returns (CombatStats memory);
  function updateStatsFromHandEquipment(
    address itemNFT,
    uint16[2] calldata ids,
    CombatStats calldata stats,
    bool isCombat,
    PendingQueuedActionEquipmentState[] calldata states,
    uint16 rangeMin,
    CheckpointEquipments calldata checkpoint
  ) external view returns (bool, CombatStats memory);
  error InvalidAction();
  error InvalidCombatStyleId(uint8 combatStyle);
  error InvalidSkillId(uint8 skill);
  error InvalidXPSkill();
  error SkillForPetNotHandledYet();
}
