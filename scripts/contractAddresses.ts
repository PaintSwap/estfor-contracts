import {getContractAddress, loadSelectedDeployment} from "./deploymentRegistry";

export const SELECTED_DEPLOYMENT = loadSelectedDeployment();

export const BRIDGE_ADDRESS = getContractAddress(SELECTED_DEPLOYMENT, "bridge");
export const WORLD_ACTIONS_ADDRESS = getContractAddress(SELECTED_DEPLOYMENT, "worldActions");
export const RANDOMNESS_BEACON_ADDRESS = getContractAddress(SELECTED_DEPLOYMENT, "randomnessBeacon");
export const DAILY_REWARDS_SCHEDULER_ADDRESS = getContractAddress(SELECTED_DEPLOYMENT, "dailyRewardsScheduler");
export const TREASURY_ADDRESS = getContractAddress(SELECTED_DEPLOYMENT, "treasury");
export const SHOP_ADDRESS = getContractAddress(SELECTED_DEPLOYMENT, "shop");
export const ROYALTY_RECEIVER_ADDRESS = getContractAddress(SELECTED_DEPLOYMENT, "royaltyReceiver");
export const ADMIN_ACCESS_ADDRESS = getContractAddress(SELECTED_DEPLOYMENT, "adminAccess");
export const ITEM_NFT_LIBRARY_ADDRESS = getContractAddress(SELECTED_DEPLOYMENT, "itemNFTLibrary");
export const ITEM_NFT_ADDRESS = getContractAddress(SELECTED_DEPLOYMENT, "itemNFT");

export const WISHING_WELL_ADDRESS = getContractAddress(SELECTED_DEPLOYMENT, "wishingWell");
export const PROMOTIONS_LIBRARY_ADDRESS = getContractAddress(SELECTED_DEPLOYMENT, "promotionsLibrary");
export const PROMOTIONS_ADDRESS = getContractAddress(SELECTED_DEPLOYMENT, "promotions");
export const QUESTS_ADDRESS = getContractAddress(SELECTED_DEPLOYMENT, "quests");
export const CLANS_ADDRESS = getContractAddress(SELECTED_DEPLOYMENT, "clans");
export const BANK_ADDRESS = getContractAddress(SELECTED_DEPLOYMENT, "bank");
export const BANK_REGISTRY_ADDRESS = getContractAddress(SELECTED_DEPLOYMENT, "bankRegistry");
export const BANK_FACTORY_ADDRESS = getContractAddress(SELECTED_DEPLOYMENT, "bankFactory");
export const BANK_RELAY_ADDRESS = getContractAddress(SELECTED_DEPLOYMENT, "bankRelay");

export const ESTFOR_LIBRARY_ADDRESS = getContractAddress(SELECTED_DEPLOYMENT, "estforLibrary");
export const PLAYER_NFT_ADDRESS = getContractAddress(SELECTED_DEPLOYMENT, "playerNFT");
export const PLAYERS_LIBRARY_ADDRESS = getContractAddress(SELECTED_DEPLOYMENT, "playersLibrary");
export const PLAYERS_IMPL_QUEUE_ACTIONS_ADDRESS = getContractAddress(SELECTED_DEPLOYMENT, "playersImplQueueActions");
export const PLAYERS_IMPL_PROCESS_ACTIONS_ADDRESS = getContractAddress(
  SELECTED_DEPLOYMENT,
  "playersImplProcessActions"
);
export const PLAYERS_IMPL_REWARDS_ADDRESS = getContractAddress(SELECTED_DEPLOYMENT, "playersImplRewards");
export const PLAYERS_IMPL_MISC_ADDRESS = getContractAddress(SELECTED_DEPLOYMENT, "playersImplMisc");
export const PLAYERS_IMPL_MISC1_ADDRESS = getContractAddress(SELECTED_DEPLOYMENT, "playersImplMisc1");
export const PLAYERS_ADDRESS = getContractAddress(SELECTED_DEPLOYMENT, "players");

