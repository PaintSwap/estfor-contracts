import {ethers} from "hardhat";
import {RANDOMNESS_BEACON_ADDRESS} from "./contractAddresses";
import {getChainId} from "./utils";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Request random words using account: ${owner.address} for chain id ${await getChainId(owner)}`);

  const randomnessBeacon = await ethers.getContractAt("RandomnessBeacon", RANDOMNESS_BEACON_ADDRESS);
  // Keep requesting (useful to clear a backlog on beta)
  while (true) {
    const lastRandomWordsUpdatedTime = await randomnessBeacon.lastRandomWordsUpdatedTime();
    if (lastRandomWordsUpdatedTime + 86400n < BigInt(Math.floor(Date.now() / 1000))) {
      try {
        console.log("Requesting random words");
        await randomnessBeacon.requestRandomWords.estimateGas();
        const tx = await randomnessBeacon.requestRandomWords();
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
