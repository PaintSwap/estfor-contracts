import {EstforConstants} from "@paintswap/estfor-definitions";
import {ethers} from "hardhat";
import {ITEM_NFT_ADDRESS} from "./contractAddresses";
import {allItems} from "./data/items";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Add items using account: ${owner.address} on chain id ${await owner.getChainId()}`);

  const itemNFT = await ethers.getContractAt("ItemNFT", ITEM_NFT_ADDRESS);

  const itemIds = new Set([
    EstforConstants.ANNIV1_CHEST,
    EstforConstants.ANNIV1_RING,
    EstforConstants.ANNIV1_EGG_TIER1,
    EstforConstants.ANNIV1_EGG_TIER2,
    EstforConstants.ANNIV1_EGG_TIER3,
    EstforConstants.ANNIV1_EGG_TIER4,
    EstforConstants.ANNIV1_EGG_TIER5,
    EstforConstants.ANNIV1_KEY,
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
