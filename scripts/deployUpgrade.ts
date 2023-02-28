import {ethers, upgrades} from "hardhat";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Deploying upgradeable contracts with the account: ${owner.address}`);

  const network = await ethers.provider.getNetwork();
  console.log(`ChainId: ${network.chainId}`);

  // Players
  const PlayerLibrary = await ethers.getContractFactory("PlayerLibrary");
  const playerLibrary = await PlayerLibrary.deploy();
  await playerLibrary.deployed();
  console.log(`PlayerLibrary deployed at ${playerLibrary.address.toLowerCase()}`);

  const Players = await ethers.getContractFactory("Players", {
    libraries: {PlayerLibrary: playerLibrary.address},
  });
  const playersAddress = "0x4e6736c52c2cca692a97201fdc63d9bfce4dd315";
  const players = await upgrades.upgradeProxy(playersAddress, Players, {
    kind: "uups",
    unsafeAllow: ["delegatecall", "external-library-linking"],
  });
  await players.deployed();
  console.log(`Players deployed at ${players.address.toLowerCase()}`);

  // PlayerNFT
  const PlayerNFT = await ethers.getContractFactory("PlayerNFT");
  const playerNFT = await upgrades.upgradeProxy("0xc461dc373f434622ecb91a43cecb84d777d29b7f", PlayerNFT, {
    kind: "uups",
  });

  console.log(`Player NFT deployed at ${playerNFT.address.toLowerCase()}`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
