import {ethers, upgrades} from "hardhat";
import {INSTANT_VRF_ACTIONS_ADDRESS, ITEM_NFT_ADDRESS} from "./contractAddresses";
import {EstforConstants} from "@paintswap/estfor-definitions";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Deploying instant VRF actions using account: ${owner.address} on chain id ${await owner.getChainId()}`);

  const InstantVRFActions = (await ethers.getContractFactory("InstantVRFActions")).connect(owner);
  const instantVRFActions = await upgrades.upgradeProxy(INSTANT_VRF_ACTIONS_ADDRESS, InstantVRFActions, {
    kind: "uups",
    timeout: 600 * 1000, // 10 minutes
  });
  await instantVRFActions.deployed();
  console.log(`instantVRFActions = "${instantVRFActions.address.toLowerCase()}"`);

  const itemNFT = await ethers.getContractAt("ItemNFT", ITEM_NFT_ADDRESS);
  let tx = await itemNFT.connect(owner).testMint(owner.address, EstforConstants.BLANK_ORICHALCUM_HELMET, 1);
  tx.wait();

  const playerId = 1;
  tx = await instantVRFActions
    .connect(owner)
    .doInstantVRFActions(playerId, [EstforConstants.INSTANT_VRF_ACTION_FORGING_ORICHALCUM_HELMET], [1], {
      value: await instantVRFActions.requestCost(1),
    });
  await tx.wait();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});