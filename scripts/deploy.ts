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
  RoyaltyReceiver,
  AdminAccess,
  Treasury,
  Territories,
  CombatantsHelper,
  LockedBankVaults
} from "../typechain-types";
import {
  deployMockPaintSwapContracts,
  deployPlayerImplementations,
  getChainId,
  isBeta,
  isDevNetwork,
  setDailyAndWeeklyRewards,
  verifyContracts
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
  allActionChoicesForging
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
  allActionChoiceIdsForging
} from "./data/actionChoiceIds";
import {
  BAZAAR_ADDRESS,
  BRUSH_ADDRESS,
  DECORATOR_ADDRESS,
  DEV_ADDRESS,
  ORACLE_ADDRESS,
  SAMWITCH_VRF_ADDRESS,
  WFTM_ADDRESS
} from "./contractAddresses";
import {addTestData} from "./addTestData";
import {whitelistedAdmins} from "@paintswap/estfor-definitions/constants";
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
import {parseEther} from "ethers";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Deploying contracts with the account: ${owner.address} on chain: ${await getChainId(owner)}`);
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
      await brush.mint(owner.address, parseEther("1000"));
      console.log("Minted brush");
      wftm = await MockWrappedFantom.deploy();
      console.log("Minted WFTM");
      oracleAddress = owner.address;
      vrf = await MockVRF.deploy();
      console.log(`mockVRF = "${(await vrf.getAddress()).toLowerCase()}"`);
      router = await MockRouter.deploy();
      console.log(`mockRouter = "${(await router.getAddress()).toLowerCase()}"`);
      ({paintSwapMarketplaceWhitelist, paintSwapDecorator, paintSwapArtGallery} = await deployMockPaintSwapContracts(
        brush,
        router,
        wftm
      ));
    } else if (network.chainId == 4002n) {
      // Fantom testnet
      brush = await MockBrushToken.deploy();
      await brush.waitForDeployment();

      tx = await brush.mint(owner.address, parseEther("1000"));
      console.log("Minted brush");
      await tx.wait();
      wftm = (await MockWrappedFantom.attach("0xf1277d1ed8ad466beddf92ef448a132661956621")) as MockWrappedFantom;
      oracleAddress = "0x3d2341ADb2D31f1c5530cDC622016af293177AE0";
      vrf = await MockVRF.deploy();
      await vrf.waitForDeployment();

      console.log(`mockVRF = "${(await vrf.getAddress()).toLowerCase()}"`);
      router = (await MockRouter.attach("0xa6AD18C2aC47803E193F75c3677b14BF19B94883")) as MockRouter;
      console.log(`mockRouter = "${(await router.getAddress()).toLowerCase()}"`);
      ({paintSwapMarketplaceWhitelist, paintSwapDecorator, paintSwapArtGallery} = await deployMockPaintSwapContracts(
        brush,
        router,
        wftm
      ));
    } else if (network.chainId == 250n) {
      // Fantom mainnet
      brush = (await MockBrushToken.attach(BRUSH_ADDRESS)) as MockBrushToken;
      wftm = (await MockWrappedFantom.attach(WFTM_ADDRESS)) as MockWrappedFantom;
      oracleAddress = ORACLE_ADDRESS;
      vrf = (await MockVRF.attach(SAMWITCH_VRF_ADDRESS)) as MockVRF;
      router = (await MockRouter.attach("0x31F63A33141fFee63D4B26755430a390ACdD8a4d")) as MockRouter;
      paintSwapMarketplaceWhitelist = (await MockPaintSwapMarketplaceWhitelist.attach(
        "0x7559038535f3d6ed6BAc5a54Ab4B69DA827F44BD"
      )) as MockPaintSwapMarketplaceWhitelist;
      paintSwapArtGallery = (await TestPaintSwapArtGallery.attach(
        "0x9076C96e01F6F13e1eC4832354dF970d245e124F"
      )) as TestPaintSwapArtGallery;
      paintSwapDecorator = (await TestPaintSwapDecorator.attach(DECORATOR_ADDRESS)) as TestPaintSwapDecorator;
      pid = 22;
    } else {
      throw Error("Not a supported network");
    }
  }

  const timeout = 600 * 1000; // 10 minutes

  let itemsUri: string;
  let heroImageBaseUri: string;
  let petImageBaseUri: string;
  let editNameBrushPrice: bigint;
  let editPetNameBrushPrice: bigint;
  let upgradePlayerBrushPrice: bigint;
  let raffleEntryCost: bigint;
  let startGlobalDonationThresholdRewards: bigint;
  let clanDonationThresholdRewardIncrement: bigint;
  let mmrAttackDistance;
  // Some of these base uris likely out of date
  if (!isBeta) {
    // live version
    itemsUri = "ipfs://QmVDdbXtEDXh5AGEuHCEEjmAiEZJaMSpC4W36N3aZ3ToQd /";
    heroImageBaseUri = "ipfs://QmY5bwB4212iqziFapqFqUnN6dJk47D3f47HxseW1dX3aX/";
    petImageBaseUri = "ipfs://Qma93THZoAXmPR4Ug3JHmJxf3CYch3CxdAPipsxA5NGxsR/";
    editNameBrushPrice = parseEther("1000");
    editPetNameBrushPrice = parseEther("1");
    upgradePlayerBrushPrice = parseEther("2000");
    raffleEntryCost = parseEther("12");
    startGlobalDonationThresholdRewards = parseEther("300000");
    clanDonationThresholdRewardIncrement = parseEther("5000");
    mmrAttackDistance = 4;
  } else {
    itemsUri = "ipfs://QmZBtZ6iF7shuRxPc4q4cM3wNnDyJeqNgP7EkSWQqSgKnM/";
    heroImageBaseUri = "ipfs://QmY5bwB4212iqziFapqFqUnN6dJk47D3f47HxseW1dX3aX/";
    petImageBaseUri = "ipfs://QmcLcqcYwPRcTeBRaX8BtfDCpwZSrNzt22z5gAG3CRXTw7/";
    editNameBrushPrice = parseEther("1");
    editPetNameBrushPrice = parseEther("1");
    upgradePlayerBrushPrice = parseEther("1");
    raffleEntryCost = parseEther("5");
    startGlobalDonationThresholdRewards = parseEther("1000");
    clanDonationThresholdRewardIncrement = parseEther("50");
    mmrAttackDistance = 1;
  }

  const initialMMR = 500;
  const maxActionAmount = 64;
  const minItemQuantityBeforeSellsAllowed = 500n;
  const sellingCutoffDuration = 48 * 3600; // 48 hours

  // Create the world
  const WorldLibrary = await ethers.getContractFactory("WorldLibrary");
  const worldLibrary = await WorldLibrary.deploy();
  await worldLibrary.waitForDeployment();

  console.log(`worldLibrary = "${(await worldLibrary.getAddress()).toLowerCase()}"`);
  const World = await ethers.getContractFactory("World", {
    libraries: {WorldLibrary: await worldLibrary.getAddress()}
  });
  const world = (await upgrades.deployProxy(World, [await vrf.getAddress()], {
    kind: "uups",
    unsafeAllow: ["external-library-linking"],
    timeout
  })) as unknown as World;
  await world.waitForDeployment();

  console.log(`world = "${(await world.getAddress()).toLowerCase()}"`);

  const Treasury = await ethers.getContractFactory("Treasury");
  const treasury = (await upgrades.deployProxy(Treasury, [await brush.getAddress()], {
    kind: "uups",
    timeout
  })) as unknown as Treasury;
  await treasury.waitForDeployment();

  console.log(`treasury = "${(await treasury.getAddress()).toLowerCase()}"`);

  const Shop = await ethers.getContractFactory("Shop");
  const shop = (await upgrades.deployProxy(
    Shop,
    [
      await brush.getAddress(),
      await treasury.getAddress(),
      DEV_ADDRESS,
      minItemQuantityBeforeSellsAllowed,
      sellingCutoffDuration
    ],
    {
      kind: "uups",
      timeout
    }
  )) as unknown as Shop;
  await shop.waitForDeployment();

  console.log(`shop = "${(await shop.getAddress()).toLowerCase()}"`);

  const RoyaltyReceiver = await ethers.getContractFactory("RoyaltyReceiver");
  const royaltyReceiver = (await upgrades.deployProxy(
    RoyaltyReceiver,
    [
      await router.getAddress(),
      await shop.getAddress(),
      DEV_ADDRESS,
      await brush.getAddress(),
      await wftm.getAddress()
    ],
    {
      kind: "uups",
      timeout
    }
  )) as unknown as RoyaltyReceiver;
  await royaltyReceiver.waitForDeployment();
  console.log(`royaltyReceiver = "${(await royaltyReceiver.getAddress()).toLowerCase()}"`);

  const admins = whitelistedAdmins.map((el) => ethers.getAddress(el));
  if (!admins.includes(owner.address)) {
    admins.push(owner.address);
  }

  const promotionalAdmins = ["0xe9fb52d7611e502d93af381ac493981b42d91974"];
  const AdminAccess = await ethers.getContractFactory("AdminAccess");
  const adminAccess = (await upgrades.deployProxy(AdminAccess, [admins, promotionalAdmins], {
    kind: "uups",
    timeout
  })) as unknown as AdminAccess;
  await adminAccess.waitForDeployment();
  console.log(`adminAccess = "${(await adminAccess.getAddress()).toLowerCase()}"`);

  // Create NFT contract which contains all items
  const itemNFTLibrary = await ethers.deployContract("ItemNFTLibrary");
  await itemNFTLibrary.waitForDeployment();
  console.log(`itemNFTLibrary = "${(await itemNFTLibrary.getAddress()).toLowerCase()}"`);
  const ItemNFT = await ethers.getContractFactory("ItemNFT", {
    libraries: {ItemNFTLibrary: await itemNFTLibrary.getAddress()}
  });
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
      unsafeAllow: ["external-library-linking"],
      timeout
    }
  )) as unknown as ItemNFT;
  await itemNFT.waitForDeployment();

  console.log(`itemNFT = "${(await itemNFT.getAddress()).toLowerCase()}"`);

  // Create NFT contract which contains all the players
  const estforLibrary = await ethers.deployContract("EstforLibrary");
  await estforLibrary.waitForDeployment();
  console.log(`estforLibrary = "${(await estforLibrary.getAddress()).toLowerCase()}"`);

  const PlayerNFT = await ethers.getContractFactory("PlayerNFT", {
    libraries: {EstforLibrary: await estforLibrary.getAddress()}
  });
  const playerNFT = (await upgrades.deployProxy(
    PlayerNFT,
    [
      await brush.getAddress(),
      await shop.getAddress(),
      DEV_ADDRESS,
      await royaltyReceiver.getAddress(),
      editNameBrushPrice,
      upgradePlayerBrushPrice,
      heroImageBaseUri,
      isBeta
    ],
    {
      kind: "uups",
      unsafeAllow: ["external-library-linking"],
      timeout
    }
  )) as unknown as PlayerNFT;
  await playerNFT.waitForDeployment();
  console.log(`playerNFT = "${(await playerNFT.getAddress()).toLowerCase()}"`);

  const promotionsLibrary = await ethers.deployContract("PromotionsLibrary");
  await promotionsLibrary.waitForDeployment();
  console.log(`promotionsLibrary = "${(await promotionsLibrary.getAddress()).toLowerCase()}"`);

  const Promotions = await ethers.getContractFactory("Promotions", {
    libraries: {PromotionsLibrary: await promotionsLibrary.getAddress()}
  });
  const promotions = (await upgrades.deployProxy(
    Promotions,
    [
      await itemNFT.getAddress(),
      await playerNFT.getAddress(),
      await brush.getAddress(),
      await treasury.getAddress(),
      DEV_ADDRESS,
      await adminAccess.getAddress(),
      isBeta
    ],
    {
      kind: "uups",
      unsafeAllow: ["external-library-linking"],
      timeout
    }
  )) as unknown as Promotions;
  await promotions.waitForDeployment();
  console.log(`promotions = "${(await promotions.getAddress()).toLowerCase()}"`);

  const buyPath: [string, string] = [await wftm.getAddress(), await brush.getAddress()];
  const Quests = await ethers.getContractFactory("Quests");
  const quests = (await upgrades.deployProxy(Quests, [await world.getAddress(), await router.getAddress(), buyPath], {
    kind: "uups",
    timeout
  })) as unknown as Quests;
  await quests.waitForDeployment();
  console.log(`quests = "${(await quests.getAddress()).toLowerCase()}"`);

  const Clans = await ethers.getContractFactory("Clans", {
    libraries: {EstforLibrary: await estforLibrary.getAddress()}
  });
  const clans = (await upgrades.deployProxy(
    Clans,
    [
      await brush.getAddress(),
      await playerNFT.getAddress(),
      await shop.getAddress(),
      DEV_ADDRESS,
      editNameBrushPrice,
      await paintSwapMarketplaceWhitelist.getAddress(),
      initialMMR
    ],
    {
      kind: "uups",
      unsafeAllow: ["external-library-linking"],
      timeout
    }
  )) as unknown as Clans;
  await clans.waitForDeployment();
  console.log(`clans = "${(await clans.getAddress()).toLowerCase()}"`);

  const WishingWell = await ethers.getContractFactory("WishingWell");
  const wishingWell = await upgrades.deployProxy(
    WishingWell,
    [
      await brush.getAddress(),
      await playerNFT.getAddress(),
      await shop.getAddress(),
      await world.getAddress(),
      await clans.getAddress(),
      raffleEntryCost,
      startGlobalDonationThresholdRewards,
      clanDonationThresholdRewardIncrement
    ],
    {
      kind: "uups",
      timeout
    }
  );
  await wishingWell.waitForDeployment();
  console.log(`wishingWell = "${(await wishingWell.getAddress()).toLowerCase()}"`);

  const Bank = await ethers.getContractFactory("Bank");
  const bank = await upgrades.deployBeacon(Bank);
  await bank.waitForDeployment();
  console.log(`bank = "${(await bank.getAddress()).toLowerCase()}"`);

  const petNFTLibrary = await ethers.deployContract("PetNFTLibrary");

  console.log(`petNFTLibrary = "${(await petNFTLibrary.getAddress()).toLowerCase()}"`);

  const PetNFT = await ethers.getContractFactory("PetNFT", {
    libraries: {EstforLibrary: await estforLibrary.getAddress(), PetNFTLibrary: await petNFTLibrary.getAddress()}
  });
  const petNFT = (await upgrades.deployProxy(
    PetNFT,
    [
      await brush.getAddress(),
      await royaltyReceiver.getAddress(),
      petImageBaseUri,
      DEV_ADDRESS,
      editPetNameBrushPrice,
      await treasury.getAddress(),
      await adminAccess.getAddress(),
      isBeta
    ],
    {
      kind: "uups",
      unsafeAllow: ["external-library-linking"],
      timeout
    }
  )) as unknown as PetNFT;
  await petNFT.waitForDeployment();
  console.log(`petNFT = "${(await petNFT.getAddress()).toLowerCase()}"`);

  const playersLibrary = await ethers.deployContract("PlayersLibrary");
  await playersLibrary.waitForDeployment();
  console.log(`playersLibrary = "${(await playersLibrary.getAddress()).toLowerCase()}"`);

  const {playersImplQueueActions, playersImplProcessActions, playersImplRewards, playersImplMisc, playersImplMisc1} =
    await deployPlayerImplementations(await playersLibrary.getAddress());

  // This contains all the player data
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
      unsafeAllow: ["delegatecall"],
      timeout
    }
  )) as unknown as Players;
  await players.waitForDeployment();
  console.log(`players = "${(await players.getAddress()).toLowerCase()}"`);

  const BankRegistry = await ethers.getContractFactory("BankRegistry");
  const bankRegistry = await upgrades.deployProxy(
    BankRegistry,
    [await itemNFT.getAddress(), await playerNFT.getAddress(), await clans.getAddress(), await players.getAddress()],
    {
      kind: "uups",
      timeout
    }
  );
  await bankRegistry.waitForDeployment();
  console.log(`bankRegistry = "${(await bankRegistry.getAddress()).toLowerCase()}"`);

  const BankFactory = await ethers.getContractFactory("BankFactory");
  const bankFactory = (await upgrades.deployProxy(
    BankFactory,
    [await bankRegistry.getAddress(), await bank.getAddress()],
    {
      kind: "uups",
      timeout
    }
  )) as unknown as BankFactory;
  await bankFactory.waitForDeployment();
  console.log(`bankFactory = "${(await bankFactory.getAddress()).toLowerCase()}"`);

  const PassiveActions = await ethers.getContractFactory("PassiveActions", {
    libraries: {WorldLibrary: await worldLibrary.getAddress()}
  });
  const passiveActions = (await upgrades.deployProxy(
    PassiveActions,
    [await players.getAddress(), await itemNFT.getAddress(), await world.getAddress()],
    {
      kind: "uups",
      unsafeAllow: ["external-library-linking"],
      timeout
    }
  )) as unknown as PassiveActions;
  await passiveActions.waitForDeployment();
  console.log(`passiveActions = "${(await passiveActions.getAddress()).toLowerCase()}"`);

  const InstantActions = await ethers.getContractFactory("InstantActions");
  const instantActions = (await upgrades.deployProxy(
    InstantActions,
    [await players.getAddress(), await itemNFT.getAddress()],
    {
      kind: "uups",
      timeout
    }
  )) as unknown as InstantActions;
  await instantActions.waitForDeployment();
  console.log(`instantActions = "${(await instantActions.getAddress()).toLowerCase()}"`);

  const VRFRequestInfo = await ethers.getContractFactory("VRFRequestInfo");
  const vrfRequestInfo = (await upgrades.deployProxy(VRFRequestInfo, [], {
    kind: "uups",
    timeout
  })) as unknown as VRFRequestInfo;
  await vrfRequestInfo.waitForDeployment();
  console.log(`vrfRequestInfo = "${(await vrfRequestInfo.getAddress()).toLowerCase()}"`);

  const InstantVRFActions = await ethers.getContractFactory("InstantVRFActions");
  const instantVRFActions = (await upgrades.deployProxy(
    InstantVRFActions,
    [
      await players.getAddress(),
      await itemNFT.getAddress(),
      await petNFT.getAddress(),
      ORACLE_ADDRESS,
      await vrf.getAddress(),
      await vrfRequestInfo.getAddress(),
      maxActionAmount
    ],
    {
      kind: "uups",
      timeout
    }
  )) as unknown as InstantVRFActions;
  await instantVRFActions.waitForDeployment();
  console.log(`instantVRFActions = "${(await instantVRFActions.getAddress()).toLowerCase()}"`);

  const GenericInstantVRFActionStrategy = await ethers.getContractFactory("GenericInstantVRFActionStrategy");
  const genericInstantVRFActionStrategy = (await upgrades.deployProxy(
    GenericInstantVRFActionStrategy,
    [await instantVRFActions.getAddress()],
    {
      kind: "uups"
    }
  )) as unknown as GenericInstantVRFActionStrategy;
  await genericInstantVRFActionStrategy.waitForDeployment();
  console.log(
    `genericInstantVRFActionStrategy = "${(await genericInstantVRFActionStrategy.getAddress()).toLowerCase()}"`
  );

  const EggInstantVRFActionStrategy = await ethers.getContractFactory("EggInstantVRFActionStrategy");
  const eggInstantVRFActionStrategy = (await upgrades.deployProxy(
    EggInstantVRFActionStrategy,
    [await instantVRFActions.getAddress()],
    {
      kind: "uups"
    }
  )) as unknown as EggInstantVRFActionStrategy;
  await eggInstantVRFActionStrategy.waitForDeployment();

  const lockedBankVaultsLibrary = await ethers.deployContract("LockedBankVaultsLibrary");
  console.log(`lockedBankVaultsLibrary = "${(await lockedBankVaultsLibrary.getAddress()).toLowerCase()}"`);

  const lockedFundsPeriod = (isBeta ? 1 : 7) * 86400; // 7 days
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
      await treasury.getAddress(),
      DEV_ADDRESS,
      ORACLE_ADDRESS,
      await vrf.getAddress(),
      await vrfRequestInfo.getAddress(),
      allBattleSkills,
      mmrAttackDistance,
      lockedFundsPeriod,
      await adminAccess.getAddress(),
      isBeta
    ],
    {
      kind: "uups",
      unsafeAllow: ["external-library-linking"],
      timeout
    }
  )) as unknown as LockedBankVaults;
  await lockedBankVaults.waitForDeployment();
  console.log(`lockedBankVaults = "${(await lockedBankVaults.getAddress()).toLowerCase()}"`);

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
      ORACLE_ADDRESS,
      await vrf.getAddress(),
      await vrfRequestInfo.getAddress(),
      allBattleSkills,
      await adminAccess.getAddress(),
      isBeta
    ],
    {
      kind: "uups",
      unsafeAllow: ["external-library-linking"],
      timeout
    }
  )) as unknown as Territories;
  await territories.waitForDeployment();
  console.log(`territories = "${(await territories.getAddress()).toLowerCase()}"`);

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
      unsafeAllow: ["external-library-linking"],
      timeout
    }
  )) as unknown as CombatantsHelper;
  await combatantsHelper.waitForDeployment();

  const DecoratorProvider = await ethers.getContractFactory("DecoratorProvider");
  const decoratorProvider = await upgrades.deployProxy(DecoratorProvider, [
    await paintSwapDecorator.getAddress(),
    await paintSwapArtGallery.getAddress(),
    await territories.getAddress(),
    await brush.getAddress(),
    await playerNFT.getAddress(),
    DEV_ADDRESS,
    pid
  ]);
  await decoratorProvider.waitForDeployment();
  console.log(`decoratorProvider = "${(await decoratorProvider.getAddress()).toLowerCase()}"`);

  // Verify the contracts now, better to bail now before we start setting up the contract data
  if (network.chainId == 250n) {
    try {
      const addresses = [
        await players.getAddress(),
        await playersImplQueueActions.getAddress(),
        await playersImplProcessActions.getAddress(),
        await playersImplRewards.getAddress(),
        await playersImplMisc.getAddress(),
        await playersImplMisc1.getAddress(),
        await playersLibrary.getAddress(),
        await estforLibrary.getAddress(),
        await playerNFT.getAddress(),
        await wishingWell.getAddress(),
        await itemNFTLibrary.getAddress(),
        await itemNFT.getAddress(),
        await petNFT.getAddress(),
        await adminAccess.getAddress(),
        await shop.getAddress(),
        await worldLibrary.getAddress(),
        await world.getAddress(),
        await royaltyReceiver.getAddress(),
        await clans.getAddress(),
        await quests.getAddress(),
        await promotions.getAddress(),
        await bank.getAddress(),
        await upgrades.beacon.getImplementationAddress(await bank.getAddress()),
        await bankRegistry.getAddress(),
        await bankFactory.getAddress(),
        await passiveActions.getAddress(),
        await instantActions.getAddress(),
        await instantVRFActions.getAddress(),
        await lockedBankVaults.getAddress(),
        await territories.getAddress(),
        await decoratorProvider.getAddress(),
        await combatantsHelper.getAddress(),
        await vrfRequestInfo.getAddress(),
        await treasury.getAddress()
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

  tx = await world.setWishingWell(wishingWell);
  await tx.wait();
  console.log("world setWishingWell");
  tx = await playerNFT.setPlayers(players);
  await tx.wait();
  console.log("playerNFT setPlayers");
  tx = await petNFT.setPlayers(players);
  await tx.wait();
  console.log("petNFT setPlayers");
  tx = await quests.setPlayers(players);
  await tx.wait();
  console.log("quests setPlayers");
  tx = await clans.setPlayers(players);
  await tx.wait();
  console.log("clans setPlayers");
  tx = await wishingWell.setPlayers(players);
  await tx.wait();
  console.log("wishingWell setPlayers");

  tx = await clans.setBankFactory(bankFactory);
  await tx.wait();
  console.log("clans setBankFactory");

  tx = await petNFT.setInstantVRFActions(instantVRFActions);
  await tx.wait();
  console.log("petNFT setInstantVRFActions");

  tx = await playerNFT.setBrushDistributionPercentages(25, 50, 25);
  await tx.wait();
  console.log("petNFT setBrushDistributionPercentages");

  tx = await petNFT.setBrushDistributionPercentages(25, 50, 25);
  await tx.wait();
  console.log("petNFT setBrushDistributionPercentages");

  tx = await shop.setBrushDistributionPercentages(25, 50, 25);
  await tx.wait();
  console.log("shop.setBrushDistributionPercentages");

  tx = await promotions.setBrushDistributionPercentages(25, 50, 25);
  await tx.wait();
  console.log("promotions.setBrushDistributionPercentages");

  tx = await lockedBankVaults.setBrushDistributionPercentages(25, 50, 25);
  await tx.wait();
  console.log("lockedBankVaults.setBrushDistributionPercentages");

  tx = await shop.setItemNFT(itemNFT);
  await tx.wait();
  console.log("shop.setItemNFT");

  tx = await clans.setTerritoriesAndLockedBankVaults(territories, lockedBankVaults);
  await tx.wait();
  console.log("clans.setTerritoriesAndLockedBankVaults");

  tx = await itemNFT.initializeAddresses(
    players,
    bankFactory,
    shop,
    promotions,
    instantActions,
    territories,
    lockedBankVaults,
    BAZAAR_ADDRESS,
    instantVRFActions,
    passiveActions
  );
  await tx.wait();
  console.log("itemNFT.initializeAddresses");

  tx = await royaltyReceiver.setTerritories(territories);
  await tx.wait();
  console.log("royaltyReceiver.setTerritories");
  tx = await petNFT.setTerritories(territories);
  await tx.wait();
  console.log("petNFT.setTerritories");

  tx = await lockedBankVaults.initializeAddresses(territories, combatantsHelper);
  await tx.wait();
  console.log("lockedBankVaults initializeAddresses");

  tx = await territories.setCombatantsHelper(combatantsHelper);
  await tx.wait();
  console.log("territories.initializeAddresses");

  const territoryIds = allTerritories.map((territory) => {
    return territory.territoryId;
  });

  tx = await territories.setMinimumMMRs(territoryIds, allMinimumMMRs);
  await tx.wait();
  console.log("territories.setMinimumMMRs");

  tx = await bankRegistry.setLockedBankVaults(lockedBankVaults);
  await tx.wait();
  console.log("bankRegistry.setLockedBankVaults");

  const treasuryAccounts = [await shop.getAddress(), ethers.ZeroAddress];
  const treasuryPercentages = [10, 90];
  tx = await treasury.setFundAllocationPercentages(treasuryAccounts, treasuryPercentages);
  await tx.wait();
  console.log("treasury.setFundAllocationPercentages");

  tx = await treasury.initializeAddresses(territories, shop);
  await tx.wait();
  console.log("treasury.initializeAddresses");

  tx = await vrfRequestInfo.setUpdaters([instantVRFActions, lockedBankVaults, territories], true);
  await tx.wait();
  console.log("vrfRequestInfo.setUpdaters");

  tx = await instantVRFActions.addStrategies(
    [InstantVRFActionType.GENERIC, InstantVRFActionType.FORGING, InstantVRFActionType.EGG],
    [
      await genericInstantVRFActionStrategy.getAddress(),
      await genericInstantVRFActionStrategy.getAddress(),
      await eggInstantVRFActionStrategy.getAddress()
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
    EstforConstants.ANNIV1_KEY
  ];

  // Only works if not trying to sell anything
  //  await shop.addUnsellableItems(items);

  // Add test data for the game
  if (isBeta) {
    await addTestData(itemNFT, playerNFT, players, shop, brush, clans, bankFactory, minItemQuantityBeforeSellsAllowed);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
