import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {expect} from "chai";
import {ethers} from "hardhat";
import {
  ActionQueueStatus,
  BoostType,
  BRONZE_AXE,
  BRONZE_BAR,
  BRONZE_GAUNTLETS,
  BRONZE_PICKAXE,
  COAL_ORE,
  CombatStyle,
  COMBAT_BASE,
  COMBAT_MAX,
  COPPER_ORE,
  emptyActionChoice,
  emptyCombatStats,
  Equipment,
  EquipPosition,
  FIRE_LIGHTER,
  FIRE_MAX,
  getActionChoiceId,
  getActionId,
  getRequestId,
  defaultInputItem,
  LOG,
  MINING_MAX,
  MITHRIL_BAR,
  MITHRIL_ORE,
  NATURE_BODY,
  NATURE_BOOTS,
  NATURE_BRACERS,
  NATURE_MASK,
  NATURE_TROUSERS,
  noAttire,
  NONE,
  QueuedAction,
  Skill,
  WOODCUTTING_BASE,
  WOODCUTTING_MAX,
  XP_BOOST,
  HELL_SCROLL,
  COOKED_BOWFISH,
  RUBY,
  LEAF_FRAGMENTS,
} from "../../scripts/utils";
import {playersFixture} from "./PlayersFixture";

const actionIsAvailable = true;

