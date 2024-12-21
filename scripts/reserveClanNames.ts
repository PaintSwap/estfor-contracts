import * as fs from "fs/promises";
import {ethers} from "hardhat";
import {CLANS_ADDRESS} from "./contractAddresses";
import {generateUniqueBitPositions} from "./utils";
import {exportClanNamesFilePath} from "./exportAllClanNames";

async function setReservedClanNames() {
  console.log(`Setting reserved clan names`);
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

  const positions = generateUniqueBitPositions(reservedNames);
  console.log(`Generated ${positions.length} bit positions`);
  const batchSize = 15000;
  for (let i = 0; i < positions.length; i += batchSize) {
    const batch = positions.slice(i, i + batchSize);
    const gas = await clans.setReservedClanNames.estimateGas(reservedNames.length, batch);
    console.log(`Gas estimate for batch ${i / batchSize + 1}/${Math.ceil(positions.length / batchSize)}: ${gas}`);
    await clans.setReservedClanNames(reservedNames.length, batch);
  }
}
async function main() {
  await setReservedClanNames();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
