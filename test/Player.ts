import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {expect} from "chai";
import {ethers} from "hardhat";
import {Attribute, createPlayer, EquipPosition, getActionId, Item, Skill} from "../scripts/utils";

describe("Player", () => {
  async function deployContracts() {
    const [owner, alice] = await ethers.getSigners();

    const MockBrushToken = await ethers.getContractFactory("MockBrushToken");
    const brush = await MockBrushToken.deploy();

    const MockOracleClient = await ethers.getContractFactory("MockOracleClient");
    const mockOracleClient = await MockOracleClient.deploy();

    // Create the world
    const subscriptionId = 2;
    const World = await ethers.getContractFactory("World");
    const world = await World.deploy(mockOracleClient.address, subscriptionId);

    // Create NFT contract which contains all items & players
    const Users = await ethers.getContractFactory("Users");
    const users = await Users.deploy();

    // Create NFT contract which contains all items & players
    const ItemNFT = await ethers.getContractFactory("TestItemNFT");
    const itemNFT = await ItemNFT.deploy(brush.address, world.address, users.address);

    // Create NFT contract which contains all the players
    const PlayerNFT = await ethers.getContractFactory("PlayerNFT");
    const playerNFT = await PlayerNFT.deploy(brush.address, itemNFT.address, world.address, users.address);

    await itemNFT.setPlayerNFT(playerNFT.address);
    await users.setNFTs(playerNFT.address, itemNFT.address);

    const avatarId = 1;
    const avatarInfo = {name: "Name goes here", description: "Hi I'm a description", imageURI: "1234.png"};
    await playerNFT.addAvatar(avatarId, avatarInfo);

    // Create player
    const playerId = await createPlayer(playerNFT, avatarId, alice, ethers.utils.formatBytes32String("0xSamWitch"));
    const maxTime = await playerNFT.MAX_TIME();

    return {
      playerId,
      playerNFT,
      itemNFT,
      brush,
      maxTime,
      owner,
      world,
      users,
      alice,
    };
  }

  it("Equip", async () => {
    const {playerId, playerNFT, itemNFT, alice} = await loadFixture(deployContracts);

    await expect(playerNFT.connect(alice).equip(playerId, Item.BRUSH)).to.be.reverted; // item doesn't exist yet
    await itemNFT.addItem(
      Item.BRUSH,
      {attribute: Attribute.ATTACK, equipPosition: EquipPosition.AUX, exists: true, canEquip: true, bonus: 0},
      "someIPFSURI.png"
    );
    await expect(playerNFT.connect(alice).equip(playerId, Item.BRUSH)).to.be.reverted; // Don't own any
    await itemNFT.testMint(alice.address, Item.BRUSH, 1);
    await playerNFT.connect(alice).equip(playerId, Item.BRUSH);
  });

  it("Skill points", async () => {
    const {playerId, playerNFT, itemNFT, world, alice} = await loadFixture(deployContracts);

    await itemNFT.addItem(
      Item.BRUSH,
      {attribute: Attribute.ATTACK, equipPosition: EquipPosition.AUX, exists: true, canEquip: true, bonus: 0},
      "someIPFSURI.png"
    );
    await expect(playerNFT.connect(alice).equip(playerId, Item.BRUSH)).to.be.reverted; // Don't own any
    await itemNFT.testMint(alice.address, Item.BRUSH, 1);
    await playerNFT.connect(alice).equip(playerId, Item.BRUSH);

    await expect(playerNFT.connect(alice).startAction(Skill.PAINT, 100, playerId, false)).to.be.reverted; // No action added yet

    const tx = await world.addAction({
      skill: Skill.PAINT,
      baseXPPerHour: 10,
      minSkillPoints: 0,
      isDynamic: false,
      itemPosition: EquipPosition.AUX,
      itemTokenIdRangeMin: Item.BRUSH,
      itemTokenIdRangeMax: Item.WAND,
    });
    const actionId = getActionId(tx);
    await expect(playerNFT.connect(alice).startAction(Skill.PAINT, 100, playerId, false)).to.be.reverted; // Action not set to available yet

    await world.setAvailable(actionId, true);

    await playerNFT.connect(alice).startAction(Skill.PAINT, 100, playerId, false);
    await ethers.provider.send("evm_increaseTime", [1]);
    await playerNFT.connect(alice).consumeSkills(playerId);
    expect((await playerNFT.skillPoints(playerId, Skill.PAINT)).toNumber()).to.be.oneOf([1, 2, 3]);
  });

  it("Skill points, max range", async () => {
    const {playerId, playerNFT, itemNFT, world, alice, maxTime} = await loadFixture(deployContracts);

    await itemNFT.addItem(
      Item.BRUSH,
      {attribute: Attribute.ATTACK, equipPosition: EquipPosition.AUX, exists: true, canEquip: true, bonus: 0},
      "someIPFSURI.png"
    );
    await itemNFT.testMint(alice.address, Item.BRUSH, 1);
    await playerNFT.connect(alice).equip(playerId, Item.BRUSH);

    const tx = await world.addAction({
      skill: Skill.PAINT,
      baseXPPerHour: 10,
      minSkillPoints: 0,
      isDynamic: false,
      itemPosition: EquipPosition.AUX,
      itemTokenIdRangeMin: Item.BRUSH,
      itemTokenIdRangeMax: Item.WAND,
    });
    const actionId = getActionId(tx);
    await world.setAvailable(actionId, true);

    await playerNFT.connect(alice).startAction(Skill.PAINT, 100, playerId, false);

    await ethers.provider.send("evm_increaseTime", [maxTime + 1]);
    await playerNFT.connect(alice).consumeSkills(playerId);
    expect((await playerNFT.skillPoints(playerId, Skill.PAINT)).toNumber()).to.eq(maxTime);
  });

  it("Multi-skill points", async () => {
    // TODO:
  });

  it("Equipment", async () => {
    const {playerId, playerNFT, itemNFT, users, alice} = await loadFixture(deployContracts);
    await itemNFT.testMint(alice.address, Item.SHIELD, 1);
    expect(await itemNFT.balanceOf(alice.address, Item.SHIELD)).to.eq(1);

    // Shield doesn't exist yet
    await expect(playerNFT.equip(playerId, Item.SHIELD)).to.be.reverted;

    await itemNFT.addItem(
      Item.SHIELD,
      {attribute: Attribute.DEFENCE, equipPosition: EquipPosition.LEFT_ARM, exists: true, canEquip: true, bonus: 1},
      "someIPFSURI.png"
    );

    // Check bonuses before
    expect(await (await playerNFT.players(playerId)).attackBonus).to.eq(0);
    expect(await (await playerNFT.players(playerId)).defenceBonus).to.eq(0);

    await playerNFT.connect(alice).equip(playerId, Item.SHIELD);

    // Check bonuses after
    expect(await (await playerNFT.players(playerId)).attackBonus).to.eq(0);
    expect(await (await playerNFT.players(playerId)).defenceBonus).to.eq(1);

    expect(await users.numEquipped(alice.address, Item.SHIELD)).to.eq(1);

    // Try equip it on someone else, should fail as we don't have enough

    const avatarId = 1;
    const avatarInfo = {name: "Name goes here", description: "Hi I'm a description", imageURI: "1234.png"};
    await playerNFT.addAvatar(avatarId, avatarInfo);

    const newPlayerId = await createPlayer(playerNFT, avatarId, alice, ethers.utils.formatBytes32String("0xSamWitch"));
    await expect(playerNFT.connect(alice).equip(newPlayerId, Item.SHIELD)).to.be.reverted;

    // Mint another one and try again, first trying to connect same item to the same player
    await itemNFT.testMint(alice.address, Item.SHIELD, 1);
    await expect(playerNFT.connect(alice).equip(playerId, Item.SHIELD)).to.be.reverted;
    await playerNFT.connect(alice).equip(newPlayerId, Item.SHIELD);
    expect(await users.numEquipped(alice.address, Item.SHIELD)).to.eq(2);
  });
  /*
  it.only("Equipment Many", async () => {
    // TODO:
  });

  it.only("uri", async () => {
  }); */
});
