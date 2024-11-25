import {ethers} from "hardhat";
import {INSTANT_ACTIONS_ADDRESS} from "./contractAddresses";
import {EstforConstants} from "@paintswap/estfor-definitions";
import {allInstantActions} from "./data/instantActions";
import {getChainId} from "./utils";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Add instant actions using account: ${owner.address} on chain id ${await getChainId(owner)}`);

  const instantActions = await ethers.getContractAt("InstantActions", INSTANT_ACTIONS_ADDRESS);

  const actionIds = new Set([
    EstforConstants.INSTANT_ACTION_FORGING_ANNIV1_EGG_TIER1,
    EstforConstants.INSTANT_ACTION_FORGING_ANNIV1_RING,
    EstforConstants.INSTANT_ACTION_FORGING_ANNIV1_KEY,
    EstforConstants.INSTANT_ACTION_FORGING_ANNIV1_CHEST
  ]);

  const actions = allInstantActions.filter((action) => {
    if (action) {
      return actionIds.has(action.actionId);
    }
  });

  if (actions.length !== actionIds.size) {
    console.log("Cannot find actions");
  } else {
    await instantActions.addActions(actions);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
