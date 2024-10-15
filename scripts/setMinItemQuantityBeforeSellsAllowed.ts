import {ethers} from "hardhat";
import {SHOP_ADDRESS} from "./contractAddresses";
import {getChainId} from "./utils";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Set minimum quantity before sells are allowed: ${owner.address} on chain id ${await getChainId(owner)}`);

  const shop = await ethers.getContractAt("Shop", SHOP_ADDRESS);
  await shop.setMinItemQuantityBeforeSellsAllowed(500);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
