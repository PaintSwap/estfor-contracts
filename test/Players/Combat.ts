import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {EstforConstants, EstforTypes} from "@paintswap/estfor-definitions";
import {COOKED_MINNUS} from "@paintswap/estfor-definitions/constants";
import {Skill} from "@paintswap/estfor-definitions/types";
import {expect} from "chai";
import {BigNumber} from "ethers";
import {ethers} from "hardhat";
import {AvatarInfo, createPlayer} from "../../scripts/utils";
import {emptyActionChoice, getActionChoiceId, getActionChoiceIds, getActionId, SPAWN_MUL, START_XP} from "../utils";
import {playersFixture} from "./PlayersFixture";
import {setupBasicMeleeCombat} from "./utils";

const actionIsAvailable = true;

describe("Combat Actions", function () {
  describe("Melee", async function () {
    async function playersFixtureMelee() {
      const fixture = await loadFixture(playersFixture);
      const {itemNFT, world} = fixture;

      const {queuedAction, rate, numSpawned} = await setupBasicMeleeCombat(itemNFT, world);

      return {
        ...fixture,
        itemNFT,
        queuedAction,
        rate,
        numSpawned,
        world,
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
        Math.floor((time * rate * numSpawned) / (3600 * 10 * SPAWN_MUL))
      );

      // Check food is consumed
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.COOKED_MINNUS)).to.eq(255 - 2);
      // Only no 0 id items produced
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.NONE)).to.eq(0);
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
        Math.floor((time * rate * numSpawned) / (3600 * 10 * SPAWN_MUL))
      );

      // Check food is consumed
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.COOKED_MINNUS)).to.eq(255 - 3);
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
        Math.floor((time * rate * numSpawned) / (3600 * 10 * SPAWN_MUL))
      );

      // Check food is consumed
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.COOKED_MINNUS)).to.eq(255 - 2);
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
        Math.floor((time * rate * numSpawned) / (3600 * 10 * SPAWN_MUL))
      );

      // Check food is consumed
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.COOKED_MINNUS)).to.eq(255 - 2);
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

      const dropRate = 1 * 10; // per monster
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

      const scrollsConsumedRate = 1 * 10; // per hour
      tx = await world.addActionChoice(EstforConstants.NONE, 1, {
        skill: EstforTypes.Skill.MAGIC,
        diff: 2,
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
        Math.floor((timespan * dropRate * numSpawned) / (3600 * 10 * SPAWN_MUL))
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

      const dropRate = 1 * 10; // per monster
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
      const scrollsConsumedRate = 100 * 10; // per hour
      tx = await world.addActionChoice(EstforConstants.NONE, 1, {
        skill: EstforTypes.Skill.MAGIC,
        diff: 5,
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

      // Doing 30 dmg per minute or 0.5 dmg per second
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
        Math.floor((timespan * dropRate * numSpawned) / (3600 * 10 * SPAWN_MUL))
      );

      // Check food is consumed
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.COOKED_MINNUS)).to.eq(1000 - 5);

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
        Math.floor((timespan * dropRate * numSpawned) / (3600 * 10 * SPAWN_MUL))
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
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.COOKED_MINNUS)).to.eq(1000 - 45);

      // Check that no scrolls are consumed
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.AIR_SCROLL)).to.eq(0);
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.SHADOW_SCROLL)).to.eq(100);
    });

    it("Add multi actionChoice", async function () {
      const {playerId, players, alice, world, queuedAction: magicQueuedAction} = await loadFixture(playersFixtureMagic);

      const queuedAction = {...magicQueuedAction};
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
              diff: 2,
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

    it("Use too much food (split over same action)", async function () {});

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

      const dropRate = 1 * 10; // per hour
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
      // Died
      expect(await players.xp(playerId, EstforTypes.Skill.MAGIC)).to.eq(startXP);
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

    const rate = 6000 * 10; // per hour
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
    expect(pendingQueuedActionState.equipmentStates[0].producedItemTokenIds.length).to.eq(0);
    expect(pendingQueuedActionState.producedPastRandomRewards.length).to.eq(0);
    expect(pendingQueuedActionState.equipmentStates[0].consumedItemTokenIds.length).to.eq(1);
    expect(pendingQueuedActionState.equipmentStates[0].consumedAmounts[0]).to.eq(foodNum);
    expect(pendingQueuedActionState.equipmentStates[0].consumedItemTokenIds[0]).to.eq(COOKED_MINNUS);

    await players.connect(alice).processActions(playerId);
    // Should die so doesn't get any attack skill points, loot, and food should be consumed
    expect(await players.xp(playerId, EstforTypes.Skill.MELEE)).to.eq(0);
    expect(await itemNFT.balanceOf(alice.address, EstforConstants.BRONZE_ARROW)).to.eq(0);
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

    const rate = 1 * 10; // per hour
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
