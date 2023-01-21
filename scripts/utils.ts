import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {ContractTransaction, ethers} from "ethers";
import {PlayerNFT} from "../typechain-types";

// Should match contract
export enum Skill {
  NONE,
  COMBAT, // This is a helper which incorporates attack <-> magic
  ATTACK,
  DEFENCE,
  RANGED,
  MAGIC,
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
export const RUBT_AMULET = NECK_BASE + 2;
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
export const BRONZE_SWORD = COMBAT_BASE;
export const IRON_SWORD = COMBAT_BASE + 1;
export const MITHRIL_SWORD = COMBAT_BASE + 2;
export const ADAMANTINE_SWORD = COMBAT_BASE + 3;
export const RUNITE_SWORD = COMBAT_BASE + 4;
export const TITANIUM_SWORD = COMBAT_BASE + 5;
export const ORCHALCUM_SWORD = COMBAT_BASE + 6;
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

export type Stats = {
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
  skill: Skill;
  ioId: number;
  timespan: number;
  extraEquipment: Equipment[];
};

export const createPlayer = async (
  nft: PlayerNFT,
  avatarId: number,
  account: SignerWithAddress,
  name: string
): Promise<ethers.BigNumber> => {
  const tx = await nft.connect(account).mintPlayer(avatarId, name);
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

export const getIOId = async (tx: ContractTransaction): Promise<number> => {
  const receipt = await tx.wait();
  const event = receipt?.events?.filter((x) => {
    return x.event == "AddIO";
  })[0].args;
  return event?.ioId.toNumber();
};