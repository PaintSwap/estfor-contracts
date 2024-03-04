import {ethers} from "hardhat";
import {WORLD_ADDRESS, WORLD_LIBRARY_ADDRESS} from "./contractAddresses";
import {allActionChoicesForging} from "./data/actionChoices";
import {allActionChoiceIdsForging} from "./data/actionChoiceIds";
import {EstforConstants} from "@paintswap/estfor-definitions";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Edit action choices using account: ${owner.address}`);

  const network = await ethers.provider.getNetwork();
  console.log(`ChainId: ${network.chainId}`);

  const World = (await ethers.getContractFactory("World", {libraries: {WorldLibrary: WORLD_LIBRARY_ADDRESS}})).connect(
    owner
  );
  const world = await World.attach(WORLD_ADDRESS);

  // Single
  /*  const index = await allActionChoiceIdsFletching.findIndex(
    (actionChoiceId) => actionChoiceId === EstforConstants.ACTIONCHOICE_FLETCHING_BASIC_BOW
  );
  if (index === -1) {
    console.error("ActionChoiceId not found");
  } else {
    {
      const tx = await world.editActionChoices(
        EstforConstants.ACTION_FLETCHING_ITEM,
        [allActionChoiceIdsFletching[index]],
        [allActionChoicesFletching[index]]
      );
      await tx.wait();
    }
  } */
  {
    const tx = await world.editActionChoices(
      EstforConstants.ACTION_FORGING_ITEM,
      allActionChoiceIdsForging,
      allActionChoicesForging
    );
    await tx.wait();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
