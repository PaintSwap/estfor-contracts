import {ethers} from "hardhat";
import {INSTANT_ACTIONS_ADDRESS} from "./contractAddresses";
import {EstforConstants} from "@paintswap/estfor-definitions";
import {allInstantActions} from "./data/instantActions";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Add instant actions using account: ${owner.address} on chain id ${await owner.getChainId()}`);

  const instantActions = (await ethers.getContractAt("InstantActions", INSTANT_ACTIONS_ADDRESS)).connect(owner);

  const actionIds = new Set([
    EstforConstants.INSTANT_ACTION_FORGING_PANGSTEN_RING,
    EstforConstants.INSTANT_ACTION_FORGING_CANVITE_RING,
    EstforConstants.INSTANT_ACTION_FORGING_ETCHED_RING,
    EstforConstants.INSTANT_ACTION_FORGING_PRIMDIAT_RING,
    EstforConstants.INSTANT_ACTION_FORGING_OCULITE_RING,
    EstforConstants.INSTANT_ACTION_FORGING_NOVIAN_RING,
    EstforConstants.INSTANT_ACTION_SMITHING_ORICHALCUM_HELMET,
    EstforConstants.INSTANT_ACTION_SMITHING_ORICHALCUM_ARMOR,
    EstforConstants.INSTANT_ACTION_SMITHING_ORICHALCUM_TASSETS,
    EstforConstants.INSTANT_ACTION_SMITHING_ORICHALCUM_GAUNTLETS,
    EstforConstants.INSTANT_ACTION_SMITHING_ORICHALCUM_BOOTS,
    EstforConstants.INSTANT_ACTION_SMITHING_ORICHALCUM_SHIELD,
    EstforConstants.INSTANT_ACTION_SMITHING_ORICHALCUM_SWORD,
    EstforConstants.INSTANT_ACTION_CRAFTING_DRAGONSTONE_AMULET,
    EstforConstants.INSTANT_ACTION_CRAFTING_MASTER_HAT,
    EstforConstants.INSTANT_ACTION_CRAFTING_MASTER_BODY,
    EstforConstants.INSTANT_ACTION_CRAFTING_MASTER_BRACERS,
    EstforConstants.INSTANT_ACTION_CRAFTING_MASTER_TROUSERS,
    EstforConstants.INSTANT_ACTION_CRAFTING_MASTER_BOOTS,
    EstforConstants.INSTANT_ACTION_CRAFTING_DRAGONSTONE_STAFF,
    EstforConstants.INSTANT_ACTION_CRAFTING_SCORCHING_COWL,
    EstforConstants.INSTANT_ACTION_CRAFTING_SCORCHING_BODY,
    EstforConstants.INSTANT_ACTION_CRAFTING_SCORCHING_BRACERS,
    EstforConstants.INSTANT_ACTION_CRAFTING_SCORCHING_CHAPS,
    EstforConstants.INSTANT_ACTION_CRAFTING_SCORCHING_BOOTS,
    EstforConstants.INSTANT_ACTION_FLETCHING_GODLY_BOW,
  ]);

  const actions = allInstantActions.filter((action) => {
    if (action) {
      return actionIds.has(action.actionId);
    }
  });

  if (actions.length !== actionIds.size) {
    console.log("Cannot find actions");
  } else {
    await instantActions.addActions(actions);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
