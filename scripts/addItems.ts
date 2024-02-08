import {EstforConstants} from "@paintswap/estfor-definitions";
import {ethers, upgrades} from "hardhat";
import {ITEM_NFT_ADDRESS} from "./contractAddresses";
import {allItems} from "./data/items";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Add items using account: ${owner.address} on chain id ${await owner.getChainId()}`);

  const ItemNFTLibrary = await ethers.getContractFactory("ItemNFTLibrary");
  const itemNFTLibrary = await ItemNFTLibrary.deploy();
  console.log("ItemNFTLibrary deployed to:", itemNFTLibrary.address);

  let ItemNFT = await ethers.getContractFactory("ItemNFT", {libraries: {ItemNFTLibrary: itemNFTLibrary.address}});
  const itemNFT = await upgrades.upgradeProxy(ITEM_NFT_ADDRESS, ItemNFT, {
    kind: "uups",
    unsafeAllow: ["external-library-linking"],
  });

  const items = allItems.filter((item) => item.tokenId === EstforConstants.SHARPENED_CLAW);
  if (items.length !== 1) {
    console.log("Cannot find all items");
  } else {
    await itemNFT.addItems(items);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
