import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {EstforTypes, EstforConstants} from "@paintswap/estfor-definitions";
import {Attire, Skill, defaultActionChoice, defaultActionInfo} from "@paintswap/estfor-definitions/types";
import {expect} from "chai";
import {ethers, upgrades} from "hardhat";
import {AvatarInfo, createPlayer, SKIP_XP_THRESHOLD_EFFECTS} from "../../scripts/utils";
import {
  createAndDoPurseStringsQuest,
  getActionChoiceId,
  getActionId,
  NO_DONATION_AMOUNT,
  START_XP,
  timeTravel,
  timeTravel24Hours
} from "../utils";
import {playersFixture} from "./PlayersFixture";
import {
  BOOST_START_NOW,
  getPlayersHelper,
  getXPFromLevel,
  setupBasicCooking,
  setupBasicFiremaking,
  setupBasicFishing,
  setupBasicWoodcutting,
  setupTravelling
} from "./utils";
import {Players} from "../../typechain-types";
import {ACTION_FISHING_MINNUS, GUAR_MUL, MAX_LEVEL, RATE_MUL, SPAWN_MUL} from "@paintswap/estfor-definitions/constants";
import {Block, ContractTransactionReceipt} from "ethers";

const actionIsAvailable = true;

describe("Players", function () {
  it("Check initialized", async function () {
    const {
      itemNFT,
      playerNFT,
      petNFT,
      worldActions,
      randomnessBeacon,
      dailyRewardsScheduler,
      adminAccess,
      quests,
      clans,
      wishingWell,
      playersImplQueueActions,
      playersImplProcessActions,
      playersImplRewards,
      playersImplMisc,
      playersImplMisc1,
      bridge
    } = await loadFixture(playersFixture);

    const isBeta = true;
    const Players = await ethers.getContractFactory("Players");
    // Deploy proxy and get transaction
    const proxy = (await upgrades.deployProxy(
      Players,
      [
        await itemNFT.getAddress(),
        await playerNFT.getAddress(),
        await petNFT.getAddress(),
        await worldActions.getAddress(),
        await randomnessBeacon.getAddress(),
        await dailyRewardsScheduler.getAddress(),
        await adminAccess.getAddress(),
        await quests.getAddress(),
        await clans.getAddress(),
        await wishingWell.getAddress(),
        await playersImplQueueActions.getAddress(),
        await playersImplProcessActions.getAddress(),
        await playersImplRewards.getAddress(),
        await playersImplMisc.getAddress(),
        await playersImplMisc1.getAddress(),
        await bridge.getAddress(),
        isBeta
      ],
      {
        kind: "uups",
        unsafeAllow: ["delegatecall"]
      }
    )) as unknown as Players;

    // Wait for deployment and get transaction receipt
    const receipt = (await proxy.deploymentTransaction()?.wait()) as ContractTransactionReceipt;

    const eventArgs = receipt.logs
      .map((log) => {
        try {
          return Players.interface.parseLog(log); // Parse the log using the contract ABI
        } catch (error) {
          return null; // Ignore logs that don't match the contract ABI
        }
      })
      .find((parsedLog) => parsedLog && parsedLog.name === "SetCombatParams")?.args; // Filter for the specific event
    expect(eventArgs?.[0]).to.equal(1); // alpha compbat
    expect(eventArgs?.[1]).to.equal(1); // beta combat
    expect(eventArgs?.[2]).to.equal(8); // alpha combat healing
  });

  it("New player stats", async function () {
    const {players, playerNFT, alice} = await loadFixture(playersFixture);

    const avatarId = 2;
    const avatarInfo: AvatarInfo = {
      name: "Name goes here",
      description: "Hi I'm a description",
      imageURI: "1234.png",
      startSkills: [Skill.FIREMAKING, Skill.NONE]
    };
    await playerNFT.setAvatars([avatarId], [avatarInfo]);
    const playerId = await createPlayer(playerNFT, avatarId, alice, "Name", true);

    expect(await players.getPlayerXP(playerId, Skill.FIREMAKING)).to.eq(START_XP);

    avatarInfo.startSkills = [Skill.FIREMAKING, Skill.HEALTH];

    await playerNFT.setAvatars([avatarId], [avatarInfo]);
    const newPlayerId = await createPlayer(playerNFT, avatarId, alice, "New name", true);
    expect(await players.getPlayerXP(newPlayerId, Skill.FIREMAKING)).to.eq(START_XP / 2n);
    expect(await players.getPlayerXP(newPlayerId, Skill.HEALTH)).to.eq(START_XP / 2n);
    expect((await (await getPlayersHelper(players)).getPlayer(newPlayerId)).totalXP).to.eq(START_XP);
  });

  it("Skill points", async function () {
    const {playerId, players, itemNFT, worldActions, alice} = await loadFixture(playersFixture);
    const {queuedAction} = await setupBasicWoodcutting(itemNFT, worldActions);
    await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);
    await ethers.provider.send("evm_increaseTime", [361]);
    await ethers.provider.send("evm_mine", []);
    await players.connect(alice).processActions(playerId);
    expect(await players.getPlayerXP(playerId, EstforTypes.Skill.WOODCUTTING)).to.eq(360);
    expect(await itemNFT.balanceOf(alice, EstforConstants.LOG)).to.eq(10); // Should be rounded down
    expect((await (await getPlayersHelper(players)).getPlayer(playerId)).totalXP).to.eq(START_XP + 360n);
  });

  it("Skill points (many)", async function () {
    const {playerId, players, itemNFT, worldActions, alice} = await loadFixture(playersFixture);
    const {queuedAction} = await setupBasicWoodcutting(itemNFT, worldActions);
    // start a bunch of actions 1 after each other
    for (let i = 0; i < 50; ++i) {
      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.APPEND);
      await ethers.provider.send("evm_increaseTime", [7200]);
      await ethers.provider.send("evm_mine", []);
      await players.connect(alice).processActions(playerId);
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.WOODCUTTING)).to.be.eq((i + 1) * 3600);
      expect(await itemNFT.balanceOf(alice, EstforConstants.LOG)).to.eq((i + 1) * 100); // Should be rounded down
    }
  });

  it("Partial consume aux items", async function () {
    const {playerId, players, itemNFT, worldActions, alice} = await loadFixture(playersFixture);
    const {queuedAction, rate} = await setupBasicWoodcutting(itemNFT, worldActions);
    await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);

    await ethers.provider.send("evm_increaseTime", [queuedAction.timespan / 2]);
    await ethers.provider.send("evm_mine", []);
    await players.connect(alice).processActions(playerId);
    expect(await players.getPlayerXP(playerId, EstforTypes.Skill.WOODCUTTING)).to.be.deep.oneOf([
      BigInt(queuedAction.timespan / 2),
      BigInt(queuedAction.timespan / 2 + 1)
    ]);
    // Check the drops are as expected
    expect(await itemNFT.balanceOf(alice, EstforConstants.LOG)).to.eq(
      Math.floor(((queuedAction.timespan / 2) * rate) / (3600 * GUAR_MUL))
    );
  });

  it("Skill points, max range", async function () {
    const {playerId, players, itemNFT, worldActions, alice} = await loadFixture(playersFixture);
    const {queuedAction} = await setupBasicWoodcutting(itemNFT, worldActions);
    await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);

    await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]);
    await ethers.provider.send("evm_mine", []);
    await players.connect(alice).processActions(playerId);
    expect(await players.getPlayerXP(playerId, EstforTypes.Skill.WOODCUTTING)).to.eq(queuedAction.timespan);
  });

  it("Multi-skill points", async function () {
    // TODO:
  });

  // TODO: Check attire stats are as expected
  it("Attire equipPositions", async function () {
    const {playerId, players, itemNFT, worldActions, alice} = await loadFixture(playersFixture);

    let tx = await worldActions.addActions([
      {
        actionId: 1,
        info: {
          ...defaultActionInfo,
          skill: EstforTypes.Skill.COMBAT,
          xpPerHour: 3600,
          minXP: 0,
          numSpawned: 1 * SPAWN_MUL,
          handItemTokenIdRangeMin: EstforConstants.COMBAT_BASE,
          handItemTokenIdRangeMax: EstforConstants.COMBAT_MAX,
          isAvailable: actionIsAvailable,
          actionChoiceRequired: true,
          successPercent: 100
        },
        guaranteedRewards: [],
        randomRewards: [],
        combatStats: EstforTypes.emptyCombatStats
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
    const timespan = 3600;

    const queuedAction: EstforTypes.QueuedActionInput = {
      attire: {...EstforTypes.noAttire, head: EstforConstants.BRONZE_GAUNTLETS}, // Incorrect attire
      actionId,
      combatStyle: EstforTypes.CombatStyle.ATTACK,
      choiceId,
      regenerateId: EstforConstants.NONE,
      timespan,
      rightHandEquipmentTokenId: EstforConstants.NONE,
      leftHandEquipmentTokenId: EstforConstants.NONE,
      petId: EstforConstants.NONE
    };

    await itemNFT.addItems([
      {
        ...EstforTypes.defaultItemInput,
        tokenId: EstforConstants.BRONZE_GAUNTLETS,
        combatStats: EstforTypes.emptyCombatStats,
        equipPosition: EstforTypes.EquipPosition.ARMS
      }
    ]);
    await itemNFT.mint(alice, EstforConstants.BRONZE_GAUNTLETS, 1);

    await expect(
      players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE)
    ).to.be.revertedWithCustomError(players, "InvalidEquipPosition");
    queuedAction.attire.head = EstforConstants.NONE;
    queuedAction.attire.neck = EstforConstants.BRONZE_GAUNTLETS;
    await expect(
      players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE)
    ).to.be.revertedWithCustomError(players, "InvalidEquipPosition");
    queuedAction.attire.neck = EstforConstants.NONE;
    queuedAction.attire.body = EstforConstants.BRONZE_GAUNTLETS;
    await expect(
      players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE)
    ).to.be.revertedWithCustomError(players, "InvalidEquipPosition");
    queuedAction.attire.body = EstforConstants.NONE;
    queuedAction.attire.feet = EstforConstants.BRONZE_GAUNTLETS;
    await expect(
      players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE)
    ).to.be.revertedWithCustomError(players, "InvalidEquipPosition");
    queuedAction.attire.feet = EstforConstants.NONE;
    queuedAction.attire.legs = EstforConstants.BRONZE_GAUNTLETS;
    await expect(
      players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE)
    ).to.be.revertedWithCustomError(players, "InvalidEquipPosition");
    queuedAction.attire.legs = EstforConstants.NONE;
    queuedAction.attire.ring = EstforConstants.BRONZE_GAUNTLETS;
    await expect(
      players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE)
    ).to.be.revertedWithCustomError(players, "InvalidEquipPosition");
    queuedAction.attire.ring = EstforConstants.NONE;
    queuedAction.attire.arms = EstforConstants.BRONZE_GAUNTLETS; // Correct
    await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);
  });

  it("validateActions", async function () {
    const {playerId, players, itemNFT, worldActions, alice} = await loadFixture(playersFixture);

    let tx = await worldActions.addActions([
      {
        actionId: 1,
        info: {
          ...defaultActionInfo,
          skill: EstforTypes.Skill.COMBAT,
          xpPerHour: 3600,
          minXP: 0,
          numSpawned: 1 * SPAWN_MUL,
          handItemTokenIdRangeMin: EstforConstants.COMBAT_BASE,
          handItemTokenIdRangeMax: EstforConstants.COMBAT_MAX,
          isAvailable: actionIsAvailable,
          actionChoiceRequired: true,
          successPercent: 100
        },
        guaranteedRewards: [],
        randomRewards: [],
        combatStats: EstforTypes.emptyCombatStats
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
    const timespan = 3600;

    const queuedAction: EstforTypes.QueuedActionInput = {
      attire: {...EstforTypes.noAttire, head: EstforConstants.BRONZE_GAUNTLETS}, // Incorrect attire
      actionId,
      combatStyle: EstforTypes.CombatStyle.ATTACK,
      choiceId,
      regenerateId: EstforConstants.NONE,
      timespan,
      rightHandEquipmentTokenId: EstforConstants.NONE,
      leftHandEquipmentTokenId: EstforConstants.NONE,
      petId: 0
    };

    await itemNFT.addItems([
      {
        ...EstforTypes.defaultItemInput,
        tokenId: EstforConstants.BRONZE_GAUNTLETS,
        combatStats: EstforTypes.emptyCombatStats,
        equipPosition: EstforTypes.EquipPosition.ARMS
      }
    ]);
    await itemNFT.mint(alice, EstforConstants.BRONZE_GAUNTLETS, 1);

    const queuedActionCorrect = {...queuedAction, attire: {...EstforTypes.noAttire}};

    await expect(
      players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE)
    ).to.be.revertedWithCustomError(players, "InvalidEquipPosition");

    let {successes, reasons} = await players
      .connect(alice)
      .validateActions(alice, playerId, [queuedAction, queuedActionCorrect, queuedAction]);

    const InvalidEquipPositionSelector = "0x9378eb35";
    expect(successes.length).to.eq(3);
    expect(reasons.length).to.eq(3);
    expect(successes[0]).to.eq(false);
    expect(reasons[0]).to.eq(InvalidEquipPositionSelector);
    expect(successes[1]).to.eq(true);
    expect(reasons[1]).to.eq("0x");
    expect(successes[2]).to.eq(false);
    expect(reasons[2]).to.eq(InvalidEquipPositionSelector);

    ({successes, reasons} = await players.connect(alice).validateActions(alice, playerId, [queuedActionCorrect]));

    expect(successes.length).to.eq(1);
    expect(reasons.length).to.eq(1);
    expect(successes[0]).to.eq(true);
    expect(reasons[0]).to.eq("0x");

    ({successes, reasons} = await players.connect(alice).validateActions(alice, playerId, [queuedAction]));

    expect(successes.length).to.eq(1);
    expect(reasons.length).to.eq(1);
    expect(successes[0]).to.eq(false);
    expect(reasons[0]).to.eq(InvalidEquipPositionSelector);
  });

  it("ValidateActions", async function () {
    const {playerId, players, itemNFT, worldActions, alice} = await loadFixture(playersFixture);

    let tx = await worldActions.addActions([
      {
        actionId: 1,
        info: {
          ...defaultActionInfo,
          skill: EstforTypes.Skill.COMBAT,
          xpPerHour: 3600,
          minXP: 0,
          numSpawned: 1 * SPAWN_MUL,
          handItemTokenIdRangeMin: EstforConstants.COMBAT_BASE,
          handItemTokenIdRangeMax: EstforConstants.COMBAT_MAX,
          isAvailable: actionIsAvailable,
          actionChoiceRequired: true,
          successPercent: 100
        },
        guaranteedRewards: [],
        randomRewards: [],
        combatStats: EstforTypes.emptyCombatStats
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
    const timespan = 3600;

    const queuedAction: EstforTypes.QueuedActionInput = {
      attire: {...EstforTypes.noAttire, head: EstforConstants.BRONZE_GAUNTLETS}, // Incorrect attire
      actionId,
      combatStyle: EstforTypes.CombatStyle.ATTACK,
      choiceId,
      regenerateId: EstforConstants.NONE,
      timespan,
      rightHandEquipmentTokenId: EstforConstants.NONE,
      leftHandEquipmentTokenId: EstforConstants.NONE,
      petId: EstforConstants.NONE
    };

    await itemNFT.addItems([
      {
        ...EstforTypes.defaultItemInput,
        tokenId: EstforConstants.BRONZE_GAUNTLETS,
        combatStats: EstforTypes.emptyCombatStats,
        equipPosition: EstforTypes.EquipPosition.ARMS
      }
    ]);
    await itemNFT.mint(alice, EstforConstants.BRONZE_GAUNTLETS, 1);

    const queuedActionCorrect = {...queuedAction, attire: {...EstforTypes.noAttire}};

    await expect(
      players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE)
    ).to.be.revertedWithCustomError(players, "InvalidEquipPosition");

    let {successes, reasons} = await players
      .connect(alice)
      .validateActions(alice, playerId, [queuedAction, queuedActionCorrect, queuedAction]);

    const InvalidEquipPositionSelector = "0x9378eb35";
    expect(successes.length).to.eq(3);
    expect(reasons.length).to.eq(3);
    expect(successes[0]).to.eq(false);
    expect(reasons[0]).to.eq(InvalidEquipPositionSelector);
    expect(successes[1]).to.eq(true);
    expect(reasons[1]).to.eq("0x");
    expect(successes[2]).to.eq(false);
    expect(reasons[2]).to.eq(InvalidEquipPositionSelector);
  });

  it("Queueing after 1 action is completely finished", async function () {
    const {playerId, players, itemNFT, worldActions, alice} = await loadFixture(playersFixture);
    const {queuedAction} = await setupBasicWoodcutting(itemNFT, worldActions);
    await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);
    await ethers.provider.send("evm_increaseTime", [queuedAction.timespan / 2]);
    await ethers.provider.send("evm_mine", []);
    await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.APPEND);
    let actionQueue = await players.getActionQueue(playerId);
    expect(actionQueue.length).to.eq(2);
    await ethers.provider.send("evm_increaseTime", [queuedAction.timespan / 2]); // First one is now finished
    await ethers.provider.send("evm_mine", []);
    await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.APPEND); // This should complete the first one
    actionQueue = await players.getActionQueue(playerId);
    expect(actionQueue.length).to.eq(2);
    expect(actionQueue[0].queueId).to.eq(2);
    expect(actionQueue[0].timespan).to.be.oneOf([
      BigInt(queuedAction.timespan - 3),
      BigInt(queuedAction.timespan - 2),
      BigInt(queuedAction.timespan - 1),
      BigInt(queuedAction.timespan)
    ]);
    expect(actionQueue[1].queueId).to.eq(3);
    expect(actionQueue[1].timespan).to.eq(queuedAction.timespan);
  });

  describe("Queue combinations", function () {
    it("Remove in-progress but keep 1 pending", async function () {
      const {playerId, players, itemNFT, worldActions, alice} = await loadFixture(playersFixture);
      const {queuedAction} = await setupBasicWoodcutting(itemNFT, worldActions);
      await players
        .connect(alice)
        .startActions(playerId, [queuedAction, queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);
      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan / 2]);
      await ethers.provider.send("evm_mine", []);
      let actionQueue = await players.getActionQueue(playerId);
      expect(actionQueue.length).to.eq(2);
      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);
      actionQueue = await players.getActionQueue(playerId);
      expect(actionQueue.length).to.eq(1);
      expect(actionQueue[0].queueId).to.eq(3);
      expect(actionQueue[0].timespan).to.eq(queuedAction.timespan);
    });

    it("Remove in-progress but keep pending, add another pending", async function () {
      const {playerId, players, itemNFT, worldActions, alice} = await loadFixture(playersFixture);
      const {queuedAction} = await setupBasicWoodcutting(itemNFT, worldActions);
      await players
        .connect(alice)
        .startActions(playerId, [queuedAction, queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);
      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan / 2]);
      await ethers.provider.send("evm_mine", []);
      let actionQueue = await players.getActionQueue(playerId);
      expect(actionQueue.length).to.eq(2);
      await players
        .connect(alice)
        .startActions(playerId, [queuedAction, queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);
      actionQueue = await players.getActionQueue(playerId);
      expect(actionQueue.length).to.eq(2);
      expect(actionQueue[0].queueId).to.eq(3);
      expect(actionQueue[0].timespan).to.eq(queuedAction.timespan);
      expect(actionQueue[1].queueId).to.eq(4);
      expect(actionQueue[1].timespan).to.eq(queuedAction.timespan);
    });

    it("Keep in-progress, remove 1 pending", async function () {
      const {playerId, players, itemNFT, worldActions, alice} = await loadFixture(playersFixture);
      const {queuedAction} = await setupBasicWoodcutting(itemNFT, worldActions);
      await players
        .connect(alice)
        .startActions(playerId, [queuedAction, queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);
      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan / 2]);
      await ethers.provider.send("evm_mine", []);
      let actionQueue = await players.getActionQueue(playerId);
      expect(actionQueue.length).to.eq(2);
      await players.connect(alice).startActions(playerId, [], EstforTypes.ActionQueueStrategy.KEEP_LAST_IN_PROGRESS);
      actionQueue = await players.getActionQueue(playerId);
      expect(actionQueue.length).to.eq(1);
      expect(actionQueue[0].queueId).to.eq(1);
      expect(actionQueue[0].timespan).to.be.oneOf([
        BigInt(queuedAction.timespan / 2 - 2),
        BigInt(queuedAction.timespan / 2 - 1),
        BigInt(queuedAction.timespan / 2)
      ]);
    });

    it("Keep in-progress, remove 1 pending, and add 1 pending", async function () {
      const {playerId, players, itemNFT, worldActions, alice} = await loadFixture(playersFixture);
      const {queuedAction} = await setupBasicWoodcutting(itemNFT, worldActions);
      await players
        .connect(alice)
        .startActions(playerId, [queuedAction, queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);
      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan / 2]);
      await ethers.provider.send("evm_mine", []);
      let actionQueue = await players.getActionQueue(playerId);
      expect(actionQueue.length).to.eq(2);
      await players
        .connect(alice)
        .startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.KEEP_LAST_IN_PROGRESS);
      actionQueue = await players.getActionQueue(playerId);
      expect(actionQueue.length).to.eq(2);
      expect(actionQueue[0].queueId).to.eq(1);
      expect(actionQueue[0].timespan).to.be.oneOf([
        BigInt(queuedAction.timespan / 2 - 1),
        BigInt(queuedAction.timespan / 2)
      ]);
      expect(actionQueue[1].queueId).to.eq(3);
      expect(actionQueue[1].timespan).to.eq(queuedAction.timespan);
    });

    it("Remove in-progress and any pending", async function () {
      const {playerId, players, itemNFT, worldActions, alice} = await loadFixture(playersFixture);
      const {queuedAction} = await setupBasicWoodcutting(itemNFT, worldActions);
      await players
        .connect(alice)
        .startActions(playerId, [queuedAction, queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);
      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan / 2]);
      await ethers.provider.send("evm_mine", []);
      let actionQueue = await players.getActionQueue(playerId);
      expect(actionQueue.length).to.eq(2);
      await players.connect(alice).startActions(playerId, [], EstforTypes.ActionQueueStrategy.OVERWRITE);
      actionQueue = await players.getActionQueue(playerId);
      expect(actionQueue.length).to.eq(0);
    });

    it("Remove in-progress and pending, add 1 pending ", async function () {
      const {playerId, players, itemNFT, worldActions, alice} = await loadFixture(playersFixture);
      const {queuedAction} = await setupBasicWoodcutting(itemNFT, worldActions);
      await players
        .connect(alice)
        .startActions(playerId, [queuedAction, queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);
      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan / 2]);
      await ethers.provider.send("evm_mine", []);
      let actionQueue = await players.getActionQueue(playerId);
      expect(actionQueue.length).to.eq(2);
      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);
      actionQueue = await players.getActionQueue(playerId);
      expect(actionQueue.length).to.eq(1);
      expect(actionQueue[0].queueId).to.eq(3);
      expect(actionQueue[0].timespan).to.eq(queuedAction.timespan);
    });

    it("Append and pending, add another pending", async function () {
      const {playerId, players, itemNFT, worldActions, alice} = await loadFixture(playersFixture);
      const {queuedAction} = await setupBasicWoodcutting(itemNFT, worldActions);
      await players
        .connect(alice)
        .startActions(playerId, [queuedAction, queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);
      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan / 2]);
      await ethers.provider.send("evm_mine", []);
      let actionQueue = await players.getActionQueue(playerId);
      expect(actionQueue.length).to.eq(2);
      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.APPEND);
      actionQueue = await players.getActionQueue(playerId);
      expect(actionQueue.length).to.eq(3);
      expect(actionQueue[0].queueId).to.eq(1);
      expect(actionQueue[1].queueId).to.eq(2);
      expect(actionQueue[2].queueId).to.eq(3);
    });

    it("Keep in progress, action is finished, queue 3", async function () {
      const {playerId, players, itemNFT, worldActions, alice} = await loadFixture(playersFixture);
      const {queuedAction: basicWoodcuttingQueuedAction} = await setupBasicWoodcutting(itemNFT, worldActions);
      let actionQueue = await players.getActionQueue(playerId);
      expect(actionQueue.length).to.eq(0);
      const queuedAction = {...basicWoodcuttingQueuedAction};
      queuedAction.timespan = 14 * 3600;
      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);
      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan + 1]);
      await ethers.provider.send("evm_mine", []);

      queuedAction.timespan = 5 * 3600;

      actionQueue = await players.getActionQueue(playerId);
      expect(actionQueue.length).to.eq(1);
      await players
        .connect(alice)
        .startActions(
          playerId,
          [basicWoodcuttingQueuedAction, queuedAction, queuedAction],
          EstforTypes.ActionQueueStrategy.KEEP_LAST_IN_PROGRESS
        );
      actionQueue = await players.getActionQueue(playerId);
      expect(actionQueue.length).to.eq(3);
      expect(actionQueue[0].queueId).to.eq(2);
      expect(actionQueue[0].timespan).to.eq(basicWoodcuttingQueuedAction.timespan);
      expect(actionQueue[1].queueId).to.eq(3);
      expect(actionQueue[1].timespan).to.eq(queuedAction.timespan);
      expect(actionQueue[2].queueId).to.eq(4);
      expect(actionQueue[2].timespan).to.eq(queuedAction.timespan);

      await ethers.provider.send("evm_increaseTime", [50]);
      await ethers.provider.send("evm_mine", []);
      await players.connect(alice).processActions(playerId);
      actionQueue = await players.getActionQueue(playerId);
      expect(actionQueue.length).to.eq(3);
      expect(actionQueue[0].queueId).to.eq(2);
      expect(actionQueue[0].timespan).to.be.oneOf([
        BigInt(basicWoodcuttingQueuedAction.timespan - 50),
        BigInt(basicWoodcuttingQueuedAction.timespan - 50 - 1),
        BigInt(basicWoodcuttingQueuedAction.timespan - 50 - 2)
      ]);
      expect(actionQueue[1].queueId).to.eq(3);
      expect(actionQueue[1].timespan).to.eq(queuedAction.timespan);
      expect(actionQueue[2].queueId).to.eq(4);
      expect(actionQueue[2].timespan).to.eq(queuedAction.timespan);
    });
  });

  it("Minimum xp for an Action", async function () {
    const {playerId, players, itemNFT, worldActions, alice} = await loadFixture(playersFixture);
    const rate = 100 * GUAR_MUL; // per hour
    const tx = await worldActions.addActions([
      {
        actionId: 1,
        info: {
          ...defaultActionInfo,
          skill: EstforTypes.Skill.WOODCUTTING,
          xpPerHour: 3600,
          minXP: getXPFromLevel(70),
          numSpawned: 0,
          handItemTokenIdRangeMin: EstforConstants.ORICHALCUM_AXE,
          handItemTokenIdRangeMax: EstforConstants.WOODCUTTING_MAX,
          isAvailable: true,
          actionChoiceRequired: false,
          successPercent: 100
        },
        guaranteedRewards: [{itemTokenId: EstforConstants.LOG, rate}],
        randomRewards: [],
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
      rightHandEquipmentTokenId: EstforConstants.ORICHALCUM_AXE,
      leftHandEquipmentTokenId: EstforConstants.NONE,
      petId: EstforConstants.NONE
    };

    await itemNFT.addItems([
      {
        ...EstforTypes.defaultItemInput,
        minXP: 0,
        tokenId: EstforConstants.ORICHALCUM_AXE,
        equipPosition: EstforTypes.EquipPosition.RIGHT_HAND
      }
    ]);

    await itemNFT.mint(alice, EstforConstants.ORICHALCUM_AXE, 1);

    await expect(
      players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE)
    ).to.be.revertedWithCustomError(players, "ActionMinimumXPNotReached");

    // Update to level 70, check it works
    await players.modifyXP(
      alice,
      playerId,
      EstforTypes.Skill.WOODCUTTING,
      getXPFromLevel(70),
      SKIP_XP_THRESHOLD_EFFECTS
    );
    expect(
      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE)
    ).to.not.be.reverted;
  });

  describe("ActionChoices", function () {
    it("Min XP", async function () {
      const {playerId, players, itemNFT, worldActions, alice} = await loadFixture(playersFixture);

      const minXP = getXPFromLevel(70);
      const {queuedAction} = await setupBasicFiremaking(itemNFT, worldActions, minXP);

      await expect(
        players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE)
      ).to.be.revertedWithCustomError(players, "ActionChoiceMinimumXPNotReached");

      // Update firemaking level, check it works
      await players.modifyXP(alice, playerId, EstforTypes.Skill.FIREMAKING, minXP, SKIP_XP_THRESHOLD_EFFECTS);
      expect(
        await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE)
      ).to.not.be.reverted;
    });

    it("Min XP multiple skills", async function () {
      const {playerId, players, itemNFT, worldActions, alice} = await loadFixture(playersFixture);

      const minXP1 = getXPFromLevel(70);
      const minXP2 = getXPFromLevel(80);
      const minXP3 = getXPFromLevel(90);
      const {queuedAction: queuedActionBase, actionId, rate} = await setupBasicFiremaking(itemNFT, worldActions);

      // Logs go in, nothing comes out
      let tx = await worldActions.addActionChoices(
        actionId,
        [2],
        [
          {
            ...defaultActionChoice,
            skill: EstforTypes.Skill.ALCHEMY,
            xpPerHour: 3600,
            rate,
            inputTokenIds: [EstforConstants.LOG],
            inputAmounts: [1],
            skills: [EstforTypes.Skill.ALCHEMY, EstforTypes.Skill.FIREMAKING],
            skillMinXPs: [minXP1, minXP2],
            skillDiffs: [0, 0]
          }
        ]
      );
      let choiceId = await getActionChoiceId(tx, worldActions);
      let queuedAction = {...queuedActionBase, choiceId};

      // 2 skills
      await expect(
        players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE)
      ).to.be.revertedWithCustomError(players, "ActionChoiceMinimumXPNotReached");

      // Update alchemy level, should not work yet
      await players.modifyXP(alice, playerId, EstforTypes.Skill.ALCHEMY, minXP1, SKIP_XP_THRESHOLD_EFFECTS);
      await expect(
        players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE)
      ).to.be.revertedWithCustomError(players, "ActionChoiceMinimumXPNotReached");

      // Update firemaking but not to correct level
      await players.modifyXP(alice, playerId, EstforTypes.Skill.FIREMAKING, minXP1, SKIP_XP_THRESHOLD_EFFECTS);
      await expect(
        players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE)
      ).to.be.revertedWithCustomError(players, "ActionChoiceMinimumXPNotReached");

      await players.modifyXP(alice, playerId, EstforTypes.Skill.FIREMAKING, minXP2, SKIP_XP_THRESHOLD_EFFECTS);
      expect(
        await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE)
      ).to.not.be.reverted;

      // 3 skills
      tx = await worldActions.addActionChoices(
        actionId,
        [3],
        [
          {
            ...defaultActionChoice,
            skill: EstforTypes.Skill.FIREMAKING,
            xpPerHour: 3600,
            rate,
            inputTokenIds: [EstforConstants.LOG],
            inputAmounts: [1],
            skills: [EstforTypes.Skill.FIREMAKING, EstforTypes.Skill.ALCHEMY, EstforTypes.Skill.COOKING],
            skillMinXPs: [minXP2, minXP1, minXP3],
            skillDiffs: [0, 0, 0]
          }
        ]
      );
      choiceId = await getActionChoiceId(tx, worldActions);
      queuedAction = {...queuedActionBase, choiceId};
      await expect(
        players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE)
      ).to.be.revertedWithCustomError(players, "ActionChoiceMinimumXPNotReached");

      // Update cooking to correct level
      await players.modifyXP(alice, playerId, EstforTypes.Skill.COOKING, minXP3, SKIP_XP_THRESHOLD_EFFECTS);
      expect(
        await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE)
      ).to.not.be.reverted;
    });

    it("Output number > 1", async function () {
      const {playerId, players, itemNFT, worldActions, alice} = await loadFixture(playersFixture);
      const {
        queuedAction: queuedActionFiremaking,
        rate,
        actionId
      } = await setupBasicFiremaking(itemNFT, worldActions, 0);

      // Logs go in, oak logs come out suprisingly!
      const outputAmount = 2;
      const tx = await worldActions.addActionChoices(
        actionId,
        [2],
        [
          {
            ...defaultActionChoice,
            skill: EstforTypes.Skill.FIREMAKING,
            xpPerHour: 3600,
            rate,
            inputTokenIds: [EstforConstants.LOG],
            inputAmounts: [1],
            outputTokenId: EstforConstants.OAK_LOG,
            outputAmount
          }
        ]
      );
      const choiceId = await getActionChoiceId(tx, worldActions);
      const queuedAction = {...queuedActionFiremaking};
      queuedAction.choiceId = choiceId;

      // Update firemamking level, check it works
      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);
      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]);
      await ethers.provider.send("evm_mine", []);

      const pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
      const expectedOutputNum = Math.floor((queuedAction.timespan * rate * outputAmount) / (3600 * RATE_MUL));
      expect(pendingQueuedActionState.equipmentStates[0].producedAmounts[0]).to.eq(expectedOutputNum);

      await players.connect(alice).processActions(playerId);
      // Check the drops are as expected
      expect(await itemNFT.balanceOf(alice, EstforConstants.OAK_LOG)).to.eq(expectedOutputNum);
    });
  });

  it("Consumables (food)", async function () {
    const {playerId, players, itemNFT, worldActions, alice} = await loadFixture(playersFixture);
    const rate = 100 * RATE_MUL; // per hour
    let tx = await worldActions.addActions([
      {
        actionId: 1,
        info: {
          ...defaultActionInfo,
          skill: EstforTypes.Skill.FIREMAKING,
          xpPerHour: 0,
          minXP: 0,
          numSpawned: 0,
          handItemTokenIdRangeMin: EstforConstants.MAGIC_FIRE_STARTER,
          handItemTokenIdRangeMax: EstforConstants.FIRE_MAX,
          isAvailable: actionIsAvailable,
          actionChoiceRequired: true,
          successPercent: 100
        },
        guaranteedRewards: [],
        randomRewards: [],
        combatStats: EstforTypes.emptyCombatStats
      }
    ]);
    const actionId = await getActionId(tx, worldActions);

    // Logs go in, nothing comes out
    tx = await worldActions.addActionChoices(
      actionId,
      [1],
      [
        {
          ...defaultActionChoice,
          skill: EstforTypes.Skill.FIREMAKING,
          xpPerHour: 3600,
          rate,
          inputTokenIds: [EstforConstants.LOG],
          inputAmounts: [1]
        }
      ]
    );
    const choiceId = await getActionChoiceId(tx, worldActions);

    const timespan = 3600;
    const queuedAction: EstforTypes.QueuedActionInput = {
      attire: EstforTypes.noAttire,
      actionId,
      combatStyle: EstforTypes.CombatStyle.NONE,
      choiceId,
      regenerateId: EstforConstants.COOKED_MINNUS,
      timespan,
      rightHandEquipmentTokenId: EstforConstants.MAGIC_FIRE_STARTER,
      leftHandEquipmentTokenId: EstforConstants.NONE,
      petId: EstforConstants.NONE
    };

    const minXP = getXPFromLevel(70);
    await itemNFT.addItems([
      {
        ...EstforTypes.defaultItemInput,
        tokenId: EstforConstants.MAGIC_FIRE_STARTER,
        equipPosition: EstforTypes.EquipPosition.RIGHT_HAND
      },
      {
        ...EstforTypes.defaultItemInput,
        tokenId: EstforConstants.LOG,
        equipPosition: EstforTypes.EquipPosition.AUX
      },
      {
        ...EstforTypes.defaultItemInput,
        skill: EstforTypes.Skill.HEALTH,
        minXP,
        healthRestored: 12,
        tokenId: EstforConstants.COOKED_MINNUS,
        equipPosition: EstforTypes.EquipPosition.FOOD
      }
    ]);

    await itemNFT.mint(alice, EstforConstants.LOG, 5);
    await itemNFT.mint(alice, EstforConstants.COOKED_MINNUS, 1);

    await expect(
      players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE)
    ).to.be.revertedWithCustomError(players, "ConsumableMinimumXPNotReached");

    await players.modifyXP(alice, playerId, EstforTypes.Skill.HEALTH, minXP, SKIP_XP_THRESHOLD_EFFECTS);

    // Update health level, check it works
    expect(
      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE)
    ).to.not.be.reverted;

    await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);
  });

  it("Attire", async function () {
    const {playerId, players, playerNFT, itemNFT, worldActions, alice} = await loadFixture(playersFixture);
    const {queuedAction} = await setupBasicWoodcutting(itemNFT, worldActions);
    const minXP = getXPFromLevel(70);

    await itemNFT.mintBatch(
      alice,
      [
        EstforConstants.BRONZE_AXE,
        EstforConstants.AMETHYST_AMULET,
        EstforConstants.BRONZE_ARMOR,
        EstforConstants.BRONZE_BOOTS,
        EstforConstants.BRONZE_GAUNTLETS,
        EstforConstants.BRONZE_HELMET,
        EstforConstants.BRONZE_TASSETS,
        EstforConstants.BRONZE_ARROW
      ],
      [1, 1, 1, 1, 1, 1, 1, 1]
    );

    const attireEquipped = [
      {
        ...EstforTypes.defaultItemInput,
        skill: EstforTypes.Skill.DEFENCE,
        minXP,
        tokenId: EstforConstants.BRONZE_HELMET,
        equipPosition: EstforTypes.EquipPosition.HEAD
      },
      {
        ...EstforTypes.defaultItemInput,
        skill: EstforTypes.Skill.MELEE,
        minXP,
        tokenId: EstforConstants.AMETHYST_AMULET,
        equipPosition: EstforTypes.EquipPosition.NECK
      },
      {
        ...EstforTypes.defaultItemInput,
        skill: EstforTypes.Skill.FIREMAKING,
        minXP,
        tokenId: EstforConstants.BRONZE_ARMOR,
        equipPosition: EstforTypes.EquipPosition.BODY
      },
      {
        ...EstforTypes.defaultItemInput,
        skill: EstforTypes.Skill.MAGIC,
        minXP,
        tokenId: EstforConstants.BRONZE_GAUNTLETS,
        equipPosition: EstforTypes.EquipPosition.ARMS
      },
      {
        ...EstforTypes.defaultItemInput,
        skill: EstforTypes.Skill.COOKING,
        minXP,
        tokenId: EstforConstants.BRONZE_TASSETS,
        equipPosition: EstforTypes.EquipPosition.LEGS
      },
      {
        ...EstforTypes.defaultItemInput,
        skill: EstforTypes.Skill.CRAFTING,
        minXP,
        tokenId: EstforConstants.BRONZE_BOOTS,
        equipPosition: EstforTypes.EquipPosition.FEET
      },
      {
        ...EstforTypes.defaultItemInput,
        skill: EstforTypes.Skill.FORGING,
        minXP,
        tokenId: EstforConstants.BRONZE_ARROW,
        equipPosition: EstforTypes.EquipPosition.RING
      }
    ];

    await itemNFT.addItems(attireEquipped);

    const equips = ["head", "neck", "body", "arms", "legs", "feet", "ring"];
    for (let i = 0; i < attireEquipped.length; ++i) {
      const attire: Attire = {...EstforTypes.noAttire};
      attire[equips[i] as keyof Attire] = attireEquipped[i].tokenId;
      queuedAction.attire = attire;
      await expect(
        players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE)
      ).to.be.revertedWithCustomError(players, "AttireMinimumXPNotReached");
      await players.modifyXP(alice, playerId, attireEquipped[i].skill, minXP, SKIP_XP_THRESHOLD_EFFECTS);
      expect(
        await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE)
      ).to.not.be.reverted;
    }

    // Test case, create a player
    const makeActive = true;
    await expect(createPlayer(playerNFT, 1, alice, "0xSamWitch123", makeActive)).to.not.be.reverted;
  });

  it("Left/Right equipment", async function () {
    const {playerId, players, itemNFT, worldActions, alice} = await loadFixture(playersFixture);
    const rate = 100 * GUAR_MUL; // per hour
    const tx = await worldActions.addActions([
      {
        actionId: 1,
        info: {
          ...defaultActionInfo,
          skill: EstforTypes.Skill.WOODCUTTING,
          xpPerHour: 3600,
          minXP: 0,
          numSpawned: 0,
          handItemTokenIdRangeMin: EstforConstants.ORICHALCUM_AXE,
          handItemTokenIdRangeMax: EstforConstants.WOODCUTTING_MAX,
          isAvailable: true,
          actionChoiceRequired: false,
          successPercent: 100
        },
        guaranteedRewards: [{itemTokenId: EstforConstants.LOG, rate}],
        randomRewards: [],
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
      rightHandEquipmentTokenId: EstforConstants.ORICHALCUM_AXE,
      leftHandEquipmentTokenId: EstforConstants.NONE,
      petId: EstforConstants.NONE
    };

    const minXP = getXPFromLevel(70);
    await itemNFT.addItems([
      {
        ...EstforTypes.defaultItemInput,
        skill: EstforTypes.Skill.WOODCUTTING,
        minXP,
        tokenId: EstforConstants.ORICHALCUM_AXE,
        equipPosition: EstforTypes.EquipPosition.RIGHT_HAND
      }
    ]);

    await itemNFT.mint(alice, EstforConstants.ORICHALCUM_AXE, 1);

    await expect(
      players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE)
    ).to.be.revertedWithCustomError(players, "ItemMinimumXPNotReached");

    // Update to level 70, check it works
    await players.modifyXP(alice, playerId, EstforTypes.Skill.WOODCUTTING, minXP, SKIP_XP_THRESHOLD_EFFECTS);
    expect(
      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE)
    ).to.not.be.reverted;
  });

  describe("Missing required equipment right hand equipment", async function () {
    async function expectRemovedCurrentAction(players: Players, playerId: bigint, now: number) {
      const player = await (await getPlayersHelper(players)).getPlayer(playerId);
      expect(player.currentActionStartTimestamp).to.eq(now);
      expect(player.currentActionProcessedSkill1).to.eq(Skill.NONE);
      expect(player.currentActionProcessedXPGained1).to.eq(0);
      expect(player.currentActionProcessedSkill2).to.eq(Skill.NONE);
      expect(player.currentActionProcessedXPGained2).to.eq(0);
      expect(player.currentActionProcessedSkill3).to.eq(Skill.NONE);
      expect(player.currentActionProcessedXPGained3).to.eq(0);
      expect(player.currentActionProcessedFoodConsumed).to.eq(0);
      expect(player.currentActionProcessedBaseInputItemsConsumedNum).to.eq(0);
    }

    it("Progress first action, then no item, haven't started other actions", async function () {
      const {playerId, players, itemNFT, worldActions, alice, owner} = await loadFixture(playersFixture);

      const {queuedAction} = await setupBasicWoodcutting(itemNFT, worldActions);
      await players
        .connect(alice)
        .startActions(playerId, [queuedAction, queuedAction, queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);
      await ethers.provider.send("evm_increaseTime", [36]);
      await ethers.provider.send("evm_mine", []);
      await players.connect(alice).processActions(playerId);
      // Remove required item
      await itemNFT.connect(alice).safeTransferFrom(alice, owner, EstforConstants.BRONZE_AXE, 1, "0x");
      // Almost finish
      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan - 200]);
      await ethers.provider.send("evm_mine", []);
      const {timestamp: NOW} = (await ethers.provider.getBlock("latest")) as Block;
      await players.connect(alice).processActions(playerId);
      // First action should be removed
      let actionQueue = await players.getActionQueue(playerId);
      expect(actionQueue.length).to.eq(2);
      expect(actionQueue[0].queueId).to.eq(2);
      expect(actionQueue[1].queueId).to.eq(3);
      await expectRemovedCurrentAction(players, playerId, NOW + 1);
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.WOODCUTTING)).to.eq(36);
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.FIREMAKING)).to.eq(0);
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.FISHING)).to.eq(0);
    });

    it("Finish first action, then no item, haven't started other actions", async function () {
      const {playerId, players, itemNFT, worldActions, alice, owner} = await loadFixture(playersFixture);

      const {queuedAction} = await setupBasicWoodcutting(itemNFT, worldActions);
      const {queuedAction: queuedActionFiremaking} = await setupBasicFiremaking(itemNFT, worldActions);
      const {queuedAction: queuedActionFishing} = await setupBasicFishing(itemNFT, worldActions);
      await players
        .connect(alice)
        .startActions(
          playerId,
          [queuedActionFiremaking, queuedAction, queuedActionFishing],
          EstforTypes.ActionQueueStrategy.OVERWRITE
        );

      // Completely finish first one
      await ethers.provider.send("evm_increaseTime", [queuedActionFiremaking.timespan]);
      await ethers.provider.send("evm_mine", []);
      await players.connect(alice).processActions(playerId);
      // Remove required item
      await itemNFT.connect(alice).safeTransferFrom(alice, owner, EstforConstants.BRONZE_AXE, 1, "0x");
      const {timestamp: NOW} = (await ethers.provider.getBlock("latest")) as Block;
      await players.connect(alice).processActions(playerId);
      // Should remove that action
      let actionQueue = await players.getActionQueue(playerId);
      expect(actionQueue.length).to.eq(1);
      expect(actionQueue[0].queueId).to.eq(3);
      await expectRemovedCurrentAction(players, playerId, NOW + 1);
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.FIREMAKING)).to.eq(queuedActionFiremaking.timespan);
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.WOODCUTTING)).to.eq(0);
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.FISHING)).to.eq(0);
    });

    it("Finish first action, then no items for the other 2", async function () {
      const {playerId, players, itemNFT, worldActions, alice, owner} = await loadFixture(playersFixture);

      const {queuedAction} = await setupBasicWoodcutting(itemNFT, worldActions);
      const {queuedAction: queuedActionFiremaking} = await setupBasicFiremaking(itemNFT, worldActions);
      const {queuedAction: queuedActionFishing} = await setupBasicFishing(itemNFT, worldActions);
      await players
        .connect(alice)
        .startActions(
          playerId,
          [queuedActionFiremaking, queuedAction, queuedActionFishing],
          EstforTypes.ActionQueueStrategy.OVERWRITE
        );

      // Completely finish first one and go into the second one a bit
      await ethers.provider.send("evm_increaseTime", [queuedActionFiremaking.timespan + 1]);
      await ethers.provider.send("evm_mine", []);
      await players.connect(alice).processActions(playerId);
      // Remove required items
      await itemNFT.connect(alice).safeTransferFrom(alice, owner, EstforConstants.BRONZE_AXE, 1, "0x");
      await itemNFT.connect(alice).safeTransferFrom(alice, owner, EstforConstants.NET_STICK, 1, "0x");
      const {timestamp: NOW} = (await ethers.provider.getBlock("latest")) as Block;
      await players.connect(alice).processActions(playerId);
      // Should remove the second action only, the last one hasn't started yet
      let actionQueue = await players.getActionQueue(playerId);
      expect(actionQueue.length).to.eq(1);
      expect(actionQueue[0].queueId).to.eq(3);
      await expectRemovedCurrentAction(players, playerId, NOW + 1);
      await players.connect(alice).processActions(playerId);
      actionQueue = await players.getActionQueue(playerId);
      expect(actionQueue.length).to.eq(0);
      await expectRemovedCurrentAction(players, playerId, 0);
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.FIREMAKING)).to.eq(queuedActionFiremaking.timespan);
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.WOODCUTTING)).to.eq(0);
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.FISHING)).to.eq(0);
    });

    it("Have no items, partial start the last action", async function () {
      const {playerId, players, itemNFT, worldActions, alice, owner} = await loadFixture(playersFixture);

      const {queuedAction: queuedActionFiremaking} = await setupBasicFiremaking(itemNFT, worldActions);
      const {queuedAction: queuedActionWoodcutting} = await setupBasicWoodcutting(itemNFT, worldActions);
      const {queuedAction: queuedActionFishing} = await setupBasicFishing(itemNFT, worldActions);
      await players
        .connect(alice)
        .startActions(
          playerId,
          [queuedActionFiremaking, queuedActionWoodcutting, queuedActionFishing],
          EstforTypes.ActionQueueStrategy.OVERWRITE
        );

      await itemNFT.mint(alice, EstforConstants.LOG, 10000);

      // Completely finish first and second one and go into the third one a bit
      await ethers.provider.send("evm_increaseTime", [
        queuedActionFiremaking.timespan + queuedActionWoodcutting.timespan + 1
      ]);
      await ethers.provider.send("evm_mine", []);
      // Remove required items
      await itemNFT
        .connect(alice)
        .safeBatchTransferFrom(
          alice,
          owner,
          [EstforConstants.MAGIC_FIRE_STARTER, EstforConstants.BRONZE_AXE, EstforConstants.NET_STICK],
          [1, 1, 1],
          "0x"
        );
      // Should remove all actions
      await players.connect(alice).processActions(playerId);
      const actionQueue = await players.getActionQueue(playerId);
      expect(actionQueue.length).to.eq(0);
      await expectRemovedCurrentAction(players, playerId, 0);
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.FIREMAKING)).to.eq(3600);
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.WOODCUTTING)).to.eq(3600);
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.FISHING)).to.eq(0);
    });

    it("Have no items at the end, but do at all checkpoints", async function () {
      const {playerId, players, itemNFT, worldActions, alice, owner} = await loadFixture(playersFixture);

      const {queuedAction: queuedActionWoodcutting} = await setupBasicWoodcutting(itemNFT, worldActions);
      const {queuedAction: queuedActionFiremaking} = await setupBasicFiremaking(itemNFT, worldActions);
      const {queuedAction: queuedActionFishing} = await setupBasicFishing(itemNFT, worldActions);
      await players
        .connect(alice)
        .startActions(
          playerId,
          [queuedActionFiremaking, queuedActionWoodcutting, queuedActionFishing],
          EstforTypes.ActionQueueStrategy.OVERWRITE
        );
      await players.connect(alice).processActions(playerId);

      // Completely finish first all
      await ethers.provider.send("evm_increaseTime", [
        queuedActionFiremaking.timespan + queuedActionWoodcutting.timespan + queuedActionFishing.timespan
      ]);
      await ethers.provider.send("evm_mine", []);
      // Remove required items
      await itemNFT
        .connect(alice)
        .safeBatchTransferFrom(
          alice,
          owner,
          [EstforConstants.MAGIC_FIRE_STARTER, EstforConstants.BRONZE_AXE, EstforConstants.NET_STICK],
          [1, 1, 1],
          "0x"
        );
      // Should remove all actions
      await players.connect(alice).processActions(playerId);
      const actionQueue = await players.getActionQueue(playerId);
      expect(actionQueue.length).to.eq(0);
      await expectRemovedCurrentAction(players, playerId, 0);
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.FIREMAKING)).to.eq(queuedActionFiremaking.timespan);
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.WOODCUTTING)).to.eq(
        queuedActionWoodcutting.timespan
      );
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.FISHING)).to.eq(queuedActionFishing.timespan);
    });

    it("Missing middle item, 3 fully finished actions, checking consumed/produced is correct", async function () {
      const {playerId, players, itemNFT, worldActions, alice, owner} = await loadFixture(playersFixture);

      const {queuedAction: queuedActionWoodcutting} = await setupBasicWoodcutting(itemNFT, worldActions);
      const {queuedAction: queuedActionFiremaking} = await setupBasicFiremaking(itemNFT, worldActions);
      const {queuedAction: queuedActionFishing} = await setupBasicFishing(itemNFT, worldActions);
      await players
        .connect(alice)
        .startActions(
          playerId,
          [queuedActionWoodcutting, queuedActionFiremaking, queuedActionFishing],
          EstforTypes.ActionQueueStrategy.OVERWRITE
        );

      // Remove required item for firemaking
      await itemNFT.connect(alice).safeTransferFrom(alice, owner, EstforConstants.MAGIC_FIRE_STARTER, 1, "0x");

      // Completely finish all
      await ethers.provider.send("evm_increaseTime", [
        queuedActionWoodcutting.timespan + queuedActionFiremaking.timespan + queuedActionFishing.timespan
      ]);
      await ethers.provider.send("evm_mine", []);
      let pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
      expect(pendingQueuedActionState.equipmentStates.length).to.eq(2);
      expect(pendingQueuedActionState.equipmentStates[0].producedItemTokenIds[0]).to.eq(EstforConstants.LOG);
      expect(pendingQueuedActionState.equipmentStates[1].producedItemTokenIds[0]).to.eq(EstforConstants.RAW_MINNUS);

      await players.connect(alice).processActions(playerId);

      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.WOODCUTTING)).to.eq(3600);
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.FIREMAKING)).to.eq(0);
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.FISHING)).to.eq(3600);
    });
  });

  it("currentAction in-progress actions", async function () {
    const {playerId, players, itemNFT, worldActions, alice, owner} = await loadFixture(playersFixture);
    const {queuedAction, rate} = await setupBasicWoodcutting(itemNFT, worldActions);

    await players
      .connect(alice)
      .startActions(playerId, [queuedAction, queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);

    await ethers.provider.send("evm_increaseTime", [(queuedAction.timespan * 10) / rate]); // Just do 1 of the action
    await ethers.provider.send("evm_mine", []);
    const {timestamp: NOW} = (await ethers.provider.getBlock("latest")) as Block;
    await players.connect(alice).processActions(playerId);
    const player = await (await getPlayersHelper(players)).getPlayer(playerId);
    expect(player.currentActionStartTimestamp).to.eq(NOW + 1);
    expect(player.currentActionProcessedSkill1).to.eq(Skill.WOODCUTTING);
    expect(player.currentActionProcessedXPGained1).to.eq((queuedAction.timespan * 10) / rate);
    expect(player.currentActionProcessedSkill2).to.eq(Skill.NONE);
    expect(player.currentActionProcessedXPGained2).to.eq(0);
    expect(player.currentActionProcessedFoodConsumed).to.eq(0);
    expect(player.currentActionProcessedBaseInputItemsConsumedNum).to.eq(0);
  });

  it("Maxing out XP", async function () {
    const {playerId, players, itemNFT, worldActions, playersLibrary, alice} = await loadFixture(playersFixture);
    const rate = 100 * GUAR_MUL; // per hour
    const tx = await worldActions.addActions([
      {
        actionId: 1,
        info: {
          ...defaultActionInfo,
          skill: EstforTypes.Skill.WOODCUTTING,
          xpPerHour: 16000000, // 16MM
          minXP: 0,
          numSpawned: 0,
          handItemTokenIdRangeMin: EstforConstants.ORICHALCUM_AXE,
          handItemTokenIdRangeMax: EstforConstants.WOODCUTTING_MAX,
          isAvailable: true,
          actionChoiceRequired: false,
          successPercent: 100
        },
        guaranteedRewards: [{itemTokenId: EstforConstants.LOG, rate}],
        randomRewards: [],
        combatStats: EstforTypes.emptyCombatStats
      }
    ]);
    const actionId = await getActionId(tx, worldActions);

    const timespan = 3600 * 24;
    const queuedAction: EstforTypes.QueuedActionInput = {
      attire: EstforTypes.noAttire,
      actionId,
      combatStyle: EstforTypes.CombatStyle.NONE,
      choiceId: EstforConstants.NONE,
      regenerateId: EstforConstants.NONE,
      timespan,
      rightHandEquipmentTokenId: EstforConstants.ORICHALCUM_AXE,
      leftHandEquipmentTokenId: EstforConstants.NONE,
      petId: EstforConstants.NONE
    };

    const minXP = getXPFromLevel(98);
    await players.modifyXP(alice, playerId, EstforTypes.Skill.WOODCUTTING, minXP, SKIP_XP_THRESHOLD_EFFECTS);

    await itemNFT.addItems([
      {
        ...EstforTypes.defaultItemInput,
        skill: EstforTypes.Skill.WOODCUTTING,
        minXP,
        tokenId: EstforConstants.ORICHALCUM_AXE,
        equipPosition: EstforTypes.EquipPosition.RIGHT_HAND
      }
    ]);

    await itemNFT.mint(alice, EstforConstants.ORICHALCUM_AXE, 1);

    // 16MM is the maximum xp per hour that can be gained, so need to loop it many times to go over
    for (let i = 0; i < 25; ++i) {
      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);
      await timeTravel24Hours();
      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);
    }
    const xp = await players.getPlayerXP(playerId, EstforTypes.Skill.WOODCUTTING);
    expect(xp).to.eq(Math.pow(2, 32) - 1);

    await players.connect(alice).processActions(playerId);

    expect(await playersLibrary.getLevel(xp)).to.eq(MAX_LEVEL);
  });

  it("Set active player to existing", async function () {
    const {playerId, players, alice} = await loadFixture(playersFixture);
    await expect(players.connect(alice).setActivePlayer(playerId)).to.be.revertedWithCustomError(
      players,
      "PlayerAlreadyActive"
    );
  });

  it("Transferring active player", async function () {
    const {playerId, players, playerNFT, alice, owner} = await loadFixture(playersFixture);

    expect(await players.connect(alice).getActivePlayer(alice)).to.eq(playerId);
    await playerNFT.connect(alice).safeTransferFrom(alice, owner, playerId, 1, "0x");
    expect(await players.connect(alice).getActivePlayer(alice)).to.eq(0);
  });

  it("Transferring non-active player", async function () {
    const {playerId, players, playerNFT, alice, owner} = await loadFixture(playersFixture);

    const newPlayerId = await createPlayer(playerNFT, 1, alice, "New name", false);
    expect(await players.connect(alice).getActivePlayer(alice)).to.eq(playerId);
    await playerNFT.connect(alice).safeTransferFrom(alice, owner, newPlayerId, 1, "0x");
    expect(await players.connect(alice).getActivePlayer(alice)).to.eq(playerId);
  });

  it("Transferring a player with an active boost should remove it", async function () {
    const {playerId, players, playerNFT, itemNFT, worldActions, alice, owner} = await loadFixture(playersFixture);

    const {queuedAction} = await setupBasicWoodcutting(itemNFT, worldActions);

    const boostValue = 50;
    await itemNFT.addItems([
      {
        ...EstforTypes.defaultItemInput,
        tokenId: EstforConstants.XP_BOOST,
        equipPosition: EstforTypes.EquipPosition.BOOST_VIAL,
        // Boost
        boostType: EstforTypes.BoostType.NON_COMBAT_XP,
        boostValue,
        boostDuration: 86400,
        isTransferable: false
      }
    ]);

    await itemNFT.mint(alice, EstforConstants.XP_BOOST, 1);
    await players
      .connect(alice)
      .startActionsAdvanced(
        playerId,
        [queuedAction],
        EstforConstants.XP_BOOST,
        BOOST_START_NOW,
        0,
        NO_DONATION_AMOUNT,
        EstforTypes.ActionQueueStrategy.OVERWRITE
      );

    expect((await players.getActiveBoost(playerId)).boostType).to.not.eq(0);
    await playerNFT.connect(alice).safeTransferFrom(alice, owner, playerId, 1, "0x");
    // Active boost should be removed
    expect((await players.getActiveBoost(playerId)).boostType).to.eq(0);
  });

  it("Game paused", async function () {
    const {playerId, players, itemNFT, worldActions, alice, owner} = await loadFixture(playersFixture);

    // Do not allow processing an action while game is paused
    const {queuedAction} = await setupBasicWoodcutting(itemNFT, worldActions);
    await expect(players.connect(alice).pauseGame(true)).to.be.revertedWithCustomError(
      players,
      "OwnableUnauthorizedAccount"
    );
    await players.pauseGame(true);
    await expect(
      players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE)
    ).to.be.revertedWithCustomError(players, "GameIsPaused");
    await players.pauseGame(false);
    await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);
    await players.pauseGame(true);
    await expect(players.connect(alice).processActions(playerId)).to.be.revertedWithCustomError(
      players,
      "GameIsPaused"
    );
    await players.pauseGame(false);
    await expect(players.connect(alice).processActions(playerId)).to.not.be.reverted;
  });

  it("0 timespan for an action is not allowed", async function () {
    const {playerId, players, itemNFT, worldActions, alice} = await loadFixture(playersFixture);
    const {queuedAction: basicWoodcuttingQueuedAction} = await setupBasicWoodcutting(itemNFT, worldActions);
    const queuedAction = {...basicWoodcuttingQueuedAction};
    queuedAction.timespan = 0;
    await expect(
      players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE)
    ).to.be.revertedWithCustomError(players, "EmptyTimespan");
  });

  it("Should error when specifying choice id when it isn't required", async function () {
    const {playerId, players, itemNFT, worldActions, alice} = await loadFixture(playersFixture);
    const {queuedAction: basicWoodcuttingQueuedAction} = await setupBasicWoodcutting(itemNFT, worldActions);
    const queuedAction = {...basicWoodcuttingQueuedAction};
    queuedAction.choiceId = BigInt(EstforConstants.ACTIONCHOICE_COOKING_ANCHO);
    await expect(
      players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE)
    ).to.be.revertedWithCustomError(players, "ActionChoiceIdNotRequired");
  });

  it("Check timespan overflow", async function () {
    // This test was added to check for a bug where the timespan was > 65535 but cast to uint16
    const {playerId, players, itemNFT, worldActions, alice} = await loadFixture(playersFixture);

    const {queuedAction: basicWoodcuttingQueuedAction} = await setupBasicWoodcutting(itemNFT, worldActions);
    const queuedAction = {...basicWoodcuttingQueuedAction};
    queuedAction.timespan = 24 * 3600;
    await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);
    await ethers.provider.send("evm_increaseTime", [5]);
    await ethers.provider.send("evm_mine", []);
    await players.connect(alice).processActions(playerId);
    const actionQueue = await players.getActionQueue(playerId);
    expect(actionQueue[0].timespan).gt(queuedAction.timespan - 10);
  });

  it("Base XP boost", async function () {
    const {players, playerNFT, itemNFT, worldActions, alice} = await loadFixture(playersFixture);

    const avatarId = 2;
    const avatarInfo: AvatarInfo = {
      name: "Name goes here",
      description: "Hi I'm a description",
      imageURI: "1234.png",
      startSkills: [Skill.WOODCUTTING, Skill.NONE]
    };
    await playerNFT.setAvatars([avatarId], [avatarInfo]);
    const playerId = await createPlayer(playerNFT, avatarId, alice, "New name", true);

    const {queuedAction} = await setupBasicWoodcutting(itemNFT, worldActions);
    await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);
    await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]);
    await ethers.provider.send("evm_mine", []);

    const pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
    expect(pendingQueuedActionState.actionMetadatas[0].xpGained).to.eq(Math.floor(queuedAction.timespan * 1.1));
    await players.connect(alice).processActions(playerId);
    const startXP = START_XP;
    expect(await players.getPlayerXP(playerId, EstforTypes.Skill.WOODCUTTING)).to.eq(
      startXP + BigInt(Math.floor(queuedAction.timespan * 1.1))
    );
  });

  it("Base XP boost, 2 skills", async function () {
    const {players, playerNFT, itemNFT, worldActions, alice} = await loadFixture(playersFixture);

    const avatarId = 2;
    const avatarInfo: AvatarInfo = {
      name: "Name goes here",
      description: "Hi I'm a description",
      imageURI: "1234.png",
      startSkills: [Skill.THIEVING, Skill.WOODCUTTING]
    };
    await playerNFT.setAvatars([avatarId], [avatarInfo]);
    const playerId = await createPlayer(playerNFT, avatarId, alice, "New name", true);

    const {queuedAction} = await setupBasicWoodcutting(itemNFT, worldActions);
    await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);
    await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]);
    await ethers.provider.send("evm_mine", []);

    const pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
    expect(pendingQueuedActionState.actionMetadatas[0].xpGained).to.eq(Math.floor(queuedAction.timespan * 1.05));
    await players.connect(alice).processActions(playerId);
    const startXP = START_XP / 2n;
    expect(await players.getPlayerXP(playerId, EstforTypes.Skill.WOODCUTTING)).to.eq(
      startXP + BigInt(Math.floor(queuedAction.timespan * 1.05))
    );
  });

  it("Base XP boost, upgraded", async function () {
    const {players, playerNFT, itemNFT, worldActions, brush, upgradePlayerBrushPrice, alice} = await loadFixture(
      playersFixture
    );

    const avatarId = 2;
    const avatarInfo: AvatarInfo = {
      name: "Name goes here",
      description: "Hi I'm a description",
      imageURI: "1234.png",
      startSkills: [Skill.WOODCUTTING, Skill.NONE]
    };
    await playerNFT.setAvatars([avatarId], [avatarInfo]);
    const playerId = await createPlayer(playerNFT, avatarId, alice, "New name", true);

    const {queuedAction} = await setupBasicWoodcutting(itemNFT, worldActions);
    await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);
    await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]);
    await ethers.provider.send("evm_mine", []);

    await brush.connect(alice).approve(playerNFT, upgradePlayerBrushPrice);
    await brush.mint(alice, upgradePlayerBrushPrice);
    // Upgrade player, should have a 20% boost now
    await playerNFT.connect(alice).editPlayer(playerId, "New name", "", "", "", true);
    const pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
    expect(pendingQueuedActionState.actionMetadatas[0].xpGained).to.eq(Math.floor(queuedAction.timespan * 1.2));
    await players.connect(alice).processActions(playerId);
    const startXP = START_XP;
    expect(await players.getPlayerXP(playerId, EstforTypes.Skill.WOODCUTTING)).to.eq(
      startXP + BigInt(Math.floor(queuedAction.timespan * 1.2))
    );
  });

  it("Base XP boost, 2 skills, upgraded", async function () {
    const {players, playerNFT, itemNFT, worldActions, brush, upgradePlayerBrushPrice, alice} = await loadFixture(
      playersFixture
    );

    const avatarId = 2;
    const avatarInfo: AvatarInfo = {
      name: "Name goes here",
      description: "Hi I'm a description",
      imageURI: "1234.png",
      startSkills: [Skill.THIEVING, Skill.WOODCUTTING]
    };
    await playerNFT.setAvatars([avatarId], [avatarInfo]);
    const playerId = await createPlayer(playerNFT, avatarId, alice, "New name", true);

    const {queuedAction} = await setupBasicWoodcutting(itemNFT, worldActions);
    await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);
    await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]);
    await ethers.provider.send("evm_mine", []);

    await brush.connect(alice).approve(playerNFT, upgradePlayerBrushPrice);
    await brush.mint(alice, upgradePlayerBrushPrice);
    // Upgrade player, should have a 20% boost now
    await playerNFT.connect(alice).editPlayer(playerId, "New name", "", "", "", true);
    const pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
    expect(pendingQueuedActionState.actionMetadatas[0].xpGained).to.eq(Math.floor(queuedAction.timespan * 1.1));
    await players.connect(alice).processActions(playerId);
    const startXP = START_XP / 2n;
    expect(await players.getPlayerXP(playerId, EstforTypes.Skill.WOODCUTTING)).to.eq(
      startXP + BigInt(Math.floor(queuedAction.timespan * 1.1))
    );
  });

  it("Check max level packed XP", async function () {
    const {players, playerId, alice} = await loadFixture(playersFixture);

    let packedXP = await (await getPlayersHelper(players)).getPackedXP(playerId);
    const xp = await getXPFromLevel(MAX_LEVEL); // First Max level

    await players.modifyXP(alice, playerId, EstforTypes.Skill.MELEE, xp, SKIP_XP_THRESHOLD_EFFECTS);
    packedXP = await (await getPlayersHelper(players)).getPackedXP(playerId);
    let maxDataAsNum = Number(packedXP.packedDataIsMaxed);

    await players.modifyXP(alice, playerId, EstforTypes.Skill.MAGIC, xp, SKIP_XP_THRESHOLD_EFFECTS);
    packedXP = await (await getPlayersHelper(players)).getPackedXP(playerId);

    maxDataAsNum = Number(packedXP.packedDataIsMaxed);
    const MELEE_OFFSET = 0;
    const RANGED_OFFSET = 2;
    const MAGIC_OFFSET = 4;
    const DEFENCE_OFFSET = 6;
    const HEALTH_OFFSET = 8;
    const RESERVED_COMBAT_OFFSET = 10;
    expect((maxDataAsNum >> MELEE_OFFSET) & 0b11).to.eq(1);
    expect((maxDataAsNum >> RANGED_OFFSET) & 0b11).to.eq(0);
    expect((maxDataAsNum >> MAGIC_OFFSET) & 0b11).to.eq(1);
    expect((maxDataAsNum >> DEFENCE_OFFSET) & 0b11).to.eq(0);
    expect((maxDataAsNum >> HEALTH_OFFSET) & 0b11).to.eq(0);
    expect((maxDataAsNum >> RESERVED_COMBAT_OFFSET) & 0b11).to.eq(0);

    maxDataAsNum = Number(packedXP.packedDataIsMaxed1);
    const MINING_OFFSET = 0;
    const WOODCUTTING_OFFSET = 2;
    const FISHING_OFFSET = 4;
    const SMITHING_OFFSET = 6;
    const THIEVING_OFFSET = 8;
    const CRAFTING_OFFSET = 10;
    expect((maxDataAsNum >> MINING_OFFSET) & 0b11).to.eq(0);
    expect((maxDataAsNum >> WOODCUTTING_OFFSET) & 0b11).to.eq(0);
    expect((maxDataAsNum >> FISHING_OFFSET) & 0b11).to.eq(0);
    expect((maxDataAsNum >> SMITHING_OFFSET) & 0b11).to.eq(0);
    expect((maxDataAsNum >> THIEVING_OFFSET) & 0b11).to.eq(0);
    expect((maxDataAsNum >> CRAFTING_OFFSET) & 0b11).to.eq(0);

    maxDataAsNum = Number(packedXP.packedDataIsMaxed2);
    const COOKING_OFFSET = 0;
    const FIREMAKING_OFFSET = 2;
    const FARMING_OFFSET = 4;
    const ALCHEMY_OFFSET = 6;
    const FLETCHING_OFFSET = 8;
    const FORGING_OFFSET = 10;
    expect((maxDataAsNum >> COOKING_OFFSET) & 0b11).to.eq(0);
    expect((maxDataAsNum >> FIREMAKING_OFFSET) & 0b11).to.eq(0);
    expect((maxDataAsNum >> FARMING_OFFSET) & 0b11).to.eq(0);
    expect((maxDataAsNum >> ALCHEMY_OFFSET) & 0b11).to.eq(0);
    expect((maxDataAsNum >> FLETCHING_OFFSET) & 0b11).to.eq(0);
    expect((maxDataAsNum >> FORGING_OFFSET) & 0b11).to.eq(0);

    await players.modifyXP(alice, playerId, EstforTypes.Skill.CRAFTING, xp - 1, SKIP_XP_THRESHOLD_EFFECTS); // 1 below max
    packedXP = await (await getPlayersHelper(players)).getPackedXP(playerId);
    expect((Number(packedXP.packedDataIsMaxed1) >> CRAFTING_OFFSET) & 0b11).to.eq(0);
    await players.modifyXP(alice, playerId, EstforTypes.Skill.CRAFTING, xp, SKIP_XP_THRESHOLD_EFFECTS); // Now max
    packedXP = await (await getPlayersHelper(players)).getPackedXP(playerId);
    expect((Number(packedXP.packedDataIsMaxed1) >> CRAFTING_OFFSET) & 0b11).to.eq(1);

    // Set a few more and check the rest
    await players.modifyXP(alice, playerId, EstforTypes.Skill.SMITHING, xp, SKIP_XP_THRESHOLD_EFFECTS);
    await players.modifyXP(alice, playerId, EstforTypes.Skill.WOODCUTTING, xp, SKIP_XP_THRESHOLD_EFFECTS);
    await players.modifyXP(alice, playerId, EstforTypes.Skill.FORGING, xp, SKIP_XP_THRESHOLD_EFFECTS);

    packedXP = await (await getPlayersHelper(players)).getPackedXP(playerId);
    maxDataAsNum = Number(packedXP.packedDataIsMaxed);
    expect((maxDataAsNum >> MELEE_OFFSET) & 0b11).to.eq(1);
    expect((maxDataAsNum >> RANGED_OFFSET) & 0b11).to.eq(0);
    expect((maxDataAsNum >> MAGIC_OFFSET) & 0b11).to.eq(1);
    expect((maxDataAsNum >> DEFENCE_OFFSET) & 0b11).to.eq(0);
    expect((maxDataAsNum >> HEALTH_OFFSET) & 0b11).to.eq(0);
    expect((maxDataAsNum >> RESERVED_COMBAT_OFFSET) & 0b11).to.eq(0);

    maxDataAsNum = Number(packedXP.packedDataIsMaxed1);
    expect((maxDataAsNum >> MINING_OFFSET) & 0b11).to.eq(0);
    expect((maxDataAsNum >> WOODCUTTING_OFFSET) & 0b11).to.eq(1);
    expect((maxDataAsNum >> FISHING_OFFSET) & 0b11).to.eq(0);
    expect((maxDataAsNum >> SMITHING_OFFSET) & 0b11).to.eq(1);
    expect((maxDataAsNum >> THIEVING_OFFSET) & 0b11).to.eq(0);
    expect((maxDataAsNum >> CRAFTING_OFFSET) & 0b11).to.eq(1);

    maxDataAsNum = Number(packedXP.packedDataIsMaxed2);
    expect((maxDataAsNum >> COOKING_OFFSET) & 0b11).to.eq(0);
    expect((maxDataAsNum >> FIREMAKING_OFFSET) & 0b11).to.eq(0);
    expect((maxDataAsNum >> FARMING_OFFSET) & 0b11).to.eq(0);
    expect((maxDataAsNum >> ALCHEMY_OFFSET) & 0b11).to.eq(0);
    expect((maxDataAsNum >> FLETCHING_OFFSET) & 0b11).to.eq(0);
    expect((maxDataAsNum >> FORGING_OFFSET) & 0b11).to.eq(1);
  });

  it("Queued actions exceed max time", async function () {
    const {playerId, players, itemNFT, worldActions, alice} = await loadFixture(playersFixture);
    const {queuedAction: basicWoodcuttingQueuedAction} = await setupBasicWoodcutting(itemNFT, worldActions);
    const queuedAction = {...basicWoodcuttingQueuedAction};
    queuedAction.timespan = 23 * 3600;
    await expect(
      players
        .connect(alice)
        .startActions(
          playerId,
          [basicWoodcuttingQueuedAction, queuedAction, basicWoodcuttingQueuedAction],
          EstforTypes.ActionQueueStrategy.OVERWRITE
        )
    ).to.be.revertedWithCustomError(players, "EmptyTimespan");

    basicWoodcuttingQueuedAction.timespan = 2 * 3600;
    await expect(
      players
        .connect(alice)
        .startActions(
          playerId,
          [basicWoodcuttingQueuedAction, queuedAction, basicWoodcuttingQueuedAction],
          EstforTypes.ActionQueueStrategy.OVERWRITE
        )
    ).to.be.revertedWithCustomError(players, "ActionTimespanExceedsMaxTime");

    // If it's at the end then it trims it
    await players
      .connect(alice)
      .startActions(
        playerId,
        [basicWoodcuttingQueuedAction, basicWoodcuttingQueuedAction, queuedAction],
        EstforTypes.ActionQueueStrategy.OVERWRITE
      );

    const actionQueue = await players.getActionQueue(playerId);
    expect(actionQueue[2].timespan).to.eq(20 * 3600);
  });

  it("Queued actions exceed max time with remainder", async function () {
    const {playerId, players, itemNFT, worldActions, alice} = await loadFixture(playersFixture);
    const {queuedAction: basicWoodcuttingQueuedAction} = await setupBasicWoodcutting(itemNFT, worldActions);
    const queuedAction = {...basicWoodcuttingQueuedAction, timespan: 1600};
    const fullTimeAction = {...basicWoodcuttingQueuedAction, timespan: 24 * 3600};
    // If it's at the end then it trims it
    await players
      .connect(alice)
      .startActions(playerId, [queuedAction, fullTimeAction], EstforTypes.ActionQueueStrategy.OVERWRITE);

    let actionQueue = await players.getActionQueue(playerId);
    expect(actionQueue[0].timespan).to.eq(1600);
    expect(actionQueue[1].timespan).to.eq(24 * 3600);

    await ethers.provider.send("evm_increaseTime", [23 * 3600 - 1]);
    await ethers.provider.send("evm_mine", []);

    // Now try it keeping remaining queued actions
    await players
      .connect(alice)
      .startActions(playerId, [fullTimeAction], EstforTypes.ActionQueueStrategy.KEEP_LAST_IN_PROGRESS);

    actionQueue = await players.getActionQueue(playerId);
    expect(actionQueue[0].timespan).to.eq(1600 + 3600);
    expect(actionQueue[1].timespan).to.eq(23 * 3600);
  });

  it("Queued actions exceed max time with remainder", async function () {
    const {playerId, players, itemNFT, worldActions, alice} = await loadFixture(playersFixture);
    const {queuedAction: basicWoodcuttingQueuedAction} = await setupBasicWoodcutting(itemNFT, worldActions);
    const queuedAction = {...basicWoodcuttingQueuedAction, timespan: 25 * 3600};
    await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);
    const actionQueue = await players.getActionQueue(playerId);
    expect(actionQueue[0].timespan).to.eq(24 * 3600);
  });

  it("Transferring a player with boost should add a lock", async function () {
    const {players, playerId, playerNFT, itemNFT, alice, owner} = await loadFixture(playersFixture);

    const boosts = [
      EstforConstants.COMBAT_BOOST,
      EstforConstants.XP_BOOST,
      EstforConstants.SKILL_BOOST,
      EstforConstants.GATHERING_BOOST
    ];

    for (const boost of boosts) {
      await playerNFT.connect(alice).safeTransferFrom(alice, owner, playerId, 1, "0x");
      const receipt = await players.setActivePlayer(playerId);
      if (boost == boosts[0]) {
        // First one should not emit
        expect(receipt).to.not.emit(players, "PlayerUnlocked");
      } else {
        expect(receipt).to.emit(players, "PlayerUnlocked");
      }

      // Add a boost to the receiver, and setting active player if no longer possible
      await itemNFT.mint(alice, boost, 1);
      await playerNFT.safeTransferFrom(owner, alice, playerId, 1, "0x");
      await expect(players.connect(alice).setActivePlayer(playerId)).to.be.revertedWithCustomError(
        players,
        "PlayerLocked"
      );
      await itemNFT.connect(alice).burn(alice, boost, 1);
    }

    await playerNFT.connect(alice).safeTransferFrom(alice, owner, playerId, 1, "0x");
    await playerNFT.safeTransferFrom(owner, alice, playerId, 1, "0x");
    await expect(players.connect(alice).setActivePlayer(playerId)).to.not.be.reverted;
  });

  it("Transferring a player with boost should add a lock released after some time", async function () {
    const {players, playerId, playerNFT, itemNFT, alice, owner} = await loadFixture(playersFixture);

    await itemNFT.mint(owner, EstforConstants.COMBAT_BOOST, 1);
    await playerNFT.connect(alice).safeTransferFrom(alice, owner, playerId, 1, "0x");

    await expect(players.setActivePlayer(playerId)).to.be.revertedWithCustomError(players, "PlayerLocked");
    // Wait 1 day and it should now be allowed
    await ethers.provider.send("evm_increaseTime", [24 * 3600]);
    await ethers.provider.send("evm_mine", []);
    await expect(players.setActivePlayer(playerId)).to.not.be.reverted;
  });

  it("Check that only upgraded players can equip full mode only items (left/right hand equipment)", async function () {
    const {
      players,
      playerId,
      playerNFT,
      itemNFT,
      worldActions,
      randomnessBeacon,
      brush,
      upgradePlayerBrushPrice,
      origName,
      alice
    } = await loadFixture(playersFixture);

    const {queuedAction} = await setupBasicWoodcutting(itemNFT, worldActions);
    // Cannot equip full mode only items unless you are upgraded
    await itemNFT.editItems([
      {
        ...EstforTypes.defaultItemInput,
        tokenId: EstforConstants.BRONZE_AXE,
        equipPosition: EstforTypes.EquipPosition.RIGHT_HAND,
        isFullModeOnly: true
      }
    ]);

    await expect(
      players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE)
    ).to.be.revertedWithCustomError(players, "PlayerNotUpgraded");

    await brush.connect(alice).approve(playerNFT, upgradePlayerBrushPrice);
    await brush.mint(alice, upgradePlayerBrushPrice);

    await playerNFT.connect(alice).editPlayer(playerId, origName, "", "", "", true);
    await expect(
      players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE)
    ).to.not.be.reverted;
  });

  it("Check that only upgraded players can equip full mode only items (attire)", async function () {
    const {
      players,
      playerId,
      playerNFT,
      itemNFT,
      worldActions,
      randomnessBeacon,
      brush,
      upgradePlayerBrushPrice,
      origName,
      alice
    } = await loadFixture(playersFixture);

    const {queuedAction: queuedActionWoodcutting} = await setupBasicWoodcutting(itemNFT, worldActions);
    const queuedAction = {
      ...queuedActionWoodcutting,
      attire: {...EstforTypes.noAttire, head: EstforConstants.BRONZE_HELMET}
    };

    await itemNFT.addItems([
      {
        ...EstforTypes.defaultItemInput,
        tokenId: EstforConstants.BRONZE_HELMET,
        equipPosition: EstforTypes.EquipPosition.HEAD,
        isFullModeOnly: true
      }
    ]);

    await itemNFT.mint(alice, EstforConstants.BRONZE_HELMET, 1);

    await expect(
      players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE)
    ).to.be.revertedWithCustomError(players, "PlayerNotUpgraded");

    await brush.connect(alice).approve(playerNFT, upgradePlayerBrushPrice);
    await brush.mint(alice, upgradePlayerBrushPrice);

    await playerNFT.connect(alice).editPlayer(playerId, origName, "", "", "", true);
    await expect(
      players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE)
    ).to.not.be.reverted;
  });

  it("Check that only upgraded players can equip full mode only items (left/right hand equipment)", async function () {
    const {
      players,
      playerId,
      playerNFT,
      itemNFT,
      worldActions,
      randomnessBeacon,
      brush,
      upgradePlayerBrushPrice,
      origName,
      alice
    } = await loadFixture(playersFixture);

    const {queuedAction} = await setupBasicWoodcutting(itemNFT, worldActions);
    // Cannot equip full mode only items unless you are upgraded
    await itemNFT.editItems([
      {
        ...EstforTypes.defaultItemInput,
        tokenId: EstforConstants.BRONZE_AXE,
        equipPosition: EstforTypes.EquipPosition.RIGHT_HAND,
        isFullModeOnly: true
      }
    ]);

    await expect(
      players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE)
    ).to.be.revertedWithCustomError(players, "PlayerNotUpgraded");

    await brush.connect(alice).approve(playerNFT, upgradePlayerBrushPrice);
    await brush.mint(alice, upgradePlayerBrushPrice);

    await playerNFT.connect(alice).editPlayer(playerId, origName, "", "", "", true);
    await expect(
      players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE)
    ).to.not.be.reverted;
  });

  it("Check that only upgraded players can start a full mode only actionChoice, where action is not set to full mode only", async function () {
    const {
      playerId,
      players,
      itemNFT,
      worldActions,
      randomnessBeacon,
      alice,
      playerNFT,
      brush,
      upgradePlayerBrushPrice,
      origName
    } = await loadFixture(playersFixture);

    const successPercent = 100;
    const minLevel = 1;
    const {queuedAction, rate} = await setupBasicCooking(itemNFT, worldActions, successPercent, minLevel);

    await worldActions.editActionChoices(
      queuedAction.actionId,
      [queuedAction.choiceId],
      [
        {
          ...defaultActionChoice,
          skill: EstforTypes.Skill.COOKING,
          xpPerHour: 3600,
          rate,
          inputTokenIds: [EstforConstants.RAW_MINNUS],
          inputAmounts: [1],
          outputTokenId: EstforConstants.COOKED_MINNUS,
          outputAmount: 1,
          successPercent,
          skills: minLevel > 1 ? [EstforTypes.Skill.COOKING] : [],
          skillMinXPs: minLevel > 1 ? [getXPFromLevel(minLevel)] : [],
          isFullModeOnly: true
        }
      ]
    );

    await expect(
      players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE)
    ).to.be.revertedWithCustomError(players, "PlayerNotUpgraded");
    // Upgrade and try again
    await brush.connect(alice).approve(playerNFT, upgradePlayerBrushPrice);
    await brush.mint(alice, upgradePlayerBrushPrice);
    await playerNFT.connect(alice).editPlayer(playerId, origName, "", "", "", true);
    await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);
  });

  it("Check that only upgraded players can start a full mode only actionChoice, where action is also set to full mode only", async function () {
    const {
      playerId,
      players,
      itemNFT,
      worldActions,
      randomnessBeacon,
      alice,
      playerNFT,
      brush,
      upgradePlayerBrushPrice,
      origName
    } = await loadFixture(playersFixture);

    const successPercent = 100;
    const minLevel = 1;
    const {queuedAction, rate} = await setupBasicCooking(itemNFT, worldActions, successPercent, minLevel);

    await worldActions.editActions([
      {
        actionId: 1,
        info: {
          skill: EstforTypes.Skill.COOKING,
          xpPerHour: 0,
          minXP: 0,
          worldLocation: 0,
          isFullModeOnly: true,
          numSpawned: 0,
          handItemTokenIdRangeMin: EstforConstants.NONE,
          handItemTokenIdRangeMax: EstforConstants.NONE,
          isAvailable: true,
          questPrerequisiteId: 0,
          actionChoiceRequired: true,
          successPercent: 100
        },
        guaranteedRewards: [],
        randomRewards: [],
        combatStats: EstforTypes.emptyCombatStats
      }
    ]);

    await worldActions.editActionChoices(
      queuedAction.actionId,
      [queuedAction.choiceId],
      [
        {
          ...defaultActionChoice,
          skill: EstforTypes.Skill.COOKING,
          xpPerHour: 3600,
          rate,
          inputTokenIds: [EstforConstants.RAW_MINNUS],
          inputAmounts: [1],
          outputTokenId: EstforConstants.COOKED_MINNUS,
          outputAmount: 1,
          successPercent,
          skills: minLevel > 1 ? [EstforTypes.Skill.COOKING] : [],
          skillMinXPs: minLevel > 1 ? [getXPFromLevel(minLevel)] : [],
          isFullModeOnly: true
        }
      ]
    );

    await expect(
      players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE)
    ).to.be.revertedWithCustomError(players, "PlayerNotUpgraded");
    // Upgrade and try again
    await brush.connect(alice).approve(playerNFT, upgradePlayerBrushPrice);
    await brush.mint(alice, upgradePlayerBrushPrice);
    await playerNFT.connect(alice).editPlayer(playerId, origName, "", "", "", true);
    await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);
  });

  it("Check that only upgraded players can start a non-full mode only actionChoice, where action is set to full mode only", async function () {
    const {
      playerId,
      players,
      itemNFT,
      worldActions,
      randomnessBeacon,
      alice,
      playerNFT,
      brush,
      upgradePlayerBrushPrice,
      origName
    } = await loadFixture(playersFixture);

    const successPercent = 100;
    const minLevel = 1;
    const {queuedAction} = await setupBasicCooking(itemNFT, worldActions, successPercent, minLevel);

    await worldActions.editActions([
      {
        actionId: 1,
        info: {
          skill: EstforTypes.Skill.COOKING,
          xpPerHour: 0,
          minXP: 0,
          worldLocation: 0,
          isFullModeOnly: true,
          numSpawned: 0,
          handItemTokenIdRangeMin: EstforConstants.NONE,
          handItemTokenIdRangeMax: EstforConstants.NONE,
          isAvailable: true,
          questPrerequisiteId: 0,
          actionChoiceRequired: true,
          successPercent: 100
        },
        guaranteedRewards: [],
        randomRewards: [],
        combatStats: EstforTypes.emptyCombatStats
      }
    ]);

    await expect(
      players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE)
    ).to.be.revertedWithCustomError(players, "PlayerNotUpgraded");
    // Upgrade and try again
    await brush.connect(alice).approve(playerNFT, upgradePlayerBrushPrice);
    await brush.mint(alice, upgradePlayerBrushPrice);
    await playerNFT.connect(alice).editPlayer(playerId, origName, "", "", "", true);
    await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);
  });

  it("Check that only upgraded players can start a full mode only action", async function () {
    const {playerId, worldActions, players, brush, alice, playerNFT, origName, upgradePlayerBrushPrice} =
      await loadFixture(playersFixture);
    const rate = 100 * GUAR_MUL; // per hour
    const tx = await worldActions.addActions([
      {
        actionId: ACTION_FISHING_MINNUS,
        info: {
          ...defaultActionInfo,
          skill: EstforTypes.Skill.FISHING,
          isFullModeOnly: true,
          isAvailable: true
        },
        guaranteedRewards: [{itemTokenId: EstforConstants.RAW_MINNUS, rate}],
        randomRewards: [],
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
      rightHandEquipmentTokenId: EstforConstants.NONE,
      leftHandEquipmentTokenId: EstforConstants.NONE,
      petId: EstforConstants.NONE
    };

    await expect(
      players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE)
    ).to.be.revertedWithCustomError(players, "PlayerNotUpgraded");
    // Upgrade and try again
    await brush.connect(alice).approve(playerNFT, upgradePlayerBrushPrice);
    await brush.mint(alice, upgradePlayerBrushPrice);
    await playerNFT.connect(alice).editPlayer(playerId, origName, "", "", "", true);
    await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);
  });

  it("Action choice with > 255 input amounts", async function () {
    const {
      players,
      playerId,
      playerNFT,
      itemNFT,
      worldActions,
      randomnessBeacon,
      brush,
      upgradePlayerBrushPrice,
      origName,
      alice
    } = await loadFixture(playersFixture);
    const rate = 100 * RATE_MUL; // per hour

    let tx = await worldActions.addActions([
      {
        actionId: 1,
        info: {
          skill: EstforTypes.Skill.SMITHING,
          xpPerHour: 0,
          minXP: 0,
          worldLocation: 0,
          isFullModeOnly: false,
          numSpawned: 0,
          handItemTokenIdRangeMin: EstforConstants.NONE,
          handItemTokenIdRangeMax: EstforConstants.NONE,
          isAvailable: actionIsAvailable,
          questPrerequisiteId: 0,
          actionChoiceRequired: true,
          successPercent: 100
        },
        guaranteedRewards: [],
        randomRewards: [],
        combatStats: EstforTypes.emptyCombatStats
      }
    ]);
    const actionId = await getActionId(tx, worldActions);

    // Ores go in, bars come out
    tx = await worldActions.addActionChoices(
      actionId,
      [1],
      [
        {
          ...defaultActionChoice,
          skill: EstforTypes.Skill.SMITHING,
          xpPerHour: 3600,
          rate,
          inputTokenIds: [EstforConstants.MITHRIL_ORE, EstforConstants.COAL_ORE, EstforConstants.SAPPHIRE],
          inputAmounts: [1, 256, 6535],
          outputTokenId: EstforConstants.MITHRIL_BAR,
          outputAmount: 1,
          isFullModeOnly: true
        }
      ]
    );

    const choiceId = await getActionChoiceId(tx, worldActions);
    const timespan = 3600;
    const queuedAction: EstforTypes.QueuedActionInput = {
      attire: EstforTypes.noAttire,
      actionId,
      combatStyle: EstforTypes.CombatStyle.NONE,
      choiceId,
      regenerateId: EstforConstants.NONE,
      timespan,
      rightHandEquipmentTokenId: EstforConstants.NONE,
      leftHandEquipmentTokenId: EstforConstants.NONE,
      petId: EstforConstants.NONE
    };

    await itemNFT.addItems([
      {
        ...EstforTypes.defaultItemInput,
        tokenId: EstforConstants.COAL_ORE,
        equipPosition: EstforTypes.EquipPosition.AUX
      },
      {
        ...EstforTypes.defaultItemInput,
        tokenId: EstforConstants.MITHRIL_ORE,
        equipPosition: EstforTypes.EquipPosition.AUX
      },
      {
        ...EstforTypes.defaultItemInput,
        tokenId: EstforConstants.SAPPHIRE,
        equipPosition: EstforTypes.EquipPosition.AUX
      }
    ]);

    const startingBalance = 1000000;
    await itemNFT.mintBatch(
      alice,
      [EstforConstants.COAL_ORE, EstforConstants.MITHRIL_ORE, EstforConstants.SAPPHIRE],
      [startingBalance, startingBalance, startingBalance]
    );
    await brush.connect(alice).approve(playerNFT, upgradePlayerBrushPrice);
    await brush.mint(alice, upgradePlayerBrushPrice);
    await playerNFT.connect(alice).editPlayer(playerId, origName, "", "", "", true);

    await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);
    await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]);
    await ethers.provider.send("evm_mine", []);
    await players.connect(alice).processActions(playerId);
    expect(await players.getPlayerXP(playerId, EstforTypes.Skill.SMITHING)).to.eq(queuedAction.timespan);

    // Check how many bars they have now, 100 bars created per hour, burns 2 coal and 1 mithril
    expect(await itemNFT.balanceOf(alice, EstforConstants.MITHRIL_BAR)).to.eq(
      Math.floor((timespan * rate) / (3600 * RATE_MUL))
    );
    expect(await itemNFT.balanceOf(alice, EstforConstants.MITHRIL_ORE)).to.eq(
      startingBalance - Math.floor((timespan * rate) / (3600 * RATE_MUL))
    );
    expect(await itemNFT.balanceOf(alice, EstforConstants.COAL_ORE)).to.eq(
      startingBalance - Math.floor((timespan * rate) / (3600 * RATE_MUL)) * 256
    );
    expect(await itemNFT.balanceOf(alice, EstforConstants.SAPPHIRE)).to.eq(
      startingBalance - Math.floor((timespan * rate) / (3600 * RATE_MUL)) * 6535
    );
  });

  it("Check looting with temporary actions", async function () {
    const {players, playerId, itemNFT, worldActions, alice} = await loadFixture(playersFixture);

    const {queuedAction, rate, action} = await setupBasicWoodcutting(itemNFT, worldActions);
    await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);

    const actionInput = {...action};
    actionInput.info.isAvailable = false; // Woodcutting log no longer available
    await worldActions.editActions([actionInput]);

    await expect(
      players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE)
    ).to.be.revertedWithCustomError(players, "ActionNotAvailable");

    const {queuedAction: queuedActionFishing} = await setupBasicFishing(itemNFT, worldActions);

    // Allow to queue something else if using keeping last in progress
    await players
      .connect(alice)
      .startActions(playerId, [queuedActionFishing], EstforTypes.ActionQueueStrategy.KEEP_LAST_IN_PROGRESS);

    // But can still loot it
    await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]);
    await ethers.provider.send("evm_mine", []);
    const balanceBefore = await itemNFT.balanceOf(alice, EstforConstants.LOG);
    await players.connect(alice).processActions(playerId);
    // Should get the loot
    expect(await itemNFT.balanceOf(alice, EstforConstants.LOG)).to.eq(
      Number(balanceBefore) + Math.floor((queuedAction.timespan * rate) / (3600 * GUAR_MUL))
    );
    // Still cannot queue it
    await expect(
      players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE)
    ).to.be.revertedWithCustomError(players, "ActionNotAvailable");
  });

  it("Check looting with temporary action choices", async function () {
    const {players, playerId, itemNFT, worldActions, alice} = await loadFixture(playersFixture);

    const successPercent = 100;
    const minLevel = 1;
    const {queuedAction, rate, choiceId} = await setupBasicCooking(itemNFT, worldActions, successPercent, minLevel);

    await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);
    // Make it not available
    const actionChoiceInput = {
      ...defaultActionChoice,
      skill: EstforTypes.Skill.COOKING,
      xpPerHour: 3600,
      rate,
      inputTokenIds: [EstforConstants.RAW_MINNUS],
      inputAmounts: [1],
      outputTokenId: EstforConstants.COOKED_MINNUS,
      outputAmount: 1,
      successPercent,
      isAvailable: false
    };
    await worldActions.editActionChoices(queuedAction.actionId, [choiceId], [actionChoiceInput]);

    await expect(
      players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE)
    ).to.be.revertedWithCustomError(players, "ActionChoiceNotAvailable");

    actionChoiceInput.isAvailable = false;
    await worldActions.editActionChoices(queuedAction.actionId, [choiceId], [actionChoiceInput]);

    // Allow to queue something else if using keeping last in progress
    const {queuedAction: queuedActionFishing} = await setupBasicFishing(itemNFT, worldActions);
    await players
      .connect(alice)
      .startActions(playerId, [queuedActionFishing], EstforTypes.ActionQueueStrategy.KEEP_LAST_IN_PROGRESS);

    await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]);
    await ethers.provider.send("evm_mine", []);
    const balanceBefore = await itemNFT.balanceOf(alice, EstforConstants.COOKED_MINNUS);
    expect(balanceBefore).to.eq(0);
    await players.connect(alice).processActions(playerId);
    // Should get the loot even if the action choice is not available
    expect(await itemNFT.balanceOf(alice, EstforConstants.COOKED_MINNUS)).to.be.greaterThan(0);

    // Still cannot queue it
    await expect(
      players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE)
    ).to.be.revertedWithCustomError(players, "ActionChoiceNotAvailable");
  });

  it("An action with a quest requirement must have the quest completed to do it", async function () {
    const {players, playerId, itemNFT, worldActions, quests, alice} = await loadFixture(playersFixture);

    const {queuedAction, action} = await setupBasicWoodcutting(itemNFT, worldActions);
    const actionInput = {...action};
    actionInput.info.questPrerequisiteId = EstforConstants.QUEST_PURSE_STRINGS;
    await worldActions.editActions([actionInput]);

    await expect(
      players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE)
    ).to.be.revertedWithCustomError(players, "DependentQuestNotCompleted");
    await createAndDoPurseStringsQuest(players, quests, alice, playerId);
    await expect(
      players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE)
    ).to.not.be.reverted;
  });

  it("An action choice with a quest requirement must have the quest completed to do it", async function () {
    const {players, playerId, itemNFT, worldActions, quests, alice} = await loadFixture(playersFixture);

    const successPercent = 100;
    const minLevel = 1;
    const {queuedAction, rate, choiceId} = await setupBasicCooking(itemNFT, worldActions, successPercent, minLevel);

    await worldActions.editActionChoices(
      queuedAction.actionId,
      [choiceId],
      [
        {
          ...defaultActionChoice,
          skill: EstforTypes.Skill.COOKING,
          xpPerHour: 3600,
          rate,
          inputTokenIds: [EstforConstants.RAW_MINNUS],
          inputAmounts: [1],
          outputTokenId: EstforConstants.COOKED_MINNUS,
          outputAmount: 1,
          successPercent,
          questPrerequisiteId: EstforConstants.QUEST_PURSE_STRINGS
        }
      ]
    );

    await expect(
      players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE)
    ).to.be.revertedWithCustomError(players, "DependentQuestNotCompleted");
    await createAndDoPurseStringsQuest(players, quests, alice, playerId);
    await expect(
      players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE)
    ).to.not.be.reverted;
  });

  it.skip("Travelling", async function () {
    const {players, playerId, itemNFT, worldActions, alice} = await loadFixture(playersFixture);
    const {queuedAction} = await setupTravelling(worldActions, 0.125 * RATE_MUL, 0, 1);

    const queuedActionInvalidTimespan = {...queuedAction, timespan: 1800};
    await expect(
      players
        .connect(alice)
        .startActions(playerId, [queuedActionInvalidTimespan], EstforTypes.ActionQueueStrategy.OVERWRITE)
    ).to.be.revertedWithCustomError(players, "InvalidTravellingTimespan");

    // Travel from 0 to 1
    await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);
    await timeTravel(queuedAction.timespan);
    const pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
    expect(pendingQueuedActionState.worldLocation).to.eq(1);
    await players.connect(alice).processActions(playerId);
    expect((await (await getPlayersHelper(players)).getPlayer(playerId)).packedData).to.eq("0x01");
    // Should earn agility xp
    expect(await players.getPlayerXP(playerId, EstforTypes.Skill.FARMING)).to.eq(queuedAction.timespan); // TODO: Change this and the other one to AGILITY when it's added

    // Trying to travel from 0 to 1 should do nothing and earn no xp. Should be allowed to queue but it does nothing
    await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);
    await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]);
    await ethers.provider.send("evm_mine", []);
    expect(await players.getPlayerXP(playerId, EstforTypes.Skill.FARMING)).to.eq(queuedAction.timespan);

    // Can process an action that is intended for area 1 only
    const {queuedAction: queuedActionWoodcutting} = await setupBasicWoodcutting(itemNFT, worldActions);

    // Confirm a starting area skill cannot be used in a different area
    await players
      .connect(alice)
      .startActions(playerId, [queuedActionWoodcutting], EstforTypes.ActionQueueStrategy.OVERWRITE);
    await ethers.provider.send("evm_increaseTime", [queuedActionWoodcutting.timespan]);
    await ethers.provider.send("evm_mine", []);
    await players.connect(alice).processActions(playerId);
    expect(await players.getPlayerXP(playerId, EstforTypes.Skill.WOODCUTTING)).to.eq(0);
  });
});
