// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

uint16 constant NONE = 0;
// 1 - 255 (head)
uint16 constant HEAD_BASE = 1;
uint16 constant BRONZE_HELMET = HEAD_BASE;
uint16 constant IRON_HELMET = HEAD_BASE + 1;
uint16 constant MITHRIL_HELMET = HEAD_BASE + 2;
uint16 constant ADAMANTINE_HELMET = HEAD_BASE + 3;
uint16 constant RUNITE_HELMET = HEAD_BASE + 4;
uint16 constant TITANIUM_HELMET = HEAD_BASE + 5;
uint16 constant ORICHALCUM_HELMET = HEAD_BASE + 6;
uint16 constant NATUOW_HOOD = HEAD_BASE + 7;
uint16 constant BAT_WING_HAT = HEAD_BASE + 8;
uint16 constant NATURE_MASK = HEAD_BASE + 9;
uint16 constant APPRENTICE_HAT = HEAD_BASE + 10;
uint16 constant MAGE_HOOD = HEAD_BASE + 11;
uint16 constant SORCERER_HAT = HEAD_BASE + 12;
uint16 constant SEERS_HOOD = HEAD_BASE + 13;
uint16 constant SHAMAN_HOOD = HEAD_BASE + 14;
uint16 constant MASTER_HAT = HEAD_BASE + 15;
uint16 constant AZAMITE_COWL = HEAD_BASE + 16;
uint16 constant HAUBERK_COWL = HEAD_BASE + 17;
uint16 constant GARAGOS_COWL = HEAD_BASE + 18;
uint16 constant ETERNAL_COWL = HEAD_BASE + 19;
uint16 constant REAVER_COWL = HEAD_BASE + 20;
uint16 constant SCORCHING_COWL = HEAD_BASE + 21;
uint16 constant HEAD_MAX = HEAD_BASE + 254; // Inclusive
// 257 - 511 (neck)
uint16 constant NECK_BASE = 257;
uint16 constant SAPPHIRE_AMULET = NECK_BASE;
uint16 constant EMERALD_AMULET = NECK_BASE + 1;
uint16 constant RUBY_AMULET = NECK_BASE + 2;
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
uint16 constant ORICHALCUM_ARMOR = BODY_BASE + 6;
uint16 constant NATUOW_BODY = BODY_BASE + 7;
uint16 constant BAT_WING_BODY = BODY_BASE + 8;
uint16 constant NATURE_BODY = BODY_BASE + 9;
uint16 constant APPRENTICE_BODY = BODY_BASE + 10;
uint16 constant MAGE_BODY = BODY_BASE + 11;
uint16 constant SORCERER_BODY = BODY_BASE + 12;
uint16 constant SEERS_BODY = BODY_BASE + 13;
uint16 constant SHAMAN_BODY = BODY_BASE + 14;
uint16 constant MASTER_BODY = BODY_BASE + 15;
uint16 constant AZAMITE_BODY = BODY_BASE + 16;
uint16 constant HAUBERK_BODY = BODY_BASE + 17;
uint16 constant GARAGOS_BODY = BODY_BASE + 18;
uint16 constant ETERNAL_BODY = BODY_BASE + 19;
uint16 constant REAVER_BODY = BODY_BASE + 20;
uint16 constant SCORCHING_BODY = BODY_BASE + 21;
uint16 constant BODY_MAX = BODY_BASE + 254;
// 769 - 1023 (arms)
uint16 constant ARMS_BASE = 769;
uint16 constant BRONZE_GAUNTLETS = ARMS_BASE;
uint16 constant IRON_GAUNTLETS = ARMS_BASE + 1;
uint16 constant MITHRIL_GAUNTLETS = ARMS_BASE + 2;
uint16 constant ADAMANTINE_GAUNTLETS = ARMS_BASE + 3;
uint16 constant RUNITE_GAUNTLETS = ARMS_BASE + 4;
uint16 constant TITANIUM_GAUNTLETS = ARMS_BASE + 5;
uint16 constant ORICHALCUM_GAUNTLETS = ARMS_BASE + 6;
uint16 constant NATUOW_BRACERS = ARMS_BASE + 7;
uint16 constant BAT_WING_BRACERS = ARMS_BASE + 8;
uint16 constant NATURE_BRACERS = ARMS_BASE + 9;
uint16 constant APPRENTICE_GAUNTLETS = ARMS_BASE + 10;
uint16 constant MAGE_BRACERS = ARMS_BASE + 11;
uint16 constant SORCERER_GAUNTLETS = ARMS_BASE + 12;
uint16 constant SEERS_BRACERS = ARMS_BASE + 13;
uint16 constant SHAMAN_GAUNTLETS = ARMS_BASE + 14;
uint16 constant MASTER_BRACERS = ARMS_BASE + 15;
uint16 constant AZAMITE_BRACERS = ARMS_BASE + 16;
uint16 constant HAUBERK_BRACERS = ARMS_BASE + 17;
uint16 constant GARAGOS_BRACERS = ARMS_BASE + 18;
uint16 constant ETERNAL_BRACERS = ARMS_BASE + 19;
uint16 constant REAVER_BRACERS = ARMS_BASE + 20;
uint16 constant SCORCHING_BRACERS = ARMS_BASE + 21;
uint16 constant ARMS_MAX = ARMS_BASE + 254;
// 1025 - 1279 (legs)
uint16 constant LEGS_BASE = 1025;
uint16 constant BRONZE_TASSETS = LEGS_BASE;
uint16 constant IRON_TASSETS = LEGS_BASE + 1;
uint16 constant MITHRIL_TASSETS = LEGS_BASE + 2;
uint16 constant ADAMANTINE_TASSETS = LEGS_BASE + 3;
uint16 constant RUNITE_TASSETS = LEGS_BASE + 4;
uint16 constant TITANIUM_TASSETS = LEGS_BASE + 5;
uint16 constant ORICHALCUM_TASSETS = LEGS_BASE + 6;
uint16 constant NATUOW_TASSETS = LEGS_BASE + 7;
uint16 constant BAT_WING_TROUSERS = LEGS_BASE + 8;
uint16 constant NATURE_TROUSERS = LEGS_BASE + 9;
uint16 constant APPRENTICE_TROUSERS = LEGS_BASE + 10;
uint16 constant MAGE_TROUSERS = LEGS_BASE + 11;
uint16 constant SORCERER_TROUSERS = LEGS_BASE + 12;
uint16 constant SEERS_TROUSERS = LEGS_BASE + 13;
uint16 constant SHAMAN_TROUSERS = LEGS_BASE + 14;
uint16 constant MASTER_TROUSERS = LEGS_BASE + 15;
uint16 constant AZAMITE_CHAPS = LEGS_BASE + 16;
uint16 constant HAUBERK_CHAPS = LEGS_BASE + 17;
uint16 constant GARAGOS_CHAPS = LEGS_BASE + 18;
uint16 constant ETERNAL_CHAPS = LEGS_BASE + 19;
uint16 constant REAVER_CHAPS = LEGS_BASE + 20;
uint16 constant SCORCHING_CHAPS = LEGS_BASE + 21;
uint16 constant LEGS_MAX = LEGS_BASE + 254;

