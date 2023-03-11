import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {expect} from "chai";
import {ethers} from "hardhat";
import {
  ActionQueueStatus,
  BRONZE_AXE,
  BRONZE_GAUNTLETS,
  CombatStyle,
  COMBAT_BASE,
  COMBAT_MAX,
  emptyActionChoice,
  emptyCombatStats,
  EquipPosition,
  getActionChoiceId,
  getActionId,
  defaultInputItem,
  LOG,
  noAttire,
  NONE,
  QueuedAction,
  Skill,
  WOODCUTTING_BASE,
  WOODCUTTING_MAX,
  ORCHALCUM_AXE,
} from "../../scripts/utils";
import {playersFixture} from "./PlayersFixture";
import {getXPFromLevel} from "./utils";

const actionIsAvailable = true;

describe("Players", () => {
  it("Skill points", async () => {
    const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);

    await itemNFT.addItem({
      ...defaultInputItem,
      tokenId: BRONZE_AXE,
      equipPosition: EquipPosition.RIGHT_HAND,
      metadataURI: "someIPFSURI.json",
    });

    const rate = 100 * 100; // per hour
    const tx = await world.addAction({
      actionId: 1,
      info: {
        skill: Skill.WOODCUTTING,
        xpPerHour: 3600,
        minSkillPoints: 0,
        isDynamic: false,
        numSpawn: 0,
        handItemTokenIdRangeMin: WOODCUTTING_BASE,
        handItemTokenIdRangeMax: WOODCUTTING_MAX,
        isAvailable: actionIsAvailable,
        actionChoiceRequired: false,
      },
      guaranteedRewards: [{itemTokenId: LOG, rate}],
      randomRewards: [],
      combatStats: emptyCombatStats,
    });

    const actionId = await getActionId(tx);
    const queuedAction: QueuedAction = {
      attire: noAttire,
      actionId,
      combatStyle: CombatStyle.NONE,
      choiceId: NONE,
      choiceId1: NONE,
      choiceId2: NONE,
      regenerateId: NONE,
      timespan: 3600,
      rightHandEquipmentTokenId: BRONZE_AXE,
      leftHandEquipmentTokenId: NONE,
      startTime: "0",
      isValid: true,
    };

    await players.connect(alice).startAction(playerId, queuedAction, ActionQueueStatus.NONE);
    await ethers.provider.send("evm_increaseTime", [361]);
    await players.connect(alice).processActions(playerId);
    expect(await players.skillPoints(playerId, Skill.WOODCUTTING)).to.be.oneOf([361, 362]);
    expect(await itemNFT.balanceOf(alice.address, LOG)).to.eq(10); // Should be rounded down
  });

  it("Skill points (many)", async () => {
    const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);

    await itemNFT.addItem({
      ...defaultInputItem,
      tokenId: BRONZE_AXE,
      equipPosition: EquipPosition.RIGHT_HAND,
      metadataURI: "someIPFSURI.json",
    });

    const rate = 100 * 100; // per hour
    const tx = await world.addAction({
      actionId: 1,
      info: {
        skill: Skill.WOODCUTTING,
        xpPerHour: 3600,
        minSkillPoints: 0,
        isDynamic: false,
        numSpawn: 0,
        handItemTokenIdRangeMin: WOODCUTTING_BASE,
        handItemTokenIdRangeMax: WOODCUTTING_MAX,
        isAvailable: actionIsAvailable,
        actionChoiceRequired: false,
      },
      guaranteedRewards: [{itemTokenId: LOG, rate}],
      randomRewards: [],
      combatStats: emptyCombatStats,
    });

    const actionId = await getActionId(tx);
    const queuedAction: QueuedAction = {
      attire: noAttire,
      actionId,
      combatStyle: CombatStyle.NONE,
      choiceId: NONE,
      choiceId1: NONE,
      choiceId2: NONE,
      regenerateId: NONE,
      timespan: 3600,
      rightHandEquipmentTokenId: BRONZE_AXE,
      leftHandEquipmentTokenId: NONE,
      startTime: "0",
      isValid: true,
    };

    // start a bunch of actions 1 after each other
    for (let i = 0; i < 50; i++) {
      await players.connect(alice).startAction(playerId, queuedAction, ActionQueueStatus.APPEND);
      await ethers.provider.send("evm_increaseTime", [7200]);
      await players.connect(alice).processActions(playerId);
      expect(await players.skillPoints(playerId, Skill.WOODCUTTING)).to.be.eq((i + 1) * 3600);
      expect(await itemNFT.balanceOf(alice.address, LOG)).to.eq((i + 1) * 100); // Should be rounded down
    }
  });

  it("Speed multiplier", async () => {
    const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);

    const rate = 100 * 100; // per hour
    const tx = await world.addAction({
      actionId: 1,
      info: {
        skill: Skill.WOODCUTTING,
        xpPerHour: 3600,
        minSkillPoints: 0,
        isDynamic: false,
        numSpawn: 0,
        handItemTokenIdRangeMin: BRONZE_AXE,
        handItemTokenIdRangeMax: WOODCUTTING_MAX,
        isAvailable: actionIsAvailable,
        actionChoiceRequired: false,
      },
      guaranteedRewards: [{itemTokenId: LOG, rate}],
      randomRewards: [],
      combatStats: emptyCombatStats,
    });
    const actionId = await getActionId(tx);

    const timespan = 3600;
    const queuedAction: QueuedAction = {
      attire: noAttire,
      actionId,
      combatStyle: CombatStyle.NONE,
      choiceId: NONE,
      choiceId1: NONE,
      choiceId2: NONE,
      regenerateId: NONE,
      timespan,
      rightHandEquipmentTokenId: BRONZE_AXE,
      leftHandEquipmentTokenId: NONE,
      startTime: "0",
      isValid: true,
    };

    await itemNFT.addItem({
      ...defaultInputItem,
      tokenId: BRONZE_AXE,
      equipPosition: EquipPosition.RIGHT_HAND,
      metadataURI: "someIPFSURI.json",
    });

    await players.connect(alice).startAction(playerId, queuedAction, ActionQueueStatus.NONE);
    await players.connect(alice).setSpeedMultiplier(playerId, 2);

    await ethers.provider.send("evm_increaseTime", [queuedAction.timespan / 2]);
    await players.connect(alice).processActions(playerId);
    expect(await players.skillPoints(playerId, Skill.WOODCUTTING)).to.eq(queuedAction.timespan);
    // Check the drops are as expected
    expect(await itemNFT.balanceOf(alice.address, LOG)).to.eq(
      Math.floor((queuedAction.timespan * rate) / (3600 * 100))
    );
    expect(await players.actionQueueLength(playerId)).to.eq(0);
  });

  it("Partial consume aux items", async () => {
    const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);

    const rate = 100 * 100; // per hour
    const tx = await world.addAction({
      actionId: 1,
      info: {
        skill: Skill.WOODCUTTING,
        xpPerHour: 3600,
        minSkillPoints: 0,
        isDynamic: false,
        numSpawn: 0,
        handItemTokenIdRangeMin: BRONZE_AXE,
        handItemTokenIdRangeMax: WOODCUTTING_MAX,
        isAvailable: actionIsAvailable,
        actionChoiceRequired: false,
      },
      guaranteedRewards: [{itemTokenId: LOG, rate}],
      randomRewards: [],
      combatStats: emptyCombatStats,
    });
    const actionId = await getActionId(tx);

    const timespan = 3600;
    const queuedAction: QueuedAction = {
      attire: noAttire,
      actionId,
      combatStyle: CombatStyle.NONE,
      choiceId: NONE,
      choiceId1: NONE,
      choiceId2: NONE,
      regenerateId: NONE,
      timespan,
      rightHandEquipmentTokenId: BRONZE_AXE,
      leftHandEquipmentTokenId: NONE,
      startTime: "0",
      isValid: true,
    };

    await itemNFT.addItem({
      ...defaultInputItem,
      tokenId: BRONZE_AXE,
      equipPosition: EquipPosition.RIGHT_HAND,
      metadataURI: "someIPFSURI.json",
    });

    await players.connect(alice).startAction(playerId, queuedAction, ActionQueueStatus.NONE);

    await ethers.provider.send("evm_increaseTime", [queuedAction.timespan / 2]);
    await players.connect(alice).processActions(playerId);
    expect(await players.skillPoints(playerId, Skill.WOODCUTTING)).to.eq(queuedAction.timespan / 2);
    // Check the drops are as expected
    expect(await itemNFT.balanceOf(alice.address, LOG)).to.eq(
      Math.floor(((queuedAction.timespan / 2) * rate) / (3600 * 100))
    );
  });
  /*
  it("Skill points, max range", async () => {
    const {playerId, players, itemNFT, world, alice, maxTime} = await loadFixture(playersFixture);

    const combatStats: CombatStats = {
      melee: 2,
      magic: 0,
      range: 0,
      meleeDefence: -1,
      magicDefence: 0,
      rangeDefence: 0,
      health: 12,
    };
    await itemNFT.addItem({
      ...defaultInputItem,
      tokenId: BRONZE_GAUNTLETS,
      combatStats,
      equipPosition: EquipPosition.ARMS,
      metadataURI: "someIPFSURI.json",
    });
    await itemNFT.testOnlyMint(alice.address, BRONZE_SWORD, 1);
    await itemNFT.testOnlyMint(alice.address, BRONZE_GAUNTLETS, 1);

    await itemNFT.addItem({
      ...defaultInputItem,
      tokenId: BRONZE_SWORD,
      combatStats,
      equipPosition: EquipPosition.RIGHT_HAND,
      metadataURI: "someIPFSURI.json",
    });

    await world.addAction({
      actionId: 1,
      info: {
        skill: Skill.COMBAT,
        xpPerHour: 3600,
        minSkillPoints: 0,
        isDynamic: false,
        numSpawn: 10,
        handItemTokenIdRangeMin: COMBAT_BASE,
        handItemTokenIdRangeMax: COMBAT_MAX,
        isAvailable: actionIsAvailable,
        actionChoiceRequired: true,
      },
      guaranteedRewards: [],
      randomRewards: [],
      combatStats: emptyCombatStats,
    });

    const tx = await world.addActionChoice(NONE, {
      ...emptyActionChoice,
      skill: Skill.ATTACK,
    });
    const choiceId = await getActionChoiceId(tx);

    const queuedAction: QueuedAction = {
      attire: {...noAttire, gauntlets: BRONZE_GAUNTLETS},
      actionId: 1,
      combatStyle: CombatStyle.MELEE,
      choiceId,
      choiceId1: NONE,
      choiceId2: NONE,
      regenerateId: NONE,
      timespan: 100,
      rightHandEquipmentTokenId: BRONZE_SWORD,
      leftHandEquipmentTokenId: NONE,
      startTime: "0",
      isValid: true,
    };

    await players.connect(alice).startAction(playerId, queuedAction, ActionQueueStatus.NONE);

    await ethers.provider.send("evm_increaseTime", [queuedAction.timespan + 2]);
    await players.connect(alice).processActions(playerId);
    expect(await players.skillPoints(playerId, Skill.ATTACK)).to.eq(queuedAction.timespan);
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
        skill: Skill.COMBAT,
        xpPerHour: 3600,
        minSkillPoints: 0,
        isDynamic: false,
        numSpawn: 1,
        handItemTokenIdRangeMin: COMBAT_BASE,
        handItemTokenIdRangeMax: COMBAT_MAX,
        isAvailable: actionIsAvailable,
        actionChoiceRequired: true,
      },
      guaranteedRewards: [],
      randomRewards: [],
      combatStats: emptyCombatStats,
    });
    const actionId = await getActionId(tx);

    tx = await world.addActionChoice(NONE, 1, {
      ...emptyActionChoice,
      skill: Skill.ATTACK,
    });
    const choiceId = await getActionChoiceId(tx);
    const timespan = 3600;

    const queuedAction: QueuedAction = {
      attire: {...noAttire, helmet: BRONZE_GAUNTLETS}, // Incorrect attire
      actionId,
      combatStyle: CombatStyle.MELEE,
      choiceId,
      choiceId1: NONE,
      choiceId2: NONE,
      regenerateId: NONE,
      timespan,
      rightHandEquipmentTokenId: NONE,
      leftHandEquipmentTokenId: NONE,
      startTime: "0",
      isValid: true,
    };

    await itemNFT.addItem({
      ...defaultInputItem,
      tokenId: BRONZE_GAUNTLETS,
      combatStats: emptyCombatStats,
      equipPosition: EquipPosition.ARMS,
      metadataURI: "someIPFSURI.json",
    });
    await itemNFT.testOnlyMint(alice.address, BRONZE_GAUNTLETS, 1);

    await expect(
      players.connect(alice).startAction(playerId, queuedAction, ActionQueueStatus.NONE)
    ).to.be.revertedWithCustomError(players, "InvalidEquipPosition");
    queuedAction.attire.helmet = NONE;
    queuedAction.attire.amulet = BRONZE_GAUNTLETS;
    await expect(
      players.connect(alice).startAction(playerId, queuedAction, ActionQueueStatus.NONE)
    ).to.be.revertedWithCustomError(players, "InvalidEquipPosition");
    queuedAction.attire.amulet = NONE;
    queuedAction.attire.armor = BRONZE_GAUNTLETS;
    await expect(
      players.connect(alice).startAction(playerId, queuedAction, ActionQueueStatus.NONE)
    ).to.be.revertedWithCustomError(players, "InvalidEquipPosition");
    queuedAction.attire.armor = NONE;
    queuedAction.attire.boots = BRONZE_GAUNTLETS;
    await expect(
      players.connect(alice).startAction(playerId, queuedAction, ActionQueueStatus.NONE)
    ).to.be.revertedWithCustomError(players, "InvalidEquipPosition");
    queuedAction.attire.boots = NONE;
    queuedAction.attire.tassets = BRONZE_GAUNTLETS;
    await expect(
      players.connect(alice).startAction(playerId, queuedAction, ActionQueueStatus.NONE)
    ).to.be.revertedWithCustomError(players, "InvalidEquipPosition");
    queuedAction.attire.tassets = NONE;
    queuedAction.attire.gauntlets = BRONZE_GAUNTLETS; // Correct
    await players.connect(alice).startAction(playerId, queuedAction, ActionQueueStatus.NONE);
  });

  describe("Minimum skill points", () => {
    it("Action", async () => {
      const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);
      const rate = 100 * 100; // per hour
      const tx = await world.addAction({
        actionId: 1,
        info: {
          skill: Skill.WOODCUTTING,
          xpPerHour: 3600,
          minSkillPoints: getXPFromLevel(70),
          isDynamic: false,
          numSpawn: 0,
          handItemTokenIdRangeMin: ORCHALCUM_AXE,
          handItemTokenIdRangeMax: WOODCUTTING_MAX,
          isAvailable: true,
          actionChoiceRequired: false,
        },
        guaranteedRewards: [{itemTokenId: LOG, rate}],
        randomRewards: [],
        combatStats: emptyCombatStats,
      });
      const actionId = await getActionId(tx);

      const timespan = 3600;
      const queuedAction: QueuedAction = {
        attire: noAttire,
        actionId,
        combatStyle: CombatStyle.NONE,
        choiceId: NONE,
        choiceId1: NONE,
        choiceId2: NONE,
        regenerateId: NONE,
        timespan,
        rightHandEquipmentTokenId: ORCHALCUM_AXE,
        leftHandEquipmentTokenId: NONE,
        startTime: "0",
        isValid: true,
      };

      await itemNFT.addItem({
        ...defaultInputItem,
        minSkillPoints: 0,
        tokenId: ORCHALCUM_AXE,
        equipPosition: EquipPosition.RIGHT_HAND,
        metadataURI: "someIPFSURI.json",
      });

      await itemNFT.testOnlyMint(alice.address, ORCHALCUM_AXE, 1);

      await expect(
        players.connect(alice).startAction(playerId, queuedAction, ActionQueueStatus.NONE)
      ).to.be.revertedWithCustomError(players, "ActionMinimumSkillPointsNotReached");

      // Update to level 70, check it works
      await players.testOnlyModifyLevel(playerId, Skill.WOODCUTTING, getXPFromLevel(70));
      expect(await players.connect(alice).startAction(playerId, queuedAction, ActionQueueStatus.NONE)).to.not.be
        .reverted;
    });

    it("ActionChoices", async () => {});
    it("Consumeables", async () => {});
    it("Attire", async () => {});
    it("Left/Right equipment", async () => {
      const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);
      const rate = 100 * 100; // per hour
      const tx = await world.addAction({
        actionId: 1,
        info: {
          skill: Skill.WOODCUTTING,
          xpPerHour: 3600,
          minSkillPoints: 0,
          isDynamic: false,
          numSpawn: 0,
          handItemTokenIdRangeMin: ORCHALCUM_AXE,
          handItemTokenIdRangeMax: WOODCUTTING_MAX,
          isAvailable: true,
          actionChoiceRequired: false,
        },
        guaranteedRewards: [{itemTokenId: LOG, rate}],
        randomRewards: [],
        combatStats: emptyCombatStats,
      });
      const actionId = await getActionId(tx);

      const timespan = 3600;
      const queuedAction: QueuedAction = {
        attire: noAttire,
        actionId,
        combatStyle: CombatStyle.NONE,
        choiceId: NONE,
        choiceId1: NONE,
        choiceId2: NONE,
        regenerateId: NONE,
        timespan,
        rightHandEquipmentTokenId: ORCHALCUM_AXE,
        leftHandEquipmentTokenId: NONE,
        startTime: "0",
        isValid: true,
      };

      const minSkillPoints = getXPFromLevel(70);
      await itemNFT.addItem({
        ...defaultInputItem,
        skill: Skill.WOODCUTTING,
        minSkillPoints,
        tokenId: ORCHALCUM_AXE,
        equipPosition: EquipPosition.RIGHT_HAND,
        metadataURI: "someIPFSURI.json",
      });

      await itemNFT.testOnlyMint(alice.address, ORCHALCUM_AXE, 1);

      await expect(
        players.connect(alice).startAction(playerId, queuedAction, ActionQueueStatus.NONE)
      ).to.be.revertedWithCustomError(players, "ItemMinimumSkillPointsNotReached");

      // Update to level 70, check it works
      console.log(minSkillPoints);
      await players.testOnlyModifyLevel(playerId, Skill.WOODCUTTING, minSkillPoints);
      expect(await players.connect(alice).startAction(playerId, queuedAction, ActionQueueStatus.NONE)).to.not.be
        .reverted;
    });
  });

  /*  it("Check already equipped", async () => {
    const {playerId, players, playerNFT, itemNFT, alice} = await loadFixture(playersFixture);
    await itemNFT.testOnlyMint(alice.address, BRONZE_GAUNTLETS, 1);
    expect(await itemNFT.balanceOf(alice.address, BRONZE_GAUNTLETS)).to.eq(1);

    const combatStats: CombatStats = {
      melee: 2,
      magic: 0,
      range: 0,
      meleeDefence: -1,
      magicDefence: 0,
      rangeDefence: 0,
      health: 12,
    };

    await itemNFT.addItem({
      ...defaultInputItem,
      tokenId: BRONZE_GAUNTLETS,
      combatStats,
      equipPosition: EquipPosition.ARMS,
      metadataURI: "someIPFSURI.json",
    });

    // Check bonuses before
    const beforeStats = (await players.players(playerId)).totalStats;
    expect(beforeStats.melee).to.eq(0);
    expect(beforeStats.range).to.eq(0);
    expect(beforeStats.magic).to.eq(0);
    expect(beforeStats.meleeDefence).to.eq(0);
    expect(beforeStats.rangeDefence).to.eq(0);
    expect(beforeStats.magicDefence).to.eq(0);
    expect(beforeStats.health).to.eq(0);

    await players.connect(alice).equip(playerId, BRONZE_GAUNTLETS);

    // Check bonuses after
    const afterStats = (await players.players(playerId)).totalStats;
    expect(afterStats.melee).to.eq(2);
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

  /* Disabled for now as not used?
  it("Remove action", async () => {
    const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);

    // Can only remove an action if it hasn't started yet.
    const queuedActions: QueuedAction[] = [];
    const rate = 100 * 100; // per hour
    const tx = await world.addAction({
      actionId: 1,
      info: {
        skill: Skill.WOODCUTTING,
        xpPerHour: 3600,
        minSkillPoints: 0,
        isDynamic: false,
        numSpawn: 0,
        handItemTokenIdRangeMin: BRONZE_AXE,
        handItemTokenIdRangeMax: WOODCUTTING_MAX,
        isAvailable: actionIsAvailable,
        isCombat: false,
      },
      guaranteedRewards: [{itemTokenId: LOG, rate}],
      randomRewards: [],
      combatStats: emptyCombatStats,
    });
    const actionId = await getActionId(tx);
    await itemNFT.addItem({
      ...defaultInputItem,
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
      choiceId1: NONE,
      choiceId2: NONE,
      regenerateId: NONE,
      timespan,
      rightHandEquipmentTokenId: BRONZE_AXE,
      leftHandEquipmentTokenId: NONE,
      startTime: "0",
    };

    // Queue same ones multiple times
    queuedActions.push(queuedAction);
    queuedActions.push(queuedAction);
    queuedActions.push(queuedAction);

    await itemNFT.addItem({
      ...defaultInputItem,
      tokenId: LOG,
      equipPosition: EquipPosition.AUX,
      metadataURI: "someIPFSURI.json",
    });

    // This should fail because they don't have any logs. (Maybe later this detects from previous actions)
    await players.connect(alice).startActions(playerId, queuedActions, NONE, ActionQueueStatus.NONE);

    // Cannot remove the first one because it's already started
    let queueId = 1; // First one starts here
    await expect(players.connect(alice).removeQueuedAction(playerId, queueId)).to.be.reverted;
    expect(await players.actionQueueLength(playerId)).to.eq(3);
    await players.connect(alice).removeQueuedAction(playerId, queueId + 1);
    expect(await players.actionQueueLength(playerId)).to.eq(2);

    // Check the correct one remains
    const actionQueue = await players.getActionQueue(playerId);
    expect(actionQueue[0].attire.queueId).to.eq(queueId);
    expect(actionQueue[1].attire.queueId).to.eq(queueId + 2);
  }); */
});
