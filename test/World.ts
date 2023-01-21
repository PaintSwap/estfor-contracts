import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {expect} from "chai";
import {ethers} from "hardhat";
import {COMBAT_BASE, COMBAT_MAX, getActionId, NONE, Skill} from "../scripts/utils";

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
      await world.getSeed(currentTimestamp + minSeedUpdateTime);
      // Gives unhandled project rejection for some reason
      // Before offset
      await expect(world.getSeed(currentTimestamp)).to.be.reverted;
      // After offset
      await expect(world.getSeed(currentTimestamp + minSeedUpdateTime * 2)).to.be.reverted;
    });
  });

  describe("Actions", () => {
    it("Add/Edit/Delete normal", async () => {
      const {world} = await loadFixture(deployContracts);
      const actionAvailable = false;
      let tx = await world.addAction({
        info: {
          skill: Skill.ATTACK,
          baseXPPerHour: 3600,
          minSkillPoints: 0,
          isDynamic: false,
          itemTokenIdRangeMin: COMBAT_BASE,
          itemTokenIdRangeMax: COMBAT_MAX,
          auxItemTokenIdRangeMin: NONE,
          auxItemTokenIdRangeMax: NONE,
          isAvailable: actionAvailable,
        },
        dropRewards: [],
        lootChances: [],
      });
      const actionId = await getActionId(tx);
      expect((await world.actions(actionId)).skill).to.eq(Skill.ATTACK);
      await world.editAction(actionId, {
        info: {
          skill: Skill.ATTACK,
          baseXPPerHour: 20,
          minSkillPoints: 0,
          isDynamic: false,
          itemTokenIdRangeMin: COMBAT_BASE,
          itemTokenIdRangeMax: COMBAT_MAX,
          auxItemTokenIdRangeMin: NONE,
          auxItemTokenIdRangeMax: NONE,
          isAvailable: actionAvailable,
        },
        dropRewards: [],
        lootChances: [],
      });
      expect((await world.actions(actionId)).baseXPPerHour).to.eq(20);
      expect((await world.actions(actionId)).isAvailable).to.be.false;
      await world.setAvailable(actionId, true);
      expect((await world.actions(actionId)).isAvailable).to.be.true;
      await world.setAvailable(actionId, false);
      expect((await world.actions(actionId)).isAvailable).to.be.false;

      // Set available on an action that is dynamic (this should be random only)
      await world.editAction(actionId, {
        info: {
          skill: Skill.ATTACK,
          baseXPPerHour: 3600,
          minSkillPoints: 0,
          isDynamic: true,
          itemTokenIdRangeMin: COMBAT_BASE,
          itemTokenIdRangeMax: COMBAT_MAX,
          auxItemTokenIdRangeMin: NONE,
          auxItemTokenIdRangeMax: NONE,
          isAvailable: actionAvailable,
        },
        dropRewards: [],
        lootChances: [],
      });
      await expect(world.setAvailable(actionId, false)).to.be.reverted;
    });

    it("Dynamic actions", async () => {
      // Dynamic actions TODO
    });
  });
});
