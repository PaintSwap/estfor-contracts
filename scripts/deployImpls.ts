import {ethers} from "hardhat";
import {PlayersLibrary} from "../typechain-types";
import {PLAYERS_ADDRESS, PLAYERS_LIBRARY_ADDRESS} from "./constants";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Deploying player implementation contracts with the account: ${owner.address}`);

  const network = await ethers.provider.getNetwork();
  console.log(`ChainId: ${network.chainId}`);

  // Players
  const newPlayersLibrary = false;
  const PlayersLibrary = await ethers.getContractFactory("PlayersLibrary");
  let playerLibrary: PlayersLibrary;
  if (newPlayersLibrary) {
    playerLibrary = await PlayersLibrary.deploy();
    await playerLibrary.deployed();
    console.log(`PlayersLibrary deployed at ${playerLibrary.address.toLowerCase()}`);
  } else {
    playerLibrary = await PlayersLibrary.attach(PLAYERS_LIBRARY_ADDRESS);
  }

  const PlayersImplQueueActions = await ethers.getContractFactory("PlayersImplQueueActions");
  const playersImplQueueActions = await PlayersImplQueueActions.deploy();
  console.log(`PlayersImplQueueActions deployed at ${playersImplQueueActions.address.toLowerCase()}`);

  const PlayersImplProcessActions = await ethers.getContractFactory("PlayersImplProcessActions", {
    libraries: {PlayersLibrary: playerLibrary.address},
  });
  const playersImplProcessActions = await PlayersImplProcessActions.deploy();
  console.log(`PlayersImplProcessActions deployed at ${playersImplProcessActions.address.toLowerCase()}`);

  const PlayersImplRewards = await ethers.getContractFactory("PlayersImplRewards", {
    libraries: {PlayersLibrary: playerLibrary.address},
  });
  const playersImplRewards = await PlayersImplRewards.deploy();
  console.log(`PlayersImplRewards deployed at ${playersImplRewards.address.toLowerCase()}`);

  // Set the implementations
  const Players = await ethers.getContractFactory("Players", {
    libraries: {PlayersLibrary: playerLibrary.address},
  });
  const playersAddress = PLAYERS_ADDRESS;
  const players = Players.attach(playersAddress);
  await players.setImpls(
    playersImplQueueActions.address,
    playersImplProcessActions.address,
    playersImplRewards.address
  );
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
