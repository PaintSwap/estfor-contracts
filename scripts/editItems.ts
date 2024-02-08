import {ethers} from "hardhat";
import {allItems} from "./data/items";
import {ITEM_NFT_ADDRESS} from "./contractAddresses";
import {EstforConstants} from "@paintswap/estfor-definitions";
import {ItemNFT} from "../typechain-types";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Edit items using account: ${owner.address} on chain id ${await owner.getChainId()}`);

  const itemNFT = (await ethers.getContractAt("ItemNFT", ITEM_NFT_ADDRESS)) as ItemNFT;

  const items = allItems.filter((item) => item.tokenId === EstforConstants.SHARPENED_CLAW);

  if (items.length !== 1) {
    console.log("Cannot find all items");
  } else {
    await itemNFT.editItems(items);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
