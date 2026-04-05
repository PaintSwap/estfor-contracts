import {EquipPosition} from "@paintswap/estfor-definitions/types";
import {EstforConstants} from "@paintswap/estfor-definitions";
import {CosmeticInfo} from "../utils";

export const cosmeticTokenIds: number[] = [
  EstforConstants.AVATAR_001_CHIMP,
  EstforConstants.BORDER_001_ARCANE_PORTAL,
  EstforConstants.BORDER_002_RIFT,
  EstforConstants.TITLE_WQ1_TOP5,
  EstforConstants.TITLE_WQ1_TOP50,
  EstforConstants.TITLE_WQ1_ALL,
];

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
  {
    itemTokenId: EstforConstants.BORDER_002_RIFT,
    cosmeticPosition: EquipPosition.AVATAR_BORDER,
    avatarId: 0,
  },
  {
    itemTokenId: EstforConstants.TITLE_WQ1_TOP5,
    cosmeticPosition: EquipPosition.TITLE,
    avatarId: 0,
  },
  {
    itemTokenId: EstforConstants.TITLE_WQ1_TOP50,
    cosmeticPosition: EquipPosition.TITLE,
    avatarId: 0,
  },
  {
    itemTokenId: EstforConstants.TITLE_WQ1_ALL,
    cosmeticPosition: EquipPosition.TITLE,
    avatarId: 0,
  },
];
