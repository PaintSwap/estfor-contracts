import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {EstforConstants, EstforTypes} from "@paintswap/estfor-definitions";
import {Skill, defaultActionChoice} from "@paintswap/estfor-definitions/types";
import {expect} from "chai";
import {ethers} from "hardhat";
import {
  getActionChoiceId,
  getActionId,
  NO_DONATION_AMOUNT,
  requestAndFulfillRandomWords,
  requestAndFulfillRandomWordsSeeded
} from "../utils";
import {playersFixture} from "./PlayersFixture";
import {
  getXPFromLevel,
  setupBasicWoodcutting,
  setupBasicCooking,
  setupBasicCrafting,
  checkPendingQueuedActionState,
  setupBasicAlchemy,
  setupBasicFletching,
  setupBasicForging,
  setupBasicFarming,
  BOOST_START_NOW
} from "./utils";
import {timeTravelToNextCheckpoint, timeTravel, timeTravel24Hours} from "../utils";
import {Block} from "ethers";
import {allFullAttireBonuses} from "../../scripts/data/fullAttireBonuses";
import {FullAttireBonusInputStruct} from "../../typechain-types/contracts/Players/Players";
import {GUAR_MUL, RATE_MUL} from "@paintswap/estfor-definitions/constants";
import {SKIP_XP_THRESHOLD_EFFECTS} from "../../scripts/utils";

const actionIsAvailable = true;

