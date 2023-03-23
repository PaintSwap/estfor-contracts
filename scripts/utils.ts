import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {ContractTransaction, ethers} from "ethers";
import {PlayerNFT} from "../typechain-types";
import {EstforConstants, EstforTypes} from "@paintswap/estfor-definitions";
import {ActionChoiceInput, ActionInput, EquipPosition, Skill} from "@paintswap/estfor-definitions/types";
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

export const emptyActionChoice: ActionChoiceInput = {
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

export const meleeChoices: ActionChoiceInput[] = [
  {
    ...emptyActionChoice,
    skill: EstforTypes.Skill.MELEE,
  },
];

export const magicChoices: ActionChoiceInput[] = [
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
export const rangeChoices: ActionChoiceInput[] = [];

export const smithingChoices: ActionChoiceInput[] = [
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
