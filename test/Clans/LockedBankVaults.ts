import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {expect} from "chai";
import {clanFixture} from "./utils";
import {createPlayer} from "../../scripts/utils";
import {ClanRank, ItemInput, LockedBankVault} from "@paintswap/estfor-definitions/types";
import {ethers} from "hardhat";
import {LockedBankVaults, MockBrushToken, Territories} from "../../typechain-types";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {fulfillRandomWords} from "../utils";
import {BigNumber, Contract} from "ethers";
import {allBattleSkills} from "../../scripts/data/territories";
import {getXPFromLevel} from "../Players/utils";
import {allItems} from "../../scripts/data/items";
import {EstforConstants} from "@paintswap/estfor-definitions";

const lockFundsForClan = async (
  lockedBankVaults: LockedBankVaults,
  clanId: number,
  brush: MockBrushToken,
  alice: SignerWithAddress,
  playerId: BigNumber,
  amount: number,
  territories: Territories,
  combatantsHelper: Contract
) => {
  await brush.mint(alice.address, amount);
  await brush.connect(alice).approve(lockedBankVaults.address, amount);
  await lockedBankVaults.setAddresses(alice.address, combatantsHelper.address); // Set it to alice so we can lock funds
  await lockedBankVaults.connect(alice).lockFunds(clanId, alice.address, playerId, amount);
  await lockedBankVaults.setAddresses(territories.address, combatantsHelper.address); // Set it back after locking funds
};

