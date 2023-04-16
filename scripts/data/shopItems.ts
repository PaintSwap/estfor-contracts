import {EstforConstants} from "@paintswap/estfor-definitions";
import {ethers, BigNumber} from "ethers";

type ShopItem = {
  tokenId: number;
  price: BigNumber;
};

export const allShopItems: ShopItem[] = [
  {
    tokenId: EstforConstants.BRONZE_PICKAXE,
    price: ethers.utils.parseEther("10"),
  },
  {
    tokenId: EstforConstants.BRONZE_AXE,
    price: ethers.utils.parseEther("10"),
  },
  {
    tokenId: EstforConstants.MAGIC_FIRE_STARTER,
    price: ethers.utils.parseEther("1"),
  },
  {
    tokenId: EstforConstants.NET_STICK,
    price: ethers.utils.parseEther("10"),
  },
  {
    tokenId: EstforConstants.MEDIUM_NET,
    price: ethers.utils.parseEther("50"),
  },
  {
    tokenId: EstforConstants.LARGE_NET,
    price: ethers.utils.parseEther("300"),
  },
  {
    tokenId: EstforConstants.WOOD_FISHING_ROD,
    price: ethers.utils.parseEther("100"),
  },
  {
    tokenId: EstforConstants.CAGE,
    price: ethers.utils.parseEther("150"),
  },
  {
    tokenId: EstforConstants.SHADOW_SCROLL,
    price: ethers.utils.parseEther("0.05"),
  },
  {
    tokenId: EstforConstants.NATURE_SCROLL,
    price: ethers.utils.parseEther("0.05"),
  },
  {
    tokenId: EstforConstants.AQUA_SCROLL,
    price: ethers.utils.parseEther("0.10"),
  },
  {
    tokenId: EstforConstants.HELL_SCROLL,
    price: ethers.utils.parseEther("0.10"),
  },
  {
    tokenId: EstforConstants.AIR_SCROLL,
    price: ethers.utils.parseEther("0.25"),
  },
  {
    tokenId: EstforConstants.BARRAGE_SCROLL,
    price: ethers.utils.parseEther("0.5"),
  },
  {
    tokenId: EstforConstants.FREEZE_SCROLL,
    price: ethers.utils.parseEther("0.5"),
  },
  {
    tokenId: EstforConstants.COMBAT_BOOST,
    price: ethers.utils.parseEther("200"),
  },
  {
    tokenId: EstforConstants.XP_BOOST,
    price: ethers.utils.parseEther("100"),
  },
  {
    tokenId: EstforConstants.GATHERING_BOOST,
    price: ethers.utils.parseEther("100"),
  },
  {
    tokenId: EstforConstants.SKILL_BOOST,
    price: ethers.utils.parseEther("200"),
  },
  {
    tokenId: EstforConstants.COOKED_MINNUS,
    price: ethers.utils.parseEther("0.1"),
  },
];
