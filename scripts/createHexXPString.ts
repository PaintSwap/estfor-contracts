import {EstforConstants} from "@paintswap/estfor-definitions";
import {allXPThresholdRewards} from "./data/xpThresholdRewards";

const main = async () => {
  // Reduce the whole levelXp array into a hex string padded to 4 bytes for each element
  const XP_BYTES = EstforConstants.levelXp.reduce((acc, el) => {
    const hex = el.toString(16).padStart(8, "0");
    return acc + hex;
  }, "");

  // Print out the hex string in the format expected by the EstforConstants
  console.log(`XP_BYTES: "${XP_BYTES.toUpperCase()}"`);

  // Reduce the whole levelXp array into a hex string padded to 3 bytes for each element
  const rewards = allXPThresholdRewards.map((xpThresholdReward) => xpThresholdReward.xpThreshold);
  const XP_THRESHOLD_REWARDS = rewards.reduce((acc, el) => {
    const hex = el.toString(16).padStart(8, "0");
    return acc + hex;
  }, "00000000");

  console.log(`XP_THRESHOLD_REWARDS: "${XP_THRESHOLD_REWARDS.toUpperCase()}"`);
};

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
