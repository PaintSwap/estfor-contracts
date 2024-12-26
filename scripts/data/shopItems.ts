import {EstforConstants} from "@paintswap/estfor-definitions";
import {parseEther} from "ethers";

export type ShopItem = {
  tokenId: number;
  price: bigint;
};

export const allShopItems: ShopItem[] = [
  {
    tokenId: EstforConstants.MAGIC_FIRE_STARTER,
    price: parseEther("1")
  },
  {
    tokenId: EstforConstants.BRONZE_SWORD,
    price: parseEther("10")
  },
  {
    tokenId: EstforConstants.BASIC_BOW,
    price: parseEther("10")
  },
  {
    tokenId: EstforConstants.TOTEM_STAFF,
    price: parseEther("10")
  },
  {
    tokenId: EstforConstants.NET_STICK,
    price: parseEther("10")
  },
  {
    tokenId: EstforConstants.BRONZE_PICKAXE,
    price: parseEther("10")
  },
  {
    tokenId: EstforConstants.BRONZE_AXE,
    price: parseEther("10")
  },
  {
    tokenId: EstforConstants.MEDIUM_NET,
    price: parseEther("40")
  },
  {
    tokenId: EstforConstants.WOOD_FISHING_ROD,
    price: parseEther("80")
  },
  {
    tokenId: EstforConstants.CAGE,
    price: parseEther("120")
  },
  {
    tokenId: EstforConstants.LARGE_NET,
    price: parseEther("160")
  },
  {
    tokenId: EstforConstants.TITANIUM_FISHING_ROD,
    price: parseEther("200")
  },
  {
    tokenId: EstforConstants.MAGIC_NET,
    price: parseEther("240")
  },
  {
    tokenId: EstforConstants.HARPOON,
    price: parseEther("280")
  },
  {
    tokenId: EstforConstants.COMBAT_BOOST,
    price: parseEther("15")
  },
  {
    tokenId: EstforConstants.XP_BOOST,
    price: parseEther("8")
  },
  {
    tokenId: EstforConstants.GATHERING_BOOST,
    price: parseEther("8")
  },
  {
    tokenId: EstforConstants.SKILL_BOOST,
    price: parseEther("15")
  },
  {
    tokenId: EstforConstants.FLUX,
    price: parseEther("10")
  },
  {
    tokenId: EstforConstants.COOKED_MINNUS,
    price: parseEther("0.1")
  },
  {
    tokenId: EstforConstants.PROTECTION_SHIELD,
    price: parseEther("300")
  },
  {
    tokenId: EstforConstants.DEVILISH_FINGERS,
    price: parseEther("150")
  },
  {
    tokenId: EstforConstants.MIRROR_SHIELD,
    price: parseEther("150")
  },
  {
    tokenId: EstforConstants.SHARPENED_CLAW,
    price: parseEther("150")
  },
  {
    tokenId: EstforConstants.BLUEPRINT_HARVEST_001,
    price: parseEther("50")
  },
  {
    tokenId: EstforConstants.BLUEPRINT_HARVEST_002,
    price: parseEther("100")
  },
  {
    tokenId: EstforConstants.BLUEPRINT_HARVEST_003,
    price: parseEther("150")
  },
  {
    tokenId: EstforConstants.BLUEPRINT_HARVEST_004,
    price: parseEther("150")
  },
  {
    tokenId: EstforConstants.BLUEPRINT_HARVEST_005,
    price: parseEther("150")
  },
  {
    tokenId: EstforConstants.BLUEPRINT_HARVEST_006,
    price: parseEther("150")
  },
  {
    tokenId: EstforConstants.BLUEPRINT_ALCHEMY_001_V1,
    price: parseEther("50")
  },
  {
    tokenId: EstforConstants.BLUEPRINT_ALCHEMY_002_V2,
    price: parseEther("100")
  },
  {
    tokenId: EstforConstants.BLUEPRINT_ALCHEMY_003_V3,
    price: parseEther("150")
  },
  {
    tokenId: EstforConstants.BLUEPRINT_ALCHEMY_004_V4,
    price: parseEther("100")
  },
  {
    tokenId: EstforConstants.POTION_005_SMALL_MELEE,
    price: parseEther("3")
  },
  {
    tokenId: EstforConstants.POTION_007_SMALL_RANGED,
    price: parseEther("3")
  },
  {
    tokenId: EstforConstants.POTION_009_SMALL_MAGIC,
    price: parseEther("3")
  },
  {
    tokenId: EstforConstants.POTION_011_SMALL_DEFENCE,
    price: parseEther("3")
  },
  {
    tokenId: EstforConstants.POTION_013_SMALL_HEALTH,
    price: parseEther("3")
  }
];

export const allShopItemsBeta: ShopItem[] = allShopItems.map((shopItem) => {
  return {
    ...shopItem,
    price: shopItem.price / 10n
  };
});
