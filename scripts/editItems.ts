import {ethers} from "hardhat";
import {allItems} from "./data/items";
import {ITEM_NFT_ADDRESS} from "./contractAddresses";
import {EstforConstants} from "@paintswap/estfor-definitions";
import {getChainId, sleep} from "./utils";
import {initialiseSafe, sendTransactionSetToSafe} from "./utils";
import {OperationType, MetaTransactionData} from "@safe-global/types-kit";

async function main() {
  const [owner, , proposer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const {useSafe, apiKit, protocolKit} = await initialiseSafe(network);
  console.log(`Edit items using account: ${owner.address} on chain id ${await getChainId(owner)}`);

  const itemNFT = await ethers.getContractAt("ItemNFT", ITEM_NFT_ADDRESS);
  const itemsToEdit = new Set(allItems.map((item) => item.tokenId));

  // const items = allItems.filter((item) => itemsToEdit.has(item.tokenId));
  const items = allItems;

  if (items.length !== itemsToEdit.size) {
    console.log("Cannot find all items");
  } else {
    const chunkSize = 100;
    for (let i = 0; i < items.length; i += chunkSize) {
      const chunk = items.slice(i, i + chunkSize);
      if (useSafe) {
        const transactionSet: MetaTransactionData[] = [];
        const contract = await ethers.getContractAt("ItemNFT", ITEM_NFT_ADDRESS);
        const iface = contract.interface;
        transactionSet.push({
          to: ethers.getAddress(ITEM_NFT_ADDRESS),
          value: "0",
          data: iface.encodeFunctionData("editItems", [chunk]),
          operation: OperationType.Call,
        });
        await sendTransactionSetToSafe(network, protocolKit, apiKit, transactionSet, proposer);
        await sleep(1000); // Wait to avoid nonce issues
      } else {
        await itemNFT.editItems(chunk);
      }
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
