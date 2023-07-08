import {EstforConstants, EstforTypes} from "@paintswap/estfor-definitions";
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
  const items = allItems.filter(
    (item) =>
      item.tokenId === EstforConstants.PAPER ||
      item.tokenId === EstforConstants.ASH ||
      item.tokenId === EstforConstants.BRONZE_ARROW ||
      item.tokenId === EstforConstants.IRON_ARROW ||
      item.tokenId === EstforConstants.MITHRIL_ARROW ||
      item.tokenId === EstforConstants.ADAMANITE_ARROW ||
      item.tokenId === EstforConstants.RUNITE_ARROW ||
      item.tokenId === EstforConstants.TITANIUM_ARROW ||
      item.tokenId === EstforConstants.ORICHALCUM_ARROW ||
      item.tokenId === EstforConstants.BASIC_BOW ||
      item.tokenId === EstforConstants.BONE_BOW ||
      item.tokenId === EstforConstants.EXPERT_BOW ||
      item.tokenId === EstforConstants.SPECTRAL_BOW ||
      item.tokenId === EstforConstants.ICY_BOW ||
      item.tokenId === EstforConstants.GLITTERING_BOW ||
      item.tokenId === EstforConstants.GODLY_BOW ||
      item.tokenId === EstforConstants.AZURITE_COWL ||
      item.tokenId === EstforConstants.AZURITE_BODY ||
      item.tokenId === EstforConstants.AZURITE_CHAPS ||
      item.tokenId === EstforConstants.AZURITE_BRACERS ||
      item.tokenId === EstforConstants.AZURITE_BOOTS ||
      item.tokenId === EstforConstants.HAUBERK_COWL ||
      item.tokenId === EstforConstants.HAUBERK_BODY ||
      item.tokenId === EstforConstants.HAUBERK_CHAPS ||
      item.tokenId === EstforConstants.HAUBERK_BRACERS ||
      item.tokenId === EstforConstants.HAUBERK_BOOTS ||
      item.tokenId === EstforConstants.GARAGOS_COWL ||
      item.tokenId === EstforConstants.GARAGOS_BODY ||
      item.tokenId === EstforConstants.GARAGOS_CHAPS ||
      item.tokenId === EstforConstants.GARAGOS_BRACERS ||
      item.tokenId === EstforConstants.GARAGOS_BOOTS ||
      item.tokenId === EstforConstants.ETERNAL_COWL ||
      item.tokenId === EstforConstants.ETERNAL_BODY ||
      item.tokenId === EstforConstants.ETERNAL_CHAPS ||
      item.tokenId === EstforConstants.ETERNAL_BRACERS ||
      item.tokenId === EstforConstants.ETERNAL_BOOTS ||
      item.tokenId === EstforConstants.REAVER_COWL ||
      item.tokenId === EstforConstants.REAVER_BODY ||
      item.tokenId === EstforConstants.REAVER_CHAPS ||
      item.tokenId === EstforConstants.REAVER_BRACERS ||
      item.tokenId === EstforConstants.REAVER_BOOTS ||
      item.tokenId === EstforConstants.SCORCHING_COWL ||
      item.tokenId === EstforConstants.SCORCHING_BODY ||
      item.tokenId === EstforConstants.SCORCHING_CHAPS ||
      item.tokenId === EstforConstants.SCORCHING_BRACERS ||
      item.tokenId === EstforConstants.SCORCHING_BOOTS ||
      item.tokenId === EstforConstants.ARROW_SHAFT ||
      item.tokenId === EstforConstants.BRONZE_ARROW_HEAD ||
      item.tokenId === EstforConstants.IRON_ARROW_HEAD ||
      item.tokenId === EstforConstants.MITHRIL_ARROW_HEAD ||
      item.tokenId === EstforConstants.ADAMANITE_ARROW_HEAD ||
      item.tokenId === EstforConstants.RUNITE_ARROW_HEAD ||
      item.tokenId === EstforConstants.TITANIUM_ARROW_HEAD ||
      item.tokenId === EstforConstants.ORICHALCUM_ARROW_HEAD ||
      item.tokenId === EstforConstants.FLIXORA ||
      item.tokenId === EstforConstants.BECARA_GRASS ||
      item.tokenId === EstforConstants.HURA_ROOT ||
      item.tokenId === EstforConstants.QUAVA_SILK ||
      item.tokenId === EstforConstants.RIGOB_CLOTH
  );

  await itemNFT.addItems(items);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
