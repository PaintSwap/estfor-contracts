import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {EstforConstants, EstforTypes} from "@paintswap/estfor-definitions";
import {COOKED_MINNUS, GUAR_MUL, QUEST_SUPPLY_RUN, RATE_MUL, SPAWN_MUL} from "@paintswap/estfor-definitions/constants";
import {QueuedActionInput, Skill, defaultActionChoice, defaultActionInfo} from "@paintswap/estfor-definitions/types";
import {expect} from "chai";
import {ethers} from "hardhat";
import {AvatarInfo, createPlayer, SKIP_XP_THRESHOLD_EFFECTS} from "../../scripts/utils";
import {
  getActionChoiceId,
  getActionChoiceIds,
  getActionId,
  NO_DONATION_AMOUNT,
  requestAndFulfillRandomWords,
  requestAndFulfillRandomWordsSeeded,
  START_XP
} from "../utils";
import {playersFixture} from "./PlayersFixture";
import {BOOST_START_NOW, getPlayersHelper, setupBasicMeleeCombat} from "./utils";
import {timeTravel, timeTravel24Hours} from "../utils";
import {allActions} from "../../scripts/data/actions";
import {QuestInput, allQuests, defaultMinRequirements} from "../../scripts/data/quests";
import {Block, parseEther} from "ethers";

const actionIsAvailable = true;

