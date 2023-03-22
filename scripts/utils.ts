import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {ContractTransaction, ethers} from "ethers";
import {PlayerNFT} from "../typechain-types";
import {EstforConstants, EstforTypes} from "@paintswap/estfor-definitions";
import {ActionInput, EquipPosition, Skill} from "@paintswap/estfor-definitions/types";
import {COMBAT_BOOST, XP_BOOST} from "@paintswap/estfor-definitions/constants";

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

export const getActionChoiceIds = async (tx: ContractTransaction): Promise<number[]> => {
  const receipt = await tx.wait();
  const event = receipt?.events?.filter((x) => {
    return x.event == "AddActionChoices";
  })[0].args;
  return event?.actionChoiceIds;
};

// Actions
export const bronzeHelmetStats: EstforTypes.CombatStats = {
  melee: 1,
  magic: 0,
  range: 0,
  meleeDefence: 4,
  magicDefence: 0,
  rangeDefence: 1,
  health: 1,
};

const bronzeGauntletStats: EstforTypes.CombatStats = {
  melee: 0,
  magic: 0,
  range: 0,
  meleeDefence: 1,
  magicDefence: 0,
  rangeDefence: 1,
  health: 0,
};

const bronzeSwordStats: EstforTypes.CombatStats = {
  melee: 5,
  magic: 0,
  range: 0,
  meleeDefence: 0,
  magicDefence: 0,
  rangeDefence: 0,
  health: 0,
};

export const allItems: EstforTypes.InputItem[] = [
  {
    ...EstforTypes.defaultInputItem,
    tokenId: EstforConstants.BRONZE_HELMET,
    combatStats: bronzeHelmetStats,
    equipPosition: EstforTypes.EquipPosition.HEAD,
    metadataURI: "someIPFSURI.json",
  },
  {
    ...EstforTypes.defaultInputItem,
    tokenId: EstforConstants.BRONZE_GAUNTLETS,
    combatStats: bronzeGauntletStats,
    equipPosition: EstforTypes.EquipPosition.ARMS,
    metadataURI: "someIPFSURI.json",
  },
  {
    ...EstforTypes.defaultInputItem,
    tokenId: EstforConstants.IRON_HELMET,
    combatStats: bronzeHelmetStats,
    equipPosition: EstforTypes.EquipPosition.HEAD,
    metadataURI: "someIPFSURI.json",
  },
  {
    ...EstforTypes.defaultInputItem,
    tokenId: EstforConstants.SAPPHIRE_AMULET,
    combatStats: bronzeGauntletStats,
    equipPosition: EstforTypes.EquipPosition.NECK,
    metadataURI: "someIPFSURI.json",
  },
  {
    ...EstforTypes.defaultInputItem,
    tokenId: EstforConstants.BRONZE_ARMOR,
    combatStats: bronzeHelmetStats,
    equipPosition: EstforTypes.EquipPosition.BODY,
    metadataURI: "someIPFSURI.json",
  },
  {
    ...EstforTypes.defaultInputItem,
    tokenId: EstforConstants.BRONZE_TASSETS,
    combatStats: bronzeGauntletStats,
    equipPosition: EstforTypes.EquipPosition.LEGS,
    metadataURI: "someIPFSURI.json",
  },
  {
    ...EstforTypes.defaultInputItem,
    tokenId: EstforConstants.BRONZE_BOOTS,
    combatStats: bronzeHelmetStats,
    equipPosition: EstforTypes.EquipPosition.FEET,
    metadataURI: "someIPFSURI.json",
  },
  {
    ...EstforTypes.defaultInputItem,
    tokenId: EstforConstants.BRONZE_SHIELD,
    combatStats: bronzeHelmetStats,
    equipPosition: EstforTypes.EquipPosition.LEFT_HAND,
    metadataURI: "someIPFSURI.json",
  },
  {
    ...EstforTypes.defaultInputItem,
    tokenId: EstforConstants.MAGIC_FIRE_STARTER,
    equipPosition: EstforTypes.EquipPosition.RIGHT_HAND,
    metadataURI: "someIPFSURI.json",
  },
  {
    ...EstforTypes.defaultInputItem,
    tokenId: EstforConstants.BRONZE_AXE,
    equipPosition: EstforTypes.EquipPosition.RIGHT_HAND,
    metadataURI: "someIPFSURI.json",
  },
  {
    ...EstforTypes.defaultInputItem,
    tokenId: EstforConstants.BRONZE_PICKAXE,
    equipPosition: EstforTypes.EquipPosition.RIGHT_HAND,
    metadataURI: "someIPFSURI.json",
  },
  {
    ...EstforTypes.defaultInputItem,
    tokenId: EstforConstants.NET_STICK,
    equipPosition: EstforTypes.EquipPosition.RIGHT_HAND,
    metadataURI: "someIPFSURI.json",
  },
  {
    ...EstforTypes.defaultInputItem,
    tokenId: EstforConstants.BRONZE_SWORD,
    combatStats: bronzeSwordStats,
    equipPosition: EstforTypes.EquipPosition.RIGHT_HAND,
    metadataURI: "someIPFSURI.json",
  },
  {
    ...EstforTypes.defaultInputItem,
    tokenId: EstforConstants.LOG,
    equipPosition: EstforTypes.EquipPosition.AUX,
    metadataURI: "someIPFSURI.json",
  },
  {
    ...EstforTypes.defaultInputItem,
    tokenId: EstforConstants.COPPER_ORE,
    equipPosition: EstforTypes.EquipPosition.AUX,
    metadataURI: "someIPFSURI.json",
  },
  {
    ...EstforTypes.defaultInputItem,
    tokenId: EstforConstants.TIN_ORE,
    equipPosition: EstforTypes.EquipPosition.AUX,
    metadataURI: "someIPFSURI.json",
  },
  {
    ...EstforTypes.defaultInputItem,
    tokenId: EstforConstants.BRONZE_BAR,
    equipPosition: EstforTypes.EquipPosition.AUX,
    metadataURI: "someIPFSURI.json",
  },
  {
    ...EstforTypes.defaultInputItem,
    tokenId: EstforConstants.SHADOW_SCROLL,
    equipPosition: EstforTypes.EquipPosition.MAGIC_BAG,
    metadataURI: "someIPFSURI.json",
  },
  {
    ...EstforTypes.defaultInputItem,
    healthRestored: 2,
    tokenId: EstforConstants.COOKED_MINNUS,
    equipPosition: EstforTypes.EquipPosition.FOOD,
    metadataURI: "someIPFSURI.json",
  },
  {
    ...EstforTypes.defaultInputItem,
    combatStats: {...bronzeGauntletStats, magic: 2},
    healthRestored: 2,
    tokenId: EstforConstants.TOTEM_STAFF,
    equipPosition: EstforTypes.EquipPosition.BOTH_HANDS,
    metadataURI: "someIPFSURI.json",
  },
  {
    ...EstforTypes.defaultInputItem,
    tokenId: COMBAT_BOOST,
    equipPosition: EquipPosition.BOOST_VIAL,
    metadataURI: "someIPFSURI.json",
    boostType: EstforTypes.BoostType.COMBAT_XP,
    boostValue: 20,
    boostDuration: 3600 * 24,
  },
  {
    ...EstforTypes.defaultInputItem,
    tokenId: XP_BOOST,
    equipPosition: EquipPosition.BOOST_VIAL,
    metadataURI: "someIPFSURI.json",
    boostType: EstforTypes.BoostType.ANY_XP,
    boostValue: 10,
    boostDuration: 3600 * 24,
  },
];

