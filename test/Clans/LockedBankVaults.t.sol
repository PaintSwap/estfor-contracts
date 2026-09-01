// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Vm} from "forge-std/Vm.sol";

import {FullGameStack} from "../utils/FullGameStack.sol";
import {IClans as Clans} from "../../contracts/interfaces/IClans.sol";
import {ClanRank, ClanBattleInfo} from "../../contracts/globals/clans.sol";
import {Skill} from "../../contracts/globals/misc.sol";
import {ItemInput, EquipPosition} from "../../contracts/globals/players.sol";
import {BoostType} from "../../contracts/globals/misc.sol";
import {ILockedBankVaults} from "../../contracts/interfaces/ILockedBankVaults.sol";
import {ILockedBankVaultsLibrary as LockedBankVaultsLibrary} from "../../contracts/interfaces/ILockedBankVaultsLibrary.sol";
import {
    ILockedBankVaultsBattleResultDecoder,
    LockedBankVaultsBattleResultData
} from "../../contracts/test/interfaces/LockedBankVaultsBattleResultDecoder.sol";

contract LockedBankVaultsTest is FullGameStack {
    uint256 internal constant CLAN_ID = 1;
    uint8 internal constant TIER_ID = 1;
    // All these must match the constants inside LockedBankVaults.sol (isBeta = true)
    uint256 internal constant ATTACKING_COOLDOWN = 1.5 minutes;
    uint256 internal constant REATTACKING_COOLDOWN = 6 minutes;
    uint256 internal constant COMBATANT_CHANGE_COOLDOWN = 5 minutes;
    uint256 internal constant LOCKED_FUNDS_PERIOD = 7 days;
    uint256 internal constant SUPER_ATTACK_COOLDOWN = 1 days;

    uint16 internal constant DEVILISH_FINGERS = 13_569;
    uint16 internal constant PROTECTION_SHIELD = 13_568;
    uint16 internal constant MIRROR_SHIELD = 13_570;
    uint16 internal constant SHARPENED_CLAW = 13_571;

    uint256 internal bobPlayerId;
    uint256 internal charliePlayerId;
    uint256 internal erinPlayerId;
    uint256 internal frankPlayerId;
    uint256 internal geoffPlayerId;
    uint256 internal harryPlayerId;
    uint256 internal islaPlayerId;
    uint256 internal julietPlayerId;
    uint256 internal kikiPlayerId;
    uint256 internal lucyPlayerId;
    uint256 internal ownerPlayerId;
    ILockedBankVaultsBattleResultDecoder private battleResultDecoder;

    bytes32 internal constant BATTLE_RESULT_TOPIC = keccak256(
        "BattleResult(uint256,uint64[],uint64[],uint256[],uint256[],uint8[],uint8[],bool,uint256,uint256,uint256[],uint256,uint256,int256,int256,uint256)"
    );

    function setUp() public {
        deployFullGame();
        battleResultDecoder = ILockedBankVaultsBattleResultDecoder(
            _deployArtifact(
                "contracts/test/LockedBankVaultsBattleResultDecoder.sol:LockedBankVaultsBattleResultDecoder:via-ir"
            )
        );
        vm.deal(address(lockedBankVaults), 100 ether);
        vm.deal(address(this), 1000 ether);
        vm.deal(ALICE, 1000 ether);
        vm.deal(BOB, 1000 ether);
        vm.deal(CHARLIE, 1000 ether);
        vm.deal(ERIN, 1000 ether);
        vm.deal(FRANK, 1000 ether);
        vm.deal(GEOFF, 1000 ether);
        vm.deal(HARRY, 1000 ether);
        vm.deal(ISLA, 1000 ether);
        vm.deal(JULIET, 1000 ether);
        vm.deal(KIKI, 1000 ether);
        vm.deal(LUCY, 1000 ether);

        Clans.Tier[] memory tiers = new Clans.Tier[](1);
        tiers[0] = Clans.Tier(1, 3, 3, 16, 0, 0);
        clans.addTiers(tiers);
        vm.prank(ALICE);
        clans.createClan(playerId, ORIG_NAME, "", "", "", 1, TIER_ID);

        _upgradePlayer(playerId, ALICE);
        ownerPlayerId = _createUpgradedPlayer(address(this), string.concat(ORIG_NAME, "1"));
        bobPlayerId = _createUpgradedPlayer(BOB, string.concat(ORIG_NAME, "2"));
        charliePlayerId = _createUpgradedPlayer(CHARLIE, string.concat(ORIG_NAME, "3"));
        erinPlayerId = _createUpgradedPlayer(ERIN, string.concat(ORIG_NAME, "4"));
        frankPlayerId = _createUpgradedPlayer(FRANK, string.concat(ORIG_NAME, "5"));
        geoffPlayerId = _createUpgradedPlayer(GEOFF, string.concat(ORIG_NAME, "6"));
        harryPlayerId = _createUpgradedPlayer(HARRY, string.concat(ORIG_NAME, "7"));
        islaPlayerId = _createUpgradedPlayer(ISLA, string.concat(ORIG_NAME, "8"));
        julietPlayerId = _createUpgradedPlayer(JULIET, string.concat(ORIG_NAME, "9"));
        kikiPlayerId = _createUpgradedPlayer(KIKI, string.concat(ORIG_NAME, "10"));
        lucyPlayerId = _createUpgradedPlayer(LUCY, string.concat(ORIG_NAME, "11"));
    }

    function testLockFunds() public {
        brush.mint(address(territories), 1000);
        vm.prank(address(territories));
        lockedBankVaults.lockFunds(CLAN_ID, ALICE, playerId, 400);
        assertEq(brush.balanceOf(address(territories)), 600);
        assertEq(brush.balanceOf(address(lockedBankVaults)), 400);
        assertEq(lockedBankVaults.getClanInfo(CLAN_ID).totalBrushLocked, 400);
    }

    function testOnlyTerritoriesContractCanLockFunds() public {
        brush.mint(ALICE, 100);
        vm.startPrank(ALICE);
        brush.approve(address(lockedBankVaults), 100);
        vm.expectRevert(ILockedBankVaults.OnlyTerritories.selector);
        lockedBankVaults.lockFunds(CLAN_ID, ALICE, playerId, 100);
        vm.stopPrank();
    }

    function testCannotAttackYourOwnClan() public {
        _lockFunds(CLAN_ID, ALICE, playerId, 400);
        _assignLockedVaultCombatants(CLAN_ID, _uint64s(playerId), playerId, ALICE);

        uint256 attackCost = lockedBankVaults.getAttackCost();
        vm.prank(ALICE);
        vm.expectRevert(LockedBankVaultsLibrary.CannotAttackSelf.selector);
        lockedBankVaults.attackVaults{value: attackCost}(CLAN_ID, CLAN_ID, 0, playerId);
    }

    function testLeavingClanRemovesYouAsACombatant() public {
        _lockFunds(CLAN_ID, ALICE, playerId, 400);

        clans.requestToJoin(CLAN_ID, ownerPlayerId, 0);
        vm.prank(ALICE);
        clans.acceptJoinRequests(CLAN_ID, _uints(ownerPlayerId), playerId);

        _assignLockedVaultCombatants(CLAN_ID, _uint64s(playerId, ownerPlayerId), playerId, ALICE);
        assertEq(_toU256(lockedBankVaults.getClanInfo(CLAN_ID).playerIds), _uints(playerId, ownerPlayerId));

        vm.expectEmit(true, true, true, true, address(lockedBankVaults));
        emit ILockedBankVaults.RemoveCombatant(ownerPlayerId, CLAN_ID);
        clans.changeRank(CLAN_ID, ownerPlayerId, ClanRank.NONE, ownerPlayerId);

        assertEq(_toU256(lockedBankVaults.getClanInfo(CLAN_ID).playerIds), _uints(playerId));
    }

    function testCanOnlyChangeCombatantsAfterTheCooldownChangeDeadlineHasPassed() public {
        _assignLockedVaultCombatants(CLAN_ID, _uint64s(playerId), playerId, ALICE);
        combatantsHelper.clearCooldowns(_uint64s(playerId));

        vm.prank(ALICE);
        vm.expectRevert(LockedBankVaultsLibrary.ClanCombatantsChangeCooldown.selector);
        combatantsHelper.assignCombatants(
            CLAN_ID, false, _uint64sEmpty(), true, _uint64s(playerId), false, _uint64sEmpty(), playerId
        );

        vm.warp(vm.getBlockTimestamp() + COMBATANT_CHANGE_COOLDOWN - 5);
        vm.prank(ALICE);
        vm.expectRevert(LockedBankVaultsLibrary.ClanCombatantsChangeCooldown.selector);
        combatantsHelper.assignCombatants(
            CLAN_ID, false, _uint64sEmpty(), true, _uint64s(playerId), false, _uint64sEmpty(), playerId
        );
        vm.warp(vm.getBlockTimestamp() + 5);
        _assignLockedVaultCombatants(CLAN_ID, _uint64s(playerId), playerId, ALICE);
    }

    function testAttackLockedFunds() public {
        _lockFunds(CLAN_ID, ALICE, playerId, 1000);
        uint256 nowBefore = vm.getBlockTimestamp();

        _assignLockedVaultCombatants(CLAN_ID, _uint64s(playerId), playerId, ALICE);

        _createClanWithMembers(BOB, bobPlayerId, "1");
        uint256 bobClanId = CLAN_ID + 1;
        _joinClan(CHARLIE, charliePlayerId, bobClanId, BOB, bobPlayerId);

        _assignLockedVaultCombatants(bobClanId, _uint64s(bobPlayerId, charliePlayerId), bobPlayerId, BOB);
        uint256 attackCost = lockedBankVaults.getAttackCost();
        vm.prank(BOB);
        lockedBankVaults.attackVaults{value: attackCost}(bobClanId, CLAN_ID, 0, bobPlayerId);
        _fulfill(1);
        // Should win as they have more players
        assertEq(lockedBankVaults.getClanInfo(CLAN_ID).totalBrushLocked, 900);
        assertEq(lockedBankVaults.getClanInfo(bobClanId).totalBrushLocked, 100);

        assertEq(lockedBankVaults.getClanInfo(CLAN_ID).defendingVaults.length, 1);
        assertEq(lockedBankVaults.getClanInfo(CLAN_ID).defendingVaults[0].amount, 900);
        assertEq(lockedBankVaults.getClanInfo(CLAN_ID).defendingVaults[0].timestamp, nowBefore + LOCKED_FUNDS_PERIOD);

        assertEq(lockedBankVaults.getClanInfo(bobClanId).defendingVaults.length, 1);
        assertEq(lockedBankVaults.getClanInfo(bobClanId).defendingVaults[0].amount, 100);
        assertEq(
            lockedBankVaults.getClanInfo(bobClanId).defendingVaults[0].timestamp,
            vm.getBlockTimestamp() + LOCKED_FUNDS_PERIOD
        );
    }

    function testMustAttackWithSomeCombatants() public {
        _lockFunds(CLAN_ID, ALICE, playerId, 1000);

        _assignLockedVaultCombatants(CLAN_ID, _uint64s(playerId), playerId, ALICE);

        _createClanWithMembers(BOB, bobPlayerId, "1");
        uint256 bobClanId = CLAN_ID + 1;
        _joinClan(CHARLIE, charliePlayerId, bobClanId, BOB, bobPlayerId);

        uint256 attackCost = lockedBankVaults.getAttackCost();
        vm.prank(BOB);
        vm.expectRevert(LockedBankVaultsLibrary.NoCombatants.selector);
        lockedBankVaults.attackVaults{value: attackCost}(bobClanId, CLAN_ID, 0, bobPlayerId);
    }

    function testAttackBackLoseAndThenWin() public {
        _lockFunds(CLAN_ID, ALICE, playerId, 1000);
        uint256 nowBefore = vm.getBlockTimestamp();

        _assignLockedVaultCombatants(CLAN_ID, _uint64s(playerId), playerId, ALICE);

        _createClanWithMembers(BOB, bobPlayerId, "1");
        uint256 bobClanId = CLAN_ID + 1;
        _joinClan(CHARLIE, charliePlayerId, bobClanId, BOB, bobPlayerId);
        // Increase odds of winning
        _maxOutBattleXP(BOB, bobPlayerId);
        _maxOutBattleXP(CHARLIE, charliePlayerId);

        // Attack
        _assignLockedVaultCombatants(bobClanId, _uint64s(bobPlayerId, charliePlayerId), bobPlayerId, BOB);
        uint256 attackCost = lockedBankVaults.getAttackCost();
        vm.prank(BOB);
        lockedBankVaults.attackVaults{value: attackCost}(bobClanId, CLAN_ID, 0, bobPlayerId);
        _fulfill(1);
        assertEq(lockedBankVaults.getClanInfo(CLAN_ID).totalBrushLocked, 900);
        assertEq(lockedBankVaults.getClanInfo(bobClanId).totalBrushLocked, 100);
        uint256 now1 = vm.getBlockTimestamp();

        // Alice's clan can attack back because they haven't attacked anything yet but will lose.
        attackCost = lockedBankVaults.getAttackCost();
        vm.prank(ALICE);
        lockedBankVaults.attackVaults{value: attackCost}(CLAN_ID, bobClanId, 0, playerId);
        _fulfill(2);
        assertEq(lockedBankVaults.getClanInfo(CLAN_ID).totalBrushLocked, 855); // lost 5% for losing
        assertEq(lockedBankVaults.getClanInfo(bobClanId).totalBrushLocked, 100); // unchanged

        // Let's give them more players so they can win
        clans.requestToJoin(CLAN_ID, ownerPlayerId, 0);
        vm.prank(ALICE);
        clans.acceptJoinRequests(CLAN_ID, _uints(ownerPlayerId), playerId);

        vm.prank(ERIN);
        clans.requestToJoin(CLAN_ID, erinPlayerId, 0);
        vm.prank(ALICE);
        clans.acceptJoinRequests(CLAN_ID, _uints(erinPlayerId), playerId);
        // Extend member capacity
        Clans.Tier[] memory tiers = new Clans.Tier[](1);
        tiers[0] = Clans.Tier(1, 4, 3, 16, 0, 0);
        clans.editTiers(tiers);

        vm.prank(FRANK);
        clans.requestToJoin(CLAN_ID, frankPlayerId, 0);
        vm.prank(ALICE);
        clans.acceptJoinRequests(CLAN_ID, _uints(frankPlayerId), playerId);

        // But have to wait for the cooldown and not just the generic attack cooldown, the same clan attacking cooldown
        attackCost = lockedBankVaults.getAttackCost();
        vm.prank(ALICE);
        vm.expectRevert(LockedBankVaultsLibrary.ClanAttackingCooldown.selector);
        lockedBankVaults.attackVaults{value: attackCost}(CLAN_ID, bobClanId, 0, playerId);

        vm.warp(vm.getBlockTimestamp() + ATTACKING_COOLDOWN);
        attackCost = lockedBankVaults.getAttackCost();
        vm.prank(ALICE);
        vm.expectRevert(LockedBankVaultsLibrary.ClanAttackingSameClanCooldown.selector);
        lockedBankVaults.attackVaults{value: attackCost}(CLAN_ID, bobClanId, 0, playerId);

        vm.warp(vm.getBlockTimestamp() + COMBATANT_CHANGE_COOLDOWN);
        _assignLockedVaultCombatants(
            CLAN_ID, _uint64s(playerId, ownerPlayerId, erinPlayerId, frankPlayerId), playerId, ALICE
        );
        vm.warp(vm.getBlockTimestamp() + REATTACKING_COOLDOWN);
        attackCost = lockedBankVaults.getAttackCost();
        vm.prank(ALICE);
        lockedBankVaults.attackVaults{value: attackCost}(CLAN_ID, bobClanId, 0, playerId);
        _fulfill(3);
        uint256 now2 = vm.getBlockTimestamp();

        // Wait another day (check it's not just the clan cooldown)
        assertEq(lockedBankVaults.getClanInfo(CLAN_ID).totalBrushLocked, 855 + 10);
        assertEq(lockedBankVaults.getClanInfo(bobClanId).totalBrushLocked, 90);

        assertEq(lockedBankVaults.getClanInfo(CLAN_ID).defendingVaults.length, 1);
        assertEq(lockedBankVaults.getClanInfo(CLAN_ID).defendingVaults[0].amount, 855);
        assertEq(lockedBankVaults.getClanInfo(CLAN_ID).defendingVaults[0].timestamp, nowBefore + LOCKED_FUNDS_PERIOD);
        assertEq(lockedBankVaults.getClanInfo(CLAN_ID).defendingVaults[0].amount1, 10);
        assertEq(lockedBankVaults.getClanInfo(CLAN_ID).defendingVaults[0].timestamp1, now2 + LOCKED_FUNDS_PERIOD);

        assertEq(lockedBankVaults.getClanInfo(bobClanId).defendingVaults.length, 1);
        assertEq(lockedBankVaults.getClanInfo(bobClanId).defendingVaults[0].amount, 90);
        assertEq(lockedBankVaults.getClanInfo(bobClanId).defendingVaults[0].timestamp, now1 + LOCKED_FUNDS_PERIOD);
        assertEq(lockedBankVaults.getClanInfo(bobClanId).defendingVaults[0].amount1, 0);
        assertEq(lockedBankVaults.getClanInfo(bobClanId).defendingVaults[0].timestamp1, 0);
    }

    function testClaimRewardsWhenTheDeadlineHasExpired() public {
        _lockFunds(CLAN_ID, ALICE, playerId, 1000);
        uint256 lockPeriodSlice = LOCKED_FUNDS_PERIOD / 10;

        vm.warp(vm.getBlockTimestamp() + lockPeriodSlice);
        _lockFunds(CLAN_ID, ALICE, playerId, 300);
        vm.warp(vm.getBlockTimestamp() + lockPeriodSlice);
        _lockFunds(CLAN_ID, ALICE, playerId, 450);

        // Nothing to claim
        vm.prank(ALICE);
        vm.expectRevert(LockedBankVaultsLibrary.NothingToClaim.selector);
        lockedBankVaults.claimFunds(CLAN_ID, playerId);
        vm.warp(vm.getBlockTimestamp() + lockPeriodSlice * 7);
        vm.prank(ALICE);
        vm.expectRevert(LockedBankVaultsLibrary.NothingToClaim.selector);
        lockedBankVaults.claimFunds(CLAN_ID, playerId);
        vm.warp(vm.getBlockTimestamp() + lockPeriodSlice);
        // Can now claim
        vm.prank(ALICE);
        lockedBankVaults.claimFunds(CLAN_ID, playerId);
        assertEq(brush.balanceOf(bankFactory.getBankAddress(CLAN_ID)), 1000);
        assertEq(brush.balanceOf(address(lockedBankVaults)), 750);
        // Cannot claim twice
        vm.prank(ALICE);
        vm.expectRevert(LockedBankVaultsLibrary.NothingToClaim.selector);
        lockedBankVaults.claimFunds(CLAN_ID, playerId);
        vm.warp(vm.getBlockTimestamp() + lockPeriodSlice * 2);
        // Claim both
        vm.prank(ALICE);
        lockedBankVaults.claimFunds(CLAN_ID, playerId);
        assertEq(brush.balanceOf(bankFactory.getBankAddress(CLAN_ID)), 1750);
        assertEq(brush.balanceOf(address(lockedBankVaults)), 0);
        // Cannot claim again
        vm.prank(ALICE);
        vm.expectRevert(LockedBankVaultsLibrary.NothingToClaim.selector);
        lockedBankVaults.claimFunds(CLAN_ID, playerId);
    }

    function testAttackCostsAndMovingAveragePrice() public {
        _lockFunds(CLAN_ID, ALICE, playerId, 1000);

        _assignLockedVaultCombatants(CLAN_ID, _uint64s(playerId), playerId, ALICE);

        _createClanWithMembers(BOB, bobPlayerId, "1");
        uint256 bobClanId = CLAN_ID + 1;
        _joinClan(CHARLIE, charliePlayerId, bobClanId, BOB, bobPlayerId);

        // Attack
        _assignLockedVaultCombatants(bobClanId, _uint64s(bobPlayerId, charliePlayerId), bobPlayerId, BOB);
        uint256 attackCost = lockedBankVaults.getAttackCost();
        vm.prank(BOB);
        lockedBankVaults.attackVaults{value: attackCost}(bobClanId, CLAN_ID, 0, bobPlayerId);
        _fulfill(1);

        assertEq(lockedBankVaults.getAttackCost(), 3_500_000);

        lockedBankVaults.setAttackInProgress(1);
        _fulfill(1);

        lockedBankVaults.setExpectedGasLimitFulfill(1_500_000);
        assertEq(lockedBankVaults.getAttackCost(), 1_500_000);

        lockedBankVaults.setAttackInProgress(1);
        _fulfill(1);
    }

    function testMultipleLockedFundsClaim() public {
        uint256[5] memory nows;
        for (uint256 i; i < 5; ++i) {
            _lockFunds(CLAN_ID, ALICE, playerId, 100 + i);
            nows[i] = vm.getBlockTimestamp();
            vm.warp(vm.getBlockTimestamp() + 100);
        }

        assertEq(lockedBankVaults.getClanInfo(CLAN_ID).defendingVaults.length, 3);
        assertFalse(lockedBankVaults.getClanInfo(CLAN_ID).defendingVaults[0].claimed);
        assertEq(lockedBankVaults.getClanInfo(CLAN_ID).defendingVaults[0].amount, 100);
        assertEq(lockedBankVaults.getClanInfo(CLAN_ID).defendingVaults[0].timestamp, nows[0] + LOCKED_FUNDS_PERIOD);
        assertEq(lockedBankVaults.getClanInfo(CLAN_ID).defendingVaults[0].amount1, 101);
        assertEq(lockedBankVaults.getClanInfo(CLAN_ID).defendingVaults[0].timestamp1, nows[1] + LOCKED_FUNDS_PERIOD);
        assertFalse(lockedBankVaults.getClanInfo(CLAN_ID).defendingVaults[1].claimed);
        assertEq(lockedBankVaults.getClanInfo(CLAN_ID).defendingVaults[1].amount, 102);
        assertEq(lockedBankVaults.getClanInfo(CLAN_ID).defendingVaults[1].timestamp, nows[2] + LOCKED_FUNDS_PERIOD);
        assertEq(lockedBankVaults.getClanInfo(CLAN_ID).defendingVaults[1].amount1, 103);
        assertEq(lockedBankVaults.getClanInfo(CLAN_ID).defendingVaults[1].timestamp1, nows[3] + LOCKED_FUNDS_PERIOD);
        assertFalse(lockedBankVaults.getClanInfo(CLAN_ID).defendingVaults[2].claimed);
        assertEq(lockedBankVaults.getClanInfo(CLAN_ID).defendingVaults[2].amount, 104);
        assertEq(lockedBankVaults.getClanInfo(CLAN_ID).defendingVaults[2].timestamp, nows[4] + LOCKED_FUNDS_PERIOD);
        assertEq(lockedBankVaults.getClanInfo(CLAN_ID).defendingVaults[2].amount1, 0);
        assertEq(lockedBankVaults.getClanInfo(CLAN_ID).defendingVaults[2].timestamp1, 0);

        vm.warp(nows[0] + LOCKED_FUNDS_PERIOD);
        vm.prank(ALICE);
        lockedBankVaults.claimFunds(CLAN_ID, playerId);

        // First ones should be gone
        assertTrue(lockedBankVaults.getClanInfo(CLAN_ID).defendingVaults[0].claimed);
        assertEq(lockedBankVaults.getClanInfo(CLAN_ID).defendingVaults[0].amount, 0);
        assertEq(lockedBankVaults.getClanInfo(CLAN_ID).defendingVaults[0].timestamp, 0);
        assertEq(lockedBankVaults.getClanInfo(CLAN_ID).defendingVaults[0].amount1, 101);
        assertEq(lockedBankVaults.getClanInfo(CLAN_ID).defendingVaults[0].timestamp1, nows[1] + LOCKED_FUNDS_PERIOD);
        assertEq(lockedBankVaults.getClanInfo(CLAN_ID).defendingVaultsOffset, 0);

        vm.warp(nows[3] + LOCKED_FUNDS_PERIOD);
        vm.prank(ALICE);
        lockedBankVaults.claimFunds(CLAN_ID, playerId);

        // First & second ones should be gone
        assertTrue(lockedBankVaults.getClanInfo(CLAN_ID).defendingVaults[0].claimed);
        assertEq(lockedBankVaults.getClanInfo(CLAN_ID).defendingVaults[0].amount, 0);
        assertEq(lockedBankVaults.getClanInfo(CLAN_ID).defendingVaults[0].timestamp, 0);
        assertEq(lockedBankVaults.getClanInfo(CLAN_ID).defendingVaults[0].amount1, 101);
        assertEq(lockedBankVaults.getClanInfo(CLAN_ID).defendingVaults[0].timestamp1, nows[1] + LOCKED_FUNDS_PERIOD);
        assertFalse(lockedBankVaults.getClanInfo(CLAN_ID).defendingVaults[1].claimed);
        assertEq(lockedBankVaults.getClanInfo(CLAN_ID).defendingVaults[1].amount, 102);
        assertEq(lockedBankVaults.getClanInfo(CLAN_ID).defendingVaults[1].timestamp, nows[2] + LOCKED_FUNDS_PERIOD);
        assertEq(lockedBankVaults.getClanInfo(CLAN_ID).defendingVaults[1].amount1, 103);
        assertEq(lockedBankVaults.getClanInfo(CLAN_ID).defendingVaults[1].timestamp1, nows[3] + LOCKED_FUNDS_PERIOD);
        assertFalse(lockedBankVaults.getClanInfo(CLAN_ID).defendingVaults[2].claimed);
        assertEq(lockedBankVaults.getClanInfo(CLAN_ID).defendingVaults[2].amount, 104);
        assertEq(lockedBankVaults.getClanInfo(CLAN_ID).defendingVaults[2].timestamp, nows[4] + LOCKED_FUNDS_PERIOD);
        assertEq(lockedBankVaults.getClanInfo(CLAN_ID).defendingVaults[2].amount1, 0);
        assertEq(lockedBankVaults.getClanInfo(CLAN_ID).defendingVaults[2].timestamp1, 0);

        assertEq(lockedBankVaults.getClanInfo(CLAN_ID).defendingVaultsOffset, 2);

        // Claim the rest
        vm.warp(nows[4] + LOCKED_FUNDS_PERIOD);
        vm.prank(ALICE);
        lockedBankVaults.claimFunds(CLAN_ID, playerId);
        assertTrue(lockedBankVaults.getClanInfo(CLAN_ID).defendingVaults[2].claimed);
        assertEq(lockedBankVaults.getClanInfo(CLAN_ID).defendingVaults[2].amount, 104); // Leave it unchanged
        assertEq(lockedBankVaults.getClanInfo(CLAN_ID).defendingVaults[2].timestamp, nows[4] + LOCKED_FUNDS_PERIOD);
        assertEq(lockedBankVaults.getClanInfo(CLAN_ID).defendingVaultsOffset, 2);

        _lockFunds(CLAN_ID, ALICE, playerId, 100);
        uint256 now1 = vm.getBlockTimestamp();
        assertEq(lockedBankVaults.getClanInfo(CLAN_ID).defendingVaults[2].amount1, 100);
        assertEq(lockedBankVaults.getClanInfo(CLAN_ID).defendingVaults[2].timestamp1, now1 + LOCKED_FUNDS_PERIOD);
        assertEq(lockedBankVaults.getClanInfo(CLAN_ID).defendingVaultsOffset, 2);

        vm.warp(now1 + LOCKED_FUNDS_PERIOD);
        vm.prank(ALICE);
        lockedBankVaults.claimFunds(CLAN_ID, playerId);

        assertEq(lockedBankVaults.getClanInfo(CLAN_ID).defendingVaults[2].amount, 104); // Leave unchanged
        assertEq(lockedBankVaults.getClanInfo(CLAN_ID).defendingVaults[2].timestamp, nows[4] + LOCKED_FUNDS_PERIOD);
        assertEq(lockedBankVaults.getClanInfo(CLAN_ID).defendingVaults[2].amount1, 100);
        assertEq(lockedBankVaults.getClanInfo(CLAN_ID).defendingVaults[2].timestamp1, now1 + LOCKED_FUNDS_PERIOD);

        assertEq(lockedBankVaults.getClanInfo(CLAN_ID).defendingVaultsOffset, 3);
    }

    function testMaxLockedVaultsCannotAttackIfReached() public {
        // maxLockedVaults is set to 100 in the stack, 50 packed vaults
        for (uint256 i; i < 99; ++i) {
            _lockFunds(CLAN_ID, ALICE, playerId, 400);
        }

        _assignLockedVaultCombatants(CLAN_ID, _uint64s(playerId), playerId, ALICE);

        // Create a new clan to defend
        _createClanWithMembers(BOB, bobPlayerId, "1");
        uint256 bobClanId = 2;

        _lockFunds(bobClanId, BOB, bobPlayerId, 400);

        // Attack
        uint256 attackCost = lockedBankVaults.getAttackCost();
        vm.prank(ALICE);
        lockedBankVaults.attackVaults{value: attackCost}(CLAN_ID, bobClanId, 0, playerId);
        _fulfill(1);
        lockedBankVaults.clearCooldowns(CLAN_ID, _uints(bobClanId));

        _lockFunds(CLAN_ID, ALICE, playerId, 400);

        attackCost = lockedBankVaults.getAttackCost();
        vm.prank(ALICE);
        vm.expectRevert(LockedBankVaultsLibrary.MaxLockedVaultsReached.selector);
        lockedBankVaults.attackVaults{value: attackCost}(CLAN_ID, bobClanId, 0, playerId);
    }

    function testAllowReattackingIfTheUserHasTheAppropriateItem() public {
        _assignLockedVaultCombatants(CLAN_ID, _uint64s(playerId), playerId, ALICE);

        _createClanWithMembers(BOB, bobPlayerId, "1");
        uint256 bobClanId = CLAN_ID + 1;
        _lockFunds(bobClanId, BOB, bobPlayerId, 1000);

        // But have to wait for the cooldown and not just the generic attack cooldown, the same clan attacking cooldown
        uint256 attackCost = lockedBankVaults.getAttackCost();
        vm.prank(ALICE);
        lockedBankVaults.attackVaults{value: attackCost}(CLAN_ID, bobClanId, 0, playerId);
        _fulfill(1);

        vm.warp(vm.getBlockTimestamp() + ATTACKING_COOLDOWN);
        attackCost = lockedBankVaults.getAttackCost();
        vm.prank(ALICE);
        vm.expectRevert(LockedBankVaultsLibrary.ClanAttackingSameClanCooldown.selector);
        lockedBankVaults.attackVaults{value: attackCost}(CLAN_ID, bobClanId, 0, playerId);

        _addLockedVaultItems();
        itemNFT.mintBatch(ALICE, _uints(DEVILISH_FINGERS, PROTECTION_SHIELD), _uints(1, 1));

        // Wrong item
        attackCost = lockedBankVaults.getAttackCost();
        vm.prank(ALICE);
        vm.expectRevert(LockedBankVaultsLibrary.NotALockedVaultAttackItem.selector);
        lockedBankVaults.attackVaults{value: attackCost}(CLAN_ID, bobClanId, PROTECTION_SHIELD, playerId);

        // The re-attacking cooldown should be the same afterwards when using an item
        ClanBattleInfo memory battleInfo = lockedBankVaults.getLastClanBattles(CLAN_ID, bobClanId);
        uint40 beforeCooldownTimestamp = battleInfo.lastClanIdAttackOtherClanIdCooldownTimestamp;
        assertEq(battleInfo.numReattacks, 0);
        attackCost = lockedBankVaults.getAttackCost();
        vm.prank(ALICE);
        lockedBankVaults.attackVaults{value: attackCost}(CLAN_ID, bobClanId, DEVILISH_FINGERS, playerId);
        _fulfill(2);
        battleInfo = lockedBankVaults.getLastClanBattles(CLAN_ID, bobClanId);
        assertEq(battleInfo.lastClanIdAttackOtherClanIdCooldownTimestamp, beforeCooldownTimestamp);
        assertEq(battleInfo.numReattacks, 1);

        vm.warp(vm.getBlockTimestamp() + ATTACKING_COOLDOWN);
        attackCost = lockedBankVaults.getAttackCost();
        vm.prank(ALICE);
        vm.expectRevert(LockedBankVaultsLibrary.ClanAttackingSameClanCooldown.selector);
        lockedBankVaults.attackVaults{value: attackCost}(CLAN_ID, bobClanId, 0, playerId);
    }

    function testUsingASuperAttackShouldGiveMoreRolls() public {
        _assignLockedVaultCombatants(CLAN_ID, _uint64s(playerId), playerId, ALICE);

        _createClanWithMembers(BOB, bobPlayerId, "1");
        uint256 bobClanId = CLAN_ID + 1;
        _assignLockedVaultCombatants(bobClanId, _uint64s(bobPlayerId), bobPlayerId, BOB);
        _lockFunds(bobClanId, BOB, bobPlayerId, 1000);

        _addItem(SHARPENED_CLAW, EquipPosition.LOCKED_VAULT, BoostType.PVP_SUPER_ATTACK, 1, 1 days);
        itemNFT.mint(ALICE, SHARPENED_CLAW, 10);

        // Try 10 times
        uint256 highestRoll;
        for (uint256 i = 1; i <= 10; ++i) {
            uint256 attackCost = lockedBankVaults.getAttackCost();
            vm.prank(ALICE);
            lockedBankVaults.attackVaults{value: attackCost}(CLAN_ID, bobClanId, SHARPENED_CLAW, playerId);
            LockedBankVaultsBattleResultData[] memory results = _fulfillBattleResults(i, 0, false);
            for (uint256 j; j < results.length; ++j) {
                if (results[j].attackingRolls[0] > highestRoll) {
                    highestRoll = results[j].attackingRolls[0];
                }
            }
            lockedBankVaults.clearCooldowns(CLAN_ID, _uints(bobClanId));
        }

        assertEq(highestRoll, 2);
        assertEq(itemNFT.balanceOf(ALICE, SHARPENED_CLAW), 0);
        assertLe(lockedBankVaults.getClanInfo(bobClanId).totalBrushLocked, 900); // lost 10%
    }

    function testSuperAttackShouldHaveACooldown() public {
        _assignLockedVaultCombatants(CLAN_ID, _uint64s(playerId), playerId, ALICE);

        // Create a new clan to defend
        _createClanWithMembers(BOB, bobPlayerId, "1");
        uint256 bobClanId = CLAN_ID + 1;
        _assignLockedVaultCombatants(bobClanId, _uint64s(bobPlayerId), bobPlayerId, BOB);
        _lockFunds(bobClanId, BOB, bobPlayerId, 1000);

        _addItem(SHARPENED_CLAW, EquipPosition.LOCKED_VAULT, BoostType.PVP_SUPER_ATTACK, 1, 1 days);
        itemNFT.mint(ALICE, SHARPENED_CLAW, 10);

        uint256 nowBefore = vm.getBlockTimestamp();

        uint256 attackCost = lockedBankVaults.getAttackCost();
        vm.expectEmit(true, true, true, true, address(lockedBankVaults));
        emit ILockedBankVaults.SuperAttackCooldown(CLAN_ID, nowBefore + SUPER_ATTACK_COOLDOWN);
        vm.prank(ALICE);
        lockedBankVaults.attackVaults{value: attackCost}(CLAN_ID, bobClanId, SHARPENED_CLAW, playerId);
        _fulfill(1);

        // Create a new clan to attack/defend
        _createClanWithMembers(CHARLIE, charliePlayerId, "2");
        uint256 charlieClanId = bobClanId + 1;
        _assignLockedVaultCombatants(charlieClanId, _uint64s(charliePlayerId), charliePlayerId, CHARLIE);
        _lockFunds(charlieClanId, CHARLIE, charliePlayerId, 1000);

        // Forward by attack cooldown and attack another clan
        vm.warp(vm.getBlockTimestamp() + ATTACKING_COOLDOWN);

        // Fails due to cooldown not reached
        attackCost = lockedBankVaults.getAttackCost();
        vm.prank(ALICE);
        vm.expectRevert(LockedBankVaultsLibrary.ClanSuperAttackingCooldown.selector);
        lockedBankVaults.attackVaults{value: attackCost}(CLAN_ID, charlieClanId, SHARPENED_CLAW, playerId);

        vm.warp(vm.getBlockTimestamp() + 1 days);
        uint256 now1 = vm.getBlockTimestamp();
        // Cooldown is now reached
        attackCost = lockedBankVaults.getAttackCost();
        vm.expectEmit(true, true, true, true, address(lockedBankVaults));
        emit ILockedBankVaults.SuperAttackCooldown(CLAN_ID, now1 + SUPER_ATTACK_COOLDOWN);
        vm.prank(ALICE);
        lockedBankVaults.attackVaults{value: attackCost}(CLAN_ID, charlieClanId, SHARPENED_CLAW, playerId);
    }

    function testBlockingAttacksWithItem() public {
        _lockFunds(CLAN_ID, ALICE, playerId, 1000);

        _createClanWithMembers(BOB, bobPlayerId, "1");
        uint256 bobClanId = CLAN_ID + 1;

        // Attack
        _assignLockedVaultCombatants(bobClanId, _uint64s(bobPlayerId), bobPlayerId, BOB);

        _addItem(PROTECTION_SHIELD, EquipPosition.LOCKED_VAULT, BoostType.PVP_BLOCK, 12, 2 days);
        _addItem(MIRROR_SHIELD, EquipPosition.TERRITORY, BoostType.PVP_BLOCK, 72, 1 days);
        itemNFT.mintBatch(ALICE, _uints(PROTECTION_SHIELD, MIRROR_SHIELD), _uints(2, 1));

        // Wrong item
        vm.prank(ALICE);
        vm.expectRevert(LockedBankVaultsLibrary.NotALockedVaultDefenceItem.selector);
        lockedBankVaults.blockAttacks(CLAN_ID, MIRROR_SHIELD, playerId);

        vm.prank(ALICE);
        lockedBankVaults.blockAttacks(CLAN_ID, PROTECTION_SHIELD, playerId);
        assertEq(itemNFT.balanceOf(ALICE, PROTECTION_SHIELD), 1);

        uint256 attackCost = lockedBankVaults.getAttackCost();
        vm.prank(BOB);
        vm.expectRevert(LockedBankVaultsLibrary.ClanIsBlockingAttacks.selector);
        lockedBankVaults.attackVaults{value: attackCost}(bobClanId, CLAN_ID, 0, bobPlayerId);

        vm.warp(vm.getBlockTimestamp() + 2 days - 10);
        attackCost = lockedBankVaults.getAttackCost();
        vm.prank(BOB);
        vm.expectRevert(LockedBankVaultsLibrary.ClanIsBlockingAttacks.selector);
        lockedBankVaults.attackVaults{value: attackCost}(bobClanId, CLAN_ID, 0, bobPlayerId);

        // Cannot apply again until the cooldown is done
        vm.prank(ALICE);
        vm.expectRevert(LockedBankVaultsLibrary.BlockAttacksCooldown.selector);
        lockedBankVaults.blockAttacks(CLAN_ID, PROTECTION_SHIELD, playerId);
        // Go just before the cooldown is done to confirm
        vm.warp(vm.getBlockTimestamp() + 12 hours);
        vm.prank(ALICE);
        vm.expectRevert(LockedBankVaultsLibrary.BlockAttacksCooldown.selector);
        lockedBankVaults.blockAttacks(CLAN_ID, PROTECTION_SHIELD, playerId);
        // Now extend past the cooldown time
        vm.warp(vm.getBlockTimestamp() + 10);
        vm.prank(ALICE);
        lockedBankVaults.blockAttacks(CLAN_ID, PROTECTION_SHIELD, playerId);

        vm.warp(vm.getBlockTimestamp() + 2 days - 10);
        attackCost = lockedBankVaults.getAttackCost();
        vm.prank(BOB);
        vm.expectRevert(LockedBankVaultsLibrary.ClanIsBlockingAttacks.selector);
        lockedBankVaults.attackVaults{value: attackCost}(bobClanId, CLAN_ID, 0, bobPlayerId);

        vm.warp(vm.getBlockTimestamp() + 10);
        attackCost = lockedBankVaults.getAttackCost();
        vm.prank(BOB);
        lockedBankVaults.attackVaults{value: attackCost}(bobClanId, CLAN_ID, 0, bobPlayerId);

        assertEq(itemNFT.balanceOf(ALICE, PROTECTION_SHIELD), 0);
    }

    function testLoseAnAttackWithSomeLockedVaults() public {
        uint256 brushBalanceBefore = brush.balanceOf(DEV);

        _lockFunds(CLAN_ID, ALICE, playerId, 300);
        _lockFunds(CLAN_ID, ALICE, playerId, 200);
        _lockFunds(CLAN_ID, ALICE, playerId, 500);

        _assignLockedVaultCombatants(CLAN_ID, _uint64s(playerId), playerId, ALICE);

        _createClanWithMembers(BOB, bobPlayerId, "1");
        uint256 bobClanId = CLAN_ID + 1;
        _joinClan(CHARLIE, charliePlayerId, bobClanId, BOB, bobPlayerId);

        _maxOutBattleXP(BOB, bobPlayerId);
        _maxOutBattleXP(CHARLIE, charliePlayerId);

        // Lock
        _lockFunds(bobClanId, BOB, bobPlayerId, 800);

        _assignLockedVaultCombatants(bobClanId, _uint64s(bobPlayerId), bobPlayerId, BOB);

        assertEq(lockedBankVaults.getClanInfo(CLAN_ID).totalBrushLocked, 1000);

        uint256 treasuryBeforeBalance = brush.balanceOf(address(treasury));

        // Alice's clan attacks but will lose.
        uint256 attackCost = lockedBankVaults.getAttackCost();
        vm.prank(ALICE);
        lockedBankVaults.attackVaults{value: attackCost}(CLAN_ID, bobClanId, 0, playerId);
        _fulfill(1);

        assertEq(lockedBankVaults.getClanInfo(CLAN_ID).totalBrushLocked, 950); // lost 5%
        assertEq(lockedBankVaults.getClanInfo(bobClanId).totalBrushLocked, 800);

        // Check it went to the correct places
        assertEq(brush.balanceOf(address(treasury)), treasuryBeforeBalance + 25);
        assertEq(brush.balanceOf(DEV), brushBalanceBefore + 12);
        assertEq(brush.amountBurnt(), brushBalanceBefore + 12);
    }

    function testWinAnAttackWithSomeLockedVaults() public {
        _lockFunds(CLAN_ID, ALICE, playerId, 300);
        _lockFunds(CLAN_ID, ALICE, playerId, 200);
        _lockFunds(CLAN_ID, ALICE, playerId, 500);

        _assignLockedVaultCombatants(CLAN_ID, _uint64s(playerId), playerId, ALICE);

        _createClanWithMembers(BOB, bobPlayerId, "1");
        uint256 bobClanId = CLAN_ID + 1;
        _joinClan(CHARLIE, charliePlayerId, bobClanId, BOB, bobPlayerId);

        _assignLockedVaultCombatants(bobClanId, _uint64s(bobPlayerId, charliePlayerId), bobPlayerId, BOB);

        // Bobs's clan attacks and will win.
        uint256 attackCost = lockedBankVaults.getAttackCost();
        vm.prank(BOB);
        lockedBankVaults.attackVaults{value: attackCost}(bobClanId, CLAN_ID, 0, bobPlayerId);
        _fulfill(1);

        assertEq(lockedBankVaults.getClanInfo(CLAN_ID).totalBrushLocked, 900); // lost 10%
        assertEq(lockedBankVaults.getClanInfo(bobClanId).totalBrushLocked, 100);

        // Check totalWon with lockedVault
        assertEq(lockedBankVaults.getClanInfo(bobClanId).defendingVaults[0].amount, 100);
    }

    function testTryFulfillAnAttackRequestIdThatIsntOngoing() public {
        _assignLockedVaultCombatants(CLAN_ID, _uint64s(playerId), playerId, ALICE);

        // Create a new clan to attack
        _createClanWithMembers(BOB, bobPlayerId, "1");
        uint256 bobClanId = CLAN_ID + 1;
        _lockFunds(bobClanId, BOB, bobPlayerId, 300);

        uint256 attackCost = lockedBankVaults.getAttackCost();
        vm.prank(ALICE);
        lockedBankVaults.attackVaults{value: attackCost}(CLAN_ID, CLAN_ID + 1, 0, playerId);

        vm.expectRevert(ILockedBankVaults.RequestIdNotKnown.selector);
        _fulfill(3);
    }

    function testClaimWithAFullPackedVaultButOnlyTheFirstIsClaimable() public {
        // Get one lock
        _lockFunds(CLAN_ID, ALICE, playerId, 300);
        // Wait a couple days and get another lock
        vm.warp(vm.getBlockTimestamp() + 2 days);
        _lockFunds(CLAN_ID, ALICE, playerId, 300);
        // Unlock it
        vm.warp(vm.getBlockTimestamp() + LOCKED_FUNDS_PERIOD - 2 days);
        // Claim funds and check the locks are correct
        vm.prank(ALICE);
        lockedBankVaults.claimFunds(CLAN_ID, playerId);
        _lockFunds(CLAN_ID, ALICE, playerId, 500);
        assertEq(lockedBankVaults.getClanInfo(CLAN_ID).defendingVaults.length, 2);
    }

    function testWhenAttacksPreventedIsEnabledNoAttacksCanBeDone() public {
        _assignLockedVaultCombatants(CLAN_ID, _uint64s(playerId), playerId, ALICE);

        // Create a new clan to attack
        _createClanWithMembers(BOB, bobPlayerId, "1");
        uint256 bobClanId = CLAN_ID + 1;
        _lockFunds(bobClanId, BOB, bobPlayerId, 300);
        lockedBankVaults.setPreventAttacks(true);
        uint256 attackCost = lockedBankVaults.getAttackCost();
        vm.prank(ALICE);
        vm.expectRevert(ILockedBankVaults.AttacksPrevented.selector);
        lockedBankVaults.attackVaults{value: attackCost}(CLAN_ID, CLAN_ID + 1, 0, playerId);
        lockedBankVaults.setPreventAttacks(false);
        attackCost = lockedBankVaults.getAttackCost();
        vm.prank(ALICE);
        lockedBankVaults.attackVaults{value: attackCost}(CLAN_ID, CLAN_ID + 1, 0, playerId);
    }

    function testInsertingShouldPrioritiseTheClanThatWasAlreadyThere() public {
        _lockFunds(CLAN_ID, ALICE, playerId, 1000);

        _createClanWithMembers(BOB, bobPlayerId, "1");
        uint256 bobClanId = 2;

        _lockFunds(bobClanId, ALICE, playerId, 1000);

        assertEqU16(lockedBankVaults.getSortedMMR(), _uint16s(INITIAL_MMR, INITIAL_MMR));
        assertEqU32(lockedBankVaults.getSortedClanIdsByMMR(), _uint32s(bobClanId, CLAN_ID));
    }

    function testCheckMMRsUpdate() public {
        _lockFunds(CLAN_ID, ALICE, playerId, 1000);

        _assignLockedVaultCombatants(CLAN_ID, _uint64s(playerId), playerId, ALICE);

        _createClanWithMembers(BOB, bobPlayerId, "1");
        uint256 bobClanId = CLAN_ID + 1;
        _joinClan(CHARLIE, charliePlayerId, bobClanId, BOB, bobPlayerId);

        // Attack
        _assignLockedVaultCombatants(bobClanId, _uint64s(bobPlayerId, charliePlayerId), bobPlayerId, BOB);

        assertEqU16(lockedBankVaults.getSortedMMR(), _uint16s(INITIAL_MMR));
        assertEqU32(lockedBankVaults.getSortedClanIdsByMMR(), _uint32s(CLAN_ID));
        assertEq(clans.getMMR(CLAN_ID), INITIAL_MMR);
        assertEq(clans.getMMR(bobClanId), INITIAL_MMR);

        uint256 attackCost = lockedBankVaults.getAttackCost();
        vm.prank(BOB);
        lockedBankVaults.attackVaults{value: attackCost}(bobClanId, CLAN_ID, 0, bobPlayerId);
        _fulfill(1);
        // Should win as they have more players
        assertEq(lockedBankVaults.getClanInfo(CLAN_ID).totalBrushLocked, 900);

        // MMRs should be updated
        assertEq(clans.getMMR(CLAN_ID), 499);
        assertEq(clans.getMMR(bobClanId), 501);

        assertEqU16(lockedBankVaults.getSortedMMR(), _uint16s(499, 501));
        assertEqU32(lockedBankVaults.getSortedClanIdsByMMR(), _uint32s(CLAN_ID, bobClanId));

        assertTrue(lockedBankVaults.getClanInfo(CLAN_ID).isInMMRArray);
        assertTrue(lockedBankVaults.getClanInfo(bobClanId).isInMMRArray);
    }

    function testCheckMMRsUpdateMultipleClansAndMultipleThings() public {
        _lockFunds(CLAN_ID, ALICE, playerId, 1000);

        _assignLockedVaultCombatants(CLAN_ID, _uint64s(playerId), playerId, ALICE);

        // Create a new clan to attack/defend with 2 members
        _createClanWithMembers(BOB, bobPlayerId, "1");
        uint256 bobClanId = CLAN_ID + 1;
        _joinClan(CHARLIE, charliePlayerId, bobClanId, BOB, bobPlayerId);
        _assignLockedVaultCombatants(bobClanId, _uint64s(bobPlayerId, charliePlayerId), bobPlayerId, BOB);

        // Create a new clan to attack/defend
        _createClanWithMembers(ERIN, erinPlayerId, "2");
        uint256 erinClanId = CLAN_ID + 2;
        _createClanWithMembers(FRANK, frankPlayerId, "3");
        uint256 frankClanId = CLAN_ID + 3;

        // Increase odds of winning by maxing out their stats
        _maxOutBattleXP(BOB, bobPlayerId);
        _maxOutBattleXP(CHARLIE, charliePlayerId);
        _maxOutBattleXP(ERIN, erinPlayerId);
        _maxOutBattleXP(FRANK, frankPlayerId);

        _assignLockedVaultCombatants(erinClanId, _uint64s(erinPlayerId), erinPlayerId, ERIN);
        _assignLockedVaultCombatants(frankClanId, _uint64s(frankPlayerId), frankPlayerId, FRANK);

        assertEqU16(lockedBankVaults.getSortedMMR(), _uint16s(INITIAL_MMR));
        assertEqU32(lockedBankVaults.getSortedClanIdsByMMR(), _uint32s(CLAN_ID));
        assertEq(clans.getMMR(CLAN_ID), INITIAL_MMR);
        assertEq(clans.getMMR(bobClanId), INITIAL_MMR);
        assertEq(clans.getMMR(erinClanId), INITIAL_MMR);
        assertEq(clans.getMMR(frankClanId), INITIAL_MMR);

        uint256 attackCost = lockedBankVaults.getAttackCost();
        vm.prank(BOB);
        lockedBankVaults.attackVaults{value: attackCost}(bobClanId, CLAN_ID, 0, bobPlayerId);
        _fulfill(1);
        // Bob wins against alice (more likely at least)
        assertEq(lockedBankVaults.getClanInfo(CLAN_ID).totalBrushLocked, 900);

        // MMRs should be updated
        assertEq(clans.getMMR(CLAN_ID), 499);
        assertEq(clans.getMMR(bobClanId), 501);
        assertEq(clans.getMMR(erinClanId), INITIAL_MMR);
        assertEq(clans.getMMR(frankClanId), INITIAL_MMR);

        assertEqU16(lockedBankVaults.getSortedMMR(), _uint16s(499, 501));
        assertEqU32(lockedBankVaults.getSortedClanIdsByMMR(), _uint32s(CLAN_ID, bobClanId));

        attackCost = lockedBankVaults.getAttackCost();
        vm.prank(ERIN);
        lockedBankVaults.attackVaults{value: attackCost}(erinClanId, CLAN_ID, 0, erinPlayerId);
        _fulfill(2);
        // Erin wins against alice (more likely at least)
        assertEq(lockedBankVaults.getClanInfo(CLAN_ID).totalBrushLocked, 810);

        assertEqU16(lockedBankVaults.getSortedMMR(), _uint16s(498, 501, 501));
        assertEqU32(lockedBankVaults.getSortedClanIdsByMMR(), _uint32s(CLAN_ID, erinClanId, bobClanId));

        _lockFunds(frankClanId, ALICE, playerId, 1000);

        assertEqU16(lockedBankVaults.getSortedMMR(), _uint16s(498, 500, 501, 501));
        assertEqU32(lockedBankVaults.getSortedClanIdsByMMR(), _uint32s(CLAN_ID, frankClanId, erinClanId, bobClanId));

        // MMRs should be updated
        assertEq(clans.getMMR(CLAN_ID), 498);
        assertEq(clans.getMMR(bobClanId), 501);
        assertEq(clans.getMMR(erinClanId), 501);

        assertTrue(lockedBankVaults.getClanInfo(CLAN_ID).isInMMRArray);
        assertTrue(lockedBankVaults.getClanInfo(bobClanId).isInMMRArray);
        assertTrue(lockedBankVaults.getClanInfo(erinClanId).isInMMRArray);
        assertTrue(lockedBankVaults.getClanInfo(frankClanId).isInMMRArray);

        lockedBankVaults.clearCooldowns(erinClanId, _uints(CLAN_ID));

        attackCost = lockedBankVaults.getAttackCost();
        vm.prank(ERIN);
        lockedBankVaults.attackVaults{value: attackCost}(erinClanId, CLAN_ID, 0, erinPlayerId);
        _fulfill(3);
        // Erin wins against alice (most likely)
        assertEqU16(lockedBankVaults.getSortedMMR(), _uint16s(497, 500, 501, 502));
        assertEqU32(lockedBankVaults.getSortedClanIdsByMMR(), _uint32s(CLAN_ID, frankClanId, bobClanId, erinClanId));

        // MMRs should be updated
        assertEq(clans.getMMR(CLAN_ID), 497);
        assertEq(clans.getMMR(bobClanId), 501);
        assertEq(clans.getMMR(erinClanId), 502);
        assertEq(clans.getMMR(frankClanId), 500);

        // Alice attacks erin and loses
        attackCost = lockedBankVaults.getAttackCost();
        vm.prank(ALICE);
        lockedBankVaults.attackVaults{value: attackCost}(CLAN_ID, erinClanId, 0, playerId);
        _fulfill(4);

        assertEqU16(lockedBankVaults.getSortedMMR(), _uint16s(496, 500, 501, 503));
        assertEqU32(lockedBankVaults.getSortedClanIdsByMMR(), _uint32s(CLAN_ID, frankClanId, bobClanId, erinClanId));

        // Alice attacks frank and loses
        lockedBankVaults.clearCooldowns(CLAN_ID, _uintsEmpty());
        attackCost = lockedBankVaults.getAttackCost();
        vm.prank(ALICE);
        lockedBankVaults.attackVaults{value: attackCost}(CLAN_ID, frankClanId, 0, playerId);
        _fulfill(5);
        assertEqU16(lockedBankVaults.getSortedMMR(), _uint16s(495, 501, 501, 503));
        assertEqU32(lockedBankVaults.getSortedClanIdsByMMR(), _uint32s(CLAN_ID, frankClanId, bobClanId, erinClanId));

        // Claim them all
        vm.warp(vm.getBlockTimestamp() + LOCKED_FUNDS_PERIOD);

        vm.prank(ALICE);
        lockedBankVaults.claimFunds(CLAN_ID, playerId);
        vm.prank(FRANK);
        lockedBankVaults.claimFunds(frankClanId, frankPlayerId);

        assertEq(clans.getMMR(CLAN_ID), 495);
        assertEq(clans.getMMR(bobClanId), 501);
        assertEq(clans.getMMR(erinClanId), 503);
        assertEq(clans.getMMR(frankClanId), 501);

        assertEqU16(lockedBankVaults.getSortedMMR(), _uint16s(501, 503));
        assertEqU32(lockedBankVaults.getSortedClanIdsByMMR(), _uint32s(bobClanId, erinClanId));

        _lockFunds(CLAN_ID, ALICE, playerId, 1000);

        assertEq(lockedBankVaults.getIdleClans(), _uints(bobClanId, erinClanId));

        vm.expectEmit(true, true, true, true, address(lockedBankVaults));
        emit ILockedBankVaults.ForceMMRUpdate(_uints(bobClanId, erinClanId));
        lockedBankVaults.forceMMRUpdate(_uints(CLAN_ID, bobClanId, erinClanId));

        assertEqU16(lockedBankVaults.getSortedMMR(), _uint16s(495));
        assertEqU32(lockedBankVaults.getSortedClanIdsByMMR(), _uint32s(CLAN_ID));
    }

    function testWinThenLoseThenWinLoseLose() public {
        _assignLockedVaultCombatants(CLAN_ID, _uint64s(playerId), playerId, ALICE);

        _createClanWithMembers(BOB, bobPlayerId, "1");
        uint256 bobClanId = CLAN_ID + 1;
        _assignLockedVaultCombatants(bobClanId, _uint64s(bobPlayerId), bobPlayerId, BOB);
        _lockFunds(bobClanId, BOB, bobPlayerId, 1000);

        _maxOutBattleXP(ALICE, playerId);

        assertEqU32(lockedBankVaults.getSortedClanIdsByMMR(), _uint32s(bobClanId));

        // Win
        uint256 attackCost = lockedBankVaults.getAttackCost();
        vm.prank(ALICE);
        lockedBankVaults.attackVaults{value: attackCost}(CLAN_ID, bobClanId, 0, playerId);
        _fulfill(1);

        assertEqU16(lockedBankVaults.getSortedMMR(), _uint16s(499, 501));
        assertEqU32(lockedBankVaults.getSortedClanIdsByMMR(), _uint32s(bobClanId, CLAN_ID));

        // Lose (make the other clan have 2 more combatants)
        _joinClan(CHARLIE, charliePlayerId, bobClanId, BOB, bobPlayerId);
        _joinClan(FRANK, frankPlayerId, bobClanId, BOB, bobPlayerId);

        combatantsHelper.clearCooldowns(_uint64s(bobPlayerId));
        lockedBankVaults.clearCooldowns(CLAN_ID, _uints(bobClanId));
        lockedBankVaults.clearCooldowns(bobClanId, _uintsEmpty());

        _assignLockedVaultCombatants(bobClanId, _uint64s(bobPlayerId, charliePlayerId, frankPlayerId), bobPlayerId, BOB);
        _maxOutBattleXP(BOB, bobPlayerId);
        _maxOutBattleXP(CHARLIE, charliePlayerId);
        _maxOutBattleXP(FRANK, frankPlayerId);
        attackCost = lockedBankVaults.getAttackCost();
        vm.prank(BOB);
        lockedBankVaults.attackVaults{value: attackCost}(bobClanId, CLAN_ID, 0, bobPlayerId);
        _fulfill(2);

        assertEqU16(lockedBankVaults.getSortedMMR(), _uint16s(500, 500));
        assertEqU32(lockedBankVaults.getSortedClanIdsByMMR(), _uint32s(CLAN_ID, bobClanId));

        // Win
        combatantsHelper.clearCooldowns(_uint64s(bobPlayerId));
        lockedBankVaults.clearCooldowns(CLAN_ID, _uints(bobClanId));
        lockedBankVaults.clearCooldowns(bobClanId, _uintsEmpty());
        _assignLockedVaultCombatants(bobClanId, _uint64sEmpty(), bobPlayerId, BOB);

        attackCost = lockedBankVaults.getAttackCost();
        vm.prank(ALICE);
        lockedBankVaults.attackVaults{value: attackCost}(CLAN_ID, bobClanId, 0, playerId);
        _fulfill(3);

        assertEq(clans.getMMR(CLAN_ID), 501);
        assertEq(clans.getMMR(bobClanId), 499);
        assertEqU16(lockedBankVaults.getSortedMMR(), _uint16s(499, 501));
        assertEqU32(lockedBankVaults.getSortedClanIdsByMMR(), _uint32s(bobClanId, CLAN_ID));

        // Lose
        combatantsHelper.clearCooldowns(_uint64s(bobPlayerId, charliePlayerId, frankPlayerId));
        lockedBankVaults.clearCooldowns(CLAN_ID, _uints(bobClanId));
        lockedBankVaults.clearCooldowns(bobClanId, _uintsEmpty());
        _assignLockedVaultCombatants(bobClanId, _uint64s(bobPlayerId, charliePlayerId, frankPlayerId), bobPlayerId, BOB);

        attackCost = lockedBankVaults.getAttackCost();
        vm.prank(BOB);
        lockedBankVaults.attackVaults{value: attackCost}(bobClanId, CLAN_ID, 0, bobPlayerId);
        _fulfill(4);
        assertEqU16(lockedBankVaults.getSortedMMR(), _uint16s(500, 500));
        assertEqU32(lockedBankVaults.getSortedClanIdsByMMR(), _uint32s(CLAN_ID, bobClanId));

        // Lose
        combatantsHelper.clearCooldowns(_uint64s(bobPlayerId, charliePlayerId, frankPlayerId));
        lockedBankVaults.clearCooldowns(CLAN_ID, _uints(bobClanId));
        lockedBankVaults.clearCooldowns(bobClanId, _uintsEmpty());
        attackCost = lockedBankVaults.getAttackCost();
        vm.prank(BOB);
        lockedBankVaults.attackVaults{value: attackCost}(bobClanId, CLAN_ID, 0, bobPlayerId);
        _fulfill(5);

        assertEq(clans.getMMR(CLAN_ID), 499);
        assertEq(clans.getMMR(bobClanId), 501);
        assertEqU16(lockedBankVaults.getSortedMMR(), _uint16s(499, 501));
        assertEqU32(lockedBankVaults.getSortedClanIdsByMMR(), _uint32s(CLAN_ID, bobClanId));

        // Win vs a clan that has a higher MMR
        combatantsHelper.clearCooldowns(_uint64s(bobPlayerId, charliePlayerId, frankPlayerId));
        lockedBankVaults.clearCooldowns(CLAN_ID, _uints(bobClanId));
        lockedBankVaults.clearCooldowns(bobClanId, _uintsEmpty());
        _assignLockedVaultCombatants(bobClanId, _uint64sEmpty(), bobPlayerId, BOB);

        attackCost = lockedBankVaults.getAttackCost();
        vm.prank(ALICE);
        lockedBankVaults.attackVaults{value: attackCost}(CLAN_ID, bobClanId, 0, playerId);
        _fulfill(6);

        assertEq(clans.getMMR(CLAN_ID), 500);
        assertEq(clans.getMMR(bobClanId), 500);
        assertEqU16(lockedBankVaults.getSortedMMR(), _uint16s(500, 500));
        assertEqU32(lockedBankVaults.getSortedClanIdsByMMR(), _uint32s(bobClanId, CLAN_ID));
    }

    function testAttackAndThenClanIsDeletedForTheAttackerShouldNotRevert() public {
        _lockFunds(CLAN_ID, ALICE, playerId, 1000);

        _assignLockedVaultCombatants(CLAN_ID, _uint64s(playerId), playerId, ALICE);

        _createClanWithMembers(BOB, bobPlayerId, "1");
        uint256 bobClanId = CLAN_ID + 1;
        _assignLockedVaultCombatants(bobClanId, _uint64s(bobPlayerId), bobPlayerId, BOB);

        // Increase odds of winning by maxing out their stats
        _maxOutBattleXP(BOB, bobPlayerId);

        uint256 attackCost = lockedBankVaults.getAttackCost();
        vm.prank(BOB);
        lockedBankVaults.attackVaults{value: attackCost}(bobClanId, CLAN_ID, 0, bobPlayerId);

        // Clan is deleted
        vm.prank(ALICE);
        clans.changeRank(CLAN_ID, playerId, ClanRank.NONE, playerId);
        assertEq(clans.getClanId(playerId), 0);
        _fulfill(1);

        assertEq(clans.getMMR(CLAN_ID), 499);
        assertEq(clans.getMMR(bobClanId), 501);

        assertEqU16(lockedBankVaults.getSortedMMR(), _uint16s(499, 501));
        assertEqU32(lockedBankVaults.getSortedClanIdsByMMR(), _uint32s(CLAN_ID, bobClanId));

        assertEq(lockedBankVaults.getIdleClans(), _uints(CLAN_ID));

        vm.expectEmit(true, true, true, true, address(lockedBankVaults));
        emit ILockedBankVaults.ForceMMRUpdate(_uints(CLAN_ID));
        lockedBankVaults.forceMMRUpdate(_uints(CLAN_ID));

        assertEqU16(lockedBankVaults.getSortedMMR(), _uint16s(501));
        assertEqU32(lockedBankVaults.getSortedClanIdsByMMR(), _uint32s(bobClanId));
    }

    function testAttackAndThenClanIsDeletedForBothShouldNotRevertAttackerWins() public {
        _lockFunds(CLAN_ID, ALICE, playerId, 1000);

        _assignLockedVaultCombatants(CLAN_ID, _uint64s(playerId), playerId, ALICE);

        _createClanWithMembers(BOB, bobPlayerId, "1");
        uint256 bobClanId = CLAN_ID + 1;
        _assignLockedVaultCombatants(bobClanId, _uint64s(bobPlayerId), bobPlayerId, BOB);

        // Increase odds of winning by maxing out their stats
        _maxOutBattleXP(BOB, bobPlayerId);

        uint256 attackCost = lockedBankVaults.getAttackCost();
        vm.prank(BOB);
        lockedBankVaults.attackVaults{value: attackCost}(bobClanId, CLAN_ID, 0, bobPlayerId);

        // Both clans are deleted
        vm.prank(ALICE);
        clans.changeRank(CLAN_ID, playerId, ClanRank.NONE, playerId);
        vm.prank(BOB);
        clans.changeRank(bobClanId, bobPlayerId, ClanRank.NONE, bobPlayerId);
        assertEq(clans.getClanId(playerId), 0);
        _fulfill(1);

        assertEq(clans.getMMR(CLAN_ID), 498); // MMR for this clan gets updated as it is still in the ranking
        assertEq(clans.getMMR(bobClanId), 2); // Attacker will win due to drawing

        assertEqU16(lockedBankVaults.getSortedMMR(), _uint16s(2, 498));
        assertEqU32(lockedBankVaults.getSortedClanIdsByMMR(), _uint32s(bobClanId, CLAN_ID));

        // getIdleClans also takes into account
        assertEq(lockedBankVaults.getIdleClans(), _uints(bobClanId, CLAN_ID));

        vm.expectEmit(true, true, true, true, address(lockedBankVaults));
        emit ILockedBankVaults.ForceMMRUpdate(_uints(CLAN_ID, bobClanId));
        lockedBankVaults.forceMMRUpdate(_uints(CLAN_ID, bobClanId));

        assertEqU16(lockedBankVaults.getSortedMMR(), _uint16sEmpty());
        assertEqU32(lockedBankVaults.getSortedClanIdsByMMR(), _uint32sEmpty());
    }

    function testAttackAndClanNoLongerHasLockedFundsDontClaimFunds() public {
        _lockFunds(CLAN_ID, ALICE, playerId, 1000);

        _assignLockedVaultCombatants(CLAN_ID, _uint64s(playerId), playerId, ALICE);

        _createClanWithMembers(BOB, bobPlayerId, "1");
        uint256 bobClanId = CLAN_ID + 1;
        _assignLockedVaultCombatants(bobClanId, _uint64s(bobPlayerId), bobPlayerId, BOB);

        uint256 attackCost = lockedBankVaults.getAttackCost();
        vm.prank(BOB);
        lockedBankVaults.attackVaults{value: attackCost}(bobClanId, CLAN_ID, 0, bobPlayerId);

        vm.warp(vm.getBlockTimestamp() + LOCKED_FUNDS_PERIOD + 1);

        // Both clans are deleted
        _fulfill(1);

        assertEq(clans.getMMR(CLAN_ID), 499);
        assertEq(clans.getMMR(bobClanId), 501); // Attacker will win due to drawing

        assertEqU16(lockedBankVaults.getSortedMMR(), _uint16s(499, 501));
        assertEqU32(lockedBankVaults.getSortedClanIdsByMMR(), _uint32s(CLAN_ID, bobClanId));

        assertEq(lockedBankVaults.getIdleClans(), _uints(CLAN_ID, bobClanId));

        vm.expectEmit(true, true, true, true, address(lockedBankVaults));
        emit ILockedBankVaults.ForceMMRUpdate(_uints(CLAN_ID, bobClanId));
        lockedBankVaults.forceMMRUpdate(_uints(CLAN_ID, bobClanId));

        assertEqU16(lockedBankVaults.getSortedMMR(), _uint16sEmpty());
        assertEqU32(lockedBankVaults.getSortedClanIdsByMMR(), _uint32sEmpty());
    }

    function testAttackAndClanNoLongerHasLockedFundsClaimTheFunds() public {
        _lockFunds(CLAN_ID, ALICE, playerId, 1000);

        _assignLockedVaultCombatants(CLAN_ID, _uint64s(playerId), playerId, ALICE);

        _createClanWithMembers(BOB, bobPlayerId, "1");
        uint256 bobClanId = CLAN_ID + 1;
        _assignLockedVaultCombatants(bobClanId, _uint64s(bobPlayerId), bobPlayerId, BOB);

        uint256 attackCost = lockedBankVaults.getAttackCost();
        vm.prank(BOB);
        lockedBankVaults.attackVaults{value: attackCost}(bobClanId, CLAN_ID, 0, bobPlayerId);

        vm.warp(vm.getBlockTimestamp() + LOCKED_FUNDS_PERIOD + 1);
        vm.prank(ALICE);
        lockedBankVaults.claimFunds(CLAN_ID, playerId);

        // Both clans are deleted
        _fulfill(1);

        assertEq(clans.getMMR(CLAN_ID), 499);
        assertEq(clans.getMMR(bobClanId), 501); // Attacker will win due to drawing

        assertEqU16(lockedBankVaults.getSortedMMR(), _uint16s(501)); // Still gets the points for winning
        assertEqU32(lockedBankVaults.getSortedClanIdsByMMR(), _uint32s(bobClanId));

        assertEq(lockedBankVaults.getIdleClans(), _uints(bobClanId));

        vm.expectEmit(true, true, true, true, address(lockedBankVaults));
        emit ILockedBankVaults.ForceMMRUpdate(_uints(bobClanId));
        lockedBankVaults.forceMMRUpdate(_uints(CLAN_ID, bobClanId));

        assertEqU16(lockedBankVaults.getSortedMMR(), _uint16sEmpty());
        assertEqU32(lockedBankVaults.getSortedClanIdsByMMR(), _uint32sEmpty());
    }

    function testMustAttackWithinRangeSkippingLowRosterClans() public {
        _lockFunds(CLAN_ID, ALICE, playerId, 1000);

        _joinClan(GEOFF, geoffPlayerId, CLAN_ID, ALICE, playerId);
        _joinClan(HARRY, harryPlayerId, CLAN_ID, ALICE, playerId);
        _assignLockedVaultCombatants(CLAN_ID, _uint64s(playerId, geoffPlayerId, harryPlayerId), playerId, ALICE);

        // Create a new clan to attack/defend with 3 members
        _createClanWithMembers(BOB, bobPlayerId, "1");
        uint256 bobClanId = CLAN_ID + 1;
        _joinClan(CHARLIE, charliePlayerId, bobClanId, BOB, bobPlayerId);
        _joinClan(ISLA, islaPlayerId, bobClanId, BOB, bobPlayerId);
        _assignLockedVaultCombatants(bobClanId, _uint64s(bobPlayerId, charliePlayerId, islaPlayerId), bobPlayerId, BOB);

        // Create a new clan to attack/defend
        _createClanWithMembers(ERIN, erinPlayerId, "2");
        uint256 erinClanId = CLAN_ID + 2;
        _createClanWithMembers(FRANK, frankPlayerId, "3");
        uint256 frankClanId = CLAN_ID + 3;

        // Increase odds of winning by maxing out their stats
        _maxOutBattleXP(BOB, bobPlayerId);
        _maxOutBattleXP(CHARLIE, charliePlayerId);
        _maxOutBattleXP(ISLA, islaPlayerId);
        _maxOutBattleXP(ERIN, erinPlayerId);

        _assignLockedVaultCombatants(erinClanId, _uint64s(erinPlayerId), erinPlayerId, ERIN);
        _assignLockedVaultCombatants(frankClanId, _uint64s(frankPlayerId), frankPlayerId, FRANK);

        assertEqU16(lockedBankVaults.getSortedMMR(), _uint16s(INITIAL_MMR));
        assertEqU32(lockedBankVaults.getSortedClanIdsByMMR(), _uint32s(CLAN_ID));
        assertEq(clans.getMMR(CLAN_ID), INITIAL_MMR);
        assertEq(clans.getMMR(bobClanId), INITIAL_MMR);
        assertEq(clans.getMMR(erinClanId), INITIAL_MMR);
        assertEq(clans.getMMR(frankClanId), INITIAL_MMR);

        uint256 attackCost = lockedBankVaults.getAttackCost();
        vm.prank(BOB);
        lockedBankVaults.attackVaults{value: attackCost}(bobClanId, CLAN_ID, 0, bobPlayerId);
        _fulfill(1);
        // Bob wins against alice (more likely at least)
        assertEq(lockedBankVaults.getClanInfo(CLAN_ID).totalBrushLocked, 900);

        // MMRs should be updated
        assertEq(clans.getMMR(CLAN_ID), 499);
        assertEq(clans.getMMR(bobClanId), 501);
        assertEq(clans.getMMR(erinClanId), INITIAL_MMR);
        assertEq(clans.getMMR(frankClanId), INITIAL_MMR);

        assertEqU16(lockedBankVaults.getSortedMMR(), _uint16s(499, 501));
        assertEqU32(lockedBankVaults.getSortedClanIdsByMMR(), _uint32s(CLAN_ID, bobClanId));

        // Add brush to frank so they can be attacked
        _lockFunds(frankClanId, ALICE, playerId, 1000);

        attackCost = lockedBankVaults.getAttackCost();
        vm.prank(ERIN);
        lockedBankVaults.attackVaults{value: attackCost}(erinClanId, frankClanId, 0, erinPlayerId);
        _fulfill(2);
        // Erin wins against frank (more likely at least)
        assertEq(lockedBankVaults.getClanInfo(frankClanId).totalBrushLocked, 900);

        // MMRs should be updated
        assertEq(clans.getMMR(CLAN_ID), 499);
        assertEq(clans.getMMR(bobClanId), 501);
        assertEq(clans.getMMR(erinClanId), 501);
        assertEq(clans.getMMR(frankClanId), 499);

        assertEqU16(lockedBankVaults.getSortedMMR(), _uint16s(499, 499, 501, 501));
        assertEqU32(lockedBankVaults.getSortedClanIdsByMMR(), _uint32s(frankClanId, CLAN_ID, erinClanId, bobClanId));

        lockedBankVaults.clearCooldowns(bobClanId, _uints(CLAN_ID));

        attackCost = lockedBankVaults.getAttackCost();
        vm.prank(BOB);
        lockedBankVaults.attackVaults{value: attackCost}(bobClanId, CLAN_ID, 0, bobPlayerId);
        _fulfill(3);
        // Bob wins against alice (more likely at least)
        assertEq(lockedBankVaults.getClanInfo(CLAN_ID).totalBrushLocked, 810);

        // MMRs should be updated
        assertEq(clans.getMMR(CLAN_ID), 498);
        assertEq(clans.getMMR(bobClanId), 502);
        assertEq(clans.getMMR(erinClanId), 501);
        assertEq(clans.getMMR(frankClanId), 499);

        assertEqU16(lockedBankVaults.getSortedMMR(), _uint16s(498, 499, 501, 502));
        assertEqU32(lockedBankVaults.getSortedClanIdsByMMR(), _uint32s(CLAN_ID, frankClanId, erinClanId, bobClanId));

        // Change attack distance to 1
        lockedBankVaults.setMMRAttackDistance(1);

        // Alice should still be able to attack bob due to the rosters of erin and frank being too small
        attackCost = lockedBankVaults.getAttackCost();
        vm.prank(ALICE);
        lockedBankVaults.attackVaults{value: attackCost}(CLAN_ID, bobClanId, 0, playerId);
        _fulfill(4);
        // Bob wins against alice (more likely at least)
        assertEq(lockedBankVaults.getClanInfo(CLAN_ID).totalBrushLocked, 770);

        assertEqU16(lockedBankVaults.getSortedMMR(), _uint16s(497, 499, 501, 503));
        assertEqU32(lockedBankVaults.getSortedClanIdsByMMR(), _uint32s(CLAN_ID, frankClanId, erinClanId, bobClanId));

        // Frank can't attack bob due to range
        attackCost = lockedBankVaults.getAttackCost();
        vm.prank(FRANK);
        vm.expectRevert(LockedBankVaultsLibrary.OutsideMMRRange.selector);
        lockedBankVaults.attackVaults{value: attackCost}(frankClanId, bobClanId, 0, frankPlayerId);

        lockedBankVaults.clearCooldowns(frankClanId, _uints(CLAN_ID));
        lockedBankVaults.clearCooldowns(erinClanId, _uintsEmpty());

        // Erin cannot attack clanId
        attackCost = lockedBankVaults.getAttackCost();
        vm.prank(ERIN);
        vm.expectRevert(LockedBankVaultsLibrary.OutsideMMRRange.selector);
        lockedBankVaults.attackVaults{value: attackCost}(erinClanId, CLAN_ID, 0, erinPlayerId);

        // Erin can attack frank.
        lockedBankVaults.clearCooldowns(erinClanId, _uints(frankClanId));
        combatantsHelper.clearCooldowns(_uint64s(erinPlayerId));

        attackCost = lockedBankVaults.getAttackCost();
        vm.prank(ERIN);
        lockedBankVaults.attackVaults{value: attackCost}(erinClanId, frankClanId, 0, erinPlayerId);
        _fulfill(5);
        assertEqU16(lockedBankVaults.getSortedMMR(), _uint16s(497, 498, 502, 503));
        assertEqU32(lockedBankVaults.getSortedClanIdsByMMR(), _uint32s(CLAN_ID, frankClanId, erinClanId, bobClanId));
    }

    function testMustAttackWithinRange() public {
        _lockFunds(CLAN_ID, ALICE, playerId, 1000);

        _assignLockedVaultCombatants(CLAN_ID, _uint64s(playerId), playerId, ALICE);

        // Create a new clan to attack/defend with 2 members
        _createClanWithMembers(BOB, bobPlayerId, "1");
        uint256 bobClanId = CLAN_ID + 1;
        _joinClan(CHARLIE, charliePlayerId, bobClanId, BOB, bobPlayerId);

        _assignLockedVaultCombatants(bobClanId, _uint64s(bobPlayerId), bobPlayerId, BOB);

        // Create a new clan to attack/defend
        _createClanWithMembers(ERIN, erinPlayerId, "2");
        uint256 erinClanId = CLAN_ID + 2;
        _createClanWithMembers(FRANK, frankPlayerId, "3");
        uint256 frankClanId = CLAN_ID + 3;

        // Increase odds of winning by maxing out their stats
        _maxOutBattleXP(BOB, bobPlayerId);
        _maxOutBattleXP(ERIN, erinPlayerId);

        _assignLockedVaultCombatants(erinClanId, _uint64s(erinPlayerId), erinPlayerId, ERIN);
        _assignLockedVaultCombatants(frankClanId, _uint64s(frankPlayerId), frankPlayerId, FRANK);

        assertEqU16(lockedBankVaults.getSortedMMR(), _uint16s(INITIAL_MMR));
        assertEqU32(lockedBankVaults.getSortedClanIdsByMMR(), _uint32s(CLAN_ID));
        assertEq(clans.getMMR(CLAN_ID), INITIAL_MMR);
        assertEq(clans.getMMR(bobClanId), INITIAL_MMR);
        assertEq(clans.getMMR(erinClanId), INITIAL_MMR);
        assertEq(clans.getMMR(frankClanId), INITIAL_MMR);

        uint256 attackCost = lockedBankVaults.getAttackCost();
        vm.prank(BOB);
        lockedBankVaults.attackVaults{value: attackCost}(bobClanId, CLAN_ID, 0, bobPlayerId);
        _fulfill(1);
        // Bob wins against alice (more likely at least)
        assertEq(lockedBankVaults.getClanInfo(CLAN_ID).totalBrushLocked, 900);

        // MMRs should be updated
        assertEq(clans.getMMR(CLAN_ID), 499);
        assertEq(clans.getMMR(bobClanId), 501);
        assertEq(clans.getMMR(erinClanId), INITIAL_MMR);
        assertEq(clans.getMMR(frankClanId), INITIAL_MMR);

        assertEqU16(lockedBankVaults.getSortedMMR(), _uint16s(499, 501));
        assertEqU32(lockedBankVaults.getSortedClanIdsByMMR(), _uint32s(CLAN_ID, bobClanId));

        attackCost = lockedBankVaults.getAttackCost();
        vm.prank(ERIN);
        lockedBankVaults.attackVaults{value: attackCost}(erinClanId, CLAN_ID, 0, erinPlayerId);
        _fulfill(2);
        // Erin wins again alice (more likely at least)
        assertEq(lockedBankVaults.getClanInfo(CLAN_ID).totalBrushLocked, 810);

        assertEqU16(lockedBankVaults.getSortedMMR(), _uint16s(498, 501, 501));
        assertEqU32(lockedBankVaults.getSortedClanIdsByMMR(), _uint32s(CLAN_ID, erinClanId, bobClanId));

        _lockFunds(frankClanId, ALICE, playerId, 1000);

        assertEqU16(lockedBankVaults.getSortedMMR(), _uint16s(498, 500, 501, 501));
        assertEqU32(lockedBankVaults.getSortedClanIdsByMMR(), _uint32s(CLAN_ID, frankClanId, erinClanId, bobClanId));

        // Change attack distance to 1
        lockedBankVaults.setMMRAttackDistance(1);

        // frank can attack alice due to duplicate MMRs at the edge, so don't try
        // Attack at both extremes as well, alice cannot attack erin
        attackCost = lockedBankVaults.getAttackCost();
        vm.prank(ALICE);
        vm.expectRevert(LockedBankVaultsLibrary.OutsideMMRRange.selector);
        lockedBankVaults.attackVaults{value: attackCost}(CLAN_ID, erinClanId, 0, playerId);

        lockedBankVaults.clearCooldowns(erinClanId, _uints(CLAN_ID));

        // Erin cannot attack clanId
        attackCost = lockedBankVaults.getAttackCost();
        vm.prank(ERIN);
        vm.expectRevert(LockedBankVaultsLibrary.OutsideMMRRange.selector);
        lockedBankVaults.attackVaults{value: attackCost}(erinClanId, CLAN_ID, 0, erinPlayerId);

        // Erin can attack frank.
        lockedBankVaults.clearCooldowns(erinClanId, _uintsEmpty());
        combatantsHelper.clearCooldowns(_uint64s(frankPlayerId));
        lockedBankVaults.clearCooldowns(frankClanId, _uintsEmpty());

        attackCost = lockedBankVaults.getAttackCost();
        vm.prank(ERIN);
        lockedBankVaults.attackVaults{value: attackCost}(erinClanId, frankClanId, 0, erinPlayerId);
        _fulfill(3);
        assertEqU16(lockedBankVaults.getSortedMMR(), _uint16s(498, 499, 501, 502));
        assertEqU32(lockedBankVaults.getSortedClanIdsByMMR(), _uint32s(CLAN_ID, frankClanId, bobClanId, erinClanId));
    }

    function testAttackingLargeClanWithSmallClanDoesntMoveMMROfLargeClan() public {
        _lockFunds(CLAN_ID, ALICE, playerId, 1000);
        _assignLockedVaultCombatants(CLAN_ID, _uint64s(playerId), playerId, ALICE);

        // Create a new clan to attack/defend between each other
        _createClanWithMembers(BOB, bobPlayerId, "1");
        uint256 bobClanId = CLAN_ID + 1;
        _joinClan(CHARLIE, charliePlayerId, bobClanId, BOB, bobPlayerId);
        _joinClan(FRANK, frankPlayerId, bobClanId, BOB, bobPlayerId);
        _assignLockedVaultCombatants(bobClanId, _uint64s(bobPlayerId, charliePlayerId, frankPlayerId), bobPlayerId, BOB);

        // Increase odds of winning by maxing out their stats
        _maxOutBattleXP(BOB, bobPlayerId);
        _maxOutBattleXP(CHARLIE, charliePlayerId);
        _maxOutBattleXP(FRANK, frankPlayerId);

        // Attacker wins (most likely)
        uint256 attackCost = lockedBankVaults.getAttackCost();
        vm.prank(BOB);
        lockedBankVaults.attackVaults{value: attackCost}(bobClanId, CLAN_ID, 0, bobPlayerId);
        _fulfill(1);

        assertEqU16(lockedBankVaults.getSortedMMR(), _uint16s(499, 501));
        assertEqU32(lockedBankVaults.getSortedClanIdsByMMR(), _uint32s(CLAN_ID, bobClanId));

        attackCost = lockedBankVaults.getAttackCost();
        vm.prank(ALICE);
        lockedBankVaults.attackVaults{value: attackCost}(CLAN_ID, bobClanId, 0, playerId);
        _fulfill(2);

        // Should not move as bobClanId is a larger clan
        assertEqU16(lockedBankVaults.getSortedMMR(), _uint16s(498, 501));
        assertEqU32(lockedBankVaults.getSortedClanIdsByMMR(), _uint32s(CLAN_ID, bobClanId));

        // Attacker loses (most likely)
        // Well first win so that MMRs are different
        lockedBankVaults.clearCooldowns(CLAN_ID, _uints(bobClanId));
        attackCost = lockedBankVaults.getAttackCost();
        vm.prank(ALICE);
        lockedBankVaults.attackVaults{value: attackCost}(CLAN_ID, bobClanId, 0, playerId);
        _fulfill(3);

        assertEqU16(lockedBankVaults.getSortedMMR(), _uint16s(497, 501));
        assertEqU32(lockedBankVaults.getSortedClanIdsByMMR(), _uint32s(CLAN_ID, bobClanId));
    }

    function testForceUpdatingMMRShouldCorrectlyCleanseAnyInitializedClans() public {
        _lockFunds(CLAN_ID, ALICE, playerId, 1000);

        lockedBankVaults.initializeMMR(_uints(1, 2, 3, 4), _uint16s(1000, 2000, 3000, 4000), true);

        assertEqU16(lockedBankVaults.getSortedMMR(), _uint16s(1000, 2000, 3000, 4000));
        assertEqU32(lockedBankVaults.getSortedClanIdsByMMR(), _uint32s(1, 2, 3, 4));

        assertEq(lockedBankVaults.getIdleClans(), _uints(2, 3, 4));
        lockedBankVaults.forceMMRUpdate(_uints(2, 3, 4));

        assertEqU16(lockedBankVaults.getSortedMMR(), _uint16s(1000));
        assertEqU32(lockedBankVaults.getSortedClanIdsByMMR(), _uint32s(CLAN_ID));
    }

    function testForceUpdatingMMRShouldCorrectlyCleanseAnyInitializedClansMultipleGaps() public {
        uint256 devUpgradedPlayerId = _createUpgradedPlayer(DEV, string.concat(ORIG_NAME, "1000"));

        address[6] memory signers = [address(this), BOB, CHARLIE, DEV, ERIN, FRANK];
        uint256[6] memory ids =
            [ownerPlayerId, bobPlayerId, charliePlayerId, devUpgradedPlayerId, erinPlayerId, frankPlayerId];
        for (uint256 i; i < signers.length; ++i) {
            vm.prank(signers[i]);
            clans.createClan(ids[i], string.concat("name", vm.toString(i)), "", "", "", 2, 1);
        }

        // alice is 1, owner is 2
        _lockFunds(CLAN_ID, ALICE, playerId, 1000);
        // owner and bob get nothing
        _lockFunds(CLAN_ID + 3, ALICE, playerId, 1000);
        // dev and erin get nothing
        _lockFunds(CLAN_ID + 6, ALICE, playerId, 1000);

        lockedBankVaults.initializeMMR(_uints(1, 2, 3, 4, 5, 6, 7), _uint16s(500, 500, 500, 500, 500, 500, 500), true);

        assertEqU32(lockedBankVaults.getSortedClanIdsByMMR(), _uint32s(7, 6, 5, 4, 3, 2, 1));

        assertEq(lockedBankVaults.getIdleClans(), _uints(6, 5, 3, 2));
        lockedBankVaults.forceMMRUpdate(_uints(3, 5, 6, 2)); // Try in a different order

        assertEqU16(lockedBankVaults.getSortedMMR(), _uint16s(500, 500, 500));
        assertEqU32(lockedBankVaults.getSortedClanIdsByMMR(), _uint32s(7, 4, 1));
    }

    function testTryNotClearingWithInitializeMMR() public {
        _lockFunds(CLAN_ID, ALICE, playerId, 1000);

        lockedBankVaults.initializeMMR(_uints(1, 2, 3, 4), _uint16s(1000, 2000, 3000, 4000), true);

        assertEqU16(lockedBankVaults.getSortedMMR(), _uint16s(1000, 2000, 3000, 4000));
        assertEqU32(lockedBankVaults.getSortedClanIdsByMMR(), _uint32s(1, 2, 3, 4));

        lockedBankVaults.initializeMMR(_uints(7, 8), _uint16s(1000, 2000), false);
        assertEqU16(lockedBankVaults.getSortedMMR(), _uint16s(1000, 1000, 2000, 2000, 3000, 4000));
        assertEqU32(lockedBankVaults.getSortedClanIdsByMMR(), _uint32s(7, 1, 8, 2, 3, 4));
    }

    function testGasUsedGetIdleClansForManyClansShouldBeBelowMax() public {
        uint256[] memory clanIds = new uint256[](100);
        uint16[] memory mmrs = new uint16[](100);
        for (uint256 i; i < 100; ++i) {
            clanIds[i] = i + 1;
            mmrs[i] = uint16(i + 1);
        }
        uint256 startGas = gasleft();
        lockedBankVaults.initializeMMR(clanIds, mmrs, false);
        uint256 gasUsed = startGas - gasleft();
        assertLt(gasUsed, 6_000_000);

        uint256 startGas2 = gasleft();
        uint256[] memory idleClans = lockedBankVaults.getIdleClans();
        gasUsed = startGas2 - gasleft();
        assertLt(gasUsed, 6_000_000);
        startGas2 = gasleft();
        lockedBankVaults.forceMMRUpdate(idleClans);
        gasUsed = startGas2 - gasleft();
        assertLt(gasUsed, 6_000_000);
    }

    function testAttackingAClanWhereTheDefenderHas0MMRAndAttackerWins() public {
        _lockFunds(CLAN_ID, ALICE, playerId, 1000);
        _assignLockedVaultCombatants(CLAN_ID, _uint64s(playerId), playerId, ALICE);

        // Create a new clan to attack/defend between each other
        _createClanWithMembers(BOB, bobPlayerId, "1");
        uint256 bobClanId = CLAN_ID + 1;
        _assignLockedVaultCombatants(bobClanId, _uint64s(bobPlayerId), bobPlayerId, BOB);

        // Increase odds of winning by maxing out their stats
        _maxOutBattleXP(BOB, bobPlayerId);

        lockedBankVaults.initializeMMR(_uints(CLAN_ID), _uint16s(0), true);
        lockedBankVaults.setKValues(32, 32);
        assertEqU32(lockedBankVaults.getSortedClanIdsByMMR(), _uint32s(CLAN_ID));
        assertEqU16(lockedBankVaults.getSortedMMR(), _uint16s(0));

        // Attacker wins (most likely)
        uint256 attackCost = lockedBankVaults.getAttackCost();
        vm.prank(BOB);
        lockedBankVaults.attackVaults{value: attackCost}(bobClanId, CLAN_ID, 0, bobPlayerId);
        _fulfill(1);

        assertEqU16(lockedBankVaults.getSortedMMR(), _uint16s(0, 501));
        assertEqU32(lockedBankVaults.getSortedClanIdsByMMR(), _uint32s(CLAN_ID, bobClanId));
    }

    function testAttackingAClanWhereTheDefenderHas0MMRAndAttackerLoses() public {
        _lockFunds(CLAN_ID, ALICE, playerId, 1000);
        _assignLockedVaultCombatants(CLAN_ID, _uint64s(playerId), playerId, ALICE);

        _createClanWithMembers(BOB, bobPlayerId, "1");
        uint256 bobClanId = CLAN_ID + 1;
        _assignLockedVaultCombatants(bobClanId, _uint64s(bobPlayerId), bobPlayerId, BOB);

        // Increase odds of winning by maxing out their stats
        _maxOutBattleXP(ALICE, playerId);

        lockedBankVaults.initializeMMR(_uints(CLAN_ID, bobClanId), _uint16s(0, 500), true);
        lockedBankVaults.setKValues(32, 32);

        // Attacker loses (most likely)
        uint256 attackCost = lockedBankVaults.getAttackCost();
        vm.prank(BOB);
        lockedBankVaults.attackVaults{value: attackCost}(bobClanId, CLAN_ID, 0, bobPlayerId);
        _fulfill(1);

        assertEqU16(lockedBankVaults.getSortedMMR(), _uint16s(30, 470));
        assertEqU32(lockedBankVaults.getSortedClanIdsByMMR(), _uint32s(CLAN_ID, bobClanId));
    }

    function testAttackingAClanWhereTheAttackerHas0MMRAndAttackerWins() public {
        _lockFunds(CLAN_ID, ALICE, playerId, 1000);
        _assignLockedVaultCombatants(CLAN_ID, _uint64s(playerId), playerId, ALICE);

        _createClanWithMembers(BOB, bobPlayerId, "1");
        uint256 bobClanId = CLAN_ID + 1;
        _assignLockedVaultCombatants(bobClanId, _uint64s(bobPlayerId), bobPlayerId, BOB);

        // Increase odds of winning by maxing out their stats
        _maxOutBattleXP(BOB, bobPlayerId);

        lockedBankVaults.initializeMMR(_uints(bobClanId), _uint16s(0), false);
        lockedBankVaults.setKValues(32, 32);

        // Attacker wins (most likely)
        uint256 attackCost = lockedBankVaults.getAttackCost();
        vm.prank(BOB);
        lockedBankVaults.attackVaults{value: attackCost}(bobClanId, CLAN_ID, 0, bobPlayerId);
        _fulfill(1);

        assertEqU16(lockedBankVaults.getSortedMMR(), _uint16s(30, 470));
        assertEqU32(lockedBankVaults.getSortedClanIdsByMMR(), _uint32s(bobClanId, CLAN_ID));
    }

    function testAttackingAClanWhereTheAttackerHas0MMRAndAttackerLoses() public {
        _lockFunds(CLAN_ID, ALICE, playerId, 1000);
        _assignLockedVaultCombatants(CLAN_ID, _uint64s(playerId), playerId, ALICE);

        _createClanWithMembers(BOB, bobPlayerId, "1");
        uint256 bobClanId = CLAN_ID + 1;
        _assignLockedVaultCombatants(bobClanId, _uint64s(bobPlayerId), bobPlayerId, BOB);

        // Increase odds of winning by maxing out their stats
        _maxOutBattleXP(ALICE, playerId);

        lockedBankVaults.initializeMMR(_uints(bobClanId), _uint16s(0), false);
        assertEqU16(lockedBankVaults.getSortedMMR(), _uint16s(0, 500));
        assertEqU32(lockedBankVaults.getSortedClanIdsByMMR(), _uint32s(bobClanId, CLAN_ID));

        lockedBankVaults.setKValues(32, 32);

        // Attacker loses (most likely)
        uint256 attackCost = lockedBankVaults.getAttackCost();
        vm.prank(BOB);
        lockedBankVaults.attackVaults{value: attackCost}(bobClanId, CLAN_ID, 0, bobPlayerId);
        _fulfill(1);

        assertEqU16(lockedBankVaults.getSortedMMR(), _uint16s(0, 501));
        assertEqU32(lockedBankVaults.getSortedClanIdsByMMR(), _uint32s(bobClanId, CLAN_ID));
    }

    function testAttackingShouldNotModifyTheMMRArraysIfTheAttackerIsNotInTheRankingYet() public {
        _lockFunds(CLAN_ID, ALICE, playerId, 1000);
        _assignLockedVaultCombatants(CLAN_ID, _uint64s(playerId), playerId, ALICE);

        _createClanWithMembers(BOB, bobPlayerId, "1");
        uint256 bobClanId = CLAN_ID + 1;
        _assignLockedVaultCombatants(bobClanId, _uint64s(bobPlayerId), bobPlayerId, BOB);

        // Increase odds of winning by maxing out their stats
        _maxOutBattleXP(BOB, bobPlayerId);

        lockedBankVaults.initializeMMR(_uints(CLAN_ID), _uint16s(0), true);
        lockedBankVaults.setKValues(32, 32);
        assertEqU32(lockedBankVaults.getSortedClanIdsByMMR(), _uint32s(CLAN_ID));
        assertEqU16(lockedBankVaults.getSortedMMR(), _uint16s(0));

        // Attacker wins (most likely)
        uint256 attackCost = lockedBankVaults.getAttackCost();
        vm.prank(BOB);
        lockedBankVaults.attackVaults{value: attackCost}(bobClanId, CLAN_ID, 0, bobPlayerId);

        assertEqU16(lockedBankVaults.getSortedMMR(), _uint16s(0));
        assertEqU32(lockedBankVaults.getSortedClanIdsByMMR(), _uint32s(CLAN_ID));
    }

    function testAttackingShouldNotModifyTheMMRArraysIfTheAttackerLosesAndIsNotInTheRankingYet() public {
        _lockFunds(CLAN_ID, ALICE, playerId, 1000);
        _assignLockedVaultCombatants(CLAN_ID, _uint64s(playerId), playerId, ALICE);

        _createClanWithMembers(BOB, bobPlayerId, "1");
        uint256 bobClanId = CLAN_ID + 1;
        _assignLockedVaultCombatants(bobClanId, _uint64s(bobPlayerId), bobPlayerId, BOB);

        // Increase odds of winning by maxing out their stats
        _maxOutBattleXP(ALICE, playerId);

        // Attacker loses (most likely)
        uint256 attackCost = lockedBankVaults.getAttackCost();
        vm.prank(BOB);
        lockedBankVaults.attackVaults{value: attackCost}(bobClanId, CLAN_ID, 0, bobPlayerId);

        assertTrue(lockedBankVaults.getClanInfo(CLAN_ID).isInMMRArray);
        assertFalse(lockedBankVaults.getClanInfo(bobClanId).isInMMRArray);
    }

    function testCheckShufflingWorksCorrectlyInTheBattleResultEvent() public {
        _lockFunds(CLAN_ID, ALICE, playerId, 1000);

        // Add owner to alice's clan
        clans.requestToJoin(CLAN_ID, ownerPlayerId, 0);
        vm.prank(ALICE);
        clans.acceptJoinRequests(CLAN_ID, _uints(ownerPlayerId), playerId);
        _assignLockedVaultCombatants(CLAN_ID, _uint64s(playerId, ownerPlayerId), playerId, ALICE);

        // Create a new clan to attack/defend
        _createClanWithMembers(BOB, bobPlayerId, "1");
        uint256 bobClanId = CLAN_ID + 1;
        _joinClan(CHARLIE, charliePlayerId, bobClanId, BOB, bobPlayerId);

        // Bob has 2 players
        _assignLockedVaultCombatants(bobClanId, _uint64s(bobPlayerId, charliePlayerId), bobPlayerId, BOB);
        uint256 attackCost = lockedBankVaults.getAttackCost();
        vm.prank(BOB);
        lockedBankVaults.attackVaults{value: attackCost}(bobClanId, CLAN_ID, 0, bobPlayerId);

        // If the ClanBattleLibrary battle outcome function has not changed, this seed should give the expected result
        LockedBankVaultsBattleResultData[] memory results = _fulfillBattleResults(1, 2, true);
        assertEq(_toU256(results[results.length - 1].attackingPlayerIds), _uints(charliePlayerId, bobPlayerId));
        assertEq(_toU256(results[results.length - 1].defendingPlayerIds), _uints(ownerPlayerId, playerId));
    }

    function _decodeBattleResult(Vm.Log memory log)
        private
        view
        returns (LockedBankVaultsBattleResultData memory result)
    {
        return battleResultDecoder.decode(log.data);
    }

    function _fulfillBattleResults(uint256 requestId, uint256 seed, bool seeded)
        private
        returns (LockedBankVaultsBattleResultData[] memory results)
    {
        vm.recordLogs();
        if (seeded) {
            mockVRF.fulfillSeeded(requestId, address(lockedBankVaults), seed);
        } else {
            mockVRF.fulfill(requestId, address(lockedBankVaults));
        }
        Vm.Log[] memory logs = vm.getRecordedLogs();
        uint256 count;
        for (uint256 i; i < logs.length; ++i) {
            if (logs[i].topics[0] == BATTLE_RESULT_TOPIC) {
                ++count;
            }
        }
        results = new LockedBankVaultsBattleResultData[](count);
        uint256 index;
        for (uint256 i; i < logs.length; ++i) {
            if (logs[i].topics[0] == BATTLE_RESULT_TOPIC) {
                results[index++] = _decodeBattleResult(logs[i]);
            }
        }
        require(count != 0, "BattleResult event not found");
    }

    function _fulfill(uint256 requestId) private {
        mockVRF.fulfill(requestId, address(lockedBankVaults));
    }

    function _lockFunds(uint256 clanId, address from, uint256 fromPlayerId, uint256 amount) private {
        brush.mint(address(territories), amount);
        vm.prank(address(territories));
        lockedBankVaults.lockFunds(clanId, from, fromPlayerId, amount);
    }

    function _assignLockedVaultCombatants(
        uint256 clanId,
        uint64[] memory playerIds,
        uint256 leaderPlayerId,
        address account
    ) private {
        vm.prank(account);
        combatantsHelper.assignCombatants(
            clanId, false, _uint64sEmpty(), true, playerIds, false, _uint64sEmpty(), leaderPlayerId
        );
    }

    function _upgradePlayer(uint256 id, address account) private {
        brush.mint(account, 1 ether);
        vm.startPrank(account);
        brush.approve(address(playerNFT), 1 ether);
        playerNFT.editPlayer(id, playerNFT.getName(id), "", "", "", true);
        vm.stopPrank();
    }

    function _createUpgradedPlayer(address account, string memory name) private returns (uint256 id) {
        id = _createPlayer(account, 1, name, true);
        _upgradePlayer(id, account);
    }

    function _createClanWithMembers(address leaderAccount, uint256 leaderPlayerId, string memory nameSuffix) private {
        vm.prank(leaderAccount);
        clans.createClan(leaderPlayerId, string.concat(ORIG_NAME, nameSuffix), "", "", "", 1, TIER_ID);
    }

    function _joinClan(
        address account,
        uint256 accountPlayerId,
        uint256 clanId,
        address leaderAccount,
        uint256 leaderPlayerId
    ) private {
        vm.prank(account);
        clans.requestToJoin(clanId, accountPlayerId, 0);
        vm.prank(leaderAccount);
        clans.acceptJoinRequests(clanId, _uints(accountPlayerId), leaderPlayerId);
    }

    function _maxOutBattleXP(address account, uint256 id) private {
        Skill[17] memory battleSkills = [
            Skill.MELEE,
            Skill.RANGED,
            Skill.MAGIC,
            Skill.DEFENCE,
            Skill.HEALTH,
            Skill.MINING,
            Skill.WOODCUTTING,
            Skill.FISHING,
            Skill.SMITHING,
            Skill.THIEVING,
            Skill.CRAFTING,
            Skill.COOKING,
            Skill.FIREMAKING,
            Skill.ALCHEMY,
            Skill.FLETCHING,
            Skill.FORGING,
            Skill.FARMING
        ];
        for (uint256 i; i < battleSkills.length; ++i) {
            players.modifyXP(account, id, battleSkills[i], _xpAtLevel(100), true);
        }
    }

    function _addLockedVaultItems() private {
        ItemInput[] memory items = new ItemInput[](2);
        items[0] = _lockedVaultItem(DEVILISH_FINGERS, BoostType.PVP_REATTACK, 1, 1 days);
        items[1] = _lockedVaultItem(PROTECTION_SHIELD, BoostType.PVP_BLOCK, 12, 2 days);
        itemNFT.addItems(items);
    }

    function _addItem(
        uint16 tokenId,
        EquipPosition equipPosition,
        BoostType boostType,
        uint16 boostValue,
        uint24 boostDuration
    ) private {
        ItemInput[] memory items = new ItemInput[](1);
        items[0] = _lockedVaultItem(tokenId, boostType, boostValue, boostDuration);
        items[0].equipPosition = equipPosition;
        itemNFT.addItems(items);
    }

    function _lockedVaultItem(uint16 tokenId, BoostType boostType, uint16 boostValue, uint24 boostDuration)
        private
        pure
        returns (ItemInput memory item)
    {
        item.tokenId = tokenId;
        item.equipPosition = EquipPosition.LOCKED_VAULT;
        item.isTransferable = true;
        item.isAvailable = true;
        item.boostType = boostType;
        item.boostValue = boostValue;
        item.boostDuration = boostDuration;
        item.metadataURI = "TEST.json";
        item.name = "TEST";
    }

    function _toU256(uint64[] memory ids) private pure returns (uint256[] memory values) {
        values = new uint256[](ids.length);
        for (uint256 i; i < ids.length; ++i) {
            values[i] = ids[i];
        }
    }

    function _toU256(uint16[] memory ids) private pure returns (uint256[] memory values) {
        values = new uint256[](ids.length);
        for (uint256 i; i < ids.length; ++i) {
            values[i] = ids[i];
        }
    }

    function _toU256(uint32[] memory ids) private pure returns (uint256[] memory values) {
        values = new uint256[](ids.length);
        for (uint256 i; i < ids.length; ++i) {
            values[i] = ids[i];
        }
    }

    function assertEqU16(uint16[] memory a, uint16[] memory b) private pure {
        assertEq(_toU256(a), _toU256(b));
    }

    function assertEqU32(uint32[] memory a, uint32[] memory b) private pure {
        assertEq(_toU256(a), _toU256(b));
    }

    function _uint64sEmpty() private pure returns (uint64[] memory ids) {
        ids = new uint64[](0);
    }

    function _uint64s(uint256 a) private pure returns (uint64[] memory ids) {
        ids = new uint64[](1);
        ids[0] = uint64(a);
    }

    function _uint64s(uint256 a, uint256 b) private pure returns (uint64[] memory ids) {
        ids = new uint64[](2);
        ids[0] = uint64(a);
        ids[1] = uint64(b);
    }

    function _uint64s(uint256 a, uint256 b, uint256 c) private pure returns (uint64[] memory ids) {
        ids = new uint64[](3);
        ids[0] = uint64(a);
        ids[1] = uint64(b);
        ids[2] = uint64(c);
    }

    function _uint64s(uint256 a, uint256 b, uint256 c, uint256 d) private pure returns (uint64[] memory ids) {
        ids = new uint64[](4);
        ids[0] = uint64(a);
        ids[1] = uint64(b);
        ids[2] = uint64(c);
        ids[3] = uint64(d);
    }

    function _uintsEmpty() private pure returns (uint256[] memory values) {
        values = new uint256[](0);
    }

    function _uints(uint256 a, uint256 b, uint256 c, uint256 d) private pure returns (uint256[] memory values) {
        values = new uint256[](4);
        values[0] = a;
        values[1] = b;
        values[2] = c;
        values[3] = d;
    }

    function _uints(uint256 a, uint256 b, uint256 c, uint256 d, uint256 e, uint256 f, uint256 g)
        private
        pure
        returns (uint256[] memory values)
    {
        values = new uint256[](7);
        values[0] = a;
        values[1] = b;
        values[2] = c;
        values[3] = d;
        values[4] = e;
        values[5] = f;
        values[6] = g;
    }

    function _uint16s(uint16 a, uint16 b, uint16 c, uint16 d, uint16 e, uint16 f)
        private
        pure
        returns (uint16[] memory values)
    {
        values = new uint16[](6);
        values[0] = a;
        values[1] = b;
        values[2] = c;
        values[3] = d;
        values[4] = e;
        values[5] = f;
    }

    function _uint16s(uint16 a, uint16 b, uint16 c, uint16 d, uint16 e, uint16 f, uint16 g)
        private
        pure
        returns (uint16[] memory values)
    {
        values = new uint16[](7);
        values[0] = a;
        values[1] = b;
        values[2] = c;
        values[3] = d;
        values[4] = e;
        values[5] = f;
        values[6] = g;
    }

    function _uint16sEmpty() private pure returns (uint16[] memory values) {
        values = new uint16[](0);
    }

    function _uint32s(uint256 a) private pure returns (uint32[] memory values) {
        values = new uint32[](1);
        values[0] = uint32(a);
    }

    function _uint32s(uint256 a, uint256 b) private pure returns (uint32[] memory values) {
        values = new uint32[](2);
        values[0] = uint32(a);
        values[1] = uint32(b);
    }

    function _uint32s(uint256 a, uint256 b, uint256 c, uint256 d) private pure returns (uint32[] memory values) {
        values = new uint32[](4);
        values[0] = uint32(a);
        values[1] = uint32(b);
        values[2] = uint32(c);
        values[3] = uint32(d);
    }

    function _uint32s(uint256 a, uint256 b, uint256 c, uint256 d, uint256 e, uint256 f)
        private
        pure
        returns (uint32[] memory values)
    {
        values = new uint32[](6);
        values[0] = uint32(a);
        values[1] = uint32(b);
        values[2] = uint32(c);
        values[3] = uint32(d);
        values[4] = uint32(e);
        values[5] = uint32(f);
    }

    function _uint32s(uint256 a, uint256 b, uint256 c, uint256 d, uint256 e, uint256 f, uint256 g)
        private
        pure
        returns (uint32[] memory values)
    {
        values = new uint32[](7);
        values[0] = uint32(a);
        values[1] = uint32(b);
        values[2] = uint32(c);
        values[3] = uint32(d);
        values[4] = uint32(e);
        values[5] = uint32(f);
        values[6] = uint32(g);
    }

    function _uint32sEmpty() private pure returns (uint32[] memory values) {
        values = new uint32[](0);
    }
}
