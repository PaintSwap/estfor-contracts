import {ethers} from "hardhat";
import {QUESTS_ADDRESS} from "./contractAddresses";
import {MinRequirementArray, QuestInput, allQuests, allQuestsMinRequirements} from "./data/quests";
import {EstforConstants} from "@paintswap/estfor-definitions";
import {Quests} from "../typechain-types";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Edit quest using account: ${owner.address} on chain id ${await owner.getChainId()}`);

  const quests = (await ethers.getContractAt("Quests", QUESTS_ADDRESS)) as Quests;
  const questIndexes = allQuests
    .map((q, index) =>
      q.questId === EstforConstants.QUEST_NEW_ALCHEMY || q.questId === EstforConstants.QUEST_FLEX_THE_BOW ? index : ""
    )
    .filter(String) as number[];
  if (questIndexes.length != 2) {
    console.error("Could not find these quests");
    return;
  }

  const editedQuests: QuestInput[] = questIndexes.map((index) => allQuests[index]);
  const minRequirements: MinRequirementArray[] = questIndexes.map((index) => allQuestsMinRequirements[index]);
  await quests.editQuests(editedQuests, minRequirements);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
