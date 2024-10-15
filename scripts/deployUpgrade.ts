import {ethers, upgrades} from "hardhat";
import {
  EstforLibrary,
  LockedBankVaultsLibrary,
  PetNFTLibrary,
  PromotionsLibrary,
  RoyaltyReceiver,
  WorldLibrary,
} from "../typechain-types";
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
  LOCKED_BANK_VAULTS_ADDRESS,
  COMBATANTS_HELPER_ADDRESS,
  ROYALTY_RECEIVER_ADDRESS,
  INSTANT_VRF_ACTIONS_ADDRESS,
  VRF_REQUEST_INFO_ADDRESS,
  GENERIC_INSTANT_VRF_ACTION_STRATEGY_ADDRESS,
  EGG_INSTANT_VRF_ACTION_STRATEGY_ADDRESS,
  PET_NFT_ADDRESS,
  PASSIVE_ACTIONS_ADDRESS,
  PET_NFT_LIBRARY_ADDRESS,
  LOCKED_BANK_VAULTS_LIBRARY_ADDRESS,
} from "./contractAddresses";
import {verifyContracts} from "./utils";

async function main() {
  const [owner] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  console.log(`Deploying upgradeable contracts with the account: ${owner.address} on chain ${network.chainId}`);

  const timeout = 600 * 1000; // 10 minutes

  const newEstforLibrary = false;
  const EstforLibrary = await ethers.getContractFactory("EstforLibrary");
  let estforLibrary: EstforLibrary;
  if (newEstforLibrary) {
    estforLibrary = await EstforLibrary.deploy();

    if (network.chainId == 250n) {
      await verifyContracts([await estforLibrary.getAddress()]);
    }
  } else {
    estforLibrary = (await EstforLibrary.attach(ESTFOR_LIBRARY_ADDRESS)) as EstforLibrary;
  }
  console.log(`estforLibrary = "${(await estforLibrary.getAddress()).toLowerCase()}"`);

  // Players
  const Players = (await ethers.getContractFactory("Players")).connect(owner);
  const players = await upgrades.upgradeProxy(PLAYERS_ADDRESS, Players, {
    kind: "uups",
    unsafeAllow: ["delegatecall", "external-library-linking"],
    timeout,
  });
  await players.waitForDeployment();
  console.log(`players = "${(await players.getAddress()).toLowerCase()}"`);

  // PlayerNFT
  const PlayerNFT = (
    await ethers.getContractFactory("PlayerNFT", {
      libraries: {EstforLibrary: await estforLibrary.getAddress()},
    })
  ).connect(owner);
  const playerNFT = await upgrades.upgradeProxy(PLAYER_NFT_ADDRESS, PlayerNFT, {
    kind: "uups",
    unsafeAllow: ["external-library-linking"],
    timeout,
  });
  await playerNFT.waitForDeployment();
  console.log(`playerNFT = "${(await playerNFT.getAddress()).toLowerCase()}"`);

  // ItemNFT
  const newItemNFTLibrary = false;
  const ItemNFTLibrary = await ethers.getContractFactory("ItemNFTLibrary");
  let itemNFTLibrary: any;
  if (newItemNFTLibrary) {
    itemNFTLibrary = await ItemNFTLibrary.deploy();
    await itemNFTLibrary.waitForDeployment();
  } else {
    itemNFTLibrary = await ItemNFTLibrary.attach(ITEM_NFT_LIBRARY_ADDRESS);
  }
  console.log(`itemNFTLibrary = "${(await itemNFTLibrary.getAddress()).toLowerCase()}"`);
  const ItemNFT = (
    await ethers.getContractFactory("ItemNFT", {libraries: {ItemNFTLibrary: await itemNFTLibrary.getAddress()}})
  ).connect(owner);
  const itemNFT = await upgrades.upgradeProxy(ITEM_NFT_ADDRESS, ItemNFT, {
    kind: "uups",
    unsafeAllow: ["external-library-linking"],
    timeout,
  });
  await itemNFT.waitForDeployment();
  console.log(`itemNFT = "${(await itemNFT.getAddress()).toLowerCase()}"`);

  // Shop
  const Shop = (await ethers.getContractFactory("Shop")).connect(owner);
  const shop = await upgrades.upgradeProxy(SHOP_ADDRESS, Shop, {
    kind: "uups",
    timeout,
  });
  await shop.waitForDeployment();
  console.log(`shop = "${(await shop.getAddress()).toLowerCase()}"`);

  // WishingWell
  const WishingWell = (await ethers.getContractFactory("WishingWell")).connect(owner);
  const wishingWell = await upgrades.upgradeProxy(WISHING_WELL_ADDRESS, WishingWell, {
    kind: "uups",
  });
  await wishingWell.waitForDeployment();
  console.log(`wishingWell = "${(await wishingWell.getAddress()).toLowerCase()}"`);

  // Quests
  const Quests = (await ethers.getContractFactory("Quests")).connect(owner);
  const quests = await upgrades.upgradeProxy(QUESTS_ADDRESS, Quests, {
    kind: "uups",
    timeout,
  });
  await quests.waitForDeployment();
  console.log(`quests = "${(await quests.getAddress()).toLowerCase()}"`);

  // Clan
  const Clans = (
    await ethers.getContractFactory("Clans", {
      libraries: {EstforLibrary: await estforLibrary.getAddress()},
    })
  ).connect(owner);
  const clans = await upgrades.upgradeProxy(CLANS_ADDRESS, Clans, {
    kind: "uups",
    unsafeAllow: ["external-library-linking"],
    timeout,
  });
  await clans.waitForDeployment();
  console.log(`clans = "${(await clans.getAddress()).toLowerCase()}"`);

  // Bank Registry
  const BankRegistry = (await ethers.getContractFactory("BankRegistry")).connect(owner);
  const bankRegistry = await upgrades.upgradeProxy(BANK_REGISTRY_ADDRESS, BankRegistry, {
    kind: "uups",
    timeout,
  });
  await bankRegistry.waitForDeployment();
  console.log(`bankRegistry = "${(await bankRegistry.getAddress()).toLowerCase()}"`);

  // World
  const newWorldLibrary = false;
  const WorldLibrary = await ethers.getContractFactory("WorldLibrary");
  let worldLibrary: WorldLibrary;
  if (newWorldLibrary) {
    worldLibrary = await WorldLibrary.deploy();
  } else {
    worldLibrary = (await WorldLibrary.attach(WORLD_LIBRARY_ADDRESS)) as WorldLibrary;
  }
  console.log(`worldLibrary = "${(await worldLibrary.getAddress()).toLowerCase()}"`);

  const World = (
    await ethers.getContractFactory("World", {
      libraries: {WorldLibrary: await worldLibrary.getAddress()},
    })
  ).connect(owner);
  const world = await upgrades.upgradeProxy(WORLD_ADDRESS, World, {
    kind: "uups",
    unsafeAllow: ["external-library-linking"],
    timeout,
  });
  await world.waitForDeployment();
  console.log(`world = "${(await world.getAddress()).toLowerCase()}"`);

  // AdminAccess
  const AdminAccess = (await ethers.getContractFactory("AdminAccess")).connect(owner);
  const adminAccess = await upgrades.upgradeProxy(ADMIN_ACCESS_ADDRESS, AdminAccess, {
    kind: "uups",
    timeout,
  });
  await adminAccess.waitForDeployment();
  console.log(`adminAccess = "${(await adminAccess.getAddress()).toLowerCase()}"`);

  const newPromotionsLibrary = false;
  const PromotionsLibrary = await ethers.getContractFactory("PromotionsLibrary");
  let promotionsLibrary: PromotionsLibrary;
  if (newPromotionsLibrary) {
    promotionsLibrary = await PromotionsLibrary.deploy();

    if (network.chainId == 250n) {
      await verifyContracts([await promotionsLibrary.getAddress()]);
    }
  } else {
    promotionsLibrary = (await PromotionsLibrary.attach(PROMOTIONS_LIBRARY_ADDRESS)) as PromotionsLibrary;
  }
  console.log(`promotionsLibrary = "${(await promotionsLibrary.getAddress()).toLowerCase()}"`);

  // Promotions
  const Promotions = (
    await ethers.getContractFactory("Promotions", {
      libraries: {PromotionsLibrary: await promotionsLibrary.getAddress()},
    })
  ).connect(owner);
  const promotions = await upgrades.upgradeProxy(PROMOTIONS_ADDRESS, Promotions, {
    kind: "uups",
    timeout,
    unsafeAllow: ["external-library-linking"],
  });
  await promotions.waitForDeployment();
  console.log(`promotions = "${(await promotions.getAddress()).toLowerCase()}"`);

  // Instant actions
  const InstantActions = (await ethers.getContractFactory("InstantActions")).connect(owner);
  const instantActions = await upgrades.upgradeProxy(INSTANT_ACTIONS_ADDRESS, InstantActions, {
    kind: "uups",
    timeout,
  });
  await instantActions.waitForDeployment();
  console.log(`instantActions = "${(await instantActions.getAddress()).toLowerCase()}"`);

  // Instant VRF actions
  const InstantVRFActions = (await ethers.getContractFactory("InstantVRFActions")).connect(owner);
  const instantVRFActions = await upgrades.upgradeProxy(INSTANT_VRF_ACTIONS_ADDRESS, InstantVRFActions, {
    kind: "uups",
    timeout,
  });
  await instantVRFActions.waitForDeployment();
  console.log(`instantVRFActions = "${(await instantVRFActions.getAddress()).toLowerCase()}"`);

  // Instant VRF strategies
  const GenericInstantVRFActionStrategy = (await ethers.getContractFactory("GenericInstantVRFActionStrategy")).connect(
    owner,
  );
  const genericInstantVRFActionStrategy = await upgrades.upgradeProxy(
    GENERIC_INSTANT_VRF_ACTION_STRATEGY_ADDRESS,
    GenericInstantVRFActionStrategy,
    {
      kind: "uups",
      timeout,
    },
  );
  await genericInstantVRFActionStrategy.waitForDeployment();
  console.log(
    `genericInstantVRFActionStrategy = "${(await genericInstantVRFActionStrategy.getAddress()).toLowerCase()}"`,
  );

  const EggInstantVRFActionStrategy = (await ethers.getContractFactory("EggInstantVRFActionStrategy")).connect(owner);
  const eggInstantVRFActionStrategy = await upgrades.upgradeProxy(
    EGG_INSTANT_VRF_ACTION_STRATEGY_ADDRESS,
    EggInstantVRFActionStrategy,
    {
      kind: "uups",
      timeout,
    },
  );
  await eggInstantVRFActionStrategy.waitForDeployment();
  console.log(`eggInstantVRFActionStrategy = "${(await eggInstantVRFActionStrategy.getAddress()).toLowerCase()}"`);

  const newPetNFTLibrary = false;
  let petNFTLibrary: PetNFTLibrary;
  if (newPetNFTLibrary) {
    petNFTLibrary = (await ethers.deployContract("PetNFTLibrary")) as PetNFTLibrary;
  } else {
    petNFTLibrary = (await ethers.getContractAt("PetNFTLibrary", PET_NFT_LIBRARY_ADDRESS)) as PetNFTLibrary;
  }
  console.log(`petNFTLibrary = "${(await petNFTLibrary.getAddress()).toLowerCase()}"`);

  const PetNFT = (
    await ethers.getContractFactory("PetNFT", {
      libraries: {EstforLibrary: await estforLibrary.getAddress(), PetNFTLibrary: await petNFTLibrary.getAddress()},
    })
  ).connect(owner);
  const petNFT = await upgrades.upgradeProxy(PET_NFT_ADDRESS, PetNFT, {
    kind: "uups",
    unsafeAllow: ["external-library-linking"],
    timeout,
  });
  await petNFT.waitForDeployment();
  console.log(`petNFT = "${(await petNFT.getAddress()).toLowerCase()}"`);

  const VRFRequestInfo = (await ethers.getContractFactory("VRFRequestInfo")).connect(owner);
  const vrfRequestInfo = await upgrades.upgradeProxy(VRF_REQUEST_INFO_ADDRESS, VRFRequestInfo, {
    kind: "uups",
    timeout,
  });
  await vrfRequestInfo.waitForDeployment();
  console.log(`vrfRequestInfo = "${(await vrfRequestInfo.getAddress()).toLowerCase()}"`);

  // LockedBankVaults
  const newLockedBankVaultsLibrary = false;
  const LockedBankVaultsLibrary = await ethers.getContractFactory("LockedBankVaultsLibrary");
  let lockedBankVaultsLibrary: LockedBankVaultsLibrary;
  if (newLockedBankVaultsLibrary) {
    lockedBankVaultsLibrary = await LockedBankVaultsLibrary.deploy();
  } else {
    lockedBankVaultsLibrary = (await LockedBankVaultsLibrary.attach(
      LOCKED_BANK_VAULTS_LIBRARY_ADDRESS,
    )) as LockedBankVaultsLibrary;
  }
  console.log(`lockedBankVaultsLibrary = "${(await lockedBankVaultsLibrary.getAddress()).toLowerCase()}"`);

  const LockedBankVaults = (
    await ethers.getContractFactory("LockedBankVaults", {
      libraries: {
        EstforLibrary: await estforLibrary.getAddress(),
        LockedBankVaultsLibrary: await lockedBankVaultsLibrary.getAddress(),
      },
    })
  ).connect(owner);
  const lockedBankVaults = await upgrades.upgradeProxy(LOCKED_BANK_VAULTS_ADDRESS, LockedBankVaults, {
    kind: "uups",
    unsafeAllow: ["external-library-linking"],
    timeout,
  });
  await lockedBankVaults.waitForDeployment();
  console.log(`lockedBankVaults = "${(await lockedBankVaults.getAddress()).toLowerCase()}"`);

  const Territories = (await ethers.getContractFactory("Territories")).connect(owner);
  const territories = await upgrades.upgradeProxy(TERRITORIES_ADDRESS, Territories, {
    kind: "uups",
    unsafeAllow: ["external-library-linking"],
    timeout,
  });
  await territories.waitForDeployment();
  console.log(`territories = "${(await territories.getAddress()).toLowerCase()}"`);

  const CombatantsHelper = (
    await ethers.getContractFactory("CombatantsHelper", {
      libraries: {EstforLibrary: await estforLibrary.getAddress()},
    })
  ).connect(owner);
  const combatantsHelper = await upgrades.upgradeProxy(COMBATANTS_HELPER_ADDRESS, CombatantsHelper, {
    kind: "uups",
    unsafeAllow: ["external-library-linking"],
    timeout,
  });
  await combatantsHelper.waitForDeployment();
  console.log(`combatantsHelper = "${(await combatantsHelper.getAddress()).toLowerCase()}"`);

  const DecoratorProvider = (await ethers.getContractFactory("DecoratorProvider")).connect(owner);
  const decoratorProvider = await upgrades.upgradeProxy(DECORATOR_PROVIDER_ADDRESS, DecoratorProvider, {
    kind: "uups",
    timeout,
  });
  await decoratorProvider.waitForDeployment();
  console.log(`decoratorProvider = "${(await decoratorProvider.getAddress()).toLowerCase()}"`);

  const RoyaltyReceiver = (await ethers.getContractFactory("RoyaltyReceiver")).connect(owner);
  const royaltyReceiver = (await upgrades.upgradeProxy(ROYALTY_RECEIVER_ADDRESS, RoyaltyReceiver, {
    kind: "uups",
    unsafeAllow: ["external-library-linking"],
    timeout,
  })) as unknown as RoyaltyReceiver;

  console.log(`royaltyReceiver = "${(await royaltyReceiver.getAddress()).toLowerCase()}"`);

  const PassiveActions = (
    await ethers.getContractFactory("PassiveActions", {libraries: {WorldLibrary: await worldLibrary.getAddress()}})
  ).connect(owner);
  const passiveActions = await upgrades.upgradeProxy(PASSIVE_ACTIONS_ADDRESS, PassiveActions, {
    kind: "uups",
    unsafeAllow: ["delegatecall", "external-library-linking"],
    timeout,
  });
  await passiveActions.waitForDeployment();
  console.log(`passiveActions = "${(await passiveActions.getAddress()).toLowerCase()}"`);

  if (network.chainId == 250n) {
    await verifyContracts([await players.getAddress()]);
    await verifyContracts([await playerNFT.getAddress()]);
    await verifyContracts([await itemNFT.getAddress()]);
    await verifyContracts([await shop.getAddress()]);
    await verifyContracts([await quests.getAddress()]);
    await verifyContracts([await clans.getAddress()]);
    await verifyContracts([await world.getAddress()]);
    await verifyContracts([await worldLibrary.getAddress()]);
    await verifyContracts([await estforLibrary.getAddress()]);
    await verifyContracts([await adminAccess.getAddress()]);
    await verifyContracts([await wishingWell.getAddress()]);
    await verifyContracts([await promotions.getAddress()]);
    await verifyContracts([await instantActions.getAddress()]);
    await verifyContracts([await vrfRequestInfo.getAddress()]);
    await verifyContracts([await instantVRFActions.getAddress()]);
    await verifyContracts([await genericInstantVRFActionStrategy.getAddress()]);
    await verifyContracts([await eggInstantVRFActionStrategy.getAddress()]);
    await verifyContracts([await petNFT.getAddress()]);
    await verifyContracts([await petNFTLibrary.getAddress()]);
    await verifyContracts([await lockedBankVaults.getAddress()]);
    await verifyContracts([await lockedBankVaultsLibrary.getAddress()]);
    await verifyContracts([await combatantsHelper.getAddress()]);
    await verifyContracts([await decoratorProvider.getAddress()]);
    await verifyContracts([await royaltyReceiver.getAddress()]);
    await verifyContracts([await passiveActions.getAddress()]);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
