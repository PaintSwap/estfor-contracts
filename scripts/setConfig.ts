import {ethers} from "hardhat";
import {BRIDGE_ADDRESS} from "./contractAddresses";

async function main() {
  const [owner] = await ethers.getSigners();

  console.log(`Bridge some adapter brush to sonic oft from ${owner.address} on chain: ${await owner.getChainId()}`);
  const dstEid = 30332; // Sonic

  const endpointAddress = "0x1a44076050125825900e736c501f859c50fE728c";
  const endpointContract = await ethers.getContractAt("ILayerZeroEndpointV2", endpointAddress);

  const sendConfig = [
    {
      eid: dstEid,
      configType: 1,
      config: ethers.utils.defaultAbiCoder.encode(
        ["tuple(uint32 maxMessageSize, address executor)"],
        [
          {
            maxMessageSize: 10000,
            executor: "0x2957ebc0d2931270d4a539696514b047756b3056",
          },
        ]
      ),
    },
    {
      eid: dstEid,
      configType: 2,
      config: ethers.utils.defaultAbiCoder.encode(
        [
          "tuple(uint64 confirmations, uint8 requiredDVNCount, uint8 optionalDVNCount, uint8 optionalDVNThreshold, address[] requiredDVNs, address[] optionalDVNs)",
        ],
        [
          {
            confirmations: 1n,
            requiredDVNCount: 1, // Changed to match actual DVN count
            optionalDVNCount: 0, // Changed since we have no optional DVNs
            optionalDVNThreshold: 0,
            requiredDVNs: ["0xe60a3959ca23a92bf5aaf992ef837ca7f828628a"], // "0xdd7b5e1db4aafd5c8ec3b764efb8ed265aa5445b"],
            optionalDVNs: [],
          },
        ]
      ),
    },
  ];

  let tx = await endpointContract.setConfig(
    BRIDGE_ADDRESS,
    "0xC17BaBeF02a937093363220b0FB57De04A535D5E", // Fantom send library
    sendConfig
  );
  await tx.wait();
  console.log("Set send config");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
