// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../globals/all.sol";

interface IPlayers {
  function clearEverythingBeforeTokenTransfer(address from, uint tokenId) external;

  function getURI(
    uint playerId,
    string calldata name,
    string calldata avatarName,
    string calldata avatarDescription,
    string calldata imageURI
  ) external view returns (string memory);

  function mintedPlayer(
    address from,
    uint playerId,
    Skill[2] calldata startSkills,
    bool makeActive,
    uint[] calldata startingItemTokenIds,
    uint[] calldata startingAmounts
  ) external;

  function isOwnerOfPlayerAndActive(address from, uint playerId) external view returns (bool);

  function activePlayer(address owner) external view returns (uint playerId);
}

interface IPlayersMiscDelegateView {
  function claimableXPThresholdRewardsImpl(
    uint oldTotalXP,
    uint newTotalXP
  ) external view returns (uint[] memory itemTokenIds, uint[] memory amounts);

  function dailyClaimedRewardsImpl(uint playerId) external view returns (bool[7] memory claimed);

  function dailyRewardsViewImpl(
    uint _playerId
  ) external view returns (uint[] memory itemTokenIds, uint[] memory amounts, bytes32 dailyRewardMask);

  function processConsumablesViewImpl(
    address from,
    uint playerId,
    QueuedAction memory queuedAction,
    uint currentActionStartTime,
    uint elapsedTime,
    CombatStats memory combatStats,
    ActionChoice memory actionChoice,
    PendingQueuedActionEquipmentState[] memory pendingQueuedActionEquipmentStates,
    PendingQueuedActionProcessed memory pendingQueuedActionProcessed
  )
    external
    view
    returns (
      Equipment[] memory consumedEquipment,
      Equipment memory producedEquipment,
      uint xpElapsedTime,
      bool died,
      uint16 foodConsumed,
      uint16 baseInputItemsConsumedNum
    );

  function processConsumablesViewStateTrans(
    uint playerId,
    uint currentActionStartTime,
    uint elapsedTime,
    ActionChoice memory actionChoice,
    uint16 regenerateId,
    uint16 foodConsumed,
    PendingQueuedActionProcessed memory pendingQueuedActionProcessed,
    uint16 baseInputItemsConsumedNum
  ) external view returns (Equipment[] memory consumedEquipment, Equipment memory producedEquipment);
}

interface IPlayersMiscDelegate {
  function handleDailyRewards(address from, uint playerId) external;
}
