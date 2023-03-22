import {ethers, upgrades} from "hardhat";
import {PlayerLibrary} from "../typechain-types";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Deploying upgradeable contracts with the account: ${owner.address}`);

  const network = await ethers.provider.getNetwork();
  console.log(`ChainId: ${network.chainId}`);

  // Players
  const newPlayersLibrary = false;
  const PlayerLibrary = await ethers.getContractFactory("PlayerLibrary");
  let playerLibrary: PlayerLibrary;
  if (newPlayersLibrary) {
    playerLibrary = await PlayerLibrary.deploy();
    await playerLibrary.deployed();
    console.log(`PlayerLibrary deployed at ${playerLibrary.address.toLowerCase()}`);
  } else {
    playerLibrary = await PlayerLibrary.attach("0xaaececb8429c524420820cf8d610d7a49dc887d2");
  }

  const Players = await ethers.getContractFactory("Players", {
    libraries: {PlayerLibrary: playerLibrary.address},
  });
  const playersAddress = "0x8958e25967d36e2f8d79f0991c7ac5a34d54ea8b";
  const players = await upgrades.upgradeProxy(playersAddress, Players, {
    kind: "uups",
    unsafeAllow: ["delegatecall", "external-library-linking"],
  });
  await players.deployed();
  console.log(`Players deployed at ${players.address.toLowerCase()}`);
  /*
  // PlayerNFT
  const PlayerNFT = await ethers.getContractFactory("PlayerNFT");
  const playerNFT = await upgrades.upgradeProxy("0xa7bfb7cf00762043765701d06ac4a8f338ded25a", PlayerNFT, {
    kind: "uups",
  });

  console.log(`Player NFT deployed at ${playerNFT.address.toLowerCase()}`); */
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
