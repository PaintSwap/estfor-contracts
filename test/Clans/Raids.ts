import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {expect} from "chai";
import {clanFixture} from "./utils";
import {ClanRank, Skill} from "@paintswap/estfor-definitions/types";
import {allBattleSkills} from "../../scripts/data/territories";
import {getXPFromLevel} from "../Players/utils";
import {fulfillRandomWords, fulfillRandomWordsSeeded, getEventLog, SPAWN_MUL} from "../utils";
import {EstforConstants, EstforTypes} from "@paintswap/estfor-definitions";
import {allActions} from "../../scripts/data/actions";
import {
  allActionChoiceIdsMagic,
  allActionChoiceIdsMelee,
  allActionChoiceIdsRanged
} from "../../scripts/data/actionChoiceIds";
import {allActionChoicesMagic, allActionChoicesMelee, allActionChoicesRanged} from "../../scripts/data/actionChoices";
import {createPlayer} from "../../scripts/utils";

describe("Raids", function () {
  const basicRaid = {
    minHealth: 100,
    maxHealth: 200,
    minMeleeAttack: 10,
    maxMeleeAttack: 20,
    minMagicAttack: 15,
    maxMagicAttack: 25,
    minRangedAttack: 12,
    maxRangedAttack: 22,
    minMeleeDefence: 8,
    maxMeleeDefence: 18,
    minMagicDefence: 5,
    maxMagicDefence: 15,
    minRangedDefence: 7,
    maxRangedDefence: 17,
    tier: 1,
    randomLootTokenIds: [1, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    randomLootTokenAmounts: [1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    randomChances: [5000, 10000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
  };

  const trashMonsterBaseRaid = {
    minHealth: 1,
    maxHealth: 1,
    minMeleeAttack: 0,
    maxMeleeAttack: 0,
    minMagicAttack: 0,
    maxMagicAttack: 0,
    minRangedAttack: 0,
    maxRangedAttack: 0,
    minMeleeDefence: 0,
    maxMeleeDefence: 0,
    minMagicDefence: 0,
    maxMagicDefence: 0,
    minRangedDefence: 0,
    maxRangedDefence: 0,
    tier: 1,
    randomLootTokenIds: [1, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    randomLootTokenAmounts: [1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    randomChances: [5000, 10000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
  };

  const raidFixture = async function () {
    const fixture = await loadFixture(clanFixture);

    const {raids, world, itemNFT} = fixture;

    // Add all actions
    const raidCombatActionIds = [
      EstforConstants.ACTION_COMBAT_GROG_TOAD,
      EstforConstants.ACTION_COMBAT_UFFINCH,
      EstforConstants.ACTION_COMBAT_NATURARACNID,
      EstforConstants.ACTION_COMBAT_DRAGON_FROG,
      EstforConstants.ACTION_COMBAT_ELDER_BURGOF
    ];

    // Add all the actions
    await world.addActions(allActions);

    await itemNFT.addItems([
      {
        ...EstforTypes.defaultItemInput,
        tokenId: EstforConstants.RAID_PASS,
        equipPosition: EstforTypes.EquipPosition.NONE
      },
      {
        ...EstforTypes.defaultItemInput,
        healthRestored: 12,
        tokenId: EstforConstants.COOKED_MINNUS,
        equipPosition: EstforTypes.EquipPosition.FOOD
      }
    ]);

    const genericCombatActionId = EstforConstants.NONE;
    await world.addBulkActionChoices(
      [genericCombatActionId, genericCombatActionId, genericCombatActionId],
      [allActionChoiceIdsMelee, allActionChoiceIdsRanged, allActionChoiceIdsMagic],
      [allActionChoicesMelee, allActionChoicesRanged, allActionChoicesMagic]
    );

    await raids.setCombatActions(raidCombatActionIds);
    return {...fixture, raidCombatActionIds};
  };

  describe("Basic raid functionality", function () {
    it("Can spawn a raid", async function () {
      const {raids, playerId, alice} = await loadFixture(raidFixture);

      await expect(raids.connect(alice).spawnRaid(playerId)).to.emit(raids, "SpawnRaid").withArgs(playerId, 1);
    });

    it("Cannot spawn raid while previous raid not finished", async function () {
      const {raids, playerId, alice, mockVRF} = await loadFixture(raidFixture);

      await raids.connect(alice).spawnRaid(playerId);
      await expect(raids.connect(alice).spawnRaid(playerId)).to.be.revertedWithCustomError(
        raids,
        "PreviousRaidNotSpawnedYet"
      );

      await raids.addBaseRaids([1], [basicRaid]);
      await fulfillRandomWords(1, raids, mockVRF);
      await expect(raids.connect(alice).spawnRaid(playerId)).to.be.revertedWithCustomError(raids, "RaidInProgress");
    });

    it("Spawns raid with random stats in valid ranges", async function () {
      const {raids, playerId, alice, mockVRF} = await loadFixture(raidFixture);

      await raids.addBaseRaids([1], [basicRaid]);
      await raids.connect(alice).spawnRaid(playerId);
      await fulfillRandomWords(1, raids, mockVRF);

      const raidInfo = await raids.getRaidInfo(1);
      expect(raidInfo.health).to.be.within(100, 200);
      expect(raidInfo.meleeAttack).to.be.within(10, 20);
      expect(raidInfo.magicAttack).to.be.within(15, 25);
      expect(raidInfo.rangedAttack).to.be.within(12, 22);
      expect(raidInfo.meleeDefence).to.be.within(8, 18);
      expect(raidInfo.magicDefence).to.be.within(5, 15);
      expect(raidInfo.rangedDefence).to.be.within(7, 17);
      expect(raidInfo.tier).to.equal(1);
    });

    it("Spawns raid with same min/max stat ranges", async function () {
      const {raids, playerId, alice, mockVRF} = await loadFixture(raidFixture);

      await raids.addBaseRaids(
        [1],
        [
          {
            minHealth: 100,
            maxHealth: 100,
            minMeleeAttack: 10,
            maxMeleeAttack: 10,
            minMagicAttack: 150,
            maxMagicAttack: 150,
            minRangedAttack: 65534 / 2,
            maxRangedAttack: 65534 / 2,
            minMeleeDefence: 8,
            maxMeleeDefence: 8,
            minMagicDefence: 0,
            maxMagicDefence: 0,
            minRangedDefence: -20,
            maxRangedDefence: -20,
            tier: 1,
            randomLootTokenIds: [1, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            randomLootTokenAmounts: [1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            randomChances: [5000, 10000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
          }
        ]
      );

      await raids.connect(alice).spawnRaid(playerId);
      await fulfillRandomWords(1, raids, mockVRF);

      const raidInfo = await raids.getRaidInfo(1);
      expect(raidInfo.health).to.eq(100);
      expect(raidInfo.meleeAttack).to.eq(10);
      expect(raidInfo.magicAttack).to.eq(150);
      expect(raidInfo.rangedAttack).to.eq(65534 / 2);
      expect(raidInfo.meleeDefence).to.eq(8);
      expect(raidInfo.magicDefence).to.eq(0);
      expect(raidInfo.rangedDefence).to.eq(-20);
      expect(raidInfo.tier).to.equal(1);
    });
  });

  describe("Fighting raids", function () {
    it("Can fight raid with clan combatants", async function () {
      const {raids, clanId, playerId, alice, bankFactory, itemNFT, mockVRF, combatantsHelper} = await loadFixture(
        raidFixture
      );

      await raids.addBaseRaids([1], [basicRaid]);
      await combatantsHelper.connect(alice).assignCombatants(clanId, false, [], false, [], true, [playerId], playerId);
      const bankAddress = await bankFactory.getBankAddress(clanId);
      await itemNFT.mint(bankAddress, EstforConstants.RAID_PASS, 1);

      await raids.connect(alice).spawnRaid(playerId);
      await fulfillRandomWords(1, raids, mockVRF);

      const raidId = 1;
      const regenerateId = 0;
      let requestId = 2;
      await expect(raids.connect(alice).fightRaid(playerId, clanId, raidId, regenerateId))
        .to.emit(raids, "RequestFightRaid")
        .withArgs(clanId, playerId, raidId, requestId);

      const tx = await fulfillRandomWords(requestId, raids, mockVRF);
      const log = await getEventLog(tx, raids, "RaidBattleOutcome");
      expect(log.raidId).to.be.within(1, 3);
      expect(log.clanId).to.eq(clanId);
      expect(log.requestId).to.eq(requestId);
      expect(log.regenerateAmountUsed).to.eq(0);
      expect(log.choiceIds).to.deep.eq([1500n, 0n, 0n, 0n, 0n]);
      expect(log.bossChoiceId).to.eq(0); // Never got to the boss
      expect(log.defeatedRaid).to.be.false;
      expect(log.lootTokenIds.length).to.eq(0);
      expect(log.lootTokenAmounts.length).to.eq(0);
    });

    it("Defeat monsters and raid boss", async function () {
      const {raids, players, clanId, playerId, alice, bankFactory, itemNFT, mockVRF, combatantsHelper} =
        await loadFixture(raidFixture);

      await raids.addBaseRaids([1, 2, 3], [trashMonsterBaseRaid, trashMonsterBaseRaid, trashMonsterBaseRaid]);
      await combatantsHelper.connect(alice).assignCombatants(clanId, false, [], false, [], true, [playerId], playerId);
      for (const skill of [Skill.MELEE, Skill.RANGED, Skill.MAGIC, Skill.HEALTH, Skill.DEFENCE]) {
        await players.testModifyXP(alice, playerId, skill, getXPFromLevel(135), true);
      }

      const bankAddress = await bankFactory.getBankAddress(clanId);
      await itemNFT.mint(bankAddress, EstforConstants.RAID_PASS, 1);

      await raids.connect(alice).spawnRaid(playerId);
      await fulfillRandomWords(1, raids, mockVRF);

      const raidId = 1;
      const regenerateId = EstforConstants.COOKED_MINNUS;
      await itemNFT.mint(bankAddress, regenerateId, 100_000);
      let requestId = 2;
      await expect(raids.connect(alice).fightRaid(playerId, clanId, raidId, regenerateId))
        .to.emit(raids, "RequestFightRaid")
        .withArgs(clanId, playerId, raidId, requestId);

      const tx = await fulfillRandomWordsSeeded(requestId, raids, mockVRF, 100_000n);
      const log = await getEventLog(tx, raids, "RaidBattleOutcome");
      expect(log.raidId).to.be.within(1, 3);
      expect(log.clanId).to.eq(clanId);
      expect(log.requestId).to.eq(requestId);
      expect(log.regenerateAmountUsed).to.eq(120); // these can change based on the random numbers
      expect(log.choiceIds).to.deep.eq([
        EstforConstants.ACTIONCHOICE_MELEE_MONSTER,
        EstforConstants.ACTIONCHOICE_MAGIC_SHADOW_BLAST,
        EstforConstants.ACTIONCHOICE_RANGED_BASIC_BOW,
        EstforConstants.ACTIONCHOICE_MAGIC_SHADOW_BLAST,
        EstforConstants.ACTIONCHOICE_RANGED_BASIC_BOW
      ]); // these can change based on the random numbers
      expect(log.bossChoiceId).to.not.eq(1);
      expect(log.defeatedRaid).to.be.true;
      expect(log.lootTokenIds.length).to.be.greaterThan(0);
      expect(log.lootTokenAmounts.length).to.be.greaterThan(0);
    });

    it("Check random rewards", async function () {
      // Edit all combat actions so that you get no loot from them
      const {
        raids,
        world,
        raidCombatActionIds,
        combatantsHelper,
        playerId,
        alice,
        clanId,
        players,
        bankFactory,
        mockVRF,
        itemNFT
      } = await loadFixture(raidFixture);

      // Clear all the actions guaranteed rewards
      const actionInfo = {
        skill: EstforTypes.Skill.COMBAT,
        xpPerHour: 3600,
        minXP: 0,
        worldLocation: 0,
        isFullModeOnly: false,
        numSpawned: 1 * SPAWN_MUL,
        handItemTokenIdRangeMin: EstforConstants.COMBAT_BASE,
        handItemTokenIdRangeMax: EstforConstants.COMBAT_MAX,
        isAvailable: true,
        questPrerequisiteId: 0,
        actionChoiceRequired: true,
        successPercent: 100
      };

      const actionsToEdit = raidCombatActionIds.map((actionId) => {
        return {
          actionId,
          info: actionInfo,
          guaranteedRewards: [],
          randomRewards: [],
          combatStats: EstforTypes.emptyCombatStats
        };
      });

      await world.editActions(actionsToEdit);

      await raids.addBaseRaids([1, 2, 3], [trashMonsterBaseRaid, trashMonsterBaseRaid, trashMonsterBaseRaid]);
      await combatantsHelper.connect(alice).assignCombatants(clanId, false, [], false, [], true, [playerId], playerId);
      for (const skill of [Skill.MELEE, Skill.RANGED, Skill.MAGIC, Skill.HEALTH, Skill.DEFENCE]) {
        await players.testModifyXP(alice, playerId, skill, getXPFromLevel(135), true);
      }

      const bankAddress = await bankFactory.getBankAddress(clanId);
      await itemNFT.mint(bankAddress, EstforConstants.RAID_PASS, 1);

      await raids.connect(alice).spawnRaid(playerId);
      await fulfillRandomWords(1, raids, mockVRF);

      const raidId = 1;
      const regenerateId = EstforConstants.COOKED_MINNUS;
      await itemNFT.mint(bankAddress, regenerateId, 100_000);
      let requestId = 2;
      await expect(raids.connect(alice).fightRaid(playerId, clanId, raidId, regenerateId))
        .to.emit(raids, "RequestFightRaid")
        .withArgs(clanId, playerId, raidId, requestId);

      const tx = await fulfillRandomWordsSeeded(requestId, raids, mockVRF, 100_000n);
      const log = await getEventLog(tx, raids, "RaidBattleOutcome");
      expect(log.bossChoiceId).to.not.eq(1);
      expect(log.defeatedRaid).to.be.true;
      expect(log.lootTokenIds.length).to.be.greaterThan(0); // confirms you got some stuff from the raid boss
      expect(log.lootTokenAmounts.length).to.be.greaterThan(0);
    });

    it("Must have raid passes to fight", async function () {
      const {raids, clanId, playerId, alice, mockVRF, combatantsHelper} = await loadFixture(raidFixture);

      await raids.addBaseRaids([1], [basicRaid]);

      await combatantsHelper.connect(alice).assignCombatants(clanId, false, [], false, [], true, [playerId], playerId);

      await raids.connect(alice).spawnRaid(playerId);
      await fulfillRandomWords(1, raids, mockVRF);

      // No raid passes, underflow revert
      await expect(raids.connect(alice).fightRaid(playerId, clanId, 1, 0)).to.be.revertedWithPanic(0x11);
    });

    it("Awards loot based on tier and number of monsters killed", async function () {
      const {raids, clanId, playerId, alice, itemNFT, players, bankFactory, mockVRF, combatantsHelper} =
        await loadFixture(raidFixture);

      // Add a raid with guaranteed loot
      await raids.addBaseRaids(
        [1],
        [
          {
            minHealth: 10,
            maxHealth: 10,
            minMeleeAttack: 1,
            maxMeleeAttack: 1,
            minMagicAttack: 1,
            maxMagicAttack: 1,
            minRangedAttack: 1,
            maxRangedAttack: 1,
            minMeleeDefence: 1,
            maxMeleeDefence: 1,
            minMagicDefence: 1,
            maxMagicDefence: 1,
            minRangedDefence: 1,
            maxRangedDefence: 1,
            tier: 2,
            randomLootTokenIds: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            randomLootTokenAmounts: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            randomChances: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
          }
        ]
      );

      // Max out player stats to ensure victory
      for (const skill of allBattleSkills) {
        await players.testModifyXP(alice, playerId, skill, getXPFromLevel(100), true);
      }

      await combatantsHelper.connect(alice).assignCombatants(clanId, false, [], false, [], true, [playerId], playerId);
      const bankAddress = await bankFactory.getBankAddress(clanId);
      await itemNFT.mint(bankAddress, EstforConstants.RAID_PASS, 1);

      await raids.connect(alice).spawnRaid(playerId);
      await fulfillRandomWords(1, raids, mockVRF);

      const raidId = 1;
      const regenerateId = EstforConstants.COOKED_MINNUS;
      await itemNFT.mint(bankAddress, regenerateId, 100_000);
      await raids.connect(alice).fightRaid(playerId, clanId, raidId, regenerateId);
      const tx = await fulfillRandomWords(2, raids, mockVRF);

      const log = await getEventLog(tx, raids, "RaidBattleOutcome");
      expect(log.defeatedRaid).to.be.true;
      expect(log.lootTokenIds.length).to.be.greaterThan(0);
    });
  });

  describe("Clan functionality", function () {
    it("Removes combatant when leaving clan", async function () {
      const {raids, combatantsHelper, clanId, playerId, alice, clans} = await loadFixture(raidFixture);

      await combatantsHelper.connect(alice).assignCombatants(clanId, false, [], false, [], true, [playerId], playerId);

      await expect(clans.connect(alice).changeRank(clanId, playerId, ClanRank.NONE, playerId))
        .to.emit(raids, "RemoveCombatant")
        .withArgs(playerId, clanId);
    });

    it("Only combatants helper can assign combatants", async function () {
      const {raids, clanId, playerId, alice} = await loadFixture(raidFixture);

      await expect(
        raids.connect(alice).assignCombatants(clanId, [playerId], 0, playerId)
      ).to.be.revertedWithCustomError(raids, "OnlyCombatantsHelper");
    });

    it("Enforces max clan combatants", async function () {
      const {clanId, playerId, alice, bob, combatantsHelper, maxRaidCombatants, clans, playerNFT, raids} =
        await loadFixture(raidFixture);

      // Create an array with one more than the max combatants and elements from 1 to maxRaidCombatants + 1
      const tooManyIds = Array.from({length: maxRaidCombatants + 1}, (_, i) => i + 1);

      const tierId = 2;
      await clans.addTiers([
        {
          id: tierId,
          maxMemberCapacity: 30,
          maxBankCapacity: 3,
          maxImageId: 16,
          price: 0,
          minimumAge: 0
        }
      ]);

      // Upgrade clan so we can fit more members
      await clans.connect(alice).upgradeClan(clanId, playerId, tierId);

      const tooManyIdsWithoutFirst = tooManyIds.slice(1, tooManyIds.length);

      // Update clan tier
      await clans.connect(alice).inviteMembers(clanId, tooManyIdsWithoutFirst, playerId);

      const avatarId = 1;
      const makeActive = true;
      for (let nextPlayerId = playerId + 1n; nextPlayerId < tooManyIds.length + 1; ++nextPlayerId) {
        await createPlayer(playerNFT, avatarId, bob, "name" + nextPlayerId, makeActive, "", "", "", false);
        await clans.connect(bob).acceptInvite(clanId, nextPlayerId, 0);
      }

      await expect(
        combatantsHelper.connect(alice).assignCombatants(clanId, false, [], false, [], true, tooManyIds, playerId)
      ).to.be.revertedWithCustomError(raids, "TooManyCombatants");
    });
  });

  describe("Admin functions", function () {
    it("Only owner can add base raids", async function () {
      const {raids, alice} = await loadFixture(raidFixture);

      await expect(raids.connect(alice).addBaseRaids([1], [basicRaid])).to.be.revertedWithCustomError(
        raids,
        "OwnableUnauthorizedAccount"
      );
    });

    it("Cannot add raid with invalid stats ranges", async function () {
      const {raids} = await loadFixture(raidFixture);

      const invalidRaid = {...basicRaid, minHealth: 200, maxHealth: 100};
      await expect(raids.addBaseRaids([1], [invalidRaid])).to.be.revertedWithCustomError(raids, "NotInRange");
    });
  });
});

// Check different monsters spawn
// Check you can choose between different raid bosses
