import {ethers} from "hardhat";
import {
  BRUSH_ADDRESS,
  ITEM_NFT_ADDRESS,
  PLAYERS_ADDRESS,
  PLAYER_NFT_ADDRESS,
  SHOP_ADDRESS,
  CLANS_ADDRESS,
  BANK_FACTORY_ADDRESS,
  BAZAAR_ADDRESS,
  QUESTS_ADDRESS,
  BANK_ADDRESS
} from "./contractAddresses";
import {addTestData} from "./addTestData";
import {
  Bank,
  BankFactory,
  Clans,
  ItemNFT,
  MockBrushToken,
  OrderBook,
  PlayerNFT,
  Players,
  Quests,
  Shop
} from "../typechain-types";

async function main() {
  const itemNFT = (await ethers.getContractAt("ItemNFT", ITEM_NFT_ADDRESS)) as unknown as ItemNFT;
  const playerNFT = (await ethers.getContractAt("PlayerNFT", PLAYER_NFT_ADDRESS)) as unknown as PlayerNFT;
  const players = (await ethers.getContractAt("Players", PLAYERS_ADDRESS)) as unknown as Players;
  const shop = (await ethers.getContractAt("Shop", SHOP_ADDRESS)) as unknown as Shop;
  const brush = (await ethers.getContractAt("MockBrushToken", BRUSH_ADDRESS)) as unknown as MockBrushToken;
  const clans = (await ethers.getContractAt("Clans", CLANS_ADDRESS)) as unknown as Clans;
  const bankFactory = (await ethers.getContractAt("BankFactory", BANK_FACTORY_ADDRESS)) as unknown as BankFactory;
  const minItemQuantityBeforeSellsAllowed = 500n;
  const orderBook = (await ethers.getContractAt("OrderBook", BAZAAR_ADDRESS)) as unknown as OrderBook;
  const quests = (await ethers.getContractAt("Quests", QUESTS_ADDRESS)) as unknown as Quests;
  const bank = (await ethers.getContractAt("Bank", BANK_ADDRESS)) as unknown as Bank;
  const startClanId = 30_000;
  const buyBrush = false;

  await addTestData(
    itemNFT,
    playerNFT,
    players,
    shop,
    brush,
    clans,
    bankFactory,
    bank,
    minItemQuantityBeforeSellsAllowed,
    orderBook,
    quests,
    startClanId,
    buyBrush
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
