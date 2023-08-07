import {EstforConstants, EstforTypes} from "@paintswap/estfor-definitions";

export type XPThresholdReward = {
  xpThreshold: number;
  rewards: EstforTypes.Equipment[];
};

export const allXPThresholdRewards: XPThresholdReward[] = [
  {
    xpThreshold: 500,
    rewards: [
      {
        itemTokenId: EstforConstants.COOKED_MINNUS,
        amount: 120,
      },
    ],
  },
  {
    xpThreshold: 1000,
    rewards: [
      {
        itemTokenId: EstforConstants.GATHERING_BOOST,
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
        itemTokenId: EstforConstants.SKILL_BOOST,
        amount: 1,
      },
    ],
  },
  {
    xpThreshold: 10000,
    rewards: [
      {
        itemTokenId: EstforConstants.COMBAT_BOOST,
        amount: 1,
      },
    ],
  },
  {
    xpThreshold: 30000,
    rewards: [
      {
        itemTokenId: EstforConstants.COOKED_GOLDFISH,
        amount: 100,
      },
    ],
  },
  {
    xpThreshold: 50000,
    rewards: [
      {
        itemTokenId: EstforConstants.XP_BOOST,
        amount: 1,
      },
    ],
  },
  {
    xpThreshold: 100000,
    rewards: [
      {
        itemTokenId: EstforConstants.XP_BOOST,
        amount: 2,
      },
    ],
  },
  {
    xpThreshold: 120000,
    rewards: [
      {
        itemTokenId: EstforConstants.GATHERING_BOOST,
        amount: 2,
      },
    ],
  },
  {
    xpThreshold: 300000,
    rewards: [
      {
        itemTokenId: EstforConstants.XP_BOOST,
        amount: 2,
      },
    ],
  },
  {
    xpThreshold: 350000,
    rewards: [
      {
        itemTokenId: EstforConstants.COMBAT_BOOST,
        amount: 2,
      },
    ],
  },
  {
    xpThreshold: 500000,
    rewards: [
      {
        itemTokenId: EstforConstants.XP_BOOST,
        amount: 2,
      },
    ],
  },
  {
    xpThreshold: 600000,
    rewards: [
      {
        itemTokenId: EstforConstants.RUFARUM,
        amount: 40,
      },
    ],
  },
  {
    xpThreshold: 750000,
    rewards: [
      {
        itemTokenId: EstforConstants.RIGOB_CLOTH,
        amount: 40,
      },
    ],
  },
  {
    xpThreshold: 900000,
    rewards: [
      {
        itemTokenId: EstforConstants.TITANIUM_BAR,
        amount: 50,
      },
    ],
  },
  {
    xpThreshold: 1000000,
    rewards: [
      {
        itemTokenId: EstforConstants.COOKED_RAZORFISH,
        amount: 1000,
      },
    ],
  },
  {
    xpThreshold: 1200000,
    rewards: [
      {
        itemTokenId: EstforConstants.XP_BOOST,
        amount: 5,
      },
    ],
  },
  {
    xpThreshold: 1500000,
    rewards: [
      {
        itemTokenId: EstforConstants.GATHERING_BOOST,
        amount: 5,
      },
    ],
  },
  {
    xpThreshold: 1800000,
    rewards: [
      {
        itemTokenId: EstforConstants.SKILL_BOOST,
        amount: 5,
      },
    ],
  },
  {
    xpThreshold: 2000000,
    rewards: [
      {
        itemTokenId: EstforConstants.COMBAT_BOOST,
        amount: 5,
      },
    ],
  },
  {
    xpThreshold: 2500000,
    rewards: [
      {
        itemTokenId: EstforConstants.SKILL_BOOST,
        amount: 5,
      },
    ],
  },
  {
    xpThreshold: 2700000,
    rewards: [
      {
        itemTokenId: EstforConstants.XP_BOOST,
        amount: 10,
      },
    ],
  },
  {
    xpThreshold: 3000000,
    rewards: [
      {
        itemTokenId: EstforConstants.XP_BOOST,
        amount: 10,
      },
    ],
  },
];
