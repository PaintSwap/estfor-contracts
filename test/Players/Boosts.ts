import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {EstforConstants, EstforTypes} from "@paintswap/estfor-definitions";
import {Skill} from "@paintswap/estfor-definitions/types";
import {expect} from "chai";
import {ethers} from "hardhat";
import {getActionId} from "../../scripts/utils";
import {playersFixture} from "./PlayersFixture";

const actionIsAvailable = true;

describe("Boosts", function () {
  this.retries(3);

  it("Add Boost, Full consume", async function () {
    const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);

    const boostValue = 10;
    const boostDuration = 3300;
    await itemNFT.addItem({
      ...EstforTypes.defaultInputItem,
      tokenId: EstforConstants.XP_BOOST,
      equipPosition: EstforTypes.EquipPosition.BOOST_VIAL,
      metadataURI: "someIPFSURI.json",
      // Boost
      boostType: EstforTypes.BoostType.NON_COMBAT_XP,
      boostValue,
      boostDuration,
      isTransferable: false,
    });

    const rate = 100 * 10; // per hour
    const tx = await world.addAction({
      actionId: 1,
      info: {
        skill: EstforTypes.Skill.WOODCUTTING,
        xpPerHour: 3600,
        minXP: 0,
        isDynamic: false,
        numSpawned: 0,
        handItemTokenIdRangeMin: EstforConstants.BRONZE_AXE,
        handItemTokenIdRangeMax: EstforConstants.WOODCUTTING_MAX,
        isAvailable: actionIsAvailable,
        actionChoiceRequired: false,
        successPercent: 100,
      },
      guaranteedRewards: [{itemTokenId: EstforConstants.LOG, rate}],
      randomRewards: [],
      combatStats: EstforTypes.emptyCombatStats,
    });
    const actionId = await getActionId(tx);

    await itemNFT.testMint(alice.address, EstforConstants.XP_BOOST, 1);

    const timespan = 3600;
    const queuedAction: EstforTypes.QueuedActionInput = {
      attire: EstforTypes.noAttire,
      actionId,
      combatStyle: EstforTypes.CombatStyle.NONE,
      choiceId: EstforConstants.NONE,
      choiceId1: EstforConstants.NONE,
      choiceId2: EstforConstants.NONE,
      regenerateId: EstforConstants.NONE,
      timespan,
      rightHandEquipmentTokenId: EstforConstants.BRONZE_AXE,
      leftHandEquipmentTokenId: EstforConstants.NONE,
    };

    await itemNFT.addItem({
      ...EstforTypes.defaultInputItem,
      tokenId: EstforConstants.BRONZE_AXE,
      equipPosition: EstforTypes.EquipPosition.RIGHT_HAND,
      metadataURI: "someIPFSURI.json",
    });

    expect(await itemNFT.balanceOf(alice.address, EstforConstants.XP_BOOST)).to.eq(1);
    await players
      .connect(alice)
      .startActions(playerId, [queuedAction], EstforConstants.XP_BOOST, EstforTypes.ActionQueueStatus.NONE);
    expect(await itemNFT.balanceOf(alice.address, EstforConstants.XP_BOOST)).to.eq(0);

    await ethers.provider.send("evm_increaseTime", [queuedAction.timespan + 2]);
    await players.connect(alice).processActions(playerId);
    expect(await players.xp(playerId, EstforTypes.Skill.WOODCUTTING)).to.eq(
      queuedAction.timespan + (boostDuration * boostValue) / 100
    );
    // Check the drops are as expected
    expect(await itemNFT.balanceOf(alice.address, EstforConstants.LOG)).to.eq(
      Math.floor((timespan * rate) / (3600 * 10))
    );
  });

  it("Add Boost, partial consume", async function () {
    const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);

    const boostValue = 10;
    await itemNFT.addItem({
      ...EstforTypes.defaultInputItem,
      tokenId: EstforConstants.XP_BOOST,
      equipPosition: EstforTypes.EquipPosition.BOOST_VIAL,
      metadataURI: "someIPFSURI.json",
      // Boost
      boostType: EstforTypes.BoostType.NON_COMBAT_XP,
      boostValue,
      boostDuration: 7200,
      isTransferable: false,
    });

    const rate = 100 * 10; // per hour
    const tx = await world.addAction({
      actionId: 1,
      info: {
        skill: EstforTypes.Skill.WOODCUTTING,
        xpPerHour: 3600,
        minXP: 0,
        isDynamic: false,
        numSpawned: 0,
        handItemTokenIdRangeMin: EstforConstants.BRONZE_AXE,
        handItemTokenIdRangeMax: EstforConstants.WOODCUTTING_MAX,
        isAvailable: actionIsAvailable,
        actionChoiceRequired: false,
        successPercent: 100,
      },
      guaranteedRewards: [{itemTokenId: EstforConstants.LOG, rate}],
      randomRewards: [],
      combatStats: EstforTypes.emptyCombatStats,
    });
    const actionId = await getActionId(tx);

    await itemNFT.testMint(alice.address, EstforConstants.XP_BOOST, 1);

    const timespan = 3600;
    const queuedAction: EstforTypes.QueuedActionInput = {
      attire: EstforTypes.noAttire,
      actionId,
      combatStyle: EstforTypes.CombatStyle.NONE,
      choiceId: EstforConstants.NONE,
      choiceId1: EstforConstants.NONE,
      choiceId2: EstforConstants.NONE,
      regenerateId: EstforConstants.NONE,
      timespan,
      rightHandEquipmentTokenId: EstforConstants.BRONZE_AXE,
      leftHandEquipmentTokenId: EstforConstants.NONE,
    };

    await itemNFT.addItem({
      ...EstforTypes.defaultInputItem,
      tokenId: EstforConstants.BRONZE_AXE,
      equipPosition: EstforTypes.EquipPosition.RIGHT_HAND,
      metadataURI: "someIPFSURI.json",
    });

    expect(await itemNFT.balanceOf(alice.address, EstforConstants.XP_BOOST)).to.eq(1);
    await players
      .connect(alice)
      .startActions(playerId, [queuedAction], EstforConstants.XP_BOOST, EstforTypes.ActionQueueStatus.NONE);
    expect(await itemNFT.balanceOf(alice.address, EstforConstants.XP_BOOST)).to.eq(0);

    await ethers.provider.send("evm_increaseTime", [queuedAction.timespan + 2]);
    await players.connect(alice).processActions(playerId);
    expect(await players.xp(playerId, EstforTypes.Skill.WOODCUTTING)).to.eq(
      queuedAction.timespan + (queuedAction.timespan * boostValue) / 100
    ); //
    // Check the drops are as expected
    expect(await itemNFT.balanceOf(alice.address, EstforConstants.LOG)).to.eq(
      Math.floor((timespan * rate) / (3600 * 10))
    );
  });

  it("TODO, swap boost", async function () {
    // Check that they are minted/consumed as expected
  });

  it("TODO Clear everything, check boost", async function () {
    // Check that they are
  });

  it("Gathering boost", async function () {
    const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);

    const boostValue = 10;
    const boostDuration = 3600;
    await itemNFT.addItem({
      ...EstforTypes.defaultInputItem,
      tokenId: EstforConstants.GATHERING_BOOST,
      equipPosition: EstforTypes.EquipPosition.BOOST_VIAL,
      metadataURI: "someIPFSURI.json",
      // Boost
      boostType: EstforTypes.BoostType.GATHERING,
      boostValue,
      boostDuration,
      isTransferable: false,
    });

    const rate = 100 * 10; // per hour (Will be 110 after the boost is used)
    const tx = await world.addAction({
      actionId: 1,
      info: {
        skill: EstforTypes.Skill.WOODCUTTING,
        xpPerHour: 3600,
        minXP: 0,
        isDynamic: false,
        numSpawned: 0,
        handItemTokenIdRangeMin: EstforConstants.BRONZE_AXE,
        handItemTokenIdRangeMax: EstforConstants.WOODCUTTING_MAX,
        isAvailable: actionIsAvailable,
        actionChoiceRequired: false,
        successPercent: 100,
      },
      guaranteedRewards: [{itemTokenId: EstforConstants.LOG, rate}],
      randomRewards: [],
      combatStats: EstforTypes.emptyCombatStats,
    });
    const actionId = await getActionId(tx);

    await itemNFT.testMint(alice.address, EstforConstants.GATHERING_BOOST, 1);

    const timespan = 3600;
    const queuedAction: EstforTypes.QueuedActionInput = {
      attire: EstforTypes.noAttire,
      actionId,
      combatStyle: EstforTypes.CombatStyle.NONE,
      choiceId: EstforConstants.NONE,
      choiceId1: EstforConstants.NONE,
      choiceId2: EstforConstants.NONE,
      regenerateId: EstforConstants.NONE,
      timespan,
      rightHandEquipmentTokenId: EstforConstants.BRONZE_AXE,
      leftHandEquipmentTokenId: EstforConstants.NONE,
    };

    await itemNFT.addItem({
      ...EstforTypes.defaultInputItem,
      tokenId: EstforConstants.BRONZE_AXE,
      equipPosition: EstforTypes.EquipPosition.RIGHT_HAND,
      metadataURI: "someIPFSURI.json",
    });

    expect(await itemNFT.balanceOf(alice.address, EstforConstants.GATHERING_BOOST)).to.eq(1);
    await players
      .connect(alice)
      .startActions(playerId, [queuedAction], EstforConstants.GATHERING_BOOST, EstforTypes.ActionQueueStatus.NONE);
    expect(await itemNFT.balanceOf(alice.address, EstforConstants.GATHERING_BOOST)).to.eq(0);

    await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]);
    await players.connect(alice).processActions(playerId);
    expect(await players.xp(playerId, EstforTypes.Skill.WOODCUTTING)).to.eq(queuedAction.timespan);
    // Check the drops are as expected
    expect(await itemNFT.balanceOf(alice.address, EstforConstants.LOG)).to.eq(
      Math.floor((timespan * rate) / (3600 * 10) + (boostDuration * boostValue * rate) / (100 * 10 * 3600))
    );
  });

  it("Gathering boost, random rewards (100%) same day", async function () {});

  it("Gathering boost, random rewards (100%) next day", async function () {});
});
