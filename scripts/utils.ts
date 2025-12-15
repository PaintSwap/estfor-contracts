import {Contract, Network} from "ethers";
import {ethers, run, network} from "hardhat";
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
import SafeApiKit from "@safe-global/api-kit";
import Safe from "@safe-global/protocol-kit";
import {MetaTransactionData, OperationType} from "@safe-global/types-kit";

const upgradeToAndCallIface = new ethers.Interface([
  "function upgradeToAndCall(address newImplementation, bytes data) payable"
]);
const SAFE_START_BLOCK = 56943741;

export interface SafeInstance {
  useSafe: boolean;
  apiKit: SafeApiKit;
  protocolKit: Safe;
}

export const sendTransactionSetToSafe = async (
  network: Network,
  protocolKit: Safe,
  apiKit: SafeApiKit,
  transactionSet: MetaTransactionData[],
  proposer: SignerWithAddress
) => {
  // Create Safe transaction (add all transactions if multiple upgrades)
  const safeTransaction = await protocolKit.createTransaction({
    transactions: transactionSet,
    options: {
      nonce: Number(await apiKit.getNextNonce(process.env.SAFE_ADDRESS as string))
    }
  });

  const safeTxHash = await protocolKit.getTransactionHash(safeTransaction);
  const signature = await protocolKit.signHash(safeTxHash);

  if (network.chainId !== 146n) {
    console.log("Upgrade set successful, you can proceed to deploying on mainnet to execute against the real Safe");
  } else {
    console.log("Proposed upgrade transaction to Safe, check Safe UI to confirm and execute");
    await apiKit.proposeTransaction({
      safeAddress: process.env.SAFE_ADDRESS as string,
      safeTransactionData: safeTransaction.data,
      safeTxHash,
      senderAddress: proposer.address,
      senderSignature: signature.data
    });
  }
};

export const getSafeUpgradeTransaction = (
  proxyAddress: string,
  implementationAddress: string,
  callData: string = "0x"
): MetaTransactionData => {
  const data = upgradeToAndCallIface.encodeFunctionData("upgradeToAndCall", [
    ethers.getAddress(implementationAddress),
    callData
  ]);
  return {
    to: ethers.getAddress(proxyAddress),
    value: "0", // wei
    data,
    operation: OperationType.Call
  };
};

export const initialiseSafe = async (nw: Network): Promise<SafeInstance> => {
  let isSafeFork = false;
  if (nw.chainId !== 146n) {
    const metadata = (await network.provider.request({
      method: "hardhat_metadata",
      params: []
    })) as any;
    // check if fork and after Safe was made
    isSafeFork =
      metadata?.forkedNetwork?.chainId === 146 && metadata?.forkedNetwork?.forkBlockNumber! >= SAFE_START_BLOCK;
  }

  if (nw.chainId !== 146n && !isSafeFork) {
    return {useSafe: false, apiKit: null as unknown as SafeApiKit, protocolKit: null as unknown as Safe};
  }

  if (!process.env.SAFE_ADDRESS) {
    throw new Error("SAFE_ADDRESS not set in environment variables");
  }

  if (!process.env.SAFE_API_KEY) {
    throw new Error("SAFE_API_KEY not set in environment variables");
  }

  if (!process.env.PROPOSER_PRIVATE_KEY) {
    throw new Error("PROPOSER_PRIVATE_KEY not set in environment variables");
  }

  const apiKit = new SafeApiKit({
    chainId: 146n,
    apiKey: process.env.SAFE_API_KEY
  });

  const protocolKit = await Safe.init({
    provider: process.env.SONIC_RPC as string,
    signer: process.env.PROPOSER_PRIVATE_KEY,
    safeAddress: process.env.SAFE_ADDRESS as string
  });

  return {useSafe: true, apiKit, protocolKit};
};

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
export const verifyContracts = async (addresses: string[], constructorArguments: any[][] = []) => {
  for (const address of addresses) {
    try {
      await run("verify:verify", {
        address,
        constructorArguments
      });
    } catch (e) {
      console.error(`Failed to verify contract at address ${address}`);
    }
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
