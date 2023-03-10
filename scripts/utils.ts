import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {ContractTransaction, ethers} from "ethers";
import {PlayerNFT} from "../typechain-types";

// Should match contract
export enum CombatStyle {
  NONE,
  MELEE,
  RANGE,
  MAGIC,
  MELEE_DEFENCE,
  RANGE_DEFENCE,
  MAGIC_DEFENCE,
}

// Should match contract
export enum Skill {
  NONE,
  COMBAT,
  ATTACK,
  RANGE,
  MAGIC,
  DEFENCE,
  HEALTH,
  MINING,
  WOODCUTTING,
  FISHING,
  SMITHING,
  THIEVING,
  CRAFTING,
  COOKING,
  FIREMAKING,
}

export const NONE = 0;
// 1 - 255 (head)
export const HEAD_BASE = 1;
export const BRONZE_HELMET = HEAD_BASE;
export const IRON_HELMET = HEAD_BASE + 1;
export const MITHRIL_HELMET = HEAD_BASE + 2;
export const ADAMANTINE_HELMET = HEAD_BASE + 3;
export const RUNITE_HELMET = HEAD_BASE + 4;
export const TITANIUM_HELMET = HEAD_BASE + 5;
export const ORICHALCUM_HELMET = HEAD_BASE + 6;
export const NATUOW_HOOD = HEAD_BASE + 7;
export const BAT_WING_HAT = HEAD_BASE + 8;
export const NATURE_MASK = HEAD_BASE + 9;
export const APPRENTICE_HAT = HEAD_BASE + 10;
export const MAGE_HOOD = HEAD_BASE + 11;
export const SORCERER_HAT = HEAD_BASE + 12;
export const SEERS_HOOD = HEAD_BASE + 13;
export const SHAMAN_HOOD = HEAD_BASE + 14;
export const MASTER_HAT = HEAD_BASE + 15;
export const HEAD_MAX = HEAD_BASE + 254; // Inclusive
// 257 - 511 (neck)
export const NECK_BASE = 257;
export const SAPPHIRE_AMULET = NECK_BASE;
export const EMERALD_AMULET = NECK_BASE + 1;
export const RUBY_AMULET = NECK_BASE + 2;
export const AMETHYST_AMULET = NECK_BASE + 3;
export const DIAMOND_AMULET = NECK_BASE + 4;
export const DRAGONSTONE_AMULET = NECK_BASE + 5;
export const NECK_MAX = NECK_BASE + 254;

// 513 - 767 (body)
export const BODY_BASE = 513;
export const BRONZE_ARMOR = BODY_BASE;
export const IRON_ARMOR = BODY_BASE + 1;
export const MITHRIL_ARMOR = BODY_BASE + 2;
export const ADAMANTINE_ARMOR = BODY_BASE + 3;
export const RUNITE_ARMOR = BODY_BASE + 4;
export const TITANIUM_ARMOR = BODY_BASE + 5;
export const ORICHALCUM_ARMOR = BODY_BASE + 6;
export const NATUOW_BODY = BODY_BASE + 7;
export const BAT_WING_BODY = BODY_BASE + 8;
export const NATURE_BODY = BODY_BASE + 9;
export const APPRENTICE_BODY = BODY_BASE + 10;
export const MAGE_BODY = BODY_BASE + 11;
export const SORCERER_BODY = BODY_BASE + 12;
export const SEERS_BODY = BODY_BASE + 13;
export const SHAMAN_BODY = BODY_BASE + 14;
export const MASTER_BODY = BODY_BASE + 15;
export const BODY_MAX = BODY_BASE + 254;
// 769 - 1023 (arms)
export const ARMS_BASE = 769;
export const BRONZE_GAUNTLETS = ARMS_BASE;
export const IRON_GAUNTLETS = ARMS_BASE + 1;
export const MITHRIL_GAUNTLETS = ARMS_BASE + 2;
export const ADAMANTINE_GAUNTLETS = ARMS_BASE + 3;
export const RUNITE_GAUNTLETS = ARMS_BASE + 4;
export const TITANIUM_GAUNTLETS = ARMS_BASE + 5;
export const ORICHALCUM_GAUNTLETS = ARMS_BASE + 6;
export const NATUOW_BRACERS = ARMS_BASE + 7;
export const BAT_WING_BRACERS = ARMS_BASE + 8;
export const NATURE_BRACERS = ARMS_BASE + 9;
export const APPRENTICE_GAUNTLETS = ARMS_BASE + 10;
export const MAGE_BRACERS = ARMS_BASE + 11;
export const SORCERER_GAUNTLETS = ARMS_BASE + 12;
export const SEERS_BRACERS = ARMS_BASE + 13;
export const SHAMAN_GAUNTLETS = ARMS_BASE + 14;
export const MASTER_BRACERS = ARMS_BASE + 15;
export const ARMS_MAX = ARMS_BASE + 254;
// 1025 - 1279 (legs)
export const LEGS_BASE = 1025;
export const BRONZE_TASSETS = LEGS_BASE;
export const IRON_TASSETS = LEGS_BASE + 1;
export const MITHRIL_TASSETS = LEGS_BASE + 2;
export const ADAMANTINE_TASSETS = LEGS_BASE + 3;
export const RUNITE_TASSETS = LEGS_BASE + 4;
export const TITANIUM_TASSETS = LEGS_BASE + 5;
export const ORICHALCUM_TASSETS = LEGS_BASE + 6;
export const NATUOW_TASSETS = LEGS_BASE + 7;
export const BAT_WING_TROUSERS = LEGS_BASE + 8;
export const NATURE_TROUSERS = LEGS_BASE + 9;
export const APPRENTICE_TROUSERS = LEGS_BASE + 10;
export const MAGE_TROUSERS = LEGS_BASE + 11;
export const SORCERER_TROUSERS = LEGS_BASE + 12;
export const SEERS_TROUSERS = LEGS_BASE + 13;
export const SHAMAN_TROUSERS = LEGS_BASE + 14;
export const MASTER_TROUSERS = LEGS_BASE + 15;
export const LEGS_MAX = LEGS_BASE + 254;

