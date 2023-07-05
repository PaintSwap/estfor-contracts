import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {EstforConstants, EstforTypes} from "@paintswap/estfor-definitions";
import {SHADOW_SCROLL} from "@paintswap/estfor-definitions/constants";
import {ActionInput, defaultActionChoice} from "@paintswap/estfor-definitions/types";
import {expect} from "chai";
import {ethers, upgrades} from "hardhat";
import {getActionId, getRequestId, RATE_MUL, SPAWN_MUL} from "./utils";
import {allDailyRewards, allWeeklyRewards} from "../scripts/data/dailyRewards";

describe("World", function () {
  const deployContracts = async function () {
    // Contracts are deployed using the first signer/account by default
    const [owner, alice] = await ethers.getSigners();

    const MockOracleClient = await ethers.getContractFactory("MockOracleClient");
    const mockOracleClient = await MockOracleClient.deploy();

    // Add some dummy blocks so that world can access them
    for (let i = 0; i < 5; ++i) {
      await owner.sendTransaction({
        to: owner.address,
        value: 1,
      });
    }

    // Create the world
    const WorldLibrary = await ethers.getContractFactory("WorldLibrary");
    const worldLibrary = await WorldLibrary.deploy();
    const subscriptionId = 2;
    const World = await ethers.getContractFactory("World", {libraries: {WorldLibrary: worldLibrary.address}});
    const world = await upgrades.deployProxy(
      World,
      [mockOracleClient.address, subscriptionId, allDailyRewards, allWeeklyRewards],
      {
        kind: "uups",
        unsafeAllow: ["delegatecall", "external-library-linking"],
      }
    );

    const minRandomWordsUpdateTime = await world.MIN_RANDOM_WORDS_UPDATE_TIME();

    return {
      world,
      worldLibrary,
      mockOracleClient,
      minRandomWordsUpdateTime,
      owner,
      alice,
    };
  };

  describe("Seed", function () {
    it("Requesting random words", async function () {
      const {world, mockOracleClient, minRandomWordsUpdateTime} = await loadFixture(deployContracts);
      await world.requestRandomWords();

      const startOffset = 4;
      let requestId = await world.requestIds(startOffset);
      expect(requestId).to.be.greaterThanOrEqual(1);

      let randomWord = await world.randomWords(requestId, 0);
      expect(randomWord).to.eq(0);

      // Retrieve the random number
      await mockOracleClient.fulfill(requestId, world.address);
      randomWord = await world.randomWords(requestId, 0);
      expect(randomWord).to.not.eq(0);

      // Try fulfill same request should fail
      await expect(mockOracleClient.fulfill(requestId, world.address)).to.be.reverted;

      // Requesting new random word too soon
      await expect(world.requestRandomWords()).to.be.reverted;

      // Increase time and check it works
      await ethers.provider.send("evm_increaseTime", [minRandomWordsUpdateTime]);
      await world.requestRandomWords();
      requestId = await world.requestIds(startOffset + 1);
      await mockOracleClient.fulfill(requestId, world.address);

      // Increase it 2x more, should allow 2 random seeds to be requested
      await ethers.provider.send("evm_increaseTime", [minRandomWordsUpdateTime * 2]);
      await world.requestRandomWords();
      requestId = await world.requestIds(startOffset + 2);
      await mockOracleClient.fulfill(requestId, world.address);
      await world.requestRandomWords();
      requestId = await world.requestIds(startOffset + 3);
      await mockOracleClient.fulfill(requestId, world.address);
      await expect(world.requestRandomWords()).to.be.reverted;
      await expect(world.requestIds(startOffset + 4)).to.be.reverted;
    });

    it("getRandomWord", async function () {
      const {world, mockOracleClient, minRandomWordsUpdateTime} = await loadFixture(deployContracts);
      const {timestamp: currentTimestamp} = await ethers.provider.getBlock("latest");
      expect(await world.hasRandomWord(currentTimestamp)).to.be.false;
      await ethers.provider.send("evm_increaseTime", [minRandomWordsUpdateTime]);
      await world.requestRandomWords();
      await expect(world.requestIds(5)).to.be.reverted;
      let requestId = await world.requestIds(4);
      await mockOracleClient.fulfill(requestId, world.address);
      expect(await world.hasRandomWord(currentTimestamp)).to.be.false;
      await world.requestRandomWords();
      requestId = await world.requestIds(5);
      await mockOracleClient.fulfill(requestId, world.address);
      expect(await world.hasRandomWord(currentTimestamp)).to.be.true;
      await expect(world.getRandomWord(currentTimestamp)).to.not.be.reverted;
      // Gives unhandled project rejection for some reason
      // Before 5 day offset
      await expect(world.getRandomWord(currentTimestamp - minRandomWordsUpdateTime * 6)).to.be.revertedWithCustomError(
        world,
        "NoValidRandomWord"
      );
      // After offset
      await expect(world.getRandomWord(currentTimestamp + minRandomWordsUpdateTime)).to.be.revertedWithCustomError(
        world,
        "NoValidRandomWord"
      );
    });

    it("Get full/multiple words", async function () {
      const {world, mockOracleClient, minRandomWordsUpdateTime} = await loadFixture(deployContracts);
      const {timestamp: currentTimestamp} = await ethers.provider.getBlock("latest");
      await expect(world.getFullRandomWords(currentTimestamp)).to.be.revertedWithCustomError(
        world,
        "NoValidRandomWord"
      );
      await expect(world.getMultipleFullRandomWords(currentTimestamp)).to.be.revertedWithCustomError(
        world,
        "NoValidRandomWord"
      );
      await ethers.provider.send("evm_increaseTime", [minRandomWordsUpdateTime]);
      await world.requestRandomWords();
      let requestId = await world.requestIds(4);
      await mockOracleClient.fulfill(requestId, world.address);
      await expect(world.getFullRandomWords(currentTimestamp)).to.be.revertedWithCustomError(
        world,
        "NoValidRandomWord"
      );
      await expect(world.getMultipleFullRandomWords(currentTimestamp)).to.be.revertedWithCustomError(
        world,
        "NoValidRandomWord"
      );
      await world.requestRandomWords();
      requestId = await world.requestIds(5);
      await mockOracleClient.fulfill(requestId, world.address);

      const fullWords = await world.getFullRandomWords(currentTimestamp);
      const multipleWords = await world.getMultipleFullRandomWords(currentTimestamp);
      expect(fullWords).to.eql(multipleWords[0]);
      expect(multipleWords.length).to.eq(5);
      for (let i = 0; i < 5; ++i) {
        expect(multipleWords[i][0]).to.not.eq(0);
        expect(multipleWords[i][1]).to.not.eq(0);
        expect(multipleWords[i][2]).to.not.eq(0);
      }
    });

    it("Test new random rewards", async function () {
      const {world, mockOracleClient} = await loadFixture(deployContracts);

      const oneDay = 24 * 3600;
      const oneWeek = oneDay * 7;
      let {timestamp: currentTimestamp} = await ethers.provider.getBlock("latest");
      let timestamp = Math.floor((currentTimestamp - 4 * oneDay) / oneWeek) * oneWeek + (oneWeek + 4 * oneDay) + 1; // Start next monday
      await ethers.provider.send("evm_setNextBlockTimestamp", [timestamp]);

      let dailyRewards = await world.activeDailyAndWeeklyRewards(1);

      // Keep requesting
      let error = false;
      while (!error) {
        try {
          const tx = await world.requestRandomWords();
          let requestId = getRequestId(tx);
          await mockOracleClient.fulfill(requestId, world.address);
        } catch {
          error = true;
        }
      }

      // Do another week check that the dailyRewards are different
      expect(await world.activeDailyAndWeeklyRewards(1)).to.not.eql(dailyRewards);
      dailyRewards = await world.activeDailyAndWeeklyRewards(1);
      ({timestamp: currentTimestamp} = await ethers.provider.getBlock("latest"));
      timestamp = currentTimestamp + oneWeek; // Start next monday
      await ethers.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      error = false;
      while (!error) {
        try {
          const tx = await world.requestRandomWords();
          let requestId = getRequestId(tx);
          await mockOracleClient.fulfill(requestId, world.address);
        } catch {
          error = true;
        }
      }

      expect(await world.activeDailyAndWeeklyRewards(1)).to.not.eql(dailyRewards);
      dailyRewards = await world.activeDailyAndWeeklyRewards(1);
    });
  });

  describe("Actions", function () {
    it("Add/Edit/Delete normal", async function () {
      const {world} = await loadFixture(deployContracts);
      const actionAvailable = false;

      const actionInfo = {
        skill: EstforTypes.Skill.COMBAT,
        xpPerHour: 3600,
        minXP: 0,
        isDynamic: false,
        worldLocation: 0,
        isFullModeOnly: false,
        numSpawned: 1 * SPAWN_MUL,
        handItemTokenIdRangeMin: EstforConstants.COMBAT_BASE,
        handItemTokenIdRangeMax: EstforConstants.COMBAT_MAX,
        isAvailable: actionAvailable,
        actionChoiceRequired: true,
        successPercent: 100,
      };

      let tx = await world.addActions([
        {
          actionId: 1,
          info: actionInfo,
          guaranteedRewards: [],
          randomRewards: [],
          combatStats: EstforTypes.emptyCombatStats,
        },
      ]);
      const actionId = await getActionId(tx);
      expect((await world.actions(actionId)).skill).to.eq(EstforTypes.Skill.COMBAT);

      actionInfo.xpPerHour = 20;
      await world.editActions([
        {
          actionId,
          info: actionInfo,
          guaranteedRewards: [],
          randomRewards: [],
          combatStats: EstforTypes.emptyCombatStats,
        },
      ]);
      expect((await world.actions(actionId)).xpPerHour).to.eq(20);
      expect((await world.actions(actionId)).isAvailable).to.be.false;
      actionInfo.isAvailable = true;
      await world.editActions([
        {
          actionId,
          info: actionInfo,
          guaranteedRewards: [],
          randomRewards: [],
          combatStats: EstforTypes.emptyCombatStats,
        },
      ]);
      expect((await world.actions(actionId)).isAvailable).to.be.true;
      actionInfo.isAvailable = false;
      await world.editActions([
        {
          actionId,
          info: actionInfo,
          guaranteedRewards: [],
          randomRewards: [],
          combatStats: EstforTypes.emptyCombatStats,
        },
      ]);
      expect((await world.actions(actionId)).isAvailable).to.be.false;
    });

    it("Dynamic actions", async function () {
      // Dynamic actions TODO
    });
  });

  describe("ActionChoices", function () {
    it("Cannot use id 0", async function () {
      const {world} = await loadFixture(deployContracts);
      const choiceId = 0;
      await expect(
        world.addBulkActionChoices(
          [EstforConstants.NONE],
          [[choiceId]],
          [
            [
              {
                ...defaultActionChoice,
                skill: EstforTypes.Skill.MAGIC,
                skillDiff: 2,
                minXP: 0,
                rate: 1 * RATE_MUL,
                inputTokenId1: EstforConstants.AIR_SCROLL,
                inputAmount1: 1,
              },
            ],
          ]
        )
      ).to.be.reverted;
    });

    it("Edit", async function () {
      const {world} = await loadFixture(deployContracts);

      const choiceId = 1;
      await world.addBulkActionChoices(
        [EstforConstants.NONE],
        [[choiceId]],
        [
          [
            {
              ...defaultActionChoice,
              skill: EstforTypes.Skill.MAGIC,
              skillDiff: 2,
              xpPerHour: 0,
              minXP: 0,
              rate: 1 * RATE_MUL,
              inputTokenId1: EstforConstants.AIR_SCROLL,
              inputAmount1: 1,
            },
          ],
        ]
      );

      await world.editActionChoices(
        [EstforConstants.NONE],
        [choiceId],
        [
          {
            ...defaultActionChoice,
            skill: EstforTypes.Skill.MAGIC,
            skillDiff: 2,
            rate: 1 * RATE_MUL,
            inputTokenId1: EstforConstants.AIR_SCROLL,
            inputAmount1: 2,
          },
        ]
      );

      let actionChoice = await world.getActionChoice(EstforConstants.NONE, choiceId);
      expect(actionChoice.inputAmount1).to.eq(2);
      expect((await world.getActionChoice(EstforConstants.NONE, 2)).skill).to.eq(EstforTypes.Skill.NONE);

      await world.editActionChoices(
        [EstforConstants.NONE],
        [choiceId],
        [
          {
            ...defaultActionChoice,
            skill: EstforTypes.Skill.MAGIC,
            skillDiff: 2,
            rate: 1 * RATE_MUL,
            inputTokenId1: EstforConstants.AIR_SCROLL,
            inputAmount1: 10,
          },
        ]
      );
      actionChoice = await world.getActionChoice(EstforConstants.NONE, choiceId);
      expect(actionChoice.inputAmount1).to.eq(10);
    });
  });

  describe("ActionRewards", function () {
    it("Guaranteed reward order", async function () {
      const {world, worldLibrary} = await loadFixture(deployContracts);
      const actionAvailable = false;
      const action: ActionInput = {
        actionId: 1,
        info: {
          skill: EstforTypes.Skill.COMBAT,
          xpPerHour: 3600,
          minXP: 0,
          isDynamic: false,
          worldLocation: 0,
          isFullModeOnly: false,
          numSpawned: 1 * SPAWN_MUL,
          handItemTokenIdRangeMin: EstforConstants.COMBAT_BASE,
          handItemTokenIdRangeMax: EstforConstants.COMBAT_MAX,
          isAvailable: actionAvailable,
          actionChoiceRequired: true,
          successPercent: 100,
        },
        guaranteedRewards: [
          {itemTokenId: EstforConstants.SHADOW_SCROLL, rate: 300},
          {itemTokenId: EstforConstants.AIR_SCROLL, rate: 200},
          {itemTokenId: EstforConstants.HELL_SCROLL, rate: 100},
        ],
        randomRewards: [],
        combatStats: EstforTypes.emptyCombatStats,
      };

      await expect(world.addActions([action])).to.be.revertedWithCustomError(
        worldLibrary,
        "GuaranteedRewardsMustBeInOrder"
      );
      action.guaranteedRewards[0].rate = 50;
      await expect(world.addActions([action])).to.be.revertedWithCustomError(
        worldLibrary,
        "GuaranteedRewardsMustBeInOrder"
      );
      action.guaranteedRewards[1].rate = 150;
      await expect(world.addActions([action])).to.be.revertedWithCustomError(
        worldLibrary,
        "GuaranteedRewardsMustBeInOrder"
      );
      action.guaranteedRewards[2].rate = 150;
      await expect(world.addActions([action])).to.not.be.reverted;
    });

    it("Guaranteed reward duplicates not allowed", async function () {
      const {world, worldLibrary} = await loadFixture(deployContracts);
      const actionAvailable = false;
      const action: ActionInput = {
        actionId: 1,
        info: {
          skill: EstforTypes.Skill.COMBAT,
          xpPerHour: 3600,
          minXP: 0,
          isDynamic: false,
          worldLocation: 0,
          isFullModeOnly: false,
          numSpawned: 1 * SPAWN_MUL,
          handItemTokenIdRangeMin: EstforConstants.COMBAT_BASE,
          handItemTokenIdRangeMax: EstforConstants.COMBAT_MAX,
          isAvailable: actionAvailable,
          actionChoiceRequired: true,
          successPercent: 100,
        },
        guaranteedRewards: [
          {itemTokenId: EstforConstants.AIR_SCROLL, rate: 100},
          {itemTokenId: EstforConstants.AIR_SCROLL, rate: 200},
        ],
        randomRewards: [],
        combatStats: EstforTypes.emptyCombatStats,
      };

      await expect(world.addActions([action])).to.be.revertedWithCustomError(
        worldLibrary,
        "GuaranteedRewardsNoDuplicates"
      );
      action.guaranteedRewards[0].itemTokenId = SHADOW_SCROLL;
      await expect(world.addActions([action])).to.not.be.reverted;
    });

    it("Only multiple guaranteed rewards allowed for combat", async function () {
      const {world} = await loadFixture(deployContracts);
      const actionAvailable = false;
      const action: ActionInput = {
        actionId: 1,
        info: {
          skill: EstforTypes.Skill.COOKING,
          xpPerHour: 3600,
          minXP: 0,
          isDynamic: false,
          worldLocation: 0,
          isFullModeOnly: false,
          numSpawned: 1 * SPAWN_MUL,
          handItemTokenIdRangeMin: EstforConstants.NONE,
          handItemTokenIdRangeMax: EstforConstants.NONE,
          isAvailable: actionAvailable,
          actionChoiceRequired: true,
          successPercent: 100,
        },
        guaranteedRewards: [
          {itemTokenId: EstforConstants.AIR_SCROLL, rate: 100},
          {itemTokenId: EstforConstants.SHADOW_SCROLL, rate: 200},
        ],
        randomRewards: [],
        combatStats: EstforTypes.emptyCombatStats,
      };

      await expect(world.addActions([action])).to.be.revertedWithCustomError(
        world,
        "OnlyCombatMultipleGuaranteedRewards"
      );

      action.info.skill = EstforTypes.Skill.COMBAT;
      await expect(world.addActions([action])).to.not.be.reverted;
    });

    it("Random reward order", async function () {
      const {world, worldLibrary} = await loadFixture(deployContracts);
      const actionAvailable = false;
      const action: ActionInput = {
        actionId: 1,
        info: {
          skill: EstforTypes.Skill.COMBAT,
          xpPerHour: 3600,
          minXP: 0,
          isDynamic: false,
          worldLocation: 0,
          isFullModeOnly: false,
          numSpawned: 1 * SPAWN_MUL,
          handItemTokenIdRangeMin: EstforConstants.COMBAT_BASE,
          handItemTokenIdRangeMax: EstforConstants.COMBAT_MAX,
          isAvailable: actionAvailable,
          actionChoiceRequired: true,
          successPercent: 100,
        },
        guaranteedRewards: [],
        randomRewards: [
          {itemTokenId: EstforConstants.SHADOW_SCROLL, chance: 30, amount: 1},
          {itemTokenId: EstforConstants.AIR_SCROLL, chance: 50, amount: 1},
          {itemTokenId: EstforConstants.AQUA_SCROLL, chance: 100, amount: 1},
          {itemTokenId: EstforConstants.HELL_SCROLL, chance: 200, amount: 1},
        ],
        combatStats: EstforTypes.emptyCombatStats,
      };

      await expect(world.addActions([action])).to.be.revertedWithCustomError(
        worldLibrary,
        "RandomRewardsMustBeInOrder"
      );
      action.randomRewards[0].chance = 300;
      await expect(world.addActions([action])).to.be.revertedWithCustomError(
        worldLibrary,
        "RandomRewardsMustBeInOrder"
      );
      action.randomRewards[1].chance = 250;
      await expect(world.addActions([action])).to.be.revertedWithCustomError(
        worldLibrary,
        "RandomRewardsMustBeInOrder"
      );
      action.randomRewards[2].chance = 225;
      await expect(world.addActions([action])).to.not.be.reverted;
    });

    it("Random reward duplicate not allowed", async function () {
      const {world, worldLibrary} = await loadFixture(deployContracts);
      const actionAvailable = false;
      const action: ActionInput = {
        actionId: 1,
        info: {
          skill: EstforTypes.Skill.COMBAT,
          xpPerHour: 3600,
          minXP: 0,
          isDynamic: false,
          worldLocation: 0,
          isFullModeOnly: false,
          numSpawned: 1 * SPAWN_MUL,
          handItemTokenIdRangeMin: EstforConstants.COMBAT_BASE,
          handItemTokenIdRangeMax: EstforConstants.COMBAT_MAX,
          isAvailable: actionAvailable,
          actionChoiceRequired: true,
          successPercent: 100,
        },
        guaranteedRewards: [],
        randomRewards: [
          {itemTokenId: EstforConstants.AIR_SCROLL, chance: 200, amount: 1},
          {itemTokenId: EstforConstants.AIR_SCROLL, chance: 100, amount: 1},
        ],
        combatStats: EstforTypes.emptyCombatStats,
      };

      await expect(world.addActions([action])).to.be.revertedWithCustomError(worldLibrary, "RandomRewardNoDuplicates");
      action.randomRewards[0].itemTokenId = SHADOW_SCROLL;
      await expect(world.addActions([action])).to.not.be.reverted;
    });

    it("Only combat can have both guaranteed and random rewards", async function () {
      const {world} = await loadFixture(deployContracts);
      const actionAvailable = false;
      const action: ActionInput = {
        actionId: 1,
        info: {
          skill: EstforTypes.Skill.COOKING,
          xpPerHour: 3600,
          minXP: 0,
          isDynamic: false,
          worldLocation: 0,
          isFullModeOnly: false,
          numSpawned: 1 * SPAWN_MUL,
          handItemTokenIdRangeMin: EstforConstants.COMBAT_BASE,
          handItemTokenIdRangeMax: EstforConstants.COMBAT_MAX,
          isAvailable: actionAvailable,
          actionChoiceRequired: true,
          successPercent: 100,
        },
        guaranteedRewards: [{itemTokenId: EstforConstants.AIR_SCROLL, rate: 100}],
        randomRewards: [{itemTokenId: EstforConstants.AIR_SCROLL, chance: 100, amount: 1}],
        combatStats: EstforTypes.emptyCombatStats,
      };

      await expect(world.addActions([action])).to.be.revertedWithCustomError(
        world,
        "NonCombatCannotHaveBothGuaranteedAndRandomRewards"
      );
      action.info.skill = EstforTypes.Skill.COMBAT;
      await expect(world.addActions([action])).to.not.be.reverted;
    });
  });
});
