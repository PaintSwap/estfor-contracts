import {ethers} from "hardhat";
import {SHOP_ADDRESS} from "./contractAddresses";
import {EstforConstants} from "@paintswap/estfor-definitions";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Remove shop item using account: ${owner.address} on chain id ${await owner.getChainId()}`);

  const Shop = (await ethers.getContractFactory("Shop")).connect(owner);
  const shop = Shop.attach(SHOP_ADDRESS);

  // Remove all scrolls
  const shopItems = [
    EstforConstants.FREEZE_SCROLL,
    EstforConstants.SHADOW_SCROLL,
    EstforConstants.NATURE_SCROLL,
    EstforConstants.AQUA_SCROLL,
    EstforConstants.HELL_SCROLL,
    EstforConstants.AIR_SCROLL,
    EstforConstants.BARRAGE_SCROLL,
  ];

  for (const shopItem of shopItems) {
    const tx = await shop.removeItem(shopItem);
    await tx.wait();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
