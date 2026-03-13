import {EstforConstants} from "@paintswap/estfor-definitions";
import {ethers} from "hardhat";
import {ITEM_NFT_ADDRESS, QUESTS_ADDRESS} from "./contractAddresses";
import {allItems} from "./data/items";
import {getSafeUpgradeTransaction, initialiseSafe, sendTransactionSetToSafe} from "./utils";
import {ItemNFT__factory, Quests__factory} from "../typechain-types";
import {OperationType, MetaTransactionData} from "@safe-global/types-kit";

async function main() {
  const [owner, , proposer] = await ethers.getSigners(); // 0 is old deployer, 2 is proposer for Safe (new deployer)
  const network = await ethers.provider.getNetwork();
  const {useSafe, apiKit, protocolKit} = await initialiseSafe(network);
  console.log(`Removing items using account: ${proposer.address} on chain id ${network.chainId}, useSafe: ${useSafe}`);

  const quests = await ethers.getContractAt("Quests", QUESTS_ADDRESS);

  const itemsToDelete = EstforConstants.QUEST_PURSE_STRINGS;

  if (useSafe) {
    const transactionSet: MetaTransactionData[] = [];
    const iface = Quests__factory.createInterface();

    transactionSet.push({
      to: ethers.getAddress(QUESTS_ADDRESS),
      value: "0",
      data: iface.encodeFunctionData("removeQuest", [itemsToDelete]),
      operation: OperationType.Call,
    });
    await sendTransactionSetToSafe(network, protocolKit, apiKit, transactionSet, proposer);
  } else {
    await quests.removeQuest(itemsToDelete);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
