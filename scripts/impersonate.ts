import {ethers, upgrades} from "hardhat";
import {
  CLANS_ADDRESS,
  EGG_INSTANT_VRF_ACTION_STRATEGY_ADDRESS,
  ESTFOR_LIBRARY_ADDRESS,
  INSTANT_VRF_ACTIONS_ADDRESS,
  ITEM_NFT_ADDRESS,
  LOCKED_BANK_VAULTS_ADDRESS,
  PET_NFT_ADDRESS,
  PLAYERS_ADDRESS,
  PLAYER_NFT_ADDRESS,
  PROMOTIONS_ADDRESS,
  QUESTS_ADDRESS,
  SHOP_ADDRESS,
  TERRITORIES_ADDRESS,
  WORLD_ADDRESS,
} from "./contractAddresses";
import {createPlayer, deployPlayerImplementations} from "./utils";
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
  Territories,
  WorldLibrary,
} from "../typechain-types";

// When you need to fork a chain and debug
async function main() {
  const network = await ethers.provider.getNetwork();
  console.log(`ChainId: ${network.chainId}`);

  const owner = await ethers.getImpersonatedSigner("0x316342122A9ae36de41B231260579b92F4C8Be7f");
  const player = await ethers.getImpersonatedSigner("0x8ca12fb5438252ab8efa25d3fb34166eda1c17ed");
  const playerId = 3;
  const estforLibrary = (await ethers.deployContract("EstforLibrary")) as EstforLibrary;
  // Players
  const playersLibrary = (await ethers.deployContract("PlayersLibrary")) as PlayersLibrary;

  const Players = (await ethers.getContractFactory("Players")).connect(owner);
  const players = (await upgrades.upgradeProxy(PLAYERS_ADDRESS, Players, {
    kind: "uups",
    unsafeAllow: ["delegatecall", "external-library-linking"],
  })) as Players;

  // Set the implementations
  const {playersImplQueueActions, playersImplProcessActions, playersImplRewards, playersImplMisc, playersImplMisc1} =
    await deployPlayerImplementations(playersLibrary.address);

  const tx = await players
    .connect(owner)
    .setImpls(
      playersImplQueueActions.address,
      playersImplProcessActions.address,
      playersImplRewards.address,
      playersImplMisc.address,
      playersImplMisc1.address
    );
  await tx.wait();
  // PlayerNFT
  const PlayerNFT = (
    await ethers.getContractFactory("PlayerNFT", {
      libraries: {EstforLibrary: estforLibrary.address},
    })
  ).connect(owner);
  const playerNFT = (await upgrades.upgradeProxy(PLAYER_NFT_ADDRESS, PlayerNFT, {
    kind: "uups",
    unsafeAllow: ["external-library-linking"],
  })) as PlayerNFT;

  // Quests
  const Quests = (await ethers.getContractFactory("Quests")).connect(owner);
  const quests = (await upgrades.upgradeProxy(QUESTS_ADDRESS, Quests, {
    kind: "uups",
  })) as Quests;

  const Shop = (await ethers.getContractFactory("Shop")).connect(owner);
  const shop = (await upgrades.upgradeProxy(SHOP_ADDRESS, Shop, {
    kind: "uups",
  })) as Shop;

  // Create the world
  const worldLibrary = (await ethers.deployContract("WorldLibrary")) as WorldLibrary;

  const World = (
    await ethers.getContractFactory("World", {
      libraries: {WorldLibrary: worldLibrary.address},
    })
  ).connect(owner);
  const world = await upgrades.upgradeProxy(WORLD_ADDRESS, World, {
    kind: "uups",
    unsafeAllow: ["external-library-linking"],
  });

  // ItemNFT
  const itemNFTLibrary = await ethers.deployContract("ItemNFTLibrary");

  const ItemNFT = (
    await ethers.getContractFactory("ItemNFT", {libraries: {ItemNFTLibrary: itemNFTLibrary.address}})
  ).connect(owner);
  const itemNFT = (await upgrades.upgradeProxy(ITEM_NFT_ADDRESS, ItemNFT, {
    kind: "uups",
    unsafeAllow: ["external-library-linking"],
  })) as ItemNFT;

  const promotionsLibrary = await ethers.deployContract("PromotionsLibrary");
  const Promotions = (
    await ethers.getContractFactory("Promotions", {
      libraries: {PromotionsLibrary: promotionsLibrary.address},
    })
  ).connect(owner);
  const promotions = (await upgrades.upgradeProxy(PROMOTIONS_ADDRESS, Promotions, {
    kind: "uups",
    unsafeAllow: ["external-library-linking"],
  })) as Promotions;

  const Clans = (
    await ethers.getContractFactory("Clans", {
      libraries: {EstforLibrary: estforLibrary.address},
    })
  ).connect(owner);
  const clans = (await upgrades.upgradeProxy(CLANS_ADDRESS, Clans, {
    kind: "uups",
    unsafeAllow: ["external-library-linking"],
  })) as Clans;

  const lockedBankVaultsLibrary = (await ethers.deployContract("LockedBankVaultsLibrary")) as LockedBankVaultsLibrary;

  const LockedBankVaults = (
    await ethers.getContractFactory("LockedBankVaults", {
      libraries: {
        EstforLibrary: estforLibrary.address,
        LockedBankVaultsLibrary: lockedBankVaultsLibrary.address,
      },
    })
  ).connect(owner);
  const lockedBankVaults = (await upgrades.upgradeProxy(LOCKED_BANK_VAULTS_ADDRESS, LockedBankVaults, {
    kind: "uups",
    unsafeAllow: ["external-library-linking"],
  })) as LockedBankVaults;

  const Territories = (await ethers.getContractFactory("Territories")).connect(owner);
  const territories = (await upgrades.upgradeProxy(TERRITORIES_ADDRESS, Territories, {
    kind: "uups",
    unsafeAllow: ["external-library-linking"],
  })) as Territories;

  const petNFTLibrary = (await ethers.deployContract("PetNFTLibrary")) as PetNFTLibrary;
  const PetNFT = (
    await ethers.getContractFactory("PetNFT", {
      libraries: {EstforLibrary: ESTFOR_LIBRARY_ADDRESS, PetNFTLibrary: petNFTLibrary.address},
    })
  ).connect(owner);
  const petNFT = (await upgrades.upgradeProxy(PET_NFT_ADDRESS, PetNFT, {
    kind: "uups",
    unsafeAllow: ["external-library-linking"],
    timeout: 10000,
  })) as PetNFT;
  await petNFT.deployed();

  const EggInstantVRFActionStrategy = (await ethers.getContractFactory("EggInstantVRFActionStrategy")).connect(owner);
  const eggInstantVRFActionStrategy = (await upgrades.upgradeProxy(
    EGG_INSTANT_VRF_ACTION_STRATEGY_ADDRESS,
    EggInstantVRFActionStrategy,
    {
      kind: "uups",
      timeout: 100000,
    }
  )) as EggInstantVRFActionStrategy;
  await eggInstantVRFActionStrategy.deployed();

  const InstantVRFActions = (await ethers.getContractFactory("InstantVRFActions")).connect(owner);
  const instantVRFActions = (await upgrades.upgradeProxy(INSTANT_VRF_ACTIONS_ADDRESS, InstantVRFActions, {
    kind: "uups",
    timeout: 100000,
  })) as InstantVRFActions;
  //  await players.connect(player).testModifyXP("0x6dC225F7f21ACB842761b8df52AE46208705c942", 158, 12, 1109796, true);

  const pendingQueuedActionState = await players.pendingQueuedActionState(player.address, playerId);
  console.log(pendingQueuedActionState);

  await players.connect(player).processActions(playerId);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
