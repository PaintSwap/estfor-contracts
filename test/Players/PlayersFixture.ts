import {Skill} from "@paintswap/estfor-definitions/types";
import {deployments, ethers, upgrades} from "hardhat";
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
  MockRouter,
  PassiveActions,
  PetNFT,
  PlayerNFT,
  Players,
  Promotions,
  Quests,
  RoyaltyReceiver,
  Shop,
  Territories,
  WishingWell,
  RandomnessBeacon,
  Treasury,
  BankRelay,
  PVPBattleground,
  Raids,
  WorldActions,
  DailyRewardsScheduler,
  Bridge,
  ActivityPoints
} from "../../typechain-types";
import {MAX_TIME} from "../utils";
import {allTerritories, allBattleSkills} from "../../scripts/data/territories";
import {ContractFactory, parseEther} from "ethers";
import {EstforConstants} from "@paintswap/estfor-definitions";
import {ACTIVITY_TICKET, SONIC_GEM_TICKET} from "@paintswap/estfor-definitions/constants";

export const playersFixture = async function () {
  const [owner, alice, bob, charlie, dev, erin, frank] = await ethers.getSigners();

  const brush = await ethers.deployContract("MockBrushToken");
  const mockVRF = await ethers.deployContract("MockVRF");

  const EndpointV2MockArtifact = await deployments.getArtifact("EndpointV2Mock");
  const EndpointV2Mock = new ContractFactory(EndpointV2MockArtifact.abi, EndpointV2MockArtifact.bytecode, owner);
  const endpointId = 30112; // fantom
  const lzEndpoint = await EndpointV2Mock.deploy(endpointId, owner);

  const Bridge = await ethers.getContractFactory("Bridge");
  const srcEid = 30112; // Fantom
  const bridge = (await upgrades.deployProxy(Bridge, [srcEid], {
    kind: "uups",
    constructorArgs: [await lzEndpoint.getAddress()],
    unsafeAllow: ["delegatecall", "constructor", "state-variable-immutable"]
  })) as unknown as Bridge;

  const WorldActions = await ethers.getContractFactory("WorldActions");
  const worldActions = (await upgrades.deployProxy(WorldActions, [], {
    kind: "uups"
  })) as unknown as WorldActions;

  // Add some dummy blocks so that the randomness beacon can access previous blocks for random numbers
  for (let i = 0; i < 5; ++i) {
    await owner.sendTransaction({
      to: owner.address,
      value: 1,
      maxFeePerGas: 1
    });
  }

  const RandomnessBeacon = await ethers.getContractFactory("RandomnessBeacon");
  const randomnessBeacon = (await upgrades.deployProxy(RandomnessBeacon, [await mockVRF.getAddress()], {
    kind: "uups"
  })) as unknown as RandomnessBeacon;

  await owner.sendTransaction({
    to: await randomnessBeacon.getAddress(),
    value: ethers.parseEther("1")
  });

  const DailyRewardsScheduler = await ethers.getContractFactory("DailyRewardsScheduler");
  const dailyRewardsScheduler = (await upgrades.deployProxy(
    DailyRewardsScheduler,
    [await randomnessBeacon.getAddress()],
    {
      kind: "uups"
    }
  )) as unknown as DailyRewardsScheduler;

  await setDailyAndWeeklyRewards(dailyRewardsScheduler);

  const Treasury = await ethers.getContractFactory("Treasury");
  const treasury = (await upgrades.deployProxy(Treasury, [await brush.getAddress()], {
    kind: "uups"
  })) as unknown as Treasury;

  const router = (await ethers.deployContract("MockRouter")) as MockRouter;
  const RoyaltyReceiver = await ethers.getContractFactory("RoyaltyReceiver");
  const royaltyReceiver = (await upgrades.deployProxy(
    RoyaltyReceiver,
    [
      await router.getAddress(),
      await treasury.getAddress(),
      await dev.getAddress(),
      await brush.getAddress(),
      alice.address
    ],
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

  const ActivityPoints = await ethers.getContractFactory("ActivityPoints");
  const activityPoints = (await upgrades.deployProxy(
    ActivityPoints,
    [await itemNFT.getAddress(), ACTIVITY_TICKET, SONIC_GEM_TICKET],
    {
      kind: "uups"
    }
  )) as unknown as ActivityPoints;
  await itemNFT.setApproved([activityPoints], true);

  const minItemQuantityBeforeSellsAllowed = 500n;
  const sellingCutoffDuration = 48 * 3600; // 48 hours
  const Shop = await ethers.getContractFactory("Shop");
  const shop = (await upgrades.deployProxy(
    Shop,
    [
      await brush.getAddress(),
      await treasury.getAddress(),
      await dev.getAddress(),
      minItemQuantityBeforeSellsAllowed,
      sellingCutoffDuration
    ],
    {
      kind: "uups"
    }
  )) as unknown as Shop;

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
      await treasury.getAddress(),
      await dev.getAddress(),
      await royaltyReceiver.getAddress(),
      editNameBrushPrice,
      upgradePlayerBrushPrice,
      imageBaseUri,
      startPlayerId,
      isBeta,
      await bridge.getAddress()
    ],
    {
      kind: "uups",
      unsafeAllow: ["external-library-linking"]
    }
  )) as unknown as PlayerNFT;

  const buyPath: [string, string] = [alice.address, await brush.getAddress()];
  const Quests = await ethers.getContractFactory("Quests");
  const quests = (await upgrades.deployProxy(
    Quests,
    [
      await randomnessBeacon.getAddress(),
      await bridge.getAddress(),
      await router.getAddress(),
      buyPath,
      await activityPoints.getAddress()
    ],
    {
      kind: "uups"
    }
  )) as unknown as Quests;

  const paintSwapMarketplaceWhitelist = await ethers.deployContract("MockPaintSwapMarketplaceWhitelist");
  const initialMMR = 500;
  const startClanId = 1;
  const Clans = await ethers.getContractFactory("Clans", {
    libraries: {EstforLibrary: await estforLibrary.getAddress()}
  });
  const clans = (await upgrades.deployProxy(
    Clans,
    [
      await brush.getAddress(),
      await playerNFT.getAddress(),
      await treasury.getAddress(),
      await dev.getAddress(),
      editNameBrushPrice,
      await paintSwapMarketplaceWhitelist.getAddress(),
      initialMMR,
      startClanId,
      await bridge.getAddress(),
      await activityPoints.getAddress()
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
      await treasury.getAddress(),
      await randomnessBeacon.getAddress(),
      await clans.getAddress(),
      parseEther("5"),
      parseEther("1000"),
      parseEther("250"),
      await activityPoints.getAddress()
    ],
    {
      kind: "uups"
    }
  )) as unknown as WishingWell;

  const startPetId = 1;
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
      await dev.getAddress(),
      editNameBrushPrice,
      await treasury.getAddress(),
      await randomnessBeacon.getAddress(),
      startPetId,
      await bridge.getAddress(),
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
  const playersImplMisc1 = await ethers.deployContract("PlayersImplMisc1");

  const Players = await ethers.getContractFactory("Players");
  const players = (await upgrades.deployProxy(
    Players,
    [
      await itemNFT.getAddress(),
      await playerNFT.getAddress(),
      await petNFT.getAddress(),
      await worldActions.getAddress(),
      await randomnessBeacon.getAddress(),
      await dailyRewardsScheduler.getAddress(),
      await adminAccess.getAddress(),
      await quests.getAddress(),
      await clans.getAddress(),
      await wishingWell.getAddress(),
      await playersImplQueueActions.getAddress(),
      await playersImplProcessActions.getAddress(),
      await playersImplRewards.getAddress(),
      await playersImplMisc.getAddress(),
      await playersImplMisc1.getAddress(),
      await bridge.getAddress(),
      await activityPoints.getAddress(),
      isBeta
    ],
    {
      kind: "uups",
      unsafeAllow: ["delegatecall"]
    }
  )) as unknown as Players;

  const promotionsLibrary = await ethers.deployContract("PromotionsLibrary");
  const Promotions = await ethers.getContractFactory("Promotions", {
    libraries: {PromotionsLibrary: await promotionsLibrary.getAddress()}
  });
  const promotions = (await upgrades.deployProxy(
    Promotions,
    [
      await players.getAddress(),
      await randomnessBeacon.getAddress(),
      await dailyRewardsScheduler.getAddress(),
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
    [
      await players.getAddress(),
      await itemNFT.getAddress(),
      await quests.getAddress(),
      await activityPoints.getAddress()
    ],
    {
      kind: "uups"
    }
  )) as unknown as InstantActions;

  const oracleAddress = await dev.getAddress();

  const maxInstantVRFActionAmount = 64n;
  const InstantVRFActions = await ethers.getContractFactory("InstantVRFActions");
  const instantVRFActions = (await upgrades.deployProxy(
    InstantVRFActions,
    [
      await players.getAddress(),
      await itemNFT.getAddress(),
      await petNFT.getAddress(),
      await quests.getAddress(),
      await mockVRF.getAddress(),
      maxInstantVRFActionAmount,
      await activityPoints.getAddress()
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

  const pvpAttackingCooldown = 3600; // 1 hour
  const PVPBattleground = await ethers.getContractFactory("PVPBattleground");
  const pvpBattleground = (await upgrades.deployProxy(
    PVPBattleground,
    [
      await players.getAddress(),
      await playerNFT.getAddress(),
      await brush.getAddress(),
      await itemNFT.getAddress(),
      await mockVRF.getAddress(),
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
      await mockVRF.getAddress(),
      spawnRaidCooldown,
      await brush.getAddress(),
      await worldActions.getAddress(),
      await randomnessBeacon.getAddress(),
      maxRaidCombatants,
      raidCombatActionIds,
      isBeta
    ],
    {
      kind: "uups",
      unsafeAllow: ["external-library-linking"]
    }
  )) as unknown as Raids;

  await owner.sendTransaction({
    to: await raids.getAddress(),
    value: ethers.parseEther("10")
  });

  const clanBattleLibrary = (await ethers.deployContract("ClanBattleLibrary")) as ClanBattleLibrary;

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
      await dev.getAddress(),
      await mockVRF.getAddress(),
      allBattleSkills,
      mmrAttackDistance,
      lockedFundsPeriod,
      maxClanComabtantsLockedBankVaults,
      maxLockedVaults,
      await adminAccess.getAddress(),
      await activityPoints.getAddress(),
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
      await mockVRF.getAddress(),
      allBattleSkills,
      maxClanCombatantsTerritories,
      attackingCooldownTerritories,
      await adminAccess.getAddress(),
      await activityPoints.getAddress(),
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
    [
      await players.getAddress(),
      await itemNFT.getAddress(),
      await randomnessBeacon.getAddress(),
      await bridge.getAddress(),
      await activityPoints.getAddress()
    ],
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

  await bankRegistry.setForceItemDepositors(
    [await raids.getAddress(), await activityPoints.getAddress()],
    [true, true]
  );

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

  await randomnessBeacon.initializeAddresses(wishingWell, dailyRewardsScheduler);
  await randomnessBeacon.initializeRandomWords();

  await playerNFT.setPlayers(players);
  await quests.setPlayers(players);
  await wishingWell.setPlayers(players);

  await petNFT.initializeAddresses(instantVRFActions, players, territories);

  await clans.initializeAddresses(players, bankFactory, territories, lockedBankVaults, raids);

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

  await territories.setCombatantsHelper(combatantsHelper);
  await raids.initializeAddresses(combatantsHelper, bankFactory);
  await lockedBankVaults.initializeAddresses(territories, combatantsHelper, bankFactory);
  await clans.setXPModifiers([lockedBankVaults, territories, wishingWell], true);
  await players.setAlphaCombatParams(1, 1, 0); // Alpha combat healing was introduced later, so to not mess up existing tests set this to 0

  // Set activity points on all contracts
  const contracts = [
    lockedBankVaults,
    territories,
    instantVRFActions,
    instantActions,
    players,
    wishingWell,
    clans,
    quests,
    shop,
    passiveActions
  ];

  await activityPoints.addCallers(contracts);

  for (const address of contracts) {
    const contract = await ethers.getContractAt("IActivityPointsCaller", address);
    await contract.setActivityPoints(await activityPoints.getAddress());
  }

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
    randomnessBeacon,
    dailyRewardsScheduler,
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
    mmrAttackDistance,
    lockedBankVaults,
    territories,
    combatantsHelper,
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
    maxRaidCombatants,
    startPetId,
    bridge,
    activityPoints
  };
};
