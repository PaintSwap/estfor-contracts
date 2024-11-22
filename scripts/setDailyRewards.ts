import {ethers} from "hardhat";
import {WORLD_ADDRESS} from "./contractAddresses";
import {getChainId, setDailyAndWeeklyRewards} from "./utils";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Set daily rewards using account: ${owner.address} as owner on chain id ${await getChainId(owner)}`);

  const world = await ethers.getContractAt("World", WORLD_ADDRESS);
  /*
  const tier1 = 1;
  let tx = await worldActions.setDailyRewardPool(tier1, allDailyRewards[tier1]);
  await tx.wait();
  tx = await worldActions.setWeeklyRewardPool(tier1, allWeeklyRewards[tier1]);
  await tx.wait();
*/
  await setDailyAndWeeklyRewards(world);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
