import {loadFixture, time} from "@nomicfoundation/hardhat-network-helpers";
import {EstforTypes, EstforConstants} from "@paintswap/estfor-definitions";
import {expect} from "chai";
import {ethers} from "hardhat";
import {createPlayer} from "../scripts/utils";
import {playersFixture} from "./Players/PlayersFixture";

describe("Global Events", function () {
  async function deployContracts() {
    const baseFixture = await loadFixture(playersFixture);
    return {...baseFixture};
  }

  it("should revert when non-owner tries to create event", async function () {
    const {globalEvents, bob} = await loadFixture(deployContracts);
    await expect(
      globalEvents.connect(bob).addGlobalEvents(
        [1],
        [
          {
            startTime: await time.latest(),
            endTime: 0,
            rewardItemTokenId: EstforConstants.BRONZE_ARROW,
            rewardItemAmountPerInput: 1,
            inputItemTokenId: EstforConstants.LOG,
            inputItemMaxAmount: 100,
            totalInputAmount: 0,
          },
        ]
      )
    ).to.be.revertedWithCustomError(globalEvents, "OwnableUnauthorizedAccount");
  });

  it("should add a global event", async function () {
    const {globalEvents} = await loadFixture(deployContracts);
    const startTime = await time.latest();
    const eventId = 1;
    const eventInfo = {
      startTime,
      endTime: 0,
      rewardItemTokenId: EstforConstants.BRONZE_ARROW,
      rewardItemAmountPerInput: 2,
      inputItemTokenId: EstforConstants.LOG,
      inputItemMaxAmount: 100,
      totalInputAmount: 0,
    };

    await expect(globalEvents.addGlobalEvents([eventId], [eventInfo]))
      .to.emit(globalEvents, "AddGlobalEvent")
      .withArgs(eventId, [
        BigInt(eventInfo.startTime),
        BigInt(eventInfo.endTime),
        BigInt(eventInfo.rewardItemTokenId),
        BigInt(eventInfo.rewardItemAmountPerInput),
        BigInt(eventInfo.inputItemTokenId),
        BigInt(eventInfo.inputItemMaxAmount),
        BigInt(eventInfo.totalInputAmount),
      ]);
  });

  it("should revert if event info is invalid", async function () {
    const {globalEvents} = await loadFixture(deployContracts);
    const startTime = await time.latest();

    await expect(
      globalEvents.addGlobalEvents(
        [0],
        [
          {
            startTime,
            endTime: 0,
            rewardItemTokenId: 1,
            rewardItemAmountPerInput: 1,
            inputItemTokenId: 2,
            inputItemMaxAmount: 100,
            totalInputAmount: 0,
          },
        ]
      )
    ).to.be.revertedWithCustomError(globalEvents, "EventIdZero");

    await expect(
      globalEvents.addGlobalEvents(
        [1],
        [
          {
            startTime: 0,
            endTime: 0,
            rewardItemTokenId: 1,
            rewardItemAmountPerInput: 1,
            inputItemTokenId: 2,
            inputItemMaxAmount: 100,
            totalInputAmount: 0,
          },
        ]
      )
    ).to.be.revertedWithCustomError(globalEvents, "StartTimeZero");

    await expect(
      globalEvents.addGlobalEvents(
        [1],
        [
          {
            startTime,
            endTime: startTime - 1,
            rewardItemTokenId: 1,
            rewardItemAmountPerInput: 1,
            inputItemTokenId: 2,
            inputItemMaxAmount: 100,
            totalInputAmount: 0,
          },
        ]
      )
    ).to.be.revertedWithCustomError(globalEvents, "EndTimeBeforeStartTime");
  });

  it("should revert on contribute if amount is zero", async function () {
    const {globalEvents} = await loadFixture(deployContracts);
    await expect(globalEvents.contribute(1, 0)).to.be.revertedWithCustomError(globalEvents, "AmountZero");
  });

  it("should revert if event has not started", async function () {
    const {globalEvents} = await loadFixture(deployContracts);
    const startTime = (await time.latest()) + 100;
    await globalEvents.addGlobalEvents(
      [1],
      [
        {
          startTime,
          endTime: 0,
          rewardItemTokenId: EstforConstants.BRONZE_ARROW,
          rewardItemAmountPerInput: 1,
          inputItemTokenId: EstforConstants.LOG,
          inputItemMaxAmount: 100,
          totalInputAmount: 0,
        },
      ]
    );

    await expect(globalEvents.contribute(1, 10)).to.be.revertedWithCustomError(globalEvents, "EventNotStarted");
  });

  it("should revert if event has ended", async function () {
    const {globalEvents} = await loadFixture(deployContracts);
    const startTime = await time.latest();
    const endTime = startTime + 100;
    await globalEvents.addGlobalEvents(
      [1],
      [
        {
          startTime,
          endTime,
          rewardItemTokenId: EstforConstants.BRONZE_ARROW,
          rewardItemAmountPerInput: 1,
          inputItemTokenId: EstforConstants.LOG,
          inputItemMaxAmount: 100,
          totalInputAmount: 0,
        },
      ]
    );

    await time.increase(200);
    await expect(globalEvents.contribute(1, 10)).to.be.revertedWithCustomError(globalEvents, "EventEnded");
  });

  it("should revert if event is at max capacity", async function () {
    const {globalEvents, playerNFT, itemNFT, bob} = await loadFixture(deployContracts);
    const startTime = await time.latest();
    const inputItemMaxAmount = 100;
    await globalEvents.addGlobalEvents(
      [1],
      [
        {
          startTime,
          endTime: 0,
          rewardItemTokenId: EstforConstants.BRONZE_ARROW,
          rewardItemAmountPerInput: 1,
          inputItemTokenId: EstforConstants.LOG,
          inputItemMaxAmount,
          totalInputAmount: 0,
        },
      ]
    );

    await createPlayer(playerNFT, 1, bob, "bob", true);
    await itemNFT.mint(bob, EstforConstants.LOG, 101);

    await expect(globalEvents.connect(bob).contribute(1, 101)).to.be.revertedWithCustomError(
      globalEvents,
      "EventAtMaxCapacity"
    );
  });

  it("should revert if user has no active player", async function () {
    const {globalEvents, itemNFT, bob} = await loadFixture(deployContracts);
    const startTime = await time.latest();
    await globalEvents.addGlobalEvents(
      [1],
      [
        {
          startTime,
          endTime: 0,
          rewardItemTokenId: EstforConstants.BRONZE_ARROW,
          rewardItemAmountPerInput: 1,
          inputItemTokenId: EstforConstants.LOG,
          inputItemMaxAmount: 100,
          totalInputAmount: 0,
        },
      ]
    );

    await itemNFT.mint(bob, EstforConstants.LOG, 10);
    await expect(globalEvents.connect(bob).contribute(1, 10)).to.be.revertedWithCustomError(
      globalEvents,
      "NoActivePlayer"
    );
  });

  it("should contribute to a global event", async function () {
    const {globalEvents, playerNFT, itemNFT, bob} = await loadFixture(deployContracts);
    const startTime = await time.latest();
    const eventId = 1;
    const rewardItemAmountPerInput = 2;
    const inputItemTokenId = EstforConstants.LOG;
    const rewardItemTokenId = EstforConstants.BRONZE_ARROW;

    await globalEvents.addGlobalEvents(
      [eventId],
      [
        {
          startTime,
          endTime: 0,
          rewardItemTokenId,
          rewardItemAmountPerInput,
          inputItemTokenId,
          inputItemMaxAmount: 100,
          totalInputAmount: 0,
        },
      ]
    );

    const playerId = await createPlayer(playerNFT, 1, bob, "bob", true);
    const amount = 10;
    await itemNFT.mint(bob, inputItemTokenId, amount);

    await expect(globalEvents.connect(bob).contribute(eventId, amount))
      .to.emit(globalEvents, "ContributeToGlobalEvent")
      .withArgs(bob.address, eventId, playerId, amount)
      .and.to.emit(itemNFT, "TransferSingle")
      .withArgs(await globalEvents.getAddress(), bob.address, ethers.ZeroAddress, inputItemTokenId, amount) // burn
      .and.to.emit(itemNFT, "TransferSingle")
      .withArgs(
        await globalEvents.getAddress(),
        ethers.ZeroAddress,
        bob.address,
        rewardItemTokenId,
        amount * rewardItemAmountPerInput
      ); // mint

    expect(await itemNFT.balanceOf(bob.address, inputItemTokenId)).to.equal(0);
    expect(await itemNFT.balanceOf(bob.address, rewardItemTokenId)).to.equal(amount * rewardItemAmountPerInput);
  });

  it("should contribute multiple times", async function () {
    const {globalEvents, playerNFT, itemNFT, bob} = await loadFixture(deployContracts);
    const startTime = await time.latest();
    const eventId = 1;
    const inputItemTokenId = EstforConstants.LOG;
    const rewardItemTokenId = EstforConstants.BRONZE_ARROW;

    await globalEvents.addGlobalEvents(
      [eventId],
      [
        {
          startTime,
          endTime: 0,
          rewardItemTokenId,
          rewardItemAmountPerInput: 1,
          inputItemTokenId,
          inputItemMaxAmount: 100,
          totalInputAmount: 0,
        },
      ]
    );

    const playerId = await createPlayer(playerNFT, 1, bob, "bob", true);
    await itemNFT.mint(bob, inputItemTokenId, 30);

    await globalEvents.connect(bob).contribute(eventId, 10);
    await globalEvents.connect(bob).contribute(eventId, 20);

    expect(await itemNFT.balanceOf(bob.address, rewardItemTokenId)).to.equal(30);
  });
});
