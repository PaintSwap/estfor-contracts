import {ethers, upgrades} from "hardhat";
import {PlayersLibrary, EstforLibrary} from "../typechain-types";
import {
  ITEM_NFT_LIBRARY_ADDRESS,
  ITEM_NFT_ADDRESS,
  PLAYERS_ADDRESS,
  PLAYERS_LIBRARY_ADDRESS,
  PLAYER_NFT_ADDRESS,
  QUESTS_ADDRESS,
  SHOP_ADDRESS,
  CLANS_ADDRESS,
  ESTFOR_LIBRARY_ADDRESS,
} from "./constants";
import {verifyContracts} from "./utils";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Deploying upgradeable contracts with the account: ${owner.address}`);

  const network = await ethers.provider.getNetwork();
  console.log(`ChainId: ${network.chainId}`);

  const newEstforLibrary = false;
  const EstforLibrary = await ethers.getContractFactory("EstforLibrary");
  let estforLibrary: EstforLibrary;
  if (newEstforLibrary) {
    estforLibrary = await EstforLibrary.deploy();
    await estforLibrary.deployed();
  } else {
    estforLibrary = await EstforLibrary.attach(ESTFOR_LIBRARY_ADDRESS);
  }
  console.log(`estforLibrary = "${estforLibrary.address.toLowerCase()}"`);

  // Players
  const newPlayersLibrary = false;
  const PlayersLibrary = await ethers.getContractFactory("PlayersLibrary");
  let playerLibrary: PlayersLibrary;
  if (newPlayersLibrary) {
    playerLibrary = await PlayersLibrary.deploy();
    await playerLibrary.deployed();
  } else {
    playerLibrary = await PlayersLibrary.attach(PLAYERS_LIBRARY_ADDRESS);
  }
  console.log(`playersLibrary = "${playerLibrary.address.toLowerCase()}"`);

  const Players = await ethers.getContractFactory("Players", {
    libraries: {PlayersLibrary: playerLibrary.address},
  });
  const players = await upgrades.upgradeProxy(PLAYERS_ADDRESS, Players, {
    kind: "uups",
    unsafeAllow: ["delegatecall", "external-library-linking"],
  });
  await players.deployed();
  console.log(`players = "${players.address.toLowerCase()}"`);
  await verifyContracts([players.address]);

  // PlayerNFT
  const PlayerNFT = await ethers.getContractFactory("PlayerNFT", {
    libraries: {EstforLibrary: estforLibrary.address},
  });
  const playerNFT = await upgrades.upgradeProxy(PLAYER_NFT_ADDRESS, PlayerNFT, {
    kind: "uups",
    unsafeAllow: ["external-library-linking"],
  });
  await playerNFT.deployed();
  console.log(`playerNFT = "${playerNFT.address.toLowerCase()}"`);
  await verifyContracts([playerNFT.address]);

  // ItemNFT
  const newItemNFTLibrary = false;
  const ItemNFTLibrary = await ethers.getContractFactory("ItemNFTLibrary");
  let itemNFTLibrary: any;
  if (newItemNFTLibrary) {
    itemNFTLibrary = await ItemNFTLibrary.deploy();
    await itemNFTLibrary.deployed();
  } else {
    itemNFTLibrary = await ItemNFTLibrary.attach(ITEM_NFT_LIBRARY_ADDRESS);
  }
  console.log(`itemNFTLibrary = "${itemNFTLibrary.address.toLowerCase()}"`);

  const ItemNFT = await ethers.getContractFactory("ItemNFT", {libraries: {ItemNFTLibrary: itemNFTLibrary.address}});
  const itemNFT = await upgrades.upgradeProxy(ITEM_NFT_ADDRESS, ItemNFT, {
    kind: "uups",
    unsafeAllow: ["external-library-linking"],
  });
  await itemNFT.deployed();
  console.log(`itemNFT = "${itemNFT.address.toLowerCase()}"`);
  await verifyContracts([itemNFT.address]);
  // Shop
  const Shop = await ethers.getContractFactory("Shop");
  const shop = await upgrades.upgradeProxy(SHOP_ADDRESS, Shop, {
    kind: "uups",
  });
  await shop.deployed();
  console.log(`shop = "${shop.address.toLowerCase()}"`);
  await verifyContracts([shop.address]);
  // Quests
  const Quests = await ethers.getContractFactory("Quests");
  const quests = await upgrades.upgradeProxy(QUESTS_ADDRESS, Quests, {
    kind: "uups",
  });
  await quests.deployed();
  console.log(`quests = "${quests.address.toLowerCase()}"`);
  await verifyContracts([quests.address]);
  // Clan
  const Clans = await ethers.getContractFactory("Clans", {
    libraries: {EstforLibrary: estforLibrary.address},
  });
  const clans = await upgrades.upgradeProxy(CLANS_ADDRESS, Clans, {
    kind: "uups",
    unsafeAllow: ["external-library-linking"],
  });
  await clans.deployed();
  console.log(`clans = "${clans.address.toLowerCase()}"`);
  await verifyContracts([playerNFT.address, itemNFT.address, players.address]);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
