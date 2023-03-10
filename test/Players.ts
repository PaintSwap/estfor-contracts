import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {expect} from "chai";
import {ethers, upgrades} from "hardhat";
import {
  ActionQueueStatus,
  AIR_SCROLL,
  BoostType,
  BRONZE_ARROW,
  BRONZE_AXE,
  BRONZE_BAR,
  BRONZE_GAUNTLETS,
  BRONZE_PICKAXE,
  BRONZE_SHIELD,
  BRONZE_SWORD,
  COAL_ORE,
  CombatStats,
  CombatStyle,
  COMBAT_BASE,
  COMBAT_MAX,
  COOKED_HUPPY,
  COPPER_ORE,
  createPlayer,
  emptyActionChoice,
  emptyStats,
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
  SHADOW_SCROLL,
  Skill,
  STAFF_OF_THE_PHOENIX,
  WOODCUTTING_BASE,
  WOODCUTTING_MAX,
  XP_BOOST,
  HELL_SCROLL,
  COOKED_BOWFISH,
  RUBY,
  LEAF_FRAGMENTS,
} from "../scripts/utils";
import {PlayerNFT, PlayersImplRewards__factory} from "../typechain-types";

const actionIsAvailable = true;

describe("Players", () => {
  async function deployContracts() {
    const [owner, alice] = await ethers.getSigners();

    const MockBrushToken = await ethers.getContractFactory("MockBrushToken");
    const brush = await MockBrushToken.deploy();

    const MockOracleClient = await ethers.getContractFactory("MockOracleClient");
    const mockOracleClient = await MockOracleClient.deploy();

    // Create the world
    const subscriptionId = 2;
    const World = await ethers.getContractFactory("World");
    const world = await upgrades.deployProxy(World, [mockOracleClient.address, subscriptionId], {
      kind: "uups",
    });

    const Shop = await ethers.getContractFactory("Shop");
    const shop = await upgrades.deployProxy(Shop, [brush.address], {
      kind: "uups",
      unsafeAllow: ["delegatecall"],
    });

    const buyPath = [alice.address, brush.address];
    const MockRouter = await ethers.getContractFactory("MockRouter");
    const router = await MockRouter.deploy();
    const RoyaltyReceiver = await ethers.getContractFactory("RoyaltyReceiver");
    const royaltyReceiver = await RoyaltyReceiver.deploy(router.address, shop.address, brush.address, buyPath);

    // Create NFT contract which contains all items
    const ItemNFT = await ethers.getContractFactory("ItemNFT");
    const itemNFT = await upgrades.deployProxy(ItemNFT, [world.address, shop.address, royaltyReceiver.address], {
      kind: "uups",
      unsafeAllow: ["delegatecall"],
    });

    await shop.setItemNFT(itemNFT.address);
    // Create NFT contract which contains all the players
    const PlayerNFT = await ethers.getContractFactory("PlayerNFT");
    const editNameCost = 5000;
    const playerNFT = (await upgrades.deployProxy(
      PlayerNFT,
      [brush.address, shop.address, royaltyReceiver.address, editNameCost],
      {
        kind: "uups",
      }
    )) as PlayerNFT;

    // This contains all the player data
    const PlayerLibrary = await ethers.getContractFactory("PlayerLibrary");
    const playerLibrary = await PlayerLibrary.deploy();

    const PlayersImplQueueActions = await ethers.getContractFactory("PlayersImplQueueActions");
    const playersImplQueueActions = await PlayersImplQueueActions.deploy();

    const PlayersImplProcessActions = await ethers.getContractFactory("PlayersImplProcessActions", {
      libraries: {PlayerLibrary: playerLibrary.address},
    });
    const playersImplProcessActions = await PlayersImplProcessActions.deploy();

    const PlayersImplRewards = await ethers.getContractFactory("PlayersImplRewards", {
      libraries: {PlayerLibrary: playerLibrary.address},
    });
    const playersImplRewards = await PlayersImplRewards.deploy();

    const Players = await ethers.getContractFactory("Players", {
      libraries: {PlayerLibrary: playerLibrary.address},
    });

    const players = await upgrades.deployProxy(
      Players,
      [
        itemNFT.address,
        playerNFT.address,
        world.address,
        playersImplQueueActions.address,
        playersImplProcessActions.address,
        playersImplRewards.address,
      ],
      {
        kind: "uups",
        unsafeAllow: ["delegatecall", "external-library-linking"],
      }
    );

    await itemNFT.setPlayers(players.address);
    await playerNFT.setPlayers(players.address);

    const avatarId = 1;
    const avatarInfo = {
      name: ethers.utils.formatBytes32String("Name goes here"),
      description: "Hi I'm a description",
      imageURI: "1234.png",
    };
    await playerNFT.setAvatar(avatarId, avatarInfo);

    // Create player
    const origName = "0xSamWitch";
    const makeActive = true;
    const playerId = await createPlayer(
      playerNFT,
      avatarId,
      alice,
      ethers.utils.formatBytes32String(origName),
      makeActive
    );
    await players.connect(alice).setActivePlayer(playerId);
    const maxTime = await players.MAX_TIME();

    return {
      playerId,
      players,
      playerNFT,
      itemNFT,
      brush,
      maxTime,
      owner,
      world,
      alice,
      origName,
      editNameCost,
      mockOracleClient,
      avatarInfo,
    };
  }

  it("Skill points", async () => {
    const {playerId, players, itemNFT, world, alice} = await loadFixture(deployContracts);

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
      combatStats: emptyStats,
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
    const {playerId, players, itemNFT, world, alice} = await loadFixture(deployContracts);

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
      combatStats: emptyStats,
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
    const {playerId, players, itemNFT, world, alice} = await loadFixture(deployContracts);

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
      combatStats: emptyStats,
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
    const {playerId, players, itemNFT, world, alice} = await loadFixture(deployContracts);

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
      combatStats: emptyStats,
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
    const {playerId, players, itemNFT, world, alice, maxTime} = await loadFixture(deployContracts);

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
      combatStats: emptyStats,
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
    const {playerId, players, itemNFT, world, alice} = await loadFixture(deployContracts);

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
      combatStats: emptyStats,
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
    await expect(players.addXPThresholdReward({xpThreshold: 499, equipments})).to.be.reverted;
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
    const {playerId, players, itemNFT, world, alice} = await loadFixture(deployContracts);

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
      combatStats: emptyStats,
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
    const {playerId, players, itemNFT, world, alice} = await loadFixture(deployContracts);

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
      combatStats: emptyStats,
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

  /*  it("Check already equipped", async () => {
    const {playerId, players, playerNFT, itemNFT, alice} = await loadFixture(deployContracts);
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
    const {playerId, players, itemNFT, world, alice} = await loadFixture(deployContracts);

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
      combatStats: emptyStats,
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
      const {playerId, players, itemNFT, world, alice} = await loadFixture(deployContracts);

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
        combatStats: emptyStats,
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
      const {playerId, players, itemNFT, world, alice} = await loadFixture(deployContracts);

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
        combatStats: emptyStats,
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

  describe("Non-Combat Actions", () => {
    // Test minSkillPoints
    // Test isDynamic
    // Test incorrect item position and range
    it("Woodcutting", async () => {
      const {playerId, players, itemNFT, world, alice} = await loadFixture(deployContracts);

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
        combatStats: emptyStats,
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

      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan + 2]);
      await ethers.provider.send("evm_mine", []);

      const playerDelegateView = await ethers.getContractAt("PlayerDelegateView", players.address);
      const pendingOutput = await playerDelegateView.pendingRewards(alice.address, playerId, {
        includeLoot: true,
        includePastRandomRewards: true,
        includeXPRewards: true,
      });
      expect(pendingOutput.consumed.length).is.eq(0);
      expect(pendingOutput.produced.length).is.eq(1);
      expect(pendingOutput.produced[0].itemTokenId).is.eq(LOG);
      const balanceExpected = Math.floor((timespan * rate) / (3600 * 100));
      expect(pendingOutput.produced[0].amount).is.eq(balanceExpected);
      await players.connect(alice).processActions(playerId);
      expect(await players.skillPoints(playerId, Skill.WOODCUTTING)).to.eq(queuedAction.timespan);
      // Check the drops are as expected
      expect(await itemNFT.balanceOf(alice.address, LOG)).to.eq(balanceExpected);
    });

    it("Woodcutting, full nature equipment", async () => {
      const {playerId, players, itemNFT, world, alice} = await loadFixture(deployContracts);

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
        combatStats: emptyStats,
      });
      const actionId = await getActionId(tx);

      const timespan = 3600;

      await itemNFT.addItem({
        ...defaultInputItem,
        tokenId: BRONZE_AXE,
        equipPosition: EquipPosition.RIGHT_HAND,
        metadataURI: "someIPFSURI.json",
      });

      await itemNFT.addItem({
        ...defaultInputItem,
        tokenId: NATURE_MASK,
        equipPosition: EquipPosition.HEAD,
        metadataURI: "someIPFSURI.json",
      });

      await itemNFT.addItem({
        ...defaultInputItem,
        tokenId: NATURE_BODY,
        equipPosition: EquipPosition.BODY,
        metadataURI: "someIPFSURI.json",
      });

      await itemNFT.addItem({
        ...defaultInputItem,
        tokenId: NATURE_BRACERS,
        equipPosition: EquipPosition.ARMS,
        metadataURI: "someIPFSURI.json",
      });

      await itemNFT.addItem({
        ...defaultInputItem,
        tokenId: NATURE_TROUSERS,
        equipPosition: EquipPosition.LEGS,
        metadataURI: "someIPFSURI.json",
      });

      await itemNFT.addItem({
        ...defaultInputItem,
        tokenId: NATURE_BOOTS,
        equipPosition: EquipPosition.BOOTS,
        metadataURI: "someIPFSURI.json",
      });

      const queuedAction: QueuedAction = {
        attire: {
          helmet: NATURE_MASK,
          amulet: NONE,
          armor: NATURE_BODY,
          gauntlets: NATURE_BRACERS,
          tassets: NATURE_TROUSERS,
          boots: NATURE_BOOTS,
          ring: NONE, // Always NONE for now
          reserved1: NONE, // Always NONE for now
          queueId: 0, // Doesn't matter
        },
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

      await itemNFT.testOnlyMints(
        alice.address,
        [NATURE_MASK, NATURE_BODY, NATURE_BRACERS, NATURE_TROUSERS, NATURE_BOOTS],
        [1, 1, 1, 1, 1]
      );

      await players.connect(alice).startAction(playerId, queuedAction, ActionQueueStatus.NONE);

      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan + 2]);
      const balanceExpected = Math.floor((timespan * rate) / (3600 * 100));
      await players.connect(alice).processActions(playerId);
      expect(await players.skillPoints(playerId, Skill.WOODCUTTING)).to.eq(
        queuedAction.timespan + queuedAction.timespan * 0.03
      );
      // Check the drops are as expected
      expect(await itemNFT.balanceOf(alice.address, LOG)).to.eq(balanceExpected);
    });

    it("Firemaking", async () => {
      const {playerId, players, itemNFT, world, alice} = await loadFixture(deployContracts);
      const rate = 100 * 100; // per hour
      let tx = await world.addAction({
        actionId: 1,
        info: {
          skill: Skill.FIREMAKING,
          xpPerHour: 0,
          minSkillPoints: 0,
          isDynamic: false,
          numSpawn: 0,
          handItemTokenIdRangeMin: FIRE_LIGHTER,
          handItemTokenIdRangeMax: FIRE_MAX,
          isAvailable: actionIsAvailable,
          actionChoiceRequired: true,
        },
        guaranteedRewards: [],
        randomRewards: [],
        combatStats: emptyStats,
      });
      const actionId = await getActionId(tx);

      // Logs go in, nothing comes out
      tx = await world.addActionChoice(actionId, {
        skill: Skill.FIREMAKING,
        diff: 0,
        xpPerHour: 3600,
        minSkillPoints: 0,
        rate,
        inputTokenId1: LOG,
        num1: 1,
        inputTokenId2: NONE,
        num2: 0,
        inputTokenId3: NONE,
        num3: 0,
        outputTokenId: NONE,
        outputNum: 0,
      });
      const choiceId = await getActionChoiceId(tx);

      const timespan = 3600;
      const queuedAction: QueuedAction = {
        attire: noAttire,
        actionId,
        combatStyle: CombatStyle.NONE,
        choiceId,
        choiceId1: NONE,
        choiceId2: NONE,
        regenerateId: NONE,
        timespan,
        rightHandEquipmentTokenId: FIRE_LIGHTER,
        leftHandEquipmentTokenId: NONE,
        startTime: "0",
        isValid: true,
      };

      await itemNFT.addItem({
        ...defaultInputItem,
        tokenId: FIRE_LIGHTER,
        equipPosition: EquipPosition.RIGHT_HAND,
        metadataURI: "someIPFSURI.json",
      });

      await itemNFT.addItem({
        ...defaultInputItem,
        tokenId: LOG,
        equipPosition: EquipPosition.AUX,
        metadataURI: "someIPFSURI.json",
      });

      await itemNFT.testOnlyMint(alice.address, LOG, 5); // Mint less than will be used

      await players.connect(alice).startAction(playerId, queuedAction, ActionQueueStatus.NONE);

      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan + 2]);
      await players.connect(alice).processActions(playerId);
      expect(await players.skillPoints(playerId, Skill.FIREMAKING)).to.eq(queuedAction.timespan);

      // Check how many logs they have now, 100 logs burnt per hour
      expect(await itemNFT.balanceOf(alice.address, LOG)).to.eq(0);
    });

    it("Multi skill appending, woodcutting + firemaking", async () => {
      const {playerId, players, itemNFT, world, alice} = await loadFixture(deployContracts);
      const queuedActions: QueuedAction[] = [];
      const rate = 1220 * 100; // per hour
      {
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
          combatStats: emptyStats,
        });
        const actionId = await getActionId(tx);
        await itemNFT.addItem({
          ...defaultInputItem,
          tokenId: BRONZE_AXE,
          equipPosition: EquipPosition.RIGHT_HAND,
          metadataURI: "someIPFSURI.json",
        });
        const timespan = 7200 + 10;
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

        queuedActions.push(queuedAction);
      }
      {
        let tx = await world.addAction({
          actionId: 2,
          info: {
            skill: Skill.FIREMAKING,
            xpPerHour: 0,
            minSkillPoints: 0,
            isDynamic: false,
            numSpawn: 0,
            handItemTokenIdRangeMin: FIRE_LIGHTER,
            handItemTokenIdRangeMax: FIRE_MAX,
            isAvailable: actionIsAvailable,
            actionChoiceRequired: true,
          },
          guaranteedRewards: [],
          randomRewards: [],
          combatStats: emptyStats,
        });
        const actionId = await getActionId(tx);

        // Logs go in, nothing comes out
        tx = await world.addActionChoice(actionId, {
          skill: Skill.FIREMAKING,
          diff: 0,
          xpPerHour: 3600,
          minSkillPoints: 0,
          rate,
          inputTokenId1: LOG,
          num1: 1,
          inputTokenId2: NONE,
          num2: 0,
          inputTokenId3: NONE,
          num3: 0,
          outputTokenId: NONE,
          outputNum: 0,
        });
        const choiceId = await getActionChoiceId(tx);

        await itemNFT.testOnlyMint(alice.address, FIRE_LIGHTER, 1);
        await itemNFT.addItem({
          ...defaultInputItem,
          tokenId: FIRE_LIGHTER,
          equipPosition: EquipPosition.RIGHT_HAND,
          metadataURI: "someIPFSURI.json",
        });
        const timespan = 3600;

        const queuedAction: QueuedAction = {
          attire: noAttire,
          actionId,
          combatStyle: CombatStyle.NONE,
          choiceId,
          choiceId1: NONE,
          choiceId2: NONE,
          regenerateId: NONE,
          timespan,
          rightHandEquipmentTokenId: FIRE_LIGHTER,
          leftHandEquipmentTokenId: NONE,
          startTime: "0",
          isValid: true,
        };

        queuedActions.push(queuedAction);
      }

      await itemNFT.addItem({
        ...defaultInputItem,
        tokenId: LOG,
        equipPosition: EquipPosition.AUX,
        metadataURI: "someIPFSURI.json",
      });

      await players.connect(alice).startAction(playerId, queuedActions[0], ActionQueueStatus.APPEND);
      await ethers.provider.send("evm_increaseTime", [10]);
      await players.connect(alice).startAction(playerId, queuedActions[1], ActionQueueStatus.APPEND);
      expect(await players.skillPoints(playerId, Skill.WOODCUTTING)).to.eq(10); // Should be partially completed
      expect(await itemNFT.balanceOf(alice.address, LOG)).to.eq(3);
      await ethers.provider.send("evm_increaseTime", [queuedActions[0].timespan + queuedActions[1].timespan]);
      expect(await players.actionQueueLength(playerId)).to.eq(2);

      await players.connect(alice).processActions(playerId);
      expect(await players.skillPoints(playerId, Skill.WOODCUTTING)).to.eq(queuedActions[0].timespan);
      expect(await players.skillPoints(playerId, Skill.FIREMAKING)).to.eq(queuedActions[1].timespan);
      // Check how many logs they have now, 1220 logs burnt per hour, 2 hours producing logs, 1 hour burning
      expect(await itemNFT.balanceOf(alice.address, LOG)).to.eq(
        Math.floor((queuedActions[0].timespan * rate) / (3600 * 100)) - rate / 100
      );
      // Action queue should be empty
      expect(await players.actionQueueLength(playerId)).to.eq(0);
    });

    it("Multi skill, woodcutting + firemaking", async () => {
      const {playerId, players, itemNFT, world, alice} = await loadFixture(deployContracts);
      const queuedActions: QueuedAction[] = [];
      const rate = 100 * 100; // per hour
      {
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
          combatStats: emptyStats,
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

        queuedActions.push(queuedAction);
      }
      {
        let tx = await world.addAction({
          actionId: 2,
          info: {
            skill: Skill.FIREMAKING,
            xpPerHour: 0,
            minSkillPoints: 0,
            isDynamic: false,
            numSpawn: 0,
            handItemTokenIdRangeMin: FIRE_LIGHTER,
            handItemTokenIdRangeMax: FIRE_MAX,
            isAvailable: actionIsAvailable,
            actionChoiceRequired: true,
          },
          guaranteedRewards: [],
          randomRewards: [],
          combatStats: emptyStats,
        });
        const actionId = await getActionId(tx);

        // Logs go in, nothing comes out
        tx = await world.addActionChoice(actionId, {
          skill: Skill.FIREMAKING,
          diff: 0,
          xpPerHour: 3600,
          minSkillPoints: 0,
          rate,
          inputTokenId1: LOG,
          num1: 1,
          inputTokenId2: NONE,
          num2: 0,
          inputTokenId3: NONE,
          num3: 0,
          outputTokenId: NONE,
          outputNum: 0,
        });
        const choiceId = await getActionChoiceId(tx);

        await itemNFT.testOnlyMint(alice.address, FIRE_LIGHTER, 1);
        await itemNFT.addItem({
          ...defaultInputItem,
          tokenId: FIRE_LIGHTER,
          equipPosition: EquipPosition.RIGHT_HAND,
          metadataURI: "someIPFSURI.json",
        });
        const timespan = 3600;

        const queuedAction: QueuedAction = {
          attire: noAttire,
          actionId,
          combatStyle: CombatStyle.NONE,
          choiceId,
          choiceId1: NONE,
          choiceId2: NONE,
          regenerateId: NONE,
          timespan,
          rightHandEquipmentTokenId: FIRE_LIGHTER,
          leftHandEquipmentTokenId: NONE,
          startTime: "0",
          isValid: true,
        };

        queuedActions.push(queuedAction);
      }

      await itemNFT.addItem({
        ...defaultInputItem,
        tokenId: LOG,
        equipPosition: EquipPosition.AUX,
        metadataURI: "someIPFSURI.json",
      });

      // This should fail because they don't have any logs. (Maybe later this detects from previous actions)
      await expect(players.connect(alice).startActions(playerId, queuedActions, NONE, ActionQueueStatus.NONE)).to.be
        .reverted;

      await itemNFT.testOnlyMint(alice.address, LOG, 1);
      await players.connect(alice).startActions(playerId, queuedActions, NONE, ActionQueueStatus.NONE);

      await ethers.provider.send("evm_increaseTime", [queuedActions[0].timespan + queuedActions[1].timespan + 2]);
      await players.connect(alice).processActions(playerId);
      expect(await players.skillPoints(playerId, Skill.WOODCUTTING)).to.eq(queuedActions[0].timespan);
      expect(await players.skillPoints(playerId, Skill.FIREMAKING)).to.eq(queuedActions[1].timespan);
      // Check how many logs they have now, 100 logs burnt per hour, 2 hours producing logs, 1 hour burning
      expect(await itemNFT.balanceOf(alice.address, LOG)).to.eq(
        Math.floor((queuedActions[0].timespan * rate) / (3600 * 100)) -
          Math.floor((queuedActions[1].timespan * rate) / (3600 * 100)) +
          1
      );
      expect(await players.actionQueueLength(playerId)).to.eq(0);
    });

    it("Mining", async () => {
      const {playerId, players, itemNFT, world, alice} = await loadFixture(deployContracts);

      const tx = await world.addAction({
        actionId: 1,
        info: {
          skill: Skill.MINING,
          xpPerHour: 3600,
          minSkillPoints: 0,
          isDynamic: false,
          numSpawn: 0,
          handItemTokenIdRangeMin: BRONZE_PICKAXE,
          handItemTokenIdRangeMax: MINING_MAX,
          isAvailable: actionIsAvailable,
          actionChoiceRequired: false,
        },
        guaranteedRewards: [{itemTokenId: COPPER_ORE, rate: 100}], // 100.00
        randomRewards: [],
        combatStats: emptyStats,
      });

      const actionId = await getActionId(tx);

      await itemNFT.testOnlyMint(alice.address, BRONZE_PICKAXE, 1);
      const queuedAction: QueuedAction = {
        attire: noAttire,
        actionId,
        combatStyle: CombatStyle.NONE,
        choiceId: NONE,
        choiceId1: NONE,
        choiceId2: NONE,
        regenerateId: NONE,
        timespan: 100,
        rightHandEquipmentTokenId: BRONZE_PICKAXE,
        leftHandEquipmentTokenId: NONE,
        startTime: "0",
        isValid: true,
      };

      await itemNFT.addItem({
        ...defaultInputItem,
        tokenId: BRONZE_PICKAXE,
        equipPosition: EquipPosition.RIGHT_HAND,
        metadataURI: "someIPFSURI.json",
      });

      await players.connect(alice).startAction(playerId, queuedAction, ActionQueueStatus.NONE);

      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan + 2]);
      await players.connect(alice).processActions(playerId);
      expect(await players.skillPoints(playerId, Skill.MINING)).to.eq(queuedAction.timespan);
    });

    it("Smithing", async () => {
      const {playerId, players, itemNFT, world, alice} = await loadFixture(deployContracts);
      const rate = 100 * 100; // per hour

      let tx = await world.addAction({
        actionId: 1,
        info: {
          skill: Skill.SMITHING,
          xpPerHour: 0,
          minSkillPoints: 0,
          isDynamic: false,
          numSpawn: 0,
          handItemTokenIdRangeMin: NONE,
          handItemTokenIdRangeMax: NONE,
          isAvailable: actionIsAvailable,
          actionChoiceRequired: true,
        },
        guaranteedRewards: [],
        randomRewards: [],
        combatStats: emptyStats,
      });
      const actionId = await getActionId(tx);

      // Ores go in, bars come out
      tx = await world.addActionChoice(actionId, {
        skill: Skill.SMITHING,
        diff: 0,
        xpPerHour: 3600,
        minSkillPoints: 0,
        rate,
        inputTokenId1: COAL_ORE,
        num1: 2,
        inputTokenId2: MITHRIL_ORE,
        num2: 1,
        inputTokenId3: NONE,
        num3: 0,
        outputTokenId: MITHRIL_BAR,
        outputNum: 1,
      });
      const choiceId = await getActionChoiceId(tx);

      const timespan = 3600;

      const queuedAction: QueuedAction = {
        attire: noAttire,
        actionId,
        combatStyle: CombatStyle.NONE,
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
        tokenId: COAL_ORE,
        equipPosition: EquipPosition.AUX,
        metadataURI: "someIPFSURI.json",
      });

      await itemNFT.addItem({
        ...defaultInputItem,
        tokenId: MITHRIL_ORE,
        equipPosition: EquipPosition.AUX,
        metadataURI: "someIPFSURI.json",
      });

      await itemNFT.testOnlyMint(alice.address, COAL_ORE, 255);
      await itemNFT.testOnlyMint(alice.address, MITHRIL_ORE, 255);
      await players.connect(alice).startAction(playerId, queuedAction, ActionQueueStatus.NONE);

      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan + 2]);
      await players.connect(alice).processActions(playerId);
      expect(await players.skillPoints(playerId, Skill.SMITHING)).to.eq(queuedAction.timespan);

      // Check how many bars they have now, 100 bars created per hour, burns 2 coal and 1 mithril
      expect(await itemNFT.balanceOf(alice.address, MITHRIL_BAR)).to.eq(Math.floor((timespan * rate) / (3600 * 100)));
      expect(await itemNFT.balanceOf(alice.address, COAL_ORE)).to.eq(
        255 - Math.floor((timespan * rate) / (3600 * 100)) * 2
      );
      expect(await itemNFT.balanceOf(alice.address, MITHRIL_ORE)).to.eq(
        255 - Math.floor((timespan * rate) / (3600 * 100))
      );
    });

    it("Set past max timespan ", async () => {
      const {playerId, players, itemNFT, world, alice, maxTime} = await loadFixture(deployContracts);

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
        combatStats: emptyStats,
      });
      const actionId = await getActionId(tx);

      const timespan = maxTime + 1; // Exceed maximum
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

      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan + 2]);
      await players.connect(alice).processActions(playerId);
      expect(await players.skillPoints(playerId, Skill.WOODCUTTING)).to.eq(queuedAction.timespan - 1);
      // Check the drops are as expected
      expect(await itemNFT.balanceOf(alice.address, LOG)).to.eq(
        Math.floor(((queuedAction.timespan - 1) * rate) / (3600 * 100))
      );
    });

    // TODO Rest of the actions

    it("Low rate action (more than 1 hour needed)", async () => {
      const {playerId, players, itemNFT, world, alice} = await loadFixture(deployContracts);
      await itemNFT.addItem({
        ...defaultInputItem,
        tokenId: BRONZE_AXE,
        equipPosition: EquipPosition.RIGHT_HAND,
        metadataURI: "someIPFSURI.json",
      });

      const rate = 0.1 * 100; // 0.1 per hour
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
        combatStats: emptyStats,
      });

      const actionId = await getActionId(tx);
      const timespan = 3600 * 19; // Should make 1
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

      await players.connect(alice).startAction(playerId, queuedAction, ActionQueueStatus.NONE);
      await ethers.provider.send("evm_increaseTime", [timespan]);
      await players.connect(alice).processActions(playerId);
      //      expect(await players.skillPoints(playerId, Skill.WOODCUTTING)).to.be.oneOf([361, 362]);
      expect(await itemNFT.balanceOf(alice.address, LOG)).to.eq(1); // Should be rounded down
    });

    it("Incorrect equipment", async () => {
      const {playerId, players, itemNFT, world, alice, owner} = await loadFixture(deployContracts);

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
        combatStats: emptyStats,
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
        rightHandEquipmentTokenId: BRONZE_PICKAXE, // Incorrect
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

      await itemNFT.addItem({
        ...defaultInputItem,
        tokenId: BRONZE_PICKAXE,
        equipPosition: EquipPosition.RIGHT_HAND,
        metadataURI: "someIPFSURI.json",
      });

      // Incorrect equipment
      await expect(players.connect(alice).startAction(playerId, queuedAction, ActionQueueStatus.NONE)).to.be.reverted;

      // No equipment specified but is required
      queuedAction.rightHandEquipmentTokenId = NONE;
      await expect(players.connect(alice).startAction(playerId, queuedAction, ActionQueueStatus.NONE)).to.be.reverted;

      queuedAction.rightHandEquipmentTokenId = BRONZE_AXE;
      // This works
      await players.connect(alice).startAction(playerId, queuedAction, ActionQueueStatus.NONE);
      // Specifying a combat style should fail
      queuedAction.combatStyle = CombatStyle.MELEE;
      await expect(players.connect(alice).startAction(playerId, queuedAction, ActionQueueStatus.NONE)).to.be.reverted;

      // Transfer away, the action should just be skipped and no xp/loot should be given
      expect(await itemNFT.balanceOf(alice.address, BRONZE_AXE)).to.eq(1);
      await itemNFT.connect(alice).safeTransferFrom(alice.address, owner.address, BRONZE_AXE, 1, "0x");
      expect(await itemNFT.balanceOf(alice.address, BRONZE_AXE)).to.eq(0);
      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]);
      await players.connect(alice).processActions(playerId);
      expect(await players.skillPoints(playerId, Skill.WOODCUTTING)).to.eq(0);
      expect(await itemNFT.balanceOf(alice.address, LOG)).to.eq(0);
    });

    it("Action pipelining", async () => {
      // Try wood cut, and then burning them when having none equipped
    });

    it("Attire, equipment and conusmeable minSkillPoints", async () => {
      // TODO
    });

    it("Action minSkillPoints", async () => {
      // TODO
    });

    it("ActionChoice minSkillPoints", async () => {
      // TODO
    });
  });

  describe("Combat Actions", () => {
    it("Melee", async () => {
      const {playerId, players, itemNFT, world, alice} = await loadFixture(deployContracts);

      const monsterCombatStats: CombatStats = {
        melee: 3,
        magic: 0,
        range: 0,
        meleeDefence: 0,
        magicDefence: 0,
        rangeDefence: 0,
        health: 1,
      };

      const rate = 1 * 100; // per hour
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
        guaranteedRewards: [{itemTokenId: BRONZE_ARROW, rate}],
        randomRewards: [],
        combatStats: monsterCombatStats,
      });
      const actionId = await getActionId(tx);

      tx = await world.addActionChoice(NONE, {
        ...emptyActionChoice,
        skill: Skill.ATTACK,
      });
      const choiceId = await getActionChoiceId(tx);
      await itemNFT.testOnlyMint(alice.address, BRONZE_SWORD, 1);
      await itemNFT.testOnlyMint(alice.address, COOKED_HUPPY, 255);
      const timespan = 3600;
      const queuedAction: QueuedAction = {
        attire: noAttire,
        actionId,
        combatStyle: CombatStyle.MELEE,
        choiceId,
        choiceId1: NONE,
        choiceId2: NONE,
        regenerateId: COOKED_HUPPY,
        timespan,
        rightHandEquipmentTokenId: BRONZE_SWORD,
        leftHandEquipmentTokenId: NONE,
        startTime: "0",
        isValid: true,
      };

      await itemNFT.addItem({
        ...defaultInputItem,
        combatStats: {
          ...emptyStats,
          melee: 5,
        },
        tokenId: BRONZE_SWORD,
        equipPosition: EquipPosition.RIGHT_HAND,
        metadataURI: "someIPFSURI.json",
      });

      await itemNFT.addItem({
        ...defaultInputItem,
        tokenId: BRONZE_ARROW,
        equipPosition: EquipPosition.ARROW_SATCHEL,
        metadataURI: "someIPFSURI.json",
      });

      await itemNFT.addItem({
        ...defaultInputItem,
        healthRestored: 12,
        tokenId: COOKED_HUPPY,
        equipPosition: EquipPosition.FOOD,
        metadataURI: "someIPFSURI.json",
      });

      await players.connect(alice).startAction(playerId, queuedAction, ActionQueueStatus.NONE);

      const time = 3600;
      await ethers.provider.send("evm_increaseTime", [time]);
      await players.connect(alice).processActions(playerId);
      expect(await players.skillPoints(playerId, Skill.ATTACK)).to.be.oneOf([time, time + 1]);
      expect(await players.skillPoints(playerId, Skill.DEFENCE)).to.eq(0);

      // Check the drops are as expected
      expect(await itemNFT.balanceOf(alice.address, BRONZE_ARROW)).to.eq(Math.floor((time * rate) / (3600 * 100)));

      // Check food is consumed
      expect(await itemNFT.balanceOf(alice.address, COOKED_HUPPY)).to.eq(255 - 30);
    });

    it("Melee, combat don't kill anything", async () => {
      const {playerId, players, itemNFT, world, alice} = await loadFixture(deployContracts);

      const monsterCombatStats: CombatStats = {
        melee: 3,
        magic: 0,
        range: 0,
        meleeDefence: 0,
        magicDefence: 0,
        rangeDefence: 0,
        health: 1,
      };

      const rate = 1 * 100; // per hour
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
        guaranteedRewards: [{itemTokenId: BRONZE_ARROW, rate}],
        randomRewards: [],
        combatStats: monsterCombatStats,
      });
      const actionId = await getActionId(tx);

      tx = await world.addActionChoice(NONE, {
        ...emptyActionChoice,
        skill: Skill.ATTACK,
      });
      const choiceId = await getActionChoiceId(tx);
      await itemNFT.testOnlyMint(alice.address, BRONZE_SWORD, 1);
      await itemNFT.testOnlyMint(alice.address, COOKED_HUPPY, 255);
      const timespan = 3600;
      const queuedAction: QueuedAction = {
        attire: noAttire,
        actionId,
        combatStyle: CombatStyle.MELEE,
        choiceId,
        choiceId1: NONE,
        choiceId2: NONE,
        regenerateId: COOKED_HUPPY,
        timespan,
        rightHandEquipmentTokenId: BRONZE_SWORD,
        leftHandEquipmentTokenId: NONE,
        startTime: "0",
        isValid: true,
      };

      await itemNFT.addItem({
        ...defaultInputItem,
        combatStats: {
          ...emptyStats,
          melee: 5,
        },
        tokenId: BRONZE_SWORD,
        equipPosition: EquipPosition.RIGHT_HAND,
        metadataURI: "someIPFSURI.json",
      });

      await itemNFT.addItem({
        ...defaultInputItem,
        tokenId: BRONZE_ARROW,
        equipPosition: EquipPosition.ARROW_SATCHEL,
        metadataURI: "someIPFSURI.json",
      });

      await itemNFT.addItem({
        ...defaultInputItem,
        healthRestored: 12,
        tokenId: COOKED_HUPPY,
        equipPosition: EquipPosition.FOOD,
        metadataURI: "someIPFSURI.json",
      });

      await players.connect(alice).startAction(playerId, queuedAction, ActionQueueStatus.NONE);

      const time = 360;
      await ethers.provider.send("evm_increaseTime", [time]);
      await players.connect(alice).processActions(playerId);
      expect(await players.skillPoints(playerId, Skill.ATTACK)).to.eq(0);

      // Check the drops are as expected
      expect(await itemNFT.balanceOf(alice.address, BRONZE_ARROW)).to.eq(0);
      // Check food is consumed
      expect(await itemNFT.balanceOf(alice.address, COOKED_HUPPY)).to.eq(255 - 3);
    });

    it("Melee defence", async () => {
      const {playerId, players, itemNFT, world, alice} = await loadFixture(deployContracts);

      const monsterCombatStats: CombatStats = {
        melee: 3,
        magic: 0,
        range: 0,
        meleeDefence: 0,
        magicDefence: 0,
        rangeDefence: 0,
        health: 1,
      };

      const rate = 1 * 100; // per hour
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
        guaranteedRewards: [{itemTokenId: BRONZE_ARROW, rate}],
        randomRewards: [],
        combatStats: monsterCombatStats,
      });
      const actionId = await getActionId(tx);

      tx = await world.addActionChoice(NONE, {
        ...emptyActionChoice,
        skill: Skill.ATTACK,
      });
      const choiceId = await getActionChoiceId(tx);
      await itemNFT.testOnlyMint(alice.address, BRONZE_SWORD, 1);
      await itemNFT.testOnlyMint(alice.address, COOKED_HUPPY, 255);
      const timespan = 3600;
      const queuedAction: QueuedAction = {
        attire: noAttire,
        actionId,
        combatStyle: CombatStyle.MELEE_DEFENCE,
        choiceId,
        choiceId1: NONE,
        choiceId2: NONE,
        regenerateId: COOKED_HUPPY,
        timespan,
        rightHandEquipmentTokenId: BRONZE_SWORD,
        leftHandEquipmentTokenId: NONE,
        startTime: "0",
        isValid: true,
      };

      await itemNFT.addItem({
        ...defaultInputItem,
        combatStats: {
          ...emptyStats,
          melee: 5,
        },
        tokenId: BRONZE_SWORD,
        equipPosition: EquipPosition.RIGHT_HAND,
        metadataURI: "someIPFSURI.json",
      });

      await itemNFT.addItem({
        ...defaultInputItem,
        tokenId: BRONZE_ARROW,
        equipPosition: EquipPosition.ARROW_SATCHEL,
        metadataURI: "someIPFSURI.json",
      });

      await itemNFT.addItem({
        ...defaultInputItem,
        healthRestored: 12,
        tokenId: COOKED_HUPPY,
        equipPosition: EquipPosition.FOOD,
        metadataURI: "someIPFSURI.json",
      });

      await players.connect(alice).startAction(playerId, queuedAction, ActionQueueStatus.NONE);

      const time = 3600;
      await ethers.provider.send("evm_increaseTime", [time]);
      await players.connect(alice).processActions(playerId);
      expect(await players.skillPoints(playerId, Skill.DEFENCE)).to.be.oneOf([time, time + 1]);
      expect(await players.skillPoints(playerId, Skill.ATTACK)).to.eq(0);

      // Check the drops are as expected
      expect(await itemNFT.balanceOf(alice.address, BRONZE_ARROW)).to.eq(Math.floor((time * rate) / (3600 * 100)));

      // Check food is consumed, update later
      expect(await itemNFT.balanceOf(alice.address, COOKED_HUPPY)).to.eq(255 - 30);
    });

    describe("Magic", () => {
      async function deployContractsMagic() {
        const {playerId, players, itemNFT, world, alice} = await loadFixture(deployContracts);

        const monsterCombatStats: CombatStats = {
          melee: 3,
          magic: 0,
          range: 0,
          meleeDefence: 0,
          magicDefence: 0,
          rangeDefence: 0,
          health: 5,
        };

        const dropRate = 1 * 100; // per hour
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
          guaranteedRewards: [{itemTokenId: BRONZE_ARROW, rate: dropRate}],
          randomRewards: [],
          combatStats: monsterCombatStats,
        });
        const actionId = await getActionId(tx);

        await itemNFT.testOnlyMints(
          alice.address,
          [STAFF_OF_THE_PHOENIX, BRONZE_SHIELD, COOKED_HUPPY, AIR_SCROLL, SHADOW_SCROLL],
          [1, 1, 1000, 200, 100]
        );

        const scrollsConsumedRate = 1 * 100; // per hour
        // Combat uses none as it's not tied to a specific action (only combat ones)
        // Fire blast
        tx = await world.addActionChoice(NONE, {
          skill: Skill.MAGIC,
          diff: 2,
          xpPerHour: 0,
          minSkillPoints: 0,
          rate: scrollsConsumedRate,
          inputTokenId1: AIR_SCROLL,
          num1: 2,
          inputTokenId2: SHADOW_SCROLL,
          num2: 1,
          inputTokenId3: NONE,
          num3: 0,
          outputTokenId: NONE,
          outputNum: 0,
        });
        const choiceId = await getActionChoiceId(tx);
        const timespan = 3600;
        const queuedAction: QueuedAction = {
          attire: noAttire,
          actionId,
          combatStyle: CombatStyle.MAGIC,
          choiceId,
          choiceId1: NONE,
          choiceId2: NONE,
          regenerateId: COOKED_HUPPY,
          timespan,
          rightHandEquipmentTokenId: STAFF_OF_THE_PHOENIX,
          leftHandEquipmentTokenId: NONE, // 2 handed, must specify this for both?
          startTime: "0",
          isValid: true,
        };

        await itemNFT.addItems([
          {
            ...defaultInputItem,
            tokenId: AIR_SCROLL,
            equipPosition: EquipPosition.MAGIC_BAG,
            metadataURI: "someIPFSURI.json",
          },
          {
            ...defaultInputItem,
            tokenId: SHADOW_SCROLL,
            equipPosition: EquipPosition.MAGIC_BAG,
            metadataURI: "someIPFSURI.json",
          },
          {
            ...defaultInputItem,
            tokenId: STAFF_OF_THE_PHOENIX,
            equipPosition: EquipPosition.BOTH_HANDS,
            metadataURI: "someIPFSURI.json",
          },
          {
            ...defaultInputItem,
            tokenId: BRONZE_SHIELD,
            equipPosition: EquipPosition.LEFT_HAND,
            metadataURI: "someIPFSURI.json",
          },
          {
            ...defaultInputItem,
            tokenId: BRONZE_ARROW,
            equipPosition: EquipPosition.ARROW_SATCHEL,
            metadataURI: "someIPFSURI.json",
          },
          {
            ...defaultInputItem,
            healthRestored: 12,
            tokenId: COOKED_HUPPY,
            equipPosition: EquipPosition.FOOD,
            metadataURI: "someIPFSURI.json",
          },
        ]);

        return {playerId, players, itemNFT, world, alice, timespan, actionId, dropRate, queuedAction};
      }

      it("Simple", async () => {
        const {playerId, players, itemNFT, alice, timespan, dropRate, queuedAction} = await loadFixture(
          deployContractsMagic
        );

        await players.connect(alice).startAction(playerId, queuedAction, ActionQueueStatus.NONE);

        await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]);
        await players.connect(alice).processActions(playerId);
        expect(await players.skillPoints(playerId, Skill.MAGIC)).to.eq(queuedAction.timespan);
        expect(await players.skillPoints(playerId, Skill.DEFENCE)).to.eq(0);

        // Check the drops are as expected
        expect(await itemNFT.balanceOf(alice.address, BRONZE_ARROW)).to.eq(
          Math.floor((timespan * dropRate) / (3600 * 100))
        );

        // Check food is consumed, update later
        expect(await itemNFT.balanceOf(alice.address, COOKED_HUPPY)).to.eq(1000 - 30);

        // Check that scrolls are consumed
        expect(await itemNFT.balanceOf(alice.address, AIR_SCROLL)).to.eq(200 - 2);
        expect(await itemNFT.balanceOf(alice.address, SHADOW_SCROLL)).to.eq(100 - 1);
      });

      it("No staff equipped", async () => {
        const {playerId, players, itemNFT, alice, timespan, dropRate, queuedAction} = await loadFixture(
          deployContractsMagic
        );

        const _queuedAction = {...queuedAction};
        _queuedAction.rightHandEquipmentTokenId = NONE;

        await players.connect(alice).startAction(playerId, _queuedAction, ActionQueueStatus.NONE);

        await ethers.provider.send("evm_increaseTime", [_queuedAction.timespan]);
        await players.connect(alice).processActions(playerId);
        expect(await players.skillPoints(playerId, Skill.MAGIC)).to.eq(_queuedAction.timespan);
        expect(await players.skillPoints(playerId, Skill.DEFENCE)).to.eq(0);

        // Check the drops are as expected
        expect(await itemNFT.balanceOf(alice.address, BRONZE_ARROW)).to.eq(
          Math.floor((timespan * dropRate) / (3600 * 100))
        );

        // Check food is consumed, update later
        expect(await itemNFT.balanceOf(alice.address, COOKED_HUPPY)).to.eq(1000 - 30);

        // Check that scrolls are consumed
        expect(await itemNFT.balanceOf(alice.address, AIR_SCROLL)).to.eq(200 - 2);
        expect(await itemNFT.balanceOf(alice.address, SHADOW_SCROLL)).to.eq(100 - 1);
      });

      it("Cannot equip shield with a staff", async () => {
        const {playerId, players, alice, queuedAction} = await loadFixture(deployContractsMagic);

        const _queuedAction = {...queuedAction};

        _queuedAction.leftHandEquipmentTokenId = BRONZE_SHIELD;
        await expect(players.connect(alice).startAction(playerId, _queuedAction, ActionQueueStatus.NONE)).to.be
          .reverted;
        _queuedAction.leftHandEquipmentTokenId = NONE;
        await expect(players.connect(alice).startAction(playerId, _queuedAction, ActionQueueStatus.NONE)).to.not.be
          .reverted;
      });

      it("No scrolls equipped during processing action", async () => {
        const {playerId, players, itemNFT, alice, queuedAction} = await loadFixture(deployContractsMagic);

        await players.connect(alice).startAction(playerId, queuedAction, ActionQueueStatus.NONE);

        await itemNFT.connect(alice).burn(alice.address, AIR_SCROLL, 200);

        await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]);
        await players.connect(alice).processActions(playerId);
        // Should get no XP
        expect(await players.skillPoints(playerId, Skill.MAGIC)).to.eq(0);
        expect(await players.skillPoints(playerId, Skill.DEFENCE)).to.eq(0);
        // Check food is consumed, update later
        expect(await itemNFT.balanceOf(alice.address, COOKED_HUPPY)).to.eq(1000 - 30);

        // Check that no scrolls are consumed
        expect(await itemNFT.balanceOf(alice.address, AIR_SCROLL)).to.eq(0);
        expect(await itemNFT.balanceOf(alice.address, SHADOW_SCROLL)).to.eq(100);
      });
    });

    it("Guaranteed rewards", async () => {});

    // This test only works if the timespan does not go over 00:00 utc
    it("Random rewards (many)", async () => {
      const {playerId, players, itemNFT, world, alice, mockOracleClient} = await loadFixture(deployContracts);

      await itemNFT.addItem({
        ...defaultInputItem,
        tokenId: BRONZE_AXE,
        equipPosition: EquipPosition.RIGHT_HAND,
        metadataURI: "someIPFSURI.json",
      });

      await itemNFT.addItem({
        ...defaultInputItem,
        tokenId: BRONZE_ARROW,
        equipPosition: EquipPosition.ARROW_SATCHEL,
        metadataURI: "someIPFSURI.json",
      });

      const rate = 100 * 100; // per hour
      const randomChanceFraction = 50.0 / 100; // 50% chance
      const randomChance = Math.floor(65535 * randomChanceFraction);

      let tx = await world.addAction({
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
        randomRewards: [{itemTokenId: BRONZE_ARROW, rate: randomChance}],
        combatStats: emptyStats,
      });

      const actionId = await getActionId(tx);
      const numHours = 5;
      const queuedAction: QueuedAction = {
        attire: noAttire,
        actionId,
        combatStyle: CombatStyle.NONE,
        choiceId: NONE,
        choiceId1: NONE,
        choiceId2: NONE,
        regenerateId: NONE,
        timespan: 3600 * numHours,
        rightHandEquipmentTokenId: BRONZE_AXE,
        leftHandEquipmentTokenId: NONE,
        startTime: "0",
        isValid: true,
      };

      let numProduced = 0;

      // Repeat the test a bunch of times to check the random rewards are as expected
      const numRepeats = 50;
      for (let i = 0; i < numRepeats; ++i) {
        await players.connect(alice).startAction(playerId, queuedAction, ActionQueueStatus.NONE);
        let endTime;
        {
          const actionQueue = await players.getActionQueue(playerId);
          expect(actionQueue.length).to.eq(1);
          endTime = actionQueue[0].startTime + actionQueue[0].timespan;
        }

        expect(await world.hasSeed(endTime)).to.be.false;

        await ethers.provider.send("evm_increaseTime", [3600 * 24]);
        await players.connect(alice).processActions(playerId);
        expect(await itemNFT.balanceOf(alice.address, BRONZE_ARROW)).to.eq(numProduced);

        expect((await players.getPendingRandomRewards(playerId)).length).to.eq(1);

        const playerDelegateView = await ethers.getContractAt("PlayerDelegateView", players.address);
        const pendingOutput = await playerDelegateView.pendingRewards(alice.address, playerId, {
          includeLoot: true,
          includePastRandomRewards: true,
          includeXPRewards: true,
        });
        expect(pendingOutput.produced.length).to.eq(0);

        tx = await world.requestSeedUpdate();
        let requestId = getRequestId(tx);
        expect(requestId).to.not.eq(0);
        await mockOracleClient.fulfill(requestId, world.address);

        expect(await world.hasSeed(endTime)).to.be.true;

        if (
          (
            await playerDelegateView.pendingRewards(alice.address, playerId, {
              includeLoot: false,
              includePastRandomRewards: true,
              includeXPRewards: false,
            })
          ).producedPastRandomRewards.length != 0
        ) {
          expect(
            (
              await playerDelegateView.pendingRewards(alice.address, playerId, {
                includeLoot: false,
                includePastRandomRewards: true,
                includeXPRewards: false,
              })
            ).producedPastRandomRewards.length
          ).to.eq(1);

          const produced = (
            await playerDelegateView.pendingRewards(alice.address, playerId, {
              includeLoot: false,
              includePastRandomRewards: true,
              includeXPRewards: false,
            })
          ).producedPastRandomRewards[0].amount;
          numProduced += produced;
          expect(
            (
              await playerDelegateView.pendingRewards(alice.address, playerId, {
                includeLoot: false,
                includePastRandomRewards: true,
                includeXPRewards: false,
              })
            ).producedPastRandomRewards[0].itemTokenId
          ).to.be.eq(BRONZE_ARROW);
        }
      }
      // Very unlikely to be exact
      const expectedTotal = numRepeats * randomChanceFraction * numHours;
      expect(numProduced).to.not.eq(expectedTotal); // Very unlikely to be exact, but possible. This checks there is at least some randomness
      expect(numProduced).to.be.gte(expectedTotal * 0.85); // Within 15% below
      expect(numProduced).to.be.lte(expectedTotal * 1.15); // 15% of the time we should get more than 50% of the reward
    });

    it("Dead", async () => {
      // Lose all the XP that would have been gained
      const {playerId, players, itemNFT, world, alice} = await loadFixture(deployContracts);

      const monsterCombatStats: CombatStats = {
        melee: 3,
        magic: 0,
        range: 0,
        meleeDefence: 0,
        magicDefence: 0,
        rangeDefence: 0,
        health: 0,
      };

      const rate = 1 * 100; // per hour
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
        guaranteedRewards: [{itemTokenId: BRONZE_ARROW, rate}],
        randomRewards: [],
        combatStats: monsterCombatStats,
      });
      const actionId = await getActionId(tx);

      await itemNFT.testOnlyMint(alice.address, BRONZE_SWORD, 1);
      await itemNFT.testOnlyMint(alice.address, COOKED_HUPPY, 2);
      const timespan = 3600 * 3; // 3 hours
      tx = await world.addActionChoice(NONE, {
        ...emptyActionChoice,
        skill: Skill.ATTACK,
      });
      const choiceId = await getActionChoiceId(tx);
      const queuedAction: QueuedAction = {
        attire: noAttire,
        actionId,
        combatStyle: CombatStyle.MELEE,
        choiceId,
        choiceId1: NONE,
        choiceId2: NONE,
        regenerateId: COOKED_HUPPY,
        timespan,
        rightHandEquipmentTokenId: BRONZE_SWORD,
        leftHandEquipmentTokenId: NONE,
        startTime: "0",
        isValid: true,
      };

      await itemNFT.addItem({
        ...defaultInputItem,
        tokenId: BRONZE_SWORD,
        equipPosition: EquipPosition.RIGHT_HAND,
        metadataURI: "someIPFSURI.json",
      });

      await itemNFT.addItem({
        ...defaultInputItem,
        tokenId: BRONZE_ARROW,
        equipPosition: EquipPosition.AUX,
        metadataURI: "someIPFSURI.json",
      });

      await itemNFT.addItem({
        ...defaultInputItem,
        healthRestored: 1,
        tokenId: COOKED_HUPPY,
        equipPosition: EquipPosition.FOOD,
        metadataURI: "someIPFSURI.json",
      });

      await players.connect(alice).startAction(playerId, queuedAction, ActionQueueStatus.NONE);

      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]);
      await players.connect(alice).processActions(playerId);
      // Should die so doesn't get any attack skill points, and food should be consumed
      expect(await players.skillPoints(playerId, Skill.ATTACK)).to.eq(0);
      expect(await itemNFT.balanceOf(alice.address, BRONZE_ARROW)).to.eq(0);
      expect(await itemNFT.balanceOf(alice.address, COOKED_HUPPY)).to.eq(0);
    });
  });
});
