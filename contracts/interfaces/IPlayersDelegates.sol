// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../globals/all.sol";

interface IPlayersMiscDelegate {
  function handleDailyRewards(address from, uint playerId) external;
}

interface IPlayersProcessActionsDelegate {
  function processActions(address from, uint playerId) external;

  function processActionsAndSetState(uint playerId) external;

  function donate(address from, uint playerId, uint amount) external;
}

interface IPlayersRewardsDelegate {
  function claimRandomRewards(uint playerId, PendingQueuedActionProcessed memory pendingQueuedActionProcessed) external;
}

// External view functions that are in other implementation files
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

  function getRandomRewards(
    uint playerId,
    uint40 skillSentinelTime,
    uint numTickets,
    ActionRewards memory actionRewards,
    uint8 successPercent,
    uint8 fullAttireBonusRewardsPercent
  ) external view returns (uint[] memory ids, uint[] memory amounts, bool hasRandomWord);
}

interface IPlayersRewardsDelegateView {
  function pendingQueuedActionStateImpl(
    address owner,
    uint playerId
  ) external view returns (PendingQueuedActionState memory pendingQueuedActionState);
}

interface IPlayersQueuedActionsDelegateView {
  function validateActionsImpl(
    address owner,
    uint playerId,
    QueuedActionInput[] memory queuedActions
  ) external view returns (bool[] memory successes, bytes[] memory reasons);

  function checkAddToQueue(
    address from,
    uint playerId,
    QueuedActionInput memory queuedAction,
    PendingQueuedActionProcessed memory pendingQueuedActionProcessed,
    QuestState memory pendingQuestState
  ) external view returns (bool setAttire);
}

interface IPlayersMisc1DelegateView {
  function uri(
    string calldata playerName,
    string calldata avatarName,
    string calldata avatarDescription,
    string calldata imageURI,
    bool isBeta,
    uint playerId,
    string calldata clanName
  ) external view returns (string memory uri);
}
