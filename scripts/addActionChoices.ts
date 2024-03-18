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

  const newActionChoiceIdsAlchemy = [
    EstforConstants.ACTIONCHOICE_ALCHEMY_COPPER_ORE,
    EstforConstants.ACTIONCHOICE_ALCHEMY_TIN_ORE,
    EstforConstants.ACTIONCHOICE_ALCHEMY_IRON_ORE,
    EstforConstants.ACTIONCHOICE_ALCHEMY_SAPPHIRE,
    EstforConstants.ACTIONCHOICE_ALCHEMY_COAL_ORE,
    EstforConstants.ACTIONCHOICE_ALCHEMY_EMERALD,
    EstforConstants.ACTIONCHOICE_ALCHEMY_MITHRIL_ORE,
    EstforConstants.ACTIONCHOICE_ALCHEMY_RUBY,
    EstforConstants.ACTIONCHOICE_ALCHEMY_ADAMANTINE_ORE,
    EstforConstants.ACTIONCHOICE_ALCHEMY_AMETHYST,
    EstforConstants.ACTIONCHOICE_ALCHEMY_DIAMOND,
    EstforConstants.ACTIONCHOICE_ALCHEMY_RUNITE_ORE,
    EstforConstants.ACTIONCHOICE_ALCHEMY_DRAGONSTONE,
    EstforConstants.ACTIONCHOICE_ALCHEMY_TITANIUM_ORE,
    EstforConstants.ACTIONCHOICE_ALCHEMY_ORICHALCUM_ORE,
    EstforConstants.ACTIONCHOICE_ALCHEMY_FEATHER,
    EstforConstants.ACTIONCHOICE_ALCHEMY_LOG,
    EstforConstants.ACTIONCHOICE_ALCHEMY_OAK_LOG,
    EstforConstants.ACTIONCHOICE_ALCHEMY_WILLOW_LOG,
    EstforConstants.ACTIONCHOICE_ALCHEMY_MAPLE_LOG,
    EstforConstants.ACTIONCHOICE_ALCHEMY_REDWOOD_LOG,
    EstforConstants.ACTIONCHOICE_ALCHEMY_MAGICAL_LOG,
    EstforConstants.ACTIONCHOICE_ALCHEMY_ASH_LOG,
    EstforConstants.ACTIONCHOICE_ALCHEMY_ENCHANTED_LOG,
    EstforConstants.ACTIONCHOICE_ALCHEMY_LIVING_LOG,
    EstforConstants.ACTIONCHOICE_ALCHEMY_PAPER,
  ];

  const newActionChoicesAlchemy: ActionChoiceInput[] = [];
  allActionChoiceIdsAlchemy.forEach((actionChoiceId, index) => {
    if (newActionChoiceIdsAlchemy.includes(actionChoiceId)) {
      newActionChoicesAlchemy.push(allActionChoicesAlchemy[index]);
    }
  });

  const alchemyActionId = EstforConstants.ACTION_ALCHEMY_ITEM;
  const forgingActionId = EstforConstants.ACTION_FORGING_ITEM;
  await world
    .connect(owner)
    .addBulkActionChoices(
      [alchemyActionId, forgingActionId],
      [newActionChoiceIdsAlchemy, allActionChoiceIdsForging],
      [newActionChoicesAlchemy, allActionChoicesForging]
    );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
