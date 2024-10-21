import {ethers, upgrades} from "hardhat";
import {
  ADMIN_ACCESS_ADDRESS,
  BRUSH_ADDRESS,
  DEV_ADDRESS,
  ESTFOR_LIBRARY_ADDRESS,
  INSTANT_VRF_ACTIONS_ADDRESS,
  PLAYERS_ADDRESS,
  ROYALTY_RECEIVER_ADDRESS,
  TREASURY_ADDRESS
} from "./contractAddresses";
import {getChainId, isBeta} from "./utils";
import {PetNFT, EggInstantVRFActionStrategy} from "../typechain-types";
import {InstantVRFActionType} from "@paintswap/estfor-definitions/types";
import {parseEther} from "ethers";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Deploy PetNFT using account: ${owner.address} on chain id ${await getChainId(owner)}`);

  const petImageBaseUri = isBeta
    ? "ipfs://QmPp8cAsVKA8PduHR4suA7GNKKyh5R4ADyyjGobwmUiUEv/"
    : "ipfs://QmbKhQHaUWSsPUTHwTUdSDbkT4HoMzF3PBYxYfLSw4YJSC/";
  const timeout = 600 * 1000; // 10 minutes

  const editPetNameBrushPrice = isBeta ? parseEther("1") : parseEther("1");

  const petNFTLibrary = await ethers.deployContract("PetNFTLibrary");

  console.log(`petNFTLibrary = "${(await petNFTLibrary.getAddress()).toLowerCase()}"`);

  const PetNFT = await ethers.getContractFactory("PetNFT", {
    libraries: {EstforLibrary: ESTFOR_LIBRARY_ADDRESS, PetNFTLibrary: await petNFTLibrary.getAddress()}
  });
  const petNFT = (await upgrades.deployProxy(
    PetNFT,
    [
      BRUSH_ADDRESS,
      ROYALTY_RECEIVER_ADDRESS,
      petImageBaseUri,
      DEV_ADDRESS,
      editPetNameBrushPrice,
      TREASURY_ADDRESS,
      ADMIN_ACCESS_ADDRESS,
      isBeta
    ],
    {
      kind: "uups",
      unsafeAllow: ["delegatecall", "external-library-linking"],
      timeout
    }
  )) as unknown as PetNFT;

  console.log(`petNFT = "${(await petNFT.getAddress()).toLowerCase()}"`);

  let tx = await petNFT.setPlayers(PLAYERS_ADDRESS);
  await tx.wait();
  console.log("petNFT setPlayers");

  const players = await ethers.getContractAt("Players", PLAYERS_ADDRESS);
  //  tx = await players.setPetNFT((await petNFT.getAddress()));
  //  await tx.wait();
  //  console.log("Players setPetNFT");

  const instantVRFActions = await ethers.getContractAt("InstantVRFActions", INSTANT_VRF_ACTIONS_ADDRESS);
  tx = await instantVRFActions.setPetNFT(await petNFT.getAddress());
  await tx.wait();
  console.log("InstantVRFActions setPetNFT");
  tx = await instantVRFActions.setGasCostPerUnit(15_000);
  await tx.wait();
  console.log("InstantVRFActions setGasCostPerUnit");

  tx = await petNFT.setInstantVRFActions(await instantVRFActions.getAddress());
  await tx.wait();
  console.log("petNFT setInstantVRFActions");

  const EggInstantVRFActionStrategy = await ethers.getContractFactory("EggInstantVRFActionStrategy");
  const eggInstantVRFActionStrategy = (await upgrades.deployProxy(
    EggInstantVRFActionStrategy,
    [await instantVRFActions.getAddress()],
    {
      kind: "uups"
    }
  )) as unknown as EggInstantVRFActionStrategy;

  console.log(`eggInstantVRFActionStrategy = "${(await eggInstantVRFActionStrategy.getAddress()).toLowerCase()}"`);

  tx = await instantVRFActions.addStrategies(
    [InstantVRFActionType.EGG],
    [await eggInstantVRFActionStrategy.getAddress()]
  );
  await tx.wait();
  console.log("InstantVRFActions addStrategies");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
