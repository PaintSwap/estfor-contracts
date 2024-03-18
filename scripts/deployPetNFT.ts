import {ethers, upgrades} from "hardhat";
import {
  ADMIN_ACCESS_ADDRESS,
  BRUSH_ADDRESS,
  PET_NFT_ADDRESS,
  PLAYERS_ADDRESS,
  ROYALTY_RECEIVER_ADDRESS,
} from "./contractAddresses";
import {isBeta} from "./utils";
import {PetNFT} from "../typechain-types";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Set PetNFT on Players using account: ${owner.address} on chain id ${await owner.getChainId()}`);

  const petImageBaseUri = isBeta ? "ipfs://TODO" : "ipfs://TODO";
  const timeout = 600 * 1000; // 10 minutes
  const PetNFT = await ethers.getContractFactory("PetNFT");
  const petNFT = (await upgrades.deployProxy(
    PetNFT,
    [BRUSH_ADDRESS, ROYALTY_RECEIVER_ADDRESS, petImageBaseUri, ADMIN_ACCESS_ADDRESS, isBeta],
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
  tx = await players.setPetNFT(PET_NFT_ADDRESS);
  await tx.wait();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
