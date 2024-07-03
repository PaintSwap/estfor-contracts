import {ethers, upgrades} from "hardhat";
import {GENERIC_INSTANT_VRF_ACTION_STRATEGY_ADDRESS, INSTANT_VRF_ACTIONS_ADDRESS} from "./contractAddresses";
import {EggInstantVRFActionStrategy} from "../typechain-types";
import {InstantVRFActionType} from "@paintswap/estfor-definitions/types";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(
    `Add instant VRF action strategies using account: ${owner.address} on chain id ${await owner.getChainId()}`
  );

  const instantVRFActions = await ethers.getContractAt("InstantVRFActions", INSTANT_VRF_ACTIONS_ADDRESS);
  /*  const EggInstantVRFActionStrategy = await ethers.getContractFactory("EggInstantVRFActionStrategy");
  const eggInstantVRFActionStrategy = (await upgrades.deployProxy(
    EggInstantVRFActionStrategy,
    [instantVRFActions.address],
    {
      kind: "uups",
    }
  )) as EggInstantVRFActionStrategy;
*/
  await instantVRFActions.addStrategies([InstantVRFActionType.GENERIC], [GENERIC_INSTANT_VRF_ACTION_STRATEGY_ADDRESS]);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
