import {ethers} from "hardhat";
import {CLANS_ADDRESS} from "./contractAddresses";

// Temporary script for updating clan rank leaders to owners as a new rank is added in-between.
async function main() {
  const clans = await ethers.getContractAt("Clans", CLANS_ADDRESS);

  const clanId = (await clans.nextClanId()).add(1);
  for (let i = ethers.BigNumber.from(1); i.lt(clanId); i = i.add(100)) {
    const tx = await clans.tempUpdateClanRankLeaders(i, i.add(99));
    await tx.wait();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
