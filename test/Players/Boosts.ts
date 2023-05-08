import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {EstforConstants, EstforTypes, NONE} from "@paintswap/estfor-definitions";
import {expect} from "chai";
import {BigNumber} from "ethers";
import {ethers} from "hardhat";
import {GUAR_MUL, RATE_MUL, getActionId, getRequestId} from "../utils";
import {playersFixture} from "./PlayersFixture";
import {setupBasicMeleeCombat, setupBasicWoodcutting, setupBasicCooking} from "./utils";
import {noAttire} from "@paintswap/estfor-definitions/types";

describe("Boosts", function () {
  this.retries(3);

  it("Add Boost, Full consume", async function () {
    const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);

    const boostValue = 10;
    const boostDuration = 3300;
    await itemNFT.addItem({
      ...EstforTypes.defaultInputItem,
      tokenId: EstforConstants.XP_BOOST,
      equipPosition: EstforTypes.EquipPosition.BOOST_VIAL,
      // Boost
      boostType: EstforTypes.BoostType.NON_COMBAT_XP,
      boostValue,
      boostDuration,
      isTransferable: false,
    });

    const {queuedAction, rate} = await setupBasicWoodcutting(itemNFT, world);

    await itemNFT.testMint(alice.address, EstforConstants.XP_BOOST, 1);
    expect(await itemNFT.balanceOf(alice.address, EstforConstants.XP_BOOST)).to.eq(1);
    const {timestamp: NOW} = await ethers.provider.getBlock("latest");
    await players
      .connect(alice)
      .startActionsExtra(playerId, [queuedAction], EstforConstants.XP_BOOST, NOW, EstforTypes.ActionQueueStatus.NONE);
    expect(await itemNFT.balanceOf(alice.address, EstforConstants.XP_BOOST)).to.eq(0);

    await ethers.provider.send("evm_increaseTime", [queuedAction.timespan + 2]);
    await players.connect(alice).processActions(playerId);
    expect(await players.xp(playerId, EstforTypes.Skill.WOODCUTTING)).to.eq(
      queuedAction.timespan + (boostDuration * boostValue) / 100
    );
    // Check the drops are as expected
    expect(await itemNFT.balanceOf(alice.address, EstforConstants.LOG)).to.eq(
      Math.floor((queuedAction.timespan * rate) / (3600 * GUAR_MUL))
    );
  });

  it("Add Boost, partial consume", async function () {
    const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);

    const boostValue = 10;
    await itemNFT.addItem({
      ...EstforTypes.defaultInputItem,
      tokenId: EstforConstants.XP_BOOST,
      equipPosition: EstforTypes.EquipPosition.BOOST_VIAL,
      // Boost
      boostType: EstforTypes.BoostType.NON_COMBAT_XP,
      boostValue,
      boostDuration: 7200,
      isTransferable: false,
    });

    const {queuedAction, rate} = await setupBasicWoodcutting(itemNFT, world);

    await itemNFT.testMint(alice.address, EstforConstants.XP_BOOST, 1);
    expect(await itemNFT.balanceOf(alice.address, EstforConstants.XP_BOOST)).to.eq(1);
    const {timestamp: NOW} = await ethers.provider.getBlock("latest");
    await players
      .connect(alice)
      .startActionsExtra(playerId, [queuedAction], EstforConstants.XP_BOOST, NOW, EstforTypes.ActionQueueStatus.NONE);
    expect(await itemNFT.balanceOf(alice.address, EstforConstants.XP_BOOST)).to.eq(0);

    await ethers.provider.send("evm_increaseTime", [queuedAction.timespan + 2]);
    await players.connect(alice).processActions(playerId);
    expect(await players.xp(playerId, EstforTypes.Skill.WOODCUTTING)).to.eq(
      queuedAction.timespan + (queuedAction.timespan * boostValue) / 100
    );
    // Check the drops are as expected
    expect(await itemNFT.balanceOf(alice.address, EstforConstants.LOG)).to.eq(
      Math.floor((queuedAction.timespan * rate) / (3600 * GUAR_MUL))
    );
  });

  describe("Boost overlaps", function () {
    it("Expired boost", async function () {
      // Expired boost should not affect XP
      const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);

      const boostValue = 50;
      await itemNFT.addItem({
        ...EstforTypes.defaultInputItem,
        tokenId: EstforConstants.XP_BOOST,
        equipPosition: EstforTypes.EquipPosition.BOOST_VIAL,
        // Boost
        boostType: EstforTypes.BoostType.NON_COMBAT_XP,
        boostValue,
        boostDuration: 86400,
        isTransferable: false,
      });

      const {queuedAction} = await setupBasicWoodcutting(itemNFT, world);

      await itemNFT.testMint(alice.address, EstforConstants.XP_BOOST, 1);
      const {timestamp: NOW} = await ethers.provider.getBlock("latest");
      await players
        .connect(alice)
        .startActionsExtra(playerId, [queuedAction], EstforConstants.XP_BOOST, NOW, EstforTypes.ActionQueueStatus.NONE);
      await ethers.provider.send("evm_increaseTime", [86400]);
      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStatus.NONE);
      await ethers.provider.send("evm_increaseTime", [86400]); // boost has expired
      await ethers.provider.send("evm_mine", []);

      const pendingQueuedActionState = await players.pendingQueuedActionState(alice.address, playerId);
      expect(pendingQueuedActionState.actionMetadatas[0].xpGained).to.eq(queuedAction.timespan);

      await players.connect(alice).processActions(playerId);
      expect(await players.xp(playerId, EstforTypes.Skill.WOODCUTTING)).to.eq(
        queuedAction.timespan + (queuedAction.timespan * boostValue) / 100 + queuedAction.timespan
      );
    });

    it("Boost end finish inbetween action start and end", async function () {
      const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);

      const boostValue = 50;
      await itemNFT.addItem({
        ...EstforTypes.defaultInputItem,
        tokenId: EstforConstants.XP_BOOST,
        equipPosition: EstforTypes.EquipPosition.BOOST_VIAL,
        // Boost
        boostType: EstforTypes.BoostType.NON_COMBAT_XP,
        boostValue,
        boostDuration: 86400,
        isTransferable: false,
      });

      const {queuedAction} = await setupBasicWoodcutting(itemNFT, world);
      const queuedActionFinishAfterBoost = {...queuedAction};
      queuedActionFinishAfterBoost.timespan = 86400 - queuedAction.timespan;

      await itemNFT.testMint(alice.address, EstforConstants.XP_BOOST, 1);
      const {timestamp: NOW} = await ethers.provider.getBlock("latest");
      await players
        .connect(alice)
        .startActionsExtra(playerId, [queuedAction], EstforConstants.XP_BOOST, NOW, EstforTypes.ActionQueueStatus.NONE);
      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]);
      await players
        .connect(alice)
        .startActions(playerId, [queuedActionFinishAfterBoost], EstforTypes.ActionQueueStatus.NONE);
      await ethers.provider.send("evm_increaseTime", [queuedActionFinishAfterBoost.timespan]); // boost has expired in action end
      await ethers.provider.send("evm_mine", []);
      const pendingQueuedActionState = await players.pendingQueuedActionState(alice.address, playerId);
      expect(pendingQueuedActionState.actionMetadatas[0].xpGained).to.eq(
        queuedActionFinishAfterBoost.timespan + (queuedActionFinishAfterBoost.timespan * boostValue) / 100
      );
    });

    it("Check boost is removed from being active when processing", async function () {
      const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);

      const boostValue = 50;
      await itemNFT.addItem({
        ...EstforTypes.defaultInputItem,
        tokenId: EstforConstants.XP_BOOST,
        equipPosition: EstforTypes.EquipPosition.BOOST_VIAL,
        // Boost
        boostType: EstforTypes.BoostType.NON_COMBAT_XP,
        boostValue,
        boostDuration: 100,
        isTransferable: false,
      });

      const {queuedAction} = await setupBasicWoodcutting(itemNFT, world);

      await itemNFT.testMint(alice.address, EstforConstants.XP_BOOST, 1);
      const {timestamp: NOW} = await ethers.provider.getBlock("latest");
      await players
        .connect(alice)
        .startActionsExtra(playerId, [queuedAction], EstforConstants.XP_BOOST, NOW, EstforTypes.ActionQueueStatus.NONE);
      await ethers.provider.send("evm_increaseTime", [120]);
      await ethers.provider.send("evm_mine", []);
      expect((await players.activeBoosts(playerId)).itemTokenId).to.not.eq(NONE);
      await players.connect(alice).processActions(playerId);
      expect((await players.activeBoosts(playerId)).itemTokenId).to.eq(NONE);
    });
  });

  it("Combat Boost", async function () {
    const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);

    const boostValue = 50;
    const boostDuration = 120;
    await itemNFT.addItem({
      ...EstforTypes.defaultInputItem,
      tokenId: EstforConstants.XP_BOOST,
      equipPosition: EstforTypes.EquipPosition.BOOST_VIAL,
      // Boost
      boostType: EstforTypes.BoostType.ANY_XP,
      boostValue,
      boostDuration,
      isTransferable: false,
    });

    const {queuedAction} = await setupBasicMeleeCombat(itemNFT, world);

    await itemNFT.testMint(alice.address, EstforConstants.XP_BOOST, 1);
    const {timestamp: NOW} = await ethers.provider.getBlock("latest");
    await players
      .connect(alice)
      .startActionsExtra(playerId, [queuedAction], EstforConstants.XP_BOOST, NOW, EstforTypes.ActionQueueStatus.NONE);
    await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]);
    await ethers.provider.send("evm_mine", []);
    const pendingQueuedActionState = await players.pendingQueuedActionState(alice.address, playerId);
    const meleeXP = queuedAction.timespan + (boostDuration * boostValue) / 100;
    const healthXP = Math.floor(meleeXP / 3);
    expect(pendingQueuedActionState.equipmentStates.length).to.eq(1);
    expect(pendingQueuedActionState.actionMetadatas.length).to.eq(1);
    expect(pendingQueuedActionState.actionMetadatas[0].xpGained).to.be.oneOf([
      meleeXP + healthXP,
      meleeXP + healthXP - 1,
    ]);
    await players.connect(alice).processActions(playerId);
    expect(await players.xp(playerId, EstforTypes.Skill.MELEE)).to.eq(meleeXP);
    expect(await players.xp(playerId, EstforTypes.Skill.HEALTH)).to.be.deep.oneOf([
      BigNumber.from(healthXP),
      BigNumber.from(healthXP - 1),
    ]);
  });

  it("Any XP Boost", async function () {
    const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);

    const boostValue = 50;
    const boostDuration = 120;
    await itemNFT.addItem({
      ...EstforTypes.defaultInputItem,
      tokenId: EstforConstants.XP_BOOST,
      equipPosition: EstforTypes.EquipPosition.BOOST_VIAL,
      // Boost
      boostType: EstforTypes.BoostType.ANY_XP,
      boostValue,
      boostDuration,
      isTransferable: false,
    });

    const {queuedAction, rate} = await setupBasicWoodcutting(itemNFT, world);

    await itemNFT.testMint(alice.address, EstforConstants.XP_BOOST, 1);
    const {timestamp: NOW} = await ethers.provider.getBlock("latest");
    await players
      .connect(alice)
      .startActionsExtra(playerId, [queuedAction], EstforConstants.XP_BOOST, NOW, EstforTypes.ActionQueueStatus.NONE);
    await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]);
    await ethers.provider.send("evm_mine", []);
    const pendingQueuedActionState = await players.pendingQueuedActionState(alice.address, playerId);
    expect(pendingQueuedActionState.actionMetadatas[0].xpGained).to.eq(
      queuedAction.timespan + (boostDuration * boostValue) / 100
    );
    await players.connect(alice).processActions(playerId);
    expect(await players.xp(playerId, EstforTypes.Skill.WOODCUTTING)).to.eq(
      queuedAction.timespan + (boostDuration * boostValue) / 100
    );
    // Check the drops are as expected
    expect(await itemNFT.balanceOf(alice.address, EstforConstants.LOG)).to.eq(
      Math.floor((queuedAction.timespan * rate) / (3600 * GUAR_MUL))
    );
  });

  it("TODO, swap boost", async function () {
    // Check that they are minted/consumed as expected
  });

  it("TODO Clear everything, check boost", async function () {
    // Check that they are
  });

  it("Gathering boost", async function () {
    const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);

    const boostValue = 10;
    const boostDuration = 3600;
    await itemNFT.addItem({
      ...EstforTypes.defaultInputItem,
      tokenId: EstforConstants.GATHERING_BOOST,
      equipPosition: EstforTypes.EquipPosition.BOOST_VIAL,
      // Boost
      boostType: EstforTypes.BoostType.GATHERING,
      boostValue,
      boostDuration,
      isTransferable: false,
    });

    const {queuedAction, rate} = await setupBasicWoodcutting(itemNFT, world);
    await itemNFT.testMint(alice.address, EstforConstants.GATHERING_BOOST, 1);
    expect(await itemNFT.balanceOf(alice.address, EstforConstants.GATHERING_BOOST)).to.eq(1);
    const {timestamp: NOW} = await ethers.provider.getBlock("latest");
    await players
      .connect(alice)
      .startActionsExtra(
        playerId,
        [queuedAction],
        EstforConstants.GATHERING_BOOST,
        NOW,
        EstforTypes.ActionQueueStatus.NONE
      );
    expect(await itemNFT.balanceOf(alice.address, EstforConstants.GATHERING_BOOST)).to.eq(0);

    await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]);
    await players.connect(alice).processActions(playerId);
    expect(await players.xp(playerId, EstforTypes.Skill.WOODCUTTING)).to.eq(queuedAction.timespan);
    // Check the drops are as expected
    expect(await itemNFT.balanceOf(alice.address, EstforConstants.LOG)).to.eq(
      Math.floor(
        (queuedAction.timespan * rate) / (3600 * GUAR_MUL) +
          (boostDuration * boostValue * rate) / (100 * GUAR_MUL * 3600)
      )
    );
  });

  it("Gathering boost, cooking with successPercent", async function () {
    const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);

    const boostValue = 10;
    const boostDuration = 3600;
    await itemNFT.addItem({
      ...EstforTypes.defaultInputItem,
      tokenId: EstforConstants.GATHERING_BOOST,
      equipPosition: EstforTypes.EquipPosition.BOOST_VIAL,
      // Boost
      boostType: EstforTypes.BoostType.GATHERING,
      boostValue,
      boostDuration,
      isTransferable: false,
    });

    const successPercent = 50;
    const minLevel = 1;
    const {queuedAction, rate} = await setupBasicCooking(itemNFT, world, successPercent, minLevel);
    await itemNFT.testMint(alice.address, EstforConstants.GATHERING_BOOST, 1);
    const {timestamp: NOW} = await ethers.provider.getBlock("latest");
    await players
      .connect(alice)
      .startActionsExtra(
        playerId,
        [queuedAction],
        EstforConstants.GATHERING_BOOST,
        NOW,
        EstforTypes.ActionQueueStatus.NONE
      );

    await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]);
    await ethers.provider.send("evm_mine", []);

    const pendingQueuedActionState = await players.pendingQueuedActionState(alice.address, playerId);
    const foodCooked =
      (successPercent / 100) *
      ((queuedAction.timespan * rate) / (3600 * RATE_MUL) +
        (boostDuration * boostValue * rate) / (100 * RATE_MUL * 3600));
    expect(pendingQueuedActionState.equipmentStates[0].producedAmounts[0]).to.eq(foodCooked);

    await players.connect(alice).processActions(playerId);
    expect(await players.xp(playerId, EstforTypes.Skill.COOKING)).to.eq(queuedAction.timespan);
    // Check the drops are as expected
    expect(await itemNFT.balanceOf(alice.address, EstforConstants.COOKED_MINNUS)).to.eq(foodCooked);
  });

  it("Gathering boost, random rewards obtain same day", async function () {
    const {playerId, players, itemNFT, world, alice, mockOracleClient} = await loadFixture(playersFixture);

    const boostValue = 10;
    const boostDuration = 3600;
    await itemNFT.addItem({
      ...EstforTypes.defaultInputItem,
      tokenId: EstforConstants.GATHERING_BOOST,
      equipPosition: EstforTypes.EquipPosition.BOOST_VIAL,
      // Boost
      boostType: EstforTypes.BoostType.GATHERING,
      boostValue,
      boostDuration,
      isTransferable: false,
    });

    const randomChance = 65535;
    const xpPerHour = 50;
    const amount = 100;
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
        isAvailable: true,
        actionChoiceRequired: false,
        successPercent: 100,
      },
      guaranteedRewards: [],
      randomRewards: [{itemTokenId: EstforConstants.BRONZE_ARROW, chance: randomChance, amount}],
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
    await ethers.provider.send("evm_increaseTime", [24 * 3600]);
    tx = await world.requestRandomWords();
    requestId = getRequestId(tx);
    expect(requestId).to.not.eq(0);
    await mockOracleClient.fulfill(requestId, world.address);

    const timespan = 3600 * numHours;
    const queuedAction: EstforTypes.QueuedActionInput = {
      attire: noAttire,
      actionId,
      combatStyle: EstforTypes.CombatStyle.NONE,
      choiceId: EstforConstants.NONE,
      regenerateId: EstforConstants.NONE,
      timespan,
      rightHandEquipmentTokenId: EstforConstants.NONE,
      leftHandEquipmentTokenId: EstforConstants.NONE,
    };

    await itemNFT.testMint(alice.address, EstforConstants.GATHERING_BOOST, 1);
    expect(await itemNFT.balanceOf(alice.address, EstforConstants.GATHERING_BOOST)).to.eq(1);
    const {timestamp: NOW} = await ethers.provider.getBlock("latest");
    await players
      .connect(alice)
      .startActionsExtra(
        playerId,
        [queuedAction],
        EstforConstants.GATHERING_BOOST,
        NOW,
        EstforTypes.ActionQueueStatus.NONE
      );
    expect(await itemNFT.balanceOf(alice.address, EstforConstants.GATHERING_BOOST)).to.eq(0);

    await ethers.provider.send("evm_increaseTime", [24 * 3600]);
    tx = await world.requestRandomWords();
    requestId = getRequestId(tx);
    expect(requestId).to.not.eq(0);
    await mockOracleClient.fulfill(requestId, world.address);
    await ethers.provider.send("evm_increaseTime", [24 * 3600]);
    tx = await world.requestRandomWords();
    requestId = getRequestId(tx);
    expect(requestId).to.not.eq(0);
    await mockOracleClient.fulfill(requestId, world.address);
    await players.connect(alice).processActions(playerId);

    expect(await itemNFT.balanceOf(alice.address, EstforConstants.BRONZE_ARROW)).to.eq(
      Math.floor(numHours * amount + (boostDuration * boostValue * amount) / (100 * 3600))
    );
  });

  it("Gathering boost, check boosted time over multiple queued actions is correct", async function () {
    const {playerId, players, itemNFT, world, alice, mockOracleClient} = await loadFixture(playersFixture);

    const boostValue = 10;
    const boostDuration = 12600; // 3 hour 30 mins
    await itemNFT.addItem({
      ...EstforTypes.defaultInputItem,
      tokenId: EstforConstants.GATHERING_BOOST,
      equipPosition: EstforTypes.EquipPosition.BOOST_VIAL,
      // Boost
      boostType: EstforTypes.BoostType.GATHERING,
      boostValue,
      boostDuration,
      isTransferable: false,
    });

    const randomChance = 65535;
    const xpPerHour = 50;
    const amount = 100;
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
        isAvailable: true,
        actionChoiceRequired: false,
        successPercent: 100,
      },
      guaranteedRewards: [],
      randomRewards: [{itemTokenId: EstforConstants.BRONZE_ARROW, chance: randomChance, amount}],
      combatStats: EstforTypes.emptyCombatStats,
    });

    const actionId = await getActionId(tx);

    // Make sure it passes the next checkpoint so there are no issues running
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

    const timespan = 3600 * 2;
    const queuedAction: EstforTypes.QueuedActionInput = {
      attire: noAttire,
      actionId,
      combatStyle: EstforTypes.CombatStyle.NONE,
      choiceId: EstforConstants.NONE,
      regenerateId: EstforConstants.NONE,
      timespan,
      rightHandEquipmentTokenId: EstforConstants.NONE,
      leftHandEquipmentTokenId: EstforConstants.NONE,
    };

    await itemNFT.testMint(alice.address, EstforConstants.GATHERING_BOOST, 2);
    expect(await itemNFT.balanceOf(alice.address, EstforConstants.GATHERING_BOOST)).to.eq(2);
    const {timestamp: NOW} = await ethers.provider.getBlock("latest");
    await players
      .connect(alice)
      .startActionsExtra(
        playerId,
        [queuedAction, queuedAction, queuedAction],
        EstforConstants.GATHERING_BOOST,
        NOW,
        EstforTypes.ActionQueueStatus.NONE
      );
    expect(await itemNFT.balanceOf(alice.address, EstforConstants.GATHERING_BOOST)).to.eq(1);

    await ethers.provider.send("evm_increaseTime", [3600 + 60]);
    await players.connect(alice).processActions(playerId);
    let pendingRandomRewards = await players.getPendingRandomRewards(playerId);
    expect(pendingRandomRewards.length).to.eq(1);
    expect(pendingRandomRewards[0].xpElapsedTime).to.eq(3600);
    expect(await players.xp(playerId, EstforTypes.Skill.THIEVING)).to.eq(xpPerHour);
    await ethers.provider.send("evm_increaseTime", [3600 + 60]);
    await players.connect(alice).processActions(playerId); // Still in same action
    pendingRandomRewards = await players.getPendingRandomRewards(playerId);
    expect(pendingRandomRewards.length).to.eq(2);
    expect(pendingRandomRewards[1].xpElapsedTime).to.eq(3600);
    expect(await players.xp(playerId, EstforTypes.Skill.THIEVING)).to.eq(xpPerHour * 2);
    await ethers.provider.send("evm_increaseTime", [100]); // Next action
    await players.connect(alice).processActions(playerId);
    expect(await players.xp(playerId, EstforTypes.Skill.THIEVING)).to.eq(xpPerHour * 2); // Thieving is untouched
    pendingRandomRewards = await players.getPendingRandomRewards(playerId);
    expect(pendingRandomRewards.length).to.eq(2); // Not added as there was no xp time Action still going so no pending random rewards
    await ethers.provider.send("evm_increaseTime", [7200]);
    await players.connect(alice).processActions(playerId);
    expect(await players.xp(playerId, EstforTypes.Skill.THIEVING)).to.eq(xpPerHour * 4);
    pendingRandomRewards = await players.getPendingRandomRewards(playerId);
    expect(pendingRandomRewards.length).to.eq(3); // Action still going so no pending random rewards
    expect(pendingRandomRewards[2].xpElapsedTime).to.eq(7200);

    await ethers.provider.send("evm_increaseTime", [24 * 3600]);
    tx = await world.requestRandomWords();
    requestId = getRequestId(tx);
    expect(requestId).to.not.eq(0);
    await mockOracleClient.fulfill(requestId, world.address);
    await ethers.provider.send("evm_increaseTime", [24 * 3600]);
    tx = await world.requestRandomWords();
    requestId = getRequestId(tx);
    expect(requestId).to.not.eq(0);
    await mockOracleClient.fulfill(requestId, world.address);

    await players
      .connect(alice)
      .startActionsExtra(
        playerId,
        [queuedAction],
        EstforConstants.GATHERING_BOOST,
        NOW,
        EstforTypes.ActionQueueStatus.NONE
      );
    expect(await itemNFT.balanceOf(alice.address, EstforConstants.GATHERING_BOOST)).to.eq(0);
  });

  it("Gathering boost, random rewards, obtain next day", async function () {
    const {playerId, players, itemNFT, world, alice, mockOracleClient} = await loadFixture(playersFixture);

    const boostValue = 10;
    const boostDuration = 3600;
    await itemNFT.addItem({
      ...EstforTypes.defaultInputItem,
      tokenId: EstforConstants.GATHERING_BOOST,
      equipPosition: EstforTypes.EquipPosition.BOOST_VIAL,
      // Boost
      boostType: EstforTypes.BoostType.GATHERING,
      boostValue,
      boostDuration,
      isTransferable: false,
    });

    const randomChance = 65535;
    const xpPerHour = 50;
    const amount = 100;
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
        isAvailable: true,
        actionChoiceRequired: false,
        successPercent: 100,
      },
      guaranteedRewards: [],
      randomRewards: [{itemTokenId: EstforConstants.BRONZE_ARROW, chance: randomChance, amount}],
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
    await ethers.provider.send("evm_increaseTime", [24 * 3600]);
    tx = await world.requestRandomWords();
    requestId = getRequestId(tx);
    expect(requestId).to.not.eq(0);
    await mockOracleClient.fulfill(requestId, world.address);

    const timespan = 3600 * numHours;
    const queuedAction: EstforTypes.QueuedActionInput = {
      attire: noAttire,
      actionId,
      combatStyle: EstforTypes.CombatStyle.NONE,
      choiceId: EstforConstants.NONE,
      regenerateId: EstforConstants.NONE,
      timespan,
      rightHandEquipmentTokenId: EstforConstants.NONE,
      leftHandEquipmentTokenId: EstforConstants.NONE,
    };

    await itemNFT.testMint(alice.address, EstforConstants.GATHERING_BOOST, 1);
    expect(await itemNFT.balanceOf(alice.address, EstforConstants.GATHERING_BOOST)).to.eq(1);
    const {timestamp: NOW} = await ethers.provider.getBlock("latest");
    await players
      .connect(alice)
      .startActionsExtra(
        playerId,
        [queuedAction],
        EstforConstants.GATHERING_BOOST,
        NOW,
        EstforTypes.ActionQueueStatus.NONE
      );
    expect(await itemNFT.balanceOf(alice.address, EstforConstants.GATHERING_BOOST)).to.eq(0);

    await ethers.provider.send("evm_increaseTime", [24 * 3600]);
    tx = await world.requestRandomWords();
    requestId = getRequestId(tx);
    expect(requestId).to.not.eq(0);
    await mockOracleClient.fulfill(requestId, world.address);
    await players.connect(alice).processActions(playerId);

    expect(await itemNFT.balanceOf(alice.address, EstforConstants.BRONZE_ARROW)).to.eq(0);

    await ethers.provider.send("evm_increaseTime", [24 * 3600]);
    tx = await world.requestRandomWords();
    requestId = getRequestId(tx);
    expect(requestId).to.not.eq(0);
    await mockOracleClient.fulfill(requestId, world.address);
    await players.connect(alice).processActions(playerId);
    expect(await itemNFT.balanceOf(alice.address, EstforConstants.BRONZE_ARROW)).to.eq(
      Math.floor(numHours * amount + (boostDuration * boostValue * amount) / (100 * 3600))
    );
  });
});
