import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {EstforTypes, EstforConstants} from "@paintswap/estfor-definitions";
import {Attire, BoostType, Skill} from "@paintswap/estfor-definitions/types";
import {expect} from "chai";
import {ethers} from "hardhat";
import {AvatarInfo, createPlayer, emptyActionChoice, getActionChoiceId, getActionId} from "../../scripts/utils";
import {playersFixture} from "./PlayersFixture";
import {getXPFromLevel, setupBasicWoodcutting} from "./utils";

const actionIsAvailable = true;

describe("Players", () => {
  it("New player stats", async () => {
    const {players, playerNFT, alice} = await loadFixture(playersFixture);

    const avatarId = 2;
    const avatarInfo: AvatarInfo = {
      name: ethers.utils.formatBytes32String("Name goes here"),
      description: "Hi I'm a description",
      imageURI: "1234.png",
      startSkills: [Skill.FIREMAKING, Skill.NONE],
    };
    await playerNFT.setAvatar(avatarId, avatarInfo);
    const playerId = await createPlayer(playerNFT, avatarId, alice, ethers.utils.formatBytes32String("Name"), true);

    const startXP = await players.startXP();
    expect(startXP).to.be.gt(0);
    expect(await players.xp(playerId, Skill.FIREMAKING)).to.eq(startXP);

    avatarInfo.startSkills = [Skill.FIREMAKING, Skill.HEALTH];

    await playerNFT.setAvatar(avatarId, avatarInfo);
    const newPlayerId = await createPlayer(
      playerNFT,
      avatarId,
      alice,
      ethers.utils.formatBytes32String("New name"),
      true
    );
    expect(await players.xp(newPlayerId, Skill.FIREMAKING)).to.eq(startXP.div(2));
    expect(await players.xp(newPlayerId, Skill.HEALTH)).to.eq(startXP.div(2));

    expect((await players.players(newPlayerId)).totalXP).to.eq(startXP);
    expect((await players.players(newPlayerId)).health).to.eq(3);
    expect((await players.players(newPlayerId)).melee).to.eq(1);
    expect((await players.players(newPlayerId)).range).to.eq(1);
    expect((await players.players(newPlayerId)).magic).to.eq(1);
    expect((await players.players(newPlayerId)).defence).to.eq(1);
  });

  it("Skill points", async () => {
    const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);

    await itemNFT.addItem({
      ...EstforTypes.defaultInputItem,
      tokenId: EstforConstants.BRONZE_AXE,
      equipPosition: EstforTypes.EquipPosition.RIGHT_HAND,
      metadataURI: "someIPFSURI.json",
    });

    const rate = 100 * 10; // per hour
    const tx = await world.addAction({
      actionId: 1,
      info: {
        skill: EstforTypes.Skill.WOODCUTTING,
        xpPerHour: 3600,
        minXP: 0,
        isDynamic: false,
        numSpawn: 0,
        handItemTokenIdRangeMin: EstforConstants.WOODCUTTING_BASE,
        handItemTokenIdRangeMax: EstforConstants.WOODCUTTING_MAX,
        isAvailable: actionIsAvailable,
        actionChoiceRequired: false,
        successPercent: 100,
      },
      guaranteedRewards: [{itemTokenId: EstforConstants.LOG, rate}],
      randomRewards: [],
      combatStats: EstforTypes.emptyCombatStats,
    });

    const actionId = await getActionId(tx);
    const queuedAction: EstforTypes.QueuedActionInput = {
      attire: EstforTypes.noAttire,
      actionId,
      combatStyle: EstforTypes.CombatStyle.NONE,
      choiceId: EstforConstants.NONE,
      choiceId1: EstforConstants.NONE,
      choiceId2: EstforConstants.NONE,
      regenerateId: EstforConstants.NONE,
      timespan: 3600,
      rightHandEquipmentTokenId: EstforConstants.BRONZE_AXE,
      leftHandEquipmentTokenId: EstforConstants.NONE,
      skill: EstforTypes.Skill.WOODCUTTING,
    };

    await players.connect(alice).startAction(playerId, queuedAction, EstforTypes.ActionQueueStatus.NONE);
    await ethers.provider.send("evm_increaseTime", [361]);
    await players.connect(alice).processActions(playerId);
    expect(await players.xp(playerId, EstforTypes.Skill.WOODCUTTING)).to.be.oneOf([361, 362]);
    expect(await itemNFT.balanceOf(alice.address, EstforConstants.LOG)).to.eq(10); // Should be rounded down
  });

  it("Skill points (many)", async () => {
    const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);

    await itemNFT.addItem({
      ...EstforTypes.defaultInputItem,
      tokenId: EstforConstants.BRONZE_AXE,
      equipPosition: EstforTypes.EquipPosition.RIGHT_HAND,
      metadataURI: "someIPFSURI.json",
    });

    const rate = 100 * 10; // per hour
    const tx = await world.addAction({
      actionId: 1,
      info: {
        skill: EstforTypes.Skill.WOODCUTTING,
        xpPerHour: 3600,
        minXP: 0,
        isDynamic: false,
        numSpawn: 0,
        handItemTokenIdRangeMin: EstforConstants.WOODCUTTING_BASE,
        handItemTokenIdRangeMax: EstforConstants.WOODCUTTING_MAX,
        isAvailable: actionIsAvailable,
        actionChoiceRequired: false,
        successPercent: 100,
      },
      guaranteedRewards: [{itemTokenId: EstforConstants.LOG, rate}],
      randomRewards: [],
      combatStats: EstforTypes.emptyCombatStats,
    });

    const actionId = await getActionId(tx);
    const queuedAction: EstforTypes.QueuedActionInput = {
      attire: EstforTypes.noAttire,
      actionId,
      combatStyle: EstforTypes.CombatStyle.NONE,
      choiceId: EstforConstants.NONE,
      choiceId1: EstforConstants.NONE,
      choiceId2: EstforConstants.NONE,
      regenerateId: EstforConstants.NONE,
      timespan: 3600,
      rightHandEquipmentTokenId: EstforConstants.BRONZE_AXE,
      leftHandEquipmentTokenId: EstforConstants.NONE,
      skill: EstforTypes.Skill.WOODCUTTING,
    };

    // start a bunch of actions 1 after each other
    for (let i = 0; i < 50; i++) {
      await players.connect(alice).startAction(playerId, queuedAction, EstforTypes.ActionQueueStatus.APPEND);
      await ethers.provider.send("evm_increaseTime", [7200]);
      await players.connect(alice).processActions(playerId);
      expect(await players.xp(playerId, EstforTypes.Skill.WOODCUTTING)).to.be.eq((i + 1) * 3600);
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.LOG)).to.eq((i + 1) * 100); // Should be rounded down
    }
  });

  it("Speed multiplier", async () => {
    const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);

    const rate = 100 * 10; // per hour
    const tx = await world.addAction({
      actionId: 1,
      info: {
        skill: EstforTypes.Skill.WOODCUTTING,
        xpPerHour: 3600,
        minXP: 0,
        isDynamic: false,
        numSpawn: 0,
        handItemTokenIdRangeMin: EstforConstants.BRONZE_AXE,
        handItemTokenIdRangeMax: EstforConstants.WOODCUTTING_MAX,
        isAvailable: actionIsAvailable,
        actionChoiceRequired: false,
        successPercent: 100,
      },
      guaranteedRewards: [{itemTokenId: EstforConstants.LOG, rate}],
      randomRewards: [],
      combatStats: EstforTypes.emptyCombatStats,
    });
    const actionId = await getActionId(tx);

    const timespan = 3600;
    const queuedAction: EstforTypes.QueuedActionInput = {
      attire: EstforTypes.noAttire,
      actionId,
      combatStyle: EstforTypes.CombatStyle.NONE,
      choiceId: EstforConstants.NONE,
      choiceId1: EstforConstants.NONE,
      choiceId2: EstforConstants.NONE,
      regenerateId: EstforConstants.NONE,
      timespan,
      rightHandEquipmentTokenId: EstforConstants.BRONZE_AXE,
      leftHandEquipmentTokenId: EstforConstants.NONE,
      skill: EstforTypes.Skill.WOODCUTTING,
    };

    await itemNFT.addItem({
      ...EstforTypes.defaultInputItem,
      tokenId: EstforConstants.BRONZE_AXE,
      equipPosition: EstforTypes.EquipPosition.RIGHT_HAND,
      metadataURI: "someIPFSURI.json",
    });

    await players.connect(alice).startAction(playerId, queuedAction, EstforTypes.ActionQueueStatus.NONE);
    await players.connect(alice).setSpeedMultiplier(playerId, 2);

    await ethers.provider.send("evm_increaseTime", [queuedAction.timespan / 2]);
    await players.connect(alice).processActions(playerId);
    expect(await players.xp(playerId, EstforTypes.Skill.WOODCUTTING)).to.eq(queuedAction.timespan);
    // Check the drops are as expected
    expect(await itemNFT.balanceOf(alice.address, EstforConstants.LOG)).to.eq(
      Math.floor((queuedAction.timespan * rate) / (3600 * 10))
    );
    expect(await players.actionQueueLength(playerId)).to.eq(0);
  });

  it("Partial consume aux items", async () => {
    const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);

    const rate = 100 * 10; // per hour
    const tx = await world.addAction({
      actionId: 1,
      info: {
        skill: EstforTypes.Skill.WOODCUTTING,
        xpPerHour: 3600,
        minXP: 0,
        isDynamic: false,
        numSpawn: 0,
        handItemTokenIdRangeMin: EstforConstants.BRONZE_AXE,
        handItemTokenIdRangeMax: EstforConstants.WOODCUTTING_MAX,
        isAvailable: actionIsAvailable,
        actionChoiceRequired: false,
        successPercent: 100,
      },
      guaranteedRewards: [{itemTokenId: EstforConstants.LOG, rate}],
      randomRewards: [],
      combatStats: EstforTypes.emptyCombatStats,
    });
    const actionId = await getActionId(tx);

    const timespan = 3600;
    const queuedAction: EstforTypes.QueuedActionInput = {
      attire: EstforTypes.noAttire,
      actionId,
      combatStyle: EstforTypes.CombatStyle.NONE,
      choiceId: EstforConstants.NONE,
      choiceId1: EstforConstants.NONE,
      choiceId2: EstforConstants.NONE,
      regenerateId: EstforConstants.NONE,
      timespan,
      rightHandEquipmentTokenId: EstforConstants.BRONZE_AXE,
      leftHandEquipmentTokenId: EstforConstants.NONE,
      skill: EstforTypes.Skill.WOODCUTTING,
    };

    await itemNFT.addItem({
      ...EstforTypes.defaultInputItem,
      tokenId: EstforConstants.BRONZE_AXE,
      equipPosition: EstforTypes.EquipPosition.RIGHT_HAND,
      metadataURI: "someIPFSURI.json",
    });

    await players.connect(alice).startAction(playerId, queuedAction, EstforTypes.ActionQueueStatus.NONE);

    await ethers.provider.send("evm_increaseTime", [queuedAction.timespan / 2]);
    await players.connect(alice).processActions(playerId);
    expect(await players.xp(playerId, EstforTypes.Skill.WOODCUTTING)).to.be.oneOf([
      queuedAction.timespan / 2,
      queuedAction.timespan / 2 + 1,
    ]);
    // Check the drops are as expected
    expect(await itemNFT.balanceOf(alice.address, EstforConstants.LOG)).to.eq(
      Math.floor(((queuedAction.timespan / 2) * rate) / (3600 * 10))
    );
  });
  /*
  it("Skill points, max range", async () => {
    const {playerId, players, itemNFT, world, alice, maxTime} = await loadFixture(playersFixture);

    const combatStats: EstforTypes.CombatStats = {
      melee: 2,
      magic: 0,
      range: 0,
      meleeDefence: -1,
      magicDefence: 0,
      rangeDefence: 0,
      health: 12,
    };
    await itemNFT.addItem({
      ...EstforTypes.defaultInputItem,
      tokenId: BRONZE_GAUNTLETS,
      combatStats,
      equipPosition: EstforTypes.EquipPosition.ARMS,
      metadataURI: "someIPFSURI.json",
    });
    await itemNFT.testMint(alice.address, EstforConstants.BRONZE_SWORD, 1);
    await itemNFT.testMint(alice.address, EstforConstants.BRONZE_GAUNTLETS, 1);

    await itemNFT.addItem({
      ...EstforTypes.defaultInputItem,
      tokenId: EstforConstants.BRONZE_SWORD,
      combatStats,
      equipPosition: EstforTypes.EquipPosition.RIGHT_HAND,
      metadataURI: "someIPFSURI.json",
    });

    await world.addAction({
      actionId: 1,
      info: {
        skill:EstforTypes.Skill.COMBAT,
        xpPerHour: 3600,
        minXP: 0,
        isDynamic: false,
        numSpawn: 10,
        handItemTokenIdRangeMin: EstforConstants.COMBAT_BASE,
        handItemTokenIdRangeMax: EstforConstants.COMBAT_MAX,
        isAvailable: actionIsAvailable,
        actionChoiceRequired: true,
        successPercent: 100
      },
      guaranteedRewards: [],
      randomRewards: [],
      combatStats: EstforTypes.emptyCombatStats,
    });

    const tx = await world.addActionChoice(EstforConstants.NONE, {
      ...emptyActionChoice,
      skill:EstforTypes.Skill.MELEE,
    });
    const choiceId = await getActionChoiceId(tx);

    const queuedAction: EstforTypes.QueuedActionInput = {
      attire: {...noAttire, arms: BRONZE_GAUNTLETS},
      actionId: 1,
      combatStyle: EstforTypes.CombatStyle.ATTACK,
      choiceId,
      choiceId1: EstforConstants.NONE,
      choiceId2: EstforConstants.NONE,
      regenerateId: EstforConstants.NONE,
      timespan: 100,
      rightHandEquipmentTokenId: EstforConstants.BRONZE_SWORD,
      leftHandEquipmentTokenId: EstforConstants.NONE,
      skill: EstforTypes.Skill.COMBAT,
    };

    await players.connect(alice).startAction(playerId, queuedAction, EstforTypes.ActionQueueStatus.NONE);

    await ethers.provider.send("evm_increaseTime", [queuedAction.timespan + 2]);
    await players.connect(alice).processActions(playerId);
    expect(await players.xp(playerId,EstforTypes.Skill.MELEE)).to.eq(queuedAction.timespan);
  });
*/
  it("Multi-skill points", async () => {
    // TODO:
  });

  // TODO: Check attire stats are as expected

  it("Attire equipPositions", async () => {
    const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);

    let tx = await world.addAction({
      actionId: 1,
      info: {
        skill: EstforTypes.Skill.COMBAT,
        xpPerHour: 3600,
        minXP: 0,
        isDynamic: false,
        numSpawn: 1,
        handItemTokenIdRangeMin: EstforConstants.COMBAT_BASE,
        handItemTokenIdRangeMax: EstforConstants.COMBAT_MAX,
        isAvailable: actionIsAvailable,
        actionChoiceRequired: true,
        successPercent: 100,
      },
      guaranteedRewards: [],
      randomRewards: [],
      combatStats: EstforTypes.emptyCombatStats,
    });
    const actionId = await getActionId(tx);

    tx = await world.addActionChoice(EstforConstants.NONE, 1, {
      ...emptyActionChoice,
      skill: EstforTypes.Skill.MELEE,
    });
    const choiceId = await getActionChoiceId(tx);
    const timespan = 3600;

    const queuedAction: EstforTypes.QueuedActionInput = {
      attire: {...EstforTypes.noAttire, head: EstforConstants.BRONZE_GAUNTLETS}, // Incorrect attire
      actionId,
      combatStyle: EstforTypes.CombatStyle.ATTACK,
      choiceId,
      choiceId1: EstforConstants.NONE,
      choiceId2: EstforConstants.NONE,
      regenerateId: EstforConstants.NONE,
      timespan,
      rightHandEquipmentTokenId: EstforConstants.NONE,
      leftHandEquipmentTokenId: EstforConstants.NONE,
      skill: EstforTypes.Skill.COMBAT,
    };

    await itemNFT.addItem({
      ...EstforTypes.defaultInputItem,
      tokenId: EstforConstants.BRONZE_GAUNTLETS,
      combatStats: EstforTypes.emptyCombatStats,
      equipPosition: EstforTypes.EquipPosition.ARMS,
      metadataURI: "someIPFSURI.json",
    });
    await itemNFT.testMint(alice.address, EstforConstants.BRONZE_GAUNTLETS, 1);

    await expect(
      players.connect(alice).startAction(playerId, queuedAction, EstforTypes.ActionQueueStatus.NONE)
    ).to.be.revertedWithCustomError(players, "InvalidEquipPosition");
    queuedAction.attire.head = EstforConstants.NONE;
    queuedAction.attire.neck = EstforConstants.BRONZE_GAUNTLETS;
    await expect(
      players.connect(alice).startAction(playerId, queuedAction, EstforTypes.ActionQueueStatus.NONE)
    ).to.be.revertedWithCustomError(players, "InvalidEquipPosition");
    queuedAction.attire.neck = EstforConstants.NONE;
    queuedAction.attire.body = EstforConstants.BRONZE_GAUNTLETS;
    await expect(
      players.connect(alice).startAction(playerId, queuedAction, EstforTypes.ActionQueueStatus.NONE)
    ).to.be.revertedWithCustomError(players, "InvalidEquipPosition");
    queuedAction.attire.body = EstforConstants.NONE;
    queuedAction.attire.feet = EstforConstants.BRONZE_GAUNTLETS;
    await expect(
      players.connect(alice).startAction(playerId, queuedAction, EstforTypes.ActionQueueStatus.NONE)
    ).to.be.revertedWithCustomError(players, "InvalidEquipPosition");
    queuedAction.attire.feet = EstforConstants.NONE;
    queuedAction.attire.legs = EstforConstants.BRONZE_GAUNTLETS;
    await expect(
      players.connect(alice).startAction(playerId, queuedAction, EstforTypes.ActionQueueStatus.NONE)
    ).to.be.revertedWithCustomError(players, "InvalidEquipPosition");
    queuedAction.attire.legs = EstforConstants.NONE;
    queuedAction.attire.arms = EstforConstants.BRONZE_GAUNTLETS; // Correct
    await players.connect(alice).startAction(playerId, queuedAction, EstforTypes.ActionQueueStatus.NONE);
  });

  it("Queueing after 1 action is completely finished", async () => {
    const {playerId, players, alice} = await loadFixture(playersFixture);
    const {queuedAction} = await setupBasicWoodcutting();
    await players.connect(alice).startAction(playerId, queuedAction, EstforTypes.ActionQueueStatus.NONE);
    await ethers.provider.send("evm_increaseTime", [queuedAction.timespan / 2]);
    await players.connect(alice).startAction(playerId, queuedAction, EstforTypes.ActionQueueStatus.APPEND);
    await ethers.provider.send("evm_increaseTime", [queuedAction.timespan / 2 + 1]); // First one is now finished
    await players.connect(alice).startAction(playerId, queuedAction, EstforTypes.ActionQueueStatus.APPEND); // This should complete the first one
    const actionQueue = await players.getActionQueue(playerId);
    expect(actionQueue.length).to.eq(2);
    expect(actionQueue[0].attire.queueId).to.eq(2);
    expect(actionQueue[1].attire.queueId).to.eq(3);
  });

  describe("Queue combinations", () => {
    it("Remove in-progress but keep 1 pending", async () => {
      const {playerId, players, alice} = await loadFixture(playersFixture);
      const {queuedAction} = await setupBasicWoodcutting();
      await players
        .connect(alice)
        .startActions(playerId, [queuedAction, queuedAction], BoostType.NONE, EstforTypes.ActionQueueStatus.NONE);
      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan / 2]);
      let actionQueue = await players.getActionQueue(playerId);
      expect(actionQueue.length).to.eq(2);
      await players
        .connect(alice)
        .startActions(playerId, [queuedAction], BoostType.NONE, EstforTypes.ActionQueueStatus.NONE);
      actionQueue = await players.getActionQueue(playerId);
      expect(actionQueue.length).to.eq(1);
      expect(actionQueue[0].attire.queueId).to.eq(3);
      expect(actionQueue[0].timespan).to.eq(queuedAction.timespan);
    });
    it("Remove in-progress but keep pending, add another pending", async () => {
      const {playerId, players, alice} = await loadFixture(playersFixture);
      const {queuedAction} = await setupBasicWoodcutting();
      await players
        .connect(alice)
        .startActions(playerId, [queuedAction, queuedAction], BoostType.NONE, EstforTypes.ActionQueueStatus.NONE);
      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan / 2]);
      let actionQueue = await players.getActionQueue(playerId);
      expect(actionQueue.length).to.eq(2);
      await players
        .connect(alice)
        .startActions(playerId, [queuedAction, queuedAction], BoostType.NONE, EstforTypes.ActionQueueStatus.NONE);
      actionQueue = await players.getActionQueue(playerId);
      expect(actionQueue.length).to.eq(2);
      expect(actionQueue[0].attire.queueId).to.eq(3);
      expect(actionQueue[0].timespan).to.eq(queuedAction.timespan);
      expect(actionQueue[1].attire.queueId).to.eq(4);
      expect(actionQueue[1].timespan).to.eq(queuedAction.timespan);
    });
    it("Keep in-progress, remove 1 pending", async () => {
      const {playerId, players, alice} = await loadFixture(playersFixture);
      const {queuedAction} = await setupBasicWoodcutting();
      await players
        .connect(alice)
        .startActions(playerId, [queuedAction, queuedAction], BoostType.NONE, EstforTypes.ActionQueueStatus.NONE);
      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan / 2]);
      let actionQueue = await players.getActionQueue(playerId);
      expect(actionQueue.length).to.eq(2);
      await players
        .connect(alice)
        .startActions(playerId, [], BoostType.NONE, EstforTypes.ActionQueueStatus.KEEP_LAST_IN_PROGRESS);
      actionQueue = await players.getActionQueue(playerId);
      expect(actionQueue.length).to.eq(1);
      expect(actionQueue[0].attire.queueId).to.eq(1);
      expect(actionQueue[0].timespan).to.be.oneOf([queuedAction.timespan / 2 - 1, queuedAction.timespan / 2]);
    });
    it("Keep in-progress, remove 1 pending, and add 1 pending", async () => {
      const {playerId, players, alice} = await loadFixture(playersFixture);
      const {queuedAction} = await setupBasicWoodcutting();
      await players
        .connect(alice)
        .startActions(playerId, [queuedAction, queuedAction], BoostType.NONE, EstforTypes.ActionQueueStatus.NONE);
      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan / 2]);
      let actionQueue = await players.getActionQueue(playerId);
      expect(actionQueue.length).to.eq(2);
      await players
        .connect(alice)
        .startActions(playerId, [queuedAction], BoostType.NONE, EstforTypes.ActionQueueStatus.KEEP_LAST_IN_PROGRESS);
      actionQueue = await players.getActionQueue(playerId);
      expect(actionQueue.length).to.eq(2);
      expect(actionQueue[0].attire.queueId).to.eq(1);
      expect(actionQueue[0].timespan).to.be.oneOf([queuedAction.timespan / 2 - 1, queuedAction.timespan / 2]);
      expect(actionQueue[1].attire.queueId).to.eq(3);
      expect(actionQueue[1].timespan).to.eq(queuedAction.timespan);
    });
    it("Remove in-progress and any pending", async () => {
      const {playerId, players, alice} = await loadFixture(playersFixture);
      const {queuedAction} = await setupBasicWoodcutting();
      await players
        .connect(alice)
        .startActions(playerId, [queuedAction, queuedAction], BoostType.NONE, EstforTypes.ActionQueueStatus.NONE);
      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan / 2]);
      let actionQueue = await players.getActionQueue(playerId);
      expect(actionQueue.length).to.eq(2);
      await players.connect(alice).startActions(playerId, [], BoostType.NONE, EstforTypes.ActionQueueStatus.NONE);
      actionQueue = await players.getActionQueue(playerId);
      expect(actionQueue.length).to.eq(0);
    });
    it("Remove in-progress and pending, add 1 pending ", async () => {
      const {playerId, players, alice} = await loadFixture(playersFixture);
      const {queuedAction} = await setupBasicWoodcutting();
      await players
        .connect(alice)
        .startActions(playerId, [queuedAction, queuedAction], BoostType.NONE, EstforTypes.ActionQueueStatus.NONE);
      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan / 2]);
      let actionQueue = await players.getActionQueue(playerId);
      expect(actionQueue.length).to.eq(2);
      await players
        .connect(alice)
        .startActions(playerId, [queuedAction], BoostType.NONE, EstforTypes.ActionQueueStatus.NONE);
      actionQueue = await players.getActionQueue(playerId);
      expect(actionQueue.length).to.eq(1);
      expect(actionQueue[0].attire.queueId).to.eq(3);
    });
    it("Keep in progress and pending, add another pending", async () => {
      const {playerId, players, alice} = await loadFixture(playersFixture);
      const {queuedAction} = await setupBasicWoodcutting();
      await players
        .connect(alice)
        .startActions(playerId, [queuedAction, queuedAction], BoostType.NONE, EstforTypes.ActionQueueStatus.NONE);
      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan / 2]);
      let actionQueue = await players.getActionQueue(playerId);
      expect(actionQueue.length).to.eq(2);
      await players
        .connect(alice)
        .startActions(playerId, [queuedAction], BoostType.NONE, EstforTypes.ActionQueueStatus.APPEND);
      actionQueue = await players.getActionQueue(playerId);
      expect(actionQueue.length).to.eq(3);
      expect(actionQueue[0].attire.queueId).to.eq(1);
      expect(actionQueue[1].attire.queueId).to.eq(2);
      expect(actionQueue[2].attire.queueId).to.eq(3);
    });
  });

  describe("Minimum skill points", () => {
    it("Action", async () => {
      const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);
      const rate = 100 * 10; // per hour
      const tx = await world.addAction({
        actionId: 1,
        info: {
          skill: EstforTypes.Skill.WOODCUTTING,
          xpPerHour: 3600,
          minXP: getXPFromLevel(70),
          isDynamic: false,
          numSpawn: 0,
          handItemTokenIdRangeMin: EstforConstants.ORICHALCUM_AXE,
          handItemTokenIdRangeMax: EstforConstants.WOODCUTTING_MAX,
          isAvailable: true,
          actionChoiceRequired: false,
          successPercent: 100,
        },
        guaranteedRewards: [{itemTokenId: EstforConstants.LOG, rate}],
        randomRewards: [],
        combatStats: EstforTypes.emptyCombatStats,
      });
      const actionId = await getActionId(tx);

      const timespan = 3600;
      const queuedAction: EstforTypes.QueuedActionInput = {
        attire: EstforTypes.noAttire,
        actionId,
        combatStyle: EstforTypes.CombatStyle.NONE,
        choiceId: EstforConstants.NONE,
        choiceId1: EstforConstants.NONE,
        choiceId2: EstforConstants.NONE,
        regenerateId: EstforConstants.NONE,
        timespan,
        rightHandEquipmentTokenId: EstforConstants.ORICHALCUM_AXE,
        leftHandEquipmentTokenId: EstforConstants.NONE,
        skill: EstforTypes.Skill.WOODCUTTING,
      };

      await itemNFT.addItem({
        ...EstforTypes.defaultInputItem,
        minXP: 0,
        tokenId: EstforConstants.ORICHALCUM_AXE,
        equipPosition: EstforTypes.EquipPosition.RIGHT_HAND,
        metadataURI: "someIPFSURI.json",
      });

      await itemNFT.testMint(alice.address, EstforConstants.ORICHALCUM_AXE, 1);

      await expect(
        players.connect(alice).startAction(playerId, queuedAction, EstforTypes.ActionQueueStatus.NONE)
      ).to.be.revertedWithCustomError(players, "ActionMinimumXPNotReached");

      // Update to level 70, check it works
      await players.testOnlyModifyLevel(playerId, EstforTypes.Skill.WOODCUTTING, getXPFromLevel(70));
      expect(await players.connect(alice).startAction(playerId, queuedAction, EstforTypes.ActionQueueStatus.NONE)).to
        .not.be.reverted;
    });

    it("ActionChoices", async () => {
      const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);
      const rate = 100 * 10; // per hour
      let tx = await world.addAction({
        actionId: 1,
        info: {
          skill: EstforTypes.Skill.FIREMAKING,
          xpPerHour: 0,
          minXP: 0,
          isDynamic: false,
          numSpawn: 0,
          handItemTokenIdRangeMin: EstforConstants.MAGIC_FIRE_STARTER,
          handItemTokenIdRangeMax: EstforConstants.FIRE_MAX,
          isAvailable: actionIsAvailable,
          actionChoiceRequired: true,
          successPercent: 100,
        },
        guaranteedRewards: [],
        randomRewards: [],
        combatStats: EstforTypes.emptyCombatStats,
      });
      const actionId = await getActionId(tx);

      const minXP = getXPFromLevel(70);

      // Logs go in, nothing comes out
      tx = await world.addActionChoice(actionId, 1, {
        skill: EstforTypes.Skill.FIREMAKING,
        diff: 0,
        xpPerHour: 3600,
        minXP,
        rate,
        inputTokenId1: EstforConstants.LOG,
        num1: 1,
        inputTokenId2: EstforConstants.NONE,
        num2: 0,
        inputTokenId3: EstforConstants.NONE,
        num3: 0,
        outputTokenId: EstforConstants.NONE,
        outputNum: 0,
        successPercent: 100,
      });
      const choiceId = await getActionChoiceId(tx);

      const timespan = 3600;
      const queuedAction: EstforTypes.QueuedActionInput = {
        attire: EstforTypes.noAttire,
        actionId,
        combatStyle: EstforTypes.CombatStyle.NONE,
        choiceId,
        choiceId1: EstforConstants.NONE,
        choiceId2: EstforConstants.NONE,
        regenerateId: EstforConstants.NONE,
        timespan,
        rightHandEquipmentTokenId: EstforConstants.MAGIC_FIRE_STARTER,
        leftHandEquipmentTokenId: EstforConstants.NONE,
        skill: EstforTypes.Skill.FIREMAKING,
      };

      await itemNFT.addItem({
        ...EstforTypes.defaultInputItem,
        tokenId: EstforConstants.MAGIC_FIRE_STARTER,
        equipPosition: EstforTypes.EquipPosition.RIGHT_HAND,
        metadataURI: "someIPFSURI.json",
      });

      await itemNFT.addItem({
        ...EstforTypes.defaultInputItem,
        tokenId: EstforConstants.LOG,
        equipPosition: EstforTypes.EquipPosition.AUX,
        metadataURI: "someIPFSURI.json",
      });

      await itemNFT.testMint(alice.address, EstforConstants.LOG, 5);

      await expect(
        players.connect(alice).startAction(playerId, queuedAction, EstforTypes.ActionQueueStatus.NONE)
      ).to.be.revertedWithCustomError(players, "ActionChoiceMinimumXPNotReached");

      // Update firemamking level, check it works
      await players.testOnlyModifyLevel(playerId, EstforTypes.Skill.FIREMAKING, minXP);
      expect(await players.connect(alice).startAction(playerId, queuedAction, EstforTypes.ActionQueueStatus.NONE)).to
        .not.be.reverted;

      await players.connect(alice).startAction(playerId, queuedAction, EstforTypes.ActionQueueStatus.NONE);
    });

    it("Consumeables (food)", async () => {
      const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);
      const rate = 100 * 10; // per hour
      let tx = await world.addAction({
        actionId: 1,
        info: {
          skill: EstforTypes.Skill.FIREMAKING,
          xpPerHour: 0,
          minXP: 0,
          isDynamic: false,
          numSpawn: 0,
          handItemTokenIdRangeMin: EstforConstants.MAGIC_FIRE_STARTER,
          handItemTokenIdRangeMax: EstforConstants.FIRE_MAX,
          isAvailable: actionIsAvailable,
          actionChoiceRequired: true,
          successPercent: 100,
        },
        guaranteedRewards: [],
        randomRewards: [],
        combatStats: EstforTypes.emptyCombatStats,
      });
      const actionId = await getActionId(tx);

      // Logs go in, nothing comes out
      tx = await world.addActionChoice(actionId, 1, {
        skill: EstforTypes.Skill.FIREMAKING,
        diff: 0,
        xpPerHour: 3600,
        minXP: 0,
        rate,
        inputTokenId1: EstforConstants.LOG,
        num1: 1,
        inputTokenId2: EstforConstants.NONE,
        num2: 0,
        inputTokenId3: EstforConstants.NONE,
        num3: 0,
        outputTokenId: EstforConstants.NONE,
        outputNum: 0,
        successPercent: 100,
      });
      const choiceId = await getActionChoiceId(tx);

      const timespan = 3600;
      const queuedAction: EstforTypes.QueuedActionInput = {
        attire: EstforTypes.noAttire,
        actionId,
        combatStyle: EstforTypes.CombatStyle.NONE,
        choiceId,
        choiceId1: EstforConstants.NONE,
        choiceId2: EstforConstants.NONE,
        regenerateId: EstforConstants.COOKED_MINNUS,
        timespan,
        rightHandEquipmentTokenId: EstforConstants.MAGIC_FIRE_STARTER,
        leftHandEquipmentTokenId: EstforConstants.NONE,
        skill: EstforTypes.Skill.FIREMAKING,
      };

      const minXP = getXPFromLevel(70);
      await itemNFT.addItems([
        {
          ...EstforTypes.defaultInputItem,
          tokenId: EstforConstants.MAGIC_FIRE_STARTER,
          equipPosition: EstforTypes.EquipPosition.RIGHT_HAND,
          metadataURI: "someIPFSURI.json",
        },
        {
          ...EstforTypes.defaultInputItem,
          tokenId: EstforConstants.LOG,
          equipPosition: EstforTypes.EquipPosition.AUX,
          metadataURI: "someIPFSURI.json",
        },
        {
          ...EstforTypes.defaultInputItem,
          skill: EstforTypes.Skill.HEALTH,
          minXP,
          healthRestored: 12,
          tokenId: EstforConstants.COOKED_MINNUS,
          equipPosition: EstforTypes.EquipPosition.FOOD,
          metadataURI: "someIPFSURI.json",
        },
      ]);

      await itemNFT.testMint(alice.address, EstforConstants.LOG, 5);
      await itemNFT.testMint(alice.address, EstforConstants.COOKED_MINNUS, 1);

      await expect(
        players.connect(alice).startAction(playerId, queuedAction, EstforTypes.ActionQueueStatus.NONE)
      ).to.be.revertedWithCustomError(players, "ConsumeableMinimumXPNotReached");

      await players.testOnlyModifyLevel(playerId, EstforTypes.Skill.HEALTH, minXP);

      // Update health level, check it works
      expect(await players.connect(alice).startAction(playerId, queuedAction, EstforTypes.ActionQueueStatus.NONE)).to
        .not.be.reverted;

      await players.connect(alice).startAction(playerId, queuedAction, EstforTypes.ActionQueueStatus.NONE);
    });

    it("Attire", async () => {
      const {playerId, players, playerNFT, itemNFT, world, alice} = await loadFixture(playersFixture);
      const rate = 100 * 10; // per hour
      const tx = await world.addAction({
        actionId: 1,
        info: {
          skill: EstforTypes.Skill.WOODCUTTING,
          xpPerHour: 3600,
          minXP: 0,
          isDynamic: false,
          numSpawn: 0,
          handItemTokenIdRangeMin: EstforConstants.BRONZE_AXE,
          handItemTokenIdRangeMax: EstforConstants.WOODCUTTING_MAX,
          isAvailable: true,
          actionChoiceRequired: false,
          successPercent: 100,
        },
        guaranteedRewards: [{itemTokenId: EstforConstants.LOG, rate}],
        randomRewards: [],
        combatStats: EstforTypes.emptyCombatStats,
      });
      const actionId = await getActionId(tx);

      const timespan = 3600;
      const queuedAction: EstforTypes.QueuedActionInput = {
        attire: EstforTypes.noAttire,
        actionId,
        combatStyle: EstforTypes.CombatStyle.NONE,
        choiceId: EstforConstants.NONE,
        choiceId1: EstforConstants.NONE,
        choiceId2: EstforConstants.NONE,
        regenerateId: EstforConstants.NONE,
        timespan,
        rightHandEquipmentTokenId: EstforConstants.BRONZE_AXE,
        leftHandEquipmentTokenId: EstforConstants.NONE,
        skill: EstforTypes.Skill.WOODCUTTING,
      };

      const minXP = getXPFromLevel(70);
      await itemNFT.addItem({
        ...EstforTypes.defaultInputItem,
        skill: EstforTypes.Skill.WOODCUTTING,
        minXP: 0,
        tokenId: EstforConstants.BRONZE_AXE,
        equipPosition: EstforTypes.EquipPosition.RIGHT_HAND,
        metadataURI: "someIPFSURI.json",
      });

      await itemNFT.testMints(
        alice.address,
        [
          EstforConstants.BRONZE_AXE,
          EstforConstants.AMETHYST_AMULET,
          EstforConstants.BRONZE_ARMOR,
          EstforConstants.BRONZE_BOOTS,
          EstforConstants.BRONZE_GAUNTLETS,
          EstforConstants.BRONZE_HELMET,
          EstforConstants.BRONZE_TASSETS,
        ],
        [1, 1, 1, 1, 1, 1, 1]
      );

      const attireEquipped = [
        {
          ...EstforTypes.defaultInputItem,
          skill: EstforTypes.Skill.DEFENCE,
          minXP,
          tokenId: EstforConstants.AMETHYST_AMULET,
          equipPosition: EstforTypes.EquipPosition.NECK,
          metadataURI: "someIPFSURI.json",
        },
        {
          ...EstforTypes.defaultInputItem,
          skill: EstforTypes.Skill.DEFENCE,
          minXP,
          tokenId: EstforConstants.BRONZE_ARMOR,
          equipPosition: EstforTypes.EquipPosition.BODY,
          metadataURI: "someIPFSURI.json",
        },
        {
          ...EstforTypes.defaultInputItem,
          skill: EstforTypes.Skill.DEFENCE,
          minXP,
          tokenId: EstforConstants.BRONZE_BOOTS,
          equipPosition: EstforTypes.EquipPosition.FEET,
          metadataURI: "someIPFSURI.json",
        },
        {
          ...EstforTypes.defaultInputItem,
          skill: EstforTypes.Skill.DEFENCE,
          minXP,
          tokenId: EstforConstants.BRONZE_GAUNTLETS,
          equipPosition: EstforTypes.EquipPosition.ARMS,
          metadataURI: "someIPFSURI.json",
        },
        {
          ...EstforTypes.defaultInputItem,
          skill: EstforTypes.Skill.DEFENCE,
          minXP,
          tokenId: EstforConstants.BRONZE_HELMET,
          equipPosition: EstforTypes.EquipPosition.HEAD,
          metadataURI: "someIPFSURI.json",
        },
        {
          ...EstforTypes.defaultInputItem,
          skill: EstforTypes.Skill.DEFENCE,
          minXP,
          tokenId: EstforConstants.BRONZE_TASSETS,
          equipPosition: EstforTypes.EquipPosition.LEGS,
          metadataURI: "someIPFSURI.json",
        },
      ];

      await itemNFT.addItems(attireEquipped);

      const equips = ["neck", "body", "feet", "arms", "head", "legs"];
      for (let i = 0; i < attireEquipped.length; ++i) {
        const attire: Attire = {...EstforTypes.noAttire};
        attire[equips[i] as keyof Attire] = attireEquipped[i].tokenId;
        queuedAction.attire = attire;
        await expect(
          players.connect(alice).startAction(playerId, queuedAction, EstforTypes.ActionQueueStatus.NONE)
        ).to.be.revertedWithCustomError(players, "AttireMinimumXPNotReached");
        await players.testOnlyModifyLevel(playerId, EstforTypes.Skill.DEFENCE, minXP);
        expect(await players.connect(alice).startAction(playerId, queuedAction, EstforTypes.ActionQueueStatus.NONE)).to
          .not.be.reverted;
        await players.testOnlyModifyLevel(playerId, EstforTypes.Skill.DEFENCE, 1);
      }

      // Test case, create a player
      const makeActive = true;
      await expect(playerNFT.connect(alice).mint(1, ethers.utils.formatBytes32String("0xSamWitch123"), makeActive)).to
        .not.be.reverted;
    });

    it("Left/Right equipment", async () => {
      const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);
      const rate = 100 * 10; // per hour
      const tx = await world.addAction({
        actionId: 1,
        info: {
          skill: EstforTypes.Skill.WOODCUTTING,
          xpPerHour: 3600,
          minXP: 0,
          isDynamic: false,
          numSpawn: 0,
          handItemTokenIdRangeMin: EstforConstants.ORICHALCUM_AXE,
          handItemTokenIdRangeMax: EstforConstants.WOODCUTTING_MAX,
          isAvailable: true,
          actionChoiceRequired: false,
          successPercent: 100,
        },
        guaranteedRewards: [{itemTokenId: EstforConstants.LOG, rate}],
        randomRewards: [],
        combatStats: EstforTypes.emptyCombatStats,
      });
      const actionId = await getActionId(tx);

      const timespan = 3600;
      const queuedAction: EstforTypes.QueuedActionInput = {
        attire: EstforTypes.noAttire,
        actionId,
        combatStyle: EstforTypes.CombatStyle.NONE,
        choiceId: EstforConstants.NONE,
        choiceId1: EstforConstants.NONE,
        choiceId2: EstforConstants.NONE,
        regenerateId: EstforConstants.NONE,
        timespan,
        rightHandEquipmentTokenId: EstforConstants.ORICHALCUM_AXE,
        leftHandEquipmentTokenId: EstforConstants.NONE,
        skill: EstforTypes.Skill.WOODCUTTING,
      };

      const minXP = getXPFromLevel(70);
      await itemNFT.addItem({
        ...EstforTypes.defaultInputItem,
        skill: EstforTypes.Skill.WOODCUTTING,
        minXP,
        tokenId: EstforConstants.ORICHALCUM_AXE,
        equipPosition: EstforTypes.EquipPosition.RIGHT_HAND,
        metadataURI: "someIPFSURI.json",
      });

      await itemNFT.testMint(alice.address, EstforConstants.ORICHALCUM_AXE, 1);

      await expect(
        players.connect(alice).startAction(playerId, queuedAction, EstforTypes.ActionQueueStatus.NONE)
      ).to.be.revertedWithCustomError(players, "ItemMinimumXPNotReached");

      // Update to level 70, check it works
      await players.testOnlyModifyLevel(playerId, EstforTypes.Skill.WOODCUTTING, minXP);
      expect(await players.connect(alice).startAction(playerId, queuedAction, EstforTypes.ActionQueueStatus.NONE)).to
        .not.be.reverted;
    });
  });
});
