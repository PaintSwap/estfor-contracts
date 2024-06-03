import {ethers} from "hardhat";
import {SHOP_ADDRESS} from "./contractAddresses";
import {EstforConstants} from "@paintswap/estfor-definitions";
import {allShopItems, allShopItemsBeta} from "./data/shopItems";
import {isBeta} from "./utils";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Edit shop items using account: ${owner.address} on chain id ${await owner.getChainId()}`);

  const shop = await ethers.getContractAt("Shop", SHOP_ADDRESS);
  const _allShopItems = isBeta ? allShopItemsBeta : allShopItems;
  const items = new Set([EstforConstants.LARGE_NET, EstforConstants.CAGE]);
  const shopItems = _allShopItems.filter((shopItem) => items.has(shopItem.tokenId));

  if (shopItems.length !== items.size) {
    console.log("Cannot find shop items");
  } else {
    await shop.editItems(shopItems);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
