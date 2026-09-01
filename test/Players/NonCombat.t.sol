// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {FullGameStack} from "../utils/FullGameStack.sol";
import {IPlayersBase as PlayersBase} from "../../contracts/interfaces/IPlayersBase.sol";
import {Skill, Attire, CombatStyle, BoostType, Equipment} from "../../contracts/globals/misc.sol";
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
    SKILL_BOOST,
    SHADOW_SCROLL
} from "../../contracts/globals/items.sol";

// Migrated from test/Players/NonCombat.ts.
contract NonCombatTest is FullGameStack {
    // Item ids mirror @paintswap/estfor-definitions/src/constants.ts. Constants already exposed by
    // contracts/globals/items.sol are imported above instead of being duplicated here.
    uint16 private constant BRONZE_HELMET = 1;
    uint16 private constant NATUOW_HOOD = 8;
    uint16 private constant NATURE_MASK = 10;
    uint16 private constant SAPPHIRE_AMULET = 257;
    uint16 private constant NATUOW_BODY = 520;
    uint16 private constant NATURE_BODY = 522;
    uint16 private constant NATUOW_BRACERS = 776;
    uint16 private constant NATURE_BRACERS = 778;
    uint16 private constant NATUOW_TASSETS = 1032;
    uint16 private constant NATURE_TROUSERS = 1034;
    uint16 private constant NATUOW_BOOTS = 1288;
    uint16 private constant NATURE_BOOTS = 1290;
    uint16 private constant WOODCUTTING_MAX = 3071;
    uint16 private constant MINING_MAX = 2815;
    uint16 private constant MITHRIL_BAR = 10_242;
    uint16 private constant LOG = 10_496;
    uint16 private constant OAK_LOG = 10_497;
    uint16 private constant RAW_MINNUS = 10_752;
    uint16 private constant COOKED_MINNUS = 11_008;
    uint16 private constant COPPER_ORE = 11_520;
    uint16 private constant SAPPHIRE = 11_523;
    uint16 private constant COAL_ORE = 11_524;
    uint16 private constant MITHRIL_ORE = 11_526;
    uint16 private constant BRONZE_ARROW = 11_776;
    uint16 private constant NATURE_SCROLL = 12_033;
    uint16 private constant ANCIENT_SCROLL = 12_039;
    uint16 private constant PLOT_001_SMALL = 14_656;
    uint16 private constant SEED_001_WILD = 14_688;
    uint16 private constant SEED_001_WILD_HARVESTABLE = 14_944;
    uint16 private constant ROPE = 65_523;
    uint16 private constant FEATHER = 65_515;
    uint16 private constant PAPER = 65_496;
    uint16 private constant ARROW_SHAFT = 65_494;
    uint16 private constant BRONZE_ARROW_HEAD = 65_493;

    uint16 private constant ACTION_WOODCUTTING_LOG = 1;
    uint8 private constant BOOST_START_NOW = 2;
    uint256 private constant NO_DONATION_AMOUNT = 0;
    uint24 private constant MAX_TIME = 1 days;

    function setUp() public {
        deployFullGame();
    }

    function testCutWood() public {
        (QueuedActionInput memory queuedAction, uint256 rate) = _setupBasicWoodcutting(100 * GUAR_MUL);

        _start(_actions(queuedAction), ActionQueueStrategy.OVERWRITE);
        vm.warp(block.timestamp + queuedAction.timespan + 2);

        PendingQueuedActionState memory state = players.getPendingQueuedActionState(ALICE, playerId);
        assertEq(state.equipmentStates[0].consumedItemTokenIds.length, 0);
        assertEq(state.equipmentStates[0].producedItemTokenIds.length, 1);
        assertEq(state.equipmentStates[0].producedItemTokenIds[0], LOG);
        uint256 expected = (queuedAction.timespan * rate) / (3600 * GUAR_MUL);
        assertEq(state.equipmentStates[0].producedAmounts[0], expected);
        assertEq(state.actionMetadatas[0].xpGained, queuedAction.timespan);

        _process();
        assertEq(players.getPlayerXP(playerId, Skill.WOODCUTTING), queuedAction.timespan);
        assertEq(itemNFT.balanceOf(ALICE, LOG), expected);
    }

    function testWoodcuttingFullNatureEquipment() public {
        (QueuedActionInput memory queuedAction, uint256 rate) = _setupBasicWoodcutting(100 * GUAR_MUL);
        _addFullAttireItems(NATURE_MASK, NATURE_BODY, NATURE_BRACERS, NATURE_TROUSERS, NATURE_BOOTS);
        _addFullAttireBonus(
            Skill.WOODCUTTING, NATURE_MASK, NATURE_BODY, NATURE_BRACERS, NATURE_TROUSERS, NATURE_BOOTS, 3, 0
        );
        queuedAction.attire =
            Attire(NATURE_MASK, NONE, NATURE_BODY, NATURE_BRACERS, NATURE_TROUSERS, NATURE_BOOTS, NONE, NONE);
        itemNFT.mintBatch(
            ALICE,
            _uints5(NATURE_MASK, NATURE_BODY, NATURE_BRACERS, NATURE_TROUSERS, NATURE_BOOTS),
            _uints5(1, 1, 1, 1, 1)
        );

        _start(_actions(queuedAction), ActionQueueStrategy.OVERWRITE);
        vm.warp(block.timestamp + queuedAction.timespan + 2);
        _process();

        assertEq(
            players.getPlayerXP(playerId, Skill.WOODCUTTING), queuedAction.timespan + (queuedAction.timespan * 3) / 100
        );
        assertEq(itemNFT.balanceOf(ALICE, LOG), (queuedAction.timespan * rate) / (3600 * GUAR_MUL));
    }

    function testMultipleGuaranteedRewardsShouldBeAllowed() public {
        uint16 rate = uint16(100 * GUAR_MUL);
        ActionInput memory action;
        action.actionId = ACTION_WOODCUTTING_LOG;
        action.info = _actionInfo(Skill.WOODCUTTING, 3600, false, BRONZE_AXE, WOODCUTTING_MAX, 100);
        action.guaranteedRewards = new GuaranteedReward[](2);
        action.guaranteedRewards[0] = GuaranteedReward(LOG, rate);
        action.guaranteedRewards[1] = GuaranteedReward(OAK_LOG, rate * 2);
        _addAction(action);
        _addItem(BRONZE_AXE, EquipPosition.RIGHT_HAND);

        QueuedActionInput memory queuedAction = _queuedAction(ACTION_WOODCUTTING_LOG, 0, 3600);
        queuedAction.rightHandEquipmentTokenId = BRONZE_AXE;
        _start(_actions(queuedAction), ActionQueueStrategy.OVERWRITE);
        vm.warp(block.timestamp + queuedAction.timespan);
        _process();

        assertEq(itemNFT.balanceOf(ALICE, LOG), rate / GUAR_MUL);
        assertEq(itemNFT.balanceOf(ALICE, OAK_LOG), (rate * 2) / GUAR_MUL);
    }

    function testFiremaking() public {
        (QueuedActionInput memory queuedAction, uint256 rate) = _setupFiremaking(1, 100 * RATE_MUL);
        uint256 mintAmount = 5;
        itemNFT.mint(ALICE, LOG, mintAmount);

        _start(_actions(queuedAction), ActionQueueStrategy.OVERWRITE);
        vm.warp(block.timestamp + queuedAction.timespan + 2);
        _process();

        assertEq(
            players.getPlayerXP(playerId, Skill.FIREMAKING), queuedAction.timespan / (rate / (mintAmount * RATE_MUL))
        );
        assertEq(itemNFT.balanceOf(ALICE, LOG), 0);
    }

    function testMultiSkillAppendingWoodcuttingAndFiremaking() public {
        uint256 woodRate = 1200 * GUAR_MUL;
        (QueuedActionInput memory woodcutting,) = _setupBasicWoodcutting(woodRate);
        woodcutting.timespan = 7200 + 10;
        uint256 firemakingRate = 1200 * RATE_MUL;
        (QueuedActionInput memory firemaking,) = _setupFiremaking(2, firemakingRate);

        _start(_actions(woodcutting), ActionQueueStrategy.OVERWRITE);
        vm.warp(block.timestamp + 10);
        PendingQueuedActionState memory state = players.getPendingQueuedActionState(ALICE, playerId);
        assertEq(state.equipmentStates[0].producedItemTokenIds.length, 1);
        assertEq(state.equipmentStates[0].producedAmounts[0], 3);
        assertEq(state.actionMetadatas.length, 1);
        assertEq(state.actionMetadatas[0].xpGained, 9);

        vm.warp(block.timestamp + 1);
        _start(_actions(firemaking), ActionQueueStrategy.KEEP_LAST_IN_PROGRESS);
        assertEq(players.getPlayerXP(playerId, Skill.WOODCUTTING), 9);
        assertEq(itemNFT.balanceOf(ALICE, LOG), 3);

        vm.warp(block.timestamp + woodcutting.timespan + firemaking.timespan);
        assertEq(players.getActionQueue(playerId).length, 2);
        state = players.getPendingQueuedActionState(ALICE, playerId);
        assertEq(state.equipmentStates.length, 2);
        assertEq(state.equipmentStates[0].producedItemTokenIds.length, 1);
        assertEq(state.equipmentStates[0].producedItemTokenIds[0], LOG);
        assertEq(state.equipmentStates[0].producedAmounts[0], 2400);
        assertEq(state.equipmentStates[1].producedItemTokenIds.length, 0);
        assertEq(state.equipmentStates[1].consumedItemTokenIds.length, 1);
        assertEq(state.equipmentStates[1].consumedItemTokenIds[0], LOG);
        assertEq(state.equipmentStates[1].consumedAmounts[0], 1200);
        assertEq(state.actionMetadatas.length, 2);
        assertEq(state.actionMetadatas[0].xpGained, woodcutting.timespan - 10);
        assertEq(state.actionMetadatas[1].xpGained, firemaking.timespan);

        _process();
        assertEq(players.getPlayerXP(playerId, Skill.WOODCUTTING), woodcutting.timespan - 1);
        assertEq(players.getPlayerXP(playerId, Skill.FIREMAKING), firemaking.timespan);
        uint256 expected = (woodcutting.timespan * woodRate) / (3600 * GUAR_MUL) - firemakingRate / RATE_MUL;
        assertApproxEqAbs(itemNFT.balanceOf(ALICE, LOG), expected, 1);
        assertEq(players.getActionQueue(playerId).length, 0);
    }

    function testMultiSkillWoodcuttingAndFiremaking() public {
        uint256 rate = 100 * GUAR_MUL;
        (QueuedActionInput memory woodcutting,) = _setupBasicWoodcutting(rate);
        woodcutting.timespan = 7200;
        (QueuedActionInput memory firemaking,) = _setupFiremaking(2, rate);

        _start(_actions(woodcutting, firemaking), ActionQueueStrategy.OVERWRITE);
        itemNFT.mint(ALICE, LOG, 1);
        vm.warp(vm.getBlockTimestamp() + woodcutting.timespan + firemaking.timespan + 2);
        _process();

        assertEq(players.getPlayerXP(playerId, Skill.WOODCUTTING), woodcutting.timespan);
        assertEq(players.getPlayerXP(playerId, Skill.FIREMAKING), firemaking.timespan);
        assertEq(
            itemNFT.balanceOf(ALICE, LOG),
            (woodcutting.timespan * rate) / (3600 * GUAR_MUL) - (firemaking.timespan * rate) / (3600 * RATE_MUL) + 1
        );
        assertEq(players.getActionQueue(playerId).length, 0);
    }

    function testMining() public {
        ActionInput memory action;
        action.actionId = 1;
        action.info = _actionInfo(Skill.MINING, 3600, false, BRONZE_PICKAXE, MINING_MAX, 100);
        action.guaranteedRewards = new GuaranteedReward[](1);
        action.guaranteedRewards[0] = GuaranteedReward(COPPER_ORE, 10);
        _addAction(action);
        _addItem(BRONZE_PICKAXE, EquipPosition.RIGHT_HAND);
        itemNFT.mint(ALICE, BRONZE_PICKAXE, 1);

        QueuedActionInput memory queuedAction = _queuedAction(1, 0, 100);
        queuedAction.rightHandEquipmentTokenId = BRONZE_PICKAXE;
        _start(_actions(queuedAction), ActionQueueStrategy.OVERWRITE);
        vm.warp(block.timestamp + queuedAction.timespan);
        _process();
        assertEq(players.getPlayerXP(playerId, Skill.MINING), 0);

        queuedAction.timespan = 3600;
        _start(_actions(queuedAction), ActionQueueStrategy.OVERWRITE);
        vm.warp(block.timestamp + queuedAction.timespan);
        _process();
        assertEq(players.getPlayerXP(playerId, Skill.MINING), queuedAction.timespan);
    }

    function testSmithSingleItem() public {
        uint256 rate = 100 * RATE_MUL;
        QueuedActionInput memory queuedAction = _setupSmithing(rate, 3600);
        itemNFT.mint(ALICE, COAL_ORE, 255);
        itemNFT.mint(ALICE, MITHRIL_ORE, 255);

        _start(_actions(queuedAction), ActionQueueStrategy.OVERWRITE);
        vm.warp(block.timestamp + queuedAction.timespan + 2);
        _process();

        uint256 made = (queuedAction.timespan * rate) / (3600 * RATE_MUL);
        assertEq(players.getPlayerXP(playerId, Skill.SMITHING), queuedAction.timespan);
        assertEq(itemNFT.balanceOf(ALICE, MITHRIL_BAR), made);
        assertEq(itemNFT.balanceOf(ALICE, COAL_ORE), 255 - made * 2);
        assertEq(itemNFT.balanceOf(ALICE, MITHRIL_ORE), 255 - made);
    }

    function testSmithMultipleQueuedItems() public {
        uint256 rate = 100 * RATE_MUL;
        QueuedActionInput memory first = _setupSmithing(rate, 3600);

        ActionChoiceInput memory choice = _defaultActionChoice();
        choice.skill = uint8(Skill.SMITHING);
        choice.xpPerHour = 7200;
        choice.rate = uint24(rate);
        choice.inputTokenIds = _uint16s(MITHRIL_ORE, COAL_ORE);
        choice.inputAmounts = _uint24s2(1, 2);
        choice.outputTokenId = MITHRIL_BAR;
        choice.outputAmount = 1;
        worldActions.addActionChoices(1, _uint16s(2), _choices(choice));

        itemNFT.mintBatch(ALICE, _uints(COAL_ORE, MITHRIL_ORE), _uints(1000, 1000));
        QueuedActionInput memory second = _queuedAction(first.actionId, 2, first.timespan);
        _start(_actions(first, second), ActionQueueStrategy.OVERWRITE);
        vm.warp(vm.getBlockTimestamp() + first.timespan + second.timespan);
        _process();

        uint256 made = (first.timespan * 2 * rate) / (3600 * RATE_MUL);
        assertEq(players.getPlayerXP(playerId, Skill.SMITHING), first.timespan + second.timespan * 2);
        assertEq(itemNFT.balanceOf(ALICE, MITHRIL_BAR), made);
        assertEq(itemNFT.balanceOf(ALICE, COAL_ORE), 1000 - made * 2);
        assertEq(itemNFT.balanceOf(ALICE, MITHRIL_ORE), 1000 - made);
    }

    function testCooking() public {
        (QueuedActionInput memory queuedAction, uint256 rate) = _setupCooking(100, 1);
        _start(_actions(queuedAction), ActionQueueStrategy.OVERWRITE);
        vm.warp(block.timestamp + queuedAction.timespan);
        _process();

        uint256 cooked = (queuedAction.timespan * rate) / (3600 * RATE_MUL);
        assertEq(players.getPlayerXP(playerId, Skill.COOKING), queuedAction.timespan);
        assertEq(itemNFT.balanceOf(ALICE, COOKED_MINNUS), cooked);
        assertEq(itemNFT.balanceOf(ALICE, RAW_MINNUS), 1000 - cooked);
    }

    function testBurnSomeFood() public {
        (QueuedActionInput memory queuedAction, uint256 rate) = _setupCooking(25, 65);
        uint256 startingXP = _xpAtLevel(90);
        players.modifyXP(ALICE, playerId, Skill.COOKING, uint56(startingXP), true);

        _start(_actions(queuedAction), ActionQueueStrategy.OVERWRITE);
        vm.warp(block.timestamp + queuedAction.timespan);
        PendingQueuedActionState memory state = players.getPendingQueuedActionState(ALICE, playerId);
        uint256 foodNotBurned = (queuedAction.timespan * rate) / (3600 * RATE_MUL * 2);
        assertEq(state.equipmentStates[0].producedItemTokenIds.length, 1);
        assertEq(state.equipmentStates[0].producedItemTokenIds[0], COOKED_MINNUS);
        assertEq(state.equipmentStates[0].producedAmounts[0], foodNotBurned);
        _process();

        assertEq(players.getPlayerXP(playerId, Skill.COOKING), startingXP + queuedAction.timespan);
        assertEq(itemNFT.balanceOf(ALICE, COOKED_MINNUS), foodNotBurned);
        assertEq(itemNFT.balanceOf(ALICE, RAW_MINNUS), 1000 - (queuedAction.timespan * rate) / (3600 * RATE_MUL));
    }

    function testBurnFoodInProgressProcessingMany() public {
        (QueuedActionInput memory queuedAction, uint256 rate) = _setupCooking(25, 65);
        uint256 startingXP = _xpAtLevel(90);
        players.modifyXP(ALICE, playerId, Skill.COOKING, uint56(startingXP), true);
        _start(_actions(queuedAction), ActionQueueStrategy.OVERWRITE);

        uint256 numLoops = queuedAction.timespan / 240;
        for (uint256 i; i < numLoops; ++i) {
            uint256 variedTimespan = uint256(keccak256(abi.encode(i))) % 240;
            vm.warp(block.timestamp + variedTimespan);
            _process();
        }

        assertNotEq(itemNFT.balanceOf(ALICE, RAW_MINNUS), 1000);
        vm.warp(block.timestamp + queuedAction.timespan);
        _process();

        uint256 foodNotBurned = (queuedAction.timespan * rate) / (3600 * RATE_MUL * 2);
        assertEq(itemNFT.balanceOf(ALICE, COOKED_MINNUS), foodNotBurned);
        assertEq(itemNFT.balanceOf(ALICE, RAW_MINNUS), 1000 - (queuedAction.timespan * rate) / (3600 * RATE_MUL));
        assertEq(players.getPlayerXP(playerId, Skill.COOKING), startingXP + queuedAction.timespan);
    }

    function testBurnFoodCheckMaxNinetyPercentSuccessUpperBound() public {
        (QueuedActionInput memory queuedAction, uint256 rate) = _setupCooking(85, 65);
        uint256 startingXP = _xpAtLevel(90);
        players.modifyXP(ALICE, playerId, Skill.COOKING, uint56(startingXP), true);

        _start(_actions(queuedAction), ActionQueueStrategy.OVERWRITE);
        vm.warp(block.timestamp + queuedAction.timespan);
        _process();

        assertEq(players.getPlayerXP(playerId, Skill.COOKING), startingXP + queuedAction.timespan);
        assertEq(itemNFT.balanceOf(ALICE, COOKED_MINNUS), (queuedAction.timespan * rate * 90) / (3600 * RATE_MUL * 100));
        assertEq(itemNFT.balanceOf(ALICE, RAW_MINNUS), 1000 - (queuedAction.timespan * rate) / (3600 * RATE_MUL));
    }

    function testStealNothing() public {
        RandomReward[] memory rewards = new RandomReward[](2);
        rewards[0] = RandomReward(BRONZE_ARROW, 0, 1);
        rewards[1] = RandomReward(BRONZE_HELMET, 0, 1);
        QueuedActionInput memory queuedAction = _setupThieving(2, 100, rewards, 1 hours);
        _addItem(BRONZE_HELMET, EquipPosition.HEAD);
        _addItem(BRONZE_ARROW, EquipPosition.QUIVER);
        _addBoostItem(SKILL_BOOST, BoostType.GATHERING, 10, 1 days);

        vm.warp(block.timestamp + 1 days);
        itemNFT.mint(ALICE, SKILL_BOOST, 1);
        vm.prank(ALICE);
        players.startActionsAdvanced(
            playerId,
            _actions(queuedAction),
            SKILL_BOOST,
            BOOST_START_NOW,
            0,
            NO_DONATION_AMOUNT,
            ActionQueueStrategy.OVERWRITE
        );
        vm.warp(block.timestamp + 3 hours);
        _requestAndFulfill();
        _requestAndFulfill();
        _process();

        assertEq(itemNFT.balanceOf(ALICE, BRONZE_ARROW), 0);
        assertEq(itemNFT.balanceOf(ALICE, BRONZE_HELMET), 0);
    }

    function testPendingQueuedActionStateRolls() public {
        RandomReward[] memory rewards = new RandomReward[](1);
        rewards[0] = RandomReward(BRONZE_ARROW, 65_535, 1);
        QueuedActionInput memory queuedAction = _setupThieving(3600, 100, rewards, 2 hours);

        _warpToNextCheckpoint();
        _requestAndFulfill();
        _requestAndFulfill();

        _start(_actions(queuedAction), ActionQueueStrategy.OVERWRITE);
        vm.warp(vm.getBlockTimestamp() + queuedAction.timespan / 2 + 2);
        PendingQueuedActionState memory state = players.getPendingQueuedActionState(ALICE, playerId);
        assertEq(state.actionMetadatas.length, 1);
        assertEq(state.actionMetadatas[0].xpGained, queuedAction.timespan / 2);
        assertEq(state.actionMetadatas[0].rolls, 1);
        assertFalse(state.actionMetadatas[0].died);
        assertEq(state.actionMetadatas[0].actionId, 1);
        assertEq(state.actionMetadatas[0].queueId, 1);
        assertEq(state.actionMetadatas[0].elapsedTime, queuedAction.timespan / 2 + 2);

        _process();
        state = players.getPendingQueuedActionState(ALICE, playerId);
        assertEq(state.actionMetadatas.length, 0);

        vm.warp(vm.getBlockTimestamp() + queuedAction.timespan / 2 - 2);
        state = players.getPendingQueuedActionState(ALICE, playerId);
        assertEq(state.actionMetadatas.length, 1);
        assertEq(state.actionMetadatas[0].rolls, 1);

        vm.warp(vm.getBlockTimestamp() + 1 days);
        _requestAndFulfill();
        _process();
        assertEq(itemNFT.balanceOf(ALICE, BRONZE_ARROW), 2);
    }

    function testStealMany() public {
        uint16 randomChance = uint16(65_536 / 2);
        RandomReward[] memory rewards = new RandomReward[](1);
        rewards[0] = RandomReward(BRONZE_ARROW, randomChance, 1);
        uint256 xpPerHour = 2;
        uint256 numHours = 4;
        QueuedActionInput memory queuedAction =
            _setupThieving(uint24(xpPerHour), 100, rewards, uint24(numHours * 1 hours));

        _warpToNextCheckpoint();
        _requestAndFulfill();
        vm.warp(vm.getBlockTimestamp() + 1 days);
        _requestAndFulfill();

        uint256 numRepeats = 25;
        uint256 numRandomRewardsHit;
        for (uint256 i; i < numRepeats; ++i) {
            _start(_actions(queuedAction), ActionQueueStrategy.OVERWRITE);
            vm.warp(vm.getBlockTimestamp() + 1 days);
            _requestAndFulfill();
            PendingQueuedActionState memory state = players.getPendingQueuedActionState(ALICE, playerId);
            if (state.producedPastRandomRewards.length > 0) ++numRandomRewardsHit;
            _process();
        }
        assertGt(numRandomRewardsHit, 0);
        assertLt(numRandomRewardsHit, numRepeats);

        vm.warp(vm.getBlockTimestamp() + 23 hours);
        _requestAndFulfill();
        _process();

        assertEq(players.getPlayerXP(playerId, Skill.THIEVING), xpPerHour * numRepeats * numHours);
        uint256 expectedTotal = numRepeats * numHours / 2;
        uint256 balance = itemNFT.balanceOf(ALICE, BRONZE_ARROW);
        assertGe(balance, (expectedTotal * 30) / 100);
        assertLe(balance, (expectedTotal * 130) / 100);
    }

    function testStealSuccessPercentMany() public {
        uint16 randomChance = uint16(65_536 / 2);
        uint8 successPercent = 60;
        RandomReward[] memory rewards = new RandomReward[](1);
        rewards[0] = RandomReward(BRONZE_ARROW, randomChance, 1);
        uint256 xpPerHour = 2;
        uint256 numHours = 2;
        QueuedActionInput memory queuedAction =
            _setupThieving(uint24(xpPerHour), successPercent, rewards, uint24(numHours * 1 hours));

        _warpToNextCheckpoint();
        _requestAndFulfill();
        vm.warp(vm.getBlockTimestamp() + 1 days);
        _requestAndFulfill();

        uint256 numRepeats = 25;
        uint256 numRandomRewardsHit;
        for (uint256 i; i < numRepeats; ++i) {
            _start(_actions(queuedAction), ActionQueueStrategy.OVERWRITE);
            vm.warp(vm.getBlockTimestamp() + 1 days);
            _requestAndFulfill();
            PendingQueuedActionState memory state = players.getPendingQueuedActionState(ALICE, playerId);
            if (state.producedPastRandomRewards.length > 0) ++numRandomRewardsHit;
            _process();
        }
        assertGt(numRandomRewardsHit, 0);
        assertLt(numRandomRewardsHit, numRepeats);

        vm.warp(vm.getBlockTimestamp() + 25 hours);
        _requestAndFulfillSeeded(7_000_001);
        _process();

        assertEq(players.getPlayerXP(playerId, Skill.THIEVING), xpPerHour * numRepeats * numHours);
        uint256 expectedTotal = (numRepeats * numHours * successPercent) / 200;
        uint256 balance = itemNFT.balanceOf(ALICE, BRONZE_ARROW);
        assertGe(balance, (expectedTotal * 60) / 100);
        assertLe(balance, (expectedTotal * 140) / 100);
    }

    function testThievingFullNatuowEquipment() public {
        uint16 randomChance = 655; // floor(65536 * 1%).
        RandomReward[] memory rewards = new RandomReward[](1);
        rewards[0] = RandomReward(BRONZE_ARROW, randomChance, 1);
        uint256 xpPerHour = 50;
        uint256 numHours = 2;
        QueuedActionInput memory queuedAction =
            _setupThieving(uint24(xpPerHour), 0, rewards, uint24(numHours * 1 hours));
        queuedAction.attire =
            Attire(NATUOW_HOOD, NONE, NATUOW_BODY, NATUOW_BRACERS, NATUOW_TASSETS, NATUOW_BOOTS, NONE, NONE);
        _addFullAttireItems(NATUOW_HOOD, NATUOW_BODY, NATUOW_BRACERS, NATUOW_TASSETS, NATUOW_BOOTS);
        itemNFT.mintBatch(
            ALICE,
            _uints5(NATUOW_HOOD, NATUOW_BODY, NATUOW_BRACERS, NATUOW_TASSETS, NATUOW_BOOTS),
            _uints5(1, 1, 1, 1, 1)
        );
        _addFullAttireBonus(
            Skill.THIEVING, NATUOW_HOOD, NATUOW_BODY, NATUOW_BRACERS, NATUOW_TASSETS, NATUOW_BOOTS, 3, 100
        );

        _warpToNextCheckpoint();
        _requestAndFulfill();
        vm.warp(vm.getBlockTimestamp() + 1 days);
        _requestAndFulfill();

        uint256 numRepeats = 10;
        for (uint256 i; i < numRepeats; ++i) {
            _start(_actions(queuedAction), ActionQueueStrategy.OVERWRITE);
            vm.warp(vm.getBlockTimestamp() + 1 days);
            _requestAndFulfill();
            _process();
        }

        vm.warp(vm.getBlockTimestamp() + 1 days);
        _requestAndFulfill();
        _process();

        assertEq(players.getPlayerXP(playerId, Skill.THIEVING), (xpPerHour * numRepeats * numHours * 103) / 100);
        assertEq(itemNFT.balanceOf(ALICE, BRONZE_ARROW), numRepeats * numHours);
    }

    function testThievingSuccessPercentNotOneHundred() public {
        uint16 randomChance = 64_880; // floor(65536 * 99%).
        uint8 successPercent = 99;
        RandomReward[] memory rewards = new RandomReward[](2);
        rewards[0] = RandomReward(BRONZE_ARROW, randomChance, 1);
        rewards[1] = RandomReward(BRONZE_HELMET, randomChance, 1);
        uint256 numHours = 5;
        QueuedActionInput memory queuedAction = _setupThieving(2, successPercent, rewards, uint24(numHours * 1 hours));

        _warpToNextCheckpoint();
        _start(_actions(queuedAction), ActionQueueStrategy.OVERWRITE);
        vm.warp(block.timestamp + 1 hours);
        _process();
        vm.warp(block.timestamp + 1 days);
        uint256 seed = 3;
        _requestAndFulfillSeeded(seed);
        _requestAndFulfillSeeded(seed);
        _requestAndFulfillSeeded(seed);
        _process();

        assertEq(itemNFT.balanceOf(ALICE, BRONZE_ARROW), 4);
        assertEq(itemNFT.balanceOf(ALICE, BRONZE_HELMET), 4);
    }

    function testCraftingFinishOneItem() public {
        (QueuedActionInput memory queuedAction, uint256 rate) = _setupCrafting(1 * RATE_MUL, 1);
        uint256 startingAmount = 200;
        itemNFT.mintBatch(ALICE, _uints(SAPPHIRE, ROPE), _uints(startingAmount, startingAmount));

        _start(_actions(queuedAction), ActionQueueStrategy.OVERWRITE);
        vm.warp(block.timestamp + queuedAction.timespan + 2);
        _process();

        uint256 made = (queuedAction.timespan * rate) / (3600 * RATE_MUL);
        assertEq(players.getPlayerXP(playerId, Skill.CRAFTING), queuedAction.timespan);
        assertEq(itemNFT.balanceOf(ALICE, SAPPHIRE), startingAmount - made * 20);
        assertEq(itemNFT.balanceOf(ALICE, ROPE), startingAmount - made);
        assertEq(itemNFT.balanceOf(ALICE, SAPPHIRE_AMULET), made);
    }

    function testCraftingQueueEnoughTimeWithProcessInBetween() public {
        (QueuedActionInput memory queuedAction, uint256 rate) = _setupCrafting(1 * RATE_MUL, 1);
        uint256 startingAmount = 200;
        itemNFT.mintBatch(ALICE, _uints(SAPPHIRE, ROPE), _uints(startingAmount, startingAmount));

        _start(_actions(queuedAction), ActionQueueStrategy.OVERWRITE);
        vm.warp(block.timestamp + queuedAction.timespan - 3);
        PendingQueuedActionState memory state = players.getPendingQueuedActionState(ALICE, playerId);
        _assertSinglePending(state, new Equipment[](0), new Equipment[](0), 0, 3597);

        // Hardhat mines the process transaction one second after the preceding explicit block.
        vm.warp(block.timestamp + 1);
        _process();
        assertEq(players.getPlayerXP(playerId, Skill.CRAFTING), 0);
        assertEq(itemNFT.balanceOf(ALICE, SAPPHIRE), startingAmount);
        assertEq(itemNFT.balanceOf(ALICE, ROPE), startingAmount);
        assertEq(itemNFT.balanceOf(ALICE, SAPPHIRE_AMULET), 0);

        vm.warp(block.timestamp + 2);
        state = players.getPendingQueuedActionState(ALICE, playerId);
        _assertSinglePending(state, _equipment2(ROPE, 1, SAPPHIRE, 20), _equipment1(SAPPHIRE_AMULET, 1), 3600, 2);
        _process();

        uint256 made = (queuedAction.timespan * rate) / (3600 * RATE_MUL);
        assertEq(players.getPlayerXP(playerId, Skill.CRAFTING), queuedAction.timespan);
        assertEq(itemNFT.balanceOf(ALICE, SAPPHIRE), startingAmount - made * 20);
        assertEq(itemNFT.balanceOf(ALICE, ROPE), startingAmount - made);
        assertEq(itemNFT.balanceOf(ALICE, SAPPHIRE_AMULET), made);
        state = players.getPendingQueuedActionState(ALICE, playerId);
        assertEq(state.equipmentStates.length, 0);
        assertEq(state.actionMetadatas.length, 0);
    }

    function testCraftingMoreThanOneRate() public {
        uint256 rate = 60 * RATE_MUL;
        (QueuedActionInput memory queuedAction,) = _setupCrafting(rate, 1);
        itemNFT.mintBatch(ALICE, _uints(SAPPHIRE, ROPE), _uints(20 * 60, 60));
        _start(_actions(queuedAction), ActionQueueStrategy.OVERWRITE);

        vm.warp(vm.getBlockTimestamp() + queuedAction.timespan - 12);
        PendingQueuedActionState memory state = players.getPendingQueuedActionState(ALICE, playerId);
        uint256 numMade = rate / RATE_MUL - 1;
        uint256 xpGained = 3600 - rate / RATE_MUL;
        _assertSinglePending(
            state,
            _equipment2(ROPE, numMade, SAPPHIRE, 20 * numMade),
            _equipment1(SAPPHIRE_AMULET, numMade),
            xpGained,
            queuedAction.timespan - 12
        );
        _process();
        assertEq(players.getPlayerXP(playerId, Skill.CRAFTING), xpGained);
        assertEq(itemNFT.balanceOf(ALICE, SAPPHIRE), 20);
        assertEq(itemNFT.balanceOf(ALICE, ROPE), 1);
        assertEq(itemNFT.balanceOf(ALICE, SAPPHIRE_AMULET), numMade);
        state = players.getPendingQueuedActionState(ALICE, playerId);
        assertEq(state.equipmentStates.length, 0);

        vm.warp(vm.getBlockTimestamp() + 1);
        state = players.getPendingQueuedActionState(ALICE, playerId);
        _assertSinglePending(state, new Equipment[](0), new Equipment[](0), 0, 1);
        _process();
        assertEq(players.getPlayerXP(playerId, Skill.CRAFTING), xpGained);
        assertEq(itemNFT.balanceOf(ALICE, SAPPHIRE), 20);
        assertEq(itemNFT.balanceOf(ALICE, ROPE), 1);
        assertEq(itemNFT.balanceOf(ALICE, SAPPHIRE_AMULET), numMade);

        vm.warp(vm.getBlockTimestamp() + 12);
        state = players.getPendingQueuedActionState(ALICE, playerId);
        _assertSinglePending(
            state, _equipment2(ROPE, 1, SAPPHIRE, 20), _equipment1(SAPPHIRE_AMULET, 1), rate / RATE_MUL, 11
        );
        _process();
        assertEq(players.getPlayerXP(playerId, Skill.CRAFTING), 3600);
        assertEq(itemNFT.balanceOf(ALICE, SAPPHIRE), 0);
        assertEq(itemNFT.balanceOf(ALICE, ROPE), 0);
        assertEq(itemNFT.balanceOf(ALICE, SAPPHIRE_AMULET), rate / RATE_MUL);
    }

    function testCraftingRunOutOfFirstResource() public {
        (QueuedActionInput memory queuedAction,) = _setupCrafting(1 * RATE_MUL, 1);
        queuedAction.timespan = 7200;
        itemNFT.mintBatch(ALICE, _uints(SAPPHIRE, ROPE), _uints(40, 1));

        _start(_actions(queuedAction), ActionQueueStrategy.OVERWRITE);
        vm.warp(block.timestamp + queuedAction.timespan);
        PendingQueuedActionState memory state = players.getPendingQueuedActionState(ALICE, playerId);
        _assertSinglePending(state, _equipment2(ROPE, 1, SAPPHIRE, 20), _equipment1(SAPPHIRE_AMULET, 1), 3600, 7200);
        _process();

        assertEq(players.getPlayerXP(playerId, Skill.CRAFTING), 3600);
        assertEq(itemNFT.balanceOf(ALICE, SAPPHIRE), 20);
        assertEq(itemNFT.balanceOf(ALICE, ROPE), 0);
        assertEq(itemNFT.balanceOf(ALICE, SAPPHIRE_AMULET), 1);
    }

    function testCraftingRunOutOfSecondResource() public {
        (QueuedActionInput memory queuedAction,) = _setupCrafting(1 * RATE_MUL, 1);
        queuedAction.timespan = 7200;
        itemNFT.mintBatch(ALICE, _uints(SAPPHIRE, ROPE), _uints(20, 2));

        _start(_actions(queuedAction), ActionQueueStrategy.OVERWRITE);
        vm.warp(block.timestamp + queuedAction.timespan);
        PendingQueuedActionState memory state = players.getPendingQueuedActionState(ALICE, playerId);
        _assertSinglePending(state, _equipment2(ROPE, 1, SAPPHIRE, 20), _equipment1(SAPPHIRE_AMULET, 1), 3600, 7200);
        _process();

        assertEq(players.getPlayerXP(playerId, Skill.CRAFTING), 3600);
        assertEq(itemNFT.balanceOf(ALICE, SAPPHIRE), 0);
        assertEq(itemNFT.balanceOf(ALICE, ROPE), 1);
        assertEq(itemNFT.balanceOf(ALICE, SAPPHIRE_AMULET), 1);
    }

    function testCraftingInProgressResourcesDisappearAndReturn() public {
        (QueuedActionInput memory queuedAction,) = _setupCrafting(1 * RATE_MUL, 1);
        queuedAction.timespan = 3 hours;
        itemNFT.mintBatch(ALICE, _uints(SAPPHIRE, ROPE), _uints(200, 10));
        _start(_actions(queuedAction), ActionQueueStrategy.OVERWRITE);

        vm.warp(vm.getBlockTimestamp() + 900);
        _process();
        assertEq(players.getPlayerXP(playerId, Skill.CRAFTING), 0);
        _assertCraftingBalances(200, 10, 0);

        vm.warp(vm.getBlockTimestamp() + 1800);
        _process();
        assertEq(players.getPlayerXP(playerId, Skill.CRAFTING), 0);
        _assertCraftingBalances(200, 10, 0);

        vm.warp(vm.getBlockTimestamp() + 1800);
        _process();
        assertEq(players.getPlayerXP(playerId, Skill.CRAFTING), 3600);
        _assertCraftingBalances(180, 9, 1);

        vm.prank(ALICE);
        itemNFT.burn(ALICE, SAPPHIRE, 180);
        vm.warp(vm.getBlockTimestamp() + 3600);
        _process();
        assertEq(players.getPlayerXP(playerId, Skill.CRAFTING), 3600);

        itemNFT.mint(ALICE, SAPPHIRE, 180);
        vm.warp(vm.getBlockTimestamp() + 3600);
        _process();
        assertEq(players.getPlayerXP(playerId, Skill.CRAFTING), 3 hours);
        _assertCraftingBalances(140, 7, 3);
    }

    function testCraftingWithoutEitherResource() public {
        (QueuedActionInput memory queuedAction,) = _setupCrafting(1 * RATE_MUL, 1);
        queuedAction.timespan = 7200;
        _start(_actions(queuedAction), ActionQueueStrategy.OVERWRITE);
        vm.warp(block.timestamp + queuedAction.timespan);

        PendingQueuedActionState memory state = players.getPendingQueuedActionState(ALICE, playerId);
        _assertSinglePending(state, new Equipment[](0), new Equipment[](0), 0, 7200);
        itemNFT.mintBatch(ALICE, _uints(SAPPHIRE, ROPE), _uints(20, 0));
        state = players.getPendingQueuedActionState(ALICE, playerId);
        _assertSinglePending(state, new Equipment[](0), new Equipment[](0), 0, 7200);

        vm.prank(ALICE);
        itemNFT.burn(ALICE, SAPPHIRE, 20);
        itemNFT.mintBatch(ALICE, _uints(SAPPHIRE, ROPE), _uints(0, 1));
        state = players.getPendingQueuedActionState(ALICE, playerId);
        _assertSinglePending(state, new Equipment[](0), new Equipment[](0), 0, 7200);

        itemNFT.mintBatch(ALICE, _uints(SAPPHIRE, ROPE), _uints(20, 0));
        assertEq(itemNFT.balanceOf(ALICE, SAPPHIRE), 20);
        assertEq(itemNFT.balanceOf(ALICE, ROPE), 1);
        state = players.getPendingQueuedActionState(ALICE, playerId);
        _assertSinglePending(state, _equipment2(ROPE, 1, SAPPHIRE, 20), _equipment1(SAPPHIRE_AMULET, 1), 3600, 7200);
        _process();

        assertEq(players.getPlayerXP(playerId, Skill.CRAFTING), 3600);
        _assertCraftingBalances(0, 0, 1);
    }

    function testCraftingFinishMultipleQueuedActions() public {
        (QueuedActionInput memory queuedAction,) = _setupCrafting(1 * RATE_MUL, 1);
        itemNFT.mintBatch(ALICE, _uints(SAPPHIRE, ROPE), _uints(60, 3));
        _start(_actions(queuedAction, queuedAction, queuedAction), ActionQueueStrategy.OVERWRITE);
        vm.warp(block.timestamp + (queuedAction.timespan * 5) / 2);

        PendingQueuedActionState memory state = players.getPendingQueuedActionState(ALICE, playerId);
        assertEq(state.equipmentStates.length, 3);
        assertEq(state.actionMetadatas.length, 3);
        _assertEquipmentState(state, 0, _equipment2(ROPE, 1, SAPPHIRE, 20), _equipment1(SAPPHIRE_AMULET, 1));
        _assertEquipmentState(state, 1, _equipment2(ROPE, 1, SAPPHIRE, 20), _equipment1(SAPPHIRE_AMULET, 1));
        _assertEquipmentState(state, 2, new Equipment[](0), new Equipment[](0));
        assertEq(state.actionMetadatas[0].actionId, 1);
        assertEq(state.actionMetadatas[0].queueId, 1);
        assertEq(state.actionMetadatas[0].elapsedTime, 3600);
        assertEq(state.actionMetadatas[1].actionId, 1);
        assertEq(state.actionMetadatas[1].queueId, 2);
        assertEq(state.actionMetadatas[1].elapsedTime, 3600);
        assertEq(state.actionMetadatas[2].actionId, 1);
        assertEq(state.actionMetadatas[2].queueId, 3);
        assertEq(state.actionMetadatas[2].elapsedTime, 1800);

        _process();
        assertEq(players.getPlayerXP(playerId, Skill.CRAFTING), 7200);
        _assertCraftingBalances(20, 1, 2);

        vm.warp(block.timestamp + queuedAction.timespan / 2);
        state = players.getPendingQueuedActionState(ALICE, playerId);
        assertEq(state.equipmentStates.length, 1);
        assertEq(state.actionMetadatas.length, 1);
        _assertEquipmentState(state, 0, _equipment2(ROPE, 1, SAPPHIRE, 20), _equipment1(SAPPHIRE_AMULET, 1));
        assertEq(state.actionMetadatas[0].actionId, 1);
        assertEq(state.actionMetadatas[0].queueId, 3);
        assertEq(state.actionMetadatas[0].elapsedTime, 1800);

        _process();
        assertEq(players.getPlayerXP(playerId, Skill.CRAFTING), 3 hours);
        _assertCraftingBalances(0, 0, 3);
    }

    function testCraftingMultipleOutputAmount() public {
        uint256 outputAmount = 3;
        (QueuedActionInput memory queuedAction,) = _setupCrafting(1 * RATE_MUL, uint8(outputAmount));
        queuedAction.timespan = 7200;
        itemNFT.mintBatch(ALICE, _uints(SAPPHIRE, ROPE), _uints(41, 3));
        _start(_actions(queuedAction), ActionQueueStrategy.OVERWRITE);
        vm.warp(block.timestamp + queuedAction.timespan);

        PendingQueuedActionState memory state = players.getPendingQueuedActionState(ALICE, playerId);
        _assertSinglePending(
            state, _equipment2(ROPE, 2, SAPPHIRE, 40), _equipment1(SAPPHIRE_AMULET, outputAmount * 2), 7200, 7200
        );
        _process();

        assertEq(players.getPlayerXP(playerId, Skill.CRAFTING), 7200);
        _assertCraftingBalances(1, 1, outputAmount * 2);
    }

    function testAlchemyFinishOneItem() public {
        (QueuedActionInput memory queuedAction, uint256 rate) = _setupAlchemy(1 * RATE_MUL, 1);
        assertNotEq(queuedAction.timespan, 0);
        uint256 startingAmount = 200;
        itemNFT.mintBatch(
            ALICE, _uints3(SHADOW_SCROLL, NATURE_SCROLL, PAPER), _uints3(startingAmount, startingAmount, startingAmount)
        );

        _start(_actions(queuedAction), ActionQueueStrategy.OVERWRITE);
        vm.warp(block.timestamp + queuedAction.timespan + 2);
        _process();

        uint256 made = (queuedAction.timespan * rate) / (3600 * RATE_MUL);
        assertEq(players.getPlayerXP(playerId, Skill.ALCHEMY), queuedAction.timespan);
        assertEq(itemNFT.balanceOf(ALICE, SHADOW_SCROLL), startingAmount - made);
        assertEq(itemNFT.balanceOf(ALICE, NATURE_SCROLL), startingAmount - made);
        assertEq(itemNFT.balanceOf(ALICE, PAPER), startingAmount - made * 2);
        assertEq(itemNFT.balanceOf(ALICE, ANCIENT_SCROLL), made);
    }

    function testOutputAmountGreaterThan65535() public {
        uint256 outputAmount = 255;
        uint256 rate = 300 * RATE_MUL;
        (QueuedActionInput memory queuedAction,) = _setupAlchemy(rate, uint8(outputAmount));
        assertNotEq(queuedAction.timespan, 0);
        uint256 startingAmount = 1_000_000;
        itemNFT.mintBatch(
            ALICE, _uints3(SHADOW_SCROLL, NATURE_SCROLL, PAPER), _uints3(startingAmount, startingAmount, startingAmount)
        );

        _start(_actions(queuedAction), ActionQueueStrategy.OVERWRITE);
        vm.warp(block.timestamp + queuedAction.timespan);
        _process();

        uint256 made = (queuedAction.timespan * rate) / (3600 * RATE_MUL);
        assertEq(players.getPlayerXP(playerId, Skill.ALCHEMY), queuedAction.timespan);
        assertEq(itemNFT.balanceOf(ALICE, SHADOW_SCROLL), startingAmount - made);
        assertEq(itemNFT.balanceOf(ALICE, NATURE_SCROLL), startingAmount - made);
        assertEq(itemNFT.balanceOf(ALICE, PAPER), startingAmount - made * 2);
        uint256 outputBalance = itemNFT.balanceOf(ALICE, ANCIENT_SCROLL);
        assertEq(outputBalance, made * outputAmount);
        assertGt(outputBalance, 65_535);
    }

    function testFletchingFinishOneItem() public {
        _testArrowMaking(Skill.FLETCHING);
    }

    function testForgingFinishOneItem() public {
        _testArrowMaking(Skill.FORGING);
    }

    function testFarmingFinishOneItem() public {
        (QueuedActionInput memory queuedAction, uint256 rate) = _setupFarming();
        assertNotEq(queuedAction.timespan, 0);
        uint256 startingAmount = 200;
        itemNFT.mintBatch(ALICE, _uints(PLOT_001_SMALL, SEED_001_WILD), _uints(startingAmount, startingAmount));

        _start(_actions(queuedAction), ActionQueueStrategy.OVERWRITE);
        assertEq(queuedAction.timespan, 8 hours);
        vm.warp(block.timestamp + queuedAction.timespan - 10);
        _process();
        assertEq(players.getPlayerXP(playerId, Skill.FARMING), 0);
        vm.warp(block.timestamp + 10);
        _process();

        uint256 made = (queuedAction.timespan * rate) / (3600 * RATE_MUL);
        assertEq(players.getPlayerXP(playerId, Skill.FARMING), queuedAction.timespan);
        assertEq(itemNFT.balanceOf(ALICE, PLOT_001_SMALL), startingAmount - made);
        assertEq(itemNFT.balanceOf(ALICE, SEED_001_WILD), startingAmount - made * 20);
        assertEq(itemNFT.balanceOf(ALICE, SEED_001_WILD_HARVESTABLE), made * 13);
    }

    function testSetPastMaxTimespan() public {
        (QueuedActionInput memory queuedAction, uint256 rate) = _setupBasicWoodcutting(100 * GUAR_MUL);
        queuedAction.timespan = MAX_TIME + 1;
        _start(_actions(queuedAction), ActionQueueStrategy.OVERWRITE);
        vm.warp(block.timestamp + queuedAction.timespan + 2);
        _process();

        uint256 processedTime = queuedAction.timespan - 1;
        assertEq(players.getPlayerXP(playerId, Skill.WOODCUTTING), processedTime);
        assertEq(itemNFT.balanceOf(ALICE, LOG), (processedTime * rate) / (3600 * GUAR_MUL));
    }

    function testRefundTimeForActions() public {
        uint256 rate = 2 * GUAR_MUL;
        (QueuedActionInput memory queuedAction,) = _setupBasicWoodcutting(rate);
        _start(_actions(queuedAction), ActionQueueStrategy.OVERWRITE);

        vm.warp(block.timestamp + (queuedAction.timespan * 3) / 4);
        _process();
        assertEq(players.getPlayerXP(playerId, Skill.WOODCUTTING), queuedAction.timespan / 2);

        vm.warp(block.timestamp + queuedAction.timespan / 4);
        _process();
        assertEq(players.getPlayerXP(playerId, Skill.WOODCUTTING), queuedAction.timespan);
        assertEq(itemNFT.balanceOf(ALICE, LOG), (queuedAction.timespan * rate) / (3600 * GUAR_MUL));
    }

    function testLowRateActionMoreThanOneHourNeeded() public {
        _addItem(BRONZE_AXE, EquipPosition.RIGHT_HAND);
        uint16 rate = 1; // 0.1 per hour at GUAR_MUL precision.
        ActionInput memory action;
        action.actionId = 1;
        action.info = _actionInfo(Skill.WOODCUTTING, 3600, false, BRONZE_AXE, WOODCUTTING_MAX, 100);
        action.guaranteedRewards = new GuaranteedReward[](1);
        action.guaranteedRewards[0] = GuaranteedReward(LOG, rate);
        _addAction(action);

        QueuedActionInput memory queuedAction = _queuedAction(1, 0, 19 hours);
        queuedAction.rightHandEquipmentTokenId = BRONZE_AXE;
        _start(_actions(queuedAction), ActionQueueStrategy.OVERWRITE);
        vm.warp(block.timestamp + queuedAction.timespan);
        _process();
        assertEq(itemNFT.balanceOf(ALICE, LOG), 1);
    }

    function testIncorrectLeftAndRightHandEquipment() public {
        (QueuedActionInput memory queuedAction,) = _setupBasicWoodcutting(100 * GUAR_MUL);
        queuedAction.rightHandEquipmentTokenId = BRONZE_PICKAXE;
        _addItem(BRONZE_PICKAXE, EquipPosition.RIGHT_HAND);

        vm.prank(ALICE);
        vm.expectRevert(abi.encodeWithSelector(PlayersBase.InvalidHandEquipment.selector, BRONZE_PICKAXE));
        players.startActions(playerId, _actions(queuedAction), ActionQueueStrategy.OVERWRITE);

        queuedAction.leftHandEquipmentTokenId = BRONZE_AXE;
        queuedAction.rightHandEquipmentTokenId = NONE;
        vm.prank(ALICE);
        vm.expectRevert(PlayersBase.IncorrectEquippedItem.selector);
        players.startActions(playerId, _actions(queuedAction), ActionQueueStrategy.OVERWRITE);

        queuedAction.rightHandEquipmentTokenId = BRONZE_AXE;
        vm.prank(ALICE);
        vm.expectRevert(abi.encodeWithSelector(PlayersBase.IncorrectLeftHandEquipment.selector, BRONZE_AXE));
        players.startActions(playerId, _actions(queuedAction), ActionQueueStrategy.OVERWRITE);

        queuedAction.leftHandEquipmentTokenId = NONE;
        _start(_actions(queuedAction), ActionQueueStrategy.OVERWRITE);
        assertEq(itemNFT.balanceOf(ALICE, BRONZE_AXE), 1);
        vm.prank(ALICE);
        itemNFT.safeTransferFrom(ALICE, address(this), BRONZE_AXE, 1, "");
        assertEq(itemNFT.balanceOf(ALICE, BRONZE_AXE), 0);

        vm.warp(block.timestamp + queuedAction.timespan);
        _process();
        assertEq(players.getPlayerXP(playerId, Skill.WOODCUTTING), 0);
        assertEq(itemNFT.balanceOf(ALICE, LOG), 0);
    }

    function _setupBasicWoodcutting(uint256 rate) private returns (QueuedActionInput memory queuedAction, uint256) {
        ActionInput memory action;
        action.actionId = ACTION_WOODCUTTING_LOG;
        action.info = _actionInfo(Skill.WOODCUTTING, 3600, false, BRONZE_AXE, WOODCUTTING_MAX, 100);
        action.guaranteedRewards = new GuaranteedReward[](1);
        action.guaranteedRewards[0] = GuaranteedReward(LOG, uint16(rate));
        _addAction(action);
        _addItem(BRONZE_AXE, EquipPosition.RIGHT_HAND);

        queuedAction = _queuedAction(ACTION_WOODCUTTING_LOG, 0, 3600);
        queuedAction.rightHandEquipmentTokenId = BRONZE_AXE;
        return (queuedAction, rate);
    }

    function _setupFiremaking(uint16 actionId, uint256 rate)
        private
        returns (QueuedActionInput memory queuedAction, uint256)
    {
        ActionInput memory action;
        action.actionId = actionId;
        action.info = _actionInfo(Skill.FIREMAKING, 0, true, MAGIC_FIRE_STARTER, FIRE_MAX, 100);
        _addAction(action);

        ActionChoiceInput memory choice = _defaultActionChoice();
        choice.skill = uint8(Skill.FIREMAKING);
        choice.xpPerHour = 3600;
        choice.rate = uint24(rate);
        choice.inputTokenIds = _uint16s(LOG);
        choice.inputAmounts = _uint24s(1);
        worldActions.addActionChoices(actionId, _uint16s(1), _choices(choice));

        _addItem(MAGIC_FIRE_STARTER, EquipPosition.RIGHT_HAND);
        _addItem(LOG, EquipPosition.AUX);
        queuedAction = _queuedAction(actionId, 1, 3600);
        queuedAction.rightHandEquipmentTokenId = MAGIC_FIRE_STARTER;
        return (queuedAction, rate);
    }

    function _setupSmithing(uint256 rate, uint24 timespan) private returns (QueuedActionInput memory queuedAction) {
        queuedAction = _setupRecipe(
            Skill.SMITHING, rate, _uint16s(MITHRIL_ORE, COAL_ORE), _uint24s2(1, 2), MITHRIL_BAR, 1, timespan
        );
        _addItem(COAL_ORE, EquipPosition.AUX);
        _addItem(MITHRIL_ORE, EquipPosition.AUX);
    }

    function _setupCooking(uint8 successPercent, uint256 minLevel)
        private
        returns (QueuedActionInput memory queuedAction, uint256 rate)
    {
        rate = 100 * RATE_MUL;
        ActionInput memory action;
        action.actionId = 1;
        action.info = _actionInfo(Skill.COOKING, 0, true, NONE, NONE, 100);
        _addAction(action);

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
        worldActions.addActionChoices(1, _uint16s(1), _choices(choice));

        _addItem(RAW_MINNUS, EquipPosition.AUX);
        ItemInput memory cooked = _defaultItem(COOKED_MINNUS, EquipPosition.FOOD);
        cooked.healthRestored = 1;
        _addItem(cooked);
        itemNFT.mint(ALICE, RAW_MINNUS, 1000);
        queuedAction = _queuedAction(1, 1, 3600);
    }

    function _setupThieving(uint24 xpPerHour, uint8 successPercent, RandomReward[] memory rewards, uint24 timespan)
        private
        returns (QueuedActionInput memory queuedAction)
    {
        ActionInput memory action;
        action.actionId = 1;
        action.info = _actionInfo(Skill.THIEVING, xpPerHour, false, NONE, NONE, successPercent);
        action.randomRewards = rewards;
        _addAction(action);
        queuedAction = _queuedAction(1, 0, timespan);
    }

    function _setupCrafting(uint256 rate, uint8 outputAmount)
        private
        returns (QueuedActionInput memory queuedAction, uint256)
    {
        queuedAction = _setupRecipe(
            Skill.CRAFTING, rate, _uint16s(ROPE, SAPPHIRE), _uint24s2(1, 20), SAPPHIRE_AMULET, outputAmount, 3600
        );
        _addItem(SAPPHIRE, EquipPosition.NONE);
        _addItem(ROPE, EquipPosition.NONE);
        return (queuedAction, rate);
    }

    function _setupAlchemy(uint256 rate, uint8 outputAmount)
        private
        returns (QueuedActionInput memory queuedAction, uint256)
    {
        queuedAction = _setupRecipe(
            Skill.ALCHEMY,
            rate,
            _uint16s(SHADOW_SCROLL, NATURE_SCROLL, PAPER),
            _uint24s(1, 1, 2),
            ANCIENT_SCROLL,
            outputAmount,
            3600
        );
        _addItem(SHADOW_SCROLL, EquipPosition.NONE);
        _addItem(NATURE_SCROLL, EquipPosition.NONE);
        _addItem(PAPER, EquipPosition.NONE);
        _addItem(ANCIENT_SCROLL, EquipPosition.NONE);
        return (queuedAction, rate);
    }

    function _setupArrowMaking(Skill skill) private returns (QueuedActionInput memory queuedAction, uint256 rate) {
        rate = 1 * RATE_MUL;
        queuedAction = _setupRecipe(
            skill, rate, _uint16s(BRONZE_ARROW_HEAD, ARROW_SHAFT, FEATHER), _uint24s(1, 1, 2), BRONZE_ARROW, 1, 3600
        );
        _addItem(BRONZE_ARROW_HEAD, EquipPosition.NONE);
        _addItem(ARROW_SHAFT, EquipPosition.NONE);
        _addItem(FEATHER, EquipPosition.NONE);
        _addItem(BRONZE_ARROW, EquipPosition.NONE);
    }

    function _setupFarming() private returns (QueuedActionInput memory queuedAction, uint256 rate) {
        rate = RATE_MUL / 8;
        queuedAction = _setupRecipe(
            Skill.FARMING,
            rate,
            _uint16s(PLOT_001_SMALL, SEED_001_WILD),
            _uint24s2(1, 20),
            SEED_001_WILD_HARVESTABLE,
            13,
            uint24((3600 * RATE_MUL) / rate)
        );
        _addItem(PLOT_001_SMALL, EquipPosition.NONE);
        _addItem(SEED_001_WILD, EquipPosition.NONE);
        _addItem(SEED_001_WILD_HARVESTABLE, EquipPosition.NONE);
    }

    function _setupRecipe(
        Skill skill,
        uint256 rate,
        uint16[] memory inputTokenIds,
        uint24[] memory inputAmounts,
        uint16 outputTokenId,
        uint8 outputAmount,
        uint24 timespan
    ) private returns (QueuedActionInput memory queuedAction) {
        ActionInput memory action;
        action.actionId = 1;
        action.info = _actionInfo(skill, 0, true, NONE, NONE, 100);
        _addAction(action);

        ActionChoiceInput memory choice = _defaultActionChoice();
        choice.skill = uint8(skill);
        choice.xpPerHour = 3600;
        choice.rate = uint24(rate);
        choice.inputTokenIds = inputTokenIds;
        choice.inputAmounts = inputAmounts;
        choice.outputTokenId = outputTokenId;
        choice.outputAmount = outputAmount;
        worldActions.addActionChoices(1, _uint16s(1), _choices(choice));
        queuedAction = _queuedAction(1, 1, timespan);
    }

    function _testArrowMaking(Skill skill) private {
        (QueuedActionInput memory queuedAction, uint256 rate) = _setupArrowMaking(skill);
        assertNotEq(queuedAction.timespan, 0);
        uint256 startingAmount = 200;
        itemNFT.mintBatch(
            ALICE,
            _uints3(BRONZE_ARROW_HEAD, ARROW_SHAFT, FEATHER),
            _uints3(startingAmount, startingAmount, startingAmount)
        );

        _start(_actions(queuedAction), ActionQueueStrategy.OVERWRITE);
        vm.warp(block.timestamp + queuedAction.timespan + 2);
        _process();

        uint256 made = (queuedAction.timespan * rate) / (3600 * RATE_MUL);
        assertEq(players.getPlayerXP(playerId, skill), queuedAction.timespan);
        assertEq(itemNFT.balanceOf(ALICE, BRONZE_ARROW_HEAD), startingAmount - made);
        assertEq(itemNFT.balanceOf(ALICE, ARROW_SHAFT), startingAmount - made);
        assertEq(itemNFT.balanceOf(ALICE, FEATHER), startingAmount - made * 2);
        assertEq(itemNFT.balanceOf(ALICE, BRONZE_ARROW), made);
    }

    function _actionInfo(
        Skill skill,
        uint24 xpPerHour,
        bool actionChoiceRequired,
        uint16 handItemTokenIdRangeMin,
        uint16 handItemTokenIdRangeMax,
        uint8 successPercent
    ) private pure returns (ActionInfo memory info) {
        info = ActionInfo({
            skill: uint8(skill),
            actionChoiceRequired: actionChoiceRequired,
            xpPerHour: xpPerHour,
            minXP: 0,
            numSpawned: 0,
            handItemTokenIdRangeMin: handItemTokenIdRangeMin,
            handItemTokenIdRangeMax: handItemTokenIdRangeMax,
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
        returns (QueuedActionInput memory queuedAction)
    {
        queuedAction.actionId = actionId;
        queuedAction.choiceId = choiceId;
        queuedAction.timespan = timespan;
        queuedAction.combatStyle = uint8(CombatStyle.NONE);
    }

    function _addAction(ActionInput memory action) private {
        ActionInput[] memory actions = new ActionInput[](1);
        actions[0] = action;
        worldActions.addActions(actions);
    }

    function _addItem(uint16 tokenId, EquipPosition equipPosition) private {
        _addItem(_defaultItem(tokenId, equipPosition));
    }

    function _addItem(ItemInput memory item) private {
        ItemInput[] memory items = new ItemInput[](1);
        items[0] = item;
        itemNFT.addItems(items);
    }

    function _addBoostItem(uint16 tokenId, BoostType boostType, uint16 boostValue, uint24 boostDuration) private {
        ItemInput memory item = _defaultItem(tokenId, EquipPosition.BOOST_VIAL);
        item.isTransferable = false;
        item.boostType = boostType;
        item.boostValue = boostValue;
        item.boostDuration = boostDuration;
        _addItem(item);
    }

    function _defaultItem(uint16 tokenId, EquipPosition equipPosition) private pure returns (ItemInput memory item) {
        item.tokenId = tokenId;
        item.equipPosition = equipPosition;
        item.isTransferable = true;
        item.isAvailable = true;
        item.metadataURI = "TEST.json";
        item.name = "TEST";
    }

    function _addFullAttireItems(uint16 head, uint16 body, uint16 arms, uint16 legs, uint16 feet) private {
        _addItem(head, EquipPosition.HEAD);
        _addItem(body, EquipPosition.BODY);
        _addItem(arms, EquipPosition.ARMS);
        _addItem(legs, EquipPosition.LEGS);
        _addItem(feet, EquipPosition.FEET);
    }

    function _addFullAttireBonus(
        Skill skill,
        uint16 head,
        uint16 body,
        uint16 arms,
        uint16 legs,
        uint16 feet,
        uint8 bonusXPPercent,
        uint8 bonusRewardsPercent
    ) private {
        FullAttireBonusInput[] memory bonuses = new FullAttireBonusInput[](1);
        bonuses[0].skill = skill;
        bonuses[0].bonusXPPercent = bonusXPPercent;
        bonuses[0].bonusRewardsPercent = bonusRewardsPercent;
        bonuses[0].itemTokenIds[0] = head;
        bonuses[0].itemTokenIds[1] = body;
        bonuses[0].itemTokenIds[2] = arms;
        bonuses[0].itemTokenIds[3] = legs;
        bonuses[0].itemTokenIds[4] = feet;
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

    function _warpToNextCheckpoint() private {
        vm.warp(((vm.getBlockTimestamp() / 1 days) + 1) * 1 days + 1);
    }

    function _requestAndFulfill() private {
        uint256 requestId = randomnessBeacon.requestRandomWords();
        mockVRF.fulfill(requestId, address(randomnessBeacon));
    }

    function _requestAndFulfillSeeded(uint256 seed) private {
        uint256 requestId = randomnessBeacon.requestRandomWords();
        mockVRF.fulfillSeeded(requestId, address(randomnessBeacon), seed);
    }

    function _assertSinglePending(
        PendingQueuedActionState memory state,
        Equipment[] memory consumed,
        Equipment[] memory produced,
        uint256 xpGained,
        uint256 elapsedTime
    ) private pure {
        assertEq(state.equipmentStates.length, 1);
        assertEq(state.actionMetadatas.length, 1);
        _assertEquipmentState(state, 0, consumed, produced);
        assertEq(state.actionMetadatas[0].xpGained, xpGained);
        assertEq(state.actionMetadatas[0].rolls, 0);
        assertFalse(state.actionMetadatas[0].died);
        assertEq(state.actionMetadatas[0].actionId, 1);
        assertEq(state.actionMetadatas[0].queueId, 1);
        assertEq(state.actionMetadatas[0].elapsedTime, elapsedTime);
        assertEq(state.producedPastRandomRewards.length, 0);
        assertEq(state.xpRewardItemTokenIds.length, 0);
        assertEq(state.xpRewardAmounts.length, 0);
        assertEq(state.quests.rewardItemTokenIds.length, 0);
        assertEq(state.quests.rewardAmounts.length, 0);
        assertEq(state.quests.consumedItemTokenIds.length, 0);
        assertEq(state.quests.consumedAmounts.length, 0);
        assertEq(state.quests.activeQuestInfo.length, 0);
        assertEq(state.dailyRewardItemTokenIds.length, 0);
        assertEq(state.dailyRewardAmounts.length, 0);
    }

    function _assertEquipmentState(
        PendingQueuedActionState memory state,
        uint256 index,
        Equipment[] memory consumed,
        Equipment[] memory produced
    ) private pure {
        assertEq(state.equipmentStates[index].consumedItemTokenIds.length, consumed.length);
        assertEq(state.equipmentStates[index].consumedAmounts.length, consumed.length);
        for (uint256 i; i < consumed.length; ++i) {
            assertEq(state.equipmentStates[index].consumedItemTokenIds[i], consumed[i].itemTokenId);
            assertEq(state.equipmentStates[index].consumedAmounts[i], consumed[i].amount);
        }
        assertEq(state.equipmentStates[index].producedItemTokenIds.length, produced.length);
        assertEq(state.equipmentStates[index].producedAmounts.length, produced.length);
        for (uint256 i; i < produced.length; ++i) {
            assertEq(state.equipmentStates[index].producedItemTokenIds[i], produced[i].itemTokenId);
            assertEq(state.equipmentStates[index].producedAmounts[i], produced[i].amount);
        }
    }

    function _assertCraftingBalances(uint256 sapphire, uint256 rope, uint256 amulets) private view {
        assertEq(itemNFT.balanceOf(ALICE, SAPPHIRE), sapphire);
        assertEq(itemNFT.balanceOf(ALICE, ROPE), rope);
        assertEq(itemNFT.balanceOf(ALICE, SAPPHIRE_AMULET), amulets);
    }

    function _equipment1(uint16 tokenId, uint256 amount) private pure returns (Equipment[] memory equipment) {
        equipment = new Equipment[](1);
        equipment[0] = Equipment(tokenId, uint24(amount));
    }

    function _equipment2(uint16 firstId, uint256 firstAmount, uint16 secondId, uint256 secondAmount)
        private
        pure
        returns (Equipment[] memory equipment)
    {
        equipment = new Equipment[](2);
        equipment[0] = Equipment(firstId, uint24(firstAmount));
        equipment[1] = Equipment(secondId, uint24(secondAmount));
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

    function _uint24s2(uint24 first, uint24 second) private pure returns (uint24[] memory values) {
        values = new uint24[](2);
        values[0] = first;
        values[1] = second;
    }

    function _uints3(uint256 first, uint256 second, uint256 third) private pure returns (uint256[] memory values) {
        values = new uint256[](3);
        values[0] = first;
        values[1] = second;
        values[2] = third;
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
