import {ethers, upgrades} from "hardhat";
import {
  ITEM_NFT_ADDRESS,
  WORLD_ADDRESS,
  PLAYERS_ADDRESS,
  PLAYERS_LIBRARY_ADDRESS,
  CLANS_ADDRESS,
  PLAYER_NFT_ADDRESS,
  ITEM_NFT_LIBRARY_ADDRESS,
  ESTFOR_LIBRARY_ADDRESS,
  SHOP_ADDRESS,
} from "./contractAddresses";
import {deployPlayerImplementations, setDailyAndWeeklyRewards, verifyContracts} from "./utils";
import {Players, World} from "../typechain-types";
import {allXPThresholdRewards} from "./data/xpThresholdRewards";
import {ActionChoiceInput, Skill} from "@paintswap/estfor-definitions/types";
import {allInstantActions} from "./data/instantActions";
import {allActionChoiceIdsAlchemy, allActionChoiceIdsForging} from "./data/actionChoiceIds";
import {allActionChoicesAlchemy, allActionChoicesForging} from "./data/actionChoices";
import {EstforConstants} from "@paintswap/estfor-definitions";
import {allActions} from "./data/actions";
import {avatarIds, avatarInfos} from "./data/avatars";
import {allItems} from "./data/items";
import {ShopItem, allShopItems} from "./data/shopItems";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Large upgrade using account: ${owner.address}`);

  //  const owner = await ethers.getImpersonatedSigner("0x316342122A9ae36de41B231260579b92F4C8Be7f");

  const network = await ethers.provider.getNetwork();
  console.log(`ChainId: ${network.chainId}`);

  const timeout = 600 * 1000; // 10 minutes

  /* Overhaul upgrade #1
  const PlayersLibrary = await ethers.getContractFactory("PlayersLibrary");
  const playersLibrary = await PlayersLibrary.deploy();
  console.log(`playersLibrary = "${playersLibrary.address.toLowerCase()}"`);

  const Players = (await ethers.getContractFactory("Players")).connect(owner);
  let players = Players.attach(PLAYERS_ADDRESS);
  await players.pauseGame(true);
  players = (await upgrades.upgradeProxy(PLAYERS_ADDRESS, Players, {
    kind: "uups",
    unsafeAllow: ["delegatecall", "external-library-linking"],
  })) as Players;
  await players.deployed();
  console.log("Deployed Players");

  // Update player impls
  const {playersImplQueueActions, playersImplProcessActions, playersImplRewards, playersImplMisc, playersImplMisc1} =
    await deployPlayerImplementations(playersLibrary.address);
  let tx = await players.setImpls(
    playersImplQueueActions.address,
    playersImplProcessActions.address,
    playersImplRewards.address,
    playersImplMisc.address,
    playersImplMisc1.address
  );
  await tx.wait();
  console.log("setImpls");

  // Update absence boost in xp threshold
  const thresholdRewards = allXPThresholdRewards.find((reward) => reward.xpThreshold === 2700000);
  if (!thresholdRewards) {
    throw new Error("Reward not found");
  }
  tx = await players.editXPThresholdRewards([thresholdRewards]);
  await tx.wait();
  console.log("editXPThresholdRewards");

  // Update daily reward pools
  const WorldLibrary = await ethers.getContractFactory("WorldLibrary");
  const worldLibrary = await WorldLibrary.deploy();
  console.log(`worldLibrary = "${worldLibrary.address.toLowerCase()}"`);

  const World = (await ethers.getContractFactory("World", {libraries: {WorldLibrary: worldLibrary.address}})).connect(
    owner
  );
  const world = (await upgrades.upgradeProxy(WORLD_ADDRESS, World, {
    kind: "uups",
    unsafeAllow: ["external-library-linking"],
  })) as World;
  await world.deployed();
  console.log("world upgraded");

  await setDailyAndWeeklyRewards(world);
  console.log("setDailyAndWeeklyRewards");

  // ItemNFT
  const ItemNFTLibrary = await ethers.getContractFactory("ItemNFTLibrary");
  const itemNFTLibrary = await ItemNFTLibrary.deploy();
  await itemNFTLibrary.deployed();
  console.log(`itemNFTLibrary = "${itemNFTLibrary.address.toLowerCase()}"`);

  const ItemNFT = (
    await ethers.getContractFactory("ItemNFT", {libraries: {ItemNFTLibrary: itemNFTLibrary.address}})
  ).connect(owner);
  const itemNFT = await upgrades.upgradeProxy(ITEM_NFT_ADDRESS, ItemNFT, {
    kind: "uups",
    unsafeAllow: ["external-library-linking"],
  });
  await itemNFT.deployed();
  console.log(`itemNFT deployed`);
  */

  /* Overhaul upgrade #2
  const estforLibrary = await ethers.deployContract("EstforLibrary");
  console.log(`estforLibrary = "${estforLibrary.address.toLowerCase()}"`);

  const playersLibrary = await ethers.deployContract("PlayersLibrary");
  console.log(`playersLibrary = "${playersLibrary.address.toLowerCase()}"`);

  const Players = (
    await ethers.getContractFactory("Players")
  ).connect(owner);
  const players = (await upgrades.upgradeProxy(PLAYERS_ADDRESS, Players, {
    kind: "uups",
    unsafeAllow: ["delegatecall", "external-library-linking"],
    timeout,
  })) as Players;
  await players.deployed();
  console.log("Deployed Players");

  // Update player impls
  const {playersImplQueueActions, playersImplProcessActions, playersImplRewards, playersImplMisc, playersImplMisc1} =
    await deployPlayerImplementations(playersLibrary.address);
  let tx = await players.setImpls(
    playersImplQueueActions.address,
    playersImplProcessActions.address,
    playersImplRewards.address,
    playersImplMisc.address,
    playersImplMisc1.address
  );
  await tx.wait();
  console.log("setImpls");

  const Clans = (
    await ethers.getContractFactory("Clans", {
      libraries: {EstforLibrary: estforLibrary.address},
    })
  ).connect(owner);
  const clans = await upgrades.upgradeProxy(CLANS_ADDRESS, Clans, {
    kind: "uups",
    unsafeAllow: ["external-library-linking"],
    timeout,
  });
  await clans.deployed();
  console.log(`clans = "${clans.address.toLowerCase()}"`);

  const psMarketplaceWhitelist = "0x7559038535f3d6ed6BAc5a54Ab4B69DA827F44BD";
  tx = await clans.setPaintSwapMarketplaceWhitelist(psMarketplaceWhitelist);
  await tx.wait();
  console.log("setPaintSwapMarketplaceWhitelist");

  const PlayerNFT = (
    await ethers.getContractFactory("PlayerNFT", {
      libraries: {EstforLibrary: estforLibrary.address},
    })
  ).connect(owner);
  const playerNFT = await upgrades.upgradeProxy(PLAYER_NFT_ADDRESS, PlayerNFT, {
    kind: "uups",
    unsafeAllow: ["external-library-linking"],
    timeout,
  });
  await playerNFT.deployed();
  console.log("Deployed");
  tx = await playerNFT.setUpgradeCost(ethers.utils.parseEther("1208924")); // To prevent anyone doing it early
  await tx.wait();

  // Check a clan leader
  const clanId = (await clans.nextClanId()).add(1);
  console.log("Before clan rank", (await clans.playerInfo(2258)).rank);
  for (let i = ethers.BigNumber.from(1); i.lt(clanId); i = i.add(100)) {
    const tx = await clans.tempUpdateClanRankLeaders(i, i.add(99));
    await tx.wait();
    console.log("clans.tempUpdateClanRankLeaders", i.toString());
  }
  console.log("After clan rank (should be 1 more)", (await clans.playerInfo(2258)).rank);

  // Update max level flags
  console.log("before");
  let packedXP = await players.packedXP(69);
  console.log(packedXP.magic);
  console.log(packedXP.melee);
  console.log(packedXP.defence);
  console.log(Number(packedXP.packedDataIsMaxed).toString(2));
  console.log(Number(packedXP.packedDataIsMaxed1).toString(2));
  console.log(Number(packedXP.packedDataIsMaxed2).toString(2));

  // Tiam
  packedXP = await players.packedXP(465);
  console.log(packedXP.magic);
  console.log(Number(packedXP.packedDataIsMaxed).toString(2));
  console.log(Number(packedXP.packedDataIsMaxed1).toString(2));
  console.log(Number(packedXP.packedDataIsMaxed2).toString(2));
  tx = await players.tempSetPackedMaxLevelFlag(69, Skill.MAGIC); // Xardas
  tx = await players.tempSetPackedMaxLevelFlag(465, Skill.MAGIC); // Tiam
  await tx.wait();
  console.log("Update tempSetPackedMaxLevelFlag");

  packedXP = await players.packedXP(69);
  console.log(packedXP.magic);
  console.log(packedXP.melee);
  console.log(packedXP.defence);
  console.log(Number(packedXP.packedDataIsMaxed).toString(2));
  console.log(Number(packedXP.packedDataIsMaxed1).toString(2));
  console.log(Number(packedXP.packedDataIsMaxed2).toString(2));
  // Tiam
  packedXP = await players.packedXP(465);
  console.log(packedXP.magic);
  console.log(Number(packedXP.packedDataIsMaxed).toString(2));
  console.log(Number(packedXP.packedDataIsMaxed1).toString(2));
  console.log(Number(packedXP.packedDataIsMaxed2).toString(2));
*/

  // Overhaul upgrade #3
  const estforLibrary = await ethers.getContractAt("EstforLibrary", ESTFOR_LIBRARY_ADDRESS);
  const playersLibrary = await ethers.deployContract("PlayersLibrary");
  console.log(`playersLibrary = "${playersLibrary.address.toLowerCase()}"`);

  const Players = (await ethers.getContractFactory("Players")).connect(owner);
  const players = (await upgrades.upgradeProxy(PLAYERS_ADDRESS, Players, {
    kind: "uups",
    unsafeAllow: ["delegatecall", "external-library-linking"],
    timeout,
  })) as Players;
  await players.deployed();
  console.log("Deployed Players");

  // Update player impls
  const {playersImplQueueActions, playersImplProcessActions, playersImplRewards, playersImplMisc, playersImplMisc1} =
    await deployPlayerImplementations(playersLibrary.address);
  let tx = await players.setImpls(
    playersImplQueueActions.address,
    playersImplProcessActions.address,
    playersImplRewards.address,
    playersImplMisc.address,
    playersImplMisc1.address
  );
  await tx.wait();
  console.log("setImpls");

  // ItemNFT
  const itemNFTLibrary = await ethers.getContractAt("ItemNFTLibrary", ITEM_NFT_LIBRARY_ADDRESS);
  const ItemNFT = (
    await ethers.getContractFactory("ItemNFT", {libraries: {ItemNFTLibrary: itemNFTLibrary.address}})
  ).connect(owner);
  const itemNFT = await upgrades.upgradeProxy(ITEM_NFT_ADDRESS, ItemNFT, {
    kind: "uups",
    unsafeAllow: ["external-library-linking"],
    timeout,
  });
  await itemNFT.deployed();
  console.log("itemNFT deployed");

  const items = allItems.filter(
    (item) =>
      item.tokenId === EstforConstants.TINY_ELIXIUM ||
      item.tokenId === EstforConstants.SMALL_ELIXIUM ||
      item.tokenId === EstforConstants.MEDIUM_ELIXIUM ||
      item.tokenId === EstforConstants.LARGE_ELIXIUM ||
      item.tokenId === EstforConstants.EXTRA_LARGE_ELIXIUM ||
      item.tokenId === EstforConstants.FLUX
  );

  if (items.length !== 6) {
    console.log("Cannot find all items");
  } else {
    tx = await itemNFT.addItems(items);
    await tx.wait();
  }
  console.log("Add items");

  // Deploy instant actions
  const InstantActions = (await ethers.getContractFactory("InstantActions")).connect(owner);
  const instantActions = await upgrades.deployProxy(InstantActions, [PLAYERS_ADDRESS, ITEM_NFT_ADDRESS], {
    kind: "uups",
    timeout,
  });
  await instantActions.deployed();
  console.log(`instantActions = "${instantActions.address.toLowerCase()}"`);

  // Update player upgrade cost
  const PlayerNFT = (
    await ethers.getContractFactory("PlayerNFT", {
      libraries: {EstforLibrary: estforLibrary.address},
    })
  ).connect(owner);
  const playerNFT = await upgrades.upgradeProxy(PLAYER_NFT_ADDRESS, PlayerNFT, {
    kind: "uups",
    unsafeAllow: ["external-library-linking"],
    unsafeSkipStorageCheck: true,
    timeout,
  });
  await playerNFT.deployed();
  tx = await playerNFT.setUpgradeCost(ethers.utils.parseEther("1400")); // 30% discount
  await tx.wait();

  tx = await itemNFT.setInstantActions(instantActions.address);
  await tx.wait();

  tx = await instantActions.addActions(allInstantActions);
  await tx.wait();

  const worldLibrary = await ethers.deployContract("WorldLibrary");
  console.log(`worldLibrary = "${worldLibrary.address.toLowerCase()}"`);

  const World = (await ethers.getContractFactory("World", {libraries: {WorldLibrary: worldLibrary.address}})).connect(
    owner
  );
  const world = (await upgrades.upgradeProxy(WORLD_ADDRESS, World, {
    kind: "uups",
    unsafeAllow: ["external-library-linking"],
    unsafeSkipStorageCheck: true,
    timeout,
  })) as World;
  await world.deployed();
  console.log("world upgraded");

  const actions = allActions.filter((action) => action.actionId === EstforConstants.ACTION_FORGING_ITEM);
  if (actions.length !== 1) {
    console.log("Cannot find actions");
    process.exit(1);
  } else {
    await world.connect(owner).addActions(actions);
  }
  console.log("Add forging action");

  const newActionChoiceIdsAlchemy = [
    EstforConstants.ACTIONCHOICE_ALCHEMY_COPPER_ORE,
    EstforConstants.ACTIONCHOICE_ALCHEMY_TIN_ORE,
    EstforConstants.ACTIONCHOICE_ALCHEMY_IRON_ORE,
    EstforConstants.ACTIONCHOICE_ALCHEMY_SAPPHIRE,
    EstforConstants.ACTIONCHOICE_ALCHEMY_COAL_ORE,
    EstforConstants.ACTIONCHOICE_ALCHEMY_EMERALD,
    EstforConstants.ACTIONCHOICE_ALCHEMY_MITHRIL_ORE,
    EstforConstants.ACTIONCHOICE_ALCHEMY_RUBY,
    EstforConstants.ACTIONCHOICE_ALCHEMY_ADAMANTINE_ORE,
    EstforConstants.ACTIONCHOICE_ALCHEMY_AMETHYST,
    EstforConstants.ACTIONCHOICE_ALCHEMY_DIAMOND,
    EstforConstants.ACTIONCHOICE_ALCHEMY_RUNITE_ORE,
    EstforConstants.ACTIONCHOICE_ALCHEMY_DRAGONSTONE,
    EstforConstants.ACTIONCHOICE_ALCHEMY_TITANIUM_ORE,
    EstforConstants.ACTIONCHOICE_ALCHEMY_ORICHALCUM_ORE,
    EstforConstants.ACTIONCHOICE_ALCHEMY_FEATHER,
    EstforConstants.ACTIONCHOICE_ALCHEMY_LOG,
    EstforConstants.ACTIONCHOICE_ALCHEMY_OAK_LOG,
    EstforConstants.ACTIONCHOICE_ALCHEMY_WILLOW_LOG,
    EstforConstants.ACTIONCHOICE_ALCHEMY_MAPLE_LOG,
    EstforConstants.ACTIONCHOICE_ALCHEMY_REDWOOD_LOG,
    EstforConstants.ACTIONCHOICE_ALCHEMY_MAGICAL_LOG,
    EstforConstants.ACTIONCHOICE_ALCHEMY_ASH_LOG,
    EstforConstants.ACTIONCHOICE_ALCHEMY_ENCHANTED_LOG,
    EstforConstants.ACTIONCHOICE_ALCHEMY_LIVING_LOG,
    EstforConstants.ACTIONCHOICE_ALCHEMY_PAPER,
  ];

  const newActionChoicesAlchemy: ActionChoiceInput[] = [];
  allActionChoiceIdsAlchemy.forEach((actionChoiceId, index) => {
    if (newActionChoiceIdsAlchemy.includes(actionChoiceId)) {
      newActionChoicesAlchemy.push(allActionChoicesAlchemy[index]);
    }
  });

  const alchemyActionId = EstforConstants.ACTION_ALCHEMY_ITEM;
  const forgingActionId = EstforConstants.ACTION_FORGING_ITEM;
  tx = await world
    .connect(owner)
    .addBulkActionChoices(
      [alchemyActionId, forgingActionId],
      [newActionChoiceIdsAlchemy, allActionChoiceIdsForging],
      [newActionChoicesAlchemy, allActionChoicesForging]
    );
  await tx.wait();

  console.log("Set new action choices");

  tx = await playerNFT.setAvatars(avatarIds, avatarInfos);
  await tx.wait();
  console.log("set avatars");

  // Update shop
  const shop = await ethers.getContractAt("Shop", SHOP_ADDRESS);
  tx = await shop
    .connect(owner)
    .addBuyableItem(allShopItems.find((shopItem) => shopItem.tokenId == EstforConstants.FLUX) as ShopItem);
  await tx.wait();
  console.log("Add flux");

  // verify all the contracts
  await verifyContracts([
    players.address,
    playerNFT.address,
    playersImplQueueActions.address,
    playersImplProcessActions.address,
    playersImplRewards.address,
    playersImplMisc.address,
    playersImplMisc1.address,
    estforLibrary.address,
    playersLibrary.address,
    world.address,
  ]);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
