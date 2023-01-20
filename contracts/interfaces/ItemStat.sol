// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

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
struct Stats {
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
  Stats stats;
  EquipPosition equipPosition; // If for main equipment
  bool exists;
}
