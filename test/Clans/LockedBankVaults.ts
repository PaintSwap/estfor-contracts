import {getStorageAt, loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {expect} from "chai";
import {clanFixture} from "./utils";
import {createPlayer} from "../../scripts/utils";
import {ClanRank, ItemInput} from "@paintswap/estfor-definitions/types";
import {ethers} from "hardhat";
import {LockedBankVaults, MockBrushToken, Territories} from "../../typechain-types";

import {fulfillRandomWords, timeTravel} from "../utils";
import {Block, ContractTransactionReceipt} from "ethers";
import {allBattleSkills} from "../../scripts/data/territories";
import {getXPFromLevel, makeSigner} from "../Players/utils";
import {allItems} from "../../scripts/data/items";
import {EstforConstants} from "@paintswap/estfor-definitions";
import {SignerWithAddress} from "@nomicfoundation/hardhat-ethers/signers";

describe("LockedBankVaults", function () {
  const lockFundsForClan = async (
    lockedBankVaults: LockedBankVaults,
    clanId: number,
    brush: MockBrushToken,
    alice: SignerWithAddress,
    playerId: bigint,
    amount: number,
    territories: Territories
  ) => {
    await brush.mint(territories, amount);
    const territoriesSigner = await makeSigner(territories);
    await lockedBankVaults.connect(territoriesSigner).lockFunds(clanId, alice, playerId, amount);
  };

  it("Lock funds", async () => {
    const {lockedBankVaults, clanId, playerId, alice, brush, territories} = await loadFixture(clanFixture);

    await brush.mint(territories, 1000);
    const territoriesSigner = await makeSigner(territories);
    await lockedBankVaults.connect(territoriesSigner).lockFunds(clanId, alice, playerId, 400);
    expect(await brush.balanceOf(territories)).to.eq(600);
    expect(await brush.balanceOf(lockedBankVaults)).to.eq(400);
    expect((await lockedBankVaults.getClanInfo(clanId)).totalBrushLocked).to.eq(400);
  });

  it("Only territories contract can lock funds", async () => {
    const {lockedBankVaults, clanId, playerId, alice, brush} = await loadFixture(clanFixture);

    await brush.mint(alice, 100);
    await brush.connect(alice).approve(lockedBankVaults, 100);
    await expect(lockedBankVaults.connect(alice).lockFunds(clanId, alice, playerId, 100)).to.be.revertedWithCustomError(
      lockedBankVaults,
      "OnlyTerritories"
    );
  });

  it("Cannot attack your own clan", async function () {
    const {lockedBankVaults, LockedBankVaultsLibrary, combatantsHelper, territories, clanId, playerId, brush, alice} =
      await loadFixture(clanFixture);

    await lockFundsForClan(lockedBankVaults, clanId, brush, alice, playerId, 400, territories);
    await combatantsHelper.connect(alice).assignCombatants(clanId, false, [], true, [playerId], playerId);

    await expect(
      lockedBankVaults
        .connect(alice)
        .attackVaults(clanId, clanId, 0, playerId, {value: await lockedBankVaults.getAttackCost()})
    ).to.be.revertedWithCustomError(LockedBankVaultsLibrary, "CannotAttackSelf");
  });

  it("Leaving clan removes you as a combatant", async function () {
    const {
      lockedBankVaults,
      combatantsHelper,
      territories,
      clanId,
      playerId,
      brush,
      owner,
      alice,
      playerNFT,
      avatarId,
      origName,
      clans
    } = await loadFixture(clanFixture);

    await lockFundsForClan(lockedBankVaults, clanId, brush, alice, playerId, 400, territories);

    const ownerPlayerId = await createPlayer(playerNFT, avatarId, owner, origName + 1, true);
    await clans.requestToJoin(clanId, ownerPlayerId, 0);
    await clans.connect(alice).acceptJoinRequests(clanId, [ownerPlayerId], playerId);

    await combatantsHelper
      .connect(alice)
      .assignCombatants(clanId, false, [], true, [playerId, ownerPlayerId], playerId);
    expect((await lockedBankVaults.getClanInfo(clanId)).playerIds).to.deep.eq([playerId, ownerPlayerId]);
    await clans.changeRank(clanId, ownerPlayerId, ClanRank.NONE, ownerPlayerId);
    expect((await lockedBankVaults.getClanInfo(clanId)).playerIds).to.deep.eq([playerId]);
  });

  it("Cannot only change combatants after the cooldown change deadline has passed", async function () {
    const {lockedBankVaultsLibrary, clanId, playerId, alice, combatantChangeCooldown, combatantsHelper} =
      await loadFixture(clanFixture);

    await combatantsHelper.connect(alice).assignCombatants(clanId, false, [], true, [playerId], playerId);
    // Clear player id part so we can hit the custom error we want
    await combatantsHelper.clearCooldowns([playerId]);

    await expect(
      combatantsHelper.connect(alice).assignCombatants(clanId, false, [], true, [playerId], playerId)
    ).to.be.revertedWithCustomError(lockedBankVaultsLibrary, "ClanCombatantsChangeCooldown");

    await ethers.provider.send("evm_increaseTime", [combatantChangeCooldown - 5]);
    await ethers.provider.send("evm_mine", []);
    await expect(
      combatantsHelper.connect(alice).assignCombatants(clanId, false, [], true, [playerId], playerId)
    ).to.be.revertedWithCustomError(lockedBankVaultsLibrary, "ClanCombatantsChangeCooldown");
    await ethers.provider.send("evm_increaseTime", [5]);
    await ethers.provider.send("evm_mine", []);
    await combatantsHelper.connect(alice).assignCombatants(clanId, false, [], true, [playerId], playerId);
  });

  it("Cannot be used as a defender if you are currently a territory combatant", async function () {});

  it("Attack locked funds", async () => {
    const {
      clans,
      lockedBankVaults,
      combatantsHelper,
      territories,
      clanId,
      playerId,
      playerNFT,
      avatarId,
      origName,
      alice,
      bob,
      charlie,
      clanName,
      discord,
      telegram,
      twitter,
      imageId,
      tierId,
      brush,
      mockVRF,
      lockedFundsPeriod
    } = await loadFixture(clanFixture);

    await lockFundsForClan(lockedBankVaults, clanId, brush, alice, playerId, 1000, territories);
    const {timestamp: NOW} = (await ethers.provider.getBlock("latest")) as Block;

    await combatantsHelper.connect(alice).assignCombatants(clanId, false, [], true, [playerId], playerId);

    // Create a new clan to attack/defend
    const bobPlayerId = await createPlayer(playerNFT, avatarId, bob, origName + 1, true);
    await clans.connect(bob).createClan(bobPlayerId, clanName + 1, discord, telegram, twitter, imageId, tierId);

    const bobClanId = clanId + 1;
    const charliePlayerId = await createPlayer(playerNFT, avatarId, charlie, origName + 2, true);
    await clans.connect(charlie).requestToJoin(bobClanId, charliePlayerId, 0);
    await clans.connect(bob).acceptJoinRequests(bobClanId, [charliePlayerId], bobPlayerId);

    // Attack
    await combatantsHelper
      .connect(bob)
      .assignCombatants(bobClanId, false, [], true, [bobPlayerId, charliePlayerId], bobPlayerId);
    await lockedBankVaults
      .connect(bob)
      .attackVaults(bobClanId, clanId, 0, bobPlayerId, {value: await lockedBankVaults.getAttackCost()});
    await fulfillRandomWords(1, lockedBankVaults, mockVRF);
    const {timestamp: NOW1} = (await ethers.provider.getBlock("latest")) as Block;
    // Should win as they have more players
    expect((await lockedBankVaults.getClanInfo(clanId)).totalBrushLocked).to.eq(900);
    expect((await lockedBankVaults.getClanInfo(bobClanId)).totalBrushLocked).to.eq(100);

    expect((await lockedBankVaults.getClanInfo(clanId)).defendingVaults.length).to.eq(1);
    expect((await lockedBankVaults.getClanInfo(clanId)).defendingVaults[0].amount).to.eq(900);
    expect((await lockedBankVaults.getClanInfo(clanId)).defendingVaults[0].timestamp).to.eq(NOW + lockedFundsPeriod);

    expect((await lockedBankVaults.getClanInfo(bobClanId)).defendingVaults.length).to.eq(1);
    expect((await lockedBankVaults.getClanInfo(bobClanId)).defendingVaults[0].amount).to.eq(100);
    expect((await lockedBankVaults.getClanInfo(bobClanId)).defendingVaults[0].timestamp).to.eq(
      NOW1 + lockedFundsPeriod
    );
  });

  it("Must attack with some combatants", async () => {
    const {
      clans,
      lockedBankVaults,
      LockedBankVaultsLibrary,
      combatantsHelper,
      territories,
      clanId,
      playerId,
      playerNFT,
      avatarId,
      origName,
      alice,
      bob,
      charlie,
      clanName,
      discord,
      telegram,
      twitter,
      imageId,
      tierId,
      brush
    } = await loadFixture(clanFixture);

    await lockFundsForClan(lockedBankVaults, clanId, brush, alice, playerId, 1000, territories);

    await combatantsHelper.connect(alice).assignCombatants(clanId, false, [], true, [playerId], playerId);

    // Create a new clan to attack/defend
    const bobPlayerId = await createPlayer(playerNFT, avatarId, bob, origName + 1, true);
    await clans.connect(bob).createClan(bobPlayerId, clanName + 1, discord, telegram, twitter, imageId, tierId);

    const bobClanId = clanId + 1;
    const charliePlayerId = await createPlayer(playerNFT, avatarId, charlie, origName + 2, true);
    await clans.connect(charlie).requestToJoin(bobClanId, charliePlayerId, 0);
    await clans.connect(bob).acceptJoinRequests(bobClanId, [charliePlayerId], bobPlayerId);

    // Cannot attack unless have combatants specified
    await expect(
      lockedBankVaults
        .connect(bob)
        .attackVaults(bobClanId, clanId, 0, bobPlayerId, {value: await lockedBankVaults.getAttackCost()})
    ).to.be.revertedWithCustomError(LockedBankVaultsLibrary, "NoCombatants");
  });

  // Losing 5% of the locked funds if losing and if winning get 10%
  it("Attack back, lose and then win", async () => {
    const {
      clans,
      lockedBankVaults,
      LockedBankVaultsLibrary,
      combatantsHelper,
      territories,
      clanId,
      playerId,
      playerNFT,
      avatarId,
      origName,
      owner,
      alice,
      bob,
      charlie,
      erin,
      frank,
      clanName,
      discord,
      telegram,
      twitter,
      imageId,
      tierId,
      brush,
      mockVRF,
      lockedFundsPeriod,
      attackingCooldown,
      reattackingCooldown,
      combatantChangeCooldown,
      players
    } = await loadFixture(clanFixture);

    await lockFundsForClan(lockedBankVaults, clanId, brush, alice, playerId, 1000, territories);
    const {timestamp: NOW} = (await ethers.provider.getBlock("latest")) as Block;

    await combatantsHelper.connect(alice).assignCombatants(clanId, false, [], true, [playerId], playerId);

    // Create a new clan to attack/defend
    const bobPlayerId = await createPlayer(playerNFT, avatarId, bob, origName + 1, true);
    await clans.connect(bob).createClan(bobPlayerId, clanName + 1, discord, telegram, twitter, imageId, tierId);

    const bobClanId = clanId + 1;
    const charliePlayerId = await createPlayer(playerNFT, avatarId, charlie, origName + 2, true);
    await clans.connect(charlie).requestToJoin(bobClanId, charliePlayerId, 0);
    await clans.connect(bob).acceptJoinRequests(bobClanId, [charliePlayerId], bobPlayerId);
    // Increase odds of winning
    for (let i = 0; i < allBattleSkills.length; ++i) {
      await players.testModifyXP(bob, bobPlayerId, allBattleSkills[i], getXPFromLevel(100), true);
    }

    for (let i = 0; i < allBattleSkills.length; ++i) {
      await players.testModifyXP(charlie, charliePlayerId, allBattleSkills[i], getXPFromLevel(100), true);
    }

    // Attack
    await combatantsHelper
      .connect(bob)
      .assignCombatants(bobClanId, false, [], true, [bobPlayerId, charliePlayerId], bobPlayerId);
    await lockedBankVaults
      .connect(bob)
      .attackVaults(bobClanId, clanId, 0, bobPlayerId, {value: await lockedBankVaults.getAttackCost()});
    await fulfillRandomWords(1, lockedBankVaults, mockVRF);
    expect((await lockedBankVaults.getClanInfo(clanId)).totalBrushLocked).to.eq(900);
    expect((await lockedBankVaults.getClanInfo(bobClanId)).totalBrushLocked).to.eq(100);
    const {timestamp: NOW1} = (await ethers.provider.getBlock("latest")) as Block;

    // Alice's clan can attack back because they haven't attacked anything yet but will lose.
    await lockedBankVaults
      .connect(alice)
      .attackVaults(clanId, bobClanId, 0, playerId, {value: await lockedBankVaults.getAttackCost()});
    await fulfillRandomWords(2, lockedBankVaults, mockVRF);
    expect((await lockedBankVaults.getClanInfo(clanId)).totalBrushLocked).to.eq(855); // lost 5% for losing
    expect((await lockedBankVaults.getClanInfo(bobClanId)).totalBrushLocked).to.eq(100); // // unchanged

    // Let's give them more players so they can win
    const ownerPlayerId = await createPlayer(playerNFT, avatarId, owner, origName + 3, true);
    await clans.requestToJoin(clanId, ownerPlayerId, 0);
    await clans.connect(alice).acceptJoinRequests(clanId, [ownerPlayerId], playerId);

    const erinPlayerId = await createPlayer(playerNFT, avatarId, erin, origName + 4, true);
    await clans.connect(erin).requestToJoin(clanId, erinPlayerId, 0);
    await clans.connect(alice).acceptJoinRequests(clanId, [erinPlayerId], playerId);
    // Extend member capacity
    await clans.editTiers([
      {
        id: 1,
        maxMemberCapacity: 4,
        maxBankCapacity: 3,
        maxImageId: 16,
        price: 0,
        minimumAge: 0
      }
    ]);

    const frankPlayerId = await createPlayer(playerNFT, avatarId, frank, origName + 5, true);
    await clans.connect(frank).requestToJoin(clanId, frankPlayerId, 0);
    await clans.connect(alice).acceptJoinRequests(clanId, [frankPlayerId], playerId);

    // But have to wait for the cooldown and not just the generic attack cooldown, the same clan attacking cooldown
    await expect(
      lockedBankVaults
        .connect(alice)
        .attackVaults(clanId, bobClanId, 0, playerId, {value: await lockedBankVaults.getAttackCost()})
    ).to.be.revertedWithCustomError(LockedBankVaultsLibrary, "ClanAttackingCooldown");

    await ethers.provider.send("evm_increaseTime", [attackingCooldown]);
    await ethers.provider.send("evm_mine", []);
    await expect(
      lockedBankVaults
        .connect(alice)
        .attackVaults(clanId, bobClanId, 0, playerId, {value: await lockedBankVaults.getAttackCost()})
    ).to.be.revertedWithCustomError(LockedBankVaultsLibrary, "ClanAttackingSameClanCooldown");

    await ethers.provider.send("evm_increaseTime", [combatantChangeCooldown]);
    await ethers.provider.send("evm_mine", []);

    await combatantsHelper
      .connect(alice)
      .assignCombatants(clanId, false, [], true, [playerId, ownerPlayerId, erinPlayerId, frankPlayerId], playerId);
    await ethers.provider.send("evm_increaseTime", [reattackingCooldown]);
    await ethers.provider.send("evm_mine", []);
    await lockedBankVaults
      .connect(alice)
      .attackVaults(clanId, bobClanId, 0, playerId, {value: await lockedBankVaults.getAttackCost()});
    await fulfillRandomWords(3, lockedBankVaults, mockVRF);
    const {timestamp: NOW2} = (await ethers.provider.getBlock("latest")) as Block;

    // Wait another day (check it's not just the clan cooldown)
    expect((await lockedBankVaults.getClanInfo(clanId)).totalBrushLocked).to.eq(855 + 10);
    expect((await lockedBankVaults.getClanInfo(bobClanId)).totalBrushLocked).to.eq(90);

    expect((await lockedBankVaults.getClanInfo(clanId)).defendingVaults.length).to.eq(1);
    expect((await lockedBankVaults.getClanInfo(clanId)).defendingVaults[0].amount).to.eq(855);
    expect((await lockedBankVaults.getClanInfo(clanId)).defendingVaults[0].timestamp).to.eq(NOW + lockedFundsPeriod);
    expect((await lockedBankVaults.getClanInfo(clanId)).defendingVaults[0].amount1).to.eq(10);
    expect((await lockedBankVaults.getClanInfo(clanId)).defendingVaults[0].timestamp1).to.eq(NOW2 + lockedFundsPeriod);

    expect((await lockedBankVaults.getClanInfo(bobClanId)).defendingVaults.length).to.eq(1);
    expect((await lockedBankVaults.getClanInfo(bobClanId)).defendingVaults[0].amount).to.eq(90);
    expect((await lockedBankVaults.getClanInfo(bobClanId)).defendingVaults[0].timestamp).to.eq(
      NOW1 + lockedFundsPeriod
    );
    expect((await lockedBankVaults.getClanInfo(bobClanId)).defendingVaults[0].amount1).to.eq(0);
    expect((await lockedBankVaults.getClanInfo(bobClanId)).defendingVaults[0].timestamp1).to.eq(0);
  });

  it("Claim rewards when the deadline has expired", async () => {
    const {
      lockedBankVaults,
      LockedBankVaultsLibrary,
      territories,
      clanId,
      playerId,
      alice,
      brush,
      bankAddress,
      lockedFundsPeriod
    } = await loadFixture(clanFixture);

    await lockFundsForClan(lockedBankVaults, clanId, brush, alice, playerId, 1000, territories);
    const lockPeriodSlice = lockedFundsPeriod / 10;

    await ethers.provider.send("evm_increaseTime", [lockPeriodSlice]);
    await ethers.provider.send("evm_mine", []);
    await lockFundsForClan(lockedBankVaults, clanId, brush, alice, playerId, 300, territories);
    await ethers.provider.send("evm_increaseTime", [lockPeriodSlice]);
    await ethers.provider.send("evm_mine", []);
    await lockFundsForClan(lockedBankVaults, clanId, brush, alice, playerId, 450, territories);

    // Nothing to claim
    await expect(lockedBankVaults.connect(alice).claimFunds(clanId, playerId)).to.be.revertedWithCustomError(
      LockedBankVaultsLibrary,
      "NothingToClaim"
    );
    await ethers.provider.send("evm_increaseTime", [lockPeriodSlice * 7]);
    await ethers.provider.send("evm_mine", []);
    await expect(lockedBankVaults.connect(alice).claimFunds(clanId, playerId)).to.be.revertedWithCustomError(
      LockedBankVaultsLibrary,
      "NothingToClaim"
    );
    await ethers.provider.send("evm_increaseTime", [lockPeriodSlice]);
    await ethers.provider.send("evm_mine", []);
    // Can now claim
    await lockedBankVaults.connect(alice).claimFunds(clanId, playerId);
    expect(await brush.balanceOf(bankAddress)).to.eq(1000);
    expect(await brush.balanceOf(lockedBankVaults)).to.eq(750);
    // Cannot claim twice
    await expect(lockedBankVaults.connect(alice).claimFunds(clanId, playerId)).to.be.revertedWithCustomError(
      LockedBankVaultsLibrary,
      "NothingToClaim"
    );
    await timeTravel(lockPeriodSlice * 2);
    // Claim both
    await lockedBankVaults.connect(alice).claimFunds(clanId, playerId);
    expect(await brush.balanceOf(bankAddress)).to.eq(1750);
    expect(await brush.balanceOf(lockedBankVaults)).to.eq(0);
    // Cannot claim again
    await expect(lockedBankVaults.connect(alice).claimFunds(clanId, playerId)).to.be.revertedWithCustomError(
      LockedBankVaultsLibrary,
      "NothingToClaim"
    );
  });

  it("Attack costs and moving average price", async () => {
    const {
      clans,
      lockedBankVaults,
      combatantsHelper,
      territories,
      clanId,
      playerId,
      playerNFT,
      avatarId,
      origName,
      alice,
      bob,
      charlie,
      clanName,
      discord,
      telegram,
      twitter,
      imageId,
      tierId,
      brush,
      mockVRF,
      vrfRequestInfo
    } = await loadFixture(clanFixture);

    await lockFundsForClan(lockedBankVaults, clanId, brush, alice, playerId, 1000, territories);

    await combatantsHelper.connect(alice).assignCombatants(clanId, false, [], true, [playerId], playerId);

    // Create a new clan to attack/defend
    const bobPlayerId = await createPlayer(playerNFT, avatarId, bob, origName + 1, true);
    await clans.connect(bob).createClan(bobPlayerId, clanName + 1, discord, telegram, twitter, imageId, tierId);

    const bobClanId = clanId + 1;
    const charliePlayerId = await createPlayer(playerNFT, avatarId, charlie, origName + 2, true);
    await clans.connect(charlie).requestToJoin(bobClanId, charliePlayerId, 0);
    await clans.connect(bob).acceptJoinRequests(bobClanId, [charliePlayerId], bobPlayerId);

    // Attack
    await combatantsHelper
      .connect(bob)
      .assignCombatants(bobClanId, false, [], true, [bobPlayerId, charliePlayerId], bobPlayerId);
    const tx = await lockedBankVaults
      .connect(bob)
      .attackVaults(bobClanId, clanId, 0, bobPlayerId, {value: await lockedBankVaults.getAttackCost()});
    const {gasPrice} = tx;
    const requestId = 1;
    await fulfillRandomWords(requestId, lockedBankVaults, mockVRF);

    let attackCost = await lockedBankVaults.getAttackCost();
    let [movingAverageGasPrice, baseAttackCost] = await vrfRequestInfo.get();
    expect(attackCost).to.eq(baseAttackCost);

    await lockedBankVaults.setAttackInProgress(requestId);
    await fulfillRandomWords(requestId, lockedBankVaults, mockVRF, gasPrice + 1000n);

    [movingAverageGasPrice, baseAttackCost] = await vrfRequestInfo.get();
    // The big zeros are there to show all the values used
    const bigZero = 0n;
    expect(movingAverageGasPrice).to.eq((bigZero + bigZero + bigZero + (gasPrice + 1000n)) / 4n);

    attackCost = await lockedBankVaults.getAttackCost();

    const expectedGasLimit = 1_500_000n;
    await lockedBankVaults.setExpectedGasLimitFulfill(expectedGasLimit);
    expect(attackCost).to.eq(baseAttackCost + movingAverageGasPrice * expectedGasLimit);

    await lockedBankVaults.setAttackInProgress(requestId);
    await fulfillRandomWords(requestId, lockedBankVaults, mockVRF, gasPrice + 900n);
    await lockedBankVaults.setAttackInProgress(requestId);
    await fulfillRandomWords(requestId, lockedBankVaults, mockVRF, gasPrice + 800n);
    await lockedBankVaults.setAttackInProgress(requestId);
    await fulfillRandomWords(requestId, lockedBankVaults, mockVRF, gasPrice + 500n);
    await lockedBankVaults.setAttackInProgress(requestId);
    await fulfillRandomWords(requestId, lockedBankVaults, mockVRF, gasPrice + 200n);

    [movingAverageGasPrice, baseAttackCost] = await vrfRequestInfo.get();
    expect(movingAverageGasPrice).to.eq(
      (gasPrice + 900n + (gasPrice + 800n) + (gasPrice + 500n) + (gasPrice + 200n)) / 4n
    );
    attackCost = await lockedBankVaults.getAttackCost();
    expect(attackCost).to.eq(baseAttackCost + movingAverageGasPrice * expectedGasLimit);
  });

  it("Multiple locked funds claim", async () => {
    // Test it for gas usage
    const {lockedBankVaults, territories, clanId, playerId, brush, alice, lockedFundsPeriod} = await loadFixture(
      clanFixture
    );

    const NOWS = [];
    for (let i = 0; i < 5; ++i) {
      await lockFundsForClan(lockedBankVaults, clanId, brush, alice, playerId, 100 + i, territories);
      const {timestamp: NOW} = (await ethers.provider.getBlock("latest")) as Block;
      NOWS.push(NOW);

      await ethers.provider.send("evm_increaseTime", [100]); // Just so that we can more easily distinguish between the timestamps of locks
      await ethers.provider.send("evm_mine", []);
    }

    expect((await lockedBankVaults.getClanInfo(clanId)).defendingVaults.length).to.eq(3);
    expect((await lockedBankVaults.getClanInfo(clanId)).defendingVaults[0].claimed).to.be.false;
    expect((await lockedBankVaults.getClanInfo(clanId)).defendingVaults[0].amount).to.eq(100);
    expect((await lockedBankVaults.getClanInfo(clanId)).defendingVaults[0].timestamp).to.eq(
      NOWS[0] + lockedFundsPeriod
    );
    expect((await lockedBankVaults.getClanInfo(clanId)).defendingVaults[0].amount1).to.eq(101);
    expect((await lockedBankVaults.getClanInfo(clanId)).defendingVaults[0].timestamp1).to.eq(
      NOWS[1] + lockedFundsPeriod
    );
    expect((await lockedBankVaults.getClanInfo(clanId)).defendingVaults[1].claimed).to.be.false;
    expect((await lockedBankVaults.getClanInfo(clanId)).defendingVaults[1].amount).to.eq(102);
    expect((await lockedBankVaults.getClanInfo(clanId)).defendingVaults[1].timestamp).to.eq(
      NOWS[2] + lockedFundsPeriod
    );
    expect((await lockedBankVaults.getClanInfo(clanId)).defendingVaults[1].amount1).to.eq(103);
    expect((await lockedBankVaults.getClanInfo(clanId)).defendingVaults[1].timestamp1).to.eq(
      NOWS[3] + lockedFundsPeriod
    );
    expect((await lockedBankVaults.getClanInfo(clanId)).defendingVaults[2].claimed).to.be.false;
    expect((await lockedBankVaults.getClanInfo(clanId)).defendingVaults[2].amount).to.eq(104);
    expect((await lockedBankVaults.getClanInfo(clanId)).defendingVaults[2].timestamp).to.eq(
      NOWS[4] + lockedFundsPeriod
    );
    expect((await lockedBankVaults.getClanInfo(clanId)).defendingVaults[2].amount1).to.eq(0);
    expect((await lockedBankVaults.getClanInfo(clanId)).defendingVaults[2].timestamp1).to.eq(0);

    await ethers.provider.send("evm_setNextBlockTimestamp", [NOWS[0] + lockedFundsPeriod - 1]);
    await ethers.provider.send("evm_mine", []);
    await lockedBankVaults.connect(alice).claimFunds(clanId, playerId);

    // First ones should be gone
    expect((await lockedBankVaults.getClanInfo(clanId)).defendingVaults[0].claimed).to.be.true;
    expect((await lockedBankVaults.getClanInfo(clanId)).defendingVaults[0].amount).to.eq(0);
    expect((await lockedBankVaults.getClanInfo(clanId)).defendingVaults[0].timestamp).to.eq(0);
    expect((await lockedBankVaults.getClanInfo(clanId)).defendingVaults[0].amount1).to.eq(101);
    expect((await lockedBankVaults.getClanInfo(clanId)).defendingVaults[0].timestamp1).to.eq(
      NOWS[1] + lockedFundsPeriod
    );
    expect((await lockedBankVaults.getClanInfo(clanId)).defendingVaultsOffset).to.eq(0);

    await ethers.provider.send("evm_setNextBlockTimestamp", [NOWS[3] + lockedFundsPeriod - 1]);
    await ethers.provider.send("evm_mine", []);
    await lockedBankVaults.connect(alice).claimFunds(clanId, playerId);

    // First & second ones should be gone
    expect((await lockedBankVaults.getClanInfo(clanId)).defendingVaults[0].claimed).to.be.true;
    expect((await lockedBankVaults.getClanInfo(clanId)).defendingVaults[0].amount).to.eq(0);
    expect((await lockedBankVaults.getClanInfo(clanId)).defendingVaults[0].timestamp).to.eq(0);
    expect((await lockedBankVaults.getClanInfo(clanId)).defendingVaults[0].amount1).to.eq(101);
    expect((await lockedBankVaults.getClanInfo(clanId)).defendingVaults[0].timestamp1).to.eq(
      NOWS[1] + lockedFundsPeriod
    );
    expect((await lockedBankVaults.getClanInfo(clanId)).defendingVaults[1].claimed).to.be.false;
    expect((await lockedBankVaults.getClanInfo(clanId)).defendingVaults[1].amount).to.eq(102);
    expect((await lockedBankVaults.getClanInfo(clanId)).defendingVaults[1].timestamp).to.eq(
      NOWS[2] + lockedFundsPeriod
    );
    expect((await lockedBankVaults.getClanInfo(clanId)).defendingVaults[1].amount1).to.eq(103);
    expect((await lockedBankVaults.getClanInfo(clanId)).defendingVaults[1].timestamp1).to.eq(
      NOWS[3] + lockedFundsPeriod
    );
    expect((await lockedBankVaults.getClanInfo(clanId)).defendingVaults[2].claimed).to.be.false;
    expect((await lockedBankVaults.getClanInfo(clanId)).defendingVaults[2].amount).to.eq(104);
    expect((await lockedBankVaults.getClanInfo(clanId)).defendingVaults[2].timestamp).to.eq(
      NOWS[4] + lockedFundsPeriod
    );
    expect((await lockedBankVaults.getClanInfo(clanId)).defendingVaults[2].amount1).to.eq(0);
    expect((await lockedBankVaults.getClanInfo(clanId)).defendingVaults[2].timestamp1).to.eq(0);

    expect((await lockedBankVaults.getClanInfo(clanId)).defendingVaultsOffset).to.eq(2);

    // Claim the rest
    await ethers.provider.send("evm_setNextBlockTimestamp", [NOWS[4] + lockedFundsPeriod - 1]);
    await ethers.provider.send("evm_mine", []);
    await lockedBankVaults.connect(alice).claimFunds(clanId, playerId);
    expect((await lockedBankVaults.getClanInfo(clanId)).defendingVaults[2].claimed).to.be.true;
    expect((await lockedBankVaults.getClanInfo(clanId)).defendingVaults[2].amount).to.eq(104); // Leave it unchanged
    expect((await lockedBankVaults.getClanInfo(clanId)).defendingVaults[2].timestamp).to.eq(
      NOWS[4] + lockedFundsPeriod
    );
    expect((await lockedBankVaults.getClanInfo(clanId)).defendingVaultsOffset).to.eq(2);

    await lockFundsForClan(lockedBankVaults, clanId, brush, alice, playerId, 100, territories);
    const {timestamp: NOW} = (await ethers.provider.getBlock("latest")) as Block;
    expect((await lockedBankVaults.getClanInfo(clanId)).defendingVaults[2].amount1).to.eq(100);
    expect((await lockedBankVaults.getClanInfo(clanId)).defendingVaults[2].timestamp1).to.eq(NOW + lockedFundsPeriod);
    expect((await lockedBankVaults.getClanInfo(clanId)).defendingVaultsOffset).to.eq(2);

    await ethers.provider.send("evm_setNextBlockTimestamp", [NOW + lockedFundsPeriod]);
    await ethers.provider.send("evm_mine", []);
    await lockedBankVaults.connect(alice).claimFunds(clanId, playerId);

    expect((await lockedBankVaults.getClanInfo(clanId)).defendingVaults[2].amount).to.eq(104); // Leave unchanged
    expect((await lockedBankVaults.getClanInfo(clanId)).defendingVaults[2].timestamp).to.eq(
      NOWS[4] + lockedFundsPeriod
    );
    expect((await lockedBankVaults.getClanInfo(clanId)).defendingVaults[2].amount1).to.eq(100);
    expect((await lockedBankVaults.getClanInfo(clanId)).defendingVaults[2].timestamp1).to.eq(NOW + lockedFundsPeriod);

    expect((await lockedBankVaults.getClanInfo(clanId)).defendingVaultsOffset).to.eq(3);
  });

  it("Max locked vaults, cannot attack if reached", async () => {
    const {
      clans,
      lockedBankVaults,
      LockedBankVaultsLibrary,
      combatantsHelper,
      territories,
      clanId,
      playerId,
      brush,
      alice,
      bob,
      playerNFT,
      avatarId,
      origName,
      clanName,
      discord,
      telegram,
      twitter,
      imageId,
      tierId,
      mockVRF,
      maxLockedVaults
    } = await loadFixture(clanFixture);

    for (let i = 0; i < maxLockedVaults - 1; ++i) {
      await lockFundsForClan(lockedBankVaults, clanId, brush, alice, playerId, 400, territories);
    }

    await combatantsHelper.connect(alice).assignCombatants(clanId, false, [], true, [playerId], playerId);

    // Create a new clan to defend
    const bobPlayerId = await createPlayer(playerNFT, avatarId, bob, origName + 1, true);
    await clans.connect(bob).createClan(bobPlayerId, clanName + 1, discord, telegram, twitter, imageId, tierId);
    const bobClanId = 2;

    await lockFundsForClan(lockedBankVaults, bobClanId, brush, bob, bobPlayerId, 400, territories);

    // Attack
    await lockedBankVaults
      .connect(alice)
      .attackVaults(clanId, bobClanId, 0, playerId, {value: await lockedBankVaults.getAttackCost()});
    await fulfillRandomWords(1, lockedBankVaults, mockVRF);
    await lockedBankVaults.clearCooldowns(clanId, [bobClanId]);

    await lockFundsForClan(lockedBankVaults, clanId, brush, alice, playerId, 400, territories);

    await expect(
      lockedBankVaults
        .connect(alice)
        .attackVaults(clanId, bobClanId, 0, playerId, {value: await lockedBankVaults.getAttackCost()})
    ).to.be.revertedWithCustomError(LockedBankVaultsLibrary, "MaxLockedVaultsReached");
  });

  // Have to remove the restriction about duplicate combatants (TODO: update test to use many different combatants)
  it.skip("Check gas limits for maximum locked vaults", async () => {
    // Test it for gas usage
    const {
      clans,
      players,
      lockedBankVaults,
      combatantsHelper,
      territories,
      clanId,
      playerId,
      brush,
      alice,
      bob,
      playerNFT,
      avatarId,
      origName,
      clanName,
      discord,
      telegram,
      twitter,
      imageId,
      tierId,
      mockVRF,
      maxLockedVaults
    } = await loadFixture(clanFixture);

    for (let i = 0; i < maxLockedVaults; ++i) {
      await lockFundsForClan(lockedBankVaults, clanId, brush, alice, playerId, 400, territories);
    }

    await combatantsHelper
      .connect(alice)
      .assignCombatants(
        clanId,
        false,
        [],
        true,
        [
          playerId,
          playerId,
          playerId,
          playerId,
          playerId,
          playerId,
          playerId,
          playerId,
          playerId,
          playerId,
          playerId,
          playerId,
          playerId,
          playerId,
          playerId,
          playerId,
          playerId,
          playerId,
          playerId,
          playerId
        ],
        playerId
      );

    // Create a new clan to attack/defend
    const bobPlayerId = await createPlayer(playerNFT, avatarId, bob, origName + 1, true);
    await clans.connect(bob).createClan(bobPlayerId, clanName + 1, discord, telegram, twitter, imageId, tierId);
    const bobClanId = 2;

    for (let i = 0; i < allBattleSkills.length; ++i) {
      await players.testModifyXP(bob, bobPlayerId, allBattleSkills[i], getXPFromLevel(100), true);
    }

    // Attack
    await combatantsHelper
      .connect(bob)
      .assignCombatants(
        bobClanId,
        false,
        [],
        true,
        [
          bobPlayerId,
          bobPlayerId,
          bobPlayerId,
          bobPlayerId,
          bobPlayerId,
          bobPlayerId,
          bobPlayerId,
          bobPlayerId,
          bobPlayerId,
          bobPlayerId,
          bobPlayerId,
          bobPlayerId,
          bobPlayerId,
          bobPlayerId,
          bobPlayerId,
          bobPlayerId,
          bobPlayerId,
          bobPlayerId,
          bobPlayerId,
          bobPlayerId
        ],
        bobPlayerId
      );

    await lockedBankVaults
      .connect(bob)
      .attackVaults(bobClanId, clanId, 0, bobPlayerId, {value: await lockedBankVaults.getAttackCost()});
    await fulfillRandomWords(1, lockedBankVaults, mockVRF);
  });

  it("Allow re-attacking if the user has the appropriate item", async () => {
    const {
      clans,
      lockedBankVaults,
      LockedBankVaultsLibrary,
      combatantsHelper,
      territories,
      clanId,
      playerId,
      playerNFT,
      itemNFT,
      avatarId,
      origName,
      alice,
      bob,
      clanName,
      discord,
      telegram,
      twitter,
      imageId,
      tierId,
      brush,
      mockVRF,
      attackingCooldown
    } = await loadFixture(clanFixture);

    await combatantsHelper.connect(alice).assignCombatants(clanId, false, [], true, [playerId], playerId);

    // Create a new clan to attack/defend
    const bobPlayerId = await createPlayer(playerNFT, avatarId, bob, origName + 1, true);
    await clans.connect(bob).createClan(bobPlayerId, clanName + 1, discord, telegram, twitter, imageId, tierId);

    const bobClanId = clanId + 1;
    await lockFundsForClan(lockedBankVaults, bobClanId, brush, bob, bobPlayerId, 1000, territories);

    // But have to wait for the cooldown and not just the generic attack cooldown, the same clan attacking cooldown
    await lockedBankVaults
      .connect(alice)
      .attackVaults(clanId, bobClanId, 0, playerId, {value: await lockedBankVaults.getAttackCost()});

    await fulfillRandomWords(1, lockedBankVaults, mockVRF);

    await ethers.provider.send("evm_increaseTime", [attackingCooldown]);
    await ethers.provider.send("evm_mine", []);
    await expect(
      lockedBankVaults
        .connect(alice)
        .attackVaults(clanId, bobClanId, 0, playerId, {value: await lockedBankVaults.getAttackCost()})
    ).to.be.revertedWithCustomError(LockedBankVaultsLibrary, "ClanAttackingSameClanCooldown");

    const items = allItems.filter(
      (inputItem) =>
        inputItem.tokenId == EstforConstants.DEVILISH_FINGERS || inputItem.tokenId == EstforConstants.PROTECTION_SHIELD
    );
    await itemNFT.addItems(items);
    await itemNFT.mintBatch(alice, [EstforConstants.DEVILISH_FINGERS, EstforConstants.PROTECTION_SHIELD], [1, 1]);

    // Wrong item
    await expect(
      lockedBankVaults.connect(alice).attackVaults(clanId, bobClanId, EstforConstants.PROTECTION_SHIELD, playerId, {
        value: await lockedBankVaults.getAttackCost()
      })
    ).to.be.revertedWithCustomError(LockedBankVaultsLibrary, "NotALockedVaultAttackItem");

    // The re-attacking cooldown should be the same afterwards when using an item
    let battleInfo = await lockedBankVaults.getLastClanBattles(clanId, bobClanId);
    const beforeCooldownTimestamp = battleInfo.lastClanIdAttackOtherClanIdCooldownTimestamp;
    expect(battleInfo.numReattacks).to.eq(0);
    await lockedBankVaults.connect(alice).attackVaults(clanId, bobClanId, EstforConstants.DEVILISH_FINGERS, playerId, {
      value: await lockedBankVaults.getAttackCost()
    });

    await fulfillRandomWords(2, lockedBankVaults, mockVRF);
    battleInfo = await lockedBankVaults.getLastClanBattles(clanId, bobClanId);
    expect(battleInfo.lastClanIdAttackOtherClanIdCooldownTimestamp).to.eq(beforeCooldownTimestamp);
    expect(battleInfo.numReattacks).to.eq(1);

    await ethers.provider.send("evm_increaseTime", [attackingCooldown]);
    await ethers.provider.send("evm_mine", []);
    await expect(
      lockedBankVaults
        .connect(alice)
        .attackVaults(clanId, bobClanId, 0, playerId, {value: await lockedBankVaults.getAttackCost()})
    ).to.be.revertedWithCustomError(LockedBankVaultsLibrary, "ClanAttackingSameClanCooldown");

    // TODO: Check other clan
  });

  it("Using a super-attack should give more rolls", async () => {
    const {
      clans,
      lockedBankVaults,
      combatantsHelper,
      territories,
      clanId,
      playerId,
      playerNFT,
      itemNFT,
      avatarId,
      origName,
      alice,
      bob,
      clanName,
      discord,
      telegram,
      twitter,
      imageId,
      tierId,
      brush,
      mockVRF
    } = await loadFixture(clanFixture);

    await combatantsHelper.connect(alice).assignCombatants(clanId, false, [], true, [playerId], playerId);

    // Create a new clan to attack/defend
    const bobPlayerId = await createPlayer(playerNFT, avatarId, bob, origName + 1, true);
    await clans.connect(bob).createClan(bobPlayerId, clanName + 1, discord, telegram, twitter, imageId, tierId);

    const bobClanId = clanId + 1;
    await combatantsHelper.connect(bob).assignCombatants(bobClanId, false, [], true, [bobPlayerId], bobPlayerId);
    await lockFundsForClan(lockedBankVaults, bobClanId, brush, bob, bobPlayerId, 1000, territories);

    const item = allItems.find((inputItem) => inputItem.tokenId == EstforConstants.SHARPENED_CLAW) as ItemInput;
    await itemNFT.addItems([item]);
    await itemNFT.mint(alice, EstforConstants.SHARPENED_CLAW, 10);

    let requestId = 1;
    // Try 10 times
    let highestRoll = 0n;
    for (let i = 0; i < 10; ++i, ++requestId) {
      await lockedBankVaults.connect(alice).attackVaults(clanId, bobClanId, EstforConstants.SHARPENED_CLAW, playerId, {
        value: await lockedBankVaults.getAttackCost()
      });

      const tx = await fulfillRandomWords(requestId, lockedBankVaults, mockVRF);
      const receipt = (await tx.wait()) as ContractTransactionReceipt;
      // If the attacker lost then some brush is sent which changes up the event ordering
      const log = lockedBankVaults.interface.parseLog(receipt.logs.length > 4 ? receipt.logs[4] : receipt.logs[1]);
      highestRoll = highestRoll > log?.args["attackingRolls"][0] ? highestRoll : log?.args["attackingRolls"][0];
      await lockedBankVaults.clearCooldowns(clanId, [bobClanId]);
    }

    expect(highestRoll).to.eq(2);
    expect(await itemNFT.balanceOf(alice, EstforConstants.SHARPENED_CLAW)).to.eq(0);
    expect((await lockedBankVaults.getClanInfo(bobClanId)).totalBrushLocked).to.be.lte(900); // lost 10%
  });

  it("Super-attack should have a cooldown", async () => {
    const {
      clans,
      lockedBankVaults,
      LockedBankVaultsLibrary,
      combatantsHelper,
      territories,
      clanId,
      playerId,
      playerNFT,
      itemNFT,
      avatarId,
      origName,
      alice,
      bob,
      charlie,
      clanName,
      discord,
      telegram,
      twitter,
      imageId,
      tierId,
      brush,
      mockVRF,
      attackingCooldown
    } = await loadFixture(clanFixture);

    await combatantsHelper.connect(alice).assignCombatants(clanId, false, [], true, [playerId], playerId);

    // Create a new clan to defend
    const bobPlayerId = await createPlayer(playerNFT, avatarId, bob, origName + 1, true);
    await clans.connect(bob).createClan(bobPlayerId, clanName + 1, discord, telegram, twitter, imageId, tierId);

    const bobClanId = clanId + 1;
    await combatantsHelper.connect(bob).assignCombatants(bobClanId, false, [], true, [bobPlayerId], bobPlayerId);
    await lockFundsForClan(lockedBankVaults, bobClanId, brush, bob, bobPlayerId, 1000, territories);

    const item = allItems.find((inputItem) => inputItem.tokenId == EstforConstants.SHARPENED_CLAW) as ItemInput;
    await itemNFT.addItems([item]);
    await itemNFT.mint(alice, EstforConstants.SHARPENED_CLAW, 10);

    const {timestamp: NOW} = (await ethers.provider.getBlock("latest")) as Block;

    let requestId = 1;
    await expect(
      lockedBankVaults.connect(alice).attackVaults(clanId, bobClanId, EstforConstants.SHARPENED_CLAW, playerId, {
        value: await lockedBankVaults.getAttackCost()
      })
    )
      .to.emit(lockedBankVaults, "SuperAttackCooldown")
      .withArgs(clanId, NOW + 86400 + 1);

    await fulfillRandomWords(requestId, lockedBankVaults, mockVRF);

    // Create a new clan to attack/defend
    const charliePlayerId = await createPlayer(playerNFT, avatarId, charlie, origName + 2, true);
    await clans.connect(charlie).createClan(charliePlayerId, clanName + 2, discord, telegram, twitter, imageId, tierId);

    const charlieClanId = bobClanId + 1;
    await combatantsHelper
      .connect(charlie)
      .assignCombatants(charlieClanId, false, [], true, [charliePlayerId], charliePlayerId);
    await lockFundsForClan(lockedBankVaults, charlieClanId, brush, charlie, charliePlayerId, 1000, territories);

    // Forward by attack cooldown and attack another clan
    await ethers.provider.send("evm_increaseTime", [attackingCooldown]);
    await ethers.provider.send("evm_mine", []);

    // Fails due to cooldown not reached
    await expect(
      lockedBankVaults.connect(alice).attackVaults(clanId, charlieClanId, EstforConstants.SHARPENED_CLAW, playerId, {
        value: await lockedBankVaults.getAttackCost()
      })
    ).to.be.revertedWithCustomError(LockedBankVaultsLibrary, "ClanSuperAttackingCooldown");

    await ethers.provider.send("evm_increaseTime", [item.boostDuration]);
    await ethers.provider.send("evm_mine", []);
    const {timestamp: NOW1} = (await ethers.provider.getBlock("latest")) as Block;
    // Cooldown is now reached
    await expect(
      lockedBankVaults.connect(alice).attackVaults(clanId, charlieClanId, EstforConstants.SHARPENED_CLAW, playerId, {
        value: await lockedBankVaults.getAttackCost()
      })
    )
      .to.emit(lockedBankVaults, "SuperAttackCooldown")
      .withArgs(clanId, NOW1 + 86400 + 1);
  });

  it("Blocking attacks with item", async () => {
    const {
      clans,
      lockedBankVaults,
      LockedBankVaultsLibrary,
      combatantsHelper,
      territories,
      clanId,
      playerId,
      playerNFT,
      itemNFT,
      avatarId,
      origName,
      alice,
      bob,
      clanName,
      discord,
      telegram,
      twitter,
      imageId,
      tierId,
      brush
    } = await loadFixture(clanFixture);

    await lockFundsForClan(lockedBankVaults, clanId, brush, alice, playerId, 1000, territories);

    // Create a new clan to attack/defend
    const bobPlayerId = await createPlayer(playerNFT, avatarId, bob, origName + 1, true);
    await clans.connect(bob).createClan(bobPlayerId, clanName + 1, discord, telegram, twitter, imageId, tierId);
    const bobClanId = clanId + 1;

    // Attack
    await combatantsHelper.connect(bob).assignCombatants(bobClanId, false, [], true, [bobPlayerId], bobPlayerId);

    const items = allItems.filter(
      (inputItem) =>
        inputItem.tokenId == EstforConstants.PROTECTION_SHIELD || inputItem.tokenId == EstforConstants.MIRROR_SHIELD
    );
    await itemNFT.addItems(items);
    await itemNFT.mintBatch(alice, [EstforConstants.PROTECTION_SHIELD, EstforConstants.MIRROR_SHIELD], [2, 1]);

    // Wrong item
    await expect(
      lockedBankVaults.connect(alice).blockAttacks(clanId, EstforConstants.MIRROR_SHIELD, playerId)
    ).to.be.revertedWithCustomError(LockedBankVaultsLibrary, "NotALockedVaultDefenceItem");

    const itemTokenId = EstforConstants.PROTECTION_SHIELD;
    await lockedBankVaults.connect(alice).blockAttacks(clanId, itemTokenId, playerId);
    expect(await itemNFT.balanceOf(alice, itemTokenId)).to.eq(1);

    await expect(
      lockedBankVaults.connect(bob).attackVaults(bobClanId, clanId, 0, bobPlayerId, {
        value: await lockedBankVaults.getAttackCost()
      })
    ).to.be.revertedWithCustomError(LockedBankVaultsLibrary, "ClanIsBlockingAttacks");

    const protectionShield = items.find((item) => item.tokenId == itemTokenId) as ItemInput;
    await ethers.provider.send("evm_increaseTime", [protectionShield.boostDuration - 10]);
    await ethers.provider.send("evm_mine", []);

    await expect(
      lockedBankVaults.connect(bob).attackVaults(bobClanId, clanId, 0, bobPlayerId, {
        value: await lockedBankVaults.getAttackCost()
      })
    ).to.be.revertedWithCustomError(LockedBankVaultsLibrary, "ClanIsBlockingAttacks");

    // Cannot apply again until the cooldown is done
    await expect(
      lockedBankVaults.connect(alice).blockAttacks(clanId, itemTokenId, playerId)
    ).to.be.revertedWithCustomError(LockedBankVaultsLibrary, "BlockAttacksCooldown");
    // Go just before the cooldown is done to confirm
    await ethers.provider.send("evm_increaseTime", [protectionShield.boostValue * 3600]);
    await ethers.provider.send("evm_mine", []);
    await expect(
      lockedBankVaults.connect(alice).blockAttacks(clanId, itemTokenId, playerId)
    ).to.be.revertedWithCustomError(LockedBankVaultsLibrary, "BlockAttacksCooldown");
    // Now extend past the cooldown time
    await ethers.provider.send("evm_increaseTime", [10]);
    await ethers.provider.send("evm_mine", []);
    await lockedBankVaults.connect(alice).blockAttacks(clanId, itemTokenId, playerId);

    await ethers.provider.send("evm_increaseTime", [protectionShield.boostDuration - 10]);
    await ethers.provider.send("evm_mine", []);

    await expect(
      lockedBankVaults.connect(bob).attackVaults(bobClanId, clanId, 0, bobPlayerId, {
        value: await lockedBankVaults.getAttackCost()
      })
    ).to.be.revertedWithCustomError(LockedBankVaultsLibrary, "ClanIsBlockingAttacks");

    await ethers.provider.send("evm_increaseTime", [10]);
    await ethers.provider.send("evm_mine", []);
    await expect(
      lockedBankVaults.connect(bob).attackVaults(bobClanId, clanId, 0, bobPlayerId, {
        value: await lockedBankVaults.getAttackCost()
      })
    ).to.not.be.reverted;

    expect(await itemNFT.balanceOf(alice, itemTokenId)).to.eq(0);
  });

  it("Lose an attack with some locked vaults", async () => {
    const {
      clans,
      lockedBankVaults,
      combatantsHelper,
      territories,
      clanId,
      playerId,
      playerNFT,
      avatarId,
      origName,
      alice,
      bob,
      charlie,
      dev,
      clanName,
      discord,
      telegram,
      twitter,
      imageId,
      tierId,
      brush,
      mockVRF,
      treasury,
      players
    } = await loadFixture(clanFixture);

    await lockFundsForClan(lockedBankVaults, clanId, brush, alice, playerId, 300, territories);
    await lockFundsForClan(lockedBankVaults, clanId, brush, alice, playerId, 200, territories);
    await lockFundsForClan(lockedBankVaults, clanId, brush, alice, playerId, 500, territories);

    await combatantsHelper.connect(alice).assignCombatants(clanId, false, [], true, [playerId], playerId);

    // Create a new clan to attack/defend
    const bobPlayerId = await createPlayer(playerNFT, avatarId, bob, origName + 1, true);
    await clans.connect(bob).createClan(bobPlayerId, clanName + 1, discord, telegram, twitter, imageId, tierId);

    const charliePlayerId = await createPlayer(playerNFT, avatarId, charlie, origName + 2, true);
    const bobClanId = clanId + 1;
    await clans.connect(charlie).requestToJoin(bobClanId, charliePlayerId, 0);
    await clans.connect(bob).acceptJoinRequests(bobClanId, [charliePlayerId], bobPlayerId);

    for (let i = 0; i < allBattleSkills.length; ++i) {
      await players.testModifyXP(bob, bobPlayerId, allBattleSkills[i], getXPFromLevel(100), true);
      await players.testModifyXP(charlie, charliePlayerId, allBattleSkills[i], getXPFromLevel(100), true);
    }

    // Lock
    await lockFundsForClan(lockedBankVaults, bobClanId, brush, bob, bobPlayerId, 800, territories);

    await combatantsHelper.connect(bob).assignCombatants(bobClanId, false, [], true, [bobPlayerId], bobPlayerId);

    expect((await lockedBankVaults.getClanInfo(clanId)).totalBrushLocked).to.eq(1000);

    // Alice's clan attacks but will lose.
    await lockedBankVaults
      .connect(alice)
      .attackVaults(clanId, bobClanId, 0, playerId, {value: await lockedBankVaults.getAttackCost()});
    await fulfillRandomWords(1, lockedBankVaults, mockVRF);

    expect((await lockedBankVaults.getClanInfo(clanId)).totalBrushLocked).to.eq(950); // lost 5%
    expect((await lockedBankVaults.getClanInfo(bobClanId)).totalBrushLocked).to.eq(800);

    // Check it went to the correct places
    expect(await brush.balanceOf(treasury)).to.eq(25);
    expect(await brush.balanceOf(dev)).to.eq(12);
    expect(await brush.amountBurnt()).to.eq(12);
  });

  it("Win an attack with some locked vaults", async () => {
    const {
      clans,
      lockedBankVaults,
      combatantsHelper,
      territories,
      clanId,
      playerId,
      playerNFT,
      avatarId,
      origName,
      alice,
      bob,
      charlie,
      clanName,
      discord,
      telegram,
      twitter,
      imageId,
      tierId,
      brush,
      mockVRF
    } = await loadFixture(clanFixture);

    await lockFundsForClan(lockedBankVaults, clanId, brush, alice, playerId, 300, territories);
    await lockFundsForClan(lockedBankVaults, clanId, brush, alice, playerId, 200, territories);
    await lockFundsForClan(lockedBankVaults, clanId, brush, alice, playerId, 500, territories);

    await combatantsHelper.connect(alice).assignCombatants(clanId, false, [], true, [playerId], playerId);

    // Create a new clan to attack/defend
    const bobPlayerId = await createPlayer(playerNFT, avatarId, bob, origName + 1, true);
    await clans.connect(bob).createClan(bobPlayerId, clanName + 1, discord, telegram, twitter, imageId, tierId);

    const bobClanId = clanId + 1;
    const charliePlayerId = await createPlayer(playerNFT, avatarId, charlie, origName + 2, true);
    await clans.connect(charlie).requestToJoin(bobClanId, charliePlayerId, 0);
    await clans.connect(bob).acceptJoinRequests(bobClanId, [charliePlayerId], bobPlayerId);

    await combatantsHelper
      .connect(bob)
      .assignCombatants(bobClanId, false, [], true, [bobPlayerId, charliePlayerId], bobPlayerId);

    // Bobs's clan attacks and will win.
    await lockedBankVaults
      .connect(bob)
      .attackVaults(bobClanId, clanId, 0, bobPlayerId, {value: await lockedBankVaults.getAttackCost()});
    await fulfillRandomWords(1, lockedBankVaults, mockVRF);

    expect((await lockedBankVaults.getClanInfo(clanId)).totalBrushLocked).to.eq(900); // lost 10%
    expect((await lockedBankVaults.getClanInfo(bobClanId)).totalBrushLocked).to.eq(100);

    // Check totalWon with lockedVault
    expect((await lockedBankVaults.getClanInfo(bobClanId)).defendingVaults[0].amount).to.eq(100);
  });

  it("Try fulfill an attack request id that isn't ongoing", async () => {
    const {
      clans,
      lockedBankVaults,
      combatantsHelper,
      territories,
      clanId,
      playerId,
      playerNFT,
      avatarId,
      origName,
      alice,
      bob,
      clanName,
      discord,
      telegram,
      twitter,
      imageId,
      tierId,
      brush,
      mockVRF
    } = await loadFixture(clanFixture);

    await combatantsHelper.connect(alice).assignCombatants(clanId, false, [], true, [playerId], playerId);

    // Create a new clan to attack
    const bobPlayerId = await createPlayer(playerNFT, avatarId, bob, origName + 1, true);
    await clans.connect(bob).createClan(bobPlayerId, clanName + 1, discord, telegram, twitter, imageId, tierId);
    const bobClanId = clanId + 1;
    await lockFundsForClan(lockedBankVaults, bobClanId, brush, bob, bobPlayerId, 300, territories);

    await lockedBankVaults
      .connect(alice)
      .attackVaults(clanId, clanId + 1, 0, playerId, {value: await lockedBankVaults.getAttackCost()});

    await expect(fulfillRandomWords(3, lockedBankVaults, mockVRF)).to.revertedWithCustomError(
      lockedBankVaults,
      "RequestIdNotKnown"
    );
  });

  it("Claim with a full packed vault but only the first is claimable, the next lock should start a new segment", async () => {
    const {lockedBankVaults, territories, clanId, playerId, alice, brush, lockedFundsPeriod} = await loadFixture(
      clanFixture
    );

    // Get one lock
    await lockFundsForClan(lockedBankVaults, clanId, brush, alice, playerId, 300, territories);
    // Wait a couple days and get another lock
    await ethers.provider.send("evm_increaseTime", [86400 * 2]);
    await ethers.provider.send("evm_mine", []);
    await lockFundsForClan(lockedBankVaults, clanId, brush, alice, playerId, 300, territories);
    // Unlock it
    await ethers.provider.send("evm_increaseTime", [lockedFundsPeriod - 86400 * 2]);
    await ethers.provider.send("evm_mine", []);
    // Claim funds and check the locks are correct
    await lockedBankVaults.connect(alice).claimFunds(clanId, playerId);
    await lockFundsForClan(lockedBankVaults, clanId, brush, alice, playerId, 500, territories);
    expect((await lockedBankVaults.getClanInfo(clanId)).defendingVaults.length).to.eq(2);
  });

  it("When attacksPrevented is enabled no attacks can be done", async () => {
    const {
      clans,
      lockedBankVaults,
      combatantsHelper,
      territories,
      clanId,
      playerId,
      playerNFT,
      avatarId,
      origName,
      alice,
      bob,
      clanName,
      discord,
      telegram,
      twitter,
      imageId,
      tierId,
      brush
    } = await loadFixture(clanFixture);

    await combatantsHelper.connect(alice).assignCombatants(clanId, false, [], true, [playerId], playerId);

    // Create a new clan to attack
    const bobPlayerId = await createPlayer(playerNFT, avatarId, bob, origName + 1, true);
    await clans.connect(bob).createClan(bobPlayerId, clanName + 1, discord, telegram, twitter, imageId, tierId);
    const bobClanId = clanId + 1;
    await lockFundsForClan(lockedBankVaults, bobClanId, brush, bob, bobPlayerId, 300, territories);
    await lockedBankVaults.setPreventAttacks(true);
    await expect(
      lockedBankVaults
        .connect(alice)
        .attackVaults(clanId, clanId + 1, 0, playerId, {value: await lockedBankVaults.getAttackCost()})
    ).to.be.revertedWithCustomError(lockedBankVaults, "AttacksPrevented");
    await lockedBankVaults.setPreventAttacks(false);
    await expect(
      lockedBankVaults
        .connect(alice)
        .attackVaults(clanId, clanId + 1, 0, playerId, {value: await lockedBankVaults.getAttackCost()})
    ).to.not.be.reverted;
  });

  it("Cannot attack a clan twice within the cooldown", async () => {});

  it("Player has an attack cooldown if transferring to another clan", async () => {});

  it("Player has a defending cooldown if transferring to another clan", async () => {});

  it("Lock funds on a non-existent clan", async () => {});

  describe("MMR", function () {
    it("Inserting should prioritise the clan that was already there (higher rank)", async () => {
      const {
        clans,
        lockedBankVaults,
        territories,
        clanId,
        playerId,
        playerNFT,
        avatarId,
        origName,
        alice,
        bob,
        clanName,
        discord,
        telegram,
        twitter,
        imageId,
        tierId,
        brush
      } = await loadFixture(clanFixture);

      await lockFundsForClan(lockedBankVaults, clanId, brush, alice, playerId, 1000, territories);

      // Create a new clan to attack/defend
      const bobPlayerId = await createPlayer(playerNFT, avatarId, bob, origName + 1, true);
      await clans.connect(bob).createClan(bobPlayerId, clanName + 1, discord, telegram, twitter, imageId, tierId);
      const bobClanId = 2;

      await lockFundsForClan(lockedBankVaults, bobClanId, brush, alice, playerId, 1000, territories);

      expect(await lockedBankVaults.getSortedMMR()).to.deep.eq([500, 500]);
      expect(await lockedBankVaults.getSortedClanIdsByMMR()).to.deep.eq([bobClanId, clanId]);
    });

    it("Check MMRs update", async () => {
      const {
        clans,
        lockedBankVaults,
        combatantsHelper,
        territories,
        clanId,
        playerId,
        playerNFT,
        avatarId,
        origName,
        alice,
        bob,
        charlie,
        clanName,
        discord,
        telegram,
        twitter,
        imageId,
        tierId,
        brush,
        mockVRF
      } = await loadFixture(clanFixture);

      await lockFundsForClan(lockedBankVaults, clanId, brush, alice, playerId, 1000, territories);

      await combatantsHelper.connect(alice).assignCombatants(clanId, false, [], true, [playerId], playerId);

      // Create a new clan to attack/defend
      const bobPlayerId = await createPlayer(playerNFT, avatarId, bob, origName + 1, true);
      await clans.connect(bob).createClan(bobPlayerId, clanName + 1, discord, telegram, twitter, imageId, tierId);

      const bobClanId = clanId + 1;
      const charliePlayerId = await createPlayer(playerNFT, avatarId, charlie, origName + 2, true);
      await clans.connect(charlie).requestToJoin(bobClanId, charliePlayerId, 0);
      await clans.connect(bob).acceptJoinRequests(bobClanId, [charliePlayerId], bobPlayerId);

      // Attack
      await combatantsHelper
        .connect(bob)
        .assignCombatants(bobClanId, false, [], true, [bobPlayerId, charliePlayerId], bobPlayerId);

      expect(await lockedBankVaults.getSortedMMR()).to.deep.eq([500]);
      expect(await lockedBankVaults.getSortedClanIdsByMMR()).to.deep.eq([clanId]);
      expect(await clans.getMMR(clanId)).to.eq(500);
      expect(await clans.getMMR(bobClanId)).to.eq(500);

      await lockedBankVaults
        .connect(bob)
        .attackVaults(bobClanId, clanId, 0, bobPlayerId, {value: await lockedBankVaults.getAttackCost()});
      await fulfillRandomWords(1, lockedBankVaults, mockVRF);
      // Should win as they have more players
      expect((await lockedBankVaults.getClanInfo(clanId)).totalBrushLocked).to.eq(900);

      // MMRs should be updated
      expect(await clans.getMMR(clanId)).to.eq(499);
      expect(await clans.getMMR(bobClanId)).to.eq(501);

      expect(await lockedBankVaults.getSortedMMR()).to.deep.eq([499, 501]);
      expect(await lockedBankVaults.getSortedClanIdsByMMR()).to.deep.eq([clanId, bobClanId]);

      expect((await lockedBankVaults.getClanInfo(clanId)).isInMMRArray).to.be.true;
      expect((await lockedBankVaults.getClanInfo(bobClanId)).isInMMRArray).to.be.true;
    });

    it("Check MMRs update, multiple clans and multiple things", async () => {
      const {
        clans,
        lockedBankVaults,
        combatantsHelper,
        territories,
        clanId,
        playerId,
        playerNFT,
        avatarId,
        origName,
        alice,
        bob,
        charlie,
        erin,
        frank,
        clanName,
        discord,
        telegram,
        twitter,
        imageId,
        tierId,
        brush,
        mockVRF,
        lockedFundsPeriod,
        players
      } = await loadFixture(clanFixture);

      await lockFundsForClan(lockedBankVaults, clanId, brush, alice, playerId, 1000, territories);

      await combatantsHelper.connect(alice).assignCombatants(clanId, false, [], true, [playerId], playerId);

      // Create a new clan to attack/defend with 2 members
      const bobPlayerId = await createPlayer(playerNFT, avatarId, bob, origName + 1, true);
      await clans.connect(bob).createClan(bobPlayerId, clanName + 1, discord, telegram, twitter, imageId, tierId);
      const bobClanId = clanId + 1;
      const charliePlayerId = await createPlayer(playerNFT, avatarId, charlie, origName + 2, true);
      await clans.connect(charlie).requestToJoin(bobClanId, charliePlayerId, 0);
      await clans.connect(bob).acceptJoinRequests(bobClanId, [charliePlayerId], bobPlayerId);

      await combatantsHelper
        .connect(bob)
        .assignCombatants(bobClanId, false, [], true, [bobPlayerId, charliePlayerId], bobPlayerId);

      // Create a new clan to attack/defend
      const erinPlayerId = await createPlayer(playerNFT, avatarId, erin, origName + 3, true);
      await clans.connect(erin).createClan(erinPlayerId, clanName + 2, discord, telegram, twitter, imageId, tierId);
      const erinClanId = clanId + 2;

      const frankPlayerId = await createPlayer(playerNFT, avatarId, frank, origName + 4, true);
      await clans.connect(frank).createClan(frankPlayerId, clanName + 3, discord, telegram, twitter, imageId, tierId);
      const frankClanId = clanId + 3;

      // Increase odds of winning by maxing out their stats
      for (let i = 0; i < allBattleSkills.length; ++i) {
        await players.testModifyXP(bob, bobPlayerId, allBattleSkills[i], getXPFromLevel(100), true);
        await players.testModifyXP(charlie, charliePlayerId, allBattleSkills[i], getXPFromLevel(100), true);
        await players.testModifyXP(erin, erinPlayerId, allBattleSkills[i], getXPFromLevel(100), true);
        await players.testModifyXP(frank, frankPlayerId, allBattleSkills[i], getXPFromLevel(100), true);
      }

      await combatantsHelper.connect(erin).assignCombatants(erinClanId, false, [], true, [erinPlayerId], erinPlayerId);

      await combatantsHelper
        .connect(frank)
        .assignCombatants(frankClanId, false, [], true, [frankPlayerId], frankPlayerId);

      expect(await lockedBankVaults.getSortedMMR()).to.deep.eq([500]);
      expect(await lockedBankVaults.getSortedClanIdsByMMR()).to.deep.eq([clanId]);
      expect(await clans.getMMR(clanId)).to.eq(500);
      expect(await clans.getMMR(bobClanId)).to.eq(500);
      expect(await clans.getMMR(erinClanId)).to.eq(500);
      expect(await clans.getMMR(frankClanId)).to.eq(500);

      await lockedBankVaults
        .connect(bob)
        .attackVaults(bobClanId, clanId, 0, bobPlayerId, {value: await lockedBankVaults.getAttackCost()});
      await fulfillRandomWords(1, lockedBankVaults, mockVRF);
      // Bob wins against alice (more likely at least)
      expect((await lockedBankVaults.getClanInfo(clanId)).totalBrushLocked).to.eq(900);

      // MMRs should be updated
      expect(await clans.getMMR(clanId)).to.eq(499);
      expect(await clans.getMMR(bobClanId)).to.eq(501);
      expect(await clans.getMMR(erinClanId)).to.eq(500);
      expect(await clans.getMMR(frankClanId)).to.eq(500);

      expect(await lockedBankVaults.getSortedMMR()).to.deep.eq([499, 501]);
      expect(await lockedBankVaults.getSortedClanIdsByMMR()).to.deep.eq([clanId, bobClanId]);

      await lockedBankVaults
        .connect(erin)
        .attackVaults(erinClanId, clanId, 0, erinPlayerId, {value: await lockedBankVaults.getAttackCost()});
      await fulfillRandomWords(2, lockedBankVaults, mockVRF);
      // Erin wins against alice (more likely at least)
      expect((await lockedBankVaults.getClanInfo(clanId)).totalBrushLocked).to.eq(810);

      expect(await lockedBankVaults.getSortedMMR()).to.deep.eq([498, 501, 501]);
      expect(await lockedBankVaults.getSortedClanIdsByMMR()).to.deep.eq([clanId, erinClanId, bobClanId]);

      await lockFundsForClan(lockedBankVaults, frankClanId, brush, alice, playerId, 1000, territories);

      expect(await lockedBankVaults.getSortedMMR()).to.deep.eq([498, 500, 501, 501]);
      expect(await lockedBankVaults.getSortedClanIdsByMMR()).to.deep.eq([clanId, frankClanId, erinClanId, bobClanId]);

      // MMRs should be updated
      expect(await clans.getMMR(clanId)).to.eq(498);
      expect(await clans.getMMR(bobClanId)).to.eq(501);
      expect(await clans.getMMR(erinClanId)).to.eq(501);

      expect((await lockedBankVaults.getClanInfo(clanId)).isInMMRArray).to.be.true;
      expect((await lockedBankVaults.getClanInfo(bobClanId)).isInMMRArray).to.be.true;
      expect((await lockedBankVaults.getClanInfo(erinClanId)).isInMMRArray).to.be.true;
      expect((await lockedBankVaults.getClanInfo(frankClanId)).isInMMRArray).to.be.true;

      await lockedBankVaults.clearCooldowns(erinClanId, [clanId]);

      await lockedBankVaults
        .connect(erin)
        .attackVaults(erinClanId, clanId, 0, erinPlayerId, {value: await lockedBankVaults.getAttackCost()});
      await fulfillRandomWords(3, lockedBankVaults, mockVRF);
      // Erin wins against alice (most likely)
      expect(await lockedBankVaults.getSortedMMR()).to.deep.eq([497, 500, 501, 502]);
      expect(await lockedBankVaults.getSortedClanIdsByMMR()).to.deep.eq([clanId, frankClanId, bobClanId, erinClanId]);

      // MMRs should be updated
      expect(await clans.getMMR(clanId)).to.eq(497);
      expect(await clans.getMMR(bobClanId)).to.eq(501);
      expect(await clans.getMMR(erinClanId)).to.eq(502);
      expect(await clans.getMMR(frankClanId)).to.eq(500);

      // Alice attacks erin and loses
      await lockedBankVaults
        .connect(alice)
        .attackVaults(clanId, erinClanId, 0, playerId, {value: await lockedBankVaults.getAttackCost()});
      await fulfillRandomWords(4, lockedBankVaults, mockVRF);

      expect(await lockedBankVaults.getSortedMMR()).to.deep.eq([496, 500, 501, 503]);
      expect(await lockedBankVaults.getSortedClanIdsByMMR()).to.deep.eq([clanId, frankClanId, bobClanId, erinClanId]);

      // Alice attacks frank and loses
      await lockedBankVaults.clearCooldowns(clanId, []);
      await lockedBankVaults
        .connect(alice)
        .attackVaults(clanId, frankClanId, 0, playerId, {value: await lockedBankVaults.getAttackCost()});
      await fulfillRandomWords(5, lockedBankVaults, mockVRF);
      expect(await lockedBankVaults.getSortedMMR()).to.deep.eq([495, 501, 501, 503]);
      expect(await lockedBankVaults.getSortedClanIdsByMMR()).to.deep.eq([clanId, frankClanId, bobClanId, erinClanId]);

      // Claim them all
      await ethers.provider.send("evm_increaseTime", [lockedFundsPeriod]);
      await ethers.provider.send("evm_mine", []);

      await lockedBankVaults.connect(alice).claimFunds(clanId, playerId);
      await lockedBankVaults.connect(frank).claimFunds(frankClanId, frankPlayerId);

      expect(await clans.getMMR(clanId)).to.eq(495);
      expect(await clans.getMMR(bobClanId)).to.eq(501);
      expect(await clans.getMMR(erinClanId)).to.eq(503);
      expect(await clans.getMMR(frankClanId)).to.eq(501);

      expect(await lockedBankVaults.getSortedMMR()).to.deep.eq([501, 503]);
      expect(await lockedBankVaults.getSortedClanIdsByMMR()).to.deep.eq([bobClanId, erinClanId]);

      await lockFundsForClan(lockedBankVaults, clanId, brush, alice, playerId, 1000, territories);

      const idleClanIds = await lockedBankVaults.getIdleClans();
      expect(idleClanIds).to.deep.eq([bobClanId, erinClanId]);

      await expect(lockedBankVaults.forceMMRUpdate([clanId, bobClanId, erinClanId]))
        .to.emit(lockedBankVaults, "ForceMMRUpdate")
        .withArgs([bobClanId, erinClanId]);

      expect(await lockedBankVaults.getSortedMMR()).to.deep.eq([495]);
      expect(await lockedBankVaults.getSortedClanIdsByMMR()).to.deep.eq([clanId]);
    });

    it("Win, then lose, then win, lose, lose", async () => {
      const {
        clans,
        lockedBankVaults,
        combatantsHelper,
        territories,
        clanId,
        playerId,
        playerNFT,
        avatarId,
        origName,
        alice,
        bob,
        charlie,
        frank,
        clanName,
        discord,
        telegram,
        twitter,
        imageId,
        tierId,
        brush,
        mockVRF,
        players
      } = await loadFixture(clanFixture);

      await combatantsHelper.connect(alice).assignCombatants(clanId, false, [], true, [playerId], playerId);

      // Create a new clan to attack/defend
      const bobPlayerId = await createPlayer(playerNFT, avatarId, bob, origName + 1, true);
      await clans.connect(bob).createClan(bobPlayerId, clanName + 1, discord, telegram, twitter, imageId, tierId);

      const bobClanId = clanId + 1;
      await combatantsHelper.connect(bob).assignCombatants(bobClanId, false, [], true, [bobPlayerId], bobPlayerId);
      await lockFundsForClan(lockedBankVaults, bobClanId, brush, bob, bobPlayerId, 1000, territories);

      for (let i = 0; i < allBattleSkills.length; ++i) {
        await players.testModifyXP(alice, playerId, allBattleSkills[i], getXPFromLevel(100), true);
      }

      expect(await lockedBankVaults.getSortedClanIdsByMMR()).to.deep.eq([bobClanId]);

      // Win
      await lockedBankVaults.connect(alice).attackVaults(clanId, bobClanId, EstforConstants.NONE, playerId, {
        value: await lockedBankVaults.getAttackCost()
      });
      let requestId = 1;
      await fulfillRandomWords(requestId++, lockedBankVaults, mockVRF);

      expect(await lockedBankVaults.getSortedMMR()).to.deep.eq([499, 501]);
      expect(await lockedBankVaults.getSortedClanIdsByMMR()).to.deep.eq([bobClanId, clanId]);

      // Lose (make the other clan have 2 more combatant)
      const charliePlayerId = await createPlayer(playerNFT, avatarId, charlie, origName + 2, true);
      await clans.connect(charlie).requestToJoin(bobClanId, charliePlayerId, 0);
      await clans.connect(bob).acceptJoinRequests(bobClanId, [charliePlayerId], bobPlayerId);

      const frankPlayerId = await createPlayer(playerNFT, avatarId, frank, origName + 3, true);
      await clans.connect(frank).requestToJoin(bobClanId, frankPlayerId, 0);
      await clans.connect(bob).acceptJoinRequests(bobClanId, [frankPlayerId], bobPlayerId);

      await combatantsHelper.clearCooldowns([bobPlayerId]);
      await lockedBankVaults.clearCooldowns(clanId, [bobClanId]);
      await lockedBankVaults.clearCooldowns(bobClanId, []);

      await combatantsHelper
        .connect(bob)
        .assignCombatants(bobClanId, false, [], true, [bobPlayerId, charliePlayerId, frankPlayerId], bobPlayerId);
      for (let i = 0; i < allBattleSkills.length; ++i) {
        await players.testModifyXP(bob, bobPlayerId, allBattleSkills[i], getXPFromLevel(100), true);
        await players.testModifyXP(charlie, charliePlayerId, allBattleSkills[i], getXPFromLevel(100), true);
        await players.testModifyXP(frank, frankPlayerId, allBattleSkills[i], getXPFromLevel(100), true);
      }
      await lockedBankVaults.connect(alice).attackVaults(clanId, bobClanId, EstforConstants.NONE, playerId, {
        value: await lockedBankVaults.getAttackCost()
      });
      await fulfillRandomWords(requestId++, lockedBankVaults, mockVRF);

      expect(await lockedBankVaults.getSortedMMR()).to.deep.eq([500, 500]);
      expect(await lockedBankVaults.getSortedClanIdsByMMR()).to.deep.eq([bobClanId, clanId]);

      // Win
      await combatantsHelper.clearCooldowns([bobPlayerId]);
      await lockedBankVaults.clearCooldowns(clanId, [bobClanId]);
      await lockedBankVaults.clearCooldowns(bobClanId, []);
      await combatantsHelper.connect(bob).assignCombatants(bobClanId, false, [], true, [], bobPlayerId);

      await lockedBankVaults.connect(alice).attackVaults(clanId, bobClanId, EstforConstants.NONE, playerId, {
        value: await lockedBankVaults.getAttackCost()
      });
      await fulfillRandomWords(requestId++, lockedBankVaults, mockVRF);

      expect(await clans.getMMR(clanId)).to.eq(501);
      expect(await clans.getMMR(bobClanId)).to.eq(499);
      expect(await lockedBankVaults.getSortedMMR()).to.deep.eq([499, 501]);
      expect(await lockedBankVaults.getSortedClanIdsByMMR()).to.deep.eq([bobClanId, clanId]);

      // Lose
      await combatantsHelper.clearCooldowns([bobPlayerId, charliePlayerId, frankPlayerId]);
      await lockedBankVaults.clearCooldowns(clanId, [bobClanId]);
      await lockedBankVaults.clearCooldowns(bobClanId, []);
      await combatantsHelper
        .connect(bob)
        .assignCombatants(bobClanId, false, [], true, [bobPlayerId, charliePlayerId, frankPlayerId], bobPlayerId);

      await lockedBankVaults.connect(alice).attackVaults(clanId, bobClanId, EstforConstants.NONE, playerId, {
        value: await lockedBankVaults.getAttackCost()
      });
      await fulfillRandomWords(requestId++, lockedBankVaults, mockVRF);
      expect(await lockedBankVaults.getSortedMMR()).to.deep.eq([500, 500]);
      expect(await lockedBankVaults.getSortedClanIdsByMMR()).to.deep.eq([bobClanId, clanId]);

      // Lose
      await lockedBankVaults.clearCooldowns(clanId, [bobClanId]);
      await lockedBankVaults.connect(alice).attackVaults(clanId, bobClanId, EstforConstants.NONE, playerId, {
        value: await lockedBankVaults.getAttackCost()
      });
      await fulfillRandomWords(requestId++, lockedBankVaults, mockVRF);

      expect(await clans.getMMR(clanId)).to.eq(499);
      expect(await clans.getMMR(bobClanId)).to.eq(501);
      expect(await lockedBankVaults.getSortedMMR()).to.deep.eq([499, 501]);
      expect(await lockedBankVaults.getSortedClanIdsByMMR()).to.deep.eq([clanId, bobClanId]);

      // Win vs a clan that has a higher MMR
      await combatantsHelper.clearCooldowns([bobPlayerId, charliePlayerId, frankPlayerId]);
      await lockedBankVaults.clearCooldowns(clanId, [bobClanId]);
      await lockedBankVaults.clearCooldowns(bobClanId, []);
      await combatantsHelper.connect(bob).assignCombatants(bobClanId, false, [], true, [], bobPlayerId);

      await lockedBankVaults.connect(alice).attackVaults(clanId, bobClanId, EstforConstants.NONE, playerId, {
        value: await lockedBankVaults.getAttackCost()
      });
      await fulfillRandomWords(requestId++, lockedBankVaults, mockVRF);

      expect(await clans.getMMR(clanId)).to.eq(500);
      expect(await clans.getMMR(bobClanId)).to.eq(500);
      expect(await lockedBankVaults.getSortedMMR()).to.deep.eq([500, 500]);
      expect(await lockedBankVaults.getSortedClanIdsByMMR()).to.deep.eq([bobClanId, clanId]);
    });

    it("Do an attack and then the clan is deleted for the attacker should not revert", async () => {
      const {
        clans,
        lockedBankVaults,
        combatantsHelper,
        territories,
        clanId,
        playerId,
        playerNFT,
        avatarId,
        origName,
        alice,
        bob,
        clanName,
        discord,
        telegram,
        twitter,
        imageId,
        tierId,
        brush,
        mockVRF,
        players
      } = await loadFixture(clanFixture);

      await lockFundsForClan(lockedBankVaults, clanId, brush, alice, playerId, 1000, territories);

      await combatantsHelper.connect(alice).assignCombatants(clanId, false, [], true, [playerId], playerId);

      // Create a new clan to attack/defend with 2 members
      const bobPlayerId = await createPlayer(playerNFT, avatarId, bob, origName + 1, true);
      await clans.connect(bob).createClan(bobPlayerId, clanName + 1, discord, telegram, twitter, imageId, tierId);
      const bobClanId = clanId + 1;

      await combatantsHelper.connect(bob).assignCombatants(bobClanId, false, [], true, [bobPlayerId], bobPlayerId);

      // Increase odds of winning by maxing out their stats
      for (let i = 0; i < allBattleSkills.length; ++i) {
        await players.testModifyXP(bob, bobPlayerId, allBattleSkills[i], getXPFromLevel(100), true);
      }

      await lockedBankVaults
        .connect(bob)
        .attackVaults(bobClanId, clanId, 0, bobPlayerId, {value: await lockedBankVaults.getAttackCost()});

      // Clan is deleted
      await clans.connect(alice).changeRank(clanId, clanId, ClanRank.NONE, playerId);
      expect(await clans.getClanId(playerId)).to.eq(0);
      await fulfillRandomWords(1, lockedBankVaults, mockVRF);

      expect(await clans.getMMR(clanId)).to.eq(499);
      expect(await clans.getMMR(bobClanId)).to.eq(501);

      expect(await lockedBankVaults.getSortedMMR()).to.deep.eq([499, 501]);
      expect(await lockedBankVaults.getSortedClanIdsByMMR()).to.deep.eq([clanId, bobClanId]);

      const idleClanIds = await lockedBankVaults.getIdleClans();
      expect(idleClanIds).to.deep.eq([clanId]);

      await expect(lockedBankVaults.forceMMRUpdate([clanId]))
        .to.emit(lockedBankVaults, "ForceMMRUpdate")
        .withArgs([clanId]);

      expect(await lockedBankVaults.getSortedMMR()).to.deep.eq([501]);
      expect(await lockedBankVaults.getSortedClanIdsByMMR()).to.deep.eq([bobClanId]);
    });

    it("Do an attack and then the clan is deleted for both attacker and defender should not revert, attacker wins", async () => {
      const {
        clans,
        lockedBankVaults,
        combatantsHelper,
        territories,
        clanId,
        playerId,
        playerNFT,
        avatarId,
        origName,
        alice,
        bob,
        clanName,
        discord,
        telegram,
        twitter,
        imageId,
        tierId,
        brush,
        mockVRF,
        players
      } = await loadFixture(clanFixture);

      await lockFundsForClan(lockedBankVaults, clanId, brush, alice, playerId, 1000, territories);

      await combatantsHelper.connect(alice).assignCombatants(clanId, false, [], true, [playerId], playerId);

      // Create a new clan to attack/defend with 2 members
      const bobPlayerId = await createPlayer(playerNFT, avatarId, bob, origName + 1, true);
      await clans.connect(bob).createClan(bobPlayerId, clanName + 1, discord, telegram, twitter, imageId, tierId);
      const bobClanId = clanId + 1;

      await combatantsHelper.connect(bob).assignCombatants(bobClanId, false, [], true, [bobPlayerId], bobPlayerId);

      // Increase odds of winning by maxing out their stats
      for (let i = 0; i < allBattleSkills.length; ++i) {
        await players.testModifyXP(bob, bobPlayerId, allBattleSkills[i], getXPFromLevel(100), true);
      }

      await lockedBankVaults
        .connect(bob)
        .attackVaults(bobClanId, clanId, 0, bobPlayerId, {value: await lockedBankVaults.getAttackCost()});

      // Both clans are deleted
      await clans.connect(alice).changeRank(clanId, playerId, ClanRank.NONE, playerId);
      await clans.connect(bob).changeRank(bobClanId, bobPlayerId, ClanRank.NONE, bobPlayerId);
      expect(await clans.getClanId(playerId)).to.eq(0);
      await fulfillRandomWords(1, lockedBankVaults, mockVRF);

      expect(await clans.getMMR(clanId)).to.eq(498); // MMR for this clan gets updated as it is still in the ranking
      expect(await clans.getMMR(bobClanId)).to.eq(2); // Attacker will win due to drawing

      expect(await lockedBankVaults.getSortedMMR()).to.deep.eq([2, 498]);
      expect(await lockedBankVaults.getSortedClanIdsByMMR()).to.deep.eq([bobClanId, clanId]);

      // getIdleClans also takes into account
      const idleClanIds = await lockedBankVaults.getIdleClans();
      expect(idleClanIds).to.deep.eq([bobClanId, clanId]);

      await expect(lockedBankVaults.forceMMRUpdate([clanId, bobClanId]))
        .to.emit(lockedBankVaults, "ForceMMRUpdate")
        .withArgs([clanId, bobClanId]);

      expect(await lockedBankVaults.getSortedMMR()).to.deep.eq([]);
      expect(await lockedBankVaults.getSortedClanIdsByMMR()).to.deep.eq([]);
    });

    it("Do an attack and the clan no longer has any locked funds, don't claim funds", async () => {
      const {
        clans,
        lockedBankVaults,
        combatantsHelper,
        territories,
        clanId,
        playerId,
        playerNFT,
        avatarId,
        origName,
        alice,
        bob,
        clanName,
        discord,
        telegram,
        twitter,
        imageId,
        tierId,
        brush,
        mockVRF,
        lockedFundsPeriod
      } = await loadFixture(clanFixture);

      await lockFundsForClan(lockedBankVaults, clanId, brush, alice, playerId, 1000, territories);

      await combatantsHelper.connect(alice).assignCombatants(clanId, false, [], true, [playerId], playerId);

      // Create a new clan to attack/defend with 2 members
      const bobPlayerId = await createPlayer(playerNFT, avatarId, bob, origName + 1, true);
      await clans.connect(bob).createClan(bobPlayerId, clanName + 1, discord, telegram, twitter, imageId, tierId);
      const bobClanId = clanId + 1;

      await combatantsHelper.connect(bob).assignCombatants(bobClanId, false, [], true, [bobPlayerId], bobPlayerId);

      await lockedBankVaults
        .connect(bob)
        .attackVaults(bobClanId, clanId, 0, bobPlayerId, {value: await lockedBankVaults.getAttackCost()});

      await ethers.provider.send("evm_increaseTime", [lockedFundsPeriod + 1]);
      await ethers.provider.send("evm_mine", []);

      // Both clans are deleted
      await fulfillRandomWords(1, lockedBankVaults, mockVRF);

      expect(await clans.getMMR(clanId)).to.eq(499);
      expect(await clans.getMMR(bobClanId)).to.eq(501); // Attacker will win due to drawing

      expect(await lockedBankVaults.getSortedMMR()).to.deep.eq([499, 501]);
      expect(await lockedBankVaults.getSortedClanIdsByMMR()).to.deep.eq([clanId, bobClanId]);

      const idleClanIds = await lockedBankVaults.getIdleClans();
      expect(idleClanIds).to.deep.eq([clanId, bobClanId]);

      await expect(lockedBankVaults.forceMMRUpdate([clanId, bobClanId]))
        .to.emit(lockedBankVaults, "ForceMMRUpdate")
        .withArgs([clanId, bobClanId]);

      expect(await lockedBankVaults.getSortedMMR()).to.deep.eq([]);
      expect(await lockedBankVaults.getSortedClanIdsByMMR()).to.deep.eq([]);
    });

    it("Do an attack and the clan no longer has any locked funds, claim the funds", async () => {
      const {
        clans,
        lockedBankVaults,
        combatantsHelper,
        territories,
        clanId,
        playerId,
        playerNFT,
        avatarId,
        origName,
        alice,
        bob,
        clanName,
        discord,
        telegram,
        twitter,
        imageId,
        tierId,
        brush,
        mockVRF,
        lockedFundsPeriod
      } = await loadFixture(clanFixture);

      await lockFundsForClan(lockedBankVaults, clanId, brush, alice, playerId, 1000, territories);

      await combatantsHelper.connect(alice).assignCombatants(clanId, false, [], true, [playerId], playerId);

      // Create a new clan to attack/defend with 2 members
      const bobPlayerId = await createPlayer(playerNFT, avatarId, bob, origName + 1, true);
      await clans.connect(bob).createClan(bobPlayerId, clanName + 1, discord, telegram, twitter, imageId, tierId);
      const bobClanId = clanId + 1;

      await combatantsHelper.connect(bob).assignCombatants(bobClanId, false, [], true, [bobPlayerId], bobPlayerId);

      await lockedBankVaults
        .connect(bob)
        .attackVaults(bobClanId, clanId, 0, bobPlayerId, {value: await lockedBankVaults.getAttackCost()});

      await ethers.provider.send("evm_increaseTime", [lockedFundsPeriod + 1]);
      await ethers.provider.send("evm_mine", []);
      await lockedBankVaults.connect(alice).claimFunds(clanId, playerId);

      // Both clans are deleted
      await fulfillRandomWords(1, lockedBankVaults, mockVRF);

      expect(await clans.getMMR(clanId)).to.eq(499);
      expect(await clans.getMMR(bobClanId)).to.eq(501); // Attacker will win due to drawing

      expect(await lockedBankVaults.getSortedMMR()).to.deep.eq([501]); // Still gets the points for winning
      expect(await lockedBankVaults.getSortedClanIdsByMMR()).to.deep.eq([bobClanId]);

      const idleClanIds = await lockedBankVaults.getIdleClans();
      expect(idleClanIds).to.deep.eq([bobClanId]);

      await expect(lockedBankVaults.forceMMRUpdate([clanId, bobClanId]))
        .to.emit(lockedBankVaults, "ForceMMRUpdate")
        .withArgs([bobClanId]);

      expect(await lockedBankVaults.getSortedMMR()).to.deep.eq([]);
      expect(await lockedBankVaults.getSortedClanIdsByMMR()).to.deep.eq([]);
    });

    it("Must attack within range", async () => {
      const {
        clans,
        lockedBankVaults,
        LockedBankVaultsLibrary,
        combatantsHelper,
        territories,
        clanId,
        playerId,
        playerNFT,
        avatarId,
        origName,
        alice,
        bob,
        charlie,
        erin,
        frank,
        clanName,
        discord,
        telegram,
        twitter,
        imageId,
        tierId,
        brush,
        mockVRF,
        players
      } = await loadFixture(clanFixture);

      await lockFundsForClan(lockedBankVaults, clanId, brush, alice, playerId, 1000, territories);

      await combatantsHelper.connect(alice).assignCombatants(clanId, false, [], true, [playerId], playerId);

      // Create a new clan to attack/defend with 2 members
      const bobPlayerId = await createPlayer(playerNFT, avatarId, bob, origName + 1, true);
      await clans.connect(bob).createClan(bobPlayerId, clanName + 1, discord, telegram, twitter, imageId, tierId);
      const bobClanId = clanId + 1;
      const charliePlayerId = await createPlayer(playerNFT, avatarId, charlie, origName + 2, true);
      await clans.connect(charlie).requestToJoin(bobClanId, charliePlayerId, 0);
      await clans.connect(bob).acceptJoinRequests(bobClanId, [charliePlayerId], bobPlayerId);

      await combatantsHelper
        .connect(bob)
        .assignCombatants(bobClanId, false, [], true, [bobPlayerId, charliePlayerId], bobPlayerId);

      // Create a new clan to attack/defend
      const erinPlayerId = await createPlayer(playerNFT, avatarId, erin, origName + 3, true);
      await clans.connect(erin).createClan(erinPlayerId, clanName + 2, discord, telegram, twitter, imageId, tierId);
      const erinClanId = clanId + 2;

      const frankPlayerId = await createPlayer(playerNFT, avatarId, frank, origName + 4, true);
      await clans.connect(frank).createClan(frankPlayerId, clanName + 3, discord, telegram, twitter, imageId, tierId);
      const frankClanId = clanId + 3;

      // Increase odds of winning by maxing out their stats
      for (let i = 0; i < allBattleSkills.length; ++i) {
        await players.testModifyXP(bob, bobPlayerId, allBattleSkills[i], getXPFromLevel(100), true);
        await players.testModifyXP(charlie, charliePlayerId, allBattleSkills[i], getXPFromLevel(100), true);
        await players.testModifyXP(erin, erinPlayerId, allBattleSkills[i], getXPFromLevel(100), true);
        await players.testModifyXP(frank, frankPlayerId, allBattleSkills[i], getXPFromLevel(100), true);
      }

      await combatantsHelper.connect(erin).assignCombatants(erinClanId, false, [], true, [erinPlayerId], erinPlayerId);

      await combatantsHelper
        .connect(frank)
        .assignCombatants(frankClanId, false, [], true, [frankPlayerId], frankPlayerId);

      expect(await lockedBankVaults.getSortedMMR()).to.deep.eq([500]);
      expect(await lockedBankVaults.getSortedClanIdsByMMR()).to.deep.eq([clanId]);
      expect(await clans.getMMR(clanId)).to.eq(500);
      expect(await clans.getMMR(bobClanId)).to.eq(500);
      expect(await clans.getMMR(erinClanId)).to.eq(500);
      expect(await clans.getMMR(frankClanId)).to.eq(500);

      await lockedBankVaults
        .connect(bob)
        .attackVaults(bobClanId, clanId, 0, bobPlayerId, {value: await lockedBankVaults.getAttackCost()});
      await fulfillRandomWords(1, lockedBankVaults, mockVRF);
      // Bob wins against alice (more likely at least)
      expect((await lockedBankVaults.getClanInfo(clanId)).totalBrushLocked).to.eq(900);

      // MMRs should be updated
      expect(await clans.getMMR(clanId)).to.eq(499);
      expect(await clans.getMMR(bobClanId)).to.eq(501);
      expect(await clans.getMMR(erinClanId)).to.eq(500);
      expect(await clans.getMMR(frankClanId)).to.eq(500);

      expect(await lockedBankVaults.getSortedMMR()).to.deep.eq([499, 501]);
      expect(await lockedBankVaults.getSortedClanIdsByMMR()).to.deep.eq([clanId, bobClanId]);

      await lockedBankVaults
        .connect(erin)
        .attackVaults(erinClanId, clanId, 0, erinPlayerId, {value: await lockedBankVaults.getAttackCost()});
      await fulfillRandomWords(2, lockedBankVaults, mockVRF);
      // Erin wins again alice (more likely at least)
      expect((await lockedBankVaults.getClanInfo(clanId)).totalBrushLocked).to.eq(810);

      expect(await lockedBankVaults.getSortedMMR()).to.deep.eq([498, 501, 501]);
      expect(await lockedBankVaults.getSortedClanIdsByMMR()).to.deep.eq([clanId, erinClanId, bobClanId]);

      await lockFundsForClan(lockedBankVaults, frankClanId, brush, alice, playerId, 1000, territories);

      expect(await lockedBankVaults.getSortedMMR()).to.deep.eq([498, 500, 501, 501]);
      expect(await lockedBankVaults.getSortedClanIdsByMMR()).to.deep.eq([clanId, frankClanId, erinClanId, bobClanId]);

      // Change attack distance to 1
      await lockedBankVaults.setMMRAttackDistance(1);

      // frank can attack alice due to duplicate MMRs at the edge, so don't try
      // Attack at both extremes as well, alice cannot attack erin
      await expect(
        lockedBankVaults
          .connect(alice)
          .attackVaults(clanId, erinClanId, 0, playerId, {value: await lockedBankVaults.getAttackCost()})
      ).to.be.revertedWithCustomError(LockedBankVaultsLibrary, "OutsideMMRRange");

      await lockedBankVaults.clearCooldowns(erinClanId, [clanId]);

      // Erin cannot attack clanId
      await expect(
        lockedBankVaults
          .connect(erin)
          .attackVaults(erinClanId, clanId, 0, erinPlayerId, {value: await lockedBankVaults.getAttackCost()})
      ).to.be.revertedWithCustomError(LockedBankVaultsLibrary, "OutsideMMRRange");

      // Erin can attack frank.
      await lockedBankVaults.clearCooldowns(erinClanId, []);
      await combatantsHelper.clearCooldowns([frankPlayerId]);
      await lockedBankVaults.clearCooldowns(frankClanId, []);
      await combatantsHelper.connect(frank).assignCombatants(frankClanId, false, [], true, [], frankPlayerId);

      await lockedBankVaults
        .connect(erin)
        .attackVaults(erinClanId, frankClanId, 0, erinPlayerId, {value: await lockedBankVaults.getAttackCost()});
      await fulfillRandomWords(3, lockedBankVaults, mockVRF);
      expect(await lockedBankVaults.getSortedMMR()).to.deep.eq([498, 499, 501, 502]);
      expect(await lockedBankVaults.getSortedClanIdsByMMR()).to.deep.eq([clanId, frankClanId, bobClanId, erinClanId]);
    });

    it("Attacking & defending hits the same MMR, check ordering", async () => {
      const {
        clans,
        lockedBankVaults,
        combatantsHelper,
        territories,
        clanId,
        playerId,
        playerNFT,
        avatarId,
        origName,
        alice,
        bob,
        clanName,
        discord,
        telegram,
        twitter,
        imageId,
        tierId,
        brush,
        mockVRF,
        players
      } = await loadFixture(clanFixture);

      await lockFundsForClan(lockedBankVaults, clanId, brush, alice, playerId, 1000, territories);
      await combatantsHelper.connect(alice).assignCombatants(clanId, false, [], true, [playerId], playerId);

      // Create a new clan to attack/defend between each other
      const bobPlayerId = await createPlayer(playerNFT, avatarId, bob, origName + 1, true);
      await clans.connect(bob).createClan(bobPlayerId, clanName + 1, discord, telegram, twitter, imageId, tierId);
      const bobClanId = clanId + 1;
      await combatantsHelper.connect(bob).assignCombatants(bobClanId, false, [], true, [bobPlayerId], bobPlayerId);

      // Increase odds of winning by maxing out their stats
      for (let i = 0; i < allBattleSkills.length; ++i) {
        await players.testModifyXP(bob, bobPlayerId, allBattleSkills[i], getXPFromLevel(100), true);
      }

      // Attacker wins (most likely)
      await lockedBankVaults
        .connect(bob)
        .attackVaults(bobClanId, clanId, 0, bobPlayerId, {value: await lockedBankVaults.getAttackCost()});
      await fulfillRandomWords(1, lockedBankVaults, mockVRF);

      expect(await lockedBankVaults.getSortedMMR()).to.deep.eq([499, 501]);
      expect(await lockedBankVaults.getSortedClanIdsByMMR()).to.deep.eq([clanId, bobClanId]);

      // Now loses, as bob had a MMR he should have higher rank?
      // Remove combatants
      await combatantsHelper.clearCooldowns([bobPlayerId]);
      await lockedBankVaults.clearCooldowns(bobClanId, []);
      await combatantsHelper.connect(bob).assignCombatants(bobClanId, false, [], true, [], bobPlayerId);

      await lockedBankVaults
        .connect(alice)
        .attackVaults(clanId, bobClanId, 0, playerId, {value: await lockedBankVaults.getAttackCost()});
      await fulfillRandomWords(2, lockedBankVaults, mockVRF);

      expect(await lockedBankVaults.getSortedMMR()).to.deep.eq([500, 500]);
      expect(await lockedBankVaults.getSortedClanIdsByMMR()).to.deep.eq([bobClanId, clanId]);

      // Attacker loses (most likely)
      // Well first win so that MMRs are different
      await lockedBankVaults.clearCooldowns(clanId, [bobClanId]);
      await lockedBankVaults
        .connect(alice)
        .attackVaults(clanId, bobClanId, 0, playerId, {value: await lockedBankVaults.getAttackCost()});
      await fulfillRandomWords(3, lockedBankVaults, mockVRF);

      expect(await lockedBankVaults.getSortedMMR()).to.deep.eq([499, 501]);
      expect(await lockedBankVaults.getSortedClanIdsByMMR()).to.deep.eq([bobClanId, clanId]);

      // Now lose (most likely)
      await combatantsHelper.clearCooldowns([bobPlayerId]);
      await lockedBankVaults.clearCooldowns(bobClanId, []);
      await combatantsHelper.connect(bob).assignCombatants(bobClanId, false, [], true, [bobPlayerId], bobPlayerId);
      await lockedBankVaults.clearCooldowns(clanId, [bobClanId]);
      await lockedBankVaults
        .connect(alice)
        .attackVaults(clanId, bobClanId, 0, playerId, {value: await lockedBankVaults.getAttackCost()});
      await fulfillRandomWords(4, lockedBankVaults, mockVRF);

      expect(await lockedBankVaults.getSortedMMR()).to.deep.eq([500, 500]);
      expect(await lockedBankVaults.getSortedClanIdsByMMR()).to.deep.eq([bobClanId, clanId]); // Attacker is higher rank even if losing
    });

    it("Force updating MMR should correctly cleanse any initialized clans which do not have any locked vaults", async () => {
      const {lockedBankVaults, territories, clanId, playerId, alice, brush} = await loadFixture(clanFixture);

      await lockFundsForClan(lockedBankVaults, clanId, brush, alice, playerId, 1000, territories);

      const clanIds = [1, 2, 3, 4];
      const mmrs = [1000, 2000, 3000, 4000];
      const clear = true;
      await lockedBankVaults.initializeMMR(clanIds, mmrs, clear);

      expect(await lockedBankVaults.getSortedMMR()).to.deep.eq([1000, 2000, 3000, 4000]);
      expect(await lockedBankVaults.getSortedClanIdsByMMR()).to.deep.eq([1, 2, 3, 4]);

      const idleClans = [...(await lockedBankVaults.getIdleClans())];
      expect(idleClans).to.deep.eq([2, 3, 4]);
      await lockedBankVaults.forceMMRUpdate(idleClans);

      expect(await lockedBankVaults.getSortedMMR()).to.deep.eq([1000]);
      expect(await lockedBankVaults.getSortedClanIdsByMMR()).to.deep.eq([clanId]);
    });

    it("Force updating MMR should correctly cleanse any initialized clans which do not have any locked vaults, multiple gaps", async () => {
      const {
        clans,
        lockedBankVaults,
        territories,
        playerId,
        clanId,
        owner,
        alice,
        bob,
        charlie,
        dev,
        erin,
        frank,
        brush,
        playerNFT,
        avatarId
      } = await loadFixture(clanFixture);

      const signers = [owner, bob, charlie, dev, erin, frank];
      for (const signer of signers) {
        const playerId = await createPlayer(playerNFT, avatarId, signer, signer.address.slice(2, 10), true);
        await clans.connect(signer).createClan(playerId, signer.address.slice(2, 10), "", "", "", 2, 1);
      }

      // alice is 1, owner is 2
      await lockFundsForClan(lockedBankVaults, clanId, brush, alice, playerId, 1000, territories);
      // owner and bob get nothing
      await lockFundsForClan(lockedBankVaults, clanId + 3, brush, alice, playerId, 1000, territories);
      // dev and erin get nothing
      await lockFundsForClan(lockedBankVaults, clanId + 6, brush, alice, playerId, 1000, territories);

      const clanIds = [1, 2, 3, 4, 5, 6, 7];
      const mmrs = [500, 500, 500, 500, 500, 500, 500];
      const clear = true;
      await lockedBankVaults.initializeMMR(clanIds, mmrs, clear);

      expect(await lockedBankVaults.getSortedClanIdsByMMR()).to.deep.eq([7, 6, 5, 4, 3, 2, 1]);

      const idleClans = await lockedBankVaults.getIdleClans();
      expect(idleClans).to.deep.eq([6, 5, 3, 2]);
      await lockedBankVaults.forceMMRUpdate([3, 5, 6, 2]); // Try in a different order

      expect(await lockedBankVaults.getSortedMMR()).to.deep.eq([500, 500, 500]);
      expect(await lockedBankVaults.getSortedClanIdsByMMR()).to.deep.eq([7, 4, 1]);
    });

    it("Try not clearing with initializeMMR", async () => {
      const {lockedBankVaults, territories, clanId, playerId, alice, brush} = await loadFixture(clanFixture);

      await lockFundsForClan(lockedBankVaults, clanId, brush, alice, playerId, 1000, territories);

      let clanIds = [1, 2, 3, 4];
      let mmrs = [1000, 2000, 3000, 4000];
      let clear = true;
      await lockedBankVaults.initializeMMR(clanIds, mmrs, clear);

      expect(await lockedBankVaults.getSortedMMR()).to.deep.eq([1000, 2000, 3000, 4000]);
      expect(await lockedBankVaults.getSortedClanIdsByMMR()).to.deep.eq([1, 2, 3, 4]);

      clear = false;
      clanIds = [7, 8];
      mmrs = [1000, 2000];
      await lockedBankVaults.initializeMMR(clanIds, mmrs, clear);
      expect(await lockedBankVaults.getSortedMMR()).to.deep.eq([1000, 1000, 2000, 2000, 3000, 4000]);
      expect(await lockedBankVaults.getSortedClanIdsByMMR()).to.deep.eq([7, 1, 8, 2, 3, 4]);
    });

    it("Gas used getIdleClans() for many clans should be below max", async () => {
      const {lockedBankVaults} = await loadFixture(clanFixture);

      const clanIds = [...Array(100).keys()].map((i) => i + 1);
      const mmrs = clanIds;
      const clear = false;
      let tx = await lockedBankVaults.initializeMMR(clanIds, mmrs, clear);
      let receipt = await tx.wait();
      expect(receipt?.gasUsed).to.be.below(6000000n);

      const idleClans = [...(await lockedBankVaults.getIdleClans())];
      tx = await lockedBankVaults.forceMMRUpdate(idleClans);
      receipt = await tx.wait();
      expect(receipt?.gasUsed).to.be.below(6000000n);
    });

    it("Attacking a clan where the defender has 0 MMR, and attacker wins", async () => {
      const {
        clans,
        lockedBankVaults,
        combatantsHelper,
        territories,
        clanId,
        playerId,
        playerNFT,
        avatarId,
        origName,
        alice,
        bob,
        clanName,
        discord,
        telegram,
        twitter,
        imageId,
        tierId,
        brush,
        mockVRF,
        players
      } = await loadFixture(clanFixture);

      await lockFundsForClan(lockedBankVaults, clanId, brush, alice, playerId, 1000, territories);
      await combatantsHelper.connect(alice).assignCombatants(clanId, false, [], true, [playerId], playerId);

      // Create a new clan to attack/defend between each other
      const bobPlayerId = await createPlayer(playerNFT, avatarId, bob, origName + 1, true);
      await clans.connect(bob).createClan(bobPlayerId, clanName + 1, discord, telegram, twitter, imageId, tierId);
      const bobClanId = clanId + 1;
      await combatantsHelper.connect(bob).assignCombatants(bobClanId, false, [], true, [bobPlayerId], bobPlayerId);

      // Increase odds of winning by maxing out their stats
      for (let i = 0; i < allBattleSkills.length; ++i) {
        await players.testModifyXP(bob, bobPlayerId, allBattleSkills[i], getXPFromLevel(100), true);
      }

      let clear = true;
      await lockedBankVaults.initializeMMR([clanId], [0], clear);
      await lockedBankVaults.setKValues(32, 32);
      expect(await lockedBankVaults.getSortedClanIdsByMMR()).to.deep.eq([clanId]);
      expect(await lockedBankVaults.getSortedMMR()).to.deep.eq([0]);

      // Attacker wins (most likely)
      await lockedBankVaults
        .connect(bob)
        .attackVaults(bobClanId, clanId, 0, bobPlayerId, {value: await lockedBankVaults.getAttackCost()});
      await fulfillRandomWords(1, lockedBankVaults, mockVRF);

      expect(await lockedBankVaults.getSortedMMR()).to.deep.eq([0, 501]);
      expect(await lockedBankVaults.getSortedClanIdsByMMR()).to.deep.eq([clanId, bobClanId]);
    });

    it("Attacking a clan where the defender has 0 MMR, and attacker loses", async () => {
      const {
        clans,
        lockedBankVaults,
        combatantsHelper,
        territories,
        clanId,
        playerId,
        playerNFT,
        avatarId,
        origName,
        alice,
        bob,
        clanName,
        discord,
        telegram,
        twitter,
        imageId,
        tierId,
        brush,
        mockVRF,
        players
      } = await loadFixture(clanFixture);

      await lockFundsForClan(lockedBankVaults, clanId, brush, alice, playerId, 1000, territories);
      await combatantsHelper.connect(alice).assignCombatants(clanId, false, [], true, [playerId], playerId);

      // Create a new clan to attack/defend between each other
      const bobPlayerId = await createPlayer(playerNFT, avatarId, bob, origName + 1, true);
      await clans.connect(bob).createClan(bobPlayerId, clanName + 1, discord, telegram, twitter, imageId, tierId);
      const bobClanId = clanId + 1;
      await combatantsHelper.connect(bob).assignCombatants(bobClanId, false, [], true, [bobPlayerId], bobPlayerId);

      // Increase odds of winning by maxing out their stats
      for (let i = 0; i < allBattleSkills.length; ++i) {
        await players.testModifyXP(alice, playerId, allBattleSkills[i], getXPFromLevel(100), true);
      }

      let clear = true;
      await lockedBankVaults.initializeMMR([clanId, bobClanId], [0, 500], clear);
      await lockedBankVaults.setKValues(32, 32);

      // Attacker loses (most likely)
      await lockedBankVaults
        .connect(bob)
        .attackVaults(bobClanId, clanId, 0, bobPlayerId, {value: await lockedBankVaults.getAttackCost()});
      await fulfillRandomWords(1, lockedBankVaults, mockVRF);

      expect(await lockedBankVaults.getSortedMMR()).to.deep.eq([30n, 470n]);
      expect(await lockedBankVaults.getSortedClanIdsByMMR()).to.deep.eq([clanId, bobClanId]);
    });

    it("Attacking a clan where the attacker has 0 MMR, and attacker wins", async () => {
      const {
        clans,
        lockedBankVaults,
        combatantsHelper,
        territories,
        clanId,
        playerId,
        playerNFT,
        avatarId,
        origName,
        alice,
        bob,
        clanName,
        discord,
        telegram,
        twitter,
        imageId,
        tierId,
        brush,
        mockVRF,
        players
      } = await loadFixture(clanFixture);

      await lockFundsForClan(lockedBankVaults, clanId, brush, alice, playerId, 1000, territories);
      await combatantsHelper.connect(alice).assignCombatants(clanId, false, [], true, [playerId], playerId);

      // Create a new clan to attack/defend between each other
      const bobPlayerId = await createPlayer(playerNFT, avatarId, bob, origName + 1, true);
      await clans.connect(bob).createClan(bobPlayerId, clanName + 1, discord, telegram, twitter, imageId, tierId);
      const bobClanId = clanId + 1;
      await combatantsHelper.connect(bob).assignCombatants(bobClanId, false, [], true, [bobPlayerId], bobPlayerId);

      // Increase odds of winning by maxing out their stats
      for (let i = 0; i < allBattleSkills.length; ++i) {
        await players.testModifyXP(bob, bobPlayerId, allBattleSkills[i], getXPFromLevel(100), true);
      }

      let clear = false;
      await lockedBankVaults.initializeMMR([bobClanId], [0], clear);

      await lockedBankVaults.setKValues(32, 32);

      // Attacker wins (most likely)
      await lockedBankVaults
        .connect(bob)
        .attackVaults(bobClanId, clanId, 0, bobPlayerId, {value: await lockedBankVaults.getAttackCost()});
      await fulfillRandomWords(1, lockedBankVaults, mockVRF);

      expect(await lockedBankVaults.getSortedMMR()).to.deep.eq([30, 470]);
      expect(await lockedBankVaults.getSortedClanIdsByMMR()).to.deep.eq([bobClanId, clanId]);
    });

    it("Attacking a clan where the attacker has 0 MMR, and attacker loses", async () => {
      const {
        clans,
        lockedBankVaults,
        combatantsHelper,
        territories,
        clanId,
        playerId,
        playerNFT,
        avatarId,
        origName,
        alice,
        bob,
        clanName,
        discord,
        telegram,
        twitter,
        imageId,
        tierId,
        brush,
        mockVRF,
        players
      } = await loadFixture(clanFixture);

      await lockFundsForClan(lockedBankVaults, clanId, brush, alice, playerId, 1000, territories);
      await combatantsHelper.connect(alice).assignCombatants(clanId, false, [], true, [playerId], playerId);

      // Create a new clan to attack/defend between each other
      const bobPlayerId = await createPlayer(playerNFT, avatarId, bob, origName + 1, true);
      await clans.connect(bob).createClan(bobPlayerId, clanName + 1, discord, telegram, twitter, imageId, tierId);
      const bobClanId = clanId + 1;
      await combatantsHelper.connect(bob).assignCombatants(bobClanId, false, [], true, [bobPlayerId], bobPlayerId);

      // Increase odds of winning by maxing out their stats
      for (let i = 0; i < allBattleSkills.length; ++i) {
        await players.testModifyXP(alice, playerId, allBattleSkills[i], getXPFromLevel(100), true);
      }

      let clear = false;
      await lockedBankVaults.initializeMMR([bobClanId], [0], clear);
      expect(await lockedBankVaults.getSortedMMR()).to.deep.eq([0, 500]);
      expect(await lockedBankVaults.getSortedClanIdsByMMR()).to.deep.eq([bobClanId, clanId]);

      await lockedBankVaults.setKValues(32, 32);

      // Attacker loses (most likely)
      await lockedBankVaults
        .connect(bob)
        .attackVaults(bobClanId, clanId, 0, bobPlayerId, {value: await lockedBankVaults.getAttackCost()});
      await fulfillRandomWords(1, lockedBankVaults, mockVRF);

      expect(await lockedBankVaults.getSortedMMR()).to.deep.eq([0, 501]);
      expect(await lockedBankVaults.getSortedClanIdsByMMR()).to.deep.eq([bobClanId, clanId]);
    });

    it("Attacking should not modify the MMR arrays if the attacker is not in the ranking yet", async () => {
      const {
        clans,
        lockedBankVaults,
        combatantsHelper,
        territories,
        clanId,
        playerId,
        playerNFT,
        avatarId,
        origName,
        alice,
        bob,
        clanName,
        discord,
        telegram,
        twitter,
        imageId,
        tierId,
        brush,
        players
      } = await loadFixture(clanFixture);

      await lockFundsForClan(lockedBankVaults, clanId, brush, alice, playerId, 1000, territories);
      await combatantsHelper.connect(alice).assignCombatants(clanId, false, [], true, [playerId], playerId);

      // Create a new clan to attack/defend between each other
      const bobPlayerId = await createPlayer(playerNFT, avatarId, bob, origName + 1, true);
      await clans.connect(bob).createClan(bobPlayerId, clanName + 1, discord, telegram, twitter, imageId, tierId);
      const bobClanId = clanId + 1;
      await combatantsHelper.connect(bob).assignCombatants(bobClanId, false, [], true, [bobPlayerId], bobPlayerId);

      // Increase odds of winning by maxing out their stats
      for (let i = 0; i < allBattleSkills.length; ++i) {
        await players.testModifyXP(bob, bobPlayerId, allBattleSkills[i], getXPFromLevel(100), true);
      }

      let clear = true;
      await lockedBankVaults.initializeMMR([clanId], [0], clear);
      await lockedBankVaults.setKValues(32, 32);
      expect(await lockedBankVaults.getSortedClanIdsByMMR()).to.deep.eq([clanId]);
      expect(await lockedBankVaults.getSortedMMR()).to.deep.eq([0]);

      // Attacker wins (most likely)
      await lockedBankVaults
        .connect(bob)
        .attackVaults(bobClanId, clanId, 0, bobPlayerId, {value: await lockedBankVaults.getAttackCost()});

      expect(await lockedBankVaults.getSortedMMR()).to.deep.eq([0]);
      expect(await lockedBankVaults.getSortedClanIdsByMMR()).to.deep.eq([clanId]);
    });

    it("Attacking should not modify the MMR arrays if the attacker loses and is not in the ranking yet", async () => {
      const {
        clans,
        lockedBankVaults,
        combatantsHelper,
        territories,
        clanId,
        playerId,
        playerNFT,
        avatarId,
        origName,
        alice,
        bob,
        clanName,
        discord,
        telegram,
        twitter,
        imageId,
        tierId,
        brush,
        players
      } = await loadFixture(clanFixture);

      await lockFundsForClan(lockedBankVaults, clanId, brush, alice, playerId, 1000, territories);
      await combatantsHelper.connect(alice).assignCombatants(clanId, false, [], true, [playerId], playerId);

      // Create a new clan to attack/defend between each other
      const bobPlayerId = await createPlayer(playerNFT, avatarId, bob, origName + 1, true);
      await clans.connect(bob).createClan(bobPlayerId, clanName + 1, discord, telegram, twitter, imageId, tierId);
      const bobClanId = clanId + 1;
      await combatantsHelper.connect(bob).assignCombatants(bobClanId, false, [], true, [bobPlayerId], bobPlayerId);

      // Increase odds of winning by maxing out their stats
      for (let i = 0; i < allBattleSkills.length; ++i) {
        await players.testModifyXP(alice, playerId, allBattleSkills[i], getXPFromLevel(100), true);
      }

      // Attacker loses (most likely)
      await lockedBankVaults
        .connect(bob)
        .attackVaults(bobClanId, clanId, 0, bobPlayerId, {value: await lockedBankVaults.getAttackCost()});

      let clanInfo = await lockedBankVaults.getClanInfo(clanId);
      expect(clanInfo.isInMMRArray).to.eq(true);
      clanInfo = await lockedBankVaults.getClanInfo(bobClanId);
      expect(clanInfo.isInMMRArray).to.eq(false);
    });

    it("TODO - Test attacking vaults with a clan not in the ranking and which has a higher index that the attacking clan", async () => {});
  });
});
