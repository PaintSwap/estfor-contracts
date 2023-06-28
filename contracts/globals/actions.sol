// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Skill, Attire, CombatStyle, CombatStats} from "./misc.sol";
import {GuaranteedReward, RandomReward} from "./rewards.sol";

enum ActionQueueStatus {
  NONE,
  APPEND,
  KEEP_LAST_IN_PROGRESS
}

struct QueuedActionInput {
  Attire attire;
  uint16 actionId;
  uint16 regenerateId; // Food (combat), maybe something for non-combat later
  uint16 choiceId; // Melee/Arrow/Magic (combat), logs, ore (non-combat)
  uint16 rightHandEquipmentTokenId; // Axe/Sword/bow, can be empty
  uint16 leftHandEquipmentTokenId; // Shield, can be empty
  uint24 timespan; // How long to queue the action for
  CombatStyle combatStyle; // specific style of combat,  can also be used
}

struct QueuedAction {
  uint16 actionId;
  uint16 regenerateId; // Food (combat), maybe something for non-combat later
  uint16 choiceId; // Melee/Arrow/Magic (combat), logs, ore (non-combat)
  uint16 rightHandEquipmentTokenId; // Axe/Sword/bow, can be empty
  uint16 leftHandEquipmentTokenId; // Shield, can be empty
  uint24 timespan; // How long to queue the action for
  CombatStyle combatStyle; // specific style of combat,  can also be used
  uint24 prevProcessedTime; // How long the action has been processed for previously
  uint24 prevProcessedXPTime; // How much XP has been gained for this action so far
  uint64 queueId; // id of this queued action
  bool isValid; // If we still have the item, TODO: Not used yet
}

// This is only used as an input arg (and events)
struct Action {
  uint16 actionId;
  ActionInfo info;
  GuaranteedReward[] guaranteedRewards;
  RandomReward[] randomRewards;
  CombatStats combatStats;
}

struct ActionInfo {
  Skill skill;
  bool isAvailable;
  uint8 worldLocation; // 0 is the main starting world
  bool actionChoiceRequired; // If true, then the user must choose an action choice
  uint24 xpPerHour;
  uint32 minXP;
  uint24 numSpawned; // Mostly for combat, capped respawn rate for xp/drops. Per hour, base 10000
  uint16 handItemTokenIdRangeMin; // Inclusive
  uint16 handItemTokenIdRangeMax; // Inclusive
  uint8 successPercent; // 0-100
}

// Allows for 2, 4 or 8 hour respawn time
uint constant SPAWN_MUL = 1000;
uint constant RATE_MUL = 1000;
uint constant GUAR_MUL = 10; // Guaranteeded reward multiplier (1 decimal, allows for 2 hour respawn time)
