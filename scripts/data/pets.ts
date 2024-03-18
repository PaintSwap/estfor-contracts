import {EstforConstants} from "@paintswap/estfor-definitions";
import {BasePetInput, PetEnhancementType, PetSkin, Skill} from "@paintswap/estfor-definitions/types";

export const allBasePets: BasePetInput[] = [
  {
    description: "I'm a pet and you shall hear me roar",
    tier: 1,
    skin: PetSkin.DEFAULT,
    enhancementType: PetEnhancementType.MELEE,
    baseId: EstforConstants.PET_DEFAULT_MELEE_TIER1,
    skillEnhancements: [Skill.MELEE, Skill.NONE],
    percentageMins: [1, 0],
    percentageMaxs: [10, 0],
    percentageIncrements: [1, 0],
  },
];
