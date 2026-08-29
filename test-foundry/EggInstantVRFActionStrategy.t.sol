// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {EstforTest} from "./utils/EstforTest.sol";
import {EggInstantVRFActionStrategy} from "../contracts/InstantVRFActionStrategies/EggInstantVRFActionStrategy.sol";
import {InstantVRFActionInput, InstantVRFActionType} from "../contracts/globals/rewards.sol";
import {SECRET_EGG_1_TIER1} from "../contracts/globals/items.sol";

contract EggInstantVRFActionStrategyTest is EstforTest {
    uint16 private constant REWARD_BASE_PET_ID_MIN = 2;
    uint16 private constant REWARD_BASE_PET_ID_MAX = 10;
    address private constant INSTANT_VRF_ACTIONS = address(0x1A);

    EggInstantVRFActionStrategy private strategy;

    function setUp() public {
        EggInstantVRFActionStrategy implementation = new EggInstantVRFActionStrategy();
        strategy = EggInstantVRFActionStrategy(
            _deployUUPS(address(implementation), abi.encodeCall(implementation.initialize, (INSTANT_VRF_ACTIONS)))
        );
    }

    function testOnlyInstantVRFActionsCanSetAction() public {
        vm.expectRevert(EggInstantVRFActionStrategy.OnlyInstantVRFActions.selector);
        strategy.setAction(_actionInput(REWARD_BASE_PET_ID_MIN, REWARD_BASE_PET_ID_MAX));
    }

    function testSetActionAndGetRandomRewards() public {
        _setDefaultAction();

        uint256[] memory randomWords = _singleWord(uint256(1) << 240);
        (uint256[] memory itemIds, uint256[] memory itemAmounts, uint256[] memory petBaseIds) =
            strategy.getRandomRewards(1, 1, randomWords, 0);

        assertEq(itemIds.length, 0);
        assertEq(itemAmounts.length, 0);
        assertEq(petBaseIds, _singleWord(REWARD_BASE_PET_ID_MIN + 1));

        uint256 range = REWARD_BASE_PET_ID_MAX - REWARD_BASE_PET_ID_MIN + 1;
        assertEq(range % 1, 0);
        randomWords[0] = range << 240;
        (,, petBaseIds) = strategy.getRandomRewards(1, 1, randomWords, 0);
        assertEq(petBaseIds, _singleWord(REWARD_BASE_PET_ID_MIN));
    }

    function testSettingMaximumBelowMinimumReverts() public {
        strategy.setInstantVRFActions(INSTANT_VRF_ACTIONS);

        vm.expectRevert(EggInstantVRFActionStrategy.BasePetIdMinGreaterThanMax.selector);
        vm.prank(INSTANT_VRF_ACTIONS);
        strategy.setAction(_actionInput(2, 1));
    }

    function testMultipleActionAmountUsesRandomWordStartIndex() public {
        _setDefaultAction();

        uint256[] memory randomWords = new uint256[](2);
        randomWords[0] = uint256(keccak256("unused first random word"));
        randomWords[1] = (uint256(1) << 240) | (uint256(2) << 224);
        (uint256[] memory itemIds, uint256[] memory itemAmounts, uint256[] memory petBaseIds) =
            strategy.getRandomRewards(1, 2, randomWords, 1);

        assertEq(itemIds.length, 0);
        assertEq(itemAmounts.length, 0);
        uint256[] memory expectedPetBaseIds = new uint256[](2);
        expectedPetBaseIds[0] = REWARD_BASE_PET_ID_MIN + 1;
        expectedPetBaseIds[1] = REWARD_BASE_PET_ID_MIN + 2;
        assertEq(petBaseIds, expectedPetBaseIds);
    }

    function _setDefaultAction() private {
        strategy.setInstantVRFActions(INSTANT_VRF_ACTIONS);
        vm.prank(INSTANT_VRF_ACTIONS);
        strategy.setAction(_actionInput(REWARD_BASE_PET_ID_MIN, REWARD_BASE_PET_ID_MAX));
    }

    function _actionInput(uint16 minPetId, uint16 maxPetId) private pure returns (InstantVRFActionInput memory input) {
        input.actionId = 1;
        input.inputTokenIds = new uint16[](1);
        input.inputTokenIds[0] = SECRET_EGG_1_TIER1;
        input.inputAmounts = new uint24[](1);
        input.inputAmounts[0] = 1;
        input.data = abi.encode(uint8(0), EggInstantVRFActionStrategy.InstantVRFAction(minPetId, maxPetId));
        input.actionType = InstantVRFActionType.EGG;
        input.isAvailable = true;
    }

    function _singleWord(uint256 value) private pure returns (uint256[] memory values) {
        values = new uint256[](1);
        values[0] = value;
    }
}
