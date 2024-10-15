import {ethers} from "hardhat";
import {PROMOTIONS_ADDRESS} from "./contractAddresses";
import {Promotion} from "@paintswap/estfor-definitions/types";
import {getChainId} from "./utils";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Clear player promotion using account: ${owner.address} on chain id ${await getChainId(owner)}`);

  const promotions = await ethers.getContractAt("Promotions", PROMOTIONS_ADDRESS);
  const playerId = 3;
  await promotions.testClearPlayerPromotion(playerId, Promotion.XMAS_2023);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
