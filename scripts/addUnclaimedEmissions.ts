import {ethers} from "hardhat";
import {BRUSH_ADDRESS, TERRITORIES_ADDRESS} from "./contractAddresses";
import {getChainId} from "./utils";
import {MockBrushToken, Territories} from "../typechain-types";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Sent some brush to the territories: ${owner.address} on chain id ${await getChainId(owner)}`);
  const territories = (await ethers.getContractAt("Territories", TERRITORIES_ADDRESS)) as Territories;

  const brush = (await ethers.getContractAt("MockBrushToken", BRUSH_ADDRESS)) as MockBrushToken;
  let tx = await brush.approve(TERRITORIES_ADDRESS, ethers.parseEther("100000"));
  await tx.wait();

  tx = await territories.addUnclaimedEmissions(ethers.parseEther("100"));
  await tx.wait();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
