import {existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync} from "fs";
import {join} from "path";
import {Interface, getBytes, parseEther} from "ethers";
import {EstforConstants, EstforTypes} from "@paintswap/estfor-definitions";
import {ACTIVITY_TICKET2, SONIC_GEM_TICKET2, whitelistedAdmins} from "@paintswap/estfor-definitions/constants";

import {
  allActionChoicesAlchemy,
  allActionChoicesCooking,
  allActionChoicesCrafting,
  allActionChoicesFarming,
  allActionChoicesFiremaking,
  allActionChoicesFletching,
  allActionChoicesForging,
  allActionChoicesMagic,
  allActionChoicesMelee,
  allActionChoicesRanged,
  allActionChoicesSmithing,
} from "./data/actionChoices";
import {
  allActionChoiceIdsAlchemy,
  allActionChoiceIdsCooking,
  allActionChoiceIdsCrafting,
  allActionChoiceIdsFarming,
  allActionChoiceIdsFiremaking,
  allActionChoiceIdsFletching,
  allActionChoiceIdsForging,
  allActionChoiceIdsMagic,
  allActionChoiceIdsMelee,
  allActionChoiceIdsRanged,
  allActionChoiceIdsSmithing,
} from "./data/actionChoiceIds";
import {allActions} from "./data/actions";
import {avatarIds, avatarInfos} from "./data/avatars";
import {allClanTiersBeta} from "./data/clans";
import {cosmeticInfos, cosmeticTokenIds} from "./data/cosmetics";
import {allDailyRewards, allWeeklyRewards} from "./data/dailyRewards";
import {allFullAttireBonuses} from "./data/fullAttireBonuses";
import {allInstantActions} from "./data/instantActions";
import {allInstantVRFActions} from "./data/instantVRFActions";
import {allItems} from "./data/items";
import {allOrderBookTokenIdInfos} from "./data/orderbookTokenIdInfos";
import {allPassiveActions} from "./data/passiveActions";
import {allBasePets} from "./data/pets";
import {allQuests, allQuestsMinRequirements} from "./data/quests";
import {allBaseRaidIds, allBaseRaids} from "./data/raids";
import {allShopItemsBeta} from "./data/shopItems";
import {allBattleSkills, allMinimumMMRs, allTerritories} from "./data/territories";
import {allXPThresholdRewards} from "./data/xpThresholdRewards";

const OUTPUT_DIR = process.env.DEPLOY_DATA_DIR || ".forge-deploy-data";
const DEV = "0xC7073F6317813C3EDB09FA2d19A6cA259A9d4aD9";
const PROMOTIONAL_ADMIN = "0xe9fb52d7611e502d93af381ac493981b42d91974";
const CHUNK_SIZE = 100;
const PET_CHUNK_SIZE = 20;

type LinkReference = {start: number; length: number};
type JsonArtifact = {
  abi: object[];
  bytecode: {
    object: string;
    linkReferences: Record<string, Record<string, LinkReference[]>>;
  };
};
type Manifest = {
  calls: Record<string, number>;
  entries: Record<string, number>;
  representative: Record<string, number>;
};

const manifest: Manifest = {
  calls: {},
  entries: {},
  representative: {
    itemId: allItems[0].tokenId,
    actionId: allActions[0].actionId,
    actionChoiceActionId: EstforConstants.ACTION_FIREMAKING_ITEM,
    actionChoiceId: allActionChoiceIdsFiremaking[0],
    avatarId: avatarIds[0],
    cosmeticId: cosmeticTokenIds[0],
    questId: allQuests[0].questId,
    instantActionId: allInstantActions.find((action) => action.isAvailable)!.actionId,
    instantActionType: allInstantActions.find((action) => action.isAvailable)!.actionType,
    instantVRFActionId: allInstantVRFActions[0].actionId,
    passiveActionId: allPassiveActions[0].actionId,
    basePetId: allBasePets[0].baseId,
    orderbookTokenId: allOrderBookTokenIdInfos[0].tokenId,
    clanTierId: allClanTiersBeta[0].id,
    territoryId: allTerritories[0].territoryId,
    baseRaidId: allBaseRaidIds[0],
    shopItemId: allShopItemsBeta[0].tokenId,
    unsellableItemId: EstforConstants.INFUSED_ORICHALCUM_HELMET,
  },
};

function artifact(contractName: string): JsonArtifact {
  for (const directory of readdirSync("out")) {
    const path = join("out", directory, `${contractName}.json`);
    if (existsSync(path)) {
      return require(join(process.cwd(), path)) as JsonArtifact;
    }
  }
  throw new Error(`Foundry artifact not found for ${contractName}; run forge build first`);
}

function encode(contractName: string, functionName: string, args: unknown[]): string {
  return new Interface(artifact(contractName).abi).encodeFunctionData(functionName, args);
}

