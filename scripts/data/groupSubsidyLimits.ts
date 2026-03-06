import {
  BANK_RELAY_ADDRESS,
  BAZAAR_ADDRESS,
  BLACK_MARKET_TRADER_ADDRESS,
  BRUSH_ADDRESS,
  CLANS_ADDRESS,
  COMBATANTS_HELPER_ADDRESS,
  COSMETICS_ADDRESS,
  GLOBAL_EVENT_ADDRESS,
  INSTANT_ACTIONS_ADDRESS,
  INSTANT_VRF_ACTIONS_ADDRESS,
  ITEM_NFT_ADDRESS,
  LOCKED_BANK_VAULTS_ADDRESS,
  MARKETPLACE_ADDRESS,
  PASSIVE_ACTIONS_ADDRESS,
  PET_NFT_ADDRESS,
  PLAYER_NFT_ADDRESS,
  PLAYERS_ADDRESS,
  PROMOTIONS_ADDRESS,
  RANDOMNESS_BEACON_ADDRESS,
  SHOP_ADDRESS,
  TERRITORIES_ADDRESS,
  TERRITORY_TREASURY_ADDRESS,
} from "../contractAddresses";
import {
  BankRelay__factory,
  BlackMarketTrader__factory,
  Clans__factory,
  CombatantsHelper__factory,
  Cosmetics__factory,
  GlobalEvents__factory,
  InstantActions__factory,
  InstantVRFActions__factory,
  ItemNFT__factory,
  LockedBankVaults__factory,
  Marketplace__factory,
  OrderBook__factory,
  PassiveActions__factory,
  PetNFT__factory,
  PlayerNFT__factory,
  Players__factory,
  Promotions__factory,
  RandomnessBeacon__factory,
  Shop__factory,
  Territories__factory,
  TerritoryTreasury__factory,
} from "../../typechain-types";
import {ethers} from "hardhat";

const playerNFTIface = PlayerNFT__factory.createInterface();
const cosmeticIface = Cosmetics__factory.createInterface();
const shopIface = Shop__factory.createInterface();
const playersIface = Players__factory.createInterface();
const globalEventsIface = GlobalEvents__factory.createInterface();
const blackMarketTraderIface = BlackMarketTrader__factory.createInterface();
const clansIface = Clans__factory.createInterface();
const bankRelayIface = BankRelay__factory.createInterface();
const lockedVaultsIface = LockedBankVaults__factory.createInterface();
const territoryIface = Territories__factory.createInterface();
const territoryTreasuryIface = TerritoryTreasury__factory.createInterface();
const petNFTIface = PetNFT__factory.createInterface();
const itemNFTIface = ItemNFT__factory.createInterface();
const instantActionsIface = InstantActions__factory.createInterface();
const instantVRFActionsIface = InstantVRFActions__factory.createInterface();
const passiveActionsIface = PassiveActions__factory.createInterface();
const marketPlaceIface = Marketplace__factory.createInterface();
const randomnessBeaconIface = RandomnessBeacon__factory.createInterface();
const orderbookIface = OrderBook__factory.createInterface();
const combatantsHelperIface = CombatantsHelper__factory.createInterface();
const promotionsIface = Promotions__factory.createInterface();
const brushMinimalAbi = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function transfer(address to, uint256 amount) external",
  "function transferFromBulk(address from, address[] calldata tos, uint256[] calldata amounts) external",
  "function transferBulk(address[] calldata tos, uint256[] calldata amounts) external",
];
const brushIface = new ethers.Interface(brushMinimalAbi);

