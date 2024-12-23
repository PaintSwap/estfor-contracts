import {isBeta} from "./utils";

let brush;
let wftm;
let oracle;
let samWitchVRF;
let router;
let paintSwapMarketplaceWhitelist;
let worldActions;
let randomnessBeacon;
let dailyRewardsScheduler;
let treasury;
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
let bankRelay;
let playersLibrary;
let playersImplQueueActions;
let playersImplProcessActions;
let playersImplRewards;
let playersImplMisc;
let playersImplMisc1;
let players;
let instantActions;
let instantVRFActions;
let vrfRequestInfo;
let genericInstantVRFActionStrategy;
let eggInstantVRFActionStrategy;
let clanBattleLibrary;
let lockedBankVaults;
let lockedBankVaultsLibrary;
let territories;
let territoryTreasury;
let combatantsHelper;
let bazaar;
let petNFTLibrary;
let petNFT;
let passiveActions;
let pvpBattleground;
let raids;
let bridge;

// Third party stuff chain specific addresses
const chainId = process.env.CHAIN_ID;
if (chainId == "146") {
  brush = "0xE51EE9868C1f0d6cd968A8B8C8376Dc2991BFE44";
  wftm = "0x039e2fB66102314Ce7b64Ce5Ce3E5183bc94aD38";
  if (!isBeta) {
    oracle = "0x28ade840602d0363a2ab675479f1b590b23b0490";
    samWitchVRF = "0xdA3EcEfD34C7ECF4f39C65173F78de498FF3060a";
  } else {
    oracle = "0x6f7911cbbd4b5a1d2bdaa817a76056e510d728e7";
    samWitchVRF = "0x1BFf1DC67974577CF62A76463580CA5BBcC5f68e";
  }
  router = "0xcC6169aA1E879d3a4227536671F85afdb2d23fAD";
  paintSwapMarketplaceWhitelist = "0xc1dd8640b3acbc34a228f632ef9bea39dcc7b0ce";
} else {
  router = "0x";
  brush = "0x";
  wftm = "0x";
  oracle = "0x";
  samWitchVRF = "0x";
  router = "0x";
  paintSwapMarketplaceWhitelist = "0x";
}

