import {ethers} from "hardhat";
import {PLAYER_NFT_ADDRESS, ESTFOR_LIBRARY_ADDRESS} from "./contractAddresses";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Set player image uri with: ${owner.address} on chain id ${await owner.getChainId()}`);

  const PlayerNFT = await ethers.getContractFactory("PlayerNFT", {
    libraries: {EstforLibrary: ESTFOR_LIBRARY_ADDRESS},
  });
  const playerNFT = await PlayerNFT.attach(PLAYER_NFT_ADDRESS);
  await playerNFT.setImageBaseUri("ipfs://QmY5bwB4212iqziFapqFqUnN6dJk47D3f47HxseW1dX3aX/");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
