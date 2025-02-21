import {ethers} from "hardhat";
import {ACTIVITY_POINTS_ADDRESS, ITEM_NFT_ADDRESS} from "./contractAddresses";
import {getChainId} from "./utils";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Add items using account: ${owner.address} on chain id ${await getChainId(owner)}`);

  const itemNFT = await ethers.getContractAt("ItemNFT", ITEM_NFT_ADDRESS);
  await itemNFT.setApproved([ACTIVITY_POINTS_ADDRESS], true);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
