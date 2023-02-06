import {ethers} from "hardhat";
import {
  allActions,
  allItems,
  allShopItems,
  BRONZE_AXE,
  BRONZE_GAUNTLETS,
  BRONZE_HELMET,
  createPlayer,
  firemakingChoices,
  LOG,
  NONE,
  QueuedAction,
  Skill,
  smithingChoices,
} from "./utils";

async function main() {
  const [owner] = await ethers.getSigners();

  const network = await ethers.provider.getNetwork();

  let brushAddress;
  if (network.chainId == 31337) {
    const MockBrushToken = await ethers.getContractFactory("MockBrushToken");
    const brush = await MockBrushToken.deploy();
    await brush.mint(owner.address, 10000000000000);
    brushAddress = brush.address;
  } else if (network.chainId == 250) {
    // Fantom mainnet
    brushAddress = "0x85dec8c4B2680793661bCA91a8F129607571863d";
  } else {
    throw Error("Not a supported network");
  }

  const MockOracleClient = await ethers.getContractFactory("MockOracleClient");
  const mockOracleClient = await MockOracleClient.deploy();

  // Create the world
  const subscriptionId = 2;
  const World = await ethers.getContractFactory("World");
  const world = await World.deploy(mockOracleClient.address, subscriptionId);
  await world.deployed();
  console.log(`World deployed at ${world.address.toLowerCase()}`);

  // Create NFT contract which contains all items & players
  const Users = await ethers.getContractFactory("Users");
  const users = await Users.deploy();
  await users.deployed();

  // Create NFT contract which contains all items & players
  const ItemNFT = await ethers.getContractFactory("TestItemNFT");
  const itemNFT = await ItemNFT.deploy(brushAddress, world.address, users.address);
  await itemNFT.deployed();
  console.log(`Item NFT deployed at ${itemNFT.address.toLowerCase()}`);

  const PlayerNFTLibrary = await ethers.getContractFactory("PlayerNFTLibrary");
  const playerNFTLibrary = await PlayerNFTLibrary.deploy();
  // Create NFT contract which contains all the players
  const PlayerNFT = await ethers.getContractFactory("PlayerNFT", {
    libraries: {PlayerNFTLibrary: playerNFTLibrary.address},
  });
  const playerNFT = await PlayerNFT.deploy(brushAddress, itemNFT.address, world.address, users.address);
  await playerNFT.deployed();
  console.log(`Player NFT deployed at ${playerNFT.address.toLowerCase()}`);

  let tx = await itemNFT.setPlayerNFT(playerNFT.address);
  await tx.wait();
  console.log("setPlayerNFT");
  tx = await users.setNFTs(playerNFT.address, itemNFT.address);
  await tx.wait();
  console.log("setNFTs");

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
  tx = await itemNFT.testMints(owner.address, tokenIds, amounts);
  await tx.wait();
  console.log("batch mint");

  tx = await playerNFT.setEquipment(playerId, [BRONZE_HELMET, BRONZE_GAUNTLETS]);
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
    actionId: (allActions.findIndex((action) => action.info.skill == Skill.WOODCUTTING) + 1).toString(),
    skill: Skill.WOODCUTTING,
    potionId: NONE,
    choiceId: NONE,
    num: 0,
    choiceId1: NONE,
    num1: 0,
    choiceId2: NONE,
    num2: 0,
    regenerateId: NONE,
    numRegenerate: 0,
    timespan: 100,
    rightArmEquipmentTokenId: BRONZE_AXE,
    leftArmEquipmentTokenId: NONE,
    startTime: "0",
  };

  tx = await playerNFT.startAction(queuedAction, playerId, false);
  await tx.wait();
  console.log("start actions");

  tx = await playerNFT.setSpeedMultiplier(playerId, 3600); // Turns 1 hour into 1 second
  await tx.wait();
  console.log("Set speed multiiplier");

  if (network.chainId == 31337) {
    console.log("Increase time");
    await ethers.provider.send("evm_increaseTime", [20]);
  }

  tx = await playerNFT.consumeActions(playerId);
  await tx.wait();
  console.log("consume actions");

  // Add shop item
  tx = await itemNFT.addShopItems(allShopItems);
  await tx.wait();
  console.log("add shop");

  // Buy from shop
  const brush = await ethers.getContractAt("IBrushToken", brushAddress);
  tx = await brush.approve(itemNFT.address, "10000000");
  await tx.wait();
  console.log("Approve brush");

  tx = await itemNFT.buy(BRONZE_HELMET, 1);
  await tx.wait();
  console.log("buy from shop");

  // Transfer some brush to the pool so we can sell something
  tx = await brush.transfer(itemNFT.address, "100000");
  await tx.wait();
  console.log("Transfer some brush");

  // Sell to shop (can be anything)
  tx = await itemNFT.sell(BRONZE_HELMET, 1, 1);
  await tx.wait();
  console.log("Sell");
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
