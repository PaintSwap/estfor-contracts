import {ethers} from "hardhat";
import {INSTANT_ACTIONS_ADDRESS} from "./contractAddresses";
import {EstforConstants} from "@paintswap/estfor-definitions";
import {allInstantActions} from "./data/instantActions";
import {InstantActionInput} from "@paintswap/estfor-definitions/types";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Edit instant actions using account: ${owner.address} on chain id ${await owner.getChainId()}`);

  const instantActions = await ethers.getContractAt("InstantActions", INSTANT_ACTIONS_ADDRESS);
  const action = allInstantActions.find((action) => {
    if (action) {
      return action.actionId == EstforConstants.INSTANT_ACTION_FORGING_IRON_ARMOR;
    }
  }) as InstantActionInput;

  await instantActions.editActions([action]);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
