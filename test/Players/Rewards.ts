import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {EstforConstants, EstforTypes} from "@paintswap/estfor-definitions";
import NONE, {ACTION_THIEVING_CHILD, BRONZE_ARROW} from "@paintswap/estfor-definitions/constants";
import {expect} from "chai";
import {ethers} from "hardhat";
import {
  bronzeHelmetStats,
  getActionChoiceId,
  getActionId,
  GUAR_MUL,
  MAX_UNIQUE_TICKETS,
  requestAndFulfillRandomWords,
  SPAWN_MUL,
} from "../utils";
import {playersFixture} from "./PlayersFixture";
import {setupBasicMeleeCombat, setupBasicWoodcutting} from "./utils";
import {defaultActionChoice, emptyCombatStats} from "@paintswap/estfor-definitions/types";

const actionIsAvailable = true;

describe("Rewards", function () {
  this.retries(5);

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

      await itemNFT.addItems([
        {
          ...EstforTypes.defaultItemInput,
          tokenId: EstforConstants.BRONZE_AXE,
          equipPosition: EstforTypes.EquipPosition.RIGHT_HAND,
        },
      ]);

      const rate = 100 * GUAR_MUL; // per hour

      const tx = await world.addActions([
        {
          actionId: 1,
          info: {
            skill: EstforTypes.Skill.WOODCUTTING,
            xpPerHour: 3600,
            minXP: 0,
            isDynamic: false,
            worldLocation: 0,
            isFullModeOnly: false,
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
        },
      ]);

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

    it("Adding to same XP reward should fail", async function () {
      const {players} = await loadFixture(playersFixture);
      const rewards: EstforTypes.Equipment[] = [{itemTokenId: EstforConstants.BRONZE_BAR, amount: 3}];
      await players.addXPThresholdRewards([{xpThreshold: 500, rewards}]);
      await expect(players.addXPThresholdRewards([{xpThreshold: 500, rewards}])).to.be.revertedWithCustomError(
        players,
        "XPThresholdAlreadyExists"
      );
    });

    it("Editing non-existent XP reward should fail", async function () {
      const {players} = await loadFixture(playersFixture);
      const rewards: EstforTypes.Equipment[] = [{itemTokenId: EstforConstants.BRONZE_BAR, amount: 3}];
      await expect(players.editXPThresholdRewards([{xpThreshold: 500, rewards}])).to.be.revertedWithCustomError(
        players,
        "XPThresholdDoesNotExist"
      );
    });

    it("Editing an existing XP reward should work", async function () {
      const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);

      let rewards: EstforTypes.Equipment[] = [{itemTokenId: EstforConstants.BRONZE_BAR, amount: 3}];
      await players.addXPThresholdRewards([{xpThreshold: 500, rewards}]);
      rewards = [{itemTokenId: EstforConstants.BRONZE_BAR, amount: 10}];
      await players.editXPThresholdRewards([{xpThreshold: 500, rewards}]);

      const {queuedAction: queuedActionWoodcutting} = await setupBasicWoodcutting(itemNFT, world);
      const queuedAction = {...queuedActionWoodcutting};
      queuedAction.timespan = 500;

      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStatus.NONE);
      await ethers.provider.send("evm_increaseTime", [50]);
      await players.connect(alice).processActions(playerId);

      expect(await itemNFT.balanceOf(alice.address, EstforConstants.BRONZE_BAR)).to.eq(0);
      await ethers.provider.send("evm_increaseTime", [450]);
      await ethers.provider.send("evm_mine", []);
      const pendingQueuedActionState = await players.pendingQueuedActionState(alice.address, playerId);
      expect(pendingQueuedActionState.xpRewardItemTokenIds.length).is.eq(1);
      expect(pendingQueuedActionState.xpRewardItemTokenIds[0]).is.eq(EstforConstants.BRONZE_BAR);
      expect(pendingQueuedActionState.xpRewardAmounts[0]).is.eq(10);
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

      // Check balance
      await expect(players.testModifyXP(alice.address, playerId, EstforTypes.Skill.DEFENCE, 2070952, false))
        .to.emit(players, "AddXP")
        .withArgs(alice.address, playerId, EstforTypes.Skill.DEFENCE, 2070952)
        .and.to.not.emit(players, "ClaimedXPThresholdRewards");
      expect(await players.xp(playerId, EstforTypes.Skill.DEFENCE)).to.equal(2070952);
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
    it("Daily & weekly reward when starting an action", async function () {
      const {playerId, players, itemNFT, world, alice, mockOracleClient} = await loadFixture(playersFixture);

      await players.setDailyRewardsEnabled(true);

      const oneDay = 24 * 3600;
      const oneWeek = oneDay * 7;
      const {timestamp: currentTimestamp} = await ethers.provider.getBlock("latest");
      const timestamp = Math.floor((currentTimestamp - 4 * oneDay) / oneWeek) * oneWeek + (oneWeek + 5 * oneDay); // Start next tuesday

      const numDays = Math.floor(timestamp - currentTimestamp) / oneDay;

      await requestAndFulfillRandomWords(world, mockOracleClient);

      await ethers.provider.send("evm_setNextBlockTimestamp", [timestamp]);

      for (let i = 0; i < numDays; ++i) {
        await requestAndFulfillRandomWords(world, mockOracleClient);
      }

      // Get the new equipments for the next week
      let dailyRewards = await world.getActiveDailyAndWeeklyRewards(1, playerId);
      let equipments = dailyRewards.slice(1, 6); // skip first and last
      let equipmentCache = new Map<number, number>();
      for (let i = 0; i < equipments.length; ++i) {
        equipmentCache.set(
          equipments[i].itemTokenId,
          (equipmentCache.get(equipments[i].itemTokenId) || 0) + equipments[i].amount
        );
      }
      let weeklyEquipment = dailyRewards[7];
      let balanceBeforeWeeklyReward = await itemNFT.balanceOf(alice.address, weeklyEquipment.itemTokenId);

      let beforeBalances = await itemNFT.balanceOfs(
        alice.address,
        equipments.map((equipment) => equipment.itemTokenId)
      );

      // Change reward else it conflicts with tiered daily rewards
      const {queuedAction} = await setupBasicWoodcutting(
        itemNFT,
        world,
        100 * GUAR_MUL,
        20,
        EstforConstants.MAGICAL_LOG
      );

      for (let i = 0; i < 4; ++i) {
        await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStatus.NONE);
        await ethers.provider.send("evm_increaseTime", [3600 * 24]);
        await requestAndFulfillRandomWords(world, mockOracleClient);
      }
      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStatus.NONE);

      let afterBalances = await itemNFT.balanceOfs(
        alice.address,
        equipments.map((equipment) => equipment.itemTokenId)
      );

      for (let i = 0; i < 5; ++i) {
        expect(afterBalances[i]).to.eq(
          beforeBalances[i].toNumber() + (equipmentCache.get(equipments[i].itemTokenId) || 0)
        );
      }

      expect(await players.dailyClaimedRewards(playerId)).to.eql([false, true, true, true, true, true, false]);

      // Last day of the week. This isn't a full week so shouldn't get weekly rewards, but still get daily rewards
      let balanceAfterWeeklyReward = await itemNFT.balanceOf(alice.address, weeklyEquipment.itemTokenId);
      expect(balanceBeforeWeeklyReward).to.eq(balanceAfterWeeklyReward);
      const sundayReward = dailyRewards[dailyRewards.length - 2];
      let prevBalanceDailyReward = await itemNFT.balanceOf(alice.address, sundayReward.itemTokenId);
      await ethers.provider.send("evm_increaseTime", [3600 * 24]);
      await requestAndFulfillRandomWords(world, mockOracleClient);
      // Check the last day of the week
      const pendingQueuedActionState = await players.connect(alice).pendingQueuedActionState(alice.address, playerId);
      expect(pendingQueuedActionState.dailyRewardItemTokenIds.length).to.eq(1);
      expect(pendingQueuedActionState.dailyRewardItemTokenIds[0]).to.eq(sundayReward.itemTokenId);

      equipmentCache.set(
        sundayReward.itemTokenId,
        (equipmentCache.get(sundayReward.itemTokenId) || 0) + sundayReward.amount
      );

      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStatus.NONE);
      expect(balanceAfterWeeklyReward).to.eq(await itemNFT.balanceOf(alice.address, weeklyEquipment.itemTokenId));
      let balanceAfterDailyReward = await itemNFT.balanceOf(alice.address, sundayReward.itemTokenId);
      expect(balanceAfterDailyReward).to.eq(prevBalanceDailyReward.toNumber() + sundayReward.amount);

      expect(await players.dailyClaimedRewards(playerId)).to.eql([false, true, true, true, true, true, true]);

      // Next one should start the next round
      await ethers.provider.send("evm_increaseTime", [3600 * 24]);
      await requestAndFulfillRandomWords(world, mockOracleClient);

      expect(await players.dailyClaimedRewards(playerId)).to.eql([false, false, false, false, false, false, false]);

      dailyRewards = await world.getActiveDailyAndWeeklyRewards(1, playerId);
      equipments = dailyRewards.slice(0, 7);
      equipmentCache = new Map<number, number>();
      for (let i = 0; i < equipments.length; ++i) {
        equipmentCache.set(
          equipments[i].itemTokenId,
          (equipmentCache.get(equipments[i].itemTokenId) || 0) + equipments[i].amount
        );
      }

      weeklyEquipment = dailyRewards[7];

      beforeBalances = await itemNFT.balanceOfs(
        alice.address,
        equipments.map((equipment) => equipment.itemTokenId)
      );

      for (let i = 0; i < 7; ++i) {
        await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStatus.NONE);
        if (i != 6) {
          await ethers.provider.send("evm_increaseTime", [3600 * 24]);
          await requestAndFulfillRandomWords(world, mockOracleClient);
        }
      }

      expect(await players.dailyClaimedRewards(playerId)).to.eql([true, true, true, true, true, true, true]);

      afterBalances = await itemNFT.balanceOfs(
        alice.address,
        equipments.map((equipment) => equipment.itemTokenId)
      );

      for (let i = 0; i < 7; ++i) {
        expect(beforeBalances[i].toNumber() + (equipmentCache.get(equipments[i].itemTokenId) || 0)).to.eq(
          afterBalances[i]
        );
      }

      // Also check extra week streak reward
      expect(balanceAfterWeeklyReward.toNumber() + weeklyEquipment.amount).to.eq(
        await itemNFT.balanceOf(alice.address, weeklyEquipment.itemTokenId)
      );
    });

    it("Only 1 claim", async function () {
      const {playerId, players, itemNFT, world, alice, mockOracleClient} = await loadFixture(playersFixture);

      await players.setDailyRewardsEnabled(true);

      const {queuedAction} = await setupBasicWoodcutting(itemNFT, world, 100 * GUAR_MUL, 20);

      const oneDay = 24 * 3600;
      const oneWeek = oneDay * 7;
      const {timestamp: currentTimestamp} = await ethers.provider.getBlock("latest");
      const timestamp = Math.floor((currentTimestamp - 4 * oneDay) / oneWeek) * oneWeek + (oneWeek + 4 * oneDay); // Start next monday

      await requestAndFulfillRandomWords(world, mockOracleClient);
      await ethers.provider.send("evm_setNextBlockTimestamp", [timestamp]);

      const numDays = Math.floor(timestamp - currentTimestamp) / oneDay;
      for (let i = 0; i < numDays; ++i) {
        await requestAndFulfillRandomWords(world, mockOracleClient);
      }

      // Get the new equipments for the next week
      let equipments = await world.getActiveDailyAndWeeklyRewards(1, playerId);
      let equipment = equipments[0];

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
      const {playerId, players, itemNFT, world, alice, mockOracleClient} = await loadFixture(playersFixture);

      await players.setDailyRewardsEnabled(true);

      const {queuedAction} = await setupBasicWoodcutting(itemNFT, world);

      const oneDay = 24 * 3600;
      const oneWeek = oneDay * 7;
      const {timestamp: currentTimestamp} = await ethers.provider.getBlock("latest");
      const timestamp = Math.floor((currentTimestamp - 4 * oneDay) / oneWeek) * oneWeek + (oneWeek + 4 * oneDay); // Start next monday

      await requestAndFulfillRandomWords(world, mockOracleClient);
      await ethers.provider.send("evm_setNextBlockTimestamp", [timestamp]);

      const numDays = Math.floor(timestamp - currentTimestamp) / oneDay;
      for (let i = 0; i < numDays; ++i) {
        await requestAndFulfillRandomWords(world, mockOracleClient);
      }

      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStatus.NONE);
      expect(await players.dailyClaimedRewards(playerId)).to.eql([true, false, false, false, false, false, false]);
      await ethers.provider.send("evm_increaseTime", [3600 * 24]);
      await players.connect(alice).processActions(playerId); // Daily reward should be given
      expect(await players.dailyClaimedRewards(playerId)).to.eql([true, true, false, false, false, false, false]);
    });

    it("Can only get Monday's reward if the oracle has been called", async function () {
      // So that people can't get last Monday's daily reward
      const {playerId, players, itemNFT, world, alice, mockOracleClient} = await loadFixture(playersFixture);

      await players.setDailyRewardsEnabled(true);

      const {queuedAction} = await setupBasicWoodcutting(itemNFT, world);

      const oneDay = 24 * 3600;
      const oneWeek = oneDay * 7;
      const {timestamp: currentTimestamp} = await ethers.provider.getBlock("latest");
      const timestamp = Math.floor((currentTimestamp - 4 * oneDay) / oneWeek) * oneWeek + (oneWeek + 4 * oneDay); // Start next monday

      const numDays = Math.floor(timestamp - currentTimestamp) / oneDay;

      await requestAndFulfillRandomWords(world, mockOracleClient);

      await ethers.provider.send("evm_setNextBlockTimestamp", [timestamp]);

      // Request all up to the last day
      for (let i = 0; i < numDays - 1; ++i) {
        await requestAndFulfillRandomWords(world, mockOracleClient);
      }

      // Get the new equipments for the next week
      let equipments = await world.getActiveDailyAndWeeklyRewards(1, playerId);
      let mondayEquipment = equipments[0];

      let balanceBeforeMondayReward = await itemNFT.balanceOf(alice.address, mondayEquipment.itemTokenId);
      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStatus.NONE);
      // Do not get Monday reward yet
      expect(balanceBeforeMondayReward).eq(await itemNFT.balanceOf(alice.address, mondayEquipment.itemTokenId));

      await requestAndFulfillRandomWords(world, mockOracleClient);
      await players.connect(alice).processActions(playerId);

      equipments = await world.getActiveDailyAndWeeklyRewards(1, playerId);
      mondayEquipment = equipments[0];
      expect(balanceBeforeMondayReward.add(mondayEquipment.amount)).eq(
        await itemNFT.balanceOf(alice.address, mondayEquipment.itemTokenId)
      );
    });

    it("Clan tier bonus reward upgrades", async function () {
      const {playerId, players, itemNFT, world, alice, clans, mockOracleClient} = await loadFixture(playersFixture);

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

      await players.setDailyRewardsEnabled(true);

      const {queuedAction} = await setupBasicWoodcutting(itemNFT, world, 100 * GUAR_MUL, 20);
      const oneDay = 24 * 3600;
      const oneWeek = oneDay * 7;
      const {timestamp: currentTimestamp} = await ethers.provider.getBlock("latest");
      const timestamp = Math.floor((currentTimestamp - 4 * oneDay) / oneWeek) * oneWeek + (oneWeek + 4 * oneDay); // Start next monday

      const numDays = Math.floor(timestamp - currentTimestamp) / oneDay;

      await requestAndFulfillRandomWords(world, mockOracleClient);

      await ethers.provider.send("evm_setNextBlockTimestamp", [timestamp]);

      for (let i = 0; i < numDays; ++i) {
        await requestAndFulfillRandomWords(world, mockOracleClient);
      }

      const equipments = await world.getActiveDailyAndWeeklyRewards(1, playerId);

      let baseEquipment = equipments[0];
      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStatus.NONE);
      expect(await players.dailyClaimedRewards(playerId)).to.eql([true, false, false, false, false, false, false]);
      expect(await itemNFT.balanceOf(alice.address, baseEquipment.itemTokenId)).to.eq(
        Math.round(baseEquipment.amount * 1.1)
      );

      // Next day
      baseEquipment = equipments[1];

      const clanId = 1;
      tierId = 2;
      await clans.connect(alice).upgradeClan(clanId, playerId, tierId);

      await ethers.provider.send("evm_increaseTime", [3600 * 24]);
      await players.connect(alice).processActions(playerId);
      expect(await players.dailyClaimedRewards(playerId)).to.eql([true, true, false, false, false, false, false]);

      // If you manage to get the same tokenId then add that as well
      let expectedAmount = Math.round(baseEquipment.amount * 1.2); // get 20% boost
      if (equipments[0].itemTokenId == equipments[1].itemTokenId) {
        expectedAmount += Math.round(equipments[0].amount * 1.1);
      }

      expect(await itemNFT.balanceOf(alice.address, baseEquipment.itemTokenId)).to.be.eq(expectedAmount);
    });

    it("Test rewards in new week", async function () {
      // TODO
    });

    it("Tiered rewards", async function () {
      const {playerId, players, itemNFT, world, alice, mockOracleClient} = await loadFixture(playersFixture);

      await players.setDailyRewardsEnabled(true);

      const {queuedAction} = await setupBasicWoodcutting(itemNFT, world, 100 * GUAR_MUL, 20);

      const oneDay = 24 * 3600;
      const oneWeek = oneDay * 7;
      const {timestamp: currentTimestamp} = await ethers.provider.getBlock("latest");
      const timestamp = Math.floor((currentTimestamp - 4 * oneDay) / oneWeek) * oneWeek + (oneWeek + 4 * oneDay); // Start next monday

      await requestAndFulfillRandomWords(world, mockOracleClient);
      await ethers.provider.send("evm_setNextBlockTimestamp", [timestamp]);

      const numDays = Math.floor(timestamp - currentTimestamp) / oneDay;
      for (let i = 0; i < numDays; ++i) {
        await requestAndFulfillRandomWords(world, mockOracleClient);
      }

      // Get the new equipments for the next week
      let mondayEquipment = await world.getSpecificDailyReward(3, playerId, 0);

      // Double check it is different to the other tiers
      let dailyRewardsTier1 = await world.getSpecificDailyReward(1, playerId, 0);
      let dailyRewardsTier2 = await world.getSpecificDailyReward(2, playerId, 0);
      expect(mondayEquipment.itemTokenId).to.not.eq(dailyRewardsTier1);
      expect(mondayEquipment.itemTokenId).to.not.eq(dailyRewardsTier2);

      const tier3Start = 33913;
      await players.testModifyXP(alice.address, playerId, EstforTypes.Skill.WOODCUTTING, tier3Start, false);

      let balanceBefore = await itemNFT.balanceOf(alice.address, mondayEquipment.itemTokenId);
      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStatus.NONE);
      let balanceAfter = await itemNFT.balanceOf(alice.address, mondayEquipment.itemTokenId);
      expect(balanceAfter).to.eq(balanceBefore.toNumber() + mondayEquipment.amount);

      // Start again, shouldn't get any more rewards
      balanceBefore = await itemNFT.balanceOf(alice.address, mondayEquipment.itemTokenId);
      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStatus.NONE);
      balanceAfter = await itemNFT.balanceOf(alice.address, mondayEquipment.itemTokenId);
      expect(balanceAfter).to.eq(balanceBefore);
    });
  });

  it("Guaranteed rewards", async function () {
    // TODO
  });

  describe("Random rewards", function () {
    it("Random rewards (many)", async function () {
      const {playerId, players, itemNFT, world, alice, mockOracleClient} = await loadFixture(playersFixture);

      this.timeout(100000); // 100 seconds, this test can take a while on CI

      await itemNFT.addItems([
        {
          ...EstforTypes.defaultItemInput,
          tokenId: EstforConstants.BRONZE_AXE,
          equipPosition: EstforTypes.EquipPosition.RIGHT_HAND,
        },
        {
          ...EstforTypes.defaultItemInput,
          tokenId: EstforConstants.BRONZE_ARROW,
          equipPosition: EstforTypes.EquipPosition.QUIVER,
        },
      ]);

      const randomChanceFraction = 50.0 / 100; // 50% chance
      const randomChance = Math.floor(65535 * randomChanceFraction);

      let tx = await world.addActions([
        {
          actionId: 1,
          info: {
            skill: EstforTypes.Skill.THIEVING,
            xpPerHour: 3600,
            minXP: 0,
            isDynamic: false,
            worldLocation: 0,
            isFullModeOnly: false,
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
        },
      ]);

      const actionId = await getActionId(tx);
      const numHours = 5;

      // Make sure it passes the next checkpoint so there are no issues running
      const {timestamp} = await ethers.provider.getBlock("latest");
      const nextCheckpoint = Math.floor(timestamp / 86400) * 86400 + 86400;
      const durationToNextCheckpoint = nextCheckpoint - timestamp + 1;
      await ethers.provider.send("evm_increaseTime", [durationToNextCheckpoint]);

      await requestAndFulfillRandomWords(world, mockOracleClient);
      await requestAndFulfillRandomWords(world, mockOracleClient);

      const queuedAction: EstforTypes.QueuedActionInput = {
        attire: EstforTypes.noAttire,
        actionId,
        combatStyle: EstforTypes.CombatStyle.NONE,
        choiceId: EstforConstants.NONE,
        regenerateId: EstforConstants.NONE,
        timespan: 3600 * numHours,
        rightHandEquipmentTokenId: EstforConstants.NONE,
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

        await requestAndFulfillRandomWords(world, mockOracleClient);
        await ethers.provider.send("evm_increaseTime", [24 * 3600]);
        await requestAndFulfillRandomWords(world, mockOracleClient);

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
      await requestAndFulfillRandomWords(world, mockOracleClient);
      await players.connect(alice).processActions(playerId);

      const expectedTotal = numRepeats * randomChanceFraction * numHours;
      expect(numProduced).to.not.eq(expectedTotal); // Very unlikely to be exact, but possible. This checks there is at least some randomness
      expect(numProduced).to.be.gte(expectedTotal * 0.85); // Within 15% below
      expect(numProduced).to.be.lte(expectedTotal * 1.15); // 15% of the time we should get more than 50% of the reward
    });

    it("Multiple random rewards (many)", async function () {
      const {playerId, players, itemNFT, world, alice, mockOracleClient} = await loadFixture(playersFixture);

      this.timeout(100000); // 100 seconds, this test can take a while on CI

      await itemNFT.addItems([
        {
          ...EstforTypes.defaultItemInput,
          tokenId: EstforConstants.BRONZE_AXE,
          equipPosition: EstforTypes.EquipPosition.RIGHT_HAND,
        },
        {
          ...EstforTypes.defaultItemInput,
          tokenId: EstforConstants.BRONZE_ARROW,
          equipPosition: EstforTypes.EquipPosition.QUIVER,
        },
      ]);

      const randomChanceFractions = [80.0 / 100, 50.0 / 100, 50.0 / 100, 20.0 / 100]; // 80%, 50%, 50%, 20%
      const randomChance = Math.floor(65535 * randomChanceFractions[0]);
      const randomChance1 = Math.floor(65535 * randomChanceFractions[1]);
      const randomChance2 = Math.floor(65535 * randomChanceFractions[2]);
      const randomChance3 = Math.floor(65535 * randomChanceFractions[3]);

      let tx = await world.addActions([
        {
          actionId: 1,
          info: {
            skill: EstforTypes.Skill.THIEVING,
            xpPerHour: 3600,
            minXP: 0,
            isDynamic: false,
            worldLocation: 0,
            isFullModeOnly: false,
            numSpawned: 0,
            handItemTokenIdRangeMin: EstforConstants.NONE,
            handItemTokenIdRangeMax: EstforConstants.NONE,
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
        },
      ]);

      const actionId = await getActionId(tx);
      const numHours = 2;

      // Make sure it passes the next checkpoint so there are no issues running
      const {timestamp} = await ethers.provider.getBlock("latest");
      const nextCheckpoint = Math.floor(timestamp / 86400) * 86400 + 86400;
      const durationToNextCheckpoint = nextCheckpoint - timestamp + 1;
      await ethers.provider.send("evm_increaseTime", [durationToNextCheckpoint]);

      await requestAndFulfillRandomWords(world, mockOracleClient);
      await requestAndFulfillRandomWords(world, mockOracleClient);

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
            (await players.players(playerId)).currentActionStartTime +
            actionQueue[0].timespan +
            actionQueue[1].timespan;
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

        await requestAndFulfillRandomWords(world, mockOracleClient);

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
      await requestAndFulfillRandomWords(world, mockOracleClient);
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

    it("No random rewards, check numPastRandomRewardInstancesToRemove is correct", async function () {
      const {playerId, players, itemNFT, world, alice, mockOracleClient} = await loadFixture(playersFixture);

      await itemNFT.addItems([
        {
          ...EstforTypes.defaultItemInput,
          tokenId: EstforConstants.BRONZE_ARROW,
          equipPosition: EstforTypes.EquipPosition.QUIVER,
        },
      ]);

      const randomChanceFraction = 0;
      const randomChance = Math.floor(65535 * randomChanceFraction);

      let tx = await world.addActions([
        {
          actionId: 1,
          info: {
            skill: EstforTypes.Skill.THIEVING,
            xpPerHour: 3600,
            minXP: 0,
            isDynamic: false,
            worldLocation: 0,
            isFullModeOnly: false,
            numSpawned: 0,
            handItemTokenIdRangeMin: NONE,
            handItemTokenIdRangeMax: NONE,
            isAvailable: actionIsAvailable,
            actionChoiceRequired: false,
            successPercent: 100,
          },
          guaranteedRewards: [],
          randomRewards: [{itemTokenId: EstforConstants.BRONZE_ARROW, chance: randomChance, amount: 1}],
          combatStats: EstforTypes.emptyCombatStats,
        },
      ]);

      const actionId = await getActionId(tx);
      const numHours = 4;

      // Make sure it passes the next checkpoint so there are no issues running
      const {timestamp} = await ethers.provider.getBlock("latest");
      const nextCheckpoint = Math.floor(timestamp / 86400) * 86400 + 86400;
      const durationToNextCheckpoint = nextCheckpoint - timestamp + 1;
      await ethers.provider.send("evm_increaseTime", [durationToNextCheckpoint]);

      await requestAndFulfillRandomWords(world, mockOracleClient);
      await requestAndFulfillRandomWords(world, mockOracleClient);

      const queuedAction: EstforTypes.QueuedActionInput = {
        attire: EstforTypes.noAttire,
        actionId,
        combatStyle: EstforTypes.CombatStyle.NONE,
        choiceId: EstforConstants.NONE,
        regenerateId: EstforConstants.NONE,
        timespan: 3600 * numHours,
        rightHandEquipmentTokenId: EstforConstants.NONE,
        leftHandEquipmentTokenId: EstforConstants.NONE,
      };

      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStatus.NONE);
      await ethers.provider.send("evm_increaseTime", [3600 * 1]);
      await ethers.provider.send("evm_mine", []);
      let pendingQueuedActionState = await players.pendingQueuedActionState(alice.address, playerId);
      expect(pendingQueuedActionState.actionMetadatas[0].rolls).to.eq(1); // Should have a roll
      await players.connect(alice).processActions(playerId);
      await ethers.provider.send("evm_increaseTime", [3600 * 2]);
      await ethers.provider.send("evm_mine", []);
      pendingQueuedActionState = await players.pendingQueuedActionState(alice.address, playerId);
      expect(pendingQueuedActionState.actionMetadatas[0].rolls).to.eq(2); // Should have a roll
      await players.connect(alice).processActions(playerId);
      await ethers.provider.send("evm_increaseTime", [3600 * 1]);
      await ethers.provider.send("evm_mine", []);
      pendingQueuedActionState = await players.pendingQueuedActionState(alice.address, playerId);
      expect(pendingQueuedActionState.actionMetadatas[0].rolls).to.eq(1); // Should have a roll
      await players.connect(alice).processActions(playerId);
      await ethers.provider.send("evm_increaseTime", [3600 * 24]);
      await ethers.provider.send("evm_mine", []);
      await requestAndFulfillRandomWords(world, mockOracleClient);
      pendingQueuedActionState = await players.pendingQueuedActionState(alice.address, playerId);
      expect(pendingQueuedActionState.producedPastRandomRewards.length).to.eq(0);
      expect(pendingQueuedActionState.numPastRandomRewardInstancesToRemove).to.eq(3);
    });

    it("Mixing thieving and combat random rolls (thieving, combat, thieving), after 00:00 before oracle is called", async function () {
      // Thieving ends 19:00, Combat ends 20:00, Thieving ends 23:00. Looted at 00:01 before oracle. Dice given for thieving 19:00, dice given for combat 20:00, dice given for thieving 23:00
      const {playerId, players, itemNFT, world, alice, mockOracleClient} = await loadFixture(playersFixture);

      const {queuedAction, numSpawned, combatAction} = await setupBasicMeleeCombat(itemNFT, world);
      const queuedActionCombat = {...queuedAction, timespan: 3600};

      const randomChanceFraction = 1;
      const randomChance = Math.floor(65535 * randomChanceFraction);

      await world.editActions([
        {
          ...combatAction,
          guaranteedRewards: [],
          randomRewards: [{itemTokenId: EstforConstants.POISON, chance: randomChance, amount: 1}],
        },
      ]);

      let tx = await world.addActions([
        {
          actionId: EstforConstants.ACTION_THIEVING_CHILD,
          info: {
            skill: EstforTypes.Skill.THIEVING,
            xpPerHour: 3600,
            minXP: 0,
            isDynamic: false,
            worldLocation: 0,
            isFullModeOnly: false,
            numSpawned: 0,
            handItemTokenIdRangeMin: NONE,
            handItemTokenIdRangeMax: NONE,
            isAvailable: actionIsAvailable,
            actionChoiceRequired: false,
            successPercent: 100,
          },
          guaranteedRewards: [],
          randomRewards: [{itemTokenId: EstforConstants.BRONZE_ARROW, chance: randomChance, amount: 1}],
          combatStats: EstforTypes.emptyCombatStats,
        },
      ]);

      // Make sure it passes the next checkpoint so there are no issues running
      const {timestamp} = await ethers.provider.getBlock("latest");
      const nextCheckpoint = Math.floor(timestamp / 86400) * 86400 + 86400;
      await ethers.provider.send("evm_setNextBlockTimestamp", [nextCheckpoint + 1]);

      await requestAndFulfillRandomWords(world, mockOracleClient);
      await requestAndFulfillRandomWords(world, mockOracleClient);

      const firstThievingNumHours = 19; // start at 19:00

      const queuedActionThieving: EstforTypes.QueuedActionInput = {
        attire: EstforTypes.noAttire,
        actionId: EstforConstants.ACTION_THIEVING_CHILD,
        combatStyle: EstforTypes.CombatStyle.NONE,
        choiceId: EstforConstants.NONE,
        regenerateId: EstforConstants.NONE,
        timespan: 3600 * firstThievingNumHours,
        rightHandEquipmentTokenId: EstforConstants.NONE,
        leftHandEquipmentTokenId: EstforConstants.NONE,
      };

      const secondThievingNumHours = 3;

      const queuedActionThieving2 = {
        ...queuedActionThieving,
        timespan: 3600 * secondThievingNumHours,
      };

      await players
        .connect(alice)
        .startActions(
          playerId,
          [queuedActionThieving, queuedActionCombat, queuedActionThieving2],
          EstforTypes.ActionQueueStatus.NONE
        );
      await ethers.provider.send("evm_increaseTime", [3600 * 24]);
      await ethers.provider.send("evm_mine", []);
      let pendingQueuedActionState = await players.pendingQueuedActionState(alice.address, playerId);

      expect(pendingQueuedActionState.actionMetadatas.length).to.eq(3);
      // Should have rolls for each of these
      expect(pendingQueuedActionState.actionMetadatas[0].rolls).to.eq(19);
      expect(pendingQueuedActionState.actionMetadatas[1].rolls).to.eq(numSpawned / SPAWN_MUL);
      expect(pendingQueuedActionState.actionMetadatas[2].rolls).to.eq(3);
      await players.connect(alice).processActions(playerId);

      await requestAndFulfillRandomWords(world, mockOracleClient);

      pendingQueuedActionState = await players.pendingQueuedActionState(alice.address, playerId);
      expect(pendingQueuedActionState.producedPastRandomRewards.length).to.eq(3);
      expect(pendingQueuedActionState.producedPastRandomRewards[0].itemTokenId).to.eq(EstforConstants.BRONZE_ARROW);
      expect(pendingQueuedActionState.producedPastRandomRewards[0].amount).to.eq(firstThievingNumHours);
      expect(pendingQueuedActionState.producedPastRandomRewards[1].itemTokenId).to.eq(EstforConstants.POISON);
      expect(pendingQueuedActionState.producedPastRandomRewards[1].amount).to.eq(numSpawned / SPAWN_MUL);
      expect(pendingQueuedActionState.producedPastRandomRewards[2].itemTokenId).to.eq(EstforConstants.BRONZE_ARROW);
      expect(pendingQueuedActionState.producedPastRandomRewards[2].amount).to.eq(secondThievingNumHours);

      await players.connect(alice).processActions(playerId);

      expect(
        await itemNFT.balanceOfs(alice.address, [EstforConstants.BRONZE_ARROW, EstforConstants.POISON])
      ).to.deep.eq([firstThievingNumHours + secondThievingNumHours, numSpawned / SPAWN_MUL]);
    });

    it("Mixing thieving and combat random rolls (thieving, combat, thieving), after 00:00 before oracle is called, process after", async function () {
      // Thieving ends 19:00, Combat ends 20:00, Thieving ends 23:00. Looted at 00:01 before oracle. Dice given for thieving 19:00, dice given for combat 00:01, dice given for thieving 23:00
      const {playerId, players, itemNFT, world, alice, mockOracleClient} = await loadFixture(playersFixture);

      const {queuedAction, numSpawned, combatAction} = await setupBasicMeleeCombat(itemNFT, world);
      const queuedActionCombat = {...queuedAction, timespan: 3600};

      const randomChanceFraction = 1;
      const randomChance = Math.floor(65535 * randomChanceFraction);

      await world.editActions([
        {
          ...combatAction,
          guaranteedRewards: [],
          randomRewards: [{itemTokenId: EstforConstants.POISON, chance: randomChance, amount: 1}],
        },
      ]);

      let tx = await world.addActions([
        {
          actionId: EstforConstants.ACTION_THIEVING_CHILD,
          info: {
            skill: EstforTypes.Skill.THIEVING,
            xpPerHour: 3600,
            minXP: 0,
            isDynamic: false,
            worldLocation: 0,
            isFullModeOnly: false,
            numSpawned: 0,
            handItemTokenIdRangeMin: NONE,
            handItemTokenIdRangeMax: NONE,
            isAvailable: actionIsAvailable,
            actionChoiceRequired: false,
            successPercent: 100,
          },
          guaranteedRewards: [],
          randomRewards: [{itemTokenId: EstforConstants.BRONZE_ARROW, chance: randomChance, amount: 1}],
          combatStats: EstforTypes.emptyCombatStats,
        },
      ]);

      // Make sure it passes the next checkpoint so there are no issues running
      const {timestamp} = await ethers.provider.getBlock("latest");
      const nextCheckpoint = Math.floor(timestamp / 86400) * 86400 + 86400;
      await ethers.provider.send("evm_setNextBlockTimestamp", [nextCheckpoint + 1]);

      await requestAndFulfillRandomWords(world, mockOracleClient);
      await requestAndFulfillRandomWords(world, mockOracleClient);

      const firstThievingNumHours = 19; // start at 19:00

      const queuedActionThieving: EstforTypes.QueuedActionInput = {
        attire: EstforTypes.noAttire,
        actionId: EstforConstants.ACTION_THIEVING_CHILD,
        combatStyle: EstforTypes.CombatStyle.NONE,
        choiceId: EstforConstants.NONE,
        regenerateId: EstforConstants.NONE,
        timespan: 3600 * firstThievingNumHours,
        rightHandEquipmentTokenId: EstforConstants.NONE,
        leftHandEquipmentTokenId: EstforConstants.NONE,
      };

      const secondThievingNumHours = 3;

      const queuedActionThieving2 = {
        ...queuedActionThieving,
        timespan: 3600 * secondThievingNumHours,
      };

      await players
        .connect(alice)
        .startActions(
          playerId,
          [queuedActionThieving, queuedActionCombat, queuedActionThieving2],
          EstforTypes.ActionQueueStatus.NONE
        );
      await ethers.provider.send("evm_increaseTime", [3600 * 24]);
      await ethers.provider.send("evm_mine", []);
      let pendingQueuedActionState = await players.pendingQueuedActionState(alice.address, playerId);

      expect(pendingQueuedActionState.actionMetadatas.length).to.eq(3);
      // Should have rolls for each of these
      expect(pendingQueuedActionState.actionMetadatas[0].rolls).to.eq(19);
      expect(pendingQueuedActionState.actionMetadatas[1].rolls).to.eq(numSpawned / SPAWN_MUL);
      expect(pendingQueuedActionState.actionMetadatas[2].rolls).to.eq(3);

      await requestAndFulfillRandomWords(world, mockOracleClient);
      await players.connect(alice).processActions(playerId);

      pendingQueuedActionState = await players.pendingQueuedActionState(alice.address, playerId);
      expect(pendingQueuedActionState.producedPastRandomRewards.length).to.eq(0);

      await ethers.provider.send("evm_increaseTime", [3600 * 24]);
      await requestAndFulfillRandomWords(world, mockOracleClient);

      // Now combat works
      pendingQueuedActionState = await players.pendingQueuedActionState(alice.address, playerId);
      expect(pendingQueuedActionState.producedPastRandomRewards.length).to.eq(1);

      expect(pendingQueuedActionState.producedPastRandomRewards[0].itemTokenId).to.eq(EstforConstants.POISON);
      expect(pendingQueuedActionState.producedPastRandomRewards[0].amount).to.eq(numSpawned / SPAWN_MUL);

      await players.connect(alice).processActions(playerId);

      expect(
        await itemNFT.balanceOfs(alice.address, [EstforConstants.BRONZE_ARROW, EstforConstants.POISON])
      ).to.deep.eq([firstThievingNumHours + secondThievingNumHours, numSpawned / SPAWN_MUL]);
    });

    it("Mixing thieving and combat random rolls (thieving, combat, thieving) after oracle is called", async function () {
      // Thieving ends 19:00, Combat ends 20:00, Thieving ends 22:00. Looted at 00:02 (or whenever) after oracle is called. Loot given for thieving 19:00, dice given for combat 00:02, loot given for thieving 23:00
      const {playerId, players, itemNFT, world, alice, mockOracleClient} = await loadFixture(playersFixture);

      const {queuedAction, numSpawned, combatAction} = await setupBasicMeleeCombat(itemNFT, world);
      const queuedActionCombat = {...queuedAction, timespan: 3600};

      const randomChanceFraction = 1;
      const randomChance = Math.floor(65535 * randomChanceFraction);

      await world.editActions([
        {
          ...combatAction,
          guaranteedRewards: [],
          randomRewards: [{itemTokenId: EstforConstants.POISON, chance: randomChance, amount: 1}],
        },
      ]);

      let tx = await world.addActions([
        {
          actionId: EstforConstants.ACTION_THIEVING_CHILD,
          info: {
            skill: EstforTypes.Skill.THIEVING,
            xpPerHour: 3600,
            minXP: 0,
            isDynamic: false,
            worldLocation: 0,
            isFullModeOnly: false,
            numSpawned: 0,
            handItemTokenIdRangeMin: NONE,
            handItemTokenIdRangeMax: NONE,
            isAvailable: actionIsAvailable,
            actionChoiceRequired: false,
            successPercent: 100,
          },
          guaranteedRewards: [],
          randomRewards: [{itemTokenId: EstforConstants.BRONZE_ARROW, chance: randomChance, amount: 1}],
          combatStats: EstforTypes.emptyCombatStats,
        },
      ]);

      // Make sure it passes the next checkpoint so there are no issues running
      const {timestamp} = await ethers.provider.getBlock("latest");
      const nextCheckpoint = Math.floor(timestamp / 86400) * 86400 + 86400;
      await ethers.provider.send("evm_setNextBlockTimestamp", [nextCheckpoint + 1]);

      await requestAndFulfillRandomWords(world, mockOracleClient);
      await requestAndFulfillRandomWords(world, mockOracleClient);

      const firstThievingNumHours = 19; // start at 19:00

      const queuedActionThieving: EstforTypes.QueuedActionInput = {
        attire: EstforTypes.noAttire,
        actionId: EstforConstants.ACTION_THIEVING_CHILD,
        combatStyle: EstforTypes.CombatStyle.NONE,
        choiceId: EstforConstants.NONE,
        regenerateId: EstforConstants.NONE,
        timespan: 3600 * firstThievingNumHours,
        rightHandEquipmentTokenId: EstforConstants.NONE,
        leftHandEquipmentTokenId: EstforConstants.NONE,
      };

      const secondThievingNumHours = 3;

      const queuedActionThieving2 = {
        ...queuedActionThieving,
        timespan: 3600 * secondThievingNumHours,
      };

      await players
        .connect(alice)
        .startActions(
          playerId,
          [queuedActionThieving, queuedActionCombat, queuedActionThieving2],
          EstforTypes.ActionQueueStatus.NONE
        );
      await ethers.provider.send("evm_increaseTime", [3600 * 24]);

      await requestAndFulfillRandomWords(world, mockOracleClient);

      let pendingQueuedActionState = await players.pendingQueuedActionState(alice.address, playerId);
      expect(pendingQueuedActionState.producedPastRandomRewards.length).to.eq(2);
      expect(pendingQueuedActionState.producedPastRandomRewards[0].itemTokenId).to.eq(EstforConstants.BRONZE_ARROW);
      expect(pendingQueuedActionState.producedPastRandomRewards[0].amount).to.eq(firstThievingNumHours);
      expect(pendingQueuedActionState.producedPastRandomRewards[1].itemTokenId).to.eq(EstforConstants.BRONZE_ARROW);
      expect(pendingQueuedActionState.producedPastRandomRewards[1].amount).to.eq(secondThievingNumHours);

      await players.connect(alice).processActions(playerId);
      // Now combat can be unlocked
      await ethers.provider.send("evm_increaseTime", [3600 * 24]);
      await requestAndFulfillRandomWords(world, mockOracleClient);

      pendingQueuedActionState = await players.pendingQueuedActionState(alice.address, playerId);
      expect(pendingQueuedActionState.producedPastRandomRewards.length).to.eq(1);
      expect(pendingQueuedActionState.producedPastRandomRewards[0].itemTokenId).to.eq(EstforConstants.POISON);
      expect(pendingQueuedActionState.producedPastRandomRewards[0].amount).to.eq(numSpawned / SPAWN_MUL);

      await players.connect(alice).processActions(playerId);

      expect(
        await itemNFT.balanceOfs(alice.address, [EstforConstants.BRONZE_ARROW, EstforConstants.POISON])
      ).to.deep.eq([firstThievingNumHours + secondThievingNumHours, numSpawned / SPAWN_MUL]);
    });

    it("Mixing thieving and combat random rolls (thieving, combat, thieving) looting before 00:00", async function () {
      // Thieving ends 19:00, Combat ends 20:00, Thieving ends 23:00. Looted at 23:59(or whenever). Loot given for thieving 19:00, combat 20:00 & thieving 23:00
      const {playerId, players, itemNFT, world, alice, mockOracleClient} = await loadFixture(playersFixture);

      const {queuedAction, numSpawned, combatAction} = await setupBasicMeleeCombat(itemNFT, world);
      const queuedActionCombat = {...queuedAction, timespan: 3600};

      const randomChanceFraction = 1;
      const randomChance = Math.floor(65535 * randomChanceFraction);

      await world.editActions([
        {
          ...combatAction,
          guaranteedRewards: [],
          randomRewards: [{itemTokenId: EstforConstants.POISON, chance: randomChance, amount: 1}],
        },
      ]);

      let tx = await world.addActions([
        {
          actionId: EstforConstants.ACTION_THIEVING_CHILD,
          info: {
            skill: EstforTypes.Skill.THIEVING,
            xpPerHour: 3600,
            minXP: 0,
            isDynamic: false,
            worldLocation: 0,
            isFullModeOnly: false,
            numSpawned: 0,
            handItemTokenIdRangeMin: NONE,
            handItemTokenIdRangeMax: NONE,
            isAvailable: actionIsAvailable,
            actionChoiceRequired: false,
            successPercent: 100,
          },
          guaranteedRewards: [],
          randomRewards: [{itemTokenId: EstforConstants.BRONZE_ARROW, chance: randomChance, amount: 1}],
          combatStats: EstforTypes.emptyCombatStats,
        },
      ]);

      // Make sure it passes the next checkpoint so there are no issues running
      const {timestamp} = await ethers.provider.getBlock("latest");
      const nextCheckpoint = Math.floor(timestamp / 86400) * 86400 + 86400;
      await ethers.provider.send("evm_setNextBlockTimestamp", [nextCheckpoint + 1]);

      await requestAndFulfillRandomWords(world, mockOracleClient);
      await requestAndFulfillRandomWords(world, mockOracleClient);

      const firstThievingNumHours = 19; // start at 19:00

      const queuedActionThieving: EstforTypes.QueuedActionInput = {
        attire: EstforTypes.noAttire,
        actionId: EstforConstants.ACTION_THIEVING_CHILD,
        combatStyle: EstforTypes.CombatStyle.NONE,
        choiceId: EstforConstants.NONE,
        regenerateId: EstforConstants.NONE,
        timespan: 3600 * firstThievingNumHours,
        rightHandEquipmentTokenId: EstforConstants.NONE,
        leftHandEquipmentTokenId: EstforConstants.NONE,
      };

      const secondThievingNumHours = 3;

      const queuedActionThieving2 = {
        ...queuedActionThieving,
        timespan: 3600 * secondThievingNumHours,
      };

      await players
        .connect(alice)
        .startActions(
          playerId,
          [queuedActionThieving, queuedActionCombat, queuedActionThieving2],
          EstforTypes.ActionQueueStatus.NONE
        );
      await ethers.provider.send("evm_increaseTime", [3600 * 23 + 1]); // Have not passed 00:00 yet
      await ethers.provider.send("evm_mine", []);
      let pendingQueuedActionState = await players.pendingQueuedActionState(alice.address, playerId);
      expect(pendingQueuedActionState.actionMetadatas.length).to.eq(3);
      expect(pendingQueuedActionState.actionMetadatas[0].rolls).to.eq(19);
      expect(pendingQueuedActionState.actionMetadatas[1].rolls).to.eq(numSpawned / SPAWN_MUL);
      expect(pendingQueuedActionState.actionMetadatas[2].rolls).to.eq(3);

      await players.connect(alice).processActions(playerId);

      await expect(world.requestRandomWords()).to.be.revertedWithCustomError(
        world,
        "CanOnlyRequestAfterTheNextCheckpoint"
      );

      pendingQueuedActionState = await players.pendingQueuedActionState(alice.address, playerId);
      expect(pendingQueuedActionState.producedPastRandomRewards.length).to.eq(0);

      await ethers.provider.send("evm_increaseTime", [3600]); // Have now passed 3600
      await ethers.provider.send("evm_mine", []);

      pendingQueuedActionState = await players.pendingQueuedActionState(alice.address, playerId);
      expect(pendingQueuedActionState.producedPastRandomRewards.length).to.eq(0);
      await requestAndFulfillRandomWords(world, mockOracleClient);

      pendingQueuedActionState = await players.pendingQueuedActionState(alice.address, playerId);
      expect(pendingQueuedActionState.producedPastRandomRewards.length).to.eq(3);
      expect(pendingQueuedActionState.producedPastRandomRewards[0].itemTokenId).to.eq(EstforConstants.BRONZE_ARROW);
      expect(pendingQueuedActionState.producedPastRandomRewards[0].amount).to.eq(firstThievingNumHours);
      expect(pendingQueuedActionState.producedPastRandomRewards[1].itemTokenId).to.eq(EstforConstants.POISON);
      expect(pendingQueuedActionState.producedPastRandomRewards[1].amount).to.eq(numSpawned / SPAWN_MUL);
      expect(pendingQueuedActionState.producedPastRandomRewards[2].itemTokenId).to.eq(EstforConstants.BRONZE_ARROW);
      expect(pendingQueuedActionState.producedPastRandomRewards[2].amount).to.eq(secondThievingNumHours);

      await players.connect(alice).processActions(playerId);

      expect(
        await itemNFT.balanceOfs(alice.address, [EstforConstants.BRONZE_ARROW, EstforConstants.POISON])
      ).to.deep.eq([firstThievingNumHours + secondThievingNumHours, numSpawned / SPAWN_MUL]);
    });

    it("Mixing thieving and combat random rolls (combat, combat, thieving) looting after 00:00 but before oracle is called", async function () {
      // Combat ends 19:00, Combat ends 20:00, Thieving ends 23:00. Looted at 00:01 before oracle. Dice given for combat 19:00, dice given for combat 20:00, dice given for thieving 23:00
      const {playerId, players, itemNFT, world, alice, mockOracleClient} = await loadFixture(playersFixture);

      const {queuedAction, numSpawned, combatAction} = await setupBasicMeleeCombat(itemNFT, world);

      const randomChanceFraction = 1;
      const randomChance = Math.floor(65535 * randomChanceFraction);

      await world.editActions([
        {
          ...combatAction,
          guaranteedRewards: [],
          randomRewards: [{itemTokenId: EstforConstants.POISON, chance: randomChance, amount: 1}],
        },
      ]);

      let tx = await world.addActions([
        {
          actionId: EstforConstants.ACTION_THIEVING_CHILD,
          info: {
            skill: EstforTypes.Skill.THIEVING,
            xpPerHour: 3600,
            minXP: 0,
            isDynamic: false,
            worldLocation: 0,
            isFullModeOnly: false,
            numSpawned: 0,
            handItemTokenIdRangeMin: NONE,
            handItemTokenIdRangeMax: NONE,
            isAvailable: actionIsAvailable,
            actionChoiceRequired: false,
            successPercent: 100,
          },
          guaranteedRewards: [],
          randomRewards: [{itemTokenId: EstforConstants.BRONZE_ARROW, chance: randomChance, amount: 1}],
          combatStats: EstforTypes.emptyCombatStats,
        },
      ]);

      // Make sure it passes the next checkpoint so there are no issues running
      const {timestamp} = await ethers.provider.getBlock("latest");
      const nextCheckpoint = Math.floor(timestamp / 86400) * 86400 + 86400;
      await ethers.provider.send("evm_setNextBlockTimestamp", [nextCheckpoint + 1]);

      await requestAndFulfillRandomWords(world, mockOracleClient);
      await requestAndFulfillRandomWords(world, mockOracleClient);

      const firstCombatNumHours = 19; // start at 19:00
      const queuedActionCombat = {...queuedAction, timespan: 3600 * firstCombatNumHours};

      const secondCombatNumHours = 1;
      const queuedActionCombat2 = {
        ...queuedActionCombat,
        timespan: 3600 * secondCombatNumHours,
      };

      const thievingNumHours = 3;
      const queuedActionThieving: EstforTypes.QueuedActionInput = {
        attire: EstforTypes.noAttire,
        actionId: EstforConstants.ACTION_THIEVING_CHILD,
        combatStyle: EstforTypes.CombatStyle.NONE,
        choiceId: EstforConstants.NONE,
        regenerateId: EstforConstants.NONE,
        timespan: 3600 * thievingNumHours,
        rightHandEquipmentTokenId: EstforConstants.NONE,
        leftHandEquipmentTokenId: EstforConstants.NONE,
      };

      await players
        .connect(alice)
        .startActions(
          playerId,
          [queuedActionCombat, queuedActionCombat2, queuedActionThieving],
          EstforTypes.ActionQueueStatus.NONE
        );
      await ethers.provider.send("evm_increaseTime", [3600 * 24]);
      await ethers.provider.send("evm_mine", []);
      let pendingQueuedActionState = await players.pendingQueuedActionState(alice.address, playerId);

      expect(pendingQueuedActionState.actionMetadatas.length).to.eq(3);
      // Should have rolls for each of these
      expect(pendingQueuedActionState.actionMetadatas[0].rolls).to.eq((firstCombatNumHours * numSpawned) / SPAWN_MUL);
      expect(pendingQueuedActionState.actionMetadatas[1].rolls).to.eq((secondCombatNumHours * numSpawned) / SPAWN_MUL);
      expect(pendingQueuedActionState.actionMetadatas[2].rolls).to.eq(thievingNumHours);
      await players.connect(alice).processActions(playerId);

      await requestAndFulfillRandomWords(world, mockOracleClient);

      pendingQueuedActionState = await players.pendingQueuedActionState(alice.address, playerId);
      expect(pendingQueuedActionState.producedPastRandomRewards.length).to.eq(3);
      expect(pendingQueuedActionState.producedPastRandomRewards[0].itemTokenId).to.eq(EstforConstants.POISON);
      expect(pendingQueuedActionState.producedPastRandomRewards[0].amount).to.eq(
        (firstCombatNumHours * numSpawned) / SPAWN_MUL
      );
      expect(pendingQueuedActionState.producedPastRandomRewards[1].itemTokenId).to.eq(EstforConstants.POISON);
      expect(pendingQueuedActionState.producedPastRandomRewards[1].amount).to.eq(
        (secondCombatNumHours * numSpawned) / SPAWN_MUL
      );
      expect(pendingQueuedActionState.producedPastRandomRewards[2].itemTokenId).to.eq(EstforConstants.BRONZE_ARROW);
      expect(pendingQueuedActionState.producedPastRandomRewards[2].amount).to.eq(thievingNumHours);

      await players.connect(alice).processActions(playerId);

      expect(
        await itemNFT.balanceOfs(alice.address, [EstforConstants.BRONZE_ARROW, EstforConstants.POISON])
      ).to.deep.eq([thievingNumHours, ((firstCombatNumHours + secondCombatNumHours) * numSpawned) / SPAWN_MUL]);
    });

    it("Mixing combat/thieving over 48 hours, when queueing combat & thieving, then thieving in another 24 hours after first calling oracle.", async function () {
      // Combat starts 00:01 and ends 01:01, thieving ends 00:01 the following day. Looted at 00:02 after oracle by starting a new 24 hour thieving action
      const {playerId, players, itemNFT, world, alice, mockOracleClient} = await loadFixture(playersFixture);

      const {queuedAction, numSpawned, combatAction} = await setupBasicMeleeCombat(itemNFT, world);

      const randomChanceFraction = 1;
      const randomChance = Math.floor(65535 * randomChanceFraction);

      await world.editActions([
        {
          ...combatAction,
          guaranteedRewards: [],
          randomRewards: [{itemTokenId: EstforConstants.POISON, chance: randomChance, amount: 1}],
        },
      ]);

      let tx = await world.addActions([
        {
          actionId: EstforConstants.ACTION_THIEVING_CHILD,
          info: {
            skill: EstforTypes.Skill.THIEVING,
            xpPerHour: 3600,
            minXP: 0,
            isDynamic: false,
            worldLocation: 0,
            isFullModeOnly: false,
            numSpawned: 0,
            handItemTokenIdRangeMin: NONE,
            handItemTokenIdRangeMax: NONE,
            isAvailable: actionIsAvailable,
            actionChoiceRequired: false,
            successPercent: 100,
          },
          guaranteedRewards: [],
          randomRewards: [{itemTokenId: EstforConstants.BRONZE_ARROW, chance: randomChance, amount: 1}],
          combatStats: EstforTypes.emptyCombatStats,
        },
      ]);

      // Make sure it passes the next checkpoint so there are no issues running
      const {timestamp} = await ethers.provider.getBlock("latest");
      const nextCheckpoint = Math.floor(timestamp / 86400) * 86400 + 86400;
      await ethers.provider.send("evm_setNextBlockTimestamp", [nextCheckpoint + 1]);

      await requestAndFulfillRandomWords(world, mockOracleClient);
      await requestAndFulfillRandomWords(world, mockOracleClient);

      const combatNumHours = 1; // start at 00:01
      const queuedActionCombat = {...queuedAction, timespan: 3600 * combatNumHours};

      const thievingNumHours = 23; // ends at 00:01 the following day
      const queuedActionThieving: EstforTypes.QueuedActionInput = {
        attire: EstforTypes.noAttire,
        actionId: EstforConstants.ACTION_THIEVING_CHILD,
        combatStyle: EstforTypes.CombatStyle.NONE,
        choiceId: EstforConstants.NONE,
        regenerateId: EstforConstants.NONE,
        timespan: 3600 * thievingNumHours,
        rightHandEquipmentTokenId: EstforConstants.NONE,
        leftHandEquipmentTokenId: EstforConstants.NONE,
      };

      const secondThievingNumHours = 24; // ends at 00:001 the day after
      const queuedActionThieving2 = {
        ...queuedActionThieving,
        timespan: 3600 * secondThievingNumHours,
      };

      await players
        .connect(alice)
        .startActions(playerId, [queuedActionCombat, queuedActionThieving], EstforTypes.ActionQueueStatus.NONE);
      await ethers.provider.send("evm_increaseTime", [3600 * 24]); // Go another hour past the 24
      await ethers.provider.send("evm_mine", []);

      let pendingQueuedActionState = await players.pendingQueuedActionState(alice.address, playerId);
      expect(pendingQueuedActionState.actionMetadatas.length).to.eq(2);
      expect(pendingQueuedActionState.actionMetadatas[0].rolls).to.eq((combatNumHours * numSpawned) / SPAWN_MUL);
      expect(pendingQueuedActionState.actionMetadatas[1].rolls).to.eq(thievingNumHours);

      await players.connect(alice).startActions(playerId, [queuedActionThieving2], EstforTypes.ActionQueueStatus.NONE);
      await ethers.provider.send("evm_increaseTime", [3600 * 48]); // Go another hour past the 24
      await ethers.provider.send("evm_mine", []);

      pendingQueuedActionState = await players.pendingQueuedActionState(alice.address, playerId);
      expect(pendingQueuedActionState.actionMetadatas.length).to.eq(1);
      expect(pendingQueuedActionState.actionMetadatas[0].rolls).to.eq(secondThievingNumHours);

      await requestAndFulfillRandomWords(world, mockOracleClient);
      await requestAndFulfillRandomWords(world, mockOracleClient);
      await requestAndFulfillRandomWords(world, mockOracleClient);

      pendingQueuedActionState = await players.pendingQueuedActionState(alice.address, playerId);
      expect(pendingQueuedActionState.producedPastRandomRewards.length).to.eq(3);
      expect(pendingQueuedActionState.producedPastRandomRewards[0].amount).to.eq(
        (combatNumHours * numSpawned) / SPAWN_MUL
      );
      expect(pendingQueuedActionState.producedPastRandomRewards[1].amount).to.eq(thievingNumHours);
      expect(pendingQueuedActionState.producedPastRandomRewards[2].amount).to.eq(secondThievingNumHours);

      await players.connect(alice).processActions(playerId);

      expect(
        await itemNFT.balanceOfs(alice.address, [EstforConstants.BRONZE_ARROW, EstforConstants.POISON])
      ).to.deep.eq([thievingNumHours + secondThievingNumHours, (combatNumHours * numSpawned) / SPAWN_MUL]);
    });

    it("Mixing thieving and combat random rolls (combat, thieving) looting after 00:00, before oracle is called", async function () {
      // Combat ends 19:00, Thieving ends 22:00. Looted at 00:01 before oracle. Dice given for combat 19:00, dice given for thieving 22:00
      const {playerId, players, itemNFT, world, alice, mockOracleClient} = await loadFixture(playersFixture);

      const {queuedAction, numSpawned, combatAction} = await setupBasicMeleeCombat(itemNFT, world);

      const randomChanceFraction = 1;
      const randomChance = Math.floor(65535 * randomChanceFraction);

      await world.editActions([
        {
          ...combatAction,
          guaranteedRewards: [],
          randomRewards: [{itemTokenId: EstforConstants.POISON, chance: randomChance, amount: 1}],
        },
      ]);

      let tx = await world.addActions([
        {
          actionId: EstforConstants.ACTION_THIEVING_CHILD,
          info: {
            skill: EstforTypes.Skill.THIEVING,
            xpPerHour: 3600,
            minXP: 0,
            isDynamic: false,
            worldLocation: 0,
            isFullModeOnly: false,
            numSpawned: 0,
            handItemTokenIdRangeMin: NONE,
            handItemTokenIdRangeMax: NONE,
            isAvailable: actionIsAvailable,
            actionChoiceRequired: false,
            successPercent: 100,
          },
          guaranteedRewards: [],
          randomRewards: [{itemTokenId: EstforConstants.BRONZE_ARROW, chance: randomChance, amount: 1}],
          combatStats: EstforTypes.emptyCombatStats,
        },
      ]);

      // Make sure it passes the next checkpoint so there are no issues running
      const {timestamp} = await ethers.provider.getBlock("latest");
      const nextCheckpoint = Math.floor(timestamp / 86400) * 86400 + 86400;
      await ethers.provider.send("evm_setNextBlockTimestamp", [nextCheckpoint + 1]);

      await requestAndFulfillRandomWords(world, mockOracleClient);
      await requestAndFulfillRandomWords(world, mockOracleClient);

      const combatNumHours = 19; // start at 19:00
      const queuedActionCombat = {...queuedAction, timespan: 3600 * combatNumHours};

      const thievingNumHours = 3;
      const queuedActionThieving: EstforTypes.QueuedActionInput = {
        attire: EstforTypes.noAttire,
        actionId: EstforConstants.ACTION_THIEVING_CHILD,
        combatStyle: EstforTypes.CombatStyle.NONE,
        choiceId: EstforConstants.NONE,
        regenerateId: EstforConstants.NONE,
        timespan: 3600 * thievingNumHours,
        rightHandEquipmentTokenId: EstforConstants.NONE,
        leftHandEquipmentTokenId: EstforConstants.NONE,
      };

      await players
        .connect(alice)
        .startActions(playerId, [queuedActionCombat, queuedActionThieving], EstforTypes.ActionQueueStatus.NONE);
      await ethers.provider.send("evm_increaseTime", [3600 * 24]);
      await ethers.provider.send("evm_mine", []);
      let pendingQueuedActionState = await players.pendingQueuedActionState(alice.address, playerId);

      expect(pendingQueuedActionState.actionMetadatas.length).to.eq(2);
      // Should have rolls for each of these
      expect(pendingQueuedActionState.actionMetadatas[0].rolls).to.eq((combatNumHours * numSpawned) / SPAWN_MUL);
      expect(pendingQueuedActionState.actionMetadatas[1].rolls).to.eq(thievingNumHours);
      await players.connect(alice).processActions(playerId);

      await requestAndFulfillRandomWords(world, mockOracleClient);

      pendingQueuedActionState = await players.pendingQueuedActionState(alice.address, playerId);
      expect(pendingQueuedActionState.producedPastRandomRewards.length).to.eq(2);
      expect(pendingQueuedActionState.producedPastRandomRewards[0].itemTokenId).to.eq(EstforConstants.POISON);
      expect(pendingQueuedActionState.producedPastRandomRewards[0].amount).to.eq(
        (combatNumHours * numSpawned) / SPAWN_MUL
      );
      expect(pendingQueuedActionState.producedPastRandomRewards[1].itemTokenId).to.eq(EstforConstants.BRONZE_ARROW);
      expect(pendingQueuedActionState.producedPastRandomRewards[1].amount).to.eq(thievingNumHours);

      await players.connect(alice).processActions(playerId);

      expect(
        await itemNFT.balanceOfs(alice.address, [EstforConstants.BRONZE_ARROW, EstforConstants.POISON])
      ).to.deep.eq([thievingNumHours, (combatNumHours * numSpawned) / SPAWN_MUL]);
    });

    it("Multiple random rewards", async function () {
      const {playerId, players, itemNFT, world, alice, mockOracleClient} = await loadFixture(playersFixture);

      this.timeout(100000); // 100 seconds, this test can take a while on CI

      await itemNFT.addItems([
        {
          ...EstforTypes.defaultItemInput,
          tokenId: EstforConstants.BRONZE_AXE,
          equipPosition: EstforTypes.EquipPosition.RIGHT_HAND,
        },
        {
          ...EstforTypes.defaultItemInput,
          tokenId: EstforConstants.BRONZE_ARROW,
          equipPosition: EstforTypes.EquipPosition.QUIVER,
        },
      ]);

      const randomChanceFractions = [99.9 / 100, 10.0 / 100]; // 99.9%, 10%
      const randomChance = Math.floor(65535 * randomChanceFractions[0]);
      const randomChance1 = Math.floor(65535 * randomChanceFractions[1]);

      let tx = await world.addActions([
        {
          actionId: 1,
          info: {
            skill: EstforTypes.Skill.THIEVING,
            xpPerHour: 3600,
            minXP: 0,
            isDynamic: false,
            worldLocation: 0,
            isFullModeOnly: false,
            numSpawned: 0,
            handItemTokenIdRangeMin: NONE,
            handItemTokenIdRangeMax: NONE,
            isAvailable: actionIsAvailable,
            actionChoiceRequired: false,
            successPercent: 100,
          },
          guaranteedRewards: [],
          randomRewards: [
            {itemTokenId: EstforConstants.BRONZE_BAR, chance: randomChance, amount: 1},
            {itemTokenId: EstforConstants.BRONZE_ARROW, chance: randomChance1, amount: 1},
          ],
          combatStats: EstforTypes.emptyCombatStats,
        },
      ]);

      const actionId = await getActionId(tx);
      const numHours = 23;

      // Make sure it passes the next checkpoint so there are no issues running
      const {timestamp} = await ethers.provider.getBlock("latest");
      const nextCheckpoint = Math.floor(timestamp / 86400) * 86400 + 86400;
      const durationToNextCheckpoint = nextCheckpoint - timestamp + 1;
      await ethers.provider.send("evm_increaseTime", [durationToNextCheckpoint]);

      await requestAndFulfillRandomWords(world, mockOracleClient);
      await requestAndFulfillRandomWords(world, mockOracleClient);

      const queuedAction: EstforTypes.QueuedActionInput = {
        attire: EstforTypes.noAttire,
        actionId,
        combatStyle: EstforTypes.CombatStyle.NONE,
        choiceId: EstforConstants.NONE,
        regenerateId: EstforConstants.NONE,
        timespan: 3600 * numHours,
        rightHandEquipmentTokenId: EstforConstants.NONE,
        leftHandEquipmentTokenId: EstforConstants.NONE,
      };

      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStatus.NONE);
      await ethers.provider.send("evm_increaseTime", [3600 * 24]);
      await ethers.provider.send("evm_mine", []);
      await requestAndFulfillRandomWords(world, mockOracleClient);
      const pendingQueuedActionState = await players.pendingQueuedActionState(alice.address, playerId);
      expect(pendingQueuedActionState.producedPastRandomRewards.length).to.eq(2);
    });

    it("PendingRandomRewards should be added each time an action is processed", async function () {
      const {playerId, players, world, alice, mockOracleClient} = await loadFixture(playersFixture);

      const randomChance = 65535; // 100%
      let tx = await world.addActions([
        {
          actionId: 1,
          info: {
            skill: EstforTypes.Skill.THIEVING,
            xpPerHour: 3600,
            minXP: 0,
            isDynamic: false,
            worldLocation: 0,
            isFullModeOnly: false,
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
        },
      ]);
      const actionId = await getActionId(tx);
      const numHours = 5;

      // Set it 2 hours before the next checkpoint so that we can cross the boundary
      const {timestamp} = await ethers.provider.getBlock("latest");
      const nextCheckpoint = Math.floor(timestamp / 86400) * 86400 + 86400;
      const durationToNextCheckpoint = nextCheckpoint - timestamp - (2 * 3600 - 2);
      await ethers.provider.send("evm_increaseTime", [durationToNextCheckpoint]);

      await requestAndFulfillRandomWords(world, mockOracleClient);
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

    it("Check random bytes", async function () {
      const {playerId, world, mockOracleClient} = await loadFixture(playersFixture);
      const {timestamp} = await ethers.provider.getBlock("latest");
      let numTickets = 16; // 240
      await expect(world.getRandomBytes(numTickets, timestamp - 86400, playerId)).to.be.reverted;
      await requestAndFulfillRandomWords(world, mockOracleClient);
      let randomBytes = await world.getRandomBytes(numTickets, timestamp - 86400, playerId);
      expect(ethers.utils.hexDataLength(randomBytes)).to.be.eq(32);
      numTickets = MAX_UNIQUE_TICKETS;

      randomBytes = await world.getRandomBytes(numTickets, timestamp - 86400, playerId);
      expect(ethers.utils.hexDataLength(randomBytes)).to.be.eq(32 * 4);

      numTickets = MAX_UNIQUE_TICKETS + 1;
      await expect(world.getRandomBytes(numTickets, timestamp - 86400, playerId)).to.be.reverted;
    });

    it("Check past random rewards which are claimed the following day don't cause issues (many)", async function () {
      const {playerId, players, world, alice, mockOracleClient} = await loadFixture(playersFixture);

      const randomChance = 32000; // 50%
      let tx = await world.addActions([
        {
          actionId: ACTION_THIEVING_CHILD,
          info: {
            skill: EstforTypes.Skill.THIEVING,
            xpPerHour: 3600,
            minXP: 0,
            isDynamic: false,
            worldLocation: 0,
            isFullModeOnly: false,
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
        },
      ]);
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

      await requestAndFulfillRandomWords(world, mockOracleClient);

      // Try many times as we are relying on random chance
      for (let i = 0; i < 20; ++i) {
        // Start the following day to keep things organised
        const {timestamp} = await ethers.provider.getBlock("latest");
        const nextCheckpoint = Math.floor(timestamp / 86400) * 86400 + 86400 * 2;
        const durationToNextCheckpoint = nextCheckpoint - timestamp - (3 * 3600 + 10 + Math.floor(Math.random() * 10)); // 3 hours before the next checkpoint
        await ethers.provider.send("evm_increaseTime", [durationToNextCheckpoint]);
        await requestAndFulfillRandomWords(world, mockOracleClient);
        await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStatus.NONE);
        await ethers.provider.send("evm_increaseTime", [7200 + 4]);
        await players.connect(alice).processActions(playerId); // Continues the action
        await ethers.provider.send("evm_increaseTime", [12 * 3600]); // Go to tomorrow
        await requestAndFulfillRandomWords(world, mockOracleClient);
        await players.connect(alice).processActions(playerId); // Continues the action
      }
    });

    it("Ticket excess uses a mint multiplier", async function () {
      const {playerId, players, itemNFT, world, alice, mockOracleClient} = await loadFixture(playersFixture);

      const monsterCombatStats: EstforTypes.CombatStats = {
        melee: 1,
        magic: 0,
        ranged: 0,
        meleeDefence: 0,
        magicDefence: 0,
        rangedDefence: 0,
        health: 1,
      };

      const randomChance = 65535; // 100%
      const numSpawned = 100 * SPAWN_MUL;
      let tx = await world.addActions([
        {
          actionId: 1,
          info: {
            skill: EstforTypes.Skill.COMBAT,
            xpPerHour: 3600,
            minXP: 0,
            isDynamic: false,
            worldLocation: 0,
            isFullModeOnly: false,
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
        },
      ]);
      const actionId = await getActionId(tx);

      tx = await world.addBulkActionChoices(
        [EstforConstants.NONE],
        [[1]],
        [
          [
            {
              ...defaultActionChoice,
              skill: EstforTypes.Skill.MELEE,
            },
          ],
        ]
      );
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

      await requestAndFulfillRandomWords(world, mockOracleClient);
      await requestAndFulfillRandomWords(world, mockOracleClient);

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

      await itemNFT.addItems([
        {
          ...EstforTypes.defaultItemInput,
          combatStats: {
            ...EstforTypes.emptyCombatStats,
            melee: 50,
          },
          tokenId: EstforConstants.BRONZE_SWORD,
          equipPosition: EstforTypes.EquipPosition.RIGHT_HAND,
        },
        {
          ...EstforTypes.defaultItemInput,
          combatStats: bronzeHelmetStats,
          tokenId: EstforConstants.BRONZE_HELMET,
          equipPosition: EstforTypes.EquipPosition.HEAD,
        },
        {
          ...EstforTypes.defaultItemInput,
          tokenId: EstforConstants.BRONZE_ARROW,
          equipPosition: EstforTypes.EquipPosition.QUIVER,
        },
        {
          ...EstforTypes.defaultItemInput,
          healthRestored: 12,
          tokenId: EstforConstants.COOKED_MINNUS,
          equipPosition: EstforTypes.EquipPosition.FOOD,
        },
      ]);

      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStatus.NONE);

      await ethers.provider.send("evm_increaseTime", [3600 * 24]);
      await ethers.provider.send("evm_mine", []);

      let pendingQueuedActionState = await players.pendingQueuedActionState(alice.address, playerId);
      expect(pendingQueuedActionState.equipmentStates[0].producedItemTokenIds.length).to.eq(0);

      await requestAndFulfillRandomWords(world, mockOracleClient);

      pendingQueuedActionState = await players.pendingQueuedActionState(alice.address, playerId);
      expect(pendingQueuedActionState.equipmentStates[0].producedItemTokenIds.length).to.eq(0);
      expect(pendingQueuedActionState.producedPastRandomRewards.length).to.eq(0);
      expect(pendingQueuedActionState.actionMetadatas[0].rolls).to.be.gt(0);

      // Increment again but it should still not produce anything
      await ethers.provider.send("evm_increaseTime", [3600 * 24]);
      await ethers.provider.send("evm_mine", []);

      await requestAndFulfillRandomWords(world, mockOracleClient);

      pendingQueuedActionState = await players.pendingQueuedActionState(alice.address, playerId);
      expect(pendingQueuedActionState.equipmentStates[0].producedItemTokenIds.length).to.eq(0);
      expect(pendingQueuedActionState.producedPastRandomRewards.length).to.eq(0);
      expect(pendingQueuedActionState.actionMetadatas[0].rolls).to.be.gt(0);

      expect(await itemNFT.balanceOf(alice.address, BRONZE_ARROW)).to.eq(0);

      await players.connect(alice).processActions(playerId);

      pendingQueuedActionState = await players.pendingQueuedActionState(alice.address, playerId);
      expect(pendingQueuedActionState.equipmentStates.length).to.eq(0);
      expect(pendingQueuedActionState.producedPastRandomRewards.length).to.eq(0);

      // Increment again but it should still not produce anything
      await ethers.provider.send("evm_increaseTime", [3600 * 24]);
      await ethers.provider.send("evm_mine", []);
      pendingQueuedActionState = await players.pendingQueuedActionState(alice.address, playerId);
      expect(pendingQueuedActionState.equipmentStates.length).to.eq(0);
      expect(pendingQueuedActionState.producedPastRandomRewards.length).to.eq(0);

      await requestAndFulfillRandomWords(world, mockOracleClient);

      pendingQueuedActionState = await players.pendingQueuedActionState(alice.address, playerId);
      expect(pendingQueuedActionState.producedPastRandomRewards.length).to.eq(1);
      expect(pendingQueuedActionState.producedPastRandomRewards[0].itemTokenId).to.eq(BRONZE_ARROW);
      expect(pendingQueuedActionState.producedPastRandomRewards[0].amount).to.eq(numHours * (numSpawned / SPAWN_MUL));

      await players.connect(alice).processActions(playerId);

      // Check output
      expect(await itemNFT.balanceOf(alice.address, BRONZE_ARROW)).to.eq(numHours * (numSpawned / SPAWN_MUL));
    });

    it("Ticket excess with rare items uses higher chance reward system", async function () {
      const {playerId, players, itemNFT, world, alice, mockOracleClient} = await loadFixture(playersFixture);

      const monsterCombatStats: EstforTypes.CombatStats = {
        melee: 1,
        magic: 0,
        ranged: 0,
        meleeDefence: 0,
        magicDefence: 0,
        rangedDefence: 0,
        health: 1,
      };

      const randomRewardChanceMultiplier = (await players.RANDOM_REWARD_CHANCE_MULTIPLIER_CUTOFF()).toNumber();
      const randomChance = 999;
      expect(randomRewardChanceMultiplier).to.be.gt(randomChance);
      const numSpawned = 150 * SPAWN_MUL;

      const numHours = 23;
      // 64 unique tickets 150 * 23 = 3450 / 64 = 53.9. Should give 53.9 * 999 = 53846.1 / 65355 chance of each roll hitting
      const fractionChancePerRoll =
        ((((numSpawned / SPAWN_MUL) * numHours) / MAX_UNIQUE_TICKETS) * randomChance) / 65355;

      let tx = await world.addActions([
        {
          actionId: 1,
          info: {
            skill: EstforTypes.Skill.COMBAT,
            xpPerHour: 3600,
            minXP: 0,
            isDynamic: false,
            worldLocation: 0,
            isFullModeOnly: false,
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
        },
      ]);
      const actionId = await getActionId(tx);

      tx = await world.addBulkActionChoices(
        [EstforConstants.NONE],
        [[1]],
        [
          [
            {
              ...defaultActionChoice,
              skill: EstforTypes.Skill.MELEE,
            },
          ],
        ]
      );
      const choiceId = await getActionChoiceId(tx);
      await itemNFT.testMints(
        alice.address,
        [EstforConstants.BRONZE_SWORD, EstforConstants.BRONZE_HELMET, EstforConstants.COOKED_MINNUS],
        [1, 1, 255]
      );

      // Make sure it passes the next checkpoint so there are no issues running
      const {timestamp} = await ethers.provider.getBlock("latest");
      const nextCheckpoint = Math.floor(timestamp / 86400) * 86400 + 86400;
      const durationToNextCheckpoint = nextCheckpoint - timestamp + 1;
      await ethers.provider.send("evm_increaseTime", [durationToNextCheckpoint]);

      await requestAndFulfillRandomWords(world, mockOracleClient);
      await requestAndFulfillRandomWords(world, mockOracleClient);

      const timespan = 3600 * numHours;

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

      await itemNFT.addItems([
        {
          ...EstforTypes.defaultItemInput,
          combatStats: {
            ...EstforTypes.emptyCombatStats,
            melee: 50,
          },
          tokenId: EstforConstants.BRONZE_SWORD,
          equipPosition: EstforTypes.EquipPosition.RIGHT_HAND,
        },
        {
          ...EstforTypes.defaultItemInput,
          combatStats: bronzeHelmetStats,
          tokenId: EstforConstants.BRONZE_HELMET,
          equipPosition: EstforTypes.EquipPosition.HEAD,
        },
        {
          ...EstforTypes.defaultItemInput,
          tokenId: EstforConstants.BRONZE_ARROW,
          equipPosition: EstforTypes.EquipPosition.QUIVER,
        },
        {
          ...EstforTypes.defaultItemInput,
          healthRestored: 12,
          tokenId: EstforConstants.COOKED_MINNUS,
          equipPosition: EstforTypes.EquipPosition.FOOD,
        },
      ]);

      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStatus.NONE);

      await ethers.provider.send("evm_increaseTime", [3600 * 24]);
      await ethers.provider.send("evm_mine", []);

      let pendingQueuedActionState = await players.pendingQueuedActionState(alice.address, playerId);
      expect(pendingQueuedActionState.equipmentStates[0].producedItemTokenIds.length).to.eq(0);

      await requestAndFulfillRandomWords(world, mockOracleClient);

      pendingQueuedActionState = await players.pendingQueuedActionState(alice.address, playerId);
      expect(pendingQueuedActionState.equipmentStates[0].producedItemTokenIds.length).to.eq(0);
      expect(pendingQueuedActionState.producedPastRandomRewards.length).to.be.eq(0);

      await players.connect(alice).processActions(playerId);

      await ethers.provider.send("evm_increaseTime", [3600 * 24]);
      await requestAndFulfillRandomWords(world, mockOracleClient);

      pendingQueuedActionState = await players.pendingQueuedActionState(alice.address, playerId);
      expect(pendingQueuedActionState.producedPastRandomRewards.length).to.eq(1);
      expect(pendingQueuedActionState.producedPastRandomRewards[0].itemTokenId).to.eq(BRONZE_ARROW);

      await players.connect(alice).processActions(playerId);

      // Check output
      expect(fractionChancePerRoll).to.be.gt(0.82);
      expect(fractionChancePerRoll).to.be.lt(0.9);
      expect(await itemNFT.balanceOf(alice.address, BRONZE_ARROW)).to.be.gte(
        Math.floor(MAX_UNIQUE_TICKETS * fractionChancePerRoll * 0.82)
      ); // 18% below
      expect(await itemNFT.balanceOf(alice.address, BRONZE_ARROW)).to.be.lte(
        Math.floor(MAX_UNIQUE_TICKETS * fractionChancePerRoll * 1.18)
      ); // 18% above
    });

    // Might fail as relies on random chance
    it("Ticket excess with rare items uses higher chance reward system, uses low chance, hit once", async function () {
      const {playerId, players, itemNFT, world, alice, mockOracleClient} = await loadFixture(playersFixture);

      const monsterCombatStats: EstforTypes.CombatStats = {
        melee: 1,
        magic: 0,
        ranged: 0,
        meleeDefence: 0,
        magicDefence: 0,
        rangedDefence: 0,
        health: 1,
      };

      const randomChance = 5; // Very low chance
      const numSpawned = 3600 * SPAWN_MUL;

      const numHours = 23;
      // 240 unique tickets 3600 * 23 = 82800 / 240 = 345. Should give 2.5% ((345 * 5) / 65355) chance of each roll hitting and there are 240 rolls.

      let tx = await world.addActions([
        {
          actionId: 1,
          info: {
            skill: EstforTypes.Skill.COMBAT,
            xpPerHour: 3600,
            minXP: 0,
            isDynamic: false,
            worldLocation: 0,
            isFullModeOnly: false,
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
        },
      ]);
      const actionId = await getActionId(tx);

      tx = await world.addBulkActionChoices(
        [EstforConstants.NONE],
        [[1]],
        [
          [
            {
              ...defaultActionChoice,
              skill: EstforTypes.Skill.MELEE,
            },
          ],
        ]
      );
      const choiceId = await getActionChoiceId(tx);
      await itemNFT.testMints(
        alice.address,
        [EstforConstants.BRONZE_SWORD, EstforConstants.BRONZE_HELMET, EstforConstants.COOKED_MINNUS],
        [1, 1, 255]
      );

      // Make sure it passes the next checkpoint so there are no issues running
      const {timestamp} = await ethers.provider.getBlock("latest");
      const nextCheckpoint = Math.floor(timestamp / 86400) * 86400 + 86400;
      const durationToNextCheckpoint = nextCheckpoint - timestamp + 1;
      await ethers.provider.send("evm_increaseTime", [durationToNextCheckpoint]);

      await requestAndFulfillRandomWords(world, mockOracleClient);
      await requestAndFulfillRandomWords(world, mockOracleClient);

      const timespan = 3600 * numHours;

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

      await itemNFT.addItems([
        {
          ...EstforTypes.defaultItemInput,
          combatStats: {
            ...EstforTypes.emptyCombatStats,
            melee: 50,
          },
          tokenId: EstforConstants.BRONZE_SWORD,
          equipPosition: EstforTypes.EquipPosition.RIGHT_HAND,
        },
        {
          ...EstforTypes.defaultItemInput,
          combatStats: bronzeHelmetStats,
          tokenId: EstforConstants.BRONZE_HELMET,
          equipPosition: EstforTypes.EquipPosition.HEAD,
        },
        {
          ...EstforTypes.defaultItemInput,
          tokenId: EstforConstants.BRONZE_ARROW,
          equipPosition: EstforTypes.EquipPosition.QUIVER,
        },
        {
          ...EstforTypes.defaultItemInput,
          healthRestored: 12,
          tokenId: EstforConstants.COOKED_MINNUS,
          equipPosition: EstforTypes.EquipPosition.FOOD,
        },
      ]);

      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStatus.NONE);

      await ethers.provider.send("evm_increaseTime", [3600 * 24]);
      await ethers.provider.send("evm_mine", []);

      let pendingQueuedActionState = await players.pendingQueuedActionState(alice.address, playerId);
      expect(pendingQueuedActionState.equipmentStates[0].producedItemTokenIds.length).to.eq(0);

      await requestAndFulfillRandomWords(world, mockOracleClient);

      pendingQueuedActionState = await players.pendingQueuedActionState(alice.address, playerId);
      expect(pendingQueuedActionState.equipmentStates[0].producedItemTokenIds.length).to.eq(0);
      expect(pendingQueuedActionState.producedPastRandomRewards.length).to.be.eq(0);

      await players.connect(alice).processActions(playerId);

      // Increment again but it should still not produce anything
      await ethers.provider.send("evm_increaseTime", [3600 * 24]);
      await ethers.provider.send("evm_mine", []);

      await requestAndFulfillRandomWords(world, mockOracleClient);

      expect(await itemNFT.balanceOf(alice.address, BRONZE_ARROW)).to.be.eq(0);

      pendingQueuedActionState = await players.pendingQueuedActionState(alice.address, playerId);

      expect(pendingQueuedActionState.producedPastRandomRewards.length).to.eq(1);
      await players.connect(alice).processActions(playerId);

      // Check output
      expect(await itemNFT.balanceOf(alice.address, BRONZE_ARROW)).to.be.eq(1);
    });

    it("Ticket excess with rare items uses higher chance reward system, uses low chance, hit none", async function () {
      const {playerId, players, itemNFT, world, alice, mockOracleClient} = await loadFixture(playersFixture);

      const monsterCombatStats: EstforTypes.CombatStats = {
        melee: 1,
        magic: 0,
        ranged: 0,
        meleeDefence: 0,
        magicDefence: 0,
        rangedDefence: 0,
        health: 1,
      };

      const randomChance = 1; // Very low chance
      const numSpawned = 60 * SPAWN_MUL;

      const numHours = 23;
      // 240 unique tickets 600 * 23 = 13800 / 240 = 57.5. Should give 57.5 * 1 = 57.5 / 65355 chance of each roll hitting
      const fractionChancePerRoll =
        ((((numSpawned / SPAWN_MUL) * numHours) / MAX_UNIQUE_TICKETS) * randomChance) / 65355;

      let tx = await world.addActions([
        {
          actionId: 1,
          info: {
            skill: EstforTypes.Skill.COMBAT,
            xpPerHour: 3600,
            minXP: 0,
            isDynamic: false,
            worldLocation: 0,
            isFullModeOnly: false,
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
        },
      ]);
      const actionId = await getActionId(tx);

      tx = await world.addBulkActionChoices(
        [EstforConstants.NONE],
        [[1]],
        [
          [
            {
              ...defaultActionChoice,
              skill: EstforTypes.Skill.MELEE,
            },
          ],
        ]
      );
      const choiceId = await getActionChoiceId(tx);
      await itemNFT.testMints(
        alice.address,
        [EstforConstants.BRONZE_SWORD, EstforConstants.BRONZE_HELMET, EstforConstants.COOKED_MINNUS],
        [1, 1, 255]
      );

      // Make sure it passes the next checkpoint so there are no issues running
      const {timestamp} = await ethers.provider.getBlock("latest");
      const nextCheckpoint = Math.floor(timestamp / 86400) * 86400 + 86400;
      const durationToNextCheckpoint = nextCheckpoint - timestamp + 1;
      await ethers.provider.send("evm_increaseTime", [durationToNextCheckpoint]);

      await requestAndFulfillRandomWords(world, mockOracleClient);
      await requestAndFulfillRandomWords(world, mockOracleClient);

      const timespan = 3600 * numHours;

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

      await itemNFT.addItems([
        {
          ...EstforTypes.defaultItemInput,
          combatStats: {
            ...EstforTypes.emptyCombatStats,
            melee: 50,
          },
          tokenId: EstforConstants.BRONZE_SWORD,
          equipPosition: EstforTypes.EquipPosition.RIGHT_HAND,
        },
        {
          ...EstforTypes.defaultItemInput,
          combatStats: bronzeHelmetStats,
          tokenId: EstforConstants.BRONZE_HELMET,
          equipPosition: EstforTypes.EquipPosition.HEAD,
        },
        {
          ...EstforTypes.defaultItemInput,
          tokenId: EstforConstants.BRONZE_ARROW,
          equipPosition: EstforTypes.EquipPosition.QUIVER,
        },
        {
          ...EstforTypes.defaultItemInput,
          healthRestored: 12,
          tokenId: EstforConstants.COOKED_MINNUS,
          equipPosition: EstforTypes.EquipPosition.FOOD,
        },
      ]);

      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStatus.NONE);

      await ethers.provider.send("evm_increaseTime", [3600 * 24]);
      await ethers.provider.send("evm_mine", []);

      let pendingQueuedActionState = await players.pendingQueuedActionState(alice.address, playerId);
      expect(pendingQueuedActionState.equipmentStates[0].producedItemTokenIds.length).to.eq(0);

      await requestAndFulfillRandomWords(world, mockOracleClient);

      pendingQueuedActionState = await players.pendingQueuedActionState(alice.address, playerId);
      expect(pendingQueuedActionState.equipmentStates[0].producedItemTokenIds.length).to.eq(0);
      expect(pendingQueuedActionState.producedPastRandomRewards.length).to.eq(0);

      await players.connect(alice).processActions(playerId);

      // Check output
      expect(fractionChancePerRoll).to.be.lt(0.001);
      expect(await itemNFT.balanceOf(alice.address, BRONZE_ARROW)).to.be.eq(0);
    });
  });

  it("Rewards without XP", async function () {
    // Check that you can get guaranteed rewards even if you don't get XP (rewards rate >> XP rate)
    const {playerId, players, alice, world, itemNFT} = await loadFixture(playersFixture);

    const rate = 3600 * GUAR_MUL; // per hour
    const tx = await world.addActions([
      {
        actionId: 1,
        info: {
          skill: EstforTypes.Skill.WOODCUTTING,
          xpPerHour: 0,
          minXP: 0,
          isDynamic: false,
          worldLocation: 0,
          isFullModeOnly: false,
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
      },
    ]);
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

    await itemNFT.addItems([
      {
        ...EstforTypes.defaultItemInput,
        tokenId: EstforConstants.BRONZE_AXE,
        equipPosition: EstforTypes.EquipPosition.RIGHT_HAND,
      },
    ]);

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
});
