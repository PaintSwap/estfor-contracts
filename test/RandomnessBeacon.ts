import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {expect} from "chai";
import {ethers, upgrades} from "hardhat";
import {MockVRF, World} from "../typechain-types";
import {Block} from "ethers";

describe("RandomnessBeacon", function () {
  const deployContracts = async function () {
    // Contracts are deployed using the first signer/account by default
    const [owner, alice] = await ethers.getSigners();

    const mockVRF = (await ethers.deployContract("MockVRF")) as MockVRF;

    // Add some dummy blocks so that randomness beacon can access them
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
    })) as unknown as World;

    const minRandomWordsUpdateTime = await randomnessBeacon.MIN_RANDOM_WORDS_UPDATE_TIME();
    const numDaysRandomWordsInitialized = await randomnessBeacon.NUM_DAYS_RANDOM_WORDS_INITIALIZED();

    const mockOracleCB = await ethers.deployContract("MockOracleCB");
    await randomnessBeacon.initializeAddresses(mockOracleCB, mockOracleCB);
    await randomnessBeacon.initializeRandomWords();

    return {
      randomnessBeacon,
      mockVRF,
      minRandomWordsUpdateTime,
      numDaysRandomWordsInitialized,
      owner,
      alice
    };
  };

  describe("Seed", function () {
    it("Requesting random words", async function () {
      const {randomnessBeacon, mockVRF, minRandomWordsUpdateTime, numDaysRandomWordsInitialized} = await loadFixture(
        deployContracts
      );
      await randomnessBeacon.requestRandomWords();

      const startOffset = numDaysRandomWordsInitialized;
      let requestId = await randomnessBeacon.requestIds(startOffset);
      expect(requestId).to.be.greaterThanOrEqual(1);

      let randomWord = await randomnessBeacon.randomWords(requestId);
      expect(randomWord).to.eq(0);

      // Retrieve the random number
      await mockVRF.fulfill(requestId, randomnessBeacon);
      randomWord = await randomnessBeacon.randomWords(requestId);
      expect(randomWord).to.not.eq(0);

      // Try fulfill same request should fail
      await expect(mockVRF.fulfill(requestId, randomnessBeacon)).to.be.reverted;

      // Requesting new random word too soon
      await expect(randomnessBeacon.requestRandomWords()).to.be.reverted;

      // Increase time and check it works
      await ethers.provider.send("evm_increaseTime", [minRandomWordsUpdateTime.toString()]);
      await ethers.provider.send("evm_mine", []);
      await randomnessBeacon.requestRandomWords();
      requestId = await randomnessBeacon.requestIds(startOffset + 1n);
      await mockVRF.fulfill(requestId, randomnessBeacon);

      // Increase it 2x more, should allow 2 random seeds to be requested
      await ethers.provider.send("evm_increaseTime", [Number(minRandomWordsUpdateTime * 2n)]);
      await ethers.provider.send("evm_mine", []);
      await randomnessBeacon.requestRandomWords();
      requestId = await randomnessBeacon.requestIds(startOffset + 2n);
      await mockVRF.fulfill(requestId, randomnessBeacon);
      await randomnessBeacon.requestRandomWords();
      requestId = await randomnessBeacon.requestIds(startOffset + 3n);
      await mockVRF.fulfill(requestId, randomnessBeacon);
      await expect(randomnessBeacon.requestRandomWords()).to.be.reverted;
      await expect(randomnessBeacon.requestIds(startOffset + 4n)).to.be.reverted;
    });

    it("getRandomWord", async function () {
      const {randomnessBeacon, mockVRF, minRandomWordsUpdateTime, numDaysRandomWordsInitialized} = await loadFixture(
        deployContracts
      );
      const {timestamp: currentTimestamp} = (await ethers.provider.getBlock("latest")) as Block;
      expect(await randomnessBeacon.hasRandomWord(currentTimestamp)).to.be.false;
      await ethers.provider.send("evm_increaseTime", [Number(minRandomWordsUpdateTime)]);
      await ethers.provider.send("evm_mine", []);
      await randomnessBeacon.requestRandomWords();
      await expect(randomnessBeacon.requestIds(numDaysRandomWordsInitialized + 1n)).to.be.reverted;
      let requestId = await randomnessBeacon.requestIds(numDaysRandomWordsInitialized);
      await mockVRF.fulfill(requestId, randomnessBeacon);
      expect(await randomnessBeacon.hasRandomWord(currentTimestamp)).to.be.false;
      await randomnessBeacon.requestRandomWords();
      requestId = await randomnessBeacon.requestIds(numDaysRandomWordsInitialized + 1n);
      await mockVRF.fulfill(requestId, randomnessBeacon);
      expect(await randomnessBeacon.hasRandomWord(currentTimestamp)).to.be.true;
      await expect(randomnessBeacon.getRandomWord(currentTimestamp)).to.not.be.reverted;
      // Gives unhandled project rejection for some reason
      // Before 5 day offset
      await expect(
        randomnessBeacon.getRandomWord(BigInt(currentTimestamp) - minRandomWordsUpdateTime * 6n)
      ).to.be.revertedWithCustomError(randomnessBeacon, "NoValidRandomWord");
      // After offset
      await expect(
        randomnessBeacon.getRandomWord(BigInt(currentTimestamp) + minRandomWordsUpdateTime)
      ).to.be.revertedWithCustomError(randomnessBeacon, "NoValidRandomWord");
    });

    it("Get multiple words", async function () {
      const {randomnessBeacon, mockVRF, minRandomWordsUpdateTime, numDaysRandomWordsInitialized} = await loadFixture(
        deployContracts
      );
      const {timestamp: currentTimestamp} = (await ethers.provider.getBlock("latest")) as Block;
      await expect(randomnessBeacon.getMultipleWords(currentTimestamp)).to.be.revertedWithCustomError(
        randomnessBeacon,
        "NoValidRandomWord"
      );
      await ethers.provider.send("evm_increaseTime", [Number(minRandomWordsUpdateTime)]);
      await ethers.provider.send("evm_mine", []);
      await randomnessBeacon.requestRandomWords();
      let requestId = await randomnessBeacon.requestIds(numDaysRandomWordsInitialized);
      await mockVRF.fulfill(requestId, randomnessBeacon);
      await expect(randomnessBeacon.getMultipleWords(currentTimestamp)).to.be.revertedWithCustomError(
        randomnessBeacon,
        "NoValidRandomWord"
      );
      await randomnessBeacon.requestRandomWords();
      requestId = await randomnessBeacon.requestIds(numDaysRandomWordsInitialized + 1n);
      await expect(mockVRF.fulfill(requestId, randomnessBeacon)).to.not.be.reverted;
    });
  });
});
