import {ethers} from "hardhat";
import {DAILY_REWARDS_SCHEDULER_ADDRESS} from "./contractAddresses";
import {getChainId, setDailyAndWeeklyRewards} from "./utils";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Set daily rewards using account: ${owner.address} as owner on chain id ${await getChainId(owner)}`);

  const dailyRewardsScheduler = await ethers.getContractAt("DailyRewardsScheduler", DAILY_REWARDS_SCHEDULER_ADDRESS);
  /*
  const tier1 = 1;
  let tx = await dailyRewardsScheduler.setDailyRewardPool(tier1, allDailyRewards[tier1]);
  await tx.wait();
  tx = await dailyRewardsScheduler.setWeeklyRewardPool(tier1, allWeeklyRewards[tier1]);
  await tx.wait();
*/
  await setDailyAndWeeklyRewards(dailyRewardsScheduler);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
