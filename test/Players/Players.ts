import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {EstforTypes, EstforConstants} from "@paintswap/estfor-definitions";
import {Attire, Skill, defaultActionChoice, defaultActionInfo} from "@paintswap/estfor-definitions/types";
import {expect} from "chai";
import {ethers, upgrades} from "hardhat";
import {AvatarInfo, createPlayer} from "../../scripts/utils";
import {
  createAndDoPurseStringsQuest,
  getActionChoiceId,
  getActionId,
  GUAR_MUL,
  NO_DONATION_AMOUNT,
  RATE_MUL,
  requestAndFulfillRandomWords,
  SPAWN_MUL,
  START_XP,
  timeTravel,
  timeTravel24Hours
} from "../utils";
import {playersFixture} from "./PlayersFixture";
import {
  getXPFromLevel,
  MAX_LEVEL,
  setupBasicCooking,
  setupBasicFiremaking,
  setupBasicFishing,
  setupBasicWoodcutting,
  setupTravelling
} from "./utils";
import {Players} from "../../typechain-types";
import {ACTION_FISHING_MINNUS} from "@paintswap/estfor-definitions/constants";
import {Block, ContractTransactionReceipt} from "ethers";
import {allFullAttireBonuses} from "../../scripts/data/fullAttireBonuses";
import {FullAttireBonusInputStruct} from "../../typechain-types/contracts/Players/Players";

const actionIsAvailable = true;

