import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {expect} from "chai";
import {ethers} from "hardhat";
import {
  ActionQueueStatus,
  BRONZE_AXE,
  BRONZE_BAR,
  COAL_ORE,
  CombatStyle,
  COOKED_BOWFISH,
  COPPER_ORE,
  defaultInputItem,
  emptyCombatStats,
  Equipment,
  EquipPosition,
  getActionId,
  HELL_SCROLL,
  LEAF_FRAGMENTS,
  LOG,
  MITHRIL_BAR,
  noAttire,
  NONE,
  QueuedAction,
  RUBY,
  Skill,
  WOODCUTTING_BASE,
  WOODCUTTING_MAX,
  XP_BOOST,
} from "../../scripts/utils";
import {playersFixture} from "./PlayersFixture";

const actionIsAvailable = true;

describe("Rewards", () => {
  it("XP threshold rewards", async () => {
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
      timespan: 500,
      rightHandEquipmentTokenId: BRONZE_AXE,
      leftHandEquipmentTokenId: NONE,
      startTime: "0",
      isValid: true,
    };

    const equipments: Equipment[] = [{itemTokenId: BRONZE_BAR, amount: 3}];
    await expect(players.addXPThresholdReward({xpThreshold: 499, equipments})).to.be.revertedWithCustomError(
      players,
      "XPThresholdNotFound"
    );
    await players.addXPThresholdReward({xpThreshold: 500, equipments});

    await players.connect(alice).startAction(playerId, queuedAction, ActionQueueStatus.NONE);
    await ethers.provider.send("evm_increaseTime", [250]);
    await ethers.provider.send("evm_mine", []);

    const playerDelegateView = await ethers.getContractAt("PlayerDelegateView", players.address);
    let pendingOutput = await playerDelegateView.pendingRewards(alice.address, playerId, {
      includeLoot: true,
      includePastRandomRewards: true,
      includeXPRewards: true,
    });
    expect(pendingOutput.produced.length).is.eq(1);
    await players.connect(alice).processActions(playerId);
    expect(await itemNFT.balanceOf(alice.address, BRONZE_BAR)).to.eq(0);
    await ethers.provider.send("evm_increaseTime", [250]);
    await ethers.provider.send("evm_mine", []);
    pendingOutput = await playerDelegateView.pendingRewards(alice.address, playerId, {
      includeLoot: true,
      includePastRandomRewards: true,
      includeXPRewards: true,
    });
    expect(pendingOutput.produced.length).is.eq(1);
    expect(pendingOutput.producedXPRewards.length).is.eq(1);
    expect(pendingOutput.producedXPRewards[0].itemTokenId).is.eq(BRONZE_BAR);
    expect(pendingOutput.producedXPRewards[0].amount).is.eq(3);

    await players.connect(alice).processActions(playerId);
    expect(await itemNFT.balanceOf(alice.address, BRONZE_BAR)).to.eq(3);
  });

  it("Daily Rewards", async () => {
    const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);

    players.setDailyRewardsEnabled(true);

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
      timespan: 500,
      rightHandEquipmentTokenId: BRONZE_AXE,
      leftHandEquipmentTokenId: NONE,
      startTime: "0",
      isValid: true,
    };

    const oneDay = 24 * 3600;
    const oneWeek = oneDay * 7;
    const timestamp = Math.floor((Date.now() / 1000 - 4 * oneDay) / oneWeek) * oneWeek + (oneWeek + 5 * oneDay + 1); // Start next tuesday

    await ethers.provider.send("evm_setNextBlockTimestamp", [timestamp]);
    await ethers.provider.send("evm_mine", []);

    let balanceBeforeWeeklyReward = await itemNFT.balanceOf(alice.address, XP_BOOST);

    const equipments = [
      {itemTokenId: COPPER_ORE, amount: 100},
      {itemTokenId: COAL_ORE, amount: 200},
      {itemTokenId: RUBY, amount: 100},
      {itemTokenId: MITHRIL_BAR, amount: 200},
      {itemTokenId: COOKED_BOWFISH, amount: 100},
      {itemTokenId: LEAF_FRAGMENTS, amount: 20},
      {itemTokenId: HELL_SCROLL, amount: 300},
    ];

    let beforeBalances = await itemNFT.balanceOfs(
      alice.address,
      equipments.map((equipment) => equipment.itemTokenId)
    );

    for (let i = 0; i < 5; ++i) {
      await players.connect(alice).startAction(playerId, queuedAction, ActionQueueStatus.NONE);
      await ethers.provider.send("evm_increaseTime", [3600 * 24]);
      await ethers.provider.send("evm_mine", []);
    }

    let afterBalances = await itemNFT.balanceOfs(
      alice.address,
      equipments.map((equipment) => equipment.itemTokenId)
    );

    for (let i = 1; i < 6; ++i) {
      expect(afterBalances[i]).to.eq(beforeBalances[i].toNumber() + equipments[i].amount);
    }

    // This isn't a full week so shouldn't get weekly rewards, but still get daily rewards
    let balanceAfterWeeklyReward = await itemNFT.balanceOf(alice.address, XP_BOOST);
    expect(balanceBeforeWeeklyReward).to.eq(balanceAfterWeeklyReward);
    let prevBalanceDailyReward = await itemNFT.balanceOf(alice.address, equipments[equipments.length - 1].itemTokenId);
    await players.connect(alice).startAction(playerId, queuedAction, ActionQueueStatus.NONE);
    expect(balanceAfterWeeklyReward).to.eq(await itemNFT.balanceOf(alice.address, XP_BOOST));
    let balanceAfterDailyReward = await itemNFT.balanceOf(alice.address, equipments[equipments.length - 1].itemTokenId);
    expect(balanceAfterDailyReward).to.eq(prevBalanceDailyReward.toNumber() + equipments[equipments.length - 1].amount);

    // Next one should start the next round
    await ethers.provider.send("evm_increaseTime", [3600 * 24]);
    await ethers.provider.send("evm_mine", []);

    beforeBalances = await itemNFT.balanceOfs(
      alice.address,
      equipments.map((equipment) => equipment.itemTokenId)
    );

    for (let i = 0; i < 7; ++i) {
      await players.connect(alice).startAction(playerId, queuedAction, ActionQueueStatus.NONE);
      await ethers.provider.send("evm_increaseTime", [3600 * 24]);
      await ethers.provider.send("evm_mine", []);
    }

    afterBalances = await itemNFT.balanceOfs(
      alice.address,
      equipments.map((equipment) => equipment.itemTokenId)
    );

    for (let i = 0; i < 7; ++i) {
      expect(beforeBalances[i].toNumber() + equipments[i].amount).to.eq(afterBalances[i]);
    }

    // Also check extra week streak reward
    expect(balanceAfterWeeklyReward.toNumber() + 1).to.eq(await itemNFT.balanceOf(alice.address, XP_BOOST));
  });

  it("Daily Rewards, only 1 claim", async () => {
    const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);

    players.setDailyRewardsEnabled(true);

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
      timespan: 500,
      rightHandEquipmentTokenId: BRONZE_AXE,
      leftHandEquipmentTokenId: NONE,
      startTime: "0",
      isValid: true,
    };

    const oneDay = 24 * 3600;
    const oneWeek = oneDay * 7;
    const timestamp = Math.floor((Date.now() / 1000 - 4 * oneDay) / oneWeek) * oneWeek + (oneWeek + 4 * oneDay + 1); // Start next monday

    await ethers.provider.send("evm_setNextBlockTimestamp", [timestamp]);
    await ethers.provider.send("evm_mine", []);

    const equipment = {itemTokenId: COPPER_ORE, amount: 100};
    let balanceBefore = await itemNFT.balanceOf(alice.address, equipment.itemTokenId);
    await players.connect(alice).startAction(playerId, queuedAction, ActionQueueStatus.NONE);
    let balanceAfter = await itemNFT.balanceOf(alice.address, equipment.itemTokenId);
    expect(balanceAfter).to.eq(balanceBefore.toNumber() + equipment.amount);

    // Start again, shouldn't get any more rewards
    balanceBefore = await itemNFT.balanceOf(alice.address, equipment.itemTokenId);
    await players.connect(alice).startAction(playerId, queuedAction, ActionQueueStatus.NONE);
    balanceAfter = await itemNFT.balanceOf(alice.address, equipment.itemTokenId);
    expect(balanceAfter).to.eq(balanceBefore);
  });

  it("Daily Rewards, test rewards in new week", async () => {
    // TODO
  });
});
