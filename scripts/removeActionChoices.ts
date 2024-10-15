import {ethers} from "hardhat";
import {WORLD_ADDRESS} from "./contractAddresses";
import {EstforConstants} from "@paintswap/estfor-definitions";
import {getChainId} from "./utils";

// Use with caution, this will cause issues for any players that are using this actionChoice
async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Removing action choices using account: ${owner.address} on chain id ${await getChainId(owner)}`);

  const world = await ethers.getContractAt("World", WORLD_ADDRESS);
  {
    const tx = await world.removeActionChoices(EstforConstants.ACTION_FORGING_ITEM, [
      EstforConstants.ACTIONCHOICE_FORGING_GODLY_BOW,
    ]);
    await tx.wait();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