// 1281 - 1535 (boots)
export const BOOTS_BASE = 1281;
export const BRONZE_BOOTS = BOOTS_BASE;
export const IRON_BOOTS = BOOTS_BASE + 1;
export const MITHRIL_BOOTS = BOOTS_BASE + 2;
export const ADAMANTINE_BOOTS = BOOTS_BASE + 3;
export const RUNITE_BOOTS = BOOTS_BASE + 4;
export const TITANIUM_BOOTS = BOOTS_BASE + 5;
export const ORICHALCUM_BOOTS = BOOTS_BASE + 6;
export const NATUOW_BOOTS = BOOTS_BASE + 7;
export const BAT_WING_BOOTS = BOOTS_BASE + 8;
export const NATURE_BOOTS = BOOTS_BASE + 9;
export const APPRENTICE_BOOTS = BOOTS_BASE + 10;
export const MAGE_BOOTS = BOOTS_BASE + 11;
export const SORCERER_BOOTS = BOOTS_BASE + 12;
export const SEERS_BOOTS = BOOTS_BASE + 13;
export const SHAMAN_BOOTS = BOOTS_BASE + 14;
export const MASTER_BOOTS = BOOTS_BASE + 15;
export const BOOTS_MAX = BOOTS_BASE + 254;

// 1536 - 1791 spare(1)
// 1792 - 2047 spare(2)

// All other ones for the first arm

// Combat (right arm) (2048 - 2303)
export const COMBAT_BASE = 2048;
// Melee
export const BRONZE_SWORD = COMBAT_BASE;
export const IRON_SWORD = COMBAT_BASE + 1;
export const MITHRIL_SWORD = COMBAT_BASE + 2;
export const ADAMANTINE_SWORD = COMBAT_BASE + 3;
export const RUNITE_SWORD = COMBAT_BASE + 4;
export const TITANIUM_SWORD = COMBAT_BASE + 5;
export const ORCHALCUM_SWORD = COMBAT_BASE + 6;
// Magic
export const STAFF_BASE = COMBAT_BASE + 50;
export const STAFF_OF_THE_PHOENIX = STAFF_BASE;
export const SAPPHIRE_STAFF = STAFF_BASE + 1;
export const EMERALD_STAFF = STAFF_BASE + 2;
export const RUBY_STAFF = STAFF_BASE + 3;
export const AMETHYST_STAFF = STAFF_BASE + 4;
export const DIAMOND_STAFF = STAFF_BASE + 5;
export const DRAGONSTONE_STAFF = STAFF_BASE + 6;
export const STAFF_MAX = STAFF_BASE + 49;
// Ranged
export const BOW = COMBAT_BASE + 100;
// Shields (left arm)
export const SHIELD_BASE = COMBAT_BASE + 150;
export const BRONZE_SHIELD = SHIELD_BASE;
export const IRON_SHIELD = SHIELD_BASE + 1;
export const MITHRIL_SHIELD = SHIELD_BASE + 2;
export const ADAMANTINE_SHIELD = SHIELD_BASE + 3;
export const RUNITE_SHIELD = SHIELD_BASE + 4;
export const TITANIUM_SHIELD = SHIELD_BASE + 5;
export const ORCHALCUM_SHIELD = SHIELD_BASE + 6;

export const COMBAT_MAX = COMBAT_BASE + 255;

// Mining (2560 - 2815)
export const MINING_BASE = 2560;
export const BRONZE_PICKAXE = MINING_BASE;
export const IRON_PICKAXE = MINING_BASE + 1;
export const MITHRIL_PICKAXE = MINING_BASE + 2;
export const ADAMANTINE_PICKAXE = MINING_BASE + 3;
export const RUNITE_PICKAXE = MINING_BASE + 4;
export const TITANIUM_PICKAXE = MINING_BASE + 5;
export const ORCHALCUM_PICKAXE = MINING_BASE + 6;
export const MINING_MAX = MINING_BASE + 255;

// Woodcutting (2816 - 3071)
export const WOODCUTTING_BASE = 2816;
export const BRONZE_AXE = WOODCUTTING_BASE;
export const IRON_AXE = WOODCUTTING_BASE + 1;
export const MITHRIL_AXE = WOODCUTTING_BASE + 2;
export const ADAMANTINE_AXE = WOODCUTTING_BASE + 3;
export const RUNITE_AXE = WOODCUTTING_BASE + 4;
export const TITANIUM_AXE = WOODCUTTING_BASE + 5;
export const ORCHALCUM_AXE = WOODCUTTING_BASE + 6;
export const WOODCUTTING_MAX = WOODCUTTING_BASE + 255;

