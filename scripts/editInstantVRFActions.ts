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
    EstforConstants.INSTANT_VRF_ACTION_FARMING_WILD_SEED,
    EstforConstants.INSTANT_VRF_ACTION_FARMING_UNKNOWN_SEED,
    EstforConstants.INSTANT_VRF_ACTION_FARMING_MYSTERIOUS_SEED,
    EstforConstants.INSTANT_VRF_ACTION_FARMING_OBSCURE_SEED,
    EstforConstants.INSTANT_VRF_ACTION_FARMING_ANCIENT_SEED
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
