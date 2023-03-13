import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {EstforConstants, EstforTypes} from "@paintswap/estfor-definitions";
import {expect} from "chai";
import {ethers} from "hardhat";
import {emptyActionChoice, getActionChoiceId, getActionChoiceIds, getActionId, getRequestId} from "../../scripts/utils";
import {playersFixture} from "./PlayersFixture";

const actionIsAvailable = true;

describe("Combat Actions", () => {
  describe("Melee", async () => {
    async function playersFixtureMelee() {
      const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);

      const monsterCombatStats: EstforTypes.CombatStats = {
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
          skill: EstforTypes.Skill.COMBAT,
          xpPerHour: 3600,
          minSkillPoints: 0,
          isDynamic: false,
          numSpawn: 1,
          handItemTokenIdRangeMin: EstforConstants.COMBAT_BASE,
          handItemTokenIdRangeMax: EstforConstants.COMBAT_MAX,
          isAvailable: actionIsAvailable,
          actionChoiceRequired: true,
        },
        guaranteedRewards: [{itemTokenId: EstforConstants.BRONZE_ARROW, rate}],
        randomRewards: [],
        combatStats: monsterCombatStats,
      });
      const actionId = await getActionId(tx);

      tx = await world.addActionChoice(EstforConstants.NONE, 1, {
        ...emptyActionChoice,
        skill: EstforTypes.Skill.ATTACK,
      });
      const choiceId = await getActionChoiceId(tx);
      await itemNFT.testOnlyMint(alice.address, EstforConstants.BRONZE_SWORD, 1);
      await itemNFT.testOnlyMint(alice.address, EstforConstants.COOKED_MINNUS, 255);
      const timespan = 3600;
      const queuedAction: EstforTypes.QueuedAction = {
        attire: EstforTypes.noAttire,
        actionId,
        combatStyle: EstforTypes.CombatStyle.MELEE,
        choiceId,
        choiceId1: EstforConstants.NONE,
        choiceId2: EstforConstants.NONE,
        regenerateId: EstforConstants.COOKED_MINNUS,
        timespan,
        rightHandEquipmentTokenId: EstforConstants.BRONZE_SWORD,
        leftHandEquipmentTokenId: EstforConstants.NONE,
        startTime: "0",
        isValid: true,
      };

      await itemNFT.addItem({
        ...EstforTypes.defaultInputItem,
        combatStats: {
          ...EstforTypes.emptyCombatStats,
          melee: 5,
        },
        tokenId: EstforConstants.BRONZE_SWORD,
        equipPosition: EstforTypes.EquipPosition.RIGHT_HAND,
        metadataURI: "someIPFSURI.json",
      });

      await itemNFT.addItem({
        ...EstforTypes.defaultInputItem,
        tokenId: EstforConstants.BRONZE_ARROW,
        equipPosition: EstforTypes.EquipPosition.ARROW_SATCHEL,
        metadataURI: "someIPFSURI.json",
      });

      await itemNFT.addItem({
        ...EstforTypes.defaultInputItem,
        healthRestored: 12,
        tokenId: EstforConstants.COOKED_MINNUS,
        equipPosition: EstforTypes.EquipPosition.FOOD,
        metadataURI: "someIPFSURI.json",
      });

      return {
        playerId,
        players,
        itemNFT,
        alice,
        queuedAction,
        rate,
      };
    }

    it("Simple", async () => {
      const {playerId, players, itemNFT, alice, queuedAction, rate} = await loadFixture(playersFixtureMelee);

      await players.connect(alice).startAction(playerId, queuedAction, EstforTypes.ActionQueueStatus.NONE);

      const time = 3600;
      await ethers.provider.send("evm_increaseTime", [time]);
      await players.connect(alice).processActions(playerId);
      expect(await players.skillPoints(playerId, EstforTypes.Skill.ATTACK)).to.be.oneOf([time, time + 1]);
      expect(await players.skillPoints(playerId, EstforTypes.Skill.HEALTH)).to.be.oneOf([
        Math.floor(time / 3) - 1,
        Math.floor(time / 3),
      ]); // Health should get 33% of the stats
      expect(await players.skillPoints(playerId, EstforTypes.Skill.DEFENCE)).to.eq(0);

      // Check the drops are as expected
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.BRONZE_ARROW)).to.eq(
        Math.floor((time * rate) / (3600 * 100))
      );

      // Check food is consumed
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.COOKED_MINNUS)).to.eq(255 - 25);
    });

    it("Don't kill anything", async () => {
      const {playerId, players, itemNFT, alice, queuedAction} = await loadFixture(playersFixtureMelee);

      await players.connect(alice).startAction(playerId, queuedAction, EstforTypes.ActionQueueStatus.NONE);

      const time = 360;
      await ethers.provider.send("evm_increaseTime", [time]);
      await players.connect(alice).processActions(playerId);
      expect(await players.skillPoints(playerId, EstforTypes.Skill.ATTACK)).to.eq(0);

      // Check the drops are as expected
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.BRONZE_ARROW)).to.eq(0);
      // Check food is consumed
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.COOKED_MINNUS)).to.eq(255 - 3);
    });

    it("Melee defence", async () => {
      const {playerId, players, itemNFT, alice, queuedAction, rate} = await loadFixture(playersFixtureMelee);

      const _queuedAction = {...queuedAction};
      _queuedAction.combatStyle = EstforTypes.CombatStyle.MELEE_DEFENCE;

      await players.connect(alice).startAction(playerId, _queuedAction, EstforTypes.ActionQueueStatus.NONE);

      const time = 3600;
      await ethers.provider.send("evm_increaseTime", [time]);
      await players.connect(alice).processActions(playerId);
      expect(await players.skillPoints(playerId, EstforTypes.Skill.DEFENCE)).to.be.oneOf([time, time + 1]);
      expect(await players.skillPoints(playerId, EstforTypes.Skill.ATTACK)).to.eq(0);

      // Check the drops are as expected
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.BRONZE_ARROW)).to.eq(
        Math.floor((time * rate) / (3600 * 100))
      );

      // Check food is consumed, update later
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.COOKED_MINNUS)).to.eq(255 - 25);
    });

    it("Equip shield", async () => {
      const {playerId, players, itemNFT, alice, queuedAction, rate} = await loadFixture(playersFixtureMelee);

      const _queuedAction = {...queuedAction};
      _queuedAction.rightHandEquipmentTokenId = EstforConstants.BRONZE_SHIELD;

      await itemNFT.testOnlyMint(alice.address, EstforConstants.BRONZE_SHIELD, 1);

      await expect(
        players.connect(alice).startAction(playerId, _queuedAction, EstforTypes.ActionQueueStatus.NONE)
      ).to.be.revertedWithCustomError(itemNFT, "ItemDoesNotExist");

      await itemNFT.addItem({
        ...EstforTypes.defaultInputItem,
        tokenId: EstforConstants.BRONZE_SHIELD,
        equipPosition: EstforTypes.EquipPosition.LEFT_HAND,
        metadataURI: "someIPFSURI.json",
      });

      await expect(
        players.connect(alice).startAction(playerId, _queuedAction, EstforTypes.ActionQueueStatus.NONE)
      ).to.be.revertedWithCustomError(players, "IncorrectRightHandEquipment");

      _queuedAction.rightHandEquipmentTokenId = EstforConstants.BRONZE_SWORD;

      _queuedAction.leftHandEquipmentTokenId = EstforConstants.BRONZE_SHIELD;

      await players.connect(alice).startAction(playerId, _queuedAction, EstforTypes.ActionQueueStatus.NONE);

      const time = 3600;
      await ethers.provider.send("evm_increaseTime", [time]);

      await players.connect(alice).processActions(playerId);
      expect(await players.skillPoints(playerId, EstforTypes.Skill.ATTACK)).to.oneOf([time, time + 1]);

      // Check the drops are as expected
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.BRONZE_ARROW)).to.eq(
        Math.floor((time * rate) / (3600 * 100))
      );

      // Check food is consumed, update later
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.COOKED_MINNUS)).to.eq(255 - 25);
    });
  });

  describe("Magic", () => {
    async function playersFixtureMagic() {
      const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);

      const monsterCombatStats: EstforTypes.CombatStats = {
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
          skill: EstforTypes.Skill.COMBAT,
          xpPerHour: 3600,
          minSkillPoints: 0,
          isDynamic: false,
          numSpawn: 1,
          handItemTokenIdRangeMin: EstforConstants.COMBAT_BASE,
          handItemTokenIdRangeMax: EstforConstants.COMBAT_MAX,
          isAvailable: actionIsAvailable,
          actionChoiceRequired: true,
        },
        guaranteedRewards: [{itemTokenId: EstforConstants.BRONZE_ARROW, rate: dropRate}],
        randomRewards: [],
        combatStats: monsterCombatStats,
      });
      const actionId = await getActionId(tx);

      await itemNFT.testOnlyMints(
        alice.address,
        [
          EstforConstants.TOTEM_STAFF,
          EstforConstants.BRONZE_SHIELD,
          EstforConstants.COOKED_MINNUS,
          EstforConstants.AIR_SCROLL,
          EstforConstants.SHADOW_SCROLL,
        ],
        [1, 1, 1000, 200, 100]
      );

      const scrollsConsumedRate = 1 * 100; // per hour
      // Combat uses none as it's not tied to a specific action (only combat ones)
      tx = await world.addActionChoice(EstforConstants.NONE, 1, {
        skill: EstforTypes.Skill.MAGIC,
        diff: 2,
        xpPerHour: 0,
        minSkillPoints: 0,
        rate: scrollsConsumedRate,
        inputTokenId1: EstforConstants.AIR_SCROLL,
        num1: 2,
        inputTokenId2: EstforConstants.SHADOW_SCROLL,
        num2: 1,
        inputTokenId3: EstforConstants.NONE,
        num3: 0,
        outputTokenId: EstforConstants.NONE,
        outputNum: 0,
      });
      const choiceId = await getActionChoiceId(tx);
      const timespan = 3600;
      const queuedAction: EstforTypes.QueuedAction = {
        attire: EstforTypes.noAttire,
        actionId,
        combatStyle: EstforTypes.CombatStyle.MAGIC,
        choiceId,
        choiceId1: EstforConstants.NONE,
        choiceId2: EstforConstants.NONE,
        regenerateId: EstforConstants.COOKED_MINNUS,
        timespan,
        rightHandEquipmentTokenId: EstforConstants.TOTEM_STAFF,
        leftHandEquipmentTokenId: EstforConstants.NONE, // 2 handed, must specify this for both?
        startTime: "0",
        isValid: true,
      };

      await itemNFT.addItems([
        {
          ...EstforTypes.defaultInputItem,
          tokenId: EstforConstants.AIR_SCROLL,
          equipPosition: EstforTypes.EquipPosition.MAGIC_BAG,
          metadataURI: "someIPFSURI.json",
        },
        {
          ...EstforTypes.defaultInputItem,
          tokenId: EstforConstants.SHADOW_SCROLL,
          equipPosition: EstforTypes.EquipPosition.MAGIC_BAG,
          metadataURI: "someIPFSURI.json",
        },
        {
          ...EstforTypes.defaultInputItem,
          tokenId: EstforConstants.TOTEM_STAFF,
          equipPosition: EstforTypes.EquipPosition.BOTH_HANDS,
          metadataURI: "someIPFSURI.json",
        },
        {
          ...EstforTypes.defaultInputItem,
          tokenId: EstforConstants.BRONZE_SHIELD,
          equipPosition: EstforTypes.EquipPosition.LEFT_HAND,
          metadataURI: "someIPFSURI.json",
        },
        {
          ...EstforTypes.defaultInputItem,
          tokenId: EstforConstants.BRONZE_ARROW,
          equipPosition: EstforTypes.EquipPosition.ARROW_SATCHEL,
          metadataURI: "someIPFSURI.json",
        },
        {
          ...EstforTypes.defaultInputItem,
          healthRestored: 12,
          tokenId: EstforConstants.COOKED_MINNUS,
          equipPosition: EstforTypes.EquipPosition.FOOD,
          metadataURI: "someIPFSURI.json",
        },
      ]);

      return {playerId, players, itemNFT, world, alice, timespan, actionId, dropRate, queuedAction};
    }

    it("Simple", async () => {
      const {playerId, players, itemNFT, alice, timespan, dropRate, queuedAction} = await loadFixture(
        playersFixtureMagic
      );

      await players.connect(alice).startAction(playerId, queuedAction, EstforTypes.ActionQueueStatus.NONE);

      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]);
      await players.connect(alice).processActions(playerId);
      expect(await players.skillPoints(playerId, EstforTypes.Skill.MAGIC)).to.eq(queuedAction.timespan);
      expect(await players.skillPoints(playerId, EstforTypes.Skill.DEFENCE)).to.eq(0);

      // Check the drops are as expected
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.BRONZE_ARROW)).to.eq(
        Math.floor((timespan * dropRate) / (3600 * 100))
      );

      // Check food is consumed, update later
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.COOKED_MINNUS)).to.eq(1000 - 25);

      // Check that scrolls are consumed
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.AIR_SCROLL)).to.eq(200 - 2);
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.SHADOW_SCROLL)).to.eq(100 - 1);
    });

    it("No staff equipped", async () => {
      const {playerId, players, itemNFT, alice, timespan, dropRate, queuedAction} = await loadFixture(
        playersFixtureMagic
      );

      const _queuedAction = {...queuedAction};
      _queuedAction.rightHandEquipmentTokenId = EstforConstants.NONE;

      await players.connect(alice).startAction(playerId, _queuedAction, EstforTypes.ActionQueueStatus.NONE);

      await ethers.provider.send("evm_increaseTime", [_queuedAction.timespan]);
      await players.connect(alice).processActions(playerId);
      expect(await players.skillPoints(playerId, EstforTypes.Skill.MAGIC)).to.eq(_queuedAction.timespan);
      expect(await players.skillPoints(playerId, EstforTypes.Skill.DEFENCE)).to.eq(0);

      // Check the drops are as expected
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.BRONZE_ARROW)).to.eq(
        Math.floor((timespan * dropRate) / (3600 * 100))
      );

      // Check food is consumed, update later
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.COOKED_MINNUS)).to.eq(1000 - 25);

      // Check that scrolls are consumed
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.AIR_SCROLL)).to.eq(200 - 2);
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.SHADOW_SCROLL)).to.eq(100 - 1);
    });

    it("Cannot equip shield with a staff", async () => {
      const {playerId, players, alice, queuedAction} = await loadFixture(playersFixtureMagic);

      const _queuedAction = {...queuedAction};

      _queuedAction.leftHandEquipmentTokenId = EstforConstants.BRONZE_SHIELD;
      await expect(
        players.connect(alice).startAction(playerId, _queuedAction, EstforTypes.ActionQueueStatus.NONE)
      ).to.be.revertedWithCustomError(players, "CannotEquipTwoHandedAndOtherEquipment");
      _queuedAction.leftHandEquipmentTokenId = EstforConstants.NONE;
      await expect(players.connect(alice).startAction(playerId, _queuedAction, EstforTypes.ActionQueueStatus.NONE)).to
        .not.be.reverted;
    });

    it("No scrolls equipped during processing action", async () => {
      const {playerId, players, itemNFT, alice, queuedAction} = await loadFixture(playersFixtureMagic);

      await players.connect(alice).startAction(playerId, queuedAction, EstforTypes.ActionQueueStatus.NONE);

      await itemNFT.connect(alice).burn(alice.address, EstforConstants.AIR_SCROLL, 200);

      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]);
      await players.connect(alice).processActions(playerId);
      // Should get no XP
      expect(await players.skillPoints(playerId, EstforTypes.Skill.MAGIC)).to.eq(0);
      expect(await players.skillPoints(playerId, EstforTypes.Skill.DEFENCE)).to.eq(0);
      // Check food is consumed, update later
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.COOKED_MINNUS)).to.eq(1000 - 25);

      // Check that no scrolls are consumed
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.AIR_SCROLL)).to.eq(0);
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.SHADOW_SCROLL)).to.eq(100);
    });

    it("Add multi actionChoice", async () => {
      const {playerId, players, alice, world, queuedAction} = await loadFixture(playersFixtureMagic);

      const _queuedAction = {...queuedAction};
      const scrollsConsumedRate = 1 * 100; // per hour

      let choiceId = 2;
      const tx = await world.addActionChoices(
        EstforConstants.NONE,
        [choiceId, choiceId + 1],
        [
          {
            skill: EstforTypes.Skill.MAGIC,
            diff: 2,
            xpPerHour: 0,
            minSkillPoints: 0,
            rate: scrollsConsumedRate,
            inputTokenId1: EstforConstants.AIR_SCROLL,
            num1: 1,
            inputTokenId2: EstforConstants.SHADOW_SCROLL,
            num2: 1,
            inputTokenId3: EstforConstants.NONE,
            num3: 0,
            outputTokenId: EstforConstants.NONE,
            outputNum: 0,
          },
          {
            skill: EstforTypes.Skill.MAGIC,
            diff: 2,
            xpPerHour: 0,
            minSkillPoints: 0,
            rate: scrollsConsumedRate,
            inputTokenId1: EstforConstants.AIR_SCROLL,
            num1: 3,
            inputTokenId2: EstforConstants.SHADOW_SCROLL,
            num2: 1,
            inputTokenId3: EstforConstants.NONE,
            num3: 0,
            outputTokenId: EstforConstants.NONE,
            outputNum: 0,
          },
        ]
      );

      const choiceIds = await getActionChoiceIds(tx);
      expect(choiceIds).to.eql([choiceId, choiceId + 1]);
      _queuedAction.choiceId = choiceId + 2;

      // Non-existent actionChoiceId
      await expect(players.connect(alice).startAction(playerId, _queuedAction, EstforTypes.ActionQueueStatus.NONE)).to
        .be.reverted;
      _queuedAction.choiceId = choiceId;
      await players.connect(alice).startAction(playerId, _queuedAction, EstforTypes.ActionQueueStatus.NONE);
    });
  });

  it("Guaranteed rewards", async () => {});

  // This test only works if the timespan does not go over 00:00 utc
  it("Random rewards (many)", async () => {
    const {playerId, players, itemNFT, world, alice, mockOracleClient} = await loadFixture(playersFixture);

    await itemNFT.addItem({
      ...EstforTypes.defaultInputItem,
      tokenId: EstforConstants.BRONZE_AXE,
      equipPosition: EstforTypes.EquipPosition.RIGHT_HAND,
      metadataURI: "someIPFSURI.json",
    });

    await itemNFT.addItem({
      ...EstforTypes.defaultInputItem,
      tokenId: EstforConstants.BRONZE_ARROW,
      equipPosition: EstforTypes.EquipPosition.ARROW_SATCHEL,
      metadataURI: "someIPFSURI.json",
    });

    const rate = 100 * 100; // per hour
    const randomChanceFraction = 50.0 / 100; // 50% chance
    const randomChance = Math.floor(65535 * randomChanceFraction);

    let tx = await world.addAction({
      actionId: 1,
      info: {
        skill: EstforTypes.Skill.WOODCUTTING,
        xpPerHour: 3600,
        minSkillPoints: 0,
        isDynamic: false,
        numSpawn: 0,
        handItemTokenIdRangeMin: EstforConstants.WOODCUTTING_BASE,
        handItemTokenIdRangeMax: EstforConstants.WOODCUTTING_MAX,
        isAvailable: actionIsAvailable,
        actionChoiceRequired: false,
      },
      guaranteedRewards: [{itemTokenId: EstforConstants.LOG, rate}],
      randomRewards: [{itemTokenId: EstforConstants.BRONZE_ARROW, rate: randomChance}],
      combatStats: EstforTypes.emptyCombatStats,
    });

    const actionId = await getActionId(tx);
    const numHours = 5;
    const queuedAction: EstforTypes.QueuedAction = {
      attire: EstforTypes.noAttire,
      actionId,
      combatStyle: EstforTypes.CombatStyle.NONE,
      choiceId: EstforConstants.NONE,
      choiceId1: EstforConstants.NONE,
      choiceId2: EstforConstants.NONE,
      regenerateId: EstforConstants.NONE,
      timespan: 3600 * numHours,
      rightHandEquipmentTokenId: EstforConstants.BRONZE_AXE,
      leftHandEquipmentTokenId: EstforConstants.NONE,
      startTime: "0",
      isValid: true,
    };

    let numProduced = 0;

    // Repeat the test a bunch of times to check the random rewards are as expected
    const numRepeats = 50;
    for (let i = 0; i < numRepeats; ++i) {
      await players.connect(alice).startAction(playerId, queuedAction, EstforTypes.ActionQueueStatus.NONE);
      let endTime;
      {
        const actionQueue = await players.getActionQueue(playerId);
        expect(actionQueue.length).to.eq(1);
        endTime = actionQueue[0].startTime + actionQueue[0].timespan;
      }

      expect(await world.hasSeed(endTime)).to.be.false;

      await ethers.provider.send("evm_increaseTime", [3600 * 24]);
      await players.connect(alice).processActions(playerId);
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.BRONZE_ARROW)).to.eq(numProduced);

      expect((await players.getPendingRandomRewards(playerId)).length).to.eq(1);

      const pendingOutput = await players.pendingRewards(alice.address, playerId, {
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
          await players.pendingRewards(alice.address, playerId, {
            includeLoot: false,
            includePastRandomRewards: true,
            includeXPRewards: false,
          })
        ).producedPastRandomRewards.length != 0
      ) {
        expect(
          (
            await players.pendingRewards(alice.address, playerId, {
              includeLoot: false,
              includePastRandomRewards: true,
              includeXPRewards: false,
            })
          ).producedPastRandomRewards.length
        ).to.eq(1);

        const produced = (
          await players.pendingRewards(alice.address, playerId, {
            includeLoot: false,
            includePastRandomRewards: true,
            includeXPRewards: false,
          })
        ).producedPastRandomRewards[0].amount;
        numProduced += produced;
        expect(
          (
            await players.pendingRewards(alice.address, playerId, {
              includeLoot: false,
              includePastRandomRewards: true,
              includeXPRewards: false,
            })
          ).producedPastRandomRewards[0].itemTokenId
        ).to.be.eq(EstforConstants.BRONZE_ARROW);
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
    const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);

    const monsterCombatStats: EstforTypes.CombatStats = {
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
        skill: EstforTypes.Skill.COMBAT,
        xpPerHour: 3600,
        minSkillPoints: 0,
        isDynamic: false,
        numSpawn: 1,
        handItemTokenIdRangeMin: EstforConstants.COMBAT_BASE,
        handItemTokenIdRangeMax: EstforConstants.COMBAT_MAX,
        isAvailable: actionIsAvailable,
        actionChoiceRequired: true,
      },
      guaranteedRewards: [{itemTokenId: EstforConstants.BRONZE_ARROW, rate}],
      randomRewards: [],
      combatStats: monsterCombatStats,
    });
    const actionId = await getActionId(tx);

    await itemNFT.testOnlyMint(alice.address, EstforConstants.BRONZE_SWORD, 1);
    await itemNFT.testOnlyMint(alice.address, EstforConstants.COOKED_MINNUS, 2);
    const timespan = 3600 * 3; // 3 hours
    tx = await world.addActionChoice(EstforConstants.NONE, 1, {
      ...emptyActionChoice,
      skill: EstforTypes.Skill.ATTACK,
    });
    const choiceId = await getActionChoiceId(tx);
    const queuedAction: EstforTypes.QueuedAction = {
      attire: EstforTypes.noAttire,
      actionId,
      combatStyle: EstforTypes.CombatStyle.MELEE,
      choiceId,
      choiceId1: EstforConstants.NONE,
      choiceId2: EstforConstants.NONE,
      regenerateId: EstforConstants.COOKED_MINNUS,
      timespan,
      rightHandEquipmentTokenId: EstforConstants.BRONZE_SWORD,
      leftHandEquipmentTokenId: EstforConstants.NONE,
      startTime: "0",
      isValid: true,
    };

    await itemNFT.addItem({
      ...EstforTypes.defaultInputItem,
      tokenId: EstforConstants.BRONZE_SWORD,
      equipPosition: EstforTypes.EquipPosition.RIGHT_HAND,
      metadataURI: "someIPFSURI.json",
    });

    await itemNFT.addItem({
      ...EstforTypes.defaultInputItem,
      tokenId: EstforConstants.BRONZE_ARROW,
      equipPosition: EstforTypes.EquipPosition.AUX,
      metadataURI: "someIPFSURI.json",
    });

    await itemNFT.addItem({
      ...EstforTypes.defaultInputItem,
      healthRestored: 1,
      tokenId: EstforConstants.COOKED_MINNUS,
      equipPosition: EstforTypes.EquipPosition.FOOD,
      metadataURI: "someIPFSURI.json",
    });

    await players.connect(alice).startAction(playerId, queuedAction, EstforTypes.ActionQueueStatus.NONE);

    await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]);
    await players.connect(alice).processActions(playerId);
    // Should die so doesn't get any attack skill points, and food should be consumed
    expect(await players.skillPoints(playerId, EstforTypes.Skill.ATTACK)).to.eq(0);
    expect(await itemNFT.balanceOf(alice.address, EstforConstants.BRONZE_ARROW)).to.eq(0);
    expect(await itemNFT.balanceOf(alice.address, EstforConstants.COOKED_MINNUS)).to.eq(0);
  });
});
