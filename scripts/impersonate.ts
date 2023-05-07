import {ethers, upgrades} from "hardhat";
import {
  PLAYERS_ADDRESS,
  PLAYERS_IMPL_MISC_ADDRESS,
  PLAYERS_IMPL_PROCESS_ACTIONS_ADDRESS,
  PLAYERS_IMPL_QUEUE_ACTIONS_ADDRESS,
  PLAYERS_IMPL_REWARDS_ADDRESS,
  PLAYERS_LIBRARY_ADDRESS,
  PLAYER_NFT_ADDRESS,
} from "./contractAddresses";
import {EstforTypes} from "@paintswap/estfor-definitions";

// When you need to fork a chain and debug
async function main() {
  const network = await ethers.provider.getNetwork();
  console.log(`ChainId: ${network.chainId}`);

  // Players
  const PlayersLibrary = await ethers.getContractFactory("PlayersLibrary");
  const playerLibrary = await PlayersLibrary.deploy();

  const owner = await ethers.getImpersonatedSigner("0x316342122A9ae36de41B231260579b92F4C8Be7f");
  const player = await ethers.getImpersonatedSigner("0xa801864d0D24686B15682261aa05D4e1e6e5BD94");

  // Set the implementations
  let Players = await ethers.getContractFactory("Players", {
    libraries: {PlayersLibrary: playerLibrary.address},
  });
  Players = Players.connect(owner);
  const players = await upgrades.upgradeProxy(PLAYERS_ADDRESS, Players, {
    kind: "uups",
    unsafeAllow: ["delegatecall", "external-library-linking"],
  });

  const PlayersImplQueueActions = await ethers.getContractFactory("PlayersImplQueueActions", {
    libraries: {PlayersLibrary: playerLibrary.address},
  });
  const playersImplQueueActions = await PlayersImplQueueActions.deploy();
  console.log(`playersImplQueueActions = "${playersImplQueueActions.address.toLowerCase()}"`);
  await playersImplQueueActions.deployed();

  const PlayersImplProcessActions = await ethers.getContractFactory("PlayersImplProcessActions", {
    libraries: {PlayersLibrary: playerLibrary.address},
  });
  const playersImplProcessActions = await PlayersImplProcessActions.deploy();
  console.log(`playersImplProcessActions = "${playersImplProcessActions.address.toLowerCase()}"`);
  await playersImplProcessActions.deployed();

  const PlayersImplRewards = await ethers.getContractFactory("PlayersImplRewards", {
    libraries: {PlayersLibrary: playerLibrary.address},
  });
  const playersImplRewards = await PlayersImplRewards.deploy();
  console.log(`playersImplRewards = "${playersImplRewards.address.toLowerCase()}"`);
  await playersImplRewards.deployed();

  const PlayersImplMisc = await ethers.getContractFactory("PlayersImplMisc", {
    libraries: {PlayersLibrary: playerLibrary.address},
  });
  const playersImplMisc = await PlayersImplMisc.deploy();
  console.log(`playersImplMisc = "${playersImplMisc.address.toLowerCase()}"`);
  await playersImplMisc.deployed();

  const tx = await players
    .connect(owner)
    .setImpls(
      playersImplQueueActions.address,
      playersImplProcessActions.address,
      playersImplRewards.address,
      playersImplMisc.address
    );
  await tx.wait();

  const playerId = 3;

  // PlayerNFT
  const EstforLibrary = await ethers.getContractFactory("EstforLibrary");
  let estforLibrary = await EstforLibrary.deploy();
  await estforLibrary.deployed();
  let PlayerNFT = await ethers.getContractFactory("PlayerNFT", {
    libraries: {EstforLibrary: estforLibrary.address},
  });
  PlayerNFT = PlayerNFT.connect(owner);
  const playerNFT = await upgrades.upgradeProxy(PLAYER_NFT_ADDRESS, PlayerNFT, {
    kind: "uups",
    unsafeAllow: ["external-library-linking"],
  });

  console.log(await players.xp(playerId, EstforTypes.Skill.COOKING));
  console.log(await players.packedXP(playerId));

  // Test max level works
  const uri = await playerNFT.uri(playerId);
  const metadata = JSON.parse(Buffer.from(uri.split(";base64,")[1], "base64").toString());
  console.log(metadata.attributes[2].value);

  //  console.log(await playerNFT.uri()pendingQueuedActionState(player.address, playerId));
  /*
  // Do action
  await players.connect(player).processActions(playerId);
  console.log(await players.getActionQueue(playerId)); */
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
