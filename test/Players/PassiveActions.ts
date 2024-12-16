import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {EstforConstants, EstforTypes} from "@paintswap/estfor-definitions";
import {playersFixture} from "./PlayersFixture";
import {
  Skill,
  PassiveActionInput,
  defaultPassiveActionInput as _defaultPassiveActionInput
} from "@paintswap/estfor-definitions/types";
import {ethers} from "hardhat";
import {expect} from "chai";
import {requestAndFulfillRandomWords, requestAndFulfillRandomWordsSeeded, timeTravel24Hours} from "../utils";
import {BRONZE_ARROW, IRON_ARROW} from "@paintswap/estfor-definitions/constants";
import {getXPFromLevel} from "./utils";
import {SKIP_XP_THRESHOLD_EFFECTS} from "../../scripts/utils";

describe("Passive actions", function () {
  const defaultPassiveActionInput: PassiveActionInput = {
    ..._defaultPassiveActionInput,
    actionId: 1,
    info: {
      ..._defaultPassiveActionInput.info,
      inputTokenIds: [EstforConstants.POISON],
      inputAmounts: [1]
    }
  };

  it("Simple", async function () {
    const {playerId, passiveActions, randomnessBeacon, mockVRF, itemNFT, alice} = await loadFixture(playersFixture);

    const passiveActionInput: PassiveActionInput = {
      ...defaultPassiveActionInput,
      info: {
        ...defaultPassiveActionInput.info,
        skipSuccessPercent: 1 // Just so that oracleCalled can be tested easier
      }
    };
    await passiveActions.addActions([passiveActionInput]);
    await itemNFT.mint(alice, EstforConstants.POISON, 1);
    await passiveActions.connect(alice).startAction(playerId, passiveActionInput.actionId, 0);

    await ethers.provider.send("evm_increaseTime", [passiveActionInput.info.durationDays * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine", []);

    let finishedInfo = await passiveActions.finishedInfo(playerId);
    expect(finishedInfo.finished).to.be.true;
    expect(finishedInfo.oracleCalled).to.be.false;

    await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);
    finishedInfo = await passiveActions.finishedInfo(playerId);
    expect(finishedInfo.finished).to.be.true;
    expect(finishedInfo.oracleCalled).to.be.false;

    await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);
    finishedInfo = await passiveActions.finishedInfo(playerId);
    expect(finishedInfo.finished).to.be.true;
    expect(finishedInfo.oracleCalled).to.be.true;

    // Cannot end early because the action has now finished.
    await expect(passiveActions.connect(alice).endEarly(playerId)).to.be.revertedWithCustomError(
      passiveActions,
      "ActionAlreadyFinished"
    );

    expect(await passiveActions.connect(alice).claim(playerId)).to.not.be.reverted;
  });

  it("Check input item order", async function () {
    const {passiveActions} = await loadFixture(playersFixture);

    const passiveActionInput: PassiveActionInput = {
      ...defaultPassiveActionInput,
      info: {
        ...defaultPassiveActionInput.info,
        inputTokenIds: [1, 2, 3],
        inputAmounts: [1, 2, 3]
      }
    };

    passiveActionInput.info.inputAmounts[0] = 4;
    await expect(passiveActions.addActions([passiveActionInput])).to.be.revertedWithCustomError(
      passiveActions,
      "InputAmountsMustBeInOrder"
    );

    passiveActionInput.info.inputAmounts[0] = 1;
    passiveActionInput.info.inputAmounts[1] = 4;
    await expect(passiveActions.addActions([passiveActionInput])).to.be.revertedWithCustomError(
      passiveActions,
      "InputAmountsMustBeInOrder"
    );

    passiveActionInput.info.inputAmounts[1] = 2;
    passiveActionInput.info.inputAmounts[2] = 1;
    await expect(passiveActions.addActions([passiveActionInput])).to.be.revertedWithCustomError(
      passiveActions,
      "InputAmountsMustBeInOrder"
    );

    passiveActionInput.info.inputAmounts[2] = 3;
    expect(await passiveActions.addActions([passiveActionInput])).to.not.be.reverted;
  });

  it("Any inputs should be burnt", async function () {
    const {playerId, passiveActions, itemNFT, alice} = await loadFixture(playersFixture);

    const passiveActionInput: PassiveActionInput = {
      ...defaultPassiveActionInput,
      info: {
        ...defaultPassiveActionInput.info,
        inputTokenIds: [EstforConstants.OAK_LOG],
        inputAmounts: [100]
      }
    };

    await passiveActions.addActions([passiveActionInput]);
    // Give 1 less than you need to start
    await itemNFT.mint(alice, EstforConstants.OAK_LOG, 99);
    await expect(passiveActions.connect(alice).startAction(playerId, passiveActionInput.actionId, 0)).to.be.reverted;
    await itemNFT.mint(alice, EstforConstants.OAK_LOG, 1);
    await expect(passiveActions.connect(alice).startAction(playerId, passiveActionInput.actionId, 0)).to.not.be
      .reverted;
  });

  it("Cannot add same passive action twice", async function () {
    const {passiveActions} = await loadFixture(playersFixture);

    const passiveActionInput = defaultPassiveActionInput;
    await passiveActions.addActions([passiveActionInput]);
    await expect(passiveActions.addActions([passiveActionInput])).to.be.revertedWithCustomError(
      passiveActions,
      "ActionAlreadyExists"
    );
  });

  it("Passive action must not be greater than 64 days", async function () {
    const {passiveActions} = await loadFixture(playersFixture);
    const passiveActionInput: PassiveActionInput = {
      ...defaultPassiveActionInput,
      info: {
        ...defaultPassiveActionInput.info,
        durationDays: 65
      }
    };
    await expect(passiveActions.addActions([passiveActionInput])).to.be.revertedWithCustomError(
      passiveActions,
      "DurationTooLong"
    );
    passiveActionInput.info.durationDays = 64;
    await passiveActions.addActions([passiveActionInput]);
  });

  it("Must be owner to edit an action", async function () {
    const {passiveActions, alice} = await loadFixture(playersFixture);

    const passiveActionInput = defaultPassiveActionInput;
    await passiveActions.addActions([passiveActionInput]);
    await expect(passiveActions.connect(alice).editActions([passiveActionInput])).to.be.revertedWithCustomError(
      passiveActions,
      "OwnableUnauthorizedAccount"
    );
    await passiveActions.editActions([passiveActionInput]);
  });

  it("Edited action must exist", async function () {
    const {passiveActions, alice} = await loadFixture(playersFixture);

    const passiveActionInput = defaultPassiveActionInput;
    await passiveActions.addActions([passiveActionInput]);
    await expect(passiveActions.connect(alice).editActions([passiveActionInput])).to.be.revertedWithCustomError(
      passiveActions,
      "OwnableUnauthorizedAccount"
    );
    await passiveActions.editActions([passiveActionInput]);
  });

  it("Must be owner of player to start, end and claim actions", async function () {
    const {playerId, passiveActions, itemNFT, alice, randomnessBeacon, mockVRF} = await loadFixture(playersFixture);

    const passiveActionInput = defaultPassiveActionInput;
    await passiveActions.addActions([passiveActionInput]);
    await itemNFT.mint(alice, EstforConstants.POISON, 2);
    await expect(passiveActions.startAction(playerId, passiveActionInput.actionId, 0)).to.be.revertedWithCustomError(
      passiveActions,
      "NotOwnerOfPlayerAndActive"
    );

    await passiveActions.connect(alice).startAction(playerId, passiveActionInput.actionId, 0);
    await ethers.provider.send("evm_increaseTime", [passiveActionInput.info.durationDays * 24 * 60 * 60 - 10]);
    await ethers.provider.send("evm_mine", []);
    let finishedInfo = await passiveActions.finishedInfo(playerId);
    expect(finishedInfo.finished).to.be.false;
    await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);
    await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);

    // Cannot end using wrong account
    await expect(passiveActions.endEarly(playerId)).to.be.revertedWithCustomError(
      passiveActions,
      "NotOwnerOfPlayerAndActive"
    );

    await passiveActions.connect(alice).endEarly(playerId);

    await passiveActions.connect(alice).startAction(playerId, passiveActionInput.actionId, 0);
    await ethers.provider.send("evm_increaseTime", [passiveActionInput.info.durationDays * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine", []);
    await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);

    await expect(passiveActions.claim(playerId)).to.be.revertedWithCustomError(
      passiveActions,
      "NotOwnerOfPlayerAndActive"
    );

    expect(await passiveActions.connect(alice).claim(playerId)).to.not.be.reverted;
  });

  it("Cannot start an action which does not exist", async function () {
    const {playerId, passiveActions, alice} = await loadFixture(playersFixture);
    const passiveActionInput = defaultPassiveActionInput;
    await expect(
      passiveActions.connect(alice).startAction(playerId, passiveActionInput.actionId, 0)
    ).to.be.revertedWithCustomError(passiveActions, "InvalidActionId");
  });

  it("Must have the minimum requirements to start this passive action", async function () {
    const {playerId, passiveActions, itemNFT, players, alice} = await loadFixture(playersFixture);

    const passiveActionInput: PassiveActionInput = {
      ...defaultPassiveActionInput,
      info: {
        ...defaultPassiveActionInput.info,
        minSkills: [Skill.WOODCUTTING, Skill.FIREMAKING, Skill.ALCHEMY],
        minLevels: [2, 2, 2]
      }
    };

    await passiveActions.addActions([passiveActionInput]);
    await itemNFT.mint(alice, EstforConstants.POISON, 1);
    await expect(passiveActions.connect(alice).startAction(playerId, passiveActionInput.actionId, 0))
      .to.be.revertedWithCustomError(passiveActions, "MinimumLevelNotReached")
      .withArgs(Skill.WOODCUTTING, 2);

    await players.modifyXP(alice, playerId, Skill.WOODCUTTING, getXPFromLevel(3), SKIP_XP_THRESHOLD_EFFECTS);
    await players.modifyXP(alice, playerId, Skill.FIREMAKING, getXPFromLevel(2), SKIP_XP_THRESHOLD_EFFECTS);

    await expect(passiveActions.connect(alice).startAction(playerId, passiveActionInput.actionId, 0))
      .to.be.revertedWithCustomError(passiveActions, "MinimumLevelNotReached")
      .withArgs(Skill.ALCHEMY, 2);

    await players.modifyXP(alice, playerId, Skill.ALCHEMY, getXPFromLevel(2), SKIP_XP_THRESHOLD_EFFECTS);
    await passiveActions.connect(alice).startAction(playerId, passiveActionInput.actionId, 0);
  });

  it("Add multiple actions", async function () {
    const {passiveActions} = await loadFixture(playersFixture);

    const passiveActionInput: PassiveActionInput = {
      ...defaultPassiveActionInput,
      info: {
        ...defaultPassiveActionInput.info,
        durationDays: 10,
        minSkills: [Skill.WOODCUTTING],
        minLevels: [getXPFromLevel(2)]
      }
    };

    const passiveActionInput1: PassiveActionInput = {
      ...defaultPassiveActionInput,
      actionId: 2,
      info: {
        ...defaultPassiveActionInput.info,
        minSkills: [Skill.FIREMAKING],
        minLevels: [getXPFromLevel(3)]
      }
    };

    await passiveActions.addActions([passiveActionInput, passiveActionInput1]);

    // Get action
    const action1 = await passiveActions.getAction(1);
    expect(action1.durationDays).to.eq(10);
    expect(action1.minSkill1).to.eq(Skill.WOODCUTTING);
    const action2 = await passiveActions.getAction(2);
    expect(action2.durationDays).to.eq(1);
    expect(action2.minSkill1).to.eq(Skill.FIREMAKING);
  });

  it("Check guaranteed rewards", async function () {
    const {playerId, passiveActions, itemNFT, alice, randomnessBeacon, mockVRF} = await loadFixture(playersFixture);

    const passiveActionInput: PassiveActionInput = {
      ...defaultPassiveActionInput,
      info: {
        ...defaultPassiveActionInput.info,
        durationDays: 2
      },
      guaranteedRewards: [
        {itemTokenId: EstforConstants.OAK_LOG, rate: 2},
        {itemTokenId: EstforConstants.WILLOW_LOG, rate: 5},
        {itemTokenId: EstforConstants.MAGICAL_LOG, rate: 10}
      ]
    };
    await passiveActions.addActions([passiveActionInput]);
    await itemNFT.mint(alice, EstforConstants.POISON, 3);
    await passiveActions.connect(alice).startAction(playerId, passiveActionInput.actionId, 0);
    await ethers.provider.send("evm_increaseTime", [24 * 60 * 60]);
    await ethers.provider.send("evm_mine", []);
    await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);
    await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);
    let finishedInfo = await passiveActions.finishedInfo(playerId);
    expect(finishedInfo.finished).to.be.false;
    expect(finishedInfo.hasRandomRewards).to.be.false;

    // Do not get any if ending early
    await passiveActions.connect(alice).endEarly(playerId);
    expect(await itemNFT.balanceOf(alice, EstforConstants.OAK_LOG)).to.eq(0);
    expect(await itemNFT.balanceOf(alice, EstforConstants.WILLOW_LOG)).to.eq(0);
    expect(await itemNFT.balanceOf(alice, EstforConstants.MAGICAL_LOG)).to.eq(0);

    await passiveActions.connect(alice).startAction(playerId, passiveActionInput.actionId, 0);
    await ethers.provider.send("evm_increaseTime", [passiveActionInput.info.durationDays * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine", []);
    await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);
    await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);
    finishedInfo = await passiveActions.finishedInfo(playerId);
    expect(finishedInfo.finished).to.be.true;

    // Claim the guaranteed rewards
    await passiveActions.connect(alice).claim(playerId);
    expect(await itemNFT.balanceOf(alice, EstforConstants.OAK_LOG)).to.eq(passiveActionInput.guaranteedRewards[0].rate);
    expect(await itemNFT.balanceOf(alice, EstforConstants.WILLOW_LOG)).to.eq(
      passiveActionInput.guaranteedRewards[1].rate
    );
    expect(await itemNFT.balanceOf(alice, EstforConstants.MAGICAL_LOG)).to.eq(
      passiveActionInput.guaranteedRewards[2].rate
    );
  });

  it("Check random rewards", async function () {
    const {playerId, passiveActions, itemNFT, randomnessBeacon, mockVRF, alice} = await loadFixture(playersFixture);

    const randomChance = 65535; // 100%
    const passiveActionInput: PassiveActionInput = {
      ...defaultPassiveActionInput,
      info: {
        ...defaultPassiveActionInput.info,
        durationDays: 2,
        skipSuccessPercent: 1
      },
      guaranteedRewards: [{itemTokenId: EstforConstants.OAK_LOG, rate: 10}],
      randomRewards: [
        {itemTokenId: EstforConstants.BRONZE_ARROW, chance: randomChance, amount: 1},
        {itemTokenId: EstforConstants.IRON_ARROW, chance: randomChance, amount: 3},
        {itemTokenId: EstforConstants.ADAMANTINE_ARROW, chance: randomChance, amount: 2},
        {itemTokenId: EstforConstants.RUNITE_ARROW, chance: 1, amount: 2}
      ]
    };
    await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);
    await passiveActions.addActions([passiveActionInput]);
    await itemNFT.mint(alice, EstforConstants.POISON, 3);
    await passiveActions.connect(alice).startAction(playerId, passiveActionInput.actionId, 0);
    await timeTravel24Hours();
    await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);
    let finishedInfo = await passiveActions.finishedInfo(playerId);
    expect(finishedInfo.finished).to.be.false;
    expect(finishedInfo.oracleCalled).to.be.true;
    expect(finishedInfo.hasRandomRewards).to.be.true;

    // Do not get any if ending early
    await passiveActions.connect(alice).endEarly(playerId);
    expect(await itemNFT.balanceOf(alice, EstforConstants.BRONZE_ARROW)).to.eq(0);
    expect(await itemNFT.balanceOf(alice, EstforConstants.OAK_LOG)).to.eq(0);

    await passiveActions.connect(alice).startAction(playerId, passiveActionInput.actionId, 0);
    await ethers.provider.send("evm_increaseTime", [passiveActionInput.info.durationDays * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine", []);
    await requestAndFulfillRandomWordsSeeded(randomnessBeacon, mockVRF, 100_000_000_000_000n);
    finishedInfo = await passiveActions.finishedInfo(playerId);
    expect(finishedInfo.finished).to.be.true;
    expect(finishedInfo.oracleCalled).to.be.false;
    expect(finishedInfo.hasRandomRewards).to.be.true;

    await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);
    finishedInfo = await passiveActions.finishedInfo(playerId);
    expect(finishedInfo.finished).to.be.true;
    expect(finishedInfo.oracleCalled).to.be.true;
    expect(finishedInfo.hasRandomRewards).to.be.true;

    // Claim the random rewards
    await passiveActions.connect(alice).claim(playerId);
    expect(await itemNFT.balanceOf(alice, EstforConstants.BRONZE_ARROW)).to.eq(
      passiveActionInput.randomRewards[0].amount * passiveActionInput.info.durationDays
    );
    expect(await itemNFT.balanceOf(alice, EstforConstants.IRON_ARROW)).to.eq(
      passiveActionInput.randomRewards[1].amount * passiveActionInput.info.durationDays
    );
    expect(await itemNFT.balanceOf(alice, EstforConstants.ADAMANTINE_ARROW)).to.eq(
      passiveActionInput.randomRewards[2].amount * passiveActionInput.info.durationDays
    );
    expect(await itemNFT.balanceOf(alice, EstforConstants.RUNITE_ARROW)).to.eq(0);
    expect(await itemNFT.balanceOf(alice, EstforConstants.OAK_LOG)).to.eq(passiveActionInput.guaranteedRewards[0].rate);
  });

  it("Starting a new action when the previous is finished and oracle not called with random rewards", async function () {
    const {playerId, passiveActions, itemNFT, randomnessBeacon, mockVRF, alice} = await loadFixture(playersFixture);

    const randomChance = 65535; // 100%
    const passiveActionInput: PassiveActionInput = {
      ...defaultPassiveActionInput,
      info: {
        ...defaultPassiveActionInput.info,
        durationDays: 2
      },
      guaranteedRewards: [{itemTokenId: EstforConstants.OAK_LOG, rate: 10}],
      randomRewards: [{itemTokenId: EstforConstants.BRONZE_ARROW, chance: randomChance, amount: 1}]
    };
    const passiveActionInput1: PassiveActionInput = {
      ...defaultPassiveActionInput,
      actionId: 2,
      guaranteedRewards: [{itemTokenId: EstforConstants.MAGICAL_LOG, rate: 10}],
      randomRewards: [{itemTokenId: EstforConstants.BRONZE_ARROW, chance: randomChance, amount: 2}]
    };
    await passiveActions.addActions([passiveActionInput, passiveActionInput1]);
    await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);
    await itemNFT.mint(alice, EstforConstants.POISON, 3);
    await passiveActions.connect(alice).startAction(playerId, passiveActionInput.actionId, 0);
    await ethers.provider.send("evm_increaseTime", [passiveActionInput.info.durationDays * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine", []);
    await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);
    let finishedInfo = await passiveActions.finishedInfo(playerId);
    expect(finishedInfo.finished).to.be.true;
    expect(finishedInfo.oracleCalled).to.be.false;
    expect(finishedInfo.hasRandomRewards).to.be.true;

    const queueId = 2;
    await expect(passiveActions.connect(alice).startAction(playerId, passiveActionInput1.actionId, 0))
      .to.emit(passiveActions, "StartPassiveAction")
      .withArgs(playerId, alice, passiveActionInput1.actionId, queueId, 0)
      .and.to.emit(passiveActions, "ClaimPassiveAction")
      .withArgs(playerId, alice, queueId - 1, [EstforConstants.OAK_LOG], [10], true);

    expect(await itemNFT.balanceOf(alice, EstforConstants.OAK_LOG)).to.eq(10);
    expect(await itemNFT.balanceOf(alice, EstforConstants.MAGICAL_LOG)).to.eq(0);
    expect(await itemNFT.balanceOf(alice, EstforConstants.BRONZE_ARROW)).to.eq(0);

    await ethers.provider.send("evm_increaseTime", [passiveActionInput1.info.durationDays * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine", []);
    await expect(passiveActions.connect(alice).startAction(playerId, passiveActionInput1.actionId, 0))
      .to.emit(passiveActions, "StartPassiveAction")
      .withArgs(playerId, alice, passiveActionInput1.actionId, queueId + 1, 0)
      .and.to.emit(passiveActions, "ClaimPassiveAction")
      .withArgs(playerId, alice, queueId, [EstforConstants.MAGICAL_LOG], [10], true);

    expect(await itemNFT.balanceOf(alice, EstforConstants.OAK_LOG)).to.eq(10);
    expect(await itemNFT.balanceOf(alice, EstforConstants.MAGICAL_LOG)).to.eq(10);
    expect(await itemNFT.balanceOf(alice, EstforConstants.BRONZE_ARROW)).to.eq(0);
  });

  it("Starting a new action when the previous is finished and oracle is called", async function () {
    const {playerId, passiveActions, itemNFT, randomnessBeacon, mockVRF, alice} = await loadFixture(playersFixture);

    const randomChance = 65535; // 100%
    const passiveActionInput: PassiveActionInput = {
      ...defaultPassiveActionInput,
      info: {
        ...defaultPassiveActionInput.info,
        durationDays: 2,
        skipSuccessPercent: 1
      },
      guaranteedRewards: [{itemTokenId: EstforConstants.OAK_LOG, rate: 10}],
      randomRewards: [{itemTokenId: EstforConstants.BRONZE_ARROW, chance: randomChance, amount: 1}]
    };
    const passiveActionInput1: PassiveActionInput = {
      ...defaultPassiveActionInput,
      info: {
        ...defaultPassiveActionInput.info,
        skipSuccessPercent: 1
      },
      actionId: 2,
      guaranteedRewards: [{itemTokenId: EstforConstants.MAGICAL_LOG, rate: 10}],
      randomRewards: [{itemTokenId: EstforConstants.BRONZE_ARROW, chance: randomChance, amount: 2}]
    };
    await passiveActions.addActions([passiveActionInput, passiveActionInput1]);
    await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);
    await itemNFT.mint(alice, EstforConstants.POISON, 3);
    await passiveActions.connect(alice).startAction(playerId, passiveActionInput.actionId, 0);
    await ethers.provider.send("evm_increaseTime", [passiveActionInput.info.durationDays * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine", []);
    await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);
    await requestAndFulfillRandomWords(randomnessBeacon, mockVRF); // Oracle is called now
    let finishedInfo = await passiveActions.finishedInfo(playerId);
    expect(finishedInfo.finished).to.be.true;
    expect(finishedInfo.oracleCalled).to.be.true;
    expect(finishedInfo.hasRandomRewards).to.be.true;

    const queueId = 2;
    await expect(passiveActions.connect(alice).startAction(playerId, passiveActionInput1.actionId, 0))
      .to.emit(passiveActions, "StartPassiveAction")
      .withArgs(playerId, alice, passiveActionInput1.actionId, queueId, 0)
      .and.to.emit(passiveActions, "ClaimPassiveAction")
      .withArgs(
        playerId,
        alice,
        queueId - 1,
        [EstforConstants.OAK_LOG, EstforConstants.BRONZE_ARROW],
        [10, passiveActionInput.info.durationDays],
        true
      );

    expect(await itemNFT.balanceOf(alice, EstforConstants.OAK_LOG)).to.eq(10);
    expect(await itemNFT.balanceOf(alice, EstforConstants.MAGICAL_LOG)).to.eq(0);
    expect(await itemNFT.balanceOf(alice, EstforConstants.BRONZE_ARROW)).to.eq(passiveActionInput.info.durationDays);

    await ethers.provider.send("evm_increaseTime", [passiveActionInput1.info.durationDays * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine", []);
    // Without oracle being called you get no random rewards here yet
    let pendingPassiveActionState = await passiveActions.pendingPassiveActionState(playerId);
    expect(pendingPassiveActionState.isReady).to.be.false;
    expect(pendingPassiveActionState.producedRandomRewardItemTokenIds.length).to.eq(0);

    await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);
    pendingPassiveActionState = await passiveActions.pendingPassiveActionState(playerId);
    expect(pendingPassiveActionState.producedRandomRewardItemTokenIds.length).to.eq(1);
    expect(pendingPassiveActionState.producedRandomRewardItemTokenIds[0]).to.eq(EstforConstants.BRONZE_ARROW);
    expect(pendingPassiveActionState.producedRandomRewardAmounts[0]).to.eq(
      passiveActionInput1.info.durationDays * passiveActionInput1.randomRewards[0].amount
    );

    await expect(passiveActions.connect(alice).startAction(playerId, passiveActionInput1.actionId, 0))
      .to.emit(passiveActions, "StartPassiveAction")
      .withArgs(playerId, alice, passiveActionInput1.actionId, queueId + 1, 0)
      .and.to.emit(passiveActions, "ClaimPassiveAction")
      .withArgs(
        playerId,
        alice,
        queueId,
        [EstforConstants.MAGICAL_LOG, EstforConstants.BRONZE_ARROW],
        [10, passiveActionInput1.info.durationDays * passiveActionInput1.randomRewards[0].amount],
        true
      );

    expect(await itemNFT.balanceOf(alice, EstforConstants.OAK_LOG)).to.eq(10);
    expect(await itemNFT.balanceOf(alice, EstforConstants.MAGICAL_LOG)).to.eq(10);
    expect(await itemNFT.balanceOf(alice, EstforConstants.BRONZE_ARROW)).to.eq(
      passiveActionInput.info.durationDays +
        passiveActionInput1.info.durationDays * passiveActionInput1.randomRewards[0].amount
    );
  });

  it("Starting a new action when the previous is not finished is not allowed", async function () {
    const {playerId, passiveActions, itemNFT, randomnessBeacon, mockVRF, alice} = await loadFixture(playersFixture);

    const randomChance = 65535; // 100%
    const passiveActionInput: PassiveActionInput = {
      ...defaultPassiveActionInput,
      info: {
        ...defaultPassiveActionInput.info,
        durationDays: 2,
        skipSuccessPercent: 1
      },
      guaranteedRewards: [{itemTokenId: EstforConstants.OAK_LOG, rate: 10}],
      randomRewards: [{itemTokenId: EstforConstants.BRONZE_ARROW, chance: randomChance, amount: 1}]
    };
    const passiveActionInput1: PassiveActionInput = {
      ...defaultPassiveActionInput,
      actionId: 2,
      guaranteedRewards: [{itemTokenId: EstforConstants.MAGICAL_LOG, rate: 10}],
      randomRewards: [{itemTokenId: EstforConstants.BRONZE_ARROW, chance: randomChance, amount: 2}]
    };
    await passiveActions.addActions([passiveActionInput, passiveActionInput1]);
    await itemNFT.mint(alice, EstforConstants.POISON, 3);
    await passiveActions.connect(alice).startAction(playerId, passiveActionInput.actionId, 0);
    await ethers.provider.send("evm_increaseTime", [24 * 60 * 60]); // Only go forward by 1 day
    await ethers.provider.send("evm_mine", []);
    await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);
    await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);
    let finishedInfo = await passiveActions.finishedInfo(playerId);
    expect(finishedInfo.finished).to.be.false;
    expect(finishedInfo.oracleCalled).to.be.true;
    expect(finishedInfo.hasRandomRewards).to.be.true;

    await expect(
      passiveActions.connect(alice).startAction(playerId, passiveActionInput1.actionId, 0)
    ).to.be.revertedWithCustomError(passiveActions, "PreviousActionNotFinished");

    const queueId = 1;
    await expect(passiveActions.connect(alice).endEarly(playerId))
      .to.emit(passiveActions, "EarlyEndPassiveAction")
      .withArgs(playerId, alice, queueId);

    await expect(passiveActions.connect(alice).startAction(playerId, passiveActionInput1.actionId, 0))
      .to.emit(passiveActions, "StartPassiveAction")
      .withArgs(playerId, alice, passiveActionInput1.actionId, queueId + 1, 0);
  });

  it("Do not allow completing unless the oracle is called when using random rewards", async function () {
    const {playerId, passiveActions, itemNFT, randomnessBeacon, mockVRF, alice} = await loadFixture(playersFixture);

    const randomChance = 65535; // 100%
    const passiveActionInput: PassiveActionInput = {
      ...defaultPassiveActionInput,
      info: {
        ...defaultPassiveActionInput.info,
        durationDays: 2
      },
      randomRewards: [{itemTokenId: EstforConstants.BRONZE_ARROW, chance: randomChance, amount: 1}]
    };

    await passiveActions.addActions([passiveActionInput]);
    await itemNFT.mint(alice, EstforConstants.POISON, 1);
    await passiveActions.connect(alice).startAction(playerId, passiveActionInput.actionId, 0);
    await ethers.provider.send("evm_increaseTime", [passiveActionInput.info.durationDays * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine", []);
    await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);
    const finishedInfo = await passiveActions.finishedInfo(playerId);
    expect(finishedInfo.finished).to.be.true;
    expect(finishedInfo.oracleCalled).to.be.false;
    expect(finishedInfo.hasRandomRewards).to.be.true;

    await expect(passiveActions.connect(alice).claim(playerId)).to.be.revertedWithCustomError(
      passiveActions,
      "PassiveActionNotReadyToBeClaimed"
    );
  });

  it("Allow completing if the oracle is called and not using random rewards", async function () {
    const {playerId, passiveActions, itemNFT, alice} = await loadFixture(playersFixture);

    const passiveActionInput: PassiveActionInput = {
      ...defaultPassiveActionInput,
      info: {
        ...defaultPassiveActionInput.info,
        durationDays: 1
      }
    };

    await passiveActions.addActions([passiveActionInput]);
    await itemNFT.mint(alice, EstforConstants.POISON, 1);
    await passiveActions.connect(alice).startAction(playerId, passiveActionInput.actionId, 0);
    await ethers.provider.send("evm_increaseTime", [passiveActionInput.info.durationDays * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine", []);
    const finishedInfo = await passiveActions.finishedInfo(playerId);
    expect(finishedInfo.finished).to.be.true;
    expect(finishedInfo.oracleCalled).to.be.false;
    expect(finishedInfo.hasRandomRewards).to.be.false;

    await expect(passiveActions.connect(alice).claim(playerId)).to.not.be.reverted;
  });

  it("Check packed data", async function () {
    const {passiveActions} = await loadFixture(playersFixture);

    const passiveActionInput: PassiveActionInput = {
      ...defaultPassiveActionInput,
      info: {
        ...defaultPassiveActionInput.info,
        isFullModeOnly: true
      }
    };
    await passiveActions.addActions([passiveActionInput]);
    expect((await passiveActions.getAction(passiveActionInput.actionId)).packedData == "0x80");
  });

  it("Check full mode requirements", async function () {
    const {playerId, passiveActions, itemNFT, playerNFT, brush, upgradePlayerBrushPrice, origName, alice} =
      await loadFixture(playersFixture);

    const passiveActionInput: PassiveActionInput = {
      ...defaultPassiveActionInput,
      info: {
        ...defaultPassiveActionInput.info,
        isFullModeOnly: true
      }
    };
    await passiveActions.addActions([passiveActionInput]);
    expect((await passiveActions.getAction(passiveActionInput.actionId)).packedData == "0x80");
    await itemNFT.mint(alice, EstforConstants.POISON, 1);
    await expect(
      passiveActions.connect(alice).startAction(playerId, passiveActionInput.actionId, 0)
    ).to.be.revertedWithCustomError(passiveActions, "PlayerNotUpgraded");
    // Upgrade player
    await brush.mint(alice, upgradePlayerBrushPrice);
    await brush.connect(alice).approve(playerNFT, upgradePlayerBrushPrice);
    await playerNFT.connect(alice).editPlayer(playerId, origName, "", "", "", true);

    await expect(passiveActions.connect(alice).startAction(playerId, passiveActionInput.actionId, 0)).to.not.be
      .reverted;
  });

  it("Cannot claim twice", async function () {
    const {playerId, passiveActions, itemNFT, randomnessBeacon, mockVRF, alice} = await loadFixture(playersFixture);

    const passiveActionInput = defaultPassiveActionInput;
    await passiveActions.addActions([passiveActionInput]);
    await itemNFT.mint(alice, EstforConstants.POISON, 1);
    await passiveActions.connect(alice).startAction(playerId, passiveActionInput.actionId, 0);

    await ethers.provider.send("evm_increaseTime", [passiveActionInput.info.durationDays * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine", []);
    await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);
    await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);
    const queueId = 1;
    await expect(passiveActions.connect(alice).claim(playerId))
      .to.emit(passiveActions, "ClaimPassiveAction")
      .withArgs(playerId, alice, queueId, [], [], false);
    await expect(passiveActions.connect(alice).claim(playerId)).to.be.revertedWithCustomError(
      passiveActions,
      "NoActivePassiveAction"
    );
  });

  it("endEarly() on non-existent passive action should revert", async function () {
    const {playerId, passiveActions, alice} = await loadFixture(playersFixture);

    await expect(passiveActions.connect(alice).endEarly(playerId)).to.be.revertedWithCustomError(
      passiveActions,
      "NoActivePassiveAction"
    );
  });

  it("Check skipSuccessPercent", async function () {
    const {playerId, passiveActions, itemNFT, randomnessBeacon, mockVRF, alice} = await loadFixture(playersFixture);
    const passiveActionInput: PassiveActionInput = {
      ...defaultPassiveActionInput,
      info: {
        ...defaultPassiveActionInput.info,
        durationDays: 10,
        skipSuccessPercent: 100
      }
    };
    await passiveActions.addActions([passiveActionInput]);
    await itemNFT.mint(alice, EstforConstants.POISON, 1);
    await passiveActions.connect(alice).startAction(playerId, passiveActionInput.actionId, 0);

    await ethers.provider.send("evm_increaseTime", [3 * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine", []);
    await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);
    await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);
    await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);
    await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);
    let finishedInfo = await passiveActions.finishedInfo(playerId);
    expect(finishedInfo.finished).to.be.false;
    expect(finishedInfo.oracleCalled).to.be.true;

    let pendingPassiveActionState = await passiveActions.pendingPassiveActionState(playerId);
    expect(pendingPassiveActionState.isReady).to.be.false;
    expect(pendingPassiveActionState.numDaysSkipped).to.eq(3);
    expect(pendingPassiveActionState.skippedToday).to.be.true;

    await ethers.provider.send("evm_increaseTime", [2 * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine", []);
    await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);
    await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);
    finishedInfo = await passiveActions.finishedInfo(playerId);
    expect(finishedInfo.finished).to.be.true;
    expect(finishedInfo.oracleCalled).to.be.true;

    pendingPassiveActionState = await passiveActions.pendingPassiveActionState(playerId);
    expect(pendingPassiveActionState.isReady).to.be.true;
    expect(pendingPassiveActionState.numDaysSkipped).to.eq(5);
    expect(pendingPassiveActionState.skippedToday).to.be.true;
  });

  it("Add a boost which should give a greater chance of skipping a day", async function () {
    const {playerId, passiveActions, itemNFT, randomnessBeacon, mockVRF, alice} = await loadFixture(playersFixture);
    const passiveActionInput: PassiveActionInput = {
      ...defaultPassiveActionInput,
      info: {
        ...defaultPassiveActionInput.info,
        inputTokenIds: [BRONZE_ARROW, IRON_ARROW],
        inputAmounts: [2, 3],
        durationDays: 10,
        skipSuccessPercent: 100
      }
    };
    await passiveActions.addActions([passiveActionInput]);

    const boostValue = 100; // 60% increased chance of skipping a day
    const boostId = 12821; // boostId TODO update with constant later
    await itemNFT.addItems([
      {
        ...EstforTypes.defaultItemInput,
        tokenId: boostId,
        equipPosition: EstforTypes.EquipPosition.PASSIVE_BOOST_VIAL,
        // Boost
        boostType: EstforTypes.BoostType.PASSIVE_SKIP_CHANCE,
        boostValue,
        boostDuration: 0, // Ignored for passive boost skip chance
        isTransferable: false
      }
    ]);

    await itemNFT.mintBatch(alice, [boostId, BRONZE_ARROW, IRON_ARROW], [1, 2, 3]);
    expect(await itemNFT.balanceOf(alice, boostId)).to.eq(1);
    await passiveActions.connect(alice).startAction(playerId, passiveActionInput.actionId, boostId);
    // Confirm they are all burned
    expect(await itemNFT.balanceOf(alice, boostId)).to.eq(0);
    expect(await itemNFT.balanceOf(alice, BRONZE_ARROW)).to.eq(0);
    expect(await itemNFT.balanceOf(alice, IRON_ARROW)).to.eq(0);

    await ethers.provider.send("evm_increaseTime", [5 * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine", []);
    await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);
    await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);
    await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);
    await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);
    await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);
    await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);
    const finishedInfo = await passiveActions.finishedInfo(playerId);
    expect(finishedInfo.finished).to.be.true;
    expect(finishedInfo.oracleCalled).to.be.true;

    const pendingPassiveActionState = await passiveActions.pendingPassiveActionState(playerId);
    expect(pendingPassiveActionState.isReady).to.be.true;
    expect(pendingPassiveActionState.numDaysSkipped).to.eq(5);
    expect(pendingPassiveActionState.skippedToday).to.be.true;
  });

  it("Check skippedToday", async function () {
    const {playerId, passiveActions, itemNFT, randomnessBeacon, mockVRF, alice} = await loadFixture(playersFixture);

    const passiveActionInput: PassiveActionInput = {
      ...defaultPassiveActionInput,
      info: {
        ...defaultPassiveActionInput.info,
        durationDays: 10,
        skipSuccessPercent: 100
      }
    };
    await passiveActions.addActions([passiveActionInput]);
    await itemNFT.mint(alice, EstforConstants.POISON, 1);
    await passiveActions.connect(alice).startAction(playerId, passiveActionInput.actionId, 0);
    await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);
    await ethers.provider.send("evm_increaseTime", [3 * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine", []);
    let pendingPassiveActionState = await passiveActions.pendingPassiveActionState(playerId);
    expect(pendingPassiveActionState.isReady).to.be.false;
    expect(pendingPassiveActionState.numDaysSkipped).to.eq(0);
    expect(pendingPassiveActionState.skippedToday).to.be.false;

    await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);
    pendingPassiveActionState = await passiveActions.pendingPassiveActionState(playerId);
    expect(pendingPassiveActionState.numDaysSkipped).to.eq(1);
    expect(pendingPassiveActionState.skippedToday).to.be.false;

    await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);
    pendingPassiveActionState = await passiveActions.pendingPassiveActionState(playerId);
    expect(pendingPassiveActionState.numDaysSkipped).to.eq(2);
    expect(pendingPassiveActionState.skippedToday).to.be.false;

    await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);
    pendingPassiveActionState = await passiveActions.pendingPassiveActionState(playerId);
    expect(pendingPassiveActionState.numDaysSkipped).to.eq(3);
    expect(pendingPassiveActionState.skippedToday).to.be.true;

    await ethers.provider.send("evm_increaseTime", [24 * 60 * 60]);
    await ethers.provider.send("evm_mine", []);
    pendingPassiveActionState = await passiveActions.pendingPassiveActionState(playerId);
    expect(pendingPassiveActionState.isReady).to.be.false;
    expect(pendingPassiveActionState.numDaysSkipped).to.eq(3);
    expect(pendingPassiveActionState.skippedToday).to.be.false;
  });

  it("Passive action of 0 days allowed for easier testing", async function () {
    const {passiveActions, itemNFT, alice, playerId} = await loadFixture(playersFixture);
    const passiveActionInput: PassiveActionInput = {
      ...defaultPassiveActionInput,
      info: {
        ...defaultPassiveActionInput.info,
        durationDays: 0
      }
    };
    await passiveActions.addActions([passiveActionInput]);
    await itemNFT.mint(alice, EstforConstants.POISON, 1);
    await passiveActions.connect(alice).startAction(playerId, passiveActionInput.actionId, 0);
    await passiveActions.connect(alice).claim(playerId);
  });

  it("Unavailable passive action cannot be started, but can be looted", async function () {
    const {passiveActions, itemNFT, alice, playerId} = await loadFixture(playersFixture);
    const passiveActionInput: PassiveActionInput = {
      ...defaultPassiveActionInput,
      info: {
        ...defaultPassiveActionInput.info,
        durationDays: 1
      },
      guaranteedRewards: [{itemTokenId: EstforConstants.MAGICAL_LOG, rate: 10}]
    };
    await passiveActions.addActions([passiveActionInput]);
    await itemNFT.mint(alice, EstforConstants.POISON, 1);
    await passiveActions.connect(alice).startAction(playerId, passiveActionInput.actionId, 0);

    await timeTravel24Hours();

    passiveActionInput.info.isAvailable = false;
    await passiveActions.editActions([passiveActionInput]);

    await expect(
      passiveActions.connect(alice).startAction(playerId, passiveActionInput.actionId, 0)
    ).to.be.revertedWithCustomError(passiveActions, "ActionNotAvailable");

    await passiveActions.connect(alice).claim(playerId);
    expect(await itemNFT.balanceOf(alice, EstforConstants.MAGICAL_LOG)).to.eq(
      passiveActionInput.guaranteedRewards[0].rate * passiveActionInput.info.durationDays
    );
  });
});
