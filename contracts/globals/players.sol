// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {QueuedAction} from "./actions.sol";
import {Skill, BoostType, CombatStats, Equipment} from "./misc.sol";
import {PlayerQuest} from "./quests.sol";

// 4 bytes for each level. 0x00000000 is the first level, 0x00000054 is the second, etc.
bytes constant XP_BYTES = hex"0000000000000054000000AE0000010E00000176000001E60000025E000002DE00000368000003FD0000049B00000546000005FC000006C000000792000008730000096400000A6600000B7B00000CA400000DE100000F36000010A200001229000013CB0000158B0000176B0000196E00001B9400001DE20000205A000022FF000025D5000028DD00002C1E00002F99000033540000375200003B9A000040300000451900004A5C00004FFF0000560900005C810000637000006ADD000072D100007B570000847900008E42000098BE0000A3F90000B0020000BCE70000CAB80000D9860000E9630000FA6200010C990001201D0001350600014B6F0001637300017D2E000198C10001B64E0001D5F80001F7E600021C430002433B00026CFD000299BE0002C9B30002FD180003342B00036F320003AE730003F23D00043AE3000488BE0004DC2F0005359B000595700005FC2400066A360006E02D00075E990007E6160008774C000912EB0009B9B4000A6C74000B2C06000BF956000CD561000DC134000EBDF3000FCCD40010EF2400122648001373BF0014D9230016582C0017F2B00019AAA9001B8234001D7B95001F99390021DDBC00244BE60026E6B60029B15F002CAF51002FE43A0033540D00370303003AF5A4003F30CC0043B9B0004895E3004DCB600053609100595C53005FC6030066A585006E034D0075E86C007E5E980087703B0091287D009B935300A6BD8F00B2B4EE00BF8828";
uint256 constant MAX_LEVEL = 135; // Original max level
uint256 constant MAX_LEVEL_1 = 160; // TODO: Update later
uint256 constant MAX_LEVEL_2 = 190; // TODO: Update later

enum EquipPosition {
  NONE,
  HEAD,
  NECK,
  BODY,
  ARMS,
  LEGS,
  FEET,
  RING,
  SPARE2,
  LEFT_HAND,
  RIGHT_HAND,
  BOTH_HANDS,
  QUIVER,
  MAGIC_BAG,
  FOOD,
  AUX, // wood, seeds  etc..
  BOOST_VIAL,
  EXTRA_BOOST_VIAL,
  GLOBAL_BOOST_VIAL,
  CLAN_BOOST_VIAL,
  PASSIVE_BOOST_VIAL,
  LOCKED_VAULT,
  TERRITORY
}

struct Player {
  uint40 currentActionStartTimestamp; // The in-progress start time of the first queued action
  Skill currentActionProcessedSkill1; // The skill that the queued action has already gained XP in
  uint24 currentActionProcessedXPGained1; // The amount of XP that the queued action has already gained
  Skill currentActionProcessedSkill2;
  uint24 currentActionProcessedXPGained2;
  Skill currentActionProcessedSkill3;
  uint24 currentActionProcessedXPGained3;
  uint16 currentActionProcessedFoodConsumed;
  uint16 currentActionProcessedBaseInputItemsConsumedNum; // e.g scrolls, crafting materials etc
  Skill skillBoosted1; // The first skill that is boosted
  Skill skillBoosted2; // The second skill that is boosted (if applicable)
  uint48 totalXP;
  uint16 totalLevel; // Doesn't not automatically add new skills to it
  bytes1 packedData; // Contains worldLocation in first 6 bits (0 is the main starting randomnessBeacon), and full mode unlocked in the upper most bit
  // TODO: Can be up to 7
  QueuedAction[] actionQueue;
  string name; // Raw name
}

struct Item {
  EquipPosition equipPosition;
  bytes1 packedData; // 0x1 exists, upper most bit is full mode
  uint16 questPrerequisiteId;
  // Can it be transferred?
  bool isTransferable; // TODO: Move into packedData
  // Food
  uint16 healthRestored;
  // Boost vial
  BoostType boostType;
  uint16 boostValue; // Varies, could be the % increase
  uint24 boostDuration; // How long the effect of the boost last
  // Combat stats
  int16 meleeAttack;
  int16 magicAttack;
  int16 rangedAttack;
  int16 meleeDefence;
  int16 magicDefence;
  int16 rangedDefence;
  int16 health;
  // Minimum requirements in this skill to use this item (can be NONE)
  Skill skill;
  uint32 minXP;
}

