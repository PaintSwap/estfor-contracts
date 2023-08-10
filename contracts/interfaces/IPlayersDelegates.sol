// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ItemNFT} from "../ItemNFT.sol";
import {PlayerNFT} from "../PlayerNFT.sol";
import {World} from "../World.sol";
import {AdminAccess} from "../AdminAccess.sol";
import {Quests} from "../Quests.sol";
import {Clans} from "../Clans/Clans.sol";
import {Donation} from "../Donation.sol";

// solhint-disable-next-line no-global-import
import "../globals/all.sol";

// Functions to help with delegatecall selectors
interface IPlayersDelegate {
  function startActions(
    uint playerId,
    QueuedActionInput[] calldata queuedActions,
    uint16 boostItemTokenId,
    uint40 boostStartTime,
    uint questId,
    uint donationAmount,
    ActionQueueStatus queueStatus
  ) external;

  function addXPThresholdRewards(XPThresholdReward[] calldata xpThresholdRewards) external;

  function editXPThresholdRewards(XPThresholdReward[] calldata xpThresholdRewards) external;

  function addFullAttireBonuses(FullAttireBonusInput[] calldata fullAttireBonuses) external;

  function mintedPlayer(
    address from,
    uint playerId,
    Skill[2] calldata startSkills,
    uint[] calldata startingItemTokenIds,
    uint[] calldata startingAmounts
  ) external;

  function clearEverything(address from, uint playerId, bool processTheTransactions) external;

  function testModifyXP(address from, uint playerId, Skill skill, uint56 xp, bool force) external;

  function buyBrushQuest(address to, uint playerId, uint questId, bool useExactETH) external;

  function initialize(
    ItemNFT itemNFT,
    PlayerNFT playerNFT,
    World world,
    AdminAccess adminAccess,
    Quests quests,
    Clans clans,
    Donation donation,
    address implQueueActions,
    address implProcessActions,
    address implRewards,
    address implMisc,
    address implMisc1,
    bool isBeta
  ) external;
}

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
