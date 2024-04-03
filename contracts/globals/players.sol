// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {QueuedAction} from "./actions.sol";
import {Skill, BoostType, CombatStats, Equipment} from "./misc.sol";
import {PlayerQuest} from "./quests.sol";

// 4 bytes for each level. 0x00000000 is the first level, 0x00000054 is the second, etc.
bytes constant XP_BYTES = hex"0000000000000054000000AE0000010E00000176000001E60000025E000002DE00000368000003FD0000049B00000546000005FC000006C000000792000008730000096400000A6600000B7B00000CA400000DE100000F36000010A200001229000013CB0000158B0000176B0000196E00001B9400001DE20000205A000022FF000025D5000028DD00002C1E00002F99000033540000375200003B9A000040300000451900004A5C00004FFF0000560900005C810000637000006ADD000072D100007B570000847900008E42000098BE0000A3F90000B0020000BCE70000CAB80000D9860000E9630000FA6200010C990001201D0001350600014B6F0001637300017D2E000198C10001B64E0001D5F80001F7E600021C430002433B00026CFD000299BE0002C9B30002FD180003342B00036F320003AE730003F23D00043AE3000488BE0004DC2F0005359B000595700005FC2400066A360006E02D00075E990007E6160008774C000912EB0009B9B4000A6C74000B2C06000BF956000CD561000DC134000EBDF3000FCCD40010EF24";

enum EquipPosition {
  NONE,
  HEAD,
  NECK,
  BODY,
  ARMS,
  LEGS,
  FEET,
  SPARE1,
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
  uint40 currentActionStartTime; // The start time of the first queued action
  Skill currentActionProcessedSkill1; // The skill that the queued action has already gained XP in
  uint24 currentActionProcessedXPGained1; // The amount of XP that the queued action has already gained
  Skill currentActionProcessedSkill2;
  uint24 currentActionProcessedXPGained2;
  uint16 currentActionProcessedFoodConsumed;
  uint16 currentActionProcessedBaseInputItemsConsumedNum; // e.g scrolls, crafting materials etc
  Skill skillBoosted1; // The skill that is boosted
  Skill skillBoosted2; // The second skill that is boosted
  uint56 totalXP;
  Skill currentActionProcessedSkill3;
  uint24 currentActionProcessedXPGained3;
  bytes1 packedData; // Contains worldLocation in first 6 bits (0 is the main starting world), and full mode unlocked in the upper most bit
  // TODO: Can be up to 7
  QueuedAction[] actionQueue;
  string name; // Raw name
}

struct Item {
  EquipPosition equipPosition;
  bytes1 packedData; // 0x1 exists, upper most bit is full mode
  // Can it be transferred?
  bool isTransferable;
  // Food
  uint16 healthRestored;
  // Boost vial
  BoostType boostType;
  uint16 boostValue; // Varies, could be the % increase
  uint24 boostDuration; // How long the effect of the boost last
  // Combat stats
  int16 melee;
  int16 magic;
  int16 ranged;
  int16 meleeDefence;
  int16 magicDefence;
  int16 rangedDefence;
  int16 health;
  // Minimum requirements in this skill to use this item (can be NONE)
  Skill skill;
  uint32 minXP;
}

struct ItemV1 {
  EquipPosition equipPosition;
  bool exists;
  bool isTransferable;
  uint16 healthRestored;
  BoostType boostType;
  uint16 boostValue;
  uint24 boostDuration;
  int16 melee;
  int16 magic;
  int16 ranged;
  int16 meleeDefence;
  int16 magicDefence;
  int16 rangedDefence;
  int16 health;
  Skill skill;
  uint32 minXP;
}

