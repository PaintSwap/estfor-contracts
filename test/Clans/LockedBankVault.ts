import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {expect} from "chai";
import {clanFixture} from "./utils";
import {createPlayer} from "../../scripts/utils";
import {ClanRank} from "@paintswap/estfor-definitions/types";
import {ethers} from "hardhat";
import {LockedBankVault, MockBrushToken} from "../../typechain-types";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {fulfillRandomWords} from "../utils";

const lockFundsForClan = async (
  lockedBankVault: LockedBankVault,
  clanId: number,
  brush: MockBrushToken,
  alice: SignerWithAddress,
  amount: number
) => {
  await brush.mint(alice.address, amount);
  await brush.connect(alice).approve(lockedBankVault.address, amount);
  await lockedBankVault.connect(alice).lockFunds(clanId, amount);
};

describe("LockedBankVault", function () {
  it("Lock funds", async () => {
    const {lockedBankVault, clanId, brush, alice} = await loadFixture(clanFixture);

    await brush.mint(alice.address, 1000);
    await brush.connect(alice).approve(lockedBankVault.address, 1000);
    await lockedBankVault.connect(alice).lockFunds(clanId, 400);
    expect(await brush.balanceOf(alice.address)).to.eq(600);
    expect(await brush.balanceOf(lockedBankVault.address)).to.eq(400);
    expect((await lockedBankVault.getClanInfo(clanId)).totalBrushLocked).to.eq(400);
  });

  it("Cannot attack your own clan", async function () {
    const {lockedBankVault, clanId, playerId, brush, alice} = await loadFixture(clanFixture);

    await lockFundsForClan(lockedBankVault, clanId, brush, alice, 400);
    await lockedBankVault.connect(alice).assignCombatants(clanId, [playerId], playerId);

    await expect(lockedBankVault.connect(alice).attackVault(clanId, clanId, playerId)).to.be.revertedWithCustomError(
      lockedBankVault,
      "CannotAttackSelf"
    );
  });

  it("Leaving clan removes you as a defender", async function () {
    const {lockedBankVault, clanId, playerId, brush, owner, alice, playerNFT, avatarId, origName, clans} =
      await loadFixture(clanFixture);

    await lockFundsForClan(lockedBankVault, clanId, brush, alice, 400);

    const ownerPlayerId = await createPlayer(playerNFT, avatarId, owner, origName + 1, true);
    await clans.requestToJoin(clanId, ownerPlayerId, 0);
    await clans.connect(alice).acceptJoinRequest(clanId, ownerPlayerId, playerId);

    // Nominate defenders
    await lockedBankVault.connect(alice).assignCombatants(clanId, [playerId, ownerPlayerId], playerId);
    expect((await lockedBankVault.getClanInfo(clanId)).playerIds).to.deep.eq([playerId, ownerPlayerId]);
    await clans.changeRank(clanId, ownerPlayerId, ClanRank.NONE, ownerPlayerId);
    expect((await lockedBankVault.getClanInfo(clanId)).playerIds).to.deep.eq([playerId, 0]);
  });

  it("Cannot only change defenders after the cooldown change deadline has passed", async function () {
    const {lockedBankVault, clanId, playerId, alice} = await loadFixture(clanFixture);

    // Nominate defenders
    await lockedBankVault.connect(alice).assignCombatants(clanId, [playerId], playerId);

    await expect(
      lockedBankVault.connect(alice).assignCombatants(clanId, [playerId], playerId)
    ).to.be.revertedWithCustomError(lockedBankVault, "ClanDefendersChangeCooldown");

    // Update time by MIN_PLAYER_COMBANTANTS_CHANGE_COOLDOWN
    const MIN_PLAYER_COMBANTANTS_CHANGE_COOLDOWN = await lockedBankVault.MIN_PLAYER_COMBANTANTS_CHANGE_COOLDOWN();
    await ethers.provider.send("evm_increaseTime", [MIN_PLAYER_COMBANTANTS_CHANGE_COOLDOWN.toNumber() - 5]);
    await expect(
      lockedBankVault.connect(alice).assignCombatants(clanId, [playerId], playerId)
    ).to.be.revertedWithCustomError(lockedBankVault, "ClanDefendersChangeCooldown");
    await ethers.provider.send("evm_increaseTime", [5]);
    await lockedBankVault.connect(alice).assignCombatants(clanId, [playerId], playerId);
  });

  it("Cannot be used as a defender if you are currently attacking or defending a territory", async function () {});

  it("Attack locked funds", async () => {
    const {
      clans,
      lockedBankVault,
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
      mockOracleClient,
    } = await loadFixture(clanFixture);

    await lockFundsForClan(lockedBankVault, clanId, brush, alice, 1000);
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
    await lockedBankVault.connect(bob).attackVault(bobClanId, clanId, bobPlayerId);
    await fulfillRandomWords(1, lockedBankVault, mockOracleClient);
    const {timestamp: NOW1} = await ethers.provider.getBlock("latest");
    // Should win as they have more players
    expect((await lockedBankVault.getClanInfo(clanId)).totalBrushLocked).to.eq(900);
    expect((await lockedBankVault.getClanInfo(bobClanId)).totalBrushLocked).to.eq(100);

    const LOCK_PERIOD = (await lockedBankVault.LOCK_PERIOD()).toNumber();
    expect((await lockedBankVault.getClanInfo(clanId)).defendingData.length).to.eq(1);
    expect((await lockedBankVault.getClanInfo(clanId)).defendingData[0].amount).to.eq(900);
    expect((await lockedBankVault.getClanInfo(clanId)).defendingData[0].timestamp).to.eq(NOW + LOCK_PERIOD);

    expect((await lockedBankVault.getClanInfo(bobClanId)).defendingData.length).to.eq(1);
    expect((await lockedBankVault.getClanInfo(bobClanId)).defendingData[0].amount).to.eq(100);
    expect((await lockedBankVault.getClanInfo(bobClanId)).defendingData[0].timestamp).to.eq(NOW1 + LOCK_PERIOD);
  });

  it("Attack back, lose and then win", async () => {
    const {
      clans,
      lockedBankVault,
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
      clanName,
      discord,
      telegram,
      imageId,
      tierId,
      brush,
      mockOracleClient,
    } = await loadFixture(clanFixture);

    await lockFundsForClan(lockedBankVault, clanId, brush, alice, 1000);
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
    await lockedBankVault.connect(bob).attackVault(bobClanId, clanId, bobPlayerId);
    await fulfillRandomWords(1, lockedBankVault, mockOracleClient);
    const {timestamp: NOW1} = await ethers.provider.getBlock("latest");

    // Alice's clan can attack back because they haven't attacked anything yet but will lose.
    await lockedBankVault.connect(alice).attackVault(clanId, bobClanId, playerId);
    await fulfillRandomWords(2, lockedBankVault, mockOracleClient);
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

    // But have to wait for the cooldown and not just the generic attack cooldown, the same clan attacking cooldown
    await expect(lockedBankVault.connect(alice).attackVault(clanId, bobClanId, playerId)).to.be.revertedWithCustomError(
      lockedBankVault,
      "ClanAttackingCooldown"
    );

    await ethers.provider.send("evm_increaseTime", [(await lockedBankVault.ATTACKING_COOLDOWN()).toNumber()]);
    await expect(lockedBankVault.connect(alice).attackVault(clanId, bobClanId, playerId)).to.be.revertedWithCustomError(
      lockedBankVault,
      "ClanAttackingSameClanCooldown"
    );

    await ethers.provider.send("evm_increaseTime", [
      (await lockedBankVault.MIN_PLAYER_COMBANTANTS_CHANGE_COOLDOWN()).toNumber(),
    ]);

    await lockedBankVault.connect(alice).assignCombatants(clanId, [playerId, ownerPlayerId, erinPlayerId], playerId);
    await lockedBankVault.connect(alice).attackVault(clanId, bobClanId, playerId);
    await fulfillRandomWords(3, lockedBankVault, mockOracleClient);
    const {timestamp: NOW2} = await ethers.provider.getBlock("latest");

    // Wait another day (check it's not just the clan cooldown)
    expect((await lockedBankVault.getClanInfo(clanId)).totalBrushLocked).to.eq(910);
    expect((await lockedBankVault.getClanInfo(bobClanId)).totalBrushLocked).to.eq(90);

    const LOCK_PERIOD = (await lockedBankVault.LOCK_PERIOD()).toNumber();
    expect((await lockedBankVault.getClanInfo(clanId)).defendingData.length).to.eq(2);
    expect((await lockedBankVault.getClanInfo(clanId)).defendingData[0].amount).to.eq(900);
    expect((await lockedBankVault.getClanInfo(clanId)).defendingData[0].timestamp).to.eq(NOW + LOCK_PERIOD);
    expect((await lockedBankVault.getClanInfo(clanId)).defendingData[1].amount).to.eq(10);
    expect((await lockedBankVault.getClanInfo(clanId)).defendingData[1].timestamp).to.eq(NOW2 + LOCK_PERIOD);

    expect((await lockedBankVault.getClanInfo(bobClanId)).defendingData.length).to.eq(1);
    expect((await lockedBankVault.getClanInfo(bobClanId)).defendingData[0].amount).to.eq(90);
    expect((await lockedBankVault.getClanInfo(bobClanId)).defendingData[0].timestamp).to.eq(NOW1 + LOCK_PERIOD);
  });

  it("Claim rewards when the deadline has expired", async () => {
    const {lockedBankVault, clanId, alice, brush, bankAddress} = await loadFixture(clanFixture);

    await lockFundsForClan(lockedBankVault, clanId, brush, alice, 1000);
    const LOCK_PERIOD = (await lockedBankVault.LOCK_PERIOD()).toNumber();
    const lockPeriodSlice = LOCK_PERIOD / 10;

    await ethers.provider.send("evm_increaseTime", [lockPeriodSlice]);
    await lockFundsForClan(lockedBankVault, clanId, brush, alice, 300);
    await ethers.provider.send("evm_increaseTime", [lockPeriodSlice]);
    await lockFundsForClan(lockedBankVault, clanId, brush, alice, 450);

    // Nothing to claim
    await expect(lockedBankVault.claimFunds(clanId)).to.be.revertedWithCustomError(lockedBankVault, "NothingToClaim");
    await ethers.provider.send("evm_increaseTime", [lockPeriodSlice * 7]);
    await expect(lockedBankVault.claimFunds(clanId)).to.be.revertedWithCustomError(lockedBankVault, "NothingToClaim");
    await ethers.provider.send("evm_increaseTime", [lockPeriodSlice]);
    // Can now claim
    await lockedBankVault.claimFunds(clanId);
    expect(await brush.balanceOf(bankAddress)).to.eq(1000);
    expect(await brush.balanceOf(lockedBankVault.address)).to.eq(750);
    // Cannot claim twice
    await expect(lockedBankVault.claimFunds(clanId)).to.be.revertedWithCustomError(lockedBankVault, "NothingToClaim");
    await ethers.provider.send("evm_increaseTime", [lockPeriodSlice]);
    await ethers.provider.send("evm_increaseTime", [lockPeriodSlice]);
    // Claim both
    await lockedBankVault.claimFunds(clanId);
    expect(await brush.balanceOf(bankAddress)).to.eq(1750);
    expect(await brush.balanceOf(lockedBankVault.address)).to.eq(0);
    // Cannot claim again
    await expect(lockedBankVault.claimFunds(clanId)).to.be.revertedWithCustomError(lockedBankVault, "NothingToClaim");
  });

  it("Cannot attack a clan twice within the cooldown", async () => {});

  it("Player has an attack cooldown if transferring to another clan", async () => {});

  it("Player has a defending cooldown if transferring to another clan", async () => {});

  it("Lock funds on a non-existent clan", async () => {});
});
