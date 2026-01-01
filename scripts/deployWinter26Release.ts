import {ethers, upgrades} from "hardhat";
import {BRUSH_ADDRESS, PET_NFT_ADDRESS, PLAYER_NFT_ADDRESS} from "./contractAddresses";
import {EstforConstants} from "@paintswap/estfor-definitions";
import {initialiseSafe, sendTransactionSetToSafe, isBeta} from "./utils";
import {OperationType, MetaTransactionData} from "@safe-global/types-kit";
import {Marketplace} from "../typechain-types";

async function main() {
  const [owner, , proposer] = await ethers.getSigners(); // 0 is old deployer, 2 is proposer for Safe (new deployer)
  const network = await ethers.provider.getNetwork();
  const {useSafe, apiKit, protocolKit} = await initialiseSafe(network);
  console.log(
    `Edit player cooldown penalty using account: ${proposer.address} on chain id ${network.chainId}, useSafe: ${useSafe}`
  );

  if (useSafe) {
    const Marketplace = await ethers.getContractFactory("Marketplace");
    const marketplace = (await upgrades.deployProxy(Marketplace, [
      BRUSH_ADDRESS,
      owner.address,
    ])) as unknown as Marketplace;
    await marketplace.waitForDeployment();
    console.log(`marketplace = "${(await marketplace.getAddress()).toLowerCase()}"`);

    const transactionSet: MetaTransactionData[] = [];
    const iface = new ethers.Interface([
      "function setMarketplaceAddress(address marketplaceAddress)",
      "function setApprovalForAll(address operator, bool approved)",
    ]);
    transactionSet.push({
      to: ethers.getAddress(PLAYER_NFT_ADDRESS),
      value: "0",
      data: iface.encodeFunctionData("setMarketplaceAddress", [(await marketplace.getAddress()).toLowerCase()]),
      operation: OperationType.Call,
    });
    transactionSet.push({
      to: ethers.getAddress(PLAYER_NFT_ADDRESS),
      value: "0",
      data: iface.encodeFunctionData("setApprovalForAll", [(await marketplace.getAddress()).toLowerCase(), true]),
      operation: OperationType.Call,
    });
    transactionSet.push({
      to: ethers.getAddress(PET_NFT_ADDRESS),
      value: "0",
      data: iface.encodeFunctionData("setMarketplaceAddress", [(await marketplace.getAddress()).toLowerCase()]),
      operation: OperationType.Call,
    });
    transactionSet.push({
      to: ethers.getAddress(PET_NFT_ADDRESS),
      value: "0",
      data: iface.encodeFunctionData("setApprovalForAll", [(await marketplace.getAddress()).toLowerCase(), true]),
      operation: OperationType.Call,
    });
    await sendTransactionSetToSafe(network, protocolKit, apiKit, transactionSet, proposer);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
