import {ethers, upgrades} from "hardhat";
import {
  ITEM_NFT_ADDRESS,
  ITEM_NFT_LIBRARY_ADDRESS,
  PLAYERS_ADDRESS,
  PLAYERS_IMPL_MISC_ADDRESS,
  PLAYERS_IMPL_PROCESS_ACTIONS_ADDRESS,
  PLAYERS_IMPL_QUEUE_ACTIONS_ADDRESS,
  PLAYERS_IMPL_REWARDS_ADDRESS,
  PLAYERS_LIBRARY_ADDRESS,
  PLAYER_NFT_ADDRESS,
  QUESTS_ADDRESS,
  SHOP_ADDRESS,
  WORLD_ADDRESS,
} from "./contractAddresses";

// When you need to fork a chain and debug
async function main() {
  const network = await ethers.provider.getNetwork();
  console.log(`ChainId: ${network.chainId}`);

  // Players
  const PlayersLibrary = await ethers.getContractFactory("PlayersLibrary");
  const playerLibrary = await PlayersLibrary.deploy();

  const owner = await ethers.getImpersonatedSigner("0x316342122A9ae36de41B231260579b92F4C8Be7f");
  const player = await ethers.getImpersonatedSigner("0x6dc225f7f21acb842761b8df52ae46208705c942");

  // Set the implementations
  let Players = await ethers.getContractFactory("Players", {
    libraries: {PlayersLibrary: playerLibrary.address},
  });
  Players = Players.connect(owner);
  const players = await upgrades.upgradeProxy(PLAYERS_ADDRESS, Players, {
    kind: "uups",
    unsafeAllow: ["delegatecall", "external-library-linking"],
  });

  const PlayersImplQueueActions = await ethers.getContractFactory("PlayersImplQueueActions", {
    libraries: {PlayersLibrary: playerLibrary.address},
  });
  const playersImplQueueActions = await PlayersImplQueueActions.deploy();
  console.log(`playersImplQueueActions = "${playersImplQueueActions.address.toLowerCase()}"`);
  await playersImplQueueActions.deployed();

  const PlayersImplProcessActions = await ethers.getContractFactory("PlayersImplProcessActions", {
    libraries: {PlayersLibrary: playerLibrary.address},
  });
  const playersImplProcessActions = await PlayersImplProcessActions.deploy();
  console.log(`playersImplProcessActions = "${playersImplProcessActions.address.toLowerCase()}"`);
  await playersImplProcessActions.deployed();

  const PlayersImplRewards = await ethers.getContractFactory("PlayersImplRewards", {
    libraries: {PlayersLibrary: playerLibrary.address},
  });
  const playersImplRewards = await PlayersImplRewards.deploy();
  console.log(`playersImplRewards = "${playersImplRewards.address.toLowerCase()}"`);
  await playersImplRewards.deployed();

  const PlayersImplMisc = await ethers.getContractFactory("PlayersImplMisc", {
    libraries: {PlayersLibrary: playerLibrary.address},
  });
  const playersImplMisc = await PlayersImplMisc.deploy();
  console.log(`playersImplMisc = "${playersImplMisc.address.toLowerCase()}"`);
  await playersImplMisc.deployed();

  const tx = await players
    .connect(owner)
    .setImpls(
      playersImplQueueActions.address,
      playersImplProcessActions.address,
      playersImplRewards.address,
      playersImplMisc.address
    );
  await tx.wait();

  const playerId = 158;

  // PlayerNFT
  const EstforLibrary = await ethers.getContractFactory("EstforLibrary");
  let estforLibrary = await EstforLibrary.deploy();
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
  console.log(`worldLibrary = "${worldLibrary.address.toLowerCase()}"`);

  let World = await ethers.getContractFactory("World", {
    libraries: {WorldLibrary: worldLibrary.address},
  });
  World = World.connect(owner);
  const world = await upgrades.upgradeProxy(WORLD_ADDRESS, World, {
    kind: "uups",
    unsafeAllow: ["external-library-linking"],
  });

  const pendingQueuedActionState = await players.pendingQueuedActionState(player.address, playerId);
  console.log(pendingQueuedActionState);

  console.log(await world.getMultipleFullRandomWords(1684672498));
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
