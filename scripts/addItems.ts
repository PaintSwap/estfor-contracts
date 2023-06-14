import {EstforConstants, EstforTypes} from "@paintswap/estfor-definitions";
import {BRONZE_SHIELD} from "@paintswap/estfor-definitions/constants";
import {defaultInputItem, EquipPosition} from "@paintswap/estfor-definitions/types";
import {ethers} from "hardhat";
import {ITEM_NFT_LIBRARY_ADDRESS, ITEM_NFT_ADDRESS} from "./contractAddresses";
import {allItems} from "./data/items";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Add item using account: ${owner.address}`);

  const network = await ethers.provider.getNetwork();
  console.log(`ChainId: ${network.chainId}`);

  // Create NFT contract which contains all items
  const ItemNFT = await ethers.getContractFactory("ItemNFT", {libraries: {ItemNFTLibrary: ITEM_NFT_LIBRARY_ADDRESS}});
  const itemNFT = ItemNFT.attach(ITEM_NFT_ADDRESS);
  const item = allItems.find((item) => item.tokenId === EstforConstants.SECRET_EGG_1) as EstforTypes.InputItem;
  const item1 = allItems.find((item) => item.tokenId === EstforConstants.SECRET_EGG_2) as EstforTypes.InputItem;
  await itemNFT.addItems([item, item1]);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
