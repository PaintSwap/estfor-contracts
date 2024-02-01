import {ethers} from "hardhat";
import {TERRITORIES_ADDRESS} from "./contractAddresses";
import {Territories} from "../typechain-types";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(
    `Set base attack cost & expected gas limit fulfillment with: ${
      owner.address
    } on chain id ${await owner.getChainId()}`
  );

  const territories = (await ethers.getContractAt("Territories", TERRITORIES_ADDRESS)) as Territories;
  let tx = await territories.setBaseAttackCost(ethers.utils.parseEther("0.01"));
  await tx.wait();

  tx = await territories.setExpectedGasLimitFulfill(1_500_000);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
