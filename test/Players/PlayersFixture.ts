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
  WorldLibrary
} from "../../typechain-types";
import {MAX_TIME} from "../utils";
import {allTerritories, allBattleSkills} from "../../scripts/data/territories";
import {Block, parseEther} from "ethers";

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
  const worldLibrary = (await ethers.deployContract("WorldLibrary")) as WorldLibrary;
  const World = await ethers.getContractFactory("World", {libraries: {WorldLibrary: await worldLibrary.getAddress()}});
  const world = (await upgrades.deployProxy(World, [await mockVRF.getAddress()], {
    kind: "uups",
    unsafeAllow: ["delegatecall", "external-library-linking"]
  })) as unknown as World;

  await setDailyAndWeeklyRewards(world);

  const Shop = await ethers.getContractFactory("Shop");
  const shop = (await upgrades.deployProxy(Shop, [await brush.getAddress(), dev.address], {
    kind: "uups"
  })) as unknown as Shop;

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
    [
      await world.getAddress(),
      await shop.getAddress(),
      await royaltyReceiver.getAddress(),
      await adminAccess.getAddress(),
      itemsUri,
      isBeta
    ],
    {
      kind: "uups",
      unsafeAllow: ["external-library-linking"]
    }
  )) as unknown as ItemNFT;

  await shop.setItemNFT(await itemNFT.getAddress());
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
      isBeta
    ],
    {
      kind: "uups",
      unsafeAllow: ["external-library-linking"]
    }
  )) as unknown as PlayerNFT;

  const promotionsLibrary = (await ethers.deployContract("PromotionsLibrary")) as PromotionsLibrary;
  const Promotions = await ethers.getContractFactory("Promotions", {
    libraries: {PromotionsLibrary: await promotionsLibrary.getAddress()}
  });
  const promotions = (await upgrades.deployProxy(
    Promotions,
    [await adminAccess.getAddress(), await itemNFT.getAddress(), await playerNFT.getAddress(), isBeta],
    {
      kind: "uups",
      unsafeAllow: ["external-library-linking"]
    }
  )) as unknown as Promotions;

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
      parseEther("250"),
      isBeta
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
      await adminAccess.getAddress(),
      isBeta
    ],
    {
      kind: "uups",
      unsafeAllow: ["delegatecall", "external-library-linking"]
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
      unsafeAllow: ["delegatecall", "external-library-linking"]
    }
  )) as unknown as Players;

  const Bank = await ethers.getContractFactory("Bank");
  const bank = (await upgrades.deployBeacon(Bank)) as unknown as Bank;

  const BankRegistry = await ethers.getContractFactory("BankRegistry");
  const bankRegistry = (await upgrades.deployProxy(
    BankRegistry,
    [await itemNFT.getAddress(), await playerNFT.getAddress(), await clans.getAddress(), await players.getAddress()],
    {
      kind: "uups"
    }
  )) as unknown as BankRegistry;

  const BankFactory = await ethers.getContractFactory("BankFactory");
  const bankFactory = (await upgrades.deployProxy(
    BankFactory,
    [await bankRegistry.getAddress(), await bank.getAddress()],
    {
      kind: "uups"
    }
  )) as unknown as BankFactory;

  const InstantActions = await ethers.getContractFactory("InstantActions");
  const instantActions = (await upgrades.deployProxy(
    InstantActions,
    [await players.getAddress(), await itemNFT.getAddress()],
    {
      kind: "uups"
    }
  )) as unknown as InstantActions;

  const oracleAddress = dev.address;

  const VRFRequestInfo = await ethers.getContractFactory("VRFRequestInfo");
  const vrfRequestInfo = (await upgrades.deployProxy(VRFRequestInfo, [], {
    kind: "uups"
  })) as unknown as VRFRequestInfo;

  const InstantVRFActions = await ethers.getContractFactory("InstantVRFActions");
  const instantVRFActions = (await upgrades.deployProxy(
    InstantVRFActions,
    [
      await players.getAddress(),
      await itemNFT.getAddress(),
      await petNFT.getAddress(),
      oracleAddress,
      await mockVRF.getAddress(),
      await vrfRequestInfo.getAddress()
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

  const clanBattleLibrary = (await ethers.deployContract("ClanBattleLibrary")) as ClanBattleLibrary;

  const MockWrappedFantom = await ethers.getContractFactory("MockWrappedFantom");
  const wftm = await MockWrappedFantom.deploy();

  const artGalleryLockPeriod = 3600;
  const artGallery = await ethers.deployContract("TestPaintSwapArtGallery", [
    await brush.getAddress(),
    artGalleryLockPeriod
  ]);
  const brushPerSecond = parseEther("2");
  const {timestamp: NOW} = (await ethers.provider.getBlock("latest")) as Block;

  const decorator = await ethers.deployContract("TestPaintSwapDecorator", [
    await brush.getAddress(),
    await artGallery.getAddress(),
    await router.getAddress(),
    await wftm.getAddress(),
    brushPerSecond,
    NOW
  ]);

  await artGallery.transferOwnership(await decorator.getAddress());

  const lockedBankVaultsLibrary = await ethers.deployContract("LockedBankVaultsLibrary");
  const mmrAttackDistance = 4;
  const lockedFundsPeriod = 7 * 86400; // 7 days
  const LockedBankVaults = await ethers.getContractFactory("LockedBankVaults", {
    libraries: {
      EstforLibrary: await estforLibrary.getAddress(),
      LockedBankVaultsLibrary: await lockedBankVaultsLibrary.getAddress()
    }
  });
  const lockedBankVaults = (await upgrades.deployProxy(
    LockedBankVaults,
    [
      await players.getAddress(),
      await clans.getAddress(),
      await brush.getAddress(),
      await bankFactory.getAddress(),
      await itemNFT.getAddress(),
      await shop.getAddress(),
      dev.address,
      oracleAddress,
      await mockVRF.getAddress(),
      allBattleSkills,
      mmrAttackDistance,
      lockedFundsPeriod,
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
      allBattleSkills,
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
      await adminAccess.getAddress(),
      isBeta
    ],
    {
      kind: "uups",
      unsafeAllow: ["external-library-linking"]
    }
  )) as unknown as CombatantsHelper;

  const PassiveActions = await ethers.getContractFactory("PassiveActions", {
    libraries: {WorldLibrary: await worldLibrary.getAddress()}
  });
  const passiveActions = (await upgrades.deployProxy(
    PassiveActions,
    [await players.getAddress(), await itemNFT.getAddress(), await world.getAddress()],
    {
      kind: "uups",
      unsafeAllow: ["delegatecall", "external-library-linking"]
    }
  )) as unknown as PassiveActions;

  await world.setQuests(await quests.getAddress());
  await world.setWishingWell(await wishingWell.getAddress());

  await itemNFT.setPlayers(await players.getAddress());
  await playerNFT.setPlayers(await players.getAddress());
  await petNFT.setPlayers(await players.getAddress());
  await quests.setPlayers(await players.getAddress());
  await clans.setPlayers(await players.getAddress());
  await wishingWell.setPlayers(await players.getAddress());

  await itemNFT.setBankFactory(await bankFactory.getAddress());
  await clans.setBankFactory(await bankFactory.getAddress());

  await itemNFT.setPromotions(await promotions.getAddress());
  await itemNFT.setPassiveActions(await passiveActions.getAddress());
  await itemNFT.setInstantActions(await instantActions.getAddress());

  await itemNFT.setInstantVRFActions(await instantVRFActions.getAddress());
  await petNFT.setInstantVRFActions(await instantVRFActions.getAddress());

  await petNFT.setBrushDistributionPercentages(25, 0, 25, 50);

  await bankRegistry.setLockedBankVaults(await lockedBankVaults.getAddress());

  await clans.setTerritoriesAndLockedBankVaults(await territories.getAddress(), await lockedBankVaults.getAddress());
  await itemNFT.setTerritoriesAndLockedBankVaults(await territories.getAddress(), await lockedBankVaults.getAddress());
  await royaltyReceiver.setTerritories(await territories.getAddress());
  await petNFT.setTerritories(await territories.getAddress());
  await territories.setCombatantsHelper(await combatantsHelper.getAddress());
  await lockedBankVaults.setAddresses(await territories.getAddress(), await combatantsHelper.getAddress());

  await players.setAlphaCombatHealing(0); // This was introduced later, so to not mess up existing tests reset this to 0

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
    world,
    worldLibrary,
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
    estforLibrary,
    paintSwapMarketplaceWhitelist,
    passiveActions,
    playersLibrary,
    instantActions,
    clanBattleLibrary,
    artGallery,
    artGalleryLockPeriod,
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
    initialMMR
  };
};
