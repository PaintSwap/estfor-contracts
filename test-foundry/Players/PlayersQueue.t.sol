// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {FullGameStack} from "../utils/FullGameStack.sol";
import {PlayersBase} from "../interfaces/PlayersBase.sol";
import {PlayersImplMisc1 as IPlayersMisc1DelegateView} from "../interfaces/PlayersImplMisc1.sol";
import {Skill, Attire, CombatStyle} from "../../contracts/globals/misc.sol";
import {
    ActionInput,
    ActionInfo,
    ActionQueueStrategy,
    QueuedAction,
    QueuedActionInput,
    GUAR_MUL,
    RATE_MUL
} from "../../contracts/globals/actions.sol";
import {
    ActionChoiceInput,
    EquipPosition,
    ItemInput,
    PendingQueuedActionState,
    Player
} from "../../contracts/globals/players.sol";
import {GuaranteedReward} from "../../contracts/globals/rewards.sol";
import {NONE, BRONZE_AXE, MAGIC_FIRE_STARTER, FIRE_MAX, NET_STICK} from "../../contracts/globals/items.sol";

// Migrated from the Queue combinations through Missing required equipment block in test/Players/Players.ts.
contract PlayersQueueTest is FullGameStack {
    uint16 private constant WOODCUTTING_MAX = 3071;
    uint16 private constant FISHING_MAX = 3327;
    uint16 private constant ORICHALCUM_AXE = 2822;
    uint16 private constant LOG = 10496;
    uint16 private constant OAK_LOG = 10497;
    uint16 private constant RAW_MINNUS = 10752;
    uint16 private constant COOKED_MINNUS = 11008;
    uint16 private constant BRONZE_HELMET = 1;
    uint16 private constant AMETHYST_AMULET = 260;
    uint16 private constant BRONZE_ARMOR = 513;
    uint16 private constant BRONZE_GAUNTLETS = 769;
    uint16 private constant BRONZE_TASSETS = 1025;
    uint16 private constant BRONZE_BOOTS = 1281;
    uint16 private constant BRONZE_ARROW = 11776;
    uint16 private constant ACTION_WOODCUTTING = 1;
    uint16 private constant ACTION_FIREMAKING = 1000;
    uint16 private constant ACTION_FISHING = 1500;

    function setUp() public {
        deployFullGame();
    }

    function testQueueRemoveInProgressKeepOnePending() public {
        QueuedActionInput memory a = _setupWoodcutting();
        _start(_actions(a, a), ActionQueueStrategy.OVERWRITE);
        vm.warp(block.timestamp + a.timespan / 2);
        assertEq(players.getActionQueue(playerId).length, 2);
        _start(_actions(a), ActionQueueStrategy.OVERWRITE);
        _assertQueue(1, 3, a.timespan);
    }

    function testQueueRemoveInProgressKeepPendingAddAnotherPending() public {
        QueuedActionInput memory a = _setupWoodcutting();
        _start(_actions(a, a), ActionQueueStrategy.OVERWRITE);
        vm.warp(block.timestamp + a.timespan / 2);
        assertEq(players.getActionQueue(playerId).length, 2);
        _start(_actions(a, a), ActionQueueStrategy.OVERWRITE);
        QueuedAction[] memory q = players.getActionQueue(playerId);
        assertEq(q.length, 2);
        assertEq(q[0].queueId, 3);
        assertEq(q[1].queueId, 4);
        assertEq(q[0].timespan, a.timespan);
        assertEq(q[1].timespan, a.timespan);
    }

    function testQueueKeepInProgressRemovePending() public {
        QueuedActionInput memory a = _setupWoodcutting();
        _start(_actions(a, a), ActionQueueStrategy.OVERWRITE);
        vm.warp(block.timestamp + a.timespan / 2);
        _start(new QueuedActionInput[](0), ActionQueueStrategy.KEEP_LAST_IN_PROGRESS);
        _assertQueue(1, 1, a.timespan / 2);
    }

    function testQueueKeepInProgressRemovePendingAddPending() public {
        QueuedActionInput memory a = _setupWoodcutting();
        _start(_actions(a, a), ActionQueueStrategy.OVERWRITE);
        vm.warp(block.timestamp + a.timespan / 2);
        _start(_actions(a), ActionQueueStrategy.KEEP_LAST_IN_PROGRESS);
        QueuedAction[] memory q = players.getActionQueue(playerId);
        assertEq(q.length, 2);
        assertEq(q[0].queueId, 1);
        assertEq(q[0].timespan, a.timespan / 2);
        assertEq(q[1].queueId, 3);
        assertEq(q[1].timespan, a.timespan);
    }

    function testQueueRemoveInProgressAndPending() public {
        QueuedActionInput memory a = _setupWoodcutting();
        _start(_actions(a, a), ActionQueueStrategy.OVERWRITE);
        vm.warp(block.timestamp + a.timespan / 2);
        assertEq(players.getActionQueue(playerId).length, 2);
        _start(new QueuedActionInput[](0), ActionQueueStrategy.OVERWRITE);
        assertEq(players.getActionQueue(playerId).length, 0);
    }

    function testQueueRemoveInProgressAndPendingAddOne() public {
        QueuedActionInput memory a = _setupWoodcutting();
        _start(_actions(a, a), ActionQueueStrategy.OVERWRITE);
        vm.warp(block.timestamp + a.timespan / 2);
        assertEq(players.getActionQueue(playerId).length, 2);
        _start(_actions(a), ActionQueueStrategy.OVERWRITE);
        _assertQueue(1, 3, a.timespan);
    }

    function testQueueAppendPending() public {
        QueuedActionInput memory a = _setupWoodcutting();
        _start(_actions(a, a), ActionQueueStrategy.OVERWRITE);
        vm.warp(block.timestamp + a.timespan / 2);
        assertEq(players.getActionQueue(playerId).length, 2);
        _start(_actions(a), ActionQueueStrategy.APPEND);
        QueuedAction[] memory q = players.getActionQueue(playerId);
        assertEq(q.length, 3);
        assertEq(q[0].queueId, 1);
        assertEq(q[1].queueId, 2);
        assertEq(q[2].queueId, 3);
    }

    function testQueueKeepFinishedActionQueueThree() public {
        QueuedActionInput memory basic = _setupWoodcutting();
        QueuedActionInput memory longAction = _queued(ACTION_WOODCUTTING, 0);
        longAction.rightHandEquipmentTokenId = BRONZE_AXE;
        longAction.timespan = 14 hours;
        _start(_actions(longAction), ActionQueueStrategy.OVERWRITE);
        vm.warp(block.timestamp + longAction.timespan + 1);
        QueuedActionInput memory shortAction = _queued(ACTION_WOODCUTTING, 0);
        shortAction.rightHandEquipmentTokenId = BRONZE_AXE;
        shortAction.timespan = 5 hours;
        assertEq(players.getActionQueue(playerId).length, 1);
        _start(_actions(basic, shortAction, shortAction), ActionQueueStrategy.KEEP_LAST_IN_PROGRESS);
        QueuedAction[] memory q = players.getActionQueue(playerId);
        assertEq(q.length, 3);
        assertEq(q[0].queueId, 2);
        assertEq(q[1].queueId, 3);
        assertEq(q[2].queueId, 4);
        assertEq(q[0].timespan, basic.timespan);
        assertEq(q[1].timespan, 5 hours);
        assertEq(q[2].timespan, 5 hours);
        vm.warp(block.timestamp + 50);
        _process();
        q = players.getActionQueue(playerId);
        assertEq(q.length, 3);
        assertEq(q[0].timespan, basic.timespan - 50);
    }

    function testMinimumXPForAction() public {
        QueuedActionInput memory a = _setupWoodcuttingWithMinXP(ORICHALCUM_AXE, uint32(_xpAtLevel(70)));
        vm.prank(ALICE);
        vm.expectRevert(PlayersBase.ActionMinimumXPNotReached.selector);
        players.startActions(playerId, _actions(a), ActionQueueStrategy.OVERWRITE);
        players.modifyXP(ALICE, playerId, Skill.WOODCUTTING, _xpAtLevel(70), true);
        _start(_actions(a), ActionQueueStrategy.OVERWRITE);
    }

    function testActionChoiceMinXP() public {
        QueuedActionInput memory a = _setupFiremaking(uint32(_xpAtLevel(70)));
        vm.prank(ALICE);
        vm.expectRevert(PlayersBase.ActionChoiceMinimumXPNotReached.selector);
        players.startActions(playerId, _actions(a), ActionQueueStrategy.OVERWRITE);
        players.modifyXP(ALICE, playerId, Skill.FIREMAKING, _xpAtLevel(70), true);
        _start(_actions(a), ActionQueueStrategy.OVERWRITE);
    }

    function testActionChoiceMinXPMultipleSkills() public {
        QueuedActionInput memory a = _setupFiremaking(0);
        uint32 x70 = uint32(_xpAtLevel(70));
        uint32 x80 = uint32(_xpAtLevel(80));
        uint32 x90 = uint32(_xpAtLevel(90));
        ActionChoiceInput memory c = _defaultChoice();
        c.skill = uint8(Skill.ALCHEMY);
        c.xpPerHour = 3600;
        c.rate = uint24(100 * RATE_MUL);
        c.inputTokenIds = _uint16s(LOG);
        c.inputAmounts = _uint24s(1);
        c.skills = _skills(Skill.ALCHEMY, Skill.FIREMAKING);
        c.skillMinXPs = _uint32s(x70, x80);
        c.skillDiffs = _int16s(0, 0);
        worldActions.addActionChoices(ACTION_FIREMAKING, _uint16s(2), _choices(c));
        a.choiceId = 2;
        _expectChoiceXPRevert(a);
        players.modifyXP(ALICE, playerId, Skill.ALCHEMY, x70, true);
        _expectChoiceXPRevert(a);
        players.modifyXP(ALICE, playerId, Skill.FIREMAKING, x70, true);
        _expectChoiceXPRevert(a);
        players.modifyXP(ALICE, playerId, Skill.FIREMAKING, x80, true);
        _start(_actions(a), ActionQueueStrategy.OVERWRITE);
        c.skill = uint8(Skill.FIREMAKING);
        c.skills = _skills3(Skill.FIREMAKING, Skill.ALCHEMY, Skill.COOKING);
        c.skillMinXPs = _uint32s3(x80, x70, x90);
        c.skillDiffs = _int16s3(0, 0, 0);
        worldActions.addActionChoices(ACTION_FIREMAKING, _uint16s(3), _choices(c));
        a.choiceId = 3;
        _expectChoiceXPRevert(a);
        players.modifyXP(ALICE, playerId, Skill.COOKING, x90, true);
        _start(_actions(a), ActionQueueStrategy.OVERWRITE);
    }

    function testActionChoiceOutputNumberGreaterThanOne() public {
        QueuedActionInput memory a = _setupFiremaking(0);
        ActionChoiceInput memory c = _defaultChoice();
        c.skill = uint8(Skill.FIREMAKING);
        c.xpPerHour = 3600;
        c.rate = uint24(100 * RATE_MUL);
        c.inputTokenIds = _uint16s(LOG);
        c.inputAmounts = _uint24s(1);
        c.outputTokenId = OAK_LOG;
        c.outputAmount = 2;
        worldActions.addActionChoices(ACTION_FIREMAKING, _uint16s(2), _choices(c));
        a.choiceId = 2;
        _addItem(OAK_LOG, EquipPosition.AUX, Skill.NONE, 0, 0);
        itemNFT.mint(ALICE, LOG, 1000);
        _start(_actions(a), ActionQueueStrategy.OVERWRITE);
        vm.warp(block.timestamp + a.timespan);
        PendingQueuedActionState memory state = players.getPendingQueuedActionState(ALICE, playerId);
        uint256 expected = (uint256(a.timespan) * c.rate * c.outputAmount) / (3600 * RATE_MUL);
        assertEq(state.equipmentStates[0].producedAmounts[0], expected);
        _process();
        assertEq(itemNFT.balanceOf(ALICE, OAK_LOG), expected);
    }

    function testConsumablesFoodMinimumXP() public {
        QueuedActionInput memory a = _setupFiremaking(0);
        a.regenerateId = COOKED_MINNUS;
        _addItem(COOKED_MINNUS, EquipPosition.FOOD, Skill.HEALTH, uint32(_xpAtLevel(70)), 12);
        itemNFT.mint(ALICE, COOKED_MINNUS, 1);
        vm.prank(ALICE);
        vm.expectRevert(PlayersBase.ConsumableMinimumXPNotReached.selector);
        players.startActions(playerId, _actions(a), ActionQueueStrategy.OVERWRITE);
        players.modifyXP(ALICE, playerId, Skill.HEALTH, _xpAtLevel(70), true);
        _start(_actions(a), ActionQueueStrategy.OVERWRITE);
        _start(_actions(a), ActionQueueStrategy.OVERWRITE);
    }

    function testAttireMinimumXP() public {
        QueuedActionInput memory a = _setupWoodcutting();
        uint32 minXP = uint32(_xpAtLevel(70));
        uint16[7] memory ids = [
            BRONZE_HELMET, AMETHYST_AMULET, BRONZE_ARMOR, BRONZE_GAUNTLETS, BRONZE_TASSETS, BRONZE_BOOTS, BRONZE_ARROW
        ];
        EquipPosition[7] memory positions = [
            EquipPosition.HEAD,
            EquipPosition.NECK,
            EquipPosition.BODY,
            EquipPosition.ARMS,
            EquipPosition.LEGS,
            EquipPosition.FEET,
            EquipPosition.RING
        ];
        Skill[7] memory skills =
            [Skill.DEFENCE, Skill.MELEE, Skill.FIREMAKING, Skill.MAGIC, Skill.COOKING, Skill.CRAFTING, Skill.FORGING];
        for (uint256 i; i < ids.length; ++i) {
            _addItem(ids[i], positions[i], skills[i], minXP, 0);
            itemNFT.mint(ALICE, ids[i], 1);
        }
        for (uint256 i; i < ids.length; ++i) {
            Attire memory attire;
            if (i == 0) attire.head = ids[i];
            else if (i == 1) attire.neck = ids[i];
            else if (i == 2) attire.body = ids[i];
            else if (i == 3) attire.arms = ids[i];
            else if (i == 4) attire.legs = ids[i];
            else if (i == 5) attire.feet = ids[i];
            else attire.ring = ids[i];
            a.attire = attire;
            vm.prank(ALICE);
            vm.expectRevert(PlayersBase.AttireMinimumXPNotReached.selector);
            players.startActions(playerId, _actions(a), ActionQueueStrategy.OVERWRITE);
            players.modifyXP(ALICE, playerId, skills[i], minXP, true);
            _start(_actions(a), ActionQueueStrategy.OVERWRITE);
        }
        _createPlayer(ALICE, 1, "0xSamWitch123", true);
    }

    function testLeftRightEquipmentMinimumXP() public {
        QueuedActionInput memory a = _setupWoodcuttingWithMinXP(ORICHALCUM_AXE, 0);
        // The action itself has no minimum; the hand item does.
        itemNFT.editItems(
            _itemInputs(ORICHALCUM_AXE, EquipPosition.RIGHT_HAND, Skill.WOODCUTTING, uint32(_xpAtLevel(70)), 0)
        );
        vm.prank(ALICE);
        vm.expectRevert(PlayersBase.ItemMinimumXPNotReached.selector);
        players.startActions(playerId, _actions(a), ActionQueueStrategy.OVERWRITE);
        players.modifyXP(ALICE, playerId, Skill.WOODCUTTING, _xpAtLevel(70), true);
        _start(_actions(a), ActionQueueStrategy.OVERWRITE);
    }

    function testMissingEquipmentAfterPartialProgressRemovesCurrentOnly() public {
        QueuedActionInput memory a = _setupWoodcutting();
        _start(_actions(a, a, a), ActionQueueStrategy.OVERWRITE);
        vm.warp(block.timestamp + 36);
        _process();
        vm.warp(block.timestamp + 1);
        _transfer(BRONZE_AXE);
        vm.warp(block.timestamp + a.timespan - 200);
        uint256 now_ = block.timestamp;
        _process();
        QueuedAction[] memory q = players.getActionQueue(playerId);
        assertEq(q.length, 2);
        assertEq(q[0].queueId, 2);
        assertEq(q[1].queueId, 3);
        _assertRemoved(now_);
        assertEq(players.getPlayerXP(playerId, Skill.WOODCUTTING), 36);
        assertEq(players.getPlayerXP(playerId, Skill.FIREMAKING), 0);
        assertEq(players.getPlayerXP(playerId, Skill.FISHING), 0);
    }

    function testMissingEquipmentAfterFinishedFirstRemovesSecond() public {
        QueuedActionInput memory w = _setupWoodcutting();
        QueuedActionInput memory f = _setupFiremaking(0);
        QueuedActionInput memory fish = _setupFishing();
        itemNFT.mint(ALICE, LOG, 5000);
        _start(_actions(f, w, fish), ActionQueueStrategy.OVERWRITE);
        vm.warp(block.timestamp + f.timespan);
        _process();
        vm.warp(block.timestamp + 1);
        _transfer(BRONZE_AXE);
        vm.warp(block.timestamp + 1);
        uint256 now_ = block.timestamp;
        _process();
        _assertQueue(1, 3, fish.timespan);
        _assertRemoved(now_);
        assertEq(players.getPlayerXP(playerId, Skill.FIREMAKING), f.timespan);
        assertEq(players.getPlayerXP(playerId, Skill.WOODCUTTING), 0);
        assertEq(players.getPlayerXP(playerId, Skill.FISHING), 0);
    }

    function testMissingEquipmentForOtherTwoRemovesSequentially() public {
        QueuedActionInput memory w = _setupWoodcutting();
        QueuedActionInput memory f = _setupFiremaking(0);
        QueuedActionInput memory fish = _setupFishing();
        itemNFT.mint(ALICE, LOG, 5000);
        _start(_actions(f, w, fish), ActionQueueStrategy.OVERWRITE);
        vm.warp(block.timestamp + f.timespan + 1);
        _process();
        vm.warp(block.timestamp + 1);
        _transfer(BRONZE_AXE);
        vm.warp(block.timestamp + 1);
        _transfer(NET_STICK);
        vm.warp(block.timestamp + 1);
        uint256 now_ = block.timestamp;
        _process();
        _assertQueue(1, 3, fish.timespan);
        _assertRemoved(now_);
        // A newly-current action needs positive elapsed time; Hardhat supplied this on the next auto-mined tx.
        vm.warp(block.timestamp + 2);
        _process();
        assertEq(players.getActionQueue(playerId).length, 0);
        _assertRemoved(0);
        assertEq(players.getPlayerXP(playerId, Skill.FIREMAKING), f.timespan);
        assertEq(players.getPlayerXP(playerId, Skill.WOODCUTTING), 0);
        assertEq(players.getPlayerXP(playerId, Skill.FISHING), 0);
    }

    function testMissingAllEquipmentPartialLastRemovesAll() public {
        QueuedActionInput memory f = _setupFiremaking(0);
        QueuedActionInput memory w = _setupWoodcutting();
        QueuedActionInput memory fish = _setupFishing();
        itemNFT.mint(ALICE, LOG, 10000);
        _start(_actions(f, w, fish), ActionQueueStrategy.OVERWRITE);
        vm.warp(block.timestamp + f.timespan + w.timespan + 1);
        _transfer(MAGIC_FIRE_STARTER);
        _transfer(BRONZE_AXE);
        _transfer(NET_STICK);
        vm.warp(block.timestamp + 1);
        _process();
        assertEq(players.getActionQueue(playerId).length, 0);
        _assertRemoved(0);
        assertEq(players.getPlayerXP(playerId, Skill.FIREMAKING), 3600);
        assertEq(players.getPlayerXP(playerId, Skill.WOODCUTTING), 3600);
        assertEq(players.getPlayerXP(playerId, Skill.FISHING), 0);
    }

    function testMissingAtEndButPresentAtCheckpointsProcessesAll() public {
        QueuedActionInput memory w = _setupWoodcutting();
        QueuedActionInput memory f = _setupFiremaking(0);
        QueuedActionInput memory fish = _setupFishing();
        itemNFT.mint(ALICE, LOG, 5000);
        _start(_actions(f, w, fish), ActionQueueStrategy.OVERWRITE);
        _process();
        vm.warp(block.timestamp + f.timespan + w.timespan + fish.timespan);
        _transfer(MAGIC_FIRE_STARTER);
        _transfer(BRONZE_AXE);
        _transfer(NET_STICK);
        _process();
        assertEq(players.getActionQueue(playerId).length, 0);
        _assertRemoved(0);
        assertEq(players.getPlayerXP(playerId, Skill.FIREMAKING), f.timespan);
        assertEq(players.getPlayerXP(playerId, Skill.WOODCUTTING), w.timespan);
        assertEq(players.getPlayerXP(playerId, Skill.FISHING), fish.timespan);
    }

    function testMissingMiddleEquipmentFinishedActionsProducedCorrectly() public {
        QueuedActionInput memory w = _setupWoodcutting();
        QueuedActionInput memory f = _setupFiremaking(0);
        QueuedActionInput memory fish = _setupFishing();
        itemNFT.mint(ALICE, LOG, 5000);
        _start(_actions(w, f, fish), ActionQueueStrategy.OVERWRITE);
        vm.warp(block.timestamp + 1);
        _transfer(MAGIC_FIRE_STARTER);
        vm.warp(block.timestamp + w.timespan + f.timespan + fish.timespan);
        PendingQueuedActionState memory state = players.getPendingQueuedActionState(ALICE, playerId);
        assertEq(state.equipmentStates.length, 2);
        assertEq(state.equipmentStates[0].producedItemTokenIds[0], LOG);
        assertEq(state.equipmentStates[1].producedItemTokenIds[0], RAW_MINNUS);
        _process();
        assertEq(players.getPlayerXP(playerId, Skill.WOODCUTTING), 3600);
        assertEq(players.getPlayerXP(playerId, Skill.FIREMAKING), 0);
        assertEq(players.getPlayerXP(playerId, Skill.FISHING), 3600);
    }

    function _setupWoodcutting() private returns (QueuedActionInput memory) {
        return _setupGathering(ACTION_WOODCUTTING, Skill.WOODCUTTING, BRONZE_AXE, WOODCUTTING_MAX, LOG, 0);
    }

    function _setupFishing() private returns (QueuedActionInput memory) {
        return _setupGathering(ACTION_FISHING, Skill.FISHING, NET_STICK, FISHING_MAX, RAW_MINNUS, 0);
    }

    function _setupWoodcuttingWithMinXP(uint16 axe, uint32 minXP) private returns (QueuedActionInput memory) {
        return _setupGathering(ACTION_WOODCUTTING, Skill.WOODCUTTING, axe, WOODCUTTING_MAX, LOG, minXP);
    }

    function _setupGathering(uint16 id, Skill skill, uint16 hand, uint16 maxHand, uint16 reward, uint32 minXP)
        private
        returns (QueuedActionInput memory q)
    {
        ActionInput memory a;
        a.actionId = id;
        a.info = _actionInfo(skill, 3600, false, hand, maxHand);
        a.info.minXP = minXP;
        a.guaranteedRewards = new GuaranteedReward[](1);
        a.guaranteedRewards[0] = GuaranteedReward(reward, uint16(100 * GUAR_MUL));
        _addAction(a);
        _addItem(hand, EquipPosition.RIGHT_HAND, Skill.NONE, 0, 0);
        if (hand == ORICHALCUM_AXE) itemNFT.mint(ALICE, hand, 1);
        q = _queued(id, 0);
        q.rightHandEquipmentTokenId = hand;
    }

    function _setupFiremaking(uint32 minXP) private returns (QueuedActionInput memory q) {
        ActionInput memory a;
        a.actionId = ACTION_FIREMAKING;
        a.info = _actionInfo(Skill.FIREMAKING, 0, true, MAGIC_FIRE_STARTER, FIRE_MAX);
        _addAction(a);
        ActionChoiceInput memory c = _defaultChoice();
        c.skill = uint8(Skill.FIREMAKING);
        c.xpPerHour = 3600;
        c.rate = uint24(100 * RATE_MUL);
        if (minXP != 0) {
            c.skills = _skill(Skill.FIREMAKING);
            c.skillMinXPs = _uint32(minXP);
            c.skillDiffs = _int16(0);
        }
        c.inputTokenIds = _uint16s(LOG);
        c.inputAmounts = _uint24s(1);
        worldActions.addActionChoices(ACTION_FIREMAKING, _uint16s(1), _choices(c));
        _addItem(MAGIC_FIRE_STARTER, EquipPosition.RIGHT_HAND, Skill.NONE, 0, 0);
        _addItem(LOG, EquipPosition.AUX, Skill.NONE, 0, 0);
        q = _queued(ACTION_FIREMAKING, 1);
        q.rightHandEquipmentTokenId = MAGIC_FIRE_STARTER;
    }

    function _actionInfo(Skill skill, uint24 xp, bool choice, uint16 minHand, uint16 maxHand)
        private
        pure
        returns (ActionInfo memory i)
    {
        i.skill = uint8(skill);
        i.xpPerHour = xp;
        i.actionChoiceRequired = choice;
        i.handItemTokenIdRangeMin = minHand;
        i.handItemTokenIdRangeMax = maxHand;
        i.successPercent = 100;
        i.isAvailable = true;
    }

    function _queued(uint16 id, uint16 choice) private pure returns (QueuedActionInput memory q) {
        q.actionId = id;
        q.choiceId = choice;
        q.timespan = 3600;
        q.combatStyle = uint8(CombatStyle.NONE);
    }

    function _defaultChoice() private pure returns (ActionChoiceInput memory c) {
        c.successPercent = 100;
        c.isAvailable = true;
    }

    function _addAction(ActionInput memory a) private {
        ActionInput[] memory v = new ActionInput[](1);
        v[0] = a;
        worldActions.addActions(v);
    }

    function _addItem(uint16 id, EquipPosition p, Skill s, uint32 xp, uint16 health) private {
        itemNFT.addItems(_itemInputs(id, p, s, xp, health));
    }

    function _itemInputs(uint16 id, EquipPosition p, Skill s, uint32 xp, uint16 health)
        private
        pure
        returns (ItemInput[] memory v)
    {
        v = new ItemInput[](1);
        v[0].tokenId = id;
        v[0].equipPosition = p;
        v[0].skill = s;
        v[0].minXP = xp;
        v[0].healthRestored = health;
        v[0].isTransferable = true;
        v[0].isAvailable = true;
        v[0].name = "TEST";
        v[0].metadataURI = "TEST.json";
    }

    function _start(QueuedActionInput[] memory a, ActionQueueStrategy s) private {
        vm.prank(ALICE);
        players.startActions(playerId, a, s);
    }

    function _process() private {
        vm.prank(ALICE);
        players.processActions(playerId);
    }

    function _transfer(uint16 id) private {
        vm.prank(ALICE);
        itemNFT.safeTransferFrom(ALICE, address(this), id, 1, "");
    }

    function _assertQueue(uint256 len, uint256 id, uint256 span) private view {
        QueuedAction[] memory q = players.getActionQueue(playerId);
        assertEq(q.length, len);
        assertEq(q[0].queueId, id);
        assertEq(q[0].timespan, span);
    }

    function _assertRemoved(uint256 timestamp) private view {
        Player memory p = IPlayersMisc1DelegateView(address(players)).getPlayer(playerId);
        assertEq(p.currentActionStartTimestamp, timestamp);
        assertEq(uint8(p.currentActionProcessedSkill1), uint8(Skill.NONE));
        assertEq(p.currentActionProcessedXPGained1, 0);
        assertEq(uint8(p.currentActionProcessedSkill2), uint8(Skill.NONE));
        assertEq(p.currentActionProcessedXPGained2, 0);
        assertEq(uint8(p.currentActionProcessedSkill3), uint8(Skill.NONE));
        assertEq(p.currentActionProcessedXPGained3, 0);
        assertEq(p.currentActionProcessedFoodConsumed, 0);
        assertEq(p.currentActionProcessedBaseInputItemsConsumedNum, 0);
    }

    function _expectChoiceXPRevert(QueuedActionInput memory a) private {
        vm.prank(ALICE);
        vm.expectRevert(PlayersBase.ActionChoiceMinimumXPNotReached.selector);
        players.startActions(playerId, _actions(a), ActionQueueStrategy.OVERWRITE);
    }

    function _choices(ActionChoiceInput memory c) private pure returns (ActionChoiceInput[] memory v) {
        v = new ActionChoiceInput[](1);
        v[0] = c;
    }

    function _actions(QueuedActionInput memory a) private pure returns (QueuedActionInput[] memory v) {
        v = new QueuedActionInput[](1);
        v[0] = a;
    }

    function _actions(QueuedActionInput memory a, QueuedActionInput memory b)
        private
        pure
        returns (QueuedActionInput[] memory v)
    {
        v = new QueuedActionInput[](2);
        v[0] = a;
        v[1] = b;
    }

    function _actions(QueuedActionInput memory a, QueuedActionInput memory b, QueuedActionInput memory c)
        private
        pure
        returns (QueuedActionInput[] memory v)
    {
        v = new QueuedActionInput[](3);
        v[0] = a;
        v[1] = b;
        v[2] = c;
    }

    function _skills(Skill a, Skill b) private pure returns (uint8[] memory v) {
        v = new uint8[](2);
        v[0] = uint8(a);
        v[1] = uint8(b);
    }

    function _skill(Skill a) private pure returns (uint8[] memory v) {
        v = new uint8[](1);
        v[0] = uint8(a);
    }

    function _skills3(Skill a, Skill b, Skill c) private pure returns (uint8[] memory v) {
        v = new uint8[](3);
        v[0] = uint8(a);
        v[1] = uint8(b);
        v[2] = uint8(c);
    }

    function _uint32s(uint32 a, uint32 b) private pure returns (uint32[] memory v) {
        v = new uint32[](2);
        v[0] = a;
        v[1] = b;
    }

    function _uint32(uint32 a) private pure returns (uint32[] memory v) {
        v = new uint32[](1);
        v[0] = a;
    }

    function _uint32s3(uint32 a, uint32 b, uint32 c) private pure returns (uint32[] memory v) {
        v = new uint32[](3);
        v[0] = a;
        v[1] = b;
        v[2] = c;
    }

    function _int16s(int16 a, int16 b) private pure returns (int16[] memory v) {
        v = new int16[](2);
        v[0] = a;
        v[1] = b;
    }

    function _int16(int16 a) private pure returns (int16[] memory v) {
        v = new int16[](1);
        v[0] = a;
    }

    function _int16s3(int16 a, int16 b, int16 c) private pure returns (int16[] memory v) {
        v = new int16[](3);
        v[0] = a;
        v[1] = b;
        v[2] = c;
    }
}
