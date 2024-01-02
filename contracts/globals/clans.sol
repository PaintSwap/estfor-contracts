// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

enum ClanRank {
  NONE, // Not in a clan
  COMMONER, // Member of the clan
  SCOUT, // Invite and kick commoners
  TREASURER, // Can withdraw from bank
  LEADER, // Can edit clan details
  OWNER // Can do everything and transfer ownership
}

enum BattleResultEnum {
  DRAW,
  WIN,
  LOSE
}

uint constant MAX_CLAN_COMBATANTS = 20;
uint constant CLAN_WARS_GAS_PRICE_WINDOW_SIZE = 4;
