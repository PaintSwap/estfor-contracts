import {EstforConstants} from "@paintswap/estfor-definitions";
import {ethers} from "hardhat";
import {ITEM_NFT_ADDRESS} from "./contractAddresses";
import {allItems} from "./data/items";
import {getChainId} from "./utils";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Add items using account: ${owner.address} on chain id ${await getChainId(owner)}`);

  const itemNFT = await ethers.getContractAt("ItemNFT", ITEM_NFT_ADDRESS);

  const itemIds = new Set([
    EstforConstants.REWARD_001_DAGGER,
    EstforConstants.REWARD_002_BOOK,
    EstforConstants.REWARD_003_CROSSBOW
  ]);

  const items = allItems.filter((item) => itemIds.has(item.tokenId));
  if (items.length !== itemIds.size) {
    console.log("Cannot find all items");
  } else {
    await itemNFT.addItems(items);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
