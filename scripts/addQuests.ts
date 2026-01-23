import {ethers} from "hardhat";
import {QUESTS_ADDRESS} from "./contractAddresses";
import {MinRequirementArray, QuestInput, allQuests, allQuestsMinRequirements} from "./data/quests";
import {EstforConstants} from "@paintswap/estfor-definitions";
import {getSafeUpgradeTransaction, initialiseSafe, sendTransactionSetToSafe} from "./utils";
import {OperationType, MetaTransactionData} from "@safe-global/types-kit";
import {Quests__factory, WorldActions__factory} from "../typechain-types";

async function main() {
  const [owner, , proposer] = await ethers.getSigners(); // 0 is old deployer, 2 is proposer for Safe (new deployer)
  const network = await ethers.provider.getNetwork();
  const {useSafe, apiKit, protocolKit} = await initialiseSafe(network);
  console.log(`Add quests using account: ${owner.address} on chain id ${network.chainId}, useSafe: ${useSafe}`);

  const quests = await ethers.getContractAt("Quests", QUESTS_ADDRESS);
  const newQuestsRaw = new Set([
    EstforConstants.QUEST_WORLD_I_I,
    EstforConstants.QUEST_WORLD_I_II,
    EstforConstants.QUEST_WORLD_I_III,
    EstforConstants.QUEST_WORLD_I_IV,
    EstforConstants.QUEST_WORLD_I_V,
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

  if (useSafe) {
    const transactionSet: MetaTransactionData[] = [];
    const iface = Quests__factory.createInterface();

    transactionSet.push({
      to: ethers.getAddress(QUESTS_ADDRESS),
      value: "0",
      data: iface.encodeFunctionData("addQuests", [newQuests, minRequirements]),
      operation: OperationType.Call,
    });
    await sendTransactionSetToSafe(network, protocolKit, apiKit, transactionSet, proposer);
  } else {
    await quests.addQuests(newQuests, minRequirements);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
