import {EstforConstants} from "@paintswap/estfor-definitions";
import {Equipment} from "@paintswap/estfor-definitions/types";

type DailyReward = {
  reward: Equipment;
  day: number;
};

export const allDailyRewards: DailyReward[] = [
  {
    reward: {
      itemTokenId: EstforConstants.COPPER_ORE,
      amount: 100,
    },
    day: 0,
  },
  {
    reward: {
      itemTokenId: EstforConstants.SHADOW_SCROLL,
      amount: 300,
    },
    day: 0,
  },
  {
    reward: {
      itemTokenId: EstforConstants.NATURE_SCROLL,
      amount: 300,
    },
    day: 0,
  },
  {
    reward: {
      itemTokenId: EstforConstants.COOKED_BLEKK,
      amount: 200,
    },
    day: 0,
  },
  {
    reward: {
      itemTokenId: EstforConstants.COAL_ORE,
      amount: 200,
    },
    day: 1,
  },
  {
    reward: {
      itemTokenId: EstforConstants.RAW_BLEKK,
      amount: 300,
    },
    day: 1,
  },
  {
    reward: {
      itemTokenId: EstforConstants.WILLOW_LOG,
      amount: 200,
    },
    day: 1,
  },
  {
    reward: {
      itemTokenId: EstforConstants.IRON_ORE,
      amount: 500,
    },
    day: 1,
  },
  {
    reward: {
      itemTokenId: EstforConstants.RUBY,
      amount: 100,
    },
    day: 2,
  },
  {
    reward: {
      itemTokenId: EstforConstants.AMETHYST,
      amount: 100,
    },
    day: 2,
  },
  {
    reward: {
      itemTokenId: EstforConstants.MITHRIL_ORE,
      amount: 250,
    },
    day: 2,
  },
  {
    reward: {
      itemTokenId: EstforConstants.SAPPHIRE_STAFF,
      amount: 1,
    },
    day: 2,
  },
  {
    reward: {
      itemTokenId: EstforConstants.MITHRIL_BAR,
      amount: 200,
    },
    day: 3,
  },
  {
    reward: {
      itemTokenId: EstforConstants.REDWOOD_LOG,
      amount: 200,
    },
    day: 3,
  },
  {
    reward: {
      itemTokenId: EstforConstants.RUNITE_SWORD,
      amount: 1,
    },
    day: 3,
  },
  {
    reward: {
      itemTokenId: EstforConstants.COAL_ORE,
      amount: 500,
    },
    day: 3,
  },
  {
    reward: {
      itemTokenId: EstforConstants.COOKED_BOWFISH,
      amount: 100,
    },
    day: 4,
  },
  {
    reward: {
      itemTokenId: EstforConstants.ADAMANTINE_BAR,
      amount: 200,
    },
    day: 4,
  },
  {
    reward: {
      itemTokenId: EstforConstants.RUNITE_ORE,
      amount: 100,
    },
    day: 4,
  },
  {
    reward: {
      itemTokenId: EstforConstants.DRAGONSTONE,
      amount: 10,
    },
    day: 4,
  },
  {
    reward: {
      itemTokenId: EstforConstants.LEAF_FRAGMENTS,
      amount: 20,
    },
    day: 5,
  },
  {
    reward: {
      itemTokenId: EstforConstants.ENCHANTED_ACORN,
      amount: 20,
    },
    day: 5,
  },
  {
    reward: {
      itemTokenId: EstforConstants.QUARTZ_INFUSED_FEATHER,
      amount: 20,
    },
    day: 5,
  },
  {
    reward: {
      itemTokenId: EstforConstants.BARK_CHUNK,
      amount: 20,
    },
    day: 5,
  },
  {
    reward: {
      itemTokenId: EstforConstants.DRAGON_KEY,
      amount: 5,
    },
    day: 6,
  },
  {
    reward: {
      itemTokenId: EstforConstants.HELL_SCROLL,
      amount: 300,
    },
    day: 6,
  },
  {
    reward: {
      itemTokenId: EstforConstants.LIVING_LOG,
      amount: 500,
    },
    day: 6,
  },
  {
    reward: {
      itemTokenId: EstforConstants.TITANIUM_ORE,
      amount: 1000,
    },
    day: 6,
  },
  {
    reward: {
      itemTokenId: EstforConstants.XP_BOOST,
      amount: 1,
    },
    day: 7,
  },
  {
    reward: {
      itemTokenId: EstforConstants.ORICHALCUM_ORE,
      amount: 500,
    },
    day: 7,
  },
  {
    reward: {
      itemTokenId: EstforConstants.SKILL_BOOST,
      amount: 1,
    },
    day: 7,
  },
  {
    reward: {
      itemTokenId: EstforConstants.TITANIUM_SWORD,
      amount: 1,
    },
    day: 7,
  },
];
