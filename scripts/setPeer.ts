import {ethers} from "hardhat";
import {isBeta} from "./utils";
import {BRIDGE_ADDRESS} from "./contractAddresses";

// Enable bridging by adding other chains
async function main() {
  const [owner] = await ethers.getSigners();

  const bridge = (await ethers.getContractAt("Bridge", BRIDGE_ADDRESS)).connect(owner);
  const dstEid = 30332;
  const bridgeAddressOnOtherChain = isBeta
    ? "0x4a4988daecaad326aec386e70fb0e6e6af5bda1a"
    : "0x551944b340a17f277a97773355f463beefea7901";
  const tx = await bridge.setPeer(dstEid, ethers.utils.hexZeroPad(bridgeAddressOnOtherChain, 32));
  await tx.wait();
  console.log(`Bridge peer set to ${bridgeAddressOnOtherChain} on endpoint id ${dstEid}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
