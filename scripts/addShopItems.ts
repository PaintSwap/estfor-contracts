import {ethers} from "hardhat";
import {SHOP_ADDRESS} from "./contractAddresses";
import {allShopItems, allShopItemsBeta} from "./data/shopItems";
import {isBeta} from "./utils";
import {EstforConstants} from "@paintswap/estfor-definitions";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Add shop items using account: ${owner.address} on chain id ${await owner.getChainId()}`);

  const _allShopItems = isBeta ? allShopItemsBeta : allShopItems;
  const items = new Set([EstforConstants.SHARPENED_CLAW]);
  const shopItems = _allShopItems.filter((shopItem) => items.has(shopItem.tokenId));

  if (shopItems.length !== 1) {
    console.log("Cannot find shop items");
  } else {
    const shop = await ethers.getContractAt("Shop", SHOP_ADDRESS);
    const tx = await shop.addBuyableItems(shopItems);
    await tx.wait();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
