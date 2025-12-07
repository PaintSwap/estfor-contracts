import {ethers, upgrades} from "hardhat";
import {
  ESTFOR_LIBRARY_ADDRESS,
  RANDOMNESS_BEACON_ADDRESS,
  TERRITORIES_ADDRESS,
  LOCKED_BANK_VAULTS_ADDRESS,
  COMBATANTS_HELPER_ADDRESS,
  INSTANT_VRF_ACTIONS_ADDRESS,
  LOCKED_BANK_VAULTS_LIBRARY_ADDRESS,
  PVP_BATTLEGROUND_ADDRESS,
  RAIDS_ADDRESS,
  PLAYERS_LIBRARY_ADDRESS,
  VRF_ADDRESS
} from "./contractAddresses";
import {isBeta, verifyContracts} from "./utils";

async function main() {
  const [owner] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  console.log(
    `Integrating the Paintswap VRF and updating the contracts with the account: ${owner.address} on chain ${network.chainId}`
  );

  const timeout = 600 * 1000; // 10 minutes

  const estforLibrary = await ethers.getContractAt("EstforLibrary", ESTFOR_LIBRARY_ADDRESS);
  console.log(`estforLibrary = "${(await estforLibrary.getAddress()).toLowerCase()}"`);

  const RandomnessBeacon = await ethers.getContractFactory("RandomnessBeacon");
  const randomnessBeacon = await upgrades.upgradeProxy(RANDOMNESS_BEACON_ADDRESS, RandomnessBeacon, {
    kind: "uups",
    timeout,
    unsafeSkipStorageCheck: true,
    call: {
      fn: "initializeV3",
      args: [VRF_ADDRESS]
    }
  });
  await randomnessBeacon.waitForDeployment();
  console.log(`randomnessBeacon = "${(await randomnessBeacon.getAddress()).toLowerCase()}"`);

  // Instant VRF actions
  const InstantVRFActions = await ethers.getContractFactory("InstantVRFActions");
  const instantVRFActions = await upgrades.upgradeProxy(INSTANT_VRF_ACTIONS_ADDRESS, InstantVRFActions, {
    kind: "uups",
    timeout,
    unsafeSkipStorageCheck: true,
    call: {
      fn: "initializeV3",
      args: [VRF_ADDRESS]
    }
  });
  await instantVRFActions.waitForDeployment();
  console.log(`instantVRFActions = "${(await instantVRFActions.getAddress()).toLowerCase()}"`);

  const PVPBattleground = await ethers.getContractFactory("PVPBattleground");
  const pvpBattleground = await upgrades.upgradeProxy(PVP_BATTLEGROUND_ADDRESS, PVPBattleground, {
    kind: "uups",
    timeout,
    unsafeSkipStorageCheck: true,
    call: {
      fn: "initializeV3",
      args: [VRF_ADDRESS]
    }
  });
  await pvpBattleground.waitForDeployment();
  console.log(`pvpBattleground = "${(await pvpBattleground.getAddress()).toLowerCase()}"`);

  // ClanBattleLibrary
  const clanBattleLibrary = await ethers.deployContract("ClanBattleLibrary");
  console.log(`clanBattleLibrary = "${(await clanBattleLibrary.getAddress()).toLowerCase()}"`);

  // LockedBankVaults
  const lockedBankVaultsLibrary = await ethers.getContractAt(
    "LockedBankVaultsLibrary",
    LOCKED_BANK_VAULTS_LIBRARY_ADDRESS
  );
  console.log(`lockedBankVaultsLibrary = "${(await lockedBankVaultsLibrary.getAddress()).toLowerCase()}"`);

  const LockedBankVaults = await ethers.getContractFactory("LockedBankVaults", {
    libraries: {
      EstforLibrary: await estforLibrary.getAddress(),
      LockedBankVaultsLibrary: await lockedBankVaultsLibrary.getAddress(),
      ClanBattleLibrary: await clanBattleLibrary.getAddress()
    }
  });
  const lockedBankVaults = await upgrades.upgradeProxy(LOCKED_BANK_VAULTS_ADDRESS, LockedBankVaults, {
    kind: "uups",
    unsafeAllow: ["external-library-linking"],
    timeout,
    unsafeSkipStorageCheck: true,
    call: {
      fn: "initializeV3",
      args: [VRF_ADDRESS]
    }
  });
  await lockedBankVaults.waitForDeployment();
  console.log(`lockedBankVaults = "${(await lockedBankVaults.getAddress()).toLowerCase()}"`);

  const Territories = await ethers.getContractFactory("Territories");
  const territories = await upgrades.upgradeProxy(TERRITORIES_ADDRESS, Territories, {
    kind: "uups",
    timeout,
    unsafeSkipStorageCheck: true,
    call: {
      fn: "initializeV3",
      args: [VRF_ADDRESS]
    }
  });
  await territories.waitForDeployment();
  console.log(`territories = "${(await territories.getAddress()).toLowerCase()}"`);

  const CombatantsHelper = await ethers.getContractFactory("CombatantsHelper", {
    libraries: {EstforLibrary: await estforLibrary.getAddress()}
  });
  const combatantsHelper = await upgrades.upgradeProxy(COMBATANTS_HELPER_ADDRESS, CombatantsHelper, {
    kind: "uups",
    unsafeAllow: ["external-library-linking"],
    timeout,
    call: {
      fn: "initializeV3"
    }
  });
  await combatantsHelper.waitForDeployment();
  console.log(`combatantsHelper = "${(await combatantsHelper.getAddress()).toLowerCase()}"`);

  const Raids = await ethers.getContractFactory("Raids", {
    libraries: {PlayersLibrary: await PLAYERS_LIBRARY_ADDRESS}
  });
  const raids = await upgrades.upgradeProxy(RAIDS_ADDRESS, Raids, {
    kind: "uups",
    unsafeAllow: ["external-library-linking"],
    timeout,
    unsafeSkipStorageCheck: true,
    call: {
      fn: "initializeV3",
      args: [VRF_ADDRESS, isBeta]
    }
  });
  await raids.waitForDeployment();
  console.log(`raids = "${(await raids.getAddress()).toLowerCase()}"`);

  // Sending 10 S to the RandomnessBeacon & Raids
  let tx = await owner.sendTransaction({
    to: await randomnessBeacon.getAddress(),
    value: ethers.parseEther("10")
  });
  await tx.wait();
  console.log("Sent 10 S to randomness beacon", tx.hash);

  tx = await owner.sendTransaction({
    to: await raids.getAddress(),
    value: ethers.parseEther("10")
  });
  await tx.wait();
  console.log("Sent 10 S to raids", tx.hash);

  if (network.chainId == 146n) {
    await verifyContracts([await randomnessBeacon.getAddress()]);
    await verifyContracts([await estforLibrary.getAddress()]);
    await verifyContracts([await instantVRFActions.getAddress()]);
    await verifyContracts([await clanBattleLibrary.getAddress()]);
    await verifyContracts([await pvpBattleground.getAddress()]);
    await verifyContracts([await raids.getAddress()]);
    await verifyContracts([await lockedBankVaults.getAddress()]);
    await verifyContracts([await combatantsHelper.getAddress()]);
    await verifyContracts([await territories.getAddress()]);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
