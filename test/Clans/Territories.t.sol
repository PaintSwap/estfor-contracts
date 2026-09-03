// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Vm} from "forge-std/Vm.sol";

import {FullGameStack} from "../utils/FullGameStack.sol";
import {ITerritoriesGameData} from "../../contracts/interfaces/IGameData.sol";
import {ITerritories} from "../../contracts/interfaces/ITerritories.sol";
import {IClans as Clans} from "../../contracts/interfaces/IClans.sol";
import {ICombatantsHelper as CombatantsHelper} from "../../contracts/interfaces/ICombatantsHelper.sol";
import {ClanRank, VaultClanInfo} from "../../contracts/globals/clans.sol";
import {BoostType, Skill, CombatStats} from "../../contracts/globals/misc.sol";
import {EquipPosition, ItemInput} from "../../contracts/globals/players.sol";
import {ILockedBankVaultsBattleResultDecoder, TerritoryBattleResultData} from "../../contracts/test/interfaces/LockedBankVaultsBattleResultDecoder.sol";

contract TerritoriesTest is FullGameStack {
  uint256 private constant CLAN_ID = 1;
  uint256 private constant TERRITORY_ID = 1;
  uint256 private constant COMBATANT_CHANGE_COOLDOWN = 5 minutes;
  uint256 private constant PLAYER_LEAVE_COMBATANT_COOLDOWN = 15 minutes;
  uint16 private constant PROTECTION_SHIELD = 13_568;
  uint16 private constant MIRROR_SHIELD = 13_570;
  uint24 private constant MIRROR_SHIELD_DURATION = 1 days;
  uint16 private constant MIRROR_SHIELD_COOLDOWN_HOURS = 72;
  bytes32 private constant BATTLE_RESULT_TOPIC =
    keccak256(
      "BattleResult(uint256,uint64[],uint64[],uint256[],uint256[],uint8[],uint8[],bool,uint256,uint256,uint256[],uint256,uint256)"
    );

  uint256 private ownerPlayerId;
  uint256 private bobPlayerId;
  uint256 private charliePlayerId;
  uint256 private erinPlayerId;
  uint256 private nextClanId = 1;
  ILockedBankVaultsBattleResultDecoder private eventDecoder;

  function setUp() public {
    deployFullGame();
    eventDecoder = ILockedBankVaultsBattleResultDecoder(
      _deployArtifact(
        "contracts/test/LockedBankVaultsBattleResultDecoder.sol:LockedBankVaultsBattleResultDecoder:via-ir"
      )
    );
    _fundAndUpgrade(ALICE, playerId);
    ownerPlayerId = _createAndUpgrade(address(this), "Owner");
    bobPlayerId = _createAndUpgrade(BOB, "Bob");
    charliePlayerId = _createAndUpgrade(CHARLIE, "Charlie");
    erinPlayerId = _createAndUpgrade(ERIN, "Erin");

    Clans.Tier[] memory tiers = new Clans.Tier[](1);
    tiers[0] = Clans.Tier(1, 10, 3, 16, 0, 0);
    clans.addTiers(tiers);
    _createClan(ALICE, playerId, "Clan 1");

    address[5] memory accounts = [address(this), ALICE, BOB, CHARLIE, ERIN];
    for (uint256 i; i < accounts.length; ++i) {
      vm.deal(accounts[i], 100 ether);
    }
  }

  function testCheckDefaults() public view {
    ITerritories.Territory[] memory values = territories.getTerrorities();
    assertEq(values.length, 25);
    assertEq(territories.getTerritory(1).territoryId, 1);
    assertEq(territories.getTerritory(1).percentageEmissions, 100);
    assertEq(territories.getTotalEmissionPercentage(), 1000);
  }

  function testReadsComparableSkills() public view {
    Skill[] memory comparableSkills = ITerritoriesGameData(address(territories)).getComparableSkills();
    assertEq(comparableSkills.length, 17);
    assertEq(keccak256(abi.encode(comparableSkills)), keccak256(abi.encode(_battleSkills())));
  }

  function testClaimAnUnoccupiedTerritory() public {
    _assign(ALICE, CLAN_ID, playerId, _ids(playerId));
    uint256 attackTimestamp = block.timestamp;
    _attack(ALICE, CLAN_ID, TERRITORY_ID, playerId);
    assertEq(brush.balanceOf(ALICE), 0);
    assertEq(territories.getTerritory(TERRITORY_ID).clanIdOccupier, 0);

    mockVRF.fulfill(1, address(territories));
    assertEq(territories.getTerritory(TERRITORY_ID).clanIdOccupier, CLAN_ID);
    ITerritories.ClanInfo memory info = territories.getClanInfo(CLAN_ID);
    assertEq(info.ownsTerritoryId, TERRITORY_ID);
    assertEq(info.attackingCooldownTimestamp, attackTimestamp + 1 days);
  }

  function testCannotAttackATerritoryWhichDoesNotExist() public {
    vm.expectRevert();
    territories.attackTerritory(CLAN_ID, 26, playerId);
  }

  function testCannotAttackOwnTerritory() public {
    _claim(ALICE, CLAN_ID, TERRITORY_ID, playerId, 1);
    vm.warp(block.timestamp + 1 days);
    vm.expectRevert(ITerritories.CannotAttackSelf.selector);
    vm.prank(ALICE);
    territories.attackTerritory(CLAN_ID, TERRITORY_ID, playerId);
  }

  function testCanAttackAnotherTerritoryWhenAlreadyOwningOne() public {
    _claim(ALICE, CLAN_ID, TERRITORY_ID, playerId, 1);
    vm.warp(block.timestamp + 1 days);
    _attack(ALICE, CLAN_ID, TERRITORY_ID + 1, playerId);
    mockVRF.fulfill(2, address(territories));
    assertEq(territories.getTerritory(TERRITORY_ID).clanIdOccupier, 0);
    assertEq(territories.getTerritory(TERRITORY_ID + 1).clanIdOccupier, CLAN_ID);
  }

  function testAttackOccupiedTerritoryAndWin() public {
    uint256 defendingAttackTimestamp = block.timestamp;
    _claim(ALICE, CLAN_ID, TERRITORY_ID, playerId, 1);
    uint256 bobClanId = _createClan(BOB, bobPlayerId, "Clan 2");
    _boostBattleSkills(BOB, bobPlayerId);
    _assign(BOB, bobClanId, bobPlayerId, _ids(bobPlayerId));
    uint256 attackingTimestamp = block.timestamp;
    _attack(BOB, bobClanId, TERRITORY_ID, bobPlayerId);
    TerritoryBattleResultData memory result = _fulfillBattle(2);

    assertTrue(result.didAttackersWin);
    assertEq(result.attackingClanId, bobClanId);
    assertEq(result.defendingClanId, CLAN_ID);
    assertEq(result.territoryId, TERRITORY_ID);
    assertEq(territories.getTerritory(TERRITORY_ID).clanIdOccupier, bobClanId);
    assertEq(territories.getClanInfo(CLAN_ID).attackingCooldownTimestamp, defendingAttackTimestamp + 1 days);
    assertEq(territories.getClanInfo(bobClanId).attackingCooldownTimestamp, attackingTimestamp + 1 days);
  }

  function testAttackOccupiedTerritoryAndLose() public {
    uint256 defendingAttackTimestamp = block.timestamp;
    _claim(ALICE, CLAN_ID, TERRITORY_ID, playerId, 1);
    uint256 bobClanId = _createClan(BOB, bobPlayerId, "Clan 2");
    _boostBattleSkills(ALICE, playerId);
    _assign(BOB, bobClanId, bobPlayerId, _ids(bobPlayerId));
    uint256 attackingTimestamp = block.timestamp;
    _attack(BOB, bobClanId, TERRITORY_ID, bobPlayerId);
    TerritoryBattleResultData memory result = _fulfillBattle(2);

    assertFalse(result.didAttackersWin);
    assertEq(result.attackingClanId, bobClanId);
    assertEq(result.defendingClanId, CLAN_ID);
    assertEq(result.territoryId, TERRITORY_ID);
    assertEq(territories.getTerritory(TERRITORY_ID).clanIdOccupier, CLAN_ID);
    assertEq(territories.getClanInfo(CLAN_ID).attackingCooldownTimestamp, defendingAttackTimestamp + 1 days);
    assertEq(territories.getClanInfo(bobClanId).attackingCooldownTimestamp, attackingTimestamp + 1 days);
  }

  function testPlayerCannotDefendMultipleTerritories() public {
    _join(CLAN_ID, address(this), ownerPlayerId, ALICE, playerId);
    _assign(ALICE, CLAN_ID, playerId, _ids(playerId, ownerPlayerId));
    _attack(ALICE, CLAN_ID, TERRITORY_ID, playerId);
    mockVRF.fulfill(1, address(territories));
    _boostBattleSkills(ALICE, playerId);
    _boostBattleSkills(address(this), ownerPlayerId);

    uint256 bobClanId = _createClan(BOB, bobPlayerId, "Clan 2");
    _join(bobClanId, CHARLIE, charliePlayerId, BOB, bobPlayerId);
    _join(bobClanId, ERIN, erinPlayerId, BOB, bobPlayerId);

    assertEq(territories.getTerritory(TERRITORY_ID).clanIdOccupier, CLAN_ID);
    clans.changeRank(CLAN_ID, ownerPlayerId, ClanRank.NONE, ownerPlayerId);
    assertEq(territories.getTerritory(TERRITORY_ID).clanIdOccupier, CLAN_ID);
    ITerritories.ClanInfo memory aliceInfo = territories.getClanInfo(CLAN_ID);
    assertEq(aliceInfo.playerIds.length, 1);
    assertEq(aliceInfo.playerIds[0], playerId);

    uint256 ownerClanId = _createClan(address(this), ownerPlayerId, "Clan 3");
    vm.expectRevert(CombatantsHelper.PlayerCombatantCooldownTimestamp.selector);
    _assign(address(this), ownerClanId, ownerPlayerId, _ids(ownerPlayerId));
    vm.warp(block.timestamp + PLAYER_LEAVE_COMBATANT_COOLDOWN);
    _assign(address(this), ownerClanId, ownerPlayerId, _ids(ownerPlayerId));
    _attack(address(this), ownerClanId, TERRITORY_ID + 1, ownerPlayerId);
    mockVRF.fulfill(2, address(territories));

    _assign(BOB, bobClanId, bobPlayerId, _ids(bobPlayerId, charliePlayerId, erinPlayerId));
    _attack(BOB, bobClanId, TERRITORY_ID, bobPlayerId);
    mockVRF.fulfill(3, address(territories));
    assertEq(territories.getTerritory(TERRITORY_ID).clanIdOccupier, bobClanId);
  }

  function testLeavingClanDuringPendingAttackRemovesAttackerFromBattle() public {
    _claim(ALICE, CLAN_ID, TERRITORY_ID, playerId, 1);
    uint256 bobClanId = _createClan(BOB, bobPlayerId, "Clan 2");
    _join(bobClanId, CHARLIE, charliePlayerId, BOB, bobPlayerId);
    _assign(BOB, bobClanId, bobPlayerId, _ids(charliePlayerId));
    _attack(BOB, bobClanId, TERRITORY_ID, bobPlayerId);
    assertEq(territories.getPendingAttack(2).clanId, bobClanId);

    vm.prank(CHARLIE);
    clans.changeRank(bobClanId, charliePlayerId, ClanRank.NONE, charliePlayerId);
    assertEq(territories.getPendingAttack(2).clanId, bobClanId);
    assertEq(territories.getClanInfo(bobClanId).playerIds.length, 0);
    mockVRF.fulfill(2, address(territories));
    assertEq(territories.getTerritory(TERRITORY_ID).clanIdOccupier, CLAN_ID);
  }

  function testDestroyedAttackingClanAutoLosesPendingAttack() public {
    _claim(ALICE, CLAN_ID, TERRITORY_ID, playerId, 1);
    uint256 bobClanId = _createClan(BOB, bobPlayerId, "Clan 2");
    _assign(BOB, bobClanId, bobPlayerId, _ids(bobPlayerId));
    _attack(BOB, bobClanId, TERRITORY_ID, bobPlayerId);
    assertEq(territories.getPendingAttack(2).clanId, bobClanId);

    vm.prank(BOB);
    clans.changeRank(bobClanId, bobPlayerId, ClanRank.NONE, bobPlayerId);
    assertEq(territories.getPendingAttack(2).clanId, bobClanId);
    assertEq(territories.getClanInfo(bobClanId).playerIds.length, 0);
    mockVRF.fulfill(2, address(territories));
    assertEq(territories.getTerritory(TERRITORY_ID).clanIdOccupier, CLAN_ID);
  }

  function testDestroyedOccupyingClanAutoLoses() public {
    _claim(ALICE, CLAN_ID, TERRITORY_ID, playerId, 1);
    vm.prank(ALICE);
    clans.changeRank(CLAN_ID, playerId, ClanRank.NONE, playerId);
    uint256 bobClanId = _createClan(BOB, bobPlayerId, "Clan 2");
    _assign(BOB, bobClanId, bobPlayerId, _ids(bobPlayerId));
    _attack(BOB, bobClanId, TERRITORY_ID, bobPlayerId);
    mockVRF.fulfill(2, address(territories));
    assertEq(territories.getTerritory(TERRITORY_ID).clanIdOccupier, bobClanId);
  }

  function testAttackingPlayerIdsMustBeSortedWithoutDuplicates() public {
    _join(CLAN_ID, address(this), ownerPlayerId, ALICE, playerId);
    vm.expectRevert(CombatantsHelper.PlayerIdsNotSortedOrDuplicates.selector);
    _assign(ALICE, CLAN_ID, playerId, _ids(playerId, playerId));
    vm.expectRevert(CombatantsHelper.PlayerIdsNotSortedOrDuplicates.selector);
    _assign(ALICE, CLAN_ID, playerId, _ids(ownerPlayerId, playerId));
  }

  function testMustBeColonelToAttackTerritory() public {
    _join(CLAN_ID, address(this), ownerPlayerId, ALICE, playerId);
    vm.prank(ALICE);
    clans.changeRank(CLAN_ID, ownerPlayerId, ClanRank.SCOUT, playerId);
    _assign(ALICE, CLAN_ID, playerId, _ids(playerId, ownerPlayerId));
    uint256 attackCost = territories.getAttackCost();
    vm.expectRevert(ITerritories.RankNotHighEnough.selector);
    territories.attackTerritory{value: attackCost}(CLAN_ID, TERRITORY_ID, ownerPlayerId);
    vm.prank(ALICE);
    clans.changeRank(CLAN_ID, ownerPlayerId, ClanRank.COLONEL, playerId);
    territories.attackTerritory{value: attackCost}(CLAN_ID, TERRITORY_ID, ownerPlayerId);
  }

  function testLeavingClanRemovesCombatant() public {
    _join(CLAN_ID, address(this), ownerPlayerId, ALICE, playerId);
    _assign(ALICE, CLAN_ID, playerId, _ids(playerId, ownerPlayerId));
    vm.expectEmit(false, false, false, true, address(territories));
    emit ITerritories.RemoveCombatant(ownerPlayerId, CLAN_ID);
    clans.changeRank(CLAN_ID, ownerPlayerId, ClanRank.NONE, ownerPlayerId);
  }

  function testLeavingClanSetsFutureCombatantPenalty() public {
    _join(CLAN_ID, address(this), ownerPlayerId, ALICE, playerId);
    _assign(ALICE, CLAN_ID, playerId, _ids(playerId, ownerPlayerId));
    combatantsHelper.setPlayerLeftCombatantCooldownTimestampPenalty(uint24(PLAYER_LEAVE_COMBATANT_COOLDOWN));
    clans.changeRank(CLAN_ID, ownerPlayerId, ClanRank.NONE, ownerPlayerId);
    _join(CLAN_ID, address(this), ownerPlayerId, ALICE, playerId);
    vm.warp(block.timestamp + COMBATANT_CHANGE_COOLDOWN);

    vm.expectRevert(CombatantsHelper.PlayerCombatantCooldownTimestamp.selector);
    _assign(ALICE, CLAN_ID, playerId, _ids(playerId, ownerPlayerId));
    _assign(ALICE, CLAN_ID, playerId, _ids(playerId));
  }

  function testMustOwnActivePlayerWhenAttacking() public {
    vm.expectRevert(ITerritories.NotOwnerOfPlayerAndActive.selector);
    territories.attackTerritory(CLAN_ID, TERRITORY_ID, playerId);
  }

  function testOccupiedTerritoriesEmitBrush() public {
    _claim(ALICE, CLAN_ID, TERRITORY_ID, playerId, 1);
    brush.mint(ALICE, 1000 ether);
    vm.startPrank(ALICE);
    brush.approve(address(territories), 1000 ether);
    territories.addUnclaimedEmissions(1000 ether);
    vm.stopPrank();
    assertEq(territories.getTerritory(TERRITORY_ID).unclaimedEmissions, 100 ether);

    vm.prank(ALICE);
    territories.harvest(TERRITORY_ID, playerId);
    ITerritories.Territory memory territory = territories.getTerritory(TERRITORY_ID);
    assertEq(territory.unclaimedEmissions, 0);
    assertEq(territory.lastClaimTimestamp, block.timestamp);
    assertEq(brush.balanceOf(address(lockedBankVaults)), 100 ether);
    VaultClanInfo memory info = lockedBankVaults.getClanInfo(CLAN_ID);
    assertEq(info.totalBrushLocked, 100 ether);
  }

  function testCanOnlyHarvestEveryEightHours() public {
    _claim(ALICE, CLAN_ID, TERRITORY_ID, playerId, 1);
    brush.mint(ALICE, 1000 ether);
    vm.startPrank(ALICE);
    brush.approve(address(territories), 1000 ether);
    territories.addUnclaimedEmissions(500 ether);
    territories.harvest(TERRITORY_ID, playerId);
    territories.addUnclaimedEmissions(500 ether);
    vm.expectRevert(ITerritories.HarvestingTooSoon.selector);
    territories.harvest(TERRITORY_ID, playerId);
    vm.warp(block.timestamp + territories.HARVESTING_COOLDOWN());
    territories.harvest(TERRITORY_ID, playerId);
    vm.stopPrank();
  }

  function testMustBeMemberOfOccupyingClanToHarvest() public {
    _claim(ALICE, CLAN_ID, TERRITORY_ID, playerId, 1);
    brush.mint(ALICE, 500 ether);
    vm.startPrank(ALICE);
    brush.approve(address(territories), 500 ether);
    territories.addUnclaimedEmissions(500 ether);
    vm.stopPrank();
    _createClan(BOB, bobPlayerId, "Clan 2");
    vm.expectRevert(ITerritories.NotMemberOfClan.selector);
    vm.prank(BOB);
    territories.harvest(TERRITORY_ID, bobPlayerId);
  }

  function testCombatantsChangeOnlyAfterCooldown() public {
    _assign(ALICE, CLAN_ID, playerId, _ids(playerId));
    combatantsHelper.clearCooldowns(_ids(playerId));
    vm.expectRevert(ITerritories.ClanCombatantsChangeCooldown.selector);
    _assign(ALICE, CLAN_ID, playerId, _ids(playerId));
    vm.warp(block.timestamp + COMBATANT_CHANGE_COOLDOWN - 1);
    vm.expectRevert(ITerritories.ClanCombatantsChangeCooldown.selector);
    _assign(ALICE, CLAN_ID, playerId, _ids(playerId));
    vm.warp(block.timestamp + 1);
    _assign(ALICE, CLAN_ID, playerId, _ids(playerId));
  }

  function testAddNewTerritory() public {
    ITerritories.TerritoryInput[] memory inputs = _territoryInputs(27, 10);
    vm.expectRevert(ITerritories.InvalidTerritoryId.selector);
    territories.addTerritories(inputs);
    inputs[0].territoryId = 26;
    vm.expectRevert(ITerritories.InvalidEmissionPercentage.selector);
    territories.addTerritories(inputs);
    inputs[0].percentageEmissions = 0;
    vm.expectRevert(ITerritories.InvalidTerritory.selector);
    territories.addTerritories(inputs);

    inputs[0].percentageEmissions = 10;
    territories.editTerritories(_territoryInputs(1, 90));
    territories.addTerritories(inputs);
    assertEq(territories.getTerritory(26).percentageEmissions, 10);
  }

  function testEditTerritory() public {
    territories.editTerritories(_territoryInputs(1, 90));
    assertEq(territories.getTerritory(1).percentageEmissions, 90);
    for (uint256 i = 2; i <= 25; ++i) {
      uint16 expected = i <= 5
        ? 100
        : i <= 15
          ? 30
          : 20;
      assertEq(territories.getTerritory(i).percentageEmissions, expected);
    }
  }

  function testRemoveTerritory() public {
    uint256[] memory ids = new uint256[](1);
    ids[0] = TERRITORY_ID;
    territories.removeTerritories(ids);
    assertEq(territories.getTerritory(TERRITORY_ID).percentageEmissions, 0);
    assertEq(territories.getTerritory(TERRITORY_ID + 1).percentageEmissions, 100);
  }

  function testAttackTerritoryGasPriceTracking() public {
    _assign(ALICE, CLAN_ID, playerId, _ids(playerId));
    _attack(ALICE, CLAN_ID, TERRITORY_ID, playerId);
    uint256 bobClanId = _createClan(BOB, bobPlayerId, "Clan 2");
    _boostBattleSkills(BOB, bobPlayerId);
    _assign(BOB, bobClanId, bobPlayerId, _ids(bobPlayerId));
    _attack(BOB, bobClanId, TERRITORY_ID, bobPlayerId);
    mockVRF.fulfill(1, address(territories));

    uint256 baseGasPrice = tx.gasprice;
    uint256[5] memory increases = [uint256(1000), 900, 800, 500, 200];
    for (uint256 i; i < increases.length; ++i) {
      territories.setAttackInProgress(1);
      vm.txGasPrice(baseGasPrice + increases[i]);
      mockVRF.fulfill(1, address(territories));
    }
    assertGt(territories.getAttackCost(), 0);
    assertEq(territories.getExpectedGasLimitFulfill(), 3_000_000);
  }

  function testCanAssignNewCombatantsWhileHoldingTerritory() public {
    _claim(ALICE, CLAN_ID, TERRITORY_ID, playerId, 1);
    assertEq(territories.getTerritory(TERRITORY_ID).clanIdOccupier, CLAN_ID);
    assertEq(territories.getClanInfo(CLAN_ID).ownsTerritoryId, TERRITORY_ID);
    vm.warp(block.timestamp + COMBATANT_CHANGE_COOLDOWN);
    _assign(ALICE, CLAN_ID, playerId, _ids(playerId));
  }

  function testBlockingAttacksWithItem() public {
    _claim(ALICE, CLAN_ID, TERRITORY_ID, playerId, 1);
    uint256 bobClanId = _createClan(BOB, bobPlayerId, "Clan 2");
    _assign(BOB, bobClanId, bobPlayerId, _ids(bobPlayerId));
    _addDefenceItems();
    itemNFT.mint(ALICE, MIRROR_SHIELD, 2);
    itemNFT.mint(ALICE, PROTECTION_SHIELD, 1);

    vm.expectRevert(ITerritories.NotATerritoryDefenceItem.selector);
    vm.prank(ALICE);
    territories.blockAttacks(CLAN_ID, PROTECTION_SHIELD, playerId);

    uint256 blockedUntil = block.timestamp + MIRROR_SHIELD_DURATION;
    vm.expectEmit(false, false, false, true, address(territories));
    emit ITerritories.BlockingAttacks(
      CLAN_ID,
      MIRROR_SHIELD,
      ALICE,
      playerId,
      blockedUntil,
      blockedUntil + uint256(MIRROR_SHIELD_COOLDOWN_HOURS) * 1 hours
    );
    vm.prank(ALICE);
    territories.blockAttacks(CLAN_ID, MIRROR_SHIELD, playerId);
    assertEq(itemNFT.balanceOf(ALICE, MIRROR_SHIELD), 1);
    _expectBlockedAttack(BOB, bobClanId, bobPlayerId);

    vm.warp(block.timestamp + MIRROR_SHIELD_DURATION - 10);
    _expectBlockedAttack(BOB, bobClanId, bobPlayerId);
    vm.expectRevert(ITerritories.BlockAttacksCooldown.selector);
    vm.prank(ALICE);
    territories.blockAttacks(CLAN_ID, MIRROR_SHIELD, playerId);
    vm.warp(block.timestamp + uint256(MIRROR_SHIELD_COOLDOWN_HOURS) * 1 hours);
    vm.expectRevert(ITerritories.BlockAttacksCooldown.selector);
    vm.prank(ALICE);
    territories.blockAttacks(CLAN_ID, MIRROR_SHIELD, playerId);
    vm.warp(block.timestamp + 10);
    vm.prank(ALICE);
    territories.blockAttacks(CLAN_ID, MIRROR_SHIELD, playerId);

    uint256 secondBlockedUntil = block.timestamp + MIRROR_SHIELD_DURATION;
    vm.warp(secondBlockedUntil - 10);
    _expectBlockedAttack(BOB, bobClanId, bobPlayerId);
    vm.warp(secondBlockedUntil);
    _attack(BOB, bobClanId, TERRITORY_ID, bobPlayerId);
    assertEq(itemNFT.balanceOf(ALICE, MIRROR_SHIELD), 0);
  }

  function testMustHaveMinimumMMRToAttack() public {
    _join(CLAN_ID, address(this), ownerPlayerId, ALICE, playerId);
    _assign(ALICE, CLAN_ID, playerId, _ids(playerId, ownerPlayerId));
    uint256[] memory territoryIds = new uint256[](1);
    uint16[] memory minimumMMRs = new uint16[](1);
    territoryIds[0] = TERRITORY_ID;
    minimumMMRs[0] = INITIAL_MMR + 1;
    territories.setMinimumMMRs(territoryIds, minimumMMRs);
    uint256 attackCost = territories.getAttackCost();
    vm.expectRevert(abi.encodeWithSelector(ITerritories.NotEnoughMMR.selector, INITIAL_MMR + 1));
    vm.prank(ALICE);
    territories.attackTerritory{value: attackCost}(CLAN_ID, TERRITORY_ID, playerId);

    minimumMMRs[0] = INITIAL_MMR;
    territories.setMinimumMMRs(territoryIds, minimumMMRs);
    _attack(ALICE, CLAN_ID, TERRITORY_ID, playerId);
  }

  function testBattleResultUsesDeterministicShuffle() public {
    _join(CLAN_ID, address(this), ownerPlayerId, ALICE, playerId);
    _assign(ALICE, CLAN_ID, playerId, _ids(playerId, ownerPlayerId));
    uint256 bobClanId = _createClan(BOB, bobPlayerId, "Clan 2");
    _join(bobClanId, CHARLIE, charliePlayerId, BOB, bobPlayerId);
    _assign(BOB, bobClanId, bobPlayerId, _ids(bobPlayerId, charliePlayerId));
    _attack(ALICE, CLAN_ID, TERRITORY_ID, playerId);
    mockVRF.fulfill(1, address(territories));
    _attack(BOB, bobClanId, TERRITORY_ID, bobPlayerId);

    vm.recordLogs();
    mockVRF.fulfillSeeded(2, address(territories), 1);
    TerritoryBattleResultData memory result = _getBattleResult(vm.getRecordedLogs());
    assertEq(result.attackingPlayerIds.length, 2);
    assertEq(result.attackingPlayerIds[0], charliePlayerId);
    assertEq(result.attackingPlayerIds[1], bobPlayerId);
    assertEq(result.defendingPlayerIds.length, 2);
    assertEq(result.defendingPlayerIds[0], ownerPlayerId);
    assertEq(result.defendingPlayerIds[1], playerId);
  }

  function _fundAndUpgrade(address account, uint256 id) private {
    brush.mint(account, 1 ether);
    vm.startPrank(account);
    brush.approve(address(playerNFT), 1 ether);
    playerNFT.editPlayer(id, playerNFT.getName(id), "", "", "", true);
    vm.stopPrank();
  }

  function _createAndUpgrade(address account, string memory name) private returns (uint256 id) {
    id = _createPlayer(account, 1, name, true);
    _fundAndUpgrade(account, id);
  }

  function _createClan(address account, uint256 leaderId, string memory name) private returns (uint256 clanId) {
    clanId = nextClanId++;
    vm.prank(account);
    clans.createClan(leaderId, name, "", "", "", 1, 1);
  }

  function _join(uint256 clanId, address member, uint256 memberId, address leader, uint256 leaderId) private {
    vm.prank(member);
    clans.requestToJoin(clanId, memberId, 0);
    uint256[] memory ids = new uint256[](1);
    ids[0] = memberId;
    vm.prank(leader);
    clans.acceptJoinRequests(clanId, ids, leaderId);
  }

  function _assign(address account, uint256 clanId, uint256 leaderId, uint64[] memory ids) private {
    uint64[] memory emptyIds = new uint64[](0);
    vm.prank(account);
    combatantsHelper.assignCombatants(clanId, true, ids, false, emptyIds, false, emptyIds, leaderId);
  }

  function _attack(address account, uint256 clanId, uint256 territoryId, uint256 leaderId) private {
    uint256 attackCost = territories.getAttackCost();
    vm.prank(account);
    territories.attackTerritory{value: attackCost}(clanId, territoryId, leaderId);
  }

  function _claim(address account, uint256 clanId, uint256 territoryId, uint256 leaderId, uint256 requestId) private {
    _assign(account, clanId, leaderId, _ids(leaderId));
    _attack(account, clanId, territoryId, leaderId);
    mockVRF.fulfill(requestId, address(territories));
  }

  function _boostBattleSkills(address account, uint256 id) private {
    Skill[] memory skills = _battleSkills();
    for (uint256 i; i < skills.length; ++i) {
      players.modifyXP(account, id, skills[i], _xpAtLevel(100), true);
    }
  }

  function _territoryInputs(
    uint16 id,
    uint16 emissions
  ) private pure returns (ITerritories.TerritoryInput[] memory inputs) {
    inputs = new ITerritories.TerritoryInput[](1);
    inputs[0] = ITerritories.TerritoryInput(id, emissions);
  }

  function _addDefenceItems() private {
    ItemInput[] memory items = new ItemInput[](2);
    items[0] = ItemInput({
      combatStats: CombatStats(0, 0, 0, 0, 0, 0, 0),
      tokenId: PROTECTION_SHIELD,
      equipPosition: EquipPosition.LOCKED_VAULT,
      isTransferable: true,
      isFullModeOnly: false,
      isAvailable: true,
      questPrerequisiteId: 0,
      skill: Skill.NONE,
      minXP: 0,
      healthRestored: 0,
      boostType: BoostType.PVP_BLOCK,
      boostValue: 12,
      boostDuration: 2 days,
      metadataURI: "",
      name: "Protection Shield",
      isCollectionItem: false,
      isQuestItem: false
    });
    items[1] = ItemInput({
      combatStats: CombatStats(0, 0, 0, 0, 0, 0, 0),
      tokenId: MIRROR_SHIELD,
      equipPosition: EquipPosition.TERRITORY,
      isTransferable: true,
      isFullModeOnly: false,
      isAvailable: true,
      questPrerequisiteId: 0,
      skill: Skill.NONE,
      minXP: 0,
      healthRestored: 0,
      boostType: BoostType.PVP_BLOCK,
      boostValue: MIRROR_SHIELD_COOLDOWN_HOURS,
      boostDuration: MIRROR_SHIELD_DURATION,
      metadataURI: "",
      name: "Mirror Shield",
      isCollectionItem: false,
      isQuestItem: false
    });
    itemNFT.addItems(items);
  }

  function _expectBlockedAttack(address account, uint256 clanId, uint256 leaderId) private {
    uint256 attackCost = territories.getAttackCost();
    vm.expectRevert(ITerritories.ClanIsBlockingAttacks.selector);
    vm.prank(account);
    territories.attackTerritory{value: attackCost}(clanId, TERRITORY_ID, leaderId);
  }

  function _fulfillBattle(uint256 requestId) private returns (TerritoryBattleResultData memory result) {
    vm.recordLogs();
    mockVRF.fulfill(requestId, address(territories));
    result = _getBattleResult(vm.getRecordedLogs());
  }

  function _getBattleResult(Vm.Log[] memory logs) private view returns (TerritoryBattleResultData memory result) {
    for (uint256 i; i < logs.length; ++i) {
      if (logs[i].topics[0] == BATTLE_RESULT_TOPIC) {
        return eventDecoder.decodeTerritoryBattleResult(logs[i].data);
      }
    }
    revert("BattleResult not found");
  }

  function _ids(uint256 a) private pure returns (uint64[] memory ids) {
    ids = new uint64[](1);
    ids[0] = uint64(a);
  }

  function _ids(uint256 a, uint256 b) private pure returns (uint64[] memory ids) {
    ids = new uint64[](2);
    ids[0] = uint64(a);
    ids[1] = uint64(b);
  }

  function _ids(uint256 a, uint256 b, uint256 c) private pure returns (uint64[] memory ids) {
    ids = new uint64[](3);
    ids[0] = uint64(a);
    ids[1] = uint64(b);
    ids[2] = uint64(c);
  }
}
