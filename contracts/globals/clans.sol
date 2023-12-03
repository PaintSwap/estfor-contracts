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

uint constant MAX_CLAN_ATTACKERS = 20;
