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

interface Players {
    function UPGRADE_INTERFACE_VERSION() external view returns (string memory);
    function activateQuest(uint256 playerId, uint256 questId) external;
    function addFullAttireBonuses(FullAttireBonusInput[] calldata fullAttireBonuses) external;
    function addXPThresholdRewards(XPThresholdReward[] calldata xpThresholdRewards) external;
    function applyAvatarToPlayer(address from_, uint256 playerId, Skill[2] calldata skills) external;
    function beforeItemNFTTransfer(address from_, address to, uint256[] calldata ids, uint256[] calldata amounts)
        external;
    function beforeTokenTransferTo(address to, uint256 playerId) external;
    function bridgePlayer(uint256 playerId, uint256 totalXP, uint256 totalLevel) external;
    function buyBrushQuest(address to, uint256 playerId, uint256 questId, bool useExactETH) external payable;
    function clearEverythingBeforeTokenTransfer(address from_, uint256 playerId) external;
    function dailyClaimedRewards(uint256 playerId) external view returns (bool[7] memory claimed);
    function deactivateQuest(uint256 playerId) external;
    function donate(uint256 playerId, uint256 amount) external;
    function editXPThresholdRewards(XPThresholdReward[] calldata xpThresholdRewards) external;
    function getActionQueue(uint256 playerId) external view returns (QueuedAction[] memory);
    function getActiveBoost(uint256 playerId) external view returns (ExtendedBoostInfo memory);
    function getActivePlayer(address playerOwner) external view returns (uint256 playerId);
    function getActivePlayerInfo(address playerOwner) external view returns (ActivePlayerInfo memory);
    function getAlphaCombatParams()
        external
        view
        returns (uint8 alphaCombat, uint8 betaCombat, uint8 alphaCombatHealing);
    function getLastActiveTimestamp(uint256 playerId) external view returns (uint256);
    function getLevel(uint256 playerId, Skill skill) external view returns (uint256 level);
    function getPendingQueuedActionState(address playerOwner, uint256 playerId)
        external
        view
        returns (PendingQueuedActionState memory);
    function getPendingRandomRewards(uint256 playerId) external view returns (PendingRandomReward[] memory);
    function getPlayerXP(uint256 playerId, Skill skill) external view returns (uint256);
    function getTotalLevel(uint256 playerId) external view returns (uint256 totalLevel);
    function getTotalXP(uint256 playerId) external view returns (uint256 totalXP);
    function getURI(
        uint256 playerId,
        string calldata name,
        string calldata avatarName,
        string calldata avatarDescription,
        string calldata imageURI
    ) external view returns (string memory);
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
    function isOwnerOfPlayerAndActive(address from_, uint256 playerId) external view returns (bool);
    function isPlayerEvolved(uint256 playerId) external view returns (bool);
    function mintedPlayer(
        address from_,
        uint256 playerId,
        Skill[2] calldata startSkills,
        bool makeActive,
        uint256[] calldata startingItemTokenIds,
        uint256[] calldata startingAmounts
    ) external;
    function modifyXP(address from_, uint256 playerId, Skill skill, uint56 xp, bool skipEffects) external;
    function owner() external view returns (address);
    function pauseGame(bool gamePaused) external;
    function processActions(uint256 playerId) external;
    function proxiableUUID() external view returns (bytes32);
    function renounceOwnership() external;
    function setActivePlayer(uint256 playerId) external;
    function setActivityPoints(address activityPoints) external;
    function setAlphaCombatParams(uint8 alphaCombat, uint8 betaCombat, uint8 alphaCombatHealing) external;
    function setDailyRewardsEnabled(bool dailyRewardsEnabled) external;
    function setImpls(
        address implQueueActions,
        address implProcessActions,
        address implRewards,
        address implMisc,
        address implMisc1
    ) external;
    function setXPModifiers(address[] calldata accounts, bool isModifier) external;
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
    function transferOwnership(address newOwner) external;
    function upgradePlayer(uint256 playerId) external;
    function upgradeToAndCall(address newImplementation, bytes calldata data) external payable;
    function validateActions(address owner_, uint256 playerId, QueuedActionInput[] calldata queuedActions)
        external
        view
        returns (bool[] memory successes, bytes[] memory reasons);
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
    event GamePaused(bool gamePaused);
    event Initialized(uint64 version);
    event LevelUp(address from_, uint256 playerId, Skill skill, uint256 oldLevel, uint256 newLevel);
    event LockPlayer(uint256 playerId, uint256 cooldownTimestamp);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
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
    event UnlockPlayer(uint256 playerId);
    event UpdateLastBoost(uint256 playerId, BoostInfo boostInfo);
    event UpdateLastExtraBoost(uint256 playerId, BoostInfo boostInfo);
    event Upgraded(address indexed implementation);
    event WeeklyReward(address from_, uint256 playerId, uint256 itemTokenId, uint256 amount);
    error ActionChoiceIdNotRequired();
    error ActionChoiceIdRequired();
    error ActionChoiceMinimumXPNotReached();
    error ActionChoiceNotAvailable();
    error ActionMinimumXPNotReached();
    error ActionNotAvailable();
    error ActionTimespanExceedsMaxTime();
    error ActionTimespanZero();
    error AddressEmptyCode(address target);
    error AlreadyUpgraded();
    error ArgumentLengthMismatch();
    error AttireMinimumXPNotReached();
    error BoostTimeAlreadyStarted();
    error BuyBrushFailed();
    error CannotCallInitializerOnImplementation();
    error CannotEquipTwoHandedAndOtherEquipment();
    error ConsumableMinimumXPNotReached();
    error DependentQuestNotCompleted();
    error ERC1967InvalidImplementation(address implementation);
    error ERC1967NonPayable();
    error EmptyTimespan();
    error EquipSameItem();
    error FailedCall();
    error GameIsPaused();
    error HasQueuedActions();
    error IncorrectEquippedItem();
    error IncorrectLeftHandEquipment(uint16 equippedItemTokenId);
    error IncorrectRightHandEquipment(uint16 equippedItemTokenId);
    error InvalidAmount();
    error InvalidCombatStyle();
    error InvalidEquipPosition();
    error InvalidHandEquipment(uint16 itemTokenId);
    error InvalidInitialization();
    error InvalidItemTokenId();
    error InvalidReward();
    error InvalidSelector();
    error InvalidSkill();
    error InvalidTravellingTimespan();
    error InvalidXPSkill();
    error ItemDoesNotExist();
    error ItemMinimumXPNotReached();
    error NoActionsToProcess();
    error NoActiveBoost();
    error NoItemBalance(uint16 itemTokenId);
    error NonInstanceConsumeNotSupportedYet();
    error NotABoostVial();
    error NotAdminAndBeta();
    error NotBridge();
    error NotEquipped();
    error NotInitializing();
    error NotItemNFT();
    error NotOwnerOfPlayer();
    error NotOwnerOfPlayerAndActive();
    error NotPlayerNFT();
    error OwnableInvalidOwner(address owner);
    error OwnableUnauthorizedAccount(address account);
    error PetNotOwned();
    error PlayerAlreadyActive();
    error PlayerLocked();
    error PlayerNotUpgraded();
    error ReentrancyGuardReentrantCall();
    error TestInvalidXP();
    error TooManyActionsQueued();
    error TooManyActionsQueuedSomeAlreadyExist();
    error UUPSUnauthorizedCallContext();
    error UUPSUnsupportedProxiableUUID(bytes32 slot);
    error UnsupportedAttire(uint16 itemTokenId);
    error UnsupportedChoiceId();
    error UnsupportedRegenerateItem();
    error XPThresholdAlreadyExists();
    error XPThresholdDoesNotExist();
    error XPThresholdNotFound();
}
