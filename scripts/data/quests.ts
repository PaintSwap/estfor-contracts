import {EstforConstants, NONE} from "@paintswap/estfor-definitions";
import {
  ADAMANTINE_ORE,
  COAL_ORE,
  EMERALD,
  IRON_BAR,
  LOG,
  MITHRIL_ARMOR,
  MITHRIL_PICKAXE,
  NATUOW_HIDE,
  NATUOW_LEATHER,
  RUBY
} from "@paintswap/estfor-definitions/constants";
import {Skill} from "@paintswap/estfor-definitions/types";

export type QuestInput = {
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
  isFullModeOnly: boolean;
  worldLocation: number;
};

export const allQuests: QuestInput[] = [
  {
    questId: EstforConstants.QUEST_BURN_BAN,
    dependentQuestId: 0,
    actionId1: NONE,
    actionNum1: 0,
    actionId2: NONE,
    actionNum2: 0,
    actionChoiceId: EstforConstants.ACTIONCHOICE_FIREMAKING_LOG,
    actionChoiceNum: 100,
    skillReward: Skill.NONE,
    skillXPGained: 0,
    rewardItemTokenId1: LOG,
    rewardAmount1: 200,
    rewardItemTokenId2: NONE,
    rewardAmount2: 0,
    burnItemTokenId: NONE,
    burnAmount: 0,
    isFullModeOnly: false,
    worldLocation: 0
  },
  {
    questId: EstforConstants.QUEST_NYMPTH_WATCH,
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
    isFullModeOnly: false,
    worldLocation: 0
  },
  {
    questId: EstforConstants.QUEST_SUPPLY_RUN,
    dependentQuestId: 0,
    actionId1: EstforConstants.ACTION_COMBAT_NATUOW,
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
    isFullModeOnly: false,
    worldLocation: 0
  },
  {
    questId: EstforConstants.QUEST_HIDDEN_BOUNTY,
    dependentQuestId: 0,
    actionId1: EstforConstants.ACTION_THIEVING_MAN,
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
    isFullModeOnly: false,
    worldLocation: 0
  },
  {
    questId: EstforConstants.QUEST_PURSE_STRINGS, // Special one that just involves buying brush
    dependentQuestId: 0,
    actionId1: NONE,
    actionNum1: 0,
    actionId2: NONE,
    actionNum2: 0,
    actionChoiceId: NONE,
    actionChoiceNum: 0,
    skillReward: Skill.HEALTH,
    skillXPGained: 100,
    rewardItemTokenId1: NONE,
    rewardAmount1: 0,
    rewardItemTokenId2: NONE,
    rewardAmount2: 0,
    burnItemTokenId: NONE,
    burnAmount: 0,
    isFullModeOnly: false,
    worldLocation: 0
  },
  {
    questId: EstforConstants.QUEST_ALMS_POOR,
    dependentQuestId: 0,
    actionId1: NONE,
    actionNum1: 0,
    actionId2: NONE,
    actionNum2: 0,
    actionChoiceId: EstforConstants.ACTIONCHOICE_COOKING_BLEKK,
    actionChoiceNum: 500,
    skillReward: Skill.NONE,
    skillXPGained: 0,
    rewardItemTokenId1: EstforConstants.SKILL_BOOST,
    rewardAmount1: 3,
    rewardItemTokenId2: NONE,
    rewardAmount2: 0,
    burnItemTokenId: EstforConstants.COOKED_BLEKK,
    burnAmount: 500,
    isFullModeOnly: false,
    worldLocation: 0
  },
  {
    questId: EstforConstants.QUEST_BURNER_WATCH,
    dependentQuestId: EstforConstants.QUEST_BURN_BAN,
    actionId1: NONE,
    actionNum1: 0,
    actionId2: NONE,
    actionNum2: 0,
    actionChoiceId: EstforConstants.ACTIONCHOICE_FIREMAKING_LOG,
    actionChoiceNum: 2000,
    skillReward: Skill.FIREMAKING,
    skillXPGained: 250,
    rewardItemTokenId1: EstforConstants.LEAF_FRAGMENTS,
    rewardAmount1: 4,
    rewardItemTokenId2: EstforConstants.BARK_CHUNK,
    rewardAmount2: 4,
    burnItemTokenId: NONE,
    burnAmount: 0,
    isFullModeOnly: false,
    worldLocation: 0
  },
  {
    questId: EstforConstants.QUEST_TWO_BIRDS,
    dependentQuestId: EstforConstants.QUEST_SUPPLY_RUN,
    actionId1: EstforConstants.ACTION_COMBAT_UFFINCH,
    actionNum1: 900,
    actionId2: NONE,
    actionNum2: 0,
    actionChoiceId: NONE,
    actionChoiceNum: 0,
    skillReward: Skill.MAGIC,
    skillXPGained: 500,
    rewardItemTokenId1: EstforConstants.MAGE_BODY,
    rewardAmount1: 1,
    rewardItemTokenId2: EstforConstants.RUBY_AMULET,
    rewardAmount2: 1,
    burnItemTokenId: NONE,
    burnAmount: 0,
    isFullModeOnly: false,
    worldLocation: 0
  },
  {
    questId: EstforConstants.QUEST_APPRENTICESHIP,
    dependentQuestId: NONE,
    actionId1: NONE,
    actionNum1: 0,
    actionId2: NONE,
    actionNum2: 0,
    actionChoiceId: EstforConstants.ACTIONCHOICE_CRAFTING_NATUOW_LEATHER,
    actionChoiceNum: 500,
    skillReward: Skill.CRAFTING,
    skillXPGained: 750,
    rewardItemTokenId1: NONE,
    rewardAmount1: 0,
    rewardItemTokenId2: NONE,
    rewardAmount2: 0,
    burnItemTokenId: NONE,
    burnAmount: 0,
    isFullModeOnly: false,
    worldLocation: 0
  },
  {
    questId: EstforConstants.QUEST_TOWN_COOKOUT,
    dependentQuestId: NONE,
    actionId1: EstforConstants.ACTION_FISHING_SKRIMP,
    actionNum1: 5000,
    actionId2: NONE,
    actionNum2: 0,
    actionChoiceId: NONE,
    actionChoiceNum: 0,
    skillReward: Skill.FISHING,
    skillXPGained: 2250,
    rewardItemTokenId1: NONE,
    rewardAmount1: 0,
    rewardItemTokenId2: NONE,
    rewardAmount2: 0,
    burnItemTokenId: EstforConstants.RAW_SKRIMP,
    burnAmount: 5000,
    isFullModeOnly: false,
    worldLocation: 0
  },
  {
    questId: EstforConstants.QUEST_IRON_AGE,
    dependentQuestId: NONE,
    actionId1: NONE,
    actionNum1: 0,
    actionId2: NONE,
    actionNum2: 0,
    actionChoiceId: EstforConstants.ACTIONCHOICE_SMITHING_IRON_BAR,
    actionChoiceNum: 7500,
    skillReward: Skill.SMITHING,
    skillXPGained: 1500,
    rewardItemTokenId1: EstforConstants.MITHRIL_ARMOR,
    rewardAmount1: 1,
    rewardItemTokenId2: EstforConstants.MITHRIL_TASSETS,
    rewardAmount2: 1,
    burnItemTokenId: EstforConstants.IRON_BAR,
    burnAmount: 7500,
    isFullModeOnly: false,
    worldLocation: 0
  },
  {
    questId: EstforConstants.QUEST_CLEAR_SKIES,
    dependentQuestId: EstforConstants.QUEST_TWO_BIRDS,
    actionId1: EstforConstants.ACTION_COMBAT_QUARTZ_EAGLE,
    actionNum1: 300,
    actionId2: NONE,
    actionNum2: 0,
    actionChoiceId: NONE,
    actionChoiceNum: 0,
    skillReward: Skill.HEALTH,
    skillXPGained: 1200,
    rewardItemTokenId1: NONE,
    rewardAmount1: 0,
    rewardItemTokenId2: NONE,
    rewardAmount2: 0,
    burnItemTokenId: NONE,
    burnAmount: 0,
    isFullModeOnly: false,
    worldLocation: 0
  },
  {
    questId: EstforConstants.QUEST_MEADERY_MADNESS,
    dependentQuestId: EstforConstants.QUEST_NYMPTH_WATCH,
    actionId1: EstforConstants.ACTION_WOODCUTTING_WILLOW,
    actionNum1: 3000,
    actionId2: NONE,
    actionNum2: 0,
    actionChoiceId: NONE,
    actionChoiceNum: 0,
    skillReward: Skill.WOODCUTTING,
    skillXPGained: 1500,
    rewardItemTokenId1: NONE,
    rewardAmount1: 0,
    rewardItemTokenId2: NONE,
    rewardAmount2: 0,
    burnItemTokenId: NONE,
    burnAmount: 0,
    isFullModeOnly: false,
    worldLocation: 0
  },
  {
    questId: EstforConstants.QUEST_FOREST_FIRE,
    dependentQuestId: EstforConstants.QUEST_BURNER_WATCH,
    actionId1: NONE,
    actionNum1: 0,
    actionId2: NONE,
    actionNum2: 0,
    actionChoiceId: EstforConstants.ACTIONCHOICE_FIREMAKING_OAK,
    actionChoiceNum: 3000,
    skillReward: Skill.FIREMAKING,
    skillXPGained: 1350,
    rewardItemTokenId1: NONE,
    rewardAmount1: 0,
    rewardItemTokenId2: NONE,
    rewardAmount2: 0,
    burnItemTokenId: NONE,
    burnAmount: 0,
    isFullModeOnly: false,
    worldLocation: 0
  },
  {
    questId: EstforConstants.QUEST_MITHRIL_MILITIA,
    dependentQuestId: EstforConstants.QUEST_IRON_AGE,
    actionId1: NONE,
    actionNum1: 0,
    actionId2: NONE,
    actionNum2: 0,
    actionChoiceId: EstforConstants.ACTIONCHOICE_SMITHING_MITHRIL_ARMOR,
    actionChoiceNum: 25,
    skillReward: Skill.SMITHING,
    skillXPGained: 5000,
    rewardItemTokenId1: NONE,
    rewardAmount1: 0,
    rewardItemTokenId2: NONE,
    rewardAmount2: 0,
    burnItemTokenId: MITHRIL_ARMOR,
    burnAmount: 25,
    isFullModeOnly: false,
    worldLocation: 0
  },
  {
    questId: EstforConstants.QUEST_MINOR_MINERS,
    dependentQuestId: EstforConstants.QUEST_APPRENTICESHIP,
    actionId1: NONE,
    actionNum1: 0,
    actionId2: NONE,
    actionNum2: 0,
    actionChoiceId: EstforConstants.ACTIONCHOICE_CRAFTING_MITHRIL_PICKAXE,
    actionChoiceNum: 12,
    skillReward: Skill.CRAFTING,
    skillXPGained: 2000,
    rewardItemTokenId1: ADAMANTINE_ORE,
    rewardAmount1: 150,
    rewardItemTokenId2: COAL_ORE,
    rewardAmount2: 450,
    burnItemTokenId: MITHRIL_PICKAXE,
    burnAmount: 12,
    isFullModeOnly: false,
    worldLocation: 0
  },
  {
    questId: EstforConstants.QUEST_SO_FLETCH,
    dependentQuestId: NONE,
    actionId1: NONE,
    actionNum1: 0,
    actionId2: NONE,
    actionNum2: 0,
    actionChoiceId: EstforConstants.ACTIONCHOICE_FLETCHING_ARROW_SHAFT_FROM_LOG,
    actionChoiceNum: 9600,
    skillReward: Skill.FLETCHING,
    skillXPGained: 250,
    rewardItemTokenId1: NONE,
    rewardAmount1: 0,
    rewardItemTokenId2: NONE,
    rewardAmount2: 0,
    burnItemTokenId: NONE,
    burnAmount: 0,
    isFullModeOnly: true,
    worldLocation: 0
  },
  {
    questId: EstforConstants.QUEST_ENTER_THE_VEIL,
    dependentQuestId: NONE,
    actionId1: NONE,
    actionNum1: 0,
    actionId2: NONE,
    actionNum2: 0,
    actionChoiceId: EstforConstants.ACTIONCHOICE_ALCHEMY_PAPER_FROM_LOG,
    actionChoiceNum: 14400,
    skillReward: Skill.ALCHEMY,
    skillXPGained: 900,
    rewardItemTokenId1: NONE,
    rewardAmount1: 0,
    rewardItemTokenId2: NONE,
    rewardAmount2: 0,
    burnItemTokenId: NONE,
    burnAmount: 0,
    isFullModeOnly: true,
    worldLocation: 0
  },
  {
    questId: EstforConstants.QUEST_FORGE_AHEAD,
    dependentQuestId: NONE,
    actionId1: NONE,
    actionNum1: 0,
    actionId2: NONE,
    actionNum2: 0,
    actionChoiceId: EstforConstants.ACTIONCHOICE_FORGING_MERGE_TINY_ELIXIUM,
    actionChoiceNum: 240,
    skillReward: Skill.FORGING,
    skillXPGained: 200,
    rewardItemTokenId1: NONE,
    rewardAmount1: 0,
    rewardItemTokenId2: NONE,
    rewardAmount2: 0,
    burnItemTokenId: NONE,
    burnAmount: 0,
    isFullModeOnly: true,
    worldLocation: 0
  },
  {
    questId: EstforConstants.QUEST_HEART_STRINGS,
    dependentQuestId: EstforConstants.QUEST_SO_FLETCH,
    actionId1: NONE,
    actionNum1: 0,
    actionId2: NONE,
    actionNum2: 0,
    actionChoiceId: EstforConstants.ACTIONCHOICE_FLETCHING_IRON_ARROW,
    actionChoiceNum: 7200,
    skillReward: Skill.FLETCHING,
    skillXPGained: 1800,
    rewardItemTokenId1: NONE,
    rewardAmount1: 0,
    rewardItemTokenId2: NONE,
    rewardAmount2: 0,
    burnItemTokenId: NONE,
    burnAmount: 0,
    isFullModeOnly: true,
    worldLocation: 0
  },
  {
    questId: EstforConstants.QUEST_ALCHEMICAL_PROWESS,
    dependentQuestId: EstforConstants.QUEST_ENTER_THE_VEIL,
    actionId1: NONE,
    actionNum1: 0,
    actionId2: NONE,
    actionNum2: 0,
    actionChoiceId: EstforConstants.ACTIONCHOICE_ALCHEMY_SHADOW_SCROLL,
    actionChoiceNum: 14400,
    skillReward: Skill.ALCHEMY,
    skillXPGained: 1800,
    rewardItemTokenId1: EstforConstants.BONEMEAL,
    rewardAmount1: 250,
    rewardItemTokenId2: NONE,
    rewardAmount2: 0,
    burnItemTokenId: NONE,
    burnAmount: 0,
    isFullModeOnly: true,
    worldLocation: 0
  },
  {
    questId: EstforConstants.QUEST_NEW_ALCHEMY,
    dependentQuestId: EstforConstants.QUEST_ENTER_THE_VEIL,
    actionId1: NONE,
    actionNum1: 0,
    actionId2: NONE,
    actionNum2: 0,
    actionChoiceId: EstforConstants.ACTIONCHOICE_ALCHEMY_IRON_ORE,
    actionChoiceNum: 50,
    skillReward: Skill.ALCHEMY,
    skillXPGained: 1800,
    rewardItemTokenId1: NONE,
    rewardAmount1: 0,
    rewardItemTokenId2: NONE,
    rewardAmount2: 0,
    burnItemTokenId: NONE,
    burnAmount: 0,
    isFullModeOnly: true,
    worldLocation: 0
  },
  {
    questId: EstforConstants.QUEST_FLEX_THE_BOW,
    dependentQuestId: EstforConstants.QUEST_HEART_STRINGS,
    actionId1: NONE,
    actionNum1: 0,
    actionId2: NONE,
    actionNum2: 0,
    actionChoiceId: EstforConstants.ACTIONCHOICE_FLETCHING_EXPERT_BOW,
    actionChoiceNum: 1,
    skillReward: Skill.FLETCHING,
    skillXPGained: 500,
    rewardItemTokenId1: EstforConstants.MITHRIL_ARROW,
    rewardAmount1: 250,
    rewardItemTokenId2: NONE,
    rewardAmount2: 0,
    burnItemTokenId: NONE,
    burnAmount: 0,
    isFullModeOnly: true,
    worldLocation: 0
  },
  {
    questId: EstforConstants.QUEST_DRAGON_SLAYER,
    dependentQuestId: EstforConstants.QUEST_CLEAR_SKIES,
    actionId1: EstforConstants.ACTION_COMBAT_ELEMENTAL_DRAGON,
    actionNum1: 50,
    actionId2: NONE,
    actionNum2: 0,
    actionChoiceId: 0,
    actionChoiceNum: 0,
    skillReward: Skill.HEALTH,
    skillXPGained: 2000,
    rewardItemTokenId1: EstforConstants.NONE,
    rewardAmount1: 0,
    rewardItemTokenId2: NONE,
    rewardAmount2: 0,
    burnItemTokenId: NONE,
    burnAmount: 0,
    isFullModeOnly: true,
    worldLocation: 0
  },

  {
    questId: EstforConstants.QUEST_WAY_OF_THE_AXE,
    dependentQuestId: EstforConstants.QUEST_NYMPTH_WATCH,
    actionId1: EstforConstants.ACTION_WOODCUTTING_SECLUDED_FOREST,
    actionNum1: 2880,
    actionId2: NONE,
    actionNum2: 0,
    actionChoiceId: 0,
    actionChoiceNum: 0,
    skillReward: Skill.WOODCUTTING,
    skillXPGained: 550,
    rewardItemTokenId1: EstforConstants.NATURE_KEY,
    rewardAmount1: 10,
    rewardItemTokenId2: NONE,
    rewardAmount2: 0,
    burnItemTokenId: NONE,
    burnAmount: 0,
    isFullModeOnly: true,
    worldLocation: 0
  },
  {
    questId: EstforConstants.QUEST_WAY_OF_THE_AXE_II,
    dependentQuestId: EstforConstants.QUEST_WAY_OF_THE_AXE,
    actionId1: EstforConstants.ACTION_WOODCUTTING_THE_WOODLANDS,
    actionNum1: 2880,
    actionId2: NONE,
    actionNum2: 0,
    actionChoiceId: 0,
    actionChoiceNum: 0,
    skillReward: Skill.WOODCUTTING,
    skillXPGained: 910,
    rewardItemTokenId1: EstforConstants.NATURE_KEY,
    rewardAmount1: 20,
    rewardItemTokenId2: NONE,
    rewardAmount2: 0,
    burnItemTokenId: NONE,
    burnAmount: 0,
    isFullModeOnly: true,
    worldLocation: 0
  },
  {
    questId: EstforConstants.QUEST_WAY_OF_THE_AXE_III,
    dependentQuestId: EstforConstants.QUEST_WAY_OF_THE_AXE_II,
    actionId1: EstforConstants.ACTION_WOODCUTTING_CURSED_MOUNTAIN,
    actionNum1: 2592,
    actionId2: NONE,
    actionNum2: 0,
    actionChoiceId: 0,
    actionChoiceNum: 0,
    skillReward: Skill.WOODCUTTING,
    skillXPGained: 1810,
    rewardItemTokenId1: EstforConstants.NATURE_KEY,
    rewardAmount1: 30,
    rewardItemTokenId2: NONE,
    rewardAmount2: 0,
    burnItemTokenId: NONE,
    burnAmount: 0,
    isFullModeOnly: true,
    worldLocation: 0
  },
  {
    questId: EstforConstants.QUEST_WAY_OF_THE_AXE_IV,
    dependentQuestId: EstforConstants.QUEST_WAY_OF_THE_AXE_III,
    actionId1: EstforConstants.ACTION_WOODCUTTING_ENCHANTED_GROVE,
    actionNum1: 2400,
    actionId2: NONE,
    actionNum2: 0,
    actionChoiceId: 0,
    actionChoiceNum: 0,
    skillReward: Skill.WOODCUTTING,
    skillXPGained: 5100,
    rewardItemTokenId1: EstforConstants.NATURE_KEY,
    rewardAmount1: 40,
    rewardItemTokenId2: NONE,
    rewardAmount2: 0,
    burnItemTokenId: NONE,
    burnAmount: 0,
    isFullModeOnly: true,
    worldLocation: 0
  },
  {
    questId: EstforConstants.QUEST_WAY_OF_THE_AXE_V,
    dependentQuestId: EstforConstants.QUEST_WAY_OF_THE_AXE_IV,
    actionId1: EstforConstants.ACTION_WOODCUTTING_WHISPERING_WOODS,
    actionNum1: 4200,
    actionId2: NONE,
    actionNum2: 0,
    actionChoiceId: 0,
    actionChoiceNum: 0,
    skillReward: Skill.WOODCUTTING,
    skillXPGained: 24550,
    rewardItemTokenId1: EstforConstants.NATURE_KEY,
    rewardAmount1: 50,
    rewardItemTokenId2: NONE,
    rewardAmount2: 0,
    burnItemTokenId: NONE,
    burnAmount: 0,
    isFullModeOnly: true,
    worldLocation: 0
  },
  {
    questId: EstforConstants.QUEST_WAY_OF_THE_PICKAXE,
    dependentQuestId: EstforConstants.NONE,
    actionId1: EstforConstants.ACTION_MINING_TIN_MOTHERLODE,
    actionNum1: 1920,
    actionId2: NONE,
    actionNum2: 0,
    actionChoiceId: 0,
    actionChoiceNum: 0,
    skillReward: Skill.MINING,
    skillXPGained: 1100,
    rewardItemTokenId1: EstforConstants.NATURE_KEY,
    rewardAmount1: 10,
    rewardItemTokenId2: NONE,
    rewardAmount2: 0,
    burnItemTokenId: NONE,
    burnAmount: 0,
    isFullModeOnly: true,
    worldLocation: 0
  },
  {
    questId: EstforConstants.QUEST_WAY_OF_THE_PICKAXE_II,
    dependentQuestId: EstforConstants.QUEST_WAY_OF_THE_PICKAXE,
    actionId1: EstforConstants.ACTION_MINING_MITHRIL_MOTHERLODE,
    actionNum1: 2160,
    actionId2: NONE,
    actionNum2: 0,
    actionChoiceId: 0,
    actionChoiceNum: 0,
    skillReward: Skill.MINING,
    skillXPGained: 8700,
    rewardItemTokenId1: EstforConstants.NATURE_KEY,
    rewardAmount1: 20,
    rewardItemTokenId2: NONE,
    rewardAmount2: 0,
    burnItemTokenId: NONE,
    burnAmount: 0,
    isFullModeOnly: true,
    worldLocation: 0
  },
  {
    questId: EstforConstants.QUEST_WAY_OF_THE_PICKAXE_III,
    dependentQuestId: EstforConstants.QUEST_WAY_OF_THE_PICKAXE_II,
    actionId1: EstforConstants.ACTION_MINING_ADAMANTINE_MOTHERLODE,
    actionNum1: 3000,
    actionId2: NONE,
    actionNum2: 0,
    actionChoiceId: 0,
    actionChoiceNum: 0,
    skillReward: Skill.MINING,
    skillXPGained: 8030,
    rewardItemTokenId1: EstforConstants.NATURE_KEY,
    rewardAmount1: 30,
    rewardItemTokenId2: NONE,
    rewardAmount2: 0,
    burnItemTokenId: NONE,
    burnAmount: 0,
    isFullModeOnly: true,
    worldLocation: 0
  },
  {
    questId: EstforConstants.QUEST_WAY_OF_THE_PICKAXE_IV,
    dependentQuestId: EstforConstants.QUEST_WAY_OF_THE_PICKAXE_III,
    actionId1: EstforConstants.ACTION_MINING_RUNITE_MOTHERLODE,
    actionNum1: 5400,
    actionId2: NONE,
    actionNum2: 0,
    actionChoiceId: 0,
    actionChoiceNum: 0,
    skillReward: Skill.MINING,
    skillXPGained: 40640,
    rewardItemTokenId1: EstforConstants.NATURE_KEY,
    rewardAmount1: 40,
    rewardItemTokenId2: NONE,
    rewardAmount2: 0,
    burnItemTokenId: NONE,
    burnAmount: 0,
    isFullModeOnly: true,
    worldLocation: 0
  },
  {
    questId: EstforConstants.QUEST_WAY_OF_THE_PICKAXE_V,
    dependentQuestId: EstforConstants.QUEST_WAY_OF_THE_PICKAXE_IV,
    actionId1: EstforConstants.ACTION_MINING_TITANIUM_MOTHERLODE,
    actionNum1: 3360,
    actionId2: NONE,
    actionNum2: 0,
    actionChoiceId: 0,
    actionChoiceNum: 0,
    skillReward: Skill.MINING,
    skillXPGained: 57500,
    rewardItemTokenId1: EstforConstants.NATURE_KEY,
    rewardAmount1: 50,
    rewardItemTokenId2: NONE,
    rewardAmount2: 0,
    burnItemTokenId: NONE,
    burnAmount: 0,
    isFullModeOnly: true,
    worldLocation: 0
  },
  {
    questId: EstforConstants.QUEST_BAIT_AND_STRING,
    dependentQuestId: EstforConstants.QUEST_TOWN_COOKOUT,
    actionId1: EstforConstants.ACTION_FISHING_HIDDEN_POND,
    actionNum1: 960,
    actionId2: NONE,
    actionNum2: 0,
    actionChoiceId: 0,
    actionChoiceNum: 0,
    skillReward: Skill.FISHING,
    skillXPGained: 230,
    rewardItemTokenId1: EstforConstants.AQUA_KEY,
    rewardAmount1: 10,
    rewardItemTokenId2: NONE,
    rewardAmount2: 0,
    burnItemTokenId: NONE,
    burnAmount: 0,
    isFullModeOnly: true,
    worldLocation: 0
  },
  {
    questId: EstforConstants.QUEST_BAIT_AND_STRING_II,
    dependentQuestId: EstforConstants.QUEST_BAIT_AND_STRING,
    actionId1: EstforConstants.ACTION_FISHING_SECRET_LAKE,
    actionNum1: 960,
    actionId2: NONE,
    actionNum2: 0,
    actionChoiceId: 0,
    actionChoiceNum: 0,
    skillReward: Skill.FISHING,
    skillXPGained: 2200,
    rewardItemTokenId1: EstforConstants.AQUA_KEY,
    rewardAmount1: 20,
    rewardItemTokenId2: NONE,
    rewardAmount2: 0,
    burnItemTokenId: NONE,
    burnAmount: 0,
    isFullModeOnly: true,
    worldLocation: 0
  },
  {
    questId: EstforConstants.QUEST_BAIT_AND_STRING_III,
    dependentQuestId: EstforConstants.QUEST_BAIT_AND_STRING_II,
    actionId1: EstforConstants.ACTION_FISHING_ENCHANTED_LAGOON,
    actionNum1: 1080,
    actionId2: NONE,
    actionNum2: 0,
    actionChoiceId: 0,
    actionChoiceNum: 0,
    skillReward: Skill.FISHING,
    skillXPGained: 3600,
    rewardItemTokenId1: EstforConstants.AQUA_KEY,
    rewardAmount1: 30,
    rewardItemTokenId2: NONE,
    rewardAmount2: 0,
    burnItemTokenId: NONE,
    burnAmount: 0,
    isFullModeOnly: true,
    worldLocation: 0
  },
  {
    questId: EstforConstants.QUEST_BAIT_AND_STRING_IV,
    dependentQuestId: EstforConstants.QUEST_BAIT_AND_STRING_III,
    actionId1: EstforConstants.ACTION_FISHING_UNDERGROUND_RIVER,
    actionNum1: 1920,
    actionId2: NONE,
    actionNum2: 0,
    actionChoiceId: 0,
    actionChoiceNum: 0,
    skillReward: Skill.FISHING,
    skillXPGained: 20300,
    rewardItemTokenId1: EstforConstants.AQUA_KEY,
    rewardAmount1: 40,
    rewardItemTokenId2: NONE,
    rewardAmount2: 0,
    burnItemTokenId: NONE,
    burnAmount: 0,
    isFullModeOnly: true,
    worldLocation: 0
  },
  {
    questId: EstforConstants.QUEST_BAIT_AND_STRING_V,
    dependentQuestId: EstforConstants.QUEST_BAIT_AND_STRING_IV,
    actionId1: EstforConstants.ACTION_FISHING_DEEP_SEA,
    actionNum1: 2016,
    actionId2: NONE,
    actionNum2: 0,
    actionChoiceId: 0,
    actionChoiceNum: 0,
    skillReward: Skill.FISHING,
    skillXPGained: 31300,
    rewardItemTokenId1: EstforConstants.AQUA_KEY,
    rewardAmount1: 50,
    rewardItemTokenId2: NONE,
    rewardAmount2: 0,
    burnItemTokenId: NONE,
    burnAmount: 0,
    isFullModeOnly: true,
    worldLocation: 0
  },
  {
    questId: EstforConstants.QUEST_FIRE_AND_ICE,
    dependentQuestId: EstforConstants.QUEST_SUPPLY_RUN,
    actionId1: EstforConstants.ACTION_COMBAT_EMBER_WHELP,
    actionNum1: 2500,
    actionId2: NONE,
    actionNum2: 0,
    actionChoiceId: 0,
    actionChoiceNum: 0,
    skillReward: Skill.HEALTH,
    skillXPGained: 250,
    rewardItemTokenId1: EstforConstants.MINING_CHEST_2,
    rewardAmount1: 10,
    rewardItemTokenId2: NONE,
    rewardAmount2: 0,
    burnItemTokenId: NONE,
    burnAmount: 0,
    isFullModeOnly: true,
    worldLocation: 0
  },
  {
    questId: EstforConstants.QUEST_FIRE_AND_ICE_II,
    dependentQuestId: EstforConstants.QUEST_FIRE_AND_ICE,
    actionId1: EstforConstants.ACTION_COMBAT_JUVENILE_CAVE_FAIRY,
    actionNum1: 2500,
    actionId2: NONE,
    actionNum2: 0,
    actionChoiceId: 0,
    actionChoiceNum: 0,
    skillReward: Skill.HEALTH,
    skillXPGained: 500,
    rewardItemTokenId1: EstforConstants.FISHING_CHEST_3,
    rewardAmount1: 10,
    rewardItemTokenId2: NONE,
    rewardAmount2: 0,
    burnItemTokenId: NONE,
    burnAmount: 0,
    isFullModeOnly: true,
    worldLocation: 0
  },
  {
    questId: EstforConstants.QUEST_FIRE_AND_ICE_III,
    dependentQuestId: EstforConstants.QUEST_FIRE_AND_ICE_II,
    actionId1: EstforConstants.ACTION_COMBAT_CAVE_FAIRY,
    actionNum1: 2000,
    actionId2: NONE,
    actionNum2: 0,
    actionChoiceId: 0,
    actionChoiceNum: 0,
    skillReward: Skill.HEALTH,
    skillXPGained: 1000,
    rewardItemTokenId1: EstforConstants.WOODCUTTING_CHEST_4,
    rewardAmount1: 10,
    rewardItemTokenId2: EstforConstants.FISHING_CHEST_4,
    rewardAmount2: 10,
    burnItemTokenId: NONE,
    burnAmount: 0,
    isFullModeOnly: true,
    worldLocation: 0
  },

  {
    questId: EstforConstants.QUEST_FIRE_AND_ICE_IV,
    dependentQuestId: EstforConstants.QUEST_FIRE_AND_ICE_III,
    actionId1: EstforConstants.ACTION_COMBAT_ICE_TROLL,
    actionNum1: 1500,
    actionId2: NONE,
    actionNum2: 0,
    actionChoiceId: 0,
    actionChoiceNum: 0,
    skillReward: Skill.HEALTH,
    skillXPGained: 2000,
    rewardItemTokenId1: EstforConstants.BONE_CHEST,
    rewardAmount1: 5,
    rewardItemTokenId2: NONE,
    rewardAmount2: 0,
    burnItemTokenId: NONE,
    burnAmount: 0,
    isFullModeOnly: true,
    worldLocation: 0
  },
  {
    questId: EstforConstants.QUEST_FIRE_AND_ICE_V,
    dependentQuestId: EstforConstants.QUEST_FIRE_AND_ICE_IV,
    actionId1: EstforConstants.ACTION_COMBAT_BLAZING_MONTANITE,
    actionNum1: 1000,
    actionId2: NONE,
    actionNum2: 0,
    actionChoiceId: 0,
    actionChoiceNum: 0,
    skillReward: Skill.HEALTH,
    skillXPGained: 4000,
    rewardItemTokenId1: EstforConstants.DRAGON_CHEST,
    rewardAmount1: 5,
    rewardItemTokenId2: NONE,
    rewardAmount2: 0,
    burnItemTokenId: NONE,
    burnAmount: 0,
    isFullModeOnly: true,
    worldLocation: 0
  },
  {
    questId: EstforConstants.QUEST_FIRE_AND_ICE_VI,
    dependentQuestId: EstforConstants.QUEST_FIRE_AND_ICE_V,
    actionId1: EstforConstants.ACTION_COMBAT_MONTANITE_ICE_TITAN,
    actionNum1: 300,
    actionId2: NONE,
    actionNum2: 0,
    actionChoiceId: 0,
    actionChoiceNum: 0,
    skillReward: Skill.HEALTH,
    skillXPGained: 8000,
    rewardItemTokenId1: EstforConstants.DRAGON_CHEST,
    rewardAmount1: 5,
    rewardItemTokenId2: EstforConstants.BONE_CHEST,
    rewardAmount2: 5,
    burnItemTokenId: NONE,
    burnAmount: 0,
    isFullModeOnly: true,
    worldLocation: 0
  },
  {
    questId: EstforConstants.QUEST_FIRE_AND_ICE_VII,
    dependentQuestId: EstforConstants.QUEST_FIRE_AND_ICE_VI,
    actionId1: EstforConstants.ACTION_COMBAT_MONTANITE_FIRE_TITAN,
    actionNum1: 300,
    actionId2: NONE,
    actionNum2: 0,
    actionChoiceId: 0,
    actionChoiceNum: 0,
    skillReward: Skill.HEALTH,
    skillXPGained: 16000,
    rewardItemTokenId1: EstforConstants.DRAGON_CHEST,
    rewardAmount1: 10,
    rewardItemTokenId2: EstforConstants.BONE_CHEST,
    rewardAmount2: 10,
    burnItemTokenId: NONE,
    burnAmount: 0,
    isFullModeOnly: true,
    worldLocation: 0
  },
  {
    questId: EstforConstants.QUEST_SPECIAL_ASSIGNMENT,
    dependentQuestId: EstforConstants.QUEST_HIDDEN_BOUNTY,
    actionId1: EstforConstants.ACTION_THIEVING_FOREST,
    actionNum1: 48,
    actionId2: NONE,
    actionNum2: 0,
    actionChoiceId: 0,
    actionChoiceNum: 0,
    skillReward: Skill.THIEVING,
    skillXPGained: 800,
    rewardItemTokenId1: EstforConstants.WOODCUTTING_CHEST_2,
    rewardAmount1: 10,
    rewardItemTokenId2: EstforConstants.MINING_CHEST_2,
    rewardAmount2: 10,
    burnItemTokenId: NONE,
    burnAmount: 0,
    isFullModeOnly: true,
    worldLocation: 0
  },
  {
    questId: EstforConstants.QUEST_SPECIAL_ASSIGNMENT_II,
    dependentQuestId: EstforConstants.QUEST_SPECIAL_ASSIGNMENT,
    actionId1: EstforConstants.ACTION_THIEVING_LAKE,
    actionNum1: 48,
    actionId2: NONE,
    actionNum2: 0,
    actionChoiceId: 0,
    actionChoiceNum: 0,
    skillReward: Skill.THIEVING,
    skillXPGained: 900,
    rewardItemTokenId1: EstforConstants.FISHING_CHEST_3,
    rewardAmount1: 10,
    rewardItemTokenId2: EstforConstants.MINING_CHEST_3,
    rewardAmount2: 10,
    burnItemTokenId: NONE,
    burnAmount: 0,
    isFullModeOnly: true,
    worldLocation: 0
  },
  {
    questId: EstforConstants.QUEST_SPECIAL_ASSIGNMENT_III,
    dependentQuestId: EstforConstants.QUEST_SPECIAL_ASSIGNMENT_II,
    actionId1: EstforConstants.ACTION_THIEVING_NEST,
    actionNum1: 72,
    actionId2: NONE,
    actionNum2: 0,
    actionChoiceId: 0,
    actionChoiceNum: 0,
    skillReward: Skill.THIEVING,
    skillXPGained: 15900,
    rewardItemTokenId1: EstforConstants.MINING_CHEST_4,
    rewardAmount1: 10,
    rewardItemTokenId2: EstforConstants.FISHING_CHEST_4,
    rewardAmount2: 10,
    burnItemTokenId: NONE,
    burnAmount: 0,
    isFullModeOnly: true,
    worldLocation: 0
  },
  {
    questId: EstforConstants.QUEST_SPECIAL_ASSIGNMENT_IV,
    dependentQuestId: EstforConstants.QUEST_SPECIAL_ASSIGNMENT_III,
    actionId1: EstforConstants.ACTION_THIEVING_LAIR,
    actionNum1: 120,
    actionId2: NONE,
    actionNum2: 0,
    actionChoiceId: 0,
    actionChoiceNum: 0,
    skillReward: Skill.THIEVING,
    skillXPGained: 49100,
    rewardItemTokenId1: EstforConstants.DRAGON_CHEST,
    rewardAmount1: 20,
    rewardItemTokenId2: EstforConstants.WOODCUTTING_CHEST_4,
    rewardAmount2: 5,
    burnItemTokenId: NONE,
    burnAmount: 0,
    isFullModeOnly: true,
    worldLocation: 0
  },
  {
    questId: EstforConstants.QUEST_SPECIAL_ASSIGNMENT_V,
    dependentQuestId: EstforConstants.QUEST_SPECIAL_ASSIGNMENT_IV,
    actionId1: EstforConstants.ACTION_THIEVING_HIDEOUT,
    actionNum1: 168,
    actionId2: NONE,
    actionNum2: 0,
    actionChoiceId: 0,
    actionChoiceNum: 0,
    skillReward: Skill.THIEVING,
    skillXPGained: 55450,
    rewardItemTokenId1: EstforConstants.BONE_CHEST,
    rewardAmount1: 20,
    rewardItemTokenId2: EstforConstants.MINING_CHEST_5,
    rewardAmount2: 5,
    burnItemTokenId: NONE,
    burnAmount: 0,
    isFullModeOnly: true,
    worldLocation: 0
  },
  {
    questId: EstforConstants.QUEST_GROWING_CONCERNS,
    dependentQuestId: 0,
    actionId1: EstforConstants.ACTION_FARMING_GRASSLANDS,
    actionNum1: 24,
    actionId2: NONE,
    actionNum2: 0,
    actionChoiceId: 0,
    actionChoiceNum: 0,
    skillReward: Skill.FARMING,
    skillXPGained: 510,
    rewardItemTokenId1: EstforConstants.SEED_001_WILD,
    rewardAmount1: 30,
    rewardItemTokenId2: EstforConstants.NONE,
    rewardAmount2: 0,
    burnItemTokenId: NONE,
    burnAmount: 0,
    isFullModeOnly: true,
    worldLocation: 0
  },
  {
    questId: EstforConstants.QUEST_GROWING_CONCERNS_II,
    dependentQuestId: EstforConstants.QUEST_GROWING_CONCERNS,
    actionId1: EstforConstants.ACTION_FARMING_RIVERBANK,
    actionNum1: 5760,
    actionId2: NONE,
    actionNum2: 0,
    actionChoiceId: 0,
    actionChoiceNum: 0,
    skillReward: Skill.FARMING,
    skillXPGained: 6540,
    rewardItemTokenId1: EstforConstants.SEED_002_UNKNOWN,
    rewardAmount1: 30,
    rewardItemTokenId2: EstforConstants.NONE,
    rewardAmount2: 0,
    burnItemTokenId: NONE,
    burnAmount: 0,
    isFullModeOnly: true,
    worldLocation: 0
  },
  {
    questId: EstforConstants.QUEST_GROWING_CONCERNS_III,
    dependentQuestId: EstforConstants.QUEST_GROWING_CONCERNS_II,
    actionId1: EstforConstants.ACTION_FARMING_FOREST,
    actionNum1: 7200,
    actionId2: NONE,
    actionNum2: 0,
    actionChoiceId: 0,
    actionChoiceNum: 0,
    skillReward: Skill.FARMING,
    skillXPGained: 40430,
    rewardItemTokenId1: EstforConstants.SEED_003_MYSTERIOUS,
    rewardAmount1: 30,
    rewardItemTokenId2: EstforConstants.NONE,
    rewardAmount2: 0,
    burnItemTokenId: NONE,
    burnAmount: 0,
    isFullModeOnly: true,
    worldLocation: 0
  },
  {
    questId: EstforConstants.QUEST_GROWING_CONCERNS_IV,
    dependentQuestId: EstforConstants.QUEST_GROWING_CONCERNS_III,
    actionId1: EstforConstants.ACTION_FARMING_RUINS,
    actionNum1: 8400,
    actionId2: NONE,
    actionNum2: 0,
    actionChoiceId: 0,
    actionChoiceNum: 0,
    skillReward: Skill.FARMING,
    skillXPGained: 49060,
    rewardItemTokenId1: EstforConstants.SEED_004_OBSCURE,
    rewardAmount1: 30,
    rewardItemTokenId2: EstforConstants.NONE,
    rewardAmount2: 0,
    burnItemTokenId: NONE,
    burnAmount: 0,
    isFullModeOnly: true,
    worldLocation: 0
  },
  {
    questId: EstforConstants.QUEST_GROWING_CONCERNS_V,
    dependentQuestId: EstforConstants.QUEST_GROWING_CONCERNS_IV,
    actionId1: EstforConstants.ACTION_FARMING_WETLANDS,
    actionNum1: 168,
    actionId2: NONE,
    actionNum2: 0,
    actionChoiceId: 0,
    actionChoiceNum: 0,
    skillReward: Skill.FARMING,
    skillXPGained: 138710,
    rewardItemTokenId1: EstforConstants.SEED_005_ANCIENT,
    rewardAmount1: 30,
    rewardItemTokenId2: EstforConstants.NONE,
    rewardAmount2: 0,
    burnItemTokenId: NONE,
    burnAmount: 0,
    isFullModeOnly: true,
    worldLocation: 0
  },
  {
    questId: EstforConstants.QUEST_APPRENTICESHIP_II,
    dependentQuestId: EstforConstants.QUEST_APPRENTICESHIP,
    actionId1: 0,
    actionNum1: 0,
    actionId2: NONE,
    actionNum2: 0,
    actionChoiceId: EstforConstants.ACTIONCHOICE_CRAFTING_SMALL_PLANK,
    actionChoiceNum: 120,
    skillReward: Skill.CRAFTING,
    skillXPGained: 1100,
    rewardItemTokenId1: EstforConstants.MAPLE_LOG,
    rewardAmount1: 300,
    rewardItemTokenId2: EstforConstants.NONE,
    rewardAmount2: 0,
    burnItemTokenId: NONE,
    burnAmount: 0,
    isFullModeOnly: true,
    worldLocation: 0
  },
  {
    questId: EstforConstants.QUEST_APPRENTICESHIP_III,
    dependentQuestId: EstforConstants.QUEST_APPRENTICESHIP_II,
    actionId1: 0,
    actionNum1: 0,
    actionId2: NONE,
    actionNum2: 0,
    actionChoiceId: EstforConstants.ACTIONCHOICE_CRAFTING_SMALL_PLOT,
    actionChoiceNum: 12,
    skillReward: Skill.CRAFTING,
    skillXPGained: 2190,
    rewardItemTokenId1: EstforConstants.ASH_LOG,
    rewardAmount1: 250,
    rewardItemTokenId2: EstforConstants.NONE,
    rewardAmount2: 0,
    burnItemTokenId: NONE,
    burnAmount: 0,
    isFullModeOnly: true,
    worldLocation: 0
  },
  {
    questId: EstforConstants.QUEST_STIRRED_NOT_SHAKEN,
    dependentQuestId: EstforConstants.NONE,
    actionId1: 0,
    actionNum1: 0,
    actionId2: NONE,
    actionNum2: 0,
    actionChoiceId: EstforConstants.ACTIONCHOICE_ALCHEMY_HEALING_POTION_S,
    actionChoiceNum: 120,
    skillReward: Skill.ALCHEMY,
    skillXPGained: 1650,
    rewardItemTokenId1: EstforConstants.SEED_002_UNKNOWN_HARVESTABLE,
    rewardAmount1: 5,
    rewardItemTokenId2: EstforConstants.NONE,
    rewardAmount2: 0,
    burnItemTokenId: NONE,
    burnAmount: 0,
    isFullModeOnly: true,
    worldLocation: 0
  },
  {
    questId: EstforConstants.QUEST_IRON_AGE_II,
    dependentQuestId: EstforConstants.QUEST_IRON_AGE,
    actionId1: NONE,
    actionNum1: 0,
    actionId2: NONE,
    actionNum2: 0,
    actionChoiceId: EstforConstants.ACTIONCHOICE_SMITHING_MITHRIL_NAIL,
    actionChoiceNum: 480,
    skillReward: Skill.SMITHING,
    skillXPGained: 550,
    rewardItemTokenId1: EstforConstants.RUNITE_BAR,
    rewardAmount1: 250,
    rewardItemTokenId2: EstforConstants.NONE,
    rewardAmount2: 0,
    burnItemTokenId: NONE,
    burnAmount: 0,
    isFullModeOnly: true,
    worldLocation: 0
  }
];

