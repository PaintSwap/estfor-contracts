import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {expect} from "chai";
import {clanFixture} from "./utils";
import {createPlayer} from "../../scripts/utils";
import {ClanRank} from "@paintswap/estfor-definitions/types";
import {ethers} from "hardhat";
import {LockedBankVault, MockBrushToken, Territories} from "../../typechain-types";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {fulfillRandomWords} from "../utils";
import {BigNumber} from "ethers";

const lockFundsForClan = async (
  lockedBankVault: LockedBankVault,
  clanId: number,
  brush: MockBrushToken,
  alice: SignerWithAddress,
  playerId: BigNumber,
  amount: number,
  territories: Territories
) => {
  await brush.mint(alice.address, amount);
  await brush.connect(alice).approve(lockedBankVault.address, amount);
  await lockedBankVault.setTerritories(alice.address); // Set it to alice so we can lock funds
  await lockedBankVault.connect(alice).lockFunds(clanId, alice.address, playerId, amount);
  await lockedBankVault.setTerritories(territories.address); // Set it back after locking funds
};

describe("LockedBankVault", function () {
  it("Lock funds", async () => {
    const {lockedBankVault, clanId, playerId, brush, alice} = await loadFixture(clanFixture);

    await brush.mint(alice.address, 1000);
    await brush.connect(alice).approve(lockedBankVault.address, 1000);
    await lockedBankVault.setTerritories(alice.address);
    await lockedBankVault.connect(alice).lockFunds(clanId, alice.address, playerId, 400);
    expect(await brush.balanceOf(alice.address)).to.eq(600);
    expect(await brush.balanceOf(lockedBankVault.address)).to.eq(400);
    expect((await lockedBankVault.getClanInfo(clanId)).totalBrushLocked).to.eq(400);
  });

  it("Only territories contract can lock funds", async () => {
    const {lockedBankVault, clanId, playerId, alice, bob, brush} = await loadFixture(clanFixture);

    await brush.mint(alice.address, 100);
    await brush.connect(alice).approve(lockedBankVault.address, 100);
    await expect(
      lockedBankVault.connect(alice).lockFunds(clanId, alice.address, playerId, 100)
    ).to.be.revertedWithCustomError(lockedBankVault, "OnlyTerritories");
  });

  it("Cannot attack your own clan", async function () {
    const {lockedBankVault, territories, clanId, playerId, brush, alice} = await loadFixture(clanFixture);

    await lockFundsForClan(lockedBankVault, clanId, brush, alice, playerId, 400, territories);
    await lockedBankVault.setTerritories(territories.address); // Set it back after locking funds
    await lockedBankVault.connect(alice).assignCombatants(clanId, [playerId], playerId);

    await expect(lockedBankVault.connect(alice).attackVaults(clanId, clanId, playerId)).to.be.revertedWithCustomError(
      lockedBankVault,
      "CannotAttackSelf"
    );
  });

  it("Leaving clan removes you as a defender", async function () {
    const {lockedBankVault, territories, clanId, playerId, brush, owner, alice, playerNFT, avatarId, origName, clans} =
      await loadFixture(clanFixture);

    await lockFundsForClan(lockedBankVault, clanId, brush, alice, playerId, 400, territories);

    const ownerPlayerId = await createPlayer(playerNFT, avatarId, owner, origName + 1, true);
    await clans.requestToJoin(clanId, ownerPlayerId, 0);
    await clans.connect(alice).acceptJoinRequest(clanId, ownerPlayerId, playerId);

    await lockedBankVault.connect(alice).assignCombatants(clanId, [playerId, ownerPlayerId], playerId);
    expect((await lockedBankVault.getClanInfo(clanId)).playerIds).to.deep.eq([playerId, ownerPlayerId]);
    await clans.changeRank(clanId, ownerPlayerId, ClanRank.NONE, ownerPlayerId);
    expect((await lockedBankVault.getClanInfo(clanId)).playerIds).to.deep.eq([playerId, 0]);
  });

  it("Cannot only change combatants after the cooldown change deadline has passed", async function () {
    const {lockedBankVault, clanId, playerId, alice} = await loadFixture(clanFixture);

    await lockedBankVault.connect(alice).assignCombatants(clanId, [playerId], playerId);

    await expect(
      lockedBankVault.connect(alice).assignCombatants(clanId, [playerId], playerId)
    ).to.be.revertedWithCustomError(lockedBankVault, "ClanCombatantsChangeCooldown");

    // Update time by MIN_PLAYER_COMBANTANTS_CHANGE_COOLDOWN
    const MIN_PLAYER_COMBANTANTS_CHANGE_COOLDOWN = await lockedBankVault.MIN_PLAYER_COMBANTANTS_CHANGE_COOLDOWN();
    await ethers.provider.send("evm_increaseTime", [MIN_PLAYER_COMBANTANTS_CHANGE_COOLDOWN.toNumber() - 5]);
    await expect(
      lockedBankVault.connect(alice).assignCombatants(clanId, [playerId], playerId)
    ).to.be.revertedWithCustomError(lockedBankVault, "ClanCombatantsChangeCooldown");
    await ethers.provider.send("evm_increaseTime", [5]);
    await lockedBankVault.connect(alice).assignCombatants(clanId, [playerId], playerId);
  });

  it("Cannot be used as a defender if you are currently a territory combatant", async function () {});

  it("Attack locked funds", async () => {
    const {
      clans,
      lockedBankVault,
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
      imageId,
      tierId,
      brush,
      mockAPI3OracleClient,
    } = await loadFixture(clanFixture);

    await lockFundsForClan(lockedBankVault, clanId, brush, alice, playerId, 1000, territories);
    const {timestamp: NOW} = await ethers.provider.getBlock("latest");

    await lockedBankVault.connect(alice).assignCombatants(clanId, [playerId], playerId);

    // Create a new clan to attack/defend
    const bobPlayerId = await createPlayer(playerNFT, avatarId, bob, origName + 1, true);
    await clans.connect(bob).createClan(bobPlayerId, clanName + 1, discord, telegram, imageId, tierId);

    const bobClanId = clanId + 1;
    const charliePlayerId = await createPlayer(playerNFT, avatarId, charlie, origName + 2, true);
    await clans.connect(charlie).requestToJoin(bobClanId, charliePlayerId, 0);
    await clans.connect(bob).acceptJoinRequest(bobClanId, charliePlayerId, bobPlayerId);

    // Attack
    await lockedBankVault.connect(bob).assignCombatants(bobClanId, [bobPlayerId, charliePlayerId], bobPlayerId);
    await lockedBankVault.connect(bob).attackVaults(bobClanId, clanId, bobPlayerId);
    await fulfillRandomWords(1, lockedBankVault, mockAPI3OracleClient);
    const {timestamp: NOW1} = await ethers.provider.getBlock("latest");
    // Should win as they have more players
    expect((await lockedBankVault.getClanInfo(clanId)).totalBrushLocked).to.eq(900);
    expect((await lockedBankVault.getClanInfo(bobClanId)).totalBrushLocked).to.eq(100);

    const LOCK_PERIOD = (await lockedBankVault.LOCK_PERIOD()).toNumber();
    expect((await lockedBankVault.getClanInfo(clanId)).defendingVaults.length).to.eq(1);
    expect((await lockedBankVault.getClanInfo(clanId)).defendingVaults[0].amount).to.eq(900);
    expect((await lockedBankVault.getClanInfo(clanId)).defendingVaults[0].timestamp).to.eq(NOW + LOCK_PERIOD - 1);

    expect((await lockedBankVault.getClanInfo(bobClanId)).defendingVaults.length).to.eq(1);
    expect((await lockedBankVault.getClanInfo(bobClanId)).defendingVaults[0].amount).to.eq(100);
    expect((await lockedBankVault.getClanInfo(bobClanId)).defendingVaults[0].timestamp).to.eq(NOW1 + LOCK_PERIOD);
  });

  it("Must attack with some combatants", async () => {
    const {
      clans,
      lockedBankVault,
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
      imageId,
      tierId,
      brush,
    } = await loadFixture(clanFixture);

    await lockFundsForClan(lockedBankVault, clanId, brush, alice, playerId, 1000, territories);

    await lockedBankVault.connect(alice).assignCombatants(clanId, [playerId], playerId);

    // Create a new clan to attack/defend
    const bobPlayerId = await createPlayer(playerNFT, avatarId, bob, origName + 1, true);
    await clans.connect(bob).createClan(bobPlayerId, clanName + 1, discord, telegram, imageId, tierId);

    const bobClanId = clanId + 1;
    const charliePlayerId = await createPlayer(playerNFT, avatarId, charlie, origName + 2, true);
    await clans.connect(charlie).requestToJoin(bobClanId, charliePlayerId, 0);
    await clans.connect(bob).acceptJoinRequest(bobClanId, charliePlayerId, bobPlayerId);

    // Cannot attack unless have combatants specified
    await expect(
      lockedBankVault.connect(bob).attackVaults(bobClanId, clanId, bobPlayerId)
    ).to.be.revertedWithCustomError(lockedBankVault, "NoCombatants");
  });

  it("Attack back, lose and then win", async () => {
    const {
      clans,
      lockedBankVault,
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
      imageId,
      tierId,
      brush,
      mockAPI3OracleClient,
    } = await loadFixture(clanFixture);

    await lockFundsForClan(lockedBankVault, clanId, brush, alice, playerId, 1000, territories);
    const {timestamp: NOW} = await ethers.provider.getBlock("latest");

    // Nominate defenders
    await lockedBankVault.connect(alice).assignCombatants(clanId, [playerId], playerId);

    // Create a new clan to attack/defend
    const bobPlayerId = await createPlayer(playerNFT, avatarId, bob, origName + 1, true);
    await clans.connect(bob).createClan(bobPlayerId, clanName + 1, discord, telegram, imageId, tierId);

    const bobClanId = clanId + 1;
    const charliePlayerId = await createPlayer(playerNFT, avatarId, charlie, origName + 2, true);
    await clans.connect(charlie).requestToJoin(bobClanId, charliePlayerId, 0);
    await clans.connect(bob).acceptJoinRequest(bobClanId, charliePlayerId, bobPlayerId);

    // Attack
    await lockedBankVault.connect(bob).assignCombatants(bobClanId, [bobPlayerId, charliePlayerId], bobPlayerId);
    await lockedBankVault.connect(bob).attackVaults(bobClanId, clanId, bobPlayerId);
    await fulfillRandomWords(1, lockedBankVault, mockAPI3OracleClient);
    const {timestamp: NOW1} = await ethers.provider.getBlock("latest");

    // Alice's clan can attack back because they haven't attacked anything yet but will lose.
    await lockedBankVault.connect(alice).attackVaults(clanId, bobClanId, playerId);
    await fulfillRandomWords(2, lockedBankVault, mockAPI3OracleClient);
    // Unchanged
    expect((await lockedBankVault.getClanInfo(clanId)).totalBrushLocked).to.eq(900);
    expect((await lockedBankVault.getClanInfo(bobClanId)).totalBrushLocked).to.eq(100);

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
      lockedBankVault.connect(alice).attackVaults(clanId, bobClanId, playerId)
    ).to.be.revertedWithCustomError(lockedBankVault, "ClanAttackingCooldown");

    await ethers.provider.send("evm_increaseTime", [(await lockedBankVault.ATTACKING_COOLDOWN()).toNumber()]);
    await expect(
      lockedBankVault.connect(alice).attackVaults(clanId, bobClanId, playerId)
    ).to.be.revertedWithCustomError(lockedBankVault, "ClanAttackingSameClanCooldown");

    await ethers.provider.send("evm_increaseTime", [
      (await lockedBankVault.MIN_PLAYER_COMBANTANTS_CHANGE_COOLDOWN()).toNumber(),
    ]);

    await lockedBankVault
      .connect(alice)
      .assignCombatants(clanId, [playerId, ownerPlayerId, erinPlayerId, frankPlayerId], playerId);
    await lockedBankVault.connect(alice).attackVaults(clanId, bobClanId, playerId);
    await fulfillRandomWords(3, lockedBankVault, mockAPI3OracleClient);
    const {timestamp: NOW2} = await ethers.provider.getBlock("latest");

    // Wait another day (check it's not just the clan cooldown)
    expect((await lockedBankVault.getClanInfo(clanId)).totalBrushLocked).to.eq(910);
    expect((await lockedBankVault.getClanInfo(bobClanId)).totalBrushLocked).to.eq(90);

    const LOCK_PERIOD = (await lockedBankVault.LOCK_PERIOD()).toNumber();
    expect((await lockedBankVault.getClanInfo(clanId)).defendingVaults.length).to.eq(2);
    expect((await lockedBankVault.getClanInfo(clanId)).defendingVaults[0].amount).to.eq(900);
    expect((await lockedBankVault.getClanInfo(clanId)).defendingVaults[0].timestamp).to.eq(NOW + LOCK_PERIOD - 1);
    expect((await lockedBankVault.getClanInfo(clanId)).defendingVaults[1].amount).to.eq(10);
    expect((await lockedBankVault.getClanInfo(clanId)).defendingVaults[1].timestamp).to.eq(NOW2 + LOCK_PERIOD);

    expect((await lockedBankVault.getClanInfo(bobClanId)).defendingVaults.length).to.eq(1);
    expect((await lockedBankVault.getClanInfo(bobClanId)).defendingVaults[0].amount).to.eq(90);
    expect((await lockedBankVault.getClanInfo(bobClanId)).defendingVaults[0].timestamp).to.eq(NOW1 + LOCK_PERIOD);
  });

  it("Claim rewards when the deadline has expired", async () => {
    const {lockedBankVault, territories, clanId, playerId, alice, brush, bankAddress} = await loadFixture(clanFixture);

    await lockFundsForClan(lockedBankVault, clanId, brush, alice, playerId, 1000, territories);
    const LOCK_PERIOD = (await lockedBankVault.LOCK_PERIOD()).toNumber();
    const lockPeriodSlice = LOCK_PERIOD / 10;

    await ethers.provider.send("evm_increaseTime", [lockPeriodSlice]);
    await lockFundsForClan(lockedBankVault, clanId, brush, alice, playerId, 300, territories);
    await ethers.provider.send("evm_increaseTime", [lockPeriodSlice]);
    await lockFundsForClan(lockedBankVault, clanId, brush, alice, playerId, 450, territories);

    // Nothing to claim
    await expect(lockedBankVault.connect(alice).claimFunds(clanId, playerId)).to.be.revertedWithCustomError(
      lockedBankVault,
      "NothingToClaim"
    );
    await ethers.provider.send("evm_increaseTime", [lockPeriodSlice * 7]);
    await expect(lockedBankVault.connect(alice).claimFunds(clanId, playerId)).to.be.revertedWithCustomError(
      lockedBankVault,
      "NothingToClaim"
    );
    await ethers.provider.send("evm_increaseTime", [lockPeriodSlice]);
    // Can now claim
    await lockedBankVault.connect(alice).claimFunds(clanId, playerId);
    expect(await brush.balanceOf(bankAddress)).to.eq(1000);
    expect(await brush.balanceOf(lockedBankVault.address)).to.eq(750);
    // Cannot claim twice
    await expect(lockedBankVault.connect(alice).claimFunds(clanId, playerId)).to.be.revertedWithCustomError(
      lockedBankVault,
      "NothingToClaim"
    );
    await ethers.provider.send("evm_increaseTime", [lockPeriodSlice]);
    await ethers.provider.send("evm_increaseTime", [lockPeriodSlice]);
    // Claim both
    await lockedBankVault.connect(alice).claimFunds(clanId, playerId);
    expect(await brush.balanceOf(bankAddress)).to.eq(1750);
    expect(await brush.balanceOf(lockedBankVault.address)).to.eq(0);
    // Cannot claim again
    await expect(lockedBankVault.connect(alice).claimFunds(clanId, playerId)).to.be.revertedWithCustomError(
      lockedBankVault,
      "NothingToClaim"
    );
  });

  it("Cannot attack a clan twice within the cooldown", async () => {});

  it("Player has an attack cooldown if transferring to another clan", async () => {});

  it("Player has a defending cooldown if transferring to another clan", async () => {});

  it("Lock funds on a non-existent clan", async () => {});
});
