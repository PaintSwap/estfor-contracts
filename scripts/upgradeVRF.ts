import {ethers, upgrades} from "hardhat";
import {LOCKED_BANK_VAULTS_ADDRESS, SAMWITCH_VRF_ADDRESS, TERRITORIES_ADDRESS} from "./contractAddresses";
import {LockedBankVaults, Territories} from "../typechain-types";
import {getChainId, verifyContracts} from "./utils";
import {parseEther} from "ethers";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Upgrading VRF using account: ${owner.address} on chain id ${await getChainId(owner)}`);

  // TODO: Add libraries
  const LockedBankVaults = await ethers.getContractFactory("LockedBankVaults");
  const Territories = await ethers.getContractFactory("Territories");
  {
    // Set base cost really high to prevent any attacks
    const lockedBankVaults = (await ethers.getContractAt(
      "LockedBankVaults",
      LOCKED_BANK_VAULTS_ADDRESS,
    )) as LockedBankVaults;
    let tx = await lockedBankVaults.setBaseAttackCost(parseEther("300000000"));
    await tx.wait();
    console.log("Set base attack cost to 300M on locked vaults");

    const territories = (await ethers.getContractAt("Territories", TERRITORIES_ADDRESS)) as Territories;
    tx = await territories.setBaseAttackCost(parseEther("300000000"));
    await tx.wait();
    console.log("Set base attack cost to 300M on territories");
  }

  // Wait 5 minutes for any ongoing api3 stuff to be completed
  await new Promise((resolve) => setTimeout(resolve, 5 * 60 * 1000));
  console.log("Waiting 5 minutes");

  const timeout = 600 * 1000;
  const lockedBankVaults = (await upgrades.upgradeProxy(LOCKED_BANK_VAULTS_ADDRESS, LockedBankVaults, {
    kind: "uups",
    unsafeAllow: ["external-library-linking"],
    timeout,
  })) as unknown as LockedBankVaults;

  console.log(`lockedBankVaults = "${(await lockedBankVaults.getAddress()).toLowerCase()}"`);

  //  let tx = await lockedBankVaults.setSamWitchVRF(SAMWITCH_VRF_ADDRESS); // Replace with setAddresses and set it there if needed
  //  await tx.wait();
  // Allow attacking again
  let tx = await lockedBankVaults.setBaseAttackCost(parseEther("0.01"));
  await tx.wait();

  // Upgrade territories
  const territories = await upgrades.upgradeProxy(TERRITORIES_ADDRESS, Territories, {
    kind: "uups",
    unsafeAllow: ["external-library-linking"],
    timeout,
  });
  await territories.waitForDeployment();
  console.log(`territories = "${(await territories.getAddress()).toLowerCase()}"`);

  //  tx = await territories.setSamWitchVRF(SAMWITCH_VRF_ADDRESS);
  //  await tx.wait();
  // Allow attacking again
  tx = await territories.setBaseAttackCost(parseEther("0.01"));
  await tx.wait();

  // Verify
  await verifyContracts([await lockedBankVaults.getAddress(), await territories.getAddress()]);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
