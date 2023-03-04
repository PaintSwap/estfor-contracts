// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

// For optimization purposes this contains a few data items, and everything except combat stats (although it could fit?)
struct Item {
  // TODO: Type?
  EquipPosition equipPosition;
  bool hasNonCombatStats;
  bool hasCombatStats;
  bool exists;
  // Food
  uint16 healthRestored;
  // Boost vial
  BoostType boostType;
  uint16 boostValue; // Varies, could be the % increase
  uint24 boostDuration; // How long the effect of the boost last
  // Combat stats
  int8 attack;
  int8 magic;
  int8 range;
  int8 meleeDefence;
  int8 magicDefence;
  int8 rangeDefence;
  int8 health;
  // Noncombat skills
  Skill skill1;
  int16 skillDiff1;
  //    Skill skill2;
  //    int16 diff2;
  //    Skill skill3;
  //    int16 diff3;
}

enum BoostType {
  NONE,
  ANY_XP,
  COMBAT_XP,
  NON_COMBAT_XP,
  GATHERING,
  ABSENCE
}

enum CombatStyle {
  NONE,
  ATTACK,
  RANGED,
  MAGIC,
  MELEE_DEFENCE,
  RANGED_DEFENCE,
  MAGIC_DEFENCE
}

enum Skill {
  NONE,
  COMBAT, // This is a helper which incorporates all combat skills, attack <-> magic, defence, health etc
  ATTACK,
  RANGED,
  MAGIC,
  DEFENCE,
  HEALTH,
  MINING,
  WOODCUTTING,
  FISHING,
  SMITHING,
  THIEVING,
  CRAFTING,
  COOKING,
  FIREMAKING
}

enum EquipPosition {
  HEAD,
  NECK,
  BODY,
  ARMS,
  LEGS,
  BOOTS,
  SPARE1,
  SPARE2,
  LEFT_HAND,
  RIGHT_HAND,
  BOTH_HANDS,
  ARROW_SATCHEL,
  MAGIC_BAG,
  FOOD,
  AUX, // wood, seeds  etc..
  BOOST_VIAL,
  NONE
}

// Loot
struct ActionReward {
  uint16 itemTokenId;
  uint24 rate; // num per hour, base 100 (2 decimals) or percentage chance
}
struct PendingRandomReward {
  uint16 actionId;
  uint128 queueId;
  uint40 timestamp;
  uint24 elapsedTime;
}
struct Equipment {
  uint16 itemTokenId;
  uint16 numToEquip;
}

struct ActionRewards {
  uint16 guaranteedRewardTokenId1;
  uint24 guaranteedRewardRate1; // num per hour, base 100 (2 decimals)
  uint16 guaranteedRewardTokenId2;
  uint24 guaranteedRewardRate2;
  uint16 guaranteedRewardTokenId3;
  uint24 guaranteedRewardRate3;
  // Random chance rewards
  uint16 randomRewardTokenId1;
  uint16 randomRewardChance1; // percentage, base 100 (2 decimals)
  uint16 randomRewardTokenId2;
  uint16 randomRewardChance2;
  uint16 randomRewardTokenId3;
  uint16 randomRewardChance3;
  uint16 randomRewardTokenId4;
  uint16 randomRewardChance4;
}

// This is effectively a ratio to produce 1 of outputTokenId.
// Fixed based available actions that can be undertaken for an action
struct ActionChoice {
  Skill skill;
  uint32 diff;
  uint32 rate; // rate of output produced per hour (base 100) 2 decimals
  uint16 xpPerHour;
  uint32 minSkillPoints;
  uint16 inputTokenId1;
  uint8 num1;
  uint16 inputTokenId2;
  uint8 num2;
  uint16 inputTokenId3;
  uint8 num3;
  uint16 outputTokenId; // Always num of 1
}

