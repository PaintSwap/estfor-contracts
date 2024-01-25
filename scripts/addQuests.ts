import {ethers} from "hardhat";
import {QUESTS_ADDRESS} from "./contractAddresses";
import {MinRequirementArray, QuestInput, allQuests, allQuestsMinRequirements} from "./data/quests";
import {EstforConstants} from "@paintswap/estfor-definitions";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Add quests using account: ${owner.address} on chain id ${await owner.getChainId()}`);

  const quests = await ethers.getContractAt("Quests", QUESTS_ADDRESS);
  const questIndexes = allQuests
    .map((q, index) =>
      q.questId === EstforConstants.QUEST_ENTER_THE_VEIL || q.questId === EstforConstants.QUEST_FORGE_AHEAD ? index : ""
    )
    .filter(String) as number[];
  if (questIndexes.length != 2) {
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
