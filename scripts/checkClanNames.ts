import * as fs from "fs/promises";
import {ethers} from "hardhat";
import {CLANS_ADDRESS} from "./contractAddresses";
import {exportClanNamesFilePath} from "./utils";

const NAMES_TO_CHECK = 20;

async function checkClanNames() {
  console.log(`Checking reserved clan names`);
  const [owner] = await ethers.getSigners();

  const clans = (await ethers.getContractAt("Clans", CLANS_ADDRESS)).connect(owner);

  const fileExists = await fs
    .access(exportClanNamesFilePath)
    .then(() => true)
    .catch(() => false);
  if (!fileExists) {
    console.error("File not found");
    process.exit(1);
  }

  const reservedNames = fileExists ? (await fs.readFile(exportClanNamesFilePath, "utf-8")).split("\n") : [];

  const selectedNames = [];
  while (selectedNames.length < NAMES_TO_CHECK && reservedNames.length > 0) {
    const randomIndex = Math.floor(Math.random() * reservedNames.length);
    const name = reservedNames.splice(randomIndex, 1)[0];
    selectedNames.push(name);
  }

  for (const name of selectedNames) {
    const isReserved = await clans.isClanNameReserved(name);
    console.log(`Name: ${name}, Reserved: ${isReserved}`);
  }
}
async function main() {
  await checkClanNames();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
