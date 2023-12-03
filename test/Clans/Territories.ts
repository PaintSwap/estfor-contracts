import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {expect} from "chai";
import {clanFixture} from "./utils";
import {allTerritories, allTerritorySkills} from "../../scripts/data/terrorities";
import {ethers} from "hardhat";
import {createPlayer} from "../../scripts/utils";
import {fulfillRandomWords} from "../utils";
import {getXPFromLevel} from "../Players/utils";
import {ClanRank} from "@paintswap/estfor-definitions/types";

describe("Territories", function () {
  it("Check defaults", async () => {
    const {territories, terrorityBrushAttackingCost} = await loadFixture(clanFixture);

    expect(allTerritories.length).to.eq(25);
    expect((await territories.getTerrorities()).length).to.eq(allTerritories.length);
    expect((await territories.territories(1)).territoryId).to.eq(allTerritories[0].territoryId);
    expect((await territories.territories(1)).percentageEmissions).to.eq(allTerritories[0].percentageEmissions);
    expect(await territories.brushAttackingCost()).to.eq(terrorityBrushAttackingCost.div(ethers.utils.parseEther("1")));
    expect(await territories.totalEmissionPercentage()).to.eq(1000);
  });

  it("Claim an unoccupied territory", async () => {
    const {clanId, playerId, territories, terrorityBrushAttackingCost, brush, alice} = await loadFixture(clanFixture);

    const territoryId = 1;
    await brush.mint(alice.address, terrorityBrushAttackingCost);
    await brush.connect(alice).approve(territories.address, terrorityBrushAttackingCost);

    await territories.connect(alice).attackTerritory(clanId, [playerId], territoryId, playerId);
    expect(await brush.balanceOf(alice.address)).to.eq(0);

    const {timestamp: NOW} = await ethers.provider.getBlock("latest");

    const territory = (await territories.getTerrorities())[0];
    expect(territory.clanIdOccupier).eq(clanId);
    expect(territory.playerIdDefenders.length).eq(1);
    expect(territory.playerIdDefenders[0]).eq(playerId);

    const clanInfo = await territories.clanInfos(clanId);
    expect(clanInfo.ownsTerritoryId).eq(territoryId);
    expect(clanInfo.attackingCooldownTimestamp).eq(NOW + 86400);

    const playerInfo = await territories.playerInfos(playerId);
    expect(playerInfo.attackingCooldownTimestamp).eq(NOW + 86400);
  });

  it("Cannot attack a territory which doesn't exist", async () => {
    const {clanId, playerId, territories, terrorityBrushAttackingCost, brush, alice} = await loadFixture(clanFixture);

    const territoryId = 26;
    await brush.mint(alice.address, terrorityBrushAttackingCost);
    await brush.approve(territories.address, terrorityBrushAttackingCost);

    await expect(territories.attackTerritory(clanId, [playerId], territoryId, playerId)).to.be.reverted;
  });

  it("Cannot attack your own territory", async () => {
    const {clanId, playerId, territories, terrorityBrushAttackingCost, brush, alice} = await loadFixture(clanFixture);

    const territoryId = 1;
    await brush.mint(alice.address, terrorityBrushAttackingCost);
    await brush.connect(alice).approve(territories.address, terrorityBrushAttackingCost);

    await territories.connect(alice).attackTerritory(clanId, [playerId], territoryId, playerId);

    await ethers.provider.send("evm_increaseTime", [86400]);
    await expect(
      territories.connect(alice).attackTerritory(clanId, [playerId], territoryId, playerId)
    ).to.be.revertedWithCustomError(territories, "AlreadyOwnATerritory");
  });

  it("Cannot attack a territory if you own one", async () => {
    const {clanId, playerId, territories, terrorityBrushAttackingCost, brush, alice} = await loadFixture(clanFixture);

    const territoryId = 1;
    await brush.mint(alice.address, terrorityBrushAttackingCost);
    await brush.connect(alice).approve(territories.address, terrorityBrushAttackingCost);

    await territories.connect(alice).attackTerritory(clanId, [playerId], territoryId, playerId);

    await ethers.provider.send("evm_increaseTime", [86400]);
    await expect(
      territories.connect(alice).attackTerritory(clanId, [playerId], territoryId + 1, playerId)
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
      terrorityBrushAttackingCost,
      brush,
      alice,
      bob,
      clanName,
      discord,
      telegram,
      tierId,
      imageId,
      origName,
      mockOracleClient,
    } = await loadFixture(clanFixture);

    const territoryId = 1;
    await brush.mint(alice.address, terrorityBrushAttackingCost);
    await brush.connect(alice).approve(territories.address, terrorityBrushAttackingCost);

    await territories.connect(alice).attackTerritory(clanId, [playerId], territoryId, playerId);

    // Create a new player and a new clan
    const bobPlayerId = await createPlayer(playerNFT, avatarId, bob, origName + 1, true);
    await clans.connect(bob).createClan(bobPlayerId, clanName + 1, discord, telegram, imageId, tierId);
    await brush.mint(bob.address, terrorityBrushAttackingCost.mul(10));
    await brush.connect(bob).approve(territories.address, terrorityBrushAttackingCost.mul(10));

    // Make the attacking players statistically more powerful.
    for (let i = 0; i < allTerritorySkills.length; ++i) {
      await players.testModifyXP(bob.address, bobPlayerId, allTerritorySkills[i], getXPFromLevel(100), true);
    }

    await territories.connect(bob).attackTerritory(clanId + 1, [bobPlayerId], territoryId, bobPlayerId);
    let {timestamp: battleTimestamp} = await ethers.provider.getBlock("latest");
    const requestId = 1;
    await fulfillRandomWords(requestId, territories, mockOracleClient);

    const territory = (await territories.getTerrorities())[0];
    expect(territory.clanIdOccupier).eq(clanId + 1);
    expect(territory.playerIdDefenders.length).eq(1);
    expect(territory.playerIdDefenders[0]).eq(bobPlayerId);

    const defendingClanInfo = await territories.clanInfos(clanId);
    expect(defendingClanInfo.attackingCooldownTimestamp).eq(battleTimestamp + 86400);

    const attackingClanInfo = await territories.clanInfos(clanId + 1);
    expect(attackingClanInfo.attackingCooldownTimestamp).eq(battleTimestamp + 86400);

    const defendingPlayerInfo = await territories.playerInfos(playerId);
    expect(defendingPlayerInfo.attackingCooldownTimestamp).eq(battleTimestamp + 86400);

    const attackingPlayerInfo = await territories.playerInfos(bobPlayerId);
    expect(attackingPlayerInfo.attackingCooldownTimestamp).eq(battleTimestamp + 86400);
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
      terrorityBrushAttackingCost,
      brush,
      alice,
      bob,
      clanName,
      discord,
      telegram,
      tierId,
      imageId,
      origName,
      mockOracleClient,
    } = await loadFixture(clanFixture);

    const territoryId = 1;
    await brush.mint(alice.address, terrorityBrushAttackingCost);
    await brush.connect(alice).approve(territories.address, terrorityBrushAttackingCost);

    await territories.connect(alice).attackTerritory(clanId, [playerId], territoryId, playerId);

    // Create a new player and a new clan
    const bobPlayerId = await createPlayer(playerNFT, avatarId, bob, origName + 1, true);
    await clans.connect(bob).createClan(bobPlayerId, clanName + 1, discord, telegram, imageId, tierId);
    await brush.mint(bob.address, terrorityBrushAttackingCost.mul(10));
    await brush.connect(bob).approve(territories.address, terrorityBrushAttackingCost.mul(10));

    // Make the defending players statistically more powerful.
    for (let i = 0; i < allTerritorySkills.length; ++i) {
      await players.testModifyXP(alice.address, playerId, allTerritorySkills[i], getXPFromLevel(100), true);
    }

    await territories.connect(bob).attackTerritory(clanId + 1, [bobPlayerId], territoryId, bobPlayerId);
    let {timestamp: battleTimestamp} = await ethers.provider.getBlock("latest");
    const requestId = 1;
    await fulfillRandomWords(requestId, territories, mockOracleClient);

    const territory = (await territories.getTerrorities())[0];
    expect(territory.clanIdOccupier).eq(clanId);
    expect(territory.playerIdDefenders.length).eq(1);
    expect(territory.playerIdDefenders[0]).eq(playerId);

    const defendingClanInfo = await territories.clanInfos(clanId);
    expect(defendingClanInfo.attackingCooldownTimestamp).eq(battleTimestamp + 86400);

    const attackingClanInfo = await territories.clanInfos(clanId + 1);
    expect(attackingClanInfo.attackingCooldownTimestamp).eq(battleTimestamp + 86400);

    const defendingPlayerInfo = await territories.playerInfos(playerId);
    expect(defendingPlayerInfo.attackingCooldownTimestamp).eq(battleTimestamp + 86400);

    const attackingPlayerInfo = await territories.playerInfos(bobPlayerId);
    expect(attackingPlayerInfo.attackingCooldownTimestamp).eq(battleTimestamp + 86400);
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
      terrorityBrushAttackingCost,
      brush,
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
      mockOracleClient,
    } = await loadFixture(clanFixture);

    const territoryId = 1;
    await brush.mint(alice.address, terrorityBrushAttackingCost);
    await brush.connect(alice).approve(territories.address, terrorityBrushAttackingCost);

    const ownerPlayerId = await createPlayer(playerNFT, avatarId, owner, origName + 1, true);
    await clans.requestToJoin(clanId, ownerPlayerId, 0);
    await clans.connect(alice).acceptJoinRequest(clanId, ownerPlayerId, playerId);

    await territories.connect(alice).attackTerritory(clanId, [playerId, ownerPlayerId], territoryId, playerId);

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
    expect(territory.playerIdDefenders.length).eq(2);
    expect(territory.playerIdDefenders[0]).eq(playerId);
    expect(territory.playerIdDefenders[1]).eq(ownerPlayerId);
    await clans.changeRank(clanId, ownerPlayerId, ClanRank.NONE, ownerPlayerId);
    territory = (await territories.getTerrorities())[0];
    expect(territory.clanIdOccupier).eq(clanId);
    expect(territory.playerIdDefenders.length).eq(2);
    expect(territory.playerIdDefenders[0]).eq(playerId);
    expect(territory.playerIdDefenders[1]).eq(0); // Still 2 playerIds but the member who left is now 0

    // Make your own clan
    await clans.createClan(ownerPlayerId, clanName + 2, discord, telegram, imageId, tierId);
    const ownerClanId = 3;

    // Tries to attack an unclaimed territory
    await brush.mint(owner.address, terrorityBrushAttackingCost);
    await brush.approve(territories.address, terrorityBrushAttackingCost);

    await expect(
      territories.attackTerritory(ownerClanId, [ownerPlayerId], territoryId + 1, ownerPlayerId)
    ).to.be.revertedWithCustomError(territories, "PlayerAttackingCooldown");

    // Increase time by 24 hours
    await ethers.provider.send("evm_increaseTime", [86400]);

    // Free to attack another territory as you are no longer a defender
    await territories.attackTerritory(ownerClanId, [ownerPlayerId], territoryId + 1, ownerPlayerId);

    // TODO: Rejoining the old clan does not add you back as a defender

    // Bob should always beat alice's clan as she only has 1 defender
    await brush.mint(bob.address, terrorityBrushAttackingCost);
    await brush.connect(bob).approve(territories.address, terrorityBrushAttackingCost);
    await territories
      .connect(bob)
      .attackTerritory(bobClanId, [bobPlayerId, charliePlayerId, erinPlayerId], territoryId, bobPlayerId);
    await fulfillRandomWords(1, territories, mockOracleClient);

    territory = await territories.territories(territoryId);
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
      terrorityBrushAttackingCost,
      brush,
      alice,
      bob,
      charlie,
      clanName,
      discord,
      telegram,
      tierId,
      imageId,
      origName,
      mockOracleClient,
    } = await loadFixture(clanFixture);

    const territoryId = 1;
    await brush.mint(alice.address, terrorityBrushAttackingCost);
    await brush.connect(alice).approve(territories.address, terrorityBrushAttackingCost);

    await territories.connect(alice).attackTerritory(clanId, [playerId], territoryId, playerId);

    // Create a clan of 2 players
    const bobPlayerId = await createPlayer(playerNFT, avatarId, bob, origName + 2, true);
    const charliePlayerId = await createPlayer(playerNFT, avatarId, charlie, origName + 3, true);

    await clans.connect(bob).createClan(bobPlayerId, clanName + 1, discord, telegram, imageId, tierId);
    const bobClanId = 2;
    await clans.connect(charlie).requestToJoin(bobClanId, charliePlayerId, 0);
    await clans.connect(bob).acceptJoinRequest(bobClanId, charliePlayerId, bobPlayerId);

    await brush.mint(bob.address, terrorityBrushAttackingCost);
    await brush.connect(bob).approve(territories.address, terrorityBrushAttackingCost);
    await territories.connect(bob).attackTerritory(bobClanId, [charliePlayerId], territoryId, bobPlayerId);
    // After attacking, leave the clan before the battle is resolved

    let pendingAttack = await territories.getPendingAttack(2);
    expect(pendingAttack.clanId).to.eq(bobClanId);
    expect(pendingAttack.playerIds.length).to.eq(1);
    expect(pendingAttack.playerIds[0]).to.eq(charliePlayerId);
    await clans.connect(charlie).changeRank(bobClanId, charliePlayerId, ClanRank.NONE, charliePlayerId);

    pendingAttack = await territories.getPendingAttack(2);
    expect(pendingAttack.clanId).to.eq(bobClanId);
    expect(pendingAttack.playerIds.length).to.eq(1);
    expect(pendingAttack.playerIds[0]).to.eq(0); // player id is removed

    await fulfillRandomWords(1, territories, mockOracleClient);
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
      terrorityBrushAttackingCost,
      brush,
      alice,
      bob,
      clanName,
      discord,
      telegram,
      tierId,
      imageId,
      origName,
      mockOracleClient,
    } = await loadFixture(clanFixture);

    const territoryId = 1;
    await brush.mint(alice.address, terrorityBrushAttackingCost);
    await brush.connect(alice).approve(territories.address, terrorityBrushAttackingCost);

    await territories.connect(alice).attackTerritory(clanId, [playerId], territoryId, playerId);

    const bobPlayerId = await createPlayer(playerNFT, avatarId, bob, origName + 2, true);
    await clans.connect(bob).createClan(bobPlayerId, clanName + 1, discord, telegram, imageId, tierId);
    const bobClanId = 2;
    await brush.mint(bob.address, terrorityBrushAttackingCost);
    await brush.connect(bob).approve(territories.address, terrorityBrushAttackingCost);
    await territories.connect(bob).attackTerritory(bobClanId, [bobPlayerId], territoryId, bobPlayerId);
    // After attacking, leave the clan which destroys it before the battle is resolved

    let pendingAttack = await territories.getPendingAttack(2);
    expect(pendingAttack.clanId).to.eq(bobClanId);
    expect(pendingAttack.playerIds.length).to.eq(1);
    expect(pendingAttack.playerIds[0]).to.eq(bobPlayerId);
    await clans.connect(bob).changeRank(bobClanId, bobPlayerId, ClanRank.NONE, bobPlayerId);

    pendingAttack = await territories.getPendingAttack(2);
    expect(pendingAttack.clanId).to.eq(bobClanId);
    expect(pendingAttack.playerIds.length).to.eq(1);
    expect(pendingAttack.playerIds[0]).to.eq(0); // player id is removed

    await fulfillRandomWords(1, territories, mockOracleClient);
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
      terrorityBrushAttackingCost,
      brush,
      alice,
      bob,
      clanName,
      discord,
      telegram,
      tierId,
      imageId,
      origName,
      mockOracleClient,
    } = await loadFixture(clanFixture);

    const territoryId = 1;
    await brush.mint(alice.address, terrorityBrushAttackingCost);
    await brush.connect(alice).approve(territories.address, terrorityBrushAttackingCost);

    await territories.connect(alice).attackTerritory(clanId, [playerId], territoryId, playerId);
    await clans.connect(alice).changeRank(clanId, playerId, ClanRank.NONE, playerId);

    const bobPlayerId = await createPlayer(playerNFT, avatarId, bob, origName + 2, true);
    await clans.connect(bob).createClan(bobPlayerId, clanName + 1, discord, telegram, imageId, tierId);

    const bobClanId = 2;
    await brush.mint(bob.address, terrorityBrushAttackingCost);
    await brush.connect(bob).approve(territories.address, terrorityBrushAttackingCost);

    await territories.connect(bob).attackTerritory(bobClanId, [bobPlayerId], territoryId, bobPlayerId);
    await fulfillRandomWords(1, territories, mockOracleClient);

    const territory = await territories.territories(territoryId);
    expect(territory.clanIdOccupier).eq(bobClanId);
  });

  it("Multiple clans should be able to attack an occupied territory", async () => {});

  it("Attacking players array should be sorted and without duplicates", async () => {
    const {
      playerNFT,
      avatarId,
      clans,
      clanId,
      playerId,
      territories,
      terrorityBrushAttackingCost,
      brush,
      owner,
      alice,
      origName,
    } = await loadFixture(clanFixture);

    const territoryId = 1;
    await brush.mint(alice.address, terrorityBrushAttackingCost);
    await brush.connect(alice).approve(territories.address, terrorityBrushAttackingCost);

    const ownerPlayerId = await createPlayer(playerNFT, avatarId, owner, origName + 1, true);
    await clans.requestToJoin(clanId, ownerPlayerId, 0);
    await clans.connect(alice).acceptJoinRequest(clanId, ownerPlayerId, playerId);

    await expect(
      territories.connect(alice).attackTerritory(clanId, [playerId, playerId], territoryId, playerId)
    ).to.be.revertedWithCustomError(territories, "PlayerIdsNotSortedOrDuplicates");

    await expect(
      territories.connect(alice).attackTerritory(clanId, [ownerPlayerId, playerId], territoryId, playerId)
    ).to.be.revertedWithCustomError(territories, "PlayerIdsNotSortedOrDuplicates");
  });

  it("Must be a leader to attack a territory", async () => {
    const {
      playerNFT,
      avatarId,
      clans,
      clanId,
      playerId,
      territories,
      terrorityBrushAttackingCost,
      brush,
      owner,
      alice,
      origName,
    } = await loadFixture(clanFixture);

    const territoryId = 1;
    const ownerPlayerId = await createPlayer(playerNFT, avatarId, owner, origName + 1, true);
    await clans.requestToJoin(clanId, ownerPlayerId, 0);
    await clans.connect(alice).acceptJoinRequest(clanId, ownerPlayerId, playerId);
    await clans.connect(alice).changeRank(clanId, ownerPlayerId, ClanRank.TREASURER, playerId);

    await brush.mint(owner.address, terrorityBrushAttackingCost);
    await brush.connect(owner).approve(territories.address, terrorityBrushAttackingCost);
    await expect(
      territories.connect(owner).attackTerritory(clanId, [playerId, ownerPlayerId], territoryId, ownerPlayerId)
    ).to.be.revertedWithCustomError(territories, "NotLeader");
    await clans.connect(alice).changeRank(clanId, ownerPlayerId, ClanRank.LEADER, playerId);
    await territories.connect(owner).attackTerritory(clanId, [playerId, ownerPlayerId], territoryId, ownerPlayerId);
  });

  it("Is owner of player when attacking", async () => {
    const {clanId, playerId, territories, terrorityBrushAttackingCost, brush, owner} = await loadFixture(clanFixture);

    const territoryId = 1;
    await brush.mint(owner.address, terrorityBrushAttackingCost.add(ethers.utils.parseEther("1000")));
    await brush
      .connect(owner)
      .approve(territories.address, terrorityBrushAttackingCost.add(ethers.utils.parseEther("1000")));
    await expect(
      territories.connect(owner).attackTerritory(clanId, [playerId], territoryId, playerId)
    ).to.be.revertedWithCustomError(territories, "NotOwnerOfPlayerAndActive");
  });

  it("Occupied territories should emit brush", async () => {
    const {clanId, playerId, territories, terrorityBrushAttackingCost, brush, alice, bankFactory} = await loadFixture(
      clanFixture
    );

    const territoryId = 1;
    await brush.mint(alice.address, terrorityBrushAttackingCost.add(ethers.utils.parseEther("1000")));
    await brush
      .connect(alice)
      .approve(territories.address, terrorityBrushAttackingCost.add(ethers.utils.parseEther("1000")));
    await territories.connect(alice).attackTerritory(clanId, [playerId], territoryId, playerId);

    await territories.connect(alice).addUnclaimedEmissions(ethers.utils.parseEther("1000"));

    expect((await territories.territories(territoryId)).unclaimedEmissions).to.eq(ethers.utils.parseEther("100"));

    const bankAddress = await bankFactory.bankAddress(clanId);
    expect((await territories.clanInfos(clanId)).bank).to.eq(ethers.constants.AddressZero);
    await territories.connect(alice).harvest(territoryId);
    // After harvesting the clan bank address should be set on clans object
    expect((await territories.clanInfos(clanId)).bank).to.eq(bankAddress);

    expect(await brush.balanceOf(bankAddress)).to.eq(ethers.utils.parseEther("100"));
  });

  it("Can only claim emissions once every 8 hours", async () => {
    const {clanId, playerId, territories, terrorityBrushAttackingCost, brush, alice, bankFactory} = await loadFixture(
      clanFixture
    );

    const territoryId = 1;
    await brush.mint(alice.address, terrorityBrushAttackingCost.add(ethers.utils.parseEther("1000")));
    await brush
      .connect(alice)
      .approve(territories.address, terrorityBrushAttackingCost.add(ethers.utils.parseEther("1000")));
    await territories.connect(alice).attackTerritory(clanId, [playerId], territoryId, playerId);

    await territories.connect(alice).addUnclaimedEmissions(ethers.utils.parseEther("500"));
    await territories.connect(alice).harvest(territoryId);
    await territories.connect(alice).addUnclaimedEmissions(ethers.utils.parseEther("500"));
    await expect(territories.connect(alice).harvest(territoryId)).to.be.revertedWithCustomError(
      territories,
      "HarvestingTooSoon"
    );

    // increase time by territories.HARVESTING_COOLDOWN()
    await ethers.provider.send("evm_increaseTime", [(await territories.HARVESTING_COOLDOWN()).toNumber()]);
    await expect(territories.connect(alice).harvest(territoryId)).to.not.be.reverted;
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

  it("Leaving clan during a pending attack before oracle is called (can you join another clan and do anything?)", async () => {});

  it("Attacking cooldown for clan", async () => {});

  it("Attacking cooldown for player", async () => {});
});
