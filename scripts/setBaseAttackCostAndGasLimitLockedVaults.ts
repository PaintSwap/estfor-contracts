import {ethers} from "hardhat";
import {LOCKED_BANK_VAULTS_ADDRESS} from "./contractAddresses";
import {LockedBankVaults} from "../typechain-types";
import {getChainId} from "./utils";
import {parseEther} from "ethers";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(
    `Set base attack cost & expected gas limit fulfillment with: ${
      owner.address
    } on chain id ${await getChainId(owner)}`,
  );

  const lockedBankVaults = (await ethers.getContractAt(
    "LockedBankVaults",
    LOCKED_BANK_VAULTS_ADDRESS,
  )) as LockedBankVaults;
  let tx = await lockedBankVaults.setBaseAttackCost(parseEther("0"));
  await tx.wait();

  tx = await lockedBankVaults.setExpectedGasLimitFulfill(1_000_000);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