if (!isBeta) {
  bridge = "";
  worldActions = "";
  randomnessBeacon = "0x28866bf156152966b5872bee39bc05b5b5eedb02";
  dailyRewardsScheduler = "";
  treasury = "0x000000000000000000000000000000000000dEaD";
  shop = "0x7fb574e4fbe876f751fec90e59686c2776df19f9";
  royaltyReceiver = "0xc3d53b81042454aa5fcf5c4e95de3e796dddb28b";
  adminAccess = "0xe63b7195b301b9313c9e337df4aceac436c3751e";
  itemNFTLibrary = "0x8d61639c830aaf82c8549c36e65a9aeef9a73b45";
  itemNFT = "0x4b9c90ebb1fa98d9724db46c4689994b46706f5a";
  estforLibrary = "0x804a530f41ecf0c40cd4e312a72e033c78a2c1fa";
  playerNFT = "0xb809ed839c691d465e2ec45e1bcb5e5aded50fb9";
  promotions = "0x7d1c598266Dd6Bb0Ed7a76161c11e5073D8A71A4";
  promotionsLibrary = "0x8b7e1bd3fe31d926209adfdbdc9d48a74e5666f5";
  quests = "0x17c59f0d2d4f80FD0F906Df53a28272736c7b455";
  clans = "0x334caa8907bdf49470f7b085380c25431ef96f6d";
  wishingWell = "0x0a8d80ce4855666b7d7121d75f2a49aac434a918";
  bank = "0xe183a43881eac74808c55bdb2a073929602af4db"; // beacon
  playersLibrary = "0xf01bc981a79f38b74a9b3953ee5aa6c95d9eded7";
  playersImplQueueActions = "0x05b9958e6f209d9d0594d34f0ac44d1f9bf128d6";
  playersImplProcessActions = "0x61da56557859597fa6bf693b7f149bc3934ac497";
  playersImplRewards = "0x8eae3948ff44ddce15223902b396f373692a422e";
  playersImplMisc = "0xd5aba67d0469fd553c9c5fb6b3534b98db3e1558";
  playersImplMisc1 = "0xc55b5e713ee31a641e090d1e550bf4fcfe0b6ba4";
  players = "0x058ec56aba13f7fee3ae9c9b91b3bb03bc336143";
  bankRegistry = "0x55a1b0251e1375bd41dd9778c379322e3863a54e";
  bankFactory = "0x4af59427b2aeb66e6f7dca98c366ec66cca4e8d4";
  bankRelay = "0x000000000000000000000000000000000000dEaD";
  instantActions = "0x7e89fe755b546b10ea8372b056ea0d7b26cf36fe";
  instantVRFActions = "0xfe2c07fd7751bba25164adbd96e09b382403f4d7";
  vrfRequestInfo = "0x8c3dcf7b09ea620b265d9daab237f29f485f725b";
  genericInstantVRFActionStrategy = "0x6270b82049724ff6d7a78b71f2273bba03bfcdfc";
  eggInstantVRFActionStrategy = "0x7797fd3904fc399184d2a549dff025210d62e645";
  clanBattleLibrary = "0x000000000000000000000000000000000000dEaD";
  lockedBankVaults = "0x65e944795d00cc287bdace77d57571fc4deff3e0";
  lockedBankVaultsLibrary = "0xd5a209d7fa6bc485b3c4120aaec75b2912cfe4e8";
  territories = "0x2cfd3b9f8b595200d6b4b7f667b2a1bcc6d0c170";
  combatantsHelper = "0x8fedf83c55012acff7115b8fa164095721953c39";
  territoryTreasury = "0xba2f8cff9ea18f3687eb685f0c1bcd509b539963";
  bazaar = "0x6996c519dA4ac7815bEFbd836cf0b78Aa62fdBcE";
  petNFTLibrary = "0x517792d5cbb33cd337a2ef1bc6290ad964ea434e";
  petNFT = "0x1681f593ac5cba407c2a190de0ca2beb4a69b5d3";
  passiveActions = "0xa3e3a69edaee89b8dbbd1ca37704cc574cb8e1d4";
  pvpBattleground = "";
  raids = "";
} else {
  bridge = "0x4a4988daecaad326aec386e70fb0e6e6af5bda1a";
  worldActions = "0x3a965bf890e5ac353603420cc8d4c821d1f8a765";
  randomnessBeacon = "0x7695be7272f3d223a40fc3c0499053f81c17cb65";
  dailyRewardsScheduler = "0x16ba02365efcb5dacc46fe743c46d37a93997575";
  treasury = "0xdd744b66bb24a01a4ec62287f3d0d91fee37f8b1";
  shop = "0xb3778f2c24d94e3c7cfe608388bd35bba9401caa";
  royaltyReceiver = "0x5fce65360e0acdfcec0153bda8c412a7631d47a2";
  adminAccess = "0xc06b7bb82b6312c1c2c2de3e375f04d97e80de57";
  itemNFTLibrary = "0x8ef4472a1792ae0c326d50c82145d0e0716aed0f";
  itemNFT = "0x8ee7d355f76fb5621ee89bca431ba0cd39fe14c5";
  bazaar = "0xae4bd229721ff40c07162c1720e060a2a5c89ff6";
  estforLibrary = "0x96977118842d6f209f9442e76d7de04d393480d8";
  playerNFT = "0xbf5eed84c0cdff089c9dd6086ddf805d111ef35b";
  quests = "0xd896af0dd1d3533d5d86d4be52df9546a97ddb4d";
  clans = "0x84d9d334c5b64fcbcb17d6b853a0434818d052bb";
  wishingWell = "0xb2570777de043adbc7bfcc4bfed747e2e44fbeea";
  bank = "0x72598e7d7a6652ebb29026f83512bce1455999f6";
  petNFTLibrary = "0x89312e531c11e34aa404feee01d2a6640088cc75";
  petNFT = "0x7ca7f680517150c8e1ed5a6dd5db80cdc6934082";
  playersLibrary = "0x705a4730e9fa8387390651f89bd9b68a43fa384e";
  playersImplQueueActions = "0xaa2c6ff739c1a23adcd2d19425e8cb8b1cd9b72b";
  playersImplProcessActions = "0x9cbb03f2f7ce5d9864de29a8014347cb4ffba5a8";
  playersImplRewards = "0x421dbc04ce3064b3965bd1db1076a3e6b1724c25";
  playersImplMisc = "0x735e09323dbb8751a9403d45b03a3d818a8a6db5";
  playersImplMisc1 = "0xced423c095ac6d29b78e7a2e16b52c97c3c1ff6c";
  players = "0x4f60948bea953693b4dcd7ea414a2198c3646c97";
  promotionsLibrary = "0xaf79ca769a02381daca6f7736c51e3ad01ac571c";
  promotions = "0xa4f0adf443b48b52827f8c1f56d2f2ab76ae43ab";
  passiveActions = "0x0b577a40b8e69614bd2f6687349ba69c0d1f7113";
  instantActions = "0x76928633cfbf043bca1f6b8ffe634f4c63dbd90d";
  vrfRequestInfo = "0x3631ba58d96d6089b9f55bc91e726199c3ec6ec2";
  instantVRFActions = "0x007247ab8fbae2b07f5adf3e70a141459c89264e";
  genericInstantVRFActionStrategy = "0x2e66bf22e21aee0986602dd2c7265a5470ec9962";
  eggInstantVRFActionStrategy = "0xd9deebc6ca8b75f8e4de7b4e96a4d8b7e2b3607e";
  bankRelay = "0xd6cdc1d365e505f0546361782c4336c829c39568";
  pvpBattleground = "0xe91a6cdac47dfd546578273253bff1fddc350764";
  raids = "0xbfd416e76519cf199dd95b82f6928b3a4b5ac995";
  clanBattleLibrary = "0x1a2abfb2c7c5084148a3f0674999c4de2c817138";
  lockedBankVaultsLibrary = "0x29b1095ed9e89826704e9e8fe326869d51d7b14e";
  lockedBankVaults = "0x9451943d38ac8cde8a2a8026adb8b28ac089b2cb";
  territories = "0xa2ca7daad4b86819c455fafc704d727a23c5a513";
  combatantsHelper = "0x7fa2b4c19093e0777d72235ea28d302f53227fa0";
  territoryTreasury = "0x5d1429f842891ea0ed80e856762b48bc117ac2a8";
  bankRegistry = "0x7e7664ff2717889841c758ddfa7a1c6473a8a4d6";
  bankFactory = "0x5497f4b12092d2a8bff8a9e1640ef68e44613f8c";
}

