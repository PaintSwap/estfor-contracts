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
    EstforConstants.INSTANT_ACTION_FORGING_ANNIV2_POUCH,
    EstforConstants.INSTANT_ACTION_FORGING_ANNIV2_RING,
    EstforConstants.INSTANT_ACTION_FORGING_ANNIV2_AMULET,
    EstforConstants.INSTANT_ACTION_FORGING_ANNIV2_EGG_TIER1
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
