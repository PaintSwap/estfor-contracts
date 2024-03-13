import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {playersFixture} from "./Players/PlayersFixture";
import {
  InstantVRFActionInput,
  InstantVRFActionType,
  defaultInstantVRFActionInput as _defaultInstantVRFActionInput,
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
} from "@paintswap/estfor-definitions/constants";
import {EstforConstants, EstforTypes} from "@paintswap/estfor-definitions";
import {fulfillRandomWords} from "./utils";
import {ethers} from "hardhat";
import {ERC1155HolderRogue} from "../typechain-types";

describe("Instant VRF actions", function () {
  describe("Shared", function () {
    const defaultInstantVRFActionInput: InstantVRFActionInput = {
      ..._defaultInstantVRFActionInput,
      actionId: 1,
      inputTokenIds: [BRONZE_ARROW, IRON_ARROW, ADAMANTINE_ARROW],
      inputAmounts: [1, 2, 3],
      randomRewards: [{itemTokenId: EstforConstants.RUNITE_ARROW, chance: 65535, amount: 2}], // 100% chance of 2 runite arrows
      isFullModeOnly: false,
      actionType: EstforTypes.InstantVRFActionType.FORGING,
    };

    it("Check input item order", async function () {
      const {instantVRFActions} = await loadFixture(playersFixture);

      const instantVRFActionInput: InstantVRFActionInput = {
        ...defaultInstantVRFActionInput,
      };

      instantVRFActionInput.inputAmounts[0] = 4;
      await expect(instantVRFActions.addActions([instantVRFActionInput])).to.be.revertedWithCustomError(
        instantVRFActions,
        "InputAmountsMustBeInOrder"
      );

      instantVRFActionInput.inputAmounts[0] = 1;
      instantVRFActionInput.inputAmounts[1] = 4;
      await expect(instantVRFActions.addActions([instantVRFActionInput])).to.be.revertedWithCustomError(
        instantVRFActions,
        "InputAmountsMustBeInOrder"
      );

      instantVRFActionInput.inputAmounts[1] = 2;
      instantVRFActionInput.inputAmounts[2] = 1;
      await expect(instantVRFActions.addActions([instantVRFActionInput])).to.be.revertedWithCustomError(
        instantVRFActions,
        "InputAmountsMustBeInOrder"
      );

      instantVRFActionInput.inputAmounts[2] = 3;
      expect(await instantVRFActions.addActions([instantVRFActionInput])).to.not.be.reverted;
    });

    it("Check input item validation", async function () {
      const {instantVRFActions} = await loadFixture(playersFixture);

      const instantVRFActionInput: InstantVRFActionInput = {
        ...defaultInstantVRFActionInput,
        inputTokenIds: [BRONZE_ARROW, IRON_ARROW, ADAMANTINE_ARROW, ORICHALCUM_ARROW],
        inputAmounts: [1, 2, 3],
      };

      await expect(instantVRFActions.addActions([instantVRFActionInput])).to.be.revertedWithCustomError(
        instantVRFActions,
        "TooManyInputItems"
      );

      instantVRFActionInput.inputTokenIds = [BRONZE_ARROW, IRON_ARROW];
      await expect(instantVRFActions.addActions([instantVRFActionInput])).to.be.revertedWithCustomError(
        instantVRFActions,
        "LengthMismatch"
      );

      instantVRFActionInput.inputTokenIds = [BRONZE_ARROW, IRON_ARROW, BRONZE_ARROW];
      await expect(instantVRFActions.addActions([instantVRFActionInput])).to.be.revertedWithCustomError(
        instantVRFActions,
        "InputItemNoDuplicates"
      );
    });

    it("Any inputs should be burnt (do multiple)", async function () {
      const {playerId, instantVRFActions, itemNFT, alice} = await loadFixture(playersFixture);

      const instantVRFActionInput: InstantVRFActionInput = {
        ...defaultInstantVRFActionInput,
        inputTokenIds: [BRONZE_ARROW, IRON_ARROW, ADAMANTINE_ARROW],
        inputAmounts: [1, 2, 3],
      };

      await instantVRFActions.addActions([instantVRFActionInput]);
      await itemNFT.testMints(alice.address, [BRONZE_ARROW, IRON_ARROW, ADAMANTINE_ARROW], [3, 3, 3]);

      const actionAmount = 1;
      await instantVRFActions
        .connect(alice)
        .doInstantVRFActions(playerId, [instantVRFActionInput.actionId], [actionAmount], {
          value: await instantVRFActions.requestCost(actionAmount),
        });

      expect(await itemNFT.balanceOfs(alice.address, [BRONZE_ARROW, IRON_ARROW, ADAMANTINE_ARROW])).to.deep.eq([
        2, 1, 0,
      ]);
    });

    it("Cannot use greater than MAX_ACTION_AMOUNT for the combined action amounts", async function () {
      const {playerId, instantVRFActions, itemNFT, alice} = await loadFixture(playersFixture);

      const instantVRFActionInput: InstantVRFActionInput = {
        ...defaultInstantVRFActionInput,
        inputTokenIds: [BRONZE_ARROW, IRON_ARROW, ADAMANTINE_ARROW],
        inputAmounts: [1, 2, 3],
      };

      const instantVRFActionInput1: InstantVRFActionInput = {
        ...defaultInstantVRFActionInput,
        inputTokenIds: [BRONZE_ARROW, IRON_ARROW, ADAMANTINE_ARROW],
        inputAmounts: [1, 2, 3],
        actionId: 2,
      };

      await instantVRFActions.addActions([instantVRFActionInput, instantVRFActionInput1]);
      await itemNFT.testMints(alice.address, [BRONZE_ARROW, IRON_ARROW, ADAMANTINE_ARROW], [1000, 1000, 1000]);

      const MAX_ACTION_AMOUNT = await instantVRFActions.MAX_ACTION_AMOUNT();

      const actionAmount = MAX_ACTION_AMOUNT.sub(2);
      const actionAmount1 = 3;
      await expect(
        instantVRFActions
          .connect(alice)
          .doInstantVRFActions(
            playerId,
            [instantVRFActionInput.actionId, instantVRFActionInput1.actionId],
            [actionAmount, actionAmount1],
            {value: await instantVRFActions.requestCost(actionAmount)}
          )
      ).to.be.revertedWithCustomError(instantVRFActions, "TooManyActionAmounts");
    });

    it("Do multiple instant actions at once", async function () {
      const {playerId, instantVRFActions, itemNFT, mockSWVRFOracleClient, alice} = await loadFixture(playersFixture);

      const instantVRFActionInput: InstantVRFActionInput = {
        ...defaultInstantVRFActionInput,
        inputTokenIds: [BRONZE_ARROW, IRON_ARROW, ADAMANTINE_ARROW],
        inputAmounts: [1, 2, 3],
      };

      const instantVRFActionInput1: InstantVRFActionInput = {
        ...defaultInstantVRFActionInput,
        actionId: 2,
        inputTokenIds: [BRONZE_BAR, IRON_BAR, ADAMANTINE_BAR],
        inputAmounts: [4, 5, 6],
      };

      await instantVRFActions.addActions([instantVRFActionInput, instantVRFActionInput1]);

      await itemNFT.testMints(
        alice.address,
        [BRONZE_ARROW, IRON_ARROW, ADAMANTINE_ARROW, BRONZE_BAR, IRON_BAR, ADAMANTINE_BAR],
        [6, 6, 6, 6, 6, 6]
      );

      const actionAmount = 3;
      const requestId = 1;

      await expect(
        instantVRFActions
          .connect(alice)
          .doInstantVRFActions(playerId, [instantVRFActionInput.actionId, instantVRFActionInput1.actionId], [2, 1], {
            value: await instantVRFActions.requestCost(actionAmount),
          })
      )
        .to.emit(instantVRFActions, "DoInstantVRFActions")
        .withArgs(
          alice.address,
          playerId,
          requestId,
          [instantVRFActionInput.actionId, instantVRFActionInput1.actionId],
          [2, 1],
          [BRONZE_ARROW, IRON_ARROW, ADAMANTINE_ARROW, BRONZE_BAR, IRON_BAR, ADAMANTINE_BAR],
          [2, 4, 6, 4, 5, 6]
        );

      expect(await itemNFT.balanceOfs(alice.address, [BRONZE_ARROW, IRON_ARROW, ADAMANTINE_ARROW])).to.deep.eq([
        4, 2, 0,
      ]);

      await fulfillRandomWords(requestId, instantVRFActions, mockSWVRFOracleClient);

      expect(await itemNFT.balanceOfs(alice.address, [BRONZE_BAR, IRON_BAR, ADAMANTINE_BAR])).to.deep.eq([2, 1, 0]);
    });

    it("Not paying the request cost", async function () {
      const {playerId, instantVRFActions, itemNFT, alice} = await loadFixture(playersFixture);

      const instantVRFActionInput: InstantVRFActionInput = {
        ...defaultInstantVRFActionInput,
        inputTokenIds: [BRONZE_ARROW, IRON_ARROW, ADAMANTINE_ARROW],
        inputAmounts: [1, 2, 3],
      };

      await instantVRFActions.addActions([instantVRFActionInput]);
      await itemNFT.testMints(alice.address, [BRONZE_ARROW, IRON_ARROW, ADAMANTINE_ARROW], [3, 3, 3]);

      const actionAmount = 1;
      await expect(
        instantVRFActions
          .connect(alice)
          .doInstantVRFActions(playerId, [instantVRFActionInput.actionId], [actionAmount], {
            value: (await instantVRFActions.requestCost(actionAmount)).sub(1),
          })
      ).to.be.revertedWithCustomError(instantVRFActions, "NotEnoughFTM");
    });

    it("If action is set to full mode only, then it requires an upgraded hero", async function () {
      const {
        playerId,
        instantVRFActions,
        itemNFT,
        editNameBrushPrice,
        upgradePlayerBrushPrice,
        playerNFT,
        origName,
        brush,
        alice,
      } = await loadFixture(playersFixture);

      const instantVRFActionInput: InstantVRFActionInput = {
        ...defaultInstantVRFActionInput,
        inputTokenIds: [BRONZE_ARROW, IRON_ARROW, ADAMANTINE_ARROW],
        inputAmounts: [1, 2, 3],
        isFullModeOnly: true,
      };

      await instantVRFActions.addActions([instantVRFActionInput]);
      await itemNFT.testMints(alice.address, [BRONZE_ARROW, IRON_ARROW, ADAMANTINE_ARROW], [3, 3, 3]);

      const actionAmount = 1;
      await expect(
        instantVRFActions
          .connect(alice)
          .doInstantVRFActions(playerId, [instantVRFActionInput.actionId], [actionAmount], {
            value: (await instantVRFActions.requestCost(actionAmount)).sub(1),
          })
      ).to.be.revertedWithCustomError(instantVRFActions, "PlayerNotUpgraded");

      const brushAmount = editNameBrushPrice.add(upgradePlayerBrushPrice.mul(2));
      await brush.connect(alice).approve(playerNFT.address, brushAmount);
      await brush.mint(alice.address, brushAmount);

      const upgrade = true;
      await expect(playerNFT.connect(alice).editPlayer(playerId, origName, "", "", "", upgrade));

      await expect(
        instantVRFActions
          .connect(alice)
          .doInstantVRFActions(playerId, [instantVRFActionInput.actionId], [actionAmount], {
            value: await instantVRFActions.requestCost(actionAmount),
          })
      ).to.not.be.reverted;
    });

    it("Cannot add same instant action twice", async function () {
      const {instantVRFActions} = await loadFixture(playersFixture);

      const instantVRFActionInput: InstantVRFActionInput = {
        ...defaultInstantVRFActionInput,
      };

      await instantVRFActions.addActions([instantVRFActionInput]);
      await expect(instantVRFActions.addActions([instantVRFActionInput])).to.be.revertedWithCustomError(
        instantVRFActions,
        "ActionAlreadyExists"
      );
    });

    it("Must be owner to add an action", async function () {
      const {instantVRFActions, alice} = await loadFixture(playersFixture);

      const instantVRFActionInput: InstantVRFActionInput = {
        ...defaultInstantVRFActionInput,
      };
      await expect(instantVRFActions.connect(alice).addActions([instantVRFActionInput])).to.be.revertedWithCustomError(
        instantVRFActions,
        "CallerIsNotOwner"
      );
      await instantVRFActions.addActions([instantVRFActionInput]);
    });

    describe("Edit", function () {
      it("Must be owner to edit an action", async function () {
        const {instantVRFActions, alice} = await loadFixture(playersFixture);

        const instantVRFActionInput: InstantVRFActionInput = {
          ...defaultInstantVRFActionInput,
        };
        await instantVRFActions.addActions([instantVRFActionInput]);
        await expect(
          instantVRFActions.connect(alice).editActions([instantVRFActionInput])
        ).to.be.revertedWithCustomError(instantVRFActions, "CallerIsNotOwner");
        await instantVRFActions.editActions([instantVRFActionInput]);
      });

      it("Edited action must exist", async function () {
        const {instantVRFActions} = await loadFixture(playersFixture);

        const instantVRFActionInput: InstantVRFActionInput = {
          ...defaultInstantVRFActionInput,
          inputTokenIds: [BRONZE_ARROW],
          inputAmounts: [1],
        };
        await expect(instantVRFActions.editActions([instantVRFActionInput])).to.be.revertedWithCustomError(
          instantVRFActions,
          "ActionDoesNotExist"
        );
        await instantVRFActions.addActions([instantVRFActionInput]);
        const newinstantVRFActionInput = {
          ...instantVRFActionInput,
          inputTokenIds: [IRON_ARROW],
        };
        await expect(instantVRFActions.editActions([newinstantVRFActionInput])).to.emit(
          instantVRFActions,
          "EditInstantVRFActions"
        );
        expect((await instantVRFActions.actions(1)).inputTokenId1).to.eq(IRON_ARROW);
      });
    });

    describe("Remove", function () {
      it("Must be owner to removed an action", async function () {
        const {instantVRFActions, alice} = await loadFixture(playersFixture);

        const instantVRFActionInput: InstantVRFActionInput = {
          ...defaultInstantVRFActionInput,
          inputTokenIds: [BRONZE_ARROW],
          inputAmounts: [1],
        };
        await instantVRFActions.addActions([instantVRFActionInput]);
        await expect(instantVRFActions.connect(alice).removeActions([1])).to.be.revertedWithCustomError(
          instantVRFActions,
          "CallerIsNotOwner"
        );
      });

      it("Removed action must exist", async function () {
        const {instantVRFActions} = await loadFixture(playersFixture);
        await expect(instantVRFActions.removeActions([1])).to.be.revertedWithCustomError(
          instantVRFActions,
          "ActionDoesNotExist"
        );
        const instantVRFActionInput: InstantVRFActionInput = {
          ...defaultInstantVRFActionInput,
          inputTokenIds: [BRONZE_ARROW],
          inputAmounts: [1],
        };
        await instantVRFActions.addActions([instantVRFActionInput]);
        await expect(instantVRFActions.removeActions([1]))
          .to.emit(instantVRFActions, "RemoveInstantVRFActions")
          .withArgs([1]);
        // Confirm it no longer exists
        expect((await instantVRFActions.actions(1)).inputTokenId1).to.eq(NONE);
      });
    });

    it("Must be owner of player to do instant actions", async function () {
      const {playerId, instantVRFActions} = await loadFixture(playersFixture);

      const instantVRFActionInput: InstantVRFActionInput = {
        ...defaultInstantVRFActionInput,
      };
      await instantVRFActions.addActions([instantVRFActionInput]);

      const actionAmount = 1;
      await expect(
        instantVRFActions.doInstantVRFActions(playerId, [instantVRFActionInput.actionId], [actionAmount], {
          value: await instantVRFActions.requestCost(actionAmount),
        })
      ).to.be.revertedWithCustomError(instantVRFActions, "NotOwnerOfPlayerAndActive");
    });

    it("Cannot do an action which does not exist", async function () {
      const {playerId, instantVRFActions, alice} = await loadFixture(playersFixture);
      await expect(
        instantVRFActions.connect(alice).doInstantVRFActions(playerId, [0], [1])
      ).to.be.revertedWithCustomError(instantVRFActions, "ActionDoesNotExist");
    });

    it("Check amount > 1 burns and mints as expected", async function () {
      const {playerId, instantVRFActions, mockSWVRFOracleClient, itemNFT, alice} = await loadFixture(playersFixture);

      const instantVRFActionInput: InstantVRFActionInput = {
        ...defaultInstantVRFActionInput,
        inputTokenIds: [BRONZE_ARROW, IRON_ARROW, ADAMANTINE_ARROW],
        inputAmounts: [1, 2, 3],
        randomRewards: [{itemTokenId: EstforConstants.RUNITE_ARROW, chance: 65535, amount: 2}],
      };

      await instantVRFActions.addActions([instantVRFActionInput]);
      await itemNFT.testMints(alice.address, [BRONZE_ARROW, IRON_ARROW, ADAMANTINE_ARROW], [6, 6, 6]);

      const actionAmount = 2;
      await instantVRFActions
        .connect(alice)
        .doInstantVRFActions(playerId, [instantVRFActionInput.actionId], [actionAmount], {
          value: await instantVRFActions.requestCost(actionAmount),
        });

      const requestId = 1;
      await fulfillRandomWords(requestId, instantVRFActions, mockSWVRFOracleClient);

      expect(
        await itemNFT.balanceOfs(alice.address, [BRONZE_ARROW, IRON_ARROW, ADAMANTINE_ARROW, RUNITE_ARROW])
      ).to.deep.eq([4, 2, 0, 4]);
    });

    it("CompletedInstantVRFActions event should be emitted with correct produced item output", async function () {
      const {playerId, instantVRFActions, mockSWVRFOracleClient, itemNFT, alice} = await loadFixture(playersFixture);

      const instantVRFActionInput: InstantVRFActionInput = {
        ...defaultInstantVRFActionInput,
        inputTokenIds: [BRONZE_ARROW, IRON_ARROW, ADAMANTINE_ARROW],
        inputAmounts: [1, 2, 3],
        randomRewards: [{itemTokenId: EstforConstants.RUNITE_ARROW, chance: 65535, amount: 2}],
      };

      await instantVRFActions.addActions([instantVRFActionInput]);
      await itemNFT.testMints(alice.address, [BRONZE_ARROW, IRON_ARROW, ADAMANTINE_ARROW], [6, 6, 6]);

      const actionAmount = 2;
      await instantVRFActions
        .connect(alice)
        .doInstantVRFActions(playerId, [instantVRFActionInput.actionId], [actionAmount], {
          value: await instantVRFActions.requestCost(actionAmount),
        });

      const requestId = 1;
      await expect(fulfillRandomWords(requestId, instantVRFActions, mockSWVRFOracleClient))
        .to.emit(instantVRFActions, "CompletedInstantVRFActions")
        .withArgs(alice.address, playerId, requestId, [RUNITE_ARROW], [2]);
    });

    it("Cannot make another request until the ongoing one is fulfilled", async function () {
      const {playerId, instantVRFActions, mockSWVRFOracleClient, itemNFT, alice} = await loadFixture(playersFixture);

      const instantVRFActionInput: InstantVRFActionInput = {
        ...defaultInstantVRFActionInput,
        inputTokenIds: [BRONZE_ARROW, IRON_ARROW, ADAMANTINE_ARROW],
        inputAmounts: [1, 2, 3],
        randomRewards: [{itemTokenId: EstforConstants.RUNITE_ARROW, chance: 65535, amount: 2}],
      };

      await instantVRFActions.addActions([instantVRFActionInput]);
      await itemNFT.testMints(alice.address, [BRONZE_ARROW, IRON_ARROW, ADAMANTINE_ARROW], [12, 12, 12]);

      const actionAmount = 2;
      await instantVRFActions
        .connect(alice)
        .doInstantVRFActions(playerId, [instantVRFActionInput.actionId], [actionAmount], {
          value: await instantVRFActions.requestCost(actionAmount),
        });

      await expect(
        instantVRFActions
          .connect(alice)
          .doInstantVRFActions(playerId, [instantVRFActionInput.actionId], [actionAmount], {
            value: await instantVRFActions.requestCost(actionAmount),
          })
      ).to.be.revertedWithCustomError(instantVRFActions, "AlreadyProcessing");

      // Fulfill the request and it should work
      const requestId = 1;
      await fulfillRandomWords(requestId, instantVRFActions, mockSWVRFOracleClient);
      await expect(
        instantVRFActions
          .connect(alice)
          .doInstantVRFActions(playerId, [instantVRFActionInput.actionId], [actionAmount], {
            value: await instantVRFActions.requestCost(actionAmount),
          })
      ).to.not.be.reverted;
    });

    it("Deleting an action before fulfillment should not revert", async function () {
      const {playerId, instantVRFActions, mockSWVRFOracleClient, itemNFT, alice} = await loadFixture(playersFixture);

      const instantVRFActionInput: InstantVRFActionInput = {
        ...defaultInstantVRFActionInput,
        inputTokenIds: [BRONZE_ARROW, IRON_ARROW, ADAMANTINE_ARROW],
        inputAmounts: [1, 2, 3],
      };

      await instantVRFActions.addActions([instantVRFActionInput]);
      await itemNFT.testMints(alice.address, [BRONZE_ARROW, IRON_ARROW, ADAMANTINE_ARROW], [6, 6, 6]);

      const actionAmount = 2;
      await instantVRFActions
        .connect(alice)
        .doInstantVRFActions(playerId, [instantVRFActionInput.actionId], [actionAmount], {
          value: await instantVRFActions.requestCost(actionAmount),
        });

      await instantVRFActions.removeActions([instantVRFActionInput.actionId]);
      const requestId = 1;
      await expect(fulfillRandomWords(requestId, instantVRFActions, mockSWVRFOracleClient))
        .to.emit(instantVRFActions, "CompletedInstantVRFActions")
        .withArgs(alice.address, playerId, requestId, [], []);
    });

    it("Reverting in the contract receiving the NFTs should not revert the oracle callback", async function () {
      const {playerId, instantVRFActions, mockSWVRFOracleClient, itemNFT, playerNFT, players, alice} =
        await loadFixture(playersFixture);

      const instantVRFActionInput: InstantVRFActionInput = {
        ...defaultInstantVRFActionInput,
        inputTokenIds: [BRONZE_ARROW, IRON_ARROW, ADAMANTINE_ARROW],
        inputAmounts: [1, 2, 3],
      };

      await instantVRFActions.addActions([instantVRFActionInput]);

      const erc1155HolderRogue = (await ethers.deployContract("ERC1155HolderRogue")) as ERC1155HolderRogue;
      await playerNFT.connect(alice).safeTransferFrom(alice.address, erc1155HolderRogue.address, playerId, 1, "0x00");
      await itemNFT.testMints(erc1155HolderRogue.address, [BRONZE_ARROW, IRON_ARROW, ADAMANTINE_ARROW], [6, 6, 6]);

      const actionAmount = 2;
      await erc1155HolderRogue.doInstantVRFActions(
        players.address,
        instantVRFActions.address,
        playerId,
        [instantVRFActionInput.actionId],
        [actionAmount],
        {
          value: await instantVRFActions.requestCost(actionAmount),
        }
      );

      await erc1155HolderRogue.setRevertOnReceive(true);

      const requestId = 1;
      await expect(fulfillRandomWords(requestId, instantVRFActions, mockSWVRFOracleClient))
        .to.emit(instantVRFActions, "CompletedInstantVRFActions")
        .withArgs(erc1155HolderRogue.address, playerId, requestId, [], []);
    });

    it("Add multiple actions", async function () {
      const {instantVRFActions} = await loadFixture(playersFixture);

      const instantVRFActionInput: InstantVRFActionInput = {
        ...defaultInstantVRFActionInput,
        inputTokenIds: [IRON_ARROW, ADAMANTINE_ARROW],
        inputAmounts: [1, 2],
        outputTokenId: RUNITE_ARROW,
        outputAmount: 2,
      };

      const instantVRFActionInput1: InstantVRFActionInput = {
        ...defaultInstantVRFActionInput,
        actionId: 2,
        inputTokenIds: [BRONZE_ARROW, IRON_ARROW, ADAMANTINE_ARROW],
        inputAmounts: [3, 5, 7],
        outputTokenId: ORICHALCUM_ARROW,
        outputAmount: 3,
      };

      await instantVRFActions.addActions([instantVRFActionInput, instantVRFActionInput1]);

      // Get action
      const action1 = await instantVRFActions.actions(1);
      expect(action1.inputTokenId1).to.eq(IRON_ARROW);
      expect(action1.inputTokenId3).to.eq(NONE);
      const action2 = await instantVRFActions.actions(2);
      expect(action2.inputTokenId3).to.eq(ADAMANTINE_ARROW);
    });

    it("Check packed data", async function () {
      const {instantVRFActions} = await loadFixture(playersFixture);

      const instantVRFActionInput: InstantVRFActionInput = {
        ...defaultInstantVRFActionInput,
        isFullModeOnly: true,
      };
      await instantVRFActions.addActions([instantVRFActionInput]);
      expect((await instantVRFActions.actions(instantVRFActionInput.actionId)).packedData == "0x80");
    });

    it("Check full mode requirements", async function () {
      const {playerId, instantVRFActions, brush, upgradePlayerBrushPrice, playerNFT, origName, itemNFT, alice} =
        await loadFixture(playersFixture);

      const instantVRFActionInput: InstantVRFActionInput = {
        ...defaultInstantVRFActionInput,
        inputTokenIds: [BRONZE_ARROW],
        inputAmounts: [1],
        isFullModeOnly: true,
      };
      await instantVRFActions.addActions([instantVRFActionInput]);

      await itemNFT.testMint(alice.address, BRONZE_ARROW, 2);
      const actionAmount = 2;
      await expect(
        instantVRFActions.connect(alice).doInstantVRFActions(playerId, [instantVRFActionInput.actionId], [2], {
          value: await instantVRFActions.requestCost(actionAmount),
        })
      ).to.be.revertedWithCustomError(instantVRFActions, "PlayerNotUpgraded");
      // Upgrade player
      await brush.mint(alice.address, upgradePlayerBrushPrice);
      await brush.connect(alice).approve(playerNFT.address, upgradePlayerBrushPrice);
      const upgrade = true;
      await playerNFT.connect(alice).editPlayer(playerId, origName, "", "", "", upgrade);

      await expect(
        instantVRFActions.connect(alice).doInstantVRFActions(playerId, [instantVRFActionInput.actionId], [2], {
          value: await instantVRFActions.requestCost(actionAmount),
        })
      ).to.not.be.reverted;
    });

    describe("Strategies", function () {
      it("Set strategies", async function () {
        const {instantVRFActions, genericInstantVRFActionStrategy} = await loadFixture(playersFixture);
        await expect(
          instantVRFActions.setStrategies(
            [InstantVRFActionType.FORGING, InstantVRFActionType.GENERIC],
            [genericInstantVRFActionStrategy.address, genericInstantVRFActionStrategy.address]
          )
        )
          .to.emit(instantVRFActions, "SetStrategies")
          .withArgs(
            [InstantVRFActionType.FORGING, InstantVRFActionType.GENERIC],
            [genericInstantVRFActionStrategy.address, genericInstantVRFActionStrategy.address]
          );

        expect(await instantVRFActions.strategies(InstantVRFActionType.FORGING)).to.eq(
          genericInstantVRFActionStrategy.address
        );
        expect(await instantVRFActions.strategies(InstantVRFActionType.GENERIC)).to.eq(
          genericInstantVRFActionStrategy.address
        );
        expect(await instantVRFActions.strategies(InstantVRFActionType.EGG)).to.eq(ethers.constants.AddressZero);
      });

      it("Unuequal length of arrays should revert", async function () {
        const {instantVRFActions, genericInstantVRFActionStrategy} = await loadFixture(playersFixture);
        await expect(
          instantVRFActions.setStrategies(
            [InstantVRFActionType.FORGING, InstantVRFActionType.GENERIC],
            [genericInstantVRFActionStrategy.address]
          )
        ).to.be.revertedWithCustomError(instantVRFActions, "LengthMismatch");
      });

      it("Zero address or NONE InstantVRFActionType should revert", async function () {
        const {instantVRFActions, genericInstantVRFActionStrategy} = await loadFixture(playersFixture);

        await expect(
          instantVRFActions.setStrategies(
            [InstantVRFActionType.FORGING, InstantVRFActionType.GENERIC],
            [genericInstantVRFActionStrategy.address, ethers.constants.AddressZero]
          )
        ).to.be.revertedWithCustomError(instantVRFActions, "InvalidStrategy");

        await expect(
          instantVRFActions.setStrategies(
            [InstantVRFActionType.FORGING, InstantVRFActionType.NONE],
            [genericInstantVRFActionStrategy.address, genericInstantVRFActionStrategy.address]
          )
        ).to.be.revertedWithCustomError(instantVRFActions, "InvalidStrategy");

        await expect(
          instantVRFActions.setStrategies(
            [InstantVRFActionType.FORGING, InstantVRFActionType.GENERIC],
            [genericInstantVRFActionStrategy.address, genericInstantVRFActionStrategy.address]
          )
        ).to.not.be.reverted;
      });

      it("Set strategies, must be called by the owner", async function () {
        const {instantVRFActions, alice, genericInstantVRFActionStrategy} = await loadFixture(playersFixture);
        await expect(
          instantVRFActions
            .connect(alice)
            .setStrategies([InstantVRFActionType.FORGING], [genericInstantVRFActionStrategy.address])
        ).to.be.revertedWithCustomError(instantVRFActions, "CallerIsNotOwner");

        await expect(
          instantVRFActions.setStrategies([InstantVRFActionType.FORGING], [genericInstantVRFActionStrategy.address])
        ).to.not.be.reverted;
      });
    });
  });

  describe("Forging/Generic random rewards", function () {
    const defaultInstantVRFActionInput: InstantVRFActionInput = {
      ..._defaultInstantVRFActionInput,
      actionId: 1,
      inputTokenIds: [BRONZE_ARROW, IRON_ARROW, ADAMANTINE_ARROW],
      inputAmounts: [1, 2, 3],
      randomRewards: [{itemTokenId: EstforConstants.RUNITE_ARROW, chance: 65535, amount: 2}], // 100% chance of 2 runite arrows
      isFullModeOnly: false,
      actionType: EstforTypes.InstantVRFActionType.FORGING,
    };

    it("Random reward validation", async function () {
      const {instantVRFActions, genericInstantVRFActionStrategy} = await loadFixture(playersFixture);

      const instantVRFActionInput: InstantVRFActionInput = {
        ...defaultInstantVRFActionInput,
        inputTokenIds: [BRONZE_ARROW, IRON_ARROW, ADAMANTINE_ARROW],
        inputAmounts: [1, 2, 3],
        randomRewards: [{itemTokenId: EstforConstants.RUNITE_ARROW, chance: 65535, amount: 0}],
      };

      // Must have an amount out that is greater than 0
      await expect(instantVRFActions.addActions([instantVRFActionInput])).to.be.revertedWithCustomError(
        genericInstantVRFActionStrategy,
        "RandomRewardSpecifiedWithoutAmount"
      );

      instantVRFActionInput.randomRewards[0].amount = 1;
      instantVRFActionInput.randomRewards[0].itemTokenId = NONE;
      await expect(instantVRFActions.addActions([instantVRFActionInput])).to.be.revertedWithCustomError(
        genericInstantVRFActionStrategy,
        "RandomRewardSpecifiedWithoutTokenId"
      );

      instantVRFActionInput.randomRewards[0].itemTokenId = EstforConstants.RUNITE_ARROW;
      instantVRFActionInput.randomRewards[0].chance = 0;
      await expect(instantVRFActions.addActions([instantVRFActionInput])).to.be.revertedWithCustomError(
        genericInstantVRFActionStrategy,
        "RandomRewardSpecifiedWithoutChance"
      );

      instantVRFActionInput.randomRewards = [
        {itemTokenId: EstforConstants.RUNITE_ARROW, chance: 1, amount: 1},
        {itemTokenId: EstforConstants.MITHRIL_ARROW, chance: 2, amount: 1},
      ];
      await expect(instantVRFActions.addActions([instantVRFActionInput])).to.be.revertedWithCustomError(
        genericInstantVRFActionStrategy,
        "RandomRewardChanceMustBeInOrder"
      );
      // Equal chance not allowed either
      instantVRFActionInput.randomRewards = [
        {itemTokenId: EstforConstants.RUNITE_ARROW, chance: 1, amount: 1},
        {itemTokenId: EstforConstants.MITHRIL_ARROW, chance: 1, amount: 1},
      ];
      await expect(instantVRFActions.addActions([instantVRFActionInput])).to.be.revertedWithCustomError(
        genericInstantVRFActionStrategy,
        "RandomRewardChanceMustBeInOrder"
      );

      instantVRFActionInput.randomRewards = [
        {itemTokenId: EstforConstants.RUNITE_ARROW, chance: 2, amount: 1},
        {itemTokenId: EstforConstants.RUNITE_ARROW, chance: 1, amount: 1},
      ];
      await expect(instantVRFActions.addActions([instantVRFActionInput])).to.be.revertedWithCustomError(
        genericInstantVRFActionStrategy,
        "RandomRewardItemNoDuplicates"
      );

      (instantVRFActionInput.randomRewards = [
        {itemTokenId: EstforConstants.RUNITE_ARROW, chance: 10, amount: 1},
        {itemTokenId: EstforConstants.ORICHALCUM_ARROW, chance: 9, amount: 1},
        {itemTokenId: EstforConstants.BRONZE_ARROW, chance: 8, amount: 1},
        {itemTokenId: EstforConstants.IRON_ARROW, chance: 7, amount: 1},
        {itemTokenId: EstforConstants.ADAMANTINE_ARROW, chance: 6, amount: 1},
        {itemTokenId: EstforConstants.MITHRIL_ARROW, chance: 5, amount: 1},
      ]),
        await expect(instantVRFActions.addActions([instantVRFActionInput])).to.be.revertedWithCustomError(
          genericInstantVRFActionStrategy,
          "TooManyRandomRewards"
        );
    });

    it("Check random rewards (many)", async function () {
      const {playerId, instantVRFActions, mockSWVRFOracleClient, itemNFT, alice} = await loadFixture(playersFixture);
      this.retries(3);
      this.timeout(100000); // 100 seconds, this test might take a while on CI

      const instantVRFActionInput: InstantVRFActionInput = {
        ...defaultInstantVRFActionInput,
        inputTokenIds: [BRONZE_ARROW],
        inputAmounts: [1],
        randomRewards: [
          {itemTokenId: EstforConstants.RUNITE_ARROW, chance: 65535, amount: 2}, // 30% chance of 2 runite arrows
          {itemTokenId: EstforConstants.MITHRIL_ARROW, chance: 45874, amount: 2}, // 20% chance of 2 runite arrows
          {itemTokenId: EstforConstants.ADAMANTINE_ARROW, chance: 32767, amount: 2}, // 40% chance of 2 runite arrows
          {itemTokenId: EstforConstants.ORICHALCUM_ARROW, chance: 6553, amount: 2}, // 10% chance of orichalcum arrows
        ],
      };

      // Add it twice, just to get this tested
      await instantVRFActions.addActions([instantVRFActionInput, {...instantVRFActionInput, actionId: 2}]);

      await itemNFT.testMint(alice.address, BRONZE_ARROW, 1000000);
      const actionAmount1 = 48;
      const actionAmount2 = 47;
      const actionAmount = actionAmount1 + actionAmount2;
      // Repeat the test a bunch of times to check the random rewards are as expected
      const numRepeats = 50;
      for (let i = 0; i < numRepeats; ++i) {
        // Use some multiple of 16 and not
        await instantVRFActions
          .connect(alice)
          .doInstantVRFActions(
            playerId,
            [instantVRFActionInput.actionId, instantVRFActionInput.actionId + 1],
            [actionAmount1, actionAmount2],
            {
              value: await instantVRFActions.requestCost(actionAmount),
            }
          );

        await fulfillRandomWords(i + 1, instantVRFActions, mockSWVRFOracleClient);
      }

      const balances = await itemNFT.balanceOfs(alice.address, [
        EstforConstants.RUNITE_ARROW,
        EstforConstants.MITHRIL_ARROW,
        EstforConstants.ADAMANTINE_ARROW,
        EstforConstants.ORICHALCUM_ARROW,
      ]);

      for (let i = 0; i < instantVRFActionInput.randomRewards.length - 1; ++i) {
        const chance =
          instantVRFActionInput.randomRewards[i].chance - instantVRFActionInput.randomRewards[i + 1].chance;
        const expectedBalance = Math.floor(
          (actionAmount * numRepeats * instantVRFActionInput.randomRewards[i].amount * chance) / 65535
        );
        expect(balances[i]).to.not.eq(expectedBalance); // Very unlikely to be exact, but possible. This checks there is at least some randomness
        expect(balances[i]).to.be.gte(Math.floor(expectedBalance * 0.85)); // Within 15% below
        expect(balances[i]).to.be.lte(Math.floor(expectedBalance * 1.15)); // 15% of the time we should get more than 50% of the reward
      }

      // Check the last one
      const expectedBalance = Math.floor(
        (actionAmount *
          numRepeats *
          instantVRFActionInput.randomRewards[instantVRFActionInput.randomRewards.length - 1].amount *
          instantVRFActionInput.randomRewards[instantVRFActionInput.randomRewards.length - 1].chance) /
          65535
      );

      expect(balances[instantVRFActionInput.randomRewards.length - 1]).to.not.eq(expectedBalance); // Very unlikely to be exact, but possible. This checks there is at least some randomness
      expect(balances[instantVRFActionInput.randomRewards.length - 1]).to.be.gte(Math.floor(expectedBalance * 0.85)); // Within 15% below
      expect(balances[instantVRFActionInput.randomRewards.length - 1]).to.be.lte(Math.floor(expectedBalance * 1.15)); // 15% of the time we should get more than 50% of the reward
    });
  });
  describe("Egg hatching random rewards", function () {});
});
