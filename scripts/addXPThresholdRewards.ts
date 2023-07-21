import {ethers} from "hardhat";
import {PLAYERS_ADDRESS, PLAYERS_LIBRARY_ADDRESS} from "./contractAddresses";
import {allXPThresholdRewards} from "./data/xpThresholdRewards";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Add xp threshold rewards using account: ${owner.address}`);

  const network = await ethers.provider.getNetwork();
  console.log(`ChainId: ${network.chainId}`);

  const Players = await ethers.getContractFactory("Players");
  const players = Players.attach(PLAYERS_ADDRESS);

  const newThresholdRewards = allXPThresholdRewards.filter((reward) => reward.xpThreshold > 750000);
  await players.addXPThresholdRewards(newThresholdRewards);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
