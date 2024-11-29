import {ethers} from "hardhat";
import {PET_NFT_ADDRESS} from "./contractAddresses";
import {getChainId} from "./utils";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Set pet base uri with: ${owner.address} on chain id ${await getChainId(owner)}`);

  const petNFT = await ethers.getContractAt("PetNFT", PET_NFT_ADDRESS);
  await petNFT.setImageBaseUri("ipfs://QmYawZvUvkEzF8vjqja24oSSmZv3t6asTpMJBzQJRDGXPs/");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
