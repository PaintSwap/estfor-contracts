import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {expect} from "chai";
import {clanFixture} from "./utils";
import {createPlayer} from "../../scripts/utils";
import {ClanRank, ItemInput} from "@paintswap/estfor-definitions/types";
import {ethers} from "hardhat";
import {LockedBankVaults, MockBrushToken, Territories} from "../../typechain-types";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {fulfillRandomWords} from "../utils";
import {BigNumber} from "ethers";
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
  territories: Territories
) => {
  await brush.mint(alice.address, amount);
  await brush.connect(alice).approve(lockedBankVaults.address, amount);
  await lockedBankVaults.setTerritories(alice.address); // Set it to alice so we can lock funds
  await lockedBankVaults.connect(alice).lockFunds(clanId, alice.address, playerId, amount);
  await lockedBankVaults.setTerritories(territories.address); // Set it back after locking funds
};

describe("LockedBankVaults", function () {
  it("Lock funds", async () => {
    const {lockedBankVaults, clanId, playerId, brush, alice} = await loadFixture(clanFixture);

    await brush.mint(alice.address, 1000);
    await brush.connect(alice).approve(lockedBankVaults.address, 1000);
    await lockedBankVaults.setTerritories(alice.address);
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
    const {lockedBankVaults, combatantsHelper, territories, clanId, playerId, brush, alice} = await loadFixture(
      clanFixture
    );

    await lockFundsForClan(lockedBankVaults, clanId, brush, alice, playerId, 400, territories);
    await combatantsHelper.connect(alice).assignCombatants(clanId, false, [], true, [playerId], playerId);

    await expect(
      lockedBankVaults
        .connect(alice)
        .attackVaults(clanId, clanId, 0, playerId, {value: await lockedBankVaults.attackCost()})
    ).to.be.revertedWithCustomError(lockedBankVaults, "CannotAttackSelf");
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

    await lockFundsForClan(lockedBankVaults, clanId, brush, alice, playerId, 400, territories);

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
    const {lockedBankVaults, combatantsHelper, clanId, playerId, alice} = await loadFixture(clanFixture);

    await combatantsHelper.connect(alice).assignCombatants(clanId, false, [], true, [playerId], playerId);
    // Clear player id part so we can hit the custom error we want
    await combatantsHelper.clearCooldowns([playerId]);

    await expect(
      combatantsHelper.connect(alice).assignCombatants(clanId, false, [], true, [playerId], playerId)
    ).to.be.revertedWithCustomError(lockedBankVaults, "ClanCombatantsChangeCooldown");

    // Update time by MIN_PLAYER_COMBANTANTS_CHANGE_COOLDOWN
    const MIN_PLAYER_COMBANTANTS_CHANGE_COOLDOWN = await lockedBankVaults.MIN_PLAYER_COMBANTANTS_CHANGE_COOLDOWN();
    await ethers.provider.send("evm_increaseTime", [MIN_PLAYER_COMBANTANTS_CHANGE_COOLDOWN.toNumber() - 5]);
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
    } = await loadFixture(clanFixture);

    await lockFundsForClan(lockedBankVaults, clanId, brush, alice, playerId, 1000, territories);
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

    const LOCK_PERIOD = (await lockedBankVaults.LOCK_PERIOD()).toNumber();
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

    await lockFundsForClan(lockedBankVaults, clanId, brush, alice, playerId, 1000, territories);

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
    ).to.be.revertedWithCustomError(lockedBankVaults, "NoCombatants");
  });

  it("Attack back, lose and then win", async () => {
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
      players,
    } = await loadFixture(clanFixture);

    await lockFundsForClan(lockedBankVaults, clanId, brush, alice, playerId, 1000, territories);
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
    expect((await lockedBankVaults.getClanInfo(clanId)).totalBrushLocked).to.eq(810); // lost 10% for losing
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
    ).to.be.revertedWithCustomError(lockedBankVaults, "ClanAttackingCooldown");

    await ethers.provider.send("evm_increaseTime", [(await lockedBankVaults.ATTACKING_COOLDOWN()).toNumber()]);
    await expect(
      lockedBankVaults
        .connect(alice)
        .attackVaults(clanId, bobClanId, 0, playerId, {value: await lockedBankVaults.attackCost()})
    ).to.be.revertedWithCustomError(lockedBankVaults, "ClanAttackingSameClanCooldown");

    await ethers.provider.send("evm_increaseTime", [
      (await lockedBankVaults.MIN_PLAYER_COMBANTANTS_CHANGE_COOLDOWN()).toNumber(),
    ]);

    await combatantsHelper
      .connect(alice)
      .assignCombatants(clanId, false, [], true, [playerId, ownerPlayerId, erinPlayerId, frankPlayerId], playerId);
    await lockedBankVaults
      .connect(alice)
      .attackVaults(clanId, bobClanId, 0, playerId, {value: await lockedBankVaults.attackCost()});
    await fulfillRandomWords(3, lockedBankVaults, mockSWVRFOracleClient);
    const {timestamp: NOW2} = await ethers.provider.getBlock("latest");

    // Wait another day (check it's not just the clan cooldown)
    expect((await lockedBankVaults.getClanInfo(clanId)).totalBrushLocked).to.eq(810 + 10);
    expect((await lockedBankVaults.getClanInfo(bobClanId)).totalBrushLocked).to.eq(90);

    const LOCK_PERIOD = (await lockedBankVaults.LOCK_PERIOD()).toNumber();
    expect((await lockedBankVaults.getClanInfo(clanId)).defendingVaults.length).to.eq(1);
    expect((await lockedBankVaults.getClanInfo(clanId)).defendingVaults[0].amount).to.eq(810);
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
    const {lockedBankVaults, territories, clanId, playerId, alice, brush, bankAddress} = await loadFixture(clanFixture);

    await lockFundsForClan(lockedBankVaults, clanId, brush, alice, playerId, 1000, territories);
    const LOCK_PERIOD = (await lockedBankVaults.LOCK_PERIOD()).toNumber();
    const lockPeriodSlice = LOCK_PERIOD / 10;

    await ethers.provider.send("evm_increaseTime", [lockPeriodSlice]);
    await lockFundsForClan(lockedBankVaults, clanId, brush, alice, playerId, 300, territories);
    await ethers.provider.send("evm_increaseTime", [lockPeriodSlice]);
    await lockFundsForClan(lockedBankVaults, clanId, brush, alice, playerId, 450, territories);

    // Nothing to claim
    await expect(lockedBankVaults.connect(alice).claimFunds(clanId, playerId)).to.be.revertedWithCustomError(
      lockedBankVaults,
      "NothingToClaim"
    );
    await ethers.provider.send("evm_increaseTime", [lockPeriodSlice * 7]);
    await expect(lockedBankVaults.connect(alice).claimFunds(clanId, playerId)).to.be.revertedWithCustomError(
      lockedBankVaults,
      "NothingToClaim"
    );
    await ethers.provider.send("evm_increaseTime", [lockPeriodSlice]);
    // Can now claim
    await lockedBankVaults.connect(alice).claimFunds(clanId, playerId);
    expect(await brush.balanceOf(bankAddress)).to.eq(1000);
    expect(await brush.balanceOf(lockedBankVaults.address)).to.eq(750);
    // Cannot claim twice
    await expect(lockedBankVaults.connect(alice).claimFunds(clanId, playerId)).to.be.revertedWithCustomError(
      lockedBankVaults,
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
      lockedBankVaults,
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

    await lockFundsForClan(lockedBankVaults, clanId, brush, alice, playerId, 1000, territories);

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
    expect(await lockedBankVaults.movingAverageGasPrice()).to.eq(0);

    let attackCost = await lockedBankVaults.attackCost();
    const baseAttackCost = await lockedBankVaults.baseAttackCost();
    expect(attackCost).to.eq(baseAttackCost);

    await lockedBankVaults.setAttackInProgress(requestId);
    await fulfillRandomWords(requestId, lockedBankVaults, mockSWVRFOracleClient, gasPrice?.add(1000));
    const bigZero = BigNumber.from(0);
    expect(await lockedBankVaults.movingAverageGasPrice()).to.eq(
      bigZero
        .add(bigZero)
        .add(bigZero)
        .add((gasPrice as BigNumber).add(1000))
        .div(4)
    );

    attackCost = await lockedBankVaults.attackCost();
    const expectedGasLimit = await lockedBankVaults.expectedGasLimitFulfill();
    expect(attackCost).to.eq(
      baseAttackCost.add((await lockedBankVaults.movingAverageGasPrice()).mul(expectedGasLimit))
    );

    await lockedBankVaults.setAttackInProgress(requestId);
    await fulfillRandomWords(requestId, lockedBankVaults, mockSWVRFOracleClient, gasPrice?.add(900));
    await lockedBankVaults.setAttackInProgress(requestId);
    await fulfillRandomWords(requestId, lockedBankVaults, mockSWVRFOracleClient, gasPrice?.add(800));
    await lockedBankVaults.setAttackInProgress(requestId);
    await fulfillRandomWords(requestId, lockedBankVaults, mockSWVRFOracleClient, gasPrice?.add(500));
    await lockedBankVaults.setAttackInProgress(requestId);
    await fulfillRandomWords(requestId, lockedBankVaults, mockSWVRFOracleClient, gasPrice?.add(200));

    expect(await lockedBankVaults.movingAverageGasPrice()).to.eq(
      (gasPrice as BigNumber)
        .add(900)
        .add((gasPrice as BigNumber).add(800))
        .add((gasPrice as BigNumber).add(500))
        .add((gasPrice as BigNumber).add(200))
        .div(4)
    );
    attackCost = await lockedBankVaults.attackCost();
    expect(attackCost).to.eq(
      baseAttackCost.add((await lockedBankVaults.movingAverageGasPrice()).mul(expectedGasLimit))
    );
  });

  it("Multiple locked funds claim", async () => {
    // Test it for gas usage
    const {lockedBankVaults, territories, clanId, playerId, brush, alice} = await loadFixture(clanFixture);

    const NOWS = [];
    for (let i = 0; i < 5; ++i) {
      await lockFundsForClan(lockedBankVaults, clanId, brush, alice, playerId, 100 + i, territories);
      const {timestamp: NOW} = await ethers.provider.getBlock("latest");
      NOWS.push(NOW);

      await ethers.provider.send("evm_increaseTime", [100]); // Just so that we can more easily distinguish between the timestamps of locks
    }

    const LOCK_PERIOD = (await lockedBankVaults.LOCK_PERIOD()).toNumber();
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

    await lockFundsForClan(lockedBankVaults, clanId, brush, alice, playerId, 100, territories);
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
    } = await loadFixture(clanFixture);

    const MAX_LOCKED_VAULTS = (await lockedBankVaults.MAX_LOCKED_VAULTS()).toNumber();
    for (let i = 0; i < MAX_LOCKED_VAULTS - 1; ++i) {
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
      .attackVaults(clanId, bobClanId, 0, playerId, {value: await lockedBankVaults.attackCost()});
    await fulfillRandomWords(1, lockedBankVaults, mockSWVRFOracleClient);
    await lockedBankVaults.clearCooldowns(clanId, [bobClanId]);

    await lockFundsForClan(lockedBankVaults, clanId, brush, alice, playerId, 400, territories);

    await expect(
      lockedBankVaults
        .connect(alice)
        .attackVaults(clanId, bobClanId, 0, playerId, {value: await lockedBankVaults.attackCost()})
    ).to.be.revertedWithCustomError(lockedBankVaults, "MaxLockedVaultsReached");
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
    } = await loadFixture(clanFixture);

    const MAX_LOCKED_VAULTS = (await lockedBankVaults.MAX_LOCKED_VAULTS()).toNumber();
    for (let i = 0; i < MAX_LOCKED_VAULTS; ++i) {
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
    await lockFundsForClan(lockedBankVaults, bobClanId, brush, bob, bobPlayerId, 1000, territories);

    // But have to wait for the cooldown and not just the generic attack cooldown, the same clan attacking cooldown
    await lockedBankVaults
      .connect(alice)
      .attackVaults(clanId, bobClanId, 0, playerId, {value: await lockedBankVaults.attackCost()});
    await fulfillRandomWords(1, lockedBankVaults, mockSWVRFOracleClient);

    await ethers.provider.send("evm_increaseTime", [(await lockedBankVaults.ATTACKING_COOLDOWN()).toNumber()]);
    await expect(
      lockedBankVaults
        .connect(alice)
        .attackVaults(clanId, bobClanId, 0, playerId, {value: await lockedBankVaults.attackCost()})
    ).to.be.revertedWithCustomError(lockedBankVaults, "ClanAttackingSameClanCooldown");

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
    ).to.be.revertedWithCustomError(lockedBankVaults, "NotALockedVaultAttackItem");

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

    await ethers.provider.send("evm_increaseTime", [(await lockedBankVaults.ATTACKING_COOLDOWN()).toNumber()]);
    await expect(
      lockedBankVaults
        .connect(alice)
        .attackVaults(clanId, bobClanId, 0, playerId, {value: await lockedBankVaults.attackCost()})
    ).to.be.revertedWithCustomError(lockedBankVaults, "ClanAttackingSameClanCooldown");

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
    await lockFundsForClan(lockedBankVaults, bobClanId, brush, bob, bobPlayerId, 1000, territories);

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
    await lockFundsForClan(lockedBankVaults, charlieClanId, brush, charlie, charliePlayerId, 1000, territories);

    // Forward by attack cooldown and attack another clan
    await ethers.provider.send("evm_increaseTime", [(await lockedBankVaults.ATTACKING_COOLDOWN()).toNumber()]);

    // Fails due to cooldown not reached
    await expect(
      lockedBankVaults.connect(alice).attackVaults(clanId, charlieClanId, EstforConstants.SHARPENED_CLAW, playerId, {
        value: await lockedBankVaults.attackCost(),
      })
    ).to.be.revertedWithCustomError(lockedBankVaults, "ClanSuperAttackingCooldown");

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

  it("Blocking Attacks with item", async () => {
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
    await itemNFT.testMints(alice.address, [EstforConstants.PROTECTION_SHIELD, EstforConstants.MIRROR_SHIELD], [2, 1]);

    // Wrong item
    await expect(
      lockedBankVaults.connect(alice).blockAttacks(clanId, EstforConstants.MIRROR_SHIELD, playerId)
    ).to.be.revertedWithCustomError(lockedBankVaults, "NotALockedVaultDefenceItem");

    const itemTokenId = EstforConstants.PROTECTION_SHIELD;
    await lockedBankVaults.connect(alice).blockAttacks(clanId, itemTokenId, playerId);
    expect(await itemNFT.balanceOf(alice.address, itemTokenId)).to.eq(1);

    await expect(
      lockedBankVaults.connect(bob).attackVaults(bobClanId, clanId, 0, bobPlayerId, {
        value: await lockedBankVaults.attackCost(),
      })
    ).to.be.revertedWithCustomError(lockedBankVaults, "ClanIsBlockingAttacks");

    const protectionShield = items.find((item) => item.tokenId == itemTokenId) as ItemInput;
    await ethers.provider.send("evm_increaseTime", [protectionShield.boostDuration - 10]);

    await expect(
      lockedBankVaults.connect(bob).attackVaults(bobClanId, clanId, 0, bobPlayerId, {
        value: await lockedBankVaults.attackCost(),
      })
    ).to.be.revertedWithCustomError(lockedBankVaults, "ClanIsBlockingAttacks");

    // Allow extending it even before it finishes
    await lockedBankVaults.connect(alice).blockAttacks(clanId, itemTokenId, playerId);
    await ethers.provider.send("evm_increaseTime", [protectionShield.boostDuration - 10]);

    await expect(
      lockedBankVaults.connect(bob).attackVaults(bobClanId, clanId, 0, bobPlayerId, {
        value: await lockedBankVaults.attackCost(),
      })
    ).to.be.revertedWithCustomError(lockedBankVaults, "ClanIsBlockingAttacks");

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
    await clans.connect(bob).acceptJoinRequest(bobClanId, charliePlayerId, bobPlayerId);

    for (let i = 0; i < allBattleSkills.length; ++i) {
      await players.testModifyXP(bob.address, bobPlayerId, allBattleSkills[i], getXPFromLevel(100), true);
    }

    // Lock
    await lockFundsForClan(lockedBankVaults, bobClanId, brush, bob, bobPlayerId, 800, territories);

    await combatantsHelper.connect(bob).assignCombatants(bobClanId, false, [], true, [bobPlayerId], bobPlayerId);

    expect((await lockedBankVaults.getClanInfo(clanId)).totalBrushLocked).to.eq(1000);

    // Alice's clan attacks but will lose.
    await lockedBankVaults
      .connect(alice)
      .attackVaults(clanId, bobClanId, 0, playerId, {value: await lockedBankVaults.attackCost()});
    await fulfillRandomWords(1, lockedBankVaults, mockSWVRFOracleClient);

    expect((await lockedBankVaults.getClanInfo(clanId)).totalBrushLocked).to.eq(900); // lost 10%
    expect((await lockedBankVaults.getClanInfo(bobClanId)).totalBrushLocked).to.eq(800);

    // Check it went to the correct places
    expect(await brush.balanceOf(shop.address)).to.eq(50);
    expect(await brush.balanceOf(dev.address)).to.eq(25);
    expect(await brush.amountBurnt()).to.eq(25);
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
    await lockFundsForClan(lockedBankVaults, bobClanId, brush, bob, bobPlayerId, 300, territories);

    await lockedBankVaults
      .connect(alice)
      .attackVaults(clanId, clanId + 1, 0, playerId, {value: await lockedBankVaults.attackCost()});

    await expect(fulfillRandomWords(3, lockedBankVaults, mockSWVRFOracleClient)).to.revertedWithCustomError(
      lockedBankVaults,
      "RequestIdNotKnown"
    );
  });

  it("Claim with a full packed vault but only the first is claimable, the next lock should start a new segment", async () => {
    const {lockedBankVaults, territories, clanId, playerId, alice, brush} = await loadFixture(clanFixture);

    // Get one lock
    await lockFundsForClan(lockedBankVaults, clanId, brush, alice, playerId, 300, territories);
    // Wait a couple days and get another lock
    await ethers.provider.send("evm_increaseTime", [86400 * 2]);
    await lockFundsForClan(lockedBankVaults, clanId, brush, alice, playerId, 300, territories);
    // Unlock it
    const LOCK_PERIOD = (await lockedBankVaults.LOCK_PERIOD()).toNumber();
    await ethers.provider.send("evm_increaseTime", [LOCK_PERIOD - 86400 * 2]);
    // Claim funds and check the locks are correct
    await lockedBankVaults.connect(alice).claimFunds(clanId, playerId);
    await lockFundsForClan(lockedBankVaults, clanId, brush, alice, playerId, 500, territories);
    expect((await lockedBankVaults.getClanInfo(clanId)).defendingVaults.length).to.eq(2);
  });

  it("Cannot attack a clan twice within the cooldown", async () => {});

  it("Player has an attack cooldown if transferring to another clan", async () => {});

  it("Player has a defending cooldown if transferring to another clan", async () => {});

  it("Lock funds on a non-existent clan", async () => {});
});