struct ItemOutput {
  EquipPosition equipPosition;
  bool isFullModeOnly;
  bool isTransferable;
  uint16 healthRestored;
  BoostType boostType;
  uint16 boostValue;
  uint24 boostDuration;
  int16 melee;
  int16 magic;
  int16 ranged;
  int16 meleeDefence;
  int16 magicDefence;
  int16 rangedDefence;
  int16 health;
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
  Skill skill; // Skill that this action choice is related to
  int16 skillDiff; // How much the skill is increased/decreased by this action choice
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
  Skill[] minSkills; // Skills required to do this action choice
  uint32[] minXPs; // Min XP in the corresponding skills to be able to do this action choice
}

struct ActionChoiceInputV3 {
  Skill skill; // Skill that this action choice is related to
  int16 skillDiff; // How much the skill is increased/decreased by this action choice
  uint24 rate; // Rate of output produced per hour (base 1000) 3 decimals
  uint24 xpPerHour;
  uint16[] inputTokenIds;
  uint8[] inputAmounts;
  uint16 outputTokenId;
  uint8 outputAmount;
  uint8 successPercent; // 0-100
  uint16 handItemTokenIdRangeMin; // Inclusive
  uint16 handItemTokenIdRangeMax; // Inclusive
  bool isFullModeOnly;
  Skill[] minSkills; // Skills required to do this action choice
  uint32[] minXPs; // Min XP in the corresponding skills to be able to do this action choice
}

struct ActionChoiceInputV2 {
  Skill skill; // Skill that this action choice is related to
  uint32 minXP; // Min XP in the skill to be able to do this action choice
  int16 skillDiff; // How much the skill is increased/decreased by this action choice
  uint24 rate; // Rate of output produced per hour (base 1000) 3 decimals
  uint24 xpPerHour;
  uint16 inputTokenId1;
  uint8 inputAmount1;
  uint16 inputTokenId2;
  uint8 inputAmount2;
  uint16 inputTokenId3;
  uint8 inputAmount3;
  uint16 outputTokenId;
  uint8 outputAmount;
  uint8 successPercent; // 0-100
  uint16 handItemTokenIdRangeMin; // Inclusive
  uint16 handItemTokenIdRangeMax; // Inclusive
  bool isFullModeOnly;
}

struct ActionChoice {
  Skill skill; // Skill that this action choice is related to
  uint32 minXP; // Min XP in the skill to be able to do this action choice
  int16 skillDiff; // How much the skill is increased/decreased by this action choice
  uint24 rate; // Rate of output produced per hour (base 1000) 3 decimals
  uint24 xpPerHour;
  uint16 inputTokenId1;
  uint8 inputAmount1;
  uint16 inputTokenId2;
  uint8 inputAmount2;
  uint16 inputTokenId3;
  uint8 inputAmount3;
  uint16 outputTokenId;
  uint8 outputAmount;
  uint8 successPercent; // 0-100
  uint16 handItemTokenIdRangeMin; // Inclusive
  uint16 handItemTokenIdRangeMax; // Inclusive
  // FullMode is last bit, first 6 bits is worldLocation,
  // 2nd last bit is if there are other skills in next storage slot to check,
  // 3rd last bit if the input amounts should be used
  bytes1 packedData;
  bytes1 reserved;
  // Second storage slot
  Skill minSkill2;
  uint32 minXP2;
  Skill minSkill3;
  uint32 minXP3;
  uint24 newInputAmount1; // alternative inputAmount1
  uint24 newInputAmount2; // alternative inputAmount2
  uint24 newInputAmount3; // alternative inputAmount3
}

struct ActionChoiceV2 {
  Skill skill; // Skill that this action choice is related to
  uint32 minXP; // Min XP in the skill to be able to do this action choice
  int16 skillDiff; // How much the skill is increased/decreased by this action choice
  uint24 rate; // Rate of output produced per hour (base 1000) 3 decimals
  uint24 xpPerHour;
  uint16 inputTokenId1;
  uint8 inputAmount1;
  uint16 inputTokenId2;
  uint8 inputAmount2;
  uint16 inputTokenId3;
  uint8 inputAmount3;
  uint16 outputTokenId;
  uint8 outputAmount;
  uint8 successPercent; // 0-100
  uint16 handItemTokenIdRangeMin; // Inclusive
  uint16 handItemTokenIdRangeMax; // Inclusive
  bytes1 packedData; // FullMode is last bit
}

