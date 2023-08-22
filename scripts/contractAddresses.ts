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
let wishingWell;
let promotions;
let quests;
let clans;
let bank;
let bankRegistry;
let bankFactory;
let playersLibrary;
let playersImplQueueActions;
let playersImplProcessActions;
let playersImplRewards;
let playersImplMisc;
let playersImplMisc1;
let players;

if (!isBeta) {
  worldLibrary = "0x51d2026dccae8c9866fbd0bb6493f9dd2b406396";
  world = "0x431137ea4620dacaf0007f0dfbfb8dd298e3c570";
  shop = "0xa254f7a8f9819dac75b8017f2b54d0f31cb1691f";
  royaltyReceiver = "0x84e4eff3bea2e129c9d884eb2fc0222be888ee92";
  adminAccess = "0xa09cd5d705441823eecc46de13e87699b07bd68c";
  itemNFTLibrary = "0x4cb1ef0ff16e212e3b2531bb7bce7204f80e875f";
  itemNFT = "0x99998ed4c00de52263d92e6e5ebb66fa0986ae25";
  estforLibrary = "0xb1b79b74a8dd0ee2954835e34d4ae21ace74b656";
  playerNFT = "0x7fc74b194a0fd872d3e58de62dadbf8459e15c0f";
  promotions = "0x04659ea5d6c3ab09532654139c8289cdfb2d3947";
  quests = "0xd485fdaa87341d431e7685ace89a1c1aa2213d3e";
  clans = "0xa540ce96a2ec97572c7028f89ffb8bc1bc932c0b";
  wishingWell = "0xe8156e6aeabe578926af8b61948ac3ece0dac737";
  bank = "0x3813315ec0fa8f52b0d12d1894e027d6e3b131a0";
  playersLibrary = "0x3d08306658d3e3e54b5608915b6ce092d8e97448";
  playersImplQueueActions = "0xb7a2fbce876444a6b6037551631b33bb131c88d9";
  playersImplProcessActions = "0xbe92cdfa6311e34e71f27c8ba04d703cb5daea37";
  playersImplRewards = "0x12772b73d4b19595fd58f02bf442c6160d19857a";
  playersImplMisc = "0xea74bff137a0af1eee70ecedffe5a0640c5f1c7e";
  playersImplMisc1 = "0x222d5d31acb500509c9b4c7a4e2a076e2253dd2d";
  players = "0x0c07300ed83db48cfa4048c3f4a465fb5ae454f7";
  bankRegistry = "0x68ba00d2f1aabbff3325c1e64f905f05e1d725da";
  bankFactory = "0x128124e8aceb8c885f5b450cce12e54b7d907393";
} else {
  worldLibrary = "0x9abb79ab5d7d0d3aa661a8281267c66f32012ea8";
  world = "0xe2f0b5cb118da85be68de1801d40726ce48009aa";
  shop = "0xc5e24fbaba1a945226ad2f882e14fc7b44dc1f30";
  royaltyReceiver = "0xc5de7625e1b5cb91d92bc65fd4d787f01c43e38e";
  adminAccess = "0xa298f1636dacab0db352fec84d2079814e0ce778";
  itemNFTLibrary = "0x22496409ef2407cd675195a604d0784a223c6028";
  itemNFT = "0x1dae89b469d15b0ded980007dfdc8e68c363203d";
  estforLibrary = "0x9bcb040b6ffc0adcedda870f0a8e18e4278c72de";
  playerNFT = "0xde70e49756322afdf7714d3aca963abcb4547b8d";
  promotions = "0xf28cab48e29be56fcc68574b5c147b780c35647c";
  quests = "0x96948a6df3a64cc2eb0a1825fccd26f0c93bfce9";
  clans = "0xd35410f526db135f09bb8e2bb066c8a63135d812";
  wishingWell = "0xdd1131f57e5e416622fa2b61d4108822e8cc38dc";
  bank = "0x73d1b1420deaeb6474b8aafb1d8229d392d1a04e";
  playersLibrary = "0x96580ff13fb3ef3735eb7549e014b360c777cdcb";
  playersImplQueueActions = "0x37b6fa791ab30874b1a1eeaac5c583ae6e5188bb";
  playersImplProcessActions = "0xaad4429aeefd9d19a6b554222acbc42b929a1dc7";
  playersImplRewards = "0xaea65427bceda0b3c9cc01e1689db30e39b0641f";
  playersImplMisc = "0xefeb13e575493d4266a97ea877103f632f06e99f";
  playersImplMisc1 = "0xed80678300b2c44ac6d05b454875e496ad96b283";
  players = "0x0aac9c0966ad5ea59cd0a47a0d415a68126ab7be";
  bankRegistry = "0xd5da02cee3d9ef0d63d1b79c659df16770c3c4e0";
  //  const bankProxy = "0xe1998e9bad94716ecf81f3a3bead5fed3fb023cb";  // Only used for old beta clans
  bankFactory = "0x7b8197e7d7352e8910a7af79a9184f50290403da";
}

export const WORLD_LIBRARY_ADDRESS = worldLibrary;
export const WORLD_ADDRESS = world;
export const SHOP_ADDRESS = shop;
export const ROYALTY_RECEIVER_ADDRESS = royaltyReceiver;
export const ADMIN_ACCESS_ADDRESS = adminAccess;
export const ITEM_NFT_LIBRARY_ADDRESS = itemNFTLibrary;
export const ITEM_NFT_ADDRESS = itemNFT;

export const WISHING_WELL_ADDRESS = wishingWell;
export const PROMOTIONS_ADDRESS = promotions;
export const QUESTS_ADDRESS = quests;
export const CLANS_ADDRESS = clans;
export const BANK_ADDRESS = bank;
export const BANK_REGISTRY_ADDRESS = bankRegistry;
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
