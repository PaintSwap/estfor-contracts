// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ItemNFT} from "../ItemNFT.sol";
import {PlayerNFT} from "../PlayerNFT.sol";
import {PetNFT} from "../PetNFT.sol";
import {RandomnessBeacon} from "../RandomnessBeacon.sol";
import {AdminAccess} from "../AdminAccess.sol";
import {Quests} from "../Quests.sol";
import {Clans} from "../Clans/Clans.sol";
import {WishingWell} from "../WishingWell.sol";

// solhint-disable-next-line no-global-import
import "../globals/all.sol";

// Functions to help with delegatecall selectors
interface IPlayersDelegate {
  function startActions(
    uint256 playerId,
    QueuedActionInput[] calldata queuedActions,
    uint16 boostItemTokenId,
    uint40 boostStartTime,
    uint256 questId,
    uint256 donationAmount,
    ActionQueueStrategy queueStrategy
  ) external;

  function addXPThresholdRewards(XPThresholdReward[] calldata xpThresholdRewards) external;

  function editXPThresholdRewards(XPThresholdReward[] calldata xpThresholdRewards) external;

  function addFullAttireBonuses(FullAttireBonusInput[] calldata fullAttireBonuses) external;

  function clearEverything(address from, uint256 playerId, bool processTheTransactions) external;

  function buyBrushQuest(address to, uint256 playerId, uint256 questId, bool useExactETH) external;

  function modifyXP(address from, uint256 playerId, Skill skill, uint56 xp) external;
}

interface IPlayersMiscDelegate {
  function handleDailyRewards(address from, uint256 playerId) external;

  function mintedPlayer(
    address from,
    uint256 playerId,
    Skill[2] calldata startSkills,
    uint256[] calldata startingItemTokenIds,
    uint256[] calldata startingAmounts
  ) external;

  function modifyXP(address from, uint256 playerId, Skill skill, uint56 xp) external;
}

interface IPlayersMisc1Delegate {
  function beforeItemNFTTransfer(address from, address to, uint256[] memory ids, uint256[] memory amounts) external;
}

interface IPlayersProcessActionsDelegate {
  function processActions(address from, uint256 playerId) external;

  function processActionsAndSetState(
    uint256 playerId
  ) external returns (QueuedAction[] memory remainingQueuedActions, Attire[] memory remainingAttire);

  function donate(address from, uint256 playerId, uint256 amount) external;
}

interface IPlayersRewardsDelegate {
  function claimRandomRewards(
    address from,
    uint256 playerId,
    PendingQueuedActionProcessed memory pendingQueuedActionProcessed
  ) external;
}

// External view functions that are in other implementation files
interface IPlayersMiscDelegateView {
  function claimableXPThresholdRewardsImpl(
    uint256 oldTotalXP,
    uint256 newTotalXP
  ) external view returns (uint256[] memory itemTokenIds, uint256[] memory amounts);

  function dailyClaimedRewardsImpl(uint256 playerId) external view returns (bool[7] memory claimed);

  function dailyRewardsViewImpl(
    address from,
    uint256 playerId
  ) external view returns (uint256[] memory itemTokenIds, uint256[] memory amounts, bytes32 dailyRewardMask);

  function processConsumablesView(
    address from,
    uint256 playerId,
    QueuedAction calldata queuedAction,
    ActionChoice calldata actionChoice,
    CombatStats memory combatStats,
    uint256 elapsedTime,
    uint256 startTime,
    uint256 numSpawnedPerHour,
    PendingQueuedActionEquipmentState[] calldata pendingQueuedActionEquipmentStates,
    PendingQueuedActionProcessed calldata pendingQueuedActionProcessed
  )
    external
    view
    returns (
      Equipment[] memory consumedEquipments,
      Equipment memory producedEquipment,
      uint256 xpElapsedTime,
      bool died,
      uint16 foodConsumed,
      uint16 baseInputItemsConsumedNum
    );

  function getRandomRewards(
    uint256 playerId,
    uint40 startTimestamp,
    uint40 skillSentinelTime,
    uint256 numTickets,
    ActionRewards memory actionRewards,
    uint8 successPercent,
    uint8 fullAttireBonusRewardsPercent
  ) external view returns (uint256[] memory ids, uint256[] memory amounts, bool hasRandomWord);
}

interface IPlayersRewardsDelegateView {
  function pendingQueuedActionStateImpl(
    address owner,
    uint256 playerId
  ) external view returns (PendingQueuedActionState memory pendingQueuedActionState);
}

interface IPlayersQueuedActionsDelegate {
  function setInitialCheckpoints(
    address from,
    uint256 playerId,
    uint256 existingActionQueueLength,
    QueuedAction[] memory queuedActions,
    Attire[] memory attire
  ) external;
}

interface IPlayersQueuedActionsDelegateView {
  function validateActionsImpl(
    address owner,
    uint256 playerId,
    QueuedActionInput[] memory queuedActions
  ) external view returns (bool[] memory successes, bytes[] memory reasons);

  function checkAddToQueue(
    address from,
    uint256 playerId,
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
    uint256 playerId
  ) external view returns (string memory uri);
}
