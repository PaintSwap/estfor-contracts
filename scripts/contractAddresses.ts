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
let decoratorProvider;
let combatantsHelper;
let oracle;
let samWitchVRF;
let bazaar;
let petNFTLibrary;
let petNFT;
let passiveActions;

if (!isBeta) {
  worldLibrary = "0x7aa43aa55d7cc9c1ec5cbde71d841331e536c426";
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
  playersLibrary = "0xc6d48b3071099fb9a389d05b6e0fb504766f85fe";
  playersImplQueueActions = "0xbaec5f2ae77e3d829b65c7ca99bb9ced4565c794";
  playersImplProcessActions = "0x89b6f61de910328761e819d1068111e4ba010932";
  playersImplRewards = "0xd7b7a8e05e577ec6d44c519127832bdd413b4f91";
  playersImplMisc = "0x87e28f2107d20f963816e92b860b1d9d24cb35fe";
  playersImplMisc1 = "0x4094107b4a4ff215cdec4e9c61a0c9e046b6e687";
  players = "0x058ec56aba13f7fee3ae9c9b91b3bb03bc336143";
  bankRegistry = "0x55a1b0251e1375bd41dd9778c379322e3863a54e";
  bankFactory = "0x4af59427b2aeb66e6f7dca98c366ec66cca4e8d4";
  instantActions = "0x7e89fe755b546b10ea8372b056ea0d7b26cf36fe";
  instantVRFActions = "0xfe2c07fd7751bba25164adbd96e09b382403f4d7";
  vrfRequestInfo = "0x8c3dcf7b09ea620b265d9daab237f29f485f725b";
  genericInstantVRFActionStrategy = "0x6270b82049724ff6d7a78b71f2273bba03bfcdfc";
  eggInstantVRFActionStrategy = "0x4e9cbcb9ac26c80e55804535a5112ab54d77e75d"; // TODO
  lockedBankVaults = "0x65e944795d00cc287bdace77d57571fc4deff3e0";
  territories = "0x2cfd3b9f8b595200d6b4b7f667b2a1bcc6d0c170";
  combatantsHelper = "0x8fedf83c55012acff7115b8fa164095721953c39";
  decoratorProvider = "0xba2f8cff9ea18f3687eb685f0c1bcd509b539963";
  oracle = "0x28ade840602d0363a2ab675479f1b590b23b0490";
  samWitchVRF = "0xeF5AC0489fc8ABC1085E8D1f5BEE85e74E6D2cC2";
  bazaar = "0x6996c519dA4ac7815bEFbd836cf0b78Aa62fdBcE";
  petNFTLibrary = "0x4e9cbcb9ac26c80e55804535a5112ab54d77e75d"; // TODO
  petNFT = "0x4e9cbcb9ac26c80e55804535a5112ab54d77e75d"; // TODO
  passiveActions = "0x3df5b6cad0d2de6b71f2d5084e0b933dbcd395f6"; // TODO
} else {
  worldLibrary = "0x17581c8e57fcca1be58dc109b0e275f4c24eb50f";
  world = "0xe2f0b5cb118da85be68de1801d40726ce48009aa";
  shop = "0xc5e24fbaba1a945226ad2f882e14fc7b44dc1f30";
  royaltyReceiver = "0xc5de7625e1b5cb91d92bc65fd4d787f01c43e38e";
  adminAccess = "0xa298f1636dacab0db352fec84d2079814e0ce778";
  itemNFTLibrary = "0xd24b6994c179817391466372fb2a26440fcc0dd7";
  itemNFT = "0x1dae89b469d15b0ded980007dfdc8e68c363203d";
  estforLibrary = "0x52ecba8c563f686f9d7964a89fbc1956523ce105";
  playerNFT = "0xde70e49756322afdf7714d3aca963abcb4547b8d";
  promotions = "0xf28cab48e29be56fcc68574b5c147b780c35647c";
  promotionsLibrary = "0x684c6e254df63b9d5a28b29b7e4d0850d158f9f9";
  quests = "0x96948a6df3a64cc2eb0a1825fccd26f0c93bfce9";
  clans = "0xd35410f526db135f09bb8e2bb066c8a63135d812";
  wishingWell = "0xdd1131f57e5e416622fa2b61d4108822e8cc38dc";
  bank = "0x73d1b1420deaeb6474b8aafb1d8229d392d1a04e";
  playersLibrary = "0x227846c11f3bd29a2a0628cc6bb73b141a1e9614";
  playersImplQueueActions = "0x108413aa863a130b2ac1d604369097c4e23fac1a";
  playersImplProcessActions = "0xa8dba2a93e88b21fab8d4248c1fc04adf95f1d43";
  playersImplRewards = "0x8716228a74d157860697dd178786e191a4f0bf14";
  playersImplMisc = "0x861908dd206b236ea3ffbfc86cc8afd6a7078e5a";
  playersImplMisc1 = "0x40804aced48c6599d6417f4c9fb0c8a4fc0f3383";
  players = "0x0aac9c0966ad5ea59cd0a47a0d415a68126ab7be";
  bankRegistry = "0xd5da02cee3d9ef0d63d1b79c659df16770c3c4e0";
  //  const bankProxy = "0xe1998e9bad94716ecf81f3a3bead5fed3fb023cb";  // Only used for old beta clans
  bankFactory = "0x7b8197e7d7352e8910a7af79a9184f50290403da";
  instantActions = "0xe9a1a09be4a64f806a26b33fbdf07a6f3e61af76";
  instantVRFActions = "0xe297508ff83ba7a984ec8778ea67d82e049eda58";
  vrfRequestInfo = "0x9bcf94e6c067c575dd6a748e45330b4ae4dc0483";
  genericInstantVRFActionStrategy = "0x2ea7d26184188ec7495acaa84a7de1292e8a1794";
  eggInstantVRFActionStrategy = "0x141234B4071e2D40e24F69788522127658285a49";
  lockedBankVaults = "0x40567ad9cd25c56422807ed67f0e66f1825bdb91";
  territories = "0xf31517db9f0987002f3a0fb4f787dfb9e892f184";
  decoratorProvider = "0xea8c4d188eb8d9704bc36931d89ba4f8e935cee2";
  combatantsHelper = "0xe8231ac805a88b3c72e9602c2ae14a5d3421bc7c";
  oracle = "0x6f7911cbbd4b5a1d2bdaa817a76056e510d728e7";
  samWitchVRF = "0x58E9fd2Fae18c861B9F564200510A88106C05756";
  bazaar = "0x082480aAAF1ac5bb0Db2c241eF8b4230Da85E191";
  petNFTLibrary = "0x31e0988f0e565d2292c5a4361bfbf4551fcedc92";
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

export const LOCKED_BANK_VAULT_ADDRESS = lockedBankVaults;
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
