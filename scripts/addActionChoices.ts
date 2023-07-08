import {ethers} from "hardhat";
import {WORLD_ADDRESS, WORLD_LIBRARY_ADDRESS} from "./contractAddresses";
import {
  allActionChoicesAlchemy,
  allActionChoicesCrafting,
  allActionChoicesFletching,
  allActionChoicesRanged,
  allActionChoicesSmithing,
} from "./data/actionChoices";
import {
  allActionChoiceIdsAlchemy,
  allActionChoiceIdsCrafting,
  allActionChoiceIdsFletching,
  allActionChoiceIdsRanged,
  allActionChoiceIdsSmithing,
} from "./data/actionChoiceIds";
import {EstforConstants} from "@paintswap/estfor-definitions";
import {ActionChoiceInput} from "@paintswap/estfor-definitions/types";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Edit action choices using account: ${owner.address}`);

  const network = await ethers.provider.getNetwork();
  console.log(`ChainId: ${network.chainId}`);

  const World = await ethers.getContractFactory("World", {libraries: {WorldLibrary: WORLD_LIBRARY_ADDRESS}});
  const world = await World.attach(WORLD_ADDRESS);

  const newActionChoiceIdsCrafting = [
    EstforConstants.ACTIONCHOICE_CRAFTING_BONEMEAL_MEDIUM,
    EstforConstants.ACTIONCHOICE_CRAFTING_AZURITE_COWL,
    EstforConstants.ACTIONCHOICE_CRAFTING_AZURITE_BODY,
    EstforConstants.ACTIONCHOICE_CRAFTING_AZURITE_CHAPS,
    EstforConstants.ACTIONCHOICE_CRAFTING_AZURITE_BRACERS,
    EstforConstants.ACTIONCHOICE_CRAFTING_AZURITE_BOOTS,
    EstforConstants.ACTIONCHOICE_CRAFTING_HAUBERK_COWL,
    EstforConstants.ACTIONCHOICE_CRAFTING_HAUBERK_BODY,
    EstforConstants.ACTIONCHOICE_CRAFTING_HAUBERK_CHAPS,
    EstforConstants.ACTIONCHOICE_CRAFTING_HAUBERK_BRACERS,
    EstforConstants.ACTIONCHOICE_CRAFTING_HAUBERK_BOOTS,
    EstforConstants.ACTIONCHOICE_CRAFTING_GARAGOS_COWL,
    EstforConstants.ACTIONCHOICE_CRAFTING_GARAGOS_BODY,
    EstforConstants.ACTIONCHOICE_CRAFTING_GARAGOS_CHAPS,
    EstforConstants.ACTIONCHOICE_CRAFTING_GARAGOS_BRACERS,
    EstforConstants.ACTIONCHOICE_CRAFTING_GARAGOS_BOOTS,
    EstforConstants.ACTIONCHOICE_CRAFTING_ETERNAL_COWL,
    EstforConstants.ACTIONCHOICE_CRAFTING_ETERNAL_BODY,
    EstforConstants.ACTIONCHOICE_CRAFTING_ETERNAL_CHAPS,
    EstforConstants.ACTIONCHOICE_CRAFTING_ETERNAL_BRACERS,
    EstforConstants.ACTIONCHOICE_CRAFTING_ETERNAL_BOOTS,
    EstforConstants.ACTIONCHOICE_CRAFTING_REAVER_COWL,
    EstforConstants.ACTIONCHOICE_CRAFTING_REAVER_BODY,
    EstforConstants.ACTIONCHOICE_CRAFTING_REAVER_CHAPS,
    EstforConstants.ACTIONCHOICE_CRAFTING_REAVER_BRACERS,
    EstforConstants.ACTIONCHOICE_CRAFTING_REAVER_BOOTS,
  ];

  const newActionChoicesCrafting: ActionChoiceInput[] = [];
  allActionChoiceIdsCrafting.forEach((actionChoiceId, index) => {
    if (newActionChoiceIdsCrafting.includes(actionChoiceId)) {
      newActionChoicesCrafting.push(allActionChoicesCrafting[index]);
    }
  });

  const newActionChoiceIdsSmithing = [
    EstforConstants.ACTIONCHOICE_SMITHING_BRONZE_ARROW_HEAD,
    EstforConstants.ACTIONCHOICE_SMITHING_IRON_ARROW_HEAD,
    EstforConstants.ACTIONCHOICE_SMITHING_MITHRIL_ARROW_HEAD,
    EstforConstants.ACTIONCHOICE_SMITHING_ADAMANITE_ARROW_HEAD,
    EstforConstants.ACTIONCHOICE_SMITHING_RUNITE_ARROW_HEAD,
    EstforConstants.ACTIONCHOICE_SMITHING_TITANIUM_ARROW_HEAD,
    EstforConstants.ACTIONCHOICE_SMITHING_ORICHALCUM_ARROW_HEAD,
  ];

  const newActionChoicesSmithing: ActionChoiceInput[] = [];
  allActionChoiceIdsSmithing.forEach((actionChoiceId, index) => {
    if (newActionChoiceIdsSmithing.includes(actionChoiceId)) {
      newActionChoicesSmithing.push(allActionChoicesSmithing[index]);
    }
  });

  const smithingActionId = EstforConstants.ACTION_SMITHING_ITEM;
  const craftingActionId = EstforConstants.ACTION_CRAFTING_ITEM;
  const fletchingActionId = EstforConstants.ACTION_FLETCHING_ITEM;
  const alchemyActionId = EstforConstants.ACTION_ALCHEMY_ITEM;
  const genericCombatActionId = EstforConstants.NONE;

  // New skills, range, fletching & alchemy
  await world.addBulkActionChoices(
    [craftingActionId, smithingActionId, fletchingActionId, alchemyActionId, genericCombatActionId],
    [newActionChoiceIdsCrafting, allActionChoiceIdsFletching, allActionChoiceIdsAlchemy, allActionChoiceIdsRanged],
    [newActionChoicesCrafting, allActionChoicesFletching, allActionChoicesAlchemy, allActionChoicesRanged]
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
