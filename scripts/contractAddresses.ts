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
    samWitchVRF = "0xE8eE3F1F75Df6807C78adDd1eB3edd010aBEe127";
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
  bridge = "0x551944b340a17f277a97773355f463beefea7901";
  worldActions = "0x9e1275dd55e9623dc8f1673fc3c94cf1176a2816";
  randomnessBeacon = "0x9b4ba31bf6031d9304c5d4487c3b30d58cef49a3";
  dailyRewardsScheduler = "0x56ddffd7126b55883b603c4c5f33c639dfa424bc";
  treasury = "0x50b64112cc5af4ff4f8e079143c5b19decddaf03";
  shop = "0x80b78e431b6e52027debe297cd8ba614820a2f1b";
  royaltyReceiver = "0x6c01e51d7254e5d3a3d844d2d56c35dd8abfa753";
  adminAccess = "0x3977a0e1a9f7564ce20cd88a22ae76d13386087a";
  itemNFTLibrary = "0xe5440a37964fdfb7456c292d31471d80d7f6046b";
  itemNFT = "0x8970c63da309d5359a579c2f53bfd64f72b7b706";
  bazaar = "0x0d6d3794c858b512716e77e05588d4f1fc264319";
  estforLibrary = "0xe3223eaf0e260b54a8ce777ac9f4a972310370c0";
  playerNFT = "0x076aeec336f5abbdf64ba8ddf96fc974b0463528";
  quests = "0x193ecbc093f3bcf6ae6155c9f1bd7c963af6b8d2";
  clans = "0xbc6ed9e6cb54661ed9682c5055a6631d92e9e1d0";
  wishingWell = "0x1207d2f1dc47a9228f20e9d0ce5094ff08bcb00b";
  bank = "0x144884e1b42ccc9c648adee9b5dc1479ce1c8fe3";
  petNFTLibrary = "0xdb24883dee4100a98bfec32ad95b9abf87c1a32f";
  petNFT = "0xe97f8165d9d8d6835abdf7a814ba55dd09b7b1ed";
  playersLibrary = "0x64fa111e721be0dda1bea918bdd941edc30199e7";
  playersImplQueueActions = "0x3883036da2426e8316a6948a1fbae5088ba8c2f1";
  playersImplProcessActions = "0x10caef6b2eb9c2badacb501b3097c84f4ad0f174";
  playersImplRewards = "0x4835e44e49f812b1410b8cd8e881c92182eb69ab";
  playersImplMisc = "0x9e4f42f01717ae447fe372d5deff8c245a8e0c7b";
  playersImplMisc1 = "0x797e1d0958e5efb2038a0bec82115f9dba1fffae";
  players = "0xefa670aad6d5921236e9655f346ca13a5c56481b";
  promotionsLibrary = "0x201ffa5be3886d19ef2f18da877ff3b9e34d10c9";
  promotions = "0xaf48a8a12f29e30b3831392aa2ee6344d07d188b";
  passiveActions = "0x72bb8faee4094d5a701faa26f9f442d32dfe53b6";
  instantActions = "0x765f7068c3cd210b52374498f3ce01617667aed0";
  vrfRequestInfo = "0x4875572c5d0910fdc19a193e38c3eb1113e28218";
  instantVRFActions = "0x1ea4b1fa7f069b89eb8cceee30bfb24945e4d638";
  genericInstantVRFActionStrategy = "0x05cd907e6ad6cad21ab2a39e49c68b110be7189a";
  eggInstantVRFActionStrategy = "0x231363f40693698df92354275e2bcc4cbe48aa56";
  bankRelay = "0x0df55b940e993f8d3b06a64212962c3d0fef8cba";
  pvpBattleground = "0x679193f35e696651e125b2851ee7c4e44bf40a18";
  raids = "0xec57b7988ee3344bcf4ce64e5d11f495df7cd951";
  clanBattleLibrary = "0x10a540055069172cf74bb7e06133d887a7e3a3d8";
  lockedBankVaultsLibrary = "0x10de14eafea8f841689b01fa682c63e52255b148";
  lockedBankVaults = "0xfaa31b6ddb7e07cae5ff15475b3966d78d660240";
  territories = "0x5a6d80bb035318d2a24c1fdfd055032a15f11b12";
  combatantsHelper = "0xc754d621239b5830264f8c8e302c21ffe48625fc";
  territoryTreasury = "0x4b1da5984c89312f852c798154a171a5ddc07d43";
  bankRegistry = "0xf213febd3889c5bf18086356e7eff79e2a9fe391";
  bankFactory = "0x76af5869f1b902f7a16c128a1daa7734819ec327";
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
