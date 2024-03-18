import {ethers} from "hardhat";
import {ITEM_NFT_ADDRESS} from "./contractAddresses";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Set base uri with: ${owner.address} on chain id ${await owner.getChainId()}`);

  const itemNFT = await ethers.getContractAt("ItemNFT", ITEM_NFT_ADDRESS);
  await itemNFT.setBaseURI("ipfs://QmUcXN5z4A4qvRMquMegou16cq1HMiaWCQpAH8RgxJA4Sf/");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
