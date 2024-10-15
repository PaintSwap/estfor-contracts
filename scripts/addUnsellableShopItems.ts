import {ethers} from "hardhat";
import {SHOP_ADDRESS} from "./contractAddresses";
import {EstforConstants} from "@paintswap/estfor-definitions";
import {getChainId} from "./utils";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Add unsellable shop items using account: ${owner.address} on chain id ${await getChainId(owner)}`);

  const shop = (await ethers.getContractAt("Shop", SHOP_ADDRESS)).connect(owner);

  const items = [
    EstforConstants.ANNIV1_CHEST,
    EstforConstants.ANNIV1_RING,
    EstforConstants.ANNIV1_EGG_TIER1,
    EstforConstants.ANNIV1_EGG_TIER2,
    EstforConstants.ANNIV1_EGG_TIER3,
    EstforConstants.ANNIV1_EGG_TIER4,
    EstforConstants.ANNIV1_EGG_TIER5,
    EstforConstants.ANNIV1_KEY,
  ];

  await shop.addUnsellableItems(items);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
