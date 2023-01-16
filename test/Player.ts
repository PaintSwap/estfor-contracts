import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {expect} from "chai";
import {ethers} from "hardhat";
import {Attribute, createPlayer, EquipPosition, getActionId, Item, QueuedAction, Skill, Stats} from "../scripts/utils";

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

    const PlayerNFTLibrary = await ethers.getContractFactory("PlayerNFTLibrary");
    const playerNFTLibrary = await PlayerNFTLibrary.deploy();

    // Create NFT contract which contains all the players
    const PlayerNFT = await ethers.getContractFactory("PlayerNFT", {
      libraries: {PlayerNFTLibrary: playerNFTLibrary.address},
    });
    const playerNFT = await PlayerNFT.deploy(brush.address, itemNFT.address, world.address, users.address);

    await itemNFT.setPlayerNFT(playerNFT.address);
    await users.setNFTs(playerNFT.address, itemNFT.address);

    const avatarId = 1;
    const avatarInfo = {
      name: ethers.utils.formatBytes32String("Name goes here"),
      description: "Hi I'm a description",
      imageURI: "1234.png",
    };
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
    const stats: Stats = {
      attack: 2,
      magic: 0,
      range: 0,
      meleeDefence: -1,
      magicDefence: 0,
      rangeDefence: 0,
      health: 12,
    };
    await itemNFT.addItem(
      Item.BRUSH,
      {stats, equipPosition: EquipPosition.RIGHT_ARM, exists: true},
      "someIPFSURI.json"
    );
    await expect(playerNFT.connect(alice).equip(playerId, Item.BRUSH)).to.be.reverted; // Don't own any
    await itemNFT.testMint(alice.address, Item.BRUSH, 1);
    await playerNFT.connect(alice).equip(playerId, Item.BRUSH);
  });

  it("Skill points", async () => {
    const {playerId, playerNFT, itemNFT, world, alice} = await loadFixture(deployContracts);

    const stats: Stats = {
      attack: 2,
      magic: 0,
      range: 0,
      meleeDefence: -1,
      magicDefence: 0,
      rangeDefence: 0,
      health: 12,
    };
    await itemNFT.addItem(
      Item.BRUSH,
      {stats, equipPosition: EquipPosition.RIGHT_ARM, exists: true},
      "someIPFSURI.json"
    );
    await expect(playerNFT.connect(alice).equip(playerId, Item.BRUSH)).to.be.reverted; // Don't own any
    await itemNFT.testMint(alice.address, Item.BRUSH, 1);
    await playerNFT.connect(alice).equip(playerId, Item.BRUSH);

    const queuedAction: QueuedAction = {
      actionId: 1,
      skill: Skill.PAINT,
      timespan: 100,
      extraEquipment: [{itemTokenId: Item.BRUSH, numToEquip: 1}],
    };

    await expect(playerNFT.connect(alice).startAction(queuedAction, playerId, false)).to.be.reverted; // No action added yet

    const tx = await world.addAction({
      skill: Skill.PAINT,
      baseXPPerHour: 10,
      minSkillPoints: 0,
      isDynamic: false,
      itemPosition: EquipPosition.RIGHT_ARM,
      itemTokenIdRangeMin: Item.BRUSH,
      itemTokenIdRangeMax: Item.WAND,
    });
    const actionId = getActionId(tx);
    await expect(playerNFT.connect(alice).startAction(queuedAction, playerId, false)).to.be.reverted; // Action not set to available yet

    await world.setAvailable(actionId, true);

    await playerNFT.connect(alice).startAction(queuedAction, playerId, false);
    await ethers.provider.send("evm_increaseTime", [1]);
    await playerNFT.connect(alice).consumeSkills(playerId);
    expect((await playerNFT.skillPoints(playerId, Skill.PAINT))).to.be.oneOf([1, 2, 3]);
  });

  it("Skill points, max range", async () => {
    const {playerId, playerNFT, itemNFT, world, alice, maxTime} = await loadFixture(deployContracts);

    const stats: Stats = {
      attack: 2,
      magic: 0,
      range: 0,
      meleeDefence: -1,
      magicDefence: 0,
      rangeDefence: 0,
      health: 12,
    };
    await itemNFT.addItem(
      Item.BRUSH,
      {stats, equipPosition: EquipPosition.RIGHT_ARM, exists: true},
      "someIPFSURI.json"
    );
    await itemNFT.testMint(alice.address, Item.BRUSH, 1);
    await playerNFT.connect(alice).equip(playerId, Item.BRUSH);

    const tx = await world.addAction({
      skill: Skill.PAINT,
      baseXPPerHour: 10,
      minSkillPoints: 0,
      isDynamic: false,
      itemPosition: EquipPosition.RIGHT_ARM,
      itemTokenIdRangeMin: Item.BRUSH,
      itemTokenIdRangeMax: Item.WAND,
    });
    const actionId = getActionId(tx);
    await world.setAvailable(actionId, true);

    const queuedAction: QueuedAction = {
      actionId: 1,
      skill: Skill.PAINT,
      timespan: 100,
      extraEquipment: [{itemTokenId: Item.BRUSH, numToEquip: 1}],
    };

    await playerNFT.connect(alice).startAction(queuedAction, playerId, false);

    await ethers.provider.send("evm_increaseTime", [maxTime + 1]);
    await playerNFT.connect(alice).consumeSkills(playerId);
    expect((await playerNFT.skillPoints(playerId, Skill.PAINT))).to.eq(maxTime);
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

    const stats: Stats = {
      attack: 2,
      magic: 0,
      range: 0,
      meleeDefence: -1,
      magicDefence: 0,
      rangeDefence: 0,
      health: 12,
    };
    await itemNFT.addItem(
      Item.SHIELD,
      {stats, equipPosition: EquipPosition.BODY, exists: true},
      "someIPFSURI.json"
    );

    // Check bonuses before
    const beforeStats = (await playerNFT.players(playerId)).totalStats;
    expect(beforeStats.attack).to.eq(0);
    expect(beforeStats.range).to.eq(0);
    expect(beforeStats.magic).to.eq(0);
    expect(beforeStats.meleeDefence).to.eq(0);
    expect(beforeStats.rangeDefence).to.eq(0);
    expect(beforeStats.magicDefence).to.eq(0);
    expect(beforeStats.health).to.eq(0);

    await playerNFT.connect(alice).equip(playerId, Item.SHIELD);

    // Check bonuses after
    const afterStats = (await playerNFT.players(playerId)).totalStats;
    expect(afterStats.attack).to.eq(2);
    expect(afterStats.range).to.eq(0);
    expect(afterStats.magic).to.eq(0);
    expect(afterStats.meleeDefence).to.eq(-1);
    expect(afterStats.rangeDefence).to.eq(0);
    expect(afterStats.magicDefence).to.eq(0);
    expect(afterStats.health).to.eq(12);

    expect(await users.numEquipped(alice.address, Item.SHIELD)).to.eq(1);

    // Try equip it on someone else, should fail as we don't have enough

    const avatarId = 1;
    const avatarInfo = {
      name: ethers.utils.formatBytes32String("Name goes here1"),
      description: "Hi I'm a description",
      imageURI: "1234.png",
    };
    await playerNFT.addAvatar(avatarId, avatarInfo);

    const newPlayerId = await createPlayer(playerNFT, avatarId, alice, ethers.utils.formatBytes32String("0xSamWitch"));
    await expect(playerNFT.connect(alice).equip(newPlayerId, Item.SHIELD)).to.be.reverted;

    // Mint another one and try again, first trying to connect same item to the same player
    await itemNFT.testMint(alice.address, Item.SHIELD, 1);
    await expect(playerNFT.connect(alice).equip(playerId, Item.SHIELD)).to.be.reverted;
    await playerNFT.connect(alice).equip(newPlayerId, Item.SHIELD);
    expect(await users.numEquipped(alice.address, Item.SHIELD)).to.eq(2);
  });

  it("Edit Name", async () => {
    const {playerId, playerNFT, alice, brush} = await loadFixture(deployContracts);
    await expect(
      playerNFT.connect(alice).editName(playerId, ethers.utils.formatBytes32String("My name is edited, woo"))
    ).to.be.reverted; // Haven't got the brush

    await brush.mint(alice.address, 5000);
    await brush.connect(alice).approve(playerNFT.address, 5000);

    await expect(playerNFT.editName(playerId, ethers.utils.formatBytes32String("My name is edited, woo"))).to.be
      .reverted; // Not the owner

    await playerNFT.connect(alice).editName(playerId, ethers.utils.formatBytes32String("My name is edited, woo"));
  });

  /*
  it.only("Equipment Many", async () => {
    // TODO:
  });

  it.only("uri", async () => {
  }); */
});
