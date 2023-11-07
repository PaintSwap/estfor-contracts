import {ethers} from "hardhat";
import {PLAYER_NFT_ADDRESS} from "./contractAddresses";
import {avatarIds, avatarInfos} from "./data/avatars";

async function main() {
  const [owner] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  console.log(`Set avatars on PlayerNFT using account: ${owner.address} on chain id ${network.chainId}`);

  const playerNFT = await ethers.getContractAt("PlayerNFT", PLAYER_NFT_ADDRESS);
  await playerNFT.setAvatars(avatarIds, avatarInfos);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