function writeBytes(relativePath: string, value: string): void {
  const path = join(OUTPUT_DIR, relativePath);
  mkdirSync(join(path, ".."), {recursive: true});
  writeFileSync(path, Buffer.from(getBytes(value)));
}

function writeCall(category: string, contractName: string, functionName: string, args: unknown[]): void {
  const index = manifest.calls[category] || 0;
  writeBytes(join("seed", `${category}-${index}.bin`), encode(contractName, functionName, args));
  manifest.calls[category] = index + 1;
}

function writeChunks(
  category: string,
  contractName: string,
  functionName: string,
  values: unknown[],
  chunkSize = CHUNK_SIZE
): void {
  for (let i = 0; i < values.length; i += chunkSize) {
    writeCall(category, contractName, functionName, [values.slice(i, i + chunkSize)]);
  }
  manifest.entries[category] = values.length;
}

// Runtime addresses are represented by conspicuous ABI address words. DeployBeta replaces
// placeholder(n) with the nth address supplied for that initializer.
function placeholder(index: number): string {
  return `0xf0000000000000000000000000000000000000${index.toString(16).padStart(2, "0")}`;
}

function writeInitializer(name: string, contractName: string, args: unknown[]): void {
  writeBytes(join("init", `${name}.bin`), encode(contractName, "initialize", args));
}

