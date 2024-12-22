import * as fs from "fs/promises";
import {ethers} from "hardhat";
import {PET_NFT_ADDRESS} from "./contractAddresses";
import {exportPetNamesFilePath, generateUniqueBitPositions} from "./utils";

async function setReservedPetNames() {
  console.log(`Setting reserved pet names`);
  const [owner] = await ethers.getSigners();

  const petNFT = (await ethers.getContractAt("PetNFT", PET_NFT_ADDRESS)).connect(owner);

  const fileExists = await fs
    .access(exportPetNamesFilePath)
    .then(() => true)
    .catch(() => false);
  if (!fileExists) {
    console.error("File not found");
    process.exit(1);
  }

  const reservedNames = fileExists ? (await fs.readFile(exportPetNamesFilePath, "utf-8")).split("\n") : [];

  const positions = await generateUniqueBitPositions(reservedNames, 4, 20000n);
  console.log(`Generated ${positions.length} bit positions`);
  const batchSize = 7500;
  for (let i = 0; i < positions.length; i += batchSize) {
    const batch = positions.slice(i, i + batchSize);
    const gas = await petNFT.setReservedNameBits.estimateGas(batch);
    console.log(`Gas estimate for batch ${i / batchSize + 1}/${Math.ceil(positions.length / batchSize)}: ${gas}`);
    const tx = await petNFT.setReservedNameBits(batch);
    await tx.wait();
  }
}

async function main() {
  await setReservedPetNames();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
