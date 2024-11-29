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
    EstforConstants.KRAGSTYR_EGG_TIER1,
    EstforConstants.KRAGSTYR_EGG_TIER2,
    EstforConstants.KRAGSTYR_EGG_TIER3,
    EstforConstants.KRAGSTYR_EGG_TIER4,
    EstforConstants.KRAGSTYR_EGG_TIER5,
    EstforConstants.TRICK_CHEST2024,
    EstforConstants.TREAT_CHEST2024,
    EstforConstants.TRICK_OR_TREAT_KEY,
    EstforConstants.RING_OF_TUR,
    EstforConstants.KEPHRI_AMULET,
    EstforConstants.LIFFYN,
    EstforConstants.VANAGLOT,
    EstforConstants.FANGENSTORM
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
