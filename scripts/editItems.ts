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
      item.tokenId === EstforConstants.MAGE_HOOD ||
      item.tokenId === EstforConstants.SEERS_HOOD ||
      item.tokenId === EstforConstants.SHAMAN_HOOD ||
      item.tokenId === EstforConstants.MASTER_HAT ||
      item.tokenId === EstforConstants.SORCERER_BODY ||
      item.tokenId === EstforConstants.SEERS_BODY ||
      item.tokenId === EstforConstants.SHAMAN_BODY ||
      item.tokenId === EstforConstants.MASTER_BODY ||
      item.tokenId === EstforConstants.MAGE_TROUSERS ||
      item.tokenId === EstforConstants.SORCERER_TROUSERS ||
      item.tokenId === EstforConstants.SEERS_TROUSERS ||
      item.tokenId === EstforConstants.SHAMAN_TROUSERS ||
      item.tokenId === EstforConstants.MASTER_TROUSERS ||
      item.tokenId === EstforConstants.MAGE_BRACERS ||
      item.tokenId === EstforConstants.SORCERER_GAUNTLETS ||
      item.tokenId === EstforConstants.SEERS_BRACERS ||
      item.tokenId === EstforConstants.SHAMAN_GAUNTLETS ||
      item.tokenId === EstforConstants.MASTER_BRACERS ||
      item.tokenId === EstforConstants.SEERS_BOOTS
  );

  //  console.log(items);

  await itemNFT.editItems(items);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
