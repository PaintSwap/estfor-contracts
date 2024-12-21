import {ethers} from "hardhat";
import {isBeta} from "./utils";
import {BRIDGE_ADDRESS} from "./contractAddresses";

// Enable bridging by adding other chains
async function main() {
  const [owner] = await ethers.getSigners();

  const bridge = (await ethers.getContractAt("Bridge", BRIDGE_ADDRESS)).connect(owner);
  const dstEid = 30332;
  const bridgeAddressOnOtherChain = isBeta ? "" : "";
  const tx = await bridge.setPeer(dstEid, ethers.utils.hexZeroPad(bridgeAddressOnOtherChain, 32));
  await tx.wait();
  console.log(`Bridge peer set to ${bridgeAddressOnOtherChain} on endpoint id ${dstEid}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
