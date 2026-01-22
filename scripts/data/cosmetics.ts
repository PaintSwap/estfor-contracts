import {EquipPosition} from "@paintswap/estfor-definitions/types";
import {EstforConstants} from "@paintswap/estfor-definitions";
import {CosmeticInfo} from "../utils";

export const cosmeticTokenIds: number[] = [EstforConstants.AVATAR_001_CHIMP, EstforConstants.BORDER_001_ARCANE_PORTAL];

export const cosmeticInfos: CosmeticInfo[] = [
  {
    itemTokenId: EstforConstants.AVATAR_001_CHIMP,
    cosmeticPosition: EquipPosition.AVATAR,
    avatarId: 9,
  },
  {
    itemTokenId: EstforConstants.BORDER_001_ARCANE_PORTAL,
    cosmeticPosition: EquipPosition.AVATAR_BORDER,
    avatarId: 0,
  },
];
