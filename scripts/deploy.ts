import {ethers, upgrades} from "hardhat";
import {MockBrushToken} from "../typechain-types";
import {
  allActions,
  allItems,
  allShopItems,
  BRONZE_AXE,
  BRONZE_GAUNTLETS,
  BRONZE_HELMET,
  createPlayer,
  firemakingChoices,
  FIRE_LIGHTER,
  LOG,
  NONE,
  QueuedAction,
  Skill,
  smithingChoices,
} from "./utils";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Deploying contracts with the account: ${owner.address}`);

  const network = await ethers.provider.getNetwork();
  console.log(`ChainId: ${network.chainId}`);

  let brush: MockBrushToken;
  let tx;
  if (network.chainId == 31337) {
    const MockBrushToken = await ethers.getContractFactory("MockBrushToken");
    brush = await MockBrushToken.deploy();
    await brush.mint(owner.address, 10000000000000);
  } else if (network.chainId == 4002) {
    const MockBrushToken = await ethers.getContractFactory("MockBrushToken");
    brush = await MockBrushToken.deploy();
    tx = await brush.mint(owner.address, 10000000000000);
    await tx.wait();
    console.log("Minted brush");
  } else if (network.chainId == 250) {
    // Fantom mainnet
    brush = await MockBrushToken.attach("0x85dec8c4B2680793661bCA91a8F129607571863d");
  } else {
    throw Error("Not a supported network");
  }

  console.log(`Before calling MockOracleClient`);
  const MockOracleClient = await ethers.getContractFactory("MockOracleClient");
  const mockOracleClient = await MockOracleClient.deploy();
  await mockOracleClient.deployed();
  console.log(`MockOracleClient deployed at ${mockOracleClient.address.toLowerCase()}`);

  // Create the world
  const subscriptionId = 2;
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

  // Create NFT contract which contains all items
  const ItemNFT = await ethers.getContractFactory("ItemNFT");
  const itemNFT = await upgrades.deployProxy(ItemNFT, [world.address, shop.address], {
    kind: "uups",
    unsafeAllow: ["delegatecall"],
  });
  await itemNFT.deployed();
  console.log(`Item NFT deployed at ${itemNFT.address.toLowerCase()}`);

  // Create NFT contract which contains all the players
  const PlayerNFT = await ethers.getContractFactory("PlayerNFT");
  const playerNFT = await upgrades.deployProxy(PlayerNFT, [brush.address], {kind: "uups"});

  console.log(`Player NFT deployed at ${playerNFT.address.toLowerCase()}`);

  // This contains all the player data
  const PlayerLibrary = await ethers.getContractFactory("PlayerLibrary");
  const playerLibrary = await PlayerLibrary.deploy();

  const Players = await ethers.getContractFactory("Players", {
    libraries: {PlayerLibrary: playerLibrary.address},
  });

  const players = await upgrades.deployProxy(Players, [itemNFT.address, playerNFT.address, world.address], {
    kind: "uups",
    unsafeAllow: ["delegatecall", "external-library-linking"],
  });

  tx = await itemNFT.setPlayers(players.address);
  await tx.wait();
  console.log("setPlayers");
  tx = await playerNFT.setPlayers(players.address);
  await tx.wait();
  console.log("setPlayers");
  await shop.setItemNFT(itemNFT.address);
  console.log("setItemNFT");

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
  const playerId = await createPlayer(playerNFT, startAvatarId, owner, ethers.utils.formatBytes32String("0xSamWitch"));
  console.log("createPlayer");

  // === Test stuff ===
  tx = await itemNFT.addItems(allItems);
  await tx.wait();
  console.log("add item");

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

  tx = await players.setEquipment(playerId, [BRONZE_HELMET, BRONZE_GAUNTLETS]);
  await tx.wait();
  console.log("equip");

  tx = await world.addActions(allActions);
  await tx.wait();
  console.log("Add actions");

  const fireMakingActionId = allActions.findIndex((action) => action.info.skill == Skill.FIREMAKING) + 1;
  const smithMakingActionId = allActions.findIndex((action) => action.info.skill == Skill.SMITHING) + 1;

  tx = await world.addBulkActionChoices(
    [fireMakingActionId, smithMakingActionId],
    [firemakingChoices, smithingChoices]
  );

  await tx.wait();
  console.log("Add action choices");

  // First woodcutting
  const queuedAction: QueuedAction = {
    actionId: allActions.findIndex((action) => action.info.skill == Skill.WOODCUTTING) + 1,
    skill: Skill.WOODCUTTING,
    choiceId: NONE,
    num: 0,
    choiceId1: NONE,
    num1: 0,
    choiceId2: NONE,
    num2: 0,
    regenerateId: NONE,
    numRegenerate: 0,
    timespan: 3600,
    rightArmEquipmentTokenId: BRONZE_AXE,
    leftArmEquipmentTokenId: NONE,
    startTime: "0",
  };

  tx = await players.startAction(playerId, queuedAction, false);
  await tx.wait();
  console.log("start actions");

  tx = await players.setSpeedMultiplier(playerId, 3600); // Turns 1 hour into 1 second
  await tx.wait();
  console.log("Set speed multiiplier");

  if (network.chainId == 31337) {
    console.log("Increase time");
    await ethers.provider.send("evm_increaseTime", [1]);
  }

  tx = await players.consumeActions(playerId);
  await tx.wait();
  console.log("consume actions");

  console.log("Number of logs ", (await itemNFT.balanceOf(owner.address, LOG)).toNumber());

  // Next firemaking
  const queuedActionFiremaking: QueuedAction = {
    actionId: allActions.findIndex((action) => action.info.skill == Skill.FIREMAKING) + 1,
    skill: Skill.FIREMAKING,
    choiceId: 1,
    num: 1220,
    choiceId1: NONE,
    num1: 0,
    choiceId2: NONE,
    num2: 0,
    regenerateId: NONE,
    numRegenerate: 0,
    timespan: 3600,
    rightArmEquipmentTokenId: FIRE_LIGHTER,
    leftArmEquipmentTokenId: NONE,
    startTime: "0",
  };

  tx = await players.startAction(playerId, queuedActionFiremaking, false);
  await tx.wait();
  console.log("start actions");

  if (network.chainId == 31337) {
    console.log("Increase time");
    await ethers.provider.send("evm_increaseTime", [1]);
  }

  tx = await players.consumeActions(playerId);
  await tx.wait();
  console.log("consume actions (firemaking)");

  console.log("Number of logs ", (await itemNFT.balanceOf(owner.address, LOG)).toNumber());

  // Add shop item
  tx = await shop.addBuyableItems(allShopItems);
  await tx.wait();
  console.log("add shop");

  // Buy from shop
  tx = await brush.approve(shop.address, "10000000");
  await tx.wait();
  console.log("Approve brush");

  tx = await shop.buy(BRONZE_HELMET, 1);
  await tx.wait();
  console.log("buy from shop");

  // Transfer some brush to the pool so we can sell something
  tx = await brush.transfer(shop.address, "100000");
  await tx.wait();
  console.log("Transfer some brush");

  // Sell to shop (can be anything)
  tx = await shop.sell(BRONZE_HELMET, 1, 1);
  await tx.wait();
  console.log("Sell");
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
