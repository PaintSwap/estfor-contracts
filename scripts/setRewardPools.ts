import {ethers} from "hardhat";
import {WORLD_ADDRESS, WORLD_LIBRARY_ADDRESS} from "./contractAddresses";
import {setDailyAndWeeklyRewards} from "./utils";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Set reward pools with: ${owner.address}`);

  const network = await ethers.provider.getNetwork();
  console.log(`ChainId: ${network.chainId}`);

  const World = await ethers.getContractFactory("World", {libraries: {WorldLibrary: WORLD_LIBRARY_ADDRESS}});
  const world = await World.attach(WORLD_ADDRESS);

  await setDailyAndWeeklyRewards(world);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
