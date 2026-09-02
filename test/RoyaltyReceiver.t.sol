// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {EstforTest} from "./utils/EstforTest.sol";
import {RoyaltyReceiver} from "../contracts/RoyaltyReceiver.sol";
import {IBrushToken} from "../contracts/interfaces/external/IBrushToken.sol";
import {ISolidlyRouter} from "../contracts/interfaces/external/ISolidlyRouter.sol";
import {MockRouter} from "../contracts/test/external/MockRouter.sol";
import {MockBrushToken} from "../contracts/test/external/MockBrushToken.sol";

contract RoyaltyReceiverTest is EstforTest {
  address private constant TREASURY = address(0x7EA5);

  function setUp() public {
    brush = new MockBrushToken();
    MockRouter router = new MockRouter();
    RoyaltyReceiver implementation = new RoyaltyReceiver();
    royaltyReceiver = RoyaltyReceiver(
      payable(
        _deployUUPS(
          address(implementation),
          abi.encodeCall(
            implementation.initialize,
            (ISolidlyRouter(address(router)), TREASURY, DEV, IBrushToken(address(brush)), address(this))
          )
        )
      )
    );
  }

  function testCheckRecipients() public {
    vm.deal(ALICE, 100);
    uint256 beforeBalance = DEV.balance;

    vm.prank(ALICE);
    (bool success, ) = address(royaltyReceiver).call{value: 100}("");

    assertTrue(success);
    assertEq(DEV.balance, beforeBalance + 33);
    assertEq(brush.balanceOf(TREASURY), 6);
  }

  function testDistributeBrush() public {
    assertEq(brush.balanceOf(TREASURY), 0);
    brush.mint(address(royaltyReceiver), 100);

    royaltyReceiver.distributeBrush();

    assertEq(brush.balanceOf(TREASURY), 100);
  }
}
