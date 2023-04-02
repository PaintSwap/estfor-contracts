import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {EstforConstants, EstforTypes} from "@paintswap/estfor-definitions";
import {Skill} from "@paintswap/estfor-definitions/types";
import {expect} from "chai";
import {ethers} from "hardhat";
import {allPendingFlags, getActionChoiceId, getActionId, getRequestId} from "../utils";
import {playersFixture} from "./PlayersFixture";
import {getXPFromLevel, setupBasicWoodcutting} from "./utils";

const actionIsAvailable = true;

describe("Non-Combat Actions", function () {
  this.retries(3);

  // Test isDynamic
  describe("Woodcutting", function () {
    it("Cut wood", async function () {
      const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);

      const {queuedAction, rate} = await setupBasicWoodcutting(itemNFT, world);

      await players.connect(alice).startAction(playerId, queuedAction, EstforTypes.ActionQueueStatus.NONE);

      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan + 2]);
      await ethers.provider.send("evm_mine", []);

      const pendingOutput = await players.pendingRewards(alice.address, playerId, {
        includeLoot: true,
        includePastRandomRewards: true,
        includeXPRewards: true,
      });
      expect(pendingOutput.consumed.length).is.eq(0);
      expect(pendingOutput.produced.length).is.eq(1);
      expect(pendingOutput.produced[0].itemTokenId).is.eq(EstforConstants.LOG);
      const balanceExpected = Math.floor((queuedAction.timespan * rate) / (3600 * 10));
      expect(pendingOutput.produced[0].amount).is.eq(balanceExpected);
      await players.connect(alice).processActions(playerId);
      expect(await players.xp(playerId, EstforTypes.Skill.WOODCUTTING)).to.eq(queuedAction.timespan);
      expect(pendingOutput.xpGained).to.eq(queuedAction.timespan);
      // Check the drops are as expected
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.LOG)).to.eq(balanceExpected);
    });

    it("Full nature equipment", async function () {
      const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);

      const rate = 100 * 10; // per hour
      const tx = await world.addAction({
        actionId: 1,
        info: {
          skill: EstforTypes.Skill.WOODCUTTING,
          xpPerHour: 3600,
          minXP: 0,
          isDynamic: false,
          numSpawned: 0,
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

      await itemNFT.addItem({
        ...EstforTypes.defaultInputItem,
        tokenId: EstforConstants.BRONZE_AXE,
        equipPosition: EstforTypes.EquipPosition.RIGHT_HAND,
      });

      await itemNFT.addItem({
        ...EstforTypes.defaultInputItem,
        tokenId: EstforConstants.NATURE_MASK,
        equipPosition: EstforTypes.EquipPosition.HEAD,
      });

      await itemNFT.addItem({
        ...EstforTypes.defaultInputItem,
        tokenId: EstforConstants.NATURE_BODY,
        equipPosition: EstforTypes.EquipPosition.BODY,
      });

      await itemNFT.addItem({
        ...EstforTypes.defaultInputItem,
        tokenId: EstforConstants.NATURE_BRACERS,
        equipPosition: EstforTypes.EquipPosition.ARMS,
      });

      await itemNFT.addItem({
        ...EstforTypes.defaultInputItem,
        tokenId: EstforConstants.NATURE_TROUSERS,
        equipPosition: EstforTypes.EquipPosition.LEGS,
      });

      await itemNFT.addItem({
        ...EstforTypes.defaultInputItem,
        tokenId: EstforConstants.NATURE_BOOTS,
        equipPosition: EstforTypes.EquipPosition.FEET,
      });

      await players.addFullAttireBonus({
        skill: Skill.WOODCUTTING,
        itemTokenIds: [
          EstforConstants.NATURE_MASK,
          EstforConstants.NATURE_BODY,
          EstforConstants.NATURE_BRACERS,
          EstforConstants.NATURE_TROUSERS,
          EstforConstants.NATURE_BOOTS,
        ],
        bonusXPPercent: 3,
        bonusRewardsPercent: 0,
      });

      const queuedAction: EstforTypes.QueuedActionInput = {
        attire: {
          head: EstforConstants.NATURE_MASK,
          neck: EstforConstants.NONE,
          body: EstforConstants.NATURE_BODY,
          arms: EstforConstants.NATURE_BRACERS,
          legs: EstforConstants.NATURE_TROUSERS,
          feet: EstforConstants.NATURE_BOOTS,
          ring: EstforConstants.NONE, // Always NONE for now
          reserved1: EstforConstants.NONE, // Always NONE for now
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
      };

      await itemNFT.testMints(
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
      const balanceExpected = Math.floor((timespan * rate) / (3600 * 10));
      await players.connect(alice).processActions(playerId);
      expect(await players.xp(playerId, EstforTypes.Skill.WOODCUTTING)).to.eq(
        queuedAction.timespan + queuedAction.timespan * 0.03
      );
      // Check the drops are as expected
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.LOG)).to.eq(balanceExpected);
    });
  });

  it("Firemaking", async function () {
    const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);
    const rate = 100 * 10; // per hour
    let tx = await world.addAction({
      actionId: 1,
      info: {
        skill: EstforTypes.Skill.FIREMAKING,
        xpPerHour: 0,
        minXP: 0,
        isDynamic: false,
        numSpawned: 0,
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
      regenerateId: EstforConstants.NONE,
      timespan,
      rightHandEquipmentTokenId: EstforConstants.MAGIC_FIRE_STARTER,
      leftHandEquipmentTokenId: EstforConstants.NONE,
    };

    await itemNFT.addItem({
      ...EstforTypes.defaultInputItem,
      tokenId: EstforConstants.MAGIC_FIRE_STARTER,
      equipPosition: EstforTypes.EquipPosition.RIGHT_HAND,
    });

    await itemNFT.addItem({
      ...EstforTypes.defaultInputItem,
      tokenId: EstforConstants.LOG,
      equipPosition: EstforTypes.EquipPosition.AUX,
    });

    await itemNFT.testMint(alice.address, EstforConstants.LOG, 5); // Mint less than will be used

    await players.connect(alice).startAction(playerId, queuedAction, EstforTypes.ActionQueueStatus.NONE);

    await ethers.provider.send("evm_increaseTime", [queuedAction.timespan + 2]);
    await players.connect(alice).processActions(playerId);
    expect(await players.xp(playerId, EstforTypes.Skill.FIREMAKING)).to.eq(queuedAction.timespan);

    // Check how many logs they have now, 100 logs burnt per hour
    expect(await itemNFT.balanceOf(alice.address, EstforConstants.LOG)).to.eq(0);
  });

  it("Multi skill appending, woodcutting + firemaking", async function () {
    const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);
    const queuedActions: EstforTypes.QueuedActionInput[] = [];
    const rate = 1220 * 10; // per hour
    {
      const tx = await world.addAction({
        actionId: 1,
        info: {
          skill: EstforTypes.Skill.WOODCUTTING,
          xpPerHour: 3600,
          minXP: 0,
          isDynamic: false,
          numSpawned: 0,
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
      await itemNFT.addItem({
        ...EstforTypes.defaultInputItem,
        tokenId: EstforConstants.BRONZE_AXE,
        equipPosition: EstforTypes.EquipPosition.RIGHT_HAND,
      });
      const timespan = 7200 + 10;
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
      };

      queuedActions.push(queuedAction);
    }
    {
      let tx = await world.addAction({
        actionId: 2,
        info: {
          skill: EstforTypes.Skill.FIREMAKING,
          xpPerHour: 0,
          minXP: 0,
          isDynamic: false,
          numSpawned: 0,
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

      await itemNFT.testMint(alice.address, EstforConstants.MAGIC_FIRE_STARTER, 1);
      await itemNFT.addItem({
        ...EstforTypes.defaultInputItem,
        tokenId: EstforConstants.MAGIC_FIRE_STARTER,
        equipPosition: EstforTypes.EquipPosition.RIGHT_HAND,
      });
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
      };

      queuedActions.push(queuedAction);
    }

    await itemNFT.addItem({
      ...EstforTypes.defaultInputItem,
      tokenId: EstforConstants.LOG,
      equipPosition: EstforTypes.EquipPosition.AUX,
    });

    await players.connect(alice).startAction(playerId, queuedActions[0], EstforTypes.ActionQueueStatus.NONE);
    await ethers.provider.send("evm_increaseTime", [10]);
    await players
      .connect(alice)
      .startAction(playerId, queuedActions[1], EstforTypes.ActionQueueStatus.KEEP_LAST_IN_PROGRESS);
    expect(await players.xp(playerId, EstforTypes.Skill.WOODCUTTING)).to.be.oneOf([10, 11]); // Should be partially completed
    expect(await itemNFT.balanceOf(alice.address, EstforConstants.LOG)).to.eq(3);
    await ethers.provider.send("evm_increaseTime", [queuedActions[0].timespan + queuedActions[1].timespan]);
    expect((await players.getActionQueue(playerId)).length).to.eq(2);

    await players.connect(alice).processActions(playerId);
    expect(await players.xp(playerId, EstforTypes.Skill.WOODCUTTING)).to.eq(queuedActions[0].timespan);
    expect(await players.xp(playerId, EstforTypes.Skill.FIREMAKING)).to.eq(queuedActions[1].timespan);
    // Check how many logs they have now, 1220 logs burnt per hour, 2 hours producing logs, 1 hour burning
    expect((await itemNFT.balanceOf(alice.address, EstforConstants.LOG)).toNumber()).to.be.oneOf([
      Math.floor((queuedActions[0].timespan * rate) / (3600 * 10)) - rate / 10 - 1,
      Math.floor((queuedActions[0].timespan * rate) / (3600 * 10)) - rate / 10,
      Math.floor((queuedActions[0].timespan * rate) / (3600 * 10)) - rate / 10 + 1,
    ]);
    // Action queue should be empty
    expect((await players.getActionQueue(playerId)).length).to.eq(0);
  });

  it("Multi skill, woodcutting + firemaking", async function () {
    const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);
    const queuedActions: EstforTypes.QueuedActionInput[] = [];
    const rate = 100 * 10; // per hour
    {
      const tx = await world.addAction({
        actionId: 1,
        info: {
          skill: EstforTypes.Skill.WOODCUTTING,
          xpPerHour: 3600,
          minXP: 0,
          isDynamic: false,
          numSpawned: 0,
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
      await itemNFT.addItem({
        ...EstforTypes.defaultInputItem,
        tokenId: EstforConstants.BRONZE_AXE,
        equipPosition: EstforTypes.EquipPosition.RIGHT_HAND,
      });
      const timespan = 7200;
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
      };

      queuedActions.push(queuedAction);
    }
    {
      let tx = await world.addAction({
        actionId: 2,
        info: {
          skill: EstforTypes.Skill.FIREMAKING,
          xpPerHour: 0,
          minXP: 0,
          isDynamic: false,
          numSpawned: 0,
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

      await itemNFT.testMint(alice.address, EstforConstants.MAGIC_FIRE_STARTER, 1);
      await itemNFT.addItem({
        ...EstforTypes.defaultInputItem,
        tokenId: EstforConstants.MAGIC_FIRE_STARTER,
        equipPosition: EstforTypes.EquipPosition.RIGHT_HAND,
      });
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
      };

      queuedActions.push(queuedAction);
    }

    await itemNFT.addItem({
      ...EstforTypes.defaultInputItem,
      tokenId: EstforConstants.LOG,
      equipPosition: EstforTypes.EquipPosition.AUX,
    });

    // This should fail because they don't have any logs. (Maybe later this detects from previous actions)
    /*    await expect(
      players
        .connect(alice)
        .startActions(playerId, queuedActions, EstforConstants.NONE, EstforTypes.ActionQueueStatus.NONE)
    ).to.be.reverted;
*/
    await players
      .connect(alice)
      .startActions(playerId, queuedActions, EstforConstants.NONE, EstforTypes.ActionQueueStatus.NONE);

    await itemNFT.testMint(alice.address, EstforConstants.LOG, 1);
    await ethers.provider.send("evm_increaseTime", [queuedActions[0].timespan + queuedActions[1].timespan + 2]);
    await players.connect(alice).processActions(playerId);
    expect(await players.xp(playerId, EstforTypes.Skill.WOODCUTTING)).to.eq(queuedActions[0].timespan);
    expect(await players.xp(playerId, EstforTypes.Skill.FIREMAKING)).to.eq(queuedActions[1].timespan);
    // Check how many logs they have now, 100 logs burnt per hour, 2 hours producing logs, 1 hour burning
    expect(await itemNFT.balanceOf(alice.address, EstforConstants.LOG)).to.eq(
      Math.floor((queuedActions[0].timespan * rate) / (3600 * 10)) -
        Math.floor((queuedActions[1].timespan * rate) / (3600 * 10)) +
        1
    );
    expect((await players.getActionQueue(playerId)).length).to.eq(0);
  });

  it("Mining", async function () {
    const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);

    const tx = await world.addAction({
      actionId: 1,
      info: {
        skill: EstforTypes.Skill.MINING,
        xpPerHour: 3600,
        minXP: 0,
        isDynamic: false,
        numSpawned: 0,
        handItemTokenIdRangeMin: EstforConstants.BRONZE_PICKAXE,
        handItemTokenIdRangeMax: EstforConstants.MINING_MAX,
        isAvailable: actionIsAvailable,
        actionChoiceRequired: false,
        successPercent: 100,
      },
      guaranteedRewards: [{itemTokenId: EstforConstants.COPPER_ORE, rate: 10}], // 1.0
      randomRewards: [],
      combatStats: EstforTypes.emptyCombatStats,
    });

    const actionId = await getActionId(tx);

    await itemNFT.testMint(alice.address, EstforConstants.BRONZE_PICKAXE, 1);
    const queuedAction: EstforTypes.QueuedActionInput = {
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
    };

    await itemNFT.addItem({
      ...EstforTypes.defaultInputItem,
      tokenId: EstforConstants.BRONZE_PICKAXE,
      equipPosition: EstforTypes.EquipPosition.RIGHT_HAND,
    });

    await players.connect(alice).startAction(playerId, queuedAction, EstforTypes.ActionQueueStatus.NONE);

    await ethers.provider.send("evm_increaseTime", [queuedAction.timespan + 2]);
    await players.connect(alice).processActions(playerId);
    expect(await players.xp(playerId, EstforTypes.Skill.MINING)).to.eq(queuedAction.timespan);
  });

  it("Smithing", async function () {
    const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);
    const rate = 100 * 10; // per hour

    let tx = await world.addAction({
      actionId: 1,
      info: {
        skill: EstforTypes.Skill.SMITHING,
        xpPerHour: 0,
        minXP: 0,
        isDynamic: false,
        numSpawned: 0,
        handItemTokenIdRangeMin: EstforConstants.NONE,
        handItemTokenIdRangeMax: EstforConstants.NONE,
        isAvailable: actionIsAvailable,
        actionChoiceRequired: true,
        successPercent: 100,
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
      minXP: 0,
      rate,
      inputTokenId1: EstforConstants.COAL_ORE,
      num1: 2,
      inputTokenId2: EstforConstants.MITHRIL_ORE,
      num2: 1,
      inputTokenId3: EstforConstants.NONE,
      num3: 0,
      outputTokenId: EstforConstants.MITHRIL_BAR,
      outputNum: 1,
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
      rightHandEquipmentTokenId: EstforConstants.NONE,
      leftHandEquipmentTokenId: EstforConstants.NONE,
    };

    await itemNFT.addItem({
      ...EstforTypes.defaultInputItem,
      tokenId: EstforConstants.COAL_ORE,
      equipPosition: EstforTypes.EquipPosition.AUX,
    });

    await itemNFT.addItem({
      ...EstforTypes.defaultInputItem,
      tokenId: EstforConstants.MITHRIL_ORE,
      equipPosition: EstforTypes.EquipPosition.AUX,
    });

    await itemNFT.testMint(alice.address, EstforConstants.COAL_ORE, 255);
    await itemNFT.testMint(alice.address, EstforConstants.MITHRIL_ORE, 255);
    await players.connect(alice).startAction(playerId, queuedAction, EstforTypes.ActionQueueStatus.NONE);

    await ethers.provider.send("evm_increaseTime", [queuedAction.timespan + 2]);
    await players.connect(alice).processActions(playerId);
    expect(await players.xp(playerId, EstforTypes.Skill.SMITHING)).to.eq(queuedAction.timespan);

    // Check how many bars they have now, 100 bars created per hour, burns 2 coal and 1 mithril
    expect(await itemNFT.balanceOf(alice.address, EstforConstants.MITHRIL_BAR)).to.eq(
      Math.floor((timespan * rate) / (3600 * 10))
    );
    expect(await itemNFT.balanceOf(alice.address, EstforConstants.COAL_ORE)).to.eq(
      255 - Math.floor((timespan * rate) / (3600 * 10)) * 2
    );
    expect(await itemNFT.balanceOf(alice.address, EstforConstants.MITHRIL_ORE)).to.eq(
      255 - Math.floor((timespan * rate) / (3600 * 10))
    );
  });

  describe("Cooking", function () {
    it("Cook", async function () {
      const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);
      const rate = 100 * 10; // per hour

      let tx = await world.addAction({
        actionId: 1,
        info: {
          skill: EstforTypes.Skill.COOKING,
          xpPerHour: 0,
          minXP: 0,
          isDynamic: false,
          numSpawned: 0,
          handItemTokenIdRangeMin: EstforConstants.NONE,
          handItemTokenIdRangeMax: EstforConstants.NONE,
          isAvailable: actionIsAvailable,
          actionChoiceRequired: true,
          successPercent: 100,
        },
        guaranteedRewards: [],
        randomRewards: [],
        combatStats: EstforTypes.emptyCombatStats,
      });
      const actionId = await getActionId(tx);

      tx = await world.addActionChoice(actionId, 1, {
        skill: EstforTypes.Skill.COOKING,
        diff: 0,
        xpPerHour: 3600,
        minXP: 0,
        rate,
        inputTokenId1: EstforConstants.RAW_MINNUS,
        num1: 1,
        inputTokenId2: EstforConstants.NONE,
        num2: 0,
        inputTokenId3: EstforConstants.NONE,
        num3: 0,
        outputTokenId: EstforConstants.COOKED_MINNUS,
        outputNum: 1,
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
        rightHandEquipmentTokenId: EstforConstants.NONE,
        leftHandEquipmentTokenId: EstforConstants.NONE,
      };

      await itemNFT.addItem({
        ...EstforTypes.defaultInputItem,
        tokenId: EstforConstants.RAW_MINNUS,
        equipPosition: EstforTypes.EquipPosition.AUX,
      });

      await itemNFT.addItem({
        ...EstforTypes.defaultInputItem,
        tokenId: EstforConstants.COOKED_MINNUS,
        equipPosition: EstforTypes.EquipPosition.FOOD,
      });

      await itemNFT.testMint(alice.address, EstforConstants.RAW_MINNUS, 1000);

      await players.connect(alice).startAction(playerId, queuedAction, EstforTypes.ActionQueueStatus.NONE);

      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]);
      await players.connect(alice).processActions(playerId);
      expect(await players.xp(playerId, EstforTypes.Skill.COOKING)).to.eq(queuedAction.timespan);

      expect(await itemNFT.balanceOf(alice.address, EstforConstants.COOKED_MINNUS)).to.eq(
        Math.floor((timespan * rate) / (3600 * 10))
      );
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.RAW_MINNUS)).to.eq(
        1000 - Math.floor((timespan * rate) / (3600 * 10))
      );
    });

    // Changes based on level
    it("Burn some food", async function () {
      const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);
      const rate = 100 * 10; // per hour

      let tx = await world.addAction({
        actionId: 1,
        info: {
          skill: EstforTypes.Skill.COOKING,
          xpPerHour: 0,
          minXP: 0,
          isDynamic: false,
          numSpawned: 0,
          handItemTokenIdRangeMin: EstforConstants.NONE,
          handItemTokenIdRangeMax: EstforConstants.NONE,
          isAvailable: actionIsAvailable,
          actionChoiceRequired: true,
          successPercent: 100,
        },
        guaranteedRewards: [],
        randomRewards: [],
        combatStats: EstforTypes.emptyCombatStats,
      });
      const actionId = await getActionId(tx);

      // Food goes in, cooked food comes out, 50% burnt, 25% success + 25 level diff
      tx = await world.addActionChoice(actionId, 1, {
        skill: EstforTypes.Skill.COOKING,
        diff: 0,
        xpPerHour: 3600,
        minXP: getXPFromLevel(65),
        rate,
        inputTokenId1: EstforConstants.RAW_MINNUS,
        num1: 1,
        inputTokenId2: EstforConstants.NONE,
        num2: 0,
        inputTokenId3: EstforConstants.NONE,
        num3: 0,
        outputTokenId: EstforConstants.COOKED_MINNUS,
        outputNum: 1,
        successPercent: 25,
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
        rightHandEquipmentTokenId: EstforConstants.NONE,
        leftHandEquipmentTokenId: EstforConstants.NONE,
      };

      await itemNFT.addItem({
        ...EstforTypes.defaultInputItem,
        tokenId: EstforConstants.RAW_MINNUS,
        equipPosition: EstforTypes.EquipPosition.AUX,
      });

      await itemNFT.addItem({
        ...EstforTypes.defaultInputItem,
        tokenId: EstforConstants.COOKED_MINNUS,
        equipPosition: EstforTypes.EquipPosition.FOOD,
      });

      await itemNFT.testMint(alice.address, EstforConstants.RAW_MINNUS, 1000);

      await players.testModifyXP(playerId, EstforTypes.Skill.COOKING, getXPFromLevel(90));

      await players.connect(alice).startAction(playerId, queuedAction, EstforTypes.ActionQueueStatus.NONE);

      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]);
      await ethers.provider.send("evm_mine", []);
      let pendingOutput = await players.pendingRewards(alice.address, playerId, allPendingFlags);
      const foodNotBurned = Math.floor((timespan * rate) / (3600 * 10 * 2));
      expect(pendingOutput.produced.length).is.eq(1);
      expect(pendingOutput.produced[0].itemTokenId).to.eq(EstforConstants.COOKED_MINNUS);
      expect(pendingOutput.produced[0].amount).to.eq(foodNotBurned);
      await players.connect(alice).processActions(playerId);
      expect(await players.xp(playerId, EstforTypes.Skill.COOKING)).to.eq(getXPFromLevel(90) + queuedAction.timespan);

      expect(await itemNFT.balanceOf(alice.address, EstforConstants.COOKED_MINNUS)).to.eq(foodNotBurned);
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.RAW_MINNUS)).to.eq(
        1000 - Math.floor((timespan * rate) / (3600 * 10))
      );
    });

    it("Burn food, check max 90% success upper bound", async function () {
      const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);
      const rate = 100 * 10; // per hour

      let tx = await world.addAction({
        actionId: 1,
        info: {
          skill: EstforTypes.Skill.COOKING,
          xpPerHour: 0,
          minXP: 0,
          isDynamic: false,
          numSpawned: 0,
          handItemTokenIdRangeMin: EstforConstants.NONE,
          handItemTokenIdRangeMax: EstforConstants.NONE,
          isAvailable: actionIsAvailable,
          actionChoiceRequired: true,
          successPercent: 100,
        },
        guaranteedRewards: [],
        randomRewards: [],
        combatStats: EstforTypes.emptyCombatStats,
      });
      const actionId = await getActionId(tx);

      // Food goes in, cooked food comes out, 50% burnt, 25% success + 25 level diff
      tx = await world.addActionChoice(actionId, 1, {
        skill: EstforTypes.Skill.COOKING,
        diff: 0,
        xpPerHour: 3600,
        minXP: getXPFromLevel(65),
        rate,
        inputTokenId1: EstforConstants.RAW_MINNUS,
        num1: 1,
        inputTokenId2: EstforConstants.NONE,
        num2: 0,
        inputTokenId3: EstforConstants.NONE,
        num3: 0,
        outputTokenId: EstforConstants.COOKED_MINNUS,
        outputNum: 1,
        successPercent: 85,
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
        rightHandEquipmentTokenId: EstforConstants.NONE,
        leftHandEquipmentTokenId: EstforConstants.NONE,
      };

      await itemNFT.addItem({
        ...EstforTypes.defaultInputItem,
        tokenId: EstforConstants.RAW_MINNUS,
        equipPosition: EstforTypes.EquipPosition.AUX,
      });

      await itemNFT.addItem({
        ...EstforTypes.defaultInputItem,
        tokenId: EstforConstants.COOKED_MINNUS,
        equipPosition: EstforTypes.EquipPosition.FOOD,
      });

      await itemNFT.testMint(alice.address, EstforConstants.RAW_MINNUS, 1000);

      await players.testModifyXP(playerId, EstforTypes.Skill.COOKING, getXPFromLevel(90));

      await players.connect(alice).startAction(playerId, queuedAction, EstforTypes.ActionQueueStatus.NONE);

      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]);
      await players.connect(alice).processActions(playerId);
      expect(await players.xp(playerId, EstforTypes.Skill.COOKING)).to.eq(getXPFromLevel(90) + queuedAction.timespan);

      expect(await itemNFT.balanceOf(alice.address, EstforConstants.COOKED_MINNUS)).to.eq(
        Math.floor((timespan * rate * 0.9) / (3600 * 10)) // Max 90% success
      );
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.RAW_MINNUS)).to.eq(
        1000 - Math.floor((timespan * rate) / (3600 * 10))
      );
    });
  });

  describe("Thieving", function () {
    // All thieving rewards should be
    it("Steal Nothing", async function () {
      // Check pending rewards, also add a boost, make sure it is 0
      const {playerId, players, itemNFT, world, alice, mockOracleClient} = await loadFixture(playersFixture);

      const randomChanceFraction = Math.floor(99.9 / 100); // 50% chance
      const randomChance = Math.floor(65536 * randomChanceFraction);

      const xpPerHour = 2;
      let tx = await world.addAction({
        actionId: 1,
        info: {
          skill: EstforTypes.Skill.THIEVING,
          xpPerHour,
          minXP: 0,
          isDynamic: false,
          numSpawned: 0,
          handItemTokenIdRangeMin: EstforConstants.NONE,
          handItemTokenIdRangeMax: EstforConstants.NONE,
          isAvailable: actionIsAvailable,
          actionChoiceRequired: false,
          successPercent: 100,
        },
        guaranteedRewards: [],
        randomRewards: [
          {itemTokenId: EstforConstants.BRONZE_ARROW, chance: randomChance, amount: 1},
          {itemTokenId: EstforConstants.BRONZE_HELMET, chance: randomChance, amount: 1},
        ],
        combatStats: EstforTypes.emptyCombatStats,
      });

      const actionId = await getActionId(tx);
      const numHours = 1;

      const timespan = 3600 * numHours;
      const queuedAction: EstforTypes.QueuedActionInput = {
        attire: EstforTypes.noAttire,
        actionId,
        combatStyle: EstforTypes.CombatStyle.NONE,
        choiceId: EstforConstants.NONE,
        choiceId1: EstforConstants.NONE,
        choiceId2: EstforConstants.NONE,
        regenerateId: EstforConstants.NONE,
        timespan,
        rightHandEquipmentTokenId: EstforConstants.NONE,
        leftHandEquipmentTokenId: EstforConstants.NONE,
      };

      await itemNFT.addItem({
        ...EstforTypes.defaultInputItem,
        tokenId: EstforConstants.BRONZE_HELMET,
        equipPosition: EstforTypes.EquipPosition.HEAD,
      });

      await itemNFT.addItem({
        ...EstforTypes.defaultInputItem,
        tokenId: EstforConstants.BRONZE_ARROW,
        equipPosition: EstforTypes.EquipPosition.ARROW_SATCHEL,
      });

      await itemNFT.addItem({
        ...EstforTypes.defaultInputItem,
        tokenId: EstforConstants.SKILL_BOOST,
        equipPosition: EstforTypes.EquipPosition.BOOST_VIAL,
        // Boost
        boostType: EstforTypes.BoostType.GATHERING,
        boostValue: 10,
        boostDuration: 3600 * 24,
        isTransferable: false,
      });

      await ethers.provider.send("evm_increaseTime", [24 * 3600]);

      await itemNFT.testMint(alice.address, EstforConstants.SKILL_BOOST, 1);
      await players
        .connect(alice)
        .startActions(playerId, [queuedAction], EstforConstants.SKILL_BOOST, EstforTypes.ActionQueueStatus.NONE);
      await ethers.provider.send("evm_increaseTime", [3 * 3600]);

      tx = await world.requestRandomWords();
      let requestId = getRequestId(tx);
      expect(requestId).to.not.eq(0);
      await mockOracleClient.fulfill(requestId, world.address);

      tx = await world.requestRandomWords();
      requestId = getRequestId(tx);
      expect(requestId).to.not.eq(0);
      await mockOracleClient.fulfill(requestId, world.address);

      await players.connect(alice).processActions(playerId);
      const balance = await itemNFT.balanceOf(alice.address, EstforConstants.BRONZE_ARROW);
      const balance1 = await itemNFT.balanceOf(alice.address, EstforConstants.BRONZE_HELMET);
      expect(balance).to.eq(0);
      expect(balance1).to.eq(0);
    });

    it("Steal (many)", async function () {
      const {playerId, players, itemNFT, world, alice, mockOracleClient} = await loadFixture(playersFixture);

      const randomChanceFraction = 50.0 / 100; // 50% chance
      const randomChance = Math.floor(65536 * randomChanceFraction);

      const xpPerHour = 2;
      let tx = await world.addAction({
        actionId: 1,
        info: {
          skill: EstforTypes.Skill.THIEVING,
          xpPerHour,
          minXP: 0,
          isDynamic: false,
          numSpawned: 0,
          handItemTokenIdRangeMin: EstforConstants.NONE,
          handItemTokenIdRangeMax: EstforConstants.NONE,
          isAvailable: actionIsAvailable,
          actionChoiceRequired: false,
          successPercent: 100,
        },
        guaranteedRewards: [],
        randomRewards: [{itemTokenId: EstforConstants.BRONZE_ARROW, chance: randomChance, amount: 1}],
        combatStats: EstforTypes.emptyCombatStats,
      });

      const actionId = await getActionId(tx);

      const numHours = 4;

      // Make sure it passes the next checkpoint so there are no issues running (TODO needed for this one?)
      const {timestamp} = await ethers.provider.getBlock("latest");
      const nextCheckpoint = Math.floor(timestamp / 86400) * 86400 + 86400;
      const durationToNextCheckpoint = nextCheckpoint - timestamp + 1;
      await ethers.provider.send("evm_increaseTime", [durationToNextCheckpoint]);
      tx = await world.requestRandomWords();
      let requestId = getRequestId(tx);
      expect(requestId).to.not.eq(0);
      await mockOracleClient.fulfill(requestId, world.address);
      await ethers.provider.send("evm_increaseTime", [24 * 3600]);
      tx = await world.requestRandomWords();
      requestId = getRequestId(tx);
      expect(requestId).to.not.eq(0);
      await mockOracleClient.fulfill(requestId, world.address);

      const timespan = 3600 * numHours;
      const queuedAction: EstforTypes.QueuedActionInput = {
        attire: EstforTypes.noAttire,
        actionId,
        combatStyle: EstforTypes.CombatStyle.NONE,
        choiceId: EstforConstants.NONE,
        choiceId1: EstforConstants.NONE,
        choiceId2: EstforConstants.NONE,
        regenerateId: EstforConstants.NONE,
        timespan,
        rightHandEquipmentTokenId: EstforConstants.NONE,
        leftHandEquipmentTokenId: EstforConstants.NONE,
      };

      const numRepeats = 25;
      for (let i = 0; i < numRepeats; ++i) {
        await players.connect(alice).startAction(playerId, queuedAction, EstforTypes.ActionQueueStatus.NONE);
        await ethers.provider.send("evm_increaseTime", [24 * 3600]);
        const tx = await world.requestRandomWords();
        let requestId = getRequestId(tx);
        expect(requestId).to.not.eq(0);
        await mockOracleClient.fulfill(requestId, world.address);
        await players.connect(alice).processActions(playerId);
      }

      expect(await players.xp(playerId, EstforTypes.Skill.THIEVING)).to.eq(xpPerHour * numRepeats * numHours);

      const expectedTotal = numRepeats * randomChanceFraction * numHours;
      const balance = await itemNFT.balanceOf(alice.address, EstforConstants.BRONZE_ARROW);
      // Have 2 queued actions so twice as much
      expect(balance).to.not.eq(expectedTotal); // Very unlikely to be exact, but possible. This checks there is at least some randomness
      expect(balance).to.be.gte(expectedTotal * 0.8); // Within 20% below
      expect(balance).to.be.lte(expectedTotal * 1.2); // Within 20% above
    });

    it("Steal, success percent (many)", async function () {
      const {playerId, players, itemNFT, world, alice, mockOracleClient} = await loadFixture(playersFixture);

      const randomChanceFraction = 50.0 / 100; // 50% chance
      const randomChance = Math.floor(65536 * randomChanceFraction);
      const successPercent = 60; // Makes it 30% chance in total

      const xpPerHour = 2;
      let tx = await world.addAction({
        actionId: 1,
        info: {
          skill: EstforTypes.Skill.THIEVING,
          xpPerHour,
          minXP: 0,
          isDynamic: false,
          numSpawned: 0,
          handItemTokenIdRangeMin: EstforConstants.NONE,
          handItemTokenIdRangeMax: EstforConstants.NONE,
          isAvailable: actionIsAvailable,
          actionChoiceRequired: false,
          successPercent,
        },
        guaranteedRewards: [],
        randomRewards: [{itemTokenId: EstforConstants.BRONZE_ARROW, chance: randomChance, amount: 1}],
        combatStats: EstforTypes.emptyCombatStats,
      });

      const actionId = await getActionId(tx);

      const numHours = 2;

      // Make sure it passes the next checkpoint so there are no issues running (TODO needed for this one?)
      const {timestamp} = await ethers.provider.getBlock("latest");
      const nextCheckpoint = Math.floor(timestamp / 86400) * 86400 + 86400;
      const durationToNextCheckpoint = nextCheckpoint - timestamp + 1;
      await ethers.provider.send("evm_increaseTime", [durationToNextCheckpoint]);

      tx = await world.requestRandomWords();
      let requestId = getRequestId(tx);
      expect(requestId).to.not.eq(0);
      await mockOracleClient.fulfill(requestId, world.address);
      await ethers.provider.send("evm_increaseTime", [24 * 3600]);
      tx = await world.requestRandomWords();
      requestId = getRequestId(tx);
      expect(requestId).to.not.eq(0);
      await mockOracleClient.fulfill(requestId, world.address);

      const timespan = 3600 * numHours;
      const queuedAction: EstforTypes.QueuedActionInput = {
        attire: EstforTypes.noAttire,
        actionId,
        combatStyle: EstforTypes.CombatStyle.NONE,
        choiceId: EstforConstants.NONE,
        choiceId1: EstforConstants.NONE,
        choiceId2: EstforConstants.NONE,
        regenerateId: EstforConstants.NONE,
        timespan,
        rightHandEquipmentTokenId: EstforConstants.NONE,
        leftHandEquipmentTokenId: EstforConstants.NONE,
      };

      const numRepeats = 25;
      for (let i = 0; i < numRepeats; ++i) {
        await players.connect(alice).startAction(playerId, queuedAction, EstforTypes.ActionQueueStatus.NONE);
        await ethers.provider.send("evm_increaseTime", [24 * 3600]);
        tx = await world.requestRandomWords();
        requestId = getRequestId(tx);
        expect(requestId).to.not.eq(0);
        await mockOracleClient.fulfill(requestId, world.address);
        await players.connect(alice).processActions(playerId);
      }

      expect(await players.xp(playerId, EstforTypes.Skill.THIEVING)).to.eq(xpPerHour * numRepeats * numHours);

      const expectedTotal = numRepeats * randomChanceFraction * numHours * (successPercent / 100);
      const balance = await itemNFT.balanceOf(alice.address, EstforConstants.BRONZE_ARROW);
      // Have 2 queued actions so twice as much
      expect(balance).to.not.eq(expectedTotal); // Very unlikely to be exact, but possible. This checks there is at least some randomness
      expect(balance).to.be.gte(expectedTotal * 0.8); // Within 20% below
      expect(balance).to.be.lte(expectedTotal * 1.2); // Within 20% above
    });
  });

  it("Set past max timespan ", async function () {
    const {playerId, players, itemNFT, world, alice, maxTime} = await loadFixture(playersFixture);

    const {queuedAction: basicWoodcuttingQueuedAction, rate} = await setupBasicWoodcutting(itemNFT, world);

    const timespan = maxTime + 1; // Exceed maximum
    const queuedAction = {...basicWoodcuttingQueuedAction};
    queuedAction.timespan = timespan;

    await players.connect(alice).startAction(playerId, queuedAction, EstforTypes.ActionQueueStatus.NONE);

    await ethers.provider.send("evm_increaseTime", [queuedAction.timespan + 2]);
    await players.connect(alice).processActions(playerId);
    expect(await players.xp(playerId, EstforTypes.Skill.WOODCUTTING)).to.eq(queuedAction.timespan - 1);
    // Check the drops are as expected
    expect(await itemNFT.balanceOf(alice.address, EstforConstants.LOG)).to.eq(
      Math.floor(((queuedAction.timespan - 1) * rate) / (3600 * 10))
    );
  });

  // TODO Rest of the actions

  it("Low rate action (more than 1 hour needed)", async function () {
    const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);
    await itemNFT.addItem({
      ...EstforTypes.defaultInputItem,
      tokenId: EstforConstants.BRONZE_AXE,
      equipPosition: EstforTypes.EquipPosition.RIGHT_HAND,
    });

    const rate = 0.1 * 10; // 0.1 per hour
    const tx = await world.addAction({
      actionId: 1,
      info: {
        skill: EstforTypes.Skill.WOODCUTTING,
        xpPerHour: 3600,
        minXP: 0,
        isDynamic: false,
        numSpawned: 0,
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
    const timespan = 3600 * 19; // Should make 1
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
    };

    await players.connect(alice).startAction(playerId, queuedAction, EstforTypes.ActionQueueStatus.NONE);
    await ethers.provider.send("evm_increaseTime", [timespan]);
    await players.connect(alice).processActions(playerId);
    //      expect(await players.xp(playerId,EstforTypes.Skill.WOODCUTTING)).to.be.oneOf([361, 362]);
    expect(await itemNFT.balanceOf(alice.address, EstforConstants.LOG)).to.eq(1); // Should be rounded down
  });

  it("Incorrect left/right hand equipment", async function () {
    const {playerId, players, itemNFT, world, alice, owner} = await loadFixture(playersFixture);

    const {queuedAction: basicWoodcuttingAction} = await setupBasicWoodcutting(itemNFT, world);
    const queuedAction = {...basicWoodcuttingAction};
    (queuedAction.rightHandEquipmentTokenId = EstforConstants.BRONZE_PICKAXE), // Incorrect
      await itemNFT.addItem({
        ...EstforTypes.defaultInputItem,
        tokenId: EstforConstants.BRONZE_PICKAXE,
        equipPosition: EstforTypes.EquipPosition.RIGHT_HAND,
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

    await itemNFT.testMint(alice.address, EstforConstants.BRONZE_AXE, 1);

    // This works
    await players.connect(alice).startAction(playerId, queuedAction, EstforTypes.ActionQueueStatus.NONE);

    // Specifying a combat style should fail
    queuedAction.combatStyle = EstforTypes.CombatStyle.ATTACK;
    await expect(
      players.connect(alice).startAction(playerId, queuedAction, EstforTypes.ActionQueueStatus.NONE)
    ).to.be.revertedWithCustomError(players, "InvalidCombatStyle");

    // Transfer away, the action should just be skipped and no xp/loot should be given
    expect(await itemNFT.balanceOf(alice.address, EstforConstants.BRONZE_AXE)).to.eq(1);
    await itemNFT.connect(alice).safeTransferFrom(alice.address, owner.address, EstforConstants.BRONZE_AXE, 1, "0x");
    expect(await itemNFT.balanceOf(alice.address, EstforConstants.BRONZE_AXE)).to.eq(0);
    await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]);
    await players.connect(alice).processActions(playerId);
    expect(await players.xp(playerId, EstforTypes.Skill.WOODCUTTING)).to.eq(0);
    expect(await itemNFT.balanceOf(alice.address, EstforConstants.LOG)).to.eq(0);
  });

  it("Action pipelining", async function () {
    // Try wood cut, and then burning them when having none equipped
  });
});
