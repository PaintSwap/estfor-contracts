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
let instantVRFActions;
let vrfRequestInfo;
let genericInstantVRFActionStrategy;
let eggInstantVRFActionStrategy;
let territories;
let lockedBankVaults;
let lockedBankVaultsLibrary;
let decoratorProvider;
let combatantsHelper;
let oracle;
let samWitchVRF;
let bazaar;
let petNFTLibrary;
let petNFT;
let passiveActions;

if (!isBeta) {
  worldLibrary = "0xcba2273a46649cc0ce76e69eb0bb05d9b699ca38";
  world = "0x28866bf156152966b5872bee39bc05b5b5eedb02";
  shop = "0x7fb574e4fbe876f751fec90e59686c2776df19f9";
  royaltyReceiver = "0xc3d53b81042454aa5fcf5c4e95de3e796dddb28b";
  adminAccess = "0xe63b7195b301b9313c9e337df4aceac436c3751e";
  itemNFTLibrary = "0x8d61639c830aaf82c8549c36e65a9aeef9a73b45";
  itemNFT = "0x4b9c90ebb1fa98d9724db46c4689994b46706f5a";
  estforLibrary = "0x8213fCAD73187A1A4d4cf9a44BF87d919Ca32970";
  playerNFT = "0xb809ed839c691d465e2ec45e1bcb5e5aded50fb9";
  promotions = "0x7d1c598266Dd6Bb0Ed7a76161c11e5073D8A71A4";
  promotionsLibrary = "0x5494e6a699e8e59e9a6ec3031ab96e35f2476c95";
  quests = "0x17c59f0d2d4f80FD0F906Df53a28272736c7b455";
  clans = "0x334caa8907bdf49470f7b085380c25431ef96f6d";
  wishingWell = "0x0a8d80ce4855666b7d7121d75f2a49aac434a918";
  bank = "0xe183a43881eac74808c55bdb2a073929602af4db"; // beacon
  playersLibrary = "0x05dc512b2c33c5e68c8fad0badf8a4a0b12d0439";
  playersImplQueueActions = "0x2e4f7dc35d8a75a9803b81f46d3981b421908335";
  playersImplProcessActions = "0x2b009d7cd481905b93a3ce37ce0c85dde1e90bfd";
  playersImplRewards = "0x8e0f5306ae180a16bdcbeae3fae66abd63875887";
  playersImplMisc = "0x8f2c176942525838f9d545bb672db74f7500a6f8";
  playersImplMisc1 = "0xfec3016434983daffca8795126f6097a7ce1d311";
  players = "0x058ec56aba13f7fee3ae9c9b91b3bb03bc336143";
  bankRegistry = "0x55a1b0251e1375bd41dd9778c379322e3863a54e";
  bankFactory = "0x4af59427b2aeb66e6f7dca98c366ec66cca4e8d4";
  instantActions = "0x7e89fe755b546b10ea8372b056ea0d7b26cf36fe";
  instantVRFActions = "0xfe2c07fd7751bba25164adbd96e09b382403f4d7";
  vrfRequestInfo = "0x8c3dcf7b09ea620b265d9daab237f29f485f725b";
  genericInstantVRFActionStrategy = "0x6270b82049724ff6d7a78b71f2273bba03bfcdfc";
  eggInstantVRFActionStrategy = "0x7797fd3904fc399184d2a549dff025210d62e645";
  lockedBankVaults = "0x65e944795d00cc287bdace77d57571fc4deff3e0";
  lockedBankVaultsLibrary = "TODO";
  territories = "0x2cfd3b9f8b595200d6b4b7f667b2a1bcc6d0c170";
  combatantsHelper = "0x8fedf83c55012acff7115b8fa164095721953c39";
  decoratorProvider = "0xba2f8cff9ea18f3687eb685f0c1bcd509b539963";
  oracle = "0x28ade840602d0363a2ab675479f1b590b23b0490";
  samWitchVRF = "0xeF5AC0489fc8ABC1085E8D1f5BEE85e74E6D2cC2";
  bazaar = "0x6996c519dA4ac7815bEFbd836cf0b78Aa62fdBcE";
  petNFTLibrary = "0xf842b81350e8ac973bf7c7f32183cc1e1545e76d";
  petNFT = "0x1681f593ac5cba407c2a190de0ca2beb4a69b5d3";
  passiveActions = "0xa3e3a69edaee89b8dbbd1ca37704cc574cb8e1d4";
} else {
  worldLibrary = "0xdc881c1b3b7f5143c3f4d59543c0667c6bd1bcd4";
  world = "0xe2f0b5cb118da85be68de1801d40726ce48009aa";
  shop = "0xc5e24fbaba1a945226ad2f882e14fc7b44dc1f30";
  royaltyReceiver = "0xc5de7625e1b5cb91d92bc65fd4d787f01c43e38e";
  adminAccess = "0xa298f1636dacab0db352fec84d2079814e0ce778";
  itemNFTLibrary = "0x2d0b79a4d76d6fd86b8ba08acc68d3f35430aa7a";
  itemNFT = "0x1dae89b469d15b0ded980007dfdc8e68c363203d";
  estforLibrary = "0xAD4Fe5A1d43F986659F548Cc899dCD4045FA9974";
  playerNFT = "0xde70e49756322afdf7714d3aca963abcb4547b8d";
  promotions = "0xf28cab48e29be56fcc68574b5c147b780c35647c";
  promotionsLibrary = "0x684c6e254df63b9d5a28b29b7e4d0850d158f9f9";
  quests = "0x96948a6df3a64cc2eb0a1825fccd26f0c93bfce9";
  clans = "0xd35410f526db135f09bb8e2bb066c8a63135d812";
  wishingWell = "0xdd1131f57e5e416622fa2b61d4108822e8cc38dc";
  bank = "0x73d1b1420deaeb6474b8aafb1d8229d392d1a04e";
  playersLibrary = "0x0abc509929f6bfc27938f3709caf333bbae716cf";
  playersImplQueueActions = "0xbbe4d7d9027e22562386cb794c618cde55ef04be";
  playersImplProcessActions = "0xb42935f9a62dc3c6f6898d54400b8c6b68a29f22";
  playersImplRewards = "0x45cac1133b81181af3d0543c33a3e7c568579592";
  playersImplMisc = "0x55919fc7193d8c5fa409a1d2437ecda0eb395f17";
  playersImplMisc1 = "0xae72aebfdd87f74aa9409ada0f64a6d9d41a2ec8";
  players = "0x0aac9c0966ad5ea59cd0a47a0d415a68126ab7be";
  bankRegistry = "0xd5da02cee3d9ef0d63d1b79c659df16770c3c4e0";
  //  const bankProxy = "0xe1998e9bad94716ecf81f3a3bead5fed3fb023cb";  // Only used for old beta clans
  bankFactory = "0x7b8197e7d7352e8910a7af79a9184f50290403da";
  instantActions = "0xe9a1a09be4a64f806a26b33fbdf07a6f3e61af76";
  instantVRFActions = "0xbbcc13d2359ad6f2c02e172de46097a1c534ef89";
  vrfRequestInfo = "0x9bcf94e6c067c575dd6a748e45330b4ae4dc0483";
  genericInstantVRFActionStrategy = "0xc4c92d3987cc0bad3219e696653eb87eddda78c6";
  eggInstantVRFActionStrategy = "0x941369948CC8a4b5b8eFb1F688Eddfe26A736039";
  lockedBankVaults = "0x40567ad9cd25c56422807ed67f0e66f1825bdb91";
  lockedBankVaultsLibrary = "0x6b83db9a324190046d83a180286f593ded02b53c";
  territories = "0xf31517db9f0987002f3a0fb4f787dfb9e892f184";
  decoratorProvider = "0xea8c4d188eb8d9704bc36931d89ba4f8e935cee2";
  combatantsHelper = "0xe8231ac805a88b3c72e9602c2ae14a5d3421bc7c";
  oracle = "0x6f7911cbbd4b5a1d2bdaa817a76056e510d728e7";
  samWitchVRF = "0x58E9fd2Fae18c861B9F564200510A88106C05756";
  bazaar = "0x082480aAAF1ac5bb0Db2c241eF8b4230Da85E191";
  petNFTLibrary = "0x7b84ff0313ef08ddee716cf3430b9ab1204d76bc";
  petNFT = "0xa6489181b24e966402891225c65f8e2d136ddd2e";
  passiveActions = "0x3df5b6cad0d2de6b71f2d5084e0b933dbcd395f6";
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
export const INSTANT_VRF_ACTIONS_ADDRESS = instantVRFActions;
export const VRF_REQUEST_INFO_ADDRESS = vrfRequestInfo;
export const GENERIC_INSTANT_VRF_ACTION_STRATEGY_ADDRESS = genericInstantVRFActionStrategy;
export const EGG_INSTANT_VRF_ACTION_STRATEGY_ADDRESS = eggInstantVRFActionStrategy;

export const LOCKED_BANK_VAULTS_ADDRESS = lockedBankVaults;
export const LOCKED_BANK_VAULTS_LIBRARY_ADDRESS = lockedBankVaultsLibrary;
export const TERRITORIES_ADDRESS = territories;
export const DECORATOR_PROVIDER_ADDRESS = decoratorProvider;
export const COMBATANTS_HELPER_ADDRESS = combatantsHelper;

export const PET_NFT_LIBRARY_ADDRESS = petNFTLibrary;
export const PET_NFT_ADDRESS = petNFT;
export const PASSIVE_ACTIONS_ADDRESS = passiveActions;

// Only chain 250 (ftm)
export const BRUSH_ADDRESS = "0x85dec8c4B2680793661bCA91a8F129607571863d";
export const WFTM_ADDRESS = "0x21be370D5312f44cB42ce377BC9b8a0cEF1A4C83";
export const FAKE_BRUSH_ADDRESS = "0x8F85Ad0Ed1C6Cf23B82378efF7f71a7Df6A61071";
export const FAKE_BRUSH_WFTM_LP_ADDRESS = "0xb3209C979b90436f0a43ED817CD36c4c908604fD";
export const DECORATOR_ADDRESS = "0xCb80F529724B9620145230A0C866AC2FACBE4e3D";
export const DEV_ADDRESS = "0x045eF160107eD663D10c5a31c7D2EC5527eea1D0";
export const ORACLE_ADDRESS = oracle;
export const SAMWITCH_VRF_ADDRESS = samWitchVRF;
export const BAZAAR_ADDRESS = bazaar;
