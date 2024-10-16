// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

uint16 constant NONE = 0;

uint16 constant COMBAT_BASE = 2048;
// Melee
uint16 constant SWORD_BASE = COMBAT_BASE;
uint16 constant BRONZE_SWORD = SWORD_BASE;

// Woodcutting (2816 - 3071)
uint16 constant WOODCUTTING_BASE = 2816;
uint16 constant BRONZE_AXE = WOODCUTTING_BASE;

// Firemaking (3328 - 3583)
uint16 constant FIRE_BASE = 3328;
uint16 constant MAGIC_FIRE_STARTER = FIRE_BASE;
uint16 constant FIRE_MAX = FIRE_BASE + 255;

// Fishing (3072 - 3327)
uint16 constant FISHING_BASE = 3072;
uint16 constant NET_STICK = FISHING_BASE;

// Mining (2560 - 2815)
uint16 constant MINING_BASE = 2560;
uint16 constant BRONZE_PICKAXE = MINING_BASE;

// Magic
uint16 constant STAFF_BASE = COMBAT_BASE + 50;
uint16 constant TOTEM_STAFF = STAFF_BASE;

// Ranged
uint16 constant BOW_BASE = COMBAT_BASE + 100;
uint16 constant BASIC_BOW = BOW_BASE;

// Cooked fish
uint16 constant COOKED_FISH_BASE = 11008;
uint16 constant COOKED_FEOLA = COOKED_FISH_BASE + 3;

// Scrolls
uint16 constant SCROLL_BASE = 12032;
uint16 constant SHADOW_SCROLL = SCROLL_BASE;

// Boosts
uint16 constant BOOST_BASE = 12800;
uint16 constant COMBAT_BOOST = BOOST_BASE;
uint16 constant XP_BOOST = BOOST_BASE + 1;
uint16 constant GATHERING_BOOST = BOOST_BASE + 2;
uint16 constant SKILL_BOOST = BOOST_BASE + 3;
uint16 constant ABSENCE_BOOST = BOOST_BASE + 4;
uint16 constant LUCKY_POTION = BOOST_BASE + 5;
uint16 constant LUCK_OF_THE_DRAW = BOOST_BASE + 6;
uint16 constant PRAY_TO_THE_BEARDIE = BOOST_BASE + 7;
uint16 constant PRAY_TO_THE_BEARDIE_2 = BOOST_BASE + 8;
uint16 constant PRAY_TO_THE_BEARDIE_3 = BOOST_BASE + 9;
uint16 constant BOOST_RESERVED_1 = BOOST_BASE + 10;
uint16 constant BOOST_RESERVED_2 = BOOST_BASE + 11;
uint16 constant BOOST_RESERVED_3 = BOOST_BASE + 12;
uint16 constant GO_OUTSIDE = BOOST_BASE + 13;
uint16 constant RAINING_RARES = BOOST_BASE + 14;
uint16 constant CLAN_BOOSTER = BOOST_BASE + 15;
uint16 constant CLAN_BOOSTER_2 = BOOST_BASE + 16;
uint16 constant CLAN_BOOSTER_3 = BOOST_BASE + 17;
uint16 constant BOOST_RESERVED_4 = BOOST_BASE + 18;
uint16 constant BOOST_RESERVED_5 = BOOST_BASE + 19;
uint16 constant BOOST_RESERVED_6 = BOOST_BASE + 20;
uint16 constant BOOST_MAX = 13055;

// Eggs
uint16 constant EGG_BASE = 12544;
uint16 constant SECRET_EGG_1_TIER1 = EGG_BASE;
uint16 constant SECRET_EGG_2_TIER1 = EGG_BASE + 1;
uint16 constant EGG_MAX = 12799;

struct BulkTransferInfo {
  uint256[] tokenIds;
  uint256[] amounts;
  address to;
}
