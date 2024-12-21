import * as fs from "fs/promises";
import {ethers} from "hardhat";
import {PLAYER_NFT_ADDRESS} from "./contractAddresses";
import {exportPlayerNamesFilePath, generateUniqueBitPositions} from "./utils";

async function setReservedPlayerNames() {
  console.log(`Setting reserved player names`);
  const [owner] = await ethers.getSigners();

  const playerNFT = (await ethers.getContractAt("PlayerNFT", PLAYER_NFT_ADDRESS)).connect(owner);

  const fileExists = await fs
    .access(exportPlayerNamesFilePath)
    .then(() => true)
    .catch(() => false);
  if (!fileExists) {
    console.error("File not found");
    process.exit(1);
  }
  const reservedNames = (await fs.readFile(exportPlayerNamesFilePath, "utf-8")).split("\n");

  const positions = generateUniqueBitPositions(reservedNames);
  console.log(`Generated ${positions.length} bit positions`);
  const batchSize = 15000;
  for (let i = 0; i < positions.length; i += batchSize) {
    const batch = positions.slice(i, i + batchSize);
    const gas = await playerNFT.setReservedHeroNames.estimateGas(reservedNames.length, batch);
    console.log(`Gas estimate for batch ${i / batchSize + 1}/${Math.ceil(positions.length / batchSize)}: ${gas}`);
    const tx = await playerNFT.setReservedHeroNames(reservedNames.length, batch);
    await tx.wait();
  }
}

async function main() {
  await setReservedPlayerNames();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
