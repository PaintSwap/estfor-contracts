import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {expect} from "chai";
import {ethers} from "hardhat";
import {
  ActionQueueStatus,
  BoostType,
  BRONZE_AXE,
  CombatStyle,
  defaultInputItem,
  emptyCombatStats,
  EquipPosition,
  getActionId,
  LOG,
  noAttire,
  NONE,
  QueuedAction,
  Skill,
  WOODCUTTING_MAX,
  XP_BOOST,
} from "../../scripts/utils";
import {playersFixture} from "./PlayersFixture";

const actionIsAvailable = true;

describe("Boosts", () => {
  it("Add Boost, Full consume", async () => {
    const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);

    const boostValue = 10;
    const boostDuration = 3300;
    await itemNFT.addItem({
      ...defaultInputItem,
      tokenId: XP_BOOST,
      equipPosition: EquipPosition.BOOST_VIAL,
      metadataURI: "someIPFSURI.json",
      // Boost
      boostType: BoostType.NON_COMBAT_XP,
      boostValue,
      boostDuration,
    });

    const rate = 100 * 100; // per hour
    const tx = await world.addAction({
      actionId: 1,
      info: {
        skill: Skill.WOODCUTTING,
        xpPerHour: 3600,
        minSkillPoints: 0,
        isDynamic: false,
        numSpawn: 0,
        handItemTokenIdRangeMin: BRONZE_AXE,
        handItemTokenIdRangeMax: WOODCUTTING_MAX,
        isAvailable: actionIsAvailable,
        actionChoiceRequired: false,
      },
      guaranteedRewards: [{itemTokenId: LOG, rate}],
      randomRewards: [],
      combatStats: emptyCombatStats,
    });
    const actionId = await getActionId(tx);

    await itemNFT.testOnlyMint(alice.address, XP_BOOST, 1);

    const timespan = 3600;
    const queuedAction: QueuedAction = {
      attire: noAttire,
      actionId,
      combatStyle: CombatStyle.NONE,
      choiceId: NONE,
      choiceId1: NONE,
      choiceId2: NONE,
      regenerateId: NONE,
      timespan,
      rightHandEquipmentTokenId: BRONZE_AXE,
      leftHandEquipmentTokenId: NONE,
      startTime: "0",
      isValid: true,
    };

    await itemNFT.addItem({
      ...defaultInputItem,
      tokenId: BRONZE_AXE,
      equipPosition: EquipPosition.RIGHT_HAND,
      metadataURI: "someIPFSURI.json",
    });

    expect(await itemNFT.balanceOf(alice.address, XP_BOOST)).to.eq(1);
    await players.connect(alice).startActions(playerId, [queuedAction], XP_BOOST, ActionQueueStatus.NONE);
    expect(await itemNFT.balanceOf(alice.address, XP_BOOST)).to.eq(0);

    await ethers.provider.send("evm_increaseTime", [queuedAction.timespan + 2]);
    await players.connect(alice).processActions(playerId);
    expect(await players.skillPoints(playerId, Skill.WOODCUTTING)).to.eq(
      queuedAction.timespan + (boostDuration * boostValue) / 100
    ); //
    // Check the drops are as expected
    expect(await itemNFT.balanceOf(alice.address, LOG)).to.eq(Math.floor((timespan * rate) / (3600 * 100)));
  });

  it("Add Boost, partial consume", async () => {
    const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);

    const boostValue = 10;
    await itemNFT.addItem({
      ...defaultInputItem,
      tokenId: XP_BOOST,
      equipPosition: EquipPosition.BOOST_VIAL,
      metadataURI: "someIPFSURI.json",
      // Boost
      boostType: BoostType.NON_COMBAT_XP,
      boostValue,
      boostDuration: 7200,
    });

    const rate = 100 * 100; // per hour
    const tx = await world.addAction({
      actionId: 1,
      info: {
        skill: Skill.WOODCUTTING,
        xpPerHour: 3600,
        minSkillPoints: 0,
        isDynamic: false,
        numSpawn: 0,
        handItemTokenIdRangeMin: BRONZE_AXE,
        handItemTokenIdRangeMax: WOODCUTTING_MAX,
        isAvailable: actionIsAvailable,
        actionChoiceRequired: false,
      },
      guaranteedRewards: [{itemTokenId: LOG, rate}],
      randomRewards: [],
      combatStats: emptyCombatStats,
    });
    const actionId = await getActionId(tx);

    await itemNFT.testOnlyMint(alice.address, XP_BOOST, 1);

    const timespan = 3600;
    const queuedAction: QueuedAction = {
      attire: noAttire,
      actionId,
      combatStyle: CombatStyle.NONE,
      choiceId: NONE,
      choiceId1: NONE,
      choiceId2: NONE,
      regenerateId: NONE,
      timespan,
      rightHandEquipmentTokenId: BRONZE_AXE,
      leftHandEquipmentTokenId: NONE,
      startTime: "0",
      isValid: true,
    };

    await itemNFT.addItem({
      ...defaultInputItem,
      tokenId: BRONZE_AXE,
      equipPosition: EquipPosition.RIGHT_HAND,
      metadataURI: "someIPFSURI.json",
    });

    expect(await itemNFT.balanceOf(alice.address, XP_BOOST)).to.eq(1);
    await players.connect(alice).startActions(playerId, [queuedAction], XP_BOOST, ActionQueueStatus.NONE);
    expect(await itemNFT.balanceOf(alice.address, XP_BOOST)).to.eq(0);

    await ethers.provider.send("evm_increaseTime", [queuedAction.timespan + 2]);
    await players.connect(alice).processActions(playerId);
    expect(await players.skillPoints(playerId, Skill.WOODCUTTING)).to.eq(
      queuedAction.timespan + (queuedAction.timespan * boostValue) / 100
    ); //
    // Check the drops are as expected
    expect(await itemNFT.balanceOf(alice.address, LOG)).to.eq(Math.floor((timespan * rate) / (3600 * 100)));
  });
});
