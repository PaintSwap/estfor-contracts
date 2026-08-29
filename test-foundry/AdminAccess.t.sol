// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {AdminAccess} from "../contracts/AdminAccess.sol";

contract AdminAccessTest is Test {
    address private constant ALICE = address(0xA11CE);
    address private constant BOB = address(0xB0B);

    AdminAccess private adminAccess;

    function setUp() public {
        adminAccess = _deploy(new address[](0), new address[](0));
    }

    function testInitializeAdminsOnConstruction() public {
        AdminAccess initialized = _deploy(_addresses(address(this), ALICE), _addresses(ALICE));

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

    function _deploy(address[] memory admins, address[] memory promotionalAdmins) private returns (AdminAccess) {
        AdminAccess implementation = new AdminAccess();
        return AdminAccess(
            address(
                new ERC1967Proxy(
                    address(implementation), abi.encodeCall(implementation.initialize, (admins, promotionalAdmins))
                )
            )
        );
    }

    function _addresses(address a) private pure returns (address[] memory values) {
        values = new address[](1);
        values[0] = a;
    }

    function _addresses(address a, address b) private pure returns (address[] memory values) {
        values = new address[](2);
        values[0] = a;
        values[1] = b;
    }

    function _addresses(address a, address b, address c) private pure returns (address[] memory values) {
        values = new address[](3);
        values[0] = a;
        values[1] = b;
        values[2] = c;
    }
}
