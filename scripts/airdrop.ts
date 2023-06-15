import {ethers} from "hardhat";
import {ITEM_NFT_LIBRARY_ADDRESS, ITEM_NFT_ADDRESS} from "./contractAddresses";
import {addresses, quantities} from "./data/alphaBetaTesters";
import {EstforConstants} from "@paintswap/estfor-definitions";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Deploying contracts with the account: ${owner.address}`);

  const network = await ethers.provider.getNetwork();
  console.log(`ChainId: ${network.chainId}`);

  const ItemNFT = await ethers.getContractFactory("ItemNFT", {libraries: {ItemNFTLibrary: ITEM_NFT_LIBRARY_ADDRESS}});
  const itemNFT = await ItemNFT.attach(ITEM_NFT_ADDRESS);

  const tokenId = EstforConstants.SECRET_EGG_1;
  const chunkSize = 100;
  for (let i = 0; i < addresses.length; i += chunkSize) {
    const accounts: string[] = [];
    const amounts: number[] = [];
    const chunk = addresses.slice(i, i + chunkSize);
    chunk.forEach((address, j) => {
      accounts.push(address);
      amounts.push(quantities[j]);
    });

    const tx = await itemNFT.airdrop(accounts, tokenId, amounts);
    await tx.wait();
    console.log("Airdropping", i);
  }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
