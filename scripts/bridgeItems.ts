import {ethers} from "hardhat";
import {BRIDGE_ADDRESS} from "./contractAddresses";
import {EstforConstants} from "@paintswap/estfor-definitions";

async function main() {
  const [owner] = await ethers.getSigners();

  console.log(`Bridge some items from ${owner.address} on chain: ${await owner.getChainId()}`);
  const bridge = (await ethers.getContractAt("Bridge", BRIDGE_ADDRESS)).connect(owner);

  const itemTokenIds = [EstforConstants.BRONZE_AXE];
  const itemAmounts = [1];

  const bridgeFee = await bridge.quoteSendItems(itemTokenIds, itemAmounts);

  const tx = await bridge.sendItems(itemTokenIds, itemAmounts, {value: bridgeFee});
  const receipt = await tx.wait();
  console.log(`hash: ${receipt.transactionHash}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
