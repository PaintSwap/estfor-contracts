import {EstforConstants} from "@paintswap/estfor-definitions";
import {ethers, upgrades} from "hardhat";
import {ITEM_NFT_ADDRESS, ITEM_NFT_LIBRARY_ADDRESS} from "./contractAddresses";
import {allItems} from "./data/items";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Add items using account: ${owner.address} on chain id ${await owner.getChainId()}`);

  const itemNFT = await ethers.getContractAt("ItemNFT", ITEM_NFT_ADDRESS);

  const itemIds = new Set([
    EstforConstants.EGG_TIER1,
    EstforConstants.EGG_TIER2,
    EstforConstants.EGG_TIER3,
    EstforConstants.EGG_TIER4,
    EstforConstants.EGG_TIER5,
    EstforConstants.SECRET_EGG_1_TIER2,
    EstforConstants.SECRET_EGG_1_TIER3,
    EstforConstants.SECRET_EGG_1_TIER4,
    EstforConstants.SECRET_EGG_1_TIER5,
    EstforConstants.SECRET_EGG_2_TIER2,
    EstforConstants.SECRET_EGG_2_TIER3,
    EstforConstants.SECRET_EGG_2_TIER4,
    EstforConstants.SECRET_EGG_2_TIER5,
    EstforConstants.SECRET_EGG_3_TIER2,
    EstforConstants.SECRET_EGG_3_TIER3,
    EstforConstants.SECRET_EGG_3_TIER4,
    EstforConstants.SECRET_EGG_3_TIER5,
    EstforConstants.SECRET_EGG_4_TIER2,
    EstforConstants.SECRET_EGG_4_TIER3,
    EstforConstants.SECRET_EGG_4_TIER4,
    EstforConstants.SECRET_EGG_4_TIER5,
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
