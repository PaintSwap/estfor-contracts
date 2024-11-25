import {ethers, upgrades} from "hardhat";
import {PlayersLibrary, Raids} from "../typechain-types";
import {
  PLAYERS_ADDRESS,
  PLAYERS_IMPL_MISC_ADDRESS,
  PLAYERS_IMPL_MISC1_ADDRESS,
  PLAYERS_IMPL_PROCESS_ACTIONS_ADDRESS,
  PLAYERS_IMPL_QUEUE_ACTIONS_ADDRESS,
  PLAYERS_IMPL_REWARDS_ADDRESS,
  PLAYERS_LIBRARY_ADDRESS,
  RAIDS_ADDRESS
} from "./contractAddresses";
import {deployPlayerImplementations, getChainId, verifyContracts} from "./utils";

async function main() {
  const [owner] = await ethers.getSigners();
  const chainId = await getChainId(owner);
  console.log(`Deploying player implementation contracts with the account: ${owner.address} on chain id ${chainId}`);

  // Players
  const newPlayersLibrary = false;
  let playersLibrary: PlayersLibrary;
  let raids: Raids;
  if (newPlayersLibrary) {
    playersLibrary = await ethers.deployContract("PlayersLibrary");

    if (chainId == 250n) {
      await verifyContracts([await playersLibrary.getAddress()]);
    }
    // If deploying a new players library then also upgrade raids
    const Raids = await ethers.getContractFactory("Raids", {
      libraries: {PlayersLibrary: await playersLibrary.getAddress()}
    });
    raids = (await upgrades.upgradeProxy(RAIDS_ADDRESS, Raids, {
      kind: "uups",
      timeout: 600 * 1000 // 10 minutes
    })) as unknown as Raids;
    await raids.waitForDeployment();
    console.log(`raids = "${(await raids.getAddress()).toLowerCase()}"`);
  } else {
    playersLibrary = await ethers.getContractAt("PlayersLibrary", PLAYERS_LIBRARY_ADDRESS);
    raids = await ethers.getContractAt("Raids", RAIDS_ADDRESS);
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
      await playersImplMisc1.getAddress(),
      await raids.getAddress()
    ]);
  }

  /* Use these when keeping old implementations
    PLAYERS_IMPL_QUEUE_ACTIONS_ADDRESS,
    PLAYERS_IMPL_PROCESS_ACTIONS_ADDRESS,
    PLAYERS_IMPL_REWARDS_ADDRESS,
    PLAYERS_IMPL_MISC_ADDRESS,
    PLAYERS_IMPL_MISC1_ADDRESS
  */
  const players = await ethers.getContractAt("Players", PLAYERS_ADDRESS);
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
