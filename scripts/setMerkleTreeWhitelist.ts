import {ethers} from "hardhat";
import {MerkleTreeWhitelist} from "./MerkleTreeWhitelist";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Set merkle root for minting whitelist: ${owner.address}`);

  const network = await ethers.provider.getNetwork();
  console.log(`ChainId: ${network.chainId}`);

  // PlayerNFT
  const PlayerNFT = await ethers.getContractFactory("PlayerNFT");
  const playerNFT = await PlayerNFT.attach("0xc461dc373f434622ecb91a43cecb84d777d29b7f");
  await playerNFT.deployed();

  // Calculate the merkle root
  const whitelistAddresses = [owner.address];

  const treeWhitelist = new MerkleTreeWhitelist(whitelistAddresses);
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
