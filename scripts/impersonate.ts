import {ethers, upgrades} from "hardhat";
import {
  CLANS_ADDRESS,
  ITEM_NFT_ADDRESS,
  LOCKED_BANK_VAULT_ADDRESS,
  PLAYERS_ADDRESS,
  PLAYER_NFT_ADDRESS,
  PROMOTIONS_ADDRESS,
  QUESTS_ADDRESS,
  SHOP_ADDRESS,
  TERRITORIES_ADDRESS,
  WORLD_ADDRESS,
} from "./contractAddresses";
import {deployPlayerImplementations} from "./utils";
import {Clans} from "../typechain-types";
import {ClanRank} from "@paintswap/estfor-definitions/types";

// When you need to fork a chain and debug
async function main() {
  const network = await ethers.provider.getNetwork();
  console.log(`ChainId: ${network.chainId}`);

  const owner = await ethers.getImpersonatedSigner("0x316342122A9ae36de41B231260579b92F4C8Be7f");
  const player = await ethers.getImpersonatedSigner("0xe13894604b6dc9523a9822dfa2909c2a9cd084a6");
  const playerId = 892;
  const EstforLibrary = await ethers.getContractFactory("EstforLibrary");
  let estforLibrary = await EstforLibrary.deploy();

  // Players
  const PlayersLibrary = await ethers.getContractFactory("PlayersLibrary");
  const playersLibrary = await PlayersLibrary.deploy();

  // Set the implementations
  let Players = await ethers.getContractFactory("Players");
  Players = Players.connect(owner);
  const players = await upgrades.upgradeProxy(PLAYERS_ADDRESS, Players, {
    kind: "uups",
    unsafeAllow: ["delegatecall", "external-library-linking"],
  });

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
  await estforLibrary.deployed();
  let PlayerNFT = await ethers.getContractFactory("PlayerNFT", {
    libraries: {EstforLibrary: estforLibrary.address},
  });
  PlayerNFT = PlayerNFT.connect(owner);
  const playerNFT = await upgrades.upgradeProxy(PLAYER_NFT_ADDRESS, PlayerNFT, {
    kind: "uups",
    unsafeAllow: ["external-library-linking"],
  });

  // Quests
  let Quests = await ethers.getContractFactory("Quests");
  Quests = Quests.connect(owner);
  const quests = await upgrades.upgradeProxy(QUESTS_ADDRESS, Quests, {
    kind: "uups",
  });

  let Shop = await ethers.getContractFactory("Shop");
  Shop = Shop.connect(owner);
  const shop = await upgrades.upgradeProxy(SHOP_ADDRESS, Shop, {
    kind: "uups",
  });

  // Create the world
  const WorldLibrary = await ethers.getContractFactory("WorldLibrary");
  const worldLibrary = await WorldLibrary.deploy();

  let World = await ethers.getContractFactory("World", {
    libraries: {WorldLibrary: worldLibrary.address},
  });
  World = World.connect(owner);
  const world = await upgrades.upgradeProxy(WORLD_ADDRESS, World, {
    kind: "uups",
    unsafeAllow: ["external-library-linking"],
  });

  // ItemNFT
  const ItemNFTLibrary = await ethers.getContractFactory("ItemNFTLibrary");
  const itemNFTLibrary = await ItemNFTLibrary.deploy();

  let ItemNFT = await ethers.getContractFactory("ItemNFT", {libraries: {ItemNFTLibrary: itemNFTLibrary.address}});
  ItemNFT = ItemNFT.connect(owner);
  const itemNFT = await upgrades.upgradeProxy(ITEM_NFT_ADDRESS, ItemNFT, {
    kind: "uups",
    unsafeAllow: ["external-library-linking"],
  });

  let Promotions = await ethers.getContractFactory("Promotions");
  Promotions = Promotions.connect(owner);
  const promotions = await upgrades.upgradeProxy(PROMOTIONS_ADDRESS, Promotions, {
    kind: "uups",
  });

  let Clans = (
    await ethers.getContractFactory("Clans", {
      libraries: {EstforLibrary: estforLibrary.address},
    })
  ).connect(owner);
  const clans = (await upgrades.upgradeProxy(CLANS_ADDRESS, Clans, {
    kind: "uups",
    unsafeAllow: ["external-library-linking"],
  })) as Clans;

  const LockedBankVaults = (await ethers.getContractFactory("LockedBankVaults")).connect(owner);
  const lockedBankVaults = await upgrades.upgradeProxy(LOCKED_BANK_VAULT_ADDRESS, LockedBankVaults, {
    kind: "uups",
    unsafeAllow: ["external-library-linking"],
  });

  const Territories = (await ethers.getContractFactory("Territories")).connect(owner);
  const territories = await upgrades.upgradeProxy(TERRITORIES_ADDRESS, Territories, {
    kind: "uups",
    unsafeAllow: ["external-library-linking"],
  });

  //  const pendingQueuedActionState = await players.pendingQueuedActionState(player.address, playerId);
  //  console.log(pendingQueuedActionState);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
