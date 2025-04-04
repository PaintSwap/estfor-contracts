import {EstforConstants} from "@paintswap/estfor-definitions";
import {ActionInput, Skill} from "@paintswap/estfor-definitions/types";
export const allActions: ActionInput[] = [
  {
    actionId: EstforConstants.ACTION_WOODCUTTING_LOG,
    info: {
      skill: Skill.WOODCUTTING,
      isAvailable: true,
      actionChoiceRequired: false,
      xpPerHour: 25,
      numSpawned: 0 * 1000,
      minXP: 0,
      handItemTokenIdRangeMin: EstforConstants.BRONZE_AXE,
      handItemTokenIdRangeMax: EstforConstants.WOODCUTTING_MAX,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: false,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [{itemTokenId: EstforConstants.LOG, rate: 120 * 10}],
    randomRewards: [],
    combatStats: {
      meleeAttack: 0,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangedDefence: 0,
      health: 0
    }
  },
  {
    actionId: EstforConstants.ACTION_WOODCUTTING_OAK,
    info: {
      skill: Skill.WOODCUTTING,
      isAvailable: true,
      actionChoiceRequired: false,
      xpPerHour: 45,
      numSpawned: 0 * 1000,
      minXP: 1021,
      handItemTokenIdRangeMin: EstforConstants.IRON_AXE,
      handItemTokenIdRangeMax: EstforConstants.WOODCUTTING_MAX,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: false,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [{itemTokenId: EstforConstants.OAK_LOG, rate: 100 * 10}],
    randomRewards: [],
    combatStats: {
      meleeAttack: 0,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangedDefence: 0,
      health: 0
    }
  },
  {
    actionId: EstforConstants.ACTION_WOODCUTTING_WILLOW,
    info: {
      skill: Skill.WOODCUTTING,
      isAvailable: true,
      actionChoiceRequired: false,
      xpPerHour: 65,
      numSpawned: 0 * 1000,
      minXP: 7650,
      handItemTokenIdRangeMin: EstforConstants.MITHRIL_AXE,
      handItemTokenIdRangeMax: EstforConstants.WOODCUTTING_MAX,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: false,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [{itemTokenId: EstforConstants.WILLOW_LOG, rate: 90 * 10}],
    randomRewards: [],
    combatStats: {
      meleeAttack: 0,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangedDefence: 0,
      health: 0
    }
  },
  {
    actionId: EstforConstants.ACTION_WOODCUTTING_MAPLE,
    info: {
      skill: Skill.WOODCUTTING,
      isAvailable: true,
      actionChoiceRequired: false,
      xpPerHour: 130,
      numSpawned: 0 * 1000,
      minXP: 23681,
      handItemTokenIdRangeMin: EstforConstants.ADAMANTINE_AXE,
      handItemTokenIdRangeMax: EstforConstants.WOODCUTTING_MAX,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: false,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [{itemTokenId: EstforConstants.MAPLE_LOG, rate: 80 * 10}],
    randomRewards: [],
    combatStats: {
      meleeAttack: 0,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangedDefence: 0,
      health: 0
    }
  },
  {
    actionId: EstforConstants.ACTION_WOODCUTTING_REDWOOD,
    info: {
      skill: Skill.WOODCUTTING,
      isAvailable: true,
      actionChoiceRequired: false,
      xpPerHour: 290,
      numSpawned: 0 * 1000,
      minXP: 48359,
      handItemTokenIdRangeMin: EstforConstants.RUNITE_AXE,
      handItemTokenIdRangeMax: EstforConstants.WOODCUTTING_MAX,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: false,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [{itemTokenId: EstforConstants.REDWOOD_LOG, rate: 75 * 10}],
    randomRewards: [],
    combatStats: {
      meleeAttack: 0,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangedDefence: 0,
      health: 0
    }
  },
  {
    actionId: EstforConstants.ACTION_WOODCUTTING_MAGICAL,
    info: {
      skill: Skill.WOODCUTTING,
      isAvailable: true,
      actionChoiceRequired: false,
      xpPerHour: 360,
      numSpawned: 0 * 1000,
      minXP: 68761,
      handItemTokenIdRangeMin: EstforConstants.TITANIUM_AXE,
      handItemTokenIdRangeMax: EstforConstants.WOODCUTTING_MAX,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: false,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [{itemTokenId: EstforConstants.MAGICAL_LOG, rate: 72 * 10}],
    randomRewards: [],
    combatStats: {
      meleeAttack: 0,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangedDefence: 0,
      health: 0
    }
  },
  {
    actionId: EstforConstants.ACTION_WOODCUTTING_ASH,
    info: {
      skill: Skill.WOODCUTTING,
      isAvailable: true,
      actionChoiceRequired: false,
      xpPerHour: 480,
      numSpawned: 0 * 1000,
      minXP: 138307,
      handItemTokenIdRangeMin: EstforConstants.ORICHALCUM_AXE,
      handItemTokenIdRangeMax: EstforConstants.WOODCUTTING_MAX,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: false,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [{itemTokenId: EstforConstants.ASH_LOG, rate: 60 * 10}],
    randomRewards: [],
    combatStats: {
      meleeAttack: 0,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangedDefence: 0,
      health: 0
    }
  },
  {
    actionId: EstforConstants.ACTION_WOODCUTTING_ENCHANTED,
    info: {
      skill: Skill.WOODCUTTING,
      isAvailable: true,
      actionChoiceRequired: false,
      xpPerHour: 570,
      numSpawned: 0 * 1000,
      minXP: 392228,
      handItemTokenIdRangeMin: EstforConstants.ORICHALCUM_AXE,
      handItemTokenIdRangeMax: EstforConstants.WOODCUTTING_MAX,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: false,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [{itemTokenId: EstforConstants.ENCHANTED_LOG, rate: 40 * 10}],
    randomRewards: [],
    combatStats: {
      meleeAttack: 0,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangedDefence: 0,
      health: 0
    }
  },
  {
    actionId: EstforConstants.ACTION_WOODCUTTING_LIVING,
    info: {
      skill: Skill.WOODCUTTING,
      isAvailable: true,
      actionChoiceRequired: false,
      xpPerHour: 680,
      numSpawned: 0 * 1000,
      minXP: 784726,
      handItemTokenIdRangeMin: EstforConstants.ORICHALCUM_AXE,
      handItemTokenIdRangeMax: EstforConstants.WOODCUTTING_MAX,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: false,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [{itemTokenId: EstforConstants.LIVING_LOG, rate: 36 * 10}],
    randomRewards: [],
    combatStats: {
      meleeAttack: 0,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangedDefence: 0,
      health: 0
    }
  },
  {
    actionId: EstforConstants.ACTION_WOODCUTTING_SECLUDED_FOREST,
    info: {
      skill: Skill.WOODCUTTING,
      isAvailable: true,
      actionChoiceRequired: false,
      xpPerHour: 55,
      numSpawned: 0 * 1000,
      minXP: 3236,
      handItemTokenIdRangeMin: EstforConstants.IRON_AXE,
      handItemTokenIdRangeMax: EstforConstants.WOODCUTTING_MAX,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: true,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [
      {itemTokenId: EstforConstants.LOG, rate: 40 * 10},
      {itemTokenId: EstforConstants.OAK_LOG, rate: 36 * 10}
    ],
    randomRewards: [
      {itemTokenId: EstforConstants.WOODCUTTING_CHEST_1, chance: 27307, amount: 1},
      {itemTokenId: EstforConstants.ENCHANTED_ACORN, chance: 10, amount: 1},
      {itemTokenId: EstforConstants.COIN, chance: 8, amount: 1}
    ],
    combatStats: {
      meleeAttack: 0,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangedDefence: 0,
      health: 0
    }
  },
  {
    actionId: EstforConstants.ACTION_WOODCUTTING_THE_WOODLANDS,
    info: {
      skill: Skill.WOODCUTTING,
      isAvailable: true,
      actionChoiceRequired: false,
      xpPerHour: 95,
      numSpawned: 0 * 1000,
      minXP: 16432,
      handItemTokenIdRangeMin: EstforConstants.MITHRIL_AXE,
      handItemTokenIdRangeMax: EstforConstants.WOODCUTTING_MAX,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: true,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [
      {itemTokenId: EstforConstants.LOG, rate: 40 * 10},
      {itemTokenId: EstforConstants.OAK_LOG, rate: 36 * 10},
      {itemTokenId: EstforConstants.WILLOW_LOG, rate: 30 * 10}
    ],
    randomRewards: [
      {itemTokenId: EstforConstants.WOODCUTTING_CHEST_2, chance: 27307, amount: 1},
      {itemTokenId: EstforConstants.ENCHANTED_ACORN, chance: 30, amount: 1},
      {itemTokenId: EstforConstants.COIN, chance: 16, amount: 1}
    ],
    combatStats: {
      meleeAttack: 0,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangedDefence: 0,
      health: 0
    }
  },
  {
    actionId: EstforConstants.ACTION_WOODCUTTING_CURSED_MOUNTAIN,
    info: {
      skill: Skill.WOODCUTTING,
      isAvailable: true,
      actionChoiceRequired: false,
      xpPerHour: 210,
      numSpawned: 0 * 1000,
      minXP: 33913,
      handItemTokenIdRangeMin: EstforConstants.ADAMANTINE_AXE,
      handItemTokenIdRangeMax: EstforConstants.WOODCUTTING_MAX,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: true,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [
      {itemTokenId: EstforConstants.OAK_LOG, rate: 36 * 10},
      {itemTokenId: EstforConstants.WILLOW_LOG, rate: 30 * 10},
      {itemTokenId: EstforConstants.MAPLE_LOG, rate: 25 * 10}
    ],
    randomRewards: [
      {itemTokenId: EstforConstants.WOODCUTTING_CHEST_3, chance: 27307, amount: 1},
      {itemTokenId: EstforConstants.ENCHANTED_ACORN, chance: 90, amount: 1},
      {itemTokenId: EstforConstants.COIN, chance: 32, amount: 1}
    ],
    combatStats: {
      meleeAttack: 0,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangedDefence: 0,
      health: 0
    }
  },
  {
    actionId: EstforConstants.ACTION_WOODCUTTING_ENCHANTED_GROVE,
    info: {
      skill: Skill.WOODCUTTING,
      isAvailable: true,
      actionChoiceRequired: false,
      xpPerHour: 420,
      numSpawned: 0 * 1000,
      minXP: 97582,
      handItemTokenIdRangeMin: EstforConstants.TITANIUM_AXE,
      handItemTokenIdRangeMax: EstforConstants.WOODCUTTING_MAX,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: true,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [
      {itemTokenId: EstforConstants.MAPLE_LOG, rate: 25 * 10},
      {itemTokenId: EstforConstants.REDWOOD_LOG, rate: 25 * 10},
      {itemTokenId: EstforConstants.MAGICAL_LOG, rate: 24 * 10}
    ],
    randomRewards: [
      {itemTokenId: EstforConstants.WOODCUTTING_CHEST_4, chance: 27307, amount: 1},
      {itemTokenId: EstforConstants.ENCHANTED_ACORN, chance: 270, amount: 1},
      {itemTokenId: EstforConstants.COIN, chance: 64, amount: 1}
    ],
    combatStats: {
      meleeAttack: 0,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangedDefence: 0,
      health: 0
    }
  },
  {
    actionId: EstforConstants.ACTION_WOODCUTTING_WHISPERING_WOODS,
    info: {
      skill: Skill.WOODCUTTING,
      isAvailable: true,
      actionChoiceRequired: false,
      xpPerHour: 525,
      numSpawned: 0 * 1000,
      minXP: 195864,
      handItemTokenIdRangeMin: EstforConstants.ORICHALCUM_AXE,
      handItemTokenIdRangeMax: EstforConstants.WOODCUTTING_MAX,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: true,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [
      {itemTokenId: EstforConstants.REDWOOD_LOG, rate: 25 * 10},
      {itemTokenId: EstforConstants.MAGICAL_LOG, rate: 24 * 10},
      {itemTokenId: EstforConstants.ASH_LOG, rate: 20 * 10}
    ],
    randomRewards: [
      {itemTokenId: EstforConstants.WOODCUTTING_CHEST_5, chance: 27307, amount: 1},
      {itemTokenId: EstforConstants.ENCHANTED_ACORN, chance: 810, amount: 1},
      {itemTokenId: EstforConstants.COIN, chance: 128, amount: 1}
    ],
    combatStats: {
      meleeAttack: 0,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangedDefence: 0,
      health: 0
    }
  },
  {
    actionId: EstforConstants.ACTION_MINING_COPPER,
    info: {
      skill: Skill.MINING,
      isAvailable: true,
      actionChoiceRequired: false,
      xpPerHour: 25,
      numSpawned: 0 * 1000,
      minXP: 0,
      handItemTokenIdRangeMin: EstforConstants.BRONZE_PICKAXE,
      handItemTokenIdRangeMax: EstforConstants.MINING_MAX,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: false,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [{itemTokenId: EstforConstants.COPPER_ORE, rate: 120 * 10}],
    randomRewards: [],
    combatStats: {
      meleeAttack: 0,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangedDefence: 0,
      health: 0
    }
  },
  {
    actionId: EstforConstants.ACTION_MINING_TIN,
    info: {
      skill: Skill.MINING,
      isAvailable: true,
      actionChoiceRequired: false,
      xpPerHour: 35,
      numSpawned: 0 * 1000,
      minXP: 374,
      handItemTokenIdRangeMin: EstforConstants.BRONZE_PICKAXE,
      handItemTokenIdRangeMax: EstforConstants.MINING_MAX,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: false,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [{itemTokenId: EstforConstants.TIN_ORE, rate: 120 * 10}],
    randomRewards: [],
    combatStats: {
      meleeAttack: 0,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangedDefence: 0,
      health: 0
    }
  },
  {
    actionId: EstforConstants.ACTION_MINING_IRON,
    info: {
      skill: Skill.MINING,
      isAvailable: true,
      actionChoiceRequired: false,
      xpPerHour: 45,
      numSpawned: 0 * 1000,
      minXP: 1938,
      handItemTokenIdRangeMin: EstforConstants.BRONZE_PICKAXE,
      handItemTokenIdRangeMax: EstforConstants.MINING_MAX,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: false,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [{itemTokenId: EstforConstants.IRON_ORE, rate: 100 * 10}],
    randomRewards: [],
    combatStats: {
      meleeAttack: 0,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangedDefence: 0,
      health: 0
    }
  },
  {
    actionId: EstforConstants.ACTION_MINING_SAPPHIRE,
    info: {
      skill: Skill.MINING,
      isAvailable: true,
      actionChoiceRequired: false,
      xpPerHour: 100,
      numSpawned: 0 * 1000,
      minXP: 3236,
      handItemTokenIdRangeMin: EstforConstants.IRON_PICKAXE,
      handItemTokenIdRangeMax: EstforConstants.MINING_MAX,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: false,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [{itemTokenId: EstforConstants.SAPPHIRE, rate: 50 * 10}],
    randomRewards: [],
    combatStats: {
      meleeAttack: 0,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangedDefence: 0,
      health: 0
    }
  },
  {
    actionId: EstforConstants.ACTION_MINING_COAL,
    info: {
      skill: Skill.MINING,
      isAvailable: true,
      actionChoiceRequired: false,
      xpPerHour: 120,
      numSpawned: 0 * 1000,
      minXP: 7650,
      handItemTokenIdRangeMin: EstforConstants.IRON_PICKAXE,
      handItemTokenIdRangeMax: EstforConstants.MINING_MAX,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: false,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [{itemTokenId: EstforConstants.COAL_ORE, rate: 90 * 10}],
    randomRewards: [],
    combatStats: {
      meleeAttack: 0,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangedDefence: 0,
      health: 0
    }
  },
  {
    actionId: EstforConstants.ACTION_MINING_EMERALD,
    info: {
      skill: Skill.MINING,
      isAvailable: true,
      actionChoiceRequired: false,
      xpPerHour: 240,
      numSpawned: 0 * 1000,
      minXP: 16432,
      handItemTokenIdRangeMin: EstforConstants.IRON_PICKAXE,
      handItemTokenIdRangeMax: EstforConstants.MINING_MAX,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: false,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [{itemTokenId: EstforConstants.EMERALD, rate: 45 * 10}],
    randomRewards: [],
    combatStats: {
      meleeAttack: 0,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangedDefence: 0,
      health: 0
    }
  },
  {
    actionId: EstforConstants.ACTION_MINING_MITHRIL,
    info: {
      skill: Skill.MINING,
      isAvailable: true,
      actionChoiceRequired: false,
      xpPerHour: 300,
      numSpawned: 0 * 1000,
      minXP: 33913,
      handItemTokenIdRangeMin: EstforConstants.IRON_PICKAXE,
      handItemTokenIdRangeMax: EstforConstants.MINING_MAX,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: false,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [{itemTokenId: EstforConstants.MITHRIL_ORE, rate: 90 * 10}],
    randomRewards: [],
    combatStats: {
      meleeAttack: 0,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangedDefence: 0,
      health: 0
    }
  },
  {
    actionId: EstforConstants.ACTION_MINING_RUBY,
    info: {
      skill: Skill.MINING,
      isAvailable: true,
      actionChoiceRequired: false,
      xpPerHour: 350,
      numSpawned: 0 * 1000,
      minXP: 68761,
      handItemTokenIdRangeMin: EstforConstants.MITHRIL_PICKAXE,
      handItemTokenIdRangeMax: EstforConstants.MINING_MAX,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: false,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [{itemTokenId: EstforConstants.RUBY, rate: 40 * 10}],
    randomRewards: [],
    combatStats: {
      meleeAttack: 0,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangedDefence: 0,
      health: 0
    }
  },
  {
    actionId: EstforConstants.ACTION_MINING_ADAMANTINE,
    info: {
      skill: Skill.MINING,
      isAvailable: true,
      actionChoiceRequired: false,
      xpPerHour: 400,
      numSpawned: 0 * 1000,
      minXP: 138307,
      handItemTokenIdRangeMin: EstforConstants.MITHRIL_PICKAXE,
      handItemTokenIdRangeMax: EstforConstants.MINING_MAX,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: false,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [{itemTokenId: EstforConstants.ADAMANTINE_ORE, rate: 75 * 10}],
    randomRewards: [],
    combatStats: {
      meleeAttack: 0,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangedDefence: 0,
      health: 0
    }
  },
  {
    actionId: EstforConstants.ACTION_MINING_AMETHYST,
    info: {
      skill: Skill.MINING,
      isAvailable: true,
      actionChoiceRequired: false,
      xpPerHour: 470,
      numSpawned: 0 * 1000,
      minXP: 277219,
      handItemTokenIdRangeMin: EstforConstants.ADAMANTINE_PICKAXE,
      handItemTokenIdRangeMax: EstforConstants.MINING_MAX,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: false,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [{itemTokenId: EstforConstants.AMETHYST, rate: 36 * 10}],
    randomRewards: [],
    combatStats: {
      meleeAttack: 0,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangedDefence: 0,
      health: 0
    }
  },
  {
    actionId: EstforConstants.ACTION_MINING_RUNITE,
    info: {
      skill: Skill.MINING,
      isAvailable: true,
      actionChoiceRequired: false,
      xpPerHour: 540,
      numSpawned: 0 * 1000,
      minXP: 341403,
      handItemTokenIdRangeMin: EstforConstants.ADAMANTINE_PICKAXE,
      handItemTokenIdRangeMax: EstforConstants.MINING_MAX,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: false,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [{itemTokenId: EstforConstants.RUNITE_ORE, rate: 72 * 10}],
    randomRewards: [],
    combatStats: {
      meleeAttack: 0,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangedDefence: 0,
      health: 0
    }
  },
  {
    actionId: EstforConstants.ACTION_MINING_DIAMOND,
    info: {
      skill: Skill.MINING,
      isAvailable: true,
      actionChoiceRequired: false,
      xpPerHour: 650,
      numSpawned: 0 * 1000,
      minXP: 392228,
      handItemTokenIdRangeMin: EstforConstants.RUNITE_PICKAXE,
      handItemTokenIdRangeMax: EstforConstants.MINING_MAX,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: false,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [{itemTokenId: EstforConstants.DIAMOND, rate: 30 * 10}],
    randomRewards: [],
    combatStats: {
      meleeAttack: 0,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangedDefence: 0,
      health: 0
    }
  },
  {
    actionId: EstforConstants.ACTION_MINING_TITANIUM,
    info: {
      skill: Skill.MINING,
      isAvailable: true,
      actionChoiceRequired: false,
      xpPerHour: 800,
      numSpawned: 0 * 1000,
      minXP: 554828,
      handItemTokenIdRangeMin: EstforConstants.RUNITE_PICKAXE,
      handItemTokenIdRangeMax: EstforConstants.MINING_MAX,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: false,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [{itemTokenId: EstforConstants.TITANIUM_ORE, rate: 60 * 10}],
    randomRewards: [],
    combatStats: {
      meleeAttack: 0,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangedDefence: 0,
      health: 0
    }
  },
  {
    actionId: EstforConstants.ACTION_MINING_DRAGONSTONE,
    info: {
      skill: Skill.MINING,
      isAvailable: true,
      actionChoiceRequired: false,
      xpPerHour: 900,
      numSpawned: 0 * 1000,
      minXP: 784726,
      handItemTokenIdRangeMin: EstforConstants.TITANIUM_PICKAXE,
      handItemTokenIdRangeMax: EstforConstants.MINING_MAX,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: false,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [{itemTokenId: EstforConstants.DRAGONSTONE, rate: 20 * 10}],
    randomRewards: [],
    combatStats: {
      meleeAttack: 0,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangedDefence: 0,
      health: 0
    }
  },
  {
    actionId: EstforConstants.ACTION_MINING_ORICHALCUM,
    info: {
      skill: Skill.MINING,
      isAvailable: true,
      actionChoiceRequired: false,
      xpPerHour: 1000,
      numSpawned: 0 * 1000,
      minXP: 1109796,
      handItemTokenIdRangeMin: EstforConstants.TITANIUM_PICKAXE,
      handItemTokenIdRangeMax: EstforConstants.MINING_MAX,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: false,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [{itemTokenId: EstforConstants.ORICHALCUM_ORE, rate: 40 * 10}],
    randomRewards: [],
    combatStats: {
      meleeAttack: 0,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangedDefence: 0,
      health: 0
    }
  },
  {
    actionId: EstforConstants.ACTION_MINING_TIN_MOTHERLODE,
    info: {
      skill: Skill.MINING,
      isAvailable: true,
      actionChoiceRequired: false,
      xpPerHour: 180,
      numSpawned: 0 * 1000,
      minXP: 7650,
      handItemTokenIdRangeMin: EstforConstants.IRON_PICKAXE,
      handItemTokenIdRangeMax: EstforConstants.MINING_MAX,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: true,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [
      {itemTokenId: EstforConstants.TIN_ORE, rate: 40 * 10},
      {itemTokenId: EstforConstants.IRON_ORE, rate: 40 * 10},
      {itemTokenId: EstforConstants.SAPPHIRE, rate: 16 * 10}
    ],
    randomRewards: [
      {itemTokenId: EstforConstants.MINING_CHEST_1, chance: 27307, amount: 1},
      {itemTokenId: EstforConstants.BAT_WING, chance: 16, amount: 1},
      {itemTokenId: EstforConstants.COIN, chance: 8, amount: 1}
    ],
    combatStats: {
      meleeAttack: 0,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangedDefence: 0,
      health: 0
    }
  },
  {
    actionId: EstforConstants.ACTION_MINING_MITHRIL_MOTHERLODE,
    info: {
      skill: Skill.MINING,
      isAvailable: true,
      actionChoiceRequired: false,
      xpPerHour: 375,
      numSpawned: 0 * 1000,
      minXP: 68761,
      handItemTokenIdRangeMin: EstforConstants.MITHRIL_PICKAXE,
      handItemTokenIdRangeMax: EstforConstants.MINING_MAX,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: true,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [
      {itemTokenId: EstforConstants.MITHRIL_ORE, rate: 30 * 10},
      {itemTokenId: EstforConstants.COAL_ORE, rate: 30 * 10},
      {itemTokenId: EstforConstants.EMERALD, rate: 15 * 10}
    ],
    randomRewards: [
      {itemTokenId: EstforConstants.MINING_CHEST_2, chance: 27307, amount: 1},
      {itemTokenId: EstforConstants.BAT_WING, chance: 48, amount: 1},
      {itemTokenId: EstforConstants.COIN, chance: 16, amount: 1}
    ],
    combatStats: {
      meleeAttack: 0,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangedDefence: 0,
      health: 0
    }
  },
  {
    actionId: EstforConstants.ACTION_MINING_ADAMANTINE_MOTHERLODE,
    info: {
      skill: Skill.MINING,
      isAvailable: true,
      actionChoiceRequired: false,
      xpPerHour: 500,
      numSpawned: 0 * 1000,
      minXP: 277219,
      handItemTokenIdRangeMin: EstforConstants.ADAMANTINE_PICKAXE,
      handItemTokenIdRangeMax: EstforConstants.MINING_MAX,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: true,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [
      {itemTokenId: EstforConstants.ADAMANTINE_ORE, rate: 25 * 10},
      {itemTokenId: EstforConstants.COAL_ORE, rate: 30 * 10},
      {itemTokenId: EstforConstants.RUBY, rate: 12 * 10}
    ],
    randomRewards: [
      {itemTokenId: EstforConstants.MINING_CHEST_3, chance: 27307, amount: 1},
      {itemTokenId: EstforConstants.BAT_WING, chance: 144, amount: 1},
      {itemTokenId: EstforConstants.COIN, chance: 32, amount: 1}
    ],
    combatStats: {
      meleeAttack: 0,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangedDefence: 0,
      health: 0
    }
  },
  {
    actionId: EstforConstants.ACTION_MINING_RUNITE_MOTHERLODE,
    info: {
      skill: Skill.MINING,
      isAvailable: true,
      actionChoiceRequired: false,
      xpPerHour: 950,
      numSpawned: 0 * 1000,
      minXP: 784726,
      handItemTokenIdRangeMin: EstforConstants.TITANIUM_PICKAXE,
      handItemTokenIdRangeMax: EstforConstants.MINING_MAX,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: true,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [
      {itemTokenId: EstforConstants.RUNITE_ORE, rate: 45 * 10},
      {itemTokenId: EstforConstants.COAL_ORE, rate: 36 * 10},
      {itemTokenId: EstforConstants.DIAMOND, rate: 10 * 10}
    ],
    randomRewards: [
      {itemTokenId: EstforConstants.MINING_CHEST_4, chance: 27307, amount: 1},
      {itemTokenId: EstforConstants.BAT_WING, chance: 432, amount: 1},
      {itemTokenId: EstforConstants.COIN, chance: 64, amount: 1}
    ],
    combatStats: {
      meleeAttack: 0,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangedDefence: 0,
      health: 0
    }
  },
  {
    actionId: EstforConstants.ACTION_MINING_TITANIUM_MOTHERLODE,
    info: {
      skill: Skill.MINING,
      isAvailable: true,
      actionChoiceRequired: false,
      xpPerHour: 1050,
      numSpawned: 0 * 1000,
      minXP: 1109796,
      handItemTokenIdRangeMin: EstforConstants.ORICHALCUM_PICKAXE,
      handItemTokenIdRangeMax: EstforConstants.MINING_MAX,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: true,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [
      {itemTokenId: EstforConstants.TITANIUM_ORE, rate: 20 * 10},
      {itemTokenId: EstforConstants.COAL_ORE, rate: 36 * 10},
      {itemTokenId: EstforConstants.DRAGONSTONE, rate: 6 * 10}
    ],
    randomRewards: [
      {itemTokenId: EstforConstants.MINING_CHEST_5, chance: 27307, amount: 1},
      {itemTokenId: EstforConstants.BAT_WING, chance: 1296, amount: 1},
      {itemTokenId: EstforConstants.COIN, chance: 128, amount: 1}
    ],
    combatStats: {
      meleeAttack: 0,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangedDefence: 0,
      health: 0
    }
  },
  {
    actionId: EstforConstants.ACTION_FIREMAKING_ITEM,
    info: {
      skill: Skill.FIREMAKING,
      isAvailable: true,
      actionChoiceRequired: true,
      xpPerHour: 0,
      numSpawned: 0 * 1000,
      minXP: 0,
      handItemTokenIdRangeMin: EstforConstants.FIRE_BASE,
      handItemTokenIdRangeMax: EstforConstants.FIRE_MAX,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: false,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [],
    randomRewards: [],
    combatStats: {
      meleeAttack: 0,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangedDefence: 0,
      health: 0
    }
  },
  {
    actionId: EstforConstants.ACTION_SMITHING_ITEM,
    info: {
      skill: Skill.SMITHING,
      isAvailable: true,
      actionChoiceRequired: true,
      xpPerHour: 0,
      numSpawned: 0 * 1000,
      minXP: 0,
      handItemTokenIdRangeMin: EstforConstants.NONE,
      handItemTokenIdRangeMax: EstforConstants.NONE,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: false,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [],
    randomRewards: [],
    combatStats: {
      meleeAttack: 0,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangedDefence: 0,
      health: 0
    }
  },
  {
    actionId: EstforConstants.ACTION_COOKING_ITEM,
    info: {
      skill: Skill.COOKING,
      isAvailable: true,
      actionChoiceRequired: true,
      xpPerHour: 0,
      numSpawned: 0 * 1000,
      minXP: 0,
      handItemTokenIdRangeMin: EstforConstants.NONE,
      handItemTokenIdRangeMax: EstforConstants.NONE,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: false,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [],
    randomRewards: [],
    combatStats: {
      meleeAttack: 0,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangedDefence: 0,
      health: 0
    }
  },
  {
    actionId: EstforConstants.ACTION_FISHING_MINNUS,
    info: {
      skill: Skill.FISHING,
      isAvailable: true,
      actionChoiceRequired: false,
      xpPerHour: 25,
      numSpawned: 0 * 1000,
      minXP: 0,
      handItemTokenIdRangeMin: EstforConstants.NET_STICK,
      handItemTokenIdRangeMax: EstforConstants.FISHING_MAX,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: false,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [{itemTokenId: EstforConstants.RAW_MINNUS, rate: 120 * 10}],
    randomRewards: [],
    combatStats: {
      meleeAttack: 0,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangedDefence: 0,
      health: 0
    }
  },
  {
    actionId: EstforConstants.ACTION_FISHING_BLEKK,
    info: {
      skill: Skill.FISHING,
      isAvailable: true,
      actionChoiceRequired: false,
      xpPerHour: 35,
      numSpawned: 0 * 1000,
      minXP: 374,
      handItemTokenIdRangeMin: EstforConstants.NET_STICK,
      handItemTokenIdRangeMax: EstforConstants.FISHING_MAX,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: false,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [{itemTokenId: EstforConstants.RAW_BLEKK, rate: 120 * 10}],
    randomRewards: [],
    combatStats: {
      meleeAttack: 0,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangedDefence: 0,
      health: 0
    }
  },
  {
    actionId: EstforConstants.ACTION_FISHING_SKRIMP,
    info: {
      skill: Skill.FISHING,
      isAvailable: true,
      actionChoiceRequired: false,
      xpPerHour: 45,
      numSpawned: 0 * 1000,
      minXP: 1021,
      handItemTokenIdRangeMin: EstforConstants.NET_STICK,
      handItemTokenIdRangeMax: EstforConstants.FISHING_MAX,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: false,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [{itemTokenId: EstforConstants.RAW_SKRIMP, rate: 120 * 10}],
    randomRewards: [],
    combatStats: {
      meleeAttack: 0,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangedDefence: 0,
      health: 0
    }
  },
  {
    actionId: EstforConstants.ACTION_FISHING_FEOLA,
    info: {
      skill: Skill.FISHING,
      isAvailable: true,
      actionChoiceRequired: false,
      xpPerHour: 70,
      numSpawned: 0 * 1000,
      minXP: 1938,
      handItemTokenIdRangeMin: EstforConstants.NET_STICK,
      handItemTokenIdRangeMax: EstforConstants.FISHING_MAX,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: false,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [{itemTokenId: EstforConstants.RAW_FEOLA, rate: 100 * 10}],
    randomRewards: [],
    combatStats: {
      meleeAttack: 0,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangedDefence: 0,
      health: 0
    }
  },
  {
    actionId: EstforConstants.ACTION_FISHING_ANCHO,
    info: {
      skill: Skill.FISHING,
      isAvailable: true,
      actionChoiceRequired: false,
      xpPerHour: 140,
      numSpawned: 0 * 1000,
      minXP: 3236,
      handItemTokenIdRangeMin: EstforConstants.MEDIUM_NET,
      handItemTokenIdRangeMax: EstforConstants.FISHING_MAX,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: false,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [{itemTokenId: EstforConstants.RAW_ANCHO, rate: 90 * 10}],
    randomRewards: [],
    combatStats: {
      meleeAttack: 0,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangedDefence: 0,
      health: 0
    }
  },
  {
    actionId: EstforConstants.ACTION_FISHING_TROUT,
    info: {
      skill: Skill.FISHING,
      isAvailable: true,
      actionChoiceRequired: false,
      xpPerHour: 160,
      numSpawned: 0 * 1000,
      minXP: 5067,
      handItemTokenIdRangeMin: EstforConstants.MEDIUM_NET,
      handItemTokenIdRangeMax: EstforConstants.FISHING_MAX,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: false,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [{itemTokenId: EstforConstants.RAW_TROUT, rate: 72 * 10}],
    randomRewards: [],
    combatStats: {
      meleeAttack: 0,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangedDefence: 0,
      health: 0
    }
  },
  {
    actionId: EstforConstants.ACTION_FISHING_ROJJA,
    info: {
      skill: Skill.FISHING,
      isAvailable: true,
      actionChoiceRequired: false,
      xpPerHour: 240,
      numSpawned: 0 * 1000,
      minXP: 7650,
      handItemTokenIdRangeMin: EstforConstants.MEDIUM_NET,
      handItemTokenIdRangeMax: EstforConstants.FISHING_MAX,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: false,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [{itemTokenId: EstforConstants.RAW_ROJJA, rate: 60 * 10}],
    randomRewards: [],
    combatStats: {
      meleeAttack: 0,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangedDefence: 0,
      health: 0
    }
  },
  {
    actionId: EstforConstants.ACTION_FISHING_BOWFISH,
    info: {
      skill: Skill.FISHING,
      isAvailable: true,
      actionChoiceRequired: false,
      xpPerHour: 260,
      numSpawned: 0 * 1000,
      minXP: 11294,
      handItemTokenIdRangeMin: EstforConstants.MEDIUM_NET,
      handItemTokenIdRangeMax: EstforConstants.FISHING_MAX,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: false,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [{itemTokenId: EstforConstants.RAW_BOWFISH, rate: 50 * 10}],
    randomRewards: [],
    combatStats: {
      meleeAttack: 0,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangedDefence: 0,
      health: 0
    }
  },
  {
    actionId: EstforConstants.ACTION_FISHING_GOLDFISH,
    info: {
      skill: Skill.FISHING,
      isAvailable: true,
      actionChoiceRequired: false,
      xpPerHour: 300,
      numSpawned: 0 * 1000,
      minXP: 16432,
      handItemTokenIdRangeMin: EstforConstants.WOOD_FISHING_ROD,
      handItemTokenIdRangeMax: EstforConstants.FISHING_MAX,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: false,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [{itemTokenId: EstforConstants.RAW_GOLDFISH, rate: 45 * 10}],
    randomRewards: [],
    combatStats: {
      meleeAttack: 0,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangedDefence: 0,
      health: 0
    }
  },
  {
    actionId: EstforConstants.ACTION_FISHING_MYSTY_BLUE,
    info: {
      skill: Skill.FISHING,
      isAvailable: true,
      actionChoiceRequired: false,
      xpPerHour: 370,
      numSpawned: 0 * 1000,
      minXP: 33913,
      handItemTokenIdRangeMin: EstforConstants.WOOD_FISHING_ROD,
      handItemTokenIdRangeMax: EstforConstants.FISHING_MAX,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: false,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [{itemTokenId: EstforConstants.RAW_MYSTY_BLUE, rate: 48 * 10}],
    randomRewards: [],
    combatStats: {
      meleeAttack: 0,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangedDefence: 0,
      health: 0
    }
  },
  {
    actionId: EstforConstants.ACTION_FISHING_FLITFISH,
    info: {
      skill: Skill.FISHING,
      isAvailable: true,
      actionChoiceRequired: false,
      xpPerHour: 400,
      numSpawned: 0 * 1000,
      minXP: 68761,
      handItemTokenIdRangeMin: EstforConstants.WOOD_FISHING_ROD,
      handItemTokenIdRangeMax: EstforConstants.FISHING_MAX,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: false,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [{itemTokenId: EstforConstants.RAW_FLITFISH, rate: 50 * 10}],
    randomRewards: [],
    combatStats: {
      meleeAttack: 0,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangedDefence: 0,
      health: 0
    }
  },
  {
    actionId: EstforConstants.ACTION_FISHING_RAZORFISH,
    info: {
      skill: Skill.FISHING,
      isAvailable: true,
      actionChoiceRequired: false,
      xpPerHour: 440,
      numSpawned: 0 * 1000,
      minXP: 97582,
      handItemTokenIdRangeMin: EstforConstants.WOOD_FISHING_ROD,
      handItemTokenIdRangeMax: EstforConstants.FISHING_MAX,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: false,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [{itemTokenId: EstforConstants.RAW_RAZORFISH, rate: 50 * 10}],
    randomRewards: [],
    combatStats: {
      meleeAttack: 0,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangedDefence: 0,
      health: 0
    }
  },
  {
    actionId: EstforConstants.ACTION_FISHING_QUAFFER,
    info: {
      skill: Skill.FISHING,
      isAvailable: true,
      actionChoiceRequired: false,
      xpPerHour: 500,
      numSpawned: 0 * 1000,
      minXP: 138307,
      handItemTokenIdRangeMin: EstforConstants.WOOD_FISHING_ROD,
      handItemTokenIdRangeMax: EstforConstants.FISHING_MAX,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: false,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [{itemTokenId: EstforConstants.RAW_QUAFFER, rate: 48 * 10}],
    randomRewards: [],
    combatStats: {
      meleeAttack: 0,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangedDefence: 0,
      health: 0
    }
  },
  {
    actionId: EstforConstants.ACTION_FISHING_ROXA,
    info: {
      skill: Skill.FISHING,
      isAvailable: true,
      actionChoiceRequired: false,
      xpPerHour: 550,
      numSpawned: 0 * 1000,
      minXP: 170430,
      handItemTokenIdRangeMin: EstforConstants.WOOD_FISHING_ROD,
      handItemTokenIdRangeMax: EstforConstants.FISHING_MAX,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: false,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [{itemTokenId: EstforConstants.RAW_ROXA, rate: 45 * 10}],
    randomRewards: [],
    combatStats: {
      meleeAttack: 0,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangedDefence: 0,
      health: 0
    }
  },
  {
    actionId: EstforConstants.ACTION_FISHING_AZACUDDA,
    info: {
      skill: Skill.FISHING,
      isAvailable: true,
      actionChoiceRequired: false,
      xpPerHour: 650,
      numSpawned: 0 * 1000,
      minXP: 241267,
      handItemTokenIdRangeMin: EstforConstants.WOOD_FISHING_ROD,
      handItemTokenIdRangeMax: EstforConstants.FISHING_MAX,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: false,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [{itemTokenId: EstforConstants.RAW_AZACUDDA, rate: 45 * 10}],
    randomRewards: [],
    combatStats: {
      meleeAttack: 0,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangedDefence: 0,
      health: 0
    }
  },
  {
    actionId: EstforConstants.ACTION_FISHING_STONECLAW,
    info: {
      skill: Skill.FISHING,
      isAvailable: true,
      actionChoiceRequired: false,
      xpPerHour: 700,
      numSpawned: 0 * 1000,
      minXP: 392228,
      handItemTokenIdRangeMin: EstforConstants.CAGE,
      handItemTokenIdRangeMax: EstforConstants.FISHING_MAX,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: false,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [{itemTokenId: EstforConstants.RAW_STONECLAW, rate: 45 * 10}],
    randomRewards: [],
    combatStats: {
      meleeAttack: 0,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangedDefence: 0,
      health: 0
    }
  },
  {
    actionId: EstforConstants.ACTION_FISHING_CRUSKAN,
    info: {
      skill: Skill.FISHING,
      isAvailable: true,
      actionChoiceRequired: false,
      xpPerHour: 780,
      numSpawned: 0 * 1000,
      minXP: 554828,
      handItemTokenIdRangeMin: EstforConstants.CAGE,
      handItemTokenIdRangeMax: EstforConstants.FISHING_MAX,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: false,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [{itemTokenId: EstforConstants.RAW_CRUSKAN, rate: 45 * 10}],
    randomRewards: [],
    combatStats: {
      meleeAttack: 0,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangedDefence: 0,
      health: 0
    }
  },
  {
    actionId: EstforConstants.ACTION_FISHING_CHODFISH,
    info: {
      skill: Skill.FISHING,
      isAvailable: true,
      actionChoiceRequired: false,
      xpPerHour: 830,
      numSpawned: 0 * 1000,
      minXP: 637364,
      handItemTokenIdRangeMin: EstforConstants.LARGE_NET,
      handItemTokenIdRangeMax: EstforConstants.FISHING_MAX,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: false,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [{itemTokenId: EstforConstants.RAW_CHODFISH, rate: 36 * 10}],
    randomRewards: [],
    combatStats: {
      meleeAttack: 0,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangedDefence: 0,
      health: 0
    }
  },
  {
    actionId: EstforConstants.ACTION_FISHING_DOUBTFISH,
    info: {
      skill: Skill.FISHING,
      isAvailable: true,
      actionChoiceRequired: false,
      xpPerHour: 880,
      numSpawned: 0 * 1000,
      minXP: 784726,
      handItemTokenIdRangeMin: EstforConstants.LARGE_NET,
      handItemTokenIdRangeMax: EstforConstants.FISHING_MAX,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: false,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [{itemTokenId: EstforConstants.RAW_DOUBTFISH, rate: 36 * 10}],
    randomRewards: [],
    combatStats: {
      meleeAttack: 0,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangedDefence: 0,
      health: 0
    }
  },
  {
    actionId: EstforConstants.ACTION_FISHING_ROSEFIN,
    info: {
      skill: Skill.FISHING,
      isAvailable: true,
      actionChoiceRequired: false,
      xpPerHour: 900,
      numSpawned: 0 * 1000,
      minXP: 1035476,
      handItemTokenIdRangeMin: EstforConstants.LARGE_NET,
      handItemTokenIdRangeMax: EstforConstants.FISHING_MAX,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: false,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [{itemTokenId: EstforConstants.RAW_ROSEFIN, rate: 36 * 10}],
    randomRewards: [],
    combatStats: {
      meleeAttack: 0,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangedDefence: 0,
      health: 0
    }
  },
  {
    actionId: EstforConstants.ACTION_FISHING_HIDDEN_POND,
    info: {
      skill: Skill.FISHING,
      isAvailable: true,
      actionChoiceRequired: false,
      xpPerHour: 150,
      numSpawned: 0 * 1000,
      minXP: 3236,
      handItemTokenIdRangeMin: EstforConstants.MEDIUM_NET,
      handItemTokenIdRangeMax: EstforConstants.MEDIUM_NET,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: true,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [
      {itemTokenId: EstforConstants.RAW_BLEKK, rate: 40 * 10},
      {itemTokenId: EstforConstants.RAW_SKRIMP, rate: 40 * 10},
      {itemTokenId: EstforConstants.RAW_FEOLA, rate: 36 * 10}
    ],
    randomRewards: [
      {itemTokenId: EstforConstants.FISHING_CHEST_1, chance: 27307, amount: 1},
      {itemTokenId: EstforConstants.LOSSUTH_SCALE, chance: 16, amount: 1},
      {itemTokenId: EstforConstants.COIN, chance: 8, amount: 1}
    ],
    combatStats: {
      meleeAttack: 0,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangedDefence: 0,
      health: 0
    }
  },
  {
    actionId: EstforConstants.ACTION_FISHING_SECRET_LAKE,
    info: {
      skill: Skill.FISHING,
      isAvailable: true,
      actionChoiceRequired: false,
      xpPerHour: 325,
      numSpawned: 0 * 1000,
      minXP: 16432,
      handItemTokenIdRangeMin: EstforConstants.WOOD_FISHING_ROD,
      handItemTokenIdRangeMax: EstforConstants.WOOD_FISHING_ROD,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: true,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [
      {itemTokenId: EstforConstants.RAW_ROJJA, rate: 20 * 10},
      {itemTokenId: EstforConstants.RAW_TROUT, rate: 24 * 10},
      {itemTokenId: EstforConstants.RAW_ANCHO, rate: 30 * 10}
    ],
    randomRewards: [
      {itemTokenId: EstforConstants.FISHING_CHEST_2, chance: 27307, amount: 1},
      {itemTokenId: EstforConstants.LOSSUTH_SCALE, chance: 48, amount: 1},
      {itemTokenId: EstforConstants.COIN, chance: 16, amount: 1}
    ],
    combatStats: {
      meleeAttack: 0,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangedDefence: 0,
      health: 0
    }
  },
  {
    actionId: EstforConstants.ACTION_FISHING_ENCHANTED_LAGOON,
    info: {
      skill: Skill.FISHING,
      isAvailable: true,
      actionChoiceRequired: false,
      xpPerHour: 420,
      numSpawned: 0 * 1000,
      minXP: 68761,
      handItemTokenIdRangeMin: EstforConstants.WOOD_FISHING_ROD,
      handItemTokenIdRangeMax: EstforConstants.WOOD_FISHING_ROD,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: true,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [
      {itemTokenId: EstforConstants.RAW_GOLDFISH, rate: 15 * 10},
      {itemTokenId: EstforConstants.RAW_MYSTY_BLUE, rate: 16 * 10},
      {itemTokenId: EstforConstants.RAW_BOWFISH, rate: 16 * 10}
    ],
    randomRewards: [
      {itemTokenId: EstforConstants.FISHING_CHEST_3, chance: 27307, amount: 1},
      {itemTokenId: EstforConstants.LOSSUTH_SCALE, chance: 144, amount: 1},
      {itemTokenId: EstforConstants.COIN, chance: 32, amount: 1}
    ],
    combatStats: {
      meleeAttack: 0,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangedDefence: 0,
      health: 0
    }
  },
  {
    actionId: EstforConstants.ACTION_FISHING_UNDERGROUND_RIVER,
    info: {
      skill: Skill.FISHING,
      isAvailable: true,
      actionChoiceRequired: false,
      xpPerHour: 740,
      numSpawned: 0 * 1000,
      minXP: 392228,
      handItemTokenIdRangeMin: EstforConstants.CAGE,
      handItemTokenIdRangeMax: EstforConstants.CAGE,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: true,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [
      {itemTokenId: EstforConstants.RAW_ROXA, rate: 16 * 10},
      {itemTokenId: EstforConstants.RAW_QUAFFER, rate: 15 * 10},
      {itemTokenId: EstforConstants.RAW_RAZORFISH, rate: 15 * 10}
    ],
    randomRewards: [
      {itemTokenId: EstforConstants.FISHING_CHEST_4, chance: 27307, amount: 1},
      {itemTokenId: EstforConstants.LOSSUTH_SCALE, chance: 432, amount: 1},
      {itemTokenId: EstforConstants.COIN, chance: 64, amount: 1}
    ],
    combatStats: {
      meleeAttack: 0,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangedDefence: 0,
      health: 0
    }
  },
  {
    actionId: EstforConstants.ACTION_FISHING_DEEP_SEA,
    info: {
      skill: Skill.FISHING,
      isAvailable: true,
      actionChoiceRequired: false,
      xpPerHour: 890,
      numSpawned: 0 * 1000,
      minXP: 784726,
      handItemTokenIdRangeMin: EstforConstants.LARGE_NET,
      handItemTokenIdRangeMax: EstforConstants.LARGE_NET,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: true,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [
      {itemTokenId: EstforConstants.RAW_CHODFISH, rate: 12 * 10},
      {itemTokenId: EstforConstants.RAW_CRUSKAN, rate: 15 * 10},
      {itemTokenId: EstforConstants.RAW_STONECLAW, rate: 15 * 10}
    ],
    randomRewards: [
      {itemTokenId: EstforConstants.FISHING_CHEST_5, chance: 27307, amount: 1},
      {itemTokenId: EstforConstants.LOSSUTH_SCALE, chance: 1296, amount: 1},
      {itemTokenId: EstforConstants.COIN, chance: 128, amount: 1}
    ],
    combatStats: {
      meleeAttack: 0,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangedDefence: 0,
      health: 0
    }
  },
  {
    actionId: EstforConstants.ACTION_COMBAT_NATUOW,
    info: {
      skill: Skill.COMBAT,
      isAvailable: true,
      actionChoiceRequired: true,
      xpPerHour: 100,
      numSpawned: 100 * 1000,
      minXP: 0,
      handItemTokenIdRangeMin: EstforConstants.COMBAT_BASE,
      handItemTokenIdRangeMax: EstforConstants.COMBAT_MAX,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: false,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [
      {itemTokenId: EstforConstants.SMALL_BONE, rate: 1 * 10},
      {itemTokenId: EstforConstants.NATUOW_HIDE, rate: 1 * 10}
    ],
    randomRewards: [],
    combatStats: {
      meleeAttack: 1,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangedDefence: 0,
      health: 20
    }
  },
  {
    actionId: EstforConstants.ACTION_COMBAT_GROG_TOAD,
    info: {
      skill: Skill.COMBAT,
      isAvailable: true,
      actionChoiceRequired: true,
      xpPerHour: 120,
      numSpawned: 100 * 1000,
      minXP: 0,
      handItemTokenIdRangeMin: EstforConstants.COMBAT_BASE,
      handItemTokenIdRangeMax: EstforConstants.COMBAT_MAX,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: false,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [{itemTokenId: EstforConstants.SMALL_BONE, rate: 1 * 10}],
    randomRewards: [
      {itemTokenId: EstforConstants.POISON, chance: 6640, amount: 1},
      {itemTokenId: EstforConstants.FLIXORA, chance: 1200, amount: 1}
    ],
    combatStats: {
      meleeAttack: 3,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 3,
      magicDefence: 0,
      rangedDefence: 0,
      health: 50
    }
  },
  {
    actionId: EstforConstants.ACTION_COMBAT_UFFINCH,
    info: {
      skill: Skill.COMBAT,
      isAvailable: true,
      actionChoiceRequired: true,
      xpPerHour: 150,
      numSpawned: 100 * 1000,
      minXP: 0,
      handItemTokenIdRangeMin: EstforConstants.COMBAT_BASE,
      handItemTokenIdRangeMax: EstforConstants.COMBAT_MAX,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: false,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [
      {itemTokenId: EstforConstants.SMALL_BONE, rate: 1 * 10},
      {itemTokenId: EstforConstants.FEATHER, rate: 5 * 10}
    ],
    randomRewards: [
      {itemTokenId: EstforConstants.LEAF_FRAGMENTS, chance: 1200, amount: 1},
      {itemTokenId: EstforConstants.QUARTZ_INFUSED_FEATHER, chance: 600, amount: 1}
    ],
    combatStats: {
      meleeAttack: 0,
      magicAttack: 5,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 5,
      rangedDefence: 0,
      health: 60
    }
  },
  {
    actionId: EstforConstants.ACTION_COMBAT_NATURARACNID,
    info: {
      skill: Skill.COMBAT,
      isAvailable: true,
      actionChoiceRequired: true,
      xpPerHour: 150,
      numSpawned: 100 * 1000,
      minXP: 0,
      handItemTokenIdRangeMin: EstforConstants.COMBAT_BASE,
      handItemTokenIdRangeMax: EstforConstants.COMBAT_MAX,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: false,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [{itemTokenId: EstforConstants.STRING, rate: 1 * 10}],
    randomRewards: [],
    combatStats: {
      meleeAttack: 3,
      magicAttack: 3,
      rangedAttack: 3,
      meleeDefence: 4,
      magicDefence: 4,
      rangedDefence: 3,
      health: 80
    }
  },
  {
    actionId: EstforConstants.ACTION_COMBAT_DRAGON_FROG,
    info: {
      skill: Skill.COMBAT,
      isAvailable: true,
      actionChoiceRequired: true,
      xpPerHour: 200,
      numSpawned: 100 * 1000,
      minXP: 0,
      handItemTokenIdRangeMin: EstforConstants.COMBAT_BASE,
      handItemTokenIdRangeMax: EstforConstants.COMBAT_MAX,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: false,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [{itemTokenId: EstforConstants.SMALL_BONE, rate: 1 * 10}],
    randomRewards: [{itemTokenId: EstforConstants.BECARA_GRASS, chance: 1328, amount: 1}],
    combatStats: {
      meleeAttack: 5,
      magicAttack: 5,
      rangedAttack: 0,
      meleeDefence: 5,
      magicDefence: 5,
      rangedDefence: 0,
      health: 100
    }
  },
  {
    actionId: EstforConstants.ACTION_COMBAT_ELDER_BURGOF,
    info: {
      skill: Skill.COMBAT,
      isAvailable: true,
      actionChoiceRequired: true,
      xpPerHour: 200,
      numSpawned: 75 * 1000,
      minXP: 0,
      handItemTokenIdRangeMin: EstforConstants.COMBAT_BASE,
      handItemTokenIdRangeMax: EstforConstants.COMBAT_MAX,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: false,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [{itemTokenId: EstforConstants.MEDIUM_BONE, rate: 1 * 10}],
    randomRewards: [{itemTokenId: EstforConstants.BLUECANAR, chance: 750, amount: 2}],
    combatStats: {
      meleeAttack: 0,
      magicAttack: 10,
      rangedAttack: 0,
      meleeDefence: 4,
      magicDefence: 10,
      rangedDefence: 0,
      health: 120
    }
  },
  {
    actionId: EstforConstants.ACTION_COMBAT_GRAND_TREE_IMP,
    info: {
      skill: Skill.COMBAT,
      isAvailable: true,
      actionChoiceRequired: true,
      xpPerHour: 250,
      numSpawned: 75 * 1000,
      minXP: 0,
      handItemTokenIdRangeMin: EstforConstants.COMBAT_BASE,
      handItemTokenIdRangeMax: EstforConstants.COMBAT_MAX,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: false,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [{itemTokenId: EstforConstants.WILLOW_LOG, rate: 1 * 10}],
    randomRewards: [
      {itemTokenId: EstforConstants.MITHRIL_AXE, chance: 3320, amount: 1},
      {itemTokenId: EstforConstants.MASTER_BODY, chance: 8, amount: 1}
    ],
    combatStats: {
      meleeAttack: 10,
      magicAttack: 10,
      rangedAttack: 0,
      meleeDefence: 10,
      magicDefence: 10,
      rangedDefence: 0,
      health: 160
    }
  },
  {
    actionId: EstforConstants.ACTION_COMBAT_BANOXNID,
    info: {
      skill: Skill.COMBAT,
      isAvailable: true,
      actionChoiceRequired: true,
      xpPerHour: 250,
      numSpawned: 75 * 1000,
      minXP: 0,
      handItemTokenIdRangeMin: EstforConstants.COMBAT_BASE,
      handItemTokenIdRangeMax: EstforConstants.COMBAT_MAX,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: false,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [{itemTokenId: EstforConstants.STRING, rate: 2 * 10}],
    randomRewards: [
      {itemTokenId: EstforConstants.POISON, chance: 10000, amount: 1},
      {itemTokenId: EstforConstants.SCORCHING_COWL, chance: 8, amount: 1}
    ],
    combatStats: {
      meleeAttack: 3,
      magicAttack: 12,
      rangedAttack: 3,
      meleeDefence: 0,
      magicDefence: 15,
      rangedDefence: 3,
      health: 180
    }
  },
  {
    actionId: EstforConstants.ACTION_COMBAT_ARCANE_DRAGON,
    info: {
      skill: Skill.COMBAT,
      isAvailable: true,
      actionChoiceRequired: true,
      xpPerHour: 250,
      numSpawned: 75 * 1000,
      minXP: 0,
      handItemTokenIdRangeMin: EstforConstants.COMBAT_BASE,
      handItemTokenIdRangeMax: EstforConstants.COMBAT_MAX,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: false,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [{itemTokenId: EstforConstants.DRAGON_BONE, rate: 1 * 10}],
    randomRewards: [
      {itemTokenId: EstforConstants.DRAGON_TEETH, chance: 664, amount: 1},
      {itemTokenId: EstforConstants.MASTER_BOOTS, chance: 8, amount: 1}
    ],
    combatStats: {
      meleeAttack: 5,
      magicAttack: 15,
      rangedAttack: 15,
      meleeDefence: 5,
      magicDefence: 15,
      rangedDefence: 15,
      health: 250
    }
  },
  {
    actionId: EstforConstants.ACTION_COMBAT_SNAPPER_BUG,
    info: {
      skill: Skill.COMBAT,
      isAvailable: true,
      actionChoiceRequired: true,
      xpPerHour: 250,
      numSpawned: 75 * 1000,
      minXP: 0,
      handItemTokenIdRangeMin: EstforConstants.COMBAT_BASE,
      handItemTokenIdRangeMax: EstforConstants.COMBAT_MAX,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: false,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [{itemTokenId: EstforConstants.MEDIUM_BONE, rate: 1 * 10}],
    randomRewards: [
      {itemTokenId: EstforConstants.HURA_ROOT, chance: 1328, amount: 1},
      {itemTokenId: EstforConstants.NATURE_KEY, chance: 291, amount: 1}
    ],
    combatStats: {
      meleeAttack: 18,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 20,
      magicDefence: 0,
      rangedDefence: 0,
      health: 200
    }
  },
  {
    actionId: EstforConstants.ACTION_COMBAT_SNUFFLEQUARG,
    info: {
      skill: Skill.COMBAT,
      isAvailable: true,
      actionChoiceRequired: true,
      xpPerHour: 350,
      numSpawned: 75 * 1000,
      minXP: 0,
      handItemTokenIdRangeMin: EstforConstants.COMBAT_BASE,
      handItemTokenIdRangeMax: EstforConstants.COMBAT_MAX,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: false,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [{itemTokenId: EstforConstants.LARGE_BONE, rate: 1 * 10}],
    randomRewards: [
      {itemTokenId: EstforConstants.LEAF_FRAGMENTS, chance: 1328, amount: 4},
      {itemTokenId: EstforConstants.ANURGAT, chance: 1328, amount: 1},
      {itemTokenId: EstforConstants.BARK_CHUNK, chance: 664, amount: 1}
    ],
    combatStats: {
      meleeAttack: 25,
      magicAttack: 20,
      rangedAttack: 20,
      meleeDefence: 25,
      magicDefence: 20,
      rangedDefence: 25,
      health: 230
    }
  },
  {
    actionId: EstforConstants.ACTION_COMBAT_OBGORA,
    info: {
      skill: Skill.COMBAT,
      isAvailable: true,
      actionChoiceRequired: true,
      xpPerHour: 350,
      numSpawned: 50 * 1000,
      minXP: 0,
      handItemTokenIdRangeMin: EstforConstants.COMBAT_BASE,
      handItemTokenIdRangeMax: EstforConstants.COMBAT_MAX,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: false,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [],
    randomRewards: [
      {itemTokenId: EstforConstants.AQUA_KEY, chance: 437, amount: 1},
      {itemTokenId: EstforConstants.SCORCHING_BODY, chance: 8, amount: 1}
    ],
    combatStats: {
      meleeAttack: 30,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 35,
      magicDefence: 0,
      rangedDefence: 0,
      health: 250
    }
  },
  {
    actionId: EstforConstants.ACTION_COMBAT_LOSSUTH,
    info: {
      skill: Skill.COMBAT,
      isAvailable: true,
      actionChoiceRequired: true,
      xpPerHour: 350,
      numSpawned: 50 * 1000,
      minXP: 0,
      handItemTokenIdRangeMin: EstforConstants.COMBAT_BASE,
      handItemTokenIdRangeMax: EstforConstants.COMBAT_MAX,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: false,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [],
    randomRewards: [
      {itemTokenId: EstforConstants.LOSSUTH_SCALE, chance: 664, amount: 2},
      {itemTokenId: EstforConstants.LOSSUTH_TEETH, chance: 664, amount: 1}
    ],
    combatStats: {
      meleeAttack: 35,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 40,
      magicDefence: 0,
      rangedDefence: 0,
      health: 280
    }
  },
  {
    actionId: EstforConstants.ACTION_COMBAT_SQUIGGLE_EGG,
    info: {
      skill: Skill.COMBAT,
      isAvailable: true,
      actionChoiceRequired: true,
      xpPerHour: 450,
      numSpawned: 50 * 1000,
      minXP: 0,
      handItemTokenIdRangeMin: EstforConstants.COMBAT_BASE,
      handItemTokenIdRangeMax: EstforConstants.COMBAT_MAX,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: false,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [{itemTokenId: EstforConstants.SMALL_BONE, rate: 1 * 10}],
    randomRewards: [
      {itemTokenId: EstforConstants.RUFARUM, chance: 1328, amount: 1},
      {itemTokenId: EstforConstants.RIGOB_CLOTH, chance: 1328, amount: 1},
      {itemTokenId: EstforConstants.NATURE_KEY, chance: 437, amount: 1}
    ],
    combatStats: {
      meleeAttack: 0,
      magicAttack: 45,
      rangedAttack: 30,
      meleeDefence: 30,
      magicDefence: 30,
      rangedDefence: 30,
      health: 320
    }
  },
  {
    actionId: EstforConstants.ACTION_COMBAT_QUARTZ_EAGLE,
    info: {
      skill: Skill.COMBAT,
      isAvailable: true,
      actionChoiceRequired: true,
      xpPerHour: 450,
      numSpawned: 50 * 1000,
      minXP: 0,
      handItemTokenIdRangeMin: EstforConstants.COMBAT_BASE,
      handItemTokenIdRangeMax: EstforConstants.COMBAT_MAX,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: false,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [
      {itemTokenId: EstforConstants.LARGE_BONE, rate: 1 * 10},
      {itemTokenId: EstforConstants.FEATHER, rate: 10 * 10}
    ],
    randomRewards: [
      {itemTokenId: EstforConstants.ANURGAT, chance: 1328, amount: 2},
      {itemTokenId: EstforConstants.QUARTZ_INFUSED_FEATHER, chance: 664, amount: 1},
      {itemTokenId: EstforConstants.FLUX, chance: 60, amount: 1},
      {itemTokenId: EstforConstants.SCORCHING_CHAPS, chance: 8, amount: 1}
    ],
    combatStats: {
      meleeAttack: 55,
      magicAttack: 0,
      rangedAttack: 20,
      meleeDefence: 55,
      magicDefence: 35,
      rangedDefence: 0,
      health: 360
    }
  },
  {
    actionId: EstforConstants.ACTION_COMBAT_DWELLER_BAT,
    info: {
      skill: Skill.COMBAT,
      isAvailable: true,
      actionChoiceRequired: true,
      xpPerHour: 500,
      numSpawned: 50 * 1000,
      minXP: 0,
      handItemTokenIdRangeMin: EstforConstants.COMBAT_BASE,
      handItemTokenIdRangeMax: EstforConstants.COMBAT_MAX,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: false,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [{itemTokenId: EstforConstants.LARGE_BONE, rate: 1 * 10}],
    randomRewards: [
      {itemTokenId: EstforConstants.BAT_WING, chance: 1328, amount: 1},
      {itemTokenId: EstforConstants.QUAVA_SILK, chance: 1328, amount: 1},
      {itemTokenId: EstforConstants.MASTER_BRACERS, chance: 8, amount: 1}
    ],
    combatStats: {
      meleeAttack: 65,
      magicAttack: 0,
      rangedAttack: 30,
      meleeDefence: 60,
      magicDefence: 60,
      rangedDefence: 0,
      health: 400
    }
  },
  {
    actionId: EstforConstants.ACTION_COMBAT_ANCIENT_ENT,
    info: {
      skill: Skill.COMBAT,
      isAvailable: true,
      actionChoiceRequired: true,
      xpPerHour: 500,
      numSpawned: 50 * 1000,
      minXP: 0,
      handItemTokenIdRangeMin: EstforConstants.COMBAT_BASE,
      handItemTokenIdRangeMax: EstforConstants.COMBAT_MAX,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: false,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [{itemTokenId: EstforConstants.REDWOOD_LOG, rate: 2 * 10}],
    randomRewards: [
      {itemTokenId: EstforConstants.ENCHANTED_ACORN, chance: 3320, amount: 1},
      {itemTokenId: EstforConstants.ADAMANTINE_AXE, chance: 3000, amount: 1},
      {itemTokenId: EstforConstants.MASTER_HAT, chance: 8, amount: 1}
    ],
    combatStats: {
      meleeAttack: 30,
      magicAttack: 80,
      rangedAttack: 0,
      meleeDefence: 50,
      magicDefence: 80,
      rangedDefence: 10,
      health: 420
    }
  },
  {
    actionId: EstforConstants.ACTION_COMBAT_ROCKHAWK,
    info: {
      skill: Skill.COMBAT,
      isAvailable: true,
      actionChoiceRequired: true,
      xpPerHour: 600,
      numSpawned: 50 * 1000,
      minXP: 0,
      handItemTokenIdRangeMin: EstforConstants.COMBAT_BASE,
      handItemTokenIdRangeMax: EstforConstants.COMBAT_MAX,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: false,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [
      {itemTokenId: EstforConstants.SMALL_BONE, rate: 1 * 10},
      {itemTokenId: EstforConstants.IRON_ORE, rate: 1 * 10},
      {itemTokenId: EstforConstants.FEATHER, rate: 2 * 10}
    ],
    randomRewards: [
      {itemTokenId: EstforConstants.WHITE_DEATH_SPORE, chance: 1328, amount: 2},
      {itemTokenId: EstforConstants.FLUX, chance: 600, amount: 1}
    ],
    combatStats: {
      meleeAttack: 70,
      magicAttack: 30,
      rangedAttack: 30,
      meleeDefence: 100,
      magicDefence: 30,
      rangedDefence: 30,
      health: 450
    }
  },
  {
    actionId: EstforConstants.ACTION_COMBAT_QRAKUR,
    info: {
      skill: Skill.COMBAT,
      isAvailable: true,
      actionChoiceRequired: true,
      xpPerHour: 600,
      numSpawned: 50 * 1000,
      minXP: 0,
      handItemTokenIdRangeMin: EstforConstants.COMBAT_BASE,
      handItemTokenIdRangeMax: EstforConstants.COMBAT_MAX,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: false,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [
      {itemTokenId: EstforConstants.SMALL_BONE, rate: 1 * 10},
      {itemTokenId: EstforConstants.FEATHER, rate: 10 * 10}
    ],
    randomRewards: [
      {itemTokenId: EstforConstants.FLUX, chance: 600, amount: 2},
      {itemTokenId: EstforConstants.SCORCHING_BRACERS, chance: 8, amount: 1}
    ],
    combatStats: {
      meleeAttack: 130,
      magicAttack: 70,
      rangedAttack: 0,
      meleeDefence: 170,
      magicDefence: 70,
      rangedDefence: 30,
      health: 560
    }
  },
  {
    actionId: EstforConstants.ACTION_COMBAT_ELEMENTAL_DRAGON,
    info: {
      skill: Skill.COMBAT,
      isAvailable: true,
      actionChoiceRequired: true,
      xpPerHour: 1000,
      numSpawned: 10 * 1000,
      minXP: 0,
      handItemTokenIdRangeMin: EstforConstants.COMBAT_BASE,
      handItemTokenIdRangeMax: EstforConstants.COMBAT_MAX,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: false,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [
      {itemTokenId: EstforConstants.FLUX, rate: 1 * 10},
      {itemTokenId: EstforConstants.DRAGON_TEETH, rate: 1 * 10},
      {itemTokenId: EstforConstants.DRAGON_BONE, rate: 5 * 10}
    ],
    randomRewards: [
      {itemTokenId: EstforConstants.DRAGON_CHEST, chance: 2800, amount: 1},
      {itemTokenId: EstforConstants.DRAGON_SCALE, chance: 400, amount: 1},
      {itemTokenId: EstforConstants.SCORCHING_BOOTS, chance: 8, amount: 1},
      {itemTokenId: EstforConstants.DRAGONSTONE_STAFF, chance: 2, amount: 1}
    ],
    combatStats: {
      meleeAttack: 200,
      magicAttack: 200,
      rangedAttack: 200,
      meleeDefence: 200,
      magicDefence: 100,
      rangedDefence: 200,
      health: 1000
    }
  },
  {
    actionId: EstforConstants.ACTION_COMBAT_ERKAD,
    info: {
      skill: Skill.COMBAT,
      isAvailable: true,
      actionChoiceRequired: true,
      xpPerHour: 2000,
      numSpawned: 10 * 1000,
      minXP: 0,
      handItemTokenIdRangeMin: EstforConstants.COMBAT_BASE,
      handItemTokenIdRangeMax: EstforConstants.COMBAT_MAX,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: false,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [
      {itemTokenId: EstforConstants.FLUX, rate: 1 * 10},
      {itemTokenId: EstforConstants.POISON, rate: 2 * 10},
      {itemTokenId: EstforConstants.STRING, rate: 10 * 10}
    ],
    randomRewards: [
      {itemTokenId: EstforConstants.BONE_CHEST, chance: 2800, amount: 1},
      {itemTokenId: EstforConstants.VENOM_POUCH, chance: 1328, amount: 1},
      {itemTokenId: EstforConstants.MASTER_TROUSERS, chance: 8, amount: 1},
      {itemTokenId: EstforConstants.GODLY_BOW, chance: 2, amount: 1}
    ],
    combatStats: {
      meleeAttack: 250,
      magicAttack: 250,
      rangedAttack: 250,
      meleeDefence: 150,
      magicDefence: 250,
      rangedDefence: 250,
      health: 2000
    }
  },
  {
    actionId: EstforConstants.ACTION_COMBAT_EMBER_WHELP,
    info: {
      skill: Skill.COMBAT,
      isAvailable: true,
      actionChoiceRequired: true,
      xpPerHour: 275,
      numSpawned: 75 * 1000,
      minXP: 0,
      handItemTokenIdRangeMin: EstforConstants.COMBAT_BASE,
      handItemTokenIdRangeMax: EstforConstants.COMBAT_MAX,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: true,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [{itemTokenId: EstforConstants.BRIMSTONE, rate: 1 * 10}],
    randomRewards: [{itemTokenId: EstforConstants.NATURE_KEY, chance: 364, amount: 1}],
    combatStats: {
      meleeAttack: 15,
      magicAttack: 15,
      rangedAttack: 15,
      meleeDefence: 20,
      magicDefence: 20,
      rangedDefence: 20,
      health: 250
    }
  },
  {
    actionId: EstforConstants.ACTION_COMBAT_JUVENILE_CAVE_FAIRY,
    info: {
      skill: Skill.COMBAT,
      isAvailable: true,
      actionChoiceRequired: true,
      xpPerHour: 400,
      numSpawned: 75 * 1000,
      minXP: 0,
      handItemTokenIdRangeMin: EstforConstants.COMBAT_BASE,
      handItemTokenIdRangeMax: EstforConstants.COMBAT_MAX,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: true,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [],
    randomRewards: [
      {itemTokenId: EstforConstants.AQUA_KEY, chance: 364, amount: 1},
      {itemTokenId: EstforConstants.KEY_001_OMNI, chance: 364, amount: 1}
    ],
    combatStats: {
      meleeAttack: 30,
      magicAttack: 30,
      rangedAttack: 30,
      meleeDefence: 25,
      magicDefence: 30,
      rangedDefence: 20,
      health: 350
    }
  },
  {
    actionId: EstforConstants.ACTION_COMBAT_CAVE_FAIRY,
    info: {
      skill: Skill.COMBAT,
      isAvailable: true,
      actionChoiceRequired: true,
      xpPerHour: 475,
      numSpawned: 60 * 1000,
      minXP: 0,
      handItemTokenIdRangeMin: EstforConstants.COMBAT_BASE,
      handItemTokenIdRangeMax: EstforConstants.COMBAT_MAX,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: true,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [],
    randomRewards: [
      {itemTokenId: EstforConstants.NATURE_KEY, chance: 455, amount: 1},
      {itemTokenId: EstforConstants.AQUA_KEY, chance: 455, amount: 1},
      {itemTokenId: EstforConstants.KEY_001_OMNI, chance: 455, amount: 1}
    ],
    combatStats: {
      meleeAttack: 40,
      magicAttack: 60,
      rangedAttack: 40,
      meleeDefence: 50,
      magicDefence: 60,
      rangedDefence: 40,
      health: 550
    }
  },
  {
    actionId: EstforConstants.ACTION_COMBAT_ICE_TROLL,
    info: {
      skill: Skill.COMBAT,
      isAvailable: true,
      actionChoiceRequired: true,
      xpPerHour: 550,
      numSpawned: 50 * 1000,
      minXP: 0,
      handItemTokenIdRangeMin: EstforConstants.COMBAT_BASE,
      handItemTokenIdRangeMax: EstforConstants.COMBAT_MAX,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: true,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [],
    randomRewards: [
      {itemTokenId: EstforConstants.DRAGON_KEY, chance: 546, amount: 1},
      {itemTokenId: EstforConstants.KEY_001_OMNI, chance: 546, amount: 1},
      {itemTokenId: EstforConstants.OCULITE_RING, chance: 1, amount: 1}
    ],
    combatStats: {
      meleeAttack: 60,
      magicAttack: 70,
      rangedAttack: 60,
      meleeDefence: 65,
      magicDefence: 60,
      rangedDefence: 80,
      health: 700
    }
  },
  {
    actionId: EstforConstants.ACTION_COMBAT_BLAZING_MONTANITE,
    info: {
      skill: Skill.COMBAT,
      isAvailable: true,
      actionChoiceRequired: true,
      xpPerHour: 650,
      numSpawned: 30 * 1000,
      minXP: 0,
      handItemTokenIdRangeMin: EstforConstants.COMBAT_BASE,
      handItemTokenIdRangeMax: EstforConstants.COMBAT_MAX,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: true,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [{itemTokenId: EstforConstants.BRIMSTONE, rate: 1 * 10}],
    randomRewards: [
      {itemTokenId: EstforConstants.BONE_KEY, chance: 910, amount: 1},
      {itemTokenId: EstforConstants.KEY_001_OMNI, chance: 910, amount: 1},
      {itemTokenId: EstforConstants.PRIMDIAT_RING, chance: 1, amount: 1}
    ],
    combatStats: {
      meleeAttack: 60,
      magicAttack: 120,
      rangedAttack: 60,
      meleeDefence: 80,
      magicDefence: 150,
      rangedDefence: 50,
      health: 1000
    }
  },
  {
    actionId: EstforConstants.ACTION_COMBAT_MONTANITE_ICE_TITAN,
    info: {
      skill: Skill.COMBAT,
      isAvailable: true,
      actionChoiceRequired: true,
      xpPerHour: 1200,
      numSpawned: 10 * 1000,
      minXP: 0,
      handItemTokenIdRangeMin: EstforConstants.COMBAT_BASE,
      handItemTokenIdRangeMax: EstforConstants.COMBAT_MAX,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: true,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [],
    randomRewards: [
      {itemTokenId: EstforConstants.DRAGON_KEY, chance: 2048, amount: 2},
      {itemTokenId: EstforConstants.BONE_KEY, chance: 2048, amount: 2},
      {itemTokenId: EstforConstants.KEY_001_OMNI, chance: 2048, amount: 1},
      {itemTokenId: EstforConstants.ETCHED_RING, chance: 2, amount: 1}
    ],
    combatStats: {
      meleeAttack: 220,
      magicAttack: 220,
      rangedAttack: 220,
      meleeDefence: 220,
      magicDefence: 220,
      rangedDefence: 120,
      health: 1200
    }
  },
  {
    actionId: EstforConstants.ACTION_COMBAT_MONTANITE_FIRE_TITAN,
    info: {
      skill: Skill.COMBAT,
      isAvailable: true,
      actionChoiceRequired: true,
      xpPerHour: 2400,
      numSpawned: 10 * 1000,
      minXP: 0,
      handItemTokenIdRangeMin: EstforConstants.COMBAT_BASE,
      handItemTokenIdRangeMax: EstforConstants.COMBAT_MAX,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: true,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [{itemTokenId: EstforConstants.BRIMSTONE, rate: 5 * 10}],
    randomRewards: [
      {itemTokenId: EstforConstants.DRAGON_KEY, chance: 2731, amount: 1},
      {itemTokenId: EstforConstants.BONE_KEY, chance: 2731, amount: 1},
      {itemTokenId: EstforConstants.KEY_001_OMNI, chance: 2731, amount: 2},
      {itemTokenId: EstforConstants.NOVIAN_RING, chance: 2, amount: 1}
    ],
    combatStats: {
      meleeAttack: 260,
      magicAttack: 260,
      rangedAttack: 260,
      meleeDefence: 260,
      magicDefence: 260,
      rangedDefence: 260,
      health: 2400
    }
  },
  {
    actionId: EstforConstants.ACTION_COMBAT_NIGHTMARE_NATUOW,
    info: {
      skill: Skill.COMBAT,
      isAvailable: false,
      actionChoiceRequired: true,
      xpPerHour: 200,
      numSpawned: 10 * 1000,
      minXP: 0,
      handItemTokenIdRangeMin: EstforConstants.COMBAT_BASE,
      handItemTokenIdRangeMax: EstforConstants.COMBAT_MAX,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: true,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [
      {itemTokenId: EstforConstants.SMALL_BONE, rate: 5 * 10},
      {itemTokenId: EstforConstants.NATUOW_HIDE, rate: 3 * 10}
    ],
    randomRewards: [{itemTokenId: EstforConstants.COIN, chance: 1365, amount: 1}],
    combatStats: {
      meleeAttack: 1,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangedDefence: 0,
      health: 100
    }
  },
  {
    actionId: EstforConstants.ACTION_COMBAT_NIGHTMARE_GROG_TOAD,
    info: {
      skill: Skill.COMBAT,
      isAvailable: false,
      actionChoiceRequired: true,
      xpPerHour: 350,
      numSpawned: 10 * 1000,
      minXP: 0,
      handItemTokenIdRangeMin: EstforConstants.COMBAT_BASE,
      handItemTokenIdRangeMax: EstforConstants.COMBAT_MAX,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: true,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [{itemTokenId: EstforConstants.SMALL_BONE, rate: 5 * 10}],
    randomRewards: [
      {itemTokenId: EstforConstants.POISON, chance: 33314, amount: 1},
      {itemTokenId: EstforConstants.FLIXORA, chance: 6007, amount: 1},
      {itemTokenId: EstforConstants.COIN, chance: 2731, amount: 1}
    ],
    combatStats: {
      meleeAttack: 20,
      magicAttack: 20,
      rangedAttack: 20,
      meleeDefence: 10,
      magicDefence: 10,
      rangedDefence: 10,
      health: 250
    }
  },
  {
    actionId: EstforConstants.ACTION_COMBAT_NIGHTMARE_UFFINCH,
    info: {
      skill: Skill.COMBAT,
      isAvailable: false,
      actionChoiceRequired: true,
      xpPerHour: 550,
      numSpawned: 10 * 1000,
      minXP: 0,
      handItemTokenIdRangeMin: EstforConstants.COMBAT_BASE,
      handItemTokenIdRangeMax: EstforConstants.COMBAT_MAX,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: true,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [
      {itemTokenId: EstforConstants.SMALL_BONE, rate: 5 * 10},
      {itemTokenId: EstforConstants.FEATHER, rate: 25 * 10}
    ],
    randomRewards: [
      {itemTokenId: EstforConstants.LEAF_FRAGMENTS, chance: 6007, amount: 1},
      {itemTokenId: EstforConstants.COIN, chance: 4096, amount: 1},
      {itemTokenId: EstforConstants.QUARTZ_INFUSED_FEATHER, chance: 3004, amount: 1}
    ],
    combatStats: {
      meleeAttack: 40,
      magicAttack: 40,
      rangedAttack: 40,
      meleeDefence: 30,
      magicDefence: 30,
      rangedDefence: 30,
      health: 500
    }
  },
  {
    actionId: EstforConstants.ACTION_CRAFTING_ITEM,
    info: {
      skill: Skill.CRAFTING,
      isAvailable: true,
      actionChoiceRequired: true,
      xpPerHour: 0,
      numSpawned: 0 * 1000,
      minXP: 0,
      handItemTokenIdRangeMin: EstforConstants.NONE,
      handItemTokenIdRangeMax: EstforConstants.NONE,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: false,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [],
    randomRewards: [],
    combatStats: {
      meleeAttack: 0,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangedDefence: 0,
      health: 0
    }
  },
  {
    actionId: EstforConstants.ACTION_THIEVING_CHILD,
    info: {
      skill: Skill.THIEVING,
      isAvailable: true,
      actionChoiceRequired: false,
      xpPerHour: 25,
      numSpawned: 0 * 1000,
      minXP: 0,
      handItemTokenIdRangeMin: EstforConstants.NONE,
      handItemTokenIdRangeMax: EstforConstants.NONE,
      successPercent: 70,
      worldLocation: 0,
      isFullModeOnly: false,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [],
    randomRewards: [
      {itemTokenId: EstforConstants.LOG, chance: 48000, amount: 120},
      {itemTokenId: EstforConstants.BRONZE_BAR, chance: 32000, amount: 40}
    ],
    combatStats: {
      meleeAttack: 0,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangedDefence: 0,
      health: 0
    }
  },
  {
    actionId: EstforConstants.ACTION_THIEVING_MAN,
    info: {
      skill: Skill.THIEVING,
      isAvailable: true,
      actionChoiceRequired: false,
      xpPerHour: 65,
      numSpawned: 0 * 1000,
      minXP: 374,
      handItemTokenIdRangeMin: EstforConstants.NONE,
      handItemTokenIdRangeMax: EstforConstants.NONE,
      successPercent: 65,
      worldLocation: 0,
      isFullModeOnly: false,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [],
    randomRewards: [
      {itemTokenId: EstforConstants.BRONZE_BAR, chance: 40000, amount: 50},
      {itemTokenId: EstforConstants.WILLOW_LOG, chance: 32000, amount: 100}
    ],
    combatStats: {
      meleeAttack: 0,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangedDefence: 0,
      health: 0
    }
  },
  {
    actionId: EstforConstants.ACTION_THIEVING_GUARD,
    info: {
      skill: Skill.THIEVING,
      isAvailable: true,
      actionChoiceRequired: false,
      xpPerHour: 80,
      numSpawned: 0 * 1000,
      minXP: 1021,
      handItemTokenIdRangeMin: EstforConstants.NONE,
      handItemTokenIdRangeMax: EstforConstants.NONE,
      successPercent: 60,
      worldLocation: 0,
      isFullModeOnly: false,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [],
    randomRewards: [
      {itemTokenId: EstforConstants.IRON_BAR, chance: 28000, amount: 40},
      {itemTokenId: EstforConstants.BRONZE_SWORD, chance: 8000, amount: 1}
    ],
    combatStats: {
      meleeAttack: 0,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangedDefence: 0,
      health: 0
    }
  },
  {
    actionId: EstforConstants.ACTION_THIEVING_CHEST,
    info: {
      skill: Skill.THIEVING,
      isAvailable: true,
      actionChoiceRequired: false,
      xpPerHour: 45,
      numSpawned: 0 * 1000,
      minXP: 1938,
      handItemTokenIdRangeMin: EstforConstants.NONE,
      handItemTokenIdRangeMax: EstforConstants.NONE,
      successPercent: 65,
      worldLocation: 0,
      isFullModeOnly: false,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [],
    randomRewards: [{itemTokenId: EstforConstants.SHADOW_SCROLL, chance: 12000, amount: 100}],
    combatStats: {
      meleeAttack: 0,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangedDefence: 0,
      health: 0
    }
  },
  {
    actionId: EstforConstants.ACTION_THIEVING_STALL,
    info: {
      skill: Skill.THIEVING,
      isAvailable: true,
      actionChoiceRequired: false,
      xpPerHour: 55,
      numSpawned: 0 * 1000,
      minXP: 5067,
      handItemTokenIdRangeMin: EstforConstants.NONE,
      handItemTokenIdRangeMax: EstforConstants.NONE,
      successPercent: 65,
      worldLocation: 0,
      isFullModeOnly: false,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [],
    randomRewards: [
      {itemTokenId: EstforConstants.WILLOW_LOG, chance: 36000, amount: 120},
      {itemTokenId: EstforConstants.IRON_BAR, chance: 36000, amount: 50}
    ],
    combatStats: {
      meleeAttack: 0,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangedDefence: 0,
      health: 0
    }
  },
  {
    actionId: EstforConstants.ACTION_THIEVING_FARMER,
    info: {
      skill: Skill.THIEVING,
      isAvailable: true,
      actionChoiceRequired: false,
      xpPerHour: 120,
      numSpawned: 0 * 1000,
      minXP: 9685,
      handItemTokenIdRangeMin: EstforConstants.NONE,
      handItemTokenIdRangeMax: EstforConstants.NONE,
      successPercent: 50,
      worldLocation: 0,
      isFullModeOnly: false,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [],
    randomRewards: [{itemTokenId: EstforConstants.LEAF_FRAGMENTS, chance: 40000, amount: 2}],
    combatStats: {
      meleeAttack: 0,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangedDefence: 0,
      health: 0
    }
  },
  {
    actionId: EstforConstants.ACTION_THIEVING_FISHERMAN,
    info: {
      skill: Skill.THIEVING,
      isAvailable: true,
      actionChoiceRequired: false,
      xpPerHour: 200,
      numSpawned: 0 * 1000,
      minXP: 13140,
      handItemTokenIdRangeMin: EstforConstants.NONE,
      handItemTokenIdRangeMax: EstforConstants.NONE,
      successPercent: 50,
      worldLocation: 0,
      isFullModeOnly: false,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [],
    randomRewards: [
      {itemTokenId: EstforConstants.RAW_TROUT, chance: 40000, amount: 100},
      {itemTokenId: EstforConstants.RAW_ROJJA, chance: 20000, amount: 100},
      {itemTokenId: EstforConstants.RAW_BOWFISH, chance: 12000, amount: 100}
    ],
    combatStats: {
      meleeAttack: 0,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangedDefence: 0,
      health: 0
    }
  },
  {
    actionId: EstforConstants.ACTION_THIEVING_LUMBERJACK,
    info: {
      skill: Skill.THIEVING,
      isAvailable: true,
      actionChoiceRequired: false,
      xpPerHour: 280,
      numSpawned: 0 * 1000,
      minXP: 16432,
      handItemTokenIdRangeMin: EstforConstants.NONE,
      handItemTokenIdRangeMax: EstforConstants.NONE,
      successPercent: 50,
      worldLocation: 0,
      isFullModeOnly: false,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [],
    randomRewards: [
      {itemTokenId: EstforConstants.OAK_LOG, chance: 40000, amount: 120},
      {itemTokenId: EstforConstants.WILLOW_LOG, chance: 20000, amount: 140},
      {itemTokenId: EstforConstants.MAPLE_LOG, chance: 20000, amount: 160}
    ],
    combatStats: {
      meleeAttack: 0,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangedDefence: 0,
      health: 0
    }
  },
  {
    actionId: EstforConstants.ACTION_THIEVING_BLACKSMITH,
    info: {
      skill: Skill.THIEVING,
      isAvailable: true,
      actionChoiceRequired: false,
      xpPerHour: 300,
      numSpawned: 0 * 1000,
      minXP: 23681,
      handItemTokenIdRangeMin: EstforConstants.NONE,
      handItemTokenIdRangeMax: EstforConstants.NONE,
      successPercent: 50,
      worldLocation: 0,
      isFullModeOnly: false,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [],
    randomRewards: [
      {itemTokenId: EstforConstants.BRONZE_BAR, chance: 12000, amount: 60},
      {itemTokenId: EstforConstants.IRON_BAR, chance: 12000, amount: 60},
      {itemTokenId: EstforConstants.MITHRIL_BAR, chance: 8000, amount: 60}
    ],
    combatStats: {
      meleeAttack: 0,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangedDefence: 0,
      health: 0
    }
  },
  {
    actionId: EstforConstants.ACTION_THIEVING_HEAD_GUARD,
    info: {
      skill: Skill.THIEVING,
      isAvailable: true,
      actionChoiceRequired: false,
      xpPerHour: 100,
      numSpawned: 0 * 1000,
      minXP: 33913,
      handItemTokenIdRangeMin: EstforConstants.NONE,
      handItemTokenIdRangeMax: EstforConstants.NONE,
      successPercent: 80,
      worldLocation: 0,
      isFullModeOnly: false,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [],
    randomRewards: [
      {itemTokenId: EstforConstants.SHADOW_SCROLL, chance: 14000, amount: 80},
      {itemTokenId: EstforConstants.NATURE_SCROLL, chance: 10000, amount: 80}
    ],
    combatStats: {
      meleeAttack: 0,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangedDefence: 0,
      health: 0
    }
  },
  {
    actionId: EstforConstants.ACTION_THIEVING_WIZARD,
    info: {
      skill: Skill.THIEVING,
      isAvailable: true,
      actionChoiceRequired: false,
      xpPerHour: 350,
      numSpawned: 0 * 1000,
      minXP: 68761,
      handItemTokenIdRangeMin: EstforConstants.NONE,
      handItemTokenIdRangeMax: EstforConstants.NONE,
      successPercent: 50,
      worldLocation: 0,
      isFullModeOnly: false,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [],
    randomRewards: [
      {itemTokenId: EstforConstants.SHADOW_SCROLL, chance: 12000, amount: 80},
      {itemTokenId: EstforConstants.NATURE_SCROLL, chance: 10000, amount: 80},
      {itemTokenId: EstforConstants.AQUA_SCROLL, chance: 8000, amount: 80}
    ],
    combatStats: {
      meleeAttack: 0,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangedDefence: 0,
      health: 0
    }
  },
  {
    actionId: EstforConstants.ACTION_THIEVING_POTION_SHOP,
    info: {
      skill: Skill.THIEVING,
      isAvailable: true,
      actionChoiceRequired: false,
      xpPerHour: 450,
      numSpawned: 0 * 1000,
      minXP: 195864,
      handItemTokenIdRangeMin: EstforConstants.NONE,
      handItemTokenIdRangeMax: EstforConstants.NONE,
      successPercent: 50,
      worldLocation: 0,
      isFullModeOnly: false,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [],
    randomRewards: [{itemTokenId: EstforConstants.BLUECANAR, chance: 40000, amount: 2}],
    combatStats: {
      meleeAttack: 0,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangedDefence: 0,
      health: 0
    }
  },
  {
    actionId: EstforConstants.ACTION_THIEVING_GEM_MERCHANT,
    info: {
      skill: Skill.THIEVING,
      isAvailable: true,
      actionChoiceRequired: false,
      xpPerHour: 500,
      numSpawned: 0 * 1000,
      minXP: 277219,
      handItemTokenIdRangeMin: EstforConstants.NONE,
      handItemTokenIdRangeMax: EstforConstants.NONE,
      successPercent: 50,
      worldLocation: 0,
      isFullModeOnly: false,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [],
    randomRewards: [
      {itemTokenId: EstforConstants.SAPPHIRE, chance: 32000, amount: 80},
      {itemTokenId: EstforConstants.EMERALD, chance: 28000, amount: 80},
      {itemTokenId: EstforConstants.RUBY, chance: 24000, amount: 80}
    ],
    combatStats: {
      meleeAttack: 0,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangedDefence: 0,
      health: 0
    }
  },
  {
    actionId: EstforConstants.ACTION_THIEVING_BANK,
    info: {
      skill: Skill.THIEVING,
      isAvailable: true,
      actionChoiceRequired: false,
      xpPerHour: 400,
      numSpawned: 0 * 1000,
      minXP: 784726,
      handItemTokenIdRangeMin: EstforConstants.NONE,
      handItemTokenIdRangeMax: EstforConstants.NONE,
      successPercent: 50,
      worldLocation: 0,
      isFullModeOnly: false,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [],
    randomRewards: [
      {itemTokenId: EstforConstants.MITHRIL_BAR, chance: 20000, amount: 40},
      {itemTokenId: EstforConstants.NATURE_KEY, chance: 2800, amount: 1}
    ],
    combatStats: {
      meleeAttack: 0,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangedDefence: 0,
      health: 0
    }
  },
  {
    actionId: EstforConstants.ACTION_THIEVING_MASTER_THIEF,
    info: {
      skill: Skill.THIEVING,
      isAvailable: true,
      actionChoiceRequired: false,
      xpPerHour: 1000,
      numSpawned: 0 * 1000,
      minXP: 901428,
      handItemTokenIdRangeMin: EstforConstants.NONE,
      handItemTokenIdRangeMax: EstforConstants.NONE,
      successPercent: 50,
      worldLocation: 0,
      isFullModeOnly: false,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [],
    randomRewards: [],
    combatStats: {
      meleeAttack: 0,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangedDefence: 0,
      health: 0
    }
  },
  {
    actionId: EstforConstants.ACTION_THIEVING_FOREST,
    info: {
      skill: Skill.THIEVING,
      isAvailable: true,
      actionChoiceRequired: false,
      xpPerHour: 100,
      numSpawned: 0 * 1000,
      minXP: 3236,
      handItemTokenIdRangeMin: EstforConstants.NONE,
      handItemTokenIdRangeMax: EstforConstants.NONE,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: true,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [],
    randomRewards: [
      {itemTokenId: EstforConstants.NATURE_KEY, chance: 27306, amount: 1},
      {itemTokenId: EstforConstants.DRAGON_KEY, chance: 1365, amount: 1},
      {itemTokenId: EstforConstants.BONE_KEY, chance: 1365, amount: 1}
    ],
    combatStats: {
      meleeAttack: 0,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangedDefence: 0,
      health: 0
    }
  },
  {
    actionId: EstforConstants.ACTION_THIEVING_LAKE,
    info: {
      skill: Skill.THIEVING,
      isAvailable: true,
      actionChoiceRequired: false,
      xpPerHour: 290,
      numSpawned: 0 * 1000,
      minXP: 16432,
      handItemTokenIdRangeMin: EstforConstants.NONE,
      handItemTokenIdRangeMax: EstforConstants.NONE,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: true,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [],
    randomRewards: [
      {itemTokenId: EstforConstants.AQUA_KEY, chance: 54613, amount: 1},
      {itemTokenId: EstforConstants.DRAGON_KEY, chance: 2731, amount: 1},
      {itemTokenId: EstforConstants.BONE_KEY, chance: 2731, amount: 1}
    ],
    combatStats: {
      meleeAttack: 0,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangedDefence: 0,
      health: 0
    }
  },
  {
    actionId: EstforConstants.ACTION_THIEVING_NEST,
    info: {
      skill: Skill.THIEVING,
      isAvailable: true,
      actionChoiceRequired: false,
      xpPerHour: 375,
      numSpawned: 0 * 1000,
      minXP: 68761,
      handItemTokenIdRangeMin: EstforConstants.NONE,
      handItemTokenIdRangeMax: EstforConstants.NONE,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: true,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [],
    randomRewards: [
      {itemTokenId: EstforConstants.NATURE_KEY, chance: 40959, amount: 1},
      {itemTokenId: EstforConstants.AQUA_KEY, chance: 40959, amount: 1},
      {itemTokenId: EstforConstants.DRAGON_KEY, chance: 4096, amount: 1},
      {itemTokenId: EstforConstants.BONE_KEY, chance: 4096, amount: 1}
    ],
    combatStats: {
      meleeAttack: 0,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangedDefence: 0,
      health: 0
    }
  },
  {
    actionId: EstforConstants.ACTION_THIEVING_LAIR,
    info: {
      skill: Skill.THIEVING,
      isAvailable: true,
      actionChoiceRequired: false,
      xpPerHour: 525,
      numSpawned: 0 * 1000,
      minXP: 392228,
      handItemTokenIdRangeMin: EstforConstants.NONE,
      handItemTokenIdRangeMax: EstforConstants.NONE,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: true,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [],
    randomRewards: [
      {itemTokenId: EstforConstants.DRAGON_KEY, chance: 54613, amount: 1},
      {itemTokenId: EstforConstants.NATURE_KEY, chance: 5461, amount: 1},
      {itemTokenId: EstforConstants.AQUA_KEY, chance: 5461, amount: 1}
    ],
    combatStats: {
      meleeAttack: 0,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangedDefence: 0,
      health: 0
    }
  },
  {
    actionId: EstforConstants.ACTION_THIEVING_HIDEOUT,
    info: {
      skill: Skill.THIEVING,
      isAvailable: true,
      actionChoiceRequired: false,
      xpPerHour: 800,
      numSpawned: 0 * 1000,
      minXP: 784726,
      handItemTokenIdRangeMin: EstforConstants.NONE,
      handItemTokenIdRangeMax: EstforConstants.NONE,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: true,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [],
    randomRewards: [
      {itemTokenId: EstforConstants.BONE_KEY, chance: 54613, amount: 1},
      {itemTokenId: EstforConstants.NATURE_KEY, chance: 5461, amount: 1},
      {itemTokenId: EstforConstants.AQUA_KEY, chance: 5461, amount: 1}
    ],
    combatStats: {
      meleeAttack: 0,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangedDefence: 0,
      health: 0
    }
  },
  {
    actionId: EstforConstants.ACTION_FLETCHING_ITEM,
    info: {
      skill: Skill.FLETCHING,
      isAvailable: true,
      actionChoiceRequired: true,
      xpPerHour: 0,
      numSpawned: 0 * 1000,
      minXP: 0,
      handItemTokenIdRangeMin: EstforConstants.NONE,
      handItemTokenIdRangeMax: EstforConstants.NONE,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: false,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [],
    randomRewards: [],
    combatStats: {
      meleeAttack: 0,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangedDefence: 0,
      health: 0
    }
  },
  {
    actionId: EstforConstants.ACTION_ALCHEMY_ITEM,
    info: {
      skill: Skill.ALCHEMY,
      isAvailable: true,
      actionChoiceRequired: true,
      xpPerHour: 0,
      numSpawned: 0 * 1000,
      minXP: 0,
      handItemTokenIdRangeMin: EstforConstants.NONE,
      handItemTokenIdRangeMax: EstforConstants.NONE,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: false,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [],
    randomRewards: [],
    combatStats: {
      meleeAttack: 0,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangedDefence: 0,
      health: 0
    }
  },
  {
    actionId: EstforConstants.ACTION_FORGING_ITEM,
    info: {
      skill: Skill.FORGING,
      isAvailable: true,
      actionChoiceRequired: true,
      xpPerHour: 0,
      numSpawned: 0 * 1000,
      minXP: 0,
      handItemTokenIdRangeMin: EstforConstants.NONE,
      handItemTokenIdRangeMax: EstforConstants.NONE,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: false,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [],
    randomRewards: [],
    combatStats: {
      meleeAttack: 0,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangedDefence: 0,
      health: 0
    }
  },
  {
    actionId: EstforConstants.ACTION_WOODCUTTING_TANGLED_PASS,
    info: {
      skill: Skill.WOODCUTTING,
      isAvailable: true,
      actionChoiceRequired: false,
      xpPerHour: 650,
      numSpawned: 0 * 1000,
      minXP: 392228,
      handItemTokenIdRangeMin: EstforConstants.ORICHALCUM_AXE,
      handItemTokenIdRangeMax: EstforConstants.WOODCUTTING_MAX,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: true,
      questPrerequisiteId: EstforConstants.QUEST_WAY_OF_THE_AXE_V
    },
    guaranteedRewards: [
      {itemTokenId: EstforConstants.ENCHANTED_LOG, rate: 20 * 10},
      {itemTokenId: EstforConstants.LIVING_LOG, rate: 18 * 10}
    ],
    randomRewards: [
      {itemTokenId: EstforConstants.CHEST_001_PRIMORDIAL, chance: 2731, amount: 2},
      {itemTokenId: EstforConstants.SHARD_006_OMNI, chance: 83, amount: 1}
    ],
    combatStats: {
      meleeAttack: 0,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangedDefence: 0,
      health: 0
    }
  },
  {
    actionId: EstforConstants.ACTION_WOODCUTTING_CHOKING_HOLLOW,
    info: {
      skill: Skill.WOODCUTTING,
      isAvailable: true,
      actionChoiceRequired: false,
      xpPerHour: 800,
      numSpawned: 0 * 1000,
      minXP: 1109796,
      handItemTokenIdRangeMin: EstforConstants.ORICHALCUM_AXE,
      handItemTokenIdRangeMax: EstforConstants.WOODCUTTING_MAX,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: true,
      questPrerequisiteId: EstforConstants.QUEST_WAY_OF_THE_AXE_V
    },
    guaranteedRewards: [
      {itemTokenId: EstforConstants.ENCHANTED_LOG, rate: 25 * 10},
      {itemTokenId: EstforConstants.LIVING_LOG, rate: 24 * 10}
    ],
    randomRewards: [
      {itemTokenId: EstforConstants.CHEST_001_PRIMORDIAL, chance: 5461, amount: 2},
      {itemTokenId: EstforConstants.SHARD_006_OMNI, chance: 116, amount: 1}
    ],
    combatStats: {
      meleeAttack: 0,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangedDefence: 0,
      health: 0
    }
  },
  {
    actionId: EstforConstants.ACTION_WOODCUTTING_RAZORVINE_THICKET,
    info: {
      skill: Skill.WOODCUTTING,
      isAvailable: true,
      actionChoiceRequired: false,
      xpPerHour: 950,
      numSpawned: 0 * 1000,
      minXP: 2219452,
      handItemTokenIdRangeMin: EstforConstants.ORICHALCUM_AXE,
      handItemTokenIdRangeMax: EstforConstants.WOODCUTTING_MAX,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: true,
      questPrerequisiteId: EstforConstants.QUEST_WAY_OF_THE_AXE_V
    },
    guaranteedRewards: [
      {itemTokenId: EstforConstants.ENCHANTED_LOG, rate: 36 * 10},
      {itemTokenId: EstforConstants.LIVING_LOG, rate: 30 * 10}
    ],
    randomRewards: [
      {itemTokenId: EstforConstants.CHEST_001_PRIMORDIAL, chance: 8191, amount: 2},
      {itemTokenId: EstforConstants.SHARD_006_OMNI, chance: 332, amount: 1}
    ],
    combatStats: {
      meleeAttack: 0,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangedDefence: 0,
      health: 0
    }
  },
  {
    actionId: EstforConstants.ACTION_WOODCUTTING_BRAMBLED_THROAT,
    info: {
      skill: Skill.WOODCUTTING,
      isAvailable: true,
      actionChoiceRequired: false,
      xpPerHour: 1150,
      numSpawned: 0 * 1000,
      minXP: 4438448,
      handItemTokenIdRangeMin: EstforConstants.ORICHALCUM_AXE,
      handItemTokenIdRangeMax: EstforConstants.WOODCUTTING_MAX,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: true,
      questPrerequisiteId: EstforConstants.QUEST_WAY_OF_THE_AXE_V
    },
    guaranteedRewards: [
      {itemTokenId: EstforConstants.ENCHANTED_LOG, rate: 45 * 10},
      {itemTokenId: EstforConstants.LIVING_LOG, rate: 40 * 10}
    ],
    randomRewards: [
      {itemTokenId: EstforConstants.CHEST_001_PRIMORDIAL, chance: 10922, amount: 2},
      {itemTokenId: EstforConstants.SHARD_006_OMNI, chance: 664, amount: 1}
    ],
    combatStats: {
      meleeAttack: 0,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangedDefence: 0,
      health: 0
    }
  },
  {
    actionId: EstforConstants.ACTION_WOODCUTTING_THE_HEART,
    info: {
      skill: Skill.WOODCUTTING,
      isAvailable: true,
      actionChoiceRequired: false,
      xpPerHour: 1350,
      numSpawned: 0 * 1000,
      minXP: 8876091,
      handItemTokenIdRangeMin: EstforConstants.ORICHALCUM_AXE,
      handItemTokenIdRangeMax: EstforConstants.WOODCUTTING_MAX,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: true,
      questPrerequisiteId: EstforConstants.QUEST_WAY_OF_THE_AXE_V
    },
    guaranteedRewards: [
      {itemTokenId: EstforConstants.ENCHANTED_LOG, rate: 50 * 10},
      {itemTokenId: EstforConstants.LIVING_LOG, rate: 48 * 10}
    ],
    randomRewards: [
      {itemTokenId: EstforConstants.CHEST_001_PRIMORDIAL, chance: 13653, amount: 2},
      {itemTokenId: EstforConstants.SHARD_006_OMNI, chance: 1328, amount: 1}
    ],
    combatStats: {
      meleeAttack: 0,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangedDefence: 0,
      health: 0
    }
  },
  {
    actionId: EstforConstants.ACTION_MINING_GATE,
    info: {
      skill: Skill.MINING,
      isAvailable: true,
      actionChoiceRequired: false,
      xpPerHour: 1100,
      numSpawned: 0 * 1000,
      minXP: 1569456,
      handItemTokenIdRangeMin: EstforConstants.ORICHALCUM_PICKAXE,
      handItemTokenIdRangeMax: EstforConstants.MINING_MAX,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: true,
      questPrerequisiteId: EstforConstants.QUEST_WAY_OF_THE_PICKAXE_V
    },
    guaranteedRewards: [
      {itemTokenId: EstforConstants.ORICHALCUM_ORE, rate: 20 * 10},
      {itemTokenId: EstforConstants.DRAGONSTONE, rate: 10 * 10},
      {itemTokenId: EstforConstants.CHARCOAL, rate: 30 * 10}
    ],
    randomRewards: [
      {itemTokenId: EstforConstants.CHEST_004_ASTRAL, chance: 2731, amount: 2},
      {itemTokenId: EstforConstants.SHARD_006_OMNI, chance: 83, amount: 1}
    ],
    combatStats: {
      meleeAttack: 0,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangedDefence: 0,
      health: 0
    }
  },
  {
    actionId: EstforConstants.ACTION_MINING_PETRIFIED_GARDEN,
    info: {
      skill: Skill.MINING,
      isAvailable: true,
      actionChoiceRequired: false,
      xpPerHour: 1250,
      numSpawned: 0 * 1000,
      minXP: 2219452,
      handItemTokenIdRangeMin: EstforConstants.ORICHALCUM_PICKAXE,
      handItemTokenIdRangeMax: EstforConstants.MINING_MAX,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: true,
      questPrerequisiteId: EstforConstants.QUEST_WAY_OF_THE_PICKAXE_V
    },
    guaranteedRewards: [
      {itemTokenId: EstforConstants.ORICHALCUM_ORE, rate: 25 * 10},
      {itemTokenId: EstforConstants.DRAGONSTONE, rate: 15 * 10},
      {itemTokenId: EstforConstants.CHARCOAL, rate: 40 * 10}
    ],
    randomRewards: [
      {itemTokenId: EstforConstants.CHEST_004_ASTRAL, chance: 5461, amount: 2},
      {itemTokenId: EstforConstants.SHARD_006_OMNI, chance: 116, amount: 1}
    ],
    combatStats: {
      meleeAttack: 0,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangedDefence: 0,
      health: 0
    }
  },
  {
    actionId: EstforConstants.ACTION_MINING_BURIED_COURTYARD,
    info: {
      skill: Skill.MINING,
      isAvailable: true,
      actionChoiceRequired: false,
      xpPerHour: 1400,
      numSpawned: 0 * 1000,
      minXP: 3138618,
      handItemTokenIdRangeMin: EstforConstants.ORICHALCUM_PICKAXE,
      handItemTokenIdRangeMax: EstforConstants.MINING_MAX,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: true,
      questPrerequisiteId: EstforConstants.QUEST_WAY_OF_THE_PICKAXE_V
    },
    guaranteedRewards: [
      {itemTokenId: EstforConstants.ORICHALCUM_ORE, rate: 36 * 10},
      {itemTokenId: EstforConstants.DRAGONSTONE, rate: 20 * 10},
      {itemTokenId: EstforConstants.CHARCOAL, rate: 50 * 10}
    ],
    randomRewards: [
      {itemTokenId: EstforConstants.CHEST_004_ASTRAL, chance: 8191, amount: 2},
      {itemTokenId: EstforConstants.SHARD_006_OMNI, chance: 332, amount: 1}
    ],
    combatStats: {
      meleeAttack: 0,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangedDefence: 0,
      health: 0
    }
  },
  {
    actionId: EstforConstants.ACTION_MINING_GILDED_HALLS,
    info: {
      skill: Skill.MINING,
      isAvailable: true,
      actionChoiceRequired: false,
      xpPerHour: 1550,
      numSpawned: 0 * 1000,
      minXP: 4438448,
      handItemTokenIdRangeMin: EstforConstants.ORICHALCUM_PICKAXE,
      handItemTokenIdRangeMax: EstforConstants.MINING_MAX,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: true,
      questPrerequisiteId: EstforConstants.QUEST_WAY_OF_THE_PICKAXE_V
    },
    guaranteedRewards: [
      {itemTokenId: EstforConstants.ORICHALCUM_ORE, rate: 45 * 10},
      {itemTokenId: EstforConstants.DRAGONSTONE, rate: 25 * 10},
      {itemTokenId: EstforConstants.CHARCOAL, rate: 60 * 10}
    ],
    randomRewards: [
      {itemTokenId: EstforConstants.CHEST_004_ASTRAL, chance: 10922, amount: 2},
      {itemTokenId: EstforConstants.SHARD_006_OMNI, chance: 664, amount: 1}
    ],
    combatStats: {
      meleeAttack: 0,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangedDefence: 0,
      health: 0
    }
  },
  {
    actionId: EstforConstants.ACTION_MINING_THRONE_ROOM,
    info: {
      skill: Skill.MINING,
      isAvailable: true,
      actionChoiceRequired: false,
      xpPerHour: 1700,
      numSpawned: 0 * 1000,
      minXP: 8876091,
      handItemTokenIdRangeMin: EstforConstants.ORICHALCUM_PICKAXE,
      handItemTokenIdRangeMax: EstforConstants.MINING_MAX,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: true,
      questPrerequisiteId: EstforConstants.QUEST_WAY_OF_THE_PICKAXE_V
    },
    guaranteedRewards: [
      {itemTokenId: EstforConstants.ORICHALCUM_ORE, rate: 50 * 10},
      {itemTokenId: EstforConstants.DRAGONSTONE, rate: 36 * 10},
      {itemTokenId: EstforConstants.CHARCOAL, rate: 75 * 10}
    ],
    randomRewards: [
      {itemTokenId: EstforConstants.CHEST_004_ASTRAL, chance: 13653, amount: 2},
      {itemTokenId: EstforConstants.SHARD_006_OMNI, chance: 1328, amount: 1}
    ],
    combatStats: {
      meleeAttack: 0,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangedDefence: 0,
      health: 0
    }
  },
  {
    actionId: EstforConstants.ACTION_FISHING_SPHINX_FISH,
    info: {
      skill: Skill.FISHING,
      isAvailable: true,
      actionChoiceRequired: false,
      xpPerHour: 950,
      numSpawned: 0 * 1000,
      minXP: 1569456,
      handItemTokenIdRangeMin: EstforConstants.TITANIUM_FISHING_ROD,
      handItemTokenIdRangeMax: EstforConstants.FISHING_MAX,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: true,
      questPrerequisiteId: EstforConstants.QUEST_BAIT_AND_STRING_V
    },
    guaranteedRewards: [{itemTokenId: EstforConstants.RAW_SPHINX_FISH, rate: 45 * 10}],
    randomRewards: [
      {itemTokenId: EstforConstants.CHEST_002_AETHER, chance: 2731, amount: 2},
      {itemTokenId: EstforConstants.SHARD_006_OMNI, chance: 83, amount: 1}
    ],
    combatStats: {
      meleeAttack: 0,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangedDefence: 0,
      health: 0
    }
  },
  {
    actionId: EstforConstants.ACTION_FISHING_SHAW,
    info: {
      skill: Skill.FISHING,
      isAvailable: true,
      actionChoiceRequired: false,
      xpPerHour: 1000,
      numSpawned: 0 * 1000,
      minXP: 2219452,
      handItemTokenIdRangeMin: EstforConstants.TITANIUM_FISHING_ROD,
      handItemTokenIdRangeMax: EstforConstants.FISHING_MAX,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: true,
      questPrerequisiteId: EstforConstants.QUEST_BAIT_AND_STRING_V
    },
    guaranteedRewards: [{itemTokenId: EstforConstants.RAW_SHAW, rate: 36 * 10}],
    randomRewards: [
      {itemTokenId: EstforConstants.CHEST_002_AETHER, chance: 4095, amount: 2},
      {itemTokenId: EstforConstants.SHARD_006_OMNI, chance: 116, amount: 1}
    ],
    combatStats: {
      meleeAttack: 0,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangedDefence: 0,
      health: 0
    }
  },
  {
    actionId: EstforConstants.ACTION_FISHING_VANISHING_PERCH,
    info: {
      skill: Skill.FISHING,
      isAvailable: true,
      actionChoiceRequired: false,
      xpPerHour: 1150,
      numSpawned: 0 * 1000,
      minXP: 3138618,
      handItemTokenIdRangeMin: EstforConstants.MAGIC_NET,
      handItemTokenIdRangeMax: EstforConstants.FISHING_MAX,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: true,
      questPrerequisiteId: EstforConstants.QUEST_BAIT_AND_STRING_V
    },
    guaranteedRewards: [{itemTokenId: EstforConstants.RAW_VANISHING_PERCH, rate: 36 * 10}],
    randomRewards: [
      {itemTokenId: EstforConstants.CHEST_002_AETHER, chance: 5461, amount: 2},
      {itemTokenId: EstforConstants.SHARD_006_OMNI, chance: 116, amount: 1}
    ],
    combatStats: {
      meleeAttack: 0,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangedDefence: 0,
      health: 0
    }
  },
  {
    actionId: EstforConstants.ACTION_FISHING_VIPER_BASS,
    info: {
      skill: Skill.FISHING,
      isAvailable: true,
      actionChoiceRequired: false,
      xpPerHour: 1300,
      numSpawned: 0 * 1000,
      minXP: 4438448,
      handItemTokenIdRangeMin: EstforConstants.MAGIC_NET,
      handItemTokenIdRangeMax: EstforConstants.FISHING_MAX,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: true,
      questPrerequisiteId: EstforConstants.QUEST_BAIT_AND_STRING_V
    },
    guaranteedRewards: [{itemTokenId: EstforConstants.RAW_VIPER_BASS, rate: 45 * 10}],
    randomRewards: [
      {itemTokenId: EstforConstants.CHEST_002_AETHER, chance: 8191, amount: 2},
      {itemTokenId: EstforConstants.SHARD_006_OMNI, chance: 332, amount: 1}
    ],
    combatStats: {
      meleeAttack: 0,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangedDefence: 0,
      health: 0
    }
  },
  {
    actionId: EstforConstants.ACTION_FISHING_WATER_SERPENT,
    info: {
      skill: Skill.FISHING,
      isAvailable: true,
      actionChoiceRequired: false,
      xpPerHour: 1450,
      numSpawned: 0 * 1000,
      minXP: 6276611,
      handItemTokenIdRangeMin: EstforConstants.HARPOON,
      handItemTokenIdRangeMax: EstforConstants.FISHING_MAX,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: true,
      questPrerequisiteId: EstforConstants.QUEST_BAIT_AND_STRING_V
    },
    guaranteedRewards: [{itemTokenId: EstforConstants.RAW_WATER_SERPENT, rate: 45 * 10}],
    randomRewards: [
      {itemTokenId: EstforConstants.CHEST_002_AETHER, chance: 10922, amount: 2},
      {itemTokenId: EstforConstants.SHARD_006_OMNI, chance: 664, amount: 1}
    ],
    combatStats: {
      meleeAttack: 0,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangedDefence: 0,
      health: 0
    }
  },
  {
    actionId: EstforConstants.ACTION_FISHING_WHISKFIN,
    info: {
      skill: Skill.FISHING,
      isAvailable: true,
      actionChoiceRequired: false,
      xpPerHour: 1600,
      numSpawned: 0 * 1000,
      minXP: 8876091,
      handItemTokenIdRangeMin: EstforConstants.HARPOON,
      handItemTokenIdRangeMax: EstforConstants.FISHING_MAX,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: true,
      questPrerequisiteId: EstforConstants.QUEST_BAIT_AND_STRING_V
    },
    guaranteedRewards: [{itemTokenId: EstforConstants.RAW_WHISKFIN, rate: 45 * 10}],
    randomRewards: [
      {itemTokenId: EstforConstants.CHEST_002_AETHER, chance: 13653, amount: 2},
      {itemTokenId: EstforConstants.SHARD_006_OMNI, chance: 1328, amount: 1}
    ],
    combatStats: {
      meleeAttack: 0,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangedDefence: 0,
      health: 0
    }
  },
  {
    actionId: EstforConstants.ACTION_THIEVING_FORGOTTEN_QUARRY,
    info: {
      skill: Skill.THIEVING,
      isAvailable: true,
      actionChoiceRequired: false,
      xpPerHour: 900,
      numSpawned: 0 * 1000,
      minXP: 1109796,
      handItemTokenIdRangeMin: EstforConstants.NONE,
      handItemTokenIdRangeMax: EstforConstants.NONE,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: true,
      questPrerequisiteId: EstforConstants.QUEST_SPECIAL_ASSIGNMENT_V
    },
    guaranteedRewards: [],
    randomRewards: [
      {itemTokenId: EstforConstants.CHEST_005_VOID, chance: 2731, amount: 2},
      {itemTokenId: EstforConstants.SHARD_006_OMNI, chance: 83, amount: 1}
    ],
    combatStats: {
      meleeAttack: 0,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangedDefence: 0,
      health: 0
    }
  },
  {
    actionId: EstforConstants.ACTION_THIEVING_ENDLESS_TUNNEL,
    info: {
      skill: Skill.THIEVING,
      isAvailable: true,
      actionChoiceRequired: false,
      xpPerHour: 1100,
      numSpawned: 0 * 1000,
      minXP: 1802804,
      handItemTokenIdRangeMin: EstforConstants.NONE,
      handItemTokenIdRangeMax: EstforConstants.NONE,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: true,
      questPrerequisiteId: EstforConstants.QUEST_SPECIAL_ASSIGNMENT_V
    },
    guaranteedRewards: [],
    randomRewards: [
      {itemTokenId: EstforConstants.CHEST_005_VOID, chance: 5461, amount: 2},
      {itemTokenId: EstforConstants.SHARD_006_OMNI, chance: 116, amount: 1}
    ],
    combatStats: {
      meleeAttack: 0,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangedDefence: 0,
      health: 0
    }
  },
  {
    actionId: EstforConstants.ACTION_THIEVING_CATACOMBS,
    info: {
      skill: Skill.THIEVING,
      isAvailable: true,
      actionChoiceRequired: false,
      xpPerHour: 1300,
      numSpawned: 0 * 1000,
      minXP: 3138618,
      handItemTokenIdRangeMin: EstforConstants.NONE,
      handItemTokenIdRangeMax: EstforConstants.NONE,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: true,
      questPrerequisiteId: EstforConstants.QUEST_SPECIAL_ASSIGNMENT_V
    },
    guaranteedRewards: [],
    randomRewards: [
      {itemTokenId: EstforConstants.CHEST_005_VOID, chance: 8191, amount: 2},
      {itemTokenId: EstforConstants.SHARD_006_OMNI, chance: 332, amount: 1}
    ],
    combatStats: {
      meleeAttack: 0,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangedDefence: 0,
      health: 0
    }
  },
  {
    actionId: EstforConstants.ACTION_THIEVING_LOST_SANCTUM,
    info: {
      skill: Skill.THIEVING,
      isAvailable: true,
      actionChoiceRequired: false,
      xpPerHour: 1500,
      numSpawned: 0 * 1000,
      minXP: 5098336,
      handItemTokenIdRangeMin: EstforConstants.NONE,
      handItemTokenIdRangeMax: EstforConstants.NONE,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: true,
      questPrerequisiteId: EstforConstants.QUEST_SPECIAL_ASSIGNMENT_V
    },
    guaranteedRewards: [],
    randomRewards: [
      {itemTokenId: EstforConstants.CHEST_005_VOID, chance: 10922, amount: 2},
      {itemTokenId: EstforConstants.SHARD_006_OMNI, chance: 664, amount: 1}
    ],
    combatStats: {
      meleeAttack: 0,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangedDefence: 0,
      health: 0
    }
  },
  {
    actionId: EstforConstants.ACTION_THIEVING_VAULT,
    info: {
      skill: Skill.THIEVING,
      isAvailable: true,
      actionChoiceRequired: false,
      xpPerHour: 1700,
      numSpawned: 0 * 1000,
      minXP: 8876091,
      handItemTokenIdRangeMin: EstforConstants.NONE,
      handItemTokenIdRangeMax: EstforConstants.NONE,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: true,
      questPrerequisiteId: EstforConstants.QUEST_SPECIAL_ASSIGNMENT_V
    },
    guaranteedRewards: [],
    randomRewards: [
      {itemTokenId: EstforConstants.CHEST_005_VOID, chance: 13653, amount: 2},
      {itemTokenId: EstforConstants.SHARD_006_OMNI, chance: 1328, amount: 1}
    ],
    combatStats: {
      meleeAttack: 0,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangedDefence: 0,
      health: 0
    }
  },
  {
    actionId: EstforConstants.ACTION_FARMING_ITEM,
    info: {
      skill: Skill.FARMING,
      isAvailable: true,
      actionChoiceRequired: true,
      xpPerHour: 0,
      numSpawned: 0 * 1000,
      minXP: 0,
      handItemTokenIdRangeMin: EstforConstants.NONE,
      handItemTokenIdRangeMax: EstforConstants.NONE,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: true,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [],
    randomRewards: [],
    combatStats: {
      meleeAttack: 0,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangedDefence: 0,
      health: 0
    }
  },
  {
    actionId: EstforConstants.ACTION_FARMING_MEADOW,
    info: {
      skill: Skill.FARMING,
      isAvailable: true,
      actionChoiceRequired: false,
      xpPerHour: 25,
      numSpawned: 0 * 1000,
      minXP: 0,
      handItemTokenIdRangeMin: EstforConstants.NONE,
      handItemTokenIdRangeMax: EstforConstants.NONE,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: true,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [{itemTokenId: EstforConstants.EDIBLES_001_WILD_STRAWBERRY, rate: 120 * 10}],
    randomRewards: [
      {itemTokenId: EstforConstants.FERTILE_SOIL, chance: 13653, amount: 1},
      {itemTokenId: EstforConstants.SEED_001_WILD, chance: 8192, amount: 1},
      {itemTokenId: EstforConstants.GOLDEN_SCARAB, chance: 1, amount: 1}
    ],
    combatStats: {
      meleeAttack: 0,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangedDefence: 0,
      health: 0
    }
  },
  {
    actionId: EstforConstants.ACTION_FARMING_GRASSLANDS,
    info: {
      skill: Skill.FARMING,
      isAvailable: true,
      actionChoiceRequired: false,
      xpPerHour: 40,
      numSpawned: 0 * 1000,
      minXP: 1021,
      handItemTokenIdRangeMin: EstforConstants.BLUEPRINT_HARVEST_001,
      handItemTokenIdRangeMax: EstforConstants.BLUEPRINT_HARVEST_001,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: true,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [{itemTokenId: EstforConstants.HERB_001_GLIMMER_LEAF, rate: 1 * 10}],
    randomRewards: [
      {itemTokenId: EstforConstants.HERB_010_FOOLS_BERRY, chance: 27306, amount: 1},
      {itemTokenId: EstforConstants.SEED_001_WILD, chance: 13653, amount: 1},
      {itemTokenId: EstforConstants.HERB_012_WIDOWS_CHERRIES, chance: 2731, amount: 1},
      {itemTokenId: EstforConstants.GOLDEN_SCARAB, chance: 2, amount: 1}
    ],
    combatStats: {
      meleeAttack: 0,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangedDefence: 0,
      health: 0
    }
  },
  {
    actionId: EstforConstants.ACTION_FARMING_PLAINS,
    info: {
      skill: Skill.FARMING,
      isAvailable: true,
      actionChoiceRequired: false,
      xpPerHour: 65,
      numSpawned: 0 * 1000,
      minXP: 5067,
      handItemTokenIdRangeMin: EstforConstants.BLUEPRINT_HARVEST_002,
      handItemTokenIdRangeMax: EstforConstants.BLUEPRINT_HARVEST_002,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: true,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [{itemTokenId: EstforConstants.EDIBLES_002_WILD_CHERRY, rate: 120 * 10}],
    randomRewards: [
      {itemTokenId: EstforConstants.FERTILE_SOIL, chance: 27306, amount: 1},
      {itemTokenId: EstforConstants.SEED_001_WILD, chance: 19114, amount: 1},
      {itemTokenId: EstforConstants.HERB_008_PURPERELLA, chance: 2731, amount: 1},
      {itemTokenId: EstforConstants.GOLDEN_SCARAB, chance: 4, amount: 1}
    ],
    combatStats: {
      meleeAttack: 0,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangedDefence: 0,
      health: 0
    }
  },
  {
    actionId: EstforConstants.ACTION_FARMING_RIVERBANK,
    info: {
      skill: Skill.FARMING,
      isAvailable: true,
      actionChoiceRequired: false,
      xpPerHour: 105,
      numSpawned: 0 * 1000,
      minXP: 16432,
      handItemTokenIdRangeMin: EstforConstants.BLUEPRINT_HARVEST_002,
      handItemTokenIdRangeMax: EstforConstants.BLUEPRINT_HARVEST_002,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: true,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [{itemTokenId: EstforConstants.EDIBLES_003_WILD_CARROT, rate: 80 * 10}],
    randomRewards: [
      {itemTokenId: EstforConstants.FERTILE_SOIL, chance: 40959, amount: 1},
      {itemTokenId: EstforConstants.SEED_002_UNKNOWN, chance: 8192, amount: 1},
      {itemTokenId: EstforConstants.HERB_002_RIPARIS, chance: 2731, amount: 1},
      {itemTokenId: EstforConstants.GOLDEN_SCARAB, chance: 4, amount: 1}
    ],
    combatStats: {
      meleeAttack: 0,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangedDefence: 0,
      health: 0
    }
  },
  {
    actionId: EstforConstants.ACTION_FARMING_FOREST,
    info: {
      skill: Skill.FARMING,
      isAvailable: true,
      actionChoiceRequired: false,
      xpPerHour: 135,
      numSpawned: 0 * 1000,
      minXP: 68761,
      handItemTokenIdRangeMin: EstforConstants.BLUEPRINT_HARVEST_003,
      handItemTokenIdRangeMax: EstforConstants.BLUEPRINT_HARVEST_003,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: true,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [{itemTokenId: EstforConstants.EDIBLES_004_RED_APPLE, rate: 60 * 10}],
    randomRewards: [
      {itemTokenId: EstforConstants.SEED_002_UNKNOWN, chance: 13653, amount: 1},
      {itemTokenId: EstforConstants.HERB_013_LINDWYN_BERRIES, chance: 2731, amount: 1},
      {itemTokenId: EstforConstants.HERB_009_LYFBLOOM, chance: 2731, amount: 1},
      {itemTokenId: EstforConstants.GOLDEN_SCARAB, chance: 4, amount: 1}
    ],
    combatStats: {
      meleeAttack: 0,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangedDefence: 0,
      health: 0
    }
  },
  {
    actionId: EstforConstants.ACTION_FARMING_CLIFFS,
    info: {
      skill: Skill.FARMING,
      isAvailable: true,
      actionChoiceRequired: false,
      xpPerHour: 160,
      numSpawned: 0 * 1000,
      minXP: 195864,
      handItemTokenIdRangeMin: EstforConstants.BLUEPRINT_HARVEST_003,
      handItemTokenIdRangeMax: EstforConstants.BLUEPRINT_HARVEST_003,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: true,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [{itemTokenId: EstforConstants.EDIBLES_005_PEACH, rate: 60 * 10}],
    randomRewards: [
      {itemTokenId: EstforConstants.SEED_002_UNKNOWN, chance: 19114, amount: 1},
      {itemTokenId: EstforConstants.HERB_007_BLOMSBRYD, chance: 2731, amount: 1},
      {itemTokenId: EstforConstants.GOLDEN_SCARAB, chance: 8, amount: 1}
    ],
    combatStats: {
      meleeAttack: 0,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangedDefence: 0,
      health: 0
    }
  },
  {
    actionId: EstforConstants.ACTION_FARMING_RUINS,
    info: {
      skill: Skill.FARMING,
      isAvailable: true,
      actionChoiceRequired: false,
      xpPerHour: 335,
      numSpawned: 0 * 1000,
      minXP: 392228,
      handItemTokenIdRangeMin: EstforConstants.BLUEPRINT_HARVEST_004,
      handItemTokenIdRangeMax: EstforConstants.BLUEPRINT_HARVEST_004,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: true,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [{itemTokenId: EstforConstants.EDIBLES_006_ELDER_BERRIES, rate: 50 * 10}],
    randomRewards: [
      {itemTokenId: EstforConstants.SEED_003_MYSTERIOUS, chance: 13653, amount: 1},
      {itemTokenId: EstforConstants.HERB_006_ORNFLOWER, chance: 2731, amount: 1},
      {itemTokenId: EstforConstants.GOLDEN_SCARAB, chance: 8, amount: 1}
    ],
    combatStats: {
      meleeAttack: 0,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangedDefence: 0,
      health: 0
    }
  },
  {
    actionId: EstforConstants.ACTION_FARMING_MARSHLANDS,
    info: {
      skill: Skill.FARMING,
      isAvailable: true,
      actionChoiceRequired: false,
      xpPerHour: 480,
      numSpawned: 0 * 1000,
      minXP: 784726,
      handItemTokenIdRangeMin: EstforConstants.BLUEPRINT_HARVEST_004,
      handItemTokenIdRangeMax: EstforConstants.BLUEPRINT_HARVEST_004,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: true,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [{itemTokenId: EstforConstants.HERB_002_RIPARIS, rate: 1 * 10}],
    randomRewards: [
      {itemTokenId: EstforConstants.SEED_003_MYSTERIOUS, chance: 19114, amount: 1},
      {itemTokenId: EstforConstants.HERB_014_ALDERSKORN_BERRIES, chance: 2731, amount: 1},
      {itemTokenId: EstforConstants.HERB_005_STYRGARM, chance: 2731, amount: 1},
      {itemTokenId: EstforConstants.GOLDEN_SCARAB, chance: 8, amount: 1}
    ],
    combatStats: {
      meleeAttack: 0,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangedDefence: 0,
      health: 0
    }
  },
  {
    actionId: EstforConstants.ACTION_FARMING_WETLANDS,
    info: {
      skill: Skill.FARMING,
      isAvailable: true,
      actionChoiceRequired: false,
      xpPerHour: 630,
      numSpawned: 0 * 1000,
      minXP: 1109796,
      handItemTokenIdRangeMin: EstforConstants.BLUEPRINT_HARVEST_005,
      handItemTokenIdRangeMax: EstforConstants.BLUEPRINT_HARVEST_005,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: true,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [{itemTokenId: EstforConstants.HERB_010_FOOLS_BERRY, rate: 1 * 10}],
    randomRewards: [
      {itemTokenId: EstforConstants.HERB_011_LUMELILA, chance: 27306, amount: 1},
      {itemTokenId: EstforConstants.SEED_004_OBSCURE, chance: 8192, amount: 1},
      {itemTokenId: EstforConstants.CHEST_003_ARCANE, chance: 2731, amount: 1},
      {itemTokenId: EstforConstants.GOLDEN_SCARAB, chance: 16, amount: 1}
    ],
    combatStats: {
      meleeAttack: 0,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangedDefence: 0,
      health: 0
    }
  },
  {
    actionId: EstforConstants.ACTION_FARMING_PLATEAU,
    info: {
      skill: Skill.FARMING,
      isAvailable: true,
      actionChoiceRequired: false,
      xpPerHour: 780,
      numSpawned: 0 * 1000,
      minXP: 2219452,
      handItemTokenIdRangeMin: EstforConstants.BLUEPRINT_HARVEST_005,
      handItemTokenIdRangeMax: EstforConstants.BLUEPRINT_HARVEST_005,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: true,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [{itemTokenId: EstforConstants.EDIBLES_007_HONEY, rate: 36 * 10}],
    randomRewards: [
      {itemTokenId: EstforConstants.HERB_003_SHIMMERWEED, chance: 32768, amount: 1},
      {itemTokenId: EstforConstants.SEED_004_OBSCURE, chance: 13653, amount: 1},
      {itemTokenId: EstforConstants.CHEST_003_ARCANE, chance: 5461, amount: 1},
      {itemTokenId: EstforConstants.GOLDEN_SCARAB, chance: 16, amount: 1}
    ],
    combatStats: {
      meleeAttack: 0,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangedDefence: 0,
      health: 0
    }
  },
  {
    actionId: EstforConstants.ACTION_FARMING_BLUFF,
    info: {
      skill: Skill.FARMING,
      isAvailable: true,
      actionChoiceRequired: false,
      xpPerHour: 890,
      numSpawned: 0 * 1000,
      minXP: 4438448,
      handItemTokenIdRangeMin: EstforConstants.BLUEPRINT_HARVEST_006,
      handItemTokenIdRangeMax: EstforConstants.BLUEPRINT_HARVEST_006,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: true,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [{itemTokenId: EstforConstants.HERB_003_SHIMMERWEED, rate: 1 * 10}],
    randomRewards: [
      {itemTokenId: EstforConstants.EDIBLES_007_HONEY, chance: 27306, amount: 1},
      {itemTokenId: EstforConstants.SEED_005_ANCIENT, chance: 8192, amount: 1},
      {itemTokenId: EstforConstants.CHEST_003_ARCANE, chance: 8192, amount: 1},
      {itemTokenId: EstforConstants.GOLDEN_SCARAB, chance: 16, amount: 1}
    ],
    combatStats: {
      meleeAttack: 0,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangedDefence: 0,
      health: 0
    }
  },
  {
    actionId: EstforConstants.ACTION_FARMING_RIDGE,
    info: {
      skill: Skill.FARMING,
      isAvailable: true,
      actionChoiceRequired: false,
      xpPerHour: 1000,
      numSpawned: 0 * 1000,
      minXP: 8876091,
      handItemTokenIdRangeMin: EstforConstants.BLUEPRINT_HARVEST_006,
      handItemTokenIdRangeMax: EstforConstants.BLUEPRINT_HARVEST_006,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: true,
      questPrerequisiteId: 0
    },
    guaranteedRewards: [{itemTokenId: EstforConstants.HERB_004_FROST_BLOSSOM, rate: 1 * 10}],
    randomRewards: [
      {itemTokenId: EstforConstants.SEED_005_ANCIENT, chance: 13653, amount: 1},
      {itemTokenId: EstforConstants.CHEST_003_ARCANE, chance: 10923, amount: 1},
      {itemTokenId: EstforConstants.HERB_015_EVIGOR_FRUIT, chance: 2731, amount: 1},
      {itemTokenId: EstforConstants.GOLDEN_SCARAB, chance: 32, amount: 1}
    ],
    combatStats: {
      meleeAttack: 0,
      magicAttack: 0,
      rangedAttack: 0,
      meleeDefence: 0,
      magicDefence: 0,
      rangedDefence: 0,
      health: 0
    }
  }
];
