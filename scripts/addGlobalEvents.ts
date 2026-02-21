import {ethers} from "hardhat";
import {GLOBAL_EVENT_ADDRESS} from "./contractAddresses";
import {EstforConstants} from "@paintswap/estfor-definitions";
import {getSafeUpgradeTransaction, initialiseSafe, sendTransactionSetToSafe} from "./utils";
import {OperationType, MetaTransactionData} from "@safe-global/types-kit";
import {GlobalEvents__factory} from "../typechain-types";

async function main() {
  const [owner, , proposer] = await ethers.getSigners(); // 0 is old deployer, 2 is proposer for Safe (new deployer)
  const network = await ethers.provider.getNetwork();
  const {useSafe, apiKit, protocolKit} = await initialiseSafe(network);
  console.log(
    `Add global events using account: ${proposer.address} on chain id ${network.chainId}, useSafe: ${useSafe}`
  );

  const globalEvents = await ethers.getContractAt("GlobalEvents", GLOBAL_EVENT_ADDRESS);

  const globalEventIds = [1];
  const globalEventInfo = [
    {
      startTime: Math.floor(new Date("2026-01-23").valueOf() / 1000),
      endTime: Math.floor(new Date("2026-04-27").valueOf() / 1000),
      rewardItemTokenId: EstforConstants.RIFT_COIN,
      rewardItemAmountPerInput: 1,
      inputItemTokenId: EstforConstants.RIFT_CRYSTAL,
      inputItemMaxAmount: 150_000,
      totalInputAmount: 0, // totalInputAmount isn't actually set on the contract, it's just part of the struct
    },
  ];

  if (useSafe) {
    const transactionSet: MetaTransactionData[] = [];
    const iface = GlobalEvents__factory.createInterface();

    transactionSet.push({
      to: ethers.getAddress(GLOBAL_EVENT_ADDRESS),
      value: "0",
      data: iface.encodeFunctionData("addGlobalEvents", [globalEventIds, globalEventInfo]),
      operation: OperationType.Call,
    });
    await sendTransactionSetToSafe(network, protocolKit, apiKit, transactionSet, proposer);
  } else {
    const tx = await globalEvents.addGlobalEvents(globalEventIds, globalEventInfo);
    await tx.wait();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
