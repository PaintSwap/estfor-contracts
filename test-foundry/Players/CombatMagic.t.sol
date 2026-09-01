// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {CombatTestBase} from "./CombatTestBase.sol";
import {Skill, CombatStats} from "../../contracts/globals/misc.sol";
import {
    ActionQueueStrategy,
    QueuedActionInput,
    GUAR_MUL,
    RATE_MUL,
    SPAWN_MUL
} from "../../contracts/globals/actions.sol";
import {
    ActionChoiceInput,
    AvatarInfo,
    EquipPosition,
    ItemInput,
    PendingQueuedActionState,
    Player
} from "../../contracts/globals/players.sol";
import {NONE, SHADOW_SCROLL} from "../../contracts/globals/items.sol";
import {PlayersBase} from "../interfaces/PlayersBase.sol";
import {PlayersImplMisc1} from "../interfaces/PlayersImplMisc1.sol";

contract CombatMagicTest is CombatTestBase {
    uint16 private constant IRON_GAUNTLETS = 2_102;

    function testAttack() public {
        (QueuedActionInput memory action, uint256 rate, uint256 spawned) = _setupMagic();
        _run(action);
        _assertStandard(action, START_XP, rate, spawned, 2);
    }

    function testAttackDefensiveScrolls() public {
        (QueuedActionInput memory action, uint256 rate, uint256 spawned) = _setupMagic();
        ActionChoiceInput memory choice =
            _inputChoice(Skill.MAGIC, uint24(RATE_MUL), SHADOW_SCROLL, 1, AIR_SCROLL, 2, Skill.DEFENCE, 100);
        worldActions.addActionChoices(NONE, _uint16s(4), _choices(choice));
        action.choiceId = 4;
        _run(action);
        _assertStandard(action, START_XP, rate, spawned, 1);
    }

    function testAttackHealthScrolls() public {
        (QueuedActionInput memory action, uint256 rate, uint256 spawned) = _setupMagic();
        ActionChoiceInput memory choice =
            _inputChoice(Skill.MAGIC, uint24(RATE_MUL), SHADOW_SCROLL, 1, AIR_SCROLL, 2, Skill.HEALTH, 100);
        worldActions.addActionChoices(NONE, _uint16s(4), _choices(choice));
        action.choiceId = 4;
        _run(action);
        _assertCombatXPAndDrops(action, START_XP, rate, spawned);
        assertEq(itemNFT.balanceOf(ALICE, COOKED_MINNUS), 1000);
        _assertScrollBalances(180, 90);
    }

    function testInProgressCombatUpdate() public {
        QueuedActionInput memory action = _setupFastMagic();
        _start(playerId, action);
        vm.warp(vm.getBlockTimestamp() + 36);
        _process(playerId);
        assertEq(players.getPlayerXP(playerId, Skill.MAGIC), START_XP);
        assertEq(itemNFT.balanceOf(ALICE, BRONZE_ARROW), 0);
        vm.warp(vm.getBlockTimestamp() + 30);
        _process(playerId);
        assertEq(players.getPlayerXP(playerId, Skill.MAGIC), START_XP);
        assertEq(itemNFT.balanceOf(ALICE, BRONZE_ARROW), 0);
        vm.warp(vm.getBlockTimestamp() + 10);
        _process(playerId);
        assertEq(players.getPlayerXP(playerId, Skill.MAGIC), START_XP + (uint256(36) * 11) / 10);
        assertEq(itemNFT.balanceOf(ALICE, BRONZE_ARROW), GUAR_MUL / 10);
        assertEq(itemNFT.balanceOf(ALICE, COOKED_MINNUS), 999);
        _assertScrollBalances(194, 97);
        vm.warp(vm.getBlockTimestamp() + action.timespan);
        _process(playerId);
        _assertScrollBalances(0, 0);
        assertEq(players.getPlayerXP(playerId, Skill.MAGIC), START_XP + (action.timespan * 5 * 11) / 100);
        assertEq(players.getPlayerXP(playerId, Skill.HEALTH), action.timespan / 6);
    }

    function testInProgressCombatUpdatesMany() public {
        QueuedActionInput memory action = _setupFastMagic();
        _start(playerId, action);
        uint256[15] memory intervals = [uint256(17), 83, 239, 41, 156, 7, 211, 64, 120, 199, 32, 145, 73, 226, 98];
        for (uint256 i; i < intervals.length; ++i) {
            vm.warp(vm.getBlockTimestamp() + intervals[i]);
            _process(playerId);
        }
        vm.warp(vm.getBlockTimestamp() + action.timespan);
        _process(playerId);
        _assertScrollBalances(0, 0);
        assertEq(players.getPlayerXP(playerId, Skill.MAGIC), START_XP + (action.timespan * 5 * 11) / 100);
        assertEq(players.getPlayerXP(playerId, Skill.HEALTH), action.timespan / 6);
    }

    function testNoBonusXP() public {
        (QueuedActionInput memory action, uint256 rate, uint256 spawned) = _setupMagic();
        AvatarInfo[] memory avatars = new AvatarInfo[](1);
        avatars[0] = AvatarInfo("Name", "Description", "1234.png", [Skill.WOODCUTTING, Skill.NONE]);
        playerNFT.setAvatars(_uints(2), avatars);
        uint256 noSkillPlayerId = _createPlayer(ALICE, 2, "fakename123", true);
        _start(noSkillPlayerId, action);
        vm.warp(vm.getBlockTimestamp() + action.timespan);
        _process(noSkillPlayerId);
        assertEq(players.getPlayerXP(noSkillPlayerId, Skill.MAGIC), action.timespan);
        _assertWithinOne(players.getPlayerXP(noSkillPlayerId, Skill.HEALTH), action.timespan / 3);
        assertEq(players.getPlayerXP(noSkillPlayerId, Skill.DEFENCE), 0);
        assertEq(itemNFT.balanceOf(ALICE, BRONZE_ARROW), _drops(action.timespan, rate, spawned));
        assertEq(itemNFT.balanceOf(ALICE, COOKED_MINNUS), 996);
        _assertScrollBalances(180, 90);
    }

    function testNoStaffEquipped() public {
        (QueuedActionInput memory action, uint256 rate, uint256 spawned) = _setupMagic();
        action.rightHandEquipmentTokenId = NONE;
        _run(action);
        _assertCombatXPAndDrops(action, START_XP, rate, spawned);
        assertEq(players.getPlayerXP(playerId, Skill.DEFENCE), 0);
        assertEq(itemNFT.balanceOf(ALICE, COOKED_MINNUS), 998);
        _assertScrollBalances(180, 90);
    }

    function testCannotEquipShieldWithStaff() public {
        (QueuedActionInput memory action,,) = _setupMagic();
        action.leftHandEquipmentTokenId = BRONZE_SHIELD;
        vm.prank(ALICE);
        vm.expectRevert(PlayersBase.CannotEquipTwoHandedAndOtherEquipment.selector);
        players.startActions(playerId, _actions(action), ActionQueueStrategy.OVERWRITE);
        action.leftHandEquipmentTokenId = NONE;
        _start(playerId, action);
    }

    function testLargeNegativeMagicDefenceAgainstLowCombatEnemy() public {
        (QueuedActionInput memory action,,) = _setupMagic();
        ItemInput memory gauntlets = _item(IRON_GAUNTLETS, EquipPosition.ARMS);
        gauntlets.combatStats.magicDefence = -10_000;
        itemNFT.addItems(_items(gauntlets));
        itemNFT.mint(ALICE, IRON_GAUNTLETS, 1);
        action.attire.arms = IRON_GAUNTLETS;
        action.timespan = 24 hours;
        _start(playerId, action);
        vm.warp(vm.getBlockTimestamp() + action.timespan);
        assertFalse(_pending(playerId).actionMetadatas[0].died);
    }

    function testNoScrollsDuringProcessing() public {
        (QueuedActionInput memory action,,) = _setupMagic();
        _start(playerId, action);
        uint256 airBalance = itemNFT.balanceOf(ALICE, AIR_SCROLL);
        vm.prank(ALICE);
        itemNFT.burn(ALICE, AIR_SCROLL, airBalance);
        vm.warp(vm.getBlockTimestamp() + action.timespan);
        _process(playerId);
        assertEq(players.getPlayerXP(playerId, Skill.MAGIC), START_XP);
        assertEq(players.getPlayerXP(playerId, Skill.DEFENCE), 0);
        assertEq(itemNFT.balanceOf(ALICE, COOKED_MINNUS), 960);
        _assertScrollBalances(0, 100);
    }

    function testCurrentActionInProgressActions() public {
        (QueuedActionInput memory action,,) = _setupMagic();
        _start(playerId, action);
        vm.warp(vm.getBlockTimestamp() + action.timespan / 2);
        _process(playerId);
        uint256 gained = (action.timespan / 2 * 11) / 10;
        assertEq(players.getPlayerXP(playerId, Skill.MAGIC), START_XP + gained);
        Player memory player = PlayersImplMisc1(address(players)).getPlayer(playerId);
        _assertCurrent(player, gained, action.timespan / 6);
        vm.warp(vm.getBlockTimestamp() + 10);
        _process(playerId);
        player = PlayersImplMisc1(address(players)).getPlayer(playerId);
        _assertCurrent(player, gained, action.timespan / 6);
        assertEq(itemNFT.balanceOf(ALICE, COOKED_MINNUS), 999);
        _assertScrollBalances(190, 95);
        vm.warp(vm.getBlockTimestamp() + action.timespan);
        _process(playerId);
        player = PlayersImplMisc1(address(players)).getPlayer(playerId);
        assertEq(player.currentActionStartTimestamp, 0);
        assertEq(uint8(player.currentActionProcessedSkill1), uint8(Skill.NONE));
        assertEq(player.currentActionProcessedXPGained1, 0);
        assertEq(uint8(player.currentActionProcessedSkill2), uint8(Skill.NONE));
        assertEq(player.currentActionProcessedXPGained2, 0);
        assertEq(player.currentActionProcessedFoodConsumed, 0);
        assertEq(player.currentActionProcessedBaseInputItemsConsumedNum, 0);
    }

    function testInProgressScrollAvailabilityChanges() public {
        (QueuedActionInput memory action, uint256 rate, uint256 spawned) = _setupMagic();
        _start(playerId, action);
        vm.warp(vm.getBlockTimestamp() + action.timespan / 4);
        _process(playerId);
        _assertScrollBalances(196, 98);
        assertEq(itemNFT.balanceOf(ALICE, COOKED_MINNUS), 999);
        vm.prank(ALICE);
        itemNFT.burn(ALICE, SHADOW_SCROLL, 95);
        uint256 initialDrops = _drops(action.timespan / 5, rate, spawned);
        assertEq(itemNFT.balanceOf(ALICE, BRONZE_ARROW), initialDrops);
        uint256 gained = (action.timespan * 2 * 11) / 100;
        assertEq(players.getPlayerXP(playerId, Skill.MAGIC), START_XP + gained);
        vm.warp(vm.getBlockTimestamp() + action.timespan / 4);
        assertEq(_pending(playerId).processedData.currentAction.foodConsumed, 1);
        vm.prank(ALICE);
        itemNFT.burn(ALICE, SHADOW_SCROLL, 2);
        assertEq(_pending(playerId).processedData.currentAction.foodConsumed, 9);
        _process(playerId);
        assertEq(itemNFT.balanceOf(ALICE, COOKED_MINNUS), 991);
        assertEq(itemNFT.balanceOf(ALICE, BRONZE_ARROW), initialDrops + 1);
        gained += (action.timespan * 2 * 5 * 11) / 1000;
        assertEq(players.getPlayerXP(playerId, Skill.MAGIC), START_XP + gained);
        vm.warp(vm.getBlockTimestamp() + action.timespan / 4);
        itemNFT.mint(ALICE, SHADOW_SCROLL, 100);
        _process(playerId);
        assertEq(itemNFT.balanceOf(ALICE, COOKED_MINNUS), 991);
        assertEq(itemNFT.balanceOf(ALICE, BRONZE_ARROW), initialDrops + 5);
        gained += (action.timespan * 4 * 11) / 100;
        assertEq(players.getPlayerXP(playerId, Skill.MAGIC), START_XP + gained);
        vm.warp(vm.getBlockTimestamp() + action.timespan / 4);
        _process(playerId);
        assertEq(itemNFT.balanceOf(ALICE, COOKED_MINNUS), 991);
        assertEq(itemNFT.balanceOf(ALICE, BRONZE_ARROW), _drops(action.timespan, rate, spawned));
        assertEq(players.getPlayerXP(playerId, Skill.MAGIC), START_XP + (action.timespan * 11) / 10);
    }

    function testAddMultiActionChoice() public {
        (QueuedActionInput memory action,,) = _setupMagic();
        ActionChoiceInput[] memory choices = new ActionChoiceInput[](2);
        choices[0] = _inputChoice(Skill.MAGIC, uint24(RATE_MUL), AIR_SCROLL, 1, SHADOW_SCROLL, 1, Skill.MAGIC, 2);
        choices[1] = _inputChoice(Skill.MAGIC, uint24(RATE_MUL), SHADOW_SCROLL, 1, AIR_SCROLL, 3, Skill.MAGIC, 2);
        worldActions.addActionChoices(NONE, _uint16Array(4, 5), choices);
        action.choiceId = 6;
        vm.prank(ALICE);
        vm.expectRevert();
        players.startActions(playerId, _actions(action), ActionQueueStrategy.OVERWRITE);
        action.choiceId = 4;
        _start(playerId, action);
    }

    function testUseTooMuchFoodSplitOverSameAction() public {
        QueuedActionInput memory action = _setupLethalMagic(15_000, 5);
        itemNFT.mint(ALICE, COOKED_MINNUS, 70_000);
        uint256 foodBalance = itemNFT.balanceOf(ALICE, COOKED_MINNUS);
        _start(playerId, action);
        uint256 beforeBalance = foodBalance;
        for (uint256 i; i < 36; ++i) {
            vm.warp(vm.getBlockTimestamp() + action.timespan / 36);
            _process(playerId);
            uint256 afterBalance = itemNFT.balanceOf(ALICE, COOKED_MINNUS);
            assertTrue(beforeBalance > afterBalance || beforeBalance == foodBalance - type(uint16).max);
            beforeBalance = afterBalance;
        }
        assertEq(players.getPlayerXP(playerId, Skill.MAGIC), 3106);
        assertEq(players.getPlayerXP(playerId, Skill.DEFENCE), 0);
        assertEq(itemNFT.balanceOf(ALICE, COOKED_MINNUS), foodBalance - type(uint16).max);
    }

    function testUseTooMuchFood() public {
        QueuedActionInput memory action = _setupLethalMagic(15_000, 5);
        itemNFT.mint(ALICE, COOKED_MINNUS, 70_000);
        uint256 foodBalance = itemNFT.balanceOf(ALICE, COOKED_MINNUS);
        _run(action);
        assertEq(players.getPlayerXP(playerId, Skill.MAGIC), START_XP + 2732);
        assertEq(players.getPlayerXP(playerId, Skill.DEFENCE), 0);
        assertEq(itemNFT.balanceOf(ALICE, COOKED_MINNUS), foodBalance - type(uint16).max);
    }

    function testDieWithFoodAndInsufficientScrolls() public {
        QueuedActionInput memory action = _setupLethalMagic(50, 5);
        action.timespan = 2 hours;
        _start(playerId, action);
        vm.warp(vm.getBlockTimestamp() + action.timespan);
        assertTrue(_pending(playerId).actionMetadatas[0].died);
        _process(playerId);
        assertEq(players.getPlayerXP(playerId, Skill.MAGIC), START_XP + 3960);
        assertEq(players.getPlayerXP(playerId, Skill.DEFENCE), 0);
        assertEq(itemNFT.balanceOf(ALICE, COOKED_MINNUS), 0);
        _assertScrollBalances(0, 0);
    }

    function testNoFoodScrollsConsumedOnlyForCombatTime() public {
        (QueuedActionInput memory action,,) = _setupMagic();
        ItemInput memory gauntlets = _item(IRON_GAUNTLETS, EquipPosition.ARMS);
        itemNFT.addItems(_items(gauntlets));
        itemNFT.mint(ALICE, IRON_GAUNTLETS, 1);
        action.attire.arms = IRON_GAUNTLETS;
        action.regenerateId = NONE;
        _start(playerId, action);
        vm.warp(vm.getBlockTimestamp() + 180);
        PendingQueuedActionState memory pending = _pending(playerId);
        assertTrue(pending.actionMetadatas[0].died);
        assertEq(pending.equipmentStates[0].consumedAmounts.length, 2);
        assertEq(pending.equipmentStates[0].consumedAmounts[0], 1);
        uint256 consumed = pending.equipmentStates[0].consumedAmounts[0];
        vm.warp(vm.getBlockTimestamp() + 1800);
        pending = _pending(playerId);
        assertEq(pending.equipmentStates[0].consumedAmounts[0], consumed);
        _process(playerId);
    }

    function testRunOutOfFoodAndScrollsMoreFoodThanScrolls() public {
        (QueuedActionInput memory action,,) = _setupMagic();
        _addCombatAction(
            2, uint24(100 * SPAWN_MUL), CombatStats(0, 5, 0, 60, 0, 5, 0), BRONZE_ARROW, uint16(GUAR_MUL), false
        );
        players.modifyXP(ALICE, playerId, Skill.MAGIC, 14_500, true);
        players.modifyXP(ALICE, playerId, Skill.HEALTH, 1600, true);
        players.modifyXP(ALICE, playerId, Skill.DEFENCE, 250, true);
        uint16[] memory tokenIds = _uint16s(COOKED_MINNUS, AIR_SCROLL, SHADOW_SCROLL);
        uint256[] memory ids = _uints(COOKED_MINNUS, AIR_SCROLL, SHADOW_SCROLL);
        uint256[] memory balances = itemNFT.balanceOfs(ALICE, tokenIds);
        vm.prank(ALICE);
        itemNFT.burnBatch(ALICE, ids, balances);
        ActionChoiceInput memory choice =
            _inputChoice(Skill.MAGIC, uint24(100 * RATE_MUL), SHADOW_SCROLL, 1, AIR_SCROLL, 2, Skill.MAGIC, 2);
        worldActions.editActionChoices(NONE, _uint16s(MAGIC_CHOICE), _choices(choice));
        itemNFT.mintBatch(ALICE, ids, _uints(1350, 2092, 1046));
        action.actionId = 2;
        action.timespan = 24 hours;
        _start(playerId, action);
        vm.warp(vm.getBlockTimestamp() + action.timespan);
        assertTrue(_pending(playerId).actionMetadatas[0].died);
        _process(playerId);
        assertEq(players.getPlayerXP(playerId, Skill.MAGIC), 55_921);
        assertEq(players.getPlayerXP(playerId, Skill.DEFENCE), 250);
        assertEq(itemNFT.balanceOf(ALICE, COOKED_MINNUS), 0);
        _assertScrollBalances(0, 0);
    }

    function testEnemyDealingMagicDamage() public {
        (QueuedActionInput memory action,,) = _setupMagic();
        _addCombatAction(
            2, uint24(10 * SPAWN_MUL), CombatStats(0, 3, 0, 5, 0, 0, 0), BRONZE_ARROW, uint16(GUAR_MUL), false
        );
        action.actionId = 2;
        _run(action);
        _assertStandard(action, START_XP, GUAR_MUL, 10 * SPAWN_MUL, 2);
    }

    function _run(QueuedActionInput memory action) private {
        _start(playerId, action);
        vm.warp(vm.getBlockTimestamp() + action.timespan);
        _process(playerId);
    }

    function _assertStandard(
        QueuedActionInput memory action,
        uint256 startXP,
        uint256 rate,
        uint256 spawned,
        uint256 food
    ) private view {
        _assertCombatXPAndDrops(action, startXP, rate, spawned);
        assertEq(players.getPlayerXP(playerId, Skill.DEFENCE), 0);
        assertEq(itemNFT.balanceOf(ALICE, COOKED_MINNUS), 1000 - food);
        _assertScrollBalances(180, 90);
    }

    function _assertCombatXPAndDrops(QueuedActionInput memory action, uint256 startXP, uint256 rate, uint256 spawned)
        private
        view
    {
        assertEq(players.getPlayerXP(playerId, Skill.MAGIC), startXP + (action.timespan * 11) / 10);
        _assertWithinOne(players.getPlayerXP(playerId, Skill.HEALTH), action.timespan / 3);
        assertEq(itemNFT.balanceOf(ALICE, BRONZE_ARROW), _drops(action.timespan, rate, spawned));
    }

    function _drops(uint256 timespan, uint256 rate, uint256 spawned) private pure returns (uint256) {
        return (timespan * rate * spawned) / (3600 * GUAR_MUL * SPAWN_MUL);
    }

    function _assertScrollBalances(uint256 air, uint256 shadow) private view {
        assertEq(itemNFT.balanceOf(ALICE, AIR_SCROLL), air);
        assertEq(itemNFT.balanceOf(ALICE, SHADOW_SCROLL), shadow);
    }

    function _setupFastMagic() private returns (QueuedActionInput memory action) {
        (action,,) = _setupMagic();
        _editCombatAction(COMBAT_ACTION, uint24(100 * SPAWN_MUL), CombatStats(1, 0, 0, 36, 0, 0, 0), BRONZE_ARROW);
        ActionChoiceInput memory choice =
            _inputChoice(Skill.MAGIC, uint24(100 * RATE_MUL), SHADOW_SCROLL, 1, AIR_SCROLL, 2, Skill.MAGIC, 5);
        worldActions.editActionChoices(NONE, _uint16s(MAGIC_CHOICE), _choices(choice));
    }

    function _setupLethalMagic(int16 attack, uint16 health) private returns (QueuedActionInput memory action) {
        (action,,) = _setupMagic();
        _addCombatAction(
            2,
            uint24(100 * SPAWN_MUL),
            CombatStats(attack, 0, 0, int16(health), 0, 0, 0),
            BRONZE_ARROW,
            uint16(GUAR_MUL),
            false
        );
        action.actionId = 2;
    }

    function _items(ItemInput memory item) private pure returns (ItemInput[] memory items) {
        items = new ItemInput[](1);
        items[0] = item;
    }

    function _assertCurrent(Player memory player, uint256 magicXP, uint256 healthXP) private view {
        assertEq(player.currentActionStartTimestamp, block.timestamp);
        assertEq(uint8(player.currentActionProcessedSkill1), uint8(Skill.MAGIC));
        assertEq(player.currentActionProcessedXPGained1, magicXP);
        assertEq(uint8(player.currentActionProcessedSkill2), uint8(Skill.HEALTH));
        assertEq(player.currentActionProcessedXPGained2, healthXP);
        assertEq(uint8(player.currentActionProcessedSkill3), uint8(Skill.NONE));
        assertEq(player.currentActionProcessedXPGained3, 0);
        assertEq(player.currentActionProcessedFoodConsumed, 1);
        assertEq(player.currentActionProcessedBaseInputItemsConsumedNum, 5);
    }
}
