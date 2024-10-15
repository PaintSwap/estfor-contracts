import {ethers} from "hardhat";
import {WISHING_WELL_ADDRESS} from "./contractAddresses";
import {getChainId} from "./utils";
import {parseEther} from "ethers";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Updating donation thresholds using account: ${owner.address} on chain id ${await getChainId(owner)}`);

  const wishingWell = await ethers.getContractAt("WishingWell", WISHING_WELL_ADDRESS);
  //  await wishingWell.setClanDonationThresholdIncrement(parseEther("5000"));
  await wishingWell.setGlobalDonationThresholdIncrement(parseEther("75000"));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
