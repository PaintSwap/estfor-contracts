import {ethers} from "hardhat";
import {allOrderBookTokenIdInfos} from "./data/orderbookTokenIdInfos";
import {EstforConstants} from "@paintswap/estfor-definitions";
import {BAZAAR_ADDRESS} from "./contractAddresses";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(
    `Setting token id infos with the account: ${owner.address} on chain id: ${
      (await ethers.provider.getNetwork()).chainId
    }`
  );

  const orderBook = await ethers.getContractAt("OrderBook", BAZAAR_ADDRESS);
  const chunkSize = 100;

  const tx = await orderBook.setTokenIdInfos(
    [EstforConstants.ACTIVITY_TICKET, EstforConstants.SONIC_GEM_TICKET],
    [
      {
        tick: ethers.parseEther("0.00001").toString(),
        minQuantity: "1"
      },
      {
        tick: ethers.parseEther("0.00001").toString(),
        minQuantity: "1"
      }
    ]
  );

  /*
  const orderBookTokenIdInfos = allOrderBookTokenIdInfos.filter((tokenIdInfo) => newTokenIds.has(tokenIdInfo.tokenId));

  for (let i = 0; i < orderBookTokenIdInfos.length; i += chunkSize) {
    const tokenIds: number[] = [];
    const tokenIdInfos: {tick: string; minQuantity: string}[] = [];
    const chunk = orderBookTokenIdInfos.slice(i, i + chunkSize);
    chunk.forEach((tokenIdInfo) => {
      tokenIds.push(tokenIdInfo.tokenId);
      tokenIdInfos.push({tick: tokenIdInfo.tick, minQuantity: tokenIdInfo.minQuantity});
    });
    const tx = await orderBook.setTokenIdInfos(tokenIds, tokenIdInfos);
    await tx.wait();
    console.log("orderBook.setTokenIdInfos");
  }
  */
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
