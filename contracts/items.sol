// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

uint16 constant NONE = 0;
// 1 - 255 (head)
uint16 constant HEAD_BASE = 1;
uint16 constant BRONZE_HELMET = HEAD_BASE;
uint16 constant IRON_HELMET = HEAD_BASE + 1;
uint16 constant MITHRIL_HELMET = HEAD_BASE + 2;
uint16 constant ADAMANTINE_HELMET = HEAD_BASE + 3;
uint16 constant RUNITE_HELMET = HEAD_BASE + 4;
uint16 constant TITANIUM_HELMET = HEAD_BASE + 5;
uint16 constant ORCHALCUM_HELMET = HEAD_BASE + 6;

uint16 constant HEAD_MAX = HEAD_BASE + 254; // Inclusive
// 257 - 511 (neck)
uint16 constant NECK_BASE = 257;
uint16 constant SAPPHIRE_AMULET = NECK_BASE;
uint16 constant EMERALD_AMULET = NECK_BASE + 1;
uint16 constant RUBT_AMULET = NECK_BASE + 2;
uint16 constant AMETHYST_AMULET = NECK_BASE + 3;
uint16 constant DIAMOND_AMULET = NECK_BASE + 4;
uint16 constant DRAGONSTONE_AMULET = NECK_BASE + 5;
uint16 constant NECK_MAX = NECK_BASE + 254;

// 513 - 767 (body)
uint16 constant BODY_BASE = 513;
uint16 constant BRONZE_ARMOR = BODY_BASE;
uint16 constant IRON_ARMOR = BODY_BASE + 1;
uint16 constant MITHRIL_ARMOR = BODY_BASE + 2;
uint16 constant ADAMANTINE_ARMOR = BODY_BASE + 3;
uint16 constant RUNITE_ARMOR = BODY_BASE + 4;
uint16 constant TITANIUM_ARMOR = BODY_BASE + 5;
uint16 constant ORCHALCUM_ARMOR = BODY_BASE + 6;
uint16 constant BODY_MAX = BODY_BASE + 254;
// 769 - 1023 (arms)
uint16 constant ARMS_BASE = 769;
uint16 constant BRONZE_GAUNTLETS = ARMS_BASE;
uint16 constant IRON_GAUNTLETS = ARMS_BASE + 1;
uint16 constant MITHRIL_GAUNTLETS = ARMS_BASE + 2;
uint16 constant ADAMANTINE_GAUNTLETS = ARMS_BASE + 3;
uint16 constant RUNITE_GAUNTLETS = ARMS_BASE + 4;
uint16 constant TITANIUM_GAUNTLETS = ARMS_BASE + 5;
uint16 constant ORCHALCUM_GAUNTLETS = ARMS_BASE + 6;
uint16 constant ARMS_MAX = ARMS_BASE + 254;
// 1025 - 1279 (legs)
uint16 constant LEGS_BASE = 1025;
uint16 constant BRONZE_TASSETS = LEGS_BASE;
uint16 constant IRON_TASSETS = LEGS_BASE + 1;
uint16 constant MITHRIL_TASSETS = LEGS_BASE + 2;
uint16 constant ADAMANTINE_TASSETS = LEGS_BASE + 3;
uint16 constant RUNITE_TASSETS = LEGS_BASE + 4;
uint16 constant TITANIUM_TASSETS = LEGS_BASE + 5;
uint16 constant ORCHALCUM_TASSETS = LEGS_BASE + 6;
uint16 constant LEGS_MAX = LEGS_BASE + 254;

// 1281 - 1535 (boots)
uint16 constant BOOTS_BASE = 1281;
uint16 constant BRONZE_BOOTS = BOOTS_BASE;
uint16 constant IRON_BOOTS = BOOTS_BASE + 1;
uint16 constant MITHRIL_BOOTS = BOOTS_BASE + 2;
uint16 constant ADAMANTINE_BOOTS = BOOTS_BASE + 3;
uint16 constant RUNITE_BOOTS = BOOTS_BASE + 4;
uint16 constant TITANIUM_BOOTS = BOOTS_BASE + 5;
uint16 constant ORCHALCUM_BOOTS = BOOTS_BASE + 6;
uint16 constant BOOTS_MAX = BOOTS_BASE + 254;

