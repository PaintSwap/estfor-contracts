import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {expect} from "chai";
import {clanFixture} from "./utils";
import {allTerritories, allTerritorySkills} from "../../scripts/data/territories";
import {ethers} from "hardhat";
import {createPlayer} from "../../scripts/utils";
import {fulfillRandomWords} from "../utils";
import {getXPFromLevel} from "../Players/utils";
import {ClanRank} from "@paintswap/estfor-definitions/types";
import {BigNumber} from "ethers";

describe("Territories", function () {
  it("Check defaults", async () => {
    const {territories} = await loadFixture(clanFixture);

    expect(allTerritories.length).to.eq(25);
    expect((await territories.getTerrorities()).length).to.eq(allTerritories.length);
    expect((await territories.territories(1)).territoryId).to.eq(allTerritories[0].territoryId);
    expect((await territories.territories(1)).percentageEmissions).to.eq(allTerritories[0].percentageEmissions);
    expect(await territories.totalEmissionPercentage()).to.eq(1000);
  });

  it("Claim an unoccupied territory", async () => {
    const {clanId, playerId, territories, combatantsHelper, brush, alice} = await loadFixture(clanFixture);

    const territoryId = 1;
    await combatantsHelper.connect(alice).assignCombatants(clanId, true, [playerId], false, [], playerId);
    await territories
      .connect(alice)
      .attackTerritory(clanId, territoryId, playerId, {value: await territories.attackCost()});
    expect(await brush.balanceOf(alice.address)).to.eq(0);

    const {timestamp: NOW} = await ethers.provider.getBlock("latest");

    const territory = (await territories.getTerrorities())[0];
    expect(territory.clanIdOccupier).eq(clanId);

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
    const {clanId, playerId, territories, combatantsHelper, alice} = await loadFixture(clanFixture);

    const territoryId = 1;
    await combatantsHelper.connect(alice).assignCombatants(clanId, true, [playerId], false, [], playerId);
    await territories
      .connect(alice)
      .attackTerritory(clanId, territoryId, playerId, {value: await territories.attackCost()});

    await ethers.provider.send("evm_increaseTime", [86400]);
    await expect(
      territories.connect(alice).attackTerritory(clanId, territoryId, playerId)
    ).to.be.revertedWithCustomError(territories, "AlreadyOwnATerritory");
  });

  it("Cannot attack a territory if you own one", async () => {
    const {clanId, playerId, territories, combatantsHelper, alice} = await loadFixture(clanFixture);

    const territoryId = 1;
    await combatantsHelper.connect(alice).assignCombatants(clanId, true, [playerId], false, [], playerId);
    await territories
      .connect(alice)
      .attackTerritory(clanId, territoryId, playerId, {value: await territories.attackCost()});

    await ethers.provider.send("evm_increaseTime", [86400]);
    await expect(
      territories.connect(alice).attackTerritory(clanId, territoryId + 1, playerId)
    ).to.be.revertedWithCustomError(territories, "AlreadyOwnATerritory");
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
      tierId,
      imageId,
      origName,
      mockAPI3OracleClient,
    } = await loadFixture(clanFixture);

    const territoryId = 1;

    await combatantsHelper.connect(alice).assignCombatants(clanId, true, [playerId], false, [], playerId);
    await territories
      .connect(alice)
      .attackTerritory(clanId, territoryId, playerId, {value: await territories.attackCost()});

    // Create a new player and a new clan
    const bobPlayerId = await createPlayer(playerNFT, avatarId, bob, origName + 1, true);
    await clans.connect(bob).createClan(bobPlayerId, clanName + 1, discord, telegram, imageId, tierId);

    // Make the attacking players statistically more powerful.
    for (let i = 0; i < allTerritorySkills.length; ++i) {
      await players.testModifyXP(bob.address, bobPlayerId, allTerritorySkills[i], getXPFromLevel(100), true);
    }

    await combatantsHelper.connect(bob).assignCombatants(clanId + 1, true, [bobPlayerId], false, [], bobPlayerId);
    await territories
      .connect(bob)
      .attackTerritory(clanId + 1, territoryId, bobPlayerId, {value: await territories.attackCost()});
    let {timestamp: battleTimestamp} = await ethers.provider.getBlock("latest");
    const requestId = 1;
    await fulfillRandomWords(requestId, territories, mockAPI3OracleClient);

    const territory = (await territories.getTerrorities())[0];
    expect(territory.clanIdOccupier).eq(clanId + 1);

    const defendingClanInfo = await territories.getClanInfo(clanId);
    expect(defendingClanInfo.attackingCooldownTimestamp).eq(battleTimestamp + 86400);

    const attackingClanInfo = await territories.getClanInfo(clanId + 1);
    expect(attackingClanInfo.attackingCooldownTimestamp).eq(battleTimestamp + 86400);
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
      tierId,
      imageId,
      origName,
      mockAPI3OracleClient,
    } = await loadFixture(clanFixture);

    const territoryId = 1;
    await combatantsHelper.connect(alice).assignCombatants(clanId, true, [playerId], false, [], playerId);
    await territories
      .connect(alice)
      .attackTerritory(clanId, territoryId, playerId, {value: await territories.attackCost()});

    // Create a new player and a new clan
    const bobPlayerId = await createPlayer(playerNFT, avatarId, bob, origName + 1, true);
    await clans.connect(bob).createClan(bobPlayerId, clanName + 1, discord, telegram, imageId, tierId);

    // Make the defending players statistically more powerful.
    for (let i = 0; i < allTerritorySkills.length; ++i) {
      await players.testModifyXP(alice.address, playerId, allTerritorySkills[i], getXPFromLevel(100), true);
    }

    await combatantsHelper.connect(bob).assignCombatants(clanId + 1, true, [bobPlayerId], false, [], bobPlayerId);
    await territories
      .connect(bob)
      .attackTerritory(clanId + 1, territoryId, bobPlayerId, {value: await territories.attackCost()});
    let {timestamp: battleTimestamp} = await ethers.provider.getBlock("latest");
    const requestId = 1;
    await fulfillRandomWords(requestId, territories, mockAPI3OracleClient);

    const territory = (await territories.getTerrorities())[0];
    expect(territory.clanIdOccupier).eq(clanId);

    const defendingClanInfo = await territories.getClanInfo(clanId);
    expect(defendingClanInfo.attackingCooldownTimestamp).eq(battleTimestamp + 86400);

    const attackingClanInfo = await territories.getClanInfo(clanId + 1);
    expect(attackingClanInfo.attackingCooldownTimestamp).eq(battleTimestamp + 86400);
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
      tierId,
      imageId,
      origName,
      mockAPI3OracleClient,
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
      .attackTerritory(clanId, territoryId, playerId, {value: await territories.attackCost()});

    // The other clan will have 3 players, so if you only have 1 defender you will you lose by default
    for (let i = 0; i < allTerritorySkills.length; ++i) {
      await players.testModifyXP(alice.address, playerId, allTerritorySkills[i], getXPFromLevel(100), true);
      await players.testModifyXP(owner.address, ownerPlayerId, allTerritorySkills[i], getXPFromLevel(100), true);
    }

    // Create a clan of 3 players
    const bobPlayerId = await createPlayer(playerNFT, avatarId, bob, origName + 2, true);
    const charliePlayerId = await createPlayer(playerNFT, avatarId, charlie, origName + 3, true);
    const erinPlayerId = await createPlayer(playerNFT, avatarId, erin, origName + 4, true);

    await clans.connect(bob).createClan(bobPlayerId, clanName + 1, discord, telegram, imageId, tierId);
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
    expect(clanInfo.playerIds.length).eq(2);
    expect(clanInfo.playerIds[0]).eq(playerId);
    expect(clanInfo.playerIds[1]).eq(0); // Still 2 playerIds but the member who left is now 0

    // Make your own clan
    await clans.createClan(ownerPlayerId, clanName + 2, discord, telegram, imageId, tierId);
    const ownerClanId = 3;

    // Free to attack another territory as you are no longer a defender (but only after player cooldown timestamp)
    await expect(
      combatantsHelper.assignCombatants(ownerClanId, true, [ownerPlayerId], false, [], ownerPlayerId)
    ).to.be.revertedWithCustomError(territories, "PlayerCombatantCooldownTimestamp");
    await ethers.provider.send("evm_increaseTime", [(await territories.COMBATANT_COOLDOWN()).toNumber()]);
    await combatantsHelper.assignCombatants(ownerClanId, true, [ownerPlayerId], false, [], ownerPlayerId);
    await territories.attackTerritory(ownerClanId, territoryId + 1, ownerPlayerId, {
      value: await territories.attackCost(),
    });

    // TODO: Rejoining the old clan does not add you back as a defender

    // Bob should always beat alice's clan as she only has 1 defender
    await combatantsHelper
      .connect(bob)
      .assignCombatants(bobClanId, true, [bobPlayerId, charliePlayerId, erinPlayerId], false, [], bobPlayerId);
    await territories
      .connect(bob)
      .attackTerritory(bobClanId, territoryId, bobPlayerId, {value: await territories.attackCost()});
    await fulfillRandomWords(1, territories, mockAPI3OracleClient);

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
      tierId,
      imageId,
      origName,
      mockAPI3OracleClient,
    } = await loadFixture(clanFixture);

    const territoryId = 1;
    await combatantsHelper.connect(alice).assignCombatants(clanId, true, [playerId], false, [], playerId);
    await territories
      .connect(alice)
      .attackTerritory(clanId, territoryId, playerId, {value: await territories.attackCost()});

    // Create a clan of 2 players
    const bobPlayerId = await createPlayer(playerNFT, avatarId, bob, origName + 2, true);
    const charliePlayerId = await createPlayer(playerNFT, avatarId, charlie, origName + 3, true);

    await clans.connect(bob).createClan(bobPlayerId, clanName + 1, discord, telegram, imageId, tierId);
    const bobClanId = 2;
    await clans.connect(charlie).requestToJoin(bobClanId, charliePlayerId, 0);
    await clans.connect(bob).acceptJoinRequest(bobClanId, charliePlayerId, bobPlayerId);

    await combatantsHelper.connect(bob).assignCombatants(bobClanId, true, [charliePlayerId], false, [], bobPlayerId);
    await territories
      .connect(bob)
      .attackTerritory(bobClanId, territoryId, bobPlayerId, {value: await territories.attackCost()});
    // After attacking, leave the clan before the battle is resolved

    let pendingAttack = await territories.getPendingAttack(2);
    expect(pendingAttack.clanId).to.eq(bobClanId);
    await clans.connect(charlie).changeRank(bobClanId, charliePlayerId, ClanRank.NONE, charliePlayerId);
    pendingAttack = await territories.getPendingAttack(2);
    expect(pendingAttack.clanId).to.eq(bobClanId);
    const clanInfo = await territories.getClanInfo(bobClanId);
    expect(clanInfo.playerIds.length).eq(1);
    expect(clanInfo.playerIds[0]).to.eq(0); // player id is removed

    await fulfillRandomWords(1, territories, mockAPI3OracleClient);
    const territory = await territories.territories(territoryId);
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
      tierId,
      imageId,
      origName,
      mockAPI3OracleClient,
    } = await loadFixture(clanFixture);

    const territoryId = 1;
    await combatantsHelper.connect(alice).assignCombatants(clanId, true, [playerId], false, [], playerId);
    await territories
      .connect(alice)
      .attackTerritory(clanId, territoryId, playerId, {value: await territories.attackCost()});

    const bobPlayerId = await createPlayer(playerNFT, avatarId, bob, origName + 2, true);
    await clans.connect(bob).createClan(bobPlayerId, clanName + 1, discord, telegram, imageId, tierId);
    const bobClanId = 2;
    await combatantsHelper.connect(bob).assignCombatants(bobClanId, true, [bobPlayerId], false, [], bobPlayerId);
    await territories
      .connect(bob)
      .attackTerritory(bobClanId, territoryId, bobPlayerId, {value: await territories.attackCost()});
    // After attacking, leave the clan which destroys it before the battle is resolved

    let pendingAttack = await territories.getPendingAttack(2);
    expect(pendingAttack.clanId).to.eq(bobClanId);
    await clans.connect(bob).changeRank(bobClanId, bobPlayerId, ClanRank.NONE, bobPlayerId);

    pendingAttack = await territories.getPendingAttack(2);
    expect(pendingAttack.clanId).to.eq(bobClanId);
    const clanInfo = await territories.getClanInfo(bobClanId);
    expect(clanInfo.playerIds.length).eq(1);
    expect(clanInfo.playerIds[0]).to.eq(0); // player id is removed

    await fulfillRandomWords(1, territories, mockAPI3OracleClient);
    const territory = await territories.territories(territoryId);
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
      tierId,
      imageId,
      origName,
      mockAPI3OracleClient,
    } = await loadFixture(clanFixture);

    const territoryId = 1;
    await combatantsHelper.connect(alice).assignCombatants(clanId, true, [playerId], false, [], playerId);
    await territories
      .connect(alice)
      .attackTerritory(clanId, territoryId, playerId, {value: await territories.attackCost()});
    await clans.connect(alice).changeRank(clanId, playerId, ClanRank.NONE, playerId);

    const bobPlayerId = await createPlayer(playerNFT, avatarId, bob, origName + 2, true);
    await clans.connect(bob).createClan(bobPlayerId, clanName + 1, discord, telegram, imageId, tierId);

    const bobClanId = 2;
    await combatantsHelper.connect(bob).assignCombatants(bobClanId, true, [bobPlayerId], false, [], bobPlayerId);
    await territories
      .connect(bob)
      .attackTerritory(bobClanId, territoryId, bobPlayerId, {value: await territories.attackCost()});
    await fulfillRandomWords(1, territories, mockAPI3OracleClient);

    const territory = await territories.territories(territoryId);
    expect(territory.clanIdOccupier).eq(bobClanId);
  });

  it("Multiple clans should be able to attack an occupied territory", async () => {});

  it("Attacking players array should be sorted and without duplicates", async () => {
    const {playerNFT, avatarId, clans, clanId, playerId, territories, combatantsHelper, owner, alice, origName} =
      await loadFixture(clanFixture);

    const ownerPlayerId = await createPlayer(playerNFT, avatarId, owner, origName + 1, true);
    await clans.requestToJoin(clanId, ownerPlayerId, 0);
    await clans.connect(alice).acceptJoinRequest(clanId, ownerPlayerId, playerId);

    await expect(
      combatantsHelper.connect(alice).assignCombatants(clanId, true, [playerId, playerId], false, [], playerId)
    ).to.be.revertedWithCustomError(territories, "PlayerIdsNotSortedOrDuplicates");

    await expect(
      combatantsHelper.connect(alice).assignCombatants(clanId, true, [ownerPlayerId, playerId], false, [], playerId)
    ).to.be.revertedWithCustomError(territories, "PlayerIdsNotSortedOrDuplicates");
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
        .attackTerritory(clanId, territoryId, ownerPlayerId, {value: await territories.attackCost()})
    ).to.be.revertedWithCustomError(territories, "NotLeader");
    await clans.connect(alice).changeRank(clanId, ownerPlayerId, ClanRank.LEADER, playerId);
    await territories
      .connect(owner)
      .attackTerritory(clanId, territoryId, ownerPlayerId, {value: await territories.attackCost()});
  });

  it("Is owner of player when attacking", async () => {
    const {clanId, playerId, territories, owner} = await loadFixture(clanFixture);

    const territoryId = 1;
    await expect(
      territories.connect(owner).attackTerritory(clanId, territoryId, playerId)
    ).to.be.revertedWithCustomError(territories, "NotOwnerOfPlayerAndActive");
  });

  it("Occupied territories should emit brush", async () => {
    const {clanId, playerId, territories, combatantsHelper, brush, alice, bankFactory, lockedBankVault} =
      await loadFixture(clanFixture);

    const territoryId = 1;
    await combatantsHelper.connect(alice).assignCombatants(clanId, true, [playerId], false, [], playerId);
    await territories
      .connect(alice)
      .attackTerritory(clanId, territoryId, playerId, {value: await territories.attackCost()});

    await brush.mint(alice.address, ethers.utils.parseEther("1000"));
    await brush.connect(alice).approve(territories.address, ethers.utils.parseEther("1000"));
    await territories.connect(alice).addUnclaimedEmissions(ethers.utils.parseEther("1000"));

    expect((await territories.territories(territoryId)).unclaimedEmissions).to.eq(ethers.utils.parseEther("100"));

    //    const bankAddress = await bankFactory.bankAddress(clanId);
    //    expect((await territories.getClanInfo(clanId)).bank).to.eq(ethers.constants.AddressZero);
    await territories.connect(alice).harvest(territoryId, playerId);
    // After harvesting the clan bank address should be set on clans object
    //    expect((await territories.getClanInfo(clanId)).bank).to.eq(bankAddress);

    expect(await brush.balanceOf(lockedBankVault.address)).to.eq(ethers.utils.parseEther("100"));
    expect((await lockedBankVault.getClanInfo(clanId)).totalBrushLocked).to.eq(ethers.utils.parseEther("100"));
    //    expect((await lockedBankVault.getClanInfo(clanId)).bank).to.eq(bankAddress);
  });

  it("Can only claim emissions once every 8 hours", async () => {
    const {clanId, playerId, territories, combatantsHelper, brush, alice} = await loadFixture(clanFixture);

    const territoryId = 1;
    await combatantsHelper.connect(alice).assignCombatants(clanId, true, [playerId], false, [], playerId);
    await territories
      .connect(alice)
      .attackTerritory(clanId, territoryId, playerId, {value: await territories.attackCost()});

    await brush.mint(alice.address, ethers.utils.parseEther("1000"));
    await brush.connect(alice).approve(territories.address, ethers.utils.parseEther("1000"));
    await territories.connect(alice).addUnclaimedEmissions(ethers.utils.parseEther("500"));
    await territories.connect(alice).harvest(territoryId, playerId);
    await territories.connect(alice).addUnclaimedEmissions(ethers.utils.parseEther("500"));
    await expect(territories.connect(alice).harvest(territoryId, playerId)).to.be.revertedWithCustomError(
      territories,
      "HarvestingTooSoon"
    );

    // increase time by territories.HARVESTING_COOLDOWN()
    await ethers.provider.send("evm_increaseTime", [(await territories.HARVESTING_COOLDOWN()).toNumber()]);
    await expect(territories.connect(alice).harvest(territoryId, playerId)).to.not.be.reverted;
  });

  it("Cannot only change combatants after the cooldown change deadline has passed", async function () {
    const {territories, combatantsHelper, clanId, playerId, alice} = await loadFixture(clanFixture);

    await combatantsHelper.connect(alice).assignCombatants(clanId, true, [playerId], false, [], playerId);

    await expect(
      combatantsHelper.connect(alice).assignCombatants(clanId, true, [playerId], false, [], playerId)
    ).to.be.revertedWithCustomError(territories, "ClanCombatantsChangeCooldown");

    // Update time by MIN_PLAYER_COMBANTANTS_CHANGE_COOLDOWN
    const MIN_PLAYER_COMBANTANTS_CHANGE_COOLDOWN = await territories.MIN_PLAYER_COMBANTANTS_CHANGE_COOLDOWN();
    await ethers.provider.send("evm_increaseTime", [MIN_PLAYER_COMBANTANTS_CHANGE_COOLDOWN.toNumber() - 5]);
    await expect(
      combatantsHelper.connect(alice).assignCombatants(clanId, true, [playerId], false, [], playerId)
    ).to.be.revertedWithCustomError(territories, "ClanCombatantsChangeCooldown");
    await ethers.provider.send("evm_increaseTime", [5]);
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

    const newTerritoryAdded = await territories.territories(26);
    expect(newTerritoryAdded.percentageEmissions).eq(addTerritory.percentageEmissions);
  });

  it("Edit territory", async () => {
    const {territories} = await loadFixture(clanFixture);

    const editedTerritory = {...allTerritories[0], percentageEmissions: 90};

    await territories.editTerritories([editedTerritory]);
    expect((await territories.territories(allTerritories[0].territoryId)).percentageEmissions).to.eq(90);

    // Other ones should not be changed
    for (const territory of allTerritories) {
      if (territory.territoryId != 1) {
        expect(territory.percentageEmissions).to.eq(
          (await territories.territories(territory.territoryId)).percentageEmissions
        );
      }
    }
  });

  it("Remove territory", async () => {
    const {territories} = await loadFixture(clanFixture);

    const territoryId = 1;
    await territories.removeTerritories([territoryId]);
    expect((await territories.territories(territoryId)).percentageEmissions).to.eq(0);
    // Check the others haven't changed
    expect((await territories.territories(territoryId + 1)).percentageEmissions).to.eq(100);
  });

  it("Attack territory", async () => {
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
      tierId,
      imageId,
      origName,
      mockAPI3OracleClient,
    } = await loadFixture(clanFixture);

    const territoryId = 1;

    await combatantsHelper.connect(alice).assignCombatants(clanId, true, [playerId], false, [], playerId);
    await territories
      .connect(alice)
      .attackTerritory(clanId, territoryId, playerId, {value: await territories.attackCost()});

    // Create a new player and a new clan
    const bobPlayerId = await createPlayer(playerNFT, avatarId, bob, origName + 1, true);
    await clans.connect(bob).createClan(bobPlayerId, clanName + 1, discord, telegram, imageId, tierId);

    // Make the attacking players statistically more powerful.
    for (let i = 0; i < allTerritorySkills.length; ++i) {
      await players.testModifyXP(bob.address, bobPlayerId, allTerritorySkills[i], getXPFromLevel(100), true);
    }

    await combatantsHelper.connect(bob).assignCombatants(clanId + 1, true, [bobPlayerId], false, [], bobPlayerId);
    const tx = await territories
      .connect(bob)
      .attackTerritory(clanId + 1, territoryId, bobPlayerId, {value: await territories.attackCost()});
    const requestId = 1;
    await fulfillRandomWords(requestId, territories, mockAPI3OracleClient);

    const {gasPrice} = tx;

    // Useful to re-run a battle for testing
    await territories.setAttackInProgress(requestId);
    await fulfillRandomWords(requestId, territories, mockAPI3OracleClient);
    expect(await territories.movingAverageGasPrice()).to.eq(0);

    let attackCost = await territories.attackCost();
    const baseAttackCost = await territories.baseAttackCost();
    expect(attackCost).to.eq(baseAttackCost);

    await territories.setAttackInProgress(requestId);
    await fulfillRandomWords(requestId, territories, mockAPI3OracleClient, gasPrice?.add(1000));
    const bigZero = BigNumber.from(0);
    expect(await territories.movingAverageGasPrice()).to.eq(
      bigZero
        .add(bigZero)
        .add(bigZero)
        .add((gasPrice as BigNumber).add(1000))
        .div(4)
    );

    attackCost = await territories.attackCost();
    const expectedGasLimit = await territories.expectedGasLimitFulfill();
    expect(attackCost).to.eq(baseAttackCost.add((await territories.movingAverageGasPrice()).mul(expectedGasLimit)));

    await territories.setAttackInProgress(requestId);
    await fulfillRandomWords(requestId, territories, mockAPI3OracleClient, gasPrice?.add(900));
    await territories.setAttackInProgress(requestId);
    await fulfillRandomWords(requestId, territories, mockAPI3OracleClient, gasPrice?.add(800));
    await territories.setAttackInProgress(requestId);
    await fulfillRandomWords(requestId, territories, mockAPI3OracleClient, gasPrice?.add(500));
    await territories.setAttackInProgress(requestId);
    await fulfillRandomWords(requestId, territories, mockAPI3OracleClient, gasPrice?.add(200));

    expect(await territories.movingAverageGasPrice()).to.eq(
      (gasPrice as BigNumber)
        .add(900)
        .add((gasPrice as BigNumber).add(800))
        .add((gasPrice as BigNumber).add(500))
        .add((gasPrice as BigNumber).add(200))
        .div(4)
    );
    attackCost = await territories.attackCost();
    expect(attackCost).to.eq(baseAttackCost.add((await territories.movingAverageGasPrice()).mul(expectedGasLimit)));
  });

  it("Cannot be used to attack a territory if you are defending a locked bank vault", async () => {});

  it("Leaving clan during a pending attack before oracle is called (can you join another clan and do anything?)", async () => {});

  it("Attacking cooldown for clan", async () => {});

  it("Attacking cooldown for player", async () => {});
});
