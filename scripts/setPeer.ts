import {ethers} from "hardhat";
import {isBeta} from "./utils";
import {BRIDGE_ADDRESS} from "./contractAddresses";

// Enable bridging by adding other chains
async function main() {
  const [owner] = await ethers.getSigners();

  const bridge = await ethers.getContractAt("Bridge", BRIDGE_ADDRESS);
  const dstEid = 30112; // Fantom
  let dstBridgeAddress; // Used for Fantom -> Sonic migration
  if (!isBeta) {
    // prod version
    dstBridgeAddress = "TODO";
  } else {
    dstBridgeAddress = "0x14b69305897a645ed5a4b542e4c45d629d0fe381"; // Fantom
  }

  const tx = await bridge.setPeer(dstEid, ethers.zeroPadValue(dstBridgeAddress, 32));
  await tx.wait();
  console.log("bridge.setPeer");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
