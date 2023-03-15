import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {ContractTransaction, ethers} from "ethers";
import {PlayerNFT} from "../typechain-types";
import {EstforConstants, EstforTypes} from "@paintswap/estfor-definitions";

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
const bronzeHelmentStats: EstforTypes.CombatStats = {
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
    combatStats: bronzeHelmentStats,
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
    combatStats: bronzeHelmentStats,
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
    combatStats: bronzeHelmentStats,
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
    combatStats: bronzeHelmentStats,
    equipPosition: EstforTypes.EquipPosition.BOOTS,
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
    price: "20",
  },
  {
    tokenId: EstforConstants.BRONZE_AXE,
    price: "30",
  },
];

export const allActions: EstforTypes.Action[] = [
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
    },
    guaranteedRewards: [{itemTokenId: EstforConstants.LOG, rate: 1220 * 100}],
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
    },
    guaranteedRewards: [{itemTokenId: EstforConstants.COPPER_ORE, rate: 1220 * 100}],
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
    },
    guaranteedRewards: [{itemTokenId: EstforConstants.TIN_ORE, rate: 1220 * 100}],
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
    },
    guaranteedRewards: [
      {itemTokenId: EstforConstants.SMALL_BONE, rate: 1 * 100},
      {itemTokenId: EstforConstants.NATUOW_HIDE, rate: 1 * 100},
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
  outputNum: number; // Not used yet, always 1
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
};

export const meleeChoices: ActionChoice[] = [
  {
    ...emptyActionChoice,
    skill: EstforTypes.Skill.ATTACK,
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
    rate: 1220 * 100,
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
  },
  {
    skill: EstforTypes.Skill.FIREMAKING,
    diff: 0,
    rate: 1220 * 100,
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
  },
];

export const smithingChoices: ActionChoice[] = [
  {
    skill: EstforTypes.Skill.SMITHING,
    diff: 0,
    rate: 2440 * 100,
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
  },
  {
    skill: EstforTypes.Skill.SMITHING,
    diff: 0,
    rate: 1220 * 100,
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
  },
];
