import {ethers} from "hardhat";
import {PET_NFT_ADDRESS} from "./contractAddresses";
import {allBasePets} from "./data/pets";
import {EstforConstants} from "@paintswap/estfor-definitions";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Add base pets using account: ${owner.address} on chain id ${await owner.getChainId()}`);

  const petNFT = (await ethers.getContractAt("PetNFT", PET_NFT_ADDRESS)).connect(owner);

  const chunkSize = 20;
  for (let i = 0; i < allBasePets.length; i += chunkSize) {
    const chunk = allBasePets.slice(i, i + chunkSize);
    const tx = await petNFT.addBasePets(chunk);
    await tx.wait();
    console.log("Add base pets chunk ", i);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
