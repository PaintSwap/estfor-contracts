import {EstforConstants} from "@paintswap/estfor-definitions";
import {ethers} from "hardhat";
import {ITEM_NFT_ADDRESS} from "./contractAddresses";
import {allItems} from "./data/items";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Remove items using account: ${owner.address} on chain id ${await owner.getChainId()}`);

  const itemNFT = await ethers.getContractAt("ItemNFT", ITEM_NFT_ADDRESS);
  const items = allItems.filter((item) => item.tokenId === EstforConstants.HARPOON);

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
