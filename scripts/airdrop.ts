import {ethers} from "hardhat";
import {ITEM_NFT_ADDRESS} from "./contractAddresses";
import {addresses, quantities} from "./data/alphaBetaTesters";
import {EstforConstants} from "@paintswap/estfor-definitions";
import {ItemNFT} from "../typechain-types";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Airdrop some items: ${owner.address} on chain: ${await owner.getChainId()}`);

  const itemNFT = (await ethers.getContractAt("ItemNFT", ITEM_NFT_ADDRESS)) as ItemNFT;

  const tokenId = EstforConstants.SECRET_EGG_1_TIER1;
  const chunkSize = 100;
  for (let i = 0; i < addresses.length; i += chunkSize) {
    const accounts: string[] = [];
    const amounts: number[] = [];
    const chunk = addresses.slice(i, i + chunkSize);
    chunk.forEach((address, j) => {
      accounts.push(address);
      amounts.push(quantities[i + j]);
    });

    const tx = await itemNFT.airdrop(accounts, tokenId, amounts);
    await tx.wait();
    console.log("Airdropping", i);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
