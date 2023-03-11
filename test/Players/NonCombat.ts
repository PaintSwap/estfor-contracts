import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {expect} from "chai";
import {ethers} from "hardhat";
import {
  ActionQueueStatus,
  BRONZE_AXE,
  BRONZE_PICKAXE,
  COAL_ORE,
  CombatStyle,
  COPPER_ORE,
  defaultInputItem,
  emptyCombatStats,
  EquipPosition,
  FIRE_LIGHTER,
  FIRE_MAX,
  getActionChoiceId,
  getActionId,
  LOG,
  MINING_MAX,
  MITHRIL_BAR,
  MITHRIL_ORE,
  NATURE_BODY,
  NATURE_BOOTS,
  NATURE_BRACERS,
  NATURE_MASK,
  NATURE_TROUSERS,
  noAttire,
  NONE,
  QueuedAction,
  Skill,
  WOODCUTTING_BASE,
  WOODCUTTING_MAX,
} from "../../scripts/utils";
import {playersFixture} from "./PlayersFixture";

const actionIsAvailable = true;

describe("Non-Combat Actions", () => {
  // Test minSkillPoints
  // Test isDynamic
  // Test incorrect item position and range
  it("Woodcutting", async () => {
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

    await ethers.provider.send("evm_increaseTime", [queuedAction.timespan + 2]);
    await ethers.provider.send("evm_mine", []);

    const playerDelegateView = await ethers.getContractAt("PlayerDelegateView", players.address);
    const pendingOutput = await playerDelegateView.pendingRewards(alice.address, playerId, {
      includeLoot: true,
      includePastRandomRewards: true,
      includeXPRewards: true,
    });
    expect(pendingOutput.consumed.length).is.eq(0);
    expect(pendingOutput.produced.length).is.eq(1);
    expect(pendingOutput.produced[0].itemTokenId).is.eq(LOG);
    const balanceExpected = Math.floor((timespan * rate) / (3600 * 100));
    expect(pendingOutput.produced[0].amount).is.eq(balanceExpected);
    await players.connect(alice).processActions(playerId);
    expect(await players.skillPoints(playerId, Skill.WOODCUTTING)).to.eq(queuedAction.timespan);
    // Check the drops are as expected
    expect(await itemNFT.balanceOf(alice.address, LOG)).to.eq(balanceExpected);
  });

  it("Woodcutting, full nature equipment", async () => {
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

    await itemNFT.addItem({
      ...defaultInputItem,
      tokenId: BRONZE_AXE,
      equipPosition: EquipPosition.RIGHT_HAND,
      metadataURI: "someIPFSURI.json",
    });

    await itemNFT.addItem({
      ...defaultInputItem,
      tokenId: NATURE_MASK,
      equipPosition: EquipPosition.HEAD,
      metadataURI: "someIPFSURI.json",
    });

    await itemNFT.addItem({
      ...defaultInputItem,
      tokenId: NATURE_BODY,
      equipPosition: EquipPosition.BODY,
      metadataURI: "someIPFSURI.json",
    });

    await itemNFT.addItem({
      ...defaultInputItem,
      tokenId: NATURE_BRACERS,
      equipPosition: EquipPosition.ARMS,
      metadataURI: "someIPFSURI.json",
    });

    await itemNFT.addItem({
      ...defaultInputItem,
      tokenId: NATURE_TROUSERS,
      equipPosition: EquipPosition.LEGS,
      metadataURI: "someIPFSURI.json",
    });

    await itemNFT.addItem({
      ...defaultInputItem,
      tokenId: NATURE_BOOTS,
      equipPosition: EquipPosition.BOOTS,
      metadataURI: "someIPFSURI.json",
    });

    const queuedAction: QueuedAction = {
      attire: {
        helmet: NATURE_MASK,
        amulet: NONE,
        armor: NATURE_BODY,
        gauntlets: NATURE_BRACERS,
        tassets: NATURE_TROUSERS,
        boots: NATURE_BOOTS,
        ring: NONE, // Always NONE for now
        reserved1: NONE, // Always NONE for now
        queueId: 0, // Doesn't matter
      },
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

    await itemNFT.testOnlyMints(
      alice.address,
      [NATURE_MASK, NATURE_BODY, NATURE_BRACERS, NATURE_TROUSERS, NATURE_BOOTS],
      [1, 1, 1, 1, 1]
    );

    await players.connect(alice).startAction(playerId, queuedAction, ActionQueueStatus.NONE);

    await ethers.provider.send("evm_increaseTime", [queuedAction.timespan + 2]);
    const balanceExpected = Math.floor((timespan * rate) / (3600 * 100));
    await players.connect(alice).processActions(playerId);
    expect(await players.skillPoints(playerId, Skill.WOODCUTTING)).to.eq(
      queuedAction.timespan + queuedAction.timespan * 0.03
    );
    // Check the drops are as expected
    expect(await itemNFT.balanceOf(alice.address, LOG)).to.eq(balanceExpected);
  });

  it("Firemaking", async () => {
    const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);
    const rate = 100 * 100; // per hour
    let tx = await world.addAction({
      actionId: 1,
      info: {
        skill: Skill.FIREMAKING,
        xpPerHour: 0,
        minSkillPoints: 0,
        isDynamic: false,
        numSpawn: 0,
        handItemTokenIdRangeMin: FIRE_LIGHTER,
        handItemTokenIdRangeMax: FIRE_MAX,
        isAvailable: actionIsAvailable,
        actionChoiceRequired: true,
      },
      guaranteedRewards: [],
      randomRewards: [],
      combatStats: emptyCombatStats,
    });
    const actionId = await getActionId(tx);

    // Logs go in, nothing comes out
    tx = await world.addActionChoice(actionId, 1, {
      skill: Skill.FIREMAKING,
      diff: 0,
      xpPerHour: 3600,
      minSkillPoints: 0,
      rate,
      inputTokenId1: LOG,
      num1: 1,
      inputTokenId2: NONE,
      num2: 0,
      inputTokenId3: NONE,
      num3: 0,
      outputTokenId: NONE,
      outputNum: 0,
    });
    const choiceId = await getActionChoiceId(tx);

    const timespan = 3600;
    const queuedAction: QueuedAction = {
      attire: noAttire,
      actionId,
      combatStyle: CombatStyle.NONE,
      choiceId,
      choiceId1: NONE,
      choiceId2: NONE,
      regenerateId: NONE,
      timespan,
      rightHandEquipmentTokenId: FIRE_LIGHTER,
      leftHandEquipmentTokenId: NONE,
      startTime: "0",
      isValid: true,
    };

    await itemNFT.addItem({
      ...defaultInputItem,
      tokenId: FIRE_LIGHTER,
      equipPosition: EquipPosition.RIGHT_HAND,
      metadataURI: "someIPFSURI.json",
    });

    await itemNFT.addItem({
      ...defaultInputItem,
      tokenId: LOG,
      equipPosition: EquipPosition.AUX,
      metadataURI: "someIPFSURI.json",
    });

    await itemNFT.testOnlyMint(alice.address, LOG, 5); // Mint less than will be used

    await players.connect(alice).startAction(playerId, queuedAction, ActionQueueStatus.NONE);

    await ethers.provider.send("evm_increaseTime", [queuedAction.timespan + 2]);
    await players.connect(alice).processActions(playerId);
    expect(await players.skillPoints(playerId, Skill.FIREMAKING)).to.eq(queuedAction.timespan);

    // Check how many logs they have now, 100 logs burnt per hour
    expect(await itemNFT.balanceOf(alice.address, LOG)).to.eq(0);
  });

  it("Multi skill appending, woodcutting + firemaking", async () => {
    const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);
    const queuedActions: QueuedAction[] = [];
    const rate = 1220 * 100; // per hour
    {
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
      await itemNFT.addItem({
        ...defaultInputItem,
        tokenId: BRONZE_AXE,
        equipPosition: EquipPosition.RIGHT_HAND,
        metadataURI: "someIPFSURI.json",
      });
      const timespan = 7200 + 10;
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

      queuedActions.push(queuedAction);
    }
    {
      let tx = await world.addAction({
        actionId: 2,
        info: {
          skill: Skill.FIREMAKING,
          xpPerHour: 0,
          minSkillPoints: 0,
          isDynamic: false,
          numSpawn: 0,
          handItemTokenIdRangeMin: FIRE_LIGHTER,
          handItemTokenIdRangeMax: FIRE_MAX,
          isAvailable: actionIsAvailable,
          actionChoiceRequired: true,
        },
        guaranteedRewards: [],
        randomRewards: [],
        combatStats: emptyCombatStats,
      });
      const actionId = await getActionId(tx);

      // Logs go in, nothing comes out
      tx = await world.addActionChoice(actionId, 1, {
        skill: Skill.FIREMAKING,
        diff: 0,
        xpPerHour: 3600,
        minSkillPoints: 0,
        rate,
        inputTokenId1: LOG,
        num1: 1,
        inputTokenId2: NONE,
        num2: 0,
        inputTokenId3: NONE,
        num3: 0,
        outputTokenId: NONE,
        outputNum: 0,
      });
      const choiceId = await getActionChoiceId(tx);

      await itemNFT.testOnlyMint(alice.address, FIRE_LIGHTER, 1);
      await itemNFT.addItem({
        ...defaultInputItem,
        tokenId: FIRE_LIGHTER,
        equipPosition: EquipPosition.RIGHT_HAND,
        metadataURI: "someIPFSURI.json",
      });
      const timespan = 3600;

      const queuedAction: QueuedAction = {
        attire: noAttire,
        actionId,
        combatStyle: CombatStyle.NONE,
        choiceId,
        choiceId1: NONE,
        choiceId2: NONE,
        regenerateId: NONE,
        timespan,
        rightHandEquipmentTokenId: FIRE_LIGHTER,
        leftHandEquipmentTokenId: NONE,
        startTime: "0",
        isValid: true,
      };

      queuedActions.push(queuedAction);
    }

    await itemNFT.addItem({
      ...defaultInputItem,
      tokenId: LOG,
      equipPosition: EquipPosition.AUX,
      metadataURI: "someIPFSURI.json",
    });

    await players.connect(alice).startAction(playerId, queuedActions[0], ActionQueueStatus.APPEND);
    await ethers.provider.send("evm_increaseTime", [10]);
    await players.connect(alice).startAction(playerId, queuedActions[1], ActionQueueStatus.APPEND);
    expect(await players.skillPoints(playerId, Skill.WOODCUTTING)).to.eq(10); // Should be partially completed
    expect(await itemNFT.balanceOf(alice.address, LOG)).to.eq(3);
    await ethers.provider.send("evm_increaseTime", [queuedActions[0].timespan + queuedActions[1].timespan]);
    expect(await players.actionQueueLength(playerId)).to.eq(2);

    await players.connect(alice).processActions(playerId);
    expect(await players.skillPoints(playerId, Skill.WOODCUTTING)).to.eq(queuedActions[0].timespan);
    expect(await players.skillPoints(playerId, Skill.FIREMAKING)).to.eq(queuedActions[1].timespan);
    // Check how many logs they have now, 1220 logs burnt per hour, 2 hours producing logs, 1 hour burning
    expect(await itemNFT.balanceOf(alice.address, LOG)).to.eq(
      Math.floor((queuedActions[0].timespan * rate) / (3600 * 100)) - rate / 100
    );
    // Action queue should be empty
    expect(await players.actionQueueLength(playerId)).to.eq(0);
  });

  it("Multi skill, woodcutting + firemaking", async () => {
    const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);
    const queuedActions: QueuedAction[] = [];
    const rate = 100 * 100; // per hour
    {
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

      queuedActions.push(queuedAction);
    }
    {
      let tx = await world.addAction({
        actionId: 2,
        info: {
          skill: Skill.FIREMAKING,
          xpPerHour: 0,
          minSkillPoints: 0,
          isDynamic: false,
          numSpawn: 0,
          handItemTokenIdRangeMin: FIRE_LIGHTER,
          handItemTokenIdRangeMax: FIRE_MAX,
          isAvailable: actionIsAvailable,
          actionChoiceRequired: true,
        },
        guaranteedRewards: [],
        randomRewards: [],
        combatStats: emptyCombatStats,
      });
      const actionId = await getActionId(tx);

      // Logs go in, nothing comes out
      tx = await world.addActionChoice(actionId, 1, {
        skill: Skill.FIREMAKING,
        diff: 0,
        xpPerHour: 3600,
        minSkillPoints: 0,
        rate,
        inputTokenId1: LOG,
        num1: 1,
        inputTokenId2: NONE,
        num2: 0,
        inputTokenId3: NONE,
        num3: 0,
        outputTokenId: NONE,
        outputNum: 0,
      });
      const choiceId = await getActionChoiceId(tx);

      await itemNFT.testOnlyMint(alice.address, FIRE_LIGHTER, 1);
      await itemNFT.addItem({
        ...defaultInputItem,
        tokenId: FIRE_LIGHTER,
        equipPosition: EquipPosition.RIGHT_HAND,
        metadataURI: "someIPFSURI.json",
      });
      const timespan = 3600;

      const queuedAction: QueuedAction = {
        attire: noAttire,
        actionId,
        combatStyle: CombatStyle.NONE,
        choiceId,
        choiceId1: NONE,
        choiceId2: NONE,
        regenerateId: NONE,
        timespan,
        rightHandEquipmentTokenId: FIRE_LIGHTER,
        leftHandEquipmentTokenId: NONE,
        startTime: "0",
        isValid: true,
      };

      queuedActions.push(queuedAction);
    }

    await itemNFT.addItem({
      ...defaultInputItem,
      tokenId: LOG,
      equipPosition: EquipPosition.AUX,
      metadataURI: "someIPFSURI.json",
    });

    // This should fail because they don't have any logs. (Maybe later this detects from previous actions)
    await expect(players.connect(alice).startActions(playerId, queuedActions, NONE, ActionQueueStatus.NONE)).to.be
      .reverted;

    await itemNFT.testOnlyMint(alice.address, LOG, 1);
    await players.connect(alice).startActions(playerId, queuedActions, NONE, ActionQueueStatus.NONE);

    await ethers.provider.send("evm_increaseTime", [queuedActions[0].timespan + queuedActions[1].timespan + 2]);
    await players.connect(alice).processActions(playerId);
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
    const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);

    const tx = await world.addAction({
      actionId: 1,
      info: {
        skill: Skill.MINING,
        xpPerHour: 3600,
        minSkillPoints: 0,
        isDynamic: false,
        numSpawn: 0,
        handItemTokenIdRangeMin: BRONZE_PICKAXE,
        handItemTokenIdRangeMax: MINING_MAX,
        isAvailable: actionIsAvailable,
        actionChoiceRequired: false,
      },
      guaranteedRewards: [{itemTokenId: COPPER_ORE, rate: 100}], // 100.00
      randomRewards: [],
      combatStats: emptyCombatStats,
    });

    const actionId = await getActionId(tx);

    await itemNFT.testOnlyMint(alice.address, BRONZE_PICKAXE, 1);
    const queuedAction: QueuedAction = {
      attire: noAttire,
      actionId,
      combatStyle: CombatStyle.NONE,
      choiceId: NONE,
      choiceId1: NONE,
      choiceId2: NONE,
      regenerateId: NONE,
      timespan: 100,
      rightHandEquipmentTokenId: BRONZE_PICKAXE,
      leftHandEquipmentTokenId: NONE,
      startTime: "0",
      isValid: true,
    };

    await itemNFT.addItem({
      ...defaultInputItem,
      tokenId: BRONZE_PICKAXE,
      equipPosition: EquipPosition.RIGHT_HAND,
      metadataURI: "someIPFSURI.json",
    });

    await players.connect(alice).startAction(playerId, queuedAction, ActionQueueStatus.NONE);

    await ethers.provider.send("evm_increaseTime", [queuedAction.timespan + 2]);
    await players.connect(alice).processActions(playerId);
    expect(await players.skillPoints(playerId, Skill.MINING)).to.eq(queuedAction.timespan);
  });

  it("Smithing", async () => {
    const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);
    const rate = 100 * 100; // per hour

    let tx = await world.addAction({
      actionId: 1,
      info: {
        skill: Skill.SMITHING,
        xpPerHour: 0,
        minSkillPoints: 0,
        isDynamic: false,
        numSpawn: 0,
        handItemTokenIdRangeMin: NONE,
        handItemTokenIdRangeMax: NONE,
        isAvailable: actionIsAvailable,
        actionChoiceRequired: true,
      },
      guaranteedRewards: [],
      randomRewards: [],
      combatStats: emptyCombatStats,
    });
    const actionId = await getActionId(tx);

    // Ores go in, bars come out
    tx = await world.addActionChoice(actionId, 1, {
      skill: Skill.SMITHING,
      diff: 0,
      xpPerHour: 3600,
      minSkillPoints: 0,
      rate,
      inputTokenId1: COAL_ORE,
      num1: 2,
      inputTokenId2: MITHRIL_ORE,
      num2: 1,
      inputTokenId3: NONE,
      num3: 0,
      outputTokenId: MITHRIL_BAR,
      outputNum: 1,
    });
    const choiceId = await getActionChoiceId(tx);

    const timespan = 3600;

    const queuedAction: QueuedAction = {
      attire: noAttire,
      actionId,
      combatStyle: CombatStyle.NONE,
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
      tokenId: COAL_ORE,
      equipPosition: EquipPosition.AUX,
      metadataURI: "someIPFSURI.json",
    });

    await itemNFT.addItem({
      ...defaultInputItem,
      tokenId: MITHRIL_ORE,
      equipPosition: EquipPosition.AUX,
      metadataURI: "someIPFSURI.json",
    });

    await itemNFT.testOnlyMint(alice.address, COAL_ORE, 255);
    await itemNFT.testOnlyMint(alice.address, MITHRIL_ORE, 255);
    await players.connect(alice).startAction(playerId, queuedAction, ActionQueueStatus.NONE);

    await ethers.provider.send("evm_increaseTime", [queuedAction.timespan + 2]);
    await players.connect(alice).processActions(playerId);
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

  it("Set past max timespan ", async () => {
    const {playerId, players, itemNFT, world, alice, maxTime} = await loadFixture(playersFixture);

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

    const timespan = maxTime + 1; // Exceed maximum
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

    await ethers.provider.send("evm_increaseTime", [queuedAction.timespan + 2]);
    await players.connect(alice).processActions(playerId);
    expect(await players.skillPoints(playerId, Skill.WOODCUTTING)).to.eq(queuedAction.timespan - 1);
    // Check the drops are as expected
    expect(await itemNFT.balanceOf(alice.address, LOG)).to.eq(
      Math.floor(((queuedAction.timespan - 1) * rate) / (3600 * 100))
    );
  });

  // TODO Rest of the actions

  it("Low rate action (more than 1 hour needed)", async () => {
    const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);
    await itemNFT.addItem({
      ...defaultInputItem,
      tokenId: BRONZE_AXE,
      equipPosition: EquipPosition.RIGHT_HAND,
      metadataURI: "someIPFSURI.json",
    });

    const rate = 0.1 * 100; // 0.1 per hour
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
    const timespan = 3600 * 19; // Should make 1
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

    await players.connect(alice).startAction(playerId, queuedAction, ActionQueueStatus.NONE);
    await ethers.provider.send("evm_increaseTime", [timespan]);
    await players.connect(alice).processActions(playerId);
    //      expect(await players.skillPoints(playerId, Skill.WOODCUTTING)).to.be.oneOf([361, 362]);
    expect(await itemNFT.balanceOf(alice.address, LOG)).to.eq(1); // Should be rounded down
  });

  it("Incorrect left/right hand equipment", async () => {
    const {playerId, players, itemNFT, world, alice, owner} = await loadFixture(playersFixture);

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
      rightHandEquipmentTokenId: BRONZE_PICKAXE, // Incorrect
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

    await itemNFT.addItem({
      ...defaultInputItem,
      tokenId: BRONZE_PICKAXE,
      equipPosition: EquipPosition.RIGHT_HAND,
      metadataURI: "someIPFSURI.json",
    });

    await expect(
      players.connect(alice).startAction(playerId, queuedAction, ActionQueueStatus.NONE)
    ).to.be.revertedWithCustomError(players, "InvalidArmEquipment");

    queuedAction.rightHandEquipmentTokenId = NONE;
    await expect(
      players.connect(alice).startAction(playerId, queuedAction, ActionQueueStatus.NONE)
    ).to.be.revertedWithCustomError(players, "IncorrectEquippedItem");

    queuedAction.leftHandEquipmentTokenId = BRONZE_AXE;
    queuedAction.rightHandEquipmentTokenId = BRONZE_AXE;
    await expect(
      players.connect(alice).startAction(playerId, queuedAction, ActionQueueStatus.NONE)
    ).to.be.revertedWithCustomError(players, "IncorrectLeftHandEquipment");

    queuedAction.leftHandEquipmentTokenId = NONE;
    queuedAction.rightHandEquipmentTokenId = BRONZE_AXE;
    await itemNFT.connect(alice).safeTransferFrom(alice.address, owner.address, BRONZE_AXE, 1, "0x");
    await expect(
      players.connect(alice).startAction(playerId, queuedAction, ActionQueueStatus.NONE)
    ).to.be.revertedWithCustomError(players, "DoNotHaveEnoughQuantityToEquipToAction");

    await itemNFT.testOnlyMint(alice.address, BRONZE_AXE, 1);

    // This works
    await players.connect(alice).startAction(playerId, queuedAction, ActionQueueStatus.NONE);

    // Specifying a combat style should fail
    queuedAction.combatStyle = CombatStyle.MELEE;
    await expect(
      players.connect(alice).startAction(playerId, queuedAction, ActionQueueStatus.NONE)
    ).to.be.revertedWithCustomError(players, "InvalidCombatStyle");

    // Transfer away, the action should just be skipped and no xp/loot should be given
    expect(await itemNFT.balanceOf(alice.address, BRONZE_AXE)).to.eq(1);
    await itemNFT.connect(alice).safeTransferFrom(alice.address, owner.address, BRONZE_AXE, 1, "0x");
    expect(await itemNFT.balanceOf(alice.address, BRONZE_AXE)).to.eq(0);
    await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]);
    await players.connect(alice).processActions(playerId);
    expect(await players.skillPoints(playerId, Skill.WOODCUTTING)).to.eq(0);
    expect(await itemNFT.balanceOf(alice.address, LOG)).to.eq(0);
  });

  it("Action pipelining", async () => {
    // Try wood cut, and then burning them when having none equipped
  });

  it("Attire, equipment and conusmeable minSkillPoints", async () => {
    // TODO
  });

  it("Action minSkillPoints", async () => {
    // TODO
  });

  it("ActionChoice minSkillPoints", async () => {
    // TODO
  });
});
