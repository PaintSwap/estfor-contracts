import {isBeta} from "./utils";

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
let promotionsLibrary;
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
let instantActions;
let territories;
let lockedBankVaults;
let decoratorProvider;
let combatantsHelper;
let sponsorWalletLockedVault;
let sponsorWalletTerritories;
let oracleFallback;

if (!isBeta) {
  worldLibrary = "0xd582da91d0449f93ba7ba477a55dd82689301f1f";
  world = "0x28866bf156152966b5872bee39bc05b5b5eedb02";
  shop = "0x7fb574e4fbe876f751fec90e59686c2776df19f9";
  royaltyReceiver = "0xc3d53b81042454aa5fcf5c4e95de3e796dddb28b";
  adminAccess = "0xe63b7195b301b9313c9e337df4aceac436c3751e";
  itemNFTLibrary = "0x91ad699cce43d8c6133d9e97a794d5c381e0fce0";
  itemNFT = "0x4b9c90ebb1fa98d9724db46c4689994b46706f5a";
  estforLibrary = "0x4ab5ccd48c4f64a2dd64b1417394415879eedd02";
  playerNFT = "0xb809ed839c691d465e2ec45e1bcb5e5aded50fb9";
  promotions = "0x7d1c598266Dd6Bb0Ed7a76161c11e5073D8A71A4";
  promotionsLibrary = "0x5494e6a699e8e59e9a6ec3031ab96e35f2476c95";
  quests = "0x17c59f0d2d4f80FD0F906Df53a28272736c7b455";
  clans = "0x334caa8907bdf49470f7b085380c25431ef96f6d";
  wishingWell = "0x0a8d80ce4855666b7d7121d75f2a49aac434a918";
  bank = "0xe183a43881eac74808c55bdb2a073929602af4db";
  playersLibrary = "0x7f3d2f36b3b3181e01fe4048dd9ba63be3440710";
  playersImplQueueActions = "0xa84314f52b6811e6e26c25d63b655108d6a16c02";
  playersImplProcessActions = "0x51bb1f55fe017f0df121c1c1cdd192ae96f32516";
  playersImplRewards = "0xfa69a967bf8a35b456c56c19d644fc1a819da833";
  playersImplMisc = "0x5e2a2a50f1b6afff7d588dccac0a4f0252f589fa";
  playersImplMisc1 = "0x84dacfda4ae5831e388f62692fb697dffc89ca53";
  players = "0x058ec56aba13f7fee3ae9c9b91b3bb03bc336143";
  bankRegistry = "0x55a1b0251e1375bd41dd9778c379322e3863a54e";
  bankFactory = "0x4af59427b2aeb66e6f7dca98c366ec66cca4e8d4";
  instantActions = "0x7e89fe755b546b10ea8372b056ea0d7b26cf36fe";
  lockedBankVaults = "";
  territories = "";
  decoratorProvider = "";
  combatantsHelper = "";
  sponsorWalletLockedVault = "";
  sponsorWalletTerritories = "";
  oracleFallback = "0x6f7911cbbd4b5a1d2bdaa817a76056e510d728e7";
} else {
  worldLibrary = "0x8e18dba6eba3e1e959a011695027ddb2b468e2f9";
  world = "0xe2f0b5cb118da85be68de1801d40726ce48009aa";
  shop = "0xc5e24fbaba1a945226ad2f882e14fc7b44dc1f30";
  royaltyReceiver = "0xc5de7625e1b5cb91d92bc65fd4d787f01c43e38e";
  adminAccess = "0xa298f1636dacab0db352fec84d2079814e0ce778";
  itemNFTLibrary = "0x684604fda98ef3756cc90976db150054222791a8";
  itemNFT = "0x1dae89b469d15b0ded980007dfdc8e68c363203d";
  estforLibrary = "0x17f931a2862fa539e7cc5416a2c75daaa5aae5ee";
  playerNFT = "0xde70e49756322afdf7714d3aca963abcb4547b8d";
  promotions = "0xf28cab48e29be56fcc68574b5c147b780c35647c";
  promotionsLibrary = "0x684c6e254df63b9d5a28b29b7e4d0850d158f9f9";
  quests = "0x96948a6df3a64cc2eb0a1825fccd26f0c93bfce9";
  clans = "0xd35410f526db135f09bb8e2bb066c8a63135d812";
  wishingWell = "0xdd1131f57e5e416622fa2b61d4108822e8cc38dc";
  bank = "0x73d1b1420deaeb6474b8aafb1d8229d392d1a04e";
  playersLibrary = "0x30267dab4833af17624b7c6c3ec7c58a5e0a3fda";
  playersImplQueueActions = "0x68e2542c46957f2ff999bc3d6dac33e29fa3709c";
  playersImplProcessActions = "0xb644dd7e6ee1aca750394555a9310f7035f718fa";
  playersImplRewards = "0xeacaa4d3e1afd034c2d91ea84c0a94ad8e70752b";
  playersImplMisc = "0xc1e7d4fa974f46d906296c90b6c0ce3ac0145483";
  playersImplMisc1 = "0x9551f0bb149f5cdbdf56a732fd4784630bf4dd20";
  players = "0x0aac9c0966ad5ea59cd0a47a0d415a68126ab7be";
  bankRegistry = "0xd5da02cee3d9ef0d63d1b79c659df16770c3c4e0";
  //  const bankProxy = "0xe1998e9bad94716ecf81f3a3bead5fed3fb023cb";  // Only used for old beta clans
  bankFactory = "0x7b8197e7d7352e8910a7af79a9184f50290403da";
  instantActions = "0xe9a1a09be4a64f806a26b33fbdf07a6f3e61af76";
  lockedBankVaults = "0x40567ad9cd25c56422807ed67f0e66f1825bdb91";
  territories = "0xf31517db9f0987002f3a0fb4f787dfb9e892f184";
  combatantsHelper = "0xe8231ac805a88b3c72e9602c2ae14a5d3421bc7c";
  decoratorProvider = "0xea8c4d188eb8d9704bc36931d89ba4f8e935cee2";
  sponsorWalletLockedVault = "0xc38dae57fc2d8fbedbd6ccb45491fd7c4da2d387";
  sponsorWalletTerritories = "0xa519dfa5728f8e91ae8c5657426c5b74176516f7";
  oracleFallback = "0x28ade840602d0363a2ab675479f1b590b23b0490";
}

