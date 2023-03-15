// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {QueuedAction} from "./actions.sol";

// 3 bytes for each level. 0x000000 is the first level, 0x000054 is the second, etc.
bytes constant XP_BYTES = hex"0000000000540000AE00010E0001760001E600025E0002DE0003680003FD00049B0005460005FC0006C0000792000873000964000A66000B7B000CA4000DE1000F360010A20012290013CB00158B00176B00196E001B94001DE200205A0022FF0025D50028DD002C1E002F99003354003752003B9A004030004519004A5C004FFF005609005C81006370006ADD0072D1007B57008479008E420098BE00A3F900B00200BCE700CAB800D98600E96300FA62010C9901201D013506014B6F016373017D2E0198C101B64E01D5F801F7E6021C4302433B026CFD0299BE02C9B302FD1803342B036F3203AE7303F23D043AE30488BE04DC2F05359B05957005FC24066A3606E02D075E9907E61608774C0912EB09B9B40A6C740B2C060BF9560CD5610DC1340EBDF30FCCD410EF24";

enum EquipPosition {
  NONE, // Used as a sentinel value
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
  NO_POSITION
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
  int16 melee;
  int16 magic;
  int16 range;
  int16 health;
  // These include equipment
  int16 meleeDefence;
  int16 magicDefence;
  int16 rangeDefence;
}

struct Player {
  // Combat levels, (Cached from skill points so this doesn't need to be calculated every combat)
  int16 melee;
  int16 magic;
  int16 range;
  int16 defence;
  int16 health;
  uint8 version; // This is used in case we want to do some migration of old characters, like halt them at level 30 from gaining XP
  uint160 totalXP;
  // TODO: Can be up to 7
  QueuedAction[] actionQueue;
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
  MELEE,
  RANGE,
  MAGIC,
  MELEE_DEFENCE,
  RANGE_DEFENCE,
  MAGIC_DEFENCE
}

struct Equipment {
  uint16 itemTokenId;
  uint24 amount;
}

// For optimization purposes this contains a few data items, and everything except combat stats (although it could fit?)
struct Item {
  EquipPosition equipPosition;
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
  int16 range;
  int16 meleeDefence;
  int16 magicDefence;
  int16 rangeDefence;
  int16 health;
  // Minimum requirements in this skill to use this item (can be NONE)
  Skill skill;
  uint32 minXP;
  // Noncombat skill
  Skill skill1;
  int16 skillDiff1;
}

struct PlayerBoostInfo {
  uint40 startTime;
  uint24 duration;
  uint16 val;
  uint16 itemTokenId; // Get the effect of it
  BoostType boostType;
}

enum Skill {
  NONE,
  COMBAT, // This is a helper which incorporates all combat skills, attack <-> magic, defence, health etc
  MELEE,
  RANGE,
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

struct AvatarInfo {
  bytes32 name;
  string description;
  string imageURI;
  Skill[2] startSkills; // Can be NONE
}
