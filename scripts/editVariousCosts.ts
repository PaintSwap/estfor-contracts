import {ethers, upgrades} from "hardhat";
import {
  CLANS_ADDRESS,
  ESTFOR_LIBRARY_ADDRESS,
  PET_NFT_ADDRESS,
  PET_NFT_LIBRARY_ADDRESS,
  PLAYER_NFT_ADDRESS,
  SHOP_ADDRESS,
  WISHING_WELL_ADDRESS,
} from "./contractAddresses";
import {EstforConstants} from "@paintswap/estfor-definitions";
import {allShopItems, allShopItemsBeta} from "./data/shopItems";
import {WishingWell} from "../typechain-types";
import {allClanTiers, allClanTiersBeta} from "./data/clans";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Edit various costs using account: ${owner.address} on chain id ${await owner.getChainId()}`);

  const isBeta = process.env.IS_BETA == "true";

  // Edit shop items
  const shop = await ethers.getContractAt("Shop", SHOP_ADDRESS);
  const shopItemIds = new Set([
    EstforConstants.MEDIUM_NET,
    EstforConstants.LARGE_NET,
    EstforConstants.WOOD_FISHING_ROD,
    EstforConstants.CAGE,
    EstforConstants.COMBAT_BOOST,
    EstforConstants.XP_BOOST,
    EstforConstants.GATHERING_BOOST,
    EstforConstants.SKILL_BOOST,
    EstforConstants.FLUX,
  ]);

  const allShopItems_ = isBeta ? allShopItemsBeta : allShopItems;
  const shopItems = allShopItems_.filter((item) => shopItemIds.has(item.tokenId));
  let tx = await shop.editItems(shopItems);
  console.log("Edited shop items");

  // Wishing well
  const wishingWellCost = isBeta ? ethers.utils.parseEther("4") : ethers.utils.parseEther("10");
  const wishingWell = (await ethers.getContractAt("WishingWell", WISHING_WELL_ADDRESS)) as WishingWell;
  tx = await wishingWell.setRaffleEntryCost(wishingWellCost);
  console.log("Update wishing well raffle cost");

  const playerNFT = await ethers.getContractAt("PlayerNFT", PLAYER_NFT_ADDRESS);
  const upgradeCost = isBeta ? ethers.utils.parseEther("11") : ethers.utils.parseEther("700");
  tx = await playerNFT.setUpgradeCost(upgradeCost);
  await tx.wait();
  console.log("Edit upgrade player cost");

  const editNameCost = isBeta ? ethers.utils.parseEther("2") : ethers.utils.parseEther("300");
  tx = await playerNFT.setEditNameCost(editNameCost);
  await tx.wait();
  console.log("Edit player name cost");

  // Upgrade clan costs
  const clans = await ethers.getContractAt("Clans", CLANS_ADDRESS);
  const clanTiers = isBeta ? allClanTiersBeta : allClanTiers;
  tx = await clans.editTiers(clanTiers);
  await tx.wait();
  console.log("Edited clan tiers");

  // Edit clan editing prices
  const editClanNameCost = isBeta ? ethers.utils.parseEther("2") : ethers.utils.parseEther("300");
  tx = await clans.setEditNameCost(editClanNameCost);
  await tx.wait();
  console.log("Clan edit name cost");

  // Edit pet name cost
  const petNFT = await ethers.getContractAt("PetNFT", PET_NFT_ADDRESS);
  const editPetNameCost = isBeta ? ethers.utils.parseEther("0") : ethers.utils.parseEther("1");
  tx = await petNFT.setEditNameCost(editPetNameCost);
  await tx.wait();
  console.log("Pet edit name cost");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
