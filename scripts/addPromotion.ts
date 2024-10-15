import {EstforConstants} from "@paintswap/estfor-definitions";
import {ethers} from "hardhat";
import {PROMOTIONS_ADDRESS} from "./contractAddresses";
import {Promotions} from "../typechain-types";
import {Promotion} from "@paintswap/estfor-definitions/types";
import {getChainId} from "./utils";
import {parseEther} from "ethers";

async function main() {
  const [owner] = await ethers.getSigners();

  console.log(`Add a promotion using account: ${owner.address} on chain id: ${await getChainId(owner)}`);
  const promotions = (await ethers.getContractAt("Promotions", PROMOTIONS_ADDRESS)) as Promotions;

  /*
  await promotions.addPromotion({
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
  }); */

  const startTime = 1701417600; // Fri dec 1st 08:00 UTC
  const numDays = 22;
  await promotions.connect(owner).addPromotion({
    promotion: Promotion.XMAS_2023,
    startTime,
    endTime: startTime + 24 * 3600 * numDays,
    minTotalXP: 0,
    numDailyRandomItemsToPick: 1,
    isMultiday: true,
    brushCostMissedDay: parseEther("25"),
    brushCost: "0",
    redeemCodeLength: 0,
    adminOnly: false,
    promotionTiedToUser: false,
    promotionTiedToPlayer: true,
    promotionMustOwnPlayer: true,
    evolvedHeroOnly: false,
    numDaysClaimablePeriodStreakBonus: 9,
    numDaysHitNeededForStreakBonus: 20,
    numRandomStreakBonusItemsToPick1: 1,
    numRandomStreakBonusItemsToPick2: 0,
    randomStreakBonusItemTokenIds1: [
      EstforConstants.HALLOWEEN_BONUS_1,
      EstforConstants.HALLOWEEN_BONUS_2,
      EstforConstants.HALLOWEEN_BONUS_3,
    ],
    randomStreakBonusAmounts1: [1, 1, 1],
    randomStreakBonusItemTokenIds2: [],
    randomStreakBonusAmounts2: [],
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
