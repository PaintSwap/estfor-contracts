import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {EstforConstants, EstforTypes} from "@paintswap/estfor-definitions";
import {expect} from "chai";
import {ethers} from "hardhat";
import {getActionChoiceId, getActionId} from "../../scripts/utils";
import {playersFixture} from "./PlayersFixture";
import {setupBasicWoodcutting} from "./utils";

const actionIsAvailable = true;

describe("Non-Combat Actions", () => {
  // Test isDynamic
  it("Woodcutting", async () => {
    const {playerId, players, itemNFT, alice} = await loadFixture(playersFixture);

    const {queuedAction, timespan, rate} = await setupBasicWoodcutting();

    await players.connect(alice).startAction(playerId, queuedAction, EstforTypes.ActionQueueStatus.NONE);

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
    expect(pendingOutput.produced[0].itemTokenId).is.eq(EstforConstants.LOG);
    const balanceExpected = Math.floor((timespan * rate) / (3600 * 100));
    expect(pendingOutput.produced[0].amount).is.eq(balanceExpected);
    await players.connect(alice).processActions(playerId);
    expect(await players.skillPoints(playerId, EstforTypes.Skill.WOODCUTTING)).to.eq(queuedAction.timespan);
    // Check the drops are as expected
    expect(await itemNFT.balanceOf(alice.address, EstforConstants.LOG)).to.eq(balanceExpected);
  });

  it("Woodcutting, full nature equipment", async () => {
    const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);

    const rate = 100 * 100; // per hour
    const tx = await world.addAction({
      actionId: 1,
      info: {
        skill: EstforTypes.Skill.WOODCUTTING,
        xpPerHour: 3600,
        minSkillPoints: 0,
        isDynamic: false,
        numSpawn: 0,
        handItemTokenIdRangeMin: EstforConstants.BRONZE_AXE,
        handItemTokenIdRangeMax: EstforConstants.WOODCUTTING_MAX,
        isAvailable: actionIsAvailable,
        actionChoiceRequired: false,
      },
      guaranteedRewards: [{itemTokenId: EstforConstants.LOG, rate}],
      randomRewards: [],
      combatStats: EstforTypes.emptyCombatStats,
    });
    const actionId = await getActionId(tx);

    const timespan = 3600;

    await itemNFT.addItem({
      ...EstforTypes.defaultInputItem,
      tokenId: EstforConstants.BRONZE_AXE,
      equipPosition: EstforTypes.EquipPosition.RIGHT_HAND,
      metadataURI: "someIPFSURI.json",
    });

    await itemNFT.addItem({
      ...EstforTypes.defaultInputItem,
      tokenId: EstforConstants.NATURE_MASK,
      equipPosition: EstforTypes.EquipPosition.HEAD,
      metadataURI: "someIPFSURI.json",
    });

    await itemNFT.addItem({
      ...EstforTypes.defaultInputItem,
      tokenId: EstforConstants.NATURE_BODY,
      equipPosition: EstforTypes.EquipPosition.BODY,
      metadataURI: "someIPFSURI.json",
    });

    await itemNFT.addItem({
      ...EstforTypes.defaultInputItem,
      tokenId: EstforConstants.NATURE_BRACERS,
      equipPosition: EstforTypes.EquipPosition.ARMS,
      metadataURI: "someIPFSURI.json",
    });

    await itemNFT.addItem({
      ...EstforTypes.defaultInputItem,
      tokenId: EstforConstants.NATURE_TROUSERS,
      equipPosition: EstforTypes.EquipPosition.LEGS,
      metadataURI: "someIPFSURI.json",
    });

    await itemNFT.addItem({
      ...EstforTypes.defaultInputItem,
      tokenId: EstforConstants.NATURE_BOOTS,
      equipPosition: EstforTypes.EquipPosition.BOOTS,
      metadataURI: "someIPFSURI.json",
    });

    const queuedAction: EstforTypes.QueuedAction = {
      attire: {
        helmet: EstforConstants.NATURE_MASK,
        amulet: EstforConstants.NONE,
        armor: EstforConstants.NATURE_BODY,
        gauntlets: EstforConstants.NATURE_BRACERS,
        tassets: EstforConstants.NATURE_TROUSERS,
        boots: EstforConstants.NATURE_BOOTS,
        ring: EstforConstants.NONE, // Always NONE for now
        reserved1: EstforConstants.NONE, // Always NONE for now
        queueId: 0, // Doesn't matter
      },
      actionId,
      combatStyle: EstforTypes.CombatStyle.NONE,
      choiceId: EstforConstants.NONE,
      choiceId1: EstforConstants.NONE,
      choiceId2: EstforConstants.NONE,
      regenerateId: EstforConstants.NONE,
      timespan,
      rightHandEquipmentTokenId: EstforConstants.BRONZE_AXE,
      leftHandEquipmentTokenId: EstforConstants.NONE,
      startTime: "0",
      isValid: true,
    };

    await itemNFT.testOnlyMints(
      alice.address,
      [
        EstforConstants.NATURE_MASK,
        EstforConstants.NATURE_BODY,
        EstforConstants.NATURE_BRACERS,
        EstforConstants.NATURE_TROUSERS,
        EstforConstants.NATURE_BOOTS,
      ],
      [1, 1, 1, 1, 1]
    );

    await players.connect(alice).startAction(playerId, queuedAction, EstforTypes.ActionQueueStatus.NONE);

    await ethers.provider.send("evm_increaseTime", [queuedAction.timespan + 2]);
    const balanceExpected = Math.floor((timespan * rate) / (3600 * 100));
    await players.connect(alice).processActions(playerId);
    expect(await players.skillPoints(playerId, EstforTypes.Skill.WOODCUTTING)).to.eq(
      queuedAction.timespan + queuedAction.timespan * 0.03
    );
    // Check the drops are as expected
    expect(await itemNFT.balanceOf(alice.address, EstforConstants.LOG)).to.eq(balanceExpected);
  });

  it("Firemaking", async () => {
    const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);
    const rate = 100 * 100; // per hour
    let tx = await world.addAction({
      actionId: 1,
      info: {
        skill: EstforTypes.Skill.FIREMAKING,
        xpPerHour: 0,
        minSkillPoints: 0,
        isDynamic: false,
        numSpawn: 0,
        handItemTokenIdRangeMin: EstforConstants.MAGIC_FIRE_STARTER,
        handItemTokenIdRangeMax: EstforConstants.FIRE_MAX,
        isAvailable: actionIsAvailable,
        actionChoiceRequired: true,
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
      minSkillPoints: 0,
      rate,
      inputTokenId1: EstforConstants.LOG,
      num1: 1,
      inputTokenId2: EstforConstants.NONE,
      num2: 0,
      inputTokenId3: EstforConstants.NONE,
      num3: 0,
      outputTokenId: EstforConstants.NONE,
      outputNum: 0,
    });
    const choiceId = await getActionChoiceId(tx);

    const timespan = 3600;
    const queuedAction: EstforTypes.QueuedAction = {
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
      startTime: "0",
      isValid: true,
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

    await itemNFT.testOnlyMint(alice.address, EstforConstants.LOG, 5); // Mint less than will be used

    await players.connect(alice).startAction(playerId, queuedAction, EstforTypes.ActionQueueStatus.NONE);

    await ethers.provider.send("evm_increaseTime", [queuedAction.timespan + 2]);
    await players.connect(alice).processActions(playerId);
    expect(await players.skillPoints(playerId, EstforTypes.Skill.FIREMAKING)).to.eq(queuedAction.timespan);

    // Check how many logs they have now, 100 logs burnt per hour
    expect(await itemNFT.balanceOf(alice.address, EstforConstants.LOG)).to.eq(0);
  });

  it("Multi skill appending, woodcutting + firemaking", async () => {
    const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);
    const queuedActions: EstforTypes.QueuedAction[] = [];
    const rate = 1220 * 100; // per hour
    {
      const tx = await world.addAction({
        actionId: 1,
        info: {
          skill: EstforTypes.Skill.WOODCUTTING,
          xpPerHour: 3600,
          minSkillPoints: 0,
          isDynamic: false,
          numSpawn: 0,
          handItemTokenIdRangeMin: EstforConstants.BRONZE_AXE,
          handItemTokenIdRangeMax: EstforConstants.WOODCUTTING_MAX,
          isAvailable: actionIsAvailable,
          actionChoiceRequired: false,
        },
        guaranteedRewards: [{itemTokenId: EstforConstants.LOG, rate}],
        randomRewards: [],
        combatStats: EstforTypes.emptyCombatStats,
      });
      const actionId = await getActionId(tx);
      await itemNFT.addItem({
        ...EstforTypes.defaultInputItem,
        tokenId: EstforConstants.BRONZE_AXE,
        equipPosition: EstforTypes.EquipPosition.RIGHT_HAND,
        metadataURI: "someIPFSURI.json",
      });
      const timespan = 7200 + 10;
      const queuedAction: EstforTypes.QueuedAction = {
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
        startTime: "0",
        isValid: true,
      };

      queuedActions.push(queuedAction);
    }
    {
      let tx = await world.addAction({
        actionId: 2,
        info: {
          skill: EstforTypes.Skill.FIREMAKING,
          xpPerHour: 0,
          minSkillPoints: 0,
          isDynamic: false,
          numSpawn: 0,
          handItemTokenIdRangeMin: EstforConstants.MAGIC_FIRE_STARTER,
          handItemTokenIdRangeMax: EstforConstants.FIRE_MAX,
          isAvailable: actionIsAvailable,
          actionChoiceRequired: true,
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
        minSkillPoints: 0,
        rate,
        inputTokenId1: EstforConstants.LOG,
        num1: 1,
        inputTokenId2: EstforConstants.NONE,
        num2: 0,
        inputTokenId3: EstforConstants.NONE,
        num3: 0,
        outputTokenId: EstforConstants.NONE,
        outputNum: 0,
      });
      const choiceId = await getActionChoiceId(tx);

      await itemNFT.testOnlyMint(alice.address, EstforConstants.MAGIC_FIRE_STARTER, 1);
      await itemNFT.addItem({
        ...EstforTypes.defaultInputItem,
        tokenId: EstforConstants.MAGIC_FIRE_STARTER,
        equipPosition: EstforTypes.EquipPosition.RIGHT_HAND,
        metadataURI: "someIPFSURI.json",
      });
      const timespan = 3600;

      const queuedAction: EstforTypes.QueuedAction = {
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
        startTime: "0",
        isValid: true,
      };

      queuedActions.push(queuedAction);
    }

    await itemNFT.addItem({
      ...EstforTypes.defaultInputItem,
      tokenId: EstforConstants.LOG,
      equipPosition: EstforTypes.EquipPosition.AUX,
      metadataURI: "someIPFSURI.json",
    });

    await players.connect(alice).startAction(playerId, queuedActions[0], EstforTypes.ActionQueueStatus.APPEND);
    await ethers.provider.send("evm_increaseTime", [10]);
    await players.connect(alice).startAction(playerId, queuedActions[1], EstforTypes.ActionQueueStatus.APPEND);
    expect(await players.skillPoints(playerId, EstforTypes.Skill.WOODCUTTING)).to.eq(10); // Should be partially completed
    expect(await itemNFT.balanceOf(alice.address, EstforConstants.LOG)).to.eq(3);
    await ethers.provider.send("evm_increaseTime", [queuedActions[0].timespan + queuedActions[1].timespan]);
    expect(await players.actionQueueLength(playerId)).to.eq(2);

    await players.connect(alice).processActions(playerId);
    expect(await players.skillPoints(playerId, EstforTypes.Skill.WOODCUTTING)).to.eq(queuedActions[0].timespan);
    expect(await players.skillPoints(playerId, EstforTypes.Skill.FIREMAKING)).to.eq(queuedActions[1].timespan);
    // Check how many logs they have now, 1220 logs burnt per hour, 2 hours producing logs, 1 hour burning
    expect(await itemNFT.balanceOf(alice.address, EstforConstants.LOG)).to.eq(
      Math.floor((queuedActions[0].timespan * rate) / (3600 * 100)) - rate / 100
    );
    // Action queue should be empty
    expect(await players.actionQueueLength(playerId)).to.eq(0);
  });

  it("Multi skill, woodcutting + firemaking", async () => {
    const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);
    const queuedActions: EstforTypes.QueuedAction[] = [];
    const rate = 100 * 100; // per hour
    {
      const tx = await world.addAction({
        actionId: 1,
        info: {
          skill: EstforTypes.Skill.WOODCUTTING,
          xpPerHour: 3600,
          minSkillPoints: 0,
          isDynamic: false,
          numSpawn: 0,
          handItemTokenIdRangeMin: EstforConstants.BRONZE_AXE,
          handItemTokenIdRangeMax: EstforConstants.WOODCUTTING_MAX,
          isAvailable: actionIsAvailable,
          actionChoiceRequired: false,
        },
        guaranteedRewards: [{itemTokenId: EstforConstants.LOG, rate}],
        randomRewards: [],
        combatStats: EstforTypes.emptyCombatStats,
      });
      const actionId = await getActionId(tx);
      await itemNFT.addItem({
        ...EstforTypes.defaultInputItem,
        tokenId: EstforConstants.BRONZE_AXE,
        equipPosition: EstforTypes.EquipPosition.RIGHT_HAND,
        metadataURI: "someIPFSURI.json",
      });
      const timespan = 7200;
      const queuedAction: EstforTypes.QueuedAction = {
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
        startTime: "0",
        isValid: true,
      };

      queuedActions.push(queuedAction);
    }
    {
      let tx = await world.addAction({
        actionId: 2,
        info: {
          skill: EstforTypes.Skill.FIREMAKING,
          xpPerHour: 0,
          minSkillPoints: 0,
          isDynamic: false,
          numSpawn: 0,
          handItemTokenIdRangeMin: EstforConstants.MAGIC_FIRE_STARTER,
          handItemTokenIdRangeMax: EstforConstants.FIRE_MAX,
          isAvailable: actionIsAvailable,
          actionChoiceRequired: true,
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
        minSkillPoints: 0,
        rate,
        inputTokenId1: EstforConstants.LOG,
        num1: 1,
        inputTokenId2: EstforConstants.NONE,
        num2: 0,
        inputTokenId3: EstforConstants.NONE,
        num3: 0,
        outputTokenId: EstforConstants.NONE,
        outputNum: 0,
      });
      const choiceId = await getActionChoiceId(tx);

      await itemNFT.testOnlyMint(alice.address, EstforConstants.MAGIC_FIRE_STARTER, 1);
      await itemNFT.addItem({
        ...EstforTypes.defaultInputItem,
        tokenId: EstforConstants.MAGIC_FIRE_STARTER,
        equipPosition: EstforTypes.EquipPosition.RIGHT_HAND,
        metadataURI: "someIPFSURI.json",
      });
      const timespan = 3600;

      const queuedAction: EstforTypes.QueuedAction = {
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
        startTime: "0",
        isValid: true,
      };

      queuedActions.push(queuedAction);
    }

    await itemNFT.addItem({
      ...EstforTypes.defaultInputItem,
      tokenId: EstforConstants.LOG,
      equipPosition: EstforTypes.EquipPosition.AUX,
      metadataURI: "someIPFSURI.json",
    });

    // This should fail because they don't have any logs. (Maybe later this detects from previous actions)
    await expect(
      players
        .connect(alice)
        .startActions(playerId, queuedActions, EstforConstants.NONE, EstforTypes.ActionQueueStatus.NONE)
    ).to.be.reverted;

    await itemNFT.testOnlyMint(alice.address, EstforConstants.LOG, 1);
    await players
      .connect(alice)
      .startActions(playerId, queuedActions, EstforConstants.NONE, EstforTypes.ActionQueueStatus.NONE);

    await ethers.provider.send("evm_increaseTime", [queuedActions[0].timespan + queuedActions[1].timespan + 2]);
    await players.connect(alice).processActions(playerId);
    expect(await players.skillPoints(playerId, EstforTypes.Skill.WOODCUTTING)).to.eq(queuedActions[0].timespan);
    expect(await players.skillPoints(playerId, EstforTypes.Skill.FIREMAKING)).to.eq(queuedActions[1].timespan);
    // Check how many logs they have now, 100 logs burnt per hour, 2 hours producing logs, 1 hour burning
    expect(await itemNFT.balanceOf(alice.address, EstforConstants.LOG)).to.eq(
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
        skill: EstforTypes.Skill.MINING,
        xpPerHour: 3600,
        minSkillPoints: 0,
        isDynamic: false,
        numSpawn: 0,
        handItemTokenIdRangeMin: EstforConstants.BRONZE_PICKAXE,
        handItemTokenIdRangeMax: EstforConstants.MINING_MAX,
        isAvailable: actionIsAvailable,
        actionChoiceRequired: false,
      },
      guaranteedRewards: [{itemTokenId: EstforConstants.COPPER_ORE, rate: 100}], // 100.00
      randomRewards: [],
      combatStats: EstforTypes.emptyCombatStats,
    });

    const actionId = await getActionId(tx);

    await itemNFT.testOnlyMint(alice.address, EstforConstants.BRONZE_PICKAXE, 1);
    const queuedAction: EstforTypes.QueuedAction = {
      attire: EstforTypes.noAttire,
      actionId,
      combatStyle: EstforTypes.CombatStyle.NONE,
      choiceId: EstforConstants.NONE,
      choiceId1: EstforConstants.NONE,
      choiceId2: EstforConstants.NONE,
      regenerateId: EstforConstants.NONE,
      timespan: 100,
      rightHandEquipmentTokenId: EstforConstants.BRONZE_PICKAXE,
      leftHandEquipmentTokenId: EstforConstants.NONE,
      startTime: "0",
      isValid: true,
    };

    await itemNFT.addItem({
      ...EstforTypes.defaultInputItem,
      tokenId: EstforConstants.BRONZE_PICKAXE,
      equipPosition: EstforTypes.EquipPosition.RIGHT_HAND,
      metadataURI: "someIPFSURI.json",
    });

    await players.connect(alice).startAction(playerId, queuedAction, EstforTypes.ActionQueueStatus.NONE);

    await ethers.provider.send("evm_increaseTime", [queuedAction.timespan + 2]);
    await players.connect(alice).processActions(playerId);
    expect(await players.skillPoints(playerId, EstforTypes.Skill.MINING)).to.eq(queuedAction.timespan);
  });

  it("Smithing", async () => {
    const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);
    const rate = 100 * 100; // per hour

    let tx = await world.addAction({
      actionId: 1,
      info: {
        skill: EstforTypes.Skill.SMITHING,
        xpPerHour: 0,
        minSkillPoints: 0,
        isDynamic: false,
        numSpawn: 0,
        handItemTokenIdRangeMin: EstforConstants.NONE,
        handItemTokenIdRangeMax: EstforConstants.NONE,
        isAvailable: actionIsAvailable,
        actionChoiceRequired: true,
      },
      guaranteedRewards: [],
      randomRewards: [],
      combatStats: EstforTypes.emptyCombatStats,
    });
    const actionId = await getActionId(tx);

    // Ores go in, bars come out
    tx = await world.addActionChoice(actionId, 1, {
      skill: EstforTypes.Skill.SMITHING,
      diff: 0,
      xpPerHour: 3600,
      minSkillPoints: 0,
      rate,
      inputTokenId1: EstforConstants.COAL_ORE,
      num1: 2,
      inputTokenId2: EstforConstants.MITHRIL_ORE,
      num2: 1,
      inputTokenId3: EstforConstants.NONE,
      num3: 0,
      outputTokenId: EstforConstants.MITHRIL_BAR,
      outputNum: 1,
    });
    const choiceId = await getActionChoiceId(tx);

    const timespan = 3600;

    const queuedAction: EstforTypes.QueuedAction = {
      attire: EstforTypes.noAttire,
      actionId,
      combatStyle: EstforTypes.CombatStyle.NONE,
      choiceId,
      choiceId1: EstforConstants.NONE,
      choiceId2: EstforConstants.NONE,
      regenerateId: EstforConstants.NONE,
      timespan,
      rightHandEquipmentTokenId: EstforConstants.NONE,
      leftHandEquipmentTokenId: EstforConstants.NONE,
      startTime: "0",
      isValid: true,
    };

    await itemNFT.addItem({
      ...EstforTypes.defaultInputItem,
      tokenId: EstforConstants.COAL_ORE,
      equipPosition: EstforTypes.EquipPosition.AUX,
      metadataURI: "someIPFSURI.json",
    });

    await itemNFT.addItem({
      ...EstforTypes.defaultInputItem,
      tokenId: EstforConstants.MITHRIL_ORE,
      equipPosition: EstforTypes.EquipPosition.AUX,
      metadataURI: "someIPFSURI.json",
    });

    await itemNFT.testOnlyMint(alice.address, EstforConstants.COAL_ORE, 255);
    await itemNFT.testOnlyMint(alice.address, EstforConstants.MITHRIL_ORE, 255);
    await players.connect(alice).startAction(playerId, queuedAction, EstforTypes.ActionQueueStatus.NONE);

    await ethers.provider.send("evm_increaseTime", [queuedAction.timespan + 2]);
    await players.connect(alice).processActions(playerId);
    expect(await players.skillPoints(playerId, EstforTypes.Skill.SMITHING)).to.eq(queuedAction.timespan);

    // Check how many bars they have now, 100 bars created per hour, burns 2 coal and 1 mithril
    expect(await itemNFT.balanceOf(alice.address, EstforConstants.MITHRIL_BAR)).to.eq(
      Math.floor((timespan * rate) / (3600 * 100))
    );
    expect(await itemNFT.balanceOf(alice.address, EstforConstants.COAL_ORE)).to.eq(
      255 - Math.floor((timespan * rate) / (3600 * 100)) * 2
    );
    expect(await itemNFT.balanceOf(alice.address, EstforConstants.MITHRIL_ORE)).to.eq(
      255 - Math.floor((timespan * rate) / (3600 * 100))
    );
  });

  it("Set past max timespan ", async () => {
    const {playerId, players, itemNFT, world, alice, maxTime} = await loadFixture(playersFixture);

    const rate = 100 * 100; // per hour
    const tx = await world.addAction({
      actionId: 1,
      info: {
        skill: EstforTypes.Skill.WOODCUTTING,
        xpPerHour: 3600,
        minSkillPoints: 0,
        isDynamic: false,
        numSpawn: 0,
        handItemTokenIdRangeMin: EstforConstants.BRONZE_AXE,
        handItemTokenIdRangeMax: EstforConstants.WOODCUTTING_MAX,
        isAvailable: actionIsAvailable,
        actionChoiceRequired: false,
      },
      guaranteedRewards: [{itemTokenId: EstforConstants.LOG, rate}],
      randomRewards: [],
      combatStats: EstforTypes.emptyCombatStats,
    });
    const actionId = await getActionId(tx);

    const timespan = maxTime + 1; // Exceed maximum
    const queuedAction: EstforTypes.QueuedAction = {
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
      startTime: "0",
      isValid: true,
    };

    await itemNFT.addItem({
      ...EstforTypes.defaultInputItem,
      tokenId: EstforConstants.BRONZE_AXE,
      equipPosition: EstforTypes.EquipPosition.RIGHT_HAND,
      metadataURI: "someIPFSURI.json",
    });

    await players.connect(alice).startAction(playerId, queuedAction, EstforTypes.ActionQueueStatus.NONE);

    await ethers.provider.send("evm_increaseTime", [queuedAction.timespan + 2]);
    await players.connect(alice).processActions(playerId);
    expect(await players.skillPoints(playerId, EstforTypes.Skill.WOODCUTTING)).to.eq(queuedAction.timespan - 1);
    // Check the drops are as expected
    expect(await itemNFT.balanceOf(alice.address, EstforConstants.LOG)).to.eq(
      Math.floor(((queuedAction.timespan - 1) * rate) / (3600 * 100))
    );
  });

  // TODO Rest of the actions

  it("Low rate action (more than 1 hour needed)", async () => {
    const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);
    await itemNFT.addItem({
      ...EstforTypes.defaultInputItem,
      tokenId: EstforConstants.BRONZE_AXE,
      equipPosition: EstforTypes.EquipPosition.RIGHT_HAND,
      metadataURI: "someIPFSURI.json",
    });

    const rate = 0.1 * 100; // 0.1 per hour
    const tx = await world.addAction({
      actionId: 1,
      info: {
        skill: EstforTypes.Skill.WOODCUTTING,
        xpPerHour: 3600,
        minSkillPoints: 0,
        isDynamic: false,
        numSpawn: 0,
        handItemTokenIdRangeMin: EstforConstants.WOODCUTTING_BASE,
        handItemTokenIdRangeMax: EstforConstants.WOODCUTTING_MAX,
        isAvailable: actionIsAvailable,
        actionChoiceRequired: false,
      },
      guaranteedRewards: [{itemTokenId: EstforConstants.LOG, rate}],
      randomRewards: [],
      combatStats: EstforTypes.emptyCombatStats,
    });

    const actionId = await getActionId(tx);
    const timespan = 3600 * 19; // Should make 1
    const queuedAction: EstforTypes.QueuedAction = {
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
      startTime: "0",
      isValid: true,
    };

    await players.connect(alice).startAction(playerId, queuedAction, EstforTypes.ActionQueueStatus.NONE);
    await ethers.provider.send("evm_increaseTime", [timespan]);
    await players.connect(alice).processActions(playerId);
    //      expect(await players.skillPoints(playerId,EstforTypes.Skill.WOODCUTTING)).to.be.oneOf([361, 362]);
    expect(await itemNFT.balanceOf(alice.address, EstforConstants.LOG)).to.eq(1); // Should be rounded down
  });

  it("Incorrect left/right hand equipment", async () => {
    const {playerId, players, itemNFT, world, alice, owner} = await loadFixture(playersFixture);

    const rate = 100 * 100; // per hour
    const tx = await world.addAction({
      actionId: 1,
      info: {
        skill: EstforTypes.Skill.WOODCUTTING,
        xpPerHour: 3600,
        minSkillPoints: 0,
        isDynamic: false,
        numSpawn: 0,
        handItemTokenIdRangeMin: EstforConstants.BRONZE_AXE,
        handItemTokenIdRangeMax: EstforConstants.WOODCUTTING_MAX,
        isAvailable: actionIsAvailable,
        actionChoiceRequired: false,
      },
      guaranteedRewards: [{itemTokenId: EstforConstants.LOG, rate}],
      randomRewards: [],
      combatStats: EstforTypes.emptyCombatStats,
    });
    const actionId = await getActionId(tx);

    const timespan = 3600;
    const queuedAction: EstforTypes.QueuedAction = {
      attire: EstforTypes.noAttire,
      actionId,
      combatStyle: EstforTypes.CombatStyle.NONE,
      choiceId: EstforConstants.NONE,
      choiceId1: EstforConstants.NONE,
      choiceId2: EstforConstants.NONE,
      regenerateId: EstforConstants.NONE,
      timespan,
      rightHandEquipmentTokenId: EstforConstants.BRONZE_PICKAXE, // Incorrect
      leftHandEquipmentTokenId: EstforConstants.NONE,
      startTime: "0",
      isValid: true,
    };

    await itemNFT.addItem({
      ...EstforTypes.defaultInputItem,
      tokenId: EstforConstants.BRONZE_AXE,
      equipPosition: EstforTypes.EquipPosition.RIGHT_HAND,
      metadataURI: "someIPFSURI.json",
    });

    await itemNFT.addItem({
      ...EstforTypes.defaultInputItem,
      tokenId: EstforConstants.BRONZE_PICKAXE,
      equipPosition: EstforTypes.EquipPosition.RIGHT_HAND,
      metadataURI: "someIPFSURI.json",
    });

    await expect(
      players.connect(alice).startAction(playerId, queuedAction, EstforTypes.ActionQueueStatus.NONE)
    ).to.be.revertedWithCustomError(players, "InvalidArmEquipment");

    queuedAction.rightHandEquipmentTokenId = EstforConstants.NONE;
    await expect(
      players.connect(alice).startAction(playerId, queuedAction, EstforTypes.ActionQueueStatus.NONE)
    ).to.be.revertedWithCustomError(players, "IncorrectEquippedItem");

    queuedAction.leftHandEquipmentTokenId = EstforConstants.BRONZE_AXE;
    queuedAction.rightHandEquipmentTokenId = EstforConstants.BRONZE_AXE;
    await expect(
      players.connect(alice).startAction(playerId, queuedAction, EstforTypes.ActionQueueStatus.NONE)
    ).to.be.revertedWithCustomError(players, "IncorrectLeftHandEquipment");

    queuedAction.leftHandEquipmentTokenId = EstforConstants.NONE;
    queuedAction.rightHandEquipmentTokenId = EstforConstants.BRONZE_AXE;
    await itemNFT.connect(alice).safeTransferFrom(alice.address, owner.address, EstforConstants.BRONZE_AXE, 1, "0x");
    await expect(
      players.connect(alice).startAction(playerId, queuedAction, EstforTypes.ActionQueueStatus.NONE)
    ).to.be.revertedWithCustomError(players, "DoNotHaveEnoughQuantityToEquipToAction");

    await itemNFT.testOnlyMint(alice.address, EstforConstants.BRONZE_AXE, 1);

    // This works
    await players.connect(alice).startAction(playerId, queuedAction, EstforTypes.ActionQueueStatus.NONE);

    // Specifying a combat style should fail
    queuedAction.combatStyle = EstforTypes.CombatStyle.MELEE;
    await expect(
      players.connect(alice).startAction(playerId, queuedAction, EstforTypes.ActionQueueStatus.NONE)
    ).to.be.revertedWithCustomError(players, "InvalidCombatStyle");

    // Transfer away, the action should just be skipped and no xp/loot should be given
    expect(await itemNFT.balanceOf(alice.address, EstforConstants.BRONZE_AXE)).to.eq(1);
    await itemNFT.connect(alice).safeTransferFrom(alice.address, owner.address, EstforConstants.BRONZE_AXE, 1, "0x");
    expect(await itemNFT.balanceOf(alice.address, EstforConstants.BRONZE_AXE)).to.eq(0);
    await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]);
    await players.connect(alice).processActions(playerId);
    expect(await players.skillPoints(playerId, EstforTypes.Skill.WOODCUTTING)).to.eq(0);
    expect(await itemNFT.balanceOf(alice.address, EstforConstants.LOG)).to.eq(0);
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
