import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {EstforConstants, EstforTypes} from "@paintswap/estfor-definitions";
import {expect} from "chai";
import {ethers} from "hardhat";
import {requestAndFulfillRandomWords, upgradePlayer} from "../utils";
import {playersFixture} from "./PlayersFixture";
import {setupBasicWoodcutting} from "./utils";
import {timeTravel24Hours} from "../utils";
import {createPlayer} from "../../scripts/utils";
import {Block} from "ethers";
import {GUAR_MUL} from "@paintswap/estfor-definitions/constants";

describe("Daily Rewards", function () {
  it("Daily & weekly reward when starting an action", async function () {
    const {
      playerId,
      players,
      itemNFT,
      worldActions,
      randomnessBeacon,
      dailyRewardsScheduler,
      alice,
      mockVRF,
      playerNFT,
      brush,
      upgradePlayerBrushPrice
    } = await loadFixture(playersFixture);

    await players.setDailyRewardsEnabled(true);

    const oneDay = 24 * 3600;
    const oneWeek = oneDay * 7;
    const {timestamp: currentTimestamp} = (await ethers.provider.getBlock("latest")) as Block;
    const timestamp = Math.floor((currentTimestamp - 4 * oneDay) / oneWeek) * oneWeek + (oneWeek + 5 * oneDay); // Start next tuesday

    const numDays = Math.floor(timestamp - currentTimestamp) / oneDay;

    await upgradePlayer(playerNFT, playerId, brush, upgradePlayerBrushPrice, alice);

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
      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);
      await timeTravel24Hours();
      await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);
    }
    await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);

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
    await timeTravel24Hours();
    await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);
    // Check the last day of the week
    const pendingQueuedActionState = await players.connect(alice).getPendingQueuedActionState(alice, playerId);
    expect(pendingQueuedActionState.dailyRewardItemTokenIds.length).to.eq(1);
    expect(pendingQueuedActionState.dailyRewardItemTokenIds[0]).to.eq(sundayReward.itemTokenId);

    equipmentCache.set(
      sundayReward.itemTokenId,
      (equipmentCache.get(sundayReward.itemTokenId) || 0n) + sundayReward.amount
    );

    await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);
    expect(balanceAfterWeeklyReward).to.eq(await itemNFT.balanceOf(alice, weeklyEquipment.itemTokenId));
    let balanceAfterDailyReward = await itemNFT.balanceOf(alice, sundayReward.itemTokenId);
    expect(balanceAfterDailyReward).to.eq(prevBalanceDailyReward + sundayReward.amount);

    expect(await players.dailyClaimedRewards(playerId)).to.eql([false, true, true, true, true, true, true]);

    // Next one should start the next round
    await timeTravel24Hours();
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
      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);
      if (i != 6) {
        await timeTravel24Hours();
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
    const {
      playerId,
      players,
      itemNFT,
      worldActions,
      randomnessBeacon,
      dailyRewardsScheduler,
      alice,
      mockVRF,
      playerNFT,
      brush,
      upgradePlayerBrushPrice
    } = await loadFixture(playersFixture);

    await players.setDailyRewardsEnabled(true);

    const {queuedAction} = await setupBasicWoodcutting(itemNFT, worldActions, 100 * GUAR_MUL, 20n);

    const oneDay = 24 * 3600;
    const oneWeek = oneDay * 7;
    const {timestamp: currentTimestamp} = (await ethers.provider.getBlock("latest")) as Block;
    const timestamp = Math.floor((currentTimestamp - 4 * oneDay) / oneWeek) * oneWeek + (oneWeek + 4 * oneDay); // Start next monday

    await upgradePlayer(playerNFT, playerId, brush, upgradePlayerBrushPrice, alice);

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
    await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);
    let balanceAfter = await itemNFT.balanceOf(alice, equipment.itemTokenId);
    expect(balanceAfter).to.eq(balanceBefore + equipment.amount);

    // Start again, shouldn't get any more rewards
    balanceBefore = await itemNFT.balanceOf(alice, equipment.itemTokenId);
    await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);
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
      mockVRF,
      brush,
      upgradePlayerBrushPrice
    } = await loadFixture(playersFixture);

    await players.setDailyRewardsEnabled(true);

    const {queuedAction} = await setupBasicWoodcutting(itemNFT, worldActions, 100 * GUAR_MUL, 20n);

    const oneDay = 24 * 3600;
    const oneWeek = oneDay * 7;
    const {timestamp: currentTimestamp} = (await ethers.provider.getBlock("latest")) as Block;
    const timestamp = Math.floor((currentTimestamp - 4 * oneDay) / oneWeek) * oneWeek + (oneWeek + 4 * oneDay); // Start next monday

    await upgradePlayer(playerNFT, playerId, brush, upgradePlayerBrushPrice, alice);

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
    await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);
    let balanceAfter = await itemNFT.balanceOf(alice, equipment.itemTokenId);
    expect(balanceAfter).to.eq(balanceBefore + equipment.amount);

    // Using another hero, shouldn't get any more rewards
    const newPlayerId = await createPlayer(playerNFT, avatarId, alice, "alice1", true);

    equipments = await dailyRewardsScheduler.getActiveDailyAndWeeklyRewards(tier, newPlayerId);
    equipment = equipments[0];

    balanceBefore = await itemNFT.balanceOf(alice, equipment.itemTokenId);
    await players.connect(alice).startActions(newPlayerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);
    balanceAfter = await itemNFT.balanceOf(alice, equipment.itemTokenId);
    expect(balanceAfter).to.eq(balanceBefore);
  });

  it("Check daily rewards not given when making a new hero", async function () {
    const {
      players,
      playerId,
      playerNFT,
      itemNFT,
      alice,
      randomnessBeacon,
      dailyRewardsScheduler,
      mockVRF,
      brush,
      upgradePlayerBrushPrice
    } = await loadFixture(playersFixture);

    await players.setDailyRewardsEnabled(true);
    await dailyRewardsScheduler.setDailyRewardPool(1, [{itemTokenId: EstforConstants.BRONZE_ARROW, amount: 10}]);

    await upgradePlayer(playerNFT, playerId, brush, upgradePlayerBrushPrice, alice);

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

    await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);
    expect(await players.dailyClaimedRewards(playerId)).to.eql([true, false, false, false, false, false, false]);
    await ethers.provider.send("evm_increaseTime", [3600 * 24]);
    await ethers.provider.send("evm_mine", []);
    await players.connect(alice).processActions(playerId); // Daily reward should be given
    expect(await players.dailyClaimedRewards(playerId)).to.eql([true, true, false, false, false, false, false]);
  });

  it("Can only get Monday's reward if the oracle has been called", async function () {
    // So that people can't get last Monday's daily reward
    const {
      playerId,
      players,
      itemNFT,
      worldActions,
      randomnessBeacon,
      dailyRewardsScheduler,
      alice,
      mockVRF,
      playerNFT,
      brush,
      upgradePlayerBrushPrice
    } = await loadFixture(playersFixture);

    await players.setDailyRewardsEnabled(true);

    const {queuedAction} = await setupBasicWoodcutting(itemNFT, worldActions);

    const oneDay = 24 * 3600;
    const oneWeek = oneDay * 7;
    const {timestamp: currentTimestamp} = (await ethers.provider.getBlock("latest")) as Block;
    const timestamp = Math.floor((currentTimestamp - 4 * oneDay) / oneWeek) * oneWeek + (oneWeek + 4 * oneDay); // Start next monday

    const numDays = Math.floor(timestamp - currentTimestamp) / oneDay;

    await upgradePlayer(playerNFT, playerId, brush, upgradePlayerBrushPrice, alice);

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
    await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);
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
    const {playerId, players, itemNFT, worldActions, randomnessBeacon, dailyRewardsScheduler, alice, mockVRF} =
      await loadFixture(playersFixture);

    await players.setDailyRewardsEnabled(true);

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

    // Get the new equipments for the next week
    let dailyRewards = await dailyRewardsScheduler.getActiveDailyAndWeeklyRewards(1, playerId);
    let equipments = dailyRewards; // dailyRewards.slice(1, 6); // skip first and last
    let equipmentCache = new Map<bigint, bigint>();
    for (let i = 0; i < equipments.length; ++i) {
      equipmentCache.set(
        equipments[i].itemTokenId,
        (equipmentCache.get(equipments[i].itemTokenId) || 0n) + BigInt(Math.max(1, Number(equipments[i].amount) / 10)) // Get 10% of the reward if unevolved
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

    for (let i = 0; i < 6; ++i) {
      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);
      await timeTravel24Hours();
      await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);
    }
    await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);

    const afterBalances = await itemNFT.balanceOfs(
      alice,
      equipments.map((equipment) => equipment.itemTokenId)
    );

    for (let i = 0; i < 7; ++i) {
      expect(afterBalances[i]).to.eq(beforeBalances[i] + (equipmentCache.get(equipments[i].itemTokenId) || 0n));
    }

    expect(await players.dailyClaimedRewards(playerId)).to.eql([true, true, true, true, true, true, true]);

    const balanceAfterWeeklyReward = await itemNFT.balanceOf(alice, weeklyEquipment.itemTokenId);

    // Also check extra week streak reward
    expect(balanceBeforeWeeklyReward + BigInt(Math.max(1, Number(weeklyEquipment.amount) / 10))).to.eq(
      balanceAfterWeeklyReward
    );
  });
});
