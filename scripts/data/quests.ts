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
  IRON_BAR,
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
  actionId1: number;
  actionNum1: number;
  actionId2: number;
  actionNum2: number;
  actionChoiceId: number;
  actionChoiceNum: number;
  skillReward: number;
  skillXPGained: number;
  rewardItemTokenId1: number;
  rewardAmount1: number;
  rewardItemTokenId2: number;
  rewardAmount2: number;
  burnItemTokenId: number;
  burnAmount: number;
  requireActionsCompletedBeforeBurning: boolean;
};

export const allQuests: Quest[] = [
  {
    questId: QUEST_BURN_BAN,
    dependentQuestId: 0,
    actionId1: NONE,
    actionNum1: 0,
    actionId2: NONE,
    actionNum2: 0,
    actionChoiceId: ACTIONCHOICE_FIREMAKING_LOG,
    actionChoiceNum: 100,
    skillReward: Skill.NONE,
    skillXPGained: 0,
    rewardItemTokenId1: LOG,
    rewardAmount1: 200,
    rewardItemTokenId2: NONE,
    rewardAmount2: 0,
    burnItemTokenId: NONE,
    burnAmount: 0,
    requireActionsCompletedBeforeBurning: false,
  },
  {
    questId: QUEST_NYMPTH_WATCH,
    dependentQuestId: 0,
    actionId1: EstforConstants.ACTION_WOODCUTTING_LOG,
    actionNum1: 1000,
    actionId2: NONE,
    actionNum2: 0,
    actionChoiceId: NONE,
    actionChoiceNum: 0,
    skillReward: Skill.WOODCUTTING,
    skillXPGained: 250,
    rewardItemTokenId1: IRON_BAR,
    rewardAmount1: 60,
    rewardItemTokenId2: NONE,
    rewardAmount2: 0,
    burnItemTokenId: LOG,
    burnAmount: 1000,
    requireActionsCompletedBeforeBurning: true,
  },
  {
    questId: QUEST_SUPPLY_RUN,
    dependentQuestId: 0,
    actionId1: ACTION_COMBAT_NATUOW,
    actionNum1: 500,
    actionId2: NONE,
    actionNum2: 0,
    actionChoiceId: NONE,
    actionChoiceNum: 0,
    skillReward: Skill.DEFENCE,
    skillXPGained: 250,
    rewardItemTokenId1: NATUOW_LEATHER,
    rewardAmount1: 100,
    rewardItemTokenId2: NONE,
    rewardAmount2: 0,
    burnItemTokenId: NATUOW_HIDE,
    burnAmount: 500,
    requireActionsCompletedBeforeBurning: true,
  },
  {
    questId: QUEST_HIDDEN_BOUNTY,
    dependentQuestId: 0,
    actionId1: ACTION_THIEVING_MAN,
    actionNum1: 10,
    actionId2: NONE,
    actionNum2: 0,
    actionChoiceId: NONE,
    actionChoiceNum: 0,
    skillReward: Skill.THIEVING,
    skillXPGained: 250,
    rewardItemTokenId1: RUBY,
    rewardAmount1: 1,
    rewardItemTokenId2: EMERALD,
    rewardAmount2: 1,
    burnItemTokenId: NONE,
    burnAmount: 0,
    requireActionsCompletedBeforeBurning: false,
  },
  {
    questId: QUEST_PURSE_STRINGS, // Special one that just involves buying brush
    dependentQuestId: 0,
    actionId1: NONE,
    actionNum1: 0,
    actionId2: NONE,
    actionNum2: 0,
    actionChoiceId: NONE,
    actionChoiceNum: 0,
    skillReward: Skill.NONE,
    skillXPGained: 0,
    rewardItemTokenId1: GATHERING_BOOST,
    rewardAmount1: 1,
    rewardItemTokenId2: NONE,
    rewardAmount2: 0,
    burnItemTokenId: NONE,
    burnAmount: 0,
    requireActionsCompletedBeforeBurning: false,
  },
  {
    questId: QUEST_ALMS_POOR,
    dependentQuestId: 0,
    actionId1: NONE,
    actionNum1: 0,
    actionId2: NONE,
    actionNum2: 0,
    actionChoiceId: ACTIONCHOICE_COOKING_BLEKK,
    actionChoiceNum: 500,
    skillReward: Skill.NONE,
    skillXPGained: 0,
    rewardItemTokenId1: EstforConstants.SKILL_BOOST,
    rewardAmount1: 3,
    rewardItemTokenId2: NONE,
    rewardAmount2: 0,
    burnItemTokenId: COOKED_BLEKK,
    burnAmount: 500,
    requireActionsCompletedBeforeBurning: true,
  },
  {
    questId: QUEST_BURNER_WATCH,
    dependentQuestId: QUEST_BURN_BAN,
    actionId1: NONE,
    actionNum1: 0,
    actionId2: NONE,
    actionNum2: 0,
    actionChoiceId: ACTIONCHOICE_FIREMAKING_LOG,
    actionChoiceNum: 2000,
    skillReward: Skill.FIREMAKING,
    skillXPGained: 250,
    rewardItemTokenId1: EstforConstants.LEAF_FRAGMENTS,
    rewardAmount1: 4,
    rewardItemTokenId2: BARK_CHUNK,
    rewardAmount2: 4,
    burnItemTokenId: NONE,
    burnAmount: 0,
    requireActionsCompletedBeforeBurning: false,
  },
  {
    questId: QUEST_TWO_BIRDS,
    dependentQuestId: QUEST_SUPPLY_RUN,
    actionId1: ACTION_COMBAT_UFFINCH,
    actionNum1: 900,
    actionId2: NONE,
    actionNum2: 0,
    actionChoiceId: NONE,
    actionChoiceNum: 0,
    skillReward: Skill.MAGIC,
    skillXPGained: 500,
    rewardItemTokenId1: MAGE_BODY,
    rewardAmount1: 1,
    rewardItemTokenId2: RUBY_AMULET,
    rewardAmount2: 1,
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
