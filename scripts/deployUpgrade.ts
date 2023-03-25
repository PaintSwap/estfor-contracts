import {ethers, upgrades} from "hardhat";
import {PlayersLibrary} from "../typechain-types";
import {ITEM_NFT_ADDRESS, PLAYERS_ADDRESS, PLAYERS_LIBRARY_ADDRESS} from "./constants";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Deploying upgradeable contracts with the account: ${owner.address}`);

  const network = await ethers.provider.getNetwork();
  console.log(`ChainId: ${network.chainId}`);

  // Players
  const newPlayersLibrary = false;
  const PlayersLibrary = await ethers.getContractFactory("PlayersLibrary");
  let playerLibrary: PlayersLibrary;
  if (newPlayersLibrary) {
    playerLibrary = await PlayersLibrary.deploy();
    await playerLibrary.deployed();
    console.log(`PlayersLibrary deployed at ${playerLibrary.address.toLowerCase()}`);
  } else {
    playerLibrary = await PlayersLibrary.attach(PLAYERS_LIBRARY_ADDRESS);
  }

  const Players = await ethers.getContractFactory("Players", {
    libraries: {PlayersLibrary: playerLibrary.address},
  });
  const playersAddress = PLAYERS_ADDRESS;
  const players = await upgrades.upgradeProxy(playersAddress, Players, {
    kind: "uups",
    unsafeAllow: ["delegatecall", "external-library-linking"],
  });
  await players.deployed();
  console.log(`Players deployed at ${players.address.toLowerCase()}`);

  /*
  // PlayerNFT
  const PlayerNFT = await ethers.getContractFactory("PlayerNFT");
  const playerNFT = await upgrades.upgradeProxy("PLAYER_NFT_ADDRESS", PlayerNFT, {
    kind: "uups",
  });

  console.log(`Player NFT deployed at ${playerNFT.address.toLowerCase()}`); */

  // ItemNFT
  const ItemNFT = await ethers.getContractFactory("ItemNFT");
  const itemNFT = await upgrades.upgradeProxy(ITEM_NFT_ADDRESS, ItemNFT, {
    kind: "uups",
  });

  console.log(`ItemNFT deployed at ${itemNFT.address.toLowerCase()}`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
