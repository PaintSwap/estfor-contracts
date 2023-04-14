import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {EstforTypes, EstforConstants} from "@paintswap/estfor-definitions";
import {Attire, BoostType, Skill} from "@paintswap/estfor-definitions/types";
import {expect} from "chai";
import {BigNumber} from "ethers";
import {ethers} from "hardhat";
import {AvatarInfo, createPlayer} from "../../scripts/utils";
import {emptyActionChoice, getActionChoiceId, getActionId} from "../utils";
import {playersFixture} from "./PlayersFixture";
import {getXPFromLevel, setupBasicFiremaking, setupBasicWoodcutting} from "./utils";

const actionIsAvailable = true;

describe("Players", function () {
  this.retries(3);

  it("New player stats", async function () {
    const {players, playerNFT, alice} = await loadFixture(playersFixture);

    const avatarId = 2;
    const avatarInfo: AvatarInfo = {
      name: "Name goes here",
      description: "Hi I'm a description",
      imageURI: "1234.png",
      startSkills: [Skill.FIREMAKING, Skill.NONE],
    };
    await playerNFT.setAvatars(avatarId, [avatarInfo]);
    const playerId = await createPlayer(playerNFT, avatarId, alice, "Name", true);

    const START_XP = await players.START_XP();
    expect(START_XP).to.be.gt(0);
    expect(await players.xp(playerId, Skill.FIREMAKING)).to.eq(START_XP);

    avatarInfo.startSkills = [Skill.FIREMAKING, Skill.HEALTH];

    await playerNFT.setAvatars(avatarId, [avatarInfo]);
    const newPlayerId = await createPlayer(playerNFT, avatarId, alice, "New name", true);
    expect(await players.xp(newPlayerId, Skill.FIREMAKING)).to.eq(START_XP.div(2));
    expect(await players.xp(newPlayerId, Skill.HEALTH)).to.eq(START_XP.div(2));

    expect((await players.players(newPlayerId)).totalXP).to.eq(START_XP);
    expect((await players.players(newPlayerId)).health).to.eq(3);
    expect((await players.players(newPlayerId)).melee).to.eq(1);
    expect((await players.players(newPlayerId)).range).to.eq(1);
    expect((await players.players(newPlayerId)).magic).to.eq(1);
    expect((await players.players(newPlayerId)).defence).to.eq(1);
  });

  it("Skill points", async function () {
    const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);
    const {queuedAction} = await setupBasicWoodcutting(itemNFT, world);
    await players.connect(alice).startAction(playerId, queuedAction, EstforTypes.ActionQueueStatus.NONE);
    await ethers.provider.send("evm_increaseTime", [361]);
    await players.connect(alice).processActions(playerId);
    expect(await players.xp(playerId, EstforTypes.Skill.WOODCUTTING)).to.be.deep.oneOf([
      BigNumber.from(361),
      BigNumber.from(362),
    ]);
    expect(await itemNFT.balanceOf(alice.address, EstforConstants.LOG)).to.eq(10); // Should be rounded down
  });

  it("Skill points (many)", async function () {
    const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);
    const {queuedAction} = await setupBasicWoodcutting(itemNFT, world);
    // start a bunch of actions 1 after each other
    for (let i = 0; i < 50; ++i) {
      await players.connect(alice).startAction(playerId, queuedAction, EstforTypes.ActionQueueStatus.APPEND);
      await ethers.provider.send("evm_increaseTime", [7200]);
      await players.connect(alice).processActions(playerId);
      expect(await players.xp(playerId, EstforTypes.Skill.WOODCUTTING)).to.be.eq((i + 1) * 3600);
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.LOG)).to.eq((i + 1) * 100); // Should be rounded down
    }
  });

  it("Speed multiplier", async function () {
    const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);
    const {queuedAction, rate} = await setupBasicWoodcutting(itemNFT, world);
    await players.connect(alice).startAction(playerId, queuedAction, EstforTypes.ActionQueueStatus.NONE);
    await players.connect(alice).setSpeedMultiplier(playerId, 2);

    await ethers.provider.send("evm_increaseTime", [queuedAction.timespan / 2]);
    await players.connect(alice).processActions(playerId);
    expect(await players.xp(playerId, EstforTypes.Skill.WOODCUTTING)).to.eq(queuedAction.timespan);
    // Check the drops are as expected
    expect(await itemNFT.balanceOf(alice.address, EstforConstants.LOG)).to.eq(
      Math.floor((queuedAction.timespan * rate) / (3600 * 10))
    );
    expect((await players.getActionQueue(playerId)).length).to.eq(0);
  });

  it("Partial consume aux items", async function () {
    const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);
    const {queuedAction, rate} = await setupBasicWoodcutting(itemNFT, world);
    await players.connect(alice).startAction(playerId, queuedAction, EstforTypes.ActionQueueStatus.NONE);

    await ethers.provider.send("evm_increaseTime", [queuedAction.timespan / 2]);
    await players.connect(alice).processActions(playerId);
    expect(await players.xp(playerId, EstforTypes.Skill.WOODCUTTING)).to.be.deep.oneOf([
      BigNumber.from(queuedAction.timespan / 2),
      BigNumber.from(queuedAction.timespan / 2 + 1),
    ]);
    // Check the drops are as expected
    expect(await itemNFT.balanceOf(alice.address, EstforConstants.LOG)).to.eq(
      Math.floor(((queuedAction.timespan / 2) * rate) / (3600 * 10))
    );
  });

  it("Skill points, max range", async function () {
    const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);
    const {queuedAction} = await setupBasicWoodcutting(itemNFT, world);
    await players.connect(alice).startAction(playerId, queuedAction, EstforTypes.ActionQueueStatus.NONE);

    await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]);
    await players.connect(alice).processActions(playerId);
    expect(await players.xp(playerId, EstforTypes.Skill.WOODCUTTING)).to.eq(queuedAction.timespan);
  });

  it("Multi-skill points", async function () {
    // TODO:
  });

  // TODO: Check attire stats are as expected

  it("Attire equipPositions", async function () {
    const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);

    let tx = await world.addAction({
      actionId: 1,
      info: {
        skill: EstforTypes.Skill.COMBAT,
        xpPerHour: 3600,
        minXP: 0,
        isDynamic: false,
        numSpawned: 1,
        handItemTokenIdRangeMin: EstforConstants.COMBAT_BASE,
        handItemTokenIdRangeMax: EstforConstants.COMBAT_MAX,
        isAvailable: actionIsAvailable,
        actionChoiceRequired: true,
        successPercent: 100,
      },
      guaranteedRewards: [],
      randomRewards: [],
      combatStats: EstforTypes.emptyCombatStats,
    });
    const actionId = await getActionId(tx);

    tx = await world.addActionChoice(EstforConstants.NONE, 1, {
      ...emptyActionChoice,
      skill: EstforTypes.Skill.MELEE,
    });
    const choiceId = await getActionChoiceId(tx);
    const timespan = 3600;

    const queuedAction: EstforTypes.QueuedActionInput = {
      attire: {...EstforTypes.noAttire, head: EstforConstants.BRONZE_GAUNTLETS}, // Incorrect attire
      actionId,
      combatStyle: EstforTypes.CombatStyle.ATTACK,
      choiceId,
      choiceId1: EstforConstants.NONE,
      choiceId2: EstforConstants.NONE,
      regenerateId: EstforConstants.NONE,
      timespan,
      rightHandEquipmentTokenId: EstforConstants.NONE,
      leftHandEquipmentTokenId: EstforConstants.NONE,
    };

    await itemNFT.addItem({
      ...EstforTypes.defaultInputItem,
      tokenId: EstforConstants.BRONZE_GAUNTLETS,
      combatStats: EstforTypes.emptyCombatStats,
      equipPosition: EstforTypes.EquipPosition.ARMS,
    });
    await itemNFT.testMint(alice.address, EstforConstants.BRONZE_GAUNTLETS, 1);

    await expect(
      players.connect(alice).startAction(playerId, queuedAction, EstforTypes.ActionQueueStatus.NONE)
    ).to.be.revertedWithCustomError(players, "InvalidEquipPosition");
    queuedAction.attire.head = EstforConstants.NONE;
    queuedAction.attire.neck = EstforConstants.BRONZE_GAUNTLETS;
    await expect(
      players.connect(alice).startAction(playerId, queuedAction, EstforTypes.ActionQueueStatus.NONE)
    ).to.be.revertedWithCustomError(players, "InvalidEquipPosition");
    queuedAction.attire.neck = EstforConstants.NONE;
    queuedAction.attire.body = EstforConstants.BRONZE_GAUNTLETS;
    await expect(
      players.connect(alice).startAction(playerId, queuedAction, EstforTypes.ActionQueueStatus.NONE)
    ).to.be.revertedWithCustomError(players, "InvalidEquipPosition");
    queuedAction.attire.body = EstforConstants.NONE;
    queuedAction.attire.feet = EstforConstants.BRONZE_GAUNTLETS;
    await expect(
      players.connect(alice).startAction(playerId, queuedAction, EstforTypes.ActionQueueStatus.NONE)
    ).to.be.revertedWithCustomError(players, "InvalidEquipPosition");
    queuedAction.attire.feet = EstforConstants.NONE;
    queuedAction.attire.legs = EstforConstants.BRONZE_GAUNTLETS;
    await expect(
      players.connect(alice).startAction(playerId, queuedAction, EstforTypes.ActionQueueStatus.NONE)
    ).to.be.revertedWithCustomError(players, "InvalidEquipPosition");
    queuedAction.attire.legs = EstforConstants.NONE;
    queuedAction.attire.arms = EstforConstants.BRONZE_GAUNTLETS; // Correct
    await players.connect(alice).startAction(playerId, queuedAction, EstforTypes.ActionQueueStatus.NONE);
  });

  it("Queueing after 1 action is completely finished", async function () {
    const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);
    const {queuedAction} = await setupBasicWoodcutting(itemNFT, world);
    await players.connect(alice).startAction(playerId, queuedAction, EstforTypes.ActionQueueStatus.NONE);
    await ethers.provider.send("evm_increaseTime", [queuedAction.timespan / 2]);
    await players.connect(alice).startAction(playerId, queuedAction, EstforTypes.ActionQueueStatus.APPEND);
    await ethers.provider.send("evm_increaseTime", [queuedAction.timespan / 2 + 1]); // First one is now finished
    await players.connect(alice).startAction(playerId, queuedAction, EstforTypes.ActionQueueStatus.APPEND); // This should complete the first one
    const actionQueue = await players.getActionQueue(playerId);
    expect(actionQueue.length).to.eq(2);
    expect(actionQueue[0].queueId).to.eq(2);
    expect(actionQueue[0].timespan).to.be.oneOf([queuedAction.timespan - 1, queuedAction.timespan]);
    expect(actionQueue[1].queueId).to.eq(3);
    expect(actionQueue[1].timespan).to.eq(queuedAction.timespan);
  });

  describe("Queue combinations", function () {
    it("Remove in-progress but keep 1 pending", async function () {
      const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);
      const {queuedAction} = await setupBasicWoodcutting(itemNFT, world);
      await players
        .connect(alice)
        .startActions(playerId, [queuedAction, queuedAction], EstforTypes.ActionQueueStatus.NONE);
      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan / 2]);
      let actionQueue = await players.getActionQueue(playerId);
      expect(actionQueue.length).to.eq(2);
      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStatus.NONE);
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
        .startActions(playerId, [queuedAction, queuedAction], EstforTypes.ActionQueueStatus.NONE);
      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan / 2]);
      let actionQueue = await players.getActionQueue(playerId);
      expect(actionQueue.length).to.eq(2);
      await players
        .connect(alice)
        .startActions(playerId, [queuedAction, queuedAction], EstforTypes.ActionQueueStatus.NONE);
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
        .startActions(playerId, [queuedAction, queuedAction], EstforTypes.ActionQueueStatus.NONE);
      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan / 2]);
      let actionQueue = await players.getActionQueue(playerId);
      expect(actionQueue.length).to.eq(2);
      await players.connect(alice).startActions(playerId, [], EstforTypes.ActionQueueStatus.KEEP_LAST_IN_PROGRESS);
      actionQueue = await players.getActionQueue(playerId);
      expect(actionQueue.length).to.eq(1);
      expect(actionQueue[0].queueId).to.eq(1);
      expect(actionQueue[0].timespan).to.be.oneOf([queuedAction.timespan / 2 - 1, queuedAction.timespan / 2]);
    });
    it("Keep in-progress, remove 1 pending, and add 1 pending", async function () {
      const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);
      const {queuedAction} = await setupBasicWoodcutting(itemNFT, world);
      await players
        .connect(alice)
        .startActions(playerId, [queuedAction, queuedAction], EstforTypes.ActionQueueStatus.NONE);
      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan / 2]);
      let actionQueue = await players.getActionQueue(playerId);
      expect(actionQueue.length).to.eq(2);
      await players
        .connect(alice)
        .startActions(playerId, [queuedAction], EstforTypes.ActionQueueStatus.KEEP_LAST_IN_PROGRESS);
      actionQueue = await players.getActionQueue(playerId);
      expect(actionQueue.length).to.eq(2);
      expect(actionQueue[0].queueId).to.eq(1);
      expect(actionQueue[0].timespan).to.be.oneOf([queuedAction.timespan / 2 - 1, queuedAction.timespan / 2]);
      expect(actionQueue[1].queueId).to.eq(3);
      expect(actionQueue[1].timespan).to.eq(queuedAction.timespan);
    });
    it("Remove in-progress and any pending", async function () {
      const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);
      const {queuedAction} = await setupBasicWoodcutting(itemNFT, world);
      await players
        .connect(alice)
        .startActions(playerId, [queuedAction, queuedAction], EstforTypes.ActionQueueStatus.NONE);
      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan / 2]);
      let actionQueue = await players.getActionQueue(playerId);
      expect(actionQueue.length).to.eq(2);
      await players.connect(alice).startActions(playerId, [], EstforTypes.ActionQueueStatus.NONE);
      actionQueue = await players.getActionQueue(playerId);
      expect(actionQueue.length).to.eq(0);
    });
    it("Remove in-progress and pending, add 1 pending ", async function () {
      const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);
      const {queuedAction} = await setupBasicWoodcutting(itemNFT, world);
      await players
        .connect(alice)
        .startActions(playerId, [queuedAction, queuedAction], EstforTypes.ActionQueueStatus.NONE);
      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan / 2]);
      let actionQueue = await players.getActionQueue(playerId);
      expect(actionQueue.length).to.eq(2);
      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStatus.NONE);
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
        .startActions(playerId, [queuedAction, queuedAction], EstforTypes.ActionQueueStatus.NONE);
      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan / 2]);
      let actionQueue = await players.getActionQueue(playerId);
      expect(actionQueue.length).to.eq(2);
      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStatus.APPEND);
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
      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStatus.NONE);
      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan + 1]);

      queuedAction.timespan = 5 * 3600;

      actionQueue = await players.getActionQueue(playerId);
      expect(actionQueue.length).to.eq(1);
      await players
        .connect(alice)
        .startActions(
          playerId,
          [basicWoodcuttingQueuedAction, queuedAction, queuedAction],
          EstforTypes.ActionQueueStatus.KEEP_LAST_IN_PROGRESS
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
      await players.connect(alice).processActions(playerId);
      actionQueue = await players.getActionQueue(playerId);
      expect(actionQueue.length).to.eq(3);
      expect(actionQueue[0].queueId).to.eq(2);
      expect(actionQueue[0].timespan).to.be.oneOf([
        basicWoodcuttingQueuedAction.timespan - 50,
        basicWoodcuttingQueuedAction.timespan - 50 - 1,
      ]);
      expect(actionQueue[1].queueId).to.eq(3);
      expect(actionQueue[1].timespan).to.eq(queuedAction.timespan);
      expect(actionQueue[2].queueId).to.eq(4);
      expect(actionQueue[2].timespan).to.eq(queuedAction.timespan);
    });
  });

  describe("Minimum skill points", function () {
    it("Action", async function () {
      const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);
      const rate = 100 * 10; // per hour
      const tx = await world.addAction({
        actionId: 1,
        info: {
          skill: EstforTypes.Skill.WOODCUTTING,
          xpPerHour: 3600,
          minXP: getXPFromLevel(70),
          isDynamic: false,
          numSpawned: 0,
          handItemTokenIdRangeMin: EstforConstants.ORICHALCUM_AXE,
          handItemTokenIdRangeMax: EstforConstants.WOODCUTTING_MAX,
          isAvailable: true,
          actionChoiceRequired: false,
          successPercent: 100,
        },
        guaranteedRewards: [{itemTokenId: EstforConstants.LOG, rate}],
        randomRewards: [],
        combatStats: EstforTypes.emptyCombatStats,
      });
      const actionId = await getActionId(tx);

      const timespan = 3600;
      const queuedAction: EstforTypes.QueuedActionInput = {
        attire: EstforTypes.noAttire,
        actionId,
        combatStyle: EstforTypes.CombatStyle.NONE,
        choiceId: EstforConstants.NONE,
        choiceId1: EstforConstants.NONE,
        choiceId2: EstforConstants.NONE,
        regenerateId: EstforConstants.NONE,
        timespan,
        rightHandEquipmentTokenId: EstforConstants.ORICHALCUM_AXE,
        leftHandEquipmentTokenId: EstforConstants.NONE,
      };

      await itemNFT.addItem({
        ...EstforTypes.defaultInputItem,
        minXP: 0,
        tokenId: EstforConstants.ORICHALCUM_AXE,
        equipPosition: EstforTypes.EquipPosition.RIGHT_HAND,
      });

      await itemNFT.testMint(alice.address, EstforConstants.ORICHALCUM_AXE, 1);

      await expect(
        players.connect(alice).startAction(playerId, queuedAction, EstforTypes.ActionQueueStatus.NONE)
      ).to.be.revertedWithCustomError(players, "ActionMinimumXPNotReached");

      // Update to level 70, check it works
      await players.testModifyXP(playerId, EstforTypes.Skill.WOODCUTTING, getXPFromLevel(70));
      expect(await players.connect(alice).startAction(playerId, queuedAction, EstforTypes.ActionQueueStatus.NONE)).to
        .not.be.reverted;
    });

    describe("ActionChoices", function () {
      it("Min XP", async function () {
        const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);

        const minXP = getXPFromLevel(70);
        const {queuedAction} = await setupBasicFiremaking(itemNFT, world, minXP);

        await expect(
          players.connect(alice).startAction(playerId, queuedAction, EstforTypes.ActionQueueStatus.NONE)
        ).to.be.revertedWithCustomError(players, "ActionChoiceMinimumXPNotReached");

        // Update firemamking level, check it works
        await players.testModifyXP(playerId, EstforTypes.Skill.FIREMAKING, minXP);
        expect(await players.connect(alice).startAction(playerId, queuedAction, EstforTypes.ActionQueueStatus.NONE)).to
          .not.be.reverted;

        await players.connect(alice).startAction(playerId, queuedAction, EstforTypes.ActionQueueStatus.NONE);
      });

      it("Output number > 1", async function () {
        const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);
        const {queuedAction: queuedActionFiremaking, rate, actionId} = await setupBasicFiremaking(itemNFT, world, 0);

        // Logs go in, oak logs come out suprisingly!
        const outputNum = 2;
        const tx = await world.addActionChoice(actionId, 2, {
          skill: EstforTypes.Skill.FIREMAKING,
          diff: 0,
          xpPerHour: 3600,
          minXP: 0,
          rate,
          inputTokenId1: EstforConstants.LOG,
          num1: 1,
          inputTokenId2: EstforConstants.NONE,
          num2: 0,
          inputTokenId3: EstforConstants.NONE,
          num3: 0,
          outputTokenId: EstforConstants.OAK_LOG,
          outputNum,
          successPercent: 100,
        });
        const choiceId = await getActionChoiceId(tx);
        const queuedAction = {...queuedActionFiremaking};
        queuedAction.choiceId = choiceId;

        // Update firemamking level, check it works
        await players.connect(alice).startAction(playerId, queuedAction, EstforTypes.ActionQueueStatus.NONE);
        await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]);
        await ethers.provider.send("evm_mine", []);

        const pendingQueuedActionState = await players.pendingQueuedActionState(alice.address, playerId);
        const expectedOutputNum = Math.floor((queuedAction.timespan * rate * outputNum) / (3600 * 10));
        expect(pendingQueuedActionState.equipmentStates[0].produced[0].amount).to.eq(expectedOutputNum);

        await players.connect(alice).processActions(playerId);
        // Check the drops are as expected
        expect(await itemNFT.balanceOf(alice.address, EstforConstants.OAK_LOG)).to.eq(expectedOutputNum);
      });
    });

    it("Consumables (food)", async function () {
      const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);
      const rate = 100 * 10; // per hour
      let tx = await world.addAction({
        actionId: 1,
        info: {
          skill: EstforTypes.Skill.FIREMAKING,
          xpPerHour: 0,
          minXP: 0,
          isDynamic: false,
          numSpawned: 0,
          handItemTokenIdRangeMin: EstforConstants.MAGIC_FIRE_STARTER,
          handItemTokenIdRangeMax: EstforConstants.FIRE_MAX,
          isAvailable: actionIsAvailable,
          actionChoiceRequired: true,
          successPercent: 100,
        },
        guaranteedRewards: [],
        randomRewards: [],
        combatStats: EstforTypes.emptyCombatStats,
      });
      const actionId = await getActionId(tx);

      // Logs go in, nothing comes out
      tx = await world.addActionChoice(actionId, 1, {
        skill: EstforTypes.Skill.FIREMAKING,
        diff: 0,
        xpPerHour: 3600,
        minXP: 0,
        rate,
        inputTokenId1: EstforConstants.LOG,
        num1: 1,
        inputTokenId2: EstforConstants.NONE,
        num2: 0,
        inputTokenId3: EstforConstants.NONE,
        num3: 0,
        outputTokenId: EstforConstants.NONE,
        outputNum: 0,
        successPercent: 100,
      });
      const choiceId = await getActionChoiceId(tx);

      const timespan = 3600;
      const queuedAction: EstforTypes.QueuedActionInput = {
        attire: EstforTypes.noAttire,
        actionId,
        combatStyle: EstforTypes.CombatStyle.NONE,
        choiceId,
        choiceId1: EstforConstants.NONE,
        choiceId2: EstforConstants.NONE,
        regenerateId: EstforConstants.COOKED_MINNUS,
        timespan,
        rightHandEquipmentTokenId: EstforConstants.MAGIC_FIRE_STARTER,
        leftHandEquipmentTokenId: EstforConstants.NONE,
      };

      const minXP = getXPFromLevel(70);
      await itemNFT.addItems([
        {
          ...EstforTypes.defaultInputItem,
          tokenId: EstforConstants.MAGIC_FIRE_STARTER,
          equipPosition: EstforTypes.EquipPosition.RIGHT_HAND,
        },
        {
          ...EstforTypes.defaultInputItem,
          tokenId: EstforConstants.LOG,
          equipPosition: EstforTypes.EquipPosition.AUX,
        },
        {
          ...EstforTypes.defaultInputItem,
          skill: EstforTypes.Skill.HEALTH,
          minXP,
          healthRestored: 12,
          tokenId: EstforConstants.COOKED_MINNUS,
          equipPosition: EstforTypes.EquipPosition.FOOD,
        },
      ]);

      await itemNFT.testMint(alice.address, EstforConstants.LOG, 5);
      await itemNFT.testMint(alice.address, EstforConstants.COOKED_MINNUS, 1);

      await expect(
        players.connect(alice).startAction(playerId, queuedAction, EstforTypes.ActionQueueStatus.NONE)
      ).to.be.revertedWithCustomError(players, "ConsumableMinimumXPNotReached");

      await players.testModifyXP(playerId, EstforTypes.Skill.HEALTH, minXP);

      // Update health level, check it works
      expect(await players.connect(alice).startAction(playerId, queuedAction, EstforTypes.ActionQueueStatus.NONE)).to
        .not.be.reverted;

      await players.connect(alice).startAction(playerId, queuedAction, EstforTypes.ActionQueueStatus.NONE);
    });

    it("Attire", async function () {
      const {playerId, players, playerNFT, itemNFT, world, alice} = await loadFixture(playersFixture);
      const {queuedAction} = await setupBasicWoodcutting(itemNFT, world);
      const minXP = getXPFromLevel(70);

      await itemNFT.testMints(
        alice.address,
        [
          EstforConstants.BRONZE_AXE,
          EstforConstants.AMETHYST_AMULET,
          EstforConstants.BRONZE_ARMOR,
          EstforConstants.BRONZE_BOOTS,
          EstforConstants.BRONZE_GAUNTLETS,
          EstforConstants.BRONZE_HELMET,
          EstforConstants.BRONZE_TASSETS,
        ],
        [1, 1, 1, 1, 1, 1, 1]
      );

      const attireEquipped = [
        {
          ...EstforTypes.defaultInputItem,
          skill: EstforTypes.Skill.DEFENCE,
          minXP,
          tokenId: EstforConstants.BRONZE_HELMET,
          equipPosition: EstforTypes.EquipPosition.HEAD,
        },
        {
          ...EstforTypes.defaultInputItem,
          skill: EstforTypes.Skill.MELEE,
          minXP,
          tokenId: EstforConstants.AMETHYST_AMULET,
          equipPosition: EstforTypes.EquipPosition.NECK,
        },
        {
          ...EstforTypes.defaultInputItem,
          skill: EstforTypes.Skill.FIREMAKING,
          minXP,
          tokenId: EstforConstants.BRONZE_ARMOR,
          equipPosition: EstforTypes.EquipPosition.BODY,
        },
        {
          ...EstforTypes.defaultInputItem,
          skill: EstforTypes.Skill.MAGIC,
          minXP,
          tokenId: EstforConstants.BRONZE_GAUNTLETS,
          equipPosition: EstforTypes.EquipPosition.ARMS,
        },
        {
          ...EstforTypes.defaultInputItem,
          skill: EstforTypes.Skill.COOKING,
          minXP,
          tokenId: EstforConstants.BRONZE_TASSETS,
          equipPosition: EstforTypes.EquipPosition.LEGS,
        },
        {
          ...EstforTypes.defaultInputItem,
          skill: EstforTypes.Skill.CRAFTING,
          minXP,
          tokenId: EstforConstants.BRONZE_BOOTS,
          equipPosition: EstforTypes.EquipPosition.FEET,
        },
      ];

      await itemNFT.addItems(attireEquipped);

      const equips = ["head", "neck", "body", "arms", "legs", "feet"];
      for (let i = 0; i < attireEquipped.length; ++i) {
        const attire: Attire = {...EstforTypes.noAttire};
        attire[equips[i] as keyof Attire] = attireEquipped[i].tokenId;
        queuedAction.attire = attire;
        await expect(
          players.connect(alice).startAction(playerId, queuedAction, EstforTypes.ActionQueueStatus.NONE)
        ).to.be.revertedWithCustomError(players, "AttireMinimumXPNotReached");
        await players.testModifyXP(playerId, attireEquipped[i].skill, minXP);
        expect(await players.connect(alice).startAction(playerId, queuedAction, EstforTypes.ActionQueueStatus.NONE)).to
          .not.be.reverted;
      }

      // Test case, create a player
      const makeActive = true;
      await expect(playerNFT.connect(alice).mint(1, "0xSamWitch123", makeActive)).to.not.be.reverted;
    });

    it("Left/Right equipment", async function () {
      const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);
      const rate = 100 * 10; // per hour
      const tx = await world.addAction({
        actionId: 1,
        info: {
          skill: EstforTypes.Skill.WOODCUTTING,
          xpPerHour: 3600,
          minXP: 0,
          isDynamic: false,
          numSpawned: 0,
          handItemTokenIdRangeMin: EstforConstants.ORICHALCUM_AXE,
          handItemTokenIdRangeMax: EstforConstants.WOODCUTTING_MAX,
          isAvailable: true,
          actionChoiceRequired: false,
          successPercent: 100,
        },
        guaranteedRewards: [{itemTokenId: EstforConstants.LOG, rate}],
        randomRewards: [],
        combatStats: EstforTypes.emptyCombatStats,
      });
      const actionId = await getActionId(tx);

      const timespan = 3600;
      const queuedAction: EstforTypes.QueuedActionInput = {
        attire: EstforTypes.noAttire,
        actionId,
        combatStyle: EstforTypes.CombatStyle.NONE,
        choiceId: EstforConstants.NONE,
        choiceId1: EstforConstants.NONE,
        choiceId2: EstforConstants.NONE,
        regenerateId: EstforConstants.NONE,
        timespan,
        rightHandEquipmentTokenId: EstforConstants.ORICHALCUM_AXE,
        leftHandEquipmentTokenId: EstforConstants.NONE,
      };

      const minXP = getXPFromLevel(70);
      await itemNFT.addItem({
        ...EstforTypes.defaultInputItem,
        skill: EstforTypes.Skill.WOODCUTTING,
        minXP,
        tokenId: EstforConstants.ORICHALCUM_AXE,
        equipPosition: EstforTypes.EquipPosition.RIGHT_HAND,
      });

      await itemNFT.testMint(alice.address, EstforConstants.ORICHALCUM_AXE, 1);

      await expect(
        players.connect(alice).startAction(playerId, queuedAction, EstforTypes.ActionQueueStatus.NONE)
      ).to.be.revertedWithCustomError(players, "ItemMinimumXPNotReached");

      // Update to level 70, check it works
      await players.testModifyXP(playerId, EstforTypes.Skill.WOODCUTTING, minXP);
      expect(await players.connect(alice).startAction(playerId, queuedAction, EstforTypes.ActionQueueStatus.NONE)).to
        .not.be.reverted;
    });

    it("Maxing out XP", async function () {
      const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);
      const rate = 100 * 10; // per hour
      const tx = await world.addAction({
        actionId: 1,
        info: {
          skill: EstforTypes.Skill.WOODCUTTING,
          xpPerHour: 16000000, // 16MM
          minXP: 0,
          isDynamic: false,
          numSpawned: 0,
          handItemTokenIdRangeMin: EstforConstants.ORICHALCUM_AXE,
          handItemTokenIdRangeMax: EstforConstants.WOODCUTTING_MAX,
          isAvailable: true,
          actionChoiceRequired: false,
          successPercent: 100,
        },
        guaranteedRewards: [{itemTokenId: EstforConstants.LOG, rate}],
        randomRewards: [],
        combatStats: EstforTypes.emptyCombatStats,
      });
      const actionId = await getActionId(tx);

      const timespan = 3600 * 24;
      const queuedAction: EstforTypes.QueuedActionInput = {
        attire: EstforTypes.noAttire,
        actionId,
        combatStyle: EstforTypes.CombatStyle.NONE,
        choiceId: EstforConstants.NONE,
        choiceId1: EstforConstants.NONE,
        choiceId2: EstforConstants.NONE,
        regenerateId: EstforConstants.NONE,
        timespan,
        rightHandEquipmentTokenId: EstforConstants.ORICHALCUM_AXE,
        leftHandEquipmentTokenId: EstforConstants.NONE,
      };

      const minXP = getXPFromLevel(98);
      await players.testModifyXP(playerId, EstforTypes.Skill.WOODCUTTING, minXP);

      await itemNFT.addItem({
        ...EstforTypes.defaultInputItem,
        skill: EstforTypes.Skill.WOODCUTTING,
        minXP,
        tokenId: EstforConstants.ORICHALCUM_AXE,
        equipPosition: EstforTypes.EquipPosition.RIGHT_HAND,
      });

      await itemNFT.testMint(alice.address, EstforConstants.ORICHALCUM_AXE, 1);

      // 16MM is the maximum xp per hour that can be gained, so need to loop it many time to go over
      for (let i = 0; i < 25; ++i) {
        await players.connect(alice).startAction(playerId, queuedAction, EstforTypes.ActionQueueStatus.NONE);
        await ethers.provider.send("evm_increaseTime", [24 * 3600]);
        await players.connect(alice).startAction(playerId, queuedAction, EstforTypes.ActionQueueStatus.NONE);
      }
      expect(await players.xp(playerId, EstforTypes.Skill.WOODCUTTING)).to.eq(Math.pow(2, 32) - 1);
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

      expect(await players.connect(alice).activePlayer(alice.address)).to.eq(playerId);
      await playerNFT.connect(alice).safeTransferFrom(alice.address, owner.address, playerId, 1, "0x");
      expect(await players.connect(alice).activePlayer(alice.address)).to.eq(0);
    });

    it("Transferring non-active player", async function () {
      const {playerId, players, playerNFT, alice, owner} = await loadFixture(playersFixture);

      const newPlayerId = await createPlayer(playerNFT, 1, alice, "New name", false);
      expect(await players.connect(alice).activePlayer(alice.address)).to.eq(playerId);
      await playerNFT.connect(alice).safeTransferFrom(alice.address, owner.address, newPlayerId, 1, "0x");
      expect(await players.connect(alice).activePlayer(alice.address)).to.eq(playerId);
    });

    it("Check timespan overflow", async function () {
      // This test was added to check for a bug where the timespan was > 65535 but cast to uint16
      const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);

      const {queuedAction: basicWoodcuttingQueuedAction} = await setupBasicWoodcutting(itemNFT, world);
      const queuedAction = {...basicWoodcuttingQueuedAction};
      queuedAction.timespan = 24 * 3600;
      await players.connect(alice).startAction(playerId, queuedAction, EstforTypes.ActionQueueStatus.NONE);
      await ethers.provider.send("evm_increaseTime", [5]);
      await ethers.provider.send("evm_mine", []);

      await players.connect(alice).processActions(playerId);
      const actionQueue = await players.getActionQueue(playerId);
      expect(actionQueue[0].timespan).gt(queuedAction.timespan - 10);
    });

    it("Base XP boost", async function () {
      // This test was added to check for a bug where the timespan was > 65535 but cast to uint16
      const {players, playerNFT, itemNFT, world, alice} = await loadFixture(playersFixture);

      const avatarId = 2;
      const avatarInfo: AvatarInfo = {
        name: "Name goes here",
        description: "Hi I'm a description",
        imageURI: "1234.png",
        startSkills: [Skill.WOODCUTTING, Skill.NONE],
      };
      await playerNFT.setAvatars(avatarId, [avatarInfo]);
      const playerId = createPlayer(playerNFT, avatarId, alice, "New name", true);

      const {queuedAction} = await setupBasicWoodcutting(itemNFT, world);
      await players.connect(alice).startAction(playerId, queuedAction, EstforTypes.ActionQueueStatus.NONE);
      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]);
      await ethers.provider.send("evm_mine", []);

      const pendingQueuedActionState = await players.pendingQueuedActionState(alice.address, playerId);
      expect(pendingQueuedActionState.actionMetadatas[0].xpGained).to.eq(Math.floor(queuedAction.timespan * 1.1));
      await players.connect(alice).processActions(playerId);
      const startXP = (await players.START_XP()).toNumber();
      expect(await players.xp(playerId, EstforTypes.Skill.WOODCUTTING)).to.eq(
        Math.floor(startXP + queuedAction.timespan * 1.1)
      );
    });

    it("Base XP boost, 2 skills", async function () {
      // This test was added to check for a bug where the timespan was > 65535 but cast to uint16
      const {players, playerNFT, itemNFT, world, alice} = await loadFixture(playersFixture);

      const avatarId = 2;
      const avatarInfo: AvatarInfo = {
        name: "Name goes here",
        description: "Hi I'm a description",
        imageURI: "1234.png",
        startSkills: [Skill.THIEVING, Skill.WOODCUTTING],
      };
      await playerNFT.setAvatars(avatarId, [avatarInfo]);
      const playerId = createPlayer(playerNFT, avatarId, alice, "New name", true);

      const {queuedAction} = await setupBasicWoodcutting(itemNFT, world);
      await players.connect(alice).startAction(playerId, queuedAction, EstforTypes.ActionQueueStatus.NONE);
      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]);
      await ethers.provider.send("evm_mine", []);

      const pendingQueuedActionState = await players.pendingQueuedActionState(alice.address, playerId);
      expect(pendingQueuedActionState.actionMetadatas[0].xpGained).to.eq(Math.floor(queuedAction.timespan * 1.05));
      await players.connect(alice).processActions(playerId);
      const startXP = (await players.START_XP()).toNumber() / 2;
      expect(await players.xp(playerId, EstforTypes.Skill.WOODCUTTING)).to.eq(
        Math.floor(startXP + queuedAction.timespan * 1.05)
      );
    });

    it("Revert if trying to initialize QueueActionImpl", async function () {
      // This test was added to check for a bug where the timespan was > 65535 but cast to uint16
      const {playersImplMisc} = await loadFixture(playersFixture);

      await expect(
        playersImplMisc.initialize(
          ethers.constants.AddressZero,
          ethers.constants.AddressZero,
          ethers.constants.AddressZero,
          ethers.constants.AddressZero,
          ethers.constants.AddressZero,
          ethers.constants.AddressZero,
          ethers.constants.AddressZero,
          ethers.constants.AddressZero,
          ethers.constants.AddressZero,
          ethers.constants.AddressZero,
          false
        )
      ).to.be.revertedWithCustomError(playersImplMisc, "CannotCallInitializerOnImplementation");
    });
  });
});
