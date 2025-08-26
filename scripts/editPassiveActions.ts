import {ethers} from "hardhat";
import {PASSIVE_ACTIONS_ADDRESS} from "./contractAddresses";
import {allPassiveActions} from "./data/passiveActions";
import {EstforConstants} from "@paintswap/estfor-definitions";
import {getChainId, isBeta} from "./utils";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Edit passive actions using account: ${owner.address} on chain id ${await getChainId(owner)}`);

  const passiveActions = await ethers.getContractAt("PassiveActions", PASSIVE_ACTIONS_ADDRESS);

  const actionsToReduce = [
    EstforConstants.PASSIVE_ACTION_KRAGSTYR_EGG_TIER1,

    EstforConstants.PASSIVE_ACTION_EGG_TIER1,
    EstforConstants.PASSIVE_ACTION_EGG_TIER2,
    EstforConstants.PASSIVE_ACTION_SECRET_EGG_1_TIER2,
    EstforConstants.PASSIVE_ACTION_SECRET_EGG_2_TIER2,
    EstforConstants.PASSIVE_ACTION_SECRET_EGG_3_TIER2,
    EstforConstants.PASSIVE_ACTION_SECRET_EGG_4_TIER2,
    EstforConstants.PASSIVE_ACTION_ANNIV1_EGG_TIER2,
    EstforConstants.PASSIVE_ACTION_KRAGSTYR_EGG_TIER2,

    EstforConstants.PASSIVE_ACTION_EGG_TIER3,
    EstforConstants.PASSIVE_ACTION_SECRET_EGG_1_TIER3,
    EstforConstants.PASSIVE_ACTION_SECRET_EGG_2_TIER3,
    EstforConstants.PASSIVE_ACTION_SECRET_EGG_3_TIER3,
    EstforConstants.PASSIVE_ACTION_SECRET_EGG_4_TIER3,
    EstforConstants.PASSIVE_ACTION_ANNIV1_EGG_TIER3,
    EstforConstants.PASSIVE_ACTION_KRAGSTYR_EGG_TIER3,

    EstforConstants.PASSIVE_ACTION_EGG_TIER4,
    EstforConstants.PASSIVE_ACTION_SECRET_EGG_1_TIER4,
    EstforConstants.PASSIVE_ACTION_SECRET_EGG_2_TIER4,
    EstforConstants.PASSIVE_ACTION_SECRET_EGG_3_TIER4,
    EstforConstants.PASSIVE_ACTION_SECRET_EGG_4_TIER4,
    EstforConstants.PASSIVE_ACTION_ANNIV1_EGG_TIER4,
    EstforConstants.PASSIVE_ACTION_KRAGSTYR_EGG_TIER4,

    EstforConstants.PASSIVE_ACTION_EGG_TIER5,
    EstforConstants.PASSIVE_ACTION_SECRET_EGG_1_TIER5,
    EstforConstants.PASSIVE_ACTION_SECRET_EGG_2_TIER5,
    EstforConstants.PASSIVE_ACTION_SECRET_EGG_3_TIER5,
    EstforConstants.PASSIVE_ACTION_SECRET_EGG_4_TIER5,
    EstforConstants.PASSIVE_ACTION_ANNIV1_EGG_TIER5,
    EstforConstants.PASSIVE_ACTION_KRAGSTYR_EGG_TIER5
  ];

  const values = [0, 0, 2, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  const map = new Map();
  actionsToReduce.forEach((key, index) => {
    map.set(key, values[index]);
  });

  const actions = allPassiveActions.filter((action) => map.has(action.actionId));

  const useValueArray = false; // isBeta;

  const actionsToEdit = useValueArray
    ? actions.map((passiveAction) => {
        const actionId = passiveAction.actionId;

        let durationDays = map.has(actionId) ? map.get(actionId) : passiveAction.info.durationDays;
        return {
          ...passiveAction,
          info: {
            ...passiveAction.info,
            durationDays
          }
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
