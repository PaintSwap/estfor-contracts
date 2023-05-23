import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {EstforConstants, EstforTypes} from "@paintswap/estfor-definitions";
import {COOKED_MINNUS, QUEST_SUPPLY_RUN} from "@paintswap/estfor-definitions/constants";
import {Skill} from "@paintswap/estfor-definitions/types";
import {expect} from "chai";
import {BigNumber} from "ethers";
import {ethers} from "hardhat";
import {AvatarInfo, createPlayer} from "../../scripts/utils";
import {
  emptyActionChoice,
  getActionChoiceId,
  getActionChoiceIds,
  getActionId,
  getRequestId,
  GUAR_MUL,
  RATE_MUL,
  SPAWN_MUL,
  START_XP,
} from "../utils";
import {playersFixture} from "./PlayersFixture";
import {setupBasicMeleeCombat} from "./utils";
import {allActions} from "../../scripts/data/actions";
import {Quest, allQuests, defaultMinRequirements} from "../../scripts/data/quests";

const actionIsAvailable = true;

describe("Combat Actions", function () {
  this.retries(3);

  describe("Melee", async function () {
    async function playersFixtureMelee() {
      const fixture = await loadFixture(playersFixture);
      const {itemNFT, world} = fixture;

      const {queuedAction, rate, numSpawned, choiceId} = await setupBasicMeleeCombat(itemNFT, world);

      return {
        ...fixture,
        itemNFT,
        queuedAction,
        rate,
        numSpawned,
        world,
        choiceId,
      };
    }

    it("Attack", async function () {
      const {playerId, players, itemNFT, alice, queuedAction, rate, numSpawned} = await loadFixture(
        playersFixtureMelee
      );

      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStatus.NONE);

      const time = 3600;
      await ethers.provider.send("evm_increaseTime", [time]);
      await players.connect(alice).processActions(playerId);
      expect(await players.xp(playerId, EstforTypes.Skill.MELEE)).to.be.deep.oneOf([
        BigNumber.from(time),
        BigNumber.from(time + 1),
      ]);
      expect(await players.xp(playerId, EstforTypes.Skill.HEALTH)).to.be.deep.oneOf([
        BigNumber.from(Math.floor(time / 3) - 1),
        BigNumber.from(Math.floor(time / 3)),
      ]); // Health should get 33% of the stats
      expect(await players.xp(playerId, EstforTypes.Skill.DEFENCE)).to.eq(0);

      // Check the drops are as expected
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.BRONZE_ARROW)).to.eq(
        Math.floor((time * rate * numSpawned) / (3600 * GUAR_MUL * SPAWN_MUL))
      );

      // Check food is consumed
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.COOKED_MINNUS)).to.eq(255 - 1);
      // Only no 0 id items produced
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.NONE)).to.eq(0);
    });

    it("In-progress combat updates (many)", async function () {
      const {playerId, players, itemNFT, alice, queuedAction, rate, numSpawned} = await loadFixture(
        playersFixtureMelee
      );

      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStatus.NONE);

      const numLoops = queuedAction.timespan / 240;
      expect(numLoops).to.not.eq(0);

      for (let i = 0; i < numLoops; ++i) {
        // Increase by random time
        const randomTimespan = Math.floor(Math.random() * 240);
        await ethers.provider.send("evm_increaseTime", [randomTimespan]);
        await players.connect(alice).processActions(playerId);
      }

      const healthXP = await players.xp(playerId, EstforTypes.Skill.HEALTH);
      // Check that some are used at least before completing the action
      expect(healthXP).to.not.eq(0);
      // Check the drops are as expected
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.BRONZE_ARROW)).to.be.gt(0);
      // Check food is consumed
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.COOKED_MINNUS)).to.be.lt(255);

      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]); // This makes sure everything is used
      await players.connect(alice).processActions(playerId);
      expect(await players.xp(playerId, EstforTypes.Skill.MELEE)).to.eq(queuedAction.timespan);
      expect(await players.xp(playerId, EstforTypes.Skill.HEALTH)).to.be.deep.oneOf([
        BigNumber.from(Math.floor(queuedAction.timespan / 3) - 1),
        BigNumber.from(Math.floor(queuedAction.timespan / 3)),
      ]); // Health should get 33% of the stats
      expect(healthXP).to.not.be.deep.oneOf([
        BigNumber.from(Math.floor(queuedAction.timespan / 3) - 1),
        BigNumber.from(Math.floor(queuedAction.timespan / 3)),
      ]);
      // Check the drops are as expected
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.BRONZE_ARROW)).to.eq(
        Math.floor((queuedAction.timespan * rate * numSpawned) / (3600 * GUAR_MUL * SPAWN_MUL))
      );
      // Check food is consumed
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.COOKED_MINNUS)).to.eq(255 - 1);
    });

    it("No defence equipment", async function () {
      const {
        playerId,
        players,
        itemNFT,
        alice,
        queuedAction: meleeQueuedAction,
        rate,
        numSpawned,
      } = await loadFixture(playersFixtureMelee);

      const queuedAction = {...meleeQueuedAction};
      queuedAction.attire = {...EstforTypes.noAttire};

      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStatus.NONE);

      const time = 3600;
      await ethers.provider.send("evm_increaseTime", [time]);
      await players.connect(alice).processActions(playerId);
      expect(await players.xp(playerId, EstforTypes.Skill.MELEE)).to.be.deep.oneOf([
        BigNumber.from(time),
        BigNumber.from(time + 1),
      ]);
      expect(await players.xp(playerId, EstforTypes.Skill.HEALTH)).to.be.deep.oneOf([
        BigNumber.from(Math.floor(time / 3) - 1),
        BigNumber.from(Math.floor(time / 3)),
      ]); // Health should get 33% of the stats
      expect(await players.xp(playerId, EstforTypes.Skill.DEFENCE)).to.eq(0);

      // Check the drops are as expected
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.BRONZE_ARROW)).to.eq(
        Math.floor((time * rate * numSpawned) / (3600 * GUAR_MUL * SPAWN_MUL))
      );

      // Check food is consumed
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.COOKED_MINNUS)).to.eq(255 - 2);
    });

    it("Don't kill anything", async function () {
      const {playerId, players, itemNFT, alice, queuedAction} = await loadFixture(playersFixtureMelee);

      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStatus.NONE);

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
      const {
        playerId,
        players,
        itemNFT,
        alice,
        queuedAction: meleeQueuedAction,
        rate,
        numSpawned,
      } = await loadFixture(playersFixtureMelee);

      const queuedAction = {...meleeQueuedAction};
      queuedAction.combatStyle = EstforTypes.CombatStyle.DEFENCE;

      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStatus.NONE);

      const time = 3600;
      await ethers.provider.send("evm_increaseTime", [time]);
      await players.connect(alice).processActions(playerId);
      expect(await players.xp(playerId, EstforTypes.Skill.DEFENCE)).to.be.deep.oneOf([
        BigNumber.from(time),
        BigNumber.from(time + 1),
      ]);
      expect(await players.xp(playerId, EstforTypes.Skill.MELEE)).to.eq(0);

      // Check the drops are as expected
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.BRONZE_ARROW)).to.eq(
        Math.floor((time * rate * numSpawned) / (3600 * GUAR_MUL * SPAWN_MUL))
      );

      // Check food is consumed
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.COOKED_MINNUS)).to.eq(255 - 1);
    });

    it("Equip shield", async function () {
      const {
        playerId,
        players,
        itemNFT,
        alice,
        queuedAction: meleeQueuedAction,
        rate,
        numSpawned,
      } = await loadFixture(playersFixtureMelee);

      const queuedAction = {...meleeQueuedAction};
      queuedAction.rightHandEquipmentTokenId = EstforConstants.BRONZE_SHIELD;

      await itemNFT.testMint(alice.address, EstforConstants.BRONZE_SHIELD, 1);

      await expect(
        players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStatus.NONE)
      ).to.be.revertedWithCustomError(itemNFT, "ItemDoesNotExist");

      await itemNFT.addItem({
        ...EstforTypes.defaultInputItem,
        tokenId: EstforConstants.BRONZE_SHIELD,
        equipPosition: EstforTypes.EquipPosition.LEFT_HAND,
      });

      await expect(
        players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStatus.NONE)
      ).to.be.revertedWithCustomError(players, "IncorrectRightHandEquipment");

      queuedAction.rightHandEquipmentTokenId = EstforConstants.BRONZE_SWORD;
      queuedAction.leftHandEquipmentTokenId = EstforConstants.BRONZE_SHIELD;

      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStatus.NONE);

      const time = 3600;
      await ethers.provider.send("evm_increaseTime", [time]);

      await players.connect(alice).processActions(playerId);
      expect(await players.xp(playerId, EstforTypes.Skill.MELEE)).to.deep.oneOf([
        BigNumber.from(time),
        BigNumber.from(time + 1),
      ]);

      // Check the drops are as expected
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.BRONZE_ARROW)).to.eq(
        Math.floor((time * rate * numSpawned) / (3600 * GUAR_MUL * SPAWN_MUL))
      );

      // Check food is consumed
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.COOKED_MINNUS)).to.eq(255 - 1);
    });

    it("Check multi-loot drops", async function () {
      // TODO:
      // Check they are as expected if killing a few
    });

    it("Fight powerful boss", async function () {
      const {
        playerId,
        players,
        itemNFT,
        alice,
        queuedAction: meleeQueuedAction,
        world,
      } = await loadFixture(playersFixtureMelee);

      const monsterCombatStats: EstforTypes.CombatStats = {
        melee: 80,
        magic: 80,
        range: 80,
        meleeDefence: 80,
        magicDefence: 80,
        rangeDefence: 80,
        health: 1200,
      };

      const numSpawned = 10 * SPAWN_MUL;
      let tx = await world.addAction({
        actionId: 2,
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
        guaranteedRewards: [],
        randomRewards: [],
        combatStats: monsterCombatStats,
      });
      const actionId = await getActionId(tx);

      const queuedAction = {...meleeQueuedAction};
      queuedAction.actionId = actionId;
      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStatus.NONE);

      const time = 3600;
      await ethers.provider.send("evm_increaseTime", [time]);
      await ethers.provider.send("evm_mine", []);

      let pendingQueuedActionState = await players.pendingQueuedActionState(alice.address, playerId);
      expect(pendingQueuedActionState.equipmentStates[0].consumedItemTokenIds.length).to.eq(1);
      expect(pendingQueuedActionState.equipmentStates[0].consumedItemTokenIds[0]).to.eq(EstforConstants.COOKED_MINNUS);
      expect(pendingQueuedActionState.equipmentStates[0].consumedAmounts[0]).to.eq(255);

      expect(await itemNFT.balanceOf(alice.address, EstforConstants.COOKED_MINNUS)).to.eq(255);
      await players.connect(alice).processActions(playerId);
      expect(await players.xp(playerId, EstforTypes.Skill.MELEE)).to.eq(0);

      // Check food is consumed
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.COOKED_MINNUS)).to.eq(0);
    });

    it("Multi-hour respawn time, can kill all", async function () {
      const {playerId, players, alice, queuedAction: meleeQueuedAction, world} = await loadFixture(playersFixtureMelee);

      const monsterCombatStats: EstforTypes.CombatStats = {
        melee: 10,
        magic: 0,
        range: 0,
        meleeDefence: 10,
        magicDefence: 0,
        rangeDefence: 0,
        health: 70,
      };

      const numSpawned = 0.5 * SPAWN_MUL; // 1 every 2 hours
      let tx = await world.addAction({
        actionId: 2,
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
        guaranteedRewards: [],
        randomRewards: [],
        combatStats: monsterCombatStats,
      });
      const actionId = await getActionId(tx);

      const queuedAction = {...meleeQueuedAction};
      queuedAction.actionId = actionId;
      queuedAction.timespan = 7200;
      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStatus.NONE);

      const time = 3600;
      await ethers.provider.send("evm_increaseTime", [time]);
      await ethers.provider.send("evm_mine", []);

      let pendingQueuedActionState = await players.pendingQueuedActionState(alice.address, playerId);
      expect(pendingQueuedActionState.equipmentStates[0].consumedItemTokenIds.length).to.eq(0);
      expect(pendingQueuedActionState.actionMetadatas[0].xpGained).to.eq(0); // Haven't killed any yet
      await players.connect(alice).processActions(playerId);
      await ethers.provider.send("evm_increaseTime", [time]);
      await ethers.provider.send("evm_mine", []);
      pendingQueuedActionState = await players.pendingQueuedActionState(alice.address, playerId);
      expect(pendingQueuedActionState.equipmentStates[0].consumedItemTokenIds.length).to.eq(1);
      expect(pendingQueuedActionState.equipmentStates[0].consumedAmounts[0]).to.eq(14);
      expect(pendingQueuedActionState.actionMetadatas[0].xpGained).to.eq(7200 + 7200 / 3); // Killed 1
    });

    it("Multi-hour respawn time, cannot kill", async function () {
      const {playerId, players, alice, queuedAction: meleeQueuedAction, world} = await loadFixture(playersFixtureMelee);

      const monsterCombatStats: EstforTypes.CombatStats = {
        melee: 1,
        magic: 0,
        range: 0,
        meleeDefence: 80,
        magicDefence: 0,
        rangeDefence: 0,
        health: 32000,
      };

      const numSpawned = 0.5 * SPAWN_MUL; // 1 every 2 hours
      let tx = await world.addAction({
        actionId: 2,
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
        guaranteedRewards: [],
        randomRewards: [],
        combatStats: monsterCombatStats,
      });
      const actionId = await getActionId(tx);

      const queuedAction = {...meleeQueuedAction};
      queuedAction.actionId = actionId;
      queuedAction.timespan = 7200;
      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStatus.NONE);

      const time = 3600;
      await ethers.provider.send("evm_increaseTime", [time]);
      await ethers.provider.send("evm_mine", []);

      let pendingQueuedActionState = await players.pendingQueuedActionState(alice.address, playerId);
      expect(pendingQueuedActionState.equipmentStates[0].consumedItemTokenIds.length).to.eq(1);
      expect(pendingQueuedActionState.actionMetadatas[0].xpGained).to.eq(0); // Haven't killed any yet
      await players.connect(alice).processActions(playerId);
      await ethers.provider.send("evm_increaseTime", [time]);
      await ethers.provider.send("evm_mine", []);
      pendingQueuedActionState = await players.pendingQueuedActionState(alice.address, playerId);
      expect(pendingQueuedActionState.equipmentStates[0].consumedItemTokenIds.length).to.eq(1);
      expect(pendingQueuedActionState.equipmentStates[0].consumedAmounts[0]).to.eq(5);
      expect(pendingQueuedActionState.actionMetadatas[0].xpGained).to.eq(0); // Killed none
    });

    it("Use too much food", async function () {
      // Check same food is used
      const {
        playerId,
        players,
        alice,
        queuedAction: meleeQueuedAction,
        world,
        itemNFT,
      } = await loadFixture(playersFixtureMelee);
      const monsterCombatStats: EstforTypes.CombatStats = {
        melee: 15000,
        magic: 0,
        range: 0,
        meleeDefence: 0,
        magicDefence: 0,
        rangeDefence: 0,
        health: 5,
      };

      const dropRate = 1 * GUAR_MUL; // per hour
      await world.addAction({
        actionId: 2,
        info: {
          skill: EstforTypes.Skill.COMBAT,
          xpPerHour: 3600,
          minXP: 0,
          isDynamic: false,
          numSpawned: 100 * SPAWN_MUL,
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

      const queuedAction = {...meleeQueuedAction};
      queuedAction.actionId = 2;

      // Exceed 2^16
      await itemNFT.testMint(alice.address, EstforConstants.COOKED_MINNUS, 70000); // Have 255 from before too;
      const foodBalance = await itemNFT.balanceOf(alice.address, EstforConstants.COOKED_MINNUS);

      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStatus.NONE);
      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]);
      await players.connect(alice).processActions(playerId);

      // Should have died. You still get XP for the ones you killed while processing.it  He could kill
      expect(await players.xp(playerId, EstforTypes.Skill.MELEE)).to.eq(2484); // Killed 67
      expect(await players.xp(playerId, EstforTypes.Skill.DEFENCE)).to.eq(0);
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.BRONZE_ARROW)).to.eq(69);
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.COOKED_MINNUS)).to.eq(
        foodBalance.sub(Math.pow(2, 16) - 1)
      );
    });

    it("Use too much food (split over same action)", async function () {
      const {
        playerId,
        players,
        alice,
        queuedAction: meleeQueuedAction,
        world,
        itemNFT,
      } = await loadFixture(playersFixtureMelee);
      const monsterCombatStats: EstforTypes.CombatStats = {
        melee: 15000,
        magic: 0,
        range: 0,
        meleeDefence: 0,
        magicDefence: 0,
        rangeDefence: 0,
        health: 5,
      };

      const dropRate = 1 * GUAR_MUL; // per hour
      await world.addAction({
        actionId: 2,
        info: {
          skill: EstforTypes.Skill.COMBAT,
          xpPerHour: 3600,
          minXP: 0,
          isDynamic: false,
          numSpawned: 100 * SPAWN_MUL,
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

      const queuedAction = {...meleeQueuedAction};
      queuedAction.actionId = 2;

      // Exceed 2^16
      await itemNFT.testMint(alice.address, EstforConstants.COOKED_MINNUS, 70000); // Have 255 from before too;
      const foodBalance = await itemNFT.balanceOf(alice.address, EstforConstants.COOKED_MINNUS);

      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStatus.NONE);

      // Food should be used each time until it is all used up
      let beforeBal = await itemNFT.balanceOf(alice.address, EstforConstants.COOKED_MINNUS);
      for (let i = 0; i < 36; ++i) {
        await ethers.provider.send("evm_increaseTime", [queuedAction.timespan / 36]);
        await ethers.provider.send("evm_mine", []);
        await players.connect(alice).processActions(playerId);
        const newBalance = await itemNFT.balanceOf(alice.address, EstforConstants.COOKED_MINNUS);
        expect(beforeBal).to.satisfy((num: BigNumber) => {
          return num.gt(newBalance) || num.eq(foodBalance.sub(65535));
        });
        beforeBal = newBalance;
      }

      // Should have died. You still get XP for the ones you killed while processing.it  He could kill
      expect(await players.xp(playerId, EstforTypes.Skill.MELEE)).to.eq(2484); // Killed 69
      expect(await players.xp(playerId, EstforTypes.Skill.DEFENCE)).to.eq(0);
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.BRONZE_ARROW)).to.eq(69);
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.COOKED_MINNUS)).to.eq(
        foodBalance.sub(Math.pow(2, 16) - 1)
      );
    });

    // Fix for user issue Snarf
    it("Take into account defence quest XP reward", async function () {
      const {playerId, players, alice, world, itemNFT, choiceId, quests} = await loadFixture(playersFixtureMelee);

      await itemNFT.addItem({
        ...EstforTypes.defaultInputItem,
        healthRestored: 2,
        tokenId: EstforConstants.COOKED_BLEKK,
        equipPosition: EstforTypes.EquipPosition.FOOD,
      });

      const natuowAction = allActions.find(
        (a) => a.actionId === EstforConstants.ACTION_COMBAT_NATUOW
      ) as EstforTypes.ActionInput;
      await world.addAction(natuowAction);

      const grogAction = allActions.find(
        (a) => a.actionId === EstforConstants.ACTION_COMBAT_GROG_TOAD
      ) as EstforTypes.ActionInput;
      await world.addAction(grogAction);

      await itemNFT.testMint(alice.address, EstforConstants.COOKED_BLEKK, 10000);

      const queuedAction: EstforTypes.QueuedActionInput = {
        attire: EstforTypes.noAttire,
        actionId: EstforConstants.ACTION_COMBAT_NATUOW,
        combatStyle: EstforTypes.CombatStyle.ATTACK,
        choiceId,
        regenerateId: EstforConstants.COOKED_BLEKK,
        timespan: 86400,
        rightHandEquipmentTokenId: EstforConstants.BRONZE_SWORD,
        leftHandEquipmentTokenId: EstforConstants.NONE,
      };

      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStatus.NONE);
      await ethers.provider.send("evm_increaseTime", [5518]);
      await players.connect(alice).processActions(playerId);

      await ethers.provider.send("evm_increaseTime", [27869]);

      const boostValue = 10;
      const boostDuration = 86400;
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
      await itemNFT.testMint(alice.address, EstforConstants.XP_BOOST, 1);
      await ethers.provider.send("evm_increaseTime", [120]);
      await players
        .connect(alice)
        .startActionsExtra(
          playerId,
          [],
          EstforConstants.XP_BOOST,
          0,
          EstforTypes.ActionQueueStatus.KEEP_LAST_IN_PROGRESS
        );
      await ethers.provider.send("evm_increaseTime", [240]);

      const queuedActionGrog: EstforTypes.QueuedActionInput = {
        attire: EstforTypes.noAttire,
        actionId: EstforConstants.ACTION_COMBAT_GROG_TOAD,
        combatStyle: EstforTypes.CombatStyle.DEFENCE,
        choiceId,
        regenerateId: EstforConstants.COOKED_BLEKK,
        timespan: 32400,
        rightHandEquipmentTokenId: EstforConstants.BRONZE_SWORD,
        leftHandEquipmentTokenId: EstforConstants.NONE,
      };

      // Activate a quest
      const quest1 = allQuests.find((q) => q.questId === QUEST_SUPPLY_RUN) as Quest;
      const quest = {
        ...quest1,
        actionId1: queuedAction.actionId,
        actionNum1: 5,
        burnItemTokenId: EstforConstants.NATUOW_HIDE,
        burnAmount: 5,
      };
      await quests.addQuests([quest], [false], [defaultMinRequirements]);
      const questId = quest.questId;
      await players.connect(alice).activateQuest(playerId, questId);

      await players
        .connect(alice)
        .startActions(playerId, [queuedActionGrog], EstforTypes.ActionQueueStatus.KEEP_LAST_IN_PROGRESS);
      await ethers.provider.send("evm_increaseTime", [41700]);

      await players.connect(alice).processActions(playerId);

      expect(await players.xp(playerId, EstforTypes.Skill.DEFENCE)).to.eq(250);

      let player = await players.players(playerId);
      expect(player.currentActionProcessedSkill1).to.eq(Skill.MELEE);
      expect(player.currentActionProcessedXPGained1).to.eq(1145);
      expect(player.currentActionProcessedSkill2).to.eq(Skill.HEALTH);
      expect(player.currentActionProcessedXPGained2).to.eq(381);
      expect(player.currentActionProcessedSkill3).to.eq(Skill.DEFENCE);
      expect(player.currentActionProcessedXPGained3).to.eq(250);
      expect(player.currentActionProcessedFoodConsumed).to.eq(1257);
      expect(player.currentActionProcessedBaseInputItemsConsumedNum).to.eq(0);

      // Before it would fail here
      await players.connect(alice).processActions(playerId);
    });

    it("currentActionProcessedSkill for all 1/2/3", async function () {
      const {playerId, players, alice, world, itemNFT, choiceId, quests} = await loadFixture(playersFixtureMelee);

      await itemNFT.addItem({
        ...EstforTypes.defaultInputItem,
        healthRestored: 2,
        tokenId: EstforConstants.COOKED_BLEKK,
        equipPosition: EstforTypes.EquipPosition.FOOD,
      });

      const natuowAction = allActions.find(
        (a) => a.actionId === EstforConstants.ACTION_COMBAT_NATUOW
      ) as EstforTypes.ActionInput;
      await world.addAction(natuowAction);

      const grogAction = allActions.find(
        (a) => a.actionId === EstforConstants.ACTION_COMBAT_GROG_TOAD
      ) as EstforTypes.ActionInput;
      await world.addAction(grogAction);

      await itemNFT.testMint(alice.address, EstforConstants.COOKED_BLEKK, 10000);

      const queuedAction: EstforTypes.QueuedActionInput = {
        attire: EstforTypes.noAttire,
        actionId: EstforConstants.ACTION_COMBAT_NATUOW,
        combatStyle: EstforTypes.CombatStyle.ATTACK,
        choiceId,
        regenerateId: EstforConstants.COOKED_BLEKK,
        timespan: 86400,
        rightHandEquipmentTokenId: EstforConstants.BRONZE_SWORD,
        leftHandEquipmentTokenId: EstforConstants.NONE,
      };

      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStatus.NONE);
      await ethers.provider.send("evm_increaseTime", [5518]);
      await players.connect(alice).processActions(playerId);

      await ethers.provider.send("evm_increaseTime", [27869]);

      const boostValue = 10;
      const boostDuration = 86400;
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
      await itemNFT.testMint(alice.address, EstforConstants.XP_BOOST, 1);
      await ethers.provider.send("evm_increaseTime", [120]);
      await players
        .connect(alice)
        .startActionsExtra(
          playerId,
          [],
          EstforConstants.XP_BOOST,
          0,
          EstforTypes.ActionQueueStatus.KEEP_LAST_IN_PROGRESS
        );
      await ethers.provider.send("evm_increaseTime", [240]);

      const queuedActionGrog: EstforTypes.QueuedActionInput = {
        attire: EstforTypes.noAttire,
        actionId: EstforConstants.ACTION_COMBAT_GROG_TOAD,
        combatStyle: EstforTypes.CombatStyle.DEFENCE,
        choiceId,
        regenerateId: EstforConstants.COOKED_BLEKK,
        timespan: 32400,
        rightHandEquipmentTokenId: EstforConstants.BRONZE_SWORD,
        leftHandEquipmentTokenId: EstforConstants.NONE,
      };

      // Activate a quest
      const _quest = allQuests.find((q) => q.questId === QUEST_SUPPLY_RUN) as Quest;
      const quest = {
        ..._quest,
        actionId1: queuedAction.actionId,
        actionNum1: 5,
        burnItemTokenId: EstforConstants.NATUOW_HIDE,
        burnAmount: 5,
      };
      const questMelee = {
        ...quest,
        skillReward: Skill.MELEE,
        questId: QUEST_SUPPLY_RUN + 1,
      };
      const questHealth = {
        ...quest,
        skillReward: Skill.HEALTH,
        questId: QUEST_SUPPLY_RUN + 2,
      };
      const questMagic = {
        ...quest,
        skillReward: Skill.MAGIC,
        questId: QUEST_SUPPLY_RUN + 3,
      };
      const questWoodcutting = {
        ...quest,
        skillReward: Skill.WOODCUTTING,
        questId: QUEST_SUPPLY_RUN + 4,
      };
      await quests.addQuests(
        [quest, questMelee, questMagic, questWoodcutting, questHealth],
        [false, false, false, false, false],
        [
          defaultMinRequirements,
          defaultMinRequirements,
          defaultMinRequirements,
          defaultMinRequirements,
          defaultMinRequirements,
        ]
      );
      const questId = quest.questId;
      await players.connect(alice).activateQuest(playerId, questId);

      await players
        .connect(alice)
        .startActions(playerId, [queuedActionGrog], EstforTypes.ActionQueueStatus.KEEP_LAST_IN_PROGRESS);

      await ethers.provider.send("evm_increaseTime", [8000]);
      await players.connect(alice).activateQuest(playerId, questId + 1);
      await ethers.provider.send("evm_increaseTime", [8000]);
      await players.connect(alice).activateQuest(playerId, questId + 2);
      await ethers.provider.send("evm_increaseTime", [8000]);
      await players.connect(alice).activateQuest(playerId, questId + 3);
      await ethers.provider.send("evm_increaseTime", [8000]);
      await players.connect(alice).activateQuest(playerId, questId + 4);
      await ethers.provider.send("evm_increaseTime", [9700]); // So that it totals 41700 like the other test
      await players.connect(alice).processActions(playerId);

      expect(await players.xp(playerId, EstforTypes.Skill.DEFENCE)).to.eq(250);
      expect(await players.xp(playerId, EstforTypes.Skill.MAGIC)).to.eq(START_XP + 250);
      expect(await players.xp(playerId, EstforTypes.Skill.WOODCUTTING)).to.eq(250);
      expect(await players.xp(playerId, EstforTypes.Skill.MELEE)).to.eq(1145 + 250);
      expect(await players.xp(playerId, EstforTypes.Skill.HEALTH)).to.eq(381 + 250);

      let player = await players.players(playerId);
      expect(player.currentActionProcessedSkill1).to.eq(Skill.MELEE);
      expect(player.currentActionProcessedXPGained1).to.eq(1145 + 250);
      expect(player.currentActionProcessedSkill2).to.eq(Skill.HEALTH);
      expect(player.currentActionProcessedXPGained2).to.eq(381 + 250);
      expect(player.currentActionProcessedSkill3).to.eq(Skill.DEFENCE);
      expect(player.currentActionProcessedXPGained3).to.eq(250);
      expect(player.currentActionProcessedFoodConsumed).to.eq(1257);
      expect(player.currentActionProcessedBaseInputItemsConsumedNum).to.eq(0);

      await players.connect(alice).processActions(playerId);
    });

    it("clearEverything", async function () {
      const {playerId, players, alice, world, itemNFT, choiceId, quests} = await loadFixture(playersFixtureMelee);

      await itemNFT.addItem({
        ...EstforTypes.defaultInputItem,
        healthRestored: 2,
        tokenId: EstforConstants.COOKED_BLEKK,
        equipPosition: EstforTypes.EquipPosition.FOOD,
      });

      const natuowAction = allActions.find(
        (a) => a.actionId === EstforConstants.ACTION_COMBAT_NATUOW
      ) as EstforTypes.ActionInput;
      await world.addAction(natuowAction);

      await itemNFT.testMint(alice.address, EstforConstants.COOKED_BLEKK, 10000);

      const queuedAction: EstforTypes.QueuedActionInput = {
        attire: EstforTypes.noAttire,
        actionId: EstforConstants.ACTION_COMBAT_NATUOW,
        combatStyle: EstforTypes.CombatStyle.ATTACK,
        choiceId,
        regenerateId: EstforConstants.COOKED_BLEKK,
        timespan: 86400,
        rightHandEquipmentTokenId: EstforConstants.BRONZE_SWORD,
        leftHandEquipmentTokenId: EstforConstants.NONE,
      };

      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStatus.NONE);
      await ethers.provider.send("evm_increaseTime", [73318]);
      await players.connect(alice).processActions(playerId);
      await players.testModifyXP(alice.address, playerId, EstforTypes.Skill.DEFENCE, 250, true);
      await ethers.provider.send("evm_increaseTime", [240]);
      await expect(players.connect(alice).clearEverything(playerId)).to.not.be.reverted;
      expect((await players.getActionQueue(playerId)).length).to.eq(0);
    });

    it("Check random rewards", async function () {
      const {playerId, players, world, itemNFT, alice, queuedAction, numSpawned, mockOracleClient} = await loadFixture(
        playersFixtureMelee
      );

      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStatus.NONE);

      const time = 3600;
      await ethers.provider.send("evm_increaseTime", [time]);
      await ethers.provider.send("evm_mine", []);
      let pendingQueuedActionState = await players.pendingQueuedActionState(alice.address, playerId);
      expect(pendingQueuedActionState.actionMetadatas.length).to.eq(1);
      expect(pendingQueuedActionState.actionMetadatas[0].xpGained).to.eq(time + time / 3);
      expect(pendingQueuedActionState.actionMetadatas[0].rolls).to.eq(numSpawned / SPAWN_MUL);
      await players.connect(alice).processActions(playerId);
      await ethers.provider.send("evm_increaseTime", [24 * 3600]);
      let tx = await world.requestRandomWords();
      let requestId = getRequestId(tx);
      expect(requestId).to.not.eq(0);
      await mockOracleClient.fulfill(requestId, world.address);
      tx = await world.requestRandomWords();
      requestId = getRequestId(tx);
      expect(requestId).to.not.eq(0);
      await mockOracleClient.fulfill(requestId, world.address);
      await players.connect(alice).processActions(playerId);

      expect(await itemNFT.balanceOf(alice.address, EstforConstants.POISON)).to.be.deep.oneOf([
        BigNumber.from(numSpawned / (SPAWN_MUL * 2) - 2),
        BigNumber.from(numSpawned / (SPAWN_MUL * 2) - 1),
        BigNumber.from(numSpawned / (SPAWN_MUL * 2)),
        BigNumber.from(numSpawned / (SPAWN_MUL * 2) + 1),
        BigNumber.from(numSpawned / (SPAWN_MUL * 2) + 2),
      ]); // Roughly 1/2 of the time
    });

    it("Check random rewards, next day", async function () {
      const {playerId, players, world, itemNFT, alice, queuedAction, rate, numSpawned, mockOracleClient} =
        await loadFixture(playersFixtureMelee);

      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStatus.NONE);

      const time = 3600;
      await ethers.provider.send("evm_increaseTime", [time]);
      await ethers.provider.send("evm_mine", []);
      let pendingQueuedActionState = await players.pendingQueuedActionState(alice.address, playerId);
      expect(pendingQueuedActionState.actionMetadatas.length).to.eq(1);
      expect(pendingQueuedActionState.actionMetadatas[0].xpGained).to.eq(time + time / 3);
      expect(pendingQueuedActionState.actionMetadatas[0].rolls).to.eq(numSpawned / SPAWN_MUL);
      await ethers.provider.send("evm_increaseTime", [24 * 3600]);
      let tx = await world.requestRandomWords();
      let requestId = getRequestId(tx);
      expect(requestId).to.not.eq(0);
      await mockOracleClient.fulfill(requestId, world.address);
      tx = await world.requestRandomWords();
      requestId = getRequestId(tx);
      expect(requestId).to.not.eq(0);
      await mockOracleClient.fulfill(requestId, world.address);
      await players.connect(alice).processActions(playerId);

      expect(await itemNFT.balanceOf(alice.address, EstforConstants.POISON)).to.be.deep.oneOf([
        BigNumber.from(numSpawned / (SPAWN_MUL * 2) - 2),
        BigNumber.from(numSpawned / (SPAWN_MUL * 2) - 1),
        BigNumber.from(numSpawned / (SPAWN_MUL * 2)),
        BigNumber.from(numSpawned / (SPAWN_MUL * 2) + 1),
        BigNumber.from(numSpawned / (SPAWN_MUL * 2) + 2),
      ]); // Roughly 1/2 of the time
    });

    it("Check random rewards, in-progress updates (many)", async function () {
      const {playerId, players, world, itemNFT, alice, queuedAction, rate, numSpawned, mockOracleClient} =
        await loadFixture(playersFixtureMelee);

      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStatus.NONE);

      const numLoops = queuedAction.timespan / 240;
      expect(numLoops).to.not.eq(0);

      for (let i = 0; i < numLoops; ++i) {
        // Increase by random time
        const randomTimespan = Math.floor(Math.random() * 240);
        await ethers.provider.send("evm_increaseTime", [randomTimespan]);
        await players.connect(alice).processActions(playerId);
      }

      let tx = await world.requestRandomWords();
      let requestId = getRequestId(tx);
      expect(requestId).to.not.eq(0);
      await mockOracleClient.fulfill(requestId, world.address);
      await ethers.provider.send("evm_increaseTime", [24 * 3600]); // This makes sure everything is used
      tx = await world.requestRandomWords();
      requestId = getRequestId(tx);
      expect(requestId).to.not.eq(0);
      await mockOracleClient.fulfill(requestId, world.address);
      await players.connect(alice).processActions(playerId);

      expect(await itemNFT.balanceOf(alice.address, EstforConstants.POISON)).to.be.deep.oneOf([
        BigNumber.from(numSpawned / (SPAWN_MUL * 2) - 1),
        BigNumber.from(numSpawned / (SPAWN_MUL * 2)),
        BigNumber.from(numSpawned / (SPAWN_MUL * 2) + 1),
      ]); // Roughly 1/2 of the time
    });
  });

  describe("Magic", function () {
    async function playersFixtureMagic() {
      const {playerId, players, playerNFT, itemNFT, world, alice} = await loadFixture(playersFixture);

      const monsterCombatStats: EstforTypes.CombatStats = {
        melee: 3,
        magic: 0,
        range: 0,
        meleeDefence: 0,
        magicDefence: 0,
        rangeDefence: 0,
        health: 5,
      };

      const dropRate = 1 * GUAR_MUL; // per monster
      const numSpawned = 10 * SPAWN_MUL;
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

      const scrollsConsumedRate = 1 * RATE_MUL; // per hour
      tx = await world.addActionChoice(EstforConstants.NONE, 1, {
        skill: EstforTypes.Skill.MAGIC,
        skillDiff: 2,
        xpPerHour: 0,
        minXP: 0,
        rate: scrollsConsumedRate,
        inputTokenId1: EstforConstants.SHADOW_SCROLL,
        inputAmount1: 1,
        inputTokenId2: EstforConstants.AIR_SCROLL,
        inputAmount2: 2,
        inputTokenId3: EstforConstants.NONE,
        inputAmount3: 0,
        outputTokenId: EstforConstants.NONE,
        outputAmount: 0,
        successPercent: 100,
      });
      const choiceId = await getActionChoiceId(tx);
      const timespan = 3600;
      const queuedAction: EstforTypes.QueuedActionInput = {
        attire: EstforTypes.noAttire,
        actionId,
        combatStyle: EstforTypes.CombatStyle.ATTACK,
        choiceId,
        regenerateId: EstforConstants.COOKED_MINNUS,
        timespan,
        rightHandEquipmentTokenId: EstforConstants.TOTEM_STAFF,
        leftHandEquipmentTokenId: EstforConstants.NONE, // 2 handed, must specify this for both?
      };

      await itemNFT.addItems([
        {
          ...EstforTypes.defaultInputItem,
          tokenId: EstforConstants.AIR_SCROLL,
          equipPosition: EstforTypes.EquipPosition.MAGIC_BAG,
        },
        {
          ...EstforTypes.defaultInputItem,
          tokenId: EstforConstants.SHADOW_SCROLL,
          equipPosition: EstforTypes.EquipPosition.MAGIC_BAG,
        },
        {
          ...EstforTypes.defaultInputItem,
          tokenId: EstforConstants.TOTEM_STAFF,
          equipPosition: EstforTypes.EquipPosition.BOTH_HANDS,
        },
        {
          ...EstforTypes.defaultInputItem,
          tokenId: EstforConstants.BRONZE_SHIELD,
          equipPosition: EstforTypes.EquipPosition.LEFT_HAND,
        },
        {
          ...EstforTypes.defaultInputItem,
          tokenId: EstforConstants.BRONZE_ARROW,
          equipPosition: EstforTypes.EquipPosition.ARROW_SATCHEL,
        },
        {
          ...EstforTypes.defaultInputItem,
          healthRestored: 12,
          tokenId: EstforConstants.COOKED_MINNUS,
          equipPosition: EstforTypes.EquipPosition.FOOD,
        },
      ]);

      const startXP = START_XP;
      return {
        playerId,
        players,
        playerNFT,
        itemNFT,
        world,
        alice,
        timespan,
        actionId,
        dropRate,
        queuedAction,
        startXP,
        numSpawned,
      };
    }

    it("Attack", async function () {
      const {playerId, players, itemNFT, alice, timespan, dropRate, queuedAction, startXP, numSpawned} =
        await loadFixture(playersFixtureMagic);

      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStatus.NONE);

      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]);
      await players.connect(alice).processActions(playerId);
      expect(await players.xp(playerId, EstforTypes.Skill.MAGIC)).to.eq(
        startXP + Math.floor(queuedAction.timespan * 1.1)
      );
      expect(await players.xp(playerId, EstforTypes.Skill.HEALTH)).to.be.deep.oneOf([
        // This shouldn't be boosted by magic boost
        BigNumber.from(Math.floor(queuedAction.timespan / 3)),
        BigNumber.from(Math.floor(queuedAction.timespan / 3) - 1),
      ]);
      expect(await players.xp(playerId, EstforTypes.Skill.DEFENCE)).to.eq(0);

      // Check the drops are as expected
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.BRONZE_ARROW)).to.eq(
        Math.floor((timespan * dropRate * numSpawned) / (3600 * GUAR_MUL * SPAWN_MUL))
      );

      // Check food is consumed
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.COOKED_MINNUS)).to.eq(1000 - 2);

      // Use at least 1 scroll per monster
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.AIR_SCROLL)).to.eq(200 - 20);
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.SHADOW_SCROLL)).to.eq(100 - 10);
    });

    it("Have no scrolls first then process with them", async function () {});

    it("In-progress combat update", async function () {
      const {players, playerId, itemNFT, alice, world} = await loadFixture(playersFixture);

      const monsterCombatStats: EstforTypes.CombatStats = {
        melee: 1,
        magic: 0,
        range: 0,
        meleeDefence: 0,
        magicDefence: 0,
        rangeDefence: 0,
        health: 36,
      };

      const dropRate = 1 * GUAR_MUL; // per monster
      const numSpawned = 100 * SPAWN_MUL;
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

      // Start with 5 magic
      const scrollsConsumedRate = 100 * RATE_MUL; // per hour
      tx = await world.addActionChoice(EstforConstants.NONE, 1, {
        skill: EstforTypes.Skill.MAGIC,
        skillDiff: 5,
        xpPerHour: 0,
        minXP: 0,
        rate: scrollsConsumedRate,
        inputTokenId1: EstforConstants.SHADOW_SCROLL,
        inputAmount1: 1,
        inputTokenId2: EstforConstants.AIR_SCROLL,
        inputAmount2: 2,
        inputTokenId3: EstforConstants.NONE,
        inputAmount3: 0,
        outputTokenId: EstforConstants.NONE,
        outputAmount: 0,
        successPercent: 100,
      });
      const choiceId = await getActionChoiceId(tx);
      const timespan = 3600;
      const queuedAction: EstforTypes.QueuedActionInput = {
        attire: EstforTypes.noAttire,
        actionId,
        combatStyle: EstforTypes.CombatStyle.ATTACK,
        choiceId,
        regenerateId: EstforConstants.COOKED_MINNUS,
        timespan,
        rightHandEquipmentTokenId: EstforConstants.TOTEM_STAFF,
        leftHandEquipmentTokenId: EstforConstants.NONE,
      };

      await itemNFT.addItems([
        {
          ...EstforTypes.defaultInputItem,
          tokenId: EstforConstants.AIR_SCROLL,
          equipPosition: EstforTypes.EquipPosition.MAGIC_BAG,
        },
        {
          ...EstforTypes.defaultInputItem,
          tokenId: EstforConstants.SHADOW_SCROLL,
          equipPosition: EstforTypes.EquipPosition.MAGIC_BAG,
        },
        {
          ...EstforTypes.defaultInputItem,
          tokenId: EstforConstants.TOTEM_STAFF,
          equipPosition: EstforTypes.EquipPosition.BOTH_HANDS,
        },
        {
          ...EstforTypes.defaultInputItem,
          tokenId: EstforConstants.BRONZE_ARROW,
          equipPosition: EstforTypes.EquipPosition.ARROW_SATCHEL,
        },
        {
          ...EstforTypes.defaultInputItem,
          healthRestored: 12,
          tokenId: EstforConstants.COOKED_MINNUS,
          equipPosition: EstforTypes.EquipPosition.FOOD,
        },
      ]);

      // Should be killing 1 every 72 seconds.
      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStatus.NONE);
      await ethers.provider.send("evm_increaseTime", [36]);
      await ethers.provider.send("evm_mine", []);

      // Check the XP is as expected
      const startXP = START_XP;
      await players.connect(alice).processActions(playerId);
      expect(await players.xp(playerId, EstforTypes.Skill.MAGIC)).to.eq(startXP);
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.BRONZE_ARROW)).to.eq(0);

      await ethers.provider.send("evm_increaseTime", [30]);
      await ethers.provider.send("evm_mine", []);
      await players.connect(alice).processActions(playerId);
      expect(await players.xp(playerId, EstforTypes.Skill.MAGIC)).to.eq(startXP);
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.BRONZE_ARROW)).to.eq(0);

      await ethers.provider.send("evm_increaseTime", [10]);
      await ethers.provider.send("evm_mine", []);
      await players.connect(alice).processActions(playerId);
      // Killed 1 monster, 80s of combat has passed
      expect(await players.xp(playerId, EstforTypes.Skill.MAGIC)).to.eq(startXP + Math.floor(36 * 1.1)); // Add the boost
      // Check the drops are as expected
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.BRONZE_ARROW)).to.eq(Math.floor(dropRate / 10));

      // Check food is consumed
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.COOKED_MINNUS)).to.eq(1000 - 1);

      // Check that scrolls are consumed. 80s of combat is 3 sets of scrolls used.
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.AIR_SCROLL)).to.eq(200 - 6);
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.SHADOW_SCROLL)).to.eq(100 - 3);

      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]);
      await ethers.provider.send("evm_mine", []);
      await players.connect(alice).processActions(playerId);
      // Use up all the scrolls
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.AIR_SCROLL)).to.eq(0);
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.SHADOW_SCROLL)).to.eq(0);

      // Killed 50 monsters (10% base boost)
      expect(await players.xp(playerId, EstforTypes.Skill.MAGIC)).to.eq(
        startXP + Math.floor((queuedAction.timespan / 2) * 1.1)
      );
      expect(await players.xp(playerId, EstforTypes.Skill.HEALTH)).to.eq(Math.floor(queuedAction.timespan / (2 * 3)));
    });

    it("In-progress combat updates (many)", async function () {
      const {players, playerId, itemNFT, alice, world} = await loadFixture(playersFixture);

      const monsterCombatStats: EstforTypes.CombatStats = {
        melee: 1,
        magic: 0,
        range: 0,
        meleeDefence: 0,
        magicDefence: 0,
        rangeDefence: 0,
        health: 36,
      };

      const dropRate = 1 * GUAR_MUL; // per monster
      const numSpawned = 100 * SPAWN_MUL;
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

      // Start with 5 magic
      const scrollsConsumedRate = 100 * RATE_MUL; // per hour
      tx = await world.addActionChoice(EstforConstants.NONE, 1, {
        skill: EstforTypes.Skill.MAGIC,
        skillDiff: 5,
        xpPerHour: 0,
        minXP: 0,
        rate: scrollsConsumedRate,
        inputTokenId1: EstforConstants.SHADOW_SCROLL,
        inputAmount1: 1,
        inputTokenId2: EstforConstants.AIR_SCROLL,
        inputAmount2: 2,
        inputTokenId3: EstforConstants.NONE,
        inputAmount3: 0,
        outputTokenId: EstforConstants.NONE,
        outputAmount: 0,
        successPercent: 100,
      });
      const choiceId = await getActionChoiceId(tx);
      const timespan = 3600;
      const queuedAction: EstforTypes.QueuedActionInput = {
        attire: EstforTypes.noAttire,
        actionId,
        combatStyle: EstforTypes.CombatStyle.ATTACK,
        choiceId,
        regenerateId: EstforConstants.COOKED_MINNUS,
        timespan,
        rightHandEquipmentTokenId: EstforConstants.TOTEM_STAFF,
        leftHandEquipmentTokenId: EstforConstants.NONE,
      };

      await itemNFT.addItems([
        {
          ...EstforTypes.defaultInputItem,
          tokenId: EstforConstants.AIR_SCROLL,
          equipPosition: EstforTypes.EquipPosition.MAGIC_BAG,
        },
        {
          ...EstforTypes.defaultInputItem,
          tokenId: EstforConstants.SHADOW_SCROLL,
          equipPosition: EstforTypes.EquipPosition.MAGIC_BAG,
        },
        {
          ...EstforTypes.defaultInputItem,
          tokenId: EstforConstants.TOTEM_STAFF,
          equipPosition: EstforTypes.EquipPosition.BOTH_HANDS,
        },
        {
          ...EstforTypes.defaultInputItem,
          tokenId: EstforConstants.BRONZE_ARROW,
          equipPosition: EstforTypes.EquipPosition.ARROW_SATCHEL,
        },
        {
          ...EstforTypes.defaultInputItem,
          healthRestored: 12,
          tokenId: EstforConstants.COOKED_MINNUS,
          equipPosition: EstforTypes.EquipPosition.FOOD,
        },
      ]);

      // Should be killing 1 every 72 seconds.
      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStatus.NONE);

      const numLoops = queuedAction.timespan / 240;
      expect(numLoops).to.not.eq(0);

      for (let i = 0; i < numLoops; ++i) {
        // Increase by random time
        const randomTimespan = Math.floor(Math.random() * 240);
        await ethers.provider.send("evm_increaseTime", [randomTimespan]);
        await players.connect(alice).processActions(playerId);
      }
      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]); // This makes sure everything is used
      await players.connect(alice).processActions(playerId);

      // Use up all the scrolls
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.AIR_SCROLL)).to.eq(0);
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.SHADOW_SCROLL)).to.eq(0);

      // Killed 50 monsters (10% base boost)
      expect(await players.xp(playerId, EstforTypes.Skill.MAGIC)).to.eq(
        START_XP + Math.floor((queuedAction.timespan / 2) * 1.1)
      );
      expect(await players.xp(playerId, EstforTypes.Skill.HEALTH)).to.eq(Math.floor(queuedAction.timespan / (2 * 3)));
    });

    //    it("Defence", async function () {
    //   });
    it("No-Bonus XP", async function () {
      const {players, playerNFT, itemNFT, alice, timespan, dropRate, queuedAction, numSpawned} = await loadFixture(
        playersFixtureMagic
      );

      const avatarId = 2;
      const avatarInfo: AvatarInfo = {
        name: "Name goes here",
        description: "Hi I'm a description",
        imageURI: "1234.png",
        startSkills: [Skill.WOODCUTTING, Skill.NONE],
      };
      await playerNFT.setAvatars(avatarId, [avatarInfo]);

      const noSkillPlayerId = await createPlayer(playerNFT, avatarId, alice, "fakename123", true);
      await players.connect(alice).startActions(noSkillPlayerId, [queuedAction], EstforTypes.ActionQueueStatus.NONE);

      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]);
      await players.connect(alice).processActions(noSkillPlayerId);
      expect(await players.xp(noSkillPlayerId, EstforTypes.Skill.MAGIC)).to.eq(queuedAction.timespan);
      expect(await players.xp(noSkillPlayerId, EstforTypes.Skill.HEALTH)).to.be.deep.oneOf([
        BigNumber.from(Math.floor(queuedAction.timespan / 3)),
        BigNumber.from(Math.floor(queuedAction.timespan / 3) - 1),
      ]);
      expect(await players.xp(noSkillPlayerId, EstforTypes.Skill.DEFENCE)).to.eq(0);

      // Check the drops are as expected
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.BRONZE_ARROW)).to.eq(
        Math.floor((timespan * dropRate * numSpawned) / (3600 * GUAR_MUL * SPAWN_MUL))
      );

      // Check food is consumed
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.COOKED_MINNUS)).to.eq(1000 - 4);

      // Check that scrolls are consumed
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.AIR_SCROLL)).to.eq(200 - 20);
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.SHADOW_SCROLL)).to.eq(100 - 10);
    });

    it("No staff equipped", async function () {
      const {
        playerId,
        players,
        itemNFT,
        alice,
        timespan,
        dropRate,
        queuedAction: magicQueuedAction,
        startXP,
        numSpawned,
      } = await loadFixture(playersFixtureMagic);

      const queuedAction = {...magicQueuedAction};
      queuedAction.rightHandEquipmentTokenId = EstforConstants.NONE;

      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStatus.NONE);

      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]);
      await players.connect(alice).processActions(playerId);
      expect(await players.xp(playerId, EstforTypes.Skill.MAGIC)).to.eq(
        startXP + Math.floor(queuedAction.timespan * 1.1)
      );
      expect(await players.xp(playerId, EstforTypes.Skill.DEFENCE)).to.eq(0);

      // Check the drops are as expected
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.BRONZE_ARROW)).to.eq(
        Math.floor((timespan * dropRate * numSpawned) / (3600 * GUAR_MUL * SPAWN_MUL))
      );

      // Check food is consumed
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.COOKED_MINNUS)).to.eq(1000 - 2);

      // Check that scrolls are consumed
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.AIR_SCROLL)).to.eq(200 - 20);
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.SHADOW_SCROLL)).to.eq(100 - 10);
    });

    it("Cannot equip shield with a staff", async function () {
      const {playerId, players, alice, queuedAction: magicQueuedAction} = await loadFixture(playersFixtureMagic);

      const queuedAction = {...magicQueuedAction};

      queuedAction.leftHandEquipmentTokenId = EstforConstants.BRONZE_SHIELD;
      await expect(
        players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStatus.NONE)
      ).to.be.revertedWithCustomError(players, "CannotEquipTwoHandedAndOtherEquipment");
      queuedAction.leftHandEquipmentTokenId = EstforConstants.NONE;
      await expect(players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStatus.NONE)).to
        .not.be.reverted;
    });

    it("Large negative magic defence should not have a big effect against low combat enemies ", async function () {
      const {
        playerId,
        players,
        alice,
        itemNFT,
        queuedAction: magicQueuedAction,
      } = await loadFixture(playersFixtureMagic);

      await itemNFT.addItem({
        ...EstforTypes.defaultInputItem,
        tokenId: EstforConstants.IRON_GAUNTLETS,
        equipPosition: EstforTypes.EquipPosition.ARMS,
        combatStats: {...EstforTypes.emptyCombatStats, magicDefence: -10000},
      });

      const queuedAction = {
        ...magicQueuedAction,
        attire: {...magicQueuedAction.attire, arms: EstforConstants.IRON_GAUNTLETS},
        timespan: 24 * 3600,
      };

      await itemNFT.testMint(alice.address, EstforConstants.IRON_GAUNTLETS, 1);
      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStatus.NONE);
      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]);
      await ethers.provider.send("evm_mine", []);
      let pendingQueuedActionState = await players.pendingQueuedActionState(alice.address, playerId);
      // Confirm you aren't dead
      expect(pendingQueuedActionState.actionMetadatas[0].died).to.be.false;
    });

    it("No scrolls equipped during processing action", async function () {
      const {playerId, players, itemNFT, alice, queuedAction, startXP} = await loadFixture(playersFixtureMagic);

      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStatus.NONE);

      const balance = await itemNFT.balanceOf(alice.address, EstforConstants.AIR_SCROLL);
      await itemNFT.connect(alice).burn(alice.address, EstforConstants.AIR_SCROLL, balance);

      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]);
      await players.connect(alice).processActions(playerId);
      // Should get no XP
      expect(await players.xp(playerId, EstforTypes.Skill.MAGIC)).to.eq(startXP);
      expect(await players.xp(playerId, EstforTypes.Skill.DEFENCE)).to.eq(0);
      // Check food is consumed
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.COOKED_MINNUS)).to.eq(1000 - 40);

      // Check that no scrolls are consumed
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.AIR_SCROLL)).to.eq(0);
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.SHADOW_SCROLL)).to.eq(100);
    });

    it("currentAction in-progress actions", async function () {
      const {playerId, players, alice, itemNFT, queuedAction, startXP} = await loadFixture(playersFixtureMagic);

      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStatus.NONE);
      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan / 2]);
      await ethers.provider.send("evm_mine", []);
      let {timestamp: NOW} = await ethers.provider.getBlock("latest");
      await players.connect(alice).processActions(playerId);
      const xpGained = Math.floor((queuedAction.timespan / 2) * 1.1);
      expect(await players.xp(playerId, EstforTypes.Skill.MAGIC)).to.eq(startXP + xpGained);

      let player = await players.players(playerId);
      expect(player.currentActionStartTime).to.eq(NOW + 1);
      expect(player.currentActionProcessedSkill1).to.eq(Skill.MAGIC);
      expect(player.currentActionProcessedXPGained1).to.eq(xpGained);
      expect(player.currentActionProcessedSkill2).to.eq(Skill.HEALTH);
      expect(player.currentActionProcessedXPGained2).to.eq(queuedAction.timespan / 2 / 3);
      expect(player.currentActionProcessedSkill3).to.eq(0);
      expect(player.currentActionProcessedXPGained3).to.eq(0);
      expect(player.currentActionProcessedFoodConsumed).to.eq(1);
      expect(player.currentActionProcessedBaseInputItemsConsumedNum).to.eq(5);
      // Do a bit more
      await ethers.provider.send("evm_increaseTime", [10]);
      await ethers.provider.send("evm_mine", []);
      ({timestamp: NOW} = await ethers.provider.getBlock("latest"));
      await players.connect(alice).processActions(playerId);
      player = await players.players(playerId);
      expect(player.currentActionStartTime).to.eq(NOW + 1);
      expect(player.currentActionProcessedSkill1).to.eq(Skill.MAGIC);
      expect(player.currentActionProcessedXPGained1).to.eq(xpGained);
      expect(player.currentActionProcessedSkill2).to.eq(Skill.HEALTH);
      expect(player.currentActionProcessedXPGained2).to.eq(queuedAction.timespan / 2 / 3);
      expect(player.currentActionProcessedFoodConsumed).to.eq(1);
      expect(player.currentActionProcessedBaseInputItemsConsumedNum).to.eq(5);

      // Check food is consumed
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.COOKED_MINNUS)).to.eq(1000 - 1);

      // Check that scrolls are consumed
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.AIR_SCROLL)).to.eq(200 - 10);
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.SHADOW_SCROLL)).to.eq(100 - 5);

      // Finish action should be zeroed out
      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]);
      await players.connect(alice).processActions(playerId);
      player = await players.players(playerId);
      expect(player.currentActionStartTime).to.eq(0);
      expect(player.currentActionProcessedSkill1).to.eq(Skill.NONE);
      expect(player.currentActionProcessedXPGained1).to.eq(0);
      expect(player.currentActionProcessedSkill2).to.eq(Skill.NONE);
      expect(player.currentActionProcessedXPGained2).to.eq(0);
      expect(player.currentActionProcessedFoodConsumed).to.eq(0);
      expect(player.currentActionProcessedBaseInputItemsConsumedNum).to.eq(0);
    });

    it("In-progress update have scrolls, then don't have enough, then have enough", async function () {
      const {playerId, players, alice, itemNFT, queuedAction, startXP, dropRate, numSpawned} = await loadFixture(
        playersFixtureMagic
      );

      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStatus.NONE);
      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan / 4]);
      await players.connect(alice).processActions(playerId);

      // Check that scrolls are consumed
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.AIR_SCROLL)).to.eq(200 - 4);
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.SHADOW_SCROLL)).to.eq(100 - 2);
      // Check food is consumed
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.COOKED_MINNUS)).to.eq(1000 - 1);

      // Burn remaining scrolls except 2 set
      await itemNFT.connect(alice).burn(alice.address, EstforConstants.SHADOW_SCROLL, 100 - 5);

      // Check the drops are as expected
      // Can only kill 2 of them which is why XP is / 5 here
      console.log(Math.floor(((queuedAction.timespan / 5) * dropRate * numSpawned) / (3600 * GUAR_MUL * SPAWN_MUL)));
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.BRONZE_ARROW)).to.eq(
        Math.floor(((queuedAction.timespan / 5) * dropRate * numSpawned) / (3600 * GUAR_MUL * SPAWN_MUL))
      );

      let xpGained = Math.floor((queuedAction.timespan / 5) * 1.1);
      expect(await players.xp(playerId, EstforTypes.Skill.MAGIC)).to.eq(startXP + xpGained);

      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan / 4]);
      await ethers.provider.send("evm_mine", []);
      let pendingQueuedActionState = await players.pendingQueuedActionState(alice.address, playerId);
      expect(pendingQueuedActionState.processedData.currentAction.foodConsumed).to.eq(1);
      await itemNFT.connect(alice).burn(alice.address, EstforConstants.SHADOW_SCROLL, 2);
      pendingQueuedActionState = await players.pendingQueuedActionState(alice.address, playerId);
      expect(pendingQueuedActionState.processedData.currentAction.foodConsumed).to.eq(20); // Don't kill them all but in combat for the whole time

      await players.connect(alice).processActions(playerId);
      // Check that 1 set of scrolls is consumed, and only get 1 kill

      // Check food is consumed for the whole combat
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.COOKED_MINNUS)).to.eq(1000 - 20);

      expect(await itemNFT.balanceOf(alice.address, EstforConstants.BRONZE_ARROW)).to.eq(
        Math.floor(((queuedAction.timespan / 5) * dropRate * numSpawned) / (3600 * GUAR_MUL * SPAWN_MUL)) + 1
      );

      xpGained += Math.floor((queuedAction.timespan / 5) * 0.5 * 1.1); // Kill 1 more
      expect(await players.xp(playerId, EstforTypes.Skill.MAGIC)).to.eq(startXP + xpGained);

      // Now have enough scrolls
      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan / 4]);
      await itemNFT.connect(alice).testMint(alice.address, EstforConstants.SHADOW_SCROLL, 100);
      await players.connect(alice).processActions(playerId);

      // Check no more food is consumed as this is an excess
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.COOKED_MINNUS)).to.eq(1000 - 20);
      // Kill 4 more
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.BRONZE_ARROW)).to.eq(
        Math.floor(((queuedAction.timespan / 5) * dropRate * numSpawned) / (3600 * GUAR_MUL * SPAWN_MUL)) + 5
      );

      xpGained += Math.floor((queuedAction.timespan / 5) * 2 * 1.1); // Kill 4 more
      expect(await players.xp(playerId, EstforTypes.Skill.MAGIC)).to.eq(startXP + xpGained);

      // Finish it off
      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan / 4]);
      await players.connect(alice).processActions(playerId);

      // Check no more food is consumed as this is an excess
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.COOKED_MINNUS)).to.eq(1000 - 20);
      // Kill all
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.BRONZE_ARROW)).to.eq(
        Math.floor((queuedAction.timespan * dropRate * numSpawned) / (3600 * GUAR_MUL * SPAWN_MUL))
      );

      xpGained = Math.floor(queuedAction.timespan * 1.1);
      expect(await players.xp(playerId, EstforTypes.Skill.MAGIC)).to.eq(startXP + xpGained);
    });

    it("Add multi actionChoice", async function () {
      const {playerId, players, alice, world, queuedAction: magicQueuedAction} = await loadFixture(playersFixtureMagic);

      const queuedAction = {...magicQueuedAction};
      const scrollsConsumedRate = 1 * RATE_MUL; // per hour

      let choiceId = 2;
      const tx = await world.addBulkActionChoices(
        [EstforConstants.NONE],
        [[choiceId, choiceId + 1]],
        [
          [
            {
              skill: EstforTypes.Skill.MAGIC,
              skillDiff: 2,
              xpPerHour: 0,
              minXP: 0,
              rate: scrollsConsumedRate,
              inputTokenId1: EstforConstants.AIR_SCROLL,
              inputAmount1: 1,
              inputTokenId2: EstforConstants.SHADOW_SCROLL,
              inputAmount2: 1,
              inputTokenId3: EstforConstants.NONE,
              inputAmount3: 0,
              outputTokenId: EstforConstants.NONE,
              outputAmount: 0,
              successPercent: 100,
            },
            {
              skill: EstforTypes.Skill.MAGIC,
              skillDiff: 2,
              xpPerHour: 0,
              minXP: 0,
              rate: scrollsConsumedRate,
              inputTokenId1: EstforConstants.SHADOW_SCROLL,
              inputAmount1: 1,
              inputTokenId2: EstforConstants.AIR_SCROLL,
              inputAmount2: 3,
              inputTokenId3: EstforConstants.NONE,
              inputAmount3: 0,
              outputTokenId: EstforConstants.NONE,
              outputAmount: 0,
              successPercent: 100,
            },
          ],
        ]
      );

      const choiceIds = await getActionChoiceIds(tx);
      expect(choiceIds).to.eql([choiceId, choiceId + 1]);
      queuedAction.choiceId = choiceId + 2;

      // Non-existent actionChoiceId
      await expect(players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStatus.NONE)).to
        .be.reverted;
      queuedAction.choiceId = choiceId;
      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStatus.NONE);
    });

    it("Use too much food (split over same action)", async function () {
      const {
        playerId,
        players,
        alice,
        world,
        queuedAction: magicQueuedAction,
        itemNFT,
        startXP,
      } = await loadFixture(playersFixtureMagic);

      const monsterCombatStats: EstforTypes.CombatStats = {
        melee: 15000,
        magic: 0,
        range: 0,
        meleeDefence: 0,
        magicDefence: 0,
        rangeDefence: 0,
        health: 5,
      };

      const dropRate = 1 * GUAR_MUL; // per hour
      await world.addAction({
        actionId: 2,
        info: {
          skill: EstforTypes.Skill.COMBAT,
          xpPerHour: 3600,
          minXP: 0,
          isDynamic: false,
          numSpawned: 100 * SPAWN_MUL,
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

      const queuedAction = {...magicQueuedAction};
      queuedAction.actionId = 2;

      // Exceed 2^16
      await itemNFT.testMint(alice.address, EstforConstants.COOKED_MINNUS, 70000);
      const foodBalance = await itemNFT.balanceOf(alice.address, EstforConstants.COOKED_MINNUS);

      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStatus.NONE);

      // Food should be used each time
      let beforeBal = await itemNFT.balanceOf(alice.address, EstforConstants.COOKED_MINNUS);
      for (let i = 0; i < 36; ++i) {
        await ethers.provider.send("evm_increaseTime", [queuedAction.timespan / 36]);
        await ethers.provider.send("evm_mine", []);
        await players.connect(alice).processActions(playerId);
        const newBalance = await itemNFT.balanceOf(alice.address, EstforConstants.COOKED_MINNUS);
        expect(beforeBal).to.satisfy((num: BigNumber) => {
          return num.gt(newBalance) || num.eq(foodBalance.sub(65535));
        });
        beforeBal = newBalance;
      }

      expect(await players.xp(playerId, EstforTypes.Skill.MAGIC)).to.eq(3106);
      expect(await players.xp(playerId, EstforTypes.Skill.DEFENCE)).to.eq(0);
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.COOKED_MINNUS)).to.eq(
        foodBalance.sub(Math.pow(2, 16) - 1)
      );
    });

    it("Use too much food", async function () {
      const {
        playerId,
        players,
        alice,
        world,
        queuedAction: magicQueuedAction,
        itemNFT,
        startXP,
      } = await loadFixture(playersFixtureMagic);

      const monsterCombatStats: EstforTypes.CombatStats = {
        melee: 15000,
        magic: 0,
        range: 0,
        meleeDefence: 0,
        magicDefence: 0,
        rangeDefence: 0,
        health: 5,
      };

      const dropRate = 1 * GUAR_MUL; // per hour
      await world.addAction({
        actionId: 2,
        info: {
          skill: EstforTypes.Skill.COMBAT,
          xpPerHour: 3600,
          minXP: 0,
          isDynamic: false,
          numSpawned: 100 * SPAWN_MUL,
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

      const queuedAction = {...magicQueuedAction};
      queuedAction.actionId = 2;

      // Exceed 2^16
      await itemNFT.testMint(alice.address, EstforConstants.COOKED_MINNUS, 70000);
      const foodBalance = await itemNFT.balanceOf(alice.address, EstforConstants.COOKED_MINNUS);

      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStatus.NONE);

      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]);
      await players.connect(alice).processActions(playerId);
      // Died but still get XP
      expect(await players.xp(playerId, EstforTypes.Skill.MAGIC)).to.eq(startXP + 2732);
      expect(await players.xp(playerId, EstforTypes.Skill.DEFENCE)).to.eq(0);
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.COOKED_MINNUS)).to.eq(
        foodBalance.sub(Math.pow(2, 16) - 1)
      );
    });
  });

  it("Dead, kill all but don't have enough food", async function () {
    // Lose all the XP that would have been gained
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

    const rate = 6000 * GUAR_MUL; // per kill
    let tx = await world.addAction({
      actionId: 1,
      info: {
        skill: EstforTypes.Skill.COMBAT,
        xpPerHour: 3600,
        minXP: 0,
        isDynamic: false,
        numSpawned: 100 * SPAWN_MUL,
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

    const foodNum = 100;
    await itemNFT.testMints(
      alice.address,
      [EstforConstants.BRONZE_SWORD, EstforConstants.COOKED_MINNUS, EstforConstants.BRONZE_HELMET],
      [1, foodNum, 1]
    );

    await itemNFT.addItem({
      ...EstforTypes.defaultInputItem,
      tokenId: EstforConstants.BRONZE_HELMET,
      equipPosition: EstforTypes.EquipPosition.HEAD,
    });

    const timespan = 3600 * 3; // 3 hours
    tx = await world.addActionChoice(EstforConstants.NONE, 1, {
      ...emptyActionChoice,
      skill: EstforTypes.Skill.MELEE,
    });
    const choiceId = await getActionChoiceId(tx);
    const queuedAction: EstforTypes.QueuedActionInput = {
      attire: {...EstforTypes.noAttire, head: EstforConstants.BRONZE_HELMET},
      actionId,
      combatStyle: EstforTypes.CombatStyle.ATTACK,
      choiceId,
      regenerateId: EstforConstants.COOKED_MINNUS,
      timespan,
      rightHandEquipmentTokenId: EstforConstants.BRONZE_SWORD,
      leftHandEquipmentTokenId: EstforConstants.NONE,
    };

    await itemNFT.addItem({
      ...EstforTypes.defaultInputItem,
      tokenId: EstforConstants.BRONZE_SWORD,
      equipPosition: EstforTypes.EquipPosition.RIGHT_HAND,
    });

    await itemNFT.addItem({
      ...EstforTypes.defaultInputItem,
      healthRestored: 1,
      tokenId: EstforConstants.COOKED_MINNUS,
      equipPosition: EstforTypes.EquipPosition.FOOD,
    });

    await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStatus.NONE);

    await ethers.provider.send("evm_increaseTime", [3600]);
    await ethers.provider.send("evm_mine", []);
    let pendingQueuedActionState = await players.pendingQueuedActionState(alice.address, playerId);
    expect(pendingQueuedActionState.actionMetadatas[0].died).to.be.true;
    expect(pendingQueuedActionState.actionMetadatas[0].actionId).to.eq(queuedAction.actionId);
    expect(pendingQueuedActionState.actionMetadatas[0].queueId).to.eq(1);
    expect(pendingQueuedActionState.equipmentStates[0].producedItemTokenIds.length).to.eq(1);
    expect(pendingQueuedActionState.producedPastRandomRewards.length).to.eq(0);
    expect(pendingQueuedActionState.equipmentStates[0].consumedItemTokenIds.length).to.eq(1);
    expect(pendingQueuedActionState.equipmentStates[0].consumedAmounts[0]).to.eq(foodNum);
    expect(pendingQueuedActionState.equipmentStates[0].consumedItemTokenIds[0]).to.eq(COOKED_MINNUS);

    await players.connect(alice).processActions(playerId);
    // Should die, but still get skill points & loot for the ones you did kill. Also food should be consumed
    expect(await players.xp(playerId, EstforTypes.Skill.MELEE)).to.eq(1332);
    expect(await itemNFT.balanceOf(alice.address, EstforConstants.BRONZE_ARROW)).to.eq(222000);
    expect(await itemNFT.balanceOf(alice.address, EstforConstants.COOKED_MINNUS)).to.eq(0);

    // Have no food, should not show any in consumed
    await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStatus.NONE);
    await ethers.provider.send("evm_increaseTime", [3600]);
    await ethers.provider.send("evm_mine", []);
    pendingQueuedActionState = await players.pendingQueuedActionState(alice.address, playerId);
    expect(pendingQueuedActionState.actionMetadatas[0].died).to.be.true;
    expect(pendingQueuedActionState.equipmentStates[0].producedItemTokenIds.length).to.eq(0);
    expect(pendingQueuedActionState.producedPastRandomRewards.length).to.eq(0);
    expect(pendingQueuedActionState.equipmentStates[0].consumedItemTokenIds.length).to.eq(0);
  });

  it("Dead, don't kill all", async function () {
    // Lose all the XP that would have been gained
    const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);

    const monsterCombatStats: EstforTypes.CombatStats = {
      melee: 3,
      magic: 0,
      range: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangeDefence: 0,
      health: 100,
    };

    const rate = 1 * GUAR_MUL; // per hour
    let tx = await world.addAction({
      actionId: 1,
      info: {
        skill: EstforTypes.Skill.COMBAT,
        xpPerHour: 3600,
        minXP: 0,
        isDynamic: false,
        numSpawned: 100 * SPAWN_MUL,
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

    const foodNum = 2;
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
      regenerateId: EstforConstants.COOKED_MINNUS,
      timespan,
      rightHandEquipmentTokenId: EstforConstants.BRONZE_SWORD,
      leftHandEquipmentTokenId: EstforConstants.NONE,
    };

    await itemNFT.addItem({
      ...EstforTypes.defaultInputItem,
      tokenId: EstforConstants.BRONZE_SWORD,
      equipPosition: EstforTypes.EquipPosition.RIGHT_HAND,
      metadataURI: "someIPFSURI.json",
    });

    await itemNFT.addItem({
      ...EstforTypes.defaultInputItem,
      healthRestored: 1,
      tokenId: EstforConstants.COOKED_MINNUS,
      equipPosition: EstforTypes.EquipPosition.FOOD,
      metadataURI: "someIPFSURI.json",
    });

    await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStatus.NONE);

    await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]);
    await ethers.provider.send("evm_mine", []);

    let pendingQueuedActionState = await players.pendingQueuedActionState(alice.address, playerId);
    expect(pendingQueuedActionState.actionMetadatas[0].died).to.be.true;
    expect(pendingQueuedActionState.actionMetadatas[0].actionId).to.eq(queuedAction.actionId);
    expect(pendingQueuedActionState.actionMetadatas[0].queueId).to.eq(1);
    expect(pendingQueuedActionState.equipmentStates[0].producedItemTokenIds.length).to.eq(0);
    expect(pendingQueuedActionState.producedPastRandomRewards.length).to.eq(0);
    expect(pendingQueuedActionState.equipmentStates[0].consumedItemTokenIds.length).to.eq(1);
    expect(pendingQueuedActionState.actionMetadatas[0].actionId).to.eq(queuedAction.actionId);
    expect(pendingQueuedActionState.actionMetadatas[0].queueId).to.eq(1);
    expect(pendingQueuedActionState.equipmentStates[0].consumedAmounts[0]).to.eq(foodNum);
    expect(pendingQueuedActionState.equipmentStates[0].consumedItemTokenIds[0]).to.eq(COOKED_MINNUS);
    await players.connect(alice).processActions(playerId);
    // Should die so doesn't get any attack skill points, and food should be consumed
    expect(await players.xp(playerId, EstforTypes.Skill.MELEE)).to.eq(0);
    expect(await itemNFT.balanceOf(alice.address, EstforConstants.BRONZE_ARROW)).to.eq(0);
    expect(await itemNFT.balanceOf(alice.address, EstforConstants.COOKED_MINNUS)).to.eq(0);
  });
});