function prepareInitializers(): void {
  writeInitializer("bridge", "Bridge", [30112]);
  writeInitializer("worldActions", "WorldActions", []);
  writeInitializer("randomnessBeacon", "RandomnessBeacon", [placeholder(1)]);
  writeInitializer("dailyRewardsScheduler", "DailyRewardsScheduler", [placeholder(1)]);
  writeInitializer("treasury", "Treasury", [placeholder(1)]);
  writeInitializer("shop", "Shop", [placeholder(1), placeholder(2), DEV, 500, 48 * 3600]);
  writeInitializer("royaltyReceiver", "RoyaltyReceiver", [
    placeholder(1),
    placeholder(2),
    DEV,
    placeholder(3),
    placeholder(4),
  ]);

  const admins = whitelistedAdmins.slice();
  admins.push(placeholder(1));
  writeInitializer("adminAccess", "AdminAccess", [admins, [PROMOTIONAL_ADMIN]]);
  writeInitializer("itemNFT", "ItemNFT", [
    placeholder(1),
    "ipfs://bafybeibh3pzpeovube6h5gojythns2edu47qpnfvc5ssqmtv3ojqph7r4e/",
    placeholder(2),
    true,
  ]);
  writeInitializer("activityPoints", "ActivityPoints", [placeholder(1), ACTIVITY_TICKET2, SONIC_GEM_TICKET2]);
  writeInitializer("orderBook", "OrderBook", [placeholder(1), placeholder(2), DEV, 30, 30, 100]);
  writeInitializer("marketplace", "Marketplace", [placeholder(1), placeholder(2)]);
  writeInitializer("playerNFT", "PlayerNFT", [
    placeholder(1),
    placeholder(2),
    DEV,
    placeholder(3),
    parseEther("1"),
    parseEther("1"),
    "ipfs://QmVeDAUVj4F4F84WZpuP9pDdKNvcLFSWUV5rhTKMiN99EH/",
    200_000,
    true,
    placeholder(4),
  ]);
  writeInitializer("cosmetics", "Cosmetics", [placeholder(1), placeholder(2), placeholder(3)]);
  writeInitializer("blackMarketTrader", "BlackMarketTrader", [placeholder(1), placeholder(2), placeholder(3)]);
  writeInitializer("quests", "Quests", [
    placeholder(1),
    placeholder(2),
    placeholder(3),
    [placeholder(4), placeholder(5)],
    placeholder(6),
  ]);
  writeInitializer("clans", "Clans", [
    placeholder(1),
    placeholder(2),
    placeholder(3),
    DEV,
    parseEther("1"),
    placeholder(4),
    500,
    30_000,
    placeholder(5),
    placeholder(6),
  ]);
  writeInitializer("wishingWell", "WishingWell", [
    placeholder(1),
    placeholder(2),
    placeholder(3),
    placeholder(4),
    placeholder(5),
    parseEther("5"),
    parseEther("1000"),
    parseEther("50"),
    placeholder(6),
  ]);
  writeInitializer("petNFT", "PetNFT", [
    placeholder(1),
    placeholder(2),
    "ipfs://QmVKb8HiZaLBYD7xiCECkjZ8pj8h4VxX2754hZZUCbmWGq/",
    DEV,
    parseEther("1"),
    placeholder(3),
    placeholder(4),
    20_000,
    placeholder(5),
    placeholder(6),
    true,
  ]);
  writeInitializer("petNFTReroll", "PetNFTReroll", [placeholder(1), placeholder(2), placeholder(3), placeholder(4)]);
  writeInitializer("players", "Players", [
    placeholder(1),
    placeholder(2),
    placeholder(3),
    placeholder(4),
    placeholder(5),
    placeholder(6),
    placeholder(7),
    placeholder(8),
    placeholder(9),
    placeholder(10),
    placeholder(11),
    placeholder(12),
    placeholder(13),
    placeholder(14),
    placeholder(15),
    placeholder(16),
    placeholder(17),
    true,
  ]);
  writeInitializer("promotions", "Promotions", [
    placeholder(1),
    placeholder(2),
    placeholder(3),
    placeholder(4),
    placeholder(5),
    placeholder(6),
    placeholder(7),
    placeholder(8),
    DEV,
    placeholder(9),
    true,
  ]);
  writeInitializer("globalEvents", "GlobalEvents", [placeholder(1), placeholder(2), placeholder(3)]);
  writeInitializer("passiveActions", "PassiveActions", [
    placeholder(1),
    placeholder(2),
    placeholder(3),
    placeholder(4),
    placeholder(5),
  ]);
  writeInitializer("instantActions", "InstantActions", [
    placeholder(1),
    placeholder(2),
    placeholder(3),
    placeholder(4),
  ]);
  writeInitializer("instantVRFActions", "InstantVRFActions", [
    placeholder(1),
    placeholder(2),
    placeholder(3),
    placeholder(4),
    placeholder(5),
    64,
    placeholder(6),
  ]);
  writeInitializer("genericInstantVRFActionStrategy", "GenericInstantVRFActionStrategy", [placeholder(1)]);
  writeInitializer("eggInstantVRFActionStrategy", "EggInstantVRFActionStrategy", [placeholder(1)]);
  writeInitializer("bankRelay", "BankRelay", [placeholder(1)]);
  writeInitializer("pvpBattleground", "PVPBattleground", [
    placeholder(1),
    placeholder(2),
    placeholder(3),
    placeholder(4),
    placeholder(5),
    allBattleSkills,
    10 * 60,
    placeholder(6),
    true,
  ]);

  const raidCombatActionIds = [
    EstforConstants.ACTION_COMBAT_NATUOW,
    EstforConstants.ACTION_COMBAT_GROG_TOAD,
    EstforConstants.ACTION_COMBAT_UFFINCH,
    EstforConstants.ACTION_COMBAT_NATURARACNID,
    EstforConstants.ACTION_COMBAT_DRAGON_FROG,
    EstforConstants.ACTION_COMBAT_ELDER_BURGOF,
    EstforConstants.ACTION_COMBAT_GRAND_TREE_IMP,
    EstforConstants.ACTION_COMBAT_BANOXNID,
    EstforConstants.ACTION_COMBAT_ARCANE_DRAGON,
    EstforConstants.ACTION_COMBAT_SNAPPER_BUG,
    EstforConstants.ACTION_COMBAT_SNUFFLEQUARG,
    EstforConstants.ACTION_COMBAT_OBGORA,
    EstforConstants.ACTION_COMBAT_LOSSUTH,
    EstforConstants.ACTION_COMBAT_SQUIGGLE_EGG,
    EstforConstants.ACTION_COMBAT_QUARTZ_EAGLE,
    EstforConstants.ACTION_COMBAT_DWELLER_BAT,
    EstforConstants.ACTION_COMBAT_ANCIENT_ENT,
    EstforConstants.ACTION_COMBAT_ROCKHAWK,
    EstforConstants.ACTION_COMBAT_QRAKUR,
    EstforConstants.ACTION_COMBAT_ELEMENTAL_DRAGON,
    EstforConstants.ACTION_COMBAT_ERKAD,
    EstforConstants.ACTION_COMBAT_EMBER_WHELP,
    EstforConstants.ACTION_COMBAT_JUVENILE_CAVE_FAIRY,
    EstforConstants.ACTION_COMBAT_CAVE_FAIRY,
    EstforConstants.ACTION_COMBAT_ICE_TROLL,
    EstforConstants.ACTION_COMBAT_BLAZING_MONTANITE,
    EstforConstants.ACTION_COMBAT_MONTANITE_ICE_TITAN,
    EstforConstants.ACTION_COMBAT_MONTANITE_FIRE_TITAN,
  ];
  writeInitializer("raids", "Raids", [
    placeholder(1),
    placeholder(2),
    placeholder(3),
    placeholder(4),
    8 * 3600,
    placeholder(5),
    placeholder(6),
    placeholder(7),
    20,
    raidCombatActionIds,
    true,
  ]);
  writeInitializer("lockedBankVaults", "LockedBankVaults", [
    placeholder(1),
    placeholder(2),
    placeholder(3),
    placeholder(4),
    placeholder(5),
    placeholder(6),
    DEV,
    placeholder(7),
    allBattleSkills,
    1,
    7 * 86400,
    20,
    100,
    placeholder(8),
    placeholder(9),
    true,
  ]);
  writeInitializer("territories", "Territories", [
    allTerritories,
    placeholder(1),
    placeholder(2),
    placeholder(3),
    placeholder(4),
    placeholder(5),
    placeholder(6),
    allBattleSkills,
    20,
    24 * 3600,
    placeholder(7),
    placeholder(8),
    true,
  ]);
  writeInitializer("combatantsHelper", "CombatantsHelper", [
    placeholder(1),
    placeholder(2),
    placeholder(3),
    placeholder(4),
    placeholder(5),
    placeholder(6),
    true,
  ]);
  writeInitializer("gameSubsidisationRegistry", "GameSubsidisationRegistry", [placeholder(1)]);
  writeInitializer("usageBasedSessionModule", "UsageBasedSessionModule", [placeholder(1), placeholder(2)]);
  writeInitializer("territoryTreasury", "TerritoryTreasury", [
    placeholder(1),
    placeholder(2),
    placeholder(3),
    DEV,
    placeholder(4),
    600,
  ]);
  writeInitializer("bankRegistry", "BankRegistry", []);
  writeInitializer("bankFactory", "BankFactory", [
    placeholder(1),
    placeholder(2),
    placeholder(3),
    placeholder(4),
    placeholder(5),
    placeholder(6),
    placeholder(7),
    placeholder(8),
    placeholder(9),
  ]);
}

