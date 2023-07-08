import {ethers} from "hardhat";
import {WORLD_ADDRESS, WORLD_LIBRARY_ADDRESS} from "./contractAddresses";
import {
  allActionChoicesCooking,
  allActionChoicesCrafting,
  allActionChoicesFiremaking,
  allActionChoicesSmithing,
} from "./data/actionChoices";
import {
  allActionChoiceIdsCooking,
  allActionChoiceIdsCrafting,
  allActionChoiceIdsFiremaking,
  allActionChoiceIdsSmithing,
} from "./data/actionChoiceIds";
import {EstforConstants} from "@paintswap/estfor-definitions";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Edit action choices using account: ${owner.address}`);

  const network = await ethers.provider.getNetwork();
  console.log(`ChainId: ${network.chainId}`);

  const World = await ethers.getContractFactory("World", {libraries: {WorldLibrary: WORLD_LIBRARY_ADDRESS}});
  const world = await World.attach(WORLD_ADDRESS);

  // Single
  //  const index = await allActionChoiceIdsCrafting;
  //.findIndex(
  //  (actionChoiceId) => actionChoiceId === EstforConstants.ACTIONCHOICE_CRAFTING_TOTEM_STAFF
  //);

  /*
  if (index === -1) {
    console.error("ActionChoiceId not found");
  } else {
    console.log("Updating ", allActionChoicesCrafting[index], " ", allActionChoiceIdsCrafting[index]);
    const tx = await world.editActionChoices(
      [EstforConstants.ACTION_CRAFTING_ITEM],
      [allActionChoiceIdsCrafting[index]],
      [allActionChoicesCrafting[index]]
    );
    await tx.wait();
  }
*/
  {
    const actionIds = allActionChoiceIdsCrafting.map(() => EstforConstants.ACTION_CRAFTING_ITEM);
    const tx = await world.editActionChoices(actionIds, allActionChoiceIdsCrafting, allActionChoicesCrafting);
    await tx.wait();
  }
  {
    const actionIds = allActionChoiceIdsCooking.map(() => EstforConstants.ACTION_COOKING_ITEM);
    const tx = await world.editActionChoices(actionIds, allActionChoiceIdsCooking, allActionChoicesCooking);
    await tx.wait();
  }
  {
    const actionIds = allActionChoiceIdsSmithing.map(() => EstforConstants.ACTION_SMITHING_ITEM);
    const tx = await world.editActionChoices(actionIds, allActionChoiceIdsSmithing, allActionChoicesSmithing);
    await tx.wait();
  }
  // Makes ash
  {
    const actionIds = allActionChoiceIdsFiremaking.map(() => EstforConstants.ACTION_FIREMAKING_ITEM);
    const tx = await world.editActionChoices(actionIds, allActionChoiceIdsFiremaking, allActionChoicesFiremaking);
    await tx.wait();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
