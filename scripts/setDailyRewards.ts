import {ethers} from "hardhat";
import {WORLD_ADDRESS} from "./contractAddresses";
import {getChainId, setDailyAndWeeklyRewards} from "./utils";
import {World} from "../typechain-types";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Set daily rewards using account: ${owner.address} as owner on chain id ${await getChainId(owner)}`);

  const world = (await ethers.getContractAt("World", WORLD_ADDRESS)) as World;
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
