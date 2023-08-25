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
  worldLibrary = "0x4457c8211eec0a1b805db0669dc2dd3c7957d1df";
  world = "0x28866bf156152966b5872bee39bc05b5b5eedb02";
  shop = "0x7fb574e4fbe876f751fec90e59686c2776df19f9";
  royaltyReceiver = "0xc3d53b81042454aa5fcf5c4e95de3e796dddb28b";
  adminAccess = "0xe63b7195b301b9313c9e337df4aceac436c3751e";
  itemNFTLibrary = "0x91ad699cce43d8c6133d9e97a794d5c381e0fce0";
  itemNFT = "0x4b9c90ebb1fa98d9724db46c4689994b46706f5a";
  estforLibrary = "0x4e70c49cb3c6c1ddd1517db4fce192c59ac17b24";
  playerNFT = "0xb809ed839c691d465e2ec45e1bcb5e5aded50fb9";
  promotions = "0x7d1c598266Dd6Bb0Ed7a76161c11e5073D8A71A4";
  quests = "0x17c59f0d2d4f80FD0F906Df53a28272736c7b455";
  clans = "0x334caa8907bdf49470f7b085380c25431ef96f6d";
  wishingWell = "0x0a8d80ce4855666b7d7121d75f2a49aac434a918";
  bank = "0xe183a43881eac74808c55bdb2a073929602af4db";
  playersLibrary = "0x8d15d24d215f167cf0973459595dc8b8bb686338";
  playersImplQueueActions = "0x06ba453c4ed7ed86f76d91377bac4db6fc41598f";
  playersImplProcessActions = "0x3707bb83adf53a0020059acd4a69b1d433bd0ca2";
  playersImplRewards = "0xd7d2ff4d0562463dadcfb5e969468820bd408555";
  playersImplMisc = "0x509276f6b81bc03f0aab8433b0b10de0380b451a";
  playersImplMisc1 = "0xea92d5a34f8b463762805c94c57e83294f1e2ded";
  players = "0x058ec56aba13f7fee3ae9c9b91b3bb03bc336143";
  bankRegistry = "0x55a1b0251e1375bd41dd9778c379322e3863a54e";
  bankFactory = "0x4af59427b2aeb66e6f7dca98c366ec66cca4e8d4";
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
