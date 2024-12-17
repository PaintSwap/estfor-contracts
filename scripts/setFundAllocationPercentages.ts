import {ethers} from "hardhat";
import {SHOP_ADDRESS, TERRITORY_TREASURY_ADDRESS, TREASURY_ADDRESS} from "./contractAddresses";

async function main() {
  const [owner] = await ethers.getSigners();
  const treasury = (await ethers.getContractAt("Treasury", TREASURY_ADDRESS)).connect(owner);
  const treasuryAccounts = [SHOP_ADDRESS, TERRITORY_TREASURY_ADDRESS, ethers.ZeroAddress];
  const treasuryPercentages = [2, 30, 68];
  const tx = await treasury.setFundAllocationPercentages(treasuryAccounts, treasuryPercentages);
  await tx.wait();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
