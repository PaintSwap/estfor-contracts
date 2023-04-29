import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {EstforConstants, EstforTypes, NONE} from "@paintswap/estfor-definitions";
import {
  COOKED_MINNUS,
  QUEST_ALMS_POOR,
  QUEST_HIDDEN_BOUNTY,
  QUEST_PURSE_STRINGS,
  QUEST_SUPPLY_RUN,
  QUEST_TWO_BIRDS,
  SKILL_BOOST,
} from "@paintswap/estfor-definitions/constants";
import {Skill} from "@paintswap/estfor-definitions/types";
import {expect} from "chai";
import {ethers} from "hardhat";
import {allQuests, defaultMinRequirements, Quest} from "../scripts/data/quests";
import {playersFixture} from "./Players/PlayersFixture";
import {setupBasicCooking, setupBasicFiremaking, setupBasicMeleeCombat} from "./Players/utils";
import {getActionId, START_XP} from "./utils";

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
    burnItemTokenId: NONE,
    burnAmount: 0,
    requireActionsCompletedBeforeBurning: false,
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
    burnItemTokenId: NONE,
    burnAmount: 0,
    requireActionsCompletedBeforeBurning: false,
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

      await quests.addQuests([firemakingQuest], [false], [defaultMinRequirements]);
      const quest = await quests.allFixedQuests(1);
      expect(quest.questId).to.equal(firemakingQuest.questId);
      expect(quest.rewardItemTokenId).to.equal(firemakingQuest.rewardItemTokenId);
      expect(quest.rewardAmount).to.equal(firemakingQuest.rewardAmount);
      expect(await quests.isRandomQuest(firemakingQuest.questId)).to.be.false;
    });

    it.skip("Should add a random quest correctly", async function () {
      const {quests, firemakingQuest} = await loadFixture(questsFixture);

      await quests.addQuests([firemakingQuest], [true], [defaultMinRequirements]);
      expect(await quests.isRandomQuest(firemakingQuest.questId)).to.be.true;
    });

    it("Should fail to add same quest twice", async function () {
      const {quests, firemakingQuest} = await loadFixture(questsFixture);
      await quests.addQuests([firemakingQuest], [false], [defaultMinRequirements]);
      await expect(
        quests.addQuests([firemakingQuest], [false], [defaultMinRequirements])
      ).to.be.revertedWithCustomError(quests, "QuestWithIdAlreadyExists");
    });

    it("Should fail to add a quest for non-owner", async function () {
      const {alice, quests, firemakingQuest} = await loadFixture(questsFixture);
      await expect(
        quests.connect(alice).addQuests([firemakingQuest], [false], [defaultMinRequirements])
      ).to.be.revertedWithCustomError(quests, "CallerIsNotOwner");
    });
  });

  describe("Add quests", function () {
    it("Should add multiple quests correctly", async function () {
      const {quests, firemakingQuest, firemakingQuestLog} = await loadFixture(questsFixture);
      const questsToAdd = [firemakingQuest, firemakingQuestLog];
      await quests.addQuests(questsToAdd, [false, false], [defaultMinRequirements, defaultMinRequirements]);

      const quest1 = await quests.allFixedQuests(1);
      expect(quest1.questId).to.equal(firemakingQuest.questId);
      const quest2 = await quests.allFixedQuests(2);
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
      ).to.be.revertedWithCustomError(quests, "CallerIsNotOwner");
    });
  });

  describe("Remove quest", function () {
    it("Should remove a quest correctly", async function () {
      const {quests, firemakingQuest} = await loadFixture(questsFixture);
      await quests.addQuests([firemakingQuest], [false], [defaultMinRequirements]);
      await expect(quests.removeQuest(1)).to.emit(quests, "RemoveQuest").withArgs(1);
      await expect(quests.removeQuest(2)).to.be.revertedWithCustomError(quests, "QuestDoesntExist");
    });

    it("Should fail to remove a quest for non-owner", async function () {
      const {alice, quests, firemakingQuest} = await loadFixture(questsFixture);
      await quests.addQuests([firemakingQuest], [false], [defaultMinRequirements]);
      await expect(quests.connect(alice).removeQuest(1)).to.be.revertedWithCustomError(quests, "CallerIsNotOwner");
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

  describe("Brush buying quest", function () {
    it("Quest not activated", async function () {
      const {alice, playerId, quests} = await loadFixture(questsFixture);
      const quest = allQuests.find((q) => q.questId === QUEST_PURSE_STRINGS);
      await quests.addQuests([quest], [false], [defaultMinRequirements]);
      await expect(
        quests.connect(alice).buyBrushQuest(alice.address, playerId, 0, {value: 10})
      ).to.be.revertedWithCustomError(quests, "InvalidActiveQuest");
    });

    it("Trying to buy with no FTM", async function () {
      const {alice, playerId, quests, players} = await loadFixture(questsFixture);
      const quest = allQuests.find((q) => q.questId === QUEST_PURSE_STRINGS) as Quest;
      await quests.addQuests([quest], [false], [defaultMinRequirements]);
      const questId = quest.questId;
      await players.connect(alice).activateQuest(playerId, questId);
      await expect(
        quests.connect(alice).buyBrushQuest(alice.address, playerId, 0, {value: 0})
      ).to.be.revertedWithCustomError(quests, "InvalidFTMAmount");
    });

    it("Quest completed", async function () {
      const {alice, playerId, quests, players, brush} = await loadFixture(questsFixture);
      const quest = allQuests.find((q) => q.questId === QUEST_PURSE_STRINGS) as Quest;
      await quests.addQuests([quest], [false], [defaultMinRequirements]);
      const questId = quest.questId;
      expect(questId).to.not.eq(0);
      await players.connect(alice).activateQuest(playerId, questId);
      expect((await quests.activeQuests(playerId)).questId).to.be.eq(questId);
      const balanceBefore = await brush.balanceOf(alice.address);
      await quests.connect(alice).buyBrushQuest(alice.address, playerId, 0, {value: 10});
      const balanceAfter = await brush.balanceOf(alice.address);
      expect(balanceBefore.add(1)).to.eq(balanceAfter);

      // Check it's completed and no longer considered active
      expect(await quests.isQuestCompleted(playerId, questId)).to.be.true;
      expect((await quests.activeQuests(playerId)).questId).to.be.eq(0);
    });
  });

  it("Cooked food giving away quest", async function () {
    const {playerId, players, itemNFT, world, alice, quests} = await loadFixture(playersFixture);

    const successPercent = 100;
    const minLevel = 1;
    const {queuedAction, rate, choiceId} = await setupBasicCooking(itemNFT, world, successPercent, minLevel);

    await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStatus.NONE);

    // Activate a quest
    const quest1 = allQuests.find((q) => q.questId === QUEST_ALMS_POOR) as Quest;
    const quest = {
      ...quest1,
      actionChoiceId: choiceId,
      burnItemTokenId: COOKED_MINNUS,
    };
    await quests.addQuests([quest], [false], [defaultMinRequirements]);
    const questId = quest.questId;
    await players.connect(alice).activateQuest(playerId, questId);
    await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]);
    await players.connect(alice).processActions(playerId);

    // Check it's completed
    expect(await quests.isQuestCompleted(playerId, questId)).to.be.true;
    expect(await itemNFT.balanceOf(alice.address, EstforConstants.COOKED_MINNUS)).to.eq(
      Math.floor((queuedAction.timespan * rate) / (3600 * 10) - quest1.actionChoiceNum)
    );
    expect(await itemNFT.balanceOf(alice.address, EstforConstants.RAW_MINNUS)).to.eq(
      1000 - Math.floor((queuedAction.timespan * rate) / (3600 * 10))
    );
  });

  it("Cooked food giving away quest, check burn can happen before quest completed", async function () {
    const {playerId, players, itemNFT, world, alice, quests} = await loadFixture(playersFixture);

    const successPercent = 100;
    const minLevel = 1;
    const {queuedAction, rate, choiceId} = await setupBasicCooking(itemNFT, world, successPercent, minLevel);
    await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStatus.NONE);

    // Activate a quest
    const quest1 = allQuests.find((q) => q.questId === QUEST_ALMS_POOR) as Quest;
    const quest = {
      ...quest1,
      actionChoiceId: choiceId,
      burnItemTokenId: COOKED_MINNUS,
    };
    await quests.addQuests([quest], [false], [defaultMinRequirements]);
    const questId = quest.questId;
    await players.connect(alice).activateQuest(playerId, questId);
    // Process immediately
    const initialMintNum = 10;
    await itemNFT.connect(alice).testMints(alice.address, [COOKED_MINNUS], [initialMintNum]);
    let pendingQueuedActionState = await players.pendingQueuedActionState(alice.address, playerId);
    expect(pendingQueuedActionState.quests.rewardItemTokenIds.length).to.eq(0);
    expect(pendingQueuedActionState.quests.consumedItemTokenIds.length).to.eq(0);
    await players.connect(alice).processActions(playerId);

    // Should not be completed, but the cooked items can be burned
    expect(await quests.isQuestCompleted(playerId, questId)).to.be.false;

    expect(await itemNFT.balanceOf(alice.address, EstforConstants.COOKED_MINNUS)).to.eq(10);
    expect(await itemNFT.balanceOf(alice.address, EstforConstants.RAW_MINNUS)).to.eq(1000);

    // rate is 100 an hour. So 1 would be done in 36 seconds
    await ethers.provider.send("evm_increaseTime", [36]);
    await ethers.provider.send("evm_mine", []);
    pendingQueuedActionState = await players.pendingQueuedActionState(alice.address, playerId);
    expect(pendingQueuedActionState.quests.rewardItemTokenIds.length).to.eq(0);
    expect(pendingQueuedActionState.quests.consumedItemTokenIds.length).to.eq(1);
    expect(pendingQueuedActionState.quests.consumedItemTokenIds[0]).to.eq(COOKED_MINNUS);
    expect(pendingQueuedActionState.quests.consumedAmounts[0]).to.eq(1);
    // Finish it
    await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]);
    await ethers.provider.send("evm_mine", []);
    pendingQueuedActionState = await players.pendingQueuedActionState(alice.address, playerId);
    expect(pendingQueuedActionState.quests.rewardItemTokenIds.length).to.eq(1);
    expect(pendingQueuedActionState.quests.rewardItemTokenIds.length).to.eq(
      pendingQueuedActionState.quests.rewardAmounts.length
    );
    expect(pendingQueuedActionState.quests.rewardItemTokenIds[0]).to.eq(SKILL_BOOST);
    expect(pendingQueuedActionState.quests.rewardAmounts[0]).to.eq(3);
    expect(pendingQueuedActionState.quests.consumedItemTokenIds.length).to.eq(1);
    expect(pendingQueuedActionState.quests.consumedAmounts.length).to.eq(1);
    expect(pendingQueuedActionState.quests.consumedItemTokenIds[0]).to.eq(COOKED_MINNUS);
    expect(pendingQueuedActionState.quests.consumedAmounts[0]).to.eq(5);
    await players.connect(alice).processActions(playerId);
    expect(await quests.isQuestCompleted(playerId, questId)).to.be.true;
    expect(await itemNFT.balanceOf(alice.address, EstforConstants.COOKED_MINNUS)).to.eq(
      Math.floor((queuedAction.timespan * rate) / (3600 * 10) - quest1.actionChoiceNum) + initialMintNum
    );
    expect(await itemNFT.balanceOf(alice.address, EstforConstants.RAW_MINNUS)).to.eq(
      1000 - Math.floor((queuedAction.timespan * rate) / (3600 * 10))
    );
  });

  it("Thieving quest", async function () {
    const {players, playerId, alice, quests, world, itemNFT} = await loadFixture(questsFixture);

    const xpPerHour = 2;
    let tx = await world.addAction({
      actionId: 2,
      info: {
        skill: EstforTypes.Skill.THIEVING,
        xpPerHour,
        minXP: 0,
        isDynamic: false,
        numSpawned: 0,
        handItemTokenIdRangeMin: EstforConstants.NONE,
        handItemTokenIdRangeMax: EstforConstants.NONE,
        isAvailable: true,
        actionChoiceRequired: false,
        successPercent: 100,
      },
      guaranteedRewards: [],
      randomRewards: [],
      combatStats: EstforTypes.emptyCombatStats,
    });

    const actionId = await getActionId(tx);
    const numHours = 24;
    const timespan = 3600 * numHours;
    const queuedAction: EstforTypes.QueuedActionInput = {
      attire: EstforTypes.noAttire,
      actionId,
      combatStyle: EstforTypes.CombatStyle.NONE,
      choiceId: EstforConstants.NONE,
      regenerateId: EstforConstants.NONE,
      timespan,
      rightHandEquipmentTokenId: EstforConstants.NONE,
      leftHandEquipmentTokenId: EstforConstants.NONE,
    };

    // Activate a quest
    const quest1 = allQuests.find((q) => q.questId === QUEST_HIDDEN_BOUNTY) as Quest;
    const quest = {
      ...quest1,
      actionId,
    };
    await quests.addQuests([quest], [false], [defaultMinRequirements]);
    const questId = quest.questId;
    await players.connect(alice).activateQuest(playerId, questId);

    await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStatus.NONE);
    await ethers.provider.send("evm_increaseTime", [(quest1.actionNum / 2) * 3600]);
    await ethers.provider.send("evm_mine", []);
    let pendingQueuedActionState = await players.pendingQueuedActionState(alice.address, playerId);
    expect(pendingQueuedActionState.quests.rewardItemTokenIds.length).to.eq(0);
    expect(pendingQueuedActionState.quests.actionIds.length).to.eq(1);
    expect(pendingQueuedActionState.quests.actionAmounts.length).to.eq(1);
    expect(pendingQueuedActionState.quests.actionAmounts[0]).to.eq(quest1.actionNum / 2);
    expect(pendingQueuedActionState.quests.actionIds[0]).to.eq(actionId);
    await players.connect(alice).processActions(playerId);
    await ethers.provider.send("evm_increaseTime", [(quest1.actionNum / 2) * 3600]);
    await ethers.provider.send("evm_mine", []);
    pendingQueuedActionState = await players.pendingQueuedActionState(alice.address, playerId);
    expect(pendingQueuedActionState.quests.rewardItemTokenIds.length).to.eq(2);
    expect(pendingQueuedActionState.quests.rewardItemTokenIds.length).to.eq(
      pendingQueuedActionState.quests.rewardAmounts.length
    );
    expect(pendingQueuedActionState.quests.rewardItemTokenIds[0]).to.eq(EstforConstants.RUBY);
    expect(pendingQueuedActionState.quests.rewardAmounts[0]).to.eq(1);
    expect(pendingQueuedActionState.quests.rewardItemTokenIds[1]).to.eq(EstforConstants.EMERALD);
    expect(pendingQueuedActionState.quests.rewardAmounts[1]).to.eq(1);
    expect(pendingQueuedActionState.quests.skills.length).to.eq(1);
    expect(pendingQueuedActionState.quests.xpGainedSkills.length).to.eq(1);
    expect(pendingQueuedActionState.quests.skills[0]).to.eq(Skill.THIEVING);
    expect(pendingQueuedActionState.quests.xpGainedSkills[0]).to.eq(1500);
    await players.connect(alice).processActions(playerId);
    expect(await quests.isQuestCompleted(playerId, questId)).to.be.true;
    expect(await itemNFT.balanceOf(alice.address, EstforConstants.RUBY)).to.eq(1);
    expect(await itemNFT.balanceOf(alice.address, EstforConstants.EMERALD)).to.eq(1);
  });

  it("Monsters killed", async function () {
    const {players, playerId, alice, quests, world, itemNFT} = await loadFixture(playersFixture);
    const {queuedAction, rate, numSpawned} = await setupBasicMeleeCombat(itemNFT, world);

    // Activate a quest
    const quest1 = allQuests.find((q) => q.questId === QUEST_SUPPLY_RUN) as Quest;
    const quest = {
      ...quest1,
      actionId: queuedAction.actionId,
      actionNum: 5,
      burnItemTokenId: EstforConstants.BRONZE_ARROW,
      burnAmount: 5,
    };
    await quests.addQuests([quest], [false], [defaultMinRequirements]);
    const questId = quest.questId;
    await players.connect(alice).activateQuest(playerId, questId);

    await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStatus.NONE);

    // Kill 1
    const time = 3600 / numSpawned;
    await ethers.provider.send("evm_increaseTime", [time]);
    await ethers.provider.send("evm_mine", []);
    let pendingQueuedActionState = await players.pendingQueuedActionState(alice.address, playerId);
    expect(pendingQueuedActionState.quests.rewardItemTokenIds.length).to.eq(0);
    expect(pendingQueuedActionState.quests.consumedItemTokenIds.length).to.eq(1); // Burn 1 of them
    expect(pendingQueuedActionState.quests.consumedItemTokenIds[0]).to.eq(EstforConstants.BRONZE_ARROW);
    expect(pendingQueuedActionState.quests.consumedAmounts[0]).to.eq(1);
    expect(pendingQueuedActionState.quests.actionIds.length).to.eq(1);
    expect(pendingQueuedActionState.quests.actionAmounts.length).to.eq(1);
    expect(pendingQueuedActionState.quests.actionIds[0]).to.eq(queuedAction.actionId);
    expect(pendingQueuedActionState.quests.actionAmounts[0]).to.eq(1);

    await players.connect(alice).processActions(playerId);
    expect(await itemNFT.balanceOf(alice.address, EstforConstants.BRONZE_ARROW)).to.eq(0); // All are burned

    // Kill the rest
    await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]);
    await ethers.provider.send("evm_mine", []);
    pendingQueuedActionState = await players.pendingQueuedActionState(alice.address, playerId);
    expect(pendingQueuedActionState.equipmentStates[0].producedItemTokenIds.length).to.eq(1);
    expect(pendingQueuedActionState.equipmentStates[0].producedAmounts.length).to.eq(1);
    expect(pendingQueuedActionState.equipmentStates[0].producedAmounts[0]).to.eq(9);
    expect(pendingQueuedActionState.quests.consumedItemTokenIds.length).to.eq(1);
    expect(pendingQueuedActionState.quests.consumedItemTokenIds[0]).to.eq(EstforConstants.BRONZE_ARROW);
    expect(pendingQueuedActionState.quests.consumedAmounts[0]).to.eq(4);
    expect(pendingQueuedActionState.quests.rewardItemTokenIds.length).to.eq(1);
    expect(pendingQueuedActionState.quests.rewardItemTokenIds[0]).to.eq(EstforConstants.NATUOW_LEATHER);
    expect(pendingQueuedActionState.quests.rewardAmounts.length).to.eq(1);
    expect(pendingQueuedActionState.quests.rewardAmounts[0]).to.eq(100);
    expect(pendingQueuedActionState.quests.skills.length).to.eq(1);
    expect(pendingQueuedActionState.quests.xpGainedSkills.length).to.eq(1);
    expect(pendingQueuedActionState.quests.skills[0]).to.eq(Skill.DEFENCE);
    expect(pendingQueuedActionState.quests.xpGainedSkills[0]).to.eq(2500);
    await players.connect(alice).processActions(playerId);
    expect(await itemNFT.balanceOf(alice.address, EstforConstants.BRONZE_ARROW)).to.eq((rate * numSpawned) / 10 - 5);
  });

  it("Dependent quest", async function () {
    const {players, playerId, alice, quests, world, itemNFT} = await loadFixture(playersFixture);
    const {queuedAction, rate, numSpawned} = await setupBasicMeleeCombat(itemNFT, world);

    // Activate a quest
    const quest1 = allQuests.find((q) => q.questId === QUEST_SUPPLY_RUN) as Quest;
    const quest = {
      ...quest1,
      actionId: queuedAction.actionId,
      actionNum: 5,
      burnItemTokenId: EstforConstants.BRONZE_ARROW,
      burnAmount: 5,
    };

    const anotherQuest = {...quest, questId: QUEST_TWO_BIRDS, dependentQuestId: QUEST_SUPPLY_RUN};
    await quests.addQuests([quest, anotherQuest], [false, false], [defaultMinRequirements, defaultMinRequirements]);

    const anotherQuestId = anotherQuest.questId;
    await expect(players.connect(alice).activateQuest(playerId, anotherQuestId))
      .to.be.revertedWithCustomError(quests, "DependentQuestNotCompleted")
      .withArgs(QUEST_SUPPLY_RUN);

    // Complete it
    const questId = quest.questId;
    await players.connect(alice).activateQuest(playerId, questId);

    await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStatus.NONE);
    await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]);
    await ethers.provider.send("evm_mine", []);
    await players.connect(alice).processActions(playerId);

    await expect(players.connect(alice).activateQuest(playerId, anotherQuestId)).to.not.be.reverted;
  });

  it("ActionChoice quest", async function () {
    const {players, playerId, alice, quests, firemakingQuest, queuedAction, rate, itemNFT} = await loadFixture(
      questsFixture
    );

    await quests.addQuests([firemakingQuest], [false], [defaultMinRequirements]);
    const questId = 1;
    await players.connect(alice).activateQuest(playerId, questId);

    await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStatus.NONE);
    await ethers.provider.send("evm_increaseTime", [1]);
    await ethers.provider.send("evm_mine", []);

    let pendingQueuedActionState = await players.pendingQueuedActionState(alice.address, playerId);
    expect(pendingQueuedActionState.quests.rewardItemTokenIds.length).to.eq(0);

    const timeNeeded = ((rate / 10) * 3600) / firemakingQuest.actionChoiceNum;

    // Set time to just before, should still not have quest rewards
    await ethers.provider.send("evm_increaseTime", [timeNeeded - 3]);
    await ethers.provider.send("evm_mine", []);
    pendingQueuedActionState = await players.pendingQueuedActionState(alice.address, playerId);
    expect(pendingQueuedActionState.quests.rewardItemTokenIds.length).to.eq(0);
    // Amount burnt should be over
    await ethers.provider.send("evm_increaseTime", [3]);
    await ethers.provider.send("evm_mine", []);
    pendingQueuedActionState = await players.pendingQueuedActionState(alice.address, playerId);
    expect(pendingQueuedActionState.quests.rewardItemTokenIds.length).to.eq(1);
    expect(pendingQueuedActionState.quests.rewardAmounts[0]).to.eq(firemakingQuest.rewardAmount);
    expect(pendingQueuedActionState.quests.rewardItemTokenIds[0]).to.eq(firemakingQuest.rewardItemTokenId);
    expect(pendingQueuedActionState.xpRewardItemTokenIds.length).to.eq(0); // Move this to another test
    expect(pendingQueuedActionState.xpRewardAmounts.length).to.eq(0); // Move this to another test

    await players.connect(alice).processActions(playerId);

    expect(await itemNFT.balanceOf(alice.address, firemakingQuest.rewardItemTokenId)).to.eq(
      firemakingQuest.rewardAmount
    );
    expect(firemakingQuest.rewardAmount).to.be.gt(0); // sanity check
  });

  it("XP rewards gained", async function () {
    const {playerId, players, itemNFT, world, alice, quests} = await loadFixture(playersFixture);

    const successPercent = 100;
    const minLevel = 1;
    const {queuedAction, rate, choiceId} = await setupBasicCooking(itemNFT, world, successPercent, minLevel);

    await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStatus.NONE);

    // Activate a quest
    const quest1 = allQuests.find((q) => q.questId === QUEST_ALMS_POOR) as Quest;
    const quest = {
      ...quest1,
      actionChoiceId: choiceId,
      burnItemTokenId: COOKED_MINNUS,
      skillReward: Skill.WOODCUTTING,
      skillXPGained: 1,
    };
    await quests.addQuests([quest], [false], [defaultMinRequirements]);
    const questId = quest.questId;
    await players.connect(alice).activateQuest(playerId, questId);
    await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]);
    await players.connect(alice).processActions(playerId);
    const cookingXP = await players.xp(playerId, Skill.COOKING);
    expect(await players.xp(playerId, Skill.WOODCUTTING)).to.eq(1);
    expect((await players.players(playerId)).totalXP).to.eq(START_XP + Number(cookingXP) + 1);
  });

  describe("Activate a quest", function () {
    it("Should activate a quest for player correctly", async function () {
      const {alice, playerId, quests, firemakingQuestLog, players} = await loadFixture(questsFixture);
      await quests.addQuests([firemakingQuestLog], [false], [defaultMinRequirements]);
      const questId = 2;
      await players.connect(alice).activateQuest(playerId, questId);
      const activeQuest = await quests.activeQuests(playerId);
      expect(activeQuest.questId).to.equal(questId);
    });

    it("Should fail to activate a quest for non-owner of player", async function () {
      const {players, playerId, quests, firemakingQuestLog} = await loadFixture(questsFixture);
      await quests.addQuests([firemakingQuestLog], [false], [defaultMinRequirements]);
      const questId = 2;
      await expect(players.activateQuest(playerId, questId)).to.be.revertedWithCustomError(
        players,
        "NotOwnerOfPlayerAndActive"
      );
    });

    it("Should fail to activate a non-existing quest", async function () {
      const {alice, players, playerId, quests, firemakingQuestLog} = await loadFixture(questsFixture);
      await quests.addQuests([firemakingQuestLog], [false], [defaultMinRequirements]);
      const questId = 3;
      await expect(players.connect(alice).activateQuest(playerId, questId)).to.be.revertedWithCustomError(
        quests,
        "QuestDoesntExist"
      );
    });

    it("Should fail to re-activate a completed quest", async function () {
      const {players, playerId, alice, quests, firemakingQuest, queuedAction, rate, itemNFT} = await loadFixture(
        questsFixture
      );

      await quests.addQuests([firemakingQuest], [false], [defaultMinRequirements]);
      const questId = 1;
      await players.connect(alice).activateQuest(playerId, questId);

      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStatus.NONE);
      const timeNeeded = ((rate / 10) * 3600) / firemakingQuest.actionChoiceNum;

      // Set time to just before, should still not have quest rewards
      await ethers.provider.send("evm_increaseTime", [timeNeeded]);
      await players.connect(alice).processActions(playerId);

      expect(await itemNFT.balanceOf(alice.address, firemakingQuest.rewardItemTokenId)).to.eq(
        firemakingQuest.rewardAmount
      );

      // Check it's completed
      expect(await quests.isQuestCompleted(playerId, questId)).to.be.true;
      expect((await quests.activeQuests(playerId)).questId).to.eq(0);
      // Check it can't be activated again
      await expect(players.connect(alice).activateQuest(playerId, questId)).to.be.revertedWithCustomError(
        quests,
        "QuestCompletedAlready"
      );
    });

    // TODO: Deactivate a quest, start a new one do some progress then reactivate the old one and check that it continues
  });
});
