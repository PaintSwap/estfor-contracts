import {EstforConstants, EstforTypes} from "@paintswap/estfor-definitions";
import {ActionInput, Equipment, defaultActionChoice, defaultActionInfo} from "@paintswap/estfor-definitions/types";
import {expect} from "chai";
import {ethers} from "hardhat";
import {ItemNFT, World} from "../../typechain-types";
import {bronzeHelmetStats, getActionChoiceId, getActionId, GUAR_MUL, RATE_MUL, SPAWN_MUL} from "../utils";
import {
  ACTION_FIREMAKING_ITEM,
  ACTION_FISHING_MINNUS,
  ACTION_WOODCUTTING_LOG
} from "@paintswap/estfor-definitions/constants";
import {HardhatEthersSigner} from "@nomicfoundation/hardhat-ethers/signers";
import {BaseContract} from "ethers";

export const setupBasicWoodcutting = async function (
  itemNFT: ItemNFT,
  world: World,
  rate = 100 * GUAR_MUL,
  xpPerHour = 3600n,
  rewards = EstforConstants.LOG
) {
  const action: ActionInput = {
    actionId: ACTION_WOODCUTTING_LOG,
    info: {
      skill: EstforTypes.Skill.WOODCUTTING,
      xpPerHour,
      minXP: 0,
      isDynamic: false,
      worldLocation: 0,
      isFullModeOnly: false,
      numSpawned: 0,
      handItemTokenIdRangeMin: EstforConstants.BRONZE_AXE,
      handItemTokenIdRangeMax: EstforConstants.WOODCUTTING_MAX,
      isAvailable: true,
      actionChoiceRequired: false,
      successPercent: 100
    },
    guaranteedRewards: [{itemTokenId: rewards, rate}],
    randomRewards: [],
    combatStats: EstforTypes.emptyCombatStats
  };

  const tx = await world.addActions([action]);
  const actionId = await getActionId(tx, world);

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

  return {queuedAction, rate, actionId, action};
};

export const setupBasicFishing = async function (itemNFT: ItemNFT, world: World) {
  const rate = 100 * GUAR_MUL; // per hour
  const tx = await world.addActions([
    {
      actionId: ACTION_FISHING_MINNUS,
      info: {
        skill: EstforTypes.Skill.FISHING,
        xpPerHour: 3600,
        minXP: 0,
        isDynamic: false,
        worldLocation: 0,
        isFullModeOnly: false,
        numSpawned: 0,
        handItemTokenIdRangeMin: EstforConstants.FISHING_BASE,
        handItemTokenIdRangeMax: EstforConstants.FISHING_MAX,
        isAvailable: true,
        actionChoiceRequired: false,
        successPercent: 100
      },
      guaranteedRewards: [{itemTokenId: EstforConstants.RAW_MINNUS, rate}],
      randomRewards: [],
      combatStats: EstforTypes.emptyCombatStats
    }
  ]);
  const actionId = await getActionId(tx, world);

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
    petId: EstforConstants.NONE
  };

  await itemNFT.addItems([
    {
      ...EstforTypes.defaultItemInput,
      tokenId: EstforConstants.NET_STICK,
      equipPosition: EstforTypes.EquipPosition.RIGHT_HAND
    }
  ]);

  return {queuedAction, rate};
};

