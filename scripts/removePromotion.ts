import {ethers} from "hardhat";
import {PROMOTIONS_ADDRESS} from "./contractAddresses";
import {Promotion} from "@paintswap/estfor-definitions/types";
import {getChainId} from "./utils";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Removing a promotion using account: ${owner.address} on chain id: ${await getChainId(owner)}`);
  const promotions = await ethers.getContractAt("Promotions", PROMOTIONS_ADDRESS);
  await promotions.removePromotions([Promotion.XMAS_2023]);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
