import {EstforConstants} from "@paintswap/estfor-definitions";
import {ethers, upgrades} from "hardhat";
import {
  BankFactory,
  Clans,
  ItemNFT,
  MockBrushToken,
  MockOracleClient,
  MockRouter,
  MockWrappedFantom,
  PlayerNFT,
  Players,
  Quests,
  Shop,
} from "../typechain-types";
import {isDevNetwork, verifyContracts} from "./utils";
import {allItems} from "./data/items";
import {allActions} from "./data/actions";

import {
  allActionChoicesFiremaking,
  allActionChoicesCooking,
  allActionChoicesCrafting,
  allActionChoicesMagic,
  allActionChoicesMelee,
  allActionChoicesSmithing,
} from "./data/actionChoices";
import {
  allActionChoiceIdsFiremaking,
  allActionChoiceIdsCooking,
  allActionChoiceIdsCrafting,
  allActionChoiceIdsMagic,
  allActionChoiceIdsMelee,
  allActionChoiceIdsSmithing,
} from "./data/actionChoiceIds";
import {BRUSH_ADDRESS, WFTM_ADDRESS} from "./contractAddresses";
import {addTestData} from "./addTestData";
import {whitelistedAdmins} from "@paintswap/estfor-definitions/constants";
import {BigNumber} from "ethers";
import {allShopItems, allShopItemsBeta} from "./data/shopItems";
import {allFullAttireBonuses} from "./data/fullAttireBonuses";
import {allXPThresholdRewards} from "./data/xpThresholdRewards";
import {avatarInfos} from "./data/avatars";
import {allQuestsMinRequirements, allQuests, allQuestsRandomFlags} from "./data/quests";
import {allClanTiers, allClanTiersBeta} from "./data/clans";
import {allDailyRewards} from "./data/dailyRwards";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Deploying contracts with the account: ${owner.address}`);

  const network = await ethers.provider.getNetwork();
  console.log(`ChainId: ${network.chainId}`);

  let brush: MockBrushToken;
  let wftm: MockWrappedFantom;
  let oracle: MockOracleClient;
  let router: MockRouter;
  let tx;
  let devAddress = "0x045eF160107eD663D10c5a31c7D2EC5527eea1D0";
  {
    const MockBrushToken = await ethers.getContractFactory("MockBrushToken");
    const MockWrappedFantom = await ethers.getContractFactory("MockWrappedFantom");
    const MockOracleClient = await ethers.getContractFactory("MockOracleClient");
    const MockRouter = await ethers.getContractFactory("MockRouter");
    if (isDevNetwork(network)) {
      brush = await MockBrushToken.deploy();
      await brush.mint(owner.address, ethers.utils.parseEther("1000"));
      wftm = await MockWrappedFantom.deploy();
      console.log("Minted brush");
      oracle = await MockOracleClient.deploy();
      console.log(`mockOracleClient = "${oracle.address.toLowerCase()}"`);
      router = await MockRouter.deploy();
    } else if (network.chainId == 4002) {
      // Fantom testnet
      brush = await MockBrushToken.deploy();
      tx = await brush.mint(owner.address, ethers.utils.parseEther("1000"));
      console.log("Minted brush");
      await tx.wait();
      wftm = await MockWrappedFantom.attach("0xf1277d1ed8ad466beddf92ef448a132661956621");
      oracle = await MockOracleClient.deploy();
      console.log(`mockOracleClient = "${oracle.address.toLowerCase()}"`);
      router = await MockRouter.attach("0xa6AD18C2aC47803E193F75c3677b14BF19B94883");
    } else if (network.chainId == 250) {
      // Fantom mainnet
      brush = await MockBrushToken.attach(BRUSH_ADDRESS);
      wftm = await MockWrappedFantom.attach(WFTM_ADDRESS);
      oracle = await MockOracleClient.attach("0xd5d517abe5cf79b7e95ec98db0f0277788aff634");
      router = await MockRouter.attach("0x31F63A33141fFee63D4B26755430a390ACdD8a4d");
    } else {
      throw Error("Not a supported network");
    }
  }

  // Create the world
  const WorldLibrary = await ethers.getContractFactory("WorldLibrary");
  const worldLibrary = await WorldLibrary.deploy();
  await worldLibrary.deployed();
  console.log(`worldLibrary = "${worldLibrary.address.toLowerCase()}"`);
  const subscriptionId = 62;
  const World = await ethers.getContractFactory("World", {
    libraries: {WorldLibrary: worldLibrary.address},
  });
  const world = await upgrades.deployProxy(World, [oracle.address, subscriptionId, allDailyRewards], {
    kind: "uups",
    unsafeAllow: ["external-library-linking"],
  });
  await world.deployed();
  console.log(`world = "${world.address.toLowerCase()}"`);

  const Shop = await ethers.getContractFactory("Shop");
  const shop = (await upgrades.deployProxy(Shop, [brush.address, devAddress], {
    kind: "uups",
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
  });
  await adminAccess.deployed();
  console.log(`adminAccess = "${adminAccess.address.toLowerCase()}"`);

  let itemsUri: string;
  let imageBaseUri: string;
  let editNameBrushPrice: BigNumber;
  const isBeta = process.env.IS_BETA == "true";
  if (isBeta) {
    itemsUri = "ipfs://QmbeAfkwtN6noryKLwzhA3JzsDd67FXuS4RCLfyugUowEP/";
    imageBaseUri = "ipfs://QmRKgkf5baZ6ET7ZWyptbzePRYvtEeomjdkYmurzo8donW/";
    editNameBrushPrice = ethers.utils.parseEther("1");
  } else {
    // live version
    itemsUri = "ipfs://TODO/";
    imageBaseUri = "ipfs://TODO/";
    editNameBrushPrice = ethers.utils.parseEther("1000");
  }

  // Create NFT contract which contains all items
  const ItemNFTLibrary = await ethers.getContractFactory("ItemNFTLibrary");
  const itemNFTLibrary = await ItemNFTLibrary.deploy();
  await itemNFTLibrary.deployed();
  console.log(`itemNFTLibrary = "${itemNFTLibrary.address.toLowerCase()}"`);
  const ItemNFT = await ethers.getContractFactory("ItemNFT", {libraries: {ItemNFTLibrary: itemNFTLibrary.address}});
  const itemNFT = (await upgrades.deployProxy(
    ItemNFT,
    [world.address, shop.address, royaltyReceiver.address, adminAccess.address, itemsUri, isBeta],
    {
      kind: "uups",
      unsafeAllow: ["external-library-linking"],
    }
  )) as ItemNFT;
  await itemNFT.deployed();
  console.log(`itemNFT = "${itemNFT.address.toLowerCase()}"`);

  // Create NFT contract which contains all the players
  const EstforLibrary = await ethers.getContractFactory("EstforLibrary");
  const estforLibrary = await EstforLibrary.deploy();
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
      imageBaseUri,
      isBeta,
    ],
    {
      kind: "uups",
      unsafeAllow: ["external-library-linking"],
    }
  )) as PlayerNFT;
  await playerNFT.deployed();
  console.log(`playerNFT = "${playerNFT.address.toLowerCase()}"`);

  const Quests = await ethers.getContractFactory("Quests");
  const quests = (await upgrades.deployProxy(Quests, [world.address, router.address, buyPath], {
    kind: "uups",
  })) as Quests;
  await quests.deployed();
  console.log(`quests = "${quests.address.toLowerCase()}"`);

  const Clans = await ethers.getContractFactory("Clans", {
    libraries: {EstforLibrary: estforLibrary.address},
  });
  const clans = (await upgrades.deployProxy(
    Clans,
    [brush.address, playerNFT.address, shop.address, devAddress, editNameBrushPrice],
    {
      kind: "uups",
      unsafeAllow: ["external-library-linking"],
    }
  )) as Clans;
  await clans.deployed();
  console.log(`clans = "${clans.address.toLowerCase()}"`);

  const Bank = await ethers.getContractFactory("Bank");
  const bank = await upgrades.deployBeacon(Bank);
  await bank.deployed();
  console.log(`bank = "${bank.address.toLowerCase()}"`);

  // This contains all the player data
  const PlayersLibrary = await ethers.getContractFactory("PlayersLibrary");
  const playerLibrary = await PlayersLibrary.deploy();
  await playerLibrary.deployed();
  console.log(`playersLibrary = "${playerLibrary.address.toLowerCase()}"`);

  const PlayersImplQueueActions = await ethers.getContractFactory("PlayersImplQueueActions", {
    libraries: {PlayersLibrary: playerLibrary.address},
  });
  const playersImplQueueActions = await PlayersImplQueueActions.deploy();
  await playersImplQueueActions.deployed();
  console.log(`playersImplQueueActions = "${playersImplQueueActions.address.toLowerCase()}"`);

  const PlayersImplProcessActions = await ethers.getContractFactory("PlayersImplProcessActions", {
    libraries: {PlayersLibrary: playerLibrary.address},
  });
  const playersImplProcessActions = await PlayersImplProcessActions.deploy();
  await playersImplProcessActions.deployed();
  console.log(`playersImplProcessActions = "${playersImplProcessActions.address.toLowerCase()}"`);

  const PlayersImplRewards = await ethers.getContractFactory("PlayersImplRewards", {
    libraries: {PlayersLibrary: playerLibrary.address},
  });
  const playersImplRewards = await PlayersImplRewards.deploy();
  await playersImplRewards.deployed();
  console.log(`playersImplRewards = "${playersImplRewards.address.toLowerCase()}"`);

  const PlayersImplMisc = await ethers.getContractFactory("PlayersImplMisc", {
    libraries: {PlayersLibrary: playerLibrary.address},
  });
  const playersImplMisc = await PlayersImplMisc.deploy();
  console.log(`playersImplMisc = "${playersImplMisc.address.toLowerCase()}"`);
  await playersImplMisc.deployed();

  const Players = await ethers.getContractFactory("Players", {
    libraries: {PlayersLibrary: playerLibrary.address},
  });

  const players = (await upgrades.deployProxy(
    Players,
    [
      itemNFT.address,
      playerNFT.address,
      world.address,
      adminAccess.address,
      quests.address,
      clans.address,
      playersImplQueueActions.address,
      playersImplProcessActions.address,
      playersImplRewards.address,
      playersImplMisc.address,
      isBeta,
    ],
    {
      kind: "uups",
      unsafeAllow: ["delegatecall", "external-library-linking"],
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
    }
  );
  await bankRegistry.deployed();
  console.log(`bankRegistry = "${bankRegistry.address.toLowerCase()}"`);

  const BankFactory = await ethers.getContractFactory("BankFactory");
  const bankFactory = (await upgrades.deployProxy(BankFactory, [bankRegistry.address, bank.address], {
    kind: "uups",
  })) as BankFactory;
  await bankFactory.deployed();
  console.log(`bankFactory = "${bankFactory.address.toLowerCase()}"`);

  // Verify the contracts now, better to bail now before we start setting up the contract data
  if (network.chainId == 250) {
    try {
      const addresses = [
        players.address,
        estforLibrary.address,
        playerNFT.address,
        itemNFTLibrary.address,
        itemNFT.address,
        adminAccess.address,
        shop.address,
        worldLibrary.address,
        world.address,
        royaltyReceiver.address,
        quests.address,
        clans.address,
        bank.address,
        bankRegistry.address,
        bankFactory.address,
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

  tx = await clans.setBankFactory(bankFactory.address);
  await tx.wait();
  console.log("clans setBankFactory");
  tx = await itemNFT.setBankFactory(bankFactory.address);
  await tx.wait();
  console.log("itemNFT setBankFactory");

  tx = await shop.setItemNFT(itemNFT.address);
  await tx.wait();
  console.log("setItemNFT");

  tx = await players.setDailyRewardsEnabled(true);
  await tx.wait();
  console.log("Set daily rewards enabled");

  const startAvatarId = 1;
  tx = await playerNFT.setAvatars(startAvatarId, avatarInfos);
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

  tx = await world.addActions(allActions);
  await tx.wait();
  console.log("Add actions");

  const fireMakingActionId = EstforConstants.ACTION_FIREMAKING_ITEM;
  const smithingActionId = EstforConstants.ACTION_SMITHING_ITEM;
  const cookingActionId = EstforConstants.ACTION_COOKING_ITEM;
  const craftingActionId = EstforConstants.ACTION_CRAFTING_ITEM;
  const genericCombatActionId = EstforConstants.NONE;

  tx = await world.addBulkActionChoices(
    [
      fireMakingActionId,
      smithingActionId,
      cookingActionId,
      craftingActionId,
      genericCombatActionId,
      genericCombatActionId,
    ],
    [
      allActionChoiceIdsFiremaking,
      allActionChoiceIdsSmithing,
      allActionChoiceIdsCooking,
      allActionChoiceIdsCrafting,
      allActionChoiceIdsMelee,
      allActionChoiceIdsMagic,
    ],
    [
      allActionChoicesFiremaking,
      allActionChoicesSmithing,
      allActionChoicesCooking,
      allActionChoicesCrafting,
      allActionChoicesMelee,
      allActionChoicesMagic,
    ]
  );

  await tx.wait();
  console.log("Add action choices");

  // Add shop items
  tx = await shop.addBuyableItems(isBeta ? allShopItemsBeta : allShopItems);
  await tx.wait();
  console.log("Add shopping items");

  // Add quests
  tx = await quests.addQuests(allQuests, allQuestsRandomFlags, allQuestsMinRequirements);
  await tx.wait();
  console.log("Add quests");

  // Add clan tiers
  tx = await clans.addTiers(isBeta ? allClanTiersBeta : allClanTiers);
  await tx.wait();
  console.log("Add clan tiers");

  // Add test data for the game
  if (isBeta) {
    await addTestData(itemNFT, playerNFT, players, shop, brush, quests, clans, bankFactory);
  }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
