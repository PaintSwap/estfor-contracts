// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Vm} from "forge-std/Vm.sol";

import {FullGameStack} from "../utils/FullGameStack.sol";
import {PlayersBase} from "../../contracts/Players/PlayersBase.sol";
import {Clans} from "../../contracts/Clans/Clans.sol";
import {WishingWell} from "../../contracts/WishingWell.sol";
import {IPlayersMisc1DelegateView} from "../../contracts/interfaces/IPlayersDelegates.sol";
import {Skill, CombatStyle, CombatStats, BoostType} from "../../contracts/globals/misc.sol";
import {ActionInput, ActionInfo, ActionQueueStrategy, QueuedActionInput, GUAR_MUL, RATE_MUL, SPAWN_MUL} from "../../contracts/globals/actions.sol";
import {
    ActionChoiceInput,
    BoostInfo,
    EquipPosition,
    ExtendedBoostInfo,
    ItemInput,
    PendingQueuedActionState,
    StandardBoostInfo
} from "../../contracts/globals/players.sol";
import {GuaranteedReward, RandomReward, PendingRandomReward} from "../../contracts/globals/rewards.sol";
import {
    NONE,
    XP_BOOST,
    GATHERING_BOOST,
    COMBAT_BOOST,
    LUCK_OF_THE_DRAW,
    PRAY_TO_THE_BEARDIE,
    PRAY_TO_THE_BEARDIE_2,
    PRAY_TO_THE_BEARDIE_3,
    CLAN_BOOSTER,
    CLAN_BOOSTER_2,
    CLAN_BOOSTER_3,
    BOOST_STABLILIZER_10,
    SHADOW_SCROLL,
    BRONZE_AXE,
    BRONZE_SWORD,
    NET_STICK,
    BRONZE_PICKAXE
} from "../../contracts/globals/items.sol";

