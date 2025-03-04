import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {EstforConstants, EstforTypes, NONE} from "@paintswap/estfor-definitions";
import {
  ACTION_WOODCUTTING_LOG,
  COOKED_MINNUS,
  GUAR_MUL,
  QUEST_ALMS_POOR,
  QUEST_HIDDEN_BOUNTY,
  QUEST_PURSE_STRINGS,
  QUEST_SUPPLY_RUN,
  QUEST_TOWN_COOKOUT,
  QUEST_TWO_BIRDS,
  RATE_MUL,
  SKILL_BOOST,
  SPAWN_MUL
} from "@paintswap/estfor-definitions/constants";
import {Skill, defaultActionChoice} from "@paintswap/estfor-definitions/types";
import {expect} from "chai";
import {ethers} from "hardhat";
import {allQuests, defaultMinRequirements, QuestInput} from "../scripts/data/quests";
import {playersFixture} from "./Players/PlayersFixture";
import {
  getPlayersHelper,
  setupBasicCooking,
  setupBasicFiremaking,
  setupBasicFishing,
  setupBasicFletching,
  setupBasicMeleeCombat,
  setupBasicWoodcutting
} from "./Players/utils";
import {getActionChoiceId, getActionId, NO_DONATION_AMOUNT, START_XP} from "./utils";
import {SKIP_XP_THRESHOLD_EFFECTS} from "../scripts/utils";

export async function questsFixture() {
  const fixture = await loadFixture(playersFixture);
  const {worldActions, itemNFT} = fixture;

  const {queuedAction, choiceId, rate} = await setupBasicFiremaking(itemNFT, worldActions, 0);

  const firemakingQuest: QuestInput = {
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
    isFullModeOnly: false,
    worldLocation: 0
  };

  const firemakingQuestLog: QuestInput = {
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
    isFullModeOnly: false,
    worldLocation: 0
  };

  return {
    ...fixture,
    firemakingQuest,
    firemakingQuestLog,
    queuedAction,
    choiceId,
    rate
  };
}

