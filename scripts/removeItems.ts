import {EstforConstants} from "@paintswap/estfor-definitions";
import {ethers} from "hardhat";
import {ITEM_NFT_ADDRESS} from "./contractAddresses";
import {allItems} from "./data/items";
import {ItemNFT} from "../typechain-types";
import {getChainId} from "./utils";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Remove items using account: ${owner.address} on chain id ${await getChainId(owner)}`);

  const itemNFT = (await ethers.getContractAt("ItemNFT", ITEM_NFT_ADDRESS)) as ItemNFT;

  const itemsToDelete = new Set([EstforConstants.HARPOON]);

  const items = allItems.filter((item) => itemsToDelete.has(item.tokenId));

  if (items.length !== itemsToDelete.size) {
    console.log("Cannot find all items");
  } else {
    await itemNFT.removeItems(items.map((item) => item.tokenId));
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
