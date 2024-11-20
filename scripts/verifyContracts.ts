import {upgrades} from "hardhat";
import {
  ADMIN_ACCESS_ADDRESS,
  ITEM_NFT_ADDRESS,
  PLAYERS_ADDRESS,
  PLAYERS_IMPL_MISC_ADDRESS,
  PLAYERS_IMPL_PROCESS_ACTIONS_ADDRESS,
  PLAYERS_IMPL_QUEUE_ACTIONS_ADDRESS,
  PLAYERS_IMPL_REWARDS_ADDRESS,
  PLAYERS_LIBRARY_ADDRESS,
  PLAYER_NFT_ADDRESS,
  ROYALTY_RECEIVER_ADDRESS,
  SHOP_ADDRESS,
  WORLD_LIBRARY_ADDRESS,
  WORLD_ADDRESS,
  QUESTS_ADDRESS,
  CLANS_ADDRESS,
  BANK_ADDRESS,
  BANK_REGISTRY_ADDRESS,
  BANK_FACTORY_ADDRESS,
  PROMOTIONS_ADDRESS,
  PLAYERS_IMPL_MISC1_ADDRESS,
  INSTANT_ACTIONS_ADDRESS,
  TERRITORY_TREASURY_ADDRESS,
  TERRITORIES_ADDRESS,
  LOCKED_BANK_VAULTS_ADDRESS,
  COMBATANTS_HELPER_ADDRESS,
  PROMOTIONS_LIBRARY_ADDRESS,
  ESTFOR_LIBRARY_ADDRESS,
  ITEM_NFT_LIBRARY_ADDRESS,
  INSTANT_VRF_ACTIONS_ADDRESS,
  VRF_REQUEST_INFO_ADDRESS,
  GENERIC_INSTANT_VRF_ACTION_STRATEGY_ADDRESS,
  PET_NFT_ADDRESS,
  PET_NFT_LIBRARY_ADDRESS,
  PASSIVE_ACTIONS_ADDRESS,
  EGG_INSTANT_VRF_ACTION_STRATEGY_ADDRESS,
  LOCKED_BANK_VAULTS_LIBRARY_ADDRESS,
  TREASURY_ADDRESS,
  BANK_RELAY_ADDRESS,
  BAZAAR_ADDRESS,
  PVP_BATTLEGROUND_ADDRESS,
  RAIDS_ADDRESS
} from "./contractAddresses";
import {verifyContracts} from "./utils";

async function main() {
  const addresses = [
    ESTFOR_LIBRARY_ADDRESS,
    WORLD_LIBRARY_ADDRESS,
    WORLD_ADDRESS,
    SHOP_ADDRESS,
    ROYALTY_RECEIVER_ADDRESS,
    ADMIN_ACCESS_ADDRESS,
    ITEM_NFT_ADDRESS,
    ITEM_NFT_LIBRARY_ADDRESS,
    BAZAAR_ADDRESS,
    PLAYER_NFT_ADDRESS,
    PLAYERS_LIBRARY_ADDRESS,
    CLANS_ADDRESS,
    PROMOTIONS_ADDRESS,
    PROMOTIONS_LIBRARY_ADDRESS,
    QUESTS_ADDRESS,
    BANK_ADDRESS,
    await upgrades.beacon.getImplementationAddress(BANK_ADDRESS),
    BANK_REGISTRY_ADDRESS,
    BANK_FACTORY_ADDRESS,
    BANK_RELAY_ADDRESS,
    PLAYERS_IMPL_QUEUE_ACTIONS_ADDRESS,
    PLAYERS_IMPL_PROCESS_ACTIONS_ADDRESS,
    PLAYERS_IMPL_REWARDS_ADDRESS,
    PLAYERS_IMPL_MISC_ADDRESS,
    PLAYERS_IMPL_MISC1_ADDRESS,
    PLAYERS_ADDRESS,
    INSTANT_ACTIONS_ADDRESS,
    INSTANT_VRF_ACTIONS_ADDRESS,
    GENERIC_INSTANT_VRF_ACTION_STRATEGY_ADDRESS,
    EGG_INSTANT_VRF_ACTION_STRATEGY_ADDRESS,
    VRF_REQUEST_INFO_ADDRESS,
    TERRITORY_TREASURY_ADDRESS,
    TERRITORIES_ADDRESS,
    LOCKED_BANK_VAULTS_LIBRARY_ADDRESS,
    LOCKED_BANK_VAULTS_ADDRESS,
    COMBATANTS_HELPER_ADDRESS,
    PET_NFT_ADDRESS,
    PET_NFT_LIBRARY_ADDRESS,
    PASSIVE_ACTIONS_ADDRESS,
    TREASURY_ADDRESS,
    PVP_BATTLEGROUND_ADDRESS,
    RAIDS_ADDRESS
  ];

  await verifyContracts(addresses);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
