import {EstforConstants, EstforTypes} from "@paintswap/estfor-definitions";
import {ethers} from "hardhat";
import {ItemNFT, World} from "../../typechain-types";
import {bronzeHelmetStats, emptyActionChoice, getActionChoiceId, getActionId} from "../utils";

export const setupBasicWoodcutting = async function (itemNFT: ItemNFT, world: World) {
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
  });

  return {queuedAction, rate};
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

  const rate = 1 * 10; // per hour
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
    choiceId1: EstforConstants.NONE,
    choiceId2: EstforConstants.NONE,
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

export const getXPFromLevel = (level: number) => {
  return EstforConstants.levelXp[level - 1];
};
