import {ethers, upgrades} from "hardhat";
import {INSTANT_VRF_ACTIONS_ADDRESS, ITEM_NFT_ADDRESS} from "./contractAddresses";
import {EstforConstants} from "@paintswap/estfor-definitions";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(
    `Deploying instant VRF test data using account: ${owner.address} on chain id ${await owner.getChainId()}`
  );

  const instantVRFActions = await ethers.getContractAt("InstantVRFActions", INSTANT_VRF_ACTIONS_ADDRESS);

  const itemNFT = await ethers.getContractAt("ItemNFT", ITEM_NFT_ADDRESS);
  let tx = await itemNFT.connect(owner).testMint(owner.address, EstforConstants.SECRET_EGG_1_TIER4, 1);
  await tx.wait();
  console.log("test Mint");

  const playerId = 1;
  tx = await instantVRFActions
    .connect(owner)
    .doInstantVRFActions(playerId, [EstforConstants.INSTANT_VRF_ACTION_SECRET_EGG_1_TIER4], [1], {
      value: await instantVRFActions.requestCost(1),
    });
  await tx.wait();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
