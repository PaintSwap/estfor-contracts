import {EstforConstants} from "@paintswap/estfor-definitions";
import {ethers} from "hardhat";
import {PROMOTIONS_ADDRESS} from "./contractAddresses";
import {Promotion} from "@paintswap/estfor-definitions/types";
import {initialiseSafe, sendTransactionSetToSafe} from "./utils";
import {OperationType, MetaTransactionData} from "@safe-global/types-kit";
import {Promotions__factory} from "../typechain-types";

async function main() {
  const [owner, , proposer] = await ethers.getSigners(); // 0 is old deployer, 2 is proposer for Safe (new deployer)
  const network = await ethers.provider.getNetwork();
  const {useSafe, apiKit, protocolKit} = await initialiseSafe(network);
  console.log(`Add promotion using account: ${proposer.address} on chain id ${network.chainId}, useSafe: ${useSafe}`);

  const promotions = await ethers.getContractAt("Promotions", PROMOTIONS_ADDRESS);

  // live value = const startTime = 1787616000;
  const startTime = 1787616000;
  const numDays = 21;
  const promos = [
    {
      promotion: Promotion.ANNIV3_2026,
      startTime,
      endTime: startTime + 24 * 3600 * numDays,
      minTotalXP: 0,
      numDailyRandomItemsToPick: 0,
      isMultiday: true,
      brushCostMissedDay: 0n,
      tokenCost: 0n,
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
      guaranteedAmounts: [200],
      randomItemTokenIds: [],
      randomAmounts: [],
      questPrerequisiteId: 0,
    },
  ];

  if (useSafe) {
    const transactionSet: MetaTransactionData[] = [];
    const iface = Promotions__factory.createInterface();

    transactionSet.push({
      to: ethers.getAddress(PROMOTIONS_ADDRESS),
      value: "0",
      data: iface.encodeFunctionData("addPromotions", [promos]),
      operation: OperationType.Call,
    });
    await sendTransactionSetToSafe(network, protocolKit, apiKit, transactionSet, proposer);
  } else {
    await promotions.connect(owner).addPromotions(promos);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
