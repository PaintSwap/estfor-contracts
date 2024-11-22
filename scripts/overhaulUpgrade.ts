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
  QUESTS_ADDRESS,
  INSTANT_ACTIONS_ADDRESS,
  WORLD_ACTIONS_ADDRESS
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
import {QuestInput, allQuests, allQuestsMinRequirements, defaultMinRequirements} from "./data/quests";
import {parseEther} from "ethers";
import {WorldActions} from "../typechain-types/contracts/WorldActions.sol";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Large upgrade using account: ${owner.address}`);

  //  const owner = await ethers.getImpersonatedSigner("0x316342122A9ae36de41B231260579b92F4C8Be7f");

  const network = await ethers.provider.getNetwork();
  console.log(`ChainId: ${network.chainId}`);

  const timeout = 600 * 1000; // 10 minutes

  /* Overhaul upgrade #1
  const playersLibrary = await ethers.deployContract("PlayersLibrary");
  console.log(`playersLibrary = "${(await playersLibrary.getAddress()).toLowerCase()}"`);

  const Players = await ethers.getContractFactory("Players");
  let players = Players.attach(PLAYERS_ADDRESS);
  await players.pauseGame(true);
  players = (await upgrades.upgradeProxy(PLAYERS_ADDRESS, Players, {
    kind: "uups",
    unsafeAllow: ["delegatecall"],
  })) as Players;
  await players.waitForDeployment();
  console.log("Deployed Players");

  // Update player impls
  const {playersImplQueueActions, playersImplProcessActions, playersImplRewards, playersImplMisc, playersImplMisc1} =
    await deployPlayerImplementations((await playersLibrary.getAddress()));
  let tx = await players.setImpls(
    (await playersImplQueueActions.getAddress()),
    (await playersImplProcessActions.getAddress()),
    (await playersImplRewards.getAddress()),
    (await playersImplMisc.getAddress()),
    (await playersImplMisc1.getAddress())
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
  const World = await ethers.getContractFactory("World");
  const world = (await upgrades.upgradeProxy(WORLD_ADDRESS, World, {
    kind: "uups",
    unsafeAllow: ["external-library-linking"],
  })) as World;
  await world.waitForDeployment();
  console.log("world upgraded");

  await setDailyAndWeeklyRewards(world);
  console.log("setDailyAndWeeklyRewards");

  // ItemNFT
  const itemNFTLibrary = await ethers.deployContract("ItemNFTLibrary");
  await itemNFTLibrary.waitForDeployment();
  console.log(`itemNFTLibrary = "${(await itemNFTLibrary.getAddress()).toLowerCase()}"`);

  const ItemNFT = await ethers.getContractFactory("ItemNFT", {libraries: {ItemNFTLibrary: (await itemNFTLibrary.getAddress())}});
  const itemNFT = await upgrades.upgradeProxy(ITEM_NFT_ADDRESS, ItemNFT, {
    kind: "uups",
    unsafeAllow: ["external-library-linking"],
  });
  await itemNFT.waitForDeployment();
  console.log(`itemNFT deployed`);
  */

  /* Overhaul upgrade #2
  const estforLibrary = await ethers.deployContract("EstforLibrary");
  console.log(`estforLibrary = "${(await estforLibrary.getAddress()).toLowerCase()}"`);

  const playersLibrary = await ethers.deployContract("PlayersLibrary");
  console.log(`playersLibrary = "${(await playersLibrary.getAddress()).toLowerCase()}"`);

  const Players = await ethers.getContractFactory("Players");
  const players = (await upgrades.upgradeProxy(PLAYERS_ADDRESS, Players, {
    kind: "uups",
    unsafeAllow: ["delegatecall"],
    timeout,
  })) as Players;
  await players.waitForDeployment();
  console.log("Deployed Players");

  // Update player impls
  const {playersImplQueueActions, playersImplProcessActions, playersImplRewards, playersImplMisc, playersImplMisc1} =
    await deployPlayerImplementations((await playersLibrary.getAddress()));
  let tx = await players.setImpls(
    (await playersImplQueueActions.getAddress()),
    (await playersImplProcessActions.getAddress()),
    (await playersImplRewards.getAddress()),
    (await playersImplMisc.getAddress()),
    (await playersImplMisc1.getAddress())
  );
  await tx.wait();
  console.log("setImpls");

  const Clans =
    await ethers.getContractFactory("Clans", {
      libraries: {EstforLibrary: (await estforLibrary.getAddress())},
    });
  const clans = await upgrades.upgradeProxy(CLANS_ADDRESS, Clans, {
    kind: "uups",
    unsafeAllow: ["external-library-linking"],
    timeout,
  });
  await clans.waitForDeployment();
  console.log(`clans = "${await clans.getAddress().toLowerCase()}"`);

  const psMarketplaceWhitelist = "0x7559038535f3d6ed6BAc5a54Ab4B69DA827F44BD";
  tx = await clans.setPaintSwapMarketplaceWhitelist(psMarketplaceWhitelist);
  await tx.wait();
  console.log("setPaintSwapMarketplaceWhitelist");

  const PlayerNFT = await ethers.getContractFactory("PlayerNFT", {
    libraries: {EstforLibrary: (await estforLibrary.getAddress())},
  });
  const playerNFT = await upgrades.upgradeProxy(PLAYER_NFT_ADDRESS, PlayerNFT, {
    kind: "uups",
    unsafeAllow: ["external-library-linking"],
    timeout,
  });
  await playerNFT.waitForDeployment();
  console.log("Deployed");
  tx = await playerNFT.setUpgradeCost(parseEther("1208924")); // To prevent anyone doing it early
  await tx.wait();

  // Check a clan leader
  const clanId = (await clans.nextClanId())+ 1n;
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
  console.log(`playersLibrary = "${(await playersLibrary.getAddress()).toLowerCase()}"`);

  const Players = await ethers.getContractFactory("Players");
  const players = (await upgrades.upgradeProxy(PLAYERS_ADDRESS, Players, {
    kind: "uups",
    unsafeAllow: ["delegatecall"],
    timeout
  })) as unknown as Players;

  console.log("Deployed Players");

  // Update player impls
  const {playersImplQueueActions, playersImplProcessActions, playersImplRewards, playersImplMisc, playersImplMisc1} =
    await deployPlayerImplementations(await playersLibrary.getAddress());
  let tx = await players.setImpls(
    await playersImplQueueActions.getAddress(),
    await playersImplProcessActions.getAddress(),
    await playersImplRewards.getAddress(),
    await playersImplMisc.getAddress(),
    await playersImplMisc1.getAddress()
  );
  await tx.wait();
  console.log("setImpls");

  // ItemNFT
  const itemNFTLibrary = await ethers.getContractAt("ItemNFTLibrary", ITEM_NFT_LIBRARY_ADDRESS);
  const ItemNFT = await ethers.getContractFactory("ItemNFT", {
    libraries: {ItemNFTLibrary: await itemNFTLibrary.getAddress()}
  });
  const itemNFT = await upgrades.upgradeProxy(ITEM_NFT_ADDRESS, ItemNFT, {
    kind: "uups",
    unsafeAllow: ["external-library-linking"],
    timeout
  });
  await itemNFT.waitForDeployment();
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

  // Update player upgrade cost
  const PlayerNFT = await ethers.getContractFactory("PlayerNFT", {
    libraries: {EstforLibrary: await estforLibrary.getAddress()}
  });
  const playerNFT = await upgrades.upgradeProxy(PLAYER_NFT_ADDRESS, PlayerNFT, {
    kind: "uups",
    unsafeAllow: ["external-library-linking"],
    unsafeSkipStorageCheck: true,
    timeout
  });
  await playerNFT.waitForDeployment();
  tx = await playerNFT.setUpgradeCost(parseEther("1400")); // 30% discount
  await tx.wait();

  const instantActions = await ethers.getContractAt("InstantActions", INSTANT_ACTIONS_ADDRESS);
  tx = await instantActions.addActions(allInstantActions);
  await tx.wait();

  const WorldActions = await ethers.getContractFactory("WorldActions");
  const worldActions = (await upgrades.upgradeProxy(WORLD_ACTIONS_ADDRESS, WorldActions, {
    kind: "uups",
    timeout
  })) as unknown as WorldActions;

  console.log("world upgraded");

  // Add new forging action
  let actions = allActions.filter((action) => action.actionId === EstforConstants.ACTION_FORGING_ITEM);
  if (actions.length !== 1) {
    console.log("Cannot find actions");
    process.exit(1);
  } else {
    await worldActions.addActions(actions);
  }
  console.log("Add forging action");

  // Edit some combat action random reward drops
  actions = allActions.filter(
    (action) =>
      action.actionId === EstforConstants.ACTION_COMBAT_QUARTZ_EAGLE ||
      action.actionId === EstforConstants.ACTION_COMBAT_ROCKHAWK ||
      action.actionId === EstforConstants.ACTION_COMBAT_QRAKUR ||
      action.actionId === EstforConstants.ACTION_COMBAT_ELEMENTAL_DRAGON ||
      action.actionId === EstforConstants.ACTION_COMBAT_ERKAD
  );

  tx = await worldActions.editActions(actions);
  await tx.wait();
  console.log("editActions");

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
    EstforConstants.ACTIONCHOICE_ALCHEMY_PAPER
  ];

  const newActionChoicesAlchemy: ActionChoiceInput[] = [];
  allActionChoiceIdsAlchemy.forEach((actionChoiceId, index) => {
    if (newActionChoiceIdsAlchemy.includes(actionChoiceId)) {
      newActionChoicesAlchemy.push(allActionChoicesAlchemy[index]);
    }
  });

  const alchemyActionId = EstforConstants.ACTION_ALCHEMY_ITEM;
  const forgingActionId = EstforConstants.ACTION_FORGING_ITEM;
  tx = await worldActions.addBulkActionChoices(
    [alchemyActionId, forgingActionId],
    [newActionChoiceIdsAlchemy, allActionChoiceIdsForging],
    [newActionChoicesAlchemy, allActionChoicesForging]
  );
  await tx.wait();

  console.log("Set new action choices");

  tx = await playerNFT.setAvatars(avatarIds, avatarInfos);
  await tx.wait();
  console.log("set avatars");

  // Update shop with new flux item
  const shop = await ethers.getContractAt("Shop", SHOP_ADDRESS);
  tx = await shop.addBuyableItems(allShopItems.filter((shopItem) => shopItem.tokenId == EstforConstants.FLUX));
  await tx.wait();
  console.log("Add flux");

  // Quests
  const Quests = await ethers.getContractFactory("Quests");
  const quests = await upgrades.upgradeProxy(QUESTS_ADDRESS, Quests, {
    kind: "uups",
    timeout,
    unsafeSkipStorageCheck: true
  });
  await quests.waitForDeployment();
  console.log("Deployed quests");

  // Add the new quest
  const quest = allQuests.find((q) => q.questId === EstforConstants.QUEST_SO_FLETCH) as QuestInput;
  tx = await quests.addQuests([quest], [defaultMinRequirements]);
  await tx.wait();
  console.log("Add new quest");
  // Edit them all to fix up the second storage slot bit location
  tx = await quests.editQuests(allQuests, allQuestsMinRequirements);
  await tx.wait();

  // verify all the contracts
  await verifyContracts([
    await players.getAddress(),
    await playerNFT.getAddress(),
    await playersImplQueueActions.getAddress(),
    await playersImplProcessActions.getAddress(),
    await playersImplRewards.getAddress(),
    await playersImplMisc.getAddress(),
    await playersImplMisc1.getAddress(),
    await estforLibrary.getAddress(),
    await playersLibrary.getAddress(),
    await worldActions.getAddress(),
    await instantActions.getAddress()
  ]);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
