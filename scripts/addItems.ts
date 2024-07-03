import {EstforConstants} from "@paintswap/estfor-definitions";
import {ethers} from "hardhat";
import {ITEM_NFT_ADDRESS} from "./contractAddresses";
import {allItems} from "./data/items";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Add items using account: ${owner.address} on chain id ${await owner.getChainId()}`);

  const itemNFT = await ethers.getContractAt("ItemNFT", ITEM_NFT_ADDRESS);

  const itemIds = new Set([
    EstforConstants.PANGSTEN_RING,
    EstforConstants.CANVITE_RING,
    EstforConstants.ETCHED_RING,
    EstforConstants.PRIMDIAT_RING,
    EstforConstants.OCULITE_RING,
    EstforConstants.NOVIAN_RING,
    EstforConstants.INFUSED_ORICHALCUM_HELMET_FRAGMENT,
    EstforConstants.INFUSED_ORICHALCUM_ARMOR_FRAGMENT,
    EstforConstants.INFUSED_ORICHALCUM_TASSETS_FRAGMENT,
    EstforConstants.INFUSED_ORICHALCUM_GAUNTLETS_FRAGMENT,
    EstforConstants.INFUSED_ORICHALCUM_BOOTS_FRAGMENT,
    EstforConstants.INFUSED_ORICHALCUM_SHIELD_FRAGMENT,
    EstforConstants.INFUSED_DRAGONSTONE_AMULET_FRAGMENT,
    EstforConstants.INFUSED_MASTER_HAT_FRAGMENT,
    EstforConstants.INFUSED_MASTER_BODY_FRAGMENT,
    EstforConstants.INFUSED_MASTER_BRACERS_FRAGMENT,
    EstforConstants.INFUSED_MASTER_TROUSERS_FRAGMENT,
    EstforConstants.INFUSED_MASTER_BOOTS_FRAGMENT,
    EstforConstants.INFUSED_ORICHALCUM_SWORD_FRAGMENT,
    EstforConstants.DRAGONSTONE_STAFF_FRAGMENT,
    EstforConstants.GODLY_BOW_FRAGMENT,
    EstforConstants.INFUSED_SCORCHING_COWL_FRAGMENT,
    EstforConstants.INFUSED_SCORCHING_BODY_FRAGMENT,
    EstforConstants.INFUSED_SCORCHING_BRACERS_FRAGMENT,
    EstforConstants.INFUSED_SCORCHING_CHAPS_FRAGMENT,
    EstforConstants.INFUSED_SCORCHING_BOOTS_FRAGMENT,
    EstforConstants.FISHING_CHEST_1,
    EstforConstants.FISHING_CHEST_2,
    EstforConstants.FISHING_CHEST_3,
    EstforConstants.FISHING_CHEST_4,
    EstforConstants.FISHING_CHEST_5,
    EstforConstants.WOODCUTTING_CHEST_1,
    EstforConstants.WOODCUTTING_CHEST_2,
    EstforConstants.WOODCUTTING_CHEST_3,
    EstforConstants.WOODCUTTING_CHEST_4,
    EstforConstants.WOODCUTTING_CHEST_5,
    EstforConstants.MINING_CHEST_1,
    EstforConstants.MINING_CHEST_2,
    EstforConstants.MINING_CHEST_3,
    EstforConstants.MINING_CHEST_4,
    EstforConstants.MINING_CHEST_5,
    EstforConstants.DRAGON_CHEST,
    EstforConstants.BONE_CHEST,
    EstforConstants.BRIMSTONE,
    EstforConstants.COIN,
  ]);

  const items = allItems.filter((item) => itemIds.has(item.tokenId));
  if (items.length !== itemIds.size) {
    console.log("Cannot find all items");
  } else {
    await itemNFT.addItems(items);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
