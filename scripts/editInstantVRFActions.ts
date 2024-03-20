import {ethers} from "hardhat";
import {INSTANT_VRF_ACTIONS_ADDRESS} from "./contractAddresses";
import {EstforConstants} from "@paintswap/estfor-definitions";
import {allInstantVRFActions} from "./data/instantVRFActions";

// Untested
async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Edit instant vrf actions using account: ${owner.address} on chain id ${await owner.getChainId()}`);

  const instantVRFActions = await ethers.getContractAt("InstantVRFActions", INSTANT_VRF_ACTIONS_ADDRESS);
  const actions = allInstantVRFActions.filter(
    (action) => action.actionId == EstforConstants.INSTANT_VRF_ACTION_FORGING_ORICHALCUM_HELMET
  );

  if (actions.length !== 1) {
    console.log("Cannot find all instant vrf actions");
  } else {
    await instantVRFActions.editActions(actions);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