// 1281 - 1535 (feet)
uint16 constant FEET_BASE = 1281;
uint16 constant BRONZE_BOOTS = FEET_BASE;
uint16 constant IRON_BOOTS = FEET_BASE + 1;
uint16 constant MITHRIL_BOOTS = FEET_BASE + 2;
uint16 constant ADAMANTINE_BOOTS = FEET_BASE + 3;
uint16 constant RUNITE_BOOTS = FEET_BASE + 4;
uint16 constant TITANIUM_BOOTS = FEET_BASE + 5;
uint16 constant ORICHALCUM_BOOTS = FEET_BASE + 6;
uint16 constant NATUOW_BOOTS = FEET_BASE + 7;
uint16 constant BAT_WING_BOOTS = FEET_BASE + 8;
uint16 constant NATURE_BOOTS = FEET_BASE + 9;
uint16 constant APPRENTICE_BOOTS = FEET_BASE + 10;
uint16 constant MAGE_BOOTS = FEET_BASE + 11;
uint16 constant SORCERER_BOOTS = FEET_BASE + 12;
uint16 constant SEERS_BOOTS = FEET_BASE + 13;
uint16 constant SHAMAN_BOOTS = FEET_BASE + 14;
uint16 constant MASTER_BOOTS = FEET_BASE + 15;
uint16 constant AZAMITE_BOOTS = FEET_BASE + 16;
uint16 constant HAUBERK_BOOTS = FEET_BASE + 17;
uint16 constant GARAGOS_BOOTS = FEET_BASE + 18;
uint16 constant ETERNAL_BOOTS = FEET_BASE + 19;
uint16 constant REAVER_BOOTS = FEET_BASE + 20;
uint16 constant SCORCHING_BOOTS = FEET_BASE + 21;
uint16 constant FEET_MAX = FEET_BASE + 254;

