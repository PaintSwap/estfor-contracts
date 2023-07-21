import {ethers} from "hardhat";
import {PLAYERS_ADDRESS, PLAYERS_LIBRARY_ADDRESS} from "./contractAddresses";
import {allXPThresholdRewards} from "./data/xpThresholdRewards";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Edit xp threshold rewards using account: ${owner.address}`);

  const network = await ethers.provider.getNetwork();
  console.log(`ChainId: ${network.chainId}`);

  const PlayersLibrary = await ethers.getContractFactory("PlayersLibrary");
  const Players = await ethers.getContractFactory("Players");
  const players = Players.attach(PLAYERS_ADDRESS);

  const thresholdRewards = allXPThresholdRewards.find((reward) => reward.xpThreshold === 2700000);
  if (!thresholdRewards) {
    throw new Error("Reward not found");
  }
  await players.editXPThresholdRewards([thresholdRewards]);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