describe("LockedBankVaults", function () {
  it("Lock funds", async () => {
    const {lockedBankVaults, clanId, playerId, alice, brush, combatantsHelper} = await loadFixture(clanFixture);

    await brush.mint(alice.address, 1000);
    await brush.connect(alice).approve(lockedBankVaults.address, 1000);
    await lockedBankVaults.setAddresses(alice.address, combatantsHelper.address);
    await lockedBankVaults.connect(alice).lockFunds(clanId, alice.address, playerId, 400);
    expect(await brush.balanceOf(alice.address)).to.eq(600);
    expect(await brush.balanceOf(lockedBankVaults.address)).to.eq(400);
    expect((await lockedBankVaults.getClanInfo(clanId)).totalBrushLocked).to.eq(400);
  });

  it("Only territories contract can lock funds", async () => {
    const {lockedBankVaults, clanId, playerId, alice, brush} = await loadFixture(clanFixture);

    await brush.mint(alice.address, 100);
    await brush.connect(alice).approve(lockedBankVaults.address, 100);
    await expect(
      lockedBankVaults.connect(alice).lockFunds(clanId, alice.address, playerId, 100)
    ).to.be.revertedWithCustomError(lockedBankVaults, "OnlyTerritories");
  });

  it("Cannot attack your own clan", async function () {
    const {lockedBankVaults, LockedBankVaultsLibrary, combatantsHelper, territories, clanId, playerId, brush, alice} =
      await loadFixture(clanFixture);

    await lockFundsForClan(lockedBankVaults, clanId, brush, alice, playerId, 400, territories, combatantsHelper);
    await combatantsHelper.connect(alice).assignCombatants(clanId, false, [], true, [playerId], playerId);

    await expect(
      lockedBankVaults
        .connect(alice)
        .attackVaults(clanId, clanId, 0, playerId, {value: await lockedBankVaults.attackCost()})
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
      clans,
    } = await loadFixture(clanFixture);

    await lockFundsForClan(lockedBankVaults, clanId, brush, alice, playerId, 400, territories, combatantsHelper);

    const ownerPlayerId = await createPlayer(playerNFT, avatarId, owner, origName + 1, true);
    await clans.requestToJoin(clanId, ownerPlayerId, 0);
    await clans.connect(alice).acceptJoinRequest(clanId, ownerPlayerId, playerId);

    await combatantsHelper
      .connect(alice)
      .assignCombatants(clanId, false, [], true, [playerId, ownerPlayerId], playerId);
    expect((await lockedBankVaults.getClanInfo(clanId)).playerIds).to.deep.eq([playerId, ownerPlayerId]);
    await clans.changeRank(clanId, ownerPlayerId, ClanRank.NONE, ownerPlayerId);
    expect((await lockedBankVaults.getClanInfo(clanId)).playerIds).to.deep.eq([playerId]);
  });

  it("Cannot only change combatants after the cooldown change deadline has passed", async function () {
    const {lockedBankVaults, combatantsHelper, clanId, playerId, alice, MIN_PLAYER_COMBANTANTS_CHANGE_COOLDOWN} =
      await loadFixture(clanFixture);

    await combatantsHelper.connect(alice).assignCombatants(clanId, false, [], true, [playerId], playerId);
    // Clear player id part so we can hit the custom error we want
    await combatantsHelper.clearCooldowns([playerId]);

    await expect(
      combatantsHelper.connect(alice).assignCombatants(clanId, false, [], true, [playerId], playerId)
    ).to.be.revertedWithCustomError(lockedBankVaults, "ClanCombatantsChangeCooldown");

    await ethers.provider.send("evm_increaseTime", [MIN_PLAYER_COMBANTANTS_CHANGE_COOLDOWN - 5]);
    await expect(
      combatantsHelper.connect(alice).assignCombatants(clanId, false, [], true, [playerId], playerId)
    ).to.be.revertedWithCustomError(lockedBankVaults, "ClanCombatantsChangeCooldown");
    await ethers.provider.send("evm_increaseTime", [5]);
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
      mockSWVRFOracleClient,
      LOCK_PERIOD,
    } = await loadFixture(clanFixture);

    await lockFundsForClan(lockedBankVaults, clanId, brush, alice, playerId, 1000, territories, combatantsHelper);
    const {timestamp: NOW} = await ethers.provider.getBlock("latest");

    await combatantsHelper.connect(alice).assignCombatants(clanId, false, [], true, [playerId], playerId);

    // Create a new clan to attack/defend
    const bobPlayerId = await createPlayer(playerNFT, avatarId, bob, origName + 1, true);
    await clans.connect(bob).createClan(bobPlayerId, clanName + 1, discord, telegram, twitter, imageId, tierId);

    const bobClanId = clanId + 1;
    const charliePlayerId = await createPlayer(playerNFT, avatarId, charlie, origName + 2, true);
    await clans.connect(charlie).requestToJoin(bobClanId, charliePlayerId, 0);
    await clans.connect(bob).acceptJoinRequest(bobClanId, charliePlayerId, bobPlayerId);

    // Attack
    await combatantsHelper
      .connect(bob)
      .assignCombatants(bobClanId, false, [], true, [bobPlayerId, charliePlayerId], bobPlayerId);
    await lockedBankVaults
      .connect(bob)
      .attackVaults(bobClanId, clanId, 0, bobPlayerId, {value: await lockedBankVaults.attackCost()});
    await fulfillRandomWords(1, lockedBankVaults, mockSWVRFOracleClient);
    const {timestamp: NOW1} = await ethers.provider.getBlock("latest");
    // Should win as they have more players
    expect((await lockedBankVaults.getClanInfo(clanId)).totalBrushLocked).to.eq(900);
    expect((await lockedBankVaults.getClanInfo(bobClanId)).totalBrushLocked).to.eq(100);

    expect((await lockedBankVaults.getClanInfo(clanId)).defendingVaults.length).to.eq(1);
    expect((await lockedBankVaults.getClanInfo(clanId)).defendingVaults[0].amount).to.eq(900);
    expect((await lockedBankVaults.getClanInfo(clanId)).defendingVaults[0].timestamp).to.eq(NOW + LOCK_PERIOD - 1);

    expect((await lockedBankVaults.getClanInfo(bobClanId)).defendingVaults.length).to.eq(1);
    expect((await lockedBankVaults.getClanInfo(bobClanId)).defendingVaults[0].amount).to.eq(100);
    expect((await lockedBankVaults.getClanInfo(bobClanId)).defendingVaults[0].timestamp).to.eq(NOW1 + LOCK_PERIOD);
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
      brush,
    } = await loadFixture(clanFixture);

    await lockFundsForClan(lockedBankVaults, clanId, brush, alice, playerId, 1000, territories, combatantsHelper);

    await combatantsHelper.connect(alice).assignCombatants(clanId, false, [], true, [playerId], playerId);

    // Create a new clan to attack/defend
    const bobPlayerId = await createPlayer(playerNFT, avatarId, bob, origName + 1, true);
    await clans.connect(bob).createClan(bobPlayerId, clanName + 1, discord, telegram, twitter, imageId, tierId);

    const bobClanId = clanId + 1;
    const charliePlayerId = await createPlayer(playerNFT, avatarId, charlie, origName + 2, true);
    await clans.connect(charlie).requestToJoin(bobClanId, charliePlayerId, 0);
    await clans.connect(bob).acceptJoinRequest(bobClanId, charliePlayerId, bobPlayerId);

    // Cannot attack unless have combatants specified
    await expect(
      lockedBankVaults
        .connect(bob)
        .attackVaults(bobClanId, clanId, 0, bobPlayerId, {value: await lockedBankVaults.attackCost()})
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
      mockSWVRFOracleClient,
      LOCK_PERIOD,
      ATTACKING_COOLDOWN,
      MIN_PLAYER_COMBANTANTS_CHANGE_COOLDOWN,
      players,
    } = await loadFixture(clanFixture);

    await lockFundsForClan(lockedBankVaults, clanId, brush, alice, playerId, 1000, territories, combatantsHelper);
    const {timestamp: NOW} = await ethers.provider.getBlock("latest");

    await combatantsHelper.connect(alice).assignCombatants(clanId, false, [], true, [playerId], playerId);

    // Create a new clan to attack/defend
    const bobPlayerId = await createPlayer(playerNFT, avatarId, bob, origName + 1, true);
    await clans.connect(bob).createClan(bobPlayerId, clanName + 1, discord, telegram, twitter, imageId, tierId);

    const bobClanId = clanId + 1;
    const charliePlayerId = await createPlayer(playerNFT, avatarId, charlie, origName + 2, true);
    await clans.connect(charlie).requestToJoin(bobClanId, charliePlayerId, 0);
    await clans.connect(bob).acceptJoinRequest(bobClanId, charliePlayerId, bobPlayerId);
    // Increase odds of winning
    for (let i = 0; i < allBattleSkills.length; ++i) {
      await players.testModifyXP(bob.address, bobPlayerId, allBattleSkills[i], getXPFromLevel(100), true);
    }

    for (let i = 0; i < allBattleSkills.length; ++i) {
      await players.testModifyXP(charlie.address, charliePlayerId, allBattleSkills[i], getXPFromLevel(100), true);
    }

    // Attack
    await combatantsHelper
      .connect(bob)
      .assignCombatants(bobClanId, false, [], true, [bobPlayerId, charliePlayerId], bobPlayerId);
    await lockedBankVaults
      .connect(bob)
      .attackVaults(bobClanId, clanId, 0, bobPlayerId, {value: await lockedBankVaults.attackCost()});
    await fulfillRandomWords(1, lockedBankVaults, mockSWVRFOracleClient);
    expect((await lockedBankVaults.getClanInfo(clanId)).totalBrushLocked).to.eq(900);
    expect((await lockedBankVaults.getClanInfo(bobClanId)).totalBrushLocked).to.eq(100);
    const {timestamp: NOW1} = await ethers.provider.getBlock("latest");

    // Alice's clan can attack back because they haven't attacked anything yet but will lose.
    await lockedBankVaults
      .connect(alice)
      .attackVaults(clanId, bobClanId, 0, playerId, {value: await lockedBankVaults.attackCost()});
    await fulfillRandomWords(2, lockedBankVaults, mockSWVRFOracleClient);
    expect((await lockedBankVaults.getClanInfo(clanId)).totalBrushLocked).to.eq(855); // lost 5% for losing
    expect((await lockedBankVaults.getClanInfo(bobClanId)).totalBrushLocked).to.eq(100); // // unchanged

    // Let's give them more players so they can win
    const ownerPlayerId = await createPlayer(playerNFT, avatarId, owner, origName + 3, true);
    await clans.requestToJoin(clanId, ownerPlayerId, 0);
    await clans.connect(alice).acceptJoinRequest(clanId, ownerPlayerId, playerId);

    const erinPlayerId = await createPlayer(playerNFT, avatarId, erin, origName + 4, true);
    await clans.connect(erin).requestToJoin(clanId, erinPlayerId, 0);
    await clans.connect(alice).acceptJoinRequest(clanId, erinPlayerId, playerId);
    // Extend member capacity
    await clans.editTiers([
      {
        id: 1,
        maxMemberCapacity: 4,
        maxBankCapacity: 3,
        maxImageId: 16,
        price: 0,
        minimumAge: 0,
      },
    ]);

    const frankPlayerId = await createPlayer(playerNFT, avatarId, frank, origName + 5, true);
    await clans.connect(frank).requestToJoin(clanId, frankPlayerId, 0);
    await clans.connect(alice).acceptJoinRequest(clanId, frankPlayerId, playerId);

    // But have to wait for the cooldown and not just the generic attack cooldown, the same clan attacking cooldown
    await expect(
      lockedBankVaults
        .connect(alice)
        .attackVaults(clanId, bobClanId, 0, playerId, {value: await lockedBankVaults.attackCost()})
    ).to.be.revertedWithCustomError(LockedBankVaultsLibrary, "ClanAttackingCooldown");

    await ethers.provider.send("evm_increaseTime", [ATTACKING_COOLDOWN]);
    await expect(
      lockedBankVaults
        .connect(alice)
        .attackVaults(clanId, bobClanId, 0, playerId, {value: await lockedBankVaults.attackCost()})
    ).to.be.revertedWithCustomError(LockedBankVaultsLibrary, "ClanAttackingSameClanCooldown");

    await ethers.provider.send("evm_increaseTime", [MIN_PLAYER_COMBANTANTS_CHANGE_COOLDOWN]);

    await combatantsHelper
      .connect(alice)
      .assignCombatants(clanId, false, [], true, [playerId, ownerPlayerId, erinPlayerId, frankPlayerId], playerId);
    await lockedBankVaults
      .connect(alice)
      .attackVaults(clanId, bobClanId, 0, playerId, {value: await lockedBankVaults.attackCost()});
    await fulfillRandomWords(3, lockedBankVaults, mockSWVRFOracleClient);
    const {timestamp: NOW2} = await ethers.provider.getBlock("latest");

    // Wait another day (check it's not just the clan cooldown)
    expect((await lockedBankVaults.getClanInfo(clanId)).totalBrushLocked).to.eq(855 + 10);
    expect((await lockedBankVaults.getClanInfo(bobClanId)).totalBrushLocked).to.eq(90);

    expect((await lockedBankVaults.getClanInfo(clanId)).defendingVaults.length).to.eq(1);
    expect((await lockedBankVaults.getClanInfo(clanId)).defendingVaults[0].amount).to.eq(855);
    expect((await lockedBankVaults.getClanInfo(clanId)).defendingVaults[0].timestamp).to.eq(NOW + LOCK_PERIOD - 1);
    expect((await lockedBankVaults.getClanInfo(clanId)).defendingVaults[0].amount1).to.eq(10);
    expect((await lockedBankVaults.getClanInfo(clanId)).defendingVaults[0].timestamp1).to.eq(NOW2 + LOCK_PERIOD);

    expect((await lockedBankVaults.getClanInfo(bobClanId)).defendingVaults.length).to.eq(1);
    expect((await lockedBankVaults.getClanInfo(bobClanId)).defendingVaults[0].amount).to.eq(90);
    expect((await lockedBankVaults.getClanInfo(bobClanId)).defendingVaults[0].timestamp).to.eq(NOW1 + LOCK_PERIOD);
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
      combatantsHelper,
      LOCK_PERIOD,
    } = await loadFixture(clanFixture);

    await lockFundsForClan(lockedBankVaults, clanId, brush, alice, playerId, 1000, territories, combatantsHelper);
    const lockPeriodSlice = LOCK_PERIOD / 10;

    await ethers.provider.send("evm_increaseTime", [lockPeriodSlice]);
    await lockFundsForClan(lockedBankVaults, clanId, brush, alice, playerId, 300, territories, combatantsHelper);
    await ethers.provider.send("evm_increaseTime", [lockPeriodSlice]);
    await lockFundsForClan(lockedBankVaults, clanId, brush, alice, playerId, 450, territories, combatantsHelper);

    // Nothing to claim
    await expect(lockedBankVaults.connect(alice).claimFunds(clanId, playerId)).to.be.revertedWithCustomError(
      LockedBankVaultsLibrary,
      "NothingToClaim"
    );
    await ethers.provider.send("evm_increaseTime", [lockPeriodSlice * 7]);
    await expect(lockedBankVaults.connect(alice).claimFunds(clanId, playerId)).to.be.revertedWithCustomError(
      LockedBankVaultsLibrary,
      "NothingToClaim"
    );
    await ethers.provider.send("evm_increaseTime", [lockPeriodSlice]);
    // Can now claim
    await lockedBankVaults.connect(alice).claimFunds(clanId, playerId);
    expect(await brush.balanceOf(bankAddress)).to.eq(1000);
    expect(await brush.balanceOf(lockedBankVaults.address)).to.eq(750);
    // Cannot claim twice
    await expect(lockedBankVaults.connect(alice).claimFunds(clanId, playerId)).to.be.revertedWithCustomError(
      LockedBankVaultsLibrary,
      "NothingToClaim"
    );
    await ethers.provider.send("evm_increaseTime", [lockPeriodSlice]);
    await ethers.provider.send("evm_increaseTime", [lockPeriodSlice]);
    // Claim both
    await lockedBankVaults.connect(alice).claimFunds(clanId, playerId);
    expect(await brush.balanceOf(bankAddress)).to.eq(1750);
    expect(await brush.balanceOf(lockedBankVaults.address)).to.eq(0);
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
      mockSWVRFOracleClient,
    } = await loadFixture(clanFixture);

    await lockFundsForClan(lockedBankVaults, clanId, brush, alice, playerId, 1000, territories, combatantsHelper);

    await combatantsHelper.connect(alice).assignCombatants(clanId, false, [], true, [playerId], playerId);

    // Create a new clan to attack/defend
    const bobPlayerId = await createPlayer(playerNFT, avatarId, bob, origName + 1, true);
    await clans.connect(bob).createClan(bobPlayerId, clanName + 1, discord, telegram, twitter, imageId, tierId);

    const bobClanId = clanId + 1;
    const charliePlayerId = await createPlayer(playerNFT, avatarId, charlie, origName + 2, true);
    await clans.connect(charlie).requestToJoin(bobClanId, charliePlayerId, 0);
    await clans.connect(bob).acceptJoinRequest(bobClanId, charliePlayerId, bobPlayerId);

    // Attack
    await combatantsHelper
      .connect(bob)
      .assignCombatants(bobClanId, false, [], true, [bobPlayerId, charliePlayerId], bobPlayerId);
    const tx = await lockedBankVaults
      .connect(bob)
      .attackVaults(bobClanId, clanId, 0, bobPlayerId, {value: await lockedBankVaults.attackCost()});
    const {gasPrice} = tx;
    const requestId = 1;
    await fulfillRandomWords(requestId, lockedBankVaults, mockSWVRFOracleClient);

    let attackCost = await lockedBankVaults.attackCost();
    const slot = 221;
    let oracleCostStorage = await ethers.provider.getStorageAt(lockedBankVaults.address, slot);
    let movingAverageGasPrice = BigNumber.from(parseInt(oracleCostStorage.slice(48, 64), 16));

    const baseAttackCost = BigNumber.from("0x" + oracleCostStorage.slice(26, 48));
    expect(attackCost).to.eq(baseAttackCost);

    await lockedBankVaults.setAttackInProgress(requestId);
    await fulfillRandomWords(requestId, lockedBankVaults, mockSWVRFOracleClient, gasPrice?.add(1000));
    oracleCostStorage = await ethers.provider.getStorageAt(lockedBankVaults.address, slot);
    movingAverageGasPrice = BigNumber.from(parseInt(oracleCostStorage.slice(48, 64), 16));

    const bigZero = BigNumber.from(0);
    expect(movingAverageGasPrice).to.eq(
      bigZero
        .add(bigZero)
        .add(bigZero)
        .add((gasPrice as BigNumber).add(1000))
        .div(4)
    );

    attackCost = await lockedBankVaults.attackCost();
    const expectedGasLimit = BigNumber.from(parseInt(oracleCostStorage.slice(20, 26), 16));
    expect(attackCost).to.eq(baseAttackCost.add(movingAverageGasPrice.mul(expectedGasLimit)));

    await lockedBankVaults.setAttackInProgress(requestId);
    await fulfillRandomWords(requestId, lockedBankVaults, mockSWVRFOracleClient, gasPrice?.add(900));
    await lockedBankVaults.setAttackInProgress(requestId);
    await fulfillRandomWords(requestId, lockedBankVaults, mockSWVRFOracleClient, gasPrice?.add(800));
    await lockedBankVaults.setAttackInProgress(requestId);
    await fulfillRandomWords(requestId, lockedBankVaults, mockSWVRFOracleClient, gasPrice?.add(500));
    await lockedBankVaults.setAttackInProgress(requestId);
    await fulfillRandomWords(requestId, lockedBankVaults, mockSWVRFOracleClient, gasPrice?.add(200));

    oracleCostStorage = await ethers.provider.getStorageAt(lockedBankVaults.address, slot);
    movingAverageGasPrice = BigNumber.from(parseInt(oracleCostStorage.slice(48, 64), 16));
    expect(movingAverageGasPrice).to.eq(
      (gasPrice as BigNumber)
        .add(900)
        .add((gasPrice as BigNumber).add(800))
        .add((gasPrice as BigNumber).add(500))
        .add((gasPrice as BigNumber).add(200))
        .div(4)
    );
    attackCost = await lockedBankVaults.attackCost();
    expect(attackCost).to.eq(baseAttackCost.add(movingAverageGasPrice.mul(expectedGasLimit)));
  });

  it("Multiple locked funds claim", async () => {
    // Test it for gas usage
    const {lockedBankVaults, territories, clanId, playerId, brush, alice, combatantsHelper, LOCK_PERIOD} =
      await loadFixture(clanFixture);

    const NOWS = [];
    for (let i = 0; i < 5; ++i) {
      await lockFundsForClan(lockedBankVaults, clanId, brush, alice, playerId, 100 + i, territories, combatantsHelper);
      const {timestamp: NOW} = await ethers.provider.getBlock("latest");
      NOWS.push(NOW);

      await ethers.provider.send("evm_increaseTime", [100]); // Just so that we can more easily distinguish between the timestamps of locks
    }

    expect((await lockedBankVaults.getClanInfo(clanId)).defendingVaults.length).to.eq(3);
    expect((await lockedBankVaults.getClanInfo(clanId)).defendingVaults[0].claimed).to.be.false;
    expect((await lockedBankVaults.getClanInfo(clanId)).defendingVaults[0].amount).to.eq(100);
    expect((await lockedBankVaults.getClanInfo(clanId)).defendingVaults[0].timestamp).to.eq(NOWS[0] + LOCK_PERIOD - 1);
    expect((await lockedBankVaults.getClanInfo(clanId)).defendingVaults[0].amount1).to.eq(101);
    expect((await lockedBankVaults.getClanInfo(clanId)).defendingVaults[0].timestamp1).to.eq(NOWS[1] + LOCK_PERIOD - 1);
    expect((await lockedBankVaults.getClanInfo(clanId)).defendingVaults[1].claimed).to.be.false;
    expect((await lockedBankVaults.getClanInfo(clanId)).defendingVaults[1].amount).to.eq(102);
    expect((await lockedBankVaults.getClanInfo(clanId)).defendingVaults[1].timestamp).to.eq(NOWS[2] + LOCK_PERIOD - 1);
    expect((await lockedBankVaults.getClanInfo(clanId)).defendingVaults[1].amount1).to.eq(103);
    expect((await lockedBankVaults.getClanInfo(clanId)).defendingVaults[1].timestamp1).to.eq(NOWS[3] + LOCK_PERIOD - 1);
    expect((await lockedBankVaults.getClanInfo(clanId)).defendingVaults[2].claimed).to.be.false;
    expect((await lockedBankVaults.getClanInfo(clanId)).defendingVaults[2].amount).to.eq(104);
    expect((await lockedBankVaults.getClanInfo(clanId)).defendingVaults[2].timestamp).to.eq(NOWS[4] + LOCK_PERIOD - 1);
    expect((await lockedBankVaults.getClanInfo(clanId)).defendingVaults[2].amount1).to.eq(0);
    expect((await lockedBankVaults.getClanInfo(clanId)).defendingVaults[2].timestamp1).to.eq(0);

    await ethers.provider.send("evm_setNextBlockTimestamp", [NOWS[0] + LOCK_PERIOD - 1]);
    await lockedBankVaults.connect(alice).claimFunds(clanId, playerId);

    // First ones should be gone
    expect((await lockedBankVaults.getClanInfo(clanId)).defendingVaults[0].claimed).to.be.true;
    expect((await lockedBankVaults.getClanInfo(clanId)).defendingVaults[0].amount).to.eq(0);
    expect((await lockedBankVaults.getClanInfo(clanId)).defendingVaults[0].timestamp).to.eq(0);
    expect((await lockedBankVaults.getClanInfo(clanId)).defendingVaults[0].amount1).to.eq(101);
    expect((await lockedBankVaults.getClanInfo(clanId)).defendingVaults[0].timestamp1).to.eq(NOWS[1] + LOCK_PERIOD - 1);
    expect((await lockedBankVaults.getClanInfo(clanId)).defendingVaultsOffset).to.eq(0);

    await ethers.provider.send("evm_setNextBlockTimestamp", [NOWS[3] + LOCK_PERIOD - 1]);
    await lockedBankVaults.connect(alice).claimFunds(clanId, playerId);

    // First & second ones should be gone
    expect((await lockedBankVaults.getClanInfo(clanId)).defendingVaults[0].claimed).to.be.true;
    expect((await lockedBankVaults.getClanInfo(clanId)).defendingVaults[0].amount).to.eq(0);
    expect((await lockedBankVaults.getClanInfo(clanId)).defendingVaults[0].timestamp).to.eq(0);
    expect((await lockedBankVaults.getClanInfo(clanId)).defendingVaults[0].amount1).to.eq(101);
    expect((await lockedBankVaults.getClanInfo(clanId)).defendingVaults[0].timestamp1).to.eq(NOWS[1] + LOCK_PERIOD - 1);
    expect((await lockedBankVaults.getClanInfo(clanId)).defendingVaults[1].claimed).to.be.false;
    expect((await lockedBankVaults.getClanInfo(clanId)).defendingVaults[1].amount).to.eq(102);
    expect((await lockedBankVaults.getClanInfo(clanId)).defendingVaults[1].timestamp).to.eq(NOWS[2] + LOCK_PERIOD - 1);
    expect((await lockedBankVaults.getClanInfo(clanId)).defendingVaults[1].amount1).to.eq(103);
    expect((await lockedBankVaults.getClanInfo(clanId)).defendingVaults[1].timestamp1).to.eq(NOWS[3] + LOCK_PERIOD - 1);
    expect((await lockedBankVaults.getClanInfo(clanId)).defendingVaults[2].claimed).to.be.false;
    expect((await lockedBankVaults.getClanInfo(clanId)).defendingVaults[2].amount).to.eq(104);
    expect((await lockedBankVaults.getClanInfo(clanId)).defendingVaults[2].timestamp).to.eq(NOWS[4] + LOCK_PERIOD - 1);
    expect((await lockedBankVaults.getClanInfo(clanId)).defendingVaults[2].amount1).to.eq(0);
    expect((await lockedBankVaults.getClanInfo(clanId)).defendingVaults[2].timestamp1).to.eq(0);

    expect((await lockedBankVaults.getClanInfo(clanId)).defendingVaultsOffset).to.eq(2);

    // Claim the rest
    await ethers.provider.send("evm_setNextBlockTimestamp", [NOWS[4] + LOCK_PERIOD - 1]);
    await lockedBankVaults.connect(alice).claimFunds(clanId, playerId);
    expect((await lockedBankVaults.getClanInfo(clanId)).defendingVaults[2].claimed).to.be.true;
    expect((await lockedBankVaults.getClanInfo(clanId)).defendingVaults[2].amount).to.eq(104); // Leave it unchanged
    expect((await lockedBankVaults.getClanInfo(clanId)).defendingVaults[2].timestamp).to.eq(NOWS[4] + LOCK_PERIOD - 1);
    expect((await lockedBankVaults.getClanInfo(clanId)).defendingVaultsOffset).to.eq(2);

    await lockFundsForClan(lockedBankVaults, clanId, brush, alice, playerId, 100, territories, combatantsHelper);
    const {timestamp: NOW} = await ethers.provider.getBlock("latest");
    expect((await lockedBankVaults.getClanInfo(clanId)).defendingVaults[2].amount1).to.eq(100);
    expect((await lockedBankVaults.getClanInfo(clanId)).defendingVaults[2].timestamp1).to.eq(NOW + LOCK_PERIOD - 1);
    expect((await lockedBankVaults.getClanInfo(clanId)).defendingVaultsOffset).to.eq(2);

    await ethers.provider.send("evm_setNextBlockTimestamp", [NOW + LOCK_PERIOD]);
    await lockedBankVaults.connect(alice).claimFunds(clanId, playerId);

    expect((await lockedBankVaults.getClanInfo(clanId)).defendingVaults[2].amount).to.eq(104); // Leave unchanged
    expect((await lockedBankVaults.getClanInfo(clanId)).defendingVaults[2].timestamp).to.eq(NOWS[4] + LOCK_PERIOD - 1);
    expect((await lockedBankVaults.getClanInfo(clanId)).defendingVaults[2].amount1).to.eq(100);
    expect((await lockedBankVaults.getClanInfo(clanId)).defendingVaults[2].timestamp1).to.eq(NOW + LOCK_PERIOD - 1);

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
      mockSWVRFOracleClient,
      MAX_LOCKED_VAULTS,
    } = await loadFixture(clanFixture);

    for (let i = 0; i < MAX_LOCKED_VAULTS - 1; ++i) {
      await lockFundsForClan(lockedBankVaults, clanId, brush, alice, playerId, 400, territories, combatantsHelper);
    }

    await combatantsHelper.connect(alice).assignCombatants(clanId, false, [], true, [playerId], playerId);

    // Create a new clan to defend
    const bobPlayerId = await createPlayer(playerNFT, avatarId, bob, origName + 1, true);
    await clans.connect(bob).createClan(bobPlayerId, clanName + 1, discord, telegram, twitter, imageId, tierId);
    const bobClanId = 2;

    await lockFundsForClan(lockedBankVaults, bobClanId, brush, bob, bobPlayerId, 400, territories, combatantsHelper);

    // Attack
    await lockedBankVaults
      .connect(alice)
      .attackVaults(clanId, bobClanId, 0, playerId, {value: await lockedBankVaults.attackCost()});
    await fulfillRandomWords(1, lockedBankVaults, mockSWVRFOracleClient);
    await lockedBankVaults.clearCooldowns(clanId, [bobClanId]);

    await lockFundsForClan(lockedBankVaults, clanId, brush, alice, playerId, 400, territories, combatantsHelper);

    await expect(
      lockedBankVaults
        .connect(alice)
        .attackVaults(clanId, bobClanId, 0, playerId, {value: await lockedBankVaults.attackCost()})
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
      mockSWVRFOracleClient,
      MAX_LOCKED_VAULTS,
    } = await loadFixture(clanFixture);

    for (let i = 0; i < MAX_LOCKED_VAULTS; ++i) {
      await lockFundsForClan(lockedBankVaults, clanId, brush, alice, playerId, 400, territories, combatantsHelper);
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
          playerId,
        ],
        playerId
      );

    // Create a new clan to attack/defend
    const bobPlayerId = await createPlayer(playerNFT, avatarId, bob, origName + 1, true);
    await clans.connect(bob).createClan(bobPlayerId, clanName + 1, discord, telegram, twitter, imageId, tierId);
    const bobClanId = 2;

    for (let i = 0; i < allBattleSkills.length; ++i) {
      await players.testModifyXP(bob.address, bobPlayerId, allBattleSkills[i], getXPFromLevel(100), true);
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
          bobPlayerId,
        ],
        bobPlayerId
      );

    await lockedBankVaults
      .connect(bob)
      .attackVaults(bobClanId, clanId, 0, bobPlayerId, {value: await lockedBankVaults.attackCost()});
    await fulfillRandomWords(1, lockedBankVaults, mockSWVRFOracleClient);
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
      mockSWVRFOracleClient,
      ATTACKING_COOLDOWN,
    } = await loadFixture(clanFixture);

    await combatantsHelper.connect(alice).assignCombatants(clanId, false, [], true, [playerId], playerId);

    // Create a new clan to attack/defend
    const bobPlayerId = await createPlayer(playerNFT, avatarId, bob, origName + 1, true);
    await clans.connect(bob).createClan(bobPlayerId, clanName + 1, discord, telegram, twitter, imageId, tierId);

    const bobClanId = clanId + 1;
    await lockFundsForClan(lockedBankVaults, bobClanId, brush, bob, bobPlayerId, 1000, territories, combatantsHelper);

    // But have to wait for the cooldown and not just the generic attack cooldown, the same clan attacking cooldown
    await lockedBankVaults
      .connect(alice)
      .attackVaults(clanId, bobClanId, 0, playerId, {value: await lockedBankVaults.attackCost()});

    await fulfillRandomWords(1, lockedBankVaults, mockSWVRFOracleClient);

    await ethers.provider.send("evm_increaseTime", [ATTACKING_COOLDOWN]);
    await expect(
      lockedBankVaults
        .connect(alice)
        .attackVaults(clanId, bobClanId, 0, playerId, {value: await lockedBankVaults.attackCost()})
    ).to.be.revertedWithCustomError(LockedBankVaultsLibrary, "ClanAttackingSameClanCooldown");

    const items = allItems.filter(
      (inputItem) =>
        inputItem.tokenId == EstforConstants.DEVILISH_FINGERS || inputItem.tokenId == EstforConstants.PROTECTION_SHIELD
    );
    await itemNFT.addItems(items);
    await itemNFT.testMints(
      alice.address,
      [EstforConstants.DEVILISH_FINGERS, EstforConstants.PROTECTION_SHIELD],
      [1, 1]
    );

    // Wrong item
    await expect(
      lockedBankVaults.connect(alice).attackVaults(clanId, bobClanId, EstforConstants.PROTECTION_SHIELD, playerId, {
        value: await lockedBankVaults.attackCost(),
      })
    ).to.be.revertedWithCustomError(LockedBankVaultsLibrary, "NotALockedVaultAttackItem");

    // The re-attacking cooldown should be the same afterwards when using an item
    let battleInfo = await lockedBankVaults.lastClanBattles(clanId, bobClanId);
    const beforeCooldownTimestamp = battleInfo.lastClanIdAttackOtherClanIdCooldownTimestamp;
    expect(battleInfo.numReattacks).to.eq(0);
    await lockedBankVaults.connect(alice).attackVaults(clanId, bobClanId, EstforConstants.DEVILISH_FINGERS, playerId, {
      value: await lockedBankVaults.attackCost(),
    });

    await fulfillRandomWords(2, lockedBankVaults, mockSWVRFOracleClient);
    battleInfo = await lockedBankVaults.lastClanBattles(clanId, bobClanId);
    expect(battleInfo.lastClanIdAttackOtherClanIdCooldownTimestamp).to.eq(beforeCooldownTimestamp);
    expect(battleInfo.numReattacks).to.eq(1);

    await ethers.provider.send("evm_increaseTime", [ATTACKING_COOLDOWN]);
    await expect(
      lockedBankVaults
        .connect(alice)
        .attackVaults(clanId, bobClanId, 0, playerId, {value: await lockedBankVaults.attackCost()})
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
      mockSWVRFOracleClient,
    } = await loadFixture(clanFixture);

    await combatantsHelper.connect(alice).assignCombatants(clanId, false, [], true, [playerId], playerId);

    // Create a new clan to attack/defend
    const bobPlayerId = await createPlayer(playerNFT, avatarId, bob, origName + 1, true);
    await clans.connect(bob).createClan(bobPlayerId, clanName + 1, discord, telegram, twitter, imageId, tierId);

    const bobClanId = clanId + 1;
    await combatantsHelper.connect(bob).assignCombatants(bobClanId, false, [], true, [bobPlayerId], bobPlayerId);
    await lockFundsForClan(lockedBankVaults, bobClanId, brush, bob, bobPlayerId, 1000, territories, combatantsHelper);

    const item = allItems.find((inputItem) => inputItem.tokenId == EstforConstants.SHARPENED_CLAW) as ItemInput;
    await itemNFT.addItems([item]);
    await itemNFT.testMint(alice.address, EstforConstants.SHARPENED_CLAW, 10);

    let requestId = 1;
    // Try 10 times
    let highestRoll = BigNumber.from(0);
    for (let i = 0; i < 10; ++i, ++requestId) {
      await lockedBankVaults.connect(alice).attackVaults(clanId, bobClanId, EstforConstants.SHARPENED_CLAW, playerId, {
        value: await lockedBankVaults.attackCost(),
      });

      const tx = await fulfillRandomWords(requestId, lockedBankVaults, mockSWVRFOracleClient);
      const receipt = await tx.wait();
      // If the attacker lost then some brush is sent which changes up the event ordering
      const log = lockedBankVaults.interface.parseLog(receipt.logs.length > 4 ? receipt.logs[4] : receipt.logs[1]);
      highestRoll = highestRoll.gt(log.args["attackingRolls"][0]) ? highestRoll : log.args["attackingRolls"][0];
      await lockedBankVaults.clearCooldowns(clanId, [bobClanId]);
    }

    expect(highestRoll).to.eq(2);
    expect(await itemNFT.balanceOf(alice.address, EstforConstants.SHARPENED_CLAW)).to.eq(0);
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
      mockSWVRFOracleClient,
      ATTACKING_COOLDOWN,
    } = await loadFixture(clanFixture);

    await combatantsHelper.connect(alice).assignCombatants(clanId, false, [], true, [playerId], playerId);

    // Create a new clan to defend
    const bobPlayerId = await createPlayer(playerNFT, avatarId, bob, origName + 1, true);
    await clans.connect(bob).createClan(bobPlayerId, clanName + 1, discord, telegram, twitter, imageId, tierId);

    const bobClanId = clanId + 1;
    await combatantsHelper.connect(bob).assignCombatants(bobClanId, false, [], true, [bobPlayerId], bobPlayerId);
    await lockFundsForClan(lockedBankVaults, bobClanId, brush, bob, bobPlayerId, 1000, territories, combatantsHelper);

    const item = allItems.find((inputItem) => inputItem.tokenId == EstforConstants.SHARPENED_CLAW) as ItemInput;
    await itemNFT.addItems([item]);
    await itemNFT.testMint(alice.address, EstforConstants.SHARPENED_CLAW, 10);

    const {timestamp: NOW} = await ethers.provider.getBlock("latest");

    let requestId = 1;
    await expect(
      lockedBankVaults.connect(alice).attackVaults(clanId, bobClanId, EstforConstants.SHARPENED_CLAW, playerId, {
        value: await lockedBankVaults.attackCost(),
      })
    )
      .to.emit(lockedBankVaults, "SuperAttackCooldown")
      .withArgs(clanId, NOW + 86400 + 1);

    await fulfillRandomWords(requestId, lockedBankVaults, mockSWVRFOracleClient);

    // Create a new clan to attack/defend
    const charliePlayerId = await createPlayer(playerNFT, avatarId, charlie, origName + 2, true);
    await clans.connect(charlie).createClan(charliePlayerId, clanName + 2, discord, telegram, twitter, imageId, tierId);

    const charlieClanId = bobClanId + 1;
    await combatantsHelper
      .connect(charlie)
      .assignCombatants(charlieClanId, false, [], true, [charliePlayerId], charliePlayerId);
    await lockFundsForClan(
      lockedBankVaults,
      charlieClanId,
      brush,
      charlie,
      charliePlayerId,
      1000,
      territories,
      combatantsHelper
    );

    // Forward by attack cooldown and attack another clan
    await ethers.provider.send("evm_increaseTime", [ATTACKING_COOLDOWN]);

    // Fails due to cooldown not reached
    await expect(
      lockedBankVaults.connect(alice).attackVaults(clanId, charlieClanId, EstforConstants.SHARPENED_CLAW, playerId, {
        value: await lockedBankVaults.attackCost(),
      })
    ).to.be.revertedWithCustomError(LockedBankVaultsLibrary, "ClanSuperAttackingCooldown");

    await ethers.provider.send("evm_increaseTime", [item.boostDuration]);
    await ethers.provider.send("evm_mine", []);
    const {timestamp: NOW1} = await ethers.provider.getBlock("latest");
    // Cooldown is now reached
    await expect(
      lockedBankVaults.connect(alice).attackVaults(clanId, charlieClanId, EstforConstants.SHARPENED_CLAW, playerId, {
        value: await lockedBankVaults.attackCost(),
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
      brush,
    } = await loadFixture(clanFixture);

    await lockFundsForClan(lockedBankVaults, clanId, brush, alice, playerId, 1000, territories, combatantsHelper);

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
    await itemNFT.testMints(alice.address, [EstforConstants.PROTECTION_SHIELD, EstforConstants.MIRROR_SHIELD], [2, 1]);

    // Wrong item
    await expect(
      lockedBankVaults.connect(alice).blockAttacks(clanId, EstforConstants.MIRROR_SHIELD, playerId)
    ).to.be.revertedWithCustomError(LockedBankVaultsLibrary, "NotALockedVaultDefenceItem");

    const itemTokenId = EstforConstants.PROTECTION_SHIELD;
    await lockedBankVaults.connect(alice).blockAttacks(clanId, itemTokenId, playerId);
    expect(await itemNFT.balanceOf(alice.address, itemTokenId)).to.eq(1);

    await expect(
      lockedBankVaults.connect(bob).attackVaults(bobClanId, clanId, 0, bobPlayerId, {
        value: await lockedBankVaults.attackCost(),
      })
    ).to.be.revertedWithCustomError(LockedBankVaultsLibrary, "ClanIsBlockingAttacks");

    const protectionShield = items.find((item) => item.tokenId == itemTokenId) as ItemInput;
    await ethers.provider.send("evm_increaseTime", [protectionShield.boostDuration - 10]);

    await expect(
      lockedBankVaults.connect(bob).attackVaults(bobClanId, clanId, 0, bobPlayerId, {
        value: await lockedBankVaults.attackCost(),
      })
    ).to.be.revertedWithCustomError(LockedBankVaultsLibrary, "ClanIsBlockingAttacks");

    // Cannot apply again until the cooldown is done
    await expect(
      lockedBankVaults.connect(alice).blockAttacks(clanId, itemTokenId, playerId)
    ).to.be.revertedWithCustomError(LockedBankVaultsLibrary, "BlockAttacksCooldown");
    // Go just before the cooldown is done to confirm
    await ethers.provider.send("evm_increaseTime", [protectionShield.boostValue * 3600]);
    await expect(
      lockedBankVaults.connect(alice).blockAttacks(clanId, itemTokenId, playerId)
    ).to.be.revertedWithCustomError(LockedBankVaultsLibrary, "BlockAttacksCooldown");
    // Now extend past the cooldown time
    await ethers.provider.send("evm_increaseTime", [10]);
    await lockedBankVaults.connect(alice).blockAttacks(clanId, itemTokenId, playerId);

    await ethers.provider.send("evm_increaseTime", [protectionShield.boostDuration - 10]);

    await expect(
      lockedBankVaults.connect(bob).attackVaults(bobClanId, clanId, 0, bobPlayerId, {
        value: await lockedBankVaults.attackCost(),
      })
    ).to.be.revertedWithCustomError(LockedBankVaultsLibrary, "ClanIsBlockingAttacks");

    await ethers.provider.send("evm_increaseTime", [10]);
    await expect(
      lockedBankVaults.connect(bob).attackVaults(bobClanId, clanId, 0, bobPlayerId, {
        value: await lockedBankVaults.attackCost(),
      })
    ).to.not.be.reverted;

    expect(await itemNFT.balanceOf(alice.address, itemTokenId)).to.eq(0);
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
      mockSWVRFOracleClient,
      shop,
      players,
    } = await loadFixture(clanFixture);

    await lockFundsForClan(lockedBankVaults, clanId, brush, alice, playerId, 300, territories, combatantsHelper);
    await lockFundsForClan(lockedBankVaults, clanId, brush, alice, playerId, 200, territories, combatantsHelper);
    await lockFundsForClan(lockedBankVaults, clanId, brush, alice, playerId, 500, territories, combatantsHelper);

    await combatantsHelper.connect(alice).assignCombatants(clanId, false, [], true, [playerId], playerId);

    // Create a new clan to attack/defend
    const bobPlayerId = await createPlayer(playerNFT, avatarId, bob, origName + 1, true);
    await clans.connect(bob).createClan(bobPlayerId, clanName + 1, discord, telegram, twitter, imageId, tierId);

    const charliePlayerId = await createPlayer(playerNFT, avatarId, charlie, origName + 2, true);
    const bobClanId = clanId + 1;
    await clans.connect(charlie).requestToJoin(bobClanId, charliePlayerId, 0);
    await clans.connect(bob).acceptJoinRequest(bobClanId, charliePlayerId, bobPlayerId);

    for (let i = 0; i < allBattleSkills.length; ++i) {
      await players.testModifyXP(bob.address, bobPlayerId, allBattleSkills[i], getXPFromLevel(100), true);
      await players.testModifyXP(charlie.address, charliePlayerId, allBattleSkills[i], getXPFromLevel(100), true);
    }

    // Lock
    await lockFundsForClan(lockedBankVaults, bobClanId, brush, bob, bobPlayerId, 800, territories, combatantsHelper);

    await combatantsHelper.connect(bob).assignCombatants(bobClanId, false, [], true, [bobPlayerId], bobPlayerId);

    expect((await lockedBankVaults.getClanInfo(clanId)).totalBrushLocked).to.eq(1000);

    // Alice's clan attacks but will lose.
    await lockedBankVaults
      .connect(alice)
      .attackVaults(clanId, bobClanId, 0, playerId, {value: await lockedBankVaults.attackCost()});
    await fulfillRandomWords(1, lockedBankVaults, mockSWVRFOracleClient);

    expect((await lockedBankVaults.getClanInfo(clanId)).totalBrushLocked).to.eq(950); // lost 5%
    expect((await lockedBankVaults.getClanInfo(bobClanId)).totalBrushLocked).to.eq(800);

    // Check it went to the correct places
    expect(await brush.balanceOf(shop.address)).to.eq(25);
    expect(await brush.balanceOf(dev.address)).to.eq(12);
    expect(await brush.amountBurnt()).to.eq(13);
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
      mockSWVRFOracleClient,
    } = await loadFixture(clanFixture);

    await lockFundsForClan(lockedBankVaults, clanId, brush, alice, playerId, 300, territories, combatantsHelper);
    await lockFundsForClan(lockedBankVaults, clanId, brush, alice, playerId, 200, territories, combatantsHelper);
    await lockFundsForClan(lockedBankVaults, clanId, brush, alice, playerId, 500, territories, combatantsHelper);

    await combatantsHelper.connect(alice).assignCombatants(clanId, false, [], true, [playerId], playerId);

    // Create a new clan to attack/defend
    const bobPlayerId = await createPlayer(playerNFT, avatarId, bob, origName + 1, true);
    await clans.connect(bob).createClan(bobPlayerId, clanName + 1, discord, telegram, twitter, imageId, tierId);

    const bobClanId = clanId + 1;
    const charliePlayerId = await createPlayer(playerNFT, avatarId, charlie, origName + 2, true);
    await clans.connect(charlie).requestToJoin(bobClanId, charliePlayerId, 0);
    await clans.connect(bob).acceptJoinRequest(bobClanId, charliePlayerId, bobPlayerId);

    await combatantsHelper
      .connect(bob)
      .assignCombatants(bobClanId, false, [], true, [bobPlayerId, charliePlayerId], bobPlayerId);

    // Bobs's clan attacks and will win.
    await lockedBankVaults
      .connect(bob)
      .attackVaults(bobClanId, clanId, 0, bobPlayerId, {value: await lockedBankVaults.attackCost()});
    await fulfillRandomWords(1, lockedBankVaults, mockSWVRFOracleClient);

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
      mockSWVRFOracleClient,
    } = await loadFixture(clanFixture);

    await combatantsHelper.connect(alice).assignCombatants(clanId, false, [], true, [playerId], playerId);

    // Create a new clan to attack
    const bobPlayerId = await createPlayer(playerNFT, avatarId, bob, origName + 1, true);
    await clans.connect(bob).createClan(bobPlayerId, clanName + 1, discord, telegram, twitter, imageId, tierId);
    const bobClanId = clanId + 1;
    await lockFundsForClan(lockedBankVaults, bobClanId, brush, bob, bobPlayerId, 300, territories, combatantsHelper);

    await lockedBankVaults
      .connect(alice)
      .attackVaults(clanId, clanId + 1, 0, playerId, {value: await lockedBankVaults.attackCost()});

    await expect(fulfillRandomWords(3, lockedBankVaults, mockSWVRFOracleClient)).to.revertedWithCustomError(
      lockedBankVaults,
      "RequestIdNotKnown"
    );
  });

  it("Claim with a full packed vault but only the first is claimable, the next lock should start a new segment", async () => {
    const {lockedBankVaults, territories, clanId, playerId, alice, brush, combatantsHelper, LOCK_PERIOD} =
      await loadFixture(clanFixture);

    // Get one lock
    await lockFundsForClan(lockedBankVaults, clanId, brush, alice, playerId, 300, territories, combatantsHelper);
    // Wait a couple days and get another lock
    await ethers.provider.send("evm_increaseTime", [86400 * 2]);
    await lockFundsForClan(lockedBankVaults, clanId, brush, alice, playerId, 300, territories, combatantsHelper);
    // Unlock it
    await ethers.provider.send("evm_increaseTime", [LOCK_PERIOD - 86400 * 2]);
    // Claim funds and check the locks are correct
    await lockedBankVaults.connect(alice).claimFunds(clanId, playerId);
    await lockFundsForClan(lockedBankVaults, clanId, brush, alice, playerId, 500, territories, combatantsHelper);
    expect((await lockedBankVaults.getClanInfo(clanId)).defendingVaults.length).to.eq(2);
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
      } = await loadFixture(clanFixture);

      await lockFundsForClan(lockedBankVaults, clanId, brush, alice, playerId, 1000, territories, combatantsHelper);

      // Create a new clan to attack/defend
      const bobPlayerId = await createPlayer(playerNFT, avatarId, bob, origName + 1, true);
      await clans.connect(bob).createClan(bobPlayerId, clanName + 1, discord, telegram, twitter, imageId, tierId);
      const bobClanId = 2;

      await lockFundsForClan(lockedBankVaults, bobClanId, brush, alice, playerId, 1000, territories, combatantsHelper);

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
        mockSWVRFOracleClient,
      } = await loadFixture(clanFixture);

      await lockFundsForClan(lockedBankVaults, clanId, brush, alice, playerId, 1000, territories, combatantsHelper);

      await combatantsHelper.connect(alice).assignCombatants(clanId, false, [], true, [playerId], playerId);

      // Create a new clan to attack/defend
      const bobPlayerId = await createPlayer(playerNFT, avatarId, bob, origName + 1, true);
      await clans.connect(bob).createClan(bobPlayerId, clanName + 1, discord, telegram, twitter, imageId, tierId);

      const bobClanId = clanId + 1;
      const charliePlayerId = await createPlayer(playerNFT, avatarId, charlie, origName + 2, true);
      await clans.connect(charlie).requestToJoin(bobClanId, charliePlayerId, 0);
      await clans.connect(bob).acceptJoinRequest(bobClanId, charliePlayerId, bobPlayerId);

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
        .attackVaults(bobClanId, clanId, 0, bobPlayerId, {value: await lockedBankVaults.attackCost()});
      await fulfillRandomWords(1, lockedBankVaults, mockSWVRFOracleClient);
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
        mockSWVRFOracleClient,
        LOCK_PERIOD,
        players,
      } = await loadFixture(clanFixture);

      await lockFundsForClan(lockedBankVaults, clanId, brush, alice, playerId, 1000, territories, combatantsHelper);

      await combatantsHelper.connect(alice).assignCombatants(clanId, false, [], true, [playerId], playerId);

      // Create a new clan to attack/defend with 2 members
      const bobPlayerId = await createPlayer(playerNFT, avatarId, bob, origName + 1, true);
      await clans.connect(bob).createClan(bobPlayerId, clanName + 1, discord, telegram, twitter, imageId, tierId);
      const bobClanId = clanId + 1;
      const charliePlayerId = await createPlayer(playerNFT, avatarId, charlie, origName + 2, true);
      await clans.connect(charlie).requestToJoin(bobClanId, charliePlayerId, 0);
      await clans.connect(bob).acceptJoinRequest(bobClanId, charliePlayerId, bobPlayerId);

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
        await players.testModifyXP(bob.address, bobPlayerId, allBattleSkills[i], getXPFromLevel(100), true);
        await players.testModifyXP(charlie.address, charliePlayerId, allBattleSkills[i], getXPFromLevel(100), true);
        await players.testModifyXP(erin.address, erinPlayerId, allBattleSkills[i], getXPFromLevel(100), true);
        await players.testModifyXP(frank.address, frankPlayerId, allBattleSkills[i], getXPFromLevel(100), true);
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
        .attackVaults(bobClanId, clanId, 0, bobPlayerId, {value: await lockedBankVaults.attackCost()});
      await fulfillRandomWords(1, lockedBankVaults, mockSWVRFOracleClient);
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
        .attackVaults(erinClanId, clanId, 0, erinPlayerId, {value: await lockedBankVaults.attackCost()});
      await fulfillRandomWords(2, lockedBankVaults, mockSWVRFOracleClient);
      // Erin wins again alice (more likely at least)
      expect((await lockedBankVaults.getClanInfo(clanId)).totalBrushLocked).to.eq(810);

      expect(await lockedBankVaults.getSortedMMR()).to.deep.eq([498, 501, 501]);
      expect(await lockedBankVaults.getSortedClanIdsByMMR()).to.deep.eq([clanId, erinClanId, bobClanId]);

      await lockFundsForClan(
        lockedBankVaults,
        frankClanId,
        brush,
        alice,
        playerId,
        1000,
        territories,
        combatantsHelper
      );

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
        .attackVaults(erinClanId, clanId, 0, erinPlayerId, {value: await lockedBankVaults.attackCost()});
      await fulfillRandomWords(3, lockedBankVaults, mockSWVRFOracleClient);

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
        .attackVaults(clanId, erinClanId, 0, playerId, {value: await lockedBankVaults.attackCost()});
      await fulfillRandomWords(4, lockedBankVaults, mockSWVRFOracleClient);

      expect(await lockedBankVaults.getSortedMMR()).to.deep.eq([496, 500, 501, 503]);
      expect(await lockedBankVaults.getSortedClanIdsByMMR()).to.deep.eq([clanId, frankClanId, bobClanId, erinClanId]);

      // Alice attacks frank and loses
      await lockedBankVaults.clearCooldowns(clanId, []);
      await lockedBankVaults
        .connect(alice)
        .attackVaults(clanId, frankClanId, 0, playerId, {value: await lockedBankVaults.attackCost()});
      await fulfillRandomWords(5, lockedBankVaults, mockSWVRFOracleClient);
      expect(await lockedBankVaults.getSortedMMR()).to.deep.eq([495, 501, 501, 503]);
      expect(await lockedBankVaults.getSortedClanIdsByMMR()).to.deep.eq([clanId, frankClanId, bobClanId, erinClanId]);

      // Claim them all
      await ethers.provider.send("evm_increaseTime", [LOCK_PERIOD]);

      await lockedBankVaults.connect(alice).claimFunds(clanId, playerId);
      await lockedBankVaults.connect(frank).claimFunds(frankClanId, frankPlayerId);

      expect(await clans.getMMR(clanId)).to.eq(495);
      expect(await clans.getMMR(bobClanId)).to.eq(501);
      expect(await clans.getMMR(erinClanId)).to.eq(503);
      expect(await clans.getMMR(frankClanId)).to.eq(501);

      expect(await lockedBankVaults.getSortedMMR()).to.deep.eq([501, 503]);
      expect(await lockedBankVaults.getSortedClanIdsByMMR()).to.deep.eq([bobClanId, erinClanId]);

      await lockFundsForClan(lockedBankVaults, clanId, brush, alice, playerId, 1000, territories, combatantsHelper);

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
        mockSWVRFOracleClient,
        players,
      } = await loadFixture(clanFixture);

      await combatantsHelper.connect(alice).assignCombatants(clanId, false, [], true, [playerId], playerId);

      // Create a new clan to attack/defend
      const bobPlayerId = await createPlayer(playerNFT, avatarId, bob, origName + 1, true);
      await clans.connect(bob).createClan(bobPlayerId, clanName + 1, discord, telegram, twitter, imageId, tierId);

      const bobClanId = clanId + 1;
      await combatantsHelper.connect(bob).assignCombatants(bobClanId, false, [], true, [bobPlayerId], bobPlayerId);
      await lockFundsForClan(lockedBankVaults, bobClanId, brush, bob, bobPlayerId, 1000, territories, combatantsHelper);

      for (let i = 0; i < allBattleSkills.length; ++i) {
        await players.testModifyXP(alice.address, playerId, allBattleSkills[i], getXPFromLevel(100), true);
      }

      expect(await lockedBankVaults.getSortedClanIdsByMMR()).to.deep.eq([bobClanId]);

      // Win
      await lockedBankVaults.connect(alice).attackVaults(clanId, bobClanId, EstforConstants.NONE, playerId, {
        value: await lockedBankVaults.attackCost(),
      });
      let requestId = 1;
      await fulfillRandomWords(requestId++, lockedBankVaults, mockSWVRFOracleClient);

      expect(await lockedBankVaults.getSortedMMR()).to.deep.eq([499, 501]);
      expect(await lockedBankVaults.getSortedClanIdsByMMR()).to.deep.eq([bobClanId, clanId]);

      // Lose (make the other clan have 2 more combatant)
      const charliePlayerId = await createPlayer(playerNFT, avatarId, charlie, origName + 2, true);
      await clans.connect(charlie).requestToJoin(bobClanId, charliePlayerId, 0);
      await clans.connect(bob).acceptJoinRequest(bobClanId, charliePlayerId, bobPlayerId);

      const frankPlayerId = await createPlayer(playerNFT, avatarId, frank, origName + 3, true);
      await clans.connect(frank).requestToJoin(bobClanId, frankPlayerId, 0);
      await clans.connect(bob).acceptJoinRequest(bobClanId, frankPlayerId, bobPlayerId);

      await combatantsHelper.clearCooldowns([bobPlayerId]);
      await lockedBankVaults.clearCooldowns(clanId, [bobClanId]);
      await lockedBankVaults.clearCooldowns(bobClanId, []);

      await combatantsHelper
        .connect(bob)
        .assignCombatants(bobClanId, false, [], true, [bobPlayerId, charliePlayerId, frankPlayerId], bobPlayerId);
      for (let i = 0; i < allBattleSkills.length; ++i) {
        await players.testModifyXP(bob.address, bobPlayerId, allBattleSkills[i], getXPFromLevel(100), true);
        await players.testModifyXP(charlie.address, charliePlayerId, allBattleSkills[i], getXPFromLevel(100), true);
        await players.testModifyXP(frank.address, frankPlayerId, allBattleSkills[i], getXPFromLevel(100), true);
      }
      await lockedBankVaults.connect(alice).attackVaults(clanId, bobClanId, EstforConstants.NONE, playerId, {
        value: await lockedBankVaults.attackCost(),
      });
      await fulfillRandomWords(requestId++, lockedBankVaults, mockSWVRFOracleClient);

      expect(await lockedBankVaults.getSortedMMR()).to.deep.eq([500, 500]);
      expect(await lockedBankVaults.getSortedClanIdsByMMR()).to.deep.eq([bobClanId, clanId]);

      // Win
      await combatantsHelper.clearCooldowns([bobPlayerId]);
      await lockedBankVaults.clearCooldowns(clanId, [bobClanId]);
      await lockedBankVaults.clearCooldowns(bobClanId, []);
      await combatantsHelper.connect(bob).assignCombatants(bobClanId, false, [], true, [], bobPlayerId);

      await lockedBankVaults.connect(alice).attackVaults(clanId, bobClanId, EstforConstants.NONE, playerId, {
        value: await lockedBankVaults.attackCost(),
      });
      await fulfillRandomWords(requestId++, lockedBankVaults, mockSWVRFOracleClient);

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
        value: await lockedBankVaults.attackCost(),
      });
      await fulfillRandomWords(requestId++, lockedBankVaults, mockSWVRFOracleClient);
      expect(await lockedBankVaults.getSortedMMR()).to.deep.eq([500, 500]);
      expect(await lockedBankVaults.getSortedClanIdsByMMR()).to.deep.eq([bobClanId, clanId]);

      // Lose
      await lockedBankVaults.clearCooldowns(clanId, [bobClanId]);
      await lockedBankVaults.connect(alice).attackVaults(clanId, bobClanId, EstforConstants.NONE, playerId, {
        value: await lockedBankVaults.attackCost(),
      });
      await fulfillRandomWords(requestId++, lockedBankVaults, mockSWVRFOracleClient);

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
        value: await lockedBankVaults.attackCost(),
      });
      await fulfillRandomWords(requestId++, lockedBankVaults, mockSWVRFOracleClient);

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
        mockSWVRFOracleClient,
        players,
      } = await loadFixture(clanFixture);

      await lockFundsForClan(lockedBankVaults, clanId, brush, alice, playerId, 1000, territories, combatantsHelper);

      await combatantsHelper.connect(alice).assignCombatants(clanId, false, [], true, [playerId], playerId);

      // Create a new clan to attack/defend with 2 members
      const bobPlayerId = await createPlayer(playerNFT, avatarId, bob, origName + 1, true);
      await clans.connect(bob).createClan(bobPlayerId, clanName + 1, discord, telegram, twitter, imageId, tierId);
      const bobClanId = clanId + 1;

      await combatantsHelper.connect(bob).assignCombatants(bobClanId, false, [], true, [bobPlayerId], bobPlayerId);

      // Increase odds of winning by maxing out their stats
      for (let i = 0; i < allBattleSkills.length; ++i) {
        await players.testModifyXP(bob.address, bobPlayerId, allBattleSkills[i], getXPFromLevel(100), true);
      }

      await lockedBankVaults
        .connect(bob)
        .attackVaults(bobClanId, clanId, 0, bobPlayerId, {value: await lockedBankVaults.attackCost()});

      // Clan is deleted
      await clans.connect(alice).changeRank(clanId, clanId, ClanRank.NONE, playerId);
      expect(await clans.getClanId(playerId)).to.eq(0);
      await fulfillRandomWords(1, lockedBankVaults, mockSWVRFOracleClient);

      expect(await clans.getMMR(clanId)).to.eq(499);
      expect(await clans.getMMR(bobClanId)).to.eq(501);

      expect(await lockedBankVaults.getSortedMMR()).to.deep.eq([499, 501]);
      expect(await lockedBankVaults.getSortedClanIdsByMMR()).to.deep.eq([clanId, bobClanId]);

      await expect(lockedBankVaults.forceMMRUpdate([clanId]))
        .to.emit(lockedBankVaults, "ForceMMRUpdate")
        .withArgs([clanId]);

      expect(await lockedBankVaults.getSortedMMR()).to.deep.eq([501]);
      expect(await lockedBankVaults.getSortedClanIdsByMMR()).to.deep.eq([bobClanId]);
    });

    it("Do an attack and then the clan is deleted for both attacker and defender should not revert", async () => {
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
        mockSWVRFOracleClient,
        players,
      } = await loadFixture(clanFixture);

      await lockFundsForClan(lockedBankVaults, clanId, brush, alice, playerId, 1000, territories, combatantsHelper);

      await combatantsHelper.connect(alice).assignCombatants(clanId, false, [], true, [playerId], playerId);

      // Create a new clan to attack/defend with 2 members
      const bobPlayerId = await createPlayer(playerNFT, avatarId, bob, origName + 1, true);
      await clans.connect(bob).createClan(bobPlayerId, clanName + 1, discord, telegram, twitter, imageId, tierId);
      const bobClanId = clanId + 1;

      await combatantsHelper.connect(bob).assignCombatants(bobClanId, false, [], true, [bobPlayerId], bobPlayerId);

      // Increase odds of winning by maxing out their stats
      for (let i = 0; i < allBattleSkills.length; ++i) {
        await players.testModifyXP(bob.address, bobPlayerId, allBattleSkills[i], getXPFromLevel(100), true);
      }

      await lockedBankVaults
        .connect(bob)
        .attackVaults(bobClanId, clanId, 0, bobPlayerId, {value: await lockedBankVaults.attackCost()});

      // Both clans are deleted
      await clans.connect(alice).changeRank(clanId, playerId, ClanRank.NONE, playerId);
      await clans.connect(bob).changeRank(bobClanId, bobPlayerId, ClanRank.NONE, bobPlayerId);
      expect(await clans.getClanId(playerId)).to.eq(0);
      await fulfillRandomWords(1, lockedBankVaults, mockSWVRFOracleClient);

      expect(await clans.getMMR(clanId)).to.eq(499);
      expect(await clans.getMMR(bobClanId)).to.eq(501); // Attacker will win due to drawing

      expect(await lockedBankVaults.getSortedMMR()).to.deep.eq([499, 501]);
      expect(await lockedBankVaults.getSortedClanIdsByMMR()).to.deep.eq([clanId, bobClanId]);

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
        mockSWVRFOracleClient,
        LOCK_PERIOD,
      } = await loadFixture(clanFixture);

      await lockFundsForClan(lockedBankVaults, clanId, brush, alice, playerId, 1000, territories, combatantsHelper);

      await combatantsHelper.connect(alice).assignCombatants(clanId, false, [], true, [playerId], playerId);

      // Create a new clan to attack/defend with 2 members
      const bobPlayerId = await createPlayer(playerNFT, avatarId, bob, origName + 1, true);
      await clans.connect(bob).createClan(bobPlayerId, clanName + 1, discord, telegram, twitter, imageId, tierId);
      const bobClanId = clanId + 1;

      await combatantsHelper.connect(bob).assignCombatants(bobClanId, false, [], true, [bobPlayerId], bobPlayerId);

      await lockedBankVaults
        .connect(bob)
        .attackVaults(bobClanId, clanId, 0, bobPlayerId, {value: await lockedBankVaults.attackCost()});

      await ethers.provider.send("evm_increaseTime", [LOCK_PERIOD + 1]);

      // Both clans are deleted
      await fulfillRandomWords(1, lockedBankVaults, mockSWVRFOracleClient);

      expect(await clans.getMMR(clanId)).to.eq(499);
      expect(await clans.getMMR(bobClanId)).to.eq(501); // Attacker will win due to drawing

      expect(await lockedBankVaults.getSortedMMR()).to.deep.eq([499, 501]);
      expect(await lockedBankVaults.getSortedClanIdsByMMR()).to.deep.eq([clanId, bobClanId]);

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
        mockSWVRFOracleClient,
        LOCK_PERIOD,
      } = await loadFixture(clanFixture);

      await lockFundsForClan(lockedBankVaults, clanId, brush, alice, playerId, 1000, territories, combatantsHelper);

      await combatantsHelper.connect(alice).assignCombatants(clanId, false, [], true, [playerId], playerId);

      // Create a new clan to attack/defend with 2 members
      const bobPlayerId = await createPlayer(playerNFT, avatarId, bob, origName + 1, true);
      await clans.connect(bob).createClan(bobPlayerId, clanName + 1, discord, telegram, twitter, imageId, tierId);
      const bobClanId = clanId + 1;

      await combatantsHelper.connect(bob).assignCombatants(bobClanId, false, [], true, [bobPlayerId], bobPlayerId);

      await lockedBankVaults
        .connect(bob)
        .attackVaults(bobClanId, clanId, 0, bobPlayerId, {value: await lockedBankVaults.attackCost()});

      await ethers.provider.send("evm_increaseTime", [LOCK_PERIOD + 1]);
      await lockedBankVaults.connect(alice).claimFunds(clanId, playerId);

      // Both clans are deleted
      await fulfillRandomWords(1, lockedBankVaults, mockSWVRFOracleClient);

      expect(await clans.getMMR(clanId)).to.eq(499);
      expect(await clans.getMMR(bobClanId)).to.eq(501); // Attacker will win due to drawing

      expect(await lockedBankVaults.getSortedMMR()).to.deep.eq([501]); // Still gets the points for winning
      expect(await lockedBankVaults.getSortedClanIdsByMMR()).to.deep.eq([bobClanId]);

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
        mockSWVRFOracleClient,
        players,
      } = await loadFixture(clanFixture);

      await lockFundsForClan(lockedBankVaults, clanId, brush, alice, playerId, 1000, territories, combatantsHelper);

      await combatantsHelper.connect(alice).assignCombatants(clanId, false, [], true, [playerId], playerId);

      // Create a new clan to attack/defend with 2 members
      const bobPlayerId = await createPlayer(playerNFT, avatarId, bob, origName + 1, true);
      await clans.connect(bob).createClan(bobPlayerId, clanName + 1, discord, telegram, twitter, imageId, tierId);
      const bobClanId = clanId + 1;
      const charliePlayerId = await createPlayer(playerNFT, avatarId, charlie, origName + 2, true);
      await clans.connect(charlie).requestToJoin(bobClanId, charliePlayerId, 0);
      await clans.connect(bob).acceptJoinRequest(bobClanId, charliePlayerId, bobPlayerId);

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
        await players.testModifyXP(bob.address, bobPlayerId, allBattleSkills[i], getXPFromLevel(100), true);
        await players.testModifyXP(charlie.address, charliePlayerId, allBattleSkills[i], getXPFromLevel(100), true);
        await players.testModifyXP(erin.address, erinPlayerId, allBattleSkills[i], getXPFromLevel(100), true);
        await players.testModifyXP(frank.address, frankPlayerId, allBattleSkills[i], getXPFromLevel(100), true);
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
        .attackVaults(bobClanId, clanId, 0, bobPlayerId, {value: await lockedBankVaults.attackCost()});
      await fulfillRandomWords(1, lockedBankVaults, mockSWVRFOracleClient);
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
        .attackVaults(erinClanId, clanId, 0, erinPlayerId, {value: await lockedBankVaults.attackCost()});
      await fulfillRandomWords(2, lockedBankVaults, mockSWVRFOracleClient);
      // Erin wins again alice (more likely at least)
      expect((await lockedBankVaults.getClanInfo(clanId)).totalBrushLocked).to.eq(810);

      expect(await lockedBankVaults.getSortedMMR()).to.deep.eq([498, 501, 501]);
      expect(await lockedBankVaults.getSortedClanIdsByMMR()).to.deep.eq([clanId, erinClanId, bobClanId]);

      await lockFundsForClan(
        lockedBankVaults,
        frankClanId,
        brush,
        alice,
        playerId,
        1000,
        territories,
        combatantsHelper
      );

      expect(await lockedBankVaults.getSortedMMR()).to.deep.eq([498, 500, 501, 501]);
      expect(await lockedBankVaults.getSortedClanIdsByMMR()).to.deep.eq([clanId, frankClanId, erinClanId, bobClanId]);

      // Change attack distance to 1
      await lockedBankVaults.setMMRAttackDistance(1);

      // frank cannot attack alice but can attack both others
      await expect(
        lockedBankVaults
          .connect(frank)
          .attackVaults(frankClanId, bobClanId, 0, frankPlayerId, {value: await lockedBankVaults.attackCost()})
      ).to.be.revertedWithCustomError(LockedBankVaultsLibrary, "OutsideMMRRange");
      // Attack at both extremes as well, alice can attack erin
      await lockedBankVaults
        .connect(alice)
        .attackVaults(clanId, erinClanId, 0, playerId, {value: await lockedBankVaults.attackCost()});
      await fulfillRandomWords(3, lockedBankVaults, mockSWVRFOracleClient);
      // Will lose (most likely)
      expect(await lockedBankVaults.getSortedMMR()).to.deep.eq([497, 500, 501, 502]);
      expect(await lockedBankVaults.getSortedClanIdsByMMR()).to.deep.eq([clanId, frankClanId, bobClanId, erinClanId]);

      await lockedBankVaults.clearCooldowns(clanId, [erinClanId]);

      await expect(
        lockedBankVaults
          .connect(alice)
          .attackVaults(clanId, erinClanId, 0, playerId, {value: await lockedBankVaults.attackCost()})
      ).to.be.revertedWithCustomError(LockedBankVaultsLibrary, "OutsideMMRRange");

      await lockedBankVaults.clearCooldowns(erinClanId, [clanId]);

      // Erin cannot attack clanId
      await expect(
        lockedBankVaults
          .connect(erin)
          .attackVaults(erinClanId, clanId, 0, erinPlayerId, {value: await lockedBankVaults.attackCost()})
      ).to.be.revertedWithCustomError(LockedBankVaultsLibrary, "OutsideMMRRange");

      // Erin can attack frank.
      await lockedBankVaults.clearCooldowns(erinClanId, []);
      await combatantsHelper.clearCooldowns([frankPlayerId]);
      await lockedBankVaults.clearCooldowns(frankClanId, []);
      await combatantsHelper.connect(frank).assignCombatants(frankClanId, false, [], true, [], frankPlayerId);

      await lockedBankVaults
        .connect(erin)
        .attackVaults(erinClanId, frankClanId, 0, erinPlayerId, {value: await lockedBankVaults.attackCost()});
      await fulfillRandomWords(4, lockedBankVaults, mockSWVRFOracleClient);
      expect(await lockedBankVaults.getSortedMMR()).to.deep.eq([497, 499, 501, 503]);
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
        mockSWVRFOracleClient,
        players,
      } = await loadFixture(clanFixture);

      await lockFundsForClan(lockedBankVaults, clanId, brush, alice, playerId, 1000, territories, combatantsHelper);
      await combatantsHelper.connect(alice).assignCombatants(clanId, false, [], true, [playerId], playerId);

      // Create a new clan to attack/defend between each other
      const bobPlayerId = await createPlayer(playerNFT, avatarId, bob, origName + 1, true);
      await clans.connect(bob).createClan(bobPlayerId, clanName + 1, discord, telegram, twitter, imageId, tierId);
      const bobClanId = clanId + 1;
      await combatantsHelper.connect(bob).assignCombatants(bobClanId, false, [], true, [bobPlayerId], bobPlayerId);

      // Increase odds of winning by maxing out their stats
      for (let i = 0; i < allBattleSkills.length; ++i) {
        await players.testModifyXP(bob.address, bobPlayerId, allBattleSkills[i], getXPFromLevel(100), true);
      }

      // Attacker wins (most likely)
      await lockedBankVaults
        .connect(bob)
        .attackVaults(bobClanId, clanId, 0, bobPlayerId, {value: await lockedBankVaults.attackCost()});
      await fulfillRandomWords(1, lockedBankVaults, mockSWVRFOracleClient);

      expect(await lockedBankVaults.getSortedMMR()).to.deep.eq([499, 501]);
      expect(await lockedBankVaults.getSortedClanIdsByMMR()).to.deep.eq([clanId, bobClanId]);

      // Now loses, as bob had a MMR he should have higher rank?
      // Remove combatants
      await combatantsHelper.clearCooldowns([bobPlayerId]);
      await lockedBankVaults.clearCooldowns(bobClanId, []);
      await combatantsHelper.connect(bob).assignCombatants(bobClanId, false, [], true, [], bobPlayerId);

      await lockedBankVaults
        .connect(alice)
        .attackVaults(clanId, bobClanId, 0, playerId, {value: await lockedBankVaults.attackCost()});
      await fulfillRandomWords(2, lockedBankVaults, mockSWVRFOracleClient);

      expect(await lockedBankVaults.getSortedMMR()).to.deep.eq([500, 500]);
      expect(await lockedBankVaults.getSortedClanIdsByMMR()).to.deep.eq([bobClanId, clanId]);

      // Attacker loses (most likely)
      // Well first win so that MMRs are different
      await lockedBankVaults.clearCooldowns(clanId, [bobClanId]);
      await lockedBankVaults
        .connect(alice)
        .attackVaults(clanId, bobClanId, 0, playerId, {value: await lockedBankVaults.attackCost()});
      await fulfillRandomWords(3, lockedBankVaults, mockSWVRFOracleClient);

      expect(await lockedBankVaults.getSortedMMR()).to.deep.eq([499, 501]);
      expect(await lockedBankVaults.getSortedClanIdsByMMR()).to.deep.eq([bobClanId, clanId]);

      // Now lose (most likely)
      await combatantsHelper.clearCooldowns([bobPlayerId]);
      await lockedBankVaults.clearCooldowns(bobClanId, []);
      await combatantsHelper.connect(bob).assignCombatants(bobClanId, false, [], true, [bobPlayerId], bobPlayerId);
      await lockedBankVaults.clearCooldowns(clanId, [bobClanId]);
      await lockedBankVaults
        .connect(alice)
        .attackVaults(clanId, bobClanId, 0, playerId, {value: await lockedBankVaults.attackCost()});
      await fulfillRandomWords(4, lockedBankVaults, mockSWVRFOracleClient);

      expect(await lockedBankVaults.getSortedMMR()).to.deep.eq([500, 500]);
      expect(await lockedBankVaults.getSortedClanIdsByMMR()).to.deep.eq([bobClanId, clanId]); // Attacker is higher rank even if losing
    });
  });
});