// Fishing (3072)
export const FISHING_BASE = 3072;
export const SMALL_NET = FISHING_BASE;
export const MEDIUM_NET = FISHING_BASE + 1;
export const FISHING_ROD = FISHING_BASE + 2;
export const HARPOON = FISHING_BASE + 3;
export const LARGE_NET = FISHING_BASE + 4;
export const MAGIC_NET = FISHING_BASE + 5;
export const FISHING_MAX = FISHING_BASE + 255;

// Firemaking (3328)
export const FIRE_BASE = 3328;
export const FIRE_LIGHTER = FIRE_BASE;
export const FIRE_MAX = FIRE_BASE + 255;

// Smithing (none needed)
// Thieiving (none needed)
// Crafting (none needed)
// Cooking (none needed)

// 10000+ it'a all other items

// Bars
export const BAR_BASE = 10240; // (256 * 40)
export const BRONZE_BAR = BAR_BASE;
export const IRON_BAR = BAR_BASE + 1;
export const MITHRIL_BAR = BAR_BASE + 2;
export const ADAMANTINE_BAR = BAR_BASE + 3;
export const RUNITE_BAR = BAR_BASE + 4;
export const TITANIUM_BAR = BAR_BASE + 5;
export const ORCHALCUM_BAR = BAR_BASE + 6;
export const BAR_MAX = BAR_BASE + 255;

// Logs
export const LOG_BASE = 10496;
export const LOG = LOG_BASE;
export const OAK_LOG = LOG_BASE + 1;
export const WILLOW_LOG = LOG_BASE + 2;
export const MAPLE_LOG = LOG_BASE + 3;
export const REDWOOD_LOG = LOG_BASE + 4;
export const MAGICAL_LOG = LOG_BASE + 5;
export const ASH_LOG = LOG_BASE + 6;
export const LOG_MAX = LOG_BASE + 255;

// Fish
export const RAW_FISH_BASE = 10752;
export const RAW_HUPPY = RAW_FISH_BASE;
export const RAW_MINNOW = RAW_FISH_BASE + 1;
export const RAW_SUNFISH = RAW_FISH_BASE + 2;
export const RAW_PERCH = RAW_FISH_BASE + 3;
export const RAW_CRAYFISH = RAW_FISH_BASE + 4;
export const RAW_BLUEGILL = RAW_FISH_BASE + 5;
export const RAW_CATFISH = RAW_FISH_BASE + 6;
export const RAW_CARP = RAW_FISH_BASE + 7;
export const RAW_TILAPIA = RAW_FISH_BASE + 8;
export const RAW_MUSKELLUNGE = RAW_FISH_BASE + 9;
export const RAW_SWORDFISH = RAW_FISH_BASE + 10;
export const RAW_SHARK = RAW_FISH_BASE + 11;
export const RAW_BARRIMUNDI = RAW_FISH_BASE + 12;
export const RAW_KINGFISH = RAW_FISH_BASE + 13;
export const RAW_MARLIN = RAW_FISH_BASE + 14;
export const RAW_GIANT_CATFISH = RAW_FISH_BASE + 15;
export const RAW_ELECTRIC_EEL = RAW_FISH_BASE + 16;
export const RAW_MANTA_RAY = RAW_FISH_BASE + 17;
export const RAW_LEVIATHAN = RAW_FISH_BASE + 18;
export const RAW_DRAGONFISH = RAW_FISH_BASE + 19;
export const RAW_SKRIMP = RAW_FISH_BASE + 20;
export const RAW_FIRE_MAX = RAW_FISH_BASE + 255;

// Cooked fish
export const COOKED_FISH_BASE = 11008;
export const COOKED_HUPPY = COOKED_FISH_BASE;
export const COOKED_MINNOW = COOKED_FISH_BASE + 1;
export const COOKED_SUNFISH = COOKED_FISH_BASE + 2;
export const COOKED_PERCH = COOKED_FISH_BASE + 3;
export const COOKED_CRAYFISH = COOKED_FISH_BASE + 4;
export const COOKED_BLUEGILL = COOKED_FISH_BASE + 5;
export const COOKED_CATFISH = COOKED_FISH_BASE + 6;
export const COOKED_CARP = COOKED_FISH_BASE + 7;
export const COOKED_TILAPIA = COOKED_FISH_BASE + 8;
export const COOKED_MUSKELLUNGE = COOKED_FISH_BASE + 9;
export const COOKED_SWORDFISH = COOKED_FISH_BASE + 10;
export const COOKED_SHARK = COOKED_FISH_BASE + 11;
export const COOKED_BARRIMUNDI = COOKED_FISH_BASE + 12;
export const COOKED_KINGFISH = COOKED_FISH_BASE + 13;
export const COOKED_MARLIN = COOKED_FISH_BASE + 14;
export const COOKED_GIANT_CATFISH = COOKED_FISH_BASE + 15;
export const COOKED_ELECTRIC_EEL = COOKED_FISH_BASE + 16;
export const COOKED_MANTA_RAY = COOKED_FISH_BASE + 17;
export const COOKED_LEVIATHAN = COOKED_FISH_BASE + 18;
export const COOKED_DRAGONFISH = COOKED_FISH_BASE + 19;
export const COOKED_SKRIMP = COOKED_FISH_BASE + 20;
export const COOKED_BOWFISH = COOKED_FISH_BASE + 21;
export const COOKED_FISH_MAX = COOKED_FISH_BASE + 255;