// 1536 - 1791 coin
// 1792 - 2047 spare(1)

// Combat (right arm) (2048 - 2303)
uint16 constant COMBAT_BASE = 2048;
// Melee
uint16 constant SWORD_BASE = COMBAT_BASE;
uint16 constant BRONZE_SWORD = SWORD_BASE;
uint16 constant IRON_SWORD = COMBAT_BASE + 1;
uint16 constant MITHRIL_SWORD = COMBAT_BASE + 2;
uint16 constant ADAMANTINE_SWORD = COMBAT_BASE + 3;
uint16 constant RUNITE_SWORD = COMBAT_BASE + 4;
uint16 constant TITANIUM_SWORD = COMBAT_BASE + 5;
uint16 constant ORICHALCUM_SWORD = COMBAT_BASE + 6;
uint16 constant SWORD_MAX = SWORD_BASE + 49;
// Magic
uint16 constant STAFF_BASE = COMBAT_BASE + 50;
uint16 constant TOTEM_STAFF = STAFF_BASE;
uint16 constant SAPPHIRE_STAFF = STAFF_BASE + 1;
uint16 constant EMERALD_STAFF = STAFF_BASE + 2;
uint16 constant RUBY_STAFF = STAFF_BASE + 3;
uint16 constant AMETHYST_STAFF = STAFF_BASE + 4;
uint16 constant DIAMOND_STAFF = STAFF_BASE + 5;
uint16 constant DRAGONSTONE_STAFF = STAFF_BASE + 6;
uint16 constant STAFF_MAX = STAFF_BASE + 49;
// Ranged
uint16 constant BOW_BASE = COMBAT_BASE + 100;
uint16 constant BASIC_BOW = BOW_BASE;
uint16 constant BONE_BOW = BOW_BASE + 1;
uint16 constant EXPERT_BOW = BOW_BASE + 2;
uint16 constant SPECTRAL_BOW = BOW_BASE + 3;
uint16 constant ICY_BOW = BOW_BASE + 4;
uint16 constant GLITTERING_BOW = BOW_BASE + 5;
uint16 constant GODLY_BOW = BOW_BASE + 6;
uint16 constant BOW_MAX = BOW_BASE + 49;
// Shields (left arm)
uint16 constant SHIELD_BASE = COMBAT_BASE + 150;
uint16 constant BRONZE_SHIELD = SHIELD_BASE;
uint16 constant IRON_SHIELD = SHIELD_BASE + 1;
uint16 constant MITHRIL_SHIELD = SHIELD_BASE + 2;
uint16 constant ADAMANTINE_SHIELD = SHIELD_BASE + 3;
uint16 constant RUNITE_SHIELD = SHIELD_BASE + 4;
uint16 constant TITANIUM_SHIELD = SHIELD_BASE + 5;
uint16 constant ORICHALCUM_SHIELD = SHIELD_BASE + 6;
uint16 constant SHIELD_MAX = SHIELD_BASE + 49;

