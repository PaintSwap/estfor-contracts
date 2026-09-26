// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {FullGameStack} from "../utils/FullGameStack.sol";
import {IClans} from "../../contracts/interfaces/IClans.sol";
import {IRaids} from "../../contracts/interfaces/IRaids.sol";
import {ITerritories} from "../../contracts/interfaces/ITerritories.sol";
import {IPVPBattleground} from "../../contracts/interfaces/IPVPBattleground.sol";
import {IUUPSUpgradeable} from "../../contracts/interfaces/IUUPSUpgradeable.sol";
import {IOwnable} from "../../contracts/interfaces/IOwnable.sol";
import {IRaidsGameData, IClansGameData} from "../../contracts/interfaces/IGameData.sol";
import {IClansReconciliation, IRaidsReconciliation, IClanBattleSkillsReconciliation, IPVPBattleSkillsReconciliation, ITerritoriesReconciliation} from "../../contracts/interfaces/IClanDataReconciliation.sol";
import {Skill} from "../../contracts/globals/misc.sol";

contract ClanDataReconciliationTest is FullGameStack {
  IClansReconciliation private clanData;
  IRaidsReconciliation private raidData;
  ITerritoriesReconciliation private territoryData;

  function setUp() public {
    deployFullGame();
    clanData = IClansReconciliation(address(clans));
    raidData = IRaidsReconciliation(address(raids));
    territoryData = ITerritoriesReconciliation(address(territories));
    vm.deal(ALICE, 100 ether);
  }

  function testTierDeactivationPreservesExistingClanAndAllowsUpgradeOut() public {
    _addTiers();
    vm.prank(ALICE);
    clans.createClan(playerId, "Existing clan", "", "", "", 1, 1);
    bytes32 original = keccak256(abi.encode(clans.getTier(1)));
    clanData.setTierActive(1, false);
    assertFalse(clanData.isTierActive(1));
    assertEq(keccak256(abi.encode(clans.getTier(1))), original);
    assertEq(IClansGameData(address(clans)).getTierIds().length, 2);
    assertEq(clans.getClanTierMembership(playerId), 1);
    assertTrue(clans.canWithdraw(1, playerId));
    vm.prank(ALICE);
    clans.upgradeClan(1, playerId, 2);
    assertEq(clans.getClanTierMembership(playerId), 2);
    clanData.setTierActive(1, true);
    assertTrue(clanData.isTierActive(1));
  }

  function testInactiveTierRejectsNewClanAndUpgradeTarget() public {
    _addTiers();
    clanData.setTierActive(1, false);
    vm.expectRevert(IClansReconciliation.TierInactive.selector);
    vm.prank(ALICE);
    clans.createClan(playerId, "New clan", "", "", "", 1, 1);
    clanData.setTierActive(1, true);
    vm.prank(ALICE);
    clans.createClan(playerId, "New clan", "", "", "", 1, 1);
    clanData.setTierActive(2, false);
    vm.expectRevert(IClansReconciliation.TierInactive.selector);
    vm.prank(ALICE);
    clans.upgradeClan(1, playerId, 2);
    vm.expectRevert(IClans.TierDoesNotExist.selector);
    clanData.setTierActive(3, false);
  }

  function testRaidDiscoveryTracksUint256KeysWithoutDuplicates() public {
    _addRaid(1);
    _addRaid(70_000);
    _addRaid(type(uint256).max);
    raids.editBaseRaids(_uints(70_000), _raidDefinitions());
    raidData.registerBaseRaidIds(_uints(70_000));
    (uint256 count, bool complete) = raidData.getBaseRaidDiscoveryState();
    assertEq(count, 3);
    assertTrue(complete);
    assertEq(raidData.getTrackedBaseRaidIds(0, 3), _uints(1, 70_000, type(uint256).max));
    assertEq(IRaidsGameData(address(raids)).getBaseRaidIds(0, 2).length, 1);
    assertEq(raidData.getTrackedBaseRaidIds(3, 3).length, 0);
    vm.expectRevert(IRaidsReconciliation.InvalidStateReadRange.selector);
    raidData.getTrackedBaseRaidIds(2, 1);
    vm.expectRevert(IRaidsReconciliation.InvalidStateReadRange.selector);
    raidData.getTrackedBaseRaidIds(0, 4);
  }

  function testLegacyRaidDiscoveryRemainsIncompleteAfterRegistrationAndUpgrade() public {
    IRaids legacy = IRaids(
      _deployUUPS(
        _deployArtifact("contracts/old/RaidsV2.sol:RaidsV2"),
        bytes.concat(
          IRaids.initialize.selector,
          abi.encode(address(players), address(itemNFT), address(clans), address(mockVRF), 8 hours, address(brush)),
          abi.encode(address(worldActions), address(randomnessBeacon), 20, uint256(11 * 32), true),
          abi.encode(uint256(1), uint256(1))
        )
      )
    );
    legacy.addBaseRaids(_uints(70_000), _raidDefinitions());
    IUUPSUpgradeable(address(legacy)).upgradeToAndCall(_deployArtifact("contracts/Clans/Raids.sol:Raids"), "");
    IRaidsReconciliation data = IRaidsReconciliation(address(legacy));
    (uint256 count, bool complete) = data.getBaseRaidDiscoveryState();
    assertEq(count, 0);
    assertFalse(complete);
    data.registerBaseRaidIds(_uints(70_000));
    (count, complete) = data.getBaseRaidDiscoveryState();
    assertEq(count, 1);
    assertFalse(complete);
    assertEq(IRaidsGameData(address(legacy)).getBaseRaid(70_000).minHealth, 100);
  }

  function testRaidDeactivationRetainsLootAndSparsePoolSpawnsCorrectId() public {
    _addRaid(1);
    _addRaid(500);
    _addRaid(70_000);
    vm.expectRevert(IRaidsReconciliation.InvalidBaseRaidSpawnPool.selector);
    raidData.setBaseRaidActive(1, false);
    raidData.setBaseRaidSpawnIds(_uint16s(500));
    raidData.setBaseRaidActive(1, false);
    raidData.setBaseRaidActive(70_000, false);
    assertFalse(raidData.isBaseRaidActive(1));
    assertEq(IRaidsGameData(address(raids)).getBaseRaid(1).randomLootTokenIds[0], 1);
    vm.expectRevert(IRaidsReconciliation.BaseRaidStillInSpawnPool.selector);
    raidData.setBaseRaidActive(500, false);
    vm.prank(ALICE);
    raids.requestSpawnRaid(uint64(playerId));
    vm.expectRevert(IRaids.PreviousRaidNotSpawnedYet.selector);
    raidData.setBaseRaidSpawnIds(new uint16[](0));
    mockVRF.fulfill(1, address(raids));
    assertEq(raids.getRaidInfo(1).baseRaidId, 500);
    assertEq(raids.getRaidInfo(2).baseRaidId, 500);
    assertEq(raids.getRaidInfo(3).baseRaidId, 500);
    raidData.setBaseRaidSpawnIds(new uint16[](0));
    raidData.setBaseRaidActive(500, false);
    assertEq(raids.getRaidInfo(1).baseRaidId, 500);
    assertEq(IRaidsGameData(address(raids)).getBaseRaid(500).randomLootTokenAmounts[0], 5);
    vm.expectRevert(IRaidsReconciliation.InvalidBaseRaidSpawnPool.selector);
    vm.prank(ALICE);
    raids.requestSpawnRaid(uint64(playerId));
  }

  function testRaidPoolRejectsInvalidDuplicateAndInactiveIdsAtomically() public {
    _addRaid(1);
    _addRaid(2);
    raidData.setBaseRaidSpawnIds(_uint16s(1));
    vm.expectRevert(IRaidsReconciliation.InvalidBaseRaidSpawnPool.selector);
    raidData.setBaseRaidSpawnIds(_uint16s(2, 2));
    (uint16[] memory ids, bool configured) = raidData.getBaseRaidSpawnIds();
    assertTrue(configured);
    assertEq(ids[0], 1);
    raidData.setBaseRaidActive(2, false);
    vm.expectRevert(IRaidsReconciliation.InvalidBaseRaidSpawnPool.selector);
    raidData.setBaseRaidSpawnIds(_uint16s(2));
    vm.expectRevert(IRaidsReconciliation.InvalidBaseRaidSpawnPool.selector);
    raidData.setBaseRaidSpawnIds(_uint16s(0));
    vm.expectRevert(IRaidsReconciliation.InvalidBaseRaidSpawnPool.selector);
    raidData.setBaseRaidSpawnIds(_uint16s(3));
    raidData.setBaseRaidActive(2, true);
    raidData.setBaseRaidSpawnIds(_uint16s(2));
  }

  function testTerritoryRemoveRestorePreservesRuntimeAndPendingClaim() public {
    _addTiers();
    brush.mint(ALICE, 1 ether);
    vm.startPrank(ALICE);
    brush.approve(address(playerNFT), 1 ether);
    playerNFT.editPlayer(playerId, ORIG_NAME, "", "", "", true);
    vm.stopPrank();
    vm.prank(ALICE);
    clans.createClan(playerId, "Territory clan", "", "", "", 1, 1);
    uint64[] memory combatants = new uint64[](1);
    combatants[0] = uint64(playerId);
    vm.prank(ALICE);
    combatantsHelper.assignCombatants(1, true, combatants, false, new uint64[](0), false, new uint64[](0), playerId);
    territories.setMinimumMMRs(_uints(1), _uint16s(0));
    uint256 attackCost = territories.getAttackCost();
    vm.prank(ALICE);
    territories.attackTerritory{value: attackCost}(1, 1, playerId);
    territories.removeTerritories(_uints(1));
    mockVRF.fulfill(1, address(territories));
    assertEq(territories.getTerritory(1).clanIdOccupier, 1);
    assertEq(territories.getClanInfo(1).ownsTerritoryId, 1);
    territoryData.restoreTerritories(_territoryInputs(1, 100));
    brush.mint(address(this), 1000 ether);
    brush.approve(address(territories), 1000 ether);
    territories.addUnclaimedEmissions(1000 ether);
    vm.prank(ALICE);
    territories.harvest(1, playerId);
    brush.mint(address(this), 1000 ether);
    brush.approve(address(territories), 1000 ether);
    territories.addUnclaimedEmissions(1000 ether);
    territories.setMinimumMMRs(_uints(1), _uint16s(400));
    ITerritories.Territory memory beforeRemoval = territories.getTerritory(1);
    territories.removeTerritories(_uints(1));
    assertEq(territories.getTotalEmissionPercentage(), 900);
    territoryData.restoreTerritories(_territoryInputs(1, 90));
    ITerritories.Territory memory restored = territories.getTerritory(1);
    assertEq(restored.clanIdOccupier, beforeRemoval.clanIdOccupier);
    assertEq(restored.unclaimedEmissions, beforeRemoval.unclaimedEmissions);
    assertEq(restored.lastClaimTimestamp, beforeRemoval.lastClaimTimestamp);
    assertEq(restored.minimumMMR, 400);
    assertEq(restored.percentageEmissions, 90);
    assertEq(territories.getTotalEmissionPercentage(), 990);
    territories.editTerritories(_territoryInputs(1, 100));
    assertEq(territories.getTotalEmissionPercentage(), 1000);
  }

  function testTerritoryRestorationRejectsActiveUnknownDuplicateAndExcessEmission() public {
    vm.expectRevert(ITerritories.InvalidTerritoryId.selector);
    territoryData.restoreTerritories(_territoryInputs(1, 100));
    vm.expectRevert(ITerritories.InvalidTerritoryId.selector);
    territoryData.restoreTerritories(_territoryInputs(26, 10));
    territories.removeTerritories(_uints(1));
    vm.expectRevert(ITerritories.InvalidEmissionPercentage.selector);
    territoryData.restoreTerritories(_territoryInputs(1, 101));
    vm.expectRevert(ITerritories.InvalidTerritoryId.selector);
    territories.editTerritories(_territoryInputs(1, 50));
    vm.expectRevert(ITerritories.InvalidTerritoryId.selector);
    territories.setMinimumMMRs(_uints(1), _uint16s(1));
    ITerritories.TerritoryInput[] memory duplicate = new ITerritories.TerritoryInput[](2);
    duplicate[0] = ITerritories.TerritoryInput(1, 10);
    duplicate[1] = duplicate[0];
    vm.expectRevert(ITerritories.InvalidTerritoryId.selector);
    territoryData.restoreTerritories(duplicate);
    assertEq(territories.getTerritory(1).territoryId, 0);
    assertEq(territories.getTotalEmissionPercentage(), 900);
  }

  function testClanBattleSkillReplacementIsExactIdempotentAndValidated() public {
    _checkSkillReplacement(IClanBattleSkillsReconciliation(address(territories)));
    _checkSkillReplacement(IClanBattleSkillsReconciliation(address(lockedBankVaults)));
  }

  function testRemovingAllTerritoriesRejectsDepositsAndCanBeRestored() public {
    uint256[] memory ids = new uint256[](25);
    for (uint256 i; i < ids.length; ++i) ids[i] = i + 1;
    territories.removeTerritories(ids);
    assertEq(territories.getTotalEmissionPercentage(), 0);
    vm.expectRevert(ITerritories.InvalidEmissionPercentage.selector);
    territories.addUnclaimedEmissions(1000);
    territoryData.restoreTerritories(_territoryInputs(1, 100));
    assertEq(territories.getTotalEmissionPercentage(), 100);
  }

  function testPVPReplacementCanFulfillBattle() public {
    IPVPBattleSkillsReconciliation(address(pvpBattleground)).replaceComparableSkills(_replacementSkills(), 2);
    uint256 defender = _createPlayer(BOB, 1, "Defender", true);
    uint256 cost = pvpBattleground.getAttackCost();
    vm.prank(ALICE);
    pvpBattleground.attackPlayer{value: cost}(playerId, defender);
    mockVRF.fulfill(1, address(pvpBattleground));
    assertFalse(pvpBattleground.getPlayerInfo(playerId).currentlyAttacking);
    assertEq(pvpBattleground.getPendingAttack(1).defendingPlayerId, 0);
  }

  function testPVPReplacementIsExactAndRejectsUnsafeCounts() public {
    IPVPBattleSkillsReconciliation data = IPVPBattleSkillsReconciliation(address(pvpBattleground));
    Skill[] memory skills = _replacementSkills();
    data.replaceComparableSkills(skills, 2);
    data.replaceComparableSkills(skills, 2);
    assertEq(keccak256(abi.encode(data.getComparableSkills())), keccak256(abi.encode(skills)));
    assertEq(data.getNumSkillsToCompare(), 2);
    vm.expectRevert(IPVPBattleground.TooManySkillsToCompare.selector);
    data.replaceComparableSkills(skills, 0);
    vm.expectRevert(IPVPBattleground.TooManySkillsToCompare.selector);
    data.replaceComparableSkills(skills, 3);
    vm.expectRevert(IPVPBattleground.TooManySkillsToCompare.selector);
    data.replaceComparableSkills(_battleSkills(), 17);
    skills[1] = skills[0];
    vm.expectRevert(abi.encodeWithSelector(IPVPBattleground.InvalidSkill.selector, skills[0]));
    data.replaceComparableSkills(skills, 2);
    assertEq(data.getComparableSkills().length, 2);
  }

  function testReconciliationMutationsAreOwnerOnly() public {
    bytes memory errorData = abi.encodeWithSelector(IOwnable.OwnableUnauthorizedAccount.selector, ALICE);
    vm.startPrank(ALICE);
    vm.expectRevert(errorData);
    clanData.setTierActive(1, false);
    vm.expectRevert(errorData);
    raidData.setBaseRaidActive(1, false);
    vm.expectRevert(errorData);
    raidData.setBaseRaidSpawnIds(_uint16s(1));
    vm.expectRevert(errorData);
    raidData.registerBaseRaidIds(_uints(1));
    vm.expectRevert(errorData);
    territoryData.restoreTerritories(_territoryInputs(1, 100));
    vm.expectRevert(errorData);
    IClanBattleSkillsReconciliation(address(territories)).replaceComparableSkills(_replacementSkills());
    vm.expectRevert(errorData);
    IClanBattleSkillsReconciliation(address(lockedBankVaults)).replaceComparableSkills(_replacementSkills());
    vm.expectRevert(errorData);
    IPVPBattleSkillsReconciliation(address(pvpBattleground)).replaceComparableSkills(_replacementSkills(), 2);
    vm.stopPrank();
  }

  function _checkSkillReplacement(IClanBattleSkillsReconciliation data) private {
    Skill[] memory skills = _replacementSkills();
    data.replaceComparableSkills(skills);
    data.replaceComparableSkills(skills);
    assertEq(keccak256(abi.encode(data.getComparableSkills())), keccak256(abi.encode(skills)));
    vm.expectRevert(ITerritories.LengthMismatch.selector);
    data.replaceComparableSkills(new Skill[](0));
    skills[1] = skills[0];
    vm.expectRevert(abi.encodeWithSelector(ITerritories.InvalidSkill.selector, skills[0]));
    data.replaceComparableSkills(skills);
    skills[1] = Skill.COMBAT;
    vm.expectRevert(abi.encodeWithSelector(ITerritories.InvalidSkill.selector, Skill.COMBAT));
    data.replaceComparableSkills(skills);
    assertEq(data.getComparableSkills().length, 2);
  }

  function _replacementSkills() private pure returns (Skill[] memory skills) {
    skills = new Skill[](2);
    skills[0] = Skill.MELEE;
    skills[1] = Skill.MINING;
  }

  function _addTiers() private {
    IClans.Tier[] memory tiers = new IClans.Tier[](2);
    tiers[0] = IClans.Tier(1, 3, 5, 10000, 0, 0);
    tiers[1] = IClans.Tier(2, 10, 20, 20000, 0, 0);
    clans.addTiers(tiers);
  }

  function _addRaid(uint256 id) private {
    raids.addBaseRaids(_uints(id), _raidDefinitions());
  }

  function _raidDefinitions() private pure returns (IRaids.BaseRaid[] memory definitions) {
    definitions = new IRaids.BaseRaid[](1);
    definitions[0].minHealth = 100;
    definitions[0].maxHealth = 200;
    definitions[0].tier = 1;
    definitions[0].randomLootTokenIds[0] = 1;
    definitions[0].randomLootTokenAmounts[0] = 5;
    definitions[0].randomChances[0] = 10000;
  }

  function _territoryInputs(
    uint16 id,
    uint16 emissions
  ) private pure returns (ITerritories.TerritoryInput[] memory inputs) {
    inputs = new ITerritories.TerritoryInput[](1);
    inputs[0] = ITerritories.TerritoryInput(id, emissions);
  }
}