export const groups = [
  {
    groupId: 1, // Minting group
    limit: 1,
    selectors: [
      {
        groupId: 1,
        contract: PLAYER_NFT_ADDRESS,
        selector: playerNFTIface.getFunction("mint").selector,
      },
    ],
  },
  {
    groupId: 2, // Edit player and cosmetics group
    limit: 5,
    selectors: [
      {
        groupId: 2,
        contract: PLAYER_NFT_ADDRESS,
        selector: playerNFTIface.getFunction("editPlayer").selector,
      },
      {
        groupId: 2,
        contract: COSMETICS_ADDRESS,
        selector: cosmeticIface.getFunction("applyCosmetic").selector,
      },
      {
        groupId: 2,
        contract: COSMETICS_ADDRESS,
        selector: cosmeticIface.getFunction("removeCosmetic").selector,
      },
      {
        groupId: 2,
        contract: PLAYER_NFT_ADDRESS,
        selector: playerNFTIface.getFunction("setApprovalForAll").selector,
      },
      {
        groupId: 2,
        contract: PLAYER_NFT_ADDRESS,
        selector: playerNFTIface.getFunction("safeTransferFrom").selector,
      },
      {
        groupId: 2,
        contract: PLAYER_NFT_ADDRESS,
        selector: playerNFTIface.getFunction("safeBatchTransferFrom").selector,
      },
    ],
  },
  {
    groupId: 3, // Shop buy and sell group
    limit: 10,
    selectors: [
      {
        groupId: 3,
        contract: SHOP_ADDRESS,
        selector: shopIface.getFunction("buy").selector,
      },
      {
        groupId: 3,
        contract: SHOP_ADDRESS,
        selector: shopIface.getFunction("buyBatch").selector,
      },
      {
        groupId: 3,
        contract: SHOP_ADDRESS,
        selector: shopIface.getFunction("sell").selector,
      },
      {
        groupId: 3,
        contract: SHOP_ADDRESS,
        selector: shopIface.getFunction("sellBatch").selector,
      },
    ],
  },
  {
    groupId: 4, // Players group
    limit: 10,
    selectors: [
      {
        groupId: 4,
        contract: PLAYERS_ADDRESS,
        selector: playersIface.getFunction("activateQuest").selector,
      },
      {
        groupId: 4,
        contract: PLAYERS_ADDRESS,
        selector: playersIface.getFunction("setActivePlayer").selector,
      },
      {
        groupId: 4,
        contract: PLAYERS_ADDRESS,
        selector: playersIface.getFunction("deactivateQuest").selector,
      },
      {
        groupId: 4,
        contract: PLAYERS_ADDRESS,
        selector: playersIface.getFunction("processActions").selector,
      },
      {
        groupId: 4,
        contract: PLAYERS_ADDRESS,
        selector: playersIface.getFunction("startActionsAdvanced").selector,
      },
      {
        groupId: 4,
        contract: PLAYERS_ADDRESS,
        selector: playersIface.getFunction("startActions").selector,
      },
      {
        groupId: 4,
        contract: PLAYERS_ADDRESS,
        selector: playersIface.getFunction("buyBrushQuest").selector,
      },
      {
        groupId: 4,
        contract: PASSIVE_ACTIONS_ADDRESS,
        selector: passiveActionsIface.getFunction("startAction").selector,
      },
      {
        groupId: 4,
        contract: PASSIVE_ACTIONS_ADDRESS,
        selector: passiveActionsIface.getFunction("endEarly").selector,
      },
      {
        groupId: 4,
        contract: PASSIVE_ACTIONS_ADDRESS,
        selector: passiveActionsIface.getFunction("claim").selector,
      },
      {
        groupId: 4,
        contract: RANDOMNESS_BEACON_ADDRESS,
        selector: randomnessBeaconIface.getFunction("requestRandomWords").selector,
      },
      {
        groupId: 4,
        contract: PLAYERS_ADDRESS,
        selector: playersIface.getFunction("donate").selector,
      },
    ],
  },
  {
    groupId: 5, // Global events group
    limit: 10,
    selectors: [
      {
        groupId: 5,
        contract: GLOBAL_EVENT_ADDRESS,
        selector: globalEventsIface.getFunction("contribute").selector,
      },
      {
        groupId: 5,
        contract: BLACK_MARKET_TRADER_ADDRESS,
        selector: blackMarketTraderIface.getFunction("buy").selector,
      },
      {
        groupId: 5,
        contract: BLACK_MARKET_TRADER_ADDRESS,
        selector: blackMarketTraderIface.getFunction("initialiseShopItemsForEvent").selector,
      },
    ],
  },
  {
    groupId: 6, // Clans group
    limit: 10,
    selectors: [
      {
        groupId: 6,
        contract: CLANS_ADDRESS,
        selector: clansIface.getFunction("acceptInvite").selector,
      },
      {
        groupId: 6,
        contract: CLANS_ADDRESS,
        selector: clansIface.getFunction("acceptJoinRequests").selector,
      },
      {
        groupId: 6,
        contract: CLANS_ADDRESS,
        selector: clansIface.getFunction("changeRank").selector,
      },
      {
        groupId: 6,
        contract: CLANS_ADDRESS,
        selector: clansIface.getFunction("changeRanks").selector,
      },
      {
        groupId: 6,
        contract: CLANS_ADDRESS,
        selector: clansIface.getFunction("claimOwnership").selector,
      },
      {
        groupId: 6,
        contract: CLANS_ADDRESS,
        selector: clansIface.getFunction("createClan").selector,
      },
      {
        groupId: 6,
        contract: CLANS_ADDRESS,
        selector: clansIface.getFunction("deleteInvitesAsClan").selector,
      },
      {
        groupId: 6,
        contract: CLANS_ADDRESS,
        selector: clansIface.getFunction("deleteInvitesAsPlayer").selector,
      },
      {
        groupId: 6,
        contract: CLANS_ADDRESS,
        selector: clansIface.getFunction("editClan").selector,
      },
      {
        groupId: 6,
        contract: CLANS_ADDRESS,
        selector: clansIface.getFunction("gateKeep").selector,
      },
      {
        groupId: 6,
        contract: CLANS_ADDRESS,
        selector: clansIface.getFunction("inviteMembers").selector,
      },
      {
        groupId: 6,
        contract: CLANS_ADDRESS,
        selector: clansIface.getFunction("pinMessage").selector,
      },
      {
        groupId: 6,
        contract: CLANS_ADDRESS,
        selector: clansIface.getFunction("removeJoinRequest").selector,
      },
      {
        groupId: 6,
        contract: CLANS_ADDRESS,
        selector: clansIface.getFunction("removeJoinRequestsAsClan").selector,
      },
      {
        groupId: 6,
        contract: CLANS_ADDRESS,
        selector: clansIface.getFunction("requestToJoin").selector,
      },
      {
        groupId: 6,
        contract: CLANS_ADDRESS,
        selector: clansIface.getFunction("upgradeClan").selector,
      },
    ],
  },
  {
    groupId: 7, // Clan bank group
    limit: 20,
    selectors: [
      {
        groupId: 7,
        contract: BANK_RELAY_ADDRESS,
        selector: bankRelayIface.getFunction("depositItems").selector,
      },
      {
        groupId: 7,
        contract: BANK_RELAY_ADDRESS,
        selector: bankRelayIface.getFunction("withdrawItems").selector,
      },
      {
        groupId: 7,
        contract: BANK_RELAY_ADDRESS,
        selector: bankRelayIface.getFunction("withdrawItemsBulk").selector,
      },
      {
        groupId: 7,
        contract: BANK_RELAY_ADDRESS,
        selector: bankRelayIface.getFunction("depositToken").selector,
      },
      {
        groupId: 7,
        contract: BANK_RELAY_ADDRESS,
        selector: bankRelayIface.getFunction("withdrawToken").selector,
      },
      {
        groupId: 7,
        contract: BANK_RELAY_ADDRESS,
        selector: bankRelayIface.getFunction("withdrawTokenToMany").selector,
      },
      {
        groupId: 7,
        contract: BANK_RELAY_ADDRESS,
        selector: bankRelayIface.getFunction("withdrawItemsAtBank").selector,
      },
      {
        groupId: 7,
        contract: BANK_RELAY_ADDRESS,
        selector: bankRelayIface.getFunction("withdrawItemsBulkAtBank").selector,
      },
      {
        groupId: 7,
        contract: BANK_RELAY_ADDRESS,
        selector: bankRelayIface.getFunction("withdrawTokenToManyAtBank").selector,
      },
    ],
  },
  {
    groupId: 8, // Territory treasury group
    limit: 3,
    selectors: [
      {
        groupId: 8,
        contract: TERRITORY_TREASURY_ADDRESS,
        selector: territoryTreasuryIface.getFunction("harvest").selector,
      },
    ],
  },
  {
    groupId: 9, // Territory group
    limit: 5,
    selectors: [
      {
        groupId: 9,
        contract: TERRITORIES_ADDRESS,
        selector: territoryIface.getFunction("assignCombatants").selector,
      },
      {
        groupId: 9,
        contract: TERRITORIES_ADDRESS,
        selector: territoryIface.getFunction("attackTerritory").selector,
      },
      {
        groupId: 9,
        contract: TERRITORIES_ADDRESS,
        selector: territoryIface.getFunction("blockAttacks").selector,
      },
      {
        groupId: 9,
        contract: TERRITORIES_ADDRESS,
        selector: territoryIface.getFunction("harvest").selector,
      },
    ],
  },
  {
    groupId: 10, // Locked Bank Vault group
    limit: 8,
    selectors: [
      {
        groupId: 10,
        contract: COMBATANTS_HELPER_ADDRESS,
        selector: combatantsHelperIface.getFunction("assignCombatants").selector,
      },
      {
        groupId: 10,
        contract: LOCKED_BANK_VAULTS_ADDRESS,
        selector: lockedVaultsIface.getFunction("assignCombatants").selector,
      },
      {
        groupId: 10,
        contract: LOCKED_BANK_VAULTS_ADDRESS,
        selector: lockedVaultsIface.getFunction("attackVaults").selector,
      },
      {
        groupId: 10,
        contract: LOCKED_BANK_VAULTS_ADDRESS,
        selector: lockedVaultsIface.getFunction("blockAttacks").selector,
      },
      {
        groupId: 10,
        contract: LOCKED_BANK_VAULTS_ADDRESS,
        selector: lockedVaultsIface.getFunction("claimFunds").selector,
      },
    ],
  },
  {
    groupId: 11, // Pet NFT group
    limit: 5,
    selectors: [
      {
        groupId: 11,
        contract: PET_NFT_ADDRESS,
        selector: petNFTIface.getFunction("assignPet").selector,
      },
      {
        groupId: 11,
        contract: PET_NFT_ADDRESS,
        selector: petNFTIface.getFunction("editPet").selector,
      },
      {
        groupId: 11,
        contract: PET_NFT_ADDRESS,
        selector: petNFTIface.getFunction("setApprovalForAll").selector,
      },
      {
        groupId: 11,
        contract: PET_NFT_ADDRESS,
        selector: petNFTIface.getFunction("safeTransferFrom").selector,
      },
      {
        groupId: 11,
        contract: PET_NFT_ADDRESS,
        selector: petNFTIface.getFunction("safeBatchTransferFrom").selector,
      },
    ],
  },
  {
    groupId: 12, // Item NFT group
    limit: 5,
    selectors: [
      {
        groupId: 12,
        contract: ITEM_NFT_ADDRESS,
        selector: itemNFTIface.getFunction("safeBatchTransferFrom").selector,
      },
      {
        groupId: 12,
        contract: ITEM_NFT_ADDRESS,
        selector: itemNFTIface.getFunction("safeBulkTransfer").selector,
      },
      {
        groupId: 12,
        contract: ITEM_NFT_ADDRESS,
        selector: itemNFTIface.getFunction("safeTransferFrom").selector,
      },
      {
        groupId: 12,
        contract: ITEM_NFT_ADDRESS,
        selector: itemNFTIface.getFunction("setApprovalForAll").selector,
      },
    ],
  },
  {
    groupId: 13, // Instant Actions group
    limit: 20,
    selectors: [
      {
        groupId: 13,
        contract: INSTANT_ACTIONS_ADDRESS,
        selector: instantActionsIface.getFunction("doInstantActions").selector,
      },
      {
        groupId: 13,
        contract: INSTANT_VRF_ACTIONS_ADDRESS,
        selector: instantVRFActionsIface.getFunction("doInstantVRFActions").selector,
      },
    ],
  },
  {
    groupId: 14, // Marketplace group
    limit: 20,
    selectors: [
      {
        groupId: 14,
        contract: MARKETPLACE_ADDRESS,
        selector: marketPlaceIface.getFunction("buy").selector,
      },
      {
        groupId: 14,
        contract: MARKETPLACE_ADDRESS,
        selector: marketPlaceIface.getFunction("cancel").selector,
      },
      {
        groupId: 14,
        contract: MARKETPLACE_ADDRESS,
        selector: marketPlaceIface.getFunction("list").selector,
      },
    ],
  },
  {
    groupId: 15, // Order Book group
    limit: 50,
    selectors: [
      {
        groupId: 15,
        contract: BAZAAR_ADDRESS,
        selector: orderbookIface.getFunction("cancelAndMakeLimitOrders").selector,
      },
      {
        groupId: 15,
        contract: BAZAAR_ADDRESS,
        selector: orderbookIface.getFunction("cancelOrders").selector,
      },
      {
        groupId: 15,
        contract: BAZAAR_ADDRESS,
        selector: orderbookIface.getFunction("claimAll").selector,
      },
      {
        groupId: 15,
        contract: BAZAAR_ADDRESS,
        selector: orderbookIface.getFunction("claimNFTs").selector,
      },
      {
        groupId: 15,
        contract: BAZAAR_ADDRESS,
        selector: orderbookIface.getFunction("claimTokens").selector,
      },
      {
        groupId: 15,
        contract: BAZAAR_ADDRESS,
        selector: orderbookIface.getFunction("limitOrders").selector,
      },
      {
        groupId: 15,
        contract: BAZAAR_ADDRESS,
        selector: orderbookIface.getFunction("marketOrder").selector,
      },
    ],
  },
  {
    groupId: 16, // Brush ERC20 group
    limit: 10,
    selectors: [
      {
        groupId: 16,
        contract: BRUSH_ADDRESS,
        selector: brushIface.getFunction("approve")!.selector,
      },
      {
        groupId: 16,
        contract: BRUSH_ADDRESS,
        selector: brushIface.getFunction("transfer")!.selector,
      },
      {
        groupId: 16,
        contract: BRUSH_ADDRESS,
        selector: brushIface.getFunction("transferFromBulk")!.selector,
      },
      {
        groupId: 16,
        contract: BRUSH_ADDRESS,
        selector: brushIface.getFunction("transferBulk")!.selector,
      },
    ],
  },
  {
    groupId: 17, // Promotions group
    limit: 5,
    selectors: [
      {
        groupId: 17,
        contract: PROMOTIONS_ADDRESS,
        selector: promotionsIface.getFunction("payMissedPromotionDays")!.selector,
      },
      {
        groupId: 17,
        contract: PROMOTIONS_ADDRESS,
        selector: promotionsIface.getFunction("mintPromotion")!.selector,
      },
    ],
  },
];