describe("Quests", function () {
  describe("Add a quest", function () {
    it("Should add a quest correctly", async function () {
      const {quests, firemakingQuest} = await loadFixture(questsFixture);

      await quests.addQuests([firemakingQuest], [defaultMinRequirements]);
      const quest = await quests.allFixedQuests(1);
      expect(quest.rewardItemTokenId1).to.equal(firemakingQuest.rewardItemTokenId1);
      expect(quest.rewardAmount1).to.equal(firemakingQuest.rewardAmount1);
    });

    it("Should fail to add same quest twice", async function () {
      const {quests, firemakingQuest} = await loadFixture(questsFixture);
      await quests.addQuests([firemakingQuest], [defaultMinRequirements]);
      await expect(quests.addQuests([firemakingQuest], [defaultMinRequirements])).to.be.revertedWithCustomError(
        quests,
        "QuestWithIdAlreadyExists"
      );
    });

    it("Should fail to add a quest for non-owner", async function () {
      const {alice, quests, firemakingQuest} = await loadFixture(questsFixture);
      await expect(
        quests.connect(alice).addQuests([firemakingQuest], [defaultMinRequirements])
      ).to.be.revertedWithCustomError(quests, "OwnableUnauthorizedAccount");
    });
  });

  describe("Add quests", function () {
    it("Should add multiple quests correctly", async function () {
      const {quests, firemakingQuest, firemakingQuestLog} = await loadFixture(questsFixture);
      const questsToAdd = [firemakingQuest, firemakingQuestLog];
      await quests.addQuests(questsToAdd, [defaultMinRequirements, defaultMinRequirements]);

      const quest1 = await quests.allFixedQuests(1);
      expect(quest1.rewardItemTokenId1).to.equal(firemakingQuest.rewardItemTokenId1);
      const quest2 = await quests.allFixedQuests(2);
      expect(quest2.rewardItemTokenId1).to.equal(firemakingQuestLog.rewardItemTokenId1);
    });

    it("Should fail to add same quest twice using batch", async function () {
      const {quests, firemakingQuest} = await loadFixture(questsFixture);
      const questsToAdd = [firemakingQuest, firemakingQuest];
      await expect(
        quests.addQuests(questsToAdd, [defaultMinRequirements, defaultMinRequirements])
      ).to.be.revertedWithCustomError(quests, "QuestWithIdAlreadyExists");
    });

    it("Should fail to add multiple quests for non-owner", async function () {
      const {alice, quests, firemakingQuest} = await loadFixture(questsFixture);
      await expect(
        quests.connect(alice).addQuests([firemakingQuest], [defaultMinRequirements])
      ).to.be.revertedWithCustomError(quests, "OwnableUnauthorizedAccount");
    });
  });

  describe("Remove quest", function () {
    it("Should remove a quest correctly", async function () {
      const {quests, firemakingQuest} = await loadFixture(questsFixture);
      await quests.addQuests([firemakingQuest], [defaultMinRequirements]);
      await expect(quests.removeQuest(1)).to.emit(quests, "RemoveQuest").withArgs(1);
      await expect(quests.removeQuest(2)).to.be.revertedWithCustomError(quests, "QuestDoesntExist");
    });

    it("Should fail to remove a quest for non-owner", async function () {
      const {alice, quests, firemakingQuest} = await loadFixture(questsFixture);
      await quests.addQuests([firemakingQuest], [defaultMinRequirements]);
      await expect(quests.connect(alice).removeQuest(1)).to.be.revertedWithCustomError(
        quests,
        "OwnableUnauthorizedAccount"
      );
    });

    it("Should fail to remove a non-existing quest", async function () {
      const {quests} = await loadFixture(questsFixture);
      await expect(quests.removeQuest(2)).to.be.revertedWithCustomError(quests, "QuestDoesntExist");
    });
  });

  describe("Edit quest", function () {
    it("Should edit a quest correctly", async function () {
      const {quests, firemakingQuest} = await loadFixture(questsFixture);
      await quests.addQuests([firemakingQuest], [defaultMinRequirements]);
      const editedQuest = {...firemakingQuest, actionChoiceNum: 23};
      await quests.editQuests([editedQuest], [defaultMinRequirements]);
      const quest = await quests.allFixedQuests(1);
      expect(quest.actionChoiceNum).to.equal(editedQuest.actionChoiceNum);
    });

    it("Should fail to edit a quest for non-owner", async function () {
      const {alice, quests, firemakingQuest} = await loadFixture(questsFixture);
      await quests.addQuests([firemakingQuest], [defaultMinRequirements]);
      await expect(
        quests.connect(alice).editQuests([firemakingQuest], [defaultMinRequirements])
      ).to.be.revertedWithCustomError(quests, "OwnableUnauthorizedAccount");
    });

    it("Should fail to edit a non-existing quest", async function () {
      const {quests, firemakingQuest} = await loadFixture(questsFixture);
      await quests.addQuests([firemakingQuest], [defaultMinRequirements]);
      const editedQuest = {...firemakingQuest, questId: 100, actionChoiceNum: 23};
      await expect(quests.editQuests([editedQuest], [defaultMinRequirements])).to.be.revertedWithCustomError(
        quests,
        "QuestDoesntExist"
      );
    });

    it("Lowering amounts where amount completed is already above should not cause underflows (actionNum1)", async function () {
      const {alice, playerId, quests, players, itemNFT, worldActions} = await loadFixture(playersFixture);
      // Check that this is not marked as completed automatically
      const {queuedAction, rate} = await setupBasicWoodcutting(itemNFT, worldActions);
      const quest: QuestInput = {
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
        isFullModeOnly: false,
        worldLocation: 0
      };

      await quests.addQuests([quest], [defaultMinRequirements]);
      const questId = quest.questId;
      await players.connect(alice).activateQuest(playerId, questId);

      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);
      await ethers.provider.send("evm_increaseTime", [1800]);
      await ethers.provider.send("evm_mine", []);
      await players.connect(alice).processActions(playerId);

      quest.actionNum1 = rate / (GUAR_MUL * 4);
      await quests.editQuests([quest], [defaultMinRequirements]);
      await ethers.provider.send("evm_increaseTime", [1800]); // Finish
      await ethers.provider.send("evm_mine", []);
      const pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
      expect(pendingQueuedActionState.quests.questsCompleted.length).is.eq(1);

      await expect(players.connect(alice).processActions(playerId)).to.not.be.reverted;
    });

    it("TODO - Lowering amounts where amount completed is already above should not cause underflows (actionNum2)", async function () {});
    it("TODO - Lowering amounts where amount completed is already above should not cause underflows (actionChoiceNum1)", async function () {});
    it("TODO - Lowering amounts where amount completed is already above should not cause underflows (burnAmount)", async function () {});
  });

  describe("Brush buying quest", function () {
    it("Quest not activated", async function () {
      const {alice, playerId, quests, players} = await loadFixture(questsFixture);
      const quest = allQuests.find((q) => q.questId === QUEST_PURSE_STRINGS) as QuestInput;
      await quests.addQuests([quest], [defaultMinRequirements]);
      await expect(
        players.connect(alice).buyBrushQuest(alice, playerId, 0, true, {value: 10})
      ).to.be.revertedWithCustomError(quests, "InvalidActiveQuest");
    });

    it("Trying to buy with no FTM", async function () {
      const {alice, playerId, quests, players} = await loadFixture(questsFixture);
      const quest = allQuests.find((q) => q.questId === QUEST_PURSE_STRINGS) as QuestInput;
      await quests.addQuests([quest], [defaultMinRequirements]);
      const questId = quest.questId;
      await players.connect(alice).activateQuest(playerId, questId);
      await expect(
        players.connect(alice).buyBrushQuest(alice, playerId, 0, true, {value: 0})
      ).to.be.revertedWithCustomError(quests, "InvalidFTMAmount");
    });

    it("Quest completed", async function () {
      const {alice, playerId, quests, players, brush} = await loadFixture(questsFixture);
      const quest = allQuests.find((q) => q.questId === QUEST_PURSE_STRINGS) as QuestInput;
      await quests.addQuests([quest], [defaultMinRequirements]);
      const questId = quest.questId;
      expect(questId).to.not.eq(0);
      await players.connect(alice).activateQuest(playerId, questId);
      expect((await quests.activeQuests(playerId)).questId).to.be.eq(questId);
      const balanceBefore = await brush.balanceOf(alice);
      await players.connect(alice).buyBrushQuest(alice, playerId, 0, true, {value: 10});
      const balanceAfter = await brush.balanceOf(alice);
      expect(balanceBefore + 1n).to.eq(balanceAfter);

      // Check it's completed and no longer considered active
      expect(await quests.isQuestCompleted(playerId, questId)).to.be.true;
      expect((await quests.activeQuests(playerId)).questId).to.be.eq(0);

      // Check the rewards are as expected
      expect(quest.rewardItemTokenId1).to.eq(0);
      expect(quest.skillXPGained).to.not.eq(0);
      expect(await players.getPlayerXP(playerId, quest.skillReward)).to.eq(quest.skillXPGained);
    });

    it("Check that quest is not completed after an action", async function () {
      const {alice, playerId, quests, players, itemNFT, worldActions} = await loadFixture(playersFixture);
      const quest = allQuests.find((q) => q.questId === QUEST_PURSE_STRINGS) as QuestInput;
      await quests.addQuests([quest], [defaultMinRequirements]);
      const questId = quest.questId;
      await players.connect(alice).activateQuest(playerId, questId);
      // Check that this is not marked as completed automatically
      const {queuedAction} = await setupBasicWoodcutting(itemNFT, worldActions);
      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);
      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan + 2]);
      await ethers.provider.send("evm_mine", []);
      const pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
      expect(pendingQueuedActionState.quests.questsCompleted.length).is.eq(0);
    });
  });

  describe("Buying and selling brush", function () {
    it("Buying brush, use exact eth", async function () {
      const {alice, quests, brush} = await loadFixture(questsFixture);
      const quest = allQuests.find((q) => q.questId === QUEST_PURSE_STRINGS) as QuestInput;
      await quests.addQuests([quest], [defaultMinRequirements]);
      const questId = quest.questId;
      expect(questId).to.not.eq(0);
      const balanceBefore = await brush.balanceOf(alice);
      await quests.connect(alice).buyBrush(alice, 0, true, {value: 10});
      const balanceAfter = await brush.balanceOf(alice);
      expect(balanceBefore + 1n).to.eq(balanceAfter);
    });

    it("Buying brush, use exact brush output", async function () {
      const {alice, quests, brush} = await loadFixture(questsFixture);
      const quest = allQuests.find((q) => q.questId === QUEST_PURSE_STRINGS) as QuestInput;
      await quests.addQuests([quest], [defaultMinRequirements]);
      const questId = quest.questId;
      expect(questId).to.not.eq(0);
      const balanceBefore = await brush.balanceOf(alice);
      const brushOutput = 1;
      await quests.connect(alice).buyBrush(alice, brushOutput, false, {value: 10});
      const balanceAfter = await brush.balanceOf(alice);
      expect(balanceBefore + 1n).to.eq(balanceAfter);
    });

    it("Selling brush, use exact brush", async function () {
      const {alice, quests, brush} = await loadFixture(questsFixture);
      const quest = allQuests.find((q) => q.questId === QUEST_PURSE_STRINGS) as QuestInput;
      await quests.addQuests([quest], [defaultMinRequirements]);
      const questId = quest.questId;
      expect(questId).to.not.eq(0);
      const balanceBefore = await brush.balanceOf(alice);
      await quests.connect(alice).buyBrush(alice, 0, true, {value: 10});
      const balanceAfter = await brush.balanceOf(alice);
      await brush.connect(alice).approve(quests, balanceAfter);
      expect(balanceBefore + 1n).to.eq(balanceAfter);
      await quests.connect(alice).sellBrush(alice, balanceAfter, 0, false);
      const balanceAfterSell = await brush.balanceOf(alice);
      expect(balanceAfterSell).to.eq(0);
    });

    it("Selling brush, use exact ETH output", async function () {
      const {alice, quests, brush} = await loadFixture(questsFixture);
      const quest = allQuests.find((q) => q.questId === QUEST_PURSE_STRINGS) as QuestInput;
      await quests.addQuests([quest], [defaultMinRequirements]);
      const questId = quest.questId;
      expect(questId).to.not.eq(0);
      const balanceBefore = await brush.balanceOf(alice);
      await quests.connect(alice).buyBrush(alice, 0, true, {value: 10});
      const balanceAfter = await brush.balanceOf(alice);
      await brush.connect(alice).approve(quests, balanceAfter);
      expect(balanceBefore + 1n).to.eq(balanceAfter);
      const ethOutput = 1;
      await quests.connect(alice).sellBrush(alice, balanceAfter, ethOutput, true);
      const balanceAfterSell = await brush.balanceOf(alice);
      expect(balanceAfterSell).to.eq(0);
    });
  });

  describe("Minimum requirements", function () {
    it("1 minimum requirement", async function () {
      const {alice, playerId, quests, players} = await loadFixture(questsFixture);
      const quest = allQuests.find((q) => q.questId === QUEST_PURSE_STRINGS) as QuestInput;
      await quests.addQuests(
        [quest],
        [
          [
            {skill: Skill.HEALTH, xp: 3000},
            {skill: Skill.NONE, xp: 0},
            {skill: Skill.NONE, xp: 0}
          ]
        ]
      );
      const questId = quest.questId;
      await expect(players.connect(alice).activateQuest(playerId, questId)).to.be.revertedWithCustomError(
        quests,
        "InvalidMinimumRequirement"
      );

      await players.connect(alice).modifyXP(alice, playerId, Skill.HEALTH, 2999, SKIP_XP_THRESHOLD_EFFECTS);
      await expect(players.connect(alice).activateQuest(playerId, questId)).to.be.revertedWithCustomError(
        quests,
        "InvalidMinimumRequirement"
      );
      await players.connect(alice).modifyXP(alice, playerId, Skill.HEALTH, 3000, SKIP_XP_THRESHOLD_EFFECTS);
      await players.connect(alice).activateQuest(playerId, questId);
    });
  });

  it("Cooked food giving away quest", async function () {
    const {playerId, players, itemNFT, worldActions, alice, quests} = await loadFixture(playersFixture);

    const successPercent = 100;
    const minLevel = 1;
    const {queuedAction, rate, choiceId} = await setupBasicCooking(itemNFT, worldActions, successPercent, minLevel);

    await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);

    // Activate a quest
    const quest1 = allQuests.find((q) => q.questId === QUEST_ALMS_POOR) as QuestInput;
    const quest = {
      ...quest1,
      actionChoiceId: choiceId,
      actionChoiceNum: 5,
      burnItemTokenId: COOKED_MINNUS,
      burnAmount: 5
    };
    await quests.addQuests([quest], [defaultMinRequirements]);
    const questId = quest.questId;
    await players.connect(alice).activateQuest(playerId, questId);
    await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]);
    await ethers.provider.send("evm_mine", []);
    await players.connect(alice).processActions(playerId);

    // Check it's completed
    expect(await quests.isQuestCompleted(playerId, questId)).to.be.true;
    expect(await itemNFT.balanceOf(alice, EstforConstants.COOKED_MINNUS)).to.eq(
      Math.floor((queuedAction.timespan * rate) / (3600 * RATE_MUL) - quest.actionChoiceNum)
    );
    expect(await itemNFT.balanceOf(alice, EstforConstants.RAW_MINNUS)).to.eq(
      1000 - Math.floor((queuedAction.timespan * rate) / (3600 * RATE_MUL))
    );
  });

  it("Cooked food giving away quest, check burn can happen before quest completed", async function () {
    const {playerId, players, itemNFT, worldActions, alice, quests} = await loadFixture(playersFixture);

    const successPercent = 100;
    const minLevel = 1;
    const {queuedAction, rate, choiceId} = await setupBasicCooking(itemNFT, worldActions, successPercent, minLevel);
    await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);

    // Activate a quest
    const quest1 = allQuests.find((q) => q.questId === QUEST_ALMS_POOR) as QuestInput;
    const quest = {
      ...quest1,
      actionChoiceId: choiceId,
      actionChoiceNum: 5,
      burnItemTokenId: COOKED_MINNUS,
      burnAmount: 5
    };
    await quests.addQuests([quest], [defaultMinRequirements]);
    const questId = quest.questId;
    await players.connect(alice).activateQuest(playerId, questId);
    // Process immediately
    const initialMintNum = 10;
    await itemNFT.connect(alice).mintBatch(alice, [COOKED_MINNUS], [initialMintNum]);
    let pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
    expect(pendingQueuedActionState.quests.rewardItemTokenIds.length).to.eq(0);
    expect(pendingQueuedActionState.quests.consumedItemTokenIds.length).to.eq(0);
    await players.connect(alice).processActions(playerId);

    // Should not be completed, but the cooked items can be burned
    expect(await quests.isQuestCompleted(playerId, questId)).to.be.false;

    expect(await itemNFT.balanceOf(alice, EstforConstants.COOKED_MINNUS)).to.eq(10);
    expect(await itemNFT.balanceOf(alice, EstforConstants.RAW_MINNUS)).to.eq(1000);

    // rate is 100 an hour. So 1 would be done in 36 seconds
    await ethers.provider.send("evm_increaseTime", [36]);
    await ethers.provider.send("evm_mine", []);
    pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
    expect(pendingQueuedActionState.quests.rewardItemTokenIds.length).to.eq(0);
    expect(pendingQueuedActionState.quests.consumedItemTokenIds.length).to.eq(1);
    expect(pendingQueuedActionState.quests.consumedItemTokenIds[0]).to.eq(COOKED_MINNUS);
    expect(pendingQueuedActionState.quests.consumedAmounts[0]).to.eq(1);
    // Finish it
    await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]);
    await ethers.provider.send("evm_mine", []);
    pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
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
    expect(await itemNFT.balanceOf(alice, EstforConstants.COOKED_MINNUS)).to.eq(
      Math.floor((queuedAction.timespan * rate) / (3600 * RATE_MUL) - quest.actionChoiceNum) + initialMintNum
    );
    expect(await itemNFT.balanceOf(alice, EstforConstants.RAW_MINNUS)).to.eq(
      1000 - Math.floor((queuedAction.timespan * rate) / (3600 * RATE_MUL))
    );
  });

  it("Cooked food giving away quest, check combat consuming the cooked food, before quest completed", async function () {
    const {playerId, players, itemNFT, worldActions, alice, quests} = await loadFixture(playersFixture);

    const successPercent = 100;
    const minLevel = 1;
    const {queuedAction: queuedActionCooking, choiceId} = await setupBasicCooking(
      itemNFT,
      worldActions,
      successPercent,
      minLevel
    );
    let queuedAction = {...queuedActionCooking, timespan: 100};

    const monsterCombatStats: EstforTypes.CombatStats = {
      meleeAttack: 100,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangedDefence: 0,
      health: 1000
    };

    const numSpawned = 100 * SPAWN_MUL;
    let tx = await worldActions.addActions([
      {
        actionId: 2,
        info: {
          skill: EstforTypes.Skill.COMBAT,
          xpPerHour: 3600,
          minXP: 0,
          worldLocation: 0,
          isFullModeOnly: false,
          numSpawned,
          handItemTokenIdRangeMin: EstforConstants.COMBAT_BASE,
          handItemTokenIdRangeMax: EstforConstants.COMBAT_MAX,
          isAvailable: true,
          questPrerequisiteId: 0,
          actionChoiceRequired: true,
          successPercent: 100
        },
        guaranteedRewards: [],
        randomRewards: [],
        combatStats: monsterCombatStats
      }
    ]);
    const actionId = await getActionId(tx, worldActions);

    tx = await worldActions.addActionChoices(
      EstforConstants.NONE,
      [2],
      [
        {
          ...defaultActionChoice,
          skill: EstforTypes.Skill.MELEE
        }
      ]
    );
    const timespan = 3600;
    const queuedActionMelee: EstforTypes.QueuedActionInput = {
      attire: EstforTypes.noAttire,
      actionId,
      combatStyle: EstforTypes.CombatStyle.ATTACK,
      choiceId: await getActionChoiceId(tx, worldActions),
      regenerateId: EstforConstants.COOKED_MINNUS,
      timespan,
      rightHandEquipmentTokenId: EstforConstants.NONE,
      leftHandEquipmentTokenId: EstforConstants.NONE,
      petId: EstforConstants.NONE
    };

    await players
      .connect(alice)
      .startActions(playerId, [queuedAction, queuedActionMelee], EstforTypes.ActionQueueStrategy.OVERWRITE);

    // Activate a quest
    const quest1 = allQuests.find((q) => q.questId === QUEST_ALMS_POOR) as QuestInput;
    const quest = {
      ...quest1,
      actionChoiceId: choiceId,
      actionChoiceNum: 5,
      burnItemTokenId: COOKED_MINNUS,
      burnAmount: 5
    };
    await quests.addQuests([quest], [defaultMinRequirements]);
    const questId = quest.questId;
    await players.connect(alice).activateQuest(playerId, questId);

    // rate is 100 an hour. So 1 would be done in 36 seconds
    await ethers.provider.send("evm_increaseTime", [queuedAction.timespan + queuedActionMelee.timespan]);
    await ethers.provider.send("evm_mine", []);
    let pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
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
    await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);
    await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]);
    await ethers.provider.send("evm_mine", []);
    await players.connect(alice).processActions(playerId);
    expect(await quests.isQuestCompleted(playerId, questId)).to.be.true;
  });

  it("Thieving quest", async function () {
    const {players, playerId, alice, quests, worldActions, itemNFT} = await loadFixture(questsFixture);

    const xpPerHour = 2;
    let tx = await worldActions.addActions([
      {
        actionId: 2,
        info: {
          skill: EstforTypes.Skill.THIEVING,
          xpPerHour,
          minXP: 0,
          worldLocation: 0,
          isFullModeOnly: false,
          numSpawned: 0,
          handItemTokenIdRangeMin: EstforConstants.NONE,
          handItemTokenIdRangeMax: EstforConstants.NONE,
          isAvailable: true,
          questPrerequisiteId: 0,
          actionChoiceRequired: false,
          successPercent: 100
        },
        guaranteedRewards: [],
        randomRewards: [],
        combatStats: EstforTypes.emptyCombatStats
      }
    ]);

    const actionId = await getActionId(tx, worldActions);
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
      petId: EstforConstants.NONE
    };

    // Activate a quest
    const quest1 = allQuests.find((q) => q.questId === QUEST_HIDDEN_BOUNTY) as QuestInput;
    const quest = {
      ...quest1,
      actionId1: actionId
    };
    await quests.addQuests([quest], [defaultMinRequirements]);
    const questId = quest.questId;
    await players.connect(alice).activateQuest(playerId, questId);

    await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);
    await ethers.provider.send("evm_increaseTime", [(quest1.actionNum1 / 2) * 3600]);
    await ethers.provider.send("evm_mine", []);
    let pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
    expect(pendingQueuedActionState.quests.rewardItemTokenIds.length).to.eq(0);
    expect(pendingQueuedActionState.quests.activeQuestInfo.length).to.eq(1);
    expect(pendingQueuedActionState.quests.activeQuestInfo[0].actionCompletedNum1).to.eq(quest1.actionNum1 / 2);
    await players.connect(alice).processActions(playerId);
    await ethers.provider.send("evm_increaseTime", [(quest1.actionNum1 / 2) * 3600]);
    await ethers.provider.send("evm_mine", []);
    pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
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
    expect(await itemNFT.balanceOf(alice, EstforConstants.RUBY)).to.eq(1);
    expect(await itemNFT.balanceOf(alice, EstforConstants.EMERALD)).to.eq(1);
  });

  it("Monsters killed", async function () {
    const {players, playerId, alice, quests, worldActions, itemNFT} = await loadFixture(playersFixture);
    const {queuedAction, rate, numSpawned} = await setupBasicMeleeCombat(itemNFT, worldActions);

    // Activate a quest
    const quest1 = allQuests.find((q) => q.questId === QUEST_SUPPLY_RUN) as QuestInput;
    const quest = {
      ...quest1,
      actionId1: queuedAction.actionId,
      actionNum1: 5,
      burnItemTokenId: EstforConstants.BRONZE_ARROW,
      burnAmount: 5
    };
    await quests.addQuests([quest], [defaultMinRequirements]);
    const questId = quest.questId;
    await players.connect(alice).activateQuest(playerId, questId);

    await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);

    // Kill 1
    const time = (3600 * SPAWN_MUL) / numSpawned;
    await ethers.provider.send("evm_increaseTime", [time]);
    await ethers.provider.send("evm_mine", []);
    let pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
    expect(pendingQueuedActionState.quests.rewardItemTokenIds.length).to.eq(0);
    expect(pendingQueuedActionState.quests.consumedItemTokenIds.length).to.eq(1); // Burn 1 of them
    expect(pendingQueuedActionState.quests.consumedItemTokenIds[0]).to.eq(EstforConstants.BRONZE_ARROW);
    expect(pendingQueuedActionState.quests.consumedAmounts[0]).to.eq(1);
    expect(pendingQueuedActionState.quests.activeQuestInfo.length).to.eq(1);
    expect(pendingQueuedActionState.quests.activeQuestInfo[0].actionCompletedNum1).to.eq(1);

    await players.connect(alice).processActions(playerId);
    expect(await itemNFT.balanceOf(alice, EstforConstants.BRONZE_ARROW)).to.eq(0); // All are burned

    // Kill the rest
    await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]);
    await ethers.provider.send("evm_mine", []);
    pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
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
    expect(await itemNFT.balanceOf(alice, EstforConstants.BRONZE_ARROW)).to.eq(
      (rate * numSpawned) / (10 * SPAWN_MUL) - 5
    );
  });

  it("Fishing quest where fish get burnt and there is (cooking in-between)", async function () {
    const {players, playerId, alice, quests, worldActions, itemNFT} = await loadFixture(playersFixture);

    const {queuedAction: queuedActionFishing, rate} = await setupBasicFishing(itemNFT, worldActions);
    const successPercent = 100;
    const minLevel = 1;
    const {queuedAction: queuedActionCooking} = await setupBasicCooking(
      itemNFT,
      worldActions,
      successPercent,
      minLevel
    );

    const quest1 = allQuests.find((q) => q.questId === QUEST_TOWN_COOKOUT) as QuestInput;
    const quest = {
      ...quest1,
      actionId1: queuedActionFishing.actionId,
      actionNum1: (rate * 2) / GUAR_MUL,
      burnItemTokenId: EstforConstants.RAW_MINNUS,
      burnAmount: (rate * 2) / GUAR_MUL
    };

    await quests.addQuests([quest], [defaultMinRequirements]);
    const questId = quest.questId;
    await players.connect(alice).activateQuest(playerId, questId);

    await itemNFT
      .connect(alice)
      .burn(alice, EstforConstants.RAW_MINNUS, await itemNFT.balanceOf(alice, EstforConstants.RAW_MINNUS));

    await players
      .connect(alice)
      .startActions(
        playerId,
        [queuedActionFishing, queuedActionCooking, queuedActionFishing],
        EstforTypes.ActionQueueStrategy.OVERWRITE
      );
    await ethers.provider.send("evm_increaseTime", [24 * 3600]);
    await ethers.provider.send("evm_mine", []);
    await players.connect(alice).processActions(playerId);

    // Check quest progress
    const activeQuest = await quests.activeQuests(playerId);
    expect(activeQuest.actionCompletedNum1).to.eq(rate / GUAR_MUL);
    expect(activeQuest.burnCompletedAmount).to.eq(rate / GUAR_MUL);
  });

  it("ActionChoice which burns", async function () {
    // TODO same as "Fishing quest where fish get burnt" above but using actionChoices
    // Smith bar
    // Use bar to smith something else
    // Smith bar
  });

  it("Dependent quest", async function () {
    const {players, playerId, alice, quests, worldActions, itemNFT} = await loadFixture(playersFixture);
    const {queuedAction} = await setupBasicMeleeCombat(itemNFT, worldActions);

    // Activate a quest
    const quest1 = allQuests.find((q) => q.questId === QUEST_SUPPLY_RUN) as QuestInput;
    const quest = {
      ...quest1,
      actionId1: queuedAction.actionId,
      actionNum1: 5,
      burnItemTokenId: EstforConstants.BRONZE_ARROW,
      burnAmount: 5
    };

    const anotherQuest = {...quest, questId: QUEST_TWO_BIRDS, dependentQuestId: QUEST_SUPPLY_RUN};
    await quests.addQuests([quest, anotherQuest], [defaultMinRequirements, defaultMinRequirements]);

    const anotherQuestId = anotherQuest.questId;
    await expect(players.connect(alice).activateQuest(playerId, anotherQuestId))
      .to.be.revertedWithCustomError(quests, "DependentQuestNotCompleted")
      .withArgs(QUEST_SUPPLY_RUN);

    // Complete it
    const questId = quest.questId;
    await players.connect(alice).activateQuest(playerId, questId);

    await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);
    await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]);
    await ethers.provider.send("evm_mine", []);
    await players.connect(alice).processActions(playerId);

    await expect(players.connect(alice).activateQuest(playerId, anotherQuestId)).to.not.be.reverted;
  });

  it("ActionChoice quest", async function () {
    const {players, playerId, alice, quests, firemakingQuest, queuedAction, rate, itemNFT} = await loadFixture(
      questsFixture
    );

    await quests.addQuests([firemakingQuest], [defaultMinRequirements]);
    const questId = 1;
    await players.connect(alice).activateQuest(playerId, questId);

    await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);
    await ethers.provider.send("evm_increaseTime", [1]);
    await ethers.provider.send("evm_mine", []);

    let pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
    expect(pendingQueuedActionState.quests.rewardItemTokenIds.length).to.eq(0);

    const timeNeeded = ((rate / RATE_MUL) * 3600) / firemakingQuest.actionChoiceNum;

    // Set time to just before, should still not have quest rewards
    await ethers.provider.send("evm_increaseTime", [timeNeeded - 3]);
    await ethers.provider.send("evm_mine", []);
    pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
    expect(pendingQueuedActionState.quests.rewardItemTokenIds.length).to.eq(0);
    // Amount burnt should be over
    await ethers.provider.send("evm_increaseTime", [3]);
    await ethers.provider.send("evm_mine", []);
    pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
    expect(pendingQueuedActionState.quests.rewardItemTokenIds.length).to.eq(1);
    expect(pendingQueuedActionState.quests.rewardAmounts[0]).to.eq(firemakingQuest.rewardAmount1);
    expect(pendingQueuedActionState.quests.rewardItemTokenIds[0]).to.eq(firemakingQuest.rewardItemTokenId1);
    expect(pendingQueuedActionState.xpRewardItemTokenIds.length).to.eq(0); // Move this to another test
    expect(pendingQueuedActionState.xpRewardAmounts.length).to.eq(0); // Move this to another test

    await players.connect(alice).processActions(playerId);

    expect(await itemNFT.balanceOf(alice, firemakingQuest.rewardItemTokenId1)).to.eq(firemakingQuest.rewardAmount1);
    expect(firemakingQuest.rewardAmount1).to.be.gt(0); // sanity check
  });

  it("XP gained", async function () {
    const {playerId, players, itemNFT, worldActions, alice, quests} = await loadFixture(playersFixture);

    const successPercent = 100;
    const minLevel = 1;
    const {queuedAction, choiceId} = await setupBasicCooking(itemNFT, worldActions, successPercent, minLevel);

    await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);

    // Activate a quest
    const quest1 = allQuests.find((q) => q.questId === QUEST_ALMS_POOR) as QuestInput;
    const quest = {
      ...quest1,
      actionChoiceId: choiceId,
      actionChoiceNum: 5,
      burnItemTokenId: COOKED_MINNUS,
      burnAmount: 5,
      skillReward: Skill.WOODCUTTING,
      skillXPGained: 10000
    };
    await quests.addQuests([quest], [defaultMinRequirements]);
    const questId = quest.questId;
    await players.connect(alice).activateQuest(playerId, questId);
    await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]);
    await ethers.provider.send("evm_mine", []);

    // Check XP threshold rewards are given
    const rewards: EstforTypes.Equipment[] = [{itemTokenId: EstforConstants.BRONZE_BAR, amount: 3}];
    await players.addXPThresholdRewards([{xpThreshold: 10000, rewards}]);

    await players.connect(alice).processActions(playerId);
    const cookingXP = await players.getPlayerXP(playerId, Skill.COOKING);
    expect(await players.getPlayerXP(playerId, Skill.WOODCUTTING)).to.eq(10000);
    expect((await (await getPlayersHelper(players)).getPlayer(playerId)).totalXP).to.eq(START_XP + cookingXP + 10000n);
    expect(await itemNFT.balanceOf(alice, EstforConstants.BRONZE_BAR)).to.eq(3);
  });

  describe("Activate a quest", function () {
    it("Should activate a quest for player correctly", async function () {
      const {alice, playerId, quests, firemakingQuestLog, players} = await loadFixture(questsFixture);
      await quests.addQuests([firemakingQuestLog], [defaultMinRequirements]);
      const questId = 2;
      await players.connect(alice).activateQuest(playerId, questId);
      const activeQuest = await quests.activeQuests(playerId);
      expect(activeQuest.questId).to.equal(questId);
    });

    it("Should fail to activate a quest for non-owner of player", async function () {
      const {players, playerId, quests, firemakingQuestLog} = await loadFixture(questsFixture);
      await quests.addQuests([firemakingQuestLog], [defaultMinRequirements]);
      const questId = 2;
      await expect(players.activateQuest(playerId, questId)).to.be.revertedWithCustomError(
        players,
        "NotOwnerOfPlayerAndActive"
      );
    });

    it("Should fail to activate a non-existing quest", async function () {
      const {alice, players, playerId, quests, firemakingQuestLog} = await loadFixture(questsFixture);
      await quests.addQuests([firemakingQuestLog], [defaultMinRequirements]);
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

      await quests.addQuests([firemakingQuest], [defaultMinRequirements]);
      const questId = firemakingQuest.questId;
      await players.connect(alice).activateQuest(playerId, questId);

      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);
      const timeNeeded = ((rate / 10) * 3600) / firemakingQuest.actionChoiceNum;

      await ethers.provider.send("evm_increaseTime", [timeNeeded]);
      await ethers.provider.send("evm_mine", []);
      await players.connect(alice).processActions(playerId);

      expect(await itemNFT.balanceOf(alice, firemakingQuest.rewardItemTokenId1)).to.eq(firemakingQuest.rewardAmount1);

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

      await quests.addQuests([firemakingQuest], [defaultMinRequirements]);
      const questId = firemakingQuest.questId;
      await players.connect(alice).activateQuest(playerId, questId);

      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);
      const timeNeeded = ((rate / RATE_MUL) * 3600) / firemakingQuest.actionChoiceNum;

      // Set time to just before, should still not have quest rewards
      await ethers.provider.send("evm_increaseTime", [timeNeeded - 10]);
      await ethers.provider.send("evm_mine", []);
      // Deactivate it, should auto process
      await players.connect(alice).deactivateQuest(playerId);

      expect(await itemNFT.balanceOf(alice, EstforConstants.LOG)).to.eq(
        5000 - Math.floor((rate * 3600) / ((timeNeeded - 10) * RATE_MUL)) + 1
      );

      expect(await itemNFT.balanceOf(alice, firemakingQuest.rewardItemTokenId1)).to.eq(0);

      // Check it's not completed
      expect(await quests.isQuestCompleted(playerId, questId)).to.be.false;
      expect((await quests.activeQuests(playerId)).questId).to.eq(0);

      // Re-activate it
      await players.connect(alice).activateQuest(playerId, questId);
      await ethers.provider.send("evm_increaseTime", [10]);
      await ethers.provider.send("evm_mine", []);
      await players.connect(alice).processActions(playerId);
      expect(await itemNFT.balanceOf(alice, EstforConstants.LOG)).to.eq(
        5000 - Math.floor((rate * 3600) / (timeNeeded * RATE_MUL))
      );

      expect(await quests.isQuestCompleted(playerId, questId)).to.be.true;
      expect(await itemNFT.balanceOf(alice, firemakingQuest.rewardItemTokenId1)).to.eq(firemakingQuest.rewardAmount1);
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
        itemNFT
      } = await loadFixture(questsFixture);

      const queuedAction = {...queuedActionFiremaking, timespan: 3636};

      await quests.addQuests([firemakingQuest, firemakingQuestLog], [defaultMinRequirements, defaultMinRequirements]);
      const questId = firemakingQuest.questId;
      await players.connect(alice).activateQuest(playerId, questId);

      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);
      const timeNeeded = ((rate / RATE_MUL) * 3600) / firemakingQuest.actionChoiceNum;

      // Set time to just before, should still not have quest rewards
      await ethers.provider.send("evm_increaseTime", [timeNeeded - 10]);
      await ethers.provider.send("evm_mine", []);
      // Activate another quest should auto process current quest
      const anotherQuestId = firemakingQuestLog.questId;
      await players.connect(alice).activateQuest(playerId, anotherQuestId);
      expect(await itemNFT.balanceOf(alice, EstforConstants.LOG)).to.eq(
        5000 - Math.floor((rate * 3600) / ((timeNeeded - 10) * RATE_MUL)) + 1
      );

      expect(await itemNFT.balanceOf(alice, firemakingQuest.rewardItemTokenId1)).to.eq(0);

      // Check it's not completed
      expect(await quests.isQuestCompleted(playerId, questId)).to.be.false;
      expect((await quests.activeQuests(playerId)).questId).to.eq(anotherQuestId);

      await ethers.provider.send("evm_increaseTime", [10]);
      await ethers.provider.send("evm_mine", []);
      // Activate the other quest and finish it
      await players.connect(alice).activateQuest(playerId, questId);
      expect(await itemNFT.balanceOf(alice, EstforConstants.LOG)).to.eq(
        5000 - Math.floor((rate * 3600) / ((timeNeeded - 10) * RATE_MUL))
      );
      expect(await quests.isQuestCompleted(playerId, questId)).to.be.false;
      await ethers.provider.send("evm_increaseTime", [36]);
      await ethers.provider.send("evm_mine", []);
      await players.connect(alice).processActions(playerId);
      expect(await itemNFT.balanceOf(alice, EstforConstants.LOG)).to.eq(
        5000 - Math.floor((rate * 3600) / (timeNeeded * RATE_MUL)) - 1
      );

      expect(await quests.isQuestCompleted(playerId, questId)).to.be.true;
      expect(await itemNFT.balanceOf(alice, firemakingQuest.rewardItemTokenId1)).to.eq(firemakingQuest.rewardAmount1);
      expect((await quests.activeQuests(playerId)).questId).to.eq(0);
    });

    it("Activate quest through startActionsAdvanced", async function () {
      const {players, playerId, alice, quests, firemakingQuest, queuedAction} = await loadFixture(questsFixture);

      await quests.addQuests([firemakingQuest], [defaultMinRequirements]);
      const questId = firemakingQuest.questId;
      expect((await quests.activeQuests(playerId)).questId).to.eq(0);
      await players
        .connect(alice)
        .startActionsAdvanced(
          playerId,
          [queuedAction],
          EstforConstants.NONE,
          0,
          questId,
          NO_DONATION_AMOUNT,
          EstforTypes.ActionQueueStrategy.OVERWRITE
        );
      expect((await quests.activeQuests(playerId)).questId).to.eq(questId);
    });

    it("Can only start a full mode quest if hero is evolved", async function () {
      const {
        playerId,
        players,
        playerNFT,
        itemNFT,
        worldActions,
        alice,
        quests,
        brush,
        origName,
        upgradePlayerBrushPrice
      } = await loadFixture(playersFixture);

      const {queuedAction, choiceId} = await setupBasicFletching(itemNFT, worldActions);

      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);
      await itemNFT.mintBatch(
        alice,
        [EstforConstants.BRONZE_ARROW_HEAD, EstforConstants.ARROW_SHAFT, EstforConstants.FEATHER],
        [1000, 1000, 1000]
      );

      // Activate a quest
      const quest1 = allQuests.find((q) => q.questId === EstforConstants.QUEST_SO_FLETCH) as QuestInput;
      const quest: QuestInput = {
        ...quest1,
        actionChoiceId: choiceId,
        actionChoiceNum: 1,
        skillReward: Skill.ALCHEMY
      };
      await quests.addQuests([quest], [defaultMinRequirements]);
      const questId = quest.questId;

      await expect(players.connect(alice).activateQuest(playerId, questId)).to.be.revertedWithCustomError(
        quests,
        "CannotStartFullModeQuest"
      );

      const discord = "";
      const twitter = "";
      const telegram = "";

      await brush.connect(alice).approve(playerNFT, upgradePlayerBrushPrice);
      await brush.mint(alice, upgradePlayerBrushPrice);

      await playerNFT.connect(alice).editPlayer(playerId, origName, discord, twitter, telegram, true);
      await players.connect(alice).activateQuest(playerId, questId);

      // Complete the quest
      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]);
      await ethers.provider.send("evm_mine", []);
      await players.connect(alice).processActions(playerId);
      expect(await players.getPlayerXP(playerId, quest.skillReward)).to.eq(quest.skillXPGained);
    });
  });
});
