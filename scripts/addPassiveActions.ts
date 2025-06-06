import {ethers} from "hardhat";
import {PASSIVE_ACTIONS_ADDRESS} from "./contractAddresses";
import {allPassiveActions} from "./data/passiveActions";
import {isBeta} from "./utils";
import {EstforConstants} from "@paintswap/estfor-definitions";
import {getChainId} from "./utils";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Add passive actions using account: ${owner.address} on chain id ${await getChainId(owner)}`);

  const passiveActions = await ethers.getContractAt("PassiveActions", PASSIVE_ACTIONS_ADDRESS);

  const actionsToReduce = [
    EstforConstants.PASSIVE_ACTION_KRAGSTYR_EGG_TIER1,
    EstforConstants.PASSIVE_ACTION_KRAGSTYR_EGG_TIER2,
    EstforConstants.PASSIVE_ACTION_KRAGSTYR_EGG_TIER3,
    EstforConstants.PASSIVE_ACTION_KRAGSTYR_EGG_TIER4,
    EstforConstants.PASSIVE_ACTION_KRAGSTYR_EGG_TIER5
  ];

  const values = [0, 0, 0, 0];
  const map = new Map();
  actionsToReduce.forEach((key, index) => {
    map.set(key, values[index]);
  });

  let actions = allPassiveActions.filter((action) => actionsToReduce.includes(action.actionId));
  actions = isBeta
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

  if (actions.length !== actionsToReduce.length) {
    console.log("Cannot find actions");
  } else {
    await passiveActions.addActions(actions);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
