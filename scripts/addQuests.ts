import {ethers} from "hardhat";
import {QUESTS_ADDRESS} from "./contractAddresses";
import {MinRequirementArray, defaultMinRequirements} from "./data/quests";
import {NONE} from "@paintswap/estfor-definitions";
import {
  ACTIONCHOICE_CRAFTING_MITHRIL_PICKAXE,
  ACTIONCHOICE_CRAFTING_NATUOW_LEATHER,
  ACTIONCHOICE_FIREMAKING_OAK,
  ACTIONCHOICE_SMITHING_IRON_BAR,
  ACTIONCHOICE_SMITHING_MITHRIL_ARMOR,
  ACTION_COMBAT_QUARTZ_EAGLE,
  ACTION_FISHING_SKRIMP,
  ACTION_WOODCUTTING_WILLOW,
  ADAMANTINE_ORE,
  COAL_ORE,
  IRON_ARMOR,
  IRON_BAR,
  IRON_TASSETS,
  MITHRIL_ARMOR,
  MITHRIL_PICKAXE,
  QUEST_BURNER_WATCH,
  QUEST_NYMPTH_WATCH,
  QUEST_TWO_BIRDS,
  QUEST_APPRENTICESHIP,
  QUEST_TOWN_COOKOUT,
  QUEST_IRON_AGE,
  QUEST_CLEAR_SKIES,
  QUEST_MEADERY_MADNESS,
  QUEST_FOREST_FIRE,
  QUEST_MITHRIL_MILITIA,
  QUEST_MINOR_MINERS,
  RAW_SKRIMP,
} from "@paintswap/estfor-definitions/constants";
import {Skill} from "@paintswap/estfor-definitions/types";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Add quests using account: ${owner.address}`);

  const network = await ethers.provider.getNetwork();
  console.log(`ChainId: ${network.chainId}`);

  const Quests = await ethers.getContractFactory("Quests");
  const quests = await Quests.attach(QUESTS_ADDRESS);

  const questsRandomFlags: boolean[] = [false, false, false, false, false, false, false, false];

  const newQuests = [
    {
      questId: QUEST_APPRENTICESHIP,
      dependentQuestId: NONE,
      actionId1: NONE,
      actionNum1: 0,
      actionId2: NONE,
      actionNum2: 0,
      actionChoiceId: ACTIONCHOICE_CRAFTING_NATUOW_LEATHER,
      actionChoiceNum: 500,
      skillReward: Skill.CRAFTING,
      skillXPGained: 250,
      rewardItemTokenId1: NONE,
      rewardAmount1: 0,
      rewardItemTokenId2: NONE,
      rewardAmount2: 0,
      burnItemTokenId: NONE,
      burnAmount: 0,
      requireActionsCompletedBeforeBurning: false,
    },
    {
      questId: QUEST_TOWN_COOKOUT,
      dependentQuestId: NONE,
      actionId1: ACTION_FISHING_SKRIMP,
      actionNum1: 5000,
      actionId2: NONE,
      actionNum2: 0,
      actionChoiceId: NONE,
      actionChoiceNum: 0,
      skillReward: Skill.FISHING,
      skillXPGained: 500,
      rewardItemTokenId1: NONE,
      rewardAmount1: 0,
      rewardItemTokenId2: NONE,
      rewardAmount2: 0,
      burnItemTokenId: RAW_SKRIMP,
      burnAmount: 5000,
      requireActionsCompletedBeforeBurning: true,
    },
    {
      questId: QUEST_IRON_AGE,
      dependentQuestId: NONE,
      actionId1: NONE,
      actionNum1: 0,
      actionId2: NONE,
      actionNum2: 0,
      actionChoiceId: ACTIONCHOICE_SMITHING_IRON_BAR,
      actionChoiceNum: 7500,
      skillReward: Skill.SMITHING,
      skillXPGained: 500,
      rewardItemTokenId1: IRON_ARMOR,
      rewardAmount1: 1,
      rewardItemTokenId2: IRON_TASSETS,
      rewardAmount2: 1,
      burnItemTokenId: IRON_BAR,
      burnAmount: 7500,
      requireActionsCompletedBeforeBurning: true,
    },
    {
      questId: QUEST_CLEAR_SKIES,
      dependentQuestId: QUEST_TWO_BIRDS,
      actionId1: ACTION_COMBAT_QUARTZ_EAGLE,
      actionNum1: 300,
      actionId2: NONE,
      actionNum2: 0,
      actionChoiceId: NONE,
      actionChoiceNum: 0,
      skillReward: Skill.HEALTH,
      skillXPGained: 500,
      rewardItemTokenId1: NONE,
      rewardAmount1: 0,
      rewardItemTokenId2: NONE,
      rewardAmount2: 0,
      burnItemTokenId: NONE,
      burnAmount: 0,
      requireActionsCompletedBeforeBurning: false,
    },
    {
      questId: QUEST_MEADERY_MADNESS,
      dependentQuestId: QUEST_NYMPTH_WATCH,
      actionId1: ACTION_WOODCUTTING_WILLOW,
      actionNum1: 3000,
      actionId2: NONE,
      actionNum2: 0,
      actionChoiceId: NONE,
      actionChoiceNum: 0,
      skillReward: Skill.WOODCUTTING,
      skillXPGained: 500,
      rewardItemTokenId1: NONE,
      rewardAmount1: 0,
      rewardItemTokenId2: NONE,
      rewardAmount2: 0,
      burnItemTokenId: NONE,
      burnAmount: 0,
      requireActionsCompletedBeforeBurning: false,
    },
    {
      questId: QUEST_FOREST_FIRE,
      dependentQuestId: QUEST_BURNER_WATCH,
      actionId1: NONE,
      actionNum1: 0,
      actionId2: NONE,
      actionNum2: 0,
      actionChoiceId: ACTIONCHOICE_FIREMAKING_OAK,
      actionChoiceNum: 3000,
      skillReward: Skill.FIREMAKING,
      skillXPGained: 500,
      rewardItemTokenId1: NONE,
      rewardAmount1: 0,
      rewardItemTokenId2: NONE,
      rewardAmount2: 0,
      burnItemTokenId: NONE,
      burnAmount: 0,
      requireActionsCompletedBeforeBurning: false,
    },
    {
      questId: QUEST_MITHRIL_MILITIA,
      dependentQuestId: QUEST_IRON_AGE,
      actionId1: NONE,
      actionNum1: 0,
      actionId2: NONE,
      actionNum2: 0,
      actionChoiceId: ACTIONCHOICE_SMITHING_MITHRIL_ARMOR,
      actionChoiceNum: 25,
      skillReward: Skill.SMITHING,
      skillXPGained: 500,
      rewardItemTokenId1: NONE,
      rewardAmount1: 0,
      rewardItemTokenId2: NONE,
      rewardAmount2: 0,
      burnItemTokenId: MITHRIL_ARMOR,
      burnAmount: 25,
      requireActionsCompletedBeforeBurning: true,
    },
    {
      questId: QUEST_MINOR_MINERS,
      dependentQuestId: QUEST_APPRENTICESHIP,
      actionId1: NONE,
      actionNum1: 0,
      actionId2: NONE,
      actionNum2: 0,
      actionChoiceId: ACTIONCHOICE_CRAFTING_MITHRIL_PICKAXE,
      actionChoiceNum: 12,
      skillReward: Skill.CRAFTING,
      skillXPGained: 500,
      rewardItemTokenId1: ADAMANTINE_ORE,
      rewardAmount1: 150,
      rewardItemTokenId2: COAL_ORE,
      rewardAmount2: 450,
      burnItemTokenId: MITHRIL_PICKAXE,
      burnAmount: 12,
      requireActionsCompletedBeforeBurning: true,
    },
  ];

  const minRequirements: MinRequirementArray[] = [
    defaultMinRequirements,
    defaultMinRequirements,
    defaultMinRequirements,
    [
      {skill: Skill.HEALTH, xp: 3000},
      {skill: Skill.NONE, xp: 0},
      {skill: Skill.NONE, xp: 0},
    ],
    defaultMinRequirements,
    defaultMinRequirements,
    defaultMinRequirements,
    defaultMinRequirements,
  ];

  const tx = await quests.addQuests(newQuests, questsRandomFlags, minRequirements);
  await tx.wait();
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
