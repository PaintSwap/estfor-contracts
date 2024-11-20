import {EstforConstants} from "@paintswap/estfor-definitions";
export const allBaseRaidIds: number[] = [1]; // EstforConstants.RAID_ICE_MONSTER];

export const allBaseRaids = [
  {
    minHealth: 100,
    maxHealth: 200,
    minMeleeAttack: 10,
    maxMeleeAttack: 20,
    minMagicAttack: 15,
    maxMagicAttack: 25,
    minRangedAttack: 12,
    maxRangedAttack: 22,
    minMeleeDefence: 8,
    maxMeleeDefence: 18,
    minMagicDefence: 5,
    maxMagicDefence: 15,
    minRangedDefence: 7,
    maxRangedDefence: 17,
    tier: 1,
    randomLootTokenIds: [1, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    randomLootTokenAmounts: [1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    randomChances: [5000, 10000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
  }
];
