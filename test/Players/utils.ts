import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {
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
} from "../../scripts/utils";
import {playersFixture} from "./PlayersFixture";

export const setupBasicWoodcutting = async () => {
  const {itemNFT, world} = await loadFixture(playersFixture);

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
      isAvailable: true,
      actionChoiceRequired: false,
    },
    guaranteedRewards: [{itemTokenId: LOG, rate}],
    randomRewards: [],
    combatStats: emptyCombatStats,
  });
  const actionId = await getActionId(tx);

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

  return {queuedAction, rate, timespan};
};

export const getXPFromLevel = (level: number) => {
  return xp[level - 1];
};

const xp = [
  0, 84, 174, 270, 374, 486, 606, 734, 872, 1021, 1179, 1350, 1532, 1728, 1938, 2163, 2404, 2662, 2939, 3236, 3553,
  3894, 4258, 4649, 5067, 5515, 5995, 6510, 7060, 7650, 8282, 8959, 9685, 10461, 11294, 12185, 13140, 14162, 15258,
  16432, 17689, 19036, 20479, 22025, 23681, 25456, 27357, 29393, 31575, 33913, 36418, 39102, 41977, 45058, 48359, 51896,
  55686, 59747, 64098, 68761, 73757, 79110, 84847, 90995, 97582, 104641, 112206, 120312, 128998, 138307, 148283, 158973,
  170430, 182707, 195864, 209963, 225074, 241267, 258621, 277219, 297150, 318511, 341403, 365936, 392228, 420406,
  450605, 482969, 517654, 554828, 594667, 637364, 683124, 732166, 784726, 841057, 901428, 966131, 1035476,
];
