import {ethers} from "hardhat";
import {CLANS_ADDRESS} from "./contractAddresses";
import {allClanTiers, allClanTiersBeta} from "./data/clans";
import {getChainId, isBeta} from "./utils";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Edit clan tiers using account: ${owner.address} on chain id ${await getChainId(owner)}`);

  const clanTiers = isBeta ? allClanTiersBeta : allClanTiers;
  const clans = await ethers.getContractAt("Clans", CLANS_ADDRESS);
  const tx = await clans.editTiers(clanTiers);
  await tx.wait();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
