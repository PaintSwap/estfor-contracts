import {ethers} from "hardhat";
import {INSTANT_VRF_ACTIONS_ADDRESS} from "./contractAddresses";
import {EstforConstants} from "@paintswap/estfor-definitions";
//import {allInstantVRFActions} from "./data/instantVRFActions";
import {allInstantVRFActions} from "./data/instantVRFActions";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Add instant VRF actions using account: ${owner.address} on chain id ${await owner.getChainId()}`);

  const instantVRFActions = (await ethers.getContractAt("InstantVRFActions", INSTANT_VRF_ACTIONS_ADDRESS)).connect(
    owner
  );
  /*  const actions = allInstantVRFActions.filter((action) => {
    if (action) {
      return (
        action.actionId == EstforConstants.INSTANT_VRF_ACTION_FORGING_ORICHALCUM_HELMET
      );
    }
  }); */

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
  if (actions.length !== 25) {
    console.log("Cannot find actions");
  } else {
    await instantVRFActions.addActions(actions);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
