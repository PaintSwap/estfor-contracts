// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Skill} from "./misc.sol";

enum PetSkin {
  NONE,
  DEFAULT,
  OG,
  ONEKIN,
  FROST,
  CRYSTAL
}

enum PetEnhancementType {
  NONE,
  MELEE,
  MAGIC,
  RANGED,
  DEFENCE,
  HEALTH,
  MELEE_AND_DEFENCE,
  MAGIC_AND_DEFENCE,
  RANGED_AND_DEFENCE
}

struct Pet {
  Skill skillEnhancement1;
  uint8 skillFixedEnhancement1;
  uint8 skillPercentageEnhancement1;
  Skill skillEnhancement2;
  uint8 skillFixedEnhancement2;
  uint8 skillPercentageEnhancement2;
  uint40 lastAssignmentTimestamp;
  address owner; // Will be used as an optimzation to avoid having to look up the owner of the pet in another storage slot
  // 1 byte left in this storage slot
  uint24 baseId;
}
