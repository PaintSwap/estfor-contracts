import {EstforConstants} from "@paintswap/estfor-definitions";
import {ethers} from "hardhat";
import {PROMOTIONS_ADDRESS} from "./contractAddresses";
import {Promotions} from "../typechain-types";
import {Promotion} from "@paintswap/estfor-definitions/types";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Edit a promotion using account: ${owner.address} on chain id: ${await owner.getChainId()}`);
  const promotions = (await ethers.getContractAt("Promotions", PROMOTIONS_ADDRESS)) as Promotions;

  await promotions.editPromotion({
    promotion: Promotion.HALLOWEEN_2023,
    startTime: 1698701204, // Any time from now
    endTime: 1698825600, // Expires 8am UTC on Nov 1st
    minTotalXP: 6000,
    numItemsToPick: 1,
    isRandom: true,
    isMultiday: false,
    numDaysClaimablePeriodStreakBonus: 0,
    numDaysHitNeededForStreakBonus: 0,
    isStreakBonusRandom: false,
    numStreakBonusItemsToPick: 0,
    streakBonusItemTokenIds: [],
    streakBonusAmounts: [],
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
