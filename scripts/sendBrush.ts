import {ethers} from "hardhat";
import {MockBrushToken} from "../typechain-types";
import {getChainId} from "./utils";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Send brush using account: ${owner.address} for chain id ${await getChainId(owner)}`);

  /*
  const brush = (await ethers.getContractAt(
    "MockBrushToken",
    "0x35E2A29215C7c019cAa307A3A81B4c5548980b2c"
  )) as MockBrushToken;
  await brush.transfer("0xF83219Cd7D96ab2D80f16D36e5d9D00e287531eC", ethers.parseEther("100")); */

  const wftm = await ethers.deployContract("WrappedNative");
  await wftm.waitForDeployment();
  console.log("Minted WFTM to", await wftm.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
