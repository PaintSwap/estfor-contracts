import {ethers} from "hardhat";
import {WORLD_ACTIONS_ADDRESS} from "./contractAddresses";
import {allActions} from "./data/actions";
import {EstforConstants} from "@paintswap/estfor-definitions";
import {World} from "../typechain-types";
import {getChainId} from "./utils";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Add actions using account: ${owner.address} on chain id ${await getChainId(owner)}`);

  const worldActions = await ethers.getContractAt("WorldActions", WORLD_ACTIONS_ADDRESS);

  const actionIds = new Set([EstforConstants.ACTION_COMBAT_NIGHTMARE_NATUOW]);
  const actions = allActions.filter((action) => actionIds.has(action.actionId));

  if (actions.length !== actionIds.size) {
    console.log("Cannot find actions");
  } else {
    const tx = await worldActions.addActions(actions);
    await tx.wait();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
