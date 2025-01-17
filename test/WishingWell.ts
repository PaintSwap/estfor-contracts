import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {expect} from "chai";
import {ethers} from "hardhat";
import {playersFixture} from "./Players/PlayersFixture";
import {initializerSlot, requestAndFulfillRandomWords, timeTravel24Hours, timeTravelToNextCheckpoint} from "./utils";
import {EstforConstants, EstforTypes} from "@paintswap/estfor-definitions";
import {createPlayer} from "../scripts/utils";
import {BOOST_START_NOW, getPlayersHelper, setupBasicWoodcutting} from "./Players/utils";
import {parseEther} from "ethers";

describe("WishingWell", function () {
  async function deployContracts() {
    const baseFixture = await loadFixture(playersFixture);

    const {alice, wishingWell, brush, itemNFT, randomnessBeacon, mockVRF} = baseFixture;

    // Make sure it passes the next checkpoint so there are no issues running
    await timeTravelToNextCheckpoint();
    await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);

    const totalBrush = parseEther("100000");
    await brush.mint(alice, totalBrush);
    await brush.connect(alice).approve(wishingWell, totalBrush);

    const boostDuration = 3600;
    await itemNFT.addItems([
      {
        ...EstforTypes.defaultItemInput,
        tokenId: EstforConstants.LUCKY_POTION,
        equipPosition: EstforTypes.EquipPosition.EXTRA_BOOST_VIAL,
        // Boost
        boostType: EstforTypes.BoostType.ANY_XP,
        boostValue: 10,
        boostDuration,
        isTransferable: false
      },
      {
        ...EstforTypes.defaultItemInput,
        tokenId: EstforConstants.LUCK_OF_THE_DRAW,
        equipPosition: EstforTypes.EquipPosition.EXTRA_BOOST_VIAL,
        // Boost
        boostType: EstforTypes.BoostType.ANY_XP,
        boostValue: 5,
        boostDuration,
        isTransferable: false
      },
      {
        ...EstforTypes.defaultItemInput,
        tokenId: EstforConstants.PRAY_TO_THE_BEARDIE,
        equipPosition: EstforTypes.EquipPosition.GLOBAL_BOOST_VIAL,
        // Boost
        boostType: EstforTypes.BoostType.ANY_XP,
        boostValue: 10,
        boostDuration,
        isTransferable: false
      },
      {
        ...EstforTypes.defaultItemInput,
        tokenId: EstforConstants.PRAY_TO_THE_BEARDIE_2,
        equipPosition: EstforTypes.EquipPosition.GLOBAL_BOOST_VIAL,
        // Boost
        boostType: EstforTypes.BoostType.COMBAT_XP,
        boostValue: 10,
        boostDuration,
        isTransferable: false
      },
      {
        ...EstforTypes.defaultItemInput,
        tokenId: EstforConstants.PRAY_TO_THE_BEARDIE_3,
        equipPosition: EstforTypes.EquipPosition.GLOBAL_BOOST_VIAL,
        // Boost
        boostType: EstforTypes.BoostType.NON_COMBAT_XP,
        boostValue: 10,
        boostDuration,
        isTransferable: false
      },
      {
        ...EstforTypes.defaultItemInput,
        tokenId: EstforConstants.CLAN_BOOSTER,
        equipPosition: EstforTypes.EquipPosition.CLAN_BOOST_VIAL,
        // Boost
        boostType: EstforTypes.BoostType.ANY_XP,
        boostValue: 10,
        boostDuration,
        isTransferable: false
      },
      {
        ...EstforTypes.defaultItemInput,
        tokenId: EstforConstants.CLAN_BOOSTER_2,
        equipPosition: EstforTypes.EquipPosition.CLAN_BOOST_VIAL,
        // Boost
        boostType: EstforTypes.BoostType.COMBAT_XP,
        boostValue: 10,
        boostDuration,
        isTransferable: false
      },
      {
        ...EstforTypes.defaultItemInput,
        tokenId: EstforConstants.CLAN_BOOSTER_3,
        equipPosition: EstforTypes.EquipPosition.CLAN_BOOST_VIAL,
        // Boost
        boostType: EstforTypes.BoostType.NON_COMBAT_XP,
        boostValue: 10,
        boostDuration,
        isTransferable: false
      }
    ]);

    const raffleEntryCost = await wishingWell.getRaffleEntryCost();

    return {...baseFixture, totalBrush, raffleEntryCost};
  }

  it("Only Players contract can call donate", async function () {
    const {wishingWell, alice} = await loadFixture(deployContracts);
    await expect(wishingWell.connect(alice).donate(alice, 0, 100)).to.be.revertedWithCustomError(
      wishingWell,
      "NotPlayers"
    );
  });

  it("Donate without using a player", async function () {
    const {treasury, players, brush, alice, totalBrush} = await loadFixture(deployContracts);
    await players.connect(alice).donate(0, parseEther("1"));
    expect(await brush.balanceOf(alice)).to.eq(totalBrush - parseEther("1"));
    expect(await brush.balanceOf(treasury)).to.eq(parseEther("1"));
  });

  it("Donate with player", async function () {
    const {treasury, players, brush, alice, totalBrush, playerId} = await loadFixture(deployContracts);
    const amount = parseEther("1");
    await players.connect(alice).donate(playerId, amount);
    expect(await brush.balanceOf(alice)).to.eq(totalBrush - amount);
    expect(await brush.balanceOf(treasury)).to.eq(amount);

    await expect(players.connect(alice).donate(playerId + 1n, amount)).to.be.revertedWithCustomError(
      players,
      "NotOwnerOfPlayer"
    );
  });

  it("Check initialization params", async function () {
    const {randomnessBeacon, brush, playerNFT, shop, clans} = await loadFixture(deployContracts);

    const wishingWell = await ethers.deployContract("WishingWell");

    await ethers.provider.send("hardhat_setStorageAt", [
      await wishingWell.getAddress(),
      initializerSlot,
      ethers.ZeroHash
    ]);

    await expect(
      wishingWell.initialize(
        await brush.getAddress(),
        await playerNFT.getAddress(),
        await shop.getAddress(),
        await randomnessBeacon.getAddress(),
        await clans.getAddress(),
        parseEther("5"),
        parseEther("1000"),
        parseEther("250")
      )
    )
      .to.emit(wishingWell, "ClanDonationThreshold")
      .withArgs(parseEther("250"), EstforConstants.CLAN_BOOSTER);
  });

  it("Claim lottery winnings", async function () {
    const {wishingWell, players, alice, randomnessBeacon, mockVRF, playerId, raffleEntryCost} = await loadFixture(
      deployContracts
    );

    let lotteryId = await wishingWell.getLastLotteryId();
    expect(lotteryId).to.eq(1);

    await players.connect(alice).donate(playerId, raffleEntryCost);

    await ethers.provider.send("evm_increaseTime", [24 * 3600]);
    await ethers.provider.send("evm_mine", []);
    await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);

    expect(await wishingWell.hasPlayerEntered(lotteryId, playerId)).to.be.true;

    // Should be unclaimed
    expect(await wishingWell.hasClaimedReward(lotteryId)).to.eq(false);

    // Check the winning structure is correct
    const winnerInfo = await wishingWell.getWinner(lotteryId);
    expect(winnerInfo.lotteryId).to.eq(lotteryId);
    expect(winnerInfo.raffleId).to.eq(1);
    expect(winnerInfo.itemTokenId).to.eq(EstforConstants.LUCKY_POTION);
    expect(winnerInfo.amount).to.eq(1);
    expect(winnerInfo.instantConsume).to.be.true;
    expect(winnerInfo.playerId).to.eq(playerId);

    // Now claim it
    await expect(players.connect(alice).processActions(playerId))
      .to.emit(wishingWell, "ClaimedLotteryWinnings")
      .withArgs(lotteryId, 1, EstforConstants.LUCKY_POTION, 1);
    expect(await wishingWell.hasClaimedReward(lotteryId)).to.eq(true);
    lotteryId = await wishingWell.getLastLotteryId();
    expect(lotteryId).to.eq(2);

    // Cannot claim again
    await expect(players.connect(alice).processActions(playerId)).to.not.emit(wishingWell, "ClaimedLotteryWinnings");
  });

  it("Minimum of 1 BRUSH can be donated", async function () {
    const {wishingWell, players, alice, playerId} = await loadFixture(deployContracts);

    let lotteryId = await wishingWell.getLastLotteryId();
    expect(lotteryId).to.eq(1);
    await expect(players.connect(alice).donate(playerId, parseEther("0.1"))).to.revertedWithCustomError(
      wishingWell,
      "MinimumOneBrush"
    );
  });

  it("Decimals of brush do not count", async function () {
    const {wishingWell, players, alice, playerId, clans, brush} = await loadFixture(deployContracts);

    const beforeBalance = await brush.balanceOf(alice);

    const clanId = 1;
    await clans.addTiers([
      {
        id: clanId,
        maxMemberCapacity: 3,
        maxBankCapacity: 3,
        maxImageId: 16,
        price: 0,
        minimumAge: 0
      }
    ]);

    let tierId = 1;
    const imageId = 1;
    await clans.connect(alice).createClan(playerId, "Clan name", "discord", "telegram", "twitter", imageId, tierId);

    let lotteryId = await wishingWell.getLastLotteryId();
    expect(lotteryId).to.eq(1);
    const clanXP = 0;
    await expect(players.connect(alice).donate(playerId, parseEther("1.1")))
      .to.emit(wishingWell, "Donate")
      .withArgs(alice.address, playerId, parseEther("1"), 0, 0)
      .and.to.emit(wishingWell, "DonateToClan")
      .withArgs(alice.address, playerId, parseEther("1"), clanId, clanXP);

    // But it takes 1.1 brush from you
    expect(await brush.balanceOf(alice)).to.eq(beforeBalance - parseEther("1.1"));

    expect(await wishingWell.getTotalDonated()).to.eq(parseEther("1"));
    expect(await wishingWell.getClanTotalDonated(clanId)).to.eq(parseEther("1"));

    await expect(players.connect(alice).donate(playerId, parseEther("1.99")))
      .to.emit(wishingWell, "Donate")
      .withArgs(alice.address, playerId, parseEther("1"), 0, 0)
      .and.to.emit(wishingWell, "DonateToClan")
      .withArgs(alice.address, playerId, parseEther("1"), clanId, clanXP);

    expect(await wishingWell.getTotalDonated()).to.eq(parseEther("2"));
    expect(await wishingWell.getClanTotalDonated(clanId)).to.eq(parseEther("2"));
  });

  it("Reach minimum to get a ticket", async function () {
    const {wishingWell, players, alice, playerId, raffleEntryCost} = await loadFixture(deployContracts);

    let lotteryId = await wishingWell.getLastLotteryId();
    expect(lotteryId).to.eq(1);
    await expect(players.connect(alice).donate(playerId, parseEther("1")))
      .to.emit(wishingWell, "Donate")
      .withArgs(alice.address, playerId, parseEther("1"), 0, 0);
    expect(await wishingWell.hasPlayerEntered(lotteryId, playerId)).to.be.false;

    await players.connect(alice).donate(playerId, raffleEntryCost - 1n);
    expect(await wishingWell.hasPlayerEntered(lotteryId, playerId)).to.be.false;

    // Now check that minimum works
    const raffleId = 1;
    await expect(players.connect(alice).donate(playerId, raffleEntryCost))
      .to.emit(wishingWell, "Donate")
      .withArgs(alice.address, playerId, raffleEntryCost, lotteryId, raffleId);
    expect(await wishingWell.hasPlayerEntered(lotteryId, playerId)).to.be.true;
  });

  it("Cannot donate until the previous day oracle is called", async function () {
    const {wishingWell, players, alice, randomnessBeacon, mockVRF, playerId, raffleEntryCost} = await loadFixture(
      deployContracts
    );

    await ethers.provider.send("evm_increaseTime", [24 * 3600]);
    await ethers.provider.send("evm_mine", []);
    await expect(players.connect(alice).donate(playerId, raffleEntryCost));
    await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);
    await ethers.provider.send("evm_increaseTime", [24 * 3600]);
    await ethers.provider.send("evm_mine", []);

    let lotteryId = await wishingWell.getLastLotteryId();
    expect(lotteryId).to.eq(2);
    await expect(players.connect(alice).donate(playerId, raffleEntryCost)).to.be.revertedWithCustomError(
      wishingWell,
      "OracleNotCalledYet"
    );
    await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);
    await expect(players.connect(alice).donate(playerId, raffleEntryCost)).to.not.be.reverted;
  });

  it("Cannot donate to a raffle with playerId more than once a day", async function () {
    const {wishingWell, players, alice, playerId, raffleEntryCost} = await loadFixture(deployContracts);

    let lotteryId = await wishingWell.getLastLotteryId();
    await expect(players.connect(alice).donate(playerId, raffleEntryCost))
      .to.emit(wishingWell, "Donate")
      .withArgs(alice.address, playerId, raffleEntryCost, 1, 1);
    expect(await wishingWell.hasPlayerEntered(lotteryId, playerId)).to.be.true;
    // Donating again will not enter raffle twice
    await expect(players.connect(alice).donate(playerId, raffleEntryCost))
      .to.emit(wishingWell, "Donate")
      .withArgs(alice.address, playerId, raffleEntryCost, 0, 0);
  });

  it("Check global threshold rewards", async function () {
    const {wishingWell, players, alice, playerId} = await loadFixture(deployContracts);

    const nextThreshold = await wishingWell.getNextGlobalThreshold();
    expect(nextThreshold).to.be.gt(0);

    await players.connect(alice).donate(0, nextThreshold - parseEther("2"));
    await expect(players.connect(alice).donate(playerId, parseEther("1"))).to.not.emit(
      wishingWell,
      "LastGlobalDonationThreshold"
    );

    await expect(players.connect(alice).donate(0, parseEther("1").toString()))
      .to.emit(wishingWell, "LastGlobalDonationThreshold")
      .withArgs(parseEther("1000"), EstforConstants.PRAY_TO_THE_BEARDIE_2)
      .and.to.emit(players, "ConsumeGlobalBoostVial");

    expect(await wishingWell.getNextGlobalThreshold()).to.eq(parseEther("2000"));

    await expect(players.connect(alice).donate(0, parseEther("1500")))
      .to.emit(wishingWell, "LastGlobalDonationThreshold")
      .withArgs(parseEther("2000"), EstforConstants.PRAY_TO_THE_BEARDIE_3)
      .and.to.emit(players, "ConsumeGlobalBoostVial");

    // Donated 500 above the old threshold, should be
    expect(await wishingWell.getNextGlobalThreshold()).to.eq(parseEther("3000"));

    // Should go back to the start
    await expect(players.connect(alice).donate(0, parseEther("499"))).to.not.emit(
      wishingWell,
      "LastGlobalDonationThreshold"
    );
    await expect(players.connect(alice).donate(0, parseEther("1")))
      .to.emit(wishingWell, "LastGlobalDonationThreshold")
      .withArgs(parseEther("3000"), EstforConstants.PRAY_TO_THE_BEARDIE)
      .and.to.emit(players, "ConsumeGlobalBoostVial");

    // Go over multiple increments
    await expect(players.connect(alice).donate(0, parseEther("3500")))
      .to.emit(wishingWell, "LastGlobalDonationThreshold")
      .withArgs(parseEther("6000"), EstforConstants.PRAY_TO_THE_BEARDIE_2)
      .and.to.emit(players, "ConsumeGlobalBoostVial");

    expect(await wishingWell.getTotalDonated()).to.eq(parseEther("6500"));
    expect(await wishingWell.getNextGlobalThreshold()).to.eq(parseEther("7000"));
  });

  it("Check clan boost rotation", async function () {
    const {wishingWell, players, alice, playerId, raffleEntryCost, brush, clans, bob, totalBrush} = await loadFixture(
      deployContracts
    );

    // Be a member of a clan
    const clanId = 1;
    await clans.addTiers([
      {
        id: clanId,
        maxMemberCapacity: 3,
        maxBankCapacity: 3,
        maxImageId: 16,
        price: 0,
        minimumAge: 0
      }
    ]);

    let tierId = 1;
    const imageId = 1;
    await clans.connect(alice).createClan(playerId, "Clan name", "discord", "telegram", "twitter", imageId, tierId);

    await brush.mint(bob.address, totalBrush);
    await brush.connect(bob).approve(wishingWell, totalBrush);

    await wishingWell.setClanDonationThresholdIncrement(raffleEntryCost);

    const clanXP = 1;
    await expect(players.connect(alice).donate(playerId, raffleEntryCost))
      .to.emit(wishingWell, "LastClanDonationThreshold")
      .withArgs(clanId, raffleEntryCost, EstforConstants.CLAN_BOOSTER_2)
      .and.to.emit(players, "ConsumeClanBoostVial")
      .and.to.emit(wishingWell, "DonateToClan")
      .withArgs(alice.address, playerId, raffleEntryCost, clanId, clanXP);

    expect((await players.getActiveBoost(playerId)).extraItemTokenId).to.eq(EstforConstants.LUCK_OF_THE_DRAW);
    expect((await (await getPlayersHelper(players)).getClanBoost(clanId)).itemTokenId).to.eq(
      EstforConstants.CLAN_BOOSTER
    );

    await expect(players.connect(alice).donate(playerId, raffleEntryCost))
      .to.emit(wishingWell, "LastClanDonationThreshold")
      .withArgs(clanId, raffleEntryCost * 2n, EstforConstants.CLAN_BOOSTER_3)
      .and.to.emit(players, "ConsumeClanBoostVial");

    expect((await players.getActiveBoost(playerId)).extraItemTokenId).to.eq(EstforConstants.LUCK_OF_THE_DRAW);
    expect((await (await getPlayersHelper(players)).getClanBoost(clanId)).itemTokenId).to.eq(
      EstforConstants.CLAN_BOOSTER_2
    );

    await expect(players.connect(alice).donate(playerId, raffleEntryCost))
      .to.emit(wishingWell, "LastClanDonationThreshold")
      .withArgs(clanId, raffleEntryCost * 3n, EstforConstants.CLAN_BOOSTER)
      .and.to.emit(players, "ConsumeClanBoostVial");

    expect((await players.getActiveBoost(playerId)).extraItemTokenId).to.eq(EstforConstants.LUCK_OF_THE_DRAW);
    expect((await (await getPlayersHelper(players)).getClanBoost(clanId)).itemTokenId).to.eq(
      EstforConstants.CLAN_BOOSTER_3
    );

    await expect(players.connect(alice).donate(playerId, raffleEntryCost * 7n + parseEther("1")))
      .to.emit(wishingWell, "LastClanDonationThreshold")
      .withArgs(clanId, raffleEntryCost * 10n, EstforConstants.CLAN_BOOSTER_2)
      .and.to.emit(players, "ConsumeClanBoostVial");

    expect((await (await getPlayersHelper(players)).getClanBoost(clanId)).itemTokenId).to.eq(
      EstforConstants.CLAN_BOOSTER
    );

    expect(parseEther((await wishingWell.getClanDonationInfo(clanId)).totalDonated.toString())).to.eq(
      raffleEntryCost * 10n + parseEther("1")
    );

    expect(await wishingWell.getNextClanThreshold(clanId)).to.eq(raffleEntryCost * 11n);
  });

  it("Check claiming previous claims works up to 2 other lotteries ago", async function () {
    const {
      wishingWell,
      players,
      alice,
      playerId,
      playerNFT,
      avatarId,
      brush,
      totalBrush,
      mockVRF,
      randomnessBeacon,
      owner,
      raffleEntryCost
    } = await loadFixture(deployContracts);

    await players.connect(alice).donate(playerId, raffleEntryCost);
    let lotteryId = await wishingWell.getLastLotteryId();
    expect(lotteryId).to.eq(1);

    await brush.mint(owner.address, totalBrush);
    await brush.approve(wishingWell, totalBrush);
    for (let i = 0; i < 2; ++i) {
      await timeTravel24Hours();
      await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);
      const newPlayerId = await createPlayer(playerNFT, avatarId, owner, "my name ser" + i, false);
      await players.donate(newPlayerId, raffleEntryCost);
    }

    // Should no longer be claimable
    await timeTravel24Hours();
    await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);

    expect(await wishingWell.hasClaimedReward(lotteryId)).to.eq(false);

    await players.connect(alice).processActions(playerId);
    expect(await wishingWell.hasClaimedReward(lotteryId)).to.eq(false); // Still unclaimed

    // Now do the same but only with 1 more winner which should leave this one claimable
    await players.connect(alice).donate(playerId, raffleEntryCost);
    lotteryId = await wishingWell.getLastLotteryId();
    for (let i = 0; i < 1; ++i) {
      await timeTravel24Hours();
      await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);
      const newPlayerId = await createPlayer(playerNFT, avatarId, owner, "should work now" + i, false);
      await players.donate(newPlayerId, raffleEntryCost);
    }
    await timeTravel24Hours();
    await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);

    expect(await wishingWell.hasClaimedReward(lotteryId)).to.eq(false);
    await players.connect(alice).processActions(playerId);
    expect(await wishingWell.hasClaimedReward(lotteryId)).to.eq(true);
    // Check elements are removed at the end as expected
    expect(await wishingWell.getLastUnclaimedWinner(2)).to.eq(0);

    // Do a claim in-between, check getLastUnclaimedWinner array is updated as expected
    await players.connect(alice).donate(playerId, raffleEntryCost);
    lotteryId = await wishingWell.getLastLotteryId();

    await timeTravel24Hours();
    await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);
    expect(await wishingWell.getLastUnclaimedWinner(2)).to.eq(playerId);
    expect(await wishingWell.getLastUnclaimedWinner(3)).to.eq(lotteryId);
    const newPlayerId = await createPlayer(playerNFT, avatarId, owner, "cheesy", true);
    await players.donate(newPlayerId, raffleEntryCost);
    await timeTravel24Hours();
    await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);
    expect(await wishingWell.getLastUnclaimedWinner(0)).to.eq(playerId);
    expect(await wishingWell.getLastUnclaimedWinner(1)).to.eq(lotteryId);

    await players.connect(alice).processActions(playerId); // claim the rewards

    expect(await wishingWell.getLastUnclaimedWinner(0)).to.eq(newPlayerId);
    expect(await wishingWell.getLastUnclaimedWinner(1)).to.eq(lotteryId + 1n);

    expect(await wishingWell.getLastUnclaimedWinner(2)).to.eq(0);
    expect(await wishingWell.getLastUnclaimedWinner(3)).to.eq(0);
  });

  it("Multiple unclaimed wins should be claimed after each other", async function () {
    const {
      wishingWell,
      players,
      alice,
      playerId,
      brush,
      totalBrush,
      mockVRF,
      randomnessBeacon,
      owner,
      raffleEntryCost
    } = await loadFixture(deployContracts);

    await players.connect(alice).donate(playerId, raffleEntryCost);
    let lotteryId = await wishingWell.getLastLotteryId();
    expect(lotteryId).to.eq(1);

    await brush.mint(owner.address, totalBrush);
    await brush.approve(wishingWell, totalBrush);
    for (let i = 0; i < 1; ++i) {
      await timeTravel24Hours();
      await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);
      await players.connect(alice).donate(playerId, raffleEntryCost);
    }
    await timeTravel24Hours();
    await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);

    expect(await wishingWell.getLastUnclaimedWinner(0)).to.eq(playerId);
    expect(await wishingWell.getLastUnclaimedWinner(1)).to.eq(lotteryId);
    expect(await wishingWell.getLastUnclaimedWinner(2)).to.eq(playerId);
    expect(await wishingWell.getLastUnclaimedWinner(3)).to.eq(lotteryId + 1n);

    await players.connect(alice).processActions(playerId);
    expect(await wishingWell.hasClaimedReward(lotteryId)).to.be.true;
    expect(await wishingWell.getLastUnclaimedWinner(0)).to.eq(playerId);
    expect(await wishingWell.getLastUnclaimedWinner(1)).to.eq(lotteryId + 1n);
    expect(await wishingWell.getLastUnclaimedWinner(2)).to.eq(0);
    expect(await wishingWell.getLastUnclaimedWinner(3)).to.eq(0);

    await players.connect(alice).processActions(playerId);
    expect(await wishingWell.hasClaimedReward(lotteryId + 1n)).to.be.true;
    expect(await wishingWell.getLastUnclaimedWinner(0)).to.eq(0);
    expect(await wishingWell.getLastUnclaimedWinner(1)).to.eq(0);
    expect(await wishingWell.getLastUnclaimedWinner(2)).to.eq(0);
    expect(await wishingWell.getLastUnclaimedWinner(3)).to.eq(0);
    expect(await wishingWell.getLastUnclaimedWinner(3)).to.eq(0);
  });

  it("Get extra XP boost as part of queueing a donation", async function () {
    const {players, alice, playerId, itemNFT, worldActions, raffleEntryCost} = await loadFixture(deployContracts);

    const {queuedAction} = await setupBasicWoodcutting(itemNFT, worldActions);

    await players.connect(alice).startActionsAdvanced(
      playerId,
      [queuedAction],
      EstforConstants.NONE,
      BOOST_START_NOW,
      0,
      raffleEntryCost, // donation
      EstforTypes.ActionQueueStrategy.OVERWRITE
    );

    // Should have the implicit boost
    const activeBoost = await players.getActiveBoost(playerId);
    expect(activeBoost.extraBoostType).to.eq(EstforTypes.BoostType.ANY_XP);
    expect(activeBoost.extraValue).to.eq(5);
  });

  it("Get extra XP boost as part of queueing a wishingWell, do not override lottery winnings", async function () {
    const {players, alice, playerId, itemNFT, worldActions, randomnessBeacon, raffleEntryCost, mockVRF, wishingWell} =
      await loadFixture(deployContracts);

    const {queuedAction} = await setupBasicWoodcutting(itemNFT, worldActions);

    let lotteryId = await wishingWell.getLastLotteryId();
    expect(lotteryId).to.eq(1);

    await players.connect(alice).donate(playerId, raffleEntryCost);

    await ethers.provider.send("evm_increaseTime", [24 * 3600]);
    await ethers.provider.send("evm_mine", []);
    await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);

    const winnerInfo = await wishingWell.getWinner(lotteryId);
    expect(winnerInfo.lotteryId).to.eq(lotteryId);

    // Now claim it while queueing another donation
    await expect(
      players.connect(alice).startActionsAdvanced(
        playerId,
        [queuedAction],
        EstforConstants.NONE,
        BOOST_START_NOW,
        0,
        raffleEntryCost, // donation
        EstforTypes.ActionQueueStrategy.OVERWRITE
      )
    )
      .to.emit(wishingWell, "ClaimedLotteryWinnings")
      .withArgs(lotteryId, 1, EstforConstants.LUCKY_POTION, 1);

    expect(await wishingWell.hasClaimedReward(lotteryId)).to.eq(true);
    lotteryId = await wishingWell.getLastLotteryId();
    expect(lotteryId).to.eq(2);

    // Should have the lucky boost not luck of the draw boost
    const activeBoost = await players.getActiveBoost(playerId);
    expect(activeBoost.extraItemTokenId).to.eq(EstforConstants.LUCKY_POTION);
  });

  it("Check full amount is added to the clans total donations", async function () {
    const {wishingWell, players, alice, playerId, raffleEntryCost, clans} = await loadFixture(deployContracts);

    const clanId = 1;
    await clans.addTiers([
      {
        id: clanId,
        maxMemberCapacity: 3,
        maxBankCapacity: 3,
        maxImageId: 16,
        price: 0,
        minimumAge: 0
      }
    ]);

    let tierId = 1;
    const imageId = 1;
    await clans.connect(alice).createClan(playerId, "Clan name", "discord", "telegram", "twitter", imageId, tierId);
    await players.connect(alice).donate(playerId, raffleEntryCost * 2n);
    expect(parseEther((await wishingWell.getClanDonationInfo(clanId)).totalDonated.toString())).to.eq(
      raffleEntryCost * 2n
    );
  });

  it("setGlobalDonationThresholdIncrement()", async function () {
    const {wishingWell, players, alice, playerId, raffleEntryCost} = await loadFixture(deployContracts);

    await players.connect(alice).donate(playerId, raffleEntryCost * 2n);
    await wishingWell.setGlobalDonationThresholdIncrement(raffleEntryCost * 3n);
    expect(await wishingWell.getNextGlobalThreshold()).to.eq(raffleEntryCost * 3n);
    await players.connect(alice).donate(playerId, raffleEntryCost); // Hit it
    await wishingWell.setGlobalDonationThresholdIncrement(raffleEntryCost * 2n);
    expect(await wishingWell.getNextGlobalThreshold()).to.eq(raffleEntryCost * 5n);
  });
});
