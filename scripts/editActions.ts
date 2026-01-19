import {ethers, network} from "hardhat";
import {WORLD_ACTIONS_ADDRESS} from "./contractAddresses";
import {allActions} from "./data/actions";
import {EstforConstants} from "@paintswap/estfor-definitions";
import {Skill} from "@paintswap/estfor-definitions/types";
import {getSafeUpgradeTransaction, initialiseSafe, sendTransactionSetToSafe} from "./utils";
import {OperationType, MetaTransactionData} from "@safe-global/types-kit";
import {WorldActions__factory} from "../typechain-types";

async function main() {
  const [owner, , proposer] = await ethers.getSigners(); // 0 is old deployer, 2 is proposer for Safe (new deployer)
  const network = await ethers.provider.getNetwork();
  const {useSafe, apiKit, protocolKit} = await initialiseSafe(network);
  console.log(`Edit actions using account: ${proposer.address} on chain id ${network.chainId}, useSafe: ${useSafe}`);

  const worldActions = await ethers.getContractAt("WorldActions", WORLD_ACTIONS_ADDRESS);

  const actionIds = new Set([
    EstforConstants.ACTION_MINING_WQ_I_I,
    EstforConstants.ACTION_WOODCUTTING_WQ_I_II,
    EstforConstants.ACTION_THIEVING_WQ_I_IV,
  ]);

  const actions = allActions.filter((action) => actionIds.has(action.actionId));
  if (actions.length !== actionIds.size) {
    console.log("Cannot find actions");
  } else {
    const chunkSize = 100;
    for (let i = 0; i < actions.length; i += chunkSize) {
      const chunk = actions.slice(i, i + chunkSize);
      if (useSafe) {
        const transactionSet: MetaTransactionData[] = [];
        const iface = WorldActions__factory.createInterface();

        transactionSet.push({
          to: ethers.getAddress(WORLD_ACTIONS_ADDRESS),
          value: "0",
          data: iface.encodeFunctionData("editActions", [actions]),
          operation: OperationType.Call,
        });
        await sendTransactionSetToSafe(network, protocolKit, apiKit, transactionSet, proposer);
      } else {
        const tx = await worldActions.editActions(chunk);
        await tx.wait();
      }
      console.log("Edit actions chunk ", i);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
