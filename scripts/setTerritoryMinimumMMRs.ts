import {ethers} from "hardhat";
import {TERRITORIES_ADDRESS} from "./contractAddresses";
import {allMinimumMMRs, allTerritories} from "./data/territories";
import {getChainId} from "./utils";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Set territory minimum MMRs on chain id ${await getChainId(owner)}`);

  const territories = await ethers.getContractAt("Territories", TERRITORIES_ADDRESS);
  const territoryIds = allTerritories.map((territory) => {
    return territory.territoryId;
  });

  await territories.setMinimumMMRs(territoryIds, allMinimumMMRs);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
