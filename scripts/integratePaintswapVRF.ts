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
  VRF_ADDRESS,
  CLANS_ADDRESS
} from "./contractAddresses";
import {isBeta, verifyContracts, initialiseSafe, getSafeUpgradeTransaction, sendTransactionSetToSafe} from "./utils";

async function main() {
  const [owner, , proposer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const {useSafe, apiKit, protocolKit} = await initialiseSafe(network);
  console.log(
    `Integrating the Paintswap VRF and updating the contracts with the account: ${proposer.address} on chain ${network.chainId}`
  );

  const timeout = 600 * 1000; // 10 minutes

  const genericUpgradeInterface = new ethers.Interface([
    "function initializeV2(address combatantsHelperAddress)",
    "function initializeV3(address vrfAddress)",
    "function initializeV4()"
  ]);

  const upgradeTransactionSet = [];

  const estforLibrary = await ethers.getContractAt("EstforLibrary", ESTFOR_LIBRARY_ADDRESS);
  console.log(`estforLibrary = "${(await estforLibrary.getAddress()).toLowerCase()}"`);

  const RandomnessBeacon = await ethers.getContractFactory("RandomnessBeacon");
  const randomnessBeacon = (await upgrades.prepareUpgrade(RANDOMNESS_BEACON_ADDRESS, RandomnessBeacon, {
    kind: "uups",
    timeout,
    unsafeSkipStorageCheck: true
  })) as string;
  console.log(`randomnessBeacon = "${randomnessBeacon}"`);

  upgradeTransactionSet.push(
    getSafeUpgradeTransaction(
      RANDOMNESS_BEACON_ADDRESS,
      randomnessBeacon,
      genericUpgradeInterface.encodeFunctionData("initializeV3", [VRF_ADDRESS])
    )
  );

  // // Instant VRF actions
  const InstantVRFActions = await ethers.getContractFactory("InstantVRFActions");
  const instantVRFActions = (await upgrades.prepareUpgrade(INSTANT_VRF_ACTIONS_ADDRESS, InstantVRFActions, {
    kind: "uups",
    timeout,
    unsafeSkipStorageCheck: true
  })) as string;
  console.log(`instantVRFActions = "${instantVRFActions}"`);

  upgradeTransactionSet.push(
    getSafeUpgradeTransaction(
      INSTANT_VRF_ACTIONS_ADDRESS,
      instantVRFActions,
      genericUpgradeInterface.encodeFunctionData("initializeV3", [VRF_ADDRESS])
    )
  );

  const PVPBattleground = await ethers.getContractFactory("PVPBattleground");
  const pvpBattleground = (await upgrades.prepareUpgrade(PVP_BATTLEGROUND_ADDRESS, PVPBattleground, {
    kind: "uups",
    timeout,
    unsafeSkipStorageCheck: true
  })) as string;
  console.log(`pvpBattleground = "${pvpBattleground}"`);

  upgradeTransactionSet.push(
    getSafeUpgradeTransaction(
      PVP_BATTLEGROUND_ADDRESS,
      pvpBattleground,
      genericUpgradeInterface.encodeFunctionData("initializeV3", [VRF_ADDRESS])
    )
  );

  // ClanBattleLibrary
  const clanBattleLibrary = await ethers.deployContract("ClanBattleLibrary", proposer);
  console.log(`clanBattleLibrary = "${(await clanBattleLibrary.getAddress()).toLowerCase()}"`);

  const Clans = await ethers.getContractFactory("Clans", {
    libraries: {EstforLibrary: await estforLibrary.getAddress()},
    signer: proposer
  });
  const clans = (await upgrades.prepareUpgrade(CLANS_ADDRESS, Clans, {
    kind: "uups",
    unsafeAllow: ["external-library-linking"],
    timeout,
    unsafeSkipStorageCheck: true
  })) as string;
  console.log(`Clans implementation deployed to ${clans}`);

  upgradeTransactionSet.push(
    getSafeUpgradeTransaction(
      CLANS_ADDRESS,
      clans,
      genericUpgradeInterface.encodeFunctionData("initializeV2", [COMBATANTS_HELPER_ADDRESS])
    )
  );

  // LockedBankVaults
  const lockedBankVaultsLibrary = await ethers.deployContract("LockedBankVaultsLibrary", proposer);
  console.log(`lockedBankVaultsLibrary = "${(await lockedBankVaultsLibrary.getAddress()).toLowerCase()}"`);

  const LockedBankVaults = await ethers.getContractFactory("LockedBankVaults", {
    libraries: {
      EstforLibrary: await estforLibrary.getAddress(),
      LockedBankVaultsLibrary: await lockedBankVaultsLibrary.getAddress(),
      ClanBattleLibrary: await clanBattleLibrary.getAddress()
    },
    signer: proposer
  });
  const lockedBankVaults = (await upgrades.prepareUpgrade(LOCKED_BANK_VAULTS_ADDRESS, LockedBankVaults, {
    kind: "uups",
    unsafeAllow: ["external-library-linking"],
    timeout,
    unsafeSkipStorageCheck: true
  })) as string;
  console.log(`lockedBankVaults = ${lockedBankVaults}`);

  upgradeTransactionSet.push(
    getSafeUpgradeTransaction(
      LOCKED_BANK_VAULTS_ADDRESS,
      lockedBankVaults,
      genericUpgradeInterface.encodeFunctionData("initializeV3", [VRF_ADDRESS])
    )
  );

  const Territories = await ethers.getContractFactory("Territories", proposer);
  const territories = (await upgrades.prepareUpgrade(TERRITORIES_ADDRESS, Territories, {
    kind: "uups",
    timeout,
    unsafeSkipStorageCheck: true
  })) as string;
  console.log(`territories = ${territories}`);

  upgradeTransactionSet.push(
    getSafeUpgradeTransaction(
      TERRITORIES_ADDRESS,
      territories,
      genericUpgradeInterface.encodeFunctionData("initializeV3", [VRF_ADDRESS])
    )
  );

  const CombatantsHelper = await ethers.getContractFactory("CombatantsHelper", {
    libraries: {EstforLibrary: await estforLibrary.getAddress()},
    signer: proposer
  });
  const combatantsHelper = (await upgrades.prepareUpgrade(COMBATANTS_HELPER_ADDRESS, CombatantsHelper, {
    kind: "uups",
    unsafeAllow: ["external-library-linking"],
    timeout
  })) as string;
  console.log(`combatantsHelper = ${combatantsHelper}`);

  upgradeTransactionSet.push(
    getSafeUpgradeTransaction(
      COMBATANTS_HELPER_ADDRESS,
      combatantsHelper,
      genericUpgradeInterface.encodeFunctionData("initializeV4", [])
    )
  );

  const playersLibrary = await ethers.getContractAt("PlayersLibrary", PLAYERS_LIBRARY_ADDRESS);
  console.log(`playersLibrary = "${(await playersLibrary.getAddress()).toLowerCase()}"`);

  const Raids = await ethers.getContractFactory("Raids", {
    libraries: {PlayersLibrary: await playersLibrary.getAddress()},
    signer: proposer
  });
  const raids = (await upgrades.prepareUpgrade(RAIDS_ADDRESS, Raids, {
    kind: "uups",
    unsafeAllow: ["external-library-linking"],
    timeout,
    unsafeSkipStorageCheck: true
  })) as string;
  console.log(`raids = ${raids}`);

  upgradeTransactionSet.push(
    getSafeUpgradeTransaction(
      RAIDS_ADDRESS,
      raids,
      genericUpgradeInterface.encodeFunctionData("initializeV3", [VRF_ADDRESS])
    )
  );

  // Sending 10 S to the RandomnessBeacon & Raids
  // let tx = await owner.sendTransaction({
  //   to: await randomnessBeacon.getAddress(),
  //   value: ethers.parseEther("10")
  // });
  // await tx.wait();
  // console.log("Sent 10 S to randomness beacon", tx.hash);

  // tx = await owner.sendTransaction({
  //   to: await raids.getAddress(),
  //   value: ethers.parseEther("10")
  // });
  // await tx.wait();
  // console.log("Sent 10 S to raids", tx.hash);

  await sendTransactionSetToSafe(network, protocolKit, apiKit, upgradeTransactionSet, proposer);

  if (network.chainId == 146n) {
    // await verifyContracts([await randomnessBeacon.getAddress()]);
    // await verifyContracts([await estforLibrary.getAddress()]);
    // await verifyContracts([await instantVRFActions.getAddress()]);
    // await verifyContracts([await clanBattleLibrary.getAddress()]);
    // await verifyContracts([await pvpBattleground.getAddress()]);
    // await verifyContracts([await raids.getAddress()]);
    // await verifyContracts([await lockedBankVaults.getAddress()]);
    // await verifyContracts([await combatantsHelper.getAddress()]);
    // await verifyContracts([await territories.getAddress()]);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
