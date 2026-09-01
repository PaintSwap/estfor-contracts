// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {FullGameStack} from "../utils/FullGameStack.sol";
import {IPlayersBase as PlayersBase} from "../../contracts/interfaces/IPlayersBase.sol";
import {IPlayersImplMisc as PlayersImplMisc} from "../../contracts/interfaces/IPlayersImplMisc.sol";
import {RandomnessBeacon} from "../../contracts/RandomnessBeacon.sol";
import {Skill, CombatStyle, CombatStats, Equipment} from "../../contracts/globals/misc.sol";
import {
    ActionInput,
    ActionInfo,
    ActionQueueStrategy,
    QueuedActionInput,
    GUAR_MUL,
    SPAWN_MUL
} from "../../contracts/globals/actions.sol";
import {
    ActionChoiceInput,
    EquipPosition,
    ItemInput,
    PendingQueuedActionState,
    MAX_UNIQUE_TICKETS
} from "../../contracts/globals/players.sol";
import {
    GuaranteedReward,
    RandomReward,
    PendingRandomReward,
    XPThresholdReward
} from "../../contracts/globals/rewards.sol";
import {NONE, BRONZE_SWORD, BRONZE_AXE} from "../../contracts/globals/items.sol";

// Migrated from test/Players/Rewards.ts.
contract RewardsTest is FullGameStack {
    // Item and action ids mirror @paintswap/estfor-definitions/src/constants.ts.
    uint16 private constant BRONZE_HELMET = 1;
    uint16 private constant BRONZE_GAUNTLETS = 769;
    uint16 private constant BRONZE_TASSETS = 1025;
    uint16 private constant COMBAT_MAX = 2559;
    uint16 private constant WOODCUTTING_MAX = 3071;
    uint16 private constant BRONZE_BAR = 10_240;
    uint16 private constant LOG = 10_496;
    uint16 private constant ENCHANTED_LOG = 10_503;
    uint16 private constant COOKED_MINNUS = 11_008;
    uint16 private constant BRONZE_ARROW = 11_776;
    uint16 private constant POISON = 65_525;
    uint16 private constant ACTION_WOODCUTTING_LOG = 1;
    uint16 private constant ACTION_COMBAT = 10;
    uint16 private constant ACTION_THIEVING_CHILD = 2500;

    function setUp() public {
        deployFullGame();
        _warpToNextCheckpoint();
    }

    function testXPThresholdRewardSingle() public {
        QueuedActionInput memory action = _setupWoodcutting(100 * GUAR_MUL, 3600, LOG, 500);
        XPThresholdReward[] memory thresholds = _thresholds(499, BRONZE_BAR, 3);
        vm.expectRevert(PlayersBase.XPThresholdNotFound.selector);
        players.addXPThresholdRewards(thresholds);

        thresholds[0].xpThreshold = 500;
        players.addXPThresholdRewards(thresholds);
        _start(_actions(action));

        vm.warp(block.timestamp + 50);
        PendingQueuedActionState memory state = players.getPendingQueuedActionState(ALICE, playerId);
        assertEq(state.equipmentStates[0].producedItemTokenIds.length, 1);
        _process();
        assertEq(itemNFT.balanceOf(ALICE, BRONZE_BAR), 0);

        vm.warp(block.timestamp + 450);
        state = players.getPendingQueuedActionState(ALICE, playerId);
        _assertXPReward(state, 0, BRONZE_BAR, 3);
        _process();
        assertEq(itemNFT.balanceOf(ALICE, BRONZE_BAR), 3);
    }

    function testMultipleXPThresholdRewards() public {
        QueuedActionInput memory action = _setupWoodcutting(100 * GUAR_MUL, 3600, LOG, 1600);
        players.addXPThresholdRewards(_thresholds(500, BRONZE_BAR, 3));
        players.addXPThresholdRewards(_thresholds(1000, BRONZE_HELMET, 4));

        _start(_actions(action));
        vm.warp(block.timestamp + action.timespan);
        PendingQueuedActionState memory state = players.getPendingQueuedActionState(ALICE, playerId);
        assertEq(state.xpRewardItemTokenIds.length, 2);
        assertEq(state.xpRewardAmounts.length, 2);
        _assertXPReward(state, 0, BRONZE_BAR, 3);
        _assertXPReward(state, 1, BRONZE_HELMET, 4);

        _process();
        assertEq(itemNFT.balanceOf(ALICE, BRONZE_BAR), 3);
        assertEq(itemNFT.balanceOf(ALICE, BRONZE_HELMET), 4);
    }

    function testAddingSameXPThresholdRewardFails() public {
        XPThresholdReward[] memory thresholds = _thresholds(500, BRONZE_BAR, 3);
        players.addXPThresholdRewards(thresholds);
        vm.expectRevert(PlayersBase.XPThresholdAlreadyExists.selector);
        players.addXPThresholdRewards(thresholds);
    }

    function testEditingNonexistentXPThresholdRewardFails() public {
        vm.expectRevert(PlayersBase.XPThresholdDoesNotExist.selector);
        players.editXPThresholdRewards(_thresholds(500, BRONZE_BAR, 3));
    }

    function testEditingXPThresholdReward() public {
        players.addXPThresholdRewards(_thresholds(500, BRONZE_BAR, 3));
        players.editXPThresholdRewards(_thresholds(500, BRONZE_BAR, 10));
        QueuedActionInput memory action = _setupWoodcutting(100 * GUAR_MUL, 3600, LOG, 500);

        _start(_actions(action));
        vm.warp(block.timestamp + 50);
        _process();
        assertEq(itemNFT.balanceOf(ALICE, BRONZE_BAR), 0);

        vm.warp(block.timestamp + 450);
        PendingQueuedActionState memory state = players.getPendingQueuedActionState(ALICE, playerId);
        _assertXPReward(state, 0, BRONZE_BAR, 10);
        _process();
        assertEq(itemNFT.balanceOf(ALICE, BRONZE_BAR), 10);
    }

    function testModifyXPAwardsThresholdRewardsOnlyOnce() public {
        uint256 ticketBalance = itemNFT.balanceOf(ALICE, ACTIVITY_TICKET);
        if (ticketBalance != 0) {
            vm.prank(ALICE);
            itemNFT.burn(ALICE, ACTIVITY_TICKET, ticketBalance);
        }
        players.addXPThresholdRewards(_thresholds(500, BRONZE_BAR, 3));
        players.addXPThresholdRewards(_thresholds(1000, BRONZE_HELMET, 4));

        players.modifyXP(ALICE, playerId, Skill.MELEE, 2_070_952, false);
        assertEq(players.getPlayerXP(playerId, Skill.MELEE), 2_070_952);
        assertEq(itemNFT.balanceOf(ALICE, BRONZE_BAR), 3);
        assertEq(itemNFT.balanceOf(ALICE, BRONZE_HELMET), 4);

        players.modifyXP(ALICE, playerId, Skill.MELEE, 2_080_952, false);
        players.modifyXP(ALICE, playerId, Skill.DEFENCE, 2_070_952, false);
        assertEq(players.getPlayerXP(playerId, Skill.MELEE), 2_080_952);
        assertEq(players.getPlayerXP(playerId, Skill.DEFENCE), 2_070_952);
        assertEq(itemNFT.balanceOf(ALICE, BRONZE_BAR), 3);
        assertEq(itemNFT.balanceOf(ALICE, BRONZE_HELMET), 4);
    }

    function testMultipleActionsOnlyAwardOneSetOfXPThresholdRewards() public {
        QueuedActionInput memory action = _setupWoodcutting(100 * GUAR_MUL, 3600, LOG, 250);
        players.addXPThresholdRewards(_thresholds(500, BRONZE_BAR, 3));
        _start(_actions(action, action, action));

        vm.warp(block.timestamp + 50);
        _process();
        vm.warp(block.timestamp + 450);
        PendingQueuedActionState memory state = players.getPendingQueuedActionState(ALICE, playerId);
        assertEq(state.xpRewardItemTokenIds.length, 1);
        _assertXPReward(state, 0, BRONZE_BAR, 3);

        _process();
        assertEq(itemNFT.balanceOf(ALICE, BRONZE_BAR), 3);
    }

    function testNonCombatGuaranteedAndRandomRewards() public {
        QueuedActionInput memory action = _setupWoodcuttingWithRandomReward(3600);
        _requestAndFulfillSeeded(0);
        _requestAndFulfillSeeded(0);
        _start(_actions(action));

        vm.warp(block.timestamp + 1810);
        PendingQueuedActionState memory state = players.getPendingQueuedActionState(ALICE, playerId);
        assertEq(state.actionMetadatas[0].rolls, 0);
        assertEq(state.equipmentStates[0].producedItemTokenIds.length, 0);

        vm.warp(block.timestamp + 1790);
        state = players.getPendingQueuedActionState(ALICE, playerId);
        assertEq(state.actionMetadatas[0].rolls, 1);
        assertEq(state.equipmentStates[0].producedItemTokenIds[0], ENCHANTED_LOG);
        assertEq(state.equipmentStates[0].producedAmounts[0], 40);
        _process();
        _fulfillNextCheckpointSeeded(0);
        _fulfillNextCheckpointSeeded(0);
        state = players.getPendingQueuedActionState(ALICE, playerId);
        assertEq(state.producedPastRandomRewards.length, 1);
        assertEq(state.producedPastRandomRewards[0].itemTokenId, BRONZE_ARROW);
        _process();
        assertEq(itemNFT.balanceOf(ALICE, BRONZE_ARROW), 1);
        assertEq(itemNFT.balanceOf(ALICE, ENCHANTED_LOG), 40);
    }

    function testNonCombatGuaranteedAndRandomRewardsAfterPartialProcessing() public {
        QueuedActionInput memory action = _setupWoodcuttingWithRandomReward(4800);
        _requestAndFulfillSeeded(0);
        _requestAndFulfillSeeded(0);
        _start(_actions(action));
        vm.warp(block.timestamp + 1810);
        _process();

        vm.warp(block.timestamp + 1790);
        _process();
        _fulfillNextCheckpointSeeded(0);
        _fulfillNextCheckpointSeeded(0);
        PendingQueuedActionState memory state = players.getPendingQueuedActionState(ALICE, playerId);
        assertEq(state.producedPastRandomRewards[0].itemTokenId, BRONZE_ARROW);
        _process();
        assertEq(itemNFT.balanceOf(ALICE, BRONZE_ARROW), 1);
        assertEq(itemNFT.balanceOf(ALICE, ENCHANTED_LOG), 40);
    }

    function testNoRandomRewardsRemovesAllResolvedInstances() public {
        QueuedActionInput memory action = _setupThieving(4, BRONZE_ARROW, 0, 1);
        _requestAndFulfill();
        _requestAndFulfill();
        _start(_actions(action));

        vm.warp(block.timestamp + 1 hours);
        _assertRolls(1);
        _process();
        vm.warp(block.timestamp + 2 hours);
        _assertRolls(2);
        _process();
        vm.warp(block.timestamp + 1 hours + 2);
        _assertRolls(1);
        _process();

        vm.warp(block.timestamp + 1 days);
        _requestAndFulfill();
        PendingQueuedActionState memory state = players.getPendingQueuedActionState(ALICE, playerId);
        assertEq(state.producedPastRandomRewards.length, 0);
        assertEq(state.numPastRandomRewardInstancesToRemove, 3);
    }

    function testRandomRewardsAcrossManyActions() public {
        QueuedActionInput memory action = _setupThieving(5, BRONZE_ARROW, type(uint16).max / 2, 1);
        _requestAndFulfillSeeded(400_000_000);
        _requestAndFulfillSeeded(400_000_000);
        uint256 produced;

        for (uint256 i; i < 12; ++i) {
            _start(_actions(action));
            vm.warp(block.timestamp + action.timespan);
            _process();
            _fulfillNextCheckpointSeeded(400_000_000 + i);
            PendingQueuedActionState memory state = players.getPendingQueuedActionState(ALICE, playerId);
            if (state.producedPastRandomRewards.length != 0) {
                assertEq(state.producedPastRandomRewards.length, 1);
                assertEq(state.producedPastRandomRewards[0].itemTokenId, BRONZE_ARROW);
                produced += state.producedPastRandomRewards[0].amount;
                _process();
            }
        }

        assertGt(produced, 0);
        assertLt(produced, 60);
        assertEq(itemNFT.balanceOf(ALICE, BRONZE_ARROW), produced);
    }

    function testMultipleRandomRewardsAcrossManyActions() public {
        RandomReward[] memory rewards = new RandomReward[](4);
        rewards[0] = RandomReward(BRONZE_BAR, uint16(uint256(type(uint16).max) * 80 / 100), 1);
        rewards[1] = RandomReward(BRONZE_ARROW, uint16(type(uint16).max / 2), 1);
        rewards[2] = RandomReward(BRONZE_TASSETS, uint16(type(uint16).max / 2), 1);
        rewards[3] = RandomReward(BRONZE_GAUNTLETS, uint16(uint256(type(uint16).max) * 20 / 100), 1);
        QueuedActionInput memory action = _setupThieving(2, rewards);
        _requestAndFulfillSeeded(100_000_000);
        _requestAndFulfillSeeded(100_000_000);
        uint256[4] memory totals;

        for (uint256 i; i < 10; ++i) {
            _start(_actions(action, action));
            vm.warp(block.timestamp + 4 hours);
            _process();
            _fulfillNextCheckpointSeeded(100_000_000_000 + i);
            PendingQueuedActionState memory state = players.getPendingQueuedActionState(ALICE, playerId);
            for (uint256 j; j < state.producedPastRandomRewards.length; ++j) {
                uint16 tokenId = state.producedPastRandomRewards[j].itemTokenId;
                uint256 amount = state.producedPastRandomRewards[j].amount;
                if (tokenId == BRONZE_BAR) totals[0] += amount;
                else if (tokenId == BRONZE_ARROW) totals[1] += amount;
                else if (tokenId == BRONZE_TASSETS) totals[2] += amount;
                else if (tokenId == BRONZE_GAUNTLETS) totals[3] += amount;
                else fail("unexpected random reward");
            }
            if (state.producedPastRandomRewards.length != 0) _process();
        }

        for (uint256 i; i < totals.length; ++i) {
            assertGt(totals[i], 0);
        }
        assertEq(itemNFT.balanceOf(ALICE, BRONZE_BAR), totals[0]);
        assertEq(itemNFT.balanceOf(ALICE, BRONZE_ARROW), totals[1]);
        assertEq(itemNFT.balanceOf(ALICE, BRONZE_TASSETS), totals[2]);
        assertEq(itemNFT.balanceOf(ALICE, BRONZE_GAUNTLETS), totals[3]);
    }

    function testPendingRandomRewardsAreAddedEachTimeAnActionIsProcessed() public {
        QueuedActionInput memory action = _setupThieving(5, BRONZE_ARROW, type(uint16).max, 1);
        _requestAndFulfill();
        _start(_actions(action));

        vm.warp(block.timestamp + 1 hours + 1 minutes);
        _assertRolls(1);
        _process();
        PendingRandomReward[] memory pending = players.getPendingRandomRewards(playerId);
        assertEq(pending.length, 1);
        assertEq(pending[0].xpElapsedTime, 1 hours);

        vm.warp(block.timestamp + action.timespan);
        _assertRolls(4);
        _process();
        pending = players.getPendingRandomRewards(playerId);
        assertEq(pending.length, 2);
        assertEq(pending[1].xpElapsedTime, action.timespan - 1 hours);
    }

    function testPastRandomRewardsClaimedFollowingDayDoNotCorruptState() public {
        QueuedActionInput memory action = _setupThieving(3, LOG, 32_000, 255);
        _requestAndFulfill();
        _requestAndFulfill();
        uint256 checkpoint = randomnessBeacon.lastRandomWordsUpdatedTime() + 1 days;
        vm.warp(checkpoint - 3 hours - 10);
        _start(_actions(action));

        vm.warp(block.timestamp + 2 hours + 4);
        _process();
        assertEq(players.getPendingRandomRewards(playerId).length, 1);

        vm.warp(checkpoint + 1);
        _requestAndFulfillSeeded(777);
        _process();
        assertEq(players.getPlayerXP(playerId, Skill.THIEVING), 3 hours);
    }

    function testRandomBytesTicketLimits() public {
        uint256 timestamp = block.timestamp;
        vm.expectRevert();
        randomnessBeacon.getRandomBytes(16, timestamp, timestamp - 1 days, playerId);

        while (randomnessBeacon.lastRandomWordsUpdatedTime() < timestamp - 1 days) {
            _requestAndFulfill();
        }
        assertEq(randomnessBeacon.getRandomBytes(16, timestamp, timestamp - 1 days, playerId).length, 32);
        assertEq(
            randomnessBeacon.getRandomBytes(MAX_UNIQUE_TICKETS, timestamp, timestamp - 1 days, playerId).length, 128
        );
        vm.expectRevert();
        randomnessBeacon.getRandomBytes(MAX_UNIQUE_TICKETS + 1, timestamp, timestamp - 1 days, playerId);
    }

    function testMultipleRandomRewards() public {
        RandomReward[] memory rewards = new RandomReward[](2);
        rewards[0] = RandomReward(BRONZE_BAR, 65_534, 1);
        rewards[1] = RandomReward(BRONZE_ARROW, 6553, 1);
        QueuedActionInput memory action = _setupThieving(23, rewards);
        _requestAndFulfillSeeded(11_111_111_111_111_111_111_111);
        _requestAndFulfillSeeded(11_111_111_111_111_111_111_111);
        _start(_actions(action));

        vm.warp(block.timestamp + 1 days);
        _requestAndFulfillSeeded(10_000_000_000);
        PendingQueuedActionState memory state = players.getPendingQueuedActionState(ALICE, playerId);
        assertEq(state.producedPastRandomRewards.length, 2);
        assertEq(state.producedPastRandomRewards[0].itemTokenId, BRONZE_BAR);
        assertEq(state.producedPastRandomRewards[1].itemTokenId, BRONZE_ARROW);
    }

    function testMixedThievingCombatThievingProcessedBeforeOracle() public {
        (QueuedActionInput memory combat, QueuedActionInput memory thieving, uint24 numSpawned) =
            _setupMixedCombatAndThieving();
        _requestAndFulfill();
        _requestAndFulfill();
        thieving.timespan = 19 hours;
        combat.timespan = 1 hours;
        QueuedActionInput memory lastThieving = _queuedAction(ACTION_THIEVING_CHILD, 0, 3 hours, CombatStyle.NONE);
        _start(_actions(thieving, combat, lastThieving));

        vm.warp(block.timestamp + 1 days);
        PendingQueuedActionState memory state = players.getPendingQueuedActionState(ALICE, playerId);
        _assertMixedRolls(state, 19, numSpawned / SPAWN_MUL, 3);
        _process();
        _requestAndFulfill();

        state = players.getPendingQueuedActionState(ALICE, playerId);
        _assertPastReward(state, 0, BRONZE_ARROW, 19);
        _assertPastReward(state, 1, POISON, numSpawned / SPAWN_MUL);
        _assertPastReward(state, 2, BRONZE_ARROW, 3);
        _process();
        assertEq(itemNFT.balanceOf(ALICE, BRONZE_ARROW), 22);
        assertEq(itemNFT.balanceOf(ALICE, POISON), numSpawned / SPAWN_MUL);
    }

    function testMixedThievingCombatThievingOracleBeforeProcessingDelaysCombat() public {
        (QueuedActionInput memory combat, QueuedActionInput memory thieving, uint24 numSpawned) =
            _setupMixedCombatAndThieving();
        _requestAndFulfill();
        _requestAndFulfill();
        thieving.timespan = 19 hours;
        combat.timespan = 1 hours;
        QueuedActionInput memory lastThieving = _queuedAction(ACTION_THIEVING_CHILD, 0, 3 hours, CombatStyle.NONE);
        _start(_actions(thieving, combat, lastThieving));

        vm.warp(block.timestamp + 1 days);
        _requestAndFulfill();
        _process();
        PendingQueuedActionState memory state = players.getPendingQueuedActionState(ALICE, playerId);
        assertEq(state.producedPastRandomRewards.length, 0);

        _fulfillNextCheckpoint();
        state = players.getPendingQueuedActionState(ALICE, playerId);
        assertEq(state.producedPastRandomRewards.length, 1);
        _assertPastReward(state, 0, POISON, numSpawned / SPAWN_MUL);
        _process();
        assertEq(itemNFT.balanceOf(ALICE, BRONZE_ARROW), 22);
        assertEq(itemNFT.balanceOf(ALICE, POISON), numSpawned / SPAWN_MUL);
    }

    function testMixedThievingCombatThievingAfterOracle() public {
        (QueuedActionInput memory combat, QueuedActionInput memory thieving, uint24 numSpawned) =
            _setupMixedCombatAndThieving();
        _requestAndFulfill();
        _requestAndFulfill();
        thieving.timespan = 19 hours;
        combat.timespan = 1 hours;
        QueuedActionInput memory lastThieving = _queuedAction(ACTION_THIEVING_CHILD, 0, 3 hours, CombatStyle.NONE);
        _start(_actions(thieving, combat, lastThieving));

        vm.warp(block.timestamp + 1 days);
        _requestAndFulfill();
        PendingQueuedActionState memory state = players.getPendingQueuedActionState(ALICE, playerId);
        assertEq(state.producedPastRandomRewards.length, 2);
        _assertPastReward(state, 0, BRONZE_ARROW, 19);
        _assertPastReward(state, 1, BRONZE_ARROW, 3);
        _process();

        _fulfillNextCheckpoint();
        state = players.getPendingQueuedActionState(ALICE, playerId);
        _assertPastReward(state, 0, POISON, numSpawned / SPAWN_MUL);
        _process();
        assertEq(itemNFT.balanceOf(ALICE, BRONZE_ARROW), 22);
        assertEq(itemNFT.balanceOf(ALICE, POISON), numSpawned / SPAWN_MUL);
    }

    function testMixedRewardsCannotBeRequestedBeforeCheckpoint() public {
        (QueuedActionInput memory combat, QueuedActionInput memory thieving, uint24 numSpawned) =
            _setupMixedCombatAndThieving();
        _requestAndFulfill();
        _requestAndFulfill();
        thieving.timespan = 19 hours;
        combat.timespan = 1 hours;
        QueuedActionInput memory lastThieving = _queuedAction(ACTION_THIEVING_CHILD, 0, 3 hours, CombatStyle.NONE);
        _start(_actions(thieving, combat, lastThieving));

        vm.warp(block.timestamp + 23 hours + 1);
        PendingQueuedActionState memory state = players.getPendingQueuedActionState(ALICE, playerId);
        _assertMixedRolls(state, 19, numSpawned / SPAWN_MUL, 3);
        _process();
        vm.expectPartialRevert(RandomnessBeacon.CanOnlyRequestAfterTheNextCheckpoint.selector);
        randomnessBeacon.requestRandomWords();

        vm.warp(block.timestamp + 1 hours);
        _requestAndFulfill();
        state = players.getPendingQueuedActionState(ALICE, playerId);
        assertEq(state.producedPastRandomRewards.length, 3);
        _process();
        assertEq(itemNFT.balanceOf(ALICE, BRONZE_ARROW), 22);
        assertEq(itemNFT.balanceOf(ALICE, POISON), numSpawned / SPAWN_MUL);
    }

    function testMixedCombatCombatThievingRewardsPreserveQueueOrder() public {
        (QueuedActionInput memory combat, QueuedActionInput memory thieving, uint24 numSpawned) =
            _setupMixedCombatAndThieving();
        _requestAndFulfill();
        _requestAndFulfill();
        combat.timespan = 19 hours;
        QueuedActionInput memory secondCombat = _queuedAction(ACTION_COMBAT, 1, 1 hours, CombatStyle.ATTACK);
        secondCombat.attire.head = BRONZE_HELMET;
        secondCombat.rightHandEquipmentTokenId = BRONZE_SWORD;
        secondCombat.regenerateId = COOKED_MINNUS;
        thieving.timespan = 3 hours;
        _start(_actions(combat, secondCombat, thieving));

        vm.warp(block.timestamp + 1 days);
        PendingQueuedActionState memory state = players.getPendingQueuedActionState(ALICE, playerId);
        _assertMixedRolls(state, 19 * numSpawned / SPAWN_MUL, numSpawned / SPAWN_MUL, 3);
        _process();
        _requestAndFulfill();

        state = players.getPendingQueuedActionState(ALICE, playerId);
        _assertPastReward(state, 0, POISON, 19 * numSpawned / SPAWN_MUL);
        _assertPastReward(state, 1, POISON, numSpawned / SPAWN_MUL);
        _assertPastReward(state, 2, BRONZE_ARROW, 3);
        _process();
        assertEq(itemNFT.balanceOf(ALICE, POISON), 20 * numSpawned / SPAWN_MUL);
        assertEq(itemNFT.balanceOf(ALICE, BRONZE_ARROW), 3);
    }

    function testMixedCombatThievingProcessedBeforeOracle() public {
        (QueuedActionInput memory combat, QueuedActionInput memory thieving, uint24 numSpawned) =
            _setupMixedCombatAndThieving();
        _requestAndFulfill();
        _requestAndFulfill();
        combat.timespan = 19 hours;
        thieving.timespan = 3 hours;
        _start(_actions(combat, thieving));

        vm.warp(block.timestamp + 1 days);
        PendingQueuedActionState memory state = players.getPendingQueuedActionState(ALICE, playerId);
        assertEq(state.actionMetadatas.length, 2);
        assertEq(state.actionMetadatas[0].rolls, 19 * numSpawned / SPAWN_MUL);
        assertEq(state.actionMetadatas[1].rolls, 3);
        _process();
        _requestAndFulfill();

        state = players.getPendingQueuedActionState(ALICE, playerId);
        assertEq(state.producedPastRandomRewards.length, 2);
        _assertPastReward(state, 0, POISON, 19 * numSpawned / SPAWN_MUL);
        _assertPastReward(state, 1, BRONZE_ARROW, 3);
        _process();
        assertEq(itemNFT.balanceOf(ALICE, POISON), 19 * numSpawned / SPAWN_MUL);
        assertEq(itemNFT.balanceOf(ALICE, BRONZE_ARROW), 3);
    }

    function testMixedCombatAndThievingRewardsSurviveQueueOverwrite() public {
        (QueuedActionInput memory combat, QueuedActionInput memory thieving, uint24 numSpawned) =
            _setupMixedCombatAndThieving();
        _requestAndFulfill();
        _requestAndFulfill();
        combat.timespan = 1 hours;
        thieving.timespan = 23 hours;
        _start(_actions(combat, thieving));

        vm.warp(block.timestamp + 1 days);
        QueuedActionInput memory nextThieving = thieving;
        nextThieving.timespan = 1 days;
        _start(_actions(nextThieving));
        vm.warp(block.timestamp + 2 days);
        _requestAndFulfill();
        _requestAndFulfill();
        _requestAndFulfill();

        PendingQueuedActionState memory state = players.getPendingQueuedActionState(ALICE, playerId);
        assertEq(state.producedPastRandomRewards.length, 3);
        _assertPastReward(state, 0, POISON, numSpawned / SPAWN_MUL);
        _assertPastReward(state, 1, BRONZE_ARROW, 23);
        _assertPastReward(state, 2, BRONZE_ARROW, 24);
        _process();
        assertEq(itemNFT.balanceOf(ALICE, POISON), numSpawned / SPAWN_MUL);
        assertEq(itemNFT.balanceOf(ALICE, BRONZE_ARROW), 47);
    }

    function testTicketExcessUsesMintMultiplier() public {
        uint24 numSpawned = uint24(100 * SPAWN_MUL);
        QueuedActionInput memory action = _setupCombat(5, numSpawned, type(uint16).max);
        assertGt(5 * (numSpawned / SPAWN_MUL), MAX_UNIQUE_TICKETS);
        _requestAndFulfill();
        _requestAndFulfill();
        _start(_actions(action));

        _fulfillNextCheckpoint();
        _fulfillNextCheckpoint();
        _process();
        _fulfillNextCheckpoint();

        PendingQueuedActionState memory state = players.getPendingQueuedActionState(ALICE, playerId);
        assertEq(state.producedPastRandomRewards.length, 1);
        assertEq(state.producedPastRandomRewards[0].itemTokenId, BRONZE_ARROW);
        assertEq(state.producedPastRandomRewards[0].amount, 500);
        _process();
        assertEq(itemNFT.balanceOf(ALICE, BRONZE_ARROW), 500);
    }

    function testTicketExcessLowChanceHitsNone() public {
        uint24 numSpawned = uint24(60 * SPAWN_MUL);
        uint256 scaledChance = ((uint256(numSpawned) / SPAWN_MUL) * 23 * 2 * 1e9) / MAX_UNIQUE_TICKETS / 65_535;
        assertLt(scaledChance, 1e6);
        QueuedActionInput memory action = _setupCombat(23, numSpawned, 2);
        _requestAndFulfill();
        _requestAndFulfill();
        _start(_actions(action));

        vm.warp(block.timestamp + 1 days);
        _requestAndFulfill();
        PendingQueuedActionState memory state = players.getPendingQueuedActionState(ALICE, playerId);
        assertEq(state.producedPastRandomRewards.length, 0);
        _process();
        assertEq(itemNFT.balanceOf(ALICE, BRONZE_ARROW), 0);
    }

    function testTicketExcessRareRewardsUseChanceMultiplier() public {
        uint16 chance = 999;
        assertGt(PlayersImplMisc(playersImplMisc).getRandomRewardChanceMultiplierCutoff(), chance);
        uint24 numSpawned = uint24(150 * SPAWN_MUL);
        uint256 scaledChance =
            ((uint256(numSpawned) / SPAWN_MUL) * 23 * chance * 1e6) / MAX_UNIQUE_TICKETS / type(uint16).max;
        assertGt(scaledChance, 820_000);
        assertLt(scaledChance, 900_000);

        QueuedActionInput memory action = _setupCombat(23, numSpawned, chance);
        _requestAndFulfill();
        _requestAndFulfill();
        _start(_actions(action));
        _fulfillNextCheckpoint();
        _process();
        _fulfillNextCheckpoint();

        PendingQueuedActionState memory state = players.getPendingQueuedActionState(ALICE, playerId);
        assertEq(state.producedPastRandomRewards.length, 1);
        assertEq(state.producedPastRandomRewards[0].itemTokenId, BRONZE_ARROW);
        _process();
        uint256 balance = itemNFT.balanceOf(ALICE, BRONZE_ARROW);
        assertGe(balance, 43);
        assertLe(balance, 66);
    }

    function testTicketExcessRareRewardSeedHits() public {
        QueuedActionInput memory action = _setupCombat(23, uint24(100 * SPAWN_MUL), 50);
        _requestAndFulfill();
        _requestAndFulfill();
        _start(_actions(action));
        _fulfillNextCheckpoint();
        _process();
        _fulfillNextCheckpointSeeded(100_000_000_000_000);

        PendingQueuedActionState memory state = players.getPendingQueuedActionState(ALICE, playerId);
        assertEq(state.producedPastRandomRewards.length, 1);
        _process();
        assertGe(itemNFT.balanceOf(ALICE, BRONZE_ARROW), 1);
        assertLe(itemNFT.balanceOf(ALICE, BRONZE_ARROW), 4);
    }

    function testRewardsWithoutXP() public {
        QueuedActionInput memory action = _setupWoodcutting(3600 * GUAR_MUL, 0, LOG, 1 days);
        _start(_actions(action));
        vm.warp(block.timestamp + 1 hours);

        PendingQueuedActionState memory state = players.getPendingQueuedActionState(ALICE, playerId);
        assertEq(state.equipmentStates[0].producedItemTokenIds[0], LOG);
        assertEq(state.equipmentStates[0].producedAmounts[0], 3600);
        assertEq(players.getPlayerXP(playerId, Skill.WOODCUTTING), 0);
        _process();
        assertEq(players.getPlayerXP(playerId, Skill.WOODCUTTING), 0);
        assertEq(itemNFT.balanceOf(ALICE, LOG), 3600);
    }

    function _setupWoodcutting(uint256 rate, uint24 xpPerHour, uint16 rewardTokenId, uint24 timespan)
        private
        returns (QueuedActionInput memory action)
    {
        ActionInput memory input;
        input.actionId = ACTION_WOODCUTTING_LOG;
        input.info = _actionInfo(Skill.WOODCUTTING, xpPerHour, false, BRONZE_AXE, WOODCUTTING_MAX);
        input.guaranteedRewards = new GuaranteedReward[](1);
        input.guaranteedRewards[0] = GuaranteedReward(rewardTokenId, uint16(rate));
        _addAction(input);
        _addItem(_defaultItem(BRONZE_AXE, EquipPosition.RIGHT_HAND));
        action = _queuedAction(ACTION_WOODCUTTING_LOG, 0, timespan, CombatStyle.NONE);
        action.rightHandEquipmentTokenId = BRONZE_AXE;
    }

    function _setupWoodcuttingWithRandomReward(uint24 timespan) private returns (QueuedActionInput memory action) {
        ActionInput memory input;
        input.actionId = ACTION_WOODCUTTING_LOG;
        input.info = _actionInfo(Skill.WOODCUTTING, 3600, false, BRONZE_AXE, WOODCUTTING_MAX);
        input.guaranteedRewards = new GuaranteedReward[](1);
        input.guaranteedRewards[0] = GuaranteedReward(ENCHANTED_LOG, uint16(40 * GUAR_MUL));
        input.randomRewards = new RandomReward[](1);
        input.randomRewards[0] = RandomReward(BRONZE_ARROW, type(uint16).max, 1);
        _addAction(input);
        _addItem(_defaultItem(BRONZE_AXE, EquipPosition.RIGHT_HAND));
        action = _queuedAction(ACTION_WOODCUTTING_LOG, 0, timespan, CombatStyle.NONE);
        action.rightHandEquipmentTokenId = BRONZE_AXE;
    }

    function _setupThieving(uint256 hours_, uint16 rewardTokenId, uint16 chance, uint8 amount)
        private
        returns (QueuedActionInput memory action)
    {
        RandomReward[] memory rewards = new RandomReward[](1);
        rewards[0] = RandomReward(rewardTokenId, chance, amount);
        return _setupThieving(hours_, rewards);
    }

    function _setupThieving(uint256 hours_, RandomReward[] memory rewards)
        private
        returns (QueuedActionInput memory action)
    {
        ActionInput memory input;
        input.actionId = ACTION_THIEVING_CHILD;
        input.info = _actionInfo(Skill.THIEVING, 3600, false, NONE, NONE);
        input.randomRewards = rewards;
        _addAction(input);
        action = _queuedAction(ACTION_THIEVING_CHILD, 0, uint24(hours_ * 1 hours), CombatStyle.NONE);
    }

    function _setupCombat(uint256 hours_, uint24 numSpawned, uint16 chance)
        private
        returns (QueuedActionInput memory action)
    {
        ActionInput memory input;
        input.actionId = ACTION_COMBAT;
        input.info = _actionInfo(Skill.COMBAT, 3600, true, BRONZE_SWORD, COMBAT_MAX);
        input.info.numSpawned = numSpawned;
        input.randomRewards = new RandomReward[](1);
        input.randomRewards[0] = RandomReward(BRONZE_ARROW, chance, 1);
        input.combatStats = CombatStats(1, 0, 0, 1, 0, 0, 0);
        _addAction(input);

        ActionChoiceInput memory choice;
        choice.skill = uint8(Skill.MELEE);
        choice.successPercent = 100;
        choice.isAvailable = true;
        worldActions.addActionChoices(NONE, _uint16s(1), _choices(choice));

        ItemInput[] memory items = new ItemInput[](4);
        items[0] = _defaultItem(BRONZE_SWORD, EquipPosition.RIGHT_HAND);
        items[0].combatStats.meleeAttack = 50;
        items[1] = _defaultItem(BRONZE_HELMET, EquipPosition.HEAD);
        items[1].combatStats = CombatStats(1, 0, 0, 1, 4, 0, 1);
        items[2] = _defaultItem(BRONZE_ARROW, EquipPosition.QUIVER);
        items[3] = _defaultItem(COOKED_MINNUS, EquipPosition.FOOD);
        items[3].healthRestored = 12;
        itemNFT.addItems(items);
        itemNFT.mintBatch(ALICE, _uints(BRONZE_SWORD, BRONZE_HELMET, COOKED_MINNUS), _uints(1, 1, 255));

        action = _queuedAction(ACTION_COMBAT, 1, uint24(hours_ * 1 hours), CombatStyle.ATTACK);
        action.attire.head = BRONZE_HELMET;
        action.rightHandEquipmentTokenId = BRONZE_SWORD;
        action.regenerateId = COOKED_MINNUS;
    }

    function _setupMixedCombatAndThieving()
        private
        returns (QueuedActionInput memory combat, QueuedActionInput memory thieving, uint24 numSpawned)
    {
        numSpawned = uint24(10 * SPAWN_MUL);
        combat = _setupCombat(1, numSpawned, type(uint16).max);

        ActionInput memory combatInput;
        combatInput.actionId = ACTION_COMBAT;
        combatInput.info = _actionInfo(Skill.COMBAT, 3600, true, BRONZE_SWORD, COMBAT_MAX);
        combatInput.info.numSpawned = numSpawned;
        combatInput.randomRewards = new RandomReward[](1);
        combatInput.randomRewards[0] = RandomReward(POISON, type(uint16).max, 1);
        combatInput.combatStats = CombatStats(1, 0, 0, 1, 0, 0, 0);
        ActionInput[] memory edits = new ActionInput[](1);
        edits[0] = combatInput;
        worldActions.editActions(edits);
        _addItem(_defaultItem(POISON, EquipPosition.AUX));

        thieving = _setupThieving(1, BRONZE_ARROW, type(uint16).max, 1);
    }

    function _thresholds(uint32 threshold, uint16 tokenId, uint24 amount)
        private
        pure
        returns (XPThresholdReward[] memory values)
    {
        values = new XPThresholdReward[](1);
        Equipment[] memory rewards = new Equipment[](1);
        rewards[0] = Equipment(tokenId, amount);
        values[0] = XPThresholdReward(threshold, rewards);
    }

    function _actionInfo(
        Skill skill,
        uint24 xpPerHour,
        bool actionChoiceRequired,
        uint16 handItemTokenIdRangeMin,
        uint16 handItemTokenIdRangeMax
    ) private pure returns (ActionInfo memory info) {
        info = ActionInfo({
            skill: uint8(skill),
            actionChoiceRequired: actionChoiceRequired,
            xpPerHour: xpPerHour,
            minXP: 0,
            numSpawned: 0,
            handItemTokenIdRangeMin: handItemTokenIdRangeMin,
            handItemTokenIdRangeMax: handItemTokenIdRangeMax,
            successPercent: 100,
            worldLocation: 0,
            isFullModeOnly: false,
            isAvailable: true,
            questPrerequisiteId: 0
        });
    }

    function _defaultItem(uint16 tokenId, EquipPosition position) private pure returns (ItemInput memory item) {
        item.tokenId = tokenId;
        item.equipPosition = position;
        item.isTransferable = true;
        item.isAvailable = true;
        item.metadataURI = "TEST.json";
        item.name = "TEST";
    }

    function _queuedAction(uint16 actionId, uint16 choiceId, uint24 timespan, CombatStyle style)
        private
        pure
        returns (QueuedActionInput memory action)
    {
        action.actionId = actionId;
        action.choiceId = choiceId;
        action.timespan = timespan;
        action.combatStyle = uint8(style);
    }

    function _addAction(ActionInput memory input) private {
        ActionInput[] memory inputs = new ActionInput[](1);
        inputs[0] = input;
        worldActions.addActions(inputs);
    }

    function _addItem(ItemInput memory item) private {
        ItemInput[] memory items = new ItemInput[](1);
        items[0] = item;
        itemNFT.addItems(items);
    }

    function _start(QueuedActionInput[] memory actions) private {
        vm.prank(ALICE);
        players.startActions(playerId, actions, ActionQueueStrategy.OVERWRITE);
    }

    function _process() private {
        vm.prank(ALICE);
        players.processActions(playerId);
    }

    function _warpToNextCheckpoint() private {
        vm.warp(((block.timestamp / 1 days) + 1) * 1 days + 1);
    }

    function _requestAndFulfill() private {
        uint256 requestId = randomnessBeacon.requestRandomWords();
        mockVRF.fulfill(requestId, address(randomnessBeacon));
    }

    function _requestAndFulfillSeeded(uint256 seed) private {
        uint256 requestId = randomnessBeacon.requestRandomWords();
        mockVRF.fulfillSeeded(requestId, address(randomnessBeacon), seed);
    }

    function _fulfillNextCheckpoint() private {
        uint256 nextCheckpoint = randomnessBeacon.lastRandomWordsUpdatedTime() + 1 days;
        if (block.timestamp < nextCheckpoint) vm.warp(nextCheckpoint);
        _requestAndFulfill();
    }

    function _fulfillNextCheckpointSeeded(uint256 seed) private {
        uint256 nextCheckpoint = randomnessBeacon.lastRandomWordsUpdatedTime() + 1 days;
        if (block.timestamp < nextCheckpoint) vm.warp(nextCheckpoint);
        _requestAndFulfillSeeded(seed);
    }

    function _assertRolls(uint256 expected) private view {
        PendingQueuedActionState memory state = players.getPendingQueuedActionState(ALICE, playerId);
        assertEq(state.actionMetadatas[0].rolls, expected);
    }

    function _assertXPReward(PendingQueuedActionState memory state, uint256 index, uint16 tokenId, uint256 amount)
        private
        pure
    {
        assertEq(state.xpRewardItemTokenIds[index], tokenId);
        assertEq(state.xpRewardAmounts[index], amount);
    }

    function _assertMixedRolls(PendingQueuedActionState memory state, uint256 first, uint256 second, uint256 third)
        private
        pure
    {
        assertEq(state.actionMetadatas.length, 3);
        assertEq(state.actionMetadatas[0].rolls, first);
        assertEq(state.actionMetadatas[1].rolls, second);
        assertEq(state.actionMetadatas[2].rolls, third);
    }

    function _assertPastReward(PendingQueuedActionState memory state, uint256 index, uint16 tokenId, uint256 amount)
        private
        pure
    {
        assertEq(state.producedPastRandomRewards[index].itemTokenId, tokenId);
        assertEq(state.producedPastRandomRewards[index].amount, amount);
    }

    function _choices(ActionChoiceInput memory choice) private pure returns (ActionChoiceInput[] memory choices) {
        choices = new ActionChoiceInput[](1);
        choices[0] = choice;
    }

    function _actions(QueuedActionInput memory action) private pure returns (QueuedActionInput[] memory actions) {
        actions = new QueuedActionInput[](1);
        actions[0] = action;
    }

    function _actions(QueuedActionInput memory first, QueuedActionInput memory second)
        private
        pure
        returns (QueuedActionInput[] memory actions)
    {
        actions = new QueuedActionInput[](2);
        actions[0] = first;
        actions[1] = second;
    }

    function _actions(QueuedActionInput memory first, QueuedActionInput memory second, QueuedActionInput memory third)
        private
        pure
        returns (QueuedActionInput[] memory actions)
    {
        actions = new QueuedActionInput[](3);
        actions[0] = first;
        actions[1] = second;
        actions[2] = third;
    }
}
