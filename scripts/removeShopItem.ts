import {ethers} from "hardhat";
import {SHOP_ADDRESS} from "./contractAddresses";
import {EstforConstants} from "@paintswap/estfor-definitions";
import {getChainId} from "./utils";
import {Shop} from "../typechain-types";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Remove shop item using account: ${owner.address} on chain id ${await getChainId(owner)}`);

  const Shop = (await ethers.getContractFactory("Shop")).connect(owner);
  const shop = Shop.attach(SHOP_ADDRESS) as Shop;

  const shopItems = [EstforConstants.CAGE, EstforConstants.LARGE_NET];
  const tx = await shop.removeItems(shopItems);
  await tx.wait();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
