import {ethers} from "hardhat";
import {
  DEV_ADDRESS,
  LOCKED_BANK_VAULTS_ADDRESS,
  SHOP_ADDRESS,
  PROMOTIONS_ADDRESS,
  PLAYER_NFT_ADDRESS,
  PET_NFT_ADDRESS,
  ROYALTY_RECEIVER_ADDRESS,
  CLANS_ADDRESS
} from "./contractAddresses";
import {getChainId} from "./utils";
import {initialiseSafe, sendTransactionSetToSafe, isBeta} from "./utils";
import {OperationType, MetaTransactionData} from "@safe-global/types-kit";

async function main() {
  const [owner, , proposer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const {useSafe, apiKit, protocolKit} = await initialiseSafe(network);
  console.log(`Updating donation thresholds using account: ${owner.address} on chain id ${await getChainId(owner)}`);

  if (useSafe) {
    const transactionSet: MetaTransactionData[] = [];
    const iface = new ethers.Interface([
      "function setDevAddress(address newDevAddress)",
      "function setBrushDistributionPercentages(uint8 burnPercentage, uint8 treasuryPercentage, uint8 devPercentage)"
    ]);
    transactionSet.push({
      to: ethers.getAddress(LOCKED_BANK_VAULTS_ADDRESS),
      value: "0",
      data: iface.encodeFunctionData("setDevAddress", [DEV_ADDRESS]),
      operation: OperationType.Call
    });
    transactionSet.push({
      to: ethers.getAddress(SHOP_ADDRESS),
      value: "0",
      data: iface.encodeFunctionData("setDevAddress", [DEV_ADDRESS]),
      operation: OperationType.Call
    });
    transactionSet.push({
      to: ethers.getAddress(PROMOTIONS_ADDRESS),
      value: "0",
      data: iface.encodeFunctionData("setDevAddress", [DEV_ADDRESS]),
      operation: OperationType.Call
    });
    transactionSet.push({
      to: ethers.getAddress(PLAYER_NFT_ADDRESS),
      value: "0",
      data: iface.encodeFunctionData("setDevAddress", [DEV_ADDRESS]),
      operation: OperationType.Call
    });
    transactionSet.push({
      to: ethers.getAddress(PET_NFT_ADDRESS),
      value: "0",
      data: iface.encodeFunctionData("setDevAddress", [DEV_ADDRESS]),
      operation: OperationType.Call
    });
    transactionSet.push({
      to: ethers.getAddress(ROYALTY_RECEIVER_ADDRESS),
      value: "0",
      data: iface.encodeFunctionData("setDevAddress", [DEV_ADDRESS]),
      operation: OperationType.Call
    });
    transactionSet.push({
      to: ethers.getAddress(CLANS_ADDRESS),
      value: "0",
      data: iface.encodeFunctionData("setDevAddress", [DEV_ADDRESS]),
      operation: OperationType.Call
    });
    await sendTransactionSetToSafe(network, protocolKit, apiKit, transactionSet, proposer);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
