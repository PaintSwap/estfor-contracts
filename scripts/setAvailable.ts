import {ethers} from "hardhat";
import {
  INSTANT_ACTIONS_ADDRESS,
  INSTANT_VRF_ACTIONS_ADDRESS,
  PASSIVE_ACTIONS_ADDRESS,
  WORLD_ADDRESS
} from "./contractAddresses";
import {InstantActions, InstantVRFActions, PassiveActions, World} from "../typechain-types";
import {EstforConstants} from "@paintswap/estfor-definitions";
import {InstantActionType} from "@paintswap/estfor-definitions/types";
import {allActions} from "./data/actions";
import {getChainId} from "./utils";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(
    `Edit passive & instant VRF actions is available using account: ${owner.address} on chain id ${await getChainId(
      owner
    )}`
  );

  const isAvailable = false;
  // DONE
  const world = (await ethers.getContractAt("World", WORLD_ADDRESS)) as World;

  const actionIds = new Set([EstforConstants.ACTION_COMBAT_NIGHTMARE_NATUOW]);
  const actions = allActions.filter((action) => actionIds.has(action.actionId));

  if (actions.length !== actionIds.size) {
    console.log("Cannot find actions");
    return;
  } else {
    const tx = await world.editActions(actions);
    await tx.wait();
    console.log("Edit available actions");
  }

  // Passive actions
  // TODO: Don't remove these yet, wait a few months
  const passiveActions = (await ethers.getContractAt("PassiveActions", PASSIVE_ACTIONS_ADDRESS)) as PassiveActions;

  const passiveActionIdsToRemove = [EstforConstants.PASSIVE_ACTION_ANNIV1_EGG_TIER4];
  let tx = await passiveActions.setAvailable(passiveActionIdsToRemove, isAvailable);
  await tx.wait();
  console.log("Set available passive actions");

  // Instant VRF actions
  // TODO: Don't remove these yet, wait a few months
  const instantVRFActionIds = [
    EstforConstants.INSTANT_VRF_ACTION_ANNIV1_EGG_TIER1,
    EstforConstants.INSTANT_VRF_ACTION_ANNIV1_EGG_TIER2,
    EstforConstants.INSTANT_VRF_ACTION_ANNIV1_EGG_TIER3,
    EstforConstants.INSTANT_VRF_ACTION_ANNIV1_EGG_TIER4,
    EstforConstants.INSTANT_VRF_ACTION_ANNIV1_EGG_TIER5,
    EstforConstants.INSTANT_VRF_ACTION_THIEVING_ANNIV1_CHEST
  ];

  const instantVRFActions = (await ethers.getContractAt(
    "InstantVRFActions",
    INSTANT_VRF_ACTIONS_ADDRESS
  )) as InstantVRFActions;
  tx = await instantVRFActions.setAvailable(instantVRFActionIds, isAvailable);
  await tx.wait();
  console.log("Set available instant VRF actions");

  // Instant Actions (DONE)
  const instantActionIds = [
    EstforConstants.INSTANT_ACTION_FORGING_ANNIV1_CHEST,
    EstforConstants.INSTANT_ACTION_FORGING_ANNIV1_EGG_TIER1,
    EstforConstants.INSTANT_ACTION_FORGING_ANNIV1_KEY,
    EstforConstants.INSTANT_ACTION_FORGING_ANNIV1_RING
  ];
  const instantActions = (await ethers.getContractAt("InstantActions", INSTANT_ACTIONS_ADDRESS)) as InstantActions;

  tx = await instantActions.removeActions(
    [InstantActionType.GENERIC, InstantActionType.GENERIC, InstantActionType.GENERIC, InstantActionType.GENERIC],
    instantActionIds
  );
  await tx.wait();
  console.log("Set available instant actions");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
