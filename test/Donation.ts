import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {expect} from "chai";
import {ethers} from "hardhat";
import {playersFixture} from "./Players/PlayersFixture";
import {getRequestId} from "./utils";
import {EstforConstants, EstforTypes} from "@paintswap/estfor-definitions";
import {createPlayer} from "../scripts/utils";
import {setupBasicWoodcutting} from "./Players/utils";

describe("Donation", function () {
  async function deployContracts() {
    const baseFixture = await loadFixture(playersFixture);

    const {alice, donation, brush, itemNFT, world, mockOracleClient} = baseFixture;

    // Make sure it passes the next checkpoint so there are no issues running
    const {timestamp} = await ethers.provider.getBlock("latest");
    const nextCheckpoint = Math.floor(timestamp / 86400) * 86400 + 86400;
    const durationToNextCheckpoint = nextCheckpoint - timestamp + 1;
    await ethers.provider.send("evm_increaseTime", [durationToNextCheckpoint]);
    let tx = await world.requestRandomWords();
    await mockOracleClient.fulfill(await getRequestId(tx), world.address);

    const totalBrush = ethers.utils.parseEther("10000");
    await brush.mint(alice.address, totalBrush);
    await brush.connect(alice).approve(donation.address, totalBrush);

    const boostValue = 10;
    const boostDuration = 3600;
    await itemNFT.addItems([
      {
        ...EstforTypes.defaultItemInput,
        tokenId: EstforConstants.EXTRA_XP_BOOST,
        equipPosition: EstforTypes.EquipPosition.EXTRA_BOOST_VIAL,
        // Boost
        boostType: EstforTypes.BoostType.ANY_XP,
        boostValue,
        boostDuration,
        isTransferable: false,
      },
      {
        ...EstforTypes.defaultItemInput,
        tokenId: EstforConstants.EXTRA_HALF_XP_BOOST,
        equipPosition: EstforTypes.EquipPosition.EXTRA_BOOST_VIAL,
        // Boost
        boostType: EstforTypes.BoostType.ANY_XP,
        boostValue: 5,
        boostDuration,
        isTransferable: false,
      },
      {
        ...EstforTypes.defaultItemInput,
        tokenId: EstforConstants.PRAY_TO_THE_BEARDIE,
        equipPosition: EstforTypes.EquipPosition.GLOBAL_BOOST_VIAL,
        // Boost
        boostType: EstforTypes.BoostType.ANY_XP,
        boostValue: 10,
        boostDuration,
        isTransferable: false,
      },
      {
        ...EstforTypes.defaultItemInput,
        tokenId: EstforConstants.CLAN_BOOST,
        equipPosition: EstforTypes.EquipPosition.CLAN_BOOST_VIAL,
        // Boost
        boostType: EstforTypes.BoostType.ANY_XP,
        boostValue: 10,
        boostDuration,
        isTransferable: false,
      },
    ]);

    const raffleEntryCost = await donation.getRaffleEntryCost();

    return {...baseFixture, totalBrush, raffleEntryCost};
  }

  it("Only Players contract can call donate", async function () {
    const {donation, alice} = await loadFixture(deployContracts);
    await expect(donation.connect(alice).donate(alice.address, 0, 100)).to.be.revertedWithCustomError(
      donation,
      "OnlyPlayers"
    );
  });

  it("Donate without using a player", async function () {
    const {shop, players, brush, alice, totalBrush} = await loadFixture(deployContracts);
    await players.connect(alice).donate(0, ethers.utils.parseEther("1"));
    expect(await brush.balanceOf(alice.address)).to.eq(totalBrush.sub(ethers.utils.parseEther("1")));
    expect(await brush.balanceOf(shop.address)).to.eq(ethers.utils.parseEther("1"));
  });

  it("Donate with player", async function () {
    const {shop, players, brush, alice, totalBrush, playerId} = await loadFixture(deployContracts);
    const amount = ethers.utils.parseEther("1");
    await players.connect(alice).donate(playerId, amount);
    expect(await brush.balanceOf(alice.address)).to.eq(totalBrush.sub(amount));
    expect(await brush.balanceOf(shop.address)).to.eq(amount);

    await expect(players.connect(alice).donate(playerId.add(1), amount)).to.be.revertedWithCustomError(
      players,
      "NotOwnerOfPlayer"
    );
  });

  it("Claim lottery winnings", async function () {
    const {donation, players, alice, world, mockOracleClient, playerId, raffleEntryCost} = await loadFixture(
      deployContracts
    );

    let lotteryId = await donation.lastLotteryId();
    expect(lotteryId).to.eq(1);

    await players.connect(alice).donate(playerId, raffleEntryCost);

    await ethers.provider.send("evm_increaseTime", [24 * 3600]);
    await mockOracleClient.fulfill(await getRequestId(await world.requestRandomWords()), world.address);

    expect(await donation.hasPlayerEntered(lotteryId, playerId)).to.be.true;

    // Should be unclaimed
    expect(await donation.hasClaimedReward(lotteryId)).to.eq(false);
    await expect(players.connect(alice).processActions(playerId))
      .to.emit(donation, "ClaimedLotteryWinnings")
      .withArgs(lotteryId, 1, EstforConstants.EXTRA_XP_BOOST, 1);
    expect(await donation.hasClaimedReward(lotteryId)).to.eq(true);
    lotteryId = await donation.lastLotteryId();
    expect(lotteryId).to.eq(2);

    // Cannot claim again
    await expect(players.connect(alice).processActions(playerId)).to.not.emit(donation, "ClaimedLotteryWinnings");
  });

  it("Reach minimum to get a ticket", async function () {
    const {donation, avatarId, totalBrush, players, alice, brush, playerId, playerNFT, raffleEntryCost} =
      await loadFixture(deployContracts);

    let lotteryId = await donation.lastLotteryId();
    expect(lotteryId).to.eq(1);
    await players.connect(alice).donate(playerId, ethers.utils.parseEther("0.1"));
    expect(await donation.hasPlayerEntered(lotteryId, playerId)).to.be.false;

    // Use a new player and check that minimum works
    const newPlayerId = await createPlayer(playerNFT, avatarId, alice, "my name ser", true);
    await brush.mint(alice.address, totalBrush);
    await brush.connect(alice).approve(donation.address, totalBrush);
    await players.connect(alice).donate(newPlayerId, raffleEntryCost);
    expect(await donation.hasPlayerEntered(lotteryId, newPlayerId)).to.be.true;
  });

  it("Cannot donate until the previous day oracle is called", async function () {
    const {donation, players, alice, world, mockOracleClient, playerId, raffleEntryCost} = await loadFixture(
      deployContracts
    );

    await ethers.provider.send("evm_increaseTime", [24 * 3600]);
    await expect(players.connect(alice).donate(playerId, raffleEntryCost));
    await mockOracleClient.fulfill(await getRequestId(await world.requestRandomWords()), world.address);
    await ethers.provider.send("evm_increaseTime", [24 * 3600]);

    let lotteryId = await donation.lastLotteryId();
    expect(lotteryId).to.eq(2);
    await expect(players.connect(alice).donate(playerId, raffleEntryCost)).to.be.revertedWithCustomError(
      donation,
      "OracleNotCalledYet"
    );
    await mockOracleClient.fulfill(await getRequestId(await world.requestRandomWords()), world.address);
    await expect(players.connect(alice).donate(playerId, raffleEntryCost)).to.not.be.reverted;
  });

  it("Cannot donate to a raffle with playerId more than once a day", async function () {
    const {donation, players, alice, playerId, raffleEntryCost} = await loadFixture(deployContracts);

    await players.connect(alice).donate(playerId, raffleEntryCost);
    await expect(players.connect(alice).donate(playerId, raffleEntryCost)).to.be.revertedWithCustomError(
      donation,
      "AlreadyEnteredRaffle"
    );

    // Wait until the next day
  });

  it("Check threshold rewards", async function () {
    const {donation, players, alice, playerId} = await loadFixture(deployContracts);

    const nextThreshold = await donation.getNextGlobalThreshold();
    expect(nextThreshold).to.be.gt(0);

    await players.connect(alice).donate(0, nextThreshold.sub(ethers.utils.parseEther("2")));
    await expect(players.connect(alice).donate(playerId, ethers.utils.parseEther("1"))).to.not.emit(
      donation,
      "NextDonationThreshold"
    );

    await expect(players.connect(alice).donate(0, ethers.utils.parseEther("1").toString()))
      .to.emit(donation, "NextDonationThreshold")
      .withArgs(ethers.utils.parseEther("2000"), EstforConstants.PRAY_TO_THE_BEARDIE)
      .and.to.emit(players, "ConsumeGlobalBoostVial");

    expect(await donation.getNextGlobalThreshold()).to.eq(ethers.utils.parseEther("2000"));

    await expect(players.connect(alice).donate(0, ethers.utils.parseEther("1500")))
      .to.emit(donation, "NextDonationThreshold")
      .withArgs(ethers.utils.parseEther("3500"), EstforConstants.PRAY_TO_THE_BEARDIE)
      .and.to.emit(players, "ConsumeGlobalBoostVial");

    // Donated 500 above the old threshold
    expect(await donation.getNextGlobalThreshold()).to.eq(ethers.utils.parseEther("3500"));
  });

  it("Check claiming previous claims works up to 3 other lotteries ago", async function () {
    const {
      donation,
      players,
      alice,
      playerId,
      playerNFT,
      avatarId,
      brush,
      totalBrush,
      mockOracleClient,
      world,
      owner,
      raffleEntryCost,
    } = await loadFixture(deployContracts);

    await players.connect(alice).donate(playerId, raffleEntryCost);
    let lotteryId = await donation.lastLotteryId();
    expect(lotteryId).to.eq(1);

    await brush.mint(owner.address, totalBrush);
    await brush.connect(owner).approve(donation.address, totalBrush);
    for (let i = 0; i < 3; ++i) {
      await ethers.provider.send("evm_increaseTime", [24 * 3600]);
      await mockOracleClient.fulfill(await getRequestId(await world.requestRandomWords()), world.address);
      const newPlayerId = await createPlayer(playerNFT, avatarId, owner, "my name ser" + i, false);
      await players.connect(owner).donate(newPlayerId, raffleEntryCost);
    }

    // Should no longer be claimable
    await ethers.provider.send("evm_increaseTime", [24 * 3600]);
    await mockOracleClient.fulfill(await getRequestId(await world.requestRandomWords()), world.address);

    expect(await donation.hasClaimedReward(lotteryId)).to.eq(false);

    await players.connect(alice).processActions(playerId);
    expect(await donation.hasClaimedReward(lotteryId)).to.eq(false); // Still unclaimed

    // Now do the same but only with 2 more winners which should leave this one claimable
    await players.connect(alice).donate(playerId, raffleEntryCost);
    lotteryId = await donation.lastLotteryId();
    for (let i = 0; i < 2; ++i) {
      await ethers.provider.send("evm_increaseTime", [24 * 3600]);
      await mockOracleClient.fulfill(await getRequestId(await world.requestRandomWords()), world.address);
      const newPlayerId = await createPlayer(playerNFT, avatarId, owner, "should work now" + i, false);
      await players.connect(owner).donate(newPlayerId, raffleEntryCost);
    }
    await ethers.provider.send("evm_increaseTime", [24 * 3600]);
    await mockOracleClient.fulfill(await getRequestId(await world.requestRandomWords()), world.address);

    expect(await donation.hasClaimedReward(lotteryId)).to.eq(false);
    await players.connect(alice).processActions(playerId);
    expect(await donation.hasClaimedReward(lotteryId)).to.eq(true);
    // Check elements are removed at the end as expected

    expect(await donation.lastUnclaimedWinners(4));

    // Do a claim in-between, check lastUnclaimedWinners array is updated as expected
    await players.connect(alice).donate(playerId, raffleEntryCost);
    lotteryId = await donation.lastLotteryId();

    await ethers.provider.send("evm_increaseTime", [24 * 3600]);
    await mockOracleClient.fulfill(await getRequestId(await world.requestRandomWords()), world.address);
    expect(await donation.lastUnclaimedWinners(4)).to.eq(playerId);
    expect(await donation.lastUnclaimedWinners(5)).to.eq(lotteryId);
    const newPlayerId = await createPlayer(playerNFT, avatarId, owner, "cheesy", true);
    await players.connect(owner).donate(newPlayerId, raffleEntryCost);
    await ethers.provider.send("evm_increaseTime", [24 * 3600]);
    await mockOracleClient.fulfill(await getRequestId(await world.requestRandomWords()), world.address);
    expect(await donation.lastUnclaimedWinners(2)).to.eq(playerId);
    expect(await donation.lastUnclaimedWinners(3)).to.eq(lotteryId);

    await players.connect(alice).processActions(playerId); // claim the rewards

    expect(await donation.lastUnclaimedWinners(2)).to.eq(newPlayerId);
    expect(await donation.lastUnclaimedWinners(3)).to.eq(lotteryId + 1);

    expect(await donation.lastUnclaimedWinners(4)).to.eq(0);
    expect(await donation.lastUnclaimedWinners(5)).to.eq(0);
  });

  it("Multiple unclaimed wins should be claimed after each other", async function () {
    const {donation, players, alice, playerId, brush, totalBrush, mockOracleClient, world, owner, raffleEntryCost} =
      await loadFixture(deployContracts);

    await players.connect(alice).donate(playerId, raffleEntryCost);
    let lotteryId = await donation.lastLotteryId();
    expect(lotteryId).to.eq(1);

    await brush.mint(owner.address, totalBrush);
    await brush.connect(owner).approve(donation.address, totalBrush);
    for (let i = 0; i < 2; ++i) {
      await ethers.provider.send("evm_increaseTime", [24 * 3600]);
      await mockOracleClient.fulfill(await getRequestId(await world.requestRandomWords()), world.address);
      await players.connect(alice).donate(playerId, raffleEntryCost);
    }
    await ethers.provider.send("evm_increaseTime", [24 * 3600]);
    await mockOracleClient.fulfill(await getRequestId(await world.requestRandomWords()), world.address);

    expect(await donation.lastUnclaimedWinners(0)).to.eq(playerId);
    expect(await donation.lastUnclaimedWinners(1)).to.eq(lotteryId);
    expect(await donation.lastUnclaimedWinners(2)).to.eq(playerId);
    expect(await donation.lastUnclaimedWinners(3)).to.eq(lotteryId + 1);
    expect(await donation.lastUnclaimedWinners(4)).to.eq(playerId);
    expect(await donation.lastUnclaimedWinners(5)).to.eq(lotteryId + 2);

    await players.connect(alice).processActions(playerId);
    expect(await donation.hasClaimedReward(lotteryId)).to.be.true;
    expect(await donation.lastUnclaimedWinners(0)).to.eq(playerId);
    expect(await donation.lastUnclaimedWinners(1)).to.eq(lotteryId + 1);
    expect(await donation.lastUnclaimedWinners(2)).to.eq(playerId);
    expect(await donation.lastUnclaimedWinners(3)).to.eq(lotteryId + 2);
    expect(await donation.lastUnclaimedWinners(4)).to.eq(0);
    expect(await donation.lastUnclaimedWinners(5)).to.eq(0);

    await players.connect(alice).processActions(playerId);
    expect(await donation.hasClaimedReward(lotteryId + 1)).to.be.true;
    expect(await donation.lastUnclaimedWinners(0)).to.eq(playerId);
    expect(await donation.lastUnclaimedWinners(1)).to.eq(lotteryId + 2);
    expect(await donation.lastUnclaimedWinners(2)).to.eq(0);
    expect(await donation.lastUnclaimedWinners(3)).to.eq(0);
    expect(await donation.lastUnclaimedWinners(4)).to.eq(0);
    expect(await donation.lastUnclaimedWinners(5)).to.eq(0);

    await players.connect(alice).processActions(playerId);
    expect(await donation.hasClaimedReward(lotteryId + 2)).to.be.true;
    expect(await donation.lastUnclaimedWinners(0)).to.eq(0);
    expect(await donation.lastUnclaimedWinners(1)).to.eq(0);
    expect(await donation.lastUnclaimedWinners(2)).to.eq(0);
    expect(await donation.lastUnclaimedWinners(3)).to.eq(0);
    expect(await donation.lastUnclaimedWinners(4)).to.eq(0);
    expect(await donation.lastUnclaimedWinners(5)).to.eq(0);
  });

  it("Get extra XP boost as part of queueing a donation", async function () {
    const {players, alice, playerId, itemNFT, world, raffleEntryCost} = await loadFixture(deployContracts);

    const {queuedAction} = await setupBasicWoodcutting(itemNFT, world);

    await players.connect(alice).startActionsExtra(
      playerId,
      [queuedAction],
      EstforConstants.NONE,
      0,
      0,
      raffleEntryCost, // donation
      EstforTypes.ActionQueueStatus.NONE
    );

    // Should have the implicit boost
    const activeBoost = await players.activeBoost(playerId);
    expect(activeBoost.extraBoostType).to.eq(EstforTypes.BoostType.ANY_XP);
    expect(activeBoost.extraValue).to.eq(5);
  });
});
