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
  const playersAddress = "0x214d683218cb8550290ec3191cc03ed81b7172c6";
  const players = await upgrades.upgradeProxy(playersAddress, Players, {
    kind: "uups",
    unsafeAllow: ["delegatecall", "external-library-linking"],
  });
  await players.deployed();
  console.log(`Players deployed at ${players.address.toLowerCase()}`);

  /*
  // PlayerNFT
  const PlayerNFT = await ethers.getContractFactory("PlayerNFT");
  const playerNFT = await upgrades.upgradeProxy("0xbb417a7d6fd3ad2fbf2195a98d6a1bf55c301108", PlayerNFT, {
    kind: "uups",
  });

  console.log(`Player NFT deployed at ${playerNFT.address.toLowerCase()}`); */

  // PlayerNFT
  const ItemNFT = await ethers.getContractFactory("ItemNFT");
  const itemNFT = await upgrades.upgradeProxy("0x23d689db5ac193afccd387dd6008970302ca0494", ItemNFT, {
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
