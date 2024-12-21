import * as fs from "fs/promises";
import {ethers} from "hardhat";
import {PET_NFT_ADDRESS} from "./contractAddresses";
import {exportPetNamesFilePath} from "./utils";

const NAMES_TO_CHECK = 20;

async function checkPlayerNames() {
  console.log(`Checking reserved pet names`);
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

  const selectedNames = [];
  while (selectedNames.length < NAMES_TO_CHECK && reservedNames.length > 0) {
    const randomIndex = Math.floor(Math.random() * reservedNames.length);
    const name = reservedNames.splice(randomIndex, 1)[0];
    selectedNames.push(name);
  }

  for (const name of selectedNames) {
    const isReserved = await petNFT.isPetNameReserved(name);
    console.log(`Name: ${name}, Reserved: ${isReserved}`);
  }
}
async function main() {
  await checkPlayerNames();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
