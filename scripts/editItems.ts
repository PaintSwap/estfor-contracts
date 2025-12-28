import {ethers} from "hardhat";
import {allItems} from "./data/items";
import {ITEM_NFT_ADDRESS} from "./contractAddresses";
import {EstforConstants} from "@paintswap/estfor-definitions";
import {getChainId} from "./utils";
import {initialiseSafe, sendTransactionSetToSafe} from "./utils";
import {OperationType, MetaTransactionData} from "@safe-global/types-kit";

async function main() {
  const [owner, , proposer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const {useSafe, apiKit, protocolKit} = await initialiseSafe(network);
  console.log(`Edit items using account: ${owner.address} on chain id ${await getChainId(owner)}`);

  const itemNFT = await ethers.getContractAt("ItemNFT", ITEM_NFT_ADDRESS);
  const itemsToEdit = new Set([
    EstforConstants.XP_BOOST_M,
    EstforConstants.COMBAT_BOOST_M,
    EstforConstants.SKILL_BOOST_M,
    EstforConstants.GATHERING_BOOST_M,
    EstforConstants.XP_BOOST_L,
    EstforConstants.COMBAT_BOOST_L,
    EstforConstants.SKILL_BOOST_L,
    EstforConstants.GATHERING_BOOST_L,
    EstforConstants.XP_BOOST_XL,
    EstforConstants.COMBAT_BOOST_XL,
    EstforConstants.SKILL_BOOST_XL,
    EstforConstants.GATHERING_BOOST_XL
  ]);

  const items = allItems.filter((item) => itemsToEdit.has(item.tokenId));
  /*
  const items = allItems;

  const chunkSize = 100;
  for (let i = 0; i < allItems.length; i += chunkSize) {
    const chunk = allItems.slice(i, i + chunkSize);
    const tx = await itemNFT.editItems(chunk);
    await tx.wait();
    console.log("Add items chunk ", i);
  }
  */
  if (items.length !== itemsToEdit.size) {
    console.log("Cannot find all items");
  } else {
    if (useSafe) {
      const transactionSet: MetaTransactionData[] = [];
      const contract = await ethers.getContractAt("ItemNFT", ITEM_NFT_ADDRESS);
      const iface = contract.interface;
      transactionSet.push({
        to: ethers.getAddress(ITEM_NFT_ADDRESS),
        value: "0",
        data: iface.encodeFunctionData("editItems", [items]),
        operation: OperationType.Call
      });
      await sendTransactionSetToSafe(network, protocolKit, apiKit, transactionSet, proposer);
    } else {
      await itemNFT.editItems(items);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
