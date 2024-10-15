import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {EstforConstants, EstforTypes} from "@paintswap/estfor-definitions";
import {SHADOW_SCROLL} from "@paintswap/estfor-definitions/constants";
import {ActionChoiceInput, ActionInput, Skill, defaultActionChoice} from "@paintswap/estfor-definitions/types";
import {expect} from "chai";
import {ethers, upgrades} from "hardhat";
import {getActionId, RATE_MUL, requestAndFulfillRandomWords, SPAWN_MUL} from "./utils";
import {setDailyAndWeeklyRewards} from "../scripts/utils";
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
        maxFeePerGas: 1,
      });
    }
    // Create the world
    const WorldLibrary = await ethers.getContractFactory("WorldLibrary");
    const worldLibrary = await WorldLibrary.deploy();
    const World = await ethers.getContractFactory("World", {
      libraries: {WorldLibrary: await worldLibrary.getAddress()},
    });
    const world = (await upgrades.deployProxy(World, [await mockVRF.getAddress()], {
      kind: "uups",
      unsafeAllow: ["delegatecall", "external-library-linking"],
    })) as unknown as World;

    await setDailyAndWeeklyRewards(world);

    const minRandomWordsUpdateTime = await world.MIN_RANDOM_WORDS_UPDATE_TIME();

    const numDaysRandomWordsInitialized = await world.NUM_DAYS_RANDOM_WORDS_INITIALIZED();

    return {
      world,
      worldLibrary,
      mockVRF,
      minRandomWordsUpdateTime,
      numDaysRandomWordsInitialized,
      owner,
      alice,
    };
  };

  describe("Seed", function () {
    it("Requesting random words", async function () {
      const {world, mockVRF, minRandomWordsUpdateTime, numDaysRandomWordsInitialized} =
        await loadFixture(deployContracts);
      await world.requestRandomWords();

      const startOffset = numDaysRandomWordsInitialized;
      let requestId = await world.requestIds(startOffset);
      expect(requestId).to.be.greaterThanOrEqual(1);

      let randomWord = await world.randomWords(requestId);
      expect(randomWord).to.eq(0);

      // Retrieve the random number
      await mockVRF.fulfill(requestId, await world.getAddress());
      randomWord = await world.randomWords(requestId);
      expect(randomWord).to.not.eq(0);

      // Try fulfill same request should fail
      await expect(mockVRF.fulfill(requestId, await world.getAddress())).to.be.reverted;

      // Requesting new random word too soon
      await expect(world.requestRandomWords()).to.be.reverted;

      // Increase time and check it works
      await ethers.provider.send("evm_increaseTime", [minRandomWordsUpdateTime.toString()]);
      await ethers.provider.send("evm_mine", []);
      await world.requestRandomWords();
      requestId = await world.requestIds(startOffset + 1n);
      await mockVRF.fulfill(requestId, await world.getAddress());

      // Increase it 2x more, should allow 2 random seeds to be requested
      await ethers.provider.send("evm_increaseTime", [Number(minRandomWordsUpdateTime * 2n)]);
      await ethers.provider.send("evm_mine", []);
      await world.requestRandomWords();
      requestId = await world.requestIds(startOffset + 2n);
      await mockVRF.fulfill(requestId, await world.getAddress());
      await world.requestRandomWords();
      requestId = await world.requestIds(startOffset + 3n);
      await mockVRF.fulfill(requestId, await world.getAddress());
      await expect(world.requestRandomWords()).to.be.reverted;
      await expect(world.requestIds(startOffset + 4n)).to.be.reverted;
    });

    it("getRandomWord", async function () {
      const {world, mockVRF, minRandomWordsUpdateTime, numDaysRandomWordsInitialized} =
        await loadFixture(deployContracts);
      const {timestamp: currentTimestamp} = (await ethers.provider.getBlock("latest")) as Block;
      expect(await world.hasRandomWord(currentTimestamp)).to.be.false;
      await ethers.provider.send("evm_increaseTime", [Number(minRandomWordsUpdateTime)]);
      await ethers.provider.send("evm_mine", []);
      await world.requestRandomWords();
      await expect(world.requestIds(numDaysRandomWordsInitialized + 1n)).to.be.reverted;
      let requestId = await world.requestIds(numDaysRandomWordsInitialized);
      await mockVRF.fulfill(requestId, await world.getAddress());
      expect(await world.hasRandomWord(currentTimestamp)).to.be.false;
      await world.requestRandomWords();
      requestId = await world.requestIds(numDaysRandomWordsInitialized + 1n);
      await mockVRF.fulfill(requestId, await world.getAddress());
      expect(await world.hasRandomWord(currentTimestamp)).to.be.true;
      await expect(world.getRandomWord(currentTimestamp)).to.not.be.reverted;
      // Gives unhandled project rejection for some reason
      // Before 5 day offset
      await expect(
        world.getRandomWord(BigInt(currentTimestamp) - minRandomWordsUpdateTime * 6n),
      ).to.be.revertedWithCustomError(world, "NoValidRandomWord");
      // After offset
      await expect(
        world.getRandomWord(BigInt(currentTimestamp) + minRandomWordsUpdateTime),
      ).to.be.revertedWithCustomError(world, "NoValidRandomWord");
    });

    it("Get multiple words", async function () {
      const {world, mockVRF, minRandomWordsUpdateTime, numDaysRandomWordsInitialized} =
        await loadFixture(deployContracts);
      const {timestamp: currentTimestamp} = (await ethers.provider.getBlock("latest")) as Block;
      await expect(world.getMultipleWords(currentTimestamp)).to.be.revertedWithCustomError(world, "NoValidRandomWord");
      await ethers.provider.send("evm_increaseTime", [Number(minRandomWordsUpdateTime)]);
      await ethers.provider.send("evm_mine", []);
      await world.requestRandomWords();
      let requestId = await world.requestIds(numDaysRandomWordsInitialized);
      await mockVRF.fulfill(requestId, await world.getAddress());
      await expect(world.getMultipleWords(currentTimestamp)).to.be.revertedWithCustomError(world, "NoValidRandomWord");
      await world.requestRandomWords();
      requestId = await world.requestIds(numDaysRandomWordsInitialized + 1n);
      await expect(mockVRF.fulfill(requestId, await world.getAddress())).to.not.be.reverted;
    });

    it("Test new random rewards", async function () {
      const {world, mockVRF} = await loadFixture(deployContracts);

      const playerId = 1;

      const oneDay = 24 * 3600;
      const oneWeek = oneDay * 7;
      let {timestamp: current1} = (await ethers.provider.getBlock("latest")) as Block;
      let timestamp = Math.floor((current1 - 4 * oneDay) / oneWeek) * oneWeek + (oneWeek + 4 * oneDay) + 1; // Start next monday
      await ethers.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await ethers.provider.send("evm_mine", []);

      let dailyRewards = await world.getActiveDailyAndWeeklyRewards(1, playerId);

      // Keep requesting
      let error = false;
      while (!error) {
        try {
          await requestAndFulfillRandomWords(world, mockVRF);
        } catch {
          error = true;
        }
      }

      // Do another week check that the dailyRewards are different
      expect(await world.getActiveDailyAndWeeklyRewards(1, playerId)).to.not.eql(dailyRewards);
      dailyRewards = await world.getActiveDailyAndWeeklyRewards(1, playerId);
      let {timestamp: current2} = (await ethers.provider.getBlock("latest")) as Block;
      timestamp = current2 + oneWeek; // Start next monday
      await ethers.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await ethers.provider.send("evm_mine", []);
      error = false;
      while (!error) {
        try {
          await requestAndFulfillRandomWords(world, mockVRF);
        } catch {
          error = true;
        }
      }

      expect(await world.getActiveDailyAndWeeklyRewards(1, playerId)).to.not.eql(dailyRewards);
      dailyRewards = await world.getActiveDailyAndWeeklyRewards(1, playerId);
    });

    it("Tiered random rewards", async function () {
      const {world, mockVRF} = await loadFixture(deployContracts);

      const playerId = 1;
      const oneDay = 24 * 3600;
      const oneWeek = oneDay * 7;
      let {timestamp: currentTimestamp} = (await ethers.provider.getBlock("latest")) as Block;
      let timestamp = Math.floor((currentTimestamp - 4 * oneDay) / oneWeek) * oneWeek + (oneWeek + 4 * oneDay) + 1; // Start next monday
      await ethers.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await ethers.provider.send("evm_mine", []);

      // Keep requesting
      while (true) {
        try {
          await requestAndFulfillRandomWords(world, mockVRF);
        } catch {
          break;
        }
      }

      let dailyRewards = await world.getActiveDailyAndWeeklyRewards(1, playerId);
      let dailyRewards1 = await world.getActiveDailyAndWeeklyRewards(1, playerId + 1);
      let dailyRewards2 = await world.getActiveDailyAndWeeklyRewards(1, playerId + 2);

      // TODO: Check that incremental playerIds don't have rewards that have incremental indices in the reward pool tier
      expect(dailyRewards).to.not.eql(dailyRewards1);
      expect(dailyRewards).to.not.eql(dailyRewards2);
      expect(dailyRewards1).to.not.eql(dailyRewards2);
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
      const actionId = await getActionId(tx, world);
      const {skill} = await world.actions(actionId);
      expect(skill).to.eq(BigInt(EstforTypes.Skill.COMBAT));

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

    it("Edit to have less guarenteed & random rewards", async function () {
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
          guaranteedRewards: [{itemTokenId: EstforConstants.OAK_LOG, rate: 60 * 10}],
          randomRewards: [{itemTokenId: EstforConstants.BRONZE_ARROW, chance: 1328, amount: 1}],
          combatStats: EstforTypes.emptyCombatStats,
        },
      ]);
      const actionId = await getActionId(tx, world);
      expect((await world.actions(actionId)).skill).to.eq(EstforTypes.Skill.COMBAT);

      await world.editActions([
        {
          actionId,
          info: actionInfo,
          guaranteedRewards: [],
          randomRewards: [],
          combatStats: EstforTypes.emptyCombatStats,
        },
      ]);
      expect((await world.getActionRewards(actionId)).guaranteedRewardTokenId1).to.eq(0);
      expect((await world.getActionRewards(actionId)).randomRewardAmount1).to.eq(0);

      await world.editActions([
        {
          actionId,
          info: actionInfo,
          guaranteedRewards: [{itemTokenId: EstforConstants.OAK_LOG, rate: 60 * 10}],
          randomRewards: [{itemTokenId: EstforConstants.BRONZE_ARROW, chance: 1328, amount: 1}],
          combatStats: EstforTypes.emptyCombatStats,
        },
      ]);

      expect((await world.getActionRewards(actionId)).guaranteedRewardTokenId1).to.eq(EstforConstants.OAK_LOG);
      expect((await world.getActionRewards(actionId)).randomRewardAmount1).to.eq(1);
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
        world.addActionChoices(
          EstforConstants.NONE,
          [choiceId],
          [
            {
              ...defaultActionChoice,
              skill: EstforTypes.Skill.MAGIC,
              skillDiff: 2,
              rate: 1 * RATE_MUL,
              inputTokenIds: [EstforConstants.AIR_SCROLL],
              inputAmounts: [1],
            },
          ],
        ),
      ).to.be.revertedWithCustomError(world, "ActionChoiceIdZeroNotAllowed");
    });

    it("Bulk add action choices", async function () {
      const {world} = await loadFixture(deployContracts);
      await world.addBulkActionChoices(
        [EstforConstants.NONE, EstforConstants.ACTION_ALCHEMY_ITEM],
        [[1], [2, 3]],
        [
          [
            {
              ...defaultActionChoice,
              skill: EstforTypes.Skill.MAGIC,
              skillDiff: 2,
              rate: 1 * RATE_MUL,
              inputTokenIds: [EstforConstants.AIR_SCROLL],
              inputAmounts: [1],
            },
          ],
          [
            {
              ...defaultActionChoice,
              skill: EstforTypes.Skill.ALCHEMY,
              skillDiff: 2,
              rate: 1 * RATE_MUL,
              inputTokenIds: [EstforConstants.AIR_SCROLL],
              inputAmounts: [1],
            },
            {
              ...defaultActionChoice,
              skill: EstforTypes.Skill.ALCHEMY,
              skillDiff: 2,
              rate: 1 * RATE_MUL,
              inputTokenIds: [EstforConstants.AIR_SCROLL],
              inputAmounts: [1],
            },
          ],
        ],
      );

      // Check that they exist
      expect((await world.getActionChoice(EstforConstants.NONE, 1)).skill).to.eq(EstforTypes.Skill.MAGIC);
      expect((await world.getActionChoice(EstforConstants.ACTION_ALCHEMY_ITEM, 2)).skill).to.eq(
        EstforTypes.Skill.ALCHEMY,
      );
      expect((await world.getActionChoice(EstforConstants.ACTION_ALCHEMY_ITEM, 3)).skill).to.eq(
        EstforTypes.Skill.ALCHEMY,
      );
    });

    it("Check input item order", async function () {
      const {world, worldLibrary} = await loadFixture(deployContracts);

      const choiceId = 1;
      const actionChoiceInput: ActionChoiceInput = {
        ...defaultActionChoice,
        skill: EstforTypes.Skill.MAGIC,
        skillDiff: 2,
        xpPerHour: 0,
        rate: 1 * RATE_MUL,
        inputTokenIds: [EstforConstants.BRONZE_ARROW, EstforConstants.IRON_ARROW, EstforConstants.ADAMANTINE_ARROW],
        inputAmounts: [1, 2, 3],
      };

      actionChoiceInput.inputAmounts[0] = 4;
      await expect(
        world.addActionChoices(EstforConstants.NONE, [choiceId], [actionChoiceInput]),
      ).to.be.revertedWithCustomError(worldLibrary, "InputAmountsMustBeInOrder");

      actionChoiceInput.inputAmounts[0] = 1;
      actionChoiceInput.inputAmounts[1] = 4;
      await expect(
        world.addActionChoices(EstforConstants.NONE, [choiceId], [actionChoiceInput]),
      ).to.be.revertedWithCustomError(worldLibrary, "InputAmountsMustBeInOrder");

      actionChoiceInput.inputAmounts[1] = 2;
      actionChoiceInput.inputAmounts[2] = 1;
      await expect(
        world.addActionChoices(EstforConstants.NONE, [choiceId], [actionChoiceInput]),
      ).to.be.revertedWithCustomError(worldLibrary, "InputAmountsMustBeInOrder");

      actionChoiceInput.inputAmounts[2] = 3;
      expect(await world.addActionChoices(EstforConstants.NONE, [choiceId], [actionChoiceInput])).to.not.be.reverted;
    });

    it("Check input item validation", async function () {
      const {world, worldLibrary} = await loadFixture(deployContracts);

      const choiceId = 1;
      const actionChoiceInput: ActionChoiceInput = {
        ...defaultActionChoice,
        skill: EstforTypes.Skill.MAGIC,
        skillDiff: 2,
        xpPerHour: 0,
        rate: 1 * RATE_MUL,
        inputTokenIds: [
          EstforConstants.BRONZE_ARROW,
          EstforConstants.IRON_ARROW,
          EstforConstants.ADAMANTINE_ARROW,
          EstforConstants.ORICHALCUM_ARROW,
        ],
        inputAmounts: [1, 2, 3],
      };

      await expect(
        world.addActionChoices(EstforConstants.NONE, [choiceId], [actionChoiceInput]),
      ).to.be.revertedWithCustomError(worldLibrary, "TooManyInputItems");

      actionChoiceInput.inputTokenIds = [EstforConstants.BRONZE_ARROW, EstforConstants.IRON_ARROW];
      await expect(
        world.addActionChoices(EstforConstants.NONE, [choiceId], [actionChoiceInput]),
      ).to.be.revertedWithCustomError(worldLibrary, "LengthMismatch");

      actionChoiceInput.inputTokenIds = [
        EstforConstants.BRONZE_ARROW,
        EstforConstants.IRON_ARROW,
        EstforConstants.BRONZE_ARROW,
      ];
      await expect(
        world.addActionChoices(EstforConstants.NONE, [choiceId], [actionChoiceInput]),
      ).to.be.revertedWithCustomError(worldLibrary, "InputItemNoDuplicates");
    });

    it("Minimum skill validation", async function () {
      const {world, worldLibrary} = await loadFixture(deployContracts);

      const choiceId = 1;
      const actionChoiceInput: ActionChoiceInput = {
        ...defaultActionChoice,
        skill: EstforTypes.Skill.WOODCUTTING,
        skillDiff: 2,
        xpPerHour: 0,
        rate: 1 * RATE_MUL,
        inputTokenIds: [EstforConstants.BRONZE_ARROW],
        inputAmounts: [1],
        minSkills: [Skill.WOODCUTTING, Skill.FIREMAKING, Skill.CRAFTING, Skill.ALCHEMY],
        minXPs: [1, 1, 1],
      };

      await expect(
        world.addActionChoices(EstforConstants.NONE, [choiceId], [actionChoiceInput]),
      ).to.be.revertedWithCustomError(worldLibrary, "TooManyMinSkills");

      actionChoiceInput.minSkills = [Skill.WOODCUTTING, Skill.FIREMAKING];
      await expect(
        world.addActionChoices(EstforConstants.NONE, [choiceId], [actionChoiceInput]),
      ).to.be.revertedWithCustomError(worldLibrary, "LengthMismatch");

      actionChoiceInput.minSkills = [Skill.WOODCUTTING, Skill.FIREMAKING, Skill.WOODCUTTING];
      await expect(
        world.addActionChoices(EstforConstants.NONE, [choiceId], [actionChoiceInput]),
      ).to.be.revertedWithCustomError(worldLibrary, "MinimumSkillsNoDuplicates");
    });

    it("Output item validation", async function () {
      const {world, worldLibrary} = await loadFixture(deployContracts);

      const choiceId = 1;
      const actionChoiceInput: ActionChoiceInput = {
        ...defaultActionChoice,
        skill: EstforTypes.Skill.MAGIC,
        skillDiff: 2,
        xpPerHour: 0,
        rate: 1 * RATE_MUL,
        inputTokenIds: [EstforConstants.BRONZE_ARROW, EstforConstants.IRON_ARROW, EstforConstants.ADAMANTINE_ARROW],
        inputAmounts: [1, 2, 3],
        outputTokenId: EstforConstants.RUNITE_ARROW,
        outputAmount: 0,
      };

      await expect(
        world.addActionChoices(EstforConstants.NONE, [choiceId], [actionChoiceInput]),
      ).to.be.revertedWithCustomError(worldLibrary, "OutputAmountCannotBeZero");

      actionChoiceInput.outputAmount = 1;
      actionChoiceInput.outputTokenId = EstforConstants.NONE;
      await expect(
        world.addActionChoices(EstforConstants.NONE, [choiceId], [actionChoiceInput]),
      ).to.be.revertedWithCustomError(worldLibrary, "OutputTokenIdCannotBeEmpty");
    });

    it("Edit", async function () {
      const {world} = await loadFixture(deployContracts);

      const choiceId = 1;
      await world.addActionChoices(
        EstforConstants.NONE,
        [choiceId],
        [
          {
            ...defaultActionChoice,
            skill: EstforTypes.Skill.MAGIC,
            skillDiff: 2,
            xpPerHour: 0,
            rate: 1 * RATE_MUL,
            inputTokenIds: [EstforConstants.AIR_SCROLL],
            inputAmounts: [1],
          },
        ],
      );

      await world.editActionChoices(
        EstforConstants.NONE,
        [choiceId],
        [
          {
            ...defaultActionChoice,
            skill: EstforTypes.Skill.MAGIC,
            skillDiff: 2,
            rate: 1 * RATE_MUL,
            inputTokenIds: [EstforConstants.AIR_SCROLL],
            inputAmounts: [2],
          },
        ],
      );

      let actionChoice = await world.getActionChoice(EstforConstants.NONE, choiceId);
      expect(actionChoice.inputAmount1).to.eq(2);
      expect((await world.getActionChoice(EstforConstants.NONE, 2)).skill).to.eq(EstforTypes.Skill.NONE);

      await world.editActionChoices(
        EstforConstants.NONE,
        [choiceId],
        [
          {
            ...defaultActionChoice,
            skill: EstforTypes.Skill.MAGIC,
            skillDiff: 2,
            rate: 1 * RATE_MUL,
            inputTokenIds: [EstforConstants.AIR_SCROLL],
            inputAmounts: [10],
          },
        ],
      );
      actionChoice = await world.getActionChoice(EstforConstants.NONE, choiceId);
      expect(actionChoice.inputAmount1).to.eq(10);
    });

    it("First minimum skill should match skill of action choice", async function () {
      const {world, worldLibrary} = await loadFixture(deployContracts);
      const choiceId = 1;
      await expect(
        world.addActionChoices(
          EstforConstants.NONE,
          [choiceId],
          [
            {
              ...defaultActionChoice,
              skill: EstforTypes.Skill.MAGIC,
              skillDiff: 2,
              xpPerHour: 0,
              rate: 1 * RATE_MUL,
              inputTokenIds: [EstforConstants.BRONZE_ARROW],
              inputAmounts: [1],
              minSkills: [Skill.WOODCUTTING, Skill.FIREMAKING, Skill.CRAFTING],
              minXPs: [1, 2, 3],
            },
          ],
        ),
      ).to.be.revertedWithCustomError(worldLibrary, "FirstMinSkillMustBeActionChoiceSkill");

      await expect(
        world.addActionChoices(
          EstforConstants.NONE,
          [choiceId],
          [
            {
              ...defaultActionChoice,
              skill: EstforTypes.Skill.WOODCUTTING,
              skillDiff: 2,
              xpPerHour: 0,
              rate: 1 * RATE_MUL,
              inputTokenIds: [EstforConstants.BRONZE_ARROW],
              inputAmounts: [1],
              minSkills: [Skill.WOODCUTTING, Skill.FIREMAKING, Skill.CRAFTING],
              minXPs: [1, 2, 3],
            },
          ],
        ),
      ).to.not.be.reverted;
    });

    it("Multiple minimum skills check packed data", async function () {
      const {world} = await loadFixture(deployContracts);
      const choiceId = 1;
      await world.addActionChoices(
        EstforConstants.NONE,
        [choiceId],
        [
          {
            ...defaultActionChoice,
            skill: EstforTypes.Skill.WOODCUTTING,
            skillDiff: 2,
            xpPerHour: 0,
            rate: 1 * RATE_MUL,
            inputTokenIds: [EstforConstants.BRONZE_ARROW],
            inputAmounts: [1],
            minSkills: [Skill.WOODCUTTING, Skill.FIREMAKING, Skill.CRAFTING],
            minXPs: [1, 2, 3],
          },
        ],
      );

      const actionChoice = await world.getActionChoice(EstforConstants.NONE, choiceId);
      expect(actionChoice.packedData).to.eq("0x40");
      expect(actionChoice.skill).to.eq(Skill.WOODCUTTING);
      expect(actionChoice.minXP).to.eq(1);
      expect(actionChoice.minSkill2).to.eq(Skill.FIREMAKING);
      expect(actionChoice.minXP2).to.eq(2);
      expect(actionChoice.minSkill3).to.eq(Skill.CRAFTING);
      expect(actionChoice.minXP3).to.eq(3);
    });

    it("Using any input amount above 255 should update packed data & newInputAmount*s", async function () {
      const {world} = await loadFixture(deployContracts);
      const choiceId = 1;
      await world.addActionChoices(
        EstforConstants.NONE,
        [choiceId],
        [
          {
            ...defaultActionChoice,
            skill: EstforTypes.Skill.MAGIC,
            skillDiff: 2,
            xpPerHour: 0,
            rate: 1 * RATE_MUL,
            inputTokenIds: [EstforConstants.BRONZE_ARROW, EstforConstants.IRON_ARROW, EstforConstants.MITHRIL_ARROW],
            inputAmounts: [1, 256, 6553],
          },
        ],
      );

      const actionChoice = await world.getActionChoice(EstforConstants.NONE, choiceId);
      expect(actionChoice.packedData).to.eq("0x20");
      expect(actionChoice.inputAmount1).to.eq(0);
      expect(actionChoice.inputAmount2).to.eq(0);
      expect(actionChoice.inputAmount3).to.eq(0);
      expect(actionChoice.newInputAmount1).to.eq(1);
      expect(actionChoice.newInputAmount2).to.eq(256);
      expect(actionChoice.newInputAmount3).to.eq(6553);
    });
  });

  describe("ActionRewards", function () {
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
        "GuaranteedRewardsNoDuplicates",
      );
      action.guaranteedRewards[0].itemTokenId = SHADOW_SCROLL;
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
        "RandomRewardsMustBeInOrder",
      );
      action.randomRewards[0].chance = 300;
      await expect(world.addActions([action])).to.be.revertedWithCustomError(
        worldLibrary,
        "RandomRewardsMustBeInOrder",
      );
      action.randomRewards[1].chance = 250;
      await expect(world.addActions([action])).to.be.revertedWithCustomError(
        worldLibrary,
        "RandomRewardsMustBeInOrder",
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

    it("Only combat and actions without choices can have both guaranteed and random rewards", async function () {
      const {world} = await loadFixture(deployContracts);
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
        guaranteedRewards: [{itemTokenId: EstforConstants.AIR_SCROLL, rate: 100}],
        randomRewards: [{itemTokenId: EstforConstants.AIR_SCROLL, chance: 100, amount: 1}],
        combatStats: EstforTypes.emptyCombatStats,
      };

      await expect(world.addActions([action])).to.not.be.reverted;
      action.actionId = 2;
      action.info.skill = EstforTypes.Skill.COOKING;

      await expect(world.addActions([action])).to.be.revertedWithCustomError(
        world,
        "NonCombatWithActionChoicesCannotHaveBothGuaranteedAndRandomRewards",
      );
      action.info.actionChoiceRequired = false;
      await expect(world.addActions([action])).to.not.be.reverted;
    });
  });
});
