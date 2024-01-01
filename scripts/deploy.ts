import {EstforConstants} from "@paintswap/estfor-definitions";
import {ethers, upgrades} from "hardhat";
import {
  BankFactory,
  Clans,
  InstantActions,
  ItemNFT,
  MockAPI3OracleClient,
  MockBrushToken,
  MockOracleClient,
  MockPaintSwapMarketplaceWhitelist,
  MockRouter,
  MockWrappedFantom,
  PlayerNFT,
  Players,
  Promotions,
  Quests,
  Shop,
  TestPaintSwapArtGallery,
  TestPaintSwapDecorator,
  World,
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
} from "./data/actionChoiceIds";
import {BRUSH_ADDRESS, DECORATOR_ADDRESS, DEV_ADDRESS, WFTM_ADDRESS} from "./contractAddresses";
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
import {allTerritories, allTerritorySkills} from "./data/territories";
import {execSync} from "child_process";
import path from "path";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Deploying contracts with the account: ${owner.address}`);

  const network = await ethers.provider.getNetwork();
  console.log(`ChainId: ${network.chainId}`);

  let brush: MockBrushToken;
  let wftm: MockWrappedFantom;
  let oracle: MockOracleClient;
  let api3Oracle: MockAPI3OracleClient;
  let router: MockRouter;
  let paintSwapMarketplaceWhitelist: MockPaintSwapMarketplaceWhitelist;
  let paintSwapDecorator: TestPaintSwapDecorator;
  let paintSwapArtGallery: TestPaintSwapArtGallery;
  let tx;
  let devAddress = DEV_ADDRESS;
  let pid = 0;
  {
    const MockBrushToken = await ethers.getContractFactory("MockBrushToken");
    const MockWrappedFantom = await ethers.getContractFactory("MockWrappedFantom");
    const MockOracleClient = await ethers.getContractFactory("MockOracleClient");
    const MockAPI3OracleClient = await ethers.getContractFactory("MockAPI3OracleClient");
    const MockRouter = await ethers.getContractFactory("MockRouter");
    const MockPaintSwapMarketplaceWhitelist = await ethers.getContractFactory("MockPaintSwapMarketplaceWhitelist");
    const TestPaintSwapArtGallery = await ethers.getContractFactory("TestPaintSwapArtGallery");
    const TestPaintSwapDecorator = await ethers.getContractFactory("TestPaintSwapDecorator");
    if (isDevNetwork(network)) {
      brush = await MockBrushToken.deploy();
      await brush.mint(owner.address, ethers.utils.parseEther("1000"));
      wftm = await MockWrappedFantom.deploy();
      console.log("Minted brush");
      oracle = await MockOracleClient.deploy();
      console.log(`mockOracleClient = "${oracle.address.toLowerCase()}"`);
      api3Oracle = await MockAPI3OracleClient.deploy();
      console.log(`mockAPI3OracleClient = "${api3Oracle.address.toLowerCase()}"`);
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
      oracle = await MockOracleClient.deploy();
      await oracle.deployed();
      console.log(`mockOracleClient = "${oracle.address.toLowerCase()}"`);
      api3Oracle = await MockAPI3OracleClient.deploy();
      console.log(`mockAPI3OracleClient = "${api3Oracle.address.toLowerCase()}"`);
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
      oracle = await MockOracleClient.attach("0xd5d517abe5cf79b7e95ec98db0f0277788aff634");
      api3Oracle = await MockAPI3OracleClient.attach("0xa0AD79D995DdeeB18a14eAef56A549A04e3Aa1Bd");
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

  // Create the world
  const WorldLibrary = await ethers.getContractFactory("WorldLibrary");
  const worldLibrary = await WorldLibrary.deploy();
  await worldLibrary.deployed();
  console.log(`worldLibrary = "${worldLibrary.address.toLowerCase()}"`);
  const subscriptionId = 62;
  const World = await ethers.getContractFactory("World", {
    libraries: {WorldLibrary: worldLibrary.address},
  });
  const world = (await upgrades.deployProxy(World, [oracle.address, subscriptionId], {
    kind: "uups",
    unsafeAllow: ["external-library-linking"],
    timeout,
  })) as World;
  await world.deployed();
  console.log(`world = "${world.address.toLowerCase()}"`);

  const Shop = await ethers.getContractFactory("Shop");
  const shop = (await upgrades.deployProxy(Shop, [brush.address, devAddress], {
    kind: "uups",
    timeout,
  })) as Shop;

  await shop.deployed();
  console.log(`shop = "${shop.address.toLowerCase()}"`);

  const buyPath: [string, string] = [wftm.address, brush.address];
  const RoyaltyReceiver = await ethers.getContractFactory("RoyaltyReceiver");
  const royaltyReceiver = await upgrades.deployProxy(
    RoyaltyReceiver,
    [router.address, shop.address, devAddress, brush.address, buyPath],
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

  let itemsUri: string;
  let heroImageBaseUri: string;
  let editNameBrushPrice: BigNumber;
  let upgradePlayerBrushPrice: BigNumber;
  let raffleEntryCost: BigNumber;
  let startGlobalDonationThresholdRewards: BigNumber;
  let clanDonationThresholdRewardIncrement: BigNumber;
  if (isBeta) {
    itemsUri = "ipfs://Qmdzh1Z9bxW5yc7bR7AdQi4P9RNJkRyVRgELojWuKXp8qB/";
    heroImageBaseUri = "ipfs://QmRKgkf5baZ6ET7ZWyptbzePRYvtEeomjdkYmurzo8donW/";
    editNameBrushPrice = ethers.utils.parseEther("1");
    upgradePlayerBrushPrice = ethers.utils.parseEther("1");
    raffleEntryCost = ethers.utils.parseEther("5");
    startGlobalDonationThresholdRewards = ethers.utils.parseEther("1000");
    clanDonationThresholdRewardIncrement = ethers.utils.parseEther("50");
  } else {
    // live version
    itemsUri = "ipfs://QmQvWjU5KqNSjHipYdvGvF1wZh7kj2kkvbmEyv9zgbzhPK/";
    heroImageBaseUri = "ipfs://QmQZZuMwTVNxz13aT3sKxvxCHgrNhqqtGqud8vxbEFhhoK/";
    editNameBrushPrice = ethers.utils.parseEther("1000");
    upgradePlayerBrushPrice = ethers.utils.parseEther("2000");
    raffleEntryCost = ethers.utils.parseEther("12");
    startGlobalDonationThresholdRewards = ethers.utils.parseEther("300000");
    clanDonationThresholdRewardIncrement = ethers.utils.parseEther("5000");
  }

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
      devAddress,
      royaltyReceiver.address,
      adminAccess.address,
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
      devAddress,
      editNameBrushPrice,
      paintSwapMarketplaceWhitelist.address,
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

  const PlayersLibrary = await ethers.getContractFactory("PlayersLibrary");
  const playersLibrary = await PlayersLibrary.deploy();
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

  const InstantActions = await ethers.getContractFactory("InstantActions");
  const instantActions = (await upgrades.deployProxy(InstantActions, [players.address, itemNFT.address], {
    kind: "uups",
    timeout,
  })) as InstantActions;
  await instantActions.deployed();
  console.log(`instantActions = "${instantActions.address.toLowerCase()}"`);

  const clanBattleLibrary = await ethers.deployContract("ClanBattleLibrary", {
    libraries: {PlayersLibrary: playersLibrary.address},
  });
  console.log(`clanBattleLibrary = "${clanBattleLibrary.address.toLowerCase()}"`);

  const airnode = "0x224e030f03Cd3440D88BD78C9BF5Ed36458A1A25";
  const xpub =
    "xpub6CyZcaXvbnbqGfqqZWvWNUbGvdd5PAJRrBeAhy9rz1bbnFmpVLg2wPj1h6TyndFrWLUG3kHWBYpwacgCTGWAHFTbUrXEg6LdLxoEBny2YDz";
  const endpointIdUint256 = "0xffd1bbe880e7b2c662f6c8511b15ff22d12a4a35d5c8c17202893a5f10e25284";
  const endpointIdUint256Array = "0x4554e958a68d68de6a4f6365ff868836780e84ac3cba75ce3f4c78a85faa8047";

  const LockedBankVaults = await ethers.getContractFactory("LockedBankVaults", {
    libraries: {ClanBattleLibrary: clanBattleLibrary.address},
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
      devAddress,
      allTerritorySkills,
      api3Oracle.address,
      airnode,
      endpointIdUint256,
      endpointIdUint256Array,
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

  const Territories = await ethers.getContractFactory("Territories", {
    libraries: {ClanBattleLibrary: clanBattleLibrary.address},
  });
  const territories = await upgrades.deployProxy(
    Territories,
    [
      allTerritories,
      players.address,
      clans.address,
      brush.address,
      lockedBankVaults.address,
      itemNFT.address,
      allTerritorySkills,
      api3Oracle.address,
      airnode,
      endpointIdUint256,
      endpointIdUint256Array,
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
    devAddress,
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
        instantActions.address,
        clanBattleLibrary.address,
        territories.address,
        decoratorProvider.address,
        combatantsHelper.address,
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

  tx = await itemNFT.setInstantActions(instantActions.address);
  await tx.wait();
  console.log("itemNFT setInstantActions");

  tx = await shop.setItemNFT(itemNFT.address);
  await tx.wait();
  console.log("shop.setItemNFT");

  tx = await clans.setTerritoriesAndLockedBankVaults(territories.address, lockedBankVaults.address);
  await tx.wait();
  console.log("clans.setTerritoriesAndLockedBankVaults");
  tx = await itemNFT.setTerritoriesAndLockedBankVaults(territories.address, lockedBankVaults.address);
  await tx.wait();
  console.log("itemNFT.setTerritoriesAndLockedBankVaults");
  tx = await lockedBankVaults.setTerritories(territories.address);
  await tx.wait();
  console.log("lockedBankVaults.setTerritories");

  const sponsorWalletCallers = [lockedBankVaults, territories];
  for (const sponsorWalletCaller of sponsorWalletCallers) {
    const command = `${path.join(
      "node_modules",
      ".bin",
      "airnode-admin"
    )} derive-sponsor-wallet-address  --airnode-address ${airnode} --airnode-xpub ${xpub} --sponsor-address ${
      sponsorWalletCaller.address
    }`;

    try {
      const result = execSync(command, {encoding: "utf-8"});
      const arr = result.split(": ");
      // Extract the wallet address from the output
      const sponsorWallet = arr[1].slice(0, 42);

      tx = await sponsorWalletCaller.setCombatantsHelper(combatantsHelper.address);
      await tx.wait();
      console.log("setCombatantsHelper");
      tx = await sponsorWalletCaller.setSponsorWallet(sponsorWallet);
      await tx.wait();
      console.log(`setSponsorWallet = "${sponsorWallet.toLowerCase()}"`);
      tx = await owner.sendTransaction({to: sponsorWallet, value: ethers.utils.parseEther("1")});
      await tx.wait();
      console.log();
    } catch (error) {
      console.error(`Error: ${error}`);
    }
  }

  tx = await bankRegistry.setLockedBankVaults(lockedBankVaults.address);
  await tx.wait();
  console.log("bankRegistry.setLockedBankVaults");

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
    const tokenIds: number[] = [];
    const amounts: number[] = [];
    const chunk = allItems.slice(i, i + chunkSize);
    chunk.forEach((item) => {
      tokenIds.push(item.tokenId);
      amounts.push(200);
    });
    tx = await itemNFT.addItems(chunk);
    await tx.wait();
    console.log("Add items chunk ", i);
  }

  // Add full equipment bonuses
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
  const genericCombatActionId = EstforConstants.NONE;

  tx = await world.addBulkActionChoices(
    [fireMakingActionId, smithingActionId, cookingActionId, craftingActionId],
    [allActionChoiceIdsFiremaking, allActionChoiceIdsSmithing, allActionChoiceIdsCooking, allActionChoiceIdsCrafting],
    [allActionChoicesFiremaking, allActionChoicesSmithing, allActionChoicesCooking, allActionChoicesCrafting]
  );

  await tx.wait();
  console.log("Add action choices1");

  // Add new ones here
  tx = await world.addBulkActionChoices(
    [fletchingActionId, alchemyActionId],
    [allActionChoiceIdsFletching, allActionChoiceIdsAlchemy],
    [allActionChoicesFletching, allActionChoicesAlchemy]
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
  tx = await instantActions.addActions(allInstantActions);
  await tx.wait();
  console.log("Add instant actions");

  // Add test data for the game
  if (isBeta) {
    await addTestData(itemNFT, playerNFT, players, shop, brush, clans, bankFactory);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
