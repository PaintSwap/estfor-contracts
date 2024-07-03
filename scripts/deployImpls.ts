import {ethers} from "hardhat";
import {Players, PlayersLibrary} from "../typechain-types";
import {
  PLAYERS_ADDRESS,
  PLAYERS_IMPL_MISC_ADDRESS,
  PLAYERS_IMPL_MISC1_ADDRESS,
  PLAYERS_IMPL_PROCESS_ACTIONS_ADDRESS,
  PLAYERS_IMPL_QUEUE_ACTIONS_ADDRESS,
  PLAYERS_IMPL_REWARDS_ADDRESS,
  PLAYERS_LIBRARY_ADDRESS,
} from "./contractAddresses";
import {deployPlayerImplementations, verifyContracts} from "./utils";

async function main() {
  const [owner] = await ethers.getSigners();
  const chainId = await owner.getChainId();
  console.log(`Deploying player implementation contracts with the account: ${owner.address} on chain id ${chainId}`);

  // Players
  const newPlayersLibrary = true;
  const PlayersLibrary = await ethers.getContractFactory("PlayersLibrary");
  let playersLibrary: PlayersLibrary;
  if (newPlayersLibrary) {
    playersLibrary = await PlayersLibrary.deploy();
    await playersLibrary.deployed();
    if (chainId == 250) {
      await verifyContracts([playersLibrary.address]);
    }
  } else {
    playersLibrary = await PlayersLibrary.attach(PLAYERS_LIBRARY_ADDRESS);
  }
  console.log(`playersLibrary = "${playersLibrary.address.toLowerCase()}"`);

  const {playersImplQueueActions, playersImplProcessActions, playersImplRewards, playersImplMisc, playersImplMisc1} =
    await deployPlayerImplementations(playersLibrary.address);

  // Single
  /* const playersImplMisc = await ethers.deployContract("PlayersImplMisc1", {
    libraries: {PlayersLibrary: playersLibrary.address},
  });
  console.log(`PlayersImplMisc = "${playersImplMisc.address.toLowerCase()}"`);
  await playersImplMisc.deployed(); */

  if (chainId == 250) {
    await verifyContracts([
      playersImplQueueActions.address,
      playersImplProcessActions.address,
      playersImplRewards.address,
      playersImplMisc.address,
      playersImplMisc1.address,
    ]);
  }

  /* Use these when keeping old implementations
    PLAYERS_IMPL_QUEUE_ACTIONS_ADDRESS,
    PLAYERS_IMPL_PROCESS_ACTIONS_ADDRESS,
    PLAYERS_IMPL_REWARDS_ADDRESS,
    PLAYERS_IMPL_MISC_ADDRESS,
    PLAYERS_IMPL_MISC1_ADDRESS
  */
  const players = (await ethers.getContractAt("Players", PLAYERS_ADDRESS)).connect(owner) as Players;
  const tx = await players.setImpls(
    playersImplQueueActions.address,
    playersImplProcessActions.address,
    playersImplRewards.address,
    playersImplMisc.address,
    playersImplMisc1.address
  );
  await tx.wait();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
