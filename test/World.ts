import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {expect} from "chai";
import {ethers} from "hardhat";

describe("World", () => {
  const deployContracts = async () => {
    // Contracts are deployed using the first signer/account by default
    const [owner, alice] = await ethers.getSigners();

    const MockOracleClient = await ethers.getContractFactory("MockOracleClient");
    const mockOracleClient = await MockOracleClient.deploy();

    // Create the world
    const subscriptionId = 2;
    const World = await ethers.getContractFactory("World");
    const world = await World.deploy(mockOracleClient.address, subscriptionId);

    const minSeedUpdateTime = await world.MIN_SEED_UPDATE_TIME();

    return {
      world,
      mockOracleClient,
      minSeedUpdateTime,
      owner,
      alice,
    };
  };

  describe("Seed", () => {
    it("Requesting random words", async () => {
      const {world, mockOracleClient, minSeedUpdateTime} = await loadFixture(deployContracts);
      await world.requestSeedUpdate();

      let requestId = await world.requestIds(0);
      expect(requestId).to.be.greaterThanOrEqual(1);

      let randomWord = await world.randomWords(requestId);
      expect(randomWord).to.eq(0);

      // Retrieve the random number
      await mockOracleClient.fulfill(requestId, world.address);
      randomWord = await world.randomWords(requestId);
      expect(randomWord).to.not.eq(0);

      // Try fulfill same request should fail
      await expect(mockOracleClient.fulfill(requestId, world.address)).to.be.reverted;

      // Requesting new seed too soon
      await expect(world.requestSeedUpdate()).to.be.reverted;

      // Increase time and check it works
      await ethers.provider.send("evm_increaseTime", [minSeedUpdateTime]);
      await world.requestSeedUpdate();
      requestId = await world.requestIds(1);
      await mockOracleClient.fulfill(requestId, world.address);

      // Increase it 2x more, should allow 2 random seeds to be requested
      await ethers.provider.send("evm_increaseTime", [minSeedUpdateTime * 2]);
      await world.requestSeedUpdate();
      requestId = await world.requestIds(2);
      await mockOracleClient.fulfill(requestId, world.address);
      await world.requestSeedUpdate();
      requestId = await world.requestIds(3);
      await mockOracleClient.fulfill(requestId, world.address);
      await expect(world.requestSeedUpdate()).to.be.reverted;
    });

    it("getSeed", async () => {
      const {world, mockOracleClient, minSeedUpdateTime} = await loadFixture(deployContracts);
      await world.requestSeedUpdate();

      let requestId = await world.requestIds(0);
      await mockOracleClient.fulfill(requestId, world.address);

      const blockNum = await ethers.provider.getBlockNumber();
      const currentBlock = await ethers.provider.getBlock(blockNum);
      const currentTimestamp = currentBlock.timestamp;
      // Before
      await world.getSeed(currentTimestamp + minSeedUpdateTime); // Works
      // Gives unhandled project rejection for some reason
      await expect(world.getSeed(currentTimestamp)).to.be.reverted;
      await expect(world.getSeed(currentTimestamp + minSeedUpdateTime * 2)).to.be.reverted;
    });
  });
});
