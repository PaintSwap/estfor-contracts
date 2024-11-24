import {Block, Contract, Network, parseEther} from "ethers";
import {ethers, run} from "hardhat";
import {
  MockBrushToken,
  MockPaintSwapMarketplaceWhitelist,
  WrappedNative,
  PlayerNFT,
  PlayersImplMisc,
  PlayersImplMisc1,
  PlayersImplProcessActions,
  PlayersImplQueueActions,
  PlayersImplRewards,
  TestPaintSwapDecorator,
  World,
  DailyRewardsScheduler
} from "../typechain-types";
import {Skill} from "@paintswap/estfor-definitions/types";
import {allDailyRewards, allWeeklyRewards} from "./data/dailyRewards";
import {getEventLog} from "../test/utils";
import {HardhatEthersSigner, SignerWithAddress} from "@nomicfoundation/hardhat-ethers/signers";

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
  const playersImplQueueActions = (await ethers.deployContract("PlayersImplQueueActions", {
    libraries: {PlayersLibrary: playersLibraryAddress}
  })) as PlayersImplQueueActions;
  console.log(`playersImplQueueActions = "${(await playersImplQueueActions.getAddress()).toLowerCase()}"`);

  const playersImplProcessActions = (await ethers.deployContract("PlayersImplProcessActions", {
    libraries: {PlayersLibrary: playersLibraryAddress}
  })) as PlayersImplProcessActions;
  console.log(`playersImplProcessActions = "${(await playersImplProcessActions.getAddress()).toLowerCase()}"`);

  const playersImplRewards = (await ethers.deployContract("PlayersImplRewards", {
    libraries: {PlayersLibrary: playersLibraryAddress}
  })) as PlayersImplRewards;
  console.log(`playersImplRewards = "${(await playersImplRewards.getAddress()).toLowerCase()}"`);

  const playersImplMisc = (await ethers.deployContract("PlayersImplMisc", {
    libraries: {PlayersLibrary: playersLibraryAddress}
  })) as PlayersImplMisc;
  console.log(`playersImplMisc = "${(await playersImplMisc.getAddress()).toLowerCase()}"`);

  const playersImplMisc1 = (await ethers.deployContract("PlayersImplMisc1", {
    libraries: {PlayersLibrary: playersLibraryAddress}
  })) as PlayersImplMisc1;
  console.log(`playersImplMisc1 = "${(await playersImplMisc1.getAddress()).toLowerCase()}"`);

  return {
    playersImplQueueActions,
    playersImplProcessActions,
    playersImplRewards,
    playersImplMisc,
    playersImplMisc1
  };
};

export const deployMockPaintSwapContracts = async (
  brush: MockBrushToken,
  wftm: WrappedNative,
  fakeBrushLP: string
): Promise<{
  paintSwapMarketplaceWhitelist: MockPaintSwapMarketplaceWhitelist;
  paintSwapDecorator: TestPaintSwapDecorator;
  pid: number;
}> => {
  const paintSwapMarketplaceWhitelist = await ethers.deployContract("MockPaintSwapMarketplaceWhitelist");
  const brushPerSecond = parseEther("2");
  const {timestamp: NOW} = (await ethers.provider.getBlock("latest")) as Block;
  const paintSwapDecorator = await ethers.deployContract("TestPaintSwapDecorator", [brush, wftm, brushPerSecond, NOW]);

  const token = await ethers.getContractAt("IERC20", fakeBrushLP);
  let tx = await token.approve(paintSwapDecorator, parseEther("1000000000000000000000"));
  await tx.wait();
  console.log("Approve fake brush LP");

  // Add the LP to the decorator
  tx = await paintSwapDecorator.add("1", fakeBrushLP, true);
  await tx.wait();
  const pid = 0;
  return {paintSwapMarketplaceWhitelist, paintSwapDecorator, pid};
};

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
