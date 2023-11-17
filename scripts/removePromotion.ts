import {ethers} from "hardhat";
import {PROMOTIONS_ADDRESS} from "./contractAddresses";
import {Promotions} from "../typechain-types";
import {Promotion} from "@paintswap/estfor-definitions/types";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Removing a promotion using account: ${owner.address} on chain id: ${await owner.getChainId()}`);
  const promotions = (await ethers.getContractAt("Promotions", PROMOTIONS_ADDRESS)) as Promotions;
  await promotions.removePromotion(Promotion.HALLOWEEN_2023);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
