import {ethers} from "hardhat";
import {WORLD_ACTIONS_ADDRESS} from "./contractAddresses";
import {allActionChoicesRanged} from "./data/actionChoices";
import {allActionChoiceIdsRanged} from "./data/actionChoiceIds";
import {EstforConstants} from "@paintswap/estfor-definitions";
import {getChainId} from "./utils";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Edit action choices using account: ${owner.address} on chain id ${await getChainId(owner)}`);

  const worldActions = await ethers.getContractAt("WorldActions", WORLD_ACTIONS_ADDRESS);

  const actionChoicesToUpdate = new Set([
    EstforConstants.ACTIONCHOICE_RANGED_BASIC_BOW_FIRE,
    EstforConstants.ACTIONCHOICE_RANGED_BASIC_BOW_POISON
  ]);

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
      const tx = await worldActions.editActionChoices(EstforConstants.NONE, actionChoiceIds, actionChoices);
      await tx.wait();
    }
  }

  /*
  {
    const tx = await worldActions.editActionChoices(
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
