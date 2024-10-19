import {ethers} from "hardhat";
import {PASSIVE_ACTIONS_ADDRESS} from "./contractAddresses";
import {PassiveActions} from "../typechain-types";
import {allPassiveActions} from "./data/passiveActions";
import {EstforConstants} from "@paintswap/estfor-definitions";
import {isBeta} from "./utils";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Edit passive actions using account: ${owner.address} on chain id ${await owner.getChainId()}`);

  const passiveActions = (await ethers.getContractAt("PassiveActions", PASSIVE_ACTIONS_ADDRESS)).connect(
    owner
  ) as PassiveActions;

  const actionsToReduce = [
    EstforConstants.PASSIVE_ACTION_EGG_TIER1,
    EstforConstants.PASSIVE_ACTION_EGG_TIER2,
    EstforConstants.PASSIVE_ACTION_SECRET_EGG_1_TIER2,
    EstforConstants.PASSIVE_ACTION_SECRET_EGG_2_TIER2,
    EstforConstants.PASSIVE_ACTION_SECRET_EGG_3_TIER2,
    EstforConstants.PASSIVE_ACTION_SECRET_EGG_4_TIER2,

    EstforConstants.PASSIVE_ACTION_EGG_TIER3,
    EstforConstants.PASSIVE_ACTION_SECRET_EGG_1_TIER3,
    EstforConstants.PASSIVE_ACTION_SECRET_EGG_2_TIER3,
    EstforConstants.PASSIVE_ACTION_SECRET_EGG_3_TIER3,
    EstforConstants.PASSIVE_ACTION_SECRET_EGG_4_TIER3,

    EstforConstants.PASSIVE_ACTION_EGG_TIER4,
    EstforConstants.PASSIVE_ACTION_SECRET_EGG_1_TIER4,
    EstforConstants.PASSIVE_ACTION_SECRET_EGG_2_TIER4,
    EstforConstants.PASSIVE_ACTION_SECRET_EGG_3_TIER4,
    EstforConstants.PASSIVE_ACTION_SECRET_EGG_4_TIER4,

    EstforConstants.PASSIVE_ACTION_EGG_TIER5,
    EstforConstants.PASSIVE_ACTION_SECRET_EGG_1_TIER5,
    EstforConstants.PASSIVE_ACTION_SECRET_EGG_2_TIER5,
    EstforConstants.PASSIVE_ACTION_SECRET_EGG_3_TIER5,
    EstforConstants.PASSIVE_ACTION_SECRET_EGG_4_TIER5,
  ];

  const values = [0, 2, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  const map = new Map();
  actionsToReduce.forEach((key, index) => {
    map.set(key, values[index]);
  });

  const actions = allPassiveActions.filter((action) => map.has(action.actionId));

  const actionsToEdit = isBeta
    ? actions.map((passiveAction) => {
        const actionId = passiveAction.actionId;

        let durationDays = map.has(actionId) ? map.get(actionId) : passiveAction.info.durationDays;
        return {
          ...passiveAction,
          info: {
            ...passiveAction.info,
            durationDays,
          },
        };
      })
    : actions;

  if (actionsToEdit.length !== actionsToReduce.length) {
    console.log("Cannot find actions");
  } else {
    await passiveActions.editActions(actionsToEdit);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
