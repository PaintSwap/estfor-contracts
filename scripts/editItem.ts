import {EstforConstants, EstforTypes} from "@paintswap/estfor-definitions";
import {BoostType, EquipPosition, Skill} from "@paintswap/estfor-definitions/types";
import {ethers} from "hardhat";
import {ITEM_NFT_LIBRARY_ADDRESS, ITEM_NFT_ADDRESS} from "./constants";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Edit item using account: ${owner.address}`);

  const network = await ethers.provider.getNetwork();
  console.log(`ChainId: ${network.chainId}`);

  const ItemNFT = await ethers.getContractFactory("ItemNFT", {libraries: {ItemNFTLibrary: ITEM_NFT_LIBRARY_ADDRESS}});
  const itemNFT = ItemNFT.attach(ITEM_NFT_ADDRESS);

  const item: EstforTypes.InputItem = {
    combatStats: {
      melee: 0,
      magic: 0,
      range: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangeDefence: 0,
      health: 0,
    },
    tokenId: EstforConstants.BRONZE_PICKAXE,
    equipPosition: EquipPosition.RIGHT_HAND,
    isTransferable: true,
    skill: Skill.MINING,
    minXP: 0,
    healthRestored: 0,
    boostType: BoostType.NONE,
    boostValue: 0,
    boostDuration: 0,
    metadataURI: "BRONZE_PICKAXE.json",
    name: "Bronze Pickaxe",
  };

  await itemNFT.editItem(item);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
