import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {EstforConstants, EstforTypes, NONE} from "@paintswap/estfor-definitions";
import {playersFixture} from "./PlayersFixture";
import {GuaranteedReward, RandomReward, Skill} from "@paintswap/estfor-definitions/types";
import {ethers} from "hardhat";
import {expect} from "chai";
import {requestAndFulfillRandomWords} from "../utils";
import {BRONZE_ARROW, IRON_ARROW} from "@paintswap/estfor-definitions/constants";

describe("Passive actions", function () {
  type PassiveActionInfoInput = {
    durationDays: number;
    inputTokenId1: number;
    inputAmount1: number;
    inputTokenId2: number;
    inputAmount2: number;
    inputTokenId3: number;
    inputAmount3: number;
    minSkill1: Skill;
    minXP1: number;
    minSkill2: Skill;
    minXP2: number;
    minSkill3: Skill;
    minXP3: number;
    skipSuccessPercent: number;
    worldLocation: number; // 0 is the main starting world
    isFullModeOnly: boolean;
  };

  type PassiveActionInput = {
    actionId: number;
    info: PassiveActionInfoInput;
    guaranteedRewards: GuaranteedReward[];
    randomRewards: RandomReward[];
  };

  const defaultPassiveActionInput: PassiveActionInput = {
    actionId: 1,
    info: {
      durationDays: 1,
      inputTokenId1: NONE,
      inputAmount1: 0,
      inputTokenId2: NONE,
      inputAmount2: 0,
      inputTokenId3: NONE,
      inputAmount3: 0,
      minSkill1: Skill.NONE,
      minXP1: 0,
      minSkill2: Skill.NONE,
      minXP2: 0,
      minSkill3: Skill.NONE,
      minXP3: 0,
      skipSuccessPercent: 0,
      worldLocation: 0,
      isFullModeOnly: false,
    },
    guaranteedRewards: [],
    randomRewards: [],
  };

  it("No inputs", async function () {
    const {playerId, passiveActions, world, mockOracleClient, alice} = await loadFixture(playersFixture);

    const passiveActionInput = defaultPassiveActionInput;
    await passiveActions.addActions([passiveActionInput]);
    await passiveActions.connect(alice).startAction(playerId, passiveActionInput.actionId, 0);

    await ethers.provider.send("evm_increaseTime", [passiveActionInput.info.durationDays * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine", []);

    let finishedInfo = await passiveActions.finishedInfo(playerId);
    expect(finishedInfo.finished).to.be.true;
    expect(finishedInfo.oracleCalled).to.be.false;

    await requestAndFulfillRandomWords(world, mockOracleClient);
    finishedInfo = await passiveActions.finishedInfo(playerId);
    expect(finishedInfo.finished).to.be.true;
    expect(finishedInfo.oracleCalled).to.be.false;

    await requestAndFulfillRandomWords(world, mockOracleClient);
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
        inputTokenId1: 1,
        inputAmount1: 1,
        inputTokenId2: 2,
        inputAmount2: 2,
        inputTokenId3: 3,
        inputAmount3: 3,
      },
    };

    passiveActionInput.info.inputAmount1 = 4;
    await expect(passiveActions.addActions([passiveActionInput])).to.be.revertedWithCustomError(
      passiveActions,
      "InputAmountsMustBeInOrder"
    );

    passiveActionInput.info.inputAmount1 = 1;
    passiveActionInput.info.inputAmount2 = 4;
    await expect(passiveActions.addActions([passiveActionInput])).to.be.revertedWithCustomError(
      passiveActions,
      "InputAmountsMustBeInOrder"
    );

    passiveActionInput.info.inputAmount2 = 2;
    passiveActionInput.info.inputAmount3 = 1;
    await expect(passiveActions.addActions([passiveActionInput])).to.be.revertedWithCustomError(
      passiveActions,
      "InputAmountsMustBeInOrder"
    );

    passiveActionInput.info.inputAmount3 = 3;
    expect(await passiveActions.addActions([passiveActionInput])).to.not.be.reverted;
  });

  it("Check minimum skill requirement order", async function () {
    const {passiveActions} = await loadFixture(playersFixture);

    const passiveActionInput: PassiveActionInput = {
      ...defaultPassiveActionInput,
      info: {
        ...defaultPassiveActionInput.info,
        minSkill1: Skill.AGILITY,
        minXP1: 3,
        minSkill2: Skill.WOODCUTTING,
        minXP2: 2,
        minSkill3: Skill.FIREMAKING,
        minXP3: 1,
      },
    };

    passiveActionInput.info.minXP1 = 1;
    await expect(passiveActions.addActions([passiveActionInput])).to.be.revertedWithCustomError(
      passiveActions,
      "MinXPsMustBeInOrder"
    );

    passiveActionInput.info.minXP1 = 3;
    passiveActionInput.info.minXP2 = 4;
    await expect(passiveActions.addActions([passiveActionInput])).to.be.revertedWithCustomError(
      passiveActions,
      "MinXPsMustBeInOrder"
    );

    passiveActionInput.info.minXP2 = 2;
    passiveActionInput.info.minXP3 = 4;
    await expect(passiveActions.addActions([passiveActionInput])).to.be.revertedWithCustomError(
      passiveActions,
      "MinXPsMustBeInOrder"
    );

    passiveActionInput.info.minXP3 = 1;
    expect(await passiveActions.addActions([passiveActionInput])).to.not.be.reverted;
  });

  it("Any inputs should be burnt", async function () {
    const {playerId, passiveActions, itemNFT, alice} = await loadFixture(playersFixture);

    const passiveActionInput: PassiveActionInput = {
      ...defaultPassiveActionInput,
      info: {
        ...defaultPassiveActionInput.info,
        inputTokenId1: EstforConstants.OAK_LOG,
        inputAmount1: 100,
      },
    };

    await passiveActions.addActions([passiveActionInput]);
    // Give 1 less than you need to start
    await itemNFT.testMint(alice.address, EstforConstants.OAK_LOG, 99);
    await expect(passiveActions.connect(alice).startAction(playerId, passiveActionInput.actionId, 0)).to.be.reverted;
    await itemNFT.testMint(alice.address, EstforConstants.OAK_LOG, 1);
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
        durationDays: 65,
      },
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
      "CallerIsNotOwner"
    );
    await passiveActions.editActions([passiveActionInput]);
  });

  it("Edited action must exist", async function () {
    const {passiveActions, alice} = await loadFixture(playersFixture);

    const passiveActionInput = defaultPassiveActionInput;
    await passiveActions.addActions([passiveActionInput]);
    await expect(passiveActions.connect(alice).editActions([passiveActionInput])).to.be.revertedWithCustomError(
      passiveActions,
      "CallerIsNotOwner"
    );
    await passiveActions.editActions([passiveActionInput]);
  });

  it("Must be owner of player to start, end and claim actions", async function () {
    const {playerId, passiveActions, alice, world, mockOracleClient} = await loadFixture(playersFixture);

    const passiveActionInput = defaultPassiveActionInput;
    await passiveActions.addActions([passiveActionInput]);
    await expect(passiveActions.startAction(playerId, passiveActionInput.actionId, 0)).to.be.revertedWithCustomError(
      passiveActions,
      "NotOwnerOfPlayerAndActive"
    );

    await passiveActions.connect(alice).startAction(playerId, passiveActionInput.actionId, 0);
    await ethers.provider.send("evm_increaseTime", [passiveActionInput.info.durationDays * 24 * 60 * 60 - 10]);
    await ethers.provider.send("evm_mine", []);
    let finishedInfo = await passiveActions.finishedInfo(playerId);
    expect(finishedInfo.finished).to.be.false;
    await requestAndFulfillRandomWords(world, mockOracleClient);
    await requestAndFulfillRandomWords(world, mockOracleClient);

    // Cannot end using wrong account
    await expect(passiveActions.endEarly(playerId)).to.be.revertedWithCustomError(
      passiveActions,
      "NotOwnerOfPlayerAndActive"
    );

    await passiveActions.connect(alice).endEarly(playerId);

    await passiveActions.connect(alice).startAction(playerId, passiveActionInput.actionId, 0);
    await ethers.provider.send("evm_increaseTime", [passiveActionInput.info.durationDays * 24 * 60 * 60]);
    await requestAndFulfillRandomWords(world, mockOracleClient);

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
    const {playerId, passiveActions, alice} = await loadFixture(playersFixture);

    const passiveActionInput: PassiveActionInput = {
      ...defaultPassiveActionInput,
      info: {
        ...defaultPassiveActionInput.info,
        minSkill1: Skill.WOODCUTTING,
        minXP1: 1,
      },
    };

    await passiveActions.addActions([passiveActionInput]);
    await expect(passiveActions.connect(alice).startAction(playerId, passiveActionInput.actionId, 0))
      .to.be.revertedWithCustomError(passiveActions, "MinimumXPNotReached")
      .withArgs(Skill.WOODCUTTING, 1);
  });

  it("Add multiple actions", async function () {
    const {passiveActions} = await loadFixture(playersFixture);

    const passiveActionInput: PassiveActionInput = {
      ...defaultPassiveActionInput,
      info: {
        ...defaultPassiveActionInput.info,
        durationDays: 10,
        minSkill1: Skill.WOODCUTTING,
        minXP1: 1,
      },
    };

    const passiveActionInput1: PassiveActionInput = {
      ...defaultPassiveActionInput,
      actionId: 2,
      info: {
        ...defaultPassiveActionInput.info,
        minSkill1: Skill.FIREMAKING,
        minXP1: 2,
      },
    };

    await passiveActions.addActions([passiveActionInput, passiveActionInput1]);

    // Get action
    const action1 = await passiveActions.actions(1);
    expect(action1.durationDays).to.eq(10);
    expect(action1.minSkill1).to.eq(Skill.WOODCUTTING);
    const action2 = await passiveActions.actions(2);
    expect(action2.durationDays).to.eq(1);
    expect(action2.minSkill1).to.eq(Skill.FIREMAKING);
  });

  it("Check guaranteed rewards", async function () {
    const {playerId, passiveActions, itemNFT, alice, world, mockOracleClient} = await loadFixture(playersFixture);

    const passiveActionInput: PassiveActionInput = {
      ...defaultPassiveActionInput,
      info: {
        ...defaultPassiveActionInput.info,
        durationDays: 2,
      },
      guaranteedRewards: [
        {itemTokenId: EstforConstants.OAK_LOG, rate: 2},
        {itemTokenId: EstforConstants.WILLOW_LOG, rate: 5},
        {itemTokenId: EstforConstants.MAGICAL_LOG, rate: 10},
      ],
    };
    await passiveActions.addActions([passiveActionInput]);
    await passiveActions.connect(alice).startAction(playerId, passiveActionInput.actionId, 0);
    await ethers.provider.send("evm_increaseTime", [24 * 60 * 60]);
    await ethers.provider.send("evm_mine", []);
    await requestAndFulfillRandomWords(world, mockOracleClient);
    await requestAndFulfillRandomWords(world, mockOracleClient);
    let finishedInfo = await passiveActions.finishedInfo(playerId);
    expect(finishedInfo.finished).to.be.false;

    // Do not get any if ending early
    await passiveActions.connect(alice).endEarly(playerId);
    expect(await itemNFT.balanceOf(alice.address, EstforConstants.OAK_LOG)).to.eq(0);
    expect(await itemNFT.balanceOf(alice.address, EstforConstants.WILLOW_LOG)).to.eq(0);
    expect(await itemNFT.balanceOf(alice.address, EstforConstants.MAGICAL_LOG)).to.eq(0);

    await passiveActions.connect(alice).startAction(playerId, passiveActionInput.actionId, 0);
    await ethers.provider.send("evm_increaseTime", [passiveActionInput.info.durationDays * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine", []);
    await requestAndFulfillRandomWords(world, mockOracleClient);
    await requestAndFulfillRandomWords(world, mockOracleClient);
    finishedInfo = await passiveActions.finishedInfo(playerId);
    expect(finishedInfo.finished).to.be.true;

    // Claim the guaranteed rewards
    await passiveActions.connect(alice).claim(playerId);
    expect(await itemNFT.balanceOf(alice.address, EstforConstants.OAK_LOG)).to.eq(
      passiveActionInput.guaranteedRewards[0].rate
    );
    expect(await itemNFT.balanceOf(alice.address, EstforConstants.WILLOW_LOG)).to.eq(
      passiveActionInput.guaranteedRewards[1].rate
    );
    expect(await itemNFT.balanceOf(alice.address, EstforConstants.MAGICAL_LOG)).to.eq(
      passiveActionInput.guaranteedRewards[2].rate
    );
  });

  it("Check random rewards", async function () {
    const {playerId, passiveActions, itemNFT, world, mockOracleClient, alice} = await loadFixture(playersFixture);

    const randomChance = 65535; // 100%
    const passiveActionInput: PassiveActionInput = {
      ...defaultPassiveActionInput,
      info: {
        ...defaultPassiveActionInput.info,
        durationDays: 2,
      },
      guaranteedRewards: [{itemTokenId: EstforConstants.OAK_LOG, rate: 10}],
      randomRewards: [
        {itemTokenId: EstforConstants.BRONZE_ARROW, chance: randomChance, amount: 1},
        {itemTokenId: EstforConstants.IRON_ARROW, chance: randomChance, amount: 3},
        {itemTokenId: EstforConstants.ADAMANTINE_ARROW, chance: randomChance, amount: 2},
        {itemTokenId: EstforConstants.RUNITE_ARROW, chance: 1, amount: 2},
      ],
    };
    await requestAndFulfillRandomWords(world, mockOracleClient);
    await passiveActions.addActions([passiveActionInput]);
    await passiveActions.connect(alice).startAction(playerId, passiveActionInput.actionId, 0);
    await ethers.provider.send("evm_increaseTime", [24 * 60 * 60]);
    await requestAndFulfillRandomWords(world, mockOracleClient);
    let finishedInfo = await passiveActions.finishedInfo(playerId);
    expect(finishedInfo.finished).to.be.false;
    expect(finishedInfo.oracleCalled).to.be.true;

    // Do not get any if ending early
    await passiveActions.connect(alice).endEarly(playerId);
    expect(await itemNFT.balanceOf(alice.address, EstforConstants.BRONZE_ARROW)).to.eq(0);
    expect(await itemNFT.balanceOf(alice.address, EstforConstants.OAK_LOG)).to.eq(0);

    await passiveActions.connect(alice).startAction(playerId, passiveActionInput.actionId, 0);
    await ethers.provider.send("evm_increaseTime", [passiveActionInput.info.durationDays * 24 * 60 * 60]);
    await requestAndFulfillRandomWords(world, mockOracleClient);
    finishedInfo = await passiveActions.finishedInfo(playerId);
    expect(finishedInfo.finished).to.be.true;
    expect(finishedInfo.oracleCalled).to.be.false;

    await requestAndFulfillRandomWords(world, mockOracleClient);
    finishedInfo = await passiveActions.finishedInfo(playerId);
    expect(finishedInfo.finished).to.be.true;
    expect(finishedInfo.oracleCalled).to.be.true;

    // Claim the random rewards
    await passiveActions.connect(alice).claim(playerId);
    expect(await itemNFT.balanceOf(alice.address, EstforConstants.BRONZE_ARROW)).to.eq(
      passiveActionInput.randomRewards[0].amount * passiveActionInput.info.durationDays
    );
    expect(await itemNFT.balanceOf(alice.address, EstforConstants.IRON_ARROW)).to.eq(
      passiveActionInput.randomRewards[1].amount * passiveActionInput.info.durationDays
    );
    expect(await itemNFT.balanceOf(alice.address, EstforConstants.ADAMANTINE_ARROW)).to.eq(
      passiveActionInput.randomRewards[2].amount * passiveActionInput.info.durationDays
    );
    expect(await itemNFT.balanceOf(alice.address, EstforConstants.RUNITE_ARROW)).to.eq(0);
    expect(await itemNFT.balanceOf(alice.address, EstforConstants.OAK_LOG)).to.eq(
      passiveActionInput.guaranteedRewards[0].rate
    );
  });

  it("Starting a new action when the previous is finished and oracle not called", async function () {
    const {playerId, passiveActions, itemNFT, world, mockOracleClient, alice} = await loadFixture(playersFixture);

    const randomChance = 65535; // 100%
    const passiveActionInput: PassiveActionInput = {
      ...defaultPassiveActionInput,
      info: {
        ...defaultPassiveActionInput.info,
        durationDays: 2,
      },
      guaranteedRewards: [{itemTokenId: EstforConstants.OAK_LOG, rate: 10}],
      randomRewards: [{itemTokenId: EstforConstants.BRONZE_ARROW, chance: randomChance, amount: 1}],
    };
    const passiveActionInput1: PassiveActionInput = {
      ...defaultPassiveActionInput,
      actionId: 2,
      guaranteedRewards: [{itemTokenId: EstforConstants.MAGICAL_LOG, rate: 10}],
      randomRewards: [{itemTokenId: EstforConstants.BRONZE_ARROW, chance: randomChance, amount: 2}],
    };
    await passiveActions.addActions([passiveActionInput, passiveActionInput1]);
    await requestAndFulfillRandomWords(world, mockOracleClient);
    await passiveActions.connect(alice).startAction(playerId, passiveActionInput.actionId, 0);
    await ethers.provider.send("evm_increaseTime", [passiveActionInput.info.durationDays * 24 * 60 * 60]);
    await requestAndFulfillRandomWords(world, mockOracleClient);
    let finishedInfo = await passiveActions.finishedInfo(playerId);
    expect(finishedInfo.finished).to.be.true;
    expect(finishedInfo.oracleCalled).to.be.false;

    const queueId = 2;
    await expect(passiveActions.connect(alice).startAction(playerId, passiveActionInput1.actionId, 0))
      .to.emit(passiveActions, "SetPassiveAction")
      .withArgs(playerId, passiveActionInput1.actionId, queueId, 0)
      .and.to.emit(passiveActions, "ClaimPassiveAction")
      .withArgs(playerId, passiveActionInput.actionId, [EstforConstants.OAK_LOG], [10]);

    expect(await itemNFT.balanceOf(alice.address, EstforConstants.OAK_LOG)).to.eq(10);
    expect(await itemNFT.balanceOf(alice.address, EstforConstants.MAGICAL_LOG)).to.eq(0);
    expect(await itemNFT.balanceOf(alice.address, EstforConstants.BRONZE_ARROW)).to.eq(0);

    await ethers.provider.send("evm_increaseTime", [passiveActionInput1.info.durationDays * 24 * 60 * 60]);
    await expect(passiveActions.connect(alice).startAction(playerId, passiveActionInput1.actionId, 0))
      .to.emit(passiveActions, "SetPassiveAction")
      .withArgs(playerId, passiveActionInput1.actionId, queueId + 1, 0)
      .and.to.emit(passiveActions, "ClaimPassiveAction")
      .withArgs(playerId, passiveActionInput1.actionId, [EstforConstants.MAGICAL_LOG], [10]);

    expect(await itemNFT.balanceOf(alice.address, EstforConstants.OAK_LOG)).to.eq(10);
    expect(await itemNFT.balanceOf(alice.address, EstforConstants.MAGICAL_LOG)).to.eq(10);
    expect(await itemNFT.balanceOf(alice.address, EstforConstants.BRONZE_ARROW)).to.eq(0);
  });

  it("Starting a new action when the previous is finished and oracle is called", async function () {
    const {playerId, passiveActions, itemNFT, world, mockOracleClient, alice} = await loadFixture(playersFixture);

    const randomChance = 65535; // 100%
    const passiveActionInput: PassiveActionInput = {
      ...defaultPassiveActionInput,
      info: {
        ...defaultPassiveActionInput.info,
        durationDays: 2,
      },
      guaranteedRewards: [{itemTokenId: EstforConstants.OAK_LOG, rate: 10}],
      randomRewards: [{itemTokenId: EstforConstants.BRONZE_ARROW, chance: randomChance, amount: 1}],
    };
    const passiveActionInput1: PassiveActionInput = {
      ...defaultPassiveActionInput,
      actionId: 2,
      guaranteedRewards: [{itemTokenId: EstforConstants.MAGICAL_LOG, rate: 10}],
      randomRewards: [{itemTokenId: EstforConstants.BRONZE_ARROW, chance: randomChance, amount: 2}],
    };
    await passiveActions.addActions([passiveActionInput, passiveActionInput1]);
    await requestAndFulfillRandomWords(world, mockOracleClient);
    await passiveActions.connect(alice).startAction(playerId, passiveActionInput.actionId, 0);
    await ethers.provider.send("evm_increaseTime", [passiveActionInput.info.durationDays * 24 * 60 * 60]);
    await requestAndFulfillRandomWords(world, mockOracleClient);
    await requestAndFulfillRandomWords(world, mockOracleClient); // Oracle is called now
    let finishedInfo = await passiveActions.finishedInfo(playerId);
    expect(finishedInfo.finished).to.be.true;
    expect(finishedInfo.oracleCalled).to.be.true;

    const queueId = 2;
    await expect(passiveActions.connect(alice).startAction(playerId, passiveActionInput1.actionId, 0))
      .to.emit(passiveActions, "SetPassiveAction")
      .withArgs(playerId, passiveActionInput1.actionId, queueId, 0)
      .and.to.emit(passiveActions, "ClaimPassiveAction")
      .withArgs(
        playerId,
        passiveActionInput.actionId,
        [EstforConstants.OAK_LOG, EstforConstants.BRONZE_ARROW],
        [10, passiveActionInput.info.durationDays]
      );

    expect(await itemNFT.balanceOf(alice.address, EstforConstants.OAK_LOG)).to.eq(10);
    expect(await itemNFT.balanceOf(alice.address, EstforConstants.MAGICAL_LOG)).to.eq(0);
    expect(await itemNFT.balanceOf(alice.address, EstforConstants.BRONZE_ARROW)).to.eq(
      passiveActionInput.info.durationDays
    );

    await ethers.provider.send("evm_increaseTime", [passiveActionInput1.info.durationDays * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine", []);
    // Without oracle being called you get no random rewards here yet
    let pendingPassiveActionState = await passiveActions.pendingPassiveActionState(playerId);
    expect(pendingPassiveActionState.isReady).to.be.false;
    expect(pendingPassiveActionState.producedRandomRewardItemTokenIds.length).to.eq(0);

    await requestAndFulfillRandomWords(world, mockOracleClient);
    pendingPassiveActionState = await passiveActions.pendingPassiveActionState(playerId);
    expect(pendingPassiveActionState.producedRandomRewardItemTokenIds.length).to.eq(1);
    expect(pendingPassiveActionState.producedRandomRewardItemTokenIds[0]).to.eq(EstforConstants.BRONZE_ARROW);
    expect(pendingPassiveActionState.producedRandomRewardAmounts[0]).to.eq(
      passiveActionInput1.info.durationDays * passiveActionInput1.randomRewards[0].amount
    );

    await expect(passiveActions.connect(alice).startAction(playerId, passiveActionInput1.actionId, 0))
      .to.emit(passiveActions, "SetPassiveAction")
      .withArgs(playerId, passiveActionInput1.actionId, queueId + 1, 0)
      .and.to.emit(passiveActions, "ClaimPassiveAction")
      .withArgs(
        playerId,
        passiveActionInput1.actionId,
        [EstforConstants.MAGICAL_LOG, EstforConstants.BRONZE_ARROW],
        [10, passiveActionInput1.info.durationDays * passiveActionInput1.randomRewards[0].amount]
      );

    expect(await itemNFT.balanceOf(alice.address, EstforConstants.OAK_LOG)).to.eq(10);
    expect(await itemNFT.balanceOf(alice.address, EstforConstants.MAGICAL_LOG)).to.eq(10);
    expect(await itemNFT.balanceOf(alice.address, EstforConstants.BRONZE_ARROW)).to.eq(
      passiveActionInput.info.durationDays +
        passiveActionInput1.info.durationDays * passiveActionInput1.randomRewards[0].amount
    );
  });

  it("Starting a new action when the previous is not finished is not allowed", async function () {
    const {playerId, passiveActions, world, mockOracleClient, alice} = await loadFixture(playersFixture);

    const randomChance = 65535; // 100%
    const passiveActionInput: PassiveActionInput = {
      ...defaultPassiveActionInput,
      info: {
        ...defaultPassiveActionInput.info,
        durationDays: 2,
      },
      guaranteedRewards: [{itemTokenId: EstforConstants.OAK_LOG, rate: 10}],
      randomRewards: [{itemTokenId: EstforConstants.BRONZE_ARROW, chance: randomChance, amount: 1}],
    };
    const passiveActionInput1: PassiveActionInput = {
      ...defaultPassiveActionInput,
      actionId: 2,
      guaranteedRewards: [{itemTokenId: EstforConstants.MAGICAL_LOG, rate: 10}],
      randomRewards: [{itemTokenId: EstforConstants.BRONZE_ARROW, chance: randomChance, amount: 2}],
    };
    await passiveActions.addActions([passiveActionInput, passiveActionInput1]);
    await passiveActions.connect(alice).startAction(playerId, passiveActionInput.actionId, 0);
    await ethers.provider.send("evm_increaseTime", [24 * 60 * 60]); // Only go forward by 1 day
    await requestAndFulfillRandomWords(world, mockOracleClient);
    await requestAndFulfillRandomWords(world, mockOracleClient);
    let finishedInfo = await passiveActions.finishedInfo(playerId);
    expect(finishedInfo.finished).to.be.false;
    expect(finishedInfo.oracleCalled).to.be.true;

    await expect(
      passiveActions.connect(alice).startAction(playerId, passiveActionInput1.actionId, 0)
    ).to.be.revertedWithCustomError(passiveActions, "PreviousActionNotFinished");

    await expect(passiveActions.connect(alice).endEarly(playerId))
      .to.emit(passiveActions, "EarlyEndPassiveAction")
      .withArgs(playerId, passiveActionInput.actionId);

    const queueId = 2;
    await expect(passiveActions.connect(alice).startAction(playerId, passiveActionInput1.actionId, 0))
      .to.emit(passiveActions, "SetPassiveAction")
      .withArgs(playerId, passiveActionInput1.actionId, queueId, 0);
  });

  it("Do not allow completing unless the oracle is called", async function () {
    const {playerId, passiveActions, world, mockOracleClient, alice} = await loadFixture(playersFixture);

    const randomChance = 65535; // 100%
    const passiveActionInput: PassiveActionInput = {
      ...defaultPassiveActionInput,
      info: {
        ...defaultPassiveActionInput.info,
        durationDays: 2,
      },
      randomRewards: [{itemTokenId: EstforConstants.BRONZE_ARROW, chance: randomChance, amount: 1}],
    };

    await passiveActions.addActions([passiveActionInput]);
    await passiveActions.connect(alice).startAction(playerId, passiveActionInput.actionId, 0);
    await ethers.provider.send("evm_increaseTime", [passiveActionInput.info.durationDays * 24 * 60 * 60]); // Only go forward by 1 day
    await requestAndFulfillRandomWords(world, mockOracleClient);
    const finishedInfo = await passiveActions.finishedInfo(playerId);
    expect(finishedInfo.finished).to.be.true;
    expect(finishedInfo.oracleCalled).to.be.false;

    await expect(passiveActions.connect(alice).claim(playerId)).to.be.revertedWithCustomError(
      passiveActions,
      "PassiveActionNotReadyToBeClaimed"
    );
  });

  it("Check packed data", async function () {
    const {passiveActions} = await loadFixture(playersFixture);

    const passiveActionInput: PassiveActionInput = {
      ...defaultPassiveActionInput,
      info: {
        ...defaultPassiveActionInput.info,
        isFullModeOnly: true,
      },
    };
    await passiveActions.addActions([passiveActionInput]);
    expect((await passiveActions.actions(passiveActionInput.actionId)).packedData == "0x80");
  });

  it("Check full mode requirements", async function () {
    const {playerId, passiveActions, playerNFT, brush, upgradePlayerBrushPrice, origName, alice} = await loadFixture(
      playersFixture
    );

    const passiveActionInput: PassiveActionInput = {
      ...defaultPassiveActionInput,
      info: {
        ...defaultPassiveActionInput.info,
        isFullModeOnly: true,
      },
    };
    await passiveActions.addActions([passiveActionInput]);
    expect((await passiveActions.actions(passiveActionInput.actionId)).packedData == "0x80");
    await expect(
      passiveActions.connect(alice).startAction(playerId, passiveActionInput.actionId, 0)
    ).to.be.revertedWithCustomError(passiveActions, "PlayerNotUpgraded");
    // Upgrade player
    await brush.mint(alice.address, upgradePlayerBrushPrice);
    await brush.connect(alice).approve(playerNFT.address, upgradePlayerBrushPrice);
    await playerNFT.connect(alice).editPlayer(playerId, origName, "", "", "", true);

    await expect(passiveActions.connect(alice).startAction(playerId, passiveActionInput.actionId, 0)).to.not.be
      .reverted;
  });

  it("Cannot claim twice", async function () {
    const {playerId, passiveActions, world, mockOracleClient, alice} = await loadFixture(playersFixture);

    const passiveActionInput = defaultPassiveActionInput;
    await passiveActions.addActions([passiveActionInput]);
    await passiveActions.connect(alice).startAction(playerId, passiveActionInput.actionId, 0);

    await ethers.provider.send("evm_increaseTime", [passiveActionInput.info.durationDays * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine", []);
    await requestAndFulfillRandomWords(world, mockOracleClient);
    await requestAndFulfillRandomWords(world, mockOracleClient);
    expect(await passiveActions.connect(alice).claim(playerId)).to.not.be.reverted;
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
    const {playerId, passiveActions, world, mockOracleClient, alice} = await loadFixture(playersFixture);
    const passiveActionInput: PassiveActionInput = {
      ...defaultPassiveActionInput,
      info: {
        ...defaultPassiveActionInput.info,
        durationDays: 10,
        skipSuccessPercent: 100,
      },
    };
    await passiveActions.addActions([passiveActionInput]);
    await passiveActions.connect(alice).startAction(playerId, passiveActionInput.actionId, 0);

    await ethers.provider.send("evm_increaseTime", [3 * 24 * 60 * 60]);
    await requestAndFulfillRandomWords(world, mockOracleClient);
    await requestAndFulfillRandomWords(world, mockOracleClient);
    await requestAndFulfillRandomWords(world, mockOracleClient);
    await requestAndFulfillRandomWords(world, mockOracleClient);
    let finishedInfo = await passiveActions.finishedInfo(playerId);
    expect(finishedInfo.finished).to.be.false;
    expect(finishedInfo.oracleCalled).to.be.true;

    let pendingPassiveActionState = await passiveActions.pendingPassiveActionState(playerId);
    expect(pendingPassiveActionState.isReady).to.be.false;
    expect(pendingPassiveActionState.numDaysSkipped).to.eq(3);
    expect(pendingPassiveActionState.skippedToday).to.be.true;

    await ethers.provider.send("evm_increaseTime", [2 * 24 * 60 * 60]);
    await requestAndFulfillRandomWords(world, mockOracleClient);
    await requestAndFulfillRandomWords(world, mockOracleClient);
    finishedInfo = await passiveActions.finishedInfo(playerId);
    expect(finishedInfo.finished).to.be.true;
    expect(finishedInfo.oracleCalled).to.be.true;

    pendingPassiveActionState = await passiveActions.pendingPassiveActionState(playerId);
    expect(pendingPassiveActionState.isReady).to.be.true;
    expect(pendingPassiveActionState.numDaysSkipped).to.eq(5);
    expect(pendingPassiveActionState.skippedToday).to.be.true;
  });

  it("Add a boost which should give a greater chance of skipping a day", async function () {
    const {playerId, passiveActions, itemNFT, world, mockOracleClient, alice} = await loadFixture(playersFixture);
    const passiveActionInput: PassiveActionInput = {
      ...defaultPassiveActionInput,
      info: {
        ...defaultPassiveActionInput.info,
        inputTokenId1: BRONZE_ARROW,
        inputAmount1: 2,
        inputTokenId2: IRON_ARROW,
        inputAmount2: 3,
        durationDays: 10,
        skipSuccessPercent: 100,
      },
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
        isTransferable: false,
      },
    ]);

    await itemNFT.testMints(alice.address, [boostId, BRONZE_ARROW, IRON_ARROW], [1, 2, 3]);
    expect(await itemNFT.balanceOf(alice.address, boostId)).to.eq(1);
    await passiveActions.connect(alice).startAction(playerId, passiveActionInput.actionId, boostId);
    // Confirm they are all burned
    expect(await itemNFT.balanceOf(alice.address, boostId)).to.eq(0);
    expect(await itemNFT.balanceOf(alice.address, BRONZE_ARROW)).to.eq(0);
    expect(await itemNFT.balanceOf(alice.address, IRON_ARROW)).to.eq(0);

    await ethers.provider.send("evm_increaseTime", [5 * 24 * 60 * 60]);
    await requestAndFulfillRandomWords(world, mockOracleClient);
    await requestAndFulfillRandomWords(world, mockOracleClient);
    await requestAndFulfillRandomWords(world, mockOracleClient);
    await requestAndFulfillRandomWords(world, mockOracleClient);
    await requestAndFulfillRandomWords(world, mockOracleClient);
    await requestAndFulfillRandomWords(world, mockOracleClient);
    const finishedInfo = await passiveActions.finishedInfo(playerId);
    expect(finishedInfo.finished).to.be.true;
    expect(finishedInfo.oracleCalled).to.be.true;

    const pendingPassiveActionState = await passiveActions.pendingPassiveActionState(playerId);
    expect(pendingPassiveActionState.isReady).to.be.true;
    expect(pendingPassiveActionState.numDaysSkipped).to.eq(5);
    expect(pendingPassiveActionState.skippedToday).to.be.true;
  });

  it("Check skippedToday", async function () {
    const {playerId, passiveActions, world, mockOracleClient, alice} = await loadFixture(playersFixture);

    const passiveActionInput: PassiveActionInput = {
      ...defaultPassiveActionInput,
      info: {
        ...defaultPassiveActionInput.info,
        durationDays: 10,
        skipSuccessPercent: 100,
      },
    };
    await passiveActions.addActions([passiveActionInput]);
    await passiveActions.connect(alice).startAction(playerId, passiveActionInput.actionId, 0);
    await requestAndFulfillRandomWords(world, mockOracleClient);
    await ethers.provider.send("evm_increaseTime", [3 * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine", []);
    let pendingPassiveActionState = await passiveActions.pendingPassiveActionState(playerId);
    expect(pendingPassiveActionState.isReady).to.be.false;
    expect(pendingPassiveActionState.numDaysSkipped).to.eq(0);
    expect(pendingPassiveActionState.skippedToday).to.be.false;

    await requestAndFulfillRandomWords(world, mockOracleClient);
    pendingPassiveActionState = await passiveActions.pendingPassiveActionState(playerId);
    expect(pendingPassiveActionState.numDaysSkipped).to.eq(1);
    expect(pendingPassiveActionState.skippedToday).to.be.false;

    await requestAndFulfillRandomWords(world, mockOracleClient);
    pendingPassiveActionState = await passiveActions.pendingPassiveActionState(playerId);
    expect(pendingPassiveActionState.numDaysSkipped).to.eq(2);
    expect(pendingPassiveActionState.skippedToday).to.be.false;

    await requestAndFulfillRandomWords(world, mockOracleClient);
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
});
