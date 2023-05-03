import {ethers} from "hardhat";
import {ITEM_NFT_LIBRARY_ADDRESS, ITEM_NFT_ADDRESS} from "./constants";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Set base uri with: ${owner.address}`);

  const network = await ethers.provider.getNetwork();
  console.log(`ChainId: ${network.chainId}`);

  const ItemNFT = await ethers.getContractFactory("ItemNFT", {libraries: {ItemNFTLibrary: ITEM_NFT_LIBRARY_ADDRESS}});
  const itemNFT = ItemNFT.attach(ITEM_NFT_ADDRESS);
  await itemNFT.setBaseURI("ipfs://QmbeAfkwtN6noryKLwzhA3JzsDd67FXuS4RCLfyugUowEP/");
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