uint16 constant COMBAT_MAX = COMBAT_BASE + 255;

// Mining (2560 - 2815)
uint16 constant MINING_BASE = 2560;
uint16 constant BRONZE_PICKAXE = MINING_BASE;
uint16 constant IRON_PICKAXE = MINING_BASE + 1;
uint16 constant MITHRIL_PICKAXE = MINING_BASE + 2;
uint16 constant ADAMANTINE_PICKAXE = MINING_BASE + 3;
uint16 constant RUNITE_PICKAXE = MINING_BASE + 4;
uint16 constant TITANIUM_PICKAXE = MINING_BASE + 5;
uint16 constant ORICHALCUM_PICKAXE = MINING_BASE + 6;
uint16 constant MINING_MAX = MINING_BASE + 255;

// Woodcutting (2816 - 3071)
uint16 constant WOODCUTTING_BASE = 2816;
uint16 constant BRONZE_AXE = WOODCUTTING_BASE;
uint16 constant IRON_AXE = WOODCUTTING_BASE + 1;
uint16 constant MITHRIL_AXE = WOODCUTTING_BASE + 2;
uint16 constant ADAMANTINE_AXE = WOODCUTTING_BASE + 3;
uint16 constant RUNITE_AXE = WOODCUTTING_BASE + 4;
uint16 constant TITANIUM_AXE = WOODCUTTING_BASE + 5;
uint16 constant ORICHALCUM_AXE = WOODCUTTING_BASE + 6;
uint16 constant WOODCUTTING_MAX = WOODCUTTING_BASE + 255;

// Fishing (3072 - 3327)
uint16 constant FISHING_BASE = 3072;
uint16 constant NET_STICK = FISHING_BASE;
uint16 constant MEDIUM_NET = FISHING_BASE + 1;
uint16 constant WOOD_FISHING_ROD = FISHING_BASE + 2;
uint16 constant TITANIUM_FISHING_ROD = FISHING_BASE + 3;
uint16 constant HARPOON = FISHING_BASE + 4;
uint16 constant LARGE_NET = FISHING_BASE + 5;
uint16 constant MAGIC_NET = FISHING_BASE + 6;
uint16 constant CAGE = FISHING_BASE + 7;
uint16 constant FISHING_MAX = FISHING_BASE + 255;

// Firemaking (3328 - 3583)
uint16 constant FIRE_BASE = 3328;
uint16 constant MAGIC_FIRE_STARTER = FIRE_BASE;
uint16 constant FIRE_MAX = FIRE_BASE + 255;

// Smithing (none needed)
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
uint16 constant ORICHALCUM_BAR = BAR_BASE + 6;
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
uint16 constant ENCHANTED_LOG = LOG_BASE + 7;
uint16 constant LIVING_LOG = LOG_BASE + 8;
uint16 constant LOG_MAX = LOG_BASE + 255;

