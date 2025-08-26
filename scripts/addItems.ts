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
    EstforConstants.SONIC_GEM_TICKET2,
    EstforConstants.ACTIVITY_TICKET2,
    EstforConstants.ANNIV2_RING,
    EstforConstants.ANNIV2_AMULET,
    EstforConstants.ANNIV2_POUCH,
    EstforConstants.ANNIV2_EGG_TIER1,
    EstforConstants.ANNIV2_EGG_TIER2,
    EstforConstants.ANNIV2_EGG_TIER3,
    EstforConstants.ANNIV2_EGG_TIER4,
    EstforConstants.ANNIV2_EGG_TIER5
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
