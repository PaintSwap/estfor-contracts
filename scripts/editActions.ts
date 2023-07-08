import {ethers} from "hardhat";
import {WORLD_ADDRESS, WORLD_LIBRARY_ADDRESS} from "./contractAddresses";
import {allActions} from "./data/actions";
import {EstforConstants} from "@paintswap/estfor-definitions";
import {Skill} from "@paintswap/estfor-definitions/types";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Edit clan tiers using account: ${owner.address}`);

  const network = await ethers.provider.getNetwork();
  console.log(`ChainId: ${network.chainId}`);

  const World = await ethers.getContractFactory("World", {libraries: {WorldLibrary: WORLD_LIBRARY_ADDRESS}});
  const world = await World.attach(WORLD_ADDRESS);

  const actions = await allActions.filter(
    (action) =>
      action.info.skill === Skill.COMBAT || action.info.skill === Skill.FISHING || action.info.skill === Skill.MINING
  );

  const tx = await world.editActions(actions);
  await tx.wait();

  /*
  const actions = await allActions.filter(
    (action) =>
      action.actionId === EstforConstants.ACTION_COMBAT_GRAND_TREE_IMP ||
      action.actionId === EstforConstants.ACTION_COMBAT_SNUFFLEQUARG ||
      action.actionId === EstforConstants.ACTION_COMBAT_LOSSUTH ||
      action.actionId === EstforConstants.ACTION_COMBAT_SQUIGGLE_EGG ||
      action.actionId === EstforConstants.ACTION_COMBAT_QUARTZ_EAGLE ||
      action.actionId === EstforConstants.ACTION_COMBAT_ANCIENT_ENT ||
      action.actionId === EstforConstants.ACTION_COMBAT_ROCKHAWK
  );

  if (actions.length !== 7) {
    console.log("Cannot find actions");
  } else {
    const tx = await world.editActions(actions);
    await tx.wait();
  } */
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
