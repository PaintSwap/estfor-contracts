import {ethers} from "ethers";
import {EstforConstants} from "@paintswap/estfor-definitions";
import {InstantVRFActionInput, InstantVRFActionType} from "@paintswap/estfor-definitions/types";
export const allInstantVRFActions: InstantVRFActionInput[] = [
  {
    actionId: EstforConstants.INSTANT_VRF_ACTION_FORGING_ORICHALCUM_HELMET,
    inputTokenIds: [EstforConstants.INFUSED_ORICHALCUM_HELMET],
    inputAmounts: [1],
    data: ethers.utils.defaultAbiCoder.encode(
      ["uint8 version", "tuple(uint16 itemTokenId,uint16 chance,uint16 amount)[]"],
      [
        0,
        [
          {itemTokenId: EstforConstants.ORICHALCUM_HELMET_1, chance: 65535, amount: 1},
          {itemTokenId: EstforConstants.ORICHALCUM_HELMET_2, chance: 26214, amount: 1},
          {itemTokenId: EstforConstants.ORICHALCUM_HELMET_3, chance: 10486, amount: 1},
          {itemTokenId: EstforConstants.ORICHALCUM_HELMET_4, chance: 3932, amount: 1},
          {itemTokenId: EstforConstants.ORICHALCUM_HELMET_5, chance: 655, amount: 1},
        ],
      ]
    ),
    isFullModeOnly: true,
    actionType: InstantVRFActionType.FORGING,
  },
  {
    actionId: EstforConstants.INSTANT_VRF_ACTION_FORGING_ORICHALCUM_ARMOR,
    inputTokenIds: [EstforConstants.INFUSED_ORICHALCUM_ARMOR],
    inputAmounts: [1],
    data: ethers.utils.defaultAbiCoder.encode(
      ["uint8 version", "tuple(uint16 itemTokenId,uint16 chance,uint16 amount)[]"],
      [
        0,
        [
          {itemTokenId: EstforConstants.ORICHALCUM_ARMOR_1, chance: 65535, amount: 1},
          {itemTokenId: EstforConstants.ORICHALCUM_ARMOR_2, chance: 26214, amount: 1},
          {itemTokenId: EstforConstants.ORICHALCUM_ARMOR_3, chance: 10486, amount: 1},
          {itemTokenId: EstforConstants.ORICHALCUM_ARMOR_4, chance: 3932, amount: 1},
          {itemTokenId: EstforConstants.ORICHALCUM_ARMOR_5, chance: 655, amount: 1},
        ],
      ]
    ),
    isFullModeOnly: true,
    actionType: InstantVRFActionType.FORGING,
  },
  {
    actionId: EstforConstants.INSTANT_VRF_ACTION_FORGING_ORICHALCUM_TASSETS,
    inputTokenIds: [EstforConstants.INFUSED_ORICHALCUM_TASSETS],
    inputAmounts: [1],
    data: ethers.utils.defaultAbiCoder.encode(
      ["uint8 version", "tuple(uint16 itemTokenId,uint16 chance,uint16 amount)[]"],
      [
        0,
        [
          {itemTokenId: EstforConstants.ORICHALCUM_TASSETS_1, chance: 65535, amount: 1},
          {itemTokenId: EstforConstants.ORICHALCUM_TASSETS_2, chance: 26214, amount: 1},
          {itemTokenId: EstforConstants.ORICHALCUM_TASSETS_3, chance: 10486, amount: 1},
          {itemTokenId: EstforConstants.ORICHALCUM_TASSETS_4, chance: 3932, amount: 1},
          {itemTokenId: EstforConstants.ORICHALCUM_TASSETS_5, chance: 655, amount: 1},
        ],
      ]
    ),
    isFullModeOnly: true,
    actionType: InstantVRFActionType.FORGING,
  },
  {
    actionId: EstforConstants.INSTANT_VRF_ACTION_FORGING_ORICHALCUM_GAUNTLETS,
    inputTokenIds: [EstforConstants.INFUSED_ORICHALCUM_GAUNTLETS],
    inputAmounts: [1],
    data: ethers.utils.defaultAbiCoder.encode(
      ["uint8 version", "tuple(uint16 itemTokenId,uint16 chance,uint16 amount)[]"],
      [
        0,
        [
          {itemTokenId: EstforConstants.ORICHALCUM_GAUNTLETS_1, chance: 65535, amount: 1},
          {itemTokenId: EstforConstants.ORICHALCUM_GAUNTLETS_2, chance: 26214, amount: 1},
          {itemTokenId: EstforConstants.ORICHALCUM_GAUNTLETS_3, chance: 10486, amount: 1},
          {itemTokenId: EstforConstants.ORICHALCUM_GAUNTLETS_4, chance: 3932, amount: 1},
          {itemTokenId: EstforConstants.ORICHALCUM_GAUNTLETS_5, chance: 655, amount: 1},
        ],
      ]
    ),
    isFullModeOnly: true,
    actionType: InstantVRFActionType.FORGING,
  },
  {
    actionId: EstforConstants.INSTANT_VRF_ACTION_FORGING_ORICHALCUM_BOOTS,
    inputTokenIds: [EstforConstants.INFUSED_ORICHALCUM_BOOTS],
    inputAmounts: [1],
    data: ethers.utils.defaultAbiCoder.encode(
      ["uint8 version", "tuple(uint16 itemTokenId,uint16 chance,uint16 amount)[]"],
      [
        0,
        [
          {itemTokenId: EstforConstants.ORICHALCUM_BOOTS_1, chance: 65535, amount: 1},
          {itemTokenId: EstforConstants.ORICHALCUM_BOOTS_2, chance: 26214, amount: 1},
          {itemTokenId: EstforConstants.ORICHALCUM_BOOTS_3, chance: 10486, amount: 1},
          {itemTokenId: EstforConstants.ORICHALCUM_BOOTS_4, chance: 3932, amount: 1},
          {itemTokenId: EstforConstants.ORICHALCUM_BOOTS_5, chance: 655, amount: 1},
        ],
      ]
    ),
    isFullModeOnly: true,
    actionType: InstantVRFActionType.FORGING,
  },
  {
    actionId: EstforConstants.INSTANT_VRF_ACTION_FORGING_ORICHALCUM_SHIELD,
    inputTokenIds: [EstforConstants.INFUSED_ORICHALCUM_SHIELD],
    inputAmounts: [1],
    data: ethers.utils.defaultAbiCoder.encode(
      ["uint8 version", "tuple(uint16 itemTokenId,uint16 chance,uint16 amount)[]"],
      [
        0,
        [
          {itemTokenId: EstforConstants.ORICHALCUM_SHIELD_1, chance: 65535, amount: 1},
          {itemTokenId: EstforConstants.ORICHALCUM_SHIELD_2, chance: 26214, amount: 1},
          {itemTokenId: EstforConstants.ORICHALCUM_SHIELD_3, chance: 10486, amount: 1},
          {itemTokenId: EstforConstants.ORICHALCUM_SHIELD_4, chance: 3932, amount: 1},
          {itemTokenId: EstforConstants.ORICHALCUM_SHIELD_5, chance: 655, amount: 1},
        ],
      ]
    ),
    isFullModeOnly: true,
    actionType: InstantVRFActionType.FORGING,
  },
  {
    actionId: EstforConstants.INSTANT_VRF_ACTION_FORGING_DRAGONSTONE_AMULET,
    inputTokenIds: [EstforConstants.INFUSED_DRAGONSTONE_AMULET],
    inputAmounts: [1],
    data: ethers.utils.defaultAbiCoder.encode(
      ["uint8 version", "tuple(uint16 itemTokenId,uint16 chance,uint16 amount)[]"],
      [
        0,
        [
          {itemTokenId: EstforConstants.DRAGONSTONE_AMULET_1, chance: 65535, amount: 1},
          {itemTokenId: EstforConstants.DRAGONSTONE_AMULET_2, chance: 26214, amount: 1},
          {itemTokenId: EstforConstants.DRAGONSTONE_AMULET_3, chance: 10486, amount: 1},
          {itemTokenId: EstforConstants.DRAGONSTONE_AMULET_4, chance: 3932, amount: 1},
          {itemTokenId: EstforConstants.DRAGONSTONE_AMULET_5, chance: 655, amount: 1},
        ],
      ]
    ),
    isFullModeOnly: true,
    actionType: InstantVRFActionType.FORGING,
  },
  {
    actionId: EstforConstants.INSTANT_VRF_ACTION_FORGING_MASTER_HAT,
    inputTokenIds: [EstforConstants.INFUSED_MASTER_HAT],
    inputAmounts: [1],
    data: ethers.utils.defaultAbiCoder.encode(
      ["uint8 version", "tuple(uint16 itemTokenId,uint16 chance,uint16 amount)[]"],
      [
        0,
        [
          {itemTokenId: EstforConstants.MASTER_HAT_1, chance: 65535, amount: 1},
          {itemTokenId: EstforConstants.MASTER_HAT_2, chance: 26214, amount: 1},
          {itemTokenId: EstforConstants.MASTER_HAT_3, chance: 10486, amount: 1},
          {itemTokenId: EstforConstants.MASTER_HAT_4, chance: 3932, amount: 1},
          {itemTokenId: EstforConstants.MASTER_HAT_5, chance: 655, amount: 1},
        ],
      ]
    ),
    isFullModeOnly: true,
    actionType: InstantVRFActionType.FORGING,
  },
  {
    actionId: EstforConstants.INSTANT_VRF_ACTION_FORGING_MASTER_BODY,
    inputTokenIds: [EstforConstants.INFUSED_MASTER_BODY],
    inputAmounts: [1],
    data: ethers.utils.defaultAbiCoder.encode(
      ["uint8 version", "tuple(uint16 itemTokenId,uint16 chance,uint16 amount)[]"],
      [
        0,
        [
          {itemTokenId: EstforConstants.MASTER_BODY_1, chance: 65535, amount: 1},
          {itemTokenId: EstforConstants.MASTER_BODY_2, chance: 26214, amount: 1},
          {itemTokenId: EstforConstants.MASTER_BODY_3, chance: 10486, amount: 1},
          {itemTokenId: EstforConstants.MASTER_BODY_4, chance: 3932, amount: 1},
          {itemTokenId: EstforConstants.MASTER_BODY_5, chance: 655, amount: 1},
        ],
      ]
    ),
    isFullModeOnly: true,
    actionType: InstantVRFActionType.FORGING,
  },
  {
    actionId: EstforConstants.INSTANT_VRF_ACTION_FORGING_MASTER_TROUSERS,
    inputTokenIds: [EstforConstants.INFUSED_MASTER_TROUSERS],
    inputAmounts: [1],
    data: ethers.utils.defaultAbiCoder.encode(
      ["uint8 version", "tuple(uint16 itemTokenId,uint16 chance,uint16 amount)[]"],
      [
        0,
        [
          {itemTokenId: EstforConstants.MASTER_TROUSERS_1, chance: 65535, amount: 1},
          {itemTokenId: EstforConstants.MASTER_TROUSERS_2, chance: 26214, amount: 1},
          {itemTokenId: EstforConstants.MASTER_TROUSERS_3, chance: 10486, amount: 1},
          {itemTokenId: EstforConstants.MASTER_TROUSERS_4, chance: 3932, amount: 1},
          {itemTokenId: EstforConstants.MASTER_TROUSERS_5, chance: 655, amount: 1},
        ],
      ]
    ),
    isFullModeOnly: true,
    actionType: InstantVRFActionType.FORGING,
  },
  {
    actionId: EstforConstants.INSTANT_VRF_ACTION_FORGING_MASTER_BRACERS,
    inputTokenIds: [EstforConstants.INFUSED_MASTER_BRACERS],
    inputAmounts: [1],
    data: ethers.utils.defaultAbiCoder.encode(
      ["uint8 version", "tuple(uint16 itemTokenId,uint16 chance,uint16 amount)[]"],
      [
        0,
        [
          {itemTokenId: EstforConstants.MASTER_BRACERS_1, chance: 65535, amount: 1},
          {itemTokenId: EstforConstants.MASTER_BRACERS_2, chance: 26214, amount: 1},
          {itemTokenId: EstforConstants.MASTER_BRACERS_3, chance: 10486, amount: 1},
          {itemTokenId: EstforConstants.MASTER_BRACERS_4, chance: 3932, amount: 1},
          {itemTokenId: EstforConstants.MASTER_BRACERS_5, chance: 655, amount: 1},
        ],
      ]
    ),
    isFullModeOnly: true,
    actionType: InstantVRFActionType.FORGING,
  },
  {
    actionId: EstforConstants.INSTANT_VRF_ACTION_FORGING_MASTER_BOOTS,
    inputTokenIds: [EstforConstants.INFUSED_MASTER_BOOTS],
    inputAmounts: [1],
    data: ethers.utils.defaultAbiCoder.encode(
      ["uint8 version", "tuple(uint16 itemTokenId,uint16 chance,uint16 amount)[]"],
      [
        0,
        [
          {itemTokenId: EstforConstants.MASTER_BOOTS_1, chance: 65535, amount: 1},
          {itemTokenId: EstforConstants.MASTER_BOOTS_2, chance: 26214, amount: 1},
          {itemTokenId: EstforConstants.MASTER_BOOTS_3, chance: 10486, amount: 1},
          {itemTokenId: EstforConstants.MASTER_BOOTS_4, chance: 3932, amount: 1},
          {itemTokenId: EstforConstants.MASTER_BOOTS_5, chance: 655, amount: 1},
        ],
      ]
    ),
    isFullModeOnly: true,
    actionType: InstantVRFActionType.FORGING,
  },
  {
    actionId: EstforConstants.INSTANT_VRF_ACTION_FORGING_ORICHALCUM_SWORD,
    inputTokenIds: [EstforConstants.INFUSED_ORICHALCUM_SWORD],
    inputAmounts: [1],
    data: ethers.utils.defaultAbiCoder.encode(
      ["uint8 version", "tuple(uint16 itemTokenId,uint16 chance,uint16 amount)[]"],
      [
        0,
        [
          {itemTokenId: EstforConstants.ORICHALCUM_SWORD_1, chance: 65535, amount: 1},
          {itemTokenId: EstforConstants.ORICHALCUM_SWORD_2, chance: 26214, amount: 1},
          {itemTokenId: EstforConstants.ORICHALCUM_SWORD_3, chance: 10486, amount: 1},
          {itemTokenId: EstforConstants.ORICHALCUM_SWORD_4, chance: 3932, amount: 1},
          {itemTokenId: EstforConstants.ORICHALCUM_SWORD_5, chance: 655, amount: 1},
        ],
      ]
    ),
    isFullModeOnly: true,
    actionType: InstantVRFActionType.FORGING,
  },
  {
    actionId: EstforConstants.INSTANT_VRF_ACTION_FORGING_DRAGONSTONE_STAFF,
    inputTokenIds: [EstforConstants.INFUSED_DRAGONSTONE_STAFF],
    inputAmounts: [1],
    data: ethers.utils.defaultAbiCoder.encode(
      ["uint8 version", "tuple(uint16 itemTokenId,uint16 chance,uint16 amount)[]"],
      [
        0,
        [
          {itemTokenId: EstforConstants.DRAGONSTONE_STAFF_1, chance: 65535, amount: 1},
          {itemTokenId: EstforConstants.DRAGONSTONE_STAFF_2, chance: 26214, amount: 1},
          {itemTokenId: EstforConstants.DRAGONSTONE_STAFF_3, chance: 10486, amount: 1},
          {itemTokenId: EstforConstants.DRAGONSTONE_STAFF_4, chance: 3932, amount: 1},
          {itemTokenId: EstforConstants.DRAGONSTONE_STAFF_5, chance: 655, amount: 1},
        ],
      ]
    ),
    isFullModeOnly: true,
    actionType: InstantVRFActionType.FORGING,
  },
  {
    actionId: EstforConstants.INSTANT_VRF_ACTION_FORGING_GODLY_BOW,
    inputTokenIds: [EstforConstants.INFUSED_GODLY_BOW],
    inputAmounts: [1],
    data: ethers.utils.defaultAbiCoder.encode(
      ["uint8 version", "tuple(uint16 itemTokenId,uint16 chance,uint16 amount)[]"],
      [
        0,
        [
          {itemTokenId: EstforConstants.GODLY_BOW_1, chance: 65535, amount: 1},
          {itemTokenId: EstforConstants.GODLY_BOW_2, chance: 26214, amount: 1},
          {itemTokenId: EstforConstants.GODLY_BOW_3, chance: 10486, amount: 1},
          {itemTokenId: EstforConstants.GODLY_BOW_4, chance: 3932, amount: 1},
          {itemTokenId: EstforConstants.GODLY_BOW_5, chance: 655, amount: 1},
        ],
      ]
    ),
    isFullModeOnly: true,
    actionType: InstantVRFActionType.FORGING,
  },
  {
    actionId: EstforConstants.INSTANT_VRF_ACTION_FORGING_SCORCHING_COWL,
    inputTokenIds: [EstforConstants.INFUSED_SCORCHING_COWL],
    inputAmounts: [1],
    data: ethers.utils.defaultAbiCoder.encode(
      ["uint8 version", "tuple(uint16 itemTokenId,uint16 chance,uint16 amount)[]"],
      [
        0,
        [
          {itemTokenId: EstforConstants.SCORCHING_COWL_1, chance: 65535, amount: 1},
          {itemTokenId: EstforConstants.SCORCHING_COWL_2, chance: 26214, amount: 1},
          {itemTokenId: EstforConstants.SCORCHING_COWL_3, chance: 10486, amount: 1},
          {itemTokenId: EstforConstants.SCORCHING_COWL_4, chance: 3932, amount: 1},
          {itemTokenId: EstforConstants.SCORCHING_COWL_5, chance: 655, amount: 1},
        ],
      ]
    ),
    isFullModeOnly: true,
    actionType: InstantVRFActionType.FORGING,
  },
  {
    actionId: EstforConstants.INSTANT_VRF_ACTION_FORGING_SCORCHING_BODY,
    inputTokenIds: [EstforConstants.INFUSED_SCORCHING_BODY],
    inputAmounts: [1],
    data: ethers.utils.defaultAbiCoder.encode(
      ["uint8 version", "tuple(uint16 itemTokenId,uint16 chance,uint16 amount)[]"],
      [
        0,
        [
          {itemTokenId: EstforConstants.SCORCHING_BODY_1, chance: 65535, amount: 1},
          {itemTokenId: EstforConstants.SCORCHING_BODY_2, chance: 26214, amount: 1},
          {itemTokenId: EstforConstants.SCORCHING_BODY_3, chance: 10486, amount: 1},
          {itemTokenId: EstforConstants.SCORCHING_BODY_4, chance: 3932, amount: 1},
          {itemTokenId: EstforConstants.SCORCHING_BODY_5, chance: 655, amount: 1},
        ],
      ]
    ),
    isFullModeOnly: true,
    actionType: InstantVRFActionType.FORGING,
  },
  {
    actionId: EstforConstants.INSTANT_VRF_ACTION_FORGING_SCORCHING_CHAPS,
    inputTokenIds: [EstforConstants.INFUSED_SCORCHING_CHAPS],
    inputAmounts: [1],
    data: ethers.utils.defaultAbiCoder.encode(
      ["uint8 version", "tuple(uint16 itemTokenId,uint16 chance,uint16 amount)[]"],
      [
        0,
        [
          {itemTokenId: EstforConstants.SCORCHING_CHAPS_1, chance: 65535, amount: 1},
          {itemTokenId: EstforConstants.SCORCHING_CHAPS_2, chance: 26214, amount: 1},
          {itemTokenId: EstforConstants.SCORCHING_CHAPS_3, chance: 10486, amount: 1},
          {itemTokenId: EstforConstants.SCORCHING_CHAPS_4, chance: 3932, amount: 1},
          {itemTokenId: EstforConstants.SCORCHING_CHAPS_5, chance: 655, amount: 1},
        ],
      ]
    ),
    isFullModeOnly: true,
    actionType: InstantVRFActionType.FORGING,
  },
  {
    actionId: EstforConstants.INSTANT_VRF_ACTION_FORGING_SCORCHING_BRACERS,
    inputTokenIds: [EstforConstants.INFUSED_SCORCHING_BRACERS],
    inputAmounts: [1],
    data: ethers.utils.defaultAbiCoder.encode(
      ["uint8 version", "tuple(uint16 itemTokenId,uint16 chance,uint16 amount)[]"],
      [
        0,
        [
          {itemTokenId: EstforConstants.SCORCHING_BRACERS_1, chance: 65535, amount: 1},
          {itemTokenId: EstforConstants.SCORCHING_BRACERS_2, chance: 26214, amount: 1},
          {itemTokenId: EstforConstants.SCORCHING_BRACERS_3, chance: 10486, amount: 1},
          {itemTokenId: EstforConstants.SCORCHING_BRACERS_4, chance: 3932, amount: 1},
          {itemTokenId: EstforConstants.SCORCHING_BRACERS_5, chance: 655, amount: 1},
        ],
      ]
    ),
    isFullModeOnly: true,
    actionType: InstantVRFActionType.FORGING,
  },
  {
    actionId: EstforConstants.INSTANT_VRF_ACTION_FORGING_SCORCHING_BOOTS,
    inputTokenIds: [EstforConstants.INFUSED_SCORCHING_BOOTS],
    inputAmounts: [1],
    data: ethers.utils.defaultAbiCoder.encode(
      ["uint8 version", "tuple(uint16 itemTokenId,uint16 chance,uint16 amount)[]"],
      [
        0,
        [
          {itemTokenId: EstforConstants.SCORCHING_BOOTS_1, chance: 65535, amount: 1},
          {itemTokenId: EstforConstants.SCORCHING_BOOTS_2, chance: 26214, amount: 1},
          {itemTokenId: EstforConstants.SCORCHING_BOOTS_3, chance: 10486, amount: 1},
          {itemTokenId: EstforConstants.SCORCHING_BOOTS_4, chance: 3932, amount: 1},
          {itemTokenId: EstforConstants.SCORCHING_BOOTS_5, chance: 655, amount: 1},
        ],
      ]
    ),
    isFullModeOnly: true,
    actionType: InstantVRFActionType.FORGING,
  },
  {
    actionType: InstantVRFActionType.EGG,
    inputTokenIds: [EstforConstants.EGG_TIER1],
    inputAmounts: [1],
    actionId: EstforConstants.INSTANT_VRF_ACTION_EGG_TIER1,
    data: ethers.utils.defaultAbiCoder.encode(
      ["uint8 version", "tuple(uint16 rewardBasePetIdMin,uint16 rewardBasePetIdMax)"],
      [
        0,
        {rewardBasePetIdMin: EstforConstants.DEFAULT_MIN_TIER1, rewardBasePetIdMax: EstforConstants.DEFAULT_MAX_TIER1},
      ]
    ),
    isFullModeOnly: true,
  },
  {
    actionType: InstantVRFActionType.EGG,
    inputTokenIds: [EstforConstants.EGG_TIER2],
    inputAmounts: [1],
    actionId: EstforConstants.INSTANT_VRF_ACTION_EGG_TIER2,
    data: ethers.utils.defaultAbiCoder.encode(
      ["uint8 version", "tuple(uint16 rewardBasePetIdMin,uint16 rewardBasePetIdMax)"],
      [
        0,
        {rewardBasePetIdMin: EstforConstants.DEFAULT_MIN_TIER2, rewardBasePetIdMax: EstforConstants.DEFAULT_MAX_TIER2},
      ]
    ),
    isFullModeOnly: true,
  },
  {
    actionType: InstantVRFActionType.EGG,
    inputTokenIds: [EstforConstants.EGG_TIER3],
    inputAmounts: [1],
    actionId: EstforConstants.INSTANT_VRF_ACTION_EGG_TIER3,
    data: ethers.utils.defaultAbiCoder.encode(
      ["uint8 version", "tuple(uint16 rewardBasePetIdMin,uint16 rewardBasePetIdMax)"],
      [
        0,
        {rewardBasePetIdMin: EstforConstants.DEFAULT_MIN_TIER3, rewardBasePetIdMax: EstforConstants.DEFAULT_MAX_TIER3},
      ]
    ),
    isFullModeOnly: true,
  },
  {
    actionType: InstantVRFActionType.EGG,
    inputTokenIds: [EstforConstants.EGG_TIER4],
    inputAmounts: [1],
    actionId: EstforConstants.INSTANT_VRF_ACTION_EGG_TIER4,
    data: ethers.utils.defaultAbiCoder.encode(
      ["uint8 version", "tuple(uint16 rewardBasePetIdMin,uint16 rewardBasePetIdMax)"],
      [
        0,
        {rewardBasePetIdMin: EstforConstants.DEFAULT_MIN_TIER4, rewardBasePetIdMax: EstforConstants.DEFAULT_MAX_TIER4},
      ]
    ),
    isFullModeOnly: true,
  },
  {
    actionType: InstantVRFActionType.EGG,
    inputTokenIds: [EstforConstants.EGG_TIER5],
    inputAmounts: [1],
    actionId: EstforConstants.INSTANT_VRF_ACTION_EGG_TIER5,
    data: ethers.utils.defaultAbiCoder.encode(
      ["uint8 version", "tuple(uint16 rewardBasePetIdMin,uint16 rewardBasePetIdMax)"],
      [
        0,
        {rewardBasePetIdMin: EstforConstants.DEFAULT_MIN_TIER5, rewardBasePetIdMax: EstforConstants.DEFAULT_MAX_TIER5},
      ]
    ),
    isFullModeOnly: true,
  },
  {
    actionType: InstantVRFActionType.EGG,
    inputTokenIds: [EstforConstants.SECRET_EGG_1_TIER1],
    inputAmounts: [1],
    actionId: EstforConstants.INSTANT_VRF_ACTION_SECRET_EGG_1_TIER1,
    data: ethers.utils.defaultAbiCoder.encode(
      ["uint8 version", "tuple(uint16 rewardBasePetIdMin,uint16 rewardBasePetIdMax)"],
      [0, {rewardBasePetIdMin: EstforConstants.OG_MIN_TIER1, rewardBasePetIdMax: EstforConstants.OG_MAX_TIER1}]
    ),
    isFullModeOnly: true,
  },
  {
    actionType: InstantVRFActionType.EGG,
    inputTokenIds: [EstforConstants.SECRET_EGG_1_TIER2],
    inputAmounts: [1],
    actionId: EstforConstants.INSTANT_VRF_ACTION_SECRET_EGG_1_TIER2,
    data: ethers.utils.defaultAbiCoder.encode(
      ["uint8 version", "tuple(uint16 rewardBasePetIdMin,uint16 rewardBasePetIdMax)"],
      [0, {rewardBasePetIdMin: EstforConstants.OG_MIN_TIER2, rewardBasePetIdMax: EstforConstants.OG_MAX_TIER2}]
    ),
    isFullModeOnly: true,
  },
  {
    actionType: InstantVRFActionType.EGG,
    inputTokenIds: [EstforConstants.SECRET_EGG_1_TIER3],
    inputAmounts: [1],
    actionId: EstforConstants.INSTANT_VRF_ACTION_SECRET_EGG_1_TIER3,
    data: ethers.utils.defaultAbiCoder.encode(
      ["uint8 version", "tuple(uint16 rewardBasePetIdMin,uint16 rewardBasePetIdMax)"],
      [0, {rewardBasePetIdMin: EstforConstants.OG_MIN_TIER3, rewardBasePetIdMax: EstforConstants.OG_MAX_TIER3}]
    ),
    isFullModeOnly: true,
  },
  {
    actionType: InstantVRFActionType.EGG,
    inputTokenIds: [EstforConstants.SECRET_EGG_1_TIER4],
    inputAmounts: [1],
    actionId: EstforConstants.INSTANT_VRF_ACTION_SECRET_EGG_1_TIER4,
    data: ethers.utils.defaultAbiCoder.encode(
      ["uint8 version", "tuple(uint16 rewardBasePetIdMin,uint16 rewardBasePetIdMax)"],
      [0, {rewardBasePetIdMin: EstforConstants.OG_MIN_TIER4, rewardBasePetIdMax: EstforConstants.OG_MAX_TIER4}]
    ),
    isFullModeOnly: true,
  },
  {
    actionType: InstantVRFActionType.EGG,
    inputTokenIds: [EstforConstants.SECRET_EGG_1_TIER5],
    inputAmounts: [1],
    actionId: EstforConstants.INSTANT_VRF_ACTION_SECRET_EGG_1_TIER5,
    data: ethers.utils.defaultAbiCoder.encode(
      ["uint8 version", "tuple(uint16 rewardBasePetIdMin,uint16 rewardBasePetIdMax)"],
      [0, {rewardBasePetIdMin: EstforConstants.OG_MIN_TIER5, rewardBasePetIdMax: EstforConstants.OG_MAX_TIER5}]
    ),
    isFullModeOnly: true,
  },
  {
    actionType: InstantVRFActionType.EGG,
    inputTokenIds: [EstforConstants.SECRET_EGG_2_TIER1],
    inputAmounts: [1],
    actionId: EstforConstants.INSTANT_VRF_ACTION_SECRET_EGG_2_TIER1,
    data: ethers.utils.defaultAbiCoder.encode(
      ["uint8 version", "tuple(uint16 rewardBasePetIdMin,uint16 rewardBasePetIdMax)"],
      [0, {rewardBasePetIdMin: EstforConstants.ONEKIN_MIN_TIER1, rewardBasePetIdMax: EstforConstants.ONEKIN_MAX_TIER1}]
    ),
    isFullModeOnly: true,
  },
  {
    actionType: InstantVRFActionType.EGG,
    inputTokenIds: [EstforConstants.SECRET_EGG_2_TIER2],
    inputAmounts: [1],
    actionId: EstforConstants.INSTANT_VRF_ACTION_SECRET_EGG_2_TIER2,
    data: ethers.utils.defaultAbiCoder.encode(
      ["uint8 version", "tuple(uint16 rewardBasePetIdMin,uint16 rewardBasePetIdMax)"],
      [0, {rewardBasePetIdMin: EstforConstants.ONEKIN_MIN_TIER2, rewardBasePetIdMax: EstforConstants.ONEKIN_MAX_TIER2}]
    ),
    isFullModeOnly: true,
  },
  {
    actionType: InstantVRFActionType.EGG,
    inputTokenIds: [EstforConstants.SECRET_EGG_2_TIER3],
    inputAmounts: [1],
    actionId: EstforConstants.INSTANT_VRF_ACTION_SECRET_EGG_2_TIER3,
    data: ethers.utils.defaultAbiCoder.encode(
      ["uint8 version", "tuple(uint16 rewardBasePetIdMin,uint16 rewardBasePetIdMax)"],
      [0, {rewardBasePetIdMin: EstforConstants.ONEKIN_MIN_TIER3, rewardBasePetIdMax: EstforConstants.ONEKIN_MAX_TIER3}]
    ),
    isFullModeOnly: true,
  },
  {
    actionType: InstantVRFActionType.EGG,
    inputTokenIds: [EstforConstants.SECRET_EGG_2_TIER4],
    inputAmounts: [1],
    actionId: EstforConstants.INSTANT_VRF_ACTION_SECRET_EGG_2_TIER4,
    data: ethers.utils.defaultAbiCoder.encode(
      ["uint8 version", "tuple(uint16 rewardBasePetIdMin,uint16 rewardBasePetIdMax)"],
      [0, {rewardBasePetIdMin: EstforConstants.ONEKIN_MIN_TIER4, rewardBasePetIdMax: EstforConstants.ONEKIN_MAX_TIER4}]
    ),
    isFullModeOnly: true,
  },
  {
    actionType: InstantVRFActionType.EGG,
    inputTokenIds: [EstforConstants.SECRET_EGG_2_TIER5],
    inputAmounts: [1],
    actionId: EstforConstants.INSTANT_VRF_ACTION_SECRET_EGG_2_TIER5,
    data: ethers.utils.defaultAbiCoder.encode(
      ["uint8 version", "tuple(uint16 rewardBasePetIdMin,uint16 rewardBasePetIdMax)"],
      [0, {rewardBasePetIdMin: EstforConstants.ONEKIN_MIN_TIER5, rewardBasePetIdMax: EstforConstants.ONEKIN_MAX_TIER5}]
    ),
    isFullModeOnly: true,
  },
  {
    actionType: InstantVRFActionType.EGG,
    inputTokenIds: [EstforConstants.SECRET_EGG_3_TIER1],
    inputAmounts: [1],
    actionId: EstforConstants.INSTANT_VRF_ACTION_SECRET_EGG_3_TIER1,
    data: ethers.utils.defaultAbiCoder.encode(
      ["uint8 version", "tuple(uint16 rewardBasePetIdMin,uint16 rewardBasePetIdMax)"],
      [0, {rewardBasePetIdMin: EstforConstants.FROST_MIN_TIER1, rewardBasePetIdMax: EstforConstants.FROST_MAX_TIER1}]
    ),
    isFullModeOnly: true,
  },
  {
    actionType: InstantVRFActionType.EGG,
    inputTokenIds: [EstforConstants.SECRET_EGG_3_TIER2],
    inputAmounts: [1],
    actionId: EstforConstants.INSTANT_VRF_ACTION_SECRET_EGG_3_TIER2,
    data: ethers.utils.defaultAbiCoder.encode(
      ["uint8 version", "tuple(uint16 rewardBasePetIdMin,uint16 rewardBasePetIdMax)"],
      [0, {rewardBasePetIdMin: EstforConstants.FROST_MIN_TIER2, rewardBasePetIdMax: EstforConstants.FROST_MAX_TIER2}]
    ),
    isFullModeOnly: true,
  },
  {
    actionType: InstantVRFActionType.EGG,
    inputTokenIds: [EstforConstants.SECRET_EGG_3_TIER3],
    inputAmounts: [1],
    actionId: EstforConstants.INSTANT_VRF_ACTION_SECRET_EGG_3_TIER3,
    data: ethers.utils.defaultAbiCoder.encode(
      ["uint8 version", "tuple(uint16 rewardBasePetIdMin,uint16 rewardBasePetIdMax)"],
      [0, {rewardBasePetIdMin: EstforConstants.FROST_MIN_TIER3, rewardBasePetIdMax: EstforConstants.FROST_MAX_TIER3}]
    ),
    isFullModeOnly: true,
  },
  {
    actionType: InstantVRFActionType.EGG,
    inputTokenIds: [EstforConstants.SECRET_EGG_3_TIER4],
    inputAmounts: [1],
    actionId: EstforConstants.INSTANT_VRF_ACTION_SECRET_EGG_3_TIER4,
    data: ethers.utils.defaultAbiCoder.encode(
      ["uint8 version", "tuple(uint16 rewardBasePetIdMin,uint16 rewardBasePetIdMax)"],
      [0, {rewardBasePetIdMin: EstforConstants.FROST_MIN_TIER4, rewardBasePetIdMax: EstforConstants.FROST_MAX_TIER4}]
    ),
    isFullModeOnly: true,
  },
  {
    actionType: InstantVRFActionType.EGG,
    inputTokenIds: [EstforConstants.SECRET_EGG_3_TIER5],
    inputAmounts: [1],
    actionId: EstforConstants.INSTANT_VRF_ACTION_SECRET_EGG_3_TIER5,
    data: ethers.utils.defaultAbiCoder.encode(
      ["uint8 version", "tuple(uint16 rewardBasePetIdMin,uint16 rewardBasePetIdMax)"],
      [0, {rewardBasePetIdMin: EstforConstants.FROST_MIN_TIER5, rewardBasePetIdMax: EstforConstants.FROST_MAX_TIER5}]
    ),
    isFullModeOnly: true,
  },
  {
    actionType: InstantVRFActionType.EGG,
    inputTokenIds: [EstforConstants.SECRET_EGG_4_TIER1],
    inputAmounts: [1],
    actionId: EstforConstants.INSTANT_VRF_ACTION_SECRET_EGG_4_TIER1,
    data: ethers.utils.defaultAbiCoder.encode(
      ["uint8 version", "tuple(uint16 rewardBasePetIdMin,uint16 rewardBasePetIdMax)"],
      [
        0,
        {rewardBasePetIdMin: EstforConstants.CRYSTAL_MIN_TIER1, rewardBasePetIdMax: EstforConstants.CRYSTAL_MAX_TIER1},
      ]
    ),
    isFullModeOnly: true,
  },
  {
    actionType: InstantVRFActionType.EGG,
    inputTokenIds: [EstforConstants.SECRET_EGG_4_TIER2],
    inputAmounts: [1],
    actionId: EstforConstants.INSTANT_VRF_ACTION_SECRET_EGG_4_TIER2,
    data: ethers.utils.defaultAbiCoder.encode(
      ["uint8 version", "tuple(uint16 rewardBasePetIdMin,uint16 rewardBasePetIdMax)"],
      [
        0,
        {rewardBasePetIdMin: EstforConstants.CRYSTAL_MIN_TIER2, rewardBasePetIdMax: EstforConstants.CRYSTAL_MAX_TIER2},
      ]
    ),
    isFullModeOnly: true,
  },
  {
    actionType: InstantVRFActionType.EGG,
    inputTokenIds: [EstforConstants.SECRET_EGG_4_TIER3],
    inputAmounts: [1],
    actionId: EstforConstants.INSTANT_VRF_ACTION_SECRET_EGG_4_TIER3,
    data: ethers.utils.defaultAbiCoder.encode(
      ["uint8 version", "tuple(uint16 rewardBasePetIdMin,uint16 rewardBasePetIdMax)"],
      [
        0,
        {rewardBasePetIdMin: EstforConstants.CRYSTAL_MIN_TIER3, rewardBasePetIdMax: EstforConstants.CRYSTAL_MAX_TIER3},
      ]
    ),
    isFullModeOnly: true,
  },
  {
    actionType: InstantVRFActionType.EGG,
    inputTokenIds: [EstforConstants.SECRET_EGG_4_TIER4],
    inputAmounts: [1],
    actionId: EstforConstants.INSTANT_VRF_ACTION_SECRET_EGG_4_TIER4,
    data: ethers.utils.defaultAbiCoder.encode(
      ["uint8 version", "tuple(uint16 rewardBasePetIdMin,uint16 rewardBasePetIdMax)"],
      [
        0,
        {rewardBasePetIdMin: EstforConstants.CRYSTAL_MIN_TIER4, rewardBasePetIdMax: EstforConstants.CRYSTAL_MAX_TIER4},
      ]
    ),
    isFullModeOnly: true,
  },
  {
    actionType: InstantVRFActionType.EGG,
    inputTokenIds: [EstforConstants.SECRET_EGG_4_TIER5],
    inputAmounts: [1],
    actionId: EstforConstants.INSTANT_VRF_ACTION_SECRET_EGG_4_TIER5,
    data: ethers.utils.defaultAbiCoder.encode(
      ["uint8 version", "tuple(uint16 rewardBasePetIdMin,uint16 rewardBasePetIdMax)"],
      [
        0,
        {rewardBasePetIdMin: EstforConstants.CRYSTAL_MIN_TIER5, rewardBasePetIdMax: EstforConstants.CRYSTAL_MAX_TIER5},
      ]
    ),
    isFullModeOnly: true,
  },
];
