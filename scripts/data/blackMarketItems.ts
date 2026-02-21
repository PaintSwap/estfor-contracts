import {EstforConstants} from "@paintswap/estfor-definitions";
import {parseEther} from "ethers";

export type ShopItem = {
  price: bigint;
  tokenId: number;
  amountPerPurchase: number;
  currentStock: number;
  stock: number;
  isActive: boolean;
};

export const allBlackMarketItems: ShopItem[] = [
  {
    price: 1n,
    tokenId: EstforConstants.XP_BOOST_XL_UNSTABLE,
    amountPerPurchase: 1,
    currentStock: 0,
    stock: 0,
    isActive: false,
  },
  {
    price: 1n,
    tokenId: EstforConstants.GATHERING_BOOST_XL_UNSTABLE,
    amountPerPurchase: 1,
    currentStock: 0,
    stock: 0,
    isActive: false,
  },
  {
    price: 10n,
    tokenId: EstforConstants.RIFT_EGG_TIER1,
    amountPerPurchase: 1,
    currentStock: 0,
    stock: 0,
    isActive: false,
  },
  {
    price: 5n,
    tokenId: EstforConstants.BORDER_002_RIFT,
    amountPerPurchase: 1,
    currentStock: 0,
    stock: 0,
    isActive: false,
  },
  {
    price: 5n,
    tokenId: EstforConstants.ALCHEMY_HAT,
    amountPerPurchase: 1,
    currentStock: 0,
    stock: 0,
    isActive: false,
  },
  {
    price: 5n,
    tokenId: EstforConstants.ALCHEMY_BODY,
    amountPerPurchase: 1,
    currentStock: 0,
    stock: 0,
    isActive: false,
  },
  {
    price: 5n,
    tokenId: EstforConstants.ALCHEMY_TROUSERS,
    amountPerPurchase: 1,
    currentStock: 0,
    stock: 0,
    isActive: false,
  },
  {
    price: 5n,
    tokenId: EstforConstants.ALCHEMY_BOOTS,
    amountPerPurchase: 1,
    currentStock: 0,
    stock: 0,
    isActive: false,
  },
  {
    price: 5n,
    tokenId: EstforConstants.ALCHEMY_BRACERS,
    amountPerPurchase: 1,
    currentStock: 0,
    stock: 0,
    isActive: false,
  },
  {
    price: 1n,
    tokenId: EstforConstants.CHEST_001_PRIMORDIAL,
    amountPerPurchase: 1,
    currentStock: 50,
    stock: 50,
    isActive: false,
  },
  {
    price: 1n,
    tokenId: EstforConstants.CHEST_002_AETHER,
    amountPerPurchase: 1,
    currentStock: 50,
    stock: 50,
    isActive: false,
  },
  {
    price: 1n,
    tokenId: EstforConstants.CHEST_003_ARCANE,
    amountPerPurchase: 1,
    currentStock: 50,
    stock: 50,
    isActive: false,
  },
  {
    price: 1n,
    tokenId: EstforConstants.CHEST_004_ASTRAL,
    amountPerPurchase: 1,
    currentStock: 50,
    stock: 50,
    isActive: false,
  },
  {
    price: 1n,
    tokenId: EstforConstants.CHEST_005_VOID,
    amountPerPurchase: 1,
    currentStock: 50,
    stock: 50,
    isActive: false,
  },
  {
    price: 10n,
    tokenId: EstforConstants.KEY_001_OMNI,
    amountPerPurchase: 10,
    currentStock: 50,
    stock: 50,
    isActive: false,
  },
  {
    price: 1n,
    tokenId: EstforConstants.BLIGHT_VEIN_ORE,
    amountPerPurchase: 10,
    currentStock: 0,
    stock: 0,
    isActive: false,
  },
  {
    price: 1n,
    tokenId: EstforConstants.RIFT_FUEL,
    amountPerPurchase: 10,
    currentStock: 0,
    stock: 0,
    isActive: false,
  },
  {
    price: 1n,
    tokenId: EstforConstants.RAW_CRUSKAN,
    amountPerPurchase: 45 * 10,
    currentStock: 0,
    stock: 0,
    isActive: false,
  },
  {
    price: 1n,
    tokenId: EstforConstants.SEED_004_OBSCURE,
    amountPerPurchase: 5 * 10,
    currentStock: 0,
    stock: 0,
    isActive: false,
  },
];
