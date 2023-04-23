import {EstforConstants, EstforTypes} from "@paintswap/estfor-definitions";
import {Equipment} from "@paintswap/estfor-definitions/types";
import {expect} from "chai";
import {ethers} from "hardhat";
import {ItemNFT, World} from "../../typechain-types";
import {bronzeHelmetStats, emptyActionChoice, getActionChoiceId, getActionId} from "../utils";

export const setupBasicWoodcutting = async function (itemNFT: ItemNFT, world: World, rate = 100 * 10) {
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
      isAvailable: true,
      actionChoiceRequired: false,
      successPercent: 100,
    },
    guaranteedRewards: [{itemTokenId: EstforConstants.LOG, rate}],
    randomRewards: [],
    combatStats: EstforTypes.emptyCombatStats,
  });
  const actionId = await getActionId(tx);

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
  };

  await itemNFT.addItem({
    ...EstforTypes.defaultInputItem,
    tokenId: EstforConstants.BRONZE_AXE,
    equipPosition: EstforTypes.EquipPosition.RIGHT_HAND,
  });

  return {queuedAction, rate};
};

export const setupBasicFiremaking = async function (itemNFT: ItemNFT, world: World, minXP: number) {
  const [owner, alice] = await ethers.getSigners();

  const rate = 100 * 10; // per hour
  let tx = await world.addAction({
    actionId: 1,
    info: {
      skill: EstforTypes.Skill.FIREMAKING,
      xpPerHour: 0,
      minXP: 0,
      isDynamic: false,
      numSpawned: 0,
      handItemTokenIdRangeMin: EstforConstants.MAGIC_FIRE_STARTER,
      handItemTokenIdRangeMax: EstforConstants.FIRE_MAX,
      isAvailable: true,
      actionChoiceRequired: true,
      successPercent: 100,
    },
    guaranteedRewards: [],
    randomRewards: [],
    combatStats: EstforTypes.emptyCombatStats,
  });
  const actionId = await getActionId(tx);

  // Logs go in, nothing comes out
  tx = await world.addActionChoice(actionId, 1, {
    skill: EstforTypes.Skill.FIREMAKING,
    diff: 0,
    xpPerHour: 3600,
    minXP,
    rate,
    inputTokenId1: EstforConstants.LOG,
    inputAmount1: 1,
    inputTokenId2: EstforConstants.NONE,
    inputAmount2: 0,
    inputTokenId3: EstforConstants.NONE,
    inputAmount3: 0,
    outputTokenId: EstforConstants.NONE,
    outputAmount: 0,
    successPercent: 100,
  });
  const choiceId = await getActionChoiceId(tx);

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
  };

  await itemNFT.addItem({
    ...EstforTypes.defaultInputItem,
    tokenId: EstforConstants.MAGIC_FIRE_STARTER,
    equipPosition: EstforTypes.EquipPosition.RIGHT_HAND,
  });

  await itemNFT.addItem({
    ...EstforTypes.defaultInputItem,
    tokenId: EstforConstants.LOG,
    equipPosition: EstforTypes.EquipPosition.AUX,
  });

  await itemNFT.testMint(alice.address, EstforConstants.LOG, 5000);

  return {queuedAction, rate, actionId, choiceId};
};

