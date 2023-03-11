// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Equipment} from "./players.sol";

// Loot
struct ActionReward {
  uint16 itemTokenId;
  uint24 rate; // num per hour, base 100 (2 decimals) or percentage chance
}

struct PendingRandomReward {
  uint16 actionId;
  uint128 queueId;
  uint40 timestamp;
  uint24 elapsedTime;
}

struct ActionRewards {
  uint16 guaranteedRewardTokenId1;
  uint24 guaranteedRewardRate1; // num per hour, base 100 (2 decimals)
  uint16 guaranteedRewardTokenId2;
  uint24 guaranteedRewardRate2;
  uint16 guaranteedRewardTokenId3;
  uint24 guaranteedRewardRate3;
  // Random chance rewards
  uint16 randomRewardTokenId1;
  uint16 randomRewardChance1; // percentage, base 100 (2 decimals)
  uint16 randomRewardTokenId2;
  uint16 randomRewardChance2;
  uint16 randomRewardTokenId3;
  uint16 randomRewardChance3;
  uint16 randomRewardTokenId4;
  uint16 randomRewardChance4;
}

// This is only for viewing so doesn't need to be optimized
struct PendingOutput {
  Equipment[] consumed;
  Equipment[] produced;
  Equipment[] producedPastRandomRewards;
  Equipment[] producedXPRewards;
  bool died;
}

struct PendingFlags {
  bool includeLoot; // Guaranteed loot from actions, and random loot if claiming quite late
  bool includePastRandomRewards; // This is random loot from previous actions
  bool includeXPRewards; // Passing any xp thresholds gives you extra rewards
}

struct XPThresholdReward {
  uint32 xpThreshold;
  Equipment[] equipments;
}

uint constant MAX_GUARANTEED_REWARDS_PER_ACTION = 3;
uint constant MAX_RANDOM_REWARDS_PER_ACTION = 4;
uint constant MAX_REWARDS_PER_ACTION = MAX_GUARANTEED_REWARDS_PER_ACTION + MAX_RANDOM_REWARDS_PER_ACTION;
uint constant MAX_CONSUMED_PER_ACTION = 3;