import {ethers} from "hardhat";
import {CLANS_ADDRESS} from "./contractAddresses";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(
    `Set PaintSwapMarketplaceWhitelist on Clans using account: ${owner.address} on chain id ${await owner.getChainId()}`
  );

  const clans = await ethers.getContractAt("Clans", CLANS_ADDRESS);
  const tx = await clans.setPaintSwapMarketplaceWhitelist("0x7559038535f3d6ed6BAc5a54Ab4B69DA827F44BD");
  await tx.wait();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
