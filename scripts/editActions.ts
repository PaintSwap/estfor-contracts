import {ethers} from "hardhat";
import {WORLD_ACTIONS_ADDRESS} from "./contractAddresses";
import {allActions} from "./data/actions";
import {EstforConstants} from "@paintswap/estfor-definitions";
import {getChainId} from "./utils";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Edit actions using account: ${owner.address} on chain id ${await getChainId(owner)}`);

  const worldActions = await ethers.getContractAt("WorldActions", WORLD_ACTIONS_ADDRESS, owner);

  /*
  const actions = allActions.filter(
    (action) =>
      action.info.skill === Skill.COMBAT || action.info.skill === Skill.FISHING || action.info.skill === Skill.MINING
  );

  const tx = await worldActions.editActions(actions);
  await tx.wait();
  */

  const actionIds = new Set([
    EstforConstants.ACTION_WOODCUTTING_TANGLED_PASS,
    EstforConstants.ACTION_WOODCUTTING_CHOKING_HOLLOW,
    EstforConstants.ACTION_WOODCUTTING_RAZORVINE_THICKET,
    EstforConstants.ACTION_WOODCUTTING_BRAMBLED_THROAT,
    EstforConstants.ACTION_WOODCUTTING_THE_HEART,
    EstforConstants.ACTION_MINING_GATE,
    EstforConstants.ACTION_MINING_PETRIFIED_GARDEN,
    EstforConstants.ACTION_MINING_BURIED_COURTYARD,
    EstforConstants.ACTION_MINING_GILDED_HALLS,
    EstforConstants.ACTION_MINING_THRONE_ROOM,
    EstforConstants.ACTION_FISHING_SPHINX_FISH,
    EstforConstants.ACTION_FISHING_SHAW,
    EstforConstants.ACTION_FISHING_VANISHING_PERCH,
    EstforConstants.ACTION_FISHING_VIPER_BASS,
    EstforConstants.ACTION_FISHING_WATER_SERPENT,
    EstforConstants.ACTION_FISHING_WHISKFIN,
    EstforConstants.ACTION_THIEVING_FORGOTTEN_QUARRY,
    EstforConstants.ACTION_THIEVING_ENDLESS_TUNNEL,
    EstforConstants.ACTION_THIEVING_CATACOMBS,
    EstforConstants.ACTION_THIEVING_LOST_SANCTUM,
    EstforConstants.ACTION_THIEVING_VAULT
  ]);
  const actions = allActions.filter((action) => actionIds.has(action.actionId));

  if (actions.length !== actionIds.size) {
    console.log("Cannot find actions");
  } else {
    const tx = await worldActions.editActions(actions);
    await tx.wait();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
