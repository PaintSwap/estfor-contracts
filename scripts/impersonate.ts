import {ethers} from "hardhat";
import {
  PLAYERS_ADDRESS,
  PLAYERS_IMPL_QUEUE_ACTIONS_ADDRESS,
  PLAYERS_IMPL_REWARDS_ADDRESS,
  PLAYERS_LIBRARY_ADDRESS,
} from "./constants";

// When you need to fork a chain and debug
async function main() {
  const network = await ethers.provider.getNetwork();
  console.log(`ChainId: ${network.chainId}`);

  const PlayersLibrary = await ethers.getContractFactory("PlayersLibrary");
  const playerLibrary = await PlayersLibrary.attach(PLAYERS_LIBRARY_ADDRESS);

  const owner = await ethers.getImpersonatedSigner("0x316342122A9ae36de41B231260579b92F4C8Be7f");

  // Set the implementations
  const Players = await ethers.getContractFactory("Players", {
    libraries: {PlayersLibrary: playerLibrary.address},
  });
  const players = Players.attach(PLAYERS_ADDRESS);
  const impersonatedSigner = await ethers.getImpersonatedSigner("0xa801864d0D24686B15682261aa05D4e1e6e5BD94");

  const PlayersImplProcessActions = await ethers.getContractFactory("PlayersImplProcessActions", {
    libraries: {PlayersLibrary: playerLibrary.address},
  });
  const playersImplProcessActions = await PlayersImplProcessActions.deploy();
  console.log(`playersImplProcessActions = "${playersImplProcessActions.address.toLowerCase()}"`);

  await players
    .connect(owner)
    .setImpls(PLAYERS_IMPL_QUEUE_ACTIONS_ADDRESS, playersImplProcessActions.address, PLAYERS_IMPL_REWARDS_ADDRESS);

  // Do action
  await players.connect(impersonatedSigner).processActions(4);
  console.log(await players.getActionQueue(4));
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
