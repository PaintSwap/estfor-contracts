import {ethers} from "hardhat";
import {INSTANT_ACTIONS_ADDRESS} from "./contractAddresses";
import {EstforConstants} from "@paintswap/estfor-definitions";
import {allInstantActions} from "./data/instantActions";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Add instant actions using account: ${owner.address} on chain id ${await owner.getChainId()}`);

  const instantActions = await ethers.getContractAt("InstantActions", INSTANT_ACTIONS_ADDRESS);
  const actions = allInstantActions.filter((action) => {
    if (action) {
      return action.actionId == EstforConstants.INSTANT_ACTION_FORGING_BATWING_PATCH;
    }
  });

  if (actions.length !== 1) {
    console.log("Cannot find actions");
  } else {
    await instantActions.addActions(actions);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