// Migrated from test/Players/Boosts.ts
contract BoostsTest is FullGameStack {
    // Item token ids (mirror @paintswap/estfor-definitions/constants)
    uint16 internal constant BRONZE_HELMET = 1; // HEAD_BASE
    uint16 internal constant LOG = 10_496;
    uint16 internal constant RAW_MINNUS = 10_752;
    uint16 internal constant COOKED_MINNUS = 11_008;
    uint16 internal constant COPPER_ORE = 11_520;
    uint16 internal constant BRONZE_ARROW = 11_776;
    uint16 internal constant BOOK_001_BRONZE = 2_348; // BOOK_BASE
    uint16 internal constant NATURE_SCROLL = 12_033;
    uint16 internal constant ANCIENT_SCROLL = 12_039;
    uint16 internal constant POTION_005_SMALL_MELEE = 12_826;
    uint16 internal constant PLOT_001_SMALL = 14_656;
    uint16 internal constant SEED_001_WILD = 14_688;
    uint16 internal constant SEED_001_WILD_HARVESTABLE = 14_944;
    uint16 internal constant PAPER = 65_496;
    uint16 internal constant POISON = 65_525;

    // Hand item token id ranges
    uint16 internal constant COMBAT_MAX = 2_559;
    uint16 internal constant MINING_MAX = 2_815;
    uint16 internal constant WOODCUTTING_MAX = 3_071;
    uint16 internal constant FISHING_MAX = 3_327;

    // Action ids
    uint16 internal constant ACTION_WOODCUTTING_LOG = 1;
    uint16 internal constant ACTION_MINING_COPPER = 500;
    uint16 internal constant ACTION_FISHING_MINNUS = 1_500;

    uint256 internal constant NO_DONATION_AMOUNT = 0;
    // Start the boost now instead of at a future queued action
    uint8 internal constant BOOST_START_NOW = 2;
    // Storage slot of the _activeBoosts mapping (forge inspect Players storage)
    uint256 internal constant BOOSTS_STORAGE_SLOT = 17;
    uint256 internal constant TOTAL_BRUSH = 1_000_000 ether;

    function setUp() public {
        deployFullGame();
        brush.mint(ALICE, TOTAL_BRUSH);
        brush.mint(BOB, TOTAL_BRUSH);
        vm.startPrank(ALICE);
        brush.approve(address(wishingWell), TOTAL_BRUSH);
        vm.stopPrank();
        vm.startPrank(BOB);
        brush.approve(address(wishingWell), TOTAL_BRUSH);
        vm.stopPrank();
    }

    function testAddBoostFullConsume() public {
        _addBoostItem(XP_BOOST, EquipPosition.BOOST_VIAL, BoostType.NON_COMBAT_XP, 10, 3300);

        (QueuedActionInput memory queuedAction, uint256 rate) = _setupBasicWoodcutting();

        itemNFT.mint(ALICE, XP_BOOST, 1);
        assertEq(itemNFT.balanceOf(ALICE, XP_BOOST), 1);
        vm.prank(ALICE);
        players.startActionsAdvanced(
            playerId, _queuedActions(queuedAction), XP_BOOST, BOOST_START_NOW, 0, NO_DONATION_AMOUNT, ActionQueueStrategy.OVERWRITE
        );
        assertEq(itemNFT.balanceOf(ALICE, XP_BOOST), 0);

        vm.warp(vm.getBlockTimestamp() + queuedAction.timespan + 2);
        vm.prank(ALICE);
        players.processActions(playerId);
        assertEq(players.getPlayerXP(playerId, Skill.WOODCUTTING), queuedAction.timespan + (3300 * 10) / 100);
        // Check the drops are as expected
        assertEq(itemNFT.balanceOf(ALICE, LOG), (queuedAction.timespan * rate) / (3600 * GUAR_MUL));
    }

    function testAddBoostPartialConsume() public {
        _addBoostItem(XP_BOOST, EquipPosition.BOOST_VIAL, BoostType.NON_COMBAT_XP, 10, 7200);

        (QueuedActionInput memory queuedAction, uint256 rate) = _setupBasicWoodcutting();

        itemNFT.mint(ALICE, XP_BOOST, 1);
        assertEq(itemNFT.balanceOf(ALICE, XP_BOOST), 1);
        vm.prank(ALICE);
        players.startActionsAdvanced(
            playerId, _queuedActions(queuedAction), XP_BOOST, BOOST_START_NOW, 0, NO_DONATION_AMOUNT, ActionQueueStrategy.OVERWRITE
        );
        assertEq(itemNFT.balanceOf(ALICE, XP_BOOST), 0);

        vm.warp(vm.getBlockTimestamp() + queuedAction.timespan + 2);
        vm.prank(ALICE);
        players.processActions(playerId);
        assertEq(players.getPlayerXP(playerId, Skill.WOODCUTTING), queuedAction.timespan + (queuedAction.timespan * 10) / 100);
        // Check the drops are as expected
        assertEq(itemNFT.balanceOf(ALICE, LOG), (queuedAction.timespan * rate) / (3600 * GUAR_MUL));
    }

    function testBoostStabilizerSkipsConsumingEvery10thBoostWhileHeld() public {
        _addBoostItem(XP_BOOST, EquipPosition.BOOST_VIAL, BoostType.NON_COMBAT_XP, 10, 1);
        _addPlainItem(BOOST_STABLILIZER_10);

        (QueuedActionInput memory queuedAction,) = _setupBasicWoodcutting();
        queuedAction.timespan = 1;

        itemNFT.mint(ALICE, XP_BOOST, 11);
        itemNFT.mint(ALICE, BOOST_STABLILIZER_10, 1);

        for (uint256 i; i < 9; ++i) {
            vm.prank(ALICE);
            players.startActionsAdvanced(
                playerId,
                _queuedActions(queuedAction),
                XP_BOOST,
                BOOST_START_NOW,
                0,
                NO_DONATION_AMOUNT,
                ActionQueueStrategy.OVERWRITE
            );
            vm.warp(vm.getBlockTimestamp() + 2);
            vm.prank(ALICE);
            players.processActions(playerId);
        }

        assertEq(itemNFT.balanceOf(ALICE, XP_BOOST), 2);

        // 10th consume is skipped while the stabilizer is held
        vm.prank(ALICE);
        players.startActionsAdvanced(
            playerId, _queuedActions(queuedAction), XP_BOOST, BOOST_START_NOW, 0, NO_DONATION_AMOUNT, ActionQueueStrategy.OVERWRITE
        );
        assertEq(itemNFT.balanceOf(ALICE, XP_BOOST), 2);
        vm.warp(vm.getBlockTimestamp() + 2);
        vm.prank(ALICE);
        players.processActions(playerId);

        // 11th consume burns again
        vm.prank(ALICE);
        players.startActionsAdvanced(
            playerId, _queuedActions(queuedAction), XP_BOOST, BOOST_START_NOW, 0, NO_DONATION_AMOUNT, ActionQueueStrategy.OVERWRITE
        );
        assertEq(itemNFT.balanceOf(ALICE, XP_BOOST), 1);
        assertEq(itemNFT.balanceOf(ALICE, BOOST_STABLILIZER_10), 1);
    }

    function testBoostStabilizerUsesTheFullConsumeHistoryNotJustConsumesWhileHeld() public {
        _addBoostItem(XP_BOOST, EquipPosition.BOOST_VIAL, BoostType.NON_COMBAT_XP, 10, 1);
        _addPlainItem(BOOST_STABLILIZER_10);

        (QueuedActionInput memory queuedAction,) = _setupBasicWoodcutting();
        queuedAction.timespan = 1;

        itemNFT.mint(ALICE, XP_BOOST, 10);

        for (uint256 i; i < 9; ++i) {
            vm.prank(ALICE);
            players.startActionsAdvanced(
                playerId,
                _queuedActions(queuedAction),
                XP_BOOST,
                BOOST_START_NOW,
                0,
                NO_DONATION_AMOUNT,
                ActionQueueStrategy.OVERWRITE
            );
            vm.warp(vm.getBlockTimestamp() + 2);
            vm.prank(ALICE);
            players.processActions(playerId);
        }

        assertEq(itemNFT.balanceOf(ALICE, XP_BOOST), 1);

        // The stabilizer is acquired after 9 consumes, so the very next one (the 10th) is skipped
        itemNFT.mint(ALICE, BOOST_STABLILIZER_10, 1);
        vm.prank(ALICE);
        players.startActionsAdvanced(
            playerId, _queuedActions(queuedAction), XP_BOOST, BOOST_START_NOW, 0, NO_DONATION_AMOUNT, ActionQueueStrategy.OVERWRITE
        );

        assertEq(itemNFT.balanceOf(ALICE, XP_BOOST), 1);
        assertEq(itemNFT.balanceOf(ALICE, BOOST_STABLILIZER_10), 1);
    }

    function testExpiredBoostDoesNotAffectXP() public {
        // Expired boost should not affect XP
        _addBoostItem(XP_BOOST, EquipPosition.BOOST_VIAL, BoostType.NON_COMBAT_XP, 50, 86400);

        (QueuedActionInput memory queuedAction,) = _setupBasicWoodcutting();

        itemNFT.mint(ALICE, XP_BOOST, 1);
        vm.prank(ALICE);
        players.startActionsAdvanced(
            playerId, _queuedActions(queuedAction), XP_BOOST, BOOST_START_NOW, 0, NO_DONATION_AMOUNT, ActionQueueStrategy.OVERWRITE
        );
        vm.warp(vm.getBlockTimestamp() + 86400);
        vm.prank(ALICE);
        players.startActions(playerId, _queuedActions(queuedAction), ActionQueueStrategy.OVERWRITE);
        vm.warp(vm.getBlockTimestamp() + 86400); // boost has expired

        PendingQueuedActionState memory state = players.getPendingQueuedActionState(ALICE, playerId);
        assertEq(state.actionMetadatas[0].xpGained, queuedAction.timespan);

        vm.prank(ALICE);
        players.processActions(playerId);
        assertEq(
            players.getPlayerXP(playerId, Skill.WOODCUTTING),
            queuedAction.timespan + (queuedAction.timespan * 50) / 100 + queuedAction.timespan
        );
    }

    function testBoostEndFinishesInBetweenActionStartAndEnd() public {
        _addBoostItem(XP_BOOST, EquipPosition.BOOST_VIAL, BoostType.NON_COMBAT_XP, 50, 86400);

        (QueuedActionInput memory queuedAction,) = _setupBasicWoodcutting();
        QueuedActionInput memory queuedActionFinishAfterBoost = queuedAction;
        queuedActionFinishAfterBoost.timespan = 86400 - queuedAction.timespan;

        itemNFT.mint(ALICE, XP_BOOST, 1);
        vm.prank(ALICE);
        players.startActionsAdvanced(
            playerId, _queuedActions(queuedAction), XP_BOOST, BOOST_START_NOW, 0, NO_DONATION_AMOUNT, ActionQueueStrategy.OVERWRITE
        );
        vm.prank(ALICE);
        players.startActions(
            playerId, _queuedActions(queuedActionFinishAfterBoost), ActionQueueStrategy.OVERWRITE
        );
        vm.warp(vm.getBlockTimestamp() + queuedActionFinishAfterBoost.timespan);

        PendingQueuedActionState memory state = players.getPendingQueuedActionState(ALICE, playerId);
        assertEq(state.actionMetadatas[0].xpGained, 82800 + (82800 * 50) / 100);
    }

    function testBoostIsRemovedFromBeingActiveWhenProcessing() public {
        _addBoostItem(XP_BOOST, EquipPosition.BOOST_VIAL, BoostType.NON_COMBAT_XP, 50, 100);

        (QueuedActionInput memory queuedAction,) = _setupBasicWoodcutting();

        itemNFT.mint(ALICE, XP_BOOST, 1);
        vm.prank(ALICE);
        players.startActionsAdvanced(
            playerId, _queuedActions(queuedAction), XP_BOOST, BOOST_START_NOW, 0, NO_DONATION_AMOUNT, ActionQueueStrategy.OVERWRITE
        );
        vm.warp(vm.getBlockTimestamp() + 120);
        bytes32 slotHash = keccak256(abi.encode(playerId, BOOSTS_STORAGE_SLOT));
        bytes32 boostInfoStorage = vm.load(address(players), slotHash);
        assertTrue(boostInfoStorage != bytes32(0));

        vm.prank(ALICE);
        players.processActions(playerId);
        boostInfoStorage = vm.load(address(players), slotHash);
        assertEq(uint256(boostInfoStorage), 0);
    }

    function testCombatXPBoost() public {
        _addBoostItem(COMBAT_BOOST, EquipPosition.BOOST_VIAL, BoostType.COMBAT_XP, 50, 120);

        (QueuedActionInput memory queuedAction,) = _setupBasicMeleeCombat();

        itemNFT.mint(ALICE, COMBAT_BOOST, 1);
        vm.prank(ALICE);
        players.startActionsAdvanced(
            playerId, _queuedActions(queuedAction), COMBAT_BOOST, BOOST_START_NOW, 0, NO_DONATION_AMOUNT, ActionQueueStrategy.OVERWRITE
        );

        vm.warp(vm.getBlockTimestamp() + queuedAction.timespan);
        PendingQueuedActionState memory state = players.getPendingQueuedActionState(ALICE, playerId);
        uint256 meleeXP = queuedAction.timespan + (120 * 50) / 100;
        uint256 healthXP = meleeXP / 3;
        assertEq(state.equipmentStates.length, 1);
        assertEq(state.actionMetadatas.length, 1);
        assertEq(state.actionMetadatas[0].xpGained, meleeXP + healthXP);
        vm.prank(ALICE);
        players.processActions(playerId);
        assertEq(players.getPlayerXP(playerId, Skill.MELEE), meleeXP);
        assertEq(players.getPlayerXP(playerId, Skill.HEALTH), healthXP);
    }

    function testAnyXPBoostCombat() public {
        _addBoostItem(XP_BOOST, EquipPosition.BOOST_VIAL, BoostType.ANY_XP, 50, 120);

        (QueuedActionInput memory queuedAction,) = _setupBasicMeleeCombat();

        itemNFT.mint(ALICE, XP_BOOST, 1);
        vm.prank(ALICE);
        players.startActionsAdvanced(
            playerId, _queuedActions(queuedAction), XP_BOOST, BOOST_START_NOW, 0, NO_DONATION_AMOUNT, ActionQueueStrategy.OVERWRITE
        );
        vm.warp(vm.getBlockTimestamp() + queuedAction.timespan);
        PendingQueuedActionState memory state = players.getPendingQueuedActionState(ALICE, playerId);
        uint256 meleeXP = queuedAction.timespan + (120 * 50) / 100;
        uint256 healthXP = meleeXP / 3;
        assertEq(state.equipmentStates.length, 1);
        assertEq(state.actionMetadatas.length, 1);
        assertEq(state.actionMetadatas[0].xpGained, meleeXP + healthXP);
        vm.prank(ALICE);
        players.processActions(playerId);
        assertEq(players.getPlayerXP(playerId, Skill.MELEE), meleeXP);
        assertEq(players.getPlayerXP(playerId, Skill.HEALTH), healthXP);
    }

    function testAnyXPBoostNonCombat() public {
        _addBoostItem(XP_BOOST, EquipPosition.BOOST_VIAL, BoostType.ANY_XP, 50, 120);

        (QueuedActionInput memory queuedAction, uint256 rate) = _setupBasicWoodcutting();

        itemNFT.mint(ALICE, XP_BOOST, 1);
        vm.prank(ALICE);
        players.startActionsAdvanced(
            playerId, _queuedActions(queuedAction), XP_BOOST, BOOST_START_NOW, 0, NO_DONATION_AMOUNT, ActionQueueStrategy.OVERWRITE
        );
        vm.warp(vm.getBlockTimestamp() + queuedAction.timespan);
        PendingQueuedActionState memory state = players.getPendingQueuedActionState(ALICE, playerId);
        assertEq(state.actionMetadatas[0].xpGained, queuedAction.timespan + (120 * 50) / 100);
        vm.prank(ALICE);
        players.processActions(playerId);
        assertEq(players.getPlayerXP(playerId, Skill.WOODCUTTING), queuedAction.timespan + (120 * 50) / 100);
        // Check the drops are as expected
        assertEq(itemNFT.balanceOf(ALICE, LOG), (queuedAction.timespan * rate) / (3600 * GUAR_MUL));
    }

    function testExtraXPBoost() public {
        _addBoostItem(LUCK_OF_THE_DRAW, EquipPosition.EXTRA_BOOST_VIAL, BoostType.ANY_XP, 50, 120);

        (QueuedActionInput memory queuedAction,) = _setupBasicMeleeCombat();

        vm.prank(ALICE);
        players.startActionsAdvanced(
            playerId, _queuedActions(queuedAction), NONE, 0, 0, NO_DONATION_AMOUNT, ActionQueueStrategy.OVERWRITE
        );

        // Currently only minted through donation thresholds
        uint256 raffleCost = wishingWell.getRaffleEntryCost();
        assertGt(raffleCost, 0);

        vm.recordLogs();
        vm.prank(ALICE);
        players.donate(playerId, raffleCost);
        assertEq(_countLogs(address(wishingWell), WishingWell.LastGlobalDonationThreshold.selector), 0);

        vm.warp(vm.getBlockTimestamp() + queuedAction.timespan);
        PendingQueuedActionState memory state = players.getPendingQueuedActionState(ALICE, playerId);
        uint256 meleeXP = queuedAction.timespan + (120 * 50) / 100;
        uint256 healthXP = meleeXP / 3;
        assertEq(state.equipmentStates.length, 1);
        assertEq(state.actionMetadatas.length, 1);
        assertEq(state.actionMetadatas[0].xpGained, meleeXP + healthXP);
        vm.prank(ALICE);
        players.processActions(playerId);
        assertEq(players.getPlayerXP(playerId, Skill.MELEE), meleeXP);
        assertEq(players.getPlayerXP(playerId, Skill.HEALTH), healthXP);
    }

    function testGlobalXPBoost() public {
        _addBoostItem(PRAY_TO_THE_BEARDIE, EquipPosition.GLOBAL_BOOST_VIAL, BoostType.ANY_XP, 50, 120);

        (QueuedActionInput memory queuedAction,) = _setupBasicMeleeCombat();

        vm.prank(ALICE);
        players.startActionsAdvanced(
            playerId, _queuedActions(queuedAction), NONE, 0, 0, NO_DONATION_AMOUNT, ActionQueueStrategy.OVERWRITE
        );

        // Currently only minted through donation thresholds
        uint256 nextGlobalThreshold = wishingWell.getNextGlobalThreshold();
        assertGt(nextGlobalThreshold, 0);

        vm.prank(ALICE);
        players.donate(0, nextGlobalThreshold - 1 ether);
        vm.expectEmit(address(wishingWell));
        emit WishingWell.LastGlobalDonationThreshold(1000 ether, PRAY_TO_THE_BEARDIE_2);
        vm.expectEmit(address(players));
        emit PlayersBase.ConsumeGlobalBoostVial(
            ALICE, playerId, BoostInfo(uint40(vm.getBlockTimestamp()), 120, 50, PRAY_TO_THE_BEARDIE, BoostType.ANY_XP)
        );
        vm.prank(ALICE);
        players.donate(playerId, 2 ether);

        vm.warp(vm.getBlockTimestamp() + queuedAction.timespan);
        PendingQueuedActionState memory state = players.getPendingQueuedActionState(ALICE, playerId);
        uint256 meleeXP = queuedAction.timespan + (120 * 50) / 100;
        uint256 healthXP = meleeXP / 3;
        assertEq(state.equipmentStates.length, 1);
        assertEq(state.actionMetadatas.length, 1);
        assertEq(state.actionMetadatas[0].xpGained, meleeXP + healthXP);
        vm.prank(ALICE);
        players.processActions(playerId);
        assertEq(players.getPlayerXP(playerId, Skill.MELEE), meleeXP);
        assertEq(players.getPlayerXP(playerId, Skill.HEALTH), healthXP);
    }

    function testClanXPBoost() public {
        _addBoostItem(CLAN_BOOSTER, EquipPosition.CLAN_BOOST_VIAL, BoostType.ANY_XP, 50, 120);
        _addBoostItem(LUCK_OF_THE_DRAW, EquipPosition.EXTRA_BOOST_VIAL, BoostType.ANY_XP, 0, 120);

        (QueuedActionInput memory queuedAction,) = _setupBasicMeleeCombat();

        // Be a member of a clan
        _createClan();

        vm.prank(ALICE);
        players.startActionsAdvanced(
            playerId, _queuedActions(queuedAction), NONE, 0, 0, NO_DONATION_AMOUNT, ActionQueueStrategy.OVERWRITE
        );

        // Currently only minted through donation thresholds
        uint256 clanId = 1;
        WishingWell.ClanInfo memory clanDonationInfo = wishingWell.getClanDonationInfo(clanId);
        assertEq(clanDonationInfo.totalDonated, 0);
        assertEq(clanDonationInfo.lastThreshold, 0);

        uint256 raffleCost = wishingWell.getRaffleEntryCost();
        assertGt(raffleCost, 0);

        wishingWell.setClanDonationThresholdIncrement(raffleCost * 2);

        vm.recordLogs();
        vm.prank(ALICE);
        players.donate(playerId, raffleCost);
        assertEq(_countLogs(address(wishingWell), WishingWell.LastClanDonationThreshold.selector), 0);

        uint256 bobPlayerId = _createPlayer(BOB, 1, "bob", true);
        vm.prank(ALICE);
        clans.inviteMembers(clanId, _uint256s(bobPlayerId), playerId);
        vm.prank(BOB);
        clans.acceptInvite(clanId, bobPlayerId, 0);

        vm.expectEmit(address(wishingWell));
        emit WishingWell.LastClanDonationThreshold(clanId, raffleCost * 2, CLAN_BOOSTER_2);
        vm.expectEmit(address(players));
        emit PlayersBase.ConsumeClanBoostVial(
            BOB, bobPlayerId, clanId, BoostInfo(uint40(vm.getBlockTimestamp()), 120, 50, CLAN_BOOSTER, BoostType.ANY_XP)
        );
        vm.prank(BOB);
        players.donate(bobPlayerId, raffleCost);

        vm.warp(vm.getBlockTimestamp() + queuedAction.timespan);
        PendingQueuedActionState memory state = players.getPendingQueuedActionState(ALICE, playerId);
        uint256 meleeXP = queuedAction.timespan + (120 * 50) / 100;
        uint256 healthXP = meleeXP / 3;
        assertEq(state.equipmentStates.length, 1);
        assertEq(state.actionMetadatas.length, 1);
        assertEq(state.actionMetadatas[0].xpGained, meleeXP + healthXP);
        vm.prank(ALICE);
        players.processActions(playerId);
        assertEq(players.getPlayerXP(playerId, Skill.MELEE), meleeXP);
        assertEq(players.getPlayerXP(playerId, Skill.HEALTH), healthXP);
    }

    function testNormalExtraClanAndGlobalXPBoosts() public {
        uint24 boostDuration = 120;
        _addBoostItem(PRAY_TO_THE_BEARDIE, EquipPosition.GLOBAL_BOOST_VIAL, BoostType.ANY_XP, 20, boostDuration);
        _addBoostItem(LUCK_OF_THE_DRAW, EquipPosition.EXTRA_BOOST_VIAL, BoostType.ANY_XP, 15, boostDuration);
        _addBoostItem(XP_BOOST, EquipPosition.BOOST_VIAL, BoostType.ANY_XP, 10, boostDuration);
        _addBoostItem(CLAN_BOOSTER, EquipPosition.CLAN_BOOST_VIAL, BoostType.ANY_XP, 5, boostDuration);

        // Be a member of a clan
        _createClan();

        (QueuedActionInput memory queuedAction,) = _setupBasicMeleeCombat();
        itemNFT.mint(ALICE, XP_BOOST, 1);
        vm.prank(ALICE);
        players.startActionsAdvanced(
            playerId, _queuedActions(queuedAction), XP_BOOST, BOOST_START_NOW, 0, NO_DONATION_AMOUNT, ActionQueueStrategy.OVERWRITE
        );

        // Currently only minted through donation thresholds
        uint256 clanId = 1;
        uint256 nextGlobalThreshold = wishingWell.getNextGlobalThreshold();
        uint256 nextClanThreshold = wishingWell.getNextClanThreshold(clanId);

        uint256 maxThreshold = nextClanThreshold > nextGlobalThreshold ? nextClanThreshold : nextGlobalThreshold;

        uint256 raffleCost = wishingWell.getRaffleEntryCost();
        assertGt(raffleCost, 0);

        wishingWell.setClanDonationThresholdIncrement(raffleCost);

        vm.prank(ALICE);
        players.donate(0, maxThreshold - 1 ether);
        vm.expectEmit(address(wishingWell));
        emit WishingWell.LastClanDonationThreshold(clanId, raffleCost, CLAN_BOOSTER_2);
        vm.expectEmit(address(wishingWell));
        emit WishingWell.LastGlobalDonationThreshold(1000 ether, PRAY_TO_THE_BEARDIE_2);
        vm.prank(ALICE);
        players.donate(playerId, raffleCost);

        vm.warp(vm.getBlockTimestamp() + queuedAction.timespan);
        PendingQueuedActionState memory state = players.getPendingQueuedActionState(ALICE, playerId);
        uint256 meleeXP = queuedAction.timespan + (uint256(boostDuration) * 50) / 100;
        uint256 healthXP = meleeXP / 3;
        assertEq(state.equipmentStates.length, 1);
        assertEq(state.actionMetadatas.length, 1);
        assertEq(state.actionMetadatas[0].xpGained, meleeXP + healthXP);
        vm.prank(ALICE);
        players.processActions(playerId);
        assertEq(players.getPlayerXP(playerId, Skill.MELEE), meleeXP);
        assertEq(players.getPlayerXP(playerId, Skill.HEALTH), healthXP);
    }

    function testExtraXPWishingWellBoostOverrideLongFarmingActions() public {
        // 12 hours to check overlaps
        _addBoostItem(LUCK_OF_THE_DRAW, EquipPosition.EXTRA_BOOST_VIAL, BoostType.ANY_XP, 50, 3600 * 12);

        // 8 hour queues
        (QueuedActionInput memory queuedAction,) = _setupBasicFarming(125, 13);
        queuedAction.timespan = 3600 * 24; // 24 hours

        uint256 startingAmount = 10_000;
        itemNFT.mintBatch(ALICE, _uint256s(PLOT_001_SMALL, SEED_001_WILD), _uint256s(startingAmount, startingAmount));

        _fulfillNextRandomWords();

        // Start just past midnight UTC
        vm.warp(((vm.getBlockTimestamp() / 1 days) + 1) * 1 days + 1);
        _fulfillNextRandomWords();
        vm.warp(vm.getBlockTimestamp() + 3600 * 15); // 15 hours into the day, leaves 9 hours left

        uint256 raffleCost = wishingWell.getRaffleEntryCost();

        vm.prank(ALICE);
        players.startActionsAdvanced(
            playerId, _queuedActions(queuedAction), NONE, 0, 0, raffleCost, ActionQueueStrategy.OVERWRITE
        );
        uint256 donationTimestamp = vm.getBlockTimestamp();

        wishingWell.setNextLotteryWinnerRewardItemTokenId(NONE);

        vm.warp(vm.getBlockTimestamp() + 3600 * 10); // 01:00am UTC
        _fulfillNextRandomWords();
        uint256 extraBoostedTime = vm.getBlockTimestamp() - donationTimestamp;

        // Enter raffle again, the previous boost is moved to last with the time used up so far
        vm.expectEmit(address(players));
        emit PlayersBase.UpdateLastExtraBoost(
            playerId, BoostInfo(uint40(donationTimestamp), uint24(extraBoostedTime), 50, LUCK_OF_THE_DRAW, BoostType.ANY_XP)
        );
        vm.prank(ALICE);
        players.donate(playerId, raffleCost);

        ExtendedBoostInfo memory playerBoost = players.getActiveBoost(playerId);
        assertEq(playerBoost.lastExtraStartTime, donationTimestamp);
        assertEq(playerBoost.lastExtraDuration, extraBoostedTime);
        assertEq(playerBoost.lastExtraValue, 50);
        assertEq(playerBoost.lastExtraItemTokenId, LUCK_OF_THE_DRAW);
        assertEq(uint8(playerBoost.lastExtraBoostType), uint8(BoostType.ANY_XP));

        vm.warp(vm.getBlockTimestamp() + 3600 * 14); // 14 hours, so all farming actions done. But 2 hours won't have a boost

        // 24 hours base XP
        uint256 baseXP = queuedAction.timespan; // 24 hours * 3600 = 86400

        // First boost active for 10 hours
        uint256 firstBoostTime = 10 * 3600;
        uint256 firstBoostXP = (firstBoostTime * 50) / 100;

        // Second boost active for 12 hours
        uint256 secondBoostTime = 12 * 3600;
        uint256 secondBoostXP = (secondBoostTime * 50) / 100;

        uint256 farmingXP = baseXP + firstBoostXP + secondBoostXP;

        PendingQueuedActionState memory state = players.getPendingQueuedActionState(ALICE, playerId);
        assertEq(state.equipmentStates.length, 1);
        assertEq(state.actionMetadatas.length, 1);
        assertEq(state.actionMetadatas[0].xpGained, farmingXP);

        vm.warp(vm.getBlockTimestamp() + 24 hours);

        // Clear it, both should be cleared
        vm.prank(ALICE);
        players.processActions(playerId);

        playerBoost = players.getActiveBoost(playerId);
        assertEq(playerBoost.extraStartTime, 0);
        assertEq(playerBoost.extraDuration, 0);
        assertEq(playerBoost.extraValue, 0);
        assertEq(playerBoost.extraItemTokenId, 0);
        assertEq(uint8(playerBoost.extraBoostType), uint8(BoostType.NONE));
        assertEq(playerBoost.lastExtraStartTime, 0);
        assertEq(playerBoost.lastExtraDuration, 0);
        assertEq(playerBoost.lastExtraValue, 0);
        assertEq(playerBoost.lastExtraItemTokenId, 0);
        assertEq(uint8(playerBoost.lastExtraBoostType), uint8(BoostType.NONE));
    }

    // If a clan boost is active, and another one comes it should still count for actions queued up to this time.
    function testClanBoostOverride() public {
        uint24 boostDuration = 720; // 2 kills worth
        _addBoostItem(CLAN_BOOSTER, EquipPosition.CLAN_BOOST_VIAL, BoostType.ANY_XP, 50, boostDuration);
        _addBoostItem(CLAN_BOOSTER_2, EquipPosition.CLAN_BOOST_VIAL, BoostType.COMBAT_XP, 50, boostDuration);
        _addBoostItem(CLAN_BOOSTER_3, EquipPosition.CLAN_BOOST_VIAL, BoostType.NON_COMBAT_XP, 50, boostDuration);
        _addBoostItem(LUCK_OF_THE_DRAW, EquipPosition.EXTRA_BOOST_VIAL, BoostType.ANY_XP, 0, 0);

        // Be a member of a clan
        _createClan();

        (QueuedActionInput memory queuedAction,) = _setupBasicMeleeCombat();

        uint256 clanId = 1;
        uint256 raffleCost = wishingWell.getRaffleEntryCost();
        wishingWell.setClanDonationThresholdIncrement(raffleCost);

        vm.expectEmit(address(wishingWell));
        emit WishingWell.LastClanDonationThreshold(clanId, raffleCost, CLAN_BOOSTER_2);
        vm.expectEmit(address(players));
        emit PlayersBase.ConsumeClanBoostVial(
            ALICE, playerId, clanId, BoostInfo(uint40(vm.getBlockTimestamp()), boostDuration, 50, CLAN_BOOSTER, BoostType.ANY_XP)
        );
        vm.prank(ALICE);
        players.startActionsAdvanced(
            playerId, _queuedActions(queuedAction), NONE, 0, 0, raffleCost, ActionQueueStrategy.OVERWRITE
        );
        uint256 nowTimestamp = vm.getBlockTimestamp();

        vm.warp(nowTimestamp + boostDuration / 2 + 1);
        PendingQueuedActionState memory state = players.getPendingQueuedActionState(ALICE, playerId);
        // Combat XP only accrues per monster killed, respawn time is 360 seconds (10 spawned per hour)
        uint256 xpElapsedTime = 360;
        uint256 meleeXP = xpElapsedTime + (xpElapsedTime * 50) / 100;
        uint256 healthXP = meleeXP / 3;
        assertEq(state.equipmentStates.length, 1);
        assertEq(state.actionMetadatas.length, 1);
        assertEq(state.actionMetadatas[0].xpGained, meleeXP + healthXP);

        // Change to the next booster. This is combat XP, so it should give the same overall boost
        // Add bob
        uint256 bobPlayerId = _createPlayer(BOB, 1, "bob", true);
        vm.prank(ALICE);
        clans.inviteMembers(clanId, _uint256s(bobPlayerId), playerId);
        vm.prank(BOB);
        clans.acceptInvite(clanId, bobPlayerId, 0);

        vm.expectEmit(address(wishingWell));
        emit WishingWell.LastClanDonationThreshold(clanId, raffleCost * 2, CLAN_BOOSTER_3);
        vm.expectEmit(address(players));
        emit PlayersBase.ConsumeClanBoostVial(
            BOB, bobPlayerId, clanId, BoostInfo(uint40(vm.getBlockTimestamp()), boostDuration, 50, CLAN_BOOSTER_2, BoostType.COMBAT_XP)
        );
        vm.prank(BOB);
        players.donate(bobPlayerId, raffleCost);

        uint256 now1 = vm.getBlockTimestamp();
        uint256 extraBoostedTime = now1 - nowTimestamp - boostDuration / 2;

        vm.warp(nowTimestamp + boostDuration + extraBoostedTime);

        StandardBoostInfo memory clanBoost = _clanBoost(clanId);
        assertEq(clanBoost.startTime, now1);
        assertEq(clanBoost.duration, boostDuration);
        assertEq(clanBoost.value, 50);
        assertEq(clanBoost.itemTokenId, CLAN_BOOSTER_2);
        assertEq(uint8(clanBoost.boostType), uint8(BoostType.COMBAT_XP));

        assertEq(clanBoost.lastStartTime, nowTimestamp);
        assertEq(clanBoost.lastDuration, boostDuration / 2 + extraBoostedTime);
        assertEq(clanBoost.lastValue, 50);
        assertEq(clanBoost.lastItemTokenId, CLAN_BOOSTER);
        assertEq(uint8(clanBoost.lastBoostType), uint8(BoostType.ANY_XP));

        state = players.getPendingQueuedActionState(ALICE, playerId);
        xpElapsedTime = 720;
        meleeXP = xpElapsedTime + (uint256(361) * 50) / 100 + (uint256(359) * 50) / 100;
        healthXP = meleeXP / 3;
        assertEq(state.equipmentStates.length, 1);
        assertEq(state.actionMetadatas.length, 1);
        assertEq(state.actionMetadatas[0].xpGained, meleeXP + healthXP);

        // The new boost should be valid from the current time and not include anymore of the old one. So 1.5 boostDuration's worth
        vm.warp(nowTimestamp + boostDuration + boostDuration + extraBoostedTime);

        state = players.getPendingQueuedActionState(ALICE, playerId);
        xpElapsedTime = 1440;
        meleeXP = xpElapsedTime + (uint256(361) * 50) / 100 + (720 * 50) / 100;
        healthXP = meleeXP / 3;
        assertEq(state.equipmentStates.length, 1);
        assertEq(state.actionMetadatas.length, 1);
        assertEq(state.actionMetadatas[0].xpGained, meleeXP + healthXP);

        vm.prank(ALICE);
        players.processActions(playerId);
        assertEq(players.getPlayerXP(playerId, Skill.MELEE), meleeXP);
        assertEq(players.getPlayerXP(playerId, Skill.HEALTH), healthXP);
    }

    function testGlobalBoostOverrideWithOverlappingBoosts() public {
        // Use different durations
        uint24 firstBoostDuration = 720;
        uint24 secondBoostDuration = 360;

        _addBoostItem(PRAY_TO_THE_BEARDIE, EquipPosition.GLOBAL_BOOST_VIAL, BoostType.ANY_XP, 50, firstBoostDuration);
        _addBoostItem(PRAY_TO_THE_BEARDIE_2, EquipPosition.GLOBAL_BOOST_VIAL, BoostType.COMBAT_XP, 30, secondBoostDuration);
        _addBoostItem(LUCK_OF_THE_DRAW, EquipPosition.EXTRA_BOOST_VIAL, BoostType.ANY_XP, 0, 720);

        (QueuedActionInput memory queuedAction,) = _setupBasicMeleeCombat();

        uint256 nextGlobalThreshold = wishingWell.getNextGlobalThreshold();
        assertGt(nextGlobalThreshold, 0);

        // Start with ANY_XP boost
        vm.expectEmit(address(wishingWell));
        emit WishingWell.LastGlobalDonationThreshold(nextGlobalThreshold, PRAY_TO_THE_BEARDIE_2);
        vm.expectEmit(address(players));
        emit PlayersBase.ConsumeGlobalBoostVial(
            ALICE, playerId, BoostInfo(uint40(vm.getBlockTimestamp()), firstBoostDuration, 50, PRAY_TO_THE_BEARDIE, BoostType.ANY_XP)
        );
        vm.prank(ALICE);
        players.startActionsAdvanced(
            playerId, _queuedActions(queuedAction), NONE, 0, 0, nextGlobalThreshold, ActionQueueStrategy.OVERWRITE
        );
        uint256 nowTimestamp = vm.getBlockTimestamp();

        // Move time to middle of first boost
        vm.warp(nowTimestamp + firstBoostDuration / 2 + 1);

        // Add COMBAT_XP boost halfway through ANY_XP boost
        vm.expectEmit(address(wishingWell));
        emit WishingWell.LastGlobalDonationThreshold(nextGlobalThreshold * 2, PRAY_TO_THE_BEARDIE_3);
        vm.expectEmit(address(players));
        emit PlayersBase.ConsumeGlobalBoostVial(
            ALICE, 0, BoostInfo(uint40(vm.getBlockTimestamp()), secondBoostDuration, 30, PRAY_TO_THE_BEARDIE_2, BoostType.COMBAT_XP)
        );
        vm.prank(ALICE);
        players.donate(0, nextGlobalThreshold);

        // Move time to where both boosts will be active
        vm.warp(nowTimestamp + firstBoostDuration / 2 + secondBoostDuration);

        // Calculations. Combat XP only accrues per monster killed, respawn time is 360 seconds (10 spawned per hour)
        uint256 xpElapsedTime = 720;
        uint256 firstBoostedSeconds = firstBoostDuration / 2 + 1;
        uint256 secondBoostedSeconds = xpElapsedTime - firstBoostedSeconds;
        uint256 meleeXP = xpElapsedTime + (firstBoostedSeconds * 50) / 100 + (secondBoostedSeconds * 30) / 100;
        uint256 healthXP = meleeXP / 3;

        PendingQueuedActionState memory state = players.getPendingQueuedActionState(ALICE, playerId);
        assertEq(state.equipmentStates.length, 1);
        assertEq(state.actionMetadatas.length, 1);
        assertEq(state.actionMetadatas[0].xpGained, meleeXP + healthXP);

        vm.prank(ALICE);
        players.processActions(playerId);
        assertEq(players.getPlayerXP(playerId, Skill.MELEE), meleeXP);
        assertEq(players.getPlayerXP(playerId, Skill.HEALTH), healthXP);
    }

    function testGlobalBoostOverrideCurrentIsNonCombatAndLastIsCombatOnlyUsesLast() public {
        uint24 boostDuration = 720;
        _addBoostItem(PRAY_TO_THE_BEARDIE, EquipPosition.GLOBAL_BOOST_VIAL, BoostType.ANY_XP, 50, boostDuration);
        _addBoostItem(PRAY_TO_THE_BEARDIE_2, EquipPosition.GLOBAL_BOOST_VIAL, BoostType.NON_COMBAT_XP, 30, boostDuration);
        _addBoostItem(PRAY_TO_THE_BEARDIE_3, EquipPosition.GLOBAL_BOOST_VIAL, BoostType.COMBAT_XP, 10, boostDuration);
        _addBoostItem(LUCK_OF_THE_DRAW, EquipPosition.EXTRA_BOOST_VIAL, BoostType.ANY_XP, 0, boostDuration);

        (QueuedActionInput memory queuedAction,) = _setupBasicMeleeCombat();

        // Currently only minted through donation thresholds
        uint256 nextGlobalThreshold = wishingWell.getNextGlobalThreshold();
        assertGt(nextGlobalThreshold, 0);

        vm.expectEmit(address(wishingWell));
        emit WishingWell.LastGlobalDonationThreshold(nextGlobalThreshold, PRAY_TO_THE_BEARDIE_2);
        vm.expectEmit(address(players));
        emit PlayersBase.ConsumeGlobalBoostVial(
            ALICE, playerId, BoostInfo(uint40(vm.getBlockTimestamp()), boostDuration, 50, PRAY_TO_THE_BEARDIE, BoostType.ANY_XP)
        );
        vm.prank(ALICE);
        players.startActionsAdvanced(
            playerId, _queuedActions(queuedAction), NONE, 0, 0, nextGlobalThreshold, ActionQueueStrategy.OVERWRITE
        );
        uint256 nowTimestamp = vm.getBlockTimestamp();

        vm.warp(nowTimestamp + boostDuration / 2 + 1);
        PendingQueuedActionState memory state = players.getPendingQueuedActionState(ALICE, playerId);
        // Combat XP only accrues per monster killed, respawn time is 360 seconds (10 spawned per hour)
        uint256 xpElapsedTime = 360;
        uint256 meleeXP = xpElapsedTime + (xpElapsedTime * 50) / 100;
        uint256 healthXP = meleeXP / 3;
        assertEq(state.equipmentStates.length, 1);
        assertEq(state.actionMetadatas.length, 1);
        assertEq(state.actionMetadatas[0].xpGained, meleeXP + healthXP);

        vm.expectEmit(address(wishingWell));
        emit WishingWell.LastGlobalDonationThreshold(nextGlobalThreshold * 2, PRAY_TO_THE_BEARDIE_3);
        vm.expectEmit(address(players));
        emit PlayersBase.ConsumeGlobalBoostVial(
            ALICE, 0, BoostInfo(uint40(vm.getBlockTimestamp()), boostDuration, 30, PRAY_TO_THE_BEARDIE_2, BoostType.NON_COMBAT_XP)
        );
        vm.prank(ALICE);
        players.donate(0, nextGlobalThreshold);

        uint256 now1 = vm.getBlockTimestamp();
        uint256 extraBoostedTime = now1 - nowTimestamp - boostDuration / 2;

        vm.warp(nowTimestamp + boostDuration + boostDuration + extraBoostedTime);

        StandardBoostInfo memory globalBoost = _globalBoost();
        assertEq(globalBoost.startTime, now1);
        assertEq(globalBoost.duration, boostDuration);
        assertEq(globalBoost.value, 30);
        assertEq(globalBoost.itemTokenId, PRAY_TO_THE_BEARDIE_2);
        assertEq(uint8(globalBoost.boostType), uint8(BoostType.NON_COMBAT_XP));

        assertEq(globalBoost.lastStartTime, nowTimestamp);
        assertEq(globalBoost.lastDuration, boostDuration / 2 + extraBoostedTime);
        assertEq(globalBoost.lastValue, 50);
        assertEq(globalBoost.lastItemTokenId, PRAY_TO_THE_BEARDIE);
        assertEq(uint8(globalBoost.lastBoostType), uint8(BoostType.ANY_XP));

        // Current NON_COMBAT_XP boost has no effect, but we still use the LAST boost (saved from first ANY_XP boost)
        state = players.getPendingQueuedActionState(ALICE, playerId);
        xpElapsedTime = 1440;
        meleeXP = xpElapsedTime + (uint256(361) * 50) / 100; // No extra
        healthXP = meleeXP / 3;
        assertEq(state.equipmentStates.length, 1);
        assertEq(state.actionMetadatas.length, 1);
        assertEq(state.actionMetadatas[0].xpGained, meleeXP + healthXP);

        // The next global boost should have an effect but previous one doesn't.
        vm.expectEmit(address(wishingWell));
        emit WishingWell.LastGlobalDonationThreshold(nextGlobalThreshold * 3, PRAY_TO_THE_BEARDIE);
        vm.expectEmit(address(players));
        emit PlayersBase.ConsumeGlobalBoostVial(
            ALICE, 0, BoostInfo(uint40(vm.getBlockTimestamp()), boostDuration, 10, PRAY_TO_THE_BEARDIE_3, BoostType.COMBAT_XP)
        );
        vm.prank(ALICE);
        players.donate(0, nextGlobalThreshold);

        vm.warp(nowTimestamp + boostDuration + boostDuration + boostDuration + extraBoostedTime);

        state = players.getPendingQueuedActionState(ALICE, playerId);

        // Base XP is 3 full periods, the combat boost applies for the last period
        xpElapsedTime = 2160;
        meleeXP = xpElapsedTime + (uint256(719) * 10) / 100;
        healthXP = meleeXP / 3;

        assertEq(state.equipmentStates.length, 1);
        assertEq(state.actionMetadatas.length, 1);
        assertEq(state.actionMetadatas[0].xpGained, meleeXP + healthXP);

        vm.prank(ALICE);
        players.processActions(playerId);
        assertEq(players.getPlayerXP(playerId, Skill.MELEE), meleeXP);
        assertEq(players.getPlayerXP(playerId, Skill.HEALTH), healthXP);
    }

    // XP boost for 1 hour, no XP boost (uses gathering boost) for 6 hours, XP boost for 1 hour.
    function testAnyXPBoostCheckMultipleBoostConsumptionsAndPeriodWithoutXPBoost() public {
        _addBoostItem(XP_BOOST, EquipPosition.BOOST_VIAL, BoostType.ANY_XP, 50, 7200);
        _addBoostItem(GATHERING_BOOST, EquipPosition.BOOST_VIAL, BoostType.GATHERING, 50, 7200);

        (QueuedActionInput memory queuedActionWoodcutting, uint256 rate) = _setupBasicWoodcutting();
        QueuedActionInput memory queuedAction = queuedActionWoodcutting;
        queuedAction.timespan = 3600 * 8;

        itemNFT.mintBatch(ALICE, _uint256s(XP_BOOST, GATHERING_BOOST), _uint256s(2, 2));
        vm.prank(ALICE);
        players.startActionsAdvanced(
            playerId, _queuedActions(queuedAction), XP_BOOST, BOOST_START_NOW, 0, NO_DONATION_AMOUNT, ActionQueueStrategy.OVERWRITE
        );
        vm.warp(vm.getBlockTimestamp() + 3600);

        // Change to gathering boost
        vm.prank(ALICE);
        players.startActionsAdvanced(
            playerId, _queuedActions(queuedAction), GATHERING_BOOST, BOOST_START_NOW, 0, NO_DONATION_AMOUNT, ActionQueueStrategy.APPEND
        );
        vm.warp(vm.getBlockTimestamp() + 3600 * 6);
        // Back to XP boost
        vm.prank(ALICE);
        players.startActionsAdvanced(
            playerId, _queuedActions(queuedAction), XP_BOOST, BOOST_START_NOW, 0, NO_DONATION_AMOUNT, ActionQueueStrategy.APPEND
        );
        vm.warp(vm.getBlockTimestamp() + 3600);
        vm.prank(ALICE);
        players.processActions(playerId);

        // 2 hours boosted XP, 6 hours not boosted in total
        assertEq(players.getPlayerXP(playerId, Skill.WOODCUTTING), 8 * 3600 + (2 * 3600 * 50) / 100);

        // 2 hours gathering boost, check drops are as expected
        assertEq(
            itemNFT.balanceOf(ALICE, LOG),
            (8 * 3600 * rate) / (3600 * GUAR_MUL) + (2 * 3600 * rate * 50) / (3600 * GUAR_MUL * 100)
        );
    }

    function testClearEverythingCheckBoostIsMintedIfNotUsedYet() public {
        (QueuedActionInput memory queuedAction,) = _setupBasicWoodcutting();

        _addBoostItem(XP_BOOST, EquipPosition.BOOST_VIAL, BoostType.ANY_XP, 10, 3600);

        itemNFT.mint(ALICE, XP_BOOST, 1);
        assertEq(itemNFT.balanceOf(ALICE, XP_BOOST), 1);

        vm.prank(ALICE);
        players.startActionsAdvanced(
            playerId, _queuedActions(queuedAction, queuedAction), XP_BOOST, 0, 0, NO_DONATION_AMOUNT, ActionQueueStrategy.OVERWRITE
        );
        assertEq(itemNFT.balanceOf(ALICE, XP_BOOST), 0);

        // Make a new player active so the old one is cleared
        vm.recordLogs();
        vm.prank(ALICE);
        playerNFT.mint(1, "noname", "", "", "", false, true);
        assertEq(_countLogs(address(players), PlayersBase.BoostFinished.selector), 1);
        assertEq(_countLogs(address(players), PlayersBase.UpdateLastBoost.selector), 0);

        // Gets the boost back
        assertEq(itemNFT.balanceOf(ALICE, XP_BOOST), 1);
    }

    function testClearEverythingCheckBoostIsMintedAndLastBoostCorrectlyClearedToo() public {
        (QueuedActionInput memory queuedAction,) = _setupBasicWoodcutting();

        _addBoostItem(XP_BOOST, EquipPosition.BOOST_VIAL, BoostType.ANY_XP, 10, 3600);

        itemNFT.mint(ALICE, XP_BOOST, 2);

        vm.prank(ALICE);
        players.startActionsAdvanced(
            playerId, _queuedActions(queuedAction), XP_BOOST, 0, 0, NO_DONATION_AMOUNT, ActionQueueStrategy.OVERWRITE
        );
        uint256 nowTimestamp = vm.getBlockTimestamp();
        assertEq(itemNFT.balanceOf(ALICE, XP_BOOST), 1);
        vm.warp(vm.getBlockTimestamp() + 1800);

        vm.expectEmit(address(players));
        emit PlayersBase.UpdateLastBoost(playerId, BoostInfo(uint40(nowTimestamp), 1800, 10, XP_BOOST, BoostType.ANY_XP));
        vm.prank(ALICE);
        players.startActionsAdvanced(
            playerId, _queuedActions(queuedAction), XP_BOOST, BOOST_START_NOW, 0, NO_DONATION_AMOUNT, ActionQueueStrategy.KEEP_LAST_IN_PROGRESS
        );
        assertEq(itemNFT.balanceOf(ALICE, XP_BOOST), 0);

        vm.warp(vm.getBlockTimestamp() + 1800);

        ExtendedBoostInfo memory playerBoost = players.getActiveBoost(playerId);
        assertEq(playerBoost.startTime, nowTimestamp + 1800);
        assertEq(playerBoost.duration, 3600);
        assertEq(playerBoost.lastStartTime, nowTimestamp);
        assertEq(playerBoost.lastDuration, 1800);

        // Make a new player active so the old one is cleared
        vm.recordLogs();
        vm.prank(ALICE);
        playerNFT.mint(1, "noname", "", "", "", false, true);
        assertEq(_countLogs(address(players), PlayersBase.BoostFinished.selector), 1);
        assertEq(_countLogs(address(players), PlayersBase.ExtraBoostFinished.selector), 0);

        // Boost is used so nothing back
        assertEq(itemNFT.balanceOf(ALICE, XP_BOOST), 0);
        playerBoost = players.getActiveBoost(playerId);
        assertEq(playerBoost.duration, 0);
        assertEq(playerBoost.lastStartTime, 0);
        assertEq(playerBoost.lastDuration, 0);
    }

    function testQueueingABoostInFutureAndQueueingOthersUpdatesLastBoostCorrectly() public {
        (QueuedActionInput memory queuedAction,) = _setupBasicWoodcutting();

        _addBoostItem(XP_BOOST, EquipPosition.BOOST_VIAL, BoostType.ANY_XP, 10, 3600);

        itemNFT.mint(ALICE, XP_BOOST, 2);
        assertEq(itemNFT.balanceOf(ALICE, XP_BOOST), 2);

        vm.prank(ALICE);
        players.startActionsAdvanced(
            playerId, _queuedActions(queuedAction), XP_BOOST, BOOST_START_NOW, 0, NO_DONATION_AMOUNT, ActionQueueStrategy.OVERWRITE
        );
        uint256 nowTimestamp = vm.getBlockTimestamp();
        assertEq(itemNFT.balanceOf(ALICE, XP_BOOST), 1);
        vm.warp(vm.getBlockTimestamp() + 1800);

        vm.prank(ALICE);
        players.startActionsAdvanced(
            playerId, _queuedActions(queuedAction), XP_BOOST, BOOST_START_NOW, 0, NO_DONATION_AMOUNT, ActionQueueStrategy.KEEP_LAST_IN_PROGRESS
        );
        uint256 now1 = vm.getBlockTimestamp();
        assertEq(itemNFT.balanceOf(ALICE, XP_BOOST), 0);

        ExtendedBoostInfo memory playerBoost = players.getActiveBoost(playerId);
        assertEq(playerBoost.duration, 3600);
        assertEq(playerBoost.lastDuration, 1800);

        itemNFT.mint(ALICE, XP_BOOST, 1);
        vm.prank(ALICE);
        players.startActionsAdvanced(
            playerId,
            _queuedActions(queuedAction),
            XP_BOOST,
            0, // start boost at the end
            0,
            NO_DONATION_AMOUNT,
            ActionQueueStrategy.APPEND
        );
        assertEq(itemNFT.balanceOf(ALICE, XP_BOOST), 0);

        playerBoost = players.getActiveBoost(playerId);
        assertEq(playerBoost.startTime, nowTimestamp + queuedAction.timespan * 2);
        assertEq(playerBoost.duration, 3600);
        assertEq(playerBoost.lastStartTime, now1);
        assertEq(playerBoost.lastDuration, 3600);

        // Queue another one should update the last boost again and re-use unused boost from before without error
        vm.prank(ALICE);
        players.startActionsAdvanced(
            playerId, _queuedActions(queuedAction), XP_BOOST, 0, 0, NO_DONATION_AMOUNT, ActionQueueStrategy.KEEP_LAST_IN_PROGRESS
        );
        playerBoost = players.getActiveBoost(playerId);
        assertEq(playerBoost.startTime, nowTimestamp + queuedAction.timespan);
        assertEq(playerBoost.duration, 3600);
        assertEq(playerBoost.lastStartTime, now1);
        assertEq(playerBoost.lastDuration, 1800);
    }

    function testGatheringBoostSimple() public {
        _addBoostItem(GATHERING_BOOST, EquipPosition.BOOST_VIAL, BoostType.GATHERING, 10, 3600);

        (QueuedActionInput memory queuedAction, uint256 rate) = _setupBasicWoodcutting();
        itemNFT.mint(ALICE, GATHERING_BOOST, 1);
        assertEq(itemNFT.balanceOf(ALICE, GATHERING_BOOST), 1);
        vm.prank(ALICE);
        players.startActionsAdvanced(
            playerId, _queuedActions(queuedAction), GATHERING_BOOST, BOOST_START_NOW, 0, NO_DONATION_AMOUNT, ActionQueueStrategy.OVERWRITE
        );
        assertEq(itemNFT.balanceOf(ALICE, GATHERING_BOOST), 0);

        vm.warp(vm.getBlockTimestamp() + queuedAction.timespan);
        vm.prank(ALICE);
        players.processActions(playerId);
        assertEq(players.getPlayerXP(playerId, Skill.WOODCUTTING), queuedAction.timespan);
        // Check the drops are as expected
        assertEq(
            itemNFT.balanceOf(ALICE, LOG),
            (queuedAction.timespan * rate) / (3600 * GUAR_MUL) + (3600 * 10 * rate) / (100 * GUAR_MUL * 3600)
        );
    }

    function testGatheringBoostCookingWithSuccessPercent() public {
        _addBoostItem(GATHERING_BOOST, EquipPosition.BOOST_VIAL, BoostType.GATHERING, 10, 3600);

        uint8 successPercent = 50;
        uint256 minLevel = 1;
        (QueuedActionInput memory queuedAction,,) = _setupBasicCooking(successPercent, minLevel);
        itemNFT.mint(ALICE, GATHERING_BOOST, 1);
        vm.prank(ALICE);
        players.startActionsAdvanced(
            playerId, _queuedActions(queuedAction), GATHERING_BOOST, BOOST_START_NOW, 0, NO_DONATION_AMOUNT, ActionQueueStrategy.OVERWRITE
        );

        vm.warp(vm.getBlockTimestamp() + queuedAction.timespan);

        PendingQueuedActionState memory state = players.getPendingQueuedActionState(ALICE, playerId);
        assertEq(state.equipmentStates[0].producedAmounts[0], 55);

        vm.prank(ALICE);
        players.processActions(playerId);
        assertEq(players.getPlayerXP(playerId, Skill.COOKING), queuedAction.timespan);
        // Check the drops are as expected
        assertEq(itemNFT.balanceOf(ALICE, COOKED_MINNUS), 55);
    }

    function testGatheringBoostRandomRewardsObtainSameDay() public {
        _addBoostItem(GATHERING_BOOST, EquipPosition.BOOST_VIAL, BoostType.GATHERING, 10, 3600);

        QueuedActionInput memory queuedAction = _setupThieving(2, 65_535, 100);

        // Make sure it passes the next checkpoint so there are no issues running
        _passNextCheckpointAndFulfill();

        itemNFT.mint(ALICE, GATHERING_BOOST, 1);
        assertEq(itemNFT.balanceOf(ALICE, GATHERING_BOOST), 1);
        vm.prank(ALICE);
        players.startActionsAdvanced(
            playerId, _queuedActions(queuedAction), GATHERING_BOOST, BOOST_START_NOW, 0, NO_DONATION_AMOUNT, ActionQueueStrategy.OVERWRITE
        );
        assertEq(itemNFT.balanceOf(ALICE, GATHERING_BOOST), 0);

        vm.warp(vm.getBlockTimestamp() + 24 hours);
        _fulfillNextRandomWords();
        vm.warp(vm.getBlockTimestamp() + 24 hours);
        _fulfillNextRandomWords();
        vm.prank(ALICE);
        players.processActions(playerId);

        assertEq(itemNFT.balanceOf(ALICE, BRONZE_ARROW), 210);
    }

    function testGatheringBoostBoostedTimeOverMultipleQueuedActionsIsCorrect() public {
        // 3 hour 30 mins
        _addBoostItem(GATHERING_BOOST, EquipPosition.BOOST_VIAL, BoostType.GATHERING, 10, 12_600);

        QueuedActionInput memory queuedAction = _setupThieving(2, 65_535, 100);

        // Make sure it passes the next checkpoint so there are no issues running
        _passNextCheckpointAndFulfill();

        itemNFT.mint(ALICE, GATHERING_BOOST, 2);
        assertEq(itemNFT.balanceOf(ALICE, GATHERING_BOOST), 2);
        vm.prank(ALICE);
        players.startActionsAdvanced(
            playerId,
            _queuedActions(queuedAction, queuedAction, queuedAction),
            GATHERING_BOOST,
            BOOST_START_NOW,
            0,
            NO_DONATION_AMOUNT,
            ActionQueueStrategy.OVERWRITE
        );
        assertEq(itemNFT.balanceOf(ALICE, GATHERING_BOOST), 1);

        vm.warp(vm.getBlockTimestamp() + 3600 + 60);
        vm.prank(ALICE);
        players.processActions(playerId);
        PendingRandomReward[] memory pendingRandomRewards = players.getPendingRandomRewards(playerId);
        assertEq(pendingRandomRewards.length, 1);
        assertEq(pendingRandomRewards[0].xpElapsedTime, 3600);
        assertEq(players.getPlayerXP(playerId, Skill.THIEVING), 50);
        vm.warp(vm.getBlockTimestamp() + 3600 + 60);
        vm.prank(ALICE);
        players.processActions(playerId); // Still in same action
        pendingRandomRewards = players.getPendingRandomRewards(playerId);
        assertEq(pendingRandomRewards.length, 2);
        assertEq(pendingRandomRewards[1].xpElapsedTime, 3600);
        assertEq(players.getPlayerXP(playerId, Skill.THIEVING), 100);
        vm.warp(vm.getBlockTimestamp() + 100); // Next action
        vm.prank(ALICE);
        players.processActions(playerId);
        assertEq(players.getPlayerXP(playerId, Skill.THIEVING), 100); // Thieving is untouched
        pendingRandomRewards = players.getPendingRandomRewards(playerId);
        assertEq(pendingRandomRewards.length, 2); // Not added as there was no xp time
        vm.warp(vm.getBlockTimestamp() + 7200);
        vm.prank(ALICE);
        players.processActions(playerId);
        assertEq(players.getPlayerXP(playerId, Skill.THIEVING), 200);
        pendingRandomRewards = players.getPendingRandomRewards(playerId);
        assertEq(pendingRandomRewards.length, 3);
        assertEq(pendingRandomRewards[2].xpElapsedTime, 7200);

        vm.warp(vm.getBlockTimestamp() + 24 hours);
        _fulfillNextRandomWords();
        vm.warp(vm.getBlockTimestamp() + 24 hours);
        _fulfillNextRandomWords();

        vm.prank(ALICE);
        players.startActionsAdvanced(
            playerId, _queuedActions(queuedAction), GATHERING_BOOST, BOOST_START_NOW, 0, NO_DONATION_AMOUNT, ActionQueueStrategy.OVERWRITE
        );
        assertEq(itemNFT.balanceOf(ALICE, GATHERING_BOOST), 0);
    }

    function testGatheringBoostCheckBoostedProductionWithSignificantBoostOverrides() public {
        // First boost: 100% boost for clarity
        _addBoostItem(GATHERING_BOOST, EquipPosition.BOOST_VIAL, BoostType.GATHERING, 100, 3600 * 3);

        // Second boost: 25% for better verification
        _addBoostItem(BOOK_001_BRONZE, EquipPosition.BOOST_VIAL, BoostType.GATHERING, 25, 3600 * 3);

        // Setup farming with higher base production, 100 seeds in 8 hours for clearer math
        (QueuedActionInput memory queuedAction,) = _setupBasicFarming(125, 100);

        itemNFT.mintBatch(ALICE, _uint256s(GATHERING_BOOST, BOOK_001_BRONZE), _uint256s(1, 1));

        uint256 startingAmount = 10_000;
        itemNFT.mintBatch(ALICE, _uint256s(PLOT_001_SMALL, SEED_001_WILD), _uint256s(startingAmount, startingAmount));

        // Start first boost
        vm.prank(ALICE);
        players.startActionsAdvanced(
            playerId, _queuedActions(queuedAction), GATHERING_BOOST, BOOST_START_NOW, NONE, NO_DONATION_AMOUNT, ActionQueueStrategy.OVERWRITE
        );
        uint256 nowTimestamp = vm.getBlockTimestamp();

        // Go forward 2 hours with 100% boost
        vm.warp(vm.getBlockTimestamp() + 3600 * 2);

        // Override with 25% boost
        vm.prank(ALICE);
        players.startActionsAdvanced(
            playerId,
            new QueuedActionInput[](0),
            BOOK_001_BRONZE,
            BOOST_START_NOW,
            NONE,
            NO_DONATION_AMOUNT,
            ActionQueueStrategy.KEEP_LAST_IN_PROGRESS
        );
        uint256 now1 = vm.getBlockTimestamp();

        ExtendedBoostInfo memory playerBoost = players.getActiveBoost(playerId);
        assertEq(playerBoost.startTime, now1);
        assertEq(playerBoost.duration, 3600 * 3);
        assertEq(playerBoost.value, 25);
        assertEq(playerBoost.itemTokenId, BOOK_001_BRONZE);
        assertEq(uint8(playerBoost.boostType), uint8(BoostType.GATHERING));

        assertEq(playerBoost.lastStartTime, nowTimestamp);
        assertEq(playerBoost.lastDuration, 3600 * 2);
        assertEq(playerBoost.lastValue, 100);
        assertEq(playerBoost.lastItemTokenId, GATHERING_BOOST);
        assertEq(uint8(playerBoost.lastBoostType), uint8(BoostType.GATHERING));

        // Go forward remaining 6 hours
        vm.warp(vm.getBlockTimestamp() + 3600 * 6);

        // Should produce:
        // - Base: 100 seeds
        // - First 2 hours (100% boost): 25 extra seeds
        // - Next 3 hours (25% boost): ~9.375 extra seeds
        // Total: ~134.375 seeds
        PendingQueuedActionState memory state = players.getPendingQueuedActionState(ALICE, playerId);
        assertEq(state.equipmentStates[0].producedAmounts[0], 134);

        vm.warp(vm.getBlockTimestamp() + 24 hours);

        // Both should be cleared
        vm.prank(ALICE);
        players.processActions(playerId);

        playerBoost = players.getActiveBoost(playerId);
        assertEq(playerBoost.startTime, 0);
        assertEq(playerBoost.duration, 0);
        assertEq(playerBoost.value, 0);
        assertEq(playerBoost.itemTokenId, 0);
        assertEq(uint8(playerBoost.boostType), uint8(BoostType.NONE));
        assertEq(playerBoost.lastStartTime, 0);
        assertEq(playerBoost.lastDuration, 0);
        assertEq(playerBoost.lastValue, 0);
        assertEq(playerBoost.lastItemTokenId, 0);
        assertEq(uint8(playerBoost.lastBoostType), uint8(BoostType.NONE));
    }

    function testGatheringBoostRandomRewardsObtainNextDay() public {
        _addBoostItem(GATHERING_BOOST, EquipPosition.BOOST_VIAL, BoostType.GATHERING, 10, 3600);

        QueuedActionInput memory queuedAction = _setupThieving(2, 65_535, 100);

        // Make sure it passes the next checkpoint so there are no issues running
        _passNextCheckpointAndFulfill();

        itemNFT.mint(ALICE, GATHERING_BOOST, 1);
        assertEq(itemNFT.balanceOf(ALICE, GATHERING_BOOST), 1);
        vm.prank(ALICE);
        players.startActionsAdvanced(
            playerId, _queuedActions(queuedAction), GATHERING_BOOST, BOOST_START_NOW, 0, NO_DONATION_AMOUNT, ActionQueueStrategy.OVERWRITE
        );
        assertEq(itemNFT.balanceOf(ALICE, GATHERING_BOOST), 0);

        vm.warp(vm.getBlockTimestamp() + 24 hours);
        _fulfillNextRandomWords();
        vm.prank(ALICE);
        players.processActions(playerId);

        assertEq(itemNFT.balanceOf(ALICE, BRONZE_ARROW), 0);

        vm.warp(vm.getBlockTimestamp() + 24 hours);
        _fulfillNextRandomWords();
        vm.prank(ALICE);
        players.processActions(playerId);
        assertEq(itemNFT.balanceOf(ALICE, BRONZE_ARROW), 210);
    }

    function testGatheringBoostOutputGreaterThan65535() public {
        _addBoostItem(GATHERING_BOOST, EquipPosition.BOOST_VIAL, BoostType.GATHERING, 10, 3600);

        uint256 rate = 300 * RATE_MUL;
        (QueuedActionInput memory queuedAction,) = _setupBasicAlchemy(rate, 255);

        uint256 startingAmount = 1_000_000;
        itemNFT.mintBatch(
            ALICE,
            _uint256s(SHADOW_SCROLL, NATURE_SCROLL, PAPER, GATHERING_BOOST),
            _uint256s(startingAmount, startingAmount, startingAmount, 1)
        );

        vm.prank(ALICE);
        players.startActionsAdvanced(
            playerId, _queuedActions(queuedAction), GATHERING_BOOST, BOOST_START_NOW, 0, NO_DONATION_AMOUNT, ActionQueueStrategy.OVERWRITE
        );

        vm.warp(vm.getBlockTimestamp() + queuedAction.timespan);
        vm.prank(ALICE);
        players.processActions(playerId);
        assertEq(players.getPlayerXP(playerId, Skill.ALCHEMY), queuedAction.timespan);

        uint256 outputBalance = itemNFT.balanceOf(ALICE, ANCIENT_SCROLL);
        assertEq(
            outputBalance,
            (queuedAction.timespan * rate * 255) / (3600 * RATE_MUL) + (3600 * 10 * rate * 255) / (100 * RATE_MUL * 3600)
        );
        assertGt(outputBalance, 65_535);
    }

    function testCombatStatsBoostOnlyGivesBoostToWholeActions() public {
        ItemInput memory potion = _defaultItem(POTION_005_SMALL_MELEE, EquipPosition.BOOST_VIAL);
        potion.combatStats = CombatStats(1000, 1000, 1000, 1000, 1000, 1000, 1000);
        potion.boostType = BoostType.COMBAT_FIXED;
        potion.isTransferable = false;
        potion.boostDuration = 3600;
        ItemInput[] memory items = new ItemInput[](1);
        items[0] = potion;
        itemNFT.addItems(items);

        itemNFT.mint(ALICE, POTION_005_SMALL_MELEE, 2);

        CombatStats memory monsterCombatStats = CombatStats(80, 80, 80, 1200, 80, 80, 80);

        (QueuedActionInput memory queuedAction, ActionInput memory combatAction) = _setupBasicMeleeCombat();

        // Update monster
        combatAction.combatStats = monsterCombatStats;
        ActionInput[] memory actions = new ActionInput[](1);
        actions[0] = combatAction;
        worldActions.editActions(actions);

        // Start an action
        vm.prank(ALICE);
        players.startActions(playerId, _queuedActions(queuedAction), ActionQueueStrategy.OVERWRITE);

        // Add the boost after it started
        vm.warp(vm.getBlockTimestamp() + 1);
        vm.prank(ALICE);
        players.startActionsAdvanced(
            playerId,
            _queuedActions(queuedAction),
            POTION_005_SMALL_MELEE,
            BOOST_START_NOW,
            0,
            NO_DONATION_AMOUNT,
            ActionQueueStrategy.KEEP_LAST_IN_PROGRESS
        );

        // Combat boost should have no affect, check that you died
        vm.warp(vm.getBlockTimestamp() + queuedAction.timespan);
        PendingQueuedActionState memory state = players.getPendingQueuedActionState(ALICE, playerId);
        assertTrue(state.actionMetadatas[0].died);

        // Now start the action again fully encapsulating it and check you don't die
        vm.prank(ALICE);
        players.startActionsAdvanced(
            playerId, _queuedActions(queuedAction), POTION_005_SMALL_MELEE, BOOST_START_NOW, 0, NO_DONATION_AMOUNT, ActionQueueStrategy.OVERWRITE
        );

        // Combat boost should have an affect, check that you didn't die
        vm.warp(vm.getBlockTimestamp() + queuedAction.timespan);
        state = players.getPendingQueuedActionState(ALICE, playerId);
        assertFalse(state.actionMetadatas[0].died);
    }

    function testBoostShouldBeMintedIfNotUsedYetAndAnotherOneIsUsed() public {
        // Check that they are minted/consumed as expected
        _addBoostItem(XP_BOOST, EquipPosition.BOOST_VIAL, BoostType.NON_COMBAT_XP, 10, 3600 * 24);

        (QueuedActionInput memory queuedAction,) = _setupBasicWoodcutting();

        itemNFT.mint(ALICE, XP_BOOST, 1);
        assertEq(itemNFT.balanceOf(ALICE, XP_BOOST), 1);
        uint8 boostStartReverseIndex = 0; // Starts at the second action
        vm.prank(ALICE);
        players.startActionsAdvanced(
            playerId, _queuedActions(queuedAction, queuedAction), XP_BOOST, boostStartReverseIndex, 0, NO_DONATION_AMOUNT, ActionQueueStrategy.OVERWRITE
        );
        assertEq(itemNFT.balanceOf(ALICE, XP_BOOST), 0);
        itemNFT.mint(ALICE, XP_BOOST, 1);
        vm.prank(ALICE);
        players.startActionsAdvanced(
            playerId, _queuedActions(queuedAction, queuedAction), XP_BOOST, boostStartReverseIndex, 0, NO_DONATION_AMOUNT, ActionQueueStrategy.OVERWRITE
        );
        assertEq(itemNFT.balanceOf(ALICE, XP_BOOST), 1);
    }

    function testStartBoostFromLastActionOnlyAndCheckThatItExtendsToFutureActions() public {
        _addBoostItem(XP_BOOST, EquipPosition.BOOST_VIAL, BoostType.NON_COMBAT_XP, 10, 3600 * 24);

        (QueuedActionInput memory queuedActionWoodcutting,) = _setupBasicWoodcutting();
        queuedActionWoodcutting.timespan = 3600 * 8;
        (QueuedActionInput memory queuedActionFishing,) = _setupBasicFishing();
        queuedActionFishing.timespan = 3600 * 8;
        (QueuedActionInput memory queuedActionMining,) = _setupBasicMining();
        queuedActionMining.timespan = 3600 * 8;

        itemNFT.mint(ALICE, XP_BOOST, 1);
        uint8 boostStartReverseIndex = 0;
        vm.prank(ALICE);
        players.startActionsAdvanced(
            playerId,
            _queuedActions(queuedActionWoodcutting, queuedActionFishing, queuedActionMining),
            XP_BOOST,
            boostStartReverseIndex,
            0,
            NO_DONATION_AMOUNT,
            ActionQueueStrategy.OVERWRITE
        );
        // Complete all actions
        vm.warp(vm.getBlockTimestamp() + 3 * 3600 * 8);
        vm.prank(ALICE);
        players.processActions(playerId);
        // First 2 actions should not have the boost applied
        assertEq(players.getPlayerXP(playerId, Skill.WOODCUTTING), queuedActionWoodcutting.timespan);
        assertEq(players.getPlayerXP(playerId, Skill.FISHING), queuedActionFishing.timespan);
        // Last action should have the boost applied
        assertEq(
            players.getPlayerXP(playerId, Skill.MINING),
            queuedActionMining.timespan + (queuedActionMining.timespan * 10) / 100
        );

        // Start more actions and the boost should be applied for the first 2 actions and not the last
        vm.prank(ALICE);
        players.startActions(
            playerId,
            _queuedActions(queuedActionWoodcutting, queuedActionFishing, queuedActionMining),
            ActionQueueStrategy.OVERWRITE
        );
        // Complete all actions
        vm.warp(vm.getBlockTimestamp() + 3 * 3600 * 8);
        vm.prank(ALICE);
        players.processActions(playerId);

        // First 2 actions should now have the boost applied
        assertEq(
            players.getPlayerXP(playerId, Skill.WOODCUTTING),
            queuedActionWoodcutting.timespan * 2 + (queuedActionWoodcutting.timespan * 10) / 100
        );
        assertEq(
            players.getPlayerXP(playerId, Skill.FISHING),
            queuedActionFishing.timespan * 2 + (queuedActionFishing.timespan * 10) / 100
        );
        // Last action should not have another boost period applied
        assertEq(
            players.getPlayerXP(playerId, Skill.MINING),
            queuedActionMining.timespan + (queuedActionMining.timespan * 10) / 100 + queuedActionMining.timespan
        );
    }

    function testStartBoostFromMiddleActionOnly() public {
        // 1 hour
        _addBoostItem(XP_BOOST, EquipPosition.BOOST_VIAL, BoostType.NON_COMBAT_XP, 10, 3300);

        (QueuedActionInput memory queuedActionWoodcutting,) = _setupBasicWoodcutting();
        (QueuedActionInput memory queuedActionFishing,) = _setupBasicFishing();
        (QueuedActionInput memory queuedActionMining,) = _setupBasicMining();

        itemNFT.mint(ALICE, XP_BOOST, 1);
        uint8 boostStartReverseIndex = 1;
        vm.prank(ALICE);
        players.startActionsAdvanced(
            playerId,
            _queuedActions(queuedActionWoodcutting, queuedActionFishing, queuedActionMining),
            XP_BOOST,
            boostStartReverseIndex,
            0,
            NO_DONATION_AMOUNT,
            ActionQueueStrategy.OVERWRITE
        );
        // Complete all actions
        vm.warp(vm.getBlockTimestamp() + 3 * 3600);
        vm.prank(ALICE);
        players.processActions(playerId);
        // First and last action should not have the boost applied
        assertEq(players.getPlayerXP(playerId, Skill.WOODCUTTING), queuedActionWoodcutting.timespan);
        assertEq(players.getPlayerXP(playerId, Skill.FISHING), queuedActionFishing.timespan + (3300 * 10) / 100);
        assertEq(players.getPlayerXP(playerId, Skill.MINING), queuedActionMining.timespan);
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    function _addBoostItem(
        uint16 tokenId,
        EquipPosition equipPosition,
        BoostType boostType,
        uint16 boostValue,
        uint24 boostDuration
    ) private {
        ItemInput[] memory items = new ItemInput[](1);
        items[0] = _defaultItem(tokenId, equipPosition);
        items[0].isTransferable = false;
        items[0].boostType = boostType;
        items[0].boostValue = boostValue;
        items[0].boostDuration = boostDuration;
        itemNFT.addItems(items);
    }

    function _addPlainItem(uint16 tokenId) private {
        ItemInput[] memory items = new ItemInput[](1);
        items[0] = _defaultItem(tokenId, EquipPosition.NONE);
        items[0].isTransferable = false;
        itemNFT.addItems(items);
    }

    function _setupBasicWoodcutting() private returns (QueuedActionInput memory queuedAction, uint256 rate) {
        rate = 100 * GUAR_MUL; // per hour
        ActionInput[] memory actions = new ActionInput[](1);
        actions[0].actionId = ACTION_WOODCUTTING_LOG;
        actions[0].info = _actionInfo(Skill.WOODCUTTING, 3600, 0, false, BRONZE_AXE, WOODCUTTING_MAX);
        actions[0].guaranteedRewards = new GuaranteedReward[](1);
        actions[0].guaranteedRewards[0] = GuaranteedReward(LOG, uint16(rate));
        worldActions.addActions(actions);

        ItemInput[] memory items = new ItemInput[](1);
        items[0] = _defaultItem(BRONZE_AXE, EquipPosition.RIGHT_HAND);
        itemNFT.addItems(items);

        queuedAction = _queuedAction(ACTION_WOODCUTTING_LOG, 0, 0, 3600, CombatStyle.NONE);
        queuedAction.rightHandEquipmentTokenId = BRONZE_AXE;
    }

    function _setupBasicFishing() private returns (QueuedActionInput memory queuedAction, uint256 rate) {
        rate = 100 * GUAR_MUL; // per hour
        ActionInput[] memory actions = new ActionInput[](1);
        actions[0].actionId = ACTION_FISHING_MINNUS;
        actions[0].info = _actionInfo(Skill.FISHING, 3600, 0, false, NET_STICK, FISHING_MAX);
        actions[0].guaranteedRewards = new GuaranteedReward[](1);
        actions[0].guaranteedRewards[0] = GuaranteedReward(RAW_MINNUS, uint16(rate));
        worldActions.addActions(actions);

        ItemInput[] memory items = new ItemInput[](1);
        items[0] = _defaultItem(NET_STICK, EquipPosition.RIGHT_HAND);
        itemNFT.addItems(items);

        queuedAction = _queuedAction(ACTION_FISHING_MINNUS, 0, 0, 3600, CombatStyle.NONE);
        queuedAction.rightHandEquipmentTokenId = NET_STICK;
    }

    function _setupBasicMining() private returns (QueuedActionInput memory queuedAction, uint256 rate) {
        rate = 100 * GUAR_MUL; // per hour
        ActionInput[] memory actions = new ActionInput[](1);
        actions[0].actionId = ACTION_MINING_COPPER;
        actions[0].info = _actionInfo(Skill.MINING, 3600, 0, false, BRONZE_PICKAXE, MINING_MAX);
        actions[0].guaranteedRewards = new GuaranteedReward[](1);
        actions[0].guaranteedRewards[0] = GuaranteedReward(COPPER_ORE, uint16(rate));
        worldActions.addActions(actions);

        ItemInput[] memory items = new ItemInput[](1);
        items[0] = _defaultItem(BRONZE_PICKAXE, EquipPosition.RIGHT_HAND);
        itemNFT.addItems(items);

        queuedAction = _queuedAction(ACTION_MINING_COPPER, 0, 0, 3600, CombatStyle.NONE);
        queuedAction.rightHandEquipmentTokenId = BRONZE_PICKAXE;
    }

    function _setupBasicMeleeCombat()
        private
        returns (QueuedActionInput memory queuedAction, ActionInput memory combatAction)
    {
        combatAction.actionId = 10;
        combatAction.info = _actionInfo(Skill.COMBAT, 3600, 0, true, BRONZE_SWORD, COMBAT_MAX);
        combatAction.info.numSpawned = uint24(10 * SPAWN_MUL);
        combatAction.guaranteedRewards = new GuaranteedReward[](1);
        combatAction.guaranteedRewards[0] = GuaranteedReward(BRONZE_ARROW, uint16(1 * GUAR_MUL)); // per kill
        combatAction.randomRewards = new RandomReward[](1);
        combatAction.randomRewards[0] = RandomReward(POISON, 32_767, 1); // ~50% chance
        combatAction.combatStats = CombatStats(1, 0, 0, 20, 0, 0, 0);

        ActionInput[] memory actions = new ActionInput[](1);
        actions[0] = combatAction;
        worldActions.addActions(actions);

        // Melee choice
        worldActions.addActionChoices(NONE, _uint16s(1), _meleeChoice());
        uint16 choiceId = 1;

        itemNFT.mint(ALICE, BRONZE_SWORD, 1);
        itemNFT.mint(ALICE, BRONZE_HELMET, 1);
        itemNFT.mint(ALICE, COOKED_MINNUS, 255);

        queuedAction = _queuedAction(10, choiceId, COOKED_MINNUS, 3600, CombatStyle.ATTACK);
        queuedAction.attire.head = BRONZE_HELMET;
        queuedAction.rightHandEquipmentTokenId = BRONZE_SWORD;

        ItemInput[] memory items = new ItemInput[](4);
        items[0] = _defaultItem(BRONZE_SWORD, EquipPosition.RIGHT_HAND);
        items[0].combatStats = CombatStats(5, 0, 0, 0, 0, 0, 0);
        items[1] = _defaultItem(BRONZE_HELMET, EquipPosition.HEAD);
        items[1].combatStats = CombatStats(1, 0, 0, 1, 4, 0, 1);
        items[2] = _defaultItem(BRONZE_ARROW, EquipPosition.QUIVER);
        items[3] = _defaultItem(COOKED_MINNUS, EquipPosition.FOOD);
        items[3].healthRestored = 12;
        itemNFT.addItems(items);
    }

    function _setupBasicCooking(
        uint8 successPercent,
        uint256 minLevel
    ) private returns (QueuedActionInput memory queuedAction, uint256 rate, uint16 choiceId) {
        rate = 100 * RATE_MUL; // per hour

        ActionInput[] memory actions = new ActionInput[](1);
        actions[0].actionId = 1;
        actions[0].info = _actionInfo(Skill.COOKING, 0, 0, true, NONE, NONE);
        worldActions.addActions(actions);

        // Food goes in, cooked food comes out
        ActionChoiceInput memory choice = _defaultActionChoice();
        choice.skill = uint8(Skill.COOKING);
        choice.xpPerHour = 3600;
        choice.rate = uint24(rate);
        choice.inputTokenIds = _uint16s(RAW_MINNUS);
        choice.inputAmounts = _uint24s(1);
        choice.outputTokenId = COOKED_MINNUS;
        choice.outputAmount = 1;
        choice.successPercent = successPercent;
        if (minLevel > 1) {
            choice.skills = new uint8[](1);
            choice.skills[0] = uint8(Skill.COOKING);
            choice.skillMinXPs = new uint32[](1);
            choice.skillMinXPs[0] = uint32(_xpAtLevel(minLevel));
            choice.skillDiffs = new int16[](1);
        }
        ActionChoiceInput[] memory choices = new ActionChoiceInput[](1);
        choices[0] = choice;
        worldActions.addActionChoices(1, _uint16s(1), choices);
        choiceId = 1;

        queuedAction = _queuedAction(1, choiceId, 0, 3600, CombatStyle.NONE);

        ItemInput[] memory items = new ItemInput[](2);
        items[0] = _defaultItem(RAW_MINNUS, EquipPosition.AUX);
        items[1] = _defaultItem(COOKED_MINNUS, EquipPosition.FOOD);
        items[1].healthRestored = 1;
        itemNFT.addItems(items);

        itemNFT.mint(ALICE, RAW_MINNUS, 1000);
    }

    function _setupBasicAlchemy(
        uint256 rate,
        uint256 outputAmount
    ) private returns (QueuedActionInput memory queuedAction, uint256) {
        ActionInput[] memory actions = new ActionInput[](1);
        actions[0].actionId = 1;
        actions[0].info = _actionInfo(Skill.ALCHEMY, 0, 0, true, NONE, NONE);
        worldActions.addActions(actions);

        // Scrolls go in, ancient scrolls come out
        ActionChoiceInput memory choice = _defaultActionChoice();
        choice.skill = uint8(Skill.ALCHEMY);
        choice.xpPerHour = 3600;
        choice.rate = uint24(rate);
        choice.inputTokenIds = _uint16s(SHADOW_SCROLL, NATURE_SCROLL, PAPER);
        choice.inputAmounts = _uint24s(1, 1, 2);
        choice.outputTokenId = ANCIENT_SCROLL;
        choice.outputAmount = uint8(outputAmount);
        ActionChoiceInput[] memory choices = new ActionChoiceInput[](1);
        choices[0] = choice;
        worldActions.addActionChoices(1, _uint16s(1), choices);

        queuedAction = _queuedAction(1, 1, 0, 3600, CombatStyle.NONE);

        ItemInput[] memory items = new ItemInput[](4);
        items[0] = _defaultItem(SHADOW_SCROLL, EquipPosition.NONE);
        items[1] = _defaultItem(NATURE_SCROLL, EquipPosition.NONE);
        items[2] = _defaultItem(PAPER, EquipPosition.NONE);
        items[3] = _defaultItem(ANCIENT_SCROLL, EquipPosition.NONE);
        itemNFT.addItems(items);
    }

    function _setupBasicFarming(
        uint256 rate,
        uint256 outputAmount
    ) private returns (QueuedActionInput memory queuedAction, uint256) {
        ActionInput[] memory actions = new ActionInput[](1);
        actions[0].actionId = 1;
        actions[0].info = _actionInfo(Skill.FARMING, 0, 0, true, NONE, NONE);
        worldActions.addActions(actions);

        ActionChoiceInput memory choice = _defaultActionChoice();
        choice.skill = uint8(Skill.FARMING);
        choice.xpPerHour = 3600;
        choice.rate = uint24(rate);
        choice.inputTokenIds = _uint16s(PLOT_001_SMALL, SEED_001_WILD);
        choice.inputAmounts = _uint24s(1, 20);
        choice.outputTokenId = SEED_001_WILD_HARVESTABLE;
        choice.outputAmount = uint8(outputAmount);
        ActionChoiceInput[] memory choices = new ActionChoiceInput[](1);
        choices[0] = choice;
        worldActions.addActionChoices(1, _uint16s(1), choices);

        uint24 timespan = uint24((3600 * RATE_MUL) / rate);
        queuedAction = _queuedAction(1, 1, 0, timespan, CombatStyle.NONE);

        ItemInput[] memory items = new ItemInput[](3);
        items[0] = _defaultItem(PLOT_001_SMALL, EquipPosition.NONE);
        items[1] = _defaultItem(SEED_001_WILD, EquipPosition.NONE);
        items[2] = _defaultItem(SEED_001_WILD_HARVESTABLE, EquipPosition.NONE);
        itemNFT.addItems(items);
    }

    function _setupThieving(uint256 numHours, uint256 chance, uint8 amount)
        private
        returns (QueuedActionInput memory queuedAction)
    {
        ActionInput[] memory actions = new ActionInput[](1);
        actions[0].actionId = 1;
        actions[0].info = _actionInfo(Skill.THIEVING, 50, 0, false, NONE, NONE);
        actions[0].randomRewards = new RandomReward[](1);
        actions[0].randomRewards[0] = RandomReward(BRONZE_ARROW, uint16(chance), amount);
        worldActions.addActions(actions);

        queuedAction = _queuedAction(1, 0, 0, uint24(3600 * numHours), CombatStyle.NONE);
    }

    function _actionInfo(
        Skill skill,
        uint24 xpPerHour,
        uint32 minXP,
        bool actionChoiceRequired,
        uint16 handItemTokenIdRangeMin,
        uint16 handItemTokenIdRangeMax
    ) private pure returns (ActionInfo memory info) {
        info = ActionInfo({
            skill: uint8(skill),
            actionChoiceRequired: actionChoiceRequired,
            xpPerHour: xpPerHour,
            minXP: minXP,
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

    function _defaultActionChoice() private pure returns (ActionChoiceInput memory c) {
        c.successPercent = 100;
        c.isAvailable = true;
    }

    function _meleeChoice() private pure returns (ActionChoiceInput[] memory choices) {
        choices = new ActionChoiceInput[](1);
        choices[0] = _defaultActionChoice();
        choices[0].skill = uint8(Skill.MELEE);
    }

    function _defaultItem(uint16 tokenId, EquipPosition equipPosition) private pure returns (ItemInput memory item) {
        item.tokenId = tokenId;
        item.equipPosition = equipPosition;
        item.isTransferable = true;
        item.isAvailable = true;
        item.metadataURI = "TEST.json";
        item.name = "TEST";
    }

    function _queuedAction(
        uint16 actionId,
        uint16 choiceId,
        uint16 regenerateId,
        uint24 timespan,
        CombatStyle combatStyle
    ) private pure returns (QueuedActionInput memory q) {
        q.actionId = actionId;
        q.choiceId = choiceId;
        q.regenerateId = regenerateId;
        q.timespan = timespan;
        q.combatStyle = uint8(combatStyle);
    }

    function _queuedActions(QueuedActionInput memory a) private pure returns (QueuedActionInput[] memory out) {
        out = new QueuedActionInput[](1);
        out[0] = a;
    }

    function _queuedActions(QueuedActionInput memory a, QueuedActionInput memory b)
        private
        pure
        returns (QueuedActionInput[] memory out)
    {
        out = new QueuedActionInput[](2);
        out[0] = a;
        out[1] = b;
    }

    function _queuedActions(QueuedActionInput memory a, QueuedActionInput memory b, QueuedActionInput memory c)
        private
        pure
        returns (QueuedActionInput[] memory out)
    {
        out = new QueuedActionInput[](3);
        out[0] = a;
        out[1] = b;
        out[2] = c;
    }

    function _createClan() private {
        Clans.Tier[] memory tiers = new Clans.Tier[](1);
        tiers[0] = Clans.Tier(1, 3, 3, 16, 0, 0);
        clans.addTiers(tiers);
        vm.prank(ALICE);
        clans.createClan(playerId, "Clan name", "discord", "telegram", "twitter", 1, 1);
    }

    function _clanBoost(uint256 clanId) private view returns (StandardBoostInfo memory) {
        return IPlayersMisc1DelegateView(address(players)).getClanBoost(clanId);
    }

    function _globalBoost() private view returns (StandardBoostInfo memory) {
        return IPlayersMisc1DelegateView(address(players)).getGlobalBoost();
    }

    function _passNextCheckpointAndFulfill() private {
        uint256 nextCheckpoint = ((vm.getBlockTimestamp() / 1 days) + 1) * 1 days;
        vm.warp(nextCheckpoint + 1);
        _fulfillNextRandomWords();
        vm.warp(vm.getBlockTimestamp() + 1 days);
        _fulfillNextRandomWords();
    }

    function _fulfillNextRandomWords() private {
        randomnessBeacon.requestRandomWords();
        uint256 index = randomnessBeacon.NUM_DAYS_RANDOM_WORDS_INITIALIZED();
        while (true) {
            try randomnessBeacon.requestIds(index) returns (uint256 requestId) {
                if (randomnessBeacon.getRandomWords(requestId) == 0) {
                    mockVRF.fulfill(requestId, address(randomnessBeacon));
                    return;
                }
                ++index;
            } catch {
                revert("pending request not found");
            }
        }
    }

    function _countLogs(address emitter, bytes32 topic) private view returns (uint256 count) {
        Vm.Log[] memory logs = vm.getRecordedLogs();
        for (uint256 i; i < logs.length; ++i) {
            if (logs[i].emitter == emitter && logs[i].topics[0] == topic) ++count;
        }
    }

    function _uint24s(uint24 a, uint24 b) private pure returns (uint24[] memory values) {
        values = new uint24[](2);
        values[0] = a;
        values[1] = b;
    }

    function _uint256s(uint256 a) private pure returns (uint256[] memory values) {
        values = new uint256[](1);
        values[0] = a;
    }

    function _uint256s(uint256 a, uint256 b) private pure returns (uint256[] memory values) {
        values = new uint256[](2);
        values[0] = a;
        values[1] = b;
    }

    function _uint256s(uint256 a, uint256 b, uint256 c, uint256 d) private pure returns (uint256[] memory values) {
        values = new uint256[](4);
        values[0] = a;
        values[1] = b;
        values[2] = c;
        values[3] = d;
    }
}