function prepareSeedCalls(): void {
  writeCall("avatars", "PlayerNFT", "setAvatars", [avatarIds, avatarInfos]);
  manifest.entries.avatars = avatarIds.length;
  writeCall("cosmetics", "Cosmetics", "setCosmetics", [cosmeticTokenIds, cosmeticInfos]);
  manifest.entries.cosmetics = cosmeticTokenIds.length;
  writeCall("xpThresholdRewards", "Players", "addXPThresholdRewards", [allXPThresholdRewards]);
  manifest.entries.xpThresholdRewards = allXPThresholdRewards.length;
  writeChunks("items", "ItemNFT", "addItems", allItems);
  writeCall("quests", "Quests", "addQuests", [allQuests, allQuestsMinRequirements]);
  manifest.entries.quests = allQuests.length;

  for (let i = 0; i < allOrderBookTokenIdInfos.length; i += CHUNK_SIZE) {
    const chunk = allOrderBookTokenIdInfos.slice(i, i + CHUNK_SIZE);
    writeCall("orderbook", "OrderBook", "setTokenIdInfos", [
      chunk.map((info) => info.tokenId),
      chunk.map((info) => ({tick: info.tick, minQuantity: info.minQuantity})),
    ]);
  }
  manifest.entries.orderbook = allOrderBookTokenIdInfos.length;

  writeCall("fullAttireBonuses", "Players", "addFullAttireBonuses", [allFullAttireBonuses]);
  manifest.entries.fullAttireBonuses = allFullAttireBonuses.length;
  allDailyRewards.forEach((rewards, index) =>
    writeCall("dailyRewards", "DailyRewardsScheduler", "setDailyRewardPool", [index + 1, rewards])
  );
  manifest.entries.dailyRewards = allDailyRewards.reduce((total, rewards) => total + rewards.length, 0);
  allWeeklyRewards.forEach((rewards, index) =>
    writeCall("weeklyRewards", "DailyRewardsScheduler", "setWeeklyRewardPool", [index + 1, rewards])
  );
  manifest.entries.weeklyRewards = allWeeklyRewards.reduce((total, rewards) => total + rewards.length, 0);
  writeChunks("actions", "WorldActions", "addActions", allActions);

  writeCall("actionChoices", "WorldActions", "addBulkActionChoices", [
    [EstforConstants.ACTION_FIREMAKING_ITEM, EstforConstants.ACTION_SMITHING_ITEM, EstforConstants.ACTION_COOKING_ITEM],
    [allActionChoiceIdsFiremaking, allActionChoiceIdsSmithing, allActionChoiceIdsCooking],
    [allActionChoicesFiremaking, allActionChoicesSmithing, allActionChoicesCooking],
  ]);
  writeCall("actionChoices", "WorldActions", "addActionChoices", [
    EstforConstants.ACTION_CRAFTING_ITEM,
    allActionChoiceIdsCrafting,
    allActionChoicesCrafting,
  ]);
  writeCall("actionChoices", "WorldActions", "addActionChoices", [
    EstforConstants.ACTION_FLETCHING_ITEM,
    allActionChoiceIdsFletching,
    allActionChoicesFletching,
  ]);
  writeCall("actionChoices", "WorldActions", "addBulkActionChoices", [
    [EstforConstants.ACTION_ALCHEMY_ITEM, EstforConstants.ACTION_FORGING_ITEM],
    [allActionChoiceIdsAlchemy, allActionChoiceIdsForging],
    [allActionChoicesAlchemy, allActionChoicesForging],
  ]);
  writeCall("actionChoices", "WorldActions", "addBulkActionChoices", [
    [EstforConstants.ACTION_FARMING_ITEM],
    [allActionChoiceIdsFarming],
    [allActionChoicesFarming],
  ]);
  writeCall("actionChoices", "WorldActions", "addBulkActionChoices", [
    [EstforConstants.NONE, EstforConstants.NONE, EstforConstants.NONE],
    [allActionChoiceIdsMelee, allActionChoiceIdsRanged, allActionChoiceIdsMagic],
    [allActionChoicesMelee, allActionChoicesRanged, allActionChoicesMagic],
  ]);
  manifest.entries.actionChoices =
    allActionChoiceIdsFiremaking.length +
    allActionChoiceIdsSmithing.length +
    allActionChoiceIdsCooking.length +
    allActionChoiceIdsCrafting.length +
    allActionChoiceIdsFletching.length +
    allActionChoiceIdsAlchemy.length +
    allActionChoiceIdsForging.length +
    allActionChoiceIdsFarming.length +
    allActionChoiceIdsMelee.length +
    allActionChoiceIdsRanged.length +
    allActionChoiceIdsMagic.length;

  writeCall("shopItems", "Shop", "addBuyableItems", [allShopItemsBeta]);
  manifest.entries.shopItems = allShopItemsBeta.length;
  writeCall("clanTiers", "Clans", "addTiers", [allClanTiersBeta]);
  manifest.entries.clanTiers = allClanTiersBeta.length;
  const availableInstantActions = allInstantActions.filter((action) => action.isAvailable);
  writeChunks("instantActions", "InstantActions", "addActions", availableInstantActions);
  writeChunks("instantVRFActions", "InstantVRFActions", "addActions", allInstantVRFActions);
  writeCall("passiveActions", "PassiveActions", "addActions", [allPassiveActions]);
  manifest.entries.passiveActions = allPassiveActions.length;
  writeChunks("basePets", "PetNFT", "addBasePets", allBasePets, PET_CHUNK_SIZE);
  writeCall("baseRaids", "Raids", "addBaseRaids", [allBaseRaidIds, allBaseRaids]);
  manifest.entries.baseRaids = allBaseRaidIds.length;

  const unsellableItems = [
    EstforConstants.INFUSED_ORICHALCUM_HELMET,
    EstforConstants.INFUSED_ORICHALCUM_ARMOR,
    EstforConstants.INFUSED_ORICHALCUM_TASSETS,
    EstforConstants.INFUSED_ORICHALCUM_GAUNTLETS,
    EstforConstants.INFUSED_ORICHALCUM_BOOTS,
    EstforConstants.INFUSED_ORICHALCUM_SHIELD,
    EstforConstants.INFUSED_DRAGONSTONE_AMULET,
    EstforConstants.INFUSED_MASTER_HAT,
    EstforConstants.INFUSED_MASTER_BODY,
    EstforConstants.INFUSED_MASTER_TROUSERS,
    EstforConstants.INFUSED_MASTER_BRACERS,
    EstforConstants.INFUSED_MASTER_BOOTS,
    EstforConstants.INFUSED_ORICHALCUM_SWORD,
    EstforConstants.INFUSED_DRAGONSTONE_STAFF,
    EstforConstants.INFUSED_GODLY_BOW,
    EstforConstants.INFUSED_SCORCHING_COWL,
    EstforConstants.INFUSED_SCORCHING_BODY,
    EstforConstants.INFUSED_SCORCHING_CHAPS,
    EstforConstants.INFUSED_SCORCHING_BRACERS,
    EstforConstants.INFUSED_SCORCHING_BOOTS,
    EstforConstants.ANNIV1_CHEST,
    EstforConstants.ANNIV1_RING,
    EstforConstants.ANNIV1_EGG_TIER1,
    EstforConstants.ANNIV1_EGG_TIER2,
    EstforConstants.ANNIV1_EGG_TIER3,
    EstforConstants.ANNIV1_EGG_TIER4,
    EstforConstants.ANNIV1_EGG_TIER5,
    EstforConstants.ANNIV1_KEY,
    EstforConstants.SECRET_EGG_1_TIER1,
    EstforConstants.SECRET_EGG_1_TIER2,
    EstforConstants.SECRET_EGG_1_TIER3,
    EstforConstants.SECRET_EGG_1_TIER4,
    EstforConstants.SECRET_EGG_1_TIER5,
    EstforConstants.SECRET_EGG_2_TIER1,
    EstforConstants.SECRET_EGG_2_TIER2,
    EstforConstants.SECRET_EGG_2_TIER3,
    EstforConstants.SECRET_EGG_2_TIER4,
    EstforConstants.SECRET_EGG_2_TIER5,
    EstforConstants.SECRET_EGG_3_TIER1,
    EstforConstants.SECRET_EGG_3_TIER2,
    EstforConstants.SECRET_EGG_3_TIER3,
    EstforConstants.SECRET_EGG_3_TIER4,
    EstforConstants.SECRET_EGG_3_TIER5,
    EstforConstants.SECRET_EGG_4_TIER1,
    EstforConstants.SECRET_EGG_4_TIER2,
    EstforConstants.SECRET_EGG_4_TIER3,
    EstforConstants.SECRET_EGG_4_TIER4,
    EstforConstants.SECRET_EGG_4_TIER5,
    EstforConstants.KRAGSTYR_EGG_TIER1,
    EstforConstants.KRAGSTYR_EGG_TIER2,
    EstforConstants.KRAGSTYR_EGG_TIER3,
    EstforConstants.KRAGSTYR_EGG_TIER4,
    EstforConstants.KRAGSTYR_EGG_TIER5,
    EstforConstants.KEPHRI_AMULET,
    EstforConstants.RING_OF_TUR,
    EstforConstants.TRICK_CHEST2024,
    EstforConstants.TREAT_CHEST2024,
    EstforConstants.TRICK_OR_TREAT_KEY,
    EstforConstants.BOOK_007_ORICHALCUM_INFUSED,
    EstforConstants.CROSSBOW_007_ORICHALCUM_INFUSED,
    EstforConstants.DAGGER_007_ORICHALCUM_INFUSED,
  ];
  writeCall("unsellableItems", "Shop", "addUnsellableItems", [unsellableItems]);
  manifest.entries.unsellableItems = unsellableItems.length;

  writeCall("territoryMinimumMMRs", "Territories", "setMinimumMMRs", [
    allTerritories.map((territory) => territory.territoryId),
    allMinimumMMRs,
  ]);
  manifest.entries.territories = allTerritories.length;
  manifest.entries.instantActions = availableInstantActions.length;
  manifest.entries.instantVRFActions = allInstantVRFActions.length;
  manifest.entries.basePets = allBasePets.length;
}

