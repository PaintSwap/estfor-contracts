import {ethers} from "hardhat";
import {PET_NFT_ADDRESS} from "./contractAddresses";
import {allBasePets} from "./data/pets";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Add base pets using account: ${owner.address} on chain id ${await owner.getChainId()}`);

  const petNFT = await ethers.getContractAt("PetNFT", PET_NFT_ADDRESS);
  const tx = await petNFT.addBasePets(allBasePets);
  await tx.wait();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