// 1537 - 1791 spare(1)
// 1793 - 2047 spare(2)

// All other ones for the first arm

// Combat (right arm) (2048 - 2303)
uint16 constant COMBAT_BASE = 2048;
// Melee
uint16 constant BRONZE_SWORD = COMBAT_BASE;
uint16 constant IRON_SWORD = COMBAT_BASE + 1;
uint16 constant MITHRIL_SWORD = COMBAT_BASE + 2;
uint16 constant ADAMANTINE_SWORD = COMBAT_BASE + 3;
uint16 constant RUNITE_SWORD = COMBAT_BASE + 4;
uint16 constant TITANIUM_SWORD = COMBAT_BASE + 5;
uint16 constant ORCHALCUM_SWORD = COMBAT_BASE + 6;
// Magic
uint16 constant STAFF = COMBAT_BASE + 50;
// Ranged
uint16 constant BOW = COMBAT_BASE + 100;
// Combat (left arm)
uint16 constant SHIELD_BASE = COMBAT_BASE + 150;
uint16 constant BRONZE_SHIELD = SHIELD_BASE;
uint16 constant IRON_SHIELD = SHIELD_BASE + 1;
uint16 constant MITHRIL_SHIELD = SHIELD_BASE + 2;
uint16 constant ADAMANTINE_SHIELD = SHIELD_BASE + 3;
uint16 constant RUNITE_SHIELD = SHIELD_BASE + 4;
uint16 constant TITANIUM_SHIELD = SHIELD_BASE + 5;
uint16 constant ORCHALCUM_SHIELD = SHIELD_BASE + 6;

uint16 constant COMBAT_MAX = COMBAT_BASE + 255;

// Mining (2560 - 2815)
uint16 constant MINING_BASE = 2560;
uint16 constant BRONZE_PICKAXE = MINING_BASE;
uint16 constant IRON_PICKAXE = MINING_BASE + 1;
uint16 constant MITHRIL_PICKAXE = MINING_BASE + 2;
uint16 constant ADAMANTINE_PICKAXE = MINING_BASE + 3;
uint16 constant RUNITE_PICKAXE = MINING_BASE + 4;
uint16 constant TITANIUM_PICKAXE = MINING_BASE + 5;
uint16 constant ORCHALCUM_PICKAXE = MINING_BASE + 6;
uint16 constant MINING_MAX = MINING_BASE + 255;

// Woodcutting (2816 - 3071)
uint16 constant WOODCUTTING_BASE = 2816;
uint16 constant BRONZE_AXE = WOODCUTTING_BASE;
uint16 constant IRON_AXE = WOODCUTTING_BASE + 1;
uint16 constant MITHRIL_AXE = WOODCUTTING_BASE + 2;
uint16 constant ADAMANTINE_AXE = WOODCUTTING_BASE + 3;
uint16 constant RUNITE_AXE = WOODCUTTING_BASE + 4;
uint16 constant TITANIUM_AXE = WOODCUTTING_BASE + 5;
uint16 constant ORCHALCUM_AXE = WOODCUTTING_BASE + 6;
uint16 constant WOODCUTTING_MAX = WOODCUTTING_BASE + 255;

// Fishing (3072)
uint16 constant FISHING_BASE = 3072;
uint16 constant SMALL_NET = FISHING_BASE;
uint16 constant MEDIUM_NET = FISHING_BASE + 1;
uint16 constant FISHING_ROD = FISHING_BASE + 2;
uint16 constant HARPOON = FISHING_BASE + 3;
uint16 constant LARGE_NET = FISHING_BASE + 4;
uint16 constant MAGIC_NET = FISHING_BASE + 5;
uint16 constant FISHING_MAX = FISHING_BASE + 255;

