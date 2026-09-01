// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {FullGameStack} from "../utils/FullGameStack.sol";
import {PlayersImplMisc1 as IPlayersMisc1DelegateView} from "../interfaces/PlayersImplMisc1.sol";
import {Skill, Attire, CombatStyle} from "../../contracts/globals/misc.sol";
import {
    ActionInput,
    ActionInfo,
    ActionQueueStrategy,
    QueuedActionInput,
    GUAR_MUL,
    RATE_MUL
} from "../../contracts/globals/actions.sol";
import {
    ActionChoiceInput,
    ActivePlayerInfo,
    CheckpointEquipments,
    EquipPosition,
    FullAttireBonusInput,
    ItemInput,
    PendingQueuedActionState
} from "../../contracts/globals/players.sol";
import {GuaranteedReward, RandomReward} from "../../contracts/globals/rewards.sol";
import {
    NONE,
    BRONZE_AXE,
    BRONZE_PICKAXE,
    MAGIC_FIRE_STARTER,
    FIRE_MAX,
    NET_STICK
} from "../../contracts/globals/items.sol";

// Migrated from test/Players/Checkpoints.ts.
contract CheckpointsTest is FullGameStack {
    uint16 private constant NATURE_MASK = 10;
    uint16 private constant NATURE_BODY = 522;
    uint16 private constant NATURE_BRACERS = 778;
    uint16 private constant NATURE_TROUSERS = 1_034;
    uint16 private constant NATURE_BOOTS = 1_290;
    uint16 private constant NATUOW_HOOD = 8;
    uint16 private constant NATUOW_BODY = 520;
    uint16 private constant NATUOW_BRACERS = 776;
    uint16 private constant NATUOW_TASSETS = 1_032;
    uint16 private constant NATUOW_BOOTS = 1_288;
    uint16 private constant MINING_MAX = 2_815;
    uint16 private constant WOODCUTTING_MAX = 3_071;
    uint16 private constant FISHING_MAX = 3_327;
    uint16 private constant LOG = 10_496;
    uint16 private constant RAW_MINNUS = 10_752;
    uint16 private constant COPPER_ORE = 11_520;
    uint16 private constant BRONZE_ARROW = 11_776;

    uint16 private constant ACTION_WOODCUTTING_LOG = 1;
    uint16 private constant ACTION_MINING_COPPER = 500;
    uint16 private constant ACTION_FIREMAKING_ITEM = 1_000;
    uint16 private constant ACTION_FISHING_MINNUS = 1_500;
    uint256 private constant HAND_SLOT = 9;

    function setUp() public {
        deployFullGame();
    }

    function testCheckpointsClearedWhenPlayerBecomesInactive() public {
        QueuedActionInput memory action = _setupWoodcutting();
        _start(_actions(action), ActionQueueStrategy.OVERWRITE);
        assertGt(players.getActivePlayerInfo(ALICE).checkpoint, 0);

        _createPlayer(ALICE, 1, "New name", true);
        assertEq(players.getActivePlayerInfo(ALICE).checkpoint, 0);
    }

    function testTransferRequiredEquipmentDuringActionInvalidatesWholeAction() public {
        QueuedActionInput memory action = _setupWoodcutting();
        _start(_actions(action), ActionQueueStrategy.OVERWRITE);
        _assertCheckpoint(0, BRONZE_AXE, 1);

        _transfer(BRONZE_AXE, 1);
        vm.warp(block.timestamp + action.timespan);
        itemNFT.mint(ALICE, BRONZE_AXE, 1);
        _assertCheckpoint(0, BRONZE_AXE, 0);
        _process();

        assertEq(players.getPlayerXP(playerId, Skill.WOODCUTTING), 0);
    }

    function testTransferRequiredEquipmentAfterPartialProcessInvalidatesRemainder() public {
        QueuedActionInput memory action = _setupWoodcutting();
        _start(_actions(action), ActionQueueStrategy.OVERWRITE);
        vm.warp(block.timestamp + action.timespan / 2);
        _process();
        assertEq(players.getPlayerXP(playerId, Skill.WOODCUTTING), action.timespan / 2);

        _transfer(BRONZE_AXE, 1);
        itemNFT.mint(ALICE, BRONZE_AXE, 1);
        vm.warp(block.timestamp + action.timespan / 2);
        _process();

        assertEq(players.getPlayerXP(playerId, Skill.WOODCUTTING), action.timespan / 2);
    }

    function testTransferRequiredEquipmentAfterPartialProcessKeepsRemainderWhenOneRemains() public {
        QueuedActionInput memory action = _setupWoodcutting();
        _start(_actions(action), ActionQueueStrategy.OVERWRITE);
        vm.warp(block.timestamp + action.timespan / 2);
        _process();

        itemNFT.mint(ALICE, BRONZE_AXE, 2);
        _transfer(BRONZE_AXE, 2);
        itemNFT.mint(ALICE, BRONZE_AXE, 1);
        vm.warp(block.timestamp + action.timespan / 2);
        _process();

        assertEq(players.getPlayerXP(playerId, Skill.WOODCUTTING), action.timespan);
    }

    function testTransferCheckpointBalanceStillValidWhenExtraWasTransferredEarlier() public {
        QueuedActionInput memory action = _setupWoodcutting();
        _start(_actions(action), ActionQueueStrategy.OVERWRITE);
        vm.warp(block.timestamp + action.timespan / 2);
        itemNFT.mint(ALICE, BRONZE_AXE, 1);
        _transfer(BRONZE_AXE, 1);
        vm.warp(block.timestamp + action.timespan / 2);
        _process();

        assertEq(players.getPlayerXP(playerId, Skill.WOODCUTTING), action.timespan);
    }

    function testEquipmentRestoredAfterNextActionStartsDoesNotRestoreAction() public {
        QueuedActionInput memory action = _setupWoodcutting();
        _start(_actions(action, action), ActionQueueStrategy.OVERWRITE);
        vm.warp(block.timestamp + action.timespan - 2);
        _process();
        uint256 earned = players.getPlayerXP(playerId, Skill.WOODCUTTING);

        _transfer(BRONZE_AXE, 1);
        vm.warp(block.timestamp + action.timespan / 2);
        itemNFT.mint(ALICE, BRONZE_AXE, 1);
        vm.warp(block.timestamp + action.timespan);
        _process();

        assertEq(players.getPlayerXP(playerId, Skill.WOODCUTTING), earned);
    }

    function testEquipmentRestoredBeforeNextActionStartsKeepsActionValid() public {
        QueuedActionInput memory action = _setupWoodcutting();
        _start(_actions(action, action), ActionQueueStrategy.OVERWRITE);
        vm.warp(block.timestamp + action.timespan - 3);
        _process();
        uint256 firstActionXP = players.getPlayerXP(playerId, Skill.WOODCUTTING);

        _transfer(BRONZE_AXE, 1);
        _assertCheckpoint(0, BRONZE_AXE, 0);
        _assertCheckpoint(1, BRONZE_AXE, 0);
        itemNFT.mint(ALICE, BRONZE_AXE, 1);
        _assertCheckpoint(0, BRONZE_AXE, 0);
        _assertCheckpoint(1, BRONZE_AXE, 1);

        vm.warp(block.timestamp + action.timespan * 2 + 3);
        _process();
        assertEq(players.getPlayerXP(playerId, Skill.WOODCUTTING), firstActionXP + action.timespan);
    }

    function testMultipleBurnsAndTransfersUpdateCheckpoint() public {
        QueuedActionInput memory firemaking = _setupFiremaking();
        QueuedActionInput memory woodcutting = _setupWoodcutting();
        itemNFT.mint(ALICE, BRONZE_AXE, 100);
        _start(_actions(firemaking, woodcutting), ActionQueueStrategy.OVERWRITE);

        _burn(BRONZE_AXE, 80);
        _burn(BRONZE_AXE, 5);
        vm.warp(block.timestamp + firemaking.timespan / 2);
        _process();
        _transfer(BRONZE_AXE, 5);
        vm.warp(block.timestamp + firemaking.timespan / 4);
        _burn(BRONZE_AXE, 5);
        _burn(BRONZE_AXE, 5);
        assertEq(itemNFT.balanceOf(ALICE, BRONZE_AXE), 1);

        vm.warp(block.timestamp + firemaking.timespan / 4 + woodcutting.timespan);
        _process();
        assertEq(players.getPlayerXP(playerId, Skill.WOODCUTTING), woodcutting.timespan);
    }

    function testBalanceAboveUint16ReducedBeforeActionStarts() public {
        QueuedActionInput memory firemaking = _setupFiremaking();
        QueuedActionInput memory woodcutting = _setupWoodcutting();
        itemNFT.mint(ALICE, BRONZE_AXE, 70_000);
        _start(_actions(firemaking, woodcutting), ActionQueueStrategy.OVERWRITE);

        vm.warp(block.timestamp + firemaking.timespan - 3);
        _transfer(BRONZE_AXE, 70_000);
        assertEq(itemNFT.balanceOf(ALICE, BRONZE_AXE), 1);
        vm.warp(block.timestamp + 3 + woodcutting.timespan);
        _process();

        assertEq(players.getPlayerXP(playerId, Skill.WOODCUTTING), woodcutting.timespan);
    }

    function testBalanceAboveUint16ReducedDuringAction() public {
        QueuedActionInput memory action = _setupWoodcutting();
        itemNFT.mint(ALICE, BRONZE_AXE, 70_000);
        _start(_actions(action), ActionQueueStrategy.OVERWRITE);

        vm.warp(block.timestamp + action.timespan / 2);
        _transfer(BRONZE_AXE, 40_000);
        _transfer(BRONZE_AXE, 29_000);
        _burn(BRONZE_AXE, 999);
        assertEq(itemNFT.balanceOf(ALICE, BRONZE_AXE), 2);
        vm.warp(block.timestamp + action.timespan);
        _process();

        assertEq(players.getPlayerXP(playerId, Skill.WOODCUTTING), action.timespan);
    }

    function testRemovingFullAttireInvalidatesBonusEvenWhenItemIsReminted() public {
        QueuedActionInput memory action = _setupWoodcutting();
        _addAttireItems(NATURE_MASK, NATURE_BODY, NATURE_BRACERS, NATURE_TROUSERS, NATURE_BOOTS);
        _addAttireBonus(
            Skill.WOODCUTTING, NATURE_MASK, NATURE_BODY, NATURE_BRACERS, NATURE_TROUSERS, NATURE_BOOTS, 3, 0
        );
        action.attire =
            Attire(NATURE_MASK, NONE, NATURE_BODY, NATURE_BRACERS, NATURE_TROUSERS, NATURE_BOOTS, NONE, NONE);
        itemNFT.mintBatch(
            ALICE,
            _uints5(NATURE_MASK, NATURE_BODY, NATURE_BRACERS, NATURE_TROUSERS, NATURE_BOOTS),
            _uints5(1, 1, 1, 1, 1)
        );
        _start(_actions(action), ActionQueueStrategy.OVERWRITE);

        // Foundry does not advance time between transactions as Hardhat does.
        vm.warp(vm.getBlockTimestamp() + 1);
        _burn(NATURE_MASK, 1);
        itemNFT.mint(ALICE, NATURE_MASK, 1);
        vm.warp(vm.getBlockTimestamp() + action.timespan);
        _process();

        assertEq(players.getPlayerXP(playerId, Skill.WOODCUTTING), action.timespan);
        assertEq(itemNFT.balanceOf(ALICE, LOG), (action.timespan * 100 * GUAR_MUL) / (3600 * GUAR_MUL));
    }

    function testRemovingFullAttireInvalidatesPendingRandomRewardBonus() public {
        RandomReward[] memory rewards = new RandomReward[](1);
        rewards[0] = RandomReward(BRONZE_ARROW, 655, 1);
        QueuedActionInput memory action = _setupThieving(50, rewards, 2 hours);
        _addAttireItems(NATUOW_HOOD, NATUOW_BODY, NATUOW_BRACERS, NATUOW_TASSETS, NATUOW_BOOTS);
        _addAttireBonus(Skill.THIEVING, NATUOW_HOOD, NATUOW_BODY, NATUOW_BRACERS, NATUOW_TASSETS, NATUOW_BOOTS, 3, 100);
        action.attire = Attire(NATUOW_HOOD, NONE, NATUOW_BODY, NATUOW_BRACERS, NATUOW_TASSETS, NATUOW_BOOTS, NONE, NONE);
        itemNFT.mintBatch(
            ALICE,
            _uints5(NATUOW_HOOD, NATUOW_BODY, NATUOW_BRACERS, NATUOW_TASSETS, NATUOW_BOOTS),
            _uints5(1, 1, 1, 1, 1)
        );

        _warpToNextCheckpoint();
        _requestAndFulfill();
        vm.warp(vm.getBlockTimestamp() + 1 days);
        _requestAndFulfill();
        for (uint256 i; i < 10; ++i) {
            _start(_actions(action), ActionQueueStrategy.OVERWRITE);
            vm.warp(vm.getBlockTimestamp() + 1);
            _burn(NATUOW_HOOD, 1);
            itemNFT.mint(ALICE, NATUOW_HOOD, 1);
            vm.warp(vm.getBlockTimestamp() + 1 days);
            _requestAndFulfill();
            _process();
        }
        vm.warp(vm.getBlockTimestamp() + 1 days);
        _requestAndFulfill();
        _process();

        assertEq(players.getPlayerXP(playerId, Skill.THIEVING), 1_000);
        assertEq(itemNFT.balanceOf(ALICE, BRONZE_ARROW), 0);
    }

    function testActionOutputCanSupplyNextActionAfterIntermediateProcess() public {
        QueuedActionInput memory woodcutting = _setupWoodcutting();
        QueuedActionInput memory firemaking = _setupFiremaking();
        _start(_actions(woodcutting, firemaking), ActionQueueStrategy.OVERWRITE);
        _assertCheckpointToken(0, BRONZE_AXE);
        _assertCheckpointToken(1, MAGIC_FIRE_STARTER);

        vm.warp(block.timestamp + woodcutting.timespan + firemaking.timespan / 2);
        _process();
        _assertCheckpointToken(0, MAGIC_FIRE_STARTER);
        _assertCheckpointToken(1, NONE);
        vm.warp(block.timestamp + firemaking.timespan / 2);
        _process();

        assertEq(players.getPlayerXP(playerId, Skill.WOODCUTTING), woodcutting.timespan);
        assertEq(players.getPlayerXP(playerId, Skill.FIREMAKING), firemaking.timespan);
    }

    function testActionOutputCanSupplyNextActionWithoutIntermediateProcess() public {
        QueuedActionInput memory woodcutting = _setupWoodcutting();
        QueuedActionInput memory firemaking = _setupFiremaking();
        _start(_actions(woodcutting, firemaking), ActionQueueStrategy.OVERWRITE);
        vm.warp(block.timestamp + woodcutting.timespan + firemaking.timespan);
        _process();

        assertEq(players.getPlayerXP(playerId, Skill.WOODCUTTING), woodcutting.timespan);
        assertEq(players.getPlayerXP(playerId, Skill.FIREMAKING), firemaking.timespan);
    }

    function testMultipleCheckpointMetadataTracksQueueMutations() public {
        QueuedActionInput memory full = _setupWoodcutting();
        QueuedActionInput memory half = full;
        half.timespan /= 2;
        QueuedActionInput memory quarter = full;
        quarter.timespan /= 4;
        _start(_actions(full, half, quarter), ActionQueueStrategy.OVERWRITE);
        uint256 startedAt = players.getActivePlayerInfo(ALICE).checkpoint;
        _assertActiveInfo(startedAt, full.timespan, half.timespan, quarter.timespan);

        _process();
        _assertActiveInfo(startedAt, full.timespan, half.timespan, quarter.timespan);
        vm.warp(vm.getBlockTimestamp() + full.timespan / 2);
        _process();
        _assertActiveInfo(startedAt, full.timespan, half.timespan, quarter.timespan);
        vm.warp(vm.getBlockTimestamp() + full.timespan / 2 + 2);
        _process();
        _assertActiveInfo(startedAt + full.timespan, half.timespan, quarter.timespan, quarter.timespan);

        _start(_actions(full), ActionQueueStrategy.APPEND);
        _assertActiveInfo(startedAt + full.timespan, half.timespan, quarter.timespan, full.timespan);
        _start(_actions(full), ActionQueueStrategy.KEEP_LAST_IN_PROGRESS);
        _assertActiveInfo(startedAt + full.timespan, half.timespan, full.timespan, full.timespan);
        _start(_actions(full), ActionQueueStrategy.OVERWRITE);
        _assertActiveInfo(vm.getBlockTimestamp(), full.timespan, full.timespan, full.timespan);
    }

    function testCheckpointAdvancesToNextActionStart() public {
        QueuedActionInput memory action = _setupWoodcutting();
        _start(_actions(action), ActionQueueStrategy.OVERWRITE);
        uint256 checkpoint = players.getActivePlayerInfo(ALICE).checkpoint;
        vm.warp(block.timestamp + action.timespan);
        _process();
        assertGt(players.getActivePlayerInfo(ALICE).checkpoint, checkpoint);
    }

    function testTwoActionsKeepLastJustAfterFirstActionBoundary() public {
        _testTwoActionKeepLast(true);
    }

    function testTwoActionsKeepLastAtFirstActionBoundary() public {
        _testTwoActionKeepLast(false);
    }

    function testKeepLastAfterFirstActionBoundary() public {
        _testRequeue(ActionQueueStrategy.KEEP_LAST_IN_PROGRESS, false, false, false);
    }

    function testKeepLastJustAfterFirstActionBoundary() public {
        _testRequeue(ActionQueueStrategy.KEEP_LAST_IN_PROGRESS, false, true, false);
    }

    function testKeepLastAfterSecondActionBoundary() public {
        _testRequeue(ActionQueueStrategy.KEEP_LAST_IN_PROGRESS, true, false, false);
    }

    function testKeepLastJustAfterSecondActionBoundary() public {
        _testRequeue(ActionQueueStrategy.KEEP_LAST_IN_PROGRESS, true, true, false);
    }

    function testKeepLastRemovesInvalidMiddleAction() public {
        _testRequeue(ActionQueueStrategy.KEEP_LAST_IN_PROGRESS, false, true, true);
    }

    function testAppendAfterFirstActionBoundary() public {
        _testRequeue(ActionQueueStrategy.APPEND, false, false, false);
    }

    function testAppendJustAfterFirstActionBoundary() public {
        _testRequeue(ActionQueueStrategy.APPEND, false, true, false);
    }

    function testAppendAfterSecondActionBoundary() public {
        _testRequeue(ActionQueueStrategy.APPEND, true, false, false);
    }

    function testAppendJustAfterSecondActionBoundary() public {
        _testRequeue(ActionQueueStrategy.APPEND, true, true, false);
    }

    function testAppendRemovesInvalidMiddleAction() public {
        _testRequeue(ActionQueueStrategy.APPEND, false, true, true);
    }

    function testProcessAfterFirstActionBoundary() public {
        _testProcessCheckpoints(false, false, NONE);
    }

    function testProcessJustAfterFirstActionBoundary() public {
        _testProcessCheckpoints(false, true, NONE);
    }

    function testProcessAfterSecondActionBoundary() public {
        _testProcessCheckpoints(true, false, NONE);
    }

    function testProcessJustAfterSecondActionBoundary() public {
        _testProcessCheckpoints(true, true, NONE);
    }

    function testProcessBeforeInvalidMiddleActionStartsRemovesIt() public {
        _testProcessCheckpoints(false, false, BRONZE_AXE);
    }

    function testProcessDuringInvalidMiddleActionRemovesIt() public {
        _testProcessCheckpoints(false, true, BRONZE_AXE);
    }

    function testProcessBeforeInvalidLastActionKeepsZeroBalanceCheckpoint() public {
        _testProcessCheckpoints(false, false, BRONZE_PICKAXE);
    }

    function _testTwoActionKeepLast(bool justAfter) private {
        QueuedActionInput memory fishing = _setupFishing();
        QueuedActionInput memory woodcutting = _setupWoodcutting();
        if (!justAfter) itemNFT.mint(ALICE, BRONZE_AXE, 1);
        _start(_actions(fishing, woodcutting), ActionQueueStrategy.OVERWRITE);
        vm.warp(block.timestamp + fishing.timespan + (justAfter ? 2 : 0));

        _assertCheckpointTokens(NET_STICK, BRONZE_AXE, NONE);
        if (!justAfter) {
            _assertCheckpoint(0, NET_STICK, 1);
            _assertCheckpoint(1, BRONZE_AXE, 2);
        }
        _start(_actions(fishing), ActionQueueStrategy.KEEP_LAST_IN_PROGRESS);
        _assertCheckpointTokens(BRONZE_AXE, NET_STICK, NONE);
        if (!justAfter) {
            _assertCheckpoint(0, BRONZE_AXE, 2);
            _assertCheckpoint(1, NET_STICK, 1);
        }

        vm.warp(block.timestamp + woodcutting.timespan);
        PendingQueuedActionState memory pending = players.getPendingQueuedActionState(ALICE, playerId);
        assertGt(pending.equipmentStates.length, 0);
        assertGt(pending.equipmentStates[0].producedItemTokenIds.length, 0);
    }

    function _testRequeue(ActionQueueStrategy strategy, bool afterSecond, bool justAfter, bool invalidMiddle) private {
        (QueuedActionInput memory fishing, QueuedActionInput memory woodcutting, QueuedActionInput memory mining) =
            _setupGatheringActions();
        _start(_actions(fishing, woodcutting, mining), ActionQueueStrategy.OVERWRITE);
        if (invalidMiddle) _burn(BRONZE_AXE, 1);
        uint256 elapsed = fishing.timespan + (afterSecond ? woodcutting.timespan : 0) + (justAfter ? 2 : 0);
        vm.warp(block.timestamp + elapsed);
        _assertCheckpointTokens(NET_STICK, BRONZE_AXE, BRONZE_PICKAXE);

        QueuedActionInput[] memory additions;
        if (invalidMiddle) additions = _actions(mining, fishing);
        else if (afterSecond) additions = _actions(fishing, woodcutting);
        else if (strategy == ActionQueueStrategy.APPEND) additions = _actions(fishing);
        else additions = _actions(mining, fishing);
        _start(additions, strategy);

        if (invalidMiddle) _assertCheckpointTokens(BRONZE_PICKAXE, BRONZE_PICKAXE, NET_STICK);
        else if (afterSecond) _assertCheckpointTokens(BRONZE_PICKAXE, NET_STICK, BRONZE_AXE);
        else _assertCheckpointTokens(BRONZE_AXE, BRONZE_PICKAXE, NET_STICK);

        if (!invalidMiddle) {
            vm.warp(block.timestamp + woodcutting.timespan);
            PendingQueuedActionState memory pending = players.getPendingQueuedActionState(ALICE, playerId);
            assertGt(pending.equipmentStates.length, 0);
            assertGt(pending.equipmentStates[0].producedItemTokenIds.length, 0);
        }
    }

    function _testProcessCheckpoints(bool afterSecond, bool justAfter, uint16 burnedItem) private {
        (QueuedActionInput memory fishing, QueuedActionInput memory woodcutting, QueuedActionInput memory mining) =
            _setupGatheringActions();
        _start(_actions(fishing, woodcutting, mining), ActionQueueStrategy.OVERWRITE);
        if (burnedItem != NONE) _burn(burnedItem, 1);
        uint256 elapsed = fishing.timespan + (afterSecond ? woodcutting.timespan : 0) + (justAfter ? 1 : 0);
        if (burnedItem == BRONZE_PICKAXE) elapsed = fishing.timespan - 10;
        // Hardhat mined the process transaction one block after the time-travel boundary.
        else if (burnedItem == BRONZE_AXE && !justAfter) elapsed = fishing.timespan + 1;
        vm.warp(block.timestamp + elapsed);
        _assertCheckpointTokens(NET_STICK, BRONZE_AXE, BRONZE_PICKAXE);
        _process();

        if (burnedItem == BRONZE_PICKAXE) {
            _assertCheckpointTokens(NET_STICK, BRONZE_AXE, BRONZE_PICKAXE);
            _assertCheckpoint(2, BRONZE_PICKAXE, 0);
        } else if (afterSecond || burnedItem == BRONZE_AXE) {
            _assertCheckpointTokens(BRONZE_PICKAXE, NONE, NONE);
        } else {
            _assertCheckpointTokens(BRONZE_AXE, BRONZE_PICKAXE, NONE);
        }
    }

    function _setupGatheringActions()
        private
        returns (
            QueuedActionInput memory fishing,
            QueuedActionInput memory woodcutting,
            QueuedActionInput memory mining
        )
    {
        fishing = _setupFishing();
        woodcutting = _setupWoodcutting();
        mining = _setupMining();
    }

    function _setupWoodcutting() private returns (QueuedActionInput memory action) {
        action = _setupGatheringAction(ACTION_WOODCUTTING_LOG, Skill.WOODCUTTING, BRONZE_AXE, WOODCUTTING_MAX, LOG);
    }

    function _setupFishing() private returns (QueuedActionInput memory action) {
        action = _setupGatheringAction(ACTION_FISHING_MINNUS, Skill.FISHING, NET_STICK, FISHING_MAX, RAW_MINNUS);
    }

    function _setupMining() private returns (QueuedActionInput memory action) {
        action = _setupGatheringAction(ACTION_MINING_COPPER, Skill.MINING, BRONZE_PICKAXE, MINING_MAX, COPPER_ORE);
    }

    function _setupGatheringAction(uint16 actionId, Skill skill, uint16 handItem, uint16 handMax, uint16 reward)
        private
        returns (QueuedActionInput memory queuedAction)
    {
        ActionInput memory action;
        action.actionId = actionId;
        action.info = _actionInfo(skill, 3600, false, handItem, handMax, 100);
        action.guaranteedRewards = new GuaranteedReward[](1);
        action.guaranteedRewards[0] = GuaranteedReward(reward, uint16(100 * GUAR_MUL));
        _addAction(action);
        _addItem(handItem, EquipPosition.RIGHT_HAND);
        queuedAction = _queuedAction(actionId, 0, 3600);
        queuedAction.rightHandEquipmentTokenId = handItem;
    }

    function _setupFiremaking() private returns (QueuedActionInput memory queuedAction) {
        ActionInput memory action;
        action.actionId = ACTION_FIREMAKING_ITEM;
        action.info = _actionInfo(Skill.FIREMAKING, 0, true, MAGIC_FIRE_STARTER, FIRE_MAX, 100);
        _addAction(action);
        ActionChoiceInput memory choice = _defaultActionChoice();
        choice.skill = uint8(Skill.FIREMAKING);
        choice.xpPerHour = 3600;
        choice.rate = uint24(100 * RATE_MUL);
        choice.inputTokenIds = _uint16s(LOG);
        choice.inputAmounts = _uint24s(1);
        worldActions.addActionChoices(ACTION_FIREMAKING_ITEM, _uint16s(1), _choices(choice));
        _addItem(MAGIC_FIRE_STARTER, EquipPosition.RIGHT_HAND);
        _addItem(LOG, EquipPosition.AUX);
        itemNFT.mint(ALICE, LOG, 5_000);
        queuedAction = _queuedAction(ACTION_FIREMAKING_ITEM, 1, 3600);
        queuedAction.rightHandEquipmentTokenId = MAGIC_FIRE_STARTER;
    }

    function _setupThieving(uint24 xpPerHour, RandomReward[] memory rewards, uint24 timespan)
        private
        returns (QueuedActionInput memory queuedAction)
    {
        ActionInput memory action;
        action.actionId = 2_000;
        action.info = _actionInfo(Skill.THIEVING, xpPerHour, false, NONE, NONE, 0);
        action.randomRewards = rewards;
        _addAction(action);
        queuedAction = _queuedAction(action.actionId, 0, timespan);
    }

    function _actionInfo(
        Skill skill,
        uint24 xpPerHour,
        bool actionChoiceRequired,
        uint16 handItemMin,
        uint16 handItemMax,
        uint8 successPercent
    ) private pure returns (ActionInfo memory info) {
        info = ActionInfo({
            skill: uint8(skill),
            actionChoiceRequired: actionChoiceRequired,
            xpPerHour: xpPerHour,
            minXP: 0,
            numSpawned: 0,
            handItemTokenIdRangeMin: handItemMin,
            handItemTokenIdRangeMax: handItemMax,
            successPercent: successPercent,
            worldLocation: 0,
            isFullModeOnly: false,
            isAvailable: true,
            questPrerequisiteId: 0
        });
    }

    function _defaultActionChoice() private pure returns (ActionChoiceInput memory choice) {
        choice.successPercent = 100;
        choice.isAvailable = true;
    }

    function _queuedAction(uint16 actionId, uint16 choiceId, uint24 timespan)
        private
        pure
        returns (QueuedActionInput memory action)
    {
        action.actionId = actionId;
        action.choiceId = choiceId;
        action.timespan = timespan;
        action.combatStyle = uint8(CombatStyle.NONE);
    }

    function _addAction(ActionInput memory action) private {
        ActionInput[] memory actions = new ActionInput[](1);
        actions[0] = action;
        worldActions.addActions(actions);
    }

    function _addItem(uint16 tokenId, EquipPosition position) private {
        ItemInput[] memory items = new ItemInput[](1);
        items[0].tokenId = tokenId;
        items[0].equipPosition = position;
        items[0].isTransferable = true;
        items[0].isAvailable = true;
        items[0].metadataURI = "TEST.json";
        items[0].name = "TEST";
        itemNFT.addItems(items);
    }

    function _addAttireItems(uint16 head, uint16 body, uint16 arms, uint16 legs, uint16 feet) private {
        _addItem(head, EquipPosition.HEAD);
        _addItem(body, EquipPosition.BODY);
        _addItem(arms, EquipPosition.ARMS);
        _addItem(legs, EquipPosition.LEGS);
        _addItem(feet, EquipPosition.FEET);
    }

    function _addAttireBonus(
        Skill skill,
        uint16 head,
        uint16 body,
        uint16 arms,
        uint16 legs,
        uint16 feet,
        uint8 xpPercent,
        uint8 rewardPercent
    ) private {
        FullAttireBonusInput[] memory bonuses = new FullAttireBonusInput[](1);
        bonuses[0].skill = skill;
        bonuses[0].bonusXPPercent = xpPercent;
        bonuses[0].bonusRewardsPercent = rewardPercent;
        bonuses[0].itemTokenIds = [head, body, arms, legs, feet];
        players.addFullAttireBonuses(bonuses);
    }

    function _start(QueuedActionInput[] memory actions, ActionQueueStrategy strategy) private {
        vm.prank(ALICE);
        players.startActions(playerId, actions, strategy);
    }

    function _process() private {
        vm.prank(ALICE);
        players.processActions(playerId);
    }

    function _burn(uint16 tokenId, uint256 amount) private {
        vm.prank(ALICE);
        itemNFT.burn(ALICE, tokenId, amount);
    }

    function _transfer(uint16 tokenId, uint256 amount) private {
        vm.prank(ALICE);
        itemNFT.safeTransferFrom(ALICE, address(this), tokenId, amount, "");
    }

    function _checkpoints() private view returns (CheckpointEquipments[3] memory) {
        return IPlayersMisc1DelegateView(address(players)).getCheckpointEquipments(playerId);
    }

    function _assertCheckpoint(uint256 index, uint16 tokenId, uint256 balance) private view {
        CheckpointEquipments[3] memory checkpoints = _checkpoints();
        assertEq(checkpoints[index].itemTokenIds[HAND_SLOT], tokenId);
        assertEq(checkpoints[index].balances[HAND_SLOT], balance);
    }

    function _assertCheckpointToken(uint256 index, uint16 tokenId) private view {
        assertEq(_checkpoints()[index].itemTokenIds[HAND_SLOT], tokenId);
    }

    function _assertCheckpointTokens(uint16 first, uint16 second, uint16 third) private view {
        CheckpointEquipments[3] memory checkpoints = _checkpoints();
        assertEq(checkpoints[0].itemTokenIds[HAND_SLOT], first);
        assertEq(checkpoints[1].itemTokenIds[HAND_SLOT], second);
        assertEq(checkpoints[2].itemTokenIds[HAND_SLOT], third);
    }

    function _assertActiveInfo(uint256 checkpoint, uint256 first, uint256 second, uint256 third) private view {
        ActivePlayerInfo memory info = players.getActivePlayerInfo(ALICE);
        assertEq(info.checkpoint, checkpoint);
        assertEq(info.timespan, first);
        assertEq(info.timespan1, second);
        assertEq(info.timespan2, third);
    }

    function _warpToNextCheckpoint() private {
        vm.warp(((block.timestamp / 1 days) + 1) * 1 days + 1);
    }

    function _requestAndFulfill() private {
        uint256 requestId = randomnessBeacon.requestRandomWords();
        mockVRF.fulfill(requestId, address(randomnessBeacon));
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

    function _uints5(uint256 a, uint256 b, uint256 c, uint256 d, uint256 e)
        private
        pure
        returns (uint256[] memory values)
    {
        values = new uint256[](5);
        values[0] = a;
        values[1] = b;
        values[2] = c;
        values[3] = d;
        values[4] = e;
    }
}
