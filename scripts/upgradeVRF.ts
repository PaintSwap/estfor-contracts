import {ethers, upgrades} from "hardhat";
import {LOCKED_BANK_VAULT_ADDRESS, SAMWITCH_VRF_ADDRESS, TERRITORIES_ADDRESS} from "./contractAddresses";
import {LockedBankVaults, Territories} from "../typechain-types";
import {verifyContracts} from "./utils";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Upgrading VRF using account: ${owner.address} on chain id ${await owner.getChainId()}`);

  const LockedBankVaults = await ethers.getContractFactory("LockedBankVaults");
  const Territories = await ethers.getContractFactory("Territories");
  {
    // Set base cost really high to prevent any attacks
    const lockedBankVaults = (await ethers.getContractAt(
      "LockedBankVaults",
      LOCKED_BANK_VAULT_ADDRESS
    )) as LockedBankVaults;
    let tx = await lockedBankVaults.setBaseAttackCost(ethers.utils.parseEther("300000000"));
    await tx.wait();
    console.log("Set base attack cost to 300M on locked vaults");

    const territories = (await ethers.getContractAt("Territories", TERRITORIES_ADDRESS)) as Territories;
    tx = await territories.setBaseAttackCost(ethers.utils.parseEther("300000000"));
    await tx.wait();
    console.log("Set base attack cost to 300M on territories");
  }

  // Wait 5 minutes for any ongoing api3 stuff to be completed
  await new Promise((resolve) => setTimeout(resolve, 5 * 60 * 1000));
  console.log("Waiting 5 minutes");

  const timeout = 600 * 1000;
  const lockedBankVaults = (await upgrades.upgradeProxy(LOCKED_BANK_VAULT_ADDRESS, LockedBankVaults, {
    kind: "uups",
    unsafeAllow: ["external-library-linking"],
    timeout,
  })) as LockedBankVaults;
  await lockedBankVaults.deployed();
  console.log(`lockedBankVaults = "${lockedBankVaults.address.toLowerCase()}"`);

  let tx = await lockedBankVaults.setSamWitchVRF(SAMWITCH_VRF_ADDRESS);
  await tx.wait();
  // Allow attacking again
  tx = await lockedBankVaults.setBaseAttackCost(ethers.utils.parseEther("0.01"));
  await tx.wait();

  // Upgrade territories
  const territories = await upgrades.upgradeProxy(TERRITORIES_ADDRESS, Territories, {
    kind: "uups",
    unsafeAllow: ["external-library-linking"],
    timeout,
  });
  await territories.deployed();
  console.log(`territories = "${territories.address.toLowerCase()}"`);

  tx = await territories.setSamWitchVRF(SAMWITCH_VRF_ADDRESS);
  await tx.wait();
  // Allow attacking again
  tx = await territories.setBaseAttackCost(ethers.utils.parseEther("0.01"));
  await tx.wait();

  // Verify
  await verifyContracts([lockedBankVaults.address, territories.address]);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
