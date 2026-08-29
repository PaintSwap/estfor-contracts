// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import {WorldActions} from "../contracts/WorldActions.sol";
import {EstforLibrary} from "../contracts/EstforLibrary.sol";
import {ActionInput, ActionInfo, SPAWN_MUL, RATE_MUL} from "../contracts/globals/actions.sol";
import {ActionChoiceInput} from "../contracts/globals/players.sol";
import {Skill, CombatStats} from "../contracts/globals/misc.sol";
import {GuaranteedReward, RandomReward, ActionRewards} from "../contracts/globals/rewards.sol";

contract WorldActionsTest is Test {
    uint16 private constant NONE = 0;
    uint16 private constant COMBAT_BASE = 2048;
    uint16 private constant COMBAT_MAX = 2559;
    uint16 private constant ACTION_ALCHEMY_ITEM = 4000;
    uint16 private constant OAK_LOG = 10497;
    uint16 private constant BRONZE_ARROW = 11776;
    uint16 private constant IRON_ARROW = 11777;
    uint16 private constant ADAMANTINE_ARROW = 11779;
    uint16 private constant RUNITE_ARROW = 11780;
    uint16 private constant ORICHALCUM_ARROW = 11782;
    uint16 private constant SHADOW_SCROLL = 12032;
    uint16 private constant AQUA_SCROLL = 12034;
    uint16 private constant HELL_SCROLL = 12035;
    uint16 private constant AIR_SCROLL = 12036;

    WorldActions private worldActions;

    function setUp() public {
        WorldActions implementation = new WorldActions();
        worldActions = WorldActions(
            address(new ERC1967Proxy(address(implementation), abi.encodeCall(implementation.initialize, ())))
        );
    }

    function testAddEditDeleteNormal() public {
        ActionInput memory action = _combatAction(1);
        worldActions.addActions(_actions(action));
        assertEq(worldActions.getAction(1).skill, uint8(Skill.COMBAT));

        action.info.xpPerHour = 20;
        worldActions.editActions(_actions(action));
        assertEq(worldActions.getAction(1).xpPerHour, 20);
        assertFalse(worldActions.getAction(1).isAvailable);

        action.info.isAvailable = true;
        worldActions.editActions(_actions(action));
        assertTrue(worldActions.getAction(1).isAvailable);

        action.info.isAvailable = false;
        worldActions.editActions(_actions(action));
        assertFalse(worldActions.getAction(1).isAvailable);
    }

    function testEditToHaveLessGuaranteedAndRandomRewards() public {
        ActionInput memory action = _combatAction(1);
        action.guaranteedRewards = _guaranteedRewards(OAK_LOG, 600);
        action.randomRewards = _randomRewards(BRONZE_ARROW, 1328, 1);
        worldActions.addActions(_actions(action));
        assertEq(worldActions.getAction(1).skill, uint8(Skill.COMBAT));

        action.guaranteedRewards = new GuaranteedReward[](0);
        action.randomRewards = new RandomReward[](0);
        worldActions.editActions(_actions(action));
        ActionRewards memory rewards = worldActions.getActionRewards(1);
        assertEq(rewards.guaranteedRewardTokenId1, 0);
        assertEq(rewards.randomRewardAmount1, 0);

        action.guaranteedRewards = _guaranteedRewards(OAK_LOG, 600);
        action.randomRewards = _randomRewards(BRONZE_ARROW, 1328, 1);
        worldActions.editActions(_actions(action));
        rewards = worldActions.getActionRewards(1);
        assertEq(rewards.guaranteedRewardTokenId1, OAK_LOG);
        assertEq(rewards.randomRewardAmount1, 1);
    }

    // TODO: Dynamic actions.
    function testDynamicActions() public pure {}

    function testCannotUseActionChoiceIdZero() public {
        ActionChoiceInput memory choice = _choice(Skill.MAGIC, AIR_SCROLL, 1);
        vm.expectRevert(WorldActions.ActionChoiceIdZeroNotAllowed.selector);
        worldActions.addActionChoices(NONE, _uint16s(0), _choices(choice));
    }

    function testBulkAddActionChoices() public {
        uint16[] memory actionIds = _uint16s(NONE, ACTION_ALCHEMY_ITEM);
        uint16[][] memory choiceIds = new uint16[][](2);
        choiceIds[0] = _uint16s(1);
        choiceIds[1] = _uint16s(2, 3);
        ActionChoiceInput[][] memory choices = new ActionChoiceInput[][](2);
        choices[0] = _choices(_choice(Skill.MAGIC, AIR_SCROLL, 1));
        choices[1] = new ActionChoiceInput[](2);
        choices[1][0] = _choice(Skill.ALCHEMY, AIR_SCROLL, 1);
        choices[1][1] = _choice(Skill.ALCHEMY, AIR_SCROLL, 1);

        worldActions.addBulkActionChoices(actionIds, choiceIds, choices);
        assertEq(worldActions.getActionChoice(NONE, 1).skill, uint8(Skill.MAGIC));
        assertEq(worldActions.getActionChoice(ACTION_ALCHEMY_ITEM, 2).skill, uint8(Skill.ALCHEMY));
        assertEq(worldActions.getActionChoice(ACTION_ALCHEMY_ITEM, 3).skill, uint8(Skill.ALCHEMY));
    }

    function testInputItemValidation() public {
        ActionChoiceInput memory choice = _defaultChoice();
        choice.skill = uint8(Skill.MAGIC);
        choice.rate = uint24(RATE_MUL);
        choice.inputTokenIds = _uint16s(BRONZE_ARROW, IRON_ARROW, ADAMANTINE_ARROW, ORICHALCUM_ARROW);
        choice.inputAmounts = _uint24s(1, 2, 3);

        vm.expectRevert(WorldActions.TooManyInputItems.selector);
        worldActions.addActionChoices(NONE, _uint16s(1), _choices(choice));

        choice.inputTokenIds = _uint16s(BRONZE_ARROW, IRON_ARROW);
        vm.expectRevert(WorldActions.LengthMismatch.selector);
        worldActions.addActionChoices(NONE, _uint16s(1), _choices(choice));

        choice.inputTokenIds = _uint16s(BRONZE_ARROW, IRON_ARROW, BRONZE_ARROW);
        vm.expectRevert(WorldActions.InputItemNoDuplicates.selector);
        worldActions.addActionChoices(NONE, _uint16s(1), _choices(choice));
    }

    function testMinimumSkillValidation() public {
        ActionChoiceInput memory choice = _choice(Skill.WOODCUTTING, BRONZE_ARROW, 1);
        choice.skills = _uint8s(Skill.WOODCUTTING, Skill.FIREMAKING, Skill.CRAFTING, Skill.ALCHEMY);
        choice.skillMinXPs = _uint32s(1, 1, 1);
        choice.skillDiffs = _int16s(2, 0, 0);

        vm.expectRevert(WorldActions.TooManySkills.selector);
        worldActions.addActionChoices(NONE, _uint16s(1), _choices(choice));

        choice.skills = _uint8s(Skill.WOODCUTTING, Skill.FIREMAKING);
        vm.expectRevert(WorldActions.LengthMismatch.selector);
        worldActions.addActionChoices(NONE, _uint16s(1), _choices(choice));

        choice.skills = _uint8s(Skill.WOODCUTTING, Skill.FIREMAKING, Skill.WOODCUTTING);
        vm.expectRevert(WorldActions.MinimumSkillsNoDuplicates.selector);
        worldActions.addActionChoices(NONE, _uint16s(1), _choices(choice));
    }

    function testOutputItemValidation() public {
        ActionChoiceInput memory choice = _defaultChoice();
        choice.skill = uint8(Skill.MAGIC);
        choice.rate = uint24(RATE_MUL);
        choice.inputTokenIds = _uint16s(BRONZE_ARROW, IRON_ARROW, ADAMANTINE_ARROW);
        choice.inputAmounts = _uint24s(1, 2, 3);
        choice.outputTokenId = RUNITE_ARROW;

        vm.expectRevert(WorldActions.OutputAmountCannotBeZero.selector);
        worldActions.addActionChoices(NONE, _uint16s(1), _choices(choice));

        choice.outputAmount = 1;
        choice.outputTokenId = NONE;
        vm.expectRevert(WorldActions.OutputTokenIdCannotBeEmpty.selector);
        worldActions.addActionChoices(NONE, _uint16s(1), _choices(choice));
    }

    function testEditActionChoice() public {
        ActionChoiceInput memory choice = _choice(Skill.MAGIC, AIR_SCROLL, 1);
        worldActions.addActionChoices(NONE, _uint16s(1), _choices(choice));

        choice.inputAmounts[0] = 2;
        worldActions.editActionChoices(NONE, _uint16s(1), _choices(choice));
        assertEq(worldActions.getActionChoice(NONE, 1).inputAmount1, 2);
        assertEq(worldActions.getActionChoice(NONE, 2).skill, uint8(Skill.NONE));

        choice.inputAmounts[0] = 10;
        worldActions.editActionChoices(NONE, _uint16s(1), _choices(choice));
        assertEq(worldActions.getActionChoice(NONE, 1).inputAmount1, 10);
    }

    function testPackedDataWhenAvailableAndNotAvailable() public {
        ActionChoiceInput memory choice = _choice(Skill.MAGIC, BRONZE_ARROW, 1);
        worldActions.addActionChoices(NONE, _uint16s(1), _choices(choice));
        assertEq(worldActions.getActionChoice(NONE, 1).packedData, bytes1(uint8(0x40)));

        choice.isAvailable = false;
        worldActions.editActionChoices(NONE, _uint16s(1), _choices(choice));
        assertEq(worldActions.getActionChoice(NONE, 1).packedData, bytes1(0));
    }

    function testGuaranteedRewardDuplicatesNotAllowed() public {
        ActionInput memory action = _combatAction(1);
        action.guaranteedRewards = new GuaranteedReward[](2);
        action.guaranteedRewards[0] = GuaranteedReward({itemTokenId: AIR_SCROLL, rate: 100});
        action.guaranteedRewards[1] = GuaranteedReward({itemTokenId: AIR_SCROLL, rate: 200});

        vm.expectRevert(EstforLibrary.GuaranteedRewardsNoDuplicates.selector);
        worldActions.addActions(_actions(action));
        action.guaranteedRewards[0].itemTokenId = SHADOW_SCROLL;
        worldActions.addActions(_actions(action));
    }

    function testRandomRewardOrder() public {
        ActionInput memory action = _combatAction(1);
        action.randomRewards = new RandomReward[](4);
        action.randomRewards[0] = RandomReward({itemTokenId: SHADOW_SCROLL, chance: 30, amount: 1});
        action.randomRewards[1] = RandomReward({itemTokenId: AIR_SCROLL, chance: 50, amount: 1});
        action.randomRewards[2] = RandomReward({itemTokenId: AQUA_SCROLL, chance: 100, amount: 1});
        action.randomRewards[3] = RandomReward({itemTokenId: HELL_SCROLL, chance: 200, amount: 1});

        vm.expectRevert(abi.encodeWithSelector(EstforLibrary.RandomRewardsMustBeInOrder.selector, 30, 50));
        worldActions.addActions(_actions(action));
        action.randomRewards[0].chance = 300;
        vm.expectRevert(abi.encodeWithSelector(EstforLibrary.RandomRewardsMustBeInOrder.selector, 50, 100));
        worldActions.addActions(_actions(action));
        action.randomRewards[1].chance = 250;
        vm.expectRevert(abi.encodeWithSelector(EstforLibrary.RandomRewardsMustBeInOrder.selector, 100, 200));
        worldActions.addActions(_actions(action));
        action.randomRewards[2].chance = 225;
        worldActions.addActions(_actions(action));
    }

    function testRandomRewardDuplicateNotAllowed() public {
        ActionInput memory action = _combatAction(1);
        action.randomRewards = new RandomReward[](2);
        action.randomRewards[0] = RandomReward({itemTokenId: AIR_SCROLL, chance: 200, amount: 1});
        action.randomRewards[1] = RandomReward({itemTokenId: AIR_SCROLL, chance: 100, amount: 1});

        vm.expectRevert(EstforLibrary.RandomRewardNoDuplicates.selector);
        worldActions.addActions(_actions(action));
        action.randomRewards[0].itemTokenId = SHADOW_SCROLL;
        worldActions.addActions(_actions(action));
    }

    function testOnlyCombatAndActionsWithoutChoicesCanHaveBothRewardTypes() public {
        ActionInput memory action = _combatAction(1);
        action.guaranteedRewards = _guaranteedRewards(AIR_SCROLL, 100);
        action.randomRewards = _randomRewards(AIR_SCROLL, 100, 1);
        worldActions.addActions(_actions(action));

        action.actionId = 2;
        action.info.skill = uint8(Skill.COOKING);
        vm.expectRevert(WorldActions.NonCombatWithActionChoicesCannotHaveBothGuaranteedAndRandomRewards.selector);
        worldActions.addActions(_actions(action));
        action.info.actionChoiceRequired = false;
        worldActions.addActions(_actions(action));
    }

    function _combatAction(uint16 actionId) private pure returns (ActionInput memory action) {
        action.actionId = actionId;
        action.info = ActionInfo({
            skill: uint8(Skill.COMBAT),
            actionChoiceRequired: true,
            xpPerHour: 3600,
            minXP: 0,
            numSpawned: uint24(SPAWN_MUL),
            handItemTokenIdRangeMin: COMBAT_BASE,
            handItemTokenIdRangeMax: COMBAT_MAX,
            successPercent: 100,
            worldLocation: 0,
            isFullModeOnly: false,
            isAvailable: false,
            questPrerequisiteId: 0
        });
        action.guaranteedRewards = new GuaranteedReward[](0);
        action.randomRewards = new RandomReward[](0);
        action.combatStats = CombatStats(0, 0, 0, 0, 0, 0, 0);
    }

    function _defaultChoice() private pure returns (ActionChoiceInput memory choice) {
        choice.successPercent = 100;
        choice.isAvailable = true;
        choice.inputTokenIds = new uint16[](0);
        choice.inputAmounts = new uint24[](0);
        choice.skills = new uint8[](0);
        choice.skillMinXPs = new uint32[](0);
        choice.skillDiffs = new int16[](0);
    }

    function _choice(Skill skill, uint16 inputTokenId, uint24 inputAmount)
        private
        pure
        returns (ActionChoiceInput memory choice)
    {
        choice = _defaultChoice();
        choice.skill = uint8(skill);
        choice.rate = uint24(RATE_MUL);
        choice.inputTokenIds = _uint16s(inputTokenId);
        choice.inputAmounts = _uint24s(inputAmount);
    }

    function _actions(ActionInput memory action) private pure returns (ActionInput[] memory actions) {
        actions = new ActionInput[](1);
        actions[0] = action;
    }

    function _choices(ActionChoiceInput memory choice) private pure returns (ActionChoiceInput[] memory choices) {
        choices = new ActionChoiceInput[](1);
        choices[0] = choice;
    }

    function _guaranteedRewards(uint16 itemTokenId, uint16 rate)
        private
        pure
        returns (GuaranteedReward[] memory rewards)
    {
        rewards = new GuaranteedReward[](1);
        rewards[0] = GuaranteedReward({itemTokenId: itemTokenId, rate: rate});
    }

    function _randomRewards(uint16 itemTokenId, uint16 chance, uint8 amount)
        private
        pure
        returns (RandomReward[] memory rewards)
    {
        rewards = new RandomReward[](1);
        rewards[0] = RandomReward({itemTokenId: itemTokenId, chance: chance, amount: amount});
    }

    function _uint16s(uint16 a) private pure returns (uint16[] memory values) {
        values = new uint16[](1);
        values[0] = a;
    }

    function _uint16s(uint16 a, uint16 b) private pure returns (uint16[] memory values) {
        values = new uint16[](2);
        values[0] = a;
        values[1] = b;
    }

    function _uint16s(uint16 a, uint16 b, uint16 c) private pure returns (uint16[] memory values) {
        values = new uint16[](3);
        values[0] = a;
        values[1] = b;
        values[2] = c;
    }

    function _uint16s(uint16 a, uint16 b, uint16 c, uint16 d) private pure returns (uint16[] memory values) {
        values = new uint16[](4);
        values[0] = a;
        values[1] = b;
        values[2] = c;
        values[3] = d;
    }

    function _uint24s(uint24 a) private pure returns (uint24[] memory values) {
        values = new uint24[](1);
        values[0] = a;
    }

    function _uint24s(uint24 a, uint24 b, uint24 c) private pure returns (uint24[] memory values) {
        values = new uint24[](3);
        values[0] = a;
        values[1] = b;
        values[2] = c;
    }

    function _uint8s(Skill a, Skill b) private pure returns (uint8[] memory values) {
        values = new uint8[](2);
        values[0] = uint8(a);
        values[1] = uint8(b);
    }

    function _uint8s(Skill a, Skill b, Skill c) private pure returns (uint8[] memory values) {
        values = new uint8[](3);
        values[0] = uint8(a);
        values[1] = uint8(b);
        values[2] = uint8(c);
    }

    function _uint8s(Skill a, Skill b, Skill c, Skill d) private pure returns (uint8[] memory values) {
        values = new uint8[](4);
        values[0] = uint8(a);
        values[1] = uint8(b);
        values[2] = uint8(c);
        values[3] = uint8(d);
    }

    function _uint32s(uint32 a, uint32 b, uint32 c) private pure returns (uint32[] memory values) {
        values = new uint32[](3);
        values[0] = a;
        values[1] = b;
        values[2] = c;
    }

    function _int16s(int16 a, int16 b, int16 c) private pure returns (int16[] memory values) {
        values = new int16[](3);
        values[0] = a;
        values[1] = b;
        values[2] = c;
    }
}