// Farming
export const FARMING_BASE = 11264;
export const BONEMEAL = FARMING_BASE;
export const BONEMEALX2 = FARMING_BASE + 1;
export const BONEMEALX5 = FARMING_BASE + 2;
export const BONEMEALX10 = FARMING_BASE + 3;
export const FARMING_MAX = FARMING_BASE + 255;

// Mining
export const ORE_BASE = 11520;
export const COPPER_ORE = ORE_BASE;
export const TIN_ORE = ORE_BASE + 1;
export const IRON_ORE = ORE_BASE + 2;
export const SAPPHIRE_ORE = ORE_BASE + 3;
export const COAL_ORE = ORE_BASE + 4;
export const EMERALD_ORE = ORE_BASE + 5;
export const MITHRIL_ORE = ORE_BASE + 6;
export const RUBY_ORE = ORE_BASE + 7;
export const ADAMANTINE_ORE = ORE_BASE + 8;
export const AMETHYST_ORE = ORE_BASE + 9;
export const DIAMOND_ORE = ORE_BASE + 10;
export const RUNITE_ORE = ORE_BASE + 11;
export const DRAGONSTONE_ORE = ORE_BASE + 12;
export const TITANIUM_ORE = ORE_BASE + 13;
export const ORCHALCUM_ORE = ORE_BASE + 14;
export const ORE_MAX = ORE_BASE + 255;

// Arrows
export const ARROW_BASE = 11776;
export const BRONZE_ARROW = ARROW_BASE;
export const ARROW_MAX = ARROW_BASE + 255;

// Scrolls
export const SCROLL_BASE = 12032;
export const SHADOW_SCROLL = SCROLL_BASE;
export const NATURE_SCROLL = SCROLL_BASE + 1;
export const AQUA_SCROLL = SCROLL_BASE + 2;
export const HELL_SCROLL = SCROLL_BASE + 3;
export const AIR_SCROLL = SCROLL_BASE + 4;
export const BARRAGE_SCROLL = SCROLL_BASE + 5;
export const FREEZE_SCROLL = SCROLL_BASE + 6;
export const SCROLL_MAX = SCROLL_BASE + 255;

// Spells
export const SPELL_BASE = 12544;
export const SHADOW_BLAST = SPELL_BASE;
export const NATURES_FURU = SPELL_BASE + 1;
export const DEATH_WAVE = SPELL_BASE + 2;
export const VORTEX = SPELL_BASE + 3;
export const MYSTIC_BLAST = SPELL_BASE + 4;
export const MAGIC_BREATH = SPELL_BASE + 5;
export const SUMMON_HELL_HOUND = SPELL_BASE + 6;
export const AIR_BALL = SPELL_BASE + 7;
export const FURY_FISTS = SPELL_BASE + 8;
export const CONCUSSION_BEAMS = SPELL_BASE + 9;
export const ICE_SPIKES = SPELL_BASE + 10;
export const SPELL_MAX = SPELL_BASE + 255;

// Boosts
export const BOOST_BASE = 12800;
export const COMBAT_BOOST = BOOST_BASE;
export const XP_BOOST = BOOST_BASE + 1;
export const GATHERING_BOOST = BOOST_BASE + 2;
export const SKILLER_BOOST = BOOST_BASE + 3;
export const ABSENCE_BOOST = BOOST_BASE + 4;
export const COMBAT_BOOST_NON_TRANSFERABLE = BOOST_BASE + 5;
export const XP_BOOST_NON_TRANSFERABLE = BOOST_BASE + 6;
export const GATHERING_BOOST_NON_TRANSFERABLE = BOOST_BASE + 7;
export const SKILLER_BOOST_NON_TRANSFERABLE = BOOST_BASE + 8;
export const ABSENCE_BOOST_NON_TRANSFERABLE = BOOST_BASE + 9;
export const BOOST_MAX = BOOST_BASE + 255;

// Thieving
export const THIEVING_BASE = 13056;
export const PICKPOCKET_CHILD = THIEVING_BASE;
export const PICKPOCKET_MAN = THIEVING_BASE + 1;
export const PICKPOCKET_GUARD = THIEVING_BASE + 2;
export const LOCKPICK_CHEST = THIEVING_BASE + 3;
export const STEAL_FROM_STALL = THIEVING_BASE + 4;
export const STEAL_FROM_FARMER = THIEVING_BASE + 5;
export const STEAL_FROM_FISHERMAN = THIEVING_BASE + 6;
export const STEAL_FROM_LUMBERJACK = THIEVING_BASE + 7;
export const STEAL_FROM_BLACKSMITH = THIEVING_BASE + 8;
export const PICKPOCKET_HEAD_GUARD = THIEVING_BASE + 9;
export const PICKPOCKET_WIZARD = THIEVING_BASE + 10;
export const STEAL_FROM_POTION_SHOP = THIEVING_BASE + 11;
export const STEAL_FROM_GEM_MERCHANT = THIEVING_BASE + 12;
export const STEAL_FROM_BANK = THIEVING_BASE + 13;
export const PICKPOCKET_MASTER_THIEF = THIEVING_BASE + 14;
export const THIEVING_MAX = 13311;

