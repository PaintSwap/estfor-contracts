import {ethers} from "hardhat";
import {WORLD_ADDRESS, WORLD_LIBRARY_ADDRESS} from "./contractAddresses";
import {allActionChoiceIdsAlchemy, allActionChoiceIdsFletching} from "./data/actionChoiceIds";
import {EstforConstants} from "@paintswap/estfor-definitions";

// Use with caution, this will cause issues for any players that are using this actionChoice
async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Removing action choices using account: ${owner.address}`);

  const network = await ethers.provider.getNetwork();
  console.log(`ChainId: ${network.chainId}`);

  const World = await ethers.getContractFactory("World", {libraries: {WorldLibrary: WORLD_LIBRARY_ADDRESS}});
  const world = await World.attach(WORLD_ADDRESS);

  {
    const tx = await world.removeActionChoices(EstforConstants.ACTION_FLETCHING_ITEM, allActionChoiceIdsFletching);
    await tx.wait();
  }
  {
    const tx = await world.removeActionChoices(EstforConstants.ACTION_ALCHEMY_ITEM, allActionChoiceIdsAlchemy);
    await tx.wait();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
