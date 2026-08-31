// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Vm} from "forge-std/Vm.sol";

import {FullGameStack} from "../utils/FullGameStack.sol";
import {Players} from "../../contracts/Players/Players.sol";
import {PlayersBase} from "../../contracts/Players/PlayersBase.sol";
import {IPlayersMisc1DelegateView} from "../../contracts/interfaces/IPlayersDelegates.sol";
import {Skill, Attire, CombatStyle, CombatStats} from "../../contracts/globals/misc.sol";
import {
    ActionInput,
    ActionInfo,
    ActionQueueStrategy,
    QueuedActionInput,
    QueuedAction,
    GUAR_MUL,
    SPAWN_MUL
} from "../../contracts/globals/actions.sol";
import {ActionChoiceInput, AvatarInfo, EquipPosition, ItemInput, Player} from "../../contracts/globals/players.sol";
import {GuaranteedReward, RandomReward} from "../../contracts/globals/rewards.sol";
import {NONE, BRONZE_AXE, COMBAT_BASE} from "../../contracts/globals/items.sol";

// Migrated from the core section of test/Players/Players.ts.
contract PlayersCoreTest is FullGameStack {
    uint16 private constant BRONZE_GAUNTLETS = 769;
    uint16 private constant COMBAT_MAX = 2559;
    uint16 private constant WOODCUTTING_MAX = 3071;
    uint16 private constant LOG = 10_496;
    uint16 private constant ACTION_ID = 1;
    uint16 private constant START_XP = 374;

    function setUp() public {
        deployFullGame();
    }

    function testCheckInitialized() public {
        vm.recordLogs();
        Players implementation = new Players();
        _deployUUPS(
            address(implementation),
            abi.encodeCall(
                Players.initialize,
                (
                    itemNFT,
                    playerNFT,
                    petNFT,
                    worldActions,
                    randomnessBeacon,
                    dailyRewardsScheduler,
                    adminAccess,
                    quests,
                    clans,
                    wishingWell,
                    playersImplQueueActions,
                    playersImplProcessActions,
                    playersImplRewards,
                    playersImplMisc,
                    playersImplMisc1,
                    address(bridge),
                    activityPoints,
                    true
                )
            )
        );
        Vm.Log[] memory logs = vm.getRecordedLogs();
        bytes32 topic = keccak256("SetCombatParams(uint256,uint256,uint256)");
        bool found;
        for (uint256 i; i < logs.length; ++i) {
            if (logs[i].topics[0] == topic) {
                (uint256 alpha, uint256 beta, uint256 healing) = abi.decode(logs[i].data, (uint256, uint256, uint256));
                assertEq(alpha, 1);
                assertEq(beta, 1);
                assertEq(healing, 8);
                found = true;
            }
        }
        assertTrue(found);
    }

    function testNewPlayerStats() public {
        AvatarInfo[] memory infos = new AvatarInfo[](1);
        infos[0] = AvatarInfo("Name goes here", "Hi I'm a description", "1234.png", [Skill.FIREMAKING, Skill.NONE]);
        playerNFT.setAvatars(_uints(2), infos);
        uint256 first = _createPlayer(ALICE, 2, "Name", true);
        assertEq(players.getPlayerXP(first, Skill.FIREMAKING), START_XP);

        infos[0].startSkills = [Skill.FIREMAKING, Skill.HEALTH];
        playerNFT.setAvatars(_uints(2), infos);
        uint256 second = _createPlayer(ALICE, 2, "New name", true);
        assertEq(players.getPlayerXP(second, Skill.FIREMAKING), START_XP / 2);
        assertEq(players.getPlayerXP(second, Skill.HEALTH), START_XP / 2);
        Player memory player = IPlayersMisc1DelegateView(address(players)).getPlayer(second);
        assertEq(player.totalXP, START_XP);
    }

    function testSkillPoints() public {
        (QueuedActionInput memory action,) = _setupBasicWoodcutting();
        _start(action, ActionQueueStrategy.OVERWRITE);
        vm.warp(block.timestamp + 361);
        _process();
        assertEq(players.getPlayerXP(playerId, Skill.WOODCUTTING), 360);
        assertEq(itemNFT.balanceOf(ALICE, LOG), 10);
        assertEq(IPlayersMisc1DelegateView(address(players)).getPlayer(playerId).totalXP, START_XP + 360);
    }

    function testSkillPointsMany() public {
        (QueuedActionInput memory action,) = _setupBasicWoodcutting();
        uint256 timestamp = block.timestamp;
        for (uint256 i; i < 50; ++i) {
            if (i != 0) vm.warp(++timestamp);
            _start(action, ActionQueueStrategy.APPEND);
            timestamp += 7200;
            vm.warp(timestamp);
            _process();
            assertEq(players.getPlayerXP(playerId, Skill.WOODCUTTING), (i + 1) * 3600);
            assertEq(itemNFT.balanceOf(ALICE, LOG), (i + 1) * 100);
        }
    }

    function testPartialConsumeAuxItems() public {
        (QueuedActionInput memory action, uint256 rate) = _setupBasicWoodcutting();
        _start(action, ActionQueueStrategy.OVERWRITE);
        vm.warp(block.timestamp + action.timespan / 2);
        _process();
        assertEq(players.getPlayerXP(playerId, Skill.WOODCUTTING), action.timespan / 2);
        assertEq(itemNFT.balanceOf(ALICE, LOG), (action.timespan / 2 * rate) / (3600 * GUAR_MUL));
    }

    function testSkillPointsMaxRange() public {
        (QueuedActionInput memory action,) = _setupBasicWoodcutting();
        _start(action, ActionQueueStrategy.OVERWRITE);
        vm.warp(block.timestamp + action.timespan);
        _process();
        assertEq(players.getPlayerXP(playerId, Skill.WOODCUTTING), action.timespan);
    }

    function testMultiSkillPoints() public {
        // TODO: The source Hardhat test has no setup or assertions.
    }

    function testAttireEquipPositions() public {
        (QueuedActionInput memory action,) = _setupCombatWithGauntlets();
        _expectInvalidPosition(action);
        action.attire = Attire(NONE, BRONZE_GAUNTLETS, NONE, NONE, NONE, NONE, NONE, NONE);
        _expectInvalidPosition(action);
        action.attire = Attire(NONE, NONE, BRONZE_GAUNTLETS, NONE, NONE, NONE, NONE, NONE);
        _expectInvalidPosition(action);
        action.attire = Attire(NONE, NONE, NONE, NONE, NONE, BRONZE_GAUNTLETS, NONE, NONE);
        _expectInvalidPosition(action);
        action.attire = Attire(NONE, NONE, NONE, NONE, BRONZE_GAUNTLETS, NONE, NONE, NONE);
        _expectInvalidPosition(action);
        action.attire = Attire(NONE, NONE, NONE, NONE, NONE, NONE, BRONZE_GAUNTLETS, NONE);
        _expectInvalidPosition(action);
        action.attire = Attire(NONE, NONE, NONE, BRONZE_GAUNTLETS, NONE, NONE, NONE, NONE);
        _start(action, ActionQueueStrategy.OVERWRITE);
    }

    function testValidateActions() public {
        _assertValidateActions();
    }

    function testValidateActionsCapitalizedSourceDuplicate() public {
        _assertValidateActions();
    }

    function testQueueingAfterOneActionIsCompletelyFinished() public {
        (QueuedActionInput memory action,) = _setupBasicWoodcutting();
        _start(action, ActionQueueStrategy.OVERWRITE);
        vm.warp(block.timestamp + action.timespan / 2);
        _start(action, ActionQueueStrategy.APPEND);
        assertEq(players.getActionQueue(playerId).length, 2);
        vm.warp(block.timestamp + action.timespan / 2);
        _start(action, ActionQueueStrategy.APPEND);
        QueuedAction[] memory queue = players.getActionQueue(playerId);
        assertEq(queue.length, 2);
        assertEq(queue[0].queueId, 2);
        // Foundry controls block timestamps exactly; unlike Hardhat transactions, no incidental seconds elapse.
        assertEq(queue[0].timespan, action.timespan);
        assertEq(queue[1].queueId, 3);
        assertEq(queue[1].timespan, action.timespan);
    }

    function _assertValidateActions() private {
        (QueuedActionInput memory invalid, QueuedActionInput memory valid) = _setupCombatWithGauntlets();
        _expectInvalidPosition(invalid);
        QueuedActionInput[] memory actions = new QueuedActionInput[](3);
        actions[0] = invalid;
        actions[1] = valid;
        actions[2] = invalid;
        (bool[] memory successes, bytes[] memory reasons) = players.validateActions(ALICE, playerId, actions);
        assertEq(successes.length, 3);
        assertEq(reasons.length, 3);
        assertFalse(successes[0]);
        assertEq(reasons[0], abi.encodePacked(PlayersBase.InvalidEquipPosition.selector));
        assertTrue(successes[1]);
        assertEq(reasons[1].length, 0);
        assertFalse(successes[2]);
        assertEq(reasons[2], abi.encodePacked(PlayersBase.InvalidEquipPosition.selector));
    }

    function _setupBasicWoodcutting() private returns (QueuedActionInput memory queuedAction, uint256 rate) {
        rate = 100 * GUAR_MUL;
        ActionInput memory action;
        action.actionId = ACTION_ID;
        action.info = ActionInfo(
            uint8(Skill.WOODCUTTING), false, 3600, 0, 0, BRONZE_AXE, WOODCUTTING_MAX, 100, 0, false, true, 0
        );
        action.guaranteedRewards = new GuaranteedReward[](1);
        action.guaranteedRewards[0] = GuaranteedReward(LOG, uint16(rate));
        _addAction(action);
        _addItem(BRONZE_AXE, EquipPosition.RIGHT_HAND);
        queuedAction = _queuedAction();
        queuedAction.rightHandEquipmentTokenId = BRONZE_AXE;
    }

    function _setupCombatWithGauntlets()
        private
        returns (QueuedActionInput memory invalid, QueuedActionInput memory valid)
    {
        ActionInput memory action;
        action.actionId = ACTION_ID;
        action.info = ActionInfo(
            uint8(Skill.COMBAT), true, 3600, 0, uint24(SPAWN_MUL), COMBAT_BASE, COMBAT_MAX, 100, 0, false, true, 0
        );
        _addAction(action);
        ActionChoiceInput memory choice;
        choice.skill = uint8(Skill.MELEE);
        choice.successPercent = 100;
        choice.isAvailable = true;
        ActionChoiceInput[] memory choices = new ActionChoiceInput[](1);
        choices[0] = choice;
        worldActions.addActionChoices(NONE, _uint16s(ACTION_ID), choices);
        _addItem(BRONZE_GAUNTLETS, EquipPosition.ARMS);
        itemNFT.mint(ALICE, BRONZE_GAUNTLETS, 1);
        valid = _queuedAction();
        valid.choiceId = ACTION_ID;
        valid.combatStyle = uint8(CombatStyle.ATTACK);
        invalid = _queuedAction();
        invalid.choiceId = ACTION_ID;
        invalid.combatStyle = uint8(CombatStyle.ATTACK);
        invalid.attire.head = BRONZE_GAUNTLETS;
    }

    function _queuedAction() private pure returns (QueuedActionInput memory action) {
        action.actionId = ACTION_ID;
        action.timespan = 3600;
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
        items[0].isAvailable = true;
        itemNFT.addItems(items);
    }

    function _expectInvalidPosition(QueuedActionInput memory action) private {
        vm.prank(ALICE);
        vm.expectRevert(PlayersBase.InvalidEquipPosition.selector);
        players.startActions(playerId, _actions(action), ActionQueueStrategy.OVERWRITE);
    }

    function _start(QueuedActionInput memory action, ActionQueueStrategy strategy) private {
        vm.prank(ALICE);
        players.startActions(playerId, _actions(action), strategy);
    }

    function _process() private {
        vm.prank(ALICE);
        players.processActions(playerId);
    }

    function _actions(QueuedActionInput memory action) private pure returns (QueuedActionInput[] memory actions) {
        actions = new QueuedActionInput[](1);
        actions[0] = action;
    }
}
