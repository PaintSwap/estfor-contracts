import {ethers} from "hardhat";
import {PLAYERS_ADDRESS} from "./contractAddresses";
import {Players} from "../typechain-types";
import {getChainId} from "./utils";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Pause game using account: ${owner.address} on chain id ${await getChainId(owner)}`);

  const players = (await ethers.getContractAt("Players", PLAYERS_ADDRESS)) as Players;
  await players.pauseGame(true);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
