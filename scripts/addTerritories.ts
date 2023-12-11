import {ethers} from "hardhat";
import {TERRITORIES_ADDRESS} from "./contractAddresses";
import {allTerritories} from "./data/territories";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Add territories using account: ${owner.address} on chain id ${await owner.getChainId()}`);

  const territories = await ethers.getContractAt("Territories", TERRITORIES_ADDRESS);
  const _territories = allTerritories.filter((territory) => {
    return territory.territoryId == 26;
  });

  if (_territories.length !== 1) {
    console.log("Cannot find territories");
  } else {
    await territories.addTerritories(_territories);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