export const setupBasicFiremaking = async function (itemNFT: ItemNFT, world: World, minXP: number = 0) {
  const [owner, alice] = await ethers.getSigners();

  const rate = 100 * RATE_MUL; // per hour
  let tx = await world.addActions([
    {
      actionId: ACTION_FIREMAKING_ITEM,
      info: {
        skill: EstforTypes.Skill.FIREMAKING,
        xpPerHour: 0,
        minXP: 0,
        isDynamic: false,
        worldLocation: 0,
        isFullModeOnly: false,
        numSpawned: 0,
        handItemTokenIdRangeMin: EstforConstants.MAGIC_FIRE_STARTER,
        handItemTokenIdRangeMax: EstforConstants.FIRE_MAX,
        isAvailable: true,
        actionChoiceRequired: true,
        successPercent: 100
      },
      guaranteedRewards: [],
      randomRewards: [],
      combatStats: EstforTypes.emptyCombatStats
    }
  ]);
  const actionId = await getActionId(tx, world);

  // Logs go in, nothing comes out
  tx = await world.addActionChoices(
    actionId,
    [1],
    [
      {
        ...defaultActionChoice,
        skill: EstforTypes.Skill.FIREMAKING,
        xpPerHour: 3600,
        rate,
        inputTokenIds: [EstforConstants.LOG],
        inputAmounts: [1],
        minSkills: minXP > 0 ? [EstforTypes.Skill.FIREMAKING] : [],
        minXPs: minXP > 0 ? [minXP] : []
      }
    ]
  );
  const choiceId = await getActionChoiceId(tx, world);

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

  await itemNFT.testMint(alice, EstforConstants.LOG, 5000);

  return {queuedAction, rate, actionId, choiceId};
};

export const setupBasicMeleeCombat = async function (itemNFT: ItemNFT, world: World) {
  const [owner, alice] = await ethers.getSigners();

  const monsterCombatStats: EstforTypes.CombatStats = {
    melee: 1,
    magic: 0,
    ranged: 0,
    meleeDefence: 0,
    magicDefence: 0,
    rangedDefence: 0,
    health: 20
  };

  const rate = 1 * GUAR_MUL; // per kill
  const numSpawned = 10 * SPAWN_MUL;
  const combatAction = {
    actionId: 10,
    info: {
      skill: EstforTypes.Skill.COMBAT,
      xpPerHour: 3600,
      minXP: 0,
      isDynamic: false,
      worldLocation: 0,
      isFullModeOnly: false,
      numSpawned,
      handItemTokenIdRangeMin: EstforConstants.COMBAT_BASE,
      handItemTokenIdRangeMax: EstforConstants.COMBAT_MAX,
      isAvailable: true,
      actionChoiceRequired: true,
      successPercent: 100
    },
    guaranteedRewards: [{itemTokenId: EstforConstants.BRONZE_ARROW, rate}],
    randomRewards: [{itemTokenId: EstforConstants.POISON, chance: 32767, amount: 1}], // ~50% chance
    combatStats: monsterCombatStats
  };
  let tx = await world.addActions([combatAction]);
  const actionId = await getActionId(tx, world);

  tx = await world.addActionChoices(
    EstforConstants.NONE,
    [1],
    [
      {
        ...defaultActionChoice,
        skill: EstforTypes.Skill.MELEE
      }
    ]
  );
  const choiceId = await getActionChoiceId(tx, world);
  await itemNFT.testMint(alice, EstforConstants.BRONZE_SWORD, 1);
  await itemNFT.testMint(alice, EstforConstants.BRONZE_HELMET, 1);

  await itemNFT.testMint(alice, EstforConstants.COOKED_MINNUS, 255);
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
    petId: EstforConstants.NONE
  };

  await itemNFT.addItems([
    {
      ...EstforTypes.defaultItemInput,
      combatStats: {
        ...EstforTypes.emptyCombatStats,
        melee: 5
      },
      tokenId: EstforConstants.BRONZE_SWORD,
      equipPosition: EstforTypes.EquipPosition.RIGHT_HAND
    },
    {
      ...EstforTypes.defaultItemInput,
      combatStats: bronzeHelmetStats,
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
      healthRestored: 12,
      tokenId: EstforConstants.COOKED_MINNUS,
      equipPosition: EstforTypes.EquipPosition.FOOD
    }
  ]);

  return {queuedAction, rate, numSpawned, choiceId, combatAction};
};

