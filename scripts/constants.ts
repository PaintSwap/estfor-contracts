const isAlpha = process.env.IS_ALPHA == "true";

let world;
let shop;
let royaltyReceiver;
let adminAccess;
let itemNFT;
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
let players;

if (isAlpha) {
  world = "0xf2ff8c647beaef34322e9dc32d33c4e92ebfc69f";
  shop = "0x822abb8a33a1d3dd5a76dd51f4387f5496874b61";
  royaltyReceiver = "0x9ee50ca7bdc2d503f300c82839f714ab3173a26b";
  adminAccess = "0x5e73216abda4b7ce684c34ee8756decc4c9106bb";
  itemNFT = "0x37c84e51639469f077b87fbd264a7d5c56412f8a";
  playerNFT = "0xce882318286aa504f35cab79731a94c0ff3f70f9";
  quests = "0xf6274581031db3b0bb1c2e57339ddcaefeba6598";
  clans = "0x24e2805fc9463fbb074c5dbadca6b527788b46fb";
  bank = "0xd5de5be27ee1ad3db285d119e6bf5419b9e2f4c9";
  bankRegistry = "0xe807c0eb40ad606643e5f063a6c6e5e6d564f703";
  bankProxy = "0xc0a084a2f346bd1ad294e1d47c5ba80203642354";
  bankFactory = "0x9d0ebb5e7d57c37da7800d62dc6b3f941a3128cc";
  playersLibrary = "0xffcdd0cbed1347120895c52d520a9a902b21c196";
  playersImplQueueActions = "0xd62752d03b15a16747d2dc76c9652299b4b7a8ab";
  playersImplProcessActions = "0xe0e9dd410104ed6c1535956ea4098267e7d73ea0";
  playersImplRewards = "0xdce6895f924fb3dfff65642dbef4b9ea37c02e39";
  players = "0xd7616b97d07b11c371ba16a8808bd981628fdfd2";
} else {
  // TODO when live addresses are known
  world = "";
  shop = "";
  royaltyReceiver = "";
  adminAccess = "";
  itemNFT = "";
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
  players = "";
}

export const WORLD_ADDRESS = world;
export const SHOP_ADDRESS = shop;
export const ROYALTY_RECEIVER_ADDRESS = royaltyReceiver;
export const ADMIN_ACCESS_ADDRESS = adminAccess;
export const ITEM_NFT_ADDRESS = itemNFT;

export const QUESTS_ADDRESS = quests;
export const CLANS_ADDRESS = clans;
export const BANK_ADDRESS = bank;
export const BANK_REGISTRY_ADDRESS = bankRegistry;
export const BANK_PROXY_ADDRESS = bankProxy;
export const BANK_FACTORY_ADDRESS = bankFactory;

export const PLAYER_NFT_ADDRESS = playerNFT;
export const PLAYERS_LIBRARY_ADDRESS = playersLibrary;
export const PLAYERS_IMPL_QUEUE_ACTIONS_ADDRESS = playersImplQueueActions;
export const PLAYERS_IMPL_PROCESS_ACTIONS_ADDRESS = playersImplProcessActions;
export const PLAYERS_IMPL_REWARDS_ADDRESS = playersImplRewards;
export const PLAYERS_ADDRESS = players;

export const BRUSH_ADDRESS = "0x85dec8c4B2680793661bCA91a8F129607571863d";
export const WFTM_ADDRESS = "0x21be370D5312f44cB42ce377BC9b8a0cEF1A4C83";
