import {EstforConstants} from "@paintswap/estfor-definitions";
import {Equipment} from "@paintswap/estfor-definitions/types";

export const tier1DailyRewards: Equipment[] = [
  {itemTokenId: EstforConstants.COPPER_ORE, amount: 10},
  {itemTokenId: EstforConstants.COPPER_ORE, amount: 20},
  {itemTokenId: EstforConstants.BRONZE_ARMOR, amount: 30},
];
export const tier2DailyRewards: Equipment[] = [
  {itemTokenId: EstforConstants.IRON_ORE, amount: 20},
  {itemTokenId: EstforConstants.IRON_ORE, amount: 30},
  {itemTokenId: EstforConstants.IRON_ARMOR, amount: 30},
];
export const tier3DailyRewards: Equipment[] = [{itemTokenId: EstforConstants.MITHRIL_ORE, amount: 30}];
export const tier4DailyRewards: Equipment[] = [{itemTokenId: EstforConstants.ADAMANTINE_ORE, amount: 40}];

export const tier1WeeklyRewards: Equipment[] = [{itemTokenId: EstforConstants.SEERS_BODY, amount: 1}];
export const tier2WeeklyRewards: Equipment[] = [{itemTokenId: EstforConstants.SEERS_BOOTS, amount: 2}];
export const tier3WeeklyRewards: Equipment[] = [{itemTokenId: EstforConstants.SEERS_BRACERS, amount: 3}];
export const tier4WeeklyRewards: Equipment[] = [{itemTokenId: EstforConstants.SEERS_HOOD, amount: 4}];

export const allDailyRewards: Equipment[][] = [
  tier1DailyRewards,
  tier2DailyRewards,
  tier3DailyRewards,
  tier4DailyRewards,
];
export const allWeeklyRewards: Equipment[][] = [
  tier1WeeklyRewards,
  tier2WeeklyRewards,
  tier3WeeklyRewards,
  tier4WeeklyRewards,
];
