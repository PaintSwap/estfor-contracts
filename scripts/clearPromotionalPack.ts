import {ethers} from "hardhat";
import {PROMOTIONS_ADDRESS} from "./contractAddresses";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Clear promotional pack using account: ${owner.address} on chain id ${await owner.getChainId()}`);

  const promotions = await ethers.getContractAt("Promotions", PROMOTIONS_ADDRESS);
  await promotions.testClearPromotionalPack("0xa801864d0D24686B15682261aa05D4e1e6e5BD94");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
