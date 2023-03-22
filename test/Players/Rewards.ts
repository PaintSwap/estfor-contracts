import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {EstforConstants, EstforTypes} from "@paintswap/estfor-definitions";
import {BRONZE_ARROW} from "@paintswap/estfor-definitions/constants";
import {BoostType} from "@paintswap/estfor-definitions/types";
import {expect} from "chai";
import {ethers} from "hardhat";
import {bronzeHelmetStats, emptyActionChoice, getActionChoiceId, getActionId, getRequestId} from "../../scripts/utils";
import {playersFixture} from "./PlayersFixture";

const actionIsAvailable = true;

describe("Rewards", () => {
  it("XP threshold rewards, single", async () => {
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
      timespan: 500,
      rightHandEquipmentTokenId: EstforConstants.BRONZE_AXE,
      leftHandEquipmentTokenId: EstforConstants.NONE,
      skill: EstforTypes.Skill.WOODCUTTING,
    };

    const rewards: EstforTypes.Equipment[] = [{itemTokenId: EstforConstants.BRONZE_BAR, amount: 3}];
    await expect(players.addXPThresholdReward({xpThreshold: 499, rewards})).to.be.revertedWithCustomError(
      players,
      "XPThresholdNotFound"
    );
    await players.addXPThresholdReward({xpThreshold: 500, rewards});

    await players.connect(alice).startAction(playerId, queuedAction, EstforTypes.ActionQueueStatus.NONE);
    await ethers.provider.send("evm_increaseTime", [50]);
    await ethers.provider.send("evm_mine", []);

    let pendingOutput = await players.pendingRewards(alice.address, playerId, {
      includeLoot: true,
      includePastRandomRewards: true,
      includeXPRewards: true,
    });
    expect(pendingOutput.produced.length).is.eq(1);
    await players.connect(alice).processActions(playerId);
    expect(await itemNFT.balanceOf(alice.address, EstforConstants.BRONZE_BAR)).to.eq(0);
    await ethers.provider.send("evm_increaseTime", [450]);
    await ethers.provider.send("evm_mine", []);
    pendingOutput = await players.pendingRewards(alice.address, playerId, {
      includeLoot: true,
      includePastRandomRewards: true,
      includeXPRewards: true,
    });
    expect(pendingOutput.produced.length).is.eq(1);
    expect(pendingOutput.producedXPRewards.length).is.eq(1);
    expect(pendingOutput.producedXPRewards[0].itemTokenId).is.eq(EstforConstants.BRONZE_BAR);
    expect(pendingOutput.producedXPRewards[0].amount).is.eq(3);

    await players.connect(alice).processActions(playerId);
    expect(await itemNFT.balanceOf(alice.address, EstforConstants.BRONZE_BAR)).to.eq(3);
  });

  it("XP threshold rewards, multiple", async () => {
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
      timespan: 1600,
      rightHandEquipmentTokenId: EstforConstants.BRONZE_AXE,
      leftHandEquipmentTokenId: EstforConstants.NONE,
      skill: EstforTypes.Skill.WOODCUTTING,
    };

    const rewards: EstforTypes.Equipment[] = [{itemTokenId: EstforConstants.BRONZE_BAR, amount: 3}];
    await players.addXPThresholdReward({xpThreshold: 500, rewards});
    const rewards1: EstforTypes.Equipment[] = [{itemTokenId: EstforConstants.BRONZE_HELMET, amount: 4}];
    await players.addXPThresholdReward({xpThreshold: 1000, rewards: rewards1});

    await players.connect(alice).startAction(playerId, queuedAction, EstforTypes.ActionQueueStatus.NONE);
    await ethers.provider.send("evm_increaseTime", [1600]);
    await ethers.provider.send("evm_mine", []);

    let pendingOutput = await players.pendingRewards(alice.address, playerId, {
      includeLoot: false,
      includePastRandomRewards: false,
      includeXPRewards: true,
    });
    expect(pendingOutput.producedXPRewards.length).is.eq(2);
    expect(pendingOutput.producedXPRewards[0].itemTokenId).is.eq(EstforConstants.BRONZE_BAR);
    expect(pendingOutput.producedXPRewards[0].amount).is.eq(3);
    expect(pendingOutput.producedXPRewards[1].itemTokenId).is.eq(EstforConstants.BRONZE_HELMET);
    expect(pendingOutput.producedXPRewards[1].amount).is.eq(4);

    await players.connect(alice).processActions(playerId);
    expect(await itemNFT.balanceOf(alice.address, EstforConstants.BRONZE_BAR)).to.eq(3);
    expect(await itemNFT.balanceOf(alice.address, EstforConstants.BRONZE_HELMET)).to.eq(4);
  });

  it("Daily Rewards", async () => {
    const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);

    players.setDailyRewardsEnabled(true);

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
      timespan: 500,
      rightHandEquipmentTokenId: EstforConstants.BRONZE_AXE,
      leftHandEquipmentTokenId: EstforConstants.NONE,
      skill: EstforTypes.Skill.WOODCUTTING,
    };

    const oneDay = 24 * 3600;
    const oneWeek = oneDay * 7;
    const timestamp = Math.floor((Date.now() / 1000 - 4 * oneDay) / oneWeek) * oneWeek + (oneWeek + 5 * oneDay + 1); // Start next tuesday

    await ethers.provider.send("evm_setNextBlockTimestamp", [timestamp]);
    await ethers.provider.send("evm_mine", []);

    let balanceBeforeWeeklyReward = await itemNFT.balanceOf(alice.address, EstforConstants.XP_BOOST);

    const equipments = [
      {itemTokenId: EstforConstants.COPPER_ORE, amount: 100},
      {itemTokenId: EstforConstants.COAL_ORE, amount: 200},
      {itemTokenId: EstforConstants.RUBY, amount: 100},
      {itemTokenId: EstforConstants.MITHRIL_BAR, amount: 200},
      {itemTokenId: EstforConstants.COOKED_BOWFISH, amount: 100},
      {itemTokenId: EstforConstants.LEAF_FRAGMENTS, amount: 20},
      {itemTokenId: EstforConstants.HELL_SCROLL, amount: 300},
    ];

    let beforeBalances = await itemNFT.balanceOfs(
      alice.address,
      equipments.map((equipment) => equipment.itemTokenId)
    );

    for (let i = 0; i < 4; ++i) {
      await players.connect(alice).startAction(playerId, queuedAction, EstforTypes.ActionQueueStatus.NONE);
      await ethers.provider.send("evm_increaseTime", [3600 * 24]);
      await ethers.provider.send("evm_mine", []);
    }
    await players.connect(alice).startAction(playerId, queuedAction, EstforTypes.ActionQueueStatus.NONE);

    let afterBalances = await itemNFT.balanceOfs(
      alice.address,
      equipments.map((equipment) => equipment.itemTokenId)
    );

    for (let i = 1; i < 6; ++i) {
      expect(afterBalances[i]).to.eq(beforeBalances[i].toNumber() + equipments[i].amount);
    }

    expect(await players.dailyClaimedRewards(playerId)).to.eql([false, true, true, true, true, true, false]);

    // Last day of the week. This isn't a full week so shouldn't get weekly rewards, but still get daily rewards
    let balanceAfterWeeklyReward = await itemNFT.balanceOf(alice.address, EstforConstants.XP_BOOST);
    expect(balanceBeforeWeeklyReward).to.eq(balanceAfterWeeklyReward);
    let prevBalanceDailyReward = await itemNFT.balanceOf(alice.address, equipments[equipments.length - 1].itemTokenId);
    await ethers.provider.send("evm_increaseTime", [3600 * 24]);
    await ethers.provider.send("evm_mine", []);
    await players.connect(alice).startAction(playerId, queuedAction, EstforTypes.ActionQueueStatus.NONE);
    expect(balanceAfterWeeklyReward).to.eq(await itemNFT.balanceOf(alice.address, EstforConstants.XP_BOOST));
    let balanceAfterDailyReward = await itemNFT.balanceOf(alice.address, equipments[equipments.length - 1].itemTokenId);
    expect(balanceAfterDailyReward).to.eq(prevBalanceDailyReward.toNumber() + equipments[equipments.length - 1].amount);

    expect(await players.dailyClaimedRewards(playerId)).to.eql([false, true, true, true, true, true, true]);

    // Next one should start the next round
    await ethers.provider.send("evm_increaseTime", [3600 * 24]);
    await ethers.provider.send("evm_mine", []);

    expect(await players.dailyClaimedRewards(playerId)).to.eql([false, false, false, false, false, false, false]);

    beforeBalances = await itemNFT.balanceOfs(
      alice.address,
      equipments.map((equipment) => equipment.itemTokenId)
    );

    for (let i = 0; i < 7; ++i) {
      await players.connect(alice).startAction(playerId, queuedAction, EstforTypes.ActionQueueStatus.NONE);
      if (i != 6) {
        await ethers.provider.send("evm_increaseTime", [3600 * 24]);
        await ethers.provider.send("evm_mine", []);
      }
    }

    expect(await players.dailyClaimedRewards(playerId)).to.eql([true, true, true, true, true, true, true]);

    afterBalances = await itemNFT.balanceOfs(
      alice.address,
      equipments.map((equipment) => equipment.itemTokenId)
    );

    for (let i = 0; i < 7; ++i) {
      expect(beforeBalances[i].toNumber() + equipments[i].amount).to.eq(afterBalances[i]);
    }

    // Also check extra week streak reward
    expect(balanceAfterWeeklyReward.toNumber() + 1).to.eq(
      await itemNFT.balanceOf(alice.address, EstforConstants.XP_BOOST)
    );
  });

  it("Daily Rewards, only 1 claim", async () => {
    const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);

    players.setDailyRewardsEnabled(true);

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
      timespan: 500,
      rightHandEquipmentTokenId: EstforConstants.BRONZE_AXE,
      leftHandEquipmentTokenId: EstforConstants.NONE,
      skill: EstforTypes.Skill.WOODCUTTING,
    };

    const oneDay = 24 * 3600;
    const oneWeek = oneDay * 7;
    const timestamp = Math.floor((Date.now() / 1000 - 4 * oneDay) / oneWeek) * oneWeek + (oneWeek + 4 * oneDay + 1); // Start next monday

    await ethers.provider.send("evm_setNextBlockTimestamp", [timestamp]);
    await ethers.provider.send("evm_mine", []);

    const equipment = {itemTokenId: EstforConstants.COPPER_ORE, amount: 100};
    let balanceBefore = await itemNFT.balanceOf(alice.address, equipment.itemTokenId);
    await players.connect(alice).startAction(playerId, queuedAction, EstforTypes.ActionQueueStatus.NONE);
    let balanceAfter = await itemNFT.balanceOf(alice.address, equipment.itemTokenId);
    expect(balanceAfter).to.eq(balanceBefore.toNumber() + equipment.amount);

    // Start again, shouldn't get any more rewards
    balanceBefore = await itemNFT.balanceOf(alice.address, equipment.itemTokenId);
    await players.connect(alice).startAction(playerId, queuedAction, EstforTypes.ActionQueueStatus.NONE);
    balanceAfter = await itemNFT.balanceOf(alice.address, equipment.itemTokenId);
    expect(balanceAfter).to.eq(balanceBefore);
  });

  it("Daily Rewards, test rewards in new week", async () => {
    // TODO
  });

  it("Guaranteed rewards", async () => {
    // TODO
  });

  it("Random reward ticket excess", async () => {
    const {playerId, players, itemNFT, world, alice, mockOracleClient} = await loadFixture(playersFixture);
    const maxUniqueTickets = await players.maxUniqueTickets();

    const monsterCombatStats: EstforTypes.CombatStats = {
      melee: 1,
      magic: 0,
      range: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangeDefence: 0,
      health: 1,
    };

    const randomChance = 65535; // 100%
    const numSpawn = 100;
    let tx = await world.addAction({
      actionId: 1,
      info: {
        skill: EstforTypes.Skill.COMBAT,
        xpPerHour: 3600,
        minXP: 0,
        isDynamic: false,
        numSpawn,
        handItemTokenIdRangeMin: EstforConstants.COMBAT_BASE,
        handItemTokenIdRangeMax: EstforConstants.COMBAT_MAX,
        isAvailable: actionIsAvailable,
        actionChoiceRequired: true,
        successPercent: 100,
      },
      guaranteedRewards: [],
      randomRewards: [{itemTokenId: EstforConstants.BRONZE_ARROW, chance: randomChance, amount: 1}],
      combatStats: monsterCombatStats,
    });
    const actionId = await getActionId(tx);

    tx = await world.addActionChoice(EstforConstants.NONE, 1, {
      ...emptyActionChoice,
      skill: EstforTypes.Skill.MELEE,
    });
    const choiceId = await getActionChoiceId(tx);
    await itemNFT.testMint(alice.address, EstforConstants.BRONZE_SWORD, 1);
    await itemNFT.testMint(alice.address, EstforConstants.BRONZE_HELMET, 1);

    await itemNFT.testMint(alice.address, EstforConstants.COOKED_MINNUS, 255);

    const numHours = 5;
    const timespan = 3600 * numHours;
    expect(numHours * numSpawn).to.be.greaterThan(maxUniqueTickets);

    const queuedAction: EstforTypes.QueuedActionInput = {
      attire: {...EstforTypes.noAttire, head: EstforConstants.BRONZE_HELMET},
      actionId,
      combatStyle: EstforTypes.CombatStyle.ATTACK,
      choiceId,
      choiceId1: EstforConstants.NONE,
      choiceId2: EstforConstants.NONE,
      regenerateId: EstforConstants.COOKED_MINNUS,
      timespan,
      rightHandEquipmentTokenId: EstforConstants.BRONZE_SWORD,
      leftHandEquipmentTokenId: EstforConstants.NONE,
      skill: EstforTypes.Skill.COMBAT,
    };

    await itemNFT.addItem({
      ...EstforTypes.defaultInputItem,
      combatStats: {
        ...EstforTypes.emptyCombatStats,
        melee: 50,
      },
      tokenId: EstforConstants.BRONZE_SWORD,
      equipPosition: EstforTypes.EquipPosition.RIGHT_HAND,
      metadataURI: "someIPFSURI.json",
    });
    await itemNFT.addItem({
      ...EstforTypes.defaultInputItem,
      combatStats: bronzeHelmetStats,
      tokenId: EstforConstants.BRONZE_HELMET,
      equipPosition: EstforTypes.EquipPosition.HEAD,
      metadataURI: "someIPFSURI.json",
    });

    await itemNFT.addItem({
      ...EstforTypes.defaultInputItem,
      tokenId: EstforConstants.BRONZE_ARROW,
      equipPosition: EstforTypes.EquipPosition.ARROW_SATCHEL,
      metadataURI: "someIPFSURI.json",
    });

    await itemNFT.addItem({
      ...EstforTypes.defaultInputItem,
      healthRestored: 12,
      tokenId: EstforConstants.COOKED_MINNUS,
      equipPosition: EstforTypes.EquipPosition.FOOD,
      metadataURI: "someIPFSURI.json",
    });

    await players.connect(alice).startAction(playerId, queuedAction, EstforTypes.ActionQueueStatus.NONE);

    await ethers.provider.send("evm_increaseTime", [3600 * 24]);
    await ethers.provider.send("evm_mine", []);

    let pendingOutput = await players.pendingRewards(alice.address, playerId, {
      includeLoot: true,
      includePastRandomRewards: true,
      includeXPRewards: true,
    });
    expect(pendingOutput.produced.length).to.eq(0);

    tx = await world.requestSeedUpdate();
    let requestId = getRequestId(tx);
    expect(requestId).to.not.eq(0);
    await mockOracleClient.fulfill(requestId, world.address);

    pendingOutput = await players.pendingRewards(alice.address, playerId, {
      includeLoot: true,
      includePastRandomRewards: true,
      includeXPRewards: true,
    });
    expect(pendingOutput.produced.length).to.eq(1);

    await players.connect(alice).processActions(playerId);

    // Check output
    expect(await itemNFT.balanceOf(alice.address, BRONZE_ARROW)).to.eq(numHours * numSpawn);
  });

  // This test only works if the timespan does not go over 00:00 utc
  it("Random rewards (many)", async () => {
    const {playerId, players, itemNFT, world, alice, mockOracleClient} = await loadFixture(playersFixture);

    await itemNFT.addItem({
      ...EstforTypes.defaultInputItem,
      tokenId: EstforConstants.BRONZE_AXE,
      equipPosition: EstforTypes.EquipPosition.RIGHT_HAND,
      metadataURI: "someIPFSURI.json",
    });

    await itemNFT.addItem({
      ...EstforTypes.defaultInputItem,
      tokenId: EstforConstants.BRONZE_ARROW,
      equipPosition: EstforTypes.EquipPosition.ARROW_SATCHEL,
      metadataURI: "someIPFSURI.json",
    });

    const randomChanceFraction = 50.0 / 100; // 50% chance
    const randomChance = Math.floor(65535 * randomChanceFraction);

    let tx = await world.addAction({
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
      guaranteedRewards: [],
      randomRewards: [{itemTokenId: EstforConstants.BRONZE_ARROW, chance: randomChance, amount: 1}],
      combatStats: EstforTypes.emptyCombatStats,
    });

    const actionId = await getActionId(tx);
    const numHours = 5;
    const queuedAction: EstforTypes.QueuedActionInput = {
      attire: EstforTypes.noAttire,
      actionId,
      combatStyle: EstforTypes.CombatStyle.NONE,
      choiceId: EstforConstants.NONE,
      choiceId1: EstforConstants.NONE,
      choiceId2: EstforConstants.NONE,
      regenerateId: EstforConstants.NONE,
      timespan: 3600 * numHours,
      rightHandEquipmentTokenId: EstforConstants.BRONZE_AXE,
      leftHandEquipmentTokenId: EstforConstants.NONE,
      skill: EstforTypes.Skill.WOODCUTTING,
    };

    let numProduced = 0;

    // Repeat the test a bunch of times to check the random rewards are as expected
    const numRepeats = 50;
    for (let i = 0; i < numRepeats; ++i) {
      await players.connect(alice).startAction(playerId, queuedAction, EstforTypes.ActionQueueStatus.NONE);
      let endTime;
      {
        const actionQueue = await players.getActionQueue(playerId);
        expect(actionQueue.length).to.eq(1);
        endTime = actionQueue[0].startTime + actionQueue[0].timespan;
      }

      expect(await world.hasRandomWord(endTime)).to.be.false;

      await ethers.provider.send("evm_increaseTime", [3600 * 24]);
      await players.connect(alice).processActions(playerId);
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.BRONZE_ARROW)).to.eq(numProduced);

      expect((await players.getPendingRandomRewards(playerId)).length).to.eq(1);

      const pendingOutput = await players.pendingRewards(alice.address, playerId, {
        includeLoot: true,
        includePastRandomRewards: true,
        includeXPRewards: true,
      });
      expect(pendingOutput.produced.length).to.eq(0);

      tx = await world.requestSeedUpdate();
      let requestId = getRequestId(tx);
      expect(requestId).to.not.eq(0);
      await mockOracleClient.fulfill(requestId, world.address);

      expect(await world.hasRandomWord(endTime)).to.be.true;

      const pendingRewards = await players.pendingRewards(alice.address, playerId, {
        includeLoot: false,
        includePastRandomRewards: true,
        includeXPRewards: false,
      });

      if (pendingRewards.producedPastRandomRewards.length != 0) {
        expect(pendingRewards.producedPastRandomRewards.length).to.eq(1);

        const produced = pendingRewards.producedPastRandomRewards[0].amount;
        numProduced += produced;
        expect(pendingRewards.producedPastRandomRewards[0].itemTokenId).to.be.eq(EstforConstants.BRONZE_ARROW);
      }
    }
    const expectedTotal = numRepeats * randomChanceFraction * numHours;
    expect(numProduced).to.not.eq(expectedTotal); // Very unlikely to be exact, but possible. This checks there is at least some randomness
    expect(numProduced).to.be.gte(expectedTotal * 0.85); // Within 15% below
    expect(numProduced).to.be.lte(expectedTotal * 1.15); // 15% of the time we should get more than 50% of the reward
  });

  it("Multiple random rewards (many)", async () => {
    const {playerId, players, itemNFT, world, alice, mockOracleClient} = await loadFixture(playersFixture);

    await itemNFT.addItem({
      ...EstforTypes.defaultInputItem,
      tokenId: EstforConstants.BRONZE_AXE,
      equipPosition: EstforTypes.EquipPosition.RIGHT_HAND,
      metadataURI: "someIPFSURI.json",
    });

    await itemNFT.addItem({
      ...EstforTypes.defaultInputItem,
      tokenId: EstforConstants.BRONZE_ARROW,
      equipPosition: EstforTypes.EquipPosition.ARROW_SATCHEL,
      metadataURI: "someIPFSURI.json",
    });

    const randomChanceFractions = [80.0 / 100, 50.0 / 100, 50.0 / 100, 20.0 / 100]; // 80%, 50%, 50%, 20%
    const randomChance = Math.floor(65535 * randomChanceFractions[0]);
    const randomChance1 = Math.floor(65535 * randomChanceFractions[1]);
    const randomChance2 = Math.floor(65535 * randomChanceFractions[2]);
    const randomChance3 = Math.floor(65535 * randomChanceFractions[3]);

    let tx = await world.addAction({
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
      guaranteedRewards: [],
      randomRewards: [
        {itemTokenId: EstforConstants.BRONZE_BAR, chance: randomChance, amount: 1},
        {itemTokenId: EstforConstants.BRONZE_ARROW, chance: randomChance1, amount: 1},
        {itemTokenId: EstforConstants.BRONZE_TASSETS, chance: randomChance2, amount: 1},
        {itemTokenId: EstforConstants.BRONZE_GAUNTLETS, chance: randomChance3, amount: 1},
      ],
      combatStats: EstforTypes.emptyCombatStats,
    });

    const actionId = await getActionId(tx);
    const numHours = 2;
    const queuedAction: EstforTypes.QueuedActionInput = {
      attire: EstforTypes.noAttire,
      actionId,
      combatStyle: EstforTypes.CombatStyle.NONE,
      choiceId: EstforConstants.NONE,
      choiceId1: EstforConstants.NONE,
      choiceId2: EstforConstants.NONE,
      regenerateId: EstforConstants.NONE,
      timespan: 3600 * numHours,
      rightHandEquipmentTokenId: EstforConstants.BRONZE_AXE,
      leftHandEquipmentTokenId: EstforConstants.NONE,
      skill: EstforTypes.Skill.WOODCUTTING,
    };

    const balanceMap = new Map<number, number>();
    balanceMap.set(EstforConstants.BRONZE_BAR, 0);
    balanceMap.set(EstforConstants.BRONZE_ARROW, 0);
    balanceMap.set(EstforConstants.BRONZE_TASSETS, 0);
    balanceMap.set(EstforConstants.BRONZE_GAUNTLETS, 0);

    // Repeat the test a bunch of times to check the random rewards are as expected
    const numRepeats = 50;
    for (let i = 0; i < numRepeats; ++i) {
      await players
        .connect(alice)
        .startActions(
          playerId,
          [queuedAction, queuedAction],
          BoostType.NONE,
          EstforTypes.ActionQueueStatus.KEEP_LAST_IN_PROGRESS
        );
      let endTime;
      {
        const actionQueue = await players.getActionQueue(playerId);
        expect(actionQueue.length).to.eq(2);
        endTime = actionQueue[1].startTime + actionQueue[1].timespan;
      }

      expect(await world.hasRandomWord(endTime)).to.be.false;

      await ethers.provider.send("evm_increaseTime", [3600 * 24]);
      await players.connect(alice).processActions(playerId);
      for (const [itemTokenId, amount] of balanceMap) {
        expect(await itemNFT.balanceOf(alice.address, itemTokenId)).to.eq(balanceMap.get(itemTokenId));
      }

      expect((await players.getPendingRandomRewards(playerId)).length).to.eq(2);

      const pendingOutput = await players.pendingRewards(alice.address, playerId, {
        includeLoot: false,
        includePastRandomRewards: true,
        includeXPRewards: false,
      });
      expect(pendingOutput.producedPastRandomRewards.length).to.eq(0);

      tx = await world.requestSeedUpdate();
      let requestId = getRequestId(tx);
      expect(requestId).to.not.eq(0);
      await mockOracleClient.fulfill(requestId, world.address);

      expect(await world.hasRandomWord(endTime)).to.be.true;

      const pendingRewards = await players.pendingRewards(alice.address, playerId, {
        includeLoot: false,
        includePastRandomRewards: true,
        includeXPRewards: false,
      });
      if (pendingRewards.producedPastRandomRewards.length != 0) {
        expect(pendingRewards.producedPastRandomRewards.length).to.be.oneOf([1, 2, 3, 4, 5, 6, 7, 8]);

        for (const reward of pendingRewards.producedPastRandomRewards) {
          balanceMap.set(reward.itemTokenId, balanceMap.get(reward.itemTokenId)! + reward.amount);
        }
      }
    }

    let i = 0;
    for (const [itemTokenId, amount] of balanceMap) {
      const randomChanceFraction = randomChanceFractions[i];
      const expectedTotal = numRepeats * randomChanceFraction * numHours;
      // Have 2 queued actions so twice as much
      expect(balanceMap.get(itemTokenId)).to.not.eq(expectedTotal * 2); // Very unlikely to be exact, but possible. This checks there is at least some randomness
      expect(balanceMap.get(itemTokenId)).to.be.gte(expectedTotal * 0.75 * 2); // Within 25% below
      expect(balanceMap.get(itemTokenId)).to.be.lte(expectedTotal * 1.25 * 2); // Within 25% above
      ++i;
    }
  });

  // Could be a part of world or if there was space
  it("Check random bytes", async () => {
    const {players, playerId} = await loadFixture(playersFixture);
    const timestamp = Math.floor(Date.now() / 1000);
    let numTickets = 16; // 240
    let randomBytes = await players.getRandomBytes(numTickets, timestamp - 86400, playerId);
    expect(ethers.utils.hexDataLength(randomBytes)).to.be.eq(32);
    numTickets = 48;

    const randomBytes1 = await players.getRandomBytes(numTickets, timestamp - 86400, playerId);
    expect(ethers.utils.hexDataLength(randomBytes1)).to.be.eq(32 * 3);

    numTickets = 49;
    const randomBytes2 = await players.getRandomBytes(numTickets, timestamp - 86400, playerId);
    expect(ethers.utils.hexDataLength(randomBytes2)).to.be.eq(32 * 3 * 5);
  });
});