export const setupBasicPetMeleeCombat = async (itemNFT: ItemNFT, world: World, petId: number) => {
  const [owner, alice] = await ethers.getSigners();

  const monsterCombatStats: EstforTypes.CombatStats = {
    melee: 1,
    magic: 0,
    ranged: 0,
    meleeDefence: 0,
    magicDefence: 0,
    rangedDefence: 0,
    health: 36
  };

  const dropRate = 1 * GUAR_MUL; // per monster
  const numSpawned = 100 * SPAWN_MUL;
  let tx = await world.addActions([
    {
      actionId: 1,
      info: {
        ...defaultActionInfo,
        skill: EstforTypes.Skill.COMBAT,
        xpPerHour: 3600,
        minXP: 0,
        isDynamic: false,
        numSpawned,
        handItemTokenIdRangeMin: EstforConstants.COMBAT_BASE,
        handItemTokenIdRangeMax: EstforConstants.COMBAT_MAX,
        isAvailable: true,
        actionChoiceRequired: true,
        successPercent: 100
      },
      guaranteedRewards: [{itemTokenId: EstforConstants.BRONZE_ARROW, rate: dropRate}],
      randomRewards: [],
      combatStats: monsterCombatStats
    }
  ]);
  const actionId = await getActionId(tx, world);
  tx = await world.addActionChoices(
    EstforConstants.NONE,
    [1],
    [
      {
        ...defaultActionChoice,
        skill: EstforTypes.Skill.MELEE
      }
    ]
  );
  const choiceId = await getActionChoiceId(tx, world);

  const timespan = 3600;
  const queuedAction: EstforTypes.QueuedActionInput = {
    attire: EstforTypes.noAttire,
    actionId,
    combatStyle: EstforTypes.CombatStyle.ATTACK,
    choiceId,
    regenerateId: EstforConstants.COOKED_MINNUS,
    timespan,
    rightHandEquipmentTokenId: EstforConstants.NONE,
    leftHandEquipmentTokenId: EstforConstants.NONE,
    petId
  };

  await itemNFT.addItems([
    {
      ...EstforTypes.defaultItemInput,
      healthRestored: 12,
      tokenId: EstforConstants.COOKED_MINNUS,
      equipPosition: EstforTypes.EquipPosition.FOOD
    }
  ]);
  await itemNFT.testMint(alice, EstforConstants.COOKED_MINNUS, 20000);

  return {queuedAction};
};

export const setupBasicCooking = async function (
  itemNFT: ItemNFT,
  world: World,
  successPercent: number,
  minLevel: number
) {
  const [owner, alice] = await ethers.getSigners();

  const rate = 100 * RATE_MUL; // per hour

  let tx = await world.addActions([
    {
      actionId: 1,
      info: {
        skill: EstforTypes.Skill.COOKING,
        xpPerHour: 0,
        minXP: 0,
        isDynamic: false,
        worldLocation: 0,
        isFullModeOnly: false,
        numSpawned: 0,
        handItemTokenIdRangeMin: EstforConstants.NONE,
        handItemTokenIdRangeMax: EstforConstants.NONE,
        isAvailable: true,
        actionChoiceRequired: true,
        successPercent: 100
      },
      guaranteedRewards: [],
      randomRewards: [],
      combatStats: EstforTypes.emptyCombatStats
    }
  ]);
  const actionId = await getActionId(tx, world);

  // Food goes in, cooked food comes out, 50% burnt, 25% success + 25 level diff
  tx = await world.addActionChoices(
    actionId,
    [1],
    [
      {
        ...defaultActionChoice,
        skill: EstforTypes.Skill.COOKING,
        xpPerHour: 3600,
        rate,
        inputTokenIds: [EstforConstants.RAW_MINNUS],
        inputAmounts: [1],
        outputTokenId: EstforConstants.COOKED_MINNUS,
        outputAmount: 1,
        successPercent,
        minSkills: minLevel > 1 ? [EstforTypes.Skill.COOKING] : [],
        minXPs: minLevel > 1 ? [getXPFromLevel(minLevel)] : []
      }
    ]
  );
  const choiceId = await getActionChoiceId(tx, world);
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
      tokenId: EstforConstants.RAW_MINNUS,
      equipPosition: EstforTypes.EquipPosition.AUX
    },
    {
      ...EstforTypes.defaultItemInput,
      healthRestored: 1,
      tokenId: EstforConstants.COOKED_MINNUS,
      equipPosition: EstforTypes.EquipPosition.FOOD
    }
  ]);

  await itemNFT.testMint(alice, EstforConstants.RAW_MINNUS, 1000);

  return {queuedAction, rate, choiceId};
};

