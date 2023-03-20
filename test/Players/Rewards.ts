import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {EstforConstants, EstforTypes} from "@paintswap/estfor-definitions";
import {expect} from "chai";
import {ethers} from "hardhat";
import {getActionId} from "../../scripts/utils";
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

    const rate = 100 * 100; // per hour
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

    const rate = 100 * 100; // per hour
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
      },
      guaranteedRewards: [{itemTokenId: EstforConstants.LOG, rate}],
      randomRewards: [],
      combatStats: EstforTypes.emptyCombatStats,
    });

    const actionId = await getActionId(tx);
    const queuedAction: EstforTypes.QueuedAction = {
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
      startTime: "0",
      isValid: true,
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

    const rate = 100 * 100; // per hour
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

    const rate = 100 * 100; // per hour
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
});
