import {ethers} from "hardhat";
import {TERRITORIES_ADDRESS} from "./contractAddresses";
import {getChainId} from "./utils";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Remove territories using account: ${owner.address} on chain id ${await getChainId(owner)}`);

  const territories = await ethers.getContractAt("Territories", TERRITORIES_ADDRESS);
  const territoryIds = [25];

  if (territoryIds.length !== 1) {
    console.log("Cannot find territories");
  } else {
    await territories.removeTerritories(territoryIds);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
