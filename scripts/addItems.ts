import {EstforConstants} from "@paintswap/estfor-definitions";
import {ethers} from "hardhat";
import {ITEM_NFT_LIBRARY_ADDRESS, ITEM_NFT_ADDRESS} from "./contractAddresses";
import {allItems} from "./data/items";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Add item using account: ${owner.address}`);

  const network = await ethers.provider.getNetwork();
  console.log(`ChainId: ${network.chainId}`);

  const ItemNFT = await ethers.getContractFactory("ItemNFT", {libraries: {ItemNFTLibrary: ITEM_NFT_LIBRARY_ADDRESS}});
  const itemNFT = ItemNFT.attach(ITEM_NFT_ADDRESS);
  const items = allItems.filter(
    (item) =>
      item.tokenId === EstforConstants.TINY_ELIXIUM ||
      item.tokenId === EstforConstants.SMALL_ELIXIUM ||
      item.tokenId === EstforConstants.MEDIUM_ELIXIUM ||
      item.tokenId === EstforConstants.LARGE_ELIXIUM ||
      item.tokenId === EstforConstants.EXTRA_LARGE_ELIXIUM ||
      item.tokenId === EstforConstants.FLUX
  );

  if (items.length !== 6) {
    console.log("Cannot find all items");
  } else {
    await itemNFT.addItems(items);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
