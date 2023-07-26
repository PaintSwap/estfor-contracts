const isBeta = process.env.IS_BETA == "true";

let worldLibrary;
let world;
let shop;
let royaltyReceiver;
let adminAccess;
let itemNFTLibrary;
let itemNFT;
let estforLibrary;
let playerNFT;
let donation;
let promotions;
let quests;
let clans;
let bank;
let bankRegistry;
let bankProxy;
let bankFactory;
let playersLibrary;
let playersImplQueueActions;
let playersImplProcessActions;
let playersImplRewards;
let playersImplMisc;
let playersImplMisc1;
let players;

if (isBeta) {
  worldLibrary = "0xf1358a6db8a3fef6ebb93d951c07060e19fe056e";
  world = "0xe2f0b5cb118da85be68de1801d40726ce48009aa";
  shop = "0xc5e24fbaba1a945226ad2f882e14fc7b44dc1f30";
  royaltyReceiver = "0xc5de7625e1b5cb91d92bc65fd4d787f01c43e38e";
  adminAccess = "0xa298f1636dacab0db352fec84d2079814e0ce778";
  itemNFTLibrary = "0x22496409ef2407cd675195a604d0784a223c6028";
  itemNFT = "0x1dae89b469d15b0ded980007dfdc8e68c363203d";
  estforLibrary = "0x9bcb040b6ffc0adcedda870f0a8e18e4278c72de";
  playerNFT = "0xde70e49756322afdf7714d3aca963abcb4547b8d";
  donation = "0x1d59b8ee0f7632ca8ed2ca02a87a1e3565e3c4e5";
  promotions = "0xf28cab48e29be56fcc68574b5c147b780c35647c";
  quests = "0x96948a6df3a64cc2eb0a1825fccd26f0c93bfce9";
  clans = "0xd35410f526db135f09bb8e2bb066c8a63135d812";
  bank = "0x73d1b1420deaeb6474b8aafb1d8229d392d1a04e";
  playersLibrary = "0x135f9e2fdc98a855244a8755f3bef2301de70f5e";
  playersImplQueueActions = "0x119fd89a9446b35440ff57b8b2b954c17af89726";
  playersImplProcessActions = "0x362f3e945a36b1bdb18f77df0fd2982017797cbe";
  playersImplRewards = "0xdb7b689c7660ed392402b881f00fcc927cc2d6bb";
  playersImplMisc = "0xc1c5e2f1d65eb0218f73c744ebd6b9174d526250";
  playersImplMisc1 = "0xc473b519721fad584fe1d5b81301ec17727dbada";
  players = "0x0aac9c0966ad5ea59cd0a47a0d415a68126ab7be";
  bankRegistry = "0xd5da02cee3d9ef0d63d1b79c659df16770c3c4e0";
  bankProxy = "0xe1998e9bad94716ecf81f3a3bead5fed3fb023cb";
  bankFactory = "0x7b8197e7d7352e8910a7af79a9184f50290403da";
} else {
  // TODO when live addresses are known
  worldLibrary = "";
  world = "";
  shop = "";
  royaltyReceiver = "";
  adminAccess = "";
  itemNFTLibrary = "";
  itemNFT = "";
  estforLibrary = "";
  playerNFT = "";
  donation = "";
  promotions = "";
  quests = "";
  clans = "";
  bank = "";
  bankRegistry = "";
  bankFactory = "";
  playersLibrary = "";
  playersImplQueueActions = "";
  playersImplProcessActions = "";
  playersImplRewards = "";
  playersImplMisc = "";
  playersImplMisc1 = "";
  players = "";
}

export const WORLD_LIBRARY_ADDRESS = worldLibrary;
export const WORLD_ADDRESS = world;
export const SHOP_ADDRESS = shop;
export const ROYALTY_RECEIVER_ADDRESS = royaltyReceiver;
export const ADMIN_ACCESS_ADDRESS = adminAccess;
export const ITEM_NFT_LIBRARY_ADDRESS = itemNFTLibrary;
export const ITEM_NFT_ADDRESS = itemNFT;

export const DONATION_ADDRESS = donation;
export const PROMOTIONS_ADDRESS = promotions;
export const QUESTS_ADDRESS = quests;
export const CLANS_ADDRESS = clans;
export const BANK_ADDRESS = bank;
export const BANK_REGISTRY_ADDRESS = bankRegistry;
export const BANK_PROXY_ADDRESS = bankProxy; // Only used for old beta clans
export const BANK_FACTORY_ADDRESS = bankFactory;

export const ESTFOR_LIBRARY_ADDRESS = estforLibrary;
export const PLAYER_NFT_ADDRESS = playerNFT;
export const PLAYERS_LIBRARY_ADDRESS = playersLibrary;
export const PLAYERS_IMPL_QUEUE_ACTIONS_ADDRESS = playersImplQueueActions;
export const PLAYERS_IMPL_PROCESS_ACTIONS_ADDRESS = playersImplProcessActions;
export const PLAYERS_IMPL_REWARDS_ADDRESS = playersImplRewards;
export const PLAYERS_IMPL_MISC_ADDRESS = playersImplMisc;
export const PLAYERS_IMPL_MISC1_ADDRESS = playersImplMisc1;
export const PLAYERS_ADDRESS = players;

// Only chain 250 (ftm)
export const BRUSH_ADDRESS = "0x85dec8c4B2680793661bCA91a8F129607571863d";
export const WFTM_ADDRESS = "0x21be370D5312f44cB42ce377BC9b8a0cEF1A4C83";
