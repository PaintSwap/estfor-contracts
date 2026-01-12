import {EstforConstants} from "@paintswap/estfor-definitions";
import {ethers} from "hardhat";
import {ITEM_NFT_ADDRESS} from "./contractAddresses";
import {allItems} from "./data/items";
import {getSafeUpgradeTransaction, initialiseSafe, sendTransactionSetToSafe} from "./utils";
import {ItemNFT__factory} from "../typechain-types";
import {OperationType, MetaTransactionData} from "@safe-global/types-kit";

async function main() {
  const [owner, , proposer] = await ethers.getSigners(); // 0 is old deployer, 2 is proposer for Safe (new deployer)
  const network = await ethers.provider.getNetwork();
  const {useSafe, apiKit, protocolKit} = await initialiseSafe(network);
  console.log(`Removing items using account: ${proposer.address} on chain id ${network.chainId}, useSafe: ${useSafe}`);

  const itemNFT = await ethers.getContractAt("ItemNFT", ITEM_NFT_ADDRESS);

  const itemsToDelete = new Set([15713]);

  // const items = allItems.filter((item) => itemsToDelete.has(item.tokenId));

  // if (items.length !== itemsToDelete.size) {
  //   console.log("Cannot find all items");
  // } else {
  if (useSafe) {
    const transactionSet: MetaTransactionData[] = [];
    const iface = ItemNFT__factory.createInterface();

    transactionSet.push({
      to: ethers.getAddress(ITEM_NFT_ADDRESS),
      value: "0",
      data: iface.encodeFunctionData("removeItems", [[...itemsToDelete]]),
      operation: OperationType.Call,
    });
    await sendTransactionSetToSafe(network, protocolKit, apiKit, transactionSet, proposer);
  } else {
    await itemNFT.removeItems([...itemsToDelete]);
  }
  // }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
