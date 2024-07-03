import {ethers, upgrades} from "hardhat";
import {WORLD_ADDRESS, WORLD_LIBRARY_ADDRESS} from "./contractAddresses";
import {allActions} from "./data/actions";
import {EstforConstants} from "@paintswap/estfor-definitions";
import {World} from "../typechain-types";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Add actions using account: ${owner.address} on chain id ${await owner.getChainId()}`);

  const world = (await ethers.getContractAt("World", WORLD_ADDRESS)).connect(owner) as World;

  const _actions = new Set([
    EstforConstants.ACTION_WOODCUTTING_SECLUDED_FOREST,
    EstforConstants.ACTION_WOODCUTTING_THE_WOODLANDS,
    EstforConstants.ACTION_WOODCUTTING_CURSED_MOUNTAIN,
    EstforConstants.ACTION_WOODCUTTING_ENCHANTED_GROVE,
    EstforConstants.ACTION_WOODCUTTING_WHISPERING_WOODS,
    EstforConstants.ACTION_FISHING_HIDDEN_POND,
    EstforConstants.ACTION_FISHING_SECRET_LAKE,
    EstforConstants.ACTION_FISHING_ENCHANTED_LAGOON,
    EstforConstants.ACTION_FISHING_UNDERGROUND_RIVER,
    EstforConstants.ACTION_FISHING_DEEP_SEA,
    EstforConstants.ACTION_MINING_TIN_MOTHERLODE,
    EstforConstants.ACTION_MINING_MITHRIL_MOTHERLODE,
    EstforConstants.ACTION_MINING_ADAMANTINE_MOTHERLODE,
    EstforConstants.ACTION_MINING_RUNITE_MOTHERLODE,
    EstforConstants.ACTION_MINING_TITANIUM_MOTHERLODE,
    EstforConstants.ACTION_COMBAT_EMBER_WHELP,
    EstforConstants.ACTION_COMBAT_JUVENILE_CAVE_FAIRY,
    EstforConstants.ACTION_COMBAT_CAVE_FAIRY,
    EstforConstants.ACTION_COMBAT_ICE_TROLL,
    EstforConstants.ACTION_COMBAT_BLAZING_MONTANITE,
    EstforConstants.ACTION_COMBAT_MONTANITE_ICE_TITAN,
    EstforConstants.ACTION_COMBAT_MONTANITE_FIRE_TITAN,
    EstforConstants.ACTION_THIEVING_FOREST,
    EstforConstants.ACTION_THIEVING_LAKE,
    EstforConstants.ACTION_THIEVING_NEST,
    EstforConstants.ACTION_THIEVING_LAIR,
    EstforConstants.ACTION_THIEVING_HIDEOUT,
  ]);
  const actions = allActions.filter((action) => _actions.has(action.actionId));

  if (actions.length !== _actions.size) {
    console.log("Cannot find actions");
  } else {
    const tx = await world.connect(owner).addActions(actions);
    await tx.wait();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
