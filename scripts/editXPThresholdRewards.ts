import {ethers} from "hardhat";
import {PLAYERS_ADDRESS} from "./contractAddresses";
import {allXPThresholdRewards} from "./data/xpThresholdRewards";
import {Players} from "../typechain-types";
import {getChainId} from "./utils";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Edit xp threshold rewards using account: ${owner.address} on chain id ${await getChainId(owner)}`);

  const players = (await ethers.getContractAt("Players", PLAYERS_ADDRESS)) as Players;

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
