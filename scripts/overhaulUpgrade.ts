import {ethers, upgrades} from "hardhat";
import {ITEM_NFT_ADDRESS, WORLD_ADDRESS, PLAYERS_ADDRESS, PLAYERS_LIBRARY_ADDRESS} from "./contractAddresses";
import {deployPlayerImplementations, setDailyAndWeeklyRewards} from "./utils";
import {Players, World} from "../typechain-types";
import {allXPThresholdRewards} from "./data/xpThresholdRewards";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Large upgrade using account: ${owner.address}`);

  const network = await ethers.provider.getNetwork();
  console.log(`ChainId: ${network.chainId}`);

  const PlayersLibrary = await ethers.getContractFactory("PlayersLibrary");
  const playersLibrary = await PlayersLibrary.deploy();
  console.log(`playersLibrary = "${playersLibrary.address.toLowerCase()}"`);

  const Players = (
    await ethers.getContractFactory("Players", {
      libraries: {PlayersLibrary: playersLibrary.address},
    })
  ).connect(owner);
  let players = Players.attach(PLAYERS_ADDRESS);
  await players.pauseGame(true);
  players = (await upgrades.upgradeProxy(PLAYERS_ADDRESS, Players, {
    kind: "uups",
    unsafeAllow: ["delegatecall", "external-library-linking"],
  })) as Players;
  await players.deployed();
  console.log("Deployed Players");

  // Update player impls
  const {playersImplQueueActions, playersImplProcessActions, playersImplRewards, playersImplMisc} =
    await deployPlayerImplementations(playersLibrary.address);
  let tx = await players.setImpls(
    playersImplQueueActions.address,
    playersImplProcessActions.address,
    playersImplRewards.address,
    playersImplMisc.address
  );
  await tx.wait();
  console.log("setImpls");

  // Update absence boost in xp threshold
  const thresholdRewards = allXPThresholdRewards.find((reward) => reward.xpThreshold === 2700000);
  if (!thresholdRewards) {
    throw new Error("Reward not found");
  }
  tx = await players.editXPThresholdRewards([thresholdRewards]);
  await tx.wait();
  console.log("editXPThresholdRewards");

  // Update daily reward pools
  const WorldLibrary = await ethers.getContractFactory("WorldLibrary");
  const worldLibrary = await WorldLibrary.deploy();
  console.log(`worldLibrary = "${worldLibrary.address.toLowerCase()}"`);

  const World = (await ethers.getContractFactory("World", {libraries: {WorldLibrary: worldLibrary.address}})).connect(
    owner
  );
  const world = (await upgrades.upgradeProxy(WORLD_ADDRESS, World, {
    kind: "uups",
    unsafeAllow: ["external-library-linking"],
  })) as World;
  await world.deployed();
  console.log("world upgraded");

  await setDailyAndWeeklyRewards(world);
  console.log("setDailyAndWeeklyRewards");

  // ItemNFT
  const ItemNFTLibrary = await ethers.getContractFactory("ItemNFTLibrary");
  const itemNFTLibrary = await ItemNFTLibrary.deploy();
  await itemNFTLibrary.deployed();
  console.log(`itemNFTLibrary = "${itemNFTLibrary.address.toLowerCase()}"`);

  const ItemNFT = (
    await ethers.getContractFactory("ItemNFT", {libraries: {ItemNFTLibrary: itemNFTLibrary.address}})
  ).connect(owner);
  const itemNFT = await upgrades.upgradeProxy(ITEM_NFT_ADDRESS, ItemNFT, {
    kind: "uups",
    unsafeAllow: ["external-library-linking"],
  });
  await itemNFT.deployed();
  console.log(`itemNFT deployed`);

  await itemNFT.setBaseURI("ipfs://QmUMwxxyvRLC3Y82NdqfPXNuCSDfBKjWQq9yhi6Y5qVbFU/");

  // Call the following scripts
  // addActions
  // editActions
  // addActionChoices
  // editActionChoices
  // addItems
  // editItems
  // removeShopItem
  // Airdrop bows to everyone with a player

  /* Unpause (but have PLAYERS_LIBRARY_ADDRESS)
  const PlayersLibrary = await ethers.getContractFactory("PlayersLibrary");
  const playersLibrary = await PlayersLibrary.attach(PLAYERS_LIBRARY_ADDRESS);
  const Players = (
    await ethers.getContractFactory("Players", {
      libraries: {PlayersLibrary: playersLibrary.address},
    })
  ).connect(owner);
  const players = await Players.attach(PLAYERS_ADDRESS);
  await players.pauseGame(false);
  */
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
