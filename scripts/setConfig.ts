import {ethers, getChainId} from "hardhat";
import {BRIDGE_ADDRESS} from "./contractAddresses";

async function main() {
  const [owner] = await ethers.getSigners();

  console.log(`Set receive config from fantom to sonic using ${owner.address} on chain: ${await getChainId()}`);
  const srcEid = 30112; // Fantom
  const endpointAddress = "0x6F475642a6e85809B1c36Fa62763669b1b48DD5B";
  const endpointContract = await ethers.getContractAt("ILayerZeroEndpointV2", endpointAddress);

  const receiveConfig = [
    {
      eid: srcEid,
      configType: 2,
      config: ethers.AbiCoder.defaultAbiCoder().encode(
        [
          "tuple(uint64 confirmations, uint8 requiredDVNCount, uint8 optionalDVNCount, uint8 optionalDVNThreshold, address[] requiredDVNs, address[] optionalDVNs)"
        ],
        [
          {
            confirmations: 1n,
            requiredDVNCount: 1, // Changed to match actual DVN count
            optionalDVNCount: 0, // Changed since we have no optional DVNs
            optionalDVNThreshold: 0,
            requiredDVNs: ["0x282b3386571f7f794450d5789911a9804fa346b4"],
            optionalDVNs: []
          }
        ]
      )
    }
  ];

  const tx = await endpointContract.setConfig(
    BRIDGE_ADDRESS,
    "0xe1844c5D63a9543023008D332Bd3d2e6f1FE1043", // Sonic receive library
    receiveConfig
  );
  await tx.wait();
  console.log("Set receive config");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
