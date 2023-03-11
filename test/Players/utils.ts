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
