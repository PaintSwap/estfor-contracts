import {ethers, upgrades} from "hardhat";
import {
  ITEM_NFT_ADDRESS,
  ORACLE_ADDRESS,
  PET_NFT_ADDRESS,
  PLAYERS_ADDRESS,
  SAMWITCH_VRF_ADDRESS,
  VRF_REQUEST_INFO_ADDRESS,
} from "./contractAddresses";
import {
  EggInstantVRFActionStrategy,
  GenericInstantVRFActionStrategy,
  InstantVRFActions,
  ItemNFT,
  PetNFT,
} from "../typechain-types";
import {InstantVRFActionType} from "@paintswap/estfor-definitions/types";
import {allInstantVRFActions} from "./data/instantVRFActions";
import {verifyContracts} from "./utils";

const timeout = 600 * 1000; // 10 minutes

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(
    `Deploying instant VRF test data using account: ${owner.address} on chain id ${await owner.getChainId()}`
  );

  const InstantVRFActions = await ethers.getContractFactory("InstantVRFActions");
  const instantVRFActions = (await upgrades.deployProxy(
    InstantVRFActions,
    [
      PLAYERS_ADDRESS,
      ITEM_NFT_ADDRESS,
      PET_NFT_ADDRESS,
      ORACLE_ADDRESS,
      SAMWITCH_VRF_ADDRESS,
      VRF_REQUEST_INFO_ADDRESS,
    ],
    {
      kind: "uups",
      timeout,
    }
  )) as InstantVRFActions;
  await instantVRFActions.deployed();
  console.log(`instantVRFActions = "${instantVRFActions.address.toLowerCase()}"`);

  const GenericInstantVRFActionStrategy = await ethers.getContractFactory("GenericInstantVRFActionStrategy");
  const genericInstantVRFActionStrategy = (await upgrades.deployProxy(
    GenericInstantVRFActionStrategy,
    [instantVRFActions.address],
    {
      kind: "uups",
    }
  )) as GenericInstantVRFActionStrategy;
  console.log(`genericInstantVRFActionStrategy = "${genericInstantVRFActionStrategy.address.toLowerCase()}"`);

  const EggInstantVRFActionStrategy = await ethers.getContractFactory("EggInstantVRFActionStrategy");
  const eggInstantVRFActionStrategy = (await upgrades.deployProxy(
    EggInstantVRFActionStrategy,
    [instantVRFActions.address],
    {
      kind: "uups",
    }
  )) as EggInstantVRFActionStrategy;
  console.log(`eggInstantVRFActionStrategy = "${eggInstantVRFActionStrategy.address.toLowerCase()}"`);

  let tx = await instantVRFActions.addStrategies(
    [InstantVRFActionType.GENERIC, InstantVRFActionType.FORGING, InstantVRFActionType.EGG],
    [
      genericInstantVRFActionStrategy.address,
      genericInstantVRFActionStrategy.address,
      eggInstantVRFActionStrategy.address,
    ]
  );
  await tx.wait();
  console.log("instantVRFActions.addStrategies");

  // Add instant vrf actions
  const chunkSize = 50;
  for (let i = 0; i < allInstantVRFActions.length; i += chunkSize) {
    const chunk = allInstantVRFActions.slice(i, i + chunkSize);
    const tx = await instantVRFActions.addActions(chunk);
    await tx.wait();
    console.log("Add instant vrf actions chunk ", i);
  }

  const itemNFT = (await ethers.getContractAt("ItemNFT", ITEM_NFT_ADDRESS)) as ItemNFT;
  tx = await itemNFT.setInstantVRFActions(instantVRFActions.address);
  await tx.wait();
  console.log("itemNFT setInstantVRFActions");

  const petNFT = (await ethers.getContractAt("PetNFT", PET_NFT_ADDRESS)) as PetNFT;
  tx = await petNFT.setInstantVRFActions(instantVRFActions.address);
  await tx.wait();
  console.log("petNFT setInstantVRFActions");

  await verifyContracts([
    instantVRFActions.address,
    genericInstantVRFActionStrategy.address,
    eggInstantVRFActionStrategy.address,
  ]);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
