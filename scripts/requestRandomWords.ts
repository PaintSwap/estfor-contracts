import {ethers} from "hardhat";
import {WORLD_ADDRESS} from "./contractAddresses";
import {World} from "../typechain-types";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Request random words using account: ${owner.address} for chain id ${await owner.getChainId()}`);

  const world = (await ethers.getContractAt("World", WORLD_ADDRESS)) as World;
  // Keep requesting (useful to clear a backlog on beta)
  while (true) {
    const lastRandomWordsUpdatedTime = await world.lastRandomWordsUpdatedTime();
    if (lastRandomWordsUpdatedTime + 86400 < Math.floor(Date.now() / 1000)) {
      try {
        console.log("Requesting random words");
        await world.estimateGas.requestRandomWords();
        const tx = await world.requestRandomWords();
        await tx.wait();
      } catch (error) {
        console.error(error);
      }
    } else {
      console.log("Cannot request random words yet");
    }
    await new Promise((resolve) => setTimeout(resolve, 10 * 1000));
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
