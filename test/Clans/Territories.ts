import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {expect} from "chai";
import {clanFixture} from "./utils";
import {allTerritories, allBattleSkills} from "../../scripts/data/territories";
import {ethers} from "hardhat";
import {createPlayer} from "../../scripts/utils";
import {fulfillRandomWords} from "../utils";
import {getXPFromLevel} from "../Players/utils";
import {ClanRank, ItemInput} from "@paintswap/estfor-definitions/types";
import {allItems} from "../../scripts/data/items";
import {EstforConstants} from "@paintswap/estfor-definitions";
import {Block, parseEther} from "ethers";

describe("Territories", function () {
  it("Check defaults", async () => {
    const {territories} = await loadFixture(clanFixture);

    expect(allTerritories.length).to.eq(25);
    expect((await territories.getTerrorities()).length).to.eq(allTerritories.length);
    expect((await territories.getTerritory(1)).territoryId).to.eq(allTerritories[0].territoryId);
    expect((await territories.getTerritory(1)).percentageEmissions).to.eq(allTerritories[0].percentageEmissions);
    expect(await territories.getTotalEmissionPercentage()).to.eq(1000);
  });

  it("Claim an unoccupied territory", async () => {
    const {clanId, playerId, territories, combatantsHelper, brush, alice, mockVRF} = await loadFixture(clanFixture);

    const territoryId = 1;
    await combatantsHelper.connect(alice).assignCombatants(clanId, true, [playerId], false, [], playerId);
    await territories
      .connect(alice)
      .attackTerritory(clanId, territoryId, playerId, {value: await territories.getAttackCost()});
    expect(await brush.balanceOf(alice.address)).to.eq(0);

    const {timestamp: NOW} = (await ethers.provider.getBlock("latest")) as Block;

    expect((await territories.getTerritory(territoryId)).clanIdOccupier).eq(0); // Still 0 until the oracle response is made

    const requestId = 1;
    await fulfillRandomWords(requestId, territories, mockVRF);
    expect((await territories.getTerritory(territoryId)).clanIdOccupier).eq(territoryId);

    const clanInfo = await territories.getClanInfo(clanId);
    expect(clanInfo.ownsTerritoryId).eq(territoryId);
    expect(clanInfo.attackingCooldownTimestamp).eq(NOW + 86400);
  });

  it("Cannot attack a territory which doesn't exist", async () => {
    const {clanId, playerId, territories} = await loadFixture(clanFixture);

    const territoryId = 26;
    await expect(territories.attackTerritory(clanId, territoryId, playerId)).to.be.reverted;
  });

  it("Cannot attack your own territory", async () => {
    const {clanId, playerId, territories, combatantsHelper, alice, mockVRF} = await loadFixture(clanFixture);

    const territoryId = 1;
    await combatantsHelper.connect(alice).assignCombatants(clanId, true, [playerId], false, [], playerId);
    await territories
      .connect(alice)
      .attackTerritory(clanId, territoryId, playerId, {value: await territories.getAttackCost()});
    const requestId = 1;
    await fulfillRandomWords(requestId, territories, mockVRF);

    await ethers.provider.send("evm_increaseTime", [86400]);
    await ethers.provider.send("evm_mine", []);
    await expect(
      territories.connect(alice).attackTerritory(clanId, territoryId, playerId)
    ).to.be.revertedWithCustomError(territories, "CannotAttackSelf");
  });

  it("Can attack another territory if you already own one", async () => {
    const {clanId, playerId, territories, combatantsHelper, alice, mockVRF} = await loadFixture(clanFixture);

    const territoryId = 1;
    await combatantsHelper.connect(alice).assignCombatants(clanId, true, [playerId], false, [], playerId);
    await territories
      .connect(alice)
      .attackTerritory(clanId, territoryId, playerId, {value: await territories.getAttackCost()});

    await ethers.provider.send("evm_increaseTime", [86400]);
    await ethers.provider.send("evm_mine", []);

    const requestId = 1;
    await fulfillRandomWords(requestId, territories, mockVRF);

    await territories
      .connect(alice)
      .attackTerritory(clanId, territoryId + 1, playerId, {value: await territories.getAttackCost()});
    await fulfillRandomWords(requestId + 1, territories, mockVRF);
    // Old territory should be relinquished has no occupier now
    expect((await territories.getTerritory(territoryId)).clanIdOccupier).eq(0);
    expect((await territories.getTerritory(territoryId + 1)).clanIdOccupier).eq(clanId);
  });

  it("Attack an occupied territory and win", async () => {
    const {
      players,
      playerNFT,
      avatarId,
      clans,
      clanId,
      playerId,
      territories,
      combatantsHelper,
      alice,
      bob,
      clanName,
      discord,
      telegram,
      twitter,
      tierId,
      imageId,
      origName,
      mockVRF
    } = await loadFixture(clanFixture);

    const territoryId = 1;

    await combatantsHelper.connect(alice).assignCombatants(clanId, true, [playerId], false, [], playerId);
    await territories
      .connect(alice)
      .attackTerritory(clanId, territoryId, playerId, {value: await territories.getAttackCost()});
    let {timestamp: battleTimestampAlice} = (await ethers.provider.getBlock("latest")) as Block;

    const requestId = 1;
    await fulfillRandomWords(requestId, territories, mockVRF);

    // Create a new player and a new clan
    const bobPlayerId = await createPlayer(playerNFT, avatarId, bob, origName + 1, true);
    await clans.connect(bob).createClan(bobPlayerId, clanName + 1, discord, telegram, twitter, imageId, tierId);

    // Make the attacking players statistically more powerful.
    for (let i = 0; i < allBattleSkills.length; ++i) {
      await players.testModifyXP(bob.address, bobPlayerId, allBattleSkills[i], getXPFromLevel(100), true);
    }

    await combatantsHelper.connect(bob).assignCombatants(clanId + 1, true, [bobPlayerId], false, [], bobPlayerId);
    await territories
      .connect(bob)
      .attackTerritory(clanId + 1, territoryId, bobPlayerId, {value: await territories.getAttackCost()});
    let {timestamp: battleTimestampBob} = (await ethers.provider.getBlock("latest")) as Block;
    await fulfillRandomWords(requestId + 1, territories, mockVRF);

    const territory = (await territories.getTerrorities())[0];
    expect(territory.clanIdOccupier).eq(clanId + 1);

    const defendingClanInfo = await territories.getClanInfo(clanId);
    expect(defendingClanInfo.attackingCooldownTimestamp).eq(battleTimestampAlice + 86400);

    const attackingClanInfo = await territories.getClanInfo(clanId + 1);
    expect(attackingClanInfo.attackingCooldownTimestamp).eq(battleTimestampBob + 86400);
  });

  it("Attack an occupied territory and lose", async () => {
    const {
      players,
      playerNFT,
      avatarId,
      clans,
      clanId,
      playerId,
      territories,
      combatantsHelper,
      alice,
      bob,
      clanName,
      discord,
      telegram,
      twitter,
      tierId,
      imageId,
      origName,
      mockVRF
    } = await loadFixture(clanFixture);

    const territoryId = 1;
    await combatantsHelper.connect(alice).assignCombatants(clanId, true, [playerId], false, [], playerId);
    await territories
      .connect(alice)
      .attackTerritory(clanId, territoryId, playerId, {value: await territories.getAttackCost()});
    let {timestamp: battleTimestampAlice} = (await ethers.provider.getBlock("latest")) as Block;

    const requestId = 1;
    await fulfillRandomWords(requestId, territories, mockVRF);

    // Create a new player and a new clan
    const bobPlayerId = await createPlayer(playerNFT, avatarId, bob, origName + 1, true);
    await clans.connect(bob).createClan(bobPlayerId, clanName + 1, discord, telegram, twitter, imageId, tierId);

    // Make the defending players statistically more powerful.
    for (let i = 0; i < allBattleSkills.length; ++i) {
      await players.testModifyXP(alice.address, playerId, allBattleSkills[i], getXPFromLevel(100), true);
    }

    await combatantsHelper.connect(bob).assignCombatants(clanId + 1, true, [bobPlayerId], false, [], bobPlayerId);
    await territories
      .connect(bob)
      .attackTerritory(clanId + 1, territoryId, bobPlayerId, {value: await territories.getAttackCost()});
    let {timestamp: battleTimestampBob} = (await ethers.provider.getBlock("latest")) as Block;
    await fulfillRandomWords(requestId + 1, territories, mockVRF);

    const territory = (await territories.getTerrorities())[0];
    expect(territory.clanIdOccupier).eq(clanId);

    const defendingClanInfo = await territories.getClanInfo(clanId);
    expect(defendingClanInfo.attackingCooldownTimestamp).eq(battleTimestampAlice + 86400);

    const attackingClanInfo = await territories.getClanInfo(clanId + 1);
    expect(attackingClanInfo.attackingCooldownTimestamp).eq(battleTimestampBob + 86400);
  });

  it("A player cannot defend multiple territories", async () => {
    const {
      players,
      playerNFT,
      avatarId,
      clans,
      clanId,
      playerId,
      territories,
      combatantsHelper,
      owner,
      alice,
      bob,
      charlie,
      erin,
      clanName,
      discord,
      telegram,
      twitter,
      tierId,
      imageId,
      origName,
      mockVRF,
      combatantChangeCooldown
    } = await loadFixture(clanFixture);

    const territoryId = 1;
    const ownerPlayerId = await createPlayer(playerNFT, avatarId, owner, origName + 1, true);
    await clans.requestToJoin(clanId, ownerPlayerId, 0);
    await clans.connect(alice).acceptJoinRequest(clanId, ownerPlayerId, playerId);

    await combatantsHelper
      .connect(alice)
      .assignCombatants(clanId, true, [playerId, ownerPlayerId], false, [], playerId);
    await territories
      .connect(alice)
      .attackTerritory(clanId, territoryId, playerId, {value: await territories.getAttackCost()});

    const requestId = 1;
    await fulfillRandomWords(requestId, territories, mockVRF);

    // The other clan will have 3 players, so if you only have 1 defender you will you lose by default
    for (let i = 0; i < allBattleSkills.length; ++i) {
      await players.testModifyXP(alice.address, playerId, allBattleSkills[i], getXPFromLevel(100), true);
      await players.testModifyXP(owner.address, ownerPlayerId, allBattleSkills[i], getXPFromLevel(100), true);
    }

    // Create a clan of 3 players
    const bobPlayerId = await createPlayer(playerNFT, avatarId, bob, origName + 2, true);
    const charliePlayerId = await createPlayer(playerNFT, avatarId, charlie, origName + 3, true);
    const erinPlayerId = await createPlayer(playerNFT, avatarId, erin, origName + 4, true);

    await clans.connect(bob).createClan(bobPlayerId, clanName + 1, discord, telegram, twitter, imageId, tierId);
    const bobClanId = 2;
    await clans.connect(charlie).requestToJoin(bobClanId, charliePlayerId, 0);
    await clans.connect(bob).acceptJoinRequest(bobClanId, charliePlayerId, bobPlayerId);
    await clans.connect(erin).requestToJoin(bobClanId, erinPlayerId, 0);
    await clans.connect(bob).acceptJoinRequest(bobClanId, erinPlayerId, bobPlayerId);

    // leaves clan, check they are no longer classed as a defender
    let territory = (await territories.getTerrorities())[0];
    expect(territory.clanIdOccupier).eq(clanId);
    await clans.changeRank(clanId, ownerPlayerId, ClanRank.NONE, ownerPlayerId);
    territory = (await territories.getTerrorities())[0];
    expect(territory.clanIdOccupier).eq(clanId);
    const clanInfo = await territories.getClanInfo(clanId);
    expect(clanInfo.playerIds.length).eq(1);
    expect(clanInfo.playerIds[0]).eq(playerId);

    // Make your own clan
    await clans.createClan(ownerPlayerId, clanName + 2, discord, telegram, twitter, imageId, tierId);
    const ownerClanId = 3;

    // Free to attack another territory as you are no longer a defender (but only after player cooldown timestamp)
    await expect(
      combatantsHelper.assignCombatants(ownerClanId, true, [ownerPlayerId], false, [], ownerPlayerId)
    ).to.be.revertedWithCustomError(combatantsHelper, "PlayerCombatantCooldownTimestamp");
    await ethers.provider.send("evm_increaseTime", [combatantChangeCooldown]);
    await ethers.provider.send("evm_mine", []);
    await combatantsHelper.assignCombatants(ownerClanId, true, [ownerPlayerId], false, [], ownerPlayerId);
    await territories.attackTerritory(ownerClanId, territoryId + 1, ownerPlayerId, {
      value: await territories.getAttackCost()
    });
    await fulfillRandomWords(requestId + 1, territories, mockVRF);

    // TODO: Rejoining the old clan does not add you back as a defender

    // Bob should always beat alice's clan as she only has 1 defender
    await combatantsHelper
      .connect(bob)
      .assignCombatants(bobClanId, true, [bobPlayerId, charliePlayerId, erinPlayerId], false, [], bobPlayerId);
    await territories
      .connect(bob)
      .attackTerritory(bobClanId, territoryId, bobPlayerId, {value: await territories.getAttackCost()});
    await fulfillRandomWords(requestId + 2, territories, mockVRF);

    territory = (await territories.getTerrorities())[0];
    expect(territory.clanIdOccupier).eq(bobClanId);
  });

  it("Leaving a clan while in a pending attack should mean you aren't used", async () => {
    const {
      playerNFT,
      avatarId,
      clans,
      clanId,
      playerId,
      territories,
      combatantsHelper,
      alice,
      bob,
      charlie,
      clanName,
      discord,
      telegram,
      twitter,
      tierId,
      imageId,
      origName,
      mockVRF
    } = await loadFixture(clanFixture);

    const territoryId = 1;
    await combatantsHelper.connect(alice).assignCombatants(clanId, true, [playerId], false, [], playerId);
    await territories
      .connect(alice)
      .attackTerritory(clanId, territoryId, playerId, {value: await territories.getAttackCost()});

    const requestId = 1;
    await fulfillRandomWords(requestId, territories, mockVRF);

    // Create a clan of 2 players
    const bobPlayerId = await createPlayer(playerNFT, avatarId, bob, origName + 2, true);
    const charliePlayerId = await createPlayer(playerNFT, avatarId, charlie, origName + 3, true);

    await clans.connect(bob).createClan(bobPlayerId, clanName + 1, discord, telegram, twitter, imageId, tierId);
    const bobClanId = 2;
    await clans.connect(charlie).requestToJoin(bobClanId, charliePlayerId, 0);
    await clans.connect(bob).acceptJoinRequest(bobClanId, charliePlayerId, bobPlayerId);

    await combatantsHelper.connect(bob).assignCombatants(bobClanId, true, [charliePlayerId], false, [], bobPlayerId);
    await territories
      .connect(bob)
      .attackTerritory(bobClanId, territoryId, bobPlayerId, {value: await territories.getAttackCost()});
    // After attacking, leave the clan before the battle is resolved

    let pendingAttack = await territories.getPendingAttack(2);
    expect(pendingAttack.clanId).to.eq(bobClanId);
    await clans.connect(charlie).changeRank(bobClanId, charliePlayerId, ClanRank.NONE, charliePlayerId);
    pendingAttack = await territories.getPendingAttack(2);
    expect(pendingAttack.clanId).to.eq(bobClanId);
    const clanInfo = await territories.getClanInfo(bobClanId);
    expect(clanInfo.playerIds.length).eq(0);

    await fulfillRandomWords(requestId + 1, territories, mockVRF);
    const territory = await territories.getTerritory(territoryId);
    expect(territory.clanIdOccupier).eq(clanId);
  });

  it("Clan is destroyed after a pending attack, should auto lose", async () => {
    const {
      playerNFT,
      avatarId,
      clans,
      clanId,
      playerId,
      territories,
      combatantsHelper,
      alice,
      bob,
      clanName,
      discord,
      telegram,
      twitter,
      tierId,
      imageId,
      origName,
      mockVRF
    } = await loadFixture(clanFixture);

    const territoryId = 1;
    await combatantsHelper.connect(alice).assignCombatants(clanId, true, [playerId], false, [], playerId);
    await territories
      .connect(alice)
      .attackTerritory(clanId, territoryId, playerId, {value: await territories.getAttackCost()});
    const requestId = 1;
    await fulfillRandomWords(requestId, territories, mockVRF);

    const bobPlayerId = await createPlayer(playerNFT, avatarId, bob, origName + 2, true);
    await clans.connect(bob).createClan(bobPlayerId, clanName + 1, discord, telegram, twitter, imageId, tierId);
    const bobClanId = 2;
    await combatantsHelper.connect(bob).assignCombatants(bobClanId, true, [bobPlayerId], false, [], bobPlayerId);
    await territories
      .connect(bob)
      .attackTerritory(bobClanId, territoryId, bobPlayerId, {value: await territories.getAttackCost()});
    // After attacking, leave the clan which destroys it before the battle is resolved

    let pendingAttack = await territories.getPendingAttack(2);
    expect(pendingAttack.clanId).to.eq(bobClanId);
    await clans.connect(bob).changeRank(bobClanId, bobPlayerId, ClanRank.NONE, bobPlayerId);

    pendingAttack = await territories.getPendingAttack(2);
    expect(pendingAttack.clanId).to.eq(bobClanId);
    const clanInfo = await territories.getClanInfo(bobClanId);
    expect(clanInfo.playerIds.length).eq(0);

    await fulfillRandomWords(requestId + 1, territories, mockVRF);
    const territory = await territories.getTerritory(territoryId);
    expect(territory.clanIdOccupier).eq(clanId);
  });

  it("Clan is destroyed after taking control of a territory, should auto lose", async () => {
    const {
      playerNFT,
      avatarId,
      clans,
      clanId,
      playerId,
      territories,
      combatantsHelper,
      alice,
      bob,
      clanName,
      discord,
      telegram,
      twitter,
      tierId,
      imageId,
      origName,
      mockVRF
    } = await loadFixture(clanFixture);

    const territoryId = 1;
    await combatantsHelper.connect(alice).assignCombatants(clanId, true, [playerId], false, [], playerId);
    await territories
      .connect(alice)
      .attackTerritory(clanId, territoryId, playerId, {value: await territories.getAttackCost()});
    const requestId = 1;
    await fulfillRandomWords(requestId, territories, mockVRF);

    await clans.connect(alice).changeRank(clanId, playerId, ClanRank.NONE, playerId);

    const bobPlayerId = await createPlayer(playerNFT, avatarId, bob, origName + 2, true);
    await clans.connect(bob).createClan(bobPlayerId, clanName + 1, discord, telegram, twitter, imageId, tierId);

    const bobClanId = 2;
    await combatantsHelper.connect(bob).assignCombatants(bobClanId, true, [bobPlayerId], false, [], bobPlayerId);
    await territories
      .connect(bob)
      .attackTerritory(bobClanId, territoryId, bobPlayerId, {value: await territories.getAttackCost()});
    await fulfillRandomWords(requestId + 1, territories, mockVRF);

    const territory = await territories.getTerritory(territoryId);
    expect(territory.clanIdOccupier).eq(bobClanId);
  });

  it("Multiple clans should be able to attack an occupied territory", async () => {});

  it("Attacking players array should be sorted and without duplicates", async () => {
    const {playerNFT, avatarId, clans, clanId, playerId, combatantsHelper, owner, alice, origName} = await loadFixture(
      clanFixture
    );

    const ownerPlayerId = await createPlayer(playerNFT, avatarId, owner, origName + 1, true);
    await clans.requestToJoin(clanId, ownerPlayerId, 0);
    await clans.connect(alice).acceptJoinRequest(clanId, ownerPlayerId, playerId);

    await expect(
      combatantsHelper.connect(alice).assignCombatants(clanId, true, [playerId, playerId], false, [], playerId)
    ).to.be.revertedWithCustomError(combatantsHelper, "PlayerIdsNotSortedOrDuplicates");

    await expect(
      combatantsHelper.connect(alice).assignCombatants(clanId, true, [ownerPlayerId, playerId], false, [], playerId)
    ).to.be.revertedWithCustomError(combatantsHelper, "PlayerIdsNotSortedOrDuplicates");
  });

  it("Must be a leader to attack a territory", async () => {
    const {playerNFT, avatarId, clans, clanId, playerId, territories, combatantsHelper, owner, alice, origName} =
      await loadFixture(clanFixture);

    const territoryId = 1;
    const ownerPlayerId = await createPlayer(playerNFT, avatarId, owner, origName + 1, true);
    await clans.requestToJoin(clanId, ownerPlayerId, 0);
    await clans.connect(alice).acceptJoinRequest(clanId, ownerPlayerId, playerId);
    await clans.connect(alice).changeRank(clanId, ownerPlayerId, ClanRank.TREASURER, playerId);

    await combatantsHelper
      .connect(alice)
      .assignCombatants(clanId, true, [playerId, ownerPlayerId], false, [], playerId);
    await expect(
      territories
        .connect(owner)
        .attackTerritory(clanId, territoryId, ownerPlayerId, {value: await territories.getAttackCost()})
    ).to.be.revertedWithCustomError(territories, "NotLeader");
    await clans.connect(alice).changeRank(clanId, ownerPlayerId, ClanRank.LEADER, playerId);
    await territories
      .connect(owner)
      .attackTerritory(clanId, territoryId, ownerPlayerId, {value: await territories.getAttackCost()});
  });

  it("Is owner of player when attacking", async () => {
    const {clanId, playerId, territories, owner} = await loadFixture(clanFixture);

    const territoryId = 1;
    await expect(
      territories.connect(owner).attackTerritory(clanId, territoryId, playerId)
    ).to.be.revertedWithCustomError(territories, "NotOwnerOfPlayerAndActive");
  });

  it("Occupied territories should emit brush", async () => {
    const {clanId, playerId, territories, combatantsHelper, brush, alice, bankFactory, lockedBankVaults, mockVRF} =
      await loadFixture(clanFixture);

    const territoryId = 1;
    await combatantsHelper.connect(alice).assignCombatants(clanId, true, [playerId], false, [], playerId);
    await territories
      .connect(alice)
      .attackTerritory(clanId, territoryId, playerId, {value: await territories.getAttackCost()});
    const requestId = 1;
    await fulfillRandomWords(requestId, territories, mockVRF);

    await brush.mint(alice, parseEther("1000"));
    await brush.connect(alice).approve(territories, parseEther("1000"));
    await territories.connect(alice).addUnclaimedEmissions(parseEther("1000"));

    expect((await territories.getTerritory(territoryId)).unclaimedEmissions).to.eq(parseEther("100"));

    //    const bankAddress = await bankFactory.bankAddress(clanId);
    //    expect((await territories.getClanInfo(clanId)).bank).to.eq(ZeroAddress);
    await territories.connect(alice).harvest(territoryId, playerId);
    // After harvesting the clan bank address should be set on clans object
    //    expect((await territories.getClanInfo(clanId)).bank).to.eq(bankAddress);

    const {timestamp: NOW} = (await ethers.provider.getBlock("latest")) as Block;
    expect((await territories.getTerritory(territoryId)).unclaimedEmissions).to.eq(parseEther("0"));
    expect((await territories.getTerritory(territoryId)).lastClaimTimestamp).to.eq(NOW);

    expect(await brush.balanceOf(lockedBankVaults)).to.eq(parseEther("100"));
    expect((await lockedBankVaults.getClanInfo(clanId)).totalBrushLocked).to.eq(parseEther("100"));
    //    expect((await lockedBankVaults.getClanInfo(clanId)).bank).to.eq(bankAddress);
  });

  it("Can only claim emissions once every 8 hours", async () => {
    const {clanId, playerId, territories, combatantsHelper, brush, alice, mockVRF} = await loadFixture(clanFixture);

    const territoryId = 1;
    await combatantsHelper.connect(alice).assignCombatants(clanId, true, [playerId], false, [], playerId);
    await territories
      .connect(alice)
      .attackTerritory(clanId, territoryId, playerId, {value: await territories.getAttackCost()});

    const requestId = 1;
    await fulfillRandomWords(requestId, territories, mockVRF);

    await brush.mint(alice, parseEther("1000"));
    await brush.connect(alice).approve(territories, parseEther("1000"));
    await territories.connect(alice).addUnclaimedEmissions(parseEther("500"));
    await territories.connect(alice).harvest(territoryId, playerId);
    await territories.connect(alice).addUnclaimedEmissions(parseEther("500"));
    await expect(territories.connect(alice).harvest(territoryId, playerId)).to.be.revertedWithCustomError(
      territories,
      "HarvestingTooSoon"
    );

    // increase time by territories.HARVESTING_COOLDOWN()
    await ethers.provider.send("evm_increaseTime", [Number(await territories.HARVESTING_COOLDOWN())]);
    await ethers.provider.send("evm_mine", []);
    await expect(territories.connect(alice).harvest(territoryId, playerId)).to.not.be.reverted;
  });

  it("Must be member of this clan to harvest", async () => {
    const {
      clanId,
      playerId,
      territories,
      combatantsHelper,
      brush,
      alice,
      mockVRF,
      clans,
      bob,
      playerNFT,
      avatarId,
      origName,
      clanName,
      discord,
      twitter,
      telegram,
      imageId,
      tierId
    } = await loadFixture(clanFixture);

    const territoryId = 1;
    await combatantsHelper.connect(alice).assignCombatants(clanId, true, [playerId], false, [], playerId);
    await territories
      .connect(alice)
      .attackTerritory(clanId, territoryId, playerId, {value: await territories.getAttackCost()});

    const requestId = 1;
    await fulfillRandomWords(requestId, territories, mockVRF);

    await brush.mint(alice, parseEther("1000"));
    await brush.connect(alice).approve(territories, parseEther("1000"));
    await territories.connect(alice).addUnclaimedEmissions(parseEther("500"));

    // Create a new player and a new clan
    const bobPlayerId = await createPlayer(playerNFT, avatarId, bob, origName + 1, true);
    await clans.connect(bob).createClan(bobPlayerId, clanName + 1, discord, telegram, twitter, imageId, tierId);

    await expect(territories.connect(bob).harvest(territoryId, bobPlayerId)).to.revertedWithCustomError(
      territories,
      "NotMemberOfClan"
    );
  });

  it("Cannot only change combatants after the cooldown change deadline has passed", async function () {
    const {territories, combatantsHelper, combatantChangeCooldown, clanId, playerId, alice} = await loadFixture(
      clanFixture
    );

    await combatantsHelper.connect(alice).assignCombatants(clanId, true, [playerId], false, [], playerId);
    // Clear player id part so we can hit the custom error we want
    await combatantsHelper.clearCooldowns([playerId]);

    await expect(
      combatantsHelper.connect(alice).assignCombatants(clanId, true, [playerId], false, [], playerId)
    ).to.be.revertedWithCustomError(territories, "ClanCombatantsChangeCooldown");

    // Update time by combatantChangeCooldown
    await ethers.provider.send("evm_increaseTime", [combatantChangeCooldown - 5]);
    await ethers.provider.send("evm_mine", []);
    await expect(
      combatantsHelper.connect(alice).assignCombatants(clanId, true, [playerId], false, [], playerId)
    ).to.be.revertedWithCustomError(territories, "ClanCombatantsChangeCooldown");
    await ethers.provider.send("evm_increaseTime", [5]);
    await ethers.provider.send("evm_mine", []);
    await combatantsHelper.connect(alice).assignCombatants(clanId, true, [playerId], false, [], playerId);
  });

  it("Add new territory", async () => {
    const {territories} = await loadFixture(clanFixture);

    // Should fail as the total is already maxed
    let addTerritory = {...allTerritories[0], territoryId: 27, percentageEmissions: 10};
    await expect(territories.addTerritories([addTerritory])).to.be.revertedWithCustomError(
      territories,
      "InvalidTerritoryId"
    );

    addTerritory.territoryId = 26;
    await expect(territories.addTerritories([addTerritory])).to.be.revertedWithCustomError(
      territories,
      "InvalidEmissionPercentage"
    );

    addTerritory.percentageEmissions = 0;
    await expect(territories.addTerritories([addTerritory])).to.be.revertedWithCustomError(
      territories,
      "InvalidTerritory"
    );

    addTerritory.percentageEmissions = 10;

    // Edit another one so that percentage emissions can not exceed the max
    const editedTerritory = {...allTerritories[0], percentageEmissions: 90};
    await territories.editTerritories([editedTerritory]);

    await territories.addTerritories([addTerritory]);

    const newTerritoryAdded = await territories.getTerritory(26);
    expect(newTerritoryAdded.percentageEmissions).eq(addTerritory.percentageEmissions);
  });

  it("Edit territory", async () => {
    const {territories} = await loadFixture(clanFixture);

    const editedTerritory = {...allTerritories[0], percentageEmissions: 90};

    await territories.editTerritories([editedTerritory]);
    expect((await territories.getTerritory(allTerritories[0].territoryId)).percentageEmissions).to.eq(90);

    // Other ones should not be changed
    for (const territory of allTerritories) {
      if (territory.territoryId != 1) {
        expect(territory.percentageEmissions).to.eq(
          (await territories.getTerritory(territory.territoryId)).percentageEmissions
        );
      }
    }
  });

  it("Remove territory", async () => {
    const {territories} = await loadFixture(clanFixture);

    const territoryId = 1;
    await territories.removeTerritories([territoryId]);
    expect((await territories.getTerritory(territoryId)).percentageEmissions).to.eq(0);
    // Check the others haven't changed
    expect((await territories.getTerritory(territoryId + 1)).percentageEmissions).to.eq(100);
  });

  it("Attack territory gas price", async () => {
    const {
      players,
      playerNFT,
      avatarId,
      clans,
      clanId,
      playerId,
      territories,
      combatantsHelper,
      alice,
      bob,
      clanName,
      discord,
      telegram,
      twitter,
      tierId,
      imageId,
      origName,
      mockVRF,
      vrfRequestInfo
    } = await loadFixture(clanFixture);

    const territoryId = 1;

    await combatantsHelper.connect(alice).assignCombatants(clanId, true, [playerId], false, [], playerId);
    await territories
      .connect(alice)
      .attackTerritory(clanId, territoryId, playerId, {value: await territories.getAttackCost()});

    // Create a new player and a new clan
    const bobPlayerId = await createPlayer(playerNFT, avatarId, bob, origName + 1, true);
    await clans.connect(bob).createClan(bobPlayerId, clanName + 1, discord, telegram, twitter, imageId, tierId);

    // Make the attacking players statistically more powerful.
    for (let i = 0; i < allBattleSkills.length; ++i) {
      await players.testModifyXP(bob.address, bobPlayerId, allBattleSkills[i], getXPFromLevel(100), true);
    }

    await combatantsHelper.connect(bob).assignCombatants(clanId + 1, true, [bobPlayerId], false, [], bobPlayerId);
    const tx = await territories
      .connect(bob)
      .attackTerritory(clanId + 1, territoryId, bobPlayerId, {value: await territories.getAttackCost()});
    const requestId = 1;
    await fulfillRandomWords(requestId, territories, mockVRF);

    const {gasPrice} = tx;

    // Useful to re-run a battle for testing
    await territories.setAttackInProgress(requestId);
    await fulfillRandomWords(requestId, territories, mockVRF);
    expect(await vrfRequestInfo.getMovingAverageGasPrice()).to.eq(0);

    let attackCost = await territories.getAttackCost();
    const baseAttackCost = await vrfRequestInfo.getBaseRequestCost();
    expect(attackCost).to.eq(baseAttackCost);

    await territories.setAttackInProgress(requestId);
    await fulfillRandomWords(requestId, territories, mockVRF, gasPrice + 1000n);
    const bigZero = 0n;
    // The big zeros are there to show all the values used
    expect(await vrfRequestInfo.getMovingAverageGasPrice()).to.eq(
      (bigZero + bigZero + bigZero + (gasPrice + 1000n)) / 4n
    );

    attackCost = await territories.getAttackCost();
    const expectedGasLimit = await territories.getExpectedGasLimitFulfill();
    expect(attackCost).to.eq(baseAttackCost + (await vrfRequestInfo.getMovingAverageGasPrice()) * expectedGasLimit);

    await territories.setAttackInProgress(requestId);
    await fulfillRandomWords(requestId, territories, mockVRF, gasPrice + 900n);
    await territories.setAttackInProgress(requestId);
    await fulfillRandomWords(requestId, territories, mockVRF, gasPrice + 800n);
    await territories.setAttackInProgress(requestId);
    await fulfillRandomWords(requestId, territories, mockVRF, gasPrice + 500n);
    await territories.setAttackInProgress(requestId);
    await fulfillRandomWords(requestId, territories, mockVRF, gasPrice + 200n);

    expect(await vrfRequestInfo.getMovingAverageGasPrice()).to.eq(
      (gasPrice + 900n + gasPrice + 800n + gasPrice + 500n + gasPrice + 200n) / 4n
    );
    attackCost = await territories.getAttackCost();
    expect(attackCost).to.eq(baseAttackCost + (await vrfRequestInfo.getMovingAverageGasPrice()) * expectedGasLimit);
  });

  it("Assigning new combatants is allowed while holding a territory", async () => {
    const {clanId, playerId, territories, combatantsHelper, combatantChangeCooldown, alice, mockVRF} =
      await loadFixture(clanFixture);

    const territoryId = 1;
    await combatantsHelper.connect(alice).assignCombatants(clanId, true, [playerId], false, [], playerId);
    await territories
      .connect(alice)
      .attackTerritory(clanId, territoryId, playerId, {value: await territories.getAttackCost()});
    const requestId = 1;
    await fulfillRandomWords(requestId, territories, mockVRF);
    expect((await territories.getTerritory(territoryId)).clanIdOccupier).eq(territoryId);

    const clanInfo = await territories.getClanInfo(clanId);
    expect(clanInfo.ownsTerritoryId).eq(territoryId);
    await ethers.provider.send("evm_increaseTime", [combatantChangeCooldown]);
    await ethers.provider.send("evm_mine", []);
    await expect(combatantsHelper.connect(alice).assignCombatants(clanId, true, [playerId], false, [], playerId)).to.not
      .be.reverted;
  });

  it("Blocking attacks with item", async () => {
    const {
      playerNFT,
      itemNFT,
      avatarId,
      clans,
      clanId,
      playerId,
      territories,
      combatantsHelper,
      alice,
      bob,
      clanName,
      discord,
      telegram,
      twitter,
      tierId,
      imageId,
      origName,
      mockVRF
    } = await loadFixture(clanFixture);

    const territoryId = 1;

    await combatantsHelper.connect(alice).assignCombatants(clanId, true, [playerId], false, [], playerId);
    await territories
      .connect(alice)
      .attackTerritory(clanId, territoryId, playerId, {value: await territories.getAttackCost()});

    const requestId = 1;
    await fulfillRandomWords(requestId, territories, mockVRF);

    // Create a new player and a new clan
    const bobPlayerId = await createPlayer(playerNFT, avatarId, bob, origName + 1, true);
    await clans.connect(bob).createClan(bobPlayerId, clanName + 1, discord, telegram, twitter, imageId, tierId);

    const bobClanId = clanId + 1;
    await combatantsHelper.connect(bob).assignCombatants(bobClanId, true, [bobPlayerId], false, [], bobPlayerId);

    const items = allItems.filter(
      (inputItem) =>
        inputItem.tokenId == EstforConstants.MIRROR_SHIELD || inputItem.tokenId == EstforConstants.PROTECTION_SHIELD
    );
    await itemNFT.addItems(items);
    await itemNFT.testMints(alice.address, [EstforConstants.MIRROR_SHIELD, EstforConstants.PROTECTION_SHIELD], [2, 1]);

    // Wrong item
    await expect(
      territories.connect(alice).blockAttacks(clanId, EstforConstants.PROTECTION_SHIELD, playerId)
    ).to.be.revertedWithCustomError(territories, "NotATerritoryDefenceItem");

    // Correct item
    const itemTokenId = EstforConstants.MIRROR_SHIELD;
    const mirrorShield = items.find((item) => item.tokenId == itemTokenId) as ItemInput;
    const {timestamp: NOW} = (await ethers.provider.getBlock("latest")) as Block;
    const blockAttacksTimestamp = NOW + mirrorShield.boostDuration + 1;

    await expect(territories.connect(alice).blockAttacks(clanId, itemTokenId, playerId))
      .to.emit(territories, "BlockingAttacks")
      .withArgs(
        clanId,
        itemTokenId,
        alice.address,
        playerId,
        blockAttacksTimestamp,
        blockAttacksTimestamp + mirrorShield.boostValue * 3600
      );

    expect(await itemNFT.balanceOf(alice.address, itemTokenId)).to.eq(1);

    await expect(
      territories
        .connect(bob)
        .attackTerritory(bobClanId, territoryId, bobPlayerId, {value: await territories.getAttackCost()})
    ).to.be.revertedWithCustomError(territories, "ClanIsBlockingAttacks");

    await ethers.provider.send("evm_increaseTime", [mirrorShield.boostDuration - 10]);
    await ethers.provider.send("evm_mine", []);

    await expect(
      territories
        .connect(bob)
        .attackTerritory(bobClanId, territoryId, bobPlayerId, {value: await territories.getAttackCost()})
    ).to.be.revertedWithCustomError(territories, "ClanIsBlockingAttacks");

    // Cannot apply it until the cooldown is done
    await expect(territories.connect(alice).blockAttacks(clanId, itemTokenId, playerId)).to.be.revertedWithCustomError(
      territories,
      "BlockAttacksCooldown"
    );
    // Go to just before the end
    await ethers.provider.send("evm_increaseTime", [mirrorShield.boostValue * 3600]);
    await ethers.provider.send("evm_mine", []);
    await expect(territories.connect(alice).blockAttacks(clanId, itemTokenId, playerId)).to.be.revertedWithCustomError(
      territories,
      "BlockAttacksCooldown"
    );
    // Now go past
    await ethers.provider.send("evm_increaseTime", [10]);
    await ethers.provider.send("evm_mine", []);
    await territories.connect(alice).blockAttacks(clanId, itemTokenId, playerId);

    await ethers.provider.send("evm_increaseTime", [mirrorShield.boostDuration - 10]);
    await ethers.provider.send("evm_mine", []);

    await expect(
      territories
        .connect(bob)
        .attackTerritory(bobClanId, territoryId, bobPlayerId, {value: await territories.getAttackCost()})
    ).to.be.revertedWithCustomError(territories, "ClanIsBlockingAttacks");

    // Can now attack
    await ethers.provider.send("evm_increaseTime", [10]);
    await ethers.provider.send("evm_mine", []);
    await expect(
      territories
        .connect(bob)
        .attackTerritory(bobClanId, territoryId, bobPlayerId, {value: await territories.getAttackCost()})
    ).to.not.be.reverted;
    expect(await itemNFT.balanceOf(alice.address, itemTokenId)).to.eq(0);
  });

  it("Must have at least minimum MMR to attack a territory", async () => {
    const {
      playerNFT,
      avatarId,
      clans,
      clanId,
      playerId,
      territories,
      combatantsHelper,
      owner,
      alice,
      origName,
      initialMMR
    } = await loadFixture(clanFixture);

    const territoryId = 1;
    const ownerPlayerId = await createPlayer(playerNFT, avatarId, owner, origName + 1, true);
    await clans.requestToJoin(clanId, ownerPlayerId, 0);
    await clans.connect(alice).acceptJoinRequest(clanId, ownerPlayerId, playerId);

    await combatantsHelper
      .connect(alice)
      .assignCombatants(clanId, true, [playerId, ownerPlayerId], false, [], playerId);

    // Must be minimum clan MMR to attack this territory
    await territories.setMinimumMMRs([territoryId], [initialMMR + 1]);

    await expect(
      territories
        .connect(alice)
        .attackTerritory(clanId, territoryId, playerId, {value: await territories.getAttackCost()})
    ).to.be.revertedWithCustomError(territories, "NotEnoughMMR");

    await territories.setMinimumMMRs([territoryId], [initialMMR]);
    await expect(
      territories
        .connect(alice)
        .attackTerritory(clanId, territoryId, playerId, {value: await territories.getAttackCost()})
    ).to.not.be.reverted;
  });

  it("Cannot be used to attack a territory if you are defending a locked bank vault", async () => {});

  it("Leaving clan during a pending attack before oracle is called (can you join another clan and do anything?)", async () => {});

  it("Attacking cooldown for clan", async () => {});

  it("Attacking cooldown for player", async () => {});
});
