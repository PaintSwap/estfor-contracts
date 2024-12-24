import {ethers} from "hardhat";
import {lzBorkedMessages} from "./borkedMessages";
import {ILayerZeroEndpointV2} from "../typechain-types";

interface LayerZeroTx {
  txHash: string;
  blockHash: string;
  blockNumber: string | number;
  blockTimestamp: number;
}

interface FailedTx extends LayerZeroTx {
  txError: string;
  revertReason: string;
}

interface Destination {
  status: string;
  tx?: LayerZeroTx;
  failedTx?: FailedTx[];
}

interface LZMessageStatus {
  destination: Destination;
  status: {
    name: string;
    message: string;
  };
}

interface LZResponse {
  data: LZMessageStatus[];
}

function checkMessageDelivery(response: LZResponse): boolean {
  // Check if we have any data
  if (!response.data || response.data.length === 0) {
    console.log("No message data found");
    return false;
  }

  const message = response.data[0];

  // Check destination status is SUCCEEDED
  if (message.destination.status !== "SUCCEEDED") {
    console.log(`Destination status is ${message.destination.status}`);
    return false;
  }

  // Check if there's a valid destination transaction
  if (!message.destination.tx || !message.destination.tx.blockNumber) {
    console.log("No valid destination transaction found");
    return false;
  }

  // Check overall message status is DELIVERED
  if (message.status.name !== "DELIVERED") {
    console.log(`Message status is ${message.status.name}`);
    return false;
  }

  return true;
}

async function main() {
  const [owner] = await ethers.getSigners();
  const lzEndpointV2 = (await ethers.getContractAt(
    "@layerzerolabs/lz-evm-protocol-v2/contracts/interfaces/ILayerZeroEndpointV2.sol:ILayerZeroEndpointV2",
    "0x6F475642a6e85809B1c36Fa62763669b1b48DD5B"
  )) as unknown as ILayerZeroEndpointV2;

  const receiver = "0x551944b340a17f277a97773355f463beefea7901";
  for (let i = 0; i < lzBorkedMessages.length; ++i) {
    const message = lzBorkedMessages[i];
    try {
      const tx = await lzEndpointV2
        .connect(owner)
        .lzReceive(
          {srcEid: message.originSrcEid, sender: message.originSender, nonce: message.originNonce},
          receiver,
          message.guid,
          message.message,
          message.extraData
        );
      await tx.wait();
    } catch (error) {
      const res = await fetch("https://scan.layerzero-api.com/v1/messages/guid/" + message.guid);
      const json = await res.json();

      const isDelivered = checkMessageDelivery(json);
      if (!isDelivered) {
        console.log("Failed to deliver message", message.guid);
      }
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
