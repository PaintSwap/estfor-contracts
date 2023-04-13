import {ethers} from "hardhat";
import {PlayersLibrary} from "../typechain-types";
import {
  PLAYERS_ADDRESS,
  PLAYERS_IMPL_PROCESS_ACTIONS_ADDRESS,
  PLAYERS_IMPL_QUEUE_ACTIONS_ADDRESS,
  PLAYERS_IMPL_REWARDS_ADDRESS,
  PLAYERS_LIBRARY_ADDRESS,
} from "./constants";
import {verifyContracts} from "./utils";

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
    console.log(`playersLibrary = "${playerLibrary.address.toLowerCase()}"`);
  } else {
    playerLibrary = await PlayersLibrary.attach(PLAYERS_LIBRARY_ADDRESS);
  }

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

  // Set the implementations
  const Players = await ethers.getContractFactory("Players", {
    libraries: {PlayersLibrary: playerLibrary.address},
  });

  /* Use these when keeping old implementations
    PLAYERS_IMPL_QUEUE_ACTIONS_ADDRESS,
    PLAYERS_IMPL_PROCESS_ACTIONS_ADDRESS,
    PLAYERS_IMPL_REWARDS_ADDRESS,
  */
  const players = Players.attach(PLAYERS_ADDRESS);
  const tx = await players.setImpls(
    PLAYERS_IMPL_QUEUE_ACTIONS_ADDRESS,
    playersImplProcessActions.address,
    PLAYERS_IMPL_REWARDS_ADDRESS
  );
  await tx.wait();

  if (network.chainId == 250) {
    await verifyContracts([
      playersImplQueueActions.address,
      playersImplProcessActions.address,
      playersImplRewards.address,
    ]);
  }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
