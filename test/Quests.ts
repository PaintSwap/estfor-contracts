import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {EstforConstants, EstforTypes, NONE} from "@paintswap/estfor-definitions";
import {
  ACTION_WOODCUTTING_LOG,
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
import {setupBasicCooking, setupBasicFiremaking, setupBasicMeleeCombat, setupBasicWoodcutting} from "./Players/utils";
import {emptyActionChoice, getActionChoiceId, getActionId, GUAR_MUL, RATE_MUL, SPAWN_MUL, START_XP} from "./utils";

export async function questsFixture() {
  const fixture = await loadFixture(playersFixture);
  const {world, itemNFT} = fixture;

  const {queuedAction, choiceId, rate} = await setupBasicFiremaking(itemNFT, world, 0);

  const firemakingQuest: Quest = {
    questId: 1,
    dependentQuestId: 0,
    actionId1: NONE,
    actionNum1: 0,
    actionId2: NONE,
    actionNum2: 0,
    actionChoiceId: choiceId,
    actionChoiceNum: 100,
    skillReward: Skill.NONE,
    skillXPGained: 0,
    rewardItemTokenId1: EstforConstants.OAK_LOG,
    rewardAmount1: 5,
    rewardItemTokenId2: NONE,
    rewardAmount2: 0,
    burnItemTokenId: NONE,
    burnAmount: 0,
    requireActionsCompletedBeforeBurning: false,
  };

  const firemakingQuestLog: Quest = {
    questId: 2,
    dependentQuestId: 0,
    actionId1: NONE,
    actionNum1: 0,
    actionId2: NONE,
    actionNum2: 0,
    actionChoiceId: choiceId,
    actionChoiceNum: 100,
    skillReward: Skill.NONE,
    skillXPGained: 0,
    rewardItemTokenId1: EstforConstants.LOG,
    rewardAmount1: 10,
    rewardItemTokenId2: NONE,
    rewardAmount2: 0,
    burnItemTokenId: NONE,
    burnAmount: 0,
    requireActionsCompletedBeforeBurning: false,
  };

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
      expect(quest.rewardItemTokenId1).to.equal(firemakingQuest.rewardItemTokenId1);
      expect(quest.rewardAmount1).to.equal(firemakingQuest.rewardAmount1);
      expect(await quests.isRandomQuest(firemakingQuest.questId)).to.be.false;
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

  describe("Edit quest", function () {
    it("Should edit a quest correctly", async function () {
      const {quests, firemakingQuest} = await loadFixture(questsFixture);
      await quests.addQuests([firemakingQuest], [false], [defaultMinRequirements]);
      const editedQuest = {...firemakingQuest, actionChoiceNum: 23};
      await quests.editQuest(editedQuest, defaultMinRequirements);
      const quest = await quests.allFixedQuests(1);
      expect(quest.actionChoiceNum).to.equal(editedQuest.actionChoiceNum);
    });

    it("Should fail to edit a quest for non-owner", async function () {
      const {alice, quests, firemakingQuest} = await loadFixture(questsFixture);
      await quests.addQuests([firemakingQuest], [false], [defaultMinRequirements]);
      await expect(
        quests.connect(alice).editQuest(firemakingQuest, defaultMinRequirements)
      ).to.be.revertedWithCustomError(quests, "CallerIsNotOwner");
    });

    it("Should fail to edit a non-existing quest", async function () {
      const {quests, firemakingQuest} = await loadFixture(questsFixture);
      await quests.addQuests([firemakingQuest], [false], [defaultMinRequirements]);
      const editedQuest = {...firemakingQuest, questId: 100, actionChoiceNum: 23};
      await expect(quests.editQuest(editedQuest, defaultMinRequirements)).to.be.revertedWithCustomError(
        quests,
        "QuestDoesntExist"
      );
    });

    it("Lowering amounts where amount completed is already above should not cause underflows (actionNum1)", async function () {
      const {alice, playerId, quests, players, itemNFT, world} = await loadFixture(playersFixture);
      // Check that this is not marked as completed automatically
      const {queuedAction, rate} = await setupBasicWoodcutting(itemNFT, world);
      const quest = {
        questId: 1,
        dependentQuestId: 0,
        actionId1: ACTION_WOODCUTTING_LOG,
        actionNum1: rate / GUAR_MUL,
        actionId2: NONE,
        actionNum2: 0,
        actionChoiceId: 0,
        actionChoiceNum: 0,
        skillReward: Skill.NONE,
        skillXPGained: 0,
        rewardItemTokenId1: NONE,
        rewardAmount1: 0,
        rewardItemTokenId2: NONE,
        rewardAmount2: 0,
        burnItemTokenId: NONE,
        burnAmount: 0,
        requireActionsCompletedBeforeBurning: false,
      };

      await quests.addQuests([quest], [false], [defaultMinRequirements]);
      const questId = quest.questId;
      await players.connect(alice).activateQuest(playerId, questId);

      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStatus.NONE);
      await ethers.provider.send("evm_increaseTime", [1800]);
      await players.connect(alice).processActions(playerId);

      quest.actionNum1 = rate / (GUAR_MUL * 4);
      await quests.editQuest(quest, defaultMinRequirements);
      await ethers.provider.send("evm_increaseTime", [1800]); // Finish
      await ethers.provider.send("evm_mine", []);
      const pendingQueuedActionState = await players.pendingQueuedActionState(alice.address, playerId);
      expect(pendingQueuedActionState.quests.questsCompleted.length).is.eq(1);

      await expect(players.connect(alice).processActions(playerId)).to.not.be.reverted;
    });

    it("TODO - Lowering amounts where amount completed is already above should not cause underflows (actionNum2)", async function () {});
    it("TODO - Lowering amounts where amount completed is already above should not cause underflows (actionChoiceNum1)", async function () {});
    it("TODO - Lowering amounts where amount completed is already above should not cause underflows (burnAmount)", async function () {});
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
      const {alice, playerId, quests, players} = await loadFixture(questsFixture);
      const quest = allQuests.find((q) => q.questId === QUEST_PURSE_STRINGS);
      await quests.addQuests([quest], [false], [defaultMinRequirements]);
      await expect(
        players.connect(alice).buyBrushQuest(alice.address, playerId, 0, true, {value: 10})
      ).to.be.revertedWithCustomError(quests, "InvalidActiveQuest");
    });

    it("Trying to buy with no FTM", async function () {
      const {alice, playerId, quests, players} = await loadFixture(questsFixture);
      const quest = allQuests.find((q) => q.questId === QUEST_PURSE_STRINGS) as Quest;
      await quests.addQuests([quest], [false], [defaultMinRequirements]);
      const questId = quest.questId;
      await players.connect(alice).activateQuest(playerId, questId);
      await expect(
        players.connect(alice).buyBrushQuest(alice.address, playerId, 0, true, {value: 0})
      ).to.be.revertedWithCustomError(quests, "InvalidFTMAmount");
    });

    it("Quest completed", async function () {
      const {alice, playerId, quests, players, brush, itemNFT} = await loadFixture(questsFixture);
      const quest = allQuests.find((q) => q.questId === QUEST_PURSE_STRINGS) as Quest;
      await quests.addQuests([quest], [false], [defaultMinRequirements]);
      const questId = quest.questId;
      expect(questId).to.not.eq(0);
      await players.connect(alice).activateQuest(playerId, questId);
      expect((await quests.activeQuests(playerId)).questId).to.be.eq(questId);
      const balanceBefore = await brush.balanceOf(alice.address);
      await players.connect(alice).buyBrushQuest(alice.address, playerId, 0, true, {value: 10});
      const balanceAfter = await brush.balanceOf(alice.address);
      expect(balanceBefore.add(1)).to.eq(balanceAfter);

      // Check it's completed and no longer considered active
      expect(await quests.isQuestCompleted(playerId, questId)).to.be.true;
      expect((await quests.activeQuests(playerId)).questId).to.be.eq(0);

      // Check the rewards are as expected
      expect(await itemNFT.balanceOf(alice.address, quest.rewardItemTokenId1)).to.eq(quest.rewardAmount1);
    });

    it("Check that quest is not completed after an action", async function () {
      const {alice, playerId, quests, players, itemNFT, world} = await loadFixture(playersFixture);
      const quest = allQuests.find((q) => q.questId === QUEST_PURSE_STRINGS) as Quest;
      await quests.addQuests([quest], [false], [defaultMinRequirements]);
      const questId = quest.questId;
      await players.connect(alice).activateQuest(playerId, questId);
      // Check that this is not marked as completed automatically
      const {queuedAction} = await setupBasicWoodcutting(itemNFT, world);
      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStatus.NONE);
      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan + 2]);
      await ethers.provider.send("evm_mine", []);
      const pendingQueuedActionState = await players.pendingQueuedActionState(alice.address, playerId);
      expect(pendingQueuedActionState.quests.questsCompleted.length).is.eq(0);
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
      actionChoiceNum: 5,
      burnItemTokenId: COOKED_MINNUS,
      burnAmount: 5,
    };
    await quests.addQuests([quest], [false], [defaultMinRequirements]);
    const questId = quest.questId;
    await players.connect(alice).activateQuest(playerId, questId);
    await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]);
    await players.connect(alice).processActions(playerId);

    // Check it's completed
    expect(await quests.isQuestCompleted(playerId, questId)).to.be.true;
    expect(await itemNFT.balanceOf(alice.address, EstforConstants.COOKED_MINNUS)).to.eq(
      Math.floor((queuedAction.timespan * rate) / (3600 * RATE_MUL) - quest.actionChoiceNum)
    );
    expect(await itemNFT.balanceOf(alice.address, EstforConstants.RAW_MINNUS)).to.eq(
      1000 - Math.floor((queuedAction.timespan * rate) / (3600 * RATE_MUL))
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
      actionChoiceNum: 5,
      burnItemTokenId: COOKED_MINNUS,
      burnAmount: 5,
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
      Math.floor((queuedAction.timespan * rate) / (3600 * RATE_MUL) - quest.actionChoiceNum) + initialMintNum
    );
    expect(await itemNFT.balanceOf(alice.address, EstforConstants.RAW_MINNUS)).to.eq(
      1000 - Math.floor((queuedAction.timespan * rate) / (3600 * RATE_MUL))
    );
  });

  it("Cooked food giving away quest, check combat consuming the cooked food, before quest completed", async function () {
    const {playerId, players, itemNFT, world, alice, quests} = await loadFixture(playersFixture);

    const successPercent = 100;
    const minLevel = 1;
    const {queuedAction: queuedActionCooking, choiceId} = await setupBasicCooking(
      itemNFT,
      world,
      successPercent,
      minLevel
    );
    let queuedAction = {...queuedActionCooking, timespan: 100};

    const monsterCombatStats: EstforTypes.CombatStats = {
      melee: 100,
      magic: 0,
      range: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangeDefence: 0,
      health: 1000,
    };

    const numSpawned = 100 * SPAWN_MUL;
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
        isAvailable: true,
        actionChoiceRequired: true,
        successPercent: 100,
      },
      guaranteedRewards: [],
      randomRewards: [],
      combatStats: monsterCombatStats,
    });
    const actionId = await getActionId(tx);

    tx = await world.addActionChoice(EstforConstants.NONE, 2, {
      ...emptyActionChoice,
      skill: EstforTypes.Skill.MELEE,
    });
    const timespan = 3600;
    const queuedActionMelee: EstforTypes.QueuedActionInput = {
      attire: EstforTypes.noAttire,
      actionId,
      combatStyle: EstforTypes.CombatStyle.ATTACK,
      choiceId: await getActionChoiceId(tx),
      regenerateId: EstforConstants.COOKED_MINNUS,
      timespan,
      rightHandEquipmentTokenId: EstforConstants.NONE,
      leftHandEquipmentTokenId: EstforConstants.NONE,
    };

    await players
      .connect(alice)
      .startActions(playerId, [queuedAction, queuedActionMelee], EstforTypes.ActionQueueStatus.NONE);

    // Activate a quest
    const quest1 = allQuests.find((q) => q.questId === QUEST_ALMS_POOR) as Quest;
    const quest = {
      ...quest1,
      actionChoiceId: choiceId,
      actionChoiceNum: 5,
      burnItemTokenId: COOKED_MINNUS,
      burnAmount: 5,
    };
    await quests.addQuests([quest], [false], [defaultMinRequirements]);
    const questId = quest.questId;
    await players.connect(alice).activateQuest(playerId, questId);

    // rate is 100 an hour. So 1 would be done in 36 seconds
    await ethers.provider.send("evm_increaseTime", [queuedAction.timespan + queuedActionMelee.timespan]);
    await ethers.provider.send("evm_mine", []);
    let pendingQueuedActionState = await players.pendingQueuedActionState(alice.address, playerId);
    // Check died in the second one
    expect(pendingQueuedActionState.equipmentStates.length).to.eq(2);
    expect(pendingQueuedActionState.actionMetadatas.length).to.eq(2);
    expect(pendingQueuedActionState.actionMetadatas[1].died).to.be.true;
    expect(pendingQueuedActionState.equipmentStates[0].consumedAmounts.length).to.eq(1);
    expect(pendingQueuedActionState.equipmentStates[0].consumedAmounts[0]).to.eq(2);
    expect(pendingQueuedActionState.quests.rewardItemTokenIds.length).to.eq(0); // Quest not completed
    expect(pendingQueuedActionState.quests.consumedItemTokenIds.length).to.eq(0); // No fish consumed as all used up in combat
    await players.connect(alice).processActions(playerId);
    expect(await quests.isQuestCompleted(playerId, questId)).to.be.false;

    // Queue more cooking
    queuedAction.timespan = 3600;
    await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStatus.NONE);
    await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]);
    await players.connect(alice).processActions(playerId);
    expect(await quests.isQuestCompleted(playerId, questId)).to.be.true;
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
      actionId1: actionId,
    };
    await quests.addQuests([quest], [false], [defaultMinRequirements]);
    const questId = quest.questId;
    await players.connect(alice).activateQuest(playerId, questId);

    await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStatus.NONE);
    await ethers.provider.send("evm_increaseTime", [(quest1.actionNum1 / 2) * 3600]);
    await ethers.provider.send("evm_mine", []);
    let pendingQueuedActionState = await players.pendingQueuedActionState(alice.address, playerId);
    expect(pendingQueuedActionState.quests.rewardItemTokenIds.length).to.eq(0);
    expect(pendingQueuedActionState.quests.activeQuestInfo.length).to.eq(1);
    expect(pendingQueuedActionState.quests.activeQuestInfo[0].actionCompletedNum1).to.eq(quest1.actionNum1 / 2);
    await players.connect(alice).processActions(playerId);
    await ethers.provider.send("evm_increaseTime", [(quest1.actionNum1 / 2) * 3600]);
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
    expect(pendingQueuedActionState.quests.skills[0]).to.eq(quest1.skillReward);
    expect(pendingQueuedActionState.quests.xpGainedSkills[0]).to.eq(quest1.skillXPGained);
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
      actionId1: queuedAction.actionId,
      actionNum1: 5,
      burnItemTokenId: EstforConstants.BRONZE_ARROW,
      burnAmount: 5,
    };
    await quests.addQuests([quest], [false], [defaultMinRequirements]);
    const questId = quest.questId;
    await players.connect(alice).activateQuest(playerId, questId);

    await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStatus.NONE);

    // Kill 1
    const time = (3600 * SPAWN_MUL) / numSpawned;
    await ethers.provider.send("evm_increaseTime", [time]);
    await ethers.provider.send("evm_mine", []);
    let pendingQueuedActionState = await players.pendingQueuedActionState(alice.address, playerId);
    expect(pendingQueuedActionState.quests.rewardItemTokenIds.length).to.eq(0);
    expect(pendingQueuedActionState.quests.consumedItemTokenIds.length).to.eq(1); // Burn 1 of them
    expect(pendingQueuedActionState.quests.consumedItemTokenIds[0]).to.eq(EstforConstants.BRONZE_ARROW);
    expect(pendingQueuedActionState.quests.consumedAmounts[0]).to.eq(1);
    expect(pendingQueuedActionState.quests.activeQuestInfo.length).to.eq(1);
    expect(pendingQueuedActionState.quests.activeQuestInfo[0].actionCompletedNum1).to.eq(1);

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
    expect(pendingQueuedActionState.quests.skills[0]).to.eq(quest1.skillReward);
    expect(pendingQueuedActionState.quests.xpGainedSkills[0]).to.eq(quest1.skillXPGained);
    await players.connect(alice).processActions(playerId);
    expect(await itemNFT.balanceOf(alice.address, EstforConstants.BRONZE_ARROW)).to.eq(
      (rate * numSpawned) / (10 * SPAWN_MUL) - 5
    );
  });

  it("Dependent quest", async function () {
    const {players, playerId, alice, quests, world, itemNFT} = await loadFixture(playersFixture);
    const {queuedAction} = await setupBasicMeleeCombat(itemNFT, world);

    // Activate a quest
    const quest1 = allQuests.find((q) => q.questId === QUEST_SUPPLY_RUN) as Quest;
    const quest = {
      ...quest1,
      actionId1: queuedAction.actionId,
      actionNum1: 5,
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

    const timeNeeded = ((rate / RATE_MUL) * 3600) / firemakingQuest.actionChoiceNum;

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
    expect(pendingQueuedActionState.quests.rewardAmounts[0]).to.eq(firemakingQuest.rewardAmount1);
    expect(pendingQueuedActionState.quests.rewardItemTokenIds[0]).to.eq(firemakingQuest.rewardItemTokenId1);
    expect(pendingQueuedActionState.xpRewardItemTokenIds.length).to.eq(0); // Move this to another test
    expect(pendingQueuedActionState.xpRewardAmounts.length).to.eq(0); // Move this to another test

    await players.connect(alice).processActions(playerId);

    expect(await itemNFT.balanceOf(alice.address, firemakingQuest.rewardItemTokenId1)).to.eq(
      firemakingQuest.rewardAmount1
    );
    expect(firemakingQuest.rewardAmount1).to.be.gt(0); // sanity check
  });

  it("XP gained", async function () {
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
      actionChoiceNum: 5,
      burnItemTokenId: COOKED_MINNUS,
      burnAmount: 5,
      skillReward: Skill.WOODCUTTING,
      skillXPGained: 10000,
    };
    await quests.addQuests([quest], [false], [defaultMinRequirements]);
    const questId = quest.questId;
    await players.connect(alice).activateQuest(playerId, questId);
    await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]);

    // Check XP threshold rewards are given
    const rewards: EstforTypes.Equipment[] = [{itemTokenId: EstforConstants.BRONZE_BAR, amount: 3}];
    await players.addXPThresholdRewards([{xpThreshold: 10000, rewards}]);

    await players.connect(alice).processActions(playerId);
    const cookingXP = await players.xp(playerId, Skill.COOKING);
    expect(await players.xp(playerId, Skill.WOODCUTTING)).to.eq(10000);
    expect((await players.players(playerId)).totalXP).to.eq(START_XP + Number(cookingXP) + 10000);
    expect(await itemNFT.balanceOf(alice.address, EstforConstants.BRONZE_BAR)).to.eq(3);
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
      const questId = firemakingQuest.questId;
      await players.connect(alice).activateQuest(playerId, questId);

      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStatus.NONE);
      const timeNeeded = ((rate / 10) * 3600) / firemakingQuest.actionChoiceNum;

      await ethers.provider.send("evm_increaseTime", [timeNeeded]);
      await players.connect(alice).processActions(playerId);

      expect(await itemNFT.balanceOf(alice.address, firemakingQuest.rewardItemTokenId1)).to.eq(
        firemakingQuest.rewardAmount1
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

    it("Re-activated quest which was deactivated should continue at the same place", async function () {
      const {players, playerId, alice, quests, firemakingQuest, queuedAction, rate, itemNFT} = await loadFixture(
        questsFixture
      );

      await quests.addQuests([firemakingQuest], [false], [defaultMinRequirements]);
      const questId = firemakingQuest.questId;
      await players.connect(alice).activateQuest(playerId, questId);

      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStatus.NONE);
      const timeNeeded = ((rate / RATE_MUL) * 3600) / firemakingQuest.actionChoiceNum;

      // Set time to just before, should still not have quest rewards
      await ethers.provider.send("evm_increaseTime", [timeNeeded - 10]);
      // Deactivate it, should auto process
      await players.connect(alice).deactivateQuest(playerId);

      expect(await itemNFT.balanceOf(alice.address, EstforConstants.LOG)).to.eq(
        5000 - Math.floor((rate * 3600) / ((timeNeeded - 10) * RATE_MUL)) + 1
      );

      expect(await itemNFT.balanceOf(alice.address, firemakingQuest.rewardItemTokenId1)).to.eq(0);

      // Check it's not completed
      expect(await quests.isQuestCompleted(playerId, questId)).to.be.false;
      expect((await quests.activeQuests(playerId)).questId).to.eq(0);

      // Re-activate it
      await players.connect(alice).activateQuest(playerId, questId);
      await ethers.provider.send("evm_increaseTime", [10]);
      await players.connect(alice).processActions(playerId);
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.LOG)).to.eq(
        5000 - Math.floor((rate * 3600) / (timeNeeded * RATE_MUL))
      );

      expect(await quests.isQuestCompleted(playerId, questId)).to.be.true;
      expect(await itemNFT.balanceOf(alice.address, firemakingQuest.rewardItemTokenId1)).to.eq(
        firemakingQuest.rewardAmount1
      );
      expect((await quests.activeQuests(playerId)).questId).to.eq(0);
    });

    it("Re-activated quest which has progress in another quest should continue at the same place once reactivated", async function () {
      const {
        players,
        playerId,
        alice,
        quests,
        firemakingQuest,
        firemakingQuestLog,
        queuedAction: queuedActionFiremaking,
        rate,
        itemNFT,
      } = await loadFixture(questsFixture);

      const queuedAction = {...queuedActionFiremaking, timespan: 3636};

      await quests.addQuests(
        [firemakingQuest, firemakingQuestLog],
        [false, false],
        [defaultMinRequirements, defaultMinRequirements]
      );
      const questId = firemakingQuest.questId;
      await players.connect(alice).activateQuest(playerId, questId);

      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStatus.NONE);
      const timeNeeded = ((rate / RATE_MUL) * 3600) / firemakingQuest.actionChoiceNum;

      // Set time to just before, should still not have quest rewards
      await ethers.provider.send("evm_increaseTime", [timeNeeded - 10]);
      // Activate another quest should auto process current quest
      const anotherQuestId = firemakingQuestLog.questId;
      await players.connect(alice).activateQuest(playerId, anotherQuestId);
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.LOG)).to.eq(
        5000 - Math.floor((rate * 3600) / ((timeNeeded - 10) * RATE_MUL)) + 1
      );

      expect(await itemNFT.balanceOf(alice.address, firemakingQuest.rewardItemTokenId1)).to.eq(0);

      // Check it's not completed
      expect(await quests.isQuestCompleted(playerId, questId)).to.be.false;
      expect((await quests.activeQuests(playerId)).questId).to.eq(anotherQuestId);

      await ethers.provider.send("evm_increaseTime", [10]);
      // Activate the other quest and finish it
      await players.connect(alice).activateQuest(playerId, questId);
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.LOG)).to.eq(
        5000 - Math.floor((rate * 3600) / ((timeNeeded - 10) * RATE_MUL))
      );
      expect(await quests.isQuestCompleted(playerId, questId)).to.be.false;
      await ethers.provider.send("evm_increaseTime", [36]);
      await players.connect(alice).processActions(playerId);
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.LOG)).to.eq(
        5000 - Math.floor((rate * 3600) / (timeNeeded * RATE_MUL)) - 1
      );

      expect(await quests.isQuestCompleted(playerId, questId)).to.be.true;
      expect(await itemNFT.balanceOf(alice.address, firemakingQuest.rewardItemTokenId1)).to.eq(
        firemakingQuest.rewardAmount1
      );
      expect((await quests.activeQuests(playerId)).questId).to.eq(0);
    });
  });
});
