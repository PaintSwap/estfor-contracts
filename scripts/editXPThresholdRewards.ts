import {ethers} from "hardhat";
import {PLAYERS_ADDRESS} from "./contractAddresses";
import {allXPThresholdRewards} from "./data/xpThresholdRewards";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Edit xp threshold rewards using account: ${owner.address}`);

  const network = await ethers.provider.getNetwork();
  console.log(`ChainId: ${network.chainId}`);

  const Players = await ethers.getContractFactory("Players");
  const players = Players.attach(PLAYERS_ADDRESS);

  /*
  // Single
  const thresholdRewards = allXPThresholdRewards.find((reward) => reward.xpThreshold === 2700000);
  if (!thresholdRewards) {
    throw new Error("Reward not found");
  }
  await players.editXPThresholdRewards([thresholdRewards]);
*/
  await players.editXPThresholdRewards(allXPThresholdRewards);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
