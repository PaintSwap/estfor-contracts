import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {EstforConstants, EstforTypes, NONE} from "@paintswap/estfor-definitions";
import {expect} from "chai";
import {ethers, upgrades} from "hardhat";
import {Quest} from "../scripts/data/quests";
import {playersFixture} from "./Players/PlayersFixture";
import {getActionChoiceId, getActionId} from "./utils";

describe("Quests", function () {
  async function questsFixture() {
    const playersFixure = await loadFixture(playersFixture);
    const {playerNFT, world, itemNFT, alice} = playersFixure;

    const Quests = await ethers.getContractFactory("Quests");
    const quests = await upgrades.deployProxy(Quests, [playerNFT.address, world.address], {
      kind: "uups",
    });

    await world.setQuests(quests.address);

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
        isAvailable: true,
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

    const firemakingQuest: Quest = {
      actionId: NONE,
      actionNum: 0,
      actionId1: NONE,
      actionNum1: 0,
      actionChoiceId: choiceId,
      actionChoiceNum: 1,
      actionChoiceId1: NONE,
      actionChoiceNum1: 0,
      questId: 1,
      rewardItemTokenId: EstforConstants.OAK_LOG,
      rewardAmount: 5,
      rewardItemTokenId1: NONE,
      rewardAmount1: 0,
    };

    const firemakingQuestLog: Quest = {
      actionId: NONE,
      actionNum: 0,
      actionId1: NONE,
      actionNum1: 0,
      actionChoiceId: choiceId,
      actionChoiceNum: 2,
      actionChoiceId1: NONE,
      actionChoiceNum1: 0,
      questId: 2,
      rewardItemTokenId: EstforConstants.LOG,
      rewardAmount: 10,
      rewardItemTokenId1: NONE,
      rewardAmount1: 0,
    };

    await itemNFT.testMint(alice.address, EstforConstants.LOG, 100);

    return {
      ...playersFixure,
      quests,
      firemakingQuest,
      firemakingQuestLog,
    };
  }

  describe("Add a quest", function () {
    it("Should add a quest correctly", async function () {
      const {quests, firemakingQuest} = await loadFixture(questsFixture);

      await quests.addQuest(firemakingQuest, false);
      const quest = await quests.allQuests(1);
      expect(quest.questId).to.equal(firemakingQuest.questId);
      expect(quest.rewardItemTokenId).to.equal(firemakingQuest.rewardItemTokenId);
      expect(quest.rewardAmount).to.equal(firemakingQuest.rewardAmount);
      expect(await quests.isRandomQuest(firemakingQuest.questId)).to.be.false;
    });

    it("Should add a random quest correctly", async function () {
      const {quests, firemakingQuest} = await loadFixture(questsFixture);

      await quests.addQuest(firemakingQuest, true);
      expect(await quests.isRandomQuest(firemakingQuest.questId)).to.be.true;
    });

    it("Should fail to add same quest twice", async function () {
      const {quests, firemakingQuest} = await loadFixture(questsFixture);
      await quests.addQuest(firemakingQuest, false);
      await expect(quests.addQuest(firemakingQuest, false)).to.be.revertedWithCustomError(
        quests,
        "QuestWithIdAlreadyExists"
      );
    });

    it("Should fail to add a quest for non-owner", async function () {
      const {alice, quests, firemakingQuest} = await loadFixture(questsFixture);
      await expect(quests.connect(alice).addQuest(firemakingQuest, false)).to.be.revertedWith(
        "Ownable: caller is not the owner"
      );
    });
  });

  describe("Add quests", function () {
    it("Should add multiple quests correctly", async function () {
      const {quests, firemakingQuest, firemakingQuestLog} = await loadFixture(questsFixture);
      const questsToAdd = [firemakingQuest, firemakingQuestLog];
      await quests.addQuests(questsToAdd, [false, false]);

      const quest1 = await quests.allQuests(1);
      expect(quest1.questId).to.equal(firemakingQuest.questId);
      const quest2 = await quests.allQuests(2);
      expect(quest2.questId).to.equal(firemakingQuestLog.questId);
    });

    it("Should fail to add same quest twice", async function () {
      const {quests, firemakingQuest} = await loadFixture(questsFixture);
      const questsToAdd = [firemakingQuest, firemakingQuest];
      await expect(quests.addQuests(questsToAdd, [false, false])).to.be.revertedWithCustomError(
        quests,
        "QuestWithIdAlreadyExists"
      );
    });

    it("Should fail to add multiple quests for non-owner", async function () {
      const {alice, quests, firemakingQuest} = await loadFixture(questsFixture);
      await expect(quests.connect(alice).addQuests([firemakingQuest], [false])).to.be.revertedWith(
        "Ownable: caller is not the owner"
      );
    });
  });

  describe("Remove quest", function () {
    it("Should remove a quest correctly", async function () {
      const {quests, firemakingQuest} = await loadFixture(questsFixture);
      await quests.addQuest(firemakingQuest, false);
      await expect(quests.removeQuest(1)).to.emit(quests, "RemoveQuest").withArgs(1);
      await expect(quests.removeQuest(2)).to.be.revertedWithCustomError(quests, "QuestDoesntExist");
    });

    it("Should fail to remove a quest for non-owner", async function () {
      const {alice, quests, firemakingQuest} = await loadFixture(questsFixture);
      await quests.addQuest(firemakingQuest, false);
      await expect(quests.connect(alice).removeQuest(1)).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should fail to remove a non-existing quest", async function () {
      const {quests} = await loadFixture(questsFixture);
      await expect(quests.removeQuest(2)).to.be.revertedWithCustomError(quests, "QuestDoesntExist");
    });
  });

  describe("Set new oracle random words", function () {
    it("Should set the random quest correctly", async function () {
      // TODO
    });

    it("Should fail to set the random quest for non-world", async function () {
      const {alice, quests} = await loadFixture(questsFixture);
      await expect(quests.connect(alice).newOracleRandomWords([1, 2, 3])).to.be.revertedWithCustomError(
        quests,
        "NotWorld"
      );
    });
  });

  describe("Activate a quest", function () {
    it("Should activate a quest for player correctly", async function () {
      const {alice, playerId, quests, firemakingQuestLog} = await loadFixture(questsFixture);
      await quests.addQuest(firemakingQuestLog, false);
      const questId = 2;
      await quests.connect(alice).activateQuest(playerId, questId);
      const activeQuest = await quests.activeQuests(playerId);
      expect(activeQuest.questId).to.equal(questId);
    });

    it("Should fail to activate a quest for non-owner of player", async function () {
      const {playerId, quests, firemakingQuestLog} = await loadFixture(questsFixture);
      await quests.addQuest(firemakingQuestLog, false);
      const questId = 2;
      await expect(quests.activateQuest(playerId, questId)).to.be.revertedWithCustomError(quests, "NotOwnerOfPlayer");
    });

    it("Should fail to activate a non-existing quest", async function () {
      const {alice, playerId, quests, firemakingQuestLog} = await loadFixture(questsFixture);
      await quests.addQuest(firemakingQuestLog, false);
      const questId = 3;
      await expect(quests.connect(alice).activateQuest(playerId, questId)).to.be.revertedWithCustomError(
        quests,
        "QuestDoesntExist"
      );
    });
  });
});
