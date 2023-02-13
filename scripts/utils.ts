import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {ContractTransaction, ethers} from "ethers";
import {PlayerNFT} from "../typechain-types";

// Should match contract
export enum Skill {
  NONE,
  COMBAT, // This is a helper which incorporates attack <-> magic
  ATTACK,
  RANGED,
  MAGIC,
  DEFENCE,
  //  MELEE_ATTACK_DEFENCE, // combo
  //  RANGED_ATTACK_DEFENCE, // combo
  //  MAGIC_ATTACK_DEFENCE, // combo
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
export const ORCHALCUM_HELMET = HEAD_BASE + 6;

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
export const BRONZE_CHESTPLATE = BODY_BASE;
export const IRON_CHESTPLATE = BODY_BASE + 1;
export const MITHRIL_CHESTPLATE = BODY_BASE + 2;
export const ADAMANTINE_CHESTPLATE = BODY_BASE + 3;
export const RUNITE_CHESTPLATE = BODY_BASE + 4;
export const TITANIUM_CHESTPLATE = BODY_BASE + 5;
export const ORCHALCUM_CHESTPLATE = BODY_BASE + 6;
export const BODY_MAX = BODY_BASE + 254;
// 769 - 1023 (arms)
export const ARMS_BASE = 769;
export const BRONZE_GAUNTLETS = ARMS_BASE;
export const IRON_GAUNTLETS = ARMS_BASE + 1;
export const MITHRIL_GAUNTLETS = ARMS_BASE + 2;
export const ADAMANTINE_GAUNTLETS = ARMS_BASE + 3;
export const RUNITE_GAUNTLETS = ARMS_BASE + 4;
export const TITANIUM_GAUNTLETS = ARMS_BASE + 5;
export const ORCHALCUM_GAUNTLETS = ARMS_BASE + 6;
export const ARMS_MAX = ARMS_BASE + 254;
// 1025 - 1279 (legs)
export const LEGS_BASE = 1025;
export const BRONZE_TASSETS = LEGS_BASE;
export const IRON_TASSETS = LEGS_BASE + 1;
export const MITHRIL_TASSETS = LEGS_BASE + 2;
export const ADAMANTINE_TASSETS = LEGS_BASE + 3;
export const RUNITE_TASSETS = LEGS_BASE + 4;
export const TITANIUM_TASSETS = LEGS_BASE + 5;
export const ORCHALCUM_TASSETS = LEGS_BASE + 6;
export const LEGS_MAX = LEGS_BASE + 254;

// 1281 - 1535 (boots)
export const BOOTS_BASE = 1281;
export const BRONZE_BOOTS = BOOTS_BASE;
export const IRON_BOOTS = BOOTS_BASE + 1;
export const MITHRIL_BOOTS = BOOTS_BASE + 2;
export const ADAMANTINE_BOOTS = BOOTS_BASE + 3;
export const RUNITE_BOOTS = BOOTS_BASE + 4;
export const TITANIUM_BOOTS = BOOTS_BASE + 5;
export const ORCHALCUM_BOOTS = BOOTS_BASE + 6;
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
export const STAFF = COMBAT_BASE + 50;
// Ranged
export const BOW = COMBAT_BASE + 100;
export const COMBAT_MAX = COMBAT_BASE + 255;

// Combat (left arm, shields) (2304 - 2559)
export const DEFENCE_COMBAT_BASE = 2304;
export const BRONZE_SHIELD = DEFENCE_COMBAT_BASE;
export const IRON_SHIELD = DEFENCE_COMBAT_BASE + 1;
export const MITHRIL_SHIELD = DEFENCE_COMBAT_BASE + 2;
export const ADAMANTINE_SHIELD = DEFENCE_COMBAT_BASE + 3;
export const RUNITE_SHIELD = DEFENCE_COMBAT_BASE + 4;
export const TITANIUM_SHIELD = DEFENCE_COMBAT_BASE + 5;
export const ORCHALCUM_SHIELD = DEFENCE_COMBAT_BASE + 6;
export const DEFENCE_COMBAT_MAX = DEFENCE_COMBAT_BASE + 255;

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

// Firemaking (3072)
export const FIRE_BASE = 3327;
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
export const COOKED_FISH_MAX = COOKED_FISH_BASE + 255;

// Farming
export const BONEMEAL = 11264;

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
export const BRONZE_ARROW = ORE_BASE;
export const ARROW_MAX = ARROW_BASE + 255;

// Scrolls
export const SCROLL_BASE = 12032;
export const AIR_SCROLL = SCROLL_BASE;
export const FIRE_SCROLL = SCROLL_BASE + 1;
export const SCROLL_MAX = SCROLL_BASE + 255;

// MISC
export const MYSTERY_BOX = 65535;
export const RAID_PASS = MYSTERY_BOX - 1;

// Boosts
export const XP_BOOST = 60000;
export const MEGA_XP_BOOST = XP_BOOST - 1;

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

export enum EquipPosition {
  HEAD,
  NECK,
  BODY,
  ARMS,
  LEGS,
  BOOTS,
  SPARE1,
  SPARE2,
  LEFT_ARM,
  RIGHT_ARM,
  ARROW_SATCHEL,
  MAGIC_BAG,
  AUX,
  NONE,
}

export type CombatStats = {
  attack: number;
  magic: number;
  range: number;
  meleeDefence: number;
  magicDefence: number;
  rangeDefence: number;
  health: number;
  // Spare
};

export type Equipment = {
  itemTokenId: number;
  numToEquip: number;
};

export type QueuedAction = {
  actionId: number;
  regenerateId: number;
  numRegenerate: number;
  choiceId: number;
  num: number;
  choiceId1: number;
  num1: number;
  choiceId2: number;
  num2: number;
  skill: Skill;
  timespan: number;
  rightArmEquipmentTokenId: number;
  leftArmEquipmentTokenId: number;
  startTime: string;
};

export const createPlayer = async (
  nft: PlayerNFT,
  avatarId: number,
  account: SignerWithAddress,
  name: string
): Promise<ethers.BigNumber> => {
  const tx = await nft.connect(account).mint(avatarId, name);
  const receipt = await tx.wait();
  const event = receipt?.events?.filter((x) => {
    return x.event == "NewPlayer";
  })[0].args;
  return event?.tokenId;
};

export const getActionId = async (tx: ContractTransaction): Promise<number> => {
  const receipt = await tx.wait();
  const event = receipt?.events?.filter((x) => {
    return x.event == "AddAction";
  })[0].args;
  return event?.actionId.toNumber();
};

export const getActionChoiceId = async (tx: ContractTransaction): Promise<number> => {
  const receipt = await tx.wait();
  const event = receipt?.events?.filter((x) => {
    return x.event == "AddActionChoice";
  })[0].args;
  return event?.actionChoiceId.toNumber();
};

// Items

// Actions

type ActionInfo = {
  skill: Skill;
  baseXPPerHour: number;
  isAvailable: boolean;
  isDynamic: boolean;
  minSkillPoints: number;
  itemTokenIdRangeMin: number;
  itemTokenIdRangeMax: number;
  auxItemTokenIdRangeMin: number;
  auxItemTokenIdRangeMax: number;
  isCombat: boolean;
};

type ActionReward = {
  itemTokenId: number;
  rate: number; // base 100, 2 decimal places
};

type Action = {
  info: ActionInfo;
  guaranteedRewards: ActionReward[];
  randomRewards: ActionReward[];
  combatStats: CombatStats;
};

type ActionChoice = {
  skill: Skill;
  diff: number;
  rate: number;
  baseXPPerHour: number;
  minSkillPoints: number;
  inputTokenId1: number;
  num1: number;
  inputTokenId2: number;
  num2: number;
  inputTokenId3: number;
  num3: number;
  outputTokenId: number;
};

export const emptyStats = {
  attack: 0,
  magic: 0,
  range: 0,
  meleeDefence: 0,
  magicDefence: 0,
  rangeDefence: 0,
  health: 0,
};

type Item = {
  tokenId: number;
  equipPosition: EquipPosition;
  stats: CombatStats;
  metadataURI: "someIPFSURI.json";
};

const bronzeHelmentStats = {
  attack: 1,
  magic: 0,
  range: 0,
  meleeDefence: 4,
  magicDefence: 0,
  rangeDefence: 1,
  health: 1,
};

const bronzeGauntletStats = {
  attack: 0,
  magic: 0,
  range: 0,
  meleeDefence: 1,
  magicDefence: 0,
  rangeDefence: 1,
  health: 0,
};

const bronzeSwordStats = {
  attack: 5,
  magic: 0,
  range: 0,
  meleeDefence: 0,
  magicDefence: 0,
  rangeDefence: 0,
  health: 0,
};

// TODO This is just reusing the same stats for now
export const allItems: Item[] = [
  {
    tokenId: BRONZE_HELMET,
    stats: bronzeHelmentStats,
    equipPosition: EquipPosition.HEAD,
    metadataURI: "someIPFSURI.json",
  },
  {
    tokenId: BRONZE_GAUNTLETS,
    stats: bronzeGauntletStats,
    equipPosition: EquipPosition.ARMS,
    metadataURI: "someIPFSURI.json",
  },
  {
    tokenId: IRON_HELMET,
    stats: bronzeHelmentStats,
    equipPosition: EquipPosition.HEAD,
    metadataURI: "someIPFSURI.json",
  },
  {
    tokenId: SAPPHIRE_AMULET,
    stats: bronzeGauntletStats,
    equipPosition: EquipPosition.NECK,
    metadataURI: "someIPFSURI.json",
  },
  {
    tokenId: BRONZE_CHESTPLATE,
    stats: bronzeHelmentStats,
    equipPosition: EquipPosition.BODY,
    metadataURI: "someIPFSURI.json",
  },
  {
    tokenId: BRONZE_TASSETS,
    stats: bronzeGauntletStats,
    equipPosition: EquipPosition.LEGS,
    metadataURI: "someIPFSURI.json",
  },
  {
    tokenId: BRONZE_BOOTS,
    stats: bronzeHelmentStats,
    equipPosition: EquipPosition.BOOTS,
    metadataURI: "someIPFSURI.json",
  },
  {
    tokenId: FIRE_LIGHTER,
    stats: emptyStats,
    equipPosition: EquipPosition.RIGHT_ARM,
    metadataURI: "someIPFSURI.json",
  },
  {
    tokenId: BRONZE_AXE,
    stats: emptyStats,
    equipPosition: EquipPosition.RIGHT_ARM,
    metadataURI: "someIPFSURI.json",
  },
  {
    tokenId: BRONZE_PICKAXE,
    stats: emptyStats,
    equipPosition: EquipPosition.RIGHT_ARM,
    metadataURI: "someIPFSURI.json",
  },
  {
    tokenId: SMALL_NET,
    stats: emptyStats,
    equipPosition: EquipPosition.RIGHT_ARM,
    metadataURI: "someIPFSURI.json",
  },
  {
    tokenId: BRONZE_SWORD,
    stats: bronzeSwordStats,
    equipPosition: EquipPosition.RIGHT_ARM,
    metadataURI: "someIPFSURI.json",
  },
  {
    tokenId: LOG,
    stats: emptyStats,
    equipPosition: EquipPosition.AUX,
    metadataURI: "someIPFSURI.json",
  },
  {
    tokenId: COPPER_ORE,
    stats: emptyStats,
    equipPosition: EquipPosition.AUX,
    metadataURI: "someIPFSURI.json",
  },
  {
    tokenId: TIN_ORE,
    stats: emptyStats,
    equipPosition: EquipPosition.AUX,
    metadataURI: "someIPFSURI.json",
  },
  {
    tokenId: BRONZE_BAR,
    stats: emptyStats,
    equipPosition: EquipPosition.AUX,
    metadataURI: "someIPFSURI.json",
  },
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
    info: {
      skill: Skill.WOODCUTTING,
      baseXPPerHour: 25,
      minSkillPoints: 0,
      isDynamic: false,
      itemTokenIdRangeMin: BRONZE_AXE,
      itemTokenIdRangeMax: WOODCUTTING_MAX,
      auxItemTokenIdRangeMin: NONE,
      auxItemTokenIdRangeMax: NONE,
      isAvailable: true,
      isCombat: false,
    },
    guaranteedRewards: [{itemTokenId: LOG, rate: 1220 * 100}],
    randomRewards: [],
    combatStats: emptyStats,
  },
  {
    info: {
      skill: Skill.FIREMAKING,
      baseXPPerHour: 0, // Decided by the type of log burned
      minSkillPoints: 0,
      isDynamic: false,
      itemTokenIdRangeMin: FIRE_LIGHTER,
      itemTokenIdRangeMax: FIRE_MAX,
      auxItemTokenIdRangeMin: LOG_BASE,
      auxItemTokenIdRangeMax: LOG_MAX,
      isAvailable: true,
      isCombat: false,
    },
    guaranteedRewards: [],
    randomRewards: [],
    combatStats: emptyStats,
  },
  {
    info: {
      skill: Skill.MINING,
      baseXPPerHour: 25,
      minSkillPoints: 0,
      isDynamic: false,
      itemTokenIdRangeMin: BRONZE_PICKAXE,
      itemTokenIdRangeMax: MINING_MAX,
      auxItemTokenIdRangeMin: NONE,
      auxItemTokenIdRangeMax: NONE,
      isAvailable: true,
      isCombat: false,
    },
    guaranteedRewards: [{itemTokenId: COPPER_ORE, rate: 1220 * 100}],
    randomRewards: [],
    combatStats: emptyStats,
  },
  {
    info: {
      skill: Skill.MINING,
      baseXPPerHour: 35,
      minSkillPoints: 274,
      isDynamic: false,
      itemTokenIdRangeMin: BRONZE_PICKAXE,
      itemTokenIdRangeMax: MINING_MAX,
      auxItemTokenIdRangeMin: NONE,
      auxItemTokenIdRangeMax: NONE,
      isAvailable: true,
      isCombat: false,
    },
    guaranteedRewards: [{itemTokenId: TIN_ORE, rate: 1220 * 100}],
    randomRewards: [],
    combatStats: emptyStats,
  },
  {
    info: {
      skill: Skill.SMITHING,
      baseXPPerHour: 0, // Decided by the ores smelted
      minSkillPoints: 0,
      isDynamic: false,
      itemTokenIdRangeMin: NONE,
      itemTokenIdRangeMax: NONE,
      auxItemTokenIdRangeMin: ORE_BASE,
      auxItemTokenIdRangeMax: ORE_MAX,
      isAvailable: true,
      isCombat: false,
    },
    guaranteedRewards: [],
    randomRewards: [],
    combatStats: emptyStats,
  },
  // Combat
];

