import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {expect} from "chai";
import {ethers} from "hardhat";
import {
  BRONZE_AXE,
  BRONZE_GAUNTLETS,
  BRONZE_PICKAXE,
  BRONZE_SWORD,
  COMBAT_BASE,
  COMBAT_MAX,
  COPPER_ORE,
  createPlayer,
  EquipPosition,
  getActionId,
  LOG,
  MINING_MAX,
  QueuedAction,
  Skill,
  Stats,
  WOODCUTTING_BASE,
  WOODCUTTING_MAX,
} from "../scripts/utils";

const actionIsAvailable = true;

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
    const {} = await loadFixture(deployContracts);
    const {playerId, playerNFT, itemNFT, alice} = await loadFixture(deployContracts);

    await expect(playerNFT.connect(alice).equip(playerId, BRONZE_GAUNTLETS)).to.be.reverted; // item doesn't exist yet
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
      BRONZE_GAUNTLETS,
      {stats, equipPosition: EquipPosition.ARMS, exists: true},
      "someIPFSURI.json"
    );
    await expect(playerNFT.connect(alice).equip(playerId, BRONZE_GAUNTLETS)).to.be.reverted; // Don't own any
    await itemNFT.testMint(alice.address, BRONZE_GAUNTLETS, 1);
    await playerNFT.connect(alice).equip(playerId, BRONZE_GAUNTLETS);
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
      BRONZE_SWORD,
      {stats, equipPosition: EquipPosition.RIGHT_ARM, exists: true},
      "someIPFSURI.json"
    );
    await itemNFT.addItem(
      BRONZE_GAUNTLETS,
      {stats, equipPosition: EquipPosition.ARMS, exists: true},
      "someIPFSURI.json"
    );
    await expect(playerNFT.connect(alice).equip(playerId, BRONZE_GAUNTLETS)).to.be.reverted; // Don't own any
    await itemNFT.testMint(alice.address, BRONZE_GAUNTLETS, 1);
    await playerNFT.connect(alice).equip(playerId, BRONZE_GAUNTLETS);
    await itemNFT.testMint(alice.address, BRONZE_SWORD, 1);
    await expect(playerNFT.connect(alice).equip(playerId, BRONZE_SWORD)).to.be.reverted; // Sword cannot be equipped like this

    const queuedAction: QueuedAction = {
      actionId: 1,
      skill: Skill.ATTACK,
      timespan: 100,
      extraEquipment: [{itemTokenId: BRONZE_SWORD, numToEquip: 1}],
    };

    await expect(playerNFT.connect(alice).startAction(queuedAction, playerId, false)).to.be.reverted; // No action added yet

    await world.addAction(
      {
        skill: Skill.ATTACK,
        baseXPPerHour: 10,
        minSkillPoints: 0,
        isDynamic: false,
        itemPosition: EquipPosition.RIGHT_ARM,
        itemTokenIdRangeMin: COMBAT_BASE,
        itemTokenIdRangeMax: COMBAT_MAX,
        dropRewards: [],
        lootChances: [],
      },
      actionIsAvailable
    );

    await playerNFT.connect(alice).startAction(queuedAction, playerId, false);
    await ethers.provider.send("evm_increaseTime", [1]);
    await playerNFT.connect(alice).consumeSkills(playerId);
    expect(await playerNFT.skillPoints(playerId, Skill.ATTACK)).to.be.oneOf([1, 2, 3]);
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
      BRONZE_GAUNTLETS,
      {stats, equipPosition: EquipPosition.ARMS, exists: true},
      "someIPFSURI.json"
    );
    await itemNFT.testMint(alice.address, BRONZE_SWORD, 1);
    await itemNFT.testMint(alice.address, BRONZE_GAUNTLETS, 1);
    await playerNFT.connect(alice).equip(playerId, BRONZE_GAUNTLETS);

    await itemNFT.addItem(
      BRONZE_SWORD,
      {stats, equipPosition: EquipPosition.RIGHT_ARM, exists: true},
      "someIPFSURI.json"
    );

    await world.addAction(
      {
        skill: Skill.ATTACK,
        baseXPPerHour: 10,
        minSkillPoints: 0,
        isDynamic: false,
        itemPosition: EquipPosition.RIGHT_ARM,
        itemTokenIdRangeMin: COMBAT_BASE,
        itemTokenIdRangeMax: COMBAT_MAX,
        dropRewards: [],
        lootChances: [],
      },
      actionIsAvailable
    );

    const queuedAction: QueuedAction = {
      actionId: 1,
      skill: Skill.ATTACK,
      timespan: 100,
      extraEquipment: [{itemTokenId: BRONZE_SWORD, numToEquip: 1}],
    };

    await playerNFT.connect(alice).startAction(queuedAction, playerId, false);

    await ethers.provider.send("evm_increaseTime", [queuedAction.timespan + 2]);
    await playerNFT.connect(alice).consumeSkills(playerId);
    expect(await playerNFT.skillPoints(playerId, Skill.ATTACK)).to.eq(queuedAction.timespan);
  });

  it("Multi-skill points", async () => {
    // TODO:
  });

  it("Equipment", async () => {
    const {playerId, playerNFT, itemNFT, users, alice} = await loadFixture(deployContracts);
    await itemNFT.testMint(alice.address, BRONZE_GAUNTLETS, 1);
    expect(await itemNFT.balanceOf(alice.address, BRONZE_GAUNTLETS)).to.eq(1);

    // Shield doesn't exist yet
    await expect(playerNFT.equip(playerId, BRONZE_GAUNTLETS)).to.be.reverted;

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
      BRONZE_GAUNTLETS,
      {stats, equipPosition: EquipPosition.ARMS, exists: true},
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

    await playerNFT.connect(alice).equip(playerId, BRONZE_GAUNTLETS);

    // Check bonuses after
    const afterStats = (await playerNFT.players(playerId)).totalStats;
    expect(afterStats.attack).to.eq(2);
    expect(afterStats.range).to.eq(0);
    expect(afterStats.magic).to.eq(0);
    expect(afterStats.meleeDefence).to.eq(-1);
    expect(afterStats.rangeDefence).to.eq(0);
    expect(afterStats.magicDefence).to.eq(0);
    expect(afterStats.health).to.eq(12);

    expect(await users.numEquipped(alice.address, BRONZE_GAUNTLETS)).to.eq(1);

    // Try equip it on someone else, should fail as we don't have enough
    const avatarId = 1;
    const avatarInfo = {
      name: ethers.utils.formatBytes32String("Name goes here1"),
      description: "Hi I'm a description",
      imageURI: "1234.png",
    };
    await playerNFT.addAvatar(avatarId, avatarInfo);

    const newPlayerId = await createPlayer(playerNFT, avatarId, alice, ethers.utils.formatBytes32String("0xSamWitch"));
    await expect(playerNFT.connect(alice).equip(newPlayerId, BRONZE_GAUNTLETS)).to.be.reverted;

    // Mint another one and try again, first trying to connect same item to the same player
    await itemNFT.testMint(alice.address, BRONZE_GAUNTLETS, 1);
    await expect(playerNFT.connect(alice).equip(playerId, BRONZE_GAUNTLETS)).to.be.reverted;
    await playerNFT.connect(alice).equip(newPlayerId, BRONZE_GAUNTLETS);
    expect(await users.numEquipped(alice.address, BRONZE_GAUNTLETS)).to.eq(2);
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

  describe("Actions", () => {
    // Test minSkillPoints
    // Test isDynamic
    // Test incorrect item position and range

    const emptyStats = {
      attack: 0,
      magic: 0,
      range: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangeDefence: 0,
      health: 0,
    };

    it("Woodcutting", async () => {
      const {playerId, playerNFT, itemNFT, world, alice} = await loadFixture(deployContracts);

      const rate = 100; // per hour
      const tx = await world.addAction(
        {
          skill: Skill.WOODCUTTING,
          baseXPPerHour: 10,
          minSkillPoints: 0,
          isDynamic: false,
          itemPosition: EquipPosition.RIGHT_ARM,
          itemTokenIdRangeMin: BRONZE_AXE,
          itemTokenIdRangeMax: WOODCUTTING_MAX,
          dropRewards: [{itemTokenId: LOG, rate: rate * 100}], // 100.00
          lootChances: [],
        },
        actionIsAvailable
      );
      const actionId = await getActionId(tx);

      await itemNFT.testMint(alice.address, BRONZE_AXE, 1);
      const timespan = 3600;
      const queuedAction: QueuedAction = {
        actionId,
        skill: Skill.WOODCUTTING,
        timespan: timespan,
        extraEquipment: [{itemTokenId: BRONZE_AXE, numToEquip: 1}],
      };

      await itemNFT.addItem(
        BRONZE_AXE,
        {stats: emptyStats, equipPosition: EquipPosition.RIGHT_ARM, exists: true},
        "someIPFSURI.json"
      );

      await playerNFT.connect(alice).startAction(queuedAction, playerId, false);

      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan + 2]);
      await playerNFT.connect(alice).consumeSkills(playerId);
      expect(await playerNFT.skillPoints(playerId, Skill.WOODCUTTING)).to.eq(queuedAction.timespan);
      // Check the drops are as expected
      expect(await itemNFT.balanceOf(alice.address, LOG)).to.eq(Math.floor((timespan * rate) / 3600));
    });

    it("Mining", async () => {
      const {playerId, playerNFT, itemNFT, world, alice} = await loadFixture(deployContracts);

      const tx = await world.addAction(
        {
          skill: Skill.MINING,
          baseXPPerHour: 10,
          minSkillPoints: 0,
          isDynamic: false,
          itemPosition: EquipPosition.RIGHT_ARM,
          itemTokenIdRangeMin: BRONZE_PICKAXE,
          itemTokenIdRangeMax: MINING_MAX,
          dropRewards: [{itemTokenId: COPPER_ORE, rate: 100}], // 100.00
          lootChances: [],
        },
        actionIsAvailable
      );

      const actionId = await getActionId(tx);

      await itemNFT.testMint(alice.address, BRONZE_PICKAXE, 1);
      const queuedAction: QueuedAction = {
        actionId,
        skill: Skill.MINING,
        timespan: 100,
        extraEquipment: [{itemTokenId: BRONZE_PICKAXE, numToEquip: 1}],
      };

      await itemNFT.addItem(
        BRONZE_PICKAXE,
        {stats: emptyStats, equipPosition: EquipPosition.RIGHT_ARM, exists: true},
        "someIPFSURI.json"
      );

      await playerNFT.connect(alice).startAction(queuedAction, playerId, false);

      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan + 2]);
      await playerNFT.connect(alice).consumeSkills(playerId);
      expect(await playerNFT.skillPoints(playerId, Skill.MINING)).to.eq(queuedAction.timespan);
    });

    // Rest of the actions
  });

  /*
  it("Equipment Many", async () => {
    // TODO:
  });

  it("uri", async () => {
  }); */
});
