import {EstforConstants} from "@paintswap/estfor-definitions";
import {ethers, BigNumber} from "ethers";

export type ShopItem = {
  tokenId: number;
  price: BigNumber;
};

export const allShopItems: ShopItem[] = [
  {
    tokenId: EstforConstants.MAGIC_FIRE_STARTER,
    price: ethers.utils.parseEther("1"),
  },
  {
    tokenId: EstforConstants.BRONZE_SWORD,
    price: ethers.utils.parseEther("1"),
  },
  {
    tokenId: EstforConstants.BASIC_BOW,
    price: ethers.utils.parseEther("1"),
  },
  {
    tokenId: EstforConstants.TOTEM_STAFF,
    price: ethers.utils.parseEther("1"),
  },
  {
    tokenId: EstforConstants.NET_STICK,
    price: ethers.utils.parseEther("1"),
  },
  {
    tokenId: EstforConstants.BRONZE_PICKAXE,
    price: ethers.utils.parseEther("1"),
  },
  {
    tokenId: EstforConstants.BRONZE_AXE,
    price: ethers.utils.parseEther("1"),
  },
  {
    tokenId: EstforConstants.MEDIUM_NET,
    price: ethers.utils.parseEther("40"),
  },
  {
    tokenId: EstforConstants.WOOD_FISHING_ROD,
    price: ethers.utils.parseEther("80"),
  },
  {
    tokenId: EstforConstants.CAGE,
    price: ethers.utils.parseEther("120"),
  },
  {
    tokenId: EstforConstants.LARGE_NET,
    price: ethers.utils.parseEther("240"),
  },
  {
    tokenId: EstforConstants.COMBAT_BOOST,
    price: ethers.utils.parseEther("40"),
  },
  {
    tokenId: EstforConstants.XP_BOOST,
    price: ethers.utils.parseEther("20"),
  },
  {
    tokenId: EstforConstants.GATHERING_BOOST,
    price: ethers.utils.parseEther("20"),
  },
  {
    tokenId: EstforConstants.SKILL_BOOST,
    price: ethers.utils.parseEther("40"),
  },
  {
    tokenId: EstforConstants.FLUX,
    price: ethers.utils.parseEther("5"),
  },
  {
    tokenId: EstforConstants.COOKED_MINNUS,
    price: ethers.utils.parseEther("0.1"),
  },
  {
    tokenId: EstforConstants.PROTECTION_SHIELD,
    price: ethers.utils.parseEther("500"),
  },
  {
    tokenId: EstforConstants.DEVILISH_FINGERS,
    price: ethers.utils.parseEther("250"),
  },
  {
    tokenId: EstforConstants.MIRROR_SHIELD,
    price: ethers.utils.parseEther("250"),
  },
  {
    tokenId: EstforConstants.SHARPENED_CLAW,
    price: ethers.utils.parseEther("250"),
  },
];

export const allShopItemsBeta: ShopItem[] = allShopItems.map((shopItem) => {
  return {
    ...shopItem,
    price: shopItem.price.div(10),
  };
});
