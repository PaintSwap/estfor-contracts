import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {EstforConstants, EstforTypes} from "@paintswap/estfor-definitions";
import NONE, {ACTION_THIEVING_CHILD, BRONZE_ARROW} from "@paintswap/estfor-definitions/constants";
import {expect} from "chai";
import {ethers} from "hardhat";
import {
  bronzeHelmetStats,
  emptyActionChoice,
  getActionChoiceId,
  getActionId,
  getRequestId,
  GUAR_MUL,
  MAX_UNIQUE_TICKETS,
  SPAWN_MUL,
} from "../utils";
import {playersFixture} from "./PlayersFixture";
import {setupBasicWoodcutting} from "./utils";
import {emptyCombatStats} from "@paintswap/estfor-definitions/types";

const actionIsAvailable = true;

describe("Rewards", function () {
  this.retries(3);

  describe("XP threshold rewards", function () {
    it("Single", async function () {
      const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);

      const {queuedAction: queuedActionWoodcutting} = await setupBasicWoodcutting(itemNFT, world);
      const queuedAction = {...queuedActionWoodcutting};
      queuedAction.timespan = 500;

      const rewards: EstforTypes.Equipment[] = [{itemTokenId: EstforConstants.BRONZE_BAR, amount: 3}];
      await expect(players.addXPThresholdRewards([{xpThreshold: 499, rewards}])).to.be.revertedWithCustomError(
        players,
        "XPThresholdNotFound"
      );
      await players.addXPThresholdRewards([{xpThreshold: 500, rewards}]);

      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStatus.NONE);
      await ethers.provider.send("evm_increaseTime", [50]);
      await ethers.provider.send("evm_mine", []);

      let pendingQueuedActionState = await players.pendingQueuedActionState(alice.address, playerId);
      expect(pendingQueuedActionState.equipmentStates[0].producedItemTokenIds.length).is.eq(1);
      await players.connect(alice).processActions(playerId);
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.BRONZE_BAR)).to.eq(0);
      await ethers.provider.send("evm_increaseTime", [450]);
      await ethers.provider.send("evm_mine", []);
      pendingQueuedActionState = await players.pendingQueuedActionState(alice.address, playerId);
      expect(pendingQueuedActionState.equipmentStates[0].producedItemTokenIds.length).is.eq(1);
      expect(pendingQueuedActionState.xpRewardItemTokenIds.length).is.eq(1);
      expect(pendingQueuedActionState.xpRewardItemTokenIds[0]).is.eq(EstforConstants.BRONZE_BAR);
      expect(pendingQueuedActionState.xpRewardAmounts[0]).is.eq(3);

      await players.connect(alice).processActions(playerId);
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.BRONZE_BAR)).to.eq(3);
    });

    it("Multiple", async function () {
      const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);

      await itemNFT.addItem({
        ...EstforTypes.defaultInputItem,
        tokenId: EstforConstants.BRONZE_AXE,
        equipPosition: EstforTypes.EquipPosition.RIGHT_HAND,
      });

      const rate = 100 * GUAR_MUL; // per hour

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
      const queuedAction: EstforTypes.QueuedActionInput = {
        attire: EstforTypes.noAttire,
        actionId,
        combatStyle: EstforTypes.CombatStyle.NONE,
        choiceId: EstforConstants.NONE,
        regenerateId: EstforConstants.NONE,
        timespan: 1600,
        rightHandEquipmentTokenId: EstforConstants.BRONZE_AXE,
        leftHandEquipmentTokenId: EstforConstants.NONE,
      };

      const rewards: EstforTypes.Equipment[] = [{itemTokenId: EstforConstants.BRONZE_BAR, amount: 3}];
      await players.addXPThresholdRewards([{xpThreshold: 500, rewards}]);
      const rewards1: EstforTypes.Equipment[] = [{itemTokenId: EstforConstants.BRONZE_HELMET, amount: 4}];
      await players.addXPThresholdRewards([{xpThreshold: 1000, rewards: rewards1}]);

      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStatus.NONE);
      await ethers.provider.send("evm_increaseTime", [1600]);
      await ethers.provider.send("evm_mine", []);

      let pendingQueuedActionState = await players.pendingQueuedActionState(alice.address, playerId);
      expect(pendingQueuedActionState.xpRewardItemTokenIds.length).is.eq(2);
      expect(pendingQueuedActionState.xpRewardAmounts.length).is.eq(2);

      expect(pendingQueuedActionState.xpRewardItemTokenIds[0]).is.eq(EstforConstants.BRONZE_BAR);
      expect(pendingQueuedActionState.xpRewardAmounts[0]).is.eq(3);
      expect(pendingQueuedActionState.xpRewardItemTokenIds[1]).is.eq(EstforConstants.BRONZE_HELMET);
      expect(pendingQueuedActionState.xpRewardAmounts[1]).is.eq(4);

      await players.connect(alice).processActions(playerId);
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.BRONZE_BAR)).to.eq(3);
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.BRONZE_HELMET)).to.eq(4);
    });

    it("testModifyXP rewards", async function () {
      const {playerId, players, alice} = await loadFixture(playersFixture);

      const rewards: EstforTypes.Equipment[] = [{itemTokenId: EstforConstants.BRONZE_BAR, amount: 3}];
      await players.addXPThresholdRewards([{xpThreshold: 500, rewards}]);
      const rewards1: EstforTypes.Equipment[] = [{itemTokenId: EstforConstants.BRONZE_HELMET, amount: 4}];
      await players.addXPThresholdRewards([{xpThreshold: 1000, rewards: rewards1}]);

      // Test max level works
      await expect(players.testModifyXP(alice.address, playerId, EstforTypes.Skill.MELEE, 2070952, false))
        .to.emit(players, "AddXP")
        .withArgs(alice.address, playerId, EstforTypes.Skill.MELEE, 2070952)
        .and.to.emit(players, "ClaimedXPThresholdRewards")
        .withArgs(alice.address, playerId, [EstforConstants.BRONZE_BAR, EstforConstants.BRONZE_HELMET], [3, 4]);
      expect(await players.xp(playerId, EstforTypes.Skill.MELEE)).to.equal(2070952);

      await expect(players.testModifyXP(alice.address, playerId, EstforTypes.Skill.MELEE, 2080952, false))
        .to.emit(players, "AddXP")
        .withArgs(alice.address, playerId, EstforTypes.Skill.MELEE, 10000)
        .and.to.not.emit(players, "ClaimedXPThresholdRewards");
      expect(await players.xp(playerId, EstforTypes.Skill.MELEE)).to.equal(2080952);
    });

    // This was for a reported bug by doughbender where multiple actions were giving the same xp rewards triggering
    it("Check that multiple actions only give 1 set of xp rewards", async function () {
      const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);

      const {queuedAction: queuedActionWoodcutting} = await setupBasicWoodcutting(itemNFT, world);
      const queuedAction = {...queuedActionWoodcutting};
      queuedAction.timespan = 250;

      const rewards: EstforTypes.Equipment[] = [{itemTokenId: EstforConstants.BRONZE_BAR, amount: 3}];
      await expect(players.addXPThresholdRewards([{xpThreshold: 499, rewards}])).to.be.revertedWithCustomError(
        players,
        "XPThresholdNotFound"
      );
      await players.addXPThresholdRewards([{xpThreshold: 500, rewards}]);

      await players
        .connect(alice)
        .startActions(playerId, [queuedAction, queuedAction, queuedAction], EstforTypes.ActionQueueStatus.NONE);
      await ethers.provider.send("evm_increaseTime", [50]);
      await ethers.provider.send("evm_mine", []);

      let pendingQueuedActionState = await players.pendingQueuedActionState(alice.address, playerId);
      expect(pendingQueuedActionState.equipmentStates[0].producedItemTokenIds.length).is.eq(1);
      await players.connect(alice).processActions(playerId);
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.BRONZE_BAR)).to.eq(0);
      await ethers.provider.send("evm_increaseTime", [450]);
      await ethers.provider.send("evm_mine", []);
      pendingQueuedActionState = await players.pendingQueuedActionState(alice.address, playerId);
      expect(pendingQueuedActionState.equipmentStates[0].producedItemTokenIds.length).is.eq(1);
      expect(pendingQueuedActionState.xpRewardItemTokenIds.length).is.eq(1);
      expect(pendingQueuedActionState.xpRewardItemTokenIds[0]).is.eq(EstforConstants.BRONZE_BAR);
      expect(pendingQueuedActionState.xpRewardAmounts[0]).is.eq(3);

      await players.connect(alice).processActions(playerId);
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.BRONZE_BAR)).to.eq(3);
    });
  });

  describe("Daily Rewards", function () {
    it("Daily & weekly reward on starting actions", async function () {
      const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);

      players.setDailyRewardsEnabled(true);

      const {queuedAction} = await setupBasicWoodcutting(itemNFT, world);

      const oneDay = 24 * 3600;
      const oneWeek = oneDay * 7;
      const {timestamp: currentTimestamp} = await ethers.provider.getBlock("latest");
      const timestamp = Math.floor((currentTimestamp - 4 * oneDay) / oneWeek) * oneWeek + (oneWeek + 5 * oneDay); // Start next tuesday

      await ethers.provider.send("evm_setNextBlockTimestamp", [timestamp]);

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
        await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStatus.NONE);
        await ethers.provider.send("evm_increaseTime", [3600 * 24]);
      }
      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStatus.NONE);

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
      let prevBalanceDailyReward = await itemNFT.balanceOf(
        alice.address,
        equipments[equipments.length - 1].itemTokenId
      );
      await ethers.provider.send("evm_increaseTime", [3600 * 24]);
      await ethers.provider.send("evm_mine", []);

      const pendingQueuedActionState = await players.connect(alice).pendingQueuedActionState(alice.address, playerId);
      expect(pendingQueuedActionState.dailyRewardItemTokenIds.length).to.eq(1);
      expect(pendingQueuedActionState.dailyRewardItemTokenIds[0]).to.eq(equipments[equipments.length - 1].itemTokenId);
      expect(pendingQueuedActionState.dailyRewardAmounts[0]).to.eq(
        prevBalanceDailyReward.toNumber() + equipments[equipments.length - 1].amount
      );

      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStatus.NONE);
      expect(balanceAfterWeeklyReward).to.eq(await itemNFT.balanceOf(alice.address, EstforConstants.XP_BOOST));
      let balanceAfterDailyReward = await itemNFT.balanceOf(
        alice.address,
        equipments[equipments.length - 1].itemTokenId
      );
      expect(balanceAfterDailyReward).to.eq(
        prevBalanceDailyReward.toNumber() + equipments[equipments.length - 1].amount
      );

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
        await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStatus.NONE);
        if (i != 6) {
          await ethers.provider.send("evm_increaseTime", [3600 * 24]);
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

    it("Only 1 claim", async function () {
      const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);

      players.setDailyRewardsEnabled(true);

      const {queuedAction} = await setupBasicWoodcutting(itemNFT, world);

      const oneDay = 24 * 3600;
      const oneWeek = oneDay * 7;
      const {timestamp: currentTimestamp} = await ethers.provider.getBlock("latest");
      const timestamp = Math.floor((currentTimestamp - 4 * oneDay) / oneWeek) * oneWeek + (oneWeek + 4 * oneDay); // Start next monday

      await ethers.provider.send("evm_setNextBlockTimestamp", [timestamp]);

      const equipment = {itemTokenId: EstforConstants.COPPER_ORE, amount: 100};
      let balanceBefore = await itemNFT.balanceOf(alice.address, equipment.itemTokenId);
      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStatus.NONE);
      let balanceAfter = await itemNFT.balanceOf(alice.address, equipment.itemTokenId);
      expect(balanceAfter).to.eq(balanceBefore.toNumber() + equipment.amount);

      // Start again, shouldn't get any more rewards
      balanceBefore = await itemNFT.balanceOf(alice.address, equipment.itemTokenId);
      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStatus.NONE);
      balanceAfter = await itemNFT.balanceOf(alice.address, equipment.itemTokenId);
      expect(balanceAfter).to.eq(balanceBefore);
    });

    it("Update on process actions", async function () {
      const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);

      players.setDailyRewardsEnabled(true);

      const {queuedAction} = await setupBasicWoodcutting(itemNFT, world);

      const oneDay = 24 * 3600;
      const oneWeek = oneDay * 7;
      const {timestamp: currentTimestamp} = await ethers.provider.getBlock("latest");
      const timestamp = Math.floor((currentTimestamp - 4 * oneDay) / oneWeek) * oneWeek + (oneWeek + 4 * oneDay); // Start next monday

      await ethers.provider.send("evm_setNextBlockTimestamp", [timestamp]);

      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStatus.NONE);
      expect(await players.dailyClaimedRewards(playerId)).to.eql([true, false, false, false, false, false, false]);
      await ethers.provider.send("evm_increaseTime", [3600 * 24]);
      await players.connect(alice).processActions(playerId); // Daily reward should be given
      expect(await players.dailyClaimedRewards(playerId)).to.eql([true, true, false, false, false, false, false]);
    });

    it("Clan tier bonus reward upgrades", async function () {
      const {playerId, players, itemNFT, world, alice, clans} = await loadFixture(playersFixture);

      // Be a member of a clan
      await clans.addTiers([
        {
          id: 1,
          maxMemberCapacity: 3,
          maxBankCapacity: 3,
          maxImageId: 16,
          price: 0,
          minimumAge: 0,
        },
        {
          id: 2,
          maxMemberCapacity: 3,
          maxBankCapacity: 3,
          maxImageId: 16,
          price: 0,
          minimumAge: 0,
        },
      ]);

      let tierId = 1;
      const imageId = 1;
      await clans.connect(alice).createClan(playerId, "Clan name", "discord", "telegram", imageId, tierId);

      players.setDailyRewardsEnabled(true);
      let baseEquipment = {itemTokenId: EstforConstants.COPPER_ORE, amount: 100};

      const {queuedAction} = await setupBasicWoodcutting(itemNFT, world);
      const oneDay = 24 * 3600;
      const oneWeek = oneDay * 7;
      const {timestamp: currentTimestamp} = await ethers.provider.getBlock("latest");
      const timestamp = Math.floor((currentTimestamp - 4 * oneDay) / oneWeek) * oneWeek + (oneWeek + 4 * oneDay); // Start next monday
      await ethers.provider.send("evm_setNextBlockTimestamp", [timestamp]);

      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStatus.NONE);
      expect(await players.dailyClaimedRewards(playerId)).to.eql([true, false, false, false, false, false, false]);
      expect(await itemNFT.balanceOf(alice.address, baseEquipment.itemTokenId)).to.eq(110);

      // Next day
      baseEquipment = {itemTokenId: EstforConstants.COAL_ORE, amount: 200};

      const clanId = 1;
      tierId = 2;
      await clans.connect(alice).upgradeClan(clanId, playerId, tierId);

      await ethers.provider.send("evm_increaseTime", [3600 * 24]);
      await players.connect(alice).processActions(playerId);
      expect(await players.dailyClaimedRewards(playerId)).to.eql([true, true, false, false, false, false, false]);

      expect(await itemNFT.balanceOf(alice.address, baseEquipment.itemTokenId)).to.eq(240); // get 20% boost
    });

    it("Test rewards in new week", async function () {
      // TODO
    });
  });

  it("Guaranteed rewards", async function () {
    // TODO
  });

  it("Random reward ticket excess", async function () {
    const {playerId, players, itemNFT, world, alice, mockOracleClient} = await loadFixture(playersFixture);

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
    const numSpawned = 100 * SPAWN_MUL;
    let tx = await world.addAction({
      actionId: 1,
      info: {
        skill: EstforTypes.Skill.COMBAT,
        xpPerHour: 3600,
        minXP: 0,
        isDynamic: false,
        numSpawned,
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

    // Make sure it passes the next checkpoint so there are no issues running
    const {timestamp} = await ethers.provider.getBlock("latest");
    const nextCheckpoint = Math.floor(timestamp / 86400) * 86400 + 86400;
    const durationToNextCheckpoint = nextCheckpoint - timestamp + 1;
    await ethers.provider.send("evm_increaseTime", [durationToNextCheckpoint]);

    tx = await world.requestRandomWords();
    let requestId = getRequestId(tx);
    expect(requestId).to.not.eq(0);
    await mockOracleClient.fulfill(requestId, world.address);
    tx = await world.requestRandomWords();
    requestId = getRequestId(tx);
    expect(requestId).to.not.eq(0);
    await mockOracleClient.fulfill(requestId, world.address);

    const timespan = 3600 * numHours;
    expect(numHours * (numSpawned / SPAWN_MUL)).to.be.gt(MAX_UNIQUE_TICKETS);

    const queuedAction: EstforTypes.QueuedActionInput = {
      attire: {...EstforTypes.noAttire, head: EstforConstants.BRONZE_HELMET},
      actionId,
      combatStyle: EstforTypes.CombatStyle.ATTACK,
      choiceId,
      regenerateId: EstforConstants.COOKED_MINNUS,
      timespan,
      rightHandEquipmentTokenId: EstforConstants.BRONZE_SWORD,
      leftHandEquipmentTokenId: EstforConstants.NONE,
    };

    await itemNFT.addItem({
      ...EstforTypes.defaultInputItem,
      combatStats: {
        ...EstforTypes.emptyCombatStats,
        melee: 50,
      },
      tokenId: EstforConstants.BRONZE_SWORD,
      equipPosition: EstforTypes.EquipPosition.RIGHT_HAND,
    });
    await itemNFT.addItem({
      ...EstforTypes.defaultInputItem,
      combatStats: bronzeHelmetStats,
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
      healthRestored: 12,
      tokenId: EstforConstants.COOKED_MINNUS,
      equipPosition: EstforTypes.EquipPosition.FOOD,
    });

    await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStatus.NONE);

    await ethers.provider.send("evm_increaseTime", [3600 * 24]);
    await ethers.provider.send("evm_mine", []);

    let pendingQueuedActionState = await players.pendingQueuedActionState(alice.address, playerId);
    expect(pendingQueuedActionState.equipmentStates[0].producedItemTokenIds.length).to.eq(0);

    tx = await world.requestRandomWords();
    requestId = getRequestId(tx);
    expect(requestId).to.not.eq(0);
    await mockOracleClient.fulfill(requestId, world.address);

    pendingQueuedActionState = await players.pendingQueuedActionState(alice.address, playerId);
    expect(pendingQueuedActionState.equipmentStates[0].producedItemTokenIds.length).to.eq(1);

    await players.connect(alice).processActions(playerId);

    // Check output
    expect(await itemNFT.balanceOf(alice.address, BRONZE_ARROW)).to.eq(numHours * (numSpawned / SPAWN_MUL));
  });

  // This test only works if the timespan does not go over 00:00 utc
  it("Random rewards (many)", async function () {
    const {playerId, players, itemNFT, world, alice, mockOracleClient} = await loadFixture(playersFixture);

    this.timeout(100000); // 100 seconds, this test can take a while on CI

    await itemNFT.addItem({
      ...EstforTypes.defaultInputItem,
      tokenId: EstforConstants.BRONZE_AXE,
      equipPosition: EstforTypes.EquipPosition.RIGHT_HAND,
    });

    await itemNFT.addItem({
      ...EstforTypes.defaultInputItem,
      tokenId: EstforConstants.BRONZE_ARROW,
      equipPosition: EstforTypes.EquipPosition.ARROW_SATCHEL,
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
        numSpawned: 0,
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

    // Make sure it passes the next checkpoint so there are no issues running
    const {timestamp} = await ethers.provider.getBlock("latest");
    const nextCheckpoint = Math.floor(timestamp / 86400) * 86400 + 86400;
    const durationToNextCheckpoint = nextCheckpoint - timestamp + 1;
    await ethers.provider.send("evm_increaseTime", [durationToNextCheckpoint]);

    tx = await world.requestRandomWords();
    let requestId = getRequestId(tx);
    expect(requestId).to.not.eq(0);
    await mockOracleClient.fulfill(requestId, world.address);
    tx = await world.requestRandomWords();
    requestId = getRequestId(tx);
    expect(requestId).to.not.eq(0);
    await mockOracleClient.fulfill(requestId, world.address);

    const queuedAction: EstforTypes.QueuedActionInput = {
      attire: EstforTypes.noAttire,
      actionId,
      combatStyle: EstforTypes.CombatStyle.NONE,
      choiceId: EstforConstants.NONE,
      regenerateId: EstforConstants.NONE,
      timespan: 3600 * numHours,
      rightHandEquipmentTokenId: EstforConstants.BRONZE_AXE,
      leftHandEquipmentTokenId: EstforConstants.NONE,
    };

    let numProduced = 0;

    // Repeat the test a bunch of times to check the random rewards are as expected
    const numRepeats = 50;
    for (let i = 0; i < numRepeats; ++i) {
      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStatus.NONE);
      let endTime;
      {
        const actionQueue = await players.getActionQueue(playerId);
        expect(actionQueue.length).to.eq(1);
        endTime = (await players.players(playerId)).currentActionStartTime + actionQueue[0].timespan;
      }

      expect(await world.hasRandomWord(endTime)).to.be.false;

      await ethers.provider.send("evm_increaseTime", [3600 * 24]);
      await players.connect(alice).processActions(playerId);
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.BRONZE_ARROW)).to.eq(numProduced);

      expect((await players.getPendingRandomRewards(playerId)).length).to.eq(1);

      let pendingQueuedActionState = await players.pendingQueuedActionState(alice.address, playerId);
      expect(pendingQueuedActionState.equipmentStates.length).to.eq(0);

      tx = await world.requestRandomWords();
      let requestId = getRequestId(tx);
      expect(requestId).to.not.eq(0);
      await mockOracleClient.fulfill(requestId, world.address);
      await ethers.provider.send("evm_increaseTime", [24 * 3600]);
      tx = await world.requestRandomWords();
      requestId = getRequestId(tx);
      expect(requestId).to.not.eq(0);
      await mockOracleClient.fulfill(requestId, world.address);

      expect(await world.hasRandomWord(endTime)).to.be.true;

      pendingQueuedActionState = await players.pendingQueuedActionState(alice.address, playerId);

      if (pendingQueuedActionState.producedPastRandomRewards.length != 0) {
        expect(pendingQueuedActionState.producedPastRandomRewards.length).to.eq(1);

        const produced = pendingQueuedActionState.producedPastRandomRewards[0].amount;
        numProduced += produced;
        expect(pendingQueuedActionState.producedPastRandomRewards[0].itemTokenId).to.be.eq(
          EstforConstants.BRONZE_ARROW
        );
      }
    }

    await ethers.provider.send("evm_increaseTime", [24 * 3600]);
    requestId = getRequestId(await world.requestRandomWords());
    await mockOracleClient.fulfill(requestId, world.address);
    await players.connect(alice).processActions(playerId);

    const expectedTotal = numRepeats * randomChanceFraction * numHours;
    expect(numProduced).to.not.eq(expectedTotal); // Very unlikely to be exact, but possible. This checks there is at least some randomness
    expect(numProduced).to.be.gte(expectedTotal * 0.85); // Within 15% below
    expect(numProduced).to.be.lte(expectedTotal * 1.15); // 15% of the time we should get more than 50% of the reward
  });

  it("Multiple random rewards (many)", async function () {
    const {playerId, players, itemNFT, world, alice, mockOracleClient} = await loadFixture(playersFixture);

    this.timeout(100000); // 100 seconds, this test can take a while on CI

    await itemNFT.addItem({
      ...EstforTypes.defaultInputItem,
      tokenId: EstforConstants.BRONZE_AXE,
      equipPosition: EstforTypes.EquipPosition.RIGHT_HAND,
    });

    await itemNFT.addItem({
      ...EstforTypes.defaultInputItem,
      tokenId: EstforConstants.BRONZE_ARROW,
      equipPosition: EstforTypes.EquipPosition.ARROW_SATCHEL,
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
        numSpawned: 0,
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

    // Make sure it passes the next checkpoint so there are no issues running
    const {timestamp} = await ethers.provider.getBlock("latest");
    const nextCheckpoint = Math.floor(timestamp / 86400) * 86400 + 86400;
    const durationToNextCheckpoint = nextCheckpoint - timestamp + 1;
    await ethers.provider.send("evm_increaseTime", [durationToNextCheckpoint]);

    tx = await world.requestRandomWords();
    let requestId = getRequestId(tx);
    expect(requestId).to.not.eq(0);
    await mockOracleClient.fulfill(requestId, world.address);
    tx = await world.requestRandomWords();
    requestId = getRequestId(tx);
    expect(requestId).to.not.eq(0);
    await mockOracleClient.fulfill(requestId, world.address);

    const queuedAction: EstforTypes.QueuedActionInput = {
      attire: EstforTypes.noAttire,
      actionId,
      combatStyle: EstforTypes.CombatStyle.NONE,
      choiceId: EstforConstants.NONE,
      regenerateId: EstforConstants.NONE,
      timespan: 3600 * numHours,
      rightHandEquipmentTokenId: EstforConstants.BRONZE_AXE,
      leftHandEquipmentTokenId: EstforConstants.NONE,
    };

    const balanceMap = new Map<number, number>();
    balanceMap.set(EstforConstants.BRONZE_BAR, 0);
    balanceMap.set(EstforConstants.BRONZE_ARROW, 0);
    balanceMap.set(EstforConstants.BRONZE_TASSETS, 0);
    balanceMap.set(EstforConstants.BRONZE_GAUNTLETS, 0);

    // Repeat the test a bunch of times to check the random rewards are as expected
    const numRepeats = 30;
    for (let i = 0; i < numRepeats; ++i) {
      await players
        .connect(alice)
        .startActions(playerId, [queuedAction, queuedAction], EstforTypes.ActionQueueStatus.KEEP_LAST_IN_PROGRESS);
      let endTime;
      {
        const actionQueue = await players.getActionQueue(playerId);
        expect(actionQueue.length).to.eq(2);
        endTime =
          (await players.players(playerId)).currentActionStartTime + actionQueue[0].timespan + actionQueue[1].timespan;
      }

      expect(await world.hasRandomWord(endTime)).to.be.false;

      await ethers.provider.send("evm_increaseTime", [3600 * 24]);
      await players.connect(alice).processActions(playerId);
      for (const [itemTokenId, amount] of balanceMap) {
        expect(await itemNFT.balanceOf(alice.address, itemTokenId)).to.eq(balanceMap.get(itemTokenId));
      }

      expect((await players.getPendingRandomRewards(playerId)).length).to.eq(2);

      let pendingQueuedActionState = await players.pendingQueuedActionState(alice.address, playerId);
      expect(pendingQueuedActionState.producedPastRandomRewards.length).to.eq(0);

      tx = await world.requestRandomWords();
      let requestId = getRequestId(tx);
      expect(requestId).to.not.eq(0);
      await mockOracleClient.fulfill(requestId, world.address);

      expect(await world.hasRandomWord(endTime)).to.be.true;

      pendingQueuedActionState = await players.pendingQueuedActionState(alice.address, playerId);
      if (pendingQueuedActionState.producedPastRandomRewards.length != 0) {
        expect(pendingQueuedActionState.producedPastRandomRewards.length).to.be.oneOf([1, 2, 3, 4, 5, 6, 7, 8]);

        for (const reward of pendingQueuedActionState.producedPastRandomRewards) {
          balanceMap.set(reward.itemTokenId, balanceMap.get(reward.itemTokenId)! + reward.amount);
        }
      }
    }

    await ethers.provider.send("evm_increaseTime", [24 * 3600]);
    requestId = getRequestId(await world.requestRandomWords());
    await mockOracleClient.fulfill(requestId, world.address);
    await players.connect(alice).processActions(playerId);

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

  it("PendingRandomRewards should be added each time an action is processed", async function () {
    const {playerId, players, world, alice, mockOracleClient} = await loadFixture(playersFixture);

    const randomChance = 65535; // 100%
    let tx = await world.addAction({
      actionId: 1,
      info: {
        skill: EstforTypes.Skill.THIEVING,
        xpPerHour: 3600,
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
      combatStats: emptyCombatStats,
    });
    const actionId = await getActionId(tx);
    const numHours = 5;

    // Set it 2 hours before the next checkpoint so that we can cross the boundary
    const {timestamp} = await ethers.provider.getBlock("latest");
    const nextCheckpoint = Math.floor(timestamp / 86400) * 86400 + 86400;
    const durationToNextCheckpoint = nextCheckpoint - timestamp - (2 * 3600 - 2);
    await ethers.provider.send("evm_increaseTime", [durationToNextCheckpoint]);

    tx = await world.requestRandomWords();
    let requestId = getRequestId(tx);
    expect(requestId).to.not.eq(0);
    await mockOracleClient.fulfill(requestId, world.address);
    const timespan = 3600 * numHours;

    const queuedAction: EstforTypes.QueuedActionInput = {
      attire: EstforTypes.noAttire,
      actionId,
      combatStyle: EstforTypes.CombatStyle.NONE,
      choiceId: NONE,
      regenerateId: EstforConstants.NONE,
      timespan,
      rightHandEquipmentTokenId: EstforConstants.NONE,
      leftHandEquipmentTokenId: EstforConstants.NONE,
    };

    await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStatus.NONE);

    await ethers.provider.send("evm_increaseTime", [3600 + 60]); // 1 hour 1 minute
    await ethers.provider.send("evm_mine", []);
    let pendingQueuedActionState = await players.pendingQueuedActionState(alice.address, playerId);
    expect(pendingQueuedActionState.equipmentStates[0].producedItemTokenIds.length).to.eq(0);
    expect(pendingQueuedActionState.actionMetadatas[0].rolls).to.eq(1); // Should have a roll
    await players.connect(alice).processActions(playerId); // Continues the action
    let pendingRandomRewards = await players.getPendingRandomRewards(playerId);
    expect(pendingRandomRewards.length).to.eq(1);
    expect(pendingRandomRewards[0].xpElapsedTime).to.eq(3600);
    await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]); // Finished
    await ethers.provider.send("evm_mine", []);
    pendingQueuedActionState = await players.pendingQueuedActionState(alice.address, playerId);
    expect(pendingQueuedActionState.actionMetadatas[0].rolls).to.eq(numHours - 1);
    await players.connect(alice).processActions(playerId); // Finishes the action
    pendingRandomRewards = await players.getPendingRandomRewards(playerId);
    expect(pendingRandomRewards.length).to.eq(2); // Should now get the other pending random rewards
    expect(pendingRandomRewards[1].xpElapsedTime).to.eq(timespan - 3600);
  });

  // Could be a part of world if there was bytecode space
  it("Check random bytes", async function () {
    const {playerId, world, mockOracleClient} = await loadFixture(playersFixture);
    const {timestamp} = await ethers.provider.getBlock("latest");
    let numTickets = 16; // 240
    await expect(world.getRandomBytes(numTickets, timestamp - 86400, playerId)).to.be.reverted;
    const tx = await world.requestRandomWords();
    let requestId = getRequestId(tx);
    expect(requestId).to.not.eq(0);
    await mockOracleClient.fulfill(requestId, world.address);
    let randomBytes = await world.getRandomBytes(numTickets, timestamp - 86400, playerId);
    expect(ethers.utils.hexDataLength(randomBytes)).to.be.eq(32);
    numTickets = 48;

    const randomBytes1 = await world.getRandomBytes(numTickets, timestamp - 86400, playerId);
    expect(ethers.utils.hexDataLength(randomBytes1)).to.be.eq(32 * 3);

    numTickets = 49;
    const randomBytes2 = await world.getRandomBytes(numTickets, timestamp - 86400, playerId);
    expect(ethers.utils.hexDataLength(randomBytes2)).to.be.eq(32 * 3 * 5);
  });

  it("Rewards without XP", async function () {
    // Check that you can get guaranteed rewards even if you don't get XP (rewards rate >> XP rate)
    const {playerId, players, alice, world, itemNFT} = await loadFixture(playersFixture);

    const rate = 3600 * GUAR_MUL; // per hour
    const tx = await world.addAction({
      actionId: 1,
      info: {
        skill: EstforTypes.Skill.WOODCUTTING,
        xpPerHour: 0,
        minXP: 0,
        isDynamic: false,
        numSpawned: 0,
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
    const actionId = getActionId(tx);

    const queuedAction: EstforTypes.QueuedActionInput = {
      attire: EstforTypes.noAttire,
      actionId,
      combatStyle: EstforTypes.CombatStyle.NONE,
      choiceId: EstforConstants.NONE,
      regenerateId: EstforConstants.NONE,
      timespan: 24 * 3600,
      rightHandEquipmentTokenId: EstforConstants.BRONZE_AXE,
      leftHandEquipmentTokenId: EstforConstants.NONE,
    };

    await itemNFT.addItem({
      ...EstforTypes.defaultInputItem,
      tokenId: EstforConstants.BRONZE_AXE,
      equipPosition: EstforTypes.EquipPosition.RIGHT_HAND,
    });

    await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStatus.NONE);
    await ethers.provider.send("evm_increaseTime", [3600]);
    await ethers.provider.send("evm_mine", []);
    expect(await itemNFT.balanceOf(alice.address, EstforConstants.LOG)).to.eq(0);

    let pendingQueuedActionState = await players.pendingQueuedActionState(alice.address, playerId);
    expect(pendingQueuedActionState.equipmentStates[0].producedItemTokenIds.length).is.eq(1);
    expect(pendingQueuedActionState.equipmentStates[0].producedAmounts[0]).to.gt(0);
    expect(pendingQueuedActionState.equipmentStates[0].producedItemTokenIds[0]).to.eq(EstforConstants.LOG);
    expect(await players.xp(playerId, EstforTypes.Skill.WOODCUTTING)).to.eq(0);
    await players.connect(alice).processActions(playerId);
    // Confirm 0 XP but got wood
    expect(await players.xp(playerId, EstforTypes.Skill.WOODCUTTING)).to.eq(0);
    expect(await itemNFT.balanceOf(alice.address, EstforConstants.LOG)).to.be.gt(0);
  });

  it("Check past random rewards which are claimed the following day don't cause issues with (many)", async function () {
    const {playerId, players, world, alice, mockOracleClient} = await loadFixture(playersFixture);

    const randomChance = 32000; // 50%
    let tx = await world.addAction({
      actionId: ACTION_THIEVING_CHILD,
      info: {
        skill: EstforTypes.Skill.THIEVING,
        xpPerHour: 3600,
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
      randomRewards: [{itemTokenId: EstforConstants.LOG, chance: randomChance, amount: 255}],
      combatStats: emptyCombatStats,
    });
    const actionId = await getActionId(tx);

    const numHours = 3;
    const timespan = numHours * 3600;
    const queuedAction: EstforTypes.QueuedActionInput = {
      attire: EstforTypes.noAttire,
      actionId,
      combatStyle: EstforTypes.CombatStyle.NONE,
      choiceId: NONE,
      regenerateId: EstforConstants.NONE,
      timespan,
      rightHandEquipmentTokenId: EstforConstants.NONE,
      leftHandEquipmentTokenId: EstforConstants.NONE,
    };

    let requestId = getRequestId(await world.requestRandomWords());
    await mockOracleClient.fulfill(requestId, world.address);

    // Try many times as we are relying on random chance
    for (let i = 0; i < 20; ++i) {
      // Start the following day to keep things organised
      const {timestamp} = await ethers.provider.getBlock("latest");
      const nextCheckpoint = Math.floor(timestamp / 86400) * 86400 + 86400 * 2;
      const durationToNextCheckpoint = nextCheckpoint - timestamp - (3 * 3600 + 10 + Math.floor(Math.random() * 10)); // 3 hours before the next checkpoint
      await ethers.provider.send("evm_increaseTime", [durationToNextCheckpoint]);
      let requestId = getRequestId(await world.requestRandomWords());
      await mockOracleClient.fulfill(requestId, world.address);
      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStatus.NONE);
      await ethers.provider.send("evm_increaseTime", [7200 + 4]);
      await players.connect(alice).processActions(playerId); // Continues the action
      await ethers.provider.send("evm_increaseTime", [12 * 3600]); // Go to tomorrow
      requestId = getRequestId(await world.requestRandomWords());
      await mockOracleClient.fulfill(requestId, world.address);
      await players.connect(alice).processActions(playerId); // Continues the action
    }
  });

  it("promotional mint", async function () {
    const {itemNFT, players, owner, alice, bob} = await loadFixture(playersFixture);

    const redeemCode = "1111111111111111";
    await expect(players.mintPromotionalPack(alice.address, "11231")).to.be.revertedWithCustomError(
      players,
      "InvalidRedeemCode"
    );

    // Check that only promotional admins can mint
    await expect(players.connect(bob).mintPromotionalPack(owner.address, redeemCode)).to.be.revertedWithCustomError(
      players,
      "NotPromotionalAdmin"
    );

    await players.mintPromotionalPack(alice.address, redeemCode);
    await expect(players.mintPromotionalPack(alice.address, redeemCode)).to.be.revertedWithCustomError(
      players,
      "PromotionAlreadyClaimed"
    );

    const balances = await itemNFT.balanceOfs(alice.address, [
      EstforConstants.XP_BOOST,
      EstforConstants.SKILL_BOOST,
      EstforConstants.COOKED_FEOLA,
      EstforConstants.SHADOW_SCROLL,
      EstforConstants.SECRET_EGG_2,
    ]);

    expect(balances).to.deep.eq([5, 3, 200, 300, 1]);
  });
});
