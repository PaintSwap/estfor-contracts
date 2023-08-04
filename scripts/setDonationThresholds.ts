import {ethers} from "hardhat";
import {DONATION_ADDRESS} from "./contractAddresses";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Donating using account: ${owner.address}`);

  const network = await ethers.provider.getNetwork();
  console.log(`ChainId: ${network.chainId}`);

  const Donation = await ethers.getContractFactory("Donation");
  const donation = Donation.attach(DONATION_ADDRESS);
  await donation.setClanThresholdIncrement(ethers.utils.parseEther("50"));
  //  await donation.setNextGlobalDonationThreshold(ethers.utils.parseEther("1000"));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
