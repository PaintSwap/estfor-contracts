import {ethers} from "hardhat";
import {INSTANT_ACTIONS_ADDRESS} from "./contractAddresses";
import {EstforConstants} from "@paintswap/estfor-definitions";
import {allInstantActions} from "./data/instantActions";
import {getSafeUpgradeTransaction, initialiseSafe, sendTransactionSetToSafe} from "./utils";
import {OperationType, MetaTransactionData} from "@safe-global/types-kit";
import {InstantActions__factory} from "../typechain-types";

async function main() {
  const [owner, , proposer] = await ethers.getSigners(); // 0 is old deployer, 2 is proposer for Safe (new deployer)
  const network = await ethers.provider.getNetwork();
  const {useSafe, apiKit, protocolKit} = await initialiseSafe(network);
  console.log(
    `Add instant actions using account: ${proposer.address} on chain id ${network.chainId}, useSafe: ${useSafe}`
  );

  const instantActions = await ethers.getContractAt("InstantActions", INSTANT_ACTIONS_ADDRESS);

  const actionIds = new Set([
    EstforConstants.INSTANT_ACTION_FORGING_ANNIV3_POUCH,
    EstforConstants.INSTANT_ACTION_FORGING_ANNIV3_RING,
    EstforConstants.INSTANT_ACTION_FORGING_ANNIV3_AMULET,
    EstforConstants.INSTANT_ACTION_FORGING_ANNIV3_EGG_TIER1,
    EstforConstants.INSTANT_ACTION_FORGING_ANNIV3_ANCIENT_SCROLL,
    EstforConstants.INSTANT_ACTION_FORGING_ANNIV3_ORICHALCUM_ARROW,
    EstforConstants.INSTANT_ACTION_FORGING_ANNIV3_COOKED_ROSEFIN,
  ]);

  const actions = allInstantActions.filter((action) => {
    if (action) {
      return actionIds.has(action.actionId);
    }
  });

  if (actions.length !== actionIds.size) {
    console.log("Cannot find actions");
  } else {
    if (useSafe) {
      const transactionSet: MetaTransactionData[] = [];
      const iface = InstantActions__factory.createInterface();

      transactionSet.push({
        to: ethers.getAddress(INSTANT_ACTIONS_ADDRESS),
        value: "0",
        data: iface.encodeFunctionData("addActions", [actions]),
        operation: OperationType.Call,
      });
      await sendTransactionSetToSafe(network, protocolKit, apiKit, transactionSet, proposer);
    } else {
      await instantActions.addActions(actions);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
