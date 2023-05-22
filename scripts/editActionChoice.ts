import {ethers} from "hardhat";
import {WORLD_ADDRESS, WORLD_LIBRARY_ADDRESS} from "./contractAddresses";
import {allActionChoicesCrafting} from "./data/actionChoices";
import {allActionChoiceIdsCrafting} from "./data/actionChoiceIds";
import {EstforConstants} from "@paintswap/estfor-definitions";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Edit clan tiers using account: ${owner.address}`);

  const network = await ethers.provider.getNetwork();
  console.log(`ChainId: ${network.chainId}`);

  const World = await ethers.getContractFactory("World", {libraries: {WorldLibrary: WORLD_LIBRARY_ADDRESS}});
  const world = await World.attach(WORLD_ADDRESS);

  const index = await allActionChoiceIdsCrafting.findIndex(
    (actionChoiceId) => actionChoiceId === EstforConstants.ACTIONCHOICE_CRAFTING_NATUOW_LEATHER
  );

  if (index === -1) {
    console.error("ActionChoiceId not found");
  } else {
    console.log("Updating ", allActionChoicesCrafting[index], " ", allActionChoiceIdsCrafting[index]);
    const tx = await world.editActionChoice(
      EstforConstants.ACTION_CRAFTING_ITEM,
      allActionChoiceIdsCrafting[index],
      allActionChoicesCrafting[index]
    );
    await tx.wait();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
