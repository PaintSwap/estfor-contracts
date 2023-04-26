// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Skill, Attire, CombatStyle, CombatStats} from "./players.sol";
import {GuaranteedReward, RandomReward} from "./rewards.sol";

enum ActionQueueStatus {
  NONE,
  APPEND,
  KEEP_LAST_IN_PROGRESS
}

// The user chooses these
struct QueuedActionInput {
  // Keep this first
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
  uint24 processedTime; // How long the action has been processed for previously. TODO: Can be moved to Player, only need 1
  CombatStyle combatStyle; // specific style of combat,  can also be used
  bool isValid; // If we still have the item, TODO: Not used yet
  // How much of the queued action was already processed beforehand. Useful for working out how many more consumables/food should be used due to previous rounding.
  // uint16 startLevel; // This is the level that should be used (if set) instead of xp->level
  // uint16 healthStartLevel; // Health is handled specially so also need to store it
  uint64 queueId; // id of this queued action
}

// This is only used as an input arg
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
  bool isDynamic;
  bool actionChoiceRequired; // If true, then the user must choose an action choice
  uint24 xpPerHour;
  uint32 minXP;
  uint16 numSpawned; // Mostly for combat, capped respawn rate for xp/drops
  uint16 handItemTokenIdRangeMin; // Inclusive
  uint16 handItemTokenIdRangeMax; // Inclusive
  uint8 successPercent; // 0-100
}
