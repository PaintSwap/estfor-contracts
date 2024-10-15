import {EstforConstants} from "@paintswap/estfor-definitions";
import {parseEther} from "ethers";

export type ShopItem = {
  tokenId: number;
  price: bigint;
};

export const allShopItems: ShopItem[] = [
  {
    tokenId: EstforConstants.MAGIC_FIRE_STARTER,
    price: parseEther("1"),
  },
  {
    tokenId: EstforConstants.BRONZE_SWORD,
    price: parseEther("1"),
  },
  {
    tokenId: EstforConstants.BASIC_BOW,
    price: parseEther("1"),
  },
  {
    tokenId: EstforConstants.TOTEM_STAFF,
    price: parseEther("1"),
  },
  {
    tokenId: EstforConstants.NET_STICK,
    price: parseEther("1"),
  },
  {
    tokenId: EstforConstants.BRONZE_PICKAXE,
    price: parseEther("1"),
  },
  {
    tokenId: EstforConstants.BRONZE_AXE,
    price: parseEther("1"),
  },
  {
    tokenId: EstforConstants.MEDIUM_NET,
    price: parseEther("40"),
  },
  {
    tokenId: EstforConstants.WOOD_FISHING_ROD,
    price: parseEther("80"),
  },
  {
    tokenId: EstforConstants.CAGE,
    price: parseEther("120"),
  },
  {
    tokenId: EstforConstants.LARGE_NET,
    price: parseEther("240"),
  },
  {
    tokenId: EstforConstants.COMBAT_BOOST,
    price: parseEther("40"),
  },
  {
    tokenId: EstforConstants.XP_BOOST,
    price: parseEther("20"),
  },
  {
    tokenId: EstforConstants.GATHERING_BOOST,
    price: parseEther("20"),
  },
  {
    tokenId: EstforConstants.SKILL_BOOST,
    price: parseEther("40"),
  },
  {
    tokenId: EstforConstants.FLUX,
    price: parseEther("5"),
  },
  {
    tokenId: EstforConstants.COOKED_MINNUS,
    price: parseEther("0.1"),
  },
  {
    tokenId: EstforConstants.PROTECTION_SHIELD,
    price: parseEther("500"),
  },
  {
    tokenId: EstforConstants.DEVILISH_FINGERS,
    price: parseEther("250"),
  },
  {
    tokenId: EstforConstants.MIRROR_SHIELD,
    price: parseEther("250"),
  },
  {
    tokenId: EstforConstants.SHARPENED_CLAW,
    price: parseEther("250"),
  },
];

export const allShopItemsBeta: ShopItem[] = allShopItems.map((shopItem) => {
  return {
    ...shopItem,
    price: shopItem.price / 10n,
  };
});
