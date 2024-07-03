import {ethers} from "hardhat";
import {WORLD_ADDRESS} from "./contractAddresses";
import {allActionChoicesRanged} from "./data/actionChoices";
import {allActionChoiceIdsRanged} from "./data/actionChoiceIds";
import {EstforConstants} from "@paintswap/estfor-definitions";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Add action choices using account: ${owner.address} on chain id ${await owner.getChainId()}`);
  const world = (await ethers.getContractAt("World", WORLD_ADDRESS)).connect(owner);

  const newActionChoiceIds = new Set([
    EstforConstants.ACTIONCHOICE_RANGED_BASIC_BOW_POISON,
    EstforConstants.ACTIONCHOICE_RANGED_BASIC_BOW_FIRE,
    EstforConstants.ACTIONCHOICE_RANGED_BONE_BOW_POISON,
    EstforConstants.ACTIONCHOICE_RANGED_BONE_BOW_FIRE,
    EstforConstants.ACTIONCHOICE_RANGED_EXPERT_BOW_POISON,
    EstforConstants.ACTIONCHOICE_RANGED_EXPERT_BOW_FIRE,
    EstforConstants.ACTIONCHOICE_RANGED_SPECTRAL_BOW_POISON,
    EstforConstants.ACTIONCHOICE_RANGED_SPECTRAL_BOW_FIRE,
    EstforConstants.ACTIONCHOICE_RANGED_ICY_BOW_POISON,
    EstforConstants.ACTIONCHOICE_RANGED_ICY_BOW_FIRE,
    EstforConstants.ACTIONCHOICE_RANGED_GLITTERING_BOW_POISON,
    EstforConstants.ACTIONCHOICE_RANGED_GLITTERING_BOW_FIRE,
    EstforConstants.ACTIONCHOICE_RANGED_GODLY_BOW_POISON,
    EstforConstants.ACTIONCHOICE_RANGED_GODLY_BOW_FIRE,
  ]);

  const actionChoiceIndices = allActionChoiceIdsRanged.reduce((indices: number[], actionChoiceId, index) => {
    if (newActionChoiceIds.has(actionChoiceId)) {
      indices.push(index);
    }
    return indices;
  }, []);

  const actionChoices = actionChoiceIndices.map((index) => allActionChoicesRanged[index]);
  const actionChoiceIds = actionChoiceIndices.map((index) => allActionChoiceIdsRanged[index]);

  if (actionChoices.length !== newActionChoiceIds.size || actionChoiceIds.length !== newActionChoiceIds.size) {
    console.error("ActionChoiceIds not found");
  } else {
    {
      const tx = await world.addBulkActionChoices([EstforConstants.NONE], [actionChoiceIds], [actionChoices]);
      await tx.wait();
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
