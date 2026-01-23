import {ethers} from "hardhat";
import {WORLD_ACTIONS_ADDRESS} from "./contractAddresses";
import {EstforConstants} from "@paintswap/estfor-definitions";
import {getSafeUpgradeTransaction, initialiseSafe, sendTransactionSetToSafe} from "./utils";
import {OperationType, MetaTransactionData} from "@safe-global/types-kit";
import {WorldActions__factory} from "../typechain-types";

// Use with caution, this will cause issues for any players that are using this actionChoice
async function main() {
  const [owner, , proposer] = await ethers.getSigners(); // 0 is old deployer, 2 is proposer for Safe (new deployer)
  const network = await ethers.provider.getNetwork();
  const {useSafe, apiKit, protocolKit} = await initialiseSafe(network);
  console.log(
    `Removing action choices using account: ${proposer.address} on chain id ${network.chainId}, useSafe: ${useSafe}`
  );

  const worldActions = await ethers.getContractAt("WorldActions", WORLD_ACTIONS_ADDRESS);

  if (useSafe) {
    const transactionSet: MetaTransactionData[] = [];
    const iface = WorldActions__factory.createInterface();

    transactionSet.push({
      to: ethers.getAddress(WORLD_ACTIONS_ADDRESS),
      value: "0",
      data: iface.encodeFunctionData("removeActionChoices", [
        EstforConstants.NONE,
        [EstforConstants.ACTIONCHOICE_ALCHEMY_WQ_I_III, EstforConstants.ACTIONCHOICE_FORGING_WQ_I_V],
      ]),
      operation: OperationType.Call,
    });
    await sendTransactionSetToSafe(network, protocolKit, apiKit, transactionSet, proposer);
  } else {
    const tx = await worldActions.removeActionChoices(EstforConstants.ACTION_FORGING_ITEM, [
      EstforConstants.ACTIONCHOICE_FORGING_GODLY_BOW,
    ]);
    await tx.wait();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