export const setupBasicCrafting = async function (
  itemNFT: ItemNFT,
  world: World,
  rate = 1 * RATE_MUL,
  outputAmount: number = 1
) {
  let tx = await world.addActions([
    {
      actionId: 1,
      info: {
        skill: EstforTypes.Skill.CRAFTING,
        xpPerHour: 0,
        minXP: 0,
        isDynamic: false,
        worldLocation: 0,
        isFullModeOnly: false,
        numSpawned: 0,
        handItemTokenIdRangeMin: EstforConstants.NONE,
        handItemTokenIdRangeMax: EstforConstants.NONE,
        isAvailable: true,
        actionChoiceRequired: true,
        successPercent: 100
      },
      guaranteedRewards: [],
      randomRewards: [],
      combatStats: EstforTypes.emptyCombatStats
    }
  ]);
  const actionId = await getActionId(tx, world);

  // Logs go in, nothing comes out
  tx = await world.addActionChoices(
    actionId,
    [1],
    [
      {
        ...defaultActionChoice,
        skill: EstforTypes.Skill.CRAFTING,
        xpPerHour: 3600,
        rate,
        inputTokenIds: [EstforConstants.ROPE, EstforConstants.SAPPHIRE],
        inputAmounts: [1, 20],
        outputTokenId: EstforConstants.SAPPHIRE_AMULET,
        outputAmount
      }
    ]
  );
  const choiceId = await getActionChoiceId(tx, world);

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
      tokenId: EstforConstants.SAPPHIRE,
      equipPosition: EstforTypes.EquipPosition.NONE
    },
    {
      ...EstforTypes.defaultItemInput,
      tokenId: EstforConstants.ROPE,
      equipPosition: EstforTypes.EquipPosition.NONE
    }
  ]);

  return {queuedAction, rate, choiceId};
};

export const setupBasicAlchemy = async function (
  itemNFT: ItemNFT,
  world: World,
  rate = 1 * RATE_MUL,
  outputAmount: number = 1
) {
  let tx = await world.addActions([
    {
      actionId: 1,
      info: {
        skill: EstforTypes.Skill.ALCHEMY,
        xpPerHour: 0,
        minXP: 0,
        isDynamic: false,
        worldLocation: 0,
        isFullModeOnly: false,
        numSpawned: 0,
        handItemTokenIdRangeMin: EstforConstants.NONE,
        handItemTokenIdRangeMax: EstforConstants.NONE,
        isAvailable: true,
        actionChoiceRequired: true,
        successPercent: 100
      },
      guaranteedRewards: [],
      randomRewards: [],
      combatStats: EstforTypes.emptyCombatStats
    }
  ]);
  const actionId = await getActionId(tx, world);

  // Logs go in, nothing comes out
  tx = await world.addActionChoices(
    actionId,
    [1],
    [
      {
        ...defaultActionChoice,
        skill: EstforTypes.Skill.ALCHEMY,
        xpPerHour: 3600,
        rate,
        inputTokenIds: [EstforConstants.SHADOW_SCROLL, EstforConstants.NATURE_SCROLL, EstforConstants.PAPER],
        inputAmounts: [1, 1, 2],
        outputTokenId: EstforConstants.ANCIENT_SCROLL,
        outputAmount
      }
    ]
  );
  const choiceId = await getActionChoiceId(tx, world);

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
      tokenId: EstforConstants.SHADOW_SCROLL,
      equipPosition: EstforTypes.EquipPosition.NONE
    },
    {
      ...EstforTypes.defaultItemInput,
      tokenId: EstforConstants.NATURE_SCROLL,
      equipPosition: EstforTypes.EquipPosition.NONE
    },
    {
      ...EstforTypes.defaultItemInput,
      tokenId: EstforConstants.PAPER,
      equipPosition: EstforTypes.EquipPosition.NONE
    },
    {
      ...EstforTypes.defaultItemInput,
      tokenId: EstforConstants.ANCIENT_SCROLL,
      equipPosition: EstforTypes.EquipPosition.NONE
    }
  ]);

  return {queuedAction, rate, choiceId};
};

