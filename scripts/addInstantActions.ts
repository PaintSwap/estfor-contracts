import {ethers} from "hardhat";
import {INSTANT_ACTIONS_ADDRESS} from "./contractAddresses";
import {EstforConstants} from "@paintswap/estfor-definitions";
import {allInstantActions} from "./data/instantActions";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Add instant actions using account: ${owner.address} on chain id ${await owner.getChainId()}`);

  const instantActions = (await ethers.getContractAt("InstantActions", INSTANT_ACTIONS_ADDRESS)).connect(owner);

  const actionIds = new Set([
    EstforConstants.INSTANT_ACTION_FORGING_LIFFYN,
    EstforConstants.INSTANT_ACTION_FORGING_VANAGLOT,
    EstforConstants.INSTANT_ACTION_FORGING_FANGENSTORM,
    EstforConstants.INSTANT_ACTION_FORGING_RING,
    EstforConstants.INSTANT_ACTION_FORGING_AMULET,
    EstforConstants.INSTANT_ACTION_FORGING_TRICK_CHEST,
    EstforConstants.INSTANT_ACTION_FORGING_TREAT_CHEST,
    EstforConstants.INSTANT_ACTION_FORGING_TRICK_OR_TREAT_KEY,
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
