import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {expect} from "chai";
import {ethers, upgrades} from "hardhat";
import {
  AIR_SCROLL,
  BRONZE_ARROW,
  BRONZE_AXE,
  BRONZE_GAUNTLETS,
  BRONZE_PICKAXE,
  BRONZE_SWORD,
  COAL_ORE,
  CombatStats,
  COMBAT_BASE,
  COMBAT_MAX,
  COOKED_HUPPY,
  COPPER_ORE,
  createPlayer,
  emptyStats,
  EquipPosition,
  FIRE_LIGHTER,
  FIRE_MAX,
  FIRE_SCROLL,
  getActionChoiceId,
  getActionId,
  inputItem,
  LOG,
  MINING_MAX,
  MITHRIL_BAR,
  MITHRIL_ORE,
  noAttire,
  NONE,
  QueuedAction,
  Skill,
  STAFF,
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
    const world = await upgrades.deployProxy(World, [mockOracleClient.address, subscriptionId], {
      kind: "uups",
    });

    const Shop = await ethers.getContractFactory("Shop");
    const shop = await upgrades.deployProxy(Shop, [brush.address], {
      kind: "uups",
      unsafeAllow: ["delegatecall"],
    });

    // Create NFT contract which contains all items
    const ItemNFT = await ethers.getContractFactory("ItemNFT");
    const itemNFT = await upgrades.deployProxy(ItemNFT, [world.address, shop.address], {
      kind: "uups",
      unsafeAllow: ["delegatecall"],
    });

    await shop.setItemNFT(itemNFT.address);
    // Create NFT contract which contains all the players
    const PlayerNFT = await ethers.getContractFactory("PlayerNFT");
    const playerNFT = await upgrades.deployProxy(PlayerNFT, [brush.address], {kind: "uups"});

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

    await itemNFT.setPlayers(players.address);
    await playerNFT.setPlayers(players.address);

    const avatarId = 1;
    const avatarInfo = {
      name: ethers.utils.formatBytes32String("Name goes here"),
      description: "Hi I'm a description",
      imageURI: "1234.png",
    };
    await playerNFT.setAvatar(avatarId, avatarInfo);

    // Create player
    const playerId = await createPlayer(playerNFT, avatarId, alice, ethers.utils.formatBytes32String("0xSamWitch"));
    await players.connect(alice).setActivePlayer(playerId);
    const maxTime = await players.MAX_TIME();

    return {
      playerId,
      players,
      playerNFT,
      itemNFT,
      brush,
      maxTime,
      owner,
      world,
      alice,
    };
  }

  it("Skill points", async () => {
    const {playerId, players, itemNFT, world, alice} = await loadFixture(deployContracts);
    await itemNFT.addItem({
      ...inputItem,
      tokenId: BRONZE_AXE,
      equipPosition: EquipPosition.RIGHT_HAND,
      metadataURI: "someIPFSURI.json",
    });
    await itemNFT.testOnlyMint(alice.address, BRONZE_AXE, 1);

    const rate = 100 * 100; // per hour
    const tx = await world.addAction({
      info: {
        skill: Skill.WOODCUTTING,
        baseXPPerHour: 3600,
        minSkillPoints: 0,
        isDynamic: false,
        itemTokenIdRangeMin: WOODCUTTING_BASE,
        itemTokenIdRangeMax: WOODCUTTING_MAX,
        isAvailable: actionIsAvailable,
        isCombat: true,
      },
      guaranteedRewards: [{itemTokenId: LOG, rate}],
      randomRewards: [],
      combatStats: emptyStats,
    });

    const actionId = await getActionId(tx);
    const queuedAction: QueuedAction = {
      attire: noAttire,
      actionId,
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

    await players.connect(alice).startAction(playerId, queuedAction, false);
    await ethers.provider.send("evm_increaseTime", [361]);
    await players.connect(alice).consumeActions(playerId);
    expect(await players.skillPoints(playerId, Skill.WOODCUTTING)).to.be.oneOf([361, 362]);
    expect(await itemNFT.balanceOf(alice.address, LOG)).to.eq(10); // Should be rounded down
  });

  it("Speed multiplier", async () => {
    const {playerId, players, itemNFT, world, alice} = await loadFixture(deployContracts);

    const rate = 100 * 100; // per hour
    const tx = await world.addAction({
      info: {
        skill: Skill.WOODCUTTING,
        baseXPPerHour: 3600,
        minSkillPoints: 0,
        isDynamic: false,
        itemTokenIdRangeMin: BRONZE_AXE,
        itemTokenIdRangeMax: WOODCUTTING_MAX,
        isAvailable: actionIsAvailable,
        isCombat: false,
      },
      guaranteedRewards: [{itemTokenId: LOG, rate}],
      randomRewards: [],
      combatStats: emptyStats,
    });
    const actionId = await getActionId(tx);

    await itemNFT.testOnlyMint(alice.address, BRONZE_AXE, 1);
    const timespan = 3600;
    const queuedAction: QueuedAction = {
      attire: noAttire,
      actionId,
      skill: Skill.WOODCUTTING,
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

    await itemNFT.addItem({
      ...inputItem,
      tokenId: BRONZE_AXE,
      equipPosition: EquipPosition.RIGHT_HAND,
      metadataURI: "someIPFSURI.json",
    });

    await players.connect(alice).startAction(playerId, queuedAction, false);
    await players.connect(alice).setSpeedMultiplier(playerId, 2);

    await ethers.provider.send("evm_increaseTime", [queuedAction.timespan / 2]);
    await players.connect(alice).consumeActions(playerId);
    expect(await players.skillPoints(playerId, Skill.WOODCUTTING)).to.eq(queuedAction.timespan);
    // Check the drops are as expected
    expect(await itemNFT.balanceOf(alice.address, LOG)).to.eq(
      Math.floor((queuedAction.timespan * rate) / (3600 * 100))
    );
    expect(await players.actionQueueLength(playerId)).to.eq(0);
  });

  it("Partial consume aux items", async () => {
    const {playerId, players, itemNFT, world, alice} = await loadFixture(deployContracts);

    const rate = 100 * 100; // per hour
    const tx = await world.addAction({
      info: {
        skill: Skill.WOODCUTTING,
        baseXPPerHour: 3600,
        minSkillPoints: 0,
        isDynamic: false,
        itemTokenIdRangeMin: BRONZE_AXE,
        itemTokenIdRangeMax: WOODCUTTING_MAX,
        isAvailable: actionIsAvailable,
        isCombat: false,
      },
      guaranteedRewards: [{itemTokenId: LOG, rate}],
      randomRewards: [],
      combatStats: emptyStats,
    });
    const actionId = await getActionId(tx);

    await itemNFT.testOnlyMint(alice.address, BRONZE_AXE, 1);
    const timespan = 3600;
    const queuedAction: QueuedAction = {
      attire: noAttire,
      actionId,
      skill: Skill.WOODCUTTING,
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

    await itemNFT.addItem({
      ...inputItem,
      tokenId: BRONZE_AXE,
      equipPosition: EquipPosition.RIGHT_HAND,
      metadataURI: "someIPFSURI.json",
    });

    await players.connect(alice).startAction(playerId, queuedAction, false);

    await ethers.provider.send("evm_increaseTime", [queuedAction.timespan / 2]);
    await players.connect(alice).consumeActions(playerId);
    expect(await players.skillPoints(playerId, Skill.WOODCUTTING)).to.eq(queuedAction.timespan / 2);
    // Check the drops are as expected
    expect(await itemNFT.balanceOf(alice.address, LOG)).to.eq(
      Math.floor(((queuedAction.timespan / 2) * rate) / (3600 * 100))
    );
  });

  it("Skill points, max range", async () => {
    const {playerId, players, itemNFT, world, alice, maxTime} = await loadFixture(deployContracts);

    const combatStats: CombatStats = {
      attack: 2,
      magic: 0,
      range: 0,
      meleeDefence: -1,
      magicDefence: 0,
      rangeDefence: 0,
      health: 12,
    };
    await itemNFT.addItem({
      ...inputItem,
      tokenId: BRONZE_GAUNTLETS,
      combatStats,
      equipPosition: EquipPosition.ARMS,
      metadataURI: "someIPFSURI.json",
    });
    await itemNFT.testOnlyMint(alice.address, BRONZE_SWORD, 1);
    await itemNFT.testOnlyMint(alice.address, BRONZE_GAUNTLETS, 1);

    await itemNFT.addItem({
      ...inputItem,
      tokenId: BRONZE_SWORD,
      combatStats,
      equipPosition: EquipPosition.RIGHT_HAND,
      metadataURI: "someIPFSURI.json",
    });

    await world.addAction({
      info: {
        skill: Skill.ATTACK,
        baseXPPerHour: 3600,
        minSkillPoints: 0,
        isDynamic: false,
        itemTokenIdRangeMin: COMBAT_BASE,
        itemTokenIdRangeMax: COMBAT_MAX,
        isAvailable: actionIsAvailable,
        isCombat: false,
      },
      guaranteedRewards: [],
      randomRewards: [],
      combatStats: emptyStats,
    });

    const queuedAction: QueuedAction = {
      attire: {...noAttire, gauntlets: BRONZE_GAUNTLETS},
      actionId: 1,
      skill: Skill.ATTACK,
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

    await players.connect(alice).startAction(playerId, queuedAction, false);

    await ethers.provider.send("evm_increaseTime", [queuedAction.timespan + 2]);
    await players.connect(alice).consumeActions(playerId);
    expect(await players.skillPoints(playerId, Skill.ATTACK)).to.eq(queuedAction.timespan);
  });

  it("Multi-skill points", async () => {
    // TODO:
  });

  // TODO: Check attire stats are as expected

  /*  it("Check already equipped", async () => {
    const {playerId, players, playerNFT, itemNFT, alice} = await loadFixture(deployContracts);
    await itemNFT.testOnlyMint(alice.address, BRONZE_GAUNTLETS, 1);
    expect(await itemNFT.balanceOf(alice.address, BRONZE_GAUNTLETS)).to.eq(1);

    const combatStats: CombatStats = {
      attack: 2,
      magic: 0,
      range: 0,
      meleeDefence: -1,
      magicDefence: 0,
      rangeDefence: 0,
      health: 12,
    };

    await itemNFT.addItem({
      ...inputItem,
      tokenId: BRONZE_GAUNTLETS,
      combatStats,
      equipPosition: EquipPosition.ARMS,
      metadataURI: "someIPFSURI.json",
    });

    // Check bonuses before
    const beforeStats = (await players.players(playerId)).totalStats;
    expect(beforeStats.attack).to.eq(0);
    expect(beforeStats.range).to.eq(0);
    expect(beforeStats.magic).to.eq(0);
    expect(beforeStats.meleeDefence).to.eq(0);
    expect(beforeStats.rangeDefence).to.eq(0);
    expect(beforeStats.magicDefence).to.eq(0);
    expect(beforeStats.health).to.eq(0);

    await players.connect(alice).equip(playerId, BRONZE_GAUNTLETS);

    // Check bonuses after
    const afterStats = (await players.players(playerId)).totalStats;
    expect(afterStats.attack).to.eq(2);
    expect(afterStats.range).to.eq(0);
    expect(afterStats.magic).to.eq(0);
    expect(afterStats.meleeDefence).to.eq(-1);
    expect(afterStats.rangeDefence).to.eq(0);
    expect(afterStats.magicDefence).to.eq(0);
    expect(afterStats.health).to.eq(12);

    expect((await players.players(playerId)).attire.gauntlets).to.eq(BRONZE_GAUNTLETS);

    // Try equip it on someone else, should fail as we don't have enough
    const avatarId = 1;
    const avatarInfo = {
      name: ethers.utils.formatBytes32String("Name goes here1"),
      description: "Hi I'm a description",
      imageURI: "1234.png",
    };
    await playerNFT.setAvatar(avatarId, avatarInfo);

    const newPlayerId = await createPlayer(playerNFT, avatarId, alice, ethers.utils.formatBytes32String("0xSamWitch"));
    await expect(players.connect(alice).equip(newPlayerId, BRONZE_GAUNTLETS)).to.be.reverted; // Not active player

    // Mint another one and try again, first trying to connect same item to the same player
    await players.connect(alice).setActivePlayer(newPlayerId);
    await players.connect(alice).equip(newPlayerId, BRONZE_GAUNTLETS);

    expect((await players.players(playerId)).attire.gauntlets).to.eq(NONE);
    expect((await players.players(newPlayerId)).attire.gauntlets).to.eq(BRONZE_GAUNTLETS);
  }); */

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
      const {playerId, players, itemNFT, world, alice} = await loadFixture(deployContracts);

      const rate = 100 * 100; // per hour
      const tx = await world.addAction({
        info: {
          skill: Skill.WOODCUTTING,
          baseXPPerHour: 3600,
          minSkillPoints: 0,
          isDynamic: false,
          itemTokenIdRangeMin: BRONZE_AXE,
          itemTokenIdRangeMax: WOODCUTTING_MAX,
          isAvailable: actionIsAvailable,
          isCombat: false,
        },
        guaranteedRewards: [{itemTokenId: LOG, rate}],
        randomRewards: [],
        combatStats: emptyStats,
      });
      const actionId = await getActionId(tx);

      await itemNFT.testOnlyMint(alice.address, BRONZE_AXE, 1);
      const timespan = 3600;
      const queuedAction: QueuedAction = {
        attire: noAttire,
        actionId,
        skill: Skill.WOODCUTTING,
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

      await itemNFT.addItem({
        ...inputItem,
        tokenId: BRONZE_AXE,
        equipPosition: EquipPosition.RIGHT_HAND,
        metadataURI: "someIPFSURI.json",
      });

      await players.connect(alice).startAction(playerId, queuedAction, false);

      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan + 2]);
      await players.connect(alice).consumeActions(playerId);
      expect(await players.skillPoints(playerId, Skill.WOODCUTTING)).to.eq(queuedAction.timespan);
      // Check the drops are as expected
      expect(await itemNFT.balanceOf(alice.address, LOG)).to.eq(Math.floor((timespan * rate) / (3600 * 100)));
    });

    it("Firemaking", async () => {
      const {playerId, players, itemNFT, world, alice} = await loadFixture(deployContracts);
      const rate = 100 * 100; // per hour
      let tx = await world.addAction({
        info: {
          skill: Skill.FIREMAKING,
          baseXPPerHour: 0,
          minSkillPoints: 0,
          isDynamic: false,
          itemTokenIdRangeMin: FIRE_LIGHTER,
          itemTokenIdRangeMax: FIRE_MAX,
          isAvailable: actionIsAvailable,
          isCombat: false,
        },
        guaranteedRewards: [],
        randomRewards: [],
        combatStats: emptyStats,
      });
      const actionId = await getActionId(tx);

      // Logs go in, nothing comes out
      tx = await world.addActionChoice(actionId, {
        skill: Skill.FIREMAKING,
        diff: 0,
        baseXPPerHour: 3600,
        minSkillPoints: 0,
        rate,
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
        attire: noAttire,
        actionId,
        skill: Skill.FIREMAKING,
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

      await itemNFT.addItem({
        ...inputItem,
        tokenId: FIRE_LIGHTER,
        equipPosition: EquipPosition.RIGHT_HAND,
        metadataURI: "someIPFSURI.json",
      });

      await itemNFT.addItem({
        ...inputItem,
        tokenId: LOG,
        equipPosition: EquipPosition.AUX,
        metadataURI: "someIPFSURI.json",
      });

      await itemNFT.testOnlyMint(alice.address, LOG, 5); // Mint less than will be used

      await players.connect(alice).startAction(playerId, queuedAction, false);

      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan + 2]);
      await players.connect(alice).consumeActions(playerId);
      expect(await players.skillPoints(playerId, Skill.FIREMAKING)).to.eq(queuedAction.timespan);

      // Check how many logs they have now, 100 logs burnt per hour
      expect(await itemNFT.balanceOf(alice.address, LOG)).to.eq(0);
    });

    it("Multi skill appending, woodcutting + firemaking", async () => {
      const {playerId, players, itemNFT, world, alice} = await loadFixture(deployContracts);
      const queuedActions: QueuedAction[] = [];
      const rate = 1220 * 100; // per hour
      {
        const tx = await world.addAction({
          info: {
            skill: Skill.WOODCUTTING,
            baseXPPerHour: 3600,
            minSkillPoints: 0,
            isDynamic: false,
            itemTokenIdRangeMin: BRONZE_AXE,
            itemTokenIdRangeMax: WOODCUTTING_MAX,
            isAvailable: actionIsAvailable,
            isCombat: false,
          },
          guaranteedRewards: [{itemTokenId: LOG, rate}],
          randomRewards: [],
          combatStats: emptyStats,
        });
        const actionId = await getActionId(tx);
        await itemNFT.testOnlyMint(alice.address, BRONZE_AXE, 1);
        await itemNFT.addItem({
          ...inputItem,
          tokenId: BRONZE_AXE,
          equipPosition: EquipPosition.RIGHT_HAND,
          metadataURI: "someIPFSURI.json",
        });
        const timespan = 7200 + 10;
        const queuedAction: QueuedAction = {
          attire: noAttire,
          actionId,
          skill: Skill.WOODCUTTING,
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
            isAvailable: actionIsAvailable,
            isCombat: false,
          },
          guaranteedRewards: [],
          randomRewards: [],
          combatStats: emptyStats,
        });
        const actionId = await getActionId(tx);

        // Logs go in, nothing comes out
        tx = await world.addActionChoice(actionId, {
          skill: Skill.FIREMAKING,
          diff: 0,
          baseXPPerHour: 3600,
          minSkillPoints: 0,
          rate,
          inputTokenId1: LOG,
          num1: 1,
          inputTokenId2: NONE,
          num2: 0,
          inputTokenId3: NONE,
          num3: 0,
          outputTokenId: NONE,
        });
        const choiceId = await getActionChoiceId(tx);

        await itemNFT.testOnlyMint(alice.address, FIRE_LIGHTER, 1);
        await itemNFT.addItem({
          ...inputItem,
          tokenId: FIRE_LIGHTER,
          equipPosition: EquipPosition.RIGHT_HAND,
          metadataURI: "someIPFSURI.json",
        });
        const timespan = 3600;

        const queuedAction: QueuedAction = {
          attire: noAttire,
          actionId,
          skill: Skill.FIREMAKING,
          choiceId,
          num: 1000,
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

      await itemNFT.addItem({
        ...inputItem,
        tokenId: LOG,
        equipPosition: EquipPosition.AUX,
        metadataURI: "someIPFSURI.json",
      });

      await players.connect(alice).startAction(playerId, queuedActions[0], true);
      await ethers.provider.send("evm_increaseTime", [10]);
      await players.connect(alice).startAction(playerId, queuedActions[1], true);
      expect(await players.skillPoints(playerId, Skill.WOODCUTTING)).to.eq(10); // Should be partially completed
      expect(await itemNFT.balanceOf(alice.address, LOG)).to.eq(3);
      await ethers.provider.send("evm_increaseTime", [queuedActions[0].timespan + queuedActions[1].timespan]);
      expect(await players.actionQueueLength(playerId)).to.eq(2);

      await players.connect(alice).consumeActions(playerId);
      expect(await players.skillPoints(playerId, Skill.WOODCUTTING)).to.eq(queuedActions[0].timespan);
      expect(await players.skillPoints(playerId, Skill.FIREMAKING)).to.eq(queuedActions[1].timespan);
      // Check how many logs they have now, 100 logs burnt per hour, 2 hours producing logs, 1 hour burning
      expect(await itemNFT.balanceOf(alice.address, LOG)).to.eq(
        Math.floor((queuedActions[0].timespan * rate) / (3600 * 100)) - 1000
      );
      // Action queue should be empty
      expect(await players.actionQueueLength(playerId)).to.eq(0);
    });

    it("Multi skill, woodcutting + firemaking", async () => {
      const {playerId, players, itemNFT, world, alice} = await loadFixture(deployContracts);
      const queuedActions: QueuedAction[] = [];
      const rate = 100 * 100; // per hour
      {
        const tx = await world.addAction({
          info: {
            skill: Skill.WOODCUTTING,
            baseXPPerHour: 3600,
            minSkillPoints: 0,
            isDynamic: false,
            itemTokenIdRangeMin: BRONZE_AXE,
            itemTokenIdRangeMax: WOODCUTTING_MAX,
            isAvailable: actionIsAvailable,
            isCombat: false,
          },
          guaranteedRewards: [{itemTokenId: LOG, rate}],
          randomRewards: [],
          combatStats: emptyStats,
        });
        const actionId = await getActionId(tx);
        await itemNFT.testOnlyMint(alice.address, BRONZE_AXE, 1);
        await itemNFT.addItem({
          ...inputItem,
          tokenId: BRONZE_AXE,
          equipPosition: EquipPosition.RIGHT_HAND,
          metadataURI: "someIPFSURI.json",
        });
        const timespan = 7200;
        const queuedAction: QueuedAction = {
          attire: noAttire,
          actionId,
          skill: Skill.WOODCUTTING,
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
            isAvailable: actionIsAvailable,
            isCombat: false,
          },
          guaranteedRewards: [],
          randomRewards: [],
          combatStats: emptyStats,
        });
        const actionId = await getActionId(tx);

        // Logs go in, nothing comes out
        tx = await world.addActionChoice(actionId, {
          skill: Skill.FIREMAKING,
          diff: 0,
          baseXPPerHour: 3600,
          minSkillPoints: 0,
          rate,
          inputTokenId1: LOG,
          num1: 1,
          inputTokenId2: NONE,
          num2: 0,
          inputTokenId3: NONE,
          num3: 0,
          outputTokenId: NONE,
        });
        const choiceId = await getActionChoiceId(tx);

        await itemNFT.testOnlyMint(alice.address, FIRE_LIGHTER, 1);
        await itemNFT.addItem({
          ...inputItem,
          tokenId: FIRE_LIGHTER,
          equipPosition: EquipPosition.RIGHT_HAND,
          metadataURI: "someIPFSURI.json",
        });
        const timespan = 3600;

        const queuedAction: QueuedAction = {
          attire: noAttire,
          actionId,
          skill: Skill.FIREMAKING,
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

      await itemNFT.addItem({
        ...inputItem,
        tokenId: LOG,
        equipPosition: EquipPosition.AUX,
        metadataURI: "someIPFSURI.json",
      });

      // This should fail because they don't have any logs. (Maybe later this detects from previous actions)
      await expect(players.connect(alice).startActions(playerId, queuedActions, false)).to.be.reverted;

      await itemNFT.testOnlyMint(alice.address, LOG, 1);
      await players.connect(alice).startActions(playerId, queuedActions, false);

      await ethers.provider.send("evm_increaseTime", [queuedActions[0].timespan + queuedActions[1].timespan + 2]);
      await players.connect(alice).consumeActions(playerId);
      expect(await players.skillPoints(playerId, Skill.WOODCUTTING)).to.eq(queuedActions[0].timespan);
      expect(await players.skillPoints(playerId, Skill.FIREMAKING)).to.eq(queuedActions[1].timespan);
      // Check how many logs they have now, 100 logs burnt per hour, 2 hours producing logs, 1 hour burning
      expect(await itemNFT.balanceOf(alice.address, LOG)).to.eq(
        Math.floor((queuedActions[0].timespan * rate) / (3600 * 100)) -
          Math.floor((queuedActions[1].timespan * rate) / (3600 * 100)) +
          1
      );
      expect(await players.actionQueueLength(playerId)).to.eq(0);
    });

    it("Mining", async () => {
      const {playerId, players, itemNFT, world, alice} = await loadFixture(deployContracts);

      const tx = await world.addAction({
        info: {
          skill: Skill.MINING,
          baseXPPerHour: 3600,
          minSkillPoints: 0,
          isDynamic: false,
          itemTokenIdRangeMin: BRONZE_PICKAXE,
          itemTokenIdRangeMax: MINING_MAX,
          isAvailable: actionIsAvailable,
          isCombat: false,
        },
        guaranteedRewards: [{itemTokenId: COPPER_ORE, rate: 100}], // 100.00
        randomRewards: [],
        combatStats: emptyStats,
      });

      const actionId = await getActionId(tx);

      await itemNFT.testOnlyMint(alice.address, BRONZE_PICKAXE, 1);
      const queuedAction: QueuedAction = {
        attire: noAttire,
        actionId,
        skill: Skill.MINING,
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

      await itemNFT.addItem({
        ...inputItem,
        tokenId: BRONZE_PICKAXE,
        equipPosition: EquipPosition.RIGHT_HAND,
        metadataURI: "someIPFSURI.json",
      });

      await players.connect(alice).startAction(playerId, queuedAction, false);

      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan + 2]);
      await players.connect(alice).consumeActions(playerId);
      expect(await players.skillPoints(playerId, Skill.MINING)).to.eq(queuedAction.timespan);
    });

    it("Smithing", async () => {
      const {playerId, players, itemNFT, world, alice} = await loadFixture(deployContracts);
      const rate = 100 * 100; // per hour

      let tx = await world.addAction({
        info: {
          skill: Skill.SMITHING,
          baseXPPerHour: 0,
          minSkillPoints: 0,
          isDynamic: false,
          itemTokenIdRangeMin: NONE,
          itemTokenIdRangeMax: NONE,
          isAvailable: actionIsAvailable,
          isCombat: false,
        },
        guaranteedRewards: [],
        randomRewards: [],
        combatStats: emptyStats,
      });
      const actionId = await getActionId(tx);

      // Ores go in, bars come out
      tx = await world.addActionChoice(actionId, {
        skill: Skill.SMITHING,
        diff: 0,
        baseXPPerHour: 3600,
        minSkillPoints: 0,
        rate,
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
        attire: noAttire,
        actionId,
        skill: Skill.SMITHING,
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

      await itemNFT.addItem({
        ...inputItem,
        tokenId: COAL_ORE,
        equipPosition: EquipPosition.AUX,
        metadataURI: "someIPFSURI.json",
      });

      await itemNFT.addItem({
        ...inputItem,
        tokenId: MITHRIL_ORE,
        equipPosition: EquipPosition.AUX,
        metadataURI: "someIPFSURI.json",
      });

      await itemNFT.testOnlyMint(alice.address, COAL_ORE, 255);
      await itemNFT.testOnlyMint(alice.address, MITHRIL_ORE, 255);
      await players.connect(alice).startAction(playerId, queuedAction, false);

      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan + 2]);
      await players.connect(alice).consumeActions(playerId);
      expect(await players.skillPoints(playerId, Skill.SMITHING)).to.eq(queuedAction.timespan);

      // Check how many bars they have now, 100 bars created per hour, burns 2 coal and 1 mithril
      expect(await itemNFT.balanceOf(alice.address, MITHRIL_BAR)).to.eq(Math.floor((timespan * rate) / (3600 * 100)));
      expect(await itemNFT.balanceOf(alice.address, COAL_ORE)).to.eq(
        255 - Math.floor((timespan * rate) / (3600 * 100)) * 2
      );
      expect(await itemNFT.balanceOf(alice.address, MITHRIL_ORE)).to.eq(
        255 - Math.floor((timespan * rate) / (3600 * 100))
      );
    });

    it("Max timespan ", async () => {
      const {playerId, players, itemNFT, world, alice} = await loadFixture(deployContracts);

      const rate = 100 * 100; // per hour
      const tx = await world.addAction({
        info: {
          skill: Skill.WOODCUTTING,
          baseXPPerHour: 3600,
          minSkillPoints: 0,
          isDynamic: false,
          itemTokenIdRangeMin: BRONZE_AXE,
          itemTokenIdRangeMax: WOODCUTTING_MAX,
          isAvailable: actionIsAvailable,
          isCombat: false,
        },
        guaranteedRewards: [{itemTokenId: LOG, rate}],
        randomRewards: [],
        combatStats: emptyStats,
      });
      const actionId = await getActionId(tx);

      await itemNFT.testOnlyMint(alice.address, BRONZE_AXE, 1);
      const timespan = 3600 * 24 + 1; // Exceed maximum
      const queuedAction: QueuedAction = {
        attire: noAttire,
        actionId,
        skill: Skill.WOODCUTTING,
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

      await itemNFT.addItem({
        ...inputItem,
        tokenId: BRONZE_AXE,
        equipPosition: EquipPosition.RIGHT_HAND,
        metadataURI: "someIPFSURI.json",
      });

      await expect(players.connect(alice).startAction(playerId, queuedAction, false)).to.be.reverted;
      queuedAction.timespan -= 1; // Set to the maximum
      await players.connect(alice).startAction(playerId, queuedAction, false);

      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan + 2]);
      await players.connect(alice).consumeActions(playerId);
      expect(await players.skillPoints(playerId, Skill.WOODCUTTING)).to.eq(queuedAction.timespan);
      // Check the drops are as expected
      expect(await itemNFT.balanceOf(alice.address, LOG)).to.eq(Math.floor((timespan * rate) / (3600 * 100)));
    });

    // TODO Rest of the actions

    it("Low rate action (more than 1 hour needed)", async () => {
      const {playerId, players, itemNFT, world, alice} = await loadFixture(deployContracts);
      await itemNFT.addItem({
        ...inputItem,
        tokenId: BRONZE_AXE,
        equipPosition: EquipPosition.RIGHT_HAND,
        metadataURI: "someIPFSURI.json",
      });
      await itemNFT.testOnlyMint(alice.address, BRONZE_AXE, 1);

      const rate = 0.1 * 100; // 0.1 per hour
      const tx = await world.addAction({
        info: {
          skill: Skill.WOODCUTTING,
          baseXPPerHour: 3600,
          minSkillPoints: 0,
          isDynamic: false,
          itemTokenIdRangeMin: WOODCUTTING_BASE,
          itemTokenIdRangeMax: WOODCUTTING_MAX,
          isAvailable: actionIsAvailable,
          isCombat: true,
        },
        guaranteedRewards: [{itemTokenId: LOG, rate}],
        randomRewards: [],
        combatStats: emptyStats,
      });

      const actionId = await getActionId(tx);
      const timespan = 3600 * 19; // Should make 1
      const queuedAction: QueuedAction = {
        attire: noAttire,
        actionId,
        skill: Skill.WOODCUTTING,
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

      await players.connect(alice).startAction(playerId, queuedAction, false);
      await ethers.provider.send("evm_increaseTime", [timespan]);
      await players.connect(alice).consumeActions(playerId);
      //      expect(await players.skillPoints(playerId, Skill.WOODCUTTING)).to.be.oneOf([361, 362]);
      expect(await itemNFT.balanceOf(alice.address, LOG)).to.eq(1); // Should be rounded down
    });

    it("Action pipelining", async () => {
      // Try wood cut, and then burning them when having none equipped
    });
  });

  describe("Combat Actions", () => {
    it("Melee", async () => {
      const {playerId, players, itemNFT, world, alice} = await loadFixture(deployContracts);

      const monsterCombatStats: CombatStats = {
        attack: 3,
        magic: 0,
        range: 0,
        meleeDefence: 0,
        magicDefence: 0,
        rangeDefence: 0,
        health: 0,
      };

      const rate = 1 * 100; // per hour
      let tx = await world.addAction({
        info: {
          skill: Skill.COMBAT,
          baseXPPerHour: 3600,
          minSkillPoints: 0,
          isDynamic: false,
          itemTokenIdRangeMin: COMBAT_BASE,
          itemTokenIdRangeMax: COMBAT_MAX,
          isAvailable: actionIsAvailable,
          isCombat: true,
        },
        guaranteedRewards: [{itemTokenId: BRONZE_ARROW, rate}],
        randomRewards: [],
        combatStats: monsterCombatStats,
      });
      const actionId = await getActionId(tx);

      await itemNFT.testOnlyMint(alice.address, BRONZE_SWORD, 1);
      await itemNFT.testOnlyMint(alice.address, COOKED_HUPPY, 255);
      const timespan = 3600;
      const queuedAction: QueuedAction = {
        attire: noAttire,
        actionId,
        skill: Skill.ATTACK,
        choiceId: NONE,
        num: 0,
        choiceId1: NONE,
        num1: 0,
        choiceId2: NONE,
        num2: 0,
        regenerateId: COOKED_HUPPY,
        numRegenerate: 255,
        timespan,
        rightArmEquipmentTokenId: BRONZE_SWORD,
        leftArmEquipmentTokenId: NONE,
        startTime: "0",
      };

      await itemNFT.addItem({
        ...inputItem,
        tokenId: BRONZE_SWORD,
        equipPosition: EquipPosition.RIGHT_HAND,
        metadataURI: "someIPFSURI.json",
      });

      await itemNFT.addItem({
        ...inputItem,
        tokenId: BRONZE_ARROW,
        equipPosition: EquipPosition.AUX,
        metadataURI: "someIPFSURI.json",
      });

      await itemNFT.addItem({
        ...inputItem,
        tokenId: COOKED_HUPPY,
        equipPosition: EquipPosition.AUX, // FOOD
        metadataURI: "someIPFSURI.json",
      });

      await players.connect(alice).startAction(playerId, queuedAction, false);

      const time = 361;
      await ethers.provider.send("evm_increaseTime", [time]);
      await players.connect(alice).consumeActions(playerId);
      expect(await players.skillPoints(playerId, Skill.ATTACK)).to.be.oneOf([time, time + 1]);
      expect(await players.skillPoints(playerId, Skill.DEFENCE)).to.eq(0);

      // Check the drops are as expected
      expect(await itemNFT.balanceOf(alice.address, BRONZE_ARROW)).to.eq(Math.floor((time * rate) / (3600 * 100)));

      // Check food is consumed, update later
      expect(await itemNFT.balanceOf(alice.address, COOKED_HUPPY)).to.eq(255 - 1);
    });

    it("Drop rewards", async () => {});

    it("Loot chance", async () => {});

    it("Dead", async () => {
      // Lose all the XP that would have been gained
      const {playerId, players, itemNFT, world, alice} = await loadFixture(deployContracts);

      const monsterCombatStats: CombatStats = {
        attack: 3,
        magic: 0,
        range: 0,
        meleeDefence: 0,
        magicDefence: 0,
        rangeDefence: 0,
        health: 0,
      };

      const rate = 1 * 100; // per hour
      let tx = await world.addAction({
        info: {
          skill: Skill.COMBAT,
          baseXPPerHour: 3600,
          minSkillPoints: 0,
          isDynamic: false,
          itemTokenIdRangeMin: COMBAT_BASE,
          itemTokenIdRangeMax: COMBAT_MAX,
          isAvailable: actionIsAvailable,
          isCombat: true,
        },
        guaranteedRewards: [{itemTokenId: BRONZE_ARROW, rate}],
        randomRewards: [],
        combatStats: monsterCombatStats,
      });
      const actionId = await getActionId(tx);

      await itemNFT.testOnlyMint(alice.address, BRONZE_SWORD, 1);
      await itemNFT.testOnlyMint(alice.address, COOKED_HUPPY, 2);
      const timespan = 3600 * 3; // 3 hours
      const queuedAction: QueuedAction = {
        attire: noAttire,
        actionId,
        skill: Skill.ATTACK,
        choiceId: NONE,
        num: 0,
        choiceId1: NONE,
        num1: 0,
        choiceId2: NONE,
        num2: 0,
        regenerateId: COOKED_HUPPY,
        numRegenerate: 2,
        timespan,
        rightArmEquipmentTokenId: BRONZE_SWORD,
        leftArmEquipmentTokenId: NONE,
        startTime: "0",
      };

      await itemNFT.addItem({
        ...inputItem,
        tokenId: BRONZE_SWORD,
        equipPosition: EquipPosition.RIGHT_HAND,
        metadataURI: "someIPFSURI.json",
      });

      await itemNFT.addItem({
        ...inputItem,
        tokenId: BRONZE_ARROW,
        equipPosition: EquipPosition.AUX,
        metadataURI: "someIPFSURI.json",
      });

      await itemNFT.addItem({
        ...inputItem,
        tokenId: COOKED_HUPPY,
        equipPosition: EquipPosition.AUX, // FOOD
        metadataURI: "someIPFSURI.json",
      });

      await players.connect(alice).startAction(playerId, queuedAction, false);

      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]);
      await players.connect(alice).consumeActions(playerId);
      // Should die so doesn't get any attack skill points, and food should be consumed
      expect(await players.skillPoints(playerId, Skill.ATTACK)).to.eq(0);
      expect(await itemNFT.balanceOf(alice.address, BRONZE_ARROW)).to.eq(0);
      expect(await itemNFT.balanceOf(alice.address, COOKED_HUPPY)).to.eq(0);
    });

    it("Magic", async () => {
      const {playerId, players, itemNFT, world, alice} = await loadFixture(deployContracts);

      const monsterCombatStats: CombatStats = {
        attack: 3,
        magic: 0,
        range: 0,
        meleeDefence: 0,
        magicDefence: 0,
        rangeDefence: 0,
        health: 0,
      };

      const dropRate = 1 * 100; // per hour
      let tx = await world.addAction({
        info: {
          skill: Skill.COMBAT,
          baseXPPerHour: 3600,
          minSkillPoints: 0,
          isDynamic: false,
          itemTokenIdRangeMin: COMBAT_BASE,
          itemTokenIdRangeMax: COMBAT_MAX,
          isAvailable: actionIsAvailable,
          isCombat: true,
        },
        guaranteedRewards: [{itemTokenId: BRONZE_ARROW, rate: dropRate}],
        randomRewards: [],
        combatStats: monsterCombatStats,
      });
      const actionId = await getActionId(tx);

      await itemNFT.testOnlyMints(alice.address, [STAFF, COOKED_HUPPY, AIR_SCROLL, FIRE_SCROLL], [1, 255, 200, 100]);

      const scrollsConsumedRate = 1 * 100; // per hour
      // Combat uses none as it's not tied to a specific action (only combat ones)
      // Fire blast
      tx = await world.addActionChoice(NONE, {
        skill: Skill.MAGIC,
        diff: 0,
        baseXPPerHour: 0,
        minSkillPoints: 0,
        rate: scrollsConsumedRate,
        inputTokenId1: AIR_SCROLL,
        num1: 2,
        inputTokenId2: FIRE_SCROLL,
        num2: 1,
        inputTokenId3: NONE,
        num3: 0,
        outputTokenId: NONE,
      });
      const choiceId = await getActionChoiceId(tx);
      const timespan = 3600;
      const queuedAction: QueuedAction = {
        attire: noAttire,
        actionId,
        skill: Skill.MAGIC,
        choiceId,
        num: 100,
        choiceId1: NONE,
        num1: 0,
        choiceId2: NONE,
        num2: 0,
        regenerateId: COOKED_HUPPY,
        numRegenerate: 255,
        timespan,
        rightArmEquipmentTokenId: STAFF,
        leftArmEquipmentTokenId: NONE,
        startTime: "0",
      };

      await itemNFT.addItems([
        {
          ...inputItem,
          tokenId: AIR_SCROLL,
          equipPosition: EquipPosition.AUX,
          metadataURI: "someIPFSURI.json",
        },
        {
          ...inputItem,
          tokenId: FIRE_SCROLL,
          equipPosition: EquipPosition.AUX,
          metadataURI: "someIPFSURI.json",
        },
        {
          ...inputItem,
          tokenId: STAFF,
          equipPosition: EquipPosition.RIGHT_HAND,
          metadataURI: "someIPFSURI.json",
        },
        {
          ...inputItem,
          tokenId: BRONZE_ARROW,
          equipPosition: EquipPosition.AUX,
          metadataURI: "someIPFSURI.json",
        },
        {
          ...inputItem,
          tokenId: COOKED_HUPPY,
          equipPosition: EquipPosition.AUX, // FOOD
          metadataURI: "someIPFSURI.json",
        },
      ]);

      await players.connect(alice).startAction(playerId, queuedAction, false);

      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]);
      await players.connect(alice).consumeActions(playerId);
      expect(await players.skillPoints(playerId, Skill.MAGIC)).to.eq(queuedAction.timespan);
      expect(await players.skillPoints(playerId, Skill.DEFENCE)).to.eq(0);

      // Check the drops are as expected
      expect(await itemNFT.balanceOf(alice.address, BRONZE_ARROW)).to.eq(
        Math.floor((timespan * dropRate) / (3600 * 100))
      );

      // Check food is consumed, update later
      expect(await itemNFT.balanceOf(alice.address, COOKED_HUPPY)).to.eq(255 - 1);

      // Check that scrolls are consumed
      expect(await itemNFT.balanceOf(alice.address, AIR_SCROLL)).to.eq(200 - 2);
      expect(await itemNFT.balanceOf(alice.address, FIRE_SCROLL)).to.eq(100 - 1);
    });
  });

  /*
  it("uri", async () => {
  }); */
});
