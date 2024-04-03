import {EstforConstants} from "@paintswap/estfor-definitions";
import {PassiveActionInput, Skill} from "@paintswap/estfor-definitions/types";
export const allPassiveActions: PassiveActionInput[] = [
  {
    actionId: EstforConstants.PASSIVE_ACTION_EGG_TIER1,
    info: {
      durationDays: 3,
      inputTokenIds: [EstforConstants.PAPER, EstforConstants.BONEMEAL, EstforConstants.ASH],
      inputAmounts: [5000, 50000, 50000],
      minSkills: [Skill.ALCHEMY],
      minLevels: [20],
      skipSuccessPercent: 0,
      worldLocation: 0,
      isFullModeOnly: true,
    },
    guaranteedRewards: [
      {
        itemTokenId: EstforConstants.EGG_TIER1,
        rate: 1,
      },
    ],
    randomRewards: [],
  },
  {
    actionId: EstforConstants.PASSIVE_ACTION_EGG_TIER2,
    info: {
      durationDays: 5,
      inputTokenIds: [EstforConstants.EGG_TIER1],
      inputAmounts: [1],
      minSkills: [Skill.ALCHEMY],
      minLevels: [40],
      skipSuccessPercent: 0,
      worldLocation: 0,
      isFullModeOnly: true,
    },
    guaranteedRewards: [
      {
        itemTokenId: EstforConstants.EGG_TIER2,
        rate: 1,
      },
    ],
    randomRewards: [],
  },
  {
    actionId: EstforConstants.PASSIVE_ACTION_EGG_TIER3,
    info: {
      durationDays: 8,
      inputTokenIds: [EstforConstants.EGG_TIER2],
      inputAmounts: [1],
      minSkills: [Skill.ALCHEMY],
      minLevels: [60],
      skipSuccessPercent: 0,
      worldLocation: 0,
      isFullModeOnly: true,
    },
    guaranteedRewards: [
      {
        itemTokenId: EstforConstants.EGG_TIER3,
        rate: 1,
      },
    ],
    randomRewards: [],
  },
  {
    actionId: EstforConstants.PASSIVE_ACTION_EGG_TIER4,
    info: {
      durationDays: 12,
      inputTokenIds: [EstforConstants.EGG_TIER3],
      inputAmounts: [1],
      minSkills: [Skill.ALCHEMY],
      minLevels: [80],
      skipSuccessPercent: 0,
      worldLocation: 0,
      isFullModeOnly: true,
    },
    guaranteedRewards: [
      {
        itemTokenId: EstforConstants.EGG_TIER4,
        rate: 1,
      },
    ],
    randomRewards: [],
  },
  {
    actionId: EstforConstants.PASSIVE_ACTION_EGG_TIER5,
    info: {
      durationDays: 18,
      inputTokenIds: [EstforConstants.EGG_TIER4],
      inputAmounts: [1],
      minSkills: [Skill.ALCHEMY],
      minLevels: [100],
      skipSuccessPercent: 0,
      worldLocation: 0,
      isFullModeOnly: true,
    },
    guaranteedRewards: [
      {
        itemTokenId: EstforConstants.EGG_TIER5,
        rate: 1,
      },
    ],
    randomRewards: [],
  },
  {
    actionId: EstforConstants.PASSIVE_ACTION_SECRET_EGG_1_TIER2,
    info: {
      durationDays: 5,
      inputTokenIds: [EstforConstants.SECRET_EGG_1_TIER1],
      inputAmounts: [1],
      minSkills: [Skill.ALCHEMY],
      minLevels: [40],
      skipSuccessPercent: 0,
      worldLocation: 0,
      isFullModeOnly: true,
    },
    guaranteedRewards: [
      {
        itemTokenId: EstforConstants.SECRET_EGG_1_TIER2,
        rate: 1,
      },
    ],
    randomRewards: [],
  },
  {
    actionId: EstforConstants.PASSIVE_ACTION_SECRET_EGG_1_TIER3,
    info: {
      durationDays: 8,
      inputTokenIds: [EstforConstants.SECRET_EGG_1_TIER2],
      inputAmounts: [1],
      minSkills: [Skill.ALCHEMY],
      minLevels: [60],
      skipSuccessPercent: 0,
      worldLocation: 0,
      isFullModeOnly: true,
    },
    guaranteedRewards: [
      {
        itemTokenId: EstforConstants.SECRET_EGG_1_TIER3,
        rate: 1,
      },
    ],
    randomRewards: [],
  },
  {
    actionId: EstforConstants.PASSIVE_ACTION_SECRET_EGG_1_TIER4,
    info: {
      durationDays: 12,
      inputTokenIds: [EstforConstants.SECRET_EGG_1_TIER3],
      inputAmounts: [1],
      minSkills: [Skill.ALCHEMY],
      minLevels: [80],
      skipSuccessPercent: 0,
      worldLocation: 0,
      isFullModeOnly: true,
    },
    guaranteedRewards: [
      {
        itemTokenId: EstforConstants.SECRET_EGG_1_TIER4,
        rate: 1,
      },
    ],
    randomRewards: [],
  },
  {
    actionId: EstforConstants.PASSIVE_ACTION_SECRET_EGG_1_TIER5,
    info: {
      durationDays: 18,
      inputTokenIds: [EstforConstants.SECRET_EGG_1_TIER4],
      inputAmounts: [1],
      minSkills: [Skill.ALCHEMY],
      minLevels: [100],
      skipSuccessPercent: 0,
      worldLocation: 0,
      isFullModeOnly: true,
    },
    guaranteedRewards: [
      {
        itemTokenId: EstforConstants.SECRET_EGG_1_TIER5,
        rate: 1,
      },
    ],
    randomRewards: [],
  },
  {
    actionId: EstforConstants.PASSIVE_ACTION_SECRET_EGG_2_TIER2,
    info: {
      durationDays: 5,
      inputTokenIds: [EstforConstants.SECRET_EGG_2_TIER1],
      inputAmounts: [1],
      minSkills: [Skill.ALCHEMY],
      minLevels: [40],
      skipSuccessPercent: 0,
      worldLocation: 0,
      isFullModeOnly: true,
    },
    guaranteedRewards: [
      {
        itemTokenId: EstforConstants.SECRET_EGG_2_TIER2,
        rate: 1,
      },
    ],
    randomRewards: [],
  },
  {
    actionId: EstforConstants.PASSIVE_ACTION_SECRET_EGG_2_TIER3,
    info: {
      durationDays: 8,
      inputTokenIds: [EstforConstants.SECRET_EGG_2_TIER2],
      inputAmounts: [1],
      minSkills: [Skill.ALCHEMY],
      minLevels: [60],
      skipSuccessPercent: 0,
      worldLocation: 0,
      isFullModeOnly: true,
    },
    guaranteedRewards: [
      {
        itemTokenId: EstforConstants.SECRET_EGG_2_TIER3,
        rate: 1,
      },
    ],
    randomRewards: [],
  },
  {
    actionId: EstforConstants.PASSIVE_ACTION_SECRET_EGG_2_TIER4,
    info: {
      durationDays: 12,
      inputTokenIds: [EstforConstants.SECRET_EGG_2_TIER3],
      inputAmounts: [1],
      minSkills: [Skill.ALCHEMY],
      minLevels: [80],
      skipSuccessPercent: 0,
      worldLocation: 0,
      isFullModeOnly: true,
    },
    guaranteedRewards: [
      {
        itemTokenId: EstforConstants.SECRET_EGG_2_TIER4,
        rate: 1,
      },
    ],
    randomRewards: [],
  },
  {
    actionId: EstforConstants.PASSIVE_ACTION_SECRET_EGG_2_TIER5,
    info: {
      durationDays: 18,
      inputTokenIds: [EstforConstants.SECRET_EGG_2_TIER4],
      inputAmounts: [1],
      minSkills: [Skill.ALCHEMY],
      minLevels: [100],
      skipSuccessPercent: 0,
      worldLocation: 0,
      isFullModeOnly: true,
    },
    guaranteedRewards: [
      {
        itemTokenId: EstforConstants.SECRET_EGG_2_TIER5,
        rate: 1,
      },
    ],
    randomRewards: [],
  },
  {
    actionId: EstforConstants.PASSIVE_ACTION_SECRET_EGG_3_TIER2,
    info: {
      durationDays: 5,
      inputTokenIds: [EstforConstants.SECRET_EGG_3_TIER1],
      inputAmounts: [1],
      minSkills: [Skill.ALCHEMY],
      minLevels: [40],
      skipSuccessPercent: 0,
      worldLocation: 0,
      isFullModeOnly: true,
    },
    guaranteedRewards: [
      {
        itemTokenId: EstforConstants.SECRET_EGG_3_TIER2,
        rate: 1,
      },
    ],
    randomRewards: [],
  },
  {
    actionId: EstforConstants.PASSIVE_ACTION_SECRET_EGG_3_TIER3,
    info: {
      durationDays: 8,
      inputTokenIds: [EstforConstants.SECRET_EGG_3_TIER2],
      inputAmounts: [1],
      minSkills: [Skill.ALCHEMY],
      minLevels: [60],
      skipSuccessPercent: 0,
      worldLocation: 0,
      isFullModeOnly: true,
    },
    guaranteedRewards: [
      {
        itemTokenId: EstforConstants.SECRET_EGG_3_TIER3,
        rate: 1,
      },
    ],
    randomRewards: [],
  },
  {
    actionId: EstforConstants.PASSIVE_ACTION_SECRET_EGG_3_TIER4,
    info: {
      durationDays: 12,
      inputTokenIds: [EstforConstants.SECRET_EGG_3_TIER3],
      inputAmounts: [1],
      minSkills: [Skill.ALCHEMY],
      minLevels: [80],
      skipSuccessPercent: 0,
      worldLocation: 0,
      isFullModeOnly: true,
    },
    guaranteedRewards: [
      {
        itemTokenId: EstforConstants.SECRET_EGG_3_TIER4,
        rate: 1,
      },
    ],
    randomRewards: [],
  },
  {
    actionId: EstforConstants.PASSIVE_ACTION_SECRET_EGG_3_TIER5,
    info: {
      durationDays: 18,
      inputTokenIds: [EstforConstants.SECRET_EGG_3_TIER4],
      inputAmounts: [1],
      minSkills: [Skill.ALCHEMY],
      minLevels: [100],
      skipSuccessPercent: 0,
      worldLocation: 0,
      isFullModeOnly: true,
    },
    guaranteedRewards: [
      {
        itemTokenId: EstforConstants.SECRET_EGG_3_TIER5,
        rate: 1,
      },
    ],
    randomRewards: [],
  },
  {
    actionId: EstforConstants.PASSIVE_ACTION_SECRET_EGG_4_TIER2,
    info: {
      durationDays: 5,
      inputTokenIds: [EstforConstants.SECRET_EGG_4_TIER1],
      inputAmounts: [1],
      minSkills: [Skill.ALCHEMY],
      minLevels: [40],
      skipSuccessPercent: 0,
      worldLocation: 0,
      isFullModeOnly: true,
    },
    guaranteedRewards: [
      {
        itemTokenId: EstforConstants.SECRET_EGG_4_TIER2,
        rate: 1,
      },
    ],
    randomRewards: [],
  },
  {
    actionId: EstforConstants.PASSIVE_ACTION_SECRET_EGG_4_TIER3,
    info: {
      durationDays: 8,
      inputTokenIds: [EstforConstants.SECRET_EGG_4_TIER2],
      inputAmounts: [1],
      minSkills: [Skill.ALCHEMY],
      minLevels: [60],
      skipSuccessPercent: 0,
      worldLocation: 0,
      isFullModeOnly: true,
    },
    guaranteedRewards: [
      {
        itemTokenId: EstforConstants.SECRET_EGG_4_TIER3,
        rate: 1,
      },
    ],
    randomRewards: [],
  },
  {
    actionId: EstforConstants.PASSIVE_ACTION_SECRET_EGG_4_TIER4,
    info: {
      durationDays: 12,
      inputTokenIds: [EstforConstants.SECRET_EGG_4_TIER3],
      inputAmounts: [1],
      minSkills: [Skill.ALCHEMY],
      minLevels: [80],
      skipSuccessPercent: 0,
      worldLocation: 0,
      isFullModeOnly: true,
    },
    guaranteedRewards: [
      {
        itemTokenId: EstforConstants.SECRET_EGG_4_TIER4,
        rate: 1,
      },
    ],
    randomRewards: [],
  },
  {
    actionId: EstforConstants.PASSIVE_ACTION_SECRET_EGG_4_TIER5,
    info: {
      durationDays: 18,
      inputTokenIds: [EstforConstants.SECRET_EGG_4_TIER4],
      inputAmounts: [1],
      minSkills: [Skill.ALCHEMY],
      minLevels: [100],
      skipSuccessPercent: 0,
      worldLocation: 0,
      isFullModeOnly: true,
    },
    guaranteedRewards: [
      {
        itemTokenId: EstforConstants.SECRET_EGG_4_TIER5,
        rate: 1,
      },
    ],
    randomRewards: [],
  },
];
