import {ethers} from "hardhat";
import {INSTANT_VRF_ACTIONS_ADDRESS} from "./contractAddresses";
import {EstforConstants} from "@paintswap/estfor-definitions";
import {allInstantVRFActions} from "./data/instantVRFActions";
import {getChainId} from "./utils";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Add instant VRF actions using account: ${owner.address} on chain id ${await getChainId(owner)}`);

  const instantVRFActions = await ethers.getContractAt("InstantVRFActions", INSTANT_VRF_ACTIONS_ADDRESS);

  const actionsToUpdate = new Set([
    EstforConstants.INSTANT_VRF_ACTION_THIEVING_ANNIV1_CHEST,
    EstforConstants.INSTANT_VRF_ACTION_ANNIV1_EGG_TIER1,
    EstforConstants.INSTANT_VRF_ACTION_ANNIV1_EGG_TIER2,
    EstforConstants.INSTANT_VRF_ACTION_ANNIV1_EGG_TIER3,
    EstforConstants.INSTANT_VRF_ACTION_ANNIV1_EGG_TIER4,
    EstforConstants.INSTANT_VRF_ACTION_ANNIV1_EGG_TIER5
  ]);

  const actions = allInstantVRFActions.filter((action) => actionsToUpdate.has(action.actionId));
  if (actions.length !== actionsToUpdate.size) {
    console.log("Cannot find actions");
  } else {
    await instantVRFActions.addActions(actions);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
