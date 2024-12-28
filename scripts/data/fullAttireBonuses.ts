import {EstforConstants} from "@paintswap/estfor-definitions";
import {Skill} from "@paintswap/estfor-definitions/types";

type FullAttireBonus = {
  skill: Skill;
  itemTokenIds: [number, number, number, number, number];
  bonusXPPercent: number;
  bonusRewardsPercent: number;
};

export const allFullAttireBonuses: FullAttireBonus[] = [
  {
    skill: Skill.WOODCUTTING,
    itemTokenIds: [
      EstforConstants.NATURE_MASK,
      EstforConstants.NATURE_BODY,
      EstforConstants.NATURE_BRACERS,
      EstforConstants.NATURE_TROUSERS,
      EstforConstants.NATURE_BOOTS
    ],
    bonusXPPercent: 3,
    bonusRewardsPercent: 0
  },
  {
    skill: Skill.THIEVING,
    itemTokenIds: [
      EstforConstants.NATUOW_HOOD,
      EstforConstants.NATUOW_BODY,
      EstforConstants.NATUOW_BRACERS,
      EstforConstants.NATUOW_TASSETS,
      EstforConstants.NATUOW_BOOTS
    ],
    bonusXPPercent: 3,
    bonusRewardsPercent: 3
  },
  {
    skill: Skill.CRAFTING,
    itemTokenIds: [
      EstforConstants.BAT_WING_HAT,
      EstforConstants.BAT_WING_BODY,
      EstforConstants.BAT_WING_BRACERS,
      EstforConstants.BAT_WING_TROUSERS,
      EstforConstants.BAT_WING_BOOTS
    ],
    bonusXPPercent: 3,
    bonusRewardsPercent: 0
  }
];
