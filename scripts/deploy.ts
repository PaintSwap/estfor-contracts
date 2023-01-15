import {ethers} from "hardhat";
import {Attribute, createPlayer, EquipPosition, getActionId, Item, Skill} from "./utils";

async function main() {
  const [owner] = await ethers.getSigners();

  const network = await ethers.provider.getNetwork();

  let brushAddress;
  if (network.chainId == 31337) {
    const MockBrushToken = await ethers.getContractFactory("MockBrushToken");
    const brush = await MockBrushToken.deploy();
    await brush.mint(owner.address, 10000);
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

  // Create NFT contract which contains all the players
  const PlayerNFT = await ethers.getContractFactory("PlayerNFT");
  const playerNFT = await PlayerNFT.deploy(brushAddress, itemNFT.address, world.address, users.address);
  await playerNFT.deployed();
  console.log(`Player NFT deployed at ${playerNFT.address.toLowerCase()}`);

  let tx = await itemNFT.setPlayerNFT(playerNFT.address);
  await tx.wait();
  console.log("setPlayerNFT");
  tx = await users.setNFTs(playerNFT.address, itemNFT.address);
  await tx.wait();
  console.log("setNFTs");

  const avatarId = 1;
  const avatarInfo = {name: "Name goes here", description: "Hi I'm a description", imageURI: "1234.png"};
  tx = await playerNFT.addAvatar(avatarId, avatarInfo);
  await tx.wait();
  console.log("addAvatar");

  // Create player
  const playerId = await createPlayer(playerNFT, avatarId, owner, ethers.utils.formatBytes32String("0xSamWitch"));
  console.log("createPlayer");

  // === Test stuff ===
  tx = await itemNFT.addItem(
    Item.BRUSH,
    {attribute: Attribute.ATTACK, equipPosition: EquipPosition.AUX, exists: true, canEquip: true, bonus: 0},
    "someIPFSURI.png"
  );
  await tx.wait();
  console.log("add item");

  tx = await itemNFT.testMint(owner.address, Item.BRUSH, 1);
  await tx.wait();
  console.log("testMint1");

  tx = await itemNFT.testMint(owner.address, Item.WOODEN_FISHING_ROD, 2);
  await tx.wait();
  console.log("testMint2");

  tx = await itemNFT.testMint(owner.address, Item.BRONZE_NECKLACE, 100);
  await tx.wait();
  console.log("testMintShopItem1");
  tx = await itemNFT.testMint(owner.address, Item.COD, 100);
  await tx.wait();
  console.log("testMintShopItem2");

  tx = await playerNFT.equip(playerId, Item.BRUSH);
  await tx.wait();
  console.log("equip");

  tx = await world.addAction({
    skill: Skill.PAINT,
    baseXPPerHour: 10,
    minSkillPoints: 0,
    isDynamic: false,
    itemPosition: EquipPosition.AUX,
    itemTokenIdRangeMin: Item.BRUSH,
    itemTokenIdRangeMax: Item.WAND,
  });
  const actionId = getActionId(tx);
  tx = await world.setAvailable(actionId, true);
  await tx.wait();
  console.log("setAvailable");

  tx = await playerNFT.startAction(Skill.PAINT, 100, playerId, false);
  await tx.wait();
  console.log("setNFTs");

  tx = await playerNFT.consumeSkills(playerId);
  await tx.wait();
  console.log("consume skills");

  // Add shop item
  tx = await itemNFT.addShopItems([Item.BRONZE_NECKLACE, Item.COD], [30, 20]);
  await tx.wait();
  console.log("add shop");

  // Buy from shop
  const brush = await ethers.getContractAt("IBrushToken", brushAddress);
  tx = await brush.approve(itemNFT.address, "1000");
  await tx.wait();
  console.log("Approve brush");

  tx = await itemNFT.buy(Item.BRONZE_NECKLACE, 1);
  await tx.wait();
  console.log("buy from shop");

  // Transfer some brush to the pool so we can sell something
  tx = await brush.transfer(itemNFT.address, "1000");
  await tx.wait();

  // Sell to shop (can be anything)
  tx = await itemNFT.testMint(owner.address, Item.WOODEN_FISHING_ROD, 100);
  await tx.wait();
  console.log("testMint2");

  tx = await itemNFT.sell(Item.WOODEN_FISHING_ROD, 1, 1);
  await tx.wait();
  console.log("Sell");
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
