import {EstforConstants, NONE} from "@paintswap/estfor-definitions";
import {ACTIONCHOICE_FIREMAKING_LOG, QUEST_STARTER_FIREMAKING} from "@paintswap/estfor-definitions/constants";
import {Skill} from "@paintswap/estfor-definitions/types";

export type Quest = {
  questId: number;
  dependentQuestId: number;
  actionId: number;
  actionNum: number;
  actionId1: number;
  actionNum1: number;
  actionChoiceId: number;
  actionChoiceNum: number;
  skillReward: number;
  skillXPGained: number;
  rewardItemTokenId: number;
  rewardAmount: number;
  rewardItemTokenId1: number;
  rewardAmount1: number;
};
export const allQuests: Quest[] = [
  {
    questId: QUEST_STARTER_FIREMAKING,
    dependentQuestId: 0,
    actionId: NONE,
    actionNum: 0,
    actionId1: NONE,
    actionNum1: 0,
    actionChoiceId: ACTIONCHOICE_FIREMAKING_LOG,
    actionChoiceNum: 100,
    skillReward: Skill.NONE,
    skillXPGained: 0,
    rewardItemTokenId: EstforConstants.LOG,
    rewardAmount: 200,
    rewardItemTokenId1: NONE,
    rewardAmount1: 0,
  },
];
export const allQuestsRandomFlags: boolean[] = [false];

type MinRequirement = {
  skill: Skill;
  xp: number;
};

export const defaultMinRequirements: MinRequirement[] = [
  {skill: Skill.NONE, xp: 0},
  {skill: Skill.NONE, xp: 0},
  {skill: Skill.NONE, xp: 0},
];

export const allQuestsMinimumRequirements: MinRequirement[][] = [defaultMinRequirements];
