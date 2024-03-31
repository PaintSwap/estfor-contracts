import {ethers, upgrades} from "hardhat";
import {
  ADMIN_ACCESS_ADDRESS,
  BRUSH_ADDRESS,
  DEV_ADDRESS,
  ESTFOR_LIBRARY_ADDRESS,
  INSTANT_VRF_ACTIONS_ADDRESS,
  PLAYERS_ADDRESS,
  ROYALTY_RECEIVER_ADDRESS,
} from "./contractAddresses";
import {isBeta} from "./utils";
import {PetNFT, EggInstantVRFActionStrategy} from "../typechain-types";
import {InstantVRFActionType} from "@paintswap/estfor-definitions/types";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Deploy PetNFT using account: ${owner.address} on chain id ${await owner.getChainId()}`);

  const petImageBaseUri = isBeta
    ? "ipfs://QmcLcqcYwPRcTeBRaX8BtfDCpwZSrNzt22z5gAG3CRXTw7/"
    : "ipfs://Qma93THZoAXmPR4Ug3JHmJxf3CYch3CxdAPipsxA5NGxsR/";
  const timeout = 600 * 1000; // 10 minutes

  const editPetNameBrushPrice = isBeta ? ethers.utils.parseEther("1") : ethers.utils.parseEther("100");
  const PetNFT = await ethers.getContractFactory("PetNFT", {libraries: {EstforLibrary: ESTFOR_LIBRARY_ADDRESS}});
  const petNFT = (await upgrades.deployProxy(
    PetNFT,
    [
      BRUSH_ADDRESS,
      ROYALTY_RECEIVER_ADDRESS,
      petImageBaseUri,
      DEV_ADDRESS,
      editPetNameBrushPrice,
      ADMIN_ACCESS_ADDRESS,
      isBeta,
    ],
    {
      kind: "uups",
      unsafeAllow: ["delegatecall", "external-library-linking"],
      timeout,
    }
  )) as PetNFT;
  await petNFT.deployed();
  console.log(`petNFT = "${petNFT.address.toLowerCase()}"`);

  let tx = await petNFT.setPlayers(PLAYERS_ADDRESS);
  await tx.wait();
  console.log("petNFT setPlayers");

  const players = await ethers.getContractAt("Players", PLAYERS_ADDRESS);
  tx = await players.setPetNFT(petNFT.address);
  await tx.wait();
  console.log("Players setPetNFT");

  const instantVRFActions = await ethers.getContractAt("InstantVRFActions", INSTANT_VRF_ACTIONS_ADDRESS);
  tx = await instantVRFActions.setPetNFT(petNFT.address);
  await tx.wait();
  console.log("InstantVRFActions setPetNFT");

  tx = await petNFT.setInstantVRFActions(instantVRFActions.address);
  await tx.wait();
  console.log("petNFT setInstantVRFActions");

  const EggInstantVRFActionStrategy = await ethers.getContractFactory("EggInstantVRFActionStrategy");
  const eggInstantVRFActionStrategy = (await upgrades.deployProxy(
    EggInstantVRFActionStrategy,
    [instantVRFActions.address],
    {
      kind: "uups",
    }
  )) as EggInstantVRFActionStrategy;
  await eggInstantVRFActionStrategy.deployed();
  console.log("eggInstantVRFActionStrategy = ", eggInstantVRFActionStrategy.address);

  tx = await instantVRFActions.addStrategies([InstantVRFActionType.EGG], [eggInstantVRFActionStrategy.address]);
  await tx.wait();
  console.log("InstantVRFActions addStrategies");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
