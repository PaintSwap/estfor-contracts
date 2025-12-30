import {ethers} from "hardhat";
import {INSTANT_ACTIONS_ADDRESS} from "./contractAddresses";
import {EstforConstants} from "@paintswap/estfor-definitions";
import {InstantActionType} from "@paintswap/estfor-definitions/types";
import {getChainId} from "./utils";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Remove instant actions using account: ${owner.address} on chain id ${await getChainId(owner)}`);

  const instantActions = await ethers.getContractAt("InstantActions", INSTANT_ACTIONS_ADDRESS);

  const actionIds = [
    EstforConstants.INSTANT_ACTION_FORGING_ANNIV2_EGG_TIER1,
    EstforConstants.INSTANT_ACTION_FORGING_ANNIV2_AMULET,
    EstforConstants.INSTANT_ACTION_FORGING_ANNIV2_RING,
    EstforConstants.INSTANT_ACTION_FORGING_ANNIV2_POUCH
  ];
  await instantActions.removeActions(
    actionIds.map(() => InstantActionType.GENERIC),
    actionIds
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
