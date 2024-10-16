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
import {AbiCoder, ZeroAddress} from "ethers"; // ethers v6
import {ethers} from "hardhat";
import {ERC1155HolderRogue} from "../typechain-types";

const abiCoder = new AbiCoder();

describe("Instant VRF actions", function () {
  const forgingFixture = async function () {
    const fixture = {...(await loadFixture(playersFixture))};

    await fixture.instantVRFActions.addStrategies(
      [InstantVRFActionType.FORGING, InstantVRFActionType.GENERIC],
      [
        await fixture.genericInstantVRFActionStrategy.getAddress(),
        await fixture.genericInstantVRFActionStrategy.getAddress(),
      ]
    );
    return fixture;
  };

  describe("Shared", function () {
    const defaultInstantVRFActionInput: InstantVRFActionInput = {
      ..._defaultInstantVRFActionInput,
      actionId: 1,
      inputTokenIds: [BRONZE_ARROW, IRON_ARROW, ADAMANTINE_ARROW],
      inputAmounts: [1, 2, 3],
      data: abiCoder.encode(
        ["uint8 version", "tuple(uint16 itemTokenId,uint16 chance,uint16 amount)[]"],
        [0, [{itemTokenId: EstforConstants.RUNITE_ARROW, chance: 65535, amount: 2}]]
      ), // 100% chance of 2 runite arrows
      isFullModeOnly: false,
      actionType: EstforTypes.InstantVRFActionType.FORGING,
    };

    it("Check input item order", async function () {
      const {instantVRFActions} = await loadFixture(forgingFixture);

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
      const {instantVRFActions} = await loadFixture(forgingFixture);

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
      const {playerId, instantVRFActions, itemNFT, alice} = await loadFixture(forgingFixture);

      const instantVRFActionInput: InstantVRFActionInput = {
        ...defaultInstantVRFActionInput,
        inputTokenIds: [BRONZE_ARROW, IRON_ARROW, ADAMANTINE_ARROW],
        inputAmounts: [1, 2, 3],
      };

      await instantVRFActions.addActions([instantVRFActionInput]);
      await itemNFT.testMints(await alice.getAddress(), [BRONZE_ARROW, IRON_ARROW, ADAMANTINE_ARROW], [3, 3, 3]);

      const actionAmount = 1;
      await instantVRFActions
        .connect(alice)
        .doInstantVRFActions(playerId, [instantVRFActionInput.actionId], [actionAmount], {
          value: await instantVRFActions.requestCost(actionAmount),
        });

      expect(
        await itemNFT.balanceOfs(await alice.getAddress(), [BRONZE_ARROW, IRON_ARROW, ADAMANTINE_ARROW])
      ).to.deep.eq([2, 1, 0]);
    });

    it("Cannot use greater than MAX_ACTION_AMOUNT for a single action", async function () {
      const {playerId, instantVRFActions, itemNFT, alice} = await loadFixture(forgingFixture);

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
      await itemNFT.testMints(
        await alice.getAddress(),
        [BRONZE_ARROW, IRON_ARROW, ADAMANTINE_ARROW],
        [1000, 1000, 1000]
      );

      const MAX_ACTION_AMOUNT = await instantVRFActions.MAX_ACTION_AMOUNT();

      const actionAmount = MAX_ACTION_AMOUNT + 1n;
      await expect(
        instantVRFActions
          .connect(alice)
          .doInstantVRFActions(playerId, [instantVRFActionInput.actionId], [actionAmount], {
            value: await instantVRFActions.requestCost(actionAmount),
          })
      ).to.be.revertedWithCustomError(instantVRFActions, "TooManyActionAmounts");

      await expect(
        instantVRFActions
          .connect(alice)
          .doInstantVRFActions(playerId, [instantVRFActionInput1.actionId], [MAX_ACTION_AMOUNT], {
            value: await instantVRFActions.requestCost(MAX_ACTION_AMOUNT),
          })
      ).to.not.be.reverted;
    });

    it("Cannot use greater than MAX_ACTION_AMOUNT for the combined action amounts", async function () {
      const {playerId, instantVRFActions, itemNFT, alice} = await loadFixture(forgingFixture);

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
      await itemNFT.testMints(
        await alice.getAddress(),
        [BRONZE_ARROW, IRON_ARROW, ADAMANTINE_ARROW],
        [1000, 1000, 1000]
      );

      const MAX_ACTION_AMOUNT = await instantVRFActions.MAX_ACTION_AMOUNT();

      const actionAmount = MAX_ACTION_AMOUNT - 2n;
      let actionAmount1 = 3;
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

      actionAmount1 = 1;
      await expect(
        instantVRFActions
          .connect(alice)
          .doInstantVRFActions(
            playerId,
            [instantVRFActionInput.actionId, instantVRFActionInput1.actionId],
            [actionAmount, actionAmount1],
            {value: await instantVRFActions.requestCost(actionAmount)}
          )
      ).to.not.be.reverted;
    });

    it("Do multiple instant actions at once", async function () {
      const {playerId, instantVRFActions, itemNFT, mockVRF, alice} = await loadFixture(forgingFixture);

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
        await alice.getAddress(),
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
          await alice.getAddress(),
          playerId,
          requestId,
          [instantVRFActionInput.actionId, instantVRFActionInput1.actionId],
          [2, 1],
          [BRONZE_ARROW, IRON_ARROW, ADAMANTINE_ARROW, BRONZE_BAR, IRON_BAR, ADAMANTINE_BAR],
          [2, 4, 6, 4, 5, 6]
        );

      expect(
        await itemNFT.balanceOfs(await alice.getAddress(), [BRONZE_ARROW, IRON_ARROW, ADAMANTINE_ARROW])
      ).to.deep.eq([4, 2, 0]);

      await fulfillRandomWords(requestId, instantVRFActions, mockVRF);

      expect(await itemNFT.balanceOfs(await alice.getAddress(), [BRONZE_BAR, IRON_BAR, ADAMANTINE_BAR])).to.deep.eq([
        2, 1, 0,
      ]);
    });

    it("Not paying the request cost", async function () {
      const {playerId, instantVRFActions, itemNFT, alice} = await loadFixture(forgingFixture);

      const instantVRFActionInput: InstantVRFActionInput = {
        ...defaultInstantVRFActionInput,
        inputTokenIds: [BRONZE_ARROW, IRON_ARROW, ADAMANTINE_ARROW],
        inputAmounts: [1, 2, 3],
      };

      await instantVRFActions.addActions([instantVRFActionInput]);
      await itemNFT.testMints(await alice.getAddress(), [BRONZE_ARROW, IRON_ARROW, ADAMANTINE_ARROW], [3, 3, 3]);

      const actionAmount = 1;
      await expect(
        instantVRFActions
          .connect(alice)
          .doInstantVRFActions(playerId, [instantVRFActionInput.actionId], [actionAmount], {
            value: (await instantVRFActions.requestCost(actionAmount)) - 1n,
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
      } = await loadFixture(forgingFixture);

      const instantVRFActionInput: InstantVRFActionInput = {
        ...defaultInstantVRFActionInput,
        inputTokenIds: [BRONZE_ARROW, IRON_ARROW, ADAMANTINE_ARROW],
        inputAmounts: [1, 2, 3],
        isFullModeOnly: true,
      };

      await instantVRFActions.addActions([instantVRFActionInput]);
      await itemNFT.testMints(await alice.getAddress(), [BRONZE_ARROW, IRON_ARROW, ADAMANTINE_ARROW], [3, 3, 3]);

      const actionAmount = 1;
      await expect(
        instantVRFActions
          .connect(alice)
          .doInstantVRFActions(playerId, [instantVRFActionInput.actionId], [actionAmount], {
            value: (await instantVRFActions.requestCost(actionAmount)) - 1n,
          })
      ).to.be.revertedWithCustomError(instantVRFActions, "PlayerNotUpgraded");

      const brushAmount = (editNameBrushPrice + upgradePlayerBrushPrice) * 2n;
      await brush.connect(alice).approve(await playerNFT.getAddress(), brushAmount);
      await brush.mint(await alice.getAddress(), brushAmount);

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
      const {instantVRFActions} = await loadFixture(forgingFixture);

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
      const {instantVRFActions, alice} = await loadFixture(forgingFixture);

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
        const {instantVRFActions, alice} = await loadFixture(forgingFixture);

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
        const {instantVRFActions} = await loadFixture(forgingFixture);

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
        const {instantVRFActions, alice} = await loadFixture(forgingFixture);

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
        const {instantVRFActions} = await loadFixture(forgingFixture);
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
      const {playerId, instantVRFActions} = await loadFixture(forgingFixture);

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
      const {playerId, instantVRFActions, alice} = await loadFixture(forgingFixture);
      await expect(
        instantVRFActions.connect(alice).doInstantVRFActions(playerId, [0], [1])
      ).to.be.revertedWithCustomError(instantVRFActions, "ActionDoesNotExist");
    });

    it("Check amount > 1 burns and mints as expected", async function () {
      const {playerId, instantVRFActions, mockVRF, itemNFT, alice} = await loadFixture(forgingFixture);

      const instantVRFActionInput: InstantVRFActionInput = {
        ...defaultInstantVRFActionInput,
      };

      await instantVRFActions.addActions([instantVRFActionInput]);
      await itemNFT.testMints(await alice.getAddress(), [BRONZE_ARROW, IRON_ARROW, ADAMANTINE_ARROW], [6, 6, 6]);

      const actionAmount = 2;
      await instantVRFActions
        .connect(alice)
        .doInstantVRFActions(playerId, [instantVRFActionInput.actionId], [actionAmount], {
          value: await instantVRFActions.requestCost(actionAmount),
        });

      const requestId = 1;
      await fulfillRandomWords(requestId, instantVRFActions, mockVRF);

      expect(
        await itemNFT.balanceOfs(await alice.getAddress(), [BRONZE_ARROW, IRON_ARROW, ADAMANTINE_ARROW, RUNITE_ARROW])
      ).to.deep.eq([4, 2, 0, 4]);
    });

    it("CompletedInstantVRFActions event should be emitted with correct produced item output", async function () {
      const {playerId, instantVRFActions, mockVRF, itemNFT, alice} = await loadFixture(forgingFixture);

      const instantVRFActionInput: InstantVRFActionInput = {
        ...defaultInstantVRFActionInput,
      };

      await instantVRFActions.addActions([instantVRFActionInput]);
      await itemNFT.testMints(await alice.getAddress(), [BRONZE_ARROW, IRON_ARROW, ADAMANTINE_ARROW], [6, 6, 6]);

      const actionAmount = 2;
      await instantVRFActions
        .connect(alice)
        .doInstantVRFActions(playerId, [instantVRFActionInput.actionId], [actionAmount], {
          value: await instantVRFActions.requestCost(actionAmount),
        });

      // TODO: check the double RUNITE_ARROW
      const requestId = 1;
      await expect(fulfillRandomWords(requestId, instantVRFActions, mockVRF))
        .to.emit(instantVRFActions, "CompletedInstantVRFActions")
        .withArgs(await alice.getAddress(), playerId, requestId, [RUNITE_ARROW, RUNITE_ARROW], [2, 2], []);
    });

    it("Cannot make another request until the ongoing one is fulfilled", async function () {
      const {playerId, instantVRFActions, mockVRF, itemNFT, alice} = await loadFixture(forgingFixture);

      const instantVRFActionInput: InstantVRFActionInput = {
        ...defaultInstantVRFActionInput,
      };

      await instantVRFActions.addActions([instantVRFActionInput]);
      await itemNFT.testMints(await alice.getAddress(), [BRONZE_ARROW, IRON_ARROW, ADAMANTINE_ARROW], [12, 12, 12]);

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
      await fulfillRandomWords(requestId, instantVRFActions, mockVRF);
      await expect(
        instantVRFActions
          .connect(alice)
          .doInstantVRFActions(playerId, [instantVRFActionInput.actionId], [actionAmount], {
            value: await instantVRFActions.requestCost(actionAmount),
          })
      ).to.not.be.reverted;
    });

    it("Deleting an action before fulfillment should not revert", async function () {
      const {playerId, instantVRFActions, mockVRF, itemNFT, alice} = await loadFixture(forgingFixture);

      const instantVRFActionInput: InstantVRFActionInput = {
        ...defaultInstantVRFActionInput,
        inputTokenIds: [BRONZE_ARROW, IRON_ARROW, ADAMANTINE_ARROW],
        inputAmounts: [1, 2, 3],
      };

      await instantVRFActions.addActions([instantVRFActionInput]);
      await itemNFT.testMints(await alice.getAddress(), [BRONZE_ARROW, IRON_ARROW, ADAMANTINE_ARROW], [6, 6, 6]);

      const actionAmount = 2;
      await instantVRFActions
        .connect(alice)
        .doInstantVRFActions(playerId, [instantVRFActionInput.actionId], [actionAmount], {
          value: await instantVRFActions.requestCost(actionAmount),
        });

      await instantVRFActions.removeActions([instantVRFActionInput.actionId]);
      const requestId = 1;
      await expect(fulfillRandomWords(requestId, instantVRFActions, mockVRF))
        .to.emit(instantVRFActions, "CompletedInstantVRFActions")
        .withArgs(await alice.getAddress(), playerId, requestId, [], [], []);
    });

    it("Reverting in the contract receiving the NFTs should not revert the oracle callback", async function () {
      const {playerId, instantVRFActions, mockVRF, itemNFT, playerNFT, players, alice} = await loadFixture(
        forgingFixture
      );

      const instantVRFActionInput: InstantVRFActionInput = {
        ...defaultInstantVRFActionInput,
        inputTokenIds: [BRONZE_ARROW, IRON_ARROW, ADAMANTINE_ARROW],
        inputAmounts: [1, 2, 3],
      };

      await instantVRFActions.addActions([instantVRFActionInput]);

      const erc1155HolderRogue = (await ethers.deployContract("ERC1155HolderRogue")) as ERC1155HolderRogue;
      await playerNFT
        .connect(alice)
        .safeTransferFrom(await alice.getAddress(), await erc1155HolderRogue.getAddress(), playerId, 1, "0x00");
      await itemNFT.testMints(
        await erc1155HolderRogue.getAddress(),
        [BRONZE_ARROW, IRON_ARROW, ADAMANTINE_ARROW],
        [6, 6, 6]
      );

      const actionAmount = 2;
      await erc1155HolderRogue.doInstantVRFActions(
        await players.getAddress(),
        await instantVRFActions.getAddress(),
        playerId,
        [instantVRFActionInput.actionId],
        [actionAmount],
        {
          value: await instantVRFActions.requestCost(actionAmount),
        }
      );

      await erc1155HolderRogue.setRevertOnReceive(true);

      const requestId = 1;
      await expect(fulfillRandomWords(requestId, instantVRFActions, mockVRF))
        .to.emit(instantVRFActions, "CompletedInstantVRFActions")
        .withArgs(await erc1155HolderRogue.getAddress(), playerId, requestId, [], [], []);
    });

    it("Add multiple actions", async function () {
      const {instantVRFActions} = await loadFixture(forgingFixture);

      const instantVRFActionInput: InstantVRFActionInput = {
        ...defaultInstantVRFActionInput,
        inputTokenIds: [IRON_ARROW, ADAMANTINE_ARROW],
        inputAmounts: [1, 2],
      };

      const instantVRFActionInput1: InstantVRFActionInput = {
        ...defaultInstantVRFActionInput,
        actionId: 2,
        inputTokenIds: [BRONZE_ARROW, IRON_ARROW, ADAMANTINE_ARROW],
        inputAmounts: [3, 5, 7],
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
      const {instantVRFActions} = await loadFixture(forgingFixture);

      const instantVRFActionInput: InstantVRFActionInput = {
        ...defaultInstantVRFActionInput,
        isFullModeOnly: true,
      };
      await instantVRFActions.addActions([instantVRFActionInput]);
      expect((await instantVRFActions.actions(instantVRFActionInput.actionId)).packedData == "0x80");
    });

    it("Check full mode requirements", async function () {
      const {playerId, instantVRFActions, brush, upgradePlayerBrushPrice, playerNFT, origName, itemNFT, alice} =
        await loadFixture(forgingFixture);

      const instantVRFActionInput: InstantVRFActionInput = {
        ...defaultInstantVRFActionInput,
        inputTokenIds: [BRONZE_ARROW],
        inputAmounts: [1],
        isFullModeOnly: true,
      };
      await instantVRFActions.addActions([instantVRFActionInput]);

      await itemNFT.testMint(await alice.getAddress(), BRONZE_ARROW, 2);
      const actionAmount = 2;
      await expect(
        instantVRFActions.connect(alice).doInstantVRFActions(playerId, [instantVRFActionInput.actionId], [2], {
          value: await instantVRFActions.requestCost(actionAmount),
        })
      ).to.be.revertedWithCustomError(instantVRFActions, "PlayerNotUpgraded");
      // Upgrade player
      await brush.mint(await alice.getAddress(), upgradePlayerBrushPrice);
      await brush.connect(alice).approve(await playerNFT.getAddress(), upgradePlayerBrushPrice);
      const upgrade = true;
      await playerNFT.connect(alice).editPlayer(playerId, origName, "", "", "", upgrade);

      await expect(
        instantVRFActions.connect(alice).doInstantVRFActions(playerId, [instantVRFActionInput.actionId], [2], {
          value: await instantVRFActions.requestCost(actionAmount),
        })
      ).to.not.be.reverted;
    });

    describe("Strategies", function () {
      it("Add strategies", async function () {
        const {instantVRFActions, genericInstantVRFActionStrategy} = await loadFixture(playersFixture);

        await expect(
          instantVRFActions.addStrategies(
            [InstantVRFActionType.FORGING, InstantVRFActionType.GENERIC],
            [await genericInstantVRFActionStrategy.getAddress(), await genericInstantVRFActionStrategy.getAddress()]
          )
        )
          .to.emit(instantVRFActions, "AddStrategies")
          .withArgs(
            [InstantVRFActionType.FORGING, InstantVRFActionType.GENERIC],
            [await genericInstantVRFActionStrategy.getAddress(), await genericInstantVRFActionStrategy.getAddress()]
          );

        expect(await instantVRFActions.strategies(InstantVRFActionType.FORGING)).to.eq(
          await genericInstantVRFActionStrategy.getAddress()
        );
        expect(await instantVRFActions.strategies(InstantVRFActionType.GENERIC)).to.eq(
          await genericInstantVRFActionStrategy.getAddress()
        );
        expect(await instantVRFActions.strategies(InstantVRFActionType.EGG)).to.eq(ZeroAddress);
      });

      it("Adding same strategy should revert", async function () {
        const {instantVRFActions, genericInstantVRFActionStrategy} = await loadFixture(playersFixture);
        await instantVRFActions.addStrategies(
          [InstantVRFActionType.FORGING],
          [await genericInstantVRFActionStrategy.getAddress()]
        );
        await expect(
          instantVRFActions.addStrategies(
            [InstantVRFActionType.FORGING],
            [await genericInstantVRFActionStrategy.getAddress()]
          )
        ).to.be.revertedWithCustomError(instantVRFActions, "StrategyAlreadyExists");
      });

      it("Unuequal length of arrays should revert", async function () {
        const {instantVRFActions, genericInstantVRFActionStrategy} = await loadFixture(playersFixture);
        await expect(instantVRFActions.addStrategies([InstantVRFActionType.EGG], [])).to.be.revertedWithCustomError(
          instantVRFActions,
          "LengthMismatch"
        );
      });

      it("Zero address or NONE InstantVRFActionType should revert", async function () {
        const {instantVRFActions, genericInstantVRFActionStrategy} = await loadFixture(playersFixture);

        await expect(
          instantVRFActions.addStrategies(
            [InstantVRFActionType.FORGING, InstantVRFActionType.GENERIC],
            [await genericInstantVRFActionStrategy.getAddress(), ZeroAddress]
          )
        ).to.be.revertedWithCustomError(instantVRFActions, "InvalidStrategy");

        await expect(
          instantVRFActions.addStrategies(
            [InstantVRFActionType.FORGING, InstantVRFActionType.NONE],
            [await genericInstantVRFActionStrategy.getAddress(), await genericInstantVRFActionStrategy.getAddress()]
          )
        ).to.be.revertedWithCustomError(instantVRFActions, "InvalidStrategy");

        await expect(
          instantVRFActions.addStrategies(
            [InstantVRFActionType.FORGING, InstantVRFActionType.GENERIC],
            [await genericInstantVRFActionStrategy.getAddress(), await genericInstantVRFActionStrategy.getAddress()]
          )
        ).to.not.be.reverted;
      });

      it("Add strategies, must be called by the owner", async function () {
        const {instantVRFActions, genericInstantVRFActionStrategy, alice} = await loadFixture(playersFixture);

        await expect(
          instantVRFActions
            .connect(alice)
            .addStrategies([InstantVRFActionType.FORGING], [await genericInstantVRFActionStrategy.getAddress()])
        ).to.be.revertedWithCustomError(instantVRFActions, "CallerIsNotOwner");

        await expect(
          instantVRFActions.addStrategies(
            [InstantVRFActionType.FORGING],
            [await genericInstantVRFActionStrategy.getAddress()]
          )
        ).to.not.be.reverted;
      });

      it("Must add strategy before it can be used", async function () {
        const {instantVRFActions, genericInstantVRFActionStrategy} = await loadFixture(playersFixture);

        const instantVRFActionInput: InstantVRFActionInput = {
          ...defaultInstantVRFActionInput,
          inputTokenIds: [BRONZE_ARROW],
          inputAmounts: [1],
          data: abiCoder.encode(
            ["uint8 version", "tuple(uint16 itemTokenId,uint16 chance,uint16 amount)[]"],
            [0, [{itemTokenId: EstforConstants.RUNITE_ARROW, chance: 65535, amount: 1}]]
          ),
          actionType: EstforTypes.InstantVRFActionType.EGG,
        };

        await expect(instantVRFActions.addActions([instantVRFActionInput])).to.be.revertedWithCustomError(
          instantVRFActions,
          "InvalidStrategy"
        );

        await expect(
          instantVRFActions.addStrategies(
            [InstantVRFActionType.EGG],
            [await genericInstantVRFActionStrategy.getAddress()]
          )
        )
          .to.emit(instantVRFActions, "AddStrategies")
          .withArgs([InstantVRFActionType.EGG], [await genericInstantVRFActionStrategy.getAddress()]);
        await expect(instantVRFActions.addActions([instantVRFActionInput])).to.not.be.reverted;
      });
    });

    it("Unavailable instant VRF action cannot be started, but can be looted", async function () {
      const {playerId, instantVRFActions, mockVRF, itemNFT, alice} = await loadFixture(forgingFixture);

      const instantVRFActionInput: InstantVRFActionInput = {
        ...defaultInstantVRFActionInput,
      };

      await instantVRFActions.addActions([instantVRFActionInput]);
      await itemNFT.testMints(await alice.getAddress(), [BRONZE_ARROW, IRON_ARROW, ADAMANTINE_ARROW], [6, 6, 6]);

      const actionAmount = 2;
      await instantVRFActions.setAvailable([instantVRFActionInput.actionId], false);
      await expect(
        instantVRFActions
          .connect(alice)
          .doInstantVRFActions(playerId, [instantVRFActionInput.actionId], [actionAmount], {
            value: await instantVRFActions.requestCost(actionAmount),
          })
      ).to.be.revertedWithCustomError(instantVRFActions, "ActionNotAvailable");

      await instantVRFActions.setAvailable([instantVRFActionInput.actionId], true);
      await instantVRFActions
        .connect(alice)
        .doInstantVRFActions(playerId, [instantVRFActionInput.actionId], [actionAmount], {
          value: await instantVRFActions.requestCost(actionAmount),
        });
      await instantVRFActions.setAvailable([instantVRFActionInput.actionId], false);

      // Even if the action is unavailable you can do the VRF response correctly.
      const requestId = 1;
      // TODO: double check RUNITE_ARROW
      await expect(fulfillRandomWords(requestId, instantVRFActions, mockVRF))
        .to.emit(instantVRFActions, "CompletedInstantVRFActions")
        .withArgs(await alice.getAddress(), playerId, requestId, [RUNITE_ARROW, RUNITE_ARROW], [2, 2], []);
    });
  });

  describe("Forging/Generic random rewards", function () {
    const defaultInstantVRFActionInput: InstantVRFActionInput = {
      ..._defaultInstantVRFActionInput,
      actionId: 1,
      isFullModeOnly: false,
      actionType: EstforTypes.InstantVRFActionType.FORGING,
    };

    it("Random reward validation", async function () {
      const {instantVRFActions, genericInstantVRFActionStrategy} = await loadFixture(forgingFixture);

      let randomRewards = [{itemTokenId: EstforConstants.RUNITE_ARROW, chance: 65535, amount: 0}];
      const instantVRFActionInput: InstantVRFActionInput = {
        ...defaultInstantVRFActionInput,
        inputTokenIds: [BRONZE_ARROW, IRON_ARROW, ADAMANTINE_ARROW],
        inputAmounts: [1, 2, 3],
        data: abiCoder.encode(
          ["uint8 version", "tuple(uint16 itemTokenId,uint16 chance,uint16 amount)[]"],
          [0, randomRewards]
        ), // 100% chance of 2 runite arrows
      };

      // Must have an amount out that is greater than 0
      await expect(instantVRFActions.addActions([instantVRFActionInput])).to.be.revertedWithCustomError(
        genericInstantVRFActionStrategy,
        "RandomRewardSpecifiedWithoutAmount"
      );

      randomRewards[0].amount = 1;
      randomRewards[0].itemTokenId = NONE;

      instantVRFActionInput.data = abiCoder.encode(
        ["uint8 version", "tuple(uint16 itemTokenId,uint16 chance,uint16 amount)[]"],
        [0, randomRewards]
      );

      await expect(instantVRFActions.addActions([instantVRFActionInput])).to.be.revertedWithCustomError(
        genericInstantVRFActionStrategy,
        "RandomRewardSpecifiedWithoutTokenId"
      );

      randomRewards[0].itemTokenId = EstforConstants.RUNITE_ARROW;
      randomRewards[0].chance = 0;

      instantVRFActionInput.data = abiCoder.encode(
        ["uint8 version", "tuple(uint16 itemTokenId,uint16 chance,uint16 amount)[]"],
        [0, randomRewards]
      );

      await expect(instantVRFActions.addActions([instantVRFActionInput])).to.be.revertedWithCustomError(
        genericInstantVRFActionStrategy,
        "RandomRewardSpecifiedWithoutChance"
      );

      randomRewards = [
        {itemTokenId: EstforConstants.RUNITE_ARROW, chance: 1, amount: 1},
        {itemTokenId: EstforConstants.MITHRIL_ARROW, chance: 2, amount: 1},
      ];

      instantVRFActionInput.data = abiCoder.encode(
        ["uint8 version", "tuple(uint16 itemTokenId,uint16 chance,uint16 amount)[]"],
        [0, randomRewards]
      );
      await expect(instantVRFActions.addActions([instantVRFActionInput])).to.be.revertedWithCustomError(
        genericInstantVRFActionStrategy,
        "RandomRewardChanceMustBeInOrder"
      );
      // Equal chance not allowed either
      randomRewards = [
        {itemTokenId: EstforConstants.RUNITE_ARROW, chance: 1, amount: 1},
        {itemTokenId: EstforConstants.MITHRIL_ARROW, chance: 1, amount: 1},
      ];
      instantVRFActionInput.data = abiCoder.encode(
        ["uint8 version", "tuple(uint16 itemTokenId,uint16 chance,uint16 amount)[]"],
        [0, randomRewards]
      );

      await expect(instantVRFActions.addActions([instantVRFActionInput])).to.be.revertedWithCustomError(
        genericInstantVRFActionStrategy,
        "RandomRewardChanceMustBeInOrder"
      );

      randomRewards = [
        {itemTokenId: EstforConstants.RUNITE_ARROW, chance: 10, amount: 1},
        {itemTokenId: EstforConstants.ORICHALCUM_ARROW, chance: 9, amount: 1},
        {itemTokenId: EstforConstants.BRONZE_ARROW, chance: 8, amount: 1},
        {itemTokenId: EstforConstants.IRON_ARROW, chance: 7, amount: 1},
        {itemTokenId: EstforConstants.ADAMANTINE_ARROW, chance: 6, amount: 1},
        {itemTokenId: EstforConstants.MITHRIL_ARROW, chance: 5, amount: 1},
        {itemTokenId: EstforConstants.ADAMANTINE_BAR, chance: 4, amount: 1},
        {itemTokenId: EstforConstants.MITHRIL_BAR, chance: 3, amount: 1},
        {itemTokenId: EstforConstants.RUNITE_BAR, chance: 2, amount: 1},
        {itemTokenId: EstforConstants.ORICHALCUM_BAR, chance: 1, amount: 1},
        {itemTokenId: EstforConstants.ADAMANTINE_ORE, chance: 1, amount: 1},
      ];

      instantVRFActionInput.data = abiCoder.encode(
        ["uint8 version", "tuple(uint16 itemTokenId,uint16 chance,uint16 amount)[]"],
        [0, randomRewards]
      );

      await expect(instantVRFActions.addActions([instantVRFActionInput])).to.be.revertedWithCustomError(
        genericInstantVRFActionStrategy,
        "TooManyRandomRewards"
      );

      randomRewards.pop();
      instantVRFActionInput.data = abiCoder.encode(
        ["uint8 version", "tuple(uint16 itemTokenId,uint16 chance,uint16 amount)[]"],
        [0, randomRewards]
      );

      await expect(instantVRFActions.addActions([instantVRFActionInput])).to.not.be.reverted;
    });

    it("Check random rewards (many)", async function () {
      const {playerId, instantVRFActions, mockVRF, itemNFT, alice} = await loadFixture(forgingFixture);
      this.timeout(100000); // 100 seconds, this test might take a while on CI

      const randomRewards = [
        {itemTokenId: EstforConstants.IRON_ARROW, chance: 65535n, amount: 2n}, // 30% chance of 2 runite arrows
        {itemTokenId: EstforConstants.MITHRIL_ARROW, chance: 45874n, amount: 2n}, // 20% chance of 2 runite arrows
        {itemTokenId: EstforConstants.ADAMANTINE_ARROW, chance: 32767n, amount: 2n}, // 40% chance of 2 runite arrows
        {itemTokenId: EstforConstants.RUNITE_ARROW, chance: 6553n, amount: 2n}, // 10% chance of orichalcum arrows
      ];

      const instantVRFActionInput: InstantVRFActionInput = {
        ...defaultInstantVRFActionInput,
        inputTokenIds: [BRONZE_ARROW],
        inputAmounts: [1],
        data: abiCoder.encode(
          ["uint8 version", "tuple(uint16 itemTokenId,uint16 chance,uint16 amount)[]"],
          [0, randomRewards]
        ),
      };

      // Add it twice, just to get this tested
      await instantVRFActions.addActions([instantVRFActionInput, {...instantVRFActionInput, actionId: 2}]);

      await itemNFT.testMint(await alice.getAddress(), BRONZE_ARROW, 1000000);

      const MAX_ACTION_AMOUNT = await instantVRFActions.MAX_ACTION_AMOUNT();

      const actionAmount1 = MAX_ACTION_AMOUNT / 2n;
      const actionAmount2 = MAX_ACTION_AMOUNT / 2n - 1n;
      const actionAmount = actionAmount1 + actionAmount2;
      // Repeat the test a bunch of times to check the random rewards are as expected
      const numRepeats = 50n;

      for (let i = 0n; i < numRepeats; ++i) {
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

        await fulfillRandomWords(i + 1n, instantVRFActions, mockVRF);
      }

      const balances = await itemNFT.balanceOfs(alice, [
        EstforConstants.IRON_ARROW,
        EstforConstants.MITHRIL_ARROW,
        EstforConstants.ADAMANTINE_ARROW,
        EstforConstants.RUNITE_ARROW,
      ]);

      for (let i = 0; i < randomRewards.length - 1; ++i) {
        const chance = randomRewards[i].chance - randomRewards[i + 1].chance;
        const expectedBalance = (actionAmount * numRepeats * randomRewards[i].amount * chance) / 65535n;
        expect(balances[i]).to.not.eq(expectedBalance); // Very unlikely to be exact, but possible. This checks there is at least some randomness
        // Within 20% below (expectedBalance * 0.2)
        expect(balances[i]).to.be.gte((expectedBalance * 20n) / 100n);
        // 20% above (expectedBalance * 1.2)
        expect(balances[i]).to.be.lte((expectedBalance * 120n) / 100n);
      }

      // Check the last one
      const expectedBalance =
        (actionAmount *
          numRepeats *
          randomRewards[randomRewards.length - 1].amount *
          randomRewards[randomRewards.length - 1].chance) /
        65535n;

      expect(balances[randomRewards.length - 1]).to.not.eq(expectedBalance); // Very unlikely to be exact, but possible. This checks there is at least some randomness
      // Within 20% below (expectedBalance * 0.2)
      expect(balances[randomRewards.length - 1]).to.be.gte((expectedBalance * 20n) / 100n);
      // 20% above (expectedBalance * 1.2)
      expect(balances[randomRewards.length - 1]).to.be.lte((expectedBalance * 120n) / 100n);
    });
  });

  describe("Egg hatching random rewards", function () {
    const eggFixture = async function () {
      const fixture = {...(await loadFixture(playersFixture))};

      await fixture.instantVRFActions.addStrategies(
        [InstantVRFActionType.EGG],
        [await fixture.genericInstantVRFActionStrategy.getAddress()] // TODO: Update
      );
      return fixture;
    };

    const defaultInstantVRFActionInput: InstantVRFActionInput = {
      ..._defaultInstantVRFActionInput,
      actionId: 1,
      inputTokenIds: [BRONZE_ARROW, IRON_ARROW, ADAMANTINE_ARROW],
      inputAmounts: [1, 2, 3],
      data: abiCoder.encode(
        ["uint8 version", "tuple(uint16 itemTokenId,uint16 chance,uint16 amount)[]"],
        [0, [{itemTokenId: EstforConstants.RUNITE_ARROW, chance: 65535, amount: 2}]]
      ),
      isFullModeOnly: false,
      actionType: EstforTypes.InstantVRFActionType.EGG,
    };
  });
});
