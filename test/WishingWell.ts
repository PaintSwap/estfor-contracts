import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {expect} from "chai";
import {ethers} from "hardhat";
import {playersFixture} from "./Players/PlayersFixture";
import {requestAndFulfillRandomWords} from "./utils";
import {EstforConstants, EstforTypes} from "@paintswap/estfor-definitions";
import {createPlayer} from "../scripts/utils";
import {setupBasicWoodcutting} from "./Players/utils";

describe("WishingWell", function () {
  async function deployContracts() {
    const baseFixture = await loadFixture(playersFixture);

    const {alice, wishingWell, brush, itemNFT, world, mockVRF} = baseFixture;

    // Make sure it passes the next checkpoint so there are no issues running
    const {timestamp} = await ethers.provider.getBlock("latest");
    const nextCheckpoint = Math.floor(timestamp / 86400) * 86400 + 86400;
    const durationToNextCheckpoint = nextCheckpoint - timestamp + 1;
    await ethers.provider.send("evm_increaseTime", [durationToNextCheckpoint]);
    await requestAndFulfillRandomWords(world, mockVRF);

    const totalBrush = ethers.utils.parseEther("100000");
    await brush.mint(alice.address, totalBrush);
    await brush.connect(alice).approve(wishingWell.address, totalBrush);

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
        isTransferable: false,
      },
      {
        ...EstforTypes.defaultItemInput,
        tokenId: EstforConstants.LUCK_OF_THE_DRAW,
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
        tokenId: EstforConstants.PRAY_TO_THE_BEARDIE_2,
        equipPosition: EstforTypes.EquipPosition.GLOBAL_BOOST_VIAL,
        // Boost
        boostType: EstforTypes.BoostType.COMBAT_XP,
        boostValue: 10,
        boostDuration,
        isTransferable: false,
      },
      {
        ...EstforTypes.defaultItemInput,
        tokenId: EstforConstants.PRAY_TO_THE_BEARDIE_3,
        equipPosition: EstforTypes.EquipPosition.GLOBAL_BOOST_VIAL,
        // Boost
        boostType: EstforTypes.BoostType.NON_COMBAT_XP,
        boostValue: 10,
        boostDuration,
        isTransferable: false,
      },
      {
        ...EstforTypes.defaultItemInput,
        tokenId: EstforConstants.CLAN_BOOSTER,
        equipPosition: EstforTypes.EquipPosition.CLAN_BOOST_VIAL,
        // Boost
        boostType: EstforTypes.BoostType.ANY_XP,
        boostValue: 10,
        boostDuration,
        isTransferable: false,
      },
      {
        ...EstforTypes.defaultItemInput,
        tokenId: EstforConstants.CLAN_BOOSTER_2,
        equipPosition: EstforTypes.EquipPosition.CLAN_BOOST_VIAL,
        // Boost
        boostType: EstforTypes.BoostType.COMBAT_XP,
        boostValue: 10,
        boostDuration,
        isTransferable: false,
      },
      {
        ...EstforTypes.defaultItemInput,
        tokenId: EstforConstants.CLAN_BOOSTER_3,
        equipPosition: EstforTypes.EquipPosition.CLAN_BOOST_VIAL,
        // Boost
        boostType: EstforTypes.BoostType.NON_COMBAT_XP,
        boostValue: 10,
        boostDuration,
        isTransferable: false,
      },
    ]);

    const raffleEntryCost = await wishingWell.getRaffleEntryCost();

    return {...baseFixture, totalBrush, raffleEntryCost};
  }

  it("Only Players contract can call donate", async function () {
    const {wishingWell, alice} = await loadFixture(deployContracts);
    await expect(wishingWell.connect(alice).donate(alice.address, 0, 100)).to.be.revertedWithCustomError(
      wishingWell,
      "NotPlayers"
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
    const {wishingWell, players, alice, world, mockVRF, playerId, raffleEntryCost} = await loadFixture(deployContracts);

    let lotteryId = await wishingWell.lastLotteryId();
    expect(lotteryId).to.eq(1);

    await players.connect(alice).donate(playerId, raffleEntryCost);

    await ethers.provider.send("evm_increaseTime", [24 * 3600]);
    await requestAndFulfillRandomWords(world, mockVRF);

    expect(await wishingWell.hasPlayerEntered(lotteryId, playerId)).to.be.true;

    // Should be unclaimed
    expect(await wishingWell.hasClaimedReward(lotteryId)).to.eq(false);

    // Check the winning structure is correct
    const winnerInfo = await wishingWell.winners(lotteryId);
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
    lotteryId = await wishingWell.lastLotteryId();
    expect(lotteryId).to.eq(2);

    // Cannot claim again
    await expect(players.connect(alice).processActions(playerId)).to.not.emit(wishingWell, "ClaimedLotteryWinnings");
  });

  it("Minimum of 1 BRUSH can be donated", async function () {
    const {wishingWell, players, alice, playerId} = await loadFixture(deployContracts);

    let lotteryId = await wishingWell.lastLotteryId();
    expect(lotteryId).to.eq(1);
    await expect(players.connect(alice).donate(playerId, ethers.utils.parseEther("0.1"))).to.revertedWithCustomError(
      wishingWell,
      "MinimumOneBrush"
    );
  });

  it("Decimals of brush do not count", async function () {
    const {wishingWell, players, alice, playerId, clans, brush} = await loadFixture(deployContracts);

    const beforeBalance = await brush.balanceOf(alice.address);

    const clanId = 1;
    await clans.addTiers([
      {
        id: clanId,
        maxMemberCapacity: 3,
        maxBankCapacity: 3,
        maxImageId: 16,
        price: 0,
        minimumAge: 0,
      },
    ]);

    let tierId = 1;
    const imageId = 1;
    await clans.connect(alice).createClan(playerId, "Clan name", "discord", "telegram", "twitter", imageId, tierId);

    let lotteryId = await wishingWell.lastLotteryId();
    expect(lotteryId).to.eq(1);
    await expect(players.connect(alice).donate(playerId, ethers.utils.parseEther("1.1")))
      .to.emit(wishingWell, "Donate")
      .withArgs(alice.address, playerId, ethers.utils.parseEther("1"), 0, 0)
      .and.to.emit(wishingWell, "DonateToClan")
      .withArgs(alice.address, playerId, ethers.utils.parseEther("1"), clanId);

    // But it takes 1.1 brush from you
    expect(await brush.balanceOf(alice.address)).to.eq(beforeBalance.sub(ethers.utils.parseEther("1.1")));

    expect(await wishingWell.getTotalDonated()).to.eq(ethers.utils.parseEther("1"));
    expect(await wishingWell.getClanTotalDonated(clanId)).to.eq(ethers.utils.parseEther("1"));

    await expect(players.connect(alice).donate(playerId, ethers.utils.parseEther("1.99")))
      .to.emit(wishingWell, "Donate")
      .withArgs(alice.address, playerId, ethers.utils.parseEther("1"), 0, 0)
      .and.to.emit(wishingWell, "DonateToClan")
      .withArgs(alice.address, playerId, ethers.utils.parseEther("1"), clanId);

    expect(await wishingWell.getTotalDonated()).to.eq(ethers.utils.parseEther("2"));
    expect(await wishingWell.getClanTotalDonated(clanId)).to.eq(ethers.utils.parseEther("2"));
  });

  it("Reach minimum to get a ticket", async function () {
    const {wishingWell, players, alice, playerId, raffleEntryCost} = await loadFixture(deployContracts);

    let lotteryId = await wishingWell.lastLotteryId();
    expect(lotteryId).to.eq(1);
    await expect(players.connect(alice).donate(playerId, ethers.utils.parseEther("1")))
      .to.emit(wishingWell, "Donate")
      .withArgs(alice.address, playerId, ethers.utils.parseEther("1"), 0, 0);
    expect(await wishingWell.hasPlayerEntered(lotteryId, playerId)).to.be.false;

    await players.connect(alice).donate(playerId, raffleEntryCost.sub(1));
    expect(await wishingWell.hasPlayerEntered(lotteryId, playerId)).to.be.false;

    // Now check that minimum works
    const raffleId = 1;
    await expect(players.connect(alice).donate(playerId, raffleEntryCost))
      .to.emit(wishingWell, "Donate")
      .withArgs(alice.address, playerId, raffleEntryCost, lotteryId, raffleId);
    expect(await wishingWell.hasPlayerEntered(lotteryId, playerId)).to.be.true;
  });

  it("Cannot donate until the previous day oracle is called", async function () {
    const {wishingWell, players, alice, world, mockVRF, playerId, raffleEntryCost} = await loadFixture(deployContracts);

    await ethers.provider.send("evm_increaseTime", [24 * 3600]);
    await expect(players.connect(alice).donate(playerId, raffleEntryCost));
    await requestAndFulfillRandomWords(world, mockVRF);
    await ethers.provider.send("evm_increaseTime", [24 * 3600]);

    let lotteryId = await wishingWell.lastLotteryId();
    expect(lotteryId).to.eq(2);
    await expect(players.connect(alice).donate(playerId, raffleEntryCost)).to.be.revertedWithCustomError(
      wishingWell,
      "OracleNotCalledYet"
    );
    await requestAndFulfillRandomWords(world, mockVRF);
    await expect(players.connect(alice).donate(playerId, raffleEntryCost)).to.not.be.reverted;
  });

  it("Cannot donate to a raffle with playerId more than once a day", async function () {
    const {wishingWell, players, alice, playerId, raffleEntryCost} = await loadFixture(deployContracts);

    let lotteryId = await wishingWell.lastLotteryId();
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

    await players.connect(alice).donate(0, nextThreshold.sub(ethers.utils.parseEther("2")));
    await expect(players.connect(alice).donate(playerId, ethers.utils.parseEther("1"))).to.not.emit(
      wishingWell,
      "LastGlobalDonationThreshold"
    );

    await expect(players.connect(alice).donate(0, ethers.utils.parseEther("1").toString()))
      .to.emit(wishingWell, "LastGlobalDonationThreshold")
      .withArgs(ethers.utils.parseEther("1000"), EstforConstants.PRAY_TO_THE_BEARDIE_2)
      .and.to.emit(players, "ConsumeGlobalBoostVial");

    expect(await wishingWell.getNextGlobalThreshold()).to.eq(ethers.utils.parseEther("2000"));

    await expect(players.connect(alice).donate(0, ethers.utils.parseEther("1500")))
      .to.emit(wishingWell, "LastGlobalDonationThreshold")
      .withArgs(ethers.utils.parseEther("2000"), EstforConstants.PRAY_TO_THE_BEARDIE_3)
      .and.to.emit(players, "ConsumeGlobalBoostVial");

    // Donated 500 above the old threshold, should be
    expect(await wishingWell.getNextGlobalThreshold()).to.eq(ethers.utils.parseEther("3000"));

    // Should go back to the start
    await expect(players.connect(alice).donate(0, ethers.utils.parseEther("499"))).to.not.emit(
      wishingWell,
      "LastGlobalDonationThreshold"
    );
    await expect(players.connect(alice).donate(0, ethers.utils.parseEther("1")))
      .to.emit(wishingWell, "LastGlobalDonationThreshold")
      .withArgs(ethers.utils.parseEther("3000"), EstforConstants.PRAY_TO_THE_BEARDIE)
      .and.to.emit(players, "ConsumeGlobalBoostVial");

    // Go over multiple increments
    await expect(players.connect(alice).donate(0, ethers.utils.parseEther("3500")))
      .to.emit(wishingWell, "LastGlobalDonationThreshold")
      .withArgs(ethers.utils.parseEther("6000"), EstforConstants.PRAY_TO_THE_BEARDIE_2)
      .and.to.emit(players, "ConsumeGlobalBoostVial");

    expect(await wishingWell.getTotalDonated()).to.eq(ethers.utils.parseEther("6500"));
    expect(await wishingWell.getNextGlobalThreshold()).to.eq(ethers.utils.parseEther("7000"));
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
        minimumAge: 0,
      },
    ]);

    let tierId = 1;
    const imageId = 1;
    await clans.connect(alice).createClan(playerId, "Clan name", "discord", "telegram", "twitter", imageId, tierId);

    await brush.mint(bob.address, totalBrush);
    await brush.connect(bob).approve(wishingWell.address, totalBrush);

    await wishingWell.setClanDonationThresholdIncrement(raffleEntryCost);

    await expect(players.connect(alice).donate(playerId, raffleEntryCost))
      .to.emit(wishingWell, "LastClanDonationThreshold")
      .withArgs(clanId, raffleEntryCost, EstforConstants.CLAN_BOOSTER_2)
      .and.to.emit(players, "ConsumeClanBoostVial")
      .and.to.emit(wishingWell, "DonateToClan")
      .withArgs(alice.address, playerId, raffleEntryCost, clanId);

    expect((await players.activeBoost(playerId)).extraOrLastItemTokenId).to.eq(EstforConstants.LUCK_OF_THE_DRAW);
    expect((await players.clanBoost(clanId)).itemTokenId).to.eq(EstforConstants.CLAN_BOOSTER);

    await expect(players.connect(alice).donate(playerId, raffleEntryCost))
      .to.emit(wishingWell, "LastClanDonationThreshold")
      .withArgs(clanId, raffleEntryCost.mul(2), EstforConstants.CLAN_BOOSTER_3)
      .and.to.emit(players, "ConsumeClanBoostVial");

    expect((await players.activeBoost(playerId)).extraOrLastItemTokenId).to.eq(EstforConstants.LUCK_OF_THE_DRAW);
    expect((await players.clanBoost(clanId)).itemTokenId).to.eq(EstforConstants.CLAN_BOOSTER_2);

    await expect(players.connect(alice).donate(playerId, raffleEntryCost))
      .to.emit(wishingWell, "LastClanDonationThreshold")
      .withArgs(clanId, raffleEntryCost.mul(3), EstforConstants.CLAN_BOOSTER)
      .and.to.emit(players, "ConsumeClanBoostVial");

    expect((await players.activeBoost(playerId)).extraOrLastItemTokenId).to.eq(EstforConstants.LUCK_OF_THE_DRAW);
    expect((await players.clanBoost(clanId)).itemTokenId).to.eq(EstforConstants.CLAN_BOOSTER_3);

    await expect(players.connect(alice).donate(playerId, raffleEntryCost.mul(7).add(ethers.utils.parseEther("1"))))
      .to.emit(wishingWell, "LastClanDonationThreshold")
      .withArgs(clanId, raffleEntryCost.mul(10), EstforConstants.CLAN_BOOSTER_2)
      .and.to.emit(players, "ConsumeClanBoostVial");

    expect((await players.clanBoost(clanId)).itemTokenId).to.eq(EstforConstants.CLAN_BOOSTER);

    expect(ethers.utils.parseEther((await wishingWell.clanDonationInfo(clanId)).totalDonated.toString())).to.eq(
      raffleEntryCost.mul(10).add(ethers.utils.parseEther("1"))
    );

    expect(await wishingWell.getNextClanThreshold(clanId)).to.eq(raffleEntryCost.mul(11));
  });

  it("Check claiming previous claims works up to 3 other lotteries ago", async function () {
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
      world,
      owner,
      raffleEntryCost,
    } = await loadFixture(deployContracts);

    await players.connect(alice).donate(playerId, raffleEntryCost);
    let lotteryId = await wishingWell.lastLotteryId();
    expect(lotteryId).to.eq(1);

    await brush.mint(owner.address, totalBrush);
    await brush.connect(owner).approve(wishingWell.address, totalBrush);
    for (let i = 0; i < 3; ++i) {
      await ethers.provider.send("evm_increaseTime", [24 * 3600]);
      await requestAndFulfillRandomWords(world, mockVRF);
      const newPlayerId = await createPlayer(playerNFT, avatarId, owner, "my name ser" + i, false);
      await players.connect(owner).donate(newPlayerId, raffleEntryCost);
    }

    // Should no longer be claimable
    await ethers.provider.send("evm_increaseTime", [24 * 3600]);
    await requestAndFulfillRandomWords(world, mockVRF);

    expect(await wishingWell.hasClaimedReward(lotteryId)).to.eq(false);

    await players.connect(alice).processActions(playerId);
    expect(await wishingWell.hasClaimedReward(lotteryId)).to.eq(false); // Still unclaimed

    // Now do the same but only with 2 more winners which should leave this one claimable
    await players.connect(alice).donate(playerId, raffleEntryCost);
    lotteryId = await wishingWell.lastLotteryId();
    for (let i = 0; i < 2; ++i) {
      await ethers.provider.send("evm_increaseTime", [24 * 3600]);
      await requestAndFulfillRandomWords(world, mockVRF);
      const newPlayerId = await createPlayer(playerNFT, avatarId, owner, "should work now" + i, false);
      await players.connect(owner).donate(newPlayerId, raffleEntryCost);
    }
    await ethers.provider.send("evm_increaseTime", [24 * 3600]);
    await requestAndFulfillRandomWords(world, mockVRF);

    expect(await wishingWell.hasClaimedReward(lotteryId)).to.eq(false);
    await players.connect(alice).processActions(playerId);
    expect(await wishingWell.hasClaimedReward(lotteryId)).to.eq(true);
    // Check elements are removed at the end as expected

    expect(await wishingWell.lastUnclaimedWinners(4));

    // Do a claim in-between, check lastUnclaimedWinners array is updated as expected
    await players.connect(alice).donate(playerId, raffleEntryCost);
    lotteryId = await wishingWell.lastLotteryId();

    await ethers.provider.send("evm_increaseTime", [24 * 3600]);
    await requestAndFulfillRandomWords(world, mockVRF);
    expect(await wishingWell.lastUnclaimedWinners(4)).to.eq(playerId);
    expect(await wishingWell.lastUnclaimedWinners(5)).to.eq(lotteryId);
    const newPlayerId = await createPlayer(playerNFT, avatarId, owner, "cheesy", true);
    await players.connect(owner).donate(newPlayerId, raffleEntryCost);
    await ethers.provider.send("evm_increaseTime", [24 * 3600]);
    await requestAndFulfillRandomWords(world, mockVRF);
    expect(await wishingWell.lastUnclaimedWinners(2)).to.eq(playerId);
    expect(await wishingWell.lastUnclaimedWinners(3)).to.eq(lotteryId);

    await players.connect(alice).processActions(playerId); // claim the rewards

    expect(await wishingWell.lastUnclaimedWinners(2)).to.eq(newPlayerId);
    expect(await wishingWell.lastUnclaimedWinners(3)).to.eq(lotteryId + 1);

    expect(await wishingWell.lastUnclaimedWinners(4)).to.eq(0);
    expect(await wishingWell.lastUnclaimedWinners(5)).to.eq(0);
  });

  it("Multiple unclaimed wins should be claimed after each other", async function () {
    const {wishingWell, players, alice, playerId, brush, totalBrush, mockVRF, world, owner, raffleEntryCost} =
      await loadFixture(deployContracts);

    await players.connect(alice).donate(playerId, raffleEntryCost);
    let lotteryId = await wishingWell.lastLotteryId();
    expect(lotteryId).to.eq(1);

    await brush.mint(owner.address, totalBrush);
    await brush.connect(owner).approve(wishingWell.address, totalBrush);
    for (let i = 0; i < 2; ++i) {
      await ethers.provider.send("evm_increaseTime", [24 * 3600]);
      await requestAndFulfillRandomWords(world, mockVRF);
      await players.connect(alice).donate(playerId, raffleEntryCost);
    }
    await ethers.provider.send("evm_increaseTime", [24 * 3600]);
    await requestAndFulfillRandomWords(world, mockVRF);

    expect(await wishingWell.lastUnclaimedWinners(0)).to.eq(playerId);
    expect(await wishingWell.lastUnclaimedWinners(1)).to.eq(lotteryId);
    expect(await wishingWell.lastUnclaimedWinners(2)).to.eq(playerId);
    expect(await wishingWell.lastUnclaimedWinners(3)).to.eq(lotteryId + 1);
    expect(await wishingWell.lastUnclaimedWinners(4)).to.eq(playerId);
    expect(await wishingWell.lastUnclaimedWinners(5)).to.eq(lotteryId + 2);

    await players.connect(alice).processActions(playerId);
    expect(await wishingWell.hasClaimedReward(lotteryId)).to.be.true;
    expect(await wishingWell.lastUnclaimedWinners(0)).to.eq(playerId);
    expect(await wishingWell.lastUnclaimedWinners(1)).to.eq(lotteryId + 1);
    expect(await wishingWell.lastUnclaimedWinners(2)).to.eq(playerId);
    expect(await wishingWell.lastUnclaimedWinners(3)).to.eq(lotteryId + 2);
    expect(await wishingWell.lastUnclaimedWinners(4)).to.eq(0);
    expect(await wishingWell.lastUnclaimedWinners(5)).to.eq(0);

    await players.connect(alice).processActions(playerId);
    expect(await wishingWell.hasClaimedReward(lotteryId + 1)).to.be.true;
    expect(await wishingWell.lastUnclaimedWinners(0)).to.eq(playerId);
    expect(await wishingWell.lastUnclaimedWinners(1)).to.eq(lotteryId + 2);
    expect(await wishingWell.lastUnclaimedWinners(2)).to.eq(0);
    expect(await wishingWell.lastUnclaimedWinners(3)).to.eq(0);
    expect(await wishingWell.lastUnclaimedWinners(4)).to.eq(0);
    expect(await wishingWell.lastUnclaimedWinners(5)).to.eq(0);

    await players.connect(alice).processActions(playerId);
    expect(await wishingWell.hasClaimedReward(lotteryId + 2)).to.be.true;
    expect(await wishingWell.lastUnclaimedWinners(0)).to.eq(0);
    expect(await wishingWell.lastUnclaimedWinners(1)).to.eq(0);
    expect(await wishingWell.lastUnclaimedWinners(2)).to.eq(0);
    expect(await wishingWell.lastUnclaimedWinners(3)).to.eq(0);
    expect(await wishingWell.lastUnclaimedWinners(4)).to.eq(0);
    expect(await wishingWell.lastUnclaimedWinners(5)).to.eq(0);
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
    expect(activeBoost.extraOrLastBoostType).to.eq(EstforTypes.BoostType.ANY_XP);
    expect(activeBoost.extraOrLastValue).to.eq(5);
  });

  it("Get extra XP boost as part of queueing a wishingWell, do not override lottery winnings", async function () {
    const {players, alice, playerId, itemNFT, world, raffleEntryCost, mockVRF, wishingWell} = await loadFixture(
      deployContracts
    );

    const {queuedAction} = await setupBasicWoodcutting(itemNFT, world);

    let lotteryId = await wishingWell.lastLotteryId();
    expect(lotteryId).to.eq(1);

    await players.connect(alice).donate(playerId, raffleEntryCost);

    await ethers.provider.send("evm_increaseTime", [24 * 3600]);
    await requestAndFulfillRandomWords(world, mockVRF);

    const winnerInfo = await wishingWell.winners(lotteryId);
    expect(winnerInfo.lotteryId).to.eq(lotteryId);

    // Now claim it while queueing another donation
    await expect(
      players.connect(alice).startActionsExtra(
        playerId,
        [queuedAction],
        EstforConstants.NONE,
        0,
        0,
        raffleEntryCost, // donation
        EstforTypes.ActionQueueStatus.NONE
      )
    )
      .to.emit(wishingWell, "ClaimedLotteryWinnings")
      .withArgs(lotteryId, 1, EstforConstants.LUCKY_POTION, 1);

    expect(await wishingWell.hasClaimedReward(lotteryId)).to.eq(true);
    lotteryId = await wishingWell.lastLotteryId();
    expect(lotteryId).to.eq(2);

    // Should have the lucky boost not luck of the draw boost
    const activeBoost = await players.activeBoost(playerId);
    expect(activeBoost.extraOrLastItemTokenId).to.eq(EstforConstants.LUCKY_POTION);
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
        minimumAge: 0,
      },
    ]);

    let tierId = 1;
    const imageId = 1;
    await clans.connect(alice).createClan(playerId, "Clan name", "discord", "telegram", "twitter", imageId, tierId);
    await players.connect(alice).donate(playerId, raffleEntryCost.mul(2));
    expect(ethers.utils.parseEther((await wishingWell.clanDonationInfo(clanId)).totalDonated.toString())).to.eq(
      raffleEntryCost.mul(2)
    );
  });

  it("setGlobalDonationThresholdIncrement()", async function () {
    const {wishingWell, players, alice, playerId, raffleEntryCost} = await loadFixture(deployContracts);

    await players.connect(alice).donate(playerId, raffleEntryCost.mul(2));
    await wishingWell.setGlobalDonationThresholdIncrement(raffleEntryCost.mul(3));
    expect(await wishingWell.getNextGlobalThreshold()).to.eq(raffleEntryCost.mul(3));
    await players.connect(alice).donate(playerId, raffleEntryCost); // Hit it
    await wishingWell.setGlobalDonationThresholdIncrement(raffleEntryCost.mul(2));
    expect(await wishingWell.getNextGlobalThreshold()).to.eq(raffleEntryCost.mul(5));
  });
});
