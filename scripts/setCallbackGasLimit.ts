import {ethers} from "hardhat";
import {WORLD_ADDRESS} from "./contractAddresses";
import {World} from "../typechain-types";
import {getChainId} from "./utils";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Set callback gas limit using account: ${owner.address} on chain id ${await getChainId(owner)}`);

  const world = (await ethers.getContractAt("World", WORLD_ADDRESS)) as World;
  await world.setExpectedGasLimitFulfill(400_000);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