function writeTestCall(name: string, contractName: string, functionName: string, args: unknown[]): void {
  writeBytes(join("test", `${name}.bin`), encode(contractName, functionName, args));
}

function prepareBetaTestDataCalls(): void {
  const noAttire = {
    head: 0,
    neck: 0,
    body: 0,
    arms: 0,
    legs: 0,
    feet: 0,
    ring: 0,
    reserved1: 0,
  };
  const woodcutting = {
    attire: noAttire,
    actionId: EstforConstants.ACTION_WOODCUTTING_LOG,
    regenerateId: EstforConstants.NONE,
    choiceId: EstforConstants.NONE,
    rightHandEquipmentTokenId: EstforConstants.BRONZE_AXE,
    leftHandEquipmentTokenId: EstforConstants.NONE,
    timespan: 3600,
    combatStyle: EstforTypes.CombatStyle.NONE,
    petId: EstforConstants.NONE,
  };
  const firemaking = {
    attire: noAttire,
    actionId: EstforConstants.ACTION_FIREMAKING_ITEM,
    regenerateId: EstforConstants.NONE,
    choiceId: EstforConstants.ACTIONCHOICE_FIREMAKING_LOG,
    rightHandEquipmentTokenId: EstforConstants.MAGIC_FIRE_STARTER,
    leftHandEquipmentTokenId: EstforConstants.NONE,
    timespan: 3600,
    combatStyle: EstforTypes.CombatStyle.NONE,
    petId: EstforConstants.NONE,
  };
  const combat = {
    attire: {...noAttire, head: EstforConstants.BRONZE_HELMET},
    actionId: EstforConstants.ACTION_COMBAT_NATUOW,
    regenerateId: EstforConstants.NONE,
    choiceId: EstforConstants.ACTIONCHOICE_MELEE_MONSTER,
    rightHandEquipmentTokenId: EstforConstants.BRONZE_SWORD,
    leftHandEquipmentTokenId: EstforConstants.NONE,
    timespan: 7200,
    combatStyle: EstforTypes.CombatStyle.ATTACK,
    petId: EstforConstants.NONE,
  };

  writeTestCall("mintOwner", "PlayerNFT", "mint", [1, "0xSamWitch", "", "", "", false, true]);
  writeTestCall("startWoodcutting", "Players", "startActions", [
    200_000,
    [woodcutting],
    EstforTypes.ActionQueueStrategy.OVERWRITE,
  ]);
  writeTestCall("processActions", "Players", "processActions", [200_000]);
  writeTestCall("startFiremaking", "Players", "startActions", [
    200_000,
    [firemaking],
    EstforTypes.ActionQueueStrategy.OVERWRITE,
  ]);
  writeTestCall("mintBronzeHelmet", "ItemNFT", "mint", [placeholder(1), EstforConstants.BRONZE_HELMET, 1]);
  writeTestCall("startCombat", "Players", "startActions", [
    200_000,
    [combat],
    EstforTypes.ActionQueueStrategy.OVERWRITE,
  ]);
  writeTestCall("approveShop", "MockBrushToken", "approve", [placeholder(1), parseEther("100")]);
  writeTestCall("buyFromShop", "Shop", "buy", [placeholder(1), EstforConstants.MAGIC_FIRE_STARTER, 1]);
  writeTestCall("fundShop", "MockBrushToken", "transfer", [placeholder(1), 100_000]);
  writeTestCall("mintShopInventory", "ItemNFT", "mintBatch", [
    placeholder(1),
    [EstforConstants.MAGIC_FIRE_STARTER, EstforConstants.TITANIUM_ARMOR],
    [500, 1],
  ]);
  writeTestCall("sellTooEarly", "Shop", "sell", [EstforConstants.TITANIUM_ARMOR, 1, 1]);
  writeTestCall("sellToShop", "Shop", "sell", [EstforConstants.MAGIC_FIRE_STARTER, 1, 1]);
  writeTestCall("activateQuest", "Players", "activateQuest", [200_000, EstforConstants.QUEST_BURN_BAN]);
  writeTestCall("deactivateQuest", "Players", "deactivateQuest", [200_000]);
  writeTestCall("approveClans", "MockBrushToken", "approve", [placeholder(1), parseEther("1000")]);
  writeTestCall("createClan", "Clans", "createClan", [
    200_000,
    "Sam test clan",
    "G4ZgtP52JK",
    "soniclabs",
    "0xSonicLabs",
    2,
    1,
  ]);
  writeTestCall("transferToBank", "ItemNFT", "safeTransferFrom", [
    placeholder(1),
    placeholder(2),
    EstforConstants.BRONZE_HELMET,
    1,
    "0x",
  ]);
  writeTestCall("mintAlice", "PlayerNFT", "mint", [1, "Alice", "", "", "", false, true]);
  writeTestCall("inviteAlice", "Clans", "inviteMembers", [30_000, [200_001], 200_000]);
  writeTestCall("acceptInvite", "Clans", "acceptInvite", [30_000, 200_001, 0]);
  writeTestCall("leaveClan", "Clans", "changeRank", [30_000, 200_001, 0, 200_001]);
  writeTestCall("requestToJoin", "Clans", "requestToJoin", [30_000, 200_001, 0]);
  writeTestCall("deleteInvitesAsPlayer", "Clans", "deleteInvitesAsPlayer", [[30_000], 200_001]);
  writeTestCall("deleteInvitesAsClan", "Clans", "deleteInvitesAsClan", [30_000, [200_001], 200_000]);

  const fireStarterInfo = allOrderBookTokenIdInfos.find((info) => info.tokenId === EstforConstants.MAGIC_FIRE_STARTER);
  if (!fireStarterInfo) throw new Error("Missing orderbook data for MAGIC_FIRE_STARTER");
  writeTestCall("limitOrder", "OrderBook", "limitOrders", [
    [
      {
        side: 1,
        tokenId: EstforConstants.MAGIC_FIRE_STARTER,
        price: fireStarterInfo.tick,
        quantity: 1,
      },
    ],
  ]);
  writeTestCall("buyBrush", "Quests", "buyBrush", [placeholder(1), 1, true]);
  writeTestCall("approveQuests", "MockBrushToken", "approve", [placeholder(1), parseEther("1")]);
  writeTestCall("sellBrush", "Quests", "sellBrush", [placeholder(1), parseEther("0.001"), 0, false]);
}