export const WORLD_ACTIONS_ADDRESS = worldActions;
export const RANDOMNESS_BEACON_ADDRESS = randomnessBeacon;
export const DAILY_REWARDS_SCHEDULER_ADDRESS = dailyRewardsScheduler;
export const TREASURY_ADDRESS = treasury;
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
export const BANK_RELAY_ADDRESS = bankRelay;

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
export const INSTANT_VRF_ACTIONS_ADDRESS = instantVRFActions;
export const VRF_REQUEST_INFO_ADDRESS = vrfRequestInfo;
export const GENERIC_INSTANT_VRF_ACTION_STRATEGY_ADDRESS = genericInstantVRFActionStrategy;
export const EGG_INSTANT_VRF_ACTION_STRATEGY_ADDRESS = eggInstantVRFActionStrategy;

export const CLAN_BATTLE_LIBRARY_ADDRESS = clanBattleLibrary;
export const LOCKED_BANK_VAULTS_ADDRESS = lockedBankVaults;
export const LOCKED_BANK_VAULTS_LIBRARY_ADDRESS = lockedBankVaultsLibrary;
export const TERRITORIES_ADDRESS = territories;
export const TERRITORY_TREASURY_ADDRESS = territoryTreasury;
export const COMBATANTS_HELPER_ADDRESS = combatantsHelper;

export const PET_NFT_LIBRARY_ADDRESS = petNFTLibrary;
export const PET_NFT_ADDRESS = petNFT;
export const PASSIVE_ACTIONS_ADDRESS = passiveActions;
export const BAZAAR_ADDRESS = bazaar;
export const PVP_BATTLEGROUND_ADDRESS = pvpBattleground;
export const RAIDS_ADDRESS = raids;

export const WFTM_ADDRESS = wftm;
export const BRUSH_ADDRESS = brush;
export const ROUTER_ADDRESS = router;
export const PAINTSWAP_MARKETPLACE_WHITELIST_ADDRESS = paintSwapMarketplaceWhitelist;
export const BRIDGE_ADDRESS = bridge;

// VRF
export const ORACLE_ADDRESS = oracle;
export const SAMWITCH_VRF_ADDRESS = samWitchVRF;

export const DEV_ADDRESS = "0x045eF160107eD663D10c5a31c7D2EC5527eea1D0";