export const setupBasicMeleeCombat = async function (itemNFT: ItemNFT, world: World) {
  const [owner, alice] = await ethers.getSigners();

  const monsterCombatStats: EstforTypes.CombatStats = {
    melee: 1,
    magic: 0,
    range: 0,
    meleeDefence: 0,
    magicDefence: 0,
    rangeDefence: 0,
    health: 20,
  };

  const rate = 1 * 10; // per kill
  const numSpawned = 10;
  let tx = await world.addAction({
    actionId: 1,
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
    guaranteedRewards: [{itemTokenId: EstforConstants.BRONZE_ARROW, rate}],
    randomRewards: [],
    combatStats: monsterCombatStats,
  });
  const actionId = await getActionId(tx);

  tx = await world.addActionChoice(EstforConstants.NONE, 1, {
    ...emptyActionChoice,
    skill: EstforTypes.Skill.MELEE,
  });
  const choiceId = await getActionChoiceId(tx);
  await itemNFT.testMint(alice.address, EstforConstants.BRONZE_SWORD, 1);
  await itemNFT.testMint(alice.address, EstforConstants.BRONZE_HELMET, 1);

  await itemNFT.testMint(alice.address, EstforConstants.COOKED_MINNUS, 255);
  const timespan = 3600;
  const queuedAction: EstforTypes.QueuedActionInput = {
    attire: {...EstforTypes.noAttire, head: EstforConstants.BRONZE_HELMET},
    actionId,
    combatStyle: EstforTypes.CombatStyle.ATTACK,
    choiceId,
    regenerateId: EstforConstants.COOKED_MINNUS,
    timespan,
    rightHandEquipmentTokenId: EstforConstants.BRONZE_SWORD,
    leftHandEquipmentTokenId: EstforConstants.NONE,
  };

  await itemNFT.addItem({
    ...EstforTypes.defaultInputItem,
    combatStats: {
      ...EstforTypes.emptyCombatStats,
      melee: 5,
    },
    tokenId: EstforConstants.BRONZE_SWORD,
    equipPosition: EstforTypes.EquipPosition.RIGHT_HAND,
  });

  await itemNFT.addItem({
    ...EstforTypes.defaultInputItem,
    combatStats: bronzeHelmetStats,
    tokenId: EstforConstants.BRONZE_HELMET,
    equipPosition: EstforTypes.EquipPosition.HEAD,
  });

  await itemNFT.addItem({
    ...EstforTypes.defaultInputItem,
    tokenId: EstforConstants.BRONZE_ARROW,
    equipPosition: EstforTypes.EquipPosition.ARROW_SATCHEL,
  });

  await itemNFT.addItem({
    ...EstforTypes.defaultInputItem,
    healthRestored: 12,
    tokenId: EstforConstants.COOKED_MINNUS,
    equipPosition: EstforTypes.EquipPosition.FOOD,
  });

  return {queuedAction, rate, numSpawned};
};

export const setupBasicCooking = async function (
  itemNFT: ItemNFT,
  world: World,
  successPercent: number,
  minLevel: number
) {
  const [owner, alice] = await ethers.getSigners();

  const rate = 100 * 10; // per hour

  let tx = await world.addAction({
    actionId: 1,
    info: {
      skill: EstforTypes.Skill.COOKING,
      xpPerHour: 0,
      minXP: 0,
      isDynamic: false,
      numSpawned: 0,
      handItemTokenIdRangeMin: EstforConstants.NONE,
      handItemTokenIdRangeMax: EstforConstants.NONE,
      isAvailable: true,
      actionChoiceRequired: true,
      successPercent: 100,
    },
    guaranteedRewards: [],
    randomRewards: [],
    combatStats: EstforTypes.emptyCombatStats,
  });
  const actionId = await getActionId(tx);

  // Food goes in, cooked food comes out, 50% burnt, 25% success + 25 level diff
  tx = await world.addActionChoice(actionId, 1, {
    skill: EstforTypes.Skill.COOKING,
    diff: 0,
    xpPerHour: 3600,
    minXP: getXPFromLevel(minLevel),
    rate,
    inputTokenId1: EstforConstants.RAW_MINNUS,
    inputAmount1: 1,
    inputTokenId2: EstforConstants.NONE,
    inputAmount2: 0,
    inputTokenId3: EstforConstants.NONE,
    inputAmount3: 0,
    outputTokenId: EstforConstants.COOKED_MINNUS,
    outputAmount: 1,
    successPercent,
  });
  const choiceId = await getActionChoiceId(tx);
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
  };

  await itemNFT.addItem({
    ...EstforTypes.defaultInputItem,
    tokenId: EstforConstants.RAW_MINNUS,
    equipPosition: EstforTypes.EquipPosition.AUX,
  });

  await itemNFT.addItem({
    ...EstforTypes.defaultInputItem,
    tokenId: EstforConstants.COOKED_MINNUS,
    equipPosition: EstforTypes.EquipPosition.FOOD,
  });

  await itemNFT.testMint(alice.address, EstforConstants.RAW_MINNUS, 1000);

  return {queuedAction, rate, choiceId};
};

export const setupBasicCrafting = async function (
  itemNFT: ItemNFT,
  world: World,
  rate = 1 * 10,
  outputAmount: number = 1
) {
  let tx = await world.addAction({
    actionId: 1,
    info: {
      skill: EstforTypes.Skill.CRAFTING,
      xpPerHour: 0,
      minXP: 0,
      isDynamic: false,
      numSpawned: 0,
      handItemTokenIdRangeMin: EstforConstants.NONE,
      handItemTokenIdRangeMax: EstforConstants.NONE,
      isAvailable: true,
      actionChoiceRequired: true,
      successPercent: 100,
    },
    guaranteedRewards: [],
    randomRewards: [],
    combatStats: EstforTypes.emptyCombatStats,
  });
  const actionId = await getActionId(tx);

  // Logs go in, nothing comes out
  tx = await world.addActionChoice(actionId, 1, {
    skill: EstforTypes.Skill.CRAFTING,
    diff: 0,
    xpPerHour: 3600,
    minXP: 0,
    rate,
    inputTokenId1: EstforConstants.ROPE,
    inputAmount1: 1,
    inputTokenId2: EstforConstants.SAPPHIRE,
    inputAmount2: 20,
    inputTokenId3: EstforConstants.NONE,
    inputAmount3: 0,
    outputTokenId: EstforConstants.SAPPHIRE_AMULET,
    outputAmount,
    successPercent: 100,
  });
  const choiceId = await getActionChoiceId(tx);

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
  };

  await itemNFT.addItem({
    ...EstforTypes.defaultInputItem,
    tokenId: EstforConstants.SAPPHIRE,
    equipPosition: EstforTypes.EquipPosition.NONE,
  });

  await itemNFT.addItem({
    ...EstforTypes.defaultInputItem,
    tokenId: EstforConstants.ROPE,
    equipPosition: EstforTypes.EquipPosition.NONE,
  });

  return {queuedAction, rate, choiceId};
};

