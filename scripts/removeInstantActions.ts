import {ethers} from "hardhat";
import {INSTANT_ACTIONS_ADDRESS} from "./contractAddresses";
import {EstforConstants} from "@paintswap/estfor-definitions";
import {InstantActionType} from "@paintswap/estfor-definitions/types";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Remove instant actions using account: ${owner.address} on chain id ${await owner.getChainId()}`);

  const instantActions = await ethers.getContractAt("InstantActions", INSTANT_ACTIONS_ADDRESS);

  const actionIds = [
    EstforConstants.INSTANT_ACTION_FORGING_LIFFYN,
    EstforConstants.INSTANT_ACTION_FORGING_VANAGLOT,
    EstforConstants.INSTANT_ACTION_FORGING_FANGENSTORM,
    EstforConstants.INSTANT_ACTION_FORGING_RING,
    EstforConstants.INSTANT_ACTION_FORGING_AMULET,
    EstforConstants.INSTANT_ACTION_FORGING_TRICK_CHEST,
    EstforConstants.INSTANT_ACTION_FORGING_TREAT_CHEST,
    EstforConstants.INSTANT_ACTION_FORGING_TRICK_OR_TREAT_KEY,
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
