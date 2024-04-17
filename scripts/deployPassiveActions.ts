import {ethers, upgrades} from "hardhat";
import {ITEM_NFT_ADDRESS, ITEM_NFT_LIBRARY_ADDRESS, PLAYERS_ADDRESS, WORLD_ADDRESS} from "./contractAddresses";
import {PassiveActions} from "../typechain-types";
import {verifyContracts} from "./utils";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Deploy Passive actions using account: ${owner.address} on chain id ${await owner.getChainId()}`);

  const worldLibrary = await ethers.deployContract("WorldLibrary");
  await worldLibrary.deployed();
  console.log(`worldLibrary = "${worldLibrary.address.toLowerCase()}"`);

  const World = (
    await ethers.getContractFactory("World", {
      libraries: {WorldLibrary: worldLibrary.address},
    })
  ).connect(owner);
  const world = await upgrades.upgradeProxy(WORLD_ADDRESS, World, {
    kind: "uups",
    unsafeAllow: ["external-library-linking"],
    timeout: 1000000,
  });
  await world.deployed();
  console.log(`world = "${world.address.toLowerCase()}"`);

  const PassiveActions = await ethers.getContractFactory("PassiveActions", {
    libraries: {WorldLibrary: worldLibrary.address},
  });
  const passiveActions = (await upgrades.deployProxy(
    PassiveActions,
    [PLAYERS_ADDRESS, ITEM_NFT_ADDRESS, WORLD_ADDRESS],
    {
      kind: "uups",
      unsafeAllow: ["delegatecall", "external-library-linking"],
      timeout: 100000,
    }
  )) as PassiveActions;
  await passiveActions.deployed();
  console.log(`passiveActions = "${passiveActions.address.toLowerCase()}"`);

  const ItemNFT = (
    await ethers.getContractFactory("ItemNFT", {libraries: {ItemNFTLibrary: ITEM_NFT_LIBRARY_ADDRESS}})
  ).connect(owner);
  const itemNFT = await upgrades.upgradeProxy(ITEM_NFT_ADDRESS, ItemNFT, {
    kind: "uups",
    unsafeAllow: ["external-library-linking"],
    timeout: 100000,
  });
  await itemNFT.deployed();
  console.log(`itemNFT = "${itemNFT.address.toLowerCase()}"`);

  let tx = await itemNFT.setPassiveActions(passiveActions.address);
  await tx.wait();
  console.log("itemNFT setPassiveActions");

  await verifyContracts([passiveActions.address, itemNFT.address]);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