export function checkPendingQueuedActionState(
  pendingQueuedActionState: any,
  consumed: Equipment[],
  produced: Equipment[],
  xpGained: number,
  elapsedTime: number | number[]
) {
  expect(pendingQueuedActionState.equipmentStates.length).to.eq(1);
  expect(pendingQueuedActionState.actionMetadatas.length).to.eq(1);
  expect(pendingQueuedActionState.equipmentStates[0].consumedItemTokenIds.length).to.eq(consumed.length);
  if (consumed.length > 0) {
    expect(pendingQueuedActionState.equipmentStates[0].consumedItemTokenIds[0]).to.eq(consumed[0].itemTokenId);
    expect(pendingQueuedActionState.equipmentStates[0].consumedAmounts[0]).to.eq(consumed[0].amount);
    if (consumed.length > 1) {
      expect(pendingQueuedActionState.equipmentStates[0].consumedItemTokenIds[1]).to.eq(consumed[1].itemTokenId);
      expect(pendingQueuedActionState.equipmentStates[0].consumedAmounts[1]).to.eq(consumed[1].amount);
    }
  }

  expect(pendingQueuedActionState.equipmentStates[0].producedItemTokenIds.length).to.eq(produced.length);
  if (produced.length > 0) {
    expect(pendingQueuedActionState.equipmentStates[0].producedItemTokenIds[0]).to.eq(produced[0].itemTokenId);
    expect(pendingQueuedActionState.equipmentStates[0].producedAmounts[0]).to.eq(produced[0].amount);
    if (produced.length > 1) {
      expect(pendingQueuedActionState.equipmentStates[0].producedItemTokenIds[1]).to.eq(produced[1].itemTokenId);
      expect(pendingQueuedActionState.equipmentStates[0].producedAmounts[1]).to.eq(produced[1].amount);
    }
  }

  expect(pendingQueuedActionState.actionMetadatas[0].xpGained).to.eq(xpGained);
  expect(pendingQueuedActionState.actionMetadatas[0].rolls).to.eq(0);
  expect(pendingQueuedActionState.actionMetadatas[0].died).to.be.false;
  expect(pendingQueuedActionState.actionMetadatas[0].actionId).to.eq(1);
  expect(pendingQueuedActionState.actionMetadatas[0].queueId).to.eq(1);
  // if elapsedTime is an array, then we are checking for a range
  // else we are checking for an exact value
  if (Array.isArray(elapsedTime)) {
    expect(pendingQueuedActionState.actionMetadatas[0].elapsedTime).to.be.oneOf(elapsedTime);
  } else {
    expect(pendingQueuedActionState.actionMetadatas[0].elapsedTime).to.eq(elapsedTime);
  }

  expect(pendingQueuedActionState.producedPastRandomRewards.length).to.eq(0);
  expect(pendingQueuedActionState.xpRewardItemTokenIds.length).to.eq(0);
  expect(pendingQueuedActionState.xpRewardAmounts.length).to.eq(0);
  expect(pendingQueuedActionState.quests.rewardItemTokenIds.length).to.eq(0);
  expect(pendingQueuedActionState.quests.rewardAmounts.length).to.eq(0);
  expect(pendingQueuedActionState.quests.consumedItemTokenIds.length).to.eq(0);
  expect(pendingQueuedActionState.quests.consumedAmounts.length).to.eq(0);
  expect(pendingQueuedActionState.quests.activeQuestInfo.length).to.eq(0);
  expect(pendingQueuedActionState.dailyRewardItemTokenIds.length).to.eq(0);
  expect(pendingQueuedActionState.dailyRewardAmounts.length).to.eq(0);
}

export const getXPFromLevel = (level: number) => {
  return EstforConstants.levelXp[level - 1];
};
