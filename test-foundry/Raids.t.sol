// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Vm} from "forge-std/Vm.sol";
import {stdError} from "forge-std/StdError.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import {FullGameStack} from "./utils/FullGameStack.sol";
import {Raids} from "../contracts/Clans/Raids.sol";
import {Clans} from "../contracts/Clans/Clans.sol";
import {Skill, CombatStats} from "../contracts/globals/misc.sol";
import {ClanRank} from "../contracts/globals/clans.sol";
import {ActionInput, ActionInfo, ACTIONCHOICE_MELEE_BASIC_SWORD} from "../contracts/globals/actions.sol";
import {ActionChoiceInput, EquipPosition, ItemInput} from "../contracts/globals/players.sol";
import {RAID_PASS, COMBAT_BASE} from "../contracts/globals/items.sol";

contract RaidsTest is FullGameStack {
    uint256 private constant CLAN_ID = 1;
    uint16 private constant COOKED_MINNUS = 11_008;
    uint16 private constant COMBAT_MAX = 2_559;
    bytes32 private constant OUTCOME_TOPIC = keccak256(
        "RaidBattleOutcome(uint256,uint256,uint256,uint256,uint256,uint16[],uint256,bool,uint256[],uint256[])"
    );

    function setUp() public {
        deployFullGame();
        vm.deal(ALICE, 100 ether);

        Clans.Tier[] memory tiers = new Clans.Tier[](2);
        tiers[0] = Clans.Tier(1, 3, 3, 16, 0, 0);
        tiers[1] = Clans.Tier(2, 30, 3, 16, 0, 0);
        clans.addTiers(tiers);
        vm.prank(ALICE);
        clans.createClan(playerId, "Clan 1", "", "", "", 1, 1);

        brush.mint(ALICE, 1 ether);
        vm.startPrank(ALICE);
        brush.approve(address(playerNFT), 1 ether);
        playerNFT.editPlayer(playerId, ORIG_NAME, "", "", "", true);
        vm.stopPrank();

        ItemInput[] memory items = new ItemInput[](2);
        items[0].tokenId = RAID_PASS;
        items[0].equipPosition = EquipPosition.NONE;
        items[0].isAvailable = true;
        items[1].tokenId = COOKED_MINNUS;
        items[1].equipPosition = EquipPosition.FOOD;
        items[1].healthRestored = 12;
        items[1].isAvailable = true;
        itemNFT.addItems(items);
        _addCombatData();
    }

    function testCanSpawnARaid() public {
        vm.expectEmit(false, false, false, true, address(raids));
        emit Raids.RequestSpawnRaid(playerId, 1);
        vm.prank(ALICE);
        raids.requestSpawnRaid(uint64(playerId));
    }

    function testCannotSpawnRaidWhilePreviousRaidNotFinished() public {
        vm.prank(ALICE);
        raids.requestSpawnRaid(uint64(playerId));
        vm.expectRevert(Raids.PreviousRaidNotSpawnedYet.selector);
        vm.prank(ALICE);
        raids.requestSpawnRaid(uint64(playerId));

        _addBaseRaids(1, false, 1);
        mockVRF.fulfill(1, address(raids));
        vm.expectRevert(Raids.RaidInProgress.selector);
        vm.prank(ALICE);
        raids.requestSpawnRaid(uint64(playerId));
    }

    function testSpawnsRaidWithRandomStatsInValidRanges() public {
        _addBaseRaids(1, false, 1);
        _spawn();
        Raids.RaidInfo memory info = raids.getRaidInfo(1);
        assertGe(info.health, 100);
        assertLe(info.health, 200);
        assertGe(info.meleeAttack, 10);
        assertLe(info.meleeAttack, 20);
        assertGe(info.magicAttack, 15);
        assertLe(info.magicAttack, 25);
        assertGe(info.rangedAttack, 12);
        assertLe(info.rangedAttack, 22);
        assertGe(info.meleeDefence, 8);
        assertLe(info.meleeDefence, 18);
        assertGe(info.magicDefence, 5);
        assertLe(info.magicDefence, 15);
        assertGe(info.rangedDefence, 7);
        assertLe(info.rangedDefence, 17);
        assertEq(info.tier, 1);
    }

    function testSpawnsRaidWithSameMinMaxStatRanges() public {
        Raids.BaseRaid memory raid = _basicRaid();
        raid.maxHealth = raid.minHealth;
        raid.maxMeleeAttack = raid.minMeleeAttack;
        raid.minMagicAttack = 150;
        raid.maxMagicAttack = 150;
        raid.minRangedAttack = 32_767;
        raid.maxRangedAttack = 32_767;
        raid.maxMeleeDefence = raid.minMeleeDefence;
        raid.minMagicDefence = 0;
        raid.maxMagicDefence = 0;
        raid.minRangedDefence = -20;
        raid.maxRangedDefence = -20;
        raids.addBaseRaids(_uints(1), _baseRaids(raid));
        _spawn();
        Raids.RaidInfo memory info = raids.getRaidInfo(1);
        assertEq(info.health, 100);
        assertEq(info.meleeAttack, 10);
        assertEq(info.magicAttack, 150);
        assertEq(info.rangedAttack, 32_767);
        assertEq(info.meleeDefence, 8);
        assertEq(info.magicDefence, 0);
        assertEq(info.rangedDefence, -20);
        assertEq(info.tier, 1);
    }

    function testCanFightRaidWithClanCombatants() public {
        _addBaseRaids(1, false, 1);
        _assign();
        _mintBank(RAID_PASS, 1);
        _spawn();
        vm.expectEmit(false, false, false, true, address(raids));
        emit Raids.RequestFightRaid(playerId, uint56(CLAN_ID), 1, 2);
        uint256 attackCost = raids.getAttackCost();
        vm.prank(ALICE);
        raids.requestFightRaid{value: attackCost}(uint64(playerId), uint40(CLAN_ID), 1, 0);
        Outcome memory out = _fulfillOutcome(2, 0, false);
        assertGe(out.raidId, 1);
        assertLe(out.raidId, 3);
        assertEq(out.clanId, CLAN_ID);
        assertEq(out.requestId, 2);
        assertEq(out.regenerateAmountUsed, 0);
        assertEq(out.choiceIds[0], ACTIONCHOICE_MELEE_BASIC_SWORD);
        for (uint256 i = 1; i < out.choiceIds.length; ++i) {
            assertEq(out.choiceIds[i], 0);
        }
        assertEq(out.bossChoiceId, 0);
        assertFalse(out.defeatedRaid);
        assertEq(out.lootTokenIds.length, 0);
        assertEq(out.lootTokenAmounts.length, 0);
    }

    function testDefeatMonstersAndRaidBoss() public {
        _winningFightSetup(1);
        vm.expectEmit(false, false, false, true, address(raids));
        emit Raids.RequestFightRaid(playerId, uint56(CLAN_ID), 1, 2);
        _requestFight();
        Outcome memory out = _fulfillOutcome(2, 100_000, true);
        assertGe(out.raidId, 1);
        assertLe(out.raidId, 3);
        assertEq(out.clanId, CLAN_ID);
        assertEq(out.requestId, 2);
        assertEq(out.regenerateAmountUsed, 120);
        uint16[5] memory expectedChoices = [uint16(1500), uint16(2000), uint16(3000), uint16(2000), uint16(3000)];
        for (uint256 i; i < expectedChoices.length; ++i) {
            assertEq(out.choiceIds[i], expectedChoices[i]);
        }
        assertTrue(out.bossChoiceId != 1);
        assertTrue(out.defeatedRaid);
        assertGt(out.lootTokenIds.length, 0);
        assertGt(out.lootTokenAmounts.length, 0);
    }

    function testCheckRandomRewards() public {
        _winningFightSetup(1);
        _requestFight();
        Outcome memory out = _fulfillOutcome(2, 100_000, true);
        assertTrue(out.bossChoiceId != 1);
        assertTrue(out.defeatedRaid);
        assertGt(out.lootTokenIds.length, 0);
        assertGt(out.lootTokenAmounts.length, 0);
    }

    function testMustHaveRaidPassesToFight() public {
        _addBaseRaids(1, false, 1);
        _assign();
        _spawn();
        uint256 attackCost = raids.getAttackCost();
        vm.expectRevert(stdError.arithmeticError);
        vm.prank(ALICE);
        raids.requestFightRaid{value: attackCost}(uint64(playerId), uint40(CLAN_ID), 1, 0);
    }

    function testAwardsLootBasedOnTierAndNumberOfMonstersKilled() public {
        raids.addBaseRaids(_uints(1), _baseRaids(_tierTwoRaid()));
        _assign();
        Skill[5] memory skills = [Skill.MELEE, Skill.RANGED, Skill.MAGIC, Skill.HEALTH, Skill.DEFENCE];
        for (uint256 i; i < skills.length; ++i) {
            players.modifyXP(ALICE, playerId, skills[i], _xpAtLevel(100), true);
        }
        _mintBank(RAID_PASS, 1);
        _mintBank(COOKED_MINNUS, 100_000);
        _spawn();
        _requestFight();
        Outcome memory out = _fulfillOutcome(2, 0, false);
        assertTrue(out.defeatedRaid);
        assertGt(out.lootTokenIds.length, 0);
    }

    function testRemovesCombatantWhenLeavingClan() public {
        _assign();
        vm.expectEmit(false, false, false, true, address(raids));
        emit Raids.RemoveCombatant(playerId, CLAN_ID);
        vm.prank(ALICE);
        clans.changeRank(CLAN_ID, playerId, ClanRank.NONE, playerId);
    }

    function testOnlyCombatantsHelperCanAssignCombatants() public {
        vm.expectRevert(Raids.OnlyCombatantsHelper.selector);
        vm.prank(ALICE);
        raids.assignCombatants(CLAN_ID, _playerIds(playerId), 0, playerId);
    }

    function testEnforcesMaxClanCombatants() public {
        uint256 maxCombatants = 20; // Matches the value passed to Raids.initialize in FullGameStack
        uint256 startPlayerId = playerId + 1;
        uint256[] memory memberIds = new uint256[](maxCombatants + 1);
        uint64[] memory tooManyIds = new uint64[](maxCombatants + 1);
        for (uint256 i; i < tooManyIds.length; ++i) {
            memberIds[i] = startPlayerId + i;
            tooManyIds[i] = uint64(startPlayerId + i);
        }

        // Tier 2 (added in setUp) has enough capacity for all the invitees
        vm.prank(ALICE);
        clans.upgradeClan(CLAN_ID, playerId, 2);
        vm.prank(ALICE);
        clans.inviteMembers(CLAN_ID, memberIds, playerId);

        uint256 upgradeCost = 1 ether * tooManyIds.length;
        brush.mint(BOB, upgradeCost);
        vm.startPrank(BOB);
        brush.approve(address(playerNFT), upgradeCost);
        vm.stopPrank();
        for (uint256 i; i < tooManyIds.length; ++i) {
            uint256 nextPlayerId = startPlayerId + i;
            string memory playerName = string.concat("name", vm.toString(nextPlayerId));
            _createPlayer(BOB, 1, playerName, true);
            vm.startPrank(BOB);
            playerNFT.editPlayer(nextPlayerId, playerName, "", "", "", true);
            clans.acceptInvite(CLAN_ID, nextPlayerId, 0);
            vm.stopPrank();
        }

        vm.expectRevert(Raids.TooManyCombatants.selector);
        vm.prank(ALICE);
        combatantsHelper.assignCombatants(
            CLAN_ID, false, new uint64[](0), false, new uint64[](0), true, tooManyIds, playerId
        );
    }

    function testOnlyOwnerCanAddBaseRaids() public {
        vm.expectRevert(abi.encodeWithSelector(OwnableUpgradeable.OwnableUnauthorizedAccount.selector, ALICE));
        vm.prank(ALICE);
        raids.addBaseRaids(_uints(1), _baseRaids(_basicRaid()));
    }

    function testCannotAddRaidWithInvalidStatsRanges() public {
        Raids.BaseRaid memory raid = _basicRaid();
        raid.minHealth = 200;
        raid.maxHealth = 100;
        vm.expectRevert(Raids.NotInRange.selector);
        raids.addBaseRaids(_uints(1), _baseRaids(raid));
    }

    struct Outcome {
        uint256 clanId;
        uint256 raidId;
        uint256 requestId;
        uint256 regenerateId;
        uint256 regenerateAmountUsed;
        uint16[] choiceIds;
        uint256 bossChoiceId;
        bool defeatedRaid;
        uint256[] lootTokenIds;
        uint256[] lootTokenAmounts;
    }

    function _fulfillOutcome(uint256 requestId, uint256 seed, bool seeded) private returns (Outcome memory out) {
        vm.recordLogs();
        if (seeded) mockVRF.fulfillSeeded(requestId, address(raids), seed);
        else mockVRF.fulfill(requestId, address(raids));
        Vm.Log[] memory logs = vm.getRecordedLogs();
        for (uint256 i; i < logs.length; ++i) {
            if (logs[i].topics[0] == OUTCOME_TOPIC) {
                (
                    out.clanId,
                    out.raidId,
                    out.requestId,
                    out.regenerateId,
                    out.regenerateAmountUsed,
                    out.choiceIds,
                    out.bossChoiceId,
                    out.defeatedRaid,
                    out.lootTokenIds,
                    out.lootTokenAmounts
                ) =
                    abi.decode(
                        logs[i].data,
                        (uint256, uint256, uint256, uint256, uint256, uint16[], uint256, bool, uint256[], uint256[])
                    );
                return out;
            }
        }
        fail("RaidBattleOutcome not found");
    }

    function _spawn() private {
        vm.prank(ALICE);
        raids.requestSpawnRaid(uint64(playerId));
        mockVRF.fulfill(1, address(raids));
    }

    function _assign() private {
        vm.prank(ALICE);
        combatantsHelper.assignCombatants(
            CLAN_ID, false, new uint64[](0), false, new uint64[](0), true, _playerIds(playerId), playerId
        );
    }

    function _mintBank(uint256 id, uint256 amount) private {
        itemNFT.mint(bankFactory.getBankAddress(CLAN_ID), id, amount);
    }

    function _requestFight() private {
        uint256 attackCost = raids.getAttackCost();
        vm.prank(ALICE);
        raids.requestFightRaid{value: attackCost}(uint64(playerId), uint40(CLAN_ID), 1, COOKED_MINNUS);
    }

    function _winningFightSetup(uint8 tier) private {
        _addBaseRaids(3, true, tier);
        _assign();
        Skill[5] memory skills = [Skill.MELEE, Skill.RANGED, Skill.MAGIC, Skill.HEALTH, Skill.DEFENCE];
        for (uint256 i; i < skills.length; ++i) {
            players.modifyXP(ALICE, playerId, skills[i], _xpAtLevel(135), true);
        }
        _mintBank(RAID_PASS, 1);
        _mintBank(COOKED_MINNUS, 100_000);
        _spawn();
    }

    function _addBaseRaids(uint256 count, bool trash, uint8 tier) private {
        uint256[] memory ids = new uint256[](count);
        Raids.BaseRaid[] memory values = new Raids.BaseRaid[](count);
        for (uint256 i; i < count; ++i) {
            ids[i] = i + 1;
            values[i] = trash ? _trashRaid(tier) : _basicRaid();
        }
        raids.addBaseRaids(ids, values);
    }

    function _basicRaid() private pure returns (Raids.BaseRaid memory r) {
        r.tier = 1;
        r.minHealth = 100;
        r.maxHealth = 200;
        r.minMeleeAttack = 10;
        r.maxMeleeAttack = 20;
        r.minMagicAttack = 15;
        r.maxMagicAttack = 25;
        r.minRangedAttack = 12;
        r.maxRangedAttack = 22;
        r.minMeleeDefence = 8;
        r.maxMeleeDefence = 18;
        r.minMagicDefence = 5;
        r.maxMagicDefence = 15;
        r.minRangedDefence = 7;
        r.maxRangedDefence = 17;
        r.randomLootTokenIds[0] = 1;
        r.randomLootTokenIds[1] = 2;
        r.randomLootTokenAmounts[0] = 1;
        r.randomLootTokenAmounts[1] = 1;
        r.randomChances[0] = 5000;
        r.randomChances[1] = 10000;
    }

    function _tierTwoRaid() private pure returns (Raids.BaseRaid memory r) {
        r.tier = 2;
        r.minHealth = 10;
        r.maxHealth = 10;
        r.minMeleeAttack = 1;
        r.maxMeleeAttack = 1;
        r.minMagicAttack = 1;
        r.maxMagicAttack = 1;
        r.minRangedAttack = 1;
        r.maxRangedAttack = 1;
        r.minMeleeDefence = 1;
        r.maxMeleeDefence = 1;
        r.minMagicDefence = 1;
        r.maxMagicDefence = 1;
        r.minRangedDefence = 1;
        r.maxRangedDefence = 1;
    }

    function _trashRaid(uint8 tier) private pure returns (Raids.BaseRaid memory r) {
        r.tier = tier;
        r.minHealth = 1;
        r.maxHealth = 1;
        r.randomLootTokenIds[0] = 1;
        r.randomLootTokenIds[1] = 2;
        r.randomLootTokenAmounts[0] = 1;
        r.randomLootTokenAmounts[1] = 1;
        r.randomChances[0] = 5000;
        r.randomChances[1] = 10000;
    }

    function _baseRaids(Raids.BaseRaid memory raid) private pure returns (Raids.BaseRaid[] memory values) {
        values = new Raids.BaseRaid[](1);
        values[0] = raid;
    }

    function _playerIds(uint256 id) private pure returns (uint64[] memory ids) {
        ids = new uint64[](1);
        ids[0] = uint64(id);
    }

    function _addCombatData() private {
        ActionInput[] memory actions = new ActionInput[](5);
        uint16[] memory combatActionIds = new uint16[](5);
        for (uint256 i; i < actions.length; ++i) {
            combatActionIds[i] = uint16(2001 + i);
            actions[i].actionId = combatActionIds[i];
            actions[i].info = ActionInfo(
                uint8(Skill.COMBAT), true, 3600, 0, 100_000, COMBAT_BASE, COMBAT_MAX, 100, 0, false, true, 0
            );
        }
        actions[0].combatStats = CombatStats(3, 0, 0, 50, 3, 0, 0);
        actions[1].combatStats = CombatStats(0, 5, 0, 60, 0, 5, 0);
        actions[2].combatStats = CombatStats(3, 3, 3, 80, 4, 4, 3);
        actions[3].combatStats = CombatStats(5, 5, 0, 100, 5, 5, 0);
        actions[4].combatStats = CombatStats(0, 10, 0, 120, 4, 10, 0);
        worldActions.addActions(actions);
        raids.setCombatActions(combatActionIds);
        uint16[] memory actionIds = new uint16[](3);
        uint16[][] memory choiceIds = new uint16[][](3);
        ActionChoiceInput[][] memory choices = new ActionChoiceInput[][](3);
        uint16[3] memory ids = [uint16(1500), uint16(3000), uint16(2000)];
        Skill[3] memory skills = [Skill.MELEE, Skill.RANGED, Skill.MAGIC];
        for (uint256 i; i < 3; ++i) {
            choiceIds[i] = new uint16[](1);
            choiceIds[i][0] = ids[i];
            choices[i] = new ActionChoiceInput[](1);
            choices[i][0].skill = uint8(skills[i]);
            choices[i][0].rate = 1000;
            choices[i][0].xpPerHour = 3600;
            choices[i][0].successPercent = 100;
            choices[i][0].isAvailable = true;
        }
        worldActions.addBulkActionChoices(actionIds, choiceIds, choices);
    }
}
