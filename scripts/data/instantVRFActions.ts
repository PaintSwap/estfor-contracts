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
    actionId: EstforConstants.INSTANT_VRF_ACTION_THIEVING_FISHING_CHEST_1,
    inputTokenIds: [EstforConstants.FISHING_CHEST_1, EstforConstants.AQUA_KEY],
    inputAmounts: [1, 1],
    data: ethers.utils.defaultAbiCoder.encode(
      ["uint8 version", "tuple(uint16 itemTokenId,uint16 chance,uint16 amount)[]"],
      [
        0,
        [
          {itemTokenId: EstforConstants.RAW_BLEKK, chance: 65535, amount: 30},
          {itemTokenId: EstforConstants.RAW_SKRIMP, chance: 51773, amount: 30},
          {itemTokenId: EstforConstants.RAW_FEOLA, chance: 38010, amount: 25},
          {itemTokenId: EstforConstants.AQUA_SCROLL, chance: 24248, amount: 25},
          {itemTokenId: EstforConstants.IRON_ARROW, chance: 13107, amount: 50},
          {itemTokenId: EstforConstants.LOSSUTH_SCALE, chance: 1966, amount: 1},
          {itemTokenId: EstforConstants.COIN, chance: 1311, amount: 1},
          {itemTokenId: EstforConstants.PANGSTEN_RING, chance: 655, amount: 1},
          {itemTokenId: EstforConstants.INFUSED_ORICHALCUM_HELMET_FRAGMENT, chance: 328, amount: 1},
        ],
      ]
    ),
    isFullModeOnly: true,
    actionType: InstantVRFActionType.GENERIC,
  },
  {
    actionId: EstforConstants.INSTANT_VRF_ACTION_THIEVING_FISHING_CHEST_2,
    inputTokenIds: [EstforConstants.FISHING_CHEST_2, EstforConstants.AQUA_KEY],
    inputAmounts: [1, 1],
    data: ethers.utils.defaultAbiCoder.encode(
      ["uint8 version", "tuple(uint16 itemTokenId,uint16 chance,uint16 amount)[]"],
      [
        0,
        [
          {itemTokenId: EstforConstants.RAW_ROJJA, chance: 65535, amount: 15},
          {itemTokenId: EstforConstants.RAW_TROUT, chance: 51773, amount: 18},
          {itemTokenId: EstforConstants.RAW_ANCHO, chance: 38666, amount: 23},
          {itemTokenId: EstforConstants.AQUA_SCROLL, chance: 25559, amount: 25},
          {itemTokenId: EstforConstants.MITHRIL_ARROW, chance: 13762, amount: 50},
          {itemTokenId: EstforConstants.COIN, chance: 1966, amount: 1},
          {itemTokenId: EstforConstants.LOSSUTH_SCALE, chance: 1311, amount: 1},
          {itemTokenId: EstforConstants.PANGSTEN_RING, chance: 655, amount: 1},
          {itemTokenId: EstforConstants.INFUSED_ORICHALCUM_HELMET_FRAGMENT, chance: 328, amount: 1},
        ],
      ]
    ),
    isFullModeOnly: true,
    actionType: InstantVRFActionType.GENERIC,
  },
  {
    actionId: EstforConstants.INSTANT_VRF_ACTION_THIEVING_FISHING_CHEST_3,
    inputTokenIds: [EstforConstants.FISHING_CHEST_3, EstforConstants.AQUA_KEY],
    inputAmounts: [1, 1],
    data: ethers.utils.defaultAbiCoder.encode(
      ["uint8 version", "tuple(uint16 itemTokenId,uint16 chance,uint16 amount)[]"],
      [
        0,
        [
          {itemTokenId: EstforConstants.RAW_GOLDFISH, chance: 65535, amount: 11},
          {itemTokenId: EstforConstants.RAW_MYSTY_BLUE, chance: 52428, amount: 12},
          {itemTokenId: EstforConstants.RAW_BOWFISH, chance: 39321, amount: 12},
          {itemTokenId: EstforConstants.AQUA_SCROLL, chance: 26214, amount: 25},
          {itemTokenId: EstforConstants.ADAMANTINE_ARROW, chance: 16384, amount: 50},
          {itemTokenId: EstforConstants.INFUSED_ORICHALCUM_HELMET_FRAGMENT, chance: 6554, amount: 1},
          {itemTokenId: EstforConstants.LOSSUTH_SCALE, chance: 3277, amount: 1},
          {itemTokenId: EstforConstants.COIN, chance: 1966, amount: 1},
          {itemTokenId: EstforConstants.PANGSTEN_RING, chance: 721, amount: 1},
          {itemTokenId: EstforConstants.CANVITE_RING, chance: 66, amount: 1},
        ],
      ]
    ),
    isFullModeOnly: true,
    actionType: InstantVRFActionType.GENERIC,
  },
  {
    actionId: EstforConstants.INSTANT_VRF_ACTION_THIEVING_FISHING_CHEST_4,
    inputTokenIds: [EstforConstants.FISHING_CHEST_4, EstforConstants.AQUA_KEY],
    inputAmounts: [1, 1],
    data: ethers.utils.defaultAbiCoder.encode(
      ["uint8 version", "tuple(uint16 itemTokenId,uint16 chance,uint16 amount)[]"],
      [
        0,
        [
          {itemTokenId: EstforConstants.RAW_AZACUDDA, chance: 65535, amount: 12},
          {itemTokenId: EstforConstants.RAW_ROXA, chance: 53083, amount: 12},
          {itemTokenId: EstforConstants.RAW_QUAFFER, chance: 40632, amount: 12},
          {itemTokenId: EstforConstants.AQUA_SCROLL, chance: 28180, amount: 50},
          {itemTokenId: EstforConstants.RUNITE_ARROW, chance: 18350, amount: 50},
          {itemTokenId: EstforConstants.INFUSED_MASTER_BOOTS_FRAGMENT, chance: 8520, amount: 1},
          {itemTokenId: EstforConstants.INFUSED_ORICHALCUM_SWORD_FRAGMENT, chance: 5243, amount: 1},
          {itemTokenId: EstforConstants.COIN, chance: 1966, amount: 1},
          {itemTokenId: EstforConstants.CANVITE_RING, chance: 131, amount: 1},
          {itemTokenId: EstforConstants.ETCHED_RING, chance: 66, amount: 1},
        ],
      ]
    ),
    isFullModeOnly: true,
    actionType: InstantVRFActionType.GENERIC,
  },
  {
    actionId: EstforConstants.INSTANT_VRF_ACTION_THIEVING_FISHING_CHEST_5,
    inputTokenIds: [EstforConstants.FISHING_CHEST_5, EstforConstants.AQUA_KEY],
    inputAmounts: [1, 1],
    data: ethers.utils.defaultAbiCoder.encode(
      ["uint8 version", "tuple(uint16 itemTokenId,uint16 chance,uint16 amount)[]"],
      [
        0,
        [
          {itemTokenId: EstforConstants.RAW_CHODFISH, chance: 65535, amount: 9},
          {itemTokenId: EstforConstants.RAW_CRUSKAN, chance: 53083, amount: 11},
          {itemTokenId: EstforConstants.RAW_STONECLAW, chance: 40632, amount: 11},
          {itemTokenId: EstforConstants.AQUA_SCROLL, chance: 28180, amount: 50},
          {itemTokenId: EstforConstants.TITANIUM_ARROW, chance: 18350, amount: 50},
          {itemTokenId: EstforConstants.INFUSED_SCORCHING_BOOTS_FRAGMENT, chance: 8520, amount: 1},
          {itemTokenId: EstforConstants.INFUSED_ORICHALCUM_TASSETS_FRAGMENT, chance: 5243, amount: 1},
          {itemTokenId: EstforConstants.COIN, chance: 1966, amount: 1},
          {itemTokenId: EstforConstants.CANVITE_RING, chance: 459, amount: 1},
          {itemTokenId: EstforConstants.ETCHED_RING, chance: 131, amount: 1},
        ],
      ]
    ),
    isFullModeOnly: true,
    actionType: InstantVRFActionType.GENERIC,
  },
  {
    actionId: EstforConstants.INSTANT_VRF_ACTION_THIEVING_WOODCUTTING_CHEST_1,
    inputTokenIds: [EstforConstants.WOODCUTTING_CHEST_1, EstforConstants.NATURE_KEY],
    inputAmounts: [1, 1],
    data: ethers.utils.defaultAbiCoder.encode(
      ["uint8 version", "tuple(uint16 itemTokenId,uint16 chance,uint16 amount)[]"],
      [
        0,
        [
          {itemTokenId: EstforConstants.LOG, chance: 65535, amount: 40},
          {itemTokenId: EstforConstants.OAK_LOG, chance: 45875, amount: 25},
          {itemTokenId: EstforConstants.SHADOW_SCROLL, chance: 26214, amount: 25},
          {itemTokenId: EstforConstants.IRON_ARROW, chance: 14418, amount: 50},
          {itemTokenId: EstforConstants.COIN, chance: 2621, amount: 1},
          {itemTokenId: EstforConstants.ENCHANTED_ACORN, chance: 1311, amount: 1},
          {itemTokenId: EstforConstants.PANGSTEN_RING, chance: 655, amount: 1},
          {itemTokenId: EstforConstants.INFUSED_MASTER_BODY_FRAGMENT, chance: 328, amount: 1},
        ],
      ]
    ),
    isFullModeOnly: true,
    actionType: InstantVRFActionType.GENERIC,
  },
  {
    actionId: EstforConstants.INSTANT_VRF_ACTION_THIEVING_WOODCUTTING_CHEST_2,
    inputTokenIds: [EstforConstants.WOODCUTTING_CHEST_2, EstforConstants.NATURE_KEY],
    inputAmounts: [1, 1],
    data: ethers.utils.defaultAbiCoder.encode(
      ["uint8 version", "tuple(uint16 itemTokenId,uint16 chance,uint16 amount)[]"],
      [
        0,
        [
          {itemTokenId: EstforConstants.LOG, chance: 65535, amount: 40},
          {itemTokenId: EstforConstants.OAK_LOG, chance: 52428, amount: 25},
          {itemTokenId: EstforConstants.WILLOW_LOG, chance: 39321, amount: 23},
          {itemTokenId: EstforConstants.NATURE_SCROLL, chance: 26214, amount: 25},
          {itemTokenId: EstforConstants.MITHRIL_ARROW, chance: 14418, amount: 50},
          {itemTokenId: EstforConstants.COIN, chance: 2621, amount: 1},
          {itemTokenId: EstforConstants.ENCHANTED_ACORN, chance: 1311, amount: 1},
          {itemTokenId: EstforConstants.PANGSTEN_RING, chance: 655, amount: 1},
          {itemTokenId: EstforConstants.INFUSED_MASTER_BODY_FRAGMENT, chance: 328, amount: 1},
        ],
      ]
    ),
    isFullModeOnly: true,
    actionType: InstantVRFActionType.GENERIC,
  },
  {
    actionId: EstforConstants.INSTANT_VRF_ACTION_THIEVING_WOODCUTTING_CHEST_3,
    inputTokenIds: [EstforConstants.WOODCUTTING_CHEST_3, EstforConstants.NATURE_KEY],
    inputAmounts: [1, 1],
    data: ethers.utils.defaultAbiCoder.encode(
      ["uint8 version", "tuple(uint16 itemTokenId,uint16 chance,uint16 amount)[]"],
      [
        0,
        [
          {itemTokenId: EstforConstants.OAK_LOG, chance: 65535, amount: 40},
          {itemTokenId: EstforConstants.WILLOW_LOG, chance: 52428, amount: 23},
          {itemTokenId: EstforConstants.MAPLE_LOG, chance: 39321, amount: 20},
          {itemTokenId: EstforConstants.HELL_SCROLL, chance: 26214, amount: 25},
          {itemTokenId: EstforConstants.ADAMANTINE_ARROW, chance: 16384, amount: 50},
          {itemTokenId: EstforConstants.INFUSED_MASTER_BODY_FRAGMENT, chance: 6554, amount: 1},
          {itemTokenId: EstforConstants.ENCHANTED_ACORN, chance: 3277, amount: 1},
          {itemTokenId: EstforConstants.COIN, chance: 1966, amount: 1},
          {itemTokenId: EstforConstants.PANGSTEN_RING, chance: 721, amount: 1},
          {itemTokenId: EstforConstants.CANVITE_RING, chance: 66, amount: 1},
        ],
      ]
    ),
    isFullModeOnly: true,
    actionType: InstantVRFActionType.GENERIC,
  },
  {
    actionId: EstforConstants.INSTANT_VRF_ACTION_THIEVING_WOODCUTTING_CHEST_4,
    inputTokenIds: [EstforConstants.WOODCUTTING_CHEST_4, EstforConstants.NATURE_KEY],
    inputAmounts: [1, 1],
    data: ethers.utils.defaultAbiCoder.encode(
      ["uint8 version", "tuple(uint16 itemTokenId,uint16 chance,uint16 amount)[]"],
      [
        0,
        [
          {itemTokenId: EstforConstants.MAPLE_LOG, chance: 65535, amount: 20},
          {itemTokenId: EstforConstants.REDWOOD_LOG, chance: 53083, amount: 19},
          {itemTokenId: EstforConstants.MAGICAL_LOG, chance: 40632, amount: 18},
          {itemTokenId: EstforConstants.AIR_SCROLL, chance: 28180, amount: 25},
          {itemTokenId: EstforConstants.RUNITE_ARROW, chance: 18350, amount: 50},
          {itemTokenId: EstforConstants.INFUSED_SCORCHING_BODY_FRAGMENT, chance: 8520, amount: 1},
          {itemTokenId: EstforConstants.INFUSED_MASTER_TROUSERS_FRAGMENT, chance: 5243, amount: 1},
          {itemTokenId: EstforConstants.COIN, chance: 1966, amount: 1},
          {itemTokenId: EstforConstants.CANVITE_RING, chance: 131, amount: 1},
          {itemTokenId: EstforConstants.PRIMDIAT_RING, chance: 66, amount: 1},
        ],
      ]
    ),
    isFullModeOnly: true,
    actionType: InstantVRFActionType.GENERIC,
  },
  {
    actionId: EstforConstants.INSTANT_VRF_ACTION_THIEVING_WOODCUTTING_CHEST_5,
    inputTokenIds: [EstforConstants.WOODCUTTING_CHEST_5, EstforConstants.NATURE_KEY],
    inputAmounts: [1, 1],
    data: ethers.utils.defaultAbiCoder.encode(
      ["uint8 version", "tuple(uint16 itemTokenId,uint16 chance,uint16 amount)[]"],
      [
        0,
        [
          {itemTokenId: EstforConstants.REDWOOD_LOG, chance: 65535, amount: 19},
          {itemTokenId: EstforConstants.MAGICAL_LOG, chance: 53083, amount: 18},
          {itemTokenId: EstforConstants.ASH_LOG, chance: 40632, amount: 15},
          {itemTokenId: EstforConstants.BARRAGE_SCROLL, chance: 28180, amount: 25},
          {itemTokenId: EstforConstants.TITANIUM_ARROW, chance: 18350, amount: 50},
          {itemTokenId: EstforConstants.INFUSED_MASTER_HAT_FRAGMENT, chance: 8520, amount: 1},
          {itemTokenId: EstforConstants.INFUSED_ORICHALCUM_GAUNTLETS_FRAGMENT, chance: 5243, amount: 1},
          {itemTokenId: EstforConstants.COIN, chance: 1966, amount: 3},
          {itemTokenId: EstforConstants.CANVITE_RING, chance: 459, amount: 1},
          {itemTokenId: EstforConstants.PRIMDIAT_RING, chance: 131, amount: 1},
        ],
      ]
    ),
    isFullModeOnly: true,
    actionType: InstantVRFActionType.GENERIC,
  },
  {
    actionId: EstforConstants.INSTANT_VRF_ACTION_THIEVING_MINING_CHEST_1,
    inputTokenIds: [EstforConstants.MINING_CHEST_1, EstforConstants.NATURE_KEY],
    inputAmounts: [1, 1],
    data: ethers.utils.defaultAbiCoder.encode(
      ["uint8 version", "tuple(uint16 itemTokenId,uint16 chance,uint16 amount)[]"],
      [
        0,
        [
          {itemTokenId: EstforConstants.IRON_ORE, chance: 65535, amount: 26},
          {itemTokenId: EstforConstants.COPPER_ORE, chance: 51773, amount: 40},
          {itemTokenId: EstforConstants.TIN_ORE, chance: 38666, amount: 40},
          {itemTokenId: EstforConstants.SHADOW_SCROLL, chance: 25559, amount: 25},
          {itemTokenId: EstforConstants.IRON_ARROW, chance: 13762, amount: 50},
          {itemTokenId: EstforConstants.COIN, chance: 1966, amount: 1},
          {itemTokenId: EstforConstants.BAT_WING, chance: 1311, amount: 1},
          {itemTokenId: EstforConstants.PANGSTEN_RING, chance: 655, amount: 1},
          {itemTokenId: EstforConstants.INFUSED_ORICHALCUM_ARMOR_FRAGMENT, chance: 328, amount: 1},
        ],
      ]
    ),
    isFullModeOnly: true,
    actionType: InstantVRFActionType.GENERIC,
  },
  {
    actionId: EstforConstants.INSTANT_VRF_ACTION_THIEVING_MINING_CHEST_2,
    inputTokenIds: [EstforConstants.MINING_CHEST_2, EstforConstants.NATURE_KEY],
    inputAmounts: [1, 1],
    data: ethers.utils.defaultAbiCoder.encode(
      ["uint8 version", "tuple(uint16 itemTokenId,uint16 chance,uint16 amount)[]"],
      [
        0,
        [
          {itemTokenId: EstforConstants.MITHRIL_ORE, chance: 65535, amount: 23},
          {itemTokenId: EstforConstants.EMERALD, chance: 51773, amount: 11},
          {itemTokenId: EstforConstants.COAL_ORE, chance: 38666, amount: 22},
          {itemTokenId: EstforConstants.NATURE_SCROLL, chance: 25559, amount: 25},
          {itemTokenId: EstforConstants.MITHRIL_ARROW, chance: 13762, amount: 50},
          {itemTokenId: EstforConstants.COIN, chance: 1966, amount: 1},
          {itemTokenId: EstforConstants.BAT_WING, chance: 1311, amount: 1},
          {itemTokenId: EstforConstants.PANGSTEN_RING, chance: 655, amount: 1},
          {itemTokenId: EstforConstants.INFUSED_ORICHALCUM_ARMOR_FRAGMENT, chance: 328, amount: 1},
        ],
      ]
    ),
    isFullModeOnly: true,
    actionType: InstantVRFActionType.GENERIC,
  },
  {
    actionId: EstforConstants.INSTANT_VRF_ACTION_THIEVING_MINING_CHEST_3,
    inputTokenIds: [EstforConstants.MINING_CHEST_3, EstforConstants.NATURE_KEY],
    inputAmounts: [1, 1],
    data: ethers.utils.defaultAbiCoder.encode(
      ["uint8 version", "tuple(uint16 itemTokenId,uint16 chance,uint16 amount)[]"],
      [
        0,
        [
          {itemTokenId: EstforConstants.ADAMANTINE_ORE, chance: 65535, amount: 19},
          {itemTokenId: EstforConstants.RUBY, chance: 52428, amount: 10},
          {itemTokenId: EstforConstants.COAL_ORE, chance: 39321, amount: 24},
          {itemTokenId: EstforConstants.HELL_SCROLL, chance: 26214, amount: 25},
          {itemTokenId: EstforConstants.ADAMANTINE_ARROW, chance: 16384, amount: 50},
          {itemTokenId: EstforConstants.INFUSED_ORICHALCUM_ARMOR_FRAGMENT, chance: 6554, amount: 1},
          {itemTokenId: EstforConstants.BAT_WING, chance: 3277, amount: 1},
          {itemTokenId: EstforConstants.COIN, chance: 1966, amount: 1},
          {itemTokenId: EstforConstants.PANGSTEN_RING, chance: 721, amount: 1},
          {itemTokenId: EstforConstants.CANVITE_RING, chance: 66, amount: 1},
        ],
      ]
    ),
    isFullModeOnly: true,
    actionType: InstantVRFActionType.GENERIC,
  },
  {
    actionId: EstforConstants.INSTANT_VRF_ACTION_THIEVING_MINING_CHEST_4,
    inputTokenIds: [EstforConstants.MINING_CHEST_4, EstforConstants.NATURE_KEY],
    inputAmounts: [1, 1],
    data: ethers.utils.defaultAbiCoder.encode(
      ["uint8 version", "tuple(uint16 itemTokenId,uint16 chance,uint16 amount)[]"],
      [
        0,
        [
          {itemTokenId: EstforConstants.RUNITE_ORE, chance: 65535, amount: 18},
          {itemTokenId: EstforConstants.DIAMOND, chance: 53083, amount: 8},
          {itemTokenId: EstforConstants.COAL_ORE, chance: 40632, amount: 26},
          {itemTokenId: EstforConstants.AIR_SCROLL, chance: 28180, amount: 25},
          {itemTokenId: EstforConstants.RUNITE_ARROW, chance: 18350, amount: 50},
          {itemTokenId: EstforConstants.INFUSED_SCORCHING_COWL_FRAGMENT, chance: 8520, amount: 1},
          {itemTokenId: EstforConstants.INFUSED_SCORCHING_CHAPS_FRAGMENT, chance: 5243, amount: 1},
          {itemTokenId: EstforConstants.COIN, chance: 1966, amount: 1},
          {itemTokenId: EstforConstants.CANVITE_RING, chance: 131, amount: 1},
          {itemTokenId: EstforConstants.OCULITE_RING, chance: 66, amount: 1},
        ],
      ]
    ),
    isFullModeOnly: true,
    actionType: InstantVRFActionType.GENERIC,
  },
  {
    actionId: EstforConstants.INSTANT_VRF_ACTION_THIEVING_MINING_CHEST_5,
    inputTokenIds: [EstforConstants.MINING_CHEST_5, EstforConstants.NATURE_KEY],
    inputAmounts: [1, 1],
    data: ethers.utils.defaultAbiCoder.encode(
      ["uint8 version", "tuple(uint16 itemTokenId,uint16 chance,uint16 amount)[]"],
      [
        0,
        [
          {itemTokenId: EstforConstants.TITANIUM_ORE, chance: 65535, amount: 15},
          {itemTokenId: EstforConstants.DRAGONSTONE, chance: 53083, amount: 5},
          {itemTokenId: EstforConstants.COAL_ORE, chance: 40632, amount: 28},
          {itemTokenId: EstforConstants.BARRAGE_SCROLL, chance: 28180, amount: 25},
          {itemTokenId: EstforConstants.TITANIUM_ARROW, chance: 18350, amount: 50},
          {itemTokenId: EstforConstants.INFUSED_MASTER_BRACERS_FRAGMENT, chance: 8520, amount: 1},
          {itemTokenId: EstforConstants.INFUSED_SCORCHING_BRACERS_FRAGMENT, chance: 5243, amount: 1},
          {itemTokenId: EstforConstants.COIN, chance: 1966, amount: 1},
          {itemTokenId: EstforConstants.CANVITE_RING, chance: 459, amount: 1},
          {itemTokenId: EstforConstants.OCULITE_RING, chance: 131, amount: 1},
        ],
      ]
    ),
    isFullModeOnly: true,
    actionType: InstantVRFActionType.GENERIC,
  },
  {
    actionId: EstforConstants.INSTANT_VRF_ACTION_THIEVING_DRAGON_CHEST,
    inputTokenIds: [EstforConstants.DRAGON_CHEST, EstforConstants.DRAGON_KEY],
    inputAmounts: [1, 1],
    data: ethers.utils.defaultAbiCoder.encode(
      ["uint8 version", "tuple(uint16 itemTokenId,uint16 chance,uint16 amount)[]"],
      [
        0,
        [
          {itemTokenId: EstforConstants.DRAGONSTONE_STAFF_FRAGMENT, chance: 65535, amount: 1},
          {itemTokenId: EstforConstants.INFUSED_DRAGONSTONE_AMULET_FRAGMENT, chance: 57015, amount: 1},
          {itemTokenId: EstforConstants.INFUSED_ORICHALCUM_SHIELD_FRAGMENT, chance: 48496, amount: 1},
          {itemTokenId: EstforConstants.INFUSED_SCORCHING_COWL_FRAGMENT, chance: 39976, amount: 1},
          {itemTokenId: EstforConstants.INFUSED_MASTER_TROUSERS_FRAGMENT, chance: 31457, amount: 1},
          {itemTokenId: EstforConstants.INFUSED_MASTER_BOOTS_FRAGMENT, chance: 22937, amount: 1},
          {itemTokenId: EstforConstants.INFUSED_ORICHALCUM_SWORD_FRAGMENT, chance: 14418, amount: 1},
          {itemTokenId: EstforConstants.DRAGON_SCALE, chance: 5898, amount: 1},
          {itemTokenId: EstforConstants.COIN, chance: 2621, amount: 1},
          {itemTokenId: EstforConstants.NOVIAN_RING, chance: 66, amount: 1},
        ],
      ]
    ),
    isFullModeOnly: true,
    actionType: InstantVRFActionType.GENERIC,
  },
  {
    actionId: EstforConstants.INSTANT_VRF_ACTION_THIEVING_BONE_CHEST,
    inputTokenIds: [EstforConstants.BONE_CHEST, EstforConstants.BONE_KEY],
    inputAmounts: [1, 1],
    data: ethers.utils.defaultAbiCoder.encode(
      ["uint8 version", "tuple(uint16 itemTokenId,uint16 chance,uint16 amount)[]"],
      [
        0,
        [
          {itemTokenId: EstforConstants.GODLY_BOW_FRAGMENT, chance: 65535, amount: 1},
          {itemTokenId: EstforConstants.DRAGONSTONE_STAFF_FRAGMENT, chance: 57015, amount: 1},
          {itemTokenId: EstforConstants.INFUSED_ORICHALCUM_SWORD_FRAGMENT, chance: 48496, amount: 1},
          {itemTokenId: EstforConstants.INFUSED_MASTER_BRACERS_FRAGMENT, chance: 39976, amount: 1},
          {itemTokenId: EstforConstants.INFUSED_SCORCHING_BOOTS_FRAGMENT, chance: 31457, amount: 1},
          {itemTokenId: EstforConstants.INFUSED_SCORCHING_BRACERS_FRAGMENT, chance: 22937, amount: 1},
          {itemTokenId: EstforConstants.INFUSED_ORICHALCUM_BOOTS_FRAGMENT, chance: 14418, amount: 1},
          {itemTokenId: EstforConstants.VENOM_POUCH, chance: 5898, amount: 1},
          {itemTokenId: EstforConstants.COIN, chance: 2621, amount: 1},
          {itemTokenId: EstforConstants.NOVIAN_RING, chance: 66, amount: 1},
        ],
      ]
    ),
    isFullModeOnly: true,
    actionType: InstantVRFActionType.GENERIC,
  },
  {
    actionId: EstforConstants.INSTANT_VRF_ACTION_THIEVING_ANNIV1_CHEST,
    inputTokenIds: [EstforConstants.ANNIV1_CHEST, EstforConstants.ANNIV1_KEY],
    inputAmounts: [1, 1],
    data: ethers.utils.defaultAbiCoder.encode(
      ["uint8 version", "tuple(uint16 itemTokenId,uint16 chance,uint16 amount)[]"],
      [
        0,
        [
          {itemTokenId: EstforConstants.XP_BOOST, chance: 65535, amount: 1},
          {itemTokenId: EstforConstants.GATHERING_BOOST, chance: 52428, amount: 1},
          {itemTokenId: EstforConstants.COMBAT_BOOST, chance: 42598, amount: 1},
          {itemTokenId: EstforConstants.SKILL_BOOST, chance: 32768, amount: 1},
          {itemTokenId: EstforConstants.XP_BOOST, chance: 22937, amount: 2},
          {itemTokenId: EstforConstants.GATHERING_BOOST, chance: 16384, amount: 2},
          {itemTokenId: EstforConstants.ANNIV1_RING, chance: 9830, amount: 1},
          {itemTokenId: EstforConstants.ANNIV1_EGG_TIER1, chance: 6554, amount: 1},
          {itemTokenId: EstforConstants.ANNIV1_EGG_TIER2, chance: 3277, amount: 1},
          {itemTokenId: EstforConstants.ANNIV1_EGG_TIER3, chance: 1311, amount: 1},
        ],
      ]
    ),
    isFullModeOnly: true,
    actionType: InstantVRFActionType.GENERIC,
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
  {
    actionType: InstantVRFActionType.EGG,
    inputTokenIds: [EstforConstants.ANNIV1_EGG_TIER1],
    inputAmounts: [1],
    actionId: EstforConstants.INSTANT_VRF_ACTION_ANNIV1_EGG_TIER1,
    data: ethers.utils.defaultAbiCoder.encode(
      ["uint8 version", "tuple(uint16 rewardBasePetIdMin,uint16 rewardBasePetIdMax)"],
      [0, {rewardBasePetIdMin: EstforConstants.ANNIV1_MIN_TIER1, rewardBasePetIdMax: EstforConstants.ANNIV1_MAX_TIER1}]
    ),
    isFullModeOnly: true,
  },
  {
    actionType: InstantVRFActionType.EGG,
    inputTokenIds: [EstforConstants.ANNIV1_EGG_TIER2],
    inputAmounts: [1],
    actionId: EstforConstants.INSTANT_VRF_ACTION_ANNIV1_EGG_TIER2,
    data: ethers.utils.defaultAbiCoder.encode(
      ["uint8 version", "tuple(uint16 rewardBasePetIdMin,uint16 rewardBasePetIdMax)"],
      [0, {rewardBasePetIdMin: EstforConstants.ANNIV1_MIN_TIER2, rewardBasePetIdMax: EstforConstants.ANNIV1_MAX_TIER2}]
    ),
    isFullModeOnly: true,
  },
  {
    actionType: InstantVRFActionType.EGG,
    inputTokenIds: [EstforConstants.ANNIV1_EGG_TIER3],
    inputAmounts: [1],
    actionId: EstforConstants.INSTANT_VRF_ACTION_ANNIV1_EGG_TIER3,
    data: ethers.utils.defaultAbiCoder.encode(
      ["uint8 version", "tuple(uint16 rewardBasePetIdMin,uint16 rewardBasePetIdMax)"],
      [0, {rewardBasePetIdMin: EstforConstants.ANNIV1_MIN_TIER3, rewardBasePetIdMax: EstforConstants.ANNIV1_MAX_TIER3}]
    ),
    isFullModeOnly: true,
  },
  {
    actionType: InstantVRFActionType.EGG,
    inputTokenIds: [EstforConstants.ANNIV1_EGG_TIER4],
    inputAmounts: [1],
    actionId: EstforConstants.INSTANT_VRF_ACTION_ANNIV1_EGG_TIER4,
    data: ethers.utils.defaultAbiCoder.encode(
      ["uint8 version", "tuple(uint16 rewardBasePetIdMin,uint16 rewardBasePetIdMax)"],
      [0, {rewardBasePetIdMin: EstforConstants.ANNIV1_MIN_TIER4, rewardBasePetIdMax: EstforConstants.ANNIV1_MAX_TIER4}]
    ),
    isFullModeOnly: true,
  },
  {
    actionType: InstantVRFActionType.EGG,
    inputTokenIds: [EstforConstants.ANNIV1_EGG_TIER5],
    inputAmounts: [1],
    actionId: EstforConstants.INSTANT_VRF_ACTION_ANNIV1_EGG_TIER5,
    data: ethers.utils.defaultAbiCoder.encode(
      ["uint8 version", "tuple(uint16 rewardBasePetIdMin,uint16 rewardBasePetIdMax)"],
      [0, {rewardBasePetIdMin: EstforConstants.ANNIV1_MIN_TIER5, rewardBasePetIdMax: EstforConstants.ANNIV1_MAX_TIER5}]
    ),
    isFullModeOnly: true,
  },
];
