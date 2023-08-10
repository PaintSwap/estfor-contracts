import {ethers} from "hardhat";
import {WISHING_WELL_ADDRESS} from "./contractAddresses";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Donating using account: ${owner.address}`);

  const network = await ethers.provider.getNetwork();
  console.log(`ChainId: ${network.chainId}`);

  const WishingWell = await ethers.getContractFactory("WishingWell");
  const wishingWell = WishingWell.attach(WISHING_WELL_ADDRESS);
  await wishingWell.setClanDonationThresholdIncrement(ethers.utils.parseEther("50"));
  //  await wishingWell.setLastGlobalDonationThreshold(ethers.utils.parseEther("1000"));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
