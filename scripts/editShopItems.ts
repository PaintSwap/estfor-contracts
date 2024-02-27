import {ethers} from "hardhat";
import {SHOP_ADDRESS} from "./contractAddresses";
import {EstforConstants} from "@paintswap/estfor-definitions";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Edit shop items using account: ${owner.address} on chain id ${await owner.getChainId()}`);

  const shop = await ethers.getContractAt("Shop", SHOP_ADDRESS);
  await shop.editItems([
    {price: ethers.utils.parseEther("500"), tokenId: EstforConstants.PROTECTION_SHIELD},
    {price: ethers.utils.parseEther("250"), tokenId: EstforConstants.SHARPENED_CLAW},
  ]);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