describe("Players", function () {
  it("Check initialized", async function () {
    const {
      itemNFT,
      playerNFT,
      petNFT,
      world,
      adminAccess,
      quests,
      clans,
      wishingWell,
      playersImplQueueActions,
      playersImplProcessActions,
      playersImplRewards,
      playersImplMisc,
      playersImplMisc1
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
        await world.getAddress(),
        await adminAccess.getAddress(),
        await quests.getAddress(),
        await clans.getAddress(),
        await wishingWell.getAddress(),
        await playersImplQueueActions.getAddress(),
        await playersImplProcessActions.getAddress(),
        await playersImplRewards.getAddress(),
        await playersImplMisc.getAddress(),
        await playersImplMisc1.getAddress(),
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
    expect((await players.getPlayers(newPlayerId)).totalXP).to.eq(START_XP);
  });

  it("Skill points", async function () {
    const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);
    const {queuedAction} = await setupBasicWoodcutting(itemNFT, world);
    await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.NONE);
    await ethers.provider.send("evm_increaseTime", [361]);
    await ethers.provider.send("evm_mine", []);
    await players.connect(alice).processActions(playerId);
    expect(await players.getPlayerXP(playerId, EstforTypes.Skill.WOODCUTTING)).to.eq(360);
    expect(await itemNFT.balanceOf(alice, EstforConstants.LOG)).to.eq(10); // Should be rounded down
    expect((await players.getPlayers(playerId)).totalXP).to.eq(START_XP + 360n);
  });

  it("Skill points (many)", async function () {
    const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);
    const {queuedAction} = await setupBasicWoodcutting(itemNFT, world);
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
    const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);
    const {queuedAction, rate} = await setupBasicWoodcutting(itemNFT, world);
    await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.NONE);

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
    const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);
    const {queuedAction} = await setupBasicWoodcutting(itemNFT, world);
    await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.NONE);

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
    const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);

    let tx = await world.addActions([
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
    const actionId = await getActionId(tx, world);

    tx = await world.addActionChoices(
      EstforConstants.NONE,
      [1],
      [
        {
          ...defaultActionChoice,
          skill: EstforTypes.Skill.MELEE
        }
      ]
    );
    const choiceId = await getActionChoiceId(tx, world);
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
      players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.NONE)
    ).to.be.revertedWithCustomError(players, "InvalidEquipPosition");
    queuedAction.attire.head = EstforConstants.NONE;
    queuedAction.attire.neck = EstforConstants.BRONZE_GAUNTLETS;
    await expect(
      players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.NONE)
    ).to.be.revertedWithCustomError(players, "InvalidEquipPosition");
    queuedAction.attire.neck = EstforConstants.NONE;
    queuedAction.attire.body = EstforConstants.BRONZE_GAUNTLETS;
    await expect(
      players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.NONE)
    ).to.be.revertedWithCustomError(players, "InvalidEquipPosition");
    queuedAction.attire.body = EstforConstants.NONE;
    queuedAction.attire.feet = EstforConstants.BRONZE_GAUNTLETS;
    await expect(
      players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.NONE)
    ).to.be.revertedWithCustomError(players, "InvalidEquipPosition");
    queuedAction.attire.feet = EstforConstants.NONE;
    queuedAction.attire.legs = EstforConstants.BRONZE_GAUNTLETS;
    await expect(
      players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.NONE)
    ).to.be.revertedWithCustomError(players, "InvalidEquipPosition");
    queuedAction.attire.legs = EstforConstants.NONE;
    queuedAction.attire.ring = EstforConstants.BRONZE_GAUNTLETS;
    await expect(
      players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.NONE)
    ).to.be.revertedWithCustomError(players, "InvalidEquipPosition");
    queuedAction.attire.ring = EstforConstants.NONE;
    queuedAction.attire.arms = EstforConstants.BRONZE_GAUNTLETS; // Correct
    await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.NONE);
  });

  it("validateActions", async function () {
    const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);

    let tx = await world.addActions([
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
    const actionId = await getActionId(tx, world);

    tx = await world.addActionChoices(
      EstforConstants.NONE,
      [1],
      [
        {
          ...defaultActionChoice,
          skill: EstforTypes.Skill.MELEE
        }
      ]
    );
    const choiceId = await getActionChoiceId(tx, world);
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
      players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.NONE)
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
    const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);

    let tx = await world.addActions([
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
    const actionId = await getActionId(tx, world);

    tx = await world.addActionChoices(
      EstforConstants.NONE,
      [1],
      [
        {
          ...defaultActionChoice,
          skill: EstforTypes.Skill.MELEE
        }
      ]
    );
    const choiceId = await getActionChoiceId(tx, world);
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
      players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.NONE)
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
    const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);
    const {queuedAction} = await setupBasicWoodcutting(itemNFT, world);
    await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.NONE);
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
      const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);
      const {queuedAction} = await setupBasicWoodcutting(itemNFT, world);
      await players
        .connect(alice)
        .startActions(playerId, [queuedAction, queuedAction], EstforTypes.ActionQueueStrategy.NONE);
      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan / 2]);
      await ethers.provider.send("evm_mine", []);
      let actionQueue = await players.getActionQueue(playerId);
      expect(actionQueue.length).to.eq(2);
      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.NONE);
      actionQueue = await players.getActionQueue(playerId);
      expect(actionQueue.length).to.eq(1);
      expect(actionQueue[0].queueId).to.eq(3);
      expect(actionQueue[0].timespan).to.eq(queuedAction.timespan);
    });

    it("Remove in-progress but keep pending, add another pending", async function () {
      const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);
      const {queuedAction} = await setupBasicWoodcutting(itemNFT, world);
      await players
        .connect(alice)
        .startActions(playerId, [queuedAction, queuedAction], EstforTypes.ActionQueueStrategy.NONE);
      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan / 2]);
      await ethers.provider.send("evm_mine", []);
      let actionQueue = await players.getActionQueue(playerId);
      expect(actionQueue.length).to.eq(2);
      await players
        .connect(alice)
        .startActions(playerId, [queuedAction, queuedAction], EstforTypes.ActionQueueStrategy.NONE);
      actionQueue = await players.getActionQueue(playerId);
      expect(actionQueue.length).to.eq(2);
      expect(actionQueue[0].queueId).to.eq(3);
      expect(actionQueue[0].timespan).to.eq(queuedAction.timespan);
      expect(actionQueue[1].queueId).to.eq(4);
      expect(actionQueue[1].timespan).to.eq(queuedAction.timespan);
    });

    it("Keep in-progress, remove 1 pending", async function () {
      const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);
      const {queuedAction} = await setupBasicWoodcutting(itemNFT, world);
      await players
        .connect(alice)
        .startActions(playerId, [queuedAction, queuedAction], EstforTypes.ActionQueueStrategy.NONE);
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
      const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);
      const {queuedAction} = await setupBasicWoodcutting(itemNFT, world);
      await players
        .connect(alice)
        .startActions(playerId, [queuedAction, queuedAction], EstforTypes.ActionQueueStrategy.NONE);
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
      const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);
      const {queuedAction} = await setupBasicWoodcutting(itemNFT, world);
      await players
        .connect(alice)
        .startActions(playerId, [queuedAction, queuedAction], EstforTypes.ActionQueueStrategy.NONE);
      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan / 2]);
      await ethers.provider.send("evm_mine", []);
      let actionQueue = await players.getActionQueue(playerId);
      expect(actionQueue.length).to.eq(2);
      await players.connect(alice).startActions(playerId, [], EstforTypes.ActionQueueStrategy.NONE);
      actionQueue = await players.getActionQueue(playerId);
      expect(actionQueue.length).to.eq(0);
    });

    it("Remove in-progress and pending, add 1 pending ", async function () {
      const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);
      const {queuedAction} = await setupBasicWoodcutting(itemNFT, world);
      await players
        .connect(alice)
        .startActions(playerId, [queuedAction, queuedAction], EstforTypes.ActionQueueStrategy.NONE);
      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan / 2]);
      await ethers.provider.send("evm_mine", []);
      let actionQueue = await players.getActionQueue(playerId);
      expect(actionQueue.length).to.eq(2);
      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.NONE);
      actionQueue = await players.getActionQueue(playerId);
      expect(actionQueue.length).to.eq(1);
      expect(actionQueue[0].queueId).to.eq(3);
      expect(actionQueue[0].timespan).to.eq(queuedAction.timespan);
    });

    it("Append and pending, add another pending", async function () {
      const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);
      const {queuedAction} = await setupBasicWoodcutting(itemNFT, world);
      await players
        .connect(alice)
        .startActions(playerId, [queuedAction, queuedAction], EstforTypes.ActionQueueStrategy.NONE);
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
      const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);
      const {queuedAction: basicWoodcuttingQueuedAction} = await setupBasicWoodcutting(itemNFT, world);
      let actionQueue = await players.getActionQueue(playerId);
      expect(actionQueue.length).to.eq(0);
      const queuedAction = {...basicWoodcuttingQueuedAction};
      queuedAction.timespan = 14 * 3600;
      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.NONE);
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
    const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);
    const rate = 100 * GUAR_MUL; // per hour
    const tx = await world.addActions([
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
    const actionId = await getActionId(tx, world);

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
      players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.NONE)
    ).to.be.revertedWithCustomError(players, "ActionMinimumXPNotReached");

    // Update to level 70, check it works
    await players.testModifyXP(alice, playerId, EstforTypes.Skill.WOODCUTTING, getXPFromLevel(70), false);
    expect(await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.NONE)).to
      .not.be.reverted;
  });

  describe("ActionChoices", function () {
    it("Min XP", async function () {
      const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);

      const minXP = getXPFromLevel(70);
      const {queuedAction} = await setupBasicFiremaking(itemNFT, world, minXP);

      await expect(
        players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.NONE)
      ).to.be.revertedWithCustomError(players, "ActionChoiceMinimumXPNotReached");

      // Update firemaking level, check it works
      await players.testModifyXP(alice, playerId, EstforTypes.Skill.FIREMAKING, minXP, false);
      expect(await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.NONE))
        .to.not.be.reverted;
    });

    it("Min XP multiple skills", async function () {
      const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);

      const minXP1 = getXPFromLevel(70);
      const minXP2 = getXPFromLevel(80);
      const minXP3 = getXPFromLevel(90);
      const {queuedAction: queuedActionBase, actionId, rate} = await setupBasicFiremaking(itemNFT, world);

      // Logs go in, nothing comes out
      let tx = await world.addActionChoices(
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
            minSkills: [EstforTypes.Skill.ALCHEMY, EstforTypes.Skill.FIREMAKING],
            minXPs: [minXP1, minXP2]
          }
        ]
      );
      let choiceId = await getActionChoiceId(tx, world);
      let queuedAction = {...queuedActionBase, choiceId};

      // 2 skills
      await expect(
        players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.NONE)
      ).to.be.revertedWithCustomError(players, "ActionChoiceMinimumXPNotReached");

      // Update alchemy level, should not work yet
      await players.testModifyXP(alice, playerId, EstforTypes.Skill.ALCHEMY, minXP1, false);
      await expect(
        players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.NONE)
      ).to.be.revertedWithCustomError(players, "ActionChoiceMinimumXPNotReached");

      // Update firemaking but not to correct level
      await players.testModifyXP(alice, playerId, EstforTypes.Skill.FIREMAKING, minXP1, false);
      await expect(
        players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.NONE)
      ).to.be.revertedWithCustomError(players, "ActionChoiceMinimumXPNotReached");

      await players.testModifyXP(alice, playerId, EstforTypes.Skill.FIREMAKING, minXP2, false);
      expect(await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.NONE))
        .to.not.be.reverted;

      // 3 skills
      tx = await world.addActionChoices(
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
            minSkills: [EstforTypes.Skill.FIREMAKING, EstforTypes.Skill.ALCHEMY, EstforTypes.Skill.COOKING],
            minXPs: [minXP2, minXP1, minXP3]
          }
        ]
      );
      choiceId = await getActionChoiceId(tx, world);
      queuedAction = {...queuedActionBase, choiceId};
      await expect(
        players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.NONE)
      ).to.be.revertedWithCustomError(players, "ActionChoiceMinimumXPNotReached");

      // Update cooking to correct level
      await players.testModifyXP(alice, playerId, EstforTypes.Skill.COOKING, minXP3, true);
      expect(await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.NONE))
        .to.not.be.reverted;
    });

    it("Output number > 1", async function () {
      const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);
      const {queuedAction: queuedActionFiremaking, rate, actionId} = await setupBasicFiremaking(itemNFT, world, 0);

      // Logs go in, oak logs come out suprisingly!
      const outputAmount = 2;
      const tx = await world.addActionChoices(
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
      const choiceId = await getActionChoiceId(tx, world);
      const queuedAction = {...queuedActionFiremaking};
      queuedAction.choiceId = choiceId;

      // Update firemamking level, check it works
      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.NONE);
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
    const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);
    const rate = 100 * RATE_MUL; // per hour
    let tx = await world.addActions([
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
    const actionId = await getActionId(tx, world);

    // Logs go in, nothing comes out
    tx = await world.addActionChoices(
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
    const choiceId = await getActionChoiceId(tx, world);

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
      players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.NONE)
    ).to.be.revertedWithCustomError(players, "ConsumableMinimumXPNotReached");

    await players.testModifyXP(alice, playerId, EstforTypes.Skill.HEALTH, minXP, false);

    // Update health level, check it works
    expect(await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.NONE)).to
      .not.be.reverted;

    await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.NONE);
  });

  it("Attire", async function () {
    const {playerId, players, playerNFT, itemNFT, world, alice} = await loadFixture(playersFixture);
    const {queuedAction} = await setupBasicWoodcutting(itemNFT, world);
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
        players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.NONE)
      ).to.be.revertedWithCustomError(players, "AttireMinimumXPNotReached");
      await players.testModifyXP(alice, playerId, attireEquipped[i].skill, minXP, true);
      expect(await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.NONE))
        .to.not.be.reverted;
    }

    // Test case, create a player
    const makeActive = true;
    await expect(createPlayer(playerNFT, 1, alice, "0xSamWitch123", makeActive)).to.not.be.reverted;
  });

  it("Left/Right equipment", async function () {
    const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);
    const rate = 100 * GUAR_MUL; // per hour
    const tx = await world.addActions([
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
    const actionId = await getActionId(tx, world);

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
      players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.NONE)
    ).to.be.revertedWithCustomError(players, "ItemMinimumXPNotReached");

    // Update to level 70, check it works
    await players.testModifyXP(alice, playerId, EstforTypes.Skill.WOODCUTTING, minXP, false);
    expect(await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.NONE)).to
      .not.be.reverted;
  });

  describe("Missing required equipment right hand equipment", async function () {
    async function expectRemovedCurrentAction(players: Players, playerId: bigint, now: number) {
      const player = await players.getPlayers(playerId);
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
      const {playerId, players, itemNFT, world, alice, owner} = await loadFixture(playersFixture);

      const {queuedAction} = await setupBasicWoodcutting(itemNFT, world);
      await players
        .connect(alice)
        .startActions(playerId, [queuedAction, queuedAction, queuedAction], EstforTypes.ActionQueueStrategy.NONE);
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
      const {playerId, players, itemNFT, world, alice, owner} = await loadFixture(playersFixture);

      const {queuedAction} = await setupBasicWoodcutting(itemNFT, world);
      const {queuedAction: queuedActionFiremaking} = await setupBasicFiremaking(itemNFT, world);
      const {queuedAction: queuedActionFishing} = await setupBasicFishing(itemNFT, world);
      await players
        .connect(alice)
        .startActions(
          playerId,
          [queuedActionFiremaking, queuedAction, queuedActionFishing],
          EstforTypes.ActionQueueStrategy.NONE
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
      const {playerId, players, itemNFT, world, alice, owner} = await loadFixture(playersFixture);

      const {queuedAction} = await setupBasicWoodcutting(itemNFT, world);
      const {queuedAction: queuedActionFiremaking} = await setupBasicFiremaking(itemNFT, world);
      const {queuedAction: queuedActionFishing} = await setupBasicFishing(itemNFT, world);
      await players
        .connect(alice)
        .startActions(
          playerId,
          [queuedActionFiremaking, queuedAction, queuedActionFishing],
          EstforTypes.ActionQueueStrategy.NONE
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
      const {playerId, players, itemNFT, world, alice, owner} = await loadFixture(playersFixture);

      const {queuedAction: queuedActionFiremaking} = await setupBasicFiremaking(itemNFT, world);
      const {queuedAction: queuedActionWoodcutting} = await setupBasicWoodcutting(itemNFT, world);
      const {queuedAction: queuedActionFishing} = await setupBasicFishing(itemNFT, world);
      await players
        .connect(alice)
        .startActions(
          playerId,
          [queuedActionFiremaking, queuedActionWoodcutting, queuedActionFishing],
          EstforTypes.ActionQueueStrategy.NONE
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
      const {playerId, players, itemNFT, world, alice, owner} = await loadFixture(playersFixture);

      const {queuedAction: queuedActionWoodcutting} = await setupBasicWoodcutting(itemNFT, world);
      const {queuedAction: queuedActionFiremaking} = await setupBasicFiremaking(itemNFT, world);
      const {queuedAction: queuedActionFishing} = await setupBasicFishing(itemNFT, world);
      await players
        .connect(alice)
        .startActions(
          playerId,
          [queuedActionFiremaking, queuedActionWoodcutting, queuedActionFishing],
          EstforTypes.ActionQueueStrategy.NONE
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
      const {playerId, players, itemNFT, world, alice, owner} = await loadFixture(playersFixture);

      const {queuedAction: queuedActionWoodcutting} = await setupBasicWoodcutting(itemNFT, world);
      const {queuedAction: queuedActionFiremaking} = await setupBasicFiremaking(itemNFT, world);
      const {queuedAction: queuedActionFishing} = await setupBasicFishing(itemNFT, world);
      await players
        .connect(alice)
        .startActions(
          playerId,
          [queuedActionWoodcutting, queuedActionFiremaking, queuedActionFishing],
          EstforTypes.ActionQueueStrategy.NONE
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
    const {playerId, players, itemNFT, world, alice, owner} = await loadFixture(playersFixture);
    const {queuedAction, rate} = await setupBasicWoodcutting(itemNFT, world);

    await players
      .connect(alice)
      .startActions(playerId, [queuedAction, queuedAction], EstforTypes.ActionQueueStrategy.NONE);

    await ethers.provider.send("evm_increaseTime", [(queuedAction.timespan * 10) / rate]); // Just do 1 of the action
    await ethers.provider.send("evm_mine", []);
    const {timestamp: NOW} = (await ethers.provider.getBlock("latest")) as Block;
    await players.connect(alice).processActions(playerId);
    const player = await players.getPlayers(playerId);
    expect(player.currentActionStartTimestamp).to.eq(NOW + 1);
    expect(player.currentActionProcessedSkill1).to.eq(Skill.WOODCUTTING);
    expect(player.currentActionProcessedXPGained1).to.eq((queuedAction.timespan * 10) / rate);
    expect(player.currentActionProcessedSkill2).to.eq(Skill.NONE);
    expect(player.currentActionProcessedXPGained2).to.eq(0);
    expect(player.currentActionProcessedFoodConsumed).to.eq(0);
    expect(player.currentActionProcessedBaseInputItemsConsumedNum).to.eq(0);
  });

  it("Maxing out XP", async function () {
    const {playerId, players, itemNFT, world, playersLibrary, alice} = await loadFixture(playersFixture);
    const rate = 100 * GUAR_MUL; // per hour
    const tx = await world.addActions([
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
    const actionId = await getActionId(tx, world);

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
    await players.testModifyXP(alice, playerId, EstforTypes.Skill.WOODCUTTING, minXP, false);

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
      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.NONE);
      await timeTravel24Hours();
      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.NONE);
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
    const {playerId, players, playerNFT, itemNFT, world, alice, owner} = await loadFixture(playersFixture);

    const {queuedAction} = await setupBasicWoodcutting(itemNFT, world);

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
      .startActionsExtra(
        playerId,
        [queuedAction],
        EstforConstants.XP_BOOST,
        0,
        0,
        NO_DONATION_AMOUNT,
        EstforTypes.ActionQueueStrategy.NONE
      );

    expect((await players.getActiveBoost(playerId)).boostType).to.not.eq(0);
    await playerNFT.connect(alice).safeTransferFrom(alice, owner, playerId, 1, "0x");
    // Active boost should be removed
    expect((await players.getActiveBoost(playerId)).boostType).to.eq(0);
  });

  it("Game paused", async function () {
    const {playerId, players, itemNFT, world, alice, owner} = await loadFixture(playersFixture);

    // Do not allow processing an action while game is paused
    const {queuedAction} = await setupBasicWoodcutting(itemNFT, world);
    await expect(players.connect(alice).pauseGame(true)).to.be.revertedWithCustomError(
      players,
      "OwnableUnauthorizedAccount"
    );
    await players.pauseGame(true);
    await expect(
      players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.NONE)
    ).to.be.revertedWithCustomError(players, "GameIsPaused");
    await players.pauseGame(false);
    await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.NONE);
    await players.pauseGame(true);
    await expect(players.connect(alice).processActions(playerId)).to.be.revertedWithCustomError(
      players,
      "GameIsPaused"
    );
    await players.pauseGame(false);
    await expect(players.connect(alice).processActions(playerId)).to.not.be.reverted;
  });

  it("0 timespan for an action is not allowed", async function () {
    const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);
    const {queuedAction: basicWoodcuttingQueuedAction} = await setupBasicWoodcutting(itemNFT, world);
    const queuedAction = {...basicWoodcuttingQueuedAction};
    queuedAction.timespan = 0;
    await expect(
      players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.NONE)
    ).to.be.revertedWithCustomError(players, "EmptyTimespan");
  });

  it("Should error when specifying choice id when it isn't required", async function () {
    const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);
    const {queuedAction: basicWoodcuttingQueuedAction} = await setupBasicWoodcutting(itemNFT, world);
    const queuedAction = {...basicWoodcuttingQueuedAction};
    queuedAction.choiceId = BigInt(EstforConstants.ACTIONCHOICE_COOKING_ANCHO);
    await expect(
      players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.NONE)
    ).to.be.revertedWithCustomError(players, "ActionChoiceIdNotRequired");
  });

  it("Check timespan overflow", async function () {
    // This test was added to check for a bug where the timespan was > 65535 but cast to uint16
    const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);

    const {queuedAction: basicWoodcuttingQueuedAction} = await setupBasicWoodcutting(itemNFT, world);
    const queuedAction = {...basicWoodcuttingQueuedAction};
    queuedAction.timespan = 24 * 3600;
    await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.NONE);
    await ethers.provider.send("evm_increaseTime", [5]);
    await ethers.provider.send("evm_mine", []);
    await players.connect(alice).processActions(playerId);
    const actionQueue = await players.getActionQueue(playerId);
    expect(actionQueue[0].timespan).gt(queuedAction.timespan - 10);
  });

  it("Base XP boost", async function () {
    const {players, playerNFT, itemNFT, world, alice} = await loadFixture(playersFixture);

    const avatarId = 2;
    const avatarInfo: AvatarInfo = {
      name: "Name goes here",
      description: "Hi I'm a description",
      imageURI: "1234.png",
      startSkills: [Skill.WOODCUTTING, Skill.NONE]
    };
    await playerNFT.setAvatars([avatarId], [avatarInfo]);
    const playerId = await createPlayer(playerNFT, avatarId, alice, "New name", true);

    const {queuedAction} = await setupBasicWoodcutting(itemNFT, world);
    await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.NONE);
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
    const {players, playerNFT, itemNFT, world, alice} = await loadFixture(playersFixture);

    const avatarId = 2;
    const avatarInfo: AvatarInfo = {
      name: "Name goes here",
      description: "Hi I'm a description",
      imageURI: "1234.png",
      startSkills: [Skill.THIEVING, Skill.WOODCUTTING]
    };
    await playerNFT.setAvatars([avatarId], [avatarInfo]);
    const playerId = await createPlayer(playerNFT, avatarId, alice, "New name", true);

    const {queuedAction} = await setupBasicWoodcutting(itemNFT, world);
    await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.NONE);
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
    const {players, playerNFT, itemNFT, world, brush, upgradePlayerBrushPrice, alice} = await loadFixture(
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

    const {queuedAction} = await setupBasicWoodcutting(itemNFT, world);
    await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.NONE);
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
    const {players, playerNFT, itemNFT, world, brush, upgradePlayerBrushPrice, alice} = await loadFixture(
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

    const {queuedAction} = await setupBasicWoodcutting(itemNFT, world);
    await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.NONE);
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

  it("testModifyXP should revert if there are actions queued", async function () {
    const {players, playerId, itemNFT, world, alice} = await loadFixture(playersFixture);
    const {queuedAction} = await setupBasicWoodcutting(itemNFT, world);
    await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.NONE);
    await expect(
      players.testModifyXP(alice, playerId, EstforTypes.Skill.WOODCUTTING, 100, false)
    ).to.be.revertedWithCustomError(players, "HasQueuedActions");
  });

  it("Check max level packed XP", async function () {
    const {players, playerId, alice} = await loadFixture(playersFixture);

    let packedXP = await players.getPackedXP(playerId);
    const xp = await getXPFromLevel(MAX_LEVEL); // First Max level

    await players.testModifyXP(alice, playerId, EstforTypes.Skill.MELEE, xp, false);
    packedXP = await players.getPackedXP(playerId);
    let maxDataAsNum = Number(packedXP.packedDataIsMaxed);

    await players.testModifyXP(alice, playerId, EstforTypes.Skill.MAGIC, xp, false);
    packedXP = await players.getPackedXP(playerId);

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

    await players.testModifyXP(alice, playerId, EstforTypes.Skill.CRAFTING, xp - 1, false); // 1 below max
    packedXP = await players.getPackedXP(playerId);
    expect((Number(packedXP.packedDataIsMaxed1) >> CRAFTING_OFFSET) & 0b11).to.eq(0);
    await players.testModifyXP(alice, playerId, EstforTypes.Skill.CRAFTING, xp, false); // Now max
    packedXP = await players.getPackedXP(playerId);
    expect((Number(packedXP.packedDataIsMaxed1) >> CRAFTING_OFFSET) & 0b11).to.eq(1);

    // Set a few more and check the rest
    await players.testModifyXP(alice, playerId, EstforTypes.Skill.SMITHING, xp, false);
    await players.testModifyXP(alice, playerId, EstforTypes.Skill.WOODCUTTING, xp, false);
    await players.testModifyXP(alice, playerId, EstforTypes.Skill.FORGING, xp, false);

    packedXP = await players.getPackedXP(playerId);
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
    const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);
    const {queuedAction: basicWoodcuttingQueuedAction} = await setupBasicWoodcutting(itemNFT, world);
    const queuedAction = {...basicWoodcuttingQueuedAction};
    queuedAction.timespan = 23 * 3600;
    await expect(
      players
        .connect(alice)
        .startActions(
          playerId,
          [basicWoodcuttingQueuedAction, queuedAction, basicWoodcuttingQueuedAction],
          EstforTypes.ActionQueueStrategy.NONE
        )
    ).to.be.revertedWithCustomError(players, "EmptyTimespan");

    basicWoodcuttingQueuedAction.timespan = 2 * 3600;
    await expect(
      players
        .connect(alice)
        .startActions(
          playerId,
          [basicWoodcuttingQueuedAction, queuedAction, basicWoodcuttingQueuedAction],
          EstforTypes.ActionQueueStrategy.NONE
        )
    ).to.be.revertedWithCustomError(players, "ActionTimespanExceedsMaxTime");

    // If it's at the end then it trims it
    await players
      .connect(alice)
      .startActions(
        playerId,
        [basicWoodcuttingQueuedAction, basicWoodcuttingQueuedAction, queuedAction],
        EstforTypes.ActionQueueStrategy.NONE
      );

    const actionQueue = await players.getActionQueue(playerId);
    expect(actionQueue[2].timespan).to.eq(20 * 3600);
  });

  it("Queued actions exceed max time with remainder", async function () {
    const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);
    const {queuedAction: basicWoodcuttingQueuedAction} = await setupBasicWoodcutting(itemNFT, world);
    const queuedAction = {...basicWoodcuttingQueuedAction, timespan: 1600};
    const fullTimeAction = {...basicWoodcuttingQueuedAction, timespan: 24 * 3600};
    // If it's at the end then it trims it
    await players
      .connect(alice)
      .startActions(playerId, [queuedAction, fullTimeAction], EstforTypes.ActionQueueStrategy.NONE);

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
    const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);
    const {queuedAction: basicWoodcuttingQueuedAction} = await setupBasicWoodcutting(itemNFT, world);
    const queuedAction = {...basicWoodcuttingQueuedAction, timespan: 25 * 3600};
    await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.NONE);
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
    const {players, playerId, playerNFT, itemNFT, world, brush, upgradePlayerBrushPrice, origName, alice} =
      await loadFixture(playersFixture);

    const {queuedAction} = await setupBasicWoodcutting(itemNFT, world);
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
      players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.NONE)
    ).to.be.revertedWithCustomError(players, "PlayerNotUpgraded");

    await brush.connect(alice).approve(playerNFT, upgradePlayerBrushPrice);
    await brush.mint(alice, upgradePlayerBrushPrice);

    await playerNFT.connect(alice).editPlayer(playerId, origName, "", "", "", true);
    await expect(players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.NONE)).to
      .not.be.reverted;
  });

  it("Check that only upgraded players can equip full mode only items (attire)", async function () {
    const {players, playerId, playerNFT, itemNFT, world, brush, upgradePlayerBrushPrice, origName, alice} =
      await loadFixture(playersFixture);

    const {queuedAction: queuedActionWoodcutting} = await setupBasicWoodcutting(itemNFT, world);
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
      players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.NONE)
    ).to.be.revertedWithCustomError(players, "PlayerNotUpgraded");

    await brush.connect(alice).approve(playerNFT, upgradePlayerBrushPrice);
    await brush.mint(alice, upgradePlayerBrushPrice);

    await playerNFT.connect(alice).editPlayer(playerId, origName, "", "", "", true);
    await expect(players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.NONE)).to
      .not.be.reverted;
  });

  it("Check that only upgraded players can equip full mode only items (left/right hand equipment)", async function () {
    const {players, playerId, playerNFT, itemNFT, world, brush, upgradePlayerBrushPrice, origName, alice} =
      await loadFixture(playersFixture);

    const {queuedAction} = await setupBasicWoodcutting(itemNFT, world);
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
      players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.NONE)
    ).to.be.revertedWithCustomError(players, "PlayerNotUpgraded");

    await brush.connect(alice).approve(playerNFT, upgradePlayerBrushPrice);
    await brush.mint(alice, upgradePlayerBrushPrice);

    await playerNFT.connect(alice).editPlayer(playerId, origName, "", "", "", true);
    await expect(players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.NONE)).to
      .not.be.reverted;
  });

  it("Check that only upgraded players can start a full mode only actionChoice, where action is not set to full mode only", async function () {
    const {playerId, players, itemNFT, world, alice, playerNFT, brush, upgradePlayerBrushPrice, origName} =
      await loadFixture(playersFixture);

    const successPercent = 100;
    const minLevel = 1;
    const {queuedAction, rate} = await setupBasicCooking(itemNFT, world, successPercent, minLevel);

    await world.editActionChoices(
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
          minSkills: minLevel > 1 ? [EstforTypes.Skill.COOKING] : [],
          minXPs: minLevel > 1 ? [getXPFromLevel(minLevel)] : [],
          isFullModeOnly: true
        }
      ]
    );

    await expect(
      players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.NONE)
    ).to.be.revertedWithCustomError(players, "PlayerNotUpgraded");
    // Upgrade and try again
    await brush.connect(alice).approve(playerNFT, upgradePlayerBrushPrice);
    await brush.mint(alice, upgradePlayerBrushPrice);
    await playerNFT.connect(alice).editPlayer(playerId, origName, "", "", "", true);
    await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.NONE);
  });

  it("Check that only upgraded players can start a full mode only actionChoice, where action is also set to full mode only", async function () {
    const {playerId, players, itemNFT, world, alice, playerNFT, brush, upgradePlayerBrushPrice, origName} =
      await loadFixture(playersFixture);

    const successPercent = 100;
    const minLevel = 1;
    const {queuedAction, rate} = await setupBasicCooking(itemNFT, world, successPercent, minLevel);

    await world.editActions([
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

    await world.editActionChoices(
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
          minSkills: minLevel > 1 ? [EstforTypes.Skill.COOKING] : [],
          minXPs: minLevel > 1 ? [getXPFromLevel(minLevel)] : [],
          isFullModeOnly: true
        }
      ]
    );

    await expect(
      players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.NONE)
    ).to.be.revertedWithCustomError(players, "PlayerNotUpgraded");
    // Upgrade and try again
    await brush.connect(alice).approve(playerNFT, upgradePlayerBrushPrice);
    await brush.mint(alice, upgradePlayerBrushPrice);
    await playerNFT.connect(alice).editPlayer(playerId, origName, "", "", "", true);
    await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.NONE);
  });

  it("Check that only upgraded players can start a non-full mode only actionChoice, where action is set to full mode only", async function () {
    const {playerId, players, itemNFT, world, alice, playerNFT, brush, upgradePlayerBrushPrice, origName} =
      await loadFixture(playersFixture);

    const successPercent = 100;
    const minLevel = 1;
    const {queuedAction} = await setupBasicCooking(itemNFT, world, successPercent, minLevel);

    await world.editActions([
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
      players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.NONE)
    ).to.be.revertedWithCustomError(players, "PlayerNotUpgraded");
    // Upgrade and try again
    await brush.connect(alice).approve(playerNFT, upgradePlayerBrushPrice);
    await brush.mint(alice, upgradePlayerBrushPrice);
    await playerNFT.connect(alice).editPlayer(playerId, origName, "", "", "", true);
    await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.NONE);
  });

  it("Check that only upgraded players can start a full mode only action", async function () {
    const {playerId, world, players, brush, alice, playerNFT, origName, upgradePlayerBrushPrice} = await loadFixture(
      playersFixture
    );
    const rate = 100 * GUAR_MUL; // per hour
    const tx = await world.addActions([
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
    const actionId = await getActionId(tx, world);

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
      players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.NONE)
    ).to.be.revertedWithCustomError(players, "PlayerNotUpgraded");
    // Upgrade and try again
    await brush.connect(alice).approve(playerNFT, upgradePlayerBrushPrice);
    await brush.mint(alice, upgradePlayerBrushPrice);
    await playerNFT.connect(alice).editPlayer(playerId, origName, "", "", "", true);
    await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.NONE);
  });

  it("Action choice with > 255 input amounts", async function () {
    const {players, playerId, playerNFT, itemNFT, world, brush, upgradePlayerBrushPrice, origName, alice} =
      await loadFixture(playersFixture);
    const rate = 100 * RATE_MUL; // per hour

    let tx = await world.addActions([
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
    const actionId = await getActionId(tx, world);

    // Ores go in, bars come out
    tx = await world.addActionChoices(
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

    const choiceId = await getActionChoiceId(tx, world);
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

    await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.NONE);
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
    const {players, playerId, itemNFT, world, alice} = await loadFixture(playersFixture);

    const {queuedAction, rate, action} = await setupBasicWoodcutting(itemNFT, world);
    await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.NONE);

    const actionInput = {...action};
    actionInput.info.isAvailable = false; // Woodcutting log no longer available
    await world.editActions([actionInput]);

    await expect(
      players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.NONE)
    ).to.be.revertedWithCustomError(players, "ActionNotAvailable");

    const {queuedAction: queuedActionFishing} = await setupBasicFishing(itemNFT, world);

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
      players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.NONE)
    ).to.be.revertedWithCustomError(players, "ActionNotAvailable");
  });

  it("Check looting with temporary action choices", async function () {
    const {players, playerId, itemNFT, world, alice} = await loadFixture(playersFixture);

    const successPercent = 100;
    const minLevel = 1;
    const {queuedAction, rate, choiceId} = await setupBasicCooking(itemNFT, world, successPercent, minLevel);

    await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.NONE);
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
    await world.editActionChoices(queuedAction.actionId, [choiceId], [actionChoiceInput]);

    await expect(
      players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.NONE)
    ).to.be.revertedWithCustomError(players, "ActionChoiceNotAvailable");

    actionChoiceInput.isAvailable = false;
    await world.editActionChoices(queuedAction.actionId, [choiceId], [actionChoiceInput]);

    // Allow to queue something else if using keeping last in progress
    const {queuedAction: queuedActionFishing} = await setupBasicFishing(itemNFT, world);
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
      players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.NONE)
    ).to.be.revertedWithCustomError(players, "ActionChoiceNotAvailable");
  });

  it("An action with a quest requirement must have the quest completed to do it", async function () {
    const {players, playerId, itemNFT, world, quests, alice} = await loadFixture(playersFixture);

    const {queuedAction, action} = await setupBasicWoodcutting(itemNFT, world);
    const actionInput = {...action};
    actionInput.info.questPrerequisiteId = EstforConstants.QUEST_PURSE_STRINGS;
    await world.editActions([actionInput]);

    await expect(
      players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.NONE)
    ).to.be.revertedWithCustomError(players, "DependentQuestNotCompleted");
    await createAndDoPurseStringsQuest(players, quests, alice, playerId);
    await expect(players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.NONE)).to
      .not.be.reverted;
  });

  it("An action choice with a quest requirement must have the quest completed to do it", async function () {
    const {players, playerId, itemNFT, world, quests, alice} = await loadFixture(playersFixture);

    const successPercent = 100;
    const minLevel = 1;
    const {queuedAction, rate, choiceId} = await setupBasicCooking(itemNFT, world, successPercent, minLevel);

    await world.editActionChoices(
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
      players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.NONE)
    ).to.be.revertedWithCustomError(players, "DependentQuestNotCompleted");
    await createAndDoPurseStringsQuest(players, quests, alice, playerId);
    await expect(players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.NONE)).to
      .not.be.reverted;
  });

  it.skip("Travelling", async function () {
    const {players, playerId, itemNFT, world, alice} = await loadFixture(playersFixture);
    const {queuedAction} = await setupTravelling(world, 0.125 * RATE_MUL, 0, 1);

    const queuedActionInvalidTimespan = {...queuedAction, timespan: 1800};
    await expect(
      players.connect(alice).startActions(playerId, [queuedActionInvalidTimespan], EstforTypes.ActionQueueStrategy.NONE)
    ).to.be.revertedWithCustomError(players, "InvalidTravellingTimespan");

    // Travel from 0 to 1
    await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.NONE);
    await timeTravel(queuedAction.timespan);
    const pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
    expect(pendingQueuedActionState.worldLocation).to.eq(1);
    await players.connect(alice).processActions(playerId);
    expect((await players.getPlayers(playerId)).packedData).to.eq("0x01");
    // Should earn agility xp
    expect(await players.getPlayerXP(playerId, EstforTypes.Skill.FARMING)).to.eq(queuedAction.timespan); // TODO: Change this and the other one to AGILITY when it's added

    // Trying to travel from 0 to 1 should do nothing and earn no xp. Should be allowed to queue but it does nothing
    await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.NONE);
    await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]);
    await ethers.provider.send("evm_mine", []);
    expect(await players.getPlayerXP(playerId, EstforTypes.Skill.FARMING)).to.eq(queuedAction.timespan);

    // Can process an action that is intended for area 1 only
    const {queuedAction: queuedActionWoodcutting} = await setupBasicWoodcutting(itemNFT, world);

    // Confirm a starting area skill cannot be used in a different area
    await players
      .connect(alice)
      .startActions(playerId, [queuedActionWoodcutting], EstforTypes.ActionQueueStrategy.NONE);
    await ethers.provider.send("evm_increaseTime", [queuedActionWoodcutting.timespan]);
    await ethers.provider.send("evm_mine", []);
    await players.connect(alice).processActions(playerId);
    expect(await players.getPlayerXP(playerId, EstforTypes.Skill.WOODCUTTING)).to.eq(0);
  });

  describe("Checkpoints", function () {
    it("Checkpoints should be cleared when making a character inactive", async function () {
      const {players, playerId, itemNFT, playerNFT, avatarId, world, alice} = await loadFixture(playersFixture);
      const {queuedAction} = await setupBasicWoodcutting(itemNFT, world);
      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.NONE);

      // Check checkpoints
      let activePlayerInfo = await players.getActivePlayerInfo(alice.address);
      expect(activePlayerInfo.checkpoint).to.be.gt(0);
      // Make a new player active, checkpoint should be cleared
      await createPlayer(playerNFT, avatarId, alice, "New name", true);
      activePlayerInfo = await players.getActivePlayerInfo(alice.address);
      expect(activePlayerInfo.checkpoint).to.eq(0);
    });

    describe("Right hand equipment", function () {
      it("Transfer away required equipment after action starts but before ends should invalidate it entirely", async function () {
        const {playerId, players, itemNFT, world, alice, owner} = await loadFixture(playersFixture);

        const {queuedAction} = await setupBasicWoodcutting(itemNFT, world);
        await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.NONE);

        await itemNFT
          .connect(alice)
          .safeTransferFrom(alice.address, owner.address, EstforConstants.BRONZE_AXE, 1, "0x");
        expect(await itemNFT.balanceOf(alice.address, EstforConstants.BRONZE_AXE)).to.eq(0);
        await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]);
        await itemNFT.mint(alice.address, EstforConstants.BRONZE_AXE, 1); // Minting this should have no effect
        await players.connect(alice).processActions(playerId);
        expect(await players.getPlayerXP(playerId, EstforTypes.Skill.WOODCUTTING)).to.eq(0);
      });

      it("Transfer away required equipment after processing an action, should invalidate the rest even if transferring back", async function () {
        const {playerId, players, itemNFT, world, alice, owner} = await loadFixture(playersFixture);

        const {queuedAction} = await setupBasicWoodcutting(itemNFT, world);
        await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.NONE);

        await ethers.provider.send("evm_increaseTime", [queuedAction.timespan / 2]);
        await players.connect(alice).processActions(playerId);
        expect(await players.getPlayerXP(playerId, EstforTypes.Skill.WOODCUTTING)).to.eq(queuedAction.timespan / 2);
        await itemNFT
          .connect(alice)
          .safeTransferFrom(alice.address, owner.address, EstforConstants.BRONZE_AXE, 1, "0x");
        await itemNFT.mint(alice.address, EstforConstants.BRONZE_AXE, 1); // Minting this should have no effect for the rest of the action
        await ethers.provider.send("evm_increaseTime", [queuedAction.timespan / 2]);
        await players.connect(alice).processActions(playerId);
        expect(await players.getPlayerXP(playerId, EstforTypes.Skill.WOODCUTTING)).to.eq(queuedAction.timespan / 2);
      });

      it("Transfer away required equipment before an action starts and back after an action starts should invalidate it all", async function () {
        const {playerId, players, itemNFT, world, alice, owner} = await loadFixture(playersFixture);

        const {queuedAction} = await setupBasicWoodcutting(itemNFT, world);
        await players
          .connect(alice)
          .startActions(playerId, [queuedAction, queuedAction], EstforTypes.ActionQueueStrategy.NONE);

        await ethers.provider.send("evm_increaseTime", [queuedAction.timespan - 2]); // Right before next action starts
        await players.connect(alice).processActions(playerId);
        expect(await players.getPlayerXP(playerId, EstforTypes.Skill.WOODCUTTING)).to.eq(
          queuedAction.timespan - queuedAction.timespan / 100
        );
        await itemNFT
          .connect(alice)
          .safeTransferFrom(alice.address, owner.address, EstforConstants.BRONZE_AXE, 1, "0x");
        await ethers.provider.send("evm_increaseTime", [queuedAction.timespan / 2]);
        await itemNFT.mint(alice.address, EstforConstants.BRONZE_AXE, 1); // Minting this should have no effect for the whole action
        await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]);
        await players.connect(alice).processActions(playerId);
        expect(await players.getPlayerXP(playerId, EstforTypes.Skill.WOODCUTTING)).to.eq(
          queuedAction.timespan - queuedAction.timespan / 100
        );
      });

      it("Transfer away required equipment before an action starts and back before an action starts should be fine", async function () {
        const {playerId, players, itemNFT, world, alice, owner} = await loadFixture(playersFixture);

        const {queuedAction} = await setupBasicWoodcutting(itemNFT, world);
        await players
          .connect(alice)
          .startActions(playerId, [queuedAction, queuedAction], EstforTypes.ActionQueueStrategy.NONE);

        await ethers.provider.send("evm_increaseTime", [queuedAction.timespan - 2]); // Right before next action starts
        await players.connect(alice).processActions(playerId);
        expect(await players.getPlayerXP(playerId, EstforTypes.Skill.WOODCUTTING)).to.eq(
          queuedAction.timespan - queuedAction.timespan / 100
        );
        await itemNFT
          .connect(alice)
          .safeTransferFrom(alice.address, owner.address, EstforConstants.BRONZE_AXE, 1, "0x");
        await itemNFT.mint(alice.address, EstforConstants.BRONZE_AXE, 1); // Minting this should have no effect for the whole action
        await ethers.provider.send("evm_increaseTime", [queuedAction.timespan + 2 + queuedAction.timespan]);
        await players.connect(alice).processActions(playerId);
        expect(await players.getPlayerXP(playerId, EstforTypes.Skill.WOODCUTTING)).to.eq(
          queuedAction.timespan - queuedAction.timespan / 100 + queuedAction.timespan
        );
      });

      it("Test multiple burning/transferring on a checkpoint", async function () {
        const {playerId, players, itemNFT, world, alice, owner} = await loadFixture(playersFixture);

        const {queuedAction: queuedActionFiremaking} = await setupBasicFiremaking(itemNFT, world);
        const {queuedAction} = await setupBasicWoodcutting(itemNFT, world);

        await itemNFT.mint(alice.address, EstforConstants.BRONZE_AXE, 100); // Start with a ton more

        await players
          .connect(alice)
          .startActions(playerId, [queuedActionFiremaking, queuedAction], EstforTypes.ActionQueueStrategy.NONE);

        await itemNFT.connect(alice).burn(alice.address, EstforConstants.BRONZE_AXE, 80);
        await itemNFT.connect(alice).burn(alice.address, EstforConstants.BRONZE_AXE, 5);
        await ethers.provider.send("evm_increaseTime", [queuedActionFiremaking.timespan / 2]);
        await players.connect(alice).processActions(playerId);

        await itemNFT
          .connect(alice)
          .safeTransferFrom(alice.address, owner.address, EstforConstants.BRONZE_AXE, 5, "0x");
        await ethers.provider.send("evm_increaseTime", [queuedActionFiremaking.timespan / 4]);
        await itemNFT.connect(alice).burn(alice.address, EstforConstants.BRONZE_AXE, 5);
        await itemNFT.connect(alice).burn(alice.address, EstforConstants.BRONZE_AXE, 5);
        expect(await itemNFT.balanceOf(alice.address, EstforConstants.BRONZE_AXE)).to.eq(1); // Have 1 left
        await ethers.provider.send("evm_increaseTime", [queuedActionFiremaking.timespan / 4 + queuedAction.timespan]); // Finish both actions
        await players.connect(alice).processActions(playerId);
        expect(await players.getPlayerXP(playerId, EstforTypes.Skill.WOODCUTTING)).to.eq(queuedAction.timespan);
      });

      it("Have more than 65535 and reduce it, before action starts", async function () {
        const {playerId, players, itemNFT, world, alice, owner} = await loadFixture(playersFixture);

        const {queuedAction: queuedActionFiremaking} = await setupBasicFiremaking(itemNFT, world);
        const {queuedAction} = await setupBasicWoodcutting(itemNFT, world);

        await itemNFT.mint(alice.address, EstforConstants.BRONZE_AXE, 70000); // Start with a ton more
        await players
          .connect(alice)
          .startActions(playerId, [queuedActionFiremaking, queuedAction], EstforTypes.ActionQueueStrategy.NONE);

        await ethers.provider.send("evm_increaseTime", [queuedActionFiremaking.timespan - 3]);

        await itemNFT
          .connect(alice)
          .safeTransferFrom(alice.address, owner.address, EstforConstants.BRONZE_AXE, 70000, "0x");
        await ethers.provider.send("evm_increaseTime", [3]);
        expect(await itemNFT.balanceOf(alice.address, EstforConstants.BRONZE_AXE)).to.eq(1); // Have 1 left
        await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]); // Finish both actions
        await players.connect(alice).processActions(playerId);
        expect(await players.getPlayerXP(playerId, EstforTypes.Skill.WOODCUTTING)).to.eq(queuedAction.timespan);
      });

      it("Have more than 65535 and reduce it while action is ongoing", async function () {
        const {playerId, players, itemNFT, world, alice, owner} = await loadFixture(playersFixture);

        const {queuedAction} = await setupBasicWoodcutting(itemNFT, world);

        await itemNFT.mint(alice.address, EstforConstants.BRONZE_AXE, 70000); // Start with a ton more
        await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.NONE);

        await ethers.provider.send("evm_increaseTime", [queuedAction.timespan / 2]);
        await itemNFT
          .connect(alice)
          .safeTransferFrom(alice.address, owner.address, EstforConstants.BRONZE_AXE, 40000, "0x");
        await itemNFT
          .connect(alice)
          .safeTransferFrom(alice.address, owner.address, EstforConstants.BRONZE_AXE, 29000, "0x");
        await itemNFT.connect(alice).burn(alice.address, EstforConstants.BRONZE_AXE, 999);
        expect(await itemNFT.balanceOf(alice.address, EstforConstants.BRONZE_AXE)).to.eq(2); // Have 2 left
        await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]); // Finish action
        await players.connect(alice).processActions(playerId);
        expect(await players.getPlayerXP(playerId, EstforTypes.Skill.WOODCUTTING)).to.eq(queuedAction.timespan);
      });
    });

    describe("Attire", function () {
      //
      it("Full attire bonus, checks removing attire", async function () {
        const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);

        const {queuedAction: queuedActionWoodcutting, rate} = await setupBasicWoodcutting(itemNFT, world);
        await itemNFT.addItems([
          {
            ...EstforTypes.defaultItemInput,
            tokenId: EstforConstants.NATURE_MASK,
            equipPosition: EstforTypes.EquipPosition.HEAD
          },
          {
            ...EstforTypes.defaultItemInput,
            tokenId: EstforConstants.NATURE_BODY,
            equipPosition: EstforTypes.EquipPosition.BODY
          },
          {
            ...EstforTypes.defaultItemInput,
            tokenId: EstforConstants.NATURE_BRACERS,
            equipPosition: EstforTypes.EquipPosition.ARMS
          },
          {
            ...EstforTypes.defaultItemInput,
            tokenId: EstforConstants.NATURE_TROUSERS,
            equipPosition: EstforTypes.EquipPosition.LEGS
          },
          {
            ...EstforTypes.defaultItemInput,
            tokenId: EstforConstants.NATURE_BOOTS,
            equipPosition: EstforTypes.EquipPosition.FEET
          }
        ]);

        await players.addFullAttireBonuses([
          allFullAttireBonuses.find(
            (attireBonus) => attireBonus.skill == Skill.WOODCUTTING
          ) as FullAttireBonusInputStruct
        ]);

        const queuedAction = {
          ...queuedActionWoodcutting,
          attire: {
            head: EstforConstants.NATURE_MASK,
            neck: EstforConstants.NONE,
            body: EstforConstants.NATURE_BODY,
            arms: EstforConstants.NATURE_BRACERS,
            legs: EstforConstants.NATURE_TROUSERS,
            feet: EstforConstants.NATURE_BOOTS,
            ring: EstforConstants.NONE, // Always NONE for now
            reserved1: EstforConstants.NONE // Always NONE for now
          }
        };

        await itemNFT.mintBatch(
          alice.address,
          [
            EstforConstants.NATURE_MASK,
            EstforConstants.NATURE_BODY,
            EstforConstants.NATURE_BRACERS,
            EstforConstants.NATURE_TROUSERS,
            EstforConstants.NATURE_BOOTS
          ],
          [1, 1, 1, 1, 1]
        );

        await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.NONE);

        await itemNFT.connect(alice).burn(alice.address, EstforConstants.NATURE_MASK, 1); // Remove a bit of the attire
        await itemNFT.mint(alice.address, EstforConstants.NATURE_MASK, 1); // Minting again does nothing
        await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]);
        const balanceExpected = Math.floor((queuedAction.timespan * rate) / (3600 * GUAR_MUL));
        await players.connect(alice).processActions(playerId);
        expect(await players.getPlayerXP(playerId, EstforTypes.Skill.WOODCUTTING)).to.eq(queuedAction.timespan);
        // Check the drops are as expected
        expect(await itemNFT.balanceOf(alice.address, EstforConstants.LOG)).to.eq(balanceExpected);
      });

      it("Pending reward full attire bonus", async function () {
        // Thieving
        const {playerId, players, itemNFT, world, alice, mockVRF} = await loadFixture(playersFixture);

        const randomChanceFraction = 1 / 100; // 1% chance
        const randomChance = Math.floor(65536 * randomChanceFraction);

        const xpPerHour = 50;
        let tx = await world.addActions([
          {
            actionId: 1,
            info: {
              skill: EstforTypes.Skill.THIEVING,
              xpPerHour,
              minXP: 0,
              worldLocation: 0,
              isFullModeOnly: false,
              numSpawned: 0,
              handItemTokenIdRangeMin: EstforConstants.NONE,
              handItemTokenIdRangeMax: EstforConstants.NONE,
              isAvailable: actionIsAvailable,
              questPrerequisiteId: 0,
              actionChoiceRequired: false,
              successPercent: 0
            },
            guaranteedRewards: [],
            randomRewards: [{itemTokenId: EstforConstants.BRONZE_ARROW, chance: randomChance, amount: 1}],
            combatStats: EstforTypes.emptyCombatStats
          }
        ]);

        const actionId = await getActionId(tx, world);

        const numHours = 2;

        // Make sure it passes the next checkpoint so there are no issues running
        const {timestamp} = (await ethers.provider.getBlock("latest")) as Block;
        const nextCheckpoint = Math.floor(timestamp / 86400) * 86400 + 86400;
        const durationToNextCheckpoint = nextCheckpoint - timestamp + 1;
        await ethers.provider.send("evm_increaseTime", [durationToNextCheckpoint]);
        await requestAndFulfillRandomWords(world, mockVRF);
        await ethers.provider.send("evm_increaseTime", [24 * 3600]);
        await requestAndFulfillRandomWords(world, mockVRF);

        const timespan = 3600 * numHours;
        const queuedAction: EstforTypes.QueuedActionInput = {
          attire: {
            head: EstforConstants.NATUOW_HOOD,
            neck: EstforConstants.NONE,
            body: EstforConstants.NATUOW_BODY,
            arms: EstforConstants.NATUOW_BRACERS,
            legs: EstforConstants.NATUOW_TASSETS,
            feet: EstforConstants.NATUOW_BOOTS,
            ring: EstforConstants.NONE, // Always NONE for now
            reserved1: EstforConstants.NONE // Always NONE for now
          },
          actionId,
          combatStyle: EstforTypes.CombatStyle.NONE,
          choiceId: EstforConstants.NONE,
          regenerateId: EstforConstants.NONE,
          timespan,
          rightHandEquipmentTokenId: EstforConstants.NONE,
          leftHandEquipmentTokenId: EstforConstants.NONE,
          petId: 0
        };

        await itemNFT.mintBatch(
          alice.address,
          [
            EstforConstants.NATUOW_HOOD,
            EstforConstants.NATUOW_BODY,
            EstforConstants.NATUOW_BRACERS,
            EstforConstants.NATUOW_TASSETS,
            EstforConstants.NATUOW_BOOTS
          ],
          [1, 1, 1, 1, 1]
        );
        await itemNFT.addItems([
          {
            ...EstforTypes.defaultItemInput,
            tokenId: EstforConstants.NATUOW_HOOD,
            equipPosition: EstforTypes.EquipPosition.HEAD
          },
          {
            ...EstforTypes.defaultItemInput,
            tokenId: EstforConstants.NATUOW_BODY,
            equipPosition: EstforTypes.EquipPosition.BODY
          },
          {
            ...EstforTypes.defaultItemInput,
            tokenId: EstforConstants.NATUOW_BRACERS,
            equipPosition: EstforTypes.EquipPosition.ARMS
          },
          {
            ...EstforTypes.defaultItemInput,
            tokenId: EstforConstants.NATUOW_TASSETS,
            equipPosition: EstforTypes.EquipPosition.LEGS
          },
          {
            ...EstforTypes.defaultItemInput,
            tokenId: EstforConstants.NATUOW_BOOTS,
            equipPosition: EstforTypes.EquipPosition.FEET
          }
        ]);

        await players.addFullAttireBonuses([
          {
            skill: Skill.THIEVING,
            itemTokenIds: [
              EstforConstants.NATUOW_HOOD,
              EstforConstants.NATUOW_BODY,
              EstforConstants.NATUOW_BRACERS,
              EstforConstants.NATUOW_TASSETS,
              EstforConstants.NATUOW_BOOTS
            ],
            bonusXPPercent: 3,
            bonusRewardsPercent: 100
          }
        ]);

        const numRepeats = 10; // Should get it at least once
        for (let i = 0; i < numRepeats; ++i) {
          await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.NONE);
          await itemNFT.connect(alice).burn(alice.address, EstforConstants.NATUOW_HOOD, 1); // Remove a bit of the attire
          await itemNFT.mint(alice.address, EstforConstants.NATUOW_HOOD, 1); // Minting again does nothing
          await ethers.provider.send("evm_increaseTime", [24 * 3600]);
          await requestAndFulfillRandomWords(world, mockVRF);
          await players.connect(alice).processActions(playerId);
        }

        await ethers.provider.send("evm_increaseTime", [24 * 3600]);
        await requestAndFulfillRandomWords(world, mockVRF);
        await players.connect(alice).processActions(playerId);

        expect(await players.getPlayerXP(playerId, EstforTypes.Skill.THIEVING)).to.eq(
          Math.floor(xpPerHour * numRepeats * numHours)
        ); // No bonus

        const balance = await itemNFT.balanceOf(alice.address, EstforConstants.BRONZE_ARROW);
        // Have 2 queued actions so twice as much
        expect(balance).to.eq(0); // Only a 1% chance of getting it as the bonus does not apply
      });
    });

    it("Output from 1 action should be allowed as the input to another", async function () {
      const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);

      const {queuedAction} = await setupBasicWoodcutting(itemNFT, world);
      const {queuedAction: queuedActionFiremaking} = await setupBasicFiremaking(itemNFT, world);

      await players
        .connect(alice)
        .startActions(playerId, [queuedAction, queuedActionFiremaking], EstforTypes.ActionQueueStrategy.NONE);

      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan + queuedActionFiremaking.timespan / 2]);
      await players.connect(alice).processActions(playerId);

      // TODO Read checkpoint balance
      await ethers.provider.send("evm_increaseTime", [queuedActionFiremaking.timespan / 2]);
      await players.connect(alice).processActions(playerId);
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.WOODCUTTING)).to.eq(queuedAction.timespan);
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.FIREMAKING)).to.eq(queuedActionFiremaking.timespan);
    });

    it("TODO: More checkpoint balance checks", async function () {});

    it("Output from 1 action should be allowed as the input to another, with no process in-between", async function () {
      const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);

      const {queuedAction} = await setupBasicWoodcutting(itemNFT, world);
      const {queuedAction: queuedActionFiremaking} = await setupBasicFiremaking(itemNFT, world);

      await players
        .connect(alice)
        .startActions(playerId, [queuedAction, queuedActionFiremaking], EstforTypes.ActionQueueStrategy.NONE);

      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan + queuedActionFiremaking.timespan]);
      await players.connect(alice).processActions(playerId);
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.WOODCUTTING)).to.eq(queuedAction.timespan);
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.FIREMAKING)).to.eq(queuedActionFiremaking.timespan);
    });

    it("Multiple checkpoints", async function () {
      const {playerId, players, itemNFT, world, alice, owner} = await loadFixture(playersFixture);

      const {queuedAction} = await setupBasicWoodcutting(itemNFT, world);
      const queuedAction1 = {...queuedAction, timespan: queuedAction.timespan / 2};
      const queuedAction2 = {...queuedAction, timespan: queuedAction.timespan / 4};
      // 3 checkpoints
      await players
        .connect(alice)
        .startActions(playerId, [queuedAction, queuedAction1, queuedAction2], EstforTypes.ActionQueueStrategy.NONE);

      // Get current time
      const {timestamp: NOW} = (await ethers.provider.getBlock("latest")) as Block;
      let activePlayerInfo = await players.getActivePlayerInfo(alice.address);
      expect(activePlayerInfo.checkpoint).to.be.eq(NOW);
      expect(activePlayerInfo.timespan).to.eq(queuedAction.timespan);
      expect(activePlayerInfo.timespan1).to.eq(queuedAction1.timespan);
      expect(activePlayerInfo.timespan2).to.eq(queuedAction2.timespan);
      await players.connect(alice).processActions(playerId);
      activePlayerInfo = await players.getActivePlayerInfo(alice.address);
      expect(activePlayerInfo.checkpoint).to.be.eq(NOW);
      expect(activePlayerInfo.timespan).to.eq(queuedAction.timespan);
      expect(activePlayerInfo.timespan1).to.eq(queuedAction1.timespan);
      expect(activePlayerInfo.timespan2).to.eq(queuedAction2.timespan);
      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan / 2]);
      await players.connect(alice).processActions(playerId);
      activePlayerInfo = await players.getActivePlayerInfo(alice.address);
      expect(activePlayerInfo.checkpoint).to.be.eq(NOW);
      expect(activePlayerInfo.timespan).to.eq(queuedAction.timespan);
      expect(activePlayerInfo.timespan1).to.eq(queuedAction1.timespan);
      expect(activePlayerInfo.timespan2).to.eq(queuedAction2.timespan);
      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan / 2 + 2]);
      await players.connect(alice).processActions(playerId);
      activePlayerInfo = await players.getActivePlayerInfo(alice.address);
      expect(activePlayerInfo.checkpoint).to.be.eq(NOW + queuedAction.timespan);
      expect(activePlayerInfo.timespan).to.eq(queuedAction1.timespan);
      expect(activePlayerInfo.timespan1).to.eq(queuedAction2.timespan);
      expect(activePlayerInfo.timespan2).to.eq(queuedAction2.timespan); // Is left unchanged

      // Add one to the end
      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.APPEND);
      activePlayerInfo = await players.getActivePlayerInfo(alice.address);
      expect(activePlayerInfo.checkpoint).to.be.eq(NOW + queuedAction.timespan);
      expect(activePlayerInfo.timespan).to.eq(queuedAction1.timespan);
      expect(activePlayerInfo.timespan1).to.eq(queuedAction2.timespan);
      expect(activePlayerInfo.timespan2).to.eq(queuedAction.timespan);

      await players
        .connect(alice)
        .startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.KEEP_LAST_IN_PROGRESS);
      activePlayerInfo = await players.getActivePlayerInfo(alice.address);
      expect(activePlayerInfo.checkpoint).to.be.eq(NOW + queuedAction.timespan);
      expect(activePlayerInfo.timespan).to.eq(queuedAction1.timespan);
      expect(activePlayerInfo.timespan1).to.eq(queuedAction.timespan);
      expect(activePlayerInfo.timespan2).to.eq(queuedAction.timespan);

      // Replace whole thing
      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.NONE);
      const {timestamp: NOW1} = (await ethers.provider.getBlock("latest")) as Block;
      activePlayerInfo = await players.getActivePlayerInfo(alice.address);
      expect(activePlayerInfo.checkpoint).to.be.eq(NOW1);
      expect(activePlayerInfo.timespan).to.eq(queuedAction.timespan);
      expect(activePlayerInfo.timespan1).to.eq(queuedAction.timespan);
      expect(activePlayerInfo.timespan2).to.eq(queuedAction.timespan);
    });

    it("Checkpoints should always start from the beginning of the first action regardless of it being in-progress", async function () {
      const {playerId, players, itemNFT, world, alice, owner} = await loadFixture(playersFixture);

      const {queuedAction} = await setupBasicWoodcutting(itemNFT, world);
      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.NONE);
      let activePlayerInfo = await players.getActivePlayerInfo(alice.address);
      expect(activePlayerInfo.checkpoint).to.be.gt(0);
      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]);
      await players.connect(alice).processActions(playerId);
      // Check checkpoint time is the same
      expect((await players.getActivePlayerInfo(alice.address)).checkpoint).to.be.gt(activePlayerInfo.checkpoint);
    });
  });
});
