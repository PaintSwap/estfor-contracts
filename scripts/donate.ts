import {ethers} from "hardhat";
import {BRUSH_ADDRESS, DONATION_ADDRESS} from "./contractAddresses";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Donating using account: ${owner.address}`);

  const network = await ethers.provider.getNetwork();
  console.log(`ChainId: ${network.chainId}`);

  const Donation = await ethers.getContractFactory("Donation");
  const donation = Donation.attach(DONATION_ADDRESS);

  const brush = await ethers.getContractAt("IERC20", BRUSH_ADDRESS);
  let tx = await brush.approve(donation.address, 200);
  await tx.wait();
  const playerId = 1;
  await donation.donate(100, playerId);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
