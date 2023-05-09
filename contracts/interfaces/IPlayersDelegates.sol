// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../globals/all.sol";

interface IPlayersMiscDelegateView {
  function claimableXPThresholdRewardsImpl(
    uint oldTotalXP,
    uint newTotalXP
  ) external view returns (uint[] memory itemTokenIds, uint[] memory amounts);

  function dailyClaimedRewardsImpl(uint playerId) external view returns (bool[7] memory claimed);

  function dailyRewardsViewImpl(
    uint _playerId
  ) external view returns (uint[] memory itemTokenIds, uint[] memory amounts, bytes32 dailyRewardMask);

  function processConsumablesView(
    address from,
    uint playerId,
    QueuedAction calldata queuedAction,
    ActionChoice calldata actionChoice,
    CombatStats memory combatStats,
    uint elapsedTime,
    uint startTime,
    PendingQueuedActionEquipmentState[] calldata pendingQueuedActionEquipmentStates,
    PendingQueuedActionProcessed calldata pendingQueuedActionProcessed
  )
    external
    view
    returns (
      Equipment[] memory consumedEquipments,
      Equipment memory producedEquipment,
      uint xpElapsedTime,
      bool died,
      uint16 foodConsumed,
      uint16 baseInputItemsConsumedNum
    );
}

interface IPlayersMiscDelegate {
  function handleDailyRewards(address from, uint playerId) external;
}

interface IPlayersProcessActionsDelegate {
  function processActions(address from, uint playerId) external;
}

interface IPlayersRewardsDelegate {
  function claimRandomRewards(uint playerId, PendingQueuedActionProcessed memory pendingQueuedActionProcessed) external;
}

// External view functions that are in other implementation files
interface IPlayersRewardsDelegateView {
  function pendingQueuedActionStateImpl(
    address owner,
    uint playerId
  ) external view returns (PendingQueuedActionState memory pendingQueuedActionState);
}
