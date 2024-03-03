import {ethers} from "hardhat";
import {INSTANT_VRF_ACTIONS_ADDRESS} from "./contractAddresses";
import {EstforConstants} from "@paintswap/estfor-definitions";

// Untested
async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Remove instant vrf actions using account: ${owner.address} on chain id ${await owner.getChainId()}`);

  const instantVRFActions = await ethers.getContractAt("InstantVRFActions", INSTANT_VRF_ACTIONS_ADDRESS);
  await instantVRFActions.removeActions([EstforConstants.INSTANT_VRF_ACTION_FORGING_ORICHALCUM_HELMET]);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
