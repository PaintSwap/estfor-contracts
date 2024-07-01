import {ethers} from "hardhat";
import {WORLD_ADDRESS} from "./contractAddresses";
import {allActionChoicesRanged} from "./data/actionChoices";
import {allActionChoiceIdsRanged} from "./data/actionChoiceIds";
import {EstforConstants} from "@paintswap/estfor-definitions";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Edit action choices using account: ${owner.address} on chain id ${await owner.getChainId()}`);

  const world = await ethers.getContractAt("World", WORLD_ADDRESS);

  const actionChoicesToUpdate = new Set([EstforConstants.ACTIONCHOICE_RANGED_GODLY_BOW]);

  const actionChoiceIndices = allActionChoiceIdsRanged.reduce((indices: number[], actionChoiceId, index) => {
    if (actionChoicesToUpdate.has(actionChoiceId)) {
      indices.push(index);
    }
    return indices;
  }, []);

  const actionChoices = actionChoiceIndices.map((index) => allActionChoicesRanged[index]);
  const actionChoiceIds = actionChoiceIndices.map((index) => allActionChoiceIdsRanged[index]);

  if (actionChoices.length !== actionChoicesToUpdate.size || actionChoiceIds.length !== actionChoicesToUpdate.size) {
    console.error("ActionChoiceIds not found");
  } else {
    {
      const tx = await world.editActionChoices(EstforConstants.NONE, actionChoiceIds, actionChoices);
      await tx.wait();
    }
  }

  /*
  {
    const tx = await world.editActionChoices(
      EstforConstants.ACTION_FORGING_ITEM,
      allActionChoiceIdsForging,
      allActionChoicesForging
    );
    await tx.wait();
  } */
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
