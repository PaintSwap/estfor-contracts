import {ethers} from "hardhat";
import {QUESTS_ADDRESS} from "./contractAddresses";
import {MinRequirementArray, QuestInput, allQuests, allQuestsMinRequirements} from "./data/quests";
import {EstforConstants} from "@paintswap/estfor-definitions";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Add quests using account: ${owner.address} on chain id ${await owner.getChainId()}`);

  const quests = await ethers.getContractAt("Quests", QUESTS_ADDRESS);
  const questIndex = allQuests.findIndex((q) => q.questId === EstforConstants.QUEST_ENTER_THE_VEIL);
  if (questIndex === -1 || allQuestsMinRequirements.length <= questIndex) {
    console.error("Could not find this quest");
    return;
  }

  const quest = allQuests[questIndex] as QuestInput;
  const newQuests = [quest];
  const minRequirements: MinRequirementArray[] = [allQuestsMinRequirements[questIndex]];
  await quests.addQuests(newQuests, minRequirements);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
