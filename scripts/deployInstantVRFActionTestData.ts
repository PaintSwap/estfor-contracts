import {ethers} from "hardhat";
import {INSTANT_VRF_ACTIONS_ADDRESS, ITEM_NFT_ADDRESS} from "./contractAddresses";
import {EstforConstants} from "@paintswap/estfor-definitions";
import {InstantVRFActions} from "../typechain-types";
import {getChainId} from "./utils";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Deploying instant VRF test data using account: ${owner.address} on chain id ${await getChainId(owner)}`);

  const instantVRFActions = (await ethers.getContractAt(
    "InstantVRFActions",
    INSTANT_VRF_ACTIONS_ADDRESS
  )) as InstantVRFActions;

  const amount = 64;
  const itemNFT = await ethers.getContractAt("ItemNFT", ITEM_NFT_ADDRESS);
  let tx = await itemNFT.mintBatch(
    owner.address,
    [
      EstforConstants.SECRET_EGG_1_TIER3,
      EstforConstants.SECRET_EGG_2_TIER3,
      EstforConstants.SECRET_EGG_3_TIER3,
      EstforConstants.SECRET_EGG_4_TIER3,
      EstforConstants.EGG_TIER3
    ],
    [12, 12, 12, 12, 16]
  );
  await tx.wait();
  console.log("test Mint");

  const playerId = 1;
  tx = await instantVRFActions.doInstantVRFActions(
    playerId,
    [
      EstforConstants.INSTANT_VRF_ACTION_SECRET_EGG_1_TIER3,
      EstforConstants.INSTANT_VRF_ACTION_SECRET_EGG_2_TIER3,
      EstforConstants.INSTANT_VRF_ACTION_SECRET_EGG_3_TIER3,
      EstforConstants.INSTANT_VRF_ACTION_SECRET_EGG_4_TIER3,
      EstforConstants.INSTANT_VRF_ACTION_EGG_TIER3
    ],
    [12, 12, 12, 12, 16],
    {
      value: await instantVRFActions.requestCost(amount)
    }
  );
  await tx.wait();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
