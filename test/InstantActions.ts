import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {playersFixture} from "./Players/PlayersFixture";
import {
  Skill,
  InstantActionType,
  InstantActionInput,
  defaultInstantActionInput as _defaultInstantActionInput,
} from "@paintswap/estfor-definitions/types";
import {expect} from "chai";
import NONE, {
  ADAMANTINE_ARROW,
  ADAMANTINE_BAR,
  BRONZE_ARROW,
  BRONZE_BAR,
  IRON_ARROW,
  IRON_BAR,
  ORICHALCUM_ARROW,
  RUNITE_ARROW,
  RUNITE_BAR,
} from "@paintswap/estfor-definitions/constants";

describe("Instant actions", function () {
  describe("Generic", function () {
    const actionType = InstantActionType.GENERIC;

    const defaultInstantActionInput: InstantActionInput = {
      ..._defaultInstantActionInput,
      actionId: 1,
      actionType,
    };

    it("Check input item order", async function () {
      const {instantActions} = await loadFixture(playersFixture);

      const instantActionInput: InstantActionInput = {
        ...defaultInstantActionInput,
        inputTokenIds: [BRONZE_ARROW, IRON_ARROW, ADAMANTINE_ARROW],
        inputAmounts: [1, 2, 3],
        outputTokenId: RUNITE_ARROW,
        outputAmount: 2,
      };

      instantActionInput.inputAmounts[0] = 4;
      await expect(instantActions.addActions([instantActionInput])).to.be.revertedWithCustomError(
        instantActions,
        "InputAmountsMustBeInOrder"
      );

      instantActionInput.inputAmounts[0] = 1;
      instantActionInput.inputAmounts[1] = 4;
      await expect(instantActions.addActions([instantActionInput])).to.be.revertedWithCustomError(
        instantActions,
        "InputAmountsMustBeInOrder"
      );

      instantActionInput.inputAmounts[1] = 2;
      instantActionInput.inputAmounts[2] = 1;
      await expect(instantActions.addActions([instantActionInput])).to.be.revertedWithCustomError(
        instantActions,
        "InputAmountsMustBeInOrder"
      );

      instantActionInput.inputAmounts[2] = 3;
      expect(await instantActions.addActions([instantActionInput])).to.not.be.reverted;
    });

    it("Check input item validation", async function () {
      const {instantActions} = await loadFixture(playersFixture);

      const instantActionInput: InstantActionInput = {
        ...defaultInstantActionInput,
        inputTokenIds: [BRONZE_ARROW, IRON_ARROW, ADAMANTINE_ARROW, ORICHALCUM_ARROW],
        inputAmounts: [1, 2, 3],
      };

      await expect(instantActions.addActions([instantActionInput])).to.be.revertedWithCustomError(
        instantActions,
        "TooManyInputItems"
      );

      instantActionInput.inputTokenIds = [BRONZE_ARROW, IRON_ARROW];
      await expect(instantActions.addActions([instantActionInput])).to.be.revertedWithCustomError(
        instantActions,
        "LengthMismatch"
      );

      instantActionInput.inputTokenIds = [BRONZE_ARROW, IRON_ARROW, BRONZE_ARROW];
      await expect(instantActions.addActions([instantActionInput])).to.be.revertedWithCustomError(
        instantActions,
        "InputItemNoDuplicates"
      );
    });

    it("Minimum skill validation", async function () {
      const {instantActions} = await loadFixture(playersFixture);

      const instantActionInput: InstantActionInput = {
        ...defaultInstantActionInput,
        inputTokenIds: [BRONZE_ARROW],
        inputAmounts: [1],
        minSkills: [Skill.WOODCUTTING, Skill.FIREMAKING, Skill.CRAFTING, Skill.ALCHEMY],
        minXPs: ["1", "1", "1"],
      };

      await expect(instantActions.addActions([instantActionInput])).to.be.revertedWithCustomError(
        instantActions,
        "TooManyMinSkills"
      );

      instantActionInput.minSkills = [Skill.WOODCUTTING, Skill.FIREMAKING];
      await expect(instantActions.addActions([instantActionInput])).to.be.revertedWithCustomError(
        instantActions,
        "LengthMismatch"
      );

      instantActionInput.minSkills = [Skill.WOODCUTTING, Skill.FIREMAKING, Skill.WOODCUTTING];
      await expect(instantActions.addActions([instantActionInput])).to.be.revertedWithCustomError(
        instantActions,
        "MinimumSkillsNoDuplicates"
      );
    });

    it("Output item validation", async function () {
      const {instantActions} = await loadFixture(playersFixture);

      const instantActionInput: InstantActionInput = {
        ...defaultInstantActionInput,
        inputTokenIds: [BRONZE_ARROW, IRON_ARROW, ADAMANTINE_ARROW],
        inputAmounts: [1, 2, 3],
        outputTokenId: RUNITE_ARROW,
        outputAmount: 0,
      };

      await expect(instantActions.addActions([instantActionInput])).to.be.revertedWithCustomError(
        instantActions,
        "OutputAmountCannotBeZero"
      );

      instantActionInput.outputAmount = 1;
      instantActionInput.outputTokenId = NONE;
      await expect(instantActions.addActions([instantActionInput])).to.be.revertedWithCustomError(
        instantActions,
        "OutputTokenIdCannotBeEmpty"
      );
    });

    it("Any inputs should be burnt (do multiple)", async function () {
      const {playerId, instantActions, itemNFT, alice} = await loadFixture(playersFixture);

      const instantActionInput: InstantActionInput = {
        ...defaultInstantActionInput,
        inputTokenIds: [BRONZE_ARROW, IRON_ARROW, ADAMANTINE_ARROW],
        inputAmounts: [1, 2, 3],
        outputTokenId: RUNITE_ARROW,
        outputAmount: 2,
      };

      await instantActions.addActions([instantActionInput]);
      await itemNFT.testMints(alice.address, [BRONZE_ARROW, IRON_ARROW, ADAMANTINE_ARROW], [3, 3, 3]);

      await instantActions.connect(alice).doInstantActions(playerId, [instantActionInput.actionId], [1], actionType);

      expect(
        await itemNFT.balanceOfs(alice.address, [BRONZE_ARROW, IRON_ARROW, ADAMANTINE_ARROW, RUNITE_ARROW])
      ).to.deep.eq([2, 1, 0, 2]);
    });

    it("Do multiple instant actions at once", async function () {
      const {playerId, instantActions, itemNFT, alice} = await loadFixture(playersFixture);

      const instantActionInput: InstantActionInput = {
        ...defaultInstantActionInput,
        inputTokenIds: [BRONZE_ARROW, IRON_ARROW, ADAMANTINE_ARROW],
        inputAmounts: [1, 2, 3],
        outputTokenId: RUNITE_ARROW,
        outputAmount: 2,
      };

      const instantActionInput1: InstantActionInput = {
        ...defaultInstantActionInput,
        actionId: 2,
        inputTokenIds: [BRONZE_BAR, IRON_BAR, ADAMANTINE_BAR],
        inputAmounts: [4, 5, 6],
        outputTokenId: RUNITE_BAR,
        outputAmount: 2,
      };

      await instantActions.addActions([instantActionInput, instantActionInput1]);

      await itemNFT.testMints(
        alice.address,
        [BRONZE_ARROW, IRON_ARROW, ADAMANTINE_ARROW, BRONZE_BAR, IRON_BAR, ADAMANTINE_BAR],
        [6, 6, 6, 6, 6, 6]
      );

      await expect(
        instantActions
          .connect(alice)
          .doInstantActions(playerId, [instantActionInput.actionId, instantActionInput1.actionId], [2, 1], actionType)
      )
        .to.emit(instantActions, "DoInstantActions")
        .withArgs(
          playerId,
          alice.address,
          [instantActionInput.actionId, instantActionInput1.actionId],
          [2, 1],
          [BRONZE_ARROW, IRON_ARROW, ADAMANTINE_ARROW, BRONZE_BAR, IRON_BAR, ADAMANTINE_BAR],
          [2, 4, 6, 4, 5, 6],
          [RUNITE_ARROW, RUNITE_BAR],
          [4, 2],
          actionType
        );

      expect(
        await itemNFT.balanceOfs(alice.address, [
          BRONZE_ARROW,
          IRON_ARROW,
          ADAMANTINE_ARROW,
          RUNITE_ARROW,
          BRONZE_BAR,
          IRON_BAR,
          ADAMANTINE_BAR,
          RUNITE_BAR,
        ])
      ).to.deep.eq([4, 2, 0, 4, 2, 1, 0, 2]);
    });

    it("Cannot add same instant action twice", async function () {
      const {instantActions} = await loadFixture(playersFixture);

      const instantActionInput: InstantActionInput = {
        ...defaultInstantActionInput,
        inputTokenIds: [BRONZE_ARROW],
        inputAmounts: [1],
      };

      await instantActions.addActions([instantActionInput]);
      await expect(instantActions.addActions([instantActionInput])).to.be.revertedWithCustomError(
        instantActions,
        "ActionAlreadyExists"
      );
    });

    it("Must be owner to add an action", async function () {
      const {instantActions, alice} = await loadFixture(playersFixture);

      const instantActionInput: InstantActionInput = {
        ...defaultInstantActionInput,
        inputTokenIds: [BRONZE_ARROW],
        inputAmounts: [1],
      };
      await expect(instantActions.connect(alice).addActions([instantActionInput])).to.be.revertedWithCustomError(
        instantActions,
        "CallerIsNotOwner"
      );
      await instantActions.addActions([instantActionInput]);
    });

    it("Must be owner to edit an action", async function () {
      const {instantActions, alice} = await loadFixture(playersFixture);

      const instantActionInput: InstantActionInput = {
        ...defaultInstantActionInput,
        inputTokenIds: [BRONZE_ARROW],
        inputAmounts: [1],
      };
      await instantActions.addActions([instantActionInput]);
      await expect(instantActions.connect(alice).editActions([instantActionInput])).to.be.revertedWithCustomError(
        instantActions,
        "CallerIsNotOwner"
      );
      await instantActions.editActions([instantActionInput]);
    });

    it("Edited action must exist", async function () {
      const {instantActions, alice} = await loadFixture(playersFixture);

      const instantActionInput: InstantActionInput = {
        ...defaultInstantActionInput,
        inputTokenIds: [BRONZE_ARROW],
        inputAmounts: [1],
      };
      await instantActions.addActions([instantActionInput]);
      await expect(instantActions.connect(alice).editActions([instantActionInput])).to.be.revertedWithCustomError(
        instantActions,
        "CallerIsNotOwner"
      );
      await instantActions.editActions([instantActionInput]);
    });

    it("Must be owner of player to do instant actions", async function () {
      const {playerId, instantActions} = await loadFixture(playersFixture);

      const instantActionInput: InstantActionInput = {
        ...defaultInstantActionInput,
        inputTokenIds: [BRONZE_ARROW],
        inputAmounts: [1],
      };
      await instantActions.addActions([instantActionInput]);

      await expect(
        instantActions.doInstantActions(playerId, [instantActionInput.actionId], [1], actionType)
      ).to.be.revertedWithCustomError(instantActions, "NotOwnerOfPlayerAndActive");
    });

    it("Cannot do an action which does not exist", async function () {
      const {playerId, instantActions, alice} = await loadFixture(playersFixture);
      await expect(
        instantActions.connect(alice).doInstantActions(playerId, [0], [1], actionType)
      ).to.be.revertedWithCustomError(instantActions, "InvalidActionId");
    });

    it("Must have the minimum requirements to do this instant action", async function () {
      const {playerId, instantActions, itemNFT, players, alice} = await loadFixture(playersFixture);

      const instantActionInput: InstantActionInput = {
        ...defaultInstantActionInput,
        inputTokenIds: [BRONZE_ARROW],
        inputAmounts: [1],
        minSkills: [Skill.WOODCUTTING, Skill.FIREMAKING, Skill.CRAFTING],
        minXPs: ["1", "1", "1"],
      };
      await instantActions.addActions([instantActionInput]);

      await itemNFT.testMint(alice.address, BRONZE_ARROW, 1);

      await expect(
        instantActions.connect(alice).doInstantActions(playerId, [instantActionInput.actionId], [1], actionType)
      ).to.be.revertedWithCustomError(instantActions, "MinimumXPNotReached");

      await players.testModifyXP(alice.address, playerId, Skill.WOODCUTTING, 1, true);
      await players.testModifyXP(alice.address, playerId, Skill.FIREMAKING, 1, true);

      await expect(
        instantActions.connect(alice).doInstantActions(playerId, [instantActionInput.actionId], [1], actionType)
      ).to.be.revertedWithCustomError(instantActions, "MinimumXPNotReached");

      await players.testModifyXP(alice.address, playerId, Skill.CRAFTING, 2, true);

      await expect(
        instantActions.connect(alice).doInstantActions(playerId, [instantActionInput.actionId], [1], actionType)
      ).to.not.be.reverted;
    });

    it("Check amount > 1 burns and mints as expected", async function () {
      const {playerId, instantActions, itemNFT, alice} = await loadFixture(playersFixture);

      const instantActionInput: InstantActionInput = {
        ...defaultInstantActionInput,
        inputTokenIds: [BRONZE_ARROW, IRON_ARROW, ADAMANTINE_ARROW],
        inputAmounts: [1, 2, 3],
        outputTokenId: RUNITE_ARROW,
        outputAmount: 2,
      };

      await instantActions.addActions([instantActionInput]);
      await itemNFT.testMints(alice.address, [BRONZE_ARROW, IRON_ARROW, ADAMANTINE_ARROW], [6, 6, 6]);

      await instantActions.connect(alice).doInstantActions(playerId, [instantActionInput.actionId], [2], actionType);

      expect(
        await itemNFT.balanceOfs(alice.address, [BRONZE_ARROW, IRON_ARROW, ADAMANTINE_ARROW, RUNITE_ARROW])
      ).to.deep.eq([4, 2, 0, 4]);
    });

    it("Add multiple actions", async function () {
      const {instantActions} = await loadFixture(playersFixture);

      const instantActionInput: InstantActionInput = {
        ...defaultInstantActionInput,
        inputTokenIds: [IRON_ARROW, ADAMANTINE_ARROW],
        inputAmounts: [1, 2],
        outputTokenId: RUNITE_ARROW,
        outputAmount: 2,
      };

      const instantActionInput1: InstantActionInput = {
        ...defaultInstantActionInput,
        actionId: 2,
        inputTokenIds: [BRONZE_ARROW, IRON_ARROW, ADAMANTINE_ARROW],
        inputAmounts: [3, 5, 7],
        outputTokenId: ORICHALCUM_ARROW,
        outputAmount: 3,
      };

      await instantActions.addActions([instantActionInput, instantActionInput1]);

      // Get action
      const action1 = await instantActions.actions(actionType, 1);
      expect(action1.inputTokenId1).to.eq(IRON_ARROW);
      expect(action1.inputTokenId3).to.eq(NONE);
      expect(action1.outputTokenId).to.eq(RUNITE_ARROW);
      expect(action1.outputAmount).to.eq(2);
      const action2 = await instantActions.actions(actionType, 2);
      expect(action2.inputTokenId3).to.eq(ADAMANTINE_ARROW);
      expect(action2.outputTokenId).to.eq(ORICHALCUM_ARROW);
      expect(action2.outputAmount).to.eq(3);
    });

    it("Check packed data", async function () {
      const {instantActions} = await loadFixture(playersFixture);

      const instantActionInput: InstantActionInput = {
        ...defaultInstantActionInput,
        inputTokenIds: [BRONZE_ARROW, IRON_ARROW, ADAMANTINE_ARROW],
        inputAmounts: [1, 2, 3],
        isFullModeOnly: true,
      };
      await instantActions.addActions([instantActionInput]);
      expect((await instantActions.actions(actionType, instantActionInput.actionId)).packedData == "0x80");
    });

    it("Check full mode requirements", async function () {
      const {playerId, instantActions, brush, upgradePlayerBrushPrice, playerNFT, origName, itemNFT, alice} =
        await loadFixture(playersFixture);

      const instantActionInput: InstantActionInput = {
        ...defaultInstantActionInput,
        inputTokenIds: [BRONZE_ARROW],
        inputAmounts: [1],
        isFullModeOnly: true,
      };
      await instantActions.addActions([instantActionInput]);

      await itemNFT.testMint(alice.address, BRONZE_ARROW, 2);

      await expect(
        instantActions.connect(alice).doInstantActions(playerId, [instantActionInput.actionId], [2], actionType)
      ).to.be.revertedWithCustomError(instantActions, "PlayerNotUpgraded");
      // Upgrade player
      await brush.mint(alice.address, upgradePlayerBrushPrice);
      await brush.connect(alice).approve(playerNFT.address, upgradePlayerBrushPrice);
      await playerNFT.connect(alice).editPlayer(playerId, origName, "", "", "", true);

      await expect(
        instantActions.connect(alice).doInstantActions(playerId, [instantActionInput.actionId], [2], actionType)
      ).to.not.be.reverted;
    });
  });

  describe("Forging", function () {
    const actionType = InstantActionType.FORGING_COMBINE;

    const defaultInstantActionInput: InstantActionInput = {
      ..._defaultInstantActionInput,
      actionId: 1,
      actionType,
    };

    it("Single input forging", async function () {
      const {playerId, instantActions, itemNFT, alice} = await loadFixture(playersFixture);
      const instantActionInput: InstantActionInput = {
        ...defaultInstantActionInput,
        inputTokenIds: [IRON_ARROW],
        inputAmounts: [1],
        outputTokenId: BRONZE_ARROW,
        outputAmount: 2,
      };
      await instantActions.addActions([instantActionInput]);

      await itemNFT.testMint(alice.address, IRON_ARROW, 1);
      await instantActions.connect(alice).doInstantActions(playerId, [instantActionInput.actionId], [1], actionType);

      expect(await itemNFT.balanceOf(alice.address, IRON_ARROW)).to.eq(0);
      expect(await itemNFT.balanceOf(alice.address, BRONZE_ARROW)).to.eq(2);
    });

    it("Incorrect input length not allowed", async function () {
      const {instantActions} = await loadFixture(playersFixture);

      const instantActionInput: InstantActionInput = {
        ...defaultInstantActionInput,
        inputTokenIds: [],
        inputAmounts: [],
        outputTokenId: BRONZE_ARROW,
        outputAmount: 2,
      };
      await expect(instantActions.addActions([instantActionInput])).to.be.revertedWithCustomError(
        instantActions,
        "IncorrectInputAmounts"
      );

      instantActionInput.inputTokenIds = [IRON_ARROW, IRON_ARROW];
      instantActionInput.inputAmounts = [1, 1];

      await expect(instantActions.addActions([instantActionInput])).to.be.revertedWithCustomError(
        instantActions,
        "IncorrectInputAmounts"
      );
    });

    it("Input amount must be 1", async function () {
      const {instantActions} = await loadFixture(playersFixture);
      const instantActionInput: InstantActionInput = {
        ...defaultInstantActionInput,
        inputTokenIds: [IRON_ARROW],
        inputAmounts: [2],
        outputTokenId: BRONZE_ARROW,
        outputAmount: 2,
      };
      await expect(instantActions.addActions([instantActionInput])).to.be.revertedWithCustomError(
        instantActions,
        "IncorrectInputAmounts"
      );
    });

    it("Any inputs should be burnt", async function () {
      const {playerId, instantActions, itemNFT, alice} = await loadFixture(playersFixture);

      const instantActionInput: InstantActionInput = {
        ...defaultInstantActionInput,
        inputTokenIds: [BRONZE_ARROW],
        inputAmounts: [1],
        outputTokenId: RUNITE_ARROW,
        outputAmount: 1,
      };

      await instantActions.addActions([instantActionInput]);
      await itemNFT.testMints(alice.address, [BRONZE_ARROW], [3]);

      await instantActions.connect(alice).doInstantActions(playerId, [instantActionInput.actionId], [1], actionType);

      expect(await itemNFT.balanceOf(alice.address, BRONZE_ARROW)).to.eq(2);
      expect(await itemNFT.balanceOf(alice.address, RUNITE_ARROW)).to.eq(1);
    });

    it("Check amount > 1 burns and mints as expected", async function () {
      const {playerId, instantActions, itemNFT, alice} = await loadFixture(playersFixture);

      const instantActionInput: InstantActionInput = {
        ...defaultInstantActionInput,
        inputTokenIds: [BRONZE_ARROW],
        inputAmounts: [1],
        outputTokenId: RUNITE_ARROW,
        outputAmount: 3,
      };

      await instantActions.addActions([instantActionInput]);
      await itemNFT.testMints(alice.address, [BRONZE_ARROW], [6]);

      await instantActions.connect(alice).doInstantActions(playerId, [instantActionInput.actionId], [2], actionType);

      expect(await itemNFT.balanceOf(alice.address, BRONZE_ARROW)).to.eq(4);
      expect(await itemNFT.balanceOf(alice.address, RUNITE_ARROW)).to.eq(6);
    });

    it("Do multiple instant actions at once", async function () {
      const {playerId, instantActions, itemNFT, alice} = await loadFixture(playersFixture);

      const instantActionInput: InstantActionInput = {
        ...defaultInstantActionInput,
        inputTokenIds: [BRONZE_ARROW],
        inputAmounts: [1],
        outputTokenId: RUNITE_ARROW,
        outputAmount: 2,
      };

      const instantActionInput1: InstantActionInput = {
        ...defaultInstantActionInput,
        actionId: 2,
        inputTokenIds: [BRONZE_BAR],
        inputAmounts: [1],
        outputTokenId: RUNITE_ARROW,
        outputAmount: 1,
      };

      await instantActions.addActions([instantActionInput, instantActionInput1]);
      await itemNFT.testMints(alice.address, [BRONZE_ARROW, BRONZE_BAR], [6, 6]);

      await expect(
        instantActions
          .connect(alice)
          .doInstantActions(playerId, [instantActionInput.actionId, instantActionInput1.actionId], [2, 1], actionType)
      )
        .to.emit(instantActions, "DoInstantActions")
        .withArgs(
          playerId,
          alice.address,
          [instantActionInput.actionId, instantActionInput1.actionId],
          [2, 1],
          [BRONZE_ARROW, BRONZE_BAR],
          [2, 1],
          [RUNITE_ARROW],
          [5],
          actionType
        );

      expect(await itemNFT.balanceOfs(alice.address, [BRONZE_ARROW, BRONZE_BAR, RUNITE_ARROW])).to.deep.eq([4, 5, 5]);
    });
  });
});
