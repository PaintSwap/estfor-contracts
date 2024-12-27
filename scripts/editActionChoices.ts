import {ethers} from "hardhat";
import {WORLD_ACTIONS_ADDRESS} from "./contractAddresses";
import {allActionChoicesMagic} from "./data/actionChoices";
import {allActionChoiceIdsMagic} from "./data/actionChoiceIds";
import {EstforConstants} from "@paintswap/estfor-definitions";
import {getChainId} from "./utils";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Edit action choices using account: ${owner.address} on chain id ${await getChainId(owner)}`);

  const worldActions = await ethers.getContractAt("WorldActions", WORLD_ACTIONS_ADDRESS);

  const actionChoicesToUpdate = new Set([
    EstforConstants.ACTIONCHOICE_MAGIC_SHADOW_BOLT,
    EstforConstants.ACTIONCHOICE_MAGIC_RAZOR_LEAVES,
    EstforConstants.ACTIONCHOICE_MAGIC_HEX,
    EstforConstants.ACTIONCHOICE_MAGIC_TORRENT_SURGE,
    EstforConstants.ACTIONCHOICE_MAGIC_HYDRO_BURST,
    EstforConstants.ACTIONCHOICE_MAGIC_VOID_WAVE,
    EstforConstants.ACTIONCHOICE_MAGIC_RAISE_DEAD,
    EstforConstants.ACTIONCHOICE_MAGIC_TORNADO,
    EstforConstants.ACTIONCHOICE_MAGIC_SUMMON_WIND_FAMILIAR,
    EstforConstants.ACTIONCHOICE_MAGIC_ARCANE_NOVA,
    EstforConstants.ACTIONCHOICE_MAGIC_FROST_BREATH,
    EstforConstants.ACTIONCHOICE_MAGIC_LIFE_DRAIN,
    EstforConstants.ACTIONCHOICE_MAGIC_BLIZZARD,
    EstforConstants.ACTIONCHOICE_MAGIC_STARFALL,
    EstforConstants.ACTIONCHOICE_MAGIC_CHRONO_FREEZE
  ]);

  const actionChoiceIndices = allActionChoiceIdsMagic.reduce((indices: number[], actionChoiceId, index) => {
    if (actionChoicesToUpdate.has(actionChoiceId)) {
      indices.push(index);
    }
    return indices;
  }, []);

  const actionChoices = actionChoiceIndices.map((index) => allActionChoicesMagic[index]);
  const actionChoiceIds = actionChoiceIndices.map((index) => allActionChoiceIdsMagic[index]);

  if (actionChoices.length !== actionChoicesToUpdate.size || actionChoiceIds.length !== actionChoicesToUpdate.size) {
    console.error("ActionChoiceIds not found");
  } else {
    const tx = await worldActions.editActionChoices(EstforConstants.NONE, actionChoiceIds, actionChoices);
    await tx.wait();
  }

  /*
  {
    const tx = await worldActions.editActionChoices(
      EstforConstants.ACTION_FORGING_ITEM,
      allActionChoiceIdsForging,
      allActionChoicesForging
    );
    await tx.wait();
  } */
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
