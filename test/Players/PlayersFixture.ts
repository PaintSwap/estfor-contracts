import {Skill} from "@paintswap/estfor-definitions/types";
import {ethers, upgrades} from "hardhat";
import {AvatarInfo, createPlayer, setDailyAndWeeklyRewards} from "../../scripts/utils";
import {
  AdminAccess,
  Bank,
  BankFactory,
  BankRegistry,
  ClanBattleLibrary,
  Clans,
  CombatantsHelper,
  EstforLibrary,
  EggInstantVRFActionStrategy,
  GenericInstantVRFActionStrategy,
  InstantActions,
  InstantVRFActions,
  ItemNFT,
  LockedBankVaults,
  MockBrushToken,
  MockVRF,
  MockRouter,
  PassiveActions,
  PetNFT,
  PlayerNFT,
  Players,
  Promotions,
  PromotionsLibrary,
  Quests,
  RoyaltyReceiver,
  Shop,
  Territories,
  VRFRequestInfo,
  WishingWell,
  World,
  Treasury,
  BankRelay,
  PVPBattleground,
  Raids,
  WorldActions
} from "../../typechain-types";
import {MAX_TIME} from "../utils";
import {allTerritories, allBattleSkills} from "../../scripts/data/territories";
import {Block, parseEther} from "ethers";
import {EstforConstants} from "@paintswap/estfor-definitions";

