import {EstforConstants, NONE} from "@paintswap/estfor-definitions";
import {
  ACTIONCHOICE_COOKING_BLEKK,
  ACTIONCHOICE_FIREMAKING_LOG,
  ACTION_COMBAT_NATUOW,
  ACTION_COMBAT_UFFINCH,
  ACTION_THIEVING_MAN,
  BARK_CHUNK,
  COOKED_BLEKK,
  EMERALD,
  GATHERING_BOOST,
  IRON_AXE,
  LOG,
  MAGE_BODY,
  NATUOW_HIDE,
  NATUOW_LEATHER,
  QUEST_ALMS_POOR,
  QUEST_BURNER_WATCH,
  QUEST_BURN_BAN,
  QUEST_HIDDEN_BOUNTY,
  QUEST_NYMPTH_WATCH,
  QUEST_PURSE_STRINGS,
  QUEST_SUPPLY_RUN,
  QUEST_TWO_BIRDS,
  RUBY,
  RUBY_AMULET,
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
  requireActionsCompletedBeforeBurning: boolean;
};

export const allQuests: Quest[] = [
  {
    questId: QUEST_BURN_BAN,
    dependentQuestId: 0,
    actionId: NONE,
    actionNum: 0,
    actionId1: NONE,
    actionNum1: 0,
    actionChoiceId: ACTIONCHOICE_FIREMAKING_LOG,
    actionChoiceNum: 100,
    skillReward: Skill.NONE,
    skillXPGained: 0,
    rewardItemTokenId: LOG,
    rewardAmount: 200,
    rewardItemTokenId1: NONE,
    rewardAmount1: 0,
    burnItemTokenId: NONE,
    burnAmount: 0,
    requireActionsCompletedBeforeBurning: false,
  },
  {
    questId: QUEST_NYMPTH_WATCH,
    dependentQuestId: 0,
    actionId: EstforConstants.ACTION_WOODCUTTING_LOG,
    actionNum: 1000,
    actionId1: NONE,
    actionNum1: 0,
    actionChoiceId: NONE,
    actionChoiceNum: 0,
    skillReward: Skill.WOODCUTTING,
    skillXPGained: 250,
    rewardItemTokenId: IRON_AXE,
    rewardAmount: 2,
    rewardItemTokenId1: NONE,
    rewardAmount1: 0,
    burnItemTokenId: LOG,
    burnAmount: 1000,
    requireActionsCompletedBeforeBurning: false,
  },
  {
    questId: QUEST_SUPPLY_RUN,
    dependentQuestId: 0,
    actionId: ACTION_COMBAT_NATUOW,
    actionNum: 300,
    actionId1: NONE,
    actionNum1: 0,
    actionChoiceId: NONE,
    actionChoiceNum: 0,
    skillReward: Skill.DEFENCE,
    skillXPGained: 250,
    rewardItemTokenId: NATUOW_LEATHER,
    rewardAmount: 100,
    rewardItemTokenId1: NONE,
    rewardAmount1: 0,
    burnItemTokenId: NATUOW_HIDE,
    burnAmount: 1000,
    requireActionsCompletedBeforeBurning: false,
  },
  {
    questId: QUEST_HIDDEN_BOUNTY,
    dependentQuestId: 0,
    actionId: ACTION_THIEVING_MAN,
    actionNum: 10,
    actionId1: NONE,
    actionNum1: 0,
    actionChoiceId: NONE,
    actionChoiceNum: 0,
    skillReward: Skill.THIEVING,
    skillXPGained: 250,
    rewardItemTokenId: RUBY,
    rewardAmount: 1,
    rewardItemTokenId1: EMERALD,
    rewardAmount1: 1,
    burnItemTokenId: NONE,
    burnAmount: 0,
    requireActionsCompletedBeforeBurning: false,
  },
  {
    questId: QUEST_PURSE_STRINGS, // Special one that just involves buying brush
    dependentQuestId: 0,
    actionId: NONE,
    actionNum: 0,
    actionId1: NONE,
    actionNum1: 0,
    actionChoiceId: NONE,
    actionChoiceNum: 0,
    skillReward: Skill.NONE,
    skillXPGained: 0,
    rewardItemTokenId: GATHERING_BOOST,
    rewardAmount: 1,
    rewardItemTokenId1: NONE,
    rewardAmount1: 0,
    burnItemTokenId: NONE,
    burnAmount: 0,
    requireActionsCompletedBeforeBurning: false,
  },
  {
    questId: QUEST_ALMS_POOR,
    dependentQuestId: 0,
    actionId: NONE,
    actionNum: 0,
    actionId1: NONE,
    actionNum1: 0,
    actionChoiceId: ACTIONCHOICE_COOKING_BLEKK,
    actionChoiceNum: 500,
    skillReward: Skill.NONE,
    skillXPGained: 0,
    rewardItemTokenId: EstforConstants.SKILL_BOOST,
    rewardAmount: 3,
    rewardItemTokenId1: NONE,
    rewardAmount1: 0,
    burnItemTokenId: COOKED_BLEKK,
    burnAmount: 500,
    requireActionsCompletedBeforeBurning: true,
  },
  {
    questId: QUEST_BURNER_WATCH,
    dependentQuestId: QUEST_BURN_BAN,
    actionId: NONE,
    actionNum: 0,
    actionId1: NONE,
    actionNum1: 0,
    actionChoiceId: ACTIONCHOICE_FIREMAKING_LOG,
    actionChoiceNum: 2000,
    skillReward: Skill.FIREMAKING,
    skillXPGained: 250,
    rewardItemTokenId: EstforConstants.LEAF_FRAGMENTS,
    rewardAmount: 4,
    rewardItemTokenId1: BARK_CHUNK,
    rewardAmount1: 4,
    burnItemTokenId: NONE,
    burnAmount: 0,
    requireActionsCompletedBeforeBurning: false,
  },
  {
    questId: QUEST_TWO_BIRDS,
    dependentQuestId: QUEST_SUPPLY_RUN,
    actionId: ACTION_COMBAT_UFFINCH,
    actionNum: 900,
    actionId1: NONE,
    actionNum1: 0,
    actionChoiceId: NONE,
    actionChoiceNum: 0,
    skillReward: Skill.MAGIC,
    skillXPGained: 500,
    rewardItemTokenId: MAGE_BODY,
    rewardAmount: 1,
    rewardItemTokenId1: RUBY_AMULET,
    rewardAmount1: 1,
    burnItemTokenId: NONE,
    burnAmount: 0,
    requireActionsCompletedBeforeBurning: false,
  },
];

export const allQuestsRandomFlags: boolean[] = [false, false, false, false, false, false, false, false];

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
  defaultMinRequirements,
  defaultMinRequirements,
  defaultMinRequirements,
  defaultMinRequirements,
  defaultMinRequirements,
];
