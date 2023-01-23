import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {expect} from "chai";
import {ethers} from "hardhat";
import {
  BRONZE_AXE,
  BRONZE_GAUNTLETS,
  BRONZE_PICKAXE,
  BRONZE_SWORD,
  BRONZE_TASSETS,
  COAL_ORE,
  COMBAT_BASE,
  COMBAT_MAX,
  COPPER_ORE,
  createPlayer,
  EquipPosition,
  FIRE_LIGHTER,
  FIRE_MAX,
  getActionChoiceId,
  getActionId,
  LOG,
  LOG_BASE,
  LOG_MAX,
  MINING_MAX,
  MITHRIL_BAR,
  MITHRIL_ORE,
  NONE,
  ORE_BASE,
  ORE_MAX,
  QueuedAction,
  Skill,
  Stats,
  TIN_ORE,
  WOODCUTTING_BASE,
  WOODCUTTING_MAX,
} from "../scripts/utils";

const actionIsAvailable = true;

const emptyStats = {
  attack: 0,
  magic: 0,
  range: 0,
  meleeDefence: 0,
  magicDefence: 0,
  rangeDefence: 0,
  health: 0,
};

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
    await playerNFT.setAvatar(avatarId, avatarInfo);

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

  it("Unequip", async () => {
    const {playerId, playerNFT, itemNFT, alice} = await loadFixture(deployContracts);

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

    await itemNFT.testMint(alice.address, BRONZE_GAUNTLETS, 1);
    await playerNFT.connect(alice).equip(playerId, BRONZE_GAUNTLETS);

    {
      const afterStats = (await playerNFT.players(playerId)).totalStats;
      expect(afterStats.attack).to.eq(2);
      expect(afterStats.meleeDefence).to.eq(-1);
    }
    // Remove a piece of equipment and check the stats are appropriately updated
    await playerNFT.connect(alice).unequip(playerId, EquipPosition.ARMS);
    {
      const afterStats = (await playerNFT.players(playerId)).totalStats;
      expect(afterStats.attack).to.eq(0);
      expect(afterStats.meleeDefence).to.eq(0);
    }
  });

  it("SetEquipment", async () => {
    const {playerId, playerNFT, itemNFT, alice} = await loadFixture(deployContracts);

    await expect(playerNFT.connect(alice).setEquipment(playerId, [BRONZE_GAUNTLETS, BRONZE_TASSETS])).to.be.reverted; // items don't exist yet
    {
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
    }
    {
      const stats: Stats = {
        attack: 0,
        magic: 0,
        range: 0,
        meleeDefence: 10,
        magicDefence: 0,
        rangeDefence: 0,
        health: 0,
      };
      await itemNFT.addItem(
        BRONZE_TASSETS,
        {stats, equipPosition: EquipPosition.LEGS, exists: true},
        "someIPFSURI.json"
      );
    }

    await expect(playerNFT.connect(alice).setEquipment(playerId, [BRONZE_GAUNTLETS, BRONZE_TASSETS])).to.be.reverted; // Don't own any
    await itemNFT.testMint(alice.address, BRONZE_GAUNTLETS, 1);
    await itemNFT.testMint(alice.address, BRONZE_TASSETS, 1);
    await playerNFT.connect(alice).setEquipment(playerId, [BRONZE_GAUNTLETS, BRONZE_TASSETS]);

    // Check they are both equipped (and stats?)
    {
      const afterStats = (await playerNFT.players(playerId)).totalStats;
      expect(afterStats.attack).to.eq(2);
      expect(afterStats.meleeDefence).to.eq(9);
    }
    // Remove a piece of equipment and check the stats are appropriately updated
    await playerNFT.connect(alice).setEquipment(playerId, [BRONZE_GAUNTLETS]);
    {
      const afterStats = (await playerNFT.players(playerId)).totalStats;
      expect(afterStats.attack).to.eq(2);
      expect(afterStats.meleeDefence).to.eq(-1);
    }
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
      rightArmEquipmentTokenId: BRONZE_SWORD,
      leftArmEquipmentTokenId: NONE,
      startTime: "0",
    };

    await expect(playerNFT.connect(alice).startAction(queuedAction, playerId, false)).to.be.reverted; // No action added yet

    await world.addAction({
      info: {
        skill: Skill.ATTACK,
        baseXPPerHour: 3600,
        minSkillPoints: 0,
        isDynamic: false,
        itemTokenIdRangeMin: COMBAT_BASE,
        itemTokenIdRangeMax: COMBAT_MAX,
        auxItemTokenIdRangeMin: NONE,
        auxItemTokenIdRangeMax: NONE,
        isAvailable: actionIsAvailable,
      },
      dropRewards: [],
      lootChances: [],
    });

    await playerNFT.connect(alice).startAction(queuedAction, playerId, false);
    await ethers.provider.send("evm_increaseTime", [1]);
    await playerNFT.connect(alice).consumeSkills(playerId);
    expect(await playerNFT.skillPoints(playerId, Skill.ATTACK)).to.be.oneOf([1, 2, 3]);
  });

  it("Speed multiplier", async () => {
    const {playerId, playerNFT, itemNFT, world, alice} = await loadFixture(deployContracts);

    const rate = 100; // per hour
    const tx = await world.addAction({
      info: {
        skill: Skill.WOODCUTTING,
        baseXPPerHour: 3600,
        minSkillPoints: 0,
        isDynamic: false,
        itemTokenIdRangeMin: BRONZE_AXE,
        itemTokenIdRangeMax: WOODCUTTING_MAX,
        auxItemTokenIdRangeMin: NONE,
        auxItemTokenIdRangeMax: NONE,
        isAvailable: actionIsAvailable,
      },
      dropRewards: [{itemTokenId: LOG, rate: rate * 100}], // 100.00
      lootChances: [],
    });
    const actionId = await getActionId(tx);

    await itemNFT.testMint(alice.address, BRONZE_AXE, 1);
    const timespan = 3600;
    const queuedAction: QueuedAction = {
      actionId,
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
      timespan,
      rightArmEquipmentTokenId: BRONZE_AXE,
      leftArmEquipmentTokenId: NONE,
      startTime: "0",
    };

    await itemNFT.addItem(
      BRONZE_AXE,
      {stats: emptyStats, equipPosition: EquipPosition.RIGHT_ARM, exists: true},
      "someIPFSURI.json"
    );

    await playerNFT.connect(alice).startAction(queuedAction, playerId, false);
    await playerNFT.connect(alice).setSpeedMultiplier(playerId, 2);

    await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]);
    await playerNFT.connect(alice).consumeSkills(playerId);
    expect(await playerNFT.skillPoints(playerId, Skill.WOODCUTTING)).to.eq(queuedAction.timespan * 2);
    // Check the drops are as expected
    expect(await itemNFT.balanceOf(alice.address, LOG)).to.eq(Math.floor((queuedAction.timespan * 2 * rate) / 3600));
  });

  it("Partial consume aux items", async () => {
    const {playerId, playerNFT, itemNFT, world, alice} = await loadFixture(deployContracts);

    const rate = 100; // per hour
    const tx = await world.addAction({
      info: {
        skill: Skill.WOODCUTTING,
        baseXPPerHour: 3600,
        minSkillPoints: 0,
        isDynamic: false,
        itemTokenIdRangeMin: BRONZE_AXE,
        itemTokenIdRangeMax: WOODCUTTING_MAX,
        auxItemTokenIdRangeMin: NONE,
        auxItemTokenIdRangeMax: NONE,
        isAvailable: actionIsAvailable,
      },
      dropRewards: [{itemTokenId: LOG, rate: rate * 100}], // 100.00
      lootChances: [],
    });
    const actionId = await getActionId(tx);

    await itemNFT.testMint(alice.address, BRONZE_AXE, 1);
    const timespan = 3600;
    const queuedAction: QueuedAction = {
      actionId,
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
      timespan,
      rightArmEquipmentTokenId: BRONZE_AXE,
      leftArmEquipmentTokenId: NONE,
      startTime: "0",
    };

    await itemNFT.addItem(
      BRONZE_AXE,
      {stats: emptyStats, equipPosition: EquipPosition.RIGHT_ARM, exists: true},
      "someIPFSURI.json"
    );

    await playerNFT.connect(alice).startAction(queuedAction, playerId, false);

    await ethers.provider.send("evm_increaseTime", [queuedAction.timespan / 2]);
    await playerNFT.connect(alice).consumeSkills(playerId);
    expect(await playerNFT.skillPoints(playerId, Skill.WOODCUTTING)).to.eq(queuedAction.timespan / 2);
    // Check the drops are as expected
    expect(await itemNFT.balanceOf(alice.address, LOG)).to.eq(Math.floor(((queuedAction.timespan / 2) * rate) / 3600));
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

    await world.addAction({
      info: {
        skill: Skill.ATTACK,
        baseXPPerHour: 3600,
        minSkillPoints: 0,
        isDynamic: false,
        itemTokenIdRangeMin: COMBAT_BASE,
        itemTokenIdRangeMax: COMBAT_MAX,
        auxItemTokenIdRangeMin: NONE,
        auxItemTokenIdRangeMax: NONE,
        isAvailable: actionIsAvailable,
      },
      dropRewards: [],
      lootChances: [],
    });

    const queuedAction: QueuedAction = {
      actionId: 1,
      skill: Skill.ATTACK,
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
      rightArmEquipmentTokenId: BRONZE_SWORD,
      leftArmEquipmentTokenId: NONE,
      startTime: "0",
    };

    await playerNFT.connect(alice).startAction(queuedAction, playerId, false);

    await ethers.provider.send("evm_increaseTime", [queuedAction.timespan + 2]);
    await playerNFT.connect(alice).consumeSkills(playerId);
    expect(await playerNFT.skillPoints(playerId, Skill.ATTACK)).to.eq(queuedAction.timespan);
  });

  it("Multi-skill points", async () => {
    // TODO:
  });

  it("Equipment stats", async () => {
    const {playerId, playerNFT, itemNFT, users, alice} = await loadFixture(deployContracts);
    await itemNFT.testMint(alice.address, BRONZE_GAUNTLETS, 1);
    expect(await itemNFT.balanceOf(alice.address, BRONZE_GAUNTLETS)).to.eq(1);

    // Gauntlet doesn't exist yet
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
    await playerNFT.setAvatar(avatarId, avatarInfo);

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

  describe("Non-Combat Actions", () => {
    // Test minSkillPoints
    // Test isDynamic
    // Test incorrect item position and range
    it("Woodcutting", async () => {
      const {playerId, playerNFT, itemNFT, world, alice} = await loadFixture(deployContracts);

      const rate = 100; // per hour
      const tx = await world.addAction({
        info: {
          skill: Skill.WOODCUTTING,
          baseXPPerHour: 3600,
          minSkillPoints: 0,
          isDynamic: false,
          itemTokenIdRangeMin: BRONZE_AXE,
          itemTokenIdRangeMax: WOODCUTTING_MAX,
          auxItemTokenIdRangeMin: NONE,
          auxItemTokenIdRangeMax: NONE,
          isAvailable: actionIsAvailable,
        },
        dropRewards: [{itemTokenId: LOG, rate: rate * 100}], // 100.00
        lootChances: [],
      });
      const actionId = await getActionId(tx);

      await itemNFT.testMint(alice.address, BRONZE_AXE, 1);
      const timespan = 3600;
      const queuedAction: QueuedAction = {
        actionId,
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
        timespan,
        rightArmEquipmentTokenId: BRONZE_AXE,
        leftArmEquipmentTokenId: NONE,
        startTime: "0",
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

    it("Firemaking", async () => {
      const {playerId, playerNFT, itemNFT, world, alice} = await loadFixture(deployContracts);
      const rate = 100; // per hour
      let tx = await world.addAction({
        info: {
          skill: Skill.FIREMAKING,
          baseXPPerHour: 0,
          minSkillPoints: 0,
          isDynamic: false,
          itemTokenIdRangeMin: FIRE_LIGHTER,
          itemTokenIdRangeMax: FIRE_MAX,
          auxItemTokenIdRangeMin: LOG_BASE,
          auxItemTokenIdRangeMax: LOG_MAX,
          isAvailable: actionIsAvailable,
        },
        dropRewards: [],
        lootChances: [],
      });
      const actionId = await getActionId(tx);

      // Logs go in, nothing comes out
      tx = await world.addActionChoice(actionId, {
        skill: Skill.FIREMAKING,
        diff: 0,
        baseXPPerHour: 3600,
        minSkillPoints: 0,
        rate: rate * 100,
        inputTokenId1: LOG,
        num1: 1,
        inputTokenId2: NONE,
        num2: 0,
        inputTokenId3: NONE,
        num3: 0,
        outputTokenId: NONE,
      });
      const choiceId = await getActionChoiceId(tx);

      const timespan = 3600;
      const queuedAction: QueuedAction = {
        actionId,
        skill: Skill.FIREMAKING,
        potionId: NONE,
        choiceId,
        num: 255,
        choiceId1: NONE,
        num1: 0,
        choiceId2: NONE,
        num2: 0,
        regenerateId: NONE,
        numRegenerate: 0,
        timespan,
        rightArmEquipmentTokenId: FIRE_LIGHTER,
        leftArmEquipmentTokenId: NONE,
        startTime: "0",
      };

      await itemNFT.addItem(
        FIRE_LIGHTER,
        {stats: emptyStats, equipPosition: EquipPosition.RIGHT_ARM, exists: true},
        "someIPFSURI.json"
      );

      await itemNFT.addItem(
        LOG,
        {stats: emptyStats, equipPosition: EquipPosition.AUX, exists: true},
        "someIPFSURI.json"
      );

      await itemNFT.testMint(alice.address, LOG, 255);
      await playerNFT.connect(alice).startAction(queuedAction, playerId, false);

      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan + 2]);
      await playerNFT.connect(alice).consumeSkills(playerId);
      expect(await playerNFT.skillPoints(playerId, Skill.FIREMAKING)).to.eq(queuedAction.timespan);

      // Check how many logs they have now, 100 logs burnt per hour
      expect(await itemNFT.balanceOf(alice.address, LOG)).to.eq(255 - Math.floor((timespan * rate) / 3600));
    });

    it("Multi skill, woodcutting + firemaking", async () => {
      const {playerId, playerNFT, itemNFT, world, alice} = await loadFixture(deployContracts);
      const queuedActions: QueuedAction[] = [];
      const rate = 100; // per hour
      {
        const tx = await world.addAction({
          info: {
            skill: Skill.WOODCUTTING,
            baseXPPerHour: 3600,
            minSkillPoints: 0,
            isDynamic: false,
            itemTokenIdRangeMin: BRONZE_AXE,
            itemTokenIdRangeMax: WOODCUTTING_MAX,
            auxItemTokenIdRangeMin: NONE,
            auxItemTokenIdRangeMax: NONE,
            isAvailable: actionIsAvailable,
          },
          dropRewards: [{itemTokenId: LOG, rate: rate * 100}], // 100.00
          lootChances: [],
        });
        const actionId = await getActionId(tx);
        await itemNFT.testMint(alice.address, BRONZE_AXE, 1);
        await itemNFT.addItem(
          BRONZE_AXE,
          {stats: emptyStats, equipPosition: EquipPosition.RIGHT_ARM, exists: true},
          "someIPFSURI.json"
        );
        const timespan = 7200;
        const queuedAction: QueuedAction = {
          actionId,
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
          timespan,
          rightArmEquipmentTokenId: BRONZE_AXE,
          leftArmEquipmentTokenId: NONE,
          startTime: "0",
        };

        queuedActions.push(queuedAction);
      }
      {
        let tx = await world.addAction({
          info: {
            skill: Skill.FIREMAKING,
            baseXPPerHour: 0,
            minSkillPoints: 0,
            isDynamic: false,
            itemTokenIdRangeMin: FIRE_LIGHTER,
            itemTokenIdRangeMax: FIRE_MAX,
            auxItemTokenIdRangeMin: LOG_BASE,
            auxItemTokenIdRangeMax: LOG_MAX,
            isAvailable: actionIsAvailable,
          },
          dropRewards: [],
          lootChances: [],
        });
        const actionId = await getActionId(tx);

        // Logs go in, nothing comes out
        tx = await world.addActionChoice(actionId, {
          skill: Skill.FIREMAKING,
          diff: 0,
          baseXPPerHour: 3600,
          minSkillPoints: 0,
          rate: rate * 100,
          inputTokenId1: LOG,
          num1: 1,
          inputTokenId2: NONE,
          num2: 0,
          inputTokenId3: NONE,
          num3: 0,
          outputTokenId: NONE,
        });
        const choiceId = await getActionChoiceId(tx);

        await itemNFT.testMint(alice.address, FIRE_LIGHTER, 1);
        await itemNFT.addItem(
          FIRE_LIGHTER,
          {stats: emptyStats, equipPosition: EquipPosition.RIGHT_ARM, exists: true},
          "someIPFSURI.json"
        );
        const timespan = 3600;

        const queuedAction: QueuedAction = {
          actionId,
          skill: Skill.FIREMAKING,
          potionId: NONE,
          choiceId,
          num: 255,
          choiceId1: NONE,
          num1: 0,
          choiceId2: NONE,
          num2: 0,
          regenerateId: NONE,
          numRegenerate: 0,
          timespan,
          rightArmEquipmentTokenId: FIRE_LIGHTER,
          leftArmEquipmentTokenId: NONE,
          startTime: "0",
        };

        queuedActions.push(queuedAction);
      }

      await itemNFT.addItem(
        LOG,
        {stats: emptyStats, equipPosition: EquipPosition.AUX, exists: true},
        "someIPFSURI.json"
      );

      await playerNFT.connect(alice).multiskill(playerId, queuedActions);

      // multi-skill queue
      await ethers.provider.send("evm_increaseTime", [queuedActions[0].timespan + queuedActions[1].timespan + 2]);
      await playerNFT.connect(alice).consumeSkills(playerId);
      expect(await playerNFT.skillPoints(playerId, Skill.WOODCUTTING)).to.eq(queuedActions[0].timespan);
      expect(await playerNFT.skillPoints(playerId, Skill.FIREMAKING)).to.eq(queuedActions[1].timespan);
      // Check how many logs they have now, 100 logs burnt per hour, 2 hours producing logs, 1 hour burning
      expect(await itemNFT.balanceOf(alice.address, LOG)).to.eq(
        Math.floor((queuedActions[0].timespan * rate) / 3600) - Math.floor((queuedActions[1].timespan * rate) / 3600)
      );
    });

    it("Mining", async () => {
      const {playerId, playerNFT, itemNFT, world, alice} = await loadFixture(deployContracts);

      const tx = await world.addAction({
        info: {
          skill: Skill.MINING,
          baseXPPerHour: 3600,
          minSkillPoints: 0,
          isDynamic: false,
          itemTokenIdRangeMin: BRONZE_PICKAXE,
          itemTokenIdRangeMax: MINING_MAX,
          auxItemTokenIdRangeMin: NONE,
          auxItemTokenIdRangeMax: NONE,
          isAvailable: actionIsAvailable,
        },
        dropRewards: [{itemTokenId: COPPER_ORE, rate: 100}], // 100.00
        lootChances: [],
      });

      const actionId = await getActionId(tx);

      await itemNFT.testMint(alice.address, BRONZE_PICKAXE, 1);
      const queuedAction: QueuedAction = {
        actionId,
        skill: Skill.MINING,
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
        rightArmEquipmentTokenId: BRONZE_PICKAXE,
        leftArmEquipmentTokenId: NONE,
        startTime: "0",
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

    it("Smithing", async () => {
      const {playerId, playerNFT, itemNFT, world, alice} = await loadFixture(deployContracts);
      const rate = 100; // per hour

      let tx = await world.addAction({
        info: {
          skill: Skill.SMITHING,
          baseXPPerHour: 0,
          minSkillPoints: 0,
          isDynamic: false,
          itemTokenIdRangeMin: NONE,
          itemTokenIdRangeMax: NONE,
          auxItemTokenIdRangeMin: ORE_BASE,
          auxItemTokenIdRangeMax: ORE_MAX,
          isAvailable: actionIsAvailable,
        },
        dropRewards: [],
        lootChances: [],
      });
      const actionId = await getActionId(tx);

      // Ores go in, bars come out
      tx = await world.addActionChoice(actionId, {
        skill: Skill.SMITHING,
        diff: 0,
        baseXPPerHour: 3600,
        minSkillPoints: 0,
        rate: rate * 100,
        inputTokenId1: COAL_ORE,
        num1: 2,
        inputTokenId2: MITHRIL_ORE,
        num2: 1,
        inputTokenId3: NONE,
        num3: 0,
        outputTokenId: MITHRIL_BAR,
      });
      const choiceId = await getActionChoiceId(tx);

      const timespan = 3600;

      const queuedAction: QueuedAction = {
        actionId,
        skill: Skill.SMITHING,
        potionId: NONE,
        choiceId,
        num: 100,
        choiceId1: NONE,
        num1: 0,
        choiceId2: NONE,
        num2: 0,
        regenerateId: NONE,
        numRegenerate: 0,
        timespan,
        rightArmEquipmentTokenId: NONE,
        leftArmEquipmentTokenId: NONE,
        startTime: "0",
      };

      await itemNFT.addItem(
        COAL_ORE,
        {stats: emptyStats, equipPosition: EquipPosition.AUX, exists: true},
        "someIPFSURI.json"
      );

      await itemNFT.addItem(
        MITHRIL_ORE,
        {stats: emptyStats, equipPosition: EquipPosition.AUX, exists: true},
        "someIPFSURI.json"
      );

      await itemNFT.testMint(alice.address, COAL_ORE, 255);
      await itemNFT.testMint(alice.address, MITHRIL_ORE, 255);
      await playerNFT.connect(alice).startAction(queuedAction, playerId, false);

      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan + 2]);
      await playerNFT.connect(alice).consumeSkills(playerId);
      expect(await playerNFT.skillPoints(playerId, Skill.SMITHING)).to.eq(queuedAction.timespan);

      // Check how many bars they have now, 100 bars created per hour, burns 2 coal and 1 mithril
      expect(await itemNFT.balanceOf(alice.address, MITHRIL_BAR)).to.eq(Math.floor((timespan * rate) / 3600));
      expect(await itemNFT.balanceOf(alice.address, COAL_ORE)).to.eq(255 - Math.floor((timespan * rate) / 3600) * 2);
      expect(await itemNFT.balanceOf(alice.address, MITHRIL_ORE)).to.eq(255 - Math.floor((timespan * rate) / 3600));
    });

    // TODO Rest of the actions

    it("Action pipelining", async () => {
      // Try wood cut, and then burning them when having none equipped
    });
  });

  /*
  describe("Combat Actions", () => {
    it("Ranged", async () => {
      const {playerId, playerNFT, itemNFT, world, alice} = await loadFixture(deployContracts);

      const rate = 100; // per hour
      const tx = await world.addAction({
        info: {
          skill: Skill.COMBAT,
          baseXPPerHour: 3600,
          minSkillPoints: 0,
          isDynamic: false,
          itemTokenIdRangeMin: COMBAT_BASE,
          itemTokenIdRangeMax: COMBAT_MAX,
          auxItemTokenIdRangeMin: NONE,
          auxItemTokenIdRangeMax: NONE,
          isAvailable: actionIsAvailable,
        },
        dropRewards: [{itemTokenId: LOG, rate: rate * 100}], // 100.00
        lootChances: [],
      });
      const actionId = await getActionId(tx);

      await itemNFT.testMint(alice.address, BRONZE_AXE, 1);
      const timespan = 3600;
      const queuedAction: QueuedAction = {
        actionId,
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
        timespan,
        rightArmEquipmentTokenId: BRONZE_AXE,
        leftArmEquipmentTokenId: NONE,
        startTime: "0",
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
  });*/

  /*
  it("Equipment Many", async () => {
    // TODO:
  });

  it("uri", async () => {
  }); */
});
