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
  requestAndFulfillRandomWordsSeeded,
  SPAWN_MUL
} from "../utils";
import {playersFixture} from "./PlayersFixture";
import {setupBasicMeleeCombat, setupBasicWoodcutting} from "./utils";
import {timeTravel24Hours, timeTravelToNextCheckpoint} from "../utils";
import {defaultActionChoice, emptyCombatStats} from "@paintswap/estfor-definitions/types";
import {createPlayer} from "../../scripts/utils";
import {Block} from "ethers";

const actionIsAvailable = true;

describe("Rewards", function () {
  describe("XP threshold rewards", function () {
    it("Single", async function () {
      const {playerId, players, itemNFT, worldActions, alice} = await loadFixture(playersFixture);

      const {queuedAction: queuedActionWoodcutting} = await setupBasicWoodcutting(itemNFT, worldActions);
      const queuedAction = {...queuedActionWoodcutting};
      queuedAction.timespan = 500;

      const rewards: EstforTypes.Equipment[] = [{itemTokenId: EstforConstants.BRONZE_BAR, amount: 3}];
      await expect(players.addXPThresholdRewards([{xpThreshold: 499, rewards}])).to.be.revertedWithCustomError(
        players,
        "XPThresholdNotFound"
      );
      await players.addXPThresholdRewards([{xpThreshold: 500, rewards}]);

      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.NONE);
      await ethers.provider.send("evm_increaseTime", [50]);
      await ethers.provider.send("evm_mine", []);

      let pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
      expect(pendingQueuedActionState.equipmentStates[0].producedItemTokenIds.length).is.eq(1);
      await players.connect(alice).processActions(playerId);
      expect(await itemNFT.balanceOf(alice, EstforConstants.BRONZE_BAR)).to.eq(0);
      await ethers.provider.send("evm_increaseTime", [450]);
      await ethers.provider.send("evm_mine", []);
      pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
      expect(pendingQueuedActionState.equipmentStates[0].producedItemTokenIds.length).is.eq(1);
      expect(pendingQueuedActionState.xpRewardItemTokenIds.length).is.eq(1);
      expect(pendingQueuedActionState.xpRewardItemTokenIds[0]).is.eq(EstforConstants.BRONZE_BAR);
      expect(pendingQueuedActionState.xpRewardAmounts[0]).is.eq(3);

      await players.connect(alice).processActions(playerId);
      expect(await itemNFT.balanceOf(alice, EstforConstants.BRONZE_BAR)).to.eq(3);
    });

    it("Multiple", async function () {
      const {playerId, players, itemNFT, worldActions, alice} = await loadFixture(playersFixture);

      await itemNFT.addItems([
        {
          ...EstforTypes.defaultItemInput,
          tokenId: EstforConstants.BRONZE_AXE,
          equipPosition: EstforTypes.EquipPosition.RIGHT_HAND
        }
      ]);

      const rate = 100 * GUAR_MUL; // per hour

      const tx = await worldActions.addActions([
        {
          actionId: 1,
          info: {
            skill: EstforTypes.Skill.WOODCUTTING,
            xpPerHour: 3600,
            minXP: 0,
            worldLocation: 0,
            isFullModeOnly: false,
            numSpawned: 0,
            handItemTokenIdRangeMin: EstforConstants.WOODCUTTING_BASE,
            handItemTokenIdRangeMax: EstforConstants.WOODCUTTING_MAX,
            isAvailable: actionIsAvailable,
            questPrerequisiteId: 0,
            actionChoiceRequired: false,
            successPercent: 100
          },
          guaranteedRewards: [{itemTokenId: EstforConstants.LOG, rate}],
          randomRewards: [],
          combatStats: EstforTypes.emptyCombatStats
        }
      ]);

      const actionId = await getActionId(tx, worldActions);
      const queuedAction: EstforTypes.QueuedActionInput = {
        attire: EstforTypes.noAttire,
        actionId,
        combatStyle: EstforTypes.CombatStyle.NONE,
        choiceId: EstforConstants.NONE,
        regenerateId: EstforConstants.NONE,
        timespan: 1600,
        rightHandEquipmentTokenId: EstforConstants.BRONZE_AXE,
        leftHandEquipmentTokenId: EstforConstants.NONE,
        petId: EstforConstants.NONE
      };

      const rewards: EstforTypes.Equipment[] = [{itemTokenId: EstforConstants.BRONZE_BAR, amount: 3}];
      await players.addXPThresholdRewards([{xpThreshold: 500, rewards}]);
      const rewards1: EstforTypes.Equipment[] = [{itemTokenId: EstforConstants.BRONZE_HELMET, amount: 4}];
      await players.addXPThresholdRewards([{xpThreshold: 1000, rewards: rewards1}]);

      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.NONE);
      await ethers.provider.send("evm_increaseTime", [1600]);
      await ethers.provider.send("evm_mine", []);

      let pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
      expect(pendingQueuedActionState.xpRewardItemTokenIds.length).is.eq(2);
      expect(pendingQueuedActionState.xpRewardAmounts.length).is.eq(2);

      expect(pendingQueuedActionState.xpRewardItemTokenIds[0]).is.eq(EstforConstants.BRONZE_BAR);
      expect(pendingQueuedActionState.xpRewardAmounts[0]).is.eq(3);
      expect(pendingQueuedActionState.xpRewardItemTokenIds[1]).is.eq(EstforConstants.BRONZE_HELMET);
      expect(pendingQueuedActionState.xpRewardAmounts[1]).is.eq(4);

      await players.connect(alice).processActions(playerId);
      expect(await itemNFT.balanceOf(alice, EstforConstants.BRONZE_BAR)).to.eq(3);
      expect(await itemNFT.balanceOf(alice, EstforConstants.BRONZE_HELMET)).to.eq(4);
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
      const {playerId, players, itemNFT, worldActions, alice} = await loadFixture(playersFixture);

      let rewards: EstforTypes.Equipment[] = [{itemTokenId: EstforConstants.BRONZE_BAR, amount: 3}];
      await players.addXPThresholdRewards([{xpThreshold: 500, rewards}]);
      rewards = [{itemTokenId: EstforConstants.BRONZE_BAR, amount: 10}];
      await players.editXPThresholdRewards([{xpThreshold: 500, rewards}]);

      const {queuedAction: queuedActionWoodcutting} = await setupBasicWoodcutting(itemNFT, worldActions);
      const queuedAction = {...queuedActionWoodcutting};
      queuedAction.timespan = 500;

      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.NONE);
      await ethers.provider.send("evm_increaseTime", [50]);
      await ethers.provider.send("evm_mine", []);
      await players.connect(alice).processActions(playerId);

      expect(await itemNFT.balanceOf(alice, EstforConstants.BRONZE_BAR)).to.eq(0);
      await ethers.provider.send("evm_increaseTime", [450]);
      await ethers.provider.send("evm_mine", []);
      const pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
      expect(pendingQueuedActionState.xpRewardItemTokenIds.length).is.eq(1);
      expect(pendingQueuedActionState.xpRewardItemTokenIds[0]).is.eq(EstforConstants.BRONZE_BAR);
      expect(pendingQueuedActionState.xpRewardAmounts[0]).is.eq(10);
    });

    it("modifyXP rewards", async function () {
      const {playerId, players, alice} = await loadFixture(playersFixture);

      const rewards: EstforTypes.Equipment[] = [{itemTokenId: EstforConstants.BRONZE_BAR, amount: 3}];
      await players.addXPThresholdRewards([{xpThreshold: 500, rewards}]);
      const rewards1: EstforTypes.Equipment[] = [{itemTokenId: EstforConstants.BRONZE_HELMET, amount: 4}];
      await players.addXPThresholdRewards([{xpThreshold: 1000, rewards: rewards1}]);

      // Test max level works
      await expect(players.modifyXP(alice, playerId, EstforTypes.Skill.MELEE, 2070952))
        .to.emit(players, "AddXP")
        .withArgs(alice, playerId, EstforTypes.Skill.MELEE, 2070952)
        .and.to.emit(players, "ClaimedXPThresholdRewards")
        .withArgs(alice, playerId, [EstforConstants.BRONZE_BAR, EstforConstants.BRONZE_HELMET], [3, 4]);
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.MELEE)).to.equal(2070952);

      await expect(players.modifyXP(alice, playerId, EstforTypes.Skill.MELEE, 2080952))
        .to.emit(players, "AddXP")
        .withArgs(alice, playerId, EstforTypes.Skill.MELEE, 10000)
        .and.to.not.emit(players, "ClaimedXPThresholdRewards");
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.MELEE)).to.equal(2080952);

      // Check balance
      await expect(players.modifyXP(alice, playerId, EstforTypes.Skill.DEFENCE, 2070952))
        .to.emit(players, "AddXP")
        .withArgs(alice, playerId, EstforTypes.Skill.DEFENCE, 2070952)
        .and.to.not.emit(players, "ClaimedXPThresholdRewards");
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.DEFENCE)).to.equal(2070952);
    });

    // This was for a reported bug by doughbender where multiple actions were giving the same xp rewards triggering
    it("Check that multiple actions only give 1 set of xp rewards", async function () {
      const {playerId, players, itemNFT, worldActions, alice} = await loadFixture(playersFixture);

      const {queuedAction: queuedActionWoodcutting} = await setupBasicWoodcutting(itemNFT, worldActions);
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
        .startActions(playerId, [queuedAction, queuedAction, queuedAction], EstforTypes.ActionQueueStrategy.NONE);
      await ethers.provider.send("evm_increaseTime", [50]);
      await ethers.provider.send("evm_mine", []);

      let pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
      expect(pendingQueuedActionState.equipmentStates[0].producedItemTokenIds.length).is.eq(1);
      await players.connect(alice).processActions(playerId);
      expect(await itemNFT.balanceOf(alice, EstforConstants.BRONZE_BAR)).to.eq(0);
      await ethers.provider.send("evm_increaseTime", [450]);
      await ethers.provider.send("evm_mine", []);
      pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
      expect(pendingQueuedActionState.equipmentStates[0].producedItemTokenIds.length).is.eq(1);
      expect(pendingQueuedActionState.xpRewardItemTokenIds.length).is.eq(1);
      expect(pendingQueuedActionState.xpRewardItemTokenIds[0]).is.eq(EstforConstants.BRONZE_BAR);
      expect(pendingQueuedActionState.xpRewardAmounts[0]).is.eq(3);

      await players.connect(alice).processActions(playerId);
      expect(await itemNFT.balanceOf(alice, EstforConstants.BRONZE_BAR)).to.eq(3);
    });
  });

  describe("Daily Rewards", function () {
    it("Daily & weekly reward when starting an action", async function () {
      const {playerId, players, itemNFT, worldActions, randomnessBeacon, dailyRewardsScheduler, alice, mockVRF} =
        await loadFixture(playersFixture);

      await players.setDailyRewardsEnabled(true);

      const oneDay = 24 * 3600;
      const oneWeek = oneDay * 7;
      const {timestamp: currentTimestamp} = (await ethers.provider.getBlock("latest")) as Block;
      const timestamp = Math.floor((currentTimestamp - 4 * oneDay) / oneWeek) * oneWeek + (oneWeek + 5 * oneDay); // Start next tuesday

      const numDays = Math.floor(timestamp - currentTimestamp) / oneDay;

      await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);

      await ethers.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await ethers.provider.send("evm_mine", []);

      for (let i = 0; i < numDays; ++i) {
        await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);
      }

      // Get the new equipments for the next week
      let dailyRewards = await dailyRewardsScheduler.getActiveDailyAndWeeklyRewards(1, playerId);
      let equipments = dailyRewards.slice(1, 6); // skip first and last
      let equipmentCache = new Map<bigint, bigint>();
      for (let i = 0; i < equipments.length; ++i) {
        equipmentCache.set(
          equipments[i].itemTokenId,
          (equipmentCache.get(equipments[i].itemTokenId) || 0n) + equipments[i].amount
        );
      }
      let weeklyEquipment = dailyRewards[7];
      let balanceBeforeWeeklyReward = await itemNFT.balanceOf(alice, weeklyEquipment.itemTokenId);

      let beforeBalances = await itemNFT.balanceOfs(
        alice,
        equipments.map((equipment) => equipment.itemTokenId)
      );

      // Change reward else it conflicts with tiered daily rewards
      const {queuedAction} = await setupBasicWoodcutting(
        itemNFT,
        worldActions,
        100 * GUAR_MUL,
        20n,
        EstforConstants.MAGICAL_LOG
      );

      for (let i = 0; i < 4; ++i) {
        await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.NONE);
        await ethers.provider.send("evm_increaseTime", [3600 * 24]);
        await ethers.provider.send("evm_mine", []);
        await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);
      }
      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.NONE);

      let afterBalances = await itemNFT.balanceOfs(
        alice,
        equipments.map((equipment) => equipment.itemTokenId)
      );

      for (let i = 0; i < 5; ++i) {
        expect(afterBalances[i]).to.eq(beforeBalances[i] + (equipmentCache.get(equipments[i].itemTokenId) || 0n));
      }

      expect(await players.dailyClaimedRewards(playerId)).to.eql([false, true, true, true, true, true, false]);

      // Last day of the week. This isn't a full week so shouldn't get weekly rewards, but still get daily rewards
      let balanceAfterWeeklyReward = await itemNFT.balanceOf(alice, weeklyEquipment.itemTokenId);
      expect(balanceBeforeWeeklyReward).to.eq(balanceAfterWeeklyReward);
      const sundayReward = dailyRewards[dailyRewards.length - 2];
      let prevBalanceDailyReward = await itemNFT.balanceOf(alice, sundayReward.itemTokenId);
      await ethers.provider.send("evm_increaseTime", [3600 * 24]);
      await ethers.provider.send("evm_mine", []);
      await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);
      // Check the last day of the week
      const pendingQueuedActionState = await players.connect(alice).getPendingQueuedActionState(alice, playerId);
      expect(pendingQueuedActionState.dailyRewardItemTokenIds.length).to.eq(1);
      expect(pendingQueuedActionState.dailyRewardItemTokenIds[0]).to.eq(sundayReward.itemTokenId);

      equipmentCache.set(
        sundayReward.itemTokenId,
        (equipmentCache.get(sundayReward.itemTokenId) || 0n) + sundayReward.amount
      );

      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.NONE);
      expect(balanceAfterWeeklyReward).to.eq(await itemNFT.balanceOf(alice, weeklyEquipment.itemTokenId));
      let balanceAfterDailyReward = await itemNFT.balanceOf(alice, sundayReward.itemTokenId);
      expect(balanceAfterDailyReward).to.eq(prevBalanceDailyReward + sundayReward.amount);

      expect(await players.dailyClaimedRewards(playerId)).to.eql([false, true, true, true, true, true, true]);

      // Next one should start the next round
      await ethers.provider.send("evm_increaseTime", [3600 * 24]);
      await ethers.provider.send("evm_mine", []);
      await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);

      expect(await players.dailyClaimedRewards(playerId)).to.eql([false, false, false, false, false, false, false]);

      dailyRewards = await dailyRewardsScheduler.getActiveDailyAndWeeklyRewards(1, playerId);
      equipments = dailyRewards.slice(0, 7);
      equipmentCache = new Map<bigint, bigint>();
      for (let i = 0; i < equipments.length; ++i) {
        equipmentCache.set(
          equipments[i].itemTokenId,
          (equipmentCache.get(equipments[i].itemTokenId) || 0n) + equipments[i].amount
        );
      }

      weeklyEquipment = dailyRewards[7];

      beforeBalances = await itemNFT.balanceOfs(
        alice,
        equipments.map((equipment) => equipment.itemTokenId)
      );

      for (let i = 0; i < 7; ++i) {
        await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.NONE);
        if (i != 6) {
          await ethers.provider.send("evm_increaseTime", [3600 * 24]);
          await ethers.provider.send("evm_mine", []);
          await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);
        }
      }

      expect(await players.dailyClaimedRewards(playerId)).to.eql([true, true, true, true, true, true, true]);

      afterBalances = await itemNFT.balanceOfs(
        alice,
        equipments.map((equipment) => equipment.itemTokenId)
      );

      for (let i = 0; i < 7; ++i) {
        expect(beforeBalances[i] + (equipmentCache.get(equipments[i].itemTokenId) || 0n)).to.eq(afterBalances[i]);
      }

      // Also check extra week streak reward
      expect(balanceAfterWeeklyReward + weeklyEquipment.amount).to.eq(
        await itemNFT.balanceOf(alice, weeklyEquipment.itemTokenId)
      );
    });

    it("Only 1 claim per hero per day", async function () {
      const {playerId, players, itemNFT, worldActions, randomnessBeacon, dailyRewardsScheduler, alice, mockVRF} =
        await loadFixture(playersFixture);

      await players.setDailyRewardsEnabled(true);

      const {queuedAction} = await setupBasicWoodcutting(itemNFT, worldActions, 100 * GUAR_MUL, 20n);

      const oneDay = 24 * 3600;
      const oneWeek = oneDay * 7;
      const {timestamp: currentTimestamp} = (await ethers.provider.getBlock("latest")) as Block;
      const timestamp = Math.floor((currentTimestamp - 4 * oneDay) / oneWeek) * oneWeek + (oneWeek + 4 * oneDay); // Start next monday

      await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);
      await ethers.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await ethers.provider.send("evm_mine", []);

      const numDays = Math.floor(timestamp - currentTimestamp) / oneDay;
      for (let i = 0; i < numDays; ++i) {
        await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);
      }

      // Get the new equipments for the next week
      let equipments = await dailyRewardsScheduler.getActiveDailyAndWeeklyRewards(1, playerId);
      let equipment = equipments[0];

      let balanceBefore = await itemNFT.balanceOf(alice, equipment.itemTokenId);
      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.NONE);
      let balanceAfter = await itemNFT.balanceOf(alice, equipment.itemTokenId);
      expect(balanceAfter).to.eq(balanceBefore + equipment.amount);

      // Start again, shouldn't get any more rewards
      balanceBefore = await itemNFT.balanceOf(alice, equipment.itemTokenId);
      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.NONE);
      balanceAfter = await itemNFT.balanceOf(alice, equipment.itemTokenId);
      expect(balanceAfter).to.eq(balanceBefore);
    });

    it("Only 1 claim per wallet per day", async function () {
      const {
        playerId,
        players,
        itemNFT,
        playerNFT,
        avatarId,
        worldActions,
        randomnessBeacon,
        dailyRewardsScheduler,
        alice,
        mockVRF
      } = await loadFixture(playersFixture);

      await players.setDailyRewardsEnabled(true);

      const {queuedAction} = await setupBasicWoodcutting(itemNFT, worldActions, 100 * GUAR_MUL, 20n);

      const oneDay = 24 * 3600;
      const oneWeek = oneDay * 7;
      const {timestamp: currentTimestamp} = (await ethers.provider.getBlock("latest")) as Block;
      const timestamp = Math.floor((currentTimestamp - 4 * oneDay) / oneWeek) * oneWeek + (oneWeek + 4 * oneDay); // Start next monday

      await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);
      await ethers.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await ethers.provider.send("evm_mine", []);

      const numDays = Math.floor(timestamp - currentTimestamp) / oneDay;
      for (let i = 0; i < numDays; ++i) {
        await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);
      }

      // Get the new equipments for the next week
      const tier = 1;
      let equipments = await dailyRewardsScheduler.getActiveDailyAndWeeklyRewards(tier, playerId);
      let equipment = equipments[0];

      let balanceBefore = await itemNFT.balanceOf(alice, equipment.itemTokenId);
      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.NONE);
      let balanceAfter = await itemNFT.balanceOf(alice, equipment.itemTokenId);
      expect(balanceAfter).to.eq(balanceBefore + equipment.amount);

      // Using another hero, shouldn't get any more rewards
      const newPlayerId = await createPlayer(playerNFT, avatarId, alice, "alice1", true);

      equipments = await dailyRewardsScheduler.getActiveDailyAndWeeklyRewards(tier, newPlayerId);
      equipment = equipments[0];

      balanceBefore = await itemNFT.balanceOf(alice, equipment.itemTokenId);
      await players.connect(alice).startActions(newPlayerId, [queuedAction], EstforTypes.ActionQueueStrategy.NONE);
      balanceAfter = await itemNFT.balanceOf(alice, equipment.itemTokenId);
      expect(balanceAfter).to.eq(balanceBefore);
    });

    it("Check daily rewards not given when making a new hero", async function () {
      const {players, playerNFT, itemNFT, alice, randomnessBeacon, dailyRewardsScheduler, mockVRF} = await loadFixture(
        playersFixture
      );

      await players.setDailyRewardsEnabled(true);
      await dailyRewardsScheduler.setDailyRewardPool(1, [{itemTokenId: EstforConstants.BRONZE_ARROW, amount: 10}]);
      await requestAndFulfillRandomWords(randomnessBeacon, mockVRF); // Add this to that if test is run on Monday the streak start condition is fulfilled
      await createPlayer(playerNFT, 1, alice, "name1", true);
      expect(await itemNFT.balanceOf(alice, EstforConstants.BRONZE_ARROW)).to.eq(10);

      await createPlayer(playerNFT, 1, alice, "name2", true);
      expect(await itemNFT.balanceOf(alice, EstforConstants.BRONZE_ARROW)).to.eq(10);
    });

    it("Update on process actions", async function () {
      const {playerId, players, itemNFT, worldActions, randomnessBeacon, alice, mockVRF} = await loadFixture(
        playersFixture
      );

      await players.setDailyRewardsEnabled(true);

      const {queuedAction} = await setupBasicWoodcutting(itemNFT, worldActions);

      const oneDay = 24 * 3600;
      const oneWeek = oneDay * 7;
      const {timestamp: currentTimestamp} = (await ethers.provider.getBlock("latest")) as Block;
      const timestamp = Math.floor((currentTimestamp - 4 * oneDay) / oneWeek) * oneWeek + (oneWeek + 4 * oneDay); // Start next monday

      await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);
      await ethers.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await ethers.provider.send("evm_mine", []);

      const numDays = Math.floor(timestamp - currentTimestamp) / oneDay;
      for (let i = 0; i < numDays; ++i) {
        await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);
      }

      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.NONE);
      expect(await players.dailyClaimedRewards(playerId)).to.eql([true, false, false, false, false, false, false]);
      await ethers.provider.send("evm_increaseTime", [3600 * 24]);
      await ethers.provider.send("evm_mine", []);
      await players.connect(alice).processActions(playerId); // Daily reward should be given
      expect(await players.dailyClaimedRewards(playerId)).to.eql([true, true, false, false, false, false, false]);
    });

    it("Can only get Monday's reward if the oracle has been called", async function () {
      // So that people can't get last Monday's daily reward
      const {playerId, players, itemNFT, worldActions, randomnessBeacon, dailyRewardsScheduler, alice, mockVRF} =
        await loadFixture(playersFixture);

      await players.setDailyRewardsEnabled(true);

      const {queuedAction} = await setupBasicWoodcutting(itemNFT, worldActions);

      const oneDay = 24 * 3600;
      const oneWeek = oneDay * 7;
      const {timestamp: currentTimestamp} = (await ethers.provider.getBlock("latest")) as Block;
      const timestamp = Math.floor((currentTimestamp - 4 * oneDay) / oneWeek) * oneWeek + (oneWeek + 4 * oneDay); // Start next monday

      const numDays = Math.floor(timestamp - currentTimestamp) / oneDay;

      await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);

      await ethers.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await ethers.provider.send("evm_mine", []);

      // Request all up to the last day
      for (let i = 0; i < numDays - 1; ++i) {
        await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);
      }

      // Get the new equipments for the next week
      let equipments = await dailyRewardsScheduler.getActiveDailyAndWeeklyRewards(1, playerId);
      let mondayEquipment = equipments[0];

      let balanceBeforeMondayReward = await itemNFT.balanceOf(alice, mondayEquipment.itemTokenId);
      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.NONE);
      // Do not get Monday reward yet
      expect(balanceBeforeMondayReward).eq(await itemNFT.balanceOf(alice, mondayEquipment.itemTokenId));

      await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);
      await players.connect(alice).processActions(playerId);

      equipments = await dailyRewardsScheduler.getActiveDailyAndWeeklyRewards(1, playerId);
      mondayEquipment = equipments[0];
      expect(balanceBeforeMondayReward + mondayEquipment.amount).eq(
        await itemNFT.balanceOf(alice, mondayEquipment.itemTokenId)
      );
    });

    it("Clan tier bonus reward upgrades", async function () {
      const {playerId, players, itemNFT, worldActions, randomnessBeacon, dailyRewardsScheduler, alice, clans, mockVRF} =
        await loadFixture(playersFixture);

      // Be a member of a clan
      await clans.addTiers([
        {
          id: 1,
          maxMemberCapacity: 3,
          maxBankCapacity: 3,
          maxImageId: 16,
          price: 0,
          minimumAge: 0
        },
        {
          id: 2,
          maxMemberCapacity: 3,
          maxBankCapacity: 3,
          maxImageId: 16,
          price: 0,
          minimumAge: 0
        }
      ]);

      let tierId = 1;
      const imageId = 1;
      await clans.connect(alice).createClan(playerId, "Clan name", "discord", "telegram", "twitter", imageId, tierId);

      await players.setDailyRewardsEnabled(true);

      const {queuedAction} = await setupBasicWoodcutting(
        itemNFT,
        worldActions,
        100 * GUAR_MUL,
        3600n,
        EstforConstants.HALLOWEEN_BONUS_1
      );
      const oneDay = 24 * 3600;
      const oneWeek = oneDay * 7;
      const {timestamp: currentTimestamp} = (await ethers.provider.getBlock("latest")) as Block;
      const timestamp = Math.floor((currentTimestamp - 4 * oneDay) / oneWeek) * oneWeek + (oneWeek + 4 * oneDay); // Start next monday

      const numDays = Math.floor(timestamp - currentTimestamp) / oneDay;

      await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);

      await ethers.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await ethers.provider.send("evm_mine", []);

      for (let i = 0; i < numDays; ++i) {
        await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);
      }

      const equipments = await dailyRewardsScheduler.getActiveDailyAndWeeklyRewards(1, playerId);

      let baseEquipment = equipments[0];
      expect(await itemNFT.balanceOf(alice, baseEquipment.itemTokenId)).to.be.eq(0);

      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.NONE);
      expect(await players.dailyClaimedRewards(playerId)).to.eql([true, false, false, false, false, false, false]);
      expect(await itemNFT.balanceOf(alice, baseEquipment.itemTokenId)).to.eq((baseEquipment.amount * 11n) / 10n);

      const clanId = 1;
      tierId = 2;
      await clans.connect(alice).upgradeClan(clanId, playerId, tierId);

      await timeTravel24Hours();
      await players.connect(alice).processActions(playerId);
      expect(await players.dailyClaimedRewards(playerId)).to.eql([true, true, false, false, false, false, false]);

      // If you manage to get the same tokenId then add that as well
      const expectedAmount0 = BigInt(Math.floor(Number(equipments[0].amount) * 1.1)); // get 10% boost
      const expectedAmount1 = BigInt(Math.floor(Number(equipments[1].amount) * 1.2)); // get 20% boost
      if (equipments[0].itemTokenId == equipments[1].itemTokenId) {
        expect(await itemNFT.balanceOf(alice, equipments[0].itemTokenId)).to.be.eq(expectedAmount0 + expectedAmount1);
      } else {
        expect(await itemNFT.balanceOf(alice, equipments[0].itemTokenId)).to.be.eq(expectedAmount0);
        expect(await itemNFT.balanceOf(alice, equipments[1].itemTokenId)).to.be.eq(expectedAmount1);
      }
    });

    it("Test rewards in new week", async function () {
      // TODO
    });

    it("Tiered rewards", async function () {
      const {playerId, players, itemNFT, worldActions, randomnessBeacon, dailyRewardsScheduler, alice, mockVRF} =
        await loadFixture(playersFixture);

      await players.setDailyRewardsEnabled(true);

      const {queuedAction} = await setupBasicWoodcutting(itemNFT, worldActions, 100 * GUAR_MUL, 20n);

      const oneDay = 24 * 3600;
      const oneWeek = oneDay * 7;
      const {timestamp: currentTimestamp} = (await ethers.provider.getBlock("latest")) as Block;
      const timestamp = Math.floor((currentTimestamp - 4 * oneDay) / oneWeek) * oneWeek + (oneWeek + 4 * oneDay); // Start next monday

      await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);
      await ethers.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await ethers.provider.send("evm_mine", []);

      const numDays = Math.floor(timestamp - currentTimestamp) / oneDay;
      for (let i = 0; i < numDays; ++i) {
        await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);
      }

      // Get the new equipments for the next week
      let mondayEquipment = await dailyRewardsScheduler.getSpecificDailyReward(
        3,
        playerId,
        0,
        await dailyRewardsScheduler.getThisWeeksRandomWordSegment()
      );

      // Double check it is different to the other tiers
      let dailyRewardsTier1 = await dailyRewardsScheduler.getSpecificDailyReward(
        1,
        playerId,
        0,
        await dailyRewardsScheduler.getThisWeeksRandomWordSegment()
      );
      let dailyRewardsTier2 = await dailyRewardsScheduler.getSpecificDailyReward(
        2,
        playerId,
        0,
        await dailyRewardsScheduler.getThisWeeksRandomWordSegment()
      );
      // TODO: Fix this - what should it be checking?
      expect(mondayEquipment.itemTokenId).to.not.eq(dailyRewardsTier1.itemTokenId);
      expect(mondayEquipment.itemTokenId).to.not.eq(dailyRewardsTier2.itemTokenId);

      const tier3Start = 33913;
      await players.modifyXP(alice, playerId, EstforTypes.Skill.WOODCUTTING, tier3Start);

      let balanceBefore = await itemNFT.balanceOf(alice, mondayEquipment.itemTokenId);
      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.NONE);
      let balanceAfter = await itemNFT.balanceOf(alice, mondayEquipment.itemTokenId);
      expect(balanceAfter).to.eq(balanceBefore + mondayEquipment.amount);

      // Start again, shouldn't get any more rewards
      balanceBefore = await itemNFT.balanceOf(alice, mondayEquipment.itemTokenId);
      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.NONE);
      balanceAfter = await itemNFT.balanceOf(alice, mondayEquipment.itemTokenId);
      expect(balanceAfter).to.eq(balanceBefore);
    });
  });

  it("Guaranteed rewards", async function () {
    // TODO
  });

  it("Non-combat guaranteed reward & Random rewards", async function () {
    const {playerId, players, itemNFT, worldActions, randomnessBeacon, alice, mockVRF} = await loadFixture(
      playersFixture
    );

    const randomChance = 65535; // 100% chance
    const tx = await worldActions.addActions([
      {
        actionId: EstforConstants.ACTION_WOODCUTTING_LOG,
        info: {
          skill: EstforTypes.Skill.WOODCUTTING,
          xpPerHour: 3600,
          minXP: 0,
          worldLocation: 0,
          isFullModeOnly: false,
          numSpawned: 0,
          handItemTokenIdRangeMin: EstforConstants.BRONZE_AXE,
          handItemTokenIdRangeMax: EstforConstants.WOODCUTTING_MAX,
          isAvailable: actionIsAvailable,
          questPrerequisiteId: 0,
          actionChoiceRequired: false,
          successPercent: 100
        },
        guaranteedRewards: [{itemTokenId: EstforConstants.ENCHANTED_LOG, rate: 40 * 10}],
        randomRewards: [{itemTokenId: EstforConstants.BRONZE_ARROW, chance: randomChance, amount: 1}],
        combatStats: EstforTypes.emptyCombatStats
      }
    ]);

    const actionId = await getActionId(tx, worldActions);

    const timespan = 3600;
    const queuedAction: EstforTypes.QueuedActionInput = {
      attire: EstforTypes.noAttire,
      actionId,
      combatStyle: EstforTypes.CombatStyle.NONE,
      choiceId: EstforConstants.NONE,
      regenerateId: EstforConstants.NONE,
      timespan,
      rightHandEquipmentTokenId: EstforConstants.BRONZE_AXE,
      leftHandEquipmentTokenId: EstforConstants.NONE,
      petId: EstforConstants.NONE
    };

    await itemNFT.addItems([
      {
        ...EstforTypes.defaultItemInput,
        tokenId: EstforConstants.BRONZE_AXE,
        equipPosition: EstforTypes.EquipPosition.RIGHT_HAND
      }
    ]);

    await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.NONE);
    await ethers.provider.send("evm_increaseTime", [1810]);
    await ethers.provider.send("evm_mine", []);
    let pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
    expect(pendingQueuedActionState.actionMetadatas[0].rolls).is.eq(0);
    // Get no guaranteed loot until an hour has passed
    expect(pendingQueuedActionState.equipmentStates.length).to.eq(1);
    expect(pendingQueuedActionState.equipmentStates[0].producedItemTokenIds.length).to.eq(0);
    await ethers.provider.send("evm_increaseTime", [1790]);
    await ethers.provider.send("evm_mine", []);
    pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
    expect(pendingQueuedActionState.actionMetadatas[0].rolls).is.eq(1);
    expect(pendingQueuedActionState.equipmentStates[0].producedItemTokenIds.length).to.eq(1);
    expect(pendingQueuedActionState.equipmentStates[0].producedItemTokenIds[0]).to.eq(EstforConstants.ENCHANTED_LOG);
    expect(pendingQueuedActionState.equipmentStates[0].producedAmounts[0]).to.eq(40);
    await ethers.provider.send("evm_increaseTime", [86400]);
    await ethers.provider.send("evm_mine", []);
    await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);
    await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);
    pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
    expect(pendingQueuedActionState.actionMetadatas[0].rolls).is.eq(0);
    expect(pendingQueuedActionState.equipmentStates[0].producedItemTokenIds.length).is.eq(1);
    expect(pendingQueuedActionState.equipmentStates[0].producedItemTokenIds[0]).is.eq(EstforConstants.ENCHANTED_LOG);
    expect(pendingQueuedActionState.producedPastRandomRewards[0].itemTokenId).is.eq(EstforConstants.BRONZE_ARROW);
    await players.connect(alice).processActions(playerId);
    expect(await itemNFT.balanceOf(alice, EstforConstants.BRONZE_ARROW)).to.eq(1);
  });

  it("Non-combat guaranteed reward & Random rewards, partial looting", async function () {
    const {playerId, players, itemNFT, worldActions, randomnessBeacon, alice, mockVRF} = await loadFixture(
      playersFixture
    );

    const randomChance = 65535; // 100% chance
    const tx = await worldActions.addActions([
      {
        actionId: EstforConstants.ACTION_WOODCUTTING_LOG,
        info: {
          skill: EstforTypes.Skill.WOODCUTTING,
          xpPerHour: 3600,
          minXP: 0,
          worldLocation: 0,
          isFullModeOnly: false,
          numSpawned: 0,
          handItemTokenIdRangeMin: EstforConstants.BRONZE_AXE,
          handItemTokenIdRangeMax: EstforConstants.WOODCUTTING_MAX,
          isAvailable: actionIsAvailable,
          questPrerequisiteId: 0,
          actionChoiceRequired: false,
          successPercent: 100
        },
        guaranteedRewards: [{itemTokenId: EstforConstants.ENCHANTED_LOG, rate: 40 * 10}],
        randomRewards: [{itemTokenId: EstforConstants.BRONZE_ARROW, chance: randomChance, amount: 1}],
        combatStats: EstforTypes.emptyCombatStats
      }
    ]);

    const actionId = await getActionId(tx, worldActions);

    const timespan = 4800;
    const queuedAction: EstforTypes.QueuedActionInput = {
      attire: EstforTypes.noAttire,
      actionId,
      combatStyle: EstforTypes.CombatStyle.NONE,
      choiceId: EstforConstants.NONE,
      regenerateId: EstforConstants.NONE,
      timespan,
      rightHandEquipmentTokenId: EstforConstants.BRONZE_AXE,
      leftHandEquipmentTokenId: EstforConstants.NONE,
      petId: EstforConstants.NONE
    };

    await itemNFT.addItems([
      {
        ...EstforTypes.defaultItemInput,
        tokenId: EstforConstants.BRONZE_AXE,
        equipPosition: EstforTypes.EquipPosition.RIGHT_HAND
      }
    ]);

    await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.NONE);
    await ethers.provider.send("evm_increaseTime", [1810]);
    await ethers.provider.send("evm_mine", []);
    let pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
    expect(pendingQueuedActionState.actionMetadatas[0].rolls).is.eq(0);

    // Loot, everything should work as if the loot was never done
    await players.connect(alice).processActions(playerId);

    await ethers.provider.send("evm_increaseTime", [1790]);
    await ethers.provider.send("evm_mine", []);
    pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
    expect(pendingQueuedActionState.actionMetadatas[0].rolls).is.eq(1);
    await ethers.provider.send("evm_increaseTime", [86400]);
    await ethers.provider.send("evm_mine", []);
    await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);
    await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);
    pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
    expect(pendingQueuedActionState.actionMetadatas[0].rolls).is.eq(0);
    expect(pendingQueuedActionState.equipmentStates[0].producedItemTokenIds.length).is.eq(1);
    expect(pendingQueuedActionState.equipmentStates[0].producedItemTokenIds[0]).is.eq(EstforConstants.ENCHANTED_LOG);
    expect(pendingQueuedActionState.producedPastRandomRewards[0].itemTokenId).is.eq(EstforConstants.BRONZE_ARROW);
    await players.connect(alice).processActions(playerId);
    expect(await itemNFT.balanceOf(alice, EstforConstants.BRONZE_ARROW)).to.eq(1n);
    expect(await itemNFT.balanceOf(alice, EstforConstants.ENCHANTED_LOG)).to.eq(40n);
  });

  describe("Random rewards", function () {
    it("Random rewards (many)", async function () {
      const {playerId, players, itemNFT, worldActions, randomnessBeacon, alice, mockVRF} = await loadFixture(
        playersFixture
      );

      this.timeout(100000); // 100 seconds, this test can take a while on CI

      await itemNFT.addItems([
        {
          ...EstforTypes.defaultItemInput,
          tokenId: EstforConstants.BRONZE_AXE,
          equipPosition: EstforTypes.EquipPosition.RIGHT_HAND
        },
        {
          ...EstforTypes.defaultItemInput,
          tokenId: EstforConstants.BRONZE_ARROW,
          equipPosition: EstforTypes.EquipPosition.QUIVER
        }
      ]);

      const randomChanceFraction = 50.0 / 100; // 50% chance
      const randomChance = Math.floor(65535 * randomChanceFraction);

      let tx = await worldActions.addActions([
        {
          actionId: 1,
          info: {
            skill: EstforTypes.Skill.THIEVING,
            xpPerHour: 3600,
            minXP: 0,
            worldLocation: 0,
            isFullModeOnly: false,
            numSpawned: 0,
            handItemTokenIdRangeMin: EstforConstants.NONE,
            handItemTokenIdRangeMax: EstforConstants.NONE,
            isAvailable: actionIsAvailable,
            questPrerequisiteId: 0,
            actionChoiceRequired: false,
            successPercent: 100
          },
          guaranteedRewards: [],
          randomRewards: [{itemTokenId: EstforConstants.BRONZE_ARROW, chance: randomChance, amount: 1}],
          combatStats: EstforTypes.emptyCombatStats
        }
      ]);

      const actionId = await getActionId(tx, worldActions);
      const numHours = 5;

      await timeTravelToNextCheckpoint();
      await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);
      await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);

      const queuedAction: EstforTypes.QueuedActionInput = {
        attire: EstforTypes.noAttire,
        actionId,
        combatStyle: EstforTypes.CombatStyle.NONE,
        choiceId: EstforConstants.NONE,
        regenerateId: EstforConstants.NONE,
        timespan: 3600 * numHours,
        rightHandEquipmentTokenId: EstforConstants.NONE,
        leftHandEquipmentTokenId: EstforConstants.NONE,
        petId: EstforConstants.NONE
      };

      let numProduced = 0n;

      // Repeat the test a bunch of times to check the random rewards are as expected
      const numRepeats = 50;
      let numRandomRewardsHit = 0; // Checks there is some randomness
      for (let i = 0; i < numRepeats; ++i) {
        await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.NONE);
        let endTime;
        {
          const actionQueue = await players.getActionQueue(playerId);
          expect(actionQueue.length).to.eq(1);
          endTime = (await players.getPlayers(playerId)).currentActionStartTimestamp + actionQueue[0].timespan;
        }

        expect(await randomnessBeacon.hasRandomWord(endTime)).to.be.false;

        await timeTravel24Hours();
        await players.connect(alice).processActions(playerId);
        expect(await itemNFT.balanceOf(alice, EstforConstants.BRONZE_ARROW)).to.eq(numProduced);

        expect((await players.getPendingRandomRewards(playerId)).length).to.eq(1);

        let pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
        expect(pendingQueuedActionState.equipmentStates.length).to.eq(0);

        await requestAndFulfillRandomWordsSeeded(randomnessBeacon, mockVRF, 400_000_000_000n);
        await timeTravel24Hours();
        await requestAndFulfillRandomWordsSeeded(randomnessBeacon, mockVRF, 400_000_000_000n);

        expect(await randomnessBeacon.hasRandomWord(endTime)).to.be.true;

        pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);

        if (pendingQueuedActionState.producedPastRandomRewards.length != 0) {
          expect(pendingQueuedActionState.producedPastRandomRewards.length).to.eq(1);

          const produced = pendingQueuedActionState.producedPastRandomRewards[0].amount;
          numProduced += produced;
          expect(pendingQueuedActionState.producedPastRandomRewards[0].itemTokenId).to.be.eq(
            EstforConstants.BRONZE_ARROW
          );
          ++numRandomRewardsHit;
        }
      }
      expect(numRandomRewardsHit).to.be.greaterThan(0).and.to.be.lessThan(numRepeats);

      await timeTravel24Hours();
      await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);
      await players.connect(alice).processActions(playerId);

      const expectedTotal = numRepeats * randomChanceFraction * numHours;
      expect(numProduced).to.be.gte(Math.floor(expectedTotal * 0.8)); // Within 20% below
      expect(numProduced).to.be.lte(Math.floor(expectedTotal * 1.2)); // 20% of the time we should get more than 50% of the reward
    });

    it("Multiple random rewards (many)", async function () {
      const {playerId, players, itemNFT, worldActions, randomnessBeacon, alice, mockVRF} = await loadFixture(
        playersFixture
      );

      this.timeout(100000); // 100 seconds, this test can take a while on CI

      await itemNFT.addItems([
        {
          ...EstforTypes.defaultItemInput,
          tokenId: EstforConstants.BRONZE_AXE,
          equipPosition: EstforTypes.EquipPosition.RIGHT_HAND
        },
        {
          ...EstforTypes.defaultItemInput,
          tokenId: EstforConstants.BRONZE_ARROW,
          equipPosition: EstforTypes.EquipPosition.QUIVER
        }
      ]);

      const randomChanceFractions = [80.0 / 100, 50.0 / 100, 50.0 / 100, 20.0 / 100]; // 80%, 50%, 50%, 20%
      const randomChance = Math.floor(65535 * randomChanceFractions[0]);
      const randomChance1 = Math.floor(65535 * randomChanceFractions[1]);
      const randomChance2 = Math.floor(65535 * randomChanceFractions[2]);
      const randomChance3 = Math.floor(65535 * randomChanceFractions[3]);

      let tx = await worldActions.addActions([
        {
          actionId: 1,
          info: {
            skill: EstforTypes.Skill.THIEVING,
            xpPerHour: 3600,
            minXP: 0,
            worldLocation: 0,
            isFullModeOnly: false,
            numSpawned: 0,
            handItemTokenIdRangeMin: EstforConstants.NONE,
            handItemTokenIdRangeMax: EstforConstants.NONE,
            isAvailable: actionIsAvailable,
            questPrerequisiteId: 0,
            actionChoiceRequired: false,
            successPercent: 100
          },
          guaranteedRewards: [],
          randomRewards: [
            {itemTokenId: EstforConstants.BRONZE_BAR, chance: randomChance, amount: 1},
            {itemTokenId: EstforConstants.BRONZE_ARROW, chance: randomChance1, amount: 1},
            {itemTokenId: EstforConstants.BRONZE_TASSETS, chance: randomChance2, amount: 1},
            {itemTokenId: EstforConstants.BRONZE_GAUNTLETS, chance: randomChance3, amount: 1}
          ],
          combatStats: EstforTypes.emptyCombatStats
        }
      ]);

      const actionId = await getActionId(tx, worldActions);
      const numHours = 2;

      await timeTravelToNextCheckpoint();
      await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);
      await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);

      const queuedAction: EstforTypes.QueuedActionInput = {
        attire: EstforTypes.noAttire,
        actionId,
        combatStyle: EstforTypes.CombatStyle.NONE,
        choiceId: EstforConstants.NONE,
        regenerateId: EstforConstants.NONE,
        timespan: 3600 * numHours,
        rightHandEquipmentTokenId: EstforConstants.BRONZE_AXE,
        leftHandEquipmentTokenId: EstforConstants.NONE,
        petId: EstforConstants.NONE
      };

      const balanceMap = new Map<bigint, bigint>();
      balanceMap.set(BigInt(EstforConstants.BRONZE_BAR), 0n);
      balanceMap.set(BigInt(EstforConstants.BRONZE_ARROW), 0n);
      balanceMap.set(BigInt(EstforConstants.BRONZE_TASSETS), 0n);
      balanceMap.set(BigInt(EstforConstants.BRONZE_GAUNTLETS), 0n);

      // Repeat the test a bunch of times to check the random rewards are as expected
      const numRepeats = 30;
      let numRandomRewardsHitChance1 = 0; // Checks there is some randomness
      for (let i = 0; i < numRepeats; ++i) {
        await players
          .connect(alice)
          .startActions(playerId, [queuedAction, queuedAction], EstforTypes.ActionQueueStrategy.KEEP_LAST_IN_PROGRESS);
        let endTime;
        {
          const actionQueue = await players.getActionQueue(playerId);
          expect(actionQueue.length).to.eq(2);
          endTime =
            (await players.getPlayers(playerId)).currentActionStartTimestamp +
            actionQueue[0].timespan +
            actionQueue[1].timespan;
        }

        expect(await randomnessBeacon.hasRandomWord(endTime)).to.be.false;

        await timeTravel24Hours();
        await players.connect(alice).processActions(playerId);
        for (const [itemTokenId] of balanceMap) {
          expect(await itemNFT.balanceOf(alice, itemTokenId)).to.eq(balanceMap.get(itemTokenId));
        }

        expect((await players.getPendingRandomRewards(playerId)).length).to.eq(2);

        let pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
        expect(pendingQueuedActionState.producedPastRandomRewards.length).to.eq(0);

        await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);

        expect(await randomnessBeacon.hasRandomWord(endTime)).to.be.true;

        pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
        if (pendingQueuedActionState.producedPastRandomRewards.length != 0) {
          expect(pendingQueuedActionState.producedPastRandomRewards.length).to.be.greaterThan(0).and.be.lessThan(9);
          let found = false;
          for (const reward of pendingQueuedActionState.producedPastRandomRewards) {
            balanceMap.set(reward.itemTokenId, balanceMap.get(reward.itemTokenId)! + reward.amount);

            if (Number(reward.itemTokenId) == EstforConstants.BRONZE_ARROW && !found) {
              ++numRandomRewardsHitChance1;
              found = true;
            }
          }
        }
      }
      expect(numRandomRewardsHitChance1).to.be.greaterThan(0).and.to.be.lessThan(numRepeats);

      await timeTravel24Hours();
      await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);
      await players.connect(alice).processActions(playerId);

      let i = 0;
      for (const [itemTokenId] of balanceMap) {
        const randomChanceFraction = randomChanceFractions[i];
        const expectedTotal = numRepeats * randomChanceFraction * numHours;
        // Have 2 queued actions so get twice as much
        expect(balanceMap.get(itemTokenId)).to.be.gte(Math.floor(expectedTotal * 0.65 * 2)); // Within 35% below
        expect(balanceMap.get(itemTokenId)).to.be.lte(Math.floor(expectedTotal * 1.35 * 2)); // Within 35% above
        ++i;
      }
    });

    it("No random rewards, check numPastRandomRewardInstancesToRemove is correct", async function () {
      const {playerId, players, itemNFT, worldActions, randomnessBeacon, alice, mockVRF} = await loadFixture(
        playersFixture
      );

      await itemNFT.addItems([
        {
          ...EstforTypes.defaultItemInput,
          tokenId: EstforConstants.BRONZE_ARROW,
          equipPosition: EstforTypes.EquipPosition.QUIVER
        }
      ]);

      const randomChanceFraction = 0;
      const randomChance = Math.floor(65535 * randomChanceFraction);

      let tx = await worldActions.addActions([
        {
          actionId: 1,
          info: {
            skill: EstforTypes.Skill.THIEVING,
            xpPerHour: 3600,
            minXP: 0,
            worldLocation: 0,
            isFullModeOnly: false,
            numSpawned: 0,
            handItemTokenIdRangeMin: NONE,
            handItemTokenIdRangeMax: NONE,
            isAvailable: actionIsAvailable,
            questPrerequisiteId: 0,
            actionChoiceRequired: false,
            successPercent: 100
          },
          guaranteedRewards: [],
          randomRewards: [{itemTokenId: EstforConstants.BRONZE_ARROW, chance: randomChance, amount: 1}],
          combatStats: EstforTypes.emptyCombatStats
        }
      ]);

      const actionId = await getActionId(tx, worldActions);
      const numHours = 4;

      // Make sure it passes the next checkpoint so there are no issues running
      const {timestamp} = (await ethers.provider.getBlock("latest")) as Block;
      const nextCheckpoint = Math.floor(timestamp / 86400) * 86400 + 86400;
      const durationToNextCheckpoint = nextCheckpoint - timestamp + 1;
      await ethers.provider.send("evm_increaseTime", [durationToNextCheckpoint]);
      await ethers.provider.send("evm_mine", []);

      await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);
      await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);

      const queuedAction: EstforTypes.QueuedActionInput = {
        attire: EstforTypes.noAttire,
        actionId,
        combatStyle: EstforTypes.CombatStyle.NONE,
        choiceId: EstforConstants.NONE,
        regenerateId: EstforConstants.NONE,
        timespan: 3600 * numHours,
        rightHandEquipmentTokenId: EstforConstants.NONE,
        leftHandEquipmentTokenId: EstforConstants.NONE,
        petId: EstforConstants.NONE
      };

      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.NONE);
      await ethers.provider.send("evm_increaseTime", [3600 * 1]);
      await ethers.provider.send("evm_mine", []);
      let pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
      expect(pendingQueuedActionState.actionMetadatas[0].rolls).to.eq(1); // Should have a roll
      await players.connect(alice).processActions(playerId);
      await ethers.provider.send("evm_increaseTime", [3600 * 2]);
      await ethers.provider.send("evm_mine", []);
      pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
      expect(pendingQueuedActionState.actionMetadatas[0].rolls).to.eq(2); // Should have a roll
      await players.connect(alice).processActions(playerId);
      await ethers.provider.send("evm_increaseTime", [3600 * 1]);
      await ethers.provider.send("evm_mine", []);
      pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
      expect(pendingQueuedActionState.actionMetadatas[0].rolls).to.eq(1); // Should have a roll
      await players.connect(alice).processActions(playerId);
      await ethers.provider.send("evm_increaseTime", [3600 * 24]);
      await ethers.provider.send("evm_mine", []);
      await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);
      pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
      expect(pendingQueuedActionState.producedPastRandomRewards.length).to.eq(0);
      expect(pendingQueuedActionState.numPastRandomRewardInstancesToRemove).to.eq(3);
    });

    it("Mixing thieving and combat random rolls (thieving, combat, thieving), after 00:00 before oracle is called", async function () {
      // Thieving ends 19:00, Combat ends 20:00, Thieving ends 23:00. Looted at 00:01 before oracle. Dice given for thieving 19:00, dice given for combat 20:00, dice given for thieving 23:00
      const {playerId, players, itemNFT, worldActions, randomnessBeacon, alice, mockVRF} = await loadFixture(
        playersFixture
      );

      const {queuedAction, numSpawned, combatAction} = await setupBasicMeleeCombat(itemNFT, worldActions);
      const queuedActionCombat = {...queuedAction, timespan: 3600};

      const randomChanceFraction = 1;
      const randomChance = Math.floor(65535 * randomChanceFraction);

      await worldActions.editActions([
        {
          ...combatAction,
          guaranteedRewards: [],
          randomRewards: [{itemTokenId: EstforConstants.POISON, chance: randomChance, amount: 1}]
        }
      ]);

      await worldActions.addActions([
        {
          actionId: EstforConstants.ACTION_THIEVING_CHILD,
          info: {
            skill: EstforTypes.Skill.THIEVING,
            xpPerHour: 3600,
            minXP: 0,
            worldLocation: 0,
            isFullModeOnly: false,
            numSpawned: 0,
            handItemTokenIdRangeMin: NONE,
            handItemTokenIdRangeMax: NONE,
            isAvailable: actionIsAvailable,
            questPrerequisiteId: 0,
            actionChoiceRequired: false,
            successPercent: 100
          },
          guaranteedRewards: [],
          randomRewards: [{itemTokenId: EstforConstants.BRONZE_ARROW, chance: randomChance, amount: 1}],
          combatStats: EstforTypes.emptyCombatStats
        }
      ]);

      // Make sure it passes the next checkpoint so there are no issues running
      const {timestamp} = (await ethers.provider.getBlock("latest")) as Block;
      const nextCheckpoint = Math.floor(timestamp / 86400) * 86400 + 86400;
      await ethers.provider.send("evm_setNextBlockTimestamp", [nextCheckpoint + 1]);
      await ethers.provider.send("evm_mine", []);

      await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);
      await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);

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
        petId: EstforConstants.NONE
      };

      const secondThievingNumHours = 3;

      const queuedActionThieving2 = {
        ...queuedActionThieving,
        timespan: 3600 * secondThievingNumHours
      };

      await players
        .connect(alice)
        .startActions(
          playerId,
          [queuedActionThieving, queuedActionCombat, queuedActionThieving2],
          EstforTypes.ActionQueueStrategy.NONE
        );
      await ethers.provider.send("evm_increaseTime", [3600 * 24]);
      await ethers.provider.send("evm_mine", []);
      let pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);

      expect(pendingQueuedActionState.actionMetadatas.length).to.eq(3);
      // Should have rolls for each of these
      expect(pendingQueuedActionState.actionMetadatas[0].rolls).to.eq(19);
      expect(pendingQueuedActionState.actionMetadatas[1].rolls).to.eq(numSpawned / SPAWN_MUL);
      expect(pendingQueuedActionState.actionMetadatas[2].rolls).to.eq(3);
      await players.connect(alice).processActions(playerId);

      await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);

      pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
      expect(pendingQueuedActionState.producedPastRandomRewards.length).to.eq(3);
      expect(pendingQueuedActionState.producedPastRandomRewards[0].itemTokenId).to.eq(EstforConstants.BRONZE_ARROW);
      expect(pendingQueuedActionState.producedPastRandomRewards[0].amount).to.eq(firstThievingNumHours);
      expect(pendingQueuedActionState.producedPastRandomRewards[1].itemTokenId).to.eq(EstforConstants.POISON);
      expect(pendingQueuedActionState.producedPastRandomRewards[1].amount).to.eq(numSpawned / SPAWN_MUL);
      expect(pendingQueuedActionState.producedPastRandomRewards[2].itemTokenId).to.eq(EstforConstants.BRONZE_ARROW);
      expect(pendingQueuedActionState.producedPastRandomRewards[2].amount).to.eq(secondThievingNumHours);

      await players.connect(alice).processActions(playerId);

      expect(await itemNFT.balanceOfs(alice, [EstforConstants.BRONZE_ARROW, EstforConstants.POISON])).to.deep.eq([
        firstThievingNumHours + secondThievingNumHours,
        numSpawned / SPAWN_MUL
      ]);
    });

    it("Mixing thieving and combat random rolls (thieving, combat, thieving), after 00:00 before oracle is called, process after", async function () {
      // Thieving ends 19:00, Combat ends 20:00, Thieving ends 23:00. Looted at 00:01 before oracle. Dice given for thieving 19:00, dice given for combat 00:01, dice given for thieving 23:00
      const {playerId, players, itemNFT, worldActions, randomnessBeacon, alice, mockVRF} = await loadFixture(
        playersFixture
      );

      const {queuedAction, numSpawned, combatAction} = await setupBasicMeleeCombat(itemNFT, worldActions);
      const queuedActionCombat = {...queuedAction, timespan: 3600};

      const randomChanceFraction = 1;
      const randomChance = Math.floor(65535 * randomChanceFraction);

      await worldActions.editActions([
        {
          ...combatAction,
          guaranteedRewards: [],
          randomRewards: [{itemTokenId: EstforConstants.POISON, chance: randomChance, amount: 1}]
        }
      ]);

      await worldActions.addActions([
        {
          actionId: EstforConstants.ACTION_THIEVING_CHILD,
          info: {
            skill: EstforTypes.Skill.THIEVING,
            xpPerHour: 3600,
            minXP: 0,
            worldLocation: 0,
            isFullModeOnly: false,
            numSpawned: 0,
            handItemTokenIdRangeMin: NONE,
            handItemTokenIdRangeMax: NONE,
            isAvailable: actionIsAvailable,
            questPrerequisiteId: 0,
            actionChoiceRequired: false,
            successPercent: 100
          },
          guaranteedRewards: [],
          randomRewards: [{itemTokenId: EstforConstants.BRONZE_ARROW, chance: randomChance, amount: 1}],
          combatStats: EstforTypes.emptyCombatStats
        }
      ]);

      // Make sure it passes the next checkpoint so there are no issues running
      const {timestamp} = (await ethers.provider.getBlock("latest")) as Block;
      const nextCheckpoint = Math.floor(timestamp / 86400) * 86400 + 86400;
      await ethers.provider.send("evm_setNextBlockTimestamp", [nextCheckpoint + 1]);
      await ethers.provider.send("evm_mine", []);

      await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);
      await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);

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
        petId: EstforConstants.NONE
      };

      const secondThievingNumHours = 3;

      const queuedActionThieving2 = {
        ...queuedActionThieving,
        timespan: 3600 * secondThievingNumHours
      };

      await players
        .connect(alice)
        .startActions(
          playerId,
          [queuedActionThieving, queuedActionCombat, queuedActionThieving2],
          EstforTypes.ActionQueueStrategy.NONE
        );
      await ethers.provider.send("evm_increaseTime", [3600 * 24]);
      await ethers.provider.send("evm_mine", []);
      let pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);

      expect(pendingQueuedActionState.actionMetadatas.length).to.eq(3);
      // Should have rolls for each of these
      expect(pendingQueuedActionState.actionMetadatas[0].rolls).to.eq(19);
      expect(pendingQueuedActionState.actionMetadatas[1].rolls).to.eq(numSpawned / SPAWN_MUL);
      expect(pendingQueuedActionState.actionMetadatas[2].rolls).to.eq(3);

      await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);
      await players.connect(alice).processActions(playerId);

      pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
      expect(pendingQueuedActionState.producedPastRandomRewards.length).to.eq(0);

      await ethers.provider.send("evm_increaseTime", [3600 * 24]);
      await ethers.provider.send("evm_mine", []);
      await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);

      // Now combat works
      pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
      expect(pendingQueuedActionState.producedPastRandomRewards.length).to.eq(1);

      expect(pendingQueuedActionState.producedPastRandomRewards[0].itemTokenId).to.eq(EstforConstants.POISON);
      expect(pendingQueuedActionState.producedPastRandomRewards[0].amount).to.eq(numSpawned / SPAWN_MUL);

      await players.connect(alice).processActions(playerId);

      expect(await itemNFT.balanceOfs(alice, [EstforConstants.BRONZE_ARROW, EstforConstants.POISON])).to.deep.eq([
        firstThievingNumHours + secondThievingNumHours,
        numSpawned / SPAWN_MUL
      ]);
    });

    it("Mixing thieving and combat random rolls (thieving, combat, thieving) after oracle is called", async function () {
      // Thieving ends 19:00, Combat ends 20:00, Thieving ends 22:00. Looted at 00:02 (or whenever) after oracle is called. Loot given for thieving 19:00, dice given for combat 00:02, loot given for thieving 23:00
      const {playerId, players, itemNFT, worldActions, randomnessBeacon, alice, mockVRF} = await loadFixture(
        playersFixture
      );

      const {queuedAction, numSpawned, combatAction} = await setupBasicMeleeCombat(itemNFT, worldActions);
      const queuedActionCombat = {...queuedAction, timespan: 3600};

      const randomChanceFraction = 1;
      const randomChance = Math.floor(65535 * randomChanceFraction);

      await worldActions.editActions([
        {
          ...combatAction,
          guaranteedRewards: [],
          randomRewards: [{itemTokenId: EstforConstants.POISON, chance: randomChance, amount: 1}]
        }
      ]);

      await worldActions.addActions([
        {
          actionId: EstforConstants.ACTION_THIEVING_CHILD,
          info: {
            skill: EstforTypes.Skill.THIEVING,
            xpPerHour: 3600,
            minXP: 0,
            worldLocation: 0,
            isFullModeOnly: false,
            numSpawned: 0,
            handItemTokenIdRangeMin: NONE,
            handItemTokenIdRangeMax: NONE,
            isAvailable: actionIsAvailable,
            questPrerequisiteId: 0,
            actionChoiceRequired: false,
            successPercent: 100
          },
          guaranteedRewards: [],
          randomRewards: [{itemTokenId: EstforConstants.BRONZE_ARROW, chance: randomChance, amount: 1}],
          combatStats: EstforTypes.emptyCombatStats
        }
      ]);

      // Make sure it passes the next checkpoint so there are no issues running
      const {timestamp} = (await ethers.provider.getBlock("latest")) as Block;
      const nextCheckpoint = Math.floor(timestamp / 86400) * 86400 + 86400;
      await ethers.provider.send("evm_setNextBlockTimestamp", [nextCheckpoint + 1]);
      await ethers.provider.send("evm_mine", []);

      await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);
      await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);

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
        petId: EstforConstants.NONE
      };

      const secondThievingNumHours = 3;

      const queuedActionThieving2 = {
        ...queuedActionThieving,
        timespan: 3600 * secondThievingNumHours
      };

      await players
        .connect(alice)
        .startActions(
          playerId,
          [queuedActionThieving, queuedActionCombat, queuedActionThieving2],
          EstforTypes.ActionQueueStrategy.NONE
        );
      await ethers.provider.send("evm_increaseTime", [3600 * 24]);
      await ethers.provider.send("evm_mine", []);

      await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);

      let pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
      expect(pendingQueuedActionState.producedPastRandomRewards.length).to.eq(2);
      expect(pendingQueuedActionState.producedPastRandomRewards[0].itemTokenId).to.eq(EstforConstants.BRONZE_ARROW);
      expect(pendingQueuedActionState.producedPastRandomRewards[0].amount).to.eq(firstThievingNumHours);
      expect(pendingQueuedActionState.producedPastRandomRewards[1].itemTokenId).to.eq(EstforConstants.BRONZE_ARROW);
      expect(pendingQueuedActionState.producedPastRandomRewards[1].amount).to.eq(secondThievingNumHours);

      await players.connect(alice).processActions(playerId);
      // Now combat can be unlocked
      await ethers.provider.send("evm_increaseTime", [3600 * 24]);
      await ethers.provider.send("evm_mine", []);
      await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);

      pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
      expect(pendingQueuedActionState.producedPastRandomRewards.length).to.eq(1);
      expect(pendingQueuedActionState.producedPastRandomRewards[0].itemTokenId).to.eq(EstforConstants.POISON);
      expect(pendingQueuedActionState.producedPastRandomRewards[0].amount).to.eq(numSpawned / SPAWN_MUL);

      await players.connect(alice).processActions(playerId);

      expect(await itemNFT.balanceOfs(alice, [EstforConstants.BRONZE_ARROW, EstforConstants.POISON])).to.deep.eq([
        firstThievingNumHours + secondThievingNumHours,
        numSpawned / SPAWN_MUL
      ]);
    });

    it("Mixing thieving and combat random rolls (thieving, combat, thieving) looting before 00:00", async function () {
      // Thieving ends 19:00, Combat ends 20:00, Thieving ends 23:00. Looted at 23:59(or whenever). Loot given for thieving 19:00, combat 20:00 & thieving 23:00
      const {playerId, players, itemNFT, worldActions, randomnessBeacon, alice, mockVRF} = await loadFixture(
        playersFixture
      );

      const {queuedAction, numSpawned, combatAction} = await setupBasicMeleeCombat(itemNFT, worldActions);
      const queuedActionCombat = {...queuedAction, timespan: 3600};

      const randomChanceFraction = 1;
      const randomChance = Math.floor(65535 * randomChanceFraction);

      await worldActions.editActions([
        {
          ...combatAction,
          guaranteedRewards: [],
          randomRewards: [{itemTokenId: EstforConstants.POISON, chance: randomChance, amount: 1}]
        }
      ]);

      await worldActions.addActions([
        {
          actionId: EstforConstants.ACTION_THIEVING_CHILD,
          info: {
            skill: EstforTypes.Skill.THIEVING,
            xpPerHour: 3600,
            minXP: 0,
            worldLocation: 0,
            isFullModeOnly: false,
            numSpawned: 0,
            handItemTokenIdRangeMin: NONE,
            handItemTokenIdRangeMax: NONE,
            isAvailable: actionIsAvailable,
            questPrerequisiteId: 0,
            actionChoiceRequired: false,
            successPercent: 100
          },
          guaranteedRewards: [],
          randomRewards: [{itemTokenId: EstforConstants.BRONZE_ARROW, chance: randomChance, amount: 1}],
          combatStats: EstforTypes.emptyCombatStats
        }
      ]);

      // Make sure it passes the next checkpoint so there are no issues running
      const {timestamp} = (await ethers.provider.getBlock("latest")) as Block;
      const nextCheckpoint = Math.floor(timestamp / 86400) * 86400 + 86400;
      await ethers.provider.send("evm_setNextBlockTimestamp", [nextCheckpoint + 1]);
      await ethers.provider.send("evm_mine", []);

      await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);
      await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);

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
        petId: EstforConstants.NONE
      };

      const secondThievingNumHours = 3;

      const queuedActionThieving2 = {
        ...queuedActionThieving,
        timespan: 3600 * secondThievingNumHours
      };

      await players
        .connect(alice)
        .startActions(
          playerId,
          [queuedActionThieving, queuedActionCombat, queuedActionThieving2],
          EstforTypes.ActionQueueStrategy.NONE
        );
      await ethers.provider.send("evm_increaseTime", [3600 * 23 + 1]); // Have not passed 00:00 yet
      await ethers.provider.send("evm_mine", []);
      let pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
      expect(pendingQueuedActionState.actionMetadatas.length).to.eq(3);
      expect(pendingQueuedActionState.actionMetadatas[0].rolls).to.eq(19);
      expect(pendingQueuedActionState.actionMetadatas[1].rolls).to.eq(numSpawned / SPAWN_MUL);
      expect(pendingQueuedActionState.actionMetadatas[2].rolls).to.eq(3);

      await players.connect(alice).processActions(playerId);

      await expect(randomnessBeacon.requestRandomWords()).to.be.revertedWithCustomError(
        randomnessBeacon,
        "CanOnlyRequestAfterTheNextCheckpoint"
      );

      pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
      expect(pendingQueuedActionState.producedPastRandomRewards.length).to.eq(0);

      await ethers.provider.send("evm_increaseTime", [3600]); // Have now passed 3600
      await ethers.provider.send("evm_mine", []);

      pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
      expect(pendingQueuedActionState.producedPastRandomRewards.length).to.eq(0);
      await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);

      pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
      expect(pendingQueuedActionState.producedPastRandomRewards.length).to.eq(3);
      expect(pendingQueuedActionState.producedPastRandomRewards[0].itemTokenId).to.eq(EstforConstants.BRONZE_ARROW);
      expect(pendingQueuedActionState.producedPastRandomRewards[0].amount).to.eq(firstThievingNumHours);
      expect(pendingQueuedActionState.producedPastRandomRewards[1].itemTokenId).to.eq(EstforConstants.POISON);
      expect(pendingQueuedActionState.producedPastRandomRewards[1].amount).to.eq(numSpawned / SPAWN_MUL);
      expect(pendingQueuedActionState.producedPastRandomRewards[2].itemTokenId).to.eq(EstforConstants.BRONZE_ARROW);
      expect(pendingQueuedActionState.producedPastRandomRewards[2].amount).to.eq(secondThievingNumHours);

      await players.connect(alice).processActions(playerId);

      expect(await itemNFT.balanceOfs(alice, [EstforConstants.BRONZE_ARROW, EstforConstants.POISON])).to.deep.eq([
        firstThievingNumHours + secondThievingNumHours,
        numSpawned / SPAWN_MUL
      ]);
    });

    it("Mixing thieving and combat random rolls (combat, combat, thieving) looting after 00:00 but before oracle is called", async function () {
      // Combat ends 19:00, Combat ends 20:00, Thieving ends 23:00. Looted at 00:01 before oracle. Dice given for combat 19:00, dice given for combat 20:00, dice given for thieving 23:00
      const {playerId, players, itemNFT, worldActions, randomnessBeacon, alice, mockVRF} = await loadFixture(
        playersFixture
      );

      const {queuedAction, numSpawned, combatAction} = await setupBasicMeleeCombat(itemNFT, worldActions);

      const randomChanceFraction = 1;
      const randomChance = Math.floor(65535 * randomChanceFraction);

      await worldActions.editActions([
        {
          ...combatAction,
          guaranteedRewards: [],
          randomRewards: [{itemTokenId: EstforConstants.POISON, chance: randomChance, amount: 1}]
        }
      ]);

      await worldActions.addActions([
        {
          actionId: EstforConstants.ACTION_THIEVING_CHILD,
          info: {
            skill: EstforTypes.Skill.THIEVING,
            xpPerHour: 3600,
            minXP: 0,
            worldLocation: 0,
            isFullModeOnly: false,
            numSpawned: 0,
            handItemTokenIdRangeMin: NONE,
            handItemTokenIdRangeMax: NONE,
            isAvailable: actionIsAvailable,
            questPrerequisiteId: 0,
            actionChoiceRequired: false,
            successPercent: 100
          },
          guaranteedRewards: [],
          randomRewards: [{itemTokenId: EstforConstants.BRONZE_ARROW, chance: randomChance, amount: 1}],
          combatStats: EstforTypes.emptyCombatStats
        }
      ]);

      // Make sure it passes the next checkpoint so there are no issues running
      const {timestamp} = (await ethers.provider.getBlock("latest")) as Block;
      const nextCheckpoint = Math.floor(timestamp / 86400) * 86400 + 86400;
      await ethers.provider.send("evm_setNextBlockTimestamp", [nextCheckpoint + 1]);
      await ethers.provider.send("evm_mine", []);

      await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);
      await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);

      const firstCombatNumHours = 19; // start at 19:00
      const queuedActionCombat = {...queuedAction, timespan: 3600 * firstCombatNumHours};

      const secondCombatNumHours = 1;
      const queuedActionCombat2 = {
        ...queuedActionCombat,
        timespan: 3600 * secondCombatNumHours
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
        petId: EstforConstants.NONE
      };

      await players
        .connect(alice)
        .startActions(
          playerId,
          [queuedActionCombat, queuedActionCombat2, queuedActionThieving],
          EstforTypes.ActionQueueStrategy.NONE
        );
      await ethers.provider.send("evm_increaseTime", [3600 * 24]);
      await ethers.provider.send("evm_mine", []);
      let pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);

      expect(pendingQueuedActionState.actionMetadatas.length).to.eq(3);
      // Should have rolls for each of these
      expect(pendingQueuedActionState.actionMetadatas[0].rolls).to.eq((firstCombatNumHours * numSpawned) / SPAWN_MUL);
      expect(pendingQueuedActionState.actionMetadatas[1].rolls).to.eq((secondCombatNumHours * numSpawned) / SPAWN_MUL);
      expect(pendingQueuedActionState.actionMetadatas[2].rolls).to.eq(thievingNumHours);
      await players.connect(alice).processActions(playerId);

      await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);

      pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
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

      expect(await itemNFT.balanceOfs(alice, [EstforConstants.BRONZE_ARROW, EstforConstants.POISON])).to.deep.eq([
        thievingNumHours,
        ((firstCombatNumHours + secondCombatNumHours) * numSpawned) / SPAWN_MUL
      ]);
    });

    it("Mixing combat/thieving over 48 hours, when queueing combat & thieving, then thieving in another 24 hours after first calling oracle.", async function () {
      // Combat starts 00:01 and ends 01:01, thieving ends 00:01 the following day. Looted at 00:02 after oracle by starting a new 24 hour thieving action
      const {playerId, players, itemNFT, worldActions, randomnessBeacon, alice, mockVRF} = await loadFixture(
        playersFixture
      );

      const {queuedAction, numSpawned, combatAction} = await setupBasicMeleeCombat(itemNFT, worldActions);

      const randomChanceFraction = 1;
      const randomChance = Math.floor(65535 * randomChanceFraction);

      await worldActions.editActions([
        {
          ...combatAction,
          guaranteedRewards: [],
          randomRewards: [{itemTokenId: EstforConstants.POISON, chance: randomChance, amount: 1}]
        }
      ]);

      await worldActions.addActions([
        {
          actionId: EstforConstants.ACTION_THIEVING_CHILD,
          info: {
            skill: EstforTypes.Skill.THIEVING,
            xpPerHour: 3600,
            minXP: 0,
            worldLocation: 0,
            isFullModeOnly: false,
            numSpawned: 0,
            handItemTokenIdRangeMin: NONE,
            handItemTokenIdRangeMax: NONE,
            isAvailable: actionIsAvailable,
            questPrerequisiteId: 0,
            actionChoiceRequired: false,
            successPercent: 100
          },
          guaranteedRewards: [],
          randomRewards: [{itemTokenId: EstforConstants.BRONZE_ARROW, chance: randomChance, amount: 1}],
          combatStats: EstforTypes.emptyCombatStats
        }
      ]);

      // Make sure it passes the next checkpoint so there are no issues running
      const {timestamp} = (await ethers.provider.getBlock("latest")) as Block;
      const nextCheckpoint = Math.floor(timestamp / 86400) * 86400 + 86400;
      await ethers.provider.send("evm_setNextBlockTimestamp", [nextCheckpoint + 1]);
      await ethers.provider.send("evm_mine", []);

      await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);
      await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);

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
        petId: EstforConstants.NONE
      };

      const secondThievingNumHours = 24; // ends at 00:001 the day after
      const queuedActionThieving2 = {
        ...queuedActionThieving,
        timespan: 3600 * secondThievingNumHours
      };

      await players
        .connect(alice)
        .startActions(playerId, [queuedActionCombat, queuedActionThieving], EstforTypes.ActionQueueStrategy.NONE);
      await ethers.provider.send("evm_increaseTime", [3600 * 24]); // Go another hour past the 24
      await ethers.provider.send("evm_mine", []);

      let pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
      expect(pendingQueuedActionState.actionMetadatas.length).to.eq(2);
      expect(pendingQueuedActionState.actionMetadatas[0].rolls).to.eq((combatNumHours * numSpawned) / SPAWN_MUL);
      expect(pendingQueuedActionState.actionMetadatas[1].rolls).to.eq(thievingNumHours);

      await players
        .connect(alice)
        .startActions(playerId, [queuedActionThieving2], EstforTypes.ActionQueueStrategy.NONE);
      await ethers.provider.send("evm_increaseTime", [3600 * 48]); // Go another hour past the 24
      await ethers.provider.send("evm_mine", []);

      pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
      expect(pendingQueuedActionState.actionMetadatas.length).to.eq(1);
      expect(pendingQueuedActionState.actionMetadatas[0].rolls).to.eq(secondThievingNumHours);

      await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);
      await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);
      await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);

      pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
      expect(pendingQueuedActionState.producedPastRandomRewards.length).to.eq(3);
      expect(pendingQueuedActionState.producedPastRandomRewards[0].amount).to.eq(
        (combatNumHours * numSpawned) / SPAWN_MUL
      );
      expect(pendingQueuedActionState.producedPastRandomRewards[1].amount).to.eq(thievingNumHours);
      expect(pendingQueuedActionState.producedPastRandomRewards[2].amount).to.eq(secondThievingNumHours);

      await players.connect(alice).processActions(playerId);

      expect(await itemNFT.balanceOfs(alice, [EstforConstants.BRONZE_ARROW, EstforConstants.POISON])).to.deep.eq([
        thievingNumHours + secondThievingNumHours,
        (combatNumHours * numSpawned) / SPAWN_MUL
      ]);
    });

    it("Mixing thieving and combat random rolls (combat, thieving) looting after 00:00, before oracle is called", async function () {
      // Combat ends 19:00, Thieving ends 22:00. Looted at 00:01 before oracle. Dice given for combat 19:00, dice given for thieving 22:00
      const {playerId, players, itemNFT, worldActions, randomnessBeacon, alice, mockVRF} = await loadFixture(
        playersFixture
      );

      const {queuedAction, numSpawned, combatAction} = await setupBasicMeleeCombat(itemNFT, worldActions);

      const randomChanceFraction = 1;
      const randomChance = Math.floor(65535 * randomChanceFraction);

      await worldActions.editActions([
        {
          ...combatAction,
          guaranteedRewards: [],
          randomRewards: [{itemTokenId: EstforConstants.POISON, chance: randomChance, amount: 1}]
        }
      ]);

      await worldActions.addActions([
        {
          actionId: EstforConstants.ACTION_THIEVING_CHILD,
          info: {
            skill: EstforTypes.Skill.THIEVING,
            xpPerHour: 3600,
            minXP: 0,
            worldLocation: 0,
            isFullModeOnly: false,
            numSpawned: 0,
            handItemTokenIdRangeMin: NONE,
            handItemTokenIdRangeMax: NONE,
            isAvailable: actionIsAvailable,
            questPrerequisiteId: 0,
            actionChoiceRequired: false,
            successPercent: 100
          },
          guaranteedRewards: [],
          randomRewards: [{itemTokenId: EstforConstants.BRONZE_ARROW, chance: randomChance, amount: 1}],
          combatStats: EstforTypes.emptyCombatStats
        }
      ]);

      // Make sure it passes the next checkpoint so there are no issues running
      const {timestamp} = (await ethers.provider.getBlock("latest")) as Block;
      const nextCheckpoint = Math.floor(timestamp / 86400) * 86400 + 86400;
      await ethers.provider.send("evm_setNextBlockTimestamp", [nextCheckpoint + 1]);
      await ethers.provider.send("evm_mine", []);

      await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);
      await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);

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
        petId: EstforConstants.NONE
      };

      await players
        .connect(alice)
        .startActions(playerId, [queuedActionCombat, queuedActionThieving], EstforTypes.ActionQueueStrategy.NONE);
      await ethers.provider.send("evm_increaseTime", [3600 * 24]);
      await ethers.provider.send("evm_mine", []);
      let pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);

      expect(pendingQueuedActionState.actionMetadatas.length).to.eq(2);
      // Should have rolls for each of these
      expect(pendingQueuedActionState.actionMetadatas[0].rolls).to.eq((combatNumHours * numSpawned) / SPAWN_MUL);
      expect(pendingQueuedActionState.actionMetadatas[1].rolls).to.eq(thievingNumHours);
      await players.connect(alice).processActions(playerId);

      await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);

      pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
      expect(pendingQueuedActionState.producedPastRandomRewards.length).to.eq(2);
      expect(pendingQueuedActionState.producedPastRandomRewards[0].itemTokenId).to.eq(EstforConstants.POISON);
      expect(pendingQueuedActionState.producedPastRandomRewards[0].amount).to.eq(
        (combatNumHours * numSpawned) / SPAWN_MUL
      );
      expect(pendingQueuedActionState.producedPastRandomRewards[1].itemTokenId).to.eq(EstforConstants.BRONZE_ARROW);
      expect(pendingQueuedActionState.producedPastRandomRewards[1].amount).to.eq(thievingNumHours);

      await players.connect(alice).processActions(playerId);

      expect(await itemNFT.balanceOfs(alice, [EstforConstants.BRONZE_ARROW, EstforConstants.POISON])).to.deep.eq([
        thievingNumHours,
        (combatNumHours * numSpawned) / SPAWN_MUL
      ]);
    });

    it("Multiple random rewards", async function () {
      const {playerId, players, itemNFT, worldActions, randomnessBeacon, alice, mockVRF} = await loadFixture(
        playersFixture
      );

      this.timeout(100000); // 100 seconds, this test can take a while on CI

      await itemNFT.addItems([
        {
          ...EstforTypes.defaultItemInput,
          tokenId: EstforConstants.BRONZE_AXE,
          equipPosition: EstforTypes.EquipPosition.RIGHT_HAND
        },
        {
          ...EstforTypes.defaultItemInput,
          tokenId: EstforConstants.BRONZE_ARROW,
          equipPosition: EstforTypes.EquipPosition.QUIVER
        }
      ]);

      const randomChanceFractions = [99.9 / 100, 10.0 / 100]; // 99.9%, 10%
      const randomChance = Math.floor(65535 * randomChanceFractions[0]);
      const randomChance1 = Math.floor(65535 * randomChanceFractions[1]);

      let tx = await worldActions.addActions([
        {
          actionId: 1,
          info: {
            skill: EstforTypes.Skill.THIEVING,
            xpPerHour: 3600,
            minXP: 0,
            worldLocation: 0,
            isFullModeOnly: false,
            numSpawned: 0,
            handItemTokenIdRangeMin: NONE,
            handItemTokenIdRangeMax: NONE,
            isAvailable: actionIsAvailable,
            questPrerequisiteId: 0,
            actionChoiceRequired: false,
            successPercent: 100
          },
          guaranteedRewards: [],
          randomRewards: [
            {itemTokenId: EstforConstants.BRONZE_BAR, chance: randomChance, amount: 1},
            {itemTokenId: EstforConstants.BRONZE_ARROW, chance: randomChance1, amount: 1}
          ],
          combatStats: EstforTypes.emptyCombatStats
        }
      ]);

      const actionId = await getActionId(tx, worldActions);
      const numHours = 23;

      await timeTravelToNextCheckpoint();
      await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);
      await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);

      const queuedAction: EstforTypes.QueuedActionInput = {
        attire: EstforTypes.noAttire,
        actionId,
        combatStyle: EstforTypes.CombatStyle.NONE,
        choiceId: EstforConstants.NONE,
        regenerateId: EstforConstants.NONE,
        timespan: 3600 * numHours,
        rightHandEquipmentTokenId: EstforConstants.NONE,
        leftHandEquipmentTokenId: EstforConstants.NONE,
        petId: EstforConstants.NONE
      };

      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.NONE);

      await timeTravel24Hours();

      await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);
      const pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
      expect(pendingQueuedActionState.producedPastRandomRewards.length).to.eq(2);
    });

    it("PendingRandomRewards should be added each time an action is processed", async function () {
      const {playerId, players, worldActions, randomnessBeacon, alice, mockVRF} = await loadFixture(playersFixture);

      const randomChance = 65535; // 100%
      let tx = await worldActions.addActions([
        {
          actionId: 1,
          info: {
            skill: EstforTypes.Skill.THIEVING,
            xpPerHour: 3600,
            minXP: 0,
            worldLocation: 0,
            isFullModeOnly: false,
            numSpawned: 0,
            handItemTokenIdRangeMin: EstforConstants.NONE,
            handItemTokenIdRangeMax: EstforConstants.NONE,
            isAvailable: actionIsAvailable,
            questPrerequisiteId: 0,
            actionChoiceRequired: false,
            successPercent: 100
          },
          guaranteedRewards: [],
          randomRewards: [{itemTokenId: EstforConstants.BRONZE_ARROW, chance: randomChance, amount: 1}],
          combatStats: emptyCombatStats
        }
      ]);
      const actionId = await getActionId(tx, worldActions);
      const numHours = 5;

      // Set it 2 hours before the next checkpoint so that we can cross the boundary
      await timeTravelToNextCheckpoint();

      await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);
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
        petId: EstforConstants.NONE
      };

      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.NONE);

      await ethers.provider.send("evm_increaseTime", [3600 + 60]); // 1 hour 1 minute
      await ethers.provider.send("evm_mine", []);
      let pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
      expect(pendingQueuedActionState.equipmentStates[0].producedItemTokenIds.length).to.eq(0);
      expect(pendingQueuedActionState.actionMetadatas[0].rolls).to.eq(1); // Should have a roll
      await players.connect(alice).processActions(playerId); // Continues the action
      let pendingRandomRewards = await players.getPendingRandomRewards(playerId);
      expect(pendingRandomRewards.length).to.eq(1);
      expect(pendingRandomRewards[0].xpElapsedTime).to.eq(3600);
      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]); // Finished
      await ethers.provider.send("evm_mine", []);
      pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
      expect(pendingQueuedActionState.actionMetadatas[0].rolls).to.eq(numHours - 1);
      await players.connect(alice).processActions(playerId); // Finishes the action
      pendingRandomRewards = await players.getPendingRandomRewards(playerId);
      expect(pendingRandomRewards.length).to.eq(2); // Should now get the other pending random rewards
      expect(pendingRandomRewards[1].xpElapsedTime).to.eq(timespan - 3600);
    });

    it("Check random bytes", async function () {
      const {playerId, randomnessBeacon, mockVRF} = await loadFixture(playersFixture);
      const {timestamp} = (await ethers.provider.getBlock("latest")) as Block;
      let numTickets = 16;
      await expect(randomnessBeacon.getRandomBytes(numTickets, timestamp, timestamp - 86400, playerId)).to.be.reverted;
      await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);
      let randomBytes = await randomnessBeacon.getRandomBytes(numTickets, timestamp, timestamp - 86400, playerId);
      expect(ethers.getBytes(randomBytes).length).to.be.eq(32);
      numTickets = MAX_UNIQUE_TICKETS;

      randomBytes = await randomnessBeacon.getRandomBytes(numTickets, timestamp, timestamp - 86400, playerId);
      expect(ethers.getBytes(randomBytes).length).to.be.eq(32 * 4);

      numTickets = MAX_UNIQUE_TICKETS + 1;
      await expect(randomnessBeacon.getRandomBytes(numTickets, timestamp, timestamp - 86400, playerId)).to.be.reverted;
    });

    it("Check past random rewards which are claimed the following day don't cause issues (many)", async function () {
      const {playerId, players, worldActions, randomnessBeacon, alice, mockVRF} = await loadFixture(playersFixture);

      const randomChance = 32000; // 50%
      let tx = await worldActions.addActions([
        {
          actionId: ACTION_THIEVING_CHILD,
          info: {
            skill: EstforTypes.Skill.THIEVING,
            xpPerHour: 3600,
            minXP: 0,
            worldLocation: 0,
            isFullModeOnly: false,
            numSpawned: 0,
            handItemTokenIdRangeMin: EstforConstants.NONE,
            handItemTokenIdRangeMax: EstforConstants.NONE,
            isAvailable: actionIsAvailable,
            questPrerequisiteId: 0,
            actionChoiceRequired: false,
            successPercent: 100
          },
          guaranteedRewards: [],
          randomRewards: [{itemTokenId: EstforConstants.LOG, chance: randomChance, amount: 255}],
          combatStats: emptyCombatStats
        }
      ]);
      const actionId = await getActionId(tx, worldActions);

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
        petId: EstforConstants.NONE
      };

      await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);

      // Try many times as we are relying on random chance
      for (let i = 0; i < 20; ++i) {
        // Start the following day to keep things organised
        const {timestamp} = (await ethers.provider.getBlock("latest")) as Block;
        const nextCheckpoint = Math.floor(timestamp / 86400) * 86400 + 86400 * 2;
        const durationToNextCheckpoint = nextCheckpoint - timestamp - (3 * 3600 + 10 + Math.floor(Math.random() * 10)); // 3 hours before the next checkpoint
        await ethers.provider.send("evm_increaseTime", [durationToNextCheckpoint]);
        await ethers.provider.send("evm_mine", []);
        await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);
        await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.NONE);
        await ethers.provider.send("evm_increaseTime", [7200 + 4]);
        await ethers.provider.send("evm_mine", []);
        await players.connect(alice).processActions(playerId); // Continues the action
        await ethers.provider.send("evm_increaseTime", [12 * 3600]); // Go to tomorrow
        await ethers.provider.send("evm_mine", []);
        await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);
        await players.connect(alice).processActions(playerId); // Continues the action
      }
    });

    it("Ticket excess uses a mint multiplier", async function () {
      const {playerId, players, itemNFT, worldActions, randomnessBeacon, alice, mockVRF} = await loadFixture(
        playersFixture
      );

      const monsterCombatStats: EstforTypes.CombatStats = {
        meleeAttack: 1,
        magicAttack: 0,
        rangedAttack: 0,
        meleeDefence: 0,
        magicDefence: 0,
        rangedDefence: 0,
        health: 1
      };

      const randomChance = 65535n; // 100%
      const numSpawned = 100 * SPAWN_MUL;
      let tx = await worldActions.addActions([
        {
          actionId: 1,
          info: {
            skill: EstforTypes.Skill.COMBAT,
            xpPerHour: 3600,
            minXP: 0,
            worldLocation: 0,
            isFullModeOnly: false,
            numSpawned,
            handItemTokenIdRangeMin: EstforConstants.COMBAT_BASE,
            handItemTokenIdRangeMax: EstforConstants.COMBAT_MAX,
            isAvailable: actionIsAvailable,
            questPrerequisiteId: 0,
            actionChoiceRequired: true,
            successPercent: 100
          },
          guaranteedRewards: [],
          randomRewards: [{itemTokenId: EstforConstants.BRONZE_ARROW, chance: randomChance, amount: 1}],
          combatStats: monsterCombatStats
        }
      ]);
      const actionId = await getActionId(tx, worldActions);

      tx = await worldActions.addActionChoices(
        EstforConstants.NONE,
        [1],
        [
          {
            ...defaultActionChoice,
            skill: EstforTypes.Skill.MELEE
          }
        ]
      );
      const choiceId = await getActionChoiceId(tx, worldActions);
      await itemNFT.mint(alice, EstforConstants.BRONZE_SWORD, 1);
      await itemNFT.mint(alice, EstforConstants.BRONZE_HELMET, 1);

      await itemNFT.mint(alice, EstforConstants.COOKED_MINNUS, 255);

      const numHours = 5;

      // Make sure it passes the next checkpoint so there are no issues running
      const {timestamp} = (await ethers.provider.getBlock("latest")) as Block;
      const nextCheckpoint = Math.floor(timestamp / 86400) * 86400 + 86400;
      const durationToNextCheckpoint = nextCheckpoint - timestamp + 1;
      await ethers.provider.send("evm_increaseTime", [durationToNextCheckpoint]);
      await ethers.provider.send("evm_mine", []);

      await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);
      await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);

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
        petId: EstforConstants.NONE
      };

      await itemNFT.addItems([
        {
          ...EstforTypes.defaultItemInput,
          combatStats: {
            ...EstforTypes.emptyCombatStats,
            meleeAttack: 50
          },
          tokenId: EstforConstants.BRONZE_SWORD,
          equipPosition: EstforTypes.EquipPosition.RIGHT_HAND
        },
        {
          ...EstforTypes.defaultItemInput,
          combatStats: bronzeHelmetStats,
          tokenId: EstforConstants.BRONZE_HELMET,
          equipPosition: EstforTypes.EquipPosition.HEAD
        },
        {
          ...EstforTypes.defaultItemInput,
          tokenId: EstforConstants.BRONZE_ARROW,
          equipPosition: EstforTypes.EquipPosition.QUIVER
        },
        {
          ...EstforTypes.defaultItemInput,
          healthRestored: 12,
          tokenId: EstforConstants.COOKED_MINNUS,
          equipPosition: EstforTypes.EquipPosition.FOOD
        }
      ]);

      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.NONE);

      await ethers.provider.send("evm_increaseTime", [3600 * 24]);
      await ethers.provider.send("evm_mine", []);

      let pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
      expect(pendingQueuedActionState.equipmentStates[0].producedItemTokenIds.length).to.eq(0);

      await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);

      pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
      expect(pendingQueuedActionState.equipmentStates[0].producedItemTokenIds.length).to.eq(0);
      expect(pendingQueuedActionState.producedPastRandomRewards.length).to.eq(0);
      expect(pendingQueuedActionState.actionMetadatas[0].rolls).to.be.gt(0);

      // Increment again but it should still not produce anything
      await ethers.provider.send("evm_increaseTime", [3600 * 24]);
      await ethers.provider.send("evm_mine", []);

      await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);

      pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
      expect(pendingQueuedActionState.equipmentStates[0].producedItemTokenIds.length).to.eq(0);
      expect(pendingQueuedActionState.producedPastRandomRewards.length).to.eq(0);
      expect(pendingQueuedActionState.actionMetadatas[0].rolls).to.be.gt(0);

      expect(await itemNFT.balanceOf(alice, BRONZE_ARROW)).to.eq(0);

      await players.connect(alice).processActions(playerId);

      pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
      expect(pendingQueuedActionState.equipmentStates.length).to.eq(0);
      expect(pendingQueuedActionState.producedPastRandomRewards.length).to.eq(0);

      // Increment again but it should still not produce anything
      await ethers.provider.send("evm_increaseTime", [3600 * 24]);
      await ethers.provider.send("evm_mine", []);
      pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
      expect(pendingQueuedActionState.equipmentStates.length).to.eq(0);
      expect(pendingQueuedActionState.producedPastRandomRewards.length).to.eq(0);

      await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);

      pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
      expect(pendingQueuedActionState.producedPastRandomRewards.length).to.eq(1);
      expect(pendingQueuedActionState.producedPastRandomRewards[0].itemTokenId).to.eq(BRONZE_ARROW);
      expect(pendingQueuedActionState.producedPastRandomRewards[0].amount).to.eq(numHours * (numSpawned / SPAWN_MUL));

      await players.connect(alice).processActions(playerId);

      // Check output
      expect(await itemNFT.balanceOf(alice, BRONZE_ARROW)).to.eq(numHours * (numSpawned / SPAWN_MUL));
    });

    it("Ticket excess with rare items uses higher chance reward system", async function () {
      const {playerId, players, itemNFT, worldActions, randomnessBeacon, alice, mockVRF, playersImplMisc} =
        await loadFixture(playersFixture);

      const monsterCombatStats: EstforTypes.CombatStats = {
        meleeAttack: 1,
        magicAttack: 0,
        rangedAttack: 0,
        meleeDefence: 0,
        magicDefence: 0,
        rangedDefence: 0,
        health: 1
      };

      const randomRewardChanceMultiplier = await playersImplMisc.getRandomRewardChanceMultiplierCutoff();
      const randomChance = 999;
      expect(randomRewardChanceMultiplier).to.be.gt(randomChance);
      const numSpawned = 150 * SPAWN_MUL;

      const numHours = 23;
      // 64 unique tickets 150 * 23 = 3450 / 64 = 53.9. Should give 53.9 * 999 = 53846.1 / 65535 chance of each roll hitting
      const fractionChancePerRoll =
        ((((numSpawned / SPAWN_MUL) * numHours) / MAX_UNIQUE_TICKETS) * randomChance) / 65535;

      let tx = await worldActions.addActions([
        {
          actionId: 1,
          info: {
            skill: EstforTypes.Skill.COMBAT,
            xpPerHour: 3600,
            minXP: 0,
            worldLocation: 0,
            isFullModeOnly: false,
            numSpawned,
            handItemTokenIdRangeMin: EstforConstants.COMBAT_BASE,
            handItemTokenIdRangeMax: EstforConstants.COMBAT_MAX,
            isAvailable: actionIsAvailable,
            questPrerequisiteId: 0,
            actionChoiceRequired: true,
            successPercent: 100
          },
          guaranteedRewards: [],
          randomRewards: [{itemTokenId: EstforConstants.BRONZE_ARROW, chance: randomChance, amount: 1}],
          combatStats: monsterCombatStats
        }
      ]);
      const actionId = await getActionId(tx, worldActions);

      tx = await worldActions.addActionChoices(
        EstforConstants.NONE,
        [1],
        [
          {
            ...defaultActionChoice,
            skill: EstforTypes.Skill.MELEE
          }
        ]
      );
      const choiceId = await getActionChoiceId(tx, worldActions);
      await itemNFT.mintBatch(
        alice,
        [EstforConstants.BRONZE_SWORD, EstforConstants.BRONZE_HELMET, EstforConstants.COOKED_MINNUS],
        [1, 1, 255]
      );

      // Make sure it passes the next checkpoint so there are no issues running
      const {timestamp} = (await ethers.provider.getBlock("latest")) as Block;
      const nextCheckpoint = Math.floor(timestamp / 86400) * 86400 + 86400;
      const durationToNextCheckpoint = nextCheckpoint - timestamp + 1;
      await ethers.provider.send("evm_increaseTime", [durationToNextCheckpoint]);
      await ethers.provider.send("evm_mine", []);

      await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);
      await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);

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
        petId: EstforConstants.NONE
      };

      await itemNFT.addItems([
        {
          ...EstforTypes.defaultItemInput,
          combatStats: {
            ...EstforTypes.emptyCombatStats,
            meleeAttack: 50
          },
          tokenId: EstforConstants.BRONZE_SWORD,
          equipPosition: EstforTypes.EquipPosition.RIGHT_HAND
        },
        {
          ...EstforTypes.defaultItemInput,
          combatStats: bronzeHelmetStats,
          tokenId: EstforConstants.BRONZE_HELMET,
          equipPosition: EstforTypes.EquipPosition.HEAD
        },
        {
          ...EstforTypes.defaultItemInput,
          tokenId: EstforConstants.BRONZE_ARROW,
          equipPosition: EstforTypes.EquipPosition.QUIVER
        },
        {
          ...EstforTypes.defaultItemInput,
          healthRestored: 12,
          tokenId: EstforConstants.COOKED_MINNUS,
          equipPosition: EstforTypes.EquipPosition.FOOD
        }
      ]);

      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.NONE);

      await ethers.provider.send("evm_increaseTime", [3600 * 24]);
      await ethers.provider.send("evm_mine", []);

      let pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
      expect(pendingQueuedActionState.equipmentStates[0].producedItemTokenIds.length).to.eq(0);

      await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);

      pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
      expect(pendingQueuedActionState.equipmentStates[0].producedItemTokenIds.length).to.eq(0);
      expect(pendingQueuedActionState.producedPastRandomRewards.length).to.be.eq(0);

      await players.connect(alice).processActions(playerId);

      await ethers.provider.send("evm_increaseTime", [3600 * 24]);
      await ethers.provider.send("evm_mine", []);
      await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);

      pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
      expect(pendingQueuedActionState.producedPastRandomRewards.length).to.eq(1);
      expect(pendingQueuedActionState.producedPastRandomRewards[0].itemTokenId).to.eq(BRONZE_ARROW);

      await players.connect(alice).processActions(playerId);

      // Check output
      expect(fractionChancePerRoll).to.be.gt(0.82);
      expect(fractionChancePerRoll).to.be.lt(0.9);
      expect(await itemNFT.balanceOf(alice, BRONZE_ARROW)).to.be.gte(
        Math.floor(MAX_UNIQUE_TICKETS * fractionChancePerRoll * 0.82)
      ); // 18% below
      expect(await itemNFT.balanceOf(alice, BRONZE_ARROW)).to.be.lte(
        Math.floor(MAX_UNIQUE_TICKETS * fractionChancePerRoll * 1.18)
      ); // 18% above
    });

    // Might fail as relies on random chance
    it("Ticket excess with rare items uses higher chance reward system, hit once", async function () {
      const {playerId, players, itemNFT, worldActions, randomnessBeacon, alice, mockVRF} = await loadFixture(
        playersFixture
      );

      const monsterCombatStats: EstforTypes.CombatStats = {
        meleeAttack: 0,
        magicAttack: 0,
        rangedAttack: 0,
        meleeDefence: 0,
        magicDefence: 0,
        rangedDefence: 0,
        health: 0
      };

      const randomChance = 50; // Very low chance
      const numSpawned = 100 * SPAWN_MUL; // per hour

      const numHours = 23;
      // 64 unique tickets. 100 * 23 = 2300. 2300 / 64 = 35 chance per raw roll. Which is ((35 * 50) / 65535) a 2.67% chance and each roll hitting, and there are 64 dice.

      let tx = await worldActions.addActions([
        {
          actionId: 1,
          info: {
            skill: EstforTypes.Skill.COMBAT,
            xpPerHour: 3600,
            minXP: 0,
            worldLocation: 0,
            isFullModeOnly: false,
            numSpawned,
            handItemTokenIdRangeMin: EstforConstants.COMBAT_BASE,
            handItemTokenIdRangeMax: EstforConstants.COMBAT_MAX,
            isAvailable: actionIsAvailable,
            questPrerequisiteId: 0,
            actionChoiceRequired: true,
            successPercent: 100
          },
          guaranteedRewards: [],
          randomRewards: [{itemTokenId: EstforConstants.BRONZE_ARROW, chance: randomChance, amount: 1}],
          combatStats: monsterCombatStats
        }
      ]);
      const actionId = await getActionId(tx, worldActions);

      tx = await worldActions.addActionChoices(
        EstforConstants.NONE,
        [1],
        [
          {
            ...defaultActionChoice,
            skill: EstforTypes.Skill.MELEE
          }
        ]
      );
      const choiceId = await getActionChoiceId(tx, worldActions);
      await itemNFT.mintBatch(
        alice,
        [EstforConstants.BRONZE_SWORD, EstforConstants.BRONZE_HELMET, EstforConstants.COOKED_MINNUS],
        [1, 1, 255]
      );

      // Make sure it passes the next checkpoint so there are no issues running
      await timeTravelToNextCheckpoint();

      await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);
      await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);

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
        petId: EstforConstants.NONE
      };

      await itemNFT.addItems([
        {
          ...EstforTypes.defaultItemInput,
          combatStats: {
            ...EstforTypes.emptyCombatStats,
            meleeAttack: 50
          },
          tokenId: EstforConstants.BRONZE_SWORD,
          equipPosition: EstforTypes.EquipPosition.RIGHT_HAND
        },
        {
          ...EstforTypes.defaultItemInput,
          combatStats: bronzeHelmetStats,
          tokenId: EstforConstants.BRONZE_HELMET,
          equipPosition: EstforTypes.EquipPosition.HEAD
        },
        {
          ...EstforTypes.defaultItemInput,
          tokenId: EstforConstants.BRONZE_ARROW,
          equipPosition: EstforTypes.EquipPosition.QUIVER
        },
        {
          ...EstforTypes.defaultItemInput,
          healthRestored: 12,
          tokenId: EstforConstants.COOKED_MINNUS,
          equipPosition: EstforTypes.EquipPosition.FOOD
        }
      ]);

      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.NONE);

      await timeTravel24Hours();

      let pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
      expect(pendingQueuedActionState.equipmentStates[0].producedItemTokenIds.length).to.eq(0);

      await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);

      pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
      expect(pendingQueuedActionState.equipmentStates[0].producedItemTokenIds.length).to.eq(0);
      expect(pendingQueuedActionState.producedPastRandomRewards.length).to.be.eq(0);

      await players.connect(alice).processActions(playerId);

      await timeTravel24Hours();

      await requestAndFulfillRandomWordsSeeded(randomnessBeacon, mockVRF, 100_000_000_000n);

      expect(await itemNFT.balanceOf(alice, BRONZE_ARROW)).to.be.eq(0);

      pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);

      expect(pendingQueuedActionState.producedPastRandomRewards.length).to.eq(1);
      await players.connect(alice).processActions(playerId);

      // Check output (add some tolerance in case it's hit more than once)
      expect(await itemNFT.balanceOf(alice, BRONZE_ARROW)).to.be.oneOf([1n, 2n, 3n, 4n]);
    });

    it("Ticket excess with rare items uses higher chance reward system, uses low chance, hit none", async function () {
      const {playerId, players, itemNFT, worldActions, randomnessBeacon, alice, mockVRF} = await loadFixture(
        playersFixture
      );

      const monsterCombatStats: EstforTypes.CombatStats = {
        meleeAttack: 1,
        magicAttack: 0,
        rangedAttack: 0,
        meleeDefence: 0,
        magicDefence: 0,
        rangedDefence: 0,
        health: 1
      };

      const randomChance = 2; // Very low chance
      const numSpawned = 60 * SPAWN_MUL;

      const numHours = 23;
      // 64 unique tickets 60 * 23 = . 1380 / 64 = 21.5. Should give 21.5 * 1 = 21.5 / 65535 chance of each roll hitting
      const fractionChancePerRoll =
        ((((numSpawned / SPAWN_MUL) * numHours) / MAX_UNIQUE_TICKETS) * randomChance) / 65535;

      let tx = await worldActions.addActions([
        {
          actionId: 1,
          info: {
            skill: EstforTypes.Skill.COMBAT,
            xpPerHour: 3600,
            minXP: 0,
            worldLocation: 0,
            isFullModeOnly: false,
            numSpawned,
            handItemTokenIdRangeMin: EstforConstants.COMBAT_BASE,
            handItemTokenIdRangeMax: EstforConstants.COMBAT_MAX,
            isAvailable: actionIsAvailable,
            questPrerequisiteId: 0,
            actionChoiceRequired: true,
            successPercent: 100
          },
          guaranteedRewards: [],
          randomRewards: [{itemTokenId: EstforConstants.BRONZE_ARROW, chance: randomChance, amount: 1}],
          combatStats: monsterCombatStats
        }
      ]);
      const actionId = await getActionId(tx, worldActions);

      tx = await worldActions.addActionChoices(
        EstforConstants.NONE,
        [1],
        [
          {
            ...defaultActionChoice,
            skill: EstforTypes.Skill.MELEE
          }
        ]
      );
      const choiceId = await getActionChoiceId(tx, worldActions);
      await itemNFT.mintBatch(
        alice,
        [EstforConstants.BRONZE_SWORD, EstforConstants.BRONZE_HELMET, EstforConstants.COOKED_MINNUS],
        [1, 1, 255]
      );

      // Make sure it passes the next checkpoint so there are no issues running
      await timeTravelToNextCheckpoint();
      await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);
      await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);

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
        petId: EstforConstants.NONE
      };

      await itemNFT.addItems([
        {
          ...EstforTypes.defaultItemInput,
          combatStats: {
            ...EstforTypes.emptyCombatStats,
            meleeAttack: 50
          },
          tokenId: EstforConstants.BRONZE_SWORD,
          equipPosition: EstforTypes.EquipPosition.RIGHT_HAND
        },
        {
          ...EstforTypes.defaultItemInput,
          combatStats: bronzeHelmetStats,
          tokenId: EstforConstants.BRONZE_HELMET,
          equipPosition: EstforTypes.EquipPosition.HEAD
        },
        {
          ...EstforTypes.defaultItemInput,
          tokenId: EstforConstants.BRONZE_ARROW,
          equipPosition: EstforTypes.EquipPosition.QUIVER
        },
        {
          ...EstforTypes.defaultItemInput,
          healthRestored: 12,
          tokenId: EstforConstants.COOKED_MINNUS,
          equipPosition: EstforTypes.EquipPosition.FOOD
        }
      ]);

      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.NONE);
      await timeTravel24Hours();

      let pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
      expect(pendingQueuedActionState.equipmentStates[0].producedItemTokenIds.length).to.eq(0);

      await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);

      pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
      expect(pendingQueuedActionState.equipmentStates[0].producedItemTokenIds.length).to.eq(0);
      expect(pendingQueuedActionState.producedPastRandomRewards.length).to.eq(0);

      await players.connect(alice).processActions(playerId);

      // Check output
      expect(fractionChancePerRoll).to.be.lt(0.001);
      expect(await itemNFT.balanceOf(alice, BRONZE_ARROW)).to.be.eq(0);
    });

    it("TODO: Have some dice, transfer the player, wait a day to be able to cash them in and check that you get them", async function () {
      // Check commmit that this test was added in for the code changed to test
    });
  });

  it("Rewards without XP", async function () {
    // Check that you can get guaranteed rewards even if you don't get XP (rewards rate >> XP rate)
    const {playerId, players, alice, worldActions, randomnessBeacon, itemNFT} = await loadFixture(playersFixture);

    const rate = 3600 * GUAR_MUL; // per hour
    const tx = await worldActions.addActions([
      {
        actionId: 1,
        info: {
          skill: EstforTypes.Skill.WOODCUTTING,
          xpPerHour: 0,
          minXP: 0,
          worldLocation: 0,
          isFullModeOnly: false,
          numSpawned: 0,
          handItemTokenIdRangeMin: EstforConstants.BRONZE_AXE,
          handItemTokenIdRangeMax: EstforConstants.WOODCUTTING_MAX,
          isAvailable: actionIsAvailable,
          questPrerequisiteId: 0,
          actionChoiceRequired: false,
          successPercent: 100
        },
        guaranteedRewards: [{itemTokenId: EstforConstants.LOG, rate}],
        randomRewards: [],
        combatStats: EstforTypes.emptyCombatStats
      }
    ]);
    const actionId = getActionId(tx, worldActions);

    const queuedAction: EstforTypes.QueuedActionInput = {
      attire: EstforTypes.noAttire,
      actionId,
      combatStyle: EstforTypes.CombatStyle.NONE,
      choiceId: EstforConstants.NONE,
      regenerateId: EstforConstants.NONE,
      timespan: 24 * 3600,
      rightHandEquipmentTokenId: EstforConstants.BRONZE_AXE,
      leftHandEquipmentTokenId: EstforConstants.NONE,
      petId: EstforConstants.NONE
    };

    await itemNFT.addItems([
      {
        ...EstforTypes.defaultItemInput,
        tokenId: EstforConstants.BRONZE_AXE,
        equipPosition: EstforTypes.EquipPosition.RIGHT_HAND
      }
    ]);

    await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.NONE);
    await ethers.provider.send("evm_increaseTime", [3600]);
    await ethers.provider.send("evm_mine", []);
    expect(await itemNFT.balanceOf(alice, EstforConstants.LOG)).to.eq(0);

    let pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
    expect(pendingQueuedActionState.equipmentStates[0].producedItemTokenIds.length).is.eq(1);
    expect(pendingQueuedActionState.equipmentStates[0].producedAmounts[0]).to.gt(0);
    expect(pendingQueuedActionState.equipmentStates[0].producedItemTokenIds[0]).to.eq(EstforConstants.LOG);
    expect(await players.getPlayerXP(playerId, EstforTypes.Skill.WOODCUTTING)).to.eq(0);
    await players.connect(alice).processActions(playerId);
    // Confirm 0 XP but got wood
    expect(await players.getPlayerXP(playerId, EstforTypes.Skill.WOODCUTTING)).to.eq(0);
    expect(await itemNFT.balanceOf(alice, EstforConstants.LOG)).to.be.gt(0);
  });
});
