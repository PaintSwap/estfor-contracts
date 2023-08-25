import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {BigNumber} from "ethers";
import {ethers, run} from "hardhat";
import {
  PlayerNFT,
  PlayersImplMisc,
  PlayersImplMisc1,
  PlayersImplProcessActions,
  PlayersImplQueueActions,
  PlayersImplRewards,
  World,
} from "../typechain-types";
import {Skill} from "@paintswap/estfor-definitions/types";
import {Network} from "@ethersproject/providers";
import {allDailyRewards, allWeeklyRewards} from "./data/dailyRewards";

export const createPlayer = async (
  playerNFT: PlayerNFT,
  avatarId: number,
  account: SignerWithAddress,
  name: string,
  makeActive: boolean
): Promise<BigNumber> => {
  const tx = await playerNFT.connect(account).mint(avatarId, name, makeActive);
  const receipt = await tx.wait();
  const event = receipt?.events?.filter((x) => {
    return x.event == "NewPlayer";
  })[0].args;
  return event?.playerId;
};
export type AvatarInfo = {
  name: string;
  description: string;
  imageURI: string;
  startSkills: [Skill, Skill];
};

// If there's an error with build-info not matching then delete cache/artifacts folder and try again
export const verifyContracts = async (addresses: string[]) => {
  for (const address of addresses) {
    await run("verify:verify", {
      address,
    });
  }
  console.log("Verified all contracts");
};

export const verifyContract = async (address: string, constructorArguments: any[]) => {
  return run("verify:verify", {
    address,
    constructorArguments,
  });
};

export const isDevNetwork = (network: Network): boolean => {
  return network.chainId == 31337 || network.chainId == 1337;
};

export const setDailyAndWeeklyRewards = async (world: World) => {
  // Set up daily rewards
  for (let i = 0; i < allDailyRewards.length; ++i) {
    const tier = i + 1;
    const tx = await world.setDailyRewardPool(tier, allDailyRewards[i]);
    await tx.wait();
  }

  // Set up weekly rewards
  for (let i = 0; i < allWeeklyRewards.length; ++i) {
    const tier = i + 1;
    const tx = await world.setWeeklyRewardPool(tier, allWeeklyRewards[i]);
    await tx.wait();
  }
};

interface IPlayerImpls {
  playersImplQueueActions: PlayersImplQueueActions;
  playersImplProcessActions: PlayersImplProcessActions;
  playersImplRewards: PlayersImplRewards;
  playersImplMisc: PlayersImplMisc;
  playersImplMisc1: PlayersImplMisc1;
}

export const deployPlayerImplementations = async (playersLibraryAddress: string): Promise<IPlayerImpls> => {
  const PlayersImplQueueActions = await ethers.getContractFactory("PlayersImplQueueActions", {
    libraries: {PlayersLibrary: playersLibraryAddress},
  });
  const playersImplQueueActions = await PlayersImplQueueActions.deploy();
  console.log(`playersImplQueueActions = "${playersImplQueueActions.address.toLowerCase()}"`);
  await playersImplQueueActions.deployed();

  const PlayersImplProcessActions = await ethers.getContractFactory("PlayersImplProcessActions", {
    libraries: {PlayersLibrary: playersLibraryAddress},
  });
  const playersImplProcessActions = await PlayersImplProcessActions.deploy();
  console.log(`playersImplProcessActions = "${playersImplProcessActions.address.toLowerCase()}"`);
  await playersImplProcessActions.deployed();

  const PlayersImplRewards = await ethers.getContractFactory("PlayersImplRewards", {
    libraries: {PlayersLibrary: playersLibraryAddress},
  });
  const playersImplRewards = await PlayersImplRewards.deploy();
  console.log(`playersImplRewards = "${playersImplRewards.address.toLowerCase()}"`);
  await playersImplRewards.deployed();

  const PlayersImplMisc = await ethers.getContractFactory("PlayersImplMisc", {
    libraries: {PlayersLibrary: playersLibraryAddress},
  });
  const playersImplMisc = await PlayersImplMisc.deploy();
  console.log(`playersImplMisc = "${playersImplMisc.address.toLowerCase()}"`);
  await playersImplMisc.deployed();

  const PlayersImplMisc1 = await ethers.getContractFactory("PlayersImplMisc1", {
    libraries: {PlayersLibrary: playersLibraryAddress},
  });
  const playersImplMisc1 = await PlayersImplMisc1.deploy();
  console.log(`playersImplMisc1 = "${playersImplMisc1.address.toLowerCase()}"`);
  await playersImplMisc1.deployed();

  return {
    playersImplQueueActions,
    playersImplProcessActions,
    playersImplRewards,
    playersImplMisc,
    playersImplMisc1,
  };
};
