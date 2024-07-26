import {ethers} from "hardhat";
import {INSTANT_VRF_ACTIONS_ADDRESS} from "./contractAddresses";
import {EstforConstants} from "@paintswap/estfor-definitions";
import {allInstantVRFActions} from "./data/instantVRFActions";
import {InstantVRFActions} from "../typechain-types";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Add instant VRF actions using account: ${owner.address} on chain id ${await owner.getChainId()}`);

  const instantVRFActions = (await ethers.getContractAt("InstantVRFActions", INSTANT_VRF_ACTIONS_ADDRESS)).connect(
    owner
  ) as InstantVRFActions;

  const actionsToUpdate = new Set([
    EstforConstants.INSTANT_VRF_ACTION_THIEVING_FISHING_CHEST_1,
    EstforConstants.INSTANT_VRF_ACTION_THIEVING_FISHING_CHEST_2,
    EstforConstants.INSTANT_VRF_ACTION_THIEVING_FISHING_CHEST_3,
    EstforConstants.INSTANT_VRF_ACTION_THIEVING_FISHING_CHEST_4,
    EstforConstants.INSTANT_VRF_ACTION_THIEVING_FISHING_CHEST_5,
    EstforConstants.INSTANT_VRF_ACTION_THIEVING_WOODCUTTING_CHEST_1,
    EstforConstants.INSTANT_VRF_ACTION_THIEVING_WOODCUTTING_CHEST_2,
    EstforConstants.INSTANT_VRF_ACTION_THIEVING_WOODCUTTING_CHEST_3,
    EstforConstants.INSTANT_VRF_ACTION_THIEVING_WOODCUTTING_CHEST_4,
    EstforConstants.INSTANT_VRF_ACTION_THIEVING_WOODCUTTING_CHEST_5,
    EstforConstants.INSTANT_VRF_ACTION_THIEVING_MINING_CHEST_1,
    EstforConstants.INSTANT_VRF_ACTION_THIEVING_MINING_CHEST_2,
    EstforConstants.INSTANT_VRF_ACTION_THIEVING_MINING_CHEST_3,
    EstforConstants.INSTANT_VRF_ACTION_THIEVING_MINING_CHEST_4,
    EstforConstants.INSTANT_VRF_ACTION_THIEVING_MINING_CHEST_5,
    EstforConstants.INSTANT_VRF_ACTION_THIEVING_DRAGON_CHEST,
    EstforConstants.INSTANT_VRF_ACTION_THIEVING_BONE_CHEST,
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
