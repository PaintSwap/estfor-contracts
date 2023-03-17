import {ethers} from "hardhat";
import {MerkleTreeWhitelist} from "./MerkleTreeWhitelist";
import alphaSnapShotAddresses from "../whitelist/alpha_snapshot.json";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Set merkle root for minting whitelist: ${owner.address}`);

  const network = await ethers.provider.getNetwork();
  console.log(`ChainId: ${network.chainId}`);

  // PlayerNFT
  const PlayerNFT = await ethers.getContractFactory("PlayerNFT");
  const playerNFT = await PlayerNFT.attach("TODO");
  await playerNFT.deployed();

  // Calculate the merkle root
  const whitelistAddresses = alphaSnapShotAddresses.map((el) => ethers.utils.getAddress(el.address));
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
