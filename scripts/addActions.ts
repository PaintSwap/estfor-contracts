import {ethers} from "hardhat";
import {WORLD_ADDRESS, WORLD_LIBRARY_ADDRESS} from "./contractAddresses";
import {allActions} from "./data/actions";
import {EstforConstants} from "@paintswap/estfor-definitions";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Add actions using account: ${owner.address}`);

  const network = await ethers.provider.getNetwork();
  console.log(`ChainId: ${network.chainId}`);

  const World = await ethers.getContractFactory("World", {libraries: {WorldLibrary: WORLD_LIBRARY_ADDRESS}});
  const world = await World.attach(WORLD_ADDRESS);

  const actions = await allActions.filter(
    (action) =>
      action.actionId === EstforConstants.ACTION_FLETCHING_ITEM ||
      action.actionId === EstforConstants.ACTION_ALCHEMY_ITEM
  );

  if (actions.length !== 2) {
    console.log("Cannot find actions");
  } else {
    await world.connect(owner).addActions(actions);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