const DEPLOYMENT_ARTIFACTS = [
  "out/ActivityPoints.sol/ActivityPoints.json",
  "out/AdminAccess.sol/AdminAccess.json",
  "out/Bank.sol/Bank.json",
  "out/BankFactory.sol/BankFactory.json",
  "out/BankRegistry.sol/BankRegistry.json",
  "out/BankRelay.sol/BankRelay.json",
  "out/BlackMarketTrader.sol/BlackMarketTrader.json",
  "out/Bridge.sol/Bridge.json",
  "out/Clans.sol/Clans.json",
  "out/CombatantsHelper.sol/CombatantsHelper.json",
  "out/Cosmetics.sol/Cosmetics.json",
  "out/DailyRewardsScheduler.sol/DailyRewardsScheduler.json",
  "out/ERC1967Proxy.sol/ERC1967Proxy.json",
  "out/EggInstantVRFActionStrategy.sol/EggInstantVRFActionStrategy.json",
  "out/EndpointV2Mock.sol/EndpointV2Mock.json",
  "out/GameSubsidisationRegistry.sol/GameSubsidisationRegistry.json",
  "out/GenericInstantVRFActionStrategy.sol/GenericInstantVRFActionStrategy.json",
  "out/GlobalEvent.sol/GlobalEvents.json",
  "out/InstantActions.sol/InstantActions.json",
  "out/InstantVRFActions.sol/InstantVRFActions.json",
  "out/ItemNFT.sol/ItemNFT.json",
  "out/LockedBankVaults.sol/LockedBankVaults.json",
  "out/Marketplace.sol/Marketplace.json",
  "out/MockBrushToken.sol/MockBrushToken.json",
  "out/MockPaintSwapMarketplaceWhitelist.sol/MockPaintSwapMarketplaceWhitelist.json",
  "out/MockRouter.sol/MockRouter.json",
  "out/MockUSDCToken.sol/MockUSDCToken.json",
  "out/MockVRF.sol/MockVRF.json",
  "out/MockWrappedNative.sol/WrappedNative.json",
  "out/OrderBook.sol/OrderBook.json",
  "out/PVPBattleground.sol/PVPBattleground.json",
  "out/PassiveActions.sol/PassiveActions.json",
  "out/PetNFT.sol/PetNFT.json",
  "out/PetNFTReroll.sol/PetNFTReroll.json",
  "out/PlayerNFT.sol/PlayerNFT.json",
  "out/Players.sol/Players.json",
  "out/PlayersImplMisc.sol/PlayersImplMisc.json",
  "out/PlayersImplMisc1.sol/PlayersImplMisc1.json",
  "out/PlayersImplProcessActions.sol/PlayersImplProcessActions.json",
  "out/PlayersImplQueueActions.sol/PlayersImplQueueActions.json",
  "out/PlayersImplRewards.sol/PlayersImplRewards.json",
  "out/Promotions.sol/Promotions.json",
  "out/Quests.sol/Quests.json",
  "out/Raids.sol/Raids.json",
  "out/RandomnessBeacon.sol/RandomnessBeacon.json",
  "out/RoyaltyReceiver.sol/RoyaltyReceiver.json",
  "out/Shop.sol/Shop.json",
  "out/Territories.sol/Territories.json",
  "out/TerritoryTreasury.sol/TerritoryTreasury.json",
  "out/Treasury.sol/Treasury.json",
  "out/UpgradeableBeacon.sol/UpgradeableBeacon.json",
  "out/UsageBasedSessionModule.sol/UsageBasedSessionModule.json",
  "out/WishingWell.sol/WishingWell.json",
  "out/WorldActions.sol/WorldActions.json",
] as const;

