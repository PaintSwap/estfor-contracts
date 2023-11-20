import {EstforConstants} from "@paintswap/estfor-definitions";
import {ethers} from "hardhat";
import {PROMOTIONS_ADDRESS} from "./contractAddresses";
import {Promotions} from "../typechain-types";
import {Promotion} from "@paintswap/estfor-definitions/types";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Edit a promotion using account: ${owner.address} on chain id: ${await owner.getChainId()}`);
  const promotions = (await ethers.getContractAt("Promotions", PROMOTIONS_ADDRESS)) as Promotions;

  // Edit old haloween promotion to use the new structure just cause.
  let tx = await promotions.connect(owner).editPromotion({
    promotion: Promotion.HALLOWEEN_2023,
    startTime: 1698701204, // Any time from now
    endTime: 1698825600, // Expires 8am UTC on Nov 1st
    minTotalXP: 6000,
    numDailyRandomItemsToPick: 1,
    isMultiday: false,
    brushCost: "0",
    redeemCodeLength: 0,
    adminOnly: false,
    promotionTiedToUser: false,
    promotionTiedToPlayer: false,
    promotionMustOwnPlayer: false,
    evolvedHeroOnly: false,
    numDaysClaimablePeriodStreakBonus: 0,
    numDaysHitNeededForStreakBonus: 0,
    numRandomStreakBonusItemsToPick1: 0,
    numRandomStreakBonusItemsToPick2: 0,
    randomStreakBonusItemTokenIds1: [],
    randomStreakBonusAmounts1: [],
    randomStreakBonusAmounts2: [],
    randomStreakBonusItemTokenIds2: [],
    guaranteedStreakBonusItemTokenIds: [],
    guaranteedStreakBonusAmounts: [],
    guaranteedItemTokenIds: [],
    guaranteedAmounts: [],
    randomItemTokenIds: [
      EstforConstants.HALLOWEEN_BONUS_1,
      EstforConstants.HALLOWEEN_BONUS_2,
      EstforConstants.HALLOWEEN_BONUS_3,
    ],
    randomAmounts: [1, 1, 1],
  });
  await tx.wait();
  console.log("edit first one");

  const startTime = 1700479057; // mon nov 20th 11:17 UTC
  const numDays = 2;
  await promotions.connect(owner).editPromotion({
    promotion: Promotion.XMAS_2023,
    startTime,
    endTime: startTime + 24 * 3600 * numDays,
    minTotalXP: 0,
    numDailyRandomItemsToPick: 1,
    isMultiday: true,
    brushCost: "0",
    redeemCodeLength: 0,
    adminOnly: false,
    promotionTiedToUser: false,
    promotionTiedToPlayer: false,
    promotionMustOwnPlayer: false,
    evolvedHeroOnly: false,
    numDaysClaimablePeriodStreakBonus: 1,
    numDaysHitNeededForStreakBonus: 1,
    numRandomStreakBonusItemsToPick1: 1,
    numRandomStreakBonusItemsToPick2: 0,
    randomStreakBonusItemTokenIds1: [
      EstforConstants.HALLOWEEN_BONUS_1,
      EstforConstants.HALLOWEEN_BONUS_2,
      EstforConstants.HALLOWEEN_BONUS_3,
    ],
    randomStreakBonusAmounts1: [1, 1, 1],
    randomStreakBonusAmounts2: [],
    randomStreakBonusItemTokenIds2: [],
    guaranteedStreakBonusItemTokenIds: [],
    guaranteedStreakBonusAmounts: [],
    guaranteedItemTokenIds: [],
    guaranteedAmounts: [],
    randomItemTokenIds: [],
    randomAmounts: [],
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
