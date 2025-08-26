import {EstforConstants} from "@paintswap/estfor-definitions";
import {PassiveActionInput, Skill} from "@paintswap/estfor-definitions/types";
export const allPassiveActions: PassiveActionInput[] = [
  {
    actionId: EstforConstants.PASSIVE_ACTION_EGG_TIER1,
    info: {
      durationDays: 1,
      inputTokenIds: [EstforConstants.PAPER, EstforConstants.BONEMEAL, EstforConstants.ASH],
      inputAmounts: [5000, 50000, 50000],
      minSkills: [Skill.ALCHEMY],
      minLevels: [10],
      skipSuccessPercent: 0,
      worldLocation: 0,
      isFullModeOnly: true,
      isAvailable: true,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [
      {
        itemTokenId: EstforConstants.EGG_TIER1,
        rate: 1
      }
    ],
    randomRewards: []
  },
  {
    actionId: EstforConstants.PASSIVE_ACTION_EGG_TIER2,
    info: {
      durationDays: 1,
      inputTokenIds: [EstforConstants.EGG_TIER1],
      inputAmounts: [1],
      minSkills: [Skill.ALCHEMY, Skill.FISHING, Skill.COOKING],
      minLevels: [25, 30, 30],
      skipSuccessPercent: 0,
      worldLocation: 0,
      isFullModeOnly: true,
      isAvailable: true,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [
      {
        itemTokenId: EstforConstants.EGG_TIER2,
        rate: 1
      }
    ],
    randomRewards: []
  },
  {
    actionId: EstforConstants.PASSIVE_ACTION_EGG_TIER3,
    info: {
      durationDays: 2,
      inputTokenIds: [EstforConstants.EGG_TIER2],
      inputAmounts: [1],
      minSkills: [Skill.ALCHEMY, Skill.MINING, Skill.WOODCUTTING],
      minLevels: [35, 40, 40],
      skipSuccessPercent: 0,
      worldLocation: 0,
      isFullModeOnly: true,
      isAvailable: true,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [
      {
        itemTokenId: EstforConstants.EGG_TIER3,
        rate: 1
      }
    ],
    randomRewards: []
  },
  {
    actionId: EstforConstants.PASSIVE_ACTION_EGG_TIER4,
    info: {
      durationDays: 3,
      inputTokenIds: [EstforConstants.EGG_TIER3],
      inputAmounts: [1],
      minSkills: [Skill.ALCHEMY, Skill.SMITHING, Skill.FIREMAKING],
      minLevels: [45, 50, 50],
      skipSuccessPercent: 0,
      worldLocation: 0,
      isFullModeOnly: true,
      isAvailable: true,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [
      {
        itemTokenId: EstforConstants.EGG_TIER4,
        rate: 1
      }
    ],
    randomRewards: []
  },
  {
    actionId: EstforConstants.PASSIVE_ACTION_EGG_TIER5,
    info: {
      durationDays: 5,
      inputTokenIds: [EstforConstants.EGG_TIER4],
      inputAmounts: [1],
      minSkills: [Skill.ALCHEMY, Skill.FLETCHING, Skill.FORGING],
      minLevels: [55, 60, 40],
      skipSuccessPercent: 0,
      worldLocation: 0,
      isFullModeOnly: true,
      isAvailable: true,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [
      {
        itemTokenId: EstforConstants.EGG_TIER5,
        rate: 1
      }
    ],
    randomRewards: []
  },
  {
    actionId: EstforConstants.PASSIVE_ACTION_SECRET_EGG_1_TIER2,
    info: {
      durationDays: 1,
      inputTokenIds: [EstforConstants.SECRET_EGG_1_TIER1],
      inputAmounts: [1],
      minSkills: [Skill.ALCHEMY, Skill.FISHING, Skill.COOKING],
      minLevels: [25, 30, 30],
      skipSuccessPercent: 0,
      worldLocation: 0,
      isFullModeOnly: true,
      isAvailable: true,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [
      {
        itemTokenId: EstforConstants.SECRET_EGG_1_TIER2,
        rate: 1
      }
    ],
    randomRewards: []
  },
  {
    actionId: EstforConstants.PASSIVE_ACTION_SECRET_EGG_1_TIER3,
    info: {
      durationDays: 2,
      inputTokenIds: [EstforConstants.SECRET_EGG_1_TIER2],
      inputAmounts: [1],
      minSkills: [Skill.ALCHEMY, Skill.MINING, Skill.WOODCUTTING],
      minLevels: [35, 40, 40],
      skipSuccessPercent: 0,
      worldLocation: 0,
      isFullModeOnly: true,
      isAvailable: true,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [
      {
        itemTokenId: EstforConstants.SECRET_EGG_1_TIER3,
        rate: 1
      }
    ],
    randomRewards: []
  },
  {
    actionId: EstforConstants.PASSIVE_ACTION_SECRET_EGG_1_TIER4,
    info: {
      durationDays: 3,
      inputTokenIds: [EstforConstants.SECRET_EGG_1_TIER3],
      inputAmounts: [1],
      minSkills: [Skill.ALCHEMY, Skill.SMITHING, Skill.FIREMAKING],
      minLevels: [45, 50, 50],
      skipSuccessPercent: 0,
      worldLocation: 0,
      isFullModeOnly: true,
      isAvailable: true,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [
      {
        itemTokenId: EstforConstants.SECRET_EGG_1_TIER4,
        rate: 1
      }
    ],
    randomRewards: []
  },
  {
    actionId: EstforConstants.PASSIVE_ACTION_SECRET_EGG_1_TIER5,
    info: {
      durationDays: 5,
      inputTokenIds: [EstforConstants.SECRET_EGG_1_TIER4],
      inputAmounts: [1],
      minSkills: [Skill.ALCHEMY, Skill.FLETCHING, Skill.FORGING],
      minLevels: [55, 60, 40],
      skipSuccessPercent: 0,
      worldLocation: 0,
      isFullModeOnly: true,
      isAvailable: true,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [
      {
        itemTokenId: EstforConstants.SECRET_EGG_1_TIER5,
        rate: 1
      }
    ],
    randomRewards: []
  },
  {
    actionId: EstforConstants.PASSIVE_ACTION_SECRET_EGG_2_TIER2,
    info: {
      durationDays: 1,
      inputTokenIds: [EstforConstants.SECRET_EGG_2_TIER1],
      inputAmounts: [1],
      minSkills: [Skill.ALCHEMY, Skill.FISHING, Skill.COOKING],
      minLevels: [25, 30, 30],
      skipSuccessPercent: 0,
      worldLocation: 0,
      isFullModeOnly: true,
      isAvailable: true,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [
      {
        itemTokenId: EstforConstants.SECRET_EGG_2_TIER2,
        rate: 1
      }
    ],
    randomRewards: []
  },
  {
    actionId: EstforConstants.PASSIVE_ACTION_SECRET_EGG_2_TIER3,
    info: {
      durationDays: 2,
      inputTokenIds: [EstforConstants.SECRET_EGG_2_TIER2],
      inputAmounts: [1],
      minSkills: [Skill.ALCHEMY, Skill.MINING, Skill.WOODCUTTING],
      minLevels: [35, 40, 40],
      skipSuccessPercent: 0,
      worldLocation: 0,
      isFullModeOnly: true,
      isAvailable: true,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [
      {
        itemTokenId: EstforConstants.SECRET_EGG_2_TIER3,
        rate: 1
      }
    ],
    randomRewards: []
  },
  {
    actionId: EstforConstants.PASSIVE_ACTION_SECRET_EGG_2_TIER4,
    info: {
      durationDays: 3,
      inputTokenIds: [EstforConstants.SECRET_EGG_2_TIER3],
      inputAmounts: [1],
      minSkills: [Skill.ALCHEMY, Skill.SMITHING, Skill.FIREMAKING],
      minLevels: [45, 50, 50],
      skipSuccessPercent: 0,
      worldLocation: 0,
      isFullModeOnly: true,
      isAvailable: true,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [
      {
        itemTokenId: EstforConstants.SECRET_EGG_2_TIER4,
        rate: 1
      }
    ],
    randomRewards: []
  },
  {
    actionId: EstforConstants.PASSIVE_ACTION_SECRET_EGG_2_TIER5,
    info: {
      durationDays: 5,
      inputTokenIds: [EstforConstants.SECRET_EGG_2_TIER4],
      inputAmounts: [1],
      minSkills: [Skill.ALCHEMY, Skill.FLETCHING, Skill.FORGING],
      minLevels: [55, 60, 40],
      skipSuccessPercent: 0,
      worldLocation: 0,
      isFullModeOnly: true,
      isAvailable: true,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [
      {
        itemTokenId: EstforConstants.SECRET_EGG_2_TIER5,
        rate: 1
      }
    ],
    randomRewards: []
  },
  {
    actionId: EstforConstants.PASSIVE_ACTION_SECRET_EGG_3_TIER2,
    info: {
      durationDays: 1,
      inputTokenIds: [EstforConstants.SECRET_EGG_3_TIER1],
      inputAmounts: [1],
      minSkills: [Skill.ALCHEMY, Skill.FISHING, Skill.COOKING],
      minLevels: [25, 30, 30],
      skipSuccessPercent: 0,
      worldLocation: 0,
      isFullModeOnly: true,
      isAvailable: true,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [
      {
        itemTokenId: EstforConstants.SECRET_EGG_3_TIER2,
        rate: 1
      }
    ],
    randomRewards: []
  },
  {
    actionId: EstforConstants.PASSIVE_ACTION_SECRET_EGG_3_TIER3,
    info: {
      durationDays: 2,
      inputTokenIds: [EstforConstants.SECRET_EGG_3_TIER2],
      inputAmounts: [1],
      minSkills: [Skill.ALCHEMY, Skill.MINING, Skill.WOODCUTTING],
      minLevels: [35, 40, 40],
      skipSuccessPercent: 0,
      worldLocation: 0,
      isFullModeOnly: true,
      isAvailable: true,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [
      {
        itemTokenId: EstforConstants.SECRET_EGG_3_TIER3,
        rate: 1
      }
    ],
    randomRewards: []
  },
  {
    actionId: EstforConstants.PASSIVE_ACTION_SECRET_EGG_3_TIER4,
    info: {
      durationDays: 3,
      inputTokenIds: [EstforConstants.SECRET_EGG_3_TIER3],
      inputAmounts: [1],
      minSkills: [Skill.ALCHEMY, Skill.SMITHING, Skill.FIREMAKING],
      minLevels: [45, 50, 50],
      skipSuccessPercent: 0,
      worldLocation: 0,
      isFullModeOnly: true,
      isAvailable: true,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [
      {
        itemTokenId: EstforConstants.SECRET_EGG_3_TIER4,
        rate: 1
      }
    ],
    randomRewards: []
  },
  {
    actionId: EstforConstants.PASSIVE_ACTION_SECRET_EGG_3_TIER5,
    info: {
      durationDays: 5,
      inputTokenIds: [EstforConstants.SECRET_EGG_3_TIER4],
      inputAmounts: [1],
      minSkills: [Skill.ALCHEMY, Skill.FLETCHING, Skill.FORGING],
      minLevels: [55, 60, 40],
      skipSuccessPercent: 0,
      worldLocation: 0,
      isFullModeOnly: true,
      isAvailable: true,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [
      {
        itemTokenId: EstforConstants.SECRET_EGG_3_TIER5,
        rate: 1
      }
    ],
    randomRewards: []
  },
  {
    actionId: EstforConstants.PASSIVE_ACTION_SECRET_EGG_4_TIER2,
    info: {
      durationDays: 1,
      inputTokenIds: [EstforConstants.SECRET_EGG_4_TIER1],
      inputAmounts: [1],
      minSkills: [Skill.ALCHEMY, Skill.FISHING, Skill.COOKING],
      minLevels: [25, 30, 30],
      skipSuccessPercent: 0,
      worldLocation: 0,
      isFullModeOnly: true,
      isAvailable: true,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [
      {
        itemTokenId: EstforConstants.SECRET_EGG_4_TIER2,
        rate: 1
      }
    ],
    randomRewards: []
  },
  {
    actionId: EstforConstants.PASSIVE_ACTION_SECRET_EGG_4_TIER3,
    info: {
      durationDays: 2,
      inputTokenIds: [EstforConstants.SECRET_EGG_4_TIER2],
      inputAmounts: [1],
      minSkills: [Skill.ALCHEMY, Skill.MINING, Skill.WOODCUTTING],
      minLevels: [35, 40, 40],
      skipSuccessPercent: 0,
      worldLocation: 0,
      isFullModeOnly: true,
      isAvailable: true,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [
      {
        itemTokenId: EstforConstants.SECRET_EGG_4_TIER3,
        rate: 1
      }
    ],
    randomRewards: []
  },
  {
    actionId: EstforConstants.PASSIVE_ACTION_SECRET_EGG_4_TIER4,
    info: {
      durationDays: 3,
      inputTokenIds: [EstforConstants.SECRET_EGG_4_TIER3],
      inputAmounts: [1],
      minSkills: [Skill.ALCHEMY, Skill.SMITHING, Skill.FIREMAKING],
      minLevels: [45, 50, 50],
      skipSuccessPercent: 0,
      worldLocation: 0,
      isFullModeOnly: true,
      isAvailable: true,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [
      {
        itemTokenId: EstforConstants.SECRET_EGG_4_TIER4,
        rate: 1
      }
    ],
    randomRewards: []
  },
  {
    actionId: EstforConstants.PASSIVE_ACTION_SECRET_EGG_4_TIER5,
    info: {
      durationDays: 5,
      inputTokenIds: [EstforConstants.SECRET_EGG_4_TIER4],
      inputAmounts: [1],
      minSkills: [Skill.ALCHEMY, Skill.FLETCHING, Skill.FORGING],
      minLevels: [55, 60, 40],
      skipSuccessPercent: 0,
      worldLocation: 0,
      isFullModeOnly: true,
      isAvailable: true,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [
      {
        itemTokenId: EstforConstants.SECRET_EGG_4_TIER5,
        rate: 1
      }
    ],
    randomRewards: []
  },
  {
    actionId: EstforConstants.PASSIVE_ACTION_ANNIV1_EGG_TIER2,
    info: {
      durationDays: 1,
      inputTokenIds: [EstforConstants.ANNIV1_EGG_TIER1],
      inputAmounts: [1],
      minSkills: [Skill.ALCHEMY, Skill.FISHING, Skill.COOKING],
      minLevels: [10, 15, 15],
      skipSuccessPercent: 0,
      worldLocation: 0,
      isFullModeOnly: true,
      isAvailable: true,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [
      {
        itemTokenId: EstforConstants.ANNIV1_EGG_TIER2,
        rate: 1
      }
    ],
    randomRewards: []
  },
  {
    actionId: EstforConstants.PASSIVE_ACTION_ANNIV1_EGG_TIER3,
    info: {
      durationDays: 2,
      inputTokenIds: [EstforConstants.ANNIV1_EGG_TIER2],
      inputAmounts: [1],
      minSkills: [Skill.ALCHEMY, Skill.MINING, Skill.WOODCUTTING],
      minLevels: [20, 20, 20],
      skipSuccessPercent: 0,
      worldLocation: 0,
      isFullModeOnly: true,
      isAvailable: true,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [
      {
        itemTokenId: EstforConstants.ANNIV1_EGG_TIER3,
        rate: 1
      }
    ],
    randomRewards: []
  },
  {
    actionId: EstforConstants.PASSIVE_ACTION_ANNIV1_EGG_TIER4,
    info: {
      durationDays: 3,
      inputTokenIds: [EstforConstants.ANNIV1_EGG_TIER3],
      inputAmounts: [1],
      minSkills: [Skill.ALCHEMY, Skill.SMITHING, Skill.FIREMAKING],
      minLevels: [30, 25, 25],
      skipSuccessPercent: 0,
      worldLocation: 0,
      isFullModeOnly: true,
      isAvailable: true,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [
      {
        itemTokenId: EstforConstants.ANNIV1_EGG_TIER4,
        rate: 1
      }
    ],
    randomRewards: []
  },
  {
    actionId: EstforConstants.PASSIVE_ACTION_ANNIV1_EGG_TIER5,
    info: {
      durationDays: 5,
      inputTokenIds: [EstforConstants.ANNIV1_EGG_TIER4],
      inputAmounts: [1],
      minSkills: [Skill.ALCHEMY, Skill.FLETCHING, Skill.FORGING],
      minLevels: [40, 30, 10],
      skipSuccessPercent: 0,
      worldLocation: 0,
      isFullModeOnly: true,
      isAvailable: true,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [
      {
        itemTokenId: EstforConstants.ANNIV1_EGG_TIER5,
        rate: 1
      }
    ],
    randomRewards: []
  },
  {
    actionId: EstforConstants.PASSIVE_ACTION_KRAGSTYR_EGG_TIER1,
    info: {
      durationDays: 1,
      inputTokenIds: [EstforConstants.LIFFYN, EstforConstants.VANAGLOT, EstforConstants.FANGENSTORM],
      inputAmounts: [1, 1, 1],
      minSkills: [Skill.ALCHEMY],
      minLevels: [1],
      skipSuccessPercent: 0,
      worldLocation: 0,
      isFullModeOnly: true,
      isAvailable: false,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [
      {
        itemTokenId: EstforConstants.KRAGSTYR_EGG_TIER1,
        rate: 1
      }
    ],
    randomRewards: []
  },
  {
    actionId: EstforConstants.PASSIVE_ACTION_KRAGSTYR_EGG_TIER2,
    info: {
      durationDays: 1,
      inputTokenIds: [EstforConstants.KRAGSTYR_EGG_TIER1],
      inputAmounts: [1],
      minSkills: [Skill.ALCHEMY, Skill.FISHING, Skill.COOKING],
      minLevels: [10, 15, 15],
      skipSuccessPercent: 0,
      worldLocation: 0,
      isFullModeOnly: true,
      isAvailable: true,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [
      {
        itemTokenId: EstforConstants.KRAGSTYR_EGG_TIER2,
        rate: 1
      }
    ],
    randomRewards: []
  },
  {
    actionId: EstforConstants.PASSIVE_ACTION_KRAGSTYR_EGG_TIER3,
    info: {
      durationDays: 2,
      inputTokenIds: [EstforConstants.KRAGSTYR_EGG_TIER2],
      inputAmounts: [1],
      minSkills: [Skill.ALCHEMY, Skill.MINING, Skill.WOODCUTTING],
      minLevels: [20, 20, 20],
      skipSuccessPercent: 0,
      worldLocation: 0,
      isFullModeOnly: true,
      isAvailable: true,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [
      {
        itemTokenId: EstforConstants.KRAGSTYR_EGG_TIER3,
        rate: 1
      }
    ],
    randomRewards: []
  },
  {
    actionId: EstforConstants.PASSIVE_ACTION_KRAGSTYR_EGG_TIER4,
    info: {
      durationDays: 3,
      inputTokenIds: [EstforConstants.KRAGSTYR_EGG_TIER3],
      inputAmounts: [1],
      minSkills: [Skill.ALCHEMY, Skill.SMITHING, Skill.FIREMAKING],
      minLevels: [30, 25, 25],
      skipSuccessPercent: 0,
      worldLocation: 0,
      isFullModeOnly: true,
      isAvailable: true,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [
      {
        itemTokenId: EstforConstants.KRAGSTYR_EGG_TIER4,
        rate: 1
      }
    ],
    randomRewards: []
  },
  {
    actionId: EstforConstants.PASSIVE_ACTION_KRAGSTYR_EGG_TIER5,
    info: {
      durationDays: 5,
      inputTokenIds: [EstforConstants.KRAGSTYR_EGG_TIER4],
      inputAmounts: [1],
      minSkills: [Skill.ALCHEMY, Skill.FLETCHING, Skill.FORGING],
      minLevels: [40, 30, 20],
      skipSuccessPercent: 0,
      worldLocation: 0,
      isFullModeOnly: true,
      isAvailable: true,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [
      {
        itemTokenId: EstforConstants.KRAGSTYR_EGG_TIER5,
        rate: 1
      }
    ],
    randomRewards: []
  },
  {
    actionId: EstforConstants.PASSIVE_ACTION_ANNIV2_EGG_TIER2,
    info: {
      durationDays: 1,
      inputTokenIds: [EstforConstants.ANNIV2_EGG_TIER1],
      inputAmounts: [1],
      minSkills: [Skill.ALCHEMY, Skill.FISHING, Skill.COOKING],
      minLevels: [10, 15, 15],
      skipSuccessPercent: 0,
      worldLocation: 0,
      isFullModeOnly: true,
      isAvailable: true,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [
      {
        itemTokenId: EstforConstants.ANNIV2_EGG_TIER2,
        rate: 1
      }
    ],
    randomRewards: []
  },
  {
    actionId: EstforConstants.PASSIVE_ACTION_ANNIV2_EGG_TIER3,
    info: {
      durationDays: 2,
      inputTokenIds: [EstforConstants.ANNIV2_EGG_TIER2],
      inputAmounts: [1],
      minSkills: [Skill.ALCHEMY, Skill.MINING, Skill.WOODCUTTING],
      minLevels: [20, 20, 20],
      skipSuccessPercent: 0,
      worldLocation: 0,
      isFullModeOnly: true,
      isAvailable: true,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [
      {
        itemTokenId: EstforConstants.ANNIV2_EGG_TIER3,
        rate: 1
      }
    ],
    randomRewards: []
  },
  {
    actionId: EstforConstants.PASSIVE_ACTION_ANNIV2_EGG_TIER4,
    info: {
      durationDays: 3,
      inputTokenIds: [EstforConstants.ANNIV2_EGG_TIER3],
      inputAmounts: [1],
      minSkills: [Skill.ALCHEMY, Skill.SMITHING, Skill.FIREMAKING],
      minLevels: [30, 25, 25],
      skipSuccessPercent: 0,
      worldLocation: 0,
      isFullModeOnly: true,
      isAvailable: true,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [
      {
        itemTokenId: EstforConstants.ANNIV2_EGG_TIER4,
        rate: 1
      }
    ],
    randomRewards: []
  },
  {
    actionId: EstforConstants.PASSIVE_ACTION_ANNIV2_EGG_TIER5,
    info: {
      durationDays: 5,
      inputTokenIds: [EstforConstants.ANNIV2_EGG_TIER4],
      inputAmounts: [1],
      minSkills: [Skill.ALCHEMY, Skill.FLETCHING, Skill.FORGING],
      minLevels: [40, 30, 10],
      skipSuccessPercent: 0,
      worldLocation: 0,
      isFullModeOnly: true,
      isAvailable: true,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [
      {
        itemTokenId: EstforConstants.ANNIV2_EGG_TIER5,
        rate: 1
      }
    ],
    randomRewards: []
  }
];
