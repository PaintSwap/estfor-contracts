// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IBank} from "../interfaces/IBank.sol";

enum ClanRank {
  NONE, // Not in a clan
  COMMONER, // Member of the clan
  SCOUT, // Invite and kick commoners
  COLONEL, // Can launch attacks and assign combatants
  TREASURER, // Can withdraw from bank
  LEADER, // Can edit clan details
  OWNER // Can do everything and transfer ownership
}

enum BattleResultEnum {
  DRAW,
  WIN,
  LOSE
}

struct ClanBattleInfo {
  uint40 lastClanIdAttackOtherClanIdCooldownTimestamp;
  uint8 numReattacks;
  uint40 lastOtherClanIdAttackClanIdCooldownTimestamp;
  uint8 numReattacksOtherClan;
}

// Packed for gas efficiency
struct Vault {
  bool claimed; // Only applies to the first one, if it's claimed without the second one being claimed
  uint40 timestamp;
  uint80 amount;
  uint40 timestamp1;
  uint80 amount1;
}

struct VaultClanInfo {
  IBank bank;
  uint96 totalBrushLocked;
  // New storage slot
  uint40 attackingCooldownTimestamp;
  uint40 assignCombatantsCooldownTimestamp;
  bool currentlyAttacking;
  uint24 defendingVaultsOffset;
  uint40 blockAttacksTimestamp;
  uint8 blockAttacksCooldownHours;
  bool isInMMRArray;
  uint40 superAttackCooldownTimestamp;
  uint64[] playerIds;
  Vault[] defendingVaults; // Append only, and use defendingVaultsOffset to decide where the real start is
}

uint256 constant MAX_CLAN_COMBATANTS = 20;
uint256 constant CLAN_WARS_GAS_PRICE_WINDOW_SIZE = 4;

bool constant XP_EMITTED_ELSEWHERE = true;
