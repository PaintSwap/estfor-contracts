import {ethers} from "hardhat";
import {PLAYERS_ADDRESS, PLAYERS_LIBRARY_ADDRESS} from "./contractAddresses";

// When you need to fork a chain and debug
async function main() {
  const network = await ethers.provider.getNetwork();
  console.log(`ChainId: ${network.chainId}`);

  const PlayersLibrary = await ethers.getContractFactory("PlayersLibrary");
  const playersLibrary = await PlayersLibrary.attach(PLAYERS_LIBRARY_ADDRESS);
  const Players = await ethers.getContractFactory("Players", {
    libraries: {PlayersLibrary: playersLibrary.address},
  });
  const players = Players.attach(PLAYERS_ADDRESS);
  console.log(await players.pendingQueuedActionState("0x6fe413b3c9093dd7c9585e81a7420acc14343cc1", 92));
  console.log(await players.getActionQueue(92));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
