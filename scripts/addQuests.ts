import {ethers} from "hardhat";
import {QUESTS_ADDRESS} from "./contractAddresses";
import {MinRequirementArray, QuestInput, allQuests, allQuestsMinRequirements} from "./data/quests";
import {EstforConstants} from "@paintswap/estfor-definitions";
import {Quests} from "../typechain-types";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Add quests using account: ${owner.address} on chain id ${await owner.getChainId()}`);

  const quests = (await ethers.getContractAt("Quests", QUESTS_ADDRESS)).connect(owner) as Quests;
  const newQuestsRaw = new Set([
    EstforConstants.QUEST_WAY_OF_THE_AXE,
    EstforConstants.QUEST_WAY_OF_THE_AXE_II,
    EstforConstants.QUEST_WAY_OF_THE_AXE_III,
    EstforConstants.QUEST_WAY_OF_THE_AXE_IV,
    EstforConstants.QUEST_WAY_OF_THE_AXE_V,
    EstforConstants.QUEST_WAY_OF_THE_PICKAXE,
    EstforConstants.QUEST_WAY_OF_THE_PICKAXE_II,
    EstforConstants.QUEST_WAY_OF_THE_PICKAXE_III,
    EstforConstants.QUEST_WAY_OF_THE_PICKAXE_IV,
    EstforConstants.QUEST_WAY_OF_THE_PICKAXE_V,
    EstforConstants.QUEST_BAIT_AND_STRING,
    EstforConstants.QUEST_BAIT_AND_STRING_II,
    EstforConstants.QUEST_BAIT_AND_STRING_III,
    EstforConstants.QUEST_BAIT_AND_STRING_IV,
    EstforConstants.QUEST_BAIT_AND_STRING_V,
    EstforConstants.QUEST_FIRE_AND_ICE,
    EstforConstants.QUEST_FIRE_AND_ICE_II,
    EstforConstants.QUEST_FIRE_AND_ICE_III,
    EstforConstants.QUEST_FIRE_AND_ICE_IV,
    EstforConstants.QUEST_FIRE_AND_ICE_V,
    EstforConstants.QUEST_FIRE_AND_ICE_VI,
    EstforConstants.QUEST_FIRE_AND_ICE_VII,
    EstforConstants.QUEST_SPECIAL_ASSIGNMENT,
    EstforConstants.QUEST_SPECIAL_ASSIGNMENT_II,
    EstforConstants.QUEST_SPECIAL_ASSIGNMENT_III,
    EstforConstants.QUEST_SPECIAL_ASSIGNMENT_IV,
    EstforConstants.QUEST_SPECIAL_ASSIGNMENT_V,
  ]);

  const questIndexes = allQuests
    .map((q, index) => (newQuestsRaw.has(q.questId) ? index : ""))
    .filter(String) as number[];
  if (questIndexes.length != newQuestsRaw.size) {
    console.error("Could not find these quests");
    return;
  }

  const newQuests: QuestInput[] = questIndexes.map((index) => allQuests[index]);
  const minRequirements: MinRequirementArray[] = questIndexes.map((index) => allQuestsMinRequirements[index]);
  await quests.addQuests(newQuests, minRequirements);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
