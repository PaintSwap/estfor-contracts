// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

// solhint-disable-next-line no-global-import
import "../globals/all.sol";

interface IPlayersBase {
  struct FullAttireBonus {
    uint8 bonusXPPercent;
    uint8 bonusRewardsPercent;
    uint16[5] itemTokenIds;
  }

  struct WalletDailyInfo {
    uint40 lastDailyRewardClaimedTimestamp;
  }

  event ClearAll(address from, uint256 playerId);
  event SetActionQueue(address from, uint256 playerId, QueuedAction[] queuedActions, Attire[] attire, uint256 startTime);
  event AddXP(address from, uint256 playerId, Skill skill, uint256 points);
  event ConsumeBoostVial(address from, uint256 playerId, BoostInfo playerBoostInfo);
  event ConsumeExtraBoostVial(address from, uint256 playerId, BoostInfo playerBoostInfo);
  event ConsumeGlobalBoostVial(address from, uint256 playerId, BoostInfo globalBoost);
  event ConsumeClanBoostVial(address from, uint256 playerId, uint256 clanId, BoostInfo clanBoost);
  event SetActivePlayer(address account, uint256 oldPlayerId, uint256 newPlayerId);
  event AddPendingRandomReward(address from, uint256 playerId, uint256 queueId, uint256 startTime, uint256 elapsed, uint256 rolls);
  event PendingRandomRewardsClaimed(address from, uint256 playerId, uint256 numRemoved, uint256[] itemTokenIds, uint256[] amounts, uint256[] queueIds);
  event AdminAddThresholdReward(XPThresholdReward xpThresholdReward);
  event AdminEditThresholdReward(XPThresholdReward xpThresholdReward);
  event BoostFinished(uint256 playerId);
  event ExtraBoostFinished(uint256 playerId);
  event SetCombatParams(uint256 alphaCombat, uint256 betaCombat, uint256 alphaCombatHealing);
  event UpdateLastBoost(uint256 playerId, BoostInfo boostInfo);
  event UpdateLastExtraBoost(uint256 playerId, BoostInfo boostInfo);
  event Died(address from, uint256 playerId, uint256 queueId);
  event QuestRewardConsumes(address from, uint256 playerId, uint256[] rewardItemTokenIds, uint256[] rewardAmounts, uint256[] consumedItemTokenIds, uint256[] consumedAmounts);
  event Rewards(address from, uint256 playerId, uint256 queueId, uint256[] itemTokenIds, uint256[] amounts);
  event DailyReward(address from, uint256 playerId, uint256 itemTokenId, uint256 amount);
  event WeeklyReward(address from, uint256 playerId, uint256 itemTokenId, uint256 amount);
  event Consumes(address from, uint256 playerId, uint256 queueId, uint256[] itemTokenIds, uint256[] amounts);
  event ActionFinished(address from, uint256 playerId, uint256 queueId);
  event ActionPartiallyFinished(address from, uint256 playerId, uint256 queueId, uint256 elapsedTime);
  event ActionAborted(address from, uint256 playerId, uint256 queueId);
  event ClaimedXPThresholdRewards(address from, uint256 playerId, uint256[] itemTokenIds, uint256[] amounts);
  event LevelUp(address from, uint256 playerId, Skill skill, uint256 oldLevel, uint256 newLevel);
  event AddFullAttireBonus(Skill skill, uint16[5] itemTokenIds, uint256 bonusXPPercent, uint256 bonusRewardsPercent);

  error NotOwnerOfPlayer();
  error NotOwnerOfPlayerAndActive();
  error EquipSameItem();
  error NotEquipped();
  error ArgumentLengthMismatch();
  error NotPlayerNFT();
  error NotItemNFT();
  error ActionNotAvailable();
  error UnsupportedAttire(uint16 itemTokenId);
  error UnsupportedChoiceId();
  error InvalidHandEquipment(uint16 itemTokenId);
  error NoActiveBoost();
  error BoostTimeAlreadyStarted();
  error TooManyActionsQueued();
  error TooManyActionsQueuedSomeAlreadyExist();
  error ActionTimespanExceedsMaxTime();
  error ActionTimespanZero();
  error ActionMinimumXPNotReached();
  error ActionChoiceMinimumXPNotReached();
  error ItemMinimumXPNotReached();
  error AttireMinimumXPNotReached();
  error ConsumableMinimumXPNotReached();
  error NoItemBalance(uint16 itemTokenId);
  error CannotEquipTwoHandedAndOtherEquipment();
  error IncorrectRightHandEquipment(uint16 equippedItemTokenId);
  error IncorrectLeftHandEquipment(uint16 equippedItemTokenId);
  error IncorrectEquippedItem();
  error NotABoostVial();
  error UnsupportedRegenerateItem();
  error InvalidCombatStyle();
  error InvalidSkill();
  error InvalidTravellingTimespan();
  error ActionChoiceIdRequired();
  error ActionChoiceIdNotRequired();
  error InvalidEquipPosition();
  error NoActionsToProcess();
  error NotAdminAndBeta();
  error XPThresholdNotFound();
  error XPThresholdAlreadyExists();
  error XPThresholdDoesNotExist();
  error InvalidItemTokenId();
  error ItemDoesNotExist();
  error InvalidAmount();
  error EmptyTimespan();
  error PlayerAlreadyActive();
  error TestInvalidXP();
  error HasQueuedActions();
  error CannotCallInitializerOnImplementation();
  error InvalidReward();
  error BuyBrushFailed();
  error NonInstanceConsumeNotSupportedYet();
  error AlreadyUpgraded();
  error PlayerNotUpgraded();
  error ActionChoiceNotAvailable();
  error PetNotOwned();
  error DependentQuestNotCompleted();
}
