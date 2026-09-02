// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {EstforTest} from "./utils/EstforTest.sol";
import {Treasury} from "../contracts/Treasury.sol";

contract TreasuryTest is EstforTest {
  event SetFundAllocationPercentages(address[] accounts, uint256[] percentages);

  address private constant TERRITORY_TREASURY = address(0x7EA5);

  function setUp() public {
    _deployTreasuryStack();
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
}