export const firemakingChoices: ActionChoice[] = [
  {
    skill: Skill.FIREMAKING,
    diff: 0,
    rate: 1220 * 100,
    baseXPPerHour: 25,
    minSkillPoints: 0,
    inputTokenId1: LOG,
    num1: 1,
    inputTokenId2: NONE,
    num2: 0,
    inputTokenId3: NONE,
    num3: 0,
    outputTokenId: NONE,
  },
  {
    skill: Skill.FIREMAKING,
    diff: 0,
    rate: 1220 * 100,
    baseXPPerHour: 45,
    minSkillPoints: 1021,
    inputTokenId1: OAK_LOG,
    num1: 1,
    inputTokenId2: NONE,
    num2: 0,
    inputTokenId3: NONE,
    num3: 0,
    outputTokenId: NONE,
  },
];

export const smithingChoices: ActionChoice[] = [
  {
    skill: Skill.SMITHING,
    diff: 0,
    rate: 2440 * 100,
    baseXPPerHour: 25,
    minSkillPoints: 0,
    inputTokenId1: COPPER_ORE,
    num1: 1,
    inputTokenId2: TIN_ORE,
    num2: 1,
    inputTokenId3: NONE,
    num3: 0,
    outputTokenId: BRONZE_BAR,
  },
  {
    skill: Skill.SMITHING,
    diff: 0,
    rate: 1220 * 100,
    baseXPPerHour: 35,
    minSkillPoints: 0,
    inputTokenId1: IRON_ORE,
    num1: 1,
    inputTokenId2: NONE,
    num2: 0,
    inputTokenId3: NONE,
    num3: 0,
    outputTokenId: IRON_BAR,
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
    skill: Skill.RANGED,
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
