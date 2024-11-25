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
  WrappedNative,
  PassiveActions,
  PlayerNFT,
  Players,
  Promotions,
  Quests,
  Shop,
  TestPaintSwapDecorator,
  RandomnessBeacon,
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
  LockedBankVaults,
  ClanBattleLibrary,
  BankRelay,
  OrderBook,
  Bank,
  BankRegistry,
  SolidlyExtendedRouter,
  FakeDecoratorBrush,
  PVPBattleground,
  Raids,
  WorldActions,
  DailyRewardsScheduler
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
  BRUSH_ADDRESS,
  DEV_ADDRESS,
  ORACLE_ADDRESS,
  ROUTER_ADDRESS,
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
import {allPassiveActions} from "./data/passiveActions";
import {allOrderBookTokenIdInfos} from "./data/orderbookTokenIdInfos";
import {allBaseRaidIds, allBaseRaids} from "./data/raids";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Deploying contracts with the account: ${owner.address} on chain: ${await getChainId(owner)}`);
  const network = await ethers.provider.getNetwork();
  let brush: MockBrushToken;
  let wftm: WrappedNative;
  let oracleAddress: string;
  let vrf: MockVRF;
  let router: SolidlyExtendedRouter | MockRouter;
  let paintSwapMarketplaceWhitelist: MockPaintSwapMarketplaceWhitelist;
  let paintSwapDecorator: TestPaintSwapDecorator;
  let tx;
  let pid = 0;
  let fakeBrush: FakeDecoratorBrush;
  {
    if (isDevNetwork(network)) {
      brush = await ethers.deployContract("MockBrushToken");
      console.log(`brush = ${(await brush.getAddress()).toLowerCase()}`);
      await brush.mint(owner, parseEther("10000000"));
      console.log("Minted brush");
      wftm = await ethers.deployContract("WrappedNative");
      console.log("Minted WFTM");
      oracleAddress = owner.address;
      vrf = await ethers.deployContract("MockVRF");
      console.log("Minted MockVRF");
      router = await ethers.deployContract("MockRouter");
      console.log("Minted SolidlyExtendedRouter");

      const FakeDecoratorBrush = await ethers.getContractFactory("FakeDecoratorBrush");
      fakeBrush = (await upgrades.deployProxy(FakeDecoratorBrush)) as unknown as FakeDecoratorBrush;
      await fakeBrush.waitForDeployment();
      console.log("Deployed fake brush");
      tx = await fakeBrush.mint(owner, ethers.parseEther("10000"));
      await tx.wait();
      console.log("Minted fake brush");
      tx = await fakeBrush.approve(router, ethers.parseEther("100000000"));
      await tx.wait();
      console.log("Approved fake brush on the router");
      ({paintSwapMarketplaceWhitelist, paintSwapDecorator} = await deployMockPaintSwapContracts(
        brush,
        wftm,
        await fakeBrush.getAddress()
      ));
    } else if (network.chainId == 64165n) {
      // Sonic testnet.
      brush = await ethers.getContractAt("MockBrushToken", BRUSH_ADDRESS);

      tx = await brush.mint(owner, parseEther("1000000000000"));
      console.log("Minted brush");
      await tx.wait();
      tx = await brush.transfer("0xF83219Cd7D96ab2D80f16D36e5d9D00e287531eC", ethers.parseEther("100000"));
      console.log("Send brush to an account");
      await tx.wait();

      wftm = (await ethers.getContractAt("WrappedNative", WFTM_ADDRESS)) as WrappedNative;
      oracleAddress = ORACLE_ADDRESS;
      vrf = (await ethers.getContractAt("MockVRF", SAMWITCH_VRF_ADDRESS)) as MockVRF;
      console.log("attached wftm and vrf");
      router = (await ethers.getContractAt("SolidlyExtendedRouter", ROUTER_ADDRESS)) as SolidlyExtendedRouter;
      console.log(`router = "${(await router.getAddress()).toLowerCase()}"`);

      const factory = await ethers.getContractAt("ISolidlyFactory", await router.factory());
      console.log("Factory is at ", await router.factory());

      const pair = await factory.getPair(brush, WFTM_ADDRESS, false);
      console.log(pair);
      if (pair == ethers.ZeroAddress) {
        tx = await brush.approve(router, ethers.parseEther("100000000"));
        await tx.wait();
        console.log("Approved brush on the router");

        tx = await router.addLiquidityETH(
          brush,
          false,
          ethers.parseEther("10000"),
          ethers.parseEther("10000"),
          ethers.parseEther("1"),
          owner,
          Date.now() + 1000000000,
          {value: ethers.parseEther("1")}
        );
        await tx.wait();
        console.log("Added liquidity");
      }

      const FakeDecoratorBrush = await ethers.getContractFactory("FakeDecoratorBrush");
      fakeBrush = (await upgrades.deployProxy(FakeDecoratorBrush)) as unknown as FakeDecoratorBrush;
      await fakeBrush.waitForDeployment();
      console.log("Deployed brushNonTransferrable");
      tx = await fakeBrush.mint(owner, ethers.parseEther("10000"));
      await tx.wait();
      console.log("Minted fake brush");
      tx = await fakeBrush.approve(router, ethers.parseEther("100000000"));
      await tx.wait();
      console.log("Approved fake brush on the router");
      ({paintSwapMarketplaceWhitelist, paintSwapDecorator} = await deployMockPaintSwapContracts(
        brush,
        wftm,
        await fakeBrush.getAddress()
      ));

      // End of fake brush
    } else {
      throw Error("Not a supported network");
    }
  }

  console.log(`brush = "${(await brush.getAddress()).toLowerCase()}"`);
  console.log(`wftm = "${(await wftm.getAddress()).toLowerCase()}"`);
  console.log(`oracle = "${oracleAddress.toLowerCase()}"`);
  console.log(`samWitchVRF = "${(await vrf.getAddress()).toLowerCase()}"`);
  console.log(`router = "${(await router.getAddress()).toLowerCase()}"`);
  console.log(`paintSwapDecorator = "${(await paintSwapDecorator.getAddress()).toLowerCase()}"`);
  console.log(`paintSwapMarketplaceWhitelist = "${(await paintSwapMarketplaceWhitelist.getAddress()).toLowerCase()}"`);

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
  const startPlayerId = 200_000; // TODO: Can update

  const WorldActions = await ethers.getContractFactory("WorldActions");
  const worldActions = (await upgrades.deployProxy(WorldActions, [], {
    kind: "uups",
    timeout
  })) as unknown as WorldActions;
  await worldActions.waitForDeployment();

  console.log(`worldActions = "${(await worldActions.getAddress()).toLowerCase()}"`);

  // Create the world
  const RandomnessBeacon = await ethers.getContractFactory("RandomnessBeacon");
  const randomnessBeacon = (await upgrades.deployProxy(RandomnessBeacon, [await vrf.getAddress()], {
    kind: "uups",
    timeout
  })) as unknown as RandomnessBeacon;
  await randomnessBeacon.waitForDeployment();

  console.log(`randomnessBeacon = "${(await randomnessBeacon.getAddress()).toLowerCase()}"`);

  const DailyRewardsScheduler = await ethers.getContractFactory("DailyRewardsScheduler");
  const dailyRewardsScheduler = (await upgrades.deployProxy(
    DailyRewardsScheduler,
    [await randomnessBeacon.getAddress()],
    {
      kind: "uups",
      timeout
    }
  )) as unknown as DailyRewardsScheduler;
  await dailyRewardsScheduler.waitForDeployment();

  console.log(`dailyRewardsScheduler = "${(await dailyRewardsScheduler.getAddress()).toLowerCase()}"`);

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
    [await royaltyReceiver.getAddress(), itemsUri, await adminAccess.getAddress(), isBeta],
    {
      kind: "uups",
      unsafeAllow: ["external-library-linking"],
      timeout
    }
  )) as unknown as ItemNFT;
  await itemNFT.waitForDeployment();

  console.log(`itemNFT = "${(await itemNFT.getAddress()).toLowerCase()}"`);

  const maxOrdersPerPrice = 100;
  const OrderBook = await ethers.getContractFactory("OrderBook");
  const orderBook = (await upgrades.deployProxy(
    OrderBook,
    [await itemNFT.getAddress(), await brush.getAddress(), DEV_ADDRESS, 30, 30, maxOrdersPerPrice],
    {
      kind: "uups",
      timeout
    }
  )) as unknown as OrderBook;
  await orderBook.waitForDeployment();
  console.log(`bazaar = "${(await orderBook.getAddress()).toLocaleLowerCase()}"`);

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
      startPlayerId,
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

  const buyPath: [string, string] = [await wftm.getAddress(), await brush.getAddress()];
  const Quests = await ethers.getContractFactory("Quests");
  const quests = (await upgrades.deployProxy(
    Quests,
    [await randomnessBeacon.getAddress(), await router.getAddress(), buyPath],
    {
      kind: "uups",
      timeout
    }
  )) as unknown as Quests;
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
      await randomnessBeacon.getAddress(),
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
  const bank = (await upgrades.deployBeacon(Bank)) as unknown as Bank;
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
      await randomnessBeacon.getAddress(),
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

  const promotionsLibrary = await ethers.deployContract("PromotionsLibrary");
  await promotionsLibrary.waitForDeployment();
  console.log(`promotionsLibrary = "${(await promotionsLibrary.getAddress()).toLowerCase()}"`);

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

  const PassiveActions = await ethers.getContractFactory("PassiveActions");
  const passiveActions = (await upgrades.deployProxy(
    PassiveActions,
    [await players.getAddress(), await itemNFT.getAddress(), await randomnessBeacon.getAddress()],
    {
      kind: "uups",
      timeout
    }
  )) as unknown as PassiveActions;
  await passiveActions.waitForDeployment();
  console.log(`passiveActions = "${(await passiveActions.getAddress()).toLowerCase()}"`);

  const InstantActions = await ethers.getContractFactory("InstantActions");
  const instantActions = (await upgrades.deployProxy(
    InstantActions,
    [await players.getAddress(), await itemNFT.getAddress(), await quests.getAddress()],
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
    timeout: 50000,
    txOverrides: {
      ...(!isDevNetwork(network) ? {gasLimit: 1_500_000} : {}) // gas limit issue needed because of https://github.com/NomicFoundation/hardhat/issues/5855
    }
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
      await quests.getAddress(),
      oracleAddress,
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
  console.log(`eggInstantVRFActionStrategy = "${(await eggInstantVRFActionStrategy.getAddress()).toLowerCase()}"`);

  const BankRelay = await ethers.getContractFactory("BankRelay");
  const bankRelay = (await upgrades.deployProxy(BankRelay, [await clans.getAddress()], {
    kind: "uups"
  })) as unknown as BankRelay;
  await bankRelay.waitForDeployment();
  console.log(`bankRelay = "${(await bankRelay.getAddress()).toLowerCase()}"`);

  const pvpAttackingCooldown = 10 * 60; // 10 minutes
  const PVPBattleground = await ethers.getContractFactory("PVPBattleground");
  const pvpBattleground = (await upgrades.deployProxy(
    PVPBattleground,
    [
      await players.getAddress(),
      await playerNFT.getAddress(),
      await brush.getAddress(),
      await itemNFT.getAddress(),
      oracleAddress,
      await vrf.getAddress(),
      await vrfRequestInfo.getAddress(),
      allBattleSkills,
      pvpAttackingCooldown,
      await adminAccess.getAddress(),
      isBeta
    ],
    {
      kind: "uups",
      timeout
    }
  )) as unknown as PVPBattleground;
  await pvpBattleground.waitForDeployment();
  console.log(`pvpBattleground = "${(await pvpBattleground.getAddress()).toLowerCase()}"`);

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
      await vrf.getAddress(),
      await vrfRequestInfo.getAddress(),
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
      unsafeAllow: ["external-library-linking"],
      timeout
    }
  )) as unknown as Raids;
  await raids.waitForDeployment();
  console.log(`raids = "${(await raids.getAddress()).toLowerCase()}"`);

  const clanBattleLibrary = (await ethers.deployContract("ClanBattleLibrary")) as ClanBattleLibrary;
  console.log(`clanBattleLibrary = "${(await clanBattleLibrary.getAddress()).toLowerCase()}"`);

  const lockedBankVaultsLibrary = await ethers.deployContract("LockedBankVaultsLibrary");
  console.log(`lockedBankVaultsLibrary = "${(await lockedBankVaultsLibrary.getAddress()).toLowerCase()}"`);

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
      DEV_ADDRESS,
      oracleAddress,
      await vrf.getAddress(),
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
      unsafeAllow: ["external-library-linking"],
      timeout
    }
  )) as unknown as LockedBankVaults;
  await lockedBankVaults.waitForDeployment();
  console.log(`lockedBankVaults = "${(await lockedBankVaults.getAddress()).toLowerCase()}"`);

  const maxClanCombatantsTerritories = 20;
  const attackingCooldownTerritories = 24 * 3600; // 1 day
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
      await vrf.getAddress(),
      await vrfRequestInfo.getAddress(),
      allBattleSkills,
      maxClanCombatantsTerritories,
      attackingCooldownTerritories,
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
      await raids.getAddress(),
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
  console.log(`combatantsHelper = "${(await combatantsHelper.getAddress()).toLowerCase()}"`);

  const minHarvestInterval = BigInt(3.75 * 3600); // 3 hours 45 minutes;
  const TerritoryTreasury = await ethers.getContractFactory("TerritoryTreasury");
  const territoryTreasury = await upgrades.deployProxy(TerritoryTreasury, [
    await territories.getAddress(),
    await brush.getAddress(),
    await playerNFT.getAddress(),
    DEV_ADDRESS,
    await treasury.getAddress(),
    minHarvestInterval,
    await paintSwapDecorator.getAddress(),
    pid
  ]);
  await territoryTreasury.waitForDeployment();
  console.log(`territoryTreasury = "${(await territoryTreasury.getAddress()).toLowerCase()}"`);

  const BankRegistry = await ethers.getContractFactory("BankRegistry");
  const bankRegistry = (await upgrades.deployProxy(BankRegistry, [], {
    kind: "uups",
    timeout
  })) as unknown as BankRegistry;
  await bankRegistry.waitForDeployment();
  console.log(`bankRegistry = "${(await bankRegistry.getAddress()).toLowerCase()}"`);

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
      kind: "uups",
      timeout
    }
  )) as unknown as BankFactory;
  await bankFactory.waitForDeployment();
  console.log(`bankFactory = "${(await bankFactory.getAddress()).toLowerCase()}"`);

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
        await orderBook.getAddress(),
        await petNFT.getAddress(),
        await adminAccess.getAddress(),
        await treasury.getAddress(),
        await shop.getAddress(),
        await worldActions.getAddress(),
        await randomnessBeacon.getAddress(),
        await dailyRewardsScheduler.getAddress(),
        await royaltyReceiver.getAddress(),
        await clans.getAddress(),
        await quests.getAddress(),
        await promotions.getAddress(),
        await passiveActions.getAddress(),
        await instantActions.getAddress(),
        await instantVRFActions.getAddress(),
        await lockedBankVaults.getAddress(),
        await territories.getAddress(),
        await clanBattleLibrary.getAddress(),
        await territoryTreasury.getAddress(),
        await combatantsHelper.getAddress(),
        await vrfRequestInfo.getAddress(),
        await bank.getAddress(),
        await upgrades.beacon.getImplementationAddress(await bank.getAddress()),
        await bankRegistry.getAddress(),
        await bankFactory.getAddress(),
        await bankRelay.getAddress()
      ];
      console.log("Verifying contracts...");
      await verifyContracts(addresses);
    } catch (e) {
      console.log("Error verifying contracts", e);
    }
  } else {
    console.log("Skipping verifying contracts");
  }

  tx = await randomnessBeacon.initializeAddresses(wishingWell, dailyRewardsScheduler);
  await tx.wait();
  console.log("world initializeAddress");
  tx = await randomnessBeacon.initializeRandomWords();
  await tx.wait();
  console.log("worldActions initializeRandomWords");
  tx = await playerNFT.setPlayers(players);
  await tx.wait();
  console.log("playerNFT setPlayers");
  tx = await quests.setPlayers(players);
  await tx.wait();
  console.log("quests setPlayers");
  tx = await wishingWell.setPlayers(players);
  await tx.wait();
  console.log("wishingWell setPlayers");

  tx = await petNFT.initializeAddresses(instantVRFActions, players, territories);
  await tx.wait();
  console.log("petNFT initializeAddresses");

  tx = await clans.initializeAddresses(
    players,
    bankFactory,
    territories,
    lockedBankVaults,
    raids,
    paintSwapMarketplaceWhitelist
  );
  await tx.wait();
  console.log("clans initializeAddresses");

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

  tx = await clans.setBrushDistributionPercentages(25, 50, 25);
  await tx.wait();
  console.log("clans.setBrushDistributionPercentages");

  tx = await shop.setItemNFT(itemNFT);
  await tx.wait();
  console.log("shop.setItemNFT");

  tx = await itemNFT.initializeAddresses(bankFactory, players);
  await tx.wait();
  console.log("itemNFT.initializeAddresses");

  tx = await itemNFT.setApproved(
    [
      players,
      shop,
      promotions,
      instantActions,
      territories,
      lockedBankVaults,
      orderBook,
      instantVRFActions,
      passiveActions,
      raids
    ],
    true
  );
  await tx.wait();
  console.log("itemNFT.setApproved");

  tx = await royaltyReceiver.setTerritories(territories);
  await tx.wait();
  console.log("royaltyReceiver.setTerritories");

  tx = await raids.initializeAddresses(combatantsHelper, bankFactory);
  await tx.wait();
  console.log("raids.initializeAddresses");

  tx = await lockedBankVaults.initializeAddresses(territories, combatantsHelper, bankFactory);
  await tx.wait();
  console.log("lockedBankVaults.initializeAddresses");

  tx = await territories.setCombatantsHelper(combatantsHelper);
  await tx.wait();
  console.log("territories.setCombatantsHelper");

  const territoryIds = allTerritories.map((territory) => {
    return territory.territoryId;
  });

  tx = await territories.setMinimumMMRs(territoryIds, allMinimumMMRs);
  await tx.wait();
  console.log("territories.setMinimumMMRs");

  const treasuryAccounts = [await shop.getAddress(), ethers.ZeroAddress];
  const treasuryPercentages = [10, 90];
  tx = await treasury.setFundAllocationPercentages(treasuryAccounts, treasuryPercentages);
  await tx.wait();
  console.log("treasury.setFundAllocationPercentages");

  await treasury.setSpenders([territoryTreasury, shop], true);
  await tx.wait();
  console.log("treasury.setSpenders");

  tx = await bankRelay.setBankFactory(bankFactory);
  await tx.wait();
  console.log("bankRelay.setBankFactory");

  tx = await vrfRequestInfo.setUpdaters([instantVRFActions, lockedBankVaults, territories, pvpBattleground], true);
  await tx.wait();
  console.log("vrfRequestInfo.setUpdaters");

  // Disable PVP and raids for now
  tx = await pvpBattleground.setPreventAttacks(true);
  await tx.wait();
  console.log("pvpBattleground.setPreventAttacks");

  tx = await raids.setPreventRaids(true);
  await tx.wait();
  console.log("raids.setPreventRaids");

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

  // TODO: Remove this when we no longer have the decorator
  tx = await fakeBrush.approve(territoryTreasury, ethers.parseEther("10000000"));
  await tx.wait();
  console.log("Approved fake brush on the territory treasury");
  tx = await territoryTreasury.deposit();
  await tx.wait();
  console.log("Deposit fake brush to territory treasury which deposits to the decorator");

  const chunkSize = 100;
  for (let i = 0; i < allItems.length; i += chunkSize) {
    const chunk = allItems.slice(i, i + chunkSize);
    tx = await itemNFT.addItems(chunk);
    await tx.wait();
    console.log("Add items chunk ", i);
  }

  // Add quests. Make sure this is called before actions etc as they could be prerequisites
  tx = await quests.addQuests(allQuests, allQuestsMinRequirements);
  await tx.wait();
  console.log("Add quests");

  for (let i = 0; i < allOrderBookTokenIdInfos.length; i += chunkSize) {
    const tokenIds: number[] = [];
    const tokenIdInfos: {tick: string; minQuantity: string}[] = [];
    const chunk = allOrderBookTokenIdInfos.slice(i, i + chunkSize);
    chunk.forEach((tokenIdInfo) => {
      tokenIds.push(tokenIdInfo.tokenId);
      tokenIdInfos.push({tick: tokenIdInfo.tick, minQuantity: tokenIdInfo.minQuantity});
    });
    const tx = await orderBook.setTokenIdInfos(tokenIds, tokenIdInfos);
    await tx.wait();
    console.log("orderBook.setTokenIdInfos");
  }

  tx = await players.addFullAttireBonuses(allFullAttireBonuses);
  await tx.wait();
  console.log("Add full attire bonuses");

  await setDailyAndWeeklyRewards(dailyRewardsScheduler);

  tx = await worldActions.addActions(allActions);
  await tx.wait();
  console.log("Add actions");

  tx = await clans.setXPModifiers([lockedBankVaults, territories, wishingWell], true);
  await tx.wait();
  console.log("clans.setXPModifiers");

  const fireMakingActionId = EstforConstants.ACTION_FIREMAKING_ITEM;
  const smithingActionId = EstforConstants.ACTION_SMITHING_ITEM;
  const cookingActionId = EstforConstants.ACTION_COOKING_ITEM;
  const craftingActionId = EstforConstants.ACTION_CRAFTING_ITEM;
  const fletchingActionId = EstforConstants.ACTION_FLETCHING_ITEM;
  const alchemyActionId = EstforConstants.ACTION_ALCHEMY_ITEM;
  const forgingActionId = EstforConstants.ACTION_FORGING_ITEM;
  const genericCombatActionId = EstforConstants.NONE;

  tx = await worldActions.addBulkActionChoices(
    [fireMakingActionId, smithingActionId, cookingActionId],
    [allActionChoiceIdsFiremaking, allActionChoiceIdsSmithing, allActionChoiceIdsCooking],
    [allActionChoicesFiremaking, allActionChoicesSmithing, allActionChoicesCooking]
  );

  await tx.wait();
  console.log("Add action choices1");

  // Add new ones here for gas reasons
  tx = await worldActions.addBulkActionChoices(
    [craftingActionId, fletchingActionId],
    [allActionChoiceIdsCrafting, allActionChoiceIdsFletching],
    [allActionChoicesCrafting, allActionChoicesFletching]
  );

  await tx.wait();
  console.log("Add action choices2");

  // Add new ones here for gas reasons
  tx = await worldActions.addBulkActionChoices(
    [alchemyActionId, forgingActionId],
    [allActionChoiceIdsAlchemy, allActionChoiceIdsForging],
    [allActionChoicesAlchemy, allActionChoicesForging]
  );

  await tx.wait();
  console.log("Add action choices3");

  tx = await worldActions.addBulkActionChoices(
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

  // Add clan tiers
  tx = await clans.addTiers(isBeta ? allClanTiersBeta : allClanTiers);
  await tx.wait();
  console.log("Add clan tiers");

  // Add instant actions
  const _allInstantActions = allInstantActions.filter((action) => action.isAvailable);
  for (let i = 0; i < _allInstantActions.length; i += chunkSize) {
    const chunk = _allInstantActions.slice(i, i + chunkSize);
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

  // Add passive actions
  tx = await passiveActions.addActions(allPassiveActions);
  await tx.wait();
  console.log("Add passive actions");

  // Add base pets
  const basePetChunkSize = 20;
  for (let i = 0; i < allBasePets.length; i += basePetChunkSize) {
    const chunk = allBasePets.slice(i, i + basePetChunkSize);
    tx = await petNFT.addBasePets(chunk);
    await tx.wait();
    console.log("Add base pets chunk ", i);
  }

  // Add base raids
  tx = await raids.addBaseRaids(allBaseRaidIds, allBaseRaids);
  await tx.wait();
  console.log("Add base raids");

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
    EstforConstants.SECRET_EGG_4_TIER5
  ];

  tx = await shop.addUnsellableItems(items);
  await tx.wait();
  console.log("Add unsellable items");

  tx = await adminAccess.addPromotionalAdmins(["0xe9fb52d7611e502d93af381ac493981b42d91974"]);
  await tx.wait();
  console.log("Add promotional admins");

  // Add test data for the game
  if (isBeta) {
    await adminAccess.addAdmins([
      "0xb4dda75e5dee0a9e999152c3b72816fc1004d1dd",
      "0xF83219Cd7D96ab2D80f16D36e5d9D00e287531eC",
      "0xa801864d0D24686B15682261aa05D4e1e6e5BD94"
    ]);

    await addTestData(
      itemNFT,
      playerNFT,
      players,
      shop,
      brush,
      clans,
      bankFactory,
      bank,
      minItemQuantityBeforeSellsAllowed,
      orderBook,
      quests
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
