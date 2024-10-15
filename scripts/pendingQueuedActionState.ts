import {ethers} from "hardhat";
import {PLAYERS_ADDRESS} from "./contractAddresses";
import {Players} from "../typechain-types";

// When you need to fork a chain and debug
async function main() {
  const network = await ethers.provider.getNetwork();
  console.log(`ChainId: ${network.chainId}`);

  const Players = await ethers.getContractFactory("Players");
  const players = Players.attach(PLAYERS_ADDRESS) as Players;
  console.log(await players.pendingQueuedActionState("0x6fe413b3c9093dd7c9585e81a7420acc14343cc1", 92));
  console.log(await players.getActionQueue(92));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
