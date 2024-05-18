import {ethers} from "hardhat";
import {PLAYERS_ADDRESS} from "./contractAddresses";
import {allXPThresholdRewards} from "./data/xpThresholdRewards";
import {Players} from "../typechain-types";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Add xp threshold rewards using account: ${owner.address} on chain id ${await owner.getChainId()}`);

  const players = (await ethers.getContractAt("Players", PLAYERS_ADDRESS)) as Players;

  const newThresholdRewards = allXPThresholdRewards.filter((reward) => reward.xpThreshold > 750000);
  await players.addXPThresholdRewards(newThresholdRewards);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
