// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import {FullGameStack} from "./utils/FullGameStack.sol";
import {InstantVRFActions} from "./interfaces/InstantVRFActions.sol";
import {
    GenericInstantVRFActionStrategy
} from "../contracts/InstantVRFActionStrategies/GenericInstantVRFActionStrategy.sol";
import {Quests} from "./interfaces/Quests.sol";
import {PetNFT} from "./interfaces/PetNFT.sol";
import {MockVRF} from "../contracts/test/MockVRF.sol";
import {TestERC1155HolderRogue} from "../contracts/test/ERC1155HolderRogue.sol";
import {EggInstantVRFActionStrategy} from "../contracts/InstantVRFActionStrategies/EggInstantVRFActionStrategy.sol";
import {Skill} from "../contracts/globals/misc.sol";
import {PetSkin, PetEnhancementType} from "../contracts/globals/pets.sol";
import {QuestInput, QUEST_PURSE_STRINGS} from "../contracts/globals/quests.sol";
import {InstantVRFActionInput, InstantVRFActionType, InstantVRFRandomReward} from "../contracts/globals/rewards.sol";
import {NONE} from "../contracts/globals/items.sol";

contract InstantVRFActionsTest is FullGameStack {
    uint16 private constant ARROW_BASE = 11_776;
    uint16 private constant BRONZE_ARROW = ARROW_BASE;
    uint16 private constant IRON_ARROW = ARROW_BASE + 1;
    uint16 private constant MITHRIL_ARROW = ARROW_BASE + 2;
    uint16 private constant ADAMANTINE_ARROW = ARROW_BASE + 3;
    uint16 private constant RUNITE_ARROW = ARROW_BASE + 4;
    uint16 private constant ORICHALCUM_ARROW = ARROW_BASE + 6;
    uint16 private constant BAR_BASE = 10_240;
    uint16 private constant BRONZE_BAR = BAR_BASE;
    uint16 private constant IRON_BAR = BAR_BASE + 1;
    uint16 private constant MITHRIL_BAR = BAR_BASE + 2;
    uint16 private constant ADAMANTINE_BAR = BAR_BASE + 3;
    uint16 private constant RUNITE_BAR = BAR_BASE + 4;
    uint16 private constant ORICHALCUM_BAR = BAR_BASE + 6;
    uint16 private constant ADAMANTINE_ORE = 11_528;
    uint16 private constant EGG_TIER1 = 12_564;

    uint16 private constant MIN_TIER1_BASE_PET_ID = 1;
    uint16 private constant MAX_TIER1_BASE_PET_ID = 8;

    mapping(uint16 basePetId => bool seen) private _seenBasePetIds;

    function setUp() public {
        deployFullGame();
        vm.deal(ALICE, 1000 ether);
        vm.deal(address(this), 100 ether);
    }

    function testCheckInputItemOrder() public {
        _addForgingStrategies();
        InstantVRFActionInput memory input = _forgingInput();
        input.inputAmounts[0] = 4;
        vm.expectRevert(InstantVRFActions.InputAmountsMustBeInOrder.selector);
        _add(input);
        input.inputAmounts[0] = 1;
        input.inputAmounts[1] = 4;
        vm.expectRevert(InstantVRFActions.InputAmountsMustBeInOrder.selector);
        _add(input);
        input.inputAmounts[1] = 2;
        input.inputAmounts[2] = 1;
        vm.expectRevert(InstantVRFActions.InputAmountsMustBeInOrder.selector);
        _add(input);
        input.inputAmounts[2] = 3;
        _add(input);
    }

    function testActionWithQuestRequirement() public {
        _addForgingStrategies();
        InstantVRFActionInput memory input = _forgingInput();
        input.questPrerequisiteId = uint16(QUEST_PURSE_STRINGS);
        input.inputTokenIds = _uint16s(BRONZE_ARROW);
        input.inputAmounts = _uint24s(1);
        _add(input);
        itemNFT.mint(ALICE, BRONZE_ARROW, 1);
        uint256 cost = instantVRFActions.requestCost(1);
        vm.prank(ALICE);
        vm.expectRevert(InstantVRFActions.DependentQuestNotCompleted.selector);
        instantVRFActions.doInstantVRFActions{value: cost}(playerId, _uint16s(input.actionId), _uints(1));

        QuestInput[] memory qs = new QuestInput[](1);
        qs[0].questId = uint16(QUEST_PURSE_STRINGS);
        qs[0].skillReward = Skill.FIREMAKING;
        qs[0].skillXPGained = 1;
        Quests.MinimumRequirement[3][] memory reqs = new Quests.MinimumRequirement[3][](1);
        quests.addQuests(qs, reqs);
        vm.startPrank(ALICE);
        players.activateQuest(playerId, QUEST_PURSE_STRINGS);
        players.buyBrushQuest{value: 10}(ALICE, playerId, 0, true);
        instantVRFActions.doInstantVRFActions{value: cost}(playerId, _uint16s(input.actionId), _uints(1));
        vm.stopPrank();
    }

    function testCheckInputItemValidation() public {
        _addForgingStrategies();
        InstantVRFActionInput memory input = _forgingInput();
        input.inputTokenIds = _uint16s4(BRONZE_ARROW, IRON_ARROW, ADAMANTINE_ARROW, ORICHALCUM_ARROW);
        input.inputAmounts = _uint24s(1, 2, 3);
        vm.expectRevert(InstantVRFActions.TooManyInputItems.selector);
        _add(input);
        input.inputTokenIds = _uint16s(BRONZE_ARROW, IRON_ARROW);
        vm.expectRevert(InstantVRFActions.LengthMismatch.selector);
        _add(input);
        input.inputTokenIds = _uint16s(BRONZE_ARROW, IRON_ARROW, BRONZE_ARROW);
        vm.expectRevert(InstantVRFActions.InputItemNoDuplicates.selector);
        _add(input);
    }

    function testAnyInputsShouldBeBurnt() public {
        _addForgingStrategies();
        InstantVRFActionInput memory input = _forgingInput();
        _add(input);
        itemNFT.mintBatch(ALICE, _uints(BRONZE_ARROW, IRON_ARROW, ADAMANTINE_ARROW), _uints(3, 3, 3));
        _do(_uint16s(input.actionId), _uints(1));
        assertEq(itemNFT.balanceOfs(ALICE, _uint16s(BRONZE_ARROW, IRON_ARROW, ADAMANTINE_ARROW)), _uints(2, 1, 0));
    }

    function testCannotUseGreaterThanMaxActionAmountForASingleAction() public {
        _addForgingStrategies();
        InstantVRFActionInput memory input = _forgingInput();
        InstantVRFActionInput memory input1 = _forgingInput();
        input1.actionId = 2;
        _addTwo(input, input1);
        itemNFT.mintBatch(ALICE, _uints(BRONZE_ARROW, IRON_ARROW, ADAMANTINE_ARROW), _uints(1000, 1000, 1000));
        uint256 cost = instantVRFActions.requestCost(MAX_INSTANT_VRF_ACTION_AMOUNT + 1);
        vm.prank(ALICE);
        vm.expectRevert(InstantVRFActions.TooManyActionAmounts.selector);
        instantVRFActions.doInstantVRFActions{value: cost}(
            playerId, _uint16s(input.actionId), _uints(MAX_INSTANT_VRF_ACTION_AMOUNT + 1)
        );
        _do(_uint16s(input1.actionId), _uints(MAX_INSTANT_VRF_ACTION_AMOUNT));
    }

    function testCannotUseGreaterThanMaxActionAmountForCombinedActions() public {
        _addForgingStrategies();
        InstantVRFActionInput memory input = _forgingInput();
        InstantVRFActionInput memory input1 = _forgingInput();
        input1.actionId = 2;
        _addTwo(input, input1);
        itemNFT.mintBatch(ALICE, _uints(BRONZE_ARROW, IRON_ARROW, ADAMANTINE_ARROW), _uints(1000, 1000, 1000));
        uint256 cost = instantVRFActions.requestCost(MAX_INSTANT_VRF_ACTION_AMOUNT - 2 + 3);
        vm.prank(ALICE);
        vm.expectRevert(InstantVRFActions.TooManyActionAmounts.selector);
        instantVRFActions.doInstantVRFActions{value: cost}(
            playerId, _uint16s(input.actionId, input1.actionId), _uints(MAX_INSTANT_VRF_ACTION_AMOUNT - 2, 3)
        );
        _do(_uint16s(input.actionId, input1.actionId), _uints(MAX_INSTANT_VRF_ACTION_AMOUNT - 2, 1));
    }

    function testDoMultipleInstantActionsAtOnce() public {
        _addForgingStrategies();
        InstantVRFActionInput memory input = _forgingInput();
        InstantVRFActionInput memory input1 = _forgingInput();
        input1.actionId = 2;
        input1.inputTokenIds = _uint16s(BRONZE_BAR, IRON_BAR, ADAMANTINE_BAR);
        input1.inputAmounts = _uint24s(4, 5, 6);
        _addTwo(input, input1);
        uint256[] memory ids = _uints6(BRONZE_ARROW, IRON_ARROW, ADAMANTINE_ARROW, BRONZE_BAR, IRON_BAR, ADAMANTINE_BAR);
        itemNFT.mintBatch(ALICE, ids, _uints6(6, 6, 6, 6, 6, 6));
        uint16[] memory actionIds = _uint16s(input.actionId, input1.actionId);
        vm.expectEmit(false, false, false, true, address(instantVRFActions));
        emit InstantVRFActions.DoInstantVRFActions(
            ALICE,
            playerId,
            1,
            actionIds,
            _uints(2, 1),
            _uints6(BRONZE_ARROW, IRON_ARROW, ADAMANTINE_ARROW, BRONZE_BAR, IRON_BAR, ADAMANTINE_BAR),
            _uints6(2, 4, 6, 4, 5, 6)
        );
        _do(actionIds, _uints(2, 1));
        assertEq(itemNFT.balanceOfs(ALICE, _uint16s(BRONZE_ARROW, IRON_ARROW, ADAMANTINE_ARROW)), _uints(4, 2, 0));
        _fulfill(1);
        assertEq(itemNFT.balanceOfs(ALICE, _uint16s(BRONZE_BAR, IRON_BAR, ADAMANTINE_BAR)), _uints(2, 1, 0));
    }

    function testNotPayingTheRequestCost() public {
        _addForgingStrategies();
        InstantVRFActionInput memory input = _forgingInput();
        _add(input);
        itemNFT.mintBatch(ALICE, _uints(BRONZE_ARROW, IRON_ARROW, ADAMANTINE_ARROW), _uints(3, 3, 3));
        uint256 cost = instantVRFActions.requestCost(1);
        vm.prank(ALICE);
        vm.expectRevert(abi.encodeWithSelector(MockVRF.InsufficientGasPayment.selector, cost - 1, cost));
        instantVRFActions.doInstantVRFActions{value: cost - 1}(playerId, _uint16s(input.actionId), _uints(1));
    }

    function testFullModeOnlyRequiresAnUpgradedHero() public {
        _addForgingStrategies();
        InstantVRFActionInput memory input = _forgingInput();
        input.isFullModeOnly = true;
        _add(input);
        itemNFT.mintBatch(ALICE, _uints(BRONZE_ARROW, IRON_ARROW, ADAMANTINE_ARROW), _uints(3, 3, 3));
        uint256 cost = instantVRFActions.requestCost(1);
        vm.prank(ALICE);
        vm.expectRevert(InstantVRFActions.PlayerNotUpgraded.selector);
        instantVRFActions.doInstantVRFActions{value: cost}(playerId, _uint16s(input.actionId), _uints(1));
        brush.mint(ALICE, 1 ether);
        vm.startPrank(ALICE);
        brush.approve(address(playerNFT), 1 ether);
        playerNFT.editPlayer(playerId, ORIG_NAME, "", "", "", true);
        instantVRFActions.doInstantVRFActions{value: cost}(playerId, _uint16s(input.actionId), _uints(1));
        vm.stopPrank();
    }

    function testCannotAddSameInstantActionTwice() public {
        _addForgingStrategies();
        InstantVRFActionInput memory input = _forgingInput();
        _add(input);
        vm.expectRevert(InstantVRFActions.ActionAlreadyExists.selector);
        _add(input);
    }

    function testMustBeOwnerToAddAnAction() public {
        _addForgingStrategies();
        InstantVRFActionInput memory input = _forgingInput();
        vm.prank(ALICE);
        vm.expectRevert(abi.encodeWithSelector(OwnableUpgradeable.OwnableUnauthorizedAccount.selector, ALICE));
        instantVRFActions.addActions(_inputs(input));
        _add(input);
    }

    function testMustBeOwnerToEditAnAction() public {
        _addForgingStrategies();
        InstantVRFActionInput memory input = _forgingInput();
        _add(input);
        vm.prank(ALICE);
        vm.expectRevert(abi.encodeWithSelector(OwnableUpgradeable.OwnableUnauthorizedAccount.selector, ALICE));
        instantVRFActions.editActions(_inputs(input));
        instantVRFActions.editActions(_inputs(input));
    }

    function testEditedActionMustExist() public {
        _addForgingStrategies();
        InstantVRFActionInput memory input = _forgingInput();
        input.inputTokenIds = _uint16s(BRONZE_ARROW);
        input.inputAmounts = _uint24s(1);
        vm.expectRevert(InstantVRFActions.ActionDoesNotExist.selector);
        instantVRFActions.editActions(_inputs(input));
        _add(input);
        input.inputTokenIds = _uint16s(IRON_ARROW);
        vm.expectEmit(false, false, false, false, address(instantVRFActions));
        emit InstantVRFActions.EditInstantVRFActions(_inputs(input));
        instantVRFActions.editActions(_inputs(input));
        assertEq(instantVRFActions.getAction(input.actionId).inputTokenId1, IRON_ARROW);
    }

    function testMustBeOwnerToRemoveAnAction() public {
        _addForgingStrategies();
        InstantVRFActionInput memory input = _forgingInput();
        input.inputTokenIds = _uint16s(BRONZE_ARROW);
        input.inputAmounts = _uint24s(1);
        _add(input);
        vm.prank(ALICE);
        vm.expectRevert(abi.encodeWithSelector(OwnableUpgradeable.OwnableUnauthorizedAccount.selector, ALICE));
        instantVRFActions.removeActions(_uint16s(1));
    }

    function testRemovedActionMustExist() public {
        _addForgingStrategies();
        vm.expectRevert(InstantVRFActions.ActionDoesNotExist.selector);
        instantVRFActions.removeActions(_uint16s(1));
        InstantVRFActionInput memory input = _forgingInput();
        input.inputTokenIds = _uint16s(BRONZE_ARROW);
        input.inputAmounts = _uint24s(1);
        _add(input);
        vm.expectEmit(false, false, false, true, address(instantVRFActions));
        emit InstantVRFActions.RemoveInstantVRFActions(_uint16s(1));
        instantVRFActions.removeActions(_uint16s(1));
        assertEq(instantVRFActions.getAction(1).inputTokenId1, NONE);
    }

    function testMustBeOwnerOfPlayerToDoInstantActions() public {
        _addForgingStrategies();
        InstantVRFActionInput memory input = _forgingInput();
        _add(input);
        uint256 cost = instantVRFActions.requestCost(1);
        vm.expectRevert(InstantVRFActions.NotOwnerOfPlayerAndActive.selector);
        instantVRFActions.doInstantVRFActions{value: cost}(playerId, _uint16s(input.actionId), _uints(1));
    }

    function testCannotDoAnActionWhichDoesNotExist() public {
        _addForgingStrategies();
        vm.prank(ALICE);
        vm.expectRevert(InstantVRFActions.ActionDoesNotExist.selector);
        instantVRFActions.doInstantVRFActions(playerId, _uint16s(0), _uints(1));
    }

    function testAmountGreaterThanOneBurnsAndMintsAsExpected() public {
        _addForgingStrategies();
        InstantVRFActionInput memory input = _forgingInput();
        _add(input);
        itemNFT.mintBatch(ALICE, _uints(BRONZE_ARROW, IRON_ARROW, ADAMANTINE_ARROW), _uints(6, 6, 6));
        _do(_uint16s(input.actionId), _uints(2));
        _fulfill(1);
        assertEq(
            itemNFT.balanceOfs(ALICE, _uint16s4(BRONZE_ARROW, IRON_ARROW, ADAMANTINE_ARROW, RUNITE_ARROW)),
            _uints4(4, 2, 0, 4)
        );
    }

    function testCompletedInstantVRFActionsEventEmittedWithCorrectOutput() public {
        _addForgingStrategies();
        InstantVRFActionInput memory input = _forgingInput();
        _add(input);
        itemNFT.mintBatch(ALICE, _uints(BRONZE_ARROW, IRON_ARROW, ADAMANTINE_ARROW), _uints(6, 6, 6));
        _do(_uint16s(input.actionId), _uints(2));
        vm.expectEmit(false, false, false, true, address(instantVRFActions));
        emit InstantVRFActions.CompletedInstantVRFActions(
            ALICE, playerId, 1, _uints(RUNITE_ARROW, RUNITE_ARROW), _uints(2, 2), new uint256[](0)
        );
        _fulfill(1);
    }

    function testCannotMakeAnotherRequestUntilOngoingOneIsFulfilled() public {
        _addForgingStrategies();
        InstantVRFActionInput memory input = _forgingInput();
        _add(input);
        itemNFT.mintBatch(ALICE, _uints(BRONZE_ARROW, IRON_ARROW, ADAMANTINE_ARROW), _uints(12, 12, 12));
        _do(_uint16s(input.actionId), _uints(2));
        uint256 cost = instantVRFActions.requestCost(2);
        vm.prank(ALICE);
        vm.expectRevert(InstantVRFActions.AlreadyProcessing.selector);
        instantVRFActions.doInstantVRFActions{value: cost}(playerId, _uint16s(input.actionId), _uints(2));
        _fulfill(1);
        _do(_uint16s(input.actionId), _uints(2));
    }

    function testDeletingAnActionBeforeFulfillmentShouldNotRevert() public {
        _addForgingStrategies();
        InstantVRFActionInput memory input = _forgingInput();
        _add(input);
        itemNFT.mintBatch(ALICE, _uints(BRONZE_ARROW, IRON_ARROW, ADAMANTINE_ARROW), _uints(6, 6, 6));
        _do(_uint16s(input.actionId), _uints(2));
        instantVRFActions.removeActions(_uint16s(input.actionId));
        vm.expectEmit(false, false, false, true, address(instantVRFActions));
        emit InstantVRFActions.CompletedInstantVRFActions(
            ALICE, playerId, 1, new uint256[](0), new uint256[](0), new uint256[](0)
        );
        _fulfill(1);
    }

    function testRevertingReceiverShouldNotRevertTheOracleCallback() public {
        _addForgingStrategies();
        InstantVRFActionInput memory input = _forgingInput();
        _add(input);
        TestERC1155HolderRogue rogue = new TestERC1155HolderRogue();
        vm.prank(ALICE);
        playerNFT.safeTransferFrom(ALICE, address(rogue), playerId, 1, "0x00");
        itemNFT.mintBatch(address(rogue), _uints(BRONZE_ARROW, IRON_ARROW, ADAMANTINE_ARROW), _uints(6, 6, 6));
        rogue.doInstantVRFActions{value: instantVRFActions.requestCost(2)}(
            address(players), address(instantVRFActions), playerId, _uint16s(input.actionId), _uints(2)
        );
        rogue.setRevertOnReceive(true);
        vm.expectEmit(false, false, false, true, address(instantVRFActions));
        emit InstantVRFActions.CompletedInstantVRFActions(
            address(rogue), playerId, 1, new uint256[](0), new uint256[](0), new uint256[](0)
        );
        _fulfill(1);
    }

    function testAddMultipleActions() public {
        _addForgingStrategies();
        InstantVRFActionInput memory input = _forgingInput();
        input.inputTokenIds = _uint16s(IRON_ARROW, ADAMANTINE_ARROW);
        input.inputAmounts = _uint24s2(1, 2);
        InstantVRFActionInput memory input1 = _forgingInput();
        input1.actionId = 2;
        input1.inputTokenIds = _uint16s(BRONZE_ARROW, IRON_ARROW, ADAMANTINE_ARROW);
        input1.inputAmounts = _uint24s(3, 5, 7);
        _addTwo(input, input1);
        InstantVRFActions.InstantVRFAction memory action1 = instantVRFActions.getAction(1);
        assertEq(action1.inputTokenId1, IRON_ARROW);
        assertEq(action1.inputTokenId3, NONE);
        InstantVRFActions.InstantVRFAction memory action2 = instantVRFActions.getAction(2);
        assertEq(action2.inputTokenId3, ADAMANTINE_ARROW);
    }

    function testCheckPackedData() public {
        _addForgingStrategies();
        InstantVRFActionInput memory input = _forgingInput();
        input.isFullModeOnly = true;
        _add(input);
        InstantVRFActions.InstantVRFAction memory action = instantVRFActions.getAction(input.actionId);
        assertEq(action.packedData, bytes1(0xC0)); // isFullModeOnly + isAvailable
        instantVRFActions.editActions(_inputs(_unavailable(input)));
        assertEq(instantVRFActions.getAction(input.actionId).packedData, bytes1(0x80)); // isFullModeOnly only
    }

    function testCheckFullModeRequirements() public {
        _addForgingStrategies();
        InstantVRFActionInput memory input = _forgingInput();
        input.inputTokenIds = _uint16s(BRONZE_ARROW);
        input.inputAmounts = _uint24s(1);
        input.isFullModeOnly = true;
        _add(input);
        itemNFT.mint(ALICE, BRONZE_ARROW, 2);
        uint256 cost = instantVRFActions.requestCost(2);
        vm.prank(ALICE);
        vm.expectRevert(InstantVRFActions.PlayerNotUpgraded.selector);
        instantVRFActions.doInstantVRFActions{value: cost}(playerId, _uint16s(input.actionId), _uints(2));
        brush.mint(ALICE, 1 ether);
        vm.startPrank(ALICE);
        brush.approve(address(playerNFT), 1 ether);
        playerNFT.editPlayer(playerId, ORIG_NAME, "", "", "", true);
        instantVRFActions.doInstantVRFActions{value: cost}(playerId, _uint16s(input.actionId), _uints(2));
        vm.stopPrank();
    }

    function testUnavailableInstantVRFActionCannotBeStartedButCanBeLooted() public {
        _addForgingStrategies();
        InstantVRFActionInput memory input = _forgingInput();
        _add(input);
        itemNFT.mintBatch(ALICE, _uints(BRONZE_ARROW, IRON_ARROW, ADAMANTINE_ARROW), _uints(6, 6, 6));
        instantVRFActions.editActions(_inputs(_unavailable(input)));
        uint256 cost = instantVRFActions.requestCost(2);
        vm.prank(ALICE);
        vm.expectRevert(InstantVRFActions.ActionNotAvailable.selector);
        instantVRFActions.doInstantVRFActions{value: cost}(playerId, _uint16s(input.actionId), _uints(2));
        instantVRFActions.editActions(_inputs(input));
        _do(_uint16s(input.actionId), _uints(2));
        instantVRFActions.editActions(_inputs(_unavailable(input)));
        vm.expectEmit(false, false, false, true, address(instantVRFActions));
        emit InstantVRFActions.CompletedInstantVRFActions(
            ALICE, playerId, 1, _uints(RUNITE_ARROW, RUNITE_ARROW), _uints(2, 2), new uint256[](0)
        );
        _fulfill(1);
    }

    function testAddStrategies() public {
        InstantVRFActionType[] memory actionTypes =
            _actionTypes(InstantVRFActionType.FORGING, InstantVRFActionType.GENERIC);
        address[] memory strategies =
            _addresses(address(genericInstantVRFActionStrategy), address(genericInstantVRFActionStrategy));
        vm.expectEmit(false, false, false, true, address(instantVRFActions));
        emit InstantVRFActions.AddStrategies(actionTypes, strategies);
        instantVRFActions.addStrategies(actionTypes, strategies);
        assertEq(
            address(instantVRFActions.getStrategy(InstantVRFActionType.FORGING)),
            address(genericInstantVRFActionStrategy)
        );
        assertEq(
            address(instantVRFActions.getStrategy(InstantVRFActionType.GENERIC)),
            address(genericInstantVRFActionStrategy)
        );
        assertEq(address(instantVRFActions.getStrategy(InstantVRFActionType.EGG)), address(0));
    }

    function testAddingSameStrategyShouldRevert() public {
        instantVRFActions.addStrategies(
            _actionTypes(InstantVRFActionType.FORGING), _addresses(address(genericInstantVRFActionStrategy))
        );
        vm.expectRevert(InstantVRFActions.StrategyAlreadyExists.selector);
        instantVRFActions.addStrategies(
            _actionTypes(InstantVRFActionType.FORGING), _addresses(address(genericInstantVRFActionStrategy))
        );
    }

    function testUnequalLengthOfArraysShouldRevert() public {
        vm.expectRevert(InstantVRFActions.LengthMismatch.selector);
        instantVRFActions.addStrategies(_actionTypes(InstantVRFActionType.EGG), new address[](0));
    }

    function testZeroAddressOrNoneActionTypeShouldRevert() public {
        address[] memory strategies = _addresses(address(genericInstantVRFActionStrategy), address(0));
        vm.expectRevert(InstantVRFActions.InvalidStrategy.selector);
        instantVRFActions.addStrategies(
            _actionTypes(InstantVRFActionType.FORGING, InstantVRFActionType.GENERIC), strategies
        );
        vm.expectRevert(InstantVRFActions.InvalidStrategy.selector);
        instantVRFActions.addStrategies(
            _actionTypes(InstantVRFActionType.FORGING, InstantVRFActionType.NONE),
            _addresses(address(genericInstantVRFActionStrategy), address(genericInstantVRFActionStrategy))
        );
        instantVRFActions.addStrategies(
            _actionTypes(InstantVRFActionType.FORGING, InstantVRFActionType.GENERIC),
            _addresses(address(genericInstantVRFActionStrategy), address(genericInstantVRFActionStrategy))
        );
    }

    function testAddStrategiesMustBeCalledByOwner() public {
        vm.prank(ALICE);
        vm.expectRevert(abi.encodeWithSelector(OwnableUpgradeable.OwnableUnauthorizedAccount.selector, ALICE));
        instantVRFActions.addStrategies(
            _actionTypes(InstantVRFActionType.FORGING), _addresses(address(genericInstantVRFActionStrategy))
        );
        instantVRFActions.addStrategies(
            _actionTypes(InstantVRFActionType.FORGING), _addresses(address(genericInstantVRFActionStrategy))
        );
    }

    function testMustAddStrategyBeforeItCanBeUsed() public {
        InstantVRFActionInput memory input = _forgingInput();
        input.actionType = InstantVRFActionType.EGG;
        input.data = abi.encode(
            uint8(0),
            EggInstantVRFActionStrategy.InstantVRFAction({
                rewardBasePetIdMin: MIN_TIER1_BASE_PET_ID, rewardBasePetIdMax: MAX_TIER1_BASE_PET_ID
            })
        );
        vm.expectRevert(InstantVRFActions.InvalidStrategy.selector);
        instantVRFActions.addActions(_inputs(input));
        vm.expectEmit(false, false, false, true, address(instantVRFActions));
        emit InstantVRFActions.AddStrategies(
            _actionTypes(InstantVRFActionType.EGG), _addresses(address(eggInstantVRFActionStrategy))
        );
        instantVRFActions.addStrategies(
            _actionTypes(InstantVRFActionType.EGG), _addresses(address(eggInstantVRFActionStrategy))
        );
        instantVRFActions.addActions(_inputs(input));
    }

    function testRandomRewardValidation() public {
        _addForgingStrategies();
        InstantVRFActionInput memory input = _forgingInput();

        InstantVRFRandomReward[] memory rewards = new InstantVRFRandomReward[](1);
        rewards[0] = InstantVRFRandomReward(RUNITE_ARROW, 65535, 0);
        input.data = _genericData(rewards);
        vm.expectRevert(GenericInstantVRFActionStrategy.RandomRewardSpecifiedWithoutAmount.selector);
        _add(input);

        rewards[0] = InstantVRFRandomReward(NONE, 65535, 1);
        input.data = _genericData(rewards);
        vm.expectRevert(GenericInstantVRFActionStrategy.RandomRewardSpecifiedWithoutTokenId.selector);
        _add(input);

        rewards[0] = InstantVRFRandomReward(RUNITE_ARROW, 0, 1);
        input.data = _genericData(rewards);
        vm.expectRevert(GenericInstantVRFActionStrategy.RandomRewardSpecifiedWithoutChance.selector);
        _add(input);

        rewards = new InstantVRFRandomReward[](2);
        rewards[0] = InstantVRFRandomReward(RUNITE_ARROW, 1, 1);
        rewards[1] = InstantVRFRandomReward(MITHRIL_ARROW, 2, 1);
        input.data = _genericData(rewards);
        vm.expectRevert(GenericInstantVRFActionStrategy.RandomRewardChanceMustBeInOrder.selector);
        _add(input);

        // Equal chance not allowed either
        rewards[1] = InstantVRFRandomReward(MITHRIL_ARROW, 1, 1);
        input.data = _genericData(rewards);
        vm.expectRevert(GenericInstantVRFActionStrategy.RandomRewardChanceMustBeInOrder.selector);
        _add(input);

        rewards = _orderedRewards(11);
        input.data = _genericData(rewards);
        vm.expectRevert(GenericInstantVRFActionStrategy.TooManyRandomRewards.selector);
        _add(input);

        input.data = _genericData(_orderedRewards(10));
        _add(input);
    }

    function testCheckRandomRewardsMany() public {
        _addForgingStrategies();
        InstantVRFRandomReward[] memory rewards = new InstantVRFRandomReward[](4);
        rewards[0] = InstantVRFRandomReward(IRON_ARROW, 65535, 2);
        rewards[1] = InstantVRFRandomReward(MITHRIL_ARROW, 45874, 2);
        rewards[2] = InstantVRFRandomReward(ADAMANTINE_ARROW, 32767, 2);
        rewards[3] = InstantVRFRandomReward(RUNITE_ARROW, 6553, 2);
        InstantVRFActionInput memory input = _forgingInput();
        input.inputTokenIds = _uint16s(BRONZE_ARROW);
        input.inputAmounts = _uint24s(1);
        input.data = _genericData(rewards);
        InstantVRFActionInput memory input1 = _withActionId(input, 2);
        // Add it twice, just to get this tested
        _addTwo(input, input1);
        itemNFT.mint(ALICE, BRONZE_ARROW, 1_000_000);

        uint256 actionAmount1 = MAX_INSTANT_VRF_ACTION_AMOUNT / 2;
        uint256 actionAmount2 = MAX_INSTANT_VRF_ACTION_AMOUNT / 2 - 1;
        uint256 actionAmount = actionAmount1 + actionAmount2;
        // Repeat the test a bunch of times to check the random rewards are as expected
        uint256 numRepeats = 50;
        uint256 cost = instantVRFActions.requestCost(actionAmount);
        for (uint256 i; i < numRepeats; ++i) {
            vm.prank(ALICE);
            instantVRFActions.doInstantVRFActions{value: cost}(
                playerId, _uint16s(input.actionId, input1.actionId), _uints(actionAmount1, actionAmount2)
            );
            _fulfill(i + 1);
        }

        uint256[] memory balances =
            itemNFT.balanceOfs(ALICE, _uint16s4(IRON_ARROW, MITHRIL_ARROW, ADAMANTINE_ARROW, RUNITE_ARROW));
        for (uint256 i; i < rewards.length; ++i) {
            uint256 chance = i != rewards.length - 1 ? rewards[i].chance - rewards[i + 1].chance : rewards[i].chance;
            uint256 expectedBalance = (actionAmount * numRepeats * rewards[i].amount * chance) / 65535;
            assertNotEq(balances[i], expectedBalance); // Checks there is at least some randomness
            assertGe(balances[i], (expectedBalance * 20) / 100); // 20% below
            assertLe(balances[i], (expectedBalance * 120) / 100); // 20% above
        }
    }

    function testEggHatchingRandomRewards() public {
        instantVRFActions.addStrategies(
            _actionTypes(InstantVRFActionType.EGG), _addresses(address(eggInstantVRFActionStrategy))
        );
        _addBasePets();
        InstantVRFActionInput memory input = _eggInput();
        InstantVRFActionInput memory input1 = _eggInput();
        input1.actionId = 2;
        // Add it twice, just to get this tested
        _addTwo(input, input1);
        itemNFT.mint(ALICE, EGG_TIER1, 10_000_000);

        uint256 actionAmount1 = MAX_INSTANT_VRF_ACTION_AMOUNT / 2;
        uint256 actionAmount2 = MAX_INSTANT_VRF_ACTION_AMOUNT / 2 - 1;
        uint256 actionAmount = actionAmount1 + actionAmount2;
        // Repeat the test a bunch of times to check the random rewards are as expected
        uint256 numRepeats = 50;
        uint256 cost = instantVRFActions.requestCost(actionAmount);
        for (uint256 i; i < numRepeats; ++i) {
            vm.prank(ALICE);
            instantVRFActions.doInstantVRFActions{value: cost}(
                playerId, _uint16s(input.actionId, input1.actionId), _uints(actionAmount1, actionAmount2)
            );
            uint256 startPetId = petNFT.getNextPetId();
            _fulfill(i + 1);
            for (uint256 petId = startPetId; petId < petNFT.getNextPetId(); ++petId) {
                _seenBasePetIds[uint16(petNFT.getPet(petId).baseId)] = true;
            }
        }

        // Check every tier 1 base pet type was hatched
        for (uint16 basePetId = MIN_TIER1_BASE_PET_ID; basePetId <= MAX_TIER1_BASE_PET_ID; ++basePetId) {
            assertTrue(_seenBasePetIds[basePetId]);
        }
    }

    function _addForgingStrategies() private {
        instantVRFActions.addStrategies(
            _actionTypes(InstantVRFActionType.FORGING, InstantVRFActionType.GENERIC),
            _addresses(address(genericInstantVRFActionStrategy), address(genericInstantVRFActionStrategy))
        );
    }

    function _addBasePets() private {
        PetNFT.BasePetInput[] memory basePets = new PetNFT.BasePetInput[](MAX_TIER1_BASE_PET_ID);
        PetEnhancementType[8] memory enhancementTypes = [
            PetEnhancementType.MELEE,
            PetEnhancementType.MAGIC,
            PetEnhancementType.RANGED,
            PetEnhancementType.DEFENCE,
            PetEnhancementType.HEALTH,
            PetEnhancementType.MELEE_AND_DEFENCE,
            PetEnhancementType.MAGIC_AND_DEFENCE,
            PetEnhancementType.RANGED_AND_DEFENCE
        ];
        for (uint256 i; i < MAX_TIER1_BASE_PET_ID; ++i) {
            basePets[i] = PetNFT.BasePetInput({
                description: "",
                tier: 1,
                skin: PetSkin.OG,
                enhancementType: enhancementTypes[i],
                baseId: uint24(i + 1),
                isTransferable: true,
                skillEnhancements: [Skill.MELEE, Skill.DEFENCE],
                skillFixedMins: [uint8(0), uint8(0)],
                skillFixedMaxs: [uint8(0), uint8(0)],
                skillFixedIncrements: [uint8(1), uint8(0)],
                skillPercentageMins: [uint8(5), uint8(10)],
                skillPercentageMaxs: [uint8(10), uint8(20)],
                skillPercentageIncrements: [uint8(1), uint8(1)],
                skillMinLevels: [uint8(1), uint8(0)],
                fixedStarThreshold: 1,
                percentageStarThreshold: 1
            });
        }
        petNFT.addBasePets(basePets);
    }

    function _forgingInput() private pure returns (InstantVRFActionInput memory input) {
        InstantVRFRandomReward[] memory rewards = new InstantVRFRandomReward[](1);
        rewards[0] = InstantVRFRandomReward(RUNITE_ARROW, 65535, 2);
        input.actionId = 1;
        input.inputTokenIds = _uint16s(BRONZE_ARROW, IRON_ARROW, ADAMANTINE_ARROW);
        input.inputAmounts = _uint24s(1, 2, 3);
        input.data = _genericData(rewards);
        input.actionType = InstantVRFActionType.FORGING;
        input.isAvailable = true;
    }

    function _eggInput() private pure returns (InstantVRFActionInput memory input) {
        input.actionId = 1;
        input.inputTokenIds = _uint16s(EGG_TIER1);
        input.inputAmounts = _uint24s(1);
        input.data = abi.encode(
            uint8(0),
            EggInstantVRFActionStrategy.InstantVRFAction({
                rewardBasePetIdMin: MIN_TIER1_BASE_PET_ID, rewardBasePetIdMax: MAX_TIER1_BASE_PET_ID
            })
        );
        input.actionType = InstantVRFActionType.EGG;
        input.isAvailable = true;
    }

    function _genericData(InstantVRFRandomReward[] memory rewards) private pure returns (bytes memory) {
        return abi.encode(uint8(0), rewards);
    }

    function _orderedRewards(uint256 count) private pure returns (InstantVRFRandomReward[] memory rewards) {
        rewards = new InstantVRFRandomReward[](count);
        uint16[11] memory tokenIds = [
            RUNITE_ARROW,
            ORICHALCUM_ARROW,
            BRONZE_ARROW,
            IRON_ARROW,
            ADAMANTINE_ARROW,
            MITHRIL_ARROW,
            ADAMANTINE_BAR,
            MITHRIL_BAR,
            RUNITE_BAR,
            ORICHALCUM_BAR,
            ADAMANTINE_ORE
        ];
        for (uint256 i; i < count; ++i) {
            rewards[i] = InstantVRFRandomReward(tokenIds[i], i == 10 ? uint16(1) : uint16(10 - i), 1);
        }
    }

    function _unavailable(InstantVRFActionInput memory input) private pure returns (InstantVRFActionInput memory x) {
        x = _withActionId(input, input.actionId);
        x.isAvailable = false;
    }

    function _withActionId(InstantVRFActionInput memory input, uint16 actionId)
        private
        pure
        returns (InstantVRFActionInput memory x)
    {
        // Memory structs are references so a copy must be built field by field
        x = InstantVRFActionInput({
            actionId: actionId,
            inputTokenIds: input.inputTokenIds,
            inputAmounts: input.inputAmounts,
            data: input.data,
            actionType: input.actionType,
            isFullModeOnly: input.isFullModeOnly,
            isAvailable: input.isAvailable,
            questPrerequisiteId: input.questPrerequisiteId
        });
    }

    function _add(InstantVRFActionInput memory x) private {
        instantVRFActions.addActions(_inputs(x));
    }

    function _addTwo(InstantVRFActionInput memory a, InstantVRFActionInput memory b) private {
        instantVRFActions.addActions(_inputs(a, b));
    }

    function _do(uint16[] memory actionIds, uint256[] memory actionAmounts) private {
        uint256 cost = instantVRFActions.requestCost(_sum(actionAmounts));
        vm.prank(ALICE);
        instantVRFActions.doInstantVRFActions{value: cost}(playerId, actionIds, actionAmounts);
    }

    function _fulfill(uint256 requestId) private {
        mockVRF.fulfill(requestId, address(instantVRFActions));
    }

    function _sum(uint256[] memory values) private pure returns (uint256 total) {
        for (uint256 i; i < values.length; ++i) {
            total += values[i];
        }
    }

    function _inputs(InstantVRFActionInput memory a) private pure returns (InstantVRFActionInput[] memory v) {
        v = new InstantVRFActionInput[](1);
        v[0] = a;
    }

    function _inputs(InstantVRFActionInput memory a, InstantVRFActionInput memory b)
        private
        pure
        returns (InstantVRFActionInput[] memory v)
    {
        v = new InstantVRFActionInput[](2);
        v[0] = a;
        v[1] = b;
    }

    function _actionTypes(InstantVRFActionType a) private pure returns (InstantVRFActionType[] memory v) {
        v = new InstantVRFActionType[](1);
        v[0] = a;
    }

    function _actionTypes(InstantVRFActionType a, InstantVRFActionType b)
        private
        pure
        returns (InstantVRFActionType[] memory v)
    {
        v = new InstantVRFActionType[](2);
        v[0] = a;
        v[1] = b;
    }

    function _uint16s4(uint16 a, uint16 b, uint16 c, uint16 d) private pure returns (uint16[] memory v) {
        v = new uint16[](4);
        v[0] = a;
        v[1] = b;
        v[2] = c;
        v[3] = d;
    }

    function _uint24s2(uint24 a, uint24 b) private pure returns (uint24[] memory v) {
        v = new uint24[](2);
        v[0] = a;
        v[1] = b;
    }

    function _uints4(uint256 a, uint256 b, uint256 c, uint256 d) private pure returns (uint256[] memory v) {
        v = new uint256[](4);
        v[0] = a;
        v[1] = b;
        v[2] = c;
        v[3] = d;
    }

    function _uints6(uint256 a, uint256 b, uint256 c, uint256 d, uint256 e, uint256 f)
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
}
