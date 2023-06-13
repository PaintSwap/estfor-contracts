import {ethers} from "hardhat";
import {QUESTS_ADDRESS} from "./contractAddresses";
import {Quest, allQuests, defaultMinRequirements} from "./data/quests";
import {QUEST_PURSE_STRINGS} from "@paintswap/estfor-definitions/constants";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Edit quest using account: ${owner.address}`);

  const network = await ethers.provider.getNetwork();
  console.log(`ChainId: ${network.chainId}`);

  const Quests = await ethers.getContractFactory("Quests");
  const quests = await Quests.attach(QUESTS_ADDRESS);

  const quest = allQuests.find((q) => q.questId === QUEST_PURSE_STRINGS) as Quest;
  const tx = await quests.editQuest(quest, defaultMinRequirements);
  await tx.wait();
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
