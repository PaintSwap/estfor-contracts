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

enum Skill {
  NONE,
  COMBAT, // This is a helper which incorporates attack <-> magic
  ATTACK,
  RANGED,
  MAGIC,
  DEFENCE,
  //  MELEE_ATTACK_DEFENCE, // combo
  //  RANGED_ATTACK_DEFENCE, // combo
  //  MAGIC_ATTACK_DEFENCE, // combo
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
  AUX, // wood, seeds, food etc..
  BOOST_VIAL,
  NONE
}

// CombatStats
struct CombatStats {
  int8 attack;
  int8 magic;
  int8 range;
  int8 meleeDefence;
  int8 magicDefence;
  int8 rangeDefence;
  int8 health;
  // Spare
}

// Loot
struct ActionReward {
  uint16 itemTokenId;
  uint32 rate; // num per hour, base 100 (2 decimals) or percentage chance
}

struct PendingLoot {
  uint actionId;
  uint40 timestamp;
  uint16 elapsedTime;
}
struct Equipment {
  uint16 itemTokenId;
  uint16 numToEquip;
}

// This is effectively a ratio to produce 1 of outputTokenId.
// Fixed based available actions that can be undertaken for an action
struct ActionChoice {
  Skill skill;
  uint32 diff;
  uint32 rate; // rate of output produced per hour (base 100) 2 decimals
  uint16 baseXPPerHour;
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
  Attire attire; // Keep here for now
  uint16 actionId;
  uint16 regenerateId; // Food (combat), maybe something for non-combat later
  uint16 numRegenerate;
  uint16 choiceId; // Melee/Arrow/Magic (combat), logs, ore (non-combat)
  uint16 num;
  uint16 choiceId1; // Reserved (TBD)
  uint16 num1;
  uint16 choiceId2; // Reserved (TBD)
  uint16 num2;
  uint16 rightArmEquipmentTokenId; // Axe/Sword/bow, can be empty
  uint16 leftArmEquipmentTokenId; // Shield, can be empty
  uint24 timespan; // How long to queue the action for
  Skill skill; // attack, defence, strength, magic, ranged, woodcutting, needs to match actionId skill. Attack/defence can also be used
  uint40 startTime; // Filled in by the function
  //  bool reusePrev; // If true, then the previous queued action attire is reused?
  // 1 byte left
}

struct ActionInfo {
  Skill skill;
  bool isAvailable;
  bool isDynamic;
  bool isCombat;
  uint16 baseXPPerHour;
  uint32 minSkillPoints;
  // These are put here for efficiency even if not needed
  uint16 itemTokenIdRangeMin; // Inclusive
  uint16 itemTokenIdRangeMax; // Inclusive
}

// Equipment (leave at the bottom to allow for further ones)
struct Attire {
  uint16 helmet; // tokenId for the head (1 - 255)
  uint16 amulet; // tokenId for the neck (256 - 511) (256 * i -> 256 * (i + 1))
  uint16 chestplate;
  uint16 gauntlets;
  uint16 tassets;
  uint16 boots;
  uint16 ring;
  uint16 reserved1;
  uint64 queuedActionId; // Just here for packing purposes
}

// TODO: Can pack this better, remove the structs
struct Player {
  // These are stored in case individual items are changed later, but also prevents having to read them loads
  // Base attributes
  CombatStats totalStats;
  // TODO: Can be up to 7
  QueuedAction[] actionQueue;
  uint240 totalSkillPoints;
  uint8 version; // This is used in case we want to do some migration of old characters, like halt them at level 30 from gaining XP
}
