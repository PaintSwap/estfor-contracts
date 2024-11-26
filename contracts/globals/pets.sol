// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Skill} from "./misc.sol";

enum PetSkin {
  NONE,
  DEFAULT,
  OG,
  ONEKIN,
  FROST,
  CRYSTAL,
  ANNIV1,
  KRAGSTYR
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

// NOTE: This struct is bridged from Fantom -> Sonic
struct Pet {
  Skill skillEnhancement1;
  uint8 skillFixedEnhancement1;
  uint8 skillPercentageEnhancement1;
  Skill skillEnhancement2;
  uint8 skillFixedEnhancement2;
  uint8 skillPercentageEnhancement2;
  uint40 lastAssignmentTimestamp;
  address owner; // Will be used as an optimization to avoid having to look up the owner of the pet in another storage slot
  bool isTransferable;
  uint24 baseId;
  // New storage slot. These are used when training a pet
  uint40 lastTrainedTimestamp;
  uint8 skillFixedEnhancementMax1; // The maximum possible value for skillFixedEnhancement1 when training
  uint8 skillFixedEnhancementMax2;
  uint8 skillPercentageEnhancementMax1;
  uint8 skillPercentageEnhancementMax2;
  uint64 xp;
}

struct BasePetMetadata {
  string description;
  uint8 tier;
  PetSkin skin;
  PetEnhancementType enhancementType;
  Skill skillEnhancement1;
  uint8 skillFixedMin1;
  uint8 skillFixedMax1;
  uint8 skillFixedIncrement1;
  uint8 skillPercentageMin1;
  uint8 skillPercentageMax1;
  uint8 skillPercentageIncrement1;
  uint8 skillMinLevel1;
  Skill skillEnhancement2;
  uint8 skillFixedMin2;
  uint8 skillFixedMax2;
  uint8 skillFixedIncrement2;
  uint8 skillPercentageMin2;
  uint8 skillPercentageMax2;
  uint8 skillPercentageIncrement2;
  uint8 skillMinLevel2;
  uint16 fixedStarThreshold;
  uint16 percentageStarThreshold;
  bool isTransferable;
}
