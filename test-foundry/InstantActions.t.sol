// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import {FullGameStack} from "./utils/FullGameStack.sol";
import {InstantActions} from "./interfaces/InstantActions.sol";
import {Quests} from "./interfaces/Quests.sol";
import {Skill} from "../contracts/globals/misc.sol";
import {QuestInput, QUEST_PURSE_STRINGS} from "../contracts/globals/quests.sol";

contract InstantActionsTest is FullGameStack {
    uint16 private constant ARROW_BASE = 11_776;
    uint16 private constant BRONZE_ARROW = ARROW_BASE;
    uint16 private constant IRON_ARROW = ARROW_BASE + 1;
    uint16 private constant ADAMANTINE_ARROW = ARROW_BASE + 3;
    uint16 private constant RUNITE_ARROW = ARROW_BASE + 4;
    uint16 private constant ORICHALCUM_ARROW = ARROW_BASE + 6;
    uint16 private constant BAR_BASE = 10_240;
    uint16 private constant BRONZE_BAR = BAR_BASE;
    uint16 private constant IRON_BAR = BAR_BASE + 1;
    uint16 private constant ADAMANTINE_BAR = BAR_BASE + 3;
    uint16 private constant RUNITE_BAR = BAR_BASE + 4;

    function setUp() public {
        deployFullGame();
    }

    function testCheckInputItemValidation() public {
        InstantActions.InstantActionInput memory input = _input(InstantActions.InstantActionType.GENERIC);
        input.inputTokenIds = _uint16s(BRONZE_ARROW, IRON_ARROW, ADAMANTINE_ARROW, ORICHALCUM_ARROW);
        input.inputAmounts = _uint24s(1, 2, 3);
        vm.expectRevert(InstantActions.TooManyInputItems.selector);
        instantActions.addActions(_inputs(input));
        input.inputTokenIds = _uint16s(BRONZE_ARROW, IRON_ARROW);
        vm.expectRevert(InstantActions.LengthMismatch.selector);
        instantActions.addActions(_inputs(input));
        input.inputTokenIds = _uint16s(BRONZE_ARROW, IRON_ARROW, BRONZE_ARROW);
        vm.expectRevert(InstantActions.InputItemNoDuplicates.selector);
        instantActions.addActions(_inputs(input));
    }

    function testMinimumSkillValidation() public {
        InstantActions.InstantActionInput memory input = _input(InstantActions.InstantActionType.GENERIC);
        input.minSkills = _skills4(Skill.WOODCUTTING, Skill.FIREMAKING, Skill.CRAFTING, Skill.ALCHEMY);
        input.minXPs = _uint32s(1, 1, 1);
        vm.expectRevert(InstantActions.TooManyMinSkills.selector);
        instantActions.addActions(_inputs(input));
        input.minSkills = _skills(Skill.WOODCUTTING, Skill.FIREMAKING);
        vm.expectRevert(InstantActions.LengthMismatch.selector);
        instantActions.addActions(_inputs(input));
        input.minSkills = _skills3(Skill.WOODCUTTING, Skill.FIREMAKING, Skill.WOODCUTTING);
        vm.expectRevert(InstantActions.MinimumSkillsNoDuplicates.selector);
        instantActions.addActions(_inputs(input));
    }

    function testOutputItemValidation() public {
        InstantActions.InstantActionInput memory input = _threeInput(InstantActions.InstantActionType.GENERIC);
        input.outputTokenId = RUNITE_ARROW;
        vm.expectRevert(InstantActions.OutputAmountCannotBeZero.selector);
        instantActions.addActions(_inputs(input));
        input.outputAmount = 1;
        input.outputTokenId = 0;
        vm.expectRevert(InstantActions.OutputTokenIdCannotBeEmpty.selector);
        instantActions.addActions(_inputs(input));
    }

    function testAnyInputsBurntGenericAndState() public {
        InstantActions.InstantActionInput memory input = _threeOutput();
        _add(input);
        itemNFT.mintBatch(ALICE, _uints(BRONZE_ARROW, IRON_ARROW, ADAMANTINE_ARROW), _uints(3, 3, 3));
        InstantActions.InstantActionState memory state =
            instantActions.getInstantActionState(playerId, _uint16s(1), _uints(1), input.actionType);
        assertEq(state.consumedTokenIds, _uints(BRONZE_ARROW, IRON_ARROW, ADAMANTINE_ARROW));
        assertEq(state.consumedAmounts, _uints(1, 2, 3));
        assertEq(state.producedTokenIds, _uints(RUNITE_ARROW));
        assertEq(state.producedAmounts, _uints(2));
        _do(_uint16s(1), _uints(1), input.actionType);
        assertEq(
            itemNFT.balanceOfs(ALICE, _uint16s(BRONZE_ARROW, IRON_ARROW, ADAMANTINE_ARROW, RUNITE_ARROW)),
            _uints(2, 1, 0, 2)
        );
    }

    function testDoMultipleGenericInstantActionsAtOnce() public {
        InstantActions.InstantActionInput memory a = _threeOutput();
        InstantActions.InstantActionInput memory b = _input(InstantActions.InstantActionType.GENERIC);
        b.actionId = 2;
        b.inputTokenIds = _uint16s(BRONZE_BAR, IRON_BAR, ADAMANTINE_BAR);
        b.inputAmounts = _uint24s(4, 5, 6);
        b.outputTokenId = RUNITE_BAR;
        b.outputAmount = 2;
        instantActions.addActions(_inputs(a, b));
        uint256[] memory ids = _uints(BRONZE_ARROW, IRON_ARROW, ADAMANTINE_ARROW, BRONZE_BAR, IRON_BAR, ADAMANTINE_BAR);
        itemNFT.mintBatch(ALICE, ids, _uints(6, 6, 6, 6, 6, 6));
        vm.expectEmit(false, false, false, true, address(instantActions));
        emit InstantActions.DoInstantActions(
            playerId,
            ALICE,
            _uint16s(1, 2),
            _uints(2, 1),
            ids,
            _uints(2, 4, 6, 4, 5, 6),
            _uints(RUNITE_ARROW, RUNITE_BAR),
            _uints(4, 2),
            a.actionType
        );
        _do(_uint16s(1, 2), _uints(2, 1), a.actionType);
        assertEq(
            itemNFT.balanceOfs(
                ALICE,
                _uint16s8(
                    BRONZE_ARROW,
                    IRON_ARROW,
                    ADAMANTINE_ARROW,
                    RUNITE_ARROW,
                    BRONZE_BAR,
                    IRON_BAR,
                    ADAMANTINE_BAR,
                    RUNITE_BAR
                )
            ),
            _uints8(4, 2, 0, 4, 2, 1, 0, 2)
        );
    }

    function testCannotAddSameInstantActionTwice() public {
        InstantActions.InstantActionInput memory input = _input(InstantActions.InstantActionType.GENERIC);
        _add(input);
        vm.expectRevert(InstantActions.ActionAlreadyExists.selector);
        _add(input);
    }

    function testMustBeOwnerToAddAction() public {
        InstantActions.InstantActionInput memory input = _input(InstantActions.InstantActionType.GENERIC);
        vm.prank(ALICE);
        vm.expectRevert(abi.encodeWithSelector(OwnableUpgradeable.OwnableUnauthorizedAccount.selector, ALICE));
        instantActions.addActions(_inputs(input));
        _add(input);
    }

    function testMustBeOwnerToEditAction() public {
        InstantActions.InstantActionInput memory input = _input(InstantActions.InstantActionType.GENERIC);
        _add(input);
        vm.prank(ALICE);
        vm.expectRevert(abi.encodeWithSelector(OwnableUpgradeable.OwnableUnauthorizedAccount.selector, ALICE));
        instantActions.editActions(_inputs(input));
        instantActions.editActions(_inputs(input));
    }

    function testEditedActionMustExist() public {
        InstantActions.InstantActionInput memory input = _input(InstantActions.InstantActionType.GENERIC);
        vm.expectRevert(InstantActions.ActionDoesNotExist.selector);
        instantActions.editActions(_inputs(input));
        _add(input);
        input.inputTokenIds[0] = IRON_ARROW;
        vm.expectEmit(false, false, false, false, address(instantActions));
        emit InstantActions.EditInstantActions(_inputs(input));
        instantActions.editActions(_inputs(input));
        assertEq(instantActions.getAction(input.actionType, 1).inputTokenId1, IRON_ARROW);
    }

    function testMustBeOwnerToRemoveAction() public {
        InstantActions.InstantActionInput memory input = _input(InstantActions.InstantActionType.GENERIC);
        _add(input);
        vm.prank(ALICE);
        vm.expectRevert(abi.encodeWithSelector(OwnableUpgradeable.OwnableUnauthorizedAccount.selector, ALICE));
        instantActions.removeActions(_types(input.actionType), _uint16s(1));
    }

    function testRemovedActionMustExist() public {
        InstantActions.InstantActionType t = InstantActions.InstantActionType.GENERIC;
        vm.expectRevert(InstantActions.ActionDoesNotExist.selector);
        instantActions.removeActions(_types(t), _uint16s(1));
        _add(_input(t));
        vm.expectEmit(false, false, false, true, address(instantActions));
        emit InstantActions.RemoveInstantActions(_types(t), _uint16s(1));
        instantActions.removeActions(_types(t), _uint16s(1));
        assertEq(instantActions.getAction(t, 1).inputTokenId1, 0);
    }

    function testMustOwnActivePlayerToDoInstantActions() public {
        InstantActions.InstantActionType t = InstantActions.InstantActionType.GENERIC;
        _add(_input(t));
        vm.expectRevert(InstantActions.NotOwnerOfPlayerAndActive.selector);
        instantActions.doInstantActions(playerId, _uint16s(1), _uints(1), t);
    }

    function testCannotDoNonexistentAction() public {
        vm.prank(ALICE);
        vm.expectRevert(InstantActions.InvalidActionId.selector);
        instantActions.doInstantActions(playerId, _uint16s(0), _uints(1), InstantActions.InstantActionType.GENERIC);
    }

    function testMustHaveMinimumRequirements() public {
        InstantActions.InstantActionInput memory input = _input(InstantActions.InstantActionType.GENERIC);
        input.minSkills = _skills(Skill.WOODCUTTING, Skill.FIREMAKING);
        input.minXPs = _uint32s2(1, 1);
        _add(input);
        itemNFT.mint(ALICE, BRONZE_ARROW, 1);
        vm.prank(ALICE);
        vm.expectRevert(abi.encodeWithSelector(InstantActions.MinimumXPNotReached.selector, Skill.WOODCUTTING, 1));
        instantActions.doInstantActions(playerId, _uint16s(1), _uints(1), input.actionType);
        players.modifyXP(ALICE, playerId, Skill.WOODCUTTING, 1, true);
        vm.prank(ALICE);
        vm.expectRevert(abi.encodeWithSelector(InstantActions.MinimumXPNotReached.selector, Skill.FIREMAKING, 1));
        instantActions.doInstantActions(playerId, _uint16s(1), _uints(1), input.actionType);
        players.modifyXP(ALICE, playerId, Skill.FIREMAKING, 2, true);
        _do(_uint16s(1), _uints(1), input.actionType);
    }

    function testAmountGreaterThanOneGeneric() public {
        InstantActions.InstantActionInput memory input = _threeOutput();
        _add(input);
        itemNFT.mintBatch(ALICE, _uints(BRONZE_ARROW, IRON_ARROW, ADAMANTINE_ARROW), _uints(6, 6, 6));
        _do(_uint16s(1), _uints(2), input.actionType);
        assertEq(
            itemNFT.balanceOfs(ALICE, _uint16s(BRONZE_ARROW, IRON_ARROW, ADAMANTINE_ARROW, RUNITE_ARROW)),
            _uints(4, 2, 0, 4)
        );
    }

    function testAddMultipleActions() public {
        InstantActions.InstantActionType t = InstantActions.InstantActionType.GENERIC;
        InstantActions.InstantActionInput memory a = _input(t);
        a.inputTokenIds = _uint16s(IRON_ARROW, ADAMANTINE_ARROW);
        a.inputAmounts = _uint24s2(1, 2);
        a.outputTokenId = RUNITE_ARROW;
        a.outputAmount = 2;
        InstantActions.InstantActionInput memory b = _threeOutput();
        b.actionId = 2;
        b.inputAmounts = _uint24s(3, 5, 7);
        b.outputTokenId = ORICHALCUM_ARROW;
        b.outputAmount = 3;
        instantActions.addActions(_inputs(a, b));
        InstantActions.InstantAction memory x = instantActions.getAction(t, 1);
        assertEq(x.inputTokenId1, IRON_ARROW);
        assertEq(x.inputTokenId3, 0);
        assertEq(x.outputTokenId, RUNITE_ARROW);
        assertEq(x.outputAmount, 2);
        x = instantActions.getAction(t, 2);
        assertEq(x.inputTokenId3, ADAMANTINE_ARROW);
        assertEq(x.outputTokenId, ORICHALCUM_ARROW);
        assertEq(x.outputAmount, 3);
    }

    function testCheckPackedData() public {
        InstantActions.InstantActionInput memory input = _threeInput(InstantActions.InstantActionType.GENERIC);
        input.isFullModeOnly = true;
        _add(input);
        assertEq(instantActions.getAction(input.actionType, 1).packedData, bytes1(0x80));
    }

    function testCheckFullModeRequirements() public {
        InstantActions.InstantActionInput memory input = _input(InstantActions.InstantActionType.GENERIC);
        input.isFullModeOnly = true;
        _add(input);
        itemNFT.mint(ALICE, BRONZE_ARROW, 2);
        vm.prank(ALICE);
        vm.expectRevert(InstantActions.PlayerNotUpgraded.selector);
        instantActions.doInstantActions(playerId, _uint16s(1), _uints(2), input.actionType);
        brush.mint(ALICE, 1 ether);
        vm.startPrank(ALICE);
        brush.approve(address(playerNFT), 1 ether);
        playerNFT.editPlayer(playerId, ORIG_NAME, "", "", "", true);
        instantActions.doInstantActions(playerId, _uint16s(1), _uints(2), input.actionType);
        vm.stopPrank();
    }

    function testSingleInputForging() public {
        InstantActions.InstantActionInput memory input = _forge(IRON_ARROW, 1, BRONZE_ARROW, 2);
        _add(input);
        itemNFT.mint(ALICE, IRON_ARROW, 1);
        _do(_uint16s(1), _uints(1), input.actionType);
        assertEq(itemNFT.balanceOf(ALICE, IRON_ARROW), 0);
        assertEq(itemNFT.balanceOf(ALICE, BRONZE_ARROW), 2);
    }

    function testForgingIncorrectInputLength() public {
        InstantActions.InstantActionInput memory input = _forge(IRON_ARROW, 1, BRONZE_ARROW, 2);
        input.inputTokenIds = new uint16[](0);
        input.inputAmounts = new uint24[](0);
        vm.expectRevert(InstantActions.IncorrectInputAmounts.selector);
        _add(input);
        input.inputTokenIds = _uint16s(IRON_ARROW, IRON_ARROW);
        input.inputAmounts = _uint24s2(1, 1);
        vm.expectRevert(InstantActions.IncorrectInputAmounts.selector);
        _add(input);
    }

    function testForgingInputsBurnt() public {
        InstantActions.InstantActionInput memory input = _forge(BRONZE_ARROW, 2, RUNITE_ARROW, 1);
        _add(input);
        itemNFT.mint(ALICE, BRONZE_ARROW, 4);
        _do(_uint16s(1), _uints(1), input.actionType);
        assertEq(itemNFT.balanceOf(ALICE, BRONZE_ARROW), 2);
        assertEq(itemNFT.balanceOf(ALICE, RUNITE_ARROW), 1);
    }

    function testAmountGreaterThanOneForging() public {
        InstantActions.InstantActionInput memory input = _forge(BRONZE_ARROW, 1, RUNITE_ARROW, 3);
        _add(input);
        itemNFT.mint(ALICE, BRONZE_ARROW, 6);
        _do(_uint16s(1), _uints(2), input.actionType);
        assertEq(itemNFT.balanceOf(ALICE, BRONZE_ARROW), 4);
        assertEq(itemNFT.balanceOf(ALICE, RUNITE_ARROW), 6);
    }

    function testDoMultipleForgingInstantActionsAtOnce() public {
        InstantActions.InstantActionInput memory a = _forge(BRONZE_ARROW, 1, RUNITE_ARROW, 2);
        InstantActions.InstantActionInput memory b = _forge(BRONZE_BAR, 1, RUNITE_ARROW, 1);
        b.actionId = 2;
        instantActions.addActions(_inputs(a, b));
        itemNFT.mintBatch(ALICE, _uints(BRONZE_ARROW, BRONZE_BAR), _uints(6, 6));
        InstantActions.InstantActionState memory state =
            instantActions.getInstantActionState(playerId, _uint16s(1, 2), _uints(2, 1), a.actionType);
        assertEq(state.consumedTokenIds, _uints(BRONZE_ARROW, BRONZE_BAR));
        assertEq(state.consumedAmounts, _uints(2, 1));
        assertEq(state.producedTokenIds, _uints(RUNITE_ARROW));
        assertEq(state.producedAmounts, _uints(5));
        vm.expectEmit(false, false, false, true, address(instantActions));
        emit InstantActions.DoInstantActions(
            playerId,
            ALICE,
            _uint16s(1, 2),
            _uints(2, 1),
            _uints(BRONZE_ARROW, BRONZE_BAR),
            _uints(2, 1),
            _uints(RUNITE_ARROW),
            _uints(5),
            a.actionType
        );
        _do(_uint16s(1, 2), _uints(2, 1), a.actionType);
        assertEq(itemNFT.balanceOfs(ALICE, _uint16s(BRONZE_ARROW, BRONZE_BAR, RUNITE_ARROW)), _uints(4, 5, 5));
    }

    function testCannotForgeDifferentOutputTokens() public {
        InstantActions.InstantActionInput memory a = _forge(BRONZE_ARROW, 1, RUNITE_ARROW, 3);
        InstantActions.InstantActionInput memory b = _forge(BRONZE_ARROW, 1, RUNITE_BAR, 1);
        b.actionId = 2;
        instantActions.addActions(_inputs(a, b));
        itemNFT.mint(ALICE, BRONZE_ARROW, 6);
        vm.prank(ALICE);
        vm.expectRevert(InstantActions.InvalidOutputTokenId.selector);
        instantActions.doInstantActions(playerId, _uint16s(1, 2), _uints(1, 1), a.actionType);
    }

    function testIncorrectActionTypeReverts() public {
        InstantActions.InstantActionInput memory input = _input(InstantActions.InstantActionType.NONE);
        vm.expectRevert(InstantActions.UnsupportedActionType.selector);
        _add(input);
        vm.prank(ALICE);
        vm.expectRevert(InstantActions.UnsupportedActionType.selector);
        instantActions.doInstantActions(playerId, _uint16s(1), _uints(2), input.actionType);
    }

    function testQuestRequirementMustBeCompleted() public {
        vm.deal(ALICE, 1 ether);
        InstantActions.InstantActionInput memory input = _threeOutput();
        input.questPrerequisiteId = uint16(QUEST_PURSE_STRINGS);
        input.inputTokenIds = _uint16s(BRONZE_ARROW);
        input.inputAmounts = _uint24s(1);
        _add(input);
        itemNFT.mint(ALICE, BRONZE_ARROW, 1);
        vm.prank(ALICE);
        vm.expectRevert(InstantActions.DependentQuestNotCompleted.selector);
        instantActions.doInstantActions(playerId, _uint16s(1), _uints(1), input.actionType);
        QuestInput[] memory qs = new QuestInput[](1);
        qs[0].questId = uint16(QUEST_PURSE_STRINGS);
        qs[0].skillReward = Skill.FIREMAKING;
        qs[0].skillXPGained = 1;
        Quests.MinimumRequirement[3][] memory reqs = new Quests.MinimumRequirement[3][](1);
        quests.addQuests(qs, reqs);
        vm.startPrank(ALICE);
        players.activateQuest(playerId, QUEST_PURSE_STRINGS);
        players.buyBrushQuest{value: 10}(ALICE, playerId, 0, true);
        instantActions.doInstantActions(playerId, _uint16s(1), _uints(1), input.actionType);
        vm.stopPrank();
    }

    function _input(InstantActions.InstantActionType t)
        private
        pure
        returns (InstantActions.InstantActionInput memory x)
    {
        x.actionId = 1;
        x.actionType = t;
        x.inputTokenIds = _uint16s(BRONZE_ARROW);
        x.inputAmounts = _uint24s(1);
        x.isAvailable = true;
    }

    function _threeInput(InstantActions.InstantActionType t)
        private
        pure
        returns (InstantActions.InstantActionInput memory x)
    {
        x = _input(t);
        x.inputTokenIds = _uint16s(BRONZE_ARROW, IRON_ARROW, ADAMANTINE_ARROW);
        x.inputAmounts = _uint24s(1, 2, 3);
    }

    function _threeOutput() private pure returns (InstantActions.InstantActionInput memory x) {
        x = _threeInput(InstantActions.InstantActionType.GENERIC);
        x.outputTokenId = RUNITE_ARROW;
        x.outputAmount = 2;
    }

    function _forge(uint16 inId, uint24 inAmount, uint16 outId, uint16 outAmount)
        private
        pure
        returns (InstantActions.InstantActionInput memory x)
    {
        x = _input(InstantActions.InstantActionType.FORGING_COMBINE);
        x.inputTokenIds[0] = inId;
        x.inputAmounts[0] = inAmount;
        x.outputTokenId = outId;
        x.outputAmount = outAmount;
    }

    function _add(InstantActions.InstantActionInput memory x) private {
        instantActions.addActions(_inputs(x));
    }

    function _do(uint16[] memory ids, uint256[] memory amounts, InstantActions.InstantActionType t) private {
        vm.prank(ALICE);
        instantActions.doInstantActions(playerId, ids, amounts, t);
    }

    function _inputs(InstantActions.InstantActionInput memory a)
        private
        pure
        returns (InstantActions.InstantActionInput[] memory v)
    {
        v = new InstantActions.InstantActionInput[](1);
        v[0] = a;
    }

    function _inputs(InstantActions.InstantActionInput memory a, InstantActions.InstantActionInput memory b)
        private
        pure
        returns (InstantActions.InstantActionInput[] memory v)
    {
        v = new InstantActions.InstantActionInput[](2);
        v[0] = a;
        v[1] = b;
    }

    function _types(InstantActions.InstantActionType a)
        private
        pure
        returns (InstantActions.InstantActionType[] memory v)
    {
        v = new InstantActions.InstantActionType[](1);
        v[0] = a;
    }

    function _skills(Skill a, Skill b) private pure returns (uint8[] memory v) {
        v = new uint8[](2);
        v[0] = uint8(a);
        v[1] = uint8(b);
    }

    function _skills3(Skill a, Skill b, Skill c) private pure returns (uint8[] memory v) {
        v = new uint8[](3);
        v[0] = uint8(a);
        v[1] = uint8(b);
        v[2] = uint8(c);
    }

    function _skills4(Skill a, Skill b, Skill c, Skill d) private pure returns (uint8[] memory v) {
        v = new uint8[](4);
        v[0] = uint8(a);
        v[1] = uint8(b);
        v[2] = uint8(c);
        v[3] = uint8(d);
    }

    function _uint16s8(uint16 a, uint16 b, uint16 c, uint16 d, uint16 e, uint16 f, uint16 g, uint16 h)
        private
        pure
        returns (uint16[] memory v)
    {
        v = new uint16[](8);
        v[0] = a;
        v[1] = b;
        v[2] = c;
        v[3] = d;
        v[4] = e;
        v[5] = f;
        v[6] = g;
        v[7] = h;
    }

    function _uint24s2(uint24 a, uint24 b) private pure returns (uint24[] memory v) {
        v = new uint24[](2);
        v[0] = a;
        v[1] = b;
    }

    function _uint32s2(uint32 a, uint32 b) private pure returns (uint32[] memory v) {
        v = new uint32[](2);
        v[0] = a;
        v[1] = b;
    }

    function _uints(uint256 a, uint256 b, uint256 c, uint256 d) private pure returns (uint256[] memory v) {
        v = new uint256[](4);
        v[0] = a;
        v[1] = b;
        v[2] = c;
        v[3] = d;
    }

    function _uints(uint256 a, uint256 b, uint256 c, uint256 d, uint256 e, uint256 f)
        private
        pure
        returns (uint256[] memory v)
    {
        v = new uint256[](6);
        v[0] = a;
        v[1] = b;
        v[2] = c;
        v[3] = d;
        v[4] = e;
        v[5] = f;
    }

    function _uints8(uint256 a, uint256 b, uint256 c, uint256 d, uint256 e, uint256 f, uint256 g, uint256 h)
        private
        pure
        returns (uint256[] memory v)
    {
        v = new uint256[](8);
        v[0] = a;
        v[1] = b;
        v[2] = c;
        v[3] = d;
        v[4] = e;
        v[5] = f;
        v[6] = g;
        v[7] = h;
    }
}