// Firemaking (3328)
uint16 constant FIRE_BASE = 3328;
uint16 constant FIRE_LIGHTER = FIRE_BASE;
uint16 constant FIRE_MAX = FIRE_BASE + 255;

// Smithing (none needed)
// Thieiving (none needed)
// Crafting (none needed)
// Cooking (none needed)

// 10000+ it'a all other items

// Bars
uint16 constant BAR_BASE = 10240; // (256 * 40)
uint16 constant BRONZE_BAR = BAR_BASE;
uint16 constant IRON_BAR = BAR_BASE + 1;
uint16 constant MITHRIL_BAR = BAR_BASE + 2;
uint16 constant ADAMANTINE_BAR = BAR_BASE + 3;
uint16 constant RUNITE_BAR = BAR_BASE + 4;
uint16 constant TITANIUM_BAR = BAR_BASE + 5;
uint16 constant ORCHALCUM_BAR = BAR_BASE + 6;
uint16 constant BAR_MAX = BAR_BASE + 255;

// Logs
uint16 constant LOG_BASE = 10496;
uint16 constant LOG = LOG_BASE;
uint16 constant OAK_LOG = LOG_BASE + 1;
uint16 constant WILLOW_LOG = LOG_BASE + 2;
uint16 constant MAPLE_LOG = LOG_BASE + 3;
uint16 constant REDWOOD_LOG = LOG_BASE + 4;
uint16 constant MAGICAL_LOG = LOG_BASE + 5;
uint16 constant ASH_LOG = LOG_BASE + 6;
uint16 constant LOG_MAX = LOG_BASE + 255;

// Fish
uint16 constant RAW_FISH_BASE = 10752;
uint16 constant RAW_HUPPY = RAW_FISH_BASE;
uint16 constant RAW_MINNOW = RAW_FISH_BASE + 1;
uint16 constant RAW_SUNFISH = RAW_FISH_BASE + 2;
uint16 constant RAW_PERCH = RAW_FISH_BASE + 3;
uint16 constant RAW_CRAYFISH = RAW_FISH_BASE + 4;
uint16 constant RAW_BLUEGILL = RAW_FISH_BASE + 5;
uint16 constant RAW_CATFISH = RAW_FISH_BASE + 6;
uint16 constant RAW_CARP = RAW_FISH_BASE + 7;
uint16 constant RAW_TILAPIA = RAW_FISH_BASE + 8;
uint16 constant RAW_MUSKELLUNGE = RAW_FISH_BASE + 9;
uint16 constant RAW_SWORDFISH = RAW_FISH_BASE + 10;
uint16 constant RAW_SHARK = RAW_FISH_BASE + 11;
uint16 constant RAW_BARRIMUNDI = RAW_FISH_BASE + 12;
uint16 constant RAW_KINGFISH = RAW_FISH_BASE + 13;
uint16 constant RAW_MARLIN = RAW_FISH_BASE + 14;
uint16 constant RAW_GIANT_CATFISH = RAW_FISH_BASE + 15;
uint16 constant RAW_ELECTRIC_EEL = RAW_FISH_BASE + 16;
uint16 constant RAW_MANTA_RAY = RAW_FISH_BASE + 17;
uint16 constant RAW_LEVIATHAN = RAW_FISH_BASE + 18;
uint16 constant RAW_DRAGONFISH = RAW_FISH_BASE + 19;
uint16 constant RAW_FIRE_MAX = RAW_FISH_BASE + 255;

