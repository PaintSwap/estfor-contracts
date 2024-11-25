import {ethers} from "hardhat";
import {PLAYERS_ADDRESS} from "./contractAddresses";
import {allXPThresholdRewards} from "./data/xpThresholdRewards";
import {getChainId} from "./utils";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Add xp threshold rewards using account: ${owner.address} on chain id ${await getChainId(owner)}`);

  const players = await ethers.getContractAt("Players", PLAYERS_ADDRESS);

  const newThresholdRewards = allXPThresholdRewards.filter((reward) => reward.xpThreshold > 750000);
  await players.addXPThresholdRewards(newThresholdRewards);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
