import {EquipPosition} from "@paintswap/estfor-definitions/types";
import {EstforConstants} from "@paintswap/estfor-definitions";
import {CosmeticInfo} from "../utils";

export const cosmeticTokenIds: number[] = [
  EstforConstants.COSMETIC_001_AVATAR,
  EstforConstants.COSMETIC_002_AVATAR_BORDER,
];

export const cosmeticInfos: CosmeticInfo[] = [
  {
    itemTokenId: EstforConstants.COSMETIC_001_AVATAR,
    cosmeticPosition: EquipPosition.AVATAR,
    avatarId: 9,
  },
  {
    itemTokenId: EstforConstants.COSMETIC_002_AVATAR_BORDER,
    cosmeticPosition: EquipPosition.AVATAR_BORDER,
    avatarId: 0,
  },
];
