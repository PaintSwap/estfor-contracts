import {ethers} from "hardhat";
import {allItems} from "./data/items";
import {ITEM_NFT_LIBRARY_ADDRESS, ITEM_NFT_ADDRESS} from "./contractAddresses";
import {EstforConstants} from "@paintswap/estfor-definitions";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Edit items using account: ${owner.address}`);

  const network = await ethers.provider.getNetwork();
  console.log(`ChainId: ${network.chainId}`);

  const ItemNFT = await ethers.getContractFactory("ItemNFT", {libraries: {ItemNFTLibrary: ITEM_NFT_LIBRARY_ADDRESS}});
  const itemNFT = ItemNFT.attach(ITEM_NFT_ADDRESS);

  const items = await allItems.filter(
    (item) =>
      item.tokenId === EstforConstants.COOKED_BLEKK ||
      item.tokenId === EstforConstants.COOKED_SKRIMP ||
      item.tokenId === EstforConstants.COOKED_FEOLA ||
      item.tokenId === EstforConstants.COOKED_ANCHO ||
      item.tokenId === EstforConstants.COOKED_TROUT ||
      item.tokenId === EstforConstants.COOKED_ROJJA ||
      item.tokenId === EstforConstants.COOKED_BOWFISH ||
      item.tokenId === EstforConstants.COOKED_MYSTY_BLUE ||
      item.tokenId === EstforConstants.COOKED_FLITFISH ||
      item.tokenId === EstforConstants.COOKED_RAZORFISH ||
      item.tokenId === EstforConstants.COOKED_QUAFFER ||
      item.tokenId === EstforConstants.COOKED_ROXA ||
      item.tokenId === EstforConstants.COOKED_STONECLAW ||
      item.tokenId === EstforConstants.COOKED_CRUSKAN ||
      item.tokenId === EstforConstants.COOKED_CHODFISH ||
      item.tokenId === EstforConstants.COOKED_DOUBTFISH ||
      item.tokenId === EstforConstants.COOKED_ROSEFIN
  );

  if (items.length !== 17) {
    console.log("Cannot find all items");
  } else {
    await itemNFT.editItems(items);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
