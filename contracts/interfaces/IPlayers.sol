// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "../globals/misc.sol";
import "../globals/players.sol";
import "../globals/actions.sol";
import "../globals/rewards.sol";
import {IPlayersBase} from "./IPlayersBase.sol";

interface IPlayers is IPlayersBase {
  event GamePaused(bool gamePaused);
  event LockPlayer(uint256 playerId, uint256 cooldownTimestamp);
  event UnlockPlayer(uint256 playerId);

  error InvalidSelector();
  error GameIsPaused();
  error PlayerLocked();
  error NotBridge();

  function initialize(
    address itemNFT,
    address playerNFT,
    address petNFT,
    address worldActions,
    address randomnessBeacon,
    address dailyRewardsScheduler,
    address adminAccess,
    address quests,
    address clans,
    address wishingWell,
    address implQueueActions,
    address implProcessActions,
    address implRewards,
    address implMisc,
    address implMisc1,
    address bridge,
    address activityPoints,
    bool isBeta
  ) external;

  function setAlphaCombatParams(uint8 alphaCombat, uint8 betaCombat, uint8 alphaCombatHealing) external;
  function processActions(uint256 playerId) external;
  function startActions(
    uint256 playerId,
    QueuedActionInput[] calldata queuedActions,
    ActionQueueStrategy queueStrategy
  ) external;
  function startActionsAdvanced(
    uint256 playerId,
    QueuedActionInput[] calldata queuedActions,
    uint16 boostItemTokenId,
    uint8 boostStartReverseIndex,
    uint256 questId,
    uint256 donationAmount,
    ActionQueueStrategy queueStrategy
  ) external;
  function buyBrushQuest(address to, uint256 playerId, uint256 questId, bool useExactETH) external payable;
  function activateQuest(uint256 playerId, uint256 questId) external;
  function deactivateQuest(uint256 playerId) external;
  function setActivePlayer(uint256 playerId) external;
  function donate(uint256 playerId, uint256 amount) external;
  function dailyClaimedRewards(uint256 playerId) external view returns (bool[7] memory claimed);
  function validateActions(address owner, uint256 playerId, QueuedActionInput[] calldata queuedActions)
    external
    view
    returns (bool[] memory successes, bytes[] memory reasons);
  function getPendingRandomRewards(uint256 playerId) external view returns (PendingRandomReward[] memory);
  function getActionQueue(uint256 playerId) external view returns (QueuedAction[] memory);
  function getPendingQueuedActionState(address playerOwner, uint256 playerId)
    external
    view
    returns (PendingQueuedActionState memory);
  function getActivePlayerInfo(address playerOwner) external view returns (ActivePlayerInfo memory);
  function setImpls(
    address implQueueActions,
    address implProcessActions,
    address implRewards,
    address implMisc,
    address implMisc1
  ) external;
  function addXPThresholdRewards(XPThresholdReward[] calldata xpThresholdRewards) external;
  function editXPThresholdRewards(XPThresholdReward[] calldata xpThresholdRewards) external;
  function setDailyRewardsEnabled(bool dailyRewardsEnabled) external;
  function pauseGame(bool gamePaused) external;
  function addFullAttireBonuses(FullAttireBonusInput[] calldata fullAttireBonuses) external;
  function setXPModifiers(address[] calldata accounts, bool isModifier) external;
  function bridgePlayer(uint256 playerId, uint256 totalXP, uint256 totalLevel) external;

  function clearEverythingBeforeTokenTransfer(address from, uint256 tokenId) external;

  function beforeTokenTransferTo(address to, uint256 tokenId) external;

  function getURI(
    uint256 playerId,
    string calldata name,
    string calldata avatarName,
    string calldata avatarDescription,
    string calldata imageURI
  ) external view returns (string memory);

  function mintedPlayer(
    address from,
    uint256 playerId,
    Skill[2] calldata startSkills,
    bool makeActive,
    uint256[] calldata startingItemTokenIds,
    uint256[] calldata startingAmounts
  ) external;

  function upgradePlayer(uint256 playerId) external;

  function applyAvatarToPlayer(address from, uint256 playerId, Skill[2] calldata skills) external;

  function isPlayerEvolved(uint256 playerId) external view returns (bool);

  function isOwnerOfPlayerAndActive(address from, uint256 playerId) external view returns (bool);

  function getAlphaCombatParams() external view returns (uint8 alphaCombat, uint8 betaCombat, uint8 alphaCombatHealing);

  function getActivePlayer(address owner) external view returns (uint256 playerId);

  function getPlayerXP(uint256 playerId, Skill skill) external view returns (uint256 xp);

  function getLastActiveTimestamp(uint256 playerId) external view returns (uint256 lastActiveTimestamp);

  function getLevel(uint256 playerId, Skill skill) external view returns (uint256 level);

  function getTotalXP(uint256 playerId) external view returns (uint256 totalXP);

  function getTotalLevel(uint256 playerId) external view returns (uint256 totalLevel);

  function getActiveBoost(uint256 playerId) external view returns (ExtendedBoostInfo memory);

  function modifyXP(address from, uint256 playerId, Skill skill, uint56 xp, bool skipEffects) external;

  function beforeItemNFTTransfer(address from, address to, uint256[] calldata ids, uint256[] calldata amounts) external;
}
