import {ethers} from "hardhat";
import {WORLD_ADDRESS} from "./contractAddresses";
import {allActions} from "./data/actions";
import {EstforConstants} from "@paintswap/estfor-definitions";
import {World} from "../typechain-types";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Edit actions using account: ${owner.address} on chain id ${await owner.getChainId()}`);

  const world = (await ethers.getContractAt("World", WORLD_ADDRESS, owner)) as World;

  /*
  const actions = allActions.filter(
    (action) =>
      action.info.skill === Skill.COMBAT || action.info.skill === Skill.FISHING || action.info.skill === Skill.MINING
  );

  const tx = await world.editActions(actions);
  await tx.wait();
  */

  const _actions = new Set([
    EstforConstants.ACTION_FISHING_STONECLAW,
    EstforConstants.ACTION_FISHING_CRUSKAN,
    EstforConstants.ACTION_FISHING_DOUBTFISH,
    EstforConstants.ACTION_FISHING_ROSEFIN,
    EstforConstants.ACTION_FISHING_CHODFISH,
  ]);
  const actions = allActions.filter((action) => _actions.has(action.actionId));

  if (actions.length !== _actions.size) {
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
