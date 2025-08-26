import {ethers} from "hardhat";
import {WORLD_ACTIONS_ADDRESS} from "./contractAddresses";
import {
  allActionChoicesAlchemy,
  allActionChoicesCooking,
  allActionChoicesCrafting,
  allActionChoicesFarming,
  allActionChoicesFiremaking,
  allActionChoicesFletching,
  allActionChoicesForging,
  allActionChoicesMagic,
  allActionChoicesMelee,
  allActionChoicesRanged,
  allActionChoicesSmithing
} from "./data/actionChoices";
import {
  allActionChoiceIdsAlchemy,
  allActionChoiceIdsCooking,
  allActionChoiceIdsCrafting,
  allActionChoiceIdsFarming,
  allActionChoiceIdsFiremaking,
  allActionChoiceIdsFletching,
  allActionChoiceIdsForging,
  allActionChoiceIdsMagic,
  allActionChoiceIdsMelee,
  allActionChoiceIdsRanged,
  allActionChoiceIdsSmithing
} from "./data/actionChoiceIds";
import {EstforConstants} from "@paintswap/estfor-definitions";
import {getChainId} from "./utils";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Edit action choices using account: ${owner.address} on chain id ${await getChainId(owner)}`);

  const worldActions = await ethers.getContractAt("WorldActions", WORLD_ACTIONS_ADDRESS);

  // const actionChoicesToUpdate = new Set([
  //   EstforConstants.ACTIONCHOICE_ALCHEMY_FOOLS_BERRY_EXTRACT,
  //   EstforConstants.ACTIONCHOICE_ALCHEMY_LUMELILA_TOXIN
  // ]);

  // const actionChoiceIndices = allActionChoiceIdsAlchemy.reduce((indices: number[], actionChoiceId, index) => {
  //   if (actionChoicesToUpdate.has(actionChoiceId)) {
  //     indices.push(index);
  //   }
  //   return indices;
  // }, []);

  // Editing all
  const fireMakingActionId = EstforConstants.ACTION_FIREMAKING_ITEM;
  const smithingActionId = EstforConstants.ACTION_SMITHING_ITEM;
  const cookingActionId = EstforConstants.ACTION_COOKING_ITEM;
  const craftingActionId = EstforConstants.ACTION_CRAFTING_ITEM;
  const fletchingActionId = EstforConstants.ACTION_FLETCHING_ITEM;
  const alchemyActionId = EstforConstants.ACTION_ALCHEMY_ITEM;
  const forgingActionId = EstforConstants.ACTION_FORGING_ITEM;
  const farmingActionId = EstforConstants.ACTION_FARMING_ITEM;
  const genericCombatActionId = EstforConstants.NONE;

  const allActionIds = [
    fireMakingActionId,
    smithingActionId,
    cookingActionId,
    craftingActionId,
    fletchingActionId,
    alchemyActionId,
    forgingActionId,
    farmingActionId
  ];

  const allActionChoiceIds = [
    allActionChoiceIdsFiremaking,
    allActionChoiceIdsSmithing,
    allActionChoiceIdsCooking,
    allActionChoiceIdsCrafting,
    allActionChoiceIdsFletching,
    allActionChoiceIdsAlchemy,
    allActionChoiceIdsForging,
    allActionChoiceIdsFarming
  ];

  const allActionChoices = [
    allActionChoicesFiremaking,
    allActionChoicesSmithing,
    allActionChoicesCooking,
    allActionChoicesCrafting,
    allActionChoicesFletching,
    allActionChoicesAlchemy,
    allActionChoicesForging,
    allActionChoicesFarming
  ];

  console.log("Editing all non-combat action choices...");

  let tx = await worldActions.editActionChoices(genericCombatActionId, allActionChoiceIdsMelee, allActionChoicesMelee);
  await tx.wait();
  tx = await worldActions.editActionChoices(genericCombatActionId, allActionChoiceIdsRanged, allActionChoicesRanged);
  await tx.wait();
  tx = await worldActions.editActionChoices(genericCombatActionId, allActionChoiceIdsMagic, allActionChoicesMagic);
  await tx.wait();

  for (let i = 0; i < allActionIds.length; ++i) {
    const actionId = allActionIds[i];
    let tx = await worldActions.editActionChoices(actionId, allActionChoiceIds[i], allActionChoices[i]);
    await tx.wait();
    console.log("Edit action choices for action ", actionId);
  }

  console.log("All action choices edited successfully.");

  /*
  const actionChoices = actionChoiceIndices.map((index) => allActionChoicesAlchemy[index]);
  const actionChoiceIds = actionChoiceIndices.map((index) => allActionChoiceIdsAlchemy[index]);

  if (actionChoices.length !== actionChoicesToUpdate.size || actionChoiceIds.length !== actionChoicesToUpdate.size) {
    console.error("ActionChoiceIds not found");
  } else {
    const tx = await worldActions.editActionChoices(
      EstforConstants.ACTION_ALCHEMY_ITEM,
      actionChoiceIds,
      actionChoices
    );
    await tx.wait();
  } */
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