export const setupBasicFletching = async function (
  itemNFT: ItemNFT,
  world: World,
  rate = 1 * RATE_MUL,
  outputAmount: number = 1
) {
  let tx = await world.addActions([
    {
      actionId: 1,
      info: {
        skill: EstforTypes.Skill.FLETCHING,
        xpPerHour: 0,
        minXP: 0,
        isDynamic: false,
        worldLocation: 0,
        isFullModeOnly: false,
        numSpawned: 0,
        handItemTokenIdRangeMin: EstforConstants.NONE,
        handItemTokenIdRangeMax: EstforConstants.NONE,
        isAvailable: true,
        actionChoiceRequired: true,
        successPercent: 100
      },
      guaranteedRewards: [],
      randomRewards: [],
      combatStats: EstforTypes.emptyCombatStats
    }
  ]);
  const actionId = await getActionId(tx, world);

  // Create Bronze arrows
  tx = await world.addActionChoices(
    actionId,
    [1],
    [
      {
        ...defaultActionChoice,
        skill: EstforTypes.Skill.FLETCHING,
        xpPerHour: 3600,
        rate,
        inputTokenIds: [EstforConstants.BRONZE_ARROW_HEAD, EstforConstants.ARROW_SHAFT, EstforConstants.FEATHER],
        inputAmounts: [1, 1, 2],
        outputTokenId: EstforConstants.BRONZE_ARROW,
        outputAmount
      }
    ]
  );
  const choiceId = await getActionChoiceId(tx, world);

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
      tokenId: EstforConstants.BRONZE_ARROW_HEAD,
      equipPosition: EstforTypes.EquipPosition.NONE
    },
    {
      ...EstforTypes.defaultItemInput,
      tokenId: EstforConstants.ARROW_SHAFT,
      equipPosition: EstforTypes.EquipPosition.NONE
    },
    {
      ...EstforTypes.defaultItemInput,
      tokenId: EstforConstants.FEATHER,
      equipPosition: EstforTypes.EquipPosition.NONE
    },
    {
      ...EstforTypes.defaultItemInput,
      tokenId: EstforConstants.BRONZE_ARROW,
      equipPosition: EstforTypes.EquipPosition.NONE
    }
  ]);

  return {queuedAction, rate, choiceId};
};

