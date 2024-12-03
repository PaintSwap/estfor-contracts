// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Skill, Attire, CombatStyle, CombatStats} from "./misc.sol";
import {GuaranteedReward, RandomReward} from "./rewards.sol";

enum ActionQueueStrategy {
  OVERWRITE,
  APPEND,
  KEEP_LAST_IN_PROGRESS
}

struct QueuedActionInput {
  Attire attire;
  uint16 actionId;
  uint16 regenerateId; // Food (combat), maybe something for non-combat later
  uint16 choiceId; // Melee/Ranged/Magic (combat), logs, ore (non-combat)
  uint16 rightHandEquipmentTokenId; // Axe/Sword/bow, can be empty
  uint16 leftHandEquipmentTokenId; // Shield, can be empty
  uint24 timespan; // How long to queue the action for
  uint8 combatStyle; // CombatStyle specific style of combat
  uint40 petId; // id of the pet (can be empty)
}

struct QueuedAction {
  uint16 actionId;
  uint16 regenerateId; // Food (combat), maybe something for non-combat later
  uint16 choiceId; // Melee/Ranged/Magic (combat), logs, ore (non-combat)
  uint16 rightHandEquipmentTokenId; // Axe/Sword/bow, can be empty
  uint16 leftHandEquipmentTokenId; // Shield, can be empty
  uint24 timespan; // How long to queue the action for
  uint24 prevProcessedTime; // How long the action has been processed for previously
  uint24 prevProcessedXPTime; // How much XP has been gained for this action so far
  uint64 queueId; // id of this queued action
  bytes1 packed; // 1st bit is isValid (not used yet), 2nd bit is for hasPet (decides if the 2nd storage slot is read)
  uint8 combatStyle;
  uint24 reserved;
  // Next storage slot
  uint40 petId; // id of the pet (can be empty)
}

// This is only used as an input arg (and events)
struct ActionInput {
  uint16 actionId;
  ActionInfo info;
  GuaranteedReward[] guaranteedRewards;
  RandomReward[] randomRewards;
  CombatStats combatStats;
}

struct ActionInfo {
  uint8 skill;
  bool actionChoiceRequired; // If true, then the user must choose an action choice
  uint24 xpPerHour;
  uint32 minXP;
  uint24 numSpawned; // Mostly for combat, capped respawn rate for xp/drops. Per hour, base 10000
  uint16 handItemTokenIdRangeMin; // Inclusive
  uint16 handItemTokenIdRangeMax; // Inclusive
  uint8 successPercent; // 0-100
  uint8 worldLocation; // 0 is the main starting world
  bool isFullModeOnly;
  bool isAvailable;
  uint16 questPrerequisiteId;
}

uint16 constant ACTIONCHOICE_MELEE_BASIC_SWORD = 1500;
uint16 constant ACTIONCHOICE_MAGIC_SHADOW_BLAST = 2000;
uint16 constant ACTIONCHOICE_RANGED_BASIC_BOW = 3000;

// Allows for 2, 4 or 8 hour respawn time
uint256 constant SPAWN_MUL = 1000;
uint256 constant RATE_MUL = 1000;
uint256 constant GUAR_MUL = 10; // Guaranteeded reward multiplier (1 decimal, allows for 2 hour action times)

uint256 constant MAX_QUEUEABLE_ACTIONS = 3; // Available slots to queue actions
