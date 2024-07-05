import {ethers} from "hardhat";
import {CLANS_ADDRESS, LOCKED_BANK_VAULTS_ADDRESS} from "./contractAddresses";
import {LockedBankVaults} from "../typechain-types";
import {isBeta} from "./utils";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Initialize clan MMRs using account: ${owner.address} on chain id ${await owner.getChainId()}`);

  const lockedBankVaults = (await ethers.getContractAt(
    "LockedBankVaults",
    LOCKED_BANK_VAULTS_ADDRESS
  )) as LockedBankVaults;

  let tx = await lockedBankVaults.setPreventAttacks(true);
  await tx.wait();
  // Just to clear any that might have been added before
  let clear = true;
  tx = await lockedBankVaults.initializeMMR([], [], clear);
  await tx.wait();

  const clans = await ethers.getContractAt("Clans", CLANS_ADDRESS);
  tx = await clans.setInitialMMR(500);
  await tx.wait();

  const clanIds = [62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 24, 46, 49, 50];
  const mmrs = [500, 800, 800, 1100, 1100, 1400, 1400, 1700, 1700, 2000, 1500, 700, 1500, 2300];

  if (clanIds.length != mmrs.length) {
    console.log("Length mismatch");
    return;
  }

  clear = false;
  const chunkSize = 100;
  for (let i = 0; i < clanIds.length; i += chunkSize) {
    const chunk = clanIds.slice(i, i + chunkSize);
    const chunkMMR = mmrs.slice(i, i + chunkSize);
    tx = await lockedBankVaults.initializeMMR(chunk, chunkMMR, clear);
    await tx.wait();
    console.log("Initialized clan MMRs ", i);
  }

  const Ka = 32;
  const Kd = 32;
  tx = await lockedBankVaults.setKValues(Ka, Kd);
  await tx.wait();
  console.log("Set K values");

  const mmrAttackDistance = isBeta ? 1 : 4;
  tx = await lockedBankVaults.setMMRAttackDistance(mmrAttackDistance);
  await tx.wait();
  console.log("Set MMR attack distance");

  tx = await lockedBankVaults.setPreventAttacks(false);
  await tx.wait();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
