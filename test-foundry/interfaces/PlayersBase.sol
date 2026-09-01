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

interface PlayersBase {
    event ActionAborted(address from_, uint256 playerId, uint256 queueId);
    event ActionFinished(address from_, uint256 playerId, uint256 queueId);
    event ActionPartiallyFinished(address from_, uint256 playerId, uint256 queueId, uint256 elapsedTime);
    event AddFullAttireBonus(Skill skill, uint16[5] itemTokenIds, uint256 bonusXPPercent, uint256 bonusRewardsPercent);
    event AddPendingRandomReward(
        address from_, uint256 playerId, uint256 queueId, uint256 startTime, uint256 elapsed, uint256 rolls
    );
    event AddXP(address from_, uint256 playerId, Skill skill, uint256 points);
    event AdminAddThresholdReward(XPThresholdReward xpThresholdReward);
    event AdminEditThresholdReward(XPThresholdReward xpThresholdReward);
    event BoostFinished(uint256 playerId);
    event ClaimedXPThresholdRewards(address from_, uint256 playerId, uint256[] itemTokenIds, uint256[] amounts);
    event ClearAll(address from_, uint256 playerId);
    event ConsumeBoostVial(address from_, uint256 playerId, BoostInfo playerBoostInfo);
    event ConsumeClanBoostVial(address from_, uint256 playerId, uint256 clanId, BoostInfo clanBoost);
    event ConsumeExtraBoostVial(address from_, uint256 playerId, BoostInfo playerBoostInfo);
    event ConsumeGlobalBoostVial(address from_, uint256 playerId, BoostInfo globalBoost);
    event Consumes(address from_, uint256 playerId, uint256 queueId, uint256[] itemTokenIds, uint256[] amounts);
    event DailyReward(address from_, uint256 playerId, uint256 itemTokenId, uint256 amount);
    event Died(address from_, uint256 playerId, uint256 queueId);
    event ExtraBoostFinished(uint256 playerId);
    event LevelUp(address from_, uint256 playerId, Skill skill, uint256 oldLevel, uint256 newLevel);
    event PendingRandomRewardsClaimed(
        address from_,
        uint256 playerId,
        uint256 numRemoved,
        uint256[] itemTokenIds,
        uint256[] amounts,
        uint256[] queueIds
    );
    event QuestRewardConsumes(
        address from_,
        uint256 playerId,
        uint256[] rewardItemTokenIds,
        uint256[] rewardAmounts,
        uint256[] consumedItemTokenIds,
        uint256[] consumedAmounts
    );
    event Rewards(address from_, uint256 playerId, uint256 queueId, uint256[] itemTokenIds, uint256[] amounts);
    event SetActionQueue(
        address from_, uint256 playerId, QueuedAction[] queuedActions, Attire[] attire, uint256 startTime
    );
    event SetActivePlayer(address account, uint256 oldPlayerId, uint256 newPlayerId);
    event SetCombatParams(uint256 alphaCombat, uint256 betaCombat, uint256 alphaCombatHealing);
    event UpdateLastBoost(uint256 playerId, BoostInfo boostInfo);
    event UpdateLastExtraBoost(uint256 playerId, BoostInfo boostInfo);
    event WeeklyReward(address from_, uint256 playerId, uint256 itemTokenId, uint256 amount);
    error ActionChoiceIdNotRequired();
    error ActionChoiceIdRequired();
    error ActionChoiceMinimumXPNotReached();
    error ActionChoiceNotAvailable();
    error ActionMinimumXPNotReached();
    error ActionNotAvailable();
    error ActionTimespanExceedsMaxTime();
    error ActionTimespanZero();
    error AlreadyUpgraded();
    error ArgumentLengthMismatch();
    error AttireMinimumXPNotReached();
    error BoostTimeAlreadyStarted();
    error BuyBrushFailed();
    error CannotCallInitializerOnImplementation();
    error CannotEquipTwoHandedAndOtherEquipment();
    error ConsumableMinimumXPNotReached();
    error DependentQuestNotCompleted();
    error EmptyTimespan();
    error EquipSameItem();
    error HasQueuedActions();
    error IncorrectEquippedItem();
    error IncorrectLeftHandEquipment(uint16 equippedItemTokenId);
    error IncorrectRightHandEquipment(uint16 equippedItemTokenId);
    error InvalidAmount();
    error InvalidCombatStyle();
    error InvalidEquipPosition();
    error InvalidHandEquipment(uint16 itemTokenId);
    error InvalidItemTokenId();
    error InvalidReward();
    error InvalidSkill();
    error InvalidTravellingTimespan();
    error ItemDoesNotExist();
    error ItemMinimumXPNotReached();
    error NoActionsToProcess();
    error NoActiveBoost();
    error NoItemBalance(uint16 itemTokenId);
    error NonInstanceConsumeNotSupportedYet();
    error NotABoostVial();
    error NotAdminAndBeta();
    error NotEquipped();
    error NotItemNFT();
    error NotOwnerOfPlayer();
    error NotOwnerOfPlayerAndActive();
    error NotPlayerNFT();
    error PetNotOwned();
    error PlayerAlreadyActive();
    error PlayerNotUpgraded();
    error TestInvalidXP();
    error TooManyActionsQueued();
    error TooManyActionsQueuedSomeAlreadyExist();
    error UnsupportedAttire(uint16 itemTokenId);
    error UnsupportedChoiceId();
    error UnsupportedRegenerateItem();
    error XPThresholdAlreadyExists();
    error XPThresholdDoesNotExist();
    error XPThresholdNotFound();
}
