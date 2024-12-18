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
const chainId = process.env.CHAIN_ID; // Error here intentially to force you to think about it. Ideally this is read elsewhere
if (chainId == "250") {
  if (!isBeta) {
    brush = "0x85dec8c4B2680793661bCA91a8F129607571863d";
    wftm = "0x039e2fB66102314Ce7b64Ce5Ce3E5183bc94aD38";
    oracle = "0x28ade840602d0363a2ab675479f1b590b23b0490";
    samWitchVRF = "0xeF5AC0489fc8ABC1085E8D1f5BEE85e74E6D2cC2";
    router = "0x000000000000000000000000000000000000dEaD";
    paintSwapMarketplaceWhitelist = "0x000000000000000000000000000000000000dEaD";
  } else {
    brush = "0x85dec8c4b2680793661bca91a8f129607571863d";
    wftm = "0x21be370d5312f44cb42ce377bc9b8a0cef1a4c83";
    oracle = "0x6f7911cbbd4b5a1d2bdaa817a76056e510d728e7";
    samWitchVRF = "0x68db5ba48ad5ca5ee1620a9aee8eec9ccd1cfc95";
    router = "0x2aa07920e4ecb4ea8c801d9dfece63875623b285";
    paintSwapMarketplaceWhitelist = "0x7559038535f3d6ed6bac5a54ab4b69da827f44bd";
  }
} else if (chainId == "57054") {
  // sonic blaze
  //  if (!isBeta) {
  // } else {
  router = "0xf08413857af2cfbb6edb69a92475cc27ea51453b";
  brush = "0xc06b7bb82b6312c1c2c2de3e375f04d97e80de57";
  wftm = "0x039e2fb66102314ce7b64ce5ce3e5183bc94ad38";
  oracle = "0x6f7911cbbd4b5a1d2bdaa817a76056e510d728e7";
  samWitchVRF = "0x682a916934861175b12680e64b2225530e85e079";
  router = "0xf08413857af2cfbb6edb69a92475cc27ea51453b";
  paintSwapMarketplaceWhitelist = "0x8ee7d355f76fb5621ee89bca431ba0cd39fe14c5";
  //  }
} else if (chainId == "146") {
  router = "0x";
  brush = "0x";
  wftm = "0x";
  oracle = "0x";
  samWitchVRF = "0x";
  router = "0x";
  paintSwapMarketplaceWhitelist = "0x";
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
  // Fantom addresses for testing bridging (CHANGE TO PARIS IF USING THESE)
  if (chainId == "250") {
    bridge = "0x6d4f6abf56a6f7bee3231fbe932550068cef156b";
    worldActions = "0x6f8ad385495a1658cfd25d19babcbf75f536048a";
    randomnessBeacon = "0x43a79bdb3a510d9289ddfd6fa358ddf27d9ce1e5";
    dailyRewardsScheduler = "0xb77d52611e7c631251e1e1eca5c53f060716be18";
    treasury = "0x11cf5459df4f53e070c956d9949487e71fc83279";
    shop = "0xd981a9769d43880123d19067d4ce697baf3bcab6";
    royaltyReceiver = "0xf62cee8f5b735aba3ff728648dccb95599645279";
    adminAccess = "0x0b07bfa7038dfa1f4339a188c71568a8d214f060";
    itemNFTLibrary = "0xf6cb3299ff52418e11437fe95f9052397693c2da";
    itemNFT = "0x720e9bcc97c8c40039c43f6e3da22c663de99c46";
    bazaar = "0x9944206db816323e7f125e13ecc74c43d105a209";
    estforLibrary = "0x9cf7feb15c1db1c995574729c306d89b034a4fde";
    playerNFT = "0x7070bb5ac36c408496f22024f293def2485b0b00";
    quests = "0xe2075c882115680f89d0774ba811e6261db0461d";
    clans = "0x7d86e8c0a816294fd02167f350a369429e50a209";
    wishingWell = "0x647f6d4eb8e4cac71c782f308a6c1d92b3444096";
    bank = "0x3ce836b01834a3db39096632e5059004d5ef5775";
    petNFTLibrary = "0x0cb2d0d57f355a5b86b65c18839e17cd7adc5f98";
    petNFT = "0xadbc598f734c4cdf991f4a9f4ab857d7f0e4890a";
    playersLibrary = "0x07b6c1b25ed75935213e7414f6193df7d3ab1f81";
    playersImplQueueActions = "0xfc2581de0bf050778f32efeb4b62d1c3dd9b0955";
    playersImplProcessActions = "0x542e9e53012081234136e9f026689955f436c1f5";
    playersImplRewards = "0x283f03f199565efc285a4f1e3d442bed7cbe1240";
    playersImplMisc = "0xf7bebeb567932f3cfdb2eab5dcac6aece52d8a19";
    playersImplMisc1 = "0xacc19d0a164b75a03ff7a523b4d844d5bf0fd00b";
    players = "0x7cd563182cf3a8fa81faef236bc2a06d353a612e";
    promotionsLibrary = "0x830612da81607d68ac130b11e25ce12973857462";
    promotions = "0xfc4e70b2343201b5f71da62a61613d97155954b0";
    passiveActions = "0x9c5dfe0dc9c4eea4578b6abf8d930e78906adeb2";
    instantActions = "0xacb1fe8a48f592b3e990c0f753d935ed14585692";
    vrfRequestInfo = "0x826ed89c05ead84bb3becb593e17fbb2f52c910a";
    instantVRFActions = "0xc83dff6aa8c5d85e8a994cfc9d1c72cc7daac87a";
    genericInstantVRFActionStrategy = "0x14efff96c3f4ef4864e61c5a3d8ddb03d7ec85cc";
    eggInstantVRFActionStrategy = "0xb0a9179f7167ba2d02b09d3895eb3ef56d7d1c5a";
    bankRelay = "0xe044510746dbf6f10c59e81081299598c1d78965";
    pvpBattleground = "0xda5ca50c55e03fc8257c2ad4f0df03d2b1fc84bf";
    raids = "0xe0dfc73ee20c9c55b844f1886a3fb343fd36fdec";
    clanBattleLibrary = "0x081f442b8044ba6f5ef2e14bd6b9a3ee1f04460a";
    lockedBankVaultsLibrary = "0xef7cec70287de9f16ba97d4d9f955907606af971";
    lockedBankVaults = "0xb529e634ba5332bafb68bbab1c87a10a24bf8f16";
    territories = "0x771b00fc3f4246f0e4fcd602e760c1257758b9fb";
    combatantsHelper = "0x7176217350c4ad5cef6a80bbbf63a85fba8822b8";
    territoryTreasury = "0xc60e157b135e16c84b5dfdabf3055649908131bf";
    bankRegistry = "0x35067b5e1d9d36bb62e29808da9361cb6141f764";
    bankFactory = "0xd153376e20229506678fc871e674415825fb2b28";
  } else if (chainId == "57054") {
    // (CHANGE TO CANCUN IF USING THESE)
    bridge = "0x96977118842d6f209f9442e76d7de04d393480d8";
    worldActions = "0xbf5eed84c0cdff089c9dd6086ddf805d111ef35b";
    randomnessBeacon = "0xb82ac3a015e2b955dbb7844956a1e8fcff4ba9a2";
    dailyRewardsScheduler = "0xb2570777de043adbc7bfcc4bfed747e2e44fbeea";
    treasury = "0x89312e531c11e34aa404feee01d2a6640088cc75";
    shop = "0x7ca7f680517150c8e1ed5a6dd5db80cdc6934082";
    royaltyReceiver = "0xaa2c6ff739c1a23adcd2d19425e8cb8b1cd9b72b";
    adminAccess = "0x421dbc04ce3064b3965bd1db1076a3e6b1724c25";
    itemNFTLibrary = "0x735e09323dbb8751a9403d45b03a3d818a8a6db5";
    itemNFT = "0x4f60948bea953693b4dcd7ea414a2198c3646c97";
    bazaar = "0x9b00e038af63a1ecb17af6b35e6e0db23fe7badc";
    estforLibrary = "0xa4f0adf443b48b52827f8c1f56d2f2ab76ae43ab";
    playerNFT = "0x76928633cfbf043bca1f6b8ffe634f4c63dbd90d";
    quests = "0x007247ab8fbae2b07f5adf3e70a141459c89264e";
    clans = "0xd9deebc6ca8b75f8e4de7b4e96a4d8b7e2b3607e";
    wishingWell = "0xe91a6cdac47dfd546578273253bff1fddc350764";
    bank = "0xbfd416e76519cf199dd95b82f6928b3a4b5ac995";
    petNFTLibrary = "0x1a2abfb2c7c5084148a3f0674999c4de2c817138";
    petNFT = "0xdee02ae9613abea8dd4a8bf05c0c9aaa9449d8af";
    playersLibrary = "0x9451943d38ac8cde8a2a8026adb8b28ac089b2cb";
    playersImplQueueActions = "0xa2ca7daad4b86819c455fafc704d727a23c5a513";
    playersImplProcessActions = "0x76475cd18a9c6d2b7f39409986d8e106c291c4a0";
    playersImplRewards = "0x7fa2b4c19093e0777d72235ea28d302f53227fa0";
    playersImplMisc = "0x5d1429f842891ea0ed80e856762b48bc117ac2a8";
    playersImplMisc1 = "0x7e7664ff2717889841c758ddfa7a1c6473a8a4d6";
    players = "0xa1ee5699c61a1de49a40656bf066acf8401905e2";
    promotionsLibrary = "0xcaf489b791bd0146798407d2fd5c1bb005e9e815";
    promotions = "0x4c362fdf861b34c97f8fc51e542f6b824fbab4b1";
    passiveActions = "0xc80faa2343dd4cb23db964ddee148fb09aa4acf5";
    instantActions = "0x1223236a2c2bf97e6e4574dc81466c9b67f3d45b";
    vrfRequestInfo = "0xf5b6c8e8cbfe8dbed3bb753b3447615e1b78b8c4";
    instantVRFActions = "0xa68c5328a5086647070d026b32ea93aee5061277";
    genericInstantVRFActionStrategy = "0xb625f1193dd90323b4d9d85c1b57aeecd265d83a";
    eggInstantVRFActionStrategy = "0xbff59ef7a42aaa7a68afbf21c943a014c798f40c";
    bankRelay = "0xc695a1632b89cd5db110d5f2586a42781d0ea05b";
    pvpBattleground = "0x5d3efbbb5171163ee6af4590e88f822ee16719bf";
    raids = "0xb1acff63a48f17ed91082eaa70d8a169d1c471b1";
    clanBattleLibrary = "0xfc5785d98921b9f46ef4f300bc91e1ec8ef33821";
    lockedBankVaultsLibrary = "0xe1f88e66a80257638550a36f69d7cdd714af5335";
    lockedBankVaults = "0x622dbb0bf5de05af9cb63e5746b6aa8c6ebdbea3";
    territories = "0x85dec8c4b2680793661bca91a8f129607571863d";
    combatantsHelper = "0x9a91634e4c47389ec3a75681b5979767778b81ac";
    territoryTreasury = "0x5cf84612cc7aab33450eebd1a520a93406c57792";
    bankRegistry = "0xea7054c1fd3d21e60a5e6ec0a97197d969f4bace";
    bankFactory = "0x64b5fa108af1528a3d3835f70ff01d21420db93d";
  } else {
    bridge = "";
    worldActions = "";
    randomnessBeacon = "";
    dailyRewardsScheduler = "";
    treasury = "";
    shop = "";
    royaltyReceiver = "";
    adminAccess = "";
    itemNFTLibrary = "";
    itemNFT = "";
    bazaar = "";
    estforLibrary = "";
    playerNFT = "";
    quests = "";
    clans = "";
    wishingWell = "";
    bank = "";
    petNFTLibrary = "";
    petNFT = "";
    playersLibrary = "";
    playersImplQueueActions = "";
    playersImplProcessActions = "";
    playersImplRewards = "";
    playersImplMisc = "";
    playersImplMisc1 = "";
    players = "";
    promotionsLibrary = "";
    promotions = "";
    passiveActions = "";
    instantActions = "";
    vrfRequestInfo = "";
    instantVRFActions = "";
    genericInstantVRFActionStrategy = "";
    eggInstantVRFActionStrategy = "";
    bankRelay = "";
    pvpBattleground = "";
    raids = "";
    clanBattleLibrary = "";
    lockedBankVaultsLibrary = "";
    lockedBankVaults = "";
    territories = "";
    combatantsHelper = "";
    territoryTreasury = "";
    bankRegistry = "";
    bankFactory = "";
  }
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
