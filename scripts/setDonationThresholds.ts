import {ethers} from "hardhat";
import {WISHING_WELL_ADDRESS} from "./contractAddresses";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Updating donation thresholds using account: ${owner.address} on chain id ${await owner.getChainId()}`);

  const wishingWell = await ethers.getContractAt("WishingWell", WISHING_WELL_ADDRESS);
  //  await wishingWell.setClanDonationThresholdIncrement(ethers.utils.parseEther("5000"));
  await wishingWell.setGlobalDonationThresholdIncrement(ethers.utils.parseEther("75000"));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
