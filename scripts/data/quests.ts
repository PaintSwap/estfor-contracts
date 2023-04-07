import {EstforConstants, NONE} from "@paintswap/estfor-definitions";
import {ACTIONCHOICE_FIREMAKING_LOG, QUEST_STARTER_FIREMAKING} from "@paintswap/estfor-definitions/constants";

export type Quest = {
  actionId: number;
  actionNum: number;
  actionId1: number;
  actionNum1: number;
  actionChoiceId: number;
  actionChoiceNum: number;
  actionChoiceId1: number;
  actionChoiceNum1: number;
  questId: number;
  rewardItemTokenId: number;
  rewardAmount: number;
  rewardItemTokenId1: number;
  rewardAmount1: number;
};
export const allQuests: Quest[] = [
  {
    actionId: NONE,
    actionNum: 0,
    actionId1: NONE,
    actionNum1: 0,
    actionChoiceId: ACTIONCHOICE_FIREMAKING_LOG,
    actionChoiceNum: 100,
    actionChoiceId1: NONE,
    actionChoiceNum1: 0,
    questId: QUEST_STARTER_FIREMAKING,
    rewardItemTokenId: EstforConstants.LEAF_FRAGMENTS,
    rewardAmount: 10,
    rewardItemTokenId1: NONE,
    rewardAmount1: 0,
  },
];
export const allQuestsRandomFlags: boolean[] = [false];
