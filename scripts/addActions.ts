import {ethers} from "hardhat";
import {WORLD_ADDRESS} from "./contractAddresses";
import {allActions} from "./data/actions";
import {EstforConstants} from "@paintswap/estfor-definitions";
import {World} from "../typechain-types";
import {getChainId} from "./utils";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Add actions using account: ${owner.address} on chain id ${await getChainId(owner)}`);

  const world = (await ethers.getContractAt("World", WORLD_ADDRESS)).connect(owner) as World;

  const actionIds = new Set([EstforConstants.ACTION_COMBAT_NIGHTMARE_NATUOW]);
  const actions = allActions.filter((action) => actionIds.has(action.actionId));

  if (actions.length !== actionIds.size) {
    console.log("Cannot find actions");
  } else {
    const tx = await world.connect(owner).addActions(actions);
    await tx.wait();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
