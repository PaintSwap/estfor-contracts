import {ethers} from "hardhat";
import {QUESTS_ADDRESS} from "./contractAddresses";
import {MinRequirementArray, QuestInput, allQuests, defaultMinRequirements} from "./data/quests";
import {EstforConstants} from "@paintswap/estfor-definitions";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Add quests using account: ${owner.address}`);

  const network = await ethers.provider.getNetwork();
  console.log(`ChainId: ${network.chainId}`);

  const Quests = await ethers.getContractFactory("Quests");
  const quests = await Quests.attach(QUESTS_ADDRESS);

  const quest = allQuests.find((q) => q.questId === EstforConstants.QUEST_SO_FLETCH) as QuestInput;
  const newQuests = [quest];
  const minRequirements: MinRequirementArray[] = [defaultMinRequirements];

  const tx = await quests.addQuests(newQuests, minRequirements);
  await tx.wait();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