// Cooked fish
uint16 constant COOKED_FISH_BASE = 11008;
uint16 constant COOKED_HUPPY = COOKED_FISH_BASE;
uint16 constant COOKED_MINNOW = COOKED_FISH_BASE + 1;
uint16 constant COOKED_SUNFISH = COOKED_FISH_BASE + 2;
uint16 constant COOKED_PERCH = COOKED_FISH_BASE + 3;
uint16 constant COOKED_CRAYFISH = COOKED_FISH_BASE + 4;
uint16 constant COOKED_BLUEGILL = COOKED_FISH_BASE + 5;
uint16 constant COOKED_CATFISH = COOKED_FISH_BASE + 6;
uint16 constant COOKED_CARP = COOKED_FISH_BASE + 7;
uint16 constant COOKED_TILAPIA = COOKED_FISH_BASE + 8;
uint16 constant COOKED_MUSKELLUNGE = COOKED_FISH_BASE + 9;
uint16 constant COOKED_SWORDFISH = COOKED_FISH_BASE + 10;
uint16 constant COOKED_SHARK = COOKED_FISH_BASE + 11;
uint16 constant COOKED_BARRIMUNDI = COOKED_FISH_BASE + 12;
uint16 constant COOKED_KINGFISH = COOKED_FISH_BASE + 13;
uint16 constant COOKED_MARLIN = COOKED_FISH_BASE + 14;
uint16 constant COOKED_GIANT_CATFISH = COOKED_FISH_BASE + 15;
uint16 constant COOKED_ELECTRIC_EEL = COOKED_FISH_BASE + 16;
uint16 constant COOKED_MANTA_RAY = COOKED_FISH_BASE + 17;
uint16 constant COOKED_LEVIATHAN = COOKED_FISH_BASE + 18;
uint16 constant COOKED_DRAGONFISH = COOKED_FISH_BASE + 19;
uint16 constant COOKED_FISH_MAX = COOKED_FISH_BASE + 255;

// Farming
uint16 constant BONEMEAL = 11264;

// Mining
uint16 constant ORE_BASE = 11520;
uint16 constant COPPER_ORE = ORE_BASE;
uint16 constant TIN_ORE = ORE_BASE + 1;
uint16 constant IRON_ORE = ORE_BASE + 2;
uint16 constant SAPPHIRE_ORE = ORE_BASE + 3;
uint16 constant COAL_ORE = ORE_BASE + 4;
uint16 constant EMERALD_ORE = ORE_BASE + 5;
uint16 constant MITHRIL_ORE = ORE_BASE + 6;
uint16 constant RUBY_ORE = ORE_BASE + 7;
uint16 constant ADAMANTINE_ORE = ORE_BASE + 8;
uint16 constant AMETHYST_ORE = ORE_BASE + 9;
uint16 constant DIAMOND_ORE = ORE_BASE + 10;
uint16 constant RUNITE_ORE = ORE_BASE + 11;
uint16 constant DRAGONSTONE_ORE = ORE_BASE + 12;
uint16 constant TITANIUM_ORE = ORE_BASE + 13;
uint16 constant ORCHALCUM_ORE = ORE_BASE + 14;
uint16 constant ORE_MAX = ORE_BASE + 255;

// Arrows
uint16 constant ARROWS_BASE = 11776;
uint16 constant BRONZE_ARROWS = ARROWS_BASE;
uint16 constant ARROWS_MAX = ARROWS_BASE + 255;

// Scrolls
uint16 constant SCROLL_BASE = 12032;
uint16 constant AIR_SCROLL = SCROLL_BASE;
uint16 constant FIRE_SCROLL = SCROLL_BASE + 1;
uint16 constant SCROLL_MAX = SCROLL_BASE + 255;

// Boosts
uint16 constant BOOST_VIAL_BASE = 60000;
uint16 constant XP_BOOST = BOOST_VIAL_BASE;
uint16 constant NON_COMBAT_XP_BOOST = BOOST_VIAL_BASE + 1;
uint16 constant COMBAT_XP_BOOST = BOOST_VIAL_BASE + 2;
uint16 constant BOOST_VIAL_MAX = BOOST_VIAL_BASE + 255;

// MISC
uint16 constant MYSTERY_BOX = 65535;
uint16 constant RAID_PASS = MYSTERY_BOX - 1;

// Other MISC
/*Natuow Hide
Natuow Leather
Small Bone
Bone
Large Bone
Dragon Bone
Dragon Teeth
Dragon Scale
Poison
String
Rope
Leaf Fragment
Venom Pouch
Bat Wing
Lossuth Teeth */
