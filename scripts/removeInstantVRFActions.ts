import {ethers} from "hardhat";
import {INSTANT_VRF_ACTIONS_ADDRESS} from "./contractAddresses";
import {allInstantVRFActions} from "./data/instantVRFActions";
import {getChainId} from "./utils";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Remove instant vrf actions using account: ${owner.address} on chain id ${await getChainId(owner)}`);

  const instantVRFActions = await ethers.getContractAt("InstantVRFActions", INSTANT_VRF_ACTIONS_ADDRESS);
  const actions = allInstantVRFActions.map((action) => action.actionId);
  const tx = await instantVRFActions.removeActions(actions);
  await tx.wait();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
