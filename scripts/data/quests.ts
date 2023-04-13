import {EstforConstants, NONE} from "@paintswap/estfor-definitions";
import {
  ACTIONCHOICE_COOKING_SKRIMP,
  ACTIONCHOICE_FIREMAKING_LOG,
  COOKED_SKRIMP,
  QUEST_STARTER_FEEDER,
  QUEST_STARTER_FIREMAKING,
  QUEST_STARTER_TRADER,
} from "@paintswap/estfor-definitions/constants";
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
  burnItemTokenId: number;
  burnAmount: number;
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
    burnItemTokenId: NONE,
    burnAmount: 0,
  },
  {
    questId: QUEST_STARTER_TRADER,
    dependentQuestId: 0,
    actionId: NONE,
    actionNum: 0,
    actionId1: NONE,
    actionNum1: 0,
    actionChoiceId: NONE,
    actionChoiceNum: 0,
    skillReward: Skill.NONE,
    skillXPGained: 0,
    rewardItemTokenId: 0,
    rewardAmount: 0,
    rewardItemTokenId1: NONE,
    rewardAmount1: 0,
    burnItemTokenId: NONE,
    burnAmount: 0,
  },
  {
    questId: QUEST_STARTER_FEEDER,
    dependentQuestId: 0,
    actionId: NONE,
    actionNum: 0,
    actionId1: NONE,
    actionNum1: 0,
    actionChoiceId: ACTIONCHOICE_COOKING_SKRIMP,
    actionChoiceNum: 5,
    skillReward: Skill.NONE,
    skillXPGained: 0,
    rewardItemTokenId: 0,
    rewardAmount: 0,
    rewardItemTokenId1: NONE,
    rewardAmount1: 0,
    burnItemTokenId: COOKED_SKRIMP,
    burnAmount: 5,
  },
];

export const allQuestsRandomFlags: boolean[] = [false, false, false];

type MinRequirement = {
  skill: Skill;
  xp: number;
};

type MinRequirementArray = [MinRequirement, MinRequirement, MinRequirement];

export const defaultMinRequirements: [MinRequirement, MinRequirement, MinRequirement] = [
  {skill: Skill.NONE, xp: 0},
  {skill: Skill.NONE, xp: 0},
  {skill: Skill.NONE, xp: 0},
];

export const allQuestsMinimumRequirements: MinRequirementArray[] = [
  defaultMinRequirements,
  defaultMinRequirements,
  defaultMinRequirements,
];
