import {ethers} from "hardhat";
import {QUESTS_ADDRESS} from "./contractAddresses";
import {MinRequirementArray, allQuests, allQuestsMinRequirements} from "./data/quests";
import {EstforConstants} from "@paintswap/estfor-definitions";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Edit quest using account: ${owner.address} on chain id ${await owner.getChainId()}`);

  const quests = await ethers.getContractAt("Quests", QUESTS_ADDRESS);

  //  const tx = await quests.editQuests(allQuests, allQuestsMinRequirements);
  //  await tx.wait();

  // Single one
  const questIndex = allQuests.findIndex((q) => q.questId === EstforConstants.QUEST_FORGE_AHEAD);
  if (questIndex === -1 || allQuestsMinRequirements.length <= questIndex) {
    console.error("Could not find this quest");
    return;
  }

  const quest = allQuests[questIndex];
  const editedQuests = [quest];
  const minRequirements: MinRequirementArray[] = [allQuestsMinRequirements[questIndex]];
  await quests.editQuests(editedQuests, minRequirements);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