export const WORLD_LIBRARY_ADDRESS = worldLibrary;
export const WORLD_ADDRESS = world;
export const SHOP_ADDRESS = shop;
export const ROYALTY_RECEIVER_ADDRESS = royaltyReceiver;
export const ADMIN_ACCESS_ADDRESS = adminAccess;
export const ITEM_NFT_LIBRARY_ADDRESS = itemNFTLibrary;
export const ITEM_NFT_ADDRESS = itemNFT;

export const WISHING_WELL_ADDRESS = wishingWell;
export const PROMOTIONS_LIBRARY_ADDRESS = promotionsLibrary;
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

export const INSTANT_ACTIONS_ADDRESS = instantActions;

export const LOCKED_BANK_VAULT_ADDRESS = lockedBankVaults;
export const SPONSOR_WALLET_LOCKED_VAULT_ADDRESS = sponsorWalletLockedVault;
export const TERRITORIES_ADDRESS = territories;
export const SPONSOR_WALLET_TERRITORIES_ADDRESS = sponsorWalletTerritories;
export const COMBATANTS_HELPER_ADDRESS = combatantsHelper;
export const DECORATOR_PROVIDER_ADDRESS = decoratorProvider;

// Only chain 250 (ftm)
export const BRUSH_ADDRESS = "0x85dec8c4B2680793661bCA91a8F129607571863d";
export const WFTM_ADDRESS = "0x21be370D5312f44cB42ce377BC9b8a0cEF1A4C83";
export const FAKE_BRUSH_ADDRESS = "0x8F85Ad0Ed1C6Cf23B82378efF7f71a7Df6A61071";
export const FAKE_BRUSH_WFTM_LP_ADDRESS = "0xb3209C979b90436f0a43ED817CD36c4c908604fD";
export const DECORATOR_ADDRESS = "0xCb80F529724B9620145230A0C866AC2FACBE4e3D";
export const DEV_ADDRESS = "0x045eF160107eD663D10c5a31c7D2EC5527eea1D0";
export const ORACLE_FALLBACK_ADDRESS = oracleFallback;