// MISC
export const MISC_BASE = 32768;
export const NATUOW_HIDE = MISC_BASE;
export const NATUOW_LEATHER = MISC_BASE + 1;
export const SMALL_BONE = MISC_BASE + 2;
export const MEDIUM_BONE = MISC_BASE + 3;
export const LARGE_BONE = MISC_BASE + 4;
export const DRAGON_BONE = MISC_BASE + 5;
export const DRAGON_TEETH = MISC_BASE + 6;
export const DRAGON_SCALE = MISC_BASE + 7;
export const POISON = MISC_BASE + 8;
export const STRING = MISC_BASE + 9;
export const ROPE = MISC_BASE + 10;
export const LEAF_FRAGMENTS = MISC_BASE + 11;
export const VENOM_POUCH = MISC_BASE + 12;
export const BAT_WING = MISC_BASE + 13;
export const BAT_WING_PATCH = MISC_BASE + 14;
export const THREAD_NEEDLE = MISC_BASE + 15;
export const LOSSUTH_TEETH = MISC_BASE + 16;
export const LOSSUTH_SCALE = MISC_BASE + 17;
export const FEATHER = MISC_BASE + 18;
export const QUARTZ_INFUSED_FEATHER = MISC_BASE + 19;
export const BARK_CHUNK = MISC_BASE + 20;
export const APPRENTICE_FABRIC = MISC_BASE + 21;
export const MAGE_FABRIC = MISC_BASE + 22;
export const SORCERER_FABRIC = MISC_BASE + 23;
export const SEERS_FABRIC = MISC_BASE + 24;
export const SHAMAN_FABRIC = MISC_BASE + 25;
export const MASTER_FABRIC = MISC_BASE + 26;
export const DRAGON_KEY = MISC_BASE + 27;
export const BONE_KEY = MISC_BASE + 28;
export const NATURE_KEY = MISC_BASE + 29;
export const AQUA_KEY = MISC_BASE + 30;
export const BLUECANAR = MISC_BASE + 31;
export const ANURGAT = MISC_BASE + 32;
export const RUFARUM = MISC_BASE + 33;
export const WHITE_DEATH_SPORE = MISC_BASE + 34;
export const BONES = MISC_BASE + 35;
export const RUBY = MISC_BASE + 36;
export const MISC_MAX = MISC_BASE + (10 + 256) + 255;

// Other
export const MYSTERY_BOX = 65535;
export const RAID_PASS = MYSTERY_BOX - 1;

export enum EquipPosition {
  HEAD,
  NECK,
  BODY,
  ARMS,
  LEGS,
  BOOTS,
  SPARE1,
  SPARE2,
  LEFT_HAND,
  RIGHT_HAND,
  BOTH_HANDS,
  NONE,
  ARROW_SATCHEL,
  MAGIC_BAG,
  FOOD,
  AUX, // wood, seeds etc..
  BOOST_VIAL,
}

export type CombatStats = {
  melee: number;
  magic: number;
  range: number;
  meleeDefence: number;
  magicDefence: number;
  rangeDefence: number;
  health: number;
};

export type Equipment = {
  itemTokenId: number;
  amount: number;
};

export type Attire = {
  helmet: number;
  amulet: number;
  armor: number;
  gauntlets: number;
  tassets: number;
  boots: number;
  ring: number;
  reserved1: number;
  queueId: number;
};

export const noAttire = {
  helmet: NONE,
  amulet: NONE,
  armor: NONE,
  gauntlets: NONE,
  tassets: NONE,
  boots: NONE,
  ring: NONE, // Always NONE for now
  reserved1: NONE, // Always NONE for now
  queueId: 0, // Doesn't matter
};

export type QueuedAction = {
  attire: Attire;
  actionId: number;
  regenerateId: number;
  choiceId: number;
  choiceId1: number;
  choiceId2: number;
  combatStyle: CombatStyle;
  timespan: number;
  rightHandEquipmentTokenId: number;
  leftHandEquipmentTokenId: number;
  startTime: string;
  isValid: boolean;
};

export const createPlayer = async (
  playerNFT: PlayerNFT,
  avatarId: number,
  account: SignerWithAddress,
  name: string,
  makeActive: boolean
): Promise<ethers.BigNumber> => {
  const tx = await playerNFT.connect(account).mint(avatarId, name, makeActive);
  const receipt = await tx.wait();
  const event = receipt?.events?.filter((x) => {
    return x.event == "NewPlayer";
  })[0].args;
  return event?.playerId;
};

export const getRequestId = async (tx: ContractTransaction): Promise<number> => {
  const receipt = await tx.wait();
  const event = receipt?.events?.filter((x) => {
    return x.event == "RequestSent";
  })[0].args;
  return event?.requestId.toNumber();
};

export const getActionId = async (tx: ContractTransaction): Promise<number> => {
  const receipt = await tx.wait();
  const event = receipt?.events?.filter((x) => {
    return x.event == "AddAction";
  })[0].args;
  return event?.action.actionId;
};

