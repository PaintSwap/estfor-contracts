import {ethers} from "hardhat";
import {INSTANT_VRF_ACTIONS_ADDRESS} from "./contractAddresses";
import {EstforConstants} from "@paintswap/estfor-definitions";
import {allInstantVRFActions} from "./data/instantVRFActions";
import {getChainId} from "./utils";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Edit instant vrf actions using account: ${owner.address} on chain id ${await getChainId(owner)}`);

  const instantVRFActions = await ethers.getContractAt("InstantVRFActions", INSTANT_VRF_ACTIONS_ADDRESS);

  const actionsToUpdate = new Set([
    EstforConstants.INSTANT_VRF_ACTION_EGG_TIER1,
    EstforConstants.INSTANT_VRF_ACTION_EGG_TIER2,
    EstforConstants.INSTANT_VRF_ACTION_EGG_TIER3,
    EstforConstants.INSTANT_VRF_ACTION_EGG_TIER4,
    EstforConstants.INSTANT_VRF_ACTION_EGG_TIER5,
    EstforConstants.INSTANT_VRF_ACTION_SECRET_EGG_1_TIER1,
    EstforConstants.INSTANT_VRF_ACTION_SECRET_EGG_1_TIER2,
    EstforConstants.INSTANT_VRF_ACTION_SECRET_EGG_1_TIER3,
    EstforConstants.INSTANT_VRF_ACTION_SECRET_EGG_1_TIER4,
    EstforConstants.INSTANT_VRF_ACTION_SECRET_EGG_1_TIER5,
    EstforConstants.INSTANT_VRF_ACTION_SECRET_EGG_2_TIER1,
    EstforConstants.INSTANT_VRF_ACTION_SECRET_EGG_2_TIER2,
    EstforConstants.INSTANT_VRF_ACTION_SECRET_EGG_2_TIER3,
    EstforConstants.INSTANT_VRF_ACTION_SECRET_EGG_2_TIER4,
    EstforConstants.INSTANT_VRF_ACTION_SECRET_EGG_2_TIER5,
    EstforConstants.INSTANT_VRF_ACTION_SECRET_EGG_3_TIER1,
    EstforConstants.INSTANT_VRF_ACTION_SECRET_EGG_3_TIER2,
    EstforConstants.INSTANT_VRF_ACTION_SECRET_EGG_3_TIER3,
    EstforConstants.INSTANT_VRF_ACTION_SECRET_EGG_3_TIER4,
    EstforConstants.INSTANT_VRF_ACTION_SECRET_EGG_3_TIER5,
    EstforConstants.INSTANT_VRF_ACTION_SECRET_EGG_4_TIER1,
    EstforConstants.INSTANT_VRF_ACTION_SECRET_EGG_4_TIER2,
    EstforConstants.INSTANT_VRF_ACTION_SECRET_EGG_4_TIER3,
    EstforConstants.INSTANT_VRF_ACTION_SECRET_EGG_4_TIER4,
    EstforConstants.INSTANT_VRF_ACTION_SECRET_EGG_4_TIER5,
  ]);

  const actions = allInstantVRFActions.filter((action) => actionsToUpdate.has(action.actionId));

  if (actions.length !== actionsToUpdate.size) {
    console.log("Cannot find all instant vrf actions");
  } else {
    await instantVRFActions.editActions(actions);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
