import {ethers} from "hardhat";
import {WISHING_WELL_ADDRESS} from "./contractAddresses";
import {getChainId} from "./utils";
import {parseEther} from "ethers";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Updating donation thresholds using account: ${owner.address} on chain id ${await getChainId(owner)}`);

  const wishingWell = await ethers.getContractAt("WishingWell", WISHING_WELL_ADDRESS);
  let tx = await wishingWell.setClanDonationThresholdIncrement(parseEther("3"));
  await tx.wait();
  tx = await wishingWell.setGlobalDonationThresholdIncrement(parseEther("5"));
  await tx.wait();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
