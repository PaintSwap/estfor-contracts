import {ethers} from "hardhat";
import {ITEM_NFT_ADDRESS} from "./contractAddresses";

import {allItems} from "./data/items";
import {EstforConstants} from "@paintswap/estfor-definitions";
import {ItemNFT} from "../typechain-types";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Mint items using account: ${owner.address} on chain id ${await owner.getChainId()}`);

  const itemNFT = (await ethers.getContractAt("ItemNFT", ITEM_NFT_ADDRESS)) as ItemNFT;

  const chunkSize = 100;
  for (let i = 0; i < allItems.length; i += chunkSize) {
    const tokenIds: number[] = [];
    const amounts: number[] = [];
    const chunk = allItems.slice(i, i + chunkSize);
    chunk.forEach((item) => {
      // Ignore any boosts which can have special features like clan/global boosts
      if (item.boostType != EstforConstants.NONE) {
        return;
      }
      tokenIds.push(item.tokenId);
      amounts.push(100);
    });
    const tx = await itemNFT.testMints("0xa801864d0D24686B15682261aa05D4e1e6e5BD94", tokenIds, amounts);
    await tx.wait();
    console.log(`Minted items: ${i}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
