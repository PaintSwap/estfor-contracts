import {Skill} from "@paintswap/estfor-definitions/types";

export type TerritoryInput = {
  territoryId: number;
  percentageEmissions: number;
};

export const PERCENTAGE_EMISSION_MUL = 10;

export const allTerritories: TerritoryInput[] = [
  {
    territoryId: 1,
    percentageEmissions: 10 * PERCENTAGE_EMISSION_MUL,
  },
  {
    territoryId: 2,
    percentageEmissions: 10 * PERCENTAGE_EMISSION_MUL,
  },
  {
    territoryId: 3,
    percentageEmissions: 10 * PERCENTAGE_EMISSION_MUL,
  },
  {
    territoryId: 4,
    percentageEmissions: 10 * PERCENTAGE_EMISSION_MUL,
  },
  {
    territoryId: 5,
    percentageEmissions: 10 * PERCENTAGE_EMISSION_MUL,
  },
  {
    territoryId: 6,
    percentageEmissions: 3 * PERCENTAGE_EMISSION_MUL,
  },
  {
    territoryId: 7,
    percentageEmissions: 3 * PERCENTAGE_EMISSION_MUL,
  },
  {
    territoryId: 8,
    percentageEmissions: 3 * PERCENTAGE_EMISSION_MUL,
  },
  {
    territoryId: 9,
    percentageEmissions: 3 * PERCENTAGE_EMISSION_MUL,
  },
  {
    territoryId: 10,
    percentageEmissions: 3 * PERCENTAGE_EMISSION_MUL,
  },
  {
    territoryId: 11,
    percentageEmissions: 3 * PERCENTAGE_EMISSION_MUL,
  },
  {
    territoryId: 12,
    percentageEmissions: 3 * PERCENTAGE_EMISSION_MUL,
  },
  {
    territoryId: 13,
    percentageEmissions: 3 * PERCENTAGE_EMISSION_MUL,
  },
  {
    territoryId: 14,
    percentageEmissions: 3 * PERCENTAGE_EMISSION_MUL,
  },
  {
    territoryId: 15,
    percentageEmissions: 3 * PERCENTAGE_EMISSION_MUL,
  },
  {
    territoryId: 16,
    percentageEmissions: 2 * PERCENTAGE_EMISSION_MUL,
  },
  {
    territoryId: 17,
    percentageEmissions: 2 * PERCENTAGE_EMISSION_MUL,
  },
  {
    territoryId: 18,
    percentageEmissions: 2 * PERCENTAGE_EMISSION_MUL,
  },
  {
    territoryId: 19,
    percentageEmissions: 2 * PERCENTAGE_EMISSION_MUL,
  },
  {
    territoryId: 20,
    percentageEmissions: 2 * PERCENTAGE_EMISSION_MUL,
  },
  {
    territoryId: 21,
    percentageEmissions: 2 * PERCENTAGE_EMISSION_MUL,
  },
  {
    territoryId: 22,
    percentageEmissions: 2 * PERCENTAGE_EMISSION_MUL,
  },
  {
    territoryId: 23,
    percentageEmissions: 2 * PERCENTAGE_EMISSION_MUL,
  },
  {
    territoryId: 24,
    percentageEmissions: 2 * PERCENTAGE_EMISSION_MUL,
  },
  {
    territoryId: 25,
    percentageEmissions: 2 * PERCENTAGE_EMISSION_MUL,
  },
];

export const allTerritorySkills = [
  Skill.MELEE,
  Skill.RANGED,
  Skill.MAGIC,
  Skill.DEFENCE,
  Skill.HEALTH,
  Skill.MINING,
  Skill.WOODCUTTING,
  Skill.FISHING,
  Skill.SMITHING,
  Skill.THIEVING,
  Skill.CRAFTING,
  Skill.COOKING,
  Skill.FIREMAKING,
  Skill.ALCHEMY,
  Skill.FLETCHING,
  Skill.FORGING,
];
