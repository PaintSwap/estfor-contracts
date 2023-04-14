import {ethers} from "hardhat";
import {MerkleTreeWhitelist} from "./MerkleTreeWhitelist";
import {PLAYER_NFT_ADDRESS, ESTFOR_LIBRARY_ADDRESS} from "./constants";
import {whitelistedSnapshot} from "@paintswap/estfor-definitions/constants";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Set merkle root for minting whitelist: ${owner.address}`);

  const network = await ethers.provider.getNetwork();
  console.log(`ChainId: ${network.chainId}`);

  // PlayerNFT
  const PlayerNFT = await ethers.getContractFactory("PlayerNFT", {
    libraries: {EstforLibrary: ESTFOR_LIBRARY_ADDRESS},
  });
  const playerNFT = await PlayerNFT.attach(PLAYER_NFT_ADDRESS);
  await playerNFT.deployed();

  // Calculate the merkle root
  const treeWhitelist = new MerkleTreeWhitelist(whitelistedSnapshot);
  const root = treeWhitelist.getRoot();
  // Set the merkle root on the nft contract
  await playerNFT.setMerkleRoot(root);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
