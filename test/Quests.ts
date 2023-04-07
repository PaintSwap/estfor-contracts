import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {EstforConstants, NONE} from "@paintswap/estfor-definitions";
import {Skill} from "@paintswap/estfor-definitions/types";
import {expect} from "chai";
import {defaultMinRequirements, Quest} from "../scripts/data/quests";
import {playersFixture} from "./Players/PlayersFixture";
import {setupBasicFiremaking} from "./Players/utils";

export async function questsFixture() {
  const fixture = await loadFixture(playersFixture);
  const {world, itemNFT, alice} = fixture;

  const {queuedAction, choiceId, rate} = await setupBasicFiremaking(itemNFT, world, 0);

  const firemakingQuest: Quest = {
    questId: 1,
    dependentQuestId: 0,
    actionId: NONE,
    actionNum: 0,
    actionId1: NONE,
    actionNum1: 0,
    actionChoiceId: choiceId,
    actionChoiceNum: 100,
    skillReward: Skill.NONE,
    skillXPGained: 0,
    rewardItemTokenId: EstforConstants.OAK_LOG,
    rewardAmount: 5,
    rewardItemTokenId1: NONE,
    rewardAmount1: 0,
  };

  const firemakingQuestLog: Quest = {
    questId: 2,
    dependentQuestId: 0,
    actionId: NONE,
    actionNum: 0,
    actionId1: NONE,
    actionNum1: 0,
    actionChoiceId: choiceId,
    actionChoiceNum: 100,
    skillReward: Skill.NONE,
    skillXPGained: 0,
    rewardItemTokenId: EstforConstants.LOG,
    rewardAmount: 10,
    rewardItemTokenId1: NONE,
    rewardAmount1: 0,
  };

  await itemNFT.testMint(alice.address, EstforConstants.LOG, 200);

  return {
    ...fixture,
    firemakingQuest,
    firemakingQuestLog,
    queuedAction,
    choiceId,
    rate,
  };
}

describe("Quests", function () {
  describe("Add a quest", function () {
    it("Should add a quest correctly", async function () {
      const {quests, firemakingQuest} = await loadFixture(questsFixture);

      await quests.addQuest(firemakingQuest, false, defaultMinRequirements);
      const quest = await quests.allQuests(1);
      expect(quest.questId).to.equal(firemakingQuest.questId);
      expect(quest.rewardItemTokenId).to.equal(firemakingQuest.rewardItemTokenId);
      expect(quest.rewardAmount).to.equal(firemakingQuest.rewardAmount);
      expect(await quests.isRandomQuest(firemakingQuest.questId)).to.be.false;
    });

    it("Should add a random quest correctly", async function () {
      const {quests, firemakingQuest} = await loadFixture(questsFixture);

      await quests.addQuest(firemakingQuest, true, defaultMinRequirements);
      expect(await quests.isRandomQuest(firemakingQuest.questId)).to.be.true;
    });

    it("Should fail to add same quest twice", async function () {
      const {quests, firemakingQuest} = await loadFixture(questsFixture);
      await quests.addQuest(firemakingQuest, false, defaultMinRequirements);
      await expect(quests.addQuest(firemakingQuest, false, defaultMinRequirements)).to.be.revertedWithCustomError(
        quests,
        "QuestWithIdAlreadyExists"
      );
    });

    it("Should fail to add a quest for non-owner", async function () {
      const {alice, quests, firemakingQuest} = await loadFixture(questsFixture);
      await expect(quests.connect(alice).addQuest(firemakingQuest, false, defaultMinRequirements)).to.be.revertedWith(
        "Ownable: caller is not the owner"
      );
    });
  });

  describe("Add quests", function () {
    it("Should add multiple quests correctly", async function () {
      const {quests, firemakingQuest, firemakingQuestLog} = await loadFixture(questsFixture);
      const questsToAdd = [firemakingQuest, firemakingQuestLog];
      await quests.addQuests(questsToAdd, [false, false], [defaultMinRequirements, defaultMinRequirements]);

      const quest1 = await quests.allQuests(1);
      expect(quest1.questId).to.equal(firemakingQuest.questId);
      const quest2 = await quests.allQuests(2);
      expect(quest2.questId).to.equal(firemakingQuestLog.questId);
    });

    it("Should fail to add same quest twice using batch", async function () {
      const {quests, firemakingQuest} = await loadFixture(questsFixture);
      const questsToAdd = [firemakingQuest, firemakingQuest];
      await expect(
        quests.addQuests(questsToAdd, [false, false], [defaultMinRequirements, defaultMinRequirements])
      ).to.be.revertedWithCustomError(quests, "QuestWithIdAlreadyExists");
    });

    it("Should fail to add multiple quests for non-owner", async function () {
      const {alice, quests, firemakingQuest} = await loadFixture(questsFixture);
      await expect(
        quests.connect(alice).addQuests([firemakingQuest], [false], [defaultMinRequirements])
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("Remove quest", function () {
    it("Should remove a quest correctly", async function () {
      const {quests, firemakingQuest} = await loadFixture(questsFixture);
      await quests.addQuest(firemakingQuest, false, defaultMinRequirements);
      await expect(quests.removeQuest(1)).to.emit(quests, "RemoveQuest").withArgs(1);
      await expect(quests.removeQuest(2)).to.be.revertedWithCustomError(quests, "QuestDoesntExist");
    });

    it("Should fail to remove a quest for non-owner", async function () {
      const {alice, quests, firemakingQuest} = await loadFixture(questsFixture);
      await quests.addQuest(firemakingQuest, false, defaultMinRequirements);
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

  it("Should fail to activate if not players", async function () {
    const {playerId, quests, firemakingQuestLog} = await loadFixture(questsFixture);
    await quests.addQuest(firemakingQuestLog, false, defaultMinRequirements);
    const questId = 2;
    await expect(quests.activateQuest(playerId, questId)).to.be.revertedWithCustomError(quests, "NotPlayers");
  });
});
