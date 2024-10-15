import {ethers} from "hardhat";
import {PET_NFT_ADDRESS} from "./contractAddresses";
import {getChainId} from "./utils";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Set pet base uri with: ${owner.address} on chain id ${await getChainId(owner)}`);

  const petNFT = await ethers.getContractAt("PetNFT", PET_NFT_ADDRESS);
  await petNFT.setImageBaseUri("ipfs://QmPRfTmkPj6TzfTZf4S6qrmawEdbKMmMy7xhzYCLbGp5AJ/");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
