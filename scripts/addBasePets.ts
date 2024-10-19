import {ethers} from "hardhat";
import {PET_NFT_ADDRESS} from "./contractAddresses";
import {allBasePets} from "./data/pets";
import {EstforConstants} from "@paintswap/estfor-definitions";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Add base pets using account: ${owner.address} on chain id ${await owner.getChainId()}`);

  const petNFT = (await ethers.getContractAt("PetNFT", PET_NFT_ADDRESS)).connect(owner);
  const basePetIds = new Set([
    EstforConstants.PET_KRAGSTYR_MELEE_TIER1,
    EstforConstants.PET_KRAGSTYR_MELEE_TIER2,
    EstforConstants.PET_KRAGSTYR_MELEE_TIER3,
    EstforConstants.PET_KRAGSTYR_MELEE_TIER4,
    EstforConstants.PET_KRAGSTYR_MELEE_TIER5,
    EstforConstants.PET_KRAGSTYR_MAGIC_TIER1,
    EstforConstants.PET_KRAGSTYR_MAGIC_TIER2,
    EstforConstants.PET_KRAGSTYR_MAGIC_TIER3,
    EstforConstants.PET_KRAGSTYR_MAGIC_TIER4,
    EstforConstants.PET_KRAGSTYR_MAGIC_TIER5,
    EstforConstants.PET_KRAGSTYR_RANGED_TIER1,
    EstforConstants.PET_KRAGSTYR_RANGED_TIER2,
    EstforConstants.PET_KRAGSTYR_RANGED_TIER3,
    EstforConstants.PET_KRAGSTYR_RANGED_TIER4,
    EstforConstants.PET_KRAGSTYR_RANGED_TIER5,
    EstforConstants.PET_KRAGSTYR_DEFENCE_TIER1,
    EstforConstants.PET_KRAGSTYR_DEFENCE_TIER2,
    EstforConstants.PET_KRAGSTYR_DEFENCE_TIER3,
    EstforConstants.PET_KRAGSTYR_DEFENCE_TIER4,
    EstforConstants.PET_KRAGSTYR_DEFENCE_TIER5,
    EstforConstants.PET_KRAGSTYR_HEALTH_TIER1,
    EstforConstants.PET_KRAGSTYR_HEALTH_TIER2,
    EstforConstants.PET_KRAGSTYR_HEALTH_TIER3,
    EstforConstants.PET_KRAGSTYR_HEALTH_TIER4,
    EstforConstants.PET_KRAGSTYR_HEALTH_TIER5,
    EstforConstants.PET_KRAGSTYR_MELEE_AND_DEFENCE_TIER1,
    EstforConstants.PET_KRAGSTYR_MELEE_AND_DEFENCE_TIER2,
    EstforConstants.PET_KRAGSTYR_MELEE_AND_DEFENCE_TIER3,
    EstforConstants.PET_KRAGSTYR_MELEE_AND_DEFENCE_TIER4,
    EstforConstants.PET_KRAGSTYR_MELEE_AND_DEFENCE_TIER5,
    EstforConstants.PET_KRAGSTYR_MAGIC_AND_DEFENCE_TIER1,
    EstforConstants.PET_KRAGSTYR_MAGIC_AND_DEFENCE_TIER2,
    EstforConstants.PET_KRAGSTYR_MAGIC_AND_DEFENCE_TIER3,
    EstforConstants.PET_KRAGSTYR_MAGIC_AND_DEFENCE_TIER4,
    EstforConstants.PET_KRAGSTYR_MAGIC_AND_DEFENCE_TIER5,
    EstforConstants.PET_KRAGSTYR_RANGED_AND_DEFENCE_TIER1,
    EstforConstants.PET_KRAGSTYR_RANGED_AND_DEFENCE_TIER2,
    EstforConstants.PET_KRAGSTYR_RANGED_AND_DEFENCE_TIER3,
    EstforConstants.PET_KRAGSTYR_RANGED_AND_DEFENCE_TIER4,
    EstforConstants.PET_KRAGSTYR_RANGED_AND_DEFENCE_TIER5,
  ]);

  const basePets = allBasePets.filter((basePet) => basePetIds.has(basePet.baseId));
  const chunkSize = 20;
  for (let i = 0; i < basePets.length; i += chunkSize) {
    const chunk = basePets.slice(i, i + chunkSize);
    const tx = await petNFT.addBasePets(chunk);
    await tx.wait();
    console.log("Add base pets chunk ", i);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
