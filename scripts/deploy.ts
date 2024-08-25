import {EstforConstants} from "@paintswap/estfor-definitions";
import {ethers, upgrades} from "hardhat";
import {
  BankFactory,
  Clans,
  InstantActions,
  ItemNFT,
  MockVRF,
  MockBrushToken,
  MockPaintSwapMarketplaceWhitelist,
  MockRouter,
  MockWrappedFantom,
  PassiveActions,
  PlayerNFT,
  Players,
  Promotions,
  Quests,
  Shop,
  TestPaintSwapArtGallery,
  TestPaintSwapDecorator,
  World,
  InstantVRFActions,
  VRFRequestInfo,
  GenericInstantVRFActionStrategy,
  PetNFT,
  EggInstantVRFActionStrategy,
} from "../typechain-types";
import {
  deployMockPaintSwapContracts,
  deployPlayerImplementations,
  isBeta,
  isDevNetwork,
  setDailyAndWeeklyRewards,
  verifyContracts,
} from "./utils";
import {allItems} from "./data/items";
import {allActions} from "./data/actions";
import {
  allActionChoicesFiremaking,
  allActionChoicesCooking,
  allActionChoicesCrafting,
  allActionChoicesMagic,
  allActionChoicesMelee,
  allActionChoicesSmithing,
  allActionChoicesRanged,
  allActionChoicesAlchemy,
  allActionChoicesFletching,
  allActionChoicesForging,
} from "./data/actionChoices";
import {
  allActionChoiceIdsFiremaking,
  allActionChoiceIdsCooking,
  allActionChoiceIdsCrafting,
  allActionChoiceIdsMagic,
  allActionChoiceIdsMelee,
  allActionChoiceIdsSmithing,
  allActionChoiceIdsRanged,
  allActionChoiceIdsAlchemy,
  allActionChoiceIdsFletching,
  allActionChoiceIdsForging,
} from "./data/actionChoiceIds";
import {
  BAZAAR_ADDRESS,
  BRUSH_ADDRESS,
  DECORATOR_ADDRESS,
  DEV_ADDRESS,
  ORACLE_ADDRESS,
  SAMWITCH_VRF_ADDRESS,
  WFTM_ADDRESS,
} from "./contractAddresses";
import {addTestData} from "./addTestData";
import {whitelistedAdmins} from "@paintswap/estfor-definitions/constants";
import {BigNumber} from "ethers";
import {allShopItems, allShopItemsBeta} from "./data/shopItems";
import {allFullAttireBonuses} from "./data/fullAttireBonuses";
import {allXPThresholdRewards} from "./data/xpThresholdRewards";
import {avatarIds, avatarInfos} from "./data/avatars";
import {allQuestsMinRequirements, allQuests} from "./data/quests";
import {allClanTiers, allClanTiersBeta} from "./data/clans";
import {allInstantActions} from "./data/instantActions";
import {allTerritories, allBattleSkills, allMinimumMMRs} from "./data/territories";
import {allInstantVRFActions} from "./data/instantVRFActions";
import {InstantVRFActionType} from "@paintswap/estfor-definitions/types";
import {allBasePets} from "./data/pets";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Deploying contracts with the account: ${owner.address} on chain: ${await owner.getChainId()}`);
  const network = await ethers.provider.getNetwork();

  let brush: MockBrushToken;
  let wftm: MockWrappedFantom;
  let oracleAddress: string;
  let vrf: MockVRF;
  let router: MockRouter;
  let paintSwapMarketplaceWhitelist: MockPaintSwapMarketplaceWhitelist;
  let paintSwapDecorator: TestPaintSwapDecorator;
  let paintSwapArtGallery: TestPaintSwapArtGallery;
  let tx;
  let pid = 0;
  {
    const MockBrushToken = await ethers.getContractFactory("MockBrushToken");
    const MockWrappedFantom = await ethers.getContractFactory("MockWrappedFantom");
    const MockVRF = await ethers.getContractFactory("MockVRF");
    const MockRouter = await ethers.getContractFactory("MockRouter");
    const MockPaintSwapMarketplaceWhitelist = await ethers.getContractFactory("MockPaintSwapMarketplaceWhitelist");
    const TestPaintSwapArtGallery = await ethers.getContractFactory("TestPaintSwapArtGallery");
    const TestPaintSwapDecorator = await ethers.getContractFactory("TestPaintSwapDecorator");
    if (isDevNetwork(network)) {
      brush = await MockBrushToken.deploy();
      await brush.mint(owner.address, ethers.utils.parseEther("1000"));
      console.log("Minted brush");
      wftm = await MockWrappedFantom.deploy();
      console.log("Minted WFTM");
      oracleAddress = owner.address;
      vrf = await MockVRF.deploy();
      console.log(`mockVRF = "${vrf.address.toLowerCase()}"`);
      router = await MockRouter.deploy();
      console.log(`mockRouter = "${router.address.toLowerCase()}"`);
      ({paintSwapMarketplaceWhitelist, paintSwapDecorator, paintSwapArtGallery} = await deployMockPaintSwapContracts(
        brush,
        router,
        wftm
      ));
    } else if (network.chainId == 4002) {
      // Fantom testnet
      brush = await MockBrushToken.deploy();
      await brush.deployed();
      tx = await brush.mint(owner.address, ethers.utils.parseEther("1000"));
      console.log("Minted brush");
      await tx.wait();
      wftm = await MockWrappedFantom.attach("0xf1277d1ed8ad466beddf92ef448a132661956621");
      oracleAddress = "0x3d2341ADb2D31f1c5530cDC622016af293177AE0";
      vrf = await MockVRF.deploy();
      await vrf.deployed();
      console.log(`mockVRF = "${vrf.address.toLowerCase()}"`);
      router = await MockRouter.attach("0xa6AD18C2aC47803E193F75c3677b14BF19B94883");
      console.log(`mockRouter = "${router.address.toLowerCase()}"`);
      ({paintSwapMarketplaceWhitelist, paintSwapDecorator, paintSwapArtGallery} = await deployMockPaintSwapContracts(
        brush,
        router,
        wftm
      ));
    } else if (network.chainId == 250) {
      // Fantom mainnet
      brush = await MockBrushToken.attach(BRUSH_ADDRESS);
      wftm = await MockWrappedFantom.attach(WFTM_ADDRESS);
      oracleAddress = ORACLE_ADDRESS;
      vrf = await MockVRF.attach(SAMWITCH_VRF_ADDRESS);
      router = await MockRouter.attach("0x31F63A33141fFee63D4B26755430a390ACdD8a4d");
      paintSwapMarketplaceWhitelist = await MockPaintSwapMarketplaceWhitelist.attach(
        "0x7559038535f3d6ed6BAc5a54Ab4B69DA827F44BD"
      );
      paintSwapArtGallery = await TestPaintSwapArtGallery.attach("0x9076C96e01F6F13e1eC4832354dF970d245e124F");
      paintSwapDecorator = await TestPaintSwapDecorator.attach(DECORATOR_ADDRESS);
      pid = 22;
    } else {
      throw Error("Not a supported network");
    }
  }

  const timeout = 600 * 1000; // 10 minutes

  let itemsUri: string;
  let heroImageBaseUri: string;
  let petImageBaseUri: string;
  let editNameBrushPrice: BigNumber;
  let editPetNameBrushPrice: BigNumber;
  let upgradePlayerBrushPrice: BigNumber;
  let raffleEntryCost: BigNumber;
  let startGlobalDonationThresholdRewards: BigNumber;
  let clanDonationThresholdRewardIncrement: BigNumber;
  let mmrAttackDistance;
  // Some of these base uris likely out of date
  if (!isBeta) {
    // live version
    itemsUri = "ipfs://QmVDdbXtEDXh5AGEuHCEEjmAiEZJaMSpC4W36N3aZ3ToQd /";
    heroImageBaseUri = "ipfs://QmY5bwB4212iqziFapqFqUnN6dJk47D3f47HxseW1dX3aX/";
    petImageBaseUri = "ipfs://Qma93THZoAXmPR4Ug3JHmJxf3CYch3CxdAPipsxA5NGxsR/";
    editNameBrushPrice = ethers.utils.parseEther("1000");
    editPetNameBrushPrice = ethers.utils.parseEther("1");
    upgradePlayerBrushPrice = ethers.utils.parseEther("2000");
    raffleEntryCost = ethers.utils.parseEther("12");
    startGlobalDonationThresholdRewards = ethers.utils.parseEther("300000");
    clanDonationThresholdRewardIncrement = ethers.utils.parseEther("5000");
    mmrAttackDistance = 4;
  } else {
    itemsUri = "ipfs://QmZBtZ6iF7shuRxPc4q4cM3wNnDyJeqNgP7EkSWQqSgKnM/";
    heroImageBaseUri = "ipfs://QmY5bwB4212iqziFapqFqUnN6dJk47D3f47HxseW1dX3aX/";
    petImageBaseUri = "ipfs://QmcLcqcYwPRcTeBRaX8BtfDCpwZSrNzt22z5gAG3CRXTw7/";
    editNameBrushPrice = ethers.utils.parseEther("1");
    editPetNameBrushPrice = ethers.utils.parseEther("1");
    upgradePlayerBrushPrice = ethers.utils.parseEther("1");
    raffleEntryCost = ethers.utils.parseEther("5");
    startGlobalDonationThresholdRewards = ethers.utils.parseEther("1000");
    clanDonationThresholdRewardIncrement = ethers.utils.parseEther("50");
    mmrAttackDistance = 1;
  }

  const initialMMR = 500;

  // Create the world
  const WorldLibrary = await ethers.getContractFactory("WorldLibrary");
  const worldLibrary = await WorldLibrary.deploy();
  await worldLibrary.deployed();
  console.log(`worldLibrary = "${worldLibrary.address.toLowerCase()}"`);
  const World = await ethers.getContractFactory("World", {
    libraries: {WorldLibrary: worldLibrary.address},
  });
  const world = (await upgrades.deployProxy(World, [vrf.address], {
    kind: "uups",
    unsafeAllow: ["external-library-linking"],
    timeout,
  })) as World;
  await world.deployed();
  console.log(`world = "${world.address.toLowerCase()}"`);

  const Shop = await ethers.getContractFactory("Shop");
  const shop = (await upgrades.deployProxy(Shop, [brush.address, DEV_ADDRESS], {
    kind: "uups",
    timeout,
  })) as Shop;

  await shop.deployed();
  console.log(`shop = "${shop.address.toLowerCase()}"`);

  const RoyaltyReceiver = await ethers.getContractFactory("RoyaltyReceiver");
  const royaltyReceiver = await upgrades.deployProxy(
    RoyaltyReceiver,
    [router.address, shop.address, DEV_ADDRESS, brush.address, wftm.address],
    {
      kind: "uups",
      timeout,
    }
  );
  await royaltyReceiver.deployed();
  console.log(`royaltyReceiver = "${royaltyReceiver.address.toLowerCase()}"`);

  const admins = whitelistedAdmins.map((el) => ethers.utils.getAddress(el));
  if (!admins.includes(owner.address)) {
    admins.push(owner.address);
  }

  const promotionalAdmins = ["0xe9fb52d7611e502d93af381ac493981b42d91974"];
  const AdminAccess = await ethers.getContractFactory("AdminAccess");
  const adminAccess = await upgrades.deployProxy(AdminAccess, [admins, promotionalAdmins], {
    kind: "uups",
    timeout,
  });
  await adminAccess.deployed();
  console.log(`adminAccess = "${adminAccess.address.toLowerCase()}"`);

  // Create NFT contract which contains all items
  const itemNFTLibrary = await ethers.deployContract("ItemNFTLibrary");
  await itemNFTLibrary.deployed();
  console.log(`itemNFTLibrary = "${itemNFTLibrary.address.toLowerCase()}"`);
  const ItemNFT = await ethers.getContractFactory("ItemNFT", {libraries: {ItemNFTLibrary: itemNFTLibrary.address}});
  const itemNFT = (await upgrades.deployProxy(
    ItemNFT,
    [world.address, shop.address, royaltyReceiver.address, adminAccess.address, itemsUri, isBeta],
    {
      kind: "uups",
      unsafeAllow: ["external-library-linking"],
      timeout,
    }
  )) as ItemNFT;
  await itemNFT.deployed();
  console.log(`itemNFT = "${itemNFT.address.toLowerCase()}"`);

  // Create NFT contract which contains all the players
  const estforLibrary = await ethers.deployContract("EstforLibrary");
  await estforLibrary.deployed();
  console.log(`estforLibrary = "${estforLibrary.address.toLowerCase()}"`);
  const PlayerNFT = await ethers.getContractFactory("PlayerNFT", {
    libraries: {EstforLibrary: estforLibrary.address},
  });
  const playerNFT = (await upgrades.deployProxy(
    PlayerNFT,
    [
      brush.address,
      shop.address,
      DEV_ADDRESS,
      royaltyReceiver.address,
      editNameBrushPrice,
      upgradePlayerBrushPrice,
      heroImageBaseUri,
      isBeta,
    ],
    {
      kind: "uups",
      unsafeAllow: ["external-library-linking"],
      timeout,
    }
  )) as PlayerNFT;
  await playerNFT.deployed();
  console.log(`playerNFT = "${playerNFT.address.toLowerCase()}"`);

  const promotionsLibrary = await ethers.deployContract("PromotionsLibrary");
  await promotionsLibrary.deployed();
  console.log(`promotionsLibrary = "${promotionsLibrary.address.toLowerCase()}"`);
  const Promotions = await ethers.getContractFactory("Promotions", {
    libraries: {PromotionsLibrary: promotionsLibrary.address},
  });
  const promotions = (await upgrades.deployProxy(
    Promotions,
    [adminAccess.address, itemNFT.address, playerNFT.address, isBeta],
    {
      kind: "uups",
      unsafeAllow: ["external-library-linking"],
      timeout,
    }
  )) as Promotions;
  await promotions.deployed();
  console.log(`promotions = "${promotions.address.toLowerCase()}"`);

  const buyPath: [string, string] = [wftm.address, brush.address];
  const Quests = await ethers.getContractFactory("Quests");
  const quests = (await upgrades.deployProxy(Quests, [world.address, router.address, buyPath], {
    kind: "uups",
    timeout,
  })) as Quests;
  await quests.deployed();
  console.log(`quests = "${quests.address.toLowerCase()}"`);

  const Clans = await ethers.getContractFactory("Clans", {
    libraries: {EstforLibrary: estforLibrary.address},
  });
  const clans = (await upgrades.deployProxy(
    Clans,
    [
      brush.address,
      playerNFT.address,
      shop.address,
      DEV_ADDRESS,
      editNameBrushPrice,
      paintSwapMarketplaceWhitelist.address,
      initialMMR,
    ],
    {
      kind: "uups",
      unsafeAllow: ["external-library-linking"],
      timeout,
    }
  )) as Clans;
  await clans.deployed();
  console.log(`clans = "${clans.address.toLowerCase()}"`);

  const WishingWell = await ethers.getContractFactory("WishingWell");
  const wishingWell = await upgrades.deployProxy(
    WishingWell,
    [
      brush.address,
      playerNFT.address,
      shop.address,
      world.address,
      clans.address,
      raffleEntryCost,
      startGlobalDonationThresholdRewards,
      clanDonationThresholdRewardIncrement,
      isBeta,
    ],
    {
      kind: "uups",
      timeout,
    }
  );
  await wishingWell.deployed();
  console.log(`wishingWell = "${wishingWell.address.toLowerCase()}"`);

  const Bank = await ethers.getContractFactory("Bank");
  const bank = await upgrades.deployBeacon(Bank);
  await bank.deployed();
  console.log(`bank = "${bank.address.toLowerCase()}"`);

  const petNFTLibrary = await ethers.deployContract("PetNFTLibrary");
  await petNFTLibrary.deployed();
  console.log(`petNFTLibrary = "${petNFTLibrary.address.toLowerCase()}"`);

  const PetNFT = await ethers.getContractFactory("PetNFT", {
    libraries: {EstforLibrary: estforLibrary.address, PetNFTLibrary: petNFTLibrary.address},
  });
  const petNFT = (await upgrades.deployProxy(
    PetNFT,
    [
      brush.address,
      royaltyReceiver.address,
      petImageBaseUri,
      DEV_ADDRESS,
      editPetNameBrushPrice,
      adminAccess.address,
      isBeta,
    ],
    {
      kind: "uups",
      unsafeAllow: ["delegatecall", "external-library-linking"],
      timeout,
    }
  )) as PetNFT;
  await petNFT.deployed();
  console.log(`petNFT = "${petNFT.address.toLowerCase()}"`);

  const playersLibrary = await ethers.deployContract("PlayersLibrary");
  await playersLibrary.deployed();
  console.log(`playersLibrary = "${playersLibrary.address.toLowerCase()}"`);

  const {playersImplQueueActions, playersImplProcessActions, playersImplRewards, playersImplMisc, playersImplMisc1} =
    await deployPlayerImplementations(playersLibrary.address);

  // This contains all the player data
  const Players = await ethers.getContractFactory("Players");
  const players = (await upgrades.deployProxy(
    Players,
    [
      itemNFT.address,
      playerNFT.address,
      petNFT.address,
      world.address,
      adminAccess.address,
      quests.address,
      clans.address,
      wishingWell.address,
      playersImplQueueActions.address,
      playersImplProcessActions.address,
      playersImplRewards.address,
      playersImplMisc.address,
      playersImplMisc1.address,
      isBeta,
    ],
    {
      kind: "uups",
      unsafeAllow: ["delegatecall", "external-library-linking"],
      timeout,
    }
  )) as Players;
  await players.deployed();
  console.log(`players = "${players.address.toLowerCase()}"`);

  const BankRegistry = await ethers.getContractFactory("BankRegistry");
  const bankRegistry = await upgrades.deployProxy(
    BankRegistry,
    [itemNFT.address, playerNFT.address, clans.address, players.address],
    {
      kind: "uups",
      timeout,
    }
  );
  await bankRegistry.deployed();
  console.log(`bankRegistry = "${bankRegistry.address.toLowerCase()}"`);

  const BankFactory = await ethers.getContractFactory("BankFactory");
  const bankFactory = (await upgrades.deployProxy(BankFactory, [bankRegistry.address, bank.address], {
    kind: "uups",
    timeout,
  })) as BankFactory;
  await bankFactory.deployed();
  console.log(`bankFactory = "${bankFactory.address.toLowerCase()}"`);

  const PassiveActions = await ethers.getContractFactory("PassiveActions", {
    libraries: {WorldLibrary: worldLibrary.address},
  });
  const passiveActions = (await upgrades.deployProxy(
    PassiveActions,
    [players.address, itemNFT.address, world.address],
    {
      kind: "uups",
      unsafeAllow: ["delegatecall", "external-library-linking"],
      timeout,
    }
  )) as PassiveActions;
  await passiveActions.deployed();
  console.log(`passiveActions = "${passiveActions.address.toLowerCase()}"`);

  const InstantActions = await ethers.getContractFactory("InstantActions");
  const instantActions = (await upgrades.deployProxy(InstantActions, [players.address, itemNFT.address], {
    kind: "uups",
    timeout,
  })) as InstantActions;
  await instantActions.deployed();
  console.log(`instantActions = "${instantActions.address.toLowerCase()}"`);

  const VRFRequestInfo = await ethers.getContractFactory("VRFRequestInfo");
  const vrfRequestInfo = (await upgrades.deployProxy(VRFRequestInfo, [], {
    kind: "uups",
    timeout,
  })) as VRFRequestInfo;
  await instantActions.deployed();
  console.log(`vrfRequestInfo = "${vrfRequestInfo.address.toLowerCase()}"`);

  const InstantVRFActions = await ethers.getContractFactory("InstantVRFActions");
  const instantVRFActions = (await upgrades.deployProxy(
    InstantVRFActions,
    [players.address, itemNFT.address, petNFT.address, ORACLE_ADDRESS, vrf.address, vrfRequestInfo.address],
    {
      kind: "uups",
      timeout,
    }
  )) as InstantVRFActions;
  await instantVRFActions.deployed();
  console.log(`instantVRFActions = "${instantVRFActions.address.toLowerCase()}"`);

  const GenericInstantVRFActionStrategy = await ethers.getContractFactory("GenericInstantVRFActionStrategy");
  const genericInstantVRFActionStrategy = (await upgrades.deployProxy(
    GenericInstantVRFActionStrategy,
    [instantVRFActions.address],
    {
      kind: "uups",
    }
  )) as GenericInstantVRFActionStrategy;
  console.log(`genericInstantVRFActionStrategy = "${genericInstantVRFActionStrategy.address.toLowerCase()}"`);

  const EggInstantVRFActionStrategy = await ethers.getContractFactory("EggInstantVRFActionStrategy");
  const eggInstantVRFActionStrategy = (await upgrades.deployProxy(
    EggInstantVRFActionStrategy,
    [instantVRFActions.address],
    {
      kind: "uups",
    }
  )) as EggInstantVRFActionStrategy;

  const lockedBankVaultsLibrary = await ethers.deployContract("LockedBankVaultsLibrary");
  await lockedBankVaultsLibrary.deployed();
  console.log(`lockedBankVaultsLibrary = "${lockedBankVaultsLibrary.address.toLowerCase()}"`);

  const lockedFundsPeriod = (isBeta ? 1 : 7) * 86400; // 7 days
  const LockedBankVaults = await ethers.getContractFactory("LockedBankVaults", {
    libraries: {EstforLibrary: estforLibrary.address, LockedBankVaultsLibrary: lockedBankVaultsLibrary.address},
  });
  const lockedBankVaults = await upgrades.deployProxy(
    LockedBankVaults,
    [
      players.address,
      clans.address,
      brush.address,
      bankFactory.address,
      itemNFT.address,
      shop.address,
      DEV_ADDRESS,
      ORACLE_ADDRESS,
      vrf.address,
      allBattleSkills,
      mmrAttackDistance,
      lockedFundsPeriod,
      adminAccess.address,
      isBeta,
    ],
    {
      kind: "uups",
      unsafeAllow: ["external-library-linking"],
      timeout,
    }
  );
  console.log(`lockedBankVaults = "${lockedBankVaults.address.toLowerCase()}"`);

  const Territories = await ethers.getContractFactory("Territories");
  const territories = await upgrades.deployProxy(
    Territories,
    [
      allTerritories,
      players.address,
      clans.address,
      brush.address,
      lockedBankVaults.address,
      itemNFT.address,
      ORACLE_ADDRESS,
      vrf.address,
      allBattleSkills,
      adminAccess.address,
      isBeta,
    ],
    {
      kind: "uups",
      unsafeAllow: ["external-library-linking"],
      timeout,
    }
  );
  console.log(`territories = "${territories.address.toLowerCase()}"`);

  const CombatantsHelper = await ethers.getContractFactory("CombatantsHelper", {
    libraries: {EstforLibrary: estforLibrary.address},
  });
  const combatantsHelper = await upgrades.deployProxy(
    CombatantsHelper,
    [players.address, clans.address, territories.address, lockedBankVaults.address, adminAccess.address, isBeta],
    {
      kind: "uups",
      unsafeAllow: ["external-library-linking"],
      timeout,
    }
  );

  const DecoratorProvider = await ethers.getContractFactory("DecoratorProvider");
  const decoratorProvider = await upgrades.deployProxy(DecoratorProvider, [
    paintSwapDecorator.address,
    paintSwapArtGallery.address,
    territories.address,
    brush.address,
    playerNFT.address,
    DEV_ADDRESS,
    pid,
  ]);
  console.log(`decoratorProvider = "${decoratorProvider.address.toLowerCase()}"`);

  // Verify the contracts now, better to bail now before we start setting up the contract data
  if (network.chainId == 250) {
    try {
      const addresses = [
        players.address,
        playersImplQueueActions.address,
        playersImplProcessActions.address,
        playersImplRewards.address,
        playersImplMisc.address,
        playersImplMisc1.address,
        playersLibrary.address,
        estforLibrary.address,
        playerNFT.address,
        wishingWell.address,
        itemNFTLibrary.address,
        itemNFT.address,
        petNFT.address,
        adminAccess.address,
        shop.address,
        worldLibrary.address,
        world.address,
        royaltyReceiver.address,
        clans.address,
        quests.address,
        promotions.address,
        bank.address,
        await upgrades.beacon.getImplementationAddress(bank.address),
        bankRegistry.address,
        bankFactory.address,
        passiveActions.address,
        instantActions.address,
        instantVRFActions.address,
        lockedBankVaults.address,
        territories.address,
        decoratorProvider.address,
        combatantsHelper.address,
        vrfRequestInfo.address,
      ];
      console.log("Verifying contracts...");
      await verifyContracts(addresses);
    } catch (e) {
      console.log("Error verifying contracts", e);
      //      process.exit(99);
    }
  } else {
    console.log("Skipping verifying contracts");
  }

  tx = await world.setQuests(quests.address);
  await tx.wait();
  console.log("world setQuests");
  tx = await world.setWishingWell(wishingWell.address);
  await tx.wait();
  console.log("world setWishingWell");
  tx = await itemNFT.setPlayers(players.address);
  await tx.wait();
  console.log("itemNFT setPlayers");
  tx = await playerNFT.setPlayers(players.address);
  await tx.wait();
  console.log("playerNFT setPlayers");
  tx = await petNFT.setPlayers(players.address);
  await tx.wait();
  console.log("petNFT setPlayers");
  tx = await quests.setPlayers(players.address);
  await tx.wait();
  console.log("quests setPlayers");
  tx = await clans.setPlayers(players.address);
  await tx.wait();
  console.log("clans setPlayers");
  tx = await wishingWell.setPlayers(players.address);
  await tx.wait();
  console.log("wishingWell setPlayers");

  tx = await clans.setBankFactory(bankFactory.address);
  await tx.wait();
  console.log("clans setBankFactory");
  tx = await itemNFT.setBankFactory(bankFactory.address);
  await tx.wait();
  console.log("itemNFT setBankFactory");

  tx = await itemNFT.setPromotions(promotions.address);
  await tx.wait();
  console.log("itemNFT setPromotions");

  tx = await itemNFT.setPassiveActions(passiveActions.address);
  await tx.wait();
  console.log("itemNFT setPassiveActions");

  tx = await itemNFT.setInstantActions(instantActions.address);
  await tx.wait();
  console.log("itemNFT setInstantActions");

  tx = await itemNFT.setInstantVRFActions(instantVRFActions.address);
  await tx.wait();
  console.log("itemNFT setInstantVRFActions");
  tx = await petNFT.setInstantVRFActions(instantVRFActions.address);
  await tx.wait();
  console.log("petNFT setInstantVRFActions");

  tx = await petNFT.setBrushDistributionPercentages(25, 0, 25, 50);
  await tx.wait();
  console.log("petNFT setBrushDistributionPercentages");

  tx = await shop.setItemNFT(itemNFT.address);
  await tx.wait();
  console.log("shop.setItemNFT");

  tx = await clans.setTerritoriesAndLockedBankVaults(territories.address, lockedBankVaults.address);
  await tx.wait();
  console.log("clans.setTerritoriesAndLockedBankVaults");
  tx = await itemNFT.setTerritoriesAndLockedBankVaults(territories.address, lockedBankVaults.address);
  await tx.wait();
  console.log("itemNFT.setTerritoriesAndLockedBankVaults");
  tx = await royaltyReceiver.setTerritories(territories.address);
  await tx.wait();
  console.log("royaltyReceiver.setTerritories");
  tx = await petNFT.setTerritories(territories.address);
  await tx.wait();
  console.log("petNFT.setTerritories");

  tx = await itemNFT.setBazaar(BAZAAR_ADDRESS);
  console.log("Set Bazaar");

  const clanWars = [lockedBankVaults, territories];
  for (const clanWar of clanWars) {
    try {
      tx = await clanWar.setAddresses(territories.address, combatantsHelper.address);
      await tx.wait();
      console.log("clanWar setAddresses");
    } catch (error) {
      console.error(`Error: ${error}`);
    }
  }

  const territoryIds = allTerritories.map((territory) => {
    return territory.territoryId;
  });

  tx = await territories.setMinimumMMRs(territoryIds, allMinimumMMRs);
  await tx.wait();
  console.log("territories.setMinimumMMRs");

  tx = await bankRegistry.setLockedBankVaults(lockedBankVaults.address);
  await tx.wait();
  console.log("bankRegistry.setLockedBankVaults");

  tx = await instantVRFActions.addStrategies(
    [InstantVRFActionType.GENERIC, InstantVRFActionType.FORGING, InstantVRFActionType.EGG],
    [
      genericInstantVRFActionStrategy.address,
      genericInstantVRFActionStrategy.address,
      eggInstantVRFActionStrategy.address,
    ]
  );
  await tx.wait();
  console.log("instantVRFActions.addStrategies");

  tx = await players.setDailyRewardsEnabled(true);
  await tx.wait();
  console.log("Set daily rewards enabled");

  tx = await playerNFT.setAvatars(avatarIds, avatarInfos);
  await tx.wait();
  console.log("Add avatars");

  tx = await players.addXPThresholdRewards(allXPThresholdRewards);
  await tx.wait();
  console.log("Add xp threshold rewards");

  const chunkSize = 100;
  for (let i = 0; i < allItems.length; i += chunkSize) {
    const chunk = allItems.slice(i, i + chunkSize);
    tx = await itemNFT.addItems(chunk);
    await tx.wait();
    console.log("Add items chunk ", i);
  }

  tx = await players.addFullAttireBonuses(allFullAttireBonuses);
  await tx.wait();
  console.log("Add full attire bonuses");

  await setDailyAndWeeklyRewards(world);

  tx = await world.addActions(allActions);
  await tx.wait();
  console.log("Add actions");

  const fireMakingActionId = EstforConstants.ACTION_FIREMAKING_ITEM;
  const smithingActionId = EstforConstants.ACTION_SMITHING_ITEM;
  const cookingActionId = EstforConstants.ACTION_COOKING_ITEM;
  const craftingActionId = EstforConstants.ACTION_CRAFTING_ITEM;
  const fletchingActionId = EstforConstants.ACTION_FLETCHING_ITEM;
  const alchemyActionId = EstforConstants.ACTION_ALCHEMY_ITEM;
  const forgingActionId = EstforConstants.ACTION_FORGING_ITEM;
  const genericCombatActionId = EstforConstants.NONE;

  tx = await world.addBulkActionChoices(
    [fireMakingActionId, smithingActionId, cookingActionId, craftingActionId],
    [allActionChoiceIdsFiremaking, allActionChoiceIdsSmithing, allActionChoiceIdsCooking, allActionChoiceIdsCrafting],
    [allActionChoicesFiremaking, allActionChoicesSmithing, allActionChoicesCooking, allActionChoicesCrafting]
  );

  await tx.wait();
  console.log("Add action choices1");

  // Add new ones here for gas reasons
  tx = await world.addBulkActionChoices(
    [fletchingActionId, alchemyActionId, forgingActionId],
    [allActionChoiceIdsFletching, allActionChoiceIdsAlchemy, allActionChoiceIdsForging],
    [allActionChoicesFletching, allActionChoicesAlchemy, allActionChoicesForging]
  );

  await tx.wait();
  console.log("Add action choices2");

  tx = await world.addBulkActionChoices(
    [genericCombatActionId, genericCombatActionId, genericCombatActionId],
    [allActionChoiceIdsMelee, allActionChoiceIdsRanged, allActionChoiceIdsMagic],
    [allActionChoicesMelee, allActionChoicesRanged, allActionChoicesMagic]
  );

  await tx.wait();
  console.log("Add combat action choices");

  // Add shop items
  tx = await shop.addBuyableItems(isBeta ? allShopItemsBeta : allShopItems);
  await tx.wait();
  console.log("Add shopping items");

  // Add quests
  tx = await quests.addQuests(allQuests, allQuestsMinRequirements);
  await tx.wait();
  console.log("Add quests");

  // Add clan tiers
  tx = await clans.addTiers(isBeta ? allClanTiersBeta : allClanTiers);
  await tx.wait();
  console.log("Add clan tiers");

  // Add instant actions
  for (let i = 0; i < allInstantActions.length; i += chunkSize) {
    const chunk = allInstantActions.slice(i, i + chunkSize);
    tx = await instantActions.addActions(chunk);
    await tx.wait();
    console.log("Add instant actions chunk ", i);
  }

  // Add instant vrf actions
  for (let i = 0; i < allInstantVRFActions.length; i += chunkSize) {
    const chunk = allInstantVRFActions.slice(i, i + chunkSize);
    tx = await instantVRFActions.addActions(chunk);
    await tx.wait();
    console.log("Add instant vrf actions chunk ", i);
  }

  // Add base pets
  const basePetChunkSize = 20;
  for (let i = 0; i < allBasePets.length; i += basePetChunkSize) {
    const chunk = allBasePets.slice(i, i + basePetChunkSize);
    tx = await petNFT.addBasePets(chunk);
    await tx.wait();
    console.log("Add base pets chunk ", i);
  }

  // Add unsellable items
  const items = [
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
  ];

  // Only works if not trying to sell anything
  //  await shop.addUnsellableItems(items);

  // Add test data for the game
  if (isBeta) {
    await addTestData(itemNFT, playerNFT, players, shop, brush, clans, bankFactory);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
