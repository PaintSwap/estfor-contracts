import {ethers} from "hardhat";
import {
  BRUSH_ADDRESS,
  ITEM_NFT_ADDRESS,
  PLAYERS_ADDRESS,
  PLAYER_NFT_ADDRESS,
  SHOP_ADDRESS,
  CLANS_ADDRESS,
  BANK_FACTORY_ADDRESS
} from "./contractAddresses";
import {addTestData} from "./addTestData";
import {BankFactory, Clans, ItemNFT, MockBrushToken, PlayerNFT, Players, Shop} from "../typechain-types";

async function main() {
  const itemNFT = (await ethers.getContractAt("ItemNFT", ITEM_NFT_ADDRESS)) as ItemNFT;
  const playerNFT = (await ethers.getContractAt("PlayerNFT", PLAYER_NFT_ADDRESS)) as PlayerNFT;
  const players = (await ethers.getContractAt("Players", PLAYERS_ADDRESS)) as Players;
  const shop = (await ethers.getContractAt("Shop", SHOP_ADDRESS)) as Shop;
  const brush = (await ethers.getContractAt("MockBrushToken", BRUSH_ADDRESS)) as MockBrushToken;
  const clans = (await ethers.getContractAt("Clans", CLANS_ADDRESS)) as Clans;
  const bankFactory = (await ethers.getContractAt("BankFactory", BANK_FACTORY_ADDRESS)) as BankFactory;
  const minItemQuantityBeforeSellsAllowed = 500n;

  await addTestData(itemNFT, playerNFT, players, shop, brush, clans, bankFactory, minItemQuantityBeforeSellsAllowed);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