// Fish
uint16 constant RAW_FISH_BASE = 10752;
uint16 constant RAW_MINNUS = RAW_FISH_BASE;
uint16 constant RAW_BLEKK = RAW_FISH_BASE + 1;
uint16 constant RAW_SKRIMP = RAW_FISH_BASE + 2;
uint16 constant RAW_FEOLA = RAW_FISH_BASE + 3;
uint16 constant RAW_ANCHO = RAW_FISH_BASE + 4;
uint16 constant RAW_TROUT = RAW_FISH_BASE + 5;
uint16 constant RAW_ROJJA = RAW_FISH_BASE + 6;
uint16 constant RAW_BOWFISH = RAW_FISH_BASE + 7;
uint16 constant RAW_GOLDFISH = RAW_FISH_BASE + 8;
uint16 constant RAW_MYSTY_BLUE = RAW_FISH_BASE + 9;
uint16 constant RAW_FLITFISH = RAW_FISH_BASE + 10;
uint16 constant RAW_RAZORFISH = RAW_FISH_BASE + 11;
uint16 constant RAW_QUAFFER = RAW_FISH_BASE + 12;
uint16 constant RAW_ROXA = RAW_FISH_BASE + 13;
uint16 constant RAW_AZACUDDA = RAW_FISH_BASE + 14;
uint16 constant RAW_STONECLAW = RAW_FISH_BASE + 15;
uint16 constant RAW_CRUSKAN = RAW_FISH_BASE + 16;
uint16 constant RAW_CHODFISH = RAW_FISH_BASE + 17;
uint16 constant RAW_DOUBTFISH = RAW_FISH_BASE + 18;
uint16 constant RAW_ROSEFIN = RAW_FISH_BASE + 19;
uint16 constant RAW_SPHINX_FISH = RAW_FISH_BASE + 20;
uint16 constant RAW_SHAW = RAW_FISH_BASE + 21;
uint16 constant RAW_VANISHING_PERCH = RAW_FISH_BASE + 22;
uint16 constant RAW_VIPER_BASS = RAW_FISH_BASE + 23;
uint16 constant RAW_WATER_SERPENT = RAW_FISH_BASE + 24;
uint16 constant RAW_WHISKFIN = RAW_FISH_BASE + 25;
uint16 constant RAW_MHARA = RAW_FISH_BASE + 26;
uint16 constant RAW_GRAN_SQUIN = RAW_FISH_BASE + 27;
uint16 constant RAW_LANCER = RAW_FISH_BASE + 28;
uint16 constant RAW_OCTACLE = RAW_FISH_BASE + 29;
uint16 constant RAW_DRAGONFISH = RAW_FISH_BASE + 30;
uint16 constant RAW_YERESPATUM = RAW_FISH_BASE + 31;
uint16 constant RAW_FISH_MAX = RAW_FISH_BASE + 255;

// Cooked fish
uint16 constant COOKED_FISH_BASE = 11008;
uint16 constant COOKED_MINNUS = COOKED_FISH_BASE;
uint16 constant COOKED_BLEKK = COOKED_FISH_BASE + 1;
uint16 constant COOKED_SKRIMP = COOKED_FISH_BASE + 2;
uint16 constant COOKED_FEOLA = COOKED_FISH_BASE + 3;
uint16 constant COOKED_ANCHO = COOKED_FISH_BASE + 4;
uint16 constant COOKED_TROUT = COOKED_FISH_BASE + 5;
uint16 constant COOKED_ROJJA = COOKED_FISH_BASE + 6;
uint16 constant COOKED_BOWFISH = COOKED_FISH_BASE + 7;
uint16 constant COOKED_GOLDFISH = COOKED_FISH_BASE + 8;
uint16 constant COOKED_MYSTY_BLUE = COOKED_FISH_BASE + 9;
uint16 constant COOKED_FLITFISH = COOKED_FISH_BASE + 10;
uint16 constant COOKED_RAZORFISH = COOKED_FISH_BASE + 11;
uint16 constant COOKED_QUAFFER = COOKED_FISH_BASE + 12;
uint16 constant COOKED_ROXA = COOKED_FISH_BASE + 13;
uint16 constant COOKED_AZACUDDA = COOKED_FISH_BASE + 14;
uint16 constant COOKED_STONECLAW = COOKED_FISH_BASE + 15;
uint16 constant COOKED_CRUSKAN = COOKED_FISH_BASE + 16;
uint16 constant COOKED_CHODFISH = COOKED_FISH_BASE + 17;
uint16 constant COOKED_DOUBTFISH = COOKED_FISH_BASE + 18;
uint16 constant COOKED_ROSEFIN = COOKED_FISH_BASE + 19;
uint16 constant COOKED_SPHINX_FISH = COOKED_FISH_BASE + 20;
uint16 constant COOKED_SHAW = COOKED_FISH_BASE + 21;
uint16 constant COOKED_VANISHING_PERCH = COOKED_FISH_BASE + 22;
uint16 constant COOKED_VIPER_BASS = COOKED_FISH_BASE + 23;
uint16 constant COOKED_WATER_SERPENT = COOKED_FISH_BASE + 24;
uint16 constant COOKED_WHISKFIN = COOKED_FISH_BASE + 25;
uint16 constant COOKED_MHARA = COOKED_FISH_BASE + 26;
uint16 constant COOKED_GRAN_SQUIN = COOKED_FISH_BASE + 27;
uint16 constant COOKED_LANCER = COOKED_FISH_BASE + 28;
uint16 constant COOKED_OCTACLE = COOKED_FISH_BASE + 29;
uint16 constant COOKED_DRAGONFISH = COOKED_FISH_BASE + 30;
uint16 constant COOKED_YERESPATUM = COOKED_FISH_BASE + 31;
uint16 constant COOKED_FISH_MAX = COOKED_FISH_BASE + 255;

