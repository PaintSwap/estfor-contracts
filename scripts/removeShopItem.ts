import {ethers} from "hardhat";
import {SHOP_ADDRESS} from "./contractAddresses";
import {EstforConstants} from "@paintswap/estfor-definitions";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Remove shop item using account: ${owner.address} on chain id ${await owner.getChainId()}`);

  const Shop = (await ethers.getContractFactory("Shop")).connect(owner);
  const shop = Shop.attach(SHOP_ADDRESS);

  const shopItems = [EstforConstants.CAGE, EstforConstants.LARGE_NET];

  for (const shopItem of shopItems) {
    const tx = await shop.removeItem(shopItem);
    await tx.wait();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
