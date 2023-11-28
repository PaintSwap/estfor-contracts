import {ethers} from "hardhat";
import {CLANS_ADDRESS} from "./contractAddresses";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Set Territories on Clans using account: ${owner.address} on chain id ${await owner.getChainId()}`);

  const clans = await ethers.getContractAt("Clans", CLANS_ADDRESS);
  const tx = await clans.setTerritories("TODO");
  await tx.wait();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
