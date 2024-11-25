import {ethers} from "hardhat";
import {getChainId} from "./utils";
import {BRUSH_ADDRESS} from "./contractAddresses";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Send brush using account: ${owner.address} for chain id ${await getChainId(owner)}`);

  const brush = await ethers.getContractAt("MockBrushToken", BRUSH_ADDRESS);
  await brush.transfer("0xF83219Cd7D96ab2D80f16D36e5d9D00e287531eC", ethers.parseEther("100000"));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
