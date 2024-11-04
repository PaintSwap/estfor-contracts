import {ethers} from "hardhat";
import {Players, PlayersLibrary} from "../typechain-types";
import {
  PLAYERS_ADDRESS,
  PLAYERS_IMPL_MISC_ADDRESS,
  PLAYERS_IMPL_MISC1_ADDRESS,
  PLAYERS_IMPL_PROCESS_ACTIONS_ADDRESS,
  PLAYERS_IMPL_QUEUE_ACTIONS_ADDRESS,
  PLAYERS_IMPL_REWARDS_ADDRESS,
  PLAYERS_LIBRARY_ADDRESS
} from "./contractAddresses";
import {deployPlayerImplementations, getChainId, verifyContracts} from "./utils";

async function main() {
  const [owner] = await ethers.getSigners();
  const chainId = await getChainId(owner);
  console.log(`Deploying player implementation contracts with the account: ${owner.address} on chain id ${chainId}`);

  // Players
  const newPlayersLibrary = false;
  const PlayersLibrary = await ethers.getContractFactory("PlayersLibrary");
  let playersLibrary: PlayersLibrary;
  if (newPlayersLibrary) {
    playersLibrary = await PlayersLibrary.deploy();

    if (chainId == 250n) {
      await verifyContracts([await playersLibrary.getAddress()]);
    }
  } else {
    playersLibrary = (await PlayersLibrary.attach(PLAYERS_LIBRARY_ADDRESS)) as unknown as PlayersLibrary;
  }
  console.log(`playersLibrary = "${(await playersLibrary.getAddress()).toLowerCase()}"`);

  const {playersImplQueueActions, playersImplProcessActions, playersImplRewards, playersImplMisc, playersImplMisc1} =
    await deployPlayerImplementations(await playersLibrary.getAddress());
  /*
  // Single
  const playersImplRewards = await ethers.deployContract("PlayersImplRewards", {
    libraries: {PlayersLibrary: (await playersLibrary.getAddress())},
  });
  await playersImplRewards.waitForDeployment();
  console.log(`PlayersImplRewards = "${(await playersImplRewards.getAddress()).toLowerCase()}"`);
*/
  if (chainId == 250n) {
    await verifyContracts([
      await playersImplQueueActions.getAddress(),
      await playersImplProcessActions.getAddress(),
      await playersImplRewards.getAddress(),
      await playersImplMisc.getAddress(),
      await playersImplMisc1.getAddress()
    ]);
  }

  /* Use these when keeping old implementations
    PLAYERS_IMPL_QUEUE_ACTIONS_ADDRESS,
    PLAYERS_IMPL_PROCESS_ACTIONS_ADDRESS,
    PLAYERS_IMPL_REWARDS_ADDRESS,
    PLAYERS_IMPL_MISC_ADDRESS,
    PLAYERS_IMPL_MISC1_ADDRESS
  */
  const players = (await ethers.getContractAt("Players", PLAYERS_ADDRESS)) as Players;
  const tx = await players.setImpls(
    await playersImplQueueActions.getAddress(),
    await playersImplProcessActions.getAddress(),
    await playersImplRewards.getAddress(),
    await playersImplMisc.getAddress(),
    await playersImplMisc1.getAddress()
  );
  await tx.wait();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
