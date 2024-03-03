import {ethers} from "hardhat";
import {WORLD_ADDRESS, WORLD_LIBRARY_ADDRESS} from "./contractAddresses";
import {allActionChoicesAlchemy, allActionChoicesForging} from "./data/actionChoices";
import {allActionChoiceIdsAlchemy, allActionChoiceIdsForging} from "./data/actionChoiceIds";
import {EstforConstants} from "@paintswap/estfor-definitions";
import {ActionChoiceInput} from "@paintswap/estfor-definitions/types";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Add action choices using account: ${owner.address} on chain id ${await owner.getChainId()}`);

  const World = await ethers.getContractFactory("World", {libraries: {WorldLibrary: WORLD_LIBRARY_ADDRESS}});
  const world = await World.attach(WORLD_ADDRESS);

  const newActionChoiceIds = [
    EstforConstants.ACTIONCHOICE_FORGING_ORICHALCUM_HELMET,
    EstforConstants.ACTIONCHOICE_FORGING_ORICHALCUM_ARMOR,
    EstforConstants.ACTIONCHOICE_FORGING_ORICHALCUM_TASSETS,
    EstforConstants.ACTIONCHOICE_FORGING_ORICHALCUM_GAUNTLETS,
    EstforConstants.ACTIONCHOICE_FORGING_ORICHALCUM_BOOTS,
    EstforConstants.ACTIONCHOICE_FORGING_ORICHALCUM_SHIELD,
    EstforConstants.ACTIONCHOICE_FORGING_DRAGONSTONE_AMULET,
    EstforConstants.ACTIONCHOICE_FORGING_MASTER_HAT,
    EstforConstants.ACTIONCHOICE_FORGING_MASTER_BODY,
    EstforConstants.ACTIONCHOICE_FORGING_MASTER_TROUSERS,
    EstforConstants.ACTIONCHOICE_FORGING_MASTER_BRACERS,
    EstforConstants.ACTIONCHOICE_FORGING_MASTER_BOOTS,
    EstforConstants.ACTIONCHOICE_FORGING_ORICHALCUM_SWORD,
    EstforConstants.ACTIONCHOICE_FORGING_DRAGONSTONE_STAFF,
    EstforConstants.ACTIONCHOICE_FORGING_GODLY_BOW,
    EstforConstants.ACTIONCHOICE_FORGING_SCORCHING_COWL,
    EstforConstants.ACTIONCHOICE_FORGING_SCORCHING_BODY,
    EstforConstants.ACTIONCHOICE_FORGING_SCORCHING_CHAPS,
    EstforConstants.ACTIONCHOICE_FORGING_SCORCHING_BRACERS,
    EstforConstants.ACTIONCHOICE_FORGING_SCORCHING_BOOTS,
  ];

  const newActionChoices: ActionChoiceInput[] = [];
  allActionChoiceIdsForging.forEach((actionChoiceId, index) => {
    if (newActionChoiceIds.includes(actionChoiceId)) {
      newActionChoices.push(allActionChoicesAlchemy[index]);
    }
  });

  await world
    .connect(owner)
    .addBulkActionChoices([EstforConstants.ACTION_FORGING_ITEM], [newActionChoiceIds], [newActionChoices]);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