// Farming
uint16 constant FARMING_BASE = 11264;
uint16 constant BONEMEAL = FARMING_BASE;
uint16 constant FARMING_MAX = FARMING_BASE + 255;

// Mining
uint16 constant ORE_BASE = 11520;
uint16 constant COPPER_ORE = ORE_BASE;
uint16 constant TIN_ORE = ORE_BASE + 1;
uint16 constant IRON_ORE = ORE_BASE + 2;
uint16 constant SAPPHIRE = ORE_BASE + 3;
uint16 constant COAL_ORE = ORE_BASE + 4;
uint16 constant EMERALD = ORE_BASE + 5;
uint16 constant MITHRIL_ORE = ORE_BASE + 6;
uint16 constant RUBY = ORE_BASE + 7;
uint16 constant ADAMANTINE_ORE = ORE_BASE + 8;
uint16 constant AMETHYST = ORE_BASE + 9;
uint16 constant DIAMOND = ORE_BASE + 10;
uint16 constant RUNITE_ORE = ORE_BASE + 11;
uint16 constant DRAGONSTONE = ORE_BASE + 12;
uint16 constant TITANIUM_ORE = ORE_BASE + 13;
uint16 constant ORICHALCUM_ORE = ORE_BASE + 14;
uint16 constant ORE_MAX = ORE_BASE + 255;

// Arrows
uint16 constant ARROW_BASE = 11776;
uint16 constant BRONZE_ARROW = ARROW_BASE;
uint16 constant IRON_ARROW = ARROW_BASE + 1;
uint16 constant MITHRIL_ARROW = ARROW_BASE + 2;
uint16 constant ADAMANTINE_ARROW = ARROW_BASE + 3;
uint16 constant RUNITE_ARROW = ARROW_BASE + 4;
uint16 constant TITANIUM_ARROW = ARROW_BASE + 5;
uint16 constant ORICHALCUM_ARROW = ARROW_BASE + 6;
uint16 constant ARROW_MAX = ARROW_BASE + 255;

// Scrolls
uint16 constant SCROLL_BASE = 12032;
uint16 constant SHADOW_SCROLL = SCROLL_BASE;
uint16 constant NATURE_SCROLL = SCROLL_BASE + 1;
uint16 constant AQUA_SCROLL = SCROLL_BASE + 2;
uint16 constant HELL_SCROLL = SCROLL_BASE + 3;
uint16 constant AIR_SCROLL = SCROLL_BASE + 4;
uint16 constant BARRAGE_SCROLL = SCROLL_BASE + 5;
uint16 constant FREEZE_SCROLL = SCROLL_BASE + 6;
uint16 constant ANCIENT_SCROLL = SCROLL_BASE + 7;
uint16 constant SCROLL_MAX = SCROLL_BASE + 255;

// Eggs
uint16 constant EGG_BASE = 12544;
uint16 constant SECRET_EGG_1 = EGG_BASE;
uint16 constant SECRET_EGG_2 = EGG_BASE + 1;
uint16 constant EGG_MAX = 12799;

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

