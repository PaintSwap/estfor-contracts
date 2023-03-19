import {ethers} from "hardhat";
import {PlayerLibrary} from "../typechain-types";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Deploying player implementation contracts with the account: ${owner.address}`);

  const network = await ethers.provider.getNetwork();
  console.log(`ChainId: ${network.chainId}`);

  // Players
  const newPlayersLibrary = false;
  const PlayerLibrary = await ethers.getContractFactory("PlayerLibrary");
  let playerLibrary: PlayerLibrary;
  if (newPlayersLibrary) {
    playerLibrary = await PlayerLibrary.deploy();
    await playerLibrary.deployed();
    console.log(`PlayerLibrary deployed at ${playerLibrary.address.toLowerCase()}`);
  } else {
    playerLibrary = await PlayerLibrary.attach("0xaaececb8429c524420820cf8d610d7a49dc887d2");
  }

  const PlayersImplQueueActions = await ethers.getContractFactory("PlayersImplQueueActions");
  const playersImplQueueActions = await PlayersImplQueueActions.deploy();
  console.log(`PlayersImplQueueActions deployed at ${playersImplQueueActions.address.toLowerCase()}`);

  const PlayersImplProcessActions = await ethers.getContractFactory("PlayersImplProcessActions", {
    libraries: {PlayerLibrary: playerLibrary.address},
  });
  const playersImplProcessActions = await PlayersImplProcessActions.deploy();
  console.log(`PlayersImplProcessActions deployed at ${playersImplProcessActions.address.toLowerCase()}`);

  const PlayersImplRewards = await ethers.getContractFactory("PlayersImplRewards", {
    libraries: {PlayerLibrary: playerLibrary.address},
  });
  const playersImplRewards = await PlayersImplRewards.deploy();
  console.log(`PlayersImplRewards deployed at ${playersImplRewards.address.toLowerCase()}`);

  // Set the implementations
  const Players = await ethers.getContractFactory("Players", {
    libraries: {PlayerLibrary: playerLibrary.address},
  });
  const playersAddress = "0x8958e25967d36e2f8d79f0991c7ac5a34d54ea8b";
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
