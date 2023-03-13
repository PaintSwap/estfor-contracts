import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {EstforConstants, EstforTypes} from "@paintswap/estfor-definitions";
import {expect} from "chai";
import {ethers} from "hardhat";
import {getActionId} from "../../scripts/utils";
import {playersFixture} from "./PlayersFixture";

const actionIsAvailable = true;

describe("Boosts", () => {
  it("Add Boost, Full consume", async () => {
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
    });

    const rate = 100 * 100; // per hour
    const tx = await world.addAction({
      actionId: 1,
      info: {
        skill: EstforTypes.Skill.WOODCUTTING,
        xpPerHour: 3600,
        minSkillPoints: 0,
        isDynamic: false,
        numSpawn: 0,
        handItemTokenIdRangeMin: EstforConstants.BRONZE_AXE,
        handItemTokenIdRangeMax: EstforConstants.WOODCUTTING_MAX,
        isAvailable: actionIsAvailable,
        actionChoiceRequired: false,
      },
      guaranteedRewards: [{itemTokenId: EstforConstants.LOG, rate}],
      randomRewards: [],
      combatStats: EstforTypes.emptyCombatStats,
    });
    const actionId = await getActionId(tx);

    await itemNFT.testOnlyMint(alice.address, EstforConstants.XP_BOOST, 1);

    const timespan = 3600;
    const queuedAction: EstforTypes.QueuedAction = {
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
      startTime: "0",
      isValid: true,
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
    expect(await players.skillPoints(playerId, EstforTypes.Skill.WOODCUTTING)).to.eq(
      queuedAction.timespan + (boostDuration * boostValue) / 100
    ); //
    // Check the drops are as expected
    expect(await itemNFT.balanceOf(alice.address, EstforConstants.LOG)).to.eq(
      Math.floor((timespan * rate) / (3600 * 100))
    );
  });

  it("Add Boost, partial consume", async () => {
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
    });

    const rate = 100 * 100; // per hour
    const tx = await world.addAction({
      actionId: 1,
      info: {
        skill: EstforTypes.Skill.WOODCUTTING,
        xpPerHour: 3600,
        minSkillPoints: 0,
        isDynamic: false,
        numSpawn: 0,
        handItemTokenIdRangeMin: EstforConstants.BRONZE_AXE,
        handItemTokenIdRangeMax: EstforConstants.WOODCUTTING_MAX,
        isAvailable: actionIsAvailable,
        actionChoiceRequired: false,
      },
      guaranteedRewards: [{itemTokenId: EstforConstants.LOG, rate}],
      randomRewards: [],
      combatStats: EstforTypes.emptyCombatStats,
    });
    const actionId = await getActionId(tx);

    await itemNFT.testOnlyMint(alice.address, EstforConstants.XP_BOOST, 1);

    const timespan = 3600;
    const queuedAction: EstforTypes.QueuedAction = {
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
      startTime: "0",
      isValid: true,
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
    expect(await players.skillPoints(playerId, EstforTypes.Skill.WOODCUTTING)).to.eq(
      queuedAction.timespan + (queuedAction.timespan * boostValue) / 100
    ); //
    // Check the drops are as expected
    expect(await itemNFT.balanceOf(alice.address, EstforConstants.LOG)).to.eq(
      Math.floor((timespan * rate) / (3600 * 100))
    );
  });
});
