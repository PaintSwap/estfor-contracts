import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {EstforConstants, EstforTypes} from "@paintswap/estfor-definitions";
import {expect} from "chai";
import {ethers} from "hardhat";
import {
  bronzeHelmetStats,
  emptyActionChoice,
  getActionChoiceId,
  getActionChoiceIds,
  getActionId,
} from "../../scripts/utils";
import {playersFixture} from "./PlayersFixture";

const actionIsAvailable = true;

describe("Combat Actions", function () {
  this.retries(3);

  describe("Melee", async function () {
    async function playersFixtureMelee() {
      const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);

      const monsterCombatStats: EstforTypes.CombatStats = {
        melee: 1,
        magic: 0,
        range: 0,
        meleeDefence: 0,
        magicDefence: 0,
        rangeDefence: 0,
        health: 20,
      };

      const rate = 1 * 10; // per hour
      const numSpawned = 10;
      let tx = await world.addAction({
        actionId: 1,
        info: {
          skill: EstforTypes.Skill.COMBAT,
          xpPerHour: 3600,
          minXP: 0,
          isDynamic: false,
          numSpawned,
          handItemTokenIdRangeMin: EstforConstants.COMBAT_BASE,
          handItemTokenIdRangeMax: EstforConstants.COMBAT_MAX,
          isAvailable: actionIsAvailable,
          actionChoiceRequired: true,
          successPercent: 100,
        },
        guaranteedRewards: [{itemTokenId: EstforConstants.BRONZE_ARROW, rate}],
        randomRewards: [],
        combatStats: monsterCombatStats,
      });
      const actionId = await getActionId(tx);

      tx = await world.addActionChoice(EstforConstants.NONE, 1, {
        ...emptyActionChoice,
        skill: EstforTypes.Skill.MELEE,
      });
      const choiceId = await getActionChoiceId(tx);
      await itemNFT.testMint(alice.address, EstforConstants.BRONZE_SWORD, 1);
      await itemNFT.testMint(alice.address, EstforConstants.BRONZE_HELMET, 1);

      await itemNFT.testMint(alice.address, EstforConstants.COOKED_MINNUS, 255);
      const timespan = 3600;
      const queuedAction: EstforTypes.QueuedActionInput = {
        attire: {...EstforTypes.noAttire, head: EstforConstants.BRONZE_HELMET},
        actionId,
        combatStyle: EstforTypes.CombatStyle.ATTACK,
        choiceId,
        choiceId1: EstforConstants.NONE,
        choiceId2: EstforConstants.NONE,
        regenerateId: EstforConstants.COOKED_MINNUS,
        timespan,
        rightHandEquipmentTokenId: EstforConstants.BRONZE_SWORD,
        leftHandEquipmentTokenId: EstforConstants.NONE,
        skill: EstforTypes.Skill.COMBAT,
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
        combatStats: bronzeHelmetStats,
        tokenId: EstforConstants.BRONZE_HELMET,
        equipPosition: EstforTypes.EquipPosition.HEAD,
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
        numSpawned,
      };
    }

    it("Simple", async function () {
      const {playerId, players, itemNFT, alice, queuedAction, rate, numSpawned} = await loadFixture(
        playersFixtureMelee
      );

      await players.connect(alice).startAction(playerId, queuedAction, EstforTypes.ActionQueueStatus.NONE);

      const time = 3600;
      await ethers.provider.send("evm_increaseTime", [time]);
      await players.connect(alice).processActions(playerId);
      expect(await players.xp(playerId, EstforTypes.Skill.MELEE)).to.be.oneOf([time, time + 1]);
      expect(await players.xp(playerId, EstforTypes.Skill.HEALTH)).to.be.oneOf([
        Math.floor(time / 3) - 1,
        Math.floor(time / 3),
      ]); // Health should get 33% of the stats
      expect(await players.xp(playerId, EstforTypes.Skill.DEFENCE)).to.eq(0);

      // Check the drops are as expected
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.BRONZE_ARROW)).to.eq(
        Math.floor((time * rate * numSpawned) / (3600 * 10))
      );

      // Check food is consumed
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.COOKED_MINNUS)).to.eq(255 - 10);
      // Only no 0 id items produced
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.NONE)).to.eq(0);
    });

    it("No defence equipment", async function () {
      const {playerId, players, itemNFT, alice, queuedAction, rate, numSpawned} = await loadFixture(
        playersFixtureMelee
      );

      const _queuedAction = {...queuedAction};
      _queuedAction.attire = {...EstforTypes.noAttire};

      await players.connect(alice).startAction(playerId, _queuedAction, EstforTypes.ActionQueueStatus.NONE);

      const time = 3600;
      await ethers.provider.send("evm_increaseTime", [time]);
      await players.connect(alice).processActions(playerId);
      expect(await players.xp(playerId, EstforTypes.Skill.MELEE)).to.be.oneOf([time, time + 1]);
      expect(await players.xp(playerId, EstforTypes.Skill.HEALTH)).to.be.oneOf([
        Math.floor(time / 3) - 1,
        Math.floor(time / 3),
      ]); // Health should get 33% of the stats
      expect(await players.xp(playerId, EstforTypes.Skill.DEFENCE)).to.eq(0);

      // Check the drops are as expected
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.BRONZE_ARROW)).to.eq(
        Math.floor((time * rate * numSpawned) / (3600 * 10))
      );

      // Check food is consumed
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.COOKED_MINNUS)).to.eq(255 - 15);
    });

    it("Don't kill anything", async function () {
      const {playerId, players, itemNFT, alice, queuedAction} = await loadFixture(playersFixtureMelee);

      await players.connect(alice).startAction(playerId, queuedAction, EstforTypes.ActionQueueStatus.NONE);

      const time = 10;
      await ethers.provider.send("evm_increaseTime", [time]);
      await players.connect(alice).processActions(playerId);
      expect(await players.xp(playerId, EstforTypes.Skill.MELEE)).to.eq(0);

      // Check the drops are as expected
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.BRONZE_ARROW)).to.eq(0);
      // Check food is consumed
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.COOKED_MINNUS)).to.eq(255);
    });

    it("Melee defence", async function () {
      const {playerId, players, itemNFT, alice, queuedAction, rate, numSpawned} = await loadFixture(
        playersFixtureMelee
      );

      const _queuedAction = {...queuedAction};
      _queuedAction.combatStyle = EstforTypes.CombatStyle.DEFENCE;

      await players.connect(alice).startAction(playerId, _queuedAction, EstforTypes.ActionQueueStatus.NONE);

      const time = 3600;
      await ethers.provider.send("evm_increaseTime", [time]);
      await players.connect(alice).processActions(playerId);
      expect(await players.xp(playerId, EstforTypes.Skill.DEFENCE)).to.be.oneOf([time, time + 1]);
      expect(await players.xp(playerId, EstforTypes.Skill.MELEE)).to.eq(0);

      // Check the drops are as expected
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.BRONZE_ARROW)).to.eq(
        Math.floor((time * rate * numSpawned) / (3600 * 10))
      );

      // Check food is consumed, update later
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.COOKED_MINNUS)).to.eq(255 - 10);
    });

    it("Equip shield", async function () {
      const {playerId, players, itemNFT, alice, queuedAction, rate, numSpawned} = await loadFixture(
        playersFixtureMelee
      );

      const _queuedAction = {...queuedAction};
      _queuedAction.rightHandEquipmentTokenId = EstforConstants.BRONZE_SHIELD;

      await itemNFT.testMint(alice.address, EstforConstants.BRONZE_SHIELD, 1);

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
      expect(await players.xp(playerId, EstforTypes.Skill.MELEE)).to.oneOf([time, time + 1]);

      // Check the drops are as expected
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.BRONZE_ARROW)).to.eq(
        Math.floor((time * rate * numSpawned) / (3600 * 10))
      );

      // Check food is consumed, update later
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.COOKED_MINNUS)).to.eq(255 - 10);
    });
  });

  describe("Magic", function () {
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

      const dropRate = 1 * 10; // per hour
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
        guaranteedRewards: [{itemTokenId: EstforConstants.BRONZE_ARROW, rate: dropRate}],
        randomRewards: [],
        combatStats: monsterCombatStats,
      });
      const actionId = await getActionId(tx);

      await itemNFT.testMints(
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

      const scrollsConsumedRate = 1 * 10; // per hour
      // Combat uses none as it's not tied to a specific action (only combat ones)
      tx = await world.addActionChoice(EstforConstants.NONE, 1, {
        skill: EstforTypes.Skill.MAGIC,
        diff: 2,
        xpPerHour: 0,
        minXP: 0,
        rate: scrollsConsumedRate,
        inputTokenId1: EstforConstants.AIR_SCROLL,
        num1: 2,
        inputTokenId2: EstforConstants.SHADOW_SCROLL,
        num2: 1,
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
        combatStyle: EstforTypes.CombatStyle.ATTACK,
        choiceId,
        choiceId1: EstforConstants.NONE,
        choiceId2: EstforConstants.NONE,
        regenerateId: EstforConstants.COOKED_MINNUS,
        timespan,
        rightHandEquipmentTokenId: EstforConstants.TOTEM_STAFF,
        leftHandEquipmentTokenId: EstforConstants.NONE, // 2 handed, must specify this for both?
        skill: EstforTypes.Skill.COMBAT,
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

    it("Attack", async function () {
      const {playerId, players, itemNFT, alice, timespan, dropRate, queuedAction} = await loadFixture(
        playersFixtureMagic
      );

      await players.connect(alice).startAction(playerId, queuedAction, EstforTypes.ActionQueueStatus.NONE);

      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]);
      await players.connect(alice).processActions(playerId);
      expect(await players.xp(playerId, EstforTypes.Skill.MAGIC)).to.eq(queuedAction.timespan);
      expect(await players.xp(playerId, EstforTypes.Skill.DEFENCE)).to.eq(0);

      // Check the drops are as expected
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.BRONZE_ARROW)).to.eq(
        Math.floor((timespan * dropRate) / (3600 * 10))
      );

      // Check food is consumed, update later
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.COOKED_MINNUS)).to.eq(1000 - 45);

      // Check that scrolls are consumed
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.AIR_SCROLL)).to.eq(200 - 2);
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.SHADOW_SCROLL)).to.eq(100 - 1);
    });

    it("No staff equipped", async function () {
      const {playerId, players, itemNFT, alice, timespan, dropRate, queuedAction} = await loadFixture(
        playersFixtureMagic
      );

      const _queuedAction = {...queuedAction};
      _queuedAction.rightHandEquipmentTokenId = EstforConstants.NONE;

      await players.connect(alice).startAction(playerId, _queuedAction, EstforTypes.ActionQueueStatus.NONE);

      await ethers.provider.send("evm_increaseTime", [_queuedAction.timespan]);
      await players.connect(alice).processActions(playerId);
      expect(await players.xp(playerId, EstforTypes.Skill.MAGIC)).to.eq(_queuedAction.timespan);
      expect(await players.xp(playerId, EstforTypes.Skill.DEFENCE)).to.eq(0);

      // Check the drops are as expected
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.BRONZE_ARROW)).to.eq(
        Math.floor((timespan * dropRate) / (3600 * 10))
      );

      // Check food is consumed, update later
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.COOKED_MINNUS)).to.eq(1000 - 45);

      // Check that scrolls are consumed
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.AIR_SCROLL)).to.eq(200 - 2);
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.SHADOW_SCROLL)).to.eq(100 - 1);
    });

    it("Cannot equip shield with a staff", async function () {
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

    it("No scrolls equipped during processing action", async function () {
      const {playerId, players, itemNFT, alice, queuedAction} = await loadFixture(playersFixtureMagic);

      await players.connect(alice).startAction(playerId, queuedAction, EstforTypes.ActionQueueStatus.NONE);

      const balance = await itemNFT.balanceOf(alice.address, EstforConstants.AIR_SCROLL);
      await itemNFT.connect(alice).burn(alice.address, EstforConstants.AIR_SCROLL, balance);

      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]);
      await players.connect(alice).processActions(playerId);
      // Should get no XP
      expect(await players.xp(playerId, EstforTypes.Skill.MAGIC)).to.eq(0);
      expect(await players.xp(playerId, EstforTypes.Skill.DEFENCE)).to.eq(0);
      // Check food is consumed, update later
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.COOKED_MINNUS)).to.eq(1000 - 45);

      // Check that no scrolls are consumed
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.AIR_SCROLL)).to.eq(0);
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.SHADOW_SCROLL)).to.eq(100);
    });

    it("Add multi actionChoice", async function () {
      const {playerId, players, alice, world, queuedAction} = await loadFixture(playersFixtureMagic);

      const _queuedAction = {...queuedAction};
      const scrollsConsumedRate = 1 * 10; // per hour

      let choiceId = 2;
      const tx = await world.addBulkActionChoices(
        [EstforConstants.NONE],
        [[choiceId, choiceId + 1]],
        [
          [
            {
              skill: EstforTypes.Skill.MAGIC,
              diff: 2,
              xpPerHour: 0,
              minXP: 0,
              rate: scrollsConsumedRate,
              inputTokenId1: EstforConstants.AIR_SCROLL,
              num1: 1,
              inputTokenId2: EstforConstants.SHADOW_SCROLL,
              num2: 1,
              inputTokenId3: EstforConstants.NONE,
              num3: 0,
              outputTokenId: EstforConstants.NONE,
              outputNum: 0,
              successPercent: 100,
            },
            {
              skill: EstforTypes.Skill.MAGIC,
              diff: 2,
              xpPerHour: 0,
              minXP: 0,
              rate: scrollsConsumedRate,
              inputTokenId1: EstforConstants.AIR_SCROLL,
              num1: 3,
              inputTokenId2: EstforConstants.SHADOW_SCROLL,
              num2: 1,
              inputTokenId3: EstforConstants.NONE,
              num3: 0,
              outputTokenId: EstforConstants.NONE,
              outputNum: 0,
              successPercent: 100,
            },
          ],
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

    it("Use too much food", async function () {
      const {playerId, players, alice, world, queuedAction, itemNFT} = await loadFixture(playersFixtureMagic);

      const monsterCombatStats: EstforTypes.CombatStats = {
        melee: 10000,
        magic: 0,
        range: 0,
        meleeDefence: 0,
        magicDefence: 0,
        rangeDefence: 0,
        health: 5,
      };

      const dropRate = 1 * 10; // per hour
      await world.addAction({
        actionId: 2,
        info: {
          skill: EstforTypes.Skill.COMBAT,
          xpPerHour: 3600,
          minXP: 0,
          isDynamic: false,
          numSpawned: 100,
          handItemTokenIdRangeMin: EstforConstants.COMBAT_BASE,
          handItemTokenIdRangeMax: EstforConstants.COMBAT_MAX,
          isAvailable: actionIsAvailable,
          actionChoiceRequired: true,
          successPercent: 100,
        },
        guaranteedRewards: [{itemTokenId: EstforConstants.BRONZE_ARROW, rate: dropRate}],
        randomRewards: [],
        combatStats: monsterCombatStats,
      });

      const _queuedAction = {...queuedAction};
      _queuedAction.actionId = 2;

      // Exceed 2^16
      await itemNFT.testMint(alice.address, EstforConstants.COOKED_MINNUS, 70000);
      const foodBalance = await itemNFT.balanceOf(alice.address, EstforConstants.COOKED_MINNUS);

      await players.connect(alice).startAction(playerId, _queuedAction, EstforTypes.ActionQueueStatus.NONE);

      await ethers.provider.send("evm_increaseTime", [_queuedAction.timespan]);
      await players.connect(alice).processActions(playerId);
      // Died
      expect(await players.xp(playerId, EstforTypes.Skill.MAGIC)).to.eq(0);
      expect(await players.xp(playerId, EstforTypes.Skill.DEFENCE)).to.eq(0);
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.COOKED_MINNUS)).to.eq(
        foodBalance.sub(Math.pow(2, 16) - 1)
      );
    });
  });

  it("Dead", async function () {
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

    const rate = 1 * 10; // per hour
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
      guaranteedRewards: [{itemTokenId: EstforConstants.BRONZE_ARROW, rate}],
      randomRewards: [],
      combatStats: monsterCombatStats,
    });
    const actionId = await getActionId(tx);

    await itemNFT.testMint(alice.address, EstforConstants.BRONZE_SWORD, 1);
    await itemNFT.testMint(alice.address, EstforConstants.COOKED_MINNUS, 2);
    const timespan = 3600 * 3; // 3 hours
    tx = await world.addActionChoice(EstforConstants.NONE, 1, {
      ...emptyActionChoice,
      skill: EstforTypes.Skill.MELEE,
    });
    const choiceId = await getActionChoiceId(tx);
    const queuedAction: EstforTypes.QueuedActionInput = {
      attire: EstforTypes.noAttire,
      actionId,
      combatStyle: EstforTypes.CombatStyle.ATTACK,
      choiceId,
      choiceId1: EstforConstants.NONE,
      choiceId2: EstforConstants.NONE,
      regenerateId: EstforConstants.COOKED_MINNUS,
      timespan,
      rightHandEquipmentTokenId: EstforConstants.BRONZE_SWORD,
      leftHandEquipmentTokenId: EstforConstants.NONE,
      skill: EstforTypes.Skill.COMBAT,
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
    expect(await players.xp(playerId, EstforTypes.Skill.MELEE)).to.eq(0);
    expect(await itemNFT.balanceOf(alice.address, EstforConstants.BRONZE_ARROW)).to.eq(0);
    expect(await itemNFT.balanceOf(alice.address, EstforConstants.COOKED_MINNUS)).to.eq(0);
  });
});
