// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {EstforTest} from "./utils/EstforTest.sol";
import {GameSubsidisationRegistry} from "../contracts/Session/GameSubsidisationRegistry.sol";

contract GameSubsidisationRegistryTest is EstforTest {
    bytes4 private constant DO_THING_SELECTOR = bytes4(keccak256("doThing()"));

    GameSubsidisationRegistry private registry;

    function setUp() public {
        GameSubsidisationRegistry implementation = new GameSubsidisationRegistry();
        registry = GameSubsidisationRegistry(
            _deployUUPS(address(implementation), abi.encodeCall(implementation.initialize, (address(this))))
        );
    }

    function testOwnerCanSetAndReadFunctionGroups() public {
        registry.setFunctionGroup(address(this), DO_THING_SELECTOR, 2);

        assertEq(registry.functionToLimitGroup(address(this), DO_THING_SELECTOR), 2);
    }

    function testNonOwnerCannotSetFunctionGroups() public {
        vm.expectRevert(abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", ALICE));
        vm.prank(ALICE);
        registry.setFunctionGroup(ALICE, DO_THING_SELECTOR, 1);
    }

    function testOwnerCanSetAndReadGroupLimits() public {
        registry.setGroupLimit(1, 5);

        assertEq(registry.groupDailyLimits(1), 5);
    }

    function testNonOwnerCannotSetGroupLimits() public {
        vm.expectRevert(abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", ALICE));
        vm.prank(ALICE);
        registry.setGroupLimit(1, 5);
    }

    function testCanUpdateExistingMappings() public {
        registry.setFunctionGroup(address(this), DO_THING_SELECTOR, 1);
        registry.setGroupLimit(1, 5);

        registry.setFunctionGroup(address(this), DO_THING_SELECTOR, 3);
        registry.setGroupLimit(1, 9);

        assertEq(registry.functionToLimitGroup(address(this), DO_THING_SELECTOR), 3);
        assertEq(registry.groupDailyLimits(1), 9);
    }
}
