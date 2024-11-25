import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {expect} from "chai";
import {ethers, upgrades} from "hardhat";
import {requestAndFulfillRandomWords, timeTravelToNextCheckpoint} from "./utils";
import {setDailyAndWeeklyRewards} from "../scripts/utils";
import {DailyRewardsScheduler, MockVRF, RandomnessBeacon} from "../typechain-types";
import {Block} from "ethers";

describe("DailyRewardsScheduler", function () {
  const deployContracts = async function () {
    // Contracts are deployed using the first signer/account by default
    const [owner, alice] = await ethers.getSigners();

    const mockVRF = (await ethers.deployContract("MockVRF")) as MockVRF;

    // Add some dummy blocks so that world can access them
    for (let i = 0; i < 5; ++i) {
      await owner.sendTransaction({
        to: owner.address,
        value: 1,
        maxFeePerGas: 1
      });
    }
    // Create the world
    const RandomnessBeacon = await ethers.getContractFactory("RandomnessBeacon");
    const randomnessBeacon = (await upgrades.deployProxy(RandomnessBeacon, [await mockVRF.getAddress()], {
      kind: "uups"
    })) as unknown as RandomnessBeacon;

    // Create the daily rewards scheduler
    const DailyRewardsScheduler = await ethers.getContractFactory("DailyRewardsScheduler");
    const dailyRewardsScheduler = (await upgrades.deployProxy(
      DailyRewardsScheduler,
      [await randomnessBeacon.getAddress()],
      {
        kind: "uups"
      }
    )) as unknown as DailyRewardsScheduler;

    const mockOracleCB = await ethers.deployContract("MockOracleCB");
    await randomnessBeacon.initializeAddresses(mockOracleCB, dailyRewardsScheduler);
    await randomnessBeacon.initializeRandomWords();

    await setDailyAndWeeklyRewards(dailyRewardsScheduler);

    const minRandomWordsUpdateTime = await randomnessBeacon.MIN_RANDOM_WORDS_UPDATE_TIME();
    const numDaysRandomWordsInitialized = await randomnessBeacon.NUM_DAYS_RANDOM_WORDS_INITIALIZED();

    return {
      randomnessBeacon,
      dailyRewardsScheduler,
      mockVRF,
      minRandomWordsUpdateTime,
      numDaysRandomWordsInitialized,
      owner,
      alice
    };
  };

  it("Test new random rewards", async function () {
    const {randomnessBeacon, dailyRewardsScheduler, mockVRF} = await loadFixture(deployContracts);

    const playerId = 1;

    const oneDay = 24 * 3600;
    const oneWeek = oneDay * 7;
    let {timestamp: current} = (await ethers.provider.getBlock("latest")) as Block;
    let timestamp = Math.floor((current - 4 * oneDay) / oneWeek) * oneWeek + (oneWeek + 4 * oneDay) + 1; // Start next monday
    await ethers.provider.send("evm_setNextBlockTimestamp", [timestamp]);
    await ethers.provider.send("evm_mine", []);

    let tier = 1;
    let dailyRewards = await dailyRewardsScheduler.getActiveDailyAndWeeklyRewards(tier, playerId);

    // Keep requesting
    let error = false;
    while (!error) {
      try {
        await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);
      } catch {
        error = true;
      }
    }

    expect(await dailyRewardsScheduler.getActiveDailyAndWeeklyRewards(tier, playerId)).to.not.eql(dailyRewards);
    dailyRewards = await dailyRewardsScheduler.getActiveDailyAndWeeklyRewards(tier, playerId);
    let {timestamp: current2} = (await ethers.provider.getBlock("latest")) as Block;
    timestamp = current2 + oneWeek; // Start next monday
    await ethers.provider.send("evm_setNextBlockTimestamp", [timestamp]);
    error = false;
    while (!error) {
      try {
        await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);
      } catch {
        error = true;
      }
    }

    expect(await dailyRewardsScheduler.getActiveDailyAndWeeklyRewards(tier, playerId)).to.not.eql(dailyRewards);
    dailyRewards = await dailyRewardsScheduler.getActiveDailyAndWeeklyRewards(1, playerId);
  });

  it("Tiered random rewards", async function () {
    const {randomnessBeacon, dailyRewardsScheduler, mockVRF} = await loadFixture(deployContracts);

    const playerId = 1;
    const oneDay = 24 * 3600;
    await timeTravelToNextCheckpoint();

    // Keep requesting
    while (true) {
      try {
        await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);
      } catch {
        break;
      }
    }

    let dailyRewards = await dailyRewardsScheduler.getActiveDailyAndWeeklyRewards(1, playerId);
    let dailyRewards1 = await dailyRewardsScheduler.getActiveDailyAndWeeklyRewards(1, playerId + 1);
    let dailyRewards2 = await dailyRewardsScheduler.getActiveDailyAndWeeklyRewards(1, playerId + 2);

    // TODO: Check that incremental playerIds don't have rewards that have incremental indices in the reward pool tier
    expect(dailyRewards).to.not.eql(dailyRewards1);
    expect(dailyRewards).to.not.eql(dailyRewards2);
    expect(dailyRewards1).to.not.eql(dailyRewards2);
  });
});
