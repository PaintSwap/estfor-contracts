import {ethers, upgrades} from "hardhat";
import {EstforLibrary, WorldLibrary} from "../typechain-types";
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
  DONATION_ADDRESS,
  BANK_REGISTRY_ADDRESS,
} from "./contractAddresses";
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
    await verifyContracts([estforLibrary.address]);
  } else {
    estforLibrary = await EstforLibrary.attach(ESTFOR_LIBRARY_ADDRESS);
  }
  console.log(`estforLibrary = "${estforLibrary.address.toLowerCase()}"`);

  // Players
  const Players = await ethers.getContractFactory("Players");
  const players = await upgrades.upgradeProxy(PLAYERS_ADDRESS, Players, {
    kind: "uups",
    unsafeAllow: ["delegatecall", "external-library-linking"],
  });
  await players.deployed();
  console.log(`players = "${players.address.toLowerCase()}"`);

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

  // Shop
  const Shop = await ethers.getContractFactory("Shop");
  const shop = await upgrades.upgradeProxy(SHOP_ADDRESS, Shop, {
    kind: "uups",
  });
  await shop.deployed();
  console.log(`shop = "${shop.address.toLowerCase()}"`);

  const Donation = await ethers.getContractFactory("Donation");
  const donation = await upgrades.upgradeProxy(DONATION_ADDRESS, Donation, {
    kind: "uups",
  });
  await donation.deployed();
  console.log(`donation = "${donation.address.toLowerCase()}"`);

  // Quests
  const Quests = await ethers.getContractFactory("Quests");
  const quests = await upgrades.upgradeProxy(QUESTS_ADDRESS, Quests, {
    kind: "uups",
  });
  await quests.deployed();
  console.log(`quests = "${quests.address.toLowerCase()}"`);

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

  // Bank Registry
  const BankRegistry = await ethers.getContractFactory("BankRegistry");
  const bankRegistry = await upgrades.upgradeProxy(BANK_REGISTRY_ADDRESS, BankRegistry, {
    kind: "uups",
  });
  await bankRegistry.deployed();
  console.log(`bankRegistry = "${bankRegistry.address.toLowerCase()}"`);

  // World
  const newWorldLibrary = false;
  const WorldLibrary = await ethers.getContractFactory("WorldLibrary");
  let worldLibrary: WorldLibrary;
  if (newWorldLibrary) {
    worldLibrary = await WorldLibrary.deploy();
    await worldLibrary.deployed();
  } else {
    worldLibrary = await WorldLibrary.attach(WORLD_LIBRARY_ADDRESS);
  }
  console.log(`worldLibrary = "${worldLibrary.address.toLowerCase()}"`);

  const World = await ethers.getContractFactory("World", {
    libraries: {WorldLibrary: worldLibrary.address},
  });
  const world = await upgrades.upgradeProxy(WORLD_ADDRESS, World, {
    kind: "uups",
    unsafeAllow: ["external-library-linking"],
  });
  await world.deployed();
  console.log(`world = "${world.address.toLowerCase()}"`);

  // AdminAccess
  const AdminAccess = await ethers.getContractFactory("AdminAccess");
  const adminAccess = await upgrades.upgradeProxy(ADMIN_ACCESS_ADDRESS, AdminAccess, {
    kind: "uups",
  });
  await adminAccess.deployed();

  await verifyContracts([players.address]);
  await verifyContracts([playerNFT.address]);
  await verifyContracts([itemNFT.address]);
  await verifyContracts([shop.address]);
  await verifyContracts([quests.address]);
  await verifyContracts([clans.address]);
  await verifyContracts([world.address]);
  await verifyContracts([adminAccess.address]);
  await verifyContracts([bankRegistry.address]);
  await verifyContracts([players.address]);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
