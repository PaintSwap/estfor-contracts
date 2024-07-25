import {ethers} from "hardhat";
import {allItems} from "./data/items";
import {ITEM_NFT_ADDRESS} from "./contractAddresses";
import {EstforConstants} from "@paintswap/estfor-definitions";
import {ItemNFT} from "../typechain-types";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Edit items using account: ${owner.address} on chain id ${await owner.getChainId()}`);

  const itemNFT = (await ethers.getContractAt("ItemNFT", ITEM_NFT_ADDRESS)) as ItemNFT;
  /*
  const itemsToEdit = new Set([
    EstforConstants.EGG_TIER1,
    EstforConstants.EGG_TIER2,
    EstforConstants.EGG_TIER3,
    EstforConstants.EGG_TIER4,
    EstforConstants.EGG_TIER5,
    EstforConstants.SECRET_EGG_1_TIER2,
    EstforConstants.SECRET_EGG_1_TIER3,
    EstforConstants.SECRET_EGG_1_TIER4,
    EstforConstants.SECRET_EGG_1_TIER5,
    EstforConstants.SECRET_EGG_2_TIER2,
    EstforConstants.SECRET_EGG_2_TIER3,
    EstforConstants.SECRET_EGG_2_TIER4,
    EstforConstants.SECRET_EGG_2_TIER5,
    EstforConstants.SECRET_EGG_3_TIER2,
    EstforConstants.SECRET_EGG_3_TIER3,
    EstforConstants.SECRET_EGG_3_TIER4,
    EstforConstants.SECRET_EGG_3_TIER5,
    EstforConstants.SECRET_EGG_4_TIER2,
    EstforConstants.SECRET_EGG_4_TIER3,
    EstforConstants.SECRET_EGG_4_TIER4,
    EstforConstants.SECRET_EGG_4_TIER5,
  ]);

  const items = allItems.filter((item) => itemsToEdit.has(item.tokenId));
*/
  const items = allItems;

  const chunkSize = 100;
  for (let i = 0; i < allItems.length; i += chunkSize) {
    const chunk = allItems.slice(i, i + chunkSize);
    const tx = await itemNFT.editItems(chunk);
    await tx.wait();
    console.log("Add items chunk ", i);
  }
  /*
  if (items) { // .length !== itemsToEdit.size) {
    console.log("Cannot find all items");
  } else {
    await itemNFT.editItems(items);
  } */
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