type MinRequirement = {
  skill: Skill;
  xp: number;
};

export type MinRequirementArray = [MinRequirement, MinRequirement, MinRequirement];

export const defaultMinRequirements: [MinRequirement, MinRequirement, MinRequirement] = [
  {skill: Skill.NONE, xp: 0},
  {skill: Skill.NONE, xp: 0},
  {skill: Skill.NONE, xp: 0}
];

export const allQuestsMinRequirements: MinRequirementArray[] = [
  defaultMinRequirements,
  defaultMinRequirements,
  defaultMinRequirements,
  defaultMinRequirements,
  defaultMinRequirements,
  defaultMinRequirements,
  defaultMinRequirements,
  defaultMinRequirements,
  defaultMinRequirements,
  defaultMinRequirements,
  defaultMinRequirements,
  [
    {skill: Skill.ALCHEMY, xp: 3236},
    {skill: Skill.NONE, xp: 0},
    {skill: Skill.NONE, xp: 0}
  ],
  defaultMinRequirements,
  defaultMinRequirements,
  defaultMinRequirements,
  defaultMinRequirements,
  defaultMinRequirements,
  defaultMinRequirements,
  defaultMinRequirements,
  defaultMinRequirements,
  [
    {skill: Skill.SMITHING, xp: 3236},
    {skill: Skill.NONE, xp: 0},
    {skill: Skill.NONE, xp: 0}
  ],
  [
    {skill: Skill.HEALTH, xp: 2939},
    {skill: Skill.NONE, xp: 0},
    {skill: Skill.NONE, xp: 0}
  ],
  defaultMinRequirements,
  defaultMinRequirements,
  defaultMinRequirements,
  defaultMinRequirements,
  defaultMinRequirements,
  defaultMinRequirements,
  defaultMinRequirements,
  defaultMinRequirements,
  defaultMinRequirements,
  defaultMinRequirements,
  defaultMinRequirements,
  defaultMinRequirements,
  defaultMinRequirements,
  defaultMinRequirements,
  defaultMinRequirements,
  defaultMinRequirements,
  defaultMinRequirements,
  defaultMinRequirements,
  defaultMinRequirements,
  defaultMinRequirements,
  defaultMinRequirements,
  defaultMinRequirements,
  defaultMinRequirements,
  defaultMinRequirements,
  defaultMinRequirements,
  defaultMinRequirements,
  defaultMinRequirements,
  defaultMinRequirements,
  defaultMinRequirements,
  defaultMinRequirements,
  defaultMinRequirements,
  defaultMinRequirements,
  defaultMinRequirements,
  defaultMinRequirements,
  defaultMinRequirements,
  defaultMinRequirements,
  defaultMinRequirements,
  defaultMinRequirements
];
