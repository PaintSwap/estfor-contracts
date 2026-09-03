// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ActivityType} from "../ActivityPoints/interfaces/IActivityPoints.sol";
import {GlobalEventInfo} from "../globals/events.sol";
import {Equipment, Skill} from "../globals/misc.sol";
import {BasePetMetadata} from "../globals/pets.sol";
import {AvatarInfo, CosmeticInfo} from "../globals/players.sol";
import {ActionRewards, InstantVRFRandomReward, XPThresholdReward} from "../globals/rewards.sol";
import {IInstantActions} from "./IInstantActions.sol";
import {IPlayersBase} from "./IPlayersBase.sol";
import {IQuests} from "./IQuests.sol";
import {IRaids} from "./IRaids.sol";

// Narrow read interfaces used by deployment reconciliation and tests. They keep callers from importing
// implementation contracts, including contracts that Foundry compiles in the via-ir profile.

interface IItemNFTGameData {
  error InvalidStateReadRange();

  function MAX_STATE_READ_LENGTH() external view returns (uint256);
  function getItemTokenIds(uint256 startTokenId, uint256 endTokenId) external view returns (uint16[] memory);
  function getTokenURI(uint16 tokenId) external view returns (string memory);
}

interface IQuestsGameData {
  error InvalidStateReadRange();

  function MAX_STATE_READ_LENGTH() external view returns (uint256);
  function getQuestIds(uint256 startQuestId, uint256 endQuestId) external view returns (uint16[] memory);
  function getMinimumRequirements(
    uint256 questId
  ) external view returns (IQuests.MinimumRequirement[3] memory minimumRequirements);
}

interface IWorldActionsGameData {
  error InvalidStateReadRange();

  function MAX_STATE_READ_LENGTH() external view returns (uint256);
  function getActionIds(uint256 startActionId, uint256 endActionId) external view returns (uint16[] memory);
  function getActionChoiceIds(
    uint16 actionId,
    uint256 startChoiceId,
    uint256 endChoiceId
  ) external view returns (uint16[] memory);
}

interface IInstantActionsGameData {
  error InvalidStateReadRange();

  function MAX_STATE_READ_LENGTH() external view returns (uint256);
  function getActionIds(
    IInstantActions.InstantActionType actionType,
    uint256 startActionId,
    uint256 endActionId
  ) external view returns (uint16[] memory);
}

interface IInstantVRFActionsGameData {
  error InvalidStateReadRange();

  function MAX_STATE_READ_LENGTH() external view returns (uint256);
  function getActionIds(uint256 startActionId, uint256 endActionId) external view returns (uint16[] memory);
}

interface IGenericInstantVRFActionStrategyGameData {
  function getAction(uint16 actionId) external view returns (InstantVRFRandomReward[] memory);
}

interface IEggInstantVRFActionStrategyGameData {
  struct InstantVRFAction {
    uint16 rewardBasePetIdMin;
    uint16 rewardBasePetIdMax;
  }

  function getAction(uint16 actionId) external view returns (InstantVRFAction memory);
}

interface IPassiveActionsGameData {
  error InvalidStateReadRange();

  function MAX_STATE_READ_LENGTH() external view returns (uint256);
  function getActionRewards(uint16 actionId) external view returns (ActionRewards memory);
  function getActionIds(uint256 startActionId, uint256 endActionId) external view returns (uint16[] memory);
}

interface IPetNFTGameData {
  error InvalidStateReadRange();

  function MAX_STATE_READ_LENGTH() external view returns (uint256);
  function getBasePetMetadata(uint24 basePetId) external view returns (BasePetMetadata memory);
  function getBasePetIds(uint256 startBasePetId, uint256 endBasePetId) external view returns (uint24[] memory);
}

interface IPlayerNFTGameData {
  function getAvatar(uint256 avatarId) external view returns (AvatarInfo memory);
}

interface ICosmeticsGameData {
  error InvalidStateReadRange();

  function MAX_STATE_READ_LENGTH() external view returns (uint256);
  function getCosmetic(uint16 itemTokenId) external view returns (CosmeticInfo memory);
  function getCosmeticItemTokenIds(
    uint256 startItemTokenId,
    uint256 endItemTokenId
  ) external view returns (uint16[] memory);
}

interface IDailyRewardsSchedulerGameData {
  function getDailyRewardPool(uint256 tier) external view returns (Equipment[] memory);
  function getWeeklyRewardPool(uint256 tier) external view returns (Equipment[] memory);
}

interface IPlayersGameData {
  function getXPThresholdRewards() external view returns (XPThresholdReward[] memory);
  function getFullAttireBonus(Skill skill) external view returns (IPlayersBase.FullAttireBonus memory);
}

interface IClansGameData {
  function getTierIds() external view returns (uint8[] memory);
}

interface IRaidsGameData {
  error InvalidStateReadRange();

  function MAX_STATE_READ_LENGTH() external view returns (uint256);
  function getBaseRaid(uint256 baseRaidId) external view returns (IRaids.BaseRaid memory);
  function getBaseRaidIds(uint256 startBaseRaidId, uint256 endBaseRaidId) external view returns (uint16[] memory);
  function getCombatActionIds() external view returns (uint16[] memory);
}

interface ITerritoriesGameData {
  function getComparableSkills() external view returns (Skill[] memory);
}

interface IPVPBattlegroundGameData {
  function getComparableSkills() external view returns (Skill[] memory);
  function getNumSkillsToCompare() external view returns (uint8);
}

interface ILockedBankVaultsGameData {
  function getComparableSkills() external view returns (Skill[] memory);
}

interface IGlobalEventsGameData {
  function getGlobalEvent(uint256 eventId) external view returns (GlobalEventInfo memory);
}

interface IBlackMarketTraderGameData {
  struct ShopItem {
    uint128 price;
    uint16 tokenId;
    uint16 amountPerPurchase;
    uint16 currentStock;
    uint16 stock;
    bool isActive;
  }

  function getShopCollection(
    uint256 globalEventId
  ) external view returns (uint16 acceptedItemId, ShopItem[] memory shopItems);
}

interface IActivityPointsGameData {
  enum CalculationType {
    NONE,
    discrete,
    log2,
    log10,
    linear
  }

  struct Calculation {
    CalculationType use;
    uint16 base;
    uint16 multiplier;
    uint16 divider;
    uint64 maxPointsPerDay;
  }

  function getPointsCalculation(ActivityType activityType) external view returns (Calculation memory);
}
