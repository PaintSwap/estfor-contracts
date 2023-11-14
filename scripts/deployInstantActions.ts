// TODO Only needed temporary, can removed after deployed to live network
import {ethers, upgrades} from "hardhat";
import {ITEM_NFT_ADDRESS, PLAYERS_ADDRESS} from "./contractAddresses";

async function main() {
  const [owner] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  console.log(`Deploying instant actions using account: ${owner.address} on chain id ${network.chainId}`);
  const InstantActions = await ethers.getContractFactory("InstantActions");
  const instantActions = await upgrades.deployProxy(InstantActions, [PLAYERS_ADDRESS, ITEM_NFT_ADDRESS], {
    kind: "uups",
  });
  await instantActions.deployed();
  console.log(`instantActions = "${instantActions.address.toLowerCase()}"`);

  const itemNFT = await ethers.getContractAt("ItemNFT", ITEM_NFT_ADDRESS);
  let tx = await itemNFT.setInstantActions(instantActions.address);
  await tx.wait();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
