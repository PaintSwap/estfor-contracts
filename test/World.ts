import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {expect} from "chai";
import {ethers, upgrades} from "hardhat";
import {MockVRF, World} from "../typechain-types";
import {Block} from "ethers";

describe("World", function () {
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
    const World = await ethers.getContractFactory("World");
    const world = (await upgrades.deployProxy(World, [await mockVRF.getAddress()], {
      kind: "uups"
    })) as unknown as World;

    const minRandomWordsUpdateTime = await world.MIN_RANDOM_WORDS_UPDATE_TIME();
    const numDaysRandomWordsInitialized = await world.NUM_DAYS_RANDOM_WORDS_INITIALIZED();

    const mockOracleCB = await ethers.deployContract("MockOracleCB");
    await world.initializeAddresses(mockOracleCB, mockOracleCB);
    await world.initializeRandomWords();

    return {
      world,
      mockVRF,
      minRandomWordsUpdateTime,
      numDaysRandomWordsInitialized,
      owner,
      alice
    };
  };

  describe("Seed", function () {
    it("Requesting random words", async function () {
      const {world, mockVRF, minRandomWordsUpdateTime, numDaysRandomWordsInitialized} = await loadFixture(
        deployContracts
      );
      await world.requestRandomWords();

      const startOffset = numDaysRandomWordsInitialized;
      let requestId = await world.requestIds(startOffset);
      expect(requestId).to.be.greaterThanOrEqual(1);

      let randomWord = await world.randomWords(requestId);
      expect(randomWord).to.eq(0);

      // Retrieve the random number
      await mockVRF.fulfill(requestId, world);
      randomWord = await world.randomWords(requestId);
      expect(randomWord).to.not.eq(0);

      // Try fulfill same request should fail
      await expect(mockVRF.fulfill(requestId, world)).to.be.reverted;

      // Requesting new random word too soon
      await expect(world.requestRandomWords()).to.be.reverted;

      // Increase time and check it works
      await ethers.provider.send("evm_increaseTime", [minRandomWordsUpdateTime.toString()]);
      await ethers.provider.send("evm_mine", []);
      await world.requestRandomWords();
      requestId = await world.requestIds(startOffset + 1n);
      await mockVRF.fulfill(requestId, world);

      // Increase it 2x more, should allow 2 random seeds to be requested
      await ethers.provider.send("evm_increaseTime", [Number(minRandomWordsUpdateTime * 2n)]);
      await ethers.provider.send("evm_mine", []);
      await world.requestRandomWords();
      requestId = await world.requestIds(startOffset + 2n);
      await mockVRF.fulfill(requestId, world);
      await world.requestRandomWords();
      requestId = await world.requestIds(startOffset + 3n);
      await mockVRF.fulfill(requestId, world);
      await expect(world.requestRandomWords()).to.be.reverted;
      await expect(world.requestIds(startOffset + 4n)).to.be.reverted;
    });

    it("getRandomWord", async function () {
      const {world, mockVRF, minRandomWordsUpdateTime, numDaysRandomWordsInitialized} = await loadFixture(
        deployContracts
      );
      const {timestamp: currentTimestamp} = (await ethers.provider.getBlock("latest")) as Block;
      expect(await world.hasRandomWord(currentTimestamp)).to.be.false;
      await ethers.provider.send("evm_increaseTime", [Number(minRandomWordsUpdateTime)]);
      await ethers.provider.send("evm_mine", []);
      await world.requestRandomWords();
      await expect(world.requestIds(numDaysRandomWordsInitialized + 1n)).to.be.reverted;
      let requestId = await world.requestIds(numDaysRandomWordsInitialized);
      await mockVRF.fulfill(requestId, world);
      expect(await world.hasRandomWord(currentTimestamp)).to.be.false;
      await world.requestRandomWords();
      requestId = await world.requestIds(numDaysRandomWordsInitialized + 1n);
      await mockVRF.fulfill(requestId, world);
      expect(await world.hasRandomWord(currentTimestamp)).to.be.true;
      await expect(world.getRandomWord(currentTimestamp)).to.not.be.reverted;
      // Gives unhandled project rejection for some reason
      // Before 5 day offset
      await expect(
        world.getRandomWord(BigInt(currentTimestamp) - minRandomWordsUpdateTime * 6n)
      ).to.be.revertedWithCustomError(world, "NoValidRandomWord");
      // After offset
      await expect(
        world.getRandomWord(BigInt(currentTimestamp) + minRandomWordsUpdateTime)
      ).to.be.revertedWithCustomError(world, "NoValidRandomWord");
    });

    it("Get multiple words", async function () {
      const {world, mockVRF, minRandomWordsUpdateTime, numDaysRandomWordsInitialized} = await loadFixture(
        deployContracts
      );
      const {timestamp: currentTimestamp} = (await ethers.provider.getBlock("latest")) as Block;
      await expect(world.getMultipleWords(currentTimestamp)).to.be.revertedWithCustomError(world, "NoValidRandomWord");
      await ethers.provider.send("evm_increaseTime", [Number(minRandomWordsUpdateTime)]);
      await ethers.provider.send("evm_mine", []);
      await world.requestRandomWords();
      let requestId = await world.requestIds(numDaysRandomWordsInitialized);
      await mockVRF.fulfill(requestId, world);
      await expect(world.getMultipleWords(currentTimestamp)).to.be.revertedWithCustomError(world, "NoValidRandomWord");
      await world.requestRandomWords();
      requestId = await world.requestIds(numDaysRandomWordsInitialized + 1n);
      await expect(mockVRF.fulfill(requestId, world)).to.not.be.reverted;
    });
  });
});