export const getActionChoiceId = async (tx: ContractTransaction): Promise<number> => {
  const receipt = await tx.wait();
  const event = receipt?.events?.filter((x) => {
    return x.event == "AddActionChoice";
  })[0].args;
  return event?.actionChoiceId;
};

// Actions
export enum ActionQueueStatus {
  NONE,
  APPEND,
  KEEP_LAST_IN_PROGRESS,
}

type ActionInfo = {
  skill: Skill;
  isAvailable: boolean;
  isDynamic: boolean;
  actionChoiceRequired: boolean;
  xpPerHour: number;
  numSpawn: number;
  minSkillPoints: number;
  handItemTokenIdRangeMin: number;
  handItemTokenIdRangeMax: number;
};

type ActionReward = {
  itemTokenId: number;
  rate: number; // base 100, 2 decimal places
};

type Action = {
  actionId: number;
  info: ActionInfo;
  guaranteedRewards: ActionReward[];
  randomRewards: ActionReward[];
  combatStats: CombatStats;
};

type ActionChoice = {
  skill: Skill;
  diff: number;
  rate: number;
  xpPerHour: number;
  minSkillPoints: number;
  inputTokenId1: number;
  num1: number;
  inputTokenId2: number;
  num2: number;
  inputTokenId3: number;
  num3: number;
  outputTokenId: number;
  outputNum: number; // Not used yet, always 1
};

export const emptyStats: CombatStats = {
  melee: 0,
  magic: 0,
  range: 0,
  meleeDefence: 0,
  magicDefence: 0,
  rangeDefence: 0,
  health: 0,
};

const bronzeHelmentStats: CombatStats = {
  melee: 1,
  magic: 0,
  range: 0,
  meleeDefence: 4,
  magicDefence: 0,
  rangeDefence: 1,
  health: 1,
};

const bronzeGauntletStats: CombatStats = {
  melee: 0,
  magic: 0,
  range: 0,
  meleeDefence: 1,
  magicDefence: 0,
  rangeDefence: 1,
  health: 0,
};

const bronzeSwordStats: CombatStats = {
  melee: 5,
  magic: 0,
  range: 0,
  meleeDefence: 0,
  magicDefence: 0,
  rangeDefence: 0,
  health: 0,
};

export enum BoostType {
  NONE,
  ANY_XP,
  COMBAT_XP,
  NON_COMBAT_XP,
  GATHERING,
  ABSENCE,
}
// Input only
type NonCombatStat = {
  skill: Skill;
  diff: number;
};
// Contains everything you need to create an item
type InputItem = {
  combatStats: CombatStats;
  nonCombatStats: NonCombatStat[];
  tokenId: number;
  equipPosition: EquipPosition;
  // Can this be transferred to another player?
  isTransferable: boolean;
  // Minimum requirements in this skill
  skill: Skill;
  minSkillPoints: number;
  // Food
  healthRestored: number;
  // Boost
  boostType: BoostType;
  boostValue: number; // Varies, could be the % increase
  boostDuration: number; // How long the effect of the boost last
  // uri
  metadataURI: string;
};

type XPThresholdReward = {
  xpThreshold: number;
  equipments: Equipment[];
};

export const defaultInputItem = {
  combatStats: emptyStats,
  nonCombatStats: [],
  isTransferable: true,
  skill: Skill.NONE,
  minSkillPoints: 0,
  healthRestored: 0,
  boostType: BoostType.NONE,
  boostValue: 0,
  boostDuration: 0,
};