export const INSTANT_ACTIONS_ADDRESS = getContractAddress(SELECTED_DEPLOYMENT, "instantActions");
export const INSTANT_VRF_ACTIONS_ADDRESS = getContractAddress(SELECTED_DEPLOYMENT, "instantVRFActions");
export const GENERIC_INSTANT_VRF_ACTION_STRATEGY_ADDRESS = getContractAddress(
  SELECTED_DEPLOYMENT,
  "genericInstantVRFActionStrategy"
);
export const EGG_INSTANT_VRF_ACTION_STRATEGY_ADDRESS = getContractAddress(
  SELECTED_DEPLOYMENT,
  "eggInstantVRFActionStrategy"
);

export const CLAN_BATTLE_LIBRARY_ADDRESS = getContractAddress(SELECTED_DEPLOYMENT, "clanBattleLibrary");
export const LOCKED_BANK_VAULTS_ADDRESS = getContractAddress(SELECTED_DEPLOYMENT, "lockedBankVaults");
export const LOCKED_BANK_VAULTS_LIBRARY_ADDRESS = getContractAddress(SELECTED_DEPLOYMENT, "lockedBankVaultsLibrary");
export const TERRITORIES_ADDRESS = getContractAddress(SELECTED_DEPLOYMENT, "territories");
export const TERRITORY_TREASURY_ADDRESS = getContractAddress(SELECTED_DEPLOYMENT, "territoryTreasury");
export const COMBATANTS_HELPER_ADDRESS = getContractAddress(SELECTED_DEPLOYMENT, "combatantsHelper");

export const PET_NFT_LIBRARY_ADDRESS = getContractAddress(SELECTED_DEPLOYMENT, "petNFTLibrary");
export const PET_NFT_ADDRESS = getContractAddress(SELECTED_DEPLOYMENT, "petNFT");
export const PASSIVE_ACTIONS_ADDRESS = getContractAddress(SELECTED_DEPLOYMENT, "passiveActions");
export const BAZAAR_ADDRESS = getContractAddress(SELECTED_DEPLOYMENT, "bazaar");
export const PVP_BATTLEGROUND_ADDRESS = getContractAddress(SELECTED_DEPLOYMENT, "pvpBattleground");
export const RAIDS_ADDRESS = getContractAddress(SELECTED_DEPLOYMENT, "raids");
export const ACTIVITY_POINTS_ADDRESS = getContractAddress(SELECTED_DEPLOYMENT, "activityPoints");

export const WFTM_ADDRESS = SELECTED_DEPLOYMENT.externals.wftm;
export const BRUSH_ADDRESS = SELECTED_DEPLOYMENT.externals.brush;
export const ROUTER_ADDRESS = SELECTED_DEPLOYMENT.externals.router;
export const PAINTSWAP_MARKETPLACE_WHITELIST_ADDRESS = SELECTED_DEPLOYMENT.externals.paintSwapMarketplaceWhitelist;
export const MARKETPLACE_ADDRESS = getContractAddress(SELECTED_DEPLOYMENT, "marketplace");
export const COSMETICS_ADDRESS = getContractAddress(SELECTED_DEPLOYMENT, "cosmetics");
export const USDC_ADDRESS = SELECTED_DEPLOYMENT.externals.usdc;
export const GLOBAL_EVENT_ADDRESS = getContractAddress(SELECTED_DEPLOYMENT, "globalEvent");
export const BLACK_MARKET_TRADER_ADDRESS = getContractAddress(SELECTED_DEPLOYMENT, "blackMarketTrader");
export const USAGE_BASED_SESSION_MODULE_ADDRESS = getContractAddress(SELECTED_DEPLOYMENT, "usageBasedSessionModule");
export const GAME_SUBSIDISATION_REGISTRY_ADDRESS = getContractAddress(SELECTED_DEPLOYMENT, "gameSubsidisationRegistry");
export const PET_NFT_REROLL_ADDRESS = getContractAddress(SELECTED_DEPLOYMENT, "petNFTReroll");
export const ORDERBOOK_V2_ADDRESS = getContractAddress(SELECTED_DEPLOYMENT, "orderbookV2");
export const SUBSIDY_SIGNERS = SELECTED_DEPLOYMENT.subsidySigners;

export const VRF_ADDRESS = SELECTED_DEPLOYMENT.externals.vrf;
export const DEV_ADDRESS = SELECTED_DEPLOYMENT.authority.address;
