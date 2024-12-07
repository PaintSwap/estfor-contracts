import {ethers, upgrades} from "hardhat";
import {
  CLANS_ADDRESS,
  EGG_INSTANT_VRF_ACTION_STRATEGY_ADDRESS,
  ESTFOR_LIBRARY_ADDRESS,
  INSTANT_VRF_ACTIONS_ADDRESS,
  ITEM_NFT_ADDRESS,
  LOCKED_BANK_VAULTS_ADDRESS,
  ORACLE_ADDRESS,
  PET_NFT_ADDRESS,
  PLAYERS_ADDRESS,
  PLAYER_NFT_ADDRESS,
  PROMOTIONS_ADDRESS,
  QUESTS_ADDRESS,
  SAMWITCH_VRF_ADDRESS,
  SHOP_ADDRESS,
  TERRITORIES_ADDRESS,
  RANDOMNESS_BEACON_ADDRESS
} from "./contractAddresses";
import {deployPlayerImplementations} from "./utils";
import {
  Clans,
  EggInstantVRFActionStrategy,
  EstforLibrary,
  InstantVRFActions,
  ItemNFT,
  LockedBankVaults,
  LockedBankVaultsLibrary,
  PetNFT,
  PetNFTLibrary,
  PlayerNFT,
  Players,
  PlayersLibrary,
  Promotions,
  Quests,
  Shop,
  Territories
} from "../typechain-types";
import {LockedBankVault} from "@paintswap/estfor-definitions/types";
import {makeSigner} from "../test/Players/utils";

