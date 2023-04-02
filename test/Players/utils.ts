import {EstforConstants, EstforTypes} from "@paintswap/estfor-definitions";
import {ItemNFT, World} from "../../typechain-types";
import {getActionId} from "../utils";

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

export const getXPFromLevel = (level: number) => {
  return EstforConstants.levelXp[level - 1];
};
