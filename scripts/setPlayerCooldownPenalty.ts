import {ethers} from "hardhat";
import {COMBATANTS_HELPER_ADDRESS} from "./contractAddresses";
import {EstforConstants} from "@paintswap/estfor-definitions";
import {initialiseSafe, sendTransactionSetToSafe, isBeta} from "./utils";
import {OperationType, MetaTransactionData} from "@safe-global/types-kit";

async function main() {
  const [owner, , proposer] = await ethers.getSigners(); // 0 is old deployer, 2 is proposer for Safe (new deployer)
  const network = await ethers.provider.getNetwork();
  const {useSafe, apiKit, protocolKit} = await initialiseSafe(network);
  console.log(
    `Edit player cooldown penalty using account: ${proposer.address} on chain id ${network.chainId}, useSafe: ${useSafe}`
  );

  if (useSafe) {
    const transactionSet: MetaTransactionData[] = [];
    const iface = new ethers.Interface(["function setPlayerLeftCombatantCooldownTimestampPenalty(uint24 penalty)"]);
    transactionSet.push({
      to: ethers.getAddress(COMBATANTS_HELPER_ADDRESS),
      value: "0",
      data: iface.encodeFunctionData("setPlayerLeftCombatantCooldownTimestampPenalty", [60 * 60]), // 60 minutes
      operation: OperationType.Call
    });
    await sendTransactionSetToSafe(network, protocolKit, apiKit, transactionSet, proposer);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