// When you need to fork a chain and debug
async function main() {
  const network = await ethers.provider.getNetwork();
  console.log(`ChainId: ${network.chainId}`);

  const owner = await ethers.getImpersonatedSigner("0x316342122A9ae36de41B231260579b92F4C8Be7f");

  const player = await ethers.getImpersonatedSigner("0x8ca12fb5438252ab8efa25d3fb34166eda1c17ed");
  const playerId = 3;
  const estforLibrary = await ethers.deployContract("EstforLibrary");
  // Players
  const playersLibrary = await ethers.deployContract("PlayersLibrary");

  const Players = await ethers.getContractFactory("Players");
  const players = (await upgrades.upgradeProxy(PLAYERS_ADDRESS, Players, {
    kind: "uups",
    unsafeAllow: ["delegatecall"]
  })) as unknown as Players;
  /*
  // Set the implementations
  const {playersImplQueueActions, playersImplProcessActions, playersImplRewards, playersImplMisc, playersImplMisc1} =
    await deployPlayerImplementations(await playersLibrary.getAddress());

  const tx = await players.setImpls(
    await playersImplQueueActions.getAddress(),
    await playersImplProcessActions.getAddress(),
    await playersImplRewards.getAddress(),
    await playersImplMisc.getAddress(),
    await playersImplMisc1.getAddress()
  );
  await tx.wait();

  // PlayerNFT
  const PlayerNFT = await ethers.getContractFactory("PlayerNFT", {
    libraries: {EstforLibrary: await estforLibrary.getAddress()}
  });
  const playerNFT = (await upgrades.upgradeProxy(PLAYER_NFT_ADDRESS, PlayerNFT, {
    kind: "uups",
    unsafeAllow: ["external-library-linking"]
  })) as unknown as PlayerNFT;

  // Quests
  const Quests = await ethers.getContractFactory("Quests");
  const quests = (await upgrades.upgradeProxy(QUESTS_ADDRESS, Quests, {
    kind: "uups"
  })) as unknown as Quests;

  const Shop = await ethers.getContractFactory("Shop");
  const shop = (await upgrades.upgradeProxy(SHOP_ADDRESS, Shop, {
    kind: "uups"
  })) as unknown as Shop;

  // Create the world

  const RandomnessBeacon = await ethers.getContractFactory("RandomnessBeacon");
  const randomnessBeacon = await upgrades.upgradeProxy(RANDOMNESS_BEACON_ADDRESS, RandomnessBeacon, {
    kind: "uups",
    unsafeAllow: ["external-library-linking"]
  });

  // ItemNFT
  const itemNFTLibrary = await ethers.deployContract("ItemNFTLibrary");

  const ItemNFT = await ethers.getContractFactory("ItemNFT", {
    libraries: {ItemNFTLibrary: await itemNFTLibrary.getAddress()}
  });
  const itemNFT = (await upgrades.upgradeProxy(ITEM_NFT_ADDRESS, ItemNFT, {
    kind: "uups",
    unsafeAllow: ["external-library-linking"]
  })) as unknown as ItemNFT;

  const promotionsLibrary = await ethers.deployContract("PromotionsLibrary");
  const Promotions = await ethers.getContractFactory("Promotions", {
    libraries: {PromotionsLibrary: await promotionsLibrary.getAddress()}
  });
  const promotions = (await upgrades.upgradeProxy(PROMOTIONS_ADDRESS, Promotions, {
    kind: "uups",
    unsafeAllow: ["external-library-linking"]
  })) as unknown as Promotions;

  const Clans = await ethers.getContractFactory("Clans", {
    libraries: {EstforLibrary: await estforLibrary.getAddress()}
  });
  const clans = (await upgrades.upgradeProxy(CLANS_ADDRESS, Clans, {
    kind: "uups",
    unsafeAllow: ["external-library-linking"]
  })) as unknown as Clans;

  const lockedBankVaultsLibrary = await ethers.deployContract(
    "LockedBankVaultsLibrary"
  );

  const LockedBankVaults = await ethers.getContractFactory("LockedBankVaults", {
    libraries: {
      EstforLibrary: await estforLibrary.getAddress(),
      LockedBankVaultsLibrary: await lockedBankVaultsLibrary.getAddress()
    }
  });
  const lockedBankVaults = (await upgrades.upgradeProxy(LOCKED_BANK_VAULTS_ADDRESS, LockedBankVaults, {
    kind: "uups",
    unsafeAllow: ["external-library-linking"]
  })) as unknown as LockedBankVaults;

  const Territories = await ethers.getContractFactory("Territories");
  const territories = (await upgrades.upgradeProxy(TERRITORIES_ADDRESS, Territories, {
    kind: "uups",
    unsafeAllow: ["external-library-linking"]
  })) as unknown as Territories;

  const petNFTLibrary = await ethers.deployContract("PetNFTLibrary");
  const PetNFT = await ethers.getContractFactory("PetNFT", {
    libraries: {EstforLibrary: ESTFOR_LIBRARY_ADDRESS, PetNFTLibrary: await petNFTLibrary.getAddress()}
  });
  const petNFT = (await upgrades.upgradeProxy(PET_NFT_ADDRESS, PetNFT, {
    kind: "uups",
    unsafeAllow: ["external-library-linking"],
    timeout: 10000
  })) as unknown as PetNFT;
  await petNFT.waitForDeployment();

  const EggInstantVRFActionStrategy = await ethers.getContractFactory("EggInstantVRFActionStrategy");
  const eggInstantVRFActionStrategy = (await upgrades.upgradeProxy(
    EGG_INSTANT_VRF_ACTION_STRATEGY_ADDRESS,
    EggInstantVRFActionStrategy,
    {
      kind: "uups",
      timeout: 100000
    }
  )) as unknown as EggInstantVRFActionStrategy;
  await eggInstantVRFActionStrategy.waitForDeployment();

  const InstantVRFActions = await ethers.getContractFactory("InstantVRFActions");
  const instantVRFActions = (await upgrades.upgradeProxy(INSTANT_VRF_ACTIONS_ADDRESS, InstantVRFActions, {
    kind: "uups",
    timeout: 100000
  })) as unknown as InstantVRFActions;
*/
  //  await players.connect(player).modifyXP("0x6dC225F7f21ACB842761b8df52AE46208705c942", 158, 12, 1109796);
  const pendingQueuedActionState = await players.getPendingQueuedActionState(player.address, playerId);
  console.log(pendingQueuedActionState);
  /* When trying to fix a VRF issue
const randomnessBeacon = await ethers.getContractAt("RandomnessBeacon", RANDOMNESS_BEACON_ADDRESS);
  const samwitchVRFSigner = await makeSigner(SAMWITCH_VRF_ADDRESS);
  const tx = await randomnessBeacon
    .connect(samwitchVRFSigner)
    .fulfillRandomWords(
      ethers.toBeHex("104046019367107169710442674117296229748040445173308782669979590837825775087813", 32),
      [1323423423423423431111111111111111111n],
      {gasLimit: 1000000}
    );
  await tx.wait();
  */
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