describe("Combat Actions", function () {
  describe("Melee", async function () {
    async function playersFixtureMelee() {
      const fixture = await loadFixture(playersFixture);
      const {itemNFT, worldActions} = fixture;

      const {queuedAction, rate, numSpawned, choiceId} = await setupBasicMeleeCombat(itemNFT, worldActions);

      return {
        ...fixture,
        queuedAction,
        rate,
        numSpawned,
        choiceId
      };
    }

    it("Attack", async function () {
      const {playerId, players, itemNFT, alice, queuedAction, rate, numSpawned} = await loadFixture(
        playersFixtureMelee
      );

      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);

      const time = 3600;
      await ethers.provider.send("evm_increaseTime", [time]);
      await ethers.provider.send("evm_mine", []);
      await players.connect(alice).processActions(playerId);
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.MELEE)).to.be.deep.oneOf([
        BigInt(time),
        BigInt(time + 1)
      ]);
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.HEALTH)).to.be.deep.oneOf([
        BigInt(Math.floor(time / 3) - 1),
        BigInt(Math.floor(time / 3))
      ]); // Health should get 33% of the stats
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.DEFENCE)).to.eq(0);

      // Check the drops are as expected
      expect(await itemNFT.balanceOf(alice, EstforConstants.BRONZE_ARROW)).to.eq(
        Math.floor((time * rate * numSpawned) / (3600 * GUAR_MUL * SPAWN_MUL))
      );

      // Check food is consumed
      expect(await itemNFT.balanceOf(alice, EstforConstants.COOKED_MINNUS)).to.eq(255 - 1);
      // Only no 0 id items produced
      expect(await itemNFT.balanceOf(alice, EstforConstants.NONE)).to.eq(0);
    });

    it("In-progress combat updates (many)", async function () {
      const {playerId, players, itemNFT, alice, queuedAction, rate, numSpawned} = await loadFixture(
        playersFixtureMelee
      );

      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);

      const numLoops = queuedAction.timespan / 240;
      expect(numLoops).to.not.eq(0);

      for (let i = 0; i < numLoops; ++i) {
        // Increase by random time
        const randomTimespan = Math.floor(Math.random() * 240);
        await ethers.provider.send("evm_increaseTime", [randomTimespan]);
        await ethers.provider.send("evm_mine", []);
        await players.connect(alice).processActions(playerId);
      }

      const healthXP = await players.getPlayerXP(playerId, EstforTypes.Skill.HEALTH);
      // Check that some are used at least before completing the action
      expect(healthXP).to.not.eq(0);
      // Check the drops are as expected
      expect(await itemNFT.balanceOf(alice, EstforConstants.BRONZE_ARROW)).to.be.gt(0);
      // Check food is consumed
      expect(await itemNFT.balanceOf(alice, EstforConstants.COOKED_MINNUS)).to.be.lt(255);

      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]); // This makes sure everything is used
      await ethers.provider.send("evm_mine", []);
      await players.connect(alice).processActions(playerId);
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.MELEE)).to.eq(queuedAction.timespan);
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.HEALTH)).to.be.deep.oneOf([
        BigInt(Math.floor(queuedAction.timespan / 3) - 1),
        BigInt(Math.floor(queuedAction.timespan / 3))
      ]); // Health should get 33% of the stats
      expect(healthXP).to.not.be.deep.oneOf([
        BigInt(Math.floor(queuedAction.timespan / 3) - 1),
        BigInt(Math.floor(queuedAction.timespan / 3))
      ]);
      // Check the drops are as expected
      expect(await itemNFT.balanceOf(alice, EstforConstants.BRONZE_ARROW)).to.eq(
        Math.floor((queuedAction.timespan * rate * numSpawned) / (3600 * GUAR_MUL * SPAWN_MUL))
      );
      // Check food is consumed
      expect(await itemNFT.balanceOf(alice, EstforConstants.COOKED_MINNUS)).to.eq(255 - 1);
    });

    it("No defence equipment", async function () {
      const {
        playerId,
        players,
        itemNFT,
        alice,
        queuedAction: meleeQueuedAction,
        rate,
        numSpawned
      } = await loadFixture(playersFixtureMelee);

      const queuedAction = {...meleeQueuedAction};
      queuedAction.attire = {...EstforTypes.noAttire};

      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);

      const time = 3600;
      await ethers.provider.send("evm_increaseTime", [time]);
      await ethers.provider.send("evm_mine", []);
      await players.connect(alice).processActions(playerId);
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.MELEE)).to.be.deep.oneOf([
        BigInt(time),
        BigInt(time + 1)
      ]);
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.HEALTH)).to.be.deep.oneOf([
        BigInt(Math.floor(time / 3) - 1),
        BigInt(Math.floor(time / 3))
      ]); // Health should get 33% of the stats
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.DEFENCE)).to.eq(0);

      // Check the drops are as expected
      expect(await itemNFT.balanceOf(alice, EstforConstants.BRONZE_ARROW)).to.eq(
        Math.floor((time * rate * numSpawned) / (3600 * GUAR_MUL * SPAWN_MUL))
      );

      // Check food is consumed
      expect(await itemNFT.balanceOf(alice, EstforConstants.COOKED_MINNUS)).to.eq(255 - 2);
    });

    it("Don't kill anything", async function () {
      const {playerId, players, itemNFT, alice, queuedAction} = await loadFixture(playersFixtureMelee);

      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);

      const time = 10;
      await ethers.provider.send("evm_increaseTime", [time]);
      await ethers.provider.send("evm_mine", []);
      await players.connect(alice).processActions(playerId);
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.MELEE)).to.eq(0);

      // Check the drops are as expected
      expect(await itemNFT.balanceOf(alice, EstforConstants.BRONZE_ARROW)).to.eq(0);
      // Check food is consumed
      expect(await itemNFT.balanceOf(alice, EstforConstants.COOKED_MINNUS)).to.eq(255);
    });

    it("Melee defence", async function () {
      const {
        playerId,
        players,
        itemNFT,
        alice,
        queuedAction: meleeQueuedAction,
        rate,
        numSpawned
      } = await loadFixture(playersFixtureMelee);

      const queuedAction = {...meleeQueuedAction};
      queuedAction.combatStyle = EstforTypes.CombatStyle.DEFENCE;

      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);

      const time = 3600;
      await ethers.provider.send("evm_increaseTime", [time]);
      await ethers.provider.send("evm_mine", []);
      await players.connect(alice).processActions(playerId);
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.DEFENCE)).to.be.deep.oneOf([
        BigInt(time),
        BigInt(time + 1)
      ]);
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.MELEE)).to.eq(0);

      // Check the drops are as expected
      expect(await itemNFT.balanceOf(alice, EstforConstants.BRONZE_ARROW)).to.eq(
        Math.floor((time * rate * numSpawned) / (3600 * GUAR_MUL * SPAWN_MUL))
      );

      // Check food is consumed
      expect(await itemNFT.balanceOf(alice, EstforConstants.COOKED_MINNUS)).to.eq(255 - 1);
    });

    it("Equip shield", async function () {
      const {
        playerId,
        players,
        itemNFT,
        alice,
        queuedAction: meleeQueuedAction,
        rate,
        numSpawned
      } = await loadFixture(playersFixtureMelee);

      const queuedAction = {...meleeQueuedAction};
      queuedAction.rightHandEquipmentTokenId = EstforConstants.BRONZE_SHIELD;

      await itemNFT.mint(alice, EstforConstants.BRONZE_SHIELD, 1);

      await expect(
        players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE)
      ).to.be.revertedWithCustomError(itemNFT, "ItemDoesNotExist");

      await itemNFT.addItems([
        {
          ...EstforTypes.defaultItemInput,
          tokenId: EstforConstants.BRONZE_SHIELD,
          equipPosition: EstforTypes.EquipPosition.LEFT_HAND
        }
      ]);

      await expect(
        players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE)
      ).to.be.revertedWithCustomError(players, "IncorrectRightHandEquipment");

      queuedAction.rightHandEquipmentTokenId = EstforConstants.BRONZE_SWORD;
      queuedAction.leftHandEquipmentTokenId = EstforConstants.BRONZE_SHIELD;

      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);

      const time = 3600;
      await ethers.provider.send("evm_increaseTime", [time]);
      await ethers.provider.send("evm_mine", []);

      await players.connect(alice).processActions(playerId);
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.MELEE)).to.deep.oneOf([
        BigInt(time),
        BigInt(time + 1)
      ]);

      // Check the drops are as expected
      expect(await itemNFT.balanceOf(alice, EstforConstants.BRONZE_ARROW)).to.eq(
        Math.floor((time * rate * numSpawned) / (3600 * GUAR_MUL * SPAWN_MUL))
      );

      // Check food is consumed
      expect(await itemNFT.balanceOf(alice, EstforConstants.COOKED_MINNUS)).to.eq(255 - 1);
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
        worldActions
      } = await loadFixture(playersFixtureMelee);

      const monsterCombatStats: EstforTypes.CombatStats = {
        meleeAttack: 80,
        magicAttack: 80,
        rangedAttack: 80,
        meleeDefence: 80,
        magicDefence: 80,
        rangedDefence: 80,
        health: 1200
      };

      const numSpawned = 10 * SPAWN_MUL;
      let tx = await worldActions.addActions([
        {
          actionId: 2,
          info: {
            ...defaultActionInfo,
            skill: EstforTypes.Skill.COMBAT,
            xpPerHour: 3600,
            minXP: 0,
            numSpawned,
            handItemTokenIdRangeMin: EstforConstants.COMBAT_BASE,
            handItemTokenIdRangeMax: EstforConstants.COMBAT_MAX,
            isAvailable: actionIsAvailable,
            actionChoiceRequired: true,
            successPercent: 100
          },
          guaranteedRewards: [],
          randomRewards: [],
          combatStats: monsterCombatStats
        }
      ]);
      const actionId = await getActionId(tx, worldActions);

      const queuedAction = {...meleeQueuedAction};
      queuedAction.actionId = actionId;
      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);

      const time = 3600;
      await ethers.provider.send("evm_increaseTime", [time]);
      await ethers.provider.send("evm_mine", []);

      let pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
      expect(pendingQueuedActionState.equipmentStates[0].consumedItemTokenIds.length).to.eq(1);
      expect(pendingQueuedActionState.equipmentStates[0].consumedItemTokenIds[0]).to.eq(EstforConstants.COOKED_MINNUS);
      expect(pendingQueuedActionState.equipmentStates[0].consumedAmounts[0]).to.eq(255);

      expect(await itemNFT.balanceOf(alice, EstforConstants.COOKED_MINNUS)).to.eq(255);
      await players.connect(alice).processActions(playerId);
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.MELEE)).to.eq(0);

      // Check food is consumed
      expect(await itemNFT.balanceOf(alice, EstforConstants.COOKED_MINNUS)).to.eq(0);
    });

    it("Multi-hour respawn time, can kill all", async function () {
      const {
        playerId,
        players,
        alice,
        queuedAction: meleeQueuedAction,
        worldActions
      } = await loadFixture(playersFixtureMelee);

      const monsterCombatStats: EstforTypes.CombatStats = {
        meleeAttack: 10,
        magicAttack: 0,
        rangedAttack: 0,
        meleeDefence: 10,
        magicDefence: 0,
        rangedDefence: 0,
        health: 70
      };

      const numSpawned = 0.5 * SPAWN_MUL; // 1 every 2 hours
      let tx = await worldActions.addActions([
        {
          actionId: 2,
          info: {
            ...defaultActionInfo,
            skill: EstforTypes.Skill.COMBAT,
            xpPerHour: 3600,
            minXP: 0,
            numSpawned,
            handItemTokenIdRangeMin: EstforConstants.COMBAT_BASE,
            handItemTokenIdRangeMax: EstforConstants.COMBAT_MAX,
            isAvailable: actionIsAvailable,
            actionChoiceRequired: true,
            successPercent: 100
          },
          guaranteedRewards: [],
          randomRewards: [],
          combatStats: monsterCombatStats
        }
      ]);
      const actionId = await getActionId(tx, worldActions);

      const queuedAction = {...meleeQueuedAction};
      queuedAction.actionId = actionId;
      queuedAction.timespan = 7200;
      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);

      const time = 3600;
      await ethers.provider.send("evm_increaseTime", [time]);
      await ethers.provider.send("evm_mine", []);

      let pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
      expect(pendingQueuedActionState.equipmentStates[0].consumedItemTokenIds.length).to.eq(1);
      expect(pendingQueuedActionState.equipmentStates[0].consumedAmounts[0]).to.eq(14);
      expect(pendingQueuedActionState.actionMetadatas[0].xpGained).to.eq(0); // Haven't killed any yet
      await players.connect(alice).processActions(playerId);
      await ethers.provider.send("evm_increaseTime", [time]);
      await ethers.provider.send("evm_mine", []);
      pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
      expect(pendingQueuedActionState.equipmentStates[0].consumedItemTokenIds.length).to.eq(0); // Already used the necessary food
      expect(pendingQueuedActionState.actionMetadatas[0].xpGained).to.eq(7200 + 7200 / 3); // Killed 1
    });

    it("Multi-hour respawn time, cannot kill", async function () {
      const {
        playerId,
        players,
        alice,
        queuedAction: meleeQueuedAction,
        worldActions
      } = await loadFixture(playersFixtureMelee);

      const monsterCombatStats: EstforTypes.CombatStats = {
        meleeAttack: 1,
        magicAttack: 0,
        rangedAttack: 0,
        meleeDefence: 80,
        magicDefence: 0,
        rangedDefence: 0,
        health: 32000
      };

      const numSpawned = 0.5 * SPAWN_MUL; // 1 every 2 hours
      let tx = await worldActions.addActions([
        {
          actionId: 2,
          info: {
            ...defaultActionInfo,
            skill: EstforTypes.Skill.COMBAT,
            xpPerHour: 3600,
            minXP: 0,
            numSpawned,
            handItemTokenIdRangeMin: EstforConstants.COMBAT_BASE,
            handItemTokenIdRangeMax: EstforConstants.COMBAT_MAX,
            isAvailable: actionIsAvailable,
            actionChoiceRequired: true,
            successPercent: 100
          },
          guaranteedRewards: [],
          randomRewards: [],
          combatStats: monsterCombatStats
        }
      ]);
      const actionId = await getActionId(tx, worldActions);

      const queuedAction = {...meleeQueuedAction};
      queuedAction.actionId = actionId;
      queuedAction.timespan = 7200;
      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);

      const time = 3600;
      await ethers.provider.send("evm_increaseTime", [time]);
      await ethers.provider.send("evm_mine", []);

      let pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
      expect(pendingQueuedActionState.equipmentStates[0].consumedItemTokenIds.length).to.eq(1);
      expect(pendingQueuedActionState.equipmentStates[0].consumedAmounts[0]).to.eq(5);
      expect(pendingQueuedActionState.actionMetadatas[0].xpGained).to.eq(0); // Haven't killed any yet
      await players.connect(alice).processActions(playerId);
      await ethers.provider.send("evm_increaseTime", [time]);
      await ethers.provider.send("evm_mine", []);
      pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
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
        worldActions,
        itemNFT
      } = await loadFixture(playersFixtureMelee);
      const monsterCombatStats: EstforTypes.CombatStats = {
        meleeAttack: 15000,
        magicAttack: 0,
        rangedAttack: 0,
        meleeDefence: 0,
        magicDefence: 0,
        rangedDefence: 0,
        health: 5
      };

      const dropRate = 1 * GUAR_MUL; // per hour
      await worldActions.addActions([
        {
          actionId: 2,
          info: {
            ...defaultActionInfo,
            skill: EstforTypes.Skill.COMBAT,
            xpPerHour: 3600,
            minXP: 0,
            numSpawned: 100 * SPAWN_MUL,
            handItemTokenIdRangeMin: EstforConstants.COMBAT_BASE,
            handItemTokenIdRangeMax: EstforConstants.COMBAT_MAX,
            isAvailable: actionIsAvailable,
            actionChoiceRequired: true,
            successPercent: 100
          },
          guaranteedRewards: [{itemTokenId: EstforConstants.BRONZE_ARROW, rate: dropRate}],
          randomRewards: [],
          combatStats: monsterCombatStats
        }
      ]);

      const queuedAction = {...meleeQueuedAction};
      queuedAction.actionId = 2;

      // Exceed 2^16
      await itemNFT.mint(alice, EstforConstants.COOKED_MINNUS, 70000); // Have 255 from before too;
      const foodBalance = await itemNFT.balanceOf(alice, EstforConstants.COOKED_MINNUS);

      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);
      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]);
      await ethers.provider.send("evm_mine", []);
      await players.connect(alice).processActions(playerId);

      // Should have died. You still get XP for the ones you killed while processing.it  He could kill
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.MELEE)).to.eq(2484); // Killed 67
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.DEFENCE)).to.eq(0);
      expect(await itemNFT.balanceOf(alice, EstforConstants.BRONZE_ARROW)).to.eq(69);
      expect(await itemNFT.balanceOf(alice, EstforConstants.COOKED_MINNUS)).to.eq(
        foodBalance - BigInt(Math.pow(2, 16) - 1)
      );
    });

    it("Health should give healing effects", async function () {
      const {
        playerId,
        players,
        alice,
        queuedAction: meleeQueuedAction,
        worldActions,
        itemNFT
      } = await loadFixture(playersFixtureMelee);

      await players.setAlphaCombatParams(1, 1, 8);

      const monsterCombatStats: EstforTypes.CombatStats = {
        meleeAttack: 15000,
        magicAttack: 0,
        rangedAttack: 0,
        meleeDefence: 0,
        magicDefence: 0,
        rangedDefence: 0,
        health: 5
      };

      const dropRate = 1 * GUAR_MUL; // per hour
      await worldActions.addActions([
        {
          actionId: 2,
          info: {
            ...defaultActionInfo,
            skill: EstforTypes.Skill.COMBAT,
            xpPerHour: 3600,
            minXP: 0,
            numSpawned: 100 * SPAWN_MUL,
            handItemTokenIdRangeMin: EstforConstants.COMBAT_BASE,
            handItemTokenIdRangeMax: EstforConstants.COMBAT_MAX,
            isAvailable: actionIsAvailable,
            actionChoiceRequired: true,
            successPercent: 100
          },
          guaranteedRewards: [{itemTokenId: EstforConstants.BRONZE_ARROW, rate: dropRate}],
          randomRewards: [],
          combatStats: monsterCombatStats
        }
      ]);

      const queuedAction = {...meleeQueuedAction};
      queuedAction.actionId = 2;

      // Exceed 2^16
      await itemNFT.mint(alice, EstforConstants.COOKED_MINNUS, 70000); // Have 255 from before too;
      const foodBalance = await itemNFT.balanceOf(alice, EstforConstants.COOKED_MINNUS);

      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);
      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]);
      await ethers.provider.send("evm_mine", []);
      await players.connect(alice).processActions(playerId);

      // Should have died. You still get XP for the ones you killed while processing.it  He could kill
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.MELEE)).to.eq(2520); // Killed 68 (the healing helped us kill 1 more)
      expect(await itemNFT.balanceOf(alice, EstforConstants.BRONZE_ARROW)).to.eq(70);
      expect(await itemNFT.balanceOf(alice, EstforConstants.COOKED_MINNUS)).to.eq(
        foodBalance - BigInt(Math.pow(2, 16) - 1)
      );
    });

    it("Use too much food (split over same action)", async function () {
      const {
        playerId,
        players,
        alice,
        queuedAction: meleeQueuedAction,
        worldActions,
        itemNFT
      } = await loadFixture(playersFixtureMelee);
      const monsterCombatStats: EstforTypes.CombatStats = {
        meleeAttack: 15000,
        magicAttack: 0,
        rangedAttack: 0,
        meleeDefence: 0,
        magicDefence: 0,
        rangedDefence: 0,
        health: 5
      };

      const dropRate = 1 * GUAR_MUL; // per hour
      await worldActions.addActions([
        {
          actionId: 2,
          info: {
            ...defaultActionInfo,
            skill: EstforTypes.Skill.COMBAT,
            xpPerHour: 3600,
            minXP: 0,
            numSpawned: 100 * SPAWN_MUL,
            handItemTokenIdRangeMin: EstforConstants.COMBAT_BASE,
            handItemTokenIdRangeMax: EstforConstants.COMBAT_MAX,
            isAvailable: actionIsAvailable,
            actionChoiceRequired: true,
            successPercent: 100
          },
          guaranteedRewards: [{itemTokenId: EstforConstants.BRONZE_ARROW, rate: dropRate}],
          randomRewards: [],
          combatStats: monsterCombatStats
        }
      ]);

      const queuedAction = {...meleeQueuedAction};
      queuedAction.actionId = 2;

      // Exceed 2^16
      await itemNFT.mint(alice, EstforConstants.COOKED_MINNUS, 70000); // Have 255 from before too
      const foodBalance = await itemNFT.balanceOf(alice, EstforConstants.COOKED_MINNUS);

      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);

      // Food should be used each time until it is all used up
      let beforeBal = await itemNFT.balanceOf(alice, EstforConstants.COOKED_MINNUS);
      for (let i = 0; i < 36; ++i) {
        await ethers.provider.send("evm_increaseTime", [queuedAction.timespan / 36]);
        await ethers.provider.send("evm_mine", []);
        await players.connect(alice).processActions(playerId);
        const newBalance = await itemNFT.balanceOf(alice, EstforConstants.COOKED_MINNUS);
        expect(beforeBal).to.satisfy((num: bigint) => {
          return num > newBalance || num == foodBalance - 65535n;
        });
        beforeBal = newBalance;
      }

      // Should have died. You still get XP for the ones you killed while processing
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.MELEE)).to.eq(2484); // Killed 69
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.DEFENCE)).to.eq(0);
      expect(await itemNFT.balanceOf(alice, EstforConstants.BRONZE_ARROW)).to.eq(69);
      expect(await itemNFT.balanceOf(alice, EstforConstants.COOKED_MINNUS)).to.eq(
        foodBalance - BigInt(Math.pow(2, 16) - 1)
      );
    });

    // Fix for user issue Snarf
    it("Take into account defence quest XP reward", async function () {
      const {playerId, players, alice, worldActions, itemNFT, choiceId, quests} = await loadFixture(
        playersFixtureMelee
      );

      await itemNFT.addItems([
        {
          ...EstforTypes.defaultItemInput,
          healthRestored: 2,
          tokenId: EstforConstants.COOKED_BLEKK,
          equipPosition: EstforTypes.EquipPosition.FOOD
        }
      ]);

      const natuowAction = allActions.find(
        (a) => a.actionId === EstforConstants.ACTION_COMBAT_NATUOW
      ) as EstforTypes.ActionInput;
      await worldActions.addActions([natuowAction]);

      const grogAction = allActions.find(
        (a) => a.actionId === EstforConstants.ACTION_COMBAT_GROG_TOAD
      ) as EstforTypes.ActionInput;
      await worldActions.addActions([grogAction]);

      await itemNFT.mint(alice, EstforConstants.COOKED_BLEKK, 10000);

      const queuedAction: EstforTypes.QueuedActionInput = {
        attire: EstforTypes.noAttire,
        actionId: EstforConstants.ACTION_COMBAT_NATUOW,
        combatStyle: EstforTypes.CombatStyle.ATTACK,
        choiceId,
        regenerateId: EstforConstants.COOKED_BLEKK,
        timespan: 86400,
        rightHandEquipmentTokenId: EstforConstants.BRONZE_SWORD,
        leftHandEquipmentTokenId: EstforConstants.NONE,
        petId: EstforConstants.NONE
      };

      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);
      await ethers.provider.send("evm_increaseTime", [5518]);
      await ethers.provider.send("evm_mine", []);
      await players.connect(alice).processActions(playerId);

      await ethers.provider.send("evm_increaseTime", [27869]);
      await ethers.provider.send("evm_mine", []);

      const boostValue = 10;
      const boostDuration = 86400;
      await itemNFT.addItems([
        {
          ...EstforTypes.defaultItemInput,
          tokenId: EstforConstants.XP_BOOST,
          equipPosition: EstforTypes.EquipPosition.BOOST_VIAL,
          // Boost
          boostType: EstforTypes.BoostType.ANY_XP,
          boostValue,
          boostDuration,
          isTransferable: false
        }
      ]);
      await itemNFT.mint(alice, EstforConstants.XP_BOOST, 1);
      await ethers.provider.send("evm_increaseTime", [120]);
      await ethers.provider.send("evm_mine", []);
      await players
        .connect(alice)
        .startActionsAdvanced(
          playerId,
          [],
          EstforConstants.XP_BOOST,
          BOOST_START_NOW,
          0,
          NO_DONATION_AMOUNT,
          EstforTypes.ActionQueueStrategy.KEEP_LAST_IN_PROGRESS
        );
      await ethers.provider.send("evm_increaseTime", [240]);
      await ethers.provider.send("evm_mine", []);

      const queuedActionGrog: EstforTypes.QueuedActionInput = {
        attire: EstforTypes.noAttire,
        actionId: EstforConstants.ACTION_COMBAT_GROG_TOAD,
        combatStyle: EstforTypes.CombatStyle.DEFENCE,
        choiceId,
        regenerateId: EstforConstants.COOKED_BLEKK,
        timespan: 32400,
        rightHandEquipmentTokenId: EstforConstants.BRONZE_SWORD,
        leftHandEquipmentTokenId: EstforConstants.NONE,
        petId: EstforConstants.NONE
      };

      // Activate a quest
      const quest1 = allQuests.find((q) => q.questId === QUEST_SUPPLY_RUN) as QuestInput;
      const quest = {
        ...quest1,
        actionId1: queuedAction.actionId,
        actionNum1: 5,
        burnItemTokenId: EstforConstants.NATUOW_HIDE,
        burnAmount: 5
      };
      await quests.addQuests([quest], [defaultMinRequirements]);
      const questId = quest.questId;
      await players.connect(alice).activateQuest(playerId, questId);

      await players
        .connect(alice)
        .startActions(playerId, [queuedActionGrog], EstforTypes.ActionQueueStrategy.KEEP_LAST_IN_PROGRESS);
      await ethers.provider.send("evm_increaseTime", [41700]);
      await ethers.provider.send("evm_mine", []);

      await players.connect(alice).processActions(playerId);

      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.DEFENCE)).to.eq(250);

      let player = await (await getPlayersHelper(players)).getPlayer(playerId);
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
      const {playerId, players, alice, worldActions, itemNFT, choiceId, quests} = await loadFixture(
        playersFixtureMelee
      );

      await itemNFT.addItems([
        {
          ...EstforTypes.defaultItemInput,
          healthRestored: 2,
          tokenId: EstforConstants.COOKED_BLEKK,
          equipPosition: EstforTypes.EquipPosition.FOOD
        }
      ]);

      const natuowAction = allActions.find(
        (a) => a.actionId === EstforConstants.ACTION_COMBAT_NATUOW
      ) as EstforTypes.ActionInput;
      await worldActions.addActions([natuowAction]);

      const grogAction = allActions.find(
        (a) => a.actionId === EstforConstants.ACTION_COMBAT_GROG_TOAD
      ) as EstforTypes.ActionInput;
      await worldActions.addActions([grogAction]);

      await itemNFT.mint(alice, EstforConstants.COOKED_BLEKK, 10000);

      const queuedAction: EstforTypes.QueuedActionInput = {
        attire: EstforTypes.noAttire,
        actionId: EstforConstants.ACTION_COMBAT_NATUOW,
        combatStyle: EstforTypes.CombatStyle.ATTACK,
        choiceId,
        regenerateId: EstforConstants.COOKED_BLEKK,
        timespan: 86400,
        rightHandEquipmentTokenId: EstforConstants.BRONZE_SWORD,
        leftHandEquipmentTokenId: EstforConstants.NONE,
        petId: EstforConstants.NONE
      };

      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);
      await ethers.provider.send("evm_increaseTime", [5518]);
      await ethers.provider.send("evm_mine", []);
      await players.connect(alice).processActions(playerId);

      await ethers.provider.send("evm_increaseTime", [27869]);
      await ethers.provider.send("evm_mine", []);

      const boostValue = 10;
      const boostDuration = 86400;
      await itemNFT.addItems([
        {
          ...EstforTypes.defaultItemInput,
          tokenId: EstforConstants.XP_BOOST,
          equipPosition: EstforTypes.EquipPosition.BOOST_VIAL,
          // Boost
          boostType: EstforTypes.BoostType.ANY_XP,
          boostValue,
          boostDuration,
          isTransferable: false
        }
      ]);
      await itemNFT.mint(alice, EstforConstants.XP_BOOST, 1);
      await ethers.provider.send("evm_increaseTime", [120]);
      await ethers.provider.send("evm_mine", []);
      await players
        .connect(alice)
        .startActionsAdvanced(
          playerId,
          [],
          EstforConstants.XP_BOOST,
          BOOST_START_NOW,
          0,
          NO_DONATION_AMOUNT,
          EstforTypes.ActionQueueStrategy.KEEP_LAST_IN_PROGRESS
        );
      await ethers.provider.send("evm_increaseTime", [240]);
      await ethers.provider.send("evm_mine", []);

      const queuedActionGrog: EstforTypes.QueuedActionInput = {
        attire: EstforTypes.noAttire,
        actionId: EstforConstants.ACTION_COMBAT_GROG_TOAD,
        combatStyle: EstforTypes.CombatStyle.DEFENCE,
        choiceId,
        regenerateId: EstforConstants.COOKED_BLEKK,
        timespan: 32400,
        rightHandEquipmentTokenId: EstforConstants.BRONZE_SWORD,
        leftHandEquipmentTokenId: EstforConstants.NONE,
        petId: EstforConstants.NONE
      };

      // Activate a quest
      const _quest = allQuests.find((q) => q.questId === QUEST_SUPPLY_RUN) as QuestInput;
      const quest = {
        ..._quest,
        actionId1: queuedAction.actionId,
        actionNum1: 5,
        burnItemTokenId: EstforConstants.NATUOW_HIDE,
        burnAmount: 5
      };
      const questMelee = {
        ...quest,
        skillReward: Skill.MELEE,
        questId: QUEST_SUPPLY_RUN + 1
      };
      const questHealth = {
        ...quest,
        skillReward: Skill.HEALTH,
        questId: QUEST_SUPPLY_RUN + 2
      };
      const questMagic = {
        ...quest,
        skillReward: Skill.MAGIC,
        questId: QUEST_SUPPLY_RUN + 3
      };
      const questWoodcutting = {
        ...quest,
        skillReward: Skill.WOODCUTTING,
        questId: QUEST_SUPPLY_RUN + 4
      };
      await quests.addQuests(
        [quest, questMelee, questMagic, questWoodcutting, questHealth],
        [
          defaultMinRequirements,
          defaultMinRequirements,
          defaultMinRequirements,
          defaultMinRequirements,
          defaultMinRequirements
        ]
      );
      const questId = quest.questId;
      await players.connect(alice).activateQuest(playerId, questId);

      await players
        .connect(alice)
        .startActions(playerId, [queuedActionGrog], EstforTypes.ActionQueueStrategy.KEEP_LAST_IN_PROGRESS);

      await ethers.provider.send("evm_increaseTime", [8000]);
      await ethers.provider.send("evm_mine", []);
      await players.connect(alice).activateQuest(playerId, questId + 1);
      await ethers.provider.send("evm_increaseTime", [8000]);
      await ethers.provider.send("evm_mine", []);
      await players.connect(alice).activateQuest(playerId, questId + 2);
      await ethers.provider.send("evm_increaseTime", [8000]);
      await ethers.provider.send("evm_mine", []);
      await players.connect(alice).activateQuest(playerId, questId + 3);
      await ethers.provider.send("evm_increaseTime", [8000]);
      await ethers.provider.send("evm_mine", []);
      await players.connect(alice).activateQuest(playerId, questId + 4);
      await ethers.provider.send("evm_increaseTime", [9700]); // So that it totals 41700 like the other test
      await ethers.provider.send("evm_mine", []);
      await players.connect(alice).processActions(playerId);

      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.DEFENCE)).to.eq(250n);
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.MAGIC)).to.eq(START_XP + 250n);
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.WOODCUTTING)).to.eq(250n);
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.MELEE)).to.eq(1145n + 250n);
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.HEALTH)).to.eq(381n + 250n);

      let player = await (await getPlayersHelper(players)).getPlayer(playerId);
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
      const {
        playerId,
        players,
        alice,
        worldActions,
        itemNFT,
        choiceId,
        brush,
        wishingWell,
        playerNFT,
        avatarId,
        origName
      } = await loadFixture(playersFixtureMelee);

      const boostValue = 50;

      await itemNFT.addItems([
        {
          ...EstforTypes.defaultItemInput,
          healthRestored: 2,
          tokenId: EstforConstants.COOKED_BLEKK,
          equipPosition: EstforTypes.EquipPosition.FOOD
        },
        {
          ...EstforTypes.defaultItemInput,
          tokenId: EstforConstants.XP_BOOST,
          equipPosition: EstforTypes.EquipPosition.BOOST_VIAL,
          // Boost
          boostType: EstforTypes.BoostType.NON_COMBAT_XP,
          boostValue,
          boostDuration: 86400,
          isTransferable: false
        },
        {
          ...EstforTypes.defaultItemInput,
          tokenId: EstforConstants.LUCK_OF_THE_DRAW,
          equipPosition: EstforTypes.EquipPosition.EXTRA_BOOST_VIAL,
          // Boost
          boostType: EstforTypes.BoostType.ANY_XP,
          boostValue: 5,
          boostDuration: 86400,
          isTransferable: false
        }
      ]);

      const natuowAction = allActions.find(
        (a) => a.actionId === EstforConstants.ACTION_COMBAT_NATUOW
      ) as EstforTypes.ActionInput;
      await worldActions.addActions([natuowAction]);

      await itemNFT.mint(alice, EstforConstants.COOKED_BLEKK, 10000);

      const queuedAction: EstforTypes.QueuedActionInput = {
        attire: EstforTypes.noAttire,
        actionId: EstforConstants.ACTION_COMBAT_NATUOW,
        combatStyle: EstforTypes.CombatStyle.ATTACK,
        choiceId,
        regenerateId: EstforConstants.COOKED_BLEKK,
        timespan: 86400,
        rightHandEquipmentTokenId: EstforConstants.BRONZE_SWORD,
        leftHandEquipmentTokenId: EstforConstants.NONE,
        petId: EstforConstants.NONE
      };

      await itemNFT.mint(alice, EstforConstants.XP_BOOST, 1);

      await brush.mint(alice, parseEther("100000"));
      await brush.connect(alice).approve(wishingWell, parseEther("100000"));

      const raffleCost = await wishingWell.getRaffleEntryCost();
      await players
        .connect(alice)
        .startActionsAdvanced(
          playerId,
          [queuedAction],
          EstforConstants.XP_BOOST,
          BOOST_START_NOW,
          0,
          raffleCost,
          EstforTypes.ActionQueueStrategy.OVERWRITE
        );
      await ethers.provider.send("evm_increaseTime", [73318]);
      await ethers.provider.send("evm_mine", []);
      await players.connect(alice).processActions(playerId);
      await players.modifyXP(alice, playerId, EstforTypes.Skill.DEFENCE, 250, SKIP_XP_THRESHOLD_EFFECTS);
      await ethers.provider.send("evm_increaseTime", [240]);
      await ethers.provider.send("evm_mine", []);
      expect((await players.getActiveBoost(playerId)).boostType).to.not.eq(0);
      expect((await players.getActiveBoost(playerId)).extraBoostType).to.not.eq(0);

      // Make a new player active so the old one is cleared
      const makeActive = true;
      await createPlayer(playerNFT, avatarId, alice, origName + 1, makeActive, "", "", "", false);

      expect((await players.getActionQueue(playerId)).length).to.eq(0);
      // Active boost should be removed
      expect((await players.getActiveBoost(playerId)).boostType).to.eq(0);
      // Should remove the extra boost
      expect((await players.getActiveBoost(playerId)).extraBoostType).to.eq(0);
    });

    it("Check random rewards", async function () {
      const {playerId, players, randomnessBeacon, itemNFT, alice, queuedAction, numSpawned, mockVRF} =
        await loadFixture(playersFixtureMelee);

      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);

      const time = 3600;
      await timeTravel(time);
      let pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
      expect(pendingQueuedActionState.actionMetadatas.length).to.eq(1);
      expect(pendingQueuedActionState.actionMetadatas[0].xpGained).to.eq(time + time / 3);
      expect(pendingQueuedActionState.actionMetadatas[0].rolls).to.eq(numSpawned / SPAWN_MUL);
      await players.connect(alice).processActions(playerId);
      await timeTravel24Hours();
      await requestAndFulfillRandomWordsSeeded(randomnessBeacon, mockVRF, 200_000_000n);
      await requestAndFulfillRandomWordsSeeded(randomnessBeacon, mockVRF, 300_000_000n);
      await players.connect(alice).processActions(playerId);

      expect(await itemNFT.balanceOf(alice, EstforConstants.POISON))
        .to.be.greaterThanOrEqual(2)
        .and.to.be.lessThanOrEqual(8);
    });

    it("Check random rewards, finish after 00:00 before oracle is called", async function () {
      const {playerId, players, randomnessBeacon, alice, queuedAction, numSpawned, mockVRF} = await loadFixture(
        playersFixtureMelee
      );

      await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);

      const oneDay = 24 * 3600;
      let {timestamp: currentTimestamp} = (await ethers.provider.getBlock("latest")) as Block;
      let timestamp = Math.floor(currentTimestamp / oneDay) * oneDay + oneDay; // go to 00:00

      await ethers.provider.send("evm_setNextBlockTimestamp", [timestamp + 1]);
      await ethers.provider.send("evm_mine", []);

      await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);

      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);
      await ethers.provider.send("evm_increaseTime", [24 * 3600]); // Finishes just after 00:00 the next day at 23:00
      await ethers.provider.send("evm_mine", []);

      // Should get rolls
      let pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
      expect(pendingQueuedActionState.actionMetadatas.length).to.eq(1);
      expect(pendingQueuedActionState.actionMetadatas[0].rolls).to.eq(numSpawned / SPAWN_MUL);
      await players.connect(alice).processActions(playerId);

      // Call oracle
      await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);

      await expect(randomnessBeacon.requestRandomWords()).to.be.reverted;

      pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
      expect(pendingQueuedActionState.numPastRandomRewardInstancesToRemove).to.be.gt(0);
    });

    it("Check random rewards, process after waiting another day", async function () {
      const {playerId, players, randomnessBeacon, itemNFT, alice, queuedAction, numSpawned, mockVRF} =
        await loadFixture(playersFixtureMelee);

      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);

      const time = 3600;
      await timeTravel(time);
      let pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
      expect(pendingQueuedActionState.actionMetadatas.length).to.eq(1);
      expect(pendingQueuedActionState.actionMetadatas[0].xpGained).to.eq(time + time / 3);
      expect(pendingQueuedActionState.actionMetadatas[0].rolls).to.eq(numSpawned / SPAWN_MUL);
      await timeTravel24Hours();
      await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);
      await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);
      await players.connect(alice).processActions(playerId);
      // Regardless of waiting another day of combat, you don't get the rewards till the following day
      expect(await itemNFT.balanceOf(alice, EstforConstants.POISON)).to.eq(0);

      await timeTravel24Hours();
      await requestAndFulfillRandomWordsSeeded(randomnessBeacon, mockVRF, 100_000_000_000n);

      pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
      expect(pendingQueuedActionState.producedPastRandomRewards.length).to.eq(1);
      await players.connect(alice).processActions(playerId);

      expect(await itemNFT.balanceOf(alice, EstforConstants.POISON))
        .is.above(0)
        .and.is.below(numSpawned / SPAWN_MUL);
    });

    it("Check random rewards, in-progress updates (many)", async function () {
      const {playerId, players, randomnessBeacon, itemNFT, alice, queuedAction, rate, numSpawned, mockVRF} =
        await loadFixture(playersFixtureMelee);

      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);

      const numLoops = queuedAction.timespan / 240;
      expect(numLoops).to.not.eq(0);

      for (let i = 0; i < numLoops; ++i) {
        // Increase by random time
        const randomTimespan = Math.floor(Math.random() * 240);
        await timeTravel(randomTimespan);
        await players.connect(alice).processActions(playerId);
      }

      await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);
      await timeTravel24Hours();
      await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);
      await players.connect(alice).processActions(playerId);

      await timeTravel24Hours();
      await requestAndFulfillRandomWordsSeeded(randomnessBeacon, mockVRF, 10_000_000n);

      const pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
      expect(pendingQueuedActionState.producedPastRandomRewards.length).to.eq(1);
      await players.connect(alice).processActions(playerId);

      expect(await itemNFT.balanceOf(alice, EstforConstants.POISON)).to.be.deep.oneOf([
        BigInt(numSpawned / (SPAWN_MUL * 2) - 3),
        BigInt(numSpawned / (SPAWN_MUL * 2) - 2),
        BigInt(numSpawned / (SPAWN_MUL * 2) - 1),
        BigInt(numSpawned / (SPAWN_MUL * 2)),
        BigInt(numSpawned / (SPAWN_MUL * 2) + 1),
        BigInt(numSpawned / (SPAWN_MUL * 2) + 2),
        BigInt(numSpawned / (SPAWN_MUL * 2) + 3)
      ]); // Roughly 1/2 of the time
    });
  });

  describe("Magic", function () {
    async function playersFixtureMagic() {
      const fixture = await loadFixture(playersFixture);
      const {itemNFT, worldActions, alice} = fixture;

      const monsterCombatStats: EstforTypes.CombatStats = {
        meleeAttack: 3,
        magicAttack: 0,
        rangedAttack: 0,
        meleeDefence: 0,
        magicDefence: 0,
        rangedDefence: 0,
        health: 5
      };

      const dropRate = 1 * GUAR_MUL; // per monster
      const numSpawned = 10 * SPAWN_MUL;
      let tx = await worldActions.addActions([
        {
          actionId: 1,
          info: {
            ...defaultActionInfo,
            skill: EstforTypes.Skill.COMBAT,
            xpPerHour: 3600,
            minXP: 0,
            numSpawned,
            handItemTokenIdRangeMin: EstforConstants.COMBAT_BASE,
            handItemTokenIdRangeMax: EstforConstants.COMBAT_MAX,
            isAvailable: actionIsAvailable,
            actionChoiceRequired: true,
            successPercent: 100
          },
          guaranteedRewards: [{itemTokenId: EstforConstants.BRONZE_ARROW, rate: dropRate}],
          randomRewards: [],
          combatStats: monsterCombatStats
        }
      ]);
      const actionId = await getActionId(tx, worldActions);

      await itemNFT.mintBatch(
        alice,
        [
          EstforConstants.TOTEM_STAFF,
          EstforConstants.BRONZE_SHIELD,
          EstforConstants.COOKED_MINNUS,
          EstforConstants.AIR_SCROLL,
          EstforConstants.SHADOW_SCROLL
        ],
        [1, 1, 1000, 200, 100]
      );

      const scrollsConsumedRate = 1 * RATE_MUL; // per hour
      tx = await worldActions.addActionChoices(
        EstforConstants.NONE,
        [1],
        [
          {
            ...defaultActionChoice,
            skill: EstforTypes.Skill.MAGIC,
            rate: scrollsConsumedRate,
            inputTokenIds: [EstforConstants.SHADOW_SCROLL, EstforConstants.AIR_SCROLL],
            inputAmounts: [1, 2],
            skills: [EstforTypes.Skill.MAGIC],
            skillDiffs: [2],
            skillMinXPs: [0]
          }
        ]
      );
      const choiceId = await getActionChoiceId(tx, worldActions);
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
        petId: EstforConstants.NONE
      };

      await itemNFT.addItems([
        {
          ...EstforTypes.defaultItemInput,
          tokenId: EstforConstants.AIR_SCROLL,
          equipPosition: EstforTypes.EquipPosition.MAGIC_BAG
        },
        {
          ...EstforTypes.defaultItemInput,
          tokenId: EstforConstants.SHADOW_SCROLL,
          equipPosition: EstforTypes.EquipPosition.MAGIC_BAG
        },
        {
          ...EstforTypes.defaultItemInput,
          tokenId: EstforConstants.TOTEM_STAFF,
          equipPosition: EstforTypes.EquipPosition.BOTH_HANDS
        },
        {
          ...EstforTypes.defaultItemInput,
          tokenId: EstforConstants.BRONZE_SHIELD,
          equipPosition: EstforTypes.EquipPosition.LEFT_HAND
        },
        {
          ...EstforTypes.defaultItemInput,
          tokenId: EstforConstants.BRONZE_ARROW,
          equipPosition: EstforTypes.EquipPosition.QUIVER
        },
        {
          ...EstforTypes.defaultItemInput,
          healthRestored: 12,
          tokenId: EstforConstants.COOKED_MINNUS,
          equipPosition: EstforTypes.EquipPosition.FOOD
        }
      ]);

      const startXP = START_XP;
      return {
        ...fixture,
        timespan,
        actionId,
        dropRate,
        queuedAction,
        startXP,
        numSpawned
      };
    }

    it("Attack", async function () {
      const {playerId, players, itemNFT, alice, timespan, dropRate, queuedAction, startXP, numSpawned} =
        await loadFixture(playersFixtureMagic);

      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);

      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]);
      await ethers.provider.send("evm_mine", []);
      await players.connect(alice).processActions(playerId);
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.MAGIC)).to.eq(
        startXP + BigInt(Math.floor(queuedAction.timespan * 1.1))
      );
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.HEALTH)).to.be.deep.oneOf([
        // This shouldn't be boosted by magic boost
        BigInt(Math.floor(queuedAction.timespan / 3)),
        BigInt(Math.floor(queuedAction.timespan / 3) - 1)
      ]);
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.DEFENCE)).to.eq(0);

      // Check the drops are as expected
      expect(await itemNFT.balanceOf(alice, EstforConstants.BRONZE_ARROW)).to.eq(
        Math.floor((timespan * dropRate * numSpawned) / (3600 * GUAR_MUL * SPAWN_MUL))
      );

      // Check food is consumed
      expect(await itemNFT.balanceOf(alice, EstforConstants.COOKED_MINNUS)).to.eq(1000 - 2);

      // Use at least 1 scroll per monster
      expect(await itemNFT.balanceOf(alice, EstforConstants.AIR_SCROLL)).to.eq(200 - 20);
      expect(await itemNFT.balanceOf(alice, EstforConstants.SHADOW_SCROLL)).to.eq(100 - 10);
    });

    it("Attack, use defensive scrolls ", async function () {
      const {playerId, players, itemNFT, alice, timespan, dropRate, queuedAction, startXP, numSpawned, worldActions} =
        await loadFixture(playersFixtureMagic);

      const scrollsConsumedRate = 1 * RATE_MUL; // per hour
      let tx = await worldActions.addActionChoices(
        EstforConstants.NONE,
        [2],
        [
          {
            ...defaultActionChoice,
            skill: EstforTypes.Skill.MAGIC,
            rate: scrollsConsumedRate,
            inputTokenIds: [EstforConstants.SHADOW_SCROLL, EstforConstants.AIR_SCROLL],
            inputAmounts: [1, 2],
            skills: [EstforTypes.Skill.DEFENCE],
            skillDiffs: [100],
            skillMinXPs: [0]
          }
        ]
      );

      const choiceId = getActionChoiceId(tx, worldActions);
      const queuedActionDefence: QueuedActionInput = {...queuedAction, choiceId};

      await players
        .connect(alice)
        .startActions(playerId, [queuedActionDefence], EstforTypes.ActionQueueStrategy.OVERWRITE);

      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]);
      await ethers.provider.send("evm_mine", []);
      await players.connect(alice).processActions(playerId);
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.MAGIC)).to.eq(
        startXP + BigInt(Math.floor(queuedActionDefence.timespan * 1.1))
      );
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.HEALTH)).to.be.deep.oneOf([
        // This shouldn't be boosted by magic boost
        BigInt(Math.floor(queuedActionDefence.timespan / 3)),
        BigInt(Math.floor(queuedActionDefence.timespan / 3) - 1)
      ]);
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.DEFENCE)).to.eq(0);

      // Check the drops are as expected
      expect(await itemNFT.balanceOf(alice, EstforConstants.BRONZE_ARROW)).to.eq(
        Math.floor((timespan * dropRate * numSpawned) / (3600 * GUAR_MUL * SPAWN_MUL))
      );

      // Check food is consumed
      expect(await itemNFT.balanceOf(alice, EstforConstants.COOKED_MINNUS)).to.eq(1000 - 1);

      // Use at least 1 scroll per monster
      expect(await itemNFT.balanceOf(alice, EstforConstants.AIR_SCROLL)).to.eq(200 - 20);
      expect(await itemNFT.balanceOf(alice, EstforConstants.SHADOW_SCROLL)).to.eq(100 - 10);
    });

    it("Attack, use health scrolls ", async function () {
      const {playerId, players, itemNFT, alice, timespan, dropRate, queuedAction, startXP, numSpawned, worldActions} =
        await loadFixture(playersFixtureMagic);

      const scrollsConsumedRate = 1 * RATE_MUL; // per hour
      let tx = await worldActions.addActionChoices(
        EstforConstants.NONE,
        [2],
        [
          {
            ...defaultActionChoice,
            skill: EstforTypes.Skill.MAGIC,
            skills: [EstforTypes.Skill.HEALTH],
            skillMinXPs: [0],
            skillDiffs: [100],
            rate: scrollsConsumedRate,
            inputTokenIds: [EstforConstants.SHADOW_SCROLL, EstforConstants.AIR_SCROLL],
            inputAmounts: [1, 2]
          }
        ]
      );

      const choiceId = getActionChoiceId(tx, worldActions);
      const queuedActionDefence: QueuedActionInput = {...queuedAction, choiceId};

      await players
        .connect(alice)
        .startActions(playerId, [queuedActionDefence], EstforTypes.ActionQueueStrategy.OVERWRITE);

      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]);
      await ethers.provider.send("evm_mine", []);
      await players.connect(alice).processActions(playerId);
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.MAGIC)).to.eq(
        startXP + BigInt(Math.floor(queuedActionDefence.timespan * 1.1))
      );
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.HEALTH)).to.be.deep.oneOf([
        // This shouldn't be boosted by magic boost
        BigInt(Math.floor(queuedActionDefence.timespan / 3)),
        BigInt(Math.floor(queuedActionDefence.timespan / 3) - 1)
      ]);
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.DEFENCE)).to.eq(0);

      // Check the drops are as expected
      expect(await itemNFT.balanceOf(alice, EstforConstants.BRONZE_ARROW)).to.eq(
        Math.floor((timespan * dropRate * numSpawned) / (3600 * GUAR_MUL * SPAWN_MUL))
      );

      // No food is consumed
      expect(await itemNFT.balanceOf(alice, EstforConstants.COOKED_MINNUS)).to.eq(1000);

      // Use at least 1 scroll per monster
      expect(await itemNFT.balanceOf(alice, EstforConstants.AIR_SCROLL)).to.eq(200 - 20);
      expect(await itemNFT.balanceOf(alice, EstforConstants.SHADOW_SCROLL)).to.eq(100 - 10);
    });

    it("Have no scrolls first then process with them", async function () {});

    it("In-progress combat update", async function () {
      const {players, playerId, itemNFT, alice, worldActions} = await loadFixture(playersFixture);

      const monsterCombatStats: EstforTypes.CombatStats = {
        meleeAttack: 1,
        magicAttack: 0,
        rangedAttack: 0,
        meleeDefence: 0,
        magicDefence: 0,
        rangedDefence: 0,
        health: 36
      };

      const dropRate = 1 * GUAR_MUL; // per monster
      const numSpawned = 100 * SPAWN_MUL;
      let tx = await worldActions.addActions([
        {
          actionId: 1,
          info: {
            ...defaultActionInfo,
            skill: EstforTypes.Skill.COMBAT,
            xpPerHour: 3600,
            minXP: 0,
            numSpawned,
            handItemTokenIdRangeMin: EstforConstants.COMBAT_BASE,
            handItemTokenIdRangeMax: EstforConstants.COMBAT_MAX,
            isAvailable: actionIsAvailable,
            actionChoiceRequired: true,
            successPercent: 100
          },
          guaranteedRewards: [{itemTokenId: EstforConstants.BRONZE_ARROW, rate: dropRate}],
          randomRewards: [],
          combatStats: monsterCombatStats
        }
      ]);
      const actionId = await getActionId(tx, worldActions);

      await itemNFT.mintBatch(
        alice,
        [
          EstforConstants.TOTEM_STAFF,
          EstforConstants.BRONZE_SHIELD,
          EstforConstants.COOKED_MINNUS,
          EstforConstants.AIR_SCROLL,
          EstforConstants.SHADOW_SCROLL
        ],
        [1, 1, 1000, 200, 100]
      );

      // Start with 5 magic
      const scrollsConsumedRate = 100 * RATE_MUL; // per hour
      tx = await worldActions.addActionChoices(
        EstforConstants.NONE,
        [1],
        [
          {
            ...defaultActionChoice,
            skill: EstforTypes.Skill.MAGIC,
            rate: scrollsConsumedRate,
            inputTokenIds: [EstforConstants.SHADOW_SCROLL, EstforConstants.AIR_SCROLL],
            inputAmounts: [1, 2],
            skills: [EstforTypes.Skill.MAGIC],
            skillDiffs: [5],
            skillMinXPs: [0]
          }
        ]
      );
      const choiceId = await getActionChoiceId(tx, worldActions);
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
        petId: EstforConstants.NONE
      };

      await itemNFT.addItems([
        {
          ...EstforTypes.defaultItemInput,
          tokenId: EstforConstants.AIR_SCROLL,
          equipPosition: EstforTypes.EquipPosition.MAGIC_BAG
        },
        {
          ...EstforTypes.defaultItemInput,
          tokenId: EstforConstants.SHADOW_SCROLL,
          equipPosition: EstforTypes.EquipPosition.MAGIC_BAG
        },
        {
          ...EstforTypes.defaultItemInput,
          tokenId: EstforConstants.TOTEM_STAFF,
          equipPosition: EstforTypes.EquipPosition.BOTH_HANDS
        },
        {
          ...EstforTypes.defaultItemInput,
          tokenId: EstforConstants.BRONZE_ARROW,
          equipPosition: EstforTypes.EquipPosition.QUIVER
        },
        {
          ...EstforTypes.defaultItemInput,
          healthRestored: 12,
          tokenId: EstforConstants.COOKED_MINNUS,
          equipPosition: EstforTypes.EquipPosition.FOOD
        }
      ]);

      // Should be killing 1 every 72 seconds.
      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);
      await ethers.provider.send("evm_increaseTime", [36]);
      await ethers.provider.send("evm_mine", []);

      // Check the XP is as expected
      const startXP = START_XP;
      await players.connect(alice).processActions(playerId);
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.MAGIC)).to.eq(startXP);
      expect(await itemNFT.balanceOf(alice, EstforConstants.BRONZE_ARROW)).to.eq(0);

      await ethers.provider.send("evm_increaseTime", [30]);
      await ethers.provider.send("evm_mine", []);
      await players.connect(alice).processActions(playerId);
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.MAGIC)).to.eq(startXP);
      expect(await itemNFT.balanceOf(alice, EstforConstants.BRONZE_ARROW)).to.eq(0);

      await ethers.provider.send("evm_increaseTime", [10]);
      await ethers.provider.send("evm_mine", []);
      await players.connect(alice).processActions(playerId);
      // Killed 1 monster, 80s of combat has passed
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.MAGIC)).to.eq(startXP + (36n * 11n) / 10n); // Add the boost
      // Check the drops are as expected
      expect(await itemNFT.balanceOf(alice, EstforConstants.BRONZE_ARROW)).to.eq(Math.floor(dropRate / 10));

      // Check food is consumed
      expect(await itemNFT.balanceOf(alice, EstforConstants.COOKED_MINNUS)).to.eq(1000 - 1);

      // Check that scrolls are consumed. 80s of combat is 3 sets of scrolls used.
      expect(await itemNFT.balanceOf(alice, EstforConstants.AIR_SCROLL)).to.eq(200 - 6);
      expect(await itemNFT.balanceOf(alice, EstforConstants.SHADOW_SCROLL)).to.eq(100 - 3);

      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]);
      await ethers.provider.send("evm_mine", []);
      await players.connect(alice).processActions(playerId);
      // Use up all the scrolls
      expect(await itemNFT.balanceOf(alice, EstforConstants.AIR_SCROLL)).to.eq(0);
      expect(await itemNFT.balanceOf(alice, EstforConstants.SHADOW_SCROLL)).to.eq(0);

      // Killed 50 monsters (10% base boost)
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.MAGIC)).to.eq(
        startXP + BigInt(Math.floor(queuedAction.timespan * 0.5 * 1.1))
      );
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.HEALTH)).to.eq(
        Math.floor(queuedAction.timespan / (2 * 3))
      );
    });

    it("In-progress combat updates (many)", async function () {
      const {players, playerId, itemNFT, alice, worldActions} = await loadFixture(playersFixture);

      const monsterCombatStats: EstforTypes.CombatStats = {
        meleeAttack: 1,
        magicAttack: 0,
        rangedAttack: 0,
        meleeDefence: 0,
        magicDefence: 0,
        rangedDefence: 0,
        health: 36
      };

      const dropRate = 1 * GUAR_MUL; // per monster
      const numSpawned = 100 * SPAWN_MUL;
      let tx = await worldActions.addActions([
        {
          actionId: 1,
          info: {
            ...defaultActionInfo,
            skill: EstforTypes.Skill.COMBAT,
            xpPerHour: 3600,
            minXP: 0,
            numSpawned,
            handItemTokenIdRangeMin: EstforConstants.COMBAT_BASE,
            handItemTokenIdRangeMax: EstforConstants.COMBAT_MAX,
            isAvailable: actionIsAvailable,
            actionChoiceRequired: true,
            successPercent: 100
          },
          guaranteedRewards: [{itemTokenId: EstforConstants.BRONZE_ARROW, rate: dropRate}],
          randomRewards: [],
          combatStats: monsterCombatStats
        }
      ]);
      const actionId = await getActionId(tx, worldActions);

      await itemNFT.mintBatch(
        alice,
        [
          EstforConstants.TOTEM_STAFF,
          EstforConstants.BRONZE_SHIELD,
          EstforConstants.COOKED_MINNUS,
          EstforConstants.AIR_SCROLL,
          EstforConstants.SHADOW_SCROLL
        ],
        [1, 1, 1000, 200, 100]
      );

      // Start with 5 magic
      const scrollsConsumedRate = 100 * RATE_MUL; // per hour
      tx = await worldActions.addActionChoices(
        EstforConstants.NONE,
        [1],
        [
          {
            ...defaultActionChoice,
            skill: EstforTypes.Skill.MAGIC,
            rate: scrollsConsumedRate,
            inputTokenIds: [EstforConstants.SHADOW_SCROLL, EstforConstants.AIR_SCROLL],
            inputAmounts: [1, 2],
            skills: [EstforTypes.Skill.MAGIC],
            skillDiffs: [5],
            skillMinXPs: [0]
          }
        ]
      );
      const choiceId = await getActionChoiceId(tx, worldActions);
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
        petId: EstforConstants.NONE
      };

      await itemNFT.addItems([
        {
          ...EstforTypes.defaultItemInput,
          tokenId: EstforConstants.AIR_SCROLL,
          equipPosition: EstforTypes.EquipPosition.MAGIC_BAG
        },
        {
          ...EstforTypes.defaultItemInput,
          tokenId: EstforConstants.SHADOW_SCROLL,
          equipPosition: EstforTypes.EquipPosition.MAGIC_BAG
        },
        {
          ...EstforTypes.defaultItemInput,
          tokenId: EstforConstants.TOTEM_STAFF,
          equipPosition: EstforTypes.EquipPosition.BOTH_HANDS
        },
        {
          ...EstforTypes.defaultItemInput,
          tokenId: EstforConstants.BRONZE_ARROW,
          equipPosition: EstforTypes.EquipPosition.QUIVER
        },
        {
          ...EstforTypes.defaultItemInput,
          healthRestored: 12,
          tokenId: EstforConstants.COOKED_MINNUS,
          equipPosition: EstforTypes.EquipPosition.FOOD
        }
      ]);

      // Should be killing 1 every 72 seconds.
      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);

      const numLoops = queuedAction.timespan / 240;
      expect(numLoops).to.not.eq(0);

      for (let i = 0; i < numLoops; ++i) {
        // Increase by random time
        const randomTimespan = Math.floor(Math.random() * 240);
        await ethers.provider.send("evm_increaseTime", [randomTimespan]);
        await ethers.provider.send("evm_mine", []);
        await players.connect(alice).processActions(playerId);
      }
      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]); // This makes sure everything is used
      await ethers.provider.send("evm_mine", []);
      await players.connect(alice).processActions(playerId);

      // Use up all the scrolls
      expect(await itemNFT.balanceOf(alice, EstforConstants.AIR_SCROLL)).to.eq(0);
      expect(await itemNFT.balanceOf(alice, EstforConstants.SHADOW_SCROLL)).to.eq(0);

      // Killed 50 monsters (10% base boost)
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.MAGIC)).to.eq(
        START_XP + BigInt(Math.floor(queuedAction.timespan * 0.5 * 1.1))
      );
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.HEALTH)).to.eq(
        Math.floor(queuedAction.timespan / (2 * 3))
      );
    });

    it("No-Bonus XP", async function () {
      const {players, playerNFT, itemNFT, alice, timespan, dropRate, queuedAction, numSpawned} = await loadFixture(
        playersFixtureMagic
      );

      const avatarId = 2;
      const avatarInfo: AvatarInfo = {
        name: "Name goes here",
        description: "Hi I'm a description",
        imageURI: "1234.png",
        startSkills: [Skill.WOODCUTTING, Skill.NONE]
      };
      await playerNFT.setAvatars([avatarId], [avatarInfo]);

      const noSkillPlayerId = await createPlayer(playerNFT, avatarId, alice, "fakename123", true);
      await players
        .connect(alice)
        .startActions(noSkillPlayerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);

      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]);
      await ethers.provider.send("evm_mine", []);
      await players.connect(alice).processActions(noSkillPlayerId);
      expect(await players.getPlayerXP(noSkillPlayerId, EstforTypes.Skill.MAGIC)).to.eq(queuedAction.timespan);
      expect(await players.getPlayerXP(noSkillPlayerId, EstforTypes.Skill.HEALTH)).to.be.deep.oneOf([
        BigInt(Math.floor(queuedAction.timespan / 3)),
        BigInt(Math.floor(queuedAction.timespan / 3) - 1)
      ]);
      expect(await players.getPlayerXP(noSkillPlayerId, EstforTypes.Skill.DEFENCE)).to.eq(0);

      // Check the drops are as expected
      expect(await itemNFT.balanceOf(alice, EstforConstants.BRONZE_ARROW)).to.eq(
        Math.floor((timespan * dropRate * numSpawned) / (3600 * GUAR_MUL * SPAWN_MUL))
      );

      // Check food is consumed
      expect(await itemNFT.balanceOf(alice, EstforConstants.COOKED_MINNUS)).to.eq(1000 - 4);

      // Check that scrolls are consumed
      expect(await itemNFT.balanceOf(alice, EstforConstants.AIR_SCROLL)).to.eq(200 - 20);
      expect(await itemNFT.balanceOf(alice, EstforConstants.SHADOW_SCROLL)).to.eq(100 - 10);
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
        numSpawned
      } = await loadFixture(playersFixtureMagic);

      const queuedAction = {...magicQueuedAction};
      queuedAction.rightHandEquipmentTokenId = EstforConstants.NONE;

      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);

      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]);
      await ethers.provider.send("evm_mine", []);
      await players.connect(alice).processActions(playerId);
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.MAGIC)).to.eq(
        startXP + BigInt(Math.floor(queuedAction.timespan * 1.1))
      );
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.DEFENCE)).to.eq(0);

      // Check the drops are as expected
      expect(await itemNFT.balanceOf(alice, EstforConstants.BRONZE_ARROW)).to.eq(
        Math.floor((timespan * dropRate * numSpawned) / (3600 * GUAR_MUL * SPAWN_MUL))
      );

      // Check food is consumed
      expect(await itemNFT.balanceOf(alice, EstforConstants.COOKED_MINNUS)).to.eq(1000 - 2);

      // Check that scrolls are consumed
      expect(await itemNFT.balanceOf(alice, EstforConstants.AIR_SCROLL)).to.eq(200 - 20);
      expect(await itemNFT.balanceOf(alice, EstforConstants.SHADOW_SCROLL)).to.eq(100 - 10);
    });

    it("Cannot equip shield with a staff", async function () {
      const {playerId, players, alice, queuedAction: magicQueuedAction} = await loadFixture(playersFixtureMagic);

      const queuedAction = {...magicQueuedAction};

      queuedAction.leftHandEquipmentTokenId = EstforConstants.BRONZE_SHIELD;
      await expect(
        players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE)
      ).to.be.revertedWithCustomError(players, "CannotEquipTwoHandedAndOtherEquipment");
      queuedAction.leftHandEquipmentTokenId = EstforConstants.NONE;
      await expect(
        players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE)
      ).to.not.be.reverted;
    });

    it("Large negative magic defence should not have a big effect against low combat enemies", async function () {
      const {
        playerId,
        players,
        alice,
        itemNFT,
        queuedAction: magicQueuedAction
      } = await loadFixture(playersFixtureMagic);

      await itemNFT.addItems([
        {
          ...EstforTypes.defaultItemInput,
          tokenId: EstforConstants.IRON_GAUNTLETS,
          equipPosition: EstforTypes.EquipPosition.ARMS,
          combatStats: {...EstforTypes.emptyCombatStats, magicDefence: -10000}
        }
      ]);

      const queuedAction = {
        ...magicQueuedAction,
        attire: {...magicQueuedAction.attire, arms: EstforConstants.IRON_GAUNTLETS},
        timespan: 24 * 3600
      };

      await itemNFT.mint(alice, EstforConstants.IRON_GAUNTLETS, 1);
      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);
      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]);
      await ethers.provider.send("evm_mine", []);
      let pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
      // Confirm you aren't dead
      expect(pendingQueuedActionState.actionMetadatas[0].died).to.be.false;
    });

    it("No scrolls equipped during processing action", async function () {
      const {playerId, players, itemNFT, alice, queuedAction, startXP} = await loadFixture(playersFixtureMagic);

      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);

      const balance = await itemNFT.balanceOf(alice, EstforConstants.AIR_SCROLL);
      await itemNFT.connect(alice).burn(alice, EstforConstants.AIR_SCROLL, balance);

      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]);
      await ethers.provider.send("evm_mine", []);
      await players.connect(alice).processActions(playerId);
      // Should get no XP
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.MAGIC)).to.eq(startXP);
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.DEFENCE)).to.eq(0);
      // Check food is consumed
      expect(await itemNFT.balanceOf(alice, EstforConstants.COOKED_MINNUS)).to.eq(1000 - 40);

      // Check that no scrolls are consumed
      expect(await itemNFT.balanceOf(alice, EstforConstants.AIR_SCROLL)).to.eq(0);
      expect(await itemNFT.balanceOf(alice, EstforConstants.SHADOW_SCROLL)).to.eq(100);
    });

    it("currentAction in-progress actions", async function () {
      const {playerId, players, alice, itemNFT, queuedAction, startXP} = await loadFixture(playersFixtureMagic);

      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);
      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan / 2]);
      await ethers.provider.send("evm_mine", []);
      let {timestamp: NOW} = (await ethers.provider.getBlock("latest")) as Block;
      await players.connect(alice).processActions(playerId);
      const xpGained = BigInt(Math.floor(queuedAction.timespan * 0.5 * 1.1));
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.MAGIC)).to.eq(startXP + xpGained);

      let player = await (await getPlayersHelper(players)).getPlayer(playerId);
      expect(player.currentActionStartTimestamp).to.eq(NOW + 1);
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
      const {timestamp: NOW1} = (await ethers.provider.getBlock("latest")) as Block;
      NOW = NOW1;
      await players.connect(alice).processActions(playerId);
      player = await (await getPlayersHelper(players)).getPlayer(playerId);
      expect(player.currentActionStartTimestamp).to.eq(NOW + 1);
      expect(player.currentActionProcessedSkill1).to.eq(Skill.MAGIC);
      expect(player.currentActionProcessedXPGained1).to.eq(xpGained);
      expect(player.currentActionProcessedSkill2).to.eq(Skill.HEALTH);
      expect(player.currentActionProcessedXPGained2).to.eq(queuedAction.timespan / 2 / 3);
      expect(player.currentActionProcessedFoodConsumed).to.eq(1);
      expect(player.currentActionProcessedBaseInputItemsConsumedNum).to.eq(5);

      // Check food is consumed
      expect(await itemNFT.balanceOf(alice, EstforConstants.COOKED_MINNUS)).to.eq(1000 - 1);

      // Check that scrolls are consumed
      expect(await itemNFT.balanceOf(alice, EstforConstants.AIR_SCROLL)).to.eq(200 - 10);
      expect(await itemNFT.balanceOf(alice, EstforConstants.SHADOW_SCROLL)).to.eq(100 - 5);

      // Finish action should be zeroed out
      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]);
      await ethers.provider.send("evm_mine", []);
      await players.connect(alice).processActions(playerId);
      player = await (await getPlayersHelper(players)).getPlayer(playerId);
      expect(player.currentActionStartTimestamp).to.eq(0);
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

      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);
      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan / 4]);
      await ethers.provider.send("evm_mine", []);
      await players.connect(alice).processActions(playerId);

      // Check that scrolls are consumed
      expect(await itemNFT.balanceOf(alice, EstforConstants.AIR_SCROLL)).to.eq(200 - 4);
      expect(await itemNFT.balanceOf(alice, EstforConstants.SHADOW_SCROLL)).to.eq(100 - 2);
      // Check food is consumed
      expect(await itemNFT.balanceOf(alice, EstforConstants.COOKED_MINNUS)).to.eq(1000 - 1);

      // Burn remaining scrolls except 2 set
      await itemNFT.connect(alice).burn(alice, EstforConstants.SHADOW_SCROLL, 100 - 5);

      // Check the drops are as expected
      // Can only kill 2 of them which is why XP is / 5 here
      expect(await itemNFT.balanceOf(alice, EstforConstants.BRONZE_ARROW)).to.eq(
        Math.floor(((queuedAction.timespan / 5) * dropRate * numSpawned) / (3600 * GUAR_MUL * SPAWN_MUL))
      );

      let xpGained = BigInt(Math.floor(queuedAction.timespan * 0.2 * 1.1));
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.MAGIC)).to.eq(startXP + xpGained);

      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan / 4]);
      await ethers.provider.send("evm_mine", []);
      let pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
      expect(pendingQueuedActionState.processedData.currentAction.foodConsumed).to.eq(1);
      await itemNFT.connect(alice).burn(alice, EstforConstants.SHADOW_SCROLL, 2);
      pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
      expect(pendingQueuedActionState.processedData.currentAction.foodConsumed).to.eq(9); // Don't kill them all but in combat for the whole time

      await players.connect(alice).processActions(playerId);
      // Check that 1 set of scrolls is consumed, and only get 1 kill

      // Check food is consumed for the whole combat
      expect(await itemNFT.balanceOf(alice, EstforConstants.COOKED_MINNUS)).to.eq(1000 - 9);

      expect(await itemNFT.balanceOf(alice, EstforConstants.BRONZE_ARROW)).to.eq(
        Math.floor(((queuedAction.timespan / 5) * dropRate * numSpawned) / (3600 * GUAR_MUL * SPAWN_MUL)) + 1
      );

      xpGained += BigInt(Math.floor(queuedAction.timespan * 0.2 * 0.5 * 1.1)); // Kill 1 more
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.MAGIC)).to.eq(startXP + xpGained);

      // Now have enough scrolls
      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan / 4]);
      await ethers.provider.send("evm_mine", []);
      await itemNFT.connect(alice).mint(alice, EstforConstants.SHADOW_SCROLL, 100);
      await players.connect(alice).processActions(playerId);

      // Check no more food is consumed as this is an excess
      expect(await itemNFT.balanceOf(alice, EstforConstants.COOKED_MINNUS)).to.eq(1000 - 9);
      expect(await itemNFT.balanceOf(alice, EstforConstants.BRONZE_ARROW)).to.eq(
        Math.floor(((queuedAction.timespan / 5) * dropRate * numSpawned) / (3600 * GUAR_MUL * SPAWN_MUL)) + 5
      );

      xpGained += BigInt(Math.floor(queuedAction.timespan * 0.2 * 2 * 1.1)); // Kill 4 more
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.MAGIC)).to.eq(startXP + xpGained);

      // Finish it off
      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan / 4]);
      await ethers.provider.send("evm_mine", []);
      await players.connect(alice).processActions(playerId);

      // Check no more food is consumed as this is an excess
      expect(await itemNFT.balanceOf(alice, EstforConstants.COOKED_MINNUS)).to.eq(1000 - 9);
      // Kill all
      expect(await itemNFT.balanceOf(alice, EstforConstants.BRONZE_ARROW)).to.eq(
        Math.floor((queuedAction.timespan * dropRate * numSpawned) / (3600 * GUAR_MUL * SPAWN_MUL))
      );

      xpGained = BigInt(Math.floor(queuedAction.timespan * 1.1));
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.MAGIC)).to.eq(startXP + xpGained);
    });

    it("Add multi actionChoice", async function () {
      const {
        playerId,
        players,
        alice,
        worldActions,
        queuedAction: magicQueuedAction
      } = await loadFixture(playersFixtureMagic);

      const queuedAction = {...magicQueuedAction};
      const scrollsConsumedRate = 1 * RATE_MUL; // per hour

      let choiceId = 2;
      const tx = await worldActions.addActionChoices(
        EstforConstants.NONE,
        [choiceId, choiceId + 1],
        [
          {
            ...defaultActionChoice,
            skill: EstforTypes.Skill.MAGIC,
            rate: scrollsConsumedRate,
            inputTokenIds: [EstforConstants.AIR_SCROLL, EstforConstants.SHADOW_SCROLL],
            inputAmounts: [1, 1],
            skills: [EstforTypes.Skill.MAGIC],
            skillDiffs: [2],
            skillMinXPs: [0]
          },
          {
            ...defaultActionChoice,
            skill: EstforTypes.Skill.MAGIC,
            rate: scrollsConsumedRate,
            inputTokenIds: [EstforConstants.SHADOW_SCROLL, EstforConstants.AIR_SCROLL],
            inputAmounts: [1, 3],
            skills: [EstforTypes.Skill.MAGIC],
            skillDiffs: [2],
            skillMinXPs: [0]
          }
        ]
      );

      const choiceIds = await getActionChoiceIds(tx, worldActions);
      expect(choiceIds).to.eql([BigInt(choiceId), BigInt(choiceId + 1)]);
      queuedAction.choiceId = choiceId + 2;

      // Non-existent actionChoiceId
      await expect(
        players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE)
      ).to.be.reverted;
      queuedAction.choiceId = choiceId;
      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);
    });

    it("Use too much food (split over same action)", async function () {
      const {
        playerId,
        players,
        alice,
        worldActions,
        queuedAction: magicQueuedAction,
        itemNFT
      } = await loadFixture(playersFixtureMagic);

      const monsterCombatStats: EstforTypes.CombatStats = {
        meleeAttack: 15000,
        magicAttack: 0,
        rangedAttack: 0,
        meleeDefence: 0,
        magicDefence: 0,
        rangedDefence: 0,
        health: 5
      };

      const dropRate = 1 * GUAR_MUL; // per hour
      await worldActions.addActions([
        {
          actionId: 2,
          info: {
            ...defaultActionInfo,
            skill: EstforTypes.Skill.COMBAT,
            xpPerHour: 3600,
            minXP: 0,
            numSpawned: 100 * SPAWN_MUL,
            handItemTokenIdRangeMin: EstforConstants.COMBAT_BASE,
            handItemTokenIdRangeMax: EstforConstants.COMBAT_MAX,
            isAvailable: actionIsAvailable,
            actionChoiceRequired: true,
            successPercent: 100
          },
          guaranteedRewards: [{itemTokenId: EstforConstants.BRONZE_ARROW, rate: dropRate}],
          randomRewards: [],
          combatStats: monsterCombatStats
        }
      ]);

      const queuedAction = {...magicQueuedAction};
      queuedAction.actionId = 2;

      // Exceed 2^16
      await itemNFT.mint(alice, EstforConstants.COOKED_MINNUS, 70000);
      const foodBalance = await itemNFT.balanceOf(alice, EstforConstants.COOKED_MINNUS);

      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);

      // Food should be used each time
      let beforeBal = await itemNFT.balanceOf(alice, EstforConstants.COOKED_MINNUS);
      for (let i = 0; i < 36; ++i) {
        await ethers.provider.send("evm_increaseTime", [queuedAction.timespan / 36]);
        await ethers.provider.send("evm_mine", []);
        await players.connect(alice).processActions(playerId);
        const newBalance = await itemNFT.balanceOf(alice, EstforConstants.COOKED_MINNUS);
        expect(beforeBal).to.satisfy((num: bigint) => {
          return num > newBalance || num == foodBalance - 65535n;
        });
        beforeBal = newBalance;
      }

      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.MAGIC)).to.eq(3106);
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.DEFENCE)).to.eq(0);
      expect(await itemNFT.balanceOf(alice, EstforConstants.COOKED_MINNUS)).to.eq(
        foodBalance - BigInt(Math.pow(2, 16) - 1)
      );
    });

    it("Use too much food", async function () {
      const {
        playerId,
        players,
        alice,
        worldActions,
        queuedAction: magicQueuedAction,
        itemNFT,
        startXP
      } = await loadFixture(playersFixtureMagic);

      const monsterCombatStats: EstforTypes.CombatStats = {
        meleeAttack: 15000,
        magicAttack: 0,
        rangedAttack: 0,
        meleeDefence: 0,
        magicDefence: 0,
        rangedDefence: 0,
        health: 5
      };

      const dropRate = 1 * GUAR_MUL; // per hour
      await worldActions.addActions([
        {
          actionId: 2,
          info: {
            ...defaultActionInfo,
            skill: EstforTypes.Skill.COMBAT,
            xpPerHour: 3600,
            minXP: 0,
            numSpawned: 100 * SPAWN_MUL,
            handItemTokenIdRangeMin: EstforConstants.COMBAT_BASE,
            handItemTokenIdRangeMax: EstforConstants.COMBAT_MAX,
            isAvailable: actionIsAvailable,
            actionChoiceRequired: true,
            successPercent: 100
          },
          guaranteedRewards: [{itemTokenId: EstforConstants.BRONZE_ARROW, rate: dropRate}],
          randomRewards: [],
          combatStats: monsterCombatStats
        }
      ]);

      const queuedAction = {...magicQueuedAction};
      queuedAction.actionId = 2;

      // Exceed 2^16
      await itemNFT.mint(alice, EstforConstants.COOKED_MINNUS, 70000);
      const foodBalance = await itemNFT.balanceOf(alice, EstforConstants.COOKED_MINNUS);

      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);

      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]);
      await ethers.provider.send("evm_mine", []);
      await players.connect(alice).processActions(playerId);
      // Died but still get XP
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.MAGIC)).to.eq(startXP + 2732n);
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.DEFENCE)).to.eq(0);
      expect(await itemNFT.balanceOf(alice, EstforConstants.COOKED_MINNUS)).to.eq(
        foodBalance - BigInt(Math.pow(2, 16) - 1)
      );
    });

    it("Die with food, and don't have enough scrolls to kill the ones you did kill", async function () {
      const {
        playerId,
        players,
        alice,
        worldActions,
        queuedAction: magicQueuedAction,
        itemNFT,
        startXP
      } = await loadFixture(playersFixtureMagic);

      const monsterCombatStats: EstforTypes.CombatStats = {
        meleeAttack: 50,
        magicAttack: 0,
        rangedAttack: 0,
        meleeDefence: 0,
        magicDefence: 0,
        rangedDefence: 0,
        health: 5
      };

      const dropRate = 1 * GUAR_MUL; // per hour
      await worldActions.addActions([
        {
          actionId: 2,
          info: {
            ...defaultActionInfo,
            skill: EstforTypes.Skill.COMBAT,
            xpPerHour: 3600,
            minXP: 0,
            numSpawned: 100 * SPAWN_MUL,
            handItemTokenIdRangeMin: EstforConstants.COMBAT_BASE,
            handItemTokenIdRangeMax: EstforConstants.COMBAT_MAX,
            isAvailable: actionIsAvailable,
            actionChoiceRequired: true,
            successPercent: 100
          },
          guaranteedRewards: [{itemTokenId: EstforConstants.BRONZE_ARROW, rate: dropRate}],
          randomRewards: [],
          combatStats: monsterCombatStats
        }
      ]);

      const queuedAction = {...magicQueuedAction};
      queuedAction.actionId = 2;
      queuedAction.timespan = 3600 * 2;

      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);
      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]);
      await ethers.provider.send("evm_mine", []);
      let pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
      // Confirm you are dead
      expect(pendingQueuedActionState.actionMetadatas[0].died).to.be.true;
      await players.connect(alice).processActions(playerId);
      // Died but still get some XP
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.MAGIC)).to.eq(startXP + 3960n);
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.DEFENCE)).to.eq(0);
      // Use up everything
      expect(await itemNFT.balanceOf(alice, EstforConstants.COOKED_MINNUS)).to.eq(0);
      expect(await itemNFT.balanceOf(alice, EstforConstants.SHADOW_SCROLL)).to.eq(0);
      expect(await itemNFT.balanceOf(alice, EstforConstants.AIR_SCROLL)).to.eq(0);
    });

    it("No food used, check that scrolls are consumed immediately still and only for combat time expected", async function () {
      const {
        playerId,
        players,
        alice,
        itemNFT,
        queuedAction: magicQueuedAction
      } = await loadFixture(playersFixtureMagic);

      await itemNFT.addItems([
        {
          ...EstforTypes.defaultItemInput,
          tokenId: EstforConstants.IRON_GAUNTLETS,
          equipPosition: EstforTypes.EquipPosition.ARMS
        }
      ]);

      const queuedAction = {
        ...magicQueuedAction,
        attire: {...magicQueuedAction.attire, arms: EstforConstants.IRON_GAUNTLETS},
        timespan: 3600,
        regenerateId: EstforConstants.NONE
      };

      await itemNFT.mint(alice, EstforConstants.IRON_GAUNTLETS, 1);
      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);
      await ethers.provider.send("evm_increaseTime", [180]); // respawn every 360s
      await ethers.provider.send("evm_mine", []);
      let pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
      // Confirm you are dead
      expect(pendingQueuedActionState.actionMetadatas[0].died).to.be.true;
      expect(pendingQueuedActionState.equipmentStates[0].consumedAmounts.length).to.be.eq(2);
      expect(pendingQueuedActionState.equipmentStates[0].consumedAmounts[0]).to.be.eq(1);
      const consumedAmount = pendingQueuedActionState.equipmentStates[0].consumedAmounts[0];
      await ethers.provider.send("evm_increaseTime", [1800]); // respawn every 360s
      await ethers.provider.send("evm_mine", []);
      pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
      // No more should be consumed with more time
      expect(consumedAmount).to.eq(pendingQueuedActionState.equipmentStates[0].consumedAmounts[0]);

      await expect(players.connect(alice).processActions(playerId)).to.not.be.reverted;
    });

    it("Run out of food and scrolls, but have more food than scrolls", async function () {
      const {
        playerId,
        players,
        alice,
        worldActions,
        queuedAction: magicQueuedAction,
        itemNFT
      } = await loadFixture(playersFixtureMagic);

      const monsterCombatStats: EstforTypes.CombatStats = {
        meleeAttack: 0,
        magicAttack: 5,
        rangedAttack: 0,
        meleeDefence: 0,
        magicDefence: 5,
        rangedDefence: 0,
        health: 60
      };

      const dropRate = 1 * GUAR_MUL; // per hour
      await worldActions.addActions([
        {
          actionId: 2,
          info: {
            ...defaultActionInfo,
            skill: EstforTypes.Skill.COMBAT,
            xpPerHour: 3600,
            minXP: 0,
            numSpawned: 100 * SPAWN_MUL,
            handItemTokenIdRangeMin: EstforConstants.COMBAT_BASE,
            handItemTokenIdRangeMax: EstforConstants.COMBAT_MAX,
            isAvailable: actionIsAvailable,
            actionChoiceRequired: true,
            successPercent: 100
          },
          guaranteedRewards: [{itemTokenId: EstforConstants.BRONZE_ARROW, rate: dropRate}],
          randomRewards: [],
          combatStats: monsterCombatStats
        }
      ]);

      // Set player combat stats
      await players.modifyXP(alice, playerId, Skill.MAGIC, 14500, SKIP_XP_THRESHOLD_EFFECTS);
      await players.modifyXP(alice, playerId, Skill.HEALTH, 1600, SKIP_XP_THRESHOLD_EFFECTS);
      await players.modifyXP(alice, playerId, Skill.DEFENCE, 250, SKIP_XP_THRESHOLD_EFFECTS);

      const items = [EstforConstants.COOKED_MINNUS, EstforConstants.AIR_SCROLL, EstforConstants.SHADOW_SCROLL];
      const balances = await itemNFT.balanceOfs(alice, items);

      await itemNFT.connect(alice).burnBatch(alice, [...items], [...balances]); // Ensure mutable arrays

      const scrollsConsumedRate = 100 * RATE_MUL; // per hour
      await worldActions.editActionChoices(
        EstforConstants.NONE,
        [1],
        [
          {
            ...defaultActionChoice,
            skill: EstforTypes.Skill.MAGIC,
            rate: scrollsConsumedRate,
            inputTokenIds: [EstforConstants.SHADOW_SCROLL, EstforConstants.AIR_SCROLL],
            inputAmounts: [1, 2],
            skills: [EstforTypes.Skill.MAGIC],
            skillDiffs: [2],
            skillMinXPs: [0]
          }
        ]
      );

      await itemNFT.mintBatch(alice, [...items], [1350, 2092, 1046]); // Ensure mutable arrays

      const queuedAction = {...magicQueuedAction}; // Ensure mutable copy
      queuedAction.actionId = 2;
      queuedAction.timespan = 3600 * 24;

      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);

      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]);
      await ethers.provider.send("evm_mine", []);

      let pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);

      // Confirm you are dead
      expect(pendingQueuedActionState.actionMetadatas[0].died).to.be.true;

      await players.connect(alice).processActions(playerId);

      // Died but still get some XP
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.MAGIC)).to.eq(55921n);
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.DEFENCE)).to.eq(250n); // Should be the same as before

      // Use up everything
      expect(await itemNFT.balanceOf(alice, EstforConstants.COOKED_MINNUS)).to.eq(0n);
      expect(await itemNFT.balanceOf(alice, EstforConstants.SHADOW_SCROLL)).to.eq(0n);
      expect(await itemNFT.balanceOf(alice, EstforConstants.AIR_SCROLL)).to.eq(0n);
    });

    it("Enemy dealing magic damage", async function () {
      const {
        playerId,
        players,
        itemNFT,
        alice,
        timespan,
        queuedAction: queuedActionMonster,
        startXP,
        worldActions
      } = await loadFixture(playersFixtureMagic);

      const monsterCombatStats: EstforTypes.CombatStats = {
        meleeAttack: 0,
        magicAttack: 3,
        rangedAttack: 0,
        meleeDefence: 0,
        magicDefence: 0,
        rangedDefence: 0,
        health: 5
      };

      const dropRate = 1 * GUAR_MUL; // per monster
      const numSpawned = 10 * SPAWN_MUL;
      let tx = await worldActions.addActions([
        {
          actionId: 2,
          info: {
            ...defaultActionInfo,
            skill: EstforTypes.Skill.COMBAT,
            xpPerHour: 3600,
            minXP: 0,
            numSpawned,
            handItemTokenIdRangeMin: EstforConstants.COMBAT_BASE,
            handItemTokenIdRangeMax: EstforConstants.COMBAT_MAX,
            isAvailable: actionIsAvailable,
            actionChoiceRequired: true,
            successPercent: 100
          },
          guaranteedRewards: [{itemTokenId: EstforConstants.BRONZE_ARROW, rate: dropRate}],
          randomRewards: [],
          combatStats: monsterCombatStats
        }
      ]);
      const actionId = await getActionId(tx, worldActions);
      const queuedAction = {...queuedActionMonster, actionId};
      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);

      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]);
      await ethers.provider.send("evm_mine", []);
      await players.connect(alice).processActions(playerId);
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.MAGIC)).to.eq(
        startXP + BigInt(Math.floor(queuedAction.timespan * 1.1))
      );
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.HEALTH)).to.be.deep.oneOf([
        // This shouldn't be boosted by magic boost
        BigInt(Math.floor(queuedAction.timespan / 3)),
        BigInt(Math.floor(queuedAction.timespan / 3) - 1)
      ]);
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.DEFENCE)).to.eq(0);

      // Check the drops are as expected
      expect(await itemNFT.balanceOf(alice, EstforConstants.BRONZE_ARROW)).to.eq(
        Math.floor((timespan * dropRate * numSpawned) / (3600 * GUAR_MUL * SPAWN_MUL))
      );

      // Check food is consumed
      expect(await itemNFT.balanceOf(alice, EstforConstants.COOKED_MINNUS)).to.eq(1000 - 2);

      // Use at least 1 scroll per monster
      expect(await itemNFT.balanceOf(alice, EstforConstants.AIR_SCROLL)).to.eq(200 - 20);
      expect(await itemNFT.balanceOf(alice, EstforConstants.SHADOW_SCROLL)).to.eq(100 - 10);
    });
  });

  // Range is a subset of magic for the most part so only tests for basic things should be required
  describe("Ranged", function () {
    async function playersFixtureRanged() {
      const fixture = await loadFixture(playersFixture);
      const {playerNFT, itemNFT, worldActions, alice} = fixture;

      const avatarId = 1;
      const avatarInfo: AvatarInfo = {
        name: "Name goes here",
        description: "Hi I'm a description",
        imageURI: "1234.png",
        startSkills: [Skill.RANGED, Skill.NONE]
      };
      await playerNFT.setAvatars([avatarId], [avatarInfo]);

      // Create player
      const origName = "0xSamWitch1";
      const makeActive = true;
      const playerIdRanged = await createPlayer(playerNFT, avatarId, alice, origName, makeActive);

      const monsterCombatStats: EstforTypes.CombatStats = {
        meleeAttack: 3,
        magicAttack: 0,
        rangedAttack: 0,
        meleeDefence: 0,
        magicDefence: 0,
        rangedDefence: 0,
        health: 5
      };

      const dropRate = 1 * GUAR_MUL; // per monster
      const numSpawned = 10 * SPAWN_MUL;
      let tx = await worldActions.addActions([
        {
          actionId: 1,
          info: {
            ...defaultActionInfo,
            skill: EstforTypes.Skill.COMBAT,
            xpPerHour: 3600,
            minXP: 0,
            numSpawned,
            handItemTokenIdRangeMin: EstforConstants.COMBAT_BASE,
            handItemTokenIdRangeMax: EstforConstants.COMBAT_MAX,
            isAvailable: actionIsAvailable,
            actionChoiceRequired: true,
            successPercent: 100
          },
          guaranteedRewards: [{itemTokenId: EstforConstants.NATURE_SCROLL, rate: dropRate}],
          randomRewards: [],
          combatStats: monsterCombatStats
        }
      ]);
      const actionId = await getActionId(tx, worldActions);

      await itemNFT.mintBatch(
        alice,
        [
          EstforConstants.BRONZE_SHIELD,
          EstforConstants.COOKED_MINNUS,
          EstforConstants.BRONZE_ARROW,
          EstforConstants.IRON_ARROW
        ],
        [1, 1000, 200, 100]
      );

      const arrowsConsumedRate = 1 * RATE_MUL; // per hour
      tx = await worldActions.addActionChoices(
        EstforConstants.NONE,
        [1],

        [
          {
            ...defaultActionChoice,
            skill: EstforTypes.Skill.RANGED,
            rate: arrowsConsumedRate,
            inputTokenIds: [EstforConstants.BRONZE_ARROW],
            inputAmounts: [1],
            handItemTokenIdRangeMin: EstforConstants.BASIC_BOW,
            handItemTokenIdRangeMax: EstforConstants.BASIC_BOW,
            skills: [EstforTypes.Skill.RANGED],
            skillDiffs: [2],
            skillMinXPs: [0]
          }
        ]
      );
      const choiceId = await getActionChoiceId(tx, worldActions);
      const timespan = 3600;
      const queuedAction: EstforTypes.QueuedActionInput = {
        attire: EstforTypes.noAttire,
        actionId,
        combatStyle: EstforTypes.CombatStyle.ATTACK,
        choiceId,
        regenerateId: EstforConstants.COOKED_MINNUS,
        timespan,
        rightHandEquipmentTokenId: EstforConstants.BASIC_BOW,
        leftHandEquipmentTokenId: EstforConstants.NONE,
        petId: EstforConstants.NONE
      };

      await itemNFT.addItems([
        {
          ...EstforTypes.defaultItemInput,
          tokenId: EstforConstants.BRONZE_ARROW,
          equipPosition: EstforTypes.EquipPosition.QUIVER
        },
        {
          ...EstforTypes.defaultItemInput,
          tokenId: EstforConstants.IRON_ARROW,
          equipPosition: EstforTypes.EquipPosition.QUIVER
        },
        {
          ...EstforTypes.defaultItemInput,
          tokenId: EstforConstants.BASIC_BOW,
          equipPosition: EstforTypes.EquipPosition.BOTH_HANDS
        },
        {
          ...EstforTypes.defaultItemInput,
          tokenId: EstforConstants.BRONZE_SHIELD,
          equipPosition: EstforTypes.EquipPosition.LEFT_HAND
        },
        {
          ...EstforTypes.defaultItemInput,
          tokenId: EstforConstants.NATURE_SCROLL,
          equipPosition: EstforTypes.EquipPosition.QUIVER
        },
        {
          ...EstforTypes.defaultItemInput,
          healthRestored: 12,
          tokenId: EstforConstants.COOKED_MINNUS,
          equipPosition: EstforTypes.EquipPosition.FOOD
        }
      ]);

      const startXP = START_XP;
      return {
        ...fixture,
        timespan,
        actionId,
        dropRate,
        queuedAction,
        startXP,
        numSpawned,
        playerIdRanged
      };
    }

    it("Attack", async function () {
      const {playerIdRanged, players, itemNFT, alice, timespan, dropRate, queuedAction, startXP, numSpawned} =
        await loadFixture(playersFixtureRanged);

      await players
        .connect(alice)
        .startActions(playerIdRanged, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);

      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]);
      await ethers.provider.send("evm_mine", []);
      await players.connect(alice).processActions(playerIdRanged);
      expect(await players.getPlayerXP(playerIdRanged, EstforTypes.Skill.RANGED)).to.eq(
        startXP + BigInt(Math.floor(queuedAction.timespan * 1.1))
      );
      expect(await players.getPlayerXP(playerIdRanged, EstforTypes.Skill.HEALTH)).to.be.deep.oneOf([
        // This shouldn't be boosted by range boost
        BigInt(Math.floor(queuedAction.timespan / 3)),
        BigInt(Math.floor(queuedAction.timespan / 3) - 1)
      ]);
      expect(await players.getPlayerXP(playerIdRanged, EstforTypes.Skill.DEFENCE)).to.eq(0);

      // Check the drops are as expected
      expect(await itemNFT.balanceOf(alice, EstforConstants.NATURE_SCROLL)).to.eq(
        Math.floor((timespan * dropRate * numSpawned) / (3600 * GUAR_MUL * SPAWN_MUL))
      );

      // Check food is consumed
      expect(await itemNFT.balanceOf(alice, EstforConstants.COOKED_MINNUS)).to.eq(1000 - 2);

      // Use at least 1 arrow per monster
      expect(await itemNFT.balanceOf(alice, EstforConstants.BRONZE_ARROW)).to.eq(200 - 10);
    });

    it("Check expected bow is required for the actionChoice", async function () {
      // Bronze arrows can only be used with basic bow for instance
      const {
        playerIdRanged,
        players,
        itemNFT,
        alice,
        queuedAction: rangedQueuedAction
      } = await loadFixture(playersFixtureRanged);
      await itemNFT.addItems([
        {
          ...EstforTypes.defaultItemInput,
          tokenId: EstforConstants.GODLY_BOW,
          equipPosition: EstforTypes.EquipPosition.BOTH_HANDS
        }
      ]);
      await itemNFT.mint(alice, EstforConstants.GODLY_BOW, 1);
      const queuedAction = {...rangedQueuedAction};
      queuedAction.rightHandEquipmentTokenId = EstforConstants.GODLY_BOW;

      await expect(
        players.connect(alice).startActions(playerIdRanged, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE)
      ).to.be.revertedWithCustomError(players, "InvalidHandEquipment");
    });

    it("Check expected bow is required for the actionChoice, forged godly bow", async function () {
      // Bronze arrows can only be used with basic bow for instance
      const {
        playerIdRanged,
        players,
        itemNFT,
        alice,
        queuedAction: rangedQueuedAction,
        worldActions
      } = await loadFixture(playersFixtureRanged);

      const arrowsConsumedRate = 1 * RATE_MUL; // per hour
      const tx = await worldActions.addActionChoices(
        EstforConstants.NONE,
        [2],

        [
          {
            ...defaultActionChoice,
            skill: EstforTypes.Skill.RANGED,
            rate: arrowsConsumedRate,
            inputTokenIds: [EstforConstants.BRONZE_ARROW],
            inputAmounts: [1],
            handItemTokenIdRangeMin: EstforConstants.GODLY_BOW,
            handItemTokenIdRangeMax: EstforConstants.GODLY_BOW_4,
            skills: [EstforTypes.Skill.RANGED],
            skillDiffs: [5],
            skillMinXPs: [0]
          }
        ]
      );

      const choiceId = await getActionChoiceId(tx, worldActions);
      await itemNFT.addItems([
        {
          ...EstforTypes.defaultItemInput,
          tokenId: EstforConstants.INFUSED_GODLY_BOW,
          equipPosition: EstforTypes.EquipPosition.NONE
        },
        {
          ...EstforTypes.defaultItemInput,
          tokenId: EstforConstants.GODLY_BOW_4,
          equipPosition: EstforTypes.EquipPosition.BOTH_HANDS
        },
        {
          ...EstforTypes.defaultItemInput,
          tokenId: EstforConstants.GODLY_BOW_5,
          equipPosition: EstforTypes.EquipPosition.BOTH_HANDS
        }
      ]);
      await itemNFT.mint(alice, EstforConstants.GODLY_BOW_5, 1);
      const queuedAction = {...rangedQueuedAction};
      queuedAction.rightHandEquipmentTokenId = EstforConstants.GODLY_BOW_5;
      queuedAction.choiceId = choiceId;

      await expect(
        players.connect(alice).startActions(playerIdRanged, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE)
      ).to.be.revertedWithCustomError(players, "InvalidHandEquipment");

      // Cannot use INFUSED godly bow either
      await itemNFT.mint(alice, EstforConstants.INFUSED_GODLY_BOW, 1);
      queuedAction.rightHandEquipmentTokenId = EstforConstants.INFUSED_GODLY_BOW;
      await expect(
        players.connect(alice).startActions(playerIdRanged, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE)
      )
        .to.be.revertedWithCustomError(players, "IncorrectRightHandEquipment")
        .withArgs(EstforConstants.INFUSED_GODLY_BOW);

      await itemNFT.mint(alice, EstforConstants.GODLY_BOW_4, 1);
      queuedAction.rightHandEquipmentTokenId = EstforConstants.GODLY_BOW_4;

      await expect(
        players.connect(alice).startActions(playerIdRanged, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE)
      ).to.not.be.reverted;
    });

    it("Remove bow after queuing, combat should be skipped", async function () {
      const {playerIdRanged, players, itemNFT, alice, queuedAction, startXP} = await loadFixture(playersFixtureRanged);

      await players
        .connect(alice)
        .startActions(playerIdRanged, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);

      await itemNFT.connect(alice).burn(alice, EstforConstants.BASIC_BOW, 2);
      expect(await itemNFT.balanceOf(alice, EstforConstants.BASIC_BOW)).to.eq(0);

      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]);
      await ethers.provider.send("evm_mine", []);
      await players.connect(alice).processActions(playerIdRanged);
      expect(await players.getPlayerXP(playerIdRanged, EstforTypes.Skill.RANGED)).to.eq(startXP);
      expect(await players.getPlayerXP(playerIdRanged, EstforTypes.Skill.HEALTH)).to.eq(0);
      expect(await players.getPlayerXP(playerIdRanged, EstforTypes.Skill.DEFENCE)).to.eq(0);

      // No arrows used
      expect(await itemNFT.balanceOf(alice, EstforConstants.BRONZE_ARROW)).to.eq(200);
    });

    it("No bow equipped, not allowed", async function () {
      const {
        playerIdRanged,
        players,
        alice,
        queuedAction: rangedQueuedAction
      } = await loadFixture(playersFixtureRanged);

      const queuedAction = {...rangedQueuedAction};
      queuedAction.rightHandEquipmentTokenId = EstforConstants.NONE;

      await expect(
        players.connect(alice).startActions(playerIdRanged, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE)
      ).to.be.revertedWithCustomError(players, "IncorrectEquippedItem");
    });

    it("Cannot equip shield with a bow", async function () {
      const {
        playerIdRanged,
        players,
        alice,
        queuedAction: rangedQueuedAction
      } = await loadFixture(playersFixtureRanged);

      const queuedAction = {...rangedQueuedAction};
      queuedAction.leftHandEquipmentTokenId = EstforConstants.BRONZE_SHIELD;

      await expect(
        players.connect(alice).startActions(playerIdRanged, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE)
      ).to.be.revertedWithCustomError(players, "InvalidHandEquipment");
      queuedAction.leftHandEquipmentTokenId = EstforConstants.NONE;
      await expect(
        players.connect(alice).startActions(playerIdRanged, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE)
      ).to.not.be.reverted;
    });

    it("Enemy dealing ranged damage", async function () {
      const {
        playerIdRanged,
        players,
        itemNFT,
        alice,
        timespan,
        queuedAction: queuedActionMonster,
        startXP,
        worldActions
      } = await loadFixture(playersFixtureRanged);

      const monsterCombatStats: EstforTypes.CombatStats = {
        meleeAttack: 0,
        magicAttack: 0,
        rangedAttack: 3,
        meleeDefence: 0,
        magicDefence: 0,
        rangedDefence: 0,
        health: 5
      };

      const dropRate = 1 * GUAR_MUL; // per monster
      const numSpawned = 10 * SPAWN_MUL;
      let tx = await worldActions.addActions([
        {
          actionId: 2,
          info: {
            ...defaultActionInfo,
            skill: EstforTypes.Skill.COMBAT,
            xpPerHour: 3600,
            minXP: 0,
            numSpawned,
            handItemTokenIdRangeMin: EstforConstants.COMBAT_BASE,
            handItemTokenIdRangeMax: EstforConstants.COMBAT_MAX,
            isAvailable: actionIsAvailable,
            actionChoiceRequired: true,
            successPercent: 100
          },
          guaranteedRewards: [{itemTokenId: EstforConstants.NATURE_SCROLL, rate: dropRate}],
          randomRewards: [],
          combatStats: monsterCombatStats
        }
      ]);
      const actionId = await getActionId(tx, worldActions);
      const queuedAction = {...queuedActionMonster, actionId};
      await players
        .connect(alice)
        .startActions(playerIdRanged, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);

      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]);
      await ethers.provider.send("evm_mine", []);
      await players.connect(alice).processActions(playerIdRanged);
      expect(await players.getPlayerXP(playerIdRanged, EstforTypes.Skill.RANGED)).to.eq(
        startXP + BigInt(Math.floor(queuedAction.timespan * 1.1))
      );
      expect(await players.getPlayerXP(playerIdRanged, EstforTypes.Skill.HEALTH)).to.be.deep.oneOf([
        // This shouldn't be boosted by range boost
        BigInt(Math.floor(queuedAction.timespan / 3)),
        BigInt(Math.floor(queuedAction.timespan / 3) - 1)
      ]);
      expect(await players.getPlayerXP(playerIdRanged, EstforTypes.Skill.DEFENCE)).to.eq(0);

      // Check the drops are as expected
      expect(await itemNFT.balanceOf(alice, EstforConstants.NATURE_SCROLL)).to.eq(
        Math.floor((timespan * dropRate * numSpawned) / (3600 * GUAR_MUL * SPAWN_MUL))
      );

      // Check food is consumed
      expect(await itemNFT.balanceOf(alice, EstforConstants.COOKED_MINNUS)).to.eq(1000 - 2);

      // Use at least 1 arrow per monster
      expect(await itemNFT.balanceOf(alice, EstforConstants.BRONZE_ARROW)).to.eq(200 - 10);
    });
  });

  it("Dead, kill all but don't have enough food", async function () {
    // Lose all the XP that would have been gained
    const {playerId, players, itemNFT, worldActions, alice} = await loadFixture(playersFixture);

    const monsterCombatStats: EstforTypes.CombatStats = {
      meleeAttack: 3,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangedDefence: 0,
      health: 1
    };

    const rate = 6000 * GUAR_MUL; // per kill
    let tx = await worldActions.addActions([
      {
        actionId: 1,
        info: {
          ...defaultActionInfo,
          skill: EstforTypes.Skill.COMBAT,
          xpPerHour: 3600,
          minXP: 0,
          numSpawned: 100 * SPAWN_MUL,
          handItemTokenIdRangeMin: EstforConstants.COMBAT_BASE,
          handItemTokenIdRangeMax: EstforConstants.COMBAT_MAX,
          isAvailable: actionIsAvailable,
          actionChoiceRequired: true,
          successPercent: 100
        },
        guaranteedRewards: [{itemTokenId: EstforConstants.BRONZE_ARROW, rate}],
        randomRewards: [],
        combatStats: monsterCombatStats
      }
    ]);
    const actionId = await getActionId(tx, worldActions);

    const foodNum = 100;
    await itemNFT.mintBatch(
      alice,
      [EstforConstants.BRONZE_SWORD, EstforConstants.COOKED_MINNUS, EstforConstants.BRONZE_HELMET],
      [1, foodNum, 1]
    );

    await itemNFT.addItems([
      {
        ...EstforTypes.defaultItemInput,
        tokenId: EstforConstants.BRONZE_HELMET,
        equipPosition: EstforTypes.EquipPosition.HEAD
      }
    ]);

    const timespan = 3600 * 3; // 3 hours
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
    const queuedAction: EstforTypes.QueuedActionInput = {
      attire: {...EstforTypes.noAttire, head: EstforConstants.BRONZE_HELMET},
      actionId,
      combatStyle: EstforTypes.CombatStyle.ATTACK,
      choiceId,
      regenerateId: EstforConstants.COOKED_MINNUS,
      timespan,
      rightHandEquipmentTokenId: EstforConstants.BRONZE_SWORD,
      leftHandEquipmentTokenId: EstforConstants.NONE,
      petId: EstforConstants.NONE
    };

    await itemNFT.addItems([
      {
        ...EstforTypes.defaultItemInput,
        tokenId: EstforConstants.BRONZE_SWORD,
        equipPosition: EstforTypes.EquipPosition.RIGHT_HAND
      },
      {
        ...EstforTypes.defaultItemInput,
        healthRestored: 1,
        tokenId: EstforConstants.COOKED_MINNUS,
        equipPosition: EstforTypes.EquipPosition.FOOD
      }
    ]);

    await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);

    await ethers.provider.send("evm_increaseTime", [3600]);
    await ethers.provider.send("evm_mine", []);
    let pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
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
    expect(await players.getPlayerXP(playerId, EstforTypes.Skill.MELEE)).to.eq(1332);
    expect(await itemNFT.balanceOf(alice, EstforConstants.BRONZE_ARROW)).to.eq(222000);
    expect(await itemNFT.balanceOf(alice, EstforConstants.COOKED_MINNUS)).to.eq(0);

    // Have no food, should not show any in consumed
    await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);
    await ethers.provider.send("evm_increaseTime", [3600]);
    await ethers.provider.send("evm_mine", []);
    pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
    expect(pendingQueuedActionState.actionMetadatas[0].died).to.be.true;
    expect(pendingQueuedActionState.equipmentStates[0].producedItemTokenIds.length).to.eq(0);
    expect(pendingQueuedActionState.producedPastRandomRewards.length).to.eq(0);
    expect(pendingQueuedActionState.equipmentStates[0].consumedItemTokenIds.length).to.eq(0);
  });

  it("Dead, don't have enough food and requires over 65535 with a partial progress consuming some food", async function () {
    // Lose all the XP that would have been gained
    const {playerId, players, itemNFT, worldActions, alice} = await loadFixture(playersFixture);

    const monsterCombatStats: EstforTypes.CombatStats = {
      meleeAttack: 30,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangedDefence: 0,
      health: 100
    };

    const rate = 6000 * GUAR_MUL; // per kill
    let tx = await worldActions.addActions([
      {
        actionId: 1,
        info: {
          ...defaultActionInfo,
          skill: EstforTypes.Skill.COMBAT,
          xpPerHour: 3600,
          minXP: 0,
          numSpawned: 100 * SPAWN_MUL,
          handItemTokenIdRangeMin: EstforConstants.COMBAT_BASE,
          handItemTokenIdRangeMax: EstforConstants.COMBAT_MAX,
          isAvailable: actionIsAvailable,
          actionChoiceRequired: true,
          successPercent: 100
        },
        guaranteedRewards: [{itemTokenId: EstforConstants.BRONZE_ARROW, rate}],
        randomRewards: [],
        combatStats: monsterCombatStats
      }
    ]);
    const actionId = await getActionId(tx, worldActions);

    const foodNum = 100;
    await itemNFT.mintBatch(
      alice,
      [EstforConstants.BRONZE_SWORD, EstforConstants.COOKED_MINNUS, EstforConstants.BRONZE_HELMET],
      [1, foodNum, 1]
    );

    await itemNFT.addItems([
      {
        ...EstforTypes.defaultItemInput,
        tokenId: EstforConstants.BRONZE_HELMET,
        equipPosition: EstforTypes.EquipPosition.HEAD
      }
    ]);

    const timespan = 3600 * 24; // 3 hours
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
    const queuedAction: EstforTypes.QueuedActionInput = {
      attire: {...EstforTypes.noAttire, head: EstforConstants.BRONZE_HELMET},
      actionId,
      combatStyle: EstforTypes.CombatStyle.ATTACK,
      choiceId,
      regenerateId: EstforConstants.COOKED_MINNUS,
      timespan,
      rightHandEquipmentTokenId: EstforConstants.BRONZE_SWORD,
      leftHandEquipmentTokenId: EstforConstants.NONE,
      petId: EstforConstants.NONE
    };

    await itemNFT.addItems([
      {
        ...EstforTypes.defaultItemInput,
        tokenId: EstforConstants.BRONZE_SWORD,
        equipPosition: EstforTypes.EquipPosition.RIGHT_HAND
      },
      {
        ...EstforTypes.defaultItemInput,
        healthRestored: 1,
        tokenId: EstforConstants.COOKED_MINNUS,
        equipPosition: EstforTypes.EquipPosition.FOOD
      }
    ]);

    await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);
    await ethers.provider.send("evm_increaseTime", [30]);
    await ethers.provider.send("evm_mine", []);
    let pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
    expect(pendingQueuedActionState.actionMetadatas[0].died).to.be.false;
    expect(pendingQueuedActionState.equipmentStates[0].consumedItemTokenIds.length).to.eq(1);
    const consumedFood = Number(pendingQueuedActionState.equipmentStates[0].consumedAmounts[0]);
    expect(consumedFood).to.be.lt(foodNum);

    await players.connect(alice).processActions(playerId);

    const actuallyConsumed = Number(
      (await (await getPlayersHelper(players)).getPlayer(playerId)).currentActionProcessedFoodConsumed
    );
    expect(actuallyConsumed).to.be.oneOf([consumedFood, consumedFood + 1, consumedFood + 2]);

    await ethers.provider.send("evm_increaseTime", [3600 * 24]);
    await ethers.provider.send("evm_mine", []);
    pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
    expect(pendingQueuedActionState.actionMetadatas[0].died).to.be.true;
    expect(pendingQueuedActionState.equipmentStates[0].consumedAmounts[0]).to.eq(foodNum - actuallyConsumed);

    await expect(players.connect(alice).processActions(playerId)).to.not.be.reverted;
    expect(await itemNFT.balanceOf(alice, EstforConstants.COOKED_MINNUS)).to.eq(0);
  });

  it("Negative health should use more food", async function () {
    const fixture = await loadFixture(playersFixture);
    const {players, itemNFT, worldActions, playerId, alice} = fixture;

    const {queuedAction: queuedActionMelee} = await setupBasicMeleeCombat(itemNFT, worldActions);

    // Set my combat stats
    await itemNFT.mintBatch(alice.address, [EstforConstants.IRON_HELMET], [1]);

    await itemNFT.addItems([
      {
        ...EstforTypes.defaultItemInput,
        combatStats: {
          ...EstforTypes.defaultItemInput.combatStats,
          health: -100
        },
        tokenId: EstforConstants.IRON_HELMET,
        equipPosition: EstforTypes.EquipPosition.HEAD
      }
    ]);

    const queuedAction: EstforTypes.QueuedActionInput = {
      ...queuedActionMelee,
      attire: {...EstforTypes.noAttire, head: EstforConstants.IRON_HELMET}
    };

    await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);

    const time = 3600;
    await ethers.provider.send("evm_increaseTime", [time]);
    await players.connect(alice).processActions(playerId);

    // Check food is consumed
    expect(await itemNFT.balanceOf(alice.address, EstforConstants.COOKED_MINNUS)).to.eq(255 - 11);
    // Only no 0 id items produced
    expect(await itemNFT.balanceOf(alice.address, EstforConstants.NONE)).to.eq(0);
  });

  it("Dead, don't kill all", async function () {
    // Lose all the XP that would have been gained
    const {playerId, players, itemNFT, worldActions, alice} = await loadFixture(playersFixture);

    const monsterCombatStats: EstforTypes.CombatStats = {
      meleeAttack: 3,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangedDefence: 0,
      health: 100
    };

    const rate = 1 * GUAR_MUL; // per hour
    let tx = await worldActions.addActions([
      {
        actionId: 1,
        info: {
          ...defaultActionInfo,
          skill: EstforTypes.Skill.COMBAT,
          xpPerHour: 3600,
          minXP: 0,
          numSpawned: 100 * SPAWN_MUL,
          handItemTokenIdRangeMin: EstforConstants.COMBAT_BASE,
          handItemTokenIdRangeMax: EstforConstants.COMBAT_MAX,
          isAvailable: actionIsAvailable,
          actionChoiceRequired: true,
          successPercent: 100
        },
        guaranteedRewards: [{itemTokenId: EstforConstants.BRONZE_ARROW, rate}],
        randomRewards: [],
        combatStats: monsterCombatStats
      }
    ]);
    const actionId = await getActionId(tx, worldActions);

    const foodNum = 2;
    await itemNFT.mint(alice, EstforConstants.BRONZE_SWORD, 1);
    await itemNFT.mint(alice, EstforConstants.COOKED_MINNUS, 2);
    const timespan = 3600 * 3; // 3 hours
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
    const queuedAction: EstforTypes.QueuedActionInput = {
      attire: EstforTypes.noAttire,
      actionId,
      combatStyle: EstforTypes.CombatStyle.ATTACK,
      choiceId,
      regenerateId: EstforConstants.COOKED_MINNUS,
      timespan,
      rightHandEquipmentTokenId: EstforConstants.BRONZE_SWORD,
      leftHandEquipmentTokenId: EstforConstants.NONE,
      petId: EstforConstants.NONE
    };

    await itemNFT.addItems([
      {
        ...EstforTypes.defaultItemInput,
        tokenId: EstforConstants.BRONZE_SWORD,
        equipPosition: EstforTypes.EquipPosition.RIGHT_HAND,
        metadataURI: "someIPFSURI.json"
      },
      {
        ...EstforTypes.defaultItemInput,
        healthRestored: 1,
        tokenId: EstforConstants.COOKED_MINNUS,
        equipPosition: EstforTypes.EquipPosition.FOOD,
        metadataURI: "someIPFSURI.json"
      }
    ]);

    await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);

    await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]);
    await ethers.provider.send("evm_mine", []);

    let pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
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
    expect(await players.getPlayerXP(playerId, EstforTypes.Skill.MELEE)).to.eq(0);
    expect(await itemNFT.balanceOf(alice, EstforConstants.BRONZE_ARROW)).to.eq(0);
    expect(await itemNFT.balanceOf(alice, EstforConstants.COOKED_MINNUS)).to.eq(0);
  });

  it("Invalid combat styles should revert", async function () {
    const fixture = await loadFixture(playersFixture);
    const {players, itemNFT, worldActions, playerId, alice} = fixture;

    const {queuedAction} = await setupBasicMeleeCombat(itemNFT, worldActions);
    queuedAction.combatStyle = EstforTypes.CombatStyle.NONE;

    await expect(
      players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE)
    ).to.be.revertedWithCustomError(players, "InvalidCombatStyle");

    queuedAction.combatStyle = 3 as EstforTypes.CombatStyle;

    const CombatStyleLibrary = await ethers.getContractFactory("CombatStyleLibrary");

    await expect(
      players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE)
    ).to.be.revertedWithCustomError(CombatStyleLibrary, "InvalidCombatStyleId");

    queuedAction.combatStyle = EstforTypes.CombatStyle.ATTACK; // Use a valid one
    await expect(
      players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE)
    ).to.not.be.reverted;
  });
});
