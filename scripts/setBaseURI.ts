import {ethers} from "hardhat";
import {ITEM_NFT_ADDRESS} from "./contractAddresses";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Set base uri with: ${owner.address} on chain id ${await owner.getChainId()}`);

  const itemNFT = await ethers.getContractAt("ItemNFT", ITEM_NFT_ADDRESS);
  await itemNFT.setBaseURI("ipfs://QmUxF1oJps1zZ9CvRa9n5nwbxSBLK3ChUmdZLkhEXg9CaX/");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
