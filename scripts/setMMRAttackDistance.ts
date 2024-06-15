import {ethers} from "hardhat";
import {LOCKED_BANK_VAULTS_ADDRESS} from "./contractAddresses";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Set MMR Attack Distance using account: ${owner.address} on chain id ${await owner.getChainId()}`);

  const lockedBankVaults = await ethers.getContractAt("LockedBankVaults", LOCKED_BANK_VAULTS_ADDRESS);
  const tx = await lockedBankVaults.setMMRAttackDistance(5000);
  await tx.wait();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});