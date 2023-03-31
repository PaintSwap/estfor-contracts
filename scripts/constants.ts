const isAlpha = process.env.IS_ALPHA == "true";

let world;
let shop;
let royaltyReceiver;
let adminAccess;
let itemNFT;
let playerNFT;
let playersLibrary;
let playersImplQueueActions;
let playersImplProcessActions;
let playersImplRewards;
let players;

if (isAlpha) {
  world = "0x0165878a594ca255338adfa4d48449f69242eb8f";
  shop = "0x2279b7a0a67db372996a5fab50d91eaa73d2ebe6";
  royaltyReceiver = "0x610178da211fef7d417bc0e6fed39f05609ad788";
  adminAccess = "0xa51c1fc2f0d1a1b8494ed1fe312d7c3a78ed91c0";
  itemNFT = "0x9a676e781a523b5d0c0e43731313a708cb607508";
  playerNFT = "0x959922be3caee4b8cd9a407cc3ac1c251c2007b1";
  playersLibrary = "0x9a9f2ccfde556a7e9ff0848998aa4a0cfd8863ae";
  playersImplQueueActions = "0x68b1d87f95878fe05b998f19b66f4baba5de1aed";
  playersImplProcessActions = "0x3aa5ebb10dc797cac828524e59a333d0a371443c";
  playersImplRewards = "0xc6e7df5e7b4f2a278906862b61205850344d4e7d";
  players = "0x8702e0fe9d21e23d8d81710f3ed47ee8d1928966";
} else {
  // TODO when live addresses are known
  world = "";
  shop = "";
  royaltyReceiver = "";
  adminAccess = "";
  itemNFT = "";
  playerNFT = "";
  playersLibrary = "";
  playersImplQueueActions = "";
  playersImplProcessActions = "";
  playersImplRewards = "";
  players = "";
}

export const WORLD_ADDRESS = world;
export const SHOP_ADDRESS = shop;
export const ROYALTY_RECEIVER_ADDRESS = royaltyReceiver;
export const ADMIN_ACCESS_ADDRESS = adminAccess;
export const ITEM_NFT_ADDRESS = itemNFT;
export const PLAYER_NFT_ADDRESS = playerNFT;
export const PLAYERS_LIBRARY_ADDRESS = playersLibrary;
export const PLAYERS_IMPL_QUEUE_ACTIONS_ADDRESS = playersImplQueueActions;
export const PLAYERS_IMPL_PROCESS_ACTIONS_ADDRESS = playersImplProcessActions;
export const PLAYERS_IMPL_REWARDS_ADDRESS = playersImplRewards;
export const PLAYERS_ADDRESS = players;

export const BRUSH_ADDRESS = "0x85dec8c4B2680793661bCA91a8F129607571863d";
export const WFTM_ADDRESS = "0x21be370D5312f44cB42ce377BC9b8a0cEF1A4C83";
