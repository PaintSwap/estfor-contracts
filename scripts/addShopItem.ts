import {MEDIUM_NET} from "@paintswap/estfor-definitions/constants";
import {ethers} from "hardhat";
import {SHOP_ADDRESS} from "./contractAddresses";
import {ShopItem, allShopItems, allShopItemsBeta} from "./data/shopItems";
import {isBeta} from "./utils";
import {EstforConstants} from "@paintswap/estfor-definitions";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Add shop item using account: ${owner.address}`);

  const network = await ethers.provider.getNetwork();
  console.log(`ChainId: ${network.chainId}`);

  const Shop = await ethers.getContractFactory("Shop");
  const shop = Shop.attach(SHOP_ADDRESS);

  const shopItems = isBeta ? allShopItemsBeta : allShopItems;
  await shop.addBuyableItem(shopItems.find((shopItem) => shopItem.tokenId == EstforConstants.FLUX) as ShopItem);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
