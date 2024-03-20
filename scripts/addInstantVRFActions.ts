import {ethers} from "hardhat";
import {INSTANT_VRF_ACTIONS_ADDRESS} from "./contractAddresses";
import {EstforConstants} from "@paintswap/estfor-definitions";
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

  const actions = allInstantVRFActions;
  if (actions.length !== 20) {
    console.log("Cannot find actions");
  } else {
    await instantVRFActions.addActions(actions);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
