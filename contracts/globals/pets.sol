// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Skill} from "./misc.sol";

enum PetSkin {
  NONE,
  DEFAULT,
  TESTER,
  ONEKIN,
  FROST1,
  FROST2
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
  uint8 skillEnhancementPercent1;
  Skill skillEnhancement2;
  uint8 skillEnhancementPercent2;
  uint24 baseId;
  address owner; // Optimization to avoid having to look up the owner of the pet in another storage slot
  uint40 lastAssignmentTimestamp;
  // No space left in this storage slot
}
