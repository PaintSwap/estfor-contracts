import {ethers} from "hardhat";
import {PET_NFT_ADDRESS} from "./contractAddresses";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Set pet base uri with: ${owner.address} on chain id ${await owner.getChainId()}`);

  const petNFT = await ethers.getContractAt("PetNFT", PET_NFT_ADDRESS);
  await petNFT.setImageBaseUri("ipfs://QmPp8cAsVKA8PduHR4suA7GNKKyh5R4ADyyjGobwmUiUEv/");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