// Used for events
struct BoostInfo {
  uint40 startTime;
  uint24 duration;
  uint16 value;
  uint16 itemTokenId; // Get the effect of it
  BoostType boostType;
}

struct PlayerBoostInfo {
  uint40 startTime;
  uint24 duration;
  uint16 value;
  uint16 itemTokenId; // Get the effect of it
  BoostType boostType;
  // Another boost slot (for global/clan boosts this is the "last", for users it is the "extra")
  uint40 extraOrLastStartTime;
  uint24 extraOrLastDuration;
  uint16 extraOrLastValue;
  uint16 extraOrLastItemTokenId;
  BoostType extraOrLastBoostType;
  uint40 cooldown; // Just put here for packing
}

// This is effectively a ratio to produce 1 of outputTokenId.
// Available choices that can be undertaken for an action
struct ActionChoiceInput {
  uint8 skill; // Skill that this action choice is related to
  uint24 rate; // Rate of output produced per hour (base 1000) 3 decimals
  uint24 xpPerHour;
  uint16[] inputTokenIds;
  uint24[] inputAmounts;
  uint16 outputTokenId;
  uint8 outputAmount;
  uint8 successPercent; // 0-100
  uint16 handItemTokenIdRangeMin; // Inclusive
  uint16 handItemTokenIdRangeMax; // Inclusive
  bool isFullModeOnly;
  bool isAvailable;
  uint16 questPrerequisiteId;
  uint8[] skills; // Skills required to do this action choice
  uint32[] skillMinXPs; // Min XP in the corresponding skills to be able to do this action choice
  int16[] skillDiffs; // How much the skill is increased/decreased by this action choice
}

struct ActionChoice {
  uint8 skill; // Skill that this action choice is related to
  uint24 rate; // Rate of output produced per hour (base 1000) 3 decimals
  uint24 xpPerHour;
  uint16 inputTokenId1;
  uint24 inputAmount1;
  uint16 inputTokenId2;
  uint24 inputAmount2;
  uint16 inputTokenId3;
  uint24 inputAmount3;
  uint16 outputTokenId;
  uint8 outputAmount;
  uint8 successPercent; // 0-100
  uint8 skill1; // Skills required to do this action choice, commonly the same as skill
  uint32 skillMinXP1; // Min XP in the skill to be able to do this action choice
  int16 skillDiff1; // How much the skill is increased/decreased by this action choice
  uint8 skill2;
  uint32 skillMinXP2;
  int16 skillDiff2;
  uint8 skill3;
  uint32 skillMinXP3;
  int16 skillDiff3;
  uint16 handItemTokenIdRangeMin; // Inclusive
  uint16 handItemTokenIdRangeMax; // Inclusive
  uint16 questPrerequisiteId;
  // FullMode is last bit, first 6 bits is worldLocation,
  // 2nd last bit is if there are other skills in next storage slot to check,
  // 3rd last bit if the input amounts should be used
  bytes1 packedData;
}

// Must be in the same order as Skill enum
struct PackedXP {
  uint40 melee;
  uint40 ranged;
  uint40 magic;
  uint40 defence;
  uint40 health;
  uint40 reservedCombat;
  bytes2 packedDataIsMaxed; // 2 bits per skill to indicate whether the maxed skill is reached. I think this was added in case we added a new max level which a user had already passed so old & new levels are the same and it would not trigger a level up event.
  // Next slot
  uint40 mining;
  uint40 woodcutting;
  uint40 fishing;
  uint40 smithing;
  uint40 thieving;
  uint40 crafting;
  bytes2 packedDataIsMaxed1; // 2 bits per skill to indicate whether the maxed skill is reached
  // Next slot
  uint40 cooking;
  uint40 firemaking;
  uint40 farming;
  uint40 alchemy;
  uint40 fletching;
  uint40 forging;
  bytes2 packedDataIsMaxed2; // 2 bits per skill to indicate whether the maxed skill is reached
}

struct AvatarInfo {
  string name;
  string description;
  string imageURI;
  Skill[2] startSkills; // Can be NONE
}

struct PastRandomRewardInfo {
  uint16 itemTokenId;
  uint24 amount;
  uint64 queueId;
}

struct PendingQueuedActionEquipmentState {
  uint256[] consumedItemTokenIds;
  uint256[] consumedAmounts;
  uint256[] producedItemTokenIds;
  uint256[] producedAmounts;
}

