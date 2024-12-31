import {ethers} from "hardhat";
import {WORLD_ACTIONS_ADDRESS} from "./contractAddresses";
import {allActionChoicesAlchemy} from "./data/actionChoices";
import {allActionChoiceIdsAlchemy} from "./data/actionChoiceIds";
import {EstforConstants} from "@paintswap/estfor-definitions";
import {getChainId} from "./utils";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Edit action choices using account: ${owner.address} on chain id ${await getChainId(owner)}`);

  const worldActions = await ethers.getContractAt("WorldActions", WORLD_ACTIONS_ADDRESS);

  const actionChoicesToUpdate = new Set([
    EstforConstants.ACTIONCHOICE_ALCHEMY_FOOLS_BERRY_EXTRACT,
    EstforConstants.ACTIONCHOICE_ALCHEMY_LUMELILA_TOXIN
  ]);

  const actionChoiceIndices = allActionChoiceIdsAlchemy.reduce((indices: number[], actionChoiceId, index) => {
    if (actionChoicesToUpdate.has(actionChoiceId)) {
      indices.push(index);
    }
    return indices;
  }, []);

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
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
