import {ethers} from "hardhat";
import {WORLD_ADDRESS, WORLD_LIBRARY_ADDRESS} from "./contractAddresses";
import {allDailyRewards, allWeeklyRewards} from "./data/dailyRewards";
import {setDailyAndWeeklyRewards} from "./utils";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Add daily rewards using account: ${owner.address}`);

  const network = await ethers.provider.getNetwork();
  console.log(`ChainId: ${network.chainId}`);

  const World = await ethers.getContractFactory("World", {libraries: {WorldLibrary: WORLD_LIBRARY_ADDRESS}});
  const world = await World.attach(WORLD_ADDRESS);
  /*
  const tier1 = 1;
  let tx = await world.setDailyRewardPool(tier1, allDailyRewards[tier1]);
  await tx.wait();
  tx = await world.setWeeklyRewardPool(tier1, allWeeklyRewards[tier1]);
  await tx.wait();
*/
  await setDailyAndWeeklyRewards(world);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
