import {EstforConstants, EstforTypes} from "@paintswap/estfor-definitions";
import {ethers, upgrades} from "hardhat";
import {MockBrushToken, MockWrappedFantom, PlayerNFT} from "../typechain-types";
import {
  allActions,
  allItems,
  allShopItems,
  allXPThresholdRewards,
  createPlayer,
  firemakingChoices,
  magicChoices,
  meleeChoices,
  smithingChoices,
} from "./utils";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Deploying contracts with the account: ${owner.address}`);

  const network = await ethers.provider.getNetwork();
  console.log(`ChainId: ${network.chainId}`);

  let brush: MockBrushToken;
  let wftm: MockWrappedFantom;
  let tx;
  {
    const MockBrushToken = await ethers.getContractFactory("MockBrushToken");
    const MockWrappedFantom = await ethers.getContractFactory("MockWrappedFantom");
    if (network.chainId == 31337 || network.chainId == 1337) {
      brush = await MockBrushToken.deploy();
      await brush.mint(owner.address, ethers.utils.parseEther("1000"));
      wftm = await MockWrappedFantom.deploy();
    } else if (network.chainId == 4002) {
      // Fantom testnet
      brush = await MockBrushToken.deploy();
      tx = await brush.mint(owner.address, ethers.utils.parseEther("1000"));
      console.log("Minted brush");
      await tx.wait();
      wftm = MockWrappedFantom.attach("0xf1277d1ed8ad466beddf92ef448a132661956621");
    } else if (network.chainId == 250) {
      // Fantom mainnet
      brush = await MockBrushToken.attach("0x85dec8c4B2680793661bCA91a8F129607571863d");
      wftm = MockWrappedFantom.attach("0x21be370D5312f44cB42ce377BC9b8a0cEF1A4C83");
    } else {
      throw Error("Not a supported network");
    }
  }

  console.log(`Before calling MockOracleClient`);
  const MockOracleClient = await ethers.getContractFactory("MockOracleClient");
  const mockOracleClient = await MockOracleClient.deploy();
  await mockOracleClient.deployed();
  console.log(`MockOracleClient deployed at ${mockOracleClient.address.toLowerCase()}`);

  // Create the world
  const subscriptionId = 62;
  const World = await ethers.getContractFactory("World");
  const world = await upgrades.deployProxy(World, [mockOracleClient.address, subscriptionId], {
    kind: "uups",
  });
  await world.deployed();
  console.log(`World deployed at ${world.address.toLowerCase()}`);

  const Shop = await ethers.getContractFactory("Shop");
  const shop = await upgrades.deployProxy(Shop, [brush.address], {
    kind: "uups",
    unsafeAllow: ["delegatecall"],
  });

  await shop.deployed();
  console.log(`Shop deployed at ${shop.address.toLowerCase()}`);

  const buyPath = [wftm.address, brush.address];
  const MockRouter = await ethers.getContractFactory("MockRouter");
  const router = await MockRouter.deploy();
  const RoyaltyReceiver = await ethers.getContractFactory("RoyaltyReceiver");
  const royaltyReceiver = await RoyaltyReceiver.deploy(router.address, shop.address, brush.address, buyPath);
  await royaltyReceiver.deployed();
  console.log(`RoyaltyReceiver deployed at ${royaltyReceiver.address.toLowerCase()}`);

  // Create NFT contract which contains all items
  const ItemNFT = await ethers.getContractFactory("ItemNFT");
  const itemNFT = await upgrades.deployProxy(ItemNFT, [world.address, shop.address, royaltyReceiver.address], {
    kind: "uups",
    unsafeAllow: ["delegatecall"],
  });
  await itemNFT.deployed();
  console.log(`Item NFT deployed at ${itemNFT.address.toLowerCase()}`);

  // Create NFT contract which contains all the players
  const PlayerNFT = await ethers.getContractFactory("PlayerNFT");
  const EDIT_NAME_BRUSH_PRICE = ethers.utils.parseEther("1");
  const playerNFT = (await upgrades.deployProxy(
    PlayerNFT,
    [brush.address, shop.address, royaltyReceiver.address, EDIT_NAME_BRUSH_PRICE],
    {
      kind: "uups",
    }
  )) as PlayerNFT;

  console.log(`Player NFT deployed at ${playerNFT.address.toLowerCase()}`);

  // This contains all the player data
  const PlayerLibrary = await ethers.getContractFactory("PlayerLibrary");
  const playerLibrary = await PlayerLibrary.deploy();
  await playerLibrary.deployed();
  console.log(`PlayerLibrary deployed at ${playerLibrary.address.toLowerCase()}`);

  const PlayersImplQueueActions = await ethers.getContractFactory("PlayersImplQueueActions");
  const playersImplQueueActions = await PlayersImplQueueActions.deploy();
  console.log(`PlayersImplQueueActions deployed at ${playersImplQueueActions.address.toLowerCase()}`);

  const PlayersImplProcessActions = await ethers.getContractFactory("PlayersImplProcessActions", {
    libraries: {PlayerLibrary: playerLibrary.address},
  });
  const playersImplProcessActions = await PlayersImplProcessActions.deploy();
  console.log(`PlayersImplProcessActions deployed at ${playersImplProcessActions.address.toLowerCase()}`);

  const PlayersImplRewards = await ethers.getContractFactory("PlayersImplRewards", {
    libraries: {PlayerLibrary: playerLibrary.address},
  });
  const playersImplRewards = await PlayersImplRewards.deploy();
  console.log(`PlayersImplRewards deployed at ${playersImplRewards.address.toLowerCase()}`);

  const Players = await ethers.getContractFactory("Players", {
    libraries: {PlayerLibrary: playerLibrary.address},
  });

  const players = await upgrades.deployProxy(
    Players,
    [
      itemNFT.address,
      playerNFT.address,
      world.address,
      playersImplQueueActions.address,
      playersImplProcessActions.address,
      playersImplRewards.address,
    ],
    {
      kind: "uups",
      unsafeAllow: ["delegatecall", "external-library-linking"],
    }
  );
  await players.deployed();
  console.log(`Players deployed at ${players.address.toLowerCase()}`);

  tx = await itemNFT.setPlayers(players.address);
  await tx.wait();
  console.log("setPlayers");
  tx = await playerNFT.setPlayers(players.address);
  await tx.wait();
  console.log("setPlayers");
  await shop.setItemNFT(itemNFT.address);
  console.log("setItemNFT");

  tx = await players.setDailyRewardsEnabled(true);
  await tx.wait();
  console.log("Set daily rewards enabled");

  const startAvatarId = 1;
  const avatarInfos = [
    {name: ethers.utils.formatBytes32String("Name 1"), description: "Hi I'm a description1", imageURI: "1.png"},
    {name: ethers.utils.formatBytes32String("Name 2"), description: "Hi I'm a description2", imageURI: "2.png"},
    {name: ethers.utils.formatBytes32String("Name 3"), description: "Hi I'm a description3", imageURI: "3.png"},
    {name: ethers.utils.formatBytes32String("Name 4"), description: "Hi I'm a description4", imageURI: "4.png"},
    {name: ethers.utils.formatBytes32String("Name 5"), description: "Hi I'm a description5", imageURI: "5.png"},
    {name: ethers.utils.formatBytes32String("Name 6"), description: "Hi I'm a description6", imageURI: "6.png"},
    {name: ethers.utils.formatBytes32String("Name 7"), description: "Hi I'm a description7", imageURI: "7.png"},
    {name: ethers.utils.formatBytes32String("Name 8"), description: "Hi I'm a description8", imageURI: "8.png"},
  ];

  tx = await playerNFT.setAvatars(startAvatarId, avatarInfos);
  await tx.wait();
  console.log("addAvatars");

  // Create player
  const makeActive = true;
  const playerId = await createPlayer(
    playerNFT,
    startAvatarId,
    owner,
    ethers.utils.formatBytes32String("0xSamWitch"),
    makeActive
  );
  console.log("createPlayer");

  //  tx = await players.setActivePlayer(playerId);
  //  await tx.wait();
  //  console.log("Set active player");

  // === Test stuff ===
  tx = await itemNFT.addItems(allItems);
  await tx.wait();
  console.log("add items");

  tx = await players.addXPThresholdRewards(allXPThresholdRewards);
  await tx.wait();
  console.log("add xp threshold rewards");

  const tokenIds: number[] = [];
  const amounts: number[] = [];
  allItems.forEach((item) => {
    tokenIds.push(item.tokenId);
    amounts.push(200);
  });

  // Batch mint all the items
  if (network.chainId == 31337) {
    tx = await itemNFT.testOnlyMints(owner.address, tokenIds, amounts);
  } else {
    // TODO: This should fail when we go live
    tx = await itemNFT.testMints(owner.address, tokenIds, amounts);
  }
  await tx.wait();
  console.log("batch mint");

  tx = await world.addActions(allActions);
  await tx.wait();
  console.log("Add actions");

  const fireMakingActionId = EstforConstants.ACTION_FIREMAKING_ITEM;
  const smithMakingActionId = EstforConstants.ACTION_SMITHING_ITEM;

  tx = await world.addBulkActionChoices(
    [fireMakingActionId, smithMakingActionId, EstforConstants.NONE, EstforConstants.NONE],
    [
      [EstforConstants.ACTIONCHOICE_FIREMAKING_LOG, EstforConstants.ACTIONCHOICE_FIREMAKING_OAK],
      [EstforConstants.ACTIONCHOICE_SMITHING_BRONZE_BAR, EstforConstants.ACTIONCHOICE_SMITHING_IRON_BAR],
      [EstforConstants.ACTIONCHOICE_ATTACK_MONSTER],
      [EstforConstants.ACTIONCHOICE_MAGIC_SHADOW_BLAST],
    ],
    [firemakingChoices, smithingChoices, meleeChoices, magicChoices]
  );

  await tx.wait();
  console.log("Add action choices");

  // First woodcutting
  const queuedAction: EstforTypes.QueuedAction = {
    attire: EstforTypes.noAttire,
    actionId: EstforConstants.ACTION_WOODCUTTING_LOG,
    combatStyle: EstforTypes.CombatStyle.NONE,
    choiceId: EstforConstants.NONE,
    choiceId1: EstforConstants.NONE,
    choiceId2: EstforConstants.NONE,
    regenerateId: EstforConstants.NONE,
    timespan: 3600,
    rightHandEquipmentTokenId: EstforConstants.BRONZE_AXE,
    leftHandEquipmentTokenId: EstforConstants.NONE,
    startTime: "0",
    isValid: true,
  };

  tx = await players.startAction(playerId, queuedAction, EstforTypes.ActionQueueStatus.NONE);
  await tx.wait();
  console.log("start actions");

  tx = await players.setSpeedMultiplier(playerId, 60); // Turns 1 hour into 1 second
  await tx.wait();
  console.log("Set speed multiiplier");

  if (network.chainId == 31337) {
    console.log("Increase time");
    await ethers.provider.send("evm_increaseTime", [1]);
  }

  tx = await players.processActions(playerId);
  await tx.wait();
  console.log("process actions");

  console.log("Number of logs ", (await itemNFT.balanceOf(owner.address, EstforConstants.LOG)).toNumber());

  // Next firemaking
  const queuedActionFiremaking: EstforTypes.QueuedAction = {
    attire: {...EstforTypes.noAttire},
    actionId: EstforConstants.ACTION_FIREMAKING_ITEM,
    combatStyle: EstforTypes.CombatStyle.NONE,
    choiceId: EstforConstants.ACTIONCHOICE_FIREMAKING_LOG,
    choiceId1: EstforConstants.NONE,
    choiceId2: EstforConstants.NONE,
    regenerateId: EstforConstants.NONE,
    timespan: 3600,
    rightHandEquipmentTokenId: EstforConstants.MAGIC_FIRE_STARTER,
    leftHandEquipmentTokenId: EstforConstants.NONE,
    startTime: "0",
    isValid: true,
  };

  tx = await players.startAction(playerId, queuedActionFiremaking, EstforTypes.ActionQueueStatus.NONE);
  await tx.wait();
  console.log("start actions");

  if (network.chainId == 31337) {
    console.log("Increase time");
    await ethers.provider.send("evm_increaseTime", [1]);
  }

  tx = await players.processActions(playerId);
  await tx.wait();
  console.log("process actions (firemaking)");

  console.log("Number of logs ", (await itemNFT.balanceOf(owner.address, EstforConstants.LOG)).toNumber());

  // Start another action
  tx = await players.startAction(playerId, queuedAction, EstforTypes.ActionQueueStatus.NONE);
  await tx.wait();
  console.log("start an unconsumed action");

  if (network.chainId == 31337) {
    console.log("Increase time");
    await ethers.provider.send("evm_increaseTime", [1000000]);
  }

  // Start a combat action
  const queuedActionCombat: EstforTypes.QueuedAction = {
    attire: {...EstforTypes.noAttire, helmet: EstforConstants.BRONZE_HELMET},
    actionId: EstforConstants.ACTION_COMBAT_NATUOW,
    combatStyle: EstforTypes.CombatStyle.MELEE,
    choiceId: EstforConstants.ACTIONCHOICE_ATTACK_MONSTER,
    choiceId1: EstforConstants.NONE,
    choiceId2: EstforConstants.NONE,
    regenerateId: EstforConstants.NONE,
    timespan: 7200,
    rightHandEquipmentTokenId: EstforConstants.BRONZE_SWORD,
    leftHandEquipmentTokenId: EstforConstants.NONE,
    startTime: "0",
    isValid: true,
  };

  tx = await players.startAction(playerId, queuedActionCombat, EstforTypes.ActionQueueStatus.NONE);
  await tx.wait();
  console.log("start a combat action");

  if (network.chainId == 31337) {
    console.log("Increase time");
    await ethers.provider.send("evm_increaseTime", [10]);
  }

  tx = await players.processActions(playerId);
  await tx.wait();
  console.log("process actions (melee combat)");

  // Add shop item
  tx = await shop.addBuyableItems(allShopItems);
  await tx.wait();
  console.log("add shop");

  // Buy from shop
  tx = await brush.approve(shop.address, ethers.utils.parseEther("100"));
  await tx.wait();
  console.log("Approve brush");

  tx = await shop.buy(EstforConstants.BRONZE_HELMET, 1);
  await tx.wait();
  console.log("buy from shop");

  // Transfer some brush to the pool so we can sell something
  tx = await brush.transfer(shop.address, "100000");
  await tx.wait();
  console.log("Transfer some brush");

  // Sell to shop (can be anything)
  tx = await shop.sell(EstforConstants.BRONZE_HELMET, 1, 1);
  await tx.wait();
  console.log("Sell");
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