describe("Non-Combat Actions", function () {
  describe("Woodcutting", function () {
    it("Cut wood", async function () {
      const {playerId, players, itemNFT, worldActions, alice} = await loadFixture(playersFixture);

      const {queuedAction, rate} = await setupBasicWoodcutting(itemNFT, worldActions);

      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);

      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan + 2]);
      await ethers.provider.send("evm_mine", []);

      const pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
      expect(pendingQueuedActionState.equipmentStates[0].consumedItemTokenIds.length).is.eq(0);
      expect(pendingQueuedActionState.equipmentStates[0].producedItemTokenIds.length).is.eq(1);
      expect(pendingQueuedActionState.equipmentStates[0].producedItemTokenIds[0]).is.eq(EstforConstants.LOG);
      const balanceExpected = Math.floor((queuedAction.timespan * rate) / (3600 * GUAR_MUL));
      expect(pendingQueuedActionState.equipmentStates[0].producedAmounts[0]).is.eq(balanceExpected);
      await players.connect(alice).processActions(playerId);
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.WOODCUTTING)).to.eq(queuedAction.timespan);
      expect(pendingQueuedActionState.actionMetadatas[0].xpGained).to.eq(queuedAction.timespan);
      // Check the drops are as expected
      expect(await itemNFT.balanceOf(alice, EstforConstants.LOG)).to.eq(balanceExpected);
    });

    it("Full nature equipment", async function () {
      const {playerId, players, itemNFT, worldActions, alice} = await loadFixture(playersFixture);
      const {queuedAction: queuedActionWoodcutting, rate} = await setupBasicWoodcutting(itemNFT, worldActions);

      await itemNFT.addItems([
        {
          ...EstforTypes.defaultItemInput,
          tokenId: EstforConstants.NATURE_MASK,
          equipPosition: EstforTypes.EquipPosition.HEAD
        },
        {
          ...EstforTypes.defaultItemInput,
          tokenId: EstforConstants.NATURE_BODY,
          equipPosition: EstforTypes.EquipPosition.BODY
        },
        {
          ...EstforTypes.defaultItemInput,
          tokenId: EstforConstants.NATURE_BRACERS,
          equipPosition: EstforTypes.EquipPosition.ARMS
        },
        {
          ...EstforTypes.defaultItemInput,
          tokenId: EstforConstants.NATURE_TROUSERS,
          equipPosition: EstforTypes.EquipPosition.LEGS
        },
        {
          ...EstforTypes.defaultItemInput,
          tokenId: EstforConstants.NATURE_BOOTS,
          equipPosition: EstforTypes.EquipPosition.FEET
        }
      ]);

      await players.addFullAttireBonuses([
        allFullAttireBonuses.find((attireBonus) => attireBonus.skill == Skill.WOODCUTTING) as FullAttireBonusInputStruct
      ]);

      const queuedAction = {
        ...queuedActionWoodcutting,
        attire: {
          head: EstforConstants.NATURE_MASK,
          neck: EstforConstants.NONE,
          body: EstforConstants.NATURE_BODY,
          arms: EstforConstants.NATURE_BRACERS,
          legs: EstforConstants.NATURE_TROUSERS,
          feet: EstforConstants.NATURE_BOOTS,
          ring: EstforConstants.NONE, // Always NONE for now
          reserved1: EstforConstants.NONE // Always NONE for now
        }
      };

      await itemNFT.mintBatch(
        alice,
        [
          EstforConstants.NATURE_MASK,
          EstforConstants.NATURE_BODY,
          EstforConstants.NATURE_BRACERS,
          EstforConstants.NATURE_TROUSERS,
          EstforConstants.NATURE_BOOTS
        ],
        [1, 1, 1, 1, 1]
      );

      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);

      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan + 2]);
      await ethers.provider.send("evm_mine", []);
      const balanceExpected = Math.floor((queuedAction.timespan * rate) / (3600 * GUAR_MUL));
      await players.connect(alice).processActions(playerId);
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.WOODCUTTING)).to.eq(
        queuedAction.timespan + queuedAction.timespan * 0.03
      );
      // Check the drops are as expected
      expect(await itemNFT.balanceOf(alice, EstforConstants.LOG)).to.eq(balanceExpected);
    });
  });

  it("Multiple guaranteed rewards should be allowed", async function () {
    const {playerId, players, itemNFT, worldActions, alice} = await loadFixture(playersFixture);
    const rate = 100 * GUAR_MUL; // per hour
    const tx = await worldActions.addActions([
      {
        actionId: EstforConstants.ACTION_WOODCUTTING_LOG,
        info: {
          skill: EstforTypes.Skill.WOODCUTTING,
          xpPerHour: 3600,
          minXP: 0,
          worldLocation: 0,
          isFullModeOnly: false,
          numSpawned: 0,
          handItemTokenIdRangeMin: EstforConstants.BRONZE_AXE,
          handItemTokenIdRangeMax: EstforConstants.WOODCUTTING_MAX,
          isAvailable: actionIsAvailable,
          questPrerequisiteId: 0,
          actionChoiceRequired: false,
          successPercent: 100
        },
        guaranteedRewards: [
          {itemTokenId: EstforConstants.LOG, rate},
          {itemTokenId: EstforConstants.OAK_LOG, rate: rate * 2}
        ],
        randomRewards: [],
        combatStats: EstforTypes.emptyCombatStats
      }
    ]);
    const actionId = await getActionId(tx, worldActions);

    const timespan = 3600;
    const queuedAction: EstforTypes.QueuedActionInput = {
      attire: EstforTypes.noAttire,
      actionId,
      combatStyle: EstforTypes.CombatStyle.NONE,
      choiceId: EstforConstants.NONE,
      regenerateId: EstforConstants.NONE,
      timespan,
      rightHandEquipmentTokenId: EstforConstants.BRONZE_AXE,
      leftHandEquipmentTokenId: EstforConstants.NONE,
      petId: EstforConstants.NONE
    };

    await itemNFT.addItems([
      {
        ...EstforTypes.defaultItemInput,
        tokenId: EstforConstants.BRONZE_AXE,
        equipPosition: EstforTypes.EquipPosition.RIGHT_HAND
      }
    ]);

    await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);
    await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]);
    await ethers.provider.send("evm_mine", []);
    await players.connect(alice).processActions(playerId);

    // Check how many logs they have now, 100 logs burnt per hour
    expect(await itemNFT.balanceOf(alice, EstforConstants.LOG)).to.eq(rate / GUAR_MUL);
    expect(await itemNFT.balanceOf(alice, EstforConstants.OAK_LOG)).to.eq((rate * 2) / GUAR_MUL);
  });

  it("Firemaking", async function () {
    const {playerId, players, itemNFT, worldActions, alice} = await loadFixture(playersFixture);
    const rate = 100 * RATE_MUL; // per hour
    let tx = await worldActions.addActions([
      {
        actionId: 1,
        info: {
          skill: EstforTypes.Skill.FIREMAKING,
          xpPerHour: 0,
          minXP: 0,
          worldLocation: 0,
          isFullModeOnly: false,
          numSpawned: 0,
          handItemTokenIdRangeMin: EstforConstants.MAGIC_FIRE_STARTER,
          handItemTokenIdRangeMax: EstforConstants.FIRE_MAX,
          isAvailable: actionIsAvailable,
          questPrerequisiteId: 0,
          actionChoiceRequired: true,
          successPercent: 100
        },
        guaranteedRewards: [],
        randomRewards: [],
        combatStats: EstforTypes.emptyCombatStats
      }
    ]);
    const actionId = await getActionId(tx, worldActions);

    // Logs go in, nothing comes out
    tx = await worldActions.addActionChoices(
      actionId,
      [1],

      [
        {
          ...defaultActionChoice,
          skill: EstforTypes.Skill.FIREMAKING,
          xpPerHour: 3600,
          rate,
          inputTokenIds: [EstforConstants.LOG],
          inputAmounts: [1]
        }
      ]
    );
    const choiceId = await getActionChoiceId(tx, worldActions);

    const timespan = 3600;
    const queuedAction: EstforTypes.QueuedActionInput = {
      attire: EstforTypes.noAttire,
      actionId,
      combatStyle: EstforTypes.CombatStyle.NONE,
      choiceId,
      regenerateId: EstforConstants.NONE,
      timespan,
      rightHandEquipmentTokenId: EstforConstants.MAGIC_FIRE_STARTER,
      leftHandEquipmentTokenId: EstforConstants.NONE,
      petId: EstforConstants.NONE
    };

    await itemNFT.addItems([
      {
        ...EstforTypes.defaultItemInput,
        tokenId: EstforConstants.MAGIC_FIRE_STARTER,
        equipPosition: EstforTypes.EquipPosition.RIGHT_HAND
      },
      {
        ...EstforTypes.defaultItemInput,
        tokenId: EstforConstants.LOG,
        equipPosition: EstforTypes.EquipPosition.AUX
      }
    ]);

    const mintAmount = 5;
    await itemNFT.mint(alice, EstforConstants.LOG, mintAmount); // Mint less than will be used

    await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);

    await ethers.provider.send("evm_increaseTime", [queuedAction.timespan + 2]);
    await ethers.provider.send("evm_mine", []);
    await players.connect(alice).processActions(playerId);
    expect(await players.getPlayerXP(playerId, EstforTypes.Skill.FIREMAKING)).to.eq(
      queuedAction.timespan / (rate / (mintAmount * RATE_MUL))
    );

    // Check how many logs they have now, 100 logs burnt per hour
    expect(await itemNFT.balanceOf(alice, EstforConstants.LOG)).to.eq(0);
  });

  it("Multi skill appending, woodcutting + firemaking", async function () {
    const {playerId, players, itemNFT, worldActions, alice} = await loadFixture(playersFixture);
    const queuedActions: EstforTypes.QueuedActionInput[] = [];
    const rate = 1200 * GUAR_MUL; // per hour
    {
      const tx = await worldActions.addActions([
        {
          actionId: 1,
          info: {
            skill: EstforTypes.Skill.WOODCUTTING,
            xpPerHour: 3600,
            minXP: 0,
            worldLocation: 0,
            isFullModeOnly: false,
            numSpawned: 0,
            handItemTokenIdRangeMin: EstforConstants.BRONZE_AXE,
            handItemTokenIdRangeMax: EstforConstants.WOODCUTTING_MAX,
            isAvailable: actionIsAvailable,
            questPrerequisiteId: 0,
            actionChoiceRequired: false,
            successPercent: 100
          },
          guaranteedRewards: [{itemTokenId: EstforConstants.LOG, rate}],
          randomRewards: [],
          combatStats: EstforTypes.emptyCombatStats
        }
      ]);
      const actionId = await getActionId(tx, worldActions);
      await itemNFT.addItems([
        {
          ...EstforTypes.defaultItemInput,
          tokenId: EstforConstants.BRONZE_AXE,
          equipPosition: EstforTypes.EquipPosition.RIGHT_HAND
        }
      ]);
      const timespan = 7200 + 10;
      const queuedAction: EstforTypes.QueuedActionInput = {
        attire: EstforTypes.noAttire,
        actionId,
        combatStyle: EstforTypes.CombatStyle.NONE,
        choiceId: EstforConstants.NONE,
        regenerateId: EstforConstants.NONE,
        timespan,
        rightHandEquipmentTokenId: EstforConstants.BRONZE_AXE,
        leftHandEquipmentTokenId: EstforConstants.NONE,
        petId: EstforConstants.NONE
      };

      queuedActions.push(queuedAction);
    }

    let tx = await worldActions.addActions([
      {
        actionId: 2,
        info: {
          skill: EstforTypes.Skill.FIREMAKING,
          xpPerHour: 0,
          minXP: 0,
          worldLocation: 0,
          isFullModeOnly: false,
          numSpawned: 0,
          handItemTokenIdRangeMin: EstforConstants.MAGIC_FIRE_STARTER,
          handItemTokenIdRangeMax: EstforConstants.FIRE_MAX,
          isAvailable: actionIsAvailable,
          questPrerequisiteId: 0,
          actionChoiceRequired: true,
          successPercent: 100
        },
        guaranteedRewards: [],
        randomRewards: [],
        combatStats: EstforTypes.emptyCombatStats
      }
    ]);
    const actionId = await getActionId(tx, worldActions);

    // Logs go in, nothing comes out
    const firemakingRate = 1200 * RATE_MUL; // per hour
    tx = await worldActions.addActionChoices(
      actionId,
      [1],

      [
        {
          ...defaultActionChoice,
          skill: EstforTypes.Skill.FIREMAKING,
          xpPerHour: 3600,
          rate: firemakingRate,
          inputTokenIds: [EstforConstants.LOG],
          inputAmounts: [1]
        }
      ]
    );
    const choiceId = await getActionChoiceId(tx, worldActions);

    await itemNFT.mint(alice, EstforConstants.MAGIC_FIRE_STARTER, 1);
    await itemNFT.addItems([
      {
        ...EstforTypes.defaultItemInput,
        tokenId: EstforConstants.MAGIC_FIRE_STARTER,
        equipPosition: EstforTypes.EquipPosition.RIGHT_HAND
      }
    ]);
    const timespan = 3600;

    const queuedAction: EstforTypes.QueuedActionInput = {
      attire: EstforTypes.noAttire,
      actionId,
      combatStyle: EstforTypes.CombatStyle.NONE,
      choiceId,
      regenerateId: EstforConstants.NONE,
      timespan,
      rightHandEquipmentTokenId: EstforConstants.MAGIC_FIRE_STARTER,
      leftHandEquipmentTokenId: EstforConstants.NONE,
      petId: EstforConstants.NONE
    };

    queuedActions.push(queuedAction);

    await itemNFT.addItems([
      {
        ...EstforTypes.defaultItemInput,
        tokenId: EstforConstants.LOG,
        equipPosition: EstforTypes.EquipPosition.AUX
      }
    ]);

    await players.connect(alice).startActions(playerId, [queuedActions[0]], EstforTypes.ActionQueueStrategy.OVERWRITE);
    await ethers.provider.send("evm_increaseTime", [10]);
    await ethers.provider.send("evm_mine", []);
    let pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
    expect(pendingQueuedActionState.equipmentStates[0].producedItemTokenIds.length).is.eq(1);
    expect(pendingQueuedActionState.equipmentStates[0].producedAmounts[0]).is.eq(3);
    expect(pendingQueuedActionState.actionMetadatas.length).is.eq(1);
    expect(pendingQueuedActionState.actionMetadatas[0].xpGained).is.eq(9);

    await players
      .connect(alice)
      .startActions(playerId, [queuedActions[1]], EstforTypes.ActionQueueStrategy.KEEP_LAST_IN_PROGRESS);
    expect(await players.getPlayerXP(playerId, EstforTypes.Skill.WOODCUTTING)).to.eq(9); // Should be partially completed
    expect(await itemNFT.balanceOf(alice, EstforConstants.LOG)).to.eq(3);
    await ethers.provider.send("evm_increaseTime", [queuedActions[0].timespan + queuedActions[1].timespan]);
    await ethers.provider.send("evm_mine", []);
    expect((await players.getActionQueue(playerId)).length).to.eq(2);
    pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
    expect(pendingQueuedActionState.equipmentStates.length).is.eq(2);
    expect(pendingQueuedActionState.equipmentStates[0].producedItemTokenIds.length).is.eq(1);
    expect(pendingQueuedActionState.equipmentStates[0].producedItemTokenIds[0]).is.eq(EstforConstants.LOG);
    expect(pendingQueuedActionState.equipmentStates[0].producedAmounts[0]).is.eq(2400);
    expect(pendingQueuedActionState.equipmentStates[1].producedItemTokenIds.length).is.eq(0);
    expect(pendingQueuedActionState.equipmentStates[1].consumedItemTokenIds.length).is.eq(1);
    expect(pendingQueuedActionState.equipmentStates[1].consumedItemTokenIds[0]).is.eq(EstforConstants.LOG);
    expect(pendingQueuedActionState.equipmentStates[1].consumedAmounts[0]).is.eq(1200);
    expect(pendingQueuedActionState.actionMetadatas.length).is.eq(2);
    expect(pendingQueuedActionState.actionMetadatas[0].xpGained).is.eq(queuedActions[0].timespan - 10); // 1 xp is wasted
    expect(pendingQueuedActionState.actionMetadatas[1].xpGained).is.eq(queuedActions[1].timespan);

    await players.connect(alice).processActions(playerId);
    expect(await players.getPlayerXP(playerId, EstforTypes.Skill.WOODCUTTING)).to.eq(queuedActions[0].timespan - 1);
    expect(await players.getPlayerXP(playerId, EstforTypes.Skill.FIREMAKING)).to.eq(queuedActions[1].timespan);
    // Check how many logs they have now, 1200 logs burnt per hour, 2 hours producing logs, 1 hour burning
    expect(Number(await itemNFT.balanceOf(alice, EstforConstants.LOG))).to.be.oneOf([
      Math.floor((queuedActions[0].timespan * rate) / (3600 * GUAR_MUL)) - firemakingRate / RATE_MUL - 1,
      Math.floor((queuedActions[0].timespan * rate) / (3600 * GUAR_MUL)) - firemakingRate / RATE_MUL,
      Math.floor((queuedActions[0].timespan * rate) / (3600 * GUAR_MUL)) - firemakingRate / RATE_MUL + 1
    ]);
    // Action queue should be empty
    expect((await players.getActionQueue(playerId)).length).to.eq(0);
  });

  it("Multi skill, woodcutting + firemaking", async function () {
    const {playerId, players, itemNFT, worldActions, alice} = await loadFixture(playersFixture);
    const queuedActions: EstforTypes.QueuedActionInput[] = [];
    const rate = 100 * GUAR_MUL; // per hour
    {
      const tx = await worldActions.addActions([
        {
          actionId: 1,
          info: {
            skill: EstforTypes.Skill.WOODCUTTING,
            xpPerHour: 3600,
            minXP: 0,
            worldLocation: 0,
            isFullModeOnly: false,
            numSpawned: 0,
            handItemTokenIdRangeMin: EstforConstants.BRONZE_AXE,
            handItemTokenIdRangeMax: EstforConstants.WOODCUTTING_MAX,
            isAvailable: actionIsAvailable,
            questPrerequisiteId: 0,
            actionChoiceRequired: false,
            successPercent: 100
          },
          guaranteedRewards: [{itemTokenId: EstforConstants.LOG, rate}],
          randomRewards: [],
          combatStats: EstforTypes.emptyCombatStats
        }
      ]);
      const actionId = await getActionId(tx, worldActions);
      await itemNFT.addItems([
        {
          ...EstforTypes.defaultItemInput,
          tokenId: EstforConstants.BRONZE_AXE,
          equipPosition: EstforTypes.EquipPosition.RIGHT_HAND
        }
      ]);
      const timespan = 7200;
      const queuedAction: EstforTypes.QueuedActionInput = {
        attire: EstforTypes.noAttire,
        actionId,
        combatStyle: EstforTypes.CombatStyle.NONE,
        choiceId: EstforConstants.NONE,
        regenerateId: EstforConstants.NONE,
        timespan,
        rightHandEquipmentTokenId: EstforConstants.BRONZE_AXE,
        leftHandEquipmentTokenId: EstforConstants.NONE,
        petId: EstforConstants.NONE
      };

      queuedActions.push(queuedAction);
    }
    {
      let tx = await worldActions.addActions([
        {
          actionId: 2,
          info: {
            skill: EstforTypes.Skill.FIREMAKING,
            xpPerHour: 0,
            minXP: 0,
            worldLocation: 0,
            isFullModeOnly: false,
            numSpawned: 0,
            handItemTokenIdRangeMin: EstforConstants.MAGIC_FIRE_STARTER,
            handItemTokenIdRangeMax: EstforConstants.FIRE_MAX,
            isAvailable: actionIsAvailable,
            questPrerequisiteId: 0,
            actionChoiceRequired: true,
            successPercent: 100
          },
          guaranteedRewards: [],
          randomRewards: [],
          combatStats: EstforTypes.emptyCombatStats
        }
      ]);
      const actionId = await getActionId(tx, worldActions);

      // Logs go in, nothing comes out
      tx = await worldActions.addActionChoices(
        actionId,
        [1],

        [
          {
            ...defaultActionChoice,
            skill: EstforTypes.Skill.FIREMAKING,
            xpPerHour: 3600,
            rate,
            inputTokenIds: [EstforConstants.LOG],
            inputAmounts: [1]
          }
        ]
      );
      const choiceId = await getActionChoiceId(tx, worldActions);

      await itemNFT.mint(alice, EstforConstants.MAGIC_FIRE_STARTER, 1);
      await itemNFT.addItems([
        {
          ...EstforTypes.defaultItemInput,
          tokenId: EstforConstants.MAGIC_FIRE_STARTER,
          equipPosition: EstforTypes.EquipPosition.RIGHT_HAND
        }
      ]);
      const timespan = 3600;

      const queuedAction: EstforTypes.QueuedActionInput = {
        attire: EstforTypes.noAttire,
        actionId,
        combatStyle: EstforTypes.CombatStyle.NONE,
        choiceId,
        regenerateId: EstforConstants.NONE,
        timespan,
        rightHandEquipmentTokenId: EstforConstants.MAGIC_FIRE_STARTER,
        leftHandEquipmentTokenId: EstforConstants.NONE,
        petId: EstforConstants.NONE
      };

      queuedActions.push(queuedAction);
    }

    await itemNFT.addItems([
      {
        ...EstforTypes.defaultItemInput,
        tokenId: EstforConstants.LOG,
        equipPosition: EstforTypes.EquipPosition.AUX
      }
    ]);

    // This should fail because they don't have any logs. (Maybe later this detects from previous actions)
    /*    await expect(
      players
        .connect(alice)
        .startActions(playerId, queuedActions, EstforConstants.NONE, EstforTypes.ActionQueueStrategy.OVERWRITE)
    ).to.be.reverted;
*/
    await players.connect(alice).startActions(playerId, queuedActions, EstforTypes.ActionQueueStrategy.OVERWRITE);

    await itemNFT.mint(alice, EstforConstants.LOG, 1);
    await ethers.provider.send("evm_increaseTime", [queuedActions[0].timespan + queuedActions[1].timespan + 2]);
    await ethers.provider.send("evm_mine", []);
    await players.connect(alice).processActions(playerId);
    expect(await players.getPlayerXP(playerId, EstforTypes.Skill.WOODCUTTING)).to.eq(queuedActions[0].timespan);
    expect(await players.getPlayerXP(playerId, EstforTypes.Skill.FIREMAKING)).to.eq(queuedActions[1].timespan);
    // Check how many logs they have now, 100 logs burnt per hour, 2 hours producing logs, 1 hour burning
    expect(await itemNFT.balanceOf(alice, EstforConstants.LOG)).to.eq(
      Math.floor((queuedActions[0].timespan * rate) / (3600 * GUAR_MUL)) -
        Math.floor((queuedActions[1].timespan * rate) / (3600 * RATE_MUL)) +
        1
    );
    expect((await players.getActionQueue(playerId)).length).to.eq(0);
  });

  it("Mining", async function () {
    const {playerId, players, itemNFT, worldActions, alice} = await loadFixture(playersFixture);

    const tx = await worldActions.addActions([
      {
        actionId: 1,
        info: {
          skill: EstforTypes.Skill.MINING,
          xpPerHour: 3600,
          minXP: 0,
          worldLocation: 0,
          isFullModeOnly: false,
          numSpawned: 0,
          handItemTokenIdRangeMin: EstforConstants.BRONZE_PICKAXE,
          handItemTokenIdRangeMax: EstforConstants.MINING_MAX,
          isAvailable: actionIsAvailable,
          questPrerequisiteId: 0,
          actionChoiceRequired: false,
          successPercent: 100
        },
        guaranteedRewards: [{itemTokenId: EstforConstants.COPPER_ORE, rate: 10}], // 1.0
        randomRewards: [],
        combatStats: EstforTypes.emptyCombatStats
      }
    ]);

    const actionId = await getActionId(tx, worldActions);

    await itemNFT.mint(alice, EstforConstants.BRONZE_PICKAXE, 1);
    const queuedAction: EstforTypes.QueuedActionInput = {
      attire: EstforTypes.noAttire,
      actionId,
      combatStyle: EstforTypes.CombatStyle.NONE,
      choiceId: EstforConstants.NONE,
      regenerateId: EstforConstants.NONE,
      timespan: 100,
      rightHandEquipmentTokenId: EstforConstants.BRONZE_PICKAXE,
      leftHandEquipmentTokenId: EstforConstants.NONE,
      petId: EstforConstants.NONE
    };

    await itemNFT.addItems([
      {
        ...EstforTypes.defaultItemInput,
        tokenId: EstforConstants.BRONZE_PICKAXE,
        equipPosition: EstforTypes.EquipPosition.RIGHT_HAND
      }
    ]);

    await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);
    await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]);
    await ethers.provider.send("evm_mine", []);
    await players.connect(alice).processActions(playerId);
    expect(await players.getPlayerXP(playerId, EstforTypes.Skill.MINING)).to.eq(0);

    queuedAction.timespan = 3600;
    await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);
    await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]);
    await ethers.provider.send("evm_mine", []);
    await players.connect(alice).processActions(playerId);
    expect(await players.getPlayerXP(playerId, EstforTypes.Skill.MINING)).to.eq(queuedAction.timespan);
  });

  describe("Smithing", function () {
    it("Smith single item", async function () {
      const {playerId, players, itemNFT, worldActions, alice} = await loadFixture(playersFixture);
      const rate = 100 * RATE_MUL; // per hour

      let tx = await worldActions.addActions([
        {
          actionId: 1,
          info: {
            skill: EstforTypes.Skill.SMITHING,
            xpPerHour: 0,
            minXP: 0,
            worldLocation: 0,
            isFullModeOnly: false,
            numSpawned: 0,
            handItemTokenIdRangeMin: EstforConstants.NONE,
            handItemTokenIdRangeMax: EstforConstants.NONE,
            isAvailable: actionIsAvailable,
            questPrerequisiteId: 0,
            actionChoiceRequired: true,
            successPercent: 100
          },
          guaranteedRewards: [],
          randomRewards: [],
          combatStats: EstforTypes.emptyCombatStats
        }
      ]);
      const actionId = await getActionId(tx, worldActions);

      // Ores go in, bars come out
      tx = await worldActions.addActionChoices(
        actionId,
        [1],

        [
          {
            ...defaultActionChoice,
            skill: EstforTypes.Skill.SMITHING,
            xpPerHour: 3600,
            rate,
            inputTokenIds: [EstforConstants.MITHRIL_ORE, EstforConstants.COAL_ORE],
            inputAmounts: [1, 2],
            outputTokenId: EstforConstants.MITHRIL_BAR,
            outputAmount: 1
          }
        ]
      );
      const choiceId = await getActionChoiceId(tx, worldActions);

      const timespan = 3600;

      const queuedAction: EstforTypes.QueuedActionInput = {
        attire: EstforTypes.noAttire,
        actionId,
        combatStyle: EstforTypes.CombatStyle.NONE,
        choiceId,
        regenerateId: EstforConstants.NONE,
        timespan,
        rightHandEquipmentTokenId: EstforConstants.NONE,
        leftHandEquipmentTokenId: EstforConstants.NONE,
        petId: EstforConstants.NONE
      };

      await itemNFT.addItems([
        {
          ...EstforTypes.defaultItemInput,
          tokenId: EstforConstants.COAL_ORE,
          equipPosition: EstforTypes.EquipPosition.AUX
        },
        {
          ...EstforTypes.defaultItemInput,
          tokenId: EstforConstants.MITHRIL_ORE,
          equipPosition: EstforTypes.EquipPosition.AUX
        }
      ]);

      await itemNFT.mint(alice, EstforConstants.COAL_ORE, 255);
      await itemNFT.mint(alice, EstforConstants.MITHRIL_ORE, 255);
      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);

      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan + 2]);
      await ethers.provider.send("evm_mine", []);
      await players.connect(alice).processActions(playerId);
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.SMITHING)).to.eq(queuedAction.timespan);

      // Check how many bars they have now, 100 bars created per hour, burns 2 coal and 1 mithril
      expect(await itemNFT.balanceOf(alice, EstforConstants.MITHRIL_BAR)).to.eq(
        Math.floor((timespan * rate) / (3600 * RATE_MUL))
      );
      expect(await itemNFT.balanceOf(alice, EstforConstants.COAL_ORE)).to.eq(
        255 - Math.floor((timespan * rate) / (3600 * RATE_MUL)) * 2
      );
      expect(await itemNFT.balanceOf(alice, EstforConstants.MITHRIL_ORE)).to.eq(
        255 - Math.floor((timespan * rate) / (3600 * RATE_MUL))
      );
    });

    it("Smith multiple queued items", async function () {
      const {playerId, players, itemNFT, worldActions, alice} = await loadFixture(playersFixture);
      const rate = 100 * RATE_MUL; // per hour

      let tx = await worldActions.addActions([
        {
          actionId: 1,
          info: {
            skill: EstforTypes.Skill.SMITHING,
            xpPerHour: 0,
            minXP: 0,
            worldLocation: 0,
            isFullModeOnly: false,
            numSpawned: 0,
            handItemTokenIdRangeMin: EstforConstants.NONE,
            handItemTokenIdRangeMax: EstforConstants.NONE,
            isAvailable: actionIsAvailable,
            questPrerequisiteId: 0,
            actionChoiceRequired: true,
            successPercent: 100
          },
          guaranteedRewards: [],
          randomRewards: [],
          combatStats: EstforTypes.emptyCombatStats
        }
      ]);
      const actionId = await getActionId(tx, worldActions);

      // Ores go in, bars come out
      tx = await worldActions.addActionChoices(
        actionId,
        [1],

        [
          {
            ...defaultActionChoice,
            skill: EstforTypes.Skill.SMITHING,
            xpPerHour: 3600,
            rate,
            inputTokenIds: [EstforConstants.MITHRIL_ORE, EstforConstants.COAL_ORE],
            inputAmounts: [1, 2],
            outputTokenId: EstforConstants.MITHRIL_BAR,
            outputAmount: 1
          }
        ]
      );
      const choiceId = await getActionChoiceId(tx, worldActions);
      tx = await worldActions.addActionChoices(
        actionId,
        [2],
        [
          {
            ...defaultActionChoice,
            skill: EstforTypes.Skill.SMITHING,
            xpPerHour: 7200,
            rate,
            inputTokenIds: [EstforConstants.MITHRIL_ORE, EstforConstants.COAL_ORE],
            inputAmounts: [1, 2],
            outputTokenId: EstforConstants.MITHRIL_BAR,
            outputAmount: 1
          }
        ]
      );
      const choiceId1 = await getActionChoiceId(tx, worldActions);
      const timespan = 3600;
      const queuedAction: EstforTypes.QueuedActionInput = {
        attire: EstforTypes.noAttire,
        actionId,
        combatStyle: EstforTypes.CombatStyle.NONE,
        choiceId,
        regenerateId: EstforConstants.NONE,
        timespan,
        rightHandEquipmentTokenId: EstforConstants.NONE,
        leftHandEquipmentTokenId: EstforConstants.NONE,
        petId: EstforConstants.NONE
      };

      await itemNFT.addItems([
        {
          ...EstforTypes.defaultItemInput,
          tokenId: EstforConstants.COAL_ORE,
          equipPosition: EstforTypes.EquipPosition.AUX
        },
        {
          ...EstforTypes.defaultItemInput,
          tokenId: EstforConstants.MITHRIL_ORE,
          equipPosition: EstforTypes.EquipPosition.AUX
        }
      ]);

      await itemNFT.mintBatch(alice, [EstforConstants.COAL_ORE, EstforConstants.MITHRIL_ORE], [1000, 1000]);
      const queuedAction1 = {...queuedAction, choiceId: choiceId1};
      await players
        .connect(alice)
        .startActions(playerId, [queuedAction, queuedAction1], EstforTypes.ActionQueueStrategy.OVERWRITE);

      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan + queuedAction1.timespan]);
      await ethers.provider.send("evm_mine", []);
      await players.connect(alice).processActions(playerId);
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.SMITHING)).to.eq(
        queuedAction.timespan + queuedAction1.timespan * 2
      ); // 2nd queued action has double the xp

      // Check how many bars they have now, 100 bars created per hour, burns 2 coal and 1 mithril
      expect(await itemNFT.balanceOf(alice, EstforConstants.MITHRIL_BAR)).to.eq(
        Math.floor((timespan * 2 * rate) / (3600 * RATE_MUL))
      );
      expect(await itemNFT.balanceOf(alice, EstforConstants.COAL_ORE)).to.eq(
        1000 - Math.floor((timespan * 2 * rate) / (3600 * RATE_MUL)) * 2
      );
      expect(await itemNFT.balanceOf(alice, EstforConstants.MITHRIL_ORE)).to.eq(
        1000 - Math.floor((timespan * 2 * rate) / (3600 * RATE_MUL))
      );
    });
  });

  describe("Cooking", function () {
    it("Let's Cook!", async function () {
      const {playerId, players, itemNFT, worldActions, alice} = await loadFixture(playersFixture);

      const successPercent = 100;
      const minLevel = 1;
      const {queuedAction, rate} = await setupBasicCooking(itemNFT, worldActions, successPercent, minLevel);

      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);

      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]);
      await ethers.provider.send("evm_mine", []);
      await players.connect(alice).processActions(playerId);
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.COOKING)).to.eq(queuedAction.timespan);

      expect(await itemNFT.balanceOf(alice, EstforConstants.COOKED_MINNUS)).to.eq(
        Math.floor((queuedAction.timespan * rate) / (3600 * RATE_MUL))
      );
      expect(await itemNFT.balanceOf(alice, EstforConstants.RAW_MINNUS)).to.eq(
        1000 - Math.floor((queuedAction.timespan * rate) / (3600 * RATE_MUL))
      );
    });

    // Changes based on level
    it("Burn some food", async function () {
      const {playerId, players, itemNFT, worldActions, alice} = await loadFixture(playersFixture);

      const successPercent = 25;
      const minLevel = 65;
      const {queuedAction, rate} = await setupBasicCooking(itemNFT, worldActions, successPercent, minLevel);

      await players.modifyXP(alice, playerId, EstforTypes.Skill.COOKING, getXPFromLevel(90), SKIP_XP_THRESHOLD_EFFECTS);

      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);

      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]);
      await ethers.provider.send("evm_mine", []);
      let pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
      const foodNotBurned = Math.floor((queuedAction.timespan * rate) / (3600 * RATE_MUL * 2));
      expect(pendingQueuedActionState.equipmentStates[0].producedItemTokenIds.length).is.eq(1);
      expect(pendingQueuedActionState.equipmentStates[0].producedItemTokenIds[0]).to.eq(EstforConstants.COOKED_MINNUS);
      expect(pendingQueuedActionState.equipmentStates[0].producedAmounts[0]).to.eq(foodNotBurned);
      await players.connect(alice).processActions(playerId);
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.COOKING)).to.eq(
        getXPFromLevel(90) + queuedAction.timespan
      );

      expect(await itemNFT.balanceOf(alice, EstforConstants.COOKED_MINNUS)).to.eq(foodNotBurned);
      expect(await itemNFT.balanceOf(alice, EstforConstants.RAW_MINNUS)).to.eq(
        1000 - Math.floor((queuedAction.timespan * rate) / (3600 * RATE_MUL))
      );
    });

    it("Burn food, in-progress processing (many)", async function () {
      this.timeout(100000); // 100 seconds, this test can take a while on CI

      const {playerId, players, itemNFT, worldActions, alice} = await loadFixture(playersFixture);

      const successPercent = 25;
      const minLevel = 65;
      const {queuedAction, rate} = await setupBasicCooking(itemNFT, worldActions, successPercent, minLevel);

      await players.modifyXP(alice, playerId, EstforTypes.Skill.COOKING, getXPFromLevel(90), SKIP_XP_THRESHOLD_EFFECTS);

      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);

      const numLoops = queuedAction.timespan / 240;

      for (let i = 0; i < numLoops; ++i) {
        // Increase by random time
        const randomTimespan = Math.floor(Math.random() * 240);
        await ethers.provider.send("evm_increaseTime", [randomTimespan]);
        await ethers.provider.send("evm_mine", []);
        await players.connect(alice).processActions(playerId);
      }

      // Check that some are used at least before completing the action
      expect(await itemNFT.balanceOf(alice, EstforConstants.RAW_MINNUS)).to.not.eq(1000);
      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]); // This makes sure everything is used
      await ethers.provider.send("evm_mine", []);
      await players.connect(alice).processActions(playerId);
      // The results should be the same as if we didn't do the intermediate processing. See "burn some food" test
      const foodNotBurned = Math.floor((queuedAction.timespan * rate) / (3600 * RATE_MUL * 2));
      expect(await itemNFT.balanceOf(alice, EstforConstants.COOKED_MINNUS)).to.eq(foodNotBurned);
      expect(await itemNFT.balanceOf(alice, EstforConstants.RAW_MINNUS)).to.eq(
        1000 - Math.floor((queuedAction.timespan * rate) / (3600 * RATE_MUL))
      );
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.COOKING)).to.eq(
        getXPFromLevel(90) + queuedAction.timespan
      );
    });

    it("Burn food, check max 90% success upper bound", async function () {
      const {playerId, players, itemNFT, worldActions, alice} = await loadFixture(playersFixture);

      const successPercent = 85;
      const minLevel = 65;
      const {queuedAction, rate} = await setupBasicCooking(itemNFT, worldActions, successPercent, minLevel);

      await players.modifyXP(alice, playerId, EstforTypes.Skill.COOKING, getXPFromLevel(90), SKIP_XP_THRESHOLD_EFFECTS);

      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);

      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]);
      await ethers.provider.send("evm_mine", []);
      await players.connect(alice).processActions(playerId);
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.COOKING)).to.eq(
        getXPFromLevel(90) + queuedAction.timespan
      );

      expect(await itemNFT.balanceOf(alice, EstforConstants.COOKED_MINNUS)).to.eq(
        Math.floor((queuedAction.timespan * rate * 0.9) / (3600 * RATE_MUL)) // Max 90% success
      );
      expect(await itemNFT.balanceOf(alice, EstforConstants.RAW_MINNUS)).to.eq(
        1000 - Math.floor((queuedAction.timespan * rate) / (3600 * RATE_MUL))
      );
    });
  });

  describe("Thieving", function () {
    // All thieving rewards should be
    it("Steal Nothing", async function () {
      // Check pending rewards, also add a boost, make sure it is 0
      const {playerId, players, itemNFT, worldActions, randomnessBeacon, alice, mockVRF} = await loadFixture(
        playersFixture
      );

      const randomChanceFraction = 0; // 0% chance
      const randomChance = Math.floor(65536 * randomChanceFraction);

      const xpPerHour = 2;
      let tx = await worldActions.addActions([
        {
          actionId: 1,
          info: {
            skill: EstforTypes.Skill.THIEVING,
            xpPerHour,
            minXP: 0,
            worldLocation: 0,
            isFullModeOnly: false,
            numSpawned: 0,
            handItemTokenIdRangeMin: EstforConstants.NONE,
            handItemTokenIdRangeMax: EstforConstants.NONE,
            isAvailable: actionIsAvailable,
            questPrerequisiteId: 0,
            actionChoiceRequired: false,
            successPercent: 100
          },
          guaranteedRewards: [],
          randomRewards: [
            {itemTokenId: EstforConstants.BRONZE_ARROW, chance: randomChance, amount: 1},
            {itemTokenId: EstforConstants.BRONZE_HELMET, chance: randomChance, amount: 1}
          ],
          combatStats: EstforTypes.emptyCombatStats
        }
      ]);

      const actionId = await getActionId(tx, worldActions);
      const numHours = 1;

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

      await itemNFT.addItems([
        {
          ...EstforTypes.defaultItemInput,
          tokenId: EstforConstants.BRONZE_HELMET,
          equipPosition: EstforTypes.EquipPosition.HEAD
        },
        {
          ...EstforTypes.defaultItemInput,
          tokenId: EstforConstants.BRONZE_ARROW,
          equipPosition: EstforTypes.EquipPosition.QUIVER
        },
        {
          ...EstforTypes.defaultItemInput,
          tokenId: EstforConstants.SKILL_BOOST,
          equipPosition: EstforTypes.EquipPosition.BOOST_VIAL,
          // Boost
          boostType: EstforTypes.BoostType.GATHERING,
          boostValue: 10,
          boostDuration: 3600 * 24,
          isTransferable: false
        }
      ]);

      await ethers.provider.send("evm_increaseTime", [24 * 3600]);
      await ethers.provider.send("evm_mine", []);

      await itemNFT.mint(alice, EstforConstants.SKILL_BOOST, 1);
      await players
        .connect(alice)
        .startActionsAdvanced(
          playerId,
          [queuedAction],
          EstforConstants.SKILL_BOOST,
          BOOST_START_NOW,
          0,
          NO_DONATION_AMOUNT,
          EstforTypes.ActionQueueStrategy.OVERWRITE
        );
      await ethers.provider.send("evm_increaseTime", [3 * 3600]);
      await ethers.provider.send("evm_mine", []);

      await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);

      await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);

      await players.connect(alice).processActions(playerId);
      const balance = await itemNFT.balanceOf(alice, EstforConstants.BRONZE_ARROW);
      const balance1 = await itemNFT.balanceOf(alice, EstforConstants.BRONZE_HELMET);
      expect(balance).to.eq(0);
      expect(balance1).to.eq(0);
    });

    it("Check pendingQueuedActionState().rolls", async function () {
      const {playerId, players, itemNFT, worldActions, randomnessBeacon, alice, mockVRF} = await loadFixture(
        playersFixture
      );

      const randomChance = 65535;
      const successPercent = 100;

      const xpPerHour = 3600;
      let tx = await worldActions.addActions([
        {
          actionId: 1,
          info: {
            skill: EstforTypes.Skill.THIEVING,
            xpPerHour,
            minXP: 0,
            worldLocation: 0,
            isFullModeOnly: false,
            numSpawned: 0,
            handItemTokenIdRangeMin: EstforConstants.NONE,
            handItemTokenIdRangeMax: EstforConstants.NONE,
            isAvailable: actionIsAvailable,
            questPrerequisiteId: 0,
            actionChoiceRequired: false,
            successPercent
          },
          guaranteedRewards: [],
          randomRewards: [{itemTokenId: EstforConstants.BRONZE_ARROW, chance: randomChance, amount: 1}],
          combatStats: EstforTypes.emptyCombatStats
        }
      ]);

      const actionId = await getActionId(tx, worldActions);

      const numHours = 2;
      // Make sure it passes the next checkpoint so there are no issues running
      const {timestamp} = (await ethers.provider.getBlock("latest")) as Block;
      const nextCheckpoint = Math.floor(timestamp / 86400) * 86400 + 86400;
      const durationToNextCheckpoint = nextCheckpoint - timestamp + 1;
      await ethers.provider.send("evm_increaseTime", [durationToNextCheckpoint]);
      await ethers.provider.send("evm_mine", []);

      await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);
      await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);

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

      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);
      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan / 2 + 2]);
      await ethers.provider.send("evm_mine", []);
      let pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
      expect(pendingQueuedActionState.actionMetadatas.length).to.eq(1);
      expect(pendingQueuedActionState.actionMetadatas[0].xpGained).to.eq(queuedAction.timespan / 2);
      expect(pendingQueuedActionState.actionMetadatas[0].rolls).to.eq(numHours / 2);
      expect(pendingQueuedActionState.actionMetadatas[0].died).to.be.false;
      expect(pendingQueuedActionState.actionMetadatas[0].actionId).to.eq(1);
      expect(pendingQueuedActionState.actionMetadatas[0].queueId).to.eq(1);
      expect(pendingQueuedActionState.actionMetadatas[0].elapsedTime).to.be.oneOf([
        BigInt(queuedAction.timespan / 2 + 2),
        BigInt(queuedAction.timespan / 2 + 3)
      ]);

      await players.connect(alice).processActions(playerId);
      pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
      expect(pendingQueuedActionState.actionMetadatas.length).to.eq(0);

      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan / 2 - 2]);
      await ethers.provider.send("evm_mine", []);
      pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
      expect(pendingQueuedActionState.actionMetadatas.length).to.eq(1);
      expect(pendingQueuedActionState.actionMetadatas[0].rolls).to.eq(numHours / 2);

      await ethers.provider.send("evm_increaseTime", [24 * 3600]);
      await ethers.provider.send("evm_mine", []);

      await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);
      pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
      await players.connect(alice).processActions(playerId);
      // Should get the loot (Should get rewards if waiting until the next day to claim)
      const balance = await itemNFT.balanceOf(alice, EstforConstants.BRONZE_ARROW);
      expect(balance).to.eq(2);
    });

    it("Steal (many)", async function () {
      const {playerId, players, itemNFT, worldActions, randomnessBeacon, alice, mockVRF} = await loadFixture(
        playersFixture
      );

      const randomChanceFraction = 50.0 / 100; // 50% chance
      const randomChance = Math.floor(65536 * randomChanceFraction);

      const xpPerHour = 2;
      let tx = await worldActions.addActions([
        {
          actionId: 1,
          info: {
            skill: EstforTypes.Skill.THIEVING,
            xpPerHour,
            minXP: 0,
            worldLocation: 0,
            isFullModeOnly: false,
            numSpawned: 0,
            handItemTokenIdRangeMin: EstforConstants.NONE,
            handItemTokenIdRangeMax: EstforConstants.NONE,
            isAvailable: actionIsAvailable,
            questPrerequisiteId: 0,
            actionChoiceRequired: false,
            successPercent: 100
          },
          guaranteedRewards: [],
          randomRewards: [{itemTokenId: EstforConstants.BRONZE_ARROW, chance: randomChance, amount: 1}],
          combatStats: EstforTypes.emptyCombatStats
        }
      ]);

      const actionId = await getActionId(tx, worldActions);

      const numHours = 4;

      // Make sure it passes the next checkpoint so there are no issues running
      const {timestamp} = (await ethers.provider.getBlock("latest")) as Block;
      const nextCheckpoint = Math.floor(timestamp / 86400) * 86400 + 86400;
      const durationToNextCheckpoint = nextCheckpoint - timestamp + 1;
      await ethers.provider.send("evm_increaseTime", [durationToNextCheckpoint]);
      await ethers.provider.send("evm_mine", []);
      await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);
      await ethers.provider.send("evm_increaseTime", [24 * 3600]);
      await ethers.provider.send("evm_mine", []);
      await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);

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

      const numRepeats = 25;
      let numRandomRewardsHit = 0; // Checks there is some randomness
      for (let i = 0; i < numRepeats; ++i) {
        await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);
        await timeTravel24Hours();
        await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);
        const pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
        if (pendingQueuedActionState.producedPastRandomRewards.length > 0) {
          ++numRandomRewardsHit;
        }
        await players.connect(alice).processActions(playerId);
      }
      expect(numRandomRewardsHit).to.be.greaterThan(0).and.to.be.lessThan(numRepeats);

      await ethers.provider.send("evm_increaseTime", [23 * 3600]);
      await ethers.provider.send("evm_mine", []);
      await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);
      await players.connect(alice).processActions(playerId);

      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.THIEVING)).to.eq(xpPerHour * numRepeats * numHours);

      const expectedTotal = numRepeats * randomChanceFraction * numHours;
      const balance = await itemNFT.balanceOf(alice, EstforConstants.BRONZE_ARROW);
      // Have 2 queued actions so twice as much
      expect(balance).to.be.gte(Math.floor(expectedTotal * 0.3)); // Within 30% below
      expect(balance).to.be.lte(Math.floor(expectedTotal * 1.3)); // Within 30% above
    });

    it("Steal, success percent (many)", async function () {
      const {playerId, players, itemNFT, worldActions, randomnessBeacon, alice, mockVRF} = await loadFixture(
        playersFixture
      );

      const randomChanceFraction = 50.0 / 100; // 50% chance
      const randomChance = Math.floor(65536 * randomChanceFraction);
      const successPercent = 60; // Makes it 30% chance in total

      const xpPerHour = 2;
      let tx = await worldActions.addActions([
        {
          actionId: 1,
          info: {
            skill: EstforTypes.Skill.THIEVING,
            xpPerHour,
            minXP: 0,
            worldLocation: 0,
            isFullModeOnly: false,
            numSpawned: 0,
            handItemTokenIdRangeMin: EstforConstants.NONE,
            handItemTokenIdRangeMax: EstforConstants.NONE,
            isAvailable: actionIsAvailable,
            questPrerequisiteId: 0,
            actionChoiceRequired: false,
            successPercent
          },
          guaranteedRewards: [],
          randomRewards: [{itemTokenId: EstforConstants.BRONZE_ARROW, chance: randomChance, amount: 1}],
          combatStats: EstforTypes.emptyCombatStats
        }
      ]);

      const actionId = await getActionId(tx, worldActions);

      const numHours = 2;

      // Make sure it passes the next checkpoint so there are no issues running
      const {timestamp} = (await ethers.provider.getBlock("latest")) as Block;
      const nextCheckpoint = Math.floor(timestamp / 86400) * 86400 + 86400;
      const durationToNextCheckpoint = nextCheckpoint - timestamp + 1;
      await ethers.provider.send("evm_increaseTime", [durationToNextCheckpoint]);
      await ethers.provider.send("evm_mine", []);

      await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);
      await timeTravel24Hours();
      await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);

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

      const numRepeats = 25;
      let numRandomRewardsHit = 0; // Checks there is some randomness
      for (let i = 0; i < numRepeats; ++i) {
        await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);
        await timeTravel24Hours();
        await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);
        const pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
        if (pendingQueuedActionState.producedPastRandomRewards.length > 0) {
          ++numRandomRewardsHit;
        }
        await players.connect(alice).processActions(playerId);
      }
      expect(numRandomRewardsHit).to.be.greaterThan(0).and.to.be.lessThan(numRepeats);

      await ethers.provider.send("evm_increaseTime", [25 * 3600]);
      await ethers.provider.send("evm_mine", []);
      await requestAndFulfillRandomWordsSeeded(randomnessBeacon, mockVRF, 7_000_001n);
      await players.connect(alice).processActions(playerId);

      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.THIEVING)).to.eq(xpPerHour * numRepeats * numHours);

      const expectedTotal = numRepeats * randomChanceFraction * numHours * (successPercent / 100);
      const balance = await itemNFT.balanceOf(alice, EstforConstants.BRONZE_ARROW);
      // Have 2 queued actions so twice as much
      expect(balance).to.be.gte(Math.floor(expectedTotal * 0.6)); // Within 40% below
      expect(balance).to.be.lte(Math.floor(expectedTotal * 1.4)); // Within 40% above
    });

    // Gives +3% XP and +100% success chance
    it("Full natuow equipment", async function () {
      const {playerId, players, itemNFT, worldActions, randomnessBeacon, alice, mockVRF} = await loadFixture(
        playersFixture
      );

      const randomChanceFraction = 1 / 100; // 1% chance
      const randomChance = Math.floor(65536 * randomChanceFraction);

      const xpPerHour = 50;
      let tx = await worldActions.addActions([
        {
          actionId: 1,
          info: {
            skill: EstforTypes.Skill.THIEVING,
            xpPerHour,
            minXP: 0,
            worldLocation: 0,
            isFullModeOnly: false,
            numSpawned: 0,
            handItemTokenIdRangeMin: EstforConstants.NONE,
            handItemTokenIdRangeMax: EstforConstants.NONE,
            isAvailable: actionIsAvailable,
            questPrerequisiteId: 0,
            actionChoiceRequired: false,
            successPercent: 0
          },
          guaranteedRewards: [],
          randomRewards: [{itemTokenId: EstforConstants.BRONZE_ARROW, chance: randomChance, amount: 1}],
          combatStats: EstforTypes.emptyCombatStats
        }
      ]);

      const actionId = await getActionId(tx, worldActions);

      const numHours = 2;

      // Make sure it passes the next checkpoint so there are no issues running
      const {timestamp} = (await ethers.provider.getBlock("latest")) as Block;
      const nextCheckpoint = Math.floor(timestamp / 86400) * 86400 + 86400;
      const durationToNextCheckpoint = nextCheckpoint - timestamp + 1;
      await ethers.provider.send("evm_increaseTime", [durationToNextCheckpoint]);
      await ethers.provider.send("evm_mine", []);
      await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);
      await ethers.provider.send("evm_increaseTime", [24 * 3600]);
      await ethers.provider.send("evm_mine", []);
      await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);

      const timespan = 3600 * numHours;
      const queuedAction: EstforTypes.QueuedActionInput = {
        attire: {
          head: EstforConstants.NATUOW_HOOD,
          neck: EstforConstants.NONE,
          body: EstforConstants.NATUOW_BODY,
          arms: EstforConstants.NATUOW_BRACERS,
          legs: EstforConstants.NATUOW_TASSETS,
          feet: EstforConstants.NATUOW_BOOTS,
          ring: EstforConstants.NONE,
          reserved1: EstforConstants.NONE
        },
        actionId,
        combatStyle: EstforTypes.CombatStyle.NONE,
        choiceId: EstforConstants.NONE,
        regenerateId: EstforConstants.NONE,
        timespan,
        rightHandEquipmentTokenId: EstforConstants.NONE,
        leftHandEquipmentTokenId: EstforConstants.NONE,
        petId: EstforConstants.NONE
      };

      await itemNFT.mintBatch(
        alice,
        [
          EstforConstants.NATUOW_HOOD,
          EstforConstants.NATUOW_BODY,
          EstforConstants.NATUOW_BRACERS,
          EstforConstants.NATUOW_TASSETS,
          EstforConstants.NATUOW_BOOTS
        ],
        [1, 1, 1, 1, 1]
      );
      await itemNFT.addItems([
        {
          ...EstforTypes.defaultItemInput,
          tokenId: EstforConstants.NATUOW_HOOD,
          equipPosition: EstforTypes.EquipPosition.HEAD
        },
        {
          ...EstforTypes.defaultItemInput,
          tokenId: EstforConstants.NATUOW_BODY,
          equipPosition: EstforTypes.EquipPosition.BODY
        },
        {
          ...EstforTypes.defaultItemInput,
          tokenId: EstforConstants.NATUOW_BRACERS,
          equipPosition: EstforTypes.EquipPosition.ARMS
        },
        {
          ...EstforTypes.defaultItemInput,
          tokenId: EstforConstants.NATUOW_TASSETS,
          equipPosition: EstforTypes.EquipPosition.LEGS
        },
        {
          ...EstforTypes.defaultItemInput,
          tokenId: EstforConstants.NATUOW_BOOTS,
          equipPosition: EstforTypes.EquipPosition.FEET
        }
      ]);

      await players.addFullAttireBonuses([
        {
          skill: Skill.THIEVING,
          itemTokenIds: [
            EstforConstants.NATUOW_HOOD,
            EstforConstants.NATUOW_BODY,
            EstforConstants.NATUOW_BRACERS,
            EstforConstants.NATUOW_TASSETS,
            EstforConstants.NATUOW_BOOTS
          ],
          bonusXPPercent: 3,
          bonusRewardsPercent: 100
        }
      ]);

      const numRepeats = 10; // Should get it at least once
      for (let i = 0; i < numRepeats; ++i) {
        await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);
        await ethers.provider.send("evm_increaseTime", [24 * 3600]);
        await ethers.provider.send("evm_mine", []);
        await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);
        await players.connect(alice).processActions(playerId);
      }

      await ethers.provider.send("evm_increaseTime", [24 * 3600]);
      await ethers.provider.send("evm_mine", []);
      await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);
      await players.connect(alice).processActions(playerId);

      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.THIEVING)).to.eq(
        Math.floor(xpPerHour * numRepeats * numHours * 1.03)
      ); // + 3% from full attire bonus equipment

      const expectedTotal = numRepeats * numHours;
      const balance = await itemNFT.balanceOf(alice, EstforConstants.BRONZE_ARROW);
      // Have 2 queued actions so twice as much
      expect(balance).to.eq(expectedTotal); // Very unlikely to be exact, but possible. This checks there is at least some randomness
    });

    it("successPercent not 100", async function () {
      // Check pending rewards, also add a boost, make sure it is 0
      const {playerId, players, itemNFT, worldActions, randomnessBeacon, alice, mockVRF} = await loadFixture(
        playersFixture
      );

      const randomChanceFraction = 99 / 100; // 99% chance
      const randomChance = Math.floor(65536 * randomChanceFraction);
      const successPercent = 99;

      const xpPerHour = 2;
      let tx = await worldActions.addActions([
        {
          actionId: 1,
          info: {
            skill: EstforTypes.Skill.THIEVING,
            xpPerHour,
            minXP: 0,
            worldLocation: 0,
            isFullModeOnly: false,
            numSpawned: 0,
            handItemTokenIdRangeMin: EstforConstants.NONE,
            handItemTokenIdRangeMax: EstforConstants.NONE,
            isAvailable: actionIsAvailable,
            questPrerequisiteId: 0,
            actionChoiceRequired: false,
            successPercent
          },
          guaranteedRewards: [],
          randomRewards: [
            {itemTokenId: EstforConstants.BRONZE_ARROW, chance: randomChance, amount: 1},
            {itemTokenId: EstforConstants.BRONZE_HELMET, chance: randomChance, amount: 1}
          ],
          combatStats: EstforTypes.emptyCombatStats
        }
      ]);

      const actionId = await getActionId(tx, worldActions);
      const numHours = 5;

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

      // Make sure it passes the next checkpoint so there are no issues running
      await timeTravelToNextCheckpoint();
      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);
      await timeTravel(3600);
      await players.connect(alice).processActions(playerId);
      await timeTravel24Hours();
      const seed = 100_000_000_000_000n;
      await requestAndFulfillRandomWordsSeeded(randomnessBeacon, mockVRF, seed);
      await requestAndFulfillRandomWordsSeeded(randomnessBeacon, mockVRF, seed);
      await requestAndFulfillRandomWordsSeeded(randomnessBeacon, mockVRF, seed);

      await players.connect(alice).processActions(playerId);

      // Should get at least 3 minted
      const expectedTotal = Math.floor((randomChanceFraction * numHours * successPercent) / 100) - 1;
      expect(expectedTotal).to.eq(3);
      expect(await itemNFT.balanceOf(alice, EstforConstants.BRONZE_ARROW)).to.be.greaterThanOrEqual(expectedTotal);
      expect(await itemNFT.balanceOf(alice, EstforConstants.BRONZE_HELMET)).to.be.greaterThanOrEqual(expectedTotal);
    });
  });

  describe("Crafting", function () {
    const crafingFixture = async function () {
      const fixture = await loadFixture(playersFixture);
      return {...fixture};
    };

    it("Finish 1 item", async function () {
      const {players, alice, playerId, itemNFT, worldActions} = await loadFixture(crafingFixture);
      const {queuedAction, rate} = await setupBasicCrafting(itemNFT, worldActions);

      const startingAmount = 200;
      await itemNFT.mintBatch(
        alice,
        [EstforConstants.SAPPHIRE, EstforConstants.ROPE],
        [startingAmount, startingAmount]
      );

      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);

      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan + 2]);
      await ethers.provider.send("evm_mine", []);
      await players.connect(alice).processActions(playerId);
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.CRAFTING)).to.eq(queuedAction.timespan);
      // Check the inputs/output are as expected
      expect(await itemNFT.balanceOf(alice, EstforConstants.SAPPHIRE)).to.eq(
        startingAmount - Math.floor((queuedAction.timespan * rate * 20) / (3600 * RATE_MUL))
      );
      expect(await itemNFT.balanceOf(alice, EstforConstants.ROPE)).to.eq(
        startingAmount - Math.floor((queuedAction.timespan * rate) / (3600 * RATE_MUL))
      );
      expect(await itemNFT.balanceOf(alice, EstforConstants.SAPPHIRE_AMULET)).to.eq(
        Math.floor((queuedAction.timespan * rate) / (3600 * RATE_MUL))
      );
    });

    it("Queue enough time but there is a process in-between", async function () {
      const {players, alice, playerId, itemNFT, worldActions} = await loadFixture(crafingFixture);
      const {queuedAction, rate} = await setupBasicCrafting(itemNFT, worldActions);

      const startingAmount = 200;
      await itemNFT.mintBatch(
        alice,
        [EstforConstants.SAPPHIRE, EstforConstants.ROPE],
        [startingAmount, startingAmount]
      );

      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);

      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan - 3]);
      await ethers.provider.send("evm_mine", []);
      let pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
      checkPendingQueuedActionState(pendingQueuedActionState, [], [], 0, [
        BigInt(queuedAction.timespan - 3),
        BigInt(queuedAction.timespan - 2)
      ]);

      await players.connect(alice).processActions(playerId);
      // Get no XP, otherwise you could just stop before anything is consumed.
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.CRAFTING)).to.eq(0);
      // Check the inputs/output are as expected
      expect(await itemNFT.balanceOf(alice, EstforConstants.SAPPHIRE)).to.eq(startingAmount);
      expect(await itemNFT.balanceOf(alice, EstforConstants.ROPE)).to.eq(startingAmount);
      expect(await itemNFT.balanceOf(alice, EstforConstants.SAPPHIRE_AMULET)).to.eq(0);

      await ethers.provider.send("evm_increaseTime", [2]);
      await ethers.provider.send("evm_mine", []);
      pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);

      checkPendingQueuedActionState(
        pendingQueuedActionState,
        [
          {itemTokenId: EstforConstants.ROPE, amount: 1},
          {itemTokenId: EstforConstants.SAPPHIRE, amount: 20}
        ],
        [{itemTokenId: EstforConstants.SAPPHIRE_AMULET, amount: 1}],
        3600,
        2n
      );

      await players.connect(alice).processActions(playerId);

      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.CRAFTING)).to.eq(queuedAction.timespan); // Get all the XP
      // Check the inputs/output are as expected
      expect(await itemNFT.balanceOf(alice, EstforConstants.SAPPHIRE)).to.eq(
        startingAmount - Math.floor((queuedAction.timespan * rate * 20) / (3600 * RATE_MUL))
      );
      expect(await itemNFT.balanceOf(alice, EstforConstants.ROPE)).to.eq(
        startingAmount - Math.floor((queuedAction.timespan * rate) / (3600 * RATE_MUL))
      );
      expect(await itemNFT.balanceOf(alice, EstforConstants.SAPPHIRE_AMULET)).to.eq(
        Math.floor((queuedAction.timespan * rate) / (3600 * RATE_MUL))
      );

      pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
      expect(pendingQueuedActionState.equipmentStates.length).to.eq(0);
      expect(pendingQueuedActionState.actionMetadatas.length).to.eq(0);
    });

    it("More than 1 rate", async function () {
      const {players, alice, playerId, itemNFT, worldActions} = await loadFixture(crafingFixture);
      const rate = 60 * RATE_MUL;
      const {queuedAction} = await setupBasicCrafting(itemNFT, worldActions, rate);

      await itemNFT.mintBatch(alice, [EstforConstants.SAPPHIRE, EstforConstants.ROPE], [20 * 60, 1 * 60]);

      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);

      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan - 12]); // Should make 59
      await ethers.provider.send("evm_mine", []);
      let pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);

      const numMade = rate / RATE_MUL - 1;
      let xpGained = 3600 - rate / RATE_MUL;
      checkPendingQueuedActionState(
        pendingQueuedActionState,
        [
          {itemTokenId: EstforConstants.ROPE, amount: 1 * numMade},
          {itemTokenId: EstforConstants.SAPPHIRE, amount: 20 * numMade}
        ],
        [{itemTokenId: EstforConstants.SAPPHIRE_AMULET, amount: 1 * numMade}],
        xpGained,
        [BigInt(queuedAction.timespan - 12), BigInt(queuedAction.timespan - 11)]
      );

      await players.connect(alice).processActions(playerId);
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.CRAFTING)).to.eq(xpGained);
      expect(await itemNFT.balanceOf(alice, EstforConstants.SAPPHIRE)).to.eq(20);
      expect(await itemNFT.balanceOf(alice, EstforConstants.ROPE)).to.eq(1);
      expect(await itemNFT.balanceOf(alice, EstforConstants.SAPPHIRE_AMULET)).to.eq(rate / RATE_MUL - 1);
      pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
      expect(pendingQueuedActionState.equipmentStates.length).to.eq(0);

      // 1 left, but don't fully complete it with the required time
      await ethers.provider.send("evm_increaseTime", [1]); // Should make 0
      await ethers.provider.send("evm_mine", []);

      pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
      checkPendingQueuedActionState(pendingQueuedActionState, [], [], 0, [1n, 2n]);

      await players.connect(alice).processActions(playerId);
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.CRAFTING)).to.eq(xpGained); // same as before
      // Check the inputs/output are same as before
      expect(await itemNFT.balanceOf(alice, EstforConstants.SAPPHIRE)).to.eq(20n);
      expect(await itemNFT.balanceOf(alice, EstforConstants.ROPE)).to.eq(1n);
      expect(await itemNFT.balanceOf(alice, EstforConstants.SAPPHIRE_AMULET)).to.eq(BigInt(rate / RATE_MUL - 1));

      // Now complete it
      await ethers.provider.send("evm_increaseTime", [12]); // Should make 1
      await ethers.provider.send("evm_mine", []);
      pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);

      xpGained = rate / RATE_MUL;
      checkPendingQueuedActionState(
        pendingQueuedActionState,
        [
          {itemTokenId: EstforConstants.ROPE, amount: 1},
          {itemTokenId: EstforConstants.SAPPHIRE, amount: 20}
        ],
        [{itemTokenId: EstforConstants.SAPPHIRE_AMULET, amount: 1}],
        xpGained,
        [8n, 9n]
      );

      await players.connect(alice).processActions(playerId);
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.CRAFTING)).to.eq(3600);
      // Check the inputs/output are as expected
      expect(await itemNFT.balanceOf(alice, EstforConstants.SAPPHIRE)).to.eq(0);
      expect(await itemNFT.balanceOf(alice, EstforConstants.ROPE)).to.eq(0);
      expect(await itemNFT.balanceOf(alice, EstforConstants.SAPPHIRE_AMULET)).to.eq(rate / RATE_MUL);
    });

    it("Don't complete all (run out of id1 resource)", async function () {
      // Only get XP for the ones you did complete
      const {players, alice, playerId, itemNFT, worldActions} = await loadFixture(crafingFixture);
      const {queuedAction: queuedActionCrafting} = await setupBasicCrafting(itemNFT, worldActions);
      const queuedAction = {...queuedActionCrafting, timespan: 7200};

      // Don't have enough rope (needs 2)
      await itemNFT.mintBatch(alice, [EstforConstants.SAPPHIRE, EstforConstants.ROPE], [40, 1]);

      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);
      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]);
      await ethers.provider.send("evm_mine", []);
      let pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);

      const xpGained = 3600;
      checkPendingQueuedActionState(
        pendingQueuedActionState,
        [
          {itemTokenId: EstforConstants.ROPE, amount: 1},
          {itemTokenId: EstforConstants.SAPPHIRE, amount: 20}
        ],
        [{itemTokenId: EstforConstants.SAPPHIRE_AMULET, amount: 1}],
        xpGained,
        7200n
      );

      await players.connect(alice).processActions(playerId);
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.CRAFTING)).to.eq(xpGained);
      // Check the inputs/output are as expected
      expect(await itemNFT.balanceOf(alice, EstforConstants.SAPPHIRE)).to.eq(20);
      expect(await itemNFT.balanceOf(alice, EstforConstants.ROPE)).to.eq(0);
      expect(await itemNFT.balanceOf(alice, EstforConstants.SAPPHIRE_AMULET)).to.eq(1);
    });

    it("Don't complete all (run out of id2 resource)", async function () {
      // Only get XP for the ones you did complete
      const {players, alice, playerId, itemNFT, worldActions} = await loadFixture(crafingFixture);
      const {queuedAction: queuedActionCrafting} = await setupBasicCrafting(itemNFT, worldActions);
      const queuedAction = {...queuedActionCrafting, timespan: 7200};

      // Don't have enough rope (needs 2)
      await itemNFT.mintBatch(alice, [EstforConstants.SAPPHIRE, EstforConstants.ROPE], [20, 2]);

      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);
      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]);
      await ethers.provider.send("evm_mine", []);
      let pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);

      const xpGained = 3600;
      checkPendingQueuedActionState(
        pendingQueuedActionState,
        [
          {itemTokenId: EstforConstants.ROPE, amount: 1},
          {itemTokenId: EstforConstants.SAPPHIRE, amount: 20}
        ],
        [{itemTokenId: EstforConstants.SAPPHIRE_AMULET, amount: 1}],
        xpGained,
        7200n
      );

      await players.connect(alice).processActions(playerId);
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.CRAFTING)).to.eq(xpGained);
      // Check the inputs/output are as expected
      expect(await itemNFT.balanceOf(alice, EstforConstants.SAPPHIRE)).to.eq(0);
      expect(await itemNFT.balanceOf(alice, EstforConstants.ROPE)).to.eq(1);
      expect(await itemNFT.balanceOf(alice, EstforConstants.SAPPHIRE_AMULET)).to.eq(1);
    });

    it("In-progress update have enough, then don't have enough, then have enough", async function () {
      // Only get XP for the ones you did complete
      const {players, alice, playerId, itemNFT, worldActions} = await loadFixture(crafingFixture);
      const {queuedAction: queuedActionCrafting} = await setupBasicCrafting(itemNFT, worldActions);
      const queuedAction = {...queuedActionCrafting, timespan: 3600 * 3};

      await itemNFT.mintBatch(alice, [EstforConstants.SAPPHIRE, EstforConstants.ROPE], [200, 10]);

      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);
      await ethers.provider.send("evm_increaseTime", [900]);
      await ethers.provider.send("evm_mine", []);
      await players.connect(alice).processActions(playerId);
      let xpGained = 0;
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.CRAFTING)).to.eq(xpGained);
      // Shouldn't use any resources as only 1 is made per hour.
      expect(await itemNFT.balanceOf(alice, EstforConstants.SAPPHIRE)).to.eq(200);
      expect(await itemNFT.balanceOf(alice, EstforConstants.ROPE)).to.eq(10);
      expect(await itemNFT.balanceOf(alice, EstforConstants.SAPPHIRE_AMULET)).to.eq(0);

      await ethers.provider.send("evm_increaseTime", [1800]);
      await ethers.provider.send("evm_mine", []);
      await players.connect(alice).processActions(playerId);
      xpGained = 0;
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.CRAFTING)).to.eq(xpGained);
      expect(await itemNFT.balanceOf(alice, EstforConstants.SAPPHIRE)).to.eq(200);
      expect(await itemNFT.balanceOf(alice, EstforConstants.ROPE)).to.eq(10);
      expect(await itemNFT.balanceOf(alice, EstforConstants.SAPPHIRE_AMULET)).to.eq(0);

      // Enough time has passed to make 1
      await ethers.provider.send("evm_increaseTime", [1800]);
      await ethers.provider.send("evm_mine", []);
      await players.connect(alice).processActions(playerId);
      xpGained = 3600;
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.CRAFTING)).to.eq(xpGained);
      expect(await itemNFT.balanceOf(alice, EstforConstants.SAPPHIRE)).to.eq(200 - 20);
      expect(await itemNFT.balanceOf(alice, EstforConstants.ROPE)).to.eq(10 - 1);
      expect(await itemNFT.balanceOf(alice, EstforConstants.SAPPHIRE_AMULET)).to.eq(1);

      await itemNFT.connect(alice).burn(alice, EstforConstants.SAPPHIRE, 180);
      // Don't have enough to make any
      await ethers.provider.send("evm_increaseTime", [3600]);
      await ethers.provider.send("evm_mine", []);
      await players.connect(alice).processActions(playerId);
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.CRAFTING)).to.eq(xpGained);

      await itemNFT.connect(alice).mint(alice, EstforConstants.SAPPHIRE, 180);
      // Don't have enough to make any
      await ethers.provider.send("evm_increaseTime", [3600]);
      await ethers.provider.send("evm_mine", []);
      await players.connect(alice).processActions(playerId);
      xpGained = 3600 * 3;
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.CRAFTING)).to.eq(xpGained);
      // Check the inputs/output are as expected
      expect(await itemNFT.balanceOf(alice, EstforConstants.SAPPHIRE)).to.eq(200 - 20 * 3);
      expect(await itemNFT.balanceOf(alice, EstforConstants.ROPE)).to.eq(10 - 3);
      expect(await itemNFT.balanceOf(alice, EstforConstants.SAPPHIRE_AMULET)).to.eq(3);
    });

    it("Don't have any of both, id1 or id2", async function () {
      const {players, alice, playerId, itemNFT, worldActions} = await loadFixture(crafingFixture);
      const {queuedAction: queuedActionCrafting} = await setupBasicCrafting(itemNFT, worldActions);
      const queuedAction = {...queuedActionCrafting, timespan: 7200};

      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);
      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]);
      await ethers.provider.send("evm_mine", []);
      let pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
      checkPendingQueuedActionState(pendingQueuedActionState, [], [], 0, 7200n);
      await itemNFT.mintBatch(alice, [EstforConstants.SAPPHIRE, EstforConstants.ROPE], [20, 0]);
      pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
      checkPendingQueuedActionState(pendingQueuedActionState, [], [], 0, 7200n);
      await itemNFT.connect(alice).burn(alice, EstforConstants.SAPPHIRE, 20);
      await itemNFT.mintBatch(alice, [EstforConstants.SAPPHIRE, EstforConstants.ROPE], [0, 1]);
      pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
      checkPendingQueuedActionState(pendingQueuedActionState, [], [], 0, 7200n);
      await itemNFT.mintBatch(alice, [EstforConstants.SAPPHIRE, EstforConstants.ROPE], [20, 0]);
      expect(await itemNFT.balanceOf(alice, EstforConstants.SAPPHIRE)).to.eq(20);
      expect(await itemNFT.balanceOf(alice, EstforConstants.ROPE)).to.eq(1);
      pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
      const xpGained = 3600;
      checkPendingQueuedActionState(
        pendingQueuedActionState,
        [
          {itemTokenId: EstforConstants.ROPE, amount: 1},
          {itemTokenId: EstforConstants.SAPPHIRE, amount: 20}
        ],
        [{itemTokenId: EstforConstants.SAPPHIRE_AMULET, amount: 1}],
        xpGained,
        7200n
      );

      await players.connect(alice).processActions(playerId);
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.CRAFTING)).to.eq(xpGained);
      // Check the inputs/output are as expected
      expect(await itemNFT.balanceOf(alice, EstforConstants.SAPPHIRE)).to.eq(0);
      expect(await itemNFT.balanceOf(alice, EstforConstants.ROPE)).to.eq(0);
      expect(await itemNFT.balanceOf(alice, EstforConstants.SAPPHIRE_AMULET)).to.eq(1);
    });

    it("Finish multiple items (multiple craft actions queued)", async function () {
      // Only get XP for the ones you did complete
      const {players, alice, playerId, itemNFT, worldActions} = await loadFixture(crafingFixture);
      const {queuedAction} = await setupBasicCrafting(itemNFT, worldActions);

      // Don't enough enough rope (needs 2)
      await itemNFT.mintBatch(alice, [EstforConstants.SAPPHIRE, EstforConstants.ROPE], [60, 3]);

      // Queue 2 for 1 hour each
      await players
        .connect(alice)
        .startActions(playerId, [queuedAction, queuedAction, queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);
      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan * 2.5]); // Finish 2 and a bit
      await ethers.provider.send("evm_mine", []);
      let pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);

      expect(pendingQueuedActionState.equipmentStates.length).to.eq(3);
      expect(pendingQueuedActionState.actionMetadatas.length).to.eq(3);
      expect(pendingQueuedActionState.equipmentStates[0].consumedItemTokenIds.length).to.eq(2);
      expect(pendingQueuedActionState.equipmentStates[0].consumedItemTokenIds[0]).to.eq(EstforConstants.ROPE);
      expect(pendingQueuedActionState.equipmentStates[0].consumedAmounts[0]).to.eq(1);
      expect(pendingQueuedActionState.equipmentStates[0].consumedItemTokenIds[1]).to.eq(EstforConstants.SAPPHIRE);
      expect(pendingQueuedActionState.equipmentStates[0].consumedAmounts[1]).to.eq(20);
      expect(pendingQueuedActionState.equipmentStates[1].consumedItemTokenIds.length).to.eq(2);
      expect(pendingQueuedActionState.equipmentStates[1].consumedItemTokenIds[0]).to.eq(EstforConstants.ROPE);
      expect(pendingQueuedActionState.equipmentStates[1].consumedAmounts[0]).to.eq(1);
      expect(pendingQueuedActionState.equipmentStates[1].consumedItemTokenIds[1]).to.eq(EstforConstants.SAPPHIRE);
      expect(pendingQueuedActionState.equipmentStates[1].consumedAmounts[1]).to.eq(20);
      expect(pendingQueuedActionState.equipmentStates[2].consumedItemTokenIds.length).to.eq(0);

      expect(pendingQueuedActionState.equipmentStates[0].producedItemTokenIds.length).to.eq(1);
      expect(pendingQueuedActionState.equipmentStates[0].producedItemTokenIds[0]).to.eq(
        EstforConstants.SAPPHIRE_AMULET
      );
      expect(pendingQueuedActionState.equipmentStates[0].producedAmounts[0]).to.eq(1);
      expect(pendingQueuedActionState.equipmentStates[1].producedItemTokenIds.length).to.eq(1);
      expect(pendingQueuedActionState.equipmentStates[1].producedItemTokenIds[0]).to.eq(
        EstforConstants.SAPPHIRE_AMULET
      );
      expect(pendingQueuedActionState.equipmentStates[1].producedAmounts[0]).to.eq(1);
      expect(pendingQueuedActionState.equipmentStates[2].producedItemTokenIds.length).to.eq(0);

      expect(pendingQueuedActionState.actionMetadatas[0].actionId).to.eq(1);
      expect(pendingQueuedActionState.actionMetadatas[0].queueId).to.eq(1);
      expect(pendingQueuedActionState.actionMetadatas[0].elapsedTime).to.eq(3600);
      expect(pendingQueuedActionState.actionMetadatas[1].actionId).to.eq(1);
      expect(pendingQueuedActionState.actionMetadatas[1].queueId).to.eq(2);
      expect(pendingQueuedActionState.actionMetadatas[1].elapsedTime).to.eq(3600);
      expect(pendingQueuedActionState.actionMetadatas[2].actionId).to.eq(1);
      expect(pendingQueuedActionState.actionMetadatas[2].queueId).to.eq(3);
      expect(pendingQueuedActionState.actionMetadatas[2].elapsedTime).to.be.oneOf([1800n, 1801n]);

      await players.connect(alice).processActions(playerId);
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.CRAFTING)).to.eq(7200);
      // Check the inputs/output are as expected
      expect(await itemNFT.balanceOf(alice, EstforConstants.SAPPHIRE)).to.eq(20);
      expect(await itemNFT.balanceOf(alice, EstforConstants.ROPE)).to.eq(1);
      expect(await itemNFT.balanceOf(alice, EstforConstants.SAPPHIRE_AMULET)).to.eq(2);

      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan * 0.5]); // Finish 2 and a bit
      await ethers.provider.send("evm_mine", []);
      pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);

      expect(pendingQueuedActionState.equipmentStates.length).to.eq(1);
      expect(pendingQueuedActionState.actionMetadatas.length).to.eq(1);
      expect(pendingQueuedActionState.equipmentStates[0].consumedItemTokenIds.length).to.eq(2);
      expect(pendingQueuedActionState.equipmentStates[0].consumedItemTokenIds[0]).to.eq(EstforConstants.ROPE);
      expect(pendingQueuedActionState.equipmentStates[0].consumedAmounts[0]).to.eq(1);
      expect(pendingQueuedActionState.equipmentStates[0].consumedItemTokenIds[1]).to.eq(EstforConstants.SAPPHIRE);
      expect(pendingQueuedActionState.equipmentStates[0].consumedAmounts[1]).to.eq(20);
      expect(pendingQueuedActionState.equipmentStates[0].producedItemTokenIds.length).to.eq(1);
      expect(pendingQueuedActionState.equipmentStates[0].producedItemTokenIds[0]).to.eq(
        EstforConstants.SAPPHIRE_AMULET
      );
      expect(pendingQueuedActionState.equipmentStates[0].producedAmounts[0]).to.eq(1);
      expect(pendingQueuedActionState.actionMetadatas[0].actionId).to.eq(1);
      expect(pendingQueuedActionState.actionMetadatas[0].queueId).to.eq(3);
      expect(pendingQueuedActionState.actionMetadatas[0].elapsedTime).to.be.oneOf([
        BigInt(Math.floor(Number(queuedAction.timespan) * 0.5)),
        BigInt(Math.floor(Number(queuedAction.timespan) * 0.5 - 1)),
        BigInt(Math.floor(Number(queuedAction.timespan) * 0.5 - 2))
      ]);

      await players.connect(alice).processActions(playerId);
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.CRAFTING)).to.eq(3600 * 3);
      // Check the inputs/output are as expected
      expect(await itemNFT.balanceOf(alice, EstforConstants.SAPPHIRE)).to.eq(0);
      expect(await itemNFT.balanceOf(alice, EstforConstants.ROPE)).to.eq(0);
      expect(await itemNFT.balanceOf(alice, EstforConstants.SAPPHIRE_AMULET)).to.eq(3);
    });

    it("Craft, multiple output num", async function () {
      // Only get XP for the ones you did complete
      const {players, alice, playerId, itemNFT, worldActions} = await loadFixture(crafingFixture);
      const rate = 1 * RATE_MUL;
      const outputAmount = 3;
      const {queuedAction: queuedActionCrafting} = await setupBasicCrafting(itemNFT, worldActions, rate, outputAmount);
      const queuedAction = {...queuedActionCrafting, timespan: 7200};

      // Don't enough enough rope (needs 2)
      await itemNFT.mintBatch(alice, [EstforConstants.SAPPHIRE, EstforConstants.ROPE], [41, 3]);

      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);
      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]);
      await ethers.provider.send("evm_mine", []);
      let pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);

      const xpGained = 7200;
      checkPendingQueuedActionState(
        pendingQueuedActionState,
        [
          {itemTokenId: EstforConstants.ROPE, amount: 2},
          {itemTokenId: EstforConstants.SAPPHIRE, amount: 40}
        ],
        [{itemTokenId: EstforConstants.SAPPHIRE_AMULET, amount: outputAmount * 2}],
        xpGained,
        7200n
      );

      await players.connect(alice).processActions(playerId);
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.CRAFTING)).to.eq(xpGained);
      // Check the inputs/output are as expected
      expect(await itemNFT.balanceOf(alice, EstforConstants.SAPPHIRE)).to.eq(1);
      expect(await itemNFT.balanceOf(alice, EstforConstants.ROPE)).to.eq(1);
      expect(await itemNFT.balanceOf(alice, EstforConstants.SAPPHIRE_AMULET)).to.eq(outputAmount * 2);
    });
  });

  // Very similar to crafting
  describe("Alchemy", function () {
    it("Finish 1 item", async function () {
      const {playerId, players, itemNFT, worldActions, alice} = await loadFixture(playersFixture);

      const {queuedAction, rate} = await setupBasicAlchemy(itemNFT, worldActions);
      expect(queuedAction.timespan).to.not.eq(0);

      const startingAmount = 200;
      await itemNFT.mintBatch(
        alice,
        [EstforConstants.SHADOW_SCROLL, EstforConstants.NATURE_SCROLL, EstforConstants.PAPER],
        [startingAmount, startingAmount, startingAmount]
      );

      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);

      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan + 2]);
      await ethers.provider.send("evm_mine", []);
      await players.connect(alice).processActions(playerId);
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.ALCHEMY)).to.eq(queuedAction.timespan);
      // Check the inputs/output are as expected
      expect(await itemNFT.balanceOf(alice, EstforConstants.SHADOW_SCROLL)).to.eq(
        startingAmount - Math.floor((queuedAction.timespan * rate) / (3600 * RATE_MUL))
      );
      expect(await itemNFT.balanceOf(alice, EstforConstants.NATURE_SCROLL)).to.eq(
        startingAmount - Math.floor((queuedAction.timespan * rate) / (3600 * RATE_MUL))
      );
      expect(await itemNFT.balanceOf(alice, EstforConstants.PAPER)).to.eq(
        startingAmount - Math.floor((queuedAction.timespan * rate * 2) / (3600 * RATE_MUL))
      );
      expect(await itemNFT.balanceOf(alice, EstforConstants.ANCIENT_SCROLL)).to.eq(
        Math.floor((queuedAction.timespan * rate) / (3600 * RATE_MUL))
      );
    });
  });

  // This test checks a bug found by Chopps where doing 24 hours of alchemizing enhanted logs was pruning the output
  it("Output amount is greater than 65535 should work", async function () {
    const {playerId, players, itemNFT, worldActions, alice} = await loadFixture(playersFixture);

    const outputAmount = 255;
    const rate = 300 * RATE_MUL;
    const {queuedAction} = await setupBasicAlchemy(itemNFT, worldActions, rate, outputAmount);
    expect(queuedAction.timespan).to.not.eq(0);

    const startingAmount = 1000000;
    await itemNFT.mintBatch(
      alice,
      [EstforConstants.SHADOW_SCROLL, EstforConstants.NATURE_SCROLL, EstforConstants.PAPER],
      [startingAmount, startingAmount, startingAmount]
    );

    await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);

    await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]);
    await ethers.provider.send("evm_mine", []);
    await players.connect(alice).processActions(playerId);
    expect(await players.getPlayerXP(playerId, EstforTypes.Skill.ALCHEMY)).to.eq(queuedAction.timespan);

    // Check the inputs/output are as expected
    expect(await itemNFT.balanceOf(alice, EstforConstants.SHADOW_SCROLL)).to.eq(
      startingAmount - Math.floor((queuedAction.timespan * rate) / (3600 * RATE_MUL))
    );
    expect(await itemNFT.balanceOf(alice, EstforConstants.NATURE_SCROLL)).to.eq(
      startingAmount - Math.floor((queuedAction.timespan * rate) / (3600 * RATE_MUL))
    );
    expect(await itemNFT.balanceOf(alice, EstforConstants.PAPER)).to.eq(
      startingAmount - Math.floor((queuedAction.timespan * rate * 2) / (3600 * RATE_MUL))
    );
    const outputBalance = await itemNFT.balanceOf(alice, EstforConstants.ANCIENT_SCROLL);
    expect(outputBalance).to.eq(Math.floor((queuedAction.timespan * rate * outputAmount) / (3600 * RATE_MUL)));
    expect(outputBalance).to.be.greaterThan(65535);
  });

  // Very similar to crafting
  describe("Fletching", function () {
    it("Finish 1 item", async function () {
      const {playerId, players, itemNFT, worldActions, alice} = await loadFixture(playersFixture);

      const {queuedAction, rate} = await setupBasicFletching(itemNFT, worldActions);
      expect(queuedAction.timespan).to.not.eq(0);

      const startingAmount = 200;
      await itemNFT.mintBatch(
        alice,
        [EstforConstants.BRONZE_ARROW_HEAD, EstforConstants.ARROW_SHAFT, EstforConstants.FEATHER],
        [startingAmount, startingAmount, startingAmount]
      );

      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);

      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan + 2]);
      await ethers.provider.send("evm_mine", []);
      await players.connect(alice).processActions(playerId);
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.FLETCHING)).to.eq(queuedAction.timespan);
      // Check the inputs/output are as expected
      expect(await itemNFT.balanceOf(alice, EstforConstants.BRONZE_ARROW_HEAD)).to.eq(
        startingAmount - Math.floor((queuedAction.timespan * rate) / (3600 * RATE_MUL))
      );
      expect(await itemNFT.balanceOf(alice, EstforConstants.ARROW_SHAFT)).to.eq(
        startingAmount - Math.floor((queuedAction.timespan * rate) / (3600 * RATE_MUL))
      );
      expect(await itemNFT.balanceOf(alice, EstforConstants.FEATHER)).to.eq(
        startingAmount - Math.floor((queuedAction.timespan * rate * 2) / (3600 * RATE_MUL))
      );
      expect(await itemNFT.balanceOf(alice, EstforConstants.BRONZE_ARROW)).to.eq(
        Math.floor((queuedAction.timespan * rate) / (3600 * RATE_MUL))
      );
    });
  });

  // Very similar to crafting for the skill, but liquidaion is handled differently in InstantActions
  describe("Forging", function () {
    it("Finish 1 item", async function () {
      const {playerId, players, itemNFT, worldActions, alice} = await loadFixture(playersFixture);

      const {queuedAction, rate} = await setupBasicForging(itemNFT, worldActions);
      expect(queuedAction.timespan).to.not.eq(0);

      const startingAmount = 200;
      await itemNFT.mintBatch(
        alice,
        [EstforConstants.BRONZE_ARROW_HEAD, EstforConstants.ARROW_SHAFT, EstforConstants.FEATHER],
        [startingAmount, startingAmount, startingAmount]
      );

      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);

      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan + 2]);
      await ethers.provider.send("evm_mine", []);
      await players.connect(alice).processActions(playerId);
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.FORGING)).to.eq(queuedAction.timespan);
      // Check the inputs/output are as expected
      expect(await itemNFT.balanceOf(alice, EstforConstants.BRONZE_ARROW_HEAD)).to.eq(
        startingAmount - Math.floor((queuedAction.timespan * rate) / (3600 * RATE_MUL))
      );
      expect(await itemNFT.balanceOf(alice, EstforConstants.ARROW_SHAFT)).to.eq(
        startingAmount - Math.floor((queuedAction.timespan * rate) / (3600 * RATE_MUL))
      );
      expect(await itemNFT.balanceOf(alice, EstforConstants.FEATHER)).to.eq(
        startingAmount - Math.floor((queuedAction.timespan * rate * 2) / (3600 * RATE_MUL))
      );
      expect(await itemNFT.balanceOf(alice, EstforConstants.BRONZE_ARROW)).to.eq(
        Math.floor((queuedAction.timespan * rate) / (3600 * RATE_MUL))
      );
    });
  });

  // Very similar to crafting, but has very long actions (8 hours long)
  describe("Farming", function () {
    it("Finish 1 item", async function () {
      const {playerId, players, itemNFT, worldActions, alice} = await loadFixture(playersFixture);

      const {queuedAction, rate} = await setupBasicFarming(itemNFT, worldActions);
      expect(queuedAction.timespan).to.not.eq(0);

      const startingAmount = 200;
      await itemNFT.mintBatch(
        alice,
        [EstforConstants.PLOT_001_SMALL, EstforConstants.SEED_001_WILD],
        [startingAmount, startingAmount]
      );

      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);

      expect(queuedAction.timespan).to.eq(8 * 3600); // 8 hours
      await timeTravel(queuedAction.timespan - 10);
      await players.connect(alice).processActions(playerId);
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.FARMING)).to.eq(0);
      await timeTravel(10);
      await players.connect(alice).processActions(playerId);
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.FARMING)).to.eq(queuedAction.timespan);

      // Check the inputs/output are as expected
      expect(await itemNFT.balanceOf(alice, EstforConstants.PLOT_001_SMALL)).to.eq(
        startingAmount - Math.floor((queuedAction.timespan * rate) / (3600 * RATE_MUL))
      );
      expect(await itemNFT.balanceOf(alice, EstforConstants.SEED_001_WILD)).to.eq(
        startingAmount - Math.floor((queuedAction.timespan * rate) / (3600 * RATE_MUL)) * 20
      );
      expect(await itemNFT.balanceOf(alice, EstforConstants.SEED_001_WILD_HARVESTABLE)).to.eq(
        Math.floor((queuedAction.timespan * rate) / (3600 * RATE_MUL)) * 13
      );
    });
  });

  it("Set past max timespan", async function () {
    const {playerId, players, itemNFT, worldActions, alice, maxTime} = await loadFixture(playersFixture);

    const {queuedAction: basicWoodcuttingQueuedAction, rate} = await setupBasicWoodcutting(itemNFT, worldActions);

    const timespan = maxTime + 1n; // Exceed maximum
    const queuedAction = {...basicWoodcuttingQueuedAction};
    queuedAction.timespan = timespan;

    await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);

    await ethers.provider.send("evm_increaseTime", [Number(queuedAction.timespan) + 2]);
    await ethers.provider.send("evm_mine", []);
    await players.connect(alice).processActions(playerId);
    expect(await players.getPlayerXP(playerId, EstforTypes.Skill.WOODCUTTING)).to.eq(
      BigInt(Number(queuedAction.timespan) - 1)
    );
    // Check the drops are as expected
    expect(await itemNFT.balanceOf(alice, EstforConstants.LOG)).to.eq(
      BigInt(Math.floor(((Number(queuedAction.timespan) - 1) * rate) / (3600 * GUAR_MUL)))
    );
  });

  it("Check refund time for actions", async function () {
    const {playerId, players, itemNFT, worldActions, alice} = await loadFixture(playersFixture);

    const rate = 2 * GUAR_MUL;
    const {queuedAction} = await setupBasicWoodcutting(itemNFT, worldActions, rate);

    await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);
    await ethers.provider.send("evm_increaseTime", [(queuedAction.timespan / 4) * 3]);
    await ethers.provider.send("evm_mine", []);
    await players.connect(alice).processActions(playerId);
    expect(await players.getPlayerXP(playerId, EstforTypes.Skill.WOODCUTTING)).to.eq(queuedAction.timespan / 2);
    await ethers.provider.send("evm_increaseTime", [queuedAction.timespan / 4]);
    await ethers.provider.send("evm_mine", []);
    await players.connect(alice).processActions(playerId);
    expect(await players.getPlayerXP(playerId, EstforTypes.Skill.WOODCUTTING)).to.eq(queuedAction.timespan);
    // Check the drops are as expected
    expect(await itemNFT.balanceOf(alice, EstforConstants.LOG)).to.eq(
      Math.floor((queuedAction.timespan * rate) / (3600 * GUAR_MUL))
    );
  });

  // TODO Rest of the actions

  it("Low rate action (more than 1 hour needed)", async function () {
    const {playerId, players, itemNFT, worldActions, alice} = await loadFixture(playersFixture);
    await itemNFT.addItems([
      {
        ...EstforTypes.defaultItemInput,
        tokenId: EstforConstants.BRONZE_AXE,
        equipPosition: EstforTypes.EquipPosition.RIGHT_HAND
      }
    ]);

    const rate = 0.1 * GUAR_MUL; // 0.1 per hour
    const tx = await worldActions.addActions([
      {
        actionId: 1,
        info: {
          skill: EstforTypes.Skill.WOODCUTTING,
          xpPerHour: 3600,
          minXP: 0,
          worldLocation: 0,
          isFullModeOnly: false,
          numSpawned: 0,
          handItemTokenIdRangeMin: EstforConstants.WOODCUTTING_BASE,
          handItemTokenIdRangeMax: EstforConstants.WOODCUTTING_MAX,
          isAvailable: actionIsAvailable,
          questPrerequisiteId: 0,
          actionChoiceRequired: false,
          successPercent: 100
        },
        guaranteedRewards: [{itemTokenId: EstforConstants.LOG, rate}],
        randomRewards: [],
        combatStats: EstforTypes.emptyCombatStats
      }
    ]);

    const actionId = await getActionId(tx, worldActions);
    const timespan = 3600 * 19; // Should make 1
    const queuedAction: EstforTypes.QueuedActionInput = {
      attire: EstforTypes.noAttire,
      actionId,
      combatStyle: EstforTypes.CombatStyle.NONE,
      choiceId: EstforConstants.NONE,
      regenerateId: EstforConstants.NONE,
      timespan,
      rightHandEquipmentTokenId: EstforConstants.BRONZE_AXE,
      leftHandEquipmentTokenId: EstforConstants.NONE,
      petId: EstforConstants.NONE
    };

    await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);
    await ethers.provider.send("evm_increaseTime", [timespan]);
    await ethers.provider.send("evm_mine", []);
    await players.connect(alice).processActions(playerId);
    //      expect(await players.getPlayerXP(playerId,EstforTypes.Skill.WOODCUTTING)).to.be.oneOf([361, 362]);
    expect(await itemNFT.balanceOf(alice, EstforConstants.LOG)).to.eq(1); // Should be rounded down
  });

  it("Incorrect left/right hand equipment", async function () {
    const {playerId, players, itemNFT, worldActions, alice, owner} = await loadFixture(playersFixture);

    const {queuedAction: basicWoodcuttingAction} = await setupBasicWoodcutting(itemNFT, worldActions);
    const queuedAction = {...basicWoodcuttingAction};
    queuedAction.rightHandEquipmentTokenId = EstforConstants.BRONZE_PICKAXE; // Incorrect
    await itemNFT.addItems([
      {
        ...EstforTypes.defaultItemInput,
        tokenId: EstforConstants.BRONZE_PICKAXE,
        equipPosition: EstforTypes.EquipPosition.RIGHT_HAND
      }
    ]);

    await expect(
      players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE)
    ).to.be.revertedWithCustomError(players, "InvalidHandEquipment");

    queuedAction.leftHandEquipmentTokenId = EstforConstants.BRONZE_AXE;
    queuedAction.rightHandEquipmentTokenId = EstforConstants.NONE;
    await expect(
      players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE)
    ).to.be.revertedWithCustomError(players, "IncorrectEquippedItem");

    queuedAction.rightHandEquipmentTokenId = EstforConstants.BRONZE_AXE;
    await expect(
      players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE)
    ).to.be.revertedWithCustomError(players, "IncorrectLeftHandEquipment");

    queuedAction.leftHandEquipmentTokenId = EstforConstants.NONE;

    // Now this works
    await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);

    // Transfer away, the action should just be skipped and no xp/loot should be given
    expect(await itemNFT.balanceOf(alice, EstforConstants.BRONZE_AXE)).to.eq(1);
    await itemNFT.connect(alice).safeTransferFrom(alice, owner, EstforConstants.BRONZE_AXE, 1, "0x");
    expect(await itemNFT.balanceOf(alice, EstforConstants.BRONZE_AXE)).to.eq(0);
    await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]);
    await ethers.provider.send("evm_mine", []);
    await players.connect(alice).processActions(playerId);
    expect(await players.getPlayerXP(playerId, EstforTypes.Skill.WOODCUTTING)).to.eq(0);
    expect(await itemNFT.balanceOf(alice, EstforConstants.LOG)).to.eq(0);
  });

  it("Action pipelining", async function () {
    // Try wood cut, and then burning them when having none equipped
  });
});
