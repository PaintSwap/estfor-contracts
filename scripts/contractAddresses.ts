import {isBeta} from "./utils";

let brush;
let wftm;
let oracle;
let samWitchVRF;
let router;
let paintSwapMarketplaceWhitelist;
let paintSwapDecorator;
let worldLibrary;
let world;
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

if (!isBeta) {
  brush = "0x85dec8c4B2680793661bCA91a8F129607571863d";
  wftm = "0x000000000000000000000000000000000000dEaD";
  oracle = "0x28ade840602d0363a2ab675479f1b590b23b0490";
  samWitchVRF = "0xeF5AC0489fc8ABC1085E8D1f5BEE85e74E6D2cC2";
  router = "0x000000000000000000000000000000000000dEaD";
  paintSwapDecorator = "0x000000000000000000000000000000000000dEaD";
  paintSwapMarketplaceWhitelist = "0x000000000000000000000000000000000000dEaD";
  worldLibrary = "0xcba2273a46649cc0ce76e69eb0bb05d9b699ca38";
  world = "0x28866bf156152966b5872bee39bc05b5b5eedb02";
  treasury = "0x000000000000000000000000000000000000dEaD";
  shop = "0x7fb574e4fbe876f751fec90e59686c2776df19f9";
  royaltyReceiver = "0xc3d53b81042454aa5fcf5c4e95de3e796dddb28b";
  adminAccess = "0xe63b7195b301b9313c9e337df4aceac436c3751e";
  itemNFTLibrary = "0x8d61639c830aaf82c8549c36e65a9aeef9a73b45";
  itemNFT = "0x4b9c90ebb1fa98d9724db46c4689994b46706f5a";
  estforLibrary = "0x804a530f41ecf0c40cd4e312a72e033c78a2c1fa";
  playerNFT = "0xb809ed839c691d465e2ec45e1bcb5e5aded50fb9";
  promotions = "0x7d1c598266Dd6Bb0Ed7a76161c11e5073D8A71A4";
  promotionsLibrary = "0x5494e6a699e8e59e9a6ec3031ab96e35f2476c95";
  quests = "0x17c59f0d2d4f80FD0F906Df53a28272736c7b455";
  clans = "0x334caa8907bdf49470f7b085380c25431ef96f6d";
  wishingWell = "0x0a8d80ce4855666b7d7121d75f2a49aac434a918";
  bank = "0xe183a43881eac74808c55bdb2a073929602af4db"; // beacon
  playersLibrary = "0xfd0145ef3585176345cf8f2c63e025049f689073";
  playersImplQueueActions = "0x0776fd8b445e272b718db2db13f500d4d31b5de6";
  playersImplProcessActions = "0xb041035dbb95eac6011c5ef3cdd8a355fcb68700";
  playersImplRewards = "0x139bb2ac01597c7b4e6157aba6a4b3db1620014d";
  playersImplMisc = "0xf2136389a8e829da6a399b58ad56999d99e7cef7";
  playersImplMisc1 = "0x971703455f101d1d81d71e82a9ba895446c1183f";
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
  petNFTLibrary = "0x5a134487df2d8e216e34bf9407bd63cd80e76957";
  petNFT = "0x1681f593ac5cba407c2a190de0ca2beb4a69b5d3";
  passiveActions = "0xa3e3a69edaee89b8dbbd1ca37704cc574cb8e1d4";
} else {
  brush = "0x812e6844779eaade4bc2be26bc968570ce09caab";
  wftm = "0x591e027153ed4e536275984e1b7573367e11dac4";
  oracle = "0x6f7911cbbd4b5a1d2bdaa817a76056e510d728e7";
  samWitchVRF = "0x68db5ba48ad5ca5ee1620a9aee8eec9ccd1cfc95";
  router = "0xf08413857af2cfbb6edb69a92475cc27ea51453b";
  paintSwapDecorator = "0xcd375b4aa427dcaf46ff79b1786c4ec7a59df623";
  paintSwapMarketplaceWhitelist = "0xe018ef943aa710d4a0a81788641ec1898aeb84d1";
  worldLibrary = "0x173ebfdb24721317ef6afa47ec301d6e0432a0d5";
  world = "0x01b7e0b11c8592bf82e17b0983c2b63b1d6903f7";
  treasury = "0x84527c02bb28ce7c32ca4182ad0541a2a9a561d2";
  shop = "0x575f595552132377d62e53701116d286f694b5e9";
  royaltyReceiver = "0x0053fa0665ee5f26d26325efb02295e448effc44";
  adminAccess = "0x7edab00d9bfdd58d77f8d6859ac6e56a7259e1d2";
  itemNFTLibrary = "0x92caeb247bb45d886f52f1f8cc5398fdca9625cf";
  itemNFT = "0xf548e81aab80d316d0dd1a9bcee7faa3e2d4bb30";
  bazaar = "0xb16fbc5251da4c4beadc685406ed2b2c5fa5f1a8";
  estforLibrary = "0xd9a81bdbf4d7595044883271fe5d30754d0602cf";
  playerNFT = "0xace4e33b6697412129c88075075f0725c78d838a";
  quests = "0xc47a523bb8de8fa22dcf4200221a73bbe087f337";
  clans = "0xe868b67670db6fe4ea434da68e1091c3f66b9424";
  wishingWell = "0xccb577401c4995db84363936beca5f5c0980b49c";
  bank = "0x79dcb75a0b7143db68d6461132731897325281d3";
  petNFTLibrary = "0x45286b2238688ce56f298ecd192506e2b56afcc2";
  petNFT = "0xf69b185b322f79903eb3f5df9aa16aa6e145a39c";
  playersLibrary = "0x518ebcf2be5c6679191c252df904416fb7dc0c4f";
  playersImplQueueActions = "0xa4de8981cc871e36a44a0a4620e44db41e7847c9";
  playersImplProcessActions = "0x137b8a2b8e8a0a33fd94f556fc966cd9bb6b4e18";
  playersImplRewards = "0x965cc7726de17be793cc6ce3c1c2d106ae5b7564";
  playersImplMisc = "0xffdb817d5326588c24a3dbe8a28dae0655de7617";
  playersImplMisc1 = "0x386b8d9ee31cdbf1d7a208f02047ef5880f9acbf";
  players = "0xcb21801e8c1c6b8886dc55eea8a52f18e88915ec";
  promotionsLibrary = "0x281b789bdbb2f55d41bef711e2ed99947fbbc0e8";
  promotions = "0x5484d20ab56cdffdecf9d4cbc0ac35f2c46179be";
  passiveActions = "0xa131c3bb3b2ab2c6d5e07f6dd2293e41a4b10352";
  instantActions = "0xf440155849da02f6e0971066dced7de0a05e9ac2";
  vrfRequestInfo = "0x7a8ce2c66107c34ec3a2e61ee7e8abdba6cb93ec";
  instantVRFActions = "0xba144ddba43d8f5566da9debc0479d6da0774754";
  genericInstantVRFActionStrategy = "0x437db293efbcff1ea98ab96513e4f112589c7011";
  eggInstantVRFActionStrategy = "0x57bec6ce77ed3c7a21ad46cac215c8f8ff4c7c21";
  bankRelay = "0x27d4ed29422ea0c682aadb025de8d960bdbbc664";
  clanBattleLibrary = "0xe2aea44416c633557232547c4c7b931742827c81";
  lockedBankVaultsLibrary = "0xd2ffdbec59d3d9ad369fa4ac9bfa3aed3469064a";
  lockedBankVaults = "0xa40cdc60a5940a566a604def0cba8b314fca0812";
  territories = "0xb30ce815afdf218759a1de5c09fa0d72bb54f5b2";
  combatantsHelper = "0xe1e0c88cc0d6694680ed27a2373ab012cf47225e";
  territoryTreasury = "0x7a0137071ed2922bf27d8ed1c4368930be0be52f";
  bankRegistry = "0xcb6881bf1ba6aa14990b02f3bca830eb8a3a0ed8";
  bankFactory = "0xa2d9052a7f2b833646dd209dd78824a5ddfb6f26";
}

export const WORLD_LIBRARY_ADDRESS = worldLibrary;
export const WORLD_ADDRESS = world;
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

export const WFTM_ADDRESS = wftm;
export const BRUSH_ADDRESS = brush;
export const DECORATOR_ADDRESS = paintSwapDecorator;
export const ROUTER_ADDRESS = router;
export const PAINTSWAP_MARKETPLACE_WHITELIST = paintSwapMarketplaceWhitelist;

// VRF
export const ORACLE_ADDRESS = oracle;
export const SAMWITCH_VRF_ADDRESS = samWitchVRF;

export const DEV_ADDRESS = "0x045eF160107eD663D10c5a31c7D2EC5527eea1D0";
