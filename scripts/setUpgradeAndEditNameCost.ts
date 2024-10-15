import {ethers} from "hardhat";
import {PLAYER_NFT_ADDRESS} from "./contractAddresses";
import {getChainId, isBeta} from "./utils";
import {parseEther} from "ethers";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(
    `Set upgrade/edit player costs on PlayerNFT using account: ${owner.address} on chain id ${await getChainId(owner)}`,
  );

  const playerNFT = await ethers.getContractAt("PlayerNFT", PLAYER_NFT_ADDRESS);

  {
    const upgradeCost = isBeta ? parseEther("10") : parseEther("1000");
    const tx = await playerNFT.setUpgradeCost(upgradeCost);
    await tx.wait();
  }
  {
    const editNameCost = isBeta ? parseEther("1") : parseEther("500");
    let tx = await playerNFT.setEditNameCost(editNameCost);
    await tx.wait();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
