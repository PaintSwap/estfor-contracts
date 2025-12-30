import {ethers} from "hardhat";
import {SHOP_ADDRESS} from "./contractAddresses";
import {EstforConstants} from "@paintswap/estfor-definitions";
import {initialiseSafe, sendTransactionSetToSafe, isBeta} from "./utils";
import {OperationType, MetaTransactionData} from "@safe-global/types-kit";

async function main() {
  const [owner, , proposer] = await ethers.getSigners(); // 0 is old deployer, 2 is proposer for Safe (new deployer)
  const network = await ethers.provider.getNetwork();
  const {useSafe, apiKit, protocolKit} = await initialiseSafe(network);
  console.log(
    `Edit shop promotion using account: ${proposer.address} on chain id ${network.chainId}, useSafe: ${useSafe}`
  );

  const shop = await ethers.getContractAt("Shop", SHOP_ADDRESS);
  if (useSafe) {
    const transactionSet: MetaTransactionData[] = [];
    const shopIface = new ethers.Interface(["function setPromotionDiscountPercentage(uint8 discountPercentage)"]);
    transactionSet.push({
      to: ethers.getAddress(SHOP_ADDRESS),
      value: "0",
      data: shopIface.encodeFunctionData("setPromotionDiscountPercentage", [/* discountPercentage value here */ 30]),
      operation: OperationType.Call
    });
    await sendTransactionSetToSafe(network, protocolKit, apiKit, transactionSet, proposer);
  } else {
    await shop.setPromotionDiscountPercentage(30);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
