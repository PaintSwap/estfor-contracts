import {ethers} from "hardhat";
import {PLAYERS_ADDRESS} from "./contractAddresses";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Pause game using account: ${owner.address}`);

  const network = await ethers.provider.getNetwork();
  console.log(`ChainId: ${network.chainId}`);

  const Players = await ethers.getContractFactory("Players");
  const players = await Players.attach(PLAYERS_ADDRESS);

  await players.pauseGame(true);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
