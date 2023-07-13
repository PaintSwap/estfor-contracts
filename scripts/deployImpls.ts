import {ethers} from "hardhat";
import {PlayersLibrary} from "../typechain-types";
import {
  PLAYERS_ADDRESS,
  PLAYERS_IMPL_MISC_ADDRESS,
  PLAYERS_IMPL_PROCESS_ACTIONS_ADDRESS,
  PLAYERS_IMPL_QUEUE_ACTIONS_ADDRESS,
  PLAYERS_IMPL_REWARDS_ADDRESS,
  PLAYERS_LIBRARY_ADDRESS,
} from "./contractAddresses";
import {deployPlayerImplementations, verifyContracts} from "./utils";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Deploying player implementation contracts with the account: ${owner.address}`);

  const network = await ethers.provider.getNetwork();
  console.log(`ChainId: ${network.chainId}`);

  // Players
  const newPlayersLibrary = true;
  const PlayersLibrary = await ethers.getContractFactory("PlayersLibrary");
  let playersLibrary: PlayersLibrary;
  if (newPlayersLibrary) {
    playersLibrary = await PlayersLibrary.deploy();
    await playersLibrary.deployed();
    await verifyContracts([playersLibrary.address]);
  } else {
    playersLibrary = await PlayersLibrary.attach(PLAYERS_LIBRARY_ADDRESS);
  }
  console.log(`playersLibrary = "${playersLibrary.address.toLowerCase()}"`);

  const {playersImplQueueActions, playersImplProcessActions, playersImplRewards, playersImplMisc} =
    await deployPlayerImplementations(playersLibrary.address);

  // Set the implementations
  const Players = await ethers.getContractFactory("Players", {
    libraries: {PlayersLibrary: playersLibrary.address},
  });

  /* Use these when keeping old implementations
    PLAYERS_IMPL_QUEUE_ACTIONS_ADDRESS,
    PLAYERS_IMPL_PROCESS_ACTIONS_ADDRESS,
    PLAYERS_IMPL_REWARDS_ADDRESS,
    PLAYERS_IMPL_MISC_ADDRESS
  */
  const players = Players.attach(PLAYERS_ADDRESS);
  const tx = await players.setImpls(
    playersImplQueueActions.address,
    playersImplProcessActions.address,
    playersImplRewards.address,
    playersImplMisc.address
  );
  await tx.wait();

  if (network.chainId == 250) {
    await verifyContracts([
      playersImplQueueActions.address,
      playersImplProcessActions.address,
      playersImplRewards.address,
      playersImplMisc.address,
    ]);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