type XPThresholdReward = {
  xpThreshold: number;
  rewards: EstforTypes.Equipment[];
};

export const allXPThresholdRewards: XPThresholdReward[] = [
  {
    xpThreshold: 500,
    rewards: [
      {
        itemTokenId: EstforConstants.BRONZE_HELMET,
        amount: 1,
      },
    ],
  },
  {
    xpThreshold: 1000,
    rewards: [
      {
        itemTokenId: EstforConstants.XP_BOOST,
        amount: 1,
      },
    ],
  },
  {
    xpThreshold: 2500,
    rewards: [
      {
        itemTokenId: EstforConstants.GATHERING_BOOST,
        amount: 1,
      },
    ],
  },
  {
    xpThreshold: 5000,
    rewards: [
      {
        itemTokenId: EstforConstants.COOKED_SKRIMP,
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
    tokenId: EstforConstants.BRONZE_HELMET,
    price: ethers.utils.parseEther("2").toString(),
  },
  {
    tokenId: EstforConstants.BRONZE_AXE,
    price: ethers.utils.parseEther("3").toString(),
  },
];

export const allActions: ActionInput[] = [
  {
    actionId: EstforConstants.ACTION_WOODCUTTING_LOG,
    info: {
      skill: EstforTypes.Skill.WOODCUTTING,
      xpPerHour: 25,
      minXP: 0,
      isDynamic: false,
      numSpawn: 0,
      handItemTokenIdRangeMin: EstforConstants.BRONZE_AXE,
      handItemTokenIdRangeMax: EstforConstants.WOODCUTTING_MAX,
      isAvailable: true,
      actionChoiceRequired: false,
      successPercent: 100,
    },
    guaranteedRewards: [{itemTokenId: EstforConstants.LOG, rate: 1220 * 10}],
    randomRewards: [],
    combatStats: EstforTypes.emptyCombatStats,
  },
  {
    actionId: EstforConstants.ACTION_FIREMAKING_ITEM,
    info: {
      skill: EstforTypes.Skill.FIREMAKING,
      xpPerHour: 0, // Decided by the type of log burned
      minXP: 0,
      isDynamic: false,
      numSpawn: 0,
      handItemTokenIdRangeMin: EstforConstants.MAGIC_FIRE_STARTER,
      handItemTokenIdRangeMax: EstforConstants.FIRE_MAX,
      isAvailable: true,
      actionChoiceRequired: true,
      successPercent: 100,
    },
    guaranteedRewards: [],
    randomRewards: [],
    combatStats: EstforTypes.emptyCombatStats,
  },
  {
    actionId: EstforConstants.ACTION_MINING_COPPER,
    info: {
      skill: EstforTypes.Skill.MINING,
      xpPerHour: 25,
      minXP: 0,
      isDynamic: false,
      numSpawn: 0,
      handItemTokenIdRangeMin: EstforConstants.BRONZE_PICKAXE,
      handItemTokenIdRangeMax: EstforConstants.MINING_MAX,
      isAvailable: true,
      actionChoiceRequired: false,
      successPercent: 100,
    },
    guaranteedRewards: [{itemTokenId: EstforConstants.COPPER_ORE, rate: 1220 * 10}],
    randomRewards: [],
    combatStats: EstforTypes.emptyCombatStats,
  },
  {
    actionId: EstforConstants.ACTION_MINING_TIN,
    info: {
      skill: EstforTypes.Skill.MINING,
      xpPerHour: 35,
      minXP: 274,
      isDynamic: false,
      numSpawn: 0,
      handItemTokenIdRangeMin: EstforConstants.BRONZE_PICKAXE,
      handItemTokenIdRangeMax: EstforConstants.MINING_MAX,
      isAvailable: true,
      actionChoiceRequired: true,
      successPercent: 100,
    },
    guaranteedRewards: [{itemTokenId: EstforConstants.TIN_ORE, rate: 1220 * 10}],
    randomRewards: [],
    combatStats: EstforTypes.emptyCombatStats,
  },
  {
    actionId: EstforConstants.ACTION_SMITHING_ITEM,
    info: {
      skill: EstforTypes.Skill.SMITHING,
      xpPerHour: 0, // Decided by the ores smelted
      minXP: 0,
      isDynamic: false,
      numSpawn: 0,
      handItemTokenIdRangeMin: EstforConstants.NONE,
      handItemTokenIdRangeMax: EstforConstants.NONE,
      isAvailable: true,
      actionChoiceRequired: true,
      successPercent: 100,
    },
    guaranteedRewards: [],
    randomRewards: [],
    combatStats: EstforTypes.emptyCombatStats,
  },
  // Combat
  {
    actionId: EstforConstants.ACTION_COMBAT_NATUOW,
    info: {
      skill: EstforTypes.Skill.COMBAT,
      xpPerHour: 3600,
      minXP: 0,
      isDynamic: false,
      numSpawn: 10,
      handItemTokenIdRangeMin: EstforConstants.COMBAT_BASE,
      handItemTokenIdRangeMax: EstforConstants.COMBAT_MAX,
      isAvailable: true,
      actionChoiceRequired: true,
      successPercent: 100,
    },
    guaranteedRewards: [
      {itemTokenId: EstforConstants.SMALL_BONE, rate: 1 * 10},
      {itemTokenId: EstforConstants.NATUOW_HIDE, rate: 1 * 10},
    ],
    randomRewards: [],
    combatStats: {
      ...EstforTypes.emptyCombatStats,
      melee: 1,
      health: 20,
    },
  },
];

type ActionChoice = {
  skill: EstforTypes.Skill;
  diff: number;
  rate: number;
  xpPerHour: number;
  minXP: number;
  inputTokenId1: number;
  num1: number;
  inputTokenId2: number;
  num2: number;
  inputTokenId3: number;
  num3: number;
  outputTokenId: number;
  outputNum: number; // Just 0 or 1 for now
  successPercent: number;
};

export const emptyActionChoice: ActionChoice = {
  skill: EstforTypes.Skill.NONE,
  diff: 0,
  rate: 0,
  xpPerHour: 0,
  minXP: 0,
  inputTokenId1: EstforConstants.NONE,
  num1: 0,
  inputTokenId2: EstforConstants.NONE,
  num2: 0,
  inputTokenId3: EstforConstants.NONE,
  num3: 0,
  outputTokenId: EstforConstants.NONE,
  outputNum: 0,
  successPercent: 100,
};

export const meleeChoices: ActionChoice[] = [
  {
    ...emptyActionChoice,
    skill: EstforTypes.Skill.MELEE,
  },
];

export const magicChoices: ActionChoice[] = [
  // All the different types of spells
  // SHADOW BLAST
  {
    ...emptyActionChoice,
    skill: EstforTypes.Skill.MAGIC,
    diff: 2, // 2 extra magic damage
    inputTokenId1: EstforConstants.SHADOW_SCROLL,
    num1: 2,
  },
];

export const magicChoiceIds: number[] = [4];

// TODO: Add all the different types of arrows
export const rangeChoices: ActionChoice[] = [];

export const firemakingChoices: ActionChoice[] = [
  {
    skill: EstforTypes.Skill.FIREMAKING,
    diff: 0,
    rate: 1220 * 10,
    xpPerHour: 25,
    minXP: 0,
    inputTokenId1: EstforConstants.LOG,
    num1: 1,
    inputTokenId2: EstforConstants.NONE,
    num2: 0,
    inputTokenId3: EstforConstants.NONE,
    num3: 0,
    outputTokenId: EstforConstants.NONE,
    outputNum: 0,
    successPercent: 100,
  },
  {
    skill: EstforTypes.Skill.FIREMAKING,
    diff: 0,
    rate: 1220 * 10,
    xpPerHour: 45,
    minXP: 1021,
    inputTokenId1: EstforConstants.OAK_LOG,
    num1: 1,
    inputTokenId2: EstforConstants.NONE,
    num2: 0,
    inputTokenId3: EstforConstants.NONE,
    num3: 0,
    outputTokenId: EstforConstants.NONE,
    outputNum: 0,
    successPercent: 100,
  },
];

export const smithingChoices: ActionChoice[] = [
  {
    skill: EstforTypes.Skill.SMITHING,
    diff: 0,
    rate: 2440 * 10,
    xpPerHour: 25,
    minXP: 0,
    inputTokenId1: EstforConstants.COPPER_ORE,
    num1: 1,
    inputTokenId2: EstforConstants.TIN_ORE,
    num2: 1,
    inputTokenId3: EstforConstants.NONE,
    num3: 0,
    outputTokenId: EstforConstants.BRONZE_BAR,
    outputNum: 1,
    successPercent: 100,
  },
  {
    skill: EstforTypes.Skill.SMITHING,
    diff: 0,
    rate: 1220 * 10,
    xpPerHour: 35,
    minXP: 0,
    inputTokenId1: EstforConstants.IRON_ORE,
    num1: 1,
    inputTokenId2: EstforConstants.NONE,
    num2: 0,
    inputTokenId3: EstforConstants.NONE,
    num3: 0,
    outputTokenId: EstforConstants.IRON_BAR,
    outputNum: 1,
    successPercent: 100,
  },
];

export type AvatarInfo = {
  name: string;
  description: string;
  imageURI: string;
  startSkills: [Skill, Skill];
};

export type FullAttireBonus = {
  skill: Skill;
  itemTokenIds: [number, number, number, number, number];
  bonusPercent: number;
};

export const allFullAttireBonuses: FullAttireBonus[] = [
  {
    skill: Skill.WOODCUTTING,
    itemTokenIds: [
      EstforConstants.NATURE_MASK,
      EstforConstants.NATURE_BODY,
      EstforConstants.NATURE_BRACERS,
      EstforConstants.NATURE_TROUSERS,
      EstforConstants.NATURE_BOOTS,
    ],
    bonusPercent: 3,
  },
  {
    skill: Skill.THIEVING,
    itemTokenIds: [
      EstforConstants.NATUOW_HOOD,
      EstforConstants.NATUOW_BODY,
      EstforConstants.NATUOW_BRACERS,
      EstforConstants.NATUOW_TASSETS,
      EstforConstants.NATUOW_BOOTS,
    ],
    bonusPercent: 3,
  },
  {
    skill: Skill.CRAFTING,
    itemTokenIds: [
      EstforConstants.BAT_WING_HAT,
      EstforConstants.BAT_WING_BODY,
      EstforConstants.BAT_WING_BRACERS,
      EstforConstants.BAT_WING_TROUSERS,
      EstforConstants.BAT_WING_BOOTS,
    ],
    bonusPercent: 3,
  },
];
