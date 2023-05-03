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
  worldLibrary = "0x75eb7ad4647b0bae81b7d69627f90ec11bb8b0c9";
  world = "0x94cb4ff6818b0969b62ac7b44d97a996594fb1c8";
  shop = "0x593ed05fa8a1c19c90657850044fbf7315f123dc";
  royaltyReceiver = "0xa40b25c086dbc4b12025ecf9bf28f35095113301";
  adminAccess = "0x5e94ef5c4140591b2cf19d1f0c93c09d45c749aa";
  itemNFTLibrary = "0x8d33d43de611801b940c1a65e2ae277c8e9f9292";
  itemNFT = "0xbf7c0526730e85eb2934f61f9f13fa165148f501";
  estforLibrary = "0x0628ecce6783aee0ca9f6332814e138dad93e561";
  playerNFT = "0x3366554fbd63e75ab5a115677d8a28a2ef9e9e6d";
  quests = "0xb8b58f9d48f696d3ff6942dca53ad42500d72073";
  clans = "0x170bbaddf0a0a7272870930805fad59f4181bd82";
  bank = "0xa145c002bc92fd5116d309b7f7a596bc6bbe4477";
  playersLibrary = "0x39c6190ab86586dc52d83c5ecd261cce924b2a12";
  playersImplQueueActions = "0x889d4a5ad2b5b495fd9a24171276a4cd2048a12f";
  playersImplProcessActions = "0x90ff8dcd03176963cb7185aaa3773be983ccfda8";
  playersImplRewards = "0xc4655ef67025f8c2a2e58a1f2474f0a3ae80c3ba";
  playersImplMisc = "0x843591cab6e7c6e61fa20fc78a31b7cdaff2c9c9";
  players = "0x06b91f57d59cee17b31371fc0dbc72595dda1f23";
  bankRegistry = "0x5d30889454257fdbe25f3baf3dba08ba7dedd429";
  bankProxy = "0x64099e35ec572dada43c1b38df9699923bb0a209";
  bankFactory = "0x94e06a7421d49247c6bb664117c2d2a3f1e6fbc7";
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
