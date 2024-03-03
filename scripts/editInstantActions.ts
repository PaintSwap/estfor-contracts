import {ethers} from "hardhat";
import {INSTANT_ACTIONS_ADDRESS} from "./contractAddresses";
import {EstforConstants} from "@paintswap/estfor-definitions";
import {allInstantActions} from "./data/instantActions";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Edit instant actions using account: ${owner.address} on chain id ${await owner.getChainId()}`);

  const instantActions = await ethers.getContractAt("InstantActions", INSTANT_ACTIONS_ADDRESS);
  const actions = allInstantActions.filter(
    (action) =>
      action.actionId == EstforConstants.INSTANT_ACTION_FORGING_NATUOW_LEATHER ||
      action.actionId == EstforConstants.INSTANT_ACTION_FORGING_ROPE ||
      action.actionId == EstforConstants.INSTANT_ACTION_FORGING_ACORN_PATCH
  );

  if (actions.length !== 3) {
    console.log("Cannot find all instant actions");
  } else {
    await instantActions.editActions(actions);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
