// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {EstforTest} from "./utils/EstforTest.sol";
import {AdminAccess} from "../contracts/AdminAccess.sol";

contract AdminAccessTest is EstforTest {
    function setUp() public {
        adminAccess = _deployAdminAccess(new address[](0), new address[](0));
    }

    function testInitializeAdminsOnConstruction() public {
        AdminAccess initialized = _deployAdminAccess(_addresses(address(this), ALICE), _addresses(ALICE));

        assertTrue(initialized.isAdmin(address(this)));
        assertTrue(initialized.isAdmin(ALICE));
        assertTrue(initialized.isPromotionalAdmin(ALICE));
        assertFalse(initialized.isPromotionalAdmin(address(this)));
    }

    function testAddMultiplePromotionalAdmins() public {
        adminAccess.addPromotionalAdmins(_addresses(address(this), ALICE));

        assertTrue(adminAccess.isPromotionalAdmin(address(this)));
        assertTrue(adminAccess.isPromotionalAdmin(ALICE));
        assertFalse(adminAccess.isAdmin(address(this)));
    }

    function testAddPromotionalAdminsRevertsIfNotCalledByOwner() public {
        vm.expectRevert(abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", ALICE));
        vm.prank(ALICE);
        adminAccess.addPromotionalAdmins(_addresses(address(this)));
    }

    function testRemoveMultiplePromotionalAdmins() public {
        adminAccess.addPromotionalAdmins(_addresses(address(this), ALICE, BOB));
        adminAccess.removePromotionalAdmins(_addresses(address(this), BOB));

        assertFalse(adminAccess.isPromotionalAdmin(address(this)));
        assertTrue(adminAccess.isPromotionalAdmin(ALICE));
        assertFalse(adminAccess.isPromotionalAdmin(BOB));
    }

    function testRemovePromotionalAdminsRevertsIfNotCalledByOwner() public {
        adminAccess.addPromotionalAdmins(_addresses(address(this), ALICE));

        vm.expectRevert(abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", ALICE));
        vm.prank(ALICE);
        adminAccess.removePromotionalAdmins(_addresses(address(this)));
    }

    function testAddMultipleAdmins() public {
        adminAccess.addAdmins(_addresses(address(this), ALICE));

        assertTrue(adminAccess.isAdmin(address(this)));
        assertTrue(adminAccess.isAdmin(ALICE));
        assertFalse(adminAccess.isAdmin(address(adminAccess)));
    }

    function testAddMultipleAdminsRevertsIfNotCalledByOwner() public {
        vm.expectRevert(abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", ALICE));
        vm.prank(ALICE);
        adminAccess.addAdmins(_addresses(address(this)));
    }

    function testAddAnAdmin() public {
        adminAccess.addAdmins(_addresses(address(this)));

        assertTrue(adminAccess.isAdmin(address(this)));
        assertFalse(adminAccess.isAdmin(ALICE));
    }

    function testAddAnAdminRevertsIfNotCalledByOwner() public {
        vm.expectRevert(abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", ALICE));
        vm.prank(ALICE);
        adminAccess.addAdmins(_addresses(address(this)));
    }

    function testRemoveAnAdmin() public {
        adminAccess.addAdmins(_addresses(address(this), ALICE));
        adminAccess.removeAdmins(_addresses(address(this)));

        assertTrue(adminAccess.isAdmin(ALICE));
        assertFalse(adminAccess.isAdmin(address(this)));
    }

    function testRemoveAnAdminRevertsIfNotCalledByOwner() public {
        adminAccess.addAdmins(_addresses(address(this), ALICE));

        vm.expectRevert(abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", ALICE));
        vm.prank(ALICE);
        adminAccess.removeAdmins(_addresses(address(this)));
    }

    function testIsAdminReturnsTrueForAnAdmin() public {
        adminAccess.addAdmins(_addresses(address(this)));
        assertTrue(adminAccess.isAdmin(address(this)));
    }

    function testIsAdminReturnsFalseForANonAdmin() public {
        adminAccess.addAdmins(_addresses(address(this)));
        assertFalse(adminAccess.isAdmin(ALICE));
    }
}
