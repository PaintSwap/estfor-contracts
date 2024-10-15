import {ethers} from "hardhat";
import {PET_NFT_ADDRESS} from "./contractAddresses";
import {allBasePets} from "./data/pets";
import {getChainId} from "./utils";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Edit base pets using account: ${owner.address} on chain id ${await getChainId(owner)}`);

  const petNFT = (await ethers.getContractAt("PetNFT", PET_NFT_ADDRESS)).connect(owner);

  const chunkSize = 20;
  for (let i = 0; i < allBasePets.length; i += chunkSize) {
    const chunk = allBasePets.slice(i, i + chunkSize);
    const tx = await petNFT.editBasePets(chunk);
    await tx.wait();
    console.log("Edit base pets chunk ", i);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