struct ActionChoiceV1 {
  Skill skill;
  uint32 minXP;
  int16 skillDiff;
  uint24 rate;
  uint24 xpPerHour;
  uint16 inputTokenId1;
  uint8 inputAmount1;
  uint16 inputTokenId2;
  uint8 inputAmount2;
  uint16 inputTokenId3;
  uint8 inputAmount3;
  uint16 outputTokenId;
  uint8 outputAmount;
  uint8 successPercent; // 0-100
}

// Must be in the same order as Skill enum
struct PackedXP {
  uint40 melee;
  uint40 ranged;
  uint40 magic;
  uint40 defence;
  uint40 health;
  uint40 reservedCombat;
  bytes2 packedDataIsMaxed; // 2 bits per skill, 1 = first maxed level
  // Next slot
  uint40 mining;
  uint40 woodcutting;
  uint40 fishing;
  uint40 smithing;
  uint40 thieving;
  uint40 crafting;
  bytes2 packedDataIsMaxed1; // 2 bits per skill, 1 = first maxed level
  // Next slot
  uint40 cooking;
  uint40 firemaking;
  uint40 agility;
  uint40 alchemy;
  uint40 fletching;
  uint40 forging;
  bytes2 packedDataIsMaxed2; // 2 bits per skill, 1 = first maxed level
}

struct AvatarInfo {
  string name;
  string description;
  string imageURI;
  Skill[2] startSkills; // Can be NONE
}

struct PastRandomRewardInfo {
  uint64 queueId;
  uint16 itemTokenId;
  uint24 amount;
}

struct PendingQueuedActionEquipmentState {
  uint[] consumedItemTokenIds;
  uint[] consumedAmounts;
  uint[] producedItemTokenIds;
  uint[] producedAmounts;
}

struct PendingQueuedActionMetadata {
  uint32 xpGained; // total xp gained
  uint32 rolls;
  bool died;
  uint16 actionId;
  uint64 queueId;
  uint24 elapsedTime;
  uint24 xpElapsedTime;
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
  uint[] consumedItemTokenIds;
  uint[] consumedAmounts;
  uint[] rewardItemTokenIds;
  uint[] rewardAmounts;
  PlayerQuest[] activeQuestInfo;
  uint[] questsCompleted;
  Skill[] skills; // Skills gained XP in
  uint32[] xpGainedSkills; // XP gained in these skills
}

struct LotteryWinnerInfo {
  uint16 lotteryId;
  uint24 raffleId;
  uint16 itemTokenId;
  uint16 amount;
  bool instantConsume;
  uint40 playerId;
}

struct PendingQueuedActionState {
  // These 2 are in sync. Separated to reduce gas/deployment costs as these are passed down many layers.
  PendingQueuedActionEquipmentState[] equipmentStates;
  PendingQueuedActionMetadata[] actionMetadatas;
  QueuedAction[] remainingQueuedActions;
  PastRandomRewardInfo[] producedPastRandomRewards;
  uint[] xpRewardItemTokenIds;
  uint[] xpRewardAmounts;
  uint[] dailyRewardItemTokenIds;
  uint[] dailyRewardAmounts;
  PendingQueuedActionProcessed processedData;
  bytes32 dailyRewardMask;
  QuestState quests;
  uint numPastRandomRewardInstancesToRemove;
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

uint constant MAX_UNIQUE_TICKETS_ = 64;
uint constant IS_FULL_MODE_BIT = 7;

// Queued action
uint constant IS_VALID_BIT = 0;
uint constant HAS_PET_BIT = 1;
