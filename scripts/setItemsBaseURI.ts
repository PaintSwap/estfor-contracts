import {ethers} from "hardhat";
import {ITEM_NFT_ADDRESS} from "./contractAddresses";

import {getSafeUpgradeTransaction, initialiseSafe, sendTransactionSetToSafe, isBeta} from "./utils";
import {OperationType, MetaTransactionData} from "@safe-global/types-kit";
import {ItemNFT__factory} from "../typechain-types";

async function main() {
  const [owner, , proposer] = await ethers.getSigners(); // 0 is old deployer, 2 is proposer for Safe (new deployer)
  const network = await ethers.provider.getNetwork();
  const {useSafe, apiKit, protocolKit} = await initialiseSafe(network);
  console.log(`Set itemNFT base uri with: ${owner.address} on chain id ${network.chainId}, useSafe: ${useSafe}`);

  if (useSafe) {
    const transactionSet: MetaTransactionData[] = [];
    const iface = ItemNFT__factory.createInterface();

    transactionSet.push({
      to: ethers.getAddress(ITEM_NFT_ADDRESS),
      value: "0",
      data: iface.encodeFunctionData("setBaseURI", [
        "ipfs://bafybeiggbntyqyxzppi5u7c4e4kwxyzvfo2vqemlocbwyjmgnpztuklh4y/",
      ]),
      operation: OperationType.Call,
    });
    await sendTransactionSetToSafe(network, protocolKit, apiKit, transactionSet, proposer);
  } else {
    const itemNFT = await ethers.getContractAt("ItemNFT", ITEM_NFT_ADDRESS);
    await itemNFT.setBaseURI("ipfs://bafybeiggbntyqyxzppi5u7c4e4kwxyzvfo2vqemlocbwyjmgnpztuklh4y/");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