export const playersFixture = async function () {
  const [owner, alice, bob, charlie, dev, erin, frank] = await ethers.getSigners();

  const brush = (await ethers.deployContract("MockBrushToken")) as MockBrushToken;
  const mockVRF = (await ethers.deployContract("MockVRF")) as MockVRF;

  // Add some dummy blocks so that world can access previous blocks for random numbers
  for (let i = 0; i < 5; ++i) {
    await owner.sendTransaction({
      to: owner.address,
      value: 1,
      maxFeePerGas: 1
    });
  }

  // Create the world
  const WorldActions = await ethers.getContractFactory("WorldActions");
  const worldActions = (await upgrades.deployProxy(WorldActions, [], {
    kind: "uups"
  })) as unknown as WorldActions;

  const World = await ethers.getContractFactory("World");
  const world = (await upgrades.deployProxy(World, [await mockVRF.getAddress()], {
    kind: "uups"
  })) as unknown as World;

  await setDailyAndWeeklyRewards(world);

  const Treasury = await ethers.getContractFactory("Treasury");
  const treasury = (await upgrades.deployProxy(Treasury, [await brush.getAddress()], {
    kind: "uups"
  })) as unknown as Treasury;

  const minItemQuantityBeforeSellsAllowed = 500n;
  const sellingCutoffDuration = 48 * 3600; // 48 hours
  const Shop = await ethers.getContractFactory("Shop");
  const shop = (await upgrades.deployProxy(
    Shop,
    [
      await brush.getAddress(),
      await treasury.getAddress(),
      dev.address,
      minItemQuantityBeforeSellsAllowed,
      sellingCutoffDuration
    ],
    {
      kind: "uups"
    }
  )) as unknown as Shop;

  const router = (await ethers.deployContract("MockRouter")) as MockRouter;
  const RoyaltyReceiver = await ethers.getContractFactory("RoyaltyReceiver");
  const royaltyReceiver = (await upgrades.deployProxy(
    RoyaltyReceiver,
    [await router.getAddress(), await shop.getAddress(), dev.address, await brush.getAddress(), alice.address],
    {
      kind: "uups"
    }
  )) as unknown as RoyaltyReceiver;

  const admins = [owner.address, alice.address];
  const AdminAccess = await ethers.getContractFactory("AdminAccess");
  const adminAccess = (await upgrades.deployProxy(AdminAccess, [admins, admins], {
    kind: "uups"
  })) as unknown as AdminAccess;

  const isBeta = true;

  const ItemNFTLibrary = await ethers.getContractFactory("ItemNFTLibrary");
  const itemNFTLibrary = await ItemNFTLibrary.deploy();
  const ItemNFT = await ethers.getContractFactory("ItemNFT", {
    libraries: {ItemNFTLibrary: await itemNFTLibrary.getAddress()}
  });
  const itemsUri = "ipfs://";
  const itemNFT = (await upgrades.deployProxy(
    ItemNFT,
    [await royaltyReceiver.getAddress(), itemsUri, await adminAccess.getAddress(), isBeta],
    {
      kind: "uups",
      unsafeAllow: ["external-library-linking"]
    }
  )) as unknown as ItemNFT;

  await shop.setItemNFT(itemNFT);

  const startPlayerId = 1;
  // Create NFT contract which contains all the players
  const estforLibrary = (await ethers.deployContract("EstforLibrary")) as EstforLibrary;
  const PlayerNFT = await ethers.getContractFactory("PlayerNFT", {
    libraries: {EstforLibrary: await estforLibrary.getAddress()}
  });
  const editNameBrushPrice = parseEther("1");
  const upgradePlayerBrushPrice = parseEther("1");
  const imageBaseUri = "ipfs://";
  const playerNFT = (await upgrades.deployProxy(
    PlayerNFT,
    [
      await brush.getAddress(),
      await shop.getAddress(),
      dev.address,
      await royaltyReceiver.getAddress(),
      editNameBrushPrice,
      upgradePlayerBrushPrice,
      imageBaseUri,
      startPlayerId,
      isBeta
    ],
    {
      kind: "uups",
      unsafeAllow: ["external-library-linking"]
    }
  )) as unknown as PlayerNFT;

  const buyPath: [string, string] = [alice.address, await brush.getAddress()];
  const Quests = await ethers.getContractFactory("Quests");
  const quests = (await upgrades.deployProxy(Quests, [await world.getAddress(), await router.getAddress(), buyPath], {
    kind: "uups"
  })) as unknown as Quests;

  const paintSwapMarketplaceWhitelist = await ethers.deployContract("MockPaintSwapMarketplaceWhitelist");
  const initialMMR = 500;

  const Clans = await ethers.getContractFactory("Clans", {
    libraries: {EstforLibrary: await estforLibrary.getAddress()}
  });
  const clans = (await upgrades.deployProxy(
    Clans,
    [
      await brush.getAddress(),
      await playerNFT.getAddress(),
      await shop.getAddress(),
      dev.address,
      editNameBrushPrice,
      await paintSwapMarketplaceWhitelist.getAddress(),
      initialMMR
    ],
    {
      kind: "uups",
      unsafeAllow: ["external-library-linking"]
    }
  )) as unknown as Clans;

  const WishingWell = await ethers.getContractFactory("WishingWell");
  const wishingWell = (await upgrades.deployProxy(
    WishingWell,
    [
      await brush.getAddress(),
      await playerNFT.getAddress(),
      await shop.getAddress(),
      await world.getAddress(),
      await clans.getAddress(),
      parseEther("5"),
      parseEther("1000"),
      parseEther("250")
    ],
    {
      kind: "uups"
    }
  )) as unknown as WishingWell;

  const petNFTLibrary = await ethers.deployContract("PetNFTLibrary");
  const PetNFT = await ethers.getContractFactory("PetNFT", {
    libraries: {EstforLibrary: await estforLibrary.getAddress(), PetNFTLibrary: await petNFTLibrary.getAddress()}
  });
  const petNFT = (await upgrades.deployProxy(
    PetNFT,
    [
      await brush.getAddress(),
      await royaltyReceiver.getAddress(),
      imageBaseUri,
      dev.address,
      editNameBrushPrice,
      await treasury.getAddress(),
      await world.getAddress(),
      await adminAccess.getAddress(),
      isBeta
    ],
    {
      kind: "uups",
      unsafeAllow: ["external-library-linking"]
    }
  )) as unknown as PetNFT;

  // This contains all the player data
  const playersLibrary = await ethers.deployContract("PlayersLibrary");
  const playersImplQueueActions = await ethers.deployContract("PlayersImplQueueActions", {
    libraries: {PlayersLibrary: await playersLibrary.getAddress()}
  });
  const playersImplProcessActions = await ethers.deployContract("PlayersImplProcessActions", {
    libraries: {PlayersLibrary: await playersLibrary.getAddress()}
  });
  const playersImplRewards = await ethers.deployContract("PlayersImplRewards", {
    libraries: {PlayersLibrary: await playersLibrary.getAddress()}
  });
  const playersImplMisc = await ethers.deployContract("PlayersImplMisc", {
    libraries: {PlayersLibrary: await playersLibrary.getAddress()}
  });
  const playersImplMisc1 = await ethers.deployContract("PlayersImplMisc1", {
    libraries: {PlayersLibrary: await playersLibrary.getAddress()}
  });

  const Players = await ethers.getContractFactory("Players");
  const players = (await upgrades.deployProxy(
    Players,
    [
      await itemNFT.getAddress(),
      await playerNFT.getAddress(),
      await petNFT.getAddress(),
      await worldActions.getAddress(),
      await world.getAddress(),
      await adminAccess.getAddress(),
      await quests.getAddress(),
      await clans.getAddress(),
      await wishingWell.getAddress(),
      await playersImplQueueActions.getAddress(),
      await playersImplProcessActions.getAddress(),
      await playersImplRewards.getAddress(),
      await playersImplMisc.getAddress(),
      await playersImplMisc1.getAddress(),
      isBeta
    ],
    {
      kind: "uups",
      unsafeAllow: ["delegatecall"]
    }
  )) as unknown as Players;

  const promotionsLibrary = (await ethers.deployContract("PromotionsLibrary")) as PromotionsLibrary;
  const Promotions = await ethers.getContractFactory("Promotions", {
    libraries: {PromotionsLibrary: await promotionsLibrary.getAddress()}
  });
  const promotions = (await upgrades.deployProxy(
    Promotions,
    [
      await players.getAddress(),
      await world.getAddress(),
      await itemNFT.getAddress(),
      await playerNFT.getAddress(),
      await quests.getAddress(),
      await brush.getAddress(),
      await treasury.getAddress(),
      await dev.getAddress(),
      await adminAccess.getAddress(),
      isBeta
    ],
    {
      kind: "uups",
      unsafeAllow: ["external-library-linking"]
    }
  )) as unknown as Promotions;

  const InstantActions = await ethers.getContractFactory("InstantActions");
  const instantActions = (await upgrades.deployProxy(
    InstantActions,
    [await players.getAddress(), await itemNFT.getAddress(), await quests.getAddress()],
    {
      kind: "uups"
    }
  )) as unknown as InstantActions;

  const oracleAddress = dev.address;

  const VRFRequestInfo = await ethers.getContractFactory("VRFRequestInfo");
  const vrfRequestInfo = (await upgrades.deployProxy(VRFRequestInfo, [], {
    kind: "uups"
  })) as unknown as VRFRequestInfo;

  const maxInstantVRFActionAmount = 64n;
  const InstantVRFActions = await ethers.getContractFactory("InstantVRFActions");
  const instantVRFActions = (await upgrades.deployProxy(
    InstantVRFActions,
    [
      await players.getAddress(),
      await itemNFT.getAddress(),
      await petNFT.getAddress(),
      await quests.getAddress(),
      oracleAddress,
      await mockVRF.getAddress(),
      await vrfRequestInfo.getAddress(),
      maxInstantVRFActionAmount
    ],
    {
      kind: "uups"
    }
  )) as unknown as InstantVRFActions;

  const GenericInstantVRFActionStrategy = await ethers.getContractFactory("GenericInstantVRFActionStrategy");
  const genericInstantVRFActionStrategy = (await upgrades.deployProxy(
    GenericInstantVRFActionStrategy,
    [await instantVRFActions.getAddress()],
    {
      kind: "uups"
    }
  )) as unknown as GenericInstantVRFActionStrategy;

  const EggInstantVRFActionStrategy = await ethers.getContractFactory("EggInstantVRFActionStrategy");
  const eggInstantVRFActionStrategy = (await upgrades.deployProxy(
    EggInstantVRFActionStrategy,
    [await instantVRFActions.getAddress()],
    {
      kind: "uups"
    }
  )) as unknown as EggInstantVRFActionStrategy;

  const BankRelay = await ethers.getContractFactory("BankRelay");
  const bankRelay = (await upgrades.deployProxy(BankRelay, [await clans.getAddress()], {
    kind: "uups"
  })) as unknown as BankRelay;

  const WrappedNative = await ethers.getContractFactory("WrappedNative");
  const wftm = await WrappedNative.deploy();

  const brushPerSecond = parseEther("2");
  const {timestamp: NOW} = (await ethers.provider.getBlock("latest")) as Block;

  const pvpAttackingCooldown = 3600; // 1 hour
  const PVPBattleground = await ethers.getContractFactory("PVPBattleground");
  const pvpBattleground = (await upgrades.deployProxy(
    PVPBattleground,
    [
      await players.getAddress(),
      await playerNFT.getAddress(),
      await brush.getAddress(),
      await itemNFT.getAddress(),
      oracleAddress,
      await mockVRF.getAddress(),
      await vrfRequestInfo.getAddress(),
      allBattleSkills,
      pvpAttackingCooldown,
      await adminAccess.getAddress(),
      isBeta
    ],
    {
      kind: "uups"
    }
  )) as unknown as PVPBattleground;

  const spawnRaidCooldown = 8 * 3600; // 8 hours
  const maxRaidCombatants = 20;
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
    EstforConstants.ACTION_COMBAT_MONTANITE_FIRE_TITAN
  ];
  const Raids = await ethers.getContractFactory("Raids", {
    libraries: {
      PlayersLibrary: await playersLibrary.getAddress()
    }
  });
  const raids = (await upgrades.deployProxy(
    Raids,
    [
      await players.getAddress(),
      await itemNFT.getAddress(),
      await clans.getAddress(),
      oracleAddress,
      await mockVRF.getAddress(),
      await vrfRequestInfo.getAddress(),
      spawnRaidCooldown,
      await brush.getAddress(),
      await worldActions.getAddress(),
      await world.getAddress(),
      maxRaidCombatants,
      raidCombatActionIds,
      isBeta
    ],
    {
      kind: "uups",
      unsafeAllow: ["external-library-linking"]
    }
  )) as unknown as Raids;

  const clanBattleLibrary = (await ethers.deployContract("ClanBattleLibrary")) as ClanBattleLibrary;

  const decorator = await ethers.deployContract("TestPaintSwapDecorator", [
    await brush.getAddress(),
    await wftm.getAddress(),
    brushPerSecond,
    NOW
  ]);

  const lockedBankVaultsLibrary = await ethers.deployContract("LockedBankVaultsLibrary");
  const mmrAttackDistance = 4;
  const lockedFundsPeriod = 7 * 86400; // 7 days
  const maxClanComabtantsLockedBankVaults = 20;
  const maxLockedVaults = 100;
  const LockedBankVaults = await ethers.getContractFactory("LockedBankVaults", {
    libraries: {
      EstforLibrary: await estforLibrary.getAddress(),
      LockedBankVaultsLibrary: await lockedBankVaultsLibrary.getAddress(),
      ClanBattleLibrary: await clanBattleLibrary.getAddress()
    }
  });
  const lockedBankVaults = (await upgrades.deployProxy(
    LockedBankVaults,
    [
      await players.getAddress(),
      await clans.getAddress(),
      await brush.getAddress(),
      await bankRelay.getAddress(),
      await itemNFT.getAddress(),
      await treasury.getAddress(),
      dev.address,
      oracleAddress,
      await mockVRF.getAddress(),
      await vrfRequestInfo.getAddress(),
      allBattleSkills,
      mmrAttackDistance,
      lockedFundsPeriod,
      maxClanComabtantsLockedBankVaults,
      maxLockedVaults,
      await adminAccess.getAddress(),
      isBeta
    ],
    {
      kind: "uups",
      unsafeAllow: ["external-library-linking"]
    }
  )) as unknown as LockedBankVaults;

  // Set K values to 3, 3 to make it easier to get consistent values close to each for same MMR testing
  await lockedBankVaults.setKValues(3, 3);

  const maxClanCombatantsTerritories = 20;
  const attackingCooldownTerritories = 24 * 3600; // 1 day
  const minHarvestInterval = BigInt(3.75 * 3600); // 3 hours 45 minutes;
  const Territories = await ethers.getContractFactory("Territories");
  const territories = (await upgrades.deployProxy(
    Territories,
    [
      allTerritories,
      await players.getAddress(),
      await clans.getAddress(),
      await brush.getAddress(),
      await lockedBankVaults.getAddress(),
      await itemNFT.getAddress(),
      oracleAddress,
      await mockVRF.getAddress(),
      await vrfRequestInfo.getAddress(),
      allBattleSkills,
      maxClanCombatantsTerritories,
      attackingCooldownTerritories,
      await adminAccess.getAddress(),
      isBeta
    ],
    {
      kind: "uups",
      unsafeAllow: ["external-library-linking"]
    }
  )) as unknown as Territories;

  const CombatantsHelper = await ethers.getContractFactory("CombatantsHelper", {
    libraries: {EstforLibrary: await estforLibrary.getAddress()}
  });
  const combatantsHelper = (await upgrades.deployProxy(
    CombatantsHelper,
    [
      await players.getAddress(),
      await clans.getAddress(),
      await territories.getAddress(),
      await lockedBankVaults.getAddress(),
      await raids.getAddress(),
      await adminAccess.getAddress(),
      isBeta
    ],
    {
      kind: "uups",
      unsafeAllow: ["external-library-linking"]
    }
  )) as unknown as CombatantsHelper;

  const PassiveActions = await ethers.getContractFactory("PassiveActions");
  const passiveActions = (await upgrades.deployProxy(
    PassiveActions,
    [await players.getAddress(), await itemNFT.getAddress(), await world.getAddress()],
    {
      kind: "uups"
    }
  )) as unknown as PassiveActions;

  const Bank = await ethers.getContractFactory("Bank");
  const bank = (await upgrades.deployBeacon(Bank)) as unknown as Bank;

  const BankRegistry = await ethers.getContractFactory("BankRegistry");
  const bankRegistry = (await upgrades.deployProxy(BankRegistry, [], {
    kind: "uups"
  })) as unknown as BankRegistry;

  const BankFactory = await ethers.getContractFactory("BankFactory");
  const bankFactory = (await upgrades.deployProxy(
    BankFactory,
    [
      await bank.getAddress(),
      await bankRegistry.getAddress(),
      await bankRelay.getAddress(),
      await playerNFT.getAddress(),
      await itemNFT.getAddress(),
      await clans.getAddress(),
      await players.getAddress(),
      await lockedBankVaults.getAddress(),
      await raids.getAddress()
    ],
    {
      kind: "uups"
    }
  )) as unknown as BankFactory;

  await world.setWishingWell(wishingWell);

  await playerNFT.setPlayers(players);
  await quests.setPlayers(players);
  await wishingWell.setPlayers(players);

  await petNFT.initializeAddresses(instantVRFActions, players, territories);

  await clans.initializeAddresses(
    players,
    bankFactory,
    territories,
    lockedBankVaults,
    raids,
    paintSwapMarketplaceWhitelist
  );

  await playerNFT.setBrushDistributionPercentages(25, 50, 25);
  await petNFT.setBrushDistributionPercentages(25, 50, 25);
  await shop.setBrushDistributionPercentages(25, 50, 25);
  await promotions.setBrushDistributionPercentages(25, 50, 25);
  await lockedBankVaults.setBrushDistributionPercentages(25, 50, 25);
  await clans.setBrushDistributionPercentages(25, 50, 25);

  const treasuryAccounts = [await shop.getAddress(), ethers.ZeroAddress];
  const treasuryPercentages = [10, 90];
  await treasury.setFundAllocationPercentages(treasuryAccounts, treasuryPercentages);
  await treasury.setSpenders([shop], true);

  await bankRelay.setBankFactory(bankFactory);

  await itemNFT.initializeAddresses(bankFactory, players);
  await itemNFT.setApproved(
    [
      players,
      shop,
      promotions,
      instantActions,
      territories,
      lockedBankVaults,
      instantVRFActions,
      passiveActions,
      raids
    ],
    true
  );

  await royaltyReceiver.setTerritories(territories);
  await territories.setCombatantsHelper(combatantsHelper);
  await raids.initializeAddresses(combatantsHelper, bankFactory);
  await lockedBankVaults.initializeAddresses(territories, combatantsHelper, bankFactory);
  await vrfRequestInfo.setUpdaters([instantVRFActions, lockedBankVaults, territories, pvpBattleground], true);

  await players.setAlphaCombatParams(1, 1, 0); // Alpha combat healing was introduced later, so to not mess up existing tests set this to 0

  const avatarId = 1;
  const avatarInfo: AvatarInfo = {
    name: "Name goes here",
    description: "Hi I'm a description",
    imageURI: "1234.png",
    startSkills: [Skill.MAGIC, Skill.NONE]
  };
  await playerNFT.setAvatars([avatarId], [avatarInfo]);

  const origName = "0xSamWitch";
  const makeActive = true;
  const playerId = await createPlayer(playerNFT, avatarId, alice, origName, makeActive);
  const maxTime = MAX_TIME;

  return {
    playerId,
    players,
    playerNFT,
    itemNFT,
    brush,
    maxTime,
    owner,
    worldActions,
    world,
    alice,
    bob,
    charlie,
    dev,
    erin,
    frank,
    origName,
    editNameBrushPrice,
    upgradePlayerBrushPrice,
    mockVRF,
    avatarInfo,
    adminAccess,
    treasury,
    shop,
    royaltyReceiver,
    playersImplProcessActions,
    playersImplQueueActions,
    playersImplRewards,
    playersImplMisc,
    playersImplMisc1,
    Players,
    avatarId,
    wishingWell,
    promotionsLibrary,
    promotions,
    quests,
    clans,
    bank,
    Bank,
    bankRegistry,
    bankFactory,
    bankRelay,
    BankRelay,
    estforLibrary,
    paintSwapMarketplaceWhitelist,
    passiveActions,
    playersLibrary,
    instantActions,
    clanBattleLibrary,
    decorator,
    brushPerSecond,
    mmrAttackDistance,
    lockedBankVaults,
    territories,
    combatantsHelper,
    vrfRequestInfo,
    instantVRFActions,
    genericInstantVRFActionStrategy,
    eggInstantVRFActionStrategy,
    oracleAddress,
    petNFT,
    PetNFT,
    lockedBankVaultsLibrary,
    lockedFundsPeriod,
    initialMMR,
    maxLockedVaults,
    sellingCutoffDuration,
    maxInstantVRFActionAmount,
    minHarvestInterval,
    isBeta,
    pvpBattleground,
    pvpAttackingCooldown,
    raids,
    spawnRaidCooldown,
    maxRaidCombatants
  };
};