const LIBRARY_ADDRESS_KEYS: Record<string, string> = {
  "contracts/EstforLibrary.sol:EstforLibrary": "estforLibrary",
  "contracts/ItemNFTLibrary.sol:ItemNFTLibrary": "itemNFTLibrary",
  "contracts/PetNFTLibrary.sol:PetNFTLibrary": "petNFTLibrary",
  "contracts/Players/PlayersLibrary.sol:PlayersLibrary": "playersLibrary",
  "contracts/PromotionsLibrary.sol:PromotionsLibrary": "promotionsLibrary",
  "contracts/Clans/ClanBattleLibrary.sol:ClanBattleLibrary": "clanBattleLibrary",
  "contracts/Clans/LockedBankVaultsLibrary.sol:LockedBankVaultsLibrary": "lockedBankVaultsLibrary",
};

function prepareLinkedBytecode(deploymentPath: string): void {
  const addresses = JSON.parse(readFileSync(deploymentPath, "utf8")) as Record<string, string>;

  for (const artifactPath of DEPLOYMENT_ARTIFACTS) {
    const foundryArtifact = JSON.parse(readFileSync(artifactPath, "utf8")) as JsonArtifact;
    let object = foundryArtifact.bytecode.object.slice(2);

    for (const [sourceName, libraries] of Object.entries(foundryArtifact.bytecode.linkReferences)) {
      for (const [libraryName, references] of Object.entries(libraries)) {
        const fullyQualifiedName = `${sourceName}:${libraryName}`;
        const addressKey = LIBRARY_ADDRESS_KEYS[fullyQualifiedName];
        const address = addresses[addressKey]?.slice(2).toLowerCase();
        if (!address || address.length !== 40) {
          throw new Error(`Missing deployed address for linked library ${fullyQualifiedName}`);
        }
        for (const reference of references) {
          if (reference.length !== 20) throw new Error(`Unexpected link length for ${fullyQualifiedName}`);
          const offset = reference.start * 2;
          object = `${object.slice(0, offset)}${address}${object.slice(offset + reference.length * 2)}`;
        }
      }
    }

    if (object.includes("__$")) throw new Error(`Unresolved library link in ${artifactPath}`);
    writeBytes(join("bytecode", `${artifactPath}.bin`), `0x${object}`);
  }
}

rmSync(OUTPUT_DIR, {recursive: true, force: true});
mkdirSync(OUTPUT_DIR, {recursive: true});
prepareInitializers();
prepareSeedCalls();
prepareBetaTestDataCalls();
if (process.env.DEPLOYMENT_INPUT) prepareLinkedBytecode(process.env.DEPLOYMENT_INPUT);
writeFileSync(join(OUTPUT_DIR, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(
  `Prepared ${Object.values(manifest.calls).reduce(
    (total, count) => total + count,
    0
  )} Forge seed calls in ${OUTPUT_DIR}`
);
