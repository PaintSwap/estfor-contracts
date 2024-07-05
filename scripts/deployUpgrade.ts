import {ethers, upgrades} from "hardhat";
import {
  EstforLibrary,
  LockedBankVaultsLibrary,
  PetNFTLibrary,
  PromotionsLibrary,
  RoyaltyReceiver,
  WorldLibrary,
} from "../typechain-types";
import {
  ITEM_NFT_LIBRARY_ADDRESS,
  ITEM_NFT_ADDRESS,
  PLAYERS_ADDRESS,
  PLAYER_NFT_ADDRESS,
  QUESTS_ADDRESS,
  SHOP_ADDRESS,
  CLANS_ADDRESS,
  ESTFOR_LIBRARY_ADDRESS,
  WORLD_ADDRESS,
  WORLD_LIBRARY_ADDRESS,
  ADMIN_ACCESS_ADDRESS,
  WISHING_WELL_ADDRESS,
  BANK_REGISTRY_ADDRESS,
  INSTANT_ACTIONS_ADDRESS,
  PROMOTIONS_ADDRESS,
  PROMOTIONS_LIBRARY_ADDRESS,
  TERRITORIES_ADDRESS,
  DECORATOR_PROVIDER_ADDRESS,
  LOCKED_BANK_VAULTS_ADDRESS,
  COMBATANTS_HELPER_ADDRESS,
  ROYALTY_RECEIVER_ADDRESS,
  INSTANT_VRF_ACTIONS_ADDRESS,
  VRF_REQUEST_INFO_ADDRESS,
  GENERIC_INSTANT_VRF_ACTION_STRATEGY_ADDRESS,
  EGG_INSTANT_VRF_ACTION_STRATEGY_ADDRESS,
  PET_NFT_ADDRESS,
  PASSIVE_ACTIONS_ADDRESS,
  PET_NFT_LIBRARY_ADDRESS,
  LOCKED_BANK_VAULTS_LIBRARY_ADDRESS,
} from "./contractAddresses";
import {verifyContracts} from "./utils";

async function main() {
  const [owner] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  console.log(`Deploying upgradeable contracts with the account: ${owner.address} on chain ${network.chainId}`);

  const timeout = 600 * 1000; // 10 minutes
  const newEstforLibrary = false;
  const EstforLibrary = await ethers.getContractFactory("EstforLibrary");
  let estforLibrary: EstforLibrary;
  if (newEstforLibrary) {
    estforLibrary = await EstforLibrary.deploy();
    await estforLibrary.deployed();
    if (network.chainId == 250) {
      await verifyContracts([estforLibrary.address]);
    }
  } else {
    estforLibrary = await EstforLibrary.attach(ESTFOR_LIBRARY_ADDRESS);
  }
  console.log(`estforLibrary = "${estforLibrary.address.toLowerCase()}"`);

  // LockedBankVaults
  const newLockedBankVaultsLibrary = false;
  const LockedBankVaultsLibrary = await ethers.getContractFactory("LockedBankVaultsLibrary");
  let lockedBankVaultsLibrary: LockedBankVaultsLibrary;
  if (newLockedBankVaultsLibrary) {
    lockedBankVaultsLibrary = await LockedBankVaultsLibrary.deploy();
    await lockedBankVaultsLibrary.deployed();
  } else {
    lockedBankVaultsLibrary = await LockedBankVaultsLibrary.attach(LOCKED_BANK_VAULTS_LIBRARY_ADDRESS);
  }
  console.log(`lockedBankVaultsLibrary = "${lockedBankVaultsLibrary.address.toLowerCase()}"`);

  const LockedBankVaults = (
    await ethers.getContractFactory("LockedBankVaults", {
      libraries: {EstforLibrary: estforLibrary.address, LockedBankVaultsLibrary: lockedBankVaultsLibrary.address},
    })
  ).connect(owner);
  const lockedBankVaults = await upgrades.upgradeProxy(LOCKED_BANK_VAULTS_ADDRESS, LockedBankVaults, {
    kind: "uups",
    unsafeAllow: ["external-library-linking"],
    timeout,
    call: "newUpgrade", // TODO: Remove after prod deployment
  });
  await lockedBankVaults.deployed();
  console.log(`lockedBankVaults = "${lockedBankVaults.address.toLowerCase()}"`);

  const Territories = (await ethers.getContractFactory("Territories")).connect(owner);
  const territories = await upgrades.upgradeProxy(TERRITORIES_ADDRESS, Territories, {
    kind: "uups",
    unsafeAllow: ["external-library-linking"],
    timeout,
    call: "newUpgrade", // TODO: Remove after prod deployment
  });
  await territories.deployed();
  console.log(`territories = "${territories.address.toLowerCase()}"`);

  const CombatantsHelper = (
    await ethers.getContractFactory("CombatantsHelper", {
      libraries: {EstforLibrary: estforLibrary.address},
    })
  ).connect(owner);
  const combatantsHelper = await upgrades.upgradeProxy(COMBATANTS_HELPER_ADDRESS, CombatantsHelper, {
    kind: "uups",
    unsafeAllow: ["external-library-linking"],
    timeout,
    call: "newUpgrade", // TODO: Remove after prod deployment
  });
  await combatantsHelper.deployed();
  console.log(`combatantsHelper = "${combatantsHelper.address.toLowerCase()}"`);

  if (network.chainId == 250) {
    /* await verifyContracts([players.address]);
    await verifyContracts([playerNFT.address]);
        await verifyContracts([itemNFT.address]);
    await verifyContracts([shop.address]);
    await verifyContracts([quests.address]); */
    /*    await verifyContracts([world.address]);
    await verifyContracts([worldLibrary.address]); */
    /*       await verifyContracts([adminAccess.address]);
       await verifyContracts([wishingWell.address]);
     */
    //  await verifyContracts([promotions.address]);
    /*
    await verifyContracts([instantActions.address]);
    await verifyContracts([vrfRequestInfo.address]); */
    /*    await verifyContracts([genericInstantVRFActionStrategy.address]);
    await verifyContracts([eggInstantVRFActionStrategy.address]);
    await verifyContracts([petNFT.address]);
    await verifyContracts([genericInstantVRFActionStrategy.address]);
        await verifyContracts([eggInstantVRFActionStrategy.address]);
    await verifyContracts([petNFT.address]); */
    await verifyContracts([lockedBankVaults.address]);
    /*    await verifyContracts([decoratorProvider.address]);
    await verifyContracts([royaltyReceiver.address]);
    await verifyContracts([passiveActions.address]); */
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
