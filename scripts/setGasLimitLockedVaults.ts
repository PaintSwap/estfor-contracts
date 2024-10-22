import {ethers} from "hardhat";
import {LOCKED_BANK_VAULTS_ADDRESS} from "./contractAddresses";
import {LockedBankVaults} from "../typechain-types";
import {getChainId} from "./utils";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(
    `Set expected gas limit fulfillment on locked bank vaults with: ${owner.address} on chain id ${await getChainId(
      owner
    )}`
  );

  const lockedBankVaults = (await ethers.getContractAt(
    "LockedBankVaults",
    LOCKED_BANK_VAULTS_ADDRESS
  )) as LockedBankVaults;
  const tx = await lockedBankVaults.setExpectedGasLimitFulfill(1_000_000);
  tx.wait();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
