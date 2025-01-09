import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {EstforTypes, EstforConstants} from "@paintswap/estfor-definitions";
import {Skill} from "@paintswap/estfor-definitions/types";
import {expect} from "chai";
import {ethers} from "hardhat";
import {createPlayer} from "../../scripts/utils";
import {getActionId, requestAndFulfillRandomWords, timeTravel} from "../utils";
import {playersFixture} from "./PlayersFixture";
import {
  getPlayersHelper,
  setupBasicFiremaking,
  setupBasicFishing,
  setupBasicMining,
  setupBasicWoodcutting
} from "./utils";
import {GUAR_MUL} from "@paintswap/estfor-definitions/constants";
import {Block} from "ethers";
import {allFullAttireBonuses} from "../../scripts/data/fullAttireBonuses";
import {FullAttireBonusInputStruct} from "../../typechain-types/contracts/Players/Players";

const actionIsAvailable = true;

describe("Checkpoints", function () {
  it("Checkpoints should be cleared when making a character inactive", async function () {
    const {players, playerId, itemNFT, playerNFT, avatarId, worldActions, alice} = await loadFixture(playersFixture);
    const {queuedAction} = await setupBasicWoodcutting(itemNFT, worldActions);
    await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);

    // Check checkpoints
    let activePlayerInfo = await players.getActivePlayerInfo(alice.address);
    expect(activePlayerInfo.checkpoint).to.be.gt(0);
    // Make a new player active, checkpoint should be cleared
    await createPlayer(playerNFT, avatarId, alice, "New name", true);
    activePlayerInfo = await players.getActivePlayerInfo(alice.address);
    expect(activePlayerInfo.checkpoint).to.eq(0);
  });

  describe("Right hand equipment", function () {
    it("Transfer away required equipment after action starts but before ends should invalidate it entirely", async function () {
      const {playerId, players, itemNFT, worldActions, alice, owner} = await loadFixture(playersFixture);

      const {queuedAction} = await setupBasicWoodcutting(itemNFT, worldActions);
      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);

      let checkpointEquipments = await (await getPlayersHelper(players)).getCheckpointEquipments(playerId);
      expect(checkpointEquipments[0].itemTokenIds[9]).to.eq(EstforConstants.BRONZE_AXE);
      expect(checkpointEquipments[0].balances[9]).to.eq(1);

      await itemNFT.connect(alice).safeTransferFrom(alice.address, owner.address, EstforConstants.BRONZE_AXE, 1, "0x");
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.BRONZE_AXE)).to.eq(0);
      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]);
      await itemNFT.mint(alice.address, EstforConstants.BRONZE_AXE, 1); // Minting this should have no effect
      checkpointEquipments = await (await getPlayersHelper(players)).getCheckpointEquipments(playerId);
      expect(checkpointEquipments[0].itemTokenIds[9]).to.eq(EstforConstants.BRONZE_AXE);
      expect(checkpointEquipments[0].balances[9]).to.eq(0);
      await players.connect(alice).processActions(playerId);
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.WOODCUTTING)).to.eq(0);
    });

    it("Transfer away required equipment after processing an action, should invalidate the rest even if transferring back", async function () {
      const {playerId, players, itemNFT, worldActions, alice, owner} = await loadFixture(playersFixture);

      const {queuedAction} = await setupBasicWoodcutting(itemNFT, worldActions);
      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);

      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan / 2]);
      await players.connect(alice).processActions(playerId);
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.WOODCUTTING)).to.eq(queuedAction.timespan / 2);
      await itemNFT.connect(alice).safeTransferFrom(alice.address, owner.address, EstforConstants.BRONZE_AXE, 1, "0x");
      await itemNFT.mint(alice.address, EstforConstants.BRONZE_AXE, 1); // Minting this should have no effect for the rest of the action
      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan / 2]);
      await players.connect(alice).processActions(playerId);
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.WOODCUTTING)).to.eq(queuedAction.timespan / 2);
    });

    it("Transfer away required equipment before an action starts and back after an action starts should invalidate it all", async function () {
      const {playerId, players, itemNFT, worldActions, alice, owner} = await loadFixture(playersFixture);

      const {queuedAction} = await setupBasicWoodcutting(itemNFT, worldActions);
      await players
        .connect(alice)
        .startActions(playerId, [queuedAction, queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);

      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan - 2]); // Right before next action starts
      await players.connect(alice).processActions(playerId);
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.WOODCUTTING)).to.eq(
        queuedAction.timespan - queuedAction.timespan / 100
      );
      await itemNFT.connect(alice).safeTransferFrom(alice.address, owner.address, EstforConstants.BRONZE_AXE, 1, "0x");
      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan / 2]);
      await itemNFT.mint(alice.address, EstforConstants.BRONZE_AXE, 1); // Minting this should have no effect for the whole action
      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]);
      await players.connect(alice).processActions(playerId);
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.WOODCUTTING)).to.eq(
        queuedAction.timespan - queuedAction.timespan / 100
      );
    });

    it("Transfer away required equipment before an action starts and back before the action starts should be fine", async function () {
      const {playerId, players, itemNFT, worldActions, alice, owner} = await loadFixture(playersFixture);

      const {queuedAction} = await setupBasicWoodcutting(itemNFT, worldActions);
      await players
        .connect(alice)
        .startActions(playerId, [queuedAction, queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);

      let checkpointEquipments = await (await getPlayersHelper(players)).getCheckpointEquipments(playerId);
      expect(checkpointEquipments[0].itemTokenIds[9]).to.eq(EstforConstants.BRONZE_AXE);
      expect(checkpointEquipments[0].balances[9]).to.eq(1);

      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan - 3]); // Right before next action starts
      await players.connect(alice).processActions(playerId);
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.WOODCUTTING)).to.eq(
        queuedAction.timespan - queuedAction.timespan / 100
      );
      await itemNFT.connect(alice).safeTransferFrom(alice, owner.address, EstforConstants.BRONZE_AXE, 1, "0x");

      checkpointEquipments = await (await getPlayersHelper(players)).getCheckpointEquipments(playerId);
      expect(checkpointEquipments[0].itemTokenIds[9]).to.eq(EstforConstants.BRONZE_AXE);
      expect(checkpointEquipments[0].balances[9]).to.eq(0);
      expect(checkpointEquipments[1].itemTokenIds[9]).to.eq(EstforConstants.BRONZE_AXE);
      expect(checkpointEquipments[1].balances[9]).to.eq(0);

      await itemNFT.mint(alice, EstforConstants.BRONZE_AXE, 1); // Minting this fixes the action before it starts

      checkpointEquipments = await (await getPlayersHelper(players)).getCheckpointEquipments(playerId);
      expect(checkpointEquipments[0].itemTokenIds[9]).to.eq(EstforConstants.BRONZE_AXE);
      expect(checkpointEquipments[0].balances[9]).to.eq(0);
      expect(checkpointEquipments[1].itemTokenIds[9]).to.eq(EstforConstants.BRONZE_AXE);
      expect(checkpointEquipments[1].balances[9]).to.eq(1);

      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan + 3 + queuedAction.timespan]);
      await players.connect(alice).processActions(playerId);
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.WOODCUTTING)).to.eq(
        queuedAction.timespan - queuedAction.timespan / 100 + queuedAction.timespan
      );
    });

    it("Test multiple burning/transferring on a checkpoint", async function () {
      const {playerId, players, itemNFT, worldActions, alice, owner} = await loadFixture(playersFixture);

      const {queuedAction: queuedActionFiremaking} = await setupBasicFiremaking(itemNFT, worldActions);
      const {queuedAction} = await setupBasicWoodcutting(itemNFT, worldActions);

      await itemNFT.mint(alice.address, EstforConstants.BRONZE_AXE, 100); // Start with a ton more

      await players
        .connect(alice)
        .startActions(playerId, [queuedActionFiremaking, queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);

      await itemNFT.connect(alice).burn(alice.address, EstforConstants.BRONZE_AXE, 80);
      await itemNFT.connect(alice).burn(alice.address, EstforConstants.BRONZE_AXE, 5);
      await ethers.provider.send("evm_increaseTime", [queuedActionFiremaking.timespan / 2]);
      await players.connect(alice).processActions(playerId);

      await itemNFT.connect(alice).safeTransferFrom(alice.address, owner.address, EstforConstants.BRONZE_AXE, 5, "0x");
      await ethers.provider.send("evm_increaseTime", [queuedActionFiremaking.timespan / 4]);
      await itemNFT.connect(alice).burn(alice.address, EstforConstants.BRONZE_AXE, 5);
      await itemNFT.connect(alice).burn(alice.address, EstforConstants.BRONZE_AXE, 5);
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.BRONZE_AXE)).to.eq(1); // Have 1 left
      await ethers.provider.send("evm_increaseTime", [queuedActionFiremaking.timespan / 4 + queuedAction.timespan]); // Finish both actions
      await players.connect(alice).processActions(playerId);
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.WOODCUTTING)).to.eq(queuedAction.timespan);
    });

    it("Have more than 65535 and reduce it, before action starts", async function () {
      const {playerId, players, itemNFT, worldActions, alice, owner} = await loadFixture(playersFixture);

      const {queuedAction: queuedActionFiremaking} = await setupBasicFiremaking(itemNFT, worldActions);
      const {queuedAction} = await setupBasicWoodcutting(itemNFT, worldActions);

      await itemNFT.mint(alice.address, EstforConstants.BRONZE_AXE, 70000); // Start with a ton more
      await players
        .connect(alice)
        .startActions(playerId, [queuedActionFiremaking, queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);

      await ethers.provider.send("evm_increaseTime", [queuedActionFiremaking.timespan - 3]);

      await itemNFT
        .connect(alice)
        .safeTransferFrom(alice.address, owner.address, EstforConstants.BRONZE_AXE, 70000, "0x");
      await ethers.provider.send("evm_increaseTime", [3]);
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.BRONZE_AXE)).to.eq(1); // Have 1 left
      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]); // Finish both actions
      await players.connect(alice).processActions(playerId);
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.WOODCUTTING)).to.eq(queuedAction.timespan);
    });

    it("Have more than 65535 and reduce it while action is ongoing", async function () {
      const {playerId, players, itemNFT, worldActions, alice, owner} = await loadFixture(playersFixture);

      const {queuedAction} = await setupBasicWoodcutting(itemNFT, worldActions);

      await itemNFT.mint(alice.address, EstforConstants.BRONZE_AXE, 70000); // Start with a ton more
      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);

      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan / 2]);
      await itemNFT
        .connect(alice)
        .safeTransferFrom(alice.address, owner.address, EstforConstants.BRONZE_AXE, 40000, "0x");
      await itemNFT
        .connect(alice)
        .safeTransferFrom(alice.address, owner.address, EstforConstants.BRONZE_AXE, 29000, "0x");
      await itemNFT.connect(alice).burn(alice.address, EstforConstants.BRONZE_AXE, 999);
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.BRONZE_AXE)).to.eq(2); // Have 2 left
      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]); // Finish action
      await players.connect(alice).processActions(playerId);
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.WOODCUTTING)).to.eq(queuedAction.timespan);
    });
  });

  describe("Attire", function () {
    //
    it("Full attire bonus, checks removing attire", async function () {
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
        alice.address,
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

      await itemNFT.connect(alice).burn(alice.address, EstforConstants.NATURE_MASK, 1); // Remove a bit of the attire
      await itemNFT.mint(alice.address, EstforConstants.NATURE_MASK, 1); // Minting again does nothing
      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]);
      const balanceExpected = Math.floor((queuedAction.timespan * rate) / (3600 * GUAR_MUL));
      await players.connect(alice).processActions(playerId);
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.WOODCUTTING)).to.eq(queuedAction.timespan);
      // Check the drops are as expected
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.LOG)).to.eq(balanceExpected);
    });

    it("Pending reward full attire bonus", async function () {
      // Thieving
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
      await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);
      await ethers.provider.send("evm_increaseTime", [24 * 3600]);
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
          ring: EstforConstants.NONE, // Always NONE for now
          reserved1: EstforConstants.NONE // Always NONE for now
        },
        actionId,
        combatStyle: EstforTypes.CombatStyle.NONE,
        choiceId: EstforConstants.NONE,
        regenerateId: EstforConstants.NONE,
        timespan,
        rightHandEquipmentTokenId: EstforConstants.NONE,
        leftHandEquipmentTokenId: EstforConstants.NONE,
        petId: 0
      };

      await itemNFT.mintBatch(
        alice.address,
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
        await itemNFT.connect(alice).burn(alice.address, EstforConstants.NATUOW_HOOD, 1); // Remove a bit of the attire
        await itemNFT.mint(alice.address, EstforConstants.NATUOW_HOOD, 1); // Minting again does nothing
        await ethers.provider.send("evm_increaseTime", [24 * 3600]);
        await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);
        await players.connect(alice).processActions(playerId);
      }

      await ethers.provider.send("evm_increaseTime", [24 * 3600]);
      await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);
      await players.connect(alice).processActions(playerId);

      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.THIEVING)).to.eq(
        Math.floor(xpPerHour * numRepeats * numHours)
      ); // No bonus

      const balance = await itemNFT.balanceOf(alice.address, EstforConstants.BRONZE_ARROW);
      // Have 2 queued actions so twice as much
      expect(balance).to.eq(0); // Only a 1% chance of getting it as the bonus does not apply
    });
  });

  it("Output from 1 action should be allowed as the input to another", async function () {
    const {playerId, players, itemNFT, worldActions, alice} = await loadFixture(playersFixture);

    const {queuedAction} = await setupBasicWoodcutting(itemNFT, worldActions);
    const {queuedAction: queuedActionFiremaking} = await setupBasicFiremaking(itemNFT, worldActions);

    await players
      .connect(alice)
      .startActions(playerId, [queuedAction, queuedActionFiremaking], EstforTypes.ActionQueueStrategy.OVERWRITE);

    let checkpointEquipments = await (
      await ethers.getContractAt("IPlayersMisc1DelegateView", await players.getAddress())
    ).getCheckpointEquipments(playerId);
    expect(checkpointEquipments[0].itemTokenIds[9]).to.eq(EstforConstants.BRONZE_AXE);
    expect(checkpointEquipments[1].itemTokenIds[9]).to.eq(EstforConstants.MAGIC_FIRE_STARTER);

    await ethers.provider.send("evm_increaseTime", [queuedAction.timespan + queuedActionFiremaking.timespan / 2]);
    await players.connect(alice).processActions(playerId);

    checkpointEquipments = await (
      await ethers.getContractAt("IPlayersMisc1DelegateView", await players.getAddress())
    ).getCheckpointEquipments(playerId);
    expect(checkpointEquipments[0].itemTokenIds[9]).to.eq(EstforConstants.MAGIC_FIRE_STARTER);
    expect(checkpointEquipments[1].itemTokenIds[9]).to.eq(0);

    // TODO Read checkpoint balance
    await ethers.provider.send("evm_increaseTime", [queuedActionFiremaking.timespan / 2]);
    await players.connect(alice).processActions(playerId);
    expect(await players.getPlayerXP(playerId, EstforTypes.Skill.WOODCUTTING)).to.eq(queuedAction.timespan);
    expect(await players.getPlayerXP(playerId, EstforTypes.Skill.FIREMAKING)).to.eq(queuedActionFiremaking.timespan);
  });

  it("TODO: More checkpoint balance checks", async function () {});

  it("Output from 1 action should be allowed as the input to another, with no process in-between", async function () {
    const {playerId, players, itemNFT, worldActions, alice} = await loadFixture(playersFixture);

    const {queuedAction} = await setupBasicWoodcutting(itemNFT, worldActions);
    const {queuedAction: queuedActionFiremaking} = await setupBasicFiremaking(itemNFT, worldActions);

    await players
      .connect(alice)
      .startActions(playerId, [queuedAction, queuedActionFiremaking], EstforTypes.ActionQueueStrategy.OVERWRITE);

    await ethers.provider.send("evm_increaseTime", [queuedAction.timespan + queuedActionFiremaking.timespan]);
    await players.connect(alice).processActions(playerId);
    expect(await players.getPlayerXP(playerId, EstforTypes.Skill.WOODCUTTING)).to.eq(queuedAction.timespan);
    expect(await players.getPlayerXP(playerId, EstforTypes.Skill.FIREMAKING)).to.eq(queuedActionFiremaking.timespan);
  });

  it("Multiple checkpoints", async function () {
    const {playerId, players, itemNFT, worldActions, alice} = await loadFixture(playersFixture);

    const {queuedAction} = await setupBasicWoodcutting(itemNFT, worldActions);
    const queuedAction1 = {...queuedAction, timespan: queuedAction.timespan / 2};
    const queuedAction2 = {...queuedAction, timespan: queuedAction.timespan / 4};
    // 3 checkpoints
    await players
      .connect(alice)
      .startActions(playerId, [queuedAction, queuedAction1, queuedAction2], EstforTypes.ActionQueueStrategy.OVERWRITE);

    // Get current time
    const {timestamp: NOW} = (await ethers.provider.getBlock("latest")) as Block;
    let activePlayerInfo = await players.getActivePlayerInfo(alice.address);
    expect(activePlayerInfo.checkpoint).to.be.eq(NOW);
    expect(activePlayerInfo.timespan).to.eq(queuedAction.timespan);
    expect(activePlayerInfo.timespan1).to.eq(queuedAction1.timespan);
    expect(activePlayerInfo.timespan2).to.eq(queuedAction2.timespan);
    await players.connect(alice).processActions(playerId);
    activePlayerInfo = await players.getActivePlayerInfo(alice.address);
    expect(activePlayerInfo.checkpoint).to.be.eq(NOW);
    expect(activePlayerInfo.timespan).to.eq(queuedAction.timespan);
    expect(activePlayerInfo.timespan1).to.eq(queuedAction1.timespan);
    expect(activePlayerInfo.timespan2).to.eq(queuedAction2.timespan);
    await ethers.provider.send("evm_increaseTime", [queuedAction.timespan / 2]);
    await players.connect(alice).processActions(playerId);
    activePlayerInfo = await players.getActivePlayerInfo(alice.address);
    expect(activePlayerInfo.checkpoint).to.be.eq(NOW);
    expect(activePlayerInfo.timespan).to.eq(queuedAction.timespan);
    expect(activePlayerInfo.timespan1).to.eq(queuedAction1.timespan);
    expect(activePlayerInfo.timespan2).to.eq(queuedAction2.timespan);
    await ethers.provider.send("evm_increaseTime", [queuedAction.timespan / 2 + 2]);
    await players.connect(alice).processActions(playerId);
    activePlayerInfo = await players.getActivePlayerInfo(alice.address);
    expect(activePlayerInfo.checkpoint).to.be.eq(NOW + queuedAction.timespan);
    expect(activePlayerInfo.timespan).to.eq(queuedAction1.timespan);
    expect(activePlayerInfo.timespan1).to.eq(queuedAction2.timespan);
    expect(activePlayerInfo.timespan2).to.eq(queuedAction2.timespan); // Is left unchanged

    // Add one to the end
    await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.APPEND);
    activePlayerInfo = await players.getActivePlayerInfo(alice.address);
    expect(activePlayerInfo.checkpoint).to.be.eq(NOW + queuedAction.timespan);
    expect(activePlayerInfo.timespan).to.eq(queuedAction1.timespan);
    expect(activePlayerInfo.timespan1).to.eq(queuedAction2.timespan);
    expect(activePlayerInfo.timespan2).to.eq(queuedAction.timespan);

    await players
      .connect(alice)
      .startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.KEEP_LAST_IN_PROGRESS);
    activePlayerInfo = await players.getActivePlayerInfo(alice.address);
    expect(activePlayerInfo.checkpoint).to.be.eq(NOW + queuedAction.timespan);
    expect(activePlayerInfo.timespan).to.eq(queuedAction1.timespan);
    expect(activePlayerInfo.timespan1).to.eq(queuedAction.timespan);
    expect(activePlayerInfo.timespan2).to.eq(queuedAction.timespan);

    // Replace whole thing
    await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);
    const {timestamp: NOW1} = (await ethers.provider.getBlock("latest")) as Block;
    activePlayerInfo = await players.getActivePlayerInfo(alice.address);
    expect(activePlayerInfo.checkpoint).to.be.eq(NOW1);
    expect(activePlayerInfo.timespan).to.eq(queuedAction.timespan);
    expect(activePlayerInfo.timespan1).to.eq(queuedAction.timespan);
    expect(activePlayerInfo.timespan2).to.eq(queuedAction.timespan);
  });

  it("Checkpoints should always start from the beginning of the first action regardless of it being in-progress", async function () {
    const {playerId, players, itemNFT, worldActions, alice} = await loadFixture(playersFixture);

    const {queuedAction} = await setupBasicWoodcutting(itemNFT, worldActions);
    await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);
    let activePlayerInfo = await players.getActivePlayerInfo(alice.address);
    expect(activePlayerInfo.checkpoint).to.be.gt(0);
    await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]);
    await players.connect(alice).processActions(playerId);
    // Check checkpoint time is the same
    expect((await players.getActivePlayerInfo(alice.address)).checkpoint).to.be.gt(activePlayerInfo.checkpoint);
  });

  it("2 actions start next one after first one", async function () {
    const {playerId, players, itemNFT, worldActions, alice} = await loadFixture(playersFixture);

    const {queuedAction: queuedActionFishing} = await setupBasicFishing(itemNFT, worldActions);
    const {queuedAction: queuedActionWoodcutting} = await setupBasicWoodcutting(itemNFT, worldActions);

    await players
      .connect(alice)
      .startActions(
        playerId,
        [queuedActionFishing, queuedActionWoodcutting],
        EstforTypes.ActionQueueStrategy.OVERWRITE
      );

    await timeTravel(queuedActionFishing.timespan + 2); // skip first one fully and a bit into next

    let checkpointEquipments = await (
      await ethers.getContractAt("IPlayersMisc1DelegateView", await players.getAddress())
    ).getCheckpointEquipments(playerId);
    expect(checkpointEquipments[0].itemTokenIds[9]).to.eq(EstforConstants.NET_STICK);
    expect(checkpointEquipments[1].itemTokenIds[9]).to.eq(EstforConstants.BRONZE_AXE);
    expect(checkpointEquipments[2].itemTokenIds[9]).to.eq(0);

    await players
      .connect(alice)
      .startActions(playerId, [queuedActionFishing], EstforTypes.ActionQueueStrategy.KEEP_LAST_IN_PROGRESS);

    checkpointEquipments = await (
      await ethers.getContractAt("IPlayersMisc1DelegateView", await players.getAddress())
    ).getCheckpointEquipments(playerId);
    expect(checkpointEquipments[0].itemTokenIds[9]).to.eq(EstforConstants.BRONZE_AXE);
    expect(checkpointEquipments[1].itemTokenIds[9]).to.eq(EstforConstants.NET_STICK);
    expect(checkpointEquipments[2].itemTokenIds[9]).to.eq(0);

    // This will overwrite the checkpoints for the 2nd action (wooductting) and give nothing (bug)
    await timeTravel(queuedActionWoodcutting.timespan);

    const pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
    expect(pendingQueuedActionState.equipmentStates.length).to.be.gt(0);
    expect(pendingQueuedActionState.equipmentStates[0].producedItemTokenIds.length).to.be.gt(0);
  });

  it("2 actions start next one exactly when first one finishes", async function () {
    const {playerId, players, itemNFT, worldActions, alice} = await loadFixture(playersFixture);

    const {queuedAction: queuedActionFishing} = await setupBasicFishing(itemNFT, worldActions);
    const {queuedAction: queuedActionWoodcutting} = await setupBasicWoodcutting(itemNFT, worldActions);

    // Mint another to test checkpoint balance
    await itemNFT.mint(alice, EstforConstants.BRONZE_AXE, 1);

    await players
      .connect(alice)
      .startActions(
        playerId,
        [queuedActionFishing, queuedActionWoodcutting],
        EstforTypes.ActionQueueStrategy.OVERWRITE
      );

    await timeTravel(queuedActionFishing.timespan); // skip first one fully and next one starts on the dot of the next

    expect(await itemNFT.balanceOf(alice, EstforConstants.NET_STICK)).to.eq(1);
    expect(await itemNFT.balanceOf(alice, EstforConstants.BRONZE_AXE)).to.eq(2);

    let checkpointEquipments = await (
      await ethers.getContractAt("IPlayersMisc1DelegateView", await players.getAddress())
    ).getCheckpointEquipments(playerId);
    expect(checkpointEquipments[0].itemTokenIds[9]).to.eq(EstforConstants.NET_STICK);
    expect(checkpointEquipments[0].balances[9]).to.eq(1);
    expect(checkpointEquipments[1].itemTokenIds[9]).to.eq(EstforConstants.BRONZE_AXE);
    expect(checkpointEquipments[1].balances[9]).to.eq(2);
    expect(checkpointEquipments[2].itemTokenIds[9]).to.eq(0);
    expect(checkpointEquipments[2].balances[9]).to.eq(0);

    await players
      .connect(alice)
      .startActions(playerId, [queuedActionFishing], EstforTypes.ActionQueueStrategy.KEEP_LAST_IN_PROGRESS);

    checkpointEquipments = await (
      await ethers.getContractAt("IPlayersMisc1DelegateView", await players.getAddress())
    ).getCheckpointEquipments(playerId);
    expect(checkpointEquipments[0].itemTokenIds[9]).to.eq(EstforConstants.BRONZE_AXE);
    expect(checkpointEquipments[0].balances[9]).to.eq(2);
    expect(checkpointEquipments[1].itemTokenIds[9]).to.eq(EstforConstants.NET_STICK);
    expect(checkpointEquipments[1].balances[9]).to.eq(1);
    expect(checkpointEquipments[2].itemTokenIds[9]).to.eq(0);
    expect(checkpointEquipments[2].balances[9]).to.eq(0);

    // This will overwrite the checkpoints for the 2nd action (wooductting) and give nothing (bug)
    await timeTravel(queuedActionWoodcutting.timespan);

    const pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
    expect(pendingQueuedActionState.equipmentStates.length).to.be.gt(0);
    expect(pendingQueuedActionState.equipmentStates[0].producedItemTokenIds.length).to.be.gt(0);
  });

  it("3 actions start next one after first one, keep last in progress", async function () {
    const {playerId, players, itemNFT, worldActions, alice} = await loadFixture(playersFixture);

    const {queuedAction: queuedActionFishing} = await setupBasicFishing(itemNFT, worldActions);
    const {queuedAction: queuedActionWoodcutting} = await setupBasicWoodcutting(itemNFT, worldActions);
    const {queuedAction: queuedActionMining} = await setupBasicMining(itemNFT, worldActions);

    await players
      .connect(alice)
      .startActions(
        playerId,
        [queuedActionFishing, queuedActionWoodcutting, queuedActionMining],
        EstforTypes.ActionQueueStrategy.OVERWRITE
      );

    await timeTravel(queuedActionFishing.timespan + 2); // skip first one fully and a bit into next

    let checkpointEquipments = await (
      await ethers.getContractAt("IPlayersMisc1DelegateView", await players.getAddress())
    ).getCheckpointEquipments(playerId);
    expect(checkpointEquipments[0].itemTokenIds[9]).to.eq(EstforConstants.NET_STICK);
    expect(checkpointEquipments[1].itemTokenIds[9]).to.eq(EstforConstants.BRONZE_AXE);
    expect(checkpointEquipments[2].itemTokenIds[9]).to.eq(EstforConstants.BRONZE_PICKAXE);

    await players
      .connect(alice)
      .startActions(
        playerId,
        [queuedActionMining, queuedActionFishing],
        EstforTypes.ActionQueueStrategy.KEEP_LAST_IN_PROGRESS
      );

    checkpointEquipments = await (
      await ethers.getContractAt("IPlayersMisc1DelegateView", await players.getAddress())
    ).getCheckpointEquipments(playerId);
    expect(checkpointEquipments[0].itemTokenIds[9]).to.eq(EstforConstants.BRONZE_AXE);
    expect(checkpointEquipments[1].itemTokenIds[9]).to.eq(EstforConstants.BRONZE_PICKAXE);
    expect(checkpointEquipments[2].itemTokenIds[9]).to.eq(EstforConstants.NET_STICK);

    // This will overwrite the checkpoints for the 2nd action (wooductting) and give nothing (bug)
    await timeTravel(queuedActionWoodcutting.timespan);

    const pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
    expect(pendingQueuedActionState.equipmentStates.length).to.be.gt(0);
    expect(pendingQueuedActionState.equipmentStates[0].producedItemTokenIds.length).to.be.gt(0);
  });

  it("3 actions start next one exactly when first one finishes, keep last in progress", async function () {
    const {playerId, players, itemNFT, worldActions, alice} = await loadFixture(playersFixture);

    const {queuedAction: queuedActionFishing} = await setupBasicFishing(itemNFT, worldActions);
    const {queuedAction: queuedActionWoodcutting} = await setupBasicWoodcutting(itemNFT, worldActions);
    const {queuedAction: queuedActionMining} = await setupBasicMining(itemNFT, worldActions);

    await players
      .connect(alice)
      .startActions(
        playerId,
        [queuedActionFishing, queuedActionWoodcutting, queuedActionMining],
        EstforTypes.ActionQueueStrategy.OVERWRITE
      );

    await timeTravel(queuedActionFishing.timespan); // skip first one fully and next one starts on the dot of the next

    let checkpointEquipments = await (
      await ethers.getContractAt("IPlayersMisc1DelegateView", await players.getAddress())
    ).getCheckpointEquipments(playerId);
    expect(checkpointEquipments[0].itemTokenIds[9]).to.eq(EstforConstants.NET_STICK);
    expect(checkpointEquipments[1].itemTokenIds[9]).to.eq(EstforConstants.BRONZE_AXE);
    expect(checkpointEquipments[2].itemTokenIds[9]).to.eq(EstforConstants.BRONZE_PICKAXE);

    await players
      .connect(alice)
      .startActions(
        playerId,
        [queuedActionMining, queuedActionFishing],
        EstforTypes.ActionQueueStrategy.KEEP_LAST_IN_PROGRESS
      );

    checkpointEquipments = await (
      await ethers.getContractAt("IPlayersMisc1DelegateView", await players.getAddress())
    ).getCheckpointEquipments(playerId);
    expect(checkpointEquipments[0].itemTokenIds[9]).to.eq(EstforConstants.BRONZE_AXE);
    expect(checkpointEquipments[1].itemTokenIds[9]).to.eq(EstforConstants.BRONZE_PICKAXE);
    expect(checkpointEquipments[2].itemTokenIds[9]).to.eq(EstforConstants.NET_STICK);

    // This will overwrite the checkpoints for the 2nd action (wooductting) and give nothing (bug)
    await timeTravel(queuedActionWoodcutting.timespan);

    const pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
    expect(pendingQueuedActionState.equipmentStates.length).to.be.gt(0);
    expect(pendingQueuedActionState.equipmentStates[0].producedItemTokenIds.length).to.be.gt(0);
  });

  it("3 actions start next one after second one, keep last in progress", async function () {
    const {playerId, players, itemNFT, worldActions, alice} = await loadFixture(playersFixture);

    const {queuedAction: queuedActionFishing} = await setupBasicFishing(itemNFT, worldActions);
    const {queuedAction: queuedActionWoodcutting} = await setupBasicWoodcutting(itemNFT, worldActions);
    const {queuedAction: queuedActionMining} = await setupBasicMining(itemNFT, worldActions);

    await players
      .connect(alice)
      .startActions(
        playerId,
        [queuedActionFishing, queuedActionWoodcutting, queuedActionMining],
        EstforTypes.ActionQueueStrategy.OVERWRITE
      );

    await timeTravel(queuedActionFishing.timespan + queuedActionWoodcutting.timespan + 2); // skip first one fully and a bit into next

    let checkpointEquipments = await (
      await ethers.getContractAt("IPlayersMisc1DelegateView", await players.getAddress())
    ).getCheckpointEquipments(playerId);
    expect(checkpointEquipments[0].itemTokenIds[9]).to.eq(EstforConstants.NET_STICK);
    expect(checkpointEquipments[1].itemTokenIds[9]).to.eq(EstforConstants.BRONZE_AXE);
    expect(checkpointEquipments[2].itemTokenIds[9]).to.eq(EstforConstants.BRONZE_PICKAXE);

    await players
      .connect(alice)
      .startActions(
        playerId,
        [queuedActionFishing, queuedActionWoodcutting],
        EstforTypes.ActionQueueStrategy.KEEP_LAST_IN_PROGRESS
      );

    checkpointEquipments = await (
      await ethers.getContractAt("IPlayersMisc1DelegateView", await players.getAddress())
    ).getCheckpointEquipments(playerId);
    expect(checkpointEquipments[0].itemTokenIds[9]).to.eq(EstforConstants.BRONZE_PICKAXE);
    expect(checkpointEquipments[1].itemTokenIds[9]).to.eq(EstforConstants.NET_STICK);
    expect(checkpointEquipments[2].itemTokenIds[9]).to.eq(EstforConstants.BRONZE_AXE);

    // This will overwrite the checkpoints for the 2nd action (wooductting) and give nothing (bug)
    await timeTravel(queuedActionWoodcutting.timespan);

    const pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
    expect(pendingQueuedActionState.equipmentStates.length).to.be.gt(0);
    expect(pendingQueuedActionState.equipmentStates[0].producedItemTokenIds.length).to.be.gt(0);
  });

  it("3 actions start next one exactly when second one finishes, keep last in progress", async function () {
    const {playerId, players, itemNFT, worldActions, alice} = await loadFixture(playersFixture);

    const {queuedAction: queuedActionFishing} = await setupBasicFishing(itemNFT, worldActions);
    const {queuedAction: queuedActionWoodcutting} = await setupBasicWoodcutting(itemNFT, worldActions);
    const {queuedAction: queuedActionMining} = await setupBasicMining(itemNFT, worldActions);

    await players
      .connect(alice)
      .startActions(
        playerId,
        [queuedActionFishing, queuedActionWoodcutting, queuedActionMining],
        EstforTypes.ActionQueueStrategy.OVERWRITE
      );

    await timeTravel(queuedActionFishing.timespan + queuedActionWoodcutting.timespan); // skip 2 fully and next one starts on the dot of the next

    let checkpointEquipments = await (
      await ethers.getContractAt("IPlayersMisc1DelegateView", await players.getAddress())
    ).getCheckpointEquipments(playerId);
    expect(checkpointEquipments[0].itemTokenIds[9]).to.eq(EstforConstants.NET_STICK);
    expect(checkpointEquipments[1].itemTokenIds[9]).to.eq(EstforConstants.BRONZE_AXE);
    expect(checkpointEquipments[2].itemTokenIds[9]).to.eq(EstforConstants.BRONZE_PICKAXE);

    await players
      .connect(alice)
      .startActions(
        playerId,
        [queuedActionFishing, queuedActionWoodcutting],
        EstforTypes.ActionQueueStrategy.KEEP_LAST_IN_PROGRESS
      );

    checkpointEquipments = await (
      await ethers.getContractAt("IPlayersMisc1DelegateView", await players.getAddress())
    ).getCheckpointEquipments(playerId);
    expect(checkpointEquipments[0].itemTokenIds[9]).to.eq(EstforConstants.BRONZE_PICKAXE);
    expect(checkpointEquipments[1].itemTokenIds[9]).to.eq(EstforConstants.NET_STICK);
    expect(checkpointEquipments[2].itemTokenIds[9]).to.eq(EstforConstants.BRONZE_AXE);

    // This will overwrite the checkpoints for the 2nd action (wooductting) and give nothing (bug)
    await timeTravel(queuedActionWoodcutting.timespan);

    const pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
    expect(pendingQueuedActionState.equipmentStates.length).to.be.gt(0);
    expect(pendingQueuedActionState.equipmentStates[0].producedItemTokenIds.length).to.be.gt(0);
  });

  it("An action is removed when not having required equipment, middle action, keep last in progress", async function () {
    const {playerId, players, itemNFT, worldActions, alice} = await loadFixture(playersFixture);

    const {queuedAction: queuedActionFishing} = await setupBasicFishing(itemNFT, worldActions);
    const {queuedAction: queuedActionWoodcutting} = await setupBasicWoodcutting(itemNFT, worldActions);
    const {queuedAction: queuedActionMining} = await setupBasicMining(itemNFT, worldActions);

    await players
      .connect(alice)
      .startActions(
        playerId,
        [queuedActionFishing, queuedActionWoodcutting, queuedActionMining],
        EstforTypes.ActionQueueStrategy.OVERWRITE
      );

    await itemNFT.connect(alice).burn(alice, EstforConstants.BRONZE_AXE, 1);
    await timeTravel(queuedActionFishing.timespan + 1); // skip first one fully and in-progress the next one so that it gets removed

    let checkpointEquipments = await (
      await ethers.getContractAt("IPlayersMisc1DelegateView", await players.getAddress())
    ).getCheckpointEquipments(playerId);
    expect(checkpointEquipments[0].itemTokenIds[9]).to.eq(EstforConstants.NET_STICK);
    expect(checkpointEquipments[1].itemTokenIds[9]).to.eq(EstforConstants.BRONZE_AXE);
    expect(checkpointEquipments[2].itemTokenIds[9]).to.eq(EstforConstants.BRONZE_PICKAXE);

    await players
      .connect(alice)
      .startActions(
        playerId,
        [queuedActionMining, queuedActionFishing],
        EstforTypes.ActionQueueStrategy.KEEP_LAST_IN_PROGRESS
      );

    checkpointEquipments = await (
      await ethers.getContractAt("IPlayersMisc1DelegateView", await players.getAddress())
    ).getCheckpointEquipments(playerId);
    expect(checkpointEquipments[0].itemTokenIds[9]).to.eq(EstforConstants.BRONZE_PICKAXE);
    expect(checkpointEquipments[1].itemTokenIds[9]).to.eq(EstforConstants.BRONZE_PICKAXE);
    expect(checkpointEquipments[2].itemTokenIds[9]).to.eq(EstforConstants.NET_STICK);
  });

  it("3 actions start next one after first one, APPEND", async function () {
    const {playerId, players, itemNFT, worldActions, alice} = await loadFixture(playersFixture);

    const {queuedAction: queuedActionFishing} = await setupBasicFishing(itemNFT, worldActions);
    const {queuedAction: queuedActionWoodcutting} = await setupBasicWoodcutting(itemNFT, worldActions);
    const {queuedAction: queuedActionMining} = await setupBasicMining(itemNFT, worldActions);

    await players
      .connect(alice)
      .startActions(
        playerId,
        [queuedActionFishing, queuedActionWoodcutting, queuedActionMining],
        EstforTypes.ActionQueueStrategy.OVERWRITE
      );

    await timeTravel(queuedActionFishing.timespan + 2); // skip first one fully and a bit into next

    let checkpointEquipments = await (
      await ethers.getContractAt("IPlayersMisc1DelegateView", await players.getAddress())
    ).getCheckpointEquipments(playerId);
    expect(checkpointEquipments[0].itemTokenIds[9]).to.eq(EstforConstants.NET_STICK);
    expect(checkpointEquipments[1].itemTokenIds[9]).to.eq(EstforConstants.BRONZE_AXE);
    expect(checkpointEquipments[2].itemTokenIds[9]).to.eq(EstforConstants.BRONZE_PICKAXE);

    await players.connect(alice).startActions(playerId, [queuedActionFishing], EstforTypes.ActionQueueStrategy.APPEND);

    checkpointEquipments = await (
      await ethers.getContractAt("IPlayersMisc1DelegateView", await players.getAddress())
    ).getCheckpointEquipments(playerId);
    expect(checkpointEquipments[0].itemTokenIds[9]).to.eq(EstforConstants.BRONZE_AXE);
    expect(checkpointEquipments[1].itemTokenIds[9]).to.eq(EstforConstants.BRONZE_PICKAXE);
    expect(checkpointEquipments[2].itemTokenIds[9]).to.eq(EstforConstants.NET_STICK);

    // This will overwrite the checkpoints for the 2nd action (wooductting) and give nothing (bug)
    await timeTravel(queuedActionWoodcutting.timespan);

    const pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
    expect(pendingQueuedActionState.equipmentStates.length).to.be.gt(0);
    expect(pendingQueuedActionState.equipmentStates[0].producedItemTokenIds.length).to.be.gt(0);
  });

  it("3 actions start next one exactly when first one finishes, APPEND", async function () {
    const {playerId, players, itemNFT, worldActions, alice} = await loadFixture(playersFixture);

    const {queuedAction: queuedActionFishing} = await setupBasicFishing(itemNFT, worldActions);
    const {queuedAction: queuedActionWoodcutting} = await setupBasicWoodcutting(itemNFT, worldActions);
    const {queuedAction: queuedActionMining} = await setupBasicMining(itemNFT, worldActions);

    await players
      .connect(alice)
      .startActions(
        playerId,
        [queuedActionFishing, queuedActionWoodcutting, queuedActionMining],
        EstforTypes.ActionQueueStrategy.OVERWRITE
      );

    await timeTravel(queuedActionFishing.timespan); // skip first one fully and next one starts on the dot of the next

    let checkpointEquipments = await (
      await ethers.getContractAt("IPlayersMisc1DelegateView", await players.getAddress())
    ).getCheckpointEquipments(playerId);
    expect(checkpointEquipments[0].itemTokenIds[9]).to.eq(EstforConstants.NET_STICK);
    expect(checkpointEquipments[1].itemTokenIds[9]).to.eq(EstforConstants.BRONZE_AXE);
    expect(checkpointEquipments[2].itemTokenIds[9]).to.eq(EstforConstants.BRONZE_PICKAXE);

    await players.connect(alice).startActions(playerId, [queuedActionFishing], EstforTypes.ActionQueueStrategy.APPEND);

    checkpointEquipments = await (
      await ethers.getContractAt("IPlayersMisc1DelegateView", await players.getAddress())
    ).getCheckpointEquipments(playerId);
    expect(checkpointEquipments[0].itemTokenIds[9]).to.eq(EstforConstants.BRONZE_AXE);
    expect(checkpointEquipments[1].itemTokenIds[9]).to.eq(EstforConstants.BRONZE_PICKAXE);
    expect(checkpointEquipments[2].itemTokenIds[9]).to.eq(EstforConstants.NET_STICK);

    // This will overwrite the checkpoints for the 2nd action (wooductting) and give nothing (bug)
    await timeTravel(queuedActionWoodcutting.timespan);

    const pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
    expect(pendingQueuedActionState.equipmentStates.length).to.be.gt(0);
    expect(pendingQueuedActionState.equipmentStates[0].producedItemTokenIds.length).to.be.gt(0);
  });

  it("3 actions start next one after second one, APPEND", async function () {
    const {playerId, players, itemNFT, worldActions, alice} = await loadFixture(playersFixture);

    const {queuedAction: queuedActionFishing} = await setupBasicFishing(itemNFT, worldActions);
    const {queuedAction: queuedActionWoodcutting} = await setupBasicWoodcutting(itemNFT, worldActions);
    const {queuedAction: queuedActionMining} = await setupBasicMining(itemNFT, worldActions);

    await players
      .connect(alice)
      .startActions(
        playerId,
        [queuedActionFishing, queuedActionWoodcutting, queuedActionMining],
        EstforTypes.ActionQueueStrategy.OVERWRITE
      );

    await timeTravel(queuedActionFishing.timespan + queuedActionWoodcutting.timespan + 2); // skip first one fully and a bit into next

    let checkpointEquipments = await (
      await ethers.getContractAt("IPlayersMisc1DelegateView", await players.getAddress())
    ).getCheckpointEquipments(playerId);
    expect(checkpointEquipments[0].itemTokenIds[9]).to.eq(EstforConstants.NET_STICK);
    expect(checkpointEquipments[1].itemTokenIds[9]).to.eq(EstforConstants.BRONZE_AXE);
    expect(checkpointEquipments[2].itemTokenIds[9]).to.eq(EstforConstants.BRONZE_PICKAXE);

    await players
      .connect(alice)
      .startActions(playerId, [queuedActionFishing, queuedActionWoodcutting], EstforTypes.ActionQueueStrategy.APPEND);

    checkpointEquipments = await (
      await ethers.getContractAt("IPlayersMisc1DelegateView", await players.getAddress())
    ).getCheckpointEquipments(playerId);
    expect(checkpointEquipments[0].itemTokenIds[9]).to.eq(EstforConstants.BRONZE_PICKAXE);
    expect(checkpointEquipments[1].itemTokenIds[9]).to.eq(EstforConstants.NET_STICK);
    expect(checkpointEquipments[2].itemTokenIds[9]).to.eq(EstforConstants.BRONZE_AXE);

    // This will overwrite the checkpoints for the 2nd action (wooductting) and give nothing (bug)
    await timeTravel(queuedActionWoodcutting.timespan);

    const pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
    expect(pendingQueuedActionState.equipmentStates.length).to.be.gt(0);
    expect(pendingQueuedActionState.equipmentStates[0].producedItemTokenIds.length).to.be.gt(0);
  });

  it("3 actions start next one exactly when second one finishes, APPEND", async function () {
    const {playerId, players, itemNFT, worldActions, alice} = await loadFixture(playersFixture);

    const {queuedAction: queuedActionFishing} = await setupBasicFishing(itemNFT, worldActions);
    const {queuedAction: queuedActionWoodcutting} = await setupBasicWoodcutting(itemNFT, worldActions);
    const {queuedAction: queuedActionMining} = await setupBasicMining(itemNFT, worldActions);

    await players
      .connect(alice)
      .startActions(
        playerId,
        [queuedActionFishing, queuedActionWoodcutting, queuedActionMining],
        EstforTypes.ActionQueueStrategy.OVERWRITE
      );

    await timeTravel(queuedActionFishing.timespan + queuedActionWoodcutting.timespan); // skip 2 fully and next one starts on the dot of the next

    let checkpointEquipments = await (
      await ethers.getContractAt("IPlayersMisc1DelegateView", await players.getAddress())
    ).getCheckpointEquipments(playerId);
    expect(checkpointEquipments[0].itemTokenIds[9]).to.eq(EstforConstants.NET_STICK);
    expect(checkpointEquipments[1].itemTokenIds[9]).to.eq(EstforConstants.BRONZE_AXE);
    expect(checkpointEquipments[2].itemTokenIds[9]).to.eq(EstforConstants.BRONZE_PICKAXE);

    await players
      .connect(alice)
      .startActions(playerId, [queuedActionFishing, queuedActionWoodcutting], EstforTypes.ActionQueueStrategy.APPEND);

    checkpointEquipments = await (
      await ethers.getContractAt("IPlayersMisc1DelegateView", await players.getAddress())
    ).getCheckpointEquipments(playerId);
    expect(checkpointEquipments[0].itemTokenIds[9]).to.eq(EstforConstants.BRONZE_PICKAXE);
    expect(checkpointEquipments[1].itemTokenIds[9]).to.eq(EstforConstants.NET_STICK);
    expect(checkpointEquipments[2].itemTokenIds[9]).to.eq(EstforConstants.BRONZE_AXE);

    // This will overwrite the checkpoints for the 2nd action (wooductting) and give nothing (bug)
    await timeTravel(queuedActionWoodcutting.timespan);

    const pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
    expect(pendingQueuedActionState.equipmentStates.length).to.be.gt(0);
    expect(pendingQueuedActionState.equipmentStates[0].producedItemTokenIds.length).to.be.gt(0);
  });

  it("An action is removed when not having required equipment should get removed, middle action, APPEND", async function () {
    const {playerId, players, itemNFT, worldActions, alice} = await loadFixture(playersFixture);

    const {queuedAction: queuedActionFishing} = await setupBasicFishing(itemNFT, worldActions);
    const {queuedAction: queuedActionWoodcutting} = await setupBasicWoodcutting(itemNFT, worldActions);
    const {queuedAction: queuedActionMining} = await setupBasicMining(itemNFT, worldActions);

    await players
      .connect(alice)
      .startActions(
        playerId,
        [queuedActionFishing, queuedActionWoodcutting, queuedActionMining],
        EstforTypes.ActionQueueStrategy.OVERWRITE
      );

    await itemNFT.connect(alice).burn(alice, EstforConstants.BRONZE_AXE, 1);
    await timeTravel(queuedActionFishing.timespan + 1); // skip first one fully and in-progress the next one so that it gets removed

    let checkpointEquipments = await (
      await ethers.getContractAt("IPlayersMisc1DelegateView", await players.getAddress())
    ).getCheckpointEquipments(playerId);
    expect(checkpointEquipments[0].itemTokenIds[9]).to.eq(EstforConstants.NET_STICK);
    expect(checkpointEquipments[1].itemTokenIds[9]).to.eq(EstforConstants.BRONZE_AXE);
    expect(checkpointEquipments[2].itemTokenIds[9]).to.eq(EstforConstants.BRONZE_PICKAXE);

    await players
      .connect(alice)
      .startActions(playerId, [queuedActionMining, queuedActionFishing], EstforTypes.ActionQueueStrategy.APPEND);

    checkpointEquipments = await (
      await ethers.getContractAt("IPlayersMisc1DelegateView", await players.getAddress())
    ).getCheckpointEquipments(playerId);
    expect(checkpointEquipments[0].itemTokenIds[9]).to.eq(EstforConstants.BRONZE_PICKAXE);
    expect(checkpointEquipments[1].itemTokenIds[9]).to.eq(EstforConstants.BRONZE_PICKAXE);
    expect(checkpointEquipments[2].itemTokenIds[9]).to.eq(EstforConstants.NET_STICK);
  });

  describe("Process actions", function () {
    it("3 actions start next one after first one, process actions, APPEND", async function () {
      const {playerId, players, itemNFT, worldActions, alice} = await loadFixture(playersFixture);

      const {queuedAction: queuedActionFishing} = await setupBasicFishing(itemNFT, worldActions);
      const {queuedAction: queuedActionWoodcutting} = await setupBasicWoodcutting(itemNFT, worldActions);
      const {queuedAction: queuedActionMining} = await setupBasicMining(itemNFT, worldActions);

      await players
        .connect(alice)
        .startActions(
          playerId,
          [queuedActionFishing, queuedActionWoodcutting, queuedActionMining],
          EstforTypes.ActionQueueStrategy.OVERWRITE
        );

      await timeTravel(queuedActionFishing.timespan + 2); // skip first one fully and a bit into next

      let checkpointEquipments = await (await getPlayersHelper(players)).getCheckpointEquipments(playerId);
      expect(checkpointEquipments[0].itemTokenIds[9]).to.eq(EstforConstants.NET_STICK);
      expect(checkpointEquipments[1].itemTokenIds[9]).to.eq(EstforConstants.BRONZE_AXE);
      expect(checkpointEquipments[2].itemTokenIds[9]).to.eq(EstforConstants.BRONZE_PICKAXE);

      await players.connect(alice).processActions(playerId);

      checkpointEquipments = await (await getPlayersHelper(players)).getCheckpointEquipments(playerId);
      expect(checkpointEquipments[0].itemTokenIds[9]).to.eq(EstforConstants.BRONZE_AXE);
      expect(checkpointEquipments[1].itemTokenIds[9]).to.eq(EstforConstants.BRONZE_PICKAXE);
      expect(checkpointEquipments[2].itemTokenIds[9]).to.eq(0);
    });

    it("3 actions start next one exactly when first one finishes, process actions", async function () {
      const {playerId, players, itemNFT, worldActions, alice} = await loadFixture(playersFixture);

      const {queuedAction: queuedActionFishing} = await setupBasicFishing(itemNFT, worldActions);
      const {queuedAction: queuedActionWoodcutting} = await setupBasicWoodcutting(itemNFT, worldActions);
      const {queuedAction: queuedActionMining} = await setupBasicMining(itemNFT, worldActions);

      await players
        .connect(alice)
        .startActions(
          playerId,
          [queuedActionFishing, queuedActionWoodcutting, queuedActionMining],
          EstforTypes.ActionQueueStrategy.OVERWRITE
        );

      await timeTravel(queuedActionFishing.timespan); // skip first one fully and next one starts on the dot of the next

      let checkpointEquipments = await (await getPlayersHelper(players)).getCheckpointEquipments(playerId);
      expect(checkpointEquipments[0].itemTokenIds[9]).to.eq(EstforConstants.NET_STICK);
      expect(checkpointEquipments[1].itemTokenIds[9]).to.eq(EstforConstants.BRONZE_AXE);
      expect(checkpointEquipments[2].itemTokenIds[9]).to.eq(EstforConstants.BRONZE_PICKAXE);

      await players.connect(alice).processActions(playerId);

      checkpointEquipments = await (await getPlayersHelper(players)).getCheckpointEquipments(playerId);
      expect(checkpointEquipments[0].itemTokenIds[9]).to.eq(EstforConstants.BRONZE_AXE);
      expect(checkpointEquipments[1].itemTokenIds[9]).to.eq(EstforConstants.BRONZE_PICKAXE);
      expect(checkpointEquipments[2].itemTokenIds[9]).to.eq(0);
    });

    it("3 actions start next one after second one, process actions", async function () {
      const {playerId, players, itemNFT, worldActions, alice} = await loadFixture(playersFixture);

      const {queuedAction: queuedActionFishing} = await setupBasicFishing(itemNFT, worldActions);
      const {queuedAction: queuedActionWoodcutting} = await setupBasicWoodcutting(itemNFT, worldActions);
      const {queuedAction: queuedActionMining} = await setupBasicMining(itemNFT, worldActions);

      await players
        .connect(alice)
        .startActions(
          playerId,
          [queuedActionFishing, queuedActionWoodcutting, queuedActionMining],
          EstforTypes.ActionQueueStrategy.OVERWRITE
        );

      await timeTravel(queuedActionFishing.timespan + queuedActionWoodcutting.timespan + 2); // skip first one fully and a bit into next

      let checkpointEquipments = await (await getPlayersHelper(players)).getCheckpointEquipments(playerId);
      expect(checkpointEquipments[0].itemTokenIds[9]).to.eq(EstforConstants.NET_STICK);
      expect(checkpointEquipments[1].itemTokenIds[9]).to.eq(EstforConstants.BRONZE_AXE);
      expect(checkpointEquipments[2].itemTokenIds[9]).to.eq(EstforConstants.BRONZE_PICKAXE);

      await players.connect(alice).processActions(playerId);

      checkpointEquipments = await (await getPlayersHelper(players)).getCheckpointEquipments(playerId);
      expect(checkpointEquipments[0].itemTokenIds[9]).to.eq(EstforConstants.BRONZE_PICKAXE);
      expect(checkpointEquipments[1].itemTokenIds[9]).to.eq(0);
      expect(checkpointEquipments[2].itemTokenIds[9]).to.eq(0);
    });

    it("3 actions start next one exactly when second one finishes, process actions", async function () {
      const {playerId, players, itemNFT, worldActions, alice} = await loadFixture(playersFixture);

      const {queuedAction: queuedActionFishing} = await setupBasicFishing(itemNFT, worldActions);
      const {queuedAction: queuedActionWoodcutting} = await setupBasicWoodcutting(itemNFT, worldActions);
      const {queuedAction: queuedActionMining} = await setupBasicMining(itemNFT, worldActions);

      await players
        .connect(alice)
        .startActions(
          playerId,
          [queuedActionFishing, queuedActionWoodcutting, queuedActionMining],
          EstforTypes.ActionQueueStrategy.OVERWRITE
        );

      await timeTravel(queuedActionFishing.timespan + queuedActionWoodcutting.timespan); // skip 2 fully and next one starts on the dot of the next

      let checkpointEquipments = await (await getPlayersHelper(players)).getCheckpointEquipments(playerId);
      expect(checkpointEquipments[0].itemTokenIds[9]).to.eq(EstforConstants.NET_STICK);
      expect(checkpointEquipments[1].itemTokenIds[9]).to.eq(EstforConstants.BRONZE_AXE);
      expect(checkpointEquipments[2].itemTokenIds[9]).to.eq(EstforConstants.BRONZE_PICKAXE);

      await players.connect(alice).processActions(playerId);

      checkpointEquipments = await (await getPlayersHelper(players)).getCheckpointEquipments(playerId);
      expect(checkpointEquipments[0].itemTokenIds[9]).to.eq(EstforConstants.BRONZE_PICKAXE);
      expect(checkpointEquipments[1].itemTokenIds[9]).to.eq(0);
      expect(checkpointEquipments[2].itemTokenIds[9]).to.eq(0);
    });

    it("An action is removed when not having required equipment should get removed, middle action", async function () {
      const {playerId, players, itemNFT, worldActions, alice} = await loadFixture(playersFixture);

      const {queuedAction: queuedActionFishing} = await setupBasicFishing(itemNFT, worldActions);
      const {queuedAction: queuedActionWoodcutting} = await setupBasicWoodcutting(itemNFT, worldActions);
      const {queuedAction: queuedActionMining} = await setupBasicMining(itemNFT, worldActions);

      await players
        .connect(alice)
        .startActions(
          playerId,
          [queuedActionFishing, queuedActionWoodcutting, queuedActionMining],
          EstforTypes.ActionQueueStrategy.OVERWRITE
        );

      await itemNFT.connect(alice).burn(alice, EstforConstants.BRONZE_AXE, 1);
      await timeTravel(queuedActionFishing.timespan - 1); // skip first one fully and next one starts on the dot of the next

      let checkpointEquipments = await (await getPlayersHelper(players)).getCheckpointEquipments(playerId);
      expect(checkpointEquipments[0].itemTokenIds[9]).to.eq(EstforConstants.NET_STICK);
      expect(checkpointEquipments[1].itemTokenIds[9]).to.eq(EstforConstants.BRONZE_AXE);
      expect(checkpointEquipments[2].itemTokenIds[9]).to.eq(EstforConstants.BRONZE_PICKAXE);

      await players.connect(alice).processActions(playerId);

      checkpointEquipments = await (await getPlayersHelper(players)).getCheckpointEquipments(playerId);
      expect(checkpointEquipments[0].itemTokenIds[9]).to.eq(EstforConstants.BRONZE_PICKAXE);
      expect(checkpointEquipments[1].itemTokenIds[9]).to.eq(0);
      expect(checkpointEquipments[2].itemTokenIds[9]).to.eq(0);
    });

    it("An action is removed when not having required equipment should get removed, middle action", async function () {
      const {playerId, players, itemNFT, worldActions, alice} = await loadFixture(playersFixture);

      const {queuedAction: queuedActionFishing} = await setupBasicFishing(itemNFT, worldActions);
      const {queuedAction: queuedActionWoodcutting} = await setupBasicWoodcutting(itemNFT, worldActions);
      const {queuedAction: queuedActionMining} = await setupBasicMining(itemNFT, worldActions);

      await players
        .connect(alice)
        .startActions(
          playerId,
          [queuedActionFishing, queuedActionWoodcutting, queuedActionMining],
          EstforTypes.ActionQueueStrategy.OVERWRITE
        );

      await itemNFT.connect(alice).burn(alice, EstforConstants.BRONZE_AXE, 1);
      await timeTravel(queuedActionFishing.timespan + 1); // skip first one fully and in-progress the next one

      let checkpointEquipments = await (await getPlayersHelper(players)).getCheckpointEquipments(playerId);
      expect(checkpointEquipments[0].itemTokenIds[9]).to.eq(EstforConstants.NET_STICK);
      expect(checkpointEquipments[1].itemTokenIds[9]).to.eq(EstforConstants.BRONZE_AXE);
      expect(checkpointEquipments[2].itemTokenIds[9]).to.eq(EstforConstants.BRONZE_PICKAXE);

      await players.connect(alice).processActions(playerId);

      checkpointEquipments = await (await getPlayersHelper(players)).getCheckpointEquipments(playerId);
      expect(checkpointEquipments[0].itemTokenIds[9]).to.eq(EstforConstants.BRONZE_PICKAXE);
      expect(checkpointEquipments[1].itemTokenIds[9]).to.eq(0);
      expect(checkpointEquipments[2].itemTokenIds[9]).to.eq(0);
    });

    it("An action is removed when not having required equipment should get removed, last action", async function () {
      const {playerId, players, itemNFT, worldActions, alice} = await loadFixture(playersFixture);

      const {queuedAction: queuedActionFishing} = await setupBasicFishing(itemNFT, worldActions);
      const {queuedAction: queuedActionWoodcutting} = await setupBasicWoodcutting(itemNFT, worldActions);
      const {queuedAction: queuedActionMining} = await setupBasicMining(itemNFT, worldActions);

      await players
        .connect(alice)
        .startActions(
          playerId,
          [queuedActionFishing, queuedActionWoodcutting, queuedActionMining],
          EstforTypes.ActionQueueStrategy.OVERWRITE
        );

      await itemNFT.connect(alice).burn(alice, EstforConstants.BRONZE_PICKAXE, 1);
      await timeTravel(queuedActionFishing.timespan - 10);

      let checkpointEquipments = await (await getPlayersHelper(players)).getCheckpointEquipments(playerId);
      expect(checkpointEquipments[0].itemTokenIds[9]).to.eq(EstforConstants.NET_STICK);
      expect(checkpointEquipments[1].itemTokenIds[9]).to.eq(EstforConstants.BRONZE_AXE);
      expect(checkpointEquipments[2].itemTokenIds[9]).to.eq(EstforConstants.BRONZE_PICKAXE);

      await players.connect(alice).processActions(playerId);

      checkpointEquipments = await (await getPlayersHelper(players)).getCheckpointEquipments(playerId);
      expect(checkpointEquipments[0].itemTokenIds[9]).to.eq(EstforConstants.NET_STICK);
      expect(checkpointEquipments[1].itemTokenIds[9]).to.eq(EstforConstants.BRONZE_AXE);
      expect(checkpointEquipments[2].itemTokenIds[9]).to.eq(EstforConstants.BRONZE_PICKAXE);
      expect(checkpointEquipments[2].balances[9]).to.eq(0);
    });
  });
});
