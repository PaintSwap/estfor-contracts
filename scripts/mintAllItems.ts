import {ethers} from "hardhat";
import {ITEM_NFT_ADDRESS} from "./constants";

import {allItems} from "./data/items";

async function main() {
  const ItemNFT = await ethers.getContractFactory("ItemNFT");
  const itemNFT = await ItemNFT.attach(ITEM_NFT_ADDRESS);

  const chunkSize = 100;
  for (let i = 0; i < allItems.length; i += chunkSize) {
    const tokenIds: number[] = [];
    const amounts: number[] = [];
    const chunk = allItems.slice(i, i + chunkSize);
    chunk.forEach((item) => {
      tokenIds.push(item.tokenId);
      amounts.push(200);
    });
    await itemNFT.testMints("0x946d17072eac624c3e3fb06108959b7fefbcb8ad", tokenIds, amounts);
  }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
