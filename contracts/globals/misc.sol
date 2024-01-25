// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

enum BoostType {
  NONE,
  ANY_XP,
  COMBAT_XP,
  NON_COMBAT_XP,
  GATHERING,
  ABSENCE,
  PASSIVE_SKIP_CHANCE,
  // Clan wars
  PVP_BLOCK,
  PVP_REATTACK
}

struct Equipment {
  uint16 itemTokenId;
  uint24 amount;
}

enum Skill {
  NONE,
  COMBAT, // This is a helper which incorporates all combat skills, attack <-> magic, defence, health etc
  MELEE,
  RANGED,
  MAGIC,
  DEFENCE,
  HEALTH,
  RESERVED_COMBAT,
  MINING,
  WOODCUTTING,
  FISHING,
  SMITHING,
  THIEVING,
  CRAFTING,
  COOKING,
  FIREMAKING,
  AGILITY,
  ALCHEMY,
  FLETCHING,
  FORGING,
  RESERVED2,
  RESERVED3,
  RESERVED4,
  RESERVED5,
  RESERVED6,
  RESERVED7,
  RESERVED8,
  RESERVED9,
  RESERVED10,
  RESERVED11,
  RESERVED12,
  RESERVED13,
  RESERVED14,
  RESERVED15,
  RESERVED16,
  RESERVED17,
  RESERVED18,
  RESERVED19,
  RESERVED20,
  TRAVELING // Helper Skill for travelling
}

struct Attire {
  uint16 head;
  uint16 neck;
  uint16 body;
  uint16 arms;
  uint16 legs;
  uint16 feet;
  uint16 ring;
  uint16 reserved1;
}

struct CombatStats {
  // From skill points
  int16 melee;
  int16 magic;
  int16 ranged;
  int16 health;
  // These include equipment
  int16 meleeDefence;
  int16 magicDefence;
  int16 rangedDefence;
}

enum CombatStyle {
  NONE,
  ATTACK,
  DEFENCE
}
