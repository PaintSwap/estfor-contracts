import {ethers, upgrades} from "hardhat";
import {BAZAAR_ADDRESS, ITEM_NFT_ADDRESS, ITEM_NFT_LIBRARY_ADDRESS} from "./contractAddresses";
import {getChainId} from "./utils";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Set bazaar using account: ${owner.address} on chain ${await getChainId(owner)}`);

  const timeout = 600 * 1000; // 10 minutes

  const ItemNFT = await ethers.getContractFactory("ItemNFT", {libraries: {ItemNFTLibrary: ITEM_NFT_LIBRARY_ADDRESS}});
  const itemNFT = await upgrades.upgradeProxy(ITEM_NFT_ADDRESS, ItemNFT, {
    kind: "uups",
    unsafeAllow: ["external-library-linking"],
    timeout,
  });

  await itemNFT.setBazaar(BAZAAR_ADDRESS);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
