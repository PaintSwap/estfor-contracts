import {EstforConstants} from "@paintswap/estfor-definitions"
import type {DeploymentProfile} from "../deploymentRegistry"
import {allShopItems, allShopItemsBeta, ShopItem} from "./shopItems"

export interface ShopData {
  buyableItems: ShopItem[]
  unsellableItemIds: number[]
}

const unsellableItemIds = [
  EstforConstants.INFUSED_ORICHALCUM_HELMET,
  EstforConstants.INFUSED_ORICHALCUM_ARMOR,
  EstforConstants.INFUSED_ORICHALCUM_TASSETS,
  EstforConstants.INFUSED_ORICHALCUM_GAUNTLETS,
  EstforConstants.INFUSED_ORICHALCUM_BOOTS,
  EstforConstants.INFUSED_ORICHALCUM_SHIELD,
  EstforConstants.INFUSED_DRAGONSTONE_AMULET,
  EstforConstants.INFUSED_MASTER_HAT,
  EstforConstants.INFUSED_MASTER_BODY,
  EstforConstants.INFUSED_MASTER_TROUSERS,
  EstforConstants.INFUSED_MASTER_BRACERS,
  EstforConstants.INFUSED_MASTER_BOOTS,
  EstforConstants.INFUSED_ORICHALCUM_SWORD,
  EstforConstants.INFUSED_DRAGONSTONE_STAFF,
  EstforConstants.INFUSED_GODLY_BOW,
  EstforConstants.INFUSED_SCORCHING_COWL,
  EstforConstants.INFUSED_SCORCHING_BODY,
  EstforConstants.INFUSED_SCORCHING_CHAPS,
  EstforConstants.INFUSED_SCORCHING_BRACERS,
  EstforConstants.INFUSED_SCORCHING_BOOTS,
  EstforConstants.ANNIV1_CHEST,
  EstforConstants.ANNIV1_RING,
  EstforConstants.ANNIV1_EGG_TIER1,
  EstforConstants.ANNIV1_EGG_TIER2,
  EstforConstants.ANNIV1_EGG_TIER3,
  EstforConstants.ANNIV1_EGG_TIER4,
  EstforConstants.ANNIV1_EGG_TIER5,
  EstforConstants.ANNIV1_KEY,
  EstforConstants.SECRET_EGG_1_TIER1,
  EstforConstants.SECRET_EGG_1_TIER2,
  EstforConstants.SECRET_EGG_1_TIER3,
  EstforConstants.SECRET_EGG_1_TIER4,
  EstforConstants.SECRET_EGG_1_TIER5,
  EstforConstants.SECRET_EGG_2_TIER1,
  EstforConstants.SECRET_EGG_2_TIER2,
  EstforConstants.SECRET_EGG_2_TIER3,
  EstforConstants.SECRET_EGG_2_TIER4,
  EstforConstants.SECRET_EGG_2_TIER5,
  EstforConstants.SECRET_EGG_3_TIER1,
  EstforConstants.SECRET_EGG_3_TIER2,
  EstforConstants.SECRET_EGG_3_TIER3,
  EstforConstants.SECRET_EGG_3_TIER4,
  EstforConstants.SECRET_EGG_3_TIER5,
  EstforConstants.SECRET_EGG_4_TIER1,
  EstforConstants.SECRET_EGG_4_TIER2,
  EstforConstants.SECRET_EGG_4_TIER3,
  EstforConstants.SECRET_EGG_4_TIER4,
  EstforConstants.SECRET_EGG_4_TIER5,
  EstforConstants.KRAGSTYR_EGG_TIER1,
  EstforConstants.KRAGSTYR_EGG_TIER2,
  EstforConstants.KRAGSTYR_EGG_TIER3,
  EstforConstants.KRAGSTYR_EGG_TIER4,
  EstforConstants.KRAGSTYR_EGG_TIER5,
  EstforConstants.KEPHRI_AMULET,
  EstforConstants.RING_OF_TUR,
  EstforConstants.TRICK_CHEST2024,
  EstforConstants.TREAT_CHEST2024,
  EstforConstants.TRICK_OR_TREAT_KEY,
  EstforConstants.BOOK_007_ORICHALCUM_INFUSED,
  EstforConstants.CROSSBOW_007_ORICHALCUM_INFUSED,
  EstforConstants.DAGGER_007_ORICHALCUM_INFUSED,
]

export function getShopData(profile: DeploymentProfile): ShopData {
  return {
    buyableItems: (profile === "beta" ? allShopItemsBeta : allShopItems).map((item) => ({...item})),
    unsellableItemIds: [...unsellableItemIds],
  }
}