// The user chooses these
struct QueuedAction {
  // Keep this first
  Attire attire;
  uint16 actionId;
  uint16 regenerateId; // Food (combat), maybe something for non-combat later
  uint16 choiceId; // Melee/Arrow/Magic (combat), logs, ore (non-combat)
  uint16 choiceId1; // Reserved (TBD)
  uint16 choiceId2; // Reserved (TBD)
  uint16 rightArmEquipmentTokenId; // Axe/Sword/bow, can be empty
  uint16 leftArmEquipmentTokenId; // Shield, can be empty
  uint24 timespan; // How long to queue the action for
  CombatStyle combatStyle; // specific style of combat,  can also be used
  uint40 startTime; // Filled in by the function
  bool isValid; // If we still have the item, TODO: Not used yet
  //  bool reusePrev; // If true, then the previous queued action attire is reused?
  // 9 bytes left
}

struct ActionInfo {
  Skill skill;
  bool isAvailable;
  bool isDynamic;
  bool isCombat;
  uint16 xpPerHour;
  uint16 numSpawn; // Mostly for combat, capped respawn rate for xp/drops
  uint32 minSkillPoints;
  uint16 itemTokenIdRangeMin; // Inclusive
  uint16 itemTokenIdRangeMax; // Inclusive
}

// Equipment (leave at the bottom to allow for further ones)
struct Attire {
  uint16 helmet; // tokenId for the head (1 - 255)
  uint16 amulet; // tokenId for the neck (256 - 511) (256 * i -> 256 * (i + 1))
  uint16 armor;
  uint16 gauntlets;
  uint16 tassets;
  uint16 boots;
  uint16 ring;
  uint16 reserved1;
  uint128 queueId; // Just here for packing purposes
}

struct CombatStats {
  // From skill points
  int16 attack;
  int16 magic;
  int16 range;
  int16 defence;
  int16 health;
  // These include equipment
  int16 meleeDefence;
  int16 magicDefence;
  int16 rangeDefence;
}

// TODO: Can pack this better, remove the structs
struct Player {
  CombatStats combatStats; // Cached so this doesn't need to be calculated every combat
  // TODO: Can be up to 7
  QueuedAction[] actionQueue;
  uint240 totalSkillPoints;
  uint8 version; // This is used in case we want to do some migration of old characters, like halt them at level 30 from gaining XP
}

// This is only for viewing so doesn't need to be optimized
struct PendingOutput {
  Equipment[] consumed;
  ActionReward[] produced;
  bool died;
}

struct PlayerBoostInfo {
  uint40 startTime;
  uint24 duration;
  uint16 val;
  uint16 itemTokenId; // Get the effect of it
  BoostType boostType;
}

enum ActionQueueStatus {
  NONE,
  APPEND,
  KEEP_LAST_IN_PROGRESS
}

uint constant MAX_GUARANTEED_REWARDS_PER_ACTION = 3;
uint constant MAX_RANDOM_REWARDS_PER_ACTION = 4;
uint constant MAX_REWARDS_PER_ACTION = MAX_GUARANTEED_REWARDS_PER_ACTION + MAX_RANDOM_REWARDS_PER_ACTION;
uint constant MAX_CONSUMED_PER_ACTION = 3;

bytes constant xpBytes = hex"0000000000540000AE00010E0001760001E600025E0002DE0003680003FD00049B0005460005FC0006C0000792000873000964000A66000B7B000CA4000DE1000F360010A20012290013CB00158B00176B00196E001B94001DE200205A0022FF0025D50028DD002C1E002F99003354003752003B9A004030004519004A5C004FFF005609005C81006370006ADD0072D1007B57008479008E420098BE00A3F900B00200BCE700CAB800D98600E96300FA62010C9901201D013506014B6F016373017D2E0198C101B64E01D5F801F7E6021C4302433B026CFD0299BE02C9B302FD1803342B036F3203AE7303F23D043AE30488BE04DC2F05359B05957005FC24066A3606E02D075E9907E61608774C0912EB09B9B40A6C740B2C060BF9560CD5610DC1340EBDF30FCCD410EF24";
