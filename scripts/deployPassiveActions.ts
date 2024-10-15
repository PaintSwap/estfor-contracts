import {ethers, upgrades} from "hardhat";
import {ITEM_NFT_ADDRESS, ITEM_NFT_LIBRARY_ADDRESS, PLAYERS_ADDRESS, WORLD_ADDRESS} from "./contractAddresses";
import {PassiveActions} from "../typechain-types";
import {getChainId, verifyContracts} from "./utils";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Deploy Passive actions using account: ${owner.address} on chain id ${await getChainId(owner)}`);

  const worldLibrary = await ethers.deployContract("WorldLibrary");

  console.log(`worldLibrary = "${(await worldLibrary.getAddress()).toLowerCase()}"`);

  const World = (
    await ethers.getContractFactory("World", {
      libraries: {WorldLibrary: await worldLibrary.getAddress()},
    })
  ).connect(owner);
  const world = await upgrades.upgradeProxy(WORLD_ADDRESS, World, {
    kind: "uups",
    unsafeAllow: ["external-library-linking"],
    timeout: 1000000,
  });
  await world.waitForDeployment();
  console.log(`world = "${(await world.getAddress()).toLowerCase()}"`);

  const PassiveActions = await ethers.getContractFactory("PassiveActions", {
    libraries: {WorldLibrary: await worldLibrary.getAddress()},
  });
  const passiveActions = (await upgrades.deployProxy(
    PassiveActions,
    [PLAYERS_ADDRESS, ITEM_NFT_ADDRESS, WORLD_ADDRESS],
    {
      kind: "uups",
      unsafeAllow: ["delegatecall", "external-library-linking"],
      timeout: 100000,
    },
  )) as unknown as PassiveActions;

  console.log(`passiveActions = "${(await passiveActions.getAddress()).toLowerCase()}"`);

  const ItemNFT = (
    await ethers.getContractFactory("ItemNFT", {libraries: {ItemNFTLibrary: ITEM_NFT_LIBRARY_ADDRESS}})
  ).connect(owner);
  const itemNFT = await upgrades.upgradeProxy(ITEM_NFT_ADDRESS, ItemNFT, {
    kind: "uups",
    unsafeAllow: ["external-library-linking"],
    timeout: 100000,
  });
  await itemNFT.waitForDeployment();
  console.log(`itemNFT = "${(await itemNFT.getAddress()).toLowerCase()}"`);

  let tx = await itemNFT.setPassiveActions(await passiveActions.getAddress());
  await tx.wait();
  console.log("itemNFT setPassiveActions");

  await verifyContracts([await passiveActions.getAddress(), await itemNFT.getAddress()]);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
