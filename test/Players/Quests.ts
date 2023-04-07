import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {EstforTypes} from "@paintswap/estfor-definitions";
import {expect} from "chai";
import {ethers} from "hardhat";
import {defaultMinRequirements} from "../../scripts/data/quests";
import {questsFixture} from "../Quests";

describe("Player quests", function () {
  it("ActionChoice quest", async function () {
    // This test was added to check for a bug where the timespan was > 65535 but cast to uint16
    const {players, playerId, alice, quests, firemakingQuest, queuedAction, rate, itemNFT} = await loadFixture(
      questsFixture
    );

    await quests.addQuest(firemakingQuest, false, defaultMinRequirements);
    const questId = 1;
    await players.connect(alice).activateQuest(playerId, questId);

    await players.connect(alice).startAction(playerId, queuedAction, EstforTypes.ActionQueueStatus.NONE);
    await ethers.provider.send("evm_increaseTime", [1]);
    await ethers.provider.send("evm_mine", []);

    let pendingQueuedActionState = await players.pendingQueuedActionState(alice.address, playerId);
    expect(pendingQueuedActionState.questRewards.length).to.eq(0);

    const timeNeeded = ((rate / 10) * 3600) / firemakingQuest.actionChoiceNum;

    // Set time to just before, should still not have quest rewards
    await ethers.provider.send("evm_increaseTime", [timeNeeded - 3]);
    await ethers.provider.send("evm_mine", []);
    pendingQueuedActionState = await players.pendingQueuedActionState(alice.address, playerId);
    expect(pendingQueuedActionState.questRewards.length).to.eq(0);
    // Amount burnt should be over
    await ethers.provider.send("evm_increaseTime", [3]);
    await ethers.provider.send("evm_mine", []);
    pendingQueuedActionState = await players.pendingQueuedActionState(alice.address, playerId);
    expect(pendingQueuedActionState.questRewards.length).to.eq(1);
    expect(pendingQueuedActionState.questRewards[0].amount).to.eq(firemakingQuest.rewardAmount);
    expect(pendingQueuedActionState.questRewards[0].itemTokenId).to.eq(firemakingQuest.rewardItemTokenId);
    expect(pendingQueuedActionState.producedXPRewards.length).to.eq(0); // Move this to another test

    await players.connect(alice).processActions(playerId);

    expect(await itemNFT.balanceOf(alice.address, firemakingQuest.rewardItemTokenId)).to.eq(
      firemakingQuest.rewardAmount
    );
    expect(firemakingQuest.rewardAmount).to.be.gt(0); // sanity check
  });

  describe("Activate a quest", function () {
    it("Should activate a quest for player correctly", async function () {
      const {alice, playerId, quests, firemakingQuestLog, players} = await loadFixture(questsFixture);
      await quests.addQuest(firemakingQuestLog, false, defaultMinRequirements);
      const questId = 2;
      await players.connect(alice).activateQuest(playerId, questId);
      const activeQuest = await quests.activeQuests(playerId);
      expect(activeQuest.quest.questId).to.equal(questId);
    });

    it("Should fail to activate a quest for non-owner of player", async function () {
      const {players, playerId, quests, firemakingQuestLog} = await loadFixture(questsFixture);
      await quests.addQuest(firemakingQuestLog, false, defaultMinRequirements);
      const questId = 2;
      await expect(players.activateQuest(playerId, questId)).to.be.revertedWithCustomError(players, "NotOwnerOfPlayer");
    });

    it("Should fail to activate a non-existing quest", async function () {
      const {alice, players, playerId, quests, firemakingQuestLog} = await loadFixture(questsFixture);
      await quests.addQuest(firemakingQuestLog, false, defaultMinRequirements);
      const questId = 3;
      await expect(players.connect(alice).activateQuest(playerId, questId)).to.be.revertedWithCustomError(
        quests,
        "QuestDoesntExist"
      );
    });
  });
});
