import {EstforConstants, EstforTypes} from "@paintswap/estfor-definitions";
import {Equipment, defaultActionChoice} from "@paintswap/estfor-definitions/types";
import {expect} from "chai";
import {ethers} from "hardhat";
import {ItemNFT, World} from "../../typechain-types";
import {bronzeHelmetStats, getActionChoiceId, getActionId, GUAR_MUL, RATE_MUL, SPAWN_MUL} from "../utils";
import {
  ACTION_FIREMAKING_ITEM,
  ACTION_FISHING_MINNUS,
  ACTION_WOODCUTTING_LOG,
} from "@paintswap/estfor-definitions/constants";

export const setupBasicWoodcutting = async function (itemNFT: ItemNFT, world: World, rate = 100 * GUAR_MUL) {
  const tx = await world.addAction({
    actionId: ACTION_WOODCUTTING_LOG,
    info: {
      skill: EstforTypes.Skill.WOODCUTTING,
      xpPerHour: 3600,
      minXP: 0,
      isDynamic: false,
      worldLocation: 0,
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

export const setupBasicFishing = async function (itemNFT: ItemNFT, world: World) {
  const rate = 100 * GUAR_MUL; // per hour
  const tx = await world.addAction({
    actionId: ACTION_FISHING_MINNUS,
    info: {
      skill: EstforTypes.Skill.FISHING,
      xpPerHour: 3600,
      minXP: 0,
      isDynamic: false,
      worldLocation: 0,
      numSpawned: 0,
      handItemTokenIdRangeMin: EstforConstants.FISHING_BASE,
      handItemTokenIdRangeMax: EstforConstants.FISHING_MAX,
      isAvailable: true,
      actionChoiceRequired: false,
      successPercent: 100,
    },
    guaranteedRewards: [{itemTokenId: EstforConstants.RAW_MINNUS, rate}],
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
    rightHandEquipmentTokenId: EstforConstants.NET_STICK,
    leftHandEquipmentTokenId: EstforConstants.NONE,
  };

  await itemNFT.addItem({
    ...EstforTypes.defaultInputItem,
    tokenId: EstforConstants.NET_STICK,
    equipPosition: EstforTypes.EquipPosition.RIGHT_HAND,
  });

  return {queuedAction, rate};
};

export const setupBasicFiremaking = async function (itemNFT: ItemNFT, world: World, minXP: number = 0) {
  const [owner, alice] = await ethers.getSigners();

  const rate = 100 * RATE_MUL; // per hour
  let tx = await world.addAction({
    actionId: ACTION_FIREMAKING_ITEM,
    info: {
      skill: EstforTypes.Skill.FIREMAKING,
      xpPerHour: 0,
      minXP: 0,
      isDynamic: false,
      worldLocation: 0,
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
    ...defaultActionChoice,
    skill: EstforTypes.Skill.FIREMAKING,
    xpPerHour: 3600,
    minXP,
    rate,
    inputTokenId1: EstforConstants.LOG,
    inputAmount1: 1,
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

  await itemNFT.addItems([
    {
      ...EstforTypes.defaultInputItem,
      tokenId: EstforConstants.MAGIC_FIRE_STARTER,
      equipPosition: EstforTypes.EquipPosition.RIGHT_HAND,
    },
    {
      ...EstforTypes.defaultInputItem,
      tokenId: EstforConstants.LOG,
      equipPosition: EstforTypes.EquipPosition.AUX,
    },
  ]);

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

  const rate = 1 * GUAR_MUL; // per kill
  const numSpawned = 10 * SPAWN_MUL;
  let tx = await world.addAction({
    actionId: 10,
    info: {
      skill: EstforTypes.Skill.COMBAT,
      xpPerHour: 3600,
      minXP: 0,
      isDynamic: false,
      worldLocation: 0,
      numSpawned,
      handItemTokenIdRangeMin: EstforConstants.COMBAT_BASE,
      handItemTokenIdRangeMax: EstforConstants.COMBAT_MAX,
      isAvailable: true,
      actionChoiceRequired: true,
      successPercent: 100,
    },
    guaranteedRewards: [{itemTokenId: EstforConstants.BRONZE_ARROW, rate}],
    randomRewards: [{itemTokenId: EstforConstants.POISON, chance: 33500, amount: 1}], // ~50% chance
    combatStats: monsterCombatStats,
  });
  const actionId = await getActionId(tx);

  tx = await world.addActionChoice(EstforConstants.NONE, 1, {
    ...defaultActionChoice,
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

  await itemNFT.addItems([
    {
      ...EstforTypes.defaultInputItem,
      combatStats: {
        ...EstforTypes.emptyCombatStats,
        melee: 5,
      },
      tokenId: EstforConstants.BRONZE_SWORD,
      equipPosition: EstforTypes.EquipPosition.RIGHT_HAND,
    },
    {
      ...EstforTypes.defaultInputItem,
      combatStats: bronzeHelmetStats,
      tokenId: EstforConstants.BRONZE_HELMET,
      equipPosition: EstforTypes.EquipPosition.HEAD,
    },
    {
      ...EstforTypes.defaultInputItem,
      tokenId: EstforConstants.BRONZE_ARROW,
      equipPosition: EstforTypes.EquipPosition.ARROW_SATCHEL,
    },
    {
      ...EstforTypes.defaultInputItem,
      healthRestored: 12,
      tokenId: EstforConstants.COOKED_MINNUS,
      equipPosition: EstforTypes.EquipPosition.FOOD,
    },
  ]);

  return {queuedAction, rate, numSpawned, choiceId};
};

export const setupBasicCooking = async function (
  itemNFT: ItemNFT,
  world: World,
  successPercent: number,
  minLevel: number
) {
  const [owner, alice] = await ethers.getSigners();

  const rate = 100 * RATE_MUL; // per hour

  let tx = await world.addAction({
    actionId: 1,
    info: {
      skill: EstforTypes.Skill.COOKING,
      xpPerHour: 0,
      minXP: 0,
      isDynamic: false,
      worldLocation: 0,
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
    ...defaultActionChoice,
    skill: EstforTypes.Skill.COOKING,
    xpPerHour: 3600,
    minXP: getXPFromLevel(minLevel),
    rate,
    inputTokenId1: EstforConstants.RAW_MINNUS,
    inputAmount1: 1,
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

  await itemNFT.addItems([
    {
      ...EstforTypes.defaultInputItem,
      tokenId: EstforConstants.RAW_MINNUS,
      equipPosition: EstforTypes.EquipPosition.AUX,
    },
    {
      ...EstforTypes.defaultInputItem,
      healthRestored: 1,
      tokenId: EstforConstants.COOKED_MINNUS,
      equipPosition: EstforTypes.EquipPosition.FOOD,
    },
  ]);

  await itemNFT.testMint(alice.address, EstforConstants.RAW_MINNUS, 1000);

  return {queuedAction, rate, choiceId};
};

export const setupBasicCrafting = async function (
  itemNFT: ItemNFT,
  world: World,
  rate = 1 * RATE_MUL,
  outputAmount: number = 1
) {
  let tx = await world.addAction({
    actionId: 1,
    info: {
      skill: EstforTypes.Skill.CRAFTING,
      xpPerHour: 0,
      minXP: 0,
      isDynamic: false,
      worldLocation: 0,
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
    ...defaultActionChoice,
    skill: EstforTypes.Skill.CRAFTING,
    xpPerHour: 3600,
    rate,
    inputTokenId1: EstforConstants.ROPE,
    inputAmount1: 1,
    inputTokenId2: EstforConstants.SAPPHIRE,
    inputAmount2: 20,
    outputTokenId: EstforConstants.SAPPHIRE_AMULET,
    outputAmount,
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

  await itemNFT.addItems([
    {
      ...EstforTypes.defaultInputItem,
      tokenId: EstforConstants.SAPPHIRE,
      equipPosition: EstforTypes.EquipPosition.NONE,
    },
    {
      ...EstforTypes.defaultInputItem,
      tokenId: EstforConstants.ROPE,
      equipPosition: EstforTypes.EquipPosition.NONE,
    },
  ]);

  return {queuedAction, rate, choiceId};
};

export const setupTravelling = async function (world: World, rate = 0.125 * RATE_MUL, from = 0, to = 1) {
  const ACTION_TRAVEL_0 = 1000;
  let tx = await world.addAction({
    actionId: ACTION_TRAVEL_0,
    info: {
      skill: EstforTypes.Skill.TRAVELING,
      xpPerHour: 0,
      minXP: 0,
      isDynamic: false,
      worldLocation: 0,
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
  const ACTIONCHOICE_WALK_TO_1 = 1;
  // Walking from location 0 to 1
  tx = await world.addActionChoice(actionId, ACTIONCHOICE_WALK_TO_1, {
    ...defaultActionChoice,
    skill: EstforTypes.Skill.AGILITY,
    xpPerHour: 3600,
    inputTokenId1: EstforConstants.NONE,
    inputAmount1: from, // World location start
    outputTokenId: EstforConstants.NONE,
    outputAmount: to, // World location end
    rate,
  });
  const choiceId = await getActionChoiceId(tx);

  const timespan = (3600 * RATE_MUL) / rate;
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

  return {queuedAction};
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
  if (consumed.length != 0) {
    expect(pendingQueuedActionState.equipmentStates[0].consumedItemTokenIds[0]).to.eq(consumed[0].itemTokenId);
    expect(pendingQueuedActionState.equipmentStates[0].consumedAmounts[0]).to.eq(consumed[0].amount);
    if (consumed.length > 1) {
      expect(pendingQueuedActionState.equipmentStates[0].consumedItemTokenIds[1]).to.eq(consumed[1].itemTokenId);
      expect(pendingQueuedActionState.equipmentStates[0].consumedAmounts[1]).to.eq(consumed[1].amount);
    }
  }

  expect(pendingQueuedActionState.equipmentStates[0].producedItemTokenIds.length).to.eq(produced.length);
  if (produced.length != 0) {
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
