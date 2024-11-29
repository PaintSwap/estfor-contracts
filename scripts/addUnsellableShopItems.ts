import {ethers} from "hardhat";
import {SHOP_ADDRESS} from "./contractAddresses";
import {EstforConstants} from "@paintswap/estfor-definitions";
import {getChainId} from "./utils";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Add unsellable shop items using account: ${owner.address} on chain id ${await getChainId(owner)}`);

  const shop = await ethers.getContractAt("Shop", SHOP_ADDRESS);

  const items = [
    EstforConstants.KRAGSTYR_EGG_TIER1,
    EstforConstants.KRAGSTYR_EGG_TIER2,
    EstforConstants.KRAGSTYR_EGG_TIER3,
    EstforConstants.KRAGSTYR_EGG_TIER4,
    EstforConstants.KRAGSTYR_EGG_TIER5,
    EstforConstants.KEPHRI_AMULET,
    EstforConstants.RING_OF_TUR,
    EstforConstants.TRICK_CHEST2024,
    EstforConstants.TREAT_CHEST2024,
    EstforConstants.TRICK_OR_TREAT_KEY
  ];

  await shop.addUnsellableItems(items);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