describe("Players", () => {
  it("Skill points", async () => {
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
      timespan: 3600,
      rightHandEquipmentTokenId: BRONZE_AXE,
      leftHandEquipmentTokenId: NONE,
      startTime: "0",
      isValid: true,
    };

    await players.connect(alice).startAction(playerId, queuedAction, ActionQueueStatus.NONE);
    await ethers.provider.send("evm_increaseTime", [361]);
    await players.connect(alice).processActions(playerId);
    expect(await players.skillPoints(playerId, Skill.WOODCUTTING)).to.be.oneOf([361, 362]);
    expect(await itemNFT.balanceOf(alice.address, LOG)).to.eq(10); // Should be rounded down
  });

  it("Skill points (many)", async () => {
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
      timespan: 3600,
      rightHandEquipmentTokenId: BRONZE_AXE,
      leftHandEquipmentTokenId: NONE,
      startTime: "0",
      isValid: true,
    };

    // start a bunch of actions 1 after each other
    for (let i = 0; i < 50; i++) {
      await players.connect(alice).startAction(playerId, queuedAction, ActionQueueStatus.APPEND);
      await ethers.provider.send("evm_increaseTime", [7200]);
      await players.connect(alice).processActions(playerId);
      expect(await players.skillPoints(playerId, Skill.WOODCUTTING)).to.be.eq((i + 1) * 3600);
      expect(await itemNFT.balanceOf(alice.address, LOG)).to.eq((i + 1) * 100); // Should be rounded down
    }
  });

  it("Speed multiplier", async () => {
    const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);

    const rate = 100 * 100; // per hour
    const tx = await world.addAction({
      actionId: 1,
      info: {
        skill: Skill.WOODCUTTING,
        xpPerHour: 3600,
        minSkillPoints: 0,
        isDynamic: false,
        numSpawn: 0,
        handItemTokenIdRangeMin: BRONZE_AXE,
        handItemTokenIdRangeMax: WOODCUTTING_MAX,
        isAvailable: actionIsAvailable,
        actionChoiceRequired: false,
      },
      guaranteedRewards: [{itemTokenId: LOG, rate}],
      randomRewards: [],
      combatStats: emptyCombatStats,
    });
    const actionId = await getActionId(tx);

    const timespan = 3600;
    const queuedAction: QueuedAction = {
      attire: noAttire,
      actionId,
      combatStyle: CombatStyle.NONE,
      choiceId: NONE,
      choiceId1: NONE,
      choiceId2: NONE,
      regenerateId: NONE,
      timespan,
      rightHandEquipmentTokenId: BRONZE_AXE,
      leftHandEquipmentTokenId: NONE,
      startTime: "0",
      isValid: true,
    };

    await itemNFT.addItem({
      ...defaultInputItem,
      tokenId: BRONZE_AXE,
      equipPosition: EquipPosition.RIGHT_HAND,
      metadataURI: "someIPFSURI.json",
    });

    await players.connect(alice).startAction(playerId, queuedAction, ActionQueueStatus.NONE);
    await players.connect(alice).setSpeedMultiplier(playerId, 2);

    await ethers.provider.send("evm_increaseTime", [queuedAction.timespan / 2]);
    await players.connect(alice).processActions(playerId);
    expect(await players.skillPoints(playerId, Skill.WOODCUTTING)).to.eq(queuedAction.timespan);
    // Check the drops are as expected
    expect(await itemNFT.balanceOf(alice.address, LOG)).to.eq(
      Math.floor((queuedAction.timespan * rate) / (3600 * 100))
    );
    expect(await players.actionQueueLength(playerId)).to.eq(0);
  });

  it("Partial consume aux items", async () => {
    const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);

    const rate = 100 * 100; // per hour
    const tx = await world.addAction({
      actionId: 1,
      info: {
        skill: Skill.WOODCUTTING,
        xpPerHour: 3600,
        minSkillPoints: 0,
        isDynamic: false,
        numSpawn: 0,
        handItemTokenIdRangeMin: BRONZE_AXE,
        handItemTokenIdRangeMax: WOODCUTTING_MAX,
        isAvailable: actionIsAvailable,
        actionChoiceRequired: false,
      },
      guaranteedRewards: [{itemTokenId: LOG, rate}],
      randomRewards: [],
      combatStats: emptyCombatStats,
    });
    const actionId = await getActionId(tx);

    const timespan = 3600;
    const queuedAction: QueuedAction = {
      attire: noAttire,
      actionId,
      combatStyle: CombatStyle.NONE,
      choiceId: NONE,
      choiceId1: NONE,
      choiceId2: NONE,
      regenerateId: NONE,
      timespan,
      rightHandEquipmentTokenId: BRONZE_AXE,
      leftHandEquipmentTokenId: NONE,
      startTime: "0",
      isValid: true,
    };

    await itemNFT.addItem({
      ...defaultInputItem,
      tokenId: BRONZE_AXE,
      equipPosition: EquipPosition.RIGHT_HAND,
      metadataURI: "someIPFSURI.json",
    });

    await players.connect(alice).startAction(playerId, queuedAction, ActionQueueStatus.NONE);

    await ethers.provider.send("evm_increaseTime", [queuedAction.timespan / 2]);
    await players.connect(alice).processActions(playerId);
    expect(await players.skillPoints(playerId, Skill.WOODCUTTING)).to.eq(queuedAction.timespan / 2);
    // Check the drops are as expected
    expect(await itemNFT.balanceOf(alice.address, LOG)).to.eq(
      Math.floor(((queuedAction.timespan / 2) * rate) / (3600 * 100))
    );
  });
  /*
  it("Skill points, max range", async () => {
    const {playerId, players, itemNFT, world, alice, maxTime} = await loadFixture(playersFixture);

    const combatStats: CombatStats = {
      melee: 2,
      magic: 0,
      range: 0,
      meleeDefence: -1,
      magicDefence: 0,
      rangeDefence: 0,
      health: 12,
    };
    await itemNFT.addItem({
      ...defaultInputItem,
      tokenId: BRONZE_GAUNTLETS,
      combatStats,
      equipPosition: EquipPosition.ARMS,
      metadataURI: "someIPFSURI.json",
    });
    await itemNFT.testOnlyMint(alice.address, BRONZE_SWORD, 1);
    await itemNFT.testOnlyMint(alice.address, BRONZE_GAUNTLETS, 1);

    await itemNFT.addItem({
      ...defaultInputItem,
      tokenId: BRONZE_SWORD,
      combatStats,
      equipPosition: EquipPosition.RIGHT_HAND,
      metadataURI: "someIPFSURI.json",
    });

    await world.addAction({
      actionId: 1,
      info: {
        skill: Skill.COMBAT,
        xpPerHour: 3600,
        minSkillPoints: 0,
        isDynamic: false,
        numSpawn: 10,
        handItemTokenIdRangeMin: COMBAT_BASE,
        handItemTokenIdRangeMax: COMBAT_MAX,
        isAvailable: actionIsAvailable,
        actionChoiceRequired: true,
      },
      guaranteedRewards: [],
      randomRewards: [],
      combatStats: emptyCombatStats,
    });

    const tx = await world.addActionChoice(NONE, {
      ...emptyActionChoice,
      skill: Skill.ATTACK,
    });
    const choiceId = await getActionChoiceId(tx);

    const queuedAction: QueuedAction = {
      attire: {...noAttire, gauntlets: BRONZE_GAUNTLETS},
      actionId: 1,
      combatStyle: CombatStyle.MELEE,
      choiceId,
      choiceId1: NONE,
      choiceId2: NONE,
      regenerateId: NONE,
      timespan: 100,
      rightHandEquipmentTokenId: BRONZE_SWORD,
      leftHandEquipmentTokenId: NONE,
      startTime: "0",
      isValid: true,
    };

    await players.connect(alice).startAction(playerId, queuedAction, ActionQueueStatus.NONE);

    await ethers.provider.send("evm_increaseTime", [queuedAction.timespan + 2]);
    await players.connect(alice).processActions(playerId);
    expect(await players.skillPoints(playerId, Skill.ATTACK)).to.eq(queuedAction.timespan);
  });
*/
  it("Multi-skill points", async () => {
    // TODO:
  });

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
    const timestamp = Math.floor(Date.now() / 1000 / oneWeek) * (2 * oneWeek) + oneDay + 1; // Start next friday

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
      expect(beforeBalances[i].toNumber() + equipments[i].amount).to.eq(afterBalances[i]);
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
    const timestamp = Math.floor(Date.now() / 1000 / oneWeek) * 2 * oneWeek + 1; // Start next thursday

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

  // TODO: Check attire stats are as expected

  it("Attire equipPositions", async () => {
    const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);

    let tx = await world.addAction({
      actionId: 1,
      info: {
        skill: Skill.COMBAT,
        xpPerHour: 3600,
        minSkillPoints: 0,
        isDynamic: false,
        numSpawn: 1,
        handItemTokenIdRangeMin: COMBAT_BASE,
        handItemTokenIdRangeMax: COMBAT_MAX,
        isAvailable: actionIsAvailable,
        actionChoiceRequired: true,
      },
      guaranteedRewards: [],
      randomRewards: [],
      combatStats: emptyCombatStats,
    });
    const actionId = await getActionId(tx);

    tx = await world.addActionChoice(NONE, 1, {
      ...emptyActionChoice,
      skill: Skill.ATTACK,
    });
    const choiceId = await getActionChoiceId(tx);
    const timespan = 3600;

    const queuedAction: QueuedAction = {
      attire: {...noAttire, helmet: BRONZE_GAUNTLETS}, // Incorrect attire
      actionId,
      combatStyle: CombatStyle.MELEE,
      choiceId,
      choiceId1: NONE,
      choiceId2: NONE,
      regenerateId: NONE,
      timespan,
      rightHandEquipmentTokenId: NONE,
      leftHandEquipmentTokenId: NONE,
      startTime: "0",
      isValid: true,
    };

    await itemNFT.addItem({
      ...defaultInputItem,
      tokenId: BRONZE_GAUNTLETS,
      combatStats: emptyCombatStats,
      equipPosition: EquipPosition.ARMS,
      metadataURI: "someIPFSURI.json",
    });
    await itemNFT.testOnlyMint(alice.address, BRONZE_GAUNTLETS, 1);

    await expect(
      players.connect(alice).startAction(playerId, queuedAction, ActionQueueStatus.NONE)
    ).to.be.revertedWithCustomError(players, "InvalidEquipPosition");
    queuedAction.attire.helmet = NONE;
    queuedAction.attire.amulet = BRONZE_GAUNTLETS;
    await expect(
      players.connect(alice).startAction(playerId, queuedAction, ActionQueueStatus.NONE)
    ).to.be.revertedWithCustomError(players, "InvalidEquipPosition");
    queuedAction.attire.amulet = NONE;
    queuedAction.attire.armor = BRONZE_GAUNTLETS;
    await expect(
      players.connect(alice).startAction(playerId, queuedAction, ActionQueueStatus.NONE)
    ).to.be.revertedWithCustomError(players, "InvalidEquipPosition");
    queuedAction.attire.armor = NONE;
    queuedAction.attire.boots = BRONZE_GAUNTLETS;
    await expect(
      players.connect(alice).startAction(playerId, queuedAction, ActionQueueStatus.NONE)
    ).to.be.revertedWithCustomError(players, "InvalidEquipPosition");
    queuedAction.attire.boots = NONE;
    queuedAction.attire.tassets = BRONZE_GAUNTLETS;
    await expect(
      players.connect(alice).startAction(playerId, queuedAction, ActionQueueStatus.NONE)
    ).to.be.revertedWithCustomError(players, "InvalidEquipPosition");
    queuedAction.attire.tassets = NONE;
    queuedAction.attire.gauntlets = BRONZE_GAUNTLETS; // Correct
    await players.connect(alice).startAction(playerId, queuedAction, ActionQueueStatus.NONE);
  });

  /*  it("Check already equipped", async () => {
    const {playerId, players, playerNFT, itemNFT, alice} = await loadFixture(playersFixture);
    await itemNFT.testOnlyMint(alice.address, BRONZE_GAUNTLETS, 1);
    expect(await itemNFT.balanceOf(alice.address, BRONZE_GAUNTLETS)).to.eq(1);

    const combatStats: CombatStats = {
      melee: 2,
      magic: 0,
      range: 0,
      meleeDefence: -1,
      magicDefence: 0,
      rangeDefence: 0,
      health: 12,
    };

    await itemNFT.addItem({
      ...defaultInputItem,
      tokenId: BRONZE_GAUNTLETS,
      combatStats,
      equipPosition: EquipPosition.ARMS,
      metadataURI: "someIPFSURI.json",
    });

    // Check bonuses before
    const beforeStats = (await players.players(playerId)).totalStats;
    expect(beforeStats.melee).to.eq(0);
    expect(beforeStats.range).to.eq(0);
    expect(beforeStats.magic).to.eq(0);
    expect(beforeStats.meleeDefence).to.eq(0);
    expect(beforeStats.rangeDefence).to.eq(0);
    expect(beforeStats.magicDefence).to.eq(0);
    expect(beforeStats.health).to.eq(0);

    await players.connect(alice).equip(playerId, BRONZE_GAUNTLETS);

    // Check bonuses after
    const afterStats = (await players.players(playerId)).totalStats;
    expect(afterStats.melee).to.eq(2);
    expect(afterStats.range).to.eq(0);
    expect(afterStats.magic).to.eq(0);
    expect(afterStats.meleeDefence).to.eq(-1);
    expect(afterStats.rangeDefence).to.eq(0);
    expect(afterStats.magicDefence).to.eq(0);
    expect(afterStats.health).to.eq(12);

    expect((await players.players(playerId)).attire.gauntlets).to.eq(BRONZE_GAUNTLETS);

    // Try equip it on someone else, should fail as we don't have enough
    const avatarId = 1;
    const avatarInfo = {
      name: ethers.utils.formatBytes32String("Name goes here1"),
      description: "Hi I'm a description",
      imageURI: "1234.png",
    };
    await playerNFT.setAvatar(avatarId, avatarInfo);

    const newPlayerId = await createPlayer(playerNFT, avatarId, alice, ethers.utils.formatBytes32String("0xSamWitch"));
    await expect(players.connect(alice).equip(newPlayerId, BRONZE_GAUNTLETS)).to.be.reverted; // Not active player

    // Mint another one and try again, first trying to connect same item to the same player
    await players.connect(alice).setActivePlayer(newPlayerId);
    await players.connect(alice).equip(newPlayerId, BRONZE_GAUNTLETS);

    expect((await players.players(playerId)).attire.gauntlets).to.eq(NONE);
    expect((await players.players(newPlayerId)).attire.gauntlets).to.eq(BRONZE_GAUNTLETS);
  }); */

  /* Disabled for now as not used?
  it("Remove action", async () => {
    const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);

    // Can only remove an action if it hasn't started yet.
    const queuedActions: QueuedAction[] = [];
    const rate = 100 * 100; // per hour
    const tx = await world.addAction({
      actionId: 1,
      info: {
        skill: Skill.WOODCUTTING,
        xpPerHour: 3600,
        minSkillPoints: 0,
        isDynamic: false,
        numSpawn: 0,
        handItemTokenIdRangeMin: BRONZE_AXE,
        handItemTokenIdRangeMax: WOODCUTTING_MAX,
        isAvailable: actionIsAvailable,
        isCombat: false,
      },
      guaranteedRewards: [{itemTokenId: LOG, rate}],
      randomRewards: [],
      combatStats: emptyCombatStats,
    });
    const actionId = await getActionId(tx);
    await itemNFT.addItem({
      ...defaultInputItem,
      tokenId: BRONZE_AXE,
      equipPosition: EquipPosition.RIGHT_HAND,
      metadataURI: "someIPFSURI.json",
    });
    const timespan = 7200;
    const queuedAction: QueuedAction = {
      attire: noAttire,
      actionId,
      skill: Skill.WOODCUTTING,
      choiceId: NONE,
      choiceId1: NONE,
      choiceId2: NONE,
      regenerateId: NONE,
      timespan,
      rightHandEquipmentTokenId: BRONZE_AXE,
      leftHandEquipmentTokenId: NONE,
      startTime: "0",
    };

    // Queue same ones multiple times
    queuedActions.push(queuedAction);
    queuedActions.push(queuedAction);
    queuedActions.push(queuedAction);

    await itemNFT.addItem({
      ...defaultInputItem,
      tokenId: LOG,
      equipPosition: EquipPosition.AUX,
      metadataURI: "someIPFSURI.json",
    });

    // This should fail because they don't have any logs. (Maybe later this detects from previous actions)
    await players.connect(alice).startActions(playerId, queuedActions, NONE, ActionQueueStatus.NONE);

    // Cannot remove the first one because it's already started
    let queueId = 1; // First one starts here
    await expect(players.connect(alice).removeQueuedAction(playerId, queueId)).to.be.reverted;
    expect(await players.actionQueueLength(playerId)).to.eq(3);
    await players.connect(alice).removeQueuedAction(playerId, queueId + 1);
    expect(await players.actionQueueLength(playerId)).to.eq(2);

    // Check the correct one remains
    const actionQueue = await players.getActionQueue(playerId);
    expect(actionQueue[0].attire.queueId).to.eq(queueId);
    expect(actionQueue[1].attire.queueId).to.eq(queueId + 2);
  }); */

  describe("Boosts", () => {
    it("Add Boost, Full consume", async () => {
      const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);

      const boostValue = 10;
      const boostDuration = 3300;
      await itemNFT.addItem({
        ...defaultInputItem,
        tokenId: XP_BOOST,
        equipPosition: EquipPosition.BOOST_VIAL,
        metadataURI: "someIPFSURI.json",
        // Boost
        boostType: BoostType.NON_COMBAT_XP,
        boostValue,
        boostDuration,
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
          handItemTokenIdRangeMin: BRONZE_AXE,
          handItemTokenIdRangeMax: WOODCUTTING_MAX,
          isAvailable: actionIsAvailable,
          actionChoiceRequired: false,
        },
        guaranteedRewards: [{itemTokenId: LOG, rate}],
        randomRewards: [],
        combatStats: emptyCombatStats,
      });
      const actionId = await getActionId(tx);

      await itemNFT.testOnlyMint(alice.address, XP_BOOST, 1);

      const timespan = 3600;
      const queuedAction: QueuedAction = {
        attire: noAttire,
        actionId,
        combatStyle: CombatStyle.NONE,
        choiceId: NONE,
        choiceId1: NONE,
        choiceId2: NONE,
        regenerateId: NONE,
        timespan,
        rightHandEquipmentTokenId: BRONZE_AXE,
        leftHandEquipmentTokenId: NONE,
        startTime: "0",
        isValid: true,
      };

      await itemNFT.addItem({
        ...defaultInputItem,
        tokenId: BRONZE_AXE,
        equipPosition: EquipPosition.RIGHT_HAND,
        metadataURI: "someIPFSURI.json",
      });

      expect(await itemNFT.balanceOf(alice.address, XP_BOOST)).to.eq(1);
      await players.connect(alice).startActions(playerId, [queuedAction], XP_BOOST, ActionQueueStatus.NONE);
      expect(await itemNFT.balanceOf(alice.address, XP_BOOST)).to.eq(0);

      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan + 2]);
      await players.connect(alice).processActions(playerId);
      expect(await players.skillPoints(playerId, Skill.WOODCUTTING)).to.eq(
        queuedAction.timespan + (boostDuration * boostValue) / 100
      ); //
      // Check the drops are as expected
      expect(await itemNFT.balanceOf(alice.address, LOG)).to.eq(Math.floor((timespan * rate) / (3600 * 100)));
    });

    it("Add Boost, partial consume", async () => {
      const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);

      const boostValue = 10;
      await itemNFT.addItem({
        ...defaultInputItem,
        tokenId: XP_BOOST,
        equipPosition: EquipPosition.BOOST_VIAL,
        metadataURI: "someIPFSURI.json",
        // Boost
        boostType: BoostType.NON_COMBAT_XP,
        boostValue,
        boostDuration: 7200,
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
          handItemTokenIdRangeMin: BRONZE_AXE,
          handItemTokenIdRangeMax: WOODCUTTING_MAX,
          isAvailable: actionIsAvailable,
          actionChoiceRequired: false,
        },
        guaranteedRewards: [{itemTokenId: LOG, rate}],
        randomRewards: [],
        combatStats: emptyCombatStats,
      });
      const actionId = await getActionId(tx);

      await itemNFT.testOnlyMint(alice.address, XP_BOOST, 1);

      const timespan = 3600;
      const queuedAction: QueuedAction = {
        attire: noAttire,
        actionId,
        combatStyle: CombatStyle.NONE,
        choiceId: NONE,
        choiceId1: NONE,
        choiceId2: NONE,
        regenerateId: NONE,
        timespan,
        rightHandEquipmentTokenId: BRONZE_AXE,
        leftHandEquipmentTokenId: NONE,
        startTime: "0",
        isValid: true,
      };

      await itemNFT.addItem({
        ...defaultInputItem,
        tokenId: BRONZE_AXE,
        equipPosition: EquipPosition.RIGHT_HAND,
        metadataURI: "someIPFSURI.json",
      });

      expect(await itemNFT.balanceOf(alice.address, XP_BOOST)).to.eq(1);
      await players.connect(alice).startActions(playerId, [queuedAction], XP_BOOST, ActionQueueStatus.NONE);
      expect(await itemNFT.balanceOf(alice.address, XP_BOOST)).to.eq(0);

      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan + 2]);
      await players.connect(alice).processActions(playerId);
      expect(await players.skillPoints(playerId, Skill.WOODCUTTING)).to.eq(
        queuedAction.timespan + (queuedAction.timespan * boostValue) / 100
      ); //
      // Check the drops are as expected
      expect(await itemNFT.balanceOf(alice.address, LOG)).to.eq(Math.floor((timespan * rate) / (3600 * 100)));
    });
  });
});