// MISC
uint16 constant MISC_BASE = 65535;
uint16 constant MYSTERY_BOX = MISC_BASE;
uint16 constant RAID_PASS = MISC_BASE - 1;
uint16 constant NATUOW_HIDE = MISC_BASE - 2;
uint16 constant NATUOW_LEATHER = MISC_BASE - 3;
uint16 constant SMALL_BONE = MISC_BASE - 4;
uint16 constant MEDIUM_BONE = MISC_BASE - 5;
uint16 constant LARGE_BONE = MISC_BASE - 6;
uint16 constant DRAGON_BONE = MISC_BASE - 7;
uint16 constant DRAGON_TEETH = MISC_BASE - 8;
uint16 constant DRAGON_SCALE = MISC_BASE - 9;
uint16 constant POISON = MISC_BASE - 10;
uint16 constant STRING = MISC_BASE - 11;
uint16 constant ROPE = MISC_BASE - 12;
uint16 constant LEAF_FRAGMENTS = MISC_BASE - 13;
uint16 constant VENOM_POUCH = MISC_BASE - 14;
uint16 constant BAT_WING = MISC_BASE - 15;
uint16 constant BAT_WING_PATCH = MISC_BASE - 16;
uint16 constant THREAD_NEEDLE = MISC_BASE - 17;
uint16 constant LOSSUTH_TEETH = MISC_BASE - 18;
uint16 constant LOSSUTH_SCALE = MISC_BASE - 19;
uint16 constant FEATHER = MISC_BASE - 20;
uint16 constant QUARTZ_INFUSED_FEATHER = MISC_BASE - 21;
uint16 constant BARK_CHUNK = MISC_BASE - 22;
uint16 constant APPRENTICE_FABRIC = MISC_BASE - 23;
uint16 constant MAGE_FABRIC = MISC_BASE - 24;
uint16 constant SORCERER_FABRIC = MISC_BASE - 25;
uint16 constant SEERS_FABRIC = MISC_BASE - 26;
uint16 constant SHAMAN_FABRIC = MISC_BASE - 27;
uint16 constant MASTER_FABRIC = MISC_BASE - 28;
uint16 constant DRAGON_KEY = MISC_BASE - 29;
uint16 constant BONE_KEY = MISC_BASE - 30;
uint16 constant NATURE_KEY = MISC_BASE - 31;
uint16 constant AQUA_KEY = MISC_BASE - 32;
uint16 constant BLUECANAR = MISC_BASE - 33;
uint16 constant ANURGAT = MISC_BASE - 34;
uint16 constant RUFARUM = MISC_BASE - 35;
uint16 constant WHITE_DEATH_SPORE = MISC_BASE - 36;
uint16 constant ENCHANTED_ACORN = MISC_BASE - 37;
uint16 constant ACORN_PATCH = MISC_BASE - 38;
uint16 constant PAPER = MISC_BASE - 39;
uint16 constant ASH = MISC_BASE - 40;
uint16 constant ARROW_SHAFT = MISC_BASE - 41;
uint16 constant BRONZE_ARROW_HEAD = MISC_BASE - 42;
uint16 constant IRON_ARROW_HEAD = MISC_BASE - 43;
uint16 constant MITHRIL_ARROW_HEAD = MISC_BASE - 44;
uint16 constant ADAMANTINE_ARROW_HEAD = MISC_BASE - 45;
uint16 constant RUNITE_ARROW_HEAD = MISC_BASE - 46;
uint16 constant TITANIUM_ARROW_HEAD = MISC_BASE - 47;
uint16 constant ORICHALCUM_ARROW_HEAD = MISC_BASE - 48;
uint16 constant FLIXORA = MISC_BASE - 49;
uint16 constant BECARA_GRASS = MISC_BASE - 50;
uint16 constant HURA_ROOT = MISC_BASE - 51;
uint16 constant RIGOB_CLOTH = MISC_BASE - 52;
uint16 constant QUAVA_SILK = MISC_BASE - 53;

uint16 constant MISC_MIN = 32768;
