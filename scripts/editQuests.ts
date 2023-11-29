import {ethers} from "hardhat";
import {QUESTS_ADDRESS} from "./contractAddresses";
import {allQuests, allQuestsMinRequirements} from "./data/quests";
import {EstforConstants} from "@paintswap/estfor-definitions";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Edit quest using account: ${owner.address}`);

  const network = await ethers.provider.getNetwork();
  console.log(`ChainId: ${network.chainId}`);

  const Quests = await ethers.getContractFactory("Quests");
  const quests = await Quests.attach(QUESTS_ADDRESS);

  //  const tx = await quests.editQuests(allQuests, allQuestsMinRequirements);
  //  await tx.wait();

  // Single one
  const questIndex = allQuests.findIndex((q) => q.questId === EstforConstants.QUEST_SO_FLETCH);
  if (questIndex === -1) {
    console.error("Could not find this quest");
  } else {
    const quest = allQuests[questIndex];
    const minRequirements = allQuestsMinRequirements[questIndex];
    const tx = await quests.editQuests([quest], [minRequirements]);
    await tx.wait();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
