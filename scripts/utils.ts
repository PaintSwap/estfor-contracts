import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {BigNumber} from "ethers";
import {ethers, run} from "hardhat";
import {
  MockBrushToken,
  MockPaintSwapMarketplaceWhitelist,
  MockRouter,
  MockWrappedFantom,
  PlayerNFT,
  PlayersImplMisc,
  PlayersImplMisc1,
  PlayersImplProcessActions,
  PlayersImplQueueActions,
  PlayersImplRewards,
  TestPaintSwapArtGallery,
  TestPaintSwapDecorator,
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
  makeActive: boolean,
  discord = "",
  twitter = "",
  telegram = "",
  upgrade = false
): Promise<BigNumber> => {
  const tx = await playerNFT.connect(account).mint(avatarId, name, discord, twitter, telegram, upgrade, makeActive);
  const receipt = await tx.wait();
  const event = receipt?.events?.filter((x) => {
    return x.event == "NewPlayerV2";
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
  const playersImplQueueActions = (await ethers.deployContract("PlayersImplQueueActions", {
    libraries: {PlayersLibrary: playersLibraryAddress},
  })) as PlayersImplQueueActions;
  console.log(`playersImplQueueActions = "${playersImplQueueActions.address.toLowerCase()}"`);
  await playersImplQueueActions.deployed();

  const playersImplProcessActions = (await ethers.deployContract("PlayersImplProcessActions", {
    libraries: {PlayersLibrary: playersLibraryAddress},
  })) as PlayersImplProcessActions;
  console.log(`playersImplProcessActions = "${playersImplProcessActions.address.toLowerCase()}"`);
  await playersImplProcessActions.deployed();

  const playersImplRewards = (await ethers.deployContract("PlayersImplRewards", {
    libraries: {PlayersLibrary: playersLibraryAddress},
  })) as PlayersImplRewards;
  console.log(`playersImplRewards = "${playersImplRewards.address.toLowerCase()}"`);
  await playersImplRewards.deployed();

  const playersImplMisc = (await ethers.deployContract("PlayersImplMisc", {
    libraries: {PlayersLibrary: playersLibraryAddress},
  })) as PlayersImplMisc;
  console.log(`playersImplMisc = "${playersImplMisc.address.toLowerCase()}"`);
  await playersImplMisc.deployed();

  const playersImplMisc1 = (await ethers.deployContract("PlayersImplMisc1", {
    libraries: {PlayersLibrary: playersLibraryAddress},
  })) as PlayersImplMisc1;
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

export const deployMockPaintSwapContracts = async (
  brush: MockBrushToken,
  router: MockRouter,
  wftm: MockWrappedFantom
): Promise<{
  paintSwapMarketplaceWhitelist: MockPaintSwapMarketplaceWhitelist;
  paintSwapDecorator: TestPaintSwapDecorator;
  paintSwapArtGallery: TestPaintSwapArtGallery;
}> => {
  const MockPaintSwapMarketplaceWhitelist = await ethers.getContractFactory("MockPaintSwapMarketplaceWhitelist");
  const TestPaintSwapArtGallery = await ethers.getContractFactory("TestPaintSwapArtGallery");
  const TestPaintSwapDecorator = await ethers.getContractFactory("TestPaintSwapDecorator");

  const paintSwapMarketplaceWhitelist = await MockPaintSwapMarketplaceWhitelist.deploy();
  await paintSwapMarketplaceWhitelist.deployed();
  console.log(`paintSwapMarketplaceWhitelist = "${paintSwapMarketplaceWhitelist.address.toLowerCase()}"`);
  const artGalleryLockPeriod = 3600;
  const brushPerSecond = ethers.utils.parseEther("2");
  const paintSwapArtGallery = await TestPaintSwapArtGallery.deploy(brush.address, artGalleryLockPeriod);
  await paintSwapArtGallery.deployed();
  console.log(`paintSwapArtGallery = "${paintSwapArtGallery.address.toLowerCase()}"`);
  const {timestamp: NOW} = await ethers.provider.getBlock("latest");
  const paintSwapDecorator = await TestPaintSwapDecorator.deploy(
    brush.address,
    paintSwapArtGallery.address,
    router.address,
    wftm.address,
    brushPerSecond,
    NOW
  );
  await paintSwapDecorator.deployed();
  console.log(`paintSwapDecorator = "${paintSwapDecorator.address.toLowerCase()}"`);
  const lp = await ethers.deployContract("MockBrushToken");
  await paintSwapDecorator.add("2000", lp.address, true);
  await paintSwapArtGallery.transferOwnership(paintSwapDecorator.address);

  return {paintSwapMarketplaceWhitelist, paintSwapDecorator, paintSwapArtGallery};
};

export const isBeta = process.env.IS_BETA == "true";

// Needs to match that in rewards.sol
export const TIER_1_DAILY_REWARD_START_XP = 0;
export const TIER_2_DAILY_REWARD_START_XP = 7_650;
export const TIER_3_DAILY_REWARD_START_XP = 33_913;
export const TIER_4_DAILY_REWARD_START_XP = 195_864;
export const TIER_5_DAILY_REWARD_START_XP = 784_726;
export const TIER_6_DAILY_REWARD_START_XP = 2_219_451;
