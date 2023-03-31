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
  world = "0xfe93dbf15b733024f67e5a11a7c87401cd951bdc";
  shop = "0x30e37152cdde1720be35a2ebc8c799809c4acda9";
  royaltyReceiver = "0x430fe699f1468d19176d4697c237e4e8712b1822";
  adminAccess = "0xa4dbcb972927318489afc5f39a5db3d1600f8e0a";
  itemNFT = "0x5220cbe203cbff2b8257ba231859dcbfdd69da53";
  playerNFT = "0x6a92745fbb3c1bad2c6074b53396ab0e7abb8ba9";
  playersLibrary = "0xcc17dc0e82072372635602c9ef7db7710ad8b382";
  playersImplQueueActions = "0x6663b2f134f154121c1de055e179a1ea17504c05";
  playersImplProcessActions = "0x5e646e0c703ecce052805dcfcb634b02dd422408";
  playersImplRewards = "0xbc4e231b4cab96b2a0c1a2638930d863140807f3";
  players = "0xbd0d3fb6123ed252620c696c7d91caeb25c8a0f9";
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
