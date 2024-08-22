import {ethers} from "hardhat";
import {INSTANT_VRF_ACTIONS_ADDRESS, PASSIVE_ACTIONS_ADDRESS} from "./contractAddresses";
import {InstantVRFActions, PassiveActions} from "../typechain-types";
import {allPassiveActions} from "./data/passiveActions";
import {allInstantVRFActions} from "./data/instantVRFActions";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(
    `Edit passive & instant VRF actions is available using account: ${
      owner.address
    } on chain id ${await owner.getChainId()}`
  );

  const isAvailable = true;

  // Passive actions
  const passiveActions = (await ethers.getContractAt("PassiveActions", PASSIVE_ACTIONS_ADDRESS)).connect(
    owner
  ) as PassiveActions;

  const passiveActionIds = allPassiveActions.map((passiveAction) => {
    return passiveAction.actionId;
  });
  if (passiveActionIds.length !== allPassiveActions.length) {
    console.log("Cannot find actions");
  } else {
    await passiveActions.setAvailable(passiveActionIds, isAvailable);
  }

  const instantVRFActions = (await ethers.getContractAt("InstantVRFActions", INSTANT_VRF_ACTIONS_ADDRESS)).connect(
    owner
  ) as InstantVRFActions;

  const instantVRFActionIds = allInstantVRFActions.map((instantVRFAction) => {
    return instantVRFAction.actionId;
  });
  if (instantVRFActionIds.length !== allInstantVRFActions.length) {
    console.log("Cannot find actions");
  } else {
    await instantVRFActions.setAvailable(instantVRFActionIds, isAvailable);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
