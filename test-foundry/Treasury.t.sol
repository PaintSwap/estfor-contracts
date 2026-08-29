// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {Treasury} from "../contracts/Treasury.sol";
import {IBrushToken} from "../contracts/interfaces/external/IBrushToken.sol";
import {MockBrushToken} from "../contracts/test/external/MockBrushToken.sol";

contract TreasuryTest is Test {
    event SetFundAllocationPercentages(address[] accounts, uint256[] percentages);

    address private constant ALICE = address(0xA11CE);
    address private constant BOB = address(0xB0B);
    address private constant TERRITORY_TREASURY = address(0x7EA5);
    address private constant SHOP = address(0x5A0F);

    MockBrushToken private brush;
    Treasury private treasury;

    function setUp() public {
        brush = new MockBrushToken();
        Treasury implementation = new Treasury();
        treasury = Treasury(
            address(
                new ERC1967Proxy(
                    address(implementation), abi.encodeCall(implementation.initialize, (IBrushToken(address(brush))))
                )
            )
        );
        treasury.setSpenders(_addresses(TERRITORY_TREASURY, SHOP), true);
        brush.mint(address(treasury), 1_000 ether);
    }

    function testInitializationSetsTheRightOwner() public view {
        assertEq(treasury.owner(), address(this));
    }

    function testInitializationHasEmptyFundAllocation() public view {
        assertEq(treasury.totalClaimable(ALICE), 0);
    }

    function testSetsFundAllocationPercentagesCorrectly() public {
        address[] memory accounts = _addresses(ALICE, BOB, TERRITORY_TREASURY);
        uint256[] memory percentages = _uints(30, 20, 50);

        vm.expectEmit(false, false, false, true, address(treasury));
        emit SetFundAllocationPercentages(accounts, percentages);
        treasury.setFundAllocationPercentages(accounts, percentages);

        assertEq(treasury.totalClaimable(ALICE), 300 ether);
        assertEq(treasury.totalClaimable(BOB), 200 ether);
        assertEq(treasury.totalClaimable(TERRITORY_TREASURY), 500 ether);
    }

    function testFundAllocationRevertsIfPercentagesDoNotAddUpTo100() public {
        vm.expectRevert(abi.encodeWithSelector(Treasury.TotalPercentageNot100.selector, 80));
        treasury.setFundAllocationPercentages(_addresses(ALICE, BOB), _uints(30, 50));
    }

    function testFundAllocationRevertsIfArraysHaveDifferentLengths() public {
        vm.expectRevert(Treasury.LengthMismatch.selector);
        treasury.setFundAllocationPercentages(_addresses(ALICE, BOB), _uints(50));
    }

    function testAllowsSpendingByAuthorizedSpender() public {
        vm.prank(SHOP);
        treasury.spend(ALICE, 100 ether);

        assertEq(brush.balanceOf(address(treasury)), 900 ether);
        assertEq(brush.balanceOf(ALICE), 100 ether);
    }

    function testSpendingRevertsIfCalledByNonSpender() public {
        vm.expectRevert(Treasury.OnlySpenders.selector);
        vm.prank(ALICE);
        treasury.spend(BOB, 100 ether);
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

    function _uints(uint256 a) private pure returns (uint256[] memory values) {
        values = new uint256[](1);
        values[0] = a;
    }

    function _uints(uint256 a, uint256 b) private pure returns (uint256[] memory values) {
        values = new uint256[](2);
        values[0] = a;
        values[1] = b;
    }

    function _uints(uint256 a, uint256 b, uint256 c) private pure returns (uint256[] memory values) {
        values = new uint256[](3);
        values[0] = a;
        values[1] = b;
        values[2] = c;
    }
}
