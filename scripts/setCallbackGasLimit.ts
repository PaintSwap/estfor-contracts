import {ethers} from "hardhat";
import {RANDOMNESS_BEACON_ADDRESS} from "./contractAddresses";
import {getChainId} from "./utils";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Set callback gas limit using account: ${owner.address} on chain id ${await getChainId(owner)}`);

  const randomnessBeacon = await ethers.getContractAt("RandomnessBeacon", RANDOMNESS_BEACON_ADDRESS);
  await randomnessBeacon.setExpectedGasLimitFulfill(400_000);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
