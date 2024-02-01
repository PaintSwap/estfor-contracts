import {ethers} from "hardhat";
import {BAZAAR_ADDRESS, ITEM_NFT_ADDRESS} from "./contractAddresses";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Set bazaar using account: ${owner.address} on chain ${await owner.getChainId()}`);

  const itemNFT = await ethers.getContractAt("ItemNFT", ITEM_NFT_ADDRESS);
  await itemNFT.setBazaar(BAZAAR_ADDRESS);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
