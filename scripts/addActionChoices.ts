import {ethers} from "hardhat";
import {WORLD_ACTIONS_ADDRESS} from "./contractAddresses";
import {allActionChoicesRanged, allActionChoicesAlchemy, allActionChoicesForging} from "./data/actionChoices";
import {allActionChoiceIdsRanged, allActionChoiceIdsAlchemy, allActionChoiceIdsForging} from "./data/actionChoiceIds";
import {EstforConstants} from "@paintswap/estfor-definitions";

import {getSafeUpgradeTransaction, initialiseSafe, sendTransactionSetToSafe} from "./utils";
import {OperationType, MetaTransactionData} from "@safe-global/types-kit";
import {WorldActions__factory} from "../typechain-types";

async function main() {
  const [owner, , proposer] = await ethers.getSigners(); // 0 is old deployer, 2 is proposer for Safe (new deployer)
  const network = await ethers.provider.getNetwork();
  const {useSafe, apiKit, protocolKit} = await initialiseSafe(network);
  console.log(`Add action choices using account: ${owner.address} on chain id ${network.chainId}, useSafe: ${useSafe}`);
  const worldActions = await ethers.getContractAt("WorldActions", WORLD_ACTIONS_ADDRESS);

  const newActionChoiceIds = new Set([
    EstforConstants.ACTIONCHOICE_ALCHEMY_WQ_I_II,
    // EstforConstants.ACTIONCHOICE_FORGING_WQ_I_V,
  ]);

  const actionChoiceIndices = allActionChoiceIdsAlchemy.reduce((indices: number[], actionChoiceId, index) => {
    if (newActionChoiceIds.has(actionChoiceId)) {
      indices.push(index);
    }
    return indices;
  }, []);

  const actionChoices = actionChoiceIndices.map((index) => allActionChoicesAlchemy[index]);
  const actionChoiceIds = actionChoiceIndices.map((index) => allActionChoiceIdsAlchemy[index]);

  if (actionChoices.length !== newActionChoiceIds.size || actionChoiceIds.length !== newActionChoiceIds.size) {
    console.error("ActionChoiceIds not found");
  } else {
    if (useSafe) {
      const transactionSet: MetaTransactionData[] = [];
      const iface = WorldActions__factory.createInterface();

      transactionSet.push({
        to: ethers.getAddress(WORLD_ACTIONS_ADDRESS),
        value: "0",
        data: iface.encodeFunctionData("addBulkActionChoices", [
          [EstforConstants.NONE],
          [actionChoiceIds],
          [actionChoices],
        ]),
        operation: OperationType.Call,
      });
      await sendTransactionSetToSafe(network, protocolKit, apiKit, transactionSet, proposer);
    } else {
      const tx = await worldActions.addBulkActionChoices([EstforConstants.NONE], [actionChoiceIds], [actionChoices]);
      await tx.wait();
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
