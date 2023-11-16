import {ethers} from "hardhat";
import {INSTANT_ACTIONS_ADDRESS} from "./contractAddresses";
import {EstforConstants} from "@paintswap/estfor-definitions";
import {InstantActionType} from "@paintswap/estfor-definitions/types";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Remove instant actions using account: ${owner.address} on chain id ${await owner.getChainId()}`);

  const instantActions = await ethers.getContractAt("InstantActions", INSTANT_ACTIONS_ADDRESS);
  await instantActions.removeActions(
    [InstantActionType.FORGING_COMBINE],
    [EstforConstants.INSTANT_ACTION_FORGING_IRON_ARMOR]
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
