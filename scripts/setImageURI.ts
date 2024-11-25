import {ethers} from "hardhat";
import {PLAYER_NFT_ADDRESS} from "./contractAddresses";
import {getChainId} from "./utils";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Set player image uri with: ${owner.address} on chain id ${await getChainId(owner)}`);

  const playerNFT = await ethers.getContractAt("PlayerNFT", PLAYER_NFT_ADDRESS);
  await playerNFT.setImageBaseUri("ipfs://QmY5bwB4212iqziFapqFqUnN6dJk47D3f47HxseW1dX3aX/");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
