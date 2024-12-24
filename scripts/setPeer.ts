import {ethers} from "hardhat";
import {isBeta} from "./utils";
import {BRIDGE_ADDRESS} from "./contractAddresses";

// Enable bridging by adding other chains
async function main() {
  const bridge = await ethers.getContractAt("Bridge", BRIDGE_ADDRESS);
  const dstEid = 30112; // Fantom
  let dstBridgeAddress = isBeta
    ? "0x93e478f428a070ecf11d79cdd6a60f3dee3a92da"
    : "0x4381ba70358b46e220b3e9188acfef224e9f8a8f";

  const tx = await bridge.setPeer(dstEid, ethers.zeroPadValue(dstBridgeAddress, 32));
  await tx.wait();
  console.log("bridge.setPeer");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
