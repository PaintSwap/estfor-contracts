import {ethers} from "hardhat";
import {
  BRUSH_ADDRESS,
  ITEM_NFT_LIBRARY_ADDRESS,
  ITEM_NFT_ADDRESS,
  PLAYERS_ADDRESS,
  PLAYERS_LIBRARY_ADDRESS,
  ESTFOR_LIBRARY_ADDRESS,
  PLAYER_NFT_ADDRESS,
  SHOP_ADDRESS,
  CLANS_ADDRESS,
  BANK_FACTORY_ADDRESS,
  QUESTS_ADDRESS,
} from "./contractAddresses";
import {addTestData} from "./addTestData";

async function main() {
  const ItemNFT = await ethers.getContractFactory("ItemNFT", {libraries: {ItemNFTLibrary: ITEM_NFT_LIBRARY_ADDRESS}});
  const itemNFT = await ItemNFT.attach(ITEM_NFT_ADDRESS);

  const PlayerNFT = await ethers.getContractFactory("PlayerNFT", {
    libraries: {EstforLibrary: ESTFOR_LIBRARY_ADDRESS},
  });
  const playerNFT = await PlayerNFT.attach(PLAYER_NFT_ADDRESS);

  const PlayersLibrary = await ethers.getContractFactory("PlayersLibrary");
  let playerLibrary = await PlayersLibrary.attach(PLAYERS_LIBRARY_ADDRESS);
  const Players = await ethers.getContractFactory("Players", {
    libraries: {PlayersLibrary: playerLibrary.address},
  });
  const players = await Players.attach(PLAYERS_ADDRESS);

  const Shop = await ethers.getContractFactory("Shop");
  const shop = await Shop.attach(SHOP_ADDRESS);

  const MockBrushToken = await ethers.getContractFactory("MockBrushToken");
  const brush = await MockBrushToken.attach(BRUSH_ADDRESS);

  const Quests = await ethers.getContractFactory("Quests");
  const quests = await Quests.attach(QUESTS_ADDRESS);

  const Clans = await ethers.getContractFactory("Clans", {libraries: {EstforLibrary: ESTFOR_LIBRARY_ADDRESS}});
  const clans = await Clans.attach(CLANS_ADDRESS);

  const BankFactory = await ethers.getContractFactory("BankFactory");
  const bankFactory = await BankFactory.attach(BANK_FACTORY_ADDRESS);

  await addTestData(itemNFT, playerNFT, players, shop, brush, quests, clans, bankFactory);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
