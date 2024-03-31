import {ethers} from "hardhat";
import {PLAYER_NFT_ADDRESS} from "./contractAddresses";
import {isBeta} from "./utils";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(
    `Set upgrade/edit player costs on PlayerNFT using account: ${owner.address} on chain id ${await owner.getChainId()}`
  );

  const playerNFT = await ethers.getContractAt("PlayerNFT", PLAYER_NFT_ADDRESS);

  {
    const upgradeCost = isBeta ? ethers.utils.parseEther("10") : ethers.utils.parseEther("1000");
    const tx = await playerNFT.setUpgradeCost(upgradeCost);
    await tx.wait();
  }
  {
    const editNameCost = isBeta ? ethers.utils.parseEther("1") : ethers.utils.parseEther("500");
    let tx = await playerNFT.setEditNameCost(editNameCost);
    await tx.wait();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
