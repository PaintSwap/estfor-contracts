import {ethers, upgrades} from "hardhat";
import {EstforLibrary, PromotionsLibrary, RoyaltyReceiver, WorldLibrary} from "../typechain-types";
import {
  ITEM_NFT_LIBRARY_ADDRESS,
  ITEM_NFT_ADDRESS,
  PLAYERS_ADDRESS,
  PLAYER_NFT_ADDRESS,
  QUESTS_ADDRESS,
  SHOP_ADDRESS,
  CLANS_ADDRESS,
  ESTFOR_LIBRARY_ADDRESS,
  WORLD_ADDRESS,
  WORLD_LIBRARY_ADDRESS,
  ADMIN_ACCESS_ADDRESS,
  WISHING_WELL_ADDRESS,
  BANK_REGISTRY_ADDRESS,
  INSTANT_ACTIONS_ADDRESS,
  PROMOTIONS_ADDRESS,
  PROMOTIONS_LIBRARY_ADDRESS,
  TERRITORIES_ADDRESS,
  DECORATOR_PROVIDER_ADDRESS,
  LOCKED_BANK_VAULT_ADDRESS,
  COMBATANTS_HELPER_ADDRESS,
  ROYALTY_RECEIVER_ADDRESS,
  INSTANT_VRF_ACTIONS_ADDRESS,
  VRF_REQUEST_INFO_ADDRESS,
  GENERIC_INSTANT_VRF_ACTION_STRATEGY_ADDRESS,
  EGG_INSTANT_VRF_ACTION_STRATEGY_ADDRESS,
} from "./contractAddresses";
import {verifyContracts} from "./utils";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(
    `Deploying upgradeable contracts with the account: ${owner.address} on chain ${await owner.getChainId()}`
  );

  const timeout = 600 * 1000; // 10 minutes

  const newEstforLibrary = false;
  const EstforLibrary = await ethers.getContractFactory("EstforLibrary");
  let estforLibrary: EstforLibrary;
  if (newEstforLibrary) {
    estforLibrary = await EstforLibrary.deploy();
    await estforLibrary.deployed();
    await verifyContracts([estforLibrary.address]);
  } else {
    estforLibrary = await EstforLibrary.attach(ESTFOR_LIBRARY_ADDRESS);
  }
  console.log(`estforLibrary = "${estforLibrary.address.toLowerCase()}"`);

  // Players
  const Players = await ethers.getContractFactory("Players");
  const players = await upgrades.upgradeProxy(PLAYERS_ADDRESS, Players, {
    kind: "uups",
    unsafeAllow: ["delegatecall", "external-library-linking"],
    timeout,
  });
  await players.deployed();
  console.log(`players = "${players.address.toLowerCase()}"`);

  // PlayerNFT
  const PlayerNFT = await ethers.getContractFactory("PlayerNFT", {
    libraries: {EstforLibrary: estforLibrary.address},
  });
  const playerNFT = await upgrades.upgradeProxy(PLAYER_NFT_ADDRESS, PlayerNFT, {
    kind: "uups",
    unsafeAllow: ["external-library-linking"],
    timeout,
  });
  await playerNFT.deployed();
  console.log(`playerNFT = "${playerNFT.address.toLowerCase()}"`);

  // ItemNFT
  const newItemNFTLibrary = false;
  const ItemNFTLibrary = await ethers.getContractFactory("ItemNFTLibrary");
  let itemNFTLibrary: any;
  if (newItemNFTLibrary) {
    itemNFTLibrary = await ItemNFTLibrary.deploy();
    await itemNFTLibrary.deployed();
  } else {
    itemNFTLibrary = await ItemNFTLibrary.attach(ITEM_NFT_LIBRARY_ADDRESS);
  }
  console.log(`itemNFTLibrary = "${itemNFTLibrary.address.toLowerCase()}"`);

  const ItemNFT = await ethers.getContractFactory("ItemNFT", {libraries: {ItemNFTLibrary: itemNFTLibrary.address}});
  const itemNFT = await upgrades.upgradeProxy(ITEM_NFT_ADDRESS, ItemNFT, {
    kind: "uups",
    unsafeAllow: ["external-library-linking"],
    timeout,
  });
  await itemNFT.deployed();
  console.log(`itemNFT = "${itemNFT.address.toLowerCase()}"`);

  // Shop
  const Shop = await ethers.getContractFactory("Shop");
  const shop = await upgrades.upgradeProxy(SHOP_ADDRESS, Shop, {
    kind: "uups",
    timeout,
  });
  await shop.deployed();
  console.log(`shop = "${shop.address.toLowerCase()}"`);

  // WishingWell
  const WishingWell = await ethers.getContractFactory("WishingWell");
  const wishingWell = await upgrades.upgradeProxy(WISHING_WELL_ADDRESS, WishingWell, {
    kind: "uups",
  });
  await wishingWell.deployed();
  console.log(`wishingWell = "${wishingWell.address.toLowerCase()}"`);

  // Quests
  const Quests = await ethers.getContractFactory("Quests");
  const quests = await upgrades.upgradeProxy(QUESTS_ADDRESS, Quests, {
    kind: "uups",
    timeout,
  });
  await quests.deployed();
  console.log(`quests = "${quests.address.toLowerCase()}"`);

  // Clan
  const Clans = await ethers.getContractFactory("Clans", {
    libraries: {EstforLibrary: estforLibrary.address},
  });
  const clans = await upgrades.upgradeProxy(CLANS_ADDRESS, Clans, {
    kind: "uups",
    unsafeAllow: ["external-library-linking"],
    timeout,
  });
  await clans.deployed();
  console.log(`clans = "${clans.address.toLowerCase()}"`);

  // Bank Registry
  const BankRegistry = await ethers.getContractFactory("BankRegistry");
  const bankRegistry = await upgrades.upgradeProxy(BANK_REGISTRY_ADDRESS, BankRegistry, {
    kind: "uups",
    timeout,
  });
  await bankRegistry.deployed();
  console.log(`bankRegistry = "${bankRegistry.address.toLowerCase()}"`);

  // World
  const newWorldLibrary = false;
  const WorldLibrary = await ethers.getContractFactory("WorldLibrary");
  let worldLibrary: WorldLibrary;
  if (newWorldLibrary) {
    worldLibrary = await WorldLibrary.deploy();
    await worldLibrary.deployed();
  } else {
    worldLibrary = await WorldLibrary.attach(WORLD_LIBRARY_ADDRESS);
  }
  console.log(`worldLibrary = "${worldLibrary.address.toLowerCase()}"`);

  const World = await ethers.getContractFactory("World", {
    libraries: {WorldLibrary: worldLibrary.address},
  });
  const world = await upgrades.upgradeProxy(WORLD_ADDRESS, World, {
    kind: "uups",
    unsafeAllow: ["external-library-linking"],
    timeout,
  });
  await world.deployed();
  console.log(`world = "${world.address.toLowerCase()}"`);

  // AdminAccess
  const AdminAccess = await ethers.getContractFactory("AdminAccess");
  const adminAccess = await upgrades.upgradeProxy(ADMIN_ACCESS_ADDRESS, AdminAccess, {
    kind: "uups",
    timeout,
  });
  await adminAccess.deployed();
  console.log(`adminAccess = "${adminAccess.address.toLowerCase()}"`);

  const newPromotionsLibrary = false;
  const PromotionsLibrary = await ethers.getContractFactory("PromotionsLibrary");
  let promotionsLibrary: PromotionsLibrary;
  if (newPromotionsLibrary) {
    promotionsLibrary = await PromotionsLibrary.deploy();
    await promotionsLibrary.deployed();
    await verifyContracts([promotionsLibrary.address]);
  } else {
    promotionsLibrary = await PromotionsLibrary.attach(PROMOTIONS_LIBRARY_ADDRESS);
  }
  console.log(`promotionsLibrary = "${promotionsLibrary.address.toLowerCase()}"`);

  // Promotions
  const Promotions = await ethers.getContractFactory("Promotions", {
    libraries: {PromotionsLibrary: promotionsLibrary.address},
  });
  const promotions = await upgrades.upgradeProxy(PROMOTIONS_ADDRESS, Promotions, {
    kind: "uups",
    timeout,
    unsafeAllow: ["external-library-linking"],
  });
  await promotions.deployed();
  console.log(`promotions = "${promotions.address.toLowerCase()}"`);

  // Instant actions
  const InstantActions = await ethers.getContractFactory("InstantActions");
  const instantActions = await upgrades.upgradeProxy(INSTANT_ACTIONS_ADDRESS, InstantActions, {
    kind: "uups",
    timeout,
  });
  await instantActions.deployed();
  console.log(`instantActions = "${instantActions.address.toLowerCase()}"`);

  // Instant VRF actions
  const InstantVRFActions = await ethers.getContractFactory("InstantVRFActions");
  const instantVRFActions = await upgrades.upgradeProxy(INSTANT_VRF_ACTIONS_ADDRESS, InstantVRFActions, {
    kind: "uups",
    timeout,
  });
  await instantVRFActions.deployed();
  console.log(`instantVRFActions = "${instantVRFActions.address.toLowerCase()}"`);

  // Instant VRF strategies
  const GenericInstantVRFActionStrategy = await ethers.getContractFactory("GenericInstantVRFActionStrategy");
  const genericInstantVRFActionStrategy = await upgrades.upgradeProxy(
    GENERIC_INSTANT_VRF_ACTION_STRATEGY_ADDRESS,
    GenericInstantVRFActionStrategy,
    {
      kind: "uups",
      timeout,
    }
  );
  await genericInstantVRFActionStrategy.deployed();
  console.log(`genericInstantVRFActionStrategy = "${genericInstantVRFActionStrategy.address.toLowerCase()}"`);

  // EggInstantVRFActionStrategy
  const EggInstantVRFActionStrategy = await ethers.getContractFactory("EggInstantVRFActionStrategy");
  const eggInstantVRFActionStrategy = await upgrades.upgradeProxy(
    EGG_INSTANT_VRF_ACTION_STRATEGY_ADDRESS,
    EggInstantVRFActionStrategy,
    {
      kind: "uups",
      timeout,
    }
  );
  console.log(`eggInstantVRFActionStrategy = "${eggInstantVRFActionStrategy.address.toLowerCase()}"`);

  // VRFRequestInfo
  const VRFRequestInfo = await ethers.getContractFactory("VRFRequestInfo");
  const vrfRequestInfo = await upgrades.upgradeProxy(VRF_REQUEST_INFO_ADDRESS, VRFRequestInfo, {
    kind: "uups",
    timeout,
  });
  await vrfRequestInfo.deployed();
  console.log(`vrfRequestInfo = "${vrfRequestInfo.address.toLowerCase()}"`);

  const LockedBankVaults = await ethers.getContractFactory("LockedBankVaults");
  const lockedBankVaults = await upgrades.upgradeProxy(LOCKED_BANK_VAULT_ADDRESS, LockedBankVaults, {
    kind: "uups",
    unsafeAllow: ["external-library-linking"],
    timeout,
  });
  await lockedBankVaults.deployed();
  console.log(`lockedBankVaults = "${lockedBankVaults.address.toLowerCase()}"`);

  const Territories = await ethers.getContractFactory("Territories");
  const territories = await upgrades.upgradeProxy(TERRITORIES_ADDRESS, Territories, {
    kind: "uups",
    unsafeAllow: ["external-library-linking"],
    timeout,
  });
  await territories.deployed();
  console.log(`territories = "${territories.address.toLowerCase()}"`);

  const DecoratorProvider = await ethers.getContractFactory("DecoratorProvider");
  const decoratorProvider = await upgrades.upgradeProxy(DECORATOR_PROVIDER_ADDRESS, DecoratorProvider, {
    kind: "uups",
    timeout,
  });
  await decoratorProvider.deployed();
  console.log(`decoratorProvider = "${decoratorProvider.address.toLowerCase()}"`);

  const CombatantsHelper = await ethers.getContractFactory("CombatantsHelper", {
    libraries: {EstforLibrary: estforLibrary.address},
  });
  const combatantsHelper = await upgrades.upgradeProxy(COMBATANTS_HELPER_ADDRESS, CombatantsHelper, {
    kind: "uups",
    unsafeAllow: ["external-library-linking"],
    timeout,
  });
  await combatantsHelper.deployed();
  console.log(`combatantsHelper = "${combatantsHelper.address.toLowerCase()}"`);

  const RoyaltyReceiver = await ethers.getContractFactory("RoyaltyReceiver");
  const royaltyReceiver = (await upgrades.upgradeProxy(ROYALTY_RECEIVER_ADDRESS, RoyaltyReceiver, {
    kind: "uups",
    unsafeAllow: ["external-library-linking"],
    timeout,
  })) as RoyaltyReceiver;
  await royaltyReceiver.deployed();
  console.log(`royaltyReceiver = "${royaltyReceiver.address.toLowerCase()}"`);

  await verifyContracts([players.address]);
  await verifyContracts([playerNFT.address]);
  await verifyContracts([itemNFT.address]);
  await verifyContracts([shop.address]);
  await verifyContracts([quests.address]);
  await verifyContracts([clans.address]);
  await verifyContracts([world.address]);
  await verifyContracts([worldLibrary.address]);
  await verifyContracts([estforLibrary.address]);
  await verifyContracts([adminAccess.address]);
  await verifyContracts([bankRegistry.address]);
  await verifyContracts([wishingWell.address]);
  await verifyContracts([promotions.address]);
  await verifyContracts([instantActions.address]);
  await verifyContracts([vrfRequestInfo.address]);
  await verifyContracts([instantVRFActions.address]);
  await verifyContracts([genericInstantVRFActionStrategy.address]);
  await verifyContracts([eggInstantVRFActionStrategy.address]);
  await verifyContracts([lockedBankVaults.address]);
  await verifyContracts([territories.address]);
  await verifyContracts([decoratorProvider.address]);
  await verifyContracts([combatantsHelper.address]);
  await verifyContracts([royaltyReceiver.address]);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
