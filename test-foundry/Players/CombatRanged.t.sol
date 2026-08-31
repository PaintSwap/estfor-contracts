// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {CombatTestBase} from "./CombatTestBase.sol";
import {Skill, CombatStyle, CombatStats} from "../../contracts/globals/misc.sol";
import {
    ActionQueueStrategy,
    QueuedActionInput,
    GUAR_MUL,
    RATE_MUL,
    SPAWN_MUL
} from "../../contracts/globals/actions.sol";
import {
    ActionChoiceInput,
    EquipPosition,
    ItemInput,
    PendingQueuedActionState,
    Player
} from "../../contracts/globals/players.sol";
import {PlayersBase} from "../../contracts/Players/PlayersBase.sol";
import {PlayersImplMisc1} from "../../contracts/Players/PlayersImplMisc1.sol";
import {CombatStyleLibrary} from "../../contracts/libraries/CombatStyleLibrary.sol";
import {NONE, BASIC_BOW, BRONZE_SWORD} from "../../contracts/globals/items.sol";

contract CombatRangedTest is CombatTestBase {
    uint16 private constant IRON_HELMET = 2_201;

    function testRangedAttack() public {
        (QueuedActionInput memory action, uint256 id, uint256 rate, uint256 spawned) = _setupRanged();
        _start(id, action);
        vm.warp(vm.getBlockTimestamp() + action.timespan);
        _process(id);
        assertEq(players.getPlayerXP(id, Skill.RANGED), START_XP + 3960);
        _assertWithinOne(players.getPlayerXP(id, Skill.HEALTH), 1200);
        assertEq(players.getPlayerXP(id, Skill.DEFENCE), 0);
        assertEq(
            itemNFT.balanceOf(ALICE, NATURE_SCROLL), action.timespan * rate * spawned / (3600 * GUAR_MUL * SPAWN_MUL)
        );
        assertEq(itemNFT.balanceOf(ALICE, COOKED_MINNUS), 998);
        assertEq(itemNFT.balanceOf(ALICE, BRONZE_ARROW), 190);
    }

    function testRangedExpectedBowRequired() public {
        (QueuedActionInput memory action, uint256 id,,) = _setupRanged();
        itemNFT.addItems(_items(_item(GODLY_BOW, EquipPosition.BOTH_HANDS)));
        itemNFT.mint(ALICE, GODLY_BOW, 1);
        action.rightHandEquipmentTokenId = GODLY_BOW;
        vm.expectRevert(abi.encodeWithSelector(PlayersBase.InvalidHandEquipment.selector, GODLY_BOW));
        _start(id, action);
    }

    function testRangedForgedGodlyBowRange() public {
        (QueuedActionInput memory action, uint256 id,,) = _setupRanged();
        ActionChoiceInput memory choice = _singleInputChoice(
            Skill.RANGED, uint24(RATE_MUL), BRONZE_ARROW, 1, Skill.RANGED, 5, GODLY_BOW, GODLY_BOW_4
        );
        worldActions.addActionChoices(NONE, _uint16s(4), _choices(choice));
        action.choiceId = 4;
        ItemInput[] memory items = new ItemInput[](3);
        items[0] = _item(INFUSED_GODLY_BOW, EquipPosition.NONE);
        items[1] = _item(GODLY_BOW_4, EquipPosition.BOTH_HANDS);
        items[2] = _item(GODLY_BOW_5, EquipPosition.BOTH_HANDS);
        itemNFT.addItems(items);
        itemNFT.mint(ALICE, GODLY_BOW_5, 1);
        action.rightHandEquipmentTokenId = GODLY_BOW_5;
        vm.expectRevert(abi.encodeWithSelector(PlayersBase.InvalidHandEquipment.selector, GODLY_BOW_5));
        _start(id, action);
        itemNFT.mint(ALICE, INFUSED_GODLY_BOW, 1);
        action.rightHandEquipmentTokenId = INFUSED_GODLY_BOW;
        vm.expectRevert(abi.encodeWithSelector(PlayersBase.IncorrectRightHandEquipment.selector, INFUSED_GODLY_BOW));
        _start(id, action);
        itemNFT.mint(ALICE, GODLY_BOW_4, 1);
        action.rightHandEquipmentTokenId = GODLY_BOW_4;
        _start(id, action);
    }

    function testRangedRemovingBowSkipsCombat() public {
        (QueuedActionInput memory action, uint256 id,,) = _setupRanged();
        _start(id, action);
        vm.prank(ALICE);
        itemNFT.burn(ALICE, BASIC_BOW, 2);
        assertEq(itemNFT.balanceOf(ALICE, BASIC_BOW), 0);
        vm.warp(vm.getBlockTimestamp() + action.timespan);
        _process(id);
        assertEq(players.getPlayerXP(id, Skill.RANGED), START_XP);
        assertEq(players.getPlayerXP(id, Skill.HEALTH), 0);
        assertEq(players.getPlayerXP(id, Skill.DEFENCE), 0);
        assertEq(itemNFT.balanceOf(ALICE, BRONZE_ARROW), 200);
    }

    function testRangedNoBowNotAllowed() public {
        (QueuedActionInput memory action, uint256 id,,) = _setupRanged();
        action.rightHandEquipmentTokenId = NONE;
        vm.expectRevert(PlayersBase.IncorrectEquippedItem.selector);
        _start(id, action);
    }

    function testRangedCannotEquipShieldWithBow() public {
        (QueuedActionInput memory action, uint256 id,,) = _setupRanged();
        action.leftHandEquipmentTokenId = BRONZE_SHIELD;
        vm.expectRevert(abi.encodeWithSelector(PlayersBase.InvalidHandEquipment.selector, BRONZE_SHIELD));
        _start(id, action);
        action.leftHandEquipmentTokenId = NONE;
        _start(id, action);
    }

    function testRangedEnemyDealingRangedDamage() public {
        (QueuedActionInput memory action, uint256 id, uint256 rate, uint256 spawned) = _setupRanged();
        _addCombatAction(2, uint24(spawned), CombatStats(0, 0, 3, 5, 0, 0, 0), NATURE_SCROLL, uint16(rate), false);
        action.actionId = 2;
        _start(id, action);
        vm.warp(vm.getBlockTimestamp() + action.timespan);
        _process(id);
        assertEq(players.getPlayerXP(id, Skill.RANGED), START_XP + 3960);
        _assertWithinOne(players.getPlayerXP(id, Skill.HEALTH), 1200);
        assertEq(players.getPlayerXP(id, Skill.DEFENCE), 0);
        assertEq(itemNFT.balanceOf(ALICE, NATURE_SCROLL), 10);
        assertEq(itemNFT.balanceOf(ALICE, COOKED_MINNUS), 998);
        assertEq(itemNFT.balanceOf(ALICE, BRONZE_ARROW), 190);
    }

    function testDeadKillAllButInsufficientFood() public {
        (QueuedActionInput memory action, uint256 food) =
            _deadSetup(CombatStats(3, 0, 0, 1, 0, 0, 0), 100, 100, 3 hours, true);
        _start(playerId, action);
        vm.warp(vm.getBlockTimestamp() + 1 hours);
        PendingQueuedActionState memory state = _pending(playerId);
        assertTrue(state.actionMetadatas[0].died);
        assertEq(state.actionMetadatas[0].actionId, action.actionId);
        assertEq(state.actionMetadatas[0].queueId, 1);
        assertEq(state.equipmentStates[0].producedItemTokenIds.length, 1);
        assertEq(state.producedPastRandomRewards.length, 0);
        assertEq(state.equipmentStates[0].consumedItemTokenIds.length, 1);
        assertEq(state.equipmentStates[0].consumedAmounts[0], food);
        assertEq(state.equipmentStates[0].consumedItemTokenIds[0], COOKED_MINNUS);
        _process(playerId);
        assertEq(players.getPlayerXP(playerId, Skill.MELEE), 1332);
        assertEq(itemNFT.balanceOf(ALICE, BRONZE_ARROW), 222000);
        assertEq(itemNFT.balanceOf(ALICE, COOKED_MINNUS), 0);
        _start(playerId, action);
        vm.warp(vm.getBlockTimestamp() + 1 hours + 1);
        state = _pending(playerId);
        assertTrue(state.actionMetadatas[0].died);
        assertEq(state.equipmentStates[0].producedItemTokenIds.length, 0);
        assertEq(state.producedPastRandomRewards.length, 0);
        assertEq(state.equipmentStates[0].consumedItemTokenIds.length, 0);
    }

    function testDeadFoodOverUint16WithPartialProgress() public {
        (QueuedActionInput memory action, uint256 food) =
            _deadSetup(CombatStats(30, 0, 0, 100, 0, 0, 0), 100, 100, 24 hours, true);
        _start(playerId, action);
        vm.warp(vm.getBlockTimestamp() + 30);
        PendingQueuedActionState memory state = _pending(playerId);
        assertFalse(state.actionMetadatas[0].died);
        assertEq(state.equipmentStates[0].consumedItemTokenIds.length, 1);
        uint256 consumed = state.equipmentStates[0].consumedAmounts[0];
        assertLt(consumed, food);
        _process(playerId);
        Player memory player = PlayersImplMisc1(address(players)).getPlayer(playerId);
        uint256 actual = player.currentActionProcessedFoodConsumed;
        assertTrue(actual >= consumed && actual <= consumed + 2);
        vm.warp(vm.getBlockTimestamp() + 24 hours);
        state = _pending(playerId);
        assertTrue(state.actionMetadatas[0].died);
        assertEq(state.equipmentStates[0].consumedAmounts[0], food - actual);
        _process(playerId);
        assertEq(itemNFT.balanceOf(ALICE, COOKED_MINNUS), 0);
    }

    function testNegativeHealthUsesMoreFood() public {
        (QueuedActionInput memory action,,) = _setupMelee();
        ItemInput memory helmet = _item(IRON_HELMET, EquipPosition.HEAD);
        helmet.combatStats.health = -100;
        itemNFT.addItems(_items(helmet));
        itemNFT.mint(ALICE, IRON_HELMET, 1);
        action.attire.head = IRON_HELMET;
        _start(playerId, action);
        vm.warp(vm.getBlockTimestamp() + 1 hours);
        _process(playerId);
        assertEq(itemNFT.balanceOf(ALICE, COOKED_MINNUS), 244);
        assertEq(itemNFT.balanceOf(ALICE, NONE), 0);
    }

    function testDeadDontKillAll() public {
        (QueuedActionInput memory action, uint256 food) =
            _deadSetup(CombatStats(3, 0, 0, 100, 0, 0, 0), 100, 2, 3 hours, false);
        _start(playerId, action);
        vm.warp(vm.getBlockTimestamp() + action.timespan);
        PendingQueuedActionState memory state = _pending(playerId);
        assertTrue(state.actionMetadatas[0].died);
        assertEq(state.actionMetadatas[0].actionId, action.actionId);
        assertEq(state.actionMetadatas[0].queueId, 1);
        assertEq(state.equipmentStates[0].producedItemTokenIds.length, 0);
        assertEq(state.producedPastRandomRewards.length, 0);
        assertEq(state.equipmentStates[0].consumedItemTokenIds.length, 1);
        assertEq(state.equipmentStates[0].consumedAmounts[0], food);
        assertEq(state.equipmentStates[0].consumedItemTokenIds[0], COOKED_MINNUS);
        _process(playerId);
        assertEq(players.getPlayerXP(playerId, Skill.MELEE), 0);
        assertEq(itemNFT.balanceOf(ALICE, BRONZE_ARROW), 0);
        assertEq(itemNFT.balanceOf(ALICE, COOKED_MINNUS), 0);
    }

    function testInvalidCombatStylesRevert() public {
        (QueuedActionInput memory action,,) = _setupMelee();
        action.combatStyle = uint8(CombatStyle.NONE);
        vm.expectRevert(PlayersBase.InvalidCombatStyle.selector);
        _start(playerId, action);
        action.combatStyle = 3;
        vm.expectRevert(abi.encodeWithSelector(CombatStyleLibrary.InvalidCombatStyleId.selector, 3));
        _start(playerId, action);
        action.combatStyle = uint8(CombatStyle.ATTACK);
        _start(playerId, action);
    }

    function _deadSetup(CombatStats memory stats, uint24 spawned, uint256 food, uint24 timespan, bool helmet)
        private
        returns (QueuedActionInput memory action, uint256)
    {
        _addCombatAction(
            COMBAT_ACTION,
            uint24(spawned * SPAWN_MUL),
            stats,
            BRONZE_ARROW,
            uint16(helmet ? 6000 * GUAR_MUL : GUAR_MUL),
            false
        );
        worldActions.addActionChoices(NONE, _uint16s(MELEE_CHOICE), _choices(_defaultChoice(Skill.MELEE)));
        ItemInput[] memory items = new ItemInput[](helmet ? 3 : 2);
        items[0] = _item(BRONZE_SWORD, EquipPosition.RIGHT_HAND);
        items[1] = _food(COOKED_MINNUS, 1);
        if (helmet) items[2] = _item(BRONZE_HELMET, EquipPosition.HEAD);
        itemNFT.addItems(items);
        if (helmet) itemNFT.mintBatch(ALICE, _uints(BRONZE_SWORD, COOKED_MINNUS, BRONZE_HELMET), _uints(1, food, 1));
        else itemNFT.mintBatch(ALICE, _uints(BRONZE_SWORD, COOKED_MINNUS), _uints(1, food));
        action = _combatQueue(COMBAT_ACTION, MELEE_CHOICE, COOKED_MINNUS, BRONZE_SWORD);
        action.timespan = timespan;
        if (helmet) action.attire.head = BRONZE_HELMET;
        return (action, food);
    }

    function _items(ItemInput memory item) private pure returns (ItemInput[] memory values) {
        values = new ItemInput[](1);
        values[0] = item;
    }
}
