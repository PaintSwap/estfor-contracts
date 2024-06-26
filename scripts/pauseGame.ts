import {ethers} from "hardhat";
import {PLAYERS_ADDRESS} from "./contractAddresses";
import {Players} from "../typechain-types";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Pause game using account: ${owner.address} on chain id ${await owner.getChainId()}`);

  const players = (await ethers.getContractAt("Players", PLAYERS_ADDRESS)) as Players;
  await players.pauseGame(true);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
