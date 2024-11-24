import {ethers} from "hardhat";
import {PLAYERS_ADDRESS} from "./contractAddresses";
import {getChainId} from "./utils";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Pause game using account: ${owner.address} on chain id ${await getChainId(owner)}`);

  const players = await ethers.getContractAt("Players", PLAYERS_ADDRESS);
  const tx = await players.pauseGame(true);
  await tx.wait();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
