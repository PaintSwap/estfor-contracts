import {ethers} from "hardhat";
import {ITEM_NFT_ADDRESS} from "./contractAddresses";
import {getChainId} from "./utils";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Set base uri with: ${owner.address} on chain id ${await getChainId(owner)}`);

  const itemNFT = await ethers.getContractAt("ItemNFT", ITEM_NFT_ADDRESS);
  await itemNFT.setBaseURI("ipfs://bafybeiaixhwqaftfbaeytp2sx6pupmglxlrx7om7qlkkzl57o7hbvfrmom/");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
