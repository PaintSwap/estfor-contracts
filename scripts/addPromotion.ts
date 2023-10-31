import {EstforConstants} from "@paintswap/estfor-definitions";
import {ethers} from "hardhat";
import {PROMOTIONS_ADDRESS} from "./contractAddresses";
import {Promotions} from "../typechain-types";
import {Promotion} from "@paintswap/estfor-definitions/types";

async function main() {
  const [owner] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  console.log(`Adding a promotion using account: ${owner.address} on ChainId: ${network.chainId}`);
  const promotions = (await ethers.getContractAt("Promotions", PROMOTIONS_ADDRESS)) as Promotions;

  await promotions.addPromotion({
    promotion: Promotion.HALLOWEEN_2023,
    dateStart: 1698701204, // Any time from now
    dateEnd: 1698825600, // Expires 8am UTC on Nov 1st
    minTotalXP: 6000,
    numItemsToPick: 1,
    isRandom: true,
    itemTokenIds: [
      EstforConstants.HALLOWEEN_BONUS_1,
      EstforConstants.HALLOWEEN_BONUS_2,
      EstforConstants.HALLOWEEN_BONUS_3,
    ],
    amounts: [1, 1, 1],
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