export const allItems: InputItem[] = [
  {
    ...defaultInputItem,
    tokenId: BRONZE_HELMET,
    combatStats: bronzeHelmentStats,
    equipPosition: EquipPosition.HEAD,
    metadataURI: "someIPFSURI.json",
  },
  {
    ...defaultInputItem,
    tokenId: BRONZE_GAUNTLETS,
    combatStats: bronzeGauntletStats,
    equipPosition: EquipPosition.ARMS,
    metadataURI: "someIPFSURI.json",
  },
  {
    ...defaultInputItem,
    tokenId: IRON_HELMET,
    combatStats: bronzeHelmentStats,
    equipPosition: EquipPosition.HEAD,
    metadataURI: "someIPFSURI.json",
  },
  {
    ...defaultInputItem,
    tokenId: SAPPHIRE_AMULET,
    combatStats: bronzeGauntletStats,
    equipPosition: EquipPosition.NECK,
    metadataURI: "someIPFSURI.json",
  },
  {
    ...defaultInputItem,
    tokenId: BRONZE_ARMOR,
    combatStats: bronzeHelmentStats,
    equipPosition: EquipPosition.BODY,
    metadataURI: "someIPFSURI.json",
  },
  {
    ...defaultInputItem,
    tokenId: BRONZE_TASSETS,
    combatStats: bronzeGauntletStats,
    equipPosition: EquipPosition.LEGS,
    metadataURI: "someIPFSURI.json",
  },
  {
    ...defaultInputItem,
    tokenId: BRONZE_BOOTS,
    combatStats: bronzeHelmentStats,
    equipPosition: EquipPosition.BOOTS,
    metadataURI: "someIPFSURI.json",
  },
  {
    ...defaultInputItem,
    tokenId: FIRE_LIGHTER,
    equipPosition: EquipPosition.RIGHT_HAND,
    metadataURI: "someIPFSURI.json",
  },
  {
    ...defaultInputItem,
    tokenId: BRONZE_AXE,
    equipPosition: EquipPosition.RIGHT_HAND,
    metadataURI: "someIPFSURI.json",
  },
  {
    ...defaultInputItem,
    tokenId: BRONZE_PICKAXE,
    equipPosition: EquipPosition.RIGHT_HAND,
    metadataURI: "someIPFSURI.json",
  },
  {
    ...defaultInputItem,
    tokenId: SMALL_NET,
    equipPosition: EquipPosition.RIGHT_HAND,
    metadataURI: "someIPFSURI.json",
  },
  {
    ...defaultInputItem,
    tokenId: BRONZE_SWORD,
    combatStats: bronzeSwordStats,
    equipPosition: EquipPosition.RIGHT_HAND,
    metadataURI: "someIPFSURI.json",
  },
  {
    ...defaultInputItem,
    tokenId: LOG,
    equipPosition: EquipPosition.AUX,
    metadataURI: "someIPFSURI.json",
  },
  {
    ...defaultInputItem,
    tokenId: COPPER_ORE,
    equipPosition: EquipPosition.AUX,
    metadataURI: "someIPFSURI.json",
  },
  {
    ...defaultInputItem,
    tokenId: TIN_ORE,
    equipPosition: EquipPosition.AUX,
    metadataURI: "someIPFSURI.json",
  },
  {
    ...defaultInputItem,
    tokenId: BRONZE_BAR,
    equipPosition: EquipPosition.AUX,
    metadataURI: "someIPFSURI.json",
  },
];

export const allXPThresholdRewards: XPThresholdReward[] = [
  {
    xpThreshold: 500,
    equipments: [
      {
        itemTokenId: BRONZE_HELMET,
        amount: 1,
      },
    ],
  },
  {
    xpThreshold: 1000,
    equipments: [
      {
        itemTokenId: XP_BOOST_NON_TRANSFERABLE,
        amount: 1,
      },
    ],
  },
  {
    xpThreshold: 2500,
    equipments: [
      {
        itemTokenId: GATHERING_BOOST_NON_TRANSFERABLE,
        amount: 1,
      },
    ],
  },
  {
    xpThreshold: 5000,
    equipments: [
      {
        itemTokenId: COOKED_SKRIMP,
        amount: 20,
      },
    ],
  },
  // TODO...
];

type ShopItem = {
  tokenId: number;
  price: string;
};

export const allShopItems: ShopItem[] = [
  {
    tokenId: BRONZE_HELMET,
    price: "20",
  },
  {
    tokenId: BRONZE_AXE,
    price: "30",
  },
];

export const allActions: Action[] = [
  {
    actionId: 1,
    info: {
      skill: Skill.WOODCUTTING,
      xpPerHour: 25,
      minSkillPoints: 0,
      isDynamic: false,
      numSpawn: 0,
      handItemTokenIdRangeMin: BRONZE_AXE,
      handItemTokenIdRangeMax: WOODCUTTING_MAX,
      isAvailable: true,
      actionChoiceRequired: false,
    },
    guaranteedRewards: [{itemTokenId: LOG, rate: 1220 * 100}],
    randomRewards: [],
    combatStats: emptyStats,
  },
  {
    actionId: 2,
    info: {
      skill: Skill.FIREMAKING,
      xpPerHour: 0, // Decided by the type of log burned
      minSkillPoints: 0,
      isDynamic: false,
      numSpawn: 0,
      handItemTokenIdRangeMin: FIRE_LIGHTER,
      handItemTokenIdRangeMax: FIRE_MAX,
      isAvailable: true,
      actionChoiceRequired: true,
    },
    guaranteedRewards: [],
    randomRewards: [],
    combatStats: emptyStats,
  },
  {
    actionId: 3,
    info: {
      skill: Skill.MINING,
      xpPerHour: 25,
      minSkillPoints: 0,
      isDynamic: false,
      numSpawn: 0,
      handItemTokenIdRangeMin: BRONZE_PICKAXE,
      handItemTokenIdRangeMax: MINING_MAX,
      isAvailable: true,
      actionChoiceRequired: false,
    },
    guaranteedRewards: [{itemTokenId: COPPER_ORE, rate: 1220 * 100}],
    randomRewards: [],
    combatStats: emptyStats,
  },
  {
    actionId: 4,
    info: {
      skill: Skill.MINING,
      xpPerHour: 35,
      minSkillPoints: 274,
      isDynamic: false,
      numSpawn: 0,
      handItemTokenIdRangeMin: BRONZE_PICKAXE,
      handItemTokenIdRangeMax: MINING_MAX,
      isAvailable: true,
      actionChoiceRequired: true,
    },
    guaranteedRewards: [{itemTokenId: TIN_ORE, rate: 1220 * 100}],
    randomRewards: [],
    combatStats: emptyStats,
  },
  {
    actionId: 5,
    info: {
      skill: Skill.SMITHING,
      xpPerHour: 0, // Decided by the ores smelted
      minSkillPoints: 0,
      isDynamic: false,
      numSpawn: 0,
      handItemTokenIdRangeMin: NONE,
      handItemTokenIdRangeMax: NONE,
      isAvailable: true,
      actionChoiceRequired: true,
    },
    guaranteedRewards: [],
    randomRewards: [],
    combatStats: emptyStats,
  },
  // Combat
  {
    actionId: 6,
    // Natuow
    info: {
      skill: Skill.COMBAT,
      xpPerHour: 3600,
      minSkillPoints: 0,
      isDynamic: false,
      numSpawn: 10,
      handItemTokenIdRangeMin: COMBAT_BASE,
      handItemTokenIdRangeMax: COMBAT_MAX,
      isAvailable: true,
      actionChoiceRequired: true,
    },
    guaranteedRewards: [
      {itemTokenId: BONES, rate: 1 * 100},
      {itemTokenId: NATUOW_HIDE, rate: 1 * 100},
    ],
    randomRewards: [],
    combatStats: {
      ...emptyStats,
      melee: 1,
      health: 20,
    },
  },
];

