import {ethers} from "hardhat";
import {GENERIC_INSTANT_VRF_ACTION_STRATEGY_ADDRESS, INSTANT_VRF_ACTIONS_ADDRESS} from "./contractAddresses";
import {InstantVRFActionType} from "@paintswap/estfor-definitions/types";
import {getChainId} from "./utils";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(
    `Add instant VRF action strategies using account: ${owner.address} on chain id ${await getChainId(owner)}`
  );

  const instantVRFActions = await ethers.getContractAt("InstantVRFActions", INSTANT_VRF_ACTIONS_ADDRESS);
  /*  const EggInstantVRFActionStrategy = await ethers.getContractFactory("EggInstantVRFActionStrategy");
  const eggInstantVRFActionStrategy = (await upgrades.deployProxy(
    EggInstantVRFActionStrategy,
    [(await instantVRFActions.getAddress())],
    {
      kind: "uups",
    }
  )) as unknown as EggInstantVRFActionStrategy;
*/
  await instantVRFActions.addStrategies([InstantVRFActionType.GENERIC], [GENERIC_INSTANT_VRF_ACTION_STRATEGY_ADDRESS]);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
