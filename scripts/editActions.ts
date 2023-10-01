import {ethers} from "hardhat";
import {WORLD_ADDRESS, WORLD_LIBRARY_ADDRESS} from "./contractAddresses";
import {allActions} from "./data/actions";
import {EstforConstants} from "@paintswap/estfor-definitions";
import {Skill} from "@paintswap/estfor-definitions/types";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Edit actions using account: ${owner.address}`);

  const network = await ethers.provider.getNetwork();
  console.log(`ChainId: ${network.chainId}`);

  const World = (await ethers.getContractFactory("World", {libraries: {WorldLibrary: WORLD_LIBRARY_ADDRESS}})).connect(
    owner
  );
  const world = await World.attach(WORLD_ADDRESS);
  /*
  const actions = await allActions.filter(
    (action) =>
      action.info.skill === Skill.COMBAT || action.info.skill === Skill.FISHING || action.info.skill === Skill.MINING
  );

  const tx = await world.editActions(actions);
  await tx.wait(); */

  const actions = await allActions.filter(
    (action) =>
      action.actionId === EstforConstants.ACTION_COMBAT_ERKAD ||
      action.actionId === EstforConstants.ACTION_COMBAT_ELEMENTAL_DRAGON
  );

  if (actions.length !== 2) {
    console.log("Cannot find actions");
  } else {
    const tx = await world.editActions(actions);
    await tx.wait();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
