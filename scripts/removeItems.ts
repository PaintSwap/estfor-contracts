import {EstforConstants} from "@paintswap/estfor-definitions";
import {ethers} from "hardhat";
import {ITEM_NFT_LIBRARY_ADDRESS, ITEM_NFT_ADDRESS} from "./contractAddresses";
import {allItems} from "./data/items";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Remove items item using account: ${owner.address}`);

  const network = await ethers.provider.getNetwork();
  console.log(`ChainId: ${network.chainId}`);

  const ItemNFT = await ethers.getContractFactory("ItemNFT", {libraries: {ItemNFTLibrary: ITEM_NFT_LIBRARY_ADDRESS}});
  const itemNFT = ItemNFT.attach(ITEM_NFT_ADDRESS);
  const items = allItems.filter((item) => item.tokenId === 12810);

  console.log("Use with caution!!, remove process exit");
  process.exit(99);

  if (items.length !== 1) {
    console.log("Cannot find all items");
  } else {
    await itemNFT.removeItems(items.map((item) => item.tokenId));
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
