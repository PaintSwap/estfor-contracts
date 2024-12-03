import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {EstforConstants, EstforTypes} from "@paintswap/estfor-definitions";
import {RATE_MUL, SHADOW_SCROLL, SPAWN_MUL} from "@paintswap/estfor-definitions/constants";
import {ActionChoiceInput, ActionInput, Skill, defaultActionChoice} from "@paintswap/estfor-definitions/types";
import {expect} from "chai";
import {ethers, upgrades} from "hardhat";
import {getActionId} from "./utils";
import {WorldActions} from "../typechain-types";

describe("WorldActions", function () {
  const deployContracts = async function () {
    // Contracts are deployed using the first signer/account by default
    const [owner, alice] = await ethers.getSigners();

    // Create the worldActions actions
    const WorldActions = await ethers.getContractFactory("WorldActions");
    const worldActions = (await upgrades.deployProxy(WorldActions, [], {
      kind: "uups"
    })) as unknown as WorldActions;

    return {
      worldActions,
      owner,
      alice
    };
  };

  describe("Actions", function () {
    it("Add/Edit/Delete normal", async function () {
      const {worldActions} = await loadFixture(deployContracts);
      const actionAvailable = false;

      const actionInfo = {
        skill: EstforTypes.Skill.COMBAT,
        xpPerHour: 3600,
        minXP: 0,
        worldLocation: 0,
        isFullModeOnly: false,
        numSpawned: 1 * SPAWN_MUL,
        handItemTokenIdRangeMin: EstforConstants.COMBAT_BASE,
        handItemTokenIdRangeMax: EstforConstants.COMBAT_MAX,
        isAvailable: actionAvailable,
        questPrerequisiteId: 0,
        actionChoiceRequired: true,
        successPercent: 100
      };

      let tx = await worldActions.addActions([
        {
          actionId: 1,
          info: actionInfo,
          guaranteedRewards: [],
          randomRewards: [],
          combatStats: EstforTypes.emptyCombatStats
        }
      ]);
      const actionId = await getActionId(tx, worldActions);
      const {skill} = await worldActions.getAction(actionId);
      expect(skill).to.eq(BigInt(EstforTypes.Skill.COMBAT));

      actionInfo.xpPerHour = 20;
      await worldActions.editActions([
        {
          actionId,
          info: actionInfo,
          guaranteedRewards: [],
          randomRewards: [],
          combatStats: EstforTypes.emptyCombatStats
        }
      ]);
      expect((await worldActions.getAction(actionId)).xpPerHour).to.eq(20);
      expect((await worldActions.getAction(actionId)).isAvailable).to.be.false;
      actionInfo.isAvailable = true;
      await worldActions.editActions([
        {
          actionId,
          info: actionInfo,
          guaranteedRewards: [],
          randomRewards: [],
          combatStats: EstforTypes.emptyCombatStats
        }
      ]);
      expect((await worldActions.getAction(actionId)).isAvailable).to.be.true;
      actionInfo.isAvailable = false;
      await worldActions.editActions([
        {
          actionId,
          info: actionInfo,
          guaranteedRewards: [],
          randomRewards: [],
          combatStats: EstforTypes.emptyCombatStats
        }
      ]);
      expect((await worldActions.getAction(actionId)).isAvailable).to.be.false;
    });

    it("Edit to have less guarenteed & random rewards", async function () {
      const {worldActions} = await loadFixture(deployContracts);
      const actionAvailable = false;

      const actionInfo = {
        skill: EstforTypes.Skill.COMBAT,
        xpPerHour: 3600,
        minXP: 0,
        worldLocation: 0,
        isFullModeOnly: false,
        numSpawned: 1 * SPAWN_MUL,
        handItemTokenIdRangeMin: EstforConstants.COMBAT_BASE,
        handItemTokenIdRangeMax: EstforConstants.COMBAT_MAX,
        isAvailable: actionAvailable,
        questPrerequisiteId: 0,
        actionChoiceRequired: true,
        successPercent: 100
      };

      let tx = await worldActions.addActions([
        {
          actionId: 1,
          info: actionInfo,
          guaranteedRewards: [{itemTokenId: EstforConstants.OAK_LOG, rate: 60 * 10}],
          randomRewards: [{itemTokenId: EstforConstants.BRONZE_ARROW, chance: 1328, amount: 1}],
          combatStats: EstforTypes.emptyCombatStats
        }
      ]);
      const actionId = await getActionId(tx, worldActions);
      expect((await worldActions.getAction(actionId)).skill).to.eq(EstforTypes.Skill.COMBAT);

      await worldActions.editActions([
        {
          actionId,
          info: actionInfo,
          guaranteedRewards: [],
          randomRewards: [],
          combatStats: EstforTypes.emptyCombatStats
        }
      ]);
      expect((await worldActions.getActionRewards(actionId)).guaranteedRewardTokenId1).to.eq(0);
      expect((await worldActions.getActionRewards(actionId)).randomRewardAmount1).to.eq(0);

      await worldActions.editActions([
        {
          actionId,
          info: actionInfo,
          guaranteedRewards: [{itemTokenId: EstforConstants.OAK_LOG, rate: 60 * 10}],
          randomRewards: [{itemTokenId: EstforConstants.BRONZE_ARROW, chance: 1328, amount: 1}],
          combatStats: EstforTypes.emptyCombatStats
        }
      ]);

      expect((await worldActions.getActionRewards(actionId)).guaranteedRewardTokenId1).to.eq(EstforConstants.OAK_LOG);
      expect((await worldActions.getActionRewards(actionId)).randomRewardAmount1).to.eq(1);
    });

    it("Dynamic actions", async function () {
      // Dynamic actions TODO
    });
  });

  describe("ActionChoices", function () {
    it("Cannot use id 0", async function () {
      const {worldActions} = await loadFixture(deployContracts);
      const choiceId = 0;
      await expect(
        worldActions.addActionChoices(
          EstforConstants.NONE,
          [choiceId],
          [
            {
              ...defaultActionChoice,
              skill: EstforTypes.Skill.MAGIC,
              rate: 1 * RATE_MUL,
              inputTokenIds: [EstforConstants.AIR_SCROLL],
              inputAmounts: [1]
            }
          ]
        )
      ).to.be.revertedWithCustomError(worldActions, "ActionChoiceIdZeroNotAllowed");
    });

    it("Bulk add action choices", async function () {
      const {worldActions} = await loadFixture(deployContracts);
      await worldActions.addBulkActionChoices(
        [EstforConstants.NONE, EstforConstants.ACTION_ALCHEMY_ITEM],
        [[1], [2, 3]],
        [
          [
            {
              ...defaultActionChoice,
              skill: EstforTypes.Skill.MAGIC,
              rate: 1 * RATE_MUL,
              inputTokenIds: [EstforConstants.AIR_SCROLL],
              inputAmounts: [1]
            }
          ],
          [
            {
              ...defaultActionChoice,
              skill: EstforTypes.Skill.ALCHEMY,
              rate: 1 * RATE_MUL,
              inputTokenIds: [EstforConstants.AIR_SCROLL],
              inputAmounts: [1]
            },
            {
              ...defaultActionChoice,
              skill: EstforTypes.Skill.ALCHEMY,
              rate: 1 * RATE_MUL,
              inputTokenIds: [EstforConstants.AIR_SCROLL],
              inputAmounts: [1]
            }
          ]
        ]
      );

      // Check that they exist
      expect((await worldActions.getActionChoice(EstforConstants.NONE, 1)).skill).to.eq(EstforTypes.Skill.MAGIC);
      expect((await worldActions.getActionChoice(EstforConstants.ACTION_ALCHEMY_ITEM, 2)).skill).to.eq(
        EstforTypes.Skill.ALCHEMY
      );
      expect((await worldActions.getActionChoice(EstforConstants.ACTION_ALCHEMY_ITEM, 3)).skill).to.eq(
        EstforTypes.Skill.ALCHEMY
      );
    });

    it("Check input item validation", async function () {
      const {worldActions} = await loadFixture(deployContracts);

      const choiceId = 1;
      const actionChoiceInput: ActionChoiceInput = {
        ...defaultActionChoice,
        skill: EstforTypes.Skill.MAGIC,
        xpPerHour: 0,
        rate: 1 * RATE_MUL,
        inputTokenIds: [
          EstforConstants.BRONZE_ARROW,
          EstforConstants.IRON_ARROW,
          EstforConstants.ADAMANTINE_ARROW,
          EstforConstants.ORICHALCUM_ARROW
        ],
        inputAmounts: [1, 2, 3]
      };

      await expect(
        worldActions.addActionChoices(EstforConstants.NONE, [choiceId], [actionChoiceInput])
      ).to.be.revertedWithCustomError(worldActions, "TooManyInputItems");

      actionChoiceInput.inputTokenIds = [EstforConstants.BRONZE_ARROW, EstforConstants.IRON_ARROW];
      await expect(
        worldActions.addActionChoices(EstforConstants.NONE, [choiceId], [actionChoiceInput])
      ).to.be.revertedWithCustomError(worldActions, "LengthMismatch");

      actionChoiceInput.inputTokenIds = [
        EstforConstants.BRONZE_ARROW,
        EstforConstants.IRON_ARROW,
        EstforConstants.BRONZE_ARROW
      ];
      await expect(
        worldActions.addActionChoices(EstforConstants.NONE, [choiceId], [actionChoiceInput])
      ).to.be.revertedWithCustomError(worldActions, "InputItemNoDuplicates");
    });

    it("Minimum skill validation", async function () {
      const {worldActions} = await loadFixture(deployContracts);

      const choiceId = 1;
      const actionChoiceInput: ActionChoiceInput = {
        ...defaultActionChoice,
        skill: EstforTypes.Skill.WOODCUTTING,
        xpPerHour: 0,
        rate: 1 * RATE_MUL,
        inputTokenIds: [EstforConstants.BRONZE_ARROW],
        inputAmounts: [1],
        skills: [Skill.WOODCUTTING, Skill.FIREMAKING, Skill.CRAFTING, Skill.ALCHEMY],
        skillMinXPs: [1, 1, 1],
        skillDiffs: [2, 0, 0]
      };

      await expect(
        worldActions.addActionChoices(EstforConstants.NONE, [choiceId], [actionChoiceInput])
      ).to.be.revertedWithCustomError(worldActions, "TooManySkills");

      actionChoiceInput.skills = [Skill.WOODCUTTING, Skill.FIREMAKING];
      await expect(
        worldActions.addActionChoices(EstforConstants.NONE, [choiceId], [actionChoiceInput])
      ).to.be.revertedWithCustomError(worldActions, "LengthMismatch");

      actionChoiceInput.skills = [Skill.WOODCUTTING, Skill.FIREMAKING, Skill.WOODCUTTING];
      await expect(
        worldActions.addActionChoices(EstforConstants.NONE, [choiceId], [actionChoiceInput])
      ).to.be.revertedWithCustomError(worldActions, "MinimumSkillsNoDuplicates");
    });

    it("Output item validation", async function () {
      const {worldActions} = await loadFixture(deployContracts);

      const choiceId = 1;
      const actionChoiceInput: ActionChoiceInput = {
        ...defaultActionChoice,
        skill: EstforTypes.Skill.MAGIC,
        xpPerHour: 0,
        rate: 1 * RATE_MUL,
        inputTokenIds: [EstforConstants.BRONZE_ARROW, EstforConstants.IRON_ARROW, EstforConstants.ADAMANTINE_ARROW],
        inputAmounts: [1, 2, 3],
        outputTokenId: EstforConstants.RUNITE_ARROW,
        outputAmount: 0
      };

      await expect(
        worldActions.addActionChoices(EstforConstants.NONE, [choiceId], [actionChoiceInput])
      ).to.be.revertedWithCustomError(worldActions, "OutputAmountCannotBeZero");

      actionChoiceInput.outputAmount = 1;
      actionChoiceInput.outputTokenId = EstforConstants.NONE;
      await expect(
        worldActions.addActionChoices(EstforConstants.NONE, [choiceId], [actionChoiceInput])
      ).to.be.revertedWithCustomError(worldActions, "OutputTokenIdCannotBeEmpty");
    });

    it("Edit", async function () {
      const {worldActions} = await loadFixture(deployContracts);

      const choiceId = 1;
      await worldActions.addActionChoices(
        EstforConstants.NONE,
        [choiceId],
        [
          {
            ...defaultActionChoice,
            skill: EstforTypes.Skill.MAGIC,
            xpPerHour: 0,
            rate: 1 * RATE_MUL,
            inputTokenIds: [EstforConstants.AIR_SCROLL],
            inputAmounts: [1]
          }
        ]
      );

      await worldActions.editActionChoices(
        EstforConstants.NONE,
        [choiceId],
        [
          {
            ...defaultActionChoice,
            skill: EstforTypes.Skill.MAGIC,
            rate: 1 * RATE_MUL,
            inputTokenIds: [EstforConstants.AIR_SCROLL],
            inputAmounts: [2]
          }
        ]
      );

      let actionChoice = await worldActions.getActionChoice(EstforConstants.NONE, choiceId);
      expect(actionChoice.inputAmount1).to.eq(2);
      expect((await worldActions.getActionChoice(EstforConstants.NONE, 2)).skill).to.eq(EstforTypes.Skill.NONE);

      await worldActions.editActionChoices(
        EstforConstants.NONE,
        [choiceId],
        [
          {
            ...defaultActionChoice,
            skill: EstforTypes.Skill.MAGIC,
            rate: 1 * RATE_MUL,
            inputTokenIds: [EstforConstants.AIR_SCROLL],
            inputAmounts: [10]
          }
        ]
      );
      actionChoice = await worldActions.getActionChoice(EstforConstants.NONE, choiceId);
      expect(actionChoice.inputAmount1).to.eq(10);
    });

    it("Packed data checks when it's available & not available", async function () {
      const {worldActions} = await loadFixture(deployContracts);
      const choiceId = 1;
      await worldActions.addActionChoices(
        EstforConstants.NONE,
        [choiceId],
        [
          {
            ...defaultActionChoice,
            skill: EstforTypes.Skill.MAGIC,
            xpPerHour: 0,
            rate: 1 * RATE_MUL,
            inputTokenIds: [EstforConstants.BRONZE_ARROW],
            inputAmounts: [1]
          }
        ]
      );

      let actionChoice = await worldActions.getActionChoice(EstforConstants.NONE, choiceId);
      let binaryPackedData = 0b01000000;
      let packedData = ethers.toBeHex(binaryPackedData);
      expect(actionChoice.packedData).to.eq(packedData);

      await worldActions.editActionChoices(
        EstforConstants.NONE,
        [choiceId],
        [
          {
            ...defaultActionChoice,
            skill: EstforTypes.Skill.MAGIC,
            xpPerHour: 0,
            rate: 1 * RATE_MUL,
            inputTokenIds: [EstforConstants.BRONZE_ARROW],
            inputAmounts: [1],
            isAvailable: false
          }
        ]
      );

      actionChoice = await worldActions.getActionChoice(EstforConstants.NONE, choiceId);
      binaryPackedData = 0b00000000;
      packedData = ethers.toBeHex(binaryPackedData);
      expect(actionChoice.packedData).to.eq(packedData);
    });
  });

  describe("ActionRewards", function () {
    it("Guaranteed reward duplicates not allowed", async function () {
      const {worldActions} = await loadFixture(deployContracts);
      const actionAvailable = false;
      const action: ActionInput = {
        actionId: 1,
        info: {
          skill: EstforTypes.Skill.COMBAT,
          xpPerHour: 3600,
          minXP: 0,
          worldLocation: 0,
          isFullModeOnly: false,
          numSpawned: 1 * SPAWN_MUL,
          handItemTokenIdRangeMin: EstforConstants.COMBAT_BASE,
          handItemTokenIdRangeMax: EstforConstants.COMBAT_MAX,
          isAvailable: actionAvailable,
          questPrerequisiteId: 0,
          actionChoiceRequired: true,
          successPercent: 100
        },
        guaranteedRewards: [
          {itemTokenId: EstforConstants.AIR_SCROLL, rate: 100},
          {itemTokenId: EstforConstants.AIR_SCROLL, rate: 200}
        ],
        randomRewards: [],
        combatStats: EstforTypes.emptyCombatStats
      };

      await expect(worldActions.addActions([action])).to.be.revertedWithCustomError(
        worldActions,
        "GuaranteedRewardsNoDuplicates"
      );
      action.guaranteedRewards[0].itemTokenId = SHADOW_SCROLL;
      await expect(worldActions.addActions([action])).to.not.be.reverted;
    });

    it("Random reward order", async function () {
      const {worldActions} = await loadFixture(deployContracts);
      const actionAvailable = false;
      const action: ActionInput = {
        actionId: 1,
        info: {
          skill: EstforTypes.Skill.COMBAT,
          xpPerHour: 3600,
          minXP: 0,
          worldLocation: 0,
          isFullModeOnly: false,
          numSpawned: 1 * SPAWN_MUL,
          handItemTokenIdRangeMin: EstforConstants.COMBAT_BASE,
          handItemTokenIdRangeMax: EstforConstants.COMBAT_MAX,
          isAvailable: actionAvailable,
          questPrerequisiteId: 0,
          actionChoiceRequired: true,
          successPercent: 100
        },
        guaranteedRewards: [],
        randomRewards: [
          {itemTokenId: EstforConstants.SHADOW_SCROLL, chance: 30, amount: 1},
          {itemTokenId: EstforConstants.AIR_SCROLL, chance: 50, amount: 1},
          {itemTokenId: EstforConstants.AQUA_SCROLL, chance: 100, amount: 1},
          {itemTokenId: EstforConstants.HELL_SCROLL, chance: 200, amount: 1}
        ],
        combatStats: EstforTypes.emptyCombatStats
      };

      await expect(worldActions.addActions([action])).to.be.revertedWithCustomError(
        worldActions,
        "RandomRewardsMustBeInOrder"
      );
      action.randomRewards[0].chance = 300;
      await expect(worldActions.addActions([action])).to.be.revertedWithCustomError(
        worldActions,
        "RandomRewardsMustBeInOrder"
      );
      action.randomRewards[1].chance = 250;
      await expect(worldActions.addActions([action])).to.be.revertedWithCustomError(
        worldActions,
        "RandomRewardsMustBeInOrder"
      );
      action.randomRewards[2].chance = 225;
      await expect(worldActions.addActions([action])).to.not.be.reverted;
    });

    it("Random reward duplicate not allowed", async function () {
      const {worldActions} = await loadFixture(deployContracts);
      const actionAvailable = false;
      const action: ActionInput = {
        actionId: 1,
        info: {
          skill: EstforTypes.Skill.COMBAT,
          xpPerHour: 3600,
          minXP: 0,
          worldLocation: 0,
          isFullModeOnly: false,
          numSpawned: 1 * SPAWN_MUL,
          handItemTokenIdRangeMin: EstforConstants.COMBAT_BASE,
          handItemTokenIdRangeMax: EstforConstants.COMBAT_MAX,
          isAvailable: actionAvailable,
          questPrerequisiteId: 0,
          actionChoiceRequired: true,
          successPercent: 100
        },
        guaranteedRewards: [],
        randomRewards: [
          {itemTokenId: EstforConstants.AIR_SCROLL, chance: 200, amount: 1},
          {itemTokenId: EstforConstants.AIR_SCROLL, chance: 100, amount: 1}
        ],
        combatStats: EstforTypes.emptyCombatStats
      };

      await expect(worldActions.addActions([action])).to.be.revertedWithCustomError(
        worldActions,
        "RandomRewardNoDuplicates"
      );
      action.randomRewards[0].itemTokenId = SHADOW_SCROLL;
      await expect(worldActions.addActions([action])).to.not.be.reverted;
    });

    it("Only combat and actions without choices can have both guaranteed and random rewards", async function () {
      const {worldActions} = await loadFixture(deployContracts);
      const actionAvailable = false;
      const action: ActionInput = {
        actionId: 1,
        info: {
          skill: EstforTypes.Skill.COMBAT,
          xpPerHour: 3600,
          minXP: 0,
          worldLocation: 0,
          isFullModeOnly: false,
          numSpawned: 1 * SPAWN_MUL,
          handItemTokenIdRangeMin: EstforConstants.COMBAT_BASE,
          handItemTokenIdRangeMax: EstforConstants.COMBAT_MAX,
          isAvailable: actionAvailable,
          questPrerequisiteId: 0,
          actionChoiceRequired: true,
          successPercent: 100
        },
        guaranteedRewards: [{itemTokenId: EstforConstants.AIR_SCROLL, rate: 100}],
        randomRewards: [{itemTokenId: EstforConstants.AIR_SCROLL, chance: 100, amount: 1}],
        combatStats: EstforTypes.emptyCombatStats
      };

      await expect(worldActions.addActions([action])).to.not.be.reverted;
      action.actionId = 2;
      action.info.skill = EstforTypes.Skill.COOKING;

      await expect(worldActions.addActions([action])).to.be.revertedWithCustomError(
        worldActions,
        "NonCombatWithActionChoicesCannotHaveBothGuaranteedAndRandomRewards"
      );
      action.info.actionChoiceRequired = false;
      await expect(worldActions.addActions([action])).to.not.be.reverted;
    });
  });
});
