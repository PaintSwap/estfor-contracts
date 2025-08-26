import {ethers} from "hardhat";
import {ITEM_NFT_ADDRESS} from "./contractAddresses";
import {getChainId} from "./utils";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Set itemNFT base uri with: ${owner.address} on chain id ${await getChainId(owner)}`);

  const itemNFT = await ethers.getContractAt("ItemNFT", ITEM_NFT_ADDRESS);
  await itemNFT.setBaseURI("ipfs://bafybeic53fzh4owvyz3uiex32es3bawcbyxfkn3lmj3prlpj4xup2sxkfm/");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
