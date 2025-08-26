import {ethers} from "hardhat";
import {PET_NFT_ADDRESS} from "./contractAddresses";
import {getChainId} from "./utils";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Set pet base uri with: ${owner.address} on chain id ${await getChainId(owner)}`);

  const petNFT = await ethers.getContractAt("PetNFT", PET_NFT_ADDRESS);
  await petNFT.setImageBaseUri("ipfs://bafybeieb5stxb5fdxubvfwdv6vf5x3xkws54ws3e5popvmo3t4knrddv5u/");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
