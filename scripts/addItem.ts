import {EstforTypes} from "@paintswap/estfor-definitions";
import {BRONZE_SHIELD} from "@paintswap/estfor-definitions/constants";
import {defaultInputItem, EquipPosition} from "@paintswap/estfor-definitions/types";
import {ethers} from "hardhat";
import {ITEM_NFT_LIBRARY_ADDRESS, ITEM_NFT_ADDRESS} from "./constants";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Add item using account: ${owner.address}`);

  const network = await ethers.provider.getNetwork();
  console.log(`ChainId: ${network.chainId}`);

  // Create NFT contract which contains all items
  const ItemNFT = await ethers.getContractFactory("ItemNFT", {libraries: {ItemNFTLibrary: ITEM_NFT_LIBRARY_ADDRESS}});
  const itemNFT = ItemNFT.attach(ITEM_NFT_ADDRESS);

  const item: EstforTypes.InputItem = {
    ...defaultInputItem,
    tokenId: BRONZE_SHIELD,
    combatStats: {
      melee: 0,
      magic: 0,
      range: 0,
      meleeDefence: 1,
      magicDefence: 0,
      rangeDefence: 1,
      health: 0,
    },
    equipPosition: EquipPosition.LEFT_HAND,
    metadataURI: "someIPFSURI.json",
  };

  await itemNFT.addItem(item);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
