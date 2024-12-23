import {EstforConstants} from "@paintswap/estfor-definitions";
import {ethers} from "hardhat";
import {PROMOTIONS_ADDRESS} from "./contractAddresses";
import {Promotion} from "@paintswap/estfor-definitions/types";
import {getChainId} from "./utils";
import {parseEther} from "ethers";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Edit a promotion using account: ${owner.address} on chain id: ${await getChainId(owner)}`);
  const promotions = await ethers.getContractAt("Promotions", PROMOTIONS_ADDRESS);
  /*
  // Edit old haloween promotion to use the new structure just cause.
  let tx = await promotions.editPromotion({
    promotion: Promotion.HALLOWEEN_2023,
    startTime: 1698701204, // Any time from now
    endTime: 1698825600, // Expires 8am UTC on Nov 1st
    minTotalXP: 6000,
    numDailyRandomItemsToPick: 1,
    isMultiday: false,
    brushCostMissedDay: "0",
    tokenCost: "0",
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
    questPrerequisiteId: 0
    });
  await tx.wait();
  console.log("edit first one"); */

  const startTime = 1701417600; // Fri dec 1st 08:00 UTC
  const numDays = 22;
  await promotions.editPromotions([
    {
      promotion: Promotion.HALLOWEEN_2024,
      startTime,
      endTime: startTime + 24 * 3600 * numDays,
      minTotalXP: 0,
      numDailyRandomItemsToPick: 0,
      isMultiday: true,
      brushCostMissedDay: "0",
      tokenCost: "0",
      redeemCodeLength: 0,
      adminOnly: false,
      promotionTiedToUser: false,
      promotionTiedToPlayer: true,
      promotionMustOwnPlayer: true,
      evolvedHeroOnly: true,
      numDaysClaimablePeriodStreakBonus: 0,
      numDaysHitNeededForStreakBonus: 0,
      numRandomStreakBonusItemsToPick1: 0,
      numRandomStreakBonusItemsToPick2: 0,
      randomStreakBonusItemTokenIds1: [],
      randomStreakBonusAmounts1: [],
      randomStreakBonusItemTokenIds2: [],
      randomStreakBonusAmounts2: [],
      guaranteedStreakBonusItemTokenIds: [],
      guaranteedStreakBonusAmounts: [],
      guaranteedItemTokenIds: [EstforConstants.COIN],
      guaranteedAmounts: [5],
      randomItemTokenIds: [],
      randomAmounts: [],
      questPrerequisiteId: 0
    }
  ]);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
