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
let players;

if (isBeta) {
  worldLibrary = "0x5443085444f881a9aee41d51166ad0aef8af1232";
  world = "0xe2f0b5cb118da85be68de1801d40726ce48009aa";
  shop = "0xc5e24fbaba1a945226ad2f882e14fc7b44dc1f30";
  royaltyReceiver = "0xc5de7625e1b5cb91d92bc65fd4d787f01c43e38e";
  adminAccess = "0xa298f1636dacab0db352fec84d2079814e0ce778";
  itemNFTLibrary = "0xa73f74c0fbed265a656293a1a91a9506678e3d54";
  itemNFT = "0x1dae89b469d15b0ded980007dfdc8e68c363203d";
  estforLibrary = "0x9bcb040b6ffc0adcedda870f0a8e18e4278c72de";
  playerNFT = "0xde70e49756322afdf7714d3aca963abcb4547b8d";
  quests = "0x96948a6df3a64cc2eb0a1825fccd26f0c93bfce9";
  clans = "0xd35410f526db135f09bb8e2bb066c8a63135d812";
  bank = "0x73d1b1420deaeb6474b8aafb1d8229d392d1a04e";
  playersLibrary = "0x462e6d4500f1e701651d20a251bb59f22fe49e16";
  playersImplQueueActions = "0x21576b3a10a1ee66695b99d0c420053e3ea67ff1";
  playersImplProcessActions = "0x5c541142356cab68f9ac2745271aec5b4d985c09";
  playersImplRewards = "0xc3fac773250d941be4082677caa018ab6c5cbd62";
  playersImplMisc = "0x80f3c91914484d39937692b12168d85e68bcc463";
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
  players = "";
}

export const WORLD_LIBRARY_ADDRESS = worldLibrary;
export const WORLD_ADDRESS = world;
export const SHOP_ADDRESS = shop;
export const ROYALTY_RECEIVER_ADDRESS = royaltyReceiver;
export const ADMIN_ACCESS_ADDRESS = adminAccess;
export const ITEM_NFT_LIBRARY_ADDRESS = itemNFTLibrary;
export const ITEM_NFT_ADDRESS = itemNFT;

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
export const PLAYERS_ADDRESS = players;

export const BRUSH_ADDRESS = "0x85dec8c4B2680793661bCA91a8F129607571863d";
export const WFTM_ADDRESS = "0x21be370D5312f44cB42ce377BC9b8a0cEF1A4C83";