export const emptyActionChoice: ActionChoice = {
  skill: Skill.NONE,
  diff: 0,
  rate: 0,
  xpPerHour: 0,
  minSkillPoints: 0,
  inputTokenId1: NONE,
  num1: 0,
  inputTokenId2: NONE,
  num2: 0,
  inputTokenId3: NONE,
  num3: 0,
  outputTokenId: NONE,
  outputNum: 0,
};

export const meleeChoices: ActionChoice[] = [
  {
    ...emptyActionChoice,
    skill: Skill.ATTACK,
  },
];

export const magicChoices: ActionChoice[] = [
  // All the different types of spells
  // SHADOW BLAST
  {
    ...emptyActionChoice,
    skill: Skill.MAGIC,
    diff: 2, // 2 extra magic damage
    inputTokenId1: SHADOW_SCROLL,
    num1: 2,
  },
];

// TODO: Add all the different types of arrows
export const rangeChoices: ActionChoice[] = [];

export const firemakingChoices: ActionChoice[] = [
  {
    skill: Skill.FIREMAKING,
    diff: 0,
    rate: 1220 * 100,
    xpPerHour: 25,
    minSkillPoints: 0,
    inputTokenId1: LOG,
    num1: 1,
    inputTokenId2: NONE,
    num2: 0,
    inputTokenId3: NONE,
    num3: 0,
    outputTokenId: NONE,
    outputNum: 0,
  },
  {
    skill: Skill.FIREMAKING,
    diff: 0,
    rate: 1220 * 100,
    xpPerHour: 45,
    minSkillPoints: 1021,
    inputTokenId1: OAK_LOG,
    num1: 1,
    inputTokenId2: NONE,
    num2: 0,
    inputTokenId3: NONE,
    num3: 0,
    outputTokenId: NONE,
    outputNum: 0,
  },
];

export const smithingChoices: ActionChoice[] = [
  {
    skill: Skill.SMITHING,
    diff: 0,
    rate: 2440 * 100,
    xpPerHour: 25,
    minSkillPoints: 0,
    inputTokenId1: COPPER_ORE,
    num1: 1,
    inputTokenId2: TIN_ORE,
    num2: 1,
    inputTokenId3: NONE,
    num3: 0,
    outputTokenId: BRONZE_BAR,
    outputNum: 1,
  },
  {
    skill: Skill.SMITHING,
    diff: 0,
    rate: 1220 * 100,
    xpPerHour: 35,
    minSkillPoints: 0,
    inputTokenId1: IRON_ORE,
    num1: 1,
    inputTokenId2: NONE,
    num2: 0,
    inputTokenId3: NONE,
    num3: 0,
    outputTokenId: IRON_BAR,
    outputNum: 1,
  },
];

// MELEE attack, defence, attack/defence
// Range attack, defence, attack/defence, different types of arrows
// Magic (), attack, defence, attack/defence. Different types of spells, composed of different types of runes.

// Melee
// Item used (changes combat stats)
// Style used, attack, defence or attack/defence (XP split only)

// Range
// Bow used (changes combat stats)
// Style used, attack, defence or attack/defence (XP split only)
// Arrows used (changes combat stats), consumed 1 type of arrow

// Magic
// Staff used (changes combat stats)
// Style used, attack, defence or attack/defence (XP split only)
// Magic used (changes combat stats), consumed multiple scrolls

// Shield optional

// Options
/*
export const allCombatSubActions: CombatConsumables[] = [
  {
    skill: Skill.RANGE,
    diff: 10, // 10 more ranged dmg/h
    minSkillPoints: 0,
    rate: 100, // 100 arrows used hour
    inputTokenId1: BRONZE_ARROW,
    num1: 1,
    inputTokenId2: NONE,
    num2: 0,
    inputTokenId3: NONE,
    num3: 0,
  },
  // Fire blast
  {
    skill: Skill.MAGIC,
    diff: 5,
    minSkillPoints: 0,
    rate: 100, // 100 combinations used per hour
    inputTokenId1: AIR_SCROLL,
    num1: 2,
    inputTokenId2: FIRE_SCROLL,
    num2: 1,
    inputTokenId3: NONE,
    num3: 0,
  },
];
*/
