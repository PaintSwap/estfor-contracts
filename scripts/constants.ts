const isAlpha = process.env.IS_ALPHA == "true";

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

if (isAlpha) {
  worldLibrary = "0xd37796f51b461bc483cde9cf7c6f7881cace4738";
  world = "0xd37796f51b461bc483cde9cf7c6f7881cace4738";
  shop = "0xa0f16f4489dd45e2fb36d39910f7f767b81d638c";
  royaltyReceiver = "0x4f87eec592ac027ddb89ddf51cd30b54a05bb1fa";
  adminAccess = "0xf48dd4dd241b5937ebd1863294461d2f7797cc17";
  itemNFTLibrary = "0x4cc630e42217631b60673473d603883c644777d0";
  itemNFT = "0x346e7b2a1f79408a85ecb251893bf2d76c767e67";
  estforLibrary = "0x368c6c7c249ef53ff5b0b90deb517050afc965b5";
  playerNFT = "0x8b2be032dd0de14344c714019f7ea3a796912cb1";
  quests = "0xcf5e559cdd5ed66790aa0180ab01465e687f8942";
  clans = "0x020f393c21b968a124b1280f319d2f84ff76ad9a";
  bank = "0xf3c3ceec56f4b36dea9626c6bf8cbcd995df4be8";
  bankRegistry = "0x41d407956d532c611525e8c09192de80d07a0fa7";
  bankProxy = "0x5b59e9a0a074a2c3a0a813d3283c40fb1b3cb3db";
  bankFactory = "0x7adde2c738fcd1afeca25154c190db519b148a1b";
  playersLibrary = "0xe7b4a3a633ff2e7096a0e4985cbf9c924443acda";
  playersImplQueueActions = "0xadc7e4ea1ce13954f494baabdaa7e378a4862f35";
  playersImplProcessActions = "0xe0436667445f2a26a49261ba2977d04dee3e33bf";
  playersImplRewards = "0xf6d7bc4d7a3390bd551cb4aff1b3868f8118fb93";
  playersImplMisc = "0x83837f96f087aad019f581d4c3d9bf0c491d3725";
  players = "0xf7433aba1837f221ed432fc1b0e1833fe0c7ee01";
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
  bankProxy = "";
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
export const BANK_PROXY_ADDRESS = bankProxy;
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
