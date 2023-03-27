import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {BigNumber, ContractTransaction} from "ethers";
import {ethers, run} from "hardhat";
import {PlayerNFT} from "../typechain-types";
import {EstforConstants, EstforTypes} from "@paintswap/estfor-definitions";
import {ActionChoiceInput, Skill} from "@paintswap/estfor-definitions/types";

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
        itemTokenId: EstforConstants.EMERALD_STAFF,
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
  {
    xpThreshold: 10000,
    rewards: [
      {
        itemTokenId: EstforConstants.WHITE_DEATH_SPORE,
        amount: 10,
      },
    ],
  },
  {
    xpThreshold: 30000,
    rewards: [
      {
        itemTokenId: EstforConstants.ASH_LOG,
        amount: 20,
      },
    ],
  },
  {
    xpThreshold: 50000,
    rewards: [
      {
        itemTokenId: EstforConstants.BONE_KEY,
        amount: 3,
      },
    ],
  },
  {
    xpThreshold: 100000,
    rewards: [
      {
        itemTokenId: EstforConstants.AQUA_KEY,
        amount: 3,
      },
    ],
  },
  {
    xpThreshold: 120000,
    rewards: [
      {
        itemTokenId: EstforConstants.DRAGON_BONE,
        amount: 50,
      },
    ],
  },
  {
    xpThreshold: 300000,
    rewards: [
      {
        itemTokenId: EstforConstants.SKILL_BOOST,
        amount: 3,
      },
    ],
  },
  {
    xpThreshold: 350000,
    rewards: [
      {
        itemTokenId: EstforConstants.XP_BOOST,
        amount: 3,
      },
    ],
  },
  /*  {
    xpThreshold: 500000,
    rewards: [
      {
        itemTokenId: EstforConstants.TODO,
        amount: 2,
      },
    ],
  },
*/
  {
    xpThreshold: 600000,
    rewards: [
      {
        itemTokenId: EstforConstants.COMBAT_BOOST,
        amount: 5,
      },
    ],
  },
  {
    xpThreshold: 750000,
    rewards: [
      {
        itemTokenId: EstforConstants.LOSSUTH_SCALE,
        amount: 5,
      },
    ],
  },
];

type ShopItem = {
  tokenId: number;
  price: BigNumber;
};

export const allShopItems: ShopItem[] = [
  {
    tokenId: EstforConstants.BRONZE_PICKAXE,
    price: ethers.utils.parseEther("10"),
  },
  {
    tokenId: EstforConstants.BRONZE_AXE,
    price: ethers.utils.parseEther("10"),
  },
  {
    tokenId: EstforConstants.MAGIC_FIRE_STARTER,
    price: ethers.utils.parseEther("1"),
  },
  {
    tokenId: EstforConstants.NET_STICK,
    price: ethers.utils.parseEther("10"),
  },
  {
    tokenId: EstforConstants.LARGE_NET,
    price: ethers.utils.parseEther("100"),
  },
  {
    tokenId: EstforConstants.MAGIC_NET,
    price: ethers.utils.parseEther("120"),
  },
  {
    tokenId: EstforConstants.WOOD_FISHING_ROD,
    price: ethers.utils.parseEther("150"),
  },
  {
    tokenId: EstforConstants.TITANIUM_FISHING_ROD,
    price: ethers.utils.parseEther("200"),
  },
  {
    tokenId: EstforConstants.HARPOON,
    price: ethers.utils.parseEther("250"),
  },
  {
    tokenId: EstforConstants.CAGE,
    price: ethers.utils.parseEther("300"),
  },
  {
    tokenId: EstforConstants.SHADOW_SCROLL,
    price: ethers.utils.parseEther("5"),
  },
  {
    tokenId: EstforConstants.NATURE_SCROLL,
    price: ethers.utils.parseEther("5"),
  },
  {
    tokenId: EstforConstants.AQUA_SCROLL,
    price: ethers.utils.parseEther("10"),
  },
  {
    tokenId: EstforConstants.HELL_SCROLL,
    price: ethers.utils.parseEther("10"),
  },
  {
    tokenId: EstforConstants.AIR_SCROLL,
    price: ethers.utils.parseEther("25"),
  },
  {
    tokenId: EstforConstants.BARRAGE_SCROLL,
    price: ethers.utils.parseEther("50"),
  },
  {
    tokenId: EstforConstants.FREEZE_SCROLL,
    price: ethers.utils.parseEther("50"),
  },
  {
    tokenId: EstforConstants.COMBAT_BOOST,
    price: ethers.utils.parseEther("200"),
  },
  {
    tokenId: EstforConstants.XP_BOOST,
    price: ethers.utils.parseEther("100"),
  },
  {
    tokenId: EstforConstants.GATHERING_BOOST,
    price: ethers.utils.parseEther("100"),
  },
  {
    tokenId: EstforConstants.SKILL_BOOST,
    price: ethers.utils.parseEther("200"),
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

// If there's an error with build-info not matching then delete cache/artifacts folder and try again
export const verifyContracts = async (addresses: string[]) => {
  for (const address of addresses) {
    await run("verify:verify", {
      address,
    });
  }
  console.log("Verified all contracts");
};