export const setupBasicForging = async function (
  itemNFT: ItemNFT,
  world: World,
  rate = 1 * RATE_MUL,
  outputAmount: number = 1
) {
  let tx = await world.addActions([
    {
      actionId: 1,
      info: {
        skill: EstforTypes.Skill.FORGING,
        xpPerHour: 0,
        minXP: 0,
        isDynamic: false,
        worldLocation: 0,
        isFullModeOnly: false,
        numSpawned: 0,
        handItemTokenIdRangeMin: EstforConstants.NONE,
        handItemTokenIdRangeMax: EstforConstants.NONE,
        isAvailable: true,
        actionChoiceRequired: true,
        successPercent: 100
      },
      guaranteedRewards: [],
      randomRewards: [],
      combatStats: EstforTypes.emptyCombatStats
    }
  ]);
  const actionId = await getActionId(tx, world);

  // Create Small Lump
  tx = await world.addActionChoices(
    actionId,
    [1],
    [
      {
        ...defaultActionChoice,
        skill: EstforTypes.Skill.FORGING,

        xpPerHour: 3600,
        rate,
        inputTokenIds: [EstforConstants.BRONZE_ARROW_HEAD, EstforConstants.ARROW_SHAFT, EstforConstants.FEATHER],
        inputAmounts: [1, 1, 2],
        outputTokenId: EstforConstants.BRONZE_ARROW,
        outputAmount
      }
    ]
  );
  const choiceId = await getActionChoiceId(tx, world);

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
      tokenId: EstforConstants.BRONZE_ARROW_HEAD,
      equipPosition: EstforTypes.EquipPosition.NONE
    },
    {
      ...EstforTypes.defaultItemInput,
      tokenId: EstforConstants.ARROW_SHAFT,
      equipPosition: EstforTypes.EquipPosition.NONE
    },
    {
      ...EstforTypes.defaultItemInput,
      tokenId: EstforConstants.FEATHER,
      equipPosition: EstforTypes.EquipPosition.NONE
    },
    {
      ...EstforTypes.defaultItemInput,
      tokenId: EstforConstants.BRONZE_ARROW,
      equipPosition: EstforTypes.EquipPosition.NONE
    }
  ]);

  return {queuedAction, rate, choiceId};
};

export const setupTravelling = async function (world: World, rate = RATE_MUL / 8, from = 0, to = 1) {
  const ACTION_TRAVEL_0 = 1000;
  let tx = await world.addActions([
    {
      actionId: ACTION_TRAVEL_0,
      info: {
        skill: EstforTypes.Skill.TRAVELING,
        xpPerHour: 0,
        minXP: 0,
        isDynamic: false,
        worldLocation: 0,
        isFullModeOnly: false,
        numSpawned: 0,
        handItemTokenIdRangeMin: EstforConstants.NONE,
        handItemTokenIdRangeMax: EstforConstants.NONE,
        isAvailable: true,
        actionChoiceRequired: true,
        successPercent: 100
      },
      guaranteedRewards: [],
      randomRewards: [],
      combatStats: EstforTypes.emptyCombatStats
    }
  ]);
  const actionId = await getActionId(tx, world);
  const ACTIONCHOICE_WALK_TO_1 = 1;
  // Walking from location 0 to 1
  tx = await world.addActionChoices(
    actionId,
    [ACTIONCHOICE_WALK_TO_1],
    [
      {
        ...defaultActionChoice,
        skill: EstforTypes.Skill.FARMING, // TODO: Change to AGILITY later
        xpPerHour: 0,
        inputTokenIds: [EstforConstants.NONE],
        inputAmounts: [from], // World location start
        outputTokenId: EstforConstants.NONE,
        outputAmount: to, // World location end
        rate
      }
    ]
  );
  const choiceId = await getActionChoiceId(tx, world);

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
    petId: EstforConstants.NONE
  };

  return {queuedAction};
};

export function checkPendingQueuedActionState(
  pendingQueuedActionState: any,
  consumed: Equipment[],
  produced: Equipment[],
  xpGained: number,
  elapsedTime: bigint | bigint[]
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

export const makeSigner = async (contract: BaseContract): Promise<HardhatEthersSigner> => {
  const signer = await ethers.getImpersonatedSigner(await contract.getAddress());
  await ethers.provider.send("hardhat_setBalance", [signer.address, "0x100000000000000000"]);
  return signer;
};

export const getXPFromLevel = (level: number) => {
  return EstforConstants.levelXp[level - 1];
};

export const MAX_LEVEL = 135;
