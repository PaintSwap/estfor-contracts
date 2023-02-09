// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

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
  LEFT_ARM,
  RIGHT_ARM,
  ARROW_SATCHEL,
  MAGIC_BAG,
  AUX, // wood, seeds, food etc..
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

struct ItemStat {
  CombatStats stats;
  EquipPosition equipPosition; // If for main equipment
  bool exists;
}

// Loot
struct ActionReward {
  uint16 itemTokenId;
  uint32 rate; // num per hour, base 100 (2 decimals)
}
struct ActionLoot {
  uint16 itemTokenId;
  uint8 chance; // change to get an item (out of 256)
}
struct PendingLoot {
  uint actionId;
  uint40 timestamp;
  uint16 elapsedTime;
}
struct Equipment {
  uint16 itemTokenId;
  uint8 numToEquip;
}

// This is effectively a ratio to produce 1 of outputTokenId.
// Fixed based available actions that can be undertaken for an action
struct ActionChoice {
  Skill skill;
  uint32 diff;
  uint32 rate; // rate of output produced per hour
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
  uint16 actionId;
  uint16 potionId; // Potion (combat, non-combat, can only equip 1)
  uint16 regenerateId; // Food (combat), maybe something for non-combat later
  uint16 choiceId; // Melee/Arrow/Magic (combat), logs, ore (non-combat)
  uint16 num;
  uint16 choiceId1; // Reserved (TBD)
  uint16 num1;
  uint16 choiceId2; // Reserved (TBD)
  uint16 num2;
  uint16 rightArmEquipmentTokenId; // Axe/Sword/bow, can be empty
  uint16 leftArmEquipmentTokenId; // Shield, can be empty
  uint24 timespan; // How long to queue the action for
  uint8 numRegenerate;
  Skill skill; // attack, defence, strength, magic, ranged, woodcutting, needs to match actionId skill. Attack/defence can also be used
  uint40 startTime; // Filled in by the function
  // No bytes left, uhhh could re-duce potionId?
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
  uint16 auxItemTokenIdRangeMin; // Logs etc.. TODO Needed?
  uint16 auxItemTokenIdRangeMax;
}

// Equipment (leave at the bottom to allow for further ones)
struct Armour {
  uint8 helmet; // tokenId for the head (1 - 255)
  uint8 amulet; // tokenId for the neck (256 - 511) (256 * i -> 256 * (i + 1))
  uint8 chestplate;
  uint8 gauntlets;
  uint8 tassets;
  uint8 boots;
  uint8 reserved1;
  uint8 reserved2;
}

struct Player {
  Armour equipment; // Keep this first
  // These are stored in case individual items are changed later, but also prevents having to read them loads
  // Base attributes
  CombatStats totalStats;
  QueuedAction[] actionQueue;
  uint240 totalSkillPoints;
  uint8 version; // This is used in case we want to do some migration of old characters, like halt them at level 30 from gaining XP
}
