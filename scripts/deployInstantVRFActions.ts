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
import {getChainId, verifyContracts} from "./utils";

const timeout = 600 * 1000; // 10 minutes

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Deploying instant VRF test data using account: ${owner.address} on chain id ${await getChainId(owner)}`);

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
    },
  )) as unknown as InstantVRFActions;

  console.log(`instantVRFActions = "${(await instantVRFActions.getAddress()).toLowerCase()}"`);

  const GenericInstantVRFActionStrategy = await ethers.getContractFactory("GenericInstantVRFActionStrategy");
  const genericInstantVRFActionStrategy = (await upgrades.deployProxy(
    GenericInstantVRFActionStrategy,
    [await instantVRFActions.getAddress()],
    {
      kind: "uups",
    },
  )) as unknown as GenericInstantVRFActionStrategy;
  console.log(
    `genericInstantVRFActionStrategy = "${(await genericInstantVRFActionStrategy.getAddress()).toLowerCase()}"`,
  );

  const EggInstantVRFActionStrategy = await ethers.getContractFactory("EggInstantVRFActionStrategy");
  const eggInstantVRFActionStrategy = (await upgrades.deployProxy(
    EggInstantVRFActionStrategy,
    [await instantVRFActions.getAddress()],
    {
      kind: "uups",
    },
  )) as unknown as EggInstantVRFActionStrategy;
  console.log(`eggInstantVRFActionStrategy = "${(await eggInstantVRFActionStrategy.getAddress()).toLowerCase()}"`);

  let tx = await instantVRFActions.addStrategies(
    [InstantVRFActionType.GENERIC, InstantVRFActionType.FORGING, InstantVRFActionType.EGG],
    [
      await genericInstantVRFActionStrategy.getAddress(),
      await genericInstantVRFActionStrategy.getAddress(),
      await eggInstantVRFActionStrategy.getAddress(),
    ],
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
  tx = await itemNFT.setInstantVRFActions(await instantVRFActions.getAddress());
  await tx.wait();
  console.log("itemNFT setInstantVRFActions");

  const petNFT = (await ethers.getContractAt("PetNFT", PET_NFT_ADDRESS)) as PetNFT;
  tx = await petNFT.setInstantVRFActions(await instantVRFActions.getAddress());
  await tx.wait();
  console.log("petNFT setInstantVRFActions");

  await verifyContracts([
    await instantVRFActions.getAddress(),
    await genericInstantVRFActionStrategy.getAddress(),
    await eggInstantVRFActionStrategy.getAddress(),
  ]);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