struct PendingQueuedActionMetadata {
  uint32 xpGained; // total xp gained
  uint32 rolls;
  bool died;
  uint16 actionId;
  uint64 queueId;
  uint24 elapsedTime;
  uint24 xpElapsedTime;
  uint8 checkpoint;
}

struct PendingQueuedActionData {
  // The amount of XP that the queued action has already gained
  Skill skill1;
  uint24 xpGained1;
  Skill skill2; // Most likely health
  uint24 xpGained2;
  Skill skill3; // Could come
  uint24 xpGained3;
  // How much food is consumed in the current action so far
  uint16 foodConsumed;
  // How many base consumables are consumed in the current action so far
  uint16 baseInputItemsConsumedNum;
}

struct PendingQueuedActionProcessed {
  // XP gained during this session
  Skill[] skills;
  uint32[] xpGainedSkills;
  // Data for the current action which has been previously processed, this is used to store on the Player
  PendingQueuedActionData currentAction;
}

struct QuestState {
  uint256[] consumedItemTokenIds;
  uint256[] consumedAmounts;
  uint256[] rewardItemTokenIds;
  uint256[] rewardAmounts;
  PlayerQuest[] activeQuestInfo;
  uint256[] questsCompleted;
  Skill[] skills; // Skills gained XP in
  uint32[] xpGainedSkills; // XP gained in these skills
}

struct LotteryWinnerInfo {
  uint16 lotteryId;
  uint24 raffleId;
  uint16 itemTokenId;
  uint16 amount;
  bool instantConsume;
  uint64 playerId;
}

struct PendingQueuedActionState {
  // These 2 are in sync. Separated to reduce gas/deployment costs as these are passed down many layers.
  PendingQueuedActionEquipmentState[] equipmentStates;
  PendingQueuedActionMetadata[] actionMetadatas;
  QueuedAction[] remainingQueuedActions;
  PastRandomRewardInfo[] producedPastRandomRewards;
  uint256[] xpRewardItemTokenIds;
  uint256[] xpRewardAmounts;
  uint256[] dailyRewardItemTokenIds;
  uint256[] dailyRewardAmounts;
  PendingQueuedActionProcessed processedData;
  bytes32 dailyRewardMask;
  QuestState quests;
  uint256 numPastRandomRewardInstancesToRemove;
  uint8 worldLocation;
  LotteryWinnerInfo lotteryWinner;
}

struct FullAttireBonusInput {
  Skill skill;
  uint8 bonusXPPercent;
  uint8 bonusRewardsPercent; // 3 = 3%
  uint16[5] itemTokenIds; // 0 = head, 1 = body, 2 arms, 3 body, 4 = feet
}

// Contains everything you need to create an item
struct ItemInput {
  CombatStats combatStats;
  uint16 tokenId;
  EquipPosition equipPosition;
  bool isTransferable;
  bool isFullModeOnly;
  bool isAvailable;
  uint16 questPrerequisiteId;
  // Minimum requirements in this skill
  Skill skill;
  uint32 minXP;
  // Food
  uint16 healthRestored;
  // Boost
  BoostType boostType;
  uint16 boostValue; // Varies, could be the % increase
  uint24 boostDuration; // How long the effect of the boost vial last
  // uri
  string metadataURI;
  string name;
}

/* Order head, neck, body, arms, legs, feet, ring, reserved1,
   leftHandEquipment, rightHandEquipment,
   Not used yet: input1, input2,input3, regenerate, reserved2, reserved3 */
struct CheckpointEquipments {
  uint16[16] itemTokenIds;
  uint16[16] balances;
}

struct ActivePlayerInfo {
  uint64 playerId;
  uint40 checkpoint;
  uint24 timespan;
  uint24 timespan1;
  uint24 timespan2;
}

uint8 constant START_LEVEL = 17; // Needs updating when there is a new skill. Only useful for new heroes.

uint256 constant MAX_UNIQUE_TICKETS = 64;
// Used in a bunch of places
uint256 constant IS_FULL_MODE_BIT = 7;

// Passive/Instant/InstantVRF/Actions/ActionChoices/Item action
uint256 constant IS_AVAILABLE_BIT = 6;

// Passive actions
uint256 constant HAS_RANDOM_REWARDS_BIT = 5;

// The rest use world location for first 4 bits

// Queued action
uint256 constant HAS_PET_BIT = 2;
uint256 constant IS_VALID_BIT = 1;
