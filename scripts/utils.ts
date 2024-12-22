import {Contract, Network} from "ethers";
import {ethers, run} from "hardhat";
import {
  MockPaintSwapMarketplaceWhitelist,
  PlayerNFT,
  PlayersImplMisc,
  PlayersImplMisc1,
  PlayersImplProcessActions,
  PlayersImplQueueActions,
  PlayersImplRewards,
  DailyRewardsScheduler
} from "../typechain-types";
import {Skill} from "@paintswap/estfor-definitions/types";
import {allDailyRewards, allWeeklyRewards} from "./data/dailyRewards";
import {getEventLog} from "../test/utils";
import {HardhatEthersSigner, SignerWithAddress} from "@nomicfoundation/hardhat-ethers/signers";
import {Worker} from "worker_threads";
import path from "path";

export const createPlayer = async (
  playerNFT: PlayerNFT,
  avatarId: number,
  account: SignerWithAddress,
  name: string,
  makeActive: boolean,
  discord = "",
  twitter = "",
  telegram = "",
  upgrade = false
): Promise<bigint> => {
  const tx = await playerNFT.connect(account).mint(avatarId, name, discord, twitter, telegram, upgrade, makeActive);

  return (await getEventLog(tx, playerNFT, "NewPlayer")).playerId;
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
      address
    });
  }
  console.log("Verified all contracts");
};

export const verifyContract = async (address: string, constructorArguments: any[]) => {
  return run("verify:verify", {
    address,
    constructorArguments
  });
};

export const isDevNetwork = (network: Network): boolean => {
  return network.chainId == 31337n || network.chainId == 1337n;
};

export const setDailyAndWeeklyRewards = async (dailyRewardsScheduler: DailyRewardsScheduler) => {
  // Set up daily rewards
  for (let i = 0; i < allDailyRewards.length; ++i) {
    const tier = i + 1;
    const tx = await dailyRewardsScheduler.setDailyRewardPool(tier, allDailyRewards[i]);
    await tx.wait();
  }

  // Set up weekly rewards
  for (let i = 0; i < allWeeklyRewards.length; ++i) {
    const tier = i + 1;
    const tx = await dailyRewardsScheduler.setWeeklyRewardPool(tier, allWeeklyRewards[i]);
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
  const playersImplQueueActions = await ethers.deployContract("PlayersImplQueueActions", {
    libraries: {PlayersLibrary: playersLibraryAddress}
  });
  console.log(`playersImplQueueActions = "${(await playersImplQueueActions.getAddress()).toLowerCase()}"`);

  const playersImplProcessActions = await ethers.deployContract("PlayersImplProcessActions", {
    libraries: {PlayersLibrary: playersLibraryAddress}
  });
  console.log(`playersImplProcessActions = "${(await playersImplProcessActions.getAddress()).toLowerCase()}"`);

  const playersImplRewards = await ethers.deployContract("PlayersImplRewards", {
    libraries: {PlayersLibrary: playersLibraryAddress}
  });
  console.log(`playersImplRewards = "${(await playersImplRewards.getAddress()).toLowerCase()}"`);

  const playersImplMisc = await ethers.deployContract("PlayersImplMisc", {
    libraries: {PlayersLibrary: playersLibraryAddress}
  });
  console.log(`playersImplMisc = "${(await playersImplMisc.getAddress()).toLowerCase()}"`);

  const playersImplMisc1 = await ethers.deployContract("PlayersImplMisc1");
  console.log(`playersImplMisc1 = "${(await playersImplMisc1.getAddress()).toLowerCase()}"`);

  return {
    playersImplQueueActions,
    playersImplProcessActions,
    playersImplRewards,
    playersImplMisc,
    playersImplMisc1
  };
};

export const deployMockPaintSwapContracts = async (): Promise<{
  paintSwapMarketplaceWhitelist: MockPaintSwapMarketplaceWhitelist;
}> => {
  const paintSwapMarketplaceWhitelist = await ethers.deployContract("MockPaintSwapMarketplaceWhitelist");
  return {paintSwapMarketplaceWhitelist};
};

/**
 * Generates unique bit positions for each item in the Bloom filter.
 * @param items Array of items to add to the Bloom filter (strings).
 * @param hashCount Number of hash functions to use.
 * @param bitCount Number of bits in the Bloom filter.
 * @returns Set of unique bit positions for the Bloom filter.
 */
export async function generateUniqueBitPositions(
  items: string[],
  hashCount: number = 4,
  bitCount: bigint = 1100000n
): Promise<bigint[]> {
  const positions = new Set<bigint>();

  // use multiple threads to parallelize the hashing
  const THREADCOUNT = Math.max(1, Math.min(8, require("os").cpus().length - 1));

  // run a worker to hash the values to get the bit positions
  function runWorker(workerData: any): Promise<bigint[]> {
    return new Promise((resolve, reject) => {
      const worker = new Worker(path.resolve(__dirname, "worker_generateUniqueBitPositions.js"), {workerData});
      worker.on("message", resolve);
      worker.on("error", reject);
      worker.on("exit", (code) => {
        if (code !== 0) {
          reject(new Error(`Worker stopped with exit code ${code}`));
        }
      });
    });
  }

  // split the items into batches and run the worker on each batch
  const batchSize = Math.ceil(items.length / THREADCOUNT);
  const promises = [];

  // push each batch to a worker
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    promises.push(runWorker({items: batch, hashCount, bitCount}));
  }

  // wait for all workers to finish
  const results = await Promise.all(promises);
  // combine the results
  for (const result of results) {
    for (const position of result) {
      positions.add(position);
    }
  }

  // convert the set to an array and sort it
  const positionsArray = [...positions];
  positionsArray.sort((a, b) => Number(a) - Number(b));

  return positionsArray;
}

// Delay function
export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const isBeta = process.env.IS_BETA == "true";

// Needs to match that in rewards.sol
export const TIER_1_DAILY_REWARD_START_XP = 0;
export const TIER_2_DAILY_REWARD_START_XP = 7_650;
export const TIER_3_DAILY_REWARD_START_XP = 33_913;
export const TIER_4_DAILY_REWARD_START_XP = 195_864;
export const TIER_5_DAILY_REWARD_START_XP = 784_726;
export const TIER_6_DAILY_REWARD_START_XP = 2_219_451;

export const exportPlayerNamesFilePath = "./export/players.txt";
export const exportPetNamesFilePath = "./export/pets.txt";
export const exportClanNamesFilePath = "./export/clans.txt";

export const getChainId = async (signer: HardhatEthersSigner) => {
  const chainId = await signer.provider?.getNetwork().then((network) => network.chainId);
  return chainId;
};

export const estimateGas = async (signer: SignerWithAddress, contract: Contract, args: any[]) => {
  const gasLimit = await signer.estimateGas({
    to: await contract.getAddress(),
    data: contract.interface.encodeFunctionData("startActions", args)
  });
  return gasLimit;
};

export const SKIP_XP_THRESHOLD_EFFECTS = true;
export const DONT_SKIP_XP_THRESHOLD_EFFECTS = false;
