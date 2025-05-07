import {ethers} from "hardhat";
import {ITEM_NFT_ADDRESS} from "./contractAddresses";
import {getChainId} from "./utils";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Set itemNFT base uri with: ${owner.address} on chain id ${await getChainId(owner)}`);

  const itemNFT = await ethers.getContractAt("ItemNFT", ITEM_NFT_ADDRESS);
  await itemNFT.setBaseURI("ipfs://bafybeicu2d3fmeqaga476yafr2fgrdlktclhluuwdqkt6vvmnzdfjm2ise/");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
