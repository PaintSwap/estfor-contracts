import {ethers} from "hardhat";
import {Attribute, createPlayer, EquipPosition, getActionId, Item, Skill} from "./utils";

async function main() {
  const [owner, alice] = await ethers.getSigners();

  const MockBrushToken = await ethers.getContractFactory("MockBrushToken");
  const brush = await MockBrushToken.deploy();

//  if (network)

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
  const itemNFT = await ItemNFT.deploy(brush.address, world.address, users.address);
  await itemNFT.deployed();
  console.log(`Item NFT deployed at ${itemNFT.address.toLowerCase()}`);

  // Create NFT contract which contains all the players
  const PlayerNFT = await ethers.getContractFactory("PlayerNFT");
  const playerNFT = await PlayerNFT.deploy(brush.address, itemNFT.address, world.address, users.address);
  await playerNFT.deployed();
  console.log(`Player NFT deployed at ${playerNFT.address.toLowerCase()}`);

  let tx = await itemNFT.setPlayerNFT(playerNFT.address);
  await tx.wait();
  tx = await users.setNFTs(playerNFT.address, itemNFT.address);
  await tx.wait();

  const avatarId = 1;
  const avatarInfo = {name: "Name goes here", description: "Hi I'm a description", imageURI: "1234.png"};
  tx = await playerNFT.addAvatar(avatarId, avatarInfo);
  await tx.wait();

  // Create player
  const playerId = await createPlayer(playerNFT, avatarId, alice, ethers.utils.formatBytes32String("0xSamWitch"));

  // === Test stuff ===
  await itemNFT.addItem(
    Item.BRUSH,
    {attribute: Attribute.ATTACK, equipPosition: EquipPosition.AUX, exists: true, canEquip: true, bonus: 0},
    "someIPFSURI.png"
  );
  tx = await itemNFT.testMint(alice.address, Item.BRUSH, 1);
  await tx.wait();
  tx = await playerNFT.connect(alice).equip(playerId, Item.BRUSH);
  await tx.wait();

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

  tx = await playerNFT.connect(alice).startAction(Skill.PAINT, 100, playerId, false);
  await tx.wait();
  await ethers.provider.send("evm_increaseTime", [1]);
  tx = await playerNFT.connect(alice).consumeSkills(playerId);
  await tx.wait();
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
