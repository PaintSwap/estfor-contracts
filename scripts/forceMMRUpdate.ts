import {ethers} from "hardhat";
import {LOCKED_BANK_VAULTS_ADDRESS} from "./contractAddresses";
import {LockedBankVaults} from "../typechain-types";
import {getChainId} from "./utils";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Forcing MMR Updates using account: ${owner.address} on chain id ${await getChainId(owner)}`);

  const lockedBankVaults = (await ethers.getContractAt(
    "LockedBankVaults",
    LOCKED_BANK_VAULTS_ADDRESS,
  )) as LockedBankVaults;

  const idleClans = await lockedBankVaults.getIdleClans();
  const chunkSize = 50;
  for (let i = 0; i < idleClans.length; i += chunkSize) {
    const chunk = idleClans.slice(i, i + chunkSize);
    const tx = await lockedBankVaults.forceMMRUpdate(chunk);
    await tx.wait();
    console.log("Force MMR update ", i);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
