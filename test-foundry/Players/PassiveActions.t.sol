// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import {FullGameStack} from "../utils/FullGameStack.sol";
import {PassiveActions} from "../interfaces/PassiveActions.sol";
import {Skill, BoostType} from "../../contracts/globals/misc.sol";
import {EquipPosition, ItemInput} from "../../contracts/globals/players.sol";
import {GuaranteedReward, RandomReward} from "../../contracts/globals/rewards.sol";

contract PassiveActionsTest is FullGameStack {
    uint16 private constant POISON = 13_694;
    uint16 private constant OAK_LOG = 10_257;
    uint16 private constant WILLOW_LOG = 10_258;
    uint16 private constant MAGICAL_LOG = 10_264;
    uint16 private constant BRONZE_ARROW = 11_776;
    uint16 private constant IRON_ARROW = 11_777;
    uint16 private constant ADAMANTINE_ARROW = 11_779;
    uint16 private constant RUNITE_ARROW = 11_780;

    function setUp() public {
        deployFullGame();
    }

    function testSimple() public {
        PassiveActions.PassiveActionInput memory input = _input();
        input.info.skipSuccessPercent = 1;
        _add(input);
        _mintAndStart(POISON, 1, input.actionId, 0);
        vm.warp(block.timestamp + 1 days);
        (bool finished, bool oracleCalled,,,) = passiveActions.finishedInfo(playerId);
        assertTrue(finished);
        assertFalse(oracleCalled);
        _fulfill();
        (, oracleCalled,,,) = passiveActions.finishedInfo(playerId);
        assertFalse(oracleCalled);
        _fulfill();
        (, oracleCalled,,,) = passiveActions.finishedInfo(playerId);
        assertTrue(oracleCalled);
        vm.prank(ALICE);
        vm.expectRevert(PassiveActions.ActionAlreadyFinished.selector);
        passiveActions.endEarly(playerId);
        vm.prank(ALICE);
        passiveActions.claim(playerId);
    }

    function testCheckInputItemOrder() public {
        PassiveActions.PassiveActionInput memory input = _input();
        input.info.inputTokenIds = _uint16s(1, 2, 3);
        input.info.inputAmounts = _uint24s(4, 2, 3);
        vm.expectRevert(PassiveActions.InputAmountsMustBeInOrder.selector);
        _add(input);
        input.info.inputAmounts = _uint24s(1, 4, 3);
        vm.expectRevert(PassiveActions.InputAmountsMustBeInOrder.selector);
        _add(input);
        input.info.inputAmounts = _uint24s(1, 2, 1);
        vm.expectRevert(PassiveActions.InputAmountsMustBeInOrder.selector);
        _add(input);
        input.info.inputAmounts[2] = 3;
        _add(input);
    }

    function testAnyInputsShouldBeBurnt() public {
        PassiveActions.PassiveActionInput memory input = _input();
        input.info.inputTokenIds[0] = OAK_LOG;
        input.info.inputAmounts[0] = 100;
        _add(input);
        itemNFT.mint(ALICE, OAK_LOG, 99);
        vm.prank(ALICE);
        vm.expectRevert();
        passiveActions.startAction(playerId, 1, 0);
        itemNFT.mint(ALICE, OAK_LOG, 1);
        vm.prank(ALICE);
        passiveActions.startAction(playerId, 1, 0);
        assertEq(itemNFT.balanceOf(ALICE, OAK_LOG), 0);
    }

    function testCannotAddSamePassiveActionTwice() public {
        PassiveActions.PassiveActionInput memory input = _input();
        _add(input);
        vm.expectRevert(abi.encodeWithSelector(PassiveActions.ActionAlreadyExists.selector, 1));
        _add(input);
    }

    function testPassiveActionMustNotBeGreaterThan64Days() public {
        PassiveActions.PassiveActionInput memory input = _input();
        input.info.durationDays = 65;
        vm.expectRevert(PassiveActions.DurationTooLong.selector);
        _add(input);
        input.info.durationDays = 64;
        _add(input);
    }

    function testMustBeOwnerToEditAnAction() public {
        PassiveActions.PassiveActionInput memory input = _input();
        _add(input);
        vm.prank(ALICE);
        vm.expectRevert(abi.encodeWithSelector(OwnableUpgradeable.OwnableUnauthorizedAccount.selector, ALICE));
        passiveActions.editActions(_inputs(input));
        passiveActions.editActions(_inputs(input));
    }

    function testEditedActionMustExist() public {
        PassiveActions.PassiveActionInput memory input = _input();
        vm.expectRevert(PassiveActions.ActionDoesNotExist.selector);
        passiveActions.editActions(_inputs(input));

        _add(input);
        input.info.durationDays = 2;
        passiveActions.editActions(_inputs(input));
        assertEq(passiveActions.getAction(input.actionId).durationDays, 2);
    }

    function testMustBeOwnerOfPlayerToStartEndAndClaimActions() public {
        PassiveActions.PassiveActionInput memory input = _input();
        _add(input);
        itemNFT.mint(ALICE, POISON, 2);
        vm.expectRevert(PassiveActions.NotOwnerOfPlayerAndActive.selector);
        passiveActions.startAction(playerId, 1, 0);
        vm.prank(ALICE);
        passiveActions.startAction(playerId, 1, 0);
        vm.warp(block.timestamp + 1 days - 10);
        (bool finished,,,,) = passiveActions.finishedInfo(playerId);
        assertFalse(finished);
        vm.expectRevert(PassiveActions.NotOwnerOfPlayerAndActive.selector);
        passiveActions.endEarly(playerId);
        vm.prank(ALICE);
        passiveActions.endEarly(playerId);
        vm.prank(ALICE);
        passiveActions.startAction(playerId, 1, 0);
        vm.warp(vm.getBlockTimestamp() + 1 days);
        _fulfill();
        vm.expectRevert(PassiveActions.NotOwnerOfPlayerAndActive.selector);
        passiveActions.claim(playerId);
        vm.prank(ALICE);
        passiveActions.claim(playerId);
    }

    function testCannotStartAnActionWhichDoesNotExist() public {
        vm.prank(ALICE);
        vm.expectRevert(PassiveActions.InvalidActionId.selector);
        passiveActions.startAction(playerId, 1, 0);
    }

    function testMustHaveMinimumRequirementsToStart() public {
        PassiveActions.PassiveActionInput memory input = _input();
        input.info.minSkills = _skills3(Skill.WOODCUTTING, Skill.FIREMAKING, Skill.ALCHEMY);
        input.info.minLevels = _uint8s3(2, 2, 2);
        _add(input);
        itemNFT.mint(ALICE, POISON, 1);
        vm.prank(ALICE);
        vm.expectRevert(abi.encodeWithSelector(PassiveActions.MinimumLevelNotReached.selector, Skill.WOODCUTTING, 2));
        passiveActions.startAction(playerId, 1, 0);
        players.modifyXP(ALICE, playerId, Skill.WOODCUTTING, _xpAtLevel(3), true);
        players.modifyXP(ALICE, playerId, Skill.FIREMAKING, _xpAtLevel(2), true);
        vm.prank(ALICE);
        vm.expectRevert(abi.encodeWithSelector(PassiveActions.MinimumLevelNotReached.selector, Skill.ALCHEMY, 2));
        passiveActions.startAction(playerId, 1, 0);
        players.modifyXP(ALICE, playerId, Skill.ALCHEMY, _xpAtLevel(2), true);
        vm.prank(ALICE);
        passiveActions.startAction(playerId, 1, 0);
    }

    function testAddMultipleActions() public {
        PassiveActions.PassiveActionInput memory a = _input();
        a.info.durationDays = 10;
        a.info.minSkills = _skills1(Skill.WOODCUTTING);
        a.info.minLevels = _uint8s1(uint8(_xpAtLevel(2)));
        PassiveActions.PassiveActionInput memory b = _input();
        b.actionId = 2;
        b.info.minSkills = _skills1(Skill.FIREMAKING);
        b.info.minLevels = _uint8s1(uint8(_xpAtLevel(3)));
        passiveActions.addActions(_inputs(a, b));
        assertEq(passiveActions.getAction(1).durationDays, 10);
        assertEq(uint8(passiveActions.getAction(1).minSkill1), uint8(Skill.WOODCUTTING));
        assertEq(passiveActions.getAction(2).durationDays, 1);
        assertEq(uint8(passiveActions.getAction(2).minSkill1), uint8(Skill.FIREMAKING));
    }

    function testCheckGuaranteedRewards() public {
        PassiveActions.PassiveActionInput memory input = _input();
        input.info.durationDays = 2;
        input.guaranteedRewards = _guaranteed3(OAK_LOG, 2, WILLOW_LOG, 5, MAGICAL_LOG, 10);
        _add(input);
        itemNFT.mint(ALICE, POISON, 3);
        _start(1, 0);
        vm.warp(block.timestamp + 1 days);
        _fulfill();
        _fulfill();
        (bool finished,, bool random,,) = passiveActions.finishedInfo(playerId);
        assertFalse(finished);
        assertFalse(random);
        vm.prank(ALICE);
        passiveActions.endEarly(playerId);
        assertEq(itemNFT.balanceOf(ALICE, OAK_LOG), 0);
        assertEq(itemNFT.balanceOf(ALICE, WILLOW_LOG), 0);
        assertEq(itemNFT.balanceOf(ALICE, MAGICAL_LOG), 0);
        _start(1, 0);
        vm.warp(block.timestamp + 2 days);
        _fulfill();
        _fulfill();
        (finished,,,,) = passiveActions.finishedInfo(playerId);
        assertTrue(finished);
        vm.prank(ALICE);
        passiveActions.claim(playerId);
        assertEq(itemNFT.balanceOf(ALICE, OAK_LOG), 2);
        assertEq(itemNFT.balanceOf(ALICE, WILLOW_LOG), 5);
        assertEq(itemNFT.balanceOf(ALICE, MAGICAL_LOG), 10);
    }

    function testCheckRandomRewards() public {
        PassiveActions.PassiveActionInput memory input = _randomInput(1, 2, 1, OAK_LOG, 10);
        input.randomRewards =
            _random4(BRONZE_ARROW, 65_535, 1, IRON_ARROW, 65_535, 3, ADAMANTINE_ARROW, 65_535, 2, RUNITE_ARROW, 1, 2);
        _fulfill();
        _add(input);
        itemNFT.mint(ALICE, POISON, 3);
        _start(1, 0);
        vm.warp(block.timestamp + 1 days);
        _fulfill();
        (bool finished, bool oracle, bool random,,) = passiveActions.finishedInfo(playerId);
        assertFalse(finished);
        assertTrue(oracle);
        assertTrue(random);
        vm.prank(ALICE);
        passiveActions.endEarly(playerId);
        assertEq(itemNFT.balanceOf(ALICE, BRONZE_ARROW), 0);
        assertEq(itemNFT.balanceOf(ALICE, OAK_LOG), 0);
        _start(1, 0);
        vm.warp(block.timestamp + 2 days + 1);
        _fulfillSeeded(100_000_000_000_000);
        (finished, oracle, random,,) = passiveActions.finishedInfo(playerId);
        assertTrue(finished);
        assertFalse(oracle);
        assertTrue(random);
        _fulfill();
        (, oracle,,,) = passiveActions.finishedInfo(playerId);
        assertTrue(oracle);
        vm.prank(ALICE);
        passiveActions.claim(playerId);
        assertEq(itemNFT.balanceOf(ALICE, BRONZE_ARROW), 2);
        assertEq(itemNFT.balanceOf(ALICE, IRON_ARROW), 6);
        assertEq(itemNFT.balanceOf(ALICE, ADAMANTINE_ARROW), 4);
        assertEq(itemNFT.balanceOf(ALICE, RUNITE_ARROW), 0);
        assertEq(itemNFT.balanceOf(ALICE, OAK_LOG), 10);
    }

    function testStartingNewActionWhenPreviousFinishedOracleNotCalled() public {
        PassiveActions.PassiveActionInput memory a = _randomInput(1, 2, 0, OAK_LOG, 10);
        PassiveActions.PassiveActionInput memory b = _randomInput(2, 1, 0, MAGICAL_LOG, 10);
        b.randomRewards[0].amount = 2;
        passiveActions.addActions(_inputs(a, b));
        _fulfill();
        itemNFT.mint(ALICE, POISON, 3);
        _start(1, 0);
        vm.warp(block.timestamp + 2 days);
        _fulfill();
        (bool finished, bool oracle, bool random,,) = passiveActions.finishedInfo(playerId);
        assertTrue(finished);
        assertFalse(oracle);
        assertTrue(random);
        vm.expectEmit(false, false, false, true, address(passiveActions));
        emit PassiveActions.ClaimPassiveAction(playerId, ALICE, 1, _uints(OAK_LOG), _uints(10), true);
        vm.expectEmit(false, false, false, true, address(passiveActions));
        emit PassiveActions.StartPassiveAction(playerId, ALICE, 2, 2, 0, vm.getBlockTimestamp());
        _start(2, 0);
        assertEq(itemNFT.balanceOf(ALICE, OAK_LOG), 10);
        assertEq(itemNFT.balanceOf(ALICE, MAGICAL_LOG), 0);
        assertEq(itemNFT.balanceOf(ALICE, BRONZE_ARROW), 0);
        vm.warp(block.timestamp + 1 days);
        vm.expectEmit(false, false, false, true, address(passiveActions));
        emit PassiveActions.ClaimPassiveAction(playerId, ALICE, 2, _uints(MAGICAL_LOG), _uints(10), true);
        vm.expectEmit(false, false, false, true, address(passiveActions));
        emit PassiveActions.StartPassiveAction(playerId, ALICE, 2, 3, 0, vm.getBlockTimestamp());
        _start(2, 0);
        assertEq(itemNFT.balanceOf(ALICE, OAK_LOG), 10);
        assertEq(itemNFT.balanceOf(ALICE, MAGICAL_LOG), 10);
        assertEq(itemNFT.balanceOf(ALICE, BRONZE_ARROW), 0);
    }

    function testStartingNewActionWhenPreviousFinishedOracleCalled() public {
        PassiveActions.PassiveActionInput memory a = _randomInput(1, 2, 1, OAK_LOG, 10);
        PassiveActions.PassiveActionInput memory b = _randomInput(2, 1, 1, MAGICAL_LOG, 10);
        b.randomRewards[0].amount = 2;
        passiveActions.addActions(_inputs(a, b));
        _fulfill();
        itemNFT.mint(ALICE, POISON, 3);
        _start(1, 0);
        vm.warp(block.timestamp + 2 days);
        _fulfill();
        _fulfill();
        (bool finished, bool oracle, bool random,,) = passiveActions.finishedInfo(playerId);
        assertTrue(finished);
        assertTrue(oracle);
        assertTrue(random);
        vm.expectEmit(false, false, false, true, address(passiveActions));
        emit PassiveActions.ClaimPassiveAction(playerId, ALICE, 1, _uints(OAK_LOG, BRONZE_ARROW), _uints(10, 2), true);
        vm.expectEmit(false, false, false, true, address(passiveActions));
        emit PassiveActions.StartPassiveAction(playerId, ALICE, 2, 2, 0, vm.getBlockTimestamp());
        _start(2, 0);
        assertEq(itemNFT.balanceOf(ALICE, OAK_LOG), 10);
        assertEq(itemNFT.balanceOf(ALICE, BRONZE_ARROW), 2);
        vm.warp(block.timestamp + 1 days);
        PassiveActions.PendingPassiveActionState memory state = passiveActions.pendingPassiveActionState(playerId);
        assertFalse(state.isReady);
        assertEq(state.producedRandomRewardItemTokenIds.length, 0);
        _fulfill();
        state = passiveActions.pendingPassiveActionState(playerId);
        assertEq(state.producedRandomRewardItemTokenIds, _uints(BRONZE_ARROW));
        assertEq(state.producedRandomRewardAmounts, _uints(2));
        vm.expectEmit(false, false, false, true, address(passiveActions));
        emit PassiveActions.ClaimPassiveAction(
            playerId, ALICE, 2, _uints(MAGICAL_LOG, BRONZE_ARROW), _uints(10, 2), true
        );
        vm.expectEmit(false, false, false, true, address(passiveActions));
        emit PassiveActions.StartPassiveAction(playerId, ALICE, 2, 3, 0, vm.getBlockTimestamp());
        _start(2, 0);
        assertEq(itemNFT.balanceOf(ALICE, MAGICAL_LOG), 10);
        assertEq(itemNFT.balanceOf(ALICE, BRONZE_ARROW), 4);
    }

    function testStartingNewActionWhenPreviousNotFinishedIsNotAllowed() public {
        PassiveActions.PassiveActionInput memory a = _randomInput(1, 2, 1, OAK_LOG, 10);
        PassiveActions.PassiveActionInput memory b = _randomInput(2, 1, 0, MAGICAL_LOG, 10);
        b.randomRewards[0].amount = 2;
        passiveActions.addActions(_inputs(a, b));
        itemNFT.mint(ALICE, POISON, 3);
        _start(1, 0);
        vm.warp(block.timestamp + 1 days);
        _fulfill();
        _fulfill();
        (bool finished, bool oracle, bool random,,) = passiveActions.finishedInfo(playerId);
        assertFalse(finished);
        assertTrue(oracle);
        assertTrue(random);
        vm.prank(ALICE);
        vm.expectRevert(PassiveActions.PreviousActionNotFinished.selector);
        passiveActions.startAction(playerId, 2, 0);
        vm.expectEmit(false, false, false, true, address(passiveActions));
        emit PassiveActions.EarlyEndPassiveAction(playerId, ALICE, 1);
        vm.prank(ALICE);
        passiveActions.endEarly(playerId);
        vm.expectEmit(false, false, false, true, address(passiveActions));
        emit PassiveActions.StartPassiveAction(playerId, ALICE, 2, 2, 0, vm.getBlockTimestamp());
        _start(2, 0);
    }

    function testDoNotAllowCompletingUnlessOracleCalledWithRandomRewards() public {
        PassiveActions.PassiveActionInput memory input = _randomInput(1, 2, 0, 0, 0);
        input.guaranteedRewards = new GuaranteedReward[](0);
        _add(input);
        _mintAndStart(POISON, 1, 1, 0);
        vm.warp(block.timestamp + 2 days);
        _fulfill();
        (bool finished, bool oracle, bool random,,) = passiveActions.finishedInfo(playerId);
        assertTrue(finished);
        assertFalse(oracle);
        assertTrue(random);
        vm.prank(ALICE);
        vm.expectRevert(PassiveActions.PassiveActionNotReadyToBeClaimed.selector);
        passiveActions.claim(playerId);
    }

    function testAllowCompletingWithoutRandomRewards() public {
        PassiveActions.PassiveActionInput memory input = _input();
        _add(input);
        _mintAndStart(POISON, 1, 1, 0);
        vm.warp(block.timestamp + 1 days);
        (bool finished, bool oracle, bool random,,) = passiveActions.finishedInfo(playerId);
        assertTrue(finished);
        assertFalse(oracle);
        assertFalse(random);
        vm.prank(ALICE);
        passiveActions.claim(playerId);
    }

    function testCheckPackedData() public {
        PassiveActions.PassiveActionInput memory input = _input();
        input.info.isFullModeOnly = true;
        _add(input);
        assertEq(passiveActions.getAction(1).packedData, bytes1(0xc0));
    }

    function testCheckFullModeRequirements() public {
        PassiveActions.PassiveActionInput memory input = _input();
        input.info.isFullModeOnly = true;
        _add(input);
        assertEq(passiveActions.getAction(1).packedData, bytes1(0xc0));
        itemNFT.mint(ALICE, POISON, 1);
        vm.prank(ALICE);
        vm.expectRevert(PassiveActions.PlayerNotUpgraded.selector);
        passiveActions.startAction(playerId, 1, 0);
        brush.mint(ALICE, 1 ether);
        vm.startPrank(ALICE);
        brush.approve(address(playerNFT), 1 ether);
        playerNFT.editPlayer(playerId, ORIG_NAME, "", "", "", true);
        passiveActions.startAction(playerId, 1, 0);
        vm.stopPrank();
    }

    function testCannotClaimTwice() public {
        PassiveActions.PassiveActionInput memory input = _input();
        _add(input);
        _mintAndStart(POISON, 1, 1, 0);
        vm.warp(block.timestamp + 1 days);
        _fulfill();
        _fulfill();
        vm.expectEmit(false, false, false, true, address(passiveActions));
        emit PassiveActions.ClaimPassiveAction(playerId, ALICE, 1, new uint256[](0), new uint256[](0), false);
        vm.prank(ALICE);
        passiveActions.claim(playerId);
        vm.prank(ALICE);
        vm.expectRevert(PassiveActions.NoActivePassiveAction.selector);
        passiveActions.claim(playerId);
    }

    function testEndEarlyOnNonExistentActionReverts() public {
        vm.prank(ALICE);
        vm.expectRevert(PassiveActions.NoActivePassiveAction.selector);
        passiveActions.endEarly(playerId);
    }

    function testCheckSkipSuccessPercent() public {
        PassiveActions.PassiveActionInput memory input = _input();
        input.info.durationDays = 10;
        input.info.skipSuccessPercent = 100;
        _add(input);
        _mintAndStart(POISON, 1, 1, 0);
        vm.warp(block.timestamp + 3 days);
        _fulfill();
        _fulfill();
        _fulfill();
        _fulfill();
        (bool finished, bool oracle,,,) = passiveActions.finishedInfo(playerId);
        assertFalse(finished);
        assertTrue(oracle);
        PassiveActions.PendingPassiveActionState memory state = passiveActions.pendingPassiveActionState(playerId);
        assertFalse(state.isReady);
        assertEq(state.numDaysSkipped, 3);
        assertTrue(state.skippedToday);
        vm.warp(block.timestamp + 2 days);
        _fulfill();
        _fulfill();
        (finished, oracle,,,) = passiveActions.finishedInfo(playerId);
        assertTrue(finished);
        assertTrue(oracle);
        state = passiveActions.pendingPassiveActionState(playerId);
        assertTrue(state.isReady);
        assertEq(state.numDaysSkipped, 5);
        assertTrue(state.skippedToday);
    }

    function testBoostGivesGreaterChanceOfSkippingDay() public {
        PassiveActions.PassiveActionInput memory input = _input();
        input.info.inputTokenIds = _uint16s(BRONZE_ARROW, IRON_ARROW);
        input.info.inputAmounts = _uint24s2(2, 3);
        input.info.durationDays = 10;
        input.info.skipSuccessPercent = 100;
        _add(input);
        uint16 boostId = 12_821;
        ItemInput memory item;
        item.tokenId = boostId;
        item.equipPosition = EquipPosition.PASSIVE_BOOST_VIAL;
        item.boostType = BoostType.PASSIVE_SKIP_CHANCE;
        item.boostValue = 100;
        item.isAvailable = true;
        ItemInput[] memory items = new ItemInput[](1);
        items[0] = item;
        itemNFT.addItems(items);
        itemNFT.mintBatch(ALICE, _uints(boostId, BRONZE_ARROW, IRON_ARROW), _uints(1, 2, 3));
        _start(1, boostId);
        assertEq(itemNFT.balanceOf(ALICE, boostId), 0);
        assertEq(itemNFT.balanceOf(ALICE, BRONZE_ARROW), 0);
        assertEq(itemNFT.balanceOf(ALICE, IRON_ARROW), 0);
        vm.warp(block.timestamp + 5 days);
        _fulfill();
        _fulfill();
        _fulfill();
        _fulfill();
        _fulfill();
        _fulfill();
        (bool finished, bool oracle,,,) = passiveActions.finishedInfo(playerId);
        assertTrue(finished);
        assertTrue(oracle);
        PassiveActions.PendingPassiveActionState memory state = passiveActions.pendingPassiveActionState(playerId);
        assertTrue(state.isReady);
        assertEq(state.numDaysSkipped, 5);
        assertTrue(state.skippedToday);
    }

    function testCheckSkippedToday() public {
        PassiveActions.PassiveActionInput memory input = _input();
        input.info.durationDays = 10;
        input.info.skipSuccessPercent = 100;
        _add(input);
        _mintAndStart(POISON, 1, 1, 0);
        _fulfill();
        vm.warp(block.timestamp + 3 days);
        PassiveActions.PendingPassiveActionState memory state = passiveActions.pendingPassiveActionState(playerId);
        assertFalse(state.isReady);
        assertEq(state.numDaysSkipped, 0);
        assertFalse(state.skippedToday);
        _fulfill();
        state = passiveActions.pendingPassiveActionState(playerId);
        assertEq(state.numDaysSkipped, 1);
        assertFalse(state.skippedToday);
        _fulfill();
        state = passiveActions.pendingPassiveActionState(playerId);
        assertEq(state.numDaysSkipped, 2);
        assertFalse(state.skippedToday);
        _fulfill();
        state = passiveActions.pendingPassiveActionState(playerId);
        assertEq(state.numDaysSkipped, 3);
        assertTrue(state.skippedToday);
        vm.warp(block.timestamp + 1 days);
        state = passiveActions.pendingPassiveActionState(playerId);
        assertFalse(state.isReady);
        assertEq(state.numDaysSkipped, 3);
        assertFalse(state.skippedToday);
    }

    function testPassiveActionOfZeroDaysAllowed() public {
        PassiveActions.PassiveActionInput memory input = _input();
        input.info.durationDays = 0;
        _add(input);
        _mintAndStart(POISON, 1, 1, 0);
        vm.prank(ALICE);
        passiveActions.claim(playerId);
    }

    function testUnavailableActionCannotBeStartedButCanBeLooted() public {
        PassiveActions.PassiveActionInput memory input = _input();
        input.guaranteedRewards = _guaranteed1(MAGICAL_LOG, 10);
        _add(input);
        _mintAndStart(POISON, 1, 1, 0);
        vm.warp(block.timestamp + 1 days);
        input.info.isAvailable = false;
        passiveActions.editActions(_inputs(input));
        vm.prank(ALICE);
        vm.expectRevert(PassiveActions.ActionNotAvailable.selector);
        passiveActions.startAction(playerId, 1, 0);
        vm.prank(ALICE);
        passiveActions.claim(playerId);
        assertEq(itemNFT.balanceOf(ALICE, MAGICAL_LOG), 10);
    }

    function _input() private pure returns (PassiveActions.PassiveActionInput memory input) {
        input.actionId = 1;
        input.info.durationDays = 1;
        input.info.inputTokenIds = _uint16s(POISON);
        input.info.inputAmounts = _uint24s1(1);
        input.info.minSkills = new Skill[](0);
        input.info.minLevels = new uint8[](0);
        input.info.isAvailable = true;
        input.guaranteedRewards = new GuaranteedReward[](0);
        input.randomRewards = new RandomReward[](0);
    }

    function _randomInput(uint16 id, uint8 days_, uint8 skip, uint16 guaranteedId, uint16 rate)
        private
        pure
        returns (PassiveActions.PassiveActionInput memory input)
    {
        input = _input();
        input.actionId = id;
        input.info.durationDays = days_;
        input.info.skipSuccessPercent = skip;
        input.guaranteedRewards = _guaranteed1(guaranteedId, rate);
        input.randomRewards = _random1(BRONZE_ARROW, 65_535, 1);
    }

    function _add(PassiveActions.PassiveActionInput memory input) private {
        passiveActions.addActions(_inputs(input));
    }

    function _start(uint16 id, uint16 boost) private {
        vm.prank(ALICE);
        passiveActions.startAction(playerId, id, boost);
    }

    function _mintAndStart(uint16 id, uint256 amount, uint16 actionId, uint16 boost) private {
        itemNFT.mint(ALICE, id, amount);
        _start(actionId, boost);
    }

    function _fulfill() private {
        _fulfillSeeded(777_666_555);
    }

    function _fulfillSeeded(uint256 seed) private {
        uint256 requestId = randomnessBeacon.requestRandomWords();
        mockVRF.fulfillSeeded(requestId, address(randomnessBeacon), seed);
    }

    function _inputs(PassiveActions.PassiveActionInput memory a)
        private
        pure
        returns (PassiveActions.PassiveActionInput[] memory x)
    {
        x = new PassiveActions.PassiveActionInput[](1);
        x[0] = a;
    }

    function _inputs(PassiveActions.PassiveActionInput memory a, PassiveActions.PassiveActionInput memory b)
        private
        pure
        returns (PassiveActions.PassiveActionInput[] memory x)
    {
        x = new PassiveActions.PassiveActionInput[](2);
        x[0] = a;
        x[1] = b;
    }

    function _skills1(Skill a) private pure returns (Skill[] memory x) {
        x = new Skill[](1);
        x[0] = a;
    }

    function _skills3(Skill a, Skill b, Skill c) private pure returns (Skill[] memory x) {
        x = new Skill[](3);
        x[0] = a;
        x[1] = b;
        x[2] = c;
    }

    function _uint8s1(uint8 a) private pure returns (uint8[] memory x) {
        x = new uint8[](1);
        x[0] = a;
    }

    function _uint8s3(uint8 a, uint8 b, uint8 c) private pure returns (uint8[] memory x) {
        x = new uint8[](3);
        x[0] = a;
        x[1] = b;
        x[2] = c;
    }

    function _uint24s1(uint24 a) private pure returns (uint24[] memory x) {
        x = new uint24[](1);
        x[0] = a;
    }

    function _uint24s2(uint24 a, uint24 b) private pure returns (uint24[] memory x) {
        x = new uint24[](2);
        x[0] = a;
        x[1] = b;
    }

    function _guaranteed1(uint16 id, uint16 rate) private pure returns (GuaranteedReward[] memory x) {
        x = new GuaranteedReward[](1);
        x[0] = GuaranteedReward(id, rate);
    }

    function _guaranteed3(uint16 a, uint16 ar, uint16 b, uint16 br, uint16 c, uint16 cr)
        private
        pure
        returns (GuaranteedReward[] memory x)
    {
        x = new GuaranteedReward[](3);
        x[0] = GuaranteedReward(a, ar);
        x[1] = GuaranteedReward(b, br);
        x[2] = GuaranteedReward(c, cr);
    }

    function _random1(uint16 id, uint16 chance, uint8 amount) private pure returns (RandomReward[] memory x) {
        x = new RandomReward[](1);
        x[0] = RandomReward(id, chance, amount);
    }

    function _random4(
        uint16 a,
        uint16 ac,
        uint8 aa,
        uint16 b,
        uint16 bc,
        uint8 ba,
        uint16 c,
        uint16 cc,
        uint8 ca,
        uint16 d,
        uint16 dc,
        uint8 da
    ) private pure returns (RandomReward[] memory x) {
        x = new RandomReward[](4);
        x[0] = RandomReward(a, ac, aa);
        x[1] = RandomReward(b, bc, ba);
        x[2] = RandomReward(c, cc, ca);
        x[3] = RandomReward(d, dc, da);
    }
}